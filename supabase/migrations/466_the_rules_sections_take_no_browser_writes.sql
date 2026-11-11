-- ---------------------------------------------------------------
-- Migration 466 — Board Ready W2 fix B, the Rules sections (the third part of the third access sweep's finding 2;
-- docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md). Same shape as migration 465 (the Rules page's links).
--
-- WHY: the `rules` and `rule_items` tables (the Rules page's text sections and their points) were written straight from the
-- browser under policies that ask only `can_access_tournament(tournament_id)` — "a member of this event's club, in scope". A
-- club's assistant coach or scorekeeper, who holds no `post_rules`, could rewrite or delete the public Rules page with the
-- public key and their own session. Mig 311 kept the grants because the Rules screen wrote from the browser.
--
-- WHAT CHANGES: INSERT, UPDATE and DELETE on public.rules and public.rule_items are taken from `authenticated`. Every write
-- now goes through app/api/admin/rules/route.ts, which checks the club and `post_rules` and uses the service role. SELECT is
-- untouched (the public Rules page and the admin list read both tables). The row policies stay (inert without the grants).
-- Nothing in the data changes.
--
-- ⚠ ORDER ON PRODUCTION: the CODE FIRST, then this migration. Applied first, the live Rules screen cannot add, edit, reorder
-- or delete a section until the code lands.
--
-- Idempotent: REVOKE of an absent privilege is a no-op.
-- ---------------------------------------------------------------

begin;

revoke insert, update, delete on public.rules, public.rule_items from authenticated;

commit;
