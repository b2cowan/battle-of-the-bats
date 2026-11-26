# Club schedules: part of a permit, teams at the same time, coach trades — plan

> **Status:** on the board (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `schedule-fields-trades`). Never restated here.
> **Created:** 2026-11-25 · **Branch:** dev · **PM brief:** [SCHEDULE_FIELDS_SAME_TIME_TRADES_PM_BRIEF.md](SCHEDULE_FIELDS_SAME_TIME_TRADES_PM_BRIEF.md)
> **Build go given for Stage 1 only** (owner 2026-11-25, with its six rulings: "go ahead and build"). Every later stage is
> drawn and ruled before it is built.

## 0. Why this exists

Three asks came out of the owner's demo with Milton Bats (2026-11-25), all about the club's winter dome schedule:

1. **Teams at the same time.** Some families have children on different rep teams. The club wants a rule that names
   several teams and has the builder try to put them at the same time, entered as often as needed, with a note at the
   end saying where it could not and why.
2. **Coaches trade time themselves.** A team asks another team to give, take or swap a time; the other team agrees; the
   club gets one notice and the money follows. Today a coach can only hand a practice back, and the club re-gives it by
   hand.
3. **A schedule on part of a permit.** On a permit for six fields, run a schedule on two of them for a period, and run
   a schedule on half of a field. The owner: "we need the ability to do both."

## 1. What the product does today (read from the code, 2026-11-25)

**Confirmed by this session (the lines were opened):**

- The builder places week by week; each team's weekly quota is its own deficit against its season share
  (`needsFor`, `lib/club-schedule-engine.ts`). Nothing ties one team's week to another's except the sharing rule.
- "Sharing a facility" (`rules.sharing`, `lib/club-schedule-settings.ts`) is the only rule about more than one team: 2
  to 4 teams in ONE slot on ONE full field, each counted and billed a fraction. A team may be in one sharing rule only.
  When a partner group cannot be placed together its teams are placed alone (`placersFor`, the `missed` → `alone` path).
- A slot is one field for one length of time. Several fields at one start is the normal case, so "same time, own field"
  needs no new capacity model.
- A half is a price share on the PERMIT, per field ("Full cost" / "Half cost" / "A percent", `lib/permit-words.ts`). A
  slot under full weight holds one team and is never shared (`slotRoom`). The two halves of a field are not two places.
- In New schedule, a permit's rows show their fields as text; the only controls are Days, From, Until and remove
  (`rowFields`, `components/admin/kit/club/schedules/NewScheduleWindow.tsx`). Fields cannot be unticked there.
- A coach may not write when, where or whether the club's practice happens (`CLUB_OWNED_API_FIELDS`,
  `lib/club-slot-event.ts`); the refusal reads "Only the club can move or remove this practice."
- At Send the changes, a team's gain is billed as a new correction and a loss is credited, at the rates the bill kept
  (`changesMoney`, `lib/club-schedule-send.ts`). A plain hand-back leaves the team paying; its minutes are added back
  so it is not credited twice (`measureWithHandBacks`).
- "Coaches trading slots with each other" is listed under "Not in the first cut (proposed)" in
  `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §8 and `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`. A deferral, not a ruling against.
- **A sharing rule that cannot pair is reported nowhere** (Stage 0, confirmed 2026-11-25). The draft card's only sharing
  sentence comes from the `sharing` measure, which lists the rules a shared slot came from; a rule that was never used
  drops off the card, and nothing counts the weeks a pair practised alone. A team placed alone counts and is billed a
  whole facility for that slot.
- **Placements dropped when the week's 12 attempts run out are reported nowhere** (`planWeek` returns `holdable(...)`
  with no flag). The seat reads as one more open slot and the team as one more short.
- With one permit ticked, a permit's rows are not held to the permit's dates (`settled` in `NewScheduleWindow.tsx`:
  `several` is false, so a row sends no dates). With two or more, each permit's rows keep to its own dates. **Changed by
  Stage 1 (S6, 2026-11-25):** one permit's rows now stop at its dates once From or To reach past them.
- The several-permits plan owes ONE `/plan` item: the permit's Used figure, the finder's pick and the builder do not see
  other schedules' final time (`CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md`, Session D review note).

**Leads from helper searches (NOT yet opened by a building session; verify before building on each):**

- "Find the time across every permit" lets the admin tick Field 1 and Field 2 only, and the row keeps its permit and
  price (`rowsFromFound`, `lib/club-schedule-permit-rows.ts`). Read from code, not run in a browser.
- Schedule From/To are not held inside the permit's dates on a one-permit schedule (a To typed past the permit's end
  cuts slots past it).
- The place-unique index is per schedule family, so two separate schedules can hold the same field at the same start;
  the builder reads bookings, never another schedule's draft or open slots. *(The index half is confirmed from the dev
  snapshot by the Stage 2 census, 2026-11-25. It is the only double-booking floor in the database, and it matches the
  same start only.)*
- Coaches read only their own team's slots; the one cross-team glimpse is the venue clash check.
- Hand back and take back need the schedule permission (assistants hold it by default); money asks need the team's
  money access; replying to a review is head coach only (`lib/coach-capabilities.ts`).
- A loss on a team that has already paid becomes a request to pay rather than a credit (`lostTime`).
- Coach notices from the scheduler are bell only; rep families are not messaged about a club slot change.
- The venue list has no parent or part-of-a-field idea. *(Confirmed by the census, 2026-11-25: `org_venue_facilities`
  has 8 columns in the dev snapshot, none of them a parent or a count.)*

## 2. Rulings (owner, 2026-11-25)

Recorded as ruled. Anything not in this table is a proposal (§3).

### 2a. Teams at the same time

| # | Ruling |
|---|---|
| R1 | **Build it as one more entry in "Add a rule"**, entered as many times as needed for different team groups. |
| R2 | **It tries; it does not guarantee.** The builder reports where it could not place a group together, and why. |
| R3 | **Same time means same place.** The teams are at the same start in the same building, each on its own field, each at full price. The bill does not change. |
| R4 | **A team's share stays the limit** (ruling 1 of `SCHEDULE_GAPS_PLAN.md`). The builder never hands a team extra time to match its partner; the report says so. |
| R5 | **No "adjacent fields".** The product does not know which fields are next to each other. |
| R6 | **A group that can never line up is caught when the rule is entered**, not at the end of a run. |
| R7 | **A hand move that breaks a group warns.** |
| R8 | **The report is per rule, and it covers "Sharing a facility" too**, if the check in Stage 0 confirms sharing falls back silently. (Confirmed 2026-11-25: it does.) |
| R9 | **The opposite, "never at the same time", is offered with it.** |
| R10 | **Named by teams only.** No mention of siblings or the board anywhere in the product. |

### 2b. Coach trades

| # | Ruling |
|---|---|
| T1 | **Two coaches' agreement moves the time, with no club approval.** The club gets one notice. This replaces "only the club can move a practice" for a trade between two teams on the same schedule. |
| T2 | **The bill follows the time**, at the rates the bill already kept: the receiving team is charged, the giving team credited, the club's total unchanged. |
| T3 | **The paid-in-full case still goes to the club's money person.** Where the giving team has already paid, the club would owe money back; that one piece is not automatic. |
| T4 | **Coaches may see other teams' times on the same schedule: team name, time and field only.** |
| T5 | **Who can agree:** anyone who can hand a practice back today, for a like-for-like swap; someone with the team's money access when what a team owes changes. |
| T6 | **What still blocks a trade:** a team in two places at once, and a field the club keeps for another group. Everything else goes through and is named in the club's notice, including a team going over its share and a broken "same time" group. |
| T7 | **A per-schedule switch** turns coach trades on or off. |
| T8 | **A coach taking an open slot nobody holds is left out.** There is no second team to agree, and ruling R4's source covers it. |
| T9 | **Like-for-like swaps are built before give and take.** |

### 2c. A schedule on part of a permit

| # | Ruling |
|---|---|
| P1 | **A schedule can run on some of a permit's fields, for a period.** ("We need the ability to do both.") |
| P2 | **A schedule can run on half of a field, case A:** the club holds the whole field and puts one team on each half, as separate slots. |
| P3 | **Case B too:** one half goes to this schedule and the other half to something else (another schedule, house league, or time the club does not hand out here). |

Case C (the club's permit is only for half the field) works today through "Half cost" and is unchanged.

## 3. Proposals (NOT ruled; each is an ask for its drawing session)

- **How P1 is done:** the Facilities ticks that typed rows already have, on a permit's rows in New schedule.
- **How P2/P3 are done:** a field in the venue list can be split into parts; every clash check knows the parts are the one
  field; a schedule row names the whole field or a part.
- **The owed "does not see other schedules" item is pulled into Stage 2**, because P3 and two schedules on one permit
  depend on it. (It is owed by the several-permits plan either way.)
- **Order:** tickable fields; halves and the same-time rule drawn together; like-for-like swaps; give and take. The rule
  counts free fields at a start, and two teams on the two halves of one field is a case it should handle, so building
  the rule before halves are settled risks rework.
- **Where the same-time rule ranks:** below the hard rules (days off, game days, shares, start and finish times, a
  team twice at once) and above the conveniences (the same field each week, rotation).
- **A team in both a sharing rule and a same-time rule:** refuse it on entry, as "a team in two sharing rules" is refused.
- **Different fields for different periods in one schedule** (Fields 1–2 in January, all six after): today only by using
  the finder twice. Whether rows get their own dates on the form is an ask for Stage 1's drawing.
- **A trade proposal lapses** if it is not answered before the practice.
- **Families:** rep families are not messaged about club slot changes today; whether a trade tells them is an ask for
  Stage 4's drawing.

## 4. Stages

Order is by dependency and rework risk. Every stage that changes a screen has its own drawing session (a Claude Artifact
page, through `/design` before hand-off) and its asks ruled before the build. Each drawing session starts in a fresh chat
from a prompt this plan carries.

### Stage 0 — Checks before any drawing (no code)
- [x] Confirm whether a sharing rule that cannot pair is reported anywhere on a draft (R8 depends on it). **Done
      2026-11-25: it is not** (§1). R8 therefore applies: the per-rule report covers "Sharing a facility". The only
      indirect sign today is the "12 · 8 shared" count on a team's row. An existing test covers the fall-back's
      placements (`tests/unit/club-schedule-engine.test.ts`, the 9U AA day-off case), nothing the admin reads.
- [x] Confirm the `holdable` drop is unreported. **Done 2026-11-25: it is unreported, and untested.** Whether the
      per-rule report names it is an ask for Stage 3's drawing. A helper lead, not yet opened: the "why" window does not
      model back-to-back days, so a seat dropped for that rule may be offered to the team that was just dropped from it.
- [x] Census every reader of a venue facility (permits, the builder, the clash checks, bookings, house league, tournaments,
      the public site) for Stage 2. Hand it to `/dba` with the two storage shapes in §5. Prompt: §4a below. **Done
      2026-11-25:** the census is under Stage 2 ("Census"). `/dba` proposes shape (B), reversing the earlier lean to
      (A), in §5. Still a proposal: the owner rules it in the halves drawing.
- [x] ~~Owner, in a browser: "Find the time" with two of a permit's fields~~ — superseded: Stage 1 built P1 on the form
      itself, and the owner checked that build in a browser (2026-11-25).

#### 4a. Prompt for the census session (fresh chat)

> Census for the club schedules plan, Stage 0's last item. Plan: `docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md`
> — read §1, §2c (P2, P3), Stage 2 and §5. No code and no migration in this session: the census, then `/dba`, then records.
>
> **The question.** P2/P3 let a club split a field into parts (one team on each half; or one half here and the other
> elsewhere). Today a facility is one place: one slot, one booking, one clash. Find EVERY reader in the product that
> treats a venue facility as a place, so the storage choice in §5 — (A) a part is its own facility row linked to its
> field, or (B) a field carries a number of parts and a slot names which part — is made knowing its full reach.
>
> **Cover at least:** the venue library and its windows; permits (time blocks, facility shares, "Half cost", free time,
> Used, the permit answer, dates off); the club schedule builder (`cutSlots`, `slotRoom`, sharing, value balancing,
> keep, the place-unique index, Find the time); every clash check (`lib/venue-clash*.ts`, the database floor, house
> league's and the coaches portal's); bookings and the club calendar; house league (fields, games, practices, its
> schedules); rep-team events and the coaches portal's venue list; tournaments (diamonds/fields, the schedule
> generator, brackets); the public site and exports; the demo seeds and UAT fixtures. Decide from the schema snapshots
> and `docs/agents/db/DATA_DICTIONARY.md`, never from migration files.
>
> **Use helpers for the reading** (CLAUDE.md "Broad reading and searching go to a helper agent"): split the areas
> across parallel Explore agents; open the cited lines yourself before recording anything as fact.
>
> **Produce** one table per area in a new section of the plan (Stage 2, "Census"): reader · file:line · what it reads
> (a facility id, a venue's facility list, a facility name) · whether it assumes one facility = one place at a time ·
> what shape (A) would need there · what shape (B) would need there. Then a short verdict: how many readers each shape
> touches, and which ones are risky (money, clash floors, anything a customer is billed or double-booked by).
>
> **Then run `/dba`** on the two shapes with the census in hand, and record its finding in §5 (still a proposal, not a
> ruling: the owner rules it in the halves drawing). Note any reader that makes "Sharing a facility" and halves give
> two different bills for the same picture.
>
> **Records:** the plan (Stage 0 ticked, the census, §5), the board line `schedule-fields-trades` in
> `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (that file holds other sessions' edits: change only this block, and
> commit only it). Commit at the owner's word. Finish with a product-owner summary: how far halves reach, the
> recommended shape and why, and anything that changes what the halves drawing must show.

#### 4b. Prompt for the halves and same-time drawing (fresh chat)

> Drawing session for the club schedules plan, Stages 2 and 3 drawn together (halves of a field, and teams at the same
> time). Plan: `docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md`. Read §1, §2a (R1–R10), §2c (P2, P3),
> §3, Stage 2 with its Census, Stage 3, §5 and the Open questions. **No code and no migration in this session:**
> drawings, `/design`, the asks, then records.
>
> **Why together.** The same-time rule counts free fields at one start, and two teams on the two halves of one field is
> a case it must handle (§3). Draw them as one picture so neither is built and then redrawn.
>
> **Draw** one Claude Artifact page (house layout, whole-screen before and after at true size, every highlight
> clickable). Draw each control from the component the product already ships, and use the coaches portal's written
> formatting rules as the benchmark. Cover:
> 1. **The venue list:** splitting a field into halves, and what a field with halves looks like there.
> 2. **New schedule and its rows:** a row on a whole field, on one half (P3: the other half goes elsewhere), or on
>    both halves (P2).
> 3. **The schedule grid:** a field with halves (one row with a split cell, or a row per half; draw both).
> 4. **The bill and the schedule's PDF:** what a half costs and how it is labelled, beside a "Half cost" field (case C,
>    unchanged) and beside "Sharing a facility".
> 5. **The permit's Used figure** once the builder sees other schedules' time (Stage 2's owed item), and what a booked
>    half does to it.
> 6. **The same-time rule (Stage 3's drawing list):** the rule row with "at the same time / never at the same time";
>    the message when a group can never line up (R6); the per-rule report on the draft cards and in the "Open slots
>    and short teams" window, covering "Sharing a facility" too (R8); the warning when a hand move breaks a group (R7).
>
> **The asks to put to the owner, each with a recommendation** (lettered choices, the plan's Ask style):
> - The storage shape: (B), as `/dba` proposes in §5, or (A). Explain it in what the club sees, not in columns.
> - Does a practice on half a field count as one practice or half a practice toward a team's share (Census, "the two
>   bills")? Show the season's numbers for one picture under each answer.
> - A half's price: derived as the field's price ÷ 2, and whether a club may change it.
> - Halves only, or up to four parts? Named or numbered?
> - How far halves reach: club schedules and the practices they make only, or also house-league games on club time,
>   a coach's own event, tryout days, tournaments.
> - How "Sharing a facility", house league's "teams at once" and halves relate.
> - The same-time rule: where it ranks (§3); refusing a team that is in both a sharing rule and a same-time rule; and
>   whether the report names the placements the week drops when its attempts run out (Stage 0).
> - Whether halves and the same-time rule apply to a house-league schedule unchanged (Open questions).
>
> **Words:** working words only. Halves need words that are neither "half field" / "Half cost" (case C, already on the
> bill and the PDF) nor "part" (already time added to a schedule). They go to the one `/marketing` pass per stage.
>
> **Before hand-off:** run `/design` on the page and apply its findings. **Records:** the plan (the drawing under
> Stage 2 and Stage 3, the asks), and the board line `schedule-fields-trades` in
> `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (that file holds other sessions' edits: change only this block, and
> commit only it). Commit at the owner's word. Finish with a product-owner summary: what the club would see, and each
> ask with its recommendation.

#### 4c. Prompt for round 2 of the halves and same-time drawing (fresh chat)

> Drawing session for the club schedules plan, round 2 of Stages 2 and 3. Plan:
> `docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md`. Read §2, Stage 2 "Drawing, round 1: the asks" (the
> owner's fourteen rulings, the two follow-ups, and "What round 1 did not draw"), the Census (§E, house league), Stage 3,
> §5 and the Open questions. **No code and no migration in this session:** drawings, `/design`, the asks, then records.
>
> **Round 1** is `docs/projects/active/SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html`, artifact
> https://claude.ai/artifact/YTTYBE67znkupmwLYkLZRR. Round 2 is the SAME page, republished from the same file path so the
> history threads: update its tabs, show the round 1 rulings in "What you already ruled", and draw only what the rulings
> add. Keep the house layout, whole-screen before and after at true size, every highlight clickable, controls drawn from
> the shipped component, the coaches portal's written rules as the benchmark. Round 1's `/design` lessons hold (a flat
> tick list; a tick only for yes or no; hatching means a booking, dashed means undecided; the schedule page's one line).
>
> **Two follow-ups come first.** If the owner has not answered them in the chat, they are the first two asks, each with
> a recommendation: (1) does Ask 14 C widen Ask 5 to house-league time a club schedule hands out, practices and games;
> (2) may a field in four quarters also be used as halves (two quarters together) and whole. Where an answer changes a
> picture, draw both.
>
> **Draw:**
> 1. **The venue list:** the three-way choice (whole only, two sides, four quarters), now a select; locked while a part
>    is booked; the read card.
> 2. **New schedule:** a field in quarters in the flat tick list, the box's words, and (if allowed) halves of a quartered
>    field.
> 3. **The grid:** a field in quarters (up to four rows under its field, Ask 8 B), at the page's true width.
> 4. **The bill and the PDF:** a quarter on the bill (its caption reads "1 more" today) and the Split hint; the PDF with
>    a column per part at A4 width (check it still fits beside the other fields).
> 5. **House league (Ask 14 C), using helpers to read its shipped screens** (CLAUDE.md, broad reading): its Practice time
>    window with a field in parts beside its own "Teams at once" (how the two relate on a split field); where the
>    same-time rule is entered in house league (it has no "Add a rule": find the shipped home), its entry-time message
>    (R6) and its report; house-league games generated on club time on a part, and the words a part takes on the public
>    schedule page, family emails and game-day reminders.
>
> **The asks, each with a recommendation (lettered choices):** the two follow-ups if open; confirm how Asks 2 A and 3 A
> extend to quarters (a quarter counts a quarter of a practice and costs the field's price ÷ 4); the words for a quarter
> ("side" does not fit four parts); "Teams at once" beside parts in house league; where the house-league same-time rule
> lives and how it reports; anything else the drawing shows that the rulings do not settle.
>
> **Words:** working words only, for the one `/marketing` pass per stage.
>
> **Before hand-off:** run `/design` on the page and apply its findings. **After the owner rules:** run `/dba` on how a
> booking names its part (four parts, halves of a quartered field if allowed, house-league games and practices), and
> record its finding in §5 (still no migration). **Records:** the plan (round 2 under Stage 2 and Stage 3, the asks),
> and the board line `schedule-fields-trades` in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (that file holds other
> sessions' edits: change only this block, and commit only it). Commit at the owner's word. Finish with a product-owner
> summary: what the club and the house-league admin would see, and each ask with its recommendation.

### Stage 1 — Pick the fields (P1)
No migration expected.
- [x] Drawing, round 1 (2026-11-25): [SCHEDULE_PICK_FIELDS_DRAWINGS.html](SCHEDULE_PICK_FIELDS_DRAWINGS.html), artifact
      https://claude.ai/artifact/CDJ5S8uoURQBf7erQSGX1V. Through `/design` (10 findings, all applied; listed on its Asks
      tab).
- [x] **Rulings (owner, 2026-11-25: "Ask 1 A … Ask 6 A. go ahead and build"):**

  | # | Ruling |
  |---|---|
  | S1 | **A list with ticks on the row**: the Facilities list the permit's form already has. |
  | S2 | **The venue's name at the end of the label line**, in quieter type, cut short when long. |
  | S3 | **The "not on this schedule" line**: only when a field the permit holds is on none of its rows; whole fields, never hours; "not on this added time" on Add time. |
  | S4 | **Each permit's card gets its own "Add hours"**; the door under the cards reads "Add hours with no permit" on a form with a permit ticked. |
  | S5 | **Rows with their own dates: not now.** A later period is Add time, or the finder. |
  | S6 | **A permit's time stops at the permit's dates**, with the line under To saying so. |
- Build facts the drawing rests on (opened in the code 2026-11-25): the control is `PickField` with `everyLabel`
  (`components/admin/kit/club/PermitWindows.tsx`): nothing ticked means every option, the first row clears the ticks, so
  the field has no required marker. The permit form's own Facilities field is the precedent ("Every facility"). The box
  naming the fields when all are in ("Fields 1–6") needs one small addition to `PickField`. The new line uses the
  card's existing hint slot (where Add time's `usedLine` renders); on Add time the two stack, so its wording names the
  added time. The reworded outer door applies in the cards branch only (`addHoursDoor` is shared with the no-permit form).
  The old place cell also carried the "No permit" note and the finder's `foundNote` lines: the note goes (the card is
  titled "Typed here"), the found notes become a hint under the field; a venue with no facilities keeps the plain text.
- [x] **Built, reviewed (`/review`, one High fixed) and committed 2026-11-25 (dev).** `NewScheduleWindow.tsx`: a card row's place is `PickField`
      (`rowPlaceOf`): a permit row offers its permit's fields at the row's venue (`permitPlaces`), a typed row every field
      there; a field the row names that the permit no longer holds stays an option so it can be unticked. A venue with no
      facilities keeps its plain name. The "No permit" note went (`rowNoPermit` deleted); the finder's notes are a line
      under the row (`.rowNotes`). `PickField` gained `labelAside` (S2) and `everyValue` (the box says "Fields 1–6").
- [x] S3: `fieldsLeftOff` + `leftLine`, under the card's name (`.cardLine`), stacking under Add time's `usedLine`.
- [x] S4: `addPermitRow` — the card's own door, after its last row: the fields the card's other rows don't use (all when
      none is left), the last row's days, hours and dates. The outer door reads "Add hours with no permit" in the cards
      branch with a permit behind a row.
- [x] Server: `permitGone` (so all three time saves) now also refuses a permit row naming a place its permit holds no time
      on (`rowOffItsPermit`, refusal `permit_facility`). `Prices` carries `held` and `venueFacilities`. **/review
      2026-11-25 (High, fixed):** only the rows the request ASKED are checked, never rows the keep rule brought back, and a
      place the schedule's own saved rows held on that permit stays allowed (`savedPermitPlaces`; the generate and
      `[scheduleId]` routes pass `{ asked, saved }`). So a permit edited after a schedule was saved never blocks a save of
      time the admin didn't touch; only a newly ticked field the permit doesn't hold is refused.
- [x] `lib/club-schedule-keep.ts` needs no change: `blockHolds` matches on the facility, so a sent schedule's narrowed row
      brings its old row back to yesterday, as the drawing's "After the schedule exists" says.
- [x] The bill: nothing changed. Test: 2 of 6 fields bills 30 slots × 1.5 h at the permit's hour, not its cost.
- [x] S6: `permitRowDates` — with one permit a row follows From and To as before UNLESS they reach past the permit, then
      it carries the permit's dates (a saved row with none in Settings… gets the same stop, looked up by its permit). Line
      under To: `toStopsAt`; under From, typed before the permit's first day, `fromStartsAt` (/review: the rule clips both
      ends, so both are said). ⚠ A sent one-permit schedule whose To already ran past its permit loses those slots the next
      time its Settings… is saved (time the club doesn't hold, the ruling's reason).
- Tests: `tests/unit/club-schedule-pick-fields.test.ts` (15). Help: a new sub-topic, "A schedule on some of a permit's fields" (`club-schedules-t-fields`, `lib/help-content/org.tsx`). Owed: the `/marketing` pass on the new phrases and a browser walk.

### Stage 2 — A field in halves, and the builder sees other schedules (P2, P3)
Migration first. Drawn together with Stage 3.
- [x] `/dba` on the storage shape (§5): proposes (B), 2026-11-25; the owner rules it in the drawing.
- [x] Drawing, round 1 (2026-11-25), Stages 2 and 3 together: [SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html](SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html),
      artifact https://claude.ai/artifact/YTTYBE67znkupmwLYkLZRR. Through `/design` (20 findings, listed on its Asks tab;
      all applied except: no separate Today frame where only one hint or the arithmetic changes (the bill, the Permits
      row; said on the drawing), and one reported for the register owner, below). Its fourteen asks are below
      ("Drawing, round 1: the asks"), **ruled by the owner 2026-11-25** (Ask 4 B and Ask 14 C against the recommendation).
- [x] Drawing, round 2 (2026-11-25): the SAME page and artifact, republished so the history threads (round 1 is in its
      version history). Draws what Ask 4 B and Ask 14 C add; its eight asks are below ("Drawing, round 2: the asks"),
      **ruled by the owner 2026-11-25, all eight as recommended**. Through `/design` before hand-off (findings on its
      Asks tab).
- [x] The owner rules round 2 (2026-11-25: all A).
- [x] `/dba` on how a booking names a part (four parts; the halves A–B and C–D of a quartered field, Ask 2 A;
      house-league games and practices on club time, Ask 1 A; a split locked while any part is booked, Ask 7 A),
      recorded in §5 (2026-11-25): a four-bit mask in quarter units, 0 = whole; the place floor becomes an exclusion
      constraint; the same five tables. Proposed; the migration session builds on it (Finding #55).
- [ ] Reported by `/design`, not this project's to fix: the shipped "Give it to" menu inside a cell of the "Open slots and
      short teams" window has no row on `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` (it was ruled for that window;
      a register row should say it is not a precedent).
- Build notes from the drawing's design check (each a small addition to a shared piece): the tick list (`PickField`)
  needs "a side unticks its whole field and the reverse", and new box words ("Field 1 in two sides, Field 2 side A") in
  the field-list words; the notice pill needs a held, wrapping face for the R7 notice (its error face already has one);
  the PDF needs a side-aware column key and no price word on a side's heading (`weightWords` would print "· half").
- [ ] The migration on the ruled shape (§5's columns and floor; a `/dba` pass on the migration itself); **update `docs/agents/db/DATA_DICTIONARY.md` and run
      `npm run refresh:snapshots` (dev + prod) in the same unit of work** (`npm run check:dictionary`).
- [ ] Venue list: split a field into parts (`VenueLibraryWindows.tsx`).
- [ ] Permits: a permit holds a whole field or a part; "Half cost" stays for case C. Decide in the drawing how a part's
      price relates to the field's (`lib/permit-time.ts` `shareOf`, `lib/permit-words.ts`).
- [ ] The builder: `cutSlots` cuts a part as its own slot; `slotRoom`, sharing and value balancing read a part
      correctly; a team is never on a field and one of its parts at once.
- [ ] Every clash check learns that a part overlaps its field and its field overlaps each part
      (`lib/venue-clash.ts`, `lib/venue-clash-lookup.ts`, the database's place-unique floor).
- [ ] The owed item: the builder, the finder's pick and the permit's Used figure see other schedules' final time, and
      the builder sees another schedule's draft (warn, as the finder does). Used is a number the Permits page shows: the
      change is said in the drawing.
- [ ] What "Sharing a facility" means beside halves (a rule about teams) is an ask for the drawing; the two must not
      give two different bills for the same picture. **The census found they do today (Census §E): settle the counting
      rule in the drawing.**

#### Drawing, round 1: the asks (Stages 2 and 3) — RULED by the owner 2026-11-25

**Ruled (owner, 2026-11-25, pasted from the drawing):** "Ask 1 A, Ask 2 A, Ask 3 A, Ask 4 B, Ask 5 A, Ask 6 A, Ask 7 A,
Ask 8 B, Ask 9 A, Ask 10 A, Ask 11 A, Ask 12 A, Ask 13 A, Ask 14 C." No notes. Two answers differ from the recommendation:
**Ask 4 B** (up to four parts, lettered A–D, offered now: "Two sides" / "Four quarters") and **Ask 14 C** (sides and the
same-time rule both reach house league).

**Read together, two answers need the owner's word before the build (asked 2026-11-25, open below):**
- **Ask 5 A and Ask 14 C.** 14 C has house-league practices and games carry a side, which is what Ask 5 B said. Recorded
  as ruled; this plan reads 14 C as widening Ask 5 to house-league time a club schedule hands out, until the owner says
  otherwise. Ask 5's C (a coach's own event, tryout days) and D (tournaments) stay out.
- **Ask 4 B and Ask 1 A.** Ask 1 A stores one part per booking (0 = the whole field). If a quartered field may also be
  used as halves (quarters A+B together), a booking must be able to name a half of a quartered field. The storage shape
  holds, but how a booking names a part changes: a `/dba` pass before the migration.

Working words in the drawing: a field's tick in the venue list reads "Two sides"; its parts are **"side A" and "side B"**;
a row reads "Field 1 in two sides" or "Field 2 side A". With Ask 4 B a field may be in four parts, A–D: the words for
quarters are new for the `/marketing` pass. None is settled. Each ask below carries the drawing's recommendation and the
owner's answer.

| # | Ask | Recommended |
|---|---|---|
| 1 | How sides are kept: **A** one field that splits in two (`/dba`'s shape (B)) · **B** each side its own facility (shape (A)) | A |
| 2 | A side toward a share (Evenly, By percentage): **A** half a practice, like a shared slot · **B** one practice · **C** one, and sharing changes to match. The drawing's numbers: Field 1 in sides for two 9U teams, Field 2 whole for two 15U teams, 30 starts each, Evenly, $120 a slot. A: every team $1,800, nothing open, $7,200 billed. B: shares of 22–23, the 15U teams 7 and 8 short, 15 sides unused, $6,300 billed. | A |
| 3 | A side's price: **A** the field's price ÷ 2, worked out, never typed (a side of a "Half cost" field is a quarter) · **B** worked out, and a club may set its own share per field | A |
| 4 | How many and what names: **A** two sides, lettered A and B (storage allows four later) · **B** up to four, A–D · **C** names the club types | A |
| 5 | How far sides reach: **A** rep schedules and the practices they make · **B** + house-league time a schedule hands out · **C** + a coach's event and tryout days · **D** + tournaments | A |
| 6 | Sharing, "teams at once" and sides: **A** keep all three, counted and billed alike; a side is never shared · **B** sides replace sharing for two at once | A |
| 7 | May a same-time group land on two sides of one field? R3 ("each on its own field, at full price") predates sides. **A** yes: a side is a place, each team billed for the place it got, as without the rule · **B** no: groups take whole fields | A |
| 8 | The grid: **A** one row per field, its cell split (about 60 px a side: names cut) · **B** a row per side, indented under its field; a whole-field slot stays on the field's row; the PDF gets a column per side | B |
| 9 | The permit's Used figure: **A** stays booked time, a side counts half; one line names unused time a final schedule holds that no team has (open slots, house-league time not yet given out) · **B** Used counts that held time too | A |
| 10 | The same-time rule's rank: **A** below the hard rules, above the conveniences (§3; prime time with the conveniences) · **B** below everything | A |
| 11 | A team in a sharing rule and a same-time rule: **A** refused on entry · **B** allowed, the pair moves as one member | A |
| 12 | The hand-move warning (R7): **A** the drag tooltip, and the notice after the drop repeats it (the notice's held, wrapping face) · **B** the tooltip only, like every rule today | A |
| 13 | Name the placements a week drops when its tries run out: **A** yes, one sentence in the why window's free group, and fix the back-to-back gap with it · **B** no | A |
| 14 | House league: **A** rep schedules only for this project; a house-league same-time rule goes to the ideas backlog · **B** the rule also reaches house league's Practice time · **C** both reach house league | A |

**The owner's answers:** 1 A · 2 A · 3 A · **4 B** · 5 A (widened by 14 C, above) · 6 A · 7 A · 8 B · 9 A · 10 A · 11 A ·
12 A · 13 A · **14 C**.

**What round 1 did not draw, and the rulings now need (round 2, before any build):**
- **The venue list control for four parts.** Round 1 drew a "Two sides" tick; with Ask 4 B the choice has three answers
  (whole only, two sides, four quarters), so it is a select again, not a tick (the design check's own rule: a tick is for
  yes or no).
- **A field in quarters** on the New schedule tick list, the grid (Ask 8 B: up to four rows under a field), the PDF's
  columns and the bill's caption (a quarter of a full field costs a quarter and reads "1 more" today).
- **Halves of a quartered field**, if the owner allows them (open question below).
- **House league (Ask 14 C):** its Practice time window with a field in sides or quarters and its own "Teams at once";
  the same-time rule built into that window (a club schedule's rules never name house league); house-league games on a
  side or quarter (the game generator on club time, the public schedule pages, family emails and game-day reminders
  carry the part in their place words). House league reads its seasons in place (CLAUDE.md, House League 9f·17): no
  closed-season page question arises.
- How Ask 2 A and Ask 3 A extend to quarters: a quarter counts a quarter of a practice toward a share and costs the
  field's price ÷ 4. Recorded as how the rulings combine, for the owner to correct in round 2.

**Facts the drawing rests on (opened in the code 2026-11-25):**
- **The bill counts a slot by its price, not its place** (`BillWindow.tsx:138-150`, `billTeamCaption` in
  `lib/club-schedule-words.ts:1337`): one team at weight 0.5 is "half", whatever made it 0.5. So a side reads "half-field
  slots" on the bill with no caption change; only the Split hint gains "or one side". The drawing keeps the word "half"
  there on purpose: a side of a full field and a "Half cost" field cost the club the same.
- **Used already counts every finalized practice** (`permitUse` reads `readClubBookings`). What it misses is a final
  schedule's open slots and house-league time not yet divided (`CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md`, Session D note).
  Hence Ask 9: the drawing says that time in a line, rather than counting it as used.
- **A hand-move rule break is said only in the drag tooltip** (`dropVerdict`, `lib/club-schedule-view.ts:334-382`;
  `ruleBroken` `:385`); nothing after the drop repeats it. Hence Ask 12.
- **A club schedule's rules never name house league** (`lib/league-practice-time-server.ts:32`); house league divides its
  own time with "Teams at once" (1–4 per facility). So the open question's "apply unchanged" cannot hold. Hence Ask 14.
- **Every rule refusal is server-side today** (`readScheduleSettings`, `lib/club-schedule-settings.ts:387-407`). R6's
  entry-time message is worked out in the window from what the form holds; game days can't be known there and go to the
  report.
- **Shares are a split of the whole supply** (`shareTargets`, `lib/club-schedule-engine.ts:19-21`), which is why counting
  a side as one practice (Ask 2 B) inflates the supply and leaves whole-field teams short.

#### Drawing, round 2: the asks (Stages 2 and 3) — RULED by the owner 2026-11-25 (drawn 2026-11-25; Version 3 of the artifact)

**Ruled (owner, 2026-11-25, pasted from the drawing):** "Ask 1 A, Ask 2 A, Ask 3 A, Ask 4 A, Ask 5 A, Ask 6 A, Ask 7 A,
Ask 8 A." No notes. Every answer is the recommendation. The two round 1 follow-ups are settled by Asks 1 and 2.

**What the rulings settle for the build:**
- **House league (Ask 1 A):** a part reaches house-league time a club schedule hands out, practices and games. The part
  comes with the slot; house league never splits a field itself, and its own place pickers offer whole facilities only.
  `league_games` and `league_practices` carry the part (§5).
- **A quartered field (Ask 2 A):** whole, the halves A–B and C–D (fixed pairs, never B–C), or one quarter: seven options
  in the tick list, up to six grid rows under the field.
- **A quarter's count and price (Ask 3 A):** ¼ of a practice toward a share, the field's price ÷ 4, worked out, never
  typed. Accepted with it: under Evenly, a schedule mixing quarters and whole fields leaves the quarter teams short (the
  drawing's picture: 7U 10 short each, 10 Field 2 slots open); By percentage is how a club fills it. How the rulings
  combine (not separately asked): a half of a quartered field counts ½ and costs ÷ 2, as a side does (round 1 Asks 2 A,
  3 A).
- **Words (Ask 4 A):** the word says the size: "side A", "quarter C", "quarters A–B". Working words still go to the
  `/marketing` pass.
- **Teams at once (Ask 5 A):** a part holds one team; Teams at once counts on whole facilities only, with a line when the
  time has a part.
- **The house-league same-time rule (Ask 6 A):** in Practice time under "Hand it to the teams", naming teams in any
  division, shown in each division's window; whichever division is handed out matches the other's practices as they
  stand; R6 on entry; one line per rule in the window's existing notice, before Hand out.
- **Changing a split (Ask 7 A):** locked while any part is booked; free while only whole-field bookings exist. This is
  wider than §5's "lowering the count is refused while anything names a higher one": two sides → four quarters is
  refused too while a side is booked.
- **The PDF (Ask 8 A):** a day too wide for one page splits into two tables, each field kept with its parts (today the
  PDF drops columns that don't fit, `lib/export/pdf.ts:630-640`).

The same page, [SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html](SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html), artifact
https://claude.ai/artifact/YTTYBE67znkupmwLYkLZRR. Tabs: Round 2 · Venue list (the split is a select: "Not split" / "Two
sides" / "Four quarters", locked while a part is booked) · New schedule (quarters in the flat tick list, both ways Ask 2
can go) · The grid (a row per quarter; a half of a quartered field is its own row, up to six under a field) · Bill and
PDF · House league practices · House league rule · House league games and words · Asks. Round 1's permit use, rule and
report tabs are ruled and not redrawn. Working words: "Not split", "quarter A", "quarters A–B", "Field 1 in four
quarters", "Field 1 quarters A–B, C and D", "quarter-field slots", "Teams at the same time" (house league).

| # | Ask | Recommended |
|---|---|---|
| 1 | Follow-up: how far parts reach in house league (14 C with Ask 5): **A** house-league time a club schedule hands out, practices and games, the part comes with the slot, house league never splits a field · **B** A + house league's own place pickers offer parts · **C** practices only | A |
| 2 | Follow-up: a field in quarters also used as halves and whole: **A** yes, the fixed pairs A–B and C–D (seven options in the list, up to six grid rows) · **B** whole or quarters only | A |
| 3 | A quarter toward a share and its price: **A** a quarter counts ¼, priced ÷ 4 (the rulings carried through; also how a four-way shared slot counts today, 1 ÷ its teams). Under Evenly a schedule mixing quarters and whole fields leaves the quarter teams short (the drawing's picture: 7U 10 short each, 10 Field 2 slots open, $6,000 of $7,200); By percentage fills it · **B** a quarter counts ½ like a side (fills that picture, but four teams on quarters count twice what four teams sharing the field count) | A |
| 4 | The words for a quarter: **A** the word says the size ("side A", "quarter C", "quarters A–B") · **B** one word, "section" · **C** letters only ("Field 1 A") | A |
| 5 | "Teams at once" beside parts in house league: **A** a part holds one team; Teams at once counts on whole facilities only, with a line when the time has a part (Ask 6 A) · **B** on a split field Teams at once names the parts · **C** a part holds Teams at once too | A |
| 6 | The house-league same-time rule: **A** in Practice time under "Hand it to the teams", naming teams in any division, shown in each division's window; whichever division is handed out matches the other's practices as they stand; R6 on entry; the report is a line per rule in the window's existing notice, before Hand out · **B** a season list in Schedule health's "Adjust the rules" · **C** Practice time, one division only | A |
| 7 | Changing a field's split while a part is booked: **A** locked (free while only whole-field bookings exist) · **B** a change that keeps every booked part goes through (two sides → four quarters, side A becomes quarters A–B) | A |
| 8 | A PDF day too wide for one page (added by `/design`: 13 columns take ~245 of 251 mm; one more split field does not fit, and today the PDF drops the columns that don't fit, `lib/export/pdf.ts:630-640`): **A** split the day into two tables, each field kept with its parts · **B** as it ships | A |

**`/design` (2026-11-25, 11 findings, all applied; listed on the page's Asks tab):** the PDF drawn with no cell lines
(`theme: 'plain'`) and the default slate head, its headings as they really wrap; Practice time drawn as shipped (the
notice's olive ground and bold lead line, `ck.link` for "+ Give U9 more time" and the new door, 650 heads, 52 px time
row); no heading that repeats the rule's door; the Teams list unchanged (`PickField` has no aside or groups, so teams are
named "U9 Orioles" and joined by commas); the R6 refusal as the foot's `DialogReason`; the venue row's phone frame;
grid labels venue-only; round 1 answers written "round 1, 4 B". Kept: the page's name, so the history threads.
**Build notes it raised:** a large house league makes the Teams list long (search is a build question); the house-league
rule's notice is worked out when the window opens, so it reads the other division as it stands.

**Facts round 2 rests on (opened in the code 2026-11-25):**
- **The club schedule PDF prints landscape on US Letter, compact (8 pt), 14 mm margins** (`lib/export/club-schedule-export.ts:84`,
  `lib/export/pdf.ts:463-471`), not A4 portrait as round 1 drew. Thirteen columns (Field 1 whole + four quarters, Field 2
  whole + two sides, Fields 3–6) fit one page; two-word names wrap. Left alone, a quarter's heading reads "Field 1 · 25%"
  (`weightWords`, `lib/club-schedule-document.ts:82`): the build keys the column by field and part, the part on the
  heading's second line, no price word.
- **The bill names a quarter "more" today** (`billTeamCaption`, `lib/club-schedule-words.ts:1337`): a 0.25 slot is neither
  full, half nor shared. Proposed: a "quarter" count ("10 quarter-field slots"), by price as round 1 kept it.
- **A shared slot counts 1 ÷ its teams toward a share** (`lib/club-schedule-engine.ts:262`, `:543`), so four-way sharing
  counts ¼ each: Ask 3 A keeps quarters and four-way sharing alike.
- **House league's Practice time** (`components/admin/kit/club/league/time/PracticeTimeWindow.tsx`, words
  `lib/league-practice-time.ts:293-333`): three native selects (Each practice, Teams at once "1–4 per facility", Practices
  a week); Teams at once is one number per division (`:128`, seats = pieces × teams at once `:181`). No team-level rule
  exists anywhere in house league; Schedule health's "Adjust the rules" holds game rules only.
- **All house-league club time comes from final club-schedule slots** given to a division in House league's time
  (`lib/league-time-server.ts:48-62`); games are one per slot and take its place (`lib/league-game-generator.ts:18`).
- **House league has no game-day reminders and no PDF** (`lib/game-day-reminders.ts` is tournament-only). Its place words
  are "Venue · Facility" on pages and emails, built at read time; the stored place is "Venue — Facility", read back by
  splitting at the LAST " — " (`lib/club-calendar.ts:105-110`), so a part joins with a comma ("Field 1, side A"), never a
  second dash.

#### Census — every reader of a venue facility (Stage 0, 2026-11-25)

Four helper reads, one per area; this session opened every line marked ✓ and the schema in the dev snapshot. Unmarked
rows are helper leads with their line numbers: open them at build. "One place?" = does it assume one facility is one
place at a time. **(A)** = a part is its own `org_venue_facilities` row with a link to its field. **(B)** = a field
carries a number of parts and a booking names which (0 = the whole field). 💲 = a figure a customer is billed or
budgets by. 🛡 = a double-booking guard.

**The schema (dev snapshot, ✓).** `org_venue_facilities` has 8 columns and no parent or parts idea. Eight foreign keys
point at a club facility: `club_schedule_slots.facility_id`, `org_time_block_facilities.facility_id` (PK block +
facility), `org_permit_facility_shares.facility_id` (PK permit + facility; the price share), `rep_team_events`,
`rep_tryout_sessions`, `league_games` and `league_practices` (`.org_venue_facility_id` each), and
`venue_facilities.source_org_facility_id` (a tournament's copy). **The only database floor against a double booking
anywhere is `club_schedule_slots_family_place_start`** (family, venue, coalesce(facility), starts_at): one schedule
family, the same start, the same facility. There is no exclusion constraint on any booking table; every other guard is
in the app.

**A. Venue library and pickers**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| Library read, save, update diff | `app/api/admin/org/venues/route.ts:61`, `:84`, `:177`, `:211` | a venue's facility list | yes, a flat list | parent column; save field then parts; diff a tree | the parts count |
| Duplicate name check | `lib/venue-library.ts:190` (route `:228`) | names in one venue | yes | "North half" under two fields collides: unique per parent | nothing |
| Remove refused while booked | `lib/venue-library-server.ts:186-189` | facility id → bookings | yes | also check its parts | refuse lowering the count below a booked part |
| Remove refused while a permit or schedule holds it | route `:242`, `:244` | id in blocks / slots | yes | include the parts' ids | same, for a part a slot names |
| Rename cascade to upcoming bookings | `lib/venue-library-server.ts:226`, `:235` | id → `field_number` / `location` | yes, one name per id | a field rename must rewrite its parts' bookings too | build the text from name + part |
| Usage per facility ("In use", removable) | `lib/venue-library-server.ts:103-108` | bookings per id | yes | roll parts up to the field | per part, for lowering the count |
| Venue window rows, library table | `VenueLibraryWindows.tsx:292-298`; `app/[orgSlug]/admin/org/venues/page.tsx:58-59` | the facility list | yes | parts appear as extra fields: nest or filter | a parts control per row |
| Pickers for every booking form | `lib/venue-clash-lookup.ts:71`, `:84-86`; `lib/where-field.ts:180`; `components/venue/WhereField.tsx:282` | the facility list | yes | parts offered as fields in every picker (house league, coach events, tryouts) | nothing, unless a picker may book a part |

**B. Permits (the time the club holds)**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| 💲 "No fields listed = every field" ✓ | `lib/permit-time.ts:118-121` (`blockUnits`) | the venue's list | yes | **parts become extra units**: leave them out | nothing |
| The three lists that feed it | `lib/permit-lookup.ts:84-89`; `PermitWindows.tsx:77`; `lib/permit-free-time-server.ts:81` | every facility | yes | each must leave parts out | nothing |
| Two more expansions that skip the shared one | `lib/permit-server.ts:305`; `PermitWindows.tsx:326` | the venue's list | yes | filter each separately | nothing |
| 💲 Held hours ✓ | `lib/permit-time.ts:277` | units × the window | yes, sums per facility | a missed filter doubles Held | nothing (a permit holds whole fields, P2) |
| 💲 An hour of each field ✓ | `lib/permit-time.ts:288`, `:305-315` (`shareOf`, `fieldPrices`) | share per unit; cost ÷ full-field hours | yes | a missed filter lowers every field's hour; a part with no share row is priced Full | nothing |
| 💲 Held · Booked · Unused ✓ | `lib/permit-time.ts:453` | a booking's facility = the unit | yes | a booking on a part misses its field: Booked runs low | a half booking reads as the whole field booked (Booked high) until it unions per part |
| 🛡 Two blocks over one field | `lib/permit-time.ts:543-544` | shared unit ids | yes | a field and its part never overlap: double-held | nothing (permit blocks are whole) |
| The permit's answer ("outside the permit") | `lib/permit-time.ts:126`, `:198-220` | id ∈ units | yes | a part is outside a block that holds its field | nothing |
| 💲 Permit window places, Permits page Used, workbook | `lib/permit-server.ts:212-217`, `:276-305`; `app/[orgSlug]/admin/permits/page.tsx:142`; `lib/permit-use-workbook.ts:57-77` | rows per unit | yes | parts as rows double the totals | nothing |
| 💲 Price rows and sentences | `PermitWindows.tsx:488-504`; `lib/permit-words.ts:259`, `:271-317` | share per facility; "N full fields" | yes | a part gets a price row and counts as a "field" | nothing |
| Field list words ("Fields 1–6") | `lib/permit-words.ts:85` | names | yes | part names break the ranges | nothing |
| Save step and its trigger | mig 322 `org_permit_save` and the block-facility trigger | block facility ids | yes | a part passes the same-venue check | the part on a **schedule's** row (P3) |
| Find the time, free cells ✓ | `lib/permit-free-time.ts:175`, `:192`, `:225-228` | a booking takes its facility | yes | field and halves offered as separate free places at once | a half booking takes the whole field (under-offers) until it learns parts |
| Renew, payload, labels | `app/api/admin/org/permits/route.ts:314-318`; `lib/permit-form.ts:110-149`; `lib/permit-server.ts:137-152`, `:370` | ids, names | yes | works | the part on a schedule's row only |

**C. The club schedule builder**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| Cutting the slots ✓ | `lib/club-schedule-engine.ts:121`, `:134-138` | `blockUnits` | yes | **cuts the field and both halves at one start** | cut N part slots for a split row |
| 🛡 Slot key ✓ | engine `:93`, `:135`; rebuilt `lib/club-schedule-server.ts:312` | venue · facility · start | yes | works, but nothing makes a field and its part exclusive | the part in the key |
| 💲 A slot's weight ✓ | engine `:141` → server `:376-380` → `shareOf`; also keep `:48`, server `:531`, coach `:305`, `[scheduleId]/route.ts:239` | the share row for the id | yes | **a part finds no row: priced as a full field** | the field's share ÷ parts |
| 🛡 Already on the books ✓ | engine `:192` (`heldSlots`) | equal facility id | yes | a field booking holds its parts and the reverse | same facility and (either whole or the same part) |
| 🛡 One seat per slot | engine `:980`, `:987`; `lastPass` `:1069-1101` | the slot key | yes | a field and its parts need one shared seat at a start | same |
| 🛡 Room in a slot ✓ | `lib/club-schedule-settings.ts:184-189` (`slotRoom`) | weight under 1 = one team, never shared | yes | a part's weight decides it | same |
| 🛡 Time added to a schedule ✓ | `lib/club-schedule-family.ts:65` | equal facility id | yes | a field and its part must clash | same facility, overlapping part |
| 🛡 Kept slots ✓ | `lib/club-schedule-keep.ts:197` | facility id (none meets all) | partly | parent and part | a whole-field slot meets every part |
| 🛡 Two rows on one place | `lib/club-schedule-permit-rows.ts:61`, `:91-96` | facility ids | yes | a field row and a part row must clash | nothing |
| Inside the permit ✓ | `lib/club-schedule-permit-rows.ts:173` (`rowOffItsPermit`); `:138-146`; `:196-197` | the permit's units | yes | **a part row is refused** (its permit holds the field); the field reads "left off" | nothing: the field is held, the part is in it |
| 🛡 The database floor ✓ | snapshot `club_schedule_slots_family_place_start`; save lookup mig 494 | coalesce(facility) at one start | yes | a field and its part at one start both pass: needs a trigger with a parent lookup | the part in the index; a whole and a part at one start both pass: needs a one-table trigger |
| Same field each week, moved around | engine `:139`, `:756`, `:801-803`, `:943-951`; keep `:47`; `lib/club-schedule-view.ts:315` | facility id as "the same field" | yes | the two halves are two fields | the halves are one field unless the part is added (decide) |
| 💲 Team results, fair shares | engine `:1362-1374`; `FairShares.tsx:71-72` | facilities used, priced minutes | yes | halves count as two fields | nothing |
| 💲 Bill, corrections, hand-backs ✓ | `lib/club-schedule-bill.ts:105`; `lib/club-schedule-send.ts:421`, `:671-681`, `:715-739`; `lib/club-schedule-coach.ts:305` | weight ÷ teams | n/a | right once a part's weight is right | right once the weight is ÷ parts; hand-back key gains the part |
| 💲 Bill window Full/Half label | `BillWindow.tsx:145-146`, `:204` | weight exactly 1 or 0.5 | yes | half of a "Half cost" field (0.25) is neither | same |
| Grid rows and cells | `lib/club-schedule-view.ts:54-65`, `:182-189`; `ScheduleGrid.tsx:72-75`, `:153` | one row per facility | yes | the field and each part become rows | both halves land in one cell |
| New schedule form | `NewScheduleWindow.tsx:176-177`, `:935-948`, `:1489-1490`, `:1670-1780` | the list; place keys | yes | "every field" pulls parts in; parts hidden (the permit holds the field) | a part picker on a row |
| Settings and gaps "fields for a group" | `lib/club-schedule-settings.ts:378`; server `:1334`; `lib/club-schedule-gaps.ts:115`, `:154`; view `:396-399` | facility ids | yes | a rule on the field must reach its parts | nothing (the part is in its field) |
| Send: the practice it writes | `lib/club-schedule-send.ts:387-393`; mig 326 `:579-581`; `lib/club-slot-event.ts:23-24` | facility id + name → the event | yes | the part's id and name flow through | **the practice needs the part** |
| Generate summary, exports, PDF | `app/api/admin/schedules/generate/route.ts:92`, `:106`; `lib/export/club-schedule-export.ts:53-55`; `lib/club-schedule-document.ts:123-128` ✓, `:160` | facility id, weight, name | yes | parts as columns beside the field | the PDF cell (`:160`) is keyed by facility: one half overwrites the other |

**D. Clash checks and bookings (rep events, tryouts, the coaches portal, the club calendar)**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| 🛡 THE cross-program rule ✓ | `lib/venue-clash.ts:270-276` (`clashKindOf`) | two different ids are never a clash | yes | **Field 1 against its own half reads "no clash": a silent double booking** until it learns the parent | same field and (either whole or the same part); a reader not yet taught calls the two halves a clash |
| Everything that inherits it | `lib/venue-clash.ts:259`, `:284`; `lib/club-calendar.ts:295`; `lib/venue-clash-lookup.ts:390`, `:434`, `:532`, `:542-566` | the rule | inherits | nothing more | proposed bookings carry the part |
| The pool of the club's bookings ✓ | `lib/venue-clash-lookup.ts:258-288` | four tables + tournament games | n/a | the parent with each facility name | **the part on every select** |
| 🛡 Coach live check (event, tryout day) | `app/api/coaches/[orgSlug]/teams/[teamId]/venue-clashes/route.ts:59-67` | the body's facility | inherits | nothing | the part in the body |
| 🛡 Tournament copy → club facility | `lib/venue-clash-lookup.ts:216-221`; `lib/club-calendar.ts:265`; `lib/tournament-venue-copy.ts:82`, `:202` | `source_org_facility_id` | yes, 1:1 | copy each part with its link, or map to the field | nothing (a tournament books whole fields) |
| Words of a clash, calendar words, team ICS | `lib/venue-clash-words.ts:121-131`; `lib/club-calendar-view.ts:378`; `lib/export/team-feed-words.ts:134` | names, stored text | n/a | the part's own name | say the part |

**E. House league**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| 🛡 THE per-program rule ✓ (house league and tournaments both) | `lib/venue-identity.ts:204-219` (`placementsShareSurface`) | equal ids; venue when one side has none | yes | parent and part (silent miss as above) | (facility, part) |
| 🛡 Its callers | `lib/league-schedule-conflict.ts:173`; `lib/league-venue.ts:190`, `:198`; `lib/league-schedule-health.ts:298`; `lib/league-season-calendar.ts:203`; `…/venue-check/route.ts:101`; the refusals in `…/schedule/route.ts:235`, `…/practices/route.ts:144` | the rule | inherits | nothing more | the part on each booking |
| Location words "Venue — Facility" | `lib/league-venue.ts:80` | id + name | yes | the field's name may be lost | a part argument |
| Game and practice writes, edits, "moved?" | `lib/db.ts:2829`, `:2850`, `:2905`, `:2948`; `…/schedule/[gameId]/route.ts:199` | facility id | yes | nothing | write the part; a part change is a move |
| Games generated on club time | `lib/league-generate-server.ts:52`; `lib/league-game-generator.ts:18`; mig 409 `:456` | the slot's facility | yes, "a slot is one facility at one time" | part slots arrive as extra fields | the game inherits the slot's part (`league_games` gains it) |
| Practices handed out on club time | `lib/league-practice-time-server.ts:58`; mig 393 `:411-429` ("teams at once" 1–4) | slot facility; several teams on one slot | partly | nothing | the natural home for a part per team |
| Linking, published changes, telling families, mail, public pages | `lib/league-game-place.ts:23`; `lib/league-game-changes-server.ts:66`; `lib/league-practice-tell.ts:195`; `lib/league-schedule-mail.ts:74`; `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:104`; `lib/club-games-read.ts:157` | key, id, name | yes | the full name | the part in the key and the words |

**F. Tournaments**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| Copy from the club library (three paths) | `lib/tournament-venue-copy.ts:73-109`, `:145`, `:193` | the venue's facility list | yes | parts copy as extra diamonds; a parent column remapped on `venue_facilities` | nothing |
| 🛡 Generator picks every field by default ✓ | `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx:215-216`; `GeneratorParts.tsx:45`, `:120` | the facility list | yes | **games on the field and its halves at one time** | nothing |
| 🛡 Generator's used-slot guard ✓ | `lib/schedule-generator.ts:430-440` | facility id in the key | yes | nothing stops field + part | nothing |
| 🛡 Overlap guard on every game save | `lib/tournament-overlap-guard.ts:50`, `:62`; `lib/schedule-conflict.ts:274` | `venue_facility_id` | yes | parent-aware | nothing |
| Playoff fit check, bracket picker, lane resolve, timeline, import, counts | `PlayoffGenerator.tsx:156`, `:238`; `BracketBuilder.tsx:277`; `…/schedule-facility-lanes/route.ts:207`; `ScheduleTimeline.tsx:366`; `lib/import/tournament-schedule.ts:381`; `TournamentSetupWizard.tsx:399`; `…/tournament-dashboard/route.ts:215` | the facility list | yes | parts inflate lanes and counts, show as columns and picks | nothing |

**G. The public site and exports**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| Public game label and detail | `lib/venue-label.ts:35`, `:63`; `lib/public-game-detail.ts:64` | the facility name | yes | the field's name with the part's | say the part |
| Exports that read stored text | `lib/export/schedule-calendar.ts:86`, `:109`; `lib/team-calendar.ts:71`; `lib/game-day-reminders.ts:126`; `lib/export/schedule-document.ts:101` (splits at " - ") | `location` text | n/a | nothing | the text carries the part, keeping the separator |
| Tournament CSV, house league CSV/XLSX | `useScheduleExport.ts:63`; house league schedule page `:1152` | names | yes | nothing | the part |

**H. Demo seeds and test fixtures**

| Reader | Where | Reads | One place? | (A) needs | (B) needs |
|---|---|---|---|---|---|
| The dome, Fields 1–6, two at "Half cost" ✓ | `scripts/seed-club-fixture.mjs:1346-1348`, `:1400`; `scripts/lib/prospect-demo-rep.mjs:424`, `:441`; `scripts/lib/dome-practice-split.mjs:14-16` ✓ | facilities; share 0.5 | yes | nothing | nothing |
| Bookings on library facilities | `scripts/seed-club-fixture.mjs:1154`, `:1195`, `:1238`; `scripts/seed-prospect-demo.mjs:291`, `:544` | facility ids | yes | nothing | nothing (whole by default) |
| Copies of the club's facilities | `scripts/seed-on-sale-pictures-extras.mjs:156`, `:184`, `:213` | every facility, with the link | yes | filter or remap parents | nothing |
| Clone seeds that copy whole rows (nine scripts) | `scripts/seed-live-tournament.mjs:191` and eight more (helper list) | every column | yes | a copied parent id points at the source: remap in each | nothing |
| 🛡 Demo sandbox check | `scripts/check-demo-sandbox.mjs:259` | game facility | yes | parent-aware | nothing |

⚠ **The domes' "half fields" are case C, not P2/P3** (✓): Fields 5 and 6 are whole fields the permit pays "Half cost" for;
the PDF already prints "Fields 5–6 are half fields" (`lib/club-schedule-document.ts:128`). A halves demo is new seed
work under either shape.

**Verdict.** Of the 69 rows above (many rows cover several readers), **(A) needs a change in 53 and (B) in 40**.
(B)'s 40 count house league in full (7), so they assume house-league schedules may use halves (open question below).
The count is not what decides it.
What decides it is what happens to a reader a build misses:
- **Under (A), a missed reader is silently wrong.** Two kinds. (1) **Lists:** about a dozen places expand "every field
  at the venue" or list a venue's facilities, and each would count a part as one more field. That doubles a permit's
  Held hours, lowers every field's hourly price, and has the tournament generator put games on a field and its halves
  at once. (2) **Comparisons:** at least ten separate checks say "two different facility ids are no clash". Each
  would let Field 1 and its own half be booked together without a word. There is no shared function to fix once:
  two rule modules, `venue-clash.ts` and `venue-identity.ts`, plus about seven of the builder's own checks.
- **Under (B), a missed reader errs on the safe side.** It sees the half as the whole field: two halves read as a
  clash, free time is under-offered, Booked reads high. Every list, picker, copy and permit figure stays as it is,
  because the field is still one row.
- **Risky under both:** 💲 the slot's weight (a part's price), the bill's Full/Half label, Booked on a permit; 🛡 the
  builder's seat, `heldSlots`, the family and kept-slot checks, and the database floor. Neither shape's index can say
  "a whole field and its half at one start". Both need a trigger.

**"Sharing a facility" and halves give two different bills for the same picture (✓).** The picture is two teams on
Field 1 at 6:00 p.m.:
1. **Each slot's money is the same.** Sharing bills each team the field's weight ÷ 2 (`lib/club-schedule-bill.ts:105`).
   A half bills its own weight, and under (B) that is the field's share ÷ 2. Under (A) a half has no share row and
   bills a **whole field each** (`shareOf` defaults to 1).
2. **The season's money is not the same.** Under "Evenly" and "By percentage" a team's share counts practices. A shared
   slot counts ½ toward each team (`lib/club-schedule-engine.ts:818`). A team alone on a half counts 1, because the
   count ignores weight; a "Half cost" field already counts 1 today. So a team practising on halves reaches its share
   with half as many slots as a team sharing whole fields. **The same picture, run as halves, hands out and bills half
   the time it would as sharing.** This is a rule to settle in the drawing, not a storage question.
3. **The correction's hours figure.** When the club sends changes, a gained shared slot's hours are recorded at the full
   slot (`lib/club-schedule-send.ts:421` records `teamIds: [t]`; `:678`). A gained half records half. The amount is
   right in both cases; the hours shown beside it differ. This exists today for sharing (see §5).
4. **The bill's label.** Full or Half is read from the weight (`BillWindow.tsx:145-146`). A half of a full field reads
   "Half", the same word as a "Half cost" field. A half of a "Half cost" field (0.25) reads neither.

### Stage 3 — Teams at the same time (R1–R10)
No migration expected (the rule is one more entry in the schedule's settings).
- [x] Drawing, round 1 (2026-11-25), drawn with Stage 2 (its tabs 7 and 8): the rule row with its "at the same time /
      never at the same time" choice; the entry-time message (R6); the per-rule report on the draft cards, on the page
      and in the "Open slots and short teams" window, covering sharing (R8); the hand-move warning (R7). Its asks (7, 10–14)
      are under Stage 2, "Drawing, round 1: the asks". **Ruled 2026-11-25** (7 A, 10 A, 11 A, 12 A, 13 A, 14 C).
      Ask 14 C adds the rule inside house league's Practice time window: **drawn in round 2 (2026-11-25)**, tab 7, with its
      home and report as round 2's Ask 6, **ruled 2026-11-25 (A)**.
- [ ] House league (round 2 Ask 6 A): the rule in `PracticeTimeWindow.tsx` under "Hand it to the teams"; the planner
      (`planPractices`, `lib/league-practice-time.ts`) places a linked team at its partner's existing start where it can;
      R6 from both divisions' time; one notice line per rule.
- [ ] `lib/club-schedule-settings.ts`: the rule's shape, limits and validator beside `sharing`; `rulesOn`, `defaultRules`.
- [ ] `lib/club-schedule-engine.ts`: a per-week step between `needsFor` and `planWeek` that picks starts where every
      member is eligible, free and still owed a slot, with enough free fields in one place, and hands the result to the
      week as kept slots. Linked teams are left out of `lastPass`; `holdable` drops a linked placement whole or not at
      all; "Moved around" moves a group together; `balanceValue` may not split a group across places.
- [ ] "Never at the same time": a forbid in the week's placement, checked by `findViolation`.
- [ ] The report: per rule, wanted against placed, with the first reason for each miss (a member off or on a game day,
      start and finish times, not enough free fields at one start, a share or weekly cap used up, a field kept for
      another group). A new measure beside the existing ones; `lib/club-schedule-gaps.ts` gains the reason.
- [ ] Hand moves (`planMove`, drag and drop) and the page's re-measure check the rule.
- [ ] Tests in `tests/unit/club-schedule-engine.test.ts`: a group placed together every week it can be; unequal shares
      stop at the smaller share and say so; an impossible group refused on entry; a run with no such rule unchanged.

### Stage 4 — Like-for-like swaps between coaches (T1, T4–T7, T9)
Migration first. No money moves.
- [ ] Drawing: the coach seeing the schedule's other teams (T4), proposing, the other coach answering, the club's one
      notice, the per-schedule switch (T7). Phone first: it lives in the coaches portal.
- [ ] `/dba`, then the migration: a trade record (proposing team, other team, the slots each way, its state) modelled on
      the hand-back record; dictionary + snapshots as in Stage 2.
- [ ] A coach read of the same schedule's other teams: team name, time and field only.
- [ ] One locked step on accept: moves each team on the slot, moves each team's practice in place, refuses a team twice
      at once or a field kept for another group (T6), and records the trade so the next Send the changes does not report
      it as an unsent change.
- [ ] "Like-for-like" is decided by the bill's own measure (same priced minutes at the same kept rate), not by eye.
- [ ] The notice to the club (the schedule's builders), naming anything T6 lets through.
- [ ] Permission: T5. Guard that the closed-season rules hold (a trade is an instrument: live season only).
- [ ] `/legal` check before hand-off: a new notice between coaches and to the club.

### Stage 5 — Give and take, the bill follows (T2, T3)
Migration only if Stage 4's record needs it.
- [ ] Drawing: give and take as a trade with one side empty; what each coach is told it costs before agreeing; the
      paid-in-full case as it reaches the club's money person.
- [ ] Price the trade for exactly the two teams with the existing arithmetic (`changesMoney`, `billCorrections`,
      `correctionInstallments`) at the kept rates. No second way to price a slot.
- [ ] Move the baseline in the same step (`club_schedule_sends.team_values`), with the hand-back add-backs
      (`measureWithHandBacks`), so the club's next Send the changes neither bills nor credits the trade again.
      **A dedicated test:** a trade, then an unrelated club change sent, bills only the club's change.
- [ ] T3: the giving team already paid → a request to the club's money person (the shipped path for a loss on a paid
      bill), not an automatic credit.
- [ ] The notice names a team now over or under its share (T6).
- [ ] `/dba` review of the step; `/review` on the money path.

### Stage 6 — The Close
- [ ] `/simplify`, `/review`, `/docs` (the scheduler and coach help articles), one `/marketing` pass per stage for the
      words below, `/demos` at the next cycle, the walks.
- [ ] Records: this plan, the board line, the data dictionary.

## 5. Architectural decisions (open until `/dba` and the drawings)

- **Decision:** the same-time rule lives outside the week's placement flow, as a step before it. **Rationale:** the flow
  places each team separately and cannot express "A at this start only if B is too"; kept slots are already honoured by
  the quota and the violation check.
- **Decision:** a trade is priced by the Send the changes arithmetic, never by new arithmetic. **Rationale:** a sent
  bill's terms never change; one place works out what a slot is worth.
- **Proposed by `/dba` (2026-11-25); RULED by the owner 2026-11-25 (round 1 Ask 1 A): halves are stored as shape
  (B).** ⚠ Ask 4 B (up to four parts) and round 2 Ask 2 A (the halves A–B and C–D of a quartered field, ruled
  2026-11-25) change how a booking names its part: `/dba` re-passes that before the migration (Stage 2). Ask 14 C with
  round 2 Ask 1 A puts `league_games` in scope (the column below is no longer conditional) and house league's practice
  time with it; the part comes with the club slot, house league never splits a field. Round 2 Ask 7 A locks any change
  to a field's split while a part is booked, not only lowering it. A field carries a number of parts; a booking names one part, or 0 for the whole field. **This reverses the
  plan's earlier lean to (A)**, whose reason ("(A) keeps every one-field-one-slot reader working") the census disproves.
  (A) keeps the readers that only carry an id working. It breaks the two kinds that matter: every list of a venue's
  fields and every "same id?" clash comparison, and it breaks them silently (Census, Verdict).
  - **Reasons.** (1) **A reader the build misses fails safe under (B)**: it reads a half as the whole field, so it
    over-reports a clash rather than missing one. Under (A) the same miss double-books, or doubles a permit's Held hours.
    With ten separate clash comparisons and a dozen list expansions, some reader will be missed. (2) **Permits do not
    change.** P2 has the club holding the whole field and case C stays "Half cost", so a permit never names a part.
    Every 💲 permit figure (Held, the hour of a field, the price rows, the workbook) is untouched. Under (A) a part
    row would need a share row or bill as a full field. (3) **Pickers, the tournament copy and generator, the library
    and every count are untouched**, because the field stays one row. (4) **A half's price is derived:** the field's
    share ÷ its parts, at the five places a slot's weight is read (✓ grep: engine `:141`, `lib/club-schedule-keep.ts:48`,
    `lib/club-schedule-coach.ts:305`, `lib/club-schedule-server.ts:531`, `app/api/admin/schedules/[scheduleId]/route.ts:239`).
    The cleanest form is one `weightOf(facility, section, permit)`, so none of the five can forget it. No price is stored twice.
  - **Re-pass (`/dba`, 2026-11-25, after round 2): a booking names its part as a set of quarters, a four-bit mask.
    Proposed, for the migration session; it supersedes the column name, values and floor in the two bullets below
    (the shape (B) and the tables in scope hold).** Logged as Finding #55 in `docs/agents/db/DB_ARCHITECTURE_REVIEW.md`.
    - **The value.** `section_mask smallint NOT NULL DEFAULT 0`, always in quarter units whatever the field's split:
      1 = quarter A, 2 = B, 4 = C, 8 = D. Side A of a two-sided field is 3 (A+B) and side B is 12 (C+D): the same values
      as the halves A–B and C–D of a quartered field, because they are the same ground. 0 is the whole field, never 15
      (one spelling for whole, and every existing row and every untaught reader already reads it). Legal by the field's
      `sections`: 1 → {0}; 2 → {0, 3, 12}; 4 → {0, 1, 2, 4, 8, 3, 12}. B–C (6) is never legal (Ask 2 A's fixed pairs).
    - **Why a mask, not a part number** (0 whole, 1–4 the parts, 5 = A–B, 6 = C–D). With a number, overlap and weight
      are a lookup table every reader must copy, and a reader that copies it wrong double-books. With the mask, overlap
      is one expression, `a = 0 OR b = 0 OR (a & b) <> 0`, and the weight is bits ÷ 4, so a side and a half of a
      quartered field weigh the same by construction (round 1 Ask 3 A and round 2 Ask 3 A agree with no extra rule). A
      value means the same ground whatever `sections` says, so the split lock (Ask 7 A) protects which values are legal,
      never what a stored value means. Were Ask 7 B ever wanted, two sides → four quarters rewrites no booking (3 and 12
      stay legal), and four → two needs only that every booked mask is 3 or 12.
    - **The weight.** One `weightOf(facility, mask, permit)` = the field's share × (mask 0 → 1, else bits ÷ 4) at the five
      weight sites below; a quarter of a "Half cost" field is 0.125. One shared `partsOverlap(a, b)` that every clash
      reader imports; no reader writes its own.
    - **The words** come from (mask, `sections`) at read time: 3 reads "side A" on a two-sided field and "quarters A–B"
      on a quartered one. Nothing stored holds a word.
    - **Columns: the same five tables, renamed** `section_mask` (`facility_section` reads as one part):
      `club_schedule_slots`, `org_time_block_facilities`, `rep_team_events`, `league_practices` and `league_games` (in,
      not conditional: round 2 Ask 1 A). On each a named CHECK `<table>_section_mask_valid`: `section_mask IN
      (0,1,2,3,4,8,12)`; on the four booking tables also `section_mask = 0 OR <its facility column> IS NOT NULL` (a part
      without its field means nothing). `org_venue_facilities.sections`: CHECK `IN (1, 2, 4)`, not 1–4 (thirds cannot be
      written in quarters; if ever wanted, the mask widens to twelfths, an advisory, not this build).
    - **Copied, not derived, downstream.** `rep_team_events`, `league_practices` and `league_games` already copy their
      slot's field (`org_venue_facility_id`); the part is written beside it in the same statement wherever the field is
      copied from a slot (a game reaches its slot through `league_slot_uses.slot_id`, a practice through
      `club_schedule_slot_id`). **Counted 2026-11-25:** on dev every row made from a slot sits on its slot's field
      (385 rep events, 7 house-league practices, 64 house-league games; 0 differ); prod holds none. A house-league hand
      edit that changes a game's or practice's field writes 0 (house league never splits a field, round 2 Ask 1 A).
      Deriving the part through the slot was rejected: every clash reader on these tables compares the field column
      directly and would need a join to learn the part.
    - **The floor becomes a constraint, not a trigger.** `btree_gist` is installed (mig 380; the plan-grant exclusion is
      the precedent). Replace `club_schedule_slots_family_place_start` with an exclusion constraint on
      (`family_id` =, `org_venue_id` =, `coalesce(facility_id, nil uuid)` =, `section_range(section_mask)` &&,
      `tstzrange(starts_at, ends_at, '[)')` &&), where `section_range` is an IMMUTABLE function: 0 → [0,4), 1 → [0,1),
      2 → [1,2), 4 → [2,3), 8 → [3,4), 3 → [0,2), 12 → [2,4). Every legal mask is a run of quarters next to each other,
      which is what lets a range stand in for the bits. It refuses a whole and a part, quarter A beside A–B, and any two
      slots at overlapping times on one place in one family, race-free and with no trigger. **It is stricter than today's
      index** (overlapping times, not an equal start): counted 2026-11-25, 0 overlapping pairs among dev's 1,516 slots;
      prod has none. The migration re-counts both before it adds the constraint.
    - **What stays a trigger:** a mask legal for its field's `sections` (needs the facility row); on
      `org_time_block_facilities`, no part on a permit-owned block and no two overlapping masks of one field in one block
      (its primary key becomes (block, facility, section_mask)); and the split lock: an update of `sections` is refused
      while any of the five tables names a non-zero mask on that field (round 2 Ask 7 A: any change, not only lowering),
      in the route and in a trigger on `org_venue_facilities`.
    - **Build notes for the migration session.** (1) An exclusion clash raises SQLSTATE `23P01`, not `23505`:
      `lib/club-schedule-server.ts:137` maps only the unique violation to the "changed" refusal, so it must learn the new
      code and constraint name, or a clash shows as a server error. (2) An exclusion constraint checks each row as it is
      written: a save that inserts its new slots before deleting the old ones would now fail where the equal-start index
      let a shifted grid through. Read the save paths' order first; if needed, make the constraint
      `DEFERRABLE INITIALLY IMMEDIATE` and defer it in that one function. (3) Add a named CHECK `ends_at > starts_at` on
      `club_schedule_slots` first (none is in the dev snapshot), because a range whose start is after its end raises an
      error rather than a refusal.
  - **Proposed columns (named for the migration session; not "part", which already means time added to a schedule
    (mig 491) and a house-league time row (`lib/league-time.ts:46`); words for customers go to `/marketing`):**
    `org_venue_facilities.sections smallint NOT NULL DEFAULT 1`, CHECK `org_venue_facilities_sections_range`
    (1 to 4; the product offers 2 unless the drawing rules otherwise). Then
    `facility_section smallint NOT NULL DEFAULT 0` (0 = the whole field), with a named CHECK `>= 0`, on
    `club_schedule_slots`, `org_time_block_facilities` (a schedule's row, P3), `rep_team_events` and
    `league_practices` (the practices Send the changes writes from a slot), and on `league_games` only if
    house-league games may be generated on halves (an ask). A default of 0 means every existing row, and every reader
    not yet taught, reads the whole field. No `org_id` question arises: each column sits on a table already scoped.
  - **Proposed floor.** The unique index becomes (family, venue, coalesce(facility), facility_section, starts_at).
    A trigger on `club_schedule_slots` (one table, no join) refuses a whole-field row and a section row of the same
    field at an overlapping time in one family, and a section above the field's `sections`. A trigger on
    `org_time_block_facilities` refuses a section on a permit-owned block (a permit holds whole fields) and one above
    the count. `org_time_block_facilities`' primary key becomes (block, facility, facility_section). Lowering a field's
    `sections` is refused while anything names a higher one (route and trigger). Across schedules there is no database
    floor today and none is proposed. It stays the app's clash pool, which is Stage 2's owed "sees other schedules"
    item.
  - **What changes under (B).** The 40 census rows marked for (B). The bulk is in the builder: every place key
    (`slotKeyOf`, `pos`, `facKey`, `placeKey`, the grid cells, the PDF cell at `lib/club-schedule-document.ts:160`),
    the weight ÷ parts, the exclusivity guards (`heldSlots`, the seat, `familyClashes`, `slotsWithPinned`), the words,
    and the Send step writing the section onto the practice. Outside the builder: the two clash rules
    (`clashKindOf`, `placementsShareSurface`) compare (facility, section) with 0 meeting every section; the pool
    selects the column; the library gets a parts control and the lower-the-count refusal. Permit use (Booked) and free
    time learn sections, to stop over-counting.
  - **Shape (A) would be the right call only if** halves needed their own names, prices or bookings outside the club
    schedule (a coach booking "the north half" for a team event, a tournament on half a diamond). Then a small child
    table of named sections, still referenced as (field, section), is the step up. It is still not a second facility
    row.
  - **Pre-existing, Low, logged 2026-11-25 as Finding #56:** the correction's hours figure counts a gained shared slot
    at the full slot (`lib/club-schedule-send.ts:421`, `:678`); the amount is right. Fix it in Stage 2 so sharing and
    parts read alike. The ruled shape and the re-pass are Finding #55.
- **No new plan gate proposed.** These live inside the club scheduler and the coaches portal as they are gated today;
  reconcile against `docs/agents/strategy/PLAN_PRICING_FACTS.md` at each build, and route any gate question to `/strategy`.
- **`/accounting` is not triggered:** this is the product's customer bookkeeping, not FieldLogicHQ's own.

## Words for /marketing

> Settled in ONE `/marketing` pass per stage, before the walk. Working words only.

- [ ] "Teams at the same time" / "Never at the same time" — the rule's names in "Add a rule" — the club's schedule builder
- [ ] The per-rule report sentences (placed together, could not, and each reason) — draft cards and the "why" window
- [ ] The entry-time refusal for a group that can never line up — New schedule
- [ ] The trade proposal, the answer and the club's notice — coaches and the schedule's builders
- [ ] The per-schedule switch's label — the schedule's settings
- [ ] The names for a field's parts — the venue list, the schedule's rows, the grid, the PDF. Working words: the "Two sides" tick
      and its locked line, "Field 1 (whole)", "side A", "Field 1 in two sides", "Field 2 side A", the "holds … That time is left out." line,
      the draft line "Whichever is finalized first keeps it", the Split hint's "a half field or one side". Round 2 (Ask 4
      A, ruled 2026-11-25): the select's "Not split" / "Two sides" / "Four quarters" and its locked line, "quarter A", "quarters A–B",
      "Field 1 in four quarters", "Field 1 quarters A–B, C and D", "Quarter A" / "Quarters A–B" grid rows, the PDF's
      two-line part headings, the bill's "quarter-field slots" and "a quarter $20.00"
- [ ] House league (round 2): the time row's "Field 1 in two sides, Field 3", the line "Field 1's sides hold one team
      each. Teams at once is for whole facilities.", "Teams at the same time" and its door, the rule sentences with
      divisions, the notice's report lines, the R6 refusal — Practice time; a part in every place word (tab 8)
- [ ] The Used line: "Of the unused time, 9 h is open slots on {schedule}: the schedule holds it and no team has it yet."

## Open questions

- [x] Does drawing start now or does the project wait on the board? The owner started the halves drawing session
      (2026-11-25).
- [x] Stage 0's two confirmations (the sharing rule's silence; the dropped placements). Done 2026-11-25 (Stage 0).
- [x] **Asks the census adds to the halves drawing (2026-11-25):** all put to the owner in the round 1 drawing
      (Stage 2, "Drawing, round 1: the asks", Asks 1–9 and 14) and ruled 2026-11-25.
- [x] **Does Ask 14 C widen Ask 5 to house-league time a club schedule hands out (practices and games)?** **Yes, ruled
      2026-11-25 (round 2 Ask 1 A):** the part comes with the slot; house league never splits a field.
- [x] **On a field in four quarters, may a team also use half of it (two quarters together) and the whole?** **Yes, ruled
      2026-11-25 (round 2 Ask 2 A):** the fixed pairs A–B and C–D; it changes how a booking names its part (`/dba`).
  - The storage shape: (B), as `/dba` proposes in §5, or (A).
  - **Does a practice on half a field count as one practice or half a practice toward a team's share** (under "Evenly"
    and "By percentage")? Today a shared slot counts ½ and a "Half cost" field counts 1. Left as it is, halves hand
    out and bill half the time sharing does for the same picture (Census, the two bills).
  - **A half's price:** the field's price ÷ 2, derived, as (B) proposes. The bill and the schedule should show it,
    and the drawing decides whether a club may change it.
  - **Halves only, or up to four parts?** Do the parts have names ("North half") or numbers? Names push toward a
    small table of named parts (§5's step up).
  - **Words.** "Half field" and "Half cost" already mean a price share (case C), on the bill and the PDF. "Part"
    already means time added to a schedule, and a house-league time row. Halves need words that are neither
    (`/marketing`).
  - **How far halves reach.** Club schedule slots and the practices they make, only (as proposed)? Or also
    house-league games generated on club time, a coach's own event, tryout days, tournaments? Each one widens the
    migration by one table and its readers.
  - **The grid:** one row per field with a split cell, or a row per half.
  - **Permit use:** until permit use learns halves, a half booking shows the whole field as Booked at that time. The
    drawing says what Used shows (already owed, Stage 2).
  - **Three ways to put several teams on one field would exist:** "Sharing a facility" (rep), house league's "teams at
    once" for practices, and halves. The drawing says how they relate.
- [x] Do rows get their own dates on the form (Stage 1's drawing)? **No, not now (S5, 2026-11-25).**
- [x] What does "Sharing a facility" become beside halves (Stage 2's drawing)? **Ruled 2026-11-25 (Ask 6 A):** all three
      kept, counted and billed alike; a side is never shared.
- [ ] Does a trade tell families (Stage 4's drawing)?
- [x] House league: whether the same-time rule and halves apply to a house-league schedule. **Ruled 2026-11-25 (Ask 14
      C): both reach house league** (drawn in round 2; not "unchanged": house league divides its own practice time).
      Coach trades are rep teams only unless ruled wider.
