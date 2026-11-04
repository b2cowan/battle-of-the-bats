-- org-children-fixture.sql — Club Tier Stage 14 S2 (mig 435): the child record's rules, on a throwaway fixture.
--
-- DEV ONLY. Run:  node .probe/s2-child/q.mjs --file tests/sql/org-children-fixture.sql
-- (or paste into the dev SQL editor). The whole test is ONE DO block that ENDS BY RAISING: 'FIXTURE_OK …' on success,
-- 'FIXTURE_FAIL: …' at the first broken rule. Either way the raise rolls back every row it wrote — it leaves nothing.
--
-- What it proves (the build prompt's S2 fixture list, plus the rules S2 added):
--   1. a three-season chain joined by confirmed links is ONE child, and keeps the oldest entry's record;
--   2. the roll (an entry inserted with the old entry's child, then its confirmed link) mints NO child — "a roll never
--      invents a duplicate for a child already on the new season" (the plan's build gate);
--   3. the same name and birth date on another team stays a DIFFERENT child;
--   4. twins: a suggested (even high-confidence) link joins nothing;
--   5. a house-league child signed up two seasons running is two children;
--   6. an accepted tryout takes its sign-up's child, which a confirmed returning-player link already joined to last season;
--   7. a call-up is its own child;
--   8. a live entry's name edit writes through; a closed season's does not;
--   9. an entry cannot point at another organization's child;
--  10. undoing a confirmed link splits the chain at that link, and the remaining link keeps its side together;
--  11. rep_child_components (the backfill's rule) groups the team the same way the triggers left it.
do $fixture$
declare
  v_org uuid;
  v_other_org uuid;
  v_team_a uuid; v_team_b uuid;
  y1 uuid; y2 uuid; y3 uuid; y4 uuid; yb uuid;
  s1 uuid; s2 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; b1 uuid; cu uuid; ava uuid; mia uuid; mia_prev uuid; noah uuid; noah_new uuid;
  r_noah uuid; l1 uuid; l2 uuid; link_32 uuid;
  c_a1 uuid; c_stray uuid; n_before int; n_after int; v_name text; v_err text;
  dob constant date := date '2014-05-02';
  procedure_ok boolean;
begin
  select o.id into v_org from organizations o
   where exists (select 1 from rep_teams t where t.org_id = o.id)
     and exists (select 1 from league_seasons s where s.org_id = o.id)
   limit 1;
  select o.id into v_other_org from organizations o where o.id <> v_org limit 1;
  if v_org is null or v_other_org is null then raise exception 'FIXTURE_FAIL: no organization to build in'; end if;

  insert into rep_teams (org_id, name, slug) values (v_org, 'S2 Fixture A', 's2-fixture-a-' || substr(md5(random()::text), 1, 6)) returning id into v_team_a;
  insert into rep_teams (org_id, name, slug) values (v_org, 'S2 Fixture B', 's2-fixture-b-' || substr(md5(random()::text), 1, 6)) returning id into v_team_b;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team_a, v_org, '2023 Season', 2023, 'completed') returning id into y1;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team_a, v_org, '2024 Season', 2024, 'completed') returning id into y2;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team_a, v_org, '2025 Season', 2025, 'completed') returning id into y3;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team_a, v_org, '2026 Season', 2026, 'active') returning id into y4;
  insert into rep_program_years (team_id, org_id, name, year, status) values (v_team_b, v_org, '2025 Season', 2025, 'active') returning id into yb;

  -- 1. The chain: three seasons, three entries, each its own child until a coach confirms.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y1, v_team_a, v_org, 'Jonah', 'Ruiz', dob) returning id into a1;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y2, v_team_a, v_org, 'Jonah', 'Ruiz', dob) returning id into a2;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y3, v_team_a, v_org, 'Jonah', 'Ruiz', dob) returning id into a3;
  select child_id into c_a1 from rep_roster_players where id = a1;
  if (select count(distinct child_id) from rep_roster_players where id in (a1, a2, a3)) <> 3 then
    raise exception 'FIXTURE_FAIL: 1 — three new entries did not start three children (a match was inferred)';
  end if;
  insert into rep_player_continuity_links (org_id, team_id, current_roster_id, prior_roster_id, status, confidence)
    values (v_org, v_team_a, a2, a1, 'confirmed', 'high');
  insert into rep_player_continuity_links (org_id, team_id, current_roster_id, prior_roster_id, status, confidence)
    values (v_org, v_team_a, a3, a2, 'confirmed', 'high') returning id into link_32;
  if (select count(distinct child_id) from rep_roster_players where id in (a1, a2, a3)) <> 1
     or (select child_id from rep_roster_players where id = a3) <> c_a1 then
    raise exception 'FIXTURE_FAIL: 1 — a confirmed three-season chain is not one child holding the oldest record';
  end if;
  if (select count(*) from org_children c where c.org_id = v_org
        and not exists (select 1 from rep_roster_players p where p.child_id = c.id)
        and not exists (select 1 from rep_tryout_registrations t where t.child_id = c.id)
        and not exists (select 1 from league_registrations l where l.child_id = c.id)) <> 0 then
    raise exception 'FIXTURE_FAIL: 1 — a join left an emptied child record behind';
  end if;

  -- 2. The roll: the new entry carries the old entry's child, then the roll's confirmed link. No child is minted.
  select count(*) into n_before from org_children where org_id = v_org;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth, child_id)
    values (y4, v_team_a, v_org, 'Jonah', 'Ruiz', dob, c_a1) returning id into a4;
  insert into rep_player_continuity_links (org_id, team_id, current_roster_id, prior_roster_id, status, confidence)
    values (v_org, v_team_a, a4, a3, 'confirmed', 'high');
  select count(*) into n_after from org_children where org_id = v_org;
  if n_after <> n_before or (select child_id from rep_roster_players where id = a4) <> c_a1 then
    raise exception 'FIXTURE_FAIL: 2 — the roll invented a child (% before, % after)', n_before, n_after;
  end if;

  -- 3. Same name and birth date on another team: a different child.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (yb, v_team_b, v_org, 'Jonah', 'Ruiz', dob) returning id into b1;
  if (select child_id from rep_roster_players where id = b1) = c_a1 then
    raise exception 'FIXTURE_FAIL: 3 — a same-name child on another team was joined by inference';
  end if;

  -- 4. Twins: same birth date, same family, a HIGH suggested link — nothing joins until a person says yes.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth, guardian_email)
    values (y3, v_team_a, v_org, 'Ava', 'Lee', dob, 'lee.family@example.test') returning id into ava;
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth, guardian_email)
    values (y4, v_team_a, v_org, 'Mia', 'Lee', dob, 'lee.family@example.test') returning id into mia;
  insert into rep_player_continuity_links (org_id, team_id, current_roster_id, prior_roster_id, status, confidence)
    values (v_org, v_team_a, mia, ava, 'suggested', 'high');
  if (select child_id from rep_roster_players where id = mia) = (select child_id from rep_roster_players where id = ava) then
    raise exception 'FIXTURE_FAIL: 4 — a suggested link joined twins';
  end if;

  -- 5. A house-league repeat: two seasons, two sign-ups, two children.
  insert into league_seasons (org_id, name, slug) values (v_org, 'S2 Fixture Spring', 's2-fx-1-' || substr(md5(random()::text), 1, 6)) returning id into s1;
  insert into league_seasons (org_id, name, slug) values (v_org, 'S2 Fixture Summer', 's2-fx-2-' || substr(md5(random()::text), 1, 6)) returning id into s2;
  insert into league_registrations (season_id, org_id, player_first_name, player_last_name, player_date_of_birth, guardian_first_name, guardian_last_name, guardian_email)
    values (s1, v_org, 'Jonah', 'Ruiz', dob, 'Ana', 'Ruiz', 'ruiz@example.test') returning id into l1;
  insert into league_registrations (season_id, org_id, player_first_name, player_last_name, player_date_of_birth, guardian_first_name, guardian_last_name, guardian_email)
    values (s2, v_org, 'Jonah', 'Ruiz', dob, 'Ana', 'Ruiz', 'ruiz@example.test') returning id into l2;
  if (select count(distinct child_id) from league_registrations where id in (l1, l2)) <> 2
     or exists (select 1 from league_registrations where id in (l1, l2) and child_id = c_a1) then
    raise exception 'FIXTURE_FAIL: 5 — a house-league repeat (or the rep child) was joined by inference';
  end if;

  -- 6. Accept: a returning player's tryout sign-up, confirmed by the head coach, then accepted onto the roster.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth)
    values (y3, v_team_a, v_org, 'Noah', 'Park', dob) returning id into noah;
  insert into rep_tryout_registrations (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth, guardian_first_name, guardian_last_name, guardian_email)
    values (y4, v_team_a, v_org, 'Noah', 'Park', dob, 'Sam', 'Park', 'park@example.test') returning id into r_noah;
  if (select child_id from rep_tryout_registrations where id = r_noah) = (select child_id from rep_roster_players where id = noah) then
    raise exception 'FIXTURE_FAIL: 6 — a tryout sign-up was matched to a past player by inference';
  end if;
  insert into rep_player_continuity_links (org_id, team_id, current_registration_id, prior_roster_id, status, confidence)
    values (v_org, v_team_a, r_noah, noah, 'suggested', 'high');
  update rep_player_continuity_links set status = 'confirmed' where current_registration_id = r_noah;
  insert into rep_roster_players (program_year_id, team_id, org_id, source, tryout_registration_id, player_first_name, player_last_name, player_date_of_birth)
    values (y4, v_team_a, v_org, 'tryout', r_noah, 'Noah', 'Park', dob) returning id into noah_new;
  if (select child_id from rep_roster_players where id = noah_new) <> (select child_id from rep_roster_players where id = noah) then
    raise exception 'FIXTURE_FAIL: 6 — the accepted entry did not arrive as last season''s child';
  end if;

  -- 7. A call-up is its own child.
  insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, player_last_name, player_date_of_birth, status)
    values (yb, v_team_b, v_org, 'Jonah', 'Ruiz', dob, 'callup') returning id into cu;
  if (select child_id from rep_roster_players where id = cu) in (c_a1, (select child_id from rep_roster_players where id = b1)) then
    raise exception 'FIXTURE_FAIL: 7 — a call-up shared a child';
  end if;

  -- 8. Write-through: the live (2026, active) entry's fix reaches the child; the closed 2023 entry's does not.
  update rep_roster_players set player_first_name = 'Jonas' where id = a4;
  select first_name into v_name from org_children where id = c_a1;
  if v_name <> 'Jonas' then raise exception 'FIXTURE_FAIL: 8 — a live entry''s name fix did not reach the child (%)', v_name; end if;
  update rep_roster_players set player_first_name = 'Johnny' where id = a1;
  select first_name into v_name from org_children where id = c_a1;
  if v_name <> 'Jonas' then raise exception 'FIXTURE_FAIL: 8 — a closed season''s entry rewrote the child (%)', v_name; end if;

  -- 9. Another organization's child is refused.
  insert into org_children (org_id, first_name) values (v_other_org, 'Stray') returning id into c_stray;
  procedure_ok := false;
  begin
    insert into rep_roster_players (program_year_id, team_id, org_id, player_first_name, child_id)
      values (y4, v_team_a, v_org, 'Stray', c_stray);
  exception when sqlstate '23514' then procedure_ok := true;
  end;
  if not procedure_ok then raise exception 'FIXTURE_FAIL: 9 — an entry took another organization''s child'; end if;

  -- 10. Undo the 2025←2024 link: 2023+2024 keep the record; 2025+2026 (still linked to each other) become one new child.
  update rep_player_continuity_links set status = 'rejected' where id = link_32;
  if (select child_id from rep_roster_players where id = a1) <> c_a1 or (select child_id from rep_roster_players where id = a2) <> c_a1 then
    raise exception 'FIXTURE_FAIL: 10 — the undo moved the older side off its record';
  end if;
  if (select child_id from rep_roster_players where id = a3) = c_a1
     or (select child_id from rep_roster_players where id = a3) <> (select child_id from rep_roster_players where id = a4) then
    raise exception 'FIXTURE_FAIL: 10 — the undo did not split at the link, or split the remaining link too';
  end if;
  select first_name into v_name from org_children where id = (select child_id from rep_roster_players where id = a3);
  if v_name <> 'Jonas' then raise exception 'FIXTURE_FAIL: 10 — the split child is not named from its newest entry (%)', v_name; end if;

  -- 11. The backfill's rule groups the team exactly as the triggers left it.
  if exists (
    select 1 from rep_child_components(v_team_a, null) x join rep_child_components(v_team_a, null) y on x.root = y.root
      join lateral (select coalesce((select child_id from rep_roster_players where id = x.entry_id), (select child_id from rep_tryout_registrations where id = x.entry_id)) cx) px on true
      join lateral (select coalesce((select child_id from rep_roster_players where id = y.entry_id), (select child_id from rep_tryout_registrations where id = y.entry_id)) cy) py on true
     where px.cx <> py.cy
  ) or exists (
    select 1 from rep_child_components(v_team_a, null) x join rep_child_components(v_team_a, null) y on x.root <> y.root
      join lateral (select coalesce((select child_id from rep_roster_players where id = x.entry_id), (select child_id from rep_tryout_registrations where id = x.entry_id)) cx) px on true
      join lateral (select coalesce((select child_id from rep_roster_players where id = y.entry_id), (select child_id from rep_tryout_registrations where id = y.entry_id)) cy) py on true
     where px.cx = py.cy
  ) then
    raise exception 'FIXTURE_FAIL: 11 — rep_child_components disagrees with the stored children';
  end if;

  raise exception 'FIXTURE_OK: 11 rules held (rolled back; nothing kept)';
end
$fixture$;
