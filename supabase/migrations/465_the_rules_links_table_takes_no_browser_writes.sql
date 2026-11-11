-- ---------------------------------------------------------------
-- Migration 465 — Board Ready W2 fix B follow-up (the third access sweep's finding 2, second half;
-- docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md).
--
-- WHY: the `resources` TABLE (the Rules page's links and files) was written straight from the browser under policies that ask
-- only `can_access_tournament(tournament_id)` — "a member of this event's club, in scope". A club's assistant coach or
-- scorekeeper, who holds no `post_rules`, could add, rename, repoint or reorder the public Rules page's links with the public
-- key and their own session. Mig 311 kept the grants because the Rules screen wrote from the browser.
--
-- WHAT CHANGES: INSERT, UPDATE and DELETE on public.resources are taken from `authenticated`. Every row write now goes through
-- app/api/admin/resources/route.ts (and the delete through app/api/admin/resources/file/route.ts), which check the club and
-- `post_rules` and use the service role. SELECT is untouched: the public Rules page and the admin list still read the table.
-- The row policies stay (harmless without the grants). Nothing in the data changes.
--
-- ⚠ ORDER ON PRODUCTION: the CODE FIRST, then this migration. Applied first, the live Rules screen cannot add, rename, reorder
-- or delete a link until the code lands.
--
-- Idempotent: REVOKE of an absent privilege is a no-op.
-- ---------------------------------------------------------------

begin;

revoke insert, update, delete on public.resources from authenticated;

commit;
