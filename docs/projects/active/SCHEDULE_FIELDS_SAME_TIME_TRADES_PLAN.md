# Club schedules: part of a permit, teams at the same time, coach trades — plan

> **Status:** on the board (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `schedule-fields-trades`). Never restated here.
> **Created:** 2026-11-25 · **Branch:** dev · **PM brief:** [SCHEDULE_FIELDS_SAME_TIME_TRADES_PM_BRIEF.md](SCHEDULE_FIELDS_SAME_TIME_TRADES_PM_BRIEF.md)
> **No build go has been given.** The owner agreed the recommendations and said "go ahead with step 1" (this record). Each
> stage is drawn and ruled before it is built.

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
- The several-permits plan owes ONE `/plan` item: the permit's Used figure, the finder's pick and the builder do not see
  other schedules' final time (`CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md`, Session D review note).

**Leads from helper searches (NOT yet opened by a building session; verify before building on each):**

- No draft line reports a sharing rule that could not pair (the `sharing` measure lists only rules used at least once).
- When the builder's 12 repair attempts run out, the bad placements are dropped without a report (`holdable`).
- "Find the time across every permit" lets the admin tick Field 1 and Field 2 only, and the row keeps its permit and
  price (`rowsFromFound`, `lib/club-schedule-permit-rows.ts`). Read from code, not run in a browser.
- Schedule From/To are not held inside the permit's dates on a one-permit schedule (a To typed past the permit's end
  cuts slots past it).
- The place-unique index is per schedule family, so two separate schedules can hold the same field at the same start;
  the builder reads bookings, never another schedule's draft or open slots.
- Coaches read only their own team's slots; the one cross-team glimpse is the venue clash check.
- Hand back and take back need the schedule permission (assistants hold it by default); money asks need the team's
  money access; replying to a review is head coach only (`lib/coach-capabilities.ts`).
- A loss on a team that has already paid becomes a request to pay rather than a credit (`lostTime`).
- Coach notices from the scheduler are bell only; rep families are not messaged about a club slot change.
- The venue list has no parent or part-of-a-field idea (rests on a missing column and a grep).

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
| R8 | **The report is per rule, and it covers "Sharing a facility" too**, if the check in Stage 0 confirms sharing falls back silently. |
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
- [ ] Confirm whether a sharing rule that cannot pair is reported anywhere on a draft (R8 depends on it): read
      `measure` / `measureLines` (`lib/club-schedule-engine.ts`, `lib/club-schedule-words.ts`) and run one fixture where
      a pair cannot meet.
- [ ] Confirm the `holdable` drop is unreported, and decide whether the per-rule report names it.
- [ ] Census every reader of a venue facility (permits, the builder, the clash checks, bookings, house league, tournaments,
      the public site) for Stage 2. Hand it to `/dba` with the two storage shapes in §5.
- [ ] Owner, in a browser: New schedule › "Find the time across every permit", tick two of a permit's fields, generate.
      This is today's route to P1 and has only been read from code.

### Stage 1 — Pick the fields (P1)
No migration expected.
- [ ] Drawing: a permit's rows in New schedule gain the Facilities ticks; what a row reads when some fields are off; the
      ask on per-row dates (§3).
- [ ] `components/admin/kit/club/schedules/NewScheduleWindow.tsx`: the card row (`rowFields`, `rowPlaceWords`) takes the
      tick-list field typed rows use; "Add hours" keeps its place rule.
- [ ] `lib/club-schedule-permit-rows.ts` / `lib/club-schedule-server.ts` (`readTimeBody`, `checkTime`): a permit row may
      name a subset of its permit's fields; refuse a field the permit does not hold.
- [ ] Settings… on a draft and Add time use the same row; check `lib/club-schedule-keep.ts` keeps a narrowed row on a
      regenerate.
- [ ] The bill: nothing to change (only slots with a team are billed; the closing row already says "less than the
      permit's"). One test that 2 of 6 fields bills those hours only.
- [ ] Hold a one-permit schedule's To inside the permit's dates, or say why not (the lead in §1).

### Stage 2 — A field in halves, and the builder sees other schedules (P2, P3)
Migration first. Drawn together with Stage 3.
- [ ] `/dba` on the storage shape (§5), then the migration; **update `docs/agents/db/DATA_DICTIONARY.md` and run
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
      give two different bills for the same picture.

### Stage 3 — Teams at the same time (R1–R10)
No migration expected (the rule is one more entry in the schedule's settings).
- [ ] Drawing: the rule row with its "at the same time / never at the same time" choice; the entry-time message (R6); the
      per-rule report on the draft cards and in the "Open slots and short teams" window; the hand-move warning (R7).
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
- **Open — halves, two shapes for `/dba`:** (A) a part is its own row in the venue's field list with a link to its
  field; (B) a field carries a number of parts and a slot names which part. (A) keeps every "one field, one slot" reader
  working and puts the new rule in the clash checks; (B) touches the slot key everywhere. Recommended to `/dba`: (A).
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
- [ ] The names for a field's parts — the venue list, permits, the schedule grid

## Open questions

- [ ] Does drawing start now or does the project wait on the board? (Owner; asked 2026-11-25, not yet answered.)
- [ ] Stage 0's two confirmations (the sharing rule's silence; the dropped placements).
- [ ] Do rows get their own dates on the form (Stage 1's drawing)?
- [ ] What does "Sharing a facility" become beside halves (Stage 2's drawing)?
- [ ] Does a trade tell families (Stage 4's drawing)?
- [ ] House league: its schedules read in place and use the same builder. Whether the same-time rule and halves apply to
      a house-league schedule unchanged is a check for Stages 2 and 3; coach trades are rep teams only unless ruled wider.
