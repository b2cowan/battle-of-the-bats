# Coach Portal — Nav regroup, Attendance-as-report, and a front door for Practice Plans

**Status:** ALL FOUR PHASES BUILT on dev 2026-08-15 — Practice Plans hub, the Attendance page,
Attendance into Insights, and the sidebar regroup. Owner QA owed (ledger §28, §31, §32, §33).
**Owner-approved:** 2026-08-15, from mockups (artifact `ed56fe2c-0749-4c18-b504-3d3b3ee6c7c7`, rev 3).
**Origin:** owner review of the Attendance empty state → widened into the sidebar's information architecture.

---

## 1. What started this

The owner opened Attendance on a team with an empty schedule and found **three "nothing here"
blocks stacked on three different left edges**, plus a back link to Insights they hadn't come from.
Pulling that thread exposed a set of IA problems the empty state had only made visible.

### The empty-state defect (verified in code)

Three regions render independently, none aware the other two are also empty:

| Block | Width | Horizontal anchor |
| --- | --- | --- |
| `CoachEmptyState` ("Nothing to take attendance for yet") | 560px | centred in the 1200px column |
| Methodology `<p>` | 640px | left, but inset **2rem** by `.muted`'s inherited padding |
| `.emptyState` ("No attendance recorded yet") | full 1200px | centred |

The misalignment is `.muted { padding: 2rem }` colliding with an inline `margin` override that
does not reset it — an inherited-padding accident, not a layout decision. The duplication is two
empty states (same icon, near-identical message) answering the same question in two registers.

### The IA findings

1. **Attendance is never recorded on the Attendance page.** Marking a player present happens in the
   schedule page's event slide-over (`slideTab === 'attendance'`). The Attendance page's hero card is
   a shortcut *back* to it. What remains is a season rollup — a report — and it is already an
   Insights doorway tile (`history/page.tsx` links `${base}/attendance`).
2. **That is why the back link is wrong half the time.** Attendance has two parents (sidebar item +
   Insights tile); a static back link asserts one. Same double-parent shape exists on Money and
   Development.
3. **Practice plans have no front door at all.** Reachable only from the schedule event panel
   (`selectedEvent.eventType === 'practice'`) or a development session link. Meanwhile Lineups —
   used *less* often, since teams practise more than they play — has a nav item, a hub with
   upcoming/recent lists, a "Needs lineup" filter and a Templates tab.
4. **The "Explore" shelf makes the sidebar rearrange itself mid-season.** Conditional items
   (Tryouts, Tournaments) sit in their group only once `hasTryoutSignal` / `hasTournamentHistory`
   is true, otherwise they drop to a shelf labelled "Explore" — a word that also collides with a
   real product concept (browsing public tournaments to enter, `/discover`).

---

## 2. The ordering rule (new, and the thing that decides everything else)

The sidebar has never had a stated ordering principle. Groups today describe **what the data is
about** (Squad = people, Season = time). Coaches navigate by **what they are doing**.

> **Order groups by how often a coach opens them. Hot at the top, cold at the bottom.**
> Nothing is conditional. Six groups, fixed, always in the same place.

### Approved target

| Group | Items |
| --- | --- |
| *(ungrouped)* | Overview |
| **Season** *(label unchanged)* | Schedule, **Practice plans** *(new)*, Lineups *(moved)*, Tournaments *(now permanent)* |
| **Progress** *(new group)* | Development *(moved)*, Insights *(now holds Attendance)* |
| **Money** | Money |
| **Communication** | Chat, Email families |
| **Team** *(was "Squad", moved down)* | Roster, Tryouts *(now permanent, order unchanged)* |
| **Team admin** | Staff, Documents, Settings |

**Removed:** the Attendance nav item; the entire "Explore" shelf and its `conditional` mechanism.

### Owner rulings taken during review

- "Game day" rejected as the group label once practice plans joined it — practices are not game
  day. **"Season" is retained**, so the heading does not change at all; only its contents do.
- **Tryouts does not move** and does not become time-aware. It keeps its position relative to
  Roster, and the two travel down together.
- **The "Explore" shelf is deleted outright**, not renamed. Both surfaces already have empty states
  that teach what they are for — the job the shelf was doing badly.

### Open, deliberately not decided

Under a strict heat rule **Chat probably outranks Money** (daily vs monthly). Money is left above
Communication because it is the bigger product pillar. Flagged for the owner, not assumed.

---

## 3. Phases

### ✅ Phase 1 — A front door for Practice Plans *(BUILT on dev 2026-08-15)*

The highest value-per-effort item, and it stands alone — no dependency on the regroup.

**Needs no new API.** `RepTeamEvent.practicePlan` is already returned by the events read
(`lib/db.ts` maps `practice_plan` through `parsePracticePlan` on every event row), so plan-readiness
is computable client-side with zero extra requests. Templates already have
`/development/plan-templates`.

Mirrors the Lineups hub deliberately, so the two read as one pattern:

- **Practices tab** — upcoming (ascending) and recent (descending, capped at 6), the same date-tile
  row idiom, a readiness chip (`Plan set` / `No plan`), and a single earned lime action on the
  nearest upcoming practice without a plan.
- **"Needs a plan" filter** — same shape as "Needs lineup", including staying mounted at zero so
  planning the last practice can't unmount the control that turns the filter off.
- **Templates tab** — deep-linkable via `?tab=templates`. Reads the **same** plan-template library
  Development already uses. One library, two doors — not a copy.
- **Run practice** — a practice inside its live window offers `Run practice →` beside the row,
  matching how the schedule panel already routes.

**Gates.**
- View: `canViewSchedule` (same as the events read and the practice-plan read route).
- Write / "Plan this practice": `canWriteDevelopment` — head coach only, per the binding constraint
  already enforced on the practice-plan PUT.
- Templates tab: only rendered when `canManageSchedule`, because that is what the plan-templates GET
  requires. A coach without it sees the Practices tab alone, not a tab that 403s.

**⚠ Archive rule (CLAUDE.md, binding).** Practice plans are **not** archive-readable — the schedule
panel already hides the plan section behind `!page.isReadOnly`, and neither plan route is in
`APPROVED_SEASON_AWARE_ROUTES`. Therefore:
- The nav item goes in `TEAM_NAV_GROUPS`, which only renders for a live season — so it is
  archive-invisible automatically.
- It is **not** added to `CLOSED_TEAM_NAV_ITEMS` / `APPROVED_ARCHIVE_DOORS`.
- The hub itself still guards `page.isReadOnly` directly, because the season switcher can rewrite
  the current path with `?year=` while the coach is standing on it. A past season shows a quiet
  empty state, never a list of practices whose plans all deny.

**Unchanged by design:** the plan editor, the run-practice screen, the drill library, the templates
themselves, and the Schedule panel's own "Plan this practice" button. This adds a door; it closes
none.

### ✅ Phase 2 — Fix the Attendance page *(BUILT on dev 2026-08-15)*

Worth doing regardless of where the page ends up living, and it makes Phase 3 a clean lift rather
than a relocation of a mess.

- **One empty state, and when it renders it is the only thing on the page.** The second empty state
  and the floating methodology paragraph are deleted.
- **One left edge.** Every block shares the page column's edge and width; the centred card is the
  exception precisely because it is alone.
- **Methodology becomes a collapsed "How these figures are counted" disclosure under the table** —
  same words, out of the path between the coach and their data, absent when there is no data.
- **Column headings once**, replacing the per-row `GAMES` / `PRACTICES` micro-labels.
- **New "scheduled but nothing marked" state**: render the real table with the roster and dashes,
  under a one-line explanation. Proves the roster is connected and shows the shape that is coming.

#### How it was built

**The three regions became one decision.** The defect was not three misaligned blocks; it was three
regions each concluding independently that they had nothing to show. There is now a single
four-way branch at the top of the render — `solo` / `nothing marked yet` / `the report` / loading —
and the "alone" rule is structural rather than remembered: the solo branch renders the empty card
and returns, so nothing else *can* draw beside it.

**⚠ Both flags wait for BOTH fetches.** A schedule known to be empty while the report is still in
flight is not yet grounds for the empty state — attendance rows outlive the events that produced
them (a deleted game), so `scheduleIsEmpty` only wins when the report has also come back with
nothing recorded. This is the same class of mistake the page's existing `markTargetLoading` flag
was already written to prevent: a confident answer given before we had looked.

**⚠ The `.muted` fix went to a NEW page-local module, not to `coaches.module.css`.** The reported
misalignment *was* a shared class reaching a page that never asked for it. `.muted` has many other
callers, so the fix could not be made there; and `coaches.module.css` was carrying two other
sessions' in-flight edits, so adding to it could not be committed cleanly either. Everything this
page needs beyond the portal's existing primitives lives in
`app/[orgSlug]/coaches/teams/[teamId]/attendance/attendance.module.css`, blast radius one screen.

**The table is the portal's existing list-table idiom** (`.tableWrap / .table / .th / .td / .thNum /
.tdNum / .tableAsCards`), not a new one — which is also *why the micro-labels could go*. At ≤640 the
shared class stacks the table into cards and re-prints each figure's label from the cell's
`data-label`, so the per-row wording the column headings replace on a desktop comes back on a phone
automatically.

**⚠ A `<table>` cannot nest a row-level `<a>`, so the whole-row drill-in became a name link** with
`min-height: var(--tap-min)` and the cell's vertical padding surrendered to it. Measured at 44px
(and 501px wide on a desktop row) — the tap target is the row's height, not the word's. Without
that one declaration this change would have traded a misalignment for ~12 new tap-floor findings.

**⚠ The mockup's "How attendance works" button was NOT built (owner call, 2026-08-15).** §01's
proposed empty state carried a second, ghost button opening the help — reasonable on paper, since
this is the one state where the counting rules are not on the page. But the header's "?" sits on
that same screen, in its fixed corner, opening that exact drawer: a second door to it one line
below would be the duplication this phase exists to remove, wearing a politer face. Same rule
`CoachPageHeader` already states for its nested variant — two doors to the same place, one line
apart, is one door too many. **The empty state offers "Open schedule" alone.**

**Two things joined the change that the mockups did not cover, both by applying the approved rule
rather than inventing:**
- **"No active roster players" is now a solo empty state too.** It was a full-width centred block
  under a left-aligned shortcut card — the third left edge, in a different state. It renders
  `quiet` and carries **no** CTA, per `CoachEmptyState`'s own decision rule: a coach can hold the
  attendance duty *alone*, without roster access, and an "Add players" button that 403s is worse
  than no button.
- **The per-player drill-in now carries `?year=`.** `roster/[playerId]` is on
  `APPROVED_SEASON_AWARE_ROUTES`, but this link was not passing the season — so a past season's
  attendance row opened the ACTIVE season's player. That is governing rule 2 ("does the whole
  subtree carry the season?") failing one level down from an archive door, which is exactly where
  Chunk F's expensive defects lived.

#### Evidence (rendered, not read)

Measured on the served page — the only check that can see the thing that was actually reported:

- **One left edge, one width.** At 1440: shortcut card, table, and disclosure all at `left 252`,
  `width 1156`. At 390: all at `left 16`, `width 358`. The back link sits at 244 with 8px of its
  own padding, putting its *text* on 252 — optical alignment, not drift.
- **All four states rendered** (the two empty ones by stubbing the API responses, since the fixture
  team has data): solo empty card alone offering **only** "Open schedule", the header's "?" still
  in its corner and no table, disclosure or shortcut beside it; shortcut + note + dashed roster +
  disclosure; quiet solo card for the empty roster; and the full report with `not tracked yet`
  spanning both figure columns for the one untracked player.
- **The disclosure** is collapsed at load, its summary is exactly 44px, and it opens to the
  methodology verbatim — including the sentence under the playing-time vocabulary ruling.
- **The layout sweep is unchanged by this diff.** `--only=coach-attendance` returns the identical
  finding count at all four widths before and after (1 / 1 / 3 / 23).

**⚠ The sweep does report 2 NEW findings, and neither belongs to Phase 2** — both reproduce exactly
on the pre-change page: `a·Practice plans @1440` (Phase 1's new nav item, never baselined) and
`a·Insights @768`. They need Phase 1's baseline decision, not a fix here.

#### Unchanged, and deliberately so

The "Take attendance" shortcut card and its three-state loading behaviour, the season / read-only
handling, the loading skeletons (re-shaped to the table's geometry so the report still does not
jump as it settles), and the back link — which **Phase 3 deletes outright**, so no effort was spent
on it.

### ✅ Phase 3 — Move Attendance into Insights *(BUILT on dev 2026-08-15)*

- Retitle as a question to match its neighbours (**"Who's showing up?"**).
- Drop the sidebar item; the recording flow on the Schedule is untouched.
- The back link becomes *true* — one parent — so §2's problem retires rather than being patched.

#### ⚠⚠ THE BLOCKING OWNER DECISION WAS NEVER REAL — and this is the finding worth keeping

This plan and the mockup's §04 both recorded, as the one thing to decide before building:

> *"An assistant whose only duty is attendance would keep the ability to mark players present on
> the Schedule but lose the season report."*

**That was already false when it was written.** `hasRecordAccess` — the predicate the Insights nav
item gates on — is a UNION that **includes the attendance duty**, folded in by A1 (2026-08-03).
So `caps.attendance ⟹ hasRecordAccess`, which means the set of coaches who can open the attendance
report is a strict **subset** of those who can open Insights. Nobody loses anything; there was
nothing to rule on.

It is recorded loudly because the claim was plausible, written down in two places, survived an
owner review, and would have cost a decision the owner did not need to make. The invariant is now
**pinned by test** (`tests/unit/coach-attendance-home.test.ts`) rather than left to be re-reasoned:
if a future change narrows `hasRecordAccess`, or gives Insights its own tighter gate, the build
fails before a coach discovers the only door to their season attendance stopped existing.

#### ⚠⚠ THE ARCHIVE DOOR THE TIDY-UP WOULD HAVE DELETED

Removing Attendance from the live navs makes removing it from `CLOSED_TEAM_NAV_ITEMS` look like the
obvious matching change. **It is not, and doing it would have broken the archive.**

On a finished season the nav points **Insights at `/history/results`, not at the Insights hub** —
the hub is live-season-only (it holds no season resolver at all, and would answer a past year's
header with this year's numbers), and the results archive carries no attendance door. So the
archive nav entry is the **only** route to a past season's attendance report, which is an archive
door ruled in under D-F1 with a season-aware route behind it.

**Live nav: gone. Archive nav: kept, deliberately.** Both halves are pinned — the live half in
`team-tournament-game-mirror-smoke.spec.ts`, the archive half in `coach-frozen-season-smoke.spec.ts`
(the only fixture that has a finished season) and in the unit test above.

This is governing rule 2 read in reverse: an archive is a container, so the unit of work is every
page reachable from the door — including the ones a live-nav change quietly orphans.

#### What was built

- **The page is titled "Who's showing up?"**, and **the Insights door was reworded to match it
  exactly** (it read "Who shows up?"). A door and its destination disagreeing about their own name
  is the drift having one parent is supposed to prevent, so the two strings move together or not
  at all. The page now sits among seven sibling questions on the hub.
- **The item left both navs together** — sidebar and the bottom nav's More sheet. Changing one and
  not the other is how the two start telling different stories.
- **The `case 'Attendance'` capability gate stays** in `isCoachNavItemVisible`. It is no longer a
  nav question but is still the shared answer for three other callers: the archive nav, the
  Insights door, and the Overview's coaching-pair tile. Deleting it would fall through to
  `default: return true` and hand the report to a helper.
- **The back link is true, including in an archive.** On a live season it points at the Insights
  hub. On a finished one it points at `/history/results${year}` — mirroring what the archive nav
  itself does, so one label always leads to the page the coach was actually on.

#### Evidence

- Rendered at 1440 and 390: the sidebar and the More sheet no longer carry Attendance; the page
  heading reads **"Who's showing up?"**; the Insights hub lists it among its seven doors with the
  identical wording, pointing at `/attendance`.
- `npm test` — 1954 pass, 0 fail, including the six new invariant assertions. Typecheck clean.
- Layout sweep across `coach-attendance`, `coach-overview`, `coach-roster`: **no new finding
  belongs to this phase**, and `coach-attendance @1440` fell from 23 findings to 22 as the nav item
  left. (`a·Practice plans` is Phase 1's un-baselined item; `button·Season setup4/5` is the fixture
  label drifting from its baselined `3/5` key, which changes the key and reads as new.)
- ⚠ **The archived-season behaviour is NOT rendered-verified here** — the layout fixture has no
  finished season. It is covered by the unit test and the frozen-season spec, and is an explicit
  owner QA step.

#### ⚠⚠ What `/review` found afterwards (2026-08-15) — and the claim that was wrong

The adversarial review ran over all four phases. Permissions and the regroup came back clean —
nobody lost access (traced to the API), nothing was orphaned, no nav item lost its gate. **Every
real finding was in the archive path, plus one claim this plan made that was untrue.**

**1. "Attendance has ONE parent now" was FALSE when written.** The **Roster page header carried a
second "Attendance" button** straight to the report. So the back link was still wrong for anyone
who arrived that way — the exact defect Phase 3 existed to retire, surviving in a narrower form,
while three documents asserted it was gone. It was also the report's *original* door, from before
Attendance had a nav item, and it still had the wart Batch 4 recorded: it disappears in the
depth-chart view. **Owner call: removed.** Insights is now genuinely the only door, and the back
link is true for the first time.

⚠ The lesson generalises: **"it has one parent now" is a claim about the whole codebase, not about
the file you edited.** Removing a nav item does not make a page single-parented; only grepping
every link to it does.

**2. A finished season still offered to take attendance — on a button that dead-ended.** The
shortcut card rendered in an archive exactly as in a live season, and its link dropped the year, so
it landed on the LIVE schedule hunting for an event that is not in it. Nothing happened. That is an
instrument inside a record (governing rule 1) *and* the politer face of a 404 that CLAUDE.md's
"hide the entry point" rule exists to prevent. **Owner call: hidden.** In a finished season the page
now shows the report and nothing else; the no-schedule empty state loses its "Open schedule" CTA and
speaks in the past tense, and the "totals fill in as you mark" caption becomes "No attendance was
recorded for this season" — because nothing will fill in.

**3. The read-only back link's `?year=` was inert, and dressed an unsolved problem as solved.**
`/history/results` reads no year param at all: it decides what to show from whether the coach still
holds a LIVE assignment. For a coach still coaching the team, it answers with the **current**
season's results — and renders no season chip to say so. Appending a season query made the link
*look* like it carried the year. **The query is removed** (mirroring the archive nav exactly), and
the real defect is recorded as a follow-up below rather than decorated over.

**4. The page could paint a table and then take it away.** The first version guarded the empty-state
*decision* on both fetches but let the report branch paint real rows off the roster fetch alone — so
a team with players and an empty schedule, whose report landed first, drew the whole table and then
had it replaced by the lone empty card. Whichever fetch won the race decided what the coach saw.
The rule is now stated once and enforced: **a skeleton may render before we know; anything that
makes a claim may not.**

⚠ **The whole four-state decision moved into `lib/coach-attendance-view.ts` as a pure function**,
pinned by `tests/unit/coach-attendance-view.test.ts` — including a sweep of all 128 flag
combinations proving none produces a blank page, an empty state without a kind, or the caption
without a table. The review found the defect in logic that was *inline and commented*; the comment
had even asserted the property it did not hold. Executable beats eloquent.

**5. Help-guide copy missed by the earlier pass** — two passages still quoted the tile as "Who shows
up?", and one told coaches to reach the report via **Roster → Attendance**, which finding 1 has now
made false. All corrected.

Verified after the fixes: the race reproduced in a browser with the schedule lookup deliberately
delayed — paint sequence is `skeleton → empty card`, the table is never drawn first. Roster carries
no Attendance door. 1970 unit tests pass; typecheck clean.

#### Still open, unchanged by this phase

- The double-parent pattern still needs a decision for **Money** and **Development**
  (referrer-tagged back link vs no back link). Not blocking.
- ⚠ **`/history/results` is season-blind** — an approved archive door (`Insights`, in
  `APPROVED_ARCHIVE_DOORS`) whose page never reads `?year=` and shows a still-coaching coach the
  CURRENT season's results with no season chip. This is the Chunk F class exactly: correct at the
  door, leaky one level below it. Out of this project's blast radius, found by its review, and the
  single most valuable thing left on this rail.
- ✅ **DONE 2026-08-16** — `hasTournamentHistory`, the layout baseline and `pickNextOrMostRecent`,
  together with the lineup builder's timezone. See §6 below.

### ✅ Phase 4 — Reorder the sidebar *(BUILT on dev 2026-08-15)*

Groups only. **No item is renamed and no route moves**, so nothing touches permissions.

**⚠ Nav gates are keyed by item LABEL** (`isCoachNavItemVisible`) — renaming any item silently
breaks an assistant-coach gate. Group headings are free; item labels are not.

**⚠ Both navs move together.** `CoachesBottomNav`'s "More" sheet mirrors the same grouping and the
same `conditional` mechanism. Changing one and not the other leaves the two navs telling different
stories.

#### What was built

The approved target in §2, exactly — six fixed groups ordered by heat:
**Season → Progress → Money → Communication → Team → Team admin**, with Overview ungrouped above.
Lineups moved into Season (a lineup is built for a *game*, not a fact about the roster);
Development joined Insights in the new **Progress** group; Roster and Tryouts travelled down
together into **Team**, keeping their order. `Squad` → `Team` is a **heading** change, which is the
only kind this phase is allowed to make.

**The `conditional` mechanism is deleted outright, not just the shelf.** Tryouts and Tournaments
are permanent. Nothing in the sidebar relocates itself based on what the team has or hasn't done.

#### The two invariants are now pinned, not remembered

`tests/unit/coach-nav-groups.test.ts` asserts both risks this phase carried, against the component
source (these are module-level literals in client components; importing the `.tsx` would drag
next/navigation, lucide and a CSS module into the node runner for no gain):

1. **The item label set and order**, plus a check that **every label has its own `case`** — a
   helper (no duties at all) must see none of them. A renamed door falls through to
   `default: return true`, and this is what catches it.
2. **The two navs tell the same story** — the More sheet must equal the sidebar minus exactly the
   phone's four primary tabs (Overview, Schedule, Roster, Chat), and the group headings and their
   order must match. That one legal divergence is a consequence of the bottom bar, not a second
   opinion about grouping.
3. **No "Explore" heading and no `conditional`/`navSignals` survive in either file** — deleting it
   from one nav only would have kept the shelf alive on phones.

⚠ Two bugs in that test were caught while writing it, both worth knowing: the sidebar's *group
headings* use the same `label:` key as its items, so the naive regex reported headings as items and
the two navs "disagreed" about a difference that was entirely the test's; and a first cut asserted
the *word* `hasTournamentHistory` was absent, which failed on the comment explaining its absence.
Assert the read, not the mention.

#### Drift this change caused elsewhere, fixed in the same unit of work

- **The portal tour named a group that no longer exists.** Its first card's eyebrow read "Squad",
  and its body said roster, lineups and development "sit together" — which stopped being true the
  moment Lineups and Development moved out. Eyebrow → "Team", body rewritten around the sentence
  that survives (everything reads from the roster) and Tryouts' new neighbourhood. ⚠ The card's
  `needsAnyOf` is ITEM labels and is untouched — those are the gate keys.
- **The help guide described the deleted mechanism as a feature.** It told coaches that Tryouts and
  Tournaments "wait under a small **Explore** heading and move up into Squad and Season
  automatically" — the same class of drift as the guide's pre-Phase-1 claim that there was no
  separate practice-plans page. Rewritten to say the opposite, plus a corrected group glossary and
  six stale "Squad menu" / "under Squad" pointers.
- ⚠ **The free portal's "Explore" tab is a DIFFERENT, REAL product concept** (where a free coach
  turns the four optional tools on) and was deliberately left alone. This is the name collision §2
  flagged. The guide's existing line — *"On Premium, every tool is already in your sidebar — there's
  no Explore step"* — was slightly untrue before this phase and is now exactly right.

#### Evidence

- Rendered at 1440 and 390: both navs print the six groups in the approved order with the approved
  contents, no Explore heading anywhere, and no sideways scroll on the phone.
- Typecheck clean; **1977 tests pass, 0 fail**.
- Layout sweep across `coach-overview`, `coach-roster`, `coach-schedule`: **no finding belongs to
  this phase.** The seven reported are Phase 1's un-baselined `a·Practice plans`, and two fixture
  labels that drifted from their baselined keys (`Season setup4/5` vs `3/5`, and the probe practice
  whose timestamp is re-anchored to "now" on every run — the baseline key embeds the label text).

#### Known, deliberately not done

✅ **DONE 2026-08-16.** `hasTournamentHistory` on the coaching-assignment row had **no reader** — the
shelf was its only consumer — and was left computed-but-unused because `lib/db.ts` was carrying
another session's in-flight work. Removed in §6. (`hasTryoutSignal` stays either way:
`StartNextSeasonModal` still uses it.)

---

## 4. Risks and things a later change could undo silently

1. **Practice plans must never become archive-reachable by accident.** If the hub is ever added to
   the archive door list, the season-read rail has to land on both plan routes in the same change —
   the build-enforced allow-lists in `tests/unit/coach-season-write-guard.test.ts` are the decision
   point, and they fail the build until edited.
2. **The Templates tab reads Development's library.** If a future change gives practice plans their
   own template store, the two doors start disagreeing about what a template is.
3. **Deleting the `conditional` mechanism affects both navs.** Leaving the bottom nav's copy behind
   would keep the shelf alive on phones only.
4. **The `.muted` 2rem padding is used elsewhere.** Phase 2 must fix the Attendance page's usage,
   not the shared class, or it will move text on every other page that uses it.

### Found during review, fixed in Phase 1

- **Stale responses could land on the wrong team or season.** Neither hub cancelled an in-flight
  request when the team segment or `?year=` changed, and neither page unmounts on those
  transitions. On **Lineups this was reachable today with no URL editing** — "Lineups" is an
  archive door, so the season switcher keeps the path and only appends `?year=`; a slow live-season
  response arriving after the switch repainted the games list and readiness chips under a past
  year's header. Both hubs now carry the same `isStale()` guard the Attendance page already had.
- **Lineups formatted event dates in the READER's timezone**, not the org's — the exact bare
  `toLocaleDateString` call `lib/timezone.ts` exists to replace, on a page already in production.
  Fixed in three places (row tile, "when" line, apply-template picker).
- **"Plan set" could mean a plan with no blocks.** The builder autosaves once a goal or an
  equipment note exists, so a coach who typed a goal and walked away left a blockless plan; the hub
  called that "Plan set · 0 blocks" and dropped the practice out of the "Needs a plan" filter that
  exists to catch it. Readiness now means *has at least one block*.

### Known, not fixed (deliberate)

- ✅ **DONE 2026-08-16** — **`lineups/[eventId]` (the lineup BUILDER, a different page) formatted in
  the reader's timezone.** It was the one stale sibling beside the hub Phase 1 fixed. See §6.
- **Both hubs snapshot the clock once at mount**, so a "Run practice" / "Game day" button cannot
  appear or disappear on a tab left open for hours. Pre-existing accepted pattern shared with
  Lineups (only the Overview refreshes its clock); copied, not worsened.

---

## 5. Verification

- `npm run verify:changed` on each phase.
- `npm run typecheck` for Phase 4 (shared nav modules).
- Rendered layout check on the new hub (empty, populated, and read-only-season states).
- Demo sandboxes: the coach sandbox (`riverdale-ridge`) has practices — confirm the new door is
  reachable there and that no tour step or moments-dock line now points at a screen that moved.

### ✅ RESOLVED — the demo decision the new hub changed (owner approved option 1, 2026-08-15)

The coach demo seeds practice plans on **past practices only**, deliberately: the comment in the
seed says a plan on an upcoming practice would give the Overview a second thing to be asked about,
and that team's whole beat is Saturday's unset lineup.

That reasoning was sound when a plan was invisible unless you opened the practice. **It isn't any
more.** A prospect who clicks the new **Practice plans** door now lands on "Coming up" with every
practice marked **No plan** and a **Needs a plan · 3** chip at the top — the shop window's most
prominent read on that page is that the coach is behind. The plans that exist sit below, under
"Recent practices".

**Owner ruling: seed one upcoming practice with a plan.** Done in the demo world module — a third
12U plan on **this week's Thursday**, written as a rotation (three stations, three groups moving
every fifteen), because a rotation is the part of a practice plan a shared document genuinely
cannot do, so the demo's one upcoming plan is the one worth opening. The Overview's beat is
untouched, for the reason the old note already established.

Two things that follow, both recorded so they are not rediscovered:
- **The 12U has no practices beyond this week.** Thursday is ahead Sunday→Wednesday and behind
  Thursday→Saturday, so late in the week the hub's "Coming up" is legitimately empty and this plan
  reads as a recent one. It is written as a plan for the NEXT game rather than a report on a past
  one, so it reads correctly in both positions. Giving the demo a genuinely always-populated
  "Coming up" means seeding next week's practice pair — a change to re-anchor machinery with
  documented breakage history, deliberately not bundled here.
- **The seed's own console summary said "N past practices written up"** — a sentence that stopped
  being true the moment this landed. Corrected in the same change; it is the same class of drift
  as the help guide's "there's no separate practice-plans page".

⚠ **The demo database still has to be re-seeded for this to appear** (`scripts/seed-demo-coach.mjs`
owns plan creation; the nightly reconcile never creates one). Not run here: it is a full re-seed of
a shared dev world while other sessions have in-flight work, and the coach sandbox is currently
failing its own check for unrelated reasons (a missing sponsor row from the sponsorships project).
Both wants the same re-seed — worth doing once, together, when that work settles.

---

## 6. The follow-up debt, cleared *(2026-08-16, on dev)*

The four items §3 and §4 left behind — the "debt with no design content" list in
`COACH_ARCHIVE_RAIL_AND_FOLLOWUPS_PROMPT.md` §D. No feature changed; nothing here needs a mockup.

**1. The lineup BUILDER now prints the field's clock, not the reader's.** Phase 1 fixed the Lineups
*hub* in three places and left its sibling — `lineups/[eventId]` — on the bare `toLocaleDateString`
/ `toLocaleTimeString` pair. Both now go through `formatInOrgZone`, with the same options, so the
two screens agree. ⚠ **This string is not only on screen:** it is the `dateLabel` stamped onto the
printed lineup poster and the batting-order card, so a coach in another province was printing the
wrong start time onto paper handed out at the field. Verified against
`memory/reference_stored_date_formatting.md` first: `startsAt` is a stored instant, never a `date`
column, so `formatInOrgZone` is the right one of the two formatters — and the date-correctness
ratchet still reports **0 grandfathered sites** across 1540 files.

**2. `hasTournamentHistory` is gone, and it took three queries with it.** The signal had no reader
after Phase 4 deleted the "Explore" shelf, and it was not free: a `team_workspaces` lookup, an
admin-link lookup, and — waiting on the first of those — a `basic_coach_team_registrations` lookup,
on **every** coaching-assignment load. What remains is one batched `rep_tryouts` read, so
`getCoachingNavSignals` (which answered two questions) became `getCoachingTryoutSignals` (which
answers the one that still has a reader: `StartNextSeasonModal`). It now runs **concurrently with**
the money badges instead of after them, since neither depends on the other.

⚠ **The knowledge did not go with it.** `getMergedTournamentHistoryForRepTeam` already answers "has
this rep team ever registered for a tournament" properly, across both bridges — it is now the only
place that reads them together, which is recorded in its own comment so a future third bridge is
added in one place rather than two.

**3. `pickNextOrMostRecent` compares instants.** It sorted `startsAt` with `localeCompare` while its
sibling in the same file carried a comment explaining why that is wrong — lexicographic order agrees
with chronological order only while every row is serialised identically, "a property of the
serializer, not of this list". One row with a `-04:00` offset instead of `Z` is enough to point the
coach at the wrong game to take attendance for. Pinned by a test that fails on the old code, in both
the upcoming and the past-only branch.

**4. The layout baseline — and two things the follow-up list got wrong.**

- The 38 stale `a·Attendance` entries are gone. ⚠ **But `check:layout:prune` wanted to remove 130**,
  not 38. The extra ~92 stop reproducing for reasons that are not fixes: fixture labels that drift
  between runs (`Season setup3/5`, the probe practice whose timestamp re-anchors to "now" and whose
  text is part of the baseline KEY), the help guide's article list changing shape, and — the reason
  this matters — **screens currently carrying another session's uncommitted money/sponsorship work.**
  Pruning those would ratchet the baseline down onto working-tree state that is not committed, so
  the run's write was replaced with a surgical removal of the `a·Attendance` keys alone. **Take the
  tool's stale list as a proposal, not a verdict, while the tree is shared.**
- ⚠ **"Informational only — the check still passes" was FALSE.** The coach sweep **fails**, with 141
  new findings. **34 of them are Phase 1's own `a·Practice plans`** — the nav item this project
  added, never baselined, reported on every coach screen at 1440. That is the other half of the
  same nav change as the Attendance entries, so 32 were baselined here (identical 39px grandfathered
  portal chrome — no new decision recorded). The 2 skipped sit on `coach-sponsor` /
  `coach-sponsors-list`, screens that have no committed coverage to copy a reason from.
- ⚠ **And the way those 32 got their reasons was itself a defect, caught by this project's own
  `/review` — see §6a.**
- **The remaining ~107 findings are not this project's** — they are the sponsorship session's
  in-flight screens (`a·Northside Physio`, the sponsors-list toolbar) plus the fixture-label drift
  above. The coach group does not go green until that work lands and is baselined by its own owner.

**Verification.** Typecheck clean; **1973 unit tests pass, 0 fail** (one new). Lint clean on every
touched file (only lib/db.ts's pre-existing `any` warnings). Date-correctness ratchet at zero.
Rendered layout check re-run over six coach screens after the baseline edit: **no new findings, no
stale entries.** ⚠ `lib/db.ts` is a shared module — the dev server needs a restart before browser
testing.

## 6a. What `/review` found afterwards *(2026-08-16)*

Four lenses over §6 — blast radius, timezone correctness, sort/signal semantics, baseline integrity.
The three behaviour changes came back **clean**: zero readers of the removed signal anywhere
(components, routes, client state, caches, storage, tests, seeds), the assignment record built in
exactly one place and consumed by type, the stored value confirmed an instant so the chosen
formatter is the right one of the two, no reader-clock code left on the builder, the print path not
re-parsing the string, and the new sort test hand-traced as genuinely failing against the old
comparator in **both** branches. Four findings were raised and refuted (the dropped `hour12` is a
no-op in en-CA — verified by running it, and the time format now matches the hub byte for byte; the
empty-string return, the NaN comparator and the `Promise.all` error path are all unreachable behind
a `NOT NULL` column and error-swallowing callees).

**1. ⚠ 26 of the 32 new baseline entries were written with NO reason — and this plan said otherwise.**
They were generated by copying the reason from a sibling nav link on the same screen at the same
width. On 26 of those screens **the sibling had no reason either**, so the copy faithfully copied
nothing. The entry still suppresses the finding (presence is what suppresses), but the file's one
job is keeping unexplained suppressions *visible*, and the headline number hid it: unexplained went
**1540 → 1534**, reading as an improvement, because the 32 removed `a·Attendance` entries were
mostly unreasoned too. **More new unexplained debt was added (26) than was closed by reasoning (6).**
All 26 now carry a written reason (unexplained: **1534 → 1508**).

⚠ The transferable bit: **"copy the reason from next door" is only as good as next door.** A
generator that inherits a field without asserting the field exists will happily propagate a hole,
and the aggregate counter can move the *right* way while the thing it counts gets worse.

**2. The season-rollover dialog could ask the wrong season whether a tryout is unfinished.**
`StartNextSeasonModal` gated its "your tryout isn't finished" warning on
`assignments.find(a => a.teamId === teamId)` — team only, no season. A team can legitimately hold a
draft **and** an active year at once, and the assignments query has no `ORDER BY`, so that `find`
returns whichever row the database handed back first; the draft row winning meant no warning on a
live season with candidates still awaiting an outcome.

⚠ **Both review lenses called this a regression caused by §6, and both were wrong** — the
pre-image settles it: the old signal map was keyed by `teamId` alone, so the *last* row processed
overwrote the first and both rows carried one aliased value. The wrong answer was reachable before;
it arrived via "last row wins" instead of "first row wins". §6 made the two values **capable of
differing**, which exposed a pre-existing ambiguity rather than creating one. Recorded because the
plausible story ("your change made this worse") survived two independent agents and only the git
pre-image refuted it.

**The fix is not a new prop.** `tryout-overview` resolves the team's **active** program year
(`getActiveRepProgramYear`) and answers about that tryout regardless of which season is being rolled
over — so the gate now asks the **active** assignment's signal, falling back to any assignment on the
team. One edit, all three entry points (team hub, season-end, settings) corrected, no call site
touched. Impact either way is a missing heads-up, never data: rollover carries no tryout data at all.

**3. Two dead baseline entries, not from this work.** Two entries name screen widths the sweep never
uses, so they can never match — and `--prune` only considers real widths, so they can never be
cleaned up either. They arrived in the block another session had staged before this pass and rode
into the same commit; one also carries a copied reason stating a false history for its screen. Left
for that session rather than rewritten here.

**Verification after the fixes:** typecheck clean, **1973 tests pass**, lint clean, demo sandboxes
green, and the baseline diff re-checked by set arithmetic — 26 entries changed, all of them
`a·Practice plans`, every `detail` preserved, nothing added or removed. ⚠ Another session added
three payment-request entries to the same file in the meantime; they are preserved untouched.

## 6b. The two open rulings, taken *(owner, 2026-08-16)*

### Chat stays below Money — DECIDED, no change

Under §2's strict heat rule Chat probably outranks Money. **Owner ruling: leave the order alone.**
The reasoning is the part worth keeping: **Chat is mainly used on a phone**, and on a phone Chat is
already one of the four primary bottom-bar tabs — so the heat rule is *already satisfied where that
heat actually is*. Promoting it in the desktop sidebar would optimise the surface it is least used on.
Revisit only if coaches say otherwise.

### The double-parent back link — dropped, and the finding was wrong about which pages

**Owner ruling: drop the back links rather than referrer-tagging them; leave the sidebar as is.**

⚠ **But "Money and Development have the double-parent shape" was FALSE**, and the grep the handoff
demanded is what proved it. **Neither hub carries a back link at all** — Money's sub-pages point back
to the Money hub, which is genuinely their parent, and Development's do the same. There was nothing
to fix on either.

**The real double-parent pages are the Insights reports**, and one is worse than the finding described:

| Report | Ways in | Back link said | Action |
| --- | --- | --- | --- |
| Where is playing time going? | **FOUR** — Insights hub, the game console, an Overview tile, the team page's "Season insights →" | "Insights" | **Removed** |
| Is development covered? | TWO — Insights hub, Development hub | "Insights" | **Removed** |
| How are we doing? (results) | THREE — Insights hub, Season's End, the Attendance back link | conditional | **Left alone** — its back link is doing archive work, and `COACH_ARCHIVE_RAIL_PLAN.md` is about to redesign that page's season behaviour |
| Who did we award? · Who did we play? | ONE each | "Insights" | **Kept** — single-parent, so the link is true |

The rule applied is the one Phase 3 established for Attendance: **a back link is shown only where it
is true.** Both hubs are one tap away in the sidebar for everyone else.

⚠ The transferable bit, again: **the door count is a property of the codebase, not of the file you are
reading.** Two documents named Money and Development; four links pointed at a page neither of them
mentioned.

## 7. Links

- Mockups: `https://claude.ai/code/artifact/ed56fe2c-0749-4c18-b504-3d3b3ee6c7c7`
- PM brief: `COACH_NAV_AND_PRACTICE_PLANS_PM_BRIEF.md`

---

## 8. Phase 5 (PROPOSED, not approved) — five headings instead of six

**Status: awaiting owner decision.** Mockup: `https://claude.ai/code/artifact/93e1e3ef-0382-408b-ad45-1499e1b02580`

### The question that was asked

> "What are your thoughts on the number of nav categories? I was thinking of keeping Season as is
> but move Roster and Tryouts into the group with Development and Insights and rename that group to
> Team or Squad."

### Why that specific merge was argued against

Three reasons, in order of weight:

1. **It breaks §2's ordering rule.** Roster and Tryouts sit low because Roster is a September job and
   Tryouts is an August job. Development/Insights are a quiet-evening read. Merging them forces one
   position on four items of very different heat: place the group where Progress sits and **Tryouts
   is promoted above Money and Chat**, and the top half of the nav stops being "what I touch this
   week". Place it low and Insights — the door into Season Wrapped and the compare list — is demoted.
2. **The heading cannot hold.** "Team"/"Squad" over Development + Insights + Roster + Tryouts means
   *the people on the team, plus how the team is performing, plus people who are not on the team
   yet*. A heading broad enough for that also admits Staff, Settings, Money and Chat — and a heading
   that excludes nothing does not help anyone find anything. This is precisely the failure §2
   diagnosed ("groups described what the DATA WAS ABOUT"). "Squad" was additionally retired in
   Phase 4 because it stopped meaning "the playing side of things" once Lineups left; putting
   Insights under it re-breaks the same word.
3. **It leaves the live naming collision alone.** "Team" and "Team admin" are adjacent today and
   sound like the same thing — a coach hunting Staff has to guess. The upward merge keeps both
   headings and separates them by three groups.

### What the instinct was correctly detecting

- **Headings over one or two rows.** Money is a heading over a single item that already says Money;
  Progress is two; Team is two.
- **Worse on the phone.** With Overview/Schedule/Roster/Chat lifted out as primary tabs, the More
  sheet has **three headings over one row each** (Money, Communication, Team).
- **The sidebar overflows.** 15 rows + 6 headings + the team switcher + Help + the admin door does
  not fit a laptop viewport (Tryouts clipped in the owner's screenshot). See "not fixed" below.

### Option A — RECOMMENDED: fold `Team` into `Team admin`

> Season · Progress · Money · Communication · **Team** *(Roster, Tryouts, Staff, Documents, Settings)*

Same outcome the owner was after (one fewer heading; Roster and Tryouts no longer a lonely pair),
without any of the three costs:

- **Heat ordering untouched** — the two groups being merged are already the two coldest and already
  adjacent. Nothing is promoted or demoted; no item a coach has learned the position of moves.
- **The collision disappears** — one heading, and all five rows honestly read "set the team up":
  who's on it, who's trying out for it, who staffs it, its paperwork, its settings.
- **Progress keeps its meaning** — the "how are we doing" pair stays a distinct mode.
- **Phone improves more than desktop** — lonely headings drop 3 → 2.

Cost: five rows is the longest group in the nav, and the coldest region gets denser. Judged the right
place to spend density — the bottom is scanned deliberately, the top is glanced at.

### Option B — held in reserve: fold `Progress` up into `Season`

> Season *(Schedule, Practice plans, Lineups, Tournaments, Development, Insights)* · Money ·
> Communication · Team

Gets to four headings. Nothing moves on screen — a divider is deleted. Deliberately **not**
recommended first: six rows under one heading is where a group starts being read rather than seen,
and this is reversible/decidable after living with Option A.

### Explicitly NOT fixed by any option — the overflow

Removing a heading buys back roughly one row of height. **The clipping is a separate question** and
should not be used to justify a grouping change. The three candidate answers, none chosen:

- collapse the coldest group by default (setup tools one click away rather than always-on);
- pin the team switcher and the Help/Admin doors so only the item list scrolls;
- accept that 17 doors is the honest count and the list is meant to scroll.

⚠ Collapsing has a known side effect recorded elsewhere on this rail: **a collapsed group blinds
`check:layout`** — its rows are not rendered, so they stop being measured.

### Build notes if approved

- **Both navs move together**, as in Phase 4 — `CoachesSidebar` and `CoachesBottomNav`'s More sheet.
- `tests/unit/coach-nav-groups.test.ts` pins the group heading list and order in **both** files;
  its `sidebarGroups` / `bottomGroups` assertions are the decision point and must be edited
  deliberately.
- ⚠ **No ITEM label changes in either option.** `isCoachNavItemVisible` is keyed by display label
  with `default: return true`; renaming Roster or Tryouts hands an ungranted assistant the door.
  **Group headings are free; item labels are not.** Moving an item between groups is safe — the gate
  is per-label, not per-group.
- The portal tour and `lib/help-content/coaches.tsx` name the sidebar groups. Phase 4 already had to
  correct a tour card naming a group that no longer existed ("Squad") — re-check both in the same
  unit of work.
- Layout sweep: the affected screens are shared portal chrome, so expect the finding count to be
  unchanged; a group merge changes no left edge or width.

### Phase 5b — collapsible groups *(owner-added 2026-08-18; grouping half APPROVED same day)*

**Owner decision recorded:** Option A (fold `Team` into `Team admin`) is **approved**. Option B stays
in reserve. Added to scope: the groups become **collapsible, mirroring `AdminSidebar`'s tournament
groups** — do not invent a second mechanism.

⚠ **Corrected count** — an earlier revision of §8 said 17 rows. The sidebar renders **15** item rows
under 6 headings (the landing slot is ONE row — Overview *or* Season's End, never both), and the
phone More sheet renders **11** (15 minus the 4 phone primaries). Every height argument below uses
the corrected figures.

#### The four behaviours to inherit verbatim

`AdminSidebar` + `components/admin/admin-nav-config.ts` already hold all of this:

1. Heading is a `<button>` with a rotating `ChevronRight`, not a `<p>` label.
2. Open set persisted to `localStorage` (admin's key is `fl_nav_groups` — **the coach portal needs
   its own key**; one shared key would let a tournament admin's Setup preference decide whether a
   coach's Team group is open).
3. ⚠ **`isGroupOpen` returns true when the group contains the active path, regardless of stored
   state.** This is the rule that stops a coach hiding their own location; it is not optional.
4. Defaults keyed off phase (`defaultOpenFor: ['draft'|'active'|'completed']`). Coach equivalent
   would be season state — **deliberately NOT taken**, see below.

#### Recommended defaults — the heat rule decides, not taste

| Group | Rows | Starts | Reason |
| --- | --- | --- | --- |
| Season | 4 | open | The reason the portal is open at all. |
| Progress | 2 | open | Two rows; closing saves nothing. |
| Money | 1 | open | Closing a one-row group trades a row for a click. |
| Communication | 2 | open | **Holds the Chat unread badge** — see the defect below. |
| Team | 5 | **closed** | Longest and coldest; five rows for one click a season. |

**Rule stated once:** a group opened weekly or more never starts closed. One closed group is the
honest answer — `Team` is the only one where the trade is favourable. All five stay *collapsible*;
what the default decides is who pays the click.

**15 visible rows → 10.** That, not the grouping change, is what fixes the overflow. The fold-down
alone was worth ~1 row.

#### ⚠⚠ The Chat unread badge is inside a now-closable group

`CoachesSidebar.tsx:185` renders `<ChatUnreadBadge>` on the **Chat** item, which lives in
**Communication**. A coach who closes that group stops seeing that anyone messaged them, from a
sidebar that gives no other signal — nothing errors, the signal just disappears. This is the one
place the coach portal **must go beyond** the admin pattern, because admin's collapsible groups carry
no badges.

**Answer in the mockup:** a closed heading carries a **rolled-up badge** when anything inside needs
attention, and a plain folded-row count otherwise (so a closed group never reads as an empty one).

#### Deliberately NOT built: season-state-varying defaults

The obvious parallel to admin's `defaultOpenFor` is "open Team during tryout season". Rejected for
now: **Phase 4 deleted the `conditional` mechanism precisely because a sidebar that rearranges itself
moves items a coach has already learned the position of.** Auto-opening is a gentler form of the same
thing. Ship the fixed default; a coach's own persisted preference already covers the August case.

#### Two smaller calls

- **Phone: no collapsing.** The More sheet is opened *in order to find something*; folding its
  contents away works against the moment. Grouping stays identical between the two navs — only
  presentation differs, the same allowed divergence class as the four primary tabs. ⚠ The
  `coach-nav-groups.test.ts` heading/order assertions still apply unchanged.
- **Pin the team switcher + Help/Admin doors** so only the item list scrolls. Small, and makes any
  future group growth free.

#### ⚠⚠ New verification hazard — a closed group is an unmeasured group

`check:layout` measures what is **rendered**. A group that starts closed removes 5 doors from every
coach screen in the sweep. Either the sweep opens all groups before measuring, or those five items
silently leave the safety net. **This is the known failure mode already recorded on this rail
("collapsing BLINDS check:layout") and it must be handled in the same unit of work, not after.**

#### Still true from §8

⚠ No ITEM label changes in either half. `isCoachNavItemVisible` is keyed by display label with
`default: return true`. Group headings are free; item labels are not. A group with no visible items
must drop out entirely rather than render a heading a coach can open onto nothing — `AdminSidebar`
already does this (`.filter(group => group.items.length > 0)`).

### Phase 5c — the phone bottom bar, evaluated *(owner-asked 2026-08-18)*

**Outcome: the four tabs are KEPT. What the bar gains is a stated rule.** Two findings leave this
plan for other owners — see the bottom of this section.

#### The bar had a decision but no principle

`TEAM_TABS` carries "owner-picked 2026-06-29" and nothing else. The sidebar got its ordering rule in
August; the bar never got its counterpart, which is why "should Roster be a primary tab?" reads as an
open question when it isn't one.

> **Proposed rule:** the bar holds LOOK-UP surfaces, not work surfaces. A phone gets opened for
> ninety seconds to check one thing — so no two tabs may answer the same question.

#### ⚠ The heat rule does NOT transfer between devices

The premise "Roster is cold in the sidebar, so why is it a phone primary?" is answerable but wrong.
**Roster-on-desktop is the September EDITING job** (add players, jersey numbers). **Roster-on-phone
is the LOOKUP job** ("who is #14, what is the parent's number"). Same door, two jobs, two
frequencies. Cold in one nav and primary in the other is not a contradiction — but it was unstated,
which is how a future session "fixes" it by demotion.

Under the rule, all four survive and each owns a distinct question — *what's next* (Overview),
*when* (Schedule), *what's been said* (Chat), *who* (Roster). A fifth tab must pass the same test,
and none of the candidates does.

#### Answer to "are these available to every coach?" — no, but only one persona loses anything

| Tab | Gate | Head | Assistant (defaults) | **Helper** |
| --- | --- | --- | --- | --- |
| Overview | **ungated** (`default: return true`; deliberately — it is where a helper lands) | ✓ | ✓ | ✓ |
| Schedule | `caps.schedule` | ✓ | ✓ | ✓ (`HELPER_PRESET.schedule: true`) |
| Chat | `caps.staffChat` | ✓ | ✓ | ✗ |
| Roster | `hasRecordAccess(caps)` | ✓ | ✓ | ✗ |

**A helper's bar is Overview | Schedule | More** — 3 targets, stretched by `.tab { flex: 1 }`. Not
broken and arguably correct (both closed doors are ones they cannot use), but it is a real rendered
state that no document recorded.

#### ⚠⚠ FINDING FOR ANOTHER OWNER — the closed-season change is HALF-APPLIED on phone

`lib/coach-nav-visibility.ts`, `CoachesSidebar.tsx` and `CoachesBottomNav.tsx` are **modified and
uncommitted** in the shared working copy (another session's `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`,
also untracked). `withClosedSeasonNav` replaced `withLandingSlot`: a team with no live season gets
**one door**.

- **Sidebar: correct.** Applied per group → one door.
- **Bottom bar: half.** `TEAM_TABS` is filtered → 1 tab. **`MORE_SECTIONS` is NOT** — it is filtered
  by capability only, so the More sheet still lists **all 11 doors** into a finished season.
- **Result: desktop says 1 door, phone says 12.** Exactly the drift
  `tests/unit/coach-nav-groups.test.ts` exists to prevent — and it will NOT catch this, because its
  sidebar/More comparison runs on the live-season label sets only.
- **Stale comment:** the block above `TEAM_TABS` still reads *"the same four in every season state —
  only the landing tab swaps"*, which the code it introduces no longer does.
- **Undesigned state:** the bar renders **two tabs at ~50% width each**. That is what `flex: 1` does
  when three tabs are removed, not a design anyone chose.

**Raise with that session before it commits.** Not fixed here — touching another session's in-flight
files is how the collisions recorded elsewhere in this repo happened.

#### Finding: the real bar gap is ATTENDANCE, not Roster

Taking attendance is the most phone-shaped job in the product and has **no bar door at all** —
Schedule → find tonight's event → take attendance, three deep and only if the date is already known.
Same shape as the pre-Phase-1 practice-plans problem.

⚠ **A fifth tab is the wrong fix** — it answers "when?", which Schedule already owns, so it fails
the rule above. Cheaper candidates, each deserving its own look:
- the Overview's "one thing to do today" card offering attendance directly on an event day;
- the Schedule tab landing on *today* rather than the top of the list.

Build prompt: `COACH_NAV_GROUPS_COLLAPSE_BUILD_PROMPT.md` (Phase 5 + 5b; verified against the working tree 2026-08-18).
