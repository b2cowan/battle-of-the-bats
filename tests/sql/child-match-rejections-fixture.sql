-- Club Tier Stage 14 S3 · mig 438 on DEV — one DO block that proves its rules and rolls itself back (raises at the end).
-- Run: node .probe/s2-child/q.mjs --file tests/sql/child-match-rejections-fixture.sql
-- Expect the error text "S3 FIXTURE OK: 4/4" (the raise is the rollback); anything else is a failure.
do $$
declare
  v_entry  public.rep_roster_players%rowtype;
  v_org uuid;
  v_a uuid; v_b uuid; v_c uuid;
  v_ok int := 0;
  v_n int;
begin
  select * into v_entry from public.rep_roster_players where status <> 'callup' order by created_at limit 1;
  if v_entry.id is null then raise exception 'S3 FIXTURE: no roster entry on dev'; end if;
  v_org := v_entry.org_id;

  -- 1. A second entry for the same child in the same season is refused by the index.
  begin
    insert into public.rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name)
    values (v_entry.program_year_id, v_entry.team_id, v_entry.org_id, v_entry.child_id, 'Dup', 'Child');
    raise exception 'S3 FIXTURE FAIL 1: a second entry for one child in one season was accepted';
  exception when unique_violation then
    if sqlerrm like '%rep_roster_players_one_child_per_season%' then v_ok := v_ok + 1; else raise; end if;
  end;

  -- 2. The stored "no" is ordered: a swapped pair is refused by the CHECK.
  insert into public.org_children (org_id, first_name, last_name) values (v_org, 'Fx', 'A') returning id into v_a;
  insert into public.org_children (org_id, first_name, last_name) values (v_org, 'Fx', 'B') returning id into v_b;
  insert into public.org_children (org_id, first_name, last_name) values (v_org, 'Fx', 'C') returning id into v_c;
  begin
    insert into public.child_match_rejections (child_a_id, child_b_id, door)
    values (greatest(v_a, v_b), least(v_a, v_b), 'single_add');
    raise exception 'S3 FIXTURE FAIL 2: an unordered pair was accepted';
  exception when check_violation then v_ok := v_ok + 1;
  end;

  -- 3. A join moves the absorbed child's "no"s to the kept child (and drops a "no" between the two joined).
  insert into public.child_match_rejections (child_a_id, child_b_id, door) values (least(v_b, v_c), greatest(v_b, v_c), 'paste_list');
  insert into public.child_match_rejections (child_a_id, child_b_id, door) values (least(v_a, v_b), greatest(v_a, v_b), 'tryout_accept');
  perform public.org_children_join(v_a, v_b);
  select count(*) into v_n from public.child_match_rejections where least(v_a, v_c) = child_a_id and greatest(v_a, v_c) = child_b_id;
  if v_n <> 1 then raise exception 'S3 FIXTURE FAIL 3a: B''s "no" against C did not move to A (% rows)', v_n; end if;
  select count(*) into v_n from public.child_match_rejections where v_b in (child_a_id, child_b_id);
  if v_n <> 0 then raise exception 'S3 FIXTURE FAIL 3b: the absorbed child still has % "no" rows', v_n; end if;
  v_ok := v_ok + 1;

  -- 4. Deleting a child removes its "no"s (cascade) — nothing points at a child that is gone.
  delete from public.org_children where id = v_c;
  select count(*) into v_n from public.child_match_rejections where v_c in (child_a_id, child_b_id);
  if v_n <> 0 then raise exception 'S3 FIXTURE FAIL 4: % rows outlived the child', v_n; end if;
  v_ok := v_ok + 1;

  raise exception 'S3 FIXTURE OK: %/4', v_ok;
end $$;
