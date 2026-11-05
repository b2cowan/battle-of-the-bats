-- Club Tier Stage 14 S4 · mig 441 on DEV — one DO block that proves its rules and rolls itself back (raises at the end).
-- Run: node .probe/s2-child/q.mjs --file tests/sql/child-health-fixture.sql
-- Expect the error text "S4 FIXTURE OK: 12/12" (the raise is the rollback); anything else is a failure.
-- (The split's health re-read calls org_child_health_from_entries, proved in rule 6; the split itself is
-- tests/sql/org-children-fixture.sql's.)
do $$
declare
  v_live  public.rep_program_years%rowtype;
  v_y     public.rep_program_years%rowtype;
  v_c uuid; v_d uuid; v_e uuid;            -- a closed year, a second live year, a later closed year
  v_tpl   public.rep_document_templates%rowtype;
  v_x uuid; v_y_child uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid;
  v_ok int := 0;
  v_m text; v_n text; v_p text;
begin
  select * into v_live from public.rep_program_years where status in ('draft', 'active') order by created_at limit 1;
  if v_live.id is null then raise exception 'S4 FIXTURE: no live season on dev'; end if;

  v_y := v_live; v_y.id := gen_random_uuid(); v_y.year := v_live.year - 7; v_y.status := 'completed'; v_y.name := 'Fixture closed';
  insert into public.rep_program_years select (v_y).*; v_c := v_y.id;
  v_y := v_live; v_y.id := gen_random_uuid(); v_y.year := v_live.year + 7; v_y.status := 'draft'; v_y.name := 'Fixture draft';
  insert into public.rep_program_years select (v_y).*; v_d := v_y.id;
  v_y := v_live; v_y.id := gen_random_uuid(); v_y.year := v_live.year + 8; v_y.status := 'completed'; v_y.name := 'Fixture later';
  insert into public.rep_program_years select (v_y).*; v_e := v_y.id;

  -- 1. A template written without a validity takes its type's default.
  select * into v_tpl from public.rep_document_templates limit 1;
  if v_tpl.id is not null then
    v_tpl.id := gen_random_uuid(); v_tpl.validity := null; v_tpl.document_type := 'waiver';
    insert into public.rep_document_templates select (v_tpl).*;
    if (select validity from public.rep_document_templates where id = v_tpl.id) <> 'signed_each_season' then
      raise exception 'S4 FIXTURE FAIL 1a: a waiver did not default to signed each season';
    end if;
    v_tpl.id := gen_random_uuid(); v_tpl.document_type := 'medical_consent';
    insert into public.rep_document_templates select (v_tpl).*;
    if (select validity from public.rep_document_templates where id = v_tpl.id) <> 'good_until_replaced' then
      raise exception 'S4 FIXTURE FAIL 1b: a medical consent did not default to good until replaced';
    end if;
  end if;
  v_ok := v_ok + 1;

  -- A closed season's entry mints a child and does NOT seed its health (a past season stays as recorded).
  insert into public.rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, medical_notes)
  values (v_c, v_live.team_id, v_live.org_id, 'Fx', 'Health', 'Peanut allergy') returning id, child_id into e1, v_x;
  if (select medical_notes from public.org_children where id = v_x) is not null then
    raise exception 'S4 FIXTURE FAIL 2: a closed season''s insert wrote the child';
  end if;
  v_ok := v_ok + 1;

  -- 3. The backfill rule (org_child_health_from_entries): the child takes its newest entry that has a value.
  perform public.org_child_health_from_entries(v_x);
  if (select medical_notes from public.org_children where id = v_x) is distinct from 'Peanut allergy' then
    raise exception 'S4 FIXTURE FAIL 3: the child did not take its entry''s value';
  end if;
  v_ok := v_ok + 1;

  -- 4. A live entry inserted blank for that child takes the child's value.
  insert into public.rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name)
  values (v_live.id, v_live.team_id, v_live.org_id, v_x, 'Fx', 'Health') returning id into e2;
  if (select medical_notes from public.rep_roster_players where id = e2) is distinct from 'Peanut allergy' then
    raise exception 'S4 FIXTURE FAIL 4: a blank live entry did not take the child''s value';
  end if;
  v_ok := v_ok + 1;

  -- 5. A live entry inserted WITH its own value writes the child, and every other live entry follows; the closed one does not.
  insert into public.rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name,
                                         emergency_contact_name, emergency_contact_phone)
  values (v_d, v_live.team_id, v_live.org_id, v_x, 'Fx', 'Health', 'Wei Chen', '(416) 555-0181') returning id into e3;
  select emergency_contact_name into v_n from public.rep_roster_players where id = e2;
  if v_n is distinct from 'Wei Chen'
     or (select emergency_contact_name from public.org_children where id = v_x) is distinct from 'Wei Chen'
     or (select emergency_contact_name from public.rep_roster_players where id = e1) is not null
     or (select medical_notes from public.rep_roster_players where id = e3) is distinct from 'Peanut allergy' then
    raise exception 'S4 FIXTURE FAIL 5: a live insert did not reach the child and the other live entry (or reached the closed one)';
  end if;
  v_ok := v_ok + 1;

  -- 6. A live edit writes through; clearing it clears the child; the re-read then takes the OLDER value back (a blank
  --    newer entry never wipes an allergy recorded on an older one — the backfill's, the split's rule).
  update public.rep_roster_players set medical_notes = 'Tree nuts' where id = e2;
  if (select medical_notes from public.rep_roster_players where id = e3) is distinct from 'Tree nuts'
     or (select medical_notes from public.rep_roster_players where id = e1) is distinct from 'Peanut allergy' then
    raise exception 'S4 FIXTURE FAIL 6a: a live edit did not reach the other live entry, or changed the closed one';
  end if;
  update public.rep_roster_players set medical_notes = '  ' where id = e3;
  if (select medical_notes from public.org_children where id = v_x) is not null
     or (select medical_notes from public.rep_roster_players where id = e2) is not null then
    raise exception 'S4 FIXTURE FAIL 6b: clearing a live entry did not clear the child and the other live entry';
  end if;
  perform public.org_child_health_from_entries(v_x);
  if (select medical_notes from public.org_children where id = v_x) is distinct from 'Peanut allergy'
     or (select medical_notes from public.rep_roster_players where id = e3) is distinct from 'Peanut allergy' then
    raise exception 'S4 FIXTURE FAIL 6c: the re-read did not take the older value back';
  end if;
  v_ok := v_ok + 1;

  -- 7. A join: the NEWER child's value wins column by column; the other's fills its blanks; the absorbed record goes.
  insert into public.rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name)
  values (v_e, v_live.team_id, v_live.org_id, 'Fx', 'Other') returning id, child_id into e4, v_y_child;
  update public.org_children set medical_notes = 'Bee stings', emergency_contact_name = null, emergency_contact_phone = null
   where id = v_y_child;
  perform public.org_children_join(v_x, v_y_child);
  select medical_notes, emergency_contact_name, emergency_contact_phone into v_m, v_n, v_p
    from public.org_children where id = v_x;
  if v_m is distinct from 'Bee stings' or v_n is distinct from 'Wei Chen' or v_p is distinct from '(416) 555-0181' then
    raise exception 'S4 FIXTURE FAIL 7a: the join kept % / % / %', v_m, v_n, v_p;
  end if;
  if exists (select 1 from public.org_children where id = v_y_child) then
    raise exception 'S4 FIXTURE FAIL 7b: the absorbed record outlived the join';
  end if;
  v_ok := v_ok + 1;

  -- 8. ...and the kept child's live entries follow; the closed entries keep their own copies (history).
  if (select medical_notes from public.rep_roster_players where id = e2) is distinct from 'Bee stings'
     or (select medical_notes from public.rep_roster_players where id = e1) is distinct from 'Peanut allergy'
     or (select medical_notes from public.rep_roster_players where id = e4) is not null then
    raise exception 'S4 FIXTURE FAIL 8: after the join the live entries did not follow, or a closed one changed';
  end if;
  v_ok := v_ok + 1;

  -- 9. A child edited directly (the club's child page, S5) reaches its live entries.
  update public.org_children set emergency_contact_phone = '(416) 555-0199' where id = v_x;
  if (select emergency_contact_phone from public.rep_roster_players where id = e3) is distinct from '(416) 555-0199'
     or (select emergency_contact_phone from public.rep_roster_players where id = e1) is not null then
    raise exception 'S4 FIXTURE FAIL 9: a child edit did not reach the live entries (or reached the closed one)';
  end if;
  v_ok := v_ok + 1;

  -- 10. (/review F1) A live entry inserted WITH its own, older value for a child that already holds a newer one: the
  --     child's value wins; the child is not overwritten.
  declare v_f uuid; ef uuid; begin
    v_y := v_live; v_y.id := gen_random_uuid(); v_y.year := v_live.year + 9; v_y.status := 'draft'; v_y.name := 'Fixture third';
    insert into public.rep_program_years select (v_y).*; v_f := v_y.id;
    insert into public.rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name, medical_notes)
    values (v_f, v_live.team_id, v_live.org_id, v_x, 'Fx', 'Health', 'Stale copy') returning id into ef;
    if (select medical_notes from public.rep_roster_players where id = ef) is distinct from 'Bee stings'
       or (select medical_notes from public.org_children where id = v_x) is distinct from 'Bee stings' then
      raise exception 'S4 FIXTURE FAIL 10: an older copied value overwrote the child (or the entry kept it)';
    end if;
  end;
  v_ok := v_ok + 1;

  -- 11. (/review F2) A join where the KEPT side wins still brings the absorbed side's live entries to the child's value.
  declare k uuid; a uuid; ek uuid; ea uuid; begin
    insert into public.rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, medical_notes)
    values (v_d, v_live.team_id, v_live.org_id, 'Fx', 'KeepSide', 'KEEP-NOTE') returning id, child_id into ek, k;
    insert into public.rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, medical_notes)
    values (v_live.id, v_live.team_id, v_live.org_id, 'Fx', 'AbsorbSide', 'ABSORB-NOTE') returning id, child_id into ea, a;
    perform public.org_children_join(k, a);
    if (select medical_notes from public.org_children where id = k) is distinct from 'KEEP-NOTE'
       or (select medical_notes from public.rep_roster_players where id = ea) is distinct from 'KEEP-NOTE' then
      raise exception 'S4 FIXTURE FAIL 11: the absorbed side''s live entry kept a stale value after the join';
    end if;
  end;
  v_ok := v_ok + 1;

  -- 12. (/review F3) An entry made live again (a Reopen) with older values: editing ONE column sends only that column.
  declare v_g uuid; z uuid; ez uuid; begin
    v_y := v_live; v_y.id := gen_random_uuid(); v_y.year := v_live.year - 9; v_y.status := 'completed'; v_y.name := 'Fixture reopened';
    insert into public.rep_program_years select (v_y).*; v_g := v_y.id;
    insert into public.rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, medical_notes, emergency_contact_phone)
    values (v_g, v_live.team_id, v_live.org_id, 'Fx', 'Reopened', 'OLD-MED', 'OLD-PH') returning id, child_id into ez, z;
    update public.org_children set medical_notes = 'NEW-MED', emergency_contact_phone = 'NEW-PH' where id = z;
    update public.rep_program_years set status = 'draft' where id = v_g;
    update public.rep_roster_players set emergency_contact_phone = 'EDIT-PH' where id = ez;
    if (select medical_notes from public.org_children where id = z) is distinct from 'NEW-MED'
       or (select emergency_contact_phone from public.org_children where id = z) is distinct from 'EDIT-PH' then
      raise exception 'S4 FIXTURE FAIL 12: editing one column of a reopened entry pushed its older other columns to the child';
    end if;
  end;
  v_ok := v_ok + 1;

  raise exception 'S4 FIXTURE OK: %/12', v_ok;
end $$;
