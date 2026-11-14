# A schedule on several permits (DRAWING session first, build prompt after)

> Written 2026-11-13 (owner's request, the same day the plan was written). Paste into a **fresh chat on `dev`**:
> `execute @docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. Its output:
> - one published drawing (a Claude Artifact);
> - the owner's rulings on asks P1–P13;
> - a **build prompt** for the five build sessions.
>
> Recommended model: Opus. Run `/ux` and `/design` before the hand-off. It touches no code, so it can run beside any
> build.
>
> **When:** after the Stage 13c walk (§502) and its layout sweep. **The build does not start until Stage 13d is built
> and committed** (owner 2026-11-13). If 13d has landed by the time this session runs, draw against it; if not, draw
> against 13d's plan and say so.
>
> **Plan of record:** [CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md](CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md), with §2 the code
> today, §3 the core idea, §4 the pieces, §5 how connected, §6 findings, §7 the asks, §8 phases and §9 sequencing. Its
> [PM brief](CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md).
>
> **Inputs:**
> - the parent permits and scheduler plan ([CLUB_PERMITS_AND_SCHEDULER_PLAN.md](CLUB_PERMITS_AND_SCHEDULER_PLAN.md),
>   Asks 21/23 on prices and the split, §8 "not in the first cut");
> - the 13c build prompt's "Not in this build" list ([CLUB_TIER_STAGE13C_BUILD_PROMPT.md](CLUB_TIER_STAGE13C_BUILD_PROMPT.md)),
>   whose parked items this project absorbs;
> - the bill-amend plan ([CLUB_BILL_AMEND_AFTER_MADE_PLAN.md](CLUB_BILL_AMEND_AFTER_MADE_PLAN.md));
> - the late-bill Money-audience plan ([LATE_BILL_MONEY_AUDIENCE_PLAN.md](LATE_BILL_MONEY_AUDIENCE_PLAN.md));
> - Stage 13d in [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) (Ask 15:
>   the draft bill on the treasurer's line, the double-bill warning).
>
> **Facts:** mark each fact **[V]** (you opened it this session, with file:line) or **[H]** (handed to you here,
> unverified). Everything below is [H] unless marked.
>
> **Git:** branch `dev`; explicit pathspecs; ask before committing; never push.

## Where things stand (say it at the top of the hand-off)

- **Planned 2026-11-13; nothing drawn, nothing built.**
- **Today a schedule holds one permit.**
  - Picking a second permit replaces the first one's time.
  - The permit can't be changed after the schedule is made.
  - Every price comes from that one permit.
  - A date off covers every venue on the schedule.
  - Nothing works out free time across permits.
  - Rebuilding a sent schedule can reshuffle practices on days already passed, unless their weeks were locked
    (plan §6, F1).
- **[V] Before drawing, open the code and confirm plan §2.** It was checked 2026-11-13, but 13c's bill items, the
  late-bill Money-audience build and 13d may all have moved the New schedule window, the Bill window, Send and the
  schedule page since.
- **Confirm whether the late-bill Money-audience build is committed.** It edits the same windows. Draw on top of what is
  committed and note anything still in the working tree.

## What is already ruled (do not re-ask)

**Owner, 2026-11-13** (the asks behind this plan):
- A schedule holds several permits.
- The admin **chooses** how the bill prices the time: each permit's own price, or one rate for all.
- A date off opens a **window to choose its venues, defaulting to All**.
- The Outside-the-permit warning, the permit's "used by" list and its delete guard, and the New schedule picker all
  learn several permits.
- An **"any permit"** start lists every diamond and field the club holds and narrows as criteria are added ("the next
  3 months" → "Tuesdays and Thursdays" → "6–8 p.m." …).

**Settled scheduler rules this project keeps:**
- The schedule **owns its own time**: copied from a permit, never pointed at.
- Prices follow the permit until the bill is made.
- **Bill terms never change** once made; later changes are correction bills and credits.
- A sent schedule changes only through **Send the changes**.
- House league is never billed.
- A permit can cover several venues.
- "The permit is a link the schedule keeps", for the 2026-10-12 reason: a club's second year wants both, last year's
  teams on this year's permit.
- Coach books stay the team's (2026-11-06): the club's bill never reaches family dues. Don't draw a bridge to dues.

## What to draw (desktop first, the phone where it differs)

Draw on **one fixture the whole drawing shares**: a club with two towns' permits at different prices. For example, Town
A at $40 a full diamond-hour (March–May) and Town B at $60 (April–June), a fourth-month permit added later, four rep
teams and a house league. Every figure on the page is computed from that fixture, never typed. Draw each control from
its shipped component.

1. **New schedule with several permits.**
   - The picker as a multi-pick, with "Any permit — find the time" and "No permit".
   - Rows carrying their permit.
   - The From/To dates widening.
   - The read-only mixed-places line.
   - Removing one permit's rows.
   - Copy last year's schedule, then pick two permits.
2. **Find the time (the finder).**
   - The owner's narrowing, frame by frame: all held facilities in the next 3 months → Tue/Thu → 6–8 p.m. → diamonds
     only.
   - What each row says, and time held by another schedule's draft.
   - Time two permits both hold.
   - The empty result.
   - Picking rows into the schedule.
   - Then the phone: is the finder usable at 390 px, or is it desktop-only with an honest phone message?
3. **Add time on an existing schedule.**
   - The door on the schedule page.
   - The same picker or finder.
   - On a **final** schedule: the new month waiting in "Changed since sent", then Send the changes with its correction
     bill.
   - Remove a permit.
   - What the admin is told about past practices never moving (P10).
4. **Dates off with venues.**
   - The row's "Applies to: All venues".
   - The venues window.
   - A permit's copied dates off scoped to its own parks.
   - Needs attention's Outside the permit across two permits, with "Take … off".
5. **The bill.**
   - The Bill window's "Price the time: Each permit's price · One rate for all", both modes on the same fixture side by
     side, with the totals equal and the shares different.
   - The fair-shares table with hours by permit.
   - "Part" (a typed amount) under each mode.
   - The coach's Money › Club line, unchanged.
   - If 13d is built: the treasurer's budget-line view of this bill.
6. **The permit and schedule tops.**
   - The schedule's top line with two permits ("From … and … ›").
   - The permit window's "used by" list.
   - The delete guard's words.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **Is "one rate for all" worth a control?** The owner asked for the choice, so draw it. Then argue from the fixture
  whether a club would really pick one rate, and whether the choice belongs on the bill (per schedule) or as a club
  setting. Do not drop the choice; give the owner the trade.
- **The finder's honesty.** "Free" leaves out drafts that haven't been finalized, unless P7 says otherwise. Draw what
  happens when two admins find the same Tuesday in two drafts. Say whether that needs a warning at Finalize, and name
  the screen.
- **Add time vs Settings….** Two doors that both change a schedule's time can confuse. Argue whether Add time should
  live inside Settings… or beside it, and draw your pick.
- **The bill-amend project answers "terms never change" from the other side.** Read its plan and its drawing, if one
  exists by now.
  - Make sure the stored per-permit rates this drawing proposes leave it a clean answer.
  - List any conflict as an ask.
  - Do not draw the amend itself. The owner may choose to merge the two sessions; offer it if the conflicts are real.
- **Do not widen by accident.** Several of these screens are shared: Needs attention, the Overview card, the Calendar
  day mark, house league's Schedule health, the coach's review card. List every screen a change reaches before
  promising it.

## Steps

1. **Read** the plan (all of it), the PM brief, the parent plan's Asks 21/23 and §8, the 13c "Not in this build" list,
   the bill-amend plan, the late-bill audience plan, and 13d's part of the Stage 13 plan.
2. **Settle the facts from the code**, re-checking plan §2: the New schedule window, the Bill window and its fair-shares
   arithmetic, Send the changes and its correction bills, the dates-off rows and the Outside-the-permit read, the
   permit window's "used by", and what bookings the permits' "Used" counts. Correct plan §2 where it has drifted.
3. **Draw.**
   - Publish it as a Claude Artifact HTML page, never the design canvas.
   - Follow the house layout: sticky numbered tabs, one decision per tab, the last tab "Asks"; minimal scrolling; an
     *Everything / Show only what differs* toggle (the bill's two modes, before/after).
   - Draw whole screens before and after, at true size.
   - Draw each control from its shipped component.
   - Tag NEW / RESTYLED / UNCHANGED.
   - Make every highlight clickable.
   - Money figures sit in one joined band; phone figures are rows, not tiles.
   - Write the source next to the plan as `CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html`.
4. **Asks.** Turn P1–P13 into numbered asks, each with a recommendation and the alternative, and add any new ones the
   drawing raised. **Put the ones that change the shape of the build first** (P1, P9, P10, the Add time / Settings…
   question).
5. **Run `/ux` and `/design`** and apply what they find before publishing; say in the hand-off what each changed.
   `/accounting` and `/legal` are not needed: this is the club's bookkeeping, not FieldLogicHQ's, and no new email or
   personal data is added. If the drawing adds an email, run `/legal`.
6. **Publish** the Artifact once. Do not edit product code.
7. **Hand off in product-owner voice:** what an admin sees and does differently, what a treasurer and a coach see, the
   asks, and the order. Record it in three places:
   - the plan: one status entry with the Artifact link;
   - this project's TODO line;
   - the auto-memory note `project_schedule_several_permits.md`.

## After the owner rules

Write **`CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md`**, in sessions following plan §8, A–E (the drawing may
reorder them). It must include:
- the three migrations and their production-apply order, with `/dba` on each (per-row permit, dates-off venues,
  per-permit bill rates), plus the dictionary and snapshots;
- the guards:
  - no reader of a schedule's permit uses a single column;
  - money arithmetic recomputed from rows, where both price modes total the same and shares add up to the cent;
  - a final schedule never moves a past slot;
  - Add time never moves an existing slot;
- help articles (`/docs`), words (`/marketing`), and a QA walk with its own Owner QA Ledger section on the two-town
  fixture.

**Start condition, in the build prompt's header: Stage 13d built and committed (owner 2026-11-13).**

## Do not

- Build or edit product code.
- Draw a sync that pushes permit edits into a sent schedule, or a bridge from the club's bill to family dues.
- Reopen bill terms after a bill is made (that is the bill-amend project's question).
- Re-ask a ruled question, or record the owner's answers as anything but what they said.
