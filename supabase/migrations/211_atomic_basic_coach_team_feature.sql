-- Migration 211: Atomic Tier-2 feature toggle for org-less Basic coach teams
--
-- Fixes a lost-update race found by /review (Free Coach Onboarding, 2026-07-30).
--
-- `setBasicCoachTeamFeature` (lib/basic-coach-teams.ts) was a read-modify-write in app code:
--   SELECT activated_features → merge the set in JS → UPDATE activated_features = <whole set>.
-- Two activations for the SAME team landing inside each other's read window (the same coach on a
-- phone and a laptop, or two tabs) both start from the pre-write set, so the second UPDATE
-- overwrites the first — silently dropping a tool the coach had just switched on. No roster /
-- schedule / message data is lost, only the on/off flag, but the tool vanishes from their nav with
-- no explanation. The onboarding setup panel added a SECOND surface that fires these writes
-- (previously only the Explore catalog did), which is what raised this from theoretical to worth
-- fixing.
--
-- The fix is to do the merge INSIDE one UPDATE statement. `UPDATE ... SET x = f(x)` re-reads the
-- row under its own row lock, so concurrent callers serialise instead of racing: no compare-and-
-- swap, no retry loop, no application-level locking.
--
-- Result is sorted so the stored array is deterministic (equal sets compare equal as jsonb) and
-- de-duplicated, and a non-array / NULL legacy value normalises to '[]' rather than throwing —
-- matching parseActivatedFeatures' defensive coercion in app code.
--
-- Additive + idempotent (CREATE OR REPLACE). No table/column change → data dictionary unchanged
-- (`basic_coach_teams.activated_features` keeps the exact meaning documented for mig 131).
-- Locked to service_role: the app calls it only after requireBasicCoachTeamOwner, so it must NOT
-- be reachable from the anon/authenticated PostgREST RPC surface — an open RPC here would let any
-- caller flip features on ANY team by id.

CREATE OR REPLACE FUNCTION public.set_basic_coach_team_feature(
  p_team_id uuid,
  p_feature text,
  p_active  boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next jsonb;
BEGIN
  UPDATE public.basic_coach_teams t
     SET activated_features = COALESCE((
           SELECT jsonb_agg(f ORDER BY f)
             FROM (
               SELECT DISTINCT raw.f
                 FROM (
                   -- Current members, defensively normalised (NULL / non-array → empty).
                   SELECT jsonb_array_elements_text(
                            CASE WHEN jsonb_typeof(t.activated_features) = 'array'
                                 THEN t.activated_features
                                 ELSE '[]'::jsonb END
                          ) AS f
                   UNION ALL
                   -- The member being added (activate only).
                   SELECT p_feature AS f WHERE p_active
                 ) raw
                -- Deactivate = keep everything except the target member.
                WHERE p_active OR raw.f <> p_feature
             ) uniq
         ), '[]'::jsonb)
   WHERE t.id = p_team_id
  RETURNING t.activated_features INTO v_next;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'basic_coach_team % not found', p_team_id USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_next;
END;
$$;

-- Only the server (service_role, post-ownership-check) may call this. Keep it off public PostgREST.
REVOKE ALL ON FUNCTION public.set_basic_coach_team_feature(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_basic_coach_team_feature(uuid, text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_basic_coach_team_feature(uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.set_basic_coach_team_feature(uuid, text, boolean) IS
  'Free Coaches Portal: atomically add/remove one Tier-2 capability key in basic_coach_teams.activated_features (mig 131) and return the resulting set. Merges inside a single UPDATE so concurrent activations for one team serialise instead of losing each other. Called only by the server (service_role) after requireBasicCoachTeamOwner.';
