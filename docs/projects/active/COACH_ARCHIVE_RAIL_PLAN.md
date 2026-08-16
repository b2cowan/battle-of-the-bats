# Coach Portal — the archive rail: Insights learns which season it is describing

**Status:** **Phases 1 AND 2 BUILT on dev 2026-08-16** (owner QA = ledger **§36** and **§37**).
**Phase 3 no longer exists** — playing time was ruled live-season-only permanently (§5.2, owner
2026-08-16). Every open question in §5 is now answered; the project is complete pending owner QA.
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
| Who did we award? | `awards`, `award-types` | ✅ | ⚠⚠ **MORE than "pass the year" — see the correction below.** |
| Is development covered? | `development/board` | ✅ | Almost nothing — **the page already builds and passes a season query**, and its child ("practices you've run") already carries the year. |
| Who did we play? | `opponents` | ❌ **NOT on the rail** | ⚠⚠ **This row said ✅ and was WRONG — see the correction below.** Hidden in an archive (owner, 2026-08-16). |
| Where is playing time going? | `lineup-analytics` | ❌ **not on the rail** | Hidden in an archive. **Ruled live-season-only PERMANENTLY** (owner, 2026-08-16). |

### ⚠⚠ Two rows of this audit were wrong, and Phase 2 found it by checking rather than trusting

The handoff prompt for Phase 2 warned that its predecessor "carried two premises that did not
survive contact with the code" and told the next session to verify anything it was about to build
on. Doing that found **two defects in this very table**:

**1 · `opponents` was marked ✅ on the rail. It is not — and a standing owner ruling says it must not
be.** The scouting book was ruled an **INSTRUMENT** with the project approval (owner, 2026-08-04),
its routes are deliberately OFF the season-read rail, and
`tests/unit/coach-season-write-guard.test.ts` carries a **dedicated build-enforced test** that fails
the moment one joins it — a test whose failure message spells out exactly what showing it in an
archive would require. So §5.1 was not the open question it appeared to be: the recommendation to
"show them, with the page saying they are the team's current book" was a request to **reverse an
existing ruling**, not to settle an open one. Put to the owner in those terms, **the ruling stands**
and the tile hides. The plan's own framing would have led the next session to build the opposite.

**2 · The awards door needed three things, not one.** "Page to pass the year" understated it:

- The report is **an instrument as well as a record** — Give an award, Manage award types, Remove —
  so it needed read-only treatment, not just a season parameter.
- Its **subtree is two pages deep**: the printable certificate reads the awards endpoint with no
  year AND prints `assignment.programYearName`, so a past year's award would have gone onto paper
  with **this** year's season name on it. Governing question 2 exists for exactly this.
- ⚠⚠ **And the report was already cross-season, live, today.** `rep_player_awards` has no
  `program_year_id`, and the route filtered by **team**, so *"N awards given this season"* has been
  counting every award the team ever gave — wrong for any team in its second year, and a hard
  blocker for an archive door. Season Wrapped had the narrowing right from the start (awards scope
  through the year's roster rows); the fix is that technique, extracted so the reason lives beside
  the getter. **A pre-existing live-season defect, found only because an archive door made it
  load-bearing.**

---

## 5. The open questions — ALL SETTLED (owner, 2026-08-16)

1. **Opponent notes in a past season → HIDDEN. The existing ruling stands.** ⚠ This was mis-framed
   as an open question with a recommendation to *show* them; it was really a request to reverse the
   2026-08-04 INSTRUMENT ruling (see the correction under §4). Put accurately, the owner kept it.
   The tile is absent in a record and the routes stay off the rail. **A coach loses nothing they
   had** — the per-season facts the book surfaces (who we played, what the score was) are already
   behind the approved Schedule and Insights doors.
2. **Playing time → LIVE-SEASON-ONLY, PERMANENTLY. Phase 3 does not exist.** The reason is governing
   rule 3, not effort: the figures are **recomputed** from saved lineups on every open, so a 2024
   report would show what *today's code* makes of 2024's lineups — not what the coach read that
   year. Everything else on the rail is a stored record; this one is a derivation, and a derivation
   cannot promise "what the coach could see AT THE TIME". Recorded as a build-enforced decision in
   `coach-season-write-guard.test.ts` so a later session cannot mistake it for a gap. ⚠ Reversing it
   needs a new ruling **and** an answer to the recomputation problem.
3. **Game tags in an archive → HIDDEN.** Built in Phase 1; the "at the time" rule answers it.
4. **Awards in an archive → SHOWN, with the leak fixed and the instruments put away** (new in Phase
   2; the question only became visible once the audit row was checked — see §4's correction 2).

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

### ✅ Phase 2 — the hub reads the season and becomes the archive's door *(BUILT on dev 2026-08-16)*

Owner QA = ledger **§37**.

#### What was built

- **The hub resolves its season** and gates on `page.hasAccess`, so the **"Team not found" wall is
  gone** for a coach with no live assignment. Capabilities come from that season's assignment row
  (rule 1), so an assistant granted money this year and not last reads no money for last year.
- **Every tile carries the year, and every destination reads it.** Results, Attendance, Money and
  Development already did; **Awards** was made season-aware here, along with its certificate.
- **Playing time and Opponents hide in a record — and are not fetched.** ⚠ The fetch is the gate,
  not the tile: both routes are off the rail, so calling them from an archive returns the LIVE
  season's numbers, which a finding or a summary line would then print under a past year's chip.
- **The archive nav points Insights → `/history`**, and **Attendance leaves the archive menu**,
  reachable through the hub in both seasons.
- **The results page's back link returns in every season**, carrying the year — Phase 1 removed it
  correctly, on a premise this phase ended.
- **The findings engine gets no "today" in a record** — its one deadline rule would otherwise count
  down to a date in a season that has ended.

#### Three things that joined it by applying the rules rather than inventing

- **⚠⚠ The awards report was cross-season, live, today** — see §4's correction 2. Fixed at the route
  by scoping to the season's roster, using the technique Season Wrapped already had right.
- **⚠⚠ The menu is not the set of sections, and the season switcher conflated them.**
  `resolveSeasonSwitchHref` decided "does this section exist in an archive?" by reading
  `CLOSED_TEAM_NAV_ITEMS`. That was the same question until this phase and is now wrong in **both**
  directions: Attendance exists in an archive with no menu line, and `/history/playing-time` sits
  under a menu entry's prefix while not existing in an archive at all. Left alone, a coach switching
  season from the live attendance report would have been dumped on Season's End, and one switching
  from the live playing-time report would have reached a page the archive hides everywhere else.
  Split into `CLOSED_SECTION_EXTRAS` + `LIVE_ONLY_ARCHIVE_SECTIONS` behind `archiveHasSection()`.
- **The Ask bar is hidden in a record.** It is live-season-only *by omission* — it takes no `?year=`
  anywhere — so inside an archive every answer would have been about this year.

#### Evidence

- **`tests/unit/coach-archive-season-rail.test.ts`** — Phase 1's file **generalised** to the hub and
  its doors rather than copied (28 assertions). ⚠ Two of its own assertions **failed on first run
  against comments that describe the fix**, which is a real hazard of source-level absence checks:
  the pressure is to delete the explanation to make the test pass. Negatives now run over
  comment-stripped source, and a mutation proved the stripper did not make them vacuous.
- ⚠⚠ **A mutation test found a hole in this file's own guard.** The "hidden reports stay hidden to
  the switcher" check looped over `LIVE_ONLY_ARCHIVE_SECTIONS`, so **deleting an entry made it pass
  vacuously**. It names both paths now. *A guard must not derive its input from the thing it
  guards* — the same class `coach-season-write-guard.test.ts` grew a dedicated test for.
- **Two existing tests were certifying the expired premise** and were updated deliberately, not
  deleted: `coach-attendance-home.test.ts` required Attendance in the archive menu, and the
  frozen-season smoke spec asserted the same. ⚠ Both were findable **only because each stated its
  own expiry condition in words** — the old test literally said *"if the archive ever points
  Insights at the hub, revisit whether Attendance still needs its own archive door."* Their
  replacements pin the **access** (`archiveHasSection('/attendance')`) rather than the menu line,
  which is the property that ever mattered and is strictly stronger.
- Typecheck clean · **2043 of 2043 unit tests pass** · lint clean on every changed file.
- ⚠ **A shared working copy, and the discipline that kept it clean.** For most of this build the
  suite showed one failure and a handful of type errors that were **another session's in-flight
  money work**, not this one's. The failure was the archive allow-list refusing their new route —
  the gate doing its job on their change. It was deliberately **left alone**: adding their route to
  that list would have been this session approving **their** archive decision, which is the one
  thing the list exists to prevent. They added it themselves, with their own reasoning, and the
  suite went green. The commit was staged **hunk by hunk** for the same reason — five files carry
  both sessions' edits, and one of them (the QA ledger) had their new section sitting directly
  against mine.
- Rendered sweep over `coach-history` + `coach-history-results`: **5 findings, none belonging to
  this change** — proved empirically by re-running the sweep against the pre-change hub restored
  from HEAD, which reproduces the 4 hub findings byte-identically (they are the money session's dues
  callouts); the 5th was already recorded as un-baselined in Phase 1's evidence.
- ⚠ **The archive path itself is NOT rendered-verified** — there is still no finished season in the
  layout fixture. Owner QA (§37) is the only proof.

### ~~Phase 3 — playing time~~ — **CLOSED, not built** (owner ruling 2026-08-16)

Ruled live-season-only permanently. See §5.2 for the reasoning and where it is enforced.

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
