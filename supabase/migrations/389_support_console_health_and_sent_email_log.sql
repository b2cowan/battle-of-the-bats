-- ---------------------------------------------------------------
-- Migration 389 — Support console Stage 5 (Health): the account-email log and what the mail service said, the
-- feedback replies, Status's shared reading, and one read-only health function.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Owner rulings 2026-10-26 (Stage 5 drawings)" and
-- "(Stage 5 build gate)"); build prompt PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_BUILD_PROMPT.md §7 Part 1.
--
-- WHAT CHANGES:
--   1. platform_account_emails: one row per ACCOUNT or tournament-REGISTRATION email we send (Q6, Q8, G1, G2), written
--      BEFORE the email leaves. Recipient, a fixed kind (lib/email-kinds.ts; the console shows its label), club, who
--      asked for it, the mail service's number, the state and its time. ⚠ NEVER the subject, the body or a link
--      (threat T13: subjects carry club and team names, family subjects a child's; a reset link is a key to the
--      account). Its id rides on the email as a tag, which is how the delivery callback finds it. Kept 90 days, pruned
--      on write (no scheduled job).
--   2. platform_account_email_events: the email's timeline, one row per delivery callback that matched a row. The
--      callback's own message number is UNIQUE here, and the row moves forward in the SAME database step
--      (platform_account_email_event), so a number is "handled" only once its change is saved (T9) and a repeat changes
--      nothing. This is the handled-numbers record for matched callbacks, kept as long as the email (90 days, longer
--      than the 7 the drawing asks); a callback matching no row keeps nothing at all, not even its number (T11).
--   3. platform_feedback_replies: a staff reply to a feedback item (Q5). Its id is the reply's own number, made by the
--      window, and the mail service's once-only key (with the attempt). The words never change after the row is
--      written (T22); the state moves draft → sending → sent / failed / unknown, and only failed or unknown go back
--      to sending (a retry).
--   4. platform_status_reading: Status's one shared reading (T6). A claim (platform_status_claim) lets one server read
--      the providers at most once every 30 seconds for all staff together.
--   5. platform_sent_email_searches: one row per Sent emails search, for the daily limit per staff member (T17).
--      ⚠ Never the words typed (A3). Kept 2 days, pruned on write.
--   6. platform_health_counts(): connections in use, sessions stuck for over 5 minutes, and each scheduled job's name,
--      last run, pass or fail and 24-hour counts (T7). Never a job's command (it carries the app's job secret), a run's
--      message, or a session's query, user or address. SECURITY DEFINER (it reads every session and the cron schema),
--      search path pinned, the server only.
--   7. platform_record_opens.record_kind gains 'email': an email opened from Sent emails joins the records-opened trail.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The account-email log ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_account_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL CHECK (kind ~ '^[a-z][a-z_]{1,59}$'),
  recipient_email  text NOT NULL CHECK (recipient_email = lower(recipient_email) AND length(recipient_email) BETWEEN 3 AND 320),
  org_id           uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  asked_by_user_id uuid,
  feedback_id      uuid REFERENCES public.feedback_submissions(id) ON DELETE SET NULL,
  resend_id        text CHECK (resend_id IS NULL OR resend_id ~ '^[A-Za-z0-9-]{8,64}$'),
  state            text NOT NULL DEFAULT 'sent'
                     CHECK (state IN ('sent', 'unconfirmed', 'delayed', 'delivered', 'bounced', 'complained', 'failed', 'not_sent')),
  state_at         timestamptz NOT NULL DEFAULT now(),
  bounce_reason    text CHECK (bounce_reason IS NULL OR bounce_reason IN
                     ('address_does_not_exist', 'mailbox_full', 'refused_by_server', 'suppressed', 'other')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_account_emails_recipient_idx ON public.platform_account_emails (recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_account_emails_created_idx ON public.platform_account_emails (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_account_emails_state_idx ON public.platform_account_emails (state, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_account_emails_feedback_idx ON public.platform_account_emails (feedback_id) WHERE feedback_id IS NOT NULL;

ALTER TABLE public.platform_account_emails ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.platform_account_emails FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_account_emails TO service_role;

COMMENT ON TABLE public.platform_account_emails IS
  'Support console Stage 5 (owner Q6/Q8/G1/G2 2026-10-26): one row per account or tournament-registration email we sent, written before it leaves. Never the subject, body or a link. Its id is the email''s flhq_row tag, which the delivery callback matches. Kept 90 days, pruned on write. Read by Super admin, Support and Billing (the sent_log power); emails to staff accounts by Super admin only.';
COMMENT ON COLUMN public.platform_account_emails.kind IS 'A key of lib/email-kinds.ts EMAIL_KINDS (account or registration class); the console shows its fixed label, never the subject.';
COMMENT ON COLUMN public.platform_account_emails.recipient_email IS 'The address it went to, lowercased. Matched to an account at read time (an invite often goes to an address with no account).';
COMMENT ON COLUMN public.platform_account_emails.asked_by_user_id IS 'The person whose action sent it (an inviter, a club admin, the staff member who replied), when the sender knows; NULL for the product''s own sends.';
COMMENT ON COLUMN public.platform_account_emails.feedback_id IS 'The feedback item a Feedback received or a reply email belongs to (the feedback record''s conversation).';
COMMENT ON COLUMN public.platform_account_emails.resend_id IS 'The mail service''s number for the email (Resend id), shown in the email''s window; NULL until it answered, or when it never did.';
COMMENT ON COLUMN public.platform_account_emails.state IS
  'sent = handed to the mail service; unconfirmed = no answer when we sent it; delayed; delivered = their server accepted it; bounced, complained (marked as spam), failed, not_sent (suppressed, or this site has no mail key) are final. Moves forward only (platform_account_email_event); unconfirmed only replaces sent.';
COMMENT ON COLUMN public.platform_account_emails.bounce_reason IS 'A reason from a short fixed list, never the mail service''s words (they repeat the address and subject).';

-- ── 2. The email's timeline (one row per matched delivery callback) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_account_email_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_id      uuid NOT NULL REFERENCES public.platform_account_emails(id) ON DELETE CASCADE,
  event_id      text NOT NULL UNIQUE CHECK (event_id ~ '^[A-Za-z0-9_-]{6,80}$'),
  state         text NOT NULL CHECK (state IN ('sent', 'delayed', 'delivered', 'bounced', 'complained', 'failed', 'not_sent')),
  occurred_at   timestamptz NOT NULL,
  bounce_reason text CHECK (bounce_reason IS NULL OR bounce_reason IN
                  ('address_does_not_exist', 'mailbox_full', 'refused_by_server', 'suppressed', 'other')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_account_email_events_email_idx ON public.platform_account_email_events (email_id, occurred_at);

ALTER TABLE public.platform_account_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_account_email_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_account_email_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_account_email_events_id_seq TO service_role;

COMMENT ON TABLE public.platform_account_email_events IS
  'Support console Stage 5: what the mail service said about one logged email, one row per delivery callback (svix-id unique = the handled-numbers record, T9). Written only by platform_account_email_event, in the same step that moves the email forward. Goes with its email (90 days).';
COMMENT ON COLUMN public.platform_account_email_events.event_id IS 'The callback''s own message number (svix-id). A retry reuses it, so a repeat inserts nothing.';
COMMENT ON COLUMN public.platform_account_email_events.occurred_at IS 'When the mail service says it happened (the payload''s created_at), not when the callback arrived.';

-- The rank of a state: a row moves only to a higher one. unconfirmed (0) is ours and only ever replaces sent.
CREATE OR REPLACE FUNCTION public.platform_account_email_rank(p_state text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_state
    WHEN 'unconfirmed' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'delayed' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'bounced' THEN 4 WHEN 'complained' THEN 4 WHEN 'failed' THEN 4 WHEN 'not_sent' THEN 4
    ELSE -1 END
$$;

-- A delivery callback, in ONE database step (T9, T10, T11): no row = 'no_row' and nothing is written; a number seen
-- before = 'duplicate'; else the timeline gains the event and the email moves forward if the state ranks higher.
CREATE OR REPLACE FUNCTION public.platform_account_email_event(
  p_email_id uuid, p_event_id text, p_state text, p_at timestamptz, p_reason text
) RETURNS text LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_inserted bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_account_emails WHERE id = p_email_id) THEN
    RETURN 'no_row';
  END IF;
  INSERT INTO public.platform_account_email_events (email_id, event_id, state, occurred_at, bounce_reason)
  VALUES (p_email_id, p_event_id, p_state, p_at, p_reason)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN
    RETURN 'duplicate';
  END IF;
  UPDATE public.platform_account_emails
     SET state = p_state, state_at = p_at, bounce_reason = coalesce(p_reason, bounce_reason)
   WHERE id = p_email_id
     AND public.platform_account_email_rank(p_state) > public.platform_account_email_rank(state);
  RETURN 'applied';
END $$;

-- Our own outcome for a row (the sender's): failed / not_sent are final; unconfirmed only replaces sent. No timeline row.
CREATE OR REPLACE FUNCTION public.platform_account_email_settle(p_email_id uuid, p_state text, p_resend_id text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.platform_account_emails
     SET resend_id = coalesce(resend_id, p_resend_id)
   WHERE id = p_email_id AND p_resend_id IS NOT NULL;
  IF p_state = 'unconfirmed' THEN
    UPDATE public.platform_account_emails SET state = 'unconfirmed', state_at = now()
     WHERE id = p_email_id AND state = 'sent';
  ELSIF p_state IN ('failed', 'not_sent') THEN
    UPDATE public.platform_account_emails SET state = p_state, state_at = now()
     WHERE id = p_email_id AND public.platform_account_email_rank(state) < 4;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.platform_account_email_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_account_email_rank(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_account_email_rank(text) TO service_role;
REVOKE ALL ON FUNCTION public.platform_account_email_event(uuid, text, text, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_account_email_event(uuid, text, text, timestamptz, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_account_email_event(uuid, text, text, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.platform_account_email_settle(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_account_email_settle(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_account_email_settle(uuid, text, text) TO service_role;

-- ── 3. Feedback replies ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_feedback_replies (
  id               uuid PRIMARY KEY,
  feedback_id      uuid NOT NULL REFERENCES public.feedback_submissions(id) ON DELETE CASCADE,
  staff_user_id    uuid NOT NULL,
  staff_email      text NOT NULL,
  signed_name      text NOT NULL DEFAULT '' CHECK (length(signed_name) <= 80),
  to_email         text NOT NULL CHECK (to_email = lower(to_email)),
  body             text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'unknown')),
  attempt          smallint NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 20),
  account_email_id uuid REFERENCES public.platform_account_emails(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sending_at       timestamptz,
  finished_at      timestamptz
);

-- Each claim's own time (the /review of the build, 2026-10-26): a request holds the reply only while claimed_at is its
-- own, so a stalled claim can be taken over after two minutes and the stale request can no longer finish it.
ALTER TABLE public.platform_feedback_replies ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS platform_feedback_replies_feedback_idx ON public.platform_feedback_replies (feedback_id, created_at);
CREATE INDEX IF NOT EXISTS platform_feedback_replies_staff_idx ON public.platform_feedback_replies (staff_user_id, created_at DESC);

-- The words, the person and the address never change; the state moves forward, and only failed / unknown retry.
CREATE OR REPLACE FUNCTION public.platform_feedback_replies_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.sending_at IS NOT NULL OR NEW.finished_at IS NOT NULL OR NEW.attempt <> 1 THEN
      RAISE EXCEPTION 'A reply starts as a draft.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.feedback_id IS DISTINCT FROM OLD.feedback_id
     OR NEW.staff_user_id IS DISTINCT FROM OLD.staff_user_id OR NEW.staff_email IS DISTINCT FROM OLD.staff_email
     OR NEW.signed_name IS DISTINCT FROM OLD.signed_name OR NEW.to_email IS DISTINCT FROM OLD.to_email
     OR NEW.body IS DISTINCT FROM OLD.body OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A reply''s words and address never change once written.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status = 'sending')
    OR (OLD.status = 'sending' AND NEW.status IN ('sent', 'failed', 'unknown'))
    OR (OLD.status IN ('failed', 'unknown') AND NEW.status = 'sending')
  ) THEN
    RAISE EXCEPTION 'A reply moves forward only: draft, sending, then sent, failed or unknown; only failed or unknown retry.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.platform_feedback_replies_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_feedback_replies_guard ON public.platform_feedback_replies;
CREATE TRIGGER platform_feedback_replies_guard BEFORE INSERT OR UPDATE ON public.platform_feedback_replies
  FOR EACH ROW EXECUTE FUNCTION public.platform_feedback_replies_guard();

ALTER TABLE public.platform_feedback_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_feedback_replies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_feedback_replies TO service_role;

COMMENT ON TABLE public.platform_feedback_replies IS
  'Support console Stage 5 (owner Q5 2026-10-26): a staff reply to a feedback item, sent by email from "FieldLogicHQ support". The id is made by the reply window and, with the attempt, is the mail service''s once-only key (T22). The address is the server''s (the account behind the feedback), never the browser''s (T18). Words fixed once written. Super admin and Support (the reply power) write it; every feedback reader sees it in the conversation.';
COMMENT ON COLUMN public.platform_feedback_replies.signed_name IS 'The first name the reply was signed with (the staff list''s), or empty when the staff member has none: the email then signs "FieldLogicHQ support" alone.';
COMMENT ON COLUMN public.platform_feedback_replies.status IS
  'draft = written, not yet claimed; sending = one server holds it; sent = the mail service took it; failed = the mail service refused it, nothing was sent (a retry takes the next attempt); unknown = no answer (a retry within a day repeats the same attempt, which the mail service sends at most once).';
COMMENT ON COLUMN public.platform_feedback_replies.attempt IS 'Rises only after a definite refusal, so a retry after a refusal is a new once-only key and a retry after no answer is the same one.';
COMMENT ON COLUMN public.platform_feedback_replies.claimed_at IS 'When the current (or last) claim took it. Only the request holding this claim may finish the attempt; a sending reply whose claim is over two minutes old is Not confirmed and may be taken over (same once-only key).';
COMMENT ON COLUMN public.platform_feedback_replies.sending_at IS 'When it first moved to sending; a retry more than a day after it is refused (the mail service remembers a key for 24 hours).';

-- ── 4. Status's shared reading ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_status_reading (
  id         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reading    jsonb,
  read_at    timestamptz,
  claimed_at timestamptz
);
INSERT INTO public.platform_status_reading (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_status_reading ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_status_reading FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_status_reading TO service_role;

COMMENT ON TABLE public.platform_status_reading IS
  'Support console Stage 5 (T6): Status''s one shared reading of the outside providers (verdict words, numbers and times only; never a log, a setting or a provider''s words). One row. Read at most once every 30 seconds for all staff together through platform_status_claim.';

-- One server claims the next reading: true only when the last one is older than p_min_age_seconds and no other claim is
-- younger than p_claim_seconds. The database's clock decides, so it holds however many servers ask.
CREATE OR REPLACE FUNCTION public.platform_status_claim(p_min_age_seconds integer, p_claim_seconds integer)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_claimed boolean;
BEGIN
  UPDATE public.platform_status_reading
     SET claimed_at = now()
   WHERE id = 1
     AND (read_at IS NULL OR read_at < now() - make_interval(secs => p_min_age_seconds))
     AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => p_claim_seconds))
  RETURNING true INTO v_claimed;
  RETURN coalesce(v_claimed, false);
END $$;
REVOKE ALL ON FUNCTION public.platform_status_claim(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_status_claim(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_status_claim(integer, integer) TO service_role;

-- ── 5. Sent emails searches (the daily limit; never the words) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_sent_email_searches (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  searched_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_sent_email_searches_actor_idx ON public.platform_sent_email_searches (actor_user_id, searched_at DESC);

ALTER TABLE public.platform_sent_email_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_sent_email_searches FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_sent_email_searches TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_sent_email_searches_id_seq TO service_role;

COMMENT ON TABLE public.platform_sent_email_searches IS
  'Support console Stage 5 (T17): one row per Sent emails search by address, counted for a daily limit per staff member. Never the words typed (A3). Kept 2 days, pruned on write.';

-- ── 6. The health read function ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_health_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_in_use integer;
  v_stuck  integer;
  v_max    integer;
  v_jobs   jsonb := NULL;
BEGIN
  SELECT count(*) INTO v_in_use
    FROM pg_catalog.pg_stat_activity
   WHERE backend_type = 'client backend';
  SELECT count(*) INTO v_stuck
    FROM pg_catalog.pg_stat_activity
   WHERE backend_type = 'client backend'
     AND state IN ('active', 'idle in transaction', 'idle in transaction (aborted)')
     AND state_change < now() - interval '5 minutes';
  v_max := pg_catalog.current_setting('max_connections')::integer;

  IF pg_catalog.to_regclass('cron.job') IS NOT NULL AND pg_catalog.to_regclass('cron.job_run_details') IS NOT NULL THEN
    EXECUTE $q$
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'name', j.jobname,
               'active', j.active,
               'last_run_at', r.last_start,
               'last_status', r.last_status,
               'runs_24h', coalesce(r.runs, 0),
               'failed_24h', coalesce(r.failed, 0)
             ) ORDER BY j.jobname), '[]'::jsonb)
        FROM cron.job j
        LEFT JOIN LATERAL (
          SELECT max(d.start_time) AS last_start,
                 (array_agg(d.status ORDER BY d.start_time DESC))[1] AS last_status,
                 count(*) FILTER (WHERE d.start_time > now() - interval '24 hours') AS runs,
                 count(*) FILTER (WHERE d.start_time > now() - interval '24 hours' AND d.status = 'failed') AS failed
            FROM cron.job_run_details d
           WHERE d.jobid = j.jobid AND d.start_time > now() - interval '24 hours'
        ) r ON true
    $q$ INTO v_jobs;
  END IF;

  RETURN jsonb_build_object('in_use', v_in_use, 'max', v_max, 'stuck', v_stuck, 'jobs', v_jobs);
END $$;

REVOKE ALL ON FUNCTION public.platform_health_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_health_counts() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_health_counts() TO service_role;

COMMENT ON FUNCTION public.platform_health_counts() IS
  'Support console Stage 5 Status (T7): connections in use of the maximum, sessions stuck over 5 minutes, and each scheduled job''s name, last run, pass or fail and 24-hour counts (jobs = null when the cron schema is absent). Counts, names, times and pass/fail only. service_role only.';

-- ── 6b. Status's cheap lines, in one call (Today reads them too, so it stays one round trip) ──────
-- Index 0 is the last hour (or day); 1-7 the same hour (or day) on each of the seven before, from which the Status
-- module takes "a usual hour" as the middle value. Counts only. Plain (not SECURITY DEFINER): the server role reads
-- these tables already.
CREATE OR REPLACE FUNCTION public.platform_status_counts(p_env text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH hours AS (
    SELECT d, now() - make_interval(days => d) - interval '1 hour' AS lo, now() - make_interval(days => d) AS hi
      FROM generate_series(0, 7) AS d
  ),
  err AS (
    SELECT h.d, (SELECT count(*) FROM public.error_events e
                  WHERE e.env = p_env AND e.occurred_at >= h.lo AND e.occurred_at < h.hi) AS n
      FROM hours h
  ),
  calls AS (
    SELECT h.d, coalesce(sum(r.call_count), 0) AS n
      FROM hours h
      LEFT JOIN public.request_metrics_rollup r ON r.env = p_env AND r.bucket_start >= h.lo AND r.bucket_start < h.hi
     GROUP BY h.d
  ),
  days AS (
    SELECT d, now() - make_interval(days => d + 1) AS lo, now() - make_interval(days => d) AS hi
      FROM generate_series(0, 7) AS d
  ),
  daily AS (
    SELECT x.d, coalesce(sum(r.call_count), 0) AS calls, coalesce(sum(r.error_count), 0) AS errors
      FROM days x
      LEFT JOIN public.request_metrics_rollup r ON r.env = p_env AND r.bucket_start >= x.lo AND r.bucket_start < x.hi
     GROUP BY x.d
  ),
  top AS (
    SELECT e.group_id, count(*) AS n
      FROM public.error_events e
     WHERE e.env = p_env AND e.occurred_at >= now() - interval '1 hour' AND e.group_id IS NOT NULL
     GROUP BY e.group_id
     ORDER BY n DESC
     LIMIT 1
  )
  SELECT jsonb_build_object(
    'errors_by_hour', (SELECT jsonb_agg(n ORDER BY d) FROM err),
    'calls_by_hour',  (SELECT jsonb_agg(n ORDER BY d) FROM calls),
    'calls_by_day',   (SELECT jsonb_agg(calls ORDER BY d) FROM daily),
    'errors_by_day',  (SELECT jsonb_agg(errors ORDER BY d) FROM daily),
    'top_group',      (SELECT jsonb_build_object('id', group_id, 'n', n) FROM top),
    'counted_at',     (SELECT max(last_run_at) FROM public.observability_cron_heartbeat WHERE job_name = 'metrics_fold')
  )
$$;

REVOKE ALL ON FUNCTION public.platform_status_counts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_status_counts(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_status_counts(text) TO service_role;

COMMENT ON FUNCTION public.platform_status_counts(text) IS
  'Support console Stage 5 Status and Today: errors and API calls in the last hour and the same hour on each of the 7 days before, API calls and failures in the last 24 hours and each of the 7 days before, the last hour''s most frequent error group, and when the counting job last ran. Counts and times only. service_role only.';

-- ── 6c. Which of these addresses have an account (Sent emails' "no account", one call a page) ─────
-- Returns only the addresses given that match an account, lowercased; never an id, a name or any other column.
-- SECURITY DEFINER because it must read auth.users; at most 200 addresses a call; the server only.
CREATE OR REPLACE FUNCTION public.platform_accounts_for_emails(p_emails text[])
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT lower(u.email)
    FROM auth.users u
   WHERE lower(u.email) = ANY (
     SELECT lower(e) FROM unnest(p_emails[1:200]) AS e
   )
$$;

REVOKE ALL ON FUNCTION public.platform_accounts_for_emails(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_accounts_for_emails(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_accounts_for_emails(text[]) TO service_role;

COMMENT ON FUNCTION public.platform_accounts_for_emails(text[]) IS
  'Support console Stage 5 Sent emails: of up to 200 addresses, the ones that belong to an account (lowercased). Nothing else is returned. service_role only.';

-- ── 7. The records-opened trail learns an email ───────────────────────────────────────────────────
ALTER TABLE public.platform_record_opens DROP CONSTRAINT IF EXISTS platform_record_opens_record_kind_check;
ALTER TABLE public.platform_record_opens ADD CONSTRAINT platform_record_opens_record_kind_check
  CHECK (record_kind IN ('club', 'person', 'email'));
COMMENT ON COLUMN public.platform_record_opens.record_kind IS
  'club = an organizations row (clubs, tournament hosts, coaches portals); person = an auth.users account; email = a platform_account_emails row opened from Sent emails (Stage 5, T17).';

COMMIT;
