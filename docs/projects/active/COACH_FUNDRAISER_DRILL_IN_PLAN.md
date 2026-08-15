# Coach Money — the fundraiser drill-in

**Status:** built on dev 2026-08-14 · owner QA owed (ledger §23) · **no migration**
**Binding mockup:** Claude Artifact "Fundraiser Drill-In" — https://claude.ai/code/artifact/8e699fa8-0e0e-46e0-84e9-2e564abe0490
**PM brief:** [COACH_FUNDRAISER_DRILL_IN_PM_BRIEF.md](COACH_FUNDRAISER_DRILL_IN_PM_BRIEF.md)

---

## 1. Why

Opening a fundraiser was the **last screen in Money reachable only by leaving the hub**. The
2026-08-13 legacy-routes sweep retired the seven standalone Money *list* pages into tabs and
explicitly carved this one out — "a single fundraiser has no tab of its own" — which was true, and
still left the portal with exactly one exception. The cost was visible (the tab row, the archive
chip and the Import door all left the screen together, one text link the whole way back) and it was
the thing the owner noticed.

Underneath it sat a second, quieter defect. The fundraisers **list** has served `?year=` since
Chunk F, so an archived Money hub correctly listed that season's drives. But the link into one
dropped the year, and the detail page had no season rail at all:

- the roster came from the **active** program year, so a 2025 drive was listed beside 2026's
  players — wrong data, presented confidently, on a screen that passed every existing read-only
  check;
- the fundraiser row itself was fetched by `id + team_id` with **no program-year filter**, so
  Settings and log/edit amount were live over a finished season;
- "Back to Fundraisers" dropped `?year=`, quietly ending the archive visit.

One structural change closes all four: living inside the tab means inheriting the hub's season.

## 2. What shipped

### 2.1 The drill-in

`?section=fundraisers&fundraiser=<id>` — a **sub-view of the Fundraisers tab**, not a page beside
it. The list is replaced (not shown alongside: the leaderboard is six columns and the list five,
so a split gives neither enough column). `← All fundraisers` restores the list; browser Back does
the same; the address stays shareable.

- `app/.../accounting/fundraisers/detail.tsx` — **new**, the view, moved out of the old page file
  and made season-aware.
- `app/.../accounting/fundraisers/panel.tsx` — branches to the detail on `?fundraiser=`; both list
  links go through `moneySectionHref(base, 'fundraisers', { fundraiser: id }, seasonQuery)`.
- `app/.../accounting/fundraisers/[fundraiserId]/page.tsx` — now a **permanent redirect** into the
  tab, carrying the id and any incoming query (`moneyLegacyFundraiserRedirectPage`, sibling of
  `moneyLegacyRedirectPage` in `lib/coach-money-legacy-redirect.tsx`).
- Hub `ONE_SHOT_KEYS` gained `fundraiser`, so the id cannot ride to another tab and silently
  reopen a drive the coach had left.
- The hub's season chip keeps `chipExtraQuery = section=fundraisers` **without** the id: a 2026
  fundraiser does not exist in 2025, so switching season lands on that season's list.

### 2.2 The nested header shape

`CoachPageHeader` gained `nested` — the same slots at `h2` with a 36px tile, no season chip and no
"?" (the hub's header one line up owns both). Three shapes now live in the one component
(standard / `embedded` / `nested`) rather than a fourth being hand-rolled in a panel, which is the
failure the component's own docblock records.

### 2.3 The season fix, at the data door

`lib/db.ts` gained `getRepFundraiser(fundraiserId, teamId, programYearId)` — **the program year is
a required argument**, which is the whole point. Every fundraiser route now uses it:

| Route | Season it resolves |
|---|---|
| `fundraisers/[fundraiserId]/entries` **GET** | the **read rail** (`?year=`) — added to `APPROVED_SEASON_AWARE_ROUTES` |
| `fundraisers/[fundraiserId]/entries` **POST** | ACTIVE only |
| `fundraisers/[fundraiserId]` **PATCH** (settings) | ACTIVE only |
| `fundraisers/[fundraiserId]/entries/[entryId]` **PATCH** | ACTIVE only, via a parent-fundraiser check |

A past season's fundraiser now **404s on every write verb**, and the read shows that season's own
roster with capabilities from that season's assignment row (governing rule 1).

### 2.4 Staleness the old page got for free

On a page, "Back to Fundraisers" was a full navigation and the list refetched on arrival. Inside
the hub the list panel is still mounted behind the detail, so the detail bumps the **money
revision** after any save and the list gained `moneyRevision` in its load deps
(`lib/coach-money-refresh.tsx` — the mechanism already built for the header's Import menu).

### 2.5 Guards

- `tests/unit/coach-season-write-guard.test.ts` — the entries GET is on the approved list, with the
  three archive questions answered in place.
- `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` — the fixture gained a **live-only
  player** and a **past-only fundraiser with an entry**, and a test that opens the archived drive
  and asserts the archived player IS listed and the live one is NOT. Every other assertion in that
  file stayed green through the original defect; only the names give it away.
- `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` — both fundraiser-detail URLs now address
  the hub.
- `scripts/layout-screens.mjs` — **new screen `coach-fundraiser`**; the drill-in was never swept
  while it was a page of its own, and `coach-fundraisers` (the list) would stay green through
  anything that happened one level in. `scripts/uat-fixture-context.mjs` resolves a `fundraiserId`
  for it, and throws when the fixture has none rather than sweeping the list twice.

## 3. Deliberately NOT built

**A per-player export from inside a fundraiser.** The mockup showed an `Export ▾` in the drill-in
toolbar; the owner ruled it out for now (2026-08-14). `lib/coach-money-exports.ts` carries a
standing note that the fundraiser list exports **totals only**, because a per-player breakdown
names children beside the money they raised — that is a decision, not a detail. The list's
totals-only export is untouched. Turning it on later is one column set plus one button.

## 4. Owner QA

Ledger §23. The route is: Money → Fundraisers → open a drive → check the tab row is still lit and
Dues is one click away; `← All fundraisers` and browser Back both return to the list; log an
amount, go back, and the list's totals have moved. Then switch to a completed season and repeat:
the drive lists **that** season's players, carries the `… · Complete` chip, and offers no Settings
and no log/edit control.

## 4b. `/simplify` — what it changed

Four cleanup lenses (reuse · simplification · efficiency · altitude), five findings applied:

1. **The list refetched itself while a drive was open.** The tab's early return decides what
   *renders*, not which effects run, so every amount logged inside a fundraiser also fetched a list
   nobody was looking at. Guarded on `openFundraiserId`; clearing it re-fires the load on the way
   back, which is when the fresh totals are actually wanted.
2. **A second sequential round trip on the primary action.** The parent-fundraiser season check in
   the entry PATCH was a separate query in front of "log an amount". Folded into the entry query as
   an `!inner` embedded filter (an idiom `lib/db.ts` already uses), so a past season's entry comes
   back as not-found in one hop.
3. **`CoachPageHeader`: two booleans → one `variant`.** `embedded` and `nested` were independent
   flags for a three-way choice, so `embedded + nested` compiled and silently rendered the embedded
   one, and `season`/`help` were silently inert under `nested`. Now `variant: 'standard' |
   'embedded' | 'nested'` — the docblock's "three shapes, enforced by construction" is true rather
   than asserted. Seven Money panels updated mechanically.
4. **The redirect factory stopped pretending to be general.** It took the two query-key names as
   arguments for a single caller, which bought nothing and cost the type check — a mistyped id key
   compiled and would have redirected to `?fundraiser=undefined`. Now
   `moneyLegacyFundraiserRedirectPage()` with the route's real params typed. Generalize when a
   second standalone record route retires.
5. **One money formatter, not two.** The drill-in and its sibling list defined the same three-line
   currency helper; the list imports it now.

**Skipped, with reasons:** scoping the hub-wide money-refresh signal into per-area revisions (it is
shared infrastructure four panels depend on — a worthwhile change, but its own diff, not a
ride-along in this one); and the repo-wide currency-formatter duplication across seven other Money
files, which predates this change.

## 4c. `/review` — high-risk funnel, what it found

Tier **high-risk** (shared modules, `components/coaches/**`, the shared portal stylesheet, coach
money **write** paths). Deterministic gate first, then four non-overlapping lenses
(correctness · security/tenancy · data/contract · regression blast-radius).

**The rendered gate found the most expensive one.** `check:layout` on the new `coach-fundraiser`
screen: at 361px the leaderboard's rank and action cells spilled 19–43px sideways out of a card
with no scroller. Cause is a **cascade collision of the shape this repo has been bitten by before**
— the two desktop sizing rules (`width: 1%`, `white-space: nowrap`) were written INLINE, and an
inline declaration outranks the `.tableAsCards td { width: auto }` rule that reflows the table into
cards, so both survived into a layout they cannot work in. Now `.tdShrink`, which stands down at
the breakpoint. **This defect pre-dates the drill-in** — it lived on the standalone page, which was
never in the sweep. Adding the screen is what found it.

Confirmed and fixed from the LLM lenses:

1. **The refresh signal only ran outwards** (correctness, Medium-High). The drill-in *bumped* the
   shared money revision after a save but never *listened* to it — and it is the screen actually on
   screen while the hub's `Import ▾` sits above it. An import that landed dues rows would have left
   a coach logging a rebate against a stale "Left to send" and a stale "Where it lands" preview,
   indefinitely, with nothing on screen to say so. It now listens, and a save is a bump alone (with
   the effect owning the reload) so a save still costs one fetch, not two.
2. **The view is keyed by fundraiser id** (correctness, Low). Browser history or a pasted URL can
   step from `?fundraiser=A` straight to `?fundraiser=B`; React would have reused the instance and
   left the inline log-amount row open holding A's typed amount against one of B's players.
3. **A query failure no longer reads as "not found"** (data/contract, Low). The entry lookup's new
   join resolves its relationship name at runtime, so a real outage would have been indistinguishable
   in the logs from the ordinary archived-season refusal. Logged and 500'd; the no-rows case still
   404s.

**Verified clean rather than assumed:** the embedded-filter join's relationship name and shape
(checked against BOTH the dev and prod schema dumps — a wrong name fails at runtime, on a write
path); org/team/year scoping on all four changed handlers; deny-before-disclose ordering, so a 404
can't be used to probe which ids exist; that the write handlers genuinely cannot address a past
season (rather than trusting the guard test's claim); every one of the ~43 `CoachPageHeader`
callers after the `variant` change; and that no link, test, script, seed, demo step or help article
still addresses the old fundraiser URL.

**Raised for the owner, NOT changed here:** player names are gated by money access alone, not by
the roster-privacy grant — so a coach with money-write but no roster PII sees children's names
beside amounts. Identical on Budget vs. Actual and pre-dating this change portal-wide; it is a
model question, not a defect in the drill-in.

**Five layout findings on screens this change does not touch** (Overview, Team hub, Schedule,
Insights) were traced to other sessions' uncommitted work and deliberately left rather than
adopted. ⚠ One of them is worth someone's attention on its own: the Schedule finding's baseline key
contains a **clock time** from the probe event's label, so it re-invalidates itself every time the
fixture re-anchors.

## 4d. `/docs` — what the guides gained

The sync turned up a **gap wider than the change**: the Money guide carries a sub-topic for nearly
every screen — budget, periods, dues, settlement, payables, month grid, tags, imports — and had
**none for Fundraisers**, a whole tab. Fundraising appeared only inside other answers (a budget
line's "expected fundraising", a credit landing on a bill), so a coach who wanted to *run* one had
nowhere to read about it.

- **New sub-topic `premium-money-fundraisers` — "Running a fundraiser"**: what a drive is, starting
  one (name · player rebate % · dates), the per-player leaderboard, `Log amount` and the "Where it
  lands" preview, the snapshotted rate (changing the % never revalues an entry already logged),
  closing a drive, and what a finished season's drive shows. It states the changed flow plainly —
  a drive **opens inside Money**, the tab bar stays, and `← All fundraisers` is the way back.
- **The archive answer now says the thing that was silently wrong.** "It goes all the way down"
  already promised a past season's fundraiser results were readable; it now adds that opening one
  lists the players who were on *that* season's roster. The promise was there before the product
  kept it.
- **Search metadata**: ~30 terms added to the section's `keywords` and the sub-topic's prose
  mirrored into `searchText`, because rendered content is not searched — "open a fundraiser",
  "where is the fundraiser page", "back to fundraisers", "log an amount", "player rebate percent",
  "close a fundraiser", "past season fundraiser" and the rest would otherwise return nothing.
- **A stale help pointer fixed**: the Fundraisers tab's "?" pointed at the **Budget** sub-topic —
  the nearest thing that existed when the screen was written, and wrong the whole time. There is a
  correct target now.

The drill-in itself carries no "?" by design: the hub's header one line above owns this screen's
help, and two doors to the same drawer a line apart is what the nested header shape exists to
prevent.

## 5. Follow-ups (not built)

- ⚠ **THE SAME HOLE SHAPE EXISTS ELSEWHERE — found by `/simplify`'s altitude lens, deliberately not
  fixed here.** `getRepFundraiser` closed the instance; the *class* is "a single-record lookup on a
  season-scoped table, defended by `id + team_id` and a comment saying the team check is enough".
  Verified against the live dev schema snapshot, the same shape sits on:
  `getRepTeamEvaluationSession` / `updateRepTeamEvaluationSession` / `deleteRepTeamEvaluationSession`
  (`rep_team_evaluation_sessions` — **has** `program_year_id`), `updateRepTeamLineupTemplate` /
  `deleteRepTeamLineupTemplate` (`rep_team_lineup_templates` — **has** `program_year_id`), and the
  practice-recap update on `rep_team_events`.

  **Their exposure is narrower than the fundraiser's was**, which is why this is a follow-up rather
  than part of this change: tryouts, the lineup-template library and practice plans are all
  ruled live-season-only INSTRUMENTS with **no archive door**, so nothing in the product hands a
  coach a past season's id — it would take a stale bookmark. The fundraiser had a door.

  It is still the same reasoning that failed, and nothing catches the next one: the write-guard test
  proves a write handler cannot *read* `?year=`, and says nothing about whether the record it
  touches belongs to the active year. Worth its own pass — a shared season-scoped lookup, or a guard
  that can see this shape — with its own review and QA rather than riding along in a Money diff.

- **A demo moment.** The coach sandbox seeds a Bottle Drive but no tour step or dock moment opens
  it — a prospect meets fundraising only through the Dues story ("covered by fundraising"). Worth a
  moment now that the screen sits inside the hub; it is a judgement call, not a defect.
- **The layout baseline** needs the `coach-fundraiser` screen's first sweep before `check:layout`
  is green on it (`npm run check:layout` against a dev server that nothing else is using).
