# Club Tier Stage 13c · The club's time in one place (build prompt, three sessions)

> Written 2026-11-08, after the owner ruled the 13c drawing's asks **C1–C7 all A** (from the drawing page's paste-back).
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session A of @docs/projects/active/CLUB_TIER_STAGE13C_BUILD_PROMPT.md` (then B, then C).
>
> Drawing (the spec): https://claude.ai/artifact/1zgUwZhAAFEr4yZ1UNYQCJ, source
> [CLUB_TIER_STAGE13C_DRAWINGS.html](CLUB_TIER_STAGE13C_DRAWINGS.html) (frames rendered by the script at ~552–889, asks ~976–990,
> "settled from the code" ~1021–1042). Drawing prompt: [CLUB_TIER_STAGE13C_DRAWING_PROMPT.md](CLUB_TIER_STAGE13C_DRAWING_PROMPT.md).
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (entries of
> 2026-11-08: the drawing round, and the C1–C7 rulings). Standing rules: `docs/agents/design/NAV_STANDARD.md`.
> Marks: **[V]** = the planner opened it (file:line, 2026-11-08); **[H]** = a helper's read, **re-open before editing**. Line numbers drift.
> Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus (the nav every club role shares,
> a new count read on every club screen, the bill's figure).

## What 13c is

**A club's time runs Permit → Schedule → Fair shares and the bill → Send, and 13c makes that one visible path, and makes a change at
one end tell the other.** Three sessions, one per end of the path:

- **Session A · the permit (C1, C2):** Permits becomes its own place in the sidebar for the five roles who can open permits today,
  out of Organization › Venue library. A permit whose dates off took bookings says so, lists them by day with a door to each, and the
  form counts what is booked on a date off as it is picked.
- **Session B · telling people away from the permit (C3, F-XR-6):** the owner's and admin's "This morning" card "Outside the permit · N",
  the same N on the Permits row, the Calendar's day mark, the house-league season's Schedule health lines, and an empty Calendar
  week that names the next event.
- **Session C · the schedule page is the path (C4, C5, C6):** the permit is a door in the schedule's top line; a Needs attention row for
  the pulled dates; the band's Bill tile opens Fair shares and the bill, which leave the View menu; the Slots column reads "25 of 65";
  the league admin's sentence drops "in Schedules".

The rule everywhere is the standing one for clashes between programs (Stage 6a): **warns, never blocks.** Nothing here stops a save,
moves a booking by itself, or tells a coach or a family anything.

## Owner rulings this build carries

Already ruled before the drawing, not re-asked: **Ask 1 A** (a Permits place between Calendar and Schedules), **Ask 12 A** (cancel a day
across programs is its own plan, not 13c), **Ask 13 A** (the permit lists what sits on its removed dates).

- **C1 = A** Every role that can open permits today gets the Permits row: **owner, admin, league admin, registrar, treasurer.** Owner
  10 → 11 rows, admin 9 → 10, league admin 4 → 5, registrar 4 → 5, treasurer 3 → 4. Nobody loses the list when the Venues | Permits
  switch goes.
- **C2 = A** The permit lists **only the bookings its own dates off took**, grouped by day with doors, shown while they stand and gone when
  moved. The Oct 11 removal of "Outside it" stays respected (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md:44-52` [H]): the list must **not**
  widen to everything at the park.
- **C3 = A** A "This morning" card **"Outside the permit · N"**, only while true, the **same N on the Permits row**, plus the schedule's
  Needs attention.
- **C4 = A** **The page is the path.** The permit becomes a door in the schedule's top line, the Bill tile opens Fair shares and the bill
  (which leave the View menu), Send stays in Needs attention. **No path line.**
- **C5 = A** The Slots column reads **"25 of 65"** per team and **"175 of 450"** in total.
- **C6 = A** Drop "in Schedules" for anyone who cannot open Schedules, **now**; 13d adds the "Ask for time" button (no names listed).
- **C7 = A** The tournament-side venue match (R-F-05) is **its own small item, not 13c.** Do not touch the tournament admin.
- **13i's "the sidebar never grows" is amended by these rulings, not broken.** The rail still lists places only; Permits is a place. Write
  that into `NAV_STANDARD.md` N2 (its list "Overview, Calendar and Schedules sit unheaded at the top" becomes Overview, Calendar, Permits,
  Schedules), citing Ask 1 and C1. Do not record it as anything more than that.

## ⚠ Where the drawing and the code disagree, or the drawing is silent (read before the summary)

1. **Nothing computes "bookings on a permit's dates off" today.** The save returns only `{ success: true, id }`
   (`app/api/admin/org/permits/route.ts:192-204` [V]). `permitUse` (`lib/permit-time.ts` ~397-438 [H]) simply skips a day off, so a booking
   on it drops out of Held and Booked silently. `permitAnswer` (`lib/permit-time.ts` ~173-237 [H]) **does** mark one booking as on a
   date off (~224-233), and the Calendar's booking window already shows it (`lib/club-calendar.ts` ~425-432 [H]). The bookings themselves
   come from one reader, `readClubBookings` (`lib/venue-clash-lookup.ts` ~354-364 [H]: rep events less cancelled and tournament mirrors,
   tryout sessions, league games and practices less cancelled/postponed, linked tournament games).
   **So the build writes one function, "what this permit's dates off took", on top of `readClubBookings` + `permitAnswer`, and every
   surface in all three sessions calls it.** No new booking query, no second definition of "on a date off". Its definition is the
   one the Calendar's booking window already uses. **Check, do not assume:** a booking on a date off that **another** permit still
   covers is not outside a permit. If `checkClubPermits*` (`lib/permit-lookup.ts` ~217-266 [H]) already answers across permits, use it.
   If it does not, the function must, and say so in the summary.
2. **"Gone once the days have passed."** The drawing's notice goes when nothing is left on those days **or the days are past.** The function
   reads dates off from today on only. That also keeps the count cheap.
3. **The count rides on the brief, and the brief loads on every club screen** (it feeds the rail counts: `ClubBriefProvider.tsx` ~162 [H];
   route `app/api/admin/club-brief/route.ts` ~90-140 [H]). The same lesson as 13b's decision 4: **measure it.** The read is bounded: the
   club's permits with a date off today or later, then the bookings on those days only. If it adds more than a couple of small reads to
   every screen, **stop and report** with the alternative (the count on the Overview and the Permits page only, the rail pill read
   with the Overview). Never ship a rail that waits on it.
4. **The drawing's frames carry more than the seven asks:** the form's live "Booked that day" line, the Calendar's day mark, the
   league admin's Schedule health lines, the schedule's "Take Dec 5 and Dec 12 off" button and its "Different on a date" rows, and the
   bill's "was". They are on the ruled page and are built. They are listed per session below so none is dropped and none is invented.
5. **The bill's "was $200.00".** Because a date off shrinks the permit's held hours for the same cost, the bill rises without a word.
   That is the drawing's point ("the permit now holds 24 hours for the same $800.00"). Show a "was" **only where the product stored the
   earlier figure** (a bill that rides with the schedule, `view.bill` [H]). If there is no stored figure, the tile shows today's bill and no
   "was". Never recompute a past figure to fill the line. The bill's definition does not change. If it would, stop: that goes to the
   owner.
6. **Header Phase 3 rewrites the same two pages** (`ADMIN_HEADER_BAR_PLAN.md:460-468` [V]: Calendar and Schedules name themselves in the
   bar, and the heading's actions move to the toolbar). 13c Session C edits the Schedules page's toolbar (the View menu) and its top
   line. **Do not run Session C beside a Phase 3 build** in the shared tree. Either order works; whichever lands second re-reads the
   other's diff first.
7. **The week view is shared.** `WeekView` (`ClubCalendarViews.tsx` [H]) is also used by the house-league season schedule page. Put the
   empty week's "Next:" line on the **Calendar page**, not in `WeekView`, so the season page is unchanged.
8. **11b of the scheduler plan** reads "DRAWN, NOT BUILT" at `CLUB_PERMITS_AND_SCHEDULER_PLAN.md:1470` [V]. The house-league time
   window it led to exists (`HouseLeagueTimeWindow.tsx`, which shows the C6 sentence [H]), so the status line looks stale. Confirm before
   Session C. If an 11b session is still unbuilt and touches the schedule page or Fair shares, sequence against it the same way as item 6.

### Decisions for the owner (put them in the summary, build around them, wait for the answer before building the piece they touch)

1. **The form's "Why (optional)" placeholder.** The drawing marks it "owner's call in the build": "The dome is closed" → "e.g. a city
   event". **Recommended:** change it. A permit's date off is the city's, and "the dome is closed" reads as the club's own.
2. **The Calendar day mark for the registrar.** The drawing gives the registrar the day mark and the Calendar door, read-only. Nothing
   to ask unless the census finds the registrar's Calendar hides venue detail. If it does, ask.
3. **Any role beyond the five that can read permits today.** `GET` refuses only `coach` (`route.ts:66` [H]). If staff or volunteer
   members can read permits today, C1 named five roles and did not rule on them. **Stop and ask**; do not give them the row.

## Before any code: the plain-language summary (required, blocking)

Present a product-manager summary first, per session: what each person (owner / admin / league admin / registrar / treasurer; and
"coaches and families: unchanged") sees differently, on desk and phone. Put the owner decisions above to the owner. Order the work
so a piece waiting on an answer does not hold the rest. Session A starts with the shared function (disagreement 1), because B and C
call it.

## Session A · the permit (C1, C2)

Screens touched: the club sidebar, the phone bar's More sheet, **a new Permits page**, Organization › Venue library, the permit window,
the permit form.

### A1 · The shared function (disagreement 1)

One server function: for a permit (and for the whole club), the bookings its own dates off took, **today on**, grouped by day with each
booking's time, name, program line ("House league · U11 Pinto · draft"), kind (Game or Practice) and the door to it. It is built on
`readClubBookings` + the permit answer, with `permitUseOf` (`lib/permit-server.ts` ~163-176 [H]) as the precedent for reading a permit's
span. One route returns it for a permit; the brief's count (Session B) calls the same function. Guards: a source test that the module
holds **no `.from('…')` of its own**, and unit tests on the drawing's case (Kinsmen Park, dates off Dec 5 and Dec 12 → 8 bookings: 6
practices and 2 house-league games, and the postponed third game **not** counted), a moved booking dropping out, a past date dropping
out, and a booking another permit still covers.

### A2 · Permits is a place (C1)

- **Rail:** a new row **"Permits"** between Calendar and Schedules, for the five roles, unheaded like its neighbours. Owner/admin:
  Overview, Calendar, Permits, Schedules, then Programs, Club. League admin: Overview, Calendar, Permits, House league, Organization.
  Treasurer: Overview, Permits, then Club (Accounting, Organization). Registrar: Overview, Calendar, Permits, House league, Organization.
  Inside a tournament the row does not show, the same as Calendar and Schedules (`kitCalendarLink` / `kitSchedulesLink`,
  `lib/admin-kit-nav.ts` ~246-277 [H], is the pattern).
- **Icon:** the drawing's document-with-a-check glyph, new to the icon dictionary, **checked at 14px against its neighbours** (N5;
  `NAV_STANDARD.md` ~29, 41-47 [H]). MapPin stays Venue library's.
- **Phone:** the owner's More sheet gets **"Permits" at the top of its list**, above Tournaments. It is not a fourth tile, and it takes 2
  taps instead of 4. The sheet lists the sidebar's groups less the bar and tiles, so Permits at the top needs its own top group
  (`lib/admin-kit-nav.ts` ~386-425 [H]; `AdminKitBottomNav.tsx` [H]). The treasurer's sheet has Permits above Organization. N7 says a
  place's pages are never sheet rows; Permits is a place, so it is a row.
- **The page:** a new route for the Permits place. **Move** the list from the venues page's `?view=permits` (`app/[orgSlug]/admin/org/venues/page.tsx`
  ~98-99, the list at ~124-139, bands ~79-86, desk table ~304-346, phone rows ~347-372, Export ~272-302, Add ~176-181, windows ~460-512 [H]);
  do not copy it. The header bar reads "Permits". A one-page place draws no tab band. Toolbar: the "Fiscal year" pill, Export, "+ Add
  permit". Columns as drawn: Permit · Where · Dates · A week · Used · Cost. Keep today's bands (In use now · Starts later · Ended). The
  treasurer gets no Add and no pencil; Cost follows today's money gate (`canMoveClubMoney`, `lib/member-access.ts` ~76 [H]); saving
  follows `canSaveVenueLibrary` (`lib/venue-library.ts` ~25-29 [H]). The page's gate is the venues page's gate, unchanged.
- **Venue library keeps the venues** and loses the switch. **The old address keeps working:** `/org/venues?view=permits` sends the person to
  the Permits page (bookmarks, help links, the schedule's "permit" links, export catalog entries). Find every link to it
  (`lib/export/catalog.ts` ~992, `scripts/pdf-documents.mjs` ~1535 name the venues page [H]) and point it at the new page.
- **The row flag (NEW):** on a permit's row, a warn glyph and "2 dates off · 8 bookings on them". The row opens the permit with its notice.
  The treasurer sees the flag.

### A3 · The permit window's notice (C2)

At the top of the window, amber left rule (the drawing's words, ported as drawn):

- "**8 bookings are outside this permit now: Dec 5 and Dec 12 are dates off.**" / "They stay booked until someone moves them."
- Day groups ("Sat, Dec 5 · Kinsmen Park"); each row: time · name · program line · chip "Game" or "Practice" · chevron, opening the booking.
- Doors, **each only for a reader who can open it:** "Fix the 6 practices in {schedule name} ›" (owner, admin); "Open {season}'s schedule ›"
  (owner, admin, league admin); "See {day} on the Calendar ›" (everyone with a Calendar; not the treasurer). **A door the reader cannot
  open is absent, not greyed.** The treasurer reads the list with no doors.
- Fine print: "Only what this permit's own dates off took. The list goes when nothing is left on those days."
- Gone when nothing is left on those days or the days have passed. Failed read: "What's booked on the dates off couldn't be read. Try again."
- **RESTYLED:** the schedule the permit started becomes a door: "{schedule} › hands this time out, so the permit stays." (today quoted
  text, `PermitWindows.tsx` ~850-860 [H]).
- Phone, full screen: the same heading and sub-line; the rows fold under "All 8 bookings ▾"; the doors are 44px rows ("Fix the 6 practices ›",
  "Open the house league schedule ›", "See Sat, Dec 5 on the Calendar ›"), then the Use band.
- Unchanged: the facts, "The time" ("Dates off: Dec 5, Dec 12."), Cost, Use, Previous/Next.

### A4 · The form counts as the date is picked

Under each date off in the form (`PermitWindows.tsx` ~346-368 [H]), live: "**Booked that day:** 3 practices and 2 house-league games. They
stay booked until moved." / "Nothing booked that day." / "Checking what's booked…" / on failure "What's booked that day couldn't be
checked. The date off is saved." Autosave and the "Saved" toast stay as they are. The count calls A1's function for one day; debounce
it, and cancel a superseded read (the scheduler's preview already learned this, `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ~1463 [H]).
Placeholder per owner decision 1.

### Session A guards and records

- Re-pin: `tests/unit/admin-kit-nav.test.ts:396-402` [V] (the five rail lists gain `permits`), the people fixture
  `tests/unit/_club-people.ts` ~16-42 [H], `tests/unit/nav-standard-guard.test.ts` ~431-461 [H] (phone parity: the sheet must reach
  Permits; leave the BEFORE bar/tiles snapshot alone; the icon check ~55-56).
- Breaks on purpose: `tests/unit/club-stage6b-screens-guard.test.ts` ~209-212 (the switch's limes) and `club-permits-guard.test.ts` ~181 and
  `export-masthead-guard.test.ts` ~40-42 (the workbook brand on the venues page) [H]. Move each pin to the new page; do not delete it.
- New: a twin of the "inside a tournament neither club row shows" test (`club-scheduler-screens-guard.test.ts` ~58-83 [H]) for Permits;
  a door matrix for the notice (five roles → which doors); A1's tests.
- `NAV_STANDARD.md` N2 (and N7's sheet example if it lists rows) per the rulings above.

## Session B · telling people away from the permit (C3, F-XR-6)

Screens touched: the Overview ("This morning"), the Permits row's count, the Calendar (List, Week, Month, the empty week), the
house-league season's Schedule health.

### B1 · "Outside the permit · N" (C3)

- **This morning (owner, admin):** a new card after the four that exist (it wraps to a second row): title "Outside the permit" with the door
  arrow, count "8" in ink, text "bookings on Sat, Dec 5 and Sat, Dec 12 · Kinsmen Park". **Shown only while N > 0**, the same rule as the
  extra cards (`ClubHubKit.tsx` ~248-262 [H]). Door: one permit → that permit with its notice; two or more → Permits. Every brief card is a
  door only for someone who can open it (`club-stage1-screens-guard.test.ts` ~174-181 [H]); this one is too. "Still to do" is unchanged (a
  permit problem is not a setup step).
- **The Permits row (owner, admin only):** the same N as an amber count pill at the row's end (N9, `NAV_STANDARD.md` ~34 [H]), from the brief
  (disagreement 3). Phone: the same count on the More sheet's Permits row. Nobody else gets the pill.

### B2 · The Calendar's day mark

On a day a permit took (List, Week and Month): a chip "Outside the permit" and "See the permit ›" in the day header (to the permit with its
notice), and a 14px warn glyph beside each booking still standing, whose tooltip and window text is the sentence the booking window already
ships ("Outside …: Sat, Dec 5 is a date off.", `lib/club-calendar.ts` ~425-432 [H]). The postponed game is not marked. Same function as A1.

### B3 · The league admin's Schedule health

On the house-league season schedule page (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` [H]), Schedule health gains
a line per game on a pulled date, each with "Give it a new date": "Hawks vs Owls, Sat, Dec 5, 11:00 a.m. · Diamond A: the club's permit no
longer holds Kinsmen Park that day." (small "U11 Pinto · draft"; a game on house league's own time adds "· on house league's time, which the
club takes back when it sends its changes" as drawn). It reads **what is booked at the park that day** (A1's function), not what the
schedule handed out. "Give it a new date" opens the season's existing move-a-game path; no new editor.

### B4 · An empty week names the next event (F-XR-6 / F-O6-12)

On the Calendar page (disagreement 7), above the days: "Nothing is booked this week. Next: **Mon, Nov 16 · Harbourtown Invitational** Go to
that week ›"; the List view gets the same "Next:"; nothing within six weeks → "Nothing in the next six weeks"; with filters on, it names the
next **matching** event. Export stays disabled. Phone: below the "… · nothing scheduled" lines, a row "Next: **Mon, Nov 16 · Harbourtown
Invitational** ›" jumping to that week. **Reuse the band's next-booking reader** (`lib/club-band-read.ts` ~95-106 [H], 13b's This week tile);
no new calendar query. Clock via `formatTime()`, dates via the house date formatter.

### Session B guards

The card's gate matrix (owner, admin see it; the others do not; N = 0 → absent); the brief's count calls A1's function; the Calendar's
"Next:" calls the band's reader; the house-league season page's week view is unchanged (a snapshot or source pin).

## Session C · the schedule page is the path (C4, C5, C6)

Screens touched: one schedule's page (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`), the band (`FairShares.tsx`), the bill window,
the New schedule / Settings window's "Who, and how much", the house-league time window and generate-games window. Precondition: Session A
committed (the permit page the top line opens). Sequence against Header Phase 3 (disagreement 6).

### C1 · The top line opens the permit (C4)

`meta` (page ~558 [V]; words `lib/club-schedule-words.ts` ~637-639 [H]) reads: "From the permit **{permit name} ›** · {park} · {facilities} ·
{weekdays, span} · sent {date} by {person}", the permit's name a door to the permit. No path line.

### C2 · Needs attention: the pulled dates

In `ScheduleAttention` (page ~561-564 [V]), a new row while the schedule's permit has dates off that took its slots (the count heading goes
up by one: "2 items"):

- Chip "Outside the permit"; title "{day} and {day} are dates off on the permit".
- Body as drawn: "6 practices on this schedule sit on those days: 14U AA, 15U AA and 13U AAA, both Saturdays. The teams still have them." /
  the bill line (disagreement 5: only with a stored earlier figure) / "2 house-league games on Dec 5 are for the league admins to move. See them ›".
- Primary button **"Take {day} and {day} off"**: adds those days to the schedule's own Dates off (the Settings path, `timePayload`,
  `lib/club-schedule-server.ts` ~752-760 [H]) and opens the **existing** Regenerate confirm. It writes nothing else by itself.
- "Send the changes" drops to outline while this row is open (the first ask takes lime). Send stays in Needs attention.
- The warnings list gets this first: "Outside the permit: {day} and {day} are dates off on {permit}." "Different on a date" gains a row per
  day: "{day} · every facility" / "Outside the permit · {n} slots still on it" (the drawing's count "6 differences").
- Today a schedule copies its permit's dates off once, on the client, at creation (`NewScheduleWindow.tsx` ~268-287 [H]) and nothing
  re-syncs. **13c does not add a sync.** The button is the bridge until Ask 13's one shared dates-off list (not this stage).

### C3 · The Bill tile opens Fair shares and the bill (C4)

- The band's tile (`FairShares.tsx:114-119` [V]: "The bill" when `showBill`, else "Open") becomes a door when the reader holds money: "THE
  BILL →", the figure, and "was {figure}" per disagreement 5. It opens **Fair shares and the bill**: today's Fair shares team detail
  (`FairSharesTeams`, page ~628-630 [V]) with its bill door (`billDoor` / `billTeamsDoor`, `FairShares.tsx:136-137` [V]), in a window,
  not a lens.
- **The View menu loses Fair shares:** `desktopViews` (page ~541-545 [V]) becomes Overview, Grid, By team, By group. Remove the `fair` lens and
  its branch. The band and the per-view `FairSharesLines` stay as they are.
- A reader without money keeps the "Open" tile; give them a way to Fair shares' team detail (the tile opens it without the bill). Do not leave
  anyone with no route to a view they have today. Phone has no band and no Fair shares lens today (`!isPhone && fair`, page ~565 [V]); the
  phone is unchanged, and say so.
- `CLUB_SCHEDULE_LANDING_UX_PLAN.md` made Fair shares a View tab: mark that task superseded by 13c C4 in that plan.
- The scheduler plan's open "Bill vs The bill" line (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ~1116 [H]) sits in the same spot: read it, and say
  in the summary whether C4 settles it or leaves it.

### C4 · The Slots column (C5)

In "Who, and how much" (`NewScheduleWindow.tsx` ~713-722, 840-872 [H]): per team **"25 of 65"**, group rows "75 of 193" / "100 of 257", total
"7 teams · 175 of 450", where the first figure is what the daily practice limit allows and the second the share. With "No daily limit", or when
the limit limits nothing, the cell is the plain share. The note "275 slots left open at 1 practice a day." stays. The drafts' "7 teams short"
warning with its reason and a door back is drawn on the hub's tab 13 and goes with this column [H]: **read the hub's tab first**; build it
only if it is drawn there. C5 is the New schedule column. The page's By team / By group "Slots" and Fair shares' renamed column
(`colSlots`, `lib/club-schedule-words.ts` ~513, `sharedCount` ~694 [H]) keep their meaning; do not change them under the same word without
saying so.

### C5 · The league admin's sentence (C6)

`noneGivenLeagueAdmin` (`lib/league-time.ts:523` [V]) and its sibling `noneLeftLeagueAdmin` (`lib/league-game-generator.ts:447` [V]) both end
"…, in Schedules." For a reader who cannot open Schedules: "The club hasn't given house league any time yet. An owner or an admin gives it."
(and the sibling likewise). A reader who can open Schedules keeps today's sentence and door. Both windows that show it
(`HouseLeagueTimeWindow.tsx` ~202, `GenerateGamesWindow.tsx` ~264 [H]). **No "Ask for time" button and no names: that is 13d.**

### Session C guards

Re-pin `club-scheduler-screens-guard.test.ts` ~379-388 [H] (the View menu without `fair`); new: the top line's permit door, the Needs attention
row's gate and its button writing only the schedule's dates off, the Slots format at "25 of 65", the C6 sentence by gate.

## Help, words, layout (each session does its own; the walk is once)

- **Help** (`/docs` after each session; the census [H]): `lib/help-content/org.tsx` `places-and-tabs` (~328, the rail list gains Permits),
  `club-calendar-t-clashes` (~687, "Permits live in the Venue library"), `club-schedules` (~758, ~780 "stays linked to it", which holds for
  prices but not later dates off: reword; ~784), `club-schedules-t-who` (~798, Slots), `club-schedules-t-page` (~871-874),
  `club-schedules-t-fair` (~911-921) and `club-schedules-t-bill` (~930, the Bill tile path), `venue-library` (~1064-1078, the switch
  sentence), `venue-library-t-who` (~1085), `venue-library-t-permits` (~1123-1127), `venue-library-t-add-permit` (~1143),
  `faq-venue-library-permit-cost` (~1215). Permits likely wants its own article, with the venue library's permit keywords (~1070-1074)
  moving to it. `accounting.tsx` `budget-allocate` (~703); `house-league.tsx` `house-league-time-t-given` (~962, C6). Search words move
  with the prose. One spelling: `npm run check:spelling`.
- **Demos:** there is no club sandbox (`lib/demo-org.ts` ~102-118 [H]: the tournament and coach demos only), so there are no tour anchors
  to move. Nothing to do; demos follow the product.
- **Layout** (`check:layout --changed` on the dev server per session, then the staging sweep once, after Session C, per
  `.claude/commands/release.md` §1d-5): re-path `admin-org-permits`, `-permit-window`, `-permit-add` (`scripts/layout-screens.mjs` ~1536-1540
  [H], on `/org/venues?view=permits` today) to the new page; re-path `admin-schedule-bill` (~1580-1581, it clicks "Bill the teams") to the Bill
  tile; add the permit window with its notice, the Overview with the card, and the empty Calendar week. Each needs a fixture with dates off
  that took bookings.
- **/legal and /accounting:** neither applies. No email, no new data about people, no change to what FieldLogicHQ charges. The club's bill
  definition must not change (disagreement 5); if it does, that is the bug.

## After each session

- **Reviews:** `/simplify` (Session A adds a shared function and a new place; likely), then `/review` (high for A: the nav every role
  shares and the old address; standard for B and C).
- **Records:** a status-log entry in the Stage 13 plan §10 per session (what was built, where it departed from this prompt, the commit
  hash once committed); one line in the PM brief; the TODO Stage 13c line; `NAV_STANDARD.md` (Session A). No migration and no column
  are expected; if one appears, the data dictionary and snapshots go in the same unit of work.
- **Restart:** the dev server needs a restart before hand-off after Session A (new route and files) and after any session that adds a file.

## The walk (once, after Session C)

One walk, one purpose, its own Owner QA Ledger section (**the next free §**; §495 is the highest today [H]), as a checkable Artifact with a
paste-back, on a fresh Harbourtown copy whose December permit has Dec 5 and Dec 12 off with the drawing's 8 bookings standing. Purpose: **a
date pulled off a permit reaches everyone who must act, and the path from permit to Send is walkable.** Steps by role (owner, admin, league
admin, registrar, treasurer) on desk and phone: the Permits row and its count; the old address landing on Permits; the notice, its doors per
role, a booking moved and the list shrinking; the form's live count; the Overview card appearing and going; the Calendar's day mark and an
empty week's "Next:"; the league admin's Schedule health lines; the schedule's top-line door, its Needs attention row and "Take … off" into
Regenerate, the Bill tile into Fair shares and the bill, the View menu without Fair shares; the Slots column; the league admin's sentence.
Counts in the walk come from the fixture, never from this prompt.

## Not in this build

- R-F-05 / C7, the tournament's venue match (its own item, tournament side). The tournament admin and both coach portals are untouched.
- 13d: "Ask for time" with names, the bill reaching the treasurer, the league admin's "Club time". 13e: the two "Outstanding" figures.
- Cancel a day across programs (Ask 12, its own plan, not yet written). It will attach to the Calendar day header and add a fourth notice
  door, "Cancel what's on these days". Leave room; draw and build nothing.
- One shared dates-off list (Ask 13's end state); a sync from permit to schedule.
- Free time by week across permits (F-O6-4): a possible later "By week" choice in the Permits toolbar. Leave room; build nothing.
- Telling coaches directly. That is the drawing's named risk, not a proposal.

## Words for /marketing (one pass, before the walk)

- [ ] "Permits" (the row), the row flag "{n} dates off · {n} bookings on them": the sidebar and the Permits page
- [ ] The notice's heading, sub-line, fine print, doors and failure line: the permit window
- [ ] "Booked that day: …", "Nothing booked that day.", "Checking what's booked…", the failure line: the permit form
- [ ] "Outside the permit" (card, chip, warning) and the card's text: Overview, Calendar, schedule page
- [ ] "Nothing is booked this week. Next: …", "Nothing in the next six weeks": the Calendar
- [ ] The Schedule health line and "Give it a new date": the house-league season
- [ ] The Needs attention row, "Take {day} and {day} off", the Bill tile's "was": the schedule page
- [ ] The league admin's sentence without "in Schedules": the house-league time windows
