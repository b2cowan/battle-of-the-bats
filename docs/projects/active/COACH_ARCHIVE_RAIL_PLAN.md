# Coach Portal — the archive rail: Insights learns which season it is describing

**Status:** **Phase 1 BUILT on dev 2026-08-16** (owner QA = ledger §36). Phases 2–3 proposed,
awaiting the owner decisions in §5.
**Mockups:** artifact `8dae1e81-79a4-4165-80c6-e421a6b02a21` (published 2026-08-16).
**Origin:** the `/review` of `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md`, which rated this the single most
valuable thing left on the rail. Handoff: `COACH_ARCHIVE_RAIL_AND_FOLLOWUPS_PROMPT.md` §A.
**PM brief:** `COACH_ARCHIVE_RAIL_PM_BRIEF.md`.

---

## 1. The defect, stated precisely

`/history/results` is the page the archive's **Insights** door opens. **It never reads `?year=`.**
It decides what to show from one test — *does this coach still hold a live assignment on this team?* —
which is a different question from the one the coach asked.

That single test produces **two different wrong answers**:

| Who | What they asked for | What they get |
| --- | --- | --- |
| A coach who **still runs the team** | 2024 | **This season's** record and game log, and `CoachPageHeader` is given no `season`, so **no archive chip renders to say so** |
| A coach with **no live assignment** | 2024 | The finalized-games table **suppressed entirely** — only the multi-season summary list. The archive's results door shows no results |

The **Insights hub** (`/history`) is worse: it holds no season resolver at all, and its live-assignment
check fires first, so a closed-only coach hits a **"Team not found"** wall on the hub that describes
the season they ran.

⚠ **This is why Attendance had to keep an archive-only nav entry** while losing both live ones
(nav plan Phase 3): the archive points Insights at the results page rather than the hub, and the
results page carries no attendance door — so the nav item was the only route to a past season's
attendance report.

⚠ **Do NOT "fix" this by appending `?year=` to the links.** Tried and reverted in `004ca10c`. The
destination reads no year, so the query made an unsolved problem *look* solved.

---

## 2. The recommendation

> **Make Insights genuinely season-aware — hub included — and point the archive nav at the hub.**

**Why this rather than the alternative.** The brief offered a second direction: a deliberately
smaller, flatter set of record doors with the season stated on each. That was defensible when it was
written; it stopped being the better answer once the back end was actually counted.

**32 coach API routes are already on the season-read rail** (`lib/coach-season-read.ts`), and
**six of the hub's seven doors read from routes that are on it.** The plumbing exists, the read
safety is build-enforced, and the capabilities-as-of-that-season rule is already handled. Insights is
simply the surface that never asks.

The flatter alternative would mean **building a second information architecture for the archive** —
new pages, new copy, a second thing to keep true — in order to show a coach **less** than the data
already supports, and it would freeze the nav asymmetry permanently.

### Rejected, with reasons

| Option | Why not |
| --- | --- |
| A flatter set of record doors | Builds new surface area to deliver strictly less; keeps Attendance's archive-only nav entry forever. |
| Query-string only (`?year=` on links) | Already tried and reverted — the destination reads no year. |
| Leave it; the summary list is "enough" | The season's record is already shown as a summary line while the games behind it are unreachable. The door is approved and open; what is behind it is wrong. |

---

## 3. ⚠ The three governing questions, answered out loud

Required by CLAUDE.md before anything joins the archive.

**1 · Record or instrument?** Every Insights door is a **report** — it reads, never acts. The
instruments that *produce* these records (marking attendance on the Schedule, editing a cost, running
a tryout, writing a lineup) live elsewhere and stay live-season-only. The one to police is **Money**,
whose hub is already an approved archive door and whose write verbs already resolve the ACTIVE year.

**2 · Does the whole subtree carry the season?** §4 is that audit. It extends one level below every
door — Season Wrapped, "practices you've run", one opponent's page, an award certificate. **Every one
carries the year, or its door does not open.** This is the question that cost Chunk F its expensive
defects, and it is the reason this plan is longer than its headline.

**3 · Does it show what the coach could see AT THE TIME?** Capabilities come from the assignment
recorded against *that* season — the rail already guarantees it. Three **live vocabularies** are the
risk, and each is called out below: **game tags, award types, opponent notes.** A tag invented last
week must not filter 2024's games as though it existed then.

---

## 4. The audit — every door, and what feeds it

| Door | Reads from | On the rail? | What it needs |
| --- | --- | --- | --- |
| How are we doing? | `events` + `history` | ✅ | **The page to ask for a year.** The headline fix. |
| Who's showing up? | `attendance` | ✅ | Nothing — season-aware already (nav plan Phase 2/3). |
| Where did the money go? | `dues`, `budget*`, `expenses`, `fundraisers`, `money-summary` | ✅ | Nothing — approved archive door since Chunk F. |
| Who did we award? | `awards`, `award-types` | ✅ | Page to pass the year. ⚠ award **types** are a live vocabulary. |
| Is development covered? | `development/board` | ✅ | Almost nothing — **the page already builds and passes a season query**, and its child ("practices you've run") already carries the year. |
| Who did we play? | `opponents` | ✅ | ⚠ **A ruling** — see §5. |
| Where is playing time going? | `lineup-analytics` | ❌ **not on the rail** | Hidden in an archive until it joins the rail or is ruled live-only. The only genuinely new rail work here. |

---

## 5. Open questions the owner should settle before Phase 2 ships

1. **Opponent notes in a past season.** Scouting notes are written *about an opponent*, not inside a
   season. Showing today's notes on a 2024 page may be exactly right (the book is cumulative) or may
   be governing rule 3 broken. **Recommendation: show them, with the page saying the notes are the
   team's current book rather than a 2024 snapshot** — but this is the owner's call, not an
   assumption.
2. **Playing time (Phase 3).** Join the rail, or rule it live-only permanently? The figures are
   recomputed from saved lineups, so "what the coach could see at the time" is genuinely hard here.
3. **Game tags in an archive.** Proposal: **hidden**. The chips filter by a vocabulary the coach edits
   today. (Recorded as a proposal rather than a question because the "at the time" rule answers it.)

---

## 6. Phases

Each is shippable alone and leaves the archive better than it found it.

### ✅ Phase 1 — the results page asks which season *(BUILT on dev 2026-08-16)*

- Read the season through the same hook the Attendance page uses; ask the events route for **that**
  season (already supported).
- Render the **archive chip** via `CoachPageHeader`'s existing `season` prop.
- **Decide the page's shape from the SEASON, not from whether the coach holds a live assignment.**
  Both defects in §1 close together, and a closed-only coach gets a game log for the first time.
- "Past seasons" renders on the **live season only** — inside an archive the chip above already
  switches seasons, and a second list is the same control drawn twice.
- Tag chips hide in a record (§5.3).

#### What was built

The page resolves its season from `?year=` through the same hook the Attendance page uses, sends it
to the events read, renders the archive chip, and — the actual fix — **decides its shape from the
SEASON, never from whether the coach holds a live assignment.** `isClosedOnly` is gone entirely; the
access test is now `page.hasAccess` (live **or** archived).

**Two things joined it by applying the rule rather than inventing:**

- **The stale-response guard was keyed on the team alone.** The season switcher rewrites *this
  page's own URL* with `?year=` and the page does not remount — so a past year's header would have
  sat above the live season's games until the new fetch landed. Exactly the defect the Lineups and
  Practice hubs were fixed for a day earlier; this page had the same hole and nobody had looked.
  The key now carries the season.
- **The back link is gone in a record.** In a finished season the nav points Insights straight at
  this page, so it is the destination rather than a drill-in — a link claiming a parent is the
  double-parent defect in its original form. It returns for every season once Phase 2 makes the hub
  season-aware.

**And the copy stops promising a future in a record:** "No results yet / Once a game gets a score, it
shows up here" becomes "No results were recorded / No game in this season was finalized with a
score." Nothing will fill in — the season is over. Same rule the attendance report took the day
before.

#### Evidence

- **`tests/unit/coach-archive-results-season.test.ts` — 6 assertions, and all 8 of its underlying
  properties were verified to FAIL against the pre-change page.** A green test never shown to fail
  is not evidence, and this one could not be written any other way: the failure is a *missing
  argument*, not a wrong one, so no type can catch it.
- ⚠ **It asserts over the source, deliberately.** This is a client component whose behaviour depends
  on the URL and the coaches context, and **the layout fixture has no completed season to render it
  against.** That fixture gap is precisely how the defect survived — so the guard must not depend on
  the fixture that could not see it.
- Typecheck clean · **1984 tests pass** · lint clean.
- Rendered sweep over `coach-history-results` + `coach-history`: **no finding belongs to this
  change.** The 5 reported all reproduce in the morning's pre-change sweep — `a·Insights @768` was
  already an un-baselined finding (recorded in the nav plan's Phase 2 evidence), and the two dues
  links on the hub are the money session's in-flight work.
- ⚠ **The archive path itself is NOT rendered-verified** — there is no finished season to render.
  Owner QA is the only proof, and it is the same walk as ledger §32 part D.

#### ⚠⚠ What `/review` found afterwards (2026-08-16) — including a proposal of this plan's that was wrong

Four lenses. **Access came back clean** — the season list is built only from the coach's own
assignments so it cannot be forged, an unknown `?year=` falls back to the coach's live season and is
never forwarded to the API, and the events route independently re-resolves capabilities from the
assignment row recorded against the *requested* season and 403s one the coach never coached. Nobody
can reach a season they could not before.

**1. ⚠⚠ The page could strand itself on "Loading report…" — permanently.** The load key guarded what
was **painted**, never what was **written**. Switch to a slow season, switch again to a fast one, and
the slow response lands last and stamps *its* season into `loadedFor`; the correct table already on
screen reverts to a spinner, and **nothing re-fires**, because no dependency has changed. Phase 1
created the trigger: before it, the season could not re-run the load at all, so the structural gap
had no way to fire. The sibling hubs had adopted the full `isStale()` shape a day earlier — **this
page copied the render half and not the write half.** Every write is now guarded and the effect
cancels its previous run.

**2. The same gap, reached through the tolerated 403/404 branch.** When the events read is legitimately
refused, the writes were skipped while `loadedFor` still advanced — leaving the **previous** season's
game log under the new season's chip, with no error. State is now cleared rather than left: absent
data reads as absent.

**3. ⚠⚠ A link one level down, and this project's own defect class.** The Attendance page's read-only
back link deliberately carried **no** `?year=`, correctly, because on 2026-08-15 the destination read
no year and appending one only made an unsolved problem look solved. **Phase 1 inverted that premise
silently:** the bare link now lands a past-season reader on the LIVE season's results — the exact
mix-up this phase exists to end, re-entered through a link nobody re-examined. Fixed, both halves
recorded. ⚠ **A deliberate omission is only as durable as the reason stated with it** — the stated
reason is the only thing that made this findable when it expired.

**4. ⚠⚠ And a test was certifying it.** `coach-frozen-season-smoke.spec.ts` — the ONLY spec with a
finished-season fixture — asserted that link must have no `?year=`, with a comment explaining the
now-expired reasoning. It passed happily. **A test can certify a defect as correct the moment its
premise expires.** Updated, and it now pins the year explicitly.

**5. ⚠ §6/§02's "Past seasons is live-season only" was WRONG, and was overturned before the owner saw
it.** The argument was that the season chip is already a switcher. That mistook the section for one:
it is the team's **scrapbook** — per-season record, roster size, tryout acceptance, money summaries,
a Season Wrapped link — and it belongs to the TEAM, not to the season on screen. Three concrete costs
against one aesthetic argument: **Season's End links straight to it as "Compare every season"**, a
door that then succeeded while quietly not delivering; reaching another closed year's Wrapped went
from one step to two; and the fetch feeding it was still being made and discarded. **It renders in
every season.** The mockup's §02 pin C is superseded. *(The related worry that hiding it orphaned
Season Wrapped was **refuted** — the archive nav's "Season's End" carries the season correctly.)*

**Verified after the fixes:** typecheck clean · **1986 tests pass** · lint clean · rendered check over
`coach-history-results` + `coach-attendance` returns **2 findings, both byte-identical to this
morning's pre-change sweep** (the un-baselined `a·Insights @768`), so none belongs to this work.

#### Two pre-existing items this review surfaced — NOT from this change

- **Cross-year scrapbook exposure.** The multi-season summary (record, roster size, tryout
  acceptance) is served to any coach who ever held an assignment on the team, for **every** season —
  including years before or after their own tenure. Money figures *are* correctly scoped per year.
  Worth an owner ruling on what "their history" means; unchanged by this work, which narrows nothing
  and widens nothing.
- **The help drawer on this page describes the Insights HUB**, not the game log in front of the
  coach, and directs them at a door that does not exist in a finished season. **Phase 2 makes that
  door exist**, which resolves it properly — folded in there rather than patched here.

### Phase 2 — the hub reads the season and becomes the archive's door

- The hub resolves the season; the "Team not found" wall goes for closed-only coaches.
- Each tile carries the year. **Playing time hides** rather than dead-ends — CLAUDE.md's
  "hide the entry point" rule.
- The archive nav points **Insights → `/history`** (the hub), not the results page.
- **Attendance leaves the archive nav** — reachable through Insights again, exactly as it is live.
  Both navs tell one story.
- ⚠ **This phase edits the build-enforced lists** in `tests/unit/coach-season-write-guard.test.ts`
  (`APPROVED_ARCHIVE_DOORS` loses `Attendance`). **That edit failing the build is the decision point,
  by design** — it is not an obstacle to route around.

### Phase 3 — playing time: join the rail, or rule it live-only

Deliberately separated so phases 1 and 2 are not held up by a question that deserves its own answer.

---

## 7. Risks

1. **Removing Attendance from the archive nav is only safe once the hub is the door.** Doing it
   before Phase 2 lands repeats the exact defect Phase 3 of the nav project caught and avoided.
2. **The layout fixture has no completed season** — so nothing here can be rendered-verified by the
   sweep. Owner QA on a real finished season is the only proof, and it is the same gap that makes
   ledger §32 part D the highest-value QA step outstanding.
3. **Live vocabularies drifting into records** (tags, award types, opponent notes) — the failure is
   silent and looks like data, not like a bug.
4. **A route joining the rail must be read-only.** The build-enforced write guard covers this; do not
   weaken it to make a page convenient.
