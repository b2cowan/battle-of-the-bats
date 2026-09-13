# Depth Chart — Three States — Implementation Plan

> **Status:** BUILT on dev 2026-09-12 (uncommitted at the time of writing — the hub's stage strip
> carries the anchor once it lands). Owner accepted D1–D4 as recommended the same day. Migration
> 291 applied to dev 2026-09-12 and verified by query (rows_with_key 0, with_okay 0, with_best3plus
> 0 → 2); **prod PENDING** (data-only — verify by the count, never by a gate). 27 new unit tests
> (the generator's first); layout sweep clean on the board and the player page; `check:demos` green
> on dev. QA walk on the hub's QA Walk tab, ledger §177. `/simplify` + `/review` + `/docs` offered
> at hand-off.
> **Created:** 2026-09-12
> **Branch:** dev
> **PM brief:** `COACH_DEPTH_CHART_THREE_STATES_PM_BRIEF.md` (same folder)
> **Project hub (mockup · brief · plan · decisions, one URL):** https://claude.ai/code/artifact/cc825629-70fc-4293-b4bb-cb19a4ad06c6 —
> source `COACH_DEPTH_CHART_THREE_STATES_HUB.html` (republish the same path every round)
> **Origin:** a coach told the owner that "Not set" and "Okay" on the depth chart "seem to behave the
> same way". This plan argues from what the code does, not from what Lineup Intelligence P1/P5
> intended.

## Goal

A coach can say out loud what every cell on the depth chart means, and the game-day Auto-fill
does what its mode label says with those cells.

Today the depth chart (and the Positions picker on a player's page) offers four states per
position — **Best (ranked)**, **Okay**, **Never** and **Not set** — and the coach's complaint is
correct three times over (Findings F01–F03 below). The proposal collapses the ladder to **three
states with sharp meanings** — **Best (ranked)**, **Never**, and **blank = fine anywhere they are not
Never** — reworks the Auto-fill mode labels so each says what it does with the ratings, and fixes
five smaller things on the same board that the review surfaced (F04–F09).

## What the code does today (verified 2026-09-12)

### Storage model
- `rep_roster_players.primary_position` / `secondary_position` (text, mig 070) hold **Best ranks
  1 and 2**. `lineup_profile` (jsonb, mig 171; app-enforced shape, no DB CHECK) holds
  `{ morePreferred: string[] (Best 3+), canPlay: string[] (Okay), never: string[], pitcher: {rank,
  maxInnings} | null, aSquad: boolean }`. NULL on legacy rows and rows created by non-picker paths.
- `lib/lineup-profile.ts` owns the shape: `normalizeLineupProfile` (validate raw against the Sport
  Pack; never > canPlay > morePreferred precedence), `buildLineupProfileWrite` (picker payload →
  primary/secondary + profile), `playerPositionPrefs` (reconstruct `{preferred, canPlay, never}`
  for readers). Every surface writes through the same per-player PATCH
  (`app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts`).
- Readers of the position buckets: `lib/lineup-generator.ts` (via `GeneratorPlayer.preferred /
  canPlay / never`), `components/coaches/DepthChartBoard.tsx`, `components/coaches/
  PositionProfileEditor.tsx`, the player page, the game page and `_LineupEditor.tsx` (both build
  `GeneratorPlayer`s), `lib/rep-season-rollover.ts` (copies the profile forward, opaque),
  `lib/demo-coach.ts` + `scripts/seed-demo-coach.mjs` (seed the full shape with `canPlay: []`,
  `never: []`). Season Wrapped / recap / insights / arm-care read only `pitcher` and `aSquad`.

### The four states and the cycle
- Both editors cycle a cell **blank → Best → Okay → Never → blank** on tap. Best cells number in
  the order they are picked; re-ranking on the grid means cycling a cell all the way around; the
  player page has reorder arrows.
- The board's legend lists four swatches: `Best (ranked) · Okay · Never · Not set`. The player
  page's legend reads **"Okay — fill in if needed"** and **"Not set — only if needed"** — and its
  help tooltip: Okay = "a fine fill-in when Best spots are taken", Not set = "allowed, not
  preferred — used only to round out the field".

### What Auto-fill actually does with each state, per mode
Mode is pre-picked from the game type (`lineups/[eventId]/page.tsx`): tournament game →
Competitive, scrimmage → Development, anything else → **Balanced (the default for a league game)**.
`pickForPosition` + `scoreLineup` in `lib/lineup-generator.ts`:

| | Competitive | Balanced | Development |
|---|---|---|---|
| Best (ranked) | first; the player for whom the spot ranks highest wins, then A-squad, then least-played | in the pool — **rank ignored**, least-played at the spot wins | ignored |
| Okay | second; least-played among Okay players | in the same pool as Best | ignored |
| Blank | last resort; least-played among the rest | last resort | ignored (same as Best/Okay) |
| Never | never placed | never placed | never placed |

Scoring nudges (`scoreLineup`, used by the candidate-and-score `generateBestLineup`): competitive
`prefTop 2.5 / prefOther 1.5 / canHit 0.5 / offPref −1.5`; balanced `pref 1 / canHit 0.75 / offPref
−1`; development ignores position fit entirely.

So: in Development, Okay and blank are identical; in Balanced, Okay and Best are the same pool and
the Best *ranking* is ignored; the four-rung ladder is fully expressed only in Competitive mode.
`lib/lineup-analysis.ts` flags conflicts, bench balance and unfillable spots — it never says which
rung a placement came from, so even in Competitive the difference is invisible after the fact.

### Help copy today
- `faq` "player profile / positions" (`lib/help-content/coaches.tsx` ~L1102–1108): "tap a position
  to cycle it through Best, Okay, or Never … Okay are fill-in spots".
- Depth chart article (~L1173–1180): "Best (ranked 1, 2, 3…), Okay, Never, or not set".
- Pitching article (~L1186–1192): "the mound isn't one of the Best/Okay/Never fielding chips".
- Auto-fill article `faq-lineup-autofill-positions` (~L2918–2930): "favors each player's Best
  positions **in the order you ranked them** (Okay spots are used as fill-ins)" — **over-claims**:
  Balanced ignores the ranking.
- `keywords` / `searchText` carry `'best okay never'`.

### Data on the ground (queried 2026-09-12 with `scripts/db-query.mjs`, read-only)
| | players | with a profile | with ≥1 Okay | with ≥1 Never | with Best 3+ | teams with Okay |
|---|---|---|---|---|---|---|
| dev | 186 | 11 | 2 | 3 | 0 | 2 |
| prod | 65 | 14 | **4** | 12 | 12 | **1** |

Prod's Okay data is **9 cells on 4 players on one real team**. That is the whole migration.

### Demo world
`lib/demo-coach.ts:midseasonPitcherProfile` seeds two pitchers (rank 1 cap 3, rank 2 no cap) with
`canPlay: []`, `never: []`, `morePreferred: []`; Best 1/2 come from primary/secondary. **No dock
line or tour step narrates the depth chart** (grep of `demo-moments.ts`, `sandbox-chrome.ts`,
`demo-org.ts`). So the sandbox's depth chart today shows Best 1/2 and two pitchers and nothing
else — no Never, no Best 3+.

### Tests
`lib/lineup-generator.ts` and `lib/lineup-profile.ts` have **no unit tests** (`tests/unit` has
`coach-position-recency.test.ts` and `lineup-season-analytics.test.ts` only).

## Findings

**F01 — The legend describes Okay and Not set with the same words.** Player page: "Okay — fill in
if needed" / "Not set — only if needed". The coach didn't misread anything; the product said they
were the same.

**F02 — The four-rung ladder exists only in Competitive mode.** Balanced (the league-game default)
pools Best + Okay and ignores rank; Development ignores everything but Never. The only rating that
means the same thing in every mode is Never.

**F03 — Nothing after the fact shows which rung a placement came from.** A player at 2B because
they were Okay looks identical to one there because nobody rated was free. Even where the ladder
works, its effect is invisible.

**F04 — "Not set" sits in the board's legend as a swatch**, as if it were a choice a coach makes.
It is the absence of one, and a blank white box next to three coloured ones reads as a fourth
option.

**F05 — The A-squad column is a row of grey stars with no on-grid explanation.** The meaning
("gold-medal starter — protected from the bench") lives in a hover `title` only — invisible on a
tablet, invisible to a keyboard, and it fails the clickable-highlight rule. It also only does
anything in Competitive mode with the A-squad dial on "prioritized".

**F06 — The pitcher chip cycles through six states** (— → Ace → #2 → #3 → #4 → #5 → —). Un-
pitchering a player on desktop is five taps, each autosaved. The phone accordion already uses a
dropdown for rank; the desktop grid should too ("a field choosing one value is a dropdown", owner
2026-08-22).

**F07 — The innings-cap input has no label once it holds a value.** The "cap" placeholder vanishes
on the first keystroke, so *Ace / 1* reads as "rank 1, and… 1?". It is the arm-care max innings
per game.

**F08 — Re-ranking Best on the grid is hidden.** Order = tap order; moving a spot to the end means
cycling it around. The player page has arrows; the grid's tip doesn't say so.

**F09 — The board doesn't say which mode it feeds, and the help over-claims.** A coach rates
carefully, builds a Balanced lineup, and the rank was never read. The Auto-fill article says
"in the order you ranked them" unconditionally.

## Proposal (recommended)

**P1 — Three states.** Per position: **Best (ranked)**, **Never**, or **blank**. Blank means "fine
— anywhere they're not Never". Tap cycle **blank → Best → Never → blank**. Okay is removed from
the model, the editors, the generator and the help.
- Why Okay is redundant: Best is already ranked and unlimited. "Can fill in at 2B" is *Best, ranked
  after the real spots* — and in Competitive the pick already goes to whoever ranks the spot
  highest, so a low-ranked Best behaves the way Okay does today. In Balanced they were already
  one pool.
- Why blank should mean "fine" rather than "last resort": today's blank is a fourth rating nobody
  can discover or use on purpose. Every position a coach has not marked is one they'd accept.

**P2 — The legend tells the truth.** Board legend: `Best (ranked) · Never` as swatches, then one
sentence: *"Blank = fine anywhere they're not Never."* The "Not set" swatch goes. Player-page legend
and tooltip rewritten to the same three lines.

**P3 — Mode labels say what they do with the ratings.** Auto-fill menu:
- *Competitive — Best spots first, in your rank order*
- *Balanced — anyone rated Best, rotated evenly*
- *Development — everyone rotates; only Never is honoured*
Help article corrected to match (no more "in the order you ranked them" for Balanced).

**P4 — A-squad explained on the grid.** Legend gains `★ A-squad — gold-medal starter, kept off the
bench in Competitive games`; the column header gets the same `HelpTooltip` the player page uses.

**P5 — Pitcher rank is a dropdown on the grid.** The cycling chip becomes a compact `<select>`
styled as the chip (— / Ace / #2 / #3 / #4 / #5), matching the phone accordion and the 2026-08-22
ruling. One tap to any rank; one tap to "not a pitcher".

**P6 — The cap gets its unit.** The input renders with a visible "IP" suffix and placeholder
"no cap"; `aria-label` unchanged ("Max innings per game for …").

**P7 — Re-ranking is discoverable.** Tip line becomes: *"Tap a cell to cycle · Best cells number
in the order you pick them · re-order on the player's page."* (The player link in the row already
goes there.)

**P8 — The board says what Auto-fill will do.** Foot note under the grid: *"Auto-fill never places
a player at a Never. Your Best ranks matter most in Competitive games; Balanced rotates anyone
rated Best; Development rotates everyone."*

### Generator under three states
`GeneratorPlayer` loses `canPlay`. `pickForPosition`: competitive → Best matches (rank, A-squad,
least-played) else least-played of the never-filtered pool; balanced → least-played among Best-rated
else the pool; development unchanged. `scoreLineup`: `canHit` term removed; an unrated placement
scores **0** (neutral) in every mode — Best keeps its positive reward, so preference still steers
the candidate pick, and "fine" no longer carries a penalty it never earned. Weights stay a tuning
call; **tests pin the ORDER of picks, never the weights.**

### The alternative (not recommended)
Keep four rungs and rename the third by consequence — *Best (ranked) · Backup · Never · blank
("no rating — used last")*. Copy-only, cheap. Rejected on the merits: a rung whose effect shows up
only in tournament games and is never surfaced afterwards cannot be used on purpose, and a rename
does not change that. If the owner wants a soft "avoid" rung, it should be an explicit state with
a name, not the blank.

## Owner forks to rule on (Decisions tab on the hub)

| # | Question | Recommendation |
|---|---|---|
| D1 | Collapse to three states (P1) — or keep four and rename the third? | **Collapse.** |
| D2 | Existing Okay data (prod: 9 cells, 4 players, 1 team): fold into the Best tail in the order the coach had them — or drop it? | **Fold.** Nobody loses a preference; the coach sees their fill-in spots as low-ranked Bests. |
| D3 | Seed the coach sandbox so its depth chart shows a Never and a Best 3+ (today: only Best 1/2 and two pitchers)? | **Yes** — cheap, and the board is otherwise an empty grid in the shop window. No dock/tour sentence needed unless the owner wants a moment. |
| D4 | Balanced ignores Best rank today (rotates evenly among rated players). Keep that and label it honestly (P3) — or make rank matter in Balanced? | **Keep.** "Rotate" is the point of Balanced; the label was the bug. |

## Phases

### Phase 0 — Mockup ratified (this hub)
Owner reads the hub's Mockup tab (whole-screen before/after on desktop and phone, the player-page
picker before/after, the Auto-fill menu before/after) and rules D1–D4 on the Decisions tab. **No
code before this.**

### Phase 1 — The model
- `lib/types.ts`: `LineupProfile` drops `canPlay`.
- `lib/lineup-profile.ts`: `normalizeLineupProfile` drops the canPlay bucket and **tolerates a
  stray `canPlay` key on read** (a row written by old code during the deploy window, or one the
  migration missed — ignore it, never throw); `buildLineupProfileWrite` ignores `canPlay` in the
  payload; `playerPositionPrefs` returns `{preferred, never}`.
- `lib/lineup-generator.ts`: as "Generator under three states" above.
- `app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts`: PATCH ignores `canPlay`.
- **Migration 290 (data-only)** — see below.
- `docs/agents/db/DATA_DICTIONARY.md` `lineup_profile` entry; `npm run refresh:snapshots`
  (shape change is app-enforced, so the snapshots won't move — the dictionary is the record).
- **Tests (new):** `tests/unit/lineup-profile.test.ts` (normalize/build/prefs round-trip; stray
  `canPlay` ignored; Never wins over Best), `tests/unit/lineup-generator-three-states.test.ts`
  (per mode: Best beats blank; blank beats nothing; Never never; Balanced ignores rank; A-squad
  tie-break in Competitive).

### Phase 2 — The surfaces
- `components/coaches/DepthChartBoard.tsx` + `.module.css`: P1 cycle, P2 legend, P4 header
  tooltip + legend line, P5 rank `<select>`, P6 cap suffix, P7 tip, P8 foot. Remove `.o` cell
  class and the `--okay-*` tokens (⚠ `--okay-fg` is also the colour of `.editlink` and
  `.capInput` — rename that use to a neutral link token before deleting; the warm remap block at
  the foot of the CSS lists every local token and must stay in sync).
- `components/coaches/PositionProfileEditor.tsx`: `PositionState` drops `'okay'`; `NEXT_STATE`
  becomes blank → best → never → blank; legend + `HelpTooltip` copy per P2/P8.
- Player page (`roster/[playerId]/page.tsx`): form shape `{best, never}`; payload drops canPlay.
- `_LineupEditor.tsx`: P3 mode option labels. Game page + editor: `GeneratorPlayer` build drops
  canPlay.
- Roster page comment at L61/L924 ("Okay/Never") — courtesy update.
- Phone accordion (inside DepthChartBoard) inherits P1/P2 through `PositionProfileEditor`.

### Phase 3 — Words and worlds
- Help (`lib/help-content/coaches.tsx`): the four articles listed above + `keywords`/`searchText`
  (`'best okay never'` → `'best never'`, add `'blank position'`, `'fine anywhere'`). Run `/docs`.
- `lib/release-notes.ts`: new entry ("The depth chart has three states…"). The 2026-07 entry that
  says "handles best, can fill in, or shouldn't play" is history — leave it.
- Demo: `lib/demo-coach.ts:midseasonPitcherProfile` + `scripts/seed-demo-coach.mjs` profile shape
  drops `canPlay`; per D3 seed one Never and one Best-3+ on the 12U roster (pick players the tour
  never names). `npm run check:demos` after; the prod re-seed rides the next release's owed re-seed
  (the coach demo re-seed is ALREADY owed from 09-10 — fold this in, don't add a second).
- `scripts/seed-uat-coach-fixture.mjs` / `seed-qa-day-fixtures.mjs`: write only `pitcher` today —
  no change; verify by reading, not assuming.
- Spelling gate: no new variant words (`check:spelling` runs in `verify:changed`).

### Phase 4 — Verify and hand off
- `npm run typecheck` (shared module + type change) then `npm run verify:changed`.
- `npm run check:layout -- --only=<roster depth view>` for the board at 641–768 and phone (the
  rank `<select>` and the cap suffix are the two new controls; 44px floor ≤768, rendered check).
- Owner QA walk (§173 or next free — never renumber) as a QA Walk tab on the hub: UAT coach on
  `uat-test-org` / UAT Test Team; steps pin identities (which cell shows which glyph after which
  taps; a Balanced lineup places a Best-3 player before an unrated one at that spot; a Never is
  never placed in any mode).
- `/simplify` then `/review` (the generator and normalizer changes are shared-module logic).

## Migration 290 — data-only: fold Okay into the Best tail (draft, for `/db` review before it is written)

```sql
-- 290_lineup_profile_three_states.sql
-- Depth chart / Positions picker collapse to Best (ranked) · Never · blank. Every "Okay" (canPlay)
-- position becomes a Best ranked AFTER the player's existing Bests, in the order the coach had
-- them; the canPlay key is then removed. Rows without canPlay are untouched.
with src as (
  select id,
         array_remove(array[primary_position, secondary_position], null)
         || coalesce(array(select jsonb_array_elements_text(lineup_profile->'morePreferred')), '{}'::text[])
         || coalesce(array(select jsonb_array_elements_text(lineup_profile->'canPlay')), '{}'::text[]) as best
  from rep_roster_players
  where jsonb_array_length(coalesce(lineup_profile->'canPlay', '[]'::jsonb)) > 0
)
update rep_roster_players r
set primary_position   = src.best[1],
    secondary_position = src.best[2],
    lineup_profile     = (r.lineup_profile - 'canPlay')
                         || jsonb_build_object('morePreferred', to_jsonb(src.best[3:]))
from src
where src.id = r.id;
-- Rows whose profile carries an EMPTY canPlay just lose the key.
update rep_roster_players
set lineup_profile = lineup_profile - 'canPlay'
where lineup_profile ? 'canPlay';
```

- `canPlay` is already stripped of any position that is also preferred (`normalizeLineupProfile`
  precedence), so the concatenation cannot duplicate. `/db` to confirm on the snapshot before it
  is written, and to confirm `text[]` slicing `best[3:]` yields `{}` (not NULL) when there are
  exactly two — `to_jsonb('{}'::text[])` must land as `[]`.
- ⚠ **Data-only → invisible to `check:migrations` and both drift gates.** Verification is the
  count query in "Data on the ground" re-run on each database: `with_okay` must read 0 and
  `with_best3plus` must have risen by the folded rows. Record the numbers in the release notes
  entry, not "applied".
- ⚠ **Order relative to the code deploy:** the read-side tolerance in Phase 1 means either order
  is safe; run the migration **after** the build is green on master (it adds no rule, so
  `check-schema-parity` does not force the other order).
- `MANUAL_PROD_STEPS.json`: register it as a data-only step with the verification query.

## What was built beyond the mockup round (2026-09-12)

- **B1 — rated-first fill order (generator).** Positions used to fill in the Sport Pack's listed
  order, so a coach's only rated shortstop could be spent on catcher (unrated, listed earlier)
  before SS was reached — "Best spots first" was only *usually* true (the 16-candidate scorer
  papered over it). Now: the mound first (a pitcher is never spent on a field slot), then every
  position somebody on the field rates Best, then the rest; Development keeps the plain order
  because it reads no ratings. Six lines in `generateLineup`; pinned by a unit test whose field
  list puts SS after four unrated positions. Flagged on the hub's Decisions tab (B1) so the owner
  can overrule.
- **Touch floor in the 641–768 band, fixed rather than re-baselined:** field cells 36 → 44px, the
  new rank dropdown and cap input 44px, Undo/Redo 40 → 44px. The A-squad column widened 64 → 80px
  so the header's "?" sits inside it. The one remaining board entry in the layout baseline is the
  shared HelpTooltip trigger (recorded with its reason; raised in the component, not per screen).
- **The demo health check gained three assertions** (a Never and a Best 3+ exist; no profile
  carries the retired key; no saved lineup places a player at one of their Nevers) and one
  pre-existing flaky assertion was made order-independent (the 13U "batting order reused 3+ times,
  all wins" check used `find` over an unordered select and passed or failed on row order).
- Help search keeps `okay position` / `not set` as **aliases** on the depth-chart article so a
  coach who remembers the old words still finds the answer; no customer-visible copy says either.
- The release-notes highlight rides the pending 2026-09-11 entry (the release flow dates it).
- ⚠ **Prod's Okay data moved during the day** (the one team carrying it was editing its depth chart
  between two read-only counts: 4 → 8 players with Okay cells). The fold is data-driven, so it
  covers whatever is there at apply time — verify by the count afterwards, never by this plan's
  numbers.

## `/simplify` + `/review` pass (2026-09-12)

**`/simplify` — 4 findings fixed, 1 skipped:**
- **Reuse** — the desktop grid and the phone/player-page picker had each hand-rolled their own
  copy of the Best→Never→blank cycle. Extracted one shared `positionStateOf`/`cyclePositionState`
  pair into `lib/lineup-profile.ts`; both editors now call it.
- **Efficiency** — the generator's new fill-order sort recomputed each position's priority inside
  the comparator (redundant work on every comparison) and built that logic even in Development
  mode, where it's discarded unused. Fixed to compute once and skip entirely when not needed.
- **Simplification** — the new pitcher-rank dropdown spelled out "Ace/#2/.../#5" a third time in a
  third format; now generated from the same branching the existing rank label uses. (The phone
  accordion's differently-formatted rank list — "1 — Ace"/"2"/"3"… — predates this project and was
  left alone; merging it would have been a design change, not a simplification.)
- **Altitude** — a comment claimed a legacy leftover from the retired fourth state was "ignored on
  read," but nothing enforced that: season rollover would have copied a stray key forward every
  year, forever, past any "deploy window." Added one sanitizer at the actual database read
  boundary (`dropLegacyLineupProfileKeys`) — which turned out to close both gaps at once, since
  rollover reads through that same shared mapper.
- **Skipped:** consolidating four small SVG icon-color variants of one dropdown chevron into a
  single reusable image — real duplication, but the fix carries more visual-regression risk (needs
  re-verifying every theme/state combination) than four tiny data-URIs justify.

**`/review` — high-risk tier (touches `lib/db.ts` and a migration), 5 lenses, 0 Critical/High
findings against this project's diff:**
- Security/multi-tenant: clean — auth chain untouched, every new helper is a pure in-memory
  transform, migration's platform-wide scope confirmed intentional (a per-team boundary would
  *under*-scope a global key-cleanup).
- Concurrency/state: clean — the board's autosave/undo/dirty-tracking invariants all hold through
  the refactor; the new dropdown goes through the same save path as every other control.
- Data/contract: no Critical/High. Two Low notes, one already an accepted/tested trade-off (a
  stale browser tab briefly PATCHes the retired field during a rolling deploy — silently dropped,
  never corrupted, per an existing test), one now fixed (below).
- Regression/blast-radius: clean — every caller of every changed symbol/signature was traced across
  the whole repo and found consistent; the new tests pin the fill-order change.
- Correctness/logic: two real findings, **both fixed**:
  1. The migration's fold assumed, but never verified, that a coach's old fill-in list can't
     overlap their existing top picks — true for every row the app's own picker ever wrote, but
     not a guarantee the migration itself enforced. Hardened the SQL to drop any overlapping
     position before folding, plus a `jsonb_typeof(...) = 'array'` guard so a stored JSON `null`
     (which `coalesce` alone does not catch) skips the row instead of aborting the migration.
     Verified with a synthetic 7-case test (no table touched) covering overlap-with-primary,
     overlap-with-Best-3+, `canPlay: null`, `morePreferred: null`, and zero-existing-Best — all
     seven produced the correct fold. Migration 291 is unaffected on dev (its two real rows already
     had zero overlap, confirmed at apply time) and not yet applied to prod.
  2. A pre-existing inline comment had the Never/Best precedence backwards (said preferred wins;
     the code — correctly — has Never win). Comment-only fix; the behavior was always right.
  - One correctness finding was real but **not this project's code** — a data-integrity gap in
    unrelated Development-lifecycle work that happened to share the same file. Flagged to that
    session directly; they fixed it within the hour (confirmed).

Full report: typecheck clean, focused lint clean (0 errors), the two new test files plus the
generator/season-analytics suites at 72/72, rendered layout sweep clean, both demo worlds
presentable — all re-verified after every fix above, not just at first pass.

## `/docs` pass (2026-09-12)

Verified — not assumed — every touched FAQ's rendered copy still matches the live UI it describes
(legend text, mode-picker labels, the A-squad tooltip) by grepping the actual current component
strings, not the plan's own description of them. Confirmed each FAQ's search-only `answerText`
mirror stays in sync with its rendered `answer`, that `okay position` / `not set` survive only as
search aliases (zero customer-visible "Okay" wording anywhere in `lib/help-content/`, checked
across every module, not just coaches), and that none of the touched FAQs cross the scannable-
format word threshold (`npm run measure:help` — the only two coaches-guide sections still over
the limit are pre-existing money topics, untouched by this project). One found-and-fixed nit: a
duplicated keyword in the Auto-fill FAQ's search list. No hub/anchor changes needed — no new guide
page, no renamed anchor. Help structural tests (`help-articles`, `help-subtopics`) 19/19, spelling
gate clean.

## Standing rulings this build honours
- One word everywhere a customer reads it (2026-08-24) — "Best", "Never", "blank"; no "Okay",
  "Not set", "Backup" surviving anywhere a coach reads, including `data-label`s, help keywords and
  the demo.
- Form selects are dropdowns (2026-08-22) — the pitcher rank on the grid.
- Every highlight is clickable (2026-09-11) — the A-squad explanation is a tooltip, not a `title`.
- 44px tap floor ≤768, rendered check — the new `<select>` and the cap input.
- A season is live until closed and a closed season is ONE PAGE — the depth chart is live-season-
  only; nothing here reaches the closed-season page.
- Help + demo swept in the same unit of work; the coach demo's money narration is NOT touched by
  this plan and stays owed separately.

## Out of scope
- Showing, after Auto-fill, which rung each placement came from (F03's full answer). The collapse
  removes the invisible rung; a per-cell "why" on the lineup grid is a lineup-builder feature and a
  separate mockup session.
- Drag-to-re-rank on the grid (F08 gets the tip; the arrows stay on the player page).
- Any change to bench fairness, min-play floor, innings caps or pitcher selection.
- Undo of the fold (D2) once applied — the migration is one-way by design; the owner rules on it
  before it runs.

## Verification plan + residual risk
- Typecheck + `verify:changed` + the two new unit test files + a rendered layout check of the
  board at three widths.
- Residual: the demo seed and the UAT fixture are the only rows with a profile written outside the
  app's normalizer; both are read-verified in Phase 3. A profile row written by a **rollover**
  copies the shape forward opaquely — after the fold it copies the new shape, and the read-side
  tolerance covers a pre-fold copy.
