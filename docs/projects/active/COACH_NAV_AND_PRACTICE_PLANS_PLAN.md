# Coach Portal — Nav regroup, Attendance-as-report, and a front door for Practice Plans

**Status:** Phase 1 (Practice Plans hub) BUILT on dev 2026-08-15. Phases 2–4 approved, not built.
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

### Phase 2 — Fix the Attendance page

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
  above a one-line explanation. Proves the roster is connected and shows the shape that is coming.

### Phase 3 — Move Attendance into Insights

- Retitle as a question to match its neighbours (**"Who's showing up?"**).
- Drop the sidebar item; the recording flow on the Schedule is untouched.
- The back link becomes *true* — one parent — so §2's problem retires rather than being patched.

**⚠ Decide before building.** Attendance is a duty an assistant coach can hold on its own
(`caps.attendance`), while Insights gates on `hasRecordAccess`. An assistant whose only duty is
attendance would keep the ability to mark players present on the Schedule but lose the season
report. Recommended as correct — "take the register" and "review the season" are different levels of
trust — but it is an owner call, not an implementation detail.

The double-parent pattern still needs a decision for **Money** and **Development** (referrer-tagged
back link vs no back link). Not blocking.

### Phase 4 — Reorder the sidebar

Groups only. **No item is renamed and no route moves**, so nothing touches permissions.

**⚠ Nav gates are keyed by item LABEL** (`isCoachNavItemVisible`) — renaming any item silently
breaks an assistant-coach gate. Group headings are free; item labels are not.

**⚠ Both navs move together.** `CoachesBottomNav`'s "More" sheet mirrors the same grouping and the
same `conditional` mechanism. Changing one and not the other leaves the two navs telling different
stories.

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
