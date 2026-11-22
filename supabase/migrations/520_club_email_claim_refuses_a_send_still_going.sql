-- 520 · Club Communications Stage 1 /review follow-up: the claim also refuses a group whose send is still going.
--
-- Mig 492's just-sent check looks only at sent_at within 60 seconds. A send to a large group can run longer than that, and a
-- second press after the 60 seconds (another seat, or the same one) would send the same group again while the first is still
-- being delivered. The same 15-minute rule that reads a send as "stopped" (lib/club-group-email-read.ts STOPPED_AFTER_MS)
-- now also holds the group: a row still 'sending' whose last touch (sent_at, or retried_at when "send to the ones it missed"
-- took it) is under 15 minutes old refuses the claim with the same 'just_sent' code. Once the row is 'done', deleted (nobody
-- reached) or older than 15 minutes (stopped), the group is free again.
--
-- Same signature, security settings and grants as mig 492; the only change is the second check inside the advisory lock.
-- Safe to re-run (CREATE OR REPLACE; the grants are re-asserted).

CREATE OR REPLACE FUNCTION public.club_group_email_claim(
  p_org uuid, p_actor uuid, p_kind text, p_group_kind text, p_group_key text, p_label text, p_params jsonb,
  p_reaches_rep boolean, p_reaches_house_league boolean, p_sender_name text, p_sender_role text, p_reply_to text,
  p_club_copy boolean, p_subject text, p_body text, p_recipients jsonb, p_left_out_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_last timestamptz;
  v_id   uuid;
BEGIN
  -- One press at a time per club and kind: two presses on the same group serialize here.
  PERFORM pg_advisory_xact_lock(hashtextextended('club_group_email:' || p_org::text || ':' || p_kind, 0));
  -- Just sent: the same group within the family send's 60 seconds. No daily allowance (coach ask 12, legal §2a.10).
  SELECT max(sent_at) INTO v_last FROM club_group_email_sends
   WHERE org_id = p_org AND kind = p_kind AND group_key = p_group_key;
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;
  -- Still going: a send of the same group that is 'sending' and was last touched under 15 minutes ago (the same rule that
  -- reads a send as stopped after 15 minutes).
  IF EXISTS (
    SELECT 1 FROM club_group_email_sends
     WHERE org_id = p_org AND kind = p_kind AND group_key = p_group_key AND status = 'sending'
       AND greatest(sent_at, coalesce(retried_at, sent_at)) > now() - interval '15 minutes'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;
  INSERT INTO club_group_email_sends (org_id, kind, group_kind, group_key, group_label, group_params, reaches_rep,
    reaches_house_league, sent_by, sender_name, sender_role, reply_to, club_copy, recipient_count, left_out_count)
  VALUES (p_org, p_kind, p_group_kind, p_group_key, p_label, coalesce(p_params, '{}'::jsonb), p_reaches_rep,
    p_reaches_house_league, p_actor, p_sender_name, p_sender_role, p_reply_to, CASE WHEN p_club_copy THEN 'asked' END,
    jsonb_array_length(coalesce(p_recipients, '[]'::jsonb)), p_left_out_count)
  RETURNING id INTO v_id;
  INSERT INTO club_group_email_bodies (send_id, org_id, subject, body) VALUES (v_id, p_org, p_subject, p_body);
  -- Who it goes to, recorded with the send (a stopped send reads whom it missed from these). Never an address: the
  -- recordset names only the columns the table has, and the table has no address column.
  INSERT INTO club_group_email_recipients (id, send_id, org_id, user_id, league_coach_id, name, line, basis, board_role, rep, house_league)
  SELECT r.id, v_id, p_org, r.user_id, r.league_coach_id, r.name, r.line, r.basis, r.board_role, coalesce(r.rep, false), coalesce(r.house_league, false)
    FROM jsonb_to_recordset(coalesce(p_recipients, '[]'::jsonb))
      AS r(id uuid, user_id uuid, league_coach_id uuid, name text, line text, basis text, board_role text, rep boolean, house_league boolean);
  RETURN jsonb_build_object('ok', true, 'sendId', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, jsonb, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, jsonb, integer) TO service_role;

-- Verify (dev):
--   SELECT pg_get_functiondef('public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, jsonb, integer)'::regprocedure) LIKE '%15 minutes%'; -- t
