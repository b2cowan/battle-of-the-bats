-- family-invitation-fixture.sql — Signed-in family accounts Stage 4a, Part 1 (mig 453): a connection to the child on every team, the
-- invitation record, and the stop that ends only a second-parent connection.
--
-- DEV ONLY. Run:  node .probe/s2-child/q.mjs --file tests/sql/family-invitation-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'S4A FIXTURE OK: n/n' on success, 'S4A FIXTURE FAIL …' at the first broken rule. Either way the
-- raise rolls back every row it wrote.
--
--   1. a house-league link (no team, no entry) is valid as first_parent; a link with no entry cannot default to rep_coach;
--   2. one live link per child per address, whatever the team (a second team's link for the same address is refused);
--   3. two live guardians per CHILD: a third on another team is refused;
--   4. family_invitation_issue re-issues: the old one is replaced, one stays open;
--   5. guardian_email_2 = a stopped address is refused (insert and update);
--   6. an invitation to a stopped address is refused, unless the address is a first parent on a sign-up of the org (O2);
--   7. a rep coach's invitation to an address that said "don't send me invitations" is refused; a placement one is not;
--   8. the stop cancels the open placement invitation of a second-parent-only address and ends its second_parent link;
--   9. the stop never ends a first_parent link, and keeps the invitation of an address that is a first parent in the club (flag d, O2);
--  10. a join moves a rep coach's open invitation to the kept child.
do $fixture$
declare
  v_org uuid; v_season uuid; v_team uuid; v_team2 uuid; y1 uuid; y2 uuid;
  e1 uuid; e2 uuid; r_a uuid; r_b uuid;
  c1 uuid; c2 uuid; ca uuid; cb uuid;
  l_hl uuid; l_first uuid; l_second uuid; l_x uuid;
  i1 uuid; i2 uuid; i_x uuid; i_y uuid; i_rep uuid;
  v_ok int := 0; v_n int; v_s text; v_t timestamptz;
begin
  select o.id into v_org from organizations o
   where exists (select 1 from rep_teams t where t.org_id = o.id)
     and exists (select 1 from league_seasons s where s.org_id = o.id)
   limit 1;
  if v_org is null then raise exception 'S4A FIXTURE FAIL: no organization to build in'; end if;
  select id into v_season from league_seasons where org_id = v_org limit 1;

  insert into rep_teams (org_id, name, slug) values (v_org, 'S4A Fixture A', 's4a-fx-a-' || substr(md5(random()::text), 1, 6)) returning id into v_team;
  insert into rep_teams (org_id, name, slug) values (v_org, 'S4A Fixture B', 's4a-fx-b-' || substr(md5(random()::text), 1, 6)) returning id into v_team2;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team, v_org, '2027 Season', 2027, 'active') returning id into y1;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team2, v_org, '2027 Season', 2027, 'active') returning id into y2;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y1, v_team, v_org, 'Leo', 'Fixture', date '2016-04-01') returning id into e1;
  select child_id into c1 from rep_roster_players where id = e1;
  -- Leo on team B too (same child): a second entry for c1.
  insert into rep_roster_players (program_year_id, team_id, org_id, child_id, player_first_name, player_last_name, player_date_of_birth)
    values (y2, v_team2, v_org, c1, 'Leo', 'Fixture', date '2016-04-01') returning id into e2;

  -- Two house-league sign-ups: Ava (first = yan@, second = xia@) and Maya (first = mo@, second = yan@).
  insert into league_registrations (season_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
                                    guardian_email, guardian_email_2, status)
    values (v_season, v_org, 'Ava', 'S4aFixture', 'Yan', 'Parent', 'yan@s4a.example', 'xia@s4a.example', 'active') returning id, child_id into r_a, ca;
  insert into league_registrations (season_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
                                    guardian_email, guardian_email_2, status)
    values (v_season, v_org, 'Maya', 'S4aFixture', 'Mo', 'Parent', 'mo@s4a.example', 'yan@s4a.example', 'active') returning id, child_id into r_b, cb;

  -- 1. A house-league link: no team, no entry.
  insert into family_links (org_id, role, child_id, invited_email, status, invited_as, verified_via)
    values (v_org, 'guardian', ca, 'yan@s4a.example', 'verified', 'first_parent', 'registration_match') returning id into l_hl;
  begin
    insert into family_links (org_id, role, child_id, invited_email, status) values (v_org, 'guardian', cb, 'mo@s4a.example', 'verified');
    raise exception 'S4A FIXTURE FAIL 1: a link with no entry took the rep_coach default';
  exception when check_violation then
    if sqlerrm not like '%family_links_made_on_entry_ck%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- 2. One live link per child per address, whatever the team.
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', e1, 'grace@s4a.example', 'verified');
  begin
    insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
      values (v_org, v_team2, 'guardian', e2, 'grace@s4a.example', 'verified');
    raise exception 'S4A FIXTURE FAIL 2: the same address on one child on a second team was accepted';
  exception when unique_violation then null;
  end;
  v_ok := v_ok + 1;

  -- 3. Two live guardians per child, across teams.
  insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
    values (v_org, v_team, 'guardian', e1, 'raj@s4a.example', 'invited');
  begin
    insert into family_links (org_id, rep_team_id, role, player_id, invited_email, status)
      values (v_org, v_team2, 'guardian', e2, 'third@s4a.example', 'invited');
    raise exception 'S4A FIXTURE FAIL 3: a third live guardian on another team was accepted';
  exception when check_violation then
    if sqlerrm not like 'guardian_cap_reached%' then raise; end if;
  end;
  -- An update to a row already live on the child is not re-counted.
  update family_links set relationship = 'Parent' where child_id = c1 and invited_email = 'raj@s4a.example';
  v_ok := v_ok + 1;

  -- 4. Re-issue replaces.
  i1 := public.family_invitation_issue(v_org, 'Mo@S4a.example ', 'placement', null, null, null, 'hash-s4a-1', 30);
  i2 := public.family_invitation_issue(v_org, 'mo@s4a.example', 'placement', null, null, null, 'hash-s4a-2', 30);
  if (select replaced_by from family_invitations where id = i1) is distinct from i2 then
    raise exception 'S4A FIXTURE FAIL 4a: the first invitation was not replaced by the second';
  end if;
  select count(*) into v_n from family_invitations
   where org_id = v_org and email = 'mo@s4a.example' and used_at is null and cancelled_at is null and replaced_by is null;
  if v_n <> 1 then raise exception 'S4A FIXTURE FAIL 4b: expected 1 open invitation, found %', v_n; end if;
  select expires_at into v_t from family_invitations where id = i2;
  if v_t < now() + interval '29 days' or v_t > now() + interval '31 days' then raise exception 'S4A FIXTURE FAIL 4c: not 30 days (%)', v_t; end if;
  v_ok := v_ok + 1;

  -- Before any stop: xia@ (second parent only) is invited and has joined as a second parent of Ava; yan@ (first on Ava, second on
  -- Maya) is invited and holds both a first_parent (Ava, above) and a second_parent (Maya) link.
  i_x := public.family_invitation_issue(v_org, 'xia@s4a.example', 'placement', null, null, null, 'hash-s4a-x', 30);
  i_y := public.family_invitation_issue(v_org, 'yan@s4a.example', 'placement', null, null, null, 'hash-s4a-y', 30);
  insert into family_links (org_id, role, child_id, invited_email, status, invited_as, verified_via)
    values (v_org, 'guardian', ca, 'xia@s4a.example', 'verified', 'second_parent', 'registration_match') returning id into l_x;
  insert into family_links (org_id, role, child_id, invited_email, status, invited_as, verified_via)
    values (v_org, 'guardian', cb, 'yan@s4a.example', 'verified', 'second_parent', 'registration_match') returning id into l_second;

  -- 8 + 9. The stops.
  perform public.second_parent_stop(v_org, 'xia@s4a.example', 'fixture');
  perform public.second_parent_stop(v_org, 'YAN@s4a.example', 'fixture');

  if (select cancelled_at from family_invitations where id = i_x) is null then
    raise exception 'S4A FIXTURE FAIL 8a: the second-parent-only address kept its open invitation';
  end if;
  select status || '/' || coalesce(ended_by, '-') into v_s from family_links where id = l_x;
  if v_s <> 'revoked/stop' then raise exception 'S4A FIXTURE FAIL 8b: the second_parent link should be revoked/stop, it is %', v_s; end if;
  if (select guardian_email_2 from league_registrations where id = r_a) is not null then
    raise exception 'S4A FIXTURE FAIL 8c: the stop did not clear the sign-up';
  end if;
  v_ok := v_ok + 1;

  select status into v_s from family_links where id = l_hl;
  if v_s <> 'verified' then raise exception 'S4A FIXTURE FAIL 9a: the stop ended a first_parent link (%)', v_s; end if;
  select status || '/' || coalesce(ended_by, '-') into v_s from family_links where id = l_second;
  if v_s <> 'revoked/stop' then raise exception 'S4A FIXTURE FAIL 9b: yan@''s second_parent link should end, it is %', v_s; end if;
  if (select cancelled_at from family_invitations where id = i_y) is not null then
    raise exception 'S4A FIXTURE FAIL 9c: a first parent''s own invitation was cancelled by the stop (O2)';
  end if;
  v_ok := v_ok + 1;

  -- 5. guardian_email_2 = a stopped address: refused on update and insert.
  begin
    update league_registrations set guardian_email_2 = ' Xia@s4a.example' where id = r_b;
    raise exception 'S4A FIXTURE FAIL 5a: a stopped address went back onto a sign-up';
  exception when check_violation then
    if sqlerrm not like 'second_parent_stopped%' then raise; end if;
  end;
  begin
    insert into league_registrations (season_id, org_id, player_first_name, player_last_name, guardian_first_name, guardian_last_name,
                                      guardian_email, guardian_email_2, status)
      values (v_season, v_org, 'Zed', 'S4aFixture', 'Zed', 'Parent', 'zed@s4a.example', 'xia@s4a.example', 'pending_review');
    raise exception 'S4A FIXTURE FAIL 5b: a new sign-up took a stopped second address';
  exception when check_violation then
    if sqlerrm not like 'second_parent_stopped%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- 6. A new invitation to the stopped second-parent-only address: refused. To yan@ (a first parent here): allowed (re-issue).
  begin
    perform public.family_invitation_issue(v_org, 'xia@s4a.example', 'placement', null, null, null, 'hash-s4a-x2', 30);
    raise exception 'S4A FIXTURE FAIL 6a: an invitation to a stopped address was accepted';
  exception when check_violation then
    if sqlerrm not like 'second_parent_stopped%' then raise; end if;
  end;
  perform public.family_invitation_issue(v_org, 'yan@s4a.example', 'placement', null, null, null, 'hash-s4a-y2', 30);
  v_ok := v_ok + 1;

  -- 7. "Don't send me invitations": a rep coach's is refused, a placement one is not.
  insert into family_invite_stops (org_id, email) values (v_org, 'grace@s4a.example');
  begin
    perform public.family_invitation_issue(v_org, 'grace@s4a.example', 'rep_coach', e1, c1, null, 'hash-s4a-g', 30);
    raise exception 'S4A FIXTURE FAIL 7a: a rep invitation to an invitation-stopped address was accepted';
  exception when check_violation then
    if sqlerrm not like 'family_invite_stopped%' then raise; end if;
  end;
  perform public.family_invitation_issue(v_org, 'grace@s4a.example', 'placement', null, null, null, 'hash-s4a-g2', 30);
  v_ok := v_ok + 1;

  -- 10. A join moves a rep coach's open invitation. A second child record c2 (another entry), invited, joined into c1.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y1, v_team, v_org, 'Leon', 'Fixture2', date '2016-04-01') returning id into e2;
  select child_id into c2 from rep_roster_players where id = e2;
  i_rep := public.family_invitation_issue(v_org, 'uncle@s4a.example', 'rep_coach', e2, c2, null, 'hash-s4a-rep', 30);
  -- (c1 and c2 share team A's 2027 season: the one-child-per-season index refuses that join, so move e2 to team B first.)
  update rep_roster_players set program_year_id = y2, team_id = v_team2 where id = e2;
  delete from rep_roster_players where id = (select id from rep_roster_players where child_id = c1 and team_id = v_team2);
  perform public.org_children_join(c1, c2, true);
  if (select child_id from family_invitations where id = i_rep) is distinct from c1 then
    raise exception 'S4A FIXTURE FAIL 10: the rep invitation did not follow the join';
  end if;
  v_ok := v_ok + 1;

  raise exception 'S4A FIXTURE OK: %/10', v_ok;
end
$fixture$;
