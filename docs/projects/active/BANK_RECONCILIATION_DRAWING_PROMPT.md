# Bank reconciliation (both portals): draw it (prompt for the owner mockup session, stage R0)

> **Written 2026-11-04**, the day the asks were ruled. **Paste `execute @docs/projects/active/BANK_RECONCILIATION_DRAWING_PROMPT.md`
> into a new chat on `dev`.** Other sessions share this working copy (Stage 14 is being built in one of them): stage explicit
> paths only, commit only your own hunks, and only when the owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change. It produces
> one drawings page, published as an Artifact, run through `/design` before the hand-off, and the asks the drawing raises.

## Read first

1. `docs/projects/active/BANK_RECONCILIATION_PLAN.md`: §0 (standing rulings), §1 (premises P1–P4), §4 (the twelve asks,
   **all ruled A on 2026-11-04**: draw option A of each, exactly as written, and nothing beyond it), §5 (draft words),
   §6 (the screens), §7 (stages).
2. `docs/projects/active/BANK_RECONCILIATION_PM_BRIEF.md`.
3. The owner review page: https://claude.ai/artifact/R8b4LM7LEUTgeCgJtTm1Jh (its tab 1 has the worked example).
4. The house rules for drawings, from the owner's memory: the HTML-page house layout (sticky numbered tabs, one section at
   a time, last tab = asks; a `View` toggle "Everything / Show only what differs" only where the page compares); draw a
   control from its **shipped** component; money figures as **one joined band**; every highlight clickable; NEW /
   RESTYLED / UNCHANGED tags; **one whole screen before and after**; true size inside fixed 1440 and 390 frames.

## The rulings the drawing must honour (all A, 2026-11-04)

- **B1:** a **bank account** ("Club chequing"); every club book belongs to it by default; a second account can be added
  and a book moved to it; a team has exactly one account.
- **B2:** the statement, **typed** (end date + ending balance), lines ticked off; an automatic Stripe payout is **one
  row** that ticks everything inside it; a manual payout's lines are ticked by hand.
- **B3:** the period is **a statement**; each check starts where the last ended; the first check asks for a start date,
  the bank balance then, and items outstanding then.
- **B4:** "checked" **locks nothing**: a warning before editing or voiding a ticked line; "Changed since it was checked"
  afterwards; undo the latest check only, with a reason, recorded who and when. A tick in a closed fiscal year is
  allowed; a bank-fee line dated into a closed year is refused by the year lock as today, and the helper offers today's
  date.
- **B5:** **$0.00 required**, with three helpers: Add a bank fee or interest, Find by amount, Finish later.
- **B6:** a one-tap **"Didn't go through the bank"** and a small "Kept out of the bank" total. Dropped automatically:
  same-account transfers, bills a family paid straight to the vendor, void and pending lines.
- **B7:** whoever can already move the money checks; whoever can read it reads; who and when on each check; no second
  approver.
- **B8:** club: a **"Bank" tab after Ledger** in Accounting; coach: a **"Bank" view** in the Ledger beside Timeline ·
  Bills · Payment schedule.
- **B9:** one line on each Overview (amber only when changed since); each linked team's date on the club's Teams tab;
  a printable one-page report; a warning line in the fiscal-year close and in the coach's season close and Start next
  season; **nothing** on Budget vs. Actual, the exports, or the closed-season page.
- **B10:** the account belongs to the team; "Still outstanding from your last check" crosses the rollover; the
  closed-season page gets nothing.
- **B11:** Club plan (Accounting) and the Premium Coaches Portal everywhere. **Draw nothing for the free portal** (no
  tease).
- **B12:** out, so not drawn: upload, live feed, a reviewer sign-off, "send to the club", a closed-season shelf, a ✓ on
  Ledger lines, undoing older checks, Stripe on the coach side, account numbers.

## What to draw (plan §6): desk 1440 and phone 390 for each, except C9 and K8

**Club (Accounting → Bank):** C1 first visit / account setup · C2 an open check with the joined band "Statement · Ticked
· Difference" and a Stripe payout row (closed and opened) · C3 a non-zero difference with its helpers and the bank-fee
window · C4 the checked statements list, with undo-latest and its reason window · C5 "Changed since it was checked" ·
C6 the Ledger edit/void window with the matched-line warning · C7 the Overview line and the fiscal-year close warning ·
C8 the Teams tab with each team's date · C9 the printable report · C10 a second account and moving a book to it.

**Coach (Money → Ledger → Bank view):** K1 the first check (a team with a carried opening balance, and one without) ·
K2 an open check with "Didn't go through the bank" and the kept-out total · K3 off by an amount, the helpers · K4 this
season's checks, undo-latest · K5 the matched-line warning on a record's edit and delete · K6 "Still outstanding from
your last check" after a rollover, and the warning line in Start next season and Close the season · K7 the Money
Overview line, and the read-only view a money-read helper sees · K8 the printable report.

**Whole screen, before and after (required):** the club's Accounting tab row + Overview, and the coach's Ledger with
its view switch. Both today (captures) and with this feature, so the owner can judge whether anything got noisier.

## How to work

- **Draw from the shipped components, from captures, not memory.** Capture today's Accounting (tab row, Overview,
  Ledger, Teams, Payouts, the fiscal-year close window) and the coach's Money hub (Overview, Ledger in each view, a
  record's edit window, Start next season, Close the season) at 1440 and 390 on the dev site. The probe sign-in
  memory explains how to sign in without a browser. The coach view switch is ONE white track, never pills. The
  Payouts tab's "Find by amount" is the pattern for B5's helper.
- **Words:** use the §5 drafts as written and mark each as a draft. `/marketing` settles them once per build stage.
  Help search words carry "reconcile / reconciliation".
- **Use example figures computed from one example statement** and keep every drawn number consistent with it (the
  review page's worked example is a good seed).
- **Raise asks, don't decide them.** Where the drawing meets a choice the rulings didn't make (for example, whether the
  phone check is one long list or money-in and money-out tabs, or where the report's signature lines go), put it on the
  page's last tab as an ask with a recommendation, the reason, and what it changes, in the paste-back form the review page used.
- **Open questions carried from the plan:** confirm whether BC and Alberta gaming-grant rules require a separate account
  before C10 is drawn as the reason for a second account. Search, cite, and mark what is inferred. P4 (whether a Stripe
  payout sums to the books) is the build's R1 to prove; draw the grouped row's "gap" line as a state, in case it doesn't.
- **Run `/design` on the page before handing it off**, apply what it finds, then publish and give the owner the link.
- Disagree out loud if a ruling, once drawn, looks wrong on the screen. Say so on the page; don't redraw around it.

## Hand-off

- The drawings page published (source next to the plan in `docs/projects/active/`), its link added to the plan header.
- The plan's §6 updated with what was drawn and any screen added or dropped, and the R0 checkbox left open until the
  owner approves.
- A closing message in product-owner voice: what each screen answers, the new asks with recommendations, and which to
  rule first.
