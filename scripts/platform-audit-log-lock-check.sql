-- DEV only. Plans & pricing Stage 0 O11 (mig 429): the platform change log cannot be edited or deleted. Every UPDATE is
-- refused except org_id going to NULL when its club is deleted; DELETE and TRUNCATE are refused.
-- Run: node scripts/db-query.mjs --dev -f scripts/platform-audit-log-lock-check.sql
-- The final exception rolls back every change (the throwaway club and the test lines included); the run passes only
-- when it ends in PLATFORM_AUDIT_LOG_LOCK_PASSED. Never points at a real club: T4 makes its own.
DO $pal$
DECLARE
  v_tag text := 'o11_lock_check_' || substr(md5(random()::text), 1, 10);
  v_id uuid;
  v_org uuid;
  v_org2 uuid;
  v_club_line uuid;
  v_before jsonb;
  v_after jsonb;
  v_refused boolean;
  v_msg text;
BEGIN
  -- T1 · An INSERT still works.
  INSERT INTO platform_audit_log (actor_email, action, field, old_value, new_value, reason)
  VALUES ('o11-check@example.test', v_tag, 'note', '{"a":1}', '{"a":2}', 'the first reason')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL T1: an insert wrote nothing'; END IF;

  -- T2 · Editing any column of a line is refused with the lock's error.
  -- (One block per column: a refused statement inside a sub-block rolls back only that sub-block.)
  BEGIN UPDATE platform_audit_log SET reason = 'a rewritten reason' WHERE id = v_id; v_refused := false;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; v_msg := SQLERRM; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2a: a reason edit was not refused by the lock (%)', v_msg; END IF;

  v_refused := false;
  BEGIN UPDATE platform_audit_log SET new_value = '{"a":3}' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2b: a new_value edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE platform_audit_log SET actor_email = 'someone-else@example.test' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2c: an actor_email edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE platform_audit_log SET action = v_tag || '_x' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2d: an action edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE platform_audit_log SET created_at = created_at - interval '1 day' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2e: a created_at edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE platform_audit_log SET reason = reason WHERE id = v_id;  -- a no-change update is still an edit
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2f: a no-change update was not refused'; END IF;

  IF (SELECT reason FROM platform_audit_log WHERE id = v_id) <> 'the first reason' THEN
    RAISE EXCEPTION 'FAIL T2g: the line changed';
  END IF;

  -- T3 · Deleting a line is refused.
  v_refused := false;
  BEGIN DELETE FROM platform_audit_log WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be deleted%'; END;
  IF NOT v_refused OR NOT EXISTS (SELECT 1 FROM platform_audit_log WHERE id = v_id) THEN
    RAISE EXCEPTION 'FAIL T3: a delete was not refused';
  END IF;

  -- T4 · The exception: a throwaway club, a line pointing at it, the club deleted. The line survives, org_id NULL,
  -- every other column unchanged.
  INSERT INTO organizations (name, slug) VALUES ('O11 lock check ' || v_tag, replace(v_tag, '_', '-')) RETURNING id INTO v_org;
  INSERT INTO platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
  VALUES ('o11-check@example.test', v_org, v_tag, 'club_note', '{"b":1}', '{"b":2}', 'a club line')
  RETURNING id INTO v_club_line;
  SELECT to_jsonb(l) - 'org_id' INTO v_before FROM platform_audit_log l WHERE id = v_club_line;
  DELETE FROM organizations WHERE id = v_org;
  SELECT to_jsonb(l) INTO v_after FROM platform_audit_log l WHERE id = v_club_line;
  IF v_after IS NULL THEN RAISE EXCEPTION 'FAIL T4: the club line was removed with the club'; END IF;
  IF v_after->>'org_id' IS NOT NULL THEN RAISE EXCEPTION 'FAIL T4b: the club line still points at the club'; END IF;
  IF (v_after - 'org_id') <> v_before THEN RAISE EXCEPTION 'FAIL T4c: the club line changed beyond org_id: %', v_after; END IF;

  -- T5 · Blanking org_id AND changing another column in one go is refused.
  INSERT INTO organizations (name, slug) VALUES ('O11 lock check 2 ' || v_tag, replace(v_tag, '_', '-') || '-2') RETURNING id INTO v_org;
  INSERT INTO platform_audit_log (actor_email, org_id, action, reason)
  VALUES ('o11-check@example.test', v_org, v_tag, 'a second club line') RETURNING id INTO v_club_line;
  v_refused := false;
  BEGIN UPDATE platform_audit_log SET org_id = NULL, reason = 'blanked and rewritten' WHERE id = v_club_line;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T5: blank-and-edit was not refused'; END IF;

  -- T6 · Moving a line to a different club (not NULL) is refused. (The other club is throwaway too.)
  INSERT INTO organizations (name, slug) VALUES ('O11 lock check 3 ' || v_tag, replace(v_tag, '_', '-') || '-3') RETURNING id INTO v_org2;
  v_refused := false;
  BEGIN UPDATE platform_audit_log SET org_id = v_org2 WHERE id = v_club_line;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T6: moving a line to another club was not refused'; END IF;

  -- T6b · A line with no club cannot be given one.
  v_refused := false;
  BEGIN UPDATE platform_audit_log SET org_id = v_org WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T6b: a club-less line was given a club'; END IF;

  -- T7 · TRUNCATE is refused.
  v_refused := false;
  BEGIN TRUNCATE platform_audit_log;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be deleted%'; END;
  IF NOT v_refused OR NOT EXISTS (SELECT 1 FROM platform_audit_log WHERE id = v_id) THEN
    RAISE EXCEPTION 'FAIL T7: a truncate was not refused';
  END IF;

  -- T8 · Neither a signed-in nor an anonymous user holds TRUNCATE.
  IF has_table_privilege('anon', 'public.platform_audit_log', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.platform_audit_log', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL T8: anon or authenticated still holds TRUNCATE';
  END IF;

  -- T9 · The refusal is the trigger's, and lifting it on purpose works (the documented erasure path), then it is back.
  ALTER TABLE platform_audit_log DISABLE TRIGGER platform_audit_log_append_only;
  UPDATE platform_audit_log SET reason = 'erased on purpose' WHERE id = v_id;
  ALTER TABLE platform_audit_log ENABLE TRIGGER platform_audit_log_append_only;
  IF (SELECT reason FROM platform_audit_log WHERE id = v_id) <> 'erased on purpose' THEN
    RAISE EXCEPTION 'FAIL T9: the documented lift did not let the change through';
  END IF;
  v_refused := false;
  BEGIN UPDATE platform_audit_log SET reason = 'after the lift' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'The platform audit log cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T9b: the lock did not come back after the lift'; END IF;

  RAISE EXCEPTION 'PLATFORM_AUDIT_LOG_LOCK_PASSED';
END
$pal$;
