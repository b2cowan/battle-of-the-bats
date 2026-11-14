# A schedule on several permits · build prompt (five sessions and a close)

> Written 2026-11-14, after the owner ruled the drawing's 20 asks: **all A except P9 = B** (the drawing page's paste-back, 2026-11-13/14).
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session A of @docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md` (then B, D, C, E, Close: **that order**, see "Order").
>
> Drawing (the spec): https://claude.ai/artifact/GLdh4E19UsKzBkLdH9UACU, source
> [CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html](CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html) (its Asks are in the `ASKS` array near the end of the file).
> **Open the drawing's tab for the piece you build: its numbered notes carry the exact words and rules; this prompt does not restate them.**
> Plan of record: [CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md](CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md) (§2 what the code does, §4 the pieces, §8 phases).
> PM brief: [CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md](CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md). Drawing prompt: [CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWING_PROMPT.md](CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWING_PROMPT.md).
> Marks: **[V]** = the writer opened it 2026-11-14; **[H]** = from the plan's §2 (verified 2026-11-13) or a helper, **re-open before editing**.
> Line numbers drift. Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus.
> Size: **Large**, five build sessions, a words/help/walk close. **Three migrations** (dev only; prod order recorded in the plan).

## What this builds

**One schedule per season, however many permits it sits on.** A club's season sits on whatever the towns issued: three months plus a
fourth on a second permit; two towns' parks for one league. After this:

- **New schedule** ticks several permits; each permit adds its rows, and each row shows its place and its permit. (Session A)
- **A date off names its parks**, defaulting to All venues; a permit's copied dates off apply to its own parks only. (Session B)
- **"Find the time across every permit"** narrows what the club holds by dates, days, hours, kind, place and block length. (Session D)
- **The Bill window gains "Price the time"**: each permit's price (default) or one rate for all. (Session C)
- **Add time** on a schedule that exists, **taking a permit off**, and the fix so **a sent schedule never reshuffles a practice already
  played**. (Session E)

The standing rules are kept, not reopened: the schedule owns its own time (copied, never pointed at); a permit edited later is **surfaced,
never pushed** (P8, answered by the rule); a sent schedule changes only through **Send the changes**; **bill terms never change once made**;
house league is never billed; family dues are untouched; coach books stay the team's.

## Owner rulings this build carries (2026-11-13/14, the drawing's 20 asks)

All **A** (the drawing's recommendation) except **P9 = B**. Read the drawing's ask text for each; the one-line meaning:

- **S1 A** Add time sits **beside** Settings…, **first in Tools**. Settings… is unchanged. Taking a permit off stays in Settings… (P11).
- **P10 A** Regenerate, Add time and "Take … off" **never move a slot before today on a sent schedule**; the regenerate question says how many stay. One guard, tested.
- **P9 B (the owner's call, and the reason matters, so it is quoted):** *"in those instances users don't want a complicated recalculation. There
  was an ad hoc permit that was needed because time was added to the schedule. The previous payments stay the same and just the new amounts
  are added to the impacted coaches' payments. It's basically a new separate permit that wants to be part of the same schedule."*
  **Build exactly that:** on a billed schedule, time added later on a permit that was **not behind the bill when it was made** is billed at
  **that permit's own price, whichever mode the schedule was billed in.** One rate keeps meaning "one rate for the time it was billed for";
  later permits are separate increments. See "⚠ P9 B, built as the owner described it" below.
- **P1 A** One rate = the time at the permits' prices ÷ all priced hours (same total, re-shared). **P2 A** The choice lives in the Bill window, per schedule, shown only when the
  time has more than one price; default **Each permit's price**. **P3 A** A typed "part": shared by priced dollars (each permit's price) or by priced time (one rate).
- **P4 A** Two permits holding the same field and hour: the row's own permit prices it; the finder lists the time once, names both permits and asks which prices it, starting on the newer.
- **P5 A / P6 A** A permit's copied dates off, and "Take … off", apply to **that permit's parks**; typed dates off default to All venues. **Venue scope only**, not field by field.
- **P7 A / P7b A** The finder counts other schedules' drafts as taken, named on the row ("4 held by a draft (Spring house league 2027)"). **No** "Show time held by drafts" toggle,
  **no** new Finalize warning. A found row that includes days a draft holds comes in, says so on its card, and the drafts step warns on them like a clash.
- **P11 A** Taking a permit off a sent schedule is allowed, in Settings…: practices from today on come off through Send the changes with credits; played practices and their bill stay.
- **P12 A** The finder lives in New schedule and Add time. **The Permits-page "Free time" view is NOT built here** (it is a later door onto the same reading). See "Session D".
- **P13 A** "Paying for time per slot" in the permits plan §8 means paying a town as you book; this project does not reopen it, and books or pays no town.
- **N1 A** "Find the time across every permit ›" is a **door under the picker**, not a picker entry. **N2 A** The read-only mixed-places line **goes**; each row shows its place under its permit's card.
  **N3 A** On a copied schedule, the first permit ticked **replaces** the copied time (teams, shares, rules stay). **N4 A** "Applies to" is the permit form's own **tick-list field**, "All venues" first.
  **N5 A** The bill-amend project stays **separate**; this build carries its three guards (below). **N6 A** Two permits on two budget lines: "Bill from" starts on the line of the permit with the most priced time, and says so under the field.

## Order, and what gates what

**A → B → D → C → E → Close.** Not the lettering's order, because of two dependencies:

- **D needs A** (found rows carry their permit). **E needs C** (Add time on a sent schedule bills a correction at a stored per-permit rate, which C creates). B is independent of C and D.
- **Session C's gate is MET: the Stage 13d walk (§528) PASSED 47/47 on 2026-11-14, no findings.** (Was: C does not start until it passed or its findings were fixed.) C reprices the bill that 13d's
  Bill-window warning and the budget line's "being billed" both read. Ask the owner for the §528 result at the start of C. A, B and D do not wait for it.
- ⚠ **Uncommitted work sits in the Bill window and the Send window today** [V: `git status` 2026-11-14 shows `BillWindow.tsx`, `SendWindow.tsx`, `Schedules.module.css` and
  `lib/club-schedule-words.ts` modified, and none of it is 13d's or this project's]. **Do not commit it as yours.** Ask the owner whose it is before editing those files. If it is still
  uncommitted when C starts, **stop and ask** (C edits the Bill window heavily). A and B touch `NewScheduleWindow.tsx`: check its state first.
- 13d's Session B added draft-bill readers (`lib/club-draft-bill.ts`, `lib/club-draft-bill-server.ts` [V exist]). **They read a schedule's bill and must move with C**, not be left reading the single permit.
- **Migrations: the next free number at the time** (486 exists [V]; 13d or another session may have taken more). Dev only, prod order recorded in the plan and `MANUAL_PROD_STEPS.json`,
  **`docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work**, a SQL fixture beside each. Run `/dba` on all three before applying any (Open question in the plan).

## ⚠ P9 B, built as the owner described it (read before Session C and E)

The owner's model, in plain terms: **the bill that was made is a closed set of terms. A permit added afterwards is its own small bill, added to the teams it touches.** Nothing already
billed is recalculated.

1. **Price of added time.** A slot on a permit that was **not behind the bill when it was made** prices at **that permit's own price** (the weight of its field on that permit × that permit's
   full-hour rate), **in both modes**. That price is **stored at the moment of the send that first bills it**, per permit, and used for every later correction on that permit.
2. **A permit already behind the bill keeps its term.** Each-permit mode: its stored rate. One-rate mode: the one rate. So Add time that merely extends a permit already on the bill
   (more evenings on the same permit) bills at the term that permit already has. **This is the build's default reading of the owner's "new separate permit"; say it in the summary and the Bill
   window's read-only view, and let the owner overrule.**
3. **Nothing re-spreads.** The amount for added time is **a new amount on the teams it touches**, not a recalculation of their earlier amounts and **not a re-spread of their unpaid payments**.
   **First read how a correction lands today** (`billCorrections` / `valuesAfterChanges` in `lib/club-schedule-bill.ts`, and how Send the changes writes `rep_cost_allocations`,
   `rep_allocation_splits` and installments [H, plan §2]). If today's correction **re-spreads a team's unpaid installments**, that contradicts the owner's model: **stop and report** with what
   it does today and the smallest change that adds the new amount as its own payment. The separate bill-amend project owns changing a team's payment pattern (N5); do not start it here.
4. **No "the teams pay $X more than the permit charges" sentence.** The drawing drew that for P9 A (frame notes on the Add-time Send tab, ~1072-1076); under B the new time bills at what
   its permit charges, so the gap does not arise. **Remove that sentence and its computation from the build; keep the line that says which price was used and that it is kept from now on**
   (drawing note 2 at ~1072). Re-read those notes; where a note assumes A, the ruling wins and the note is stale.
5. **The Bill window's read-only view** (after the bill is made) lists each permit's stored rate and, for one-rate bills, the one rate **and** any later-added permit with its own price,
   so a treasurer reading it can see two prices without being surprised. Words: ask `/marketing`; this is a new sentence class.
6. The coach's Money tab and review card read what is stored: a team with added time shows **an additional amount**, not a changed earlier one. Check `lib/club-schedule-coach.ts` [H].
7. **Test, as arithmetic:** a two-permit fixture; bill at one rate; add a third permit's time; assert the earlier shares are **byte-identical**, the added amount equals that permit's price
   × the added priced hours, and each team's new amount adds to the cent. Same in each-permit mode.

## ⚠ Where the drawing and the code disagree, or are silent

1. **The drawing was drawn against an unbuilt 13d** (drawing header). 13d is now built and committed; **re-open each bill screen as it is today** before editing it: 13d added the budget-line
   "being billed" read, the Bill window's "Accounting already bills this line" statement, and "Send the bill" on a final schedule with none. Keep those; reprice through them.
2. **One permit per row is stored on the block, and the old columns stay for one release.** `org_time_blocks.from_permit_id` (new, FK `org_permits`, ON DELETE SET NULL, set only on
   schedule-owned blocks; backfilled from `started_from_permit_id` where the block matches the permit's venue and facilities, else null). `started_from_permit_id` stays as a **read fallback**
   for one release, then retires (decide with `/dba`). `bill_permit_id` becomes the **fallback price permit** for rows with no permit. **Decide from the dev + prod snapshots and live
   `information_schema`, not from migration files.**
3. **Readers that must stop using one column**, all in Session A (plan §8 Phase 1, [H] re-open): `schedulesHandingOut` and the permit delete guard (`lib/permit-server.ts`), the schedule's
   top line / "From the permit ›" door, `?outside=1` (`[scheduleId]/route.ts`) with `readScheduleOutside` (`lib/permit-dates-off.ts`), and the Overview, Calendar and house-league Schedule-health
   readers of it. **Ship a guard test** that no reader of a schedule's permit uses a single column after Session A.
4. **A time row has no visible place today** (`NewScheduleWindow.tsx` ~556-624 [H]); rows that show their place are new, and the "Venue" select that disappears once rows mix goes with N2.
   Field weights are not only Full 1 / Half 0.5: since 2026-10-11 a field can be "A percent" of a full field; **one rate keeps each field's weight** (plan §2).
5. **New schedule is absent at phone width by ruling** (Schedules page header, plan §5.9), so Find the time and Add time are **computer-only, with no phone message**. Do not add one. The drawing's
   phone pass covers the permits top line and the permit window's "used by" only.
6. **"The president's view" / the Permits-page Free time view is out of this build (P12 A).** But **write the free-time arithmetic as a pure module** (`lib/permit-free-time.ts`, plan §8 Phase 4)
   with no knowledge of New schedule, so that later screen is a new door on the same reading and not a rebuild. A test pins "no import from a component".
7. **Dates off are schedule-wide today** (`org_time_dates_off` carries `schedule_id` or `permit_id`, day, note, unique per (schedule, day), saved by delete-and-reinsert). Decide the venue-set shape with
   `/dba` (plan: **one row per day carrying a venue set** reads simpler; no rows in the join = all venues). Existing rows keep meaning All venues.
8. **Draft and in-review slots are not "booked" anywhere today** (plan §2). The finder's "held by a draft" is **new reading**, and is the only place the product says a draft holds time. Do not add a booking.

## Sessions

### Session A · rows remember their permit; several permits on New schedule
Plan §8 Phase 1 and drawing tab "several permits" (pick). **Migration first** (`from_permit_id`), dictionary and snapshots with it. `lib/club-schedule-server.ts`: `readPrices` reads several permits at once;
`weightOf(facilityId, permitId)`; the engine context, `buildEngineInput` and `draftToSave` weigh each slot by its row's permit; the save function (the mig 392 function) writes `from_permit_id` per block.
`NewScheduleWindow.tsx`: a multi-pick that adds and removes rows by permit; rows grouped by their permit's card; the From/To dates widen to cover every picked permit; unticking drops that permit's
edits (and the hint says so); N1's door sits under the picker but **opens nothing until Session D** (render the door only once D ships, behind the same build, or leave it out of A: do not ship a dead door).
Reads that become "every permit behind the schedule" (list in "Where the drawing and the code disagree" 3). Two ticked permits holding the same park at the same hour get the statement the Add-time frame draws.
**Done when:** the guard test passes; a one-permit schedule behaves exactly as before (run the existing schedule and permit unit tests and `check:layout --changed`).

### Session B · dates off with venues
Plan §8 Phase 2 and drawing tab "dates off". **Migration** for the venue set (decide the shape with `/dba`), dictionary and snapshots. The engine and the hand-edit warnings honour the scope (a date off that
names parks blocks only slots there). "Applies to" on the dates-off row, a tick-list field with "All venues" first (N4), **shown only when the schedule has more than one park**. Copying a permit's dates off scopes them to
its parks (P5); Needs attention's "Outside the permit" reads **every** permit behind the schedule and "Take … off" adds the day for that permit's parks only. Existing rows are All.
**Done when:** a two-town fixture where Town A's long weekend leaves Town B's park alone, in generation, hand-edit warnings and "Outside the permit".

### Session D · Find the time
Plan §8 Phase 4 and drawing tab "find". `lib/permit-free-time.ts` (pure): all permits' blocks in a window, minus the permits' dates off, minus `readClubBookings` (finalized practices, house league games and
practices, tryouts, tournament games), minus other schedules' draft and in-review slots (**labelled**, P7). Filters: dates, weekday chips, hours (with optional extra ranges), kind (`facility_type`), venue or issuer, shortest useful
block. Each row says how much matching time is left ("Tue & Thu 6–8 p.m. · 18 evenings free of 24"). P4's same-field-same-hour is listed once, under both permits, with the choice. An API under `app/api/admin/schedules/`
returning the narrowed list (owner/admin, the scheduler gate). The finder opens from N1's door, **keeps the form and its filters** (one loading line), and has the no-permit state the drawing's /ux notes describe;
picked rows become ordinary time rows carrying their permit. **Unit tests on the arithmetic** (the money-adjacent kind: held minus taken, overlapping permits, dates off, drafts).
**The finder reads the same bookings the permits' "Used" already reads** (one model of taken time; reuse `readClubBookings`, write no second one).

### Session C · the bill: each permit's price or one rate   (**gated on the 13d walk, see Order**)
Plan §8 Phase 3 and drawing tab "bill". **Migration:** `club_schedules.bill_price_mode` (`each_permit` | `one_rate`, default `each_permit`) and `club_schedule_bill_rates (schedule_id, permit_id null, scale)` written when the
bill is made (Finalize and the late bill, `club_schedule_bill_late` mig 481 [H]); decide with `/dba` whether `bill_scale` stays as the one-rate value or retires. `lib/club-schedule-bill.ts`: `pricedMinutes` / `billShares` per permit;
one rate = per-permit total ÷ priced minutes (P1); a typed part shared per P3; corrections price at the slot's permit's stored rate (see "P9 B" for permits added after the bill). `BillWindow.tsx`: "Price the time", **shown only
when the time has more than one price**; the fair-shares table shows each team's hours by permit when there is more than one; N6's default line. **Every other bill reader moves:** `lib/club-schedule-send.ts` `contextFor`,
`lib/club-schedule-coach.ts`, `lib/club-schedule-document.ts` export notes, `fairBill` in `lib/club-schedule-view.ts`, **and 13d's `lib/club-draft-bill*.ts`**. A bill changed while **In review** follows today's rule for any bill change
after a review is sent (check it, the drawing's /ux note). **Money-arithmetic gate:** the same two-permit fixture where Each permit's price and One rate **total the same** and every team's shares add up to the cent, plus the P9 B test above.
**Run `/accounting`'s review before hand-off** (this changes what is charged to teams; CLAUDE.md), and apply or record what it finds.

### Session E · Add time, remove a permit, and F1   (needs C)
Plan §8 Phase 5 and drawing tab "add time". **Add time** beside Settings…, first in Tools (S1 A): opens the same picker and finder; **schedules only the new rows**; no existing slot moves, locked or not; the end date widens if needed.
Draft or in-review schedule: the new slots join the drafts. **Final schedule: the new slots wait in "Changed since sent" and go out through Send the changes, billed per "P9 B".** Remove a permit (P11): free before Finalize; after it, future
slots through Send the changes with credits, played slots and their bill stay. **F1 / P10:** regenerate, Add time and "Take … off" on a final schedule never move a slot whose day has passed; the regenerate question says how many stay.
"Add time with nothing to add" is a drawn state. **Done when:** the P9 B byte-identical test passes through the real Send path, not only the arithmetic module.

### Close · words, help, check, walk
`/marketing` once over the plan's "Words for /marketing" list **plus** the new P9 B sentences and the Bill window's "later-added permit" line; `/docs` (Schedules and Permits guides: several permits, Add time, Find the time, dates off by venue,
Price the time; **F3's advice that a club with two towns uses one permit per issuer**, since recording two towns on one permit corrupts the money). `check:layout --changed` on the touched screens; `check:spelling`. `/simplify` once (new
abstractions: the free-time module, the per-permit price read) and `/review` per session. **Owner walk** as a checkable Artifact (house rules: one purpose per walk, 20-50 boxes, one action per step) on a **two-town fixture with a four-month
season**, covering: pick two permits; find Tue/Thu 6-8 p.m.; a date off for one park; each-permit vs one-rate on the same figures; Add time on a sent schedule with a new permit and the earlier payments unchanged; taking a permit off; a
regenerate that leaves played practices alone. `/demos` at its next cycle (demos follow the product; they do not gate it).

## Guards this build must leave behind (build-enforced)

1. No reader of a schedule's permit uses a single column (Session A).
2. The free-time module imports nothing from a component (Session D).
3. A bill made is never recalculated by Add time: the byte-identical-shares test (Sessions C and E).
4. A sent schedule never moves a slot before today in Regenerate, Add time or "Take … off" (Session E).
5. **N5's three bill-amend guards:** Send the changes measures a team's *value*, never its payment pattern; after an amend, "each payment is that team's time in its months" stops being true for that bill, and the Bill window's
   read-only view must not claim it; the coach's Money tab reads the amended dates. (The bill-amend project itself is not built here.)

## Not in this build

The Permits-page "Free time" view (P12); a live sync from permit to schedule (P8); dues planning from a team's club bill (plan §5, a separate ask against the 11-06 ruling); the bill-amend project; a toggle for draft-held time (P7); a Finalize
warning (P7); dates off by field (P6); anything that books or pays a town (P13); a phone version of Find the time or Add time.

## Stop and report (do not push through)

- A correction today **re-spreads a team's unpaid installments** (P9 B item 3).
- The Bill or Send window still carries another session's uncommitted edits when you need to edit it.
- `from_permit_id`'s backfill cannot match a block to a permit for a real schedule (list them; null is the fallback, but say how many).
- Moving a bill reader changes a number a sent schedule already shows (terms never change). That is a defect to fix, not a number to accept.
