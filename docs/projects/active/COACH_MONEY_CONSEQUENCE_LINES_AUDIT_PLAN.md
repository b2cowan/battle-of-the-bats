# Coach Money — the consequence lines are unverified claims

**Status:** proposed, 2026-09-02 · **Owner ruling:** its own project, not folded into the forms-review
walk (*"it may get missed in the forms review walk… quick but isolated to its own"*) · **Mockup gate:**
solutions drawn before anything is built.

---

## 0 · Why this exists

On every money form the product makes the coach a promise about something they cannot see:

> **When you save:** $200 comes back in, and **Umpires** drops by $200 on Budget vs. Actual — it
> isn't counted as income, and **nobody is owed anything**.

These sentences are the product explaining an invisible consequence at the moment money moves. They
are also **unverified factual claims written in prose**, and **no gate in this repo can check one**.
Spelling, tokens, contrast, layout, the dictionary and the schema ratchets all pass happily on a
sentence that is confidently false.

### The three that were actually wrong

1. **FALSE, fixed 2026-09-01.** The club filing dialog said an unfiled bill *"doesn't appear on Budget
   vs. Actual"*. The report deliberately counts unfiled club money under **Not itemized** — it always
   appeared, it just had no name. The sentence taught the coach the **opposite of the design**, on
   the screen where they would act on it. It read fluently and survived a build, a `/simplify` and a
   `/review`.
2. **INCOMPLETE, live today.** Money arriving as income says *"Cash on hand goes **up** by $X."* The
   same form's **refund** branch — money arriving for the same coach on the same screen — describes
   the netting and the fact nobody is owed, and **never mentions cash on hand at all**. A refund does
   raise cash on hand. Found in ten minutes while sizing this project.
3. **WRONG LABEL, fixed 2026-08-25.** The Payables band totalled a field meaning *remaining* on an
   unpaid piece and *full amount* on a paid one, under the words **"still owing"**. The words went
   out with the bug — but they had shipped, describing a figure that was not that figure.

⚠ **The point is not that three were wrong. It is that all three read perfectly.** Several of these
lines already carry `/review` annotations in the code, i.e. they have had scrutiny, and one still
shipped false. **Reading a claim is not checking it.**

## 1 · Scope — small, and deliberately bounded

**~25 customer-visible sentences** that assert a consequence:

| Where | Count | Shape |
| --- | --- | --- |
| Record-money form (costs, arrivals, refunds, out-of-pocket, bills) | 10 | `When you save: …` |
| Player dues | 2 | `When you save: …` |
| Sponsor promise | 1 | `When you save: nothing moves.` |
| Club fold (bill + request filing) | 4 | `…reports under X on Budget vs. Actual` |
| Unplanned-item field warnings | ~8 | `…will show as spending you didn't plan for` |

**IN scope:** does the sentence match what the save actually does.
**OUT of scope:** tone, voice, length, rewriting for style. A sentence that is accurate is finished.
**OUT of scope for now (owner to rule):** the in-app help articles restate many of these claims in
their own words. Including them roughly doubles the work; the recommendation is screens first,
because the screen is where the coach acts and `/docs` already sweeps help.

## 2 · How each claim gets checked

⚖ **EXECUTE THE PATH, DO NOT READ THE SENTENCE.** Reading is what let all three through.

Each line names one or more figures. The check is: put the form in that state, save, and look at the
figures it named — cash on hand, the budget line, the month, the family credit, the register row.

⚠ **Where a pure module owns the arithmetic, run the module** (`spendAgainstPlan`, `cashOnHandCents`,
the settlement pot) rather than reading a screen — the repo's standing lesson. A screen can agree
with a wrong sentence if both derive from the same mistake.

⚠ **A fixture that cannot reach the state proves nothing.** Several branches (out-of-pocket, the
paid-edit case, the sponsor promise) need a fixture in that exact state; note any claim that could
not be exercised rather than marking it verified.

## 3 · The deliverable is a mockup FIRST

Per the standing rule, the owner sees drawn options before anything is built. The mockup proposes
how to stop the next one, not merely how to fix these:

- **A · Audit only.** Fix what is wrong, change nothing structural.
- **B · Derive the figures.** The sentence stops asserting numbers and starts reporting them, from
  the same module the save will run — so the sentence cannot disagree with the outcome. Precedent
  exists: `previewCreditLanding` moved into `lib/dues-credits` so the recording conversation draws
  the SAME preview the writer uses.
- **C · Prose plus a compact "what moves" line** rendered from the real figures.
- **D · Retire the prose for a structured consequence block.**

⚠ **B cannot cover everything.** Claims like *"nobody is owed anything"* and *"it isn't counted as
income"* are **structural**, not numeric — no module returns them. Those stay prose and are held by
the audit plus a written convention, which is why A is a floor under every option rather than an
alternative to them.

## 4 · Success criteria

1. Every one of the ~25 lines is marked **verified**, **corrected**, or **unreachable by the fixture**
   — with the figure it names recorded beside it.
2. The refund/cash-on-hand inconsistency is resolved one way or the other.
3. An owner ruling on the mechanism (A–D), and it is built.
4. A written convention for the next one, in the design log.
5. A decision on whether help articles join the sweep.

## 6 · RESULTS — built 2026-09-02 (A + B + C, owner-approved)

Owner ruling: **do A, B and C**, with the budget line shown on income too. Mockup §06:
`claude.ai/code/artifact/fc2cd405-e83d-46c9-9e96-524c04dc4ea4`.

### 6.1 · The audit — every claim, checked against the code that moves the money

| Line | Verdict |
| --- | --- |
| Cost paid — "cash goes down by X" | **True**, and **incomplete**: never named the budget line it spends against. Now a chip. |
| Income — "cash goes up by X" | **True**, and **incomplete**: never named a budget line, though the report places one. ⚖ Owner ruled to show it. **Verified before drawing.** |
| Refund — cash | ✗ **OMITTED.** Verified in the register book: income and money-back share one row builder, both `movesCash: true`. Now a chip. |
| Refund — "the item drops by X" | **True** — refunds net into the line they repaid. |
| Refund — "isn't counted as income" | **True** — a separate pool on the report. Kept as prose. |
| Refund — "nobody is owed anything" | **True**, and it was the riskiest claim on the screen: a refund names *who paid it back*. Verified — that is a LABEL and creates no credit; the route says so itself. Kept as prose. |
| Out-of-pocket — "no team cash moves" | **True** — the register sets `movesCash: !paidByPlayerId`. |
| Out-of-pocket — "counts in the budget as usual" + the family credit | **True**. |
| Paying a bill — the balance it leaves | **True**; the figure is the standing's own, not a re-derivation. |
| Commitment — "nothing moves" | **True** — a commitment writes only scheduled instalments, and cash skips every scheduled row. |
| Commitment part-paid — the edit warning | **True**, kept, and deliberately **given no strip**: its answer is "it already moved and your edit follows", a delta this form cannot state. |
| Sponsor promise — "nothing moves" | **True** — a promise is a pledge, not an arrival. |
| Player dues ×2 | **True**, and already derived from computed figures rather than asserted. |
| Club fold ×4 | One was **FALSE** and corrected 2026-09-01 ("doesn't appear on Budget vs. Actual" — it always did, under *Not itemized*). |
| Unplanned-item warnings ×8 | **True** — unplanned spending is a real row inside its own category on the report. Untouched by C, as scoped. |

**Nothing was found unreachable by the fixture.** Every state was driven in a browser.

### 6.2 · Two NEW defects, both found by the strip itself within minutes of it rendering

⚖ **This is the project's own thesis proving out.** Neither was findable by reading.

1. **An unlabelled chip.** The form hands over an **empty string** when no budget item is chosen, and
   a nullish fallback sails straight past it — `??` catches only null. The chip drew a bare
   *"· spent ▲ $200.00"* naming nothing. In prose this would have been a sentence with a quiet gap;
   as a labelled slot standing empty it was obvious on sight. Fixed; pinned by test.
2. **Spending rendered as good news.** Colour was applied by ARROW — up green, down red — so
   recording a $200 cost drew **"Umpires · spent ▲ $200.00" in success green**, and a refund drew its
   line in danger red for the best thing that had happened all week. ⚖ Ruling: **colour is reserved
   for cash on hand**, the one figure with a stable good/bad reading; a budget line moving is neither
   good nor bad, it is just where the money landed. Fixed; pinned by test.

### 6.3 · What shipped

- **`lib/coach-money-consequences.ts`** — a pure module returning what a save moves. **22 unit tests**,
  each asserting a fact traced to the code that moves the money, never "what the old sentence said".
- **The strip** on the seven states that move something; **no strip** where nothing moves.
- **The prose trimmed** to what a chip cannot carry. ⚖ The rule that made this work, and it removed
  the mockup's one awkward case: **the sentence keeps the DATE and the RULES, the strip keeps the
  FIGURES.** The income state is not left mute after all — it says "Recorded as arriving on Sep 2."

### 6.4 · Coverage — stated, not glossed

⚠⚠ **`check:layout` CANNOT SEE THE STRIP.** It lives in a modal, and the rendered gate does not open
modals — the same blindness recorded for folds. Every state here was driven and screenshotted by
hand; **owner QA is its only ongoing coverage.** The unit tests hold the figures; nothing automated
holds the rendering.

⚠ **The direct branches are out of this scope by design** — dues, fundraiser, sponsor, club settle and
payout hand off to their own writers. The club settlement is **fieldless by ruling R-D** (one tap,
server-derived) and has no consequence line at all; that is correct, not a gap.

## 5 · Explicitly NOT in this project

- Rewriting money copy for style.
- Changing what the product DOES. If a sentence and the behaviour disagree, this project's default is
  that **the sentence is wrong** — a behaviour change is a separate decision and goes to the owner.
- The forms-review walk's own questions (Q4–Q10). Kept apart on the owner's ruling.
