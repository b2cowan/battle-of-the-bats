# Kickoff prompt — a dues payment is not a record in this product (paste into a fresh chat)

The coach portal can say what a player **owes** and when. It cannot say what a player **paid**, or
when, or how much. Those are the same fact today, and that single conflation is the root of a family
of defects a treasurer meets in their first season. **This starts at inventory, not at build.**

## The trigger, in the owner's words

Working through the Generate Installments redesign, 2026-08-13:

> *"How do we manage players paying installments not in the installment amounts (i.e. we set
> installments to $300 per quarter and a player decides to pay $100 per month instead), how is this
> managed?"*

And, immediately before it, the same root cause from the other end:

> *"Aren't dues and payments separate (i.e. budget vs. actual)? If I budget dues of $1000 each and a
> player has paid $500, I should be able to update the dues to $1200 and just leave the payment there
> as is, the net difference would just change to $700 remaining."*

The answer to the first is **it isn't managed — there is no way to record it.** The answer to the
second is **no, they are not separate, and that is the bug.**

## The current model, verified — do not re-derive this, but DO re-verify before you change it

These were read out of the live code and the data dictionary on 2026-08-13. Treat them as the
starting map, and confirm each against the code before you build on it.

1. **Marking an installment paid takes no amount.** It is a single action on one installment. It
   stamps the installment as paid, and posts an income entry to the team ledger **for that
   installment's full amount**, categorised "Player Dues". It refuses if the installment is already
   paid. There is no way to say "$100 of the $300 arrived".
2. **The paid flag is the receipt.** The installment row is simultaneously the bill and the proof of
   payment, and it carries the back-link to its ledger entry. This is why the bulk-dues flow must
   skip players who have paid anything — replacing their schedule would delete the receipt and orphan
   a real ledger entry. That defect was found and fixed on 2026-08-13; do not reintroduce it.
3. **The ledger entry is dated the day the coach recorded it**, in the org's timezone — not the day
   the money arrived. A coach catching up on a month of e-transfers posts them all to today.
4. **Credits are not payments and post nothing to the ledger.** `rep_dues_credits`
   (contribution / fundraiser / overpayment / other) reduces a balance and writes no income entry.
   Using a credit to stand in for a part-payment therefore loses the money from the team's books
   entirely — and it is the workaround that looks like it works.
5. **There are TWO balance figures and they deliberately disagree.** "Outstanding" = schedule total
   less paid installments, credits **excluded**. "Rolling balance" subtracts credits too. Both are on
   the Player Dues table, separately labelled. `lib/dues-status.ts` is the single home for the
   outstanding definition and the status word (Not set / In credit / Fully paid / Partial / Unpaid);
   three surfaces used to compute it inline and drifted.
6. **A player paying faithfully is invisible.** With no installment marked paid, the shared
   "never paid anything" predicate counts them — so they appear in the team Overview's unpaid badge
   and in the "Haven't paid anything yet" panel, they read as overdue, and **the 30-day and 7-day
   reminder waves chase them for the full amount.** Families being dunned for money they are sending
   is the sharpest customer-facing edge of this.

## Read first (in this order)

1. `docs/agents/db/DATA_DICTIONARY.md` — `rep_player_dues_schedules`, `rep_player_dues_installments`,
   `rep_dues_credits`, and the accounting-entry tables they link to. **Read the gotchas at the head of
   each; they are where the real behaviour lives.**
2. `lib/dues-status.ts` — the one definition of outstanding, overdue, the status word, and
   "never paid". Every surface in the inventory below is supposed to be reading it.
3. `memory/design_decisions.md` — newest first. The 2026-08-12 funding ruling matters here: a
   fundraiser rebate lowers *that player's* dues, which is why rebates are credits and why counting
   them as income would lower the same dues twice.
4. `docs/projects/active/OWNER_QA_LEDGER.md` §12 (Group 1C, Money) — what is already awaiting QA on
   these screens, so you do not tangle with it.
5. The Player Dues screen itself, in a browser, on a team with real dues, part-paid and unpaid —
   before reading its code.

## The work

**Phase A — inventory (do this first, and show it before proposing anything).**

Every surface that quotes a dues figure, and **which of the two balances it quotes**. The list to
start from, to be confirmed and extended rather than trusted:

- Player Dues — the roster table and the per-player drawer (schedule, installments, credits)
- Team Overview — the unpaid badge, and the "Haven't paid anything yet" panel
- Budget vs. Actual — the dues-collection card, and the money-in half of the month grid's cash-flow
  strip (scheduled by due date, actual by paid date)
- The Money hub summary tiles, and the upcoming-payables panel
- The three reminder paths — ad-hoc "send reminders now", 30-day and 7-day automated waves
- The weekly insights digest email, and Ask the Front Office
- The Player dues export offered from the Money hub's Export menu
- Season's End / season surplus, which divides remaining funds after individual credits
- The team ledger itself — what a dues income entry says, when it says it happened
- **Anything family-facing** — check whether a guardian sees a dues figure, and which one

For each, record: which figure, where it comes from, and **what it would say today about a player
paying $100 a month against $300 quarterly installments.** That last column is the argument.

**Phase B — the model, drawn before it is built.**

The proposition to test: **an installment is a plan (what is due, when); a payment is a fact (what
arrived, when, how much).** Separating them resolves part payments, changing dues after someone has
paid, overpayment, the ledger date, and the reminder problem, all at once.

Draw it. Mockups are the spec in this repo and go to Claude Artifacts — the last several decisions on
these screens were each made from a render, and two of them reversed a decision made from prose. At
minimum: recording a payment, a part-paid player in the dues table and in their drawer, what the
coach sees when a payment overshoots, and what the schedule looks like when dues change after a
payment exists.

**Phase C — build in passes**, each independently shippable, with the rendered sweep between them.

## Blocking decisions — surface these, do not decide them alone

1. **A payment record, or a part-paid amount on the installment?** The second is smaller and
   re-derives the first badly the moment two part-payments land on one installment. Make the case
   either way, with the migration cost of each.
2. **What happens to every dues installment already marked paid in production**, on both databases —
   migrated into payments, or left as legacy the new code must keep reading?
3. **Does the ledger entry take the date the money actually arrived** (typed by the coach) instead of
   the day they recorded it? This is the fix that makes Budget vs. Actual's month grid honest, and it
   changes historical reporting.
4. **Do credits stay credits?** The fundraiser rebate path depends on it, under a standing ruling.
5. **Does an overpayment become a credit automatically, or does the coach decide?** There is already
   an `overpayment` credit type, and an "In credit" status.
6. **What do the reminder waves chase** once a balance can be partly paid — the remaining balance, or
   the overdue installment as today?

## Two open items from the originating conversation that land in this project

- **Changing dues after a payment exists.** Agreed in principle 2026-08-13, not built: on a bulk
  re-run, *keep the paid installments exactly as they are* and rewrite only the unpaid ones so the new
  total lands correctly — rather than skipping the player entirely as the shipped flow does. Two
  sub-decisions open: how the remaining balance spreads across the new dates, and what happens when
  the player has already paid more than the new total.
- **The Generate Installments basis picker is a SEPARATE, parallel project** and does not block this
  one. It is about *setting* what is owed; this is about *collecting* it. Its plan and mockup:
  `COACH_INSTALLMENT_BASIS_MOCKUP.html` /
  `claude.ai/code/artifact/1177bcf0-1103-41e9-891f-cb39c063bbd4`. Coordinate on the paid-player rule
  above and nothing else.

## The traps, stated so you don't rediscover them

- ⚠ **Never delete or silently rewrite a posted ledger entry.** It is the team's audit trail. The
  bulk-dues flow already destroyed paid installments *with their accounting entries* once; that cost
  a Critical in review and a same-day fix.
- ⚠ **"Today", "overdue" and any month bucket are ORG-timezone questions** (`lib/timezone.ts`).
  Production runs UTC and rolls over around 8 PM Toronto; the runtime's date flags things a day early.
- ⚠ **Dues move money, so this stays live-season-only.** Per the binding archive rule in `CLAUDE.md`,
  nothing here joins `APPROVED_ARCHIVE_DOORS` or `APPROVED_SEASON_AWARE_ROUTES` — and the build fails
  if you add to either without the decision being made deliberately.
- ⚠ **Any migration updates `docs/agents/db/DATA_DICTIONARY.md` in the same unit of work** and
  refreshes both snapshots (`npm run refresh:snapshots`). `npm run check:dictionary` enforces it.
  Decide whether a column exists from the snapshots or live `information_schema` — **never from
  migration files**, which mislead in a drifted database.
- ⚠ **`npm run check:layout` aborts on memory on this machine.** Run it sliced —
  `--only=coach-accounting,coach-dues,coach-budget-vs-actual`. **An aborted sweep exits 0 through a
  pipe — read the output, never the exit code.** Never lower `DEV_FREE_FLOOR_MB`.
- ⚠ **Anything drawn beside every row is drawn as many times as the list is long.** A roster is 15–20
  players and each has several installments. Multiply before adding a per-row control.
- ⚠ **Money panels stay mounted** (`display:none` while inactive) so a half-filled form survives a tab
  switch. Nothing here may remount a panel — and any modal it renders must be given the caller's
  `tabActive`, or its unsaved-changes guard arms a document-level click interceptor across the whole
  app. This repo has paid for that once already.
- ⚠ **Colour and contrast are guarded** (`check:tokens`, `check:contrast`, `check:text-contrast`). No
  raw hex; the third text tier is the white-alpha ladder capped at /50. `composes` is **not**
  transitive under Turbopack.
- ⚠ **A parallel project is restyling every money table** (`COACH_MONEY_TABLE_CONSISTENCY_PLAN.md`),
  in execution as of 2026-08-13. Anything you add to the Player Dues table must land on its shared
  number cell and column-heading recipe rather than inventing a treatment — check the state of that
  work before styling anything.

## House rules that have bitten this repo before

- Branch `dev`. Stage **explicit pathspecs** — never `git add -A`; bracketed dirs need
  `":(literal)app/[orgSlug]/…"`. Commit only on explicit owner OK; use `git commit -F <file>` (PS5.1
  mangles inline quotes). After every commit run `git show --stat HEAD` — other agents share this
  working copy and it currently holds substantial unrelated in-flight work.
- **Never `Get-Content | Set-Content` a source file** (ANSI mojibake). Use the Edit tool.
- New files or shared-module changes ⇒ **restart the dev server before handoff**: stop it, delete
  `.next`, `npm run dev`, wait for Ready. Deleting `.next` while it runs corrupts the cache on Windows.
- After the build: `/simplify`, then `/review`, then `npm run typecheck` + `npm test` +
  `npm run verify:changed`. ⚠ `verify:changed` fails on **schema parity** while prod is behind dev on
  migrations 230/231 — pre-existing, not yours.
- **`/docs`** — the in-app Money guide (`lib/help-content/coaches.tsx`, `premium-money`) explains how
  dues are collected. Same unit of work, and this one genuinely changes what it has to say.
- **Demo check** — the coach sandbox (`riverdale-ridge`) seeds dues and its tour narrates money
  screens. Grep the tour steps and moments dock for any sentence about paying or owing, and ask
  whether the demo should now show a part-paid player. `npm run check:demos` catches breakage but
  cannot tell you the demo is missing something the product gained.
- **Plan + PM brief pair required** — `docs/projects/active/COACH_DUES_PAYMENT_RECORD_PLAN.md` and
  `_PM_BRIEF.md`. Add one summary line to `TODO.md` linking to the plan; no detail in TODO.
- Owner QA rides `OWNER_QA_LEDGER.md` (Money is §12, Group 1C).

## Before you write code

Three blocking steps, in order:

1. **Show the inventory** (Phase A) — including the "what does this surface say today about the
   $100-a-month player" column. That table is what makes the size of the problem visible.
2. **Show the mockups** (Phase B), published as Claude Artifacts.
3. Then the **plain-language UX summary** required by `AGENCY_RULES.md` — what a coach and a family
   see differently, what a treasurer can now do that they could not, and what does not change.

## Scope discipline

**The coach portal's rep-team dues only.** The same collect-and-record shape exists in org-level
accounting (admin allocations and their instalments, payment requests) and in the basic/free coach
fee path. **Note what you see, fix nothing outside coach rep dues.** If the payment record that falls
out of this could serve the admin side later, say so and design it to be liftable — but land it here.
