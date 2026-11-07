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
  headings. `/design` ran before the hand-off (10 fixes applied: phone site button symbol-only per the 2026-10-20 ruling, the
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
