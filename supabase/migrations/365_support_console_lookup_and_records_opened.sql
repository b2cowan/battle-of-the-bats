-- 365 · The support console's read-only lookup over sign-in records, and the trail of records opened
-- (Support console Stage 2, owner rulings 2026-10-25; PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_BUILD_PROMPT.md §7 Part 2,
-- drawings Ub7fXLh29SC34Zp4oqKUx1 "Find security").
--
-- WHY A DATABASE FUNCTION. The sign-in service's admin API lists accounts one page at a time (page/perPage) with no
-- email or name filter, so every console screen read "the first 1,000" and stopped there without saying so (Customer
-- users, the clubs list's owner sign-ins, Overview's owner-inactive count, the Founding Season desk). A server-side
-- Find needs to search every account. These functions read `auth.users` inside the database and return EXACTLY:
-- id, email, name (from the account's metadata), last sign-in, created, banned-until, email-confirmed-at. No phone, no
-- tokens, no stored settings.
--
-- ⚠ WHO MAY CALL THEM. A new function in `public` is executable by PUBLIC and, by Supabase's default grants, by `anon`
-- and `authenticated` — i.e. by anyone holding the public key, through PostgREST's /rpc. Every function below is
-- SECURITY DEFINER (it must read `auth.users`), so that default would hand the whole account list to the browser.
-- Each one therefore revokes from PUBLIC, anon AND authenticated and grants to service_role only — the pattern of
-- 178_bulk_reschedule_games_fn.sql:66-69. Do NOT copy 221/239, which leave `authenticated` able to call.
-- tests/unit/support-console-lookup-guard.test.ts holds this file to it, and the dev check calls each with the anon key.
--
-- SEARCH. The words are a value, never stitched into SQL. LIKE's own wildcards (% _ \) are escaped so they match as
-- plain letters (ESCAPE '\'). 2–120 characters for Find, or nothing. Find's 8 rows per group is a LIMIT written here,
-- not a parameter, so no caller can widen it. Staff accounts (every platform_users row, plus the bootstrap emails the
-- caller passes) are left out of every answer.
--
-- THE TRAIL. `platform_record_opens` keeps one row per club or person record a staff member opened: who, when, which,
-- and whether Find opened it — never the words typed (owner A3). 90 days, pruned on write by the code that inserts
-- (no scheduled job). Service role only; Super admin reads it in the Audit log under "Records opened".
BEGIN;

-- ── People: one ranked search, paged ─────────────────────────────────────────────────────────────────────────────
-- p_query    '' lists everyone (the People list); otherwise matched against email and name, anywhere in the word.
-- p_status   NULL | 'active' | 'unconfirmed' | 'banned'
-- p_clubs    also match a person through the name or web name of a club they belong to (the People list keeps the
--            Customer users search it replaces; Find does not, its Clubs group answers that)
-- Best match first: exact email, then an email or name starting with the words, then anywhere. total_count is the
-- whole match before the page is cut, for "N more not listed" and the pager.
CREATE OR REPLACE FUNCTION public.platform_people_search(
  p_query text,
  p_status text,
  p_exclude_emails text[],
  p_clubs boolean,
  p_offset integer,
  p_limit integer
)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  banned_until timestamptz,
  email_confirmed_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q   text := lower(btrim(coalesce(p_query, '')));
  pat text;
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  IF char_length(q) > 120 THEN
    RETURN;
  END IF;
  pat := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  WITH people AS (
    SELECT
      u.id,
      lower(u.email::text) AS email,
      coalesce(
        nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
      ) AS display_name,
      u.last_sign_in_at,
      u.created_at,
      u.banned_until,
      u.email_confirmed_at
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND u.deleted_at IS NULL
      AND NOT coalesce(u.is_anonymous, false)
      AND NOT (lower(u.email::text) = ANY (coalesce(p_exclude_emails, '{}'::text[])))
      AND NOT EXISTS (SELECT 1 FROM public.platform_users pu WHERE lower(pu.email) = lower(u.email::text))
  ),
  matched AS (
    SELECT
      p.*,
      CASE
        WHEN q = '' THEN 3
        WHEN p.email = q THEN 0
        WHEN p.email LIKE pat || '%' ESCAPE '\' THEN 1
        WHEN lower(coalesce(p.display_name, '')) LIKE pat || '%' ESCAPE '\'
          OR lower(coalesce(p.display_name, '')) LIKE '% ' || pat || '%' ESCAPE '\' THEN 1
        ELSE 2
      END AS rank
    FROM people p
    WHERE (
        q = ''
        OR p.email LIKE '%' || pat || '%' ESCAPE '\'
        OR lower(coalesce(p.display_name, '')) LIKE '%' || pat || '%' ESCAPE '\'
        OR (coalesce(p_clubs, false) AND EXISTS (
          SELECT 1
          FROM public.organization_members m
          JOIN public.organizations o ON o.id = m.organization_id
          WHERE m.user_id = p.id
            AND (lower(o.name) LIKE '%' || pat || '%' ESCAPE '\' OR lower(o.slug) LIKE '%' || pat || '%' ESCAPE '\')
        ))
      )
      AND (
        p_status IS NULL
        OR (p_status = 'banned' AND p.banned_until IS NOT NULL AND p.banned_until > now())
        OR (p_status = 'unconfirmed' AND p.email_confirmed_at IS NULL AND NOT (p.banned_until IS NOT NULL AND p.banned_until > now()))
        OR (p_status = 'active' AND p.email_confirmed_at IS NOT NULL AND NOT (p.banned_until IS NOT NULL AND p.banned_until > now()))
      )
  )
  SELECT
    m.id, m.email, m.display_name, m.last_sign_in_at, m.created_at, m.banned_until, m.email_confirmed_at,
    count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.rank, m.email, m.id
  OFFSET v_off
  LIMIT v_lim;
END;
$$;

-- ── Find's People group: the same search, 2–120 characters, 8 rows, no club matching ─────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_find_people(p_query text, p_exclude_emails text[])
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  banned_until timestamptz,
  email_confirmed_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF char_length(btrim(coalesce(p_query, ''))) < 2 OR char_length(btrim(coalesce(p_query, ''))) > 120 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.email, s.display_name, s.last_sign_in_at, s.created_at, s.banned_until, s.email_confirmed_at, s.total_count
  FROM public.platform_people_search(p_query, NULL, p_exclude_emails, false, 0, 8) s
  LIMIT 8;
END;
$$;

-- ── People by account number (the clubs list's owners, Today's owner-inactive count, a record's members) ───────
CREATE OR REPLACE FUNCTION public.platform_people_by_ids(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  banned_until timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    lower(u.email::text),
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
    ),
    u.last_sign_in_at,
    u.created_at,
    u.banned_until,
    u.email_confirmed_at
  FROM auth.users u
  WHERE u.id = ANY (coalesce(p_ids, '{}'::uuid[]))
  LIMIT 1000;
$$;

-- ── Find's Clubs group: name, web name, own web address, owner email; 2–120 characters, 8 rows ─────────────────
-- p_exclude_slugs: the demo sandboxes (lib/demo-org.ts DEMO_ORG_SLUGS), left out of every group.
CREATE OR REPLACE FUNCTION public.platform_find_clubs(p_query text, p_exclude_slugs text[])
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  plan_id text,
  subscription_status text,
  account_kind text,
  own_address text,
  owner_email text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q   text := lower(btrim(coalesce(p_query, '')));
  pat text;
BEGIN
  IF char_length(q) < 2 OR char_length(q) > 120 THEN
    RETURN;
  END IF;
  pat := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  WITH owners AS (
    SELECT m.organization_id, lower(u.email::text) AS email
    FROM public.organization_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.role = 'owner' AND u.email IS NOT NULL
  ),
  candidates AS (
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan_id,
      o.subscription_status,
      o.account_kind,
      (SELECT d.full_name FROM public.org_custom_domains d WHERE d.org_id = o.id LIMIT 1) AS own_address,
      (SELECT min(w.email) FROM owners w WHERE w.organization_id = o.id) AS first_owner,
      (SELECT min(w.email) FROM owners w WHERE w.organization_id = o.id AND w.email LIKE '%' || pat || '%' ESCAPE '\') AS matched_owner
    FROM public.organizations o
    WHERE NOT (lower(o.slug) = ANY (coalesce(p_exclude_slugs, '{}'::text[])))
  ),
  matched AS (
    SELECT
      c.*,
      CASE
        WHEN lower(c.name) = q OR lower(c.slug) = q OR lower(coalesce(c.own_address, '')) = q OR c.matched_owner = q THEN 0
        WHEN lower(c.name) LIKE pat || '%' ESCAPE '\' OR lower(c.slug) LIKE pat || '%' ESCAPE '\' THEN 1
        WHEN lower(c.name) LIKE '% ' || pat || '%' ESCAPE '\' THEN 1
        ELSE 2
      END AS rank
    FROM candidates c
    WHERE lower(c.name) LIKE '%' || pat || '%' ESCAPE '\'
       OR lower(c.slug) LIKE '%' || pat || '%' ESCAPE '\'
       OR lower(coalesce(c.own_address, '')) LIKE '%' || pat || '%' ESCAPE '\'
       OR c.matched_owner IS NOT NULL
  )
  SELECT
    m.id, m.name, m.slug, m.plan_id, m.subscription_status, m.account_kind, m.own_address,
    coalesce(m.matched_owner, m.first_owner) AS owner_email,
    count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.rank, lower(m.name), m.id
  LIMIT 8;
END;
$$;

-- Server only. Never the public key (signed out or signed in).
REVOKE ALL ON FUNCTION public.platform_people_search(text, text, text[], boolean, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_people_search(text, text, text[], boolean, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_people_search(text, text, text[], boolean, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.platform_find_people(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_find_people(text, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_find_people(text, text[]) TO service_role;

REVOKE ALL ON FUNCTION public.platform_people_by_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_people_by_ids(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_people_by_ids(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.platform_find_clubs(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_find_clubs(text, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_find_clubs(text, text[]) TO service_role;

COMMENT ON FUNCTION public.platform_people_search(text, text, text[], boolean, integer, integer) IS
  'Support console (S2): ranked, paged search over auth.users for the People list. Returns id, email, name, last sign-in, created, banned-until, email-confirmed-at only. Staff excluded. service_role only.';
COMMENT ON FUNCTION public.platform_find_people(text, text[]) IS
  'Support console Find (S2): People group, 2-120 characters, 8 rows (LIMIT in SQL). service_role only.';
COMMENT ON FUNCTION public.platform_people_by_ids(uuid[]) IS
  'Support console (S2): the sign-in facts for a list of account ids (owners, members). Ends the 1,000-account cap. service_role only.';
COMMENT ON FUNCTION public.platform_find_clubs(text, text[]) IS
  'Support console Find (S2): Clubs group by name, web name, own web address or owner email, 2-120 characters, 8 rows (LIMIT in SQL). service_role only.';

-- ── The trail of records opened (owner A3) ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_record_opens (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  actor_email   text NOT NULL,
  record_kind   text NOT NULL CHECK (record_kind IN ('club', 'person')),
  record_id     uuid NOT NULL,
  via_find      boolean NOT NULL DEFAULT false,
  opened_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_record_opens_opened_at_idx ON public.platform_record_opens (opened_at DESC);

ALTER TABLE public.platform_record_opens ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it. Granted to the server explicitly (Supabase stops
-- auto-granting new tables on 2026-10-30; migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.platform_record_opens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_record_opens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_record_opens_id_seq TO service_role;

COMMENT ON TABLE public.platform_record_opens IS
  'Support console (S2, owner A3): one row per club or person record a staff member opened - who, when, which, via Find or not. Never the words typed. Kept 90 days, pruned on write. Super admin reads it in the Audit log ("Records opened"). Never on a customer''s Story.';
COMMENT ON COLUMN public.platform_record_opens.record_kind IS 'club = an organizations row (clubs, tournament hosts, coaches portals); person = an auth.users account.';
COMMENT ON COLUMN public.platform_record_opens.via_find IS 'True when the record was opened from Find (the strip box), false from a list or a link.';

COMMIT;
