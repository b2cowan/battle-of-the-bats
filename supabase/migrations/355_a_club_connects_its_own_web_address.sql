-- 355 · A club connects its own web address (Club Tier Stage 4e, Part 2; owner rulings 2026-10-19 and 2026-10-23).
--
-- A club owner types an address the club already owns (www.lakeshorelynx.ca); the app asks the host (AWS Amplify) to serve
-- it, hands the club two records to copy to where it bought the address, and watches until they are in. This table is the
-- app's memory of that connection: the name, the two records as the host returned them, where it stands, when we last
-- looked, and which of the four emails to the owner have gone (so none repeats).
--
-- ONE live connection per club (a unique index on org_id; Stop or Cancel deletes the row), and a NAME IS UNIQUE ACROSS
-- CLUBS (a name already held must never silently move a site). The proxy reads full_name -> org_id on every request to a
-- club's own host, through an in-process cache, never per request (Part 4).
--
-- Server-only, like mig 343's notices: RLS on, no policies, anon/authenticated revoked, service_role granted. The routes
-- read through the service client and enforce "an admin reads, only the owner writes" themselves. NEW TABLE: no policy, no
-- function, no data write, so no MANUAL_PROD_STEPS entry is required (the table rides the Club release's prod apply).
--
-- No data is read or written for any existing club. Dev only until the Club release.

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_custom_domains (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL,

  -- The connection: www.lakeshorelynx.ca = prefix "www" on domain "lakeshorelynx.ca". Lowercase always.
  full_name                 text NOT NULL,
  domain                    text NOT NULL,
  prefix                    text NOT NULL,

  -- Where it stands: waiting | connected | needs_attention | not_connected | not_working (see lib/club-domain.ts).
  status                    text NOT NULL DEFAULT 'waiting',
  -- The host's own word for it, kept for diagnosis (PENDING_VERIFICATION, AVAILABLE, FAILED ...).
  host_status               text,
  host_branch               text,

  -- The two records the club copies. Names are relative to the domain (the form a club types), as the host returned them.
  record1_name              text NOT NULL,   -- the padlock check (a CNAME the certificate issuer looks for)
  record1_value             text NOT NULL,
  record2_name              text NOT NULL,   -- the site: the prefix, normally "www"
  record2_value             text NOT NULL,   -- what we hand out (a name of ours)
  record2_host_target       text,            -- the host's own target; a club that typed this works just as well

  -- What our own lookups last saw, and when. last_check is { record1, record2, bare_forwards } (never "live").
  last_checked_at           timestamptz,
  last_check                jsonb,

  -- The dates the screen and the emails name.
  waiting_since             timestamptz NOT NULL DEFAULT now(),
  connected_at              timestamptz,
  needs_attention_since     timestamptz,
  not_working_since         timestamptz,
  padlock_expires_at        timestamptz,

  -- Which emails to the owner have gone for this stretch, so none repeats (cleared when a stretch ends).
  live_email_sent_at        timestamptz,
  padlock_email_sent_at     timestamptz,
  padlock_reminder_sent_at  timestamptz,
  gave_up_email_sent_at     timestamptz,
  not_working_email_sent_at timestamptz,

  created_by_user_id        uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT org_custom_domains_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT org_custom_domains_status_check CHECK (status IN ('waiting', 'connected', 'needs_attention', 'not_connected', 'not_working')),
  CONSTRAINT org_custom_domains_lowercase CHECK (full_name = lower(full_name) AND domain = lower(domain) AND prefix = lower(prefix)),
  CONSTRAINT org_custom_domains_name_parts CHECK (full_name = prefix || '.' || domain)
);

-- One live connection per club; also the tenancy anchor the index-coverage gate wants (leads on org_id).
CREATE UNIQUE INDEX IF NOT EXISTS org_custom_domains_org_uidx ON public.org_custom_domains (org_id);
-- A name is unique across clubs, and a domain is held by one club: the host associates a domain once. Also the proxy's lookup.
CREATE UNIQUE INDEX IF NOT EXISTS org_custom_domains_full_name_uidx ON public.org_custom_domains (full_name);
CREATE UNIQUE INDEX IF NOT EXISTS org_custom_domains_domain_uidx ON public.org_custom_domains (domain);
-- The status check walks the live ones.
CREATE INDEX IF NOT EXISTS org_custom_domains_status_idx ON public.org_custom_domains (status, last_checked_at);

ALTER TABLE public.org_custom_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_custom_domains FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_custom_domains TO service_role;

COMMENT ON TABLE public.org_custom_domains IS
  'A club''s own web address (Club Tier Stage 4e, mig 355): at most one row per club (deleted on Stop). The name, the two records '
  'the club copies, where it stands, what our lookups last saw, and which owner emails have gone. Server-only; the routes '
  'enforce admin-reads, owner-writes. A name and a domain are each unique across clubs.';

COMMIT;
