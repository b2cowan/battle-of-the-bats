# Add time is a second schedule, shown as one · build prompt (Phase 8: three sessions and a close)

> Written 2026-11-16, after the owner ruled the drawing's seven asks: **all A** ("i agree with your recommendations").
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session 1 of @docs/projects/active/CLUB_SCHEDULE_ADD_TIME_PARTS_BUILD_PROMPT.md` (then 2, 3, Close, **in that order**).
>
> Drawing (the spec): https://claude.ai/artifact/6Bz3gQSuyrot2HsQnkYX5P, source
> [SCHEDULE_ADD_TIME_AS_ITS_OWN_DRAWINGS.html](SCHEDULE_ADD_TIME_AS_ITS_OWN_DRAWINGS.html) (round 1 + /design fixes; ruled).
> **Open the drawing's tab for the piece you build: its numbered notes carry the exact words and rules; this prompt does not restate them.**
> Plan of record: [CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md](CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md) **Phase 8** (the owner's model in his words),
> plus Phase 5 (what Add time is today) and Phase 3 (the bill). PM brief: [CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md](CLUB_SCHEDULE_SEVERAL_PERMITS_PM_BRIEF.md).
> Marks: **[H]** = from a helper's read on 2026-11-16, **re-open before editing**. Line numbers drift.
> Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus. Size: **Large**.

## What this builds

The owner's model (plan Phase 8): **"it's just 2 schedules built the same way, but viewed as 1."** A draft is simply edited. Once a schedule is
final, **Add time** makes a new part of it — its own permits and hours, its own From/To, its own dates off, its own teams and shares, and **its own
bill** — shown on the same schedule page. The original schedule, its practices and its bill do not change. Phases: draft → final → final with
changes → final.

## The seven rulings (all A; the drawing's Asks tab has the text)

1. **Name:** an added part is "Time added Nov 16" (the date it was added; a second the same day is "… (2)"). No name field.
2. **Add time on a final schedule only.** On draft and in review it is gone from Tools; **Settings… gains the Permits picker and the Find the time
   door** (New schedule's, in the empty half of the Name row).
3. **Quietly on the page:** one meta line under the existing one (never more than one: "Time added Nov 16 and 2 more ›" opens the Part filter);
   a **Part** filter beside Team (only on a schedule with time added); a "Part" row in the slot window; the cell stays one line and wears the unsent
   olive until sent. The Fair shares band is **unchanged**; the unbilled part is said in the Needs attention change row.
4. **Regenerate and Settings… work on one part,** asked first in a small question ("Regenerate which part?" / "Settings for which part?") using
   the shipped view switch. Asked only when the schedule has more than one part.
5. **The part's bill is set in Send the changes:** a line "Time added Nov 16 · its bill" reading "Not billed" + "Bill it…" (then "$135.00 · 14U AA ·
   one payment, due Dec 1" + "Change…"), opening the shipped **Bill the teams** window for that part. Sending unbilled is allowed (the shipped
   final-not-billed path then offers "Review the bill"). "Bill the corrections" is **absent** when the only change is new time.
6. **Teams = New schedule's "Who, and how much"** (Split the time, Each team's time, Practices per team per day, the team table), **nobody ticked
   to start**; every team with a running season is listed, including teams not on the original.
7. **A permit already on the schedule is offered,** with the time the schedule already uses left out (shown as one line on its card), and From
   starting where the schedule's use of it ends.

Defaults drawn and accepted with the rulings: Give it to lists only the part's teams; taking an added part's only permit off removes the part
(before the send it simply goes; after, the usual credit at Send the changes); the coach's charge is named "Fall practices · Time added Nov 16".

## ⚖ The storage decision — Session 1's first step, owner's call before any migration

There is **no "part" concept anywhere** [H]. Everything the model needs per part is held **once per schedule** today: `club_schedules.settings`
(jsonb v2), `starts_on`/`ends_on`, every `bill_*` column and `allocation_id`, the dates off (UNIQUE per schedule + day), `club_schedule_bill_rates`
(UNIQUE schedule + permit), the send baseline (`club_schedule_sends.team_values`, read by `changesMoney` as `before`), and regenerate's keep rules
(`lib/club-schedule-keep.ts`). Two ways to give a part all of that:

- **(B) Recommended — an added part IS a schedule,** a `club_schedules` row linked to the one it was added to (e.g. a nullable
  `part_of_schedule_id`, plus the label), shown on the parent's page. This is the owner's model taken literally, and every per-schedule mechanism —
  settings, dates, dates off, generate, regenerate, Settings…, the bill and its rates, Finalize, the late "Review the bill", corrections, the send
  log, the allocation named after the schedule ("Fall practices · Time added Nov 16") — already exists per schedule and needs no second copy.
  The work moves to **aggregation**: the parent page reads parent + children; Send the changes sends them together; every list of schedules hides
  children; clashes are checked across the family.
- **(A) A parts table** under one schedule, with `part_id` on blocks, dates off, slots, bill rates and sends, and the bill columns, settings and
  dates moved onto the part. Truer to "one schedule" in the database, but it re-plumbs every per-schedule read and write the several-permits
  sessions just built and tested (keep, generate, save, bill, send).

**Do this before writing code:**
1. **Census every reader of `club_schedules`** (Explore helper): lists (the Schedules page, the permit's "used by", Find the time's "held by a
   draft (…)", the budget line's "being billed", 13d's draft-bill readers `lib/club-draft-bill*.ts`, Overview, Calendar, coach views, house
   league Schedule health, the hand-back flow, demos/seed). For each: under (B), must it hide a child, roll it up, or is showing it as its own
   schedule already right?
2. **Run `/dba`** on (B) vs (A) with the census. Questions for it: the FK and its delete rule; can a child exist without a final parent (no);
   one level only (a child never has a child); the child's `state`/`changed_since_sent` while unsent; uniqueness of the label per parent;
   RLS (a child inherits the parent's org — confirm the policies key on org); the slot place index is per schedule, so **cross-family double
   booking is not stopped by the database** — the generator and the clash check must stop it.
3. **Stop and report to the owner** with the census, `/dba`'s finding and a recommendation, in product-owner words (what each choice costs and
   risks). Build only after his yes. If the census finds a reader where a child would leak or double count and the fix is not small, say so —
   that is the evidence that would flip the recommendation to (A).

The sessions below are written for (B). If the owner picks (A), rewrite Sessions 1–3's mechanics in the plan first and tell him the size changed.

## Order, and what gates what

**Session 1 → 2 → 3 → Close.** 2 needs 1 (a part to save into); 3 needs 2 (a part to send).

- ⚠ **Shared files have other sessions' uncommitted edits** (2026-11-16 `git status`: `components/admin/kit/club/schedules/NewScheduleWindow.tsx`,
  `Schedules.module.css`, `lib/club-schedule-words.ts`, and more). **Run `git status` first; ask the owner whose they are before editing any of them;
  never commit them as yours.**
- **Phase 7 (each team's amount)** is ruled, not built, and also edits the Bill window. Either order works: this build **uses** the Bill window as
  it is when it runs. Check which is in the tree and say so in the summary.
- **Migrations: the next free number** (490 is the latest at writing [H]; 488–490 are pending on prod). Dev only; the prod step recorded in
  `supabase/migrations/MANUAL_PROD_STEPS.json` and the plan; **`docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same
  unit of work**; a SQL fixture beside it.
- **Existing dev schedules that used today's Add time** keep their rows as they are (pre-customer; no data migration). Say so in the plan.

## Session 1 — the storage, the family page, and clashes across it

> **BUILT 2026-11-17** after the owner's yes to (B) ("yes b") and three rulings (a hand-back stops at a part's edge; a sent
> part taken off is credited and hidden, never deleted; an added part's practices read "From {parent} · {label}"). What was
> decided and how: plan Phase 8, "Session 1 BUILT". /dba: Finding #52 (amended: `family_id` has no FK).
> **Session 2/3 must know:** the page's windows that write (Settings…, Bill, Send, the log) still get the PARENT's view;
> `familyOthers` + `buildEngineInput({ family })` already make a part's draft avoid the family; a part is inserted with
> `part_of_schedule_id` + `part_label` only (the trigger writes its name); Send the changes for a part-only change is owed.

After the owner's yes on the storage decision:

- [x] The migration (under B: the parent link + label + constraints `/dba` asked for), dictionary, snapshots, SQL fixture, prod step recorded.
- [x] Every reader from the census does what the census decided (lists hide children; "used by" / "held by" name the parent, or the part —
      decide with the census; money readers do **not** double count a child's bill against the parent's).
- [x] The schedule page reads the family: the meta line (ruling 3; never more than one line), the **Part** filter (built like Facility and Team;
      "Every part", the parent's name, each part's label; filters Grid and By team), the slot window's Part row, Give it to limited to that part's
      teams, Needs attention's change row naming the part when it is unbilled (tab 4 of the drawing, note 2).
- [x] **Clashes across the family:** generating or hand-editing a part treats the rest of the family's slots as taken — same place and hour, and
      the same team at the same time. One pure function, tested. (This is a subset of the open "Used figure" item — generator blind to other
      schedules' final slots — do the family case here; do not widen to every schedule unasked, record it.)
- [x] Fair shares band: unchanged in look. **Decide and record** whether Handed out / Short / Clashes count the family (the drawing's tab 1 says
      they count the whole schedule) — they should.
- [x] Tests: the census decisions (a guard that every list reader filters children), family clash function, page reads.

## Session 2 — Add time makes a part; a draft is edited

> **BUILT 2026-11-17, committed `ca40fefcd` 2026-11-17.** What was decided and how: plan Phase 8, "Session 2 BUILT". Mig 494 (the save writes the link on its
> insert; dev only, prod step recorded); `tests/sql/schedule-part-save-fixture.sql` 6/6; `tests/unit/club-schedule-add-part.test.ts`.
> **Session 3 must know:** a part is saved `state = 'draft'` (never in review) and waits as the parent's Changed since sent;
> Send the changes still sends the PARENT alone, so a part can be added and seen but not yet sent, billed, regenerated or
> removed — that is Session 3's whole job. The P9 B path (`changesMoney` billing a permit not behind the bill) is untouched and
> now has no caller that adds time to a sent schedule; retire it there with `club-schedule-add-time-send.test.ts`.
> **Left open by Session 2's /review (high), for the owner or Session 3 — none blocks:** (1) Settings… on a FINAL schedule still lets
> a typed row ("Add hours") and the PATCH regenerate add NEW time to the parent, now that Add time is no longer the door — decide
> whether to refuse null-id rows on a final schedule. (2) A permit that ended before today gives From = today and To before it, so
> the form says only "needDates": needs a worded line (words go through /marketing). (3) A part with only House league ticked is
> not blocked in the window; the server refuses only `giveToHouseLeague`. (4) "stays exactly where it was sent" counts an unsent
> earlier part's practices as sent. (5) Each preview of a part reads the whole family: fine now, heavy for very large schedules.
> (6) Taking off a draft's only permit by unticking it drops its rows with no Take it off… window (Phase 5's open refusal-wording call).

- [x] **Tools:** Add time… only on a final schedule; its hint "More time, for the teams you choose, on a bill of its own. Nothing already on the
      schedule moves." (words through `/marketing` at the Close).
- [x] **Settings… on draft / in review:** the Permits picker and the Find the time door (drawing tab 2). Unticking = the card's "Take it off…".
      The save is the existing Keep this draft (a draft regenerates; nobody has been told).
- [x] **Add time = New schedule's form for the part** (drawing tab 3): the Permits picker lists **every** permit; one already on the family
      offers only time the family doesn't use (the card's one line; From defaults to where that use ends); "Shown on the schedule as" Time added
      {date} (fixed); the permit cards with Add hours; **From / To editable**, defaulting to the permit's dates, never before today (the schedule
      was sent); To past the parent's end widens what the page shows (under B the parent's own dates do not change — confirm with the page's meta
      line); slot length and changeover starting at the parent's; dates off **the part's own**; "Who, and how much" with nobody ticked; Rules
      folded; the new promise statement; "Generate drafts for the new time". Step 2 as shipped.
- [x] **Retire today's Add time internals** that write into the parent: `addTimeRequest` / `requestOnStored` / `addedTime` and the `add_time`
      keep path [H: `lib/club-schedule-server.ts` ~515–539, `lib/club-schedule-keep.ts` ~220–237, the PATCH route ~104–117]. Under B the part is
      a new schedule generated with the family's slots taken; the parent is not saved at all. Remove dead code; keep the guards that still apply
      (nothing before today on a sent schedule).
- [x] The part's state while unsent: it waits as the parent's "Changed since sent" (chip + Needs attention), not as a separate draft anywhere a
      list shows drafts.
- [x] Tests: the form's request (any permit; used time left out; From/To; nobody ticked), the part saved with the family taken, nothing on the
      parent changes (byte-identical slots, settings, bill).

## Session 3 — Send the changes sends the family; one part at a time

> **BUILT 2026-11-17, committed `839645c5c` 2026-11-17** (simplified + reviewed; the review's fixes and open calls are below). No migration. What was decided and how: plan Phase 8, "Session 3 BUILT".
> `tests/sql/schedule-part-send-fixture.sql` 5/5 (DEV); `tests/unit/club-schedule-family-send.test.ts` 15/15; schedule suites 546/546.
> **The Close must know:** the new words are one block in `PART_WORDS` ("Time added as its own part: sending it and its bill"),
> incl. "Billed" (no figure, a reader without Accounting — the drawing said "or the figure"; the shipped money rule won), the
> sent-without-a-bill row, the take-off-part question and the email's separate-bill title + outro (for `/legal`). A family send
> that is refused part-way tells only what landed and adds the refusal to the notice (`notAll`) — check its wording too.
> P9 B is NOT retired (Settings… on a final schedule still adds typed rows — Session 2's open item 1, the owner's call).
> Dev-server restart owed (new files). Not walked in a browser.
>
> **/simplify + /review (high) on Session 3, 2026-11-17 — APPLIED:** (1) a part's step that THROWS after an earlier member landed is now
> treated like a refusal (what landed is told, `notAll` says the rest waits) — before, a bare 500 left landed members' families never
> told and the retry read the parent as already sent; (2) the "Bill the corrections" switch also shows when a correction is BLOCKED
> (a sent part's correction can block the send while the schedule has none of its own — Send was dead with no message); (3) the send
> log's people/failed counts again include house league's coaches AND families and its failures (a regression on every send with a
> league half); (4) the Rep Teams gate is asked of each part (a member kept out of Rep Teams neither sees nor sends a part that holds
> them); (5) a window opened for a part closes if that part is gone on the next read (it fell back to the parent — Settings would edit
> it, a bill would be made on it); (6) the send posts the version the preview showed; (7) SQL fixture guards a null bill.
>
> **Left for the owner (judged not defects, or a design call):**
> - **Send-window choices reset on the "Bill it…" round trip** (unticked teams, "Bill the corrections" off return to defaults when the
>   Bill window closes). Lifting them into the page is a small build — owner's call whether it is worth it before the walk.
> - **A sender without Accounting cannot send a family that includes an unsent part WITH a bill** (`bill_money`, same as a standalone
>   Finalize), though the window shows them "Billed". Probably intended — confirm.
> - **"Sent without a bill" in Needs attention never clears** for a part the club deliberately sends free, and shows to readers who have
>   no "Bill it…" door. Owner's call: a dismiss, or hide it from readers without Accounting.
> - **Corrections added up:** the parent's correction and a sent part's correction are one figure in the email and one bell, though two
>   allocations exist (two charges on Money › Club). The plan said "added up" — confirm it reads right to a coach.
> - **"Who is told" for house league** lists a team once per member that names it, and the time-given line shows only the first member's;
>   a family send's log counts a team named by two members under each. Cosmetic; no money.
> - **"Billed from this send at its own price"** can list a part's first-send permits that already had a price (its `rates` is every permit
>   behind its first bill). Wording only; money readers only.
> - **Blockers are per member, not cumulative:** the parent's correction + two parts' bills can each fit a budget line and not their
>   sum; the step then refuses `over_line` part-way (`notAll`, handled cleanly) where the preview could have said so first.
> - **Taking a SENT part off is blocked by `requestOnStored`'s unrelated refusals** (no team has a running season; a date-off on a deleted
>   park) — the cases where an admin would most want it gone; a DRAFT part's delete runs before that check.
> - **The take-off dialog's "nothing played" rule is looser than the server's** (a past slot with no team, or a slot with no permit, keeps
>   the part though the dialog says it leaves). The server's behaviour is the safe one; the sentence can over-promise.
> - **A hand-back (team's late money ask) still waiting on a part that left the page** is no longer shown; `scheduleList` still counts a
>   gone part's dates and teams. Check with the Close walk.
> - **Cost:** each part's preview re-reads the org's teams, places and venues (~9 queries a part per preview; the POST repeats it), and
>   the page's GET reads `contextFor` again for each sent-and-changed part. Fine at one to three parts; share the context if parts grow.
> - **The 'final' step has no closed-year / `changed:` mapping** (the 'bill' and 'changes' steps do) — pre-existing, so a part's first send
>   in a closed year throws; with the fix above it is told as `notAll`, not a clean refusal.
> - The fixture's take-off case (5) runs with no blocks and never sends the follow-up (credit, `apply_changes`, `partIsGone`) — a
>   walk step for the Close, not covered by `5/5`.

- [x] **Send the changes** (drawing tab 5): the coach row names the part ("Gains Thu, Dec 10 at 6:00 p.m. · Time added Nov 16", no money there);
      a bill line per unsent part ("Not billed · Bill it…" → the Bill window on that part, eyebrow "{parent} · {label}", statement "A bill of its
      own…", footer as shipped "Add the bill to the schedule"; then "$… · team · payments" + "Change…"); "Bill the corrections" only when a change
      touches the parent's own time. One send: the parent's changes (if any) and each part's first send, **one email per team** listing both, one
      notice per bill.
- [x] The part's bill is its **own allocation** named "{parent} · {label}" (under B: the shipped Finalize / late-bill path on the child). **Time
      added no longer becomes a correction on the parent's bill** (this retires the P9 B path *for added time only*; corrections for changes to the
      parent's own time are unchanged). Earlier payments untouched — test it byte-for-byte like `club-schedule-add-time-send.test.ts` does today.
- [x] Who sees the bill line and "Bill it…": people with the club's Accounting (as the Bill window today); others see "Not billed" or the figure,
      no door.
- [x] **Regenerate which part? / Settings for which part?** questions (drawing tab 4), only with more than one part; then the shipped question
      or window for that part, eyebrow "{parent} · {label}". A regenerate of one part never touches another.
- [x] Taking an added part's only permit off removes the part (before its first send: gone; after: credits at Send the changes). Removing the
      part when nothing else would stay must not leave an empty child behind.
- [x] Coach side: the second charge "{parent} · {label}" on Money › Club, the bill email and the bell read right (`lib/club-money-reads.ts`,
      `ClubBillBudgetCallout.tsx`, `teamEmails` / `teamBells` / `tellTeams` [H]). The coach's schedule shows the part's practices with the
      parent's (check how a coach's practice names its schedule).
- [x] Tests: one send with a parent change + a new part (two allocations, correct names, earlier payments identical); unbilled part; a part-only
      send has no corrections switch; regenerate scoped to one part.

## Close

- [ ] `/simplify` → `/review` (high). `/dba` on the shipped migration.
- [x] (2026-11-17) `/marketing` on every new sentence (list them in `lib/club-schedule-words.ts`, one block "Time added as its own part"), incl. the Tools
      hint, the promise, the meta line, the bill line, the two "which part?" questions, the coach's charge name.
- [x] (2026-11-17; nothing blocks, see `docs/agents/legal/CASL_LATE_BILL_EMAIL.md` "Reviewed 2026-11-17") `/legal` light check: the coach now gets a second bill email for the same schedule — confirm it stays a transactional message (CASL) and
      the email says why it is separate.
- [x] (2026-11-17; three topics added to the Schedules guide, one sentence on the coach's bill help) `/docs`: the Schedules guide (Add time, parts, the Part filter, billing added time) and the coach-side bill help if it names corrections.
- [ ] `check:spelling`, `verify:changed`, full `npm run typecheck` (shared modules change), focused suites; dev-server restart (new files);
      `check:layout --changed` on the schedule page, Add time, Send the changes.
- [x] (PUBLISHED 2026-11-17 as §538: https://claude.ai/artifact/MLEQvE49KQyHW9vBtgcU4e, 50 steps; WALKED 2026-11-17, 50/50 pass; calls ruled C1 A build, C2 C both, C3 A as built, C4 C say it in the window; C1, C2, C4 BUILT 2026-11-17 uncommitted, mig 496 on DEV only, see plan Phase 8) An owner walk as a checkable Artifact (20–50 boxes, one action per step): add one practice for one team to a sent schedule; add spring time
      from a permit already on it; bill each part; send; see the coach's two charges; regenerate one part; take a part off.
- [ ] Plan Phase 8 ticked with commit hashes; the PM brief's "where it stands"; TODO line; Claude memory.

## Open owner calls this does not settle (carry forward, do not decide)

- Phase 5's "take it off when nothing would stay" refusal wording, and the fourth call (a credit empties the latest payments first, and a locked
  slot is not protected from its permit coming off).
- The "Used figure" `/plan` item beyond the family case.
