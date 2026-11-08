# Club Tier Stage 13, expanded — How people move through the club (navigation + journeys)

**Opened 2026-11-06 by the owner.** Stage 13 of `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` ("Navigation across the three
portals") grows from a nav inventory into a review of **how each person who runs a club gets their work done**, end to
end, on real screens. PM brief: `CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PM_BRIEF.md`.

> Owner, 2026-11-06: *"now that we have done so many updates of the club pages, doing a more holistic overview of how users
> navigate throughout this entire app, mainly focused on the club pages but when relevant how they go between the three …
> imagine yourself in each of their shoes … think about tasks that you would have to execute, simple and complex, and then
> walk those journeys."*

## 0. Rulings

| # | Ruling | Date | Why |
|---|---|---|---|
| R1 | **Five people, not four:** the league admin joins the owner, the club admin, the house league registrar and the treasurer. | 2026-11-06 | In the product the registrar cannot schedule. House league's seasons, divisions, teams and schedule are run by the owner, the club admin and the league admin; the registrar works registrations, fees, refunds and family email, and reads the schedule (`lib/house-league-access.ts`, matrix ruled Q17). The scheduling half of journey 3 is the league admin's. |
| R3 | **A journey is walked up to the send, and that is enough.** No follow-up walk presses sends to see the receiving end after them. | 2026-11-06 | Owner: *"the journeys up to that point are enough for this analysis. I am more interested in how the app navigates these users through these journeys."* The review is about how the app moves each person through the job, not what happens downstream of a send. |
| R2 | **Walked on real screens by the agent**, not read from code. A local production build of the current code (never the shared dev server), a fixture club of its own, every screen captured and measured. The walk stops before anything that emails a person or charges a card. | 2026-11-06 | Layout, amount of text and sizing cannot be judged from code. Sets aside "the owner does the browser testing" for this review only. |

## 1. What this absorbs (one review, not four)

- **Stage 13 as written** (the readiness plan, §Stage 13): the nav inventory, the crossings between the club, a tournament and
  the Coaches Portal, desktop ↔ phone parity, the club sidebar at its full length, and its four open inventory questions —
  the house league season's own phone navigation (2026-10-25), whether the Club notice belongs under a Communications home
  (2026-10-22), where permits live (2026-10-27), and the one door with two names ("Overview" / "Club overview", N6).
- **The scheduling review held after Stage 11** (owner 2026-10-27: house league and rep teams, games and practices in one
  scheduling world may confuse). Journeys O2, O3, A4 and L2 are that review. The owner's first opinion is on record: permits are
  hidden inside Venues.
- **`docs/agents/design/NAV_STANDARD.md`** (N1–N10) is the bar the nav is measured against. It is a reference, not the
  verdict: where a person's journey shows a rule is wrong, the finding says so.

## 2. The people

| Person | Product role | Who they are in a real club | How they first arrive |
|---|---|---|---|
| **Owner** | `owner` | The president, or whoever bought the plan | Buys the Club plan, lands in a new club |
| **Club admin** | `admin` | Vice-president / operations | An invite email |
| **League admin** | `league_admin` | House league convener | An invite email |
| **Registrar** | `league_registrar` | House league registrar | An invite email |
| **Treasurer** | `treasurer` | Treasurer | An invite email |

The people at the receiving end — a rep coach in the Coaches Portal, a house league coach on their team page, a family on the
public site — are walked as the **last station** of the journeys that reach them, not as people of their own.

## 3. The journeys (25)

★ = named by the owner. Each journey is walked start to finish as that person would do it, from wherever they would start.

**Owner**
- **O1 ★ First time.** Buy the Club plan → first landing → what is set up, what is waiting → find every tool → invite the board.
- **O2 ★ The winter dome, end to end.** Get the dome permit in → build the dome schedule for the rep teams → send it to the teams →
  bill each team its share in installments → the rep coach sees the times and the bill in their Coaches Portal.
- **O3 ★ Summer house league time (the club's half).** Field permits in → give house league its share of the club's time → hand
  over to the league admin; followed through L2 to the public site.
- **O4 A new rep season.** Next year's rep teams, their head coaches; the coach's first step into the Coaches Portal.
- **O5 The club's tournament.** Create it, go into tournament admin and back, find its money in the club's books.
- **O6 ★ The president's view of the whole club** (added by the owner 2026-11-06, after the walks: *"this summary level
  reporting and views will be key to sell to club presidents who have to deal with so much information that they want the
  ability to have that synthesized and summarized with minimal effort on their part"*). Can the owner answer, with minimal
  effort: what permits, dates and times do we have available to use? where is each coach with their budget? which tournaments
  is each team signed up for? where are we as an organization financially? can I see the dome schedule and the house league
  schedule together, or go easily from one to the other? Plus the walk's own: what is happening across the club this week;
  how many players across every program; what is at risk or waiting on someone; can I hand the board a summary; can I glance
  at any of it from a phone. Each question is sorted into **answered** (where, how many clicks) · **assembled by hand** (the
  pieces exist, the president does the joining) · **not answerable from the club** (the data lives where the club can't
  see it, or nowhere). The last group is product work and goes on the "not navigation" list, not the nav ladder.

**Club admin**
- **A1 ★ First time.** Invite email → accept → first landing; what is theirs and what is the owner's alone.
- **A2 Rain-out.** A Saturday is washed out across house league and rep teams: find every game and practice, cancel or move
  them, tell the coaches and the families.
- **A3 Spring registration opens.** Create the house league season, its fees and divisions, open registration, put it on the
  public site with a club notice.
- **A4 The city takes a field back.** Two weeks of a permit are pulled mid-season: change the permit, see what breaks, fix it.
- **A5 The board changes.** A volunteer leaves and another starts: remove access, invite the replacement in the right role,
  check what they will see.

**League admin**
- **L1 ★ First time.** Invite → first landing; can they find their season and tell what is theirs?
- **L2 ★ The house league schedule (the league's half).** Divide the club's time among divisions → build the games → hand
  practice time to teams → publish → check the public site and a house league coach's team page.
- **L3 Form the teams.** From registrations to teams (the draft / placement), name the coaches; the coach gets their team page.
- **L4 A coach asks to move a game.** Move it and tell both teams' families.
- **L5 End of season.** Finish it, results, start next year's season.

**Registrar**
- **R1 ★ First time.** Invite → first landing.
- **R2 Registration week.** Work the first registrations: approve, waitlist, a duplicate family, siblings.
- **R3 Fees.** Mark e-transfers and cheques received, find who has not paid, send a reminder.
- **R4 A family withdraws after the start.** Withdraw the player and refund part of the fee.
- **R5 A parent phones.** "Which team is my daughter on, and when is her first practice?" Answered from a phone.

**Treasurer**
- **T1 ★ First time.** Invite → first landing.
- **T2 The dome bill, the money side.** The dome's cost → each team's share → installments → who has paid → a reminder (pairs with O2).
- **T3 Month end.** Record expenses, run the bank balance check, read budget vs actual.
- **T4 A coach's expense claim.** From the rep coach's Coaches Portal → approve → pay → it lands in the club's book.
- **T5 Year end for the board.** What came in (house league fees, rep dues, the tournament) and went out, close the fiscal
  year, hand the accountant an export.

## 4. What each station is judged on

The owner's six, plus the ones this review adds (7–13):

1. **First-time ease** — could this person do it on day one, without help?
2. **Does the flow make sense** — is the next step where they would look for it?
3. **The whole experience** — how it feels across the journey, not one screen.
4. **Layout** — does the screen lead with what it is for; is the main action above the fold?
5. **Text** — too much or too little; is the explanation where the question arises?
6. **Sizing** — controls, type and targets right for a computer, and for a thumb where the task is a phone task.
7. **Where am I** — can they tell which place, program and season they are in, and get back?
8. **Is this mine** — do they see tools they cannot use, or miss tools they can?
9. **Dead ends** — a link with nowhere to go, a refusal with no reason, a task that ends without a next step.
10. **One name per thing** — the same door, task or idea called the same everywhere (desktop, phone, emails, help).
11. **Feedback** — empty, loading, error and success states; does the person know it worked?
12. **Effort** — clicks and page changes per task; is a frequent task short?
13. **The hand-off** — when a journey crosses to another person or portal, does the other side receive it, and is it clear to them?

## 5. The nav review

Per person, desktop and phone: what their sidebar, phone bar, More sheet, top strip and account menu show; whether the groups
make sense to them; whether they can tell what applies to their role; how the five people's needs are balanced in one nav;
measured against N1–N10 and the exceptions, with every departure named. Plus Stage 13's own list: the crossings, parity, the
club sidebar at full length, and the four open inventory questions in §1. A census of every nav surface per role is the
starting point: `.probe/nav-journeys/nav-census.md` (scratch, not committed).

## 6. Method

- **Server:** a local production build on port 3100 with the dev settings pre-loaded (`.probe/p5-prodbuild.cjs`). The shared
  dev server is not used for the walk.
- **Fixtures, of the review's own:** a fresh club (just bought; invites pending) for the first-time journeys, and a lived-in
  club (a year of history; every program running; seasons in the states the journeys need) for the rest. New accounts only;
  no existing fixture, demo or saved sign-in is touched. Journeys that change data run on their own copy, so two walks never
  collide.
- **Captures:** Playwright as each person, at 1440 × 900 (and 390 × 844 for phone tasks and the whole nav), each screen saved
  with its measurements: page height against the fold, where the main action sits, words above the fold, targets under size,
  clicks per task. Scratch lives in `.probe/nav-journeys/`.
- **Stops:** before any send to a person and any card charge; the screen before the send is captured and judged.

## 7. The deliverable

One hub Artifact in the house layout (sticky numbered tabs, one section at a time): how the walk was done · one tab per person
(their journeys, station by station: the capture, the measurements, my read against §4, clickable finding flags, shape
questions with a recommendation) · the nav bar · standing back (the rules that cut across) · the stage ladder · the end state
drawn for the reshapes the ladder proposes (before = capture, after = drawn, NEW / RESTYLED / UNCHANGED, tagged with the stage
that delivers it) · the asks. **The walk, the ladder and the end state go out in ONE publish**, through `/design` first. The
owner reads it against the product and rules; the build stages follow from the ladder.

## 8. Sessions

| # | Session | Produces |
|---|---|---|
| 1 | Plan + brief; the nav census; the fixtures and capture rig; a pilot capture of every person's first landing | This file; the rig |
| 2 | The walks (journey clusters in parallel: first time; the dome; house league scheduling; the rest) | Captures + per-journey findings |
| 3 | Standing back, the stage ladder, the end-state drawings, `/design`, publish the hub | The hub, ready for the owner |
| — | Owner rules the asks | Rulings recorded here |
| 4+ | The build stages, each with its guards; `NAV_STANDARD.md` extended; the QA walk (its own § in the Owner QA Ledger); the layout sweep on staging | Stage 13's definition of done |

## 9. Out of scope

The inside of one tournament (beyond the crossing in and out), the Coaches Portal's own screens (beyond the receiving end of
a journey), the platform admin, and visual restyling not tied to a finding. Changes are proposed and drawn here, never built
ahead of the owner's rulings.

## 10. Status log

- 2026-11-06 — opened; R1, R2 ruled; the census and the rig started (session 1).
- 2026-11-06 — the census done (`.probe/nav-journeys/nav-census.md`: 13 departures from N1–N10 seen in code). The rig built:
  local production build on :3100, fixtures "Harbourtown Minor Ball" (`navj-club`, lived-in, + copies `navj-club-N` per
  data-changing walk) and "Fresh Hollow Minor Ball" (`navj-fresh`, invites pending), capture tool, pilot of every person's
  landing. Shared walk brief: `.probe/nav-journeys/WALK_BRIEF.md`. **Found before the walks, confirmed in code:** a club
  owner lands on the setup checklist at EVERY sign-in — the only thing that marks setup finished is the legacy onboarding
  page, and the club checklist never calls it (to be confirmed live in O1). Wave 1 of the walks started the same session
  (first time · the dome · house league scheduling · the nav); wave 2 (the remaining owner, admin, league admin, registrar
  and treasurer journeys) follows. Walk stop-rule kept as ruled: nothing that emails or notifies is pressed, even to
  `.local` fixture addresses — so a hand-off that only happens on a send is walked to the send and from the receiving side.
- 2026-11-06 — walks in. 24 of 25 journeys + the nav walked (A2–A4 still running at this entry). **One slip of the stop
  rule:** a walk helper pressed a single-row Approve twice on its own copy (no confirm on that button); each would email a
  family "accepted". Both families' addresses are on the reserved `.test` domain and dev has no live email key — nothing
  reached anyone. Two journeys end one station short because of the rule: the dome schedule reaching the coaches (O2) and the
  house league schedule reaching the public site (L2); owner asked whether to allow sends on copies.
- 2026-11-06 — R3 ruled (walking to the send is enough). A2 and A4 finished on a rebuilt :3100 (the production build had
  been wiped at 13:04 by a clean restart of the shared dev server; every other walk's captures predate it). **All 25
  journeys + the nav are walked.** Next: session 3 from `CLUB_TIER_STAGE13_SYNTHESIS_PROMPT.md`, fresh.
- 2026-11-06 — **O6 added by the owner and walked** (the president's view of the whole club). Of ten questions: answered at
  one click — the club's finances (Accounting Overview) and this week (Calendar); answered per permit, not across them —
  free time; assembled by hand — at-risk, players, the dome and house league season together; not answerable from the club —
  each team's tournaments (no ruling found) and each team's budget vs spent (a standing ruling, D1, keeps the coach's books
  the team's). The club Overview answers none of the ten directly; most answers sit one screen below it with nothing
  pointing there. Product gaps (free-time view, a club player count with last season, cross-team tournaments, a whole-club
  board one-pager) go to their own plan, not the nav ladder.
- 2026-11-06 — **Session 3 done: the hub is published**, one artifact with the walk, standing back, not-navigation, the
  ladder, the end state drawn and 24 asks: https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY (source
  `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html`, built from the walk files by `.probe/nav-journeys/hub/build.cjs`;
  captures published beside it). 255 findings (20 High). **Step 1:** every High's capture or code reopened (results in
  `.probe/nav-journeys/VERIFY.md`, session 3 section). Settled: buying Club is a **release gap** (ruled self-serve with a 90-day
  trial 2026-09-25; no plan builds the club's door; the pricing button leads into the tournament sign-up; Stage 8 still lists
  the overturned contact-us door) → `/plan` + `/strategy`; **receipts** are absent on club ledger lines and coach requests and
  in every plan → new item; the dome draft's lopsided split is the **schedule builder** (blank form defaults to 1 practice a
  team a day; the fair share serves teams in list order once that cap bites) → fix now; the tournament's "payments aren't
  tracked here" is the **no-fees fallback** (the fixture set no fees) → a crossing that keeps the 2026-10-13 and 2026-10-30 (B4)
  rulings; the **double bill is real** (only guard: room left on the line). **New High found in code:** removing a member who is
  also a parent in the same club deletes their account and family sign-in → fix now. Corrected: F-R4-3 (Withdraw does say it
  emails; Med → Low), F-O2-5 (builder, not seed), F-O6-5 (labelling, not money). The owner's same-day rulings on the
  president's view (Business Decisions Log 2026-11-06) are applied: D1 stays, "each coach's budget" = each team's standing with
  the club (answered on Accounting › Teams), the summary layer follows the Club release and League Plus carries it;
  each team's tournament list is Ask 5. **The ladder:** a fix-now session, then 13a doors by person · 13b each person's home
  and first day · 13c the club's time in one place · 13d hand-offs between people · 13e numbers open their lines · 13f actions
  that reach a family say so · 13g the phone · 13h one name per thing. Not on it on purpose: regrouping the sidebar's
  headings *(superseded 2026-11-06: the owner's 13i entry below brings the regroup into 13i; see the status log)*. `/design` ran before the hand-off (10 fixes applied: phone site button symbol-only per the 2026-10-20 ruling, the
  phone bar keeps N10's order, unchanged parts drawn at shipped sizes, white callouts, the permit window redrawn from its
  capture). **Next:** the owner rules the 24 asks; then the fix-now session, `/plan` for the summary layer (its hand-off is
  in the decisions log), and 13a.
- 2026-11-06 — **Owner: the side navigation feels clunky → stage 13i added (the sidebar's shape).** The nav walk judged
  doors by person, not how moving around feels; a usability review (code + the walk's captures; findings on hub tab 11)
  found one cause: a program's pages are handled three ways (sidebar rows stacked under the program, tabs on the page, a
  tile hub plus sidebar rows), so a click can't be predicted from the row. Verified first-hand: the arrow on a program row
  is a plain link (never folds); inside a house league season "Seasons" and the current page are both highlighted (the
  season page rows test active against the Organization links, not the season block); House league's only child is
  "Seasons", the page the parent opens; inside a rep team the rail runs to ~22 rows and Organization falls to the bottom
  edge at 900 px. Proposed direction: places in the sidebar, pages on the page; one highlighted row; a team or season
  block replaces the program's pages; Organization a hub or a list, not both; PROGRAMS regroups (absorbs F-NAV-2, -3,
  -11). It re-opens N3 (the arrow rule, 2026-10-17) on purpose. **Sequence:** after 13a, before 13c (which adds a Permits
  row) and before 13g/13h. Its own drawing session before any build (Ask 25, recommended A). The double highlight joins
  the fix-now list (now eight). Hub: ladder strip on the Asks tab; Standing back's "the sidebar is not the problem"
  amended.
- 2026-11-06 — **Ask 23 ruled A** (fix-now runs as one session before 13a) and **the dome default ruled**: a blank club
  schedule keeps 1 practice per team per day, and the form says what that leaves open beside the setting (not derived from
  the permit, not asked). The even split is an engine defect, not an owner choice: the share step hands slots out in team-list
  order, including slots a team can't place. **Fix-now build prompt written:**
  [CLUB_TIER_STAGE13_FIXNOW_BUILD_PROMPT.md](CLUB_TIER_STAGE13_FIXNOW_BUILD_PROMPT.md) (no drawing session; one build session).
  The stale rep-team page (F-O4-3) is reproduce-first: no stale path found in code.
- 2026-11-06 — **Fix-now session BUILT 2026-11-06** (all eight, one session; committed `2a33cc98a` 2026-11-06). Each item's
  guard written and green; `npm run typecheck` clean; the changed-files gate's own checks pass (the full unit run carries 9
  failures, all in other sessions' uncommitted files). Facts on the way: the dome (25 Sundays × 18 = 450, 7 teams, Evenly, 1
  a day) drafted 46 before (25 · 10 · 4 · 3 · 2 · 1 · 1) and 175 after (25 each); no existing engine count shifted. F-O4-3 was
  not reproduced (no browser this session): the windows now wait for the reload, and the walk reproduces it. Item 1's watch
  list confirmed: the Founding Season offer never applies to the Club plan, and the onboarding-plan route, `AdminHubClient`
  and the legacy wizard only run for tournament workspaces. Left for later, recorded: the Slots column per team at 1 a day
  (13c); the time window's own "… in Schedules." sentence for a league admin. Walk: Owner QA Ledger §473
  (https://claude.ai/artifact/79UHzi4b6EmXSKFoyWsNWG). Hub tab 10 rebuilt locally 2026-11-06 (the eight rows read "Built 2026-11-06 · walk §473"); its republish to the hub link is owed (a fresh session: the live copy must be read first). Next: `/simplify` (two new helpers), `/review`, `/docs`, the walk,
  then 13a.
- 2026-11-06 — **Fix-now `/simplify`, `/review` and `/docs` done**, and the whole fix-now committed `2a33cc98a` 2026-11-06. *Simplify:* the
  account-keep pair stays two files (the pure half is what the tests load); the tab-title module stays its own file; the
  engine's two new counts duplicate nothing; the house-league head count and the time window now start from ONE definition
  of house league's time; the schedule footer's per-day sentence folded into the existing "left open" line. *Review (high-risk
  tier, four lenses):* applied — an empty member count now counts as a failed read (never zero); the removal window says so
  when its check fails instead of loading forever; a season's club-schedule page now lights Schedule in the rail, phone bar
  and season switcher (removing the Seasons highlight had left it with no lit row). *Recorded, not fixed:* (1) the house-league
  "given" count also counts time another season already divided, so an undated or overlapping season can read "given but not
  divided" when it has none — the exact fix reads the window's rows (a page-through the build prompt ruled out on this hot
  path); (2) with "no back-to-back days" ON and practices on adjacent weekdays, the even quota can place fewer practices in
  total than before (26 of 1,200 random setups; the setting is off by default) — a placer limit, not the share step; (3) the
  per-day sentence blames the whole gap on the setting when a weekly cap or days off also leave time open, and says nothing
  at all for sharing or program teams (the old "Nothing left open" still shows there); (4) an owner who leaves the checklist
  by the sidebar or back button with steps unfinished still lands on it at the next sign-in (the build prompt asked for the two
  triggers only) — owner question. *Docs:* the Club setup guide, a new Members FAQ on what removal does to a sign-in, the
  schedule form guide (per-day hint, closing row) and the House league time guide (three Overview states) updated. *Gate:*
  typecheck clean; touched suites 581/581; the full unit run's only failures are the 9 listed at hand-off, none reading a
  fix-now file; the gate's later scripts were run directly and every red names other sessions' files.
- 2026-11-06 — **The owner ruled all 25 hub asks as recommended** (reported in conversation; the hub's own summary was not pasted
  into the plan session). That settles Ask 25 (13i gets its own drawing session, builds right after 13a) and **Asks 6–9 (13a), all A**:
  one in-frame "not yours" screen naming who opens it; the Organization hub shows only doors the person holds, a one-door person goes
  straight to it, locked rows stay for admins and name the owner; House league leads for the league admin and registrar from day one
  (the one exception to N10); the header pill reads "View site", no duplicate foot door, and the live site's way back gets a label.
  Also ruled with them: the registrar sees who runs the board, names only (ALSO row R1). **Fix-now walk §473 PASSED 30/30** 2026-11-06;
  its test copy and 14 accounts removed the same day. **13a build prompt written:**
  [CLUB_TIER_STAGE13A_BUILD_PROMPT.md](CLUB_TIER_STAGE13A_BUILD_PROMPT.md), split into **Session A** (the "not yours" screen, the hub,
  the Overview's Organization section, empty states — drawn on hub tab 15) and **Session B** (leads, the waiting count, the site label —
  built from shipped pieces, not redrawn). Planner-verified while writing it: the Organization hub's Members and Tournaments tiles
  have no role check (`org/page.tsx` 31-43); and **the Overview's "League registrations waiting for review" line has never been able
  to show** — the attention summary counts status `pending`, the real state is `pending_review` (the tryout count had the same slip,
  fixed 2026-09-25) — fixed first in Session B (B2) before the registrar's waiting pill is built on it. The league admin CAN create a
  season (runners = owner, admin, league admin); only the registrar cannot — a helper's map said otherwise and is not followed.
  **Next:** Session A, then Session B, one walk for the stage, then the 13i drawing session (it can run alongside the 13a build, since
  it touches no code).
- 2026-11-06 — **13i drawing PUBLISHED** (no code changed): https://claude.ai/artifact/T42raG41vUxt7gjdJEjQMR (source
  [CLUB_TIER_STAGE13I_SIDEBAR_DRAWINGS.html](CLUB_TIER_STAGE13I_SIDEBAR_DRAWINGS.html); prompt
  [CLUB_TIER_STAGE13I_DRAWING_PROMPT.md](CLUB_TIER_STAGE13I_DRAWING_PROMPT.md)). Baseline drawn = today + 13a as ruled. **Recommended:
  places in the sidebar, pages on the page**: the club sidebar lists places only (owner 10 rows on every screen; registrar 4; treasurer
  3; today the owner's runs 10 / 21 in a team / 18 in a season / 15 in Organization), every place's pages are Accounting's tabs
  (one component; scrolls sideways below 900, measured: Rep teams' six tabs need 845 px, fit at 1440, 90% visible at 768, 45% at 390),
  one lit row, no club chevrons, headings Programs (Rep teams, House league, Tournaments) + Club (Accounting, Families, Public site,
  Organization), Organization as tabs (the hub retires; Plan & billing its last tab, owner only), a page's own filters become the
  toolbar's view choice (Registrations), tournament mode and both coach portals unchanged. **Pushed back in the drawing:** the brief's
  "a team's block replaces the program's pages in the rail" contradicts "pages on the page" and fails the phone (Ask 1 B is that
  version); finding 7 corrected from the code — a team's pages on a phone are door cards, the only disclosure is Rep teams' own, first
  page only (`AdminKitProgramRow.tsx:200`); the club rail is `AdminKitRail` (club + tournament mode only), the coach portals and the
  support console have their own sidebars, so 13i is club-only by construction. **It reverses half of the 2026-09-30 Accounting ruling**
  ("separate jobs are listed in the rail; Rep teams stays in the rail", design_decisions) for that ruling's own phone reason, and re-opens
  N3 (2026-10-17 Ask A2), the collapsed sidebar's program menus (Ask 3) and N7's Ask B3; NAV_STANDARD rewrites drawn for N2/N3/N4/N7/N9/N10
  and a new N11. **The ladder note above ("Not on it on purpose: regrouping the sidebar's headings") is SUPERSEDED** by the owner's 13i
  entry; marked in place. Build guards named: the phone bar's fill order is written out so the regroup moves no bar (N10); if Ask 3 is A,
  13a Session A's hub tiles are replaced a stage later by tabs on the same door list. `/ux` (5 applied: tabs are real addresses, the
  hidden-pages trade named, no team switcher stated, strip drawn with the frame, a caption) and `/design` (5 applied: the 09-30 reversal
  named, its record-page clause kept in N11, only waiting counts amber, Add team into the Teams toolbar, no new hairline) ran before
  publishing. **Next:** the owner rules Asks 1–9 (paste-back "13i asks: 1A 2A …"); then the 13i build prompt. Order unchanged: 13a, then
  13i, then 13c.
- 2026-11-06 — **13a Session A BUILT 2026-11-06** (Asks 6 + 7, items A1–A6; build prompt
  `CLUB_TIER_STAGE13A_BUILD_PROMPT.md`). *A1:* one "not yours" screen (`NotYoursScreen` / `NotYours`, words in
  `lib/not-yours-words.ts`) — what the page is, who opens it by name, a door to the person's own home (the sign-in landing,
  now one rule in `lib/member-home.ts`). It replaced the silent returns (Families, Accounting, Rep teams — a plan that lacks
  the page, or a team workspace, still goes home), the "Access restricted" / "You don’t have access" cards across Public
  site and seven House league screens, the PDF settings callout, the owner-only voices of Settings, Plan & billing (the
  admin's page; the body's card stays for the Coaches Portal) and Audit log, Members' "isn’t turned on", and the role
  refusals of Schedules and Calendar (their plan refusals keep "Nothing to show"). Four unreachable Rep teams sub-page cards
  and the three `.accessDenied` style blocks were deleted. *Departures from the prompt, with reasons:* (1) the sentence names
  the OWNER only ("Morgan Ellis (owner) can give a treasurer access", as drawn on tab 15) — only the owner changes what a
  member opens (the member route refuses a capability change from anyone else), so "or an admin" would be false; (2) Ask 7
  as ruled says locked rows **go** where the section holds nothing else (the prompt copied "stay only where"); (3) the walk's
  Audit-log 404 was the address `/admin/org/audit`, which does not exist — the real page now shows the screen, the
  non-page stays a 404; (4) Allocations never sent the treasurer to Rep teams, so only Teams changed (A6); (5) the
  Public-site preview's 404 for a non-editor stays (an embedded frame, not a page anyone is sent to). *Owner name (open
  question 1):* a NEW small read, `GET /api/admin/board` (`boardNames`, names + roles only — a member with no name on the
  account is left out, never shown by email; the old `orgOwnerDisplayName` falls back to the email and is not used), read
  only by the screens that name someone — not the club brief, which every club screen calls. *A2:* the hub's tiles are
  `orgHubDoors` over the rail's own `kitOrgLinks` + Tournaments (`canOpen('module_tournaments')`) + `kitBillingLink` + the
  person's Coaches Portal; one door → straight to it; none → the screen; the owner gains Audit log (F-O1-15); a person with no
  Members door sees **The board** (names only, as drawn on tab 15 — R1). *A3:* locked rows for admins only, chip "Ask
  {owner}" (aria "Plan & billing, the owner’s"); the section shows only when it holds a door or the reader is an admin. *A4:*
  the empty Seasons page names who creates the season for a non-runner. *A5 (open question 3):* "Start a season" gated on
  the league's runners, "Run a tournament" on `create_tournaments` (owner and admin by default); everyone else is told who.
  *A6:* Accounting › Teams tells someone without Rep teams to ask the owner or an admin. *Guard:*
  `tests/unit/club-stage13a-doors-guard.test.ts` (34 tests: every refusal site, the banned wordings across the club admin,
  the sentence builders, the names-only read, role × hub tile for the five people, the Overview's rows); two older guards
  re-pointed (Stage 1 locked rows, Stage 6b Venue library tile). *Gate:* typecheck clean (8 GB heap — the default 4 GB runs
  out); touched suites 277/277; the full unit run's only failures are 9 in other sessions' work (billing-tax words in help
  articles, practice plans phone, billing free time, Stage 6 walk page, series dates, support console foot, workspace
  status census), none reading a 13a file; the gate's later scripts run directly — the admin old-look drops locked in, every
  other red names other sessions' files. Not walked. Next: `/simplify`, `/review` (high-risk: auth guards), then Session B.
- 2026-11-06 — **13a Session A `/simplify` + `/review` DONE 2026-11-06.** *`/simplify` applied:* the board hook moved out of
  the screen file into `lib/use-board-people.ts` (a hub that only wants names no longer pulls the screen in) and keeps a
  per-club answer for a minute, so the second screen says the name on its first paint (the cold first load still shows
  "the club's owner" for a tick — not worth a spinner); the refusal layouts ask for the OWNER only (`boardNames(orgId,
  ['owner'])`: one account read, not one per board member); the Overview and the Seasons empty state read the board only when a
  sentence will name someone; the Organization hub reads rep access from the rail's own fetch (one request, not two);
  `programHome` returns href + label (no more `endsWith('/accounting')`), `isFreeFloorLeague` and `LEAGUE_RUNNER_ROLES` are
  reused, `getUserDisplayName` is `getUserPersonName(user) || email`, the hub's door order is the description list's key order;
  dead code gone (an import in the season schedule and in Settings, the `home` option, `.empty*`/`.locked*` in the Members,
  Settings and Audit log style sheets, a test constant). *`/review` (high-risk; 4 lenses: access parity + hooks, security/PII,
  hub logic, blast radius): no Critical or High; the board route is org-scoped to active members and returns `{name, role}` only,
  the one-door redirect cannot loop, hooks order holds in every file.* **Fixed from review:** (1) Rep teams layout redirected a
  team workspace that held the capability and the plan — restored to HEAD's parity (as Families and Accounting); (2) the Overview's
  locked rows came back for an admin on the free League Starter (a tournament-plan org with no `/admin/org` pages) — the old
  `planId !== 'tournament'` guard is back on `showsLockedRows`; (3) the "Back to X" door could be the very page just refused
  (a treasurer whose Accounting was switched off, a registrar without House league, a free-floor staff member) — `memberHome`
  takes the refused page and falls back to the Overview; (4) Families told a team-limited member to ask the owner for access
  that cannot be given — a `familiesLimited` page says "It opens only for people who aren't limited to certain teams" and names no
  one; (5) a name field holding an address (an `@`) is left off the board like an unnamed account; (6) my own cleanup read the
  clock while rendering (lint) and moved a hook out of reach of a test's stand-in — both fixed. **Recorded, not fixed (owner or
  later):** the free League Starter OWNER lands on the league at sign-in (`lib/user-contexts.ts`, and the onboarding page holds a
  third copy) but the door home sends the owner to the Overview — one rule, owner to pick; `scripts/check-layout-invariants.mjs`
  (`ADMIN_LANDING_FAILURES`) and `scripts/admin-identity.mjs` (`refused`) do not list the new refusal wording ("isn't one of your
  pages", "Nothing here is open to you yet") — shared sweep automation, changes only when the owner asks; the three server layouts
  repeat one two-step refusal block and House league has six client refusals for one rule (a shared helper / layout would fold
  them, and the guard test's source-string pins with it); the hub tiles draw their own icons, not the rail's (changing it changes
  the pictures); Calendar and Schedules compare the server's refusal codes as strings; `NOT_YOURS_WORDS` carries a few
  single-use words and the page titles are copied from the sidebar; `orgOwnerDisplayName` (the Coaches Portal layout) still falls
  back to the email where the board read is names-only; `orList`/`withArticle` have copies in three libs; the board answer is not
  cleared on sign-out (a minute, names and roles of the same club); the Season money refusal on a phone sits under the season's
  name strip; a server-layout refusal sets no tab title; the one-door redirect does not wait for the Coaches Portal fetch (cannot
  fire today); the Overview's quiet row shows a dangling "·" and the locked chip says "Ask the owner" for a tick while the board
  loads; the Members tile's description says "Manage…" to a view-only role. *Gate:* typecheck clean (8 GB heap); touched suites
  323/323; `npm test` 14,829/14,838 — the 9 failures are the same other-session ones (billing-tax words ×1, practice plans phone,
  billing free time ×1, Stage 6 walk ×3, series dates, support console foot, in-force census) and none reads a 13a file; the
  later `verify:changed` scripts: spelling, public tokens, text/contrast, dictionary, observability and the rest green; reds
  (admin old-look on the tournament schedule sheet, admin type, schema parity, index coverage, org-slug callers on Public site
  address and the ledger window, unused selectors, export registry) all name other sessions' files. `check:layout` NOT run (no
  dev server). Not walked. Next: Session B in a fresh session; the stage's one walk comes after B.
- 2026-11-06 — **13i ruled: the owner, "this looks good, i agree with your recommendations" — Asks 1–9 all A** on
  https://claude.ai/artifact/T42raG41vUxt7gjdJEjQMR. 1A places-only club sidebar, every place's pages as tabs on its page; 2A no
  arrows, the strip's program menus go; 3A Organization as tabs, the tile hub retires; 4A Plan & billing is Organization's last
  tab, owner only; 5A headings Programs + Club, a heading only over two or more rows; 6A a page's own filter tabs become the
  toolbar's view switch; 7A the tab row scrolls below 900; 8A tournament mode unchanged; 9A coach portals unchanged, club-only.
  Logged in `memory/design_decisions.md` (2026-11-06, names the reversal of the 2026-09-30 Accounting ruling's second half).
  **13i build prompt written:** [CLUB_TIER_STAGE13I_BUILD_PROMPT.md](CLUB_TIER_STAGE13I_BUILD_PROMPT.md) (three sessions). Order
  unchanged: 13a (Session B, then its walk) first, then 13i, then 13c.
- 2026-11-06 — **13i Ask 4 changed to B by the owner:** *"sorry i missed that, the sidebar footer should remain the same as before (plan
  an billing stays there along with the other nav footer elements)"*. Plan & billing stays in the sidebar's foot (and in the phone's You
  group, with the fee-invoice pill, both unchanged); it is not an Organization tab. Consequences carried into the drawing (republished,
  version 2, same link), the build prompt, the design decision and the PM brief: Organization's tabs are its five pages; the Plan &
  billing page draws no Organization tabs; N4 is rewritten as built (Plan & billing first) rather than changed; the owner's More sheet
  goes 19 → 14 (not 13); the build prompt's open question on the fee pill's new home is gone.
- 2026-11-06 — **13a Session A committed `2cebde79c` 2026-11-06** (59 files, Session A's hunks only; the shared plan, PM
  brief, TODO line and Public-site words/page went in partially, the 13i entries and the "About us" rename left to their sessions).
- 2026-11-06 — **13a Session B BUILT 2026-11-06, `/simplify` + `/review` DONE** (Asks 8 + 9, items B1–B5; build prompt
  `CLUB_TIER_STAGE13A_BUILD_PROMPT.md`). **B2 first — a defect FOUND AND FIXED:** the Overview's "League registrations · waiting
  for review" line could never show: `/api/admin/attention-summary` counted status `'pending'`, which no registration holds (the real
  state is `pending_review`; the tryout count had the same slip, 2026-09-25). ONE read now, `lib/league-registrations-waiting.ts`:
  `pending_review` across **every season that is not finished** (open question 2 settled: not completed/archived —
  `FINISHED_LEAGUE_SEASON_STATUSES`, the house-league gate's own list, so the count covers exactly the seasons where the desk may still
  work one; wider than the old `registration_open`-only set). The club brief carries it as `counts.leagueRegistrations` (ONE head count
  per brief, by the registrations' org index, joined to the season's status; absent on a failed read) for whoever holds
  `canHouseLeague(…, 'register')` (owner, admin, league admin, registrar); the attention summary reads number + door in ONE query (the
  door is now the season holding the OLDEST waiting registration, not the newest one taking registrations). The House league rail row,
  the phone bar's House league tab and the Overview's House league card wear it through `briefProgramCount`. The kit's amber count reads
  the real number to 99, then "99+" (`kitCountText`: rail, phone tabs and sheet rows, the fee-invoice count on both navs, Overview
  cards, Registrations tab, season rows, Money's pill); chat/notification unread keep "9+". **B1:** `personClubShape` (lib/admin-kit-nav.ts),
  applied once in `useAdminKitNav`: a person whose ONLY openable program is house league sees it lead from day one (rail, the phone bar's
  third slot, the Overview card); decided by what they open, not the role; owner, admin and treasurer unchanged (pinned in a role ×
  season table, nav-standard-guard). The card says "No season yet · {name} starts one" (Session A's `seasonStarterShort`) or, for a
  league admin, "No season yet · start the first one here"; the board read's enable condition widened to cover it (one fetch).
  N10 + N8 in NAV_STANDARD carry the exception. **B3:** the hub's Ask 9 drawing re-read before building — it captions the foot door
  "goes" for people who can't edit the site and draws only Help in every non-owner foot, so the planner's "no duplicate door" reading
  stands. The club pill reads "View site" (tournament screens keep theirs); the sidebar foot's "Public site" door and the phone More
  sheet's live-site door are gone (the pill is on every screen the navs are; a cancelled club has neither); the live site's staff way
  back shows its word ("Admin" / "Coaches Portal" / "Roles") above 900 px and the bare icon at 900 and under. N4 rewritten. Guards:
  `tests/unit/club-stage13a-yours-guard.test.ts` (new) + nav-standard-guard (Ask 8 table, Ask 9 cases); two older pins re-pointed
  (Stage 1 attention gate, admin-kit-nav hook order). *`/simplify` applied:* one finished-season list shared with the gate; the
  Overview line's number + door in one query; the "View site" word inline (its comment had claimed a new tab); one count span in the
  sheet; the card line and chip simplified; comments trimmed. *`/review` (high-risk, 4 lenses: exposure, query/logic, blast radius,
  spec):* no Critical or High; counts are org-scoped from the auth context and present only for the desk. **Fixed from review:** the card
  said "No season yet" while the brief loaded (and for good on a failed brief) for a registrar on a Club plan whose league runs — it now
  reads the brief's answer only; the fee-invoice count read "12" on the desk and "9+" on the phone. **Recorded, not fixed:** the
  labelled way-back pill on the live site at 901–1,200 px with a long club name, tabs and My team may squeeze the tabs (the tabs
  scroll, no page overflow; no layout-sweep screen shows the live site to signed-in staff, so it was not measured — walk it); the word
  hides at 900 px and under (the pill's own breakpoint, so tablets too); the pill opens the live site in the SAME tab where the drawing's
  caption said a new tab (owner question); right after a hop back from the live site the first admin page's pill can read "Public site"
  (the return memory's surface label); the tournaments list and the tournament Public site settings page keep "Public site"; the More
  sheet's program tiles (`MoreSheetTiles`, shared with the coaches portal) and the season schedule's two team/division counts keep
  "9+"; one amber-pill component (`WaitingCount` out of MoneyKit) would fold four copies of the pill markup; platform admin's identical
  99+ rule and the ~9 copies of the unread 9+ rule; the pill's word is pinned by a source assertion, not a table test. *Gate:*
  typecheck clean (8 GB heap); touched suites 666/666; `npm test` 14,884/14,894 — the 10 failures are the 9 other-session suites
  Session A recorded (billing-tax words ×2, practice plans phone, billing free time ×2, Stage 6 walk ×3, series dates, support console
  foot ×2, in-force census ×2) and one of mine (the Stage 1 attention-gate pin), re-pointed and green; spelling ✓; the later
  `verify:changed` scripts: the same seven reds as Session A (admin old-look, admin type, schema parity, index coverage, org-slug
  callers, unused selectors, export registry), none naming a Session B file; `check:layout --only=admin-hub,admin-hub-treasurer,
  admin-club-more` ✓ (12 screen-widths, no new findings). Not walked. **Next:** the stage's one walk ("each person sees only their
  doors"), then 13i.
- 2026-11-06 — **13a Session B committed `87ddc358e` 2026-11-06. The stage's one walk published:** Owner QA Ledger §475, https://claude.ai/artifact/QDf94cW4yAH8AE4NscUbBZ ([CLUB_TIER_STAGE13A_WALK.html](CLUB_TIER_STAGE13A_WALK.html)), one purpose ("each person sees only their doors"), 9 parts / 39 steps on two fresh Harbourtown copies: `navj-club-13a` (12 registrations waiting for review) and `navj-club-13a-new` (no house-league season), both with a league admin added (`.probe/nav-journeys/fx-13a.mjs`). Recommended to the owner: walk it before 13i Session A changes the sidebar and retires the Organization tiles; /docs for 13a folded into 13i Session C. Teardown on "13a walk done".
- 2026-11-06 — **13i Session A BUILT 2026-11-06 (pages on the page; the sidebar not touched yet); committed `f279e6963` after /simplify + /review (next entry).** Build
  prompt [CLUB_TIER_STAGE13I_BUILD_PROMPT.md](CLUB_TIER_STAGE13I_BUILD_PROMPT.md) items A0–A7. **Four owner answers in the session**
  (recorded in the prompt's "Settle in the build"): Teams & draft's per-division tab row → **the division picker** Registrations uses,
  at the toolbar's left; the desk season switch → **the title's chevron opens the Year pill's menu** (`SingleSelectDropdown`, new
  opt-in `face="chevron"`); a team's History and one past season, Rename team addresses and a club schedule read from a season →
  **record pages** (own back arrow, no tab row); and a conflict the drawing missed, raised before code — retiring the Organization
  hub removed 13a's "The board" card (R1) → **a read-only "The board" tab** in Members' place for anyone without Members
  (`/org/board`). *Built:* one tab list per place in `lib/admin-kit-nav.ts` (`repTeamsTabs`, `teamTabs`, `seasonTabs`, `orgTabs`,
  `placeTabFor`); one frame (`PlaceFrame`, over the shared `HubTabBar`, unrestyled) worn by Rep teams, a team (new layout: "← Teams",
  "Rep teams · {group}", name, season chip), a season ("← Seasons", "House league", name + switch, status pill) and Organization; the
  tab pages lost their titles and "← {team}" / "← {season}" links, their buttons kept in a tab action row; Add team at the Teams
  toolbar's end, Add registration at Registrations'; Registrations' four views are the `ViewSwitch` (new opt-in `mark`); `/org`
  goes to the first tab, its tile array deleted; `AdminKitProgramRow` and `SeasonPhoneFrame` deleted. The frame owns the width (the
  wide column; a page's narrower cap gives way inside it, Accounting's rule). *Disclosed:* on a phone the season chevron opens the
  standard pick-one sheet (the same menu's own sheet), not the retired phone frame's sheet; Teams & draft's picker no longer shows
  each division's accepted count (the amber mark means waiting). *Checks:* typecheck clean for these files (two errors are another
  session's platform-admin money work); lint clean; unit suite 14,960 pass, 9 fail, all in other sessions' files; guards re-pointed
  (season frame, 13a doors/yours, 6b, notifications, accounting teams, cancelled shell, kit nav, workspace flip) and a new
  `club-stage13i-places-guard.test.ts` (18 cases). ⚠ The 13a walk (§475) reads the Organization tiles this session retired: walk it on
  the committed `87ddc358e` state before this session's work reaches the dev server. **Next:** `/simplify` → `/review`, commit on the
  owner's word, then Session B (the sidebar and the More sheet).
- 2026-11-06 — **13i Session A `/simplify` + `/review` done; Session A committed `f279e6963` 2026-11-06 (not walked, not pushed).** *Changed by /simplify:* Organization's frame and the `/org`
  door now read only the Organization links (a small `useOrgLinks`), no longer starting the coach-access fetch the rail already makes;
  the team header reads the team once per team while the layout stands; dead words (Registrations eyebrow, Teams' title and Divisions
  label, the email history eyebrow), the leftover empty-header plumbing on four screens and `PageLoading`'s now-optional header
  tidied; stale header comments fixed. *Changed by /review (five lenses, high-risk tier):* Registrations' four views get their own
  full-width row on a phone (the admin toolbar never wrapped, and the shared switch's phone rules do not reach it) and a gap before
  each count; Settings keeps a 44rem reading width inside Organization's frame; Roster, Schedule and Tryouts now publish the team
  header from their own read, so its season chip cannot lag behind a season closed elsewhere; a failed header read is retried;
  "The board" says "no names to show" (and to refresh) rather than claiming nobody has a name when the read may have failed; the dead
  `hasRepAccess` field removed. Three guards re-pointed (not loosened) for the new shapes. *Left, for the owner/Session B:* the rail's
  own copy of the team page list and its two "you are here" rows on `/org` (Session B's files); `scripts/layout-screens.mjs` `admin-org`
  now measures a redirect; the shipped house-league help article still describes the retired phone season strip (`/docs`); an empty
  action row leaves a 0.85rem gap on desk team/season Schedule; "The board" has no entrance for someone with no other Organization tab
  (as the old hub). *Gate:* typecheck and the 13-file guard set clean; `check:layout` not run (no staging; dev server is not for a ~50-screen sweep).
- 2026-11-06 — **13i Session B BUILT 2026-11-06 (the sidebar and the More sheet); committed `403341b71` 2026-11-06 after /simplify + /review (not walked, not pushed).** Build prompt items B1–B7 (Ask 4 = B: the foot untouched). *Built:* the club sidebar lists places only — Overview · Calendar · Schedules, then Programs (Rep teams, House league, Tournaments), "Also on your plan", then Club (Accounting, Families, Public site, Organization); owner 10 rows on every screen, admin 9, league admin 4, registrar 4, treasurer 3. Nothing renders under a row (team block, season block and its switcher, program pages, "Site editor", Organization's rows gone), no chevrons, one lit row at any depth (`litClubPlace`; none on Plan & billing's page, whose foot row lights); a heading only over two or more rows, a lone row keeps the space ("Also on your plan" always said — a build reading, not ruled). The groups are a map beside `LEAD_ORDER` (`PLACE_GROUP`, `clubPlaceGroups`), built once in `useAdminKitNav`. Collapsed sidebar: every club icon a straight link, the program and Organization menus gone. A place's row always carries its count, the sum of its tabs' (`briefPlaceCount`); the Assistant coaches tab now carries its own. Phone: bar and tiles identical for all five (snapshot `.probe/13i-b-phone-snapshot.json`, pinned in `nav-standard-guard`); the More sheet lists the sidebar's places under its names, Organization once, a one-row group unheaded — the owner's sheet 19 → 14; not-yet-run programs list under "Also on your plan" (were under Programs). Both Session A leftovers fixed: the rail's team page list and `useRailTeam` (and the five pages' publish calls) deleted; Organization lights on every tab, Plan & billing on its foot row. NAV_STANDARD N2, N3, N4, N7, N9, N10 rewritten and N11 added (the 2026-09-30 reversal noted), "chevron follows the pages" exception retired, Built line names 13i. *Changed by /simplify:* one list of places shared by both navs, one place-count rule (Rep teams summed from its tabs), More lit on Plan & billing by its own row rather than its address, the Families badge reused on the tab, two dead cancelled-club checks and stale comments removed, one five-person test fixture (`tests/unit/_club-people.ts`). *Changed by /review (three lenses, high-risk tier, no Critical/High):* a dangling class reference in the strip stylesheet's comment; a header line wrapped. *Disclosed:* a cancelled club's More sheet no longer lists "Also on your plan" (the sidebar already hid them); "The board" still has no entrance for someone with no other Organization tab (as before; no club plan hits it, every role holds Venue library). *Left for Session C:* the house-league help article (season block, switcher) and the collapse-sidebar article (strip menus) are now wrong (C1, `/docs`); the layout sweep (C3) — `check:layout` not run here (the rail is every admin screen, a whole-product sweep is not for the dev server). *Gate:* typecheck clean but for another session's files; lint and spelling clean; unit suite 15,059 pass, 11 fail, all in other sessions' files (console, billing words, team-move coverage, portal-tag census, practice plans, series dates, public tournament walk). **Next:** Session C (help words, the demo check, the layout sweep, the walk).
- 2026-11-06 — **13i Session C BUILT 2026-11-06 (words, checks, the walk); committed `17019d266` 2026-11-07 on the owner's word (with ledger §475 and the 13a walk page, both uncommitted until then).** Build prompt items C1–C5. *C1 help (`/docs`, 13a's folded in):* a helper census of every help module, each finding re-opened before editing; ~35 statements fixed in six modules: the collapse-sidebar article (strip "menus" → every icon a straight link; House league's pre-season row is under Also on your plan), the season article (season block, switcher and phone strip → the season header, its tabs and the arrow beside the name, which keeps your tab and shows from two seasons), Registrations' four "tabs" → views at the toolbar's left (house-league + registrations guides), the season's "menu" → its tabs, the Draft tag's place, Families' "two tabs" → three (wrong before today), the sidebar's "New tournament" (gone since 2026-10-19), Rep teams' "Past program years" → the Past seasons tab; one new section, `places-and-tabs` ("Finding your way: places in the sidebar, pages as tabs": the groups, a team, a season, Organization, the foot, record pages, Back/bookmarks, View site, the "not yours" screen), searchable by "where did the team menu go". Search words moved with the prose. No help link pointed at the retired hub; nothing sent anyone through Organization › Tournaments / Coaches Portal / Plan & billing. *C2 demos:* no tour anchor on a sidebar row, no tour destination on `/org`. *C3 layout sweep* (local production build on :3100, owner approved stopping the dev server for it): 111 club screens × 361/390/768/1440; the retired hub's screen `admin-org` (now a redirect, so unmeasurable) re-pointed to `admin-org-board` (the registrar's The board) and its three baseline entries dropped. **Two 13i defects found and fixed:** a season's Overview scrolled 88px sideways on a phone (the divisions table's 1px screen-reader labels escaped `.tableWrap`'s scroller — `position: relative`, the known trap), and Registrations' toolbar spilled 252px at 768 (Export and Add registration past the edge: the phone-only wrap now wraps at every width, the views take their own row below 900); both re-measured clean at 361–1440 on the dev server (the re-run on a production build was blocked by another session's uncompilable `lib/console-money-sales-store.ts`, and a second full sweep by the memory floor while another session typechecked). *Not 13i, left:* Teams & draft's team-card header spills 10px (Session A did not touch it); **the layout baseline is stale for the house-league screens** (pre-Stage-9 wording: "Pending Review", "Add Division", "Save All Renames"), so ~130 of the 136 findings the baseline does not know are renames of known ones or other sessions' uncommitted work (Families duplicates, the help hub's "What's new") — a baseline refresh is its own job, not written from a run over other sessions' work. *C4 walk:* Owner QA Ledger §476, https://claude.ai/artifact/5gewKCeHyZjNXfkVWrRP3h ([CLUB_TIER_STAGE13I_WALK.html](CLUB_TIER_STAGE13I_WALK.html)), one purpose, 10 parts / 34 steps, owner + registrar + treasurer, desk + phone, on a fresh Harbourtown copy `navj-club-13i` (12 waiting, a finished 2026 Spring House League added for the switch; `.probe/nav-journeys/fx-13i.mjs --waiting=12 --past-season`); teardown on "13i walk done". Every other walk naming the old sidebar is already walked (the 9a walk §372, 2026-10-25), so none re-pointed. *Gate:* spelling ✓; help tests 19/19; the two screen-list guards 12/12; lint clean on the edited help (8 warnings, all on untouched lines). PM brief's 13i heading updated. **Next:** the owner walks §476; then 13c.
- 2026-11-07 — **13i walk §476 PASSED 34/34 (owner), Stage 13i CLOSED.** Every part (S, 1–8, Z) marked Pass; no notes or defects pasted
  back, so the "Known before the walk" calls stand as built (registrar's Organization = two tabs; season arrow = the pick-one sheet on a phone;
  "Also on your plan" always named). Part Z run: `navj-club-13i` and its 12 accounts removed (read back: org gone, 0 accounts left). **Owner
  rulings the same day:** "View site" STAYS in the same tab (the open pill-tab question from 13a is closed that way — the drawing's "new tab"
  caption is not built); the 10px spill in Teams & draft's team cards (there before 13i) is fixed — the card head's pencil and bin carried a
  corner-tuck right margin meant for a lone button, which on the pair pushed the second 10px past the head and over the first; the margin is
  now zero inside the head only (the coach rows in the team window keep theirs). Edited CSS only; **not measured in a browser** (the layout
  sweep was refused: its free-coach fixture is unavailable, and `--changed` on a shared stylesheet widens to all 352 screens — not run on the
  dev server). The pencil/bin now sit ~10px further left than before. Still open outside 13i: the stale layout baseline for the house-league
  screens (its own job). Next on the ladder: 13c–13h.
- 2026-11-07 — **An external product and IA review of the Club tier was cross-checked against the code and this plan**
  (`CLUB_TIER_PRODUCT_IA_REVIEW.md`, 23 findings + 5 challenges + 5 owner questions). Read-only; no code changed. Result in
  §11: about a third of the review is this stage's own walk handed back (it cites hub IDs), so agreement is not a second
  opinion; seven findings treat a ruled trade-off as a defect; three are wrong on the code. **New here: F-XR-1 to F-XR-9**,
  two of them High (the coach's "never your families' payments" promise against the Families page; a treasurer, league
  admin or registrar who coaches has no door back from the Coaches Portal). Three walk findings that no stage owned are
  given a home. **Next:** the owner rules §11.4's first decision (F-XR-1); then a fix-now 2 build prompt.
- 2026-11-07 — **F-XR-1 ruled by the owner as recommended:** keep the Families page as it is and make the coach's promise
  true. `/legal` reviewed the new words (`docs/agents/legal/IN_CLUB_VISIBILITY_PROMISES.md`): low exposure. The families of a
  club-owned team are the club's own records. Club is not on sale and no family-facing text made the promise. Approved with
  one correction: "never sees your **other** spending", because the club does see what the team pays shared payees. **Fix-now 2
  build prompt written:** [CLUB_TIER_STAGE13_FIXNOW2_BUILD_PROMPT.md](CLUB_TIER_STAGE13_FIXNOW2_BUILD_PROMPT.md) (F-XR-1 to
  F-XR-4, one session, no drawing; item 3's "tick needs both fields" goes to the owner in the build's summary).
- 2026-11-07 — **Fix-now 2 BUILT (F-XR-1 to F-XR-4), committed `bac14d456` 2026-11-07; `/simplify`, `/review` (high) and `/docs` done; the owner's walk §480 WALKED ✅ 23/23 on 2026-11-07 (copy removed).** Owner ruled in the
  build's summary: item 3 **both required**; item 2 **no door for a member whose only club role is `coach`**.
  - **F-XR-1:** the coach's Money › Club foot line, the club team page's cash line plus a new row ("What each family owes and
    has paid (on Families)"), the rep-teams help, the coach help (prose and search words) and the Families help now say what
    the club really sees. Checked first-hand: Money › Club opens only on a team owned by a club (not a team workspace), and the
    Families page reads exactly those teams, so the sentence is true wherever it shows. Guard: stage-3b screens guard §6.
  - **F-XR-2:** one rule, `adminDoorHome` (`lib/member-home.ts`): the club admin admits every accepted member except a
    volunteer (`official`); the door follows that, lands on the person's own home (treasurer → Accounting, league admin and
    registrar → House league, others → Overview), and skips a team workspace and a coach-only member (an empty Overview).
    Sidebar and the phone More sheet both read it. **/review fix:** it also takes the person's own access overrides, so a
    treasurer whose Accounting the owner switched off gets the Overview, not the "not yours" screen. Guard:
    `coaches-admin-door-guard.test.ts`; `lib/member-home.ts` joined the portal-tag census in `workspace-flip-guard.test.ts`.
  - **F-XR-3:** step 4 ticks on tagline AND contact email (`org_public_site_content.contact_email`) and says which is missing.
    **A club that ticked on the tagline alone un-ticks, and "Continue setup" returns: the honest state, not a regression.**
    Guard: stage-1 screens guard.
  - **F-XR-4:** the house-league coach's team page is signed in, so it carries one quiet line, "Your rep team is in the Coaches
    Portal", with the door, only when the portal would really admit them (club member, **billing not suspended** — added by
    /review —, plan carries the portal, a live rep team: `getRepPortalDoorForReader`, stricter than the portal on purpose). The
    read starts beside the team read, not after it. Help in both articles. Guard: `coach-both-programs-guard.test.ts`.
  - **/review noted, left as built:** the family record's History lists each payment's date and amount, so the coach's sentence
    is true but does not name that (owner's call, walk §480); Families opens only for a member given that access; the review's
    suggestions to extract one shared admission predicate for the admin layout and the portal layout were left (they would
    edit both layouts; the guard tests pin both rules). **Walk:** [CLUB_TIER_STAGE13_FIXNOW2_WALK.html](CLUB_TIER_STAGE13_FIXNOW2_WALK.html),
    Owner QA Ledger §480, on `navj-club-fx2` (fixture scripts `.probe/nav-journeys/fx-fixnow2.mjs`; no league admin or owner
    who coaches exists in it, said in the walk).
- 2026-11-07 — **13b build prompt written** ([CLUB_TIER_STAGE13B_BUILD_PROMPT.md](CLUB_TIER_STAGE13B_BUILD_PROMPT.md), two sessions: A the
  homes, B the arrival). Owner chose 13b before 13c (the band is already drawn and ruled, Ask 2 = A; 13c needs a fresh drawing round).
  **The drawing's rule "built only from figures the product already has" is true for cash on hand and the calendar only:** owed
  to the club has no org-wide house league total or combined figure, and "families owing" and "forms missing" are not counts anywhere.
  The brief's "no money (C04)" reason (money known-wrong until Stage 3) has expired, so the band may show money; it reads from its
  own route, not the brief. **Four decisions go to the owner in the build's summary:** who sees the band (recommended owner + admin),
  "players" not "families", what "Needs someone" carries (recommended: only what "This morning" does not), and the band's cost
  (own route, after the morning counts). Also found: the "added" email sends every role to the Overview; the added email does not
  escape the club name. **Next:** the owner's answers in the Session A summary, then Session A.
- 2026-11-07 — **13b Session A BUILT** (the homes; Session B, the arrival, not started). `/simplify`, `/review` (high) and
  `/marketing` done; the commit hash goes here when committed. **Owner rulings carried:** the band is for the owner and a club admin on a
  Club plan; "players", never "families"; it reads from its **own route, asked only after "This morning" has rendered**; "Needs someone"
  carries all three lines (no head coach, house league players owing, forms missing); the PLAYERS ghost tile is not built; the league
  admin's and the registrar's "This morning" sits on the **season page**, not the Overview; the header "Setup · n of 5" chip (F-O1-8) is
  deferred into the admin header bar drawings. **A1 the club band** ("The club today", above "This morning"): Cash on hand
  (`clubCashOnHand` over the club's own books), Owed to the club (teams: `owedByTheTeams` over the same `allocationsOf` the summary reads;
  house league: `seasonMoney(...).owing` summed over live seasons), This week (`readClubCalendar`), Needs someone. Each tile is read only
  for a reader who holds the gate of the page it opens; one that cannot is **absent**. A tile built from two reads says "Didn't load" when
  either failed. No new "owed" query (the one-definition guard still passes). Files: `lib/club-band-view.ts` (types + every word),
  `lib/club-band-read.ts`, `app/api/admin/club-band/route.ts`, `ClubBand.tsx`, `lib/families-read.ts` (`clubFormsMissing`: the Families
  list's rule, once per roster row with a family). **A2 "Still to do":** the checklist route now allows owner or admin (read only; a
  group-limited admin is refused because the list is the whole club's); step words moved to `lib/club-setup-words.ts`, shared with the
  setup page. **A3** `lib/league-morning.ts` + `LeagueMorning.tsx` on the season page (league admin: To review, Teams; registrar: To
  review, Still owing, Waitlist; live seasons only, by the product's own `seasonGroup` rule; new `summary.oldestPendingAt` on the
  season route). **A4** `InstallAppPrompt` `skipFirstLanding` on the admin layout (browser storage, one mark per surface and browser; no
  column). **Review fixes:** group-limited admin refused the checklist; forms count aligned to the list (rows with no family are not in
  it); "Next:" skips a booking that has already ended; /simplify folded four tiles into one component. **Words (/marketing):** "The club
  today didn't load.", "see each team's standing", "rep-team forms missing", and "Ask the owner" for a step an admin cannot open (the
  drawing said "Waiting on the owner"; the permission check does not know who owns the step). **Owner questions left open** (also on the
  walk): the band shows cents and the league tiles whole dollars; "This week" is the next seven days, not Monday to Sunday; "Owed to the
  club" adds all-years team dues to live-season house league and opens only the teams half; "5 players owe" counts a child once per live
  season; a member whose browser never held the install mark is spared the banner once. **Walk A: §485** (43 steps on the dev copies
  `navj-club-s13ba` and `navj-club-s13ba-fresh`; fixtures in `.probe/stage13b-a/`). No migration, no column; no `NAV_STANDARD` change.
  **Next:** the owner walks §485, then Session B.
- 2026-11-07 — **13b Session B BUILT** (the arrival). `/simplify`, `/review` (high), `/marketing`, `/legal` and `/docs` done;
  committed `7d88d591d` 2026-11-07. **Owner rulings in the summary:** the coach accept-path fix goes in this build; the owner and an admin also see the
  other roles' Help paths, folded; every non-board path ends with "What your role can open". **B1** no default role: the invite's
  Role field starts on "Choose a role", Send is off until one is chosen; the line under it is the picker's own sentence with
  **no prefix** (/review: "Written to them: …" was untrue for a volunteer, whose email carries the job note, and an admin); the
  Staff kit's `?invite=volunteer` still presets Volunteer; setup step 1 links `?invite=open` **only while open** (/review: a done
  step's outline button must not pop the invite). **B2** both emails carry `memberOpensSentence` (the "added" email turns "You'd"
  into "You'll"; a volunteer's job note stands in for it) and the product line "FieldLogicHQ is the online system {club} uses for
  things like registration, schedules and results." (/marketing's nouns, /legal's "for things like"); `ROLE_EMAIL_LABEL` now says
  "admin" and "league admin"; the "added" email escapes the club name; the resend uses the same sentence. /legal
  (`docs/agents/legal/CASL_MEMBER_INVITE_EMAILS.md`): not commercial messages so long as no plan, price, offer or buy link joins
  them (a guard holds it); two pre-existing findings for the owner: the Reply-To reaches no inbox, unaccepted invitations stay.
  **B3** the "added" email's link is `destinationAfterAccept` (the sign-in resolver) with a this-club fallback; the
  **coach-branch check came out real**: `getDestinationForMembership` had no coach branch, so a coach re-opening an old
  invitation landed on the club's empty Overview while sign-in sends them to the Coaches Portal; now both say the portal. **B4**
  Help: each path names the roles it belongs to; the reader's own opens by default; owner/admin get the others folded under
  "The first steps of the people you invite"; no own path → all folded as before; the note under the guides no longer claims
  a role filter (platform admin's hub shows no note). Help: the invite recipe in the org guide split into four sub-topics (no
  default role, what each email says, where each role lands). Guard: `tests/unit/club-stage13b-arrival-guard.test.ts`.
  **Walk B: §489** (37 steps; dev copies `navj-club-s13bb` and `navj-club-s13bb-fresh`; fixtures `.probe/stage13b-b/`; sends
  real email to `fieldlogichq+s13bb-*@gmail.com`). No migration, no column; no `NAV_STANDARD` change.

## 11. The external review, cross-checked (2026-11-07)

Source: `CLUB_TIER_PRODUCT_IA_REVIEW.md` (an outside reviewer's first look; its IDs are written **R-F-nn** here so they
never collide with the hub's F-IDs). Each claim was read against the cited code, this plan, the hub, the readiness plan, the
Stage 9 and 12 plans, `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` and the Business Decisions Log; the claims the verdicts turn on
were reopened first-hand.

### 11.1 New findings (not in any plan before today)

| ID | Sev | Finding | Review | Goes to |
|---|---|---|---|---|
| F-XR-1 | High | The coach is told the club **never** sees their families' payments (the coach Money › Club foot line, Rep teams' "What the club sees", the rep-teams help), while the club's **Families** page shows every club-owned rep family's dues, paid and balance to anyone with Families access. D1 (2026-11-06) ruled the *books*; Families (Stage 5, 2026-10-17) was never weighed against the sentence. A promise the product doesn't keep is a defect, not wording to soften. | R-F-08, Ch. 4, Q2 | Owner ruling (§11.4 #1), then `/legal` (a promise about families' information), then fix-now 2 — **BUILT, committed `bac14d456`** |
| F-XR-2 | High | Only an owner or admin who coaches gets the Coaches Portal's **Admin** door back. A treasurer, league admin or registrar who coaches gets none, on the desktop sidebar, the phone bar and the More sheet. The workspace switcher, the review's workaround, appears only with two or more places, so a one-club treasurer-coach has no way back at all. (The hub's could-not-assess list named it "unconfirmed live"; it never became a finding.) | R-F-16 | fix-now 2 — **BUILT, committed `bac14d456`** |
| F-XR-3 | Low | Setup step 4 asks for "a tagline and a contact email" and ticks itself on the tagline alone. Either the tick checks the email or the step stops asking for it. | R-F-22 | fix-now 2 — **BUILT, committed `bac14d456`** (owner ruled: the tick needs both) |
| F-XR-4 | Low | Nothing tells a person who coaches in both programs why house league opens a team page and rep opens the Coaches Portal (both destinations are ruled, 9c·1). One line. | R-F-06 | fix-now 2 — **BUILT, committed `bac14d456`** |
| F-XR-5 | Med | Ask 12 ruled that "cancel this day across programs" would get its own plan. That plan was never written. (Rainout cancelling games only is ruled, 9e·10, and is not this.) | R-F-04 | `/plan` — its own plan; 13c references it |
| F-XR-6 | Med | F-O6-12 (an empty Calendar week names the next event) was recommended in the hub and never given a stage. | R-F-19 | 13c |
| F-XR-7 | Med | F-O4-1 (no club-level "next season" door; no roll-all for the rep teams) was ruled "a rep teams item, not in Stage 13" and no plan owns it. | R-F-13 (first half) | `/plan` — a rep-teams item |
| F-XR-8 | Low | From Families, an admin who is also that rep team's head coach finds the rep half of a payment disabled and is sent to Player dues. Owner question: let the record through in that one case? | R-F-15 | Owner question, later |
| F-XR-9 | Low | Owner question never asked: may the club supply a **missing guardian contact** on a rep player (distinct from the coach's player data)? Today only "Ask the coaches" (Stage 2/5 ruling). | R-F-14 | Owner question, later |

Unverified lead, not a finding yet: a tournament's "+ New venue" may write a venue outside the club's venue book (R-F-05). Check
it in 13c. The single-row Approve with no confirm (R-F-07's aside) is already the hub's own (L-walk; see the 2026-11-06 walk slip).

### 11.2 Already on our list (the review agrees; nothing to add)

| Review | Ours | Where |
|---|---|---|
| R-F-01 signed-in family app | `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stages 4–5 | Open: consent words, the owner's switch, re-check the guardian link after Stage 14 S6 |
| R-F-02 permits hidden; dates-off strands bookings | F-A4-3, F-A4-4, F-O6-3 → Asks 1 + 13 | 13c, ruled |
| R-F-03 league admin dead end, silent hand-off | F-L4-1 → Ask 14 | 13d, ruled (Tools ⋯ itself ruled 9d-2) |
| R-F-09 Accounting Overview omits house league owed | F-T5-1, F-T5-7, F-O6-8 | 13d + 13b's club band |
| R-F-10 double bill; two "Outstanding" figures | F-T2-4 (High); F-O6-5 (labelling, not money) | 13d; 13e |
| R-F-11 invited admin and the checklist | F-A1-4 | 13b (owner's steps read-only, not "admin completes them") |
| R-F-12 self-serve signup can't buy Club | Readiness item 1b; this log's session-3 entry | `/plan` + `/strategy`; Club not on sale |
| R-F-17 receipts | F-T3-2, F-T4-2 | New item, shape question open (file storage) |
| R-F-21 reminders; offline part refunds | F-R3-7, F-R4-2 | Shape questions open |
| R-F-23 Overview pulse | F-O6-1 | 13b, drawn and ruled |

### 11.3 Where the review is wrong or meets a ruling

- **Wrong on the code:** R-F-18 (a calendar event opens a read window with both sides of a clash, a "From" link to the club
  schedule and a door to the team's schedule); R-F-20's redirect (`/{org}/schedule` goes to the running tournament or "not
  found", never the rep-teams page); R-F-11's second half (fixed in fix-now, `2a33cc98a`, walk §473).
- **Ruled, with reasons the review didn't know:** tryout emails removed (2026-08-26); clashes between programs warn, never
  block (Stage 6a: no volunteer gets a veto over another program); rainout = games only (9e·10); practices never public (Stage 9);
  the coach owns the roster and dues (D1/D3, Stage 5c); house league part-payments cut (2026-10-19); house league coaches get a
  team page, not the portal (9c·1); a family's account comes at team placement and the pay link stays (2026-10-31); the fiscal
  year and the season meet on a split's season (D2, Stage 3c); a tryout runs on the working season, cost written on the ask
  ("roll early or wait", readiness Stage 2 Ask 1(a), 2026-09-28).
- **Misplaced:** Challenge 5's "parked" item is the *public* top-tab frame, not the admin sidebar; the admin keeps "Club
  overview" first in a tournament (13i).

### 11.4 Owner decisions, in the order they unblock work

1. **F-XR-1 — make the coach's promise true. RULED 2026-11-07 as recommended; `/legal` approved the words with one correction.** Recommended: keep Families (chasing is why it exists) and rewrite the coach
   lines to say what the club sees. The alternative, hiding rep dues in Families, undoes Stage 5's Chased and Owes views. Blocks
   fix-now 2's copy item; `/legal` reviews the new words.
2. **Spring tryouts (review Q4 / Ch. 2) — reopen Ask 1(a) or not.** Recommended: not on the review's word; the evidence on file
   puts tryouts after the season. Reopen if a real customer's sport runs tryouts before its playoffs, and then frame it as "which
   season do tryouts belong to", never a second live season (the two-state ruling and the history guard both forbid it).
3. **Rep dues online (review Q1) — where it sits in the billing sequence.** Already ruled "a possible 12e, its own drawing
   round". Design catch to state on the ask: club-collected money landing in a team's own book meets D1.

Not owed: review Q3 and Q5 are ruled; re-check Q5's *reason* only if the owner doubts it.

### 11.5 Where the new items go

- **Fix-now 2** (one session, no drawing; build prompt after decision 1): F-XR-2, F-XR-3, F-XR-4, and F-XR-1's copy. It touches
  the Coaches Portal's doors and one checklist rule. It does not sit on 13i's admin sidebar.
- **13c** gains F-XR-6 and the "+ New venue" check, and references F-XR-5's plan.
- **13b, 13d, 13e** unchanged; the review confirms them.
- **Owned elsewhere:** F-XR-5 and F-XR-7 (`/plan`), Club self-serve (`/plan` + `/strategy`), rep dues online (Stage 12 → 12e),
  the signed-in family app (`SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stage 4 — the thing that actually fixes the review's Journey H).
