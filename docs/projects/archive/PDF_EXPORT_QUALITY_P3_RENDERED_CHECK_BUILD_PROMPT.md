# Session prompt — PDF Export Quality, Phase 3: THE RENDERED CHECK

**A BUILD session. Open in a fresh chat. Written 2026-08-26, after the Posters/cards/brackets pass
shipped (commit `ed7b582a`, Owner QA §106).**

**This is the LAST phase. Phase 2's six document groups are all done.** When this lands, the
programme closes and `PDF_EXPORT_QUALITY_PLAN.md` + its PM brief move to `docs/projects/archive/`.

**The one-line job:** nothing in this repo has ever rendered a PDF in a check. Every single defect
the six Phase-2 passes fixed — a squashed crest, a shredded column, a document quietly apologising
that something "didn't fit this page", a footer that lied about the page count, a legend that
promised a box the page never drew — **survived every static gate and was found by a person
generating the file and looking at it.** Phase 3 builds the gate.

---

## ⚠⚠ THE STRUCTURAL FACT, CONFIRMED IN THE CODE BEFORE WRITING THIS

**`npm run verify:changed` renders nothing.** It is fifteen checks long and every one of them reads
**source text or database state**. `scripts/check-layout-invariants.mjs`'s own header says so in as
many words, and it is right.

There is exactly **one** rendered gate in the repo — `npm run check:layout` — and it is **not in
`verify:changed`**, because it needs a running dev server. It is the precedent to study: a screen
**registry** (`scripts/layout-screens.mjs`), a committed **baseline**
(`scripts/.layout-baseline.json`), and `--init` / `--report` / `--prune` modes.

**⚠ But the PDF check is not in that position, and this is the whole opportunity: it needs NO dev
server.** The documents render headless from fixtures in a few seconds. So unlike `check:layout`,
this check *could* live inside `verify:changed` — if it can be made fast and dependency-light.

**What that costs, precisely (checked, not assumed):**

- `jspdf`, `jspdf-autotable`, `playwright` and `sharp` **are already repo dependencies.**
- **`pdfjs-dist` is NOT.** The existing scanner reads finished PDFs back by running pdf.js **inside
  Chromium**. Both the new dependency and the browser launch are real costs to put inside a check
  that runs on every change.

---

## ⚠ THE PLAN'S OWN FRAMING OF THIS IS THE WEAKEST VERSION — SAY SO AT CHECKPOINT 1

Decision D5 in the plan says: *"assert page count, minimum column width, and true page-total
footers. It fails when a document stops fitting."*

**Page count is the wrong assertion and you should argue against it.** A committed page count locks
in whatever a document does today — **including its defects** — and it fails loudly for the most
ordinary reason in the world: somebody added a column, or a fixture gained a row. That is a gate
that gets muted within a month, which is worse than no gate.

The durable version asserts **invariants that describe what GOOD means**, and they are already
written down — six passes produced them, and they are in the plan's "Engine rules you now inherit"
section and in the ledger:

- A fixed-column report **fits by construction** — the "didn't fit this page" line is reserved for
  customer-shaped tables. Seeing it on a fixed-column report is a bug.
- **"Page X of Y" is true on every page** (§79/D3).
- **A column heading never shreds mid-word**; cells may wrap at a space, headings may not.
- **Every continuation page carries the identity band** (§86 — page 2 of any long report carried
  none, which is how that defect shipped).
- **A grouped document's section carries its name onto any page it spills onto**, marked
  "(continued)", and a heading cannot strand itself at a page foot (§102).
- **A crest is drawn aspect-fit** — never stretched (§106; the bracket squashed every square club
  logo for months).
- **Nothing is drawn below the footer floor** (§99 — a run-sheet block printed across the footer).

⚠ **Bring the owner a recommendation on which of these the gate enforces, and be honest about which
ones a rendered check can actually see** versus which are already better served by the existing
recording-fake unit tests. That distinction is decision 1 below.

---

## The three decisions to bring to checkpoint 1

Per the owner's standing method: **each decision arrives with a marked recommendation and the
honest case against it**, as a short list he can answer one at a time, each option saying what
changes for a person, not what changes in the code.

### ⚠⚠ WHEN IT RUNS IS ALREADY DECIDED — OWNER RULING, 2026-08-26. DO NOT RE-OPEN IT.

*"I don't expect these formats to change often and I would expect that to come from an explicit
request, so I don't want to waste time and resources checking these on a regular cadence."*

**TRIGGERED, NEVER SCHEDULED.** Measured cost, so the ruling is grounded: rendering the 32-document
corpus takes **1.6s**, reading it all back and asserting takes **13.7s** (the Chromium launch is
the whole expense), and the **119 existing fake-based tests take 0.94s** with no browser and no
extra dependency.

- **Tier 1 — fires ONLY when a commit touches the export code or its fixtures.** ~15s when it runs,
  **exactly zero** on every commit that doesn't. ⚠ **This is not a new pattern — build it the way
  `.githooks/pre-commit` already works**: it reads the STAGED file list and skips entirely when
  nothing relevant is staged, which is why pre-existing debt and other sessions' files never block
  an unrelated commit. Two guardrails already ride that hook.
- **Tier 2 — ONE full sweep at release**, added to the existing checklist in
  `.claude/commands/release.md`, before documents can reach a customer. **Measured: ~20s** — 89
  documents read back and asserted in **16.1s** (~180ms each) plus a few seconds to render them.
  ⚠ **And the corpus is PADDED**: today's 78-document baseline is six sessions' accumulated
  exhibits, including seven *rejected* schedule layout options that were design comparisons and
  never shipped. **Part of this phase is curating it** down to the 17 real documents across the
  variants that matter (plain org / branded org / team look) — call it 10–15s. Either way it is
  noise next to the build and deploy it sits beside; **do not spend effort making it faster.**
- **NOT in `verify:changed` on every run. NOT on a schedule. NOT on every push.**

⚠ **The trigger must watch the SHARED EXPORT ENGINE, not just individual documents** — and this is
the part that is easy to get wrong. The owner's premise is right that *format changes* come from
explicit requests; but the defects six passes fixed mostly **did not come from format changes**.
They were collateral from shared plumbing: §86's missing identity band hit **every** long report,
and §106's stretched crest happened because a crest pipeline was added product-wide and one
document was never rewired. Nobody requested either. Same mechanism, wider trigger, still free when
untouched.

**Accepted gap, deliberately:** a change *elsewhere* that alters what a document receives (an
upstream data-shape change, say) touches no export file and so trips nothing. The release sweep is
the backstop. **Do not propose a cadence to close this gap.**

### 1. What is actually being tested — the builder, or the file?

⚠ **This is the substantive one, and it is not obvious.** `tests/unit/pdf-export-contract.test.ts`
already contains **119 tests** that assert on drawn output — every text run, its position, its
font — via recording fakes (`MockDoc` / `WrappingMockDoc` / `SizingMockDoc`), with **no PDF, no
browser, and no dependency**. That suite already catches most of the invariant list above, at unit
speed.

So the real question is what a **rendered** check adds that the fakes cannot:

- It exercises **real jsPDF text metrics** rather than the fake's 2mm-per-character model. ⚠ The
  fake is deliberately pessimistic and that difference is REAL — §106 found a name that the fake
  said would not fit and production rendered comfortably.
- It proves the **whole pipeline** — the resolver, the settings layering, the actual bytes a
  customer downloads — not the builder in isolation.
- It is the only thing that can see a **page-count** or **pagination** change at all.

**The honest recommendation is probably "both, at different depths"** — but make the case, don't
assume it. A rendered check that duplicates what the fakes already prove is cost without cover.

### 2. Does the gate DISCOVER documents, or wait to be told about them?

⚠ **This decides whether the check is worth building.** A gate only guards what it knows about, and
a hand-kept list is guaranteed to fall behind — `check:layout` already works this way, so a screen
nobody registered is simply unguarded, and **a green tick looks identical either way.**

Two halves of the job, and they are not equally weighted:

- **Protecting the 17 documents that already ship** — the bigger half by far. Almost nothing the six
  passes fixed was introduced by someone building a new document; it was collateral from unrelated
  work on shared plumbing. §86's defect — **page 2 of every long report carried no identity band** —
  is the type case. Nobody did that deliberately.
- **Making a NEW document inherit the conventions** — real, but rarer.

**There is already a mechanism for the second half and it should be used.**
`lib/export/catalog.ts` calls itself *"Central registry of every export surface in FieldLogicHQ"*,
states the standard that a table page with no entry **is a bug**, and its own header already
proposes *"Coverage gap detection (CI can check…)"*. **Recommendation: drive the gate's document
list from the catalog, and fail when a catalogued document has no fixture** — so "somebody added an
export and forgot" is a build failure rather than a silent hole. ⚠ Confirm against the catalog what
it actually enumerates before promising this; it covers export *surfaces*, which is not the same
count as rendered PDF *documents*, and the difference is the work.

### 3. Baseline, or invariants only?

`check:layout` commits a baseline. **⚠ A golden-file baseline for PDFs is a trap and you should
say so:** every jsPDF document embeds a **creation date**, and most embed an **export date stamp**,
so **two renders of byte-identical code differ.** This was learned the hard way in §106 — byte
comparison across the corpus reported 32-of-32 differing and meant nothing. The workable
comparisons are **extracted text** (with the date normalised) or **pixels with the footer band
excluded**, both of which the carried-forward harness already does.

---

## ⚠⚠ THE TRAP THIS PHASE IS MOST LIKELY TO FALL INTO

**A check is only as honest as the fixtures it runs over, and this phase is nothing but fixtures.**

Three separate, recorded ways this has already gone wrong in this repo:

1. **An exhibit built from a fixture you wrote is evidence about your fixture.** §102 lost two of
   five findings to it; **§106's entire headline defect was a fixture artifact** — a "missing
   bracket connector" that production draws correctly, because the hand-written game rows omitted a
   field production never clears. **Fixing it would have introduced a regression into working code.**
   ⚠ **Feed the check the shape the real screens hand the renderers** — `qa-fixture-check.mjs` in
   the harness shows the pattern, and `seed-qa-day-fixtures.mjs` seeds the QA lab.
2. **A green check over an EMPTY fixture reports coverage it does not have** (memory:
   `reference_green_check_over_empty_fixture`). A rendered sweep that runs over a corpus that failed
   to build is the same failure wearing a green tick. **The gate must fail when it renders nothing.**
3. **A check over a fixture that cannot disagree is not evidence** (§101, the BvA guard). If the
   fixture cannot produce the bad state, asserting the good state proves nothing.

**⚠ And the discipline that has caught something every single pass: a test that cannot fail is not
coverage.** Break production deliberately and watch the gate go red — every assertion, every time.
§106 ran nineteen such mutations; **one exposed an assertion that passed with the defect
reinstated** (off by one millimetre), and **another exposed a real coverage gap** nobody had
noticed. `mutate.mjs` in the carried-forward harness does this and is worth productionising as part
of this phase's own proof.

---

## Scope

**In:** the rendered/invariant check, its fixtures, its wiring, and the harness productionised out
of the scratchpad. Archive the plan + PM brief when it lands.

**Out, and deliberately:**

- **The clock spelling.** "8:00 AM" on tournament/admin surfaces vs "8:00 a.m." on coach surfaces,
  family emails, the run sheet and every help article. One word, two spellings in a customer's
  hands. **Owner + `/marketing` decision, its own pass — do not unify it on the way past.**
- **Cells breaking mid-word on narrow columns** ("Maplewoo / d Mustangs"). Pre-existing; the cause
  is the shared column-floor rule and changing it moves column widths on **every table**.
- **The two owed documents** — a printable coach team-season schedule and a house-league season
  schedule (decided owed in §102). Each is its own pass: a new document with its own choices about
  what a family needs on paper (arrival time and uniform, not eleven columns).
- ⚠ **Re-fixing any of the six shipped groups.** If the new gate goes red on a shipped document,
  that is a finding to report, not a licence to redesign it.

---

## The harness — carry it forward, then productionise it

It lives in the §106 session's scratchpad `gen-pdfs/` (session
`75edadbe-9d0d-42bb-88fc-eb1f8f9e95b7`). **Copy it forward.** It has been carried through all six
passes and is most of this phase's work already done:

- **`gen.mjs`** renders the numbered corpus (32 documents); other `after-*.mjs` scripts render the
  rest. **`CORPUS-FULL.txt` is the 78-document baseline scan.**
- **`scan.mjs` + `scan-viewer.html`** read finished PDFs back as text — page count, true page-total
  footers, and whether the fit contract's drop-and-say-so line fired. **This is the seed of the
  Phase 3 check.**
- **`dump-text.mjs`** dumps every drawn run per page (date normalised) for corpus diffing;
  **`ydump.mjs`** adds y-coordinates, which is how a layout shift is spotted at all.
- **`pixdiff.mjs`** compares two renders pixel by pixel with the footer band excluded — the only
  honest way to prove a refactor changed nothing.
- **`mutate.mjs`** applies deliberate defects and asserts the suite goes red.
- **`render-browser.mjs`** rasterizes in Chromium; **`build-artifact.mjs`** inlines PNGs into a
  gallery; **`hooks.mjs` / `hooks-register.mjs`** are the resolver shims that let Node load the
  repo's TS renderers.

⚠ **Copying the harness means copying `pdfjs-dist` with it** — it is a scratchpad-only dependency
today, which is exactly the cost decision 1 turns on.
⚠ **Isolate probe output before scanning.** The corpus scan reads every PDF in `out/`, so one-off
exhibits inflate it and make the diff unreadable. §106 moved them to a sibling folder first.
⚠ **The family-statements batch file reports `FOOTER✗` BY DESIGN** — page numbers restart per
family. It is the one expected red line in a full-corpus scan. Do not "fix" it, and **do not let it
mask a real footer failure.**

---

## Lessons from six passes that will save you a defect

- ⚠ **Attribute a diff before defending it.** §102 and §106 both saw corpus rows change that turned
  out to belong to a *concurrent session's* uncommitted work, not the pass's own.
- ⚠⚠ **THE WORKING COPY IS SHARED AND IT HAS COST REAL TIME EVERY SESSION.** In §106
  `lib/export/pdf.ts` and the contract test both held another session's uncommitted work interleaved
  with this pass's, and the commit had to be hand-built (filtered blob staged via the index, working
  tree restored afterwards, then **proved to stand alone by swapping it in and running the suite**).
  **Three of that session's own doc edits were committed by a different session** before it got
  there. **Check `git log` and `git status` before you start and again before you commit, and run
  `git show --stat HEAD` afterwards.** ⚠ **`/review` and `/simplify` must be scoped explicitly** —
  §106's first `/review` audited an entirely different session's money work and set the exports
  aside.
- **Measure and draw must share one source.** Two copies of the same arithmetic disagreeing is this
  programme's single most repeated bug.
- **The empty/absent case is where the defects live.** §102 found a heading that printed as bare
  separator dots; §106 found a crash on a division with no playoff games — both in the "nothing
  here yet" path. **A check that only runs over populated fixtures will miss the same class.**
- Bracket-path directories (`[orgSlug]`, `[teamId]`) stage NOTHING via plain glob pathspecs — use
  `:(literal)` magic, for `git log` and `git status` too.

---

## Verification & process

- AGENCY_RULES in full: **PM summary before code** · `dev` branch · explicit pathspecs · **no commit
  without the owner's explicit OK**.
- `npm run verify:changed` (**schema parity is RED for pre-existing dev-only migrations — not yours
  unless you add one**); `npm run typecheck`; `npm test`.
- Re-check what §number the Owner QA Ledger actually ends on **AT WRITE TIME** — it was **§106**
  when this was written and it will not be by the time you finish.
- **This phase is unusual in that its deliverable IS a check.** ⚠ **The proof of done is therefore
  not "it passes" — it is "it fails when it should."** Reinstate a defect from each of the six
  shipped passes and show the new gate catching it. A gate that has never been seen red is a gate
  nobody should trust.
- **Ask the demo question and record the answer either way** (CLAUDE.md). Phase 3 ships no
  customer-visible change, so the honest answer is almost certainly "nothing owed" — say so rather
  than skipping it.
- **Help-docs (`/docs`):** almost certainly nothing — no customer-visible flow changes. Confirm
  rather than assume.
- Owner QA Ledger entry · TODO.md stays high-level · **archive the plan and PM brief** when this
  lands, and update the TODO link to the archive location.
- Offer `/simplify` then `/review` when the code is done. **Six passes running they have earned
  their cost** — on the last one `/review` found a title that could collide with a newly added
  field, and a fix whose own correction would have crashed an empty bracket.

---

## What done looks like (owner-visible)

Somebody widens a column, adds a field, or changes a heading — and **the build tells them the
document stopped working before a customer prints it.** Not a page-count tripwire that gets muted
the first time it cries wolf, but a gate that says which promise broke and on which document: this
report is apologising that a column did not fit · this heading shredded mid-word · page three lost
the club's name · a crest came out stretched · something printed across the footer.

⚠ **And the half that is easy to under-sell:** most of what the six passes fixed was **not** put
there by someone building a new document — it was collateral from unrelated work on shared
plumbing, landing on documents nobody was thinking about. So the gate earns its keep mostly by
protecting the seventeen that already exist, and only secondarily by making the eighteenth inherit
the rules for free. **Build it for the first job; get the second for nothing by driving it off the
export catalog.**

And the programme closes: seventeen documents that a customer hands to another human being, all
looked at on paper, all fixed, and — for the first time — **guarded by something other than
somebody remembering to look.**
