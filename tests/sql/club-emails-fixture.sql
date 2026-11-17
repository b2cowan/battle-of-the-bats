-- club-emails-fixture.sql — Club Communications Stage 1, Session 1 (migs 492–493; plan CLUB_COMMUNICATIONS_PLAN.md; legal
-- CLUB_COMMUNICATIONS_STAGE1.md T18, T19, T24, and the no-allowance rule).
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/club-emails-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'CLUB EMAILS FIXTURE OK: n/n' on success, 'CLUB EMAILS FIXTURE FAIL …' at the first broken
-- rule. Either way the raise rolls back every row it wrote (it borrows an existing dev organization and changes nothing of it).
--
--   1. the claim writes the send, its words AND its people in one step; the same group again within 60 seconds is refused 'just_sent';
--   2. another group is not refused, and there is NO daily allowance (six sends of six groups in a row all go);
--   3. the same group again once the 60 seconds have passed goes;
--   4. a recipient's name or line holding an '@' is refused; a recipient with no source row is refused; a board recipient
--      without a seat (and a coach with one) is refused; the recipients table has no address column;
--   5. reply_to takes only club | sender; club_copy only asked | sent | failed | already_listed; the family log defaults to
--      'sender' (the shipped behaviour);
--   6. THE CLOCK, coach and board email: a send 13 months old loses its words and keeps its people and counts; 25 months old
--      loses its people too; a recent send is untouched; the send rows (sender, date, group, counts) are never deleted;
--   7. THE CLOCK, family email: 13 months blanks subject and body in place; 25 months deletes the family recipients; counts kept;
--   8. a second run sweeps nothing new (each send is swept once).
do $fixture$
declare
  v_org uuid; v_ok int := 0; r jsonb; s1 uuid; s_old uuid; s_older uuid; s_new uuid; f_old uuid; f_older uuid; v_n int;
begin
  select id into v_org from organizations order by created_at limit 1;
  if v_org is null then raise exception 'CLUB EMAILS FIXTURE FAIL 0: no organization on dev'; end if;

  -- 1. the claim, and just-sent
  r := club_group_email_claim(v_org, null, 'coaches', 'coaches_all', 'fixture:coaches_all', 'All coaches', '{}'::jsonb, true, true,
    'Fixture Sender', 'owner', 'club', false, 'Fixture subject', 'Fixture body', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'user_id', gen_random_uuid(), 'name', 'Pat Fixture', 'line', '15U AAA · Head coach', 'basis', 'rep_staff', 'rep', true)), 1);
  if not (r->>'ok')::boolean then raise exception 'CLUB EMAILS FIXTURE FAIL 1: the first claim was refused: %', r; end if;
  s1 := (r->>'sendId')::uuid;
  if not exists (select 1 from club_group_email_bodies where send_id = s1 and subject = 'Fixture subject' and body = 'Fixture body') then
    raise exception 'CLUB EMAILS FIXTURE FAIL 1: the words were not written with the send'; end if;
  if (select recipient_count from club_group_email_sends where id = s1) <> 1 or not exists (select 1 from club_group_email_recipients where send_id = s1 and name = 'Pat Fixture' and status = 'pending') then
    raise exception 'CLUB EMAILS FIXTURE FAIL 1: the people were not written with the send'; end if;
  r := club_group_email_claim(v_org, null, 'coaches', 'coaches_all', 'fixture:coaches_all', 'All coaches', '{}'::jsonb, true, true,
    'Fixture Sender', 'owner', 'club', false, 's', 'b', '[]'::jsonb, 0);
  if (r->>'ok')::boolean or r->>'code' is distinct from 'just_sent' then raise exception 'CLUB EMAILS FIXTURE FAIL 1: a second press was not just_sent: %', r; end if;
  v_ok := v_ok + 1;

  -- 2. another group, and no daily allowance
  for i in 1..6 loop
    r := club_group_email_claim(v_org, null, 'board', 'board_picked', 'fixture:board_picked:' || i, 'The board', '{}'::jsonb, false, false,
      'Fixture Sender', 'treasurer', 'sender', false, 's', 'b', '[]'::jsonb, 0);
    if not (r->>'ok')::boolean then raise exception 'CLUB EMAILS FIXTURE FAIL 2: send % of six groups was refused: %', i, r; end if;
  end loop;
  v_ok := v_ok + 1;

  -- 3. the same group after 60 seconds
  update club_group_email_sends set sent_at = now() - interval '61 seconds' where id = s1;
  r := club_group_email_claim(v_org, null, 'coaches', 'coaches_all', 'fixture:coaches_all', 'All coaches', '{}'::jsonb, true, true,
    'Fixture Sender', 'owner', 'club', false, 's', 'b', '[]'::jsonb, 0);
  if not (r->>'ok')::boolean then raise exception 'CLUB EMAILS FIXTURE FAIL 3: the same group after a minute was refused: %', r; end if;
  v_ok := v_ok + 1;

  -- 4. what a recipient row may hold
  begin
    insert into club_group_email_recipients (send_id, org_id, user_id, name, basis) values (s1, v_org, gen_random_uuid(), 'pat@example.test', 'rep_staff');
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a name holding an @ was stored';
  exception when check_violation then null; end;
  begin
    insert into club_group_email_recipients (send_id, org_id, user_id, line, basis) values (s1, v_org, gen_random_uuid(), 'x@y.test', 'rep_staff');
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a line holding an @ was stored';
  exception when check_violation then null; end;
  begin
    insert into club_group_email_recipients (send_id, org_id, name, basis) values (s1, v_org, 'Nobody', 'rep_staff');
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a recipient with no source row was stored';
  exception when check_violation then null; end;
  begin
    insert into club_group_email_recipients (send_id, org_id, user_id, basis) values (s1, v_org, gen_random_uuid(), 'board');
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a board recipient without a seat was stored';
  exception when check_violation then null; end;
  begin
    insert into club_group_email_recipients (send_id, org_id, user_id, basis, board_role) values (s1, v_org, gen_random_uuid(), 'rep_staff', 'admin');
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a coach with a board seat was stored';
  exception when check_violation then null; end;
  if exists (select 1 from information_schema.columns where table_name in ('club_group_email_sends', 'club_group_email_bodies', 'club_group_email_recipients')
             and (column_name ilike '%email%' or column_name ilike '%address%')) then
    raise exception 'CLUB EMAILS FIXTURE FAIL 4: a log table has an address column'; end if;
  v_ok := v_ok + 1;

  -- 5. the reply mode and the copy
  begin
    update club_group_email_sends set reply_to = 'parent' where id = s1;
    raise exception 'CLUB EMAILS FIXTURE FAIL 5: reply_to took a word outside club|sender';
  exception when check_violation then null; end;
  begin
    update club_group_email_sends set club_copy = 'club@example.test' where id = s1;
    raise exception 'CLUB EMAILS FIXTURE FAIL 5: club_copy took an address';
  exception when check_violation then null; end;
  insert into family_email_sends (org_id, subject, body, audience_kind, audience_label, family_count, reached_count)
    values (v_org, 'Fixture family', 'Fixture family body', 'every', 'Every family', 2, 2) returning id into f_old;
  if (select reply_to from family_email_sends where id = f_old) is distinct from 'sender' then
    raise exception 'CLUB EMAILS FIXTURE FAIL 5: the family log does not default to the sender'; end if;
  v_ok := v_ok + 1;

  -- 6. the clock, coach and board email
  r := club_group_email_claim(v_org, null, 'coaches', 'rep_head', 'fixture:old', 'Rep coaches · head coaches', '{}'::jsonb, true, false,
    'Fixture Sender', 'admin', 'sender', false, 'Old words', 'Old body', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'user_id', gen_random_uuid(), 'name', 'Pat Fixture', 'line', '15U AAA · Head coach', 'basis', 'rep_staff', 'rep', true)), 0);
  s_old := (r->>'sendId')::uuid;
  r := club_group_email_claim(v_org, null, 'board', 'board_all', 'fixture:older', 'The board', '{}'::jsonb, false, false,
    'Fixture Sender', 'admin', 'sender', false, 'Older words', 'Older body', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'user_id', gen_random_uuid(), 'name', 'Avery Fixture', 'line', 'Treasurer', 'basis', 'board', 'board_role', 'treasurer', 'rep', false)), 0);
  s_older := (r->>'sendId')::uuid;
  r := club_group_email_claim(v_org, null, 'coaches', 'rep_staff', 'fixture:new', 'Rep coaches', '{}'::jsonb, true, false,
    'Fixture Sender', 'admin', 'sender', false, 'New words', 'New body', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'user_id', gen_random_uuid(), 'name', 'Pat Fixture', 'line', '15U AAA · Head coach', 'basis', 'rep_staff', 'rep', true)), 0);
  s_new := (r->>'sendId')::uuid;
  -- (each claim wrote its one person with the send, in the same transaction)
  if (select count(*) from club_group_email_recipients where send_id in (s_old, s_older, s_new)) <> 3 then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: the claim did not write its people with the send'; end if;
  update club_group_email_recipients set status = 'sent' where send_id in (s_old, s_older, s_new);
  update club_group_email_sends set reached_count = 1, status = 'done' where id in (s_old, s_older, s_new);
  update club_group_email_sends set sent_at = now() - interval '13 months' where id = s_old;
  update club_group_email_sends set sent_at = now() - interval '25 months' where id = s_older;

  -- 7. the clock, family email
  update family_email_sends set sent_at = now() - interval '13 months' where id = f_old;
  insert into family_email_sends (org_id, subject, body, audience_kind, audience_label, family_count, reached_count, sent_at)
    values (v_org, 'Older family', 'Older family body', 'every', 'Every family', 1, 1, now() - interval '25 months') returning id into f_older;
  insert into family_email_recipients (send_id, org_id, person_ids, family_name, status)
    select f, v_org, array[gen_random_uuid()], 'Fixture', 'sent' from unnest(array[f_old, f_older]) f;

  perform club_email_retention_sweep();

  if exists (select 1 from club_group_email_bodies where send_id = s_old) or (select words_cleared_at from club_group_email_sends where id = s_old) is null then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: a 13-month-old coach email kept its words'; end if;
  if not exists (select 1 from club_group_email_recipients where send_id = s_old) then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: a 13-month-old coach email lost its people (they go at 24 months)'; end if;
  if exists (select 1 from club_group_email_recipients where send_id = s_older) or (select names_cleared_at from club_group_email_sends where id = s_older) is null
     or exists (select 1 from club_group_email_bodies where send_id = s_older) then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: a 25-month-old board email kept its people or its words'; end if;
  if not exists (select 1 from club_group_email_bodies where send_id = s_new) or not exists (select 1 from club_group_email_recipients where send_id = s_new)
     or (select words_cleared_at from club_group_email_sends where id = s_new) is not null then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: a recent email was touched'; end if;
  if (select count(*) from club_group_email_sends where id in (s_old, s_older, s_new) and reached_count = 1 and recipient_count = 1 and sender_name = 'Fixture Sender') <> 3 then
    raise exception 'CLUB EMAILS FIXTURE FAIL 6: a send row, its sender or its counts were lost'; end if;
  v_ok := v_ok + 1;

  if (select subject from family_email_sends where id = f_old) is not null or (select body from family_email_sends where id = f_old) is not null
     or (select words_cleared_at from family_email_sends where id = f_old) is null then
    raise exception 'CLUB EMAILS FIXTURE FAIL 7: a 13-month-old family email kept its words'; end if;
  if not exists (select 1 from family_email_recipients where send_id = f_old) then
    raise exception 'CLUB EMAILS FIXTURE FAIL 7: a 13-month-old family email lost its families (they go at 24 months)'; end if;
  if exists (select 1 from family_email_recipients where send_id = f_older) or (select names_cleared_at from family_email_sends where id = f_older) is null then
    raise exception 'CLUB EMAILS FIXTURE FAIL 7: a 25-month-old family email kept its families'; end if;
  if (select family_count + reached_count from family_email_sends where id = f_older) <> 2 then
    raise exception 'CLUB EMAILS FIXTURE FAIL 7: the family counts were touched'; end if;
  v_ok := v_ok + 1;

  -- 8. idempotent
  -- (the first run swept every due row on dev, inside this transaction, so a second run has nothing at all to do)
  r := club_email_retention_sweep();
  v_n := (r->>'club_words')::int + (r->>'club_names')::int + (r->>'family_words')::int + (r->>'family_names')::int;
  if v_n <> 0 then raise exception 'CLUB EMAILS FIXTURE FAIL 8: a second run swept % sends again: %', v_n, r; end if;
  v_ok := v_ok + 1;

  raise exception 'CLUB EMAILS FIXTURE OK: %/8', v_ok;
end $fixture$;
