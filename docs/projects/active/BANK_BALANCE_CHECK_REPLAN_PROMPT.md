# Prompt: rewrite the bank reconciliation plan as THE BALANCE CHECK

> Written 2026-11-05 at the end of the session that drew and ruled the balance check. Run it with `/plan` in a fresh
> session. It produces a plan, not code.

## The job

Rewrite `docs/projects/active/BANK_RECONCILIATION_PLAN.md` and `BANK_RECONCILIATION_PM_BRIEF.md` for the model the owner
ruled on 2026-11-05: **the balance check.** A club treasurer or a coach types a bank statement's **date** and **balance**.
Every book line on or before that date counts automatically. The screen shows *The bank says* · *Should be in the bank*
· *Difference*, and helps find what's missing. A check **saves while off** ("Off by $X"). Nobody ticks lines. One model
serves **both** portals.

The tick-off built in R1–R2 (committed on dev 2026-11-04/05) is superseded. The owner stopped its walk (§461).

## Read first (and decide from them, not from memory)

1. **The rulings:** the ⚠⚠ notice at the top of `BANK_RECONCILIATION_PLAN.md` (owner's reasons, rulings 1 and 3, asks
   1–10 all A). Record them in the rewritten §0 **as ruled, adding nothing they didn't rule**.
2. **The drawings:** `BANK_BALANCE_CHECK_DRAWINGS.html` (published https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN).
   Tabs 2–6 are the approved screens; tab 7 holds the asks with their wording. Build notes come from these drawings.
3. **What still stands from the old plan:** R-a…R-f in §0; P1 (the unit is a bank account; books map to an account), P3
   (associations read a team's check; D1: the club reads the coach's fact); §2 "what is true today" and §3 research; B1,
   B7, B8, B9, B11 (gating, logged in `BUSINESS_DECISIONS.md`), B12. The approved R0 drawings
   (`BANK_RECONCILIATION_DRAWINGS.html`) still hold for **tab 7 (where the "checked through" line shows), tab 8 (a second
   account, books move between accounts) and tab 9 (the report)**, with the words changed by asks 4 and 9.
4. **What is superseded:** B2's tick list, B3's statement chain and starting-point picks, B4's "changed since" and
   undo-latest, B5's $0.00 rule, B6's per-line keep-out, B10's carried snapshot, and drawing asks 3–13 that served them.
   Say which, one line each, in the rewritten §0; don't delete the history, move it to an appendix.
5. **What was built** (§7 R1–R2 of the current plan and the commits it names): read it to make a **reuse map**: what
   carries over (bank accounts, the account ↔ books mapping, the club Stripe payout reader from R2a, refusal words, the
   locking order from R2b-3, the Bank tab shell and kit pieces), what is rewritten (the engine), and what is deleted
   (ticks, exclusions, carried lists, opening picks, snapshots, their routes and screens). A helper can census this; open
   the cited lines yourself before relying on it.
6. **Coaches Portal rules** in `CLAUDE.md`: a season is live until closed; no year parameter on a live screen
   (`HISTORY_ENDPOINTS` guard); a closed season is one page. The coach check reads the working season only.

## Problems the rewrite must solve (each gets an answer or an owner ask)

- **Production's database.** Migrations 436, 437 and 439 are on prod (2026-11-05); 440 and 442 are on dev only and are
  marked NOT to apply. Decide the path from today's prod shape to the new, smaller one, in a forward migration. Prod and
  dev must end in the same shape, and no customer data exists in these tables on prod. Ask `/dba` if the drop/reshape is
  non-trivial.
- **The built Bank tab ships unflagged — RULED 2026-11-05: no hiding.** The owner: the promote will not come before
  this project is complete. So no hide stage; the rebuild replaces the tab before any promote, and the plan says the
  project gates the next promote.
- **A cheque across a coach's rollover.** Written in the closing season, cashed in the new one: the new season's
  suspects list (ask 3) shows only this season's lines, so Find can't name it. Propose an answer that keeps the
  no-year-parameter rule (e.g. the rollover carries the closing season's last "Not in the bank yet" items, or the
  closing check's suspects are saved with it), and put it to the owner as an ask if it isn't obvious.
- **The club's starting point (ask 7).** A cheque written before the start date and cashed after it shows as "Off by"
  its amount. The drawing says Find names it; decide how Find reaches a line dated before the start.
- **"Books now say $X" (ask 6).** Decide how a saved check knows its books changed (recompute on read is likely
  enough), and say what it costs on the list.
- **The hints (drawing tab 3).** Exact amount, half the amount (a sign flipped), two or three lines that sum to it. Set
  a bound on the combination search so it stays quick on a long list.
- **Cash (ask 1).** One optional figure per check, saved with that check. Confirm nothing about it touches a money form.
- **Stripe on its way (ask 8).** Club only. Define "on its way" from the Payouts reader (landed in the books, not yet
  paid out), and what shows when Stripe can't be reached.
- **The report (ask 9) and where the mark shows (ask 4).** Re-word the R0 drawings' items from the check's sums.
- **Words.** "Matches" / "Off by $X", "Should be in the bank", "Not in the bank yet", "Cash not deposited yet",
  "Add the missing line", "Save this check": drafts for `/marketing`, listed in the words section.

## Deliverables

- The rewritten plan: §0 rulings (as ruled), premises, what's true today (re-verified where the build changed it), the
  reuse map, the stage ladder, architectural decisions, open questions. Each stage is one build session, sequenced by
  dependency and rework risk, **never by date** (no release timing). Likely shape, to be argued, not copied:
  hide or keep the old tab → the engine + the migration → the club Bank tab rebuilt (desk + phone) → the club
  touchpoints → the coach source and routes → the coach Ledger Bank view → the coach touchpoints and the club's read → the
  walk and marketing truth.
- The rewritten PM brief (plain language, outcome first; why it matters; who sees what; priority; success criteria).
- The TODO line, the plan's status header and the auto-memory note brought up to date (positive facts with anchors,
  never "uncommitted"/"not on prod"). Also update the slot in `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` that points here.
- If the plan raises owner asks, put them on a small asks page (an Artifact with paste-back, the house layout) rather
  than in chat.
- Then write the first stage's build prompt.

## How to work

- **Disagree out loud before writing**, argued from the code. The redesign was argued in chat, not against every edge
  case. If a ruling has a hole, say so as an ask; don't quietly design around it.
- Delegate the broad reading (the 113 KB plan, the R2 build prompt, the commit census) to helpers, and ask them for
  conclusions with line numbers, not dumps.
- Don't touch shared automation or the database checks. Stage files with explicit paths, and commit only when the owner
  says so.
