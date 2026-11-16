# A schedule on several permits — Implementation Plan

> **Status:** Planning. Planned 2026-11-13 (owner asked: several permits per schedule, an "any permit" finder, per-venue
> dates off, an admin choice of per-permit vs one-rate billing). Nothing drawn, nothing built.
> **Created:** 2026-11-13
> **Branch:** dev
> **Sequence (recommended, owner to confirm):** draw after the Stage 13c walk (§502) and its layout sweep; **build after
> Stage 13d and before 13h** (§9). Do not build while the late-bill Money-audience work is in the working tree (same
> files).
> **PM brief:** `CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md`
> **2026-11-13 · drawing prompt written:** `CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWING_PROMPT.md`. **Owner: the build does
> not start until Stage 13d is built and committed.**
> **2026-11-14 · RULED, BUILD PROMPT WRITTEN:** the 20 asks, **all A except P9 = B** (owner's reason: a permit added later is "basically a new
> separate permit that wants to be part of the same schedule": earlier payments stay the same and only the new amount is added to the teams
> it touches; no recalculation; so the drawing's "gap said in the Send window" sentence is dropped). Build prompt:
> [CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md](CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md), five sessions + a close, order **A → B → D → C → E**.
> 13d is committed and walk §528 PASSED 47/47 on 2026-11-14 (no findings), so Session C's gate is met. (Was: Session C waits for that walk to pass or its findings to be fixed.) P12 A: the Permits-page
> "Free time" view is a later door, not built here.
> **2026-11-13 · DRAWN, round 1:** https://claude.ai/artifact/GLdh4E19UsKzBkLdH9UACU (source
> `CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html`). Drawn on one two-town fixture computed in the page (Milton $40,
> Halton Hills $60, a June permit added May 10, four rep teams). `/ux` (9 findings) and `/design` (6) applied before
> publishing. **20 asks owed** (S1, P10, P9, P1–P7, P7b, P11–P13, N1–N6; P8 answered by the standing "only Send the
> changes" rule). Recommendations that differ from this plan: Add time sits **beside** Settings… (S1); "Find the time"
> is a door under the picker, not a picker entry (N1); the mixed-places line goes (N2); no "Show time held by drafts"
> toggle and no new Finalize warning, since the send's clash check already catches a second draft (P7). Drawn against
> 13d's ruled plan (13d not built). Build prompt follows the owner's rulings.

## 0. Goal

A club's season sits on whatever permits the towns issued: three months plus a fourth on a second permit; two towns'
parks for one house league. Make one schedule hold all of it, so that:
- several permits can be picked, and a permit can be **added later**;
- time can be **found across every permit** by narrowing filters;
- a date off can name its venues;
- the bill to rep teams prices each slot **per permit** or at **one rate**, as the admin chooses.

Throughout, keep the scheduler's settled shape: the schedule owns its own time (copied, never pointed at); prices follow
the permit; a sent schedule changes only through Send the changes; bill terms never change once made.

## PM Brief

See `CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md` (the pair's brief). In one line: one schedule per season, however many
permits it sits on, with time found by "what do I hold on Tuesday nights?" and bills that match what each town charges
(or one rate, if the club prefers).

## 1. Owner's asks (2026-11-13, conversation)

1. Several permits per schedule. Examples: a fourth month on a separate permit; permits from two towns for a house
   league.
2. **Billing: let the admin choose** between per-permit pricing and one blended rate.
3. **Dates off: a window to choose which venues** a date off applies to, defaulting to all.
4. Agreed: the Outside-the-permit warning, the permit's "used by" list and its delete guard, and the New schedule
   picker all learn several permits.
5. Agreed, plus: an **"Any permit"** start that lists every diamond and field the club holds and narrows as criteria
   are added ("the next 3 months" → "Tuesdays and Thursdays" → "6–8 p.m." …).
6. The owner's framing question, which this plan answers in §5: *how connected should permits → schedules → dues be,
   and how flexible to modification?*

## 2. What the code does today (verified 2026-11-13; lines move)

- **One permit link** per schedule: `club_schedules.started_from_permit_id`, plus `bill_permit_id` (the permit pricing
  the bill), both single FKs ON DELETE SET NULL (`DATA_DICTIONARY.md` ~:1866-1888). No join table.
- **Time is copied.** Picking a permit copies its dates, blocks (venue, facilities, weekdays, hours), and dates off into
  the schedule's own `org_time_blocks` / `org_time_dates_off` (`NewScheduleWindow.tsx` `fromPermit`/`pickPermit`
  ~:281-294). **Picking a second permit replaces the first one's time.** The Permit select appears only on create
  (`!editing`, ~:545), so the link can't change afterwards; regenerate never passes it.
- **A permit already covers several venues** (Ask 1 of the permits plan, `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` :433),
  and a schedule's blocks are per venue. A hand-entered second venue isn't possible in the form (the single Venue select
  disappears once rows are mixed).
- **Prices come from ONE permit.** `readPrices(orgId, permitId)` (`lib/club-schedule-server.ts` ~:307) returns
  `weightOf(facility)` (Full 1 / Half 0.5), `fullHour` = permit cost ÷ the permit's full-field held hours (its own
  dates off excluded; `fieldPrices`, `lib/permit-time.ts` ~:285), cost, name, and budget line. Callers use
  `bill_permit_id ?? started_from_permit_id`: the engine's weights (generation, slot room, hand edits), save, the
  schedule view's `pricing`, the bill (`BillWindow`, `fairBill`, `readBill`), send (`contextFor`), the coach's review
  card and hand-back figures (`lib/club-schedule-coach.ts`), and the export notes.
- **The bill:** rep teams only (house league is never billed). The only split is "by the time each team got": priced
  minutes = minutes × field weight ÷ teams in the slot; total = Σ priced minutes ÷ 60 × `fullHour` (or a typed "part"
  amount); shared by largest remainder. **One stored rate** `club_schedules.bill_scale` (cents per full-field minute)
  prices every later correction. It lands at Finalize or on a late bill as `rep_cost_allocations` +
  `rep_allocation_splits` + installments on each team's running season. Coaches see it on Money › Club. **It never
  reaches family dues.**
- **After Finalize:** edits wait for Send the changes, which bills gains as correction allocations at `bill_scale` and
  credits losses. Bill terms are refused on a final schedule.
- ⚠ **Regenerate keeps only locked or hand-moved slots.** On a final schedule, any unlocked slot can be reshuffled,
  **past days included**; the only protection is "Lock {week}" first. There is **no "extend" concept**: moving the end
  date regenerates the whole range. (Finding F1, §6.)
- **Dates off are schedule-wide:** `org_time_dates_off` rows carry `schedule_id` (or `permit_id`), day and note, with
  no venue, unique per (schedule, day). Saving deletes and reinserts them. A permit's later dates off reach a schedule
  only through Needs attention's "Outside the permit" → "Take … off" (13c Session C), which reads
  `started_from_permit_id` only.
- **Usage already ignores the link.** Hours used (`permitUse`), the "outside a permit" check (`permitAnswer`), and the
  calendar marks match bookings against **every** permit by venue and time, so time a schedule uses on a second permit
  already counts there. Draft and in-review slots are **not** counted as booked anywhere.
- **No free-time computation exists.** Nothing combines several permits' time and subtracts bookings into free windows.
  The engine does this for one schedule's own blocks only. 13c parked "free time by week across permits" (F-O6-4) and
  "one shared dates-off list; a sync from permit to schedule" (`CLUB_TIER_STAGE13C_BUILD_PROMPT.md` "Not in this
  build"). **This plan is where those parked items land; do not build parallel versions.**
- **Facilities record their kind:** `org_venue_facilities.facility_type` is `diamond|field|court|rink|gym|other`, so
  "all my diamonds" is a real filter.
- **Plans:** permits = `hasOrgVenueLibrary` (league, club, club_large); scheduler = `club_scheduler` min `league`;
  billing needs Money (`canMoveClubMoney`, in practice Club bands). None of these plans is on sale
  (`PLAN_PRICING_FACTS.md`).
- **Corrections from the drawing session (2026-11-13, opened in the code):**
  - A time row has **no visible place**: Days, From, Until only; its place is kept out of sight and mixed places show
    as one read-only line above the rows (`NewScheduleWindow.tsx` ~:556-624). Rows that show their place are new.
  - Field weights are not only Full 1 / Half 0.5: since 2026-10-11 a field can be "A percent" of a full field. One
    rate keeps each field's weight.
  - The late-bill Money-audience build is committed (`507f4505b`, `39eb59955`) and changed only the send engine and the
    Send window, not New schedule or the Bill window (§9 item 1 is met).
  - New schedule is absent at phone width by ruling (Schedules page header, §5.9), so Find the time and Add time are
    computer-only with no phone message.
- **The permits plan's §8** listed "paying for time per slot" as not in the first cut. Read in context, that is
  per-slot *payment* (pay as you book), not per-permit pricing. Confirm in the drawing session (Ask P13).

## 3. The idea that holds it together: each row of time remembers its permit

Rather than a list of "the schedule's permits" kept in step with its time by hand:
- **Every block of time a schedule holds remembers which permit it came from**, or none for time typed by hand.
- The schedule's permits are the distinct permits behind its rows. That set drives the top line ("From Town of Milton
  2027 and Halton Hills Spring ›"), the permit window's "used by", the delete guard, and the Outside-the-permit check.
- A **slot's price** is the price of its row's permit: the weight of its facility on that permit, and that permit's
  full-hour rate. Two permits covering the same field and hour are resolved by the row's own permit, never by a lookup.
- **Picking, adding, or finding time** all just add rows that carry their permit. The New schedule picker, "Add time"
  on an existing schedule, and the finder are three doors to one action.
- Hand-typed rows (no permit) price from the schedule's **fallback price permit** (today's `bill_permit_id` role, for a
  no-permit schedule billed at a permit's price), or bill only by a typed amount.

This keeps the 2026-10-12 reason for the link ("a club's second year wants both": last year's teams on this year's
permit, `CLUB_SCHEDULER_COPY_OPENING_SCREEN_MOCKUP.html` :515). Copying a schedule and then picking permits still
works; it just accepts more than one permit.

## 4. The pieces

### 4a. Several permits on New schedule
- The Permit select becomes a multi-pick. Each permit **adds** its rows (venue, facilities, days, hours, its date
  range) and its dates off; removing one removes only its rows. The From/To dates widen to cover every picked permit.
- Rows show their place and their permit ("Kinsmen Park · Diamond 2 · Town of Milton 2027"). The read-only venue line
  for mixed places stays, and gains the permits.
- **"Any permit — find the time"** is the first choice in the picker (§4d). "No permit" stays for typing time by hand.

### 4b. Add time to a schedule that exists
- A schedule-page action, **Add time** (Settings… stays for changing what's there). It opens the same picker: one or
  more permits, or Find the time.
- **It schedules only the new rows.** Drafts are generated for the new time and the teams' targets, and no existing
  slot moves, locked or not. The end date widens if needed.
- On a **draft or in-review** schedule, the new slots join the drafts. On a **final** schedule, they wait in "Changed
  since sent" and go out through **Send the changes**, which bills them as a correction: per-permit mode at the new
  permit's price, one-rate mode at the stored rate (Ask P9).
- **Remove a permit**, the inverse: allowed freely before Finalize. After it, the permit's future slots go out through
  Send the changes (credits as today), and past slots never move.

### 4c. Dates off with venues
- Each date off gets **"Applies to: All venues"**, a small window listing the schedule's venues with All ticked by
  default (owner 2026-11-13). Untick a venue to keep practising there that day.
- A date off copied **from a permit** applies to that permit's venues, not every venue (Ask P5). Town A's long-weekend
  closure leaves Town B's park alone.
- Needs attention's "Outside the permit" reads **every** permit behind the schedule, and its "Take … off" adds the day
  for that permit's venues only.
- Generation and hand-edit warnings honour the venue scope. A date off that names venues blocks only slots there.

### 4d. Find the time (the "any permit" finder)
- It starts as **every facility the club holds on any permit** in a date window (default: today → three months on),
  shown as one list: facility · venue · permit · hours free in the window.
- **Filters narrow the list as they're set** (owner's example):
  - when: From / To;
  - days: weekday chips;
  - hours: From / Until, with optional extra ranges;
  - kind: diamond, field, court and so on, from `facility_type`;
  - where: venue or town (the permit's issuer);
  - shortest useful block (for example, 60 min).

  Each row says how much matching time is left ("Tue & Thu 6–8 p.m. · 18 evenings free of 24").
- **Free means held minus taken.** Taken is everything `readClubBookings` already counts (finalized practices, house
  league games and practices, tryouts, tournament games), plus **other schedules' drafts**, shown as "held by a draft
  (Spring rep)" (Ask P7). The permit's own dates off are never free.
- **Pick rows → they become the schedule's time rows**, each carrying its permit, then the ordinary flow continues
  (slot length, changeover, teams, Generate drafts).
- First cut lives **inside New schedule and Add time only**. A standing "Free time" view on the Permits page (13c's
  parked F-O6-4) is a later door onto the same reading (Ask P12).

### 4e. The bill: each permit's price, or one rate
- **The Bill window gains "Price the time":**
  - **Each permit's price** (default): a slot costs what its permit charges for that field. A team on Town B's $60
    diamond pays more per hour than a team on Town A's $40 one.
  - **One rate for all**: every team pays the same hourly rate, whichever field it got.
- **The total is the same either way** (recommended definition, Ask P1). One rate = (the per-permit total) ÷ (all
  priced hours). The choice changes only how the total is shared between teams, so the bill's closing row ("matches the
  permit costs / the club covers $X") is unaffected.
- "Part" (a typed amount the teams pay) still works. With Each permit's price it is shared in proportion to each
  team's priced dollars; with One rate, by priced time (today's behaviour) (Ask P3).
- **What's stored:** the chosen mode, plus a **rate per permit** at the moment the bill is made (one-rate mode stores a
  single rate). Corrections price new or lost time at the stored rate of the slot's permit. "Terms never change" holds:
  the stored rates are the terms.
- House league is never billed (unchanged). Family dues are untouched (§5).

## 5. How connected, and how flexible (the owner's framing question)

The chain is **permit → schedule → team's bill**, and it stops there by design.

| Link | Connected how | Flexible how |
|---|---|---|
| Permit → schedule's **time** | Copied once, per row; the row remembers its permit | Add time, remove a permit, or edit rows in Settings…; a permit edited later is **not** pushed in (that would move sent practices silently), it is **surfaced** in Needs attention for every permit behind the schedule, with one-click "Take … off" (today's rule, widened) |
| Permit → schedule's **prices** | Live until the bill is made, then stored per permit | Before Finalize, a permit's price change moves the bill; after, the stored rates hold and only corrections move money |
| Schedule → team's **bill** | Made once (Finalize or late bill), corrections after | Terms fixed; one team's payment arrangement changes through the separate bill-amend project (`CLUB_BILL_AMEND_AFTER_MADE_PLAN.md`) |
| Team's bill → **family dues** | **Not connected** | The coach plans dues in their own book (owner 11-06: coach books stay the team's; the club sees one cash figure). Out of scope here; raise separately if wanted |

**Recommendation (Ask P8):** keep "copied, surfaced, one click" rather than a live sync. A sent schedule is a promise to
families; a permit edit should never rewrite it without a person pressing Send the changes.

## 6. Findings

- **F1 — regenerate can reshuffle already-sent past slots on a final schedule** (existing behaviour, §2). "Add time"
  must not share it. Recommend fixing it in this project's Session D: **a final schedule never moves a slot whose day
  has passed**, in regenerate as well as Add time (Ask P10).
- **F2 — dates off can't be per venue**, so a club with two towns gets one town's closures on both. Fixed by §4c.
- **F3 — the two-towns workaround corrupts the money.** Recording two towns' parks on one permit gives one cost and one
  issuer. After this ships, the permit help should steer clubs to one permit per issuer (/docs pass).

## 7. Asks for the drawing session (recommendations first)

- **P1** One rate = the per-permit total ÷ all priced hours (same total, re-shared). *Alt:* average of the permits'
  own rates (the total can then differ from what the permits cost).
- **P2** Default **Each permit's price**; the choice sits in the Bill window as "Price the time".
- **P3** "Part" with Each permit's price is shared by priced dollars; with One rate, by priced time.
- **P4** Two permits holding the same field and hour: the row's own permit prices it; the finder lists such time once,
  under both permits, and the admin picks which.
- **P5** A permit's copied dates off apply to that permit's venues only; dates off typed on the schedule default to all
  venues (owner ruled the default).
- **P6** Venue scope only (not facility-by-facility) for dates off.
- **P7** The finder counts other schedules' drafts as taken, labelled "held by a draft (name)", with a "Show time held
  by drafts" toggle.
- **P8** Permit edits after the schedule exists: surfaced, never pushed (§5).
- **P9** Add time on a final schedule: billed as a correction. Per-permit mode at the new permit's price; one-rate mode
  at the stored rate, with the closing row showing any difference the club covers.
- **P10** Fix F1 here: a final schedule never moves a past slot.
- **P11** Remove a permit after Finalize: future slots only, through Send the changes.
- **P12** The finder lives in New schedule and Add time first; a Permits-page "Free time" view later.
- **P13** Confirm the permits plan §8's "paying for time per slot" means pay-as-you-book, so this plan does not reopen
  it.

## 8. Phases

> Draw first (one session, a Claude Artifact HTML page, the house layout, `/design` before hand-off), rule P1–P13,
> then write a build prompt. Sessions below are the proposed build split; the drawing may reorder them.

### Phase 0 — Drawing and rulings
- [ ] Draw:
  - New schedule with several permits and "Any permit — find the time";
  - the finder narrowing (owner's 3 months → Tue/Thu → 6–8 p.m. example);
  - Add time on a final schedule through Send the changes;
  - the dates-off venues window;
  - the Bill window's "Price the time" with both modes on the same two-town fixture;
  - the schedule's top line and the permit window's "used by" with two permits;
  - a phone pass.
- [ ] `/design` on the drawing; rule P1–P13; write `CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md`.

### Phase 1 (Session A) — rows remember their permit; several permits on New schedule
> **Built 2026-11-14, committed `673670185` (2026-11-14)** (Session A of the build prompt; /simplify and /review both run, below). Mig **487** `487_each_row_of_time_remembers_its_permit.sql`
> applied to DEV twice (4 blocks took their permit, 0 left NULL; `tests/sql/several-permits-fixture.sql` 5/5); prod step
> in `MANUAL_PROD_STEPS.json` (count first, at the apply); /dba Finding #50 decided all three migrations' shapes.
> Guard 1: `tests/unit/club-schedule-several-permits-guard.test.ts`; the overlap rule `lib/club-schedule-permit-rows.ts`
> (+ its test). Schedule/permit unit tests 732/732. Not run: `check:layout --changed` (the shared tick-list field widened
> it to a 361-screen sweep, which never runs on the dev server, and the UAT club fixture was out of state); a browser
> pass on New schedule, the top line and the permit's "used by" is owed.
> **/simplify + /review (2026-11-14):** no Critical or High finding; one-permit and older schedules send the same time, weights
> and prices. Fixed before the commit: a request that never says a row's permit now keeps the stored one (only an explicit
> "no permit" clears it); the form's price permit is the first ticked permit that still has rows; ticking a permit at another
> venue moves the facilities with it. **Left open for the owner:** a partial-hour overlap drops the later permit's whole row for
> the shared days (hours the first permit never held are lost; trimming the hours would keep them). Left as Low:
> the backfill is not safe to re-run once the code is live (and the fixture does not test it); a permit deleted mid-save gives
> a 500 not "permit gone"; split rows can pass the server's 40-row cap; hints that over-claim ("came off", "widened"); the guard
> test misses camelCase readers. Not run: `check:layout`, `verify:changed` (other sessions' red ratchets: platform-admin styles,
> bank-table parity, index coverage). The commit left out the owner's Bill-window words and `.fixedValue` rule and the other
> sessions' pieces of the words, send and stylesheet files.
> **Decisions made in the build (owner may overrule):**
> - Two ticked permits on the same park and hour: the permit **ticked first** keeps the evenings; a later permit's rows
>   lose exactly those days, settled when the time is sent (`settleOverlaps`), never by cutting the rows the admin edits,
>   so unticking the first gives them back. The statement uses Add time's words, one per later permit and park.
> - A row takes its permit's own dates **only while several permits are ticked**; with one, rows follow the schedule's
>   dates exactly as before (so a one-permit schedule sends the same time it always did).
> - "+ Add hours" with permits ticked adds a **typed** row (no permit) at the last row's place, in a "Typed here" card;
>   it survives an untick (drawing: "a row typed here (no permit) … stay").
> - The price permit (until Session C) is the first permit ticked (`started_from_permit_id`); each slot's WEIGHT is its
>   own row's permit's share. A schedule billed from a permit none of its rows came from (pre-487) keeps that permit's
>   weights for every row, so no sent figure moves (0 such schedules on dev).
> - ⚠ Interim, accepted by the owner 2026-11-14: until Session C, a several-permit schedule's bill prices every hour at
>   the first permit's full-hour rate (each field still weighed by its own permit). Don't walk a several-permit bill
>   before C.
> - **Correction to the build prompt ("disagree" item 3):** the Overview, Calendar and house-league Schedule-health
>   readers never read the schedule's permit link (all three call `readDatesOffTaken`, which reads every permit the club
>   holds) — nothing to change there. The one single-column reader of Outside the permit was the schedule page's own
>   (`?outside=1`), now every permit behind the rows.
- [x] **Migration first:** `org_time_blocks.from_permit_id` (FK → `org_permits`, ON DELETE SET NULL; set only on
      schedule-owned blocks). Backfill from `club_schedules.started_from_permit_id` where the block matches the
      permit's venue and facilities, else null. Keep `started_from_permit_id` for one release as a read fallback, then
      retire it (decide with `/dba`). `bill_permit_id` becomes the fallback price permit for rows with no permit.
- [x] `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod), same unit of work.
- [x] `lib/club-schedule-server.ts`: `readPrices` → reads several permits at once; `weightOf(facilityId, permitId)`;
      `engineContext`/`buildEngineInput`/`draftToSave` weigh each slot by its row's permit; the save (mig 392 function)
      writes `from_permit_id` per block.
- [x] `NewScheduleWindow.tsx`: a multi-pick that adds and removes rows by permit; rows show their permit; dates widen.
      The `startedFromPermitId` body becomes a permit per row.
- [x] Reads that become "every permit behind the schedule":
  - `schedulesHandingOut` (`lib/permit-server.ts`) and the permit delete guard;
  - the schedule's top line / "From the permit ›" door;
  - the "Outside the permit" read (`[scheduleId]/route.ts` `?outside=1`, `lib/permit-dates-off.ts`
    `readScheduleOutside`);
  - the Overview, Calendar and house-league Schedule health readers of it.
- [x] Guard: a test that no reader of a schedule's permit uses a single column after this session.

### Phase 2 (Session B) — dates off with venues
> **Built 2026-11-15** (Session B of the build prompt; **committed `da0f39b53` 2026-11-15**, after the /simplify, /review, /dba, /docs, /design and /marketing passes). Step 0 (partial-hour overlap trim) **skipped**: the owner's ruling line was not pasted.
> Mig **488** `488_a_date_off_names_its_parks.sql` applied to DEV 2026-11-15; prod step `pending` (live `club_schedule_save` was 487's
> before the apply); `tests/sql/date-off-venues-fixture.sql` **5/5**, A's `several-permits-fixture.sql` still 5/5; prod step
> in `MANUAL_PROD_STEPS.json` (`pending`, after 487, before B's code); dictionary + snapshots (the hook refreshed them at the apply).
> **/dba Stage 3 review 2026-11-15: GO, one amendment** — the same-club trigger also refuses a park row on a permit's own date off (re-applied to dev; fixture check 5 proves it, still 5/5); the prod step gained a pre-check that prod's save function is still 487's. See Finding #50.
> **Table name:** `org_time_date_off_venues` (/dba Finding #50's name wins over this plan's `org_time_dates_off_venues`).
> Shape exactly Finding #50 "Mig 2 (B)": join table; venue FK **NO ACTION**; date-off FK cascade; `org_id`; PK
> `(date_off_id, org_venue_id)`; same-club trigger; RLS on, no policies, service role; indexes `(org_venue_id)`, `(org_id)`;
> the UNIQUE per (owner, day) stays. `club_schedule_save` re-made from 487 — the diff is the datesOff block plus three declared
> variables, nothing else.
> **What it does:** a schedule's date off names its parks (none = All venues; every existing one is All). One answer,
> `dateOffCovers` (`lib/permit-time.ts`), asked by `blockDates`, so the engine (generation, the regenerate, the hand-edit
> checks that re-cut slots) honours it; a permit's own dates off stay permit-wide. The form keeps ONE ROW PER PERMIT AND DAY
> (A's skip "the first wins" and "a day another permit has stays off" are gone) and merges to one per day at send
> (`mergeDatesOff` in `lib/club-schedule-permit-rows.ts`: All wins, else the union, first non-empty note); unticking a permit
> just drops its rows, so a shared day re-derives from the permits still ticked. A's /review F5 fixed: the "came off" hint
> counts only days whose date off really changed (`datesOffChanged`). "Applies to" is the shipped `PickField` with "All
> venues" first (N4 A), shown when the time uses more than one park or a date off already names one; under a permit's row,
> "From {permit}". The API: `venueIds` through `readTimeBody` / `timePayload`; left out (or null) stays unsaid and the save keeps
> the stored parks; the regenerate route fills an unsaid day from what is stored BEFORE cutting drafts
> (`datesOffKeepingParks`), so a stale tab neither widens the save nor cuts the drafts on All venues — proved through the TS path
> (`tests/unit/club-schedule-dates-off-venues.test.ts`, loading the real server module with the database stubbed).
> Needs attention: "Outside the permit" is one row per permit (`ScheduleOutside.rows`), counting only practices at that
> permit's parks, naming the permit when several are behind the rows; "Take {day} off {park}" adds the day for that permit's
> parks on the schedule (one-park schedules: All venues and the old words, exactly as before); a second row's button is
> outline. The document/export notes say a named date off's parks ("Sat, Mar 27 (Easter weekend, at Kinsmen Park)"). The Venue
> library refuses deleting a park a date off names (`venue_in_date_off`, its own sentence).
> **Guard:** `tests/unit/club-schedule-dates-off-venues.test.ts` (18 tests: the two-town fixture in generation, the
> Outside rule and the document; the merge; untick; the stale tab through `readTimeBody`/`timePayload`; the Needs attention
> words; the build guard — day-only readers of dates off exist only on the permit's side, `blockDates` asks `dateOffCovers`,
> every schedule reader carries the parks, mig 488's shape). `team-move-coverage` gained the table in STAYS (a club schedule's).
> **Decisions made in the build (owner may overrule):**
> - A permit's copied date off names that permit's parks **only while the schedule's time uses more than one park**; on one
>   park it is All venues (so a one-permit, one-park schedule stores and cuts exactly what it did; every date off now sends
>   `venueIds: []` on the wire). Consequence: a one-park schedule's copied date off is All, so a park added later is closed
>   that day too (Add time, Session E, may want to scope it then).
> - "Take … off" names the permit's parks **on this schedule** (its blocks' venues that the schedule's slots use).
> - A permit whose time holds no park gives an All-venues date off (it has no parks to name).
> - "Applies to" also shows on a one-park schedule when a date off already names a park (a copied schedule's, or one whose
>   other park's rows were removed), so a named list is never hidden; such a park stays an option in the field.
> - In Settings… a saved date off no longer knows which permit it came from (the database keeps one row per day, no permit),
>   so its "From {permit}" line shows only in New schedule.
> - The "Applies to" key is NOT drawn inside the button as the drawing has it: the shipped `PickField` labels above the
>   field, so the label is visually hidden in the row (kept for screen readers) and the button reads "All venues" /
>   "Kinsmen Park". A /design question.
> - New words: "Applies to", "All venues", "From {permit}", the permit-named head "… is a date off on {permit}", "… at {park}",
>   "Take {day} off {park}", the document's "(…, at Kinsmen Park)", the venue refusal "A date off on one of the club's
>   schedules names {venue}, so it can be archived but not deleted." — drawing words where the drawing has them; the last two
>   are new and want /marketing.
> **Not run:** `check:layout --changed` (a dev-server sweep; owed at the browser pass); a browser pass. `verify:changed`
> ran and is red on OTHER sessions' work (its `npm test`: 17,133 / 17,157 — the possessive guard on PlayerGuardiansCard, the
> tax-phrase guard on release notes/help, 13a doors A5, team-move coverage for `league_season_time_asks` and
> `platform_charge_tax_looks`, coach phone/practice/notification suites); since `npm test` stopped it, its later steps were run
> one by one: CSS purity, spelling, date correctness, snapshot freshness, manual prod migrations pass; schema parity is red
> with 488 as dev-only (expected until prod) plus others'; index coverage, CSS selectors and admin type are red on others'
> files, none on B's. Whole-project typecheck: clean. `lint:focused` on B's files: clean.
- [x] **Migration:** `org_time_date_off_venues` (one row per day with a venue set — /dba #50). Dictionary + snapshots.
- [x] Engine and hand-edit warnings honour the scope.
- [x] The New schedule / Settings… dates-off row gains "Applies to" (the tick-list field, N4 A; default All).
- [x] Copying a permit's dates off scopes them to its venues (P5); "Take … off" does the same.

### Phase 3 (Session C) — the bill: each permit's price or one rate
> **Built 2026-11-15, committed `3ee39edaa` 2026-11-15** (owner's go 2026-11-15; ran before D — no dependency between them). Mig **489**
> `489_a_bill_keeps_each_permits_rate.sql` applied to DEV (backfill: 2 billed schedules, 1 permit row each, at their
> `bill_scale`); prod step `pending` in `MANUAL_PROD_STEPS.json` (count first; ⚠ re-run the file right after the promote).
> `tests/sql/bill-rates-fixture.sql` 6/6. /dba **Finding #51** (2026-11-15): GO with one change — a billed schedule with NO
> rate rows prices every slot at `bill_scale`; thin `_priced` wrappers around the three bill steps (inner ones untouched,
> so old prod code works between the apply and the promote); the writer is no role's to call; the mode freezes once billed.
> **What it does:** `priceTheBill` (one price behind the time = exactly `billShares`, to the cent); each-permit vs one rate
> (same total); a part shared by priced dollars or hours; payments weighted by cost per period under each-permit; rates
> kept per permit in BOTH modes; corrections at each slot's kept rate (`keptRateOf`), a permit not behind the bill at its own
> FULL price, kept from that send (P9 B), the single-rate path unchanged when every slot bills at one rate; hand-backs
> counted at their slot's rate. Readers moved: page view + `pricing` (permits, combined cost, N6 "Bill from" default),
> Finalize / Send the bill / Send the changes, the coach's review card ("at each permit's price" / "at one rate" only on
> more than one price) and "what that practice cost", Fair shares (hours per permit), the printed notes, 13d's draft bill
> ("$X an hour" only at one price or one rate). Bill window: "Price the time" (absent at one price), the hints, captions
> by permit, the read-only view's kept rates and later-added permits. Send window: the new-permit-price line.
> **First check (P9 B item 3) PASSED:** a correction is already its own allocation with its own installments; earlier
> payments are never edited; a loss credits the latest unpaid installments. No stop.
> **Build default the owner may overrule:** on a bill with a typed PART, a permit added later bills at its FULL price (not
> the earlier discount) — /accounting (2026-11-15, out of its scope, product question) flags it as an owner question.
> Tests: `club-schedule-bill-several-permits.test.ts` (the money gate + P9 B arithmetic), `club-schedule-bill-rates.test.ts`
> (only `_priced` steps are called; N5: no payment is edited); four guards moved to the `_priced` names (two would have
> passed silently). Club + permit suites 2734 pass; 2 unrelated failures (SeasonFrame list mark, ClubHub tournament link —
> other sessions' files). Owed: /simplify → /review, dev-server restart, browser pass, commit, /marketing for the new
> sentences at the Close; the P9 B test through the real Send path is Session E's.
>
> **Owner call 2026-11-15 (Session C review run, Stage 3): KEEP FULL PRICE.** On a part bill (the club covers some of the
> cost), time on a permit added later bills at that permit's FULL price, kept from the send that first bills it — no
> carried-forward percentage. **Follow-up logged, NOT built (owner: "a schedule is not a set of permits"; one schedule should
> be able to hold permits that each carry their own billing conditions):** (1) a covered share set PER permit, chosen at the
> send that first bills a new permit (fits the kept-rate rows already built; replaces the full-price default with an explicit
> choice); (2) a permit that isn't billed at all (needs a stored "no charge" — today a rate must be above zero); (3) different
> PAYERS per permit (coaches vs house league, separate totals and installments) = several bills inside one schedule, a
> data-shape change — its own design session with drawings, not an extension of C. Levels 1–2 are the cheap pair; 3 is the project.
- [ ] **Migration:** `club_schedules.bill_price_mode` (`each_permit` | `one_rate`, default `each_permit`) and
      `club_schedule_bill_rates (schedule_id, permit_id null, scale)` written when the bill is made (Finalize and the
      late bill, `club_schedule_bill_late` mig 481). `bill_scale` stays as the one-rate value or is retired (decide with
      `/dba`). Dictionary + snapshots.
- [ ] `lib/club-schedule-bill.ts`: `pricedMinutes` / `billShares` per permit; one rate = per-permit total ÷ priced
      minutes; "part" shared by priced dollars or time (P3); `billCorrections` / `valuesAfterChanges` use the slot's
      permit's stored rate.
- [ ] `BillWindow.tsx`: "Price the time"; the fair-shares table shows each team's hours by permit when there's more
      than one.
- [ ] Every other bill reader moves to per-permit prices: `lib/club-schedule-send.ts` `contextFor`,
      `lib/club-schedule-coach.ts` (review card, hand-back figures), `lib/club-schedule-document.ts` export notes,
      `fairBill` in `lib/club-schedule-view.ts`.
- [ ] Money-arithmetic gate: a two-permit fixture where Each permit's price and One rate total the same and each
      team's shares add up to the cent.

### Phase 4 (Session D) — Find the time
> **Review run 2026-11-16 (simplify, then four-lens review; 0 Critical/High).** Applied: the finder ignores a finished row
> with no venue yet; Add found time moves a copy's shared venue like ticking a permit; Add is offered only on an answer to
> the filters on screen and counts only rows that can be picked; overlapping hour ranges are one range (touching ones stay
> two); the route refuses a non-object body and drops places not at the club's venues from the form's own rows; >40 rows
> says so; two drafts read in the plural; the isolation test catches any import form. **Ruled (owner, 2026-11-16): keep the
> widening** (other schedules' FINAL slots count as taken in the finder). **Owed — ONE `/plan` item for all three places
> that do not see other schedules' final time:** the permit's Used figure, the pick (a row spans first to last free day, so a
> day a final schedule holds in the middle still comes along), and the generator (never reads other schedules' final slots).
> **Left on purpose (recorded, not fixed):** the shortest block is applied per cut before days are joined (two touching
> blocks under a high minimum); "shared" days count two permits on a day even when their hours differ (the Priced-by choice
> then does nothing); draft-only overlap days skip the P4 choice; a date off inside a shared window comes off the unchosen
> permit too; a booking over three calendar days frees its middle day (same as Used); DST days mix wall and real minutes
> (same as Used); a part-free evening brings the whole row's hours; handed-back slots still count as taken; Find the time's
> tick-order widening of From/To after an untick; Priced-by is not undone by unticking.
> **Built 2026-11-16** (Session D of the build prompt; no migration). `lib/permit-free-time.ts` (pure:
> `freeTime`), `lib/permit-free-time-server.ts` (the reads), `POST /api/admin/schedules/free-time` (the scheduler gate, a
> read), `components/admin/kit/club/schedules/FindTheTime.tsx` (a level of New schedule), `rowsFromFound` in
> `lib/club-schedule-permit-rows.ts`. `subtractSpans` in `lib/permit-time.ts` exported (no second interval rule).
> Tests: `tests/unit/permit-free-time.test.ts` 14/14 (the owner's example as arithmetic: Diamond A 17 evenings held, 15
> free; Diamond B 4 held by a draft, 12 free; P4's shared days priced by the newer; hours, ranges, the shortest block, a
> no-facility booking, a facility-less venue, the empty states; guard 2: the module imports only `./permit-time`).
> Schedule/permit suites 556/557 before the screens-guard update, 557/557 after; typecheck clean (bar another session's
> `layout-run-journal` test); lint clean; spelling clean. Not run: `check:layout --changed`, a browser pass (dev-server
> restart first: new files).
> **Decisions made in the build (owner may overrule):**
> - ⚠ **Taken also counts other schedules' FINAL slots** (silently, as booked), not only drafts. `readClubBookings` never
>   reads `club_schedule_slots`, so a final schedule's house-league time the league has not yet divided into practices
>   (and its open slots) would otherwise be offered as free. Same gap in the permit's **Used** figure (`permitUseOf`) —
>   a finding, not fixed here (it would change a number the Permits page shows; route to `/plan`).
> - The time the form already holds (its rows, settled) is taken too, so the finder never offers it again; in Add time
>   (Session E) the schedule's own slots will be, via `scheduleId`.
> - A booking with no facility set takes every facility at its venue that hour (never offered as free).
> - A row's free minutes count only pieces at least the shortest block long (the drawing summed every piece).
> - Picking brings the permit's **dates off inside the found time** (tied to the permit, so unticking takes them away);
>   without them the drafts would land on days the finder counted as off.
> - A found row's permit shows as **ticked** without its other time (drawing "picked"); the first found time on a copy or
>   an empty form replaces the time, as the first permit ticked does (N3 A).
> - P4's choice is settled **in the rows** at the pick (`rowsFromFound` runs `settleOverlaps` with the chosen permit
>   first), so the send's own settling never undoes it.
> - P7b: a found row's draft-held days are said on its card per facility ("4 Thursdays on Diamond B are held by the draft
>   …"), and each draft in step 2 warns "N slots are given on days the draft … holds there" — matched by place and DAY,
>   so it can over-count a slot on a day the other draft held only part of the evening. Editing a found row by hand
>   drops its note.
> - Not drawn, built from the plan: **Where** (venues) and **Town** (issuers) chips, shown only with two or more to
>   choose; **Another time** (extra hour ranges). Words for `/marketing` at the Close.
> - Fixed on the way past: Session C's "Bill from" line and the export's one-rate note hand-built "’s" on a permit's
>   name; both now use `possessive()` (the possessive guard was red on them).
> - "Widen the dates" moves To three months on. "Clear the filters" (an empty result not caused by the days) resets
>   everything but the dates.
- [x] `lib/permit-free-time.ts` (pure): all permits' blocks in a window, minus the permits' dates off, minus
      `readClubBookings`, minus other schedules' draft/in-review slots (labelled). Filters: dates, weekdays, hours,
      facility kind, venue/issuer, minimum block. Unit tests on the arithmetic.
- [x] An API under `app/api/admin/schedules/` returning the narrowed list (owner/admin, the scheduler gate).
- [x] The finder inside New schedule ("Any permit — find the time"); picked rows become time rows with their permit.

### Phase 5 (Session E) — Add time, remove a permit, and F1
- [ ] A schedule-page **Add time** action reusing the picker and the finder; generate drafts for the new rows only
      (existing slots fixed for the run, whatever their lock).
- [ ] Final schedules: new slots wait in "Changed since sent"; Send the changes bills them per P9.
- [ ] Remove a permit (P11).
- [ ] F1: regenerate on a final schedule never moves a slot whose day has passed (P10).

### Phase 6 — words, help, check, walk
- [ ] `/marketing` once over the words below; `/docs` (Schedules and Permits guides: several permits, Add time, Find
      the time, dates off by venue, Price the time; F3's one-permit-per-issuer advice).
- [ ] `check:layout --changed` on the touched screens; `check:spelling`.
- [ ] `/simplify` and `/review` per session; an owner walk (checkable Artifact) on a two-town fixture with a four-month
      season.
- [ ] `/demos` at its next cycle (demos follow the product; they don't gate it).

## 9. Sequencing (recommended)

- **Not straight after 13c.** Three things touch the same screens first:
  1. **The late-bill Money-audience build** (`LATE_BILL_MONEY_AUDIENCE_PLAN.md`) is in the working tree on the send,
     bill and New schedule files. It must commit before this starts.
  2. **Stage 13d** puts the schedule's draft bill on the treasurer's budget line and warns before billing a line twice.
     It reads the bill this plan reprices. Build 13d first, so Phase 3 changes one bill under a settled reader.
  3. **The bill-amend project** (`CLUB_BILL_AMEND_AFTER_MADE_PLAN.md`) answers "terms never change" from the other
     side. **Draw the two in one sitting, or amend first**, so the stored per-permit rates and the amended payments
     don't get two answers.
- **Draw it now-ish** (after the 13c walk and sweep). A drawing touches no code.
- **Build after 13d, before 13h.** 13e (numbers), 13f (family actions) and 13g (phone header) don't touch it; 13h (one
  name per thing) runs last and should name this project's new words ("Add time", "Find the time", "Price the time").

## Architectural Decisions

- **Decision:** each schedule-owned block of time remembers its permit; the schedule's permits are derived.
  **Rationale:** one source of truth for which permit prices a slot; picking, adding and finding become one action; no
  list to keep in step with the rows.
- **Decision:** the time stays copied; permit edits are surfaced, not synced. **Rationale:** a sent schedule is a
  promise to families; only Send the changes may move it (existing rule, widened to several permits).
- **Decision:** one rate keeps the per-permit total. **Rationale:** the choice is about fairness between teams, not
  how much the club recovers; the closing row keeps one meaning (pending P1).
- **Decision:** the finder reads the same bookings the permits' "Used" already reads. **Rationale:** one model of
  taken time (the permits plan's "one model of time" guard).

## Words for /marketing

- [ ] "Any permit — find the time" — New schedule's Permit picker — club owner/admin
- [ ] "Add time" — the schedule page — club owner/admin
- [ ] "Price the time · Each permit's price · One rate for all" — the Bill window — owner/admin/treasurer
- [ ] "Applies to: All venues" — a date off's row and window — owner/admin
- [ ] "18 evenings free of 24" / "held by a draft (Spring rep)" — the finder's rows — owner/admin
- [ ] "From Town of Milton 2027 and Halton Hills Spring ›" — the schedule's top line — owner/admin/league admin

## Open Questions

- [ ] P1–P13 (§7), ruled in the drawing session.
- [ ] Should a team's club bill feed the coach's dues planning? Out of scope (§5). Raise separately if the owner wants
      it; it meets the 11-06 "coach books stay the team's" ruling.
- [x] `/dba` on the three migrations (per-row permit, dates-off venues, per-permit bill rates) and when to retire
      `started_from_permit_id` / `bill_scale` — **decided 2026-11-14, `DB_ARCHITECTURE_REVIEW.md` Finding #50**: mig 2 is a join
      table with a NO ACTION venue FK (a cascade would silently widen a date off to All venues); mig 3 keeps `bill_scale` as
      the one rate and the no-permit rate, and the rates table holds per-permit rows only (with the permit's name, SET NULL);
      `started_from_permit_id` retires in its own migration after C and E are on prod.
