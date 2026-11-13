-- 482_a_merged_child_keeps_the_family_answers.sql — Signed-in family accounts Stage 4b, Session 4 (owner ruling 2026-11-13: fix now).
--
-- WHY: Stage 14's child join (org_children_join, last re-created by mig 453) re-points every table that names a child, then deletes
-- the absorbed record. Mig 476's event_availability_answers was made after it and is not re-pointed, and its child FK cascades, so a
-- join silently DELETED the absorbed record's family answers.
--
-- WHAT: org_children_join re-created from 453 with ONE added step (marked "(482)"): the answers move to the kept child; where both
-- records answered the same event, the newer answer wins (a tie keeps the kept child's). Nothing else in the function changes.
-- No table or column change. Idempotent (create or replace). ORDER: after mig 476 (the table) and 453 (the function).

create or replace function public.org_children_join(p_keep uuid, p_absorb uuid, p_keep_identity boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_year   int;
  v_absorb_year int;
  k record;
  a record;
begin
  if p_keep is null or p_absorb is null or p_keep = p_absorb then return; end if;
  perform 1 from public.org_children where id in (p_keep, p_absorb) order by id for update;
  if (select count(*) from public.org_children where id in (p_keep, p_absorb)) < 2 then return; end if;
  if (select org_id from public.org_children where id = p_keep)
     is distinct from (select org_id from public.org_children where id = p_absorb) then
    raise exception 'org_child_other_org: two children of different organizations cannot be joined' using errcode = '23514';
  end if;
  select max(y.year) into v_keep_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_keep;
  select max(y.year) into v_absorb_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_absorb;
  select medical_notes, emergency_contact_name, emergency_contact_phone, date_of_birth into k from public.org_children where id = p_keep;
  select medical_notes, emergency_contact_name, emergency_contact_phone, date_of_birth into a from public.org_children where id = p_absorb;

  update public.rep_roster_players       set child_id = p_keep where child_id = p_absorb;
  update public.rep_tryout_registrations set child_id = p_keep where child_id = p_absorb;
  update public.league_registrations     set child_id = p_keep where child_id = p_absorb;

  -- (445, re-keyed by 453) The parent links ride with the entries. Two live links for one address (one from each child) would
  -- collide with the live-unique rule, and the person is the same: the more connected one stays (verified over waiting over
  -- invited over requested; on a tie the kept child's), the other is ended ('merged'). Then every remaining link of the absorbed
  -- child becomes the kept child's. (The two-guardian cap still applies: a join that would give one child a third live guardian
  -- raises guardian_cap_reached and nothing moves.)
  update public.family_links l
     set status = 'revoked', revoked_at = now(), ended_by = 'merged', calendar_token_hash = null, updated_at = now()
   where l.child_id in (p_keep, p_absorb)
     and l.status not in ('declined', 'revoked')
     and exists (
       select 1 from public.family_links o
        where o.id <> l.id
          and o.child_id in (p_keep, p_absorb) and o.child_id <> l.child_id
          and o.invited_email = l.invited_email and o.role = l.role
          and o.status not in ('declined', 'revoked')
          and (
            (case o.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
              > (case l.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
            or (
              (case o.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
                = (case l.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
              and o.child_id = p_keep
            )
          )
     );
  update public.family_links set child_id = p_keep where child_id = p_absorb;
  -- (453) A rep coach's open invitation names the child too: it follows, rather than cascading away with the absorbed record.
  update public.family_invitations set child_id = p_keep where child_id = p_absorb;
  -- (482) The families' In / Out / Maybe answers (Stage 4b, mig 476) follow the child too. Before this they cascaded away with the
  -- absorbed record and the family saw "no answer" on events they had answered. One answer per child per event: where BOTH records
  -- answered the same event, the NEWER answer stays (latest wins, as between two parents; a tie keeps the kept child's), then every
  -- remaining answer of the absorbed child becomes the kept child's. Notes stay with their answers (mig 480 clears nothing on a merge).
  delete from public.event_availability_answers x
   using public.event_availability_answers y
   where x.child_id in (p_keep, p_absorb) and y.child_id in (p_keep, p_absorb) and x.child_id <> y.child_id
     and x.event_kind = y.event_kind and x.event_id = y.event_id
     and (x.answered_at < y.answered_at or (x.answered_at = y.answered_at and x.child_id = p_absorb));
  update public.event_availability_answers set child_id = p_keep, updated_at = now() where child_id = p_absorb;

  insert into public.child_match_rejections (child_a_id, child_b_id, door, rejected_by, rejected_at)
  select least(p_keep, x.other), greatest(p_keep, x.other), x.door, x.rejected_by, x.rejected_at
    from (
      select case when r.child_a_id = p_absorb then r.child_b_id else r.child_a_id end as other,
             r.door, r.rejected_by, r.rejected_at
        from public.child_match_rejections r
       where p_absorb in (r.child_a_id, r.child_b_id)
    ) x
   where x.other <> p_keep
  on conflict (child_a_id, child_b_id) do nothing;

  if coalesce(v_absorb_year, -1) > coalesce(v_keep_year, -1) then
    update public.org_children
       set medical_notes           = coalesce(a.medical_notes, k.medical_notes),
           emergency_contact_name  = coalesce(a.emergency_contact_name, k.emergency_contact_name),
           emergency_contact_phone = coalesce(a.emergency_contact_phone, k.emergency_contact_phone),
           date_of_birth           = coalesce(k.date_of_birth, a.date_of_birth), -- (review) a keeper with none takes the other's
           updated_at = now()
     where id = p_keep;
  else
    update public.org_children
       set medical_notes           = coalesce(k.medical_notes, a.medical_notes),
           emergency_contact_name  = coalesce(k.emergency_contact_name, a.emergency_contact_name),
           emergency_contact_phone = coalesce(k.emergency_contact_phone, a.emergency_contact_phone),
           date_of_birth           = coalesce(k.date_of_birth, a.date_of_birth), -- (review) a keeper with none takes the other's
           updated_at = now()
     where id = p_keep;
  end if;
  update public.rep_roster_players r
     set medical_notes = c.medical_notes,
         emergency_contact_name = c.emergency_contact_name,
         emergency_contact_phone = c.emergency_contact_phone
    from public.org_children c, public.rep_program_years y
   where c.id = p_keep
     and r.child_id = p_keep
     and y.id = r.program_year_id
     and y.status in ('draft', 'active')
     and (nullif(btrim(r.medical_notes), ''), nullif(btrim(r.emergency_contact_name), ''),
          nullif(btrim(r.emergency_contact_phone), ''))
         is distinct from (c.medical_notes, c.emergency_contact_name, c.emergency_contact_phone);
  delete from public.org_children where id = p_absorb;
  -- (445) The Children queue keeps the record the reviewer chose, name and birth date included.
  if not p_keep_identity then
    perform public.org_child_rename_from_entries(p_keep);
  end if;
end;
$$;

revoke all on function public.org_children_join(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.org_children_join(uuid, uuid, boolean) to service_role;

notify pgrst, 'reload schema';
