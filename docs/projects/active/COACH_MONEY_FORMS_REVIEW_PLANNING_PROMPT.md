# Planning prompt — the money forms centralization did NOT absorb

**Owner-called 2026-08-24, mid-P2-close. ⚠ SEQUENCED: do not open this until money centralization
P3 (tags + debt) and P4 (payer on a payment) are BUILT.** The whole point is to measure the
surviving forms against a finished framework; measuring against a moving one produces a plan that
is wrong by the time it is read.

**This is a PLANNING session. Write no product code.** Output is an evaluation, a gap list,
recommendations and mockups — then the owner walks it form by form and adds their own findings, and
only then does it become a standalone project with its own plan + PM brief.

---

## 1 · The owner's brief, in his words

> *"Once we finish the centralization forms and workflow, have a subsequent planning session to
> review those existing forms and see if anything needs to be updated to fit into our new
> framework. Start with a planning session. In that session I want you to take all of the money
> entry forms, do a first pass to evaluate how they currently function and if you see any gaps
> compared to our current model, report those gaps and recommendations for improvements including
> mockups. Then I will walk through form by form and provide any additional findings I have. Once
> this planning session is done we can turn that into a subsequent standalone project."*

Two things that phrasing settles, and they are load-bearing:

1. **The first pass is YOURS.** Evaluate every form and say what you think is wrong. Do not hand the
   owner a questionnaire; hand him findings he can argue with.
2. **His walk comes after, and adds to it.** So the deliverable must be walkable form by form —
   one section per form, in a fixed order, each with its own findings — not a themed essay.

## 2 · Why these forms were left alone, and why that is not a permanent answer

Centralization drew one line: **expectations vs. events.** Money that MOVED became one recording
conversation; money that is PLANNED — budgets, dues schedules, drive definitions, commitments, the
club's bills — stayed on its own screen. Every form in §4 below is on the expectations side of that
line, or is an EDIT of a record (correcting is not recording), which is why P1–P4 deliberately never
touched them.

⚠ **That decision is not under review here.** The owner reaffirmed it on 2026-08-24: *"since this
project set out to leave those original modals as is, I am fine to continue that approach."* This
session asks the narrower question: **now that a coach meets one grammar when they record money, do
these forms still read as part of the same product?** A form can be correctly scoped and still be
wearing the old vocabulary, the old shapes and the old habits.

**So the yardstick is consistency and quality, NOT absorption.** A recommendation that says "fold
this into the conversation" is almost certainly wrong and needs to argue against §2 of
`COACH_MONEY_CENTRALIZATION_PLAN.md` explicitly to be taken seriously.

## 3 · What "a gap" means — the tests to run on each form

Apply all of these; they are the framework the recording conversation now embodies.

1. **Does its door say what pressing it makes?** Every recording door converged on **Record**;
   setup doors are supposed to name their outcome (*Add a commitment*, *New Fundraiser*,
   *Generate Player Installments*). A bare verb is the dialect problem in its last hiding place.
2. **Does its title name the thing?** Same test, one level in.
3. **Does it use a word that now means something else?** The single highest-value check —
   centralization MOVED vocabulary, so a phrase that was unambiguous in July may now collide.
4. **Does it state its consequence in dollars before saving?** The recording conversation's best
   habit. A setup form's honest consequence is often *"nothing moves"* — which is worth SAYING.
5. **Is its one-value field a dropdown?** Standing convention (owner, 2026-08-22). ⚠ **Radio rows
   with a sub-line under each option are EXEMPT** — both options have to be read to be chosen
   between. Do not flag those; that exemption is on the record.
6. **Does a refusal carry the door?** The conversation's future-date refusal hands the coach to
   Payables with their typing intact. Which of these forms refuse and then abandon?
7. **Does it clear its own state between opens?** The repeated defect class in this area — a sheet
   reopening with a stale target still set. (One such was a Critical: a blank-looking dues panel
   silently PATCHed a family's first receipt.)
8. **Does it survive a read-only money assistant, and a finished season?**
9. **Does the phone get a usable version of it?** ⚠ Phone money TABLES are a separate sequenced
   session; form layout at 361px is fair game here, tables are not.

## 4 · The inventory — verified against the tree 2026-08-24, RE-VERIFY BEFORE USE

This repo's plans have been wrong before; this list is a starting map, not evidence.

**Fundraising**
- **New fundraiser / sponsor** — one modal, titled literally **"New"**, first field labelled
  *"What is this?"* (Fundraiser | Sponsor, radio rows with sub-lines). Sponsor branch: name, notes,
  amount, status (Pledged default), brought-in-by, and a per-family credit control that appears
  once a player is named.
- **Fundraiser Settings / Sponsor** — the edit twin of the above.
- **Edit amount** — the leaderboard's inline correction (gained *Date received* in P2).

**Player Dues**
- **Edit schedule** · **Generate Player Installments** (its own modal)
- **Add Credit** — ⚠ carries a known debt item: its type picker offers two kinds the API refuses.
  P3 owns that fix; do not double-book it.
- The drawer's **payment correction** panel (add half moved to the conversation in P2).
- **Set refund** — the season settlement's per-family sheet.

**Budget Plan**
- **Add Line** / **Edit line** · **Manage our items** (rename/move an item's side)

**Payables / Transactions**
- **Add a commitment** — the shared form in setup mode; the ONLY door to a payment schedule.
- The installment plan editor and the per-installment scope sheet.
- **Manage money tags** — ⚠ P3 territory.
- The two importers (budget import sheet, payables importer).

**Club**
- **New request** and the request record window · **"What was this bill for?"** (filing a club bill
  against a budget item)

**Team settings → Money** — the two team-wide dues settings.

## 5 · Two gaps already found (2026-08-24) — carry them in, do not re-derive

Found while the owner was looking at the Fundraising New form on the day P2 closed:

1. **The modal is titled "New".** `COACH_MONEY_CENTRALIZATION_PLAN.md` §3 lists the verb dialects
   to retire as *Add / Record a payment / Record payment / Log amount / Mark paid / **New***. P2
   converged the first five because they record money; **this one survived on a technicality** and
   no phase is scheduled to finish the job. Suggested: title it for what it makes, following the
   answer — *New fundraiser* / *New sponsor*.
2. **"What is this?" now means two different questions one tab apart.** On the recording form it is
   the budget-item-and-bills picker (*"What did this pay for?"* on the spend branch). Here it asks
   *fundraiser or sponsor?*. **P2 caused this collision by moving the phrase**, which makes it this
   project's to clean up. Suggested: *"Which kind?"* here, freeing the phrase to mean one thing.

Found 2026-08-28 by the org-money re-validation session (carry these in too; it did not fix them):

3. **The Club tab's unfiled-bill sentence is false.** `club/panel.tsx:842` reads *"Until it's
   filed, this bill doesn't appear on Budget vs. Actual"* — but the report deliberately counts
   unfiled club money under "Not itemized" (the BvA route says so in its own comment). The copy
   teaches the opposite of the design.
4. **One filing question, two labels one section apart on the Club tab:** the bill-filing modal is
   titled *"What was this bill for?"*; the request window's field is *"What is it for?"*.

⚠ **The org-money build will REWORK the request window's money-in half** (the *From the club*
branch gains a required "New money, or money back?" ask and a side-switching picker — see
`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` §3.2). Evaluate that form as it is, but don't invest
polish recommendations in the half that is being redrawn.

⚠ Also verified that day and **NOT** gaps: the Fundraiser/Sponsor radio pair is legitimately exempt
from the dropdown convention (test 5); the per-sponsor credit control does exist; the Pledged
default and its *"counts toward the plan, never as money in"* line are good and should not move.

## 6 · The deliverable

1. **One section per form, in the §4 order** — what it does today (from the CODE, not from a plan),
   then its gaps against §3's tests, then a recommendation. Say "no gaps" where there are none;
   a list where every form has findings is a list nobody trusts.
2. **A gap register** — every finding in one table, severity-ranked, so the owner's walk has a
   spine. Flag which are pure vocabulary (cheap), which are shape changes (need a mockup), and
   which touch a write path (need their own care).
3. **Mockups, as a Claude Artifact, in the house style** — the owner's standing rule. Draw only
   what a sentence cannot settle: a renamed label needs no picture, a re-shaped form does. Stamp
   rulings in place as they are taken.
4. **A recommended sequence** for the standalone project that follows — cheapest-highest-value
   first, and explicitly what should NOT be done.

⚠ **Then STOP and hand it to the owner's walk.** He goes form by form and adds findings; those
amendments are what turn this into the project's spec. Do not start writing the plan document
before that walk.

## 7 · Standing rules a session here must not reverse on the way past

- **Expectations stay on their screens** (plan §2). Payables keeps *Add a commitment* — it is the
  only door to a payment schedule anywhere in the product.
- **The one-taps stay, forever**: dues *Record as paid* / *Record rest as paid*, the installment
  banknote button, the club installment's single tap.
- **Editing is not recording** — correction forms stay where the record lives.
- **A door that names one RECORD locks; a door that names a SCREEN only suggests** (owner ruling A).
- **Payables' tab fold is deferred and OWNER-LED** (§5.2) — do not take it on the way past.
- **Phone money tables are a separate sequenced session.**
- Whatever P3 and P4 have by then decided about tags and payer-on-payment is settled input, not
  material to re-open.

## 8 · Links

- Framework + rulings: `COACH_MONEY_CENTRALIZATION_PLAN.md` (§2 the framework, §5 the three
  rulings, §8 the phases).
- The P2 gate rulings that set the current grammar: the **"THE GATE OUTCOME"** section of
  `COACH_MONEY_CENTRALIZATION_P2_BUILD_PROMPT.md`.
- What the recording conversation looks like as approved: `claude.ai/code/artifact/783efa1e-…`
  (mockups 01–06), `claude.ai/code/artifact/e5936cd3-…` (frames A–D),
  `claude.ai/code/artifact/d92be400-…` (the P2 questions A/B/C).
- Owner QA: §80 (P1, passed) and §87 (P2) — the walks that show what the grammar had to survive.

---

*(A 2026-08-28 scope addition about the Add-a-bill form's visual composition was placed here for
a few hours and REMOVED by owner direction the same day — that form is the Ledger fold's own
work, and it has its own dedicated pass:
`COACH_ADD_A_BILL_FORM_DESIGN_PASS_PROMPT.md`. This session's scope is unchanged.)*
