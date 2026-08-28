# Keeping the demo sandboxes in line with the product — Implementation Plan

**Status:** **MEASURES 1, 4 AND 5 BUILT** (1 + 4 on 2026-08-06; **measure 5 on 2026-08-28**). **MEASURES 2 AND 3 STILL PLANNED.**
Owner-approved 2026-08-05 (four measures); 1 and 4 approved for immediate build 2026-08-06.
Companion brief: `DEMO_SANDBOX_DRIFT_GUARDS_PM_BRIEF.md`.
Covers **both** sandboxes — the tournament one (`riverdale-minor-ball`) and the coach one
(`riverdale-ridge`) — because every failure below is shared by construction.

## The question this answers

> When features are added, updated or removed from the real portals, how do we ensure the demos
> stay in line with the product?

Asked 2026-08-05 while the coach sandbox's guided tour (Phase 3) was being designed. The answer is
worth writing down because **the investigation that prompted it found three live examples of the
exact drift being asked about**, all of which had already survived a build, a `/simplify` pass and
a `/review` pass.

## What already protects the demos (and is genuinely good)

1. **The demos borrow the product's rules instead of copying them.** The tryout scorecard IS
   `getRubricStarter('baseball')`, not a replica. The 12U's 14-3-1 is computed by the app's own
   result rule. The 13U's closed year was produced by *actually closing a season*, not by writing
   `completed` into a row. When those rules change, the demo follows on its next reseed.
2. **Two health checkers** — `scripts/check-demo-sandbox.mjs` (tournament) and
   `scripts/check-demo-coach.mjs` (coach, ~70 assertions after Phase 3) — read the live database
   and fail if the world is not in the state a prospect should find it in. They double as staleness
   detectors: a demo that has quietly stopped re-anchoring still renders, it just shows a tryout
   that was "yesterday", which is worse than showing nothing.
3. **Nightly re-anchoring** with a program-year LABEL assertion, so a calendar rollover pages
   instead of rotting.
4. **The tour's anchors are inert markers inside real product components**, so deleting a component
   takes its marker with it — and by design a step with a missing anchor still narrates, degrading
   to "a sentence without a ring" rather than a dead button.

## The gap

**Nothing runs the checkers on a schedule, and nothing guards what the demo SAYS or where it POINTS.**

- `scripts/check-demo-*.mjs` are in **no** npm script and there is **no CI** in this repo — they are
  run by hand, by whoever remembers.
- They check **data**. Nothing notices when a screen moves, a tab stops being reachable, a report
  starts rendering `$0.00`, or a sentence stops being true.

### The three live examples (found 2026-08-05, all pre-existing)

| Drift | What it looks like to a visitor | Which measure below catches it |
|---|---|---|
| The moments dock promises "one split opinion to argue about tonight" on the tryout board. The split (bib 14, 5 vs 2) is real in the data but **rendered nowhere** — every surface shows the 3.5 average. | A sentence describing something not on screen. | 3 (a rendered pass that asserts the sentence's own claim) |
| The evaluator-bias readout is documented in the seed as "the bias flag fires". **It never fires** — consensus is the mean of evaluator means, so one harsh scorer out of two moves both by half the drift (±0.39 vs a 0.75 threshold). | A beat that silently isn't there. | 1 (an assertion in the checker) + 3 |
| The 12U's budget carried **no categories**, so budget-vs-actual filed the whole plan as "Uncategorized" and showed **$9,400 planned, $0.00 actual** on a team 18 games into its season. | A money report saying nothing happened all year. | 1 + 3 (both; fixed in Phase 3) |

Note what these have in common: **none of them broke.** Every page rendered, every check passed,
nothing 500'd. Drift in a demo is not a crash — it is a true-yesterday sentence over a screen that
has moved on, and only something that *reads the screen* can see it.

## The four measures

### 1 · Put both checkers in the routine sweep — ✅ BUILT 2026-08-06

`npm run check:demos` (also the last step of `verify:changed`) runs both checkers and prints **one
line** when all is well. Also added: `npm run tick:demos`, and `scripts/tick-demo-coach.mjs` — the
coach sandbox had only an API route, so "run the ticker by hand" meant hitting a platform-admin
endpoint or re-seeding.

**Three states, one failure.** No credentials → skip. Credentials but no demo org → skip (the two
checkers now exit **3** for "not seeded here" instead of failing). A demo that exists and is wrong
→ fail loudly. A check that cries wolf on a fresh clone teaches everyone to ignore a red build.
*Verified by running it with the environment file removed: skipped, exit 0.*

**⚠ It re-anchors before checking — off production only.** Both demos are anchored to "now" and
both rely on a nightly job that **is not applied to the dev database**, so on dev they are a day
stale every morning. Reporting that daily to everyone would be noise nobody here can act on;
silencing it would be worse than not checking. So the sweep does locally what the scheduler does
elsewhere: re-anchor (diff-only, zero rows on a steady day), then check. Never against production —
there the scheduler genuinely runs, so staleness is an alert, and a verification sweep must not
write to the live database as a side effect of somebody typing `npm run verify:changed`.

**It found a real defect on its first automated morning** (see below), which is the argument for
the whole measure.

#### What it caught immediately

1. **The tournament demo was a day stale** on dev — dates behind the clock, nothing ticking them.
2. **A practice that crossed into the past had no attendance at all.** The seed decides `happened`
   once, at seed time; the re-anchor shifted dates but created nothing. So the first practice to
   cross midnight after a seed became a session that had visibly taken place with **nobody marked
   present or absent** — weekly, on the 10U's Thursday. It read as a coach who had forgotten to
   take the register, which is the single most damaging thing a demo of a coaching product can
   accidentally depict. **Fixed**: the re-anchor now takes attendance at any practice that has
   newly become past — insert-only, only for events with no register at all, so the "a steady day
   writes zero rows" contract still holds (re-verified).
3. **A comment claiming the evaluator-bias flag fires** — corrected in place with the measured
   numbers, rather than adding an assertion that would fail, since the fix itself is deferred.

**Deferred with the fix it belongs to:** an assertion that the bias flag actually fires. Adding it
now would be a permanently red build for a change the owner has not taken.

#### Hardened at `/review` (2026-08-06) — the wrapper was the most dangerous thing in the change

- **CRITICAL, fixed: the production guard was decorative.** It read the Supabase URL from the
  *wrapper's own* environment, while passing the environment file only to the children it spawned —
  so on the ordinary path (`npm run verify:changed`, no env file of its own) that variable was
  **undefined on every run**, the guard always concluded "not production", and the re-anchor always
  ran. A developer with `.env.local` pointed at the live database — a documented workflow — would
  have written to production by typing a routine verification command. The wrapper now loads the
  same environment its children will use, and the guard is an **allow-list that fails closed**:
  re-anchor only against localhost or the known development project; production, an empty URL, a
  custom domain, a pooler host and a restored copy of prod all resolve to *check only*. Verified
  across all five shapes.
- **Fixed: a routine gate that wrote on every run.** It re-anchored first and checked second, which
  turned a read-only sweep into a database write for every agent, every time — and with several
  agents sharing one working copy, into a race whose torn read could report a failure that was
  never real. It now **checks first and repairs only on failure**, so a steady day writes nothing
  and touches nothing.
- **Fixed: no deadline on the child processes.** A hung Supabase call would have taken
  `verify:changed` with it, indefinitely, with no output. Each child now has a two-minute ceiling.
- **Fixed: `tick:demos` crashed** on any machine without an environment file — the one machine most
  likely to run it by accident. It now routes through the wrapper and inherits the same skip and the
  same production guard.
- Removed an assertion in both checkers that could never fail (the absent-demo case exits before it).

### 1 (original plan text) · Put both checkers in the routine sweep — CHEAP

Add `check:demo` (running both scripts) and include it in `npm run verify:changed`.

- Both already exist and both pass today.
- Needs a guard for "no demo seeded in this environment": the checkers must **skip cleanly**, not
  fail, when the org is absent — a contributor without demo data in their local DB must not get a
  red build. (The reconcile job already models this: no org ⇒ successful no-op.)
- **New assertions to add at the same time**, one per live example above: the evaluator-bias flag
  actually fires; every budget line carries a category. (The budget one landed with Phase 3.)

**Catches:** a code or data change that breaks a demo world. **Misses:** anything about rendering.

### 2 · Make the demos' destinations a list the build enforces — REAL

A unit test that asserts, for both sandboxes:

- every `href` in `sandboxTourSteps()` and every `fanPath`/`operatorPath` in `sandboxMoments()`
  resolves to a real route in the app;
- every `anchor` selector names a `data-sandbox-tour` marker that **still exists in the codebase**.

Renaming, moving or deleting one of those screens then **fails the build until the demo is
updated**, which is the decision point — the same "editing the list is the decision" pattern as
`APPROVED_ARCHIVE_DOORS` in the binding archive ruling.

This is the measure that would have caught **practice plans having no address at all** (a schedule
event opens a drawer over `/schedule`; the URL never changes) *before* a tour step was written
against it, rather than during a manual browser sweep.

**Catches:** a moved or deleted screen; a renamed marker. **Misses:** a screen that still exists but
now renders differently.

### 3 · Open the demo and look, on a schedule — THE ONE THAT MATTERS

A Playwright pass (pattern already in the repo: `scripts/check-layout-invariants.mjs` renders real
pages) that, for both sandboxes:

- enters through the real door, then visits **every dock landing and every tour destination**;
- asserts each screen is **not empty** — no empty state, no `$0.00` report, no zero-row table;
- asserts the **numbers quoted in the narration sentences are on the page** ("28", "9 of 12",
  "18-6-2", "$9,400"), which is the only mechanical way to catch a sentence going stale;
- runs at **390px and 1280px**, and re-measures the chrome height against a recorded budget (the
  coach hat's ceiling is a documented number, not a vibe — see the Phase 3 record).

Run it after every release **against production**, not only locally: the demos are live seeded clubs
inside the real product, so a product change reaches them the moment it deploys. There is no
separate demo build to stage — which is a strength (never a stale demo) and a risk (never a staging
check).

**Catches:** the tab moved, the panel is hidden, the report is empty, the claim is stale.
**Misses:** the demo failing to show something the product *gained*.

### 5 · Check the SENTENCES against the seeded world — ✅ BUILT 2026-08-28

Added after the arrival-line review (owner ruling 2026-08-28). **Not in the original four**, and it
exists because measure 3 — the one that would catch a stale claim — is the most expensive of them
and still unbuilt, while the class of defect it guards had already happened three times.

**What it does.** `check-demo-coach.mjs` now reads the dock's actual arrival sentences via
`sandboxMoments()` and compares the countable claims in them against the seed constants. The
expected phrase is **computed from the seed, never typed into the check** — so it fails in both
directions: change the seeded results and the sentence stops matching; reword the sentence and it
stops matching. Writing the number in both places would only prove the check agrees with itself.

**Guarded today (3):** "28 kids in bibs" against `TRYOUT_CANDIDATES`; "14-3-1" against
`MIDSEASON_RESULTS`; "18-6-2" against `SEASONS_END_RESULTS`.

**⚠ Deliberately NOT guarded, and the check says so in its own output:** the split opinion, the
evaluators' progress, the families who opened the recap, the dues and lineup states. Those are
readings of seeded data rather than figures, and a predicate invented to "verify" prose would pass
for the wrong reasons. A green tick here means the countable claims hold — not that the paragraph
is true.

**Mutation-tested on the way in.** Flipping one seeded tie to a win moved the computed record to
15-3-0 and the check failed with the sentence quoted back and both fixes named. A guard nobody has
seen fail is not evidence.

**Catches:** a sentence whose numbers have drifted from the world. **Misses:** everything measure 3
covers — whether the number actually reaches the screen, whether the panel is empty, whether the
tab moved. This is the cheap half of measure 3, bought without a browser.

**Relationship to measure 3:** it does NOT replace it. Measure 3 asserts the numbers are *on the
page*; this asserts they are *true of the data*. A screen can hold a correct figure and still be
broken, and this will not notice.

### 4 · Add the demos to the same reflex as the help guides — ✅ BUILT 2026-08-06

Written into `CLAUDE.md` as its own standing section, beside the Help-docs sync rule. It asks two
questions in the same breath as the help one — *should a demo moment show this?* and *are the
demo's existing sentences about this screen still true?* — and states plainly that the automated
check can only catch breakage, never absence, which is the reason the paragraph has to exist.

### 4 (original plan text) · Add the demos to the same reflex as the help guides — HABIT

One paragraph in `CLAUDE.md`, modelled exactly on the existing **Help-docs sync** rule:

> When a change alters a user-facing coach or tournament flow, proactively ask whether a **demo
> moment** should show it, and whether the demo's existing sentences are still true. The sandboxes
> are the product's shop window; keeping them current is a code-time task, not a periodic sweep.

**This is the only measure that covers additions.** Measures 1–3 catch **breakage** — a machine can
tell you the demo broke. Nothing can tell you the demo is *missing* something the product gained
last month; that is a judgement, and it needs a person prompted at the right moment.

## Order, and why

1 → 4 → 2 → 3, by ratio of value to effort. Measure 4 is second because it costs a paragraph and is
the only one covering the class of drift nothing else can see. Measure 3 is last because it is the
most work and the most valuable — do not start it before 1 and 2 are removing the noise it would
otherwise trip over.

## Risks & notes

- **Measure 3 needs a running app and a seeded demo.** Same constraint as the layout checker; it
  belongs in the release runbook, not in `verify:changed`.
- **Prod runs of measure 3 are read-only by construction** — the sandbox write block already refuses
  every non-GET for demo orgs, so the pass cannot damage the world it is checking.
- **Do not let measure 2 grow into a route-existence framework.** It asserts a short, hand-listed
  set of demo destinations; the moment it starts parsing the router it has become a different
  project.
- A demo-drift failure is **not** a production incident — the product is fine, the shop window is
  stale. It should page whoever is doing GTM, not whoever is on call.

## Effort

S–M. Measure 1 ≈ S. Measure 4 ≈ XS. Measure 2 ≈ S. Measure 3 ≈ M and is the long pole.
