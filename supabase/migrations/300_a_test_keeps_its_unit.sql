-- 300 — A test keeps its unit; the successor link and its function are gone
-- (development lifecycle re-evaluation, stage 3 · Player — owner ruling on the §191 walk of the
-- Results table, 2026-09-15: "we should just not allow changing" the unit; a unit change is a NEW
-- test, never a linked continuation of the old one).
--
-- WHAT WAS: mig 293 gave a retired definition a pointer at the definition that "replaced" it, and
-- mig 294 the transaction that retired a test, inserted a successor under its name and linked the
-- two — so changing the unit on a test with results started a linked continuation. The Results
-- table then had to explain the join ("units changed — 2 earlier results in mph are listed but
-- not drawn on this line"), and the owner's reading of that line is the ruling: two units are two
-- tests, and one name carried over two units invites the coach to read 100 mph → 155 km/h as a
-- rise.
--
-- WHAT IS: the route refuses a unit change on a test that has results (the sheet shows the unit as
-- fixed text: "retire this test and start a new one"); a coach who wants a new unit defines a new
-- test. Nothing links the two. Retire is unchanged. A definition nothing points at can be DELETED
-- (a new DELETE route; the three RESTRICT FKs — results, observations, not-assessed marks — are
-- what refuse a delete of one that has records).
--
-- Drops, in dependency order: the function (nothing calls it), the CHECK that tied the link to
-- the retired flag, the link's index, the link column. COUNTED BOTH DATABASES BEFORE WRITING
-- (2026-09-15, read-only via scripts/db-query.mjs): prod ZERO linked rows and ZERO tests with
-- readings in more than one unit; dev ONE linked row (a retired "60-yd sprint" probe leftover with
-- zero results, on the UAT team) and two seeded "Throw speed" tests with mph+km/h readings — the
-- UAT fixture's F01 shape, re-seeded in one unit in the same unit of work.
--
-- ⚠ SCHEMA-INVISIBLE in one direction (a dropped column — prod having MORE than dev never fails
-- the "prod is missing" check) plus a dropped FUNCTION — registered in MANUAL_PROD_STEPS.json. The
-- parity gate on the master build DOES see the dropped column and CHECK, so it is ORDER-CRITICAL:
-- apply WITH the promote, minutes before the push (the mig-290 lesson). The old code's READS are
-- unaffected (select * simply lacks the column and the mapper defaults it to null); only the old
-- replace route — which calls the dropped function — fails in the window until the new build serves.

begin;

drop function if exists public.replace_rep_team_measurable_type(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric, text, smallint, text);

alter table public.rep_team_measurable_types drop constraint if exists rep_team_measurable_types_replaced_is_retired_check;
drop index if exists public.rep_team_measurable_types_replaced_by_idx;
alter table public.rep_team_measurable_types drop column if exists replaced_by_id;

commit;

-- Verify (dev and, later, prod — the gates cannot see the function):
--   select count(*) from pg_proc where proname = 'replace_rep_team_measurable_type';           → 0
--   select column_name from information_schema.columns
--     where table_name = 'rep_team_measurable_types' and column_name = 'replaced_by_id';         → 0 rows
