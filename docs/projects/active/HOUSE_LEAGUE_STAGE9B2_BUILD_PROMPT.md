# Club Tier Stage 9b-2: money, honest (build prompt)

> **Written 2026-10-25**, the day the 9b-1 walk (§375) came back 50 of 51 (G1, the family's email, cannot send from localhost;
> it joins the one end-to-end test on dev Amplify). **Paste this into a new chat on `dev` and re-verify every lead first.** The
> leads come from reading the plan (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0–§9), the 9b-1 build prompt, the 9b drawings' section list
> and the Stage 12 plan's house-league rows; **the code itself was not re-read for this prompt.** It names files, not lines, and
> code moves. Other sessions share this working copy (Stage 12, the support console, bookkeeping): stage explicit paths only,
> commit only your own hunks, use a temporary index when a file is shared (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5** (a money writer, refunds as money out, a database function, a rebuilt staff screen).
> Helpers stay on Sonnet as configured.
>
> 9b-2 is built in **parts, each committed locally after its own checks**. Part 1 (the one money writer) is the base; Stage 12b
> cannot start until it lands, so keep it clean.

## What 9b-2 makes true

The convenor and the registrar see **the money on every registration row**, and every figure in the product agrees with it.
The price a family owes is the one **fixed on their registration** (9b-1 already records it at sign-up; 9b-2 adds the
correction and the re-price on a move). **Paid is its own fact**: there is no "payment pending" status. Money comes in through
**one writer** that takes an **amount, a date and a method** (so 12b's card payment lands in the same place). **Ending a
registration that has money on it asks what happened to the money** (refunded, or kept with a reason) and a refund is recorded as
**money going out**, never as a silent void. The season's **Money page** is the season's book and reads Owed · Received (net of
refunds) · Still owing, with refunds listed below; a club on the Club plan also files the fees to the **Budget vs. Actual
Statement** as one "House league registration fees" row with the seasons under it. The **Registrations screen is rebuilt once,
on the kit**: Withdraw, Move division (asks to re-price), Release the spot, bulk actions, a Paid / Owing filter, rows that work on
a phone. The family's record (Families) reads the same money, and hand-added children are covered.

## The rulings (do not reopen; record nothing they did not rule)

All in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0 (round 1), §0b (round 2), §0c, §0d, owner 2026-10-24 and 2026-10-25, every one as
recommended. The ones that decide this build:

- **Q1** a family pays when **accepted**. **Q2** the price is fixed at sign-up (9b-1 did this, §0d), early bird follows the
  sign-up date, **the convenor can correct one registration's price with a reason**; **Move division asks to re-price**.
- **Q3** an accepted unpaid registration **holds its spot**; the convenor sees "owing · N days" and decides: **Release the spot**.
  **Q4** the promotion email carries the pay spot (a greyed ghost until 12b).
- **Q6** ending a paid registration **asks each time**: refund recorded, or kept with a reason. **Partial refunds are 12b (L1).**
- **Q10** one "House league registration fees" row with the seasons under it; budget = the sum of each division's size × price;
  a fee files in the fiscal year it was **received**. **Q15** the season Money page is the book on League Plus; Club also files to
  the Statement. **Q18** the page is "Money".
- **9b·7** bulk **Approve, Waitlist, Mark received, Move division, Email**; **Decline and Withdraw one at a time**; partial
  results said plainly. **9b·8** "owing" turns amber after a number of days the club sets (starts at 14). **9b·10** the band is
  Owed · Received (net of refunds) · Still owing, refunds listed below. **9b·11** a season's budget sits in the fiscal year its
  sign-ups open; the treasurer can split it. **9b·12** "Accepted" on every family screen; staff keep **Approve**.
- **Contract lines kept** (plan §2): **one money writer** (`setLeagueFeePaid` → RPC `club_league_fee_set`, pinned by
  `tests/unit/club-stage5c-families-guard.test.ts` §1: the guard stays green and is **extended**, not loosened); **no household
  money** (two children = two registrations, one payment by hand); the family's processing fee **never** enters the club's book;
  "payable separately" stays on the form until 12b; payer = the guardian, no family account.
- **§0d (9b-1 session):** the price recorded at sign-up never moves when a division's price is edited; existing registrations took
  the season price they owed. A division's record opens in a **window** (the kit's record window), not in the table.

## Read first

- **The drawings, ruled:** https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT (source `HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`), tab
  **"9b-2 Money"**: §1 Registrations with the money on every row · §2 a row's actions on a phone · §3 ending a registration that
  has money on it (the "Decline Ethan Brown?" window) and the **Correct a price** window · §4 the season's Money page · §5 Budget vs.
  Actual (Club) · §6 the family's record. The **"9b-1 Sign-up" tab is built**; do not redraw it.
- **The plan:** `HOUSE_LEAGUE_STAGE9_PLAN.md` §2 (payments contract), §3 (F10 approve, F11–F15, F13 Registrations), §6a (build
  notes: accepted-at fact, settle-the-difference, refund fiscal year, backfill of pre-writer ticks, the "no longer payable" page),
  §9 (log, with 9b-1's findings).
- **Stage 12's dependency:** `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` (the writers table and the 12b row): it needs **house league's
  writer to take an amount, a date and a method** and a "no longer payable" state for pay links on ended registrations. Read the
  rows; do not build 12b.
- `HOUSE_LEAGUE_STAGE9A_COPY.md` and `HOUSE_LEAGUE_STAGE9B1_COPY.md` (the house voice and the words already shipped: reuse them),
  `HOUSE_LEAGUE_STAGE9B1_BUILD_PROMPT.md` (the shape of a 9-series build), the 9b-1 entry in §375 of `OWNER_QA_LEDGER.md`.
- `memory/design_decisions.md`: "A record reads first, edits whole", "One window", "A window's foot", "One toolbar; rare tools
  behind Tools", "A waiting count is the amber pill", "Money figures = ONE joined band", the table-and-list standard
  (`TABLE_AND_LIST_STANDARD.md`), the phone secondary-action rule (symbol alone, 44px), absent beats disabled, "One spelling".
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper; a helper's summary is a lead, not evidence.**
  Schema = dictionary, same unit of work; decide columns from the snapshots, never from migration files.

## Leads to re-verify (from the plan's census; the code may have moved)

| What | Per the plan |
|---|---|
| The fee writer | RPC `club_league_fee_set` posts a paid/unpaid tick; 9b-1 redefined it to post the **registration's recorded amount**. It takes **no date or method**; Families' Record a payment calls it and **drops the window's date and method**. |
| Ending a paid registration | RPC `club_league_fee_end` via `voidLeagueRegistrationFee` **voids the line silently** (F12; the fixture's Ethan Brown). |
| Declined / withdrawn rows | No **accepted-at** fact exists; "owing N days" has nothing to count from. |
| The Ledger page | "Outstanding" counts pending entries and always reads $0.00 (F14); the expected total is size × price, not the frozen amounts. **Do not show that figure anywhere new.** |
| Fees on the Statement | `house_league_fees` files nowhere (`lib/club-ledger.ts`, `lib/club-money-figures.ts`) (F15). |
| Registrations screen | Old look, no Withdraw, no bulk, no Paid / Owing filter, 851px table in a 358px scroller on a phone, actions off-screen (F13, F06). |
| Move division | 9b-1 made it respect room and the waitlist but **keeps the price**; re-pricing is yours. |
| Fixture | Nine of the ten paid ticks in 2026 predate the writer and have **no book line**: backfill before the Money page is honest on it. `dev-league-org`, owner `league-owner@dev.local`, registrar `league-registrar@dev.local`, treasurer `league-treasurer@dev.local`, all `devpass123` (sign-in only, never reset). ⚠ The League plan carries no Accounting, so this club's treasurer reads no Money; the Statement half needs a **Club-plan** club. |

## Things to argue before building (disagree out loud)

1. **Two writers' worth of behavior hide behind one name.** "Mark received" today is a toggle; the drawings show a payment with a
   date and a method, a refund as money out, and a correction that must settle the difference on a paid registration. Say how the
   one RPC models **received, refunded and corrected** (rows with signs, or paired lines) before writing it, and what
   `club-stage5c-families-guard` §1 must now pin. If the cheaper design breaks the one-writer rule, **bring it to the owner**.
2. **The Statement half only exists for a Club-plan club.** Part 5 can be proven on dev only with a Club-plan fixture; confirm
   which club you walk it on and say so in the UX summary. **Q15 means the season Money page must stand on its own** for League
   Plus: do not make it depend on the Statement.
3. **"Owing N days" from an accepted-at fact needs a backfill rule for rows accepted before the column existed.** Recommend
   "unknown, never amber" over inventing a date; say what you chose.
4. **Bulk Move division** and the re-price ask interact: moving ten children to a division with a different price means ten
   decisions or one. The drawings show it; check the bulk window answers it plainly and that a partial result is said, not hidden.

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), plain words: what the convenor, club admin, registrar,
   treasurer and a family see differently, with the role table (the 9a gate is unchanged: who may write what), and the four
   questions above. Get the owner's yes on the open ones.
2. **The words through `/marketing`** → `docs/projects/active/HOUSE_LEAGUE_STAGE9B2_COPY.md`: the Registrations screen (columns,
   filters, row actions, bulk bar and its partial-result lines), the Decline/Withdraw/Release windows, the Correct a price
   window, the Money page (band, lines, refunds, empty states), the Statement row, the family's record, the amber owing pill, and
   every refusal. Reuse §375's words where a thing already exists. House rules: sentence case, "8:00 a.m.", the bare possessive,
   `npm run check:spelling`, **"Accepted"** for the family, "Money" not "Ledger".
3. **Do not draw anything new.** If the code can't build a ruling as drawn, bring it to the owner first.

## What to build, in parts

**Part 1 · The one money writer.** One additive migration (next number after the highest in `supabase/migrations`, which was 366
when this was written: check; dev only; recorded in `MANUAL_PROD_STEPS.json`; dictionary and snapshots in the same unit of work):
the accepted-at fact; the writer taking **amount, date and method**; a refund recorded as money out with who and why; a
correction recorded with its reason; the backfill of the fixture's pre-writer ticks into the season book. `CREATE OR REPLACE`
the RPCs keeping the old call shape so prod's old code is safe until the promote. Families' Record a payment passes its window's
date and method through. Unit tests (received, refunded, partially-correct, a free season, the club's day not a re-zoned one) and
a **guard test** that every house-league money path goes through the writer.

**Part 2 · Ending, correcting and releasing.** The end-a-registration window (Decline / Withdraw on a registration that has money:
refunded or kept, with a reason, once, in one transaction with the waitlist promotion); the **Correct a price** window (a reason;
a paid registration settles the difference as a refund or still owing); **Release the spot** on an owing registration; **Move
division asks to re-price**. Server enforcement through the one gate (`lib/house-league-access.ts`); the registrar may do it,
the treasurer may not (confirm against the role table).

**Part 3 · Registrations, rebuilt once on the kit.** The Fee column and the amber owing pill (days from the accepted-at fact,
the club's threshold starting at 14, set where the drawing puts it); Withdraw; Move division; Release the spot; bulk (Approve,
Waitlist, Mark received, Move division, Email) with plain partial results; the Paid / Owing filter; the phone rows (the whole row
opens, the secondary actions are symbols alone at 44px, Approve is the one primary). **Approve respects room** (already
enforced server-side since 9b-1: the screen must say so plainly, with the offer to waitlist). Remove today's old buttons and
windows; update the old-look and colour-debt lists for what you rebuilt, and only that.

**Part 4 · The season's Money page.** Owed · Received (net of refunds) · Still owing as one joined band, refunds listed below, the
Overview's Owed / Still owing tiles that 9b-1 deliberately left out, Money open after Complete (Q16). Replace the Ledger's
"Outstanding" with the real figure from the frozen amounts. A League Plus club reads this as its book.

**Part 5 · The Statement (Club).** One "House league registration fees" row, seasons under it, each fee in the fiscal year it was
**received**, the budget as the sum of size × price in the fiscal year the sign-ups open (the treasurer can split it), the
family's processing fee never in it. Update walk 7a's step 7.6 as the plan says. **The stage does not close until the Statement
and the season books agree.**

**Part 6 · The family's record and the status page.** Families reads the frozen amounts and the refunds; a hand-added child is
covered (the plan's note that it is not linked is **wrong**: Families attaches by guardian email when it loads, so check before
touching anything); "Ask to withdraw a child" on the status page; the ghost pay spots stay greyed (12b), and the club's own
how-to-pay words keep showing. The "no longer payable" page for an ended registration's link is **12b's**; draw the seam, do not
build the page.

**Part 7 · Help and the lists.** `/docs`: the guides for Registrations, ending a registration, correcting a price, the Money page
and the Statement row. `check:layout --changed` on the Registrations screen, the Money page and the windows at 1440 and 390,
Warm and Dark (the dev server is right for `--changed` only; the whole-product sweep is not run here). The demos follow the
product: nothing to do unless a tour anchor moved (the build fails if one did); a number in a demo sentence is computed from the
seed or it is not in the sentence.

## Definition of done

- Parts 1–7 committed; `npm run verify:changed` and `npm run typecheck` clean; the writer, ending, correcting and releasing paths
  and the bulk partial-result tests pass; the existing guards stay green (`club-stage5c-families-guard` §1 extended,
  `house-league-gate-guard`, `league-season-scope-guard`, the sign-up race script `scripts/house-league-signup-race.mjs`).
- `/review` run on Part 1 and Part 2 (money, atomicity) and on the whole; findings fixed or recorded.
- **The 9b-2 walk**: a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (check the last number; §376 was 12a's), one
  purpose per walk. Cover: Registrations money on every row and the filter; mark received with a date and a method; approve into
  a full division refused; decline a paid registration (refunded) and again (kept, with a reason); withdraw; release the spot;
  correct a price on a paid registration; move a child to a dearer division; bulk with a partial result; a phone; the Money band
  and its refunds; the Statement row and the season books agreeing (Club-plan fixture); the family's record; each role's view.
- The plan's status log and §4 updated; the **PM brief** (`HOUSE_LEAGUE_STAGE9_PM_BRIEF.md`) updated; a news row on the Club
  index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, stage `s9`; read it first and pin `if_version`); the TODO line
  updated with commit anchors; memory `project_club_stage9_house_league.md` updated; **tell the Stage 12 session 12b is unblocked**
  and what the writer's signature is.

## Carried in, not yours to build

- **Walk §375's G1** (the family's email) is owed on dev Amplify as part of the one end-to-end payments test; do not retest it here.
- **Uncommitted spacing fixes from the 9b-1 walk** on the sign-up form (the division choice's two lines and the waiver's error
  message) sit in the working copy (`components/league/RegisterForm.tsx`, `register.module.css`). They are not yours unless
  the owner says so; if you commit them, commit them alone.
- **9b-1 review findings left open for the owner:** no per-season cap on public sign-ups beyond the throttles (the per-IP one
  trusts a forwarded header); the duplicate-child rule tells a stranger who knows a name and birth date that the child is
  registered; consent rows record whatever email was typed; the platform email editor has no entry for the new sign-up email, and a
  saved override of the staff Approve email would drop the price and how-to-pay lines. Mention the last one if you touch the
  approval email.
- **Prod:** migrations 361 and 362 (and 363, a column) must precede the 9b-1 promote; yours must be added to
  `MANUAL_PROD_STEPS.json`. No promote.

## Do not

- Build 9c content (teams, ratings, the draft, coach accounts, the team on the status page), 9d (the generator, the email composer
  consolidation Q12b/Q12c, the audiences), 9e, 9f, or Stage 12 (Stripe, a live Pay now, partial refunds L1, the "no longer payable"
  page, bank debit, tax, installments, discounts, household credit).
- Show today's Ledger "Outstanding" figure anywhere. Drop a column. Add per-route person minting. Touch the phone bar, the More
  sheet or the rail's top level (Stage 13). Reopen a ruling.
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a temporary index when a file carries another session's
hunks. Parts 1 and 2 may each be committed alone. No push and no promote without the owner's word.
