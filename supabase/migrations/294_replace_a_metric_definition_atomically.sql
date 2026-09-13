-- 294 — Replacing a metric definition is ONE transaction
-- (development lifecycle Phase 1, owner ruling 3 — a unit or method change on a test with readings
-- starts a new definition and retires this one; built 2026-09-12; this function replaces the
-- app-side three-step with compensation after /review found the window it left.)
--
-- THE SHAPE: retire the predecessor → insert the successor under the SAME name → point the
-- predecessor at it. The partial unique index on active names (mig 189) dictates that order, and
-- with no transaction on the app's client each later step had to undo the earlier ones on failure.
-- Two reviewers found what that cannot cover: if the link write fails after the successor exists,
-- the compensating delete is refused the moment a reading points at the successor (RESTRICT FK),
-- and the predecessor's restore then collides with the successor on the name index — leaving a
-- retired predecessor beside an active, unlinked twin. Inside one transaction none of that
-- arithmetic exists: any failure rolls the whole step back.
--
-- What it enforces, in order: the predecessor exists on THIS team (row lock, FOR UPDATE — two
-- coaches replacing the same definition serialize, and the second finds it already retired), is
-- active, is a measured test; the successor is a test with a unit; the name is the predecessor's
-- unless renamed. A unique-name collision surfaces as 23505, which the route already maps to 409.
-- The CHECKs of mig 293 hold throughout (the predecessor is retired before it is linked).
--
-- ⚠ SECURITY DEFINER and EXECUTE for service_role ONLY. This function checks that the predecessor
-- belongs to p_team, but nothing inside it can know whether the CALLER coaches p_team — that is the
-- route's job (`canWriteDevelopment`). Granting it to `authenticated` would hand any signed-in user
-- an RLS bypass with a team id as the only key. (The 289 merge function grants `authenticated` and
-- carries the same shape — noted for the DBA log; not widened here.)
--
-- ALSO IN THIS FILE — two CHECKs the review found the table missing, so the database says what the
-- reader says (mig 141's rule: neither looser nor stricter): a record-only test has no "best"
-- (no direction to be best in), and an observed skill carries no aim, range, attempts or headline
-- of its own. And the `headline` column default goes back to 'last' beside the aim default
-- 'record' — a raw insert taking both defaults must satisfy the new CHECK; the ruled default,
-- best, is the READER's default for a directional aim (`defaultHeadlineFor`) and every create goes
-- through it. Every dev row already satisfies both (verified before writing).
--
-- ⚠ THE FUNCTION IS INVISIBLE TO BOTH DRIFT GATES (it adds no table, column, CHECK or index) — its
-- prod state is knowable only from pg_proc; MANUAL_PROD_STEPS.json carries it, and the authoring
-- gate flags `create function` on its own. The two CHECKs and the default ARE visible to the parity
-- gate, so this file is order-critical on release like 293.

begin;

create or replace function public.replace_rep_team_measurable_type(
  p_predecessor uuid,
  p_team uuid,
  p_org uuid,
  p_created_by uuid,
  p_name text,
  p_unit text,
  p_aim text,
  p_range_from numeric,
  p_range_to numeric,
  p_method text,
  p_attempts smallint,
  p_headline text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.rep_team_measurable_types%rowtype;
  v_successor uuid;
begin
  select * into v_pred
    from public.rep_team_measurable_types
   where id = p_predecessor and team_id = p_team
   for update;
  if not found then
    raise exception 'replace_rep_team_measurable_type_not_found';
  end if;
  if not v_pred.is_active then
    raise exception 'replace_rep_team_measurable_type_not_active';
  end if;
  if v_pred.kind <> 'test' then
    raise exception 'replace_rep_team_measurable_type_not_a_test';
  end if;

  -- 1. Retire the predecessor (frees its name on the partial unique index).
  update public.rep_team_measurable_types
     set is_active = false, updated_at = now()
   where id = v_pred.id;

  -- 2. The successor, under the (possibly renamed) name, with the new definition and no readings.
  insert into public.rep_team_measurable_types
    (org_id, team_id, name, unit, kind, aim, range_from, range_to, method,
     attempts_per_session, headline, descriptors, sort_order, is_active, created_by)
  values
    (p_org, p_team, btrim(p_name), btrim(p_unit), 'test', p_aim, p_range_from, p_range_to, p_method,
     p_attempts, p_headline, '{}', v_pred.sort_order, true, p_created_by)
  returning id into v_successor;

  -- 3. The link — the retired predecessor points at what replaced it.
  update public.rep_team_measurable_types
     set replaced_by_id = v_successor, updated_at = now()
   where id = v_pred.id;

  return v_successor;
end;
$$;

comment on function public.replace_rep_team_measurable_type(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric, text, smallint, text) is
  'Owner ruling 3 (2026-09-11): retire the predecessor, insert the successor under its name, link them — one transaction. service_role only; the route proves the caller may write development.';

revoke all on function public.replace_rep_team_measurable_type(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric, text, smallint, text) from public, anon, authenticated;
grant execute on function public.replace_rep_team_measurable_type(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric, text, smallint, text) to service_role;

alter table public.rep_team_measurable_types alter column headline set default 'last';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_record_has_no_best_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_record_has_no_best_check
      check (aim <> 'record' or headline <> 'best');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_skill_shape_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_skill_shape_check
      check (kind <> 'skill' or (aim = 'record' and headline = 'last' and attempts_per_session = 1 and range_from is null and range_to is null));
  end if;
end $$;

commit;

-- Verify (dev and, later, prod — the gates cannot):
--   select proname, prosecdef from pg_proc where proname = 'replace_rep_team_measurable_type';
--   → one row, prosecdef true.
