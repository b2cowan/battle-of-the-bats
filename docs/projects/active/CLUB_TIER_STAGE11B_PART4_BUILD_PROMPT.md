# Club Tier Stage 11b · Part 4: Practice time (build prompt)

> **Written 2026-10-27** at the end of the session that built Part 3's second half (commits `9e3b703d2`..`ef76f6cdc`, see
> `HOUSE_LEAGUE_STAGE9_PLAN.md` §9). **Paste this into a new chat on `dev`.** It continues `CLUB_TIER_STAGE11B_BUILD_PROMPT.md`
> (Part 4's paragraph and the definition of done; read it for the rules of the road) and `CLUB_TIER_STAGE11B_PART3_BUILD_PROMPT.md`
> (what Part 3 left ready for this). This file wins where they differ. Re-verify every lead before building on it: other
> sessions share this working copy (Stage 12, the support console, bookkeeping). Stage explicit paths only, commit only your
> own hunks, and build a staged blob by hand when a file carries another session's edits.
>
> **Recommended model: Opus 5.5.** A fair hand-out across a division's teams (the engine's arithmetic, tested against the
> drawing's numbers), a write that replaces practices, and a page another session is editing. Helpers stay on Sonnet for
> reading and checks.

## The drawings and the rulings (do not reopen)

- **Drawings (build to these):** https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, tab "11b · club time", frames **h1**
  (Practice time) and **h2** (a practice's window, read first). Source `docs/projects/active/HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`,
  lines ~1466–1517. Read both frames whole, desk and phone, before building.
- **Rulings** (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0h): **9d2·5** (the convenor hands out practices from the house-league schedule; a
  club practice reads "From {schedule}" and changes only in the club's schedule; a house-league coach can't hand a practice
  back) · **9d2·15** (the club gives house league its time as a whole; the convenor divides it) · **11b·B** ("teams at once"
  inside house league's time is Practice time's, never the club's sharing rules) · **11b·C** (11b puts the team's practices on
  the house-league coach's team page: upcoming, club ones reading "From {schedule}", hand-booked ones too; 9d-2b adds the
  games beside them) · **deferred to 9d-3** (whether families hear when a team is FIRST given its practice time — so this
  window says families aren't emailed, and nothing here emails anyone; a practice CHANGE emailing families is Part 5's, 9d2·2).
- **Part 3's toolbar rule still holds:** the house-league Schedule page's toolbar is 9d-2a's to rebuild. Part 4 adds only
  **"Practice time"** to the Tools menu (Part 3 left its place: after "House league's time", before the Export group), and
  the practices' "From {schedule}" and read-first window where today's Practices view shows them. Restyle nothing else.

## What is already built (re-read it)

- **The write:** `league_practices_hand_out(p_org, p_season, p_division, p_actor, p_slots, p_rows, p_settings)` (migs 392–393):
  each slot locked in id order, must be this division's practice time in this season; practices still to come on those slots
  that the rows no longer name go; each row written with the SLOT's place (never the request's); floors `slot_full` (more than
  teams-at-once on a slot at an instant) and `team_twice` (a team in two club-time practices at once); settings
  `{ practiceMinutes 15–240, teamsAtOnce 1–4 }` kept in `league_practice_time`, refused `bad_settings` out of range. Tested by
  `scripts/club-stage11b-check.sql` T4, T5, T11. **No TypeScript calls it yet.** TypeScript never writes a practice's slot link
  (the scheduler guard holds it to SQL steps).
- **The read of house league's time** (`lib/league-time.ts`, `lib/league-time-server.ts`): sources → stretches → rows, the
  piece of one division and kind (`leaguePiece`), and the practices still to come on the time (`practicesStillToCome`).
  "U12 practice time" is a row; its parts are the slots Practice time hands out.
- **House league's time window** (`components/admin/kit/club/league/time/HouseLeagueTimeWindow.tsx`): levels (the list, a
  division's piece, Choose parts). Giving back practice time with practices still to come asks first, in red. **That question
  has never been seen with real practices — Part 4 is what makes them; check it.**
- **The engine** `lib/club-schedule-engine.ts` (pure, client-safe, one-sided): `cutSlots`, `matchPool` (partner groups up to
  a number), `shareTargets`, `generateDrafts`, prime time and turns. Read its header before deciding what to reuse.
- **The Schedule page** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`): Tools ⋯, the time line, the
  window mounted outside the page's loading swap. Its Practices view lists practices one team at a time (today's), with Add
  practice (a hand-booked practice) and cancel only.

## Build, in this order, each committed after its checks

**1 · The hand-out, planned (pure, tested first).** A pure function in a client-safe lib file (e.g. `lib/league-practice-time.ts`)
that plans a division's practices over its practice-time slots: each practice's length (cut inside a slot), teams at once per
facility, **every team the same number of practices a week where the time allows, the rest of the slots left open**, and
**teams taking turns at the early and late times week by week**. Answer the window's numbers too: practices a week per team,
slots that stay open, and the total ("Hand out 10 practices a week"). Reuse the engine's pieces where they fit (say which, and
why the rest is its own); the club engine is fair-share by slots and prime time, and its turn-taking is per team's facility and
start, so check it does what "take turns at the early and late times" means before leaning on it. **Tests with the drawing's
numbers:** U12 holds Mon and Wed 6:00–9:00 p.m. on two diamonds (12 hours a week), 60-minute practices, 1 per facility, 10
teams → every team 1 practice a week, 2 slots open, "Hand out 10 practices a week"; the early and late times rotate across
weeks; 2 teams at once halves the slots needed; a practice longer than a slot fits nowhere (say so in words, never a raw error);
a division with no practice time; a slot shorter than a practice.

**2 · The route.** Under `app/api/admin/house-league/seasons/[seasonId]/…` (e.g. `practice-time/route.ts`): GET the division's
practice time and its saved settings (`read`), POST the hand-out (`run` on the season; the house-league guard's shape — first gate
`houseLeagueRefusal(ctx, '<action>'`, no role literals, no `canOpenModule(` in route files). The POST re-plans ON THE SERVER from
the settings and the slots (never trusts the client's rows) and calls `league_practices_hand_out` with the slots it planned
over. Map `slot_full`, `team_twice`, `bad_settings`, `changed`, `season_closed` to words. A second hand-out replaces the practices
still to come on those slots (the step does that); played ones stay.

**3 · The window (h1).** A KitDialog form (`size="medium"`), eyebrow "{season} · {division}", title "Practice time":
- "U12's practice time · from house league's time": one row per shape of the division's practice time (days, clock, places,
  hours a week) — `partsWords`/`hoursAWeek` from `lib/league-time.ts`. "+ Give U12 more time" opens House league's time on
  **U12 practice time's piece** (mount it as Part 3's window does, at that level; never a second copy of the window's logic).
- "Hand it to the teams": **Each practice** and **Teams at once** as dropdowns (the house rule: a form select is a dropdown),
  then the result line (live, as the fields change): "Every team gets 1 practice a week. 2 slots stay open." / "Teams take
  turns at the early and late times, week by week." When the time is short, the line says who goes without (draft words).
- Foot: the sentence at the LEFT ("The practices show on the schedule and on each coach's team page. Families aren't
  emailed."), lime **"Hand out 10 practices a week"** at the right. Phone: the form fills the screen, the drawn short foot.
- Empty: "U12 has no practice time yet." (settled in Part 3) with the way to give it (House league's time). A registrar never
  reaches the window (its Tools item is absent for them; the route refuses).
- Doors: **Tools › Practice time** (owner, admin, league admin on a live season). The drawing also names "the time line under
  the title" — the time line's one door is House league's time today; do not add a second link to it without the owner.

**4 · "From {schedule}" and the practice's window (h2).** Where today's Practices view lists a practice handed out from the club's
time, it reads "From {schedule}"; opening it reads first: When · Where · Repeats · From ("{schedule} · the club's schedule"),
"Only the club's schedule moves or cancels this practice." and the rare door "Change U12's practice time" (opens Practice time;
absent for a registrar). A hand-booked practice gains **edit** (a pencil; for a series, "this one or the rest"), and Cancel keeps
today's three choices. Build the window as a component 9d-2a can mount in its List · Week · Month; do not rebuild the views.

**5 · The coach's team page (11b·C).** `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` lists the team's practices
from today on: club ones reading "From {schedule}", hand-booked ones too. **⚠ Another session had uncommitted edits in that page
and its stylesheet on 2026-10-27** — `git status` first; commit only your hunk (a staged blob by hand if theirs are still there).
Never show a practice a family-facing page: practices stay off the public schedule.

**6 · Check, don't build:** the club's own schedule already shows a house-league slot's use and its practice teams (the slot
window's `houseLeague.practiceTeams`); confirm a hand-out appears there, and that the club taking the time back (k5) names the
practices it would remove. Part 5 builds Send the changes' house-league rows and the emails.

## Words

Settled: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` ("Practice time (h1)" and the Part 3 section). Draft (to `/marketing`, one pass,
before the walk): the phone's short foot ("Families aren't emailed." / "Hand out"), the short-time line (who goes without), the
refusals' words (`slot_full`, `team_twice`, `bad_settings`, a practice longer than a slot), h2's facts and hint ("Only the club's
schedule moves or cancels this practice." vs the rep coach's "Only the club can move or remove this practice" — one spelling),
"Change U12's practice time", the hand-booked edit's "this one or the rest", and the coach page's "From {schedule}". Append the
settled set to the copy file. House rules: "6:00 p.m.", `possessive()`, `pluralize()`, sport-neutral ("facility", never
"diamond" in a sentence), "league admin", never a promised notice.

## Checks and done

- Unit tests for the planner (the drawing's numbers above); `scripts/club-stage11b-check.sql` still passes (add a case if the
  route needs one the step lacks); `npm test` on `league-time`, `league-club-schedule`, `house-league-gate-guard`,
  `club-scheduler-guard`, `club-scheduler-screens-guard`, `kit-dialog-foot-text-guard`, `house-league-season-frame`.
- `npm run verify:changed` (a failure in a file 11b doesn't touch is another session's — confirm before blaming yourself),
  `npm run typecheck`, `npm run lint:focused -- <files>`.
- **Part 3's red question, seen for real:** hand out practices, then give some of that practice time back in House league's
  time — the question names the teams and the Save removes only the ones still to come.
- `/review` on Part 4 (high-risk: a write that replaces practices, a fairness rule, a role's door) — fix or record findings.
- New files → the dev server needs a restart before the owner tests; ask first (Part 3's restart may still be owed too).
  `check:layout --changed` only if it doesn't widen to the whole product.
- Records: `HOUSE_LEAGUE_STAGE9_PLAN.md` §9 (commits, what's owed), the scheduler plan's 11b block, memory
  `project_club_stage9_house_league.md`.
- **The walk — ask the owner at hand-off.** The plan holds the 11b walks to the end of 11b. On 2026-10-27 the owner was
  offered walking **Parts 3 and 4 together** right after Part 4 (one purpose: "a league admin divides house league's time and
  hands out practices") — **not yet ruled**. If the owner says yes, write it as a checkable Artifact and the next § in
  `OWNER_QA_LEDGER.md` (check the last number), and carry Part 3's three visual checks: the Tools trigger on the house-league
  toolbar (it sits outside `tb.toolbar`), the window reopening on "← House league's time" from the club's schedule, and the
  club's schedule read on a phone.

## Do not

- Email or notify anyone (Part 5; the first-practice notice is 9d-3). Promise a notice in any sentence.
- Write a practice or its slot link from TypeScript (SQL steps only). Trust the client's planned rows on the server.
- Rebuild the Schedule toolbar or its views (9d-2a). Put practices on the public schedule. Bill house league (11b·A).
- Name House league in the club's sharing rules (11b·B: teams at once is Practice time's).
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a staged blob built by hand when a file carries
another session's hunks. No push and no promote without the owner's word.
