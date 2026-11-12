-- Migration 474 — Board Ready two-step sign-in, Part 3 fix (found walking §515 step 4, 2026-11-12).
--
-- WHY: every reset of someone else's two-step (the club's Manage window, the team staff page, and support's reset of an
-- owner) begins by signing the person out everywhere. The code did that with the sign-in service's admin
-- `DELETE /auth/v1/admin/users/{id}/sessions`. That route does not exist in the service (GoTrue v2.197, dev): for a real
-- account it answers "404 page not found", with or without a live session. So the first step always failed, every reset
-- stopped with "We couldn't reset it. Nothing changed", and no audit line was ever written. The support console's "Sign
-- out everywhere" door used the same route and was dead for the same reason.
--
-- WHAT: one function that ends every session of one account — the rows the service keeps in auth.sessions (the refresh
-- tokens go with them) — callable only by the server's own key. Returns how many sessions it ended (0 = none were open,
-- which is a success: the person is signed out). Functions only; no table or column change.
--
-- Additive and re-runnable. Prod: apply BEFORE the code that calls it (the code treats a missing function as "could not
-- sign them out", which is today's behaviour, so the order is safe either way).

CREATE OR REPLACE FUNCTION public.sign_out_everywhere(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  ended integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS ended = ROW_COUNT;
  RETURN ended;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_out_everywhere(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_out_everywhere(uuid) TO service_role;

COMMENT ON FUNCTION public.sign_out_everywhere(uuid) IS
  'Ends every session of one account (auth.sessions; refresh tokens go with them). Server key only. Used by the two-step reset and the support console''s Sign out everywhere (mig 474).';
