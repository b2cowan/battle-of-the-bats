-- Support console Stage 2, review fix (2026-10-25): Find's Clubs group names the owner you searched for.
--
-- Migration 365's platform_find_clubs picked a club's matched owner as the alphabetically FIRST owner email that
-- contained the words. A club with two owners, coowner@x and owner@x, searched for "owner@x", showed coowner@x and —
-- worse — missed the exact-match rank, so the club you typed the address of could sort below clubs that merely
-- contained it. The matched owner is now the exact email when there is one, then the first that contains the words.
-- Same signature, same grants (CREATE OR REPLACE keeps them; restated below so the file stands on its own).

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
      (SELECT w.email FROM owners w
        WHERE w.organization_id = o.id AND w.email LIKE '%' || pat || '%' ESCAPE '\'
        ORDER BY (w.email = q) DESC, w.email
        LIMIT 1) AS matched_owner
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
REVOKE ALL ON FUNCTION public.platform_find_clubs(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_find_clubs(text, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_find_clubs(text, text[]) TO service_role;
