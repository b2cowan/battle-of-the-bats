-- child-join-split-fixture.sql — Club Tier Stage 14 S6 (mig 445): joining records, splitting them, and the parent link on the child.
--
-- DEV ONLY. Run:  node .probe/s2-child/q.mjs --file tests/sql/child-join-split-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'S6 FIXTURE OK: n/n' on success, 'S6 FIXTURE FAIL …' at the first broken rule. Either way the
-- raise rolls back every row it wrote.
--
--   1. a link written with only the entry gets the entry's child (a writer that does not know child_id stays valid);
--   2. the same address twice on ONE child on one team is refused; the same address on a SECOND child of that team is allowed;
--   3. a third live guardian for one child on one team is refused (the cap reads the child);
--   4. a roll (a new entry for the same child) leaves the link where it was — the child's, so there is nothing to re-invite;
--   5. a join (keep identity) keeps the kept record's name and birth date, every entry, the absorbed child is gone;
--   6. a join moves the absorbed child's links; a duplicate address on one team survives once, the verified one winning;
--   7. a join that would put a third live guardian on a child is refused and moves nothing;
--   8. a join of two children on one team in one season is refused (the one-child-per-season index);
--   9. a split moves the chosen entries (and the sign-up a roster entry came from) to a NEW child, deletes nothing, stores the
--      pair as a "no" (door 'split'), and leaves the parent links with the kept child;
--  10. a split that moves nothing, everything, or another child's entry is refused;
--  11. join then split is exact: every entry is where it started, with its own data;
--  12. a join into a keeper with NO birth date takes the absorbed record's (a join never loses the only date on file).
do $fixture$
declare
  v_org uuid; v_season uuid;
  v_team uuid; v_team2 uuid;
  y1 uuid; y2 uuid; y3 uuid; y4 uuid;
  e1 uuid; e2 uuid; e3 uuid; f1 uuid; g1 uuid;
  lg uuid; tr uuid; h1 uuid; h2 uuid; ck uuid; cd uuid;
  c1 uuid; c2 uuid; c3 uuid; c_new uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid;
  v_ok int := 0; v_n int; v_s text; v_name text; v_dob date;
begin
  select o.id into v_org from organizations o
   where exists (select 1 from rep_teams t where t.org_id = o.id)
     and exists (select 1 from league_seasons s where s.org_id = o.id)
   limit 1;
  if v_org is null then raise exception 'S6 FIXTURE FAIL: no organization to build in'; end if;
  select id into v_season from league_seasons where org_id = v_org limit 1;

  insert into rep_teams (org_id, name, slug) values (v_org, 'S6 Fixture A', 's6-fx-a-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  insert into rep_teams (org_id, name, slug) values (v_org, 'S6 Fixture B', 's6-fx-b-' || substr(md5(random()::text), 1, 6)) returning id into v_team2;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2026 Season', 2026, 'completed') returning id into y1;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2027 Season', 2027, 'active') returning id into y2;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team2, v_org, '2027 Season', 2027, 'active') returning id into y3;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2028 Season', 2028, 'draft') returning id into y4;

  -- Maya on team A, 2026 (c1). A sibling Owen on team A, 2026 (c2). Maya's namesake on team B, 2027 (c3).
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y1, v_team, v_org, 'Maya', 'Chen', date '2015-03-08') returning id into e1;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y4, v_team, v_org, 'Owen', 'Chen', date '2013-01-02') returning id into f1;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y3, v_team2, v_org, 'Maya', 'Chen', date '2015-03-08') returning id into g1;
  select child_id into c1 from rep_roster_players where id = e1;
  select child_id into c2 from rep_roster_players where id = f1;
  select child_id into c3 from rep_roster_players where id = g1;

  -- 1. A link written with only the entry gets the entry's child.
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', e1, 'grace@example.com', 'verified') returning id into l1;
  select child_id into c_new from family_links where id = l1;
  if c_new is distinct from c1 then raise exception 'S6 FIXTURE FAIL 1: the link did not take the entry''s child'; end if;
  v_ok := v_ok + 1;

  -- 2. The same address twice on one child on one team: refused. The same address on a sibling of that team: allowed.
  begin
    insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
      values (v_org, v_team, 'guardian', e1, 'grace@example.com', 'invited');
    raise exception 'S6 FIXTURE FAIL 2a: the same address twice on one child was accepted';
  exception when unique_violation then null;
  end;
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', f1, 'grace@example.com', 'verified') returning id into l2;
  v_ok := v_ok + 1;

  -- 3. A third live guardian for one child on one team is refused.
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', e1, 'raj@example.com', 'invited');
  begin
    insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
      values (v_org, v_team, 'guardian', e1, 'third@example.com', 'invited');
    raise exception 'S6 FIXTURE FAIL 3: a third live guardian was accepted';
  exception when check_violation then
    if sqlerrm not like 'guardian_cap_reached%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- 4. A roll: the same child gets a 2027 entry; the link is still the child's.
  insert into rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name, player_date_of_birth)
    values (y2, v_team, v_org, c1, 'Maya', 'Chen', date '2015-03-08') returning id into e2;
  select count(*) into v_n from family_links where child_id = c1 and status not in ('declined', 'revoked');
  if v_n <> 2 then raise exception 'S6 FIXTURE FAIL 4: expected the child''s 2 links after a roll, found %', v_n; end if;
  v_ok := v_ok + 1;

  -- 5 + 6. Join c3 (team B's Maya) into c1, keeping c1's identity. Give c3 a link for grace@ on team A?  It is on team B, so
  -- no duplicate; add one on team A for c3 via an entry-less child link to exercise the duplicate rule: make a link for c3 on
  -- team A with raj@ (a duplicate of c1's raj@ invite) and one for grace@ on team B (a new team for c1, so it just moves).
  insert into family_links (org_id, rep_team_id, role, player_id, child_id, invited_email, status)
    values (v_org, v_team, 'guardian', g1, c3, 'raj@example.com', 'verified') returning id into l3;       -- duplicate of c1's invited raj@
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team2, 'guardian', g1, 'grace@example.com', 'verified') returning id into l4;       -- c3's own, on team B
  -- c1 has grace@ (verified) + raj@ (invited) on team A; c3 has raj@ (verified) on team A + grace@ on team B → after the
  -- join c1 would hold 2 on A (grace, raj) + 1 on B: within the cap on each team.
  update rep_roster_players set player_first_name = 'Maia' where id = g1;  -- c3's copy of the name differs; c1 is kept
  perform public.org_children_join(c1, c3, true);
  select first_name, date_of_birth into v_name, v_dob from org_children where id = c1;
  if v_name <> 'Maya' or v_dob <> date '2015-03-08' then raise exception 'S6 FIXTURE FAIL 5a: the kept record lost its identity (% %)', v_name, v_dob; end if;
  if exists (select 1 from org_children where id = c3) then raise exception 'S6 FIXTURE FAIL 5b: the absorbed child is still there'; end if;
  select count(*) into v_n from rep_roster_players where child_id = c1;
  if v_n <> 3 then raise exception 'S6 FIXTURE FAIL 5c: the kept child should hold its 3 entries, holds %', v_n; end if;
  v_ok := v_ok + 1;

  select status into v_s from family_links where id = l3;
  if v_s <> 'verified' then raise exception 'S6 FIXTURE FAIL 6a: the verified duplicate should win, but it is %', v_s; end if;
  select status into v_s from family_links where child_id = c1 and invited_email = 'raj@example.com' and rep_team_id = v_team and id <> l3 limit 1;
  if v_s <> 'revoked' then raise exception 'S6 FIXTURE FAIL 6b: the less connected duplicate should be ended, it is %', v_s; end if;
  select count(*) into v_n from family_links where child_id = c1;
  if v_n <> 4 then raise exception 'S6 FIXTURE FAIL 6c: every link should be the kept child''s (4), found %', v_n; end if;
  v_ok := v_ok + 1;

  -- 7. A join that would give a child a third live guardian is refused and moves nothing.
  --    c1 now holds grace + raj live on team A (cap reached). c2 (Owen) has grace@ live on team A: joining c2 into c1 would
  --    collide on grace@ (ended, not counted) → 2 live; so add another address to c2 to force three.
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', f1, 'uncle@example.com', 'invited');
  begin
    perform public.org_children_join(c1, c2, true);
    raise exception 'S6 FIXTURE FAIL 7: a join past the cap was accepted';
  exception when check_violation then
    if sqlerrm not like 'guardian_cap_reached%' then raise; end if;
  end;
  select count(*) into v_n from rep_roster_players where child_id = c2;
  if v_n <> 1 then raise exception 'S6 FIXTURE FAIL 7b: the refused join moved an entry'; end if;
  v_ok := v_ok + 1;

  -- 8. Two children on one team in one season cannot be joined.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y2, v_team, v_org, 'Maya', 'Chen', date '2015-03-08') returning id into e3;
  select child_id into c3 from rep_roster_players where id = e3;
  begin
    perform public.org_children_join(c1, c3, true);
    raise exception 'S6 FIXTURE FAIL 8: two entries of one team and season were joined';
  exception when unique_violation then
    if sqlerrm not like '%rep_roster_players_one_child_per_season%' then raise; end if;
  end;
  delete from rep_roster_players where id = e3;
  delete from org_children where id = c3;
  v_ok := v_ok + 1;

  -- 9. Split: a house-league sign-up and the 2026 roster entry leave c1 for a new child.
  insert into league_registrations (org_id, season_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email, child_id)
    values (v_org, v_season, 'Maya', 'Chen', 'Grace', 'Chen', 'grace@example.com', c1) returning id into lg;
  c_new := public.org_children_split(c1, array[e1], array[lg], null);
  if c_new is null or c_new = c1 then raise exception 'S6 FIXTURE FAIL 9a: no new child'; end if;
  if (select child_id from rep_roster_players where id = e1) <> c_new or (select child_id from league_registrations where id = lg) <> c_new then
    raise exception 'S6 FIXTURE FAIL 9b: the chosen entries did not move'; end if;
  if (select child_id from rep_roster_players where id = e2) <> c1 then raise exception 'S6 FIXTURE FAIL 9c: an entry that was not chosen moved'; end if;
  select count(*) into v_n from rep_roster_players where id in (e1, e2, g1) and org_id = v_org;
  if v_n <> 3 then raise exception 'S6 FIXTURE FAIL 9d: a split deleted an entry'; end if;
  select count(*) into v_n from child_match_rejections where least(c1, c_new) = child_a_id and greatest(c1, c_new) = child_b_id and door = 'split';
  if v_n <> 1 then raise exception 'S6 FIXTURE FAIL 9e: the split did not store the pair as a no'; end if;
  select count(*) into v_n from family_links where child_id = c_new;
  if v_n <> 0 then raise exception 'S6 FIXTURE FAIL 9f: a parent link followed the split instead of staying with the kept child'; end if;
  v_ok := v_ok + 1;

  -- 10. Nothing / everything / another child's entry are refused.
  begin
    perform public.org_children_split(c1, array[]::uuid[], array[]::uuid[], null);
    raise exception 'S6 FIXTURE FAIL 10a: an empty split was accepted';
  exception when check_violation then null; end;
  begin
    perform public.org_children_split(c_new, array[e1], array[lg], null);
    raise exception 'S6 FIXTURE FAIL 10b: a split of every season was accepted';
  exception when check_violation then null; end;
  begin
    perform public.org_children_split(c1, array[f1], array[]::uuid[], null);
    raise exception 'S6 FIXTURE FAIL 10c: another child''s entry was moved';
  exception when check_violation then null; end;
  v_ok := v_ok + 1;

  -- 11. Join the split child back, split the same entries out again: every entry is where it started.
  perform public.org_children_join(c1, c_new, true);
  select count(*) into v_n from rep_roster_players where child_id = c1;
  if v_n <> 3 then raise exception 'S6 FIXTURE FAIL 11a: the join did not bring both back (% entries)', v_n; end if;
  c_new := public.org_children_split(c1, array[e1], array[lg], null);
  if (select child_id from rep_roster_players where id = e1) <> c_new or (select child_id from rep_roster_players where id = e2) <> c1
     or (select child_id from league_registrations where id = lg) <> c_new then
    raise exception 'S6 FIXTURE FAIL 11b: the round trip left an entry elsewhere'; end if;
  v_ok := v_ok + 1;

  -- 12. The keeper has no birth date, the absorbed record has one: after the join the child has it.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name)
    values (y4, v_team, v_org, 'Zed', 'Park') returning id into h1;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y3, v_team2, v_org, 'Zed', 'Park', date '2014-06-01') returning id into h2;
  select child_id into ck from rep_roster_players where id = h1;
  select child_id into cd from rep_roster_players where id = h2;
  if ck = cd then raise exception 'S6 FIXTURE FAIL 12a: the two Zeds were already one child'; end if;
  perform public.org_children_join(ck, cd, true);
  select date_of_birth into v_dob from org_children where id = ck;
  if v_dob is distinct from date '2014-06-01' then raise exception 'S6 FIXTURE FAIL 12b: the join lost the only birth date on file (%)', v_dob; end if;
  v_ok := v_ok + 1;

  raise exception 'S6 FIXTURE OK: %/12', v_ok;
end
$fixture$;
