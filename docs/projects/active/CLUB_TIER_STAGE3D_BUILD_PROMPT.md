# Club Tier Stage 3d — the last money pages become windows: Payees over the Ledger, an allocation that reads first (built to hub version 61)

> Paste into a fresh session on `dev`. Written 2026-10-08, the day the drawings were **ratified**: every ask as
> recommended (owner: *"I agree with your recommendations"*), with the owner's correction made on the drawings the
> same day: **a summary's figures are one joined band** (*"the new standard is that they are connected"*). **One build
> session**: there is no migration (the allocation's note column exists since mig 318).
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3d** (version 61).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED and
>   COPY tag note is a requirement; open each one. The flags (S3D-01…06) name the finding each drawing answers.
> - **"Formatting check"** (`#s3d-format`) is your checklist, every row. **"Not drawn"** (`#s3d-build`) is the build's
>   list; this prompt expands it with file anchors.
> - The Decisions tab holds the seven rulings, each with its reasons. Where you must depart, say so at build time and
>   record why; never silently.
>
> **Read first:** plan §6 Stage 3, the **3d** blockquotes (ADDED, DRAWN, the owner's band correction); memory
> `project_club_tier_readiness`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_money_figures_one_joined_band`, `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`,
> `decision_autosave_word_is_transient`, `decision_drawer_layers_form_vs_menu`, `decision_export_is_one_button`,
> `decision_close_x_is_plain_glyph`, `project_coach_back_one_level`, `feedback_shared_component_over_shared_class`,
> `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`. The in-repo `memory/design_decisions.md` entries from 2026-09-21 on, especially
> 2026-09-30 (an admin record opened from a list names its neighbours; Delete leaves the foot), 2026-10-02 (the two
> Ledgers read the same: D6, D7, D8), 2026-10-05 (phone sheets; a notification opens where you are) and 2026-10-08
> (the Export menu).

## ⚠ The lessons this stage already paid for

- **Plans in this repo undercount; the code is the list.** The plan named five doors into an allocation; the code has
  ten. The mockup prompt assumed an allocation's pencil "edits what can change"; nothing could change. Before wiring a
  door, grep for it again (`accounting/allocations`, `accounting/payees`, `allocationId`): another session may have
  added one since 2026-10-08.
- **The window kit stacks a question over a form and nothing else** (`KitDialog.module.css`: form 400, question 410).
  Every 3d level opens IN PLACE or HANDS OFF; the one new layer is Payees raised over an entry (§1 below).
- **A walk of a screen another session is editing is not a walk** (§283 W13: its create never reached the server
  while the window was rebuilt under it). The Stage 6 session (venues, the club calendar) may be building beside you;
  it shares no 3d screen, but it shares the hub, the plan, the ledger, the dev server and the test club.
- **A drawing copied from what was built freezes an unreviewed screen** (the 3c New allocation lesson, and the band:
  the first 3d drawing copied the bill room's separate boxes). Where 3a's code disagrees with the hub, the hub wins.

## Preconditions (check before code)

1. **Git:** you are on `dev`; `git log` and `git status` read fresh. Other sessions' uncommitted hunks in shared files
   (TODO, the plan, the ledger, the hub) are theirs: build shared files as HEAD plus your own hunks.
2. **The UX summary for the owner comes first** (AGENCY_RULES), short: what a treasurer sees differently (Payees from
   the Ledger and from inside an entry; an allocation from each door; the name and note; the joined figures), what an
   owner and an admin with Accounting see (the same), a read-only member (reads, no pencil or money moves), a
   group-limited member (their teams only, as today), and a head coach (**nothing changes**). Any departure.
3. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` sweep or `auth-setup`, and
   whether the Stage 6 session is measuring. Read-only probes only; never reset the test club (UAT Rep Club) without
   asking: a reset ends every session's club sign-ins. Ask before a dev-server restart (new files and shared modules
   change in this build, so one is owed before the walks).

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **The club's Payees is a window over its Ledger** (Ask 1), as the coach's (Ledger Parity D8): D8a, ruled.
  2. **A level inside a window opens in place, behind a named back** (Asks 2, 4): "← Payees", "← {allocation}" at a
     desk, the bare ← on a phone, and Back goes up one level before it goes out. Never a second form over a form,
     with one exception (5).
  3. **An allocation reads the bill first, and edits only its name and note** (Ask 3): the line and fiscal year as its
     eyebrow; the four figures; the schedule; the teams; the note. Its terms never change after it is made (Ask 7b).
     Send reminders is the Allocations tab's alone. Its Export stays, in its window's foot: the one window in Accounting
     with an Export, because its file has a reader.
  4. **A record opens where you are** (Ask 5): from a page, over it; from a window, that window hands off to it and
     turns back on close; from outside, its home tab with the window open.
  5. **Payees over the entry being typed** (Ask 7a): the one form-over-form layer, between the form and question
     layers, so "Manage payees…" (D7) never throws an entry away.
  6. **A money summary is one joined band, in a window too** (owner, 2026-10-08): the portal's `MoneySummaryBand`;
     separate figure cards are drift.
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** only if your build changes a table rule (it shouldn't). The band
  is not a table.

## What to build

### 1. The window kit (`components/admin/kit/club/KitDialog.tsx` + `.module.css`)

- **A named back** for a level inside a window: a `back` prop `{ label, onBack }`. At a desk it draws "← {label}" at
  the head's top left, above the eyebrow (the coach's `RoomShell back`, drawn on the hub as the small soft line); on a
  phone the existing ← (today it closes the form) goes `onBack` instead. Pass `onBack` to `useDialogFloor` (it already
  takes one: "Back goes up one level"), so the phone's Back does the same. × still closes the whole window.
- **A raised form** (Ask 7a only): a `raised` prop putting a form window on its own layer between 400 and 410, with its
  own scrim over the form beneath; Escape, × and Back close the TOP window only (the floor already counts windows; the
  page-scroll lock is a counter). A question opened from the raised window (Merge, Delete, New payee) still lands on top.
- Guard both in a unit test (the layer order; the back calls `onBack`, not `onClose`).

### 2. Payees, a window over the Ledger (specimen 1; Asks 1, 2, 7a)

- **A new club `PayeesWindow`** (`components/admin/kit/club/money/`), built from `app/[orgSlug]/admin/accounting/payees/page.tsx`
  (its read `GET /api/admin/accounting/payees?all=1`, its `PayeeWindow`, `TeamsRecorded`, `MergeQuestion`,
  `DeleteQuestion`, `NewPayeeWindow`), with the coach's `app/[orgSlug]/coaches/teams/[teamId]/accounting/PayeesWindow.tsx`
  as the benchmark for its levels. A 640px form window.
  - **The list level:** eyebrow "Ledger", title "Payees", ×; the page's table unchanged (Payee · Entries · Last used ·
    Teams for a club with teams · one chevron; a row opens from anywhere) and its note word for word; **New payee** in
    the foot (white, it asks, as today). Empty state as the page's.
  - **The payee level, in place:** "← Payees", then §283 W10's window **unchanged in what it says** (the eyebrow, the one
    read line, the teams' report as its body with the Year pill only past one year, the pencil turning Name and Shared
    with teams into the form, the floating pill). **Three chrome changes:** Previous · Next through the list in the foot
    (the kit's `steps`, noun "payee"); **no Done**; **Delete** (only when nothing names the payee) **leaves the foot** and
    ends the body, alone, red, asking first. Merge stays at the foot's left. A refused rename holds the window once,
    as today; leaving the level goes through the same hold.
- **Doors:** Ledger › Tools › Payees (`ledger/page.tsx:264`, today `href={payeesHref}`) opens the window over the
  Ledger, the Book, filters and period untouched. The Ledger page reads `?payees=1` (the list) and `?payee={id}` (that
  payee) once on arrival, then drops them from the address, as `?payee=` does on the page today.
- **From the payee picker** (Ask 7a): `PayeeField` in `components/admin/kit/club/money/LedgerWindows.tsx:185` passes
  `manageHref` to `PayeeCombobox`; pass **`onManage`** instead (the coach's way), so Add entry and an entry's window
  open Payees **raised** over themselves and keep everything typed. If the payee the entry had picked is merged away,
  the entry's payee follows to the one kept (the coach's form does this through its `onChanged`).
- **Retire the page** (`payees/page.tsx`) and its old look; its address forwards (§6).

### 3. An allocation's window (specimen 2; Ask 3)

- **One component** (e.g. `components/admin/kit/club/money/AllocationRecordWindow.tsx`) that any host opens by id and
  that holds both levels and their questions. It reads `GET /api/admin/accounting/allocations/{id}` itself. An 800px
  window (`wide`), at both levels.
- **The allocation level reads, in order:** eyebrow = the line it bills from · its fiscal year ("Diamond permits — city
  fields · 2026–27"; "Off-plan · 2026–27" without a line; a closed year with the lock glyph); the name as the title;
  the four figures as **`MoneySummaryBand`** (Allocated · Collected · Outstanding · Overdue, the server's one
  definitions; Overdue in the verdict tone; captions as drawn); one read line "Schedule: Three installments: Aug 23,
  Sep 22, Oct 17"; the teams table **unchanged** from the page (bands Needs you / On track, the state chip only where
  there is something to say, the closing row; a row opens the bill), with **Next on one line** (Head coach gives way
  first at 800px); then "Note" with the club's note or "No note.". The page's under-table note goes (CD4).
- **The foot:** Export at the start (the page's `AllocationExport`, unchanged: a row per installment); Previous · Next
  through the Allocations list **only when opened from it** (noun "allocation"). **Send reminders is not in the window**
  (S3D-04).
- **The pencil** (only `canEdit`: a money mover, an open year): Name (required; hint "Shown on each team’s Club page.
  Ledger lines already written keep the name they were written with." — /marketing words it) and Note (≤ 2000, its
  New allocation placeholder), saving as you go (`useRecordAutosave`, the window's floating `SavePill`); a blank name
  held with its reason under the field; ✓ saves what is pending first. The figures, schedule and teams read while
  editing. **A closed year's allocation:** no pencil, one locked line ("Counts in 2025–26, which is closed. To change it,
  reopen 2025–26." — /marketing words it), its unpaid installments still receivable.
- **The bill level, in place** (specimen 3; Ask 4): "← {allocation name}", then 3a's `BillRoom` unchanged in what it
  says and does (eyebrow, team, installments, Record / Confirm / Undo / Remind, Close, "Open {team}’s account", steps
  through its band), **its four figures as `MoneySummaryBand`** (today `MoneyKit` `Tiles`). Record, Confirm, Undo and
  Remind keep handing off in the bill's place and returning to it. A door to a team's bill opens the window at this
  level; Back goes up to the allocation first.
- **When money moves inside it** (a receipt, a confirm, an undo, a rename), it re-reads itself and tells its host
  (`onChanged`), so the host re-reads its own figures (the Ledger's lines, the Overview's still-open rows, a team's
  account, Coming due…). A host that shows no figure from the allocation may ignore it.
- **Phone:** the form layer (covers the bar), ← top left (out at the allocation level, up at the bill level), the band
  two-up, the teams as the page's phone rows, Export as a 44px icon in the foot beside the neighbour.

### 4. The server (no migration)

- **The read adds the note:** `loadClubLoop` / `LoopAllocation` (`lib/club-money-reads.ts:44`) load `notes`;
  `allocationDetail` returns it. `canEdit` stays as it is (money mover and not `year.locked`).
- **One edit route under Accounting:** `PATCH /api/admin/accounting/allocations/{id}` `{ description?, notes? }` through
  `resolveClubMoney(…, { scope: 'loop', write: true })`; a blank name → 400 in words; notes over 2000 → 400; the
  member's team groups checked (the B11 guard the Rep Teams PATCH carries); a closed year refused in the lock's own
  words (mig 318's `rep_cost_allocations_fiscal_lock` already raises `year_closed` on any update of a locked
  allocation; translate it, and pre-check `year.locked` so the words come first). **Retire the Rep Teams PATCH**
  (`app/api/admin/rep-teams/allocations/[allocationId]/route.ts`, no caller) and move the three guards that pin it
  (`club-stage2-server-guard.test.ts:555`, `club-stage3a-server-guard.test.ts:77`, `role-defaults-guard.test.ts:91`) to
  the new route, keeping what they assert (the money rule, the group scope).
- Nothing changes a bill's terms (Ask 7b): no route for shares, schedule or teams.

### 5. The doors (specimen 4; Ask 5's rule)

| Door (file) | After |
|---|---|
| Allocations › By allocation row, desk and phone (`allocations/page.tsx:227–256`) | the window over the list, steps through the list |
| Allocations › Coming due rows (`allocations/page.tsx:338, 352, 403–450`) | the window over Coming due, at the team's bill (a row shared by several teams: the allocation) |
| Budget › a line's window, its allocations (`BudgetWindows.tsx:220 AllocationRows`, used at 375 and 574) | the line's window hands off to the allocation's (the way `allocating` already does at 326); × returns to the line |
| Ledger › a line's window › Open the allocation (`LedgerWindows.tsx:366 sourceDoor`, rendered at 606) | the line's window hands off, at the team's bill; × returns to the line ("Open the request" is unchanged) |
| Budget vs. Actual › behind the figure (`StatementBehindWindow.tsx:82`) | the window hands off; × returns to it |
| Budget vs. Actual › a "from the teams" Budgeted figure (`budget-vs-actual/page.tsx:172`) | the window over BvA, its Compare and period kept |
| Overview › From 2025–26, still open (`accounting/page.tsx:521–525` and its rows) | the window over the Overview, at the team's bill |
| A team's account rows (`teams/[teamId]/page.tsx:120–124`) | the window over the account page, at the team's bill (Ask 6: the page stays) |
| The bell and email (`lib/club-money-notify.ts:157–165 clubMoneyLinks.allocation`) | Allocations with the window open (§6) |

- **Allocations is the window's address:** `accounting/allocations?allocation={id}` and `&bill={splitId}`, kept in the
  address while open (Back and a shared link land on it), as `?request=` does on Payment requests. Elsewhere it opens
  without changing the address.

### 6. Old addresses, notices, the joined band

- **`proxy.ts` (the accounting forwards, today lines ~112–153), each in ONE hop:** `accounting/payees` → `accounting/ledger?payees=1`;
  `accounting/payees?payee={id}` → `ledger?payee={id}`; `accounting/payees/{id}` (3c's forward) → `ledger?payee={id}`;
  `accounting/allocations/{id}[?bill=]` → `accounting/allocations?allocation={id}[&bill=]`; `rep-teams/allocations/{id}[?bill=]`
  → the same in one hop. New allocation's 3c forwards (`allocations/new`, `?line=`) unchanged; keep `?new=1` working.
- **Notices:** `clubMoneyLinks.allocation` writes the new address; the bell's label reader (`lib/notification-view.ts:310`)
  names it "Open the bill" / "Open the allocation" from the new shape and still from the old (stored notices);
  `tests/unit/notification-reader.test.ts:68, 77` pins both. The UAT seed `scripts/seed-uat-treasurer-notifications.mjs:121`
  writes the new address.
- **One joined band everywhere a club money record shows figures:** the bill room and **a team's account**
  (`teams/[teamId]/page.tsx:135`, recommended and ruled with Ask 3) move from `Tiles` / `FigureCards` to
  `MoneySummaryBand`; retire `Tiles` and `FigureCards` from `MoneyKit` once nothing uses them.

### 7. The old look's retirement

- Delete `app/[orgSlug]/admin/accounting/allocations/[allocationId]/page.tsx` and `.../payees/page.tsx`; their
  addresses forward (§6). `npm run check:old-look:report` before; lock **your own** drops with `--init` in the same
  change (`--init` also locks other sessions' drops: hand-drop your entries if a peer has uncommitted ones).
- **The export catalog** (`lib/export/catalog.ts:255` names the allocation page as its Export's home) points at the
  window; `check:export-catalog` green.
- Tests that read the retired pages follow the windows: `club-stage3c-screens-guard.test.ts:32` (`PAYEES`) and its
  payee assertions, `ledger-parity-screens-guard.test.ts:100`, `team-payees.test.ts:174`.

## Help, words, walks

- **`/docs`:** Payees (from Tools, and from the picker inside an entry), an allocation (what it reads; the name and
  the note; a closed year's), a team's bill inside it, and where each door now opens. Old "Payees page" and "the
  allocation's page" steps go; keep their words as search terms.
- **`/marketing`:** the tagged sentences (the name's hint, the closed year's line for a bill) and any new refusal.
  Draft them, tagged; don't ship placeholders.
- **Walks:** a new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger first and again
  after appending: the Stage 6 session may take one the same day), as checkable walks on the hub's QA tab, one purpose
  each, pinned to identities not figures, with the sign-in card. **The definition of done:**
  1. Payees from Ledger › Tools: opens over the Ledger, a payee in place, ← Payees, Previous · Next; × leaves the
     Ledger as it was (Book, filter, period).
  2. Payees from inside Add entry (type a date, an amount and words first): Manage payees… opens over it; close it;
     the entry is exactly as typed.
  3. Merge Mizuno Canada Ltd. into Mizuno Canada (writes; walkable once): the entry moves; read it back on the Ledger.
  4. An allocation from **every door** in §5, each closing back where it started (the line, the Ledger line, the
     behind-the-figure window, BvA, the Overview, a team's account, Coming due), and from a notice.
  5. Rename an allocation and give it a note (writes): read the new name on the coach's Club tab; the Ledger's old lines
     keep the old name.
  6. A closed year's allocation (Permit share 2025–26): no pencil, the locked line, Record received still offered.
  7. The old addresses: each forwards in one hop.
  8. A phone, at 390: Payees and an allocation, both levels, the band two-up, ← up then out.

## Gates

- `npm run verify:changed` (it runs the public-tokens check too), `npm run typecheck`, the targeted unit files,
  `check:club-money-arithmetic`, `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`,
  `check:old-look`, `check:export-catalog`, the one-definition guard, `money-summary-band-guard`.
- **A screens guard** (`tests/unit/club-stage3d-screens-guard.test.ts`, 3c's pattern): the two pages are gone and their
  addresses forward; Ledger Tools opens a window, not a link; the picker passes `onManage`; every §5 door opens the one
  window (no `allocations/${…}` page link left); no Send reminders in the allocation window; no write control on a
  locked allocation; no `Tiles` / `FigureCards` left in club money; the named back calls `onBack`.
- **`check:layout`, both themes,** on every touched screen (ask the owner first; `--only=` batches of about ten).
  Repoint `scripts/layout-screens.mjs:1453–1458` (`admin-accounting-payees`, `-payee-report`, `-allocation`) to the
  windows by their new addresses and add the phone width; baseline new entries with reasons, retire what no longer
  reproduces.
- Then `/simplify`, `/review` at the **high-risk** tier, and a `/design` review of the built windows against the hub at
  1440 and 390.

## Hand-off

- An owner-voice summary, the walks to run (and which files they depend on), departures from the drawings, and
  anything found and not fixed.
- The plan record (§6 Stage 3, "3d BUILT"), memory, the TODO line, and the hub's QA tab republished at the same address
  (read it fresh first; the first publish of a session needs the live copy READ in full — memory
  `reference_artifact_publish_needs_full_read`; parse every script before publishing).
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared
  index.
