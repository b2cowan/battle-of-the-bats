# Plans end at the renewal date · Stage 1 Part C — emails, the daily-job steps, "Finish this ending now", the dated words (build prompt)

> Written 2026-11-02. Paste into a new Claude chat on `dev`. **Re-verify every lead in the code before building on it**;
> plans and summaries in this repo have been wrong before. Recommended model: Opus 5.5 (money paths, a daily job, emails).
> Use helpers for broad reading; open every line a decision turns on yourself.

## READ FIRST (in this order)
1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`.
2. `docs/projects/active/PLAN_ENDS_AT_RENEWAL_PLAN.md` in full: §3a **G3, G4, G6, G7**, §4 item 1 (the Part A / Part B progress
   paragraphs), §5 (open items), **§6 (the help lines Part B made untrue — Stage 4's list, NOT yours to rewrite)**.
3. `docs/projects/active/PLAN_ENDS_AT_RENEWAL_STAGE1_BUILD_PROMPT.md`: its rules, "Stage 0 rulings", "What you may not do",
   and the leads on emails (lead 9), the daily job (item 9) and dates (G4).
4. The approved drawings: https://claude.ai/artifact/VbFZCx128jT3sr1zaLyHP4 (source
   `PLAN_ENDS_AT_RENEWAL_STAGE0_DRAWINGS.html`) — **Tab 6 (the overdue safety net) and Tab 7 (the emails)** are Part C's; build to them.
5. Memory: `project_plans_end_at_renewal.md`, `reference_partial_commit_shared_tree.md`.

## WHERE THINGS STAND (verify with git; don't trust this list blindly)
- Part A (server) committed `ebffbc1c7`; Part B (screens) committed `b6ae3de78`, 2026-11-02, with one Part A fix folded in
  (`stripeIdToStopNow`: a cancel that ends at once now also stops a non-paying real Stripe subscription, both doors).
  `/simplify`, `/review`, `/billing` and a `/docs` report were run on Part B.
- Migration 424 is applied to **dev only**; prod gets it before any promote. It already holds the four once-only email stamps
  on `billing_retention_intents`: `ends_on_email_sent_at`, `reminder_email_sent_at`, `kept_email_sent_at`, `ended_email_sent_at`
  (only the last is written today), plus `notify_owner`, `held_move_plan`, `change_log`. **Prove from the dev snapshot that no
  new column is needed before writing a migration;** if one is, write the file, apply it to dev (the owner has ruled Claude
  applies migrations to dev), refresh the snapshots, update `DATA_DICTIONARY.md`, and say prod is owed.
- Already built and tested (reuse, never re-implement): the pure `isOverdueEnding` and `OVERDUE_GRACE_DAYS` (3 days) in
  `lib/plan-ending.ts`; `endedAtFor` (an overdue ending's data clock starts on the day it should have ended — Stage 0 ruling 6);
  the one teardown `applyEnding`; the deps in `lib/plan-ending-server.ts` (incl. `sendEndedEmail`); `retentionDateLabel` already on
  `formatStoredDate`; the trial-ending email is already skipped while a cancel waits (G5).

## WHAT PART C BUILDS
1. **The emails (G6).** (a) "Your plan ends on {date}" — once per pending row, whatever the door: the owner's cancel, the
   operator's (honouring `notify_owner`), or a cancel made in Stripe's portal (created by the webhook's `updated` arm); keyed
   to the row so an `updated` storm sends one; org and Coaches Portal variants. (b) Keep {Plan} sends "Your plan will renew on
   {date}" (as {cheaper plan} when a held move came back) — **and the operator's Keep gets the "tell the owner" tick the drawing
   shows (Part B deliberately left it out until this email exists).** (c) A reminder seven days before the end, as a step of the
   daily job; once-stamped; skipped for a withdrawn row, and when the end was already under seven days away at the click.
   (d) **One date formatter everywhere (G4):** every email uses `formatStoredDate`; test a period end of `…T02:00Z` reads the same
   day on the page and in each email. Register every template key where keys live (platform-admin email list, `/dev/email-preview`).
   The existing "your plan has ended" emails stay for the end date. Stage 4 polishes wording; yours must be correct, plain, in the house voice.
2. **The daily-job steps (G3).** New steps in `app/api/platform-admin/stripe-fees-daily/route.ts` (copy how `ending_warnings` is
   wired — once-only stamped, safe to re-run): the seven-day reminder, and the overdue read (a pending cancel past its date + 3
   days). **This route is product code, not a watched path — but do not touch hooks, `.claude/settings*.json`,
   `scripts/check-agent-automation.mjs`, or `npm run health`.** The step never acts by itself.
3. **Overdue on screen + "Finish this ending now" (Tab 6).** The "Endings Stripe hasn't finished" section on the retention page,
   the red "Overdue" callout and "Should have ended" cell on the org record, and a platform-admin **Finish this ending now**
   window that **first retrieves the live subscription**: Stripe says ended → the same teardown the webhook would have run (data
   clock from the day it should have ended); Stripe says still live → change nothing and say the record is wrong, not the
   account. Two result notices as drawn. Typed Why, like every console record window.
4. **The dated online-payments words.** The owner Cancel window's payments line still reuses wording written for a downgrade
   ("…so moving back up turns online payments on again") — give a cancel its own dated variant; the operator's waiting Cancel
   window has **no** payments line yet (its words only say "now") — add the dated one. Read `lib/online-payment-words.ts`
   and `lib/online-payment-endings.ts` before touching them.
5. **Decide, don't silently skip** — small items the Part B review left open (list each in your first message with a
   recommendation; the owner may rule them): a stored renewal date already in the past shows as the end date (treat like a
   missing date); the Keep door is hidden while the free-time read errors; a missing renewal date shows an error with no Retry;
   the operator Keep window is the 520px record window (drawn at 416px); the End now sentence box is not red-tinted; change-plan
   doors flash before the page learns a cancel waits.

## NOT PART C
Help articles (Stage 4's one help pass, with Plan & billing Stage 5; the list is plan §6). Downgrades (Stage 2). The Stripe
test-clock rehearsal (Stage 3). Prices, plan names, gates, `lib/plan-config.ts`. Widening who may cancel or keep (owner only).

## RULES
- Branch `dev`; never push. Other sessions share this working copy: stage explicit paths only; `TODO.md` is shared — commit
  only the plan's own line (HEAD plus that edit; read the partial-commit memory first). After committing, `git diff HEAD~1 HEAD` on
  every file the previous commit also touched, then `git show --stat HEAD`. **Ask before every commit.**
- **First message, before any code:** a short plain-language UX summary for a product owner (what the owner and the operator see
  and do differently, role differences), your plan, and any disagreement with this prompt — say it out loud.
- No browser, no UAT, no real Stripe calls; unit tests with stubs. Absent beats disabled. One spelling; `npm run check:spelling`.
- A change to what we send, charge or record goes through `/accounting` before hand-off (CLAUDE.md).

## ORDER OF WORK AND HAND-OFF
Build → `/simplify` → `/review` (money path; weigh the replay-safety of every new step: a crash part-way, then a re-run, must
send and write one of everything) → `/billing` → `/docs` in REPORT mode (append any new untrue help lines to plan §6) →
checks (`npm run typecheck`; `npm test` — the 5 known failures are plan-billing-usage, public-tournament-stage6-walk ×3,
support-console-stage3-guard; `check:spelling`; `check:dictionary`; `check:layout` needs a browser, so skip and say so) → ask
before the commit → record the hash in plan §4 item 1 and the TODO line → update the auto-memory file.
Hand-off in product-owner voice: what changed, checks and results, what review found and fixed, owed items (dev-server restart;
prod migration 424 before any promote; the one owner walk after Part C; **Stage 1 never reaches customers without Stage 2**).
