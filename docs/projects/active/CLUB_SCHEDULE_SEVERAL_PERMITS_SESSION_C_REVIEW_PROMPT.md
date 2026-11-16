# Session C — simplify, review and commit run (ONE chat, resumable across /clear)

Owner prompt to start or continue this run (the same words every time):

> Run the Session C review run: read `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_SESSION_C_REVIEW_PROMPT.md`
> and do the next unticked stage.

## How this run works (read every time)

- Read **Progress** below and start at the first unticked stage. Do not redo a ticked stage.
- After each stage, tick it here with ONE line: what changed, findings count, owner rulings given. Write the tick
  **before** you pause, so a /clear loses nothing.
- At a **⏸ PAUSE** marker, stop and say to the owner, exactly: *"Pause point — run /clear, then paste:"* followed by the
  owner prompt above in a code block. Also pause early (tick first, note where you stopped inside the stage) if the chat
  has already run two heavy agents or the context is getting deep.
- Product-owner voice to the owner. Never push. Never touch prod. Branch `dev` only (re-check before committing). No
  commit until Stage 4, and Stage 4 asks first.
- After any code change, re-run the **Tests** below and report pass counts. A red result is reported as red.

## What Session C is (context for every agent)

Several-permits build, Session C: **the bill priced at each permit's price, or one rate for all.** Build prompt
`docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md` (Session C, and "⚠ P9 B"); plan
`CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` §4e + **Phase 3** (the build record — read it first); drawing tab 5 (`SCR.bill` in
`CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html`); DB shape `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` **Finding #51**
(decided — do not reopen). Built 2026-11-15; commit owed. Mig 489 applied to DEV only.

**Invariants (every stage must keep them):**
1. **One price behind the time bills exactly as before, to the cent.** `priceTheBill` takes `billShares`' path when there
   is one price (or the time isn't fully priced); corrections take `sharesAtRate`'s path when every slot bills at one rate.
   Never "simplify" these two paths into the multi-price formula: the float order differs and a rounding cent would move.
2. **Terms never change.** A made bill reads from its allocations; kept rates are insert-only; the mode freezes once billed.
3. **P9 B:** a permit behind the bill keeps its kept rate; a permit NOT behind it bills at its own full price, kept from the
   send that first bills it; a bill with NO kept rates prices every slot at `bill_scale` (/dba #51 R2).
4. **Nothing re-spreads:** a gain is a new allocation with its own payments; nothing edits an existing installment, split
   or allocation (guard in `club-schedule-bill-rates.test.ts`).
5. **The app calls only the `_priced` bill steps** (the bill and its kept rates in one transaction).
6. A weight and a price come from the same permit (`Prices.priceKeyOf` mirrors `weightOf`'s fallback).
7. Money stays with money readers: `pricing`, `bill`, the Send window's `newPrices` are stripped for anyone else.

**C's files:**
- New: `supabase/migrations/489_a_bill_keeps_each_permits_rate.sql`, `tests/sql/bill-rates-fixture.sql`,
  `tests/unit/club-schedule-bill-several-permits.test.ts`, `tests/unit/club-schedule-bill-rates.test.ts`, this prompt file.
- lib: `club-schedule-bill.ts`, `club-schedule-server.ts`, `club-schedule-send.ts`, `club-schedule-coach.ts`,
  `club-schedule-document.ts`, `club-schedule-view.ts`, `club-schedule-words.ts`, `club-draft-bill-server.ts`.
- app/components: `app/api/admin/schedules/[scheduleId]/route.ts`, `app/api/admin/schedules/[scheduleId]/send/route.ts`,
  `components/admin/kit/club/schedules/{BillWindow.tsx,SendWindow.tsx,FairShares.tsx}`, `components/coaches/ClubReviewCard.tsx`.
- tests moved: `club-scheduler-guard`, `club-stage13d-money-handoff`, `club-stage13d-time-handoff`, `club-stage6a-guard`,
  `club-schedule-overview`, `club-schedule-view` (`.test.ts`).
- records: `docs/agents/db/DATA_DICTIONARY.md`, `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` (Finding #51 only), the
  `docs/agents/db/schema-snapshots/*` files + `memory/reference_db_schema.md` (generated whole),
  `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` (Phase 3).
- ⚠ **Shared files with OTHER sessions' hunks — stage C's hunk only:** `supabase/migrations/MANUAL_PROD_STEPS.json` (C's is
  the **489 entry** and the comma before it; ~40 other hunks are another session's prod notes) and `TODO.md` (C's is the
  several-permits line only; a nearby added line is another session's). Use the partial-commit method
  (`reference_partial_commit_shared_tree.md` in auto-memory: temp index, exact hunks, CAS update-ref).

**NOT C's — never edit, never stage:** anything else in `git status` (notification-rows, release-hardening, legal, house
league, help-content, memory-guard, layout scripts, `.probe-edit.cjs`, `debug.log`). Two unit failures are other sessions'
(SeasonFrame's list-only mark in `club-accounting-teams-guard`, ClubHub's tournament link in `club-stage13a-doors-guard`):
report them, don't fix them here.

**Tests** (run after any code change):
```
node --import ./tests/ts-resolver.mjs --test tests/unit/club-*.test.ts tests/unit/permit-*.test.ts   # expect only the 2 known foreign failures
node scripts/db-query.mjs --dev -f tests/sql/bill-rates-fixture.sql      # expects BILL RATES FIXTURE OK: 6/6
npx tsc --noEmit -p .                                                   # only the known layout-run-journal error (not C's)
npm run lint:focused -- <changed files>
npm run check:spelling
```

## Stages

### Stage 1 · /simplify
Run `/simplify` on C's diff only (the files above). Targets worth a look: the new pure pieces in `club-schedule-bill.ts`
(`priceTheBill`, `keptRateOf`, `uniformRate`, `sharesAtRates`, `pricedValues`, `pricedMinutesByPermit`); `schedulePricing`
and `readKeptRates` / `readBillTerms` in the server; the hand-back measure in the send (`withHandedBack` now returns minutes,
values and the one rate); the printed notes' `slotHours` (does it duplicate `pricingHourOf` / `priceTheBill`?); the Bill
window's `keptWords` and one-rate hint. **Respect invariant 1**: the two single-price paths stay. Apply what holds, re-run
the Tests, tick.

### Stage 2 · /review
Run `/review` on C's diff (after Stage 1). Point it at the Invariants and at the build prompt's "Stop and report" list (a
reader that changes a number a sent schedule already shows is a defect). Ask it specifically: the late-bill baseline at
kept rates; a hand-back on a since-removed slot; a permit deleted after billing (SET NULL → no-permit rate); the In-review
rule (a mode change while In review follows any bill change); the money strip on the send GET. Apply confirmed findings,
re-run the Tests, tick. **⏸ PAUSE** if both agents ran heavy.

### Stage 3 · Owner call (ask in-chat, record the answer in plan Phase 3)
"On a bill where the club covers part of the cost, time on a permit added later bills at that permit's FULL price (the
build's default). Keep that, or carry the same percentage forward?" If he changes it: the fresh rate in `keptRateOf` takes
the bill's factor (total ÷ time price), the arithmetic test's P9 B case gains a part bill, and the Send window's line says
so. Tick with his answer.

### Stage 4 · Commit (ask first)
1. `git rev-parse --abbrev-ref HEAD` is `dev`; `git status` re-read (files move).
2. Show the owner the exact file list and the one-line message; wait for yes.
3. Stage explicit pathspecs; the two shared files by hunk (above). Commit message, product voice, e.g.
   `Several permits, Session C: the bill prices each permit's time at its own price, or one rate for all` + attribution line.
4. `git show --stat HEAD`: only C's files. Foreign file slipped in → `git reset --soft HEAD~1`, unstage it, re-commit.
5. Second small commit: the hash into plan Phase 3 ("commit owed" → "committed `<hash>` 2026-11-1x"), the TODO line, and
   auto-memory `project_schedule_several_permits.md` + its MEMORY.md line. Never push. Tick.

### Stage 5 · Close the run
Tell the owner, product voice: what was simplified, what the review found and fixed, the commit hashes, and what's still
owed — dev-server restart + his browser pass (a two-permit schedule: Price the time, captions by permit, Fair shares
columns; a one-permit schedule unchanged), /marketing for the new sentences at the Close, the P9 B test through the real
Send path in Session E, and next **Session D** in a fresh chat. Tick.

## Progress
- [x] Stage 1 · /simplify — 4 reviewers (reuse/simplify/efficiency/altitude), ~55 raw findings; applied the safe ones: one `DEFAULT_PRICE_MODE`/`PRICE_MODES`/`PriceMode` (was copied in 6 files), `hourOfScale` beside `scaleOfHour` (2 hand-copies), `pricedMinutes` shares `eachTeamsMinutes`, `teamInstallments` filters the team's slots once, Bill window reuses `timeBill` when the whole time is billed, dropped orphans (`billWholeTime`, `BillView.multiPrice`), renamed a shadowed local in `slotHours`. Single-price paths untouched. Tried a concurrent read in the send preview — reverted (a guard pins that line). Tests: 2735/2737 (the 2 known foreign failures), tsc = only the layout-journal error, lint + spelling clean. **Skipped, carried to Stage 2 / owner:** (a) "more than one price" decided 5 ways (`timeBill.multiPrice`, `permits.length>1`, the doc's `slotHours`, `billViewOf`) — a Fair-shares/copy mismatch is possible when two permits share one price; (b) printed notes' `slotHours` re-derives the one rate over every slot with a team, while `priceTheBill` drops house-league/zero-minute teams — the printed rate could differ from the bill's; (c) bigger reshapes (words out of BillWindow, `keptRateOf` taking a permit id, one rates reader, `priceTheBill` taking `priced`) left alone — behaviour-neutral but wide.
- [x] Stage 2 · /review — high-risk tier, 4 lenses (arithmetic, data/migration, money-strip/security, regression/consistency), ~30 raw findings, 0 Critical. Money strip on the send GET, the In-review mode rule, the `_priced` steps, insert-only use, late-bill baseline at kept rates: all held. **FIXED (6):** (1) Bill window dead end — one permit priced + another unpriced left no amount field to type in (now forces "a part"); (2) house-league-only time on a never-billed permit earned it a spurious kept rate + "billed at its own price" line and knocked a one-rate bill off the exact single-rate path (`keptRateOf`/`uniformRate` now skip it); (3) a $0 permit beside a priced one would have failed Finalize on the `scale > 0` check (now "not wholly priced" → type an amount); (4) printed notes' rate counted house-league slots, so the sheet's rate could differ from the bill's (`slotHours` now bill-only); (5) the wrong blocker message when one permit has no price (now "type what the teams pay"); (6) amount field regained its full width on a one-permit schedule; plus a stale tab can no longer reset a saved Price-the-time choice. +2 tests, 1 guard regex moved. Tests 2735/2737 (the 2 foreign), fixture 6/6, tsc = layout-journal only, lint + spelling clean. **CARRIED, not fixed (owner/design calls):** (a) two permits at ONE price still show multi-permit copy (Fair-shares "Hours · A/B", "the permits' prices", printed "the permit") — "more than one price" is still decided 5 ways; (b) a permit DELETED after billing: its slots fall to the price permit's kept rate (phantom credit on the next correction) — `schedulesHandingOut` in `permit-server.ts` (not C's file) could refuse deleting a permit with kept rates; (c) a hand-back on a since-removed slot is valued at the bill's average, not the permit's rate; (d) kept rates are written even when "Bill the corrections" is off; (e) legacy multi-permit bills backfilled by 489 read as "each permit"; (f) the DB doesn't enforce insert-only (unit guard only); `_put` accepts a null permit; (g) the SQL fixture covers refusal paths only — no successful `finalize_priced`/`bill_late_priced` row read-back; (h) 1-cent float edge when a typed amount exceeds the time price; (i) a builder without money access can send a change that bills a new permit unseen (pre-existing design). Run was heavy (4 agents) — paused here.
- [x] Stage 3 · Owner call — **KEEP FULL PRICE** (no code change; Tests not re-run, nothing changed). Owner also raised per-permit billing conditions inside one schedule; logged in plan Phase 3 as a follow-up in three levels (per-permit covered share · a no-charge permit · different payers per permit = the big one, own design session). Nothing built.
- [x] Stage 4 · Commit — owner said yes, no footer. `3ee39edaa` (38 files, C only; shared files by hunk, only the 489 entry and the several-permits TODO line); second small commit carries the hash into plan Phase 3, the TODO line and memory. Not pushed.
- [ ] Stage 5 · Close
