# Tournament admin redesign · Stage 4 drawn — After the event (the finished board, "Run it back", Summary, Past tournaments, the Tournaments list)

> Paste into a fresh session on `dev`. Written 2026-10-05, after Stage 1 (§253 ✅) and Stage 2 (§254 closed; its
> follow-ups `4db0faab`) were built and walked. **Design only: no product code until the owner rules.** Round 1 of
> the joint sequence: Club Tier Stage 3b's drawing may run at the same time, and the "one control height" build may
> still be running. Read "Working beside the other sessions" before touching the dev server or a shared file.
>
> **Read first:**
> - `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
>   - §1: evidence. Label every guess as a guess.
>   - §2: the rulings not reopened.
>   - **§3 "After the event"** (F32, F33, F34, F35). F32, F34's leader sort and "0 champions detected" were fixed by
>     the defects pass (`936655a9`, §251); they are your "before", not your work.
>   - **§3 "Create and set up", F26**: the reuse notices nobody can reach. Stage 4 owns the reuse flow; Stage 5 owns
>     creation.
>   - §4: the nine rules across the stations.
>   - §5: the ladder, row 4. **Desk first.**
>   - §6 Stage 1 as built: the row recipe and what it left for Stage 4 (the dashboard's before- and after-event
>     views, 207 kit rules and 36 `kx`; the Summary page's `legacy=` props).
>   - **§6b Stage 2, as drawn and as built.** This is the newest method, and its record is the model for yours.
>   - §7: A2, the one event identity; A11, a worded action on a phone row; A12, a row's action is olive.
>   - §9.
>   - §11: the formatting check. Stages 1 and 2 ran it; run it before the owner sees anything.
> - The hub (ONE artifact; republish the SAME path): `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_HUB.html` =
>   https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM.
>   - **Walk tab, station 13 (after the event) and Q 13.1.** Q 13.1 was ruled "as recommended" on 2026-09-29:
>     *Reshape, in Stage 4: the wizard's reuse step is the one flow; Summary and the finished board open it.* Draw
>     it. Don't ask it again.
>   - The Stage 1 and Stage 2 tabs, for the drawing method.
> - `docs/agents/design/TABLE_AND_LIST_STANDARD.md` (§3.5, §3.6, §3.7) and `TABLE_EXCEPTION_REGISTER.md`.
> - Memory: `project_tournament_admin_redesign`, `project_tournament_exhibition_format`,
>   `feedback_portal_is_the_formatting_benchmark`, `feedback_build_to_approved_mockups`,
>   `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`.

## The rulings since Stage 2 was drawn (in-repo `memory/design_decisions.md`). Your drawings follow them.

- **A plan lock is never a dashed box**, and **an admin record opened from a list names its neighbours at its foot**
  (both 2026-09-30, from Stage 2's `/design` review).
- From 2026-10-01:
  - Every admin action button is the portal's white button.
  - A door is olive text; an action that opens a window is an outlined button.
  - One button size; a toolbar door is a button.
  - Export is one button.
  - One toolbar in every view, with rare tools behind Tools.
  - A record reads first and edits whole.
  - A waiting count is the amber pill.
  - A filter pill's panel opens where it fits.
  - The nav lists doors only.
  - No club name above a page title.
- **One control height: 34px on a computer** (2026-10-03).
- From 2026-10-05:
  - A filter's count sits at its row's end; a narrowed pill names its choices.
  - **Phone sheets are one frame, two layers, three heads.** The admin's bottom sheet takes 18px corners and the
    portal's dim the next time it is touched (D4).
- Still binding from Stage 1: **a row's worded action is olive; lime is one main action per screen** (A12). A row
  that opens, opens from anywhere. A phone list is one frame (S.7).

## Verify before drawing (the plan's §3 was measured 2026-09-28; the code has moved)

- **Which of F33, F34 (what's left), F35 and the after-event half of F26 are still open.** Tag each on the hub as
  open, fixed (with its commit) or partly fixed.
- **What the finished board already does.** `dashboard/page.tsx`'s completed branch already shows a wrap-up card:
  "Tournament Complete", the champion chips, a one-line count, and "Review event summary →" on Plus or "View
  results →" on Free. Draw from what is there; don't draw a celebration that exists as one.
- **Which stage owns the dashboard's before-event view.** Stage 1's record gives "the before- and after-event views"
  to Stage 4, but the ladder's row 4 names only after the event, and the before-event view is setup work. That is
  Ask 1. Don't draw the before-event view until it is answered.
- **The plan gates, read from code** (`lib/plan-features.ts`): `tournament_cloning` and `sealed_archives` are
  Tournament Plus. The Summary page's own words say the saved summary and shareable results are too. Reconcile with
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`, and never restate a price. **No gate value changes.** Draw what a Free
  organizer meets.
- **The demo's `post-event-summary` anchor** (`summary/page.tsx`, on the page header). The plan lists it among the
  anchors that must survive, but today's tour steps (`sandboxTourSteps` in `lib/sandbox-chrome.ts`) don't seem to
  visit it. Confirm. If it is unused, report that as a finding for `/demos`. Keep it in the drawing either way;
  removing it is not this stage's call.

## What Stage 4 draws

1. **The finished event's board** (`dashboard/page.tsx`, the completed branch, and its stylesheet). Desk first,
   phone usable.
   - It celebrates the champions with what the event really produced.
   - It offers "Run it back" (Q 13.1).
   - It applies the one event identity (A2) as Stage 1 built it.
2. **The one reuse flow: "Run it back".**
   - The wizard's reuse step (`components/admin/TournamentSetupWizard.tsx`: the choose / clone-name pre-steps and
     the copy options, structure · venues · registration · public presence · content) is THE flow.
   - Draw every door into it. The finished board, Summary's "What's next" (which today has its own window: F33's
     second flow, which goes), the Tournaments list's per-row reuse, and Past tournaments if Ask 2 keeps it.
   - The wizard is **shared with Stage 5**. Draw the reuse step only. A change to the wizard's frame or its creation
     questions is an ask tagged "shared, Stage 5".
   - **F26:** on a one-slot plan, today's reuse notice can't be reached. Draw what a Free organizer actually meets
     on each door, and where the plan lock sits (never a dashed box).
3. **Summary** (`summary/page.tsx`, `summary.module.css`).
   - F34: on a phone today, each card holds one figure in 143px.
   - "Share" should link the champions page (J1-112). The champions page is public, so it is only a door here.
   - "Print" should print the summary, not the admin frame around it (J1-110). Draw the printed page.
   - "What's next" sits closed at 1,713px on a phone.
   - Draw the Free organizer's view too.
4. **Past tournaments** (`archives/page.tsx`, `archives-admin.module.css`).
   - Today it offers only Seal (a Plus feature) and View.
   - Draw where the way back from an archive lives. Since F32, the words point to the Tournaments list's status
     menu, which needs a free slot. Decide with Ask 3.
5. **The Tournaments list** (`app/[orgSlug]/admin/org/tournaments/page.tsx`; the `tournaments/manage` route
   re-exports it).
   - F35: the status menu writes the moment it changes, including to Draft, with no confirm. Its subtitle says "set
     which one is live" above several live rows.
   - One name for the page. The browser tab (`AdminTitleManager.tsx`) and the help (14 places) say "Manage
     Tournaments"; the rail says "Tournaments". The one-spelling rule applies, and the words are tagged `/marketing`.
   - A phone list is one frame; each status has one colour, in words.

**Include the Exhibition format.** An Exhibition event has no standings and no bracket, so it has no champions
(`TOURNAMENT_EXHIBITION_FORMAT_PLAN.md`: an item that does not apply is ABSENT, not empty). Draw what its finished
board and its Summary celebrate instead, or say that they celebrate nothing.

**Not drawn. List these on the hub as the build's work:**
- the print stylesheet;
- the clone route's options (unchanged unless an ask changes them);
- the confirm behind a status change;
- **the old look's retirement** in every file Stage 4 rebuilds: the dashboard's after-event rules (and the
  before-event ones if Ask 1 gives them to Stage 4), the Summary page's and Past tournaments' `legacy=` props and
  their stylesheets. `npm run check:old-look` and the strict admin colour gate hold this.

These are out of scope here: public pages (the champions page appears only as a door), Stage 5's creation
questions, the schedule (Stage 3), and the Club seams (A5).

## Method (Stage 1's and Stage 2's)

1. **Measure before you draw.**
   - Put the probe in `.probe/`, never in `test-results/`.
   - Measure at 1440×900, 768×1024, 390×844 and 360×780, in Warm and Dark, and read the numbers from the browser's
     geometry.
   - Record:
     - where the champions and "Run it back" sit on the finished board;
     - Summary's first figure, and its "What's next";
     - the taps to reuse a setup from each door;
     - every control under 44px on a phone;
     - every sideways spill.
   - ⚠ **You need a finished event.** First find one in the fixture (`uat-plus-org`), or in the local demo
     (`riverdale-minor-ball`), or say that there isn't one. **Complete, seed or archive nothing without asking**,
     and never write to production's demo. If none exists, draw the "before" from the code and say so on the
     drawing.
2. **Draw on a new "Stage 4" tab.**
   - True size and both widths: the whole screen before (today's captures) and after (drawn Warm, with a Dark copy
     cloned at load).
   - Every flag and fix chip is clickable, with its `data-here` sentence.
   - Every element is tagged NEW, RESTYLED or UNCHANGED, with its own note.
   - Put the 44px block beside every phone frame.
3. **Run the formatting check before the owner sees anything.** Use the plan's §11 list, the table standard and the
   rulings above. Put it on the Stage 4 tab's last section, as Stages 1 and 2 did.
4. **Write the asks.** Each one gets options, a recommendation, the tradeoff, and a checkbox per option on the
   paste-back.
5. **Taps to beat.** Record today's and the drawing's for:
   - running a finished event back;
   - reusing a setup from the Tournaments list;
   - sharing the champions page;
   - printing the summary;
   - bringing an archived event back.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Who owns the dashboard's before-event view.** Recommend **Stage 5**, because it is setup work (the checklist
   and the guidance rail), with its share of the 207 kit rules. Stage 4 draws and retires the after-event view
   only. The plan records the split. The tradeoff: the dashboard's stylesheet is cleaned in two passes.
2. **Which doors open "Run it back".** Recommend the finished board's main action (its one lime), Summary's "What's
   next", and the Tournaments list's per-row reuse. Past tournaments joins only if it opens the same flow, never a
   second one.
3. **The status change** (F35). Recommend that every status change is an action that asks first, saying what it does
   to the public site and the slot in F32's archive words (`lib/tournament-archive-words.ts`). That follows the
   "create asks" half of the save rule: a change that takes a site offline is not a quiet field edit.
4. **What a Free organizer sees after the event.** This covers the Summary, Seal and "Run it back" doors. Recommend
   the door shown with an honest lock (never a dashed box), placement only, words tagged `/marketing`, and no gate
   change.
5. **Anything the measuring finds** that §3 misses. Say so; don't force-fit it.

## Working beside the other sessions

- **Club Tier Stage 3b's drawing** may run at the same time, and **the "one control height" build** may still be
  resizing every admin button.
  - **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another
    session is measuring. A second runner rotates the shared UAT sessions and signs the other one out mid-run.
  - A "before" captured while that build is in the tree may show 34px or 38px buttons. Draw the "after" at 34px
    (ruled), and say which height the "before" shows.
- **A new shared pattern is an ask, not an invention.**
  - Rows and tables have one recipe: `ClubRow*` in `components/admin/kit/club/RepKit`, extended by Stages 1 and 2.
  - The phone sheet has one frame (2026-10-05).
  - A new variant (a champion card, a status row with an action) is drawn as an ask tagged "shared, Club Tier
    draws tables too".
- **No code, no help, no gates.** Your files:
  - the hub's Stage 4 tab, and its FINDINGS / INTENTS / Decisions additions;
  - the plan's §5 row 4 and a §6-style Stage 4 section (`§6d`, leaving `§6c` for Stage 3);
  - the PM brief, your TODO line, and memory.

  Read the hub fresh before every edit. **Parse its scripts before every publish**, because one bad apostrophe
  kills every tab. Never `force` a refused publish.
- **Git:** use a private index and explicit pathspecs. Commit only when the owner says.

## Hand-off

- Write in product-owner voice.
- Lead with what an organizer sees and does differently the day after a tournament: the champions, running it back
  for next year, sharing and printing the results, and archiving.
- Give the measured "before" and the drawn "after" (positions and taps).
- **Tell the owner to open the hub on a phone** for Summary and the Tournaments list.
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Don't write the Stage 4 build prompt until Stage 4 is ruled.** Its definition of done will include the old-look
  retirement above, and its build waits until "one control height" has landed.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw Stage 5's creation questions, the schedule (Stage 3), public pages (the champions page only as a door), the
  Club seams, or the admin frame or navigation.
- Change a price, a plan name or a gate, or write customer copy. Draw the placement and tag it `/marketing`.
- Remove a demo tour anchor without naming its new home.
- Mint a second artifact. The hub is the only one.
