# Club money belongs in the team's plan

**Status:** ⚙ **BUILT ON DEV 2026-08-30 (migration 271) — owner walk owed, ledger §124.** All five
ratified decisions shipped: the ask, the generic rows kept, the classification outliving the lock,
the Months vocabulary, and the headroom fix. Re-measured on the QA fixture: the hub card and the
report now BOTH read **$1,555** (they read $1,980 and $1,555 before), the expense band's Scheduled
column carries the **$1,570** of unpaid club instalments it used to omit, and answering the $325
"New money" moves it to its own revenue row with the season net **unchanged at −$3,545** — the
mockup's central claim, measured rather than asserted. ⚠ **Migration 271 is DEV ONLY**, prod-owed
behind 264 (held) / 268 / 269 / 270; its dev-vs-prod divergence is baselined in
`scripts/.schema-parity-baseline.json` the same way theirs are. ⚠ **One deliberate widening beyond
the mockup's annotation is recorded in §5.4** — the hub card also nets recorded money back, which
the QA fixture cannot exercise and `tests/unit/coach-money-summary.test.ts` therefore pins instead.

**Status (history):** approved by the owner 2026-08-15 · **RE-VALIDATED 2026-08-28** (planning session, no code
written). The re-validation found that **most of the approved mechanism was already built by a
different project** — the Money-tab redesign P4 (migration 250, owner QA §49, on production since the
2026-08-17 promote, **§49 itself still unwalked**) — but built with a **materially different design on
the money-IN side**: every club arrival is silently read as a reimbursement, which is the reading the
owner's §3.2 ruling exists to forbid. What remains of this project is the money-in choice plus three
report gaps. **⚖ RATIFIED 2026-08-30: the owner accepted D1–D5 as recommended (§7).** Build prompt:
`COACH_ORG_MONEY_IN_THE_BUDGET_BUILD_PROMPT.md` — fresh session, mockup gate item ONE. ⚠ The
One-Ledger fold (QA §119, 08-29) landed after the mockups: the hub tab is now **Ledger**; the
frames' substance stands, their incidental "Transactions/Payables" mentions read as Ledger.

**Mockups (2026-08-28, current — awaiting the owner's walk):**
https://claude.ai/code/artifact/7edf39c2-f2f8-4a3c-8b5f-ec9e4ca57389 ("New Money, or Money Back" —
drift register + six frames + decisions D1–D5).
**Mockup of 2026-08-15 (superseded — reasoning of record, do not build from it):**
https://claude.ai/code/artifact/069a4d63-d00a-4277-9888-4e2cb08f2778 — it predates the Club tab
merge, the shared category+item picker, and the Months cash statement.

**PM brief:** `COACH_ORG_MONEY_IN_THE_BUDGET_PM_BRIEF.md`

**Trigger:** owner, 2026-08-15 — *"why aren't the allocations showing up anywhere on the budget or
actual reports?"*

---

## 0. Drift register (2026-08-28) — the session's spine

Every concrete claim of the 08-15 plan, re-verified against the code and the live dev database.
**Verdicts:** ✅ stands · 🟡 stale (true then, product moved) · 🔴 reversed/contradicted · ⚖ decided
elsewhere since.

| # | The 08-15 plan says | The product does today (code-verified) | Verdict | What this plan now says |
|---|---|---|---|---|
| 1 | §1: club money appears in **no** plan surface; no link exists between a club bill and the team's plan | The link **exists and is on prod** (mig 250): both a club bill (per split) and a request carry the team's own category+item; Budget vs. Actual counts paid installments and approved *To club* as costs and nets approved *From club* into the cost it repaid; the register shows every piece | 🟡 mostly closed | §1 rewritten with the re-measured fixture. The observation survives only as items 2–4 below |
| 2 | §5.4: Budget **headroom on the Money hub** falls by club costs, rises by club funding | The hub's Budget card computes headroom from team expenses only — **blind to club money** — while the BvA screen's own headroom includes it. On the QA fixture the two read **$1,980 vs $1,555** today, a $425 disagreement one click apart | ✅ still a gap | In scope: the hub card adopts the report's arithmetic (§5.4) |
| 3 | §4: an unpaid allocation installment **flows into Scheduled** | Deliberately **excluded** — the route states club installments would fit but "adding them to both is its own question, not this one's." The Payment schedule and Next 30 days show them; the Months grid's Scheduled column does not, so Scheduled underquotes what the team is obligated to pay | ✅ stands (the exclusion was deferral, not reversal) | In scope: club installments enter the expense-band Scheduled, **remainder-only** per the 08-20 ruling ("scheduled is what we are currently obligated to pay") — not face value as the 08-15 text implied |
| 4 | §3.2: club money IN is **the coach's choice** — new money → a funding line; money back → a reversal. "Forcing one reading would be wrong about half the money" | **The shipped code forces the reimbursement reading on every arrival.** Every approved *From the club* request nets into the cost side unconditionally; the filing picker offers the money-out list on both directions; the help guide teaches this as the design ("Both pick from your spending words even when the money is coming in") | 🔴 contradicted by shipped work | **The core remaining build.** The §3.2 ruling stands unless the owner re-rules on the walk (Decision D1, §7). §3.2 rewritten as the delta on top of what shipped |
| 5 | §3.1: costs default to a synthetic **"Club costs"** report row; §3.2a: unfiled funding defaults to **"Club funding"** | Unfiled club money lands in the report's existing **"Not itemized" / "No category"** rows — the generic mechanism won by default when §49 shipped. A synthetic named category construct does exist (the "Paid back to families" pattern) and could host named Club rows if wanted | 🔴 shipped differently | Decision D2 (§7): keep the shipped generic rows (recommended) or add named synthetic Club rows. The old §7 question — "should the flagged row BE the mechanism?" — is hereby answered from the built report: it already is, for costs |
| 6 | §3.2a: the funding branch **creates a money-in line with no budgeted amount** | Not representable: a budget line's amount is NOT NULL and must be positive. But no line is needed — an income record filed against category+item already renders as its own revenue row with a **dash** in Budget when nothing was planned (the same flagged-row parity the ruling asked for) | 🟡 stale mechanism, intent intact | §3.2a rewritten: the funding read files category+item on the request (in-side); **no budget line is ever created**. Parity comes from the derived flagged row |
| 7 | §3.2c: the ask is titled **"What is this?"**, lists end in "+ New funding…" / "+ New expense item…" | "What is this?" is now the Record form's item-picker label (P2 moved it) and also Fundraising's kind question — an acknowledged collision the forms review owns. The shipped create door reads **`+ Add "…" to your list`** inside the one search box, never a per-kind menu entry | 🔴 both labels stale | §3.2c rewritten: the ask is **"New money, or money back?"**; the picker keeps its shipped label and create door. One door survives by construction — the door is the picker's own inline add |
| 8 | §3.4: a pending request **never appears in any budget surface** | Reversed by a later owner ruling (§49): a pending *From club* request shows on the Months grid's **Scheduled** lens ("Asked of the club") and in Transactions under scheduled — undecided, undated, in the "No date yet" column, in the Total and in no month, out of cash and out of Actual | ⚖ reversed since, deliberately | §3.4 rewritten to record the shipped rule. Nothing for this build to change |
| 9 | §4: `scheduled` docstring quote; "payables already feed it" | Docstring unchanged, but the feed's semantics moved: Scheduled quotes the **remainder**, settled pieces leave it (owner 08-20). Categories/Statement view still has no committed-vs-paid distinction at all (Budgeted · Actual · Variance only) | 🟡 partly stale | §4 rewritten. The Categories-view gap stands but stays **out of scope** here — it is a report-shape question, not a club-money one |
| 10 | §5: "Org Allocations gains a field… Payments gains the same field…" | Both screens are one **Club** tab (badges *To club / From club*, "Awaiting the club"); filing shipped as the **"What was this bill for?"** modal per bill and a **"What is it for?"** picker on the request window, both offering the out-side list only | 🟡 stale naming, partly built | §5 rewritten for the merged tab. The money-in half of the request window is what this build reworks |
| 11 | §6 rules 1–8 | Largely **already enforced by shipped code**: never-both (a request is exactly one of cost/refund), brackets everywhere, negative actual never reads "under budget" (guarded in the variance wording), `ON DELETE SET NULL` on the filing, re-filing moves no money, no backfill (mig 250 shipped with none) | ✅ stand | §6 kept verbatim with status stamps. Rule 3 (never guess a reversal) is the one the shipped money-in behavior breaks — see D1 |
| 12 | §7: build third, after category+item and money-back | Both predecessors built, QA'd, merged (mig 243); the club filing itself shipped inside the tab redesign. Sequencing text is history | 🟡 obsolete | §8 rewritten: the only live coordination is with the **forms review** (parallel planning; sequenced builds) |
| 13 | §9: help says allocations show on Payment schedule / Next 30 days | The help guide was rewritten with §49 and **now documents the forced-reimbursement design as a feature**; the Months guide documents "Asked of the club" and the club drill-ins. Both must change again if D1 ships | 🟡 stale in the other direction | §9 rewritten |
| 14 | (not in the 08-15 plan) | **Since shipped and binding here:** club lists are season-scoped; an unanswered request **blocks season close**; an answered request's record window **locks** (pencil/eye); the club installment's one-tap "Record as paid" never opens the Record conversation (ruling R-D); club records carry no money tags and no family payer | ⚖ new ground rules | Absorbed into §3/§5. The build must not disturb any of them |

**Boundary homework (prompt §2.6), argued from code:** filing a club bill is classification of money
the club already recorded — an *expectation's* label, not an event. The centralization plan's §4
explicitly rejected club requests entering the Record conversation ("correspondence, not recording"),
its §6 leaves them unchanged, and ruling R-D keeps the installment's one-tap out of the conversation.
The shipped filing controls already live on the Club tab (the bill's own row, the request's own
window). **Conclusion: the meaning-ask belongs on the Club tab's records, never as a ninth sentence
in the conversation.** Nothing here re-opens the framework.

**Found-by-this-session, handed to the forms review** (noted in its prompt; not fixed here):
1. `club/panel.tsx:842` — *"Until it's filed, this bill doesn't appear on Budget vs. Actual"* is
   **false**: the report deliberately counts unfiled club money under "Not itemized" (the route says
   so in its own comment). The sentence teaches a coach the opposite of the design.
2. One filing question wears two labels one section apart: the bill modal is titled "What was this
   bill for?", the request window's field is "What is it for?".
   ⚠ The forms review should also know **this project will rework the request window's money-in
   half** (the *From the club* branch) — polish recommendations there would be wasted.

---

## 1. The observation, re-measured (dev, 2026-08-28 — QA Money Lab / QA Mid Season U14)

The 08-15 measurement is superseded. Today the fixture plans **$5,100** (4 cost lines), has
**$3,120** of expenses (all settled; $120 of it family-fronted), and the club has billed **$2,120**
in three bills — **$550 paid, $1,570 outstanding** across 7 installments. Requests: **$325**
approved *From club*, **$200** approved *To club*, **$180.50** pending, **$240** denied. Every club
record is **unfiled** (the fixture predates mig 250).

| Surface | Club money today |
|---|---|
| Cash on hand (In / Out) | ✅ unchanged — always counted it |
| Next 30 days / Payment schedule | ✅ installments coming due |
| **Budget vs. Actual, Actual lens** | ✅ **since mig 250**: $550 + $200 as costs, $325 netted as a refund — under "Not itemized"/"No category" while unfiled |
| **BvA screen's own headroom** | ✅ reads **$1,555** ($5,100 − $3,545, club money included) |
| **Money hub Budget card** | ❌ reads **$1,980** ($5,100 − $3,120) — still blind to club money; disagrees with the report one click away |
| **Months grid, Scheduled** | ❌ the $1,570 of unpaid installments appear nowhere in it (deliberate deferral, §0 row 3); the pending $180.50 does appear ("Asked of the club", no date) |
| **The meaning of money in** | ❌ the $325 the club paid back was **forced** into the reimbursement reading — a genuine grant would be misread the same way, and no screen asks |

So the original complaint is half fixed by other hands: the report sees club money; the hub card
still lies, the forward view still under-quotes obligations, and the one real decision — what an
arrival *means* — is answered by the code instead of the coach.

## 2. What already shipped, and where it lives

Built by the Money-tab redesign P4 (mig 250, owner QA **§49 — on prod, unwalked**) and its
neighbours; this plan builds **on top of** all of it:

- **One Club tab** (Allocations + Payments merged), standing band of three figures (*Still to pay
  the club / Waiting on the club / Settled this season*), badges *To club / From club*, *Awaiting
  the club*.
- **Filing**: per **bill** (one filing covers its installments) via the "What was this bill for?"
  modal; per request via the record window's "What is it for?" field. Both use the shared
  category+item search box (one control across the money form, Budget Plan and Club) — **out-side
  list only, on both directions** (the half this plan changes).
- **The report**: paid installments and approved *To club* → costs; approved *From club* → netted
  into the item it repaid, brackets, dated the day it was decided; unfiled → "Not itemized".
  Pending *From club* → Scheduled, "Asked of the club", no date. The register carries every piece
  (`kind: 'club'`, no Mark-paid — settlement stays on the Club tab).
- **Ground rules now standing** (§0 row 14): season-scoped lists; unanswered request blocks season
  close; answered request's window locks; one-tap "Record as paid" stays out of the Record
  conversation; no tags, no family payer on club records.
- **The refund mechanism** (`COACH_MONEY_BACK_ON_A_COST_PLAN.md`, built, mig 243): the general
  money-back kind this plan's Reimbursement branch hands off to. Its rules are inherited, never
  restated (§3.2d).

## 3. The model — what stands, what remains

Three kinds of club money, two destinations. §3.1 is **shipped**; §3.2 is **the build**.

### 3.1 Club money OUT → a cost, against a cost item ✅ SHIPPED (mig 250)

As approved: allocations (filed on the bill, covering every installment) and approved *To club*
requests file against the team's own category+item, exactly as an expense does. The club decides
what the team is billed; which of the team's own words it counts against is the coach's call.
**Delta shipped instead of the approved default:** unfiled money lands in the generic
**"Not itemized" / "No category"** rows, not a synthetic "Club costs" row — Decision D2 (§7).

### 3.2 Club money IN → the coach chooses what it *is* (owner ruling 2026-08-15 — STANDING, and the shipped code currently breaks it)

An approved **From the club** request is filed as **either**:

| Choice | What it means | What it does to the plan |
|---|---|---|
| **New money** | A grant, a subsidy, a cost the club simply agreed to carry | Its own **revenue** row (category+item, in-side); a dash in Budget when nothing was planned |
| **Money back** | The club returning money the team fronted | Nets into the cost item it repaid, brackets, dated when decided — the shipped behavior, now chosen rather than assumed |

⚠⚠ **NEITHER CHOICE EVER TOUCHES ANYBODY'S DUES** (owner correction 2026-08-15; the first draft got
it wrong twice in one sentence). A coach who receives extra funding usually spends it on extra
things; passing it on is a deliberate edit on the screen that owns the schedule.

**As-built today (the thing D1 rules on):** `charge_to_org` ⇒ reimbursement, unconditionally; the
request's picker offers only the spending words; the help guide teaches it as the design. A genuine
club grant is currently netted into whatever cost it was filed under — or into "Not itemized" — and
the fact the club contributed is invisible. That is precisely the "wrong about half the money"
outcome the ruling names.

**Where the ask lives:** on the request's *From the club* branch, at create/edit time — **required**,
so rule 3's "never guess" is satisfied by never needing a default on new records. **Existing
approved rows keep the reimbursement reading they already report under** (no backfill, no report
restatement); a coach can re-file one deliberately.

**After the club answers:** the record window locks (standing ruling — it records what the club
acted on), but the **team's classification stays editable**: approved *From club* rows gain the same
*Files under · Change* affordance a bill has, opening the meaning-ask + picker only. Re-filing moves
no money. *(Mockup frame 2; ratify on the walk.)*

### 3.2a Unbudgeted money in gets its own named row ✅ mechanism already exists

The 08-15 text asked for "a funding line with no budgeted amount" — not representable (a line's
amount is positive by constraint) and **not needed**: money filed in-side against a category+item
already renders as its own revenue row with a **dash** in Budget when nothing was planned, the exact
parity of the cost side's flagged row. **No budget line is ever created on the coach's behalf**
(standing ruling — the bucket is a report row, not a line; building a line is the coach's deliberate
upgrade out of it).

### 3.2c The meaning is asked FIRST, then a short list (owner 2026-08-16 — STANDING, reworded for the shipped grammar)

Two steps, never one long grouped dropdown:

1. **"New money, or money back?"** — a required dropdown of two sub-lined options (the Record
   form's own "What happened?" precedent; the phrase "What is this?" is contested property and is
   not used). *New money for the season — a grant, or a cost the club agreed to carry* ·
   *Paying us back for a cost — nets into the cost it repaid*.
2. The picker that answer needs — the **same shared search box**, list switched to the in-side or
   the out-side. Its create door is the shipped one: **`+ Add "…" to your list`** (and
   `+ Add custom category…` behind it). **One door survives by construction** — the door is the
   picker's own inline add; no per-kind menu ever exists to go stale.

⚠ This is not a length fix (standing reasoning): the meaning is the one real decision, and asking
it outright is what keeps the list short and one-sided. ⚠ The Reimbursement branch is the general
refund mechanism (§3.2d) — same netting, same words, club as one source among several.

### 3.2b ⚖ CLOSED — retained as reasoning of record

Money in carries category+item; both directions share one taxonomy and one picker (built, mig 243).
The `sponsorship` **kind is left alone** (owner 2026-08-16): the kind/category redundancy is
accepted, has its own TODO entry, and is never fixed in passing — the last enum change broke 19
readers silently and the failure mode was over-billing families. **And club funding is not "like a
sponsorship" — never describe it that way**: a sponsorship's player credit lowers one family's dues;
club funding belongs to the whole team and is credited to nobody.

**Why the fork is the coach's (the whole point, kept verbatim):** a grant and a reimbursement are
different events that arrive as the same transaction. Read a reimbursed permit as funding and the
cost line still claims spending the club ultimately carried, so next season plans off an inflated
line. Read a genuine grant as a reversal and it vanishes into a cost line it was never about,
hiding that the club contributed at all. Both net out at the season level; the harm is in the report
a coach actually uses.

### 3.2d ⚠ The reimbursement half is `COACH_MONEY_BACK_ON_A_COST_PLAN.md`'s — BUILT, hand-off confirmed

Verified as shipped: "Money back on something we paid" is a first-class kind on the Record form,
files against the spending words through the same picker, nets into the item's row (one row never
two), dated when it arrived, brackets not minus, an item may go negative and never reads "under
budget" (the variance wording is guarded). A club reimbursement is one **source** of that mechanism.
⛔ **Do not re-specify the refund rules here** — they are inherited by pointer.

### 3.4 Pending requests — ⚖ the 08-15 rule was reversed by a later owner ruling

The 08-15 text said a pending request never appears in any budget surface. The shipped, ruled
design: a pending *From club* request shows on the **Scheduled** lens as *"Asked of the club"* —
undecided, undated (the "No date yet" column: in the Total, in no month), out of cash, out of
Actual, marked in Transactions as still a question. **Nothing for this build to change.** A pending
*To club* request stays out of both bands.

## 4. Committed-but-not-paid — the deferred half this build closes

Scheduled means *what we are currently obligated to pay* (owner 2026-08-20) and quotes remainders,
not face values. Payables feed it; **club installments deliberately don't** — the route's own
comment calls adding them "its own question, not this one's". **This is that question, and the
answer is yes**: an unpaid club installment is an obligation with a due date, and its absence makes
Scheduled disagree with the Payment schedule and Next 30 days beside it. The build adds unpaid club
installments (remainder-only, same category identity as their bill's filing) to the expense-band
Scheduled column.

The Categories/Statement view still has no committed-vs-paid distinction (Budgeted · Actual ·
Variance only). That gap is real and **out of scope here** — it is a report-shape question for its
own session, and it must use the word *Scheduled* when it comes.

## 5. What a coach sees (rewritten for the product of 2026-08-28)

1. **The Club tab, cost side — unchanged.** Bills file as they do today; the two filing labels are
   the forms review's to reconcile.
2. **The request window's *From the club* branch gains the ask**: "New money, or money back?" then
   the one search box, list switched by the answer. Required on create; the coach can change both
   later from the row's *Files under · Change* even after approval (the record window itself stays
   locked once answered).
3. **Budget vs. Actual**: a new-money arrival becomes its own revenue row (category+item, dash in
   Budget when unplanned) instead of silently shrinking a cost; a money-back arrival keeps today's
   netting. On the Months grid a new-money arrival lands in the revenue band (its own subject under
   the income groups, "the club" named on the row) — "Repaid by the club" keeps meaning exactly and
   only money back.
4. **The Money hub's Budget card stops disagreeing with the report**: headroom adopts the report's
   arithmetic (club costs subtract, netted refunds return, new money does **not** inflate headroom's
   cost side — it is revenue, and headroom is a cost figure; the card's fine print says what it
   counts).
   ⚠⚠ **BUILT ONE TERM WIDER THAN THE MOCKUP'S ANNOTATION, DELIBERATELY (2026-08-30).** Frame 6
   annotates the fix as *"$750 of club costs, minus the $325 that came back"* — club money only. But
   the card was equally blind to **money back a coach RECORDS** against a vendor refund: the report
   nets those into the cost they repaid and the card never did, so the same one-click-apart
   disagreement survived for any team that has ever been refunded a dollar, club or no club. D5's
   own wording is *"club costs subtract, netted money-back returns"* — not *club* money-back — so
   both halves shipped. Leaving one would have forced the card's new fine print to say "counts the
   club's repayments but not yours", which is not a sentence this product can print.
   ⚠ **AND THE FIXTURE CANNOT PROVE IT.** QA Money Lab holds **zero** recorded money-back records,
   so a re-measure shows the card and the report agreeing while that term is multiplied by nought —
   a green check over an empty fixture. The arithmetic is therefore a pure function
   (`spendAgainstPlan`, `lib/coach-money-summary.ts`) with each term pinned individually in
   `tests/unit/coach-money-summary.test.ts`, including a test asserting the function takes **no
   argument** by which new money could ever enter a cost figure.
   ⚠ **ONE KNOWN DIVERGENCE FROM THE ROLLUP, STATED NOT HIDDEN**: a refund filed against an item
   that is revenue and nothing else nets on the REVENUE side in the report (`sideForRefund`) and
   off spending here. It needs a word with no cost side at all — which the money-back form's picker
   cannot produce — so it takes a word being moved between sides after the fact. If it ever bites,
   the fix is that function learning the rule, not the card growing a caveat.
5. **Scheduled tells the whole truth**: unpaid club installments join it, remainder-only (§4).
   ⚠ **Measured on the fixture after the build: $1,570, in five due months, each row named
   "— installment 2 of 4" and openable.** ⚠ Remainder and face value are the SAME NUMBER for a club
   instalment — it is settled or it is not, nothing in the product records a part payment against
   one — and the code says so rather than leaving a reader to think the rule was skipped.
6. **Nothing is filed for the coach, and unfiled money is never hidden** — it counts under
   "Not itemized" from day one (shipped behavior, kept); filing is a refinement. The Club tab's
   false sentence about unfiled bills is corrected wherever the forms review lands.

## 6. Rules the build must hold (all standing; status stamped)

1. ⚠ **NEVER BOTH** — funding **or** reversal, strictly. *(Enforced by shape today: a request is
   exactly one of cost/refund; the ask keeps it so.)*
2. ⚠⚠ **NOTHING HERE EVER CHANGES A PAYMENT SCHEDULE** — not a dollar of anyone's dues, on either
   choice, ever. The ladder is a planning view; the dues schedule is real obligations, and only the
   coach edits it. *(The rule most likely to be broken by accident.)*
3. ⚠ **DEFAULT TO THE BUCKET; NEVER GUESS A REVERSAL.** *(Currently broken by the shipped
   money-in behavior — D1. Satisfied going forward by asking, required, on create; legacy rows keep
   their reading until a coach re-files.)*
4. ⚠ **A LINE'S ACTUAL MAY GO NEGATIVE — show it, don't block it.** *(Shipped: brackets, and the
   variance wording refuses to read a negative as "under budget".)*
5. ⚠ **THE PICKER OFFERS THE COST SIDE ONLY, FOR COSTS** — club money in is the one case that may
   address both sides, and only after the ask. *(The dead paragraph about shapeless funding lists
   stays dead — both halves are the same control.)*
6. ⚠ **DELETING A PLAN ROW NEVER DELETES A RECORD OF MONEY.** *(Shipped: the filing is
   `ON DELETE SET NULL`.)*
7. ⚠ **RE-FILING MOVES NO MONEY** — the classification stays editable on a paid/approved record.
8. **NO BACKFILL** — historic club money keeps the reading and the bucket it has until a coach says
   otherwise. *(Mig 250 shipped with none; the meaning column does the same.)*

## 7. Decisions — ⚖ ALL FIVE RATIFIED AS RECOMMENDED (owner, 2026-08-30)

D1 build the ask · D2 keep the shipped generic rows (no named Club buckets) · D3 the classification
outlives the lock · D4 the Months vocabulary as drawn · D5 the headroom fix ships in this build.
The reasoning below is retained as the record of what was decided:

- **D1 — the money-in ask itself.** The §3.2 ruling stands on paper; the product shipped the
  opposite (silent reimbursement, out-side words, help copy teaching it). **Recommended: build the
  ask** (§3.2/§3.2c) — the ruling's reasoning is untouched by anything that shipped. The honest
  alternative, if the owner now prefers the shipped behavior, is to strike §3.2 deliberately and
  re-title the feature "club money is always settlement" — that is a re-ruling, not a drift fix.
- **D2 — named Club rows vs. the generic bucket.** Approved: synthetic "Club costs"/"Club funding"
  rows. Shipped: unfiled club money in "Not itemized"/"No category" beside everything else.
  **Recommended: keep the shipped generic rows** — a third bucketing construct for one source buys
  little once filing is one tap and the register names the club on every row; the mockups draw both
  so the choice is looked at, not assumed.
- **D3 — post-approval editability of the classification** (§3.2's *Files under · Change* on an
  approved request) — confirm it squares with the "locked once answered" ruling as drawn: the
  window locks; the team's label doesn't.
- **D4 — the Months grid placement of new money** (its own subject row under the income groups,
  "Repaid by the club" reserved for money back) — confirm the vocabulary on the frame.
- **D5 — scope check on the hub headroom fix** (§5.4): it changes a number coaches already watch;
  ship it in this build (recommended — it is the surviving half of the original complaint) or as
  its own small release.

## 8. Sequencing & coordination

The 08-15 queue (category+item → money-back → this) is history: both predecessors are built and
QA'd, and the filing itself shipped inside the tab redesign. What remains:

- **The forms-review session may run in parallel with this planning; the BUILDS are sequenced.**
  Whichever build goes second re-reads the first's changes to the Club tab. This plan reworks the
  request window's *From the club* branch; the forms review knows (§0, found-by-this-session note).
- This build touches the BvA route, the hub summary and the Club panel — none of the Record
  conversation, none of settlement (`expenseTotals` reads neither club table; keep it that way),
  none of the payer mechanics (club records have no family payer).
- **Schema**: the request's meaning (funding vs money back) is one new nullable column on the
  requests table — data dictionary + snapshot refresh in the same unit of work, no backfill
  (NULL = legacy = today's reimbursement reading).
- **QA fixture**: `qa-money-lab` / QA Mid Season U14 is seeded for exactly this and its club records
  are deliberately unfiled; re-measure §1's figures on the walk after the build.

## 9. Follow-through

- **Help docs** — the Club-screen guide now documents the forced-reimbursement design as a feature
  (*"Both pick from your spending words even when the money is coming in"*) and must be rewritten
  with D1; the Months guide's "Money back & reimbursements" drill-in and "Asked of the club" copy
  gain the new-money case. Same unit of work as the build.
- **Demo sandboxes** — the coach demo's club money exists but is **entirely unfiled**, and the tour
  lost its club sentence in the prose-trim (its comments still describe one — stale). This project
  **adds** to the three-releases-stale coach-money narration debt: the build must seed a filed
  allocation, the $180 repayment filed as money back, and one new-money arrival — and re-read the
  whole coach-money narration (dock + tour) in the same unit of work, per the CLAUDE.md demo rule.
  `check-demo-coach.mjs` asserts the seeded states.
- **Owner QA ledger** — new section on completion; note §49 itself is still unwalked and this build
  sits on top of it.
