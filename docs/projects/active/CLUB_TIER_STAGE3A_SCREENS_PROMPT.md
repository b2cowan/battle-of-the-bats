# Club Tier Stage 3a · session 2 — Accounting as one page with tabs, and every club-money screen (built to hub v22)

> Paste into a fresh session on `dev` **after session 1 (`CLUB_TIER_STAGE3A_SERVER_PROMPT.md`) is committed**.
> Its call list (routes, shapes, refusal codes, the definitions module, notification keys, the retire list) is
> in plan §6 Stage 3. Written 2026-09-30, the day the drawings were **ratified**: every ask as recommended,
> **Ask 2 option B**.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3a**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED and
>   UNCHANGED tag note is a requirement; open each one.
> - The **"Formatting check"** screen is your checklist, every row.
> - The after-frames on specimens 1–4 and 6 are drawn in option B. Specimen 5's **option A frames are not
>   built.**
> - Where you must depart, say so at build time and record why; never silently.
>
> **Read first:** plan §6 "Across every stage — formatting" (and Ask 8's rulings), §6 Stage 3's blockquotes and
> session 1's call list. Memory: `project_club_tier_readiness`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `decision_edit_autosaves_create_asks`,
> `decision_autosave_word_is_transient`, `decision_drawer_layers_form_vs_menu`,
> `feedback_mobile_icon_only_actions`, `feedback_form_selects_are_dropdowns`,
> `feedback_shared_component_over_shared_class`, `project_coach_phone_list_frame`. The in-repo
> `memory/design_decisions.md` entries from 2026-09-29 on (one lime per screen, a row's worded action is olive; a
> record opened from a list names its neighbours at its foot; a plan lock is one plain line).

## Preconditions (check before code)

1. **Session 1 is committed.** Read its call list. Its three open questions were **ruled 2026-09-30** as
   recommended:
   - a coach's "sent" counts as money out on its day in the coach's Ledger, tagged "Sent · waiting for the
     club", while the club counts it only when it confirms;
   - reminders go to the head coaches plus any staff member the head coach has given money access;
   - no payment-instructions setting: the email's reply-to is the sender.
2. **The tournament admin redesign's Stage 2 is committed,** including its Part 1 shared kit (the form window
   and the admin row recipe). Build on those. **Never a second row recipe** (`ClubRow*` in
   `components/admin/kit/club/RepKit.tsx`).
3. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, because the drawings are
   ratified: what a treasurer, a club admin and a head coach each see differently, and any place the build
   departs from the drawings.
4. **Git and the dev server:**
   - private index, explicit pathspecs;
   - ask before a sweep or a restart;
   - **one browser tester at a time**: ask the owner before any capture or `auth-setup`.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`** gets Ask 5d's three table parts, shared with the tournament
  redesign:
  - **a void row:** off the book until a Status filter asks for it; then in place, struck through in the
    faintest ink, a Void chip, the reason as its detail, no balance, counted nowhere;
  - **a band row may carry a total in its words** ("Overdue · 2 · $900.00"), never as a figure column;
  - **the empty side of a paired Money out / Money in column is blank.** The em dash stays for "nothing here"
    everywhere else.
- **`TABLE_EXCEPTION_REGISTER.md`:** extend **K-01** (register density) and **K-25** (the phone card of
  labelled lines) to the club's Ledger.
- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. the club's money book reads exactly like the coach's Ledger. Its two deliberate differences: the date
     pill opens on This month, and the figure is "Balance", not "Cash on hand";
  2. **Accounting is one page with tabs**, and the rule proposed for Stage 8 (a program whose pages are views
     of one body of records is one page with tabs; separate jobs stay rail entries);
  3. the three table parts.
- **The plan's Stage 8 nav-review item** records that Accounting is ruled (3a, Ask 2) and that the rule is
  written into the standard at that review.

## The frame: Accounting is one page with tabs (Ask 2 option B, specimen 5)

- **One tab row component for the coach's Money and the club's Accounting.** Today it is `CoachTabBar`
  (`components/coaches/CoachTabBar.tsx`, styles in `coaches.module.css`), shared by the coach's Money and
  Insights. **Promote it, don't copy it.**
  - Its look: sentence-weight labels, the lit tab olive with a 2px underline, one hairline under the row, never
    sticky. On a phone it scrolls, with an arrow only on a side that hides a tab, and opens scrolled so the lit
    tab shows.
  - The coach's two hubs must look the same after the move; `check:layout` proves it.
- **The page:**
  - titled **Accounting**, with no create in the header (§3.9: a create belongs to the tab's toolbar);
  - the tabs **Overview · Ledger · Allocations · Payment requests · Budget · Budget vs. Actual**, as links to
    real addresses;
  - a page one level down (an allocation, a team's account) has a back arrow and **no tab row**.
- **The rail:**
  - Accounting is **one row that never opens,** carrying the waiting count. Check that the count still shows
    while you're inside, since today's rail hides a program's count when it is open.
  - Rep Teams loses Cost allocation and Payment requests, and its count drops the requests.
  - On a phone, the "In Accounting" row no longer renders (the program has no sub-pages).
- **Budget and Budget vs. Actual** move under the tab row as they are. They lose only their own page headers.
  3b redraws them.
- **Old addresses forward:**
  - Rep Teams › Cost allocation, and every allocation's own address, forward to Accounting › Allocations;
  - Rep Teams › Payment requests forwards to Accounting › Payment requests;
  - a ledger's own address forwards to the Ledger tab on that book;
  - Budget's "View allocation" shows again for the treasurer.
- **The club's Overview** (specimen 5): the two brief counts become **door cards**.
  - Payment requests opens its tab and names "1 holding up a payout".
  - Installments due opens Allocations on Coming due.
  - On a phone, the Accounting row names its tabs.
- **Rep Teams' team page** gains **"With the club"** for someone who can open Accounting: outstanding, next
  due, and whether a request waits, opening the team's account. The board's Upcoming bills panel leaves the
  page (session 1's retire list).

## What to build (by hub specimen)

1. **The Ledger tab** (specimen 1, Ask 6). The coach's Ledger recipe, using the coach's own controls where
   they fit (`MultiSelectDropdown` with `restQuiet`, `SingleSelectDropdown`, `DateRangeDropdown`).
   - **The top deck** stays put:
     - the **Book pill** first (the club's books with their balances; Add ledger at its foot; it opens on the
       General ledger);
     - then Payees, Export, Transfer, and **Add entry** (lime, the one lime).
   - **The strip:**
     - Type · Status · Category · Date, quiet at rest;
     - **Status opens on Posted + Pending**; **Date opens on This month**;
     - **Balance** at the strip's right edge. It leaves when Type narrows.
   - **The table:**
     - columns Date · What · Category · Money out · Money in · Balance · chevron, in K-01 compact rows;
     - dates and categories on one line;
     - **oldest first** between a Starting balance line and an Ending balance line (K-04);
     - the What cell is the name, then the detail in quiet ink on the same line;
     - no Source column;
     - a pending line carries a Pending chip, and its balance is the one before it, in faint ink;
     - the dollar sign in every figure, and the empty side blank.
   - **The line's window:**
     - a hand-typed line can be edited (it saves as you go) or voided (asks, with a reason);
     - a line written by an allocation or a request shows who recorded it and when, and offers **one door to
       its source**, with no Edit and no Void;
     - voiding a transfer names both halves and voids both.
   - **Add entry** asks first:
     - Money is In or Out (never a transfer half);
     - date, amount and category (the club's own);
     - the payee picker, with **Manage payees** at its foot;
     - how it was paid and the reference;
     - Pending as a choice.
   - **Transfer** lists only the club's own books.
   - **Payees page:** a rename saves as you type, with the fading "Saved"; a merge asks and names how many
     entries move.
   - **The Export menu** says what it holds: the whole period, signed, voids marked.
   - **Phone:**
     - the tab row;
     - the Book pill with 44px icon buttons (Export, and Add entry in lime; Transfer and Payees in the Book
       pill's menu);
     - the four pills, wrapping so Balance keeps its own line;
     - **K-25 cards** in the same order.
2. **The Overview tab** (specimen 1's "Overview tab" frame).
   - The four figures, as today, until 3b (C04).
   - **The club's books:** Club, Tournament and House league kinds, all-time balances, and Add ledger.
   - **Held by the teams:** a Team badge, Outstanding and Next due. A team row opens its account; a book opens
     the Ledger tab on it.
3. **A team's account** (specimen 1, Ask 5a).
   - Back arrow to Overview. The blue-edged "held by the team" note.
   - Three figures: Outstanding, Next due, and Paid to the team.
   - A statement: Billed · Collected · Paid to the team · Outstanding (running), in band rows for the team's
     seasons, with a closing "Outstanding on {date}" row.
   - Export. **Nothing on it writes.**
4. **The Allocations tab** (specimen 2).
   - **One toolbar line:**
     - the **View** pill (By allocation / Coming due);
     - no count line, because the band and closing rows say how many;
     - Send reminders, Export, and **New allocation** (lime; today's form, unchanged).
   - **The columns:** Allocation (with its schedule as a caption) · Teams (in words) · Allocated · Collected ·
     Outstanding · State · chevron.
   - **The state chip:** Overdue with its count, Due and the date, First due, or Paid in full. It uses the ONE
     overdue definition, and Collected is in plain ink.
   - **The closing row:** This year.
   - **Coming due:** the bands Overdue (with a total) · Sent, waiting for you to confirm · Due in the next 14
     days. A row opens that team's bill.
   - **Phone:** one frame with hairlined rows, the chip in the title, and "collected of allocated" as the
     caption.
5. **An allocation** (specimen 3). Back arrow to Allocations.
   - **The page:**
     - four figures: Allocated · Collected · Outstanding · Overdue;
     - the toolbar line with the schedule, Send reminders and Export;
     - one row per team, with the head coach, in bands (**Needs you** first, then On track);
     - a state chip only where there is something to say.
   - **The team's bill is a ROOM** (List · Room · Question): four tiles, then the installments, each with its
     due date and, once received, the day, how, the reference and who recorded it.
     - **Record received** sits on each unpaid installment, olive.
     - The bill names its neighbours at its foot ("‹ 10U A · 1 of 3 · 16U Girls ›", the 2026-09-30 ruling),
       through the teams on the same band.
     - A quiet **Undo** sits at the foot.
     - "Remind {team}" and the door to the team's account.
   - **The questions:**
     - **Record $450.00 received** asks for the day, how (a dropdown) and the reference, and says what will be
       written and where, naming the team;
     - **Confirm received** is the same window, filled in from the coach's note;
     - **Undo** asks for a reason, names both sides, and is not red.
   - The allocation's export gains team names and each payment's method and reference.
6. **The Payment requests tab** (specimen 4).
   - **The toolbar:** the Team filter, quiet, and Export. No count line.
   - **The columns:** Team · Request · Direction (To club / From club) · Filed as · Amount · State · chevron.
   - **The bands:** Waiting on you (with a total) · Decided this season.
   - A waiting row's state is its age. A row holding up a payout says so in red under the request.
   - Approved, Declined and Reversed; only Approved takes colour.
   - **The request's window** shows the coach's quote, the direction, Filed as, the budget item, who asked and
     when, and how they'd like it; then Decline and **Approve** (lime).
   - **Approve** asks for the date, how and the reference, and names the line and the coach's side.
   - **The To-club variant** is "Confirm $180.00 received", with the red-edged "holding up the payout" notice.
   - **Reverse this approval** is quiet, at the foot of an approved request's window, with a reason, and is not
     red. Decline keeps its required reason.
   - **Phone:** one frame with bands. A request opens full-screen, with Decline and Approve docked at 44px.
7. **Reminders** (specimen 6).
   - **The Send reminders window:** "Remind about", then who gets one (each team, its head coach and any staff
     with the team's money access, and what it owes, with a Late chip), who can't be reached and why, and "last sent", then **Send 7 reminders** (lime).
   - The single-team variant sits in the bill.
   - The overview's old reminder doors leave Accounting (session 1's retire list).
   - The email's and window's words are `/marketing`'s; use drafts until they rule.
8. **The coach's side** (specimen 7, portal, phone and both themes). The Club panel keeps today's room, tiles,
   cards and the words Paid and Left.
   - **"We've sent it"** replaces "Record as paid", in the same place and style (a full-width 44px row on a
     card). Its window asks for the day, how and the reference, then Tell the club.
   - The card then reads "Sent {day} · waiting for the club", with Take it back.
   - **The Undo leaves a payment the club recorded.** An installment the club undid shows the club's reason.
   - **Money notifications** appear in the "Your club" settings group (session 1's keys).
   - **A stale tap is refused in words** (session 1's 409), and the card refreshes in place.
   - **The settlement sheet** keeps today's words and greyed button. It gains only the grey line: the club has
     been told, and when (S3A-03).
   - **The coach's Ledger** shows a sent installment as money out on its sent date, with a "Sent · waiting for
     the club" chip, and Cash on hand follows (ruled 2026-09-30). The bill's Paid and Left still mean "the club
     has it".

## Retire the old look as you rebuild (definition of done)

- This session **retires the old-look code** of:
  - the Accounting overview;
  - the ledger page;
  - the allocations list and detail pages;
  - the payment requests page.
- `npm run check:old-look:report` lists them. The colour-debt list holds `accounting`, `bva` and `budget`;
  `bva` and `budget` go with 3b.
- Use the tournament redesign's method (its Stage 1 prompt's "Retire the old look" section).
- **Lock in every drop with `--init` in the same commit.** If another session has any of the baseline's files
  modified, run `--init` in an isolated copy of your staged tree and commit only your files' lines.
- **Legacy branches this session replaces are deleted, not left as dead code.** `check:css-selectors` catches
  orphans.

## Help, walks, sweep

- **`/docs`:**
  - the accounting articles: the tabs; Allocations and Payment requests under Accounting; record received;
    sent and confirm; undo and reverse; reminders; payees; the Ledger's order and filters;
  - the coach's club-money help ("We've sent it"; the club confirms);
  - C19's three overclaiming lines ("invoices, reconciliation"; "track invoices"; Budget vs. Actual's "future
    update");
  - publish with the screens.
  - "Pay everyone and close the season" (it doesn't close the season) goes to `/marketing` with the windows'
    words.
- **Walks §E on the hub's QA tab.** One purpose per walk, signed off one by one, checkable, with a paste-back;
  number the ledger rows at write time, after re-reading the Owner QA Ledger.
  - the frame and the tabs, desktop and phone;
  - the Ledger;
  - allocations, and the loop end to end with a coach on the other side;
  - requests, including one holding up a payout;
  - reminders;
  - a team's account.
- **The fixture** (`scripts/seed-club-fixture.mjs --reset`) needs:
  - an allocation with two overdue teams, one coach "sent" waiting, and one received and then undone;
  - requests in every state, one of them holding up a coach's payout;
  - a pending cheque, a void and a transfer to a tournament book;
  - two spellings of one payee;
  - a team with no head coach, which a reminder can't reach.
- **The layout sweep** runs in both themes: every new screen and state, at the phone widths, with a new
  baseline. The coach's Money and Insights hubs must not move.

## Gates

- `verify:changed`, `typecheck`, the unit tests (the table-recipe and row-list guards where they reach admin),
  `check:layout` in both themes, `check:old-look`, `check:css-selectors`, `check:spelling` and session 1's
  money gates.
- `/simplify`, then `/review` at the **high-risk** tier (money screens and a shared component moved), then
  `/docs`. Offer `/design` for a review pass.

## Hand-off

- **An owner-voice summary:** what a treasurer, a club admin and a head coach see differently, and how to walk
  it.
- The walks are ready on the hub.
- The plan §6 Stage 3 record, memory and TODO.
- **Commit only when the owner says,** from a private index.
- Stage 3a's exit is the owner's §E walks passing.
