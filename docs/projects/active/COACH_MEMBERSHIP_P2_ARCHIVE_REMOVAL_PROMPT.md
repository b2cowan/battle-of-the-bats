# New-chat prompt — P2: the season toggle and the archive place come out

Paste everything below the line into a fresh chat.

---

You are executing **Phase 2 of an APPROVED design** — not reopening it. The owner approved
**Design A on M1** ("the team is the account"; decision mockups artifact `aa758bcb` §10,
2026-08-16): staff membership lives on the team, and **history is delivered in place — the
season-toggle archive is deleted**. Canonical plan:
`docs/projects/active/COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` (§3 = the deletion set, §4 = the
test rewrites, §5 = the phase list and P1's build record). PM brief sits beside it.

**P1 is COMMITTED on dev — `8415dcd2` (2026-08-16)** — and it changed the ground under your feet:

- Access truth is `rep_team_staff_memberships` (mig 245, **dev-applied only**, backfilled).
  `lib/coach-membership.ts` is the only module allowed to touch it (build-enforced:
  `tests/unit/coach-membership-projection-guard.test.ts`).
- The season-read rail still exists but gates on MEMBERSHIP with CURRENT capabilities — rule 1
  ("as you saw it at the time") is already dead; P2 removes the rail itself.
- Staff already LEFT the archive (door, allow-list entries, rule-3 write exception).
- Owner QA **§39** may not have been walked yet — its steps describe P1's world. If a P2 change
  invalidates a §39 step, UPDATE the ledger consciously; never leave a stale instruction.

## The job

Delete the archive as a PLACE; keep the look-back and reference layers. Concretely, from plan §3:

1. **The three season-switch controls**: the sidebar's season `<select>`, the phone "More"
   sheet's season list, and `CoachSeasonChip` (mounted once in `CoachPageHeader`, fed by ~40
   pages' `season=` props). The masthead's presentational "Complete" chip on the WORKING season
   survives — the between-seasons state still exists and must still say what it is.
2. **The archive nav**: `CLOSED_TEAM_NAV_ITEMS`, `CLOSED_SECTION_EXTRAS`,
   `LIVE_ONLY_ARCHIVE_SECTIONS`, `archiveHasSection`, `resolveSeasonSwitchHref`, and the closed-
   team branches in `CoachesSidebar`/`CoachesBottomNav`. A team whose working season is finished
   shows the LIVE nav shape routed to what still exists — its landing is **Season's End**.
3. **The rail** (`lib/coach-season-read.ts`) and the `?year=` handling in its ~26 remaining
   routes — they return to working-season resolution (`resolveWorkingProgramYear` +
   membership, the P1 pattern in the team route). ⚠ **Read-only is NOT deleted**: a completed
   WORKING season still renders as a record (limbo state). What dies is season CHOICE.
4. **The `history/*` pages shed their archive halves** (`isRecord`/`?year=` plumbing) and keep
   their live reports, the **compare-every-season list**, and the **Season Wrapped links** —
   that list + Season's End + Wrapped ARE the look-back layer now.
5. **Survivor endpoints** get the new shape: `wrapped` keeps its explicit year param (Wrapped for
   any finished season, reached from the compare list / Season's End), `history` (the compare
   list) needs no year. Both re-gate on membership + current caps (already true since P1).
   ⚠ `events/[eventId]/practice-plan/read` is P3's shelf endpoint — VERIFY its live-season
   callers from code before deciding: if only the archive reached it, park it behind the new
   allow-list with a comment that P3's mockup session decides its door; do not delete it.
6. **The scrapbook restriction revert** (`12cf1b19`, 11 files, +254/−12): P1 already aligned both
   sides to "current head coach"; P2 removes the gate entirely — ALL current staff see the
   compare list and Season's End's "Compare every season" (owner ruling in the superseded
   current-staff plan §6). Retire ledger **§37 D2** with it.
7. **CLAUDE.md**: REPLACE the "Coaches Portal — the archive is OPT-IN" section with the new
   binding rule in the same unit of work: history is delivered in place; there is no season
   toggle; the HISTORY_ENDPOINTS allow-list in the guard test is the decision point; every new
   shelf needs an owner mockup session and the current season stays visually primary.
8. **The demo re-script** (this is load-bearing, not polish): the 13U "Season's End" team keeps
   working (it lands on Season's End), but tour step 7's promise — "every screen of the season
   still opens, read-only" — becomes FALSE the moment the doors go. Rewrite step 7 + the
   `seasons-end` dock line in `lib/sandbox-chrome.ts` around "the season's story is kept"
   (Season's End · Wrapped · the recap families opened), rewrite `check-demo-coach.mjs` section
   6 (drop archive-door checks; keep closed-year + Season's End + the P1 membership check), and
   prove it with `npm run check:demos`.
9. **Ledger**: retire §36/§37 with a salvage note (the awards "N this season" count fix and the
   live-hub regression checks fold into P2's new section; nothing else survives), add the P2 QA
   section (the no-toggle walk: nav shape on a finished team, Season's End landing, compare
   list for an assistant, demo tour). §39 stays — update any step P2 invalidates.
10. **Help sweep** (`/docs`): P1 fixed the dangerous staff article; P2 must sweep the rest —
    every mention of switching seasons, the archive menu, past-season doors, and the tour copy.
11. **The fixture gap closes**: add a completed season to the rendered layout fixture world so
    Season's End and the compare list finally have rendered coverage — the "nothing automated
    can see it" blindness (§36's warning) has hidden three defect rounds on this rail.

## Tests: rewritten, never deleted (the standing lesson, twice-learned)

- `coach-season-write-guard.test.ts` → the **history-endpoint guard** (plan §4): same fs-scan
  mechanism, new contract — NO route under the coach API may read a season/year parameter except
  the enumerated HISTORY_ENDPOINTS; the decided-absence blocks (drills, templates, opponents,
  club book, playing-time-PERMANENT) survive re-worded; writes still never address a past season.
- `coach-archive-season-rail.test.ts` — redistribute its keeper assertions (the stale-request
  generation-counter probes, the awards-roster scoping probe) into a live-season unit test, then
  retire the file; its season-switching assertions die with the feature. State this in the
  commit message.
- `coach-frozen-season-smoke.spec.ts` — P1 already rewrote the access probes (membership
  revocation closes everything; current-caps widening asserted AS the ruling, with real guardian
  data). P2 removes the archive-door walks/season-switcher probes and finishes the rename to a
  **membership smoke**: limbo keeps every door working, Season's End reachable, a completed
  working season draws no write controls.
- ⚠ **11 UAT spec fixtures still mint coach rows with no membership** (P1's known tail, list in
  plan §5) — every one 403s at runtime post-M1. Fix them WITH this phase (the frozen smoke's
  fixture block is the template: "M1 memberships — THE access truth").

## Traps, from this project's own scar tissue

- **Grep for expiring premises before you delete.** At least these state season-switch premises
  in words: the attendance page's `?year=` back-link comment ("a deliberate omission is only as
  durable as its reason"), the lineups/practice pages' stale-guard comments naming the season
  switcher as their trigger (the GUARDS stay — they also cover team-switch races), and
  `CLOSED_SECTION_EXTRAS`' whole reasoning. When a premise dies, rewrite the words with it.
- **Inbound links are the half that gets missed** (it bit twice on this rail): removing `?year=`
  handling from a destination invalidates every link still appending `page.query`. Sweep
  INBOUND: `seasonQueryFor`/`page.query`/`${...query}` consumers across the coach pages.
- **The working copy is SHARED.** A money-tab session is mid-flight: `lib/expense-ledger.ts`,
  `lib/timezone.ts`, the expenses routes/panel, a css `inlinePrompt` block, the money-lab half of
  `seed-qa-day-fixtures.mjs`, `tests/unit/expense-ledger.test.ts`, and two untracked
  `COACH_MONEY_*` prompt docs are THEIRS — never stage them. P1's commit hunk-staged the three
  shared files (db.ts / coaches.module.css / seed-qa-day-fixtures.mjs) by rebuilding index blobs;
  expect to do the same. Explicit pathspecs only; bracketed dirs need `:(literal)`.
- **Do not touch P3/P4.** The practice-plans shelf and the money book are OWNER-GATED behind
  per-screen mockup sessions (his explicit ruling: history must not add noise — the current
  season stays primary). Deleting the archive does NOT license building the shelves.
- **The projection invariant and the removal ordering are load-bearing** — removal deletes the
  live row FIRST then revokes; the sync converges races. Do not "simplify" the ordering, the
  strict year lookup, or the post-insert recheck away (the review's Critical/High cluster lives
  there; the memory file carries the warning).
- **Verify against guard tests and code, never plan prose** — this project's plans have been
  wrong repeatedly, and its own audit table once recommended the opposite of a standing ruling.

## Constraints

- Branch `dev`, shared. No commit/push without the owner's explicit OK in this chat.
- No schema change is expected in P2. If one seems necessary, stop and present it first.
- `npm run verify:changed` + typecheck + full unit + `check:demos` + `check:layout` (now with
  the completed-season fixture screens) before calling anything done; then `/simplify`, then the
  `/review` funnel — that order, per the workspace rule.
- Owner does browser QA; everything needing his eyes goes in the ledger section.

## What to produce

1. A short implementation-plan update inside the canonical plan (expand §5's P2 line into the
   ordered checklist you will execute), plus the PM-brief delta if the coach-visible story
   changes in any way beyond the plan's.
2. The build, gated green, with the demo re-script proven by `check:demos`.
3. The test rewrites, the CLAUDE.md replacement, ledger §36/§37 retirement + the new P2 section,
   the help sweep, and the TODO/memory truth-ups.
4. A product-owner summary: what a coach sees differently, what got deleted, what the demo now
   says, and exactly what §-walk you owe the owner.
