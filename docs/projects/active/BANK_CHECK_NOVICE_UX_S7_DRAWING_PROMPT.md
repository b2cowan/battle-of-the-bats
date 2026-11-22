# Drawing prompt — Bank check S7: start, work, save for later (club + coach)

> One **drawing** session, pasted into a fresh chat (`/clear` first). **No code.** Written 2026-11-22, after walk §523 (S4)
> PASSED 15/15, which closed the last built stage of this project. Plan of record:
> `docs/projects/active/BANK_CHECK_NOVICE_UX_PLAN.md` — read **§0 (A18, "as ruled (the full version)")**, **§2 S7** and §4.
> Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code wins — say so out loud.
> **Model: Opus** (layout judgement). Helpers read on Sonnet; open the cited lines yourself before building on a claim.
> **The output is a published drawing + the asks for the owner's rulings.** The build prompt is written only after he rules.

## The one-paragraph version
Today a treasurer (or a coach) types a statement's date and balance into the balance-check card, marks lines "Not in the
bank yet", leaves to fix the books, and comes back to the card as they left it — but **only in that browser**, for 14 days,
and the card says so ("Kept in this browser only, until you save this check or sign out."). The owner ruled (A18, 2026-11-08)
the full version: **"Start checking this statement"** fixes the date and balance in a strip at the top of the card with a
**Change** link; Find and the gap work sit under it; the card ends with **"Save for later"** and **"Save this check"**; the draft
is **kept on the server, per person and per account**, so it follows them to another device. A "save" button must not promise
more than one browser keeps. Draw that card — both portals, desk and phone — and bring back what the rulings did not settle.

## What is already settled — do NOT redraw or re-ask
- **The server-kept draft, per person per account** (A18) — ruled; this **reverses working-draft ask 1** on purpose (archive
  plan `BANK_CHECK_WORKING_DRAFT_PLAN.md` §5). The cheaper middle (keep the browser draft, change only the card's look) was
  turned down. Don't reopen whether; draw how.
- **The check's words and figures** — S1–S4 are built and walked: starting balance dated the day checking starts, "Checked
  through", "Balance checks", the printed check, "Your Ledger" on the coach's side. Do not redraw the saved-check list, the
  window or the paper.
- **S1b/S3:** the card's current layout (the date and balance form, Find, "Not in the bank yet", the gap work) is the shipped
  baseline. S7 reshapes it; it does not redesign Find.
- **S5 (a second Save on a phone) and S6 (a rhythm)** are parked — leave them, unless your drawing settles S5 by accident, and
  then say so.

## ⚠ Facts to verify first (don't trust this prompt's sentences)
1. **What the card does today**, by reading the shipped components: club `components/admin/kit/club/money/bank/BankCheckForm.tsx`,
   coach `components/coaches/bank/CoachBankCheck.tsx`; the draft rules in `lib/bank-check-draft.ts` (what a draft holds: date,
   typed balance, cash, the KEYS of marked lines, the "Started off by" anchor — never a line's figures; written only when
   worth keeping; removed on Save, Start over, 14 days idle, and sign-out).
2. **The resting sentence and the draft cards** — search the words (`lib/bank-check-words.ts`, `lib/bank-tab-words.ts`) for
   every place that says "this browser", "Picked up where you left off", "Start over", "draft"; each is a line the drawing
   must replace or keep, and the walked working-draft cards change shape (their walks are redone).
3. **Who can write a check** — read the role gating in both portals (club: who may save a check; coach: head coach and who
   else, and the read-only seat). A draft is a *writer's* thing; say who sees "Save for later".
4. **The coach side's account is the team** (its books ARE the Ledger); the club's is a bank account, and a club may have
   several. Check how the strip names the account at a second account.

## The decisions the drawing must bring back (the plan's three open questions, §0)
1. **Does a second treasurer or coach see someone else's draft?** The working-draft ruling shut shared drafts out. Draw both
   readings if it helps — "mine only" and "the account's one open statement, with who started it" — and recommend one. This is
   the real design question: a shared draft is a second person's work you could overwrite.
2. **How long does a saved-for-later draft last?** Today the browser's: 14 days. A server draft that lives forever is clutter;
   one that vanishes is a broken promise. Recommend a lifespan and what the person sees as it nears its end.
3. **Both portals?** Assumed yes (the working draft is). Confirm, and say where the two differ (coach: no bank account choice,
   optional "cash not deposited yet"; club: the Account pill).

Also bring back, because the strip creates them: **what "Change" does to marks already made** (a changed date re-reads the
day's lines — do marked lines survive, ask, or clear?); **what a draft looks like when the books have moved** since it was
saved (a line marked "not in the bank yet" that has since been edited or deleted — the build keeps keys, never figures, so the
drawing must say how the card tells the person); **what "Save for later" confirms**, in words a volunteer reads once; and
**where a saved-for-later statement is found again** — on the Bank tab above the checks list? as the card's own state?

## Read first
1. The plan sections above; `docs/projects/archive/BANK_CHECK_WORKING_DRAFT_PLAN.md` §3 and §5 (what was ruled and why, so the
   drawing states the reason the reversal rests on); `memory/design_decisions.md` — search it for the working draft, the strip
   and "Start checking" entries.
2. **Draw a control from its SHIPPED component** (the view switch, the Account pill, the card, the row lists) — never a
   plausible-looking stand-in. Money figures are ONE joined band; phone figures are ROWS, not tiles; every highlight is
   clickable. The portal's own written rules are the formatting benchmark.
3. `docs/agents/design/` for the club kit and the coach kit; `lib/bank-check-draft.ts` and the draft tests
   (`tests/unit/bank-check-draft.test.ts`) for what a draft can and cannot hold.

## Output
- **One Claude Artifact (HTML), never the canvas:** the house layout, whole-screen **before/after** at true size — club desk,
  coach desk, and each on a phone (390 px) — for every state: no draft, a draft in progress (strip + marks), a saved-for-later
  draft found again, a draft whose books moved, the Change step, a second person's draft (per ruling 1), and the draft's
  last days (per ruling 2).
- **Run `/design` on the drawing before handing it over.** Then the asks, each with a recommendation and the reason, in the
  product-owner voice (what the volunteer sees and does; no file paths or function names in the message).
- **Do not build, and do not write the build prompt.** After he rules: record the rulings in the plan (§0 A18, §2 S7) and the
  board line, and add `S7_BUILD_PROMPT.md`. Flag now what the build will need so the rulings are made knowing it: a new stored
  record per person per account (→ `/dba`; the data dictionary and snapshots in the same unit), and a light `/legal` look,
  since the product will keep something new about a person's work on its servers.

## Don't
- Don't add release timing to anything; sequence by dependency.
- Don't edit shared automation, hooks or settings; this is a drawing session.
- Don't read production rows (counts and schema only); a question needing a person's row is answered on dev.
- Don't commit or push without his word.
