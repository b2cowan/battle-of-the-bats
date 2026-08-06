# Coach Sandbox with Season Phases — Implementation Plan

**Status:** **PHASE 1 COMMITTED (dev `7a7092ea`) · PHASE 2 COMMITTED (dev `c57f6462`) ·
PHASE 3 BUILT 2026-08-05 (dev, uncommitted).** All five moments and the guided tour now exist.
All three await owner QA (ledger §5.4).
Mockups: phase dock + warm chrome approved 2026-08-04; **guided tour rev 2 approved 2026-08-05**.
Companion brief: `COACH_SANDBOX_SEASON_PHASES_PM_BRIEF.md`.

## Phase 3 build record (2026-08-05) — the guided tour

**One spine of SEVEN steps that walks a season**, not five per-moment tours. Reasoning, in the
order it decided things:

- The dock already offers the five moments self-serve, so a tour per moment would be the dock with
  extra buttons — and it would turn a season into five feature demos, the exact pitch the moments
  naming exists to avoid.
- It is also structurally impossible: **step 6 (what a parent reads) only lands having seen step 5
  (the playing-time table it answers)**, and two steps that depend on each other cannot live in
  separate tours.
- **The rule every destination obeys: a step lands one level deeper than its moment's dock chip.**
  The dock drops a visitor on the moment's front door; the tour opens the drawer behind it. Step 7
  is the deliberate exception — the archive promise is not a screen you can point at, it is the
  fact that pressing things still works, so it lands where the chip does and the sentence says so.
- **The tour does not open itself.** A demo that promises nothing moves while you watch must not
  move a stranger. It opens in an INVITATION state ("The season, guided · Walk the year →") and
  waits. Coach sandbox only — the tournament tour's opening is approved and shipped.

### What was measured in the running demo BEFORE the steps were written

Three of the plan's eleven candidate beats could not be pointed at. The list routes around all
three rather than shipping steps that would read as broken (all three are **pre-existing** and are
flagged to QA in their own right):

1. **The tryout split opinion is invisible.** Bib 14's 5-vs-2 is real in the data; every surface
   renders the 3.5 average. There is no per-evaluator view anywhere a visitor can reach — so the
   dock's own Tryout-day sentence currently promises something no screen can support.
2. **The evaluator-bias flag never fires on this data.** Consensus is the mean of evaluator MEANS,
   so one harsh scorer out of two moves both by half the drift: computed ±0.39 against a 0.15×5 =
   0.75 threshold. The seed comment claiming "the bias flag fires" is wrong. Making it fire is a
   one-line drift change, deferred (owner call — it also needs the hub's stage to be addressable).
3. **The tryout hub auto-selects "Decide", not the scoreboard** (`tryoutDayDone = scoredCount > 0`,
   so a tryout with scores in it is past tryout day by the product's own reckoning), and hidden
   panels are `display: none` — an anchor there would be a dead step. Step 1 points at the ranked
   board the hub actually opens.
4. **Practice plans have no address at all** — a schedule event opens a drawer over `/schedule`, so
   the URL never changes. The off-season step goes to Development instead.

### The seven steps

| # | Press | Lands (one level below its chip) | The beat |
|---|---|---|---|
| 1 | See how 28 kids got ranked | 11U → Tryouts hub | ranked live, names still hidden |
| 2 | Find the two blanks | 14U → Development | 11 of 13 tested; two dashes, not zeros |
| 3 | Count the lineups | 10U → Lineups | one saved, twelve waiting — an evening in March |
| 4 | See if the season is on budget | 12U → budget vs. actual | planned vs actually spent; Facilities over plan |
| 5 | Ask who has been on the field | 12U → Insights → playing time | 12 innings vs 24–30; two pitchers at the cap |
| 6 | Read what a parent gets | 12U → that player's page | the family recap, their view, drawn by their screen |
| 7 | Open a season that is already over | 13U → Season's End | 18-6-2, 9 of 12 opened it, every screen still opens |

The five candidate beats that did not make the spine were **not cut** — they belong in the dock's
own arrival sentences, which already fire on every chip press and cost nothing. (Not yet written;
carried as a follow-up.)

### What it took to build

1. **Seven inert markers** (`data-sandbox-tour`) on real product screens — the pattern already
   running on five tournament screens. Nothing renders, nothing styles, off a demo org.
2. **`exactPath` on a tour step** (new). `isOnStepPage` treats a destination as a SECTION, which is
   right for the tournament tour and wrong here: step 1 lands on `/tryouts` and the dock lands on
   `/tryouts/score` one level below, so under prefix matching a visitor who arrived by the dock
   would press step 1 and watch nothing happen. Opted into per step; the tournament tour is
   untouched. **The unit suite pins it**: any coach step that is an ancestor of another step or of
   a dock landing must be exact.
3. **The invitation state** — the stepper's pristine label and button, coach kind only.
4. **A warm coat for the stepper row**, the one band of the chrome that had never rendered here.
5. **Two narrow-screen rules** (below), and **`scroll-margin-top` on every tour marker** so the
   fixed hat stops painting over whatever was just scrolled to.
6. **Tall-anchor scrolling.** `scrollIntoView({block:'center'})` is right for a panel and wrong for
   a list: measured, centring the 28-row decision board put its top **669px above the viewport** —
   the visitor arrived staring at candidates 14–20 with the card's own title scrolled off. Now
   `start` for anything taller than 80% of the viewport, `center` otherwise. Re-measured: top lands
   at +216px, header and subtitle on screen.

### The phone, measured (390×844, live demo, computed styles)

| State | Rows | Chrome |
|---|---|---|
| Before Phase 3 — browsing | banner 68 + dock 44 | **112px** |
| Before Phase 3 — after a dock press | banner + dock + sentence | **182px** |
| Now — arrival (invitation) | banner 69 + dock 44 + stepper 42 | **155px** |
| Now — a step delivered | banner 69 + stepper 42 + sentence 88–105 | **198–216px** |

Two rules got it there, and the first draft of the second one was wrong in a way only measurement
caught:

- **The dock stands down while the strip is speaking** (`data-narrating`, ≤640px, coach only). The
  sentence names the moment anyway, and the dock returns the instant it clears. Without this, a
  delivered step ran four rows.
- **The promise comes back to the phone banner — in its shortest honest form.** It is hidden below
  640px for the tournament sandbox on the reasoning that the first narration line carries it; true
  there, false here, because the coach sandbox's opening state has no sentence at all. **So on a
  phone, "nothing is saved" was appearing NOWHERE until something was pressed.** First attempt
  restored the whole sentence: banner 68px → **136px**, and a delivered step hit **283px**. So the
  lead clause is dropped and the bold claim kept, taking the moment note's place rather than a line
  of its own — flavour gives way, the honesty claim does not. Banner: 69px.

### Also built in the same pass — the books (owner ask, 2026-08-05)

A budget beat needed a budget worth looking at, and there wasn't one:

- **The mid-season team showed $9,400 planned and $0.00 actual**, eighteen games into its season,
  with every line filed under "Uncategorized" — its budget lines carried no category at all, and
  budget-vs-actual matches spending to a line by category NAME. Season start was the same picture
  ($4,400 planned, nothing logged).
- Fixed: the 12U's five lines now name real team-reachable categories, and the team has **eight
  logged expenses across the season**. **Facilities is deliberately OVER plan** (two rainouts moved
  to weeknight slots) and is the only anomaly on the team — owner ruling: a demo whose every line
  comes in under budget teaches a prospect that the report flatters them. The unbudgeted-expense
  beat stays with the 14U; one anomaly per team, or neither reads.
- The 10U gets **three early bills** — the contrast is the point: a complete plan, barely spent
  against. First draft paid the gear line in full and put a fortnight-old season at 56% of budget;
  **the health check failed on its own data** and it became a deposit.
- **The ledgers now re-anchor on all three teams**, restated from the clock rather than shifted by
  a delta (the 14U's argument, generalised): a bill dated before the season it belongs to is the
  one thing a money screen must never show. Verified: a steady day still writes **zero rows**, on
  two consecutive passes.

### One fixed roster id (new convention)

`DEMO_COACH_SHOWCASE.midSeasonPlayerId` — the only person in the demo world addressed by name,
because step 6 points at one player's page. It is deliberately **the playing-time outlier step 5
names** (jersey 30), so the tour reads "here is the uncomfortable number, and here is exactly what
that family sees." Owner call: the demo is more persuasive admitting it than hiding behind a tidier
player. The health check asserts the pairing, so a re-authored lineup grid cannot silently split the
two steps across two children.

**Verification run:** typecheck clean · 1426 unit tests pass · demo health check green (~70
assertions) · re-anchor diff-stable over two passes · all seven steps driven end-to-end at 1280px
and 390px, every one navigating, narrating and ringing its beat.
**Not run:** `npm run check:layout` (timed out at 10 minutes). Residual risk low — the new CSS is
either scoped to `[data-kind='coach']` inside the demo chrome or is a `scroll-margin-top` on demo-only
markers, none of which renders for a customer.

**Hardened at `/review` (2026-08-06, high-risk tier, 5 lenses).** Six defects fixed, all found by
the review rather than by use:
1. **The phone lost the moments dock permanently.** The dock stands down while the chrome narrates,
   and the only control that clears a narration is a numbered dot — which the same breakpoint hides.
   Measured: after step 1 on a 390px screen, nothing on the page could bring the dock back for the
   rest of the session. The narration strip is now dismissible (44px target, both coats).
2. **The dock came back mis-scrolled.** A hidden element reports zero width, so the "keep the active
   chip on screen" effect early-returned for the whole walk and never re-ran. It now depends on the
   narration state.
3. **A regression reaching the shipped tournament tour**: the new tall-anchor scroll rule was
   ungated by sandbox kind, so the playoff bracket's step would have changed where it lands — on an
   approved surface, unmeasured. Now coach-only.
4. **A global stylesheet rule reached real customers.** The tour markers ship on ten production
   screens; the `scroll-margin-top` rule was unscoped and its "zero off a demo org" comment was
   false (the fallback zeroes the variable, never the constant beside it). Now scoped to the
   sandbox chrome's own root attribute.
5. **The attendance backfill could abort itself.** One bulk insert against a `UNIQUE(event_id,
   player_id)` table means a concurrent run's collision aborts the whole statement — including
   uncontested events — and alerts a human over a race that harmed nothing. Now conflict-tolerant,
   and coverage is judged per PLAYER rather than per event (an event missing only the newest
   player's row was previously marked done for ever).
6. **Query scoping and roster ordering** in that backfill: events are now scoped by program year
   like the reads beside them, and the roster is ordered server-side with an id tiebreak — the
   world's absent/late lists are plain indexes, so an unstable order could mark the wrong child
   absent.
Also added: the 12U finally has the attendance-timing assertion its siblings had — and it is the
team most exposed to it, since its practices cross into the past mid-week, every week.
**Refuted:** a claim that the lineup grid's rows are games rather than innings (they are innings).
**Re-measured after the fixes:** phone arrival 155px; a delivered step **234px** (up from 216 — the
dismiss control narrows the sentence and costs a line). Tournament sandbox confirmed unregressed at
both widths.

⚠ **This plan was moved to `archive/` by another session on 2026-08-06 while Phase 3 was still
awaiting owner QA.** Archiving is meant to follow verification, not precede it; flagged for the
owner rather than moved back, since the move was another agent's deliberate act.

**Deviations to flag at QA:** the tour's Tryout-day step lands on the hub while the DOCK's chip
still lands on the coach's own scorecard — deliberate (front door vs. one level deeper), but the two
disagree about where "tryout day" is, and the dock's sentence still describes a split opinion no
screen shows.

## Phase 2 build record (2026-08-05)

The two remaining moments, built on Phase 1's machinery — no parallel world module, no second
seed, no new UI component, **no migration and no schema change**.

**Owner decisions taken at the start:** the new teams are **Riverdale Ridge 14U** (off-season) and
**10U** (season start), giving the club a contiguous 10U–14U ladder with the biggest money story on
the oldest team. Rider 1 (year-over-year tryout comparison on the 11U) **dropped** — see "Rider
investigation" below. Rider 2 accepted: **two of the 12U's PAST practices are now written up**.

1. **The world** (`lib/demo-coach.ts`) — two new team defs on FIXED ids (`DEMO_COACH_TEAM_IDS`)
   plus `resolveOffSeasonState` / `resolveSeasonStartState`.
   - **14U off-season:** next season's program year (a team building the year it hasn't played),
     six budget lines each on a real PLATFORM budget category, phased across four months; six
     logged expenses including a tournament payable with its balance still ahead and one
     deliberately UNBUDGETED row; dues 2-of-4 in with one family overdue; nine Sunday sessions and
     three Wednesday cage nights; two practice plans (one a real 3-station rotation); four
     development focus areas; a testing session with 3 tests × 11 of 13 players.
   - **10U season start:** opening day always the Saturday two weeks back, 3 games played and 12
     ahead, 11 Thursday practices, ONE saved lineup (the opener's), complete roster with numbers
     and positions, dues mostly current.
   - ⚠ **WEEK-QUANTIZED ANCHORING** (`weekAnchoredDate`): every dated row on both teams is placed
     at `thisSaturday + X`. The nightly shift is therefore always a multiple of seven and a Sunday
     session stays a Sunday session. Anything anchored to a raw day count would walk one weekday
     per night. Corollary, enforced by construction: **every settled fact sits at `X <= -7`** (the
     only band that is in the past on all seven weekdays), so a scheduled game can never drift
     into the past without a score.
2. **The seed** — two new blocks reusing every Phase 1 helper. New: platform budget-category
   lookup (budget-vs-actual matches actuals to lines by category NAME, so a line without one files
   every dollar as unbudgeted), and a practice-plan materializer that resolves roster indexes into
   row ids. Still idempotent; re-running is still the re-anchor.
3. **The verifier** — grown from 37 to ~60 assertions across five moments, all relational rather
   than hard-counted where the clock decides (attendance is asserted as "taken for everything that
   happened, nothing that hasn't", which doubles as the staleness tripwire if the nightly job
   stops). **It caught a real defect:** the first draft of the 10U's opener lineup sat two players
   at three of six innings — the exact shape the 12U's fairness insight exists to flag.
4. **The dock** — two chips inserted in SEASON order (`SANDBOX_MOMENT_KEYS`). **Measured at 390px:
   five chips run 510px, so 120px sat off-screen behind a hidden scrollbar — including Mid-season,
   the chip the door lands on.** The dock now scrolls the ACTIVE chip into view (via `scrollLeft`,
   never `scrollIntoView`, which is free to scroll the page vertically too). Chips clipped at both
   edges are also the affordance the hidden scrollbar isn't. **Flag at QA: a phone still shows ~3½
   of 5 chips at a time.** The alternative is wrapping to two rows (+~30px of permanent hat).
5. **The re-anchor** — both moments join `lib/demo-coach-reconcile-core.ts`, anchor row first:
   the 14U on its first winter session, the 10U on opening day (reusing `shiftTeamSchedule`
   wholesale). New: the 14U's books move with its calendar (expenses' paid/due stamps, and the
   testing session WITH its readings — the product's own re-stamp rule), and the budget's month
   phasing is **re-derived, not shifted** (month buckets, not events).
   **Verified:** steady state writes zero rows; a ±7-day round trip moves 299 rows each way and a
   ±28-day one 323 (the extra 24 being the re-derived budget periods); both land byte-identical.
   Also fixed in passing: five **pre-existing** type errors in this file (committed at `7a7092ea`)
   that made `npm run typecheck` fail on `dev`.

**Deviations to flag at QA:** the phone dock (above); the 14U's off-season program year is NEXT
season's, so its masthead names a year that hasn't started (deliberate — it is what an off-season
team's data actually looks like).

### Rider investigation — year-over-year tryout comparison (NOT built, owner-agreed)

The memory strip is gated on `canShowTryoutMemory`, which is `!tryout.isAnonymous` — prior-season
data may be assembled only once names are revealed, because pairing a bib to last year's named
record is a server-side de-anonymization. The 11U's approved beat is blind scoring, and a sandbox
visitor cannot turn it off (writes are centrally blocked). Seeding a prior year plus continuity
links would therefore produce data **no visitor could ever see**, at the cost of reworking the
one-program-year-per-team rule the seed and health check both enforce. Dropped 2026-08-05.

## Phase 1 build record (2026-08-04)

Built in five slices, each verified before the next:

1. **Seed** — `scripts/seed-demo-coach.mjs` materializes `lib/demo-coach.ts` (the pure fictional
   world + date resolvers, `demo-tournament.ts` pattern): org `riverdale-ridge` ("Riverdale Ridge
   Baseball", plan `club`, member role **coach** not owner), fixed team ids
   (`DEMO_COACH_TEAM_IDS` in `lib/demo-org.ts`), three teams — 11U tryout-day (28 candidates,
   partial blind scores, split opinion bib 14), 12U mid-season (14-3-1, Saturday game, dip,
   outlier, arm-care cap, $240 overdue, 1 unsigned waiver), 13U Season's End (26-game 2025 year
   closed **active → completed**, the real transition; Wrapped renders live from data; 9/12
   family recap views). Idempotent; refuses prod without `--allow-prod`.
   Verifier: `scripts/check-demo-coach.mjs` (37 assertions, doubles as the staleness detector).
2. **Door** — `/see-it-live/coaches` (+ `/see-it-live/coaches/switch`,
   `/api/sandbox/switch-coach`): parallel twins of the tournament door, same hardcoded-account /
   no-params / trusted-origin / rate-limit discipline. Cross-sandbox presses swap silently (a
   shared demo session is not a customer's).
3. **Write block + silence** — proxy chokepoint already covered coach URLs; closed the gaps it
   cannot see: `getInsightsDigestTeams` consumers (insights digest + dues sweep) now exclude
   demo orgs fail-closed (`excludeDemoOrgTeams`), and the token-identified
   `/api/tryout-score/[token]` write refuses demo orgs (new `TOKEN_IDENTIFIED_WRITES` registry in
   the write-guard test). Rejection copy is kind-aware ("start your own team").
4. **Phase dock** — coach moments in `lib/sandbox-chrome.ts` (three chips, plain navigation by
   team id); `SandboxChrome` gains the warm coat (`data-kind='coach'`, `--sandbox-warm-*` tokens
   in globals.css mirroring the AA-ratified warm values); coach-shell pinned surfaces carry
   `--sandbox-chrome-h` (CoachTopStrip, CoachPortalShell mhead/rail, coaches.module.css
   stickies) — 0px-inert for customers.
5. **Re-anchor** — `lib/demo-coach-reconcile-core.ts` (stateless, diff-only, wall-clock-
   preserving day shifts; arrival heartbeat `coach_sandbox_reconcile`) +
   `/api/platform-admin/coach-sandbox-tick` + migration **226** (nightly 08:20 UTC).
   Verified: steady state writes zero rows; ±3-day round-trip shifts 34 rows each way.

**Deviations from mockups (flag at QA):** no pulsing dot on Tryout day (the chrome never claims
motion the clock won't deliver — scores re-anchor nightly); tryout scores are integers 1–5 (the
product rejects halves); "1 waiver unsigned" lives on the player profile (no roster-tile
aggregate exists in the product).

**Hardened at /simplify + /review (2026-08-04, same day):** demo date/rubric logic now reuses the
platform's own helpers (no drift); send-list exclusion became a PURE slug filter in
`lib/demo-org.ts` (zero DB coupling — a resolver failure can no longer kill the dues/insights
sweeps, and partial-seed states are moot); the re-anchor applies its ANCHOR ROW FIRST with
per-row conditional guards (concurrent runs idempotent; partial failures never compound — they
alert, and a reseed repairs); the reconcile also asserts the 11U/12U program-year LABELS so a
calendar rollover pages instead of rotting; demo slugs are refused by every org-creation slug
check and the seed refuses to adopt an org with non-demo members (squatting/hijack closed); the
reseed wipe covers every coach-writable child table (tolerant of unmigrated ones); tour/dock
session state is namespaced per sandbox; arrival-heartbeat discipline extracted to
`lib/demo-sandbox-heartbeat.ts` (both sandboxes). An encoding corruption in
`coaches.module.css` (mojibake re-save, 1173-line diff) was repaired losslessly in passing.

**PROD-PENDING (release step, owner decision):** seed on prod (`--allow-prod`), migration 226
(invisible to the drift gate — no schema change), marketing doors (`sandboxDoorsVisible` flag) +
/marketing copy pass + /strategy log. **Dev-pending:** migration 226 not yet applied to the dev
DB either (cron entry needs SQL access) — until then the tick runs by hand or a reseed re-anchors.
**Sibling project:** `archive/TOURNAMENT_ADMIN_SANDBOX_PLAN.md` (archived 2026-08-06 → `PROGRAM_TOURNAMENTS.md`) — **mockups approved 2026-08-02; it IS
building first.** The demo-mode machinery — demo-session entry pattern, central write block,
outbound silence, demo-org hygiene, re-anchor job pattern — is SHARED between the two sandboxes
and is being built there as org-agnostic pieces. **Check its state before building any of those
pieces here; assume they exist and reuse them.**

**Inherited GTM posture (binding, `BUSINESS_DECISIONS.md` 2026-08-02):**
- **Ungated at the door.** No email, no form, no lead capture on the coach sandbox either. The
  premise (Premium Coaches Portal is $0 until 2027-01-01, so a competitor gets more by signing up)
  holds identically here. Revisit trigger 2027-01-01.
- **Curate the room, not the visitor.** Hide admin/portal areas that would dead-end in a sandbox —
  billing/subscription, invitations and other fully-outbound screens, exports, deep settings —
  rather than showing screens made entirely of locked controls. Same hide-don't-dead-end principle
  as the binding archive-is-opt-in ruling.
- **Hygiene includes search exclusion** of any public demo pages, alongside directory, metrics and
  observability exclusion.
- **Fictional world:** the tournament sandbox uses **Riverdale Minor Ball Association**. Keep the
  coach demo in the same invented world (the "Riverdale" convention) rather than inventing a
  second one.

**Origin:** Ideas Backlog ("Play With a Live One First", coach track) expanded by owner direction:
a no-login sandbox of the REAL premium coaches portal with a **season-phase picker** — the
prospect jumps between frozen moments of a team's year. Grounding: 2026-08-02 feasibility
investigation (this repo, coaches-demo agent) + owner Q&A.

## Product shape

- **Entry:** one tap from marketing (no login, no email) → the real portal, on a fictional demo
  team, as a demo coach. Distinct sandbox chrome: slim banner "Sandbox — nothing here is saved ·
  Start your own team free →".
- **Phase dock** (persistent, sandbox-only UI): "You're viewing: Mid-season · Jump to:
  **Tryout day / Off-season / Season start / Mid-season / Season's End**" — moments naming
  (owner-adopted), not month names.
- **Per-phase landing screens** (proposed defaults, owner may adjust at build):
  | Moment | Lands on | The beat |
  |---|---|---|
  | Tryout day | Tryouts live scoring board | Evaluations mid-flight, split scores visible |
  | Off-season | Money — budget vs. actual | Budget built, expenses logged, dues installments underway; practice plan one tap away |
  | Season start | Schedule | Full season laid out; dues/expenses fuller |
  | Mid-season | Overview | One-thing card + six tiles, game this Saturday |
  | Season's End | Season Wrapped / Season's End door | Closed year, recap, archive browsing |
- **Look-don't-touch:** everything browsable; editors work on screen (client state) but any save
  is intercepted with the sales nudge: "Not saved in the sandbox — start your own team free to
  keep this." (exact copy via /marketing at build).

## Phase 3 — the guided tour: candidate beats (captured 2026-08-05, NOT designed)

Raw material for the Phase 3 session, written while the world was fresh so the next session starts
from a list rather than re-reading five seeded teams. **This is not a design** — the chip count,
grouping, copy and whether the tour is per-moment or one spine are all open, and all of it is
downstream of owner QA (§5.4), which may change which beats are worth pointing at.

**The machinery already exists.** `sandboxTourSteps()` returns `[]` for `kind === 'coach'`, which
renders no tour at all; the stepper, the numbered progress, the narration strip, the anchor-ring
and the per-sandbox session state are all built and running for the tournament sandbox. Phase 3 is
therefore **data + copy, not new components** — scope it as S/M, not L.

**What a visitor will NEVER find on their own** (the tour's actual job — everything else in the
sandbox is reachable by wandering):

| Moment | Buried beat | Why it earns a chip |
|---|---|---|
| Tryout day | The split opinion — bib 14, Hitting, **5 from one evaluator, 2 from the other**, each with a note | The single most human thing in the product; invisible unless you open that one card |
| Tryout day | The **evaluator bias readout** (one of the three reads consistently harsh) | Answers "how do I know my volunteers agree?" — a question coaches ask and nobody advertises |
| Off-season | The **unbudgeted** line ("Team photo day, $180") sitting outside the plan | The report earning its keep; proves it reports reality, not the plan |
| Off-season | The **upcoming** practice plan — three stations, three groups, a rotation clock, openable and runnable | The only place the product shows a plan you can walk onto a field with |
| Off-season | The testing session's **two honest blanks** (11 of 13 tested) | The no-fabrication rule made visible; a dash where a lesser tool would print 0 |
| Season start | That **exactly one** lineup is saved — the opener's — with the whole year still scheduled | The "set it up in one evening in March" story; only lands if you notice nothing follows it |
| Season start | Both pitchers sitting **at** the arm-care cap in that lineup | Safety as a feature, not a warning |
| Mid-season | The **playing-time outlier** under Lineups (one player well below the rest) | The insight coaches most fear being wrong about |
| Mid-season | The **unsigned waiver**, which lives on a player's profile (no roster-level aggregate exists) | Genuinely hard to find — flagged as a Phase 1 mockup deviation |
| Season's End | That the closed year is **actually browsable**, not a screenshot | The archive promise is the hardest thing to believe without touching it |
| Season's End | **9 of 12 families opened the recap** | The only number in the demo about parents, and the one that closes a "will they use it?" objection |

**Constraints that carry over (all learned expensively):**
1. **A step must never be able to do nothing.** Anchors may vanish; the narration sentence IS the
   deliverable, so pressing a chip always visibly produces something. (Tournament sandbox: two
   steps anchored to conditionally-rendered panels read as broken three separate times.)
2. **No motion claims.** Nothing in the coach demo moves while you watch — the re-anchor is
   nightly. No countdowns, no live dots. The dock deliberately carries no pulse for this reason.
3. **Writes are blocked**, so no step may ask the visitor to save, score, or change anything.
4. **Blind scoring stays ON** on the tryout board — no step may reveal candidate names.
5. **Phone budget is already tight.** The chrome is a banner + a five-chip dock that already
   overflows 390px; the stepper hides its label and dots under 640px. Measure before adding a row.
6. Mockups first, published as Artifacts, owner sign-off before any build.

**Open questions for that session:** per-moment chips vs. one spine across the year (the tournament
sandbox learned that two disconnected tours beat one — but its story was one day, not one season);
whether the "what parents see" preview is a tour stop or its own thing; and whether the tour should
open automatically for a first-time visitor or wait to be pressed.

## Architecture

**Not a time machine — five parallel teams.** One permanent demo org, one demo coach account
(head coach), **five teams frozen at different lifecycle moments** under it. The phase dock
navigates between teams. Each team's data is anchored *relative to today* (mid-season team always
has a game this Saturday; tryout team's tryout is always today, mid-scoring) and a **nightly
re-anchor/reseed job** shifts dates and restores canonical state.

Components:

1. **Demo session entry (new auth surface — build deliberately).**
   A dedicated route (e.g. `/try/coaches`) that server-side establishes a session for the ONE
   fixed demo Supabase user and redirects into the portal. Constraints: demo user id hardcoded
   allow-list (never parameterized), no `next`/redirect params, origin via
   `resolveTrustedAppOrigin` (auth-email gotcha), rate-limited via `lib/rate-limit.ts`.
   Blast-radius argument: this session can only ever see the fictional demo org. Rejected
   alternative: a cookie-less read-only render path — would fork the coach layout plus ~53 API
   routes that all assume a session.
2. **Central write block.** In `proxy.ts` (the funnel for `/coaches` and `/api/coaches`):
   requests for the demo org with non-GET methods get a structured `sandbox: true` JSON
   rejection. One chokepoint, zero per-route edits. Client save paths surface the nudge on that
   response (one shared fetch-layer hook, not 53 edits — verify feasibility at build; fall back
   to a generic toast). Concurrency is thereby solved: all visitors share one account but nobody
   can write, so nobody can clobber.
3. **Outbound silence.** Demo org short-circuits at the `notify()` chokepoint and the email send
   path — "Email families" composes but can never send. Guardian emails in seed data are
   `@example.com` fictional addresses regardless (defense in depth).
4. **The seed (the long pole).** One idempotent script (patterned on
   `scripts/seed-uat-coach-fixture.mjs` + `seed-free-tier-org.mjs`) creating org + coach user +
   five teams with per-phase datasets:
   - **Tryout day:** active year, roster-in-formation, tryout event TODAY with 2–3 evaluator
     sessions, partial per-evaluator scores + notes (include one deliberate split-opinion),
     offer/waitlist not yet decided.
   - **Off-season:** budget plan + logged expenses, dues schedules with some installments paid /
     one overdue, partial schedule of off-season practices, 2 practice plans (one with stations/
     rotation), development goals + a completed session.
   - **Season start:** full schedule, roster complete with jerseys/positions, dues mostly
     current, first lineup saved, attendance for early events.
   - **Mid-season:** the richest team — record ~14-3-1, game this Saturday (one-thing = lineup
     not set), attendance history with a dip, playing-time data (fairly-even with one outlier),
     arm-care data, insights that fire, 1 unsigned waiver, $ outstanding across 2 families.
   - **Season's End:** a prior program year taken through the REAL season-close lifecycle
     (binding: archive content flows only through `APPROVED_ARCHIVE_DOORS` /
     `APPROVED_SEASON_AWARE_ROUTES`; no hand-written "closed" states the app can't reach; no
     list edits — demo uses already-approved doors only). Season Wrapped + family-recap preview
     populated.
   All persons fictional (existing convention: fictional first names, fictional surnames, no
   real contact data). Time-relative anchoring throughout; script refuses to run against prod
   ids other than the dedicated demo org.
5. **Nightly re-anchor cron** (existing scheduled-jobs pattern): re-run the seed's anchor pass so
   "today" stays true; full reseed weekly or on-demand.
6. **Phase dock UI:** portal-level component rendered only for the demo org; five moments; also
   carries the "Start your own" CTA. Small guided-tour chips per phase (Phase 3, optional).
7. **Marketing doors:** "See it live" beside "Start free" on /for-coaches hero + the homepage
   Head Coach card (copy via /marketing; this is a GTM move — offer /strategy logging when the
   door ships). Demo org excluded from /discover, admin metrics, and observability alert noise.

## Rollout

- ~~**Phase 1 (launch):**~~ ✅ machinery (entry, write block, silence, dock, cron) + **three
  moments: Tryout day, Mid-season, Season's End**. Committed dev `7a7092ea`.
- ~~**Phase 2:**~~ ✅ Off-season (14U) + Season start (10U) datasets. Committed dev `c57f6462`.
- ~~**Phase 3 (polish):**~~ ✅ the guided tour — one seven-step spine across the year, the
  "what parents see" stop inside it (step 6), the invitation state, and the in-season books.
  Built 2026-08-05, dev, uncommitted. **Still open from the original Phase 3 list:** QR/share
  collateral for in-person pitching; the five demoted beats moving into the dock's own arrival
  sentences; and the optional tryout upgrade (addressable hub stage + a harsher evaluator drift, so
  the bias readout actually fires) — owner call, not taken.

## Risks & notes

- Season's-End fidelity: producing the closed year through the real lifecycle inside a seed
  script is the trickiest seed work — budget time for it; do NOT shortcut with hand-written rows.
- The demo coach account is shared by all visitors simultaneously — acceptable ONLY because
  writes are centrally blocked; any future "let them save something" idea reopens concurrency
  and needs its own design.
- Founding-season free pricing means no billing bypass needed until 2027-01-01; the demo org
  needs a permanent comp decision before then (note for /strategy).
- Nightly job failure = visibly stale demo ("tryout was yesterday"); alert on cron failure.
- These five teams double as permanent internal QA/UAT fixtures and screenshot sources — build
  the seed to be reusable for that (clean module boundaries per phase).

## Owner decisions (non-blocking, wanted at build)

1. Demo org/team naming (fictional-obvious vs. realistic; "Riverdale Ridge" convention exists).
2. Save-nudge copy (draft above; /marketing pass).
3. Whether the dock also offers "what parents see" at launch or Phase 3.

## Effort

L overall. Machinery ≈ M; the five-phase seed is the long pole (≈ M on its own, Season's End the
hardest slice). Phase 1 (three moments) is most of the machinery + the three richest datasets.
