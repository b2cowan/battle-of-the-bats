-- ---------------------------------------------------------------
-- Migration 462 — Board Ready W2 fix B (docs/projects/active/BOARD_READY_W2_FIX_B_RESOURCES_STORE_PROMPT.md; the third access
-- sweep's finding 2, docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md).
--
-- WHY: the public `resources` storage bucket (the Rules screen's files) let ANY signed-in account insert and delete
-- (mig 087 L20-28, kept by mig 311 because the Rules screen wrote from the browser). Keys were flat and listable, so any
-- account could delete any club's rules file, or replace one under the same name. Proven on dev by .probe/sweep3-prove.mjs.
--
-- WHAT CHANGES: the two write policies go. Upload and delete now run on the server (app/api/admin/resources/file/route.ts),
-- which checks the club and the `post_rules` capability and uses the service role. The public read policy stays: every
-- published rules file keeps its address and keeps opening. Nothing is moved.
--
-- ⚠ ORDER ON PRODUCTION: the CODE FIRST, then this migration. Applied first, the live Rules screen's upload and delete
-- (still straight from the browser) are refused until the code lands.
--
-- Idempotent: DROP POLICY IF EXISTS.
-- ---------------------------------------------------------------

begin;

drop policy if exists "Authenticated users can upload resources" on storage.objects;
drop policy if exists "Authenticated users can delete resources" on storage.objects;

commit;
