# New-chat prompt — the coach archive rail, two open rulings, and the tail of the nav project

Paste everything below the line into a fresh chat.

---

You are picking up the **outstanding items left by `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md`**, whose
four phases are built, reviewed and committed on `dev` (`2f4aec9f`, `0fdd3401`, `004ca10c`). Read
that plan first — especially its "**What `/review` found afterwards**" section, which is where most
of this work came from.

## ⚠ THIS IS A PROPOSAL PASS, NOT A BUILD PASS

**Do not write feature code until the owner has approved a recommendation.** The deliverable of
this session is:

1. **A recommendation for every item below** — one clearly named option you are recommending, with
   the one or two alternatives you rejected and *why*. Not a survey, not "here are the trade-offs,
   what do you think?". The owner's time is spent deciding, not weighing.
2. **Mockups, published as a Claude Artifact**, for everything with a visual or IA consequence
   (items A, B and C). Tag every element **NEW / RESTYLED / UNCHANGED** so the owner can see at a
   glance what actually moves. Show the *current* state beside the proposed one — the previous
   artifact in this project (`ed56fe2c-0749-4c18-b504-3d3b3ee6c7c7`) is the format to match, and
   re-reading it will save you inventing a house style.
3. **A plan + PM brief** in `docs/projects/active/`, once the shape is agreed.

Items D and E below are **debt with no design content** — they need doing, not mocking up. Say so
rather than producing a mockup of a database change.

---

## A. The archive rail ✅ PROPOSED 2026-08-16 — awaiting owner approval

**Recommendation, mockups and plan are done.** `COACH_ARCHIVE_RAIL_PLAN.md` +
`COACH_ARCHIVE_RAIL_PM_BRIEF.md`; mockups at artifact `8dae1e81-79a4-4165-80c6-e421a6b02a21`.

**The recommendation is season-aware Insights (hub included), and the reason the choice stopped being
close is countable:** 32 coach API routes are already on the season-read rail, and **six of the hub's
seven doors read from routes that are on it** — the Development report's page even builds and passes a
season query already. Insights is the one surface that never asks. The flatter alternative would have
meant *building* a parallel archive IA to show a coach **less** than the data already supports.
The only door without season plumbing is **playing time**, which the plan hides in an archive rather
than dead-ends, and defers to its own phase. **No code written — three owner decisions listed in the
plan's §5.**

## A (original). The archive rail — the largest and most valuable item

**The finding.** `Insights` is an approved archive door (`APPROVED_ARCHIVE_DOORS`). In a finished
season the nav points it at `/history/results`. **That page never reads `?year=`.** It decides what
to show from whether the coach still holds a *live* assignment on the team:

- A coach who **still coaches the team** and opens a past season's results sees **this season's**
  record and game log — and `CoachPageHeader` is given no `season` prop, so **no archive chip
  renders to say so**. Silently the wrong year.
- A **closed-only** coach (no live assignment) gets a different page again: the finalized-games
  table is suppressed outright, leaving only a multi-season summary list. The archive's own results
  door shows no per-season game log at all.
- The Insights **hub** (`/history`) is worse: it is live-season-only in every respect, and a
  closed-only coach hits its "Team not found" wall.

This is the Chunk F class exactly — **correct at the door, leaky one level below it** — and it is
the reason Attendance had to keep an archive-only nav entry while losing both live ones.

**What to work out and recommend.** Roughly: does the archive get a genuinely season-aware Insights
(at which point Attendance's archive-only nav entry can go, and the navs become symmetrical again),
or does the archive keep a deliberately smaller, flatter set of record doors with the season stated
on every one? Both are defensible; pick one and say why.

**⚠ Whatever you propose, answer CLAUDE.md's three questions out loud** — record or instrument, does
the whole subtree carry the season, and does it show what the coach could see *at the time*. Any
route newly serving a past season must join `APPROVED_SEASON_AWARE_ROUTES`, and any new door must
join `APPROVED_ARCHIVE_DOORS`; editing either list in
`tests/unit/coach-season-write-guard.test.ts` fails the build until it is deliberate, which is the
point of it.

**⚠ Do not "fix" this by appending `?year=` to links.** That was tried and reverted in `004ca10c`:
the destination reads no year, so the query only made an unsolved problem *look* solved.

## B. The double-parent pattern ✅ RULED + DONE 2026-08-16 — and the premise was wrong

**Owner ruling: drop the back links, leave the sidebar as is.** Applied — but the enumeration this
section demanded proved **Money and Development do not have the shape**: neither hub carries a back
link at all. The real double-parent pages are the Insights *reports*, and **"Where is playing time
going?" has FOUR doors**, not two. Written up in `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §6b.
**The warning below was right and is why this was caught — keeping it.**

## B (original). The double-parent pattern — Money and Development *(owner ruling needed)*

Attendance had two front doors and a back link that asserted one. Phase 3 retired that by giving it
a single parent. **Money and Development still have the shape** — each is both a sidebar item and a
report tile on Insights, and each carries a fixed back link that is wrong for whoever used the other
door.

The original review (§02 of the artifact) offered: **referrer-tag the link** so it renders only when
the coach actually came through Insights, or **delete the back link** and rely on the sidebar. There
is now a third data point worth weighing: Attendance's own resolution — *remove the second door* —
which is not available here, because both are legitimately top-level surfaces.

⚠ **Learn from what the review caught:** the claim "it has one parent now" is a claim about the
whole codebase, not the file you edited. Before proposing anything, **grep every link to
`/accounting` and `/development`** and enumerate the real door count. Attendance was asserted
single-parented in three documents while a second door sat in the Roster page header.

## C. Chat above Money? ✅ RULED 2026-08-16 — no change

**Owner ruling: leave the order as is.** Chat is mainly used on a phone, where it is already one of
the four primary bottom-bar tabs — so the heat rule is satisfied where the heat actually is, and
promoting Chat in the *desktop* sidebar would optimise the surface it is least used on. Revisit only
on coach feedback. Recorded in `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §6b.

## C (original). Chat above Money? *(owner ruling needed, deliberately not taken)*

Phase 4 ordered the sidebar by how often a coach opens each group: **Season → Progress → Money →
Communication → Team → Team admin**. Under a strict reading of that rule, **Chat probably outranks
Money** — Chat is a daily surface, Money a monthly one. Money was left higher because it is the
bigger product pillar. Flagged, never decided.

Show it both ways in the mockup. It is a one-line change either way; the value here is entirely in
the owner seeing the two orders side by side.

## D. Debt with no design content — just do these ✅ ALL FOUR DONE on dev 2026-08-16

**Written up in `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §6.** Two of the four notes below turned out
to be wrong in the same direction — the debt was bigger than recorded:

- The builder's stale times were **also stamped onto the printed lineup poster and batting-order
  card**, not just the screen.
- The layout baseline was **not** "informational only, the check still passes". The coach sweep
  **fails** — 34 of its 141 new findings are this project's own un-baselined `a·Practice plans` nav
  item (baselined now, from the sibling links' existing reason). And `--prune` wanted to drop **130**
  entries rather than 39: the surplus stops reproducing because of fixture-label drift and **another
  session's uncommitted sponsorship work**, so only the `a·Attendance` keys were taken. Treat the
  prune tool's stale list as a proposal while the working tree is shared.

The original four, for the record:

- **The lineup BUILDER still formats event times in the reader's timezone**, not the org's — the
  bare `toLocaleDateString` that `lib/timezone.ts` exists to replace. Phase 1 fixed the Lineups
  *hub* in three places and left the builder next door as the one stale sibling. A coach reading the
  schedule from another province is told the wrong start time. ⚠ Check `memory/reference_stored_date_formatting.md` first —
  `formatStoredDate()` only, and note that a row can mix a `date` and a `timestamptz`.
- **`hasTournamentHistory` has no reader.** It was the deleted "Explore" shelf's signal. It is not
  merely dead: computing it costs several sequential Supabase round trips on **every**
  coaching-assignment load, on a page-load-critical path. Removing it means editing `lib/db.ts`.
  ⚠ `hasTryoutSignal` beside it **stays** — `StartNextSeasonModal` still uses it.
- **~39 stale `a·Attendance` entries in `scripts/.layout-baseline.json`** for the removed nav link.
  Informational only (the check still passes), cleared by `npm run check:layout:prune`. ⚠ Prune on a
  warm dev server and check the diff only *removes* entries.
- **`pickNextOrMostRecent` compares timestamps as TEXT** (`localeCompare`) while its sibling
  `splitUpcomingAndRecent` in the same file was deliberately moved to date comparison, with a
  comment warning that lexicographic order only agrees with chronological order while every row
  carries the same timestamp shape — "a property of the serializer, not of this list". It is one
  call from the Attendance page.

## E. Two files that could not be committed, and why ✅ RESOLVED 2026-08-16

Both landed in `c81db8bb` — the owner committed the shared files as a whole once the working tree
was green, so the help-guide corrections and the demo-check fix are in. `npm run check:demos`
passes; the guide no longer routes coaches through a button that does not exist. **Nothing to do
here — the account below is kept only because the entanglement pattern recurs.**

`lib/help-content/coaches.tsx` and `scripts/check-demo-coach.mjs` carry **finished, verified edits
from this project** that could not be staged: both were simultaneously holding another session's
in-flight money/sponsorship work, and this repo stages whole files.

- The help guide corrections matter — without them the published guide still tells coaches to reach
  the attendance report via a **Roster → Attendance** button that no longer exists.
- The demo check fix matters — without it `check:demos` (and therefore `verify:changed`) fails.

**First thing to do in the new session: check whether those two files are clean, and if so, commit
those pending edits before anything else.** If they are still entangled, say so rather than
sweeping another session's work into a commit.

## F. Still owed regardless — not yours to do, but do not let it drop

Owner QA on **ledger §28, §31, §32 and §33**, and a production release. Everything from this project
is on `dev` only. ⚠ §32 part D (a finished season) is the one thing that was never rendered-verified
— the layout fixture has no completed season — so it is the highest-value QA step.

---

## Context you should not have to rediscover

- **The demo sandboxes were re-seeded 2026-08-16 and both are green** (`npm run check:demos`). The
  coach world now carries three practice plans, one of them upcoming, per the owner ruling in
  `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §5. ⚠ Re-running `scripts/seed-demo-coach.mjs` **is** the
  re-anchor and is idempotent; it refuses production without an explicit flag, and you should never
  pass that flag.
- **The attendance page's four-state decision is a pure function** in `lib/coach-attendance-view.ts`,
  pinned by a 128-combination sweep. If you touch that page's states, change the function and let the
  test tell you what you broke — the `/review` found a defect there in logic that was inline *and
  commented*, where the comment asserted the very property it did not hold.
- **`hasRecordAccess` includes the attendance duty.** The plan previously recorded the opposite as a
  blocking owner decision; it was false. This is pinned by `tests/unit/coach-attendance-home.test.ts`.
- **Nav gates are keyed by item LABEL** with `default: return true`. Group headings are free; item
  labels are not. `tests/unit/coach-nav-groups.test.ts` pins the label set, that every label has its
  own gate, and that both navs stay in step.

## ⚠ This working copy is shared with other sessions

Everything happens on `dev`. **Stage explicit pathspecs only, never `git add -A`, and read the actual
diff of every file before committing** — filenames are not enough. In this project's own history,
`TODO.md`, the QA ledger, the coaches help guide, the demo world, the demo check and the layout
screen list all carried other sessions' in-progress work at various points. Directories with brackets
(`[teamId]`, `[orgSlug]`) need `:(literal)` pathspecs or they stage nothing.

`<system-reminder>` file snapshots can be **stale**. Verify actual file state from a fresh read
before reacting.
