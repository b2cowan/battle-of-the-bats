# Coach Sponsorship Lifecycle — arrivals, the record page, and the guards

**Status: owner-ruled 2026-08-28. Phase A BUILT on dev 2026-08-28 — ✅ OWNER QA §118 PASSED
2026-08-28 (18/18 after the A2 fix, the /review fixes, and the owner-ruled dead-Save on
foreseeable refusals; uncommitted at time of writing; no migration): the payout floor pre-flights all four sponsor shrink paths via the new shared
guard module (`lib/dues-credit-guards.ts` — the per-credit route now imports the same sentence),
the dues drawer stops offering the delete the server refuses and surfaces refusals it does show,
and the pledge-flip hint names the at-risk dollars via `sponsorCreditExposure` on the record
read. 12 new unit tests (`tests/unit/sponsor-credit-floor.test.ts`); full suite 2,679 green;
typecheck clean. ⚠ The UAT lifecycle spec's paid-out case is still OWED (Phase A item, needs the
Playwright fixture session). Phases B–E not started.**
Born from the money-forms review planning session (2026-08-28) — the first walked workflow.
Rulings artifact: `claude.ai/code/artifact/4916c9ae-68c9-42e1-9a54-0aba40c30fe0` (§1, the
sponsorship deep dive; owner ruled all ten questions the same day). PM brief:
`COACH_SPONSORSHIP_LIFECYCLE_PM_BRIEF.md`.

**Parent context:** sponsorships shipped 2026-08-15 (`COACH_SPONSORSHIPS_PLAN.md`, mig 237/239,
QA §24 + §30) on the model *a sponsor = one record + exactly one entry*. This project keeps every
08-15 ruling that still stands (individual rows, no campaign grouping; pledged posts nothing;
credit stores dollars, percent is provenance; realised-only readers) and **supersedes exactly two
things**: the one-entry cap (arrivals replace it — ruling Q12) and the "no drill-in screen" ruling
(the record page replaces the thin screen — ruling Q11; the owner's original intent, a screen that
doesn't restate the row, is what the record page finally honours).

---

## 1 · The rulings this build executes (owner, 2026-08-28 — all binding)

| # | Ruling |
|---|---|
| Q1 | Modal titled **"New fundraiser or sponsor"** (static). |
| Q2 | Kind question reads **"Which kind?"** — frees "What is this?" for the conversation's filing question. |
| Q3 | Status default **stays Received**. (No change — closes the docs-said-Pledged discrepancy.) |
| Q7 | The conversation's pledge refusal becomes a **carrying door** — opens the New-sponsor modal with name, amount, Pledged carried. |
| Q11 | **Option B — the record page.** Clicking a sponsor row opens the sponsor's story, not the thin card screen. |
| Q12 | **Arrivals.** One sponsor row; each cheque recorded against it with its own date and method. |
| Q13 | **Expected-by date** on a pledge — optional, one plain past-due sentence on the list and the overview row. |
| Q14 | **Guarded delete** — commitment-pattern confirmation named in dollars, refused while a paid-out credit depends on it. |
| Q15 | Export splits **Received / Pledged** columns. |
| Q16 | **Multi-family credit** — repeating family rows, $ or % each, live per-family dollars, capped at the amount, on **both** doors. |

Findings register (SP-1…SP-12, F-1…F-5, F-9) lives in the artifact §1.2; this plan cites them.

## 2 · The decided model, in one place

- **A sponsor is one row** (`rep_fundraisers`, `kind='sponsor'`): name, notes, status
  (pledged/received), expected-by (new, Q13), tags, and a **credit plan** — the list of families
  and their $-or-% shares (Q16).
- **An arrival is one entry** (`rep_fundraiser_entries`): amount, `received_date`, method (new
  column — see §4), notes, its own `accounting_entries` income row **dated the arrival's date**
  (closes SP-2), and its slice of each family's credit.
- **Pledged vs received becomes derived truth**: a sponsor with arrivals is (part-)received; the
  promise figure is the sponsor's pledged amount; "still to come" = pledged − arrived. The stored
  `sponsor_status` remains the coarse switch the readers key on (a sponsor with ≥1 arrival is
  `received`); flipping to pledged requires zero arrivals (see §5 delete/undo).
- **Credits accrue per arrival, proportionally** (the drives' own per-entry model): an arrival of
  $250 against a $500 sponsor with a 15%-to-Riley plan writes Riley's `rep_dues_credits` row(s)
  worth $37.50, `fundraiser_entry_id` pointing at that arrival. A pledge still credits nobody.
  Rounding: per-arrival shares round to cents; the **final** arrival takes the remainder so the
  summed credit equals the plan exactly.
- **`rep_fundraiser_entries.credit_id` (1:1) is retired from the write path** — the credit→entry
  direction (`rep_dues_credits.fundraiser_entry_id`) is the only link arrivals use. Do not drop
  the column in this project; stop writing it (note in DATA_DICTIONARY).

## 3 · Phases, in build order

### Phase A — Safety first (no schema, no rulings consumed) — SP-1, SP-4
1. **The paid-out floor on the sponsor write path.** Extract the payout-ceiling check the
   per-credit route already has (`players/[playerId]/dues-credits/[creditId]/route.ts`,
   `payoutCeilingRefusal`) into `lib/dues-credits.ts` (or sibling) and call it in
   `applySponsorMoney` before ANY credit shrink/delete — amount edits, family removal, credit
   changes, flip-to-pledged. Refusal wording is payables' own sentence, per family:
   *"$X of {family}'s credit has already been handed back in cash. This change would take away a
   credit the team has already paid out. Undo that payout first, then try this again."* (409,
   pre-flight, before any write — the payables lesson: a guard after an irreversible write strands
   the record.)
2. **Surface or suppress the swallowed refusal (SP-4).** In the dues drawer, suppress edit/delete
   on `fundraiserEntryId`-sourced credits exactly as `paymentId`-sourced ones are suppressed, with
   the source stated ("From a sponsor — edit it there"). `deleteCredit` learns to check `res.ok`
   and surface the server's message regardless (defense in depth).
3. **The flip warning names dollars** when payouts/consumption exist: the sheet fetches the credit
   position on open and the pledge-flip hint upgrades from the static sentence to e.g. *"$40 of
   Riley's credit has already been handed back in cash — flipping to a pledge is refused until
   that payout is undone."*
   Tests: unit — guard refuses on paid-out, allows on clean; UAT lifecycle spec gains the case.

### Phase B — Arrivals (Q12) + the cheque's day (SP-2, F-3) + multi-family credits (Q16)
The core rework, one unit because they share the writer:
1. **Writer**: sponsor create with Received = create sponsor + first arrival (amount, **date
   received** — required, capped at today — method, optional). Sponsor create with Pledged =
   sponsor row only, pledged amount, expected-by (Q13 field, may ship in D if sequencing needs).
   New arrivals endpoint: the existing per-player entries POST currently *refuses* sponsors —
   replace that refusal with a sponsor-arrival branch (or dedicated route) enforcing:
   arrival date required ≤ today; arrivals sum may exceed pledge only with the stated
   over-pledge consequence; each arrival posts its own dated income row
   (`Sponsorship — {name}`); credits per §2. ⚠ Re-read the 08-15 lessons before touching
   readers: `isRealisedRecord()`/`getRealisedFundraiserEntries()` stay the only pledge gate;
   `normalizeBudgetLineKind()`/`isFundingKind()` the only kind reads.
2. **Credit plan (Q16)**: `rep_fundraiser_credit_plan` (new table: fundraiser_id, player_id,
   share_value, share_unit $|%) or JSON on the sponsor row — prefer the table (queryable, FK'd,
   season-scoped via the fundraiser; ⚠ season-scoped-lookup guard derives coverage from the
   schema snapshot — the new table joins it automatically, verify it does). Validation: shares
   sum ≤ amount at current pledge; per-family $ or %.
3. **Both doors (SP-9 parity)**: the New modal and the conversation's sponsor branch get the same
   controls — Date received, method, the repeating credit-family rows, and Tags on the
   conversation branch (closing SP-9). The conversation branch stays received-only; its refusal
   for pledges becomes the Q7 carrying door (Phase E).
4. **Consequence lines (F-3)**: modal + conversation state the dated dollar sentence:
   *"When you save: $500 arrives on Jul 12 — shows on the ledger as sponsorship income. Riley's
   family earns $50 off dues and Avery's family $25 — the team keeps $425."* Pledged keeps its
   existing sentence.
   Migrations: credit-plan table + `rep_fundraiser_entries.method` (if absent) + expected_by
   (§Phase D) — batch them sensibly; **dictionary + snapshot refresh in the same unit of work.**

### Phase C — The record page (Q11 B)
Clicking a sponsor row opens the sponsor's story (replacing the thin drill-in rendering for
sponsors — drives keep their leaderboard page untouched):
- The promise line (pledged date · expected-by · pledged amount), each arrival (date · amount ·
  method · undo per the guard), the credit line per family, "still to come" when part-paid.
- Actions: **Record** (opens the conversation pre-answered & locked to this sponsor — an arrival),
  **Settings** (the sheet — renamed **"Sponsor settings"**, F-4, and it regains the per-family
  credit preview, F-5), **Delete** (Phase D).
- Read-only assistants get the story with values, no controls (the CommitmentView pattern).
- ⚠ The UAT sweep opens screens by kind (`coach-sponsor` swept screen) — update it, and the
  lifecycle spec, to the record page. ⚠ `check:layout` renders pages — the new page needs a
  seeded sponsor WITH arrivals in the fixture or it sweeps an empty state (the green-check-over-
  empty-fixture trap).

### Phase D — Chase, delete, paper (Q13, Q14, Q15) + words
- **Q13**: `expected_by` date on pledge forms (optional); once past: one plain sentence on the
  list row, the record page, and the overview Sponsorships row ("… · $2,000 pledged, 1 past its
  expected date"). No emails, no notifications.
- **Q14**: DELETE routes for sponsor (and drive — same door, same pattern) with the commitment-
  pattern confirmation named in dollars from the same arithmetic the reversal uses ("This posted
  $500 across 2 arrivals… deleting reverses it; Riley's family's $75 credit is removed too"),
  refused by the Phase-A floor while a paid-out credit depends on it.
- **Q15**: export gains Received / Pledged columns (drop the single "Total raised"); one row per
  sponsor still (credited families joined in one column), scope label unchanged.
- **Words (one commit)**: Q1 title, Q2 "Which kind?", F-4 "Fundraiser settings"/"Sponsor
  settings", SP-8 the dues chip reads "Sponsorship" **display-only — derived from the credit's
  source, NEVER a new `credit_type` member** (the 08-15 enum lesson: a third member broke 19
  readers), SP-10 register description "Sponsorship — {name}".

### Phase E — The pledge door (Q7)
The conversation's sponsor-branch pledge hint becomes a carrying door: opens the New-sponsor modal
with name, amount and Pledged pre-filled, typed values carried (⚠ the P2 lesson: payee+tags were
once dropped from the future-date carry — enumerate the carried fields in a test).

## 4 · Schema summary
- `rep_fundraiser_credit_plan` (new; Phase B) — the multi-family shares.
- `rep_fundraiser_entries.method` (new column if not present; Phase B).
- `rep_fundraisers.expected_by` (new column; Phase D).
- No changes to `rep_dues_credits` (reuse `credit_type='fundraiser'` — display label only).
- `rep_fundraiser_entries.credit_id` retired from writes, kept in place.
Every migration: DATA_DICTIONARY + `npm run refresh:snapshots` in the same unit of work.

## 5 · Standing rules & traps this build must honour
- **Realised-only readers** (hub headline, BvA actual, settlement pot) — pinned by test; arrivals
  must flow through `getRealisedFundraiserEntries` untouched in meaning.
- **No new enum members** for credit types or line kinds. Display labels only.
- **Pre-flight guards, never post-write** (the P4 lesson).
- **Demo sandboxes**: the coach demo's sponsor is club-wide by construction and the tour narrates
  the money screens — re-read the coach-money dock lines/tour steps in the same unit of work
  (CLAUDE.md standing rule; this surface has gone stale three releases running).
- **Help docs**: sponsor/fundraising articles must follow the new vocabulary and arrivals story —
  offer `/docs` at the end of the build.
- **UAT**: `coach-sponsor-money-lifecycle.spec.ts` walks pledged→received→back through three
  readers — it must gain arrivals, and actually RUN (the unexecuted-test lesson).
- Owner QA: new ledger § on completion; built-ahead-of-QA is accepted practice (owner 2026-08-17).

## 6 · Explicitly out of scope
Sponsor contact/company fields, thank-you or renewal tracking (ideas backlog); drive-side findings
(F-7, F-8, Q6 — the fundraisers walk); the unruled review questions (Q4, Q5, Q8, Q9, Q10 — later
walks); everything in the review's do-not list (Payables fold, one-taps, tags/paid-by rulings,
phone money tables, undo-rollover).
