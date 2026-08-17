# Kickoff prompt — build the owner's QA walkthrough for §29 and §38 (paste into a fresh chat)

Produce a **step-by-step QA walkthrough, written for the owner to click through**, covering owner
QA ledger **§29** (the budget speaks in category + item) and **§38** (money in, money out, money
back). Every step needs an **expected outcome** and, where one exists, the **thing to watch out
for**.

⚠ **You are not building anything.** Both features are built, committed and verified on dev
(§38 landed as `384ac191`, 2026-08-16). Your job is to make them walkable. If you find a defect
while preparing, **write it down and report it — do not fix it mid-walk** unless the owner asks.

---

## Walk them in ONE sitting, §29 first

**§38 is built directly on §29 and shares its picker.** A defect in the category+item work shows up
in the money work wearing different clothes, so walking §38 first would produce a wrong diagnosis.
They also share a fixture, so back-to-back costs one setup instead of two.

Say this in the walkthrough itself, at the top.

---

## Read first, in this order

1. `docs/projects/active/OWNER_QA_LEDGER.md` — **§29 and §38 are already written there.** They are
   your source. ⚠ **You are EXPANDING them into a guided walk, not replacing them** — do not write
   a competing checklist that will drift from the ledger. The ledger stays the record; your output
   is the thing the owner reads while clicking.
2. `COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md` — what §29 built and why (the item names the row; two
   lines on one item sum; whether something was budgeted is derived, never stored).
3. `COACH_MONEY_IN_TAXONOMY_PLAN.md` — what §38 built. **§0 lists three things the plan got wrong
   and how they were corrected**; §4 is the correctness rules; §10 is the planning session that
   follows. §6 and §8 are dead designs — read them so you do not test for them.
4. `COACH_MONEY_BACK_ON_A_COST_PLAN.md` — ⚠ **§2 is the single most important thing in this walk.**
5. The binding mockups: `945391e9` (§29), `ee76cc79` and `27d6d2df` (§38). Fetch them — they show
   the intended shapes and the exact wording.

---

## The fixture

**Use the coach demo sandbox: org `riverdale-ridge`, the 14U off-season team.** It is seeded for
exactly these two sections — a category holding two budget lines on one item, spending on something
never planned, a raffle whose proceeds and printing sit in one category, one income entry and one
refund against the item those two summed lines name.

- Reseed with `node --env-file=.env.local scripts/seed-demo-coach.mjs`; it prints the team URLs.
- `node --env-file=.env.local scripts/check-demo-coach.mjs` asserts the world is in the right state
  and will tell you if something drifted.
- The coach money lab (`scripts/seed-qa-day-fixtures.mjs`) also works, but you would have to enter
  the arrivals by hand.

⚠ **DERIVE THE EXPECTED FIGURES FROM THE SEED CONSTANTS** (`lib/demo-coach.ts`) and state them in
the walkthrough, so the owner is comparing against a number rather than a feeling. As a cross-check,
these were the real figures on 2026-08-16 — **if yours differ, the world was reseeded differently
and yours are right**:

| Where | Budget | Actual |
|---|---|---|
| REVENUE · Fundraising · Fundraising drive | $2,400 | $0 (derived — no fundraiser recorded yet) |
| REVENUE · Fundraising · Merchandise sales | — | $480 (typed income, not in the plan) |
| **Total revenue** | **$2,400** | **$480** |
| EXPENSES · Tournaments · Entry Fees (**2 lines summed**) | $4,000 | **$900** — $1,300 paid, $400 back |
| EXPENSES · Facilities · Dome Time | $2,800 | $1,150 |
| EXPENSES · Team Gear · Jerseys | $2,100 | $1,050 |
| EXPENSES · Training · Batting Cages | $1,400 | $700 |
| EXPENSES · Officials · Umpire Fees | $1,200 | $0 |
| EXPENSES · Fundraising · Printing | $600 | $0 |
| EXPENSES · Events · Photo Day (**never budgeted**) | — | $180 |
| **Total expenses** | **$12,100** | **$3,980** |
| **SEASON NET** | **($9,700)** | **($3,500)** |

⚠ **Amounts are stable; DATES ARE NOT.** The demo re-anchors to the clock, so every date moves.
Never write an absolute date into an expected outcome — write "the month the refund arrived".

---

## ⚠⚠ The five things that actually matter

Order the walkthrough so these come early enough to be done properly, and mark them so the owner
knows not to skim.

1. **§38 · money back is NOT "paid out of pocket".** A coach describes both as *"a parent paid me
   back"* and they are opposites: one returns the team's own cash and owes nobody; the other means
   a family paid the vendor directly and **the team owes that family a credit**. The walk must do
   **both, on the same item, then open Player Dues and count the credits — expect exactly one.**
   Two credits, or none, is real money wrong in a real family's ledger. This is the step to do
   first if the owner only has ten minutes.
2. **§38 · the refund nets into the row it repaid.** One row, never two. No "refund" chip. And the
   $400 must **not** appear in Total revenue — if it is in both places the season reads $800 better
   than it is.
3. **§38 · one row, one source.** A row the fundraisers already answer for must refuse a typed
   income record — with a warning on the form *and* a refusal from the server if you save anyway.
   Money back against the same row must still be allowed.
4. **§29 · the totals still reconcile** and **one team cannot see another team's items.**
5. **§38 · a negative row must not read as good news.** File a refund against an item with no
   spending: the actual shows in brackets, e.g. `($125)`, and the variance says **nothing** — not
   "$125 under". This one was fixed during review; it is worth confirming it stayed fixed.

---

## Other things to watch out for

- **The report opens on Statement.** The chosen view is remembered **per device**, so to see the
  default the owner needs a browser profile that has never opened this screen (or cleared site
  data). Say so, rather than letting them conclude the default is broken.
- **Both shapes must end on the same Season net.** Read it in Statement, switch to By activity, read
  it again. Also check a cost-only category nets negative and says so in brackets.
- **The wording carries the polarity, not the colour.** Revenue reads `+$480` / `−$160`; costs read
  `$150 under` / `$160 over`. Ask the owner to confirm they could tell good from bad **with the
  colour ignored** — our overrun and healthy tones are near-identical to a deutan eye.
- **The category is now called *Fundraising***, not *Fundraising Costs*. That rename is intended.
- **The archive.** Open a completed season's Money: the Money in tab must list **that season's**
  arrivals and offer no Add, no pencil, no Delete. A figure you recognise from the live season is a
  stop-everything finding.
- **A phone pass at 390px** on the money form and the Money in list — the form now has three
  choices plus a timing question, and it is the widest it has ever been.
- **§29's own warning:** it replaced a picker built the same week. If the owner QA'd *"What is this
  against?"* or *"Not in the budget"*, both are gone — say so before they look for them.

---

## What "done" looks like

- A walkthrough the owner can keep open on a second screen and work down: numbered steps, an
  expected outcome per step, watch-outs called out, and the five critical steps marked.
- **Publish it as a Claude Artifact** so it is readable beside the app. Do not also write a copy
  into the repo — `OWNER_QA_LEDGER.md` is already the repo's record, and a second copy will drift.
- Group the steps by screen, not by ledger section, so the owner is not bouncing between pages —
  but **label each step with its ledger section (§29-C, §38-D…)** so results can be recorded back.
- **After the walk**, update the ledger: mark what passed, record what did not in the owner's own
  words, and follow the anti-drift wording rule — a positive fact with an anchor ("passed
  2026-08-__"), never a perishable negative.

---

## Environment notes (verified 2026-08-16, re-check before relying on them)

- Both sections are **on dev only**. §29 carries migrations 238/240/241/242; §38 carries **243 and
  244**. ⚠ **All of them must reach production BEFORE this code is promoted** — that is the release
  manager's checklist, not a QA step, but if the owner asks "can we ship this Friday", that is the
  answer.
- The dev server must be running (`npm run dev`) with the UAT fixture seeded.
- ⚠ **Other chats work in this same working copy.** Re-check the branch before committing anything,
  stage explicit paths only, and expect files you did not touch to be modified.
