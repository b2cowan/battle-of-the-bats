-- ---------------------------------------------------------------
-- Migration 398 — Support console Stage 7 (Growth): the leads pipeline's facts.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Owner rulings 2026-10-27 (Stage 7 drawings)" and
-- the build gate answers under it); build prompt PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_BUILD_PROMPT.md §7 Part 1.
--
-- WHAT CHANGES:
--   1. early_access_leads gains, all staff-side unless said:
--      • source (the short list, null = "Not set") and source_words (staff's own words, Q4 B);
--      • lost_reason (the six, Q9 a): required on a Lost lead and only there;
--      • link facts (Q2): link_method (offered | by_hand), linked_by (the staff address), linked_at, and signed_up_at —
--        the club's or portal's CREATION time, copied when linked (S7-D4, "Time to sign up counts to creation"). A lead
--        is Signed up exactly when linked_at is set. ⚠ converted_org_id is ON DELETE SET NULL, so a deleted club leaves
--        linked_at and signed_up_at behind: the lead stays counted, "Signed up, club since deleted" (Part 2).
--      • step_changed_at: when the step last moved (Q9 c, "stuck" = 30 days with no step change, note or follow-up).
--        Back-filled from the edit log; a lead never moved takes its created_at.
--      • heard_from (C, the visitor's answer, kept as given) and ref_tag (D, a tag on a link we hand out). Both are
--        format-checked here; the lists live in code (lib/early-access-admin.ts), where a commit adds one (threat 16).
--   2. internal_status gains 'lost'. not_a_fit → lost / not_a_fit; do_not_contact → lost / asked_not_to_contact.
--      ⚠ Stored values keep their spelling: 'converted' reads "Signed up", 'pilot_candidate' reads "Pilot". A CHECK now
--      pins the seven values, and Lost ⇔ a reason, Signed up ⇔ linked_at.
--   3. early_access_lead_notes: dated, signed notes (Q9 b). A note is never edited: a trigger refuses any change but a
--      Super admin's removal, which keeps who and when and drops the text ("a note was removed"). The old notes box
--      becomes each lead's first note, signed "from the old notes box" (from_old_box), and the box is emptied.
--   4. early_access_lead_dismissed_offers: "Not this club" (Part 4) — never offered again for that lead.
--   5. platform_lead_account_dates(p_emails): for the offered match (owner build-gate answer 2026-10-27, "best signal,
--      safe side"): each account's created, confirmation-sent, confirmed and last-sign-in times for the given
--      addresses. SECURITY DEFINER (it reads auth.users), search path pinned, the server only. Never a password,
--      a token or metadata.
--   6. Grants: the new tables grant the server its own access (Supabase stops auto-granting 2026-10-30); they, and early_access_leads itself (prod still granted anon/authenticated in 2026-06), are
--      the service role's only. RLS on, no policies, as the lead table.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The lead's new facts ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.early_access_leads
  ADD COLUMN IF NOT EXISTS source          text,
  ADD COLUMN IF NOT EXISTS source_words    text,
  ADD COLUMN IF NOT EXISTS lost_reason     text,
  ADD COLUMN IF NOT EXISTS link_method     text,
  ADD COLUMN IF NOT EXISTS linked_by       text,
  ADD COLUMN IF NOT EXISTS linked_at       timestamptz,
  ADD COLUMN IF NOT EXISTS signed_up_at    timestamptz,
  ADD COLUMN IF NOT EXISTS step_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS heard_from      text,
  ADD COLUMN IF NOT EXISTS ref_tag         text;

-- ── 2. The step move (before the CHECKs that pin it) ─────────────────────────────────────────────
UPDATE public.early_access_leads SET internal_status = 'lost', lost_reason = 'not_a_fit'
 WHERE internal_status = 'not_a_fit';
UPDATE public.early_access_leads SET internal_status = 'lost', lost_reason = 'asked_not_to_contact'
 WHERE internal_status = 'do_not_contact';

-- A club linked before this migration was linked by hand (the only way there was). Who did it is not recorded.
UPDATE public.early_access_leads l
   SET link_method   = 'by_hand',
       linked_at     = COALESCE(l.converted_at, l.updated_at),
       signed_up_at  = o.created_at,
       internal_status = CASE WHEN l.internal_status = 'lost' THEN l.internal_status ELSE 'converted' END,
       converted_at  = COALESCE(l.converted_at, l.updated_at)
  FROM public.organizations o
 WHERE o.id = l.converted_org_id AND l.linked_at IS NULL;

-- A Lost lead keeps its reason and loses a link it may carry (Lost and Signed up are two different ends).
UPDATE public.early_access_leads
   SET link_method = NULL, linked_at = NULL, signed_up_at = NULL, converted_org_id = NULL
 WHERE internal_status = 'lost' AND linked_at IS NOT NULL;

-- 'converted' with no club cannot happen through the route (it refuses); if one exists it goes back to New.
UPDATE public.early_access_leads SET internal_status = 'new', converted_at = NULL
 WHERE internal_status = 'converted' AND linked_at IS NULL;

-- When the step last moved: the newest edit-log entry whose step differs on its two sides (an entry before Stage 7
-- Part 0 holds the whole row, one after it holds the step; both carry internal_status), else the lead's arrival.
UPDATE public.early_access_leads l
   SET step_changed_at = COALESCE((
     SELECT max(a.created_at) FROM public.platform_audit_log a
      WHERE a.action = 'update_early_access_lead' AND a.field = l.id::text
        AND (a.old_value ->> 'internal_status') IS DISTINCT FROM (a.new_value ->> 'internal_status')
   ), l.created_at)
 WHERE l.step_changed_at IS NULL;

ALTER TABLE public.early_access_leads
  ALTER COLUMN step_changed_at SET DEFAULT now(),
  ALTER COLUMN step_changed_at SET NOT NULL;

ALTER TABLE public.early_access_leads
  DROP CONSTRAINT IF EXISTS early_access_leads_internal_status_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_source_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_source_words_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_lost_reason_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_lost_has_reason,
  DROP CONSTRAINT IF EXISTS early_access_leads_link_method_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_signed_up_is_linked,
  DROP CONSTRAINT IF EXISTS early_access_leads_link_facts_together,
  DROP CONSTRAINT IF EXISTS early_access_leads_heard_from_check,
  DROP CONSTRAINT IF EXISTS early_access_leads_ref_tag_check;

ALTER TABLE public.early_access_leads
  ADD CONSTRAINT early_access_leads_internal_status_check CHECK (internal_status IN
    ('new', 'contacted', 'qualified', 'pilot_candidate', 'waiting_for_launch', 'converted', 'lost')),
  ADD CONSTRAINT early_access_leads_source_check CHECK (source IS NULL OR source IN
    ('referral_club', 'tournament', 'search', 'social', 'event', 'pitch_deck', 'other')),
  ADD CONSTRAINT early_access_leads_source_words_check CHECK (source_words IS NULL OR length(source_words) BETWEEN 1 AND 500),
  ADD CONSTRAINT early_access_leads_lost_reason_check CHECK (lost_reason IS NULL OR lost_reason IN
    ('not_a_fit', 'chose_another_tool', 'price', 'not_this_season', 'no_reply', 'asked_not_to_contact')),
  ADD CONSTRAINT early_access_leads_lost_has_reason CHECK ((internal_status = 'lost') = (lost_reason IS NOT NULL)),
  ADD CONSTRAINT early_access_leads_link_method_check CHECK (link_method IS NULL OR link_method IN ('offered', 'by_hand')),
  ADD CONSTRAINT early_access_leads_signed_up_is_linked CHECK ((internal_status = 'converted') = (linked_at IS NOT NULL)),
  ADD CONSTRAINT early_access_leads_link_facts_together CHECK (
    (linked_at IS NULL AND link_method IS NULL AND signed_up_at IS NULL AND converted_org_id IS NULL AND linked_by IS NULL)
    OR (linked_at IS NOT NULL AND link_method IS NOT NULL AND signed_up_at IS NOT NULL)),
  ADD CONSTRAINT early_access_leads_heard_from_check CHECK (heard_from IS NULL OR heard_from ~ '^[a-z][a-z_]{1,39}$'),
  ADD CONSTRAINT early_access_leads_ref_tag_check CHECK (ref_tag IS NULL OR ref_tag ~ '^[a-z0-9][a-z0-9-]{0,31}$');

CREATE INDEX IF NOT EXISTS early_access_leads_internal_status_idx ON public.early_access_leads (internal_status, step_changed_at);
CREATE INDEX IF NOT EXISTS early_access_leads_converted_org_idx ON public.early_access_leads (converted_org_id) WHERE converted_org_id IS NOT NULL;

-- ── 3. Notes ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.early_access_lead_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.early_access_leads(id) ON DELETE CASCADE,
  body         text CHECK (body IS NULL OR length(body) BETWEEN 1 AND 4000),
  author_email text CHECK (author_email IS NULL OR author_email = lower(author_email)),
  from_old_box boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  removed_by   text,
  removed_at   timestamptz,
  CONSTRAINT early_access_lead_notes_signed CHECK (from_old_box OR author_email IS NOT NULL),
  CONSTRAINT early_access_lead_notes_removed_has_no_text CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND body IS NOT NULL)
    OR (removed_at IS NOT NULL AND removed_by IS NOT NULL AND body IS NULL))
);

CREATE INDEX IF NOT EXISTS early_access_lead_notes_lead_idx ON public.early_access_lead_notes (lead_id, created_at DESC);

-- A note is never edited: the only change allowed is its removal (text gone, who and when kept), once.
CREATE OR REPLACE FUNCTION public.early_access_lead_notes_never_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.removed_at IS NOT NULL
     OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
     OR NEW.author_email IS DISTINCT FROM OLD.author_email
     OR NEW.from_old_box IS DISTINCT FROM OLD.from_old_box
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.removed_at IS NULL
     OR NEW.body IS NOT NULL THEN
    RAISE EXCEPTION 'a lead note is never edited; it can only be removed, once' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS early_access_lead_notes_never_edited ON public.early_access_lead_notes;
CREATE TRIGGER early_access_lead_notes_never_edited
  BEFORE UPDATE ON public.early_access_lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.early_access_lead_notes_never_edited();

-- The old notes box becomes each lead's first note, dated when the lead last changed, then the box is emptied.
INSERT INTO public.early_access_lead_notes (lead_id, body, author_email, from_old_box, created_at)
SELECT l.id, left(btrim(l.internal_notes), 4000), NULL, true, l.updated_at
  FROM public.early_access_leads l
 WHERE l.internal_notes IS NOT NULL AND btrim(l.internal_notes) <> ''
   AND NOT EXISTS (SELECT 1 FROM public.early_access_lead_notes n WHERE n.lead_id = l.id AND n.from_old_box);
UPDATE public.early_access_leads SET internal_notes = NULL WHERE internal_notes IS NOT NULL;

ALTER TABLE public.early_access_lead_notes ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.early_access_lead_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.early_access_lead_notes TO service_role;

-- ── 4. Dismissed offers ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.early_access_lead_dismissed_offers (
  lead_id      uuid NOT NULL REFERENCES public.early_access_leads(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dismissed_by text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, org_id)
);

ALTER TABLE public.early_access_lead_dismissed_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.early_access_lead_dismissed_offers FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.early_access_lead_dismissed_offers TO service_role;

-- The lead table itself: the server's only (prod still granted the browser roles in 2026-06; RLS made them harmless).
REVOKE ALL ON TABLE public.early_access_leads FROM anon, authenticated;

-- ── 5. The account dates the offered match reads ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_lead_account_dates(p_emails text[])
RETURNS TABLE (
  user_id              uuid,
  email                text,
  created_at           timestamptz,
  confirmation_sent_at timestamptz,
  email_confirmed_at   timestamptz,
  last_sign_in_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, lower(btrim(u.email::text)), u.created_at, u.confirmation_sent_at, u.email_confirmed_at, u.last_sign_in_at
    FROM auth.users u
   WHERE lower(btrim(u.email::text)) = ANY (
           SELECT lower(btrim(e)) FROM unnest(p_emails[1:200]) AS e WHERE e IS NOT NULL
         )
     AND u.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.platform_lead_account_dates(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_lead_account_dates(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_lead_account_dates(text[]) TO service_role;

COMMIT;
