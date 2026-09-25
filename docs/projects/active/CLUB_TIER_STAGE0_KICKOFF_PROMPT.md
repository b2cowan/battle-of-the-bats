# Club Tier Readiness — Stage 0 kickoff prompt ("Ground truth")

> Paste into a fresh session on `dev`. Written 2026-09-25 after all twelve rulings landed.
> Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (§3 exit definition, §4 defect
> ledger with anchors, §5 rulings, §6 Stage 0, §8 gates). PM brief beside it. Project hub (republish
> the SAME file path every phase): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Memory: `project_club_tier_readiness`.

## What Stage 0 is for

Make the Club org **walkable**: a seeded club with real teams, coaches, families and money; the
dead controls fixed so no screen dies on a 401/404/loop; one security hole closed and promoted on
its own; and the first end-to-end owner walk (§A) on the ledger and the hub. **Stage 0 builds no new
screen and changes no role default** — role defaults are Stage 1's mockup + build (ruling D8); the
fixture grants the treasurer/admin their capabilities explicitly so the walk can open every screen
today.

## Order of work (each step: `/review` before it is called done; commit only when the owner says)

1. **Security fix-now — its own commit, its own promote.** Plan §4I I01 (house-league draft /
   placement / standings / teams / registrations routes verify that every division, registration
   and team id belongs to the season's org — copy the pattern already used by `schedule`, `generate`
   and the practices routes), F07 (archive page checks the archive belongs to the org in the URL),
   the house-league register + status-lookup routes get the rate limiter the tryout-register route
   uses, and the seven league email templates go through `escapeEmailHtml`. Add a route-level guard
   test for the id ownership checks. `/review` at high risk (security lens). Flag it to the owner for
   an immediate promote — it is reachable by any club owner on prod today.
2. **Dead-control sweep** (§6 Stage 0): C01 payee search/create, C02 budget item/category create
   (also the `{newCategoryName}` vs `body.name` mismatch), A04 audit log, B06 dead roster/documents
   links + the `group=none` 500, C03 reminder-button roles (show only to roles the routes accept —
   do not widen the routes), F01 the tryouts card links to the tryout (`teamSlug` + `programYearId`
   are already loaded). Add **`check:org-slug-callers`** (a grep-level guard like
   `check:org-context`: every client fetch to a route that passes `requireOrgSlug: true` carries
   `orgSlug`) and wire it into `verify:changed`. Expect it to find more than the six above — fix what
   it finds on club-admin pages; list anything on other surfaces for their owners.
3. **The Club fixture** — `scripts/seed-club-fixture.mjs` (+ the `tests/uat/create-uat-accounts.sql`
   rows), refusing to run against prod like `seed-families-fixture.mjs`. Assemble from the
   money-lab and families-fixture recipes. Contents (plan §6 Stage 0): `uat-club-org` on `club`,
   `team_limit` 15, **owner + admin + treasurer + registrar** (with explicit capability grants so
   each can open every screen this walk needs), **six rep teams** across two groups (one archived),
   program years in three states (completed / active / draft), head coaches with real
   `rep_team_staff_memberships` (the dev seed writes none — B13; write both the membership and the
   season projection the way the admin coaches route does), rosters with guardians (some shared
   across two teams so Families has a real household), a budget year with lines and periods, two
   allocations (one overdue installment), three coach payment requests in three states, an org
   General ledger + one team ledger with entries and a transfer, a tournament with the club's own
   team linked, public site on. Register the fixture in `.claude/commands/uat.md` (fixtures list)
   and in `tests/uat/helpers/fixtures.ts` (a `clubOrgSlug` + sessions for the four roles).
   Verify with a dry `auth-setup` run that all four can sign in.
4. **The Families production check** (read-only, ask the owner before touching prod): confirm the
   merge function exists on prod — `select proname from pg_proc where proname like 'families_%'`.
   Record the answer in the plan §4E header and the Families memory note.
5. **Docs truth-ups** (plan §12 "owed"): the Families plan/brief/prompt headers, `OWNER_QA_LEDGER`
   §54/§56 headers, `TODO.md:159`, the dictionary line, the ADMIN_IA plan header (folded into the
   Club plan), the README pricing table (point at the facts doc), the facts doc's "coach bridge"
   line (B04), `lib/export/ics.ts:5` "STUB", the exports help "planned for a future release".
6. **Walk §A on the hub.** Fill `QA_PARTS` in the hub file (unhide the QA tab and its button),
   following `feedback_qa_walkthroughs_as_checkable_artifacts` — pin **identities and
   relationships**, never figures the calendar moves; sign-in card names the four fixture accounts.
   Parts: A provision + hub for each role · B members and roles (what each role can open) · C teams
   → coaches → the coach lands in the portal · D treasurer opens every money screen (payees and
   budget items now work; the allocation wizard's team list is still empty — that is Stage 1/D8,
   record it, do not fix it here) · E admin opens every module · F public page for the fixture club
   (the tryouts card now lands on the tryout) · G the six dead doors. Take the next free `§` number
   on `OWNER_QA_LEDGER.md` at the time (never re-sort). Republish the hub (same path).
7. **Handoff:** typecheck clean, `verify:changed` green (including the new guard), unit tests green,
   dev server restarted (new files + a shared guard script). Report in product-owner voice: what
   opens now that did not, what the walk will show, what Stage 1 will change. Offer `/review` on
   the sweep and `/docs` for any help copy the sweep touched (the reminder buttons' help line).

## Do not

- Change `ROLE_DEFAULTS` (Stage 1, D8). Touch money arithmetic, the allocation loop or BvA
  (Stage 3). Redesign any screen (every stage has its own mockup session). Build permits (Stage 10).
- Widen a route's role list to make a button work — hide the button from roles the route refuses.
- Re-seed prod or touch the demo orgs. Commit with `git add -A`; stage explicit pathspecs; use a
  private index if another session is active (`reference_shared_worktree_stage_race`).
- Use `rg`/Grep alone on `lib/db.ts` — it contains a NUL byte and is skipped silently; use `grep -a`.

## Rulings that govern this stage (all landed 2026-09-25)

D1 the coach's records are team money's truth (Stage 3 applies it) · D2 a club budget year (Stage
3c) · D8 admin gets every plan module by default and the hub decides "tournament-only" from the plan
(Stage 1 applies it; Stage 0 grants explicitly on the fixture) · D4 permits IN scope, Stage 10,
release waits · D6 no Founding Season offer for Club · D7 Club · Association purchasable at launch
with proration (Stage 1b) · D12 warm kit screen by screen from Stage 1's mockups on.
