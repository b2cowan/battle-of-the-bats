# Coach Portal — Chunk I: The One Thing (Team Overview IA)

**Status:** ✅ **BUILT ON DEV 2026-07-30 (uncommitted)** — all four phases in one pass, per the owner's
sequencing call. Gate green: typecheck 0, focused lint 0 errors, **570 unit tests** (37 new), all six
colour-token baselines ZERO, date-correctness ZERO, schema parity 0, dictionary coverage OK. NO migration.
Clean dev restart done (cache cleared with the server stopped; platform-admin login 200, coach Overview
route compiles, zero Supabase `EACCES`). Remaining = owner QA (§7 matrix) → `/simplify` → `/review` →
`/docs` → commit.

Owner approved direction 2026-07-30 ("looks good, go ahead").
**Binding visual spec:**
- Desktop review + three options — `claude.ai/code/artifact/bc2f7f45-406d-4fec-b963-cd62801064dc` rev 1
- **Option C on a phone — states & permissions** — `claude.ai/code/artifact/5ae1c9e4-c31e-4f83-a098-3fbaa0ae15cd` rev 3 (**the binding one**)

**Owner selection:** Option C ("ask one question, then get out of the way"). Options A and B are recorded in the
first artifact and are NOT to be built.

**Scope:** the PREMIUM team Overview (`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`) on desktop and phone.
The free portal's overview is OUT of scope this chunk (see §8).

---

## 1. The problem this chunk exists to fix

The Overview renders **nine independent bands**, each testing its own condition, in source order, with no
priority between them. Two of those bands are driven by the *same* condition and issue opposite
instructions:

| Band | Condition |
|---|---|
| In-season lull card → **"Add an event"** | `in_season && !nextEvent` |
| Winding-down cue → **"Close out the season"** | `in_season && !nextEvent && hasRealFinalizedGame && !hasUpcomingTournament && quiet ≥14d && !dismissed` |

The second is a **strict superset** of the first. Whenever it can render, the first is already wrong — but
both draw. That is the "disorganized jumble with conflicting information" the owner reported, and it is a
logic defect, not a styling one.

Five further symptoms, all downstream of the same missing priority model:

1. The setup next-action line and the "New here? Take the 2-minute tour" offer share one rule despite being
   unrelated (this season's task vs. first-ever orientation). The tour already has a permanent home in the
   Season setup popover.
2. **Width is inverted.** The tournament strip spends full page width on a name + date range; the season
   record is `width: fit-content` and floats at half width; the data tiles are the smallest elements.
3. **The returning coach's content is last.** "Your team at a glance" starts below the fold, after two
   onboarding bands, the contradiction, a tournament strip and the record.
4. **"Add an event" appears three times** (anchor CTA, Next-up tile sub, setup step); "No budget / Set a
   budget" appears twice.
5. **A finished tournament renders with no state at all.** `CoachLiveEventCard` draws a `Live now` or
   `Upcoming` chip and *nothing* when the event has ended — so a two-week-old tournament occupies the same
   slot a live one would, silently. Silence is being used to mean "finished".

---

## 2. Decisions (owner-ratified 2026-07-30)

Numbering matches the artifacts. D1–D7 come from the desktop review; D8–D15 from the mobile + permissions
pass. **All fifteen are binding.**

| Ref | Decision |
|---|---|
| **D1** | **One anchor slot, ordered resolution.** game day → next event → season check → in-season lull → pre-season next step. First match wins; the rest do not render. A more specific state always replaces the general state it is a superset of. |
| **D2** | **A state that replaces another inherits its door.** The season check carries "Add an event instead" as a secondary answer, so suppressing the lull card costs the coach nothing. |
| **D3** | **The anchor's subject drops out of the tile row.** A schedule-shaped anchor suppresses the Schedule/Next-up tile. |
| **D4** | **Onboarding lives in one place.** The tour offer leaves the next-action line and stays in the Season setup chip; the next task becomes the pre-season anchor shape or a tail link. No band shares a rule with an unrelated prompt. |
| **D5** | **Width encodes importance.** Full width is reserved for the anchor and the board. The record widget drops `width: fit-content`; the tournament stops being a full-width band. |
| **D6** | **No state is never a state.** A finished tournament shows a `Finished` chip and moves to the tail; it never renders bare in the slot a live event occupies. |
| **D7** | **Everything that isn't today's work is one tail** — finished tournament, last season, this week, announcements nudge, acquisition banner. |
| **D8** | **The one thing has three shapes:** *question* (a decision only this coach can make), *working card* (a job due now — game day, next game), *next step* (season not started). Exactly one renders, chosen by D1's ordered rule. **This supersedes the desktop artifact's "always a question" framing**, which broke game day. |
| **D9** | **Mobile action shape is fixed:** one full-width 44px primary, then a single row of text answers. Never a stack of buttons (costs ~140px and pushes the board under the fold). |
| **D10** | **The board is a fixed set of six tiles in a variable order** — never a variable set — so the coach keeps spatial memory across states. Capability-hidden tiles are the only removals. |
| **D11** | **An un-set tile is muted, not dashed,** and says what it would give them. Dashed frames stay reserved for the Money sample (Chunk G rule 3 — the portal has exactly one). |
| **D12** | **The tail is a tappable list on mobile and a single ruled line on desktop** — same content, two shapes. |
| **D13** | **Slots 5–6 are a season-health pair resolved once by capability.** Money access → Dues + Budget. No money access → **Attendance + Playing time**. Fallback chain: Playing time → Development → five-tile board. Never a ranked list. |
| **D14** | **State proposes, capability disposes.** A card may only be the one thing if this coach can *complete* its action; otherwise the resolver moves to the next candidate, or the card keeps its sentence and drops its button. Never a disabled control, never an action that 403s. CTAs gate on "can complete" (`lib/coach-capabilities` predicates), never on "can see" (`lib/coach-nav-visibility`). |
| **D15** | **A board-only Overview is a valid state.** When nothing is actionable for this coach, no anchor renders and the page opens on the board. |

### 2.1 Rationale notes worth preserving

- **D8's correction.** The desktop artifact framed C as "the page asks one question". Game day is not a
  decision — it is work — so a literal question would have regressed the portal's highest-value moment.
  Three shapes, one slot, same resolver.
- **D14 is a re-application, not an invention.** The CTA-gate distinction already exists in
  `lib/coach-capabilities.ts` (`canManageSchedule`, `canManageTryouts`, the `rosterWrite` note) and its
  header records the exact defect it was created for: *"setup steps gated on page visibility told assistant
  coaches to 'Add players' and sent them to a read-only roster."* With only one action on the page, that
  class of defect goes from cosmetic to fatal. Route every anchor CTA through those predicates.
- **D13's asymmetry is intentional.** Dues and Budget answer the head coach's two season-health questions
  (*who owes me* / *am I overspending*). Attendance and Playing time answer the assistant's two (*is my
  squad showing up* / *is everyone getting a fair share*). Same altitude, and neither is currently visible
  at a glance to anyone.

---

## 3. The anchor resolver

One ordered function. Each candidate declares a **state predicate** and a **completion gate**; the first
candidate whose state is true AND whose gate passes becomes the one thing. A candidate whose state is true
but whose gate fails either (a) renders informationally with its button dropped, or (b) yields to the next
candidate — decided per candidate, per the table below.

| # | Candidate | Shape | Primary action | Completion gate | Gate fails → |
|---|---|---|---|---|---|
| 1 | **Game day** (event today) | working | Build lineup | `capabilities.lineups` | Primary falls back **Build lineup → Take attendance → informational**. Card never yields — opponent/time/place matter to every coach on staff. |
| 2 | **Next event** (upcoming) | working | Build lineup (games) / Open schedule | `lineups`, else `schedule` | Same fallback chain as game day. |
| 3 | **Season check** (winding down) | question | Close out the season | `seasonMeta.canManageSeasons` | Keeps the sentence, drops the button: *"{Club} closes the season — your Season Wrapped appears here when they do."* (already the shipped cue behaviour). Retains "Add an event" answer per D2. |
| 4 | **In-season lull** | question | Add an event | `canManageSchedule` | **Yields.** Without schedule access there is no event data at all, so this card can never be honest. |
| 5 | **Pre-season next step** | next step | the step's own action | the step's own completion gate | **Yields to the next open step**, then to D15 (board only). Roster steps are head-coach-only — an assistant must never see "Add players". |
| — | *(none matched)* | — | — | — | **D15:** no anchor; page opens on the board. |

**Retired by this table:** the standalone winding-down cue card, the in-season lull card as a separate
band, the preseason anchor as a separate band, and the setup next-action line. All five become candidates
in one resolver.

---

## 4. The board

Six slots, fixed set, variable order (D10). Two columns on phone, five/six across on desktop.

| Slot | Tile | Source | Visibility gate |
|---|---|---|---|
| 1–4 | Record · Roster · Schedule/This week · Tournaments | already on the page | Record: `canSchedule`. Roster: `canViewRoster`. Schedule: `canSchedule`. Tournaments: always. |
| 5–6 | **money pair** Dues + Budget | already on the page | `money !== 'off'` |
| 5–6 | **coaching pair** Attendance + Playing time | **new** (§5) | Attendance: `attendance && roster !== 'off'`. Playing time: `lineups`; else Development (`notes \|\| roster !== 'off'`); else 5 tiles. |

**Order rules** (phase-driven, same spirit as today's `TILE_ORDER`):
- game day → Roster, Record, then the pair, then Tournaments
- in-season → the pair first when it carries a warning flag, else Record first
- pre-season → Roster, Schedule, then the rest muted

**Retired:** the standalone `SeasonRecordWidget` band on the Overview (it becomes tile 1; its scope
controls — League / Tournament / Scrimmage — move to the Insights/record page, see §9 open question 3).

---

## 5. New data (Phase 3)

Both feeds already exist and are already gated exactly as D13 requires. **No new API routes, no migration.**

| Tile | Feed | Existing gate | Derived value |
|---|---|---|---|
| **Attendance** | `GET /api/coaches/[orgSlug]/teams/[teamId]/attendance` — per-player `attended / known / recorded` (season reliability) | `canViewRoster` | Season average %, event count, and a count of players below a threshold (mock: *87% · 10 games · 3 players under 70%*) |
| **Playing time** | `GET /api/coaches/[orgSlug]/teams/[teamId]/lineup-analytics` → `computeTeamSeasonLineupAnalytics` (`lib/lineup-analysis.ts` already computes on-field/bench innings and *"spread of bench innings across players (fairness at a glance)"*) | `capabilities.lineups` | A one-word verdict + a below-average count (mock: *Fairly even across 10 games · 2 players well below*) |

**Threshold honesty rule** (inherited from Batch 3's Wrapped rule): each tile needs an earned-it minimum —
no verdict from one game. Below the minimum the tile reads muted ("Not enough games yet"), never a
confident number. Exact thresholds to be set at build and unit-tested.

---

## 6. Build sequence

Four phases. **Phase 1 is independently shippable and fixes the reported defect.**

### Phase 1 — The resolver + the one thing + the tail
- Ordered anchor resolver with the three shapes and the D14 gate table (§3).
- Season cue merges into the anchor; lull/preseason/setup-line bands retire.
- Tour offer moves fully into the Season setup chip (D4).
- Tail assembled (D7/D12): finished tournament **with a `Finished` chip** (D6), last season, this week,
  announcements nudge, acquisition banner. `CoachLiveEventCard` gains the finished state.
- **Closes:** the contradiction, findings 1/2/5/6.

### Phase 2 — The board
- Six fixed slots, phase-driven order, D3 subject-drop.
- Record becomes tile 1; the standalone widget retires from Overview; `width: fit-content` deleted (D5).
- Muted empty tiles (D11).
- Mobile: 2-col board, full-width primary + answer row (D9). Desktop: 5–6 across.
- **Closes:** findings 3/4.

### Phase 3 — The coaching pair
- Attendance + Playing time tiles from §5 feeds, with earned-it thresholds.
- D13 capability swap + fallback chain.

### Phase 4 — Verification + docs
- Permission matrix QA (§7).
- `/docs` sync — the Overview is a user-facing flow and the coaches guide describes it.
- `/simplify` before `/review` (the resolver is a new shared abstraction).

---

## 7. QA — the permission matrix

Two coaches on the same team on the same morning will now **correctly** see different anchors. This is the
intended behaviour and it makes a single happy-path check insufficient. Minimum matrix, each run against a
game-day, an in-season, a winding-down and a pre-season team:

| Persona | Expect |
|---|---|
| Head coach | Full board (money pair), all anchors, close-season button present |
| Default assistant (schedule/attendance/lineups/roster-view, money off) | Coaching pair board, working anchors, **season check with no button** |
| Assistant, `money: 'read'` | Money pair board, **no money write action anywhere** |
| Assistant, `lineups: false` | Game-day anchor falls back to Take attendance; Playing time slot falls to Development |
| Assistant, `attendance: false` | Game-day anchor falls to informational; Attendance slot absent |
| Assistant, `schedule: false` | Lull candidate yields; verify no "Nothing on your schedule" is ever shown |

Plus the standing gate: `npm run verify:changed`, `npm run typecheck` (shared modules touched), all six
colour-token baselines at ZERO, and a phone probe pass at 360×740 in the style of the Money suite.

---

## 8. Out of scope (this chunk)

- **The free portal's overview.** It shares `CoachLiveEventCard` (which Phase 1 changes — the finished
  state benefits both) but keeps its own layout. The two tiers will visibly diverge further; that is
  consistent with the two-family ruling (free = consumer "companion", premium = operator "HQ") and is
  deliberate. A follow-up chunk can decide whether the free overview adopts the one-thing rule.
  **→ ANSWERED 2026-07-30: it does NOT.** The free page has no overlapping predicates and already
  satisfies "one prose card per surface"; it has a *redundancy* defect instead (the same tournament
  stated up to four times, the coach's own numbers last). Review + seven decisions awaiting
  ratification: `FREE_COACH_OVERVIEW_COHERENCE_PLAN.md`. One of them (**DF-2**) is a correctness fix
  in `pickFanViewRegistration` that lands on **this** tier too — it picks by `registeredAt` and by
  *publication* status, so premium's tail row can name a future event while a live one is running.
- **A seventh tile.** See open question 2.
- **Any migration.** Nothing in this chunk stores anything new.

---

## 9. Owner rulings — all three closed 2026-07-30

1. **D16 — Money-pair emptiness: COLLAPSE.** *(owner ruled: collapse to one setup tile)* While a coach with
   money access has **neither** dues nor a budget set up, slots 5–6 hold **one** "Set up your team's money"
   tile and the freed slot fills with **Attendance**. As soon as either exists, the Dues + Budget pair
   returns and Attendance yields. Rationale: a brand-new coach gets a full board on day one instead of a
   third of a phone screen reading "not set". This is a **documented, single exception** to D10's fixed-set
   rule — it is keyed on "has this team started using money at all", not on week-to-week data, so the
   board still cannot reshuffle underneath a coach mid-season.
2. **Head coaches do NOT get a seventh tile.** Attendance and Playing time remain the coaching pair for
   coaches without money access; head coaches reach both from Insights. *(No change to D13.)*
3. **Season-record scope chips move to the record page.** Accepted — League / Tournament / Scrimmage are a
   configuration control, not a glanceable fact; the headline numbers stay on the Overview as tile 1.

### 9.1 Sequencing ruling

**Owner chose all four phases in ONE pass** (2026-07-30) rather than shipping Phase 1 alone. §6's phases
remain the build order internally, but the handoff is a single unit with the full permission matrix run
before it reaches the owner.

---

## 9.2 Build deviations from the mockups (all deliberate, all flagged)

1. **D3 is satisfied by REUSING the schedule slot, not emptying it.** The mockups showed the Next-up tile
   simply not drawn when the anchor is schedule-shaped — which leaves a **five**-tile board in the single
   most common state of all. Shipped instead: the slot has two faces. When the anchor is already about
   what's next it reports **This week** (counts + birthdays — a different fact); otherwise **Next up**. The
   *subject* still drops out; the slot is reused rather than emptied, and the board stays at six.
   This also gave the orphaned "This week" strip a home instead of deleting it.
2. **The board reuses the shipped tile CSS** (`.snapshotGrid` / `.snapshotCard` / `.wltPip`) rather than
   the new `.board*` family the mockups implied. Two card systems for one band would have been the exact
   duplication `/simplify` exists to catch, and `.wltPip` already carries its warm-theme lime-fill restore.
   Only three CSS additions were needed: a `muted` value tone, a `mute` flag tone, and the 3-up desktop
   grid (the old 5-up rule would orphan the sixth tile).
3. **The primary action is `btn btn-lime` + a layout-only modifier**, not a bespoke button, so warm-theme
   ink-on-lime handling and the single-lime-action rule are inherited rather than re-implemented.
4. **The desktop board is 3-up (two rows), not 6-across.** The portal's reading column is 960px; six
   across would be ~145px a tile, which is a list, not a board.
5. **The arm-care safety line stays its own row above the tail**, not folded into it. An arm-care breach is
   a warning; the tail is where quiet things go.
6. **`resolveOverviewAnchor` returns `null` while the first read is in flight**, so the page never renders
   a confident card built on data it does not have. Similarly `moneyStarted` assumes "underway" while
   loading — an established coach flashing "set up your money" is a worse lie than the reverse.

## 9.3 Left for `/simplify` (deliberately not deleted in this pass)

Retiring the bands left orphans. They are **flagged, not deleted**, so one sweep can retire them together
and the owner can veto any that should survive:

- `components/coaches/SeasonRecordWidget.tsx` — now unreferenced (the record is tile 1; the Insights page
  already carries its own record band with the same categories, defaults and storage key, so the scope
  chips survive there).
- `coaches.module.css`: `.nowCard*`, `.seasonCue*`, `.setupLine*`, `.lastSeasonCard*`, `.weekStrip*`
  (a `⚠ SUPERSEDED` note now sits above `.nowCard`).

## 9.4 `/simplify` — 4 agents, 6 findings, ALL fixed (2026-07-30)

Three of the four agents independently converged on the same top finding, which is the strongest
signal in the pass.

1. **[reuse / simplification / altitude — all three]** The tail's tournament row **hand-rolled a
   second copy of `CoachLiveEventCard`'s lifecycle logic** — same `deriveCoachLifecycleChip` call,
   same three labels, a second `.tailChip` CSS formula, and it left the `CoachLiveEventCard` import
   dead. That component's own header says *"ONE component for both tiers so the block can't drift"*,
   and **this same diff had just extended it** with the Finished state — which the premium page then
   bypassed. **Fixed:** `CoachLiveEventCard` gained a `layout="card" | "row"` prop; the premium tail
   renders the shared component. `.tailChip` deleted. A future state (e.g. "Postponed") now lands on
   both tiers by construction.
2. **[reuse — a real regression this chunk introduced]** The record tile computed **its own**
   scrimmage-excluded tally, abandoning the per-team remembered scope (`flhq.coachWlt.{teamId}`) that
   Insights honours. A coach who had switched scrimmages ON would have seen **one record on the
   Overview and a different one on Insights** — the exact drift the existing "can never disagree"
   comment was written to prevent, and which Chunk I broke by retiring the only widget that read it.
   **Fixed:** new `lib/coach-season-record.ts` is the single source (categories, default, storage
   key, tally, format); the tile reads the coach's scope and names it in its sub-line. *(The comment
   -enforced convention between `SeasonRecordWidget` and Insights is now real shared code.)*
3. **[efficiency]** The Attendance and Development reads fired on raw capability alone, so an
   **established coach paid two wasted HTTP round trips on every Overview load** — the board never
   draws either tile once money is underway. **Fixed:** `resolveCoachingPair()` is exported and used
   by BOTH the fetch gate and the board, and a unit test asserts they can never disagree.
   `moneyStarted` was hoisted above the effects so there is one definition, not two.
4. **[altitude]** The resolver took hand-built slim capability shapes and the page passed raw fields,
   **bypassing the `lib/coach-capabilities` predicate seam** whose whole purpose is that a capability
   -model change is a one-file diff. **Fixed:** both resolver entry points now take the real
   `CoachCapabilities` and call `canManageSchedule` / `canViewMoney` / `canViewRoster`; the coaching
   pair gates through `isCoachNavItemVisible` (a tile is a *door*, so it takes the door's gate).
   `AnchorCapabilities` / `BoardCapabilities` deleted.
5. **[simplification]** `AnchorAnswer` carried a `'build_lineup'` member the resolver can never emit.
   **Fixed:** removed.
6. **[simplification]** `.oneThing`'s accent was set by two equal-specificity rules (`data-shape` and
   `data-kind`), so the winner depended on declaration order — a future reorder would have silently
   flipped game day from green to blue. **Fixed:** the accent is driven by `data-kind` alone.

**Nothing was skipped.** Post-fix gate: typecheck 0, focused lint 0 errors, **574 unit tests**
(41 in this module), all six colour baselines ZERO, schema parity 0, clean dev restart verified.

**Process note worth keeping:** an intermediate save left a duplicate `const` in the page, which
poisoned the *running* dev cache and made that one route 500 even after the source was correct —
other routes stayed 200, which is what distinguishes a poisoned cache from a real page fault. The
documented stop → clear `.next` → restart sequence cleared it.

## 9.5 `/review` — high-risk tier, 5 lenses, 10 findings CONFIRMED and fixed (2026-07-30)

Tier: **high-risk** (two new `lib/**` shared modules + coach-portal read paths). Deterministic gate
ran first and was green, so no agent time was spent on types/lint/tokens/migrations. Lenses:
correctness · security & multi-tenant · concurrency/state · regression & blast-radius · data contract.

**Two findings were outright broken code, both caught by more than one lens:**

1. **[HIGH · confirmed by data-contract + security] The Development tile could never load.** The
   client read `json.players`; the route returns `rows`. The tile would have sat on "…" **forever**
   for exactly the coaches it was built for. Fixed. *(This is the finding that justifies the whole
   review: unit tests pass, types pass, and the page renders — the tile just silently never fills.)*
2. **[HIGH · regression lens] My own `/simplify` note was dangerously wrong.** I marked the
   `.nowCard` family "SUPERSEDED — safe to retire", but it is still live on the **Attendance page**
   and the **Money hub's six anchor cards**. A future cleanup trusting that note would have stripped
   the styling off two working pages. The comment now says DO NOT DELETE and names the four families
   that genuinely are orphaned.

**Also confirmed and fixed:**

3. **[HIGH] The board changed tile IDENTITY after first paint.** `moneyStarted` defaulted to "true"
   while loading, so a brand-new coach saw Dues+Budget resolve into Money-setup+Attendance — label,
   icon and destination all moving. That is precisely the reshuffle D10 forbids, in the module whose
   own comment claimed it could not happen. Fixed properly: `moneyStarted` is now `boolean | null`,
   and while it is unknown the board holds **two neutral placeholders** — a placeholder makes no
   identity claim, so resolving it is not a reshuffle.
4. **[MEDIUM] The two `moneyStarted` signals were different predicates.** The server counts dues
   *schedules*; the client fallback counted generated *installments*. They could disagree
   persistently, not just transiently. The fallback is now consulted only after the authoritative
   read has had its chance, and says so.
5. **[MEDIUM · security] The Development tile was offered to coaches whose goals are redacted.**
   The section is visible on roster view, but the tile's *number* is goal-based and goals are
   notes-gated — so it would have printed a confident "No goals yet" at someone simply not cleared
   to see them. Now gated on `canViewDevelopmentGoals`, and the client also honours the route's
   `showGoals` flag rather than trusting a redacted-empty array.
6. **[MEDIUM] "No games yet" was shown to a mid-season team** that had merely switched every record
   category off. Now reads "Not counted · no game types selected — choose them in Insights".
7. **[MEDIUM · regression] The game-day scoreline was silently lost** in the rewrite. Once a score
   exists it is the most-wanted fact on the page; restored, and sized above the meta line.
8. **[MEDIUM · regression] The `Finished` chip over-reached to the `unknown` state** (an event with
   no start date), on **both tiers** — labelling a guess as a fact, the mirror image of the bug it
   was fixing. `unknown` renders no chip again.
9. **[LOW-MED] The fetch gate and the board still disagreed in one direction.** A collapsed money
   pair frees only ONE slot, but the gate used the full eligible pair, so Development was fetched
   for a tile that was never drawn. New `resolveCoachingTilesShown()` is the single answer for both,
   and the test now asserts **both** directions (the old one only proved the safe half).
10. **[LOW] The Development tile's caption borrowed the zero copy while loading** ("…" beside "Set a
    focus for each player"). Now says "Checking…".

**Also corrected:** the `summarisePlayingTime` doc comment claimed the share covered "innings
dressed for" when it covers *decided* innings (blank grid cells are excluded on purpose). The
behaviour is right — a half-filled lineup should not manufacture unfairness — but the comment
overclaimed, and a wrong comment is how the next person builds on a false premise. **Restored:** the
lull card's "View tournaments" door, dropped in the rewrite.

**Refuted / not defects (checked, no change):** `deriveRepPhase`'s `'result'` value is structurally
unreachable here (assignments are draft|active-filtered); the summarisers' division-by-zero, empty
-array and identical-share paths are all correctly guarded; `SeasonRecordWidget` is NOT orphaned
(Insights still uses it); money figures and roster PII remain server-redacted independent of the UI
gates; no cross-tenant path was introduced.

**Post-fix gate:** typecheck 0 · focused lint 0 errors · **583 unit tests** (50 in this module) ·
all six colour baselines ZERO · date-correctness ZERO · schema parity 0 · both coach surfaces
recompile clean with zero dev-log errors.

## 9.6 `/docs` — coach guide synced (2026-07-30)

Only `lib/help-content/coaches.tsx` describes this flow. **No anchor was renamed or removed**, so every
existing deep link (including the Overview's own Help button → `#premium-portal-tour`) still resolves;
three new FAQ anchors were added. No hub card change — the guide's home is unchanged.

**Corrected — the guide described controls that no longer exist:**
- The "Getting around your Premium portal" body described a *setup checklist panel that disappears* and
  an at-a-glance strip with a separate season record, a **This week** line and a **Last season** card.
  Rewritten to the shipped shape: one card at the top, six tiles under it, a quiet list at the bottom.
- `faq-first-week-trail` claimed *"one line under the header names the single next thing worth doing"* —
  that line is retired. It now describes the pre-season card, and names the setup chip as the tour's one
  home.
- The Season's End section's Season-check paragraph now says the cue **always offers "Add an event
  instead"**, and that a coach who cannot close a season gets the same heads-up without a button.

**Added — behaviour with no coverage at all:**
- `faq-overview-one-thing` — *"Why does my Overview only show one thing to do?"* Names the priority
  order, the always-present alternative, the legitimate no-card state, and — importantly for support —
  **why two coaches on one team correctly see different cards**.
- `faq-overview-tiles` — the six tiles, the attendance/playing-time swap for coaches without money
  access, the D16 money collapse, and why "Not enough yet" is an honest answer rather than a fault.
- `faq-overview-record-count` — the record's game-type scope lives on Insights and the Overview follows
  it; "Not counted" explained.

**Search metadata updated** (the guide's search matches keywords/searchText/answerText, never rendered
prose): ~30 new terms including *one thing · season check · is the season over · add an event instead ·
six tiles · attendance tile · playing time tile · money not set up · finished tournament · not enough
yet · why is my overview different*. Verified: focused lint clean, typecheck clean, both the customer
guide and the platform-admin mirror compile.

## 10. Provenance

Reviewed 2026-07-30 under `/design` + `/ux` against `memory/design_system.md`,
`memory/design_principles.md` and `memory/design_decisions.md`. Inherits and does not re-litigate:
Chunk A rule 5 (the 960px reading column is not widened for one band), Chunk G rule 3 (one dashed frame in
the portal), Batch 2's disclosure/one-list rules, Batch 3's device-memory + earned-it-threshold rules, and
Batch 4's "trailing chip space is reserved for STATE that changes".
