# Build prompt — drop the payables rebuild's dead columns, and close out the owed payables QA

**Owner-directed 2026-08-28.** Two jobs, one session: (1) the cleanup migration that mig 255's own
header deferred — dropping the legacy deposit/balance/paid columns on `rep_team_expenses` that
nothing writes any more — and (2) recording the owner's closure of the remaining owed payables QA
items in the Owner QA Ledger. Read this whole prompt before touching anything.

## Context you must not re-derive

- The Payables Rebuild (plan: `COACH_PAYABLES_REBUILD_PLAN.md`) moved every commitment to real
  **installments + payments** (mig 255). Since then **nothing writes the legacy
  deposit/balance/paid columns**; the one legacy column still written is **`amount`**, deliberately
  kept equal to the sum of the installments (the plan's R2 rule). `amount` is NOT in scope — do not
  touch it.
- Mig 255's header says explicitly: *"THE OLD COLUMNS ARE NOT DROPPED HERE … Dropping them is a
  LATER migration, once the drift check proves nothing reads them."* This session is that later
  migration. The owner made the call on 2026-08-28.
- **Decide column existence from the committed schema snapshots / live `information_schema`, never
  from migration files** (AGENCY_RULES — a drifted DB makes migration files lie).

## Scope — exactly these candidates, on exactly one table

On **`rep_team_expenses`** only:

| column | expected state |
|---|---|
| `deposit_amount` | dead — plan halves live in installment rows since mig 255 |
| `deposit_due_date` | dead |
| `deposit_paid_at` | dead |
| `balance_amount` | dead |
| `balance_due_date` | dead |
| `balance_paid_at` | dead |
| `deposit_entry_id` | dead — mig 255 carried the ledger-entry link onto the payment rows |
| `balance_entry_id` | dead — same |
| `expense_paid_at` | dead — mig 255's header names it with the deposit/balance set; **verify hardest**, it predates the split |

⚠⚠ **OUT OF SCOPE — do not touch, they are live tournament-side features that merely share the
words:** `divisions.deposit_amount` / `deposit_due_date`, `tournaments.deposit_amount` /
`deposit_due_date`, `teams.deposit_paid`. A grep for `deposit_` hits ~24 files and MOST are the
tournament registration feature. Filter every hit by table before believing it.

## Job 1 — the drop

1. **Prove each candidate dead before dropping it.** Sweep `app/ lib/ components/ scripts/ tests/`
   for each column name AND its camelCase twin (`depositAmount`, `expensePaidAt`, …), attributing
   every hit to its table. Known places the coach-side names still appear and will need code
   deletions in the same unit of work: `lib/db.ts` (row mapping), `lib/types.ts` (type fields),
   `scripts/seed-qa-day-fixtures.mjs`, `scripts/lib/seed-commitment-records.mjs`,
   `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts`, `tests/unit/money-one-arithmetic-guard.test.ts`.
   ⚠ Count your grep results before believing a sweep is exhaustive (a truncated sweep shipped a
   real defect in the sponsorships work). If ANY candidate still has a live reader, drop it from the
   migration and record why — a partial drop that is honest beats a complete one that breaks a
   reader.
2. **One new migration** dropping the proven-dead columns. Dropping `deposit_entry_id` /
   `balance_entry_id` takes their FK constraints and the partial index
   `idx_rep_team_expenses_deposit_entry` with them — name this in the migration comment so the
   index's disappearance from the snapshot is explained. Never edit mig 255 itself — applied
   migrations are history.
3. **Apply to dev**, then the schema-is-dictionary rule in the SAME unit of work: refresh the
   snapshots (`npm run refresh:snapshots`), update `docs/agents/db/DATA_DICTIONARY.md`, and make
   sure `npm run check:dictionary` passes. Commit the snapshot refresh WITH the migration — a
   migration isn't done until the refresh is committed (release-history lesson).
4. **Delete the dead code paths** the sweep found (type fields, row-mapping lines, fixture seeds
   still stuffing the columns). Expect the typed row shape to shrink; run `npx next typegen` then
   `npm run typecheck` since `lib/db.ts` / `lib/types.ts` are shared modules.
5. **Prod sequencing — verify, don't assume.** Before this migration is ever applied to prod,
   confirm from the release history (`memory/reference_prod_release_history.md` + the Owner QA
   Ledger) that the prod BUILD already contains the rebuild code that stopped writing these columns
   (mig 255 era). Dropping a column that deployed code still reads is the migration-040 failure
   mode (500s on every coach money screen). Record in the migration header: "prod-safe only at or
   after the release carrying the Payables Rebuild." Do NOT apply to prod in this session unless
   the owner asks; leave the queue state recorded positively ("applied to dev <date>") per the
   anti-drift wording rule.
6. **Verification:** `npm run verify:changed` (reseed the UAT fixture first if seeds changed),
   plus `check:register` / `check:money-report` — the money guards that walk the rebuilt books.
   No UI changes are expected from this session; if a screen changes, something read a "dead"
   column and step 1 failed — stop and re-verify rather than patching forward.

## Job 2 — the QA ledger closures (owner direction 2026-08-28)

The ledger is strict that **"complete" and "walked" are different facts** — record these as
*closed by owner direction 2026-08-28*, never as passed walks:

- **§64** is already **closed by owner (2026-08-21)**; Parts F/G/H were closed unwalked and
  restated as **pre-release checks** in the rebuild plan's release section. **Leave that
  restatement alone** — it is the release checklist's item now, and Part H (demo story + help
  wording re-read) matters at the moment the rebuild ships to prod regardless of today's closure.
  Nothing to change in §64 beyond confirming its state is recorded as above.
- **§114** passed 2026-08-28 except the **Part G residue**: two phone checks §117's walk did not
  cover (the six editable fields are pressable at 390px; the save strip stays at the foot). Mark
  that residue **closed by owner direction 2026-08-28** in §114's note (keep the note's existing
  precision about what §117 did and did not cover — amend, don't rewrite).
- Update the tracking around it in the same commit: the rebuild plan's status lines,
  `TODO.md` (mark the cleanup item complete when done), and the in-repo memory files that carry
  "§64 E–H owed / §114 owed" claims (`memory/` — and update `memory/MEMORY.md` in the same change,
  per AGENCY_RULES; that index has drifted before).

## Conventions (standing, non-negotiable)

- Branch `dev`; re-check the branch before committing (shared working copy). Stage **explicit
  pathspecs only**; `git show --stat HEAD` after committing to confirm only your files landed.
  ⚠ Bracketed dirs (`[teamId]`) need the git bracket-pathspec workaround if any panel file is
  touched.
- No push without the owner's confirmation.
- This is schema + dead-code deletion with **no customer-visible change** — no new QA section, no
  help-docs or demo work expected. If that stops being true mid-session, stop and say so.
