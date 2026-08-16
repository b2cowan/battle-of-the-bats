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
- `hasTournamentHistory` still has no reader, and the review adds that it is not free: computing it
  costs several sequential database round trips on every coaching-assignment load. Removing it means
  editing `lib/db.ts`.
- ~39 stale `a·Attendance` entries in the layout baseline (informational; `check:layout:prune`).
- `pickNextOrMostRecent` compares timestamps as TEXT while its sibling in the same file was
  deliberately moved to date comparison, with a comment warning about exactly this. One call from
  the attendance page.

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

`hasTournamentHistory` on the coaching-assignment row now has **no reader** — the shelf was its only
consumer. Removing it means editing `lib/db.ts`, which is carrying another session's in-flight work,
so it is left computed-but-unused and recorded here as a follow-up. (`hasTryoutSignal` stays either
way: `StartNextSeasonModal` still uses it.)

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

- **`lineups/[eventId]` (the lineup BUILDER, a different page) still formats in the reader's
  timezone.** Outside this diff's blast radius, but it is now the one stale sibling beside a fixed
  hub. Worth a follow-up.
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

## 6. Links

- Mockups: `https://claude.ai/code/artifact/ed56fe2c-0749-4c18-b504-3d3b3ee6c7c7`
- PM brief: `COACH_NAV_AND_PRACTICE_PLANS_PM_BRIEF.md`
