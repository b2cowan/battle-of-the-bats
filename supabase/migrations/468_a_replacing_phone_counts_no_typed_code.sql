-- ---------------------------------------------------------------
-- Migration 468 — while a lost phone is being replaced, a typed code counts for nothing in the DATABASE check either
-- (Board Ready two-step sign-in, Part 2; found by the Part 2 /review 2026-11-11; owner: yes, 2026-11-11).
--
-- WHY: mig 463's public.session_passed_two_step() is the database half of "a password alone opens nothing". While an
-- account is marked `two_step_replacing` (lost phone: its authenticator is gone, the new one not yet verified) the
-- sign-in service lets ANY session — a stolen password's too — enrol an authenticator of its own and reach `aal2`.
-- The server half already ignores `aal2` during a replacement (lib/two-step-session.ts, `codeCounts`); the database half
-- still said "aal2 passes", so a password-holder could read and write the tables a signed-in token reaches directly
-- (the mig 463 policy list) for as long as the mark stayed on — the mark has no expiry.
--
-- WHAT CHANGES: the `aal2` clause now also requires that the token's `two_step_replacing` mark is not set. Nothing else
-- in the function moves: nobody-signed-in, no-authenticator-and-not-replacing, and our own backup code on this very
-- session all pass as before. A person doing a legitimate replacement works through our server, which uses the service
-- role; the token's own direct reach is not needed until the replacement finishes, and set-up/verify refreshes the
-- session after clearing the mark so the new token carries the cleared flag at once.
--
-- Additive and re-runnable (CREATE OR REPLACE; the privileges set in mig 463 are kept and restated). The function is
-- invisible to check:migrations, so it is in MANUAL_PROD_STEPS.json.
-- ⚠ ORDER ON PRODUCTION: after mig 463 (it replaces that function). Any time before the Part 2 promote.
-- ---------------------------------------------------------------

begin;

create or replace function public.session_passed_two_step()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is null
    or (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      -- During a lost-phone replacement a typed code proves nothing: the sign-in service lets any session enrol its own.
      and coalesce((auth.jwt() -> 'app_metadata' ->> 'two_step_replacing')::boolean, false) = false
    )
    or (
      not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      )
      -- Replacing a lost phone (app_metadata, service-role written): two-step stays ON until the new one is verified.
      and coalesce((auth.jwt() -> 'app_metadata' ->> 'two_step_replacing')::boolean, false) = false
    )
    or exists (
      select 1 from public.two_step_backup_codes b
       where b.user_id = auth.uid()
         and b.used_session_id is not null
         and b.used_session_id::text = (auth.jwt() ->> 'session_id')
    )
$$;
revoke all on function public.session_passed_two_step() from public;
grant execute on function public.session_passed_two_step() to anon, authenticated, service_role;

commit;
