# New-chat prompt — the archive rail, Phase 2: the Insights hub learns which season it is

Paste everything below the line into a fresh chat.

---

You are building **Phase 2 of `docs/projects/active/COACH_ARCHIVE_RAIL_PLAN.md`**. Read that plan
first — especially **§6a**, which is what Phase 1's own `/review` found, and §5, which holds the
owner decisions.

**Phase 1 is built, reviewed and committed on `dev`** (`ac0cf565`, fixes in `a5ece270`). Owner QA is
owed as ledger **§36**. This prompt was written **after** Phase 1 shipped, so what follows is
verified rather than predicted — see the warning at the end about why that distinction matters here.

## ⚠ FIRST: two owner decisions gate this work

**Do not build past the point where these bite. Ask, get an answer, then continue.**

1. **Opponent notes in a past season.** The scouting book is written *about an opponent*, not inside
   a season. Showing today's notes on a 2024 page may be exactly right (the book is cumulative) or
   may be governing rule 3 broken. The plan **recommends showing them, with the page saying they are
   the team's current book rather than a 2024 snapshot** — but it is the owner's call.
2. **Playing time.** It is the ONE hub door whose data has no season rail. Phase 2 **hides** it in an
   archive (that is not in question). What needs deciding is Phase 3: does it join the rail, or is it
   ruled live-season-only for good? You do not need this answer to build Phase 2 — you need it before
   Phase 3 exists.

Everything else in §5 is already settled: **game tags hide in a record** (built in Phase 1), and
**the "Past seasons" scrapbook renders in every season** (a Phase 1 proposal said otherwise and was
overturned by review — see §6a finding 5).

## What Phase 2 is

Today a finished season's nav points **Insights** at `/history/results`, skipping the Insights hub,
because the hub is live-season-only. That workaround is why **Attendance is the one item that exists
in the archive nav and nowhere else**. Phase 2 makes the hub season-aware and points the nav at it,
which retires the workaround and makes both navs tell one story again.

1. **The hub resolves its season** (`/history/page.tsx`). It currently has **no season resolver at
   all** and its live-assignment check fires first, so a coach with no live assignment hits a
   **"Team not found"** wall on the hub describing the season they ran. Use `useCoachSeasonPage` +
   `page.hasAccess` exactly as the results page now does.
2. **Every tile carries the year**, and each tile's own destination must read it. §4 of the plan is
   the audit: six of seven doors read from routes already on the season-read rail.
3. **Playing time hides in an archive** rather than dead-ending — `lineup-analytics` is not on the
   rail. CLAUDE.md's rule: hide the entry point, never let it 404 politely.
4. **The archive nav points Insights at `/history`**, not `/history/results`.
5. **Attendance leaves `CLOSED_TEAM_NAV_ITEMS`** — it is reachable through Insights again, exactly as
   it is live.
6. **The results page's back link returns in an archive** (Phase 1 removed it deliberately, because
   in an archive the page *was* the nav destination — that stops being true here). It must carry the
   year.

## ⚠⚠ The build-enforced gate is the point, not an obstacle

Removing `Attendance` from `APPROVED_ARCHIVE_DOORS` in
`tests/unit/coach-season-write-guard.test.ts` **fails the build until the list is edited**. That is
the decision point working as designed. Edit it deliberately, with the reasoning in the diff — never
route around it.

⚠ **Order matters:** Attendance may only leave the archive nav *once the hub is the door*. Doing it
first repeats exactly the defect the nav project caught and avoided — see
`COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` Phase 3, "the archive door the tidy-up would have deleted."

## What Phase 1 proved, so you don't re-derive it

- **The season-read rail is far more built than it looks.** 32 coach API routes already run on
  `resolveCoachSeasonRead`. The rail re-resolves capabilities from the assignment recorded against
  the **requested** season (governing rule 1) and 403s a season the coach never coached. **Count the
  rail before designing around it** — that count is what made Phase 1 small.
- **The client cannot forge access.** The seasons list is built only from the coach's own
  assignments; an unknown `?year=` falls back to their live season and the raw param is never
  forwarded to an API. The server is the authority regardless.
- **`hasAccess` is the right access test**, not the live assignment.
- **The archive nav already appends the season** to every item's href (sidebar and bottom nav both).
- **The Development report already builds and passes a season query** — that door is nearly done.

## ⚠⚠ Four traps this rail has already sprung. Do not spring them again.

1. **A season on the chrome and not on the fetch is not a fix.** `?year=` was appended to links once
   and reverted (`004ca10c`) because the destination read no year. Whatever you change, the
   *destination* must read it.
2. **The write must be guarded, not just the render.** Phase 1 shipped with a guard on what was
   painted but not on what was written, and a slow response for an abandoned season could strand the
   page on "Loading…" **permanently**. The hub fetches **five** things — every one needs the
   `isStale()` shape the Lineups/Practice hubs use. This is the highest-risk part of Phase 2.
3. **A link one level down can be invalidated by your own change.** Phase 1 made a destination read
   the year, which silently made a deliberately-bare link wrong — a coach reading a past season's
   attendance landed on the live season. **Grep every inbound link to any page you make
   season-aware**, and re-read the *reason* written beside each one; a deliberate omission is only as
   durable as the reason stated with it.
4. **A test can certify a defect the moment its premise expires.** The frozen-season spec asserted
   that bare link was correct, with a comment explaining the reasoning that had just stopped being
   true — and passed. When you change a premise, grep the specs for it.

## ⚠ Nothing here can be rendered-verified

**The layout fixture has no completed season** — that gap is exactly how the original defect
survived. `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` is the **only** fixture with a
finished season; read it first, extend it, and treat unit + source-level guards as the primary
evidence. `tests/unit/coach-archive-results-season.test.ts` is Phase 1's; **generalise it to the hub
and its doors rather than writing a second copy.**

Owner QA is the only real proof. Add a ledger section and say so plainly.

## Also worth doing while you are here

- **The help drawer on the results page describes the Insights HUB**, not the game log in front of
  the coach, and points at a door that does not exist in a finished season. Phase 2 makes that door
  exist — check the guide again once it does, and offer `/docs`.
- **`lib/help-content/coaches.tsx`** tells coaches to open "How are we doing?" for the tag-chip
  filter without noting tags are live-season only.

## Still owed, not yours

Owner QA on ledger **§28, §31, §32, §33, §34 and §36**, and a production release — everything from
this rail and the nav project is on `dev` only. **§32 part D and §36 share the same fixture gap and
should be walked together.**

## ⚠ A pre-existing question this rail keeps brushing against

The multi-season scrapbook (record, roster size, tryout acceptance) is served to any coach who ever
held an assignment on the team, for **every** season — including years before or after their own
tenure. Money figures *are* correctly scoped per year. Not a regression and not Phase 2's job, but
if the owner rules that "their history" means "the seasons they were there for", that ruling changes
this rail's shape.

## ⚠ This working copy is shared with other sessions

Everything happens on `dev`. **Stage explicit pathspecs only, never `git add -A`, and read the actual
diff of every file before committing.** In one day this project had its own files swept into two
other sessions' commits, and a QA-ledger section number claimed by another chat mid-write.
Directories with brackets (`[teamId]`, `[orgSlug]`) need `:(literal)` pathspecs or they stage
nothing. `<system-reminder>` file snapshots can be stale — verify from a fresh read.

## ⚠⚠ And the reason this prompt was written after the work, not before

This project's previous handoff prompt carried **two premises that did not survive contact with the
code**: it described the layout check as "informational only, the check still passes" when it was
failing with 141 findings, and it named Money and Development as the double-parent pages when
**neither had the problem** — the real one had four doors and was never mentioned. Both were written
from notes, before the work. **Verify anything in this document that you are about to build on.**
