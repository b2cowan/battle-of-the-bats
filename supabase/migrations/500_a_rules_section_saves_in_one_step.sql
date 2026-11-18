-- 500 · A Rules section saves in one step (Board Ready trust close-out 8, owner 2026-11-18; sweep 3 finding 2's known residue).
--
-- PUT /api/admin/rules saved a section as several separate writes (the section, then deletes, updates and inserts of its
-- points). A save the browser gave up on (a timeout) could already have inserted its new points; the retry sent them again
-- with no id, and they were inserted twice. A failure part-way also left a half-applied save.
--
-- Now: ONE function, one transaction. The browser gives each new point its id BEFORE its first save, so a retry names the
-- same point and this UPSERTS it (insert, or update in place) — never a second row. A point id that belongs to ANOTHER section
-- is refused (`rule_item_foreign`), never moved. The section's points are then exactly the ones sent, in the order sent
-- (display_order = position); every other point of the section is deleted. A point with no id (an older screen) still gets a
-- fresh one. Returns { key: id } for every point sent.
--
-- The route checks the caller (club, post_rules, the event in scope, the divisions the event's own) before calling this;
-- like org_permit_save (mig 322) it is the service role's alone.
--
-- ORDER on production: apply this FIRST, then ship the code (the code calls it; before it exists every Rules edit fails).
-- Additive and idempotent: nothing calls it until the code ships.

begin;

create or replace function public.rule_section_save(
  p_rule uuid,
  p_title text,
  p_icon text,
  p_division_ids uuid[],
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_order int := 0;
  v_id uuid;
  v_kept uuid[] := '{}';
  v_out jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'rule_items_bad' using errcode = '22023';
  end if;

  update public.rules
     set title = p_title, icon = p_icon, division_ids = p_division_ids
   where id = p_rule;
  if not found then
    raise exception 'rule_not_found' using errcode = 'P0002';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    insert into public.rule_items (id, rule_id, content, display_order)
    values (v_id, p_rule, v_item->>'content', v_order)
    on conflict (id) do update
      set content = excluded.content, display_order = excluded.display_order
      where public.rule_items.rule_id = p_rule;
    -- The id is another section's point: the conflict's WHERE matched nothing, so nothing was written.
    if not found then
      raise exception 'rule_item_foreign' using errcode = 'P0001';
    end if;
    v_kept := v_kept || v_id;
    v_out := v_out || jsonb_build_object(v_item->>'key', v_id);
    v_order := v_order + 1;
  end loop;

  delete from public.rule_items where rule_id = p_rule and not (id = any (v_kept));
  return v_out;
end;
$$;

revoke all on function public.rule_section_save(uuid, text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.rule_section_save(uuid, text, text, uuid[], jsonb) to service_role;

commit;
