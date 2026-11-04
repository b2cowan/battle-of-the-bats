# Club Tier · Bank reconciliation (both portals): plan it (prompt)

> **Written 2026-11-04**, the day Stage 6e closed. Bank reconciliation is the one release item with no plan, no PM brief and no
> drawing. **Paste `execute @docs/projects/active/BANK_RECONCILIATION_PLANNING_PROMPT.md` into a new chat on `dev`.** Other
> sessions share this working copy (Stage 14 is being built in one of them; billing, GST/HST and public tournament pages in
> others): stage explicit paths only, commit only your own hunks, and only when the owner says.
>
> **This is a planning session, not a drawing session and not a build.** No product code, migration, seed, help article, copy or
> demo change. It produces the plan, the PM brief and the owner's list of asks. The owner mockup session is a separate, later
> session, written up as its own drawing prompt once the asks are ruled.
>
> Run `/plan` first (the planning agent's rules apply), then follow this file.

## What it is, and what is ruled

Plan of record slot: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, section "Bank reconciliation — both portals" (~line 2753). The
whole definition so far is the project index's one sentence: *a treasurer checks each club book against the bank statement and
marks the period done; a coach does the same with the team's Ledger.* **Everything beyond that sentence is unruled. Do not
treat any detail you find in an older document as decided, and record each ruling below as ruled and add nothing it did not
rule.**

**Ruled, do not reopen:**
- **Both portals** (owner 2026-10-06): the club's Accounting and the coach's team Ledger.
- **Planned and drawn before Stage 8** (owner 2026-10-06), and **inside the Club release** (owner 2026-10-12;
  `BUSINESS_DECISIONS.md` 2026-10-16).
- **Marketing claims only what ships** (`BUSINESS_DECISIONS.md` 2026-10-19): "payment reconciliation" is out of every Club page
  until this ships. Nothing you write may put it back. Route copy through `/marketing` later.
- **Whose number is a team's money (plan D1):** the coach's records are the source of truth for team money and the club reads
  them. A coach's reconciliation therefore checks the coach's book; it must not create a second team number the club has to
  reconcile against.
- **Coaches Portal rules still bind the coach half** (`CLAUDE.md`): a season is live until the coach closes it; a closed season
  is one page; unsettled money **warns, never blocks**; a history shelf needs its own owner mockup session. Say which of these
  the coach-side design touches and how it stays inside them.
- **Club fiscal year** (owner 2026-10-07, Stage 3c): a closed fiscal year is read in place on the club's money tabs, locked.
  A reconciled period has to sit coherently with that.

**Not this project:** FieldLogicHQ's own bookkeeping (the owner's internal books, archived 2026-10-23) and FieldLogicHQ's own
tax. This is the customer-facing feature clubs and coaches use on their own money. It does not change what FieldLogicHQ charges,
so `/accounting` is not required unless your plan ends up doing so; if it does, route it there before handing off.

## Before planning: find out what is true (delegate the reading; open the cited lines yourself)

Send helpers out in parallel (`CLAUDE.md` "broad reading goes to a helper"), each asked for paths with line numbers and a short
verdict, not file dumps. Verify every claim you rely on. Questions to answer:
1. **What does the club's Accounting hold today?** Ledgers, accounts (is there a notion of a bank account, a statement, a
   cleared or reconciled flag on an entry?), entry statuses, transfers, the Statement, roles (owner, club admin, treasurer,
   registrar: who can write money today). Check the live schema from the snapshots and `DATA_DICTIONARY.md`, never from
   migration files.
2. **What does the coach's Ledger hold today?** Records, opening balance, Cash on hand, per-season handling, who can write
   (head coach vs assistant), how an online family payment (Stage 12) lands in it.
3. **What money arrives from outside, already itemised?** Stage 12 puts online payments and Stripe payouts into the product
   (`CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`, payout list and its reconciliation status; the manual-payout caveat ~lines
   320–330). What does a treasurer still have to match by hand (cash, cheques, e-transfers, other bank deposits)?
4. **Is anything already called "reconcile" or "reconciled" in code, copy or help?** Plan C19/F10 say copy overclaimed it once;
   confirm what was removed and what remains, so the plan does not collide with it.
5. **How do clubs actually do this?** A short, sourced look at how a volunteer treasurer reconciles (statement balance vs book
   balance, ticking items off, an adjusting entry, a "period closed" lock), and what comparable club tools offer. Mark what
   you inferred.
6. **Which parts of this are other stages' territory?** Stage 14 (children, rosters, guardian links) and Stage 13
   (navigation) are the neighbours; confirm this feature adds a screen or tab to the club Accounting tabs and the coach
   Ledger, and say which nav doors that is so Stage 13 can re-check them. Do not touch family, roster or season-window code.

## What the plan must settle (each is an ask with a recommendation; the owner rules)

Write these as numbered asks, each with the options, **your recommendation**, the reason, and what it changes if the owner
chooses differently. Argue from what the code does, and say plainly if any premise is wrong (`AGENCY_RULES.md` "disagree out
loud"). Lead with the asks that decide the others.
- **What do you reconcile against?** A statement balance the treasurer types and ticks entries off to; an uploaded statement
  (CSV or PDF) matched to entries; Stripe payouts only; or a live bank connection. Recommend the smallest thing that is honest,
  and say what each larger option would cost and require (bank-data vendors, privacy, Canadian banks).
- **What is "the period"?** A calendar month, a statement, a custom range, the fiscal year; and how that meets the coach's
  program year.
- **What does "marked done" do?** Locks entries in that period or only records the check; what a later edit, a late entry
  or a back-dated entry does; whether a done period can be reopened, by whom, and how that is recorded (an audit line).
- **Who may reconcile** in each portal, and who only reads the result.
- **What do differences look like?** An unmatched item, a missing deposit, an adjusting entry: how a treasurer or coach
  resolves one without a bookkeeping education. Plain words only.
- **Where does it live?** Which club Accounting tab, which coach Ledger view, and the phone version of each. Name the doors.
- **What shows elsewhere?** Does the Overview, the Statement, the team money rollup the club reads, or an export show a
  "reconciled through {date}" mark? Recommend the quietest answer.
- **Gating:** which plans have it (Club only, or the coach portal's Premium plan too). This is a packaging fact: put the
  question to `/strategy` and record its answer as Proposed; do not decide it here.
- **What stays out of the first release,** written down so it is a decision and not a gap.

## What to produce

1. `docs/projects/active/BANK_RECONCILIATION_PLAN.md` and `BANK_RECONCILIATION_PM_BRIEF.md` (plain language, outcome-focused;
   the brief covers functionality, why it matters, customer impact, priority and success criteria). The plan's stages must be
   sized so each build is one session, and must say what each stage needs from the neighbours.
2. The **asks list** in the plan, in the form the owner can paste an answer back to.
3. The list of **screens the owner mockup session must draw**, desk and phone, for both portals, each named by the question it
   answers. Do not draw them.
4. One line in `TODO.md` pointing at the plan (replace the existing one-line stub), and the plan slot in
   `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` pointing at the new files. Both are shared files other sessions are editing: change
   only your lines, and commit them with the temp-index method (`reference_partial_commit_shared_tree`) only when the owner says.
5. A closing message in product-owner voice: what a treasurer and a coach would see and do differently, the recommended
   answers to the asks in one short list, and which ask the owner should rule first.

## Rules for this session

- Disagree out loud, by default, before doing the work. If the one-line definition is the wrong question (for example, if
  the coach half is really a different feature from the club half), say so first.
- Do not run it in parallel with the Stage 14 build's files: no edits to `lib/rep-season-rollover.ts`, the season windows, the
  roster, children or family code. Migrations are not part of this session.
- Write in product-owner voice to the owner. Technical detail belongs in the plan file.
