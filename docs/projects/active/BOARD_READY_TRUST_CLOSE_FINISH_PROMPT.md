Board Ready — trust close-out fixes 1–11: finish them. /simplify → /review → /docs → the commits. The owner asked for this
run on 2026-11-18, commits included (one per fix, 2 and 9 together, then one records commit). Do NOT push.

WHAT IS ALREADY DONE (2026-11-18, on `dev`, uncommitted in the shared tree)
All eleven owner rulings ("as recommended") are built and proven on dev. Scope, findings and rulings:
docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md (the RULED 2026-11-18 block at the top) and
docs/projects/active/BOARD_READY_TRUST_CLOSE_CHECKLIST.html Part A ids 1–11. Items 12, 13, 14, 21 are out of scope.
- Proof: `.probe/trust-close-prove.mjs` (gitignored; dev only; needs the dev server up) — 69 checks, all pass. Re-run it
  after any /simplify or /review change and quote its last line.
- Migration 500 (`rule_section_save`) is APPLIED TO DEV and listed `pending` in MANUAL_PROD_STEPS.json.
  ⚠ PRODUCTION ORDER IS MIGRATION FIRST, THEN CODE (the new rules save calls the function; code first = every Rules
  section edit answers 500). The owner's brief said "code first then migration" — that is wrong for this one; the entry
  already says so. No other item needs a database change.
- The unit suite has 26 failing tests in 22 files that are OTHER SESSIONS' uncommitted work (e.g. lib/email.ts,
  ClubHubKit, the coach schedule screens, plan-reader/workspace-flip guards). None is ours. Do not fix them; do not let
  them block. `npm run verify:changed` stops at `npm test` because of them, and its focused-lint wrapper crashes on a
  react-hooks plugin config error — run its remaining steps one by one and lint our files with `npx eslint <files>`.
  `npx tsc --noEmit` needs `NODE_OPTIONS=--max-old-space-size=8192`; its one error (tests/unit/layout-run-journal.test.ts)
  is not ours.

STEP 1 — /simplify (three new shared helpers, so run it before /review)
New: `lib/document-upload.ts` (sniff + names, reuses `cleanResourceFileName`), `lib/org-for-browser.ts`,
`canReadVenueLibrary` in `lib/venue-library.ts` (+ `demoActorRefusal` in `lib/demo-guard.ts`, `kitOrgPlace`'s new
`showsBoard`). Scope it to the files listed under the commits below. Keep the behaviour; re-run the probe after.

STEP 2 — /review on the same files. Apply what it finds, re-run the probe and the unit tests named in each commit below.

STEP 3 — /docs. Help articles that describe: Permits and the Venue library (who reads them now: owner, admin, league
admin, anyone with Run tournaments, anyone with Accounting — never staff, scorekeepers, registrars or coaches; a
registrar's Organization holds only The board), the returning-player card (Confirm only for a coach with roster
privacy), player documents / document templates (a file must really be a PDF, JPG, PNG or Word .docx). Spelling gate on.

STEP 4 — the commits. Branch `dev` (re-check before each). Explicit pathspecs only; never `git add -A`. After each:
`git show --stat HEAD` and confirm only these files. No Co-Authored-By footer (owner rule). Several files carry OTHER
sessions' uncommitted hunks — stage by hunk (temp index / `git apply --cached` of our hunks), never the whole file:
MANUAL_PROD_STEPS.json (ours = the `500_…` entry only), BOARD_READY_ACCESS_SWEEP_3.md, OWNER_BRIEF_PROJECTS.json,
OWNER_QA_LEDGER.md, DATA_DICTIONARY.md (ours = the `rule_section_save` paragraph + the display_order sentence),
docs/agents/db/schema-snapshots/* (refreshed by the hook after mig 500). Diff each file first; if a file listed below
shows hunks that are not about its item, leave those hunks out.
Message shape (the repo's): what changes for whom, in plain words, then "Board Ready trust close-out N (owner
2026-11-18)". Commit in this order:

 1. (7) A mistyped week in the house-league schedule's read falls back to the current week, not a 500.
    app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts
 2. (11) A parent with an unconfirmed email refused a family claim is told to confirm it first.
    lib/family-invitation-words.ts · app/(consumer)/family/claim/[token]/ClaimClient.tsx · tests/unit/family-claim-unconfirmed.test.ts
 3. (5) The check-in board's divisions read stops sending fees to a gate-only volunteer.
    app/api/admin/divisions/route.ts · tests/unit/admin-reads-capability-guard.test.ts
 4. (3) "Confirm — same player" only for a coach with roster privacy (card hides it; route refuses it).
    app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/[linkId]/route.ts ·
    app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/route.ts (comment only) ·
    components/coaches/ContinuityCompareCard.tsx · tests/unit/continuity-confirm-guard.test.ts
 5. (6) Player documents and templates: the type is read from the file's bytes, the stored name is cleaned.
    lib/document-upload.ts · tests/unit/document-upload.test.ts ·
    app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/route.ts ·
    app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/route.ts ·
    app/api/admin/rep-teams/document-templates/route.ts
 6. (1) The "See it live" accounts are refused at every door that creates a workspace (+ build check).
    lib/demo-guard.ts · app/api/org/create/route.ts · app/api/league/create/route.ts · app/api/coaches/teams/route.ts ·
    app/api/coaches/basic-teams/route.ts · app/api/register/route.ts · tests/unit/demo-create-doors-guard.test.ts
    (Note in the message: two doors beyond the ruling's three — claiming an entry and a signed-in tournament sign-up —
    both can create a coach team.)
 7. (4) The club's billing facts reach the owner's and admins' browsers only.
    lib/org-for-browser.ts · app/api/org-context/route.ts · app/[orgSlug]/admin/layout.tsx ·
    app/[orgSlug]/coaches/layout.tsx · tests/unit/org-for-browser.test.ts
 8. (2 + 9) Permits and the Venue library read only by people who schedule, run tournaments or handle money; a reader
    who can't open a permit file sees "File attached".
    lib/venue-library.ts · lib/admin-kit-nav.ts · components/admin/kit/useAdminKitNav.ts ·
    app/api/admin/club-calendar/route.ts · app/api/admin/org/venues/route.ts · app/api/admin/org/permits/document/route.ts ·
    app/api/admin/org/permits/route.ts (ONLY the GET gate + the venue-library import line) ·
    app/[orgSlug]/admin/permits/layout.tsx · app/[orgSlug]/admin/org/venues/layout.tsx (new) · lib/permit-server.ts ·
    lib/permit-words.ts · components/admin/kit/club/PermitWindows.tsx · tests/unit/_club-people.ts ·
    tests/unit/admin-kit-nav.test.ts · tests/unit/nav-standard-guard.test.ts · tests/unit/club-permits-guard.test.ts ·
    tests/unit/org-billing-access-guard.test.ts (two allow-list entries; permits/layout's was already missing at HEAD)
 9. (10) Saving, editing or renewing a permit checks the member's own team groups.
    app/api/admin/org/permits/route.ts (the rest: `teamOutsideGroups` and its three calls + the `repGroupScopeGuard`
    import). Verify the file at HEAD after commit 8 + this equals the working tree.
10. (8) A Rules section saves in one database step; a retried save never doubles a point.
    supabase/migrations/500_a_rules_section_saves_in_one_step.sql · app/api/admin/rules/route.ts ·
    lib/rule-section-input.ts · app/[orgSlug]/admin/tournaments/rules/RuleSectionRecord.tsx ·
    tests/unit/rules-sections-server-only-guard.test.ts · DATA_DICTIONARY.md (our hunk) · MANUAL_PROD_STEPS.json (our
    entry) · the refreshed schema snapshots. Message says: production applies 500 BEFORE the code.
11. Records. BOARD_READY_ACCESS_SWEEP_3.md: under the RULED 2026-11-18 block, one line per item 1–11 with its commit hash
    and 2026-11-18 (2 and 9 share one) and the production note for 8 (migration first). Also correct the two premises it
    states that were wrong: the billing facts never went through the role-summary hook (they reached the browser through
    /api/org-context and the admin + Coaches Portal layouts), and "one database step" alone could not stop the double
    point (the screen now names each new point before its first save). OWNER_BRIEF_PROJECTS.json, board-ready line ONLY:
    stage → "Now: walk §539 (the trust fixes 1–11) → Next: the pay-link button drawing, then fixes 13, 14 and the
    second-caller guard"; next → "Walk §539, then the pay-link button's drawing session"; remains → drop "The access
    fixes," and say "Access fixes 12–14 and the second-caller guard, …"; youOwe → replace "Say go to build the trust
    fixes…" with "Walk §539 (trust fixes 1–11)"; keep the old-link-rows read. OWNER_QA_LEDGER.md §539 and the walk source
    docs/projects/active/BOARD_READY_TRUST_CLOSE_WALK.html (both already written) go in this commit too, with this prompt
    file and one line for it in BOARD_READY_PROMPTS_INDEX.md (our line only — that file has other sessions' hunks).

FOUND WHILE BUILDING, NOT FIXED — record in the sweep report's records line, do not build:
- the club's player-document upload saves any `templateId` it is sent, unchecked (the coach route checks it);
- creating a Rules section (POST) is still two inserts with a compensating delete (a retried create could add a section);
- a group-limited member can still save a permit held for the whole club (the ruling covered teams only).

Hand-off: the commit list with hashes, the probe's last line, what /review changed, and the production order line:
"apply migration 500, then promote the code; nothing else in fixes 1–11 touches the database."
