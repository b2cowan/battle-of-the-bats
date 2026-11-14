# Club Tier Stage 13d · Hand-offs between people (build prompt, three sessions)

> Written 2026-11-13, after the owner ruled the 13d drawing's asks **13d-1 … 13d-11 all A** (the drawing page's paste-back).
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session A of @docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md` (then B, then C).
>
> Drawing (the spec): https://claude.ai/artifact/QgEYgkVT7rJK3bHTvgAHtx, source
> [CLUB_TIER_STAGE13D_DRAWINGS.html](CLUB_TIER_STAGE13D_DRAWINGS.html) (captures in `stage13d-shots/`). Tabs: overview ~400, time given ~456,
> Ask for time ~529, the bill on the line ~636, money the treasurer can't see ~767, a coach's request ~880, phone ~945, asks ~1052.
> **Open the tab for the piece you build: its numbered notes carry the exact words and rules; this prompt does not restate them.**
> Drawing prompt (the ruled Asks 14–16 and C6 are recorded there): [CLUB_TIER_STAGE13D_DRAWING_PROMPT.md](CLUB_TIER_STAGE13D_DRAWING_PROMPT.md).
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (the 2026-11-13 entries).
> Standing rules: `docs/agents/design/NAV_STANDARD.md`. Sibling prompt for shape: [CLUB_TIER_STAGE13C_BUILD_PROMPT.md](CLUB_TIER_STAGE13C_BUILD_PROMPT.md).
> Marks: **[V]** = the writer opened it 2026-11-13; **[H]** = from the drawing's "settled from the code" table or a helper, **re-open before
> editing**. Line numbers drift. Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus.
> Size: **Medium**, three sessions, **one walk** after C.

## What 13d is

**One person's work reaching another, said out loud.** Six hand-offs, each told by the club's own screens instead of by luck:

- **Session A · time (13d-1, -2, -6, -7):** house league's time given → the league admin's bell; no time → an **"Ask for time"** button
  that lands on the owner's and admins' This morning (and one bell); the send window's WHO IS TOLD gains a house-league line; the
  "Club time · not divided" tile is **not** built; a draft season asks the same way and "given" stops counting another season's time.
- **Session B · money (13d-3, -4, -5, -11):** the budget line shows a schedule's **draft bill** ("being billed"), New allocation warns on a
  line a draft holds, a **read-only Fair shares window** opens from the line for the treasurer, the Bill window sees Accounting's
  allocations, the treasurer's Overview says **"Owed to the club"** with a door to house league money, and a club tournament's Payments
  card gets **"In the club's book"** for people who hold Accounting.
- **Session C · the coach's request (13d-9, -10):** the one place 13d reaches the Coaches Portal. The coach is asked what the treasurer
  needs ("How should the club pay you?"), the answer pre-fills Approve, and after approval the coach reads how and when they were paid.

The rule everywhere is the standing one for money across screens (Stage 6a): **warns, never blocks.** Nothing here stops a save or
moves money by itself. Nobody gains a nav row (the treasurer's house league money is a **link from a figure**, T5; the tournament nav gets
no Accounting row, B4).

## Owner rulings this build carries

**Ruled earlier (2026-11-06 "as recommended"; 13c C6 2026-11-08), not re-asked:** Ask 14 A (the league admin is told; "Ask for time" lands
on This morning; **only an owner or an admin gives time**), Ask 15 A (the schedule bills; its draft shows on the budget line; New
allocation warns), Ask 16 A (a "This event in the club's book" line, Accounting holders only, no nav row), C6 A (no names on the
league admin's screen). **Ruled 2026-11-13, the drawing's 11 asks, all A:**

- **13d-1 A** A **bell**, no email by default. Anyone can turn the email copy on like every notice. **Nothing new for /legal.**
- **13d-2 A** "Ask for time" is a This morning card **plus one bell** to the owner when it is asked.
- **13d-3 A** The treasurer reads a draft bill's fair shares in a **read-only window opened from the budget line.** (Not a group on Allocations.)
- **13d-4 A** 13d closes the double bill **from the Schedules side too**: the Bill window names Accounting's allocations on its line and
  says so instead of silently offering "No budget line". Warns, never blocks.
- **13d-5 A** The treasurer's **"Owed by the teams" becomes the owner's "Owed to the club"** (teams + house league, the band's own sum,
  no new query), and Revenue names what it includes. One figure, one name, both screens.
- **13d-6 A** **Do not build** the league admin's "Club time · not divided" tile. Delete the placeholder comment and its test pin.
- **13d-7 A** A draft season gets the same "Ask for time", and **"given" counts only time no other season uses.**
- **13d-8 A** **Neither** the registrar's notice nor the "someone joined" notice is 13d. Do not build either. Record each as its own small item.
- **13d-9 A** Ask the coach what the club needs; save it in the codes Approve reads so it pre-fills.
- **13d-10 A** After approval the coach sees "Paid · {amount} by {method} on {date} · Reference {ref}".
- **13d-11 A** **Leave** "Not set up — payments aren't tracked here" as it is; the new line under it says it is the club's book.

## ⚠ Where the drawing and the code disagree, or are silent (read before the summary)

1. **There is no "give house league time" action** [H, drawing callout 1]. Time is given at **Finalize and send**, or by **Send the changes**
   when a change adds or takes back house league time. So the league admin's bell fires at **those two moments**, once per season the time
   falls in, to owners, admins and league admins, **the sender left out**: the same list as the existing "changes" bell
   (`lib/club-schedule-send.ts` ~1077-1106, `lib/notify.ts` ~81-89 [H]). Re-open it; do not add a second recipient rule. The hours in the
   bell come from House league's time window's own figure ("Hours add up across facilities"), so the two never disagree.
2. **"Ask for time" needs somewhere to live** (once per season, "Asked Nov 13", re-askable after 7 days, cleared when time is given or the
   season finishes). **Expect a new column or small table, so a migration** (number = the next free one at the time, **486 or later**: 483-485
   exist today [V]). Check first whether an existing field already says "asked". If a migration is needed: dev only, applied-to-prod order
   recorded in the plan, **`docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work**, SQL fixture beside it.
3. **"Given" is read in one place, and 13d-7 changes it** (`lib/league-time-server.ts` ~44-80 [H]: house league slots of a final schedule,
   still to come, inside the season's dates, whichever season they serve). It feeds fix-now's three-state season line, the generate-games
   gate and the new ask. **Changing the count changes what the league admin can generate.** Test two seasons with overlapping dates (the first
   keeps its time; the second reads "none given" until its own is given) and a season whose time is shared by nothing else. If "no other
   season uses it" cannot be decided from the data as it stands, **stop and report** with the alternative (the button only, 13d-7 B).
4. **The 13c guard pins the opposite** (`tests/unit/club-scheduler-screens-guard.test.ts` ~503 [V]: `doesNotMatch(timeWin + genWin, /Ask for time/,
   'no Ask for time button (13d)')`). **Re-pin it to say the button is there**, in the windows where the sentence sits (House league's
   time window, Generate games) and on the season line. Same for `tests/unit/league-morning.test.ts` ~77 [V] (`doesNotMatch(... Club time ...)`):
   13d-6 keeps that pin true, so **leave it**, and delete the "Club time is 13d's hand-off" sentence in `lib/league-morning.ts:9` [V].
5. **The no-time sentence is cut on a phone** (`.../house-league/seasons/[seasonId]/page.tsx` ~286-291 [H]: the second sentence hides below 900 px).
   The button is a full-width 44 px control **on a phone too**; do not hide it with the sentence.
6. **A "draft bill" after "Send the bill"** [H, `lib/club-schedule-send.ts` ~273-305, `BillWindow.tsx` ~80-82]: a draft or in-review schedule with a
   bill set (line, amount, plan). **It reserves nothing on its line.** At Finalize, or at "Send the bill" on a final schedule with none, it
   becomes an allocation named after the schedule. The line's "being billed" reads **drafts and in-review schedules only**; once sent it is an
   ordinary allocation that already says "from the schedule …". **Read `billBlockers` / `lineAllocatedCents` (`lib/club-schedule-send.ts`) first and
   use their definition of "committed to a line"; do not write a second one.**
7. **Uncommitted work sits in the Bill window today** [V: `git status` shows `BillWindow.tsx`, `NewScheduleWindow.tsx`, `Schedules.module.css`,
   and `lib/club-schedule-words.ts` modified, none by 13d]: the two-line "Bill from" choice and "No budget line / Off-plan". **Session B's Bill
   window piece (13d-4) builds on it. Do not start that piece until it is committed, and do not commit it as yours.** Ask the owner whose it
   is. If it is still uncommitted when Session B starts, build the rest of B first and hold the Bill window warning, in the summary.
8. **The several-permits build re-prices this bill** (owner 2026-11-13: it builds **after** 13d). The Bill window warning will be reworked by it.
   Keep the warning a small, separate component fed by one read, so that rework replaces the read and not the screen.
9. **"Do not add a third owed query" lives in `lib/club-band-read.ts` ~24-63 [H]**, not in the guard test. 13d-5 **reuses the band's own
   house league sum** and adds no query. `tests/unit/club-money-one-definition-guard.test.ts` stays green. The two "Outstanding" labels
   elsewhere are **13e's (F-O6-5): do not touch them.**
10. **House league and tournament money are already in Revenue** [H, `lib/club-money-figures.ts` ~639]. What was missing is **money families
    still owe** ($1,740.00 on the copy): that is what "Owed to the club" adds. The Revenue caption names what it includes; amounts come
    from the year's report, **never typed**.
11. **The tournament Payments card is the tournament admin's alone** [H, `WeeksBeforeBoard.tsx` ~286-313]: no other portal draws it. Touch only
    that. Someone without Accounting sees the card **exactly as today, no dead link.** The treasurer cannot open tournaments, so they reach
    that book from Accounting (already there). A transfer (the float) is named apart from money in, so the figure is not inflated.
12. **The coach's "Payment method" is saved in display words** ("Card", "E-Transfer") and the treasurer's Approve pre-fills only from its own
    codes [H, `panel.tsx` ~114, ~2512; `RequestWindows.tsx` ~152, ~169-179]. 13d-9 saves the code. **Existing requests keep their old words
    and read "Payment method (as filed)" on the treasurer's window** (drawing note 4); never rewrite stored data. The coach's own window also
    prints the raw code today ("etransfer"): fix it in the same pass (drawing note 1).
13. **Header Phase work and the One Attendance Record build share the tree** (`git status` shows attendance files modified [V]). Do not touch
    them. Stage explicit pathspecs; re-check the branch is `dev` before every commit; `git show --stat HEAD` after.

### Decisions for the owner (summary first; build around them; wait for the answer before building the piece they touch)

1. **Whose is the uncommitted Bill window work** (disagreement 7), and does it commit before Session B.
2. **13d-7's "given" change, if it cannot be decided from the data** (disagreement 3). Report; do not guess.
3. **"Ask for time" with no permit at all.** The drawing's card line reads "asked Nov 13 · add a permit to give time" and opens Permits. If the
   club has a permit but no schedule, the card opens New schedule on that permit. Confirm both doors exist for the roles shown before wiring them.

## Before any code: the plain-language summary (required, blocking)

Per session, in product-owner voice: what each person (owner / admin with and without Accounting / league admin / registrar / treasurer /
coach) sees differently on desk and phone; the three owner decisions above. Order the work so a piece waiting on an answer does not hold the rest.

## Session A · time (13d-1, -2, -6, -7)

Screens touched: the schedule's send window (WHO IS TOLD), the league admin's notifications, the season page's line and its windows, the
owner/admin Overview's This morning, the notification registry. **Drawing tabs 2, 3 and 7.**

- **A1 · The bell when time is given.** At Finalize and send, and at Send the changes when house league's time grows or shrinks. One per season
  the time falls in. A new notification type through the registry (`lib/notify.ts`): **bell only, email copy off by default** (13d-1 A). The
  row opens the notice; its one door is "Open House league's time". Words per drawing tab 2 note 1-2.
- **A2 · WHO IS TOLD.** The Send window gains a house-league line naming the league admin(s) and saying it is a bell; with no league admin:
  "House league: owners and admins, by a bell". It follows the money-audience work already committed (`39eb59955`): read the window as it is.
  Hold the line off for a send that gives house league nothing.
- **A3 · "Ask for time" (the button and the ask).** Per tab 3 notes 1-2: one quiet button beside the sentence, in the season line, House
  league's time window, and Generate games; no names (C6 A); once per season; "Asking…" while sending, "The ask didn't go. Try again." on
  failure; "Asked {date}" after; re-askable after 7 days. The owner gets **one bell when it is asked.** **Only an owner or an admin gives
  time**: the button asks, it never gives.
- **A4 · The This morning card on the owner's and admin's Overview.** Per tab 3 note 3: after the cards that exist, only while true, the
  figure counts seasons asking, door per decision 3, "asked 9 days ago" after 7 days, shown to owners and admins **Accounting or not**
  (giving time is not money). Clears by itself when the season has time given or finishes. **No Dismiss.** Every brief card is a door only
  for someone who can open it (`club-stage1-screens-guard.test.ts` ~174-181 [H]).
- **A5 · Retire the tile (13d-6).** Delete the "Club time is 13d's hand-off" comment (`lib/league-morning.ts:9`). Keep the `league-morning.test.ts`
  pin. Build nothing.
- **A6 · A draft season asks the same way (13d-7).** Same line, same button on a getting-ready season; "given" per disagreement 3.
- **Phone:** the button full width at 44 px; the notice as a 44 px row reached from More › Notifications (N7), the More tab carries the unread
  count (the shipped bar already does); the ask a card in the two-column grid, the seventh alone in its row. Tab 7 notes 1-3.

**Session A guards:** the bell's recipients (owner, admin, league admin; sender out; one per season); email default off; the button's presence
**by gate** (league admin and owner/admin-only-gives); "once per season, again after 7 days"; the card's gate matrix (owner and admin
yes; league admin, registrar, treasurer no; absent at zero); "given" with two overlapping seasons; the re-pinned 13c guard (disagreement 4).

## Session B · money (13d-3, -4, -5, -11)

Screens touched: Accounting's budget-line window, **New allocation**, the Bill window, the Accounting Overview, a club tournament's dashboard
(Payments card). **Drawing tabs 4, 5 and 7.** Precondition for the Bill window piece: disagreement 7.

- **B1 · "Being billed (draft)" on the line (13d-3 A).** Tab 4 note 1-2: any draft or in-review schedule whose bill names the line; each row
  says what it would bill and to how many teams and opens the fair shares; "Draft · no amount yet"; the budget table's row gets the same
  caption; "Not allocated" stops saying "The club pays this part itself unless you allocate it" while a draft bills it. Words per drawing.
- **B2 · The read-only Fair shares window.** The Bill tile's own figures (13c), drawn as Accounting's window: **read only, no Schedules link**
  (the treasurer cannot open it: "Schedules isn't one of your pages"). Owners and admins see the same window plus "Open the schedule".
  Share the figures with the Bill tile's reader; **no second computation of a share.** Phone: a full-screen sheet, teams as rows, past four
  the rest fold (tab 7 notes 4-5).
- **B3 · New allocation warns** under the choice the moment a line with a draft is picked, and from the line window's "Allocate" door.
  Names the schedule and the amount, not teams the draft hasn't sent to. **Warns, never blocks** (tab 4 notes 4-5).
- **B4 · The Bill window sees Accounting's allocations (13d-4 A).** Tab 4 notes 6-7: allocations already on the line by name, amount and
  teams; no silent switch to "No budget line", the window **says** the line can't be billed and names Off-plan. Owner and admins with
  Accounting only. **Hold if disagreement 7 is unresolved.**
- **B5 · "Owed to the club" and Revenue's caption (13d-5 A).** Tab 5 notes 2-4: the band's own sum, no new query (disagreement 9); a
  Revenue caption naming what it includes; **one line under the books** opening the live season's Money page, one line each for two live
  seasons, never House league's season list. A door under the card, **never a link in a cell.**
- **B6 · The tournament's "In the club's book" (13d-11 A).** Tab 5 note 1: only on a club's tournament whose book has anything in it, only
  for someone who holds Accounting, opening the event's book in the club's Ledger. **The "Not set up — payments aren't tracked here" row
  stays word for word.**

**Session B guards:** the draft/in-review definition shared with `billBlockers` (source pin: no second definition); the warning never blocks
(the save path is unchanged); the window refuses any Schedules door for a reader who cannot open Schedules; the Overview figure equals the
owner's band's figure by construction; the card line's gate matrix (owner, admin with Accounting yes; admin without, treasurer, registrar no;
**no dead link**); `club-money-one-definition-guard.test.ts` green; a test that the tournament nav has no Accounting row (B4 stands).

## Session C · the coach's request (13d-9, -10)

Screens touched: the **Coaches Portal's** request window and the coach's list row; the treasurer's request window. **Drawing tab 6.**
The only place 13d reaches the Coaches Portal. D1 and D3 stand: this is the coach's **own** request, not the club looking into the coach's books.

- **C1 · The question (13d-9 A).** "The club pays us": "How should the club pay you?" (Cash, E-Transfer, Cheque, Other). "We pay the club":
  "How are you paying the club?" (Card stays an option **only** for paying the club). Saved as the code Approve reads (disagreement 12), so
  Approve pre-fills. The coach's window prints the words the coach chose, never the code.
- **C2 · The treasurer's window.** "How they'd like to be paid" (club pays the coach) / "How it's coming" (money to the club); a request filed
  before the change reads "Payment method (as filed)".
- **C3 · Paid (13d-10 A).** The coach's window reads "Paid · {amount} by {method} on {date} · Reference {ref}" (and "The club received it on {date} · {method} ·
  reference {ref}" for money to the club); the list row reads "Paid {date}" instead of "Approved". **The record exists and the screen
  already loads it** (drawing note 2): do not add a query for it. Plain rows, as the window's other facts.
- **Phone:** the coach's window on a phone per the Coaches Portal's own phone rules (`feedback_phone_figures_are_rows`: rows, not tiles).

**Session C guards:** the saved value is an Approve code; an old-words request still renders; the coach's window never prints a raw code; the
treasurer's label by direction; the "Paid" row appears only after the record exists. **This is a Coaches Portal change: run the coach
portal's own layout checks (`check:layout --changed` on the request screens).**

## Help, words, layout (each session does its own; the walk is once)

- **Help** (`/docs` after each session): the league admin's no-time sentence and button (`house-league.tsx` `house-league-time-t-given` and
  the generate-games article), the send window's WHO IS TOLD, the new notice (Notifications article), "Owed to the club" and the Revenue
  caption (`accounting.tsx`), `budget-allocate` and the new "being billed" words, the Bill window's new warnings (`org.tsx` `club-schedules-t-bill`),
  the tournament Payments card, the coach's request article in the Coaches Portal help. **Search words move with the prose.**
  `npm run check:spelling` (one spelling: "installment", "a.m.").
- **Demos:** no club sandbox exists [H]; the coach demo reads the request window, so **re-check the coach demo's tour anchors** after Session C
  (the build fails if one stops existing; that is the only per-commit demo signal, and demos never gate).
- **Layout:** `check:layout --changed` per session on the screens touched (dev server; never a whole sweep there), then the staging sweep once
  after C. Add fixtures: a season with no time and one asking; a draft schedule bill; a tournament whose book has money; a coach request each direction.
- **/legal:** **bell only, so no new mail to a person.** Still run the `/legal` review (CLAUDE.md): the new notices collect nothing new about
  people, but confirm the bell's wording and that no email default turned on. **/accounting:** no change to what FieldLogicHQ charges, so not
  required; the club's money definitions must not change (disagreements 6 and 9). If either moves, stop.
- **Words for `/marketing`** (one pass before the walk): the bell's title and body, "Ask for time", "Asked {date}", "The ask didn't go. Try again.",
  the card's lines, "being billed (draft)", "Draft · no amount yet", the two warnings, "Owed to the club", the Revenue caption, "In the club's
  book", "How should the club pay you?", "How are you paying the club?", "Paid · …".

## After each session

- **Reviews:** `/simplify` (A adds a notice type and a stored ask; B adds a shared draft-bill reader; likely), then `/review` (high for B: the
  bill and the warning; standard for A and C).
- **Records:** a status entry in the Stage 13 plan §10 per session (what was built, where it departed from this prompt, the commit hash once
  committed); the TODO 13d line; one line in the PM brief; `NAV_STANDARD.md` only if a place or tab moved (none expected). **If a migration
  exists: the data dictionary, the snapshots, `MANUAL_PROD_STEPS.json` per its convention.**
- **Restart:** the dev server needs a restart before hand-off after any session that adds a file or a migration.

## The walk (once, after Session C)

One walk, one purpose, its own Owner QA Ledger section (**the next free §**; read the ledger, never assume), as a checkable Artifact with
a paste-back, on a fresh Harbourtown copy. Purpose: **each hand-off reaches the person it is for, and a person who can't act is not shown a door.**
By role (owner, admin with Accounting, admin without, league admin, registrar, treasurer, coach), desk and phone: time given → the league
admin's bell and its door; no time → Ask for time → the card and the bell → time given → the card clears and the line changes; a draft bill on the
line, its read-only window, the New-allocation warning (and Allocate still works), the Bill window's allocation notice; Owed to the club and
its door; the tournament's book line, and none for the admin without Accounting; the coach's question, Approve pre-filled, the coach reading "Paid".
Counts in the walk come from the fixture, never from this prompt. Walk to a send and stop (R3, 2026-11-06).

## Not in this build

- The registrar's notice and "someone joined" (13d-8, each its own small item). F-O2-15 (a coach is not told a schedule or bill is coming): owner's call, keep.
- F-O6-5, the two "Outstanding" figures (13e's labelling). F-T4-7's wider relatives in the Coaches Portal beyond the request window.
- A nav row for the club's book in the tournament admin (reverses B4); a nav row for the treasurer's house league money; the league admin giving time (Ask 14 B).
- Stage 12 (families pay online): do not bridge the club's bill to family dues.
- The several-permits build (it follows 13d); cancel-a-day across programs.
