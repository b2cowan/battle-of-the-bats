# Ledger Parity — plan

**Hub (mockup, decisions, brief, plan):** https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo — source
`docs/projects/active/LEDGER_PARITY_HUB.html`, frames in `docs/projects/active/ledger-parity/` (captured from the
live screens by `.probe/lp/shots.mjs`: BEFORE = the page as it renders; AFTER = the same page with the change applied
in the DOM). PM brief: `LEDGER_PARITY_PM_BRIEF.md`.

**Status:** RATIFIED 2026-10-02 — owner: "I agree with your recommendations on D1-D7" (D1–D7, D7a, D7b, every one as recommended). Build prompts: `LEDGER_PARITY_SERVER_PROMPT.md` (session 1) then `LEDGER_PARITY_SCREENS_PROMPT.md` (session 2); both reach production in ONE promote. **Session 1 (the server half) committed `ac22a1fe` 2026-10-02; mig 316 applied to dev 2026-10-02** — record and the call list for session 2 in § "Session 1 — build record" below. **Session 2 (the screens) and round 3 (D8–D10) committed `b0b27612` 2026-10-02; Owner QA §258 ✅ PASSED 2026-10-02, all five walks (48/48).** Left: D8a (the club's Payees as a window) is not drawn — the owner's call; production waits for the ONE promote (mig 315, then 316, minutes before it).

## Context

Club Tier Stage 3a's Ask 6 (owner, 2026-09-30) ruled that the club's book reads EXACTLY like the coach's Ledger, with
two deliberate differences (the figure is "Balance"; the Date filter opens on This month). On 2026-10-01 the owner
asked why payees, ledger entries and the ledger's size/format differ between the portals. Read from the code (an
Explore pass) and measured in the browser (`.probe/ledger-cmp.mjs`):

- **Size is the same**: both tables are the register recipe (K-01) — 12px body, 4.48px row padding, 28–29px rows. The
  club's page is ~70px narrower (`repKit.page` 68rem vs the coach's `pageWide`), so its longer What captions wrap more.
- **Five differences have no recorded reason** — D1–D5 below. In four of them the COACH Ledger is the one off the
  written standard (it predates the 09-28 no-controls-in-cells ruling and the K-25 phone card).

## Decisions (ratified 2026-10-02, as recommended)

- **D1 — Row dates: the statement convention.** Today: coach `fmtDate = formatStoredDate(s)` (year on every row,
  `expenses/panel.tsx`); club `day()` = `formatStoredDate(d, { withYear: false })` (`MoneyKit.tsx`). Proposed: both
  rows day-only; the year said once, on the balance rows (D2).
- **D2 — Balance rows carry their full dates, both portals.** Today: club `Starting balance · ${day(from)}` (no year);
  coach `registerBalanceRow` prints no date. Proposed: "Starting balance · Sep 1, 2026" / "Ending balance · Oct 31,
  2026" on both; the club's under-table note ("Oldest at the top, as a bank statement reads…") goes.
- **D3 — A coach row opens from anywhere; one chevron.** Today the coach's action cell holds `RowEditButton` (a
  pencil duplicating the row's own `openRecord`), or a worded `Link` ("Player Dues →", `r.sourceLabel`) on a derived
  row that is NOT tappable, or Record (`settle`). Not covered by any register entry (K-08/K-19 name other surfaces).
  Proposed: every row tappable; one chevron column; the name a button (the club's `nameButton` pattern, the keyboard
  door) **at the coach's regular weight — ⚖ revised by the owner 2026-10-02, after ratification: "I prefer the font
  styling of the coaches ledger for the what column (i.e. not bold)… update the club ledger to match rather than
  making the coach ledger match." So the CLUB's register drops its bold What; the coach's stays as it is.** (The
  phone card's title is not this ruling — see D4);
  a derived row opens a READ window — the club's `LineWindow` for a line another screen wrote (facts, one sentence on
  where it is changed, one door) — shared, not copied; Record stays beside the chevron on an unpaid installment
  (ruled 2026-09-04). The window shows for a read-only money assistant too (it reads; its door is a link they can
  already follow).
- **D4 — One phone card.** Today the coach's phone card (data-label cells, italic mono labels, full-width action
  button, Starting balance boxed inside a card) differs from the club's K-25 card (date top right, bold name, caption,
  labelled lines, corner chevron, plain balance lines). Proposed: the coach takes the club's card; the recipe moves to
  the shared kit so the two cannot drift.
- **D5 — Payees for every team.** `org_payees` rows carry `team_id` (a team's list) or none (the club's). A coach can
  search/create (`app/api/coaches/[orgSlug]/payees`, `…/teams/[teamId]/payees`) but never rename or merge; the club's
  Payees page (`app/[orgSlug]/admin/accounting/payees`, routes `api/admin/accounting/payees/[payeeId]` + `/merge`,
  `club_payee_merge` in mig 315) manages the club's list only ("The club's payees only: a team's payees are its
  coaches'"). Proposed: a Payees page under the coach's Money for the team's list — entry counts, last used, rename,
  merge, never delete one in use — gated on the team's money-write permission; doors: a Payees button beside Export,
  the View pill's foot on a phone, a last row in `PayeeCombobox` ("Manage payees").

## Round 2 (2026-10-02) — D6 and D7, direction ruled by the owner, drawings in review

- **D6 — Payees behind Tools, not a tab, not a toolbar button.** Owner asked whether Payees should be its own tab;
  ruled as recommended: a tab is a view of the book you work in (09-30), Payees is a list you tidy; rare tools go
  behind Tools (⋯) (10-01). Both Ledgers end: [Book|View] · Export · Tools · [lime add]. Club Tools = Transfer
  ("This book") + Payees ("The club's lists"); coach Tools = Payees ("The team's lists"); `CoachToolbarMenu`
  (sheet on a phone). The payee picker's last row = "Manage payees…" (the club's `PayeeCombobox foot` exists; the
  coach's gains it). ⚠ Supersedes round 1's Payees BUTTON — the club Ledger's Payees button built on dev
  2026-10-01 (uncommitted) moves into Tools at build.
- **D7 — Shared payees** (Business Decisions Log 2026-10-02, widens Club Tier D1 narrowly). ⚠ **Finding:** in a club,
  `searchOrgPayees(org, q, teamId)` returns `team_id IS NULL OR team_id = team`, so every coach's picker ALREADY
  lists every club payee (`PayeeCombobox` section "Organization") — wholesale, silent. Proposed: a `shared` flag on a
  club payee (owner/treasurer/admin with Accounting; switch in the payee window + a Teams column on the list); the
  coach search returns shared club payees + the team's own; the picker section reads "Shared by your club" (the tag
  legend's own words) with "Your club sees payments to these payees."; a team can merge its own duplicate INTO a shared
  club payee; the club's report in the payee window (teams, amount, date, "Nothing recorded (n)", not proof) is
  **Stage 3b** scope. **Open:** D7a — count only payments recorded after the notice shipped (recommended; needs the
  share/notice timestamp); D7b — at launch a club payee any team has used starts shared (recommended; data step).
  Migration: the shared flag (+ shared-at timestamp) on `org_payees` → DATA_DICTIONARY + snapshots.

## Round 3 (2026-10-02) — D8–D10, asked by the owner during the §258 walk, drawn, RULED, BUILT on dev

Hub screens 10–12; frames `ledger-parity/r3-*.jpg`, captured by `.probe/lp3/shots3.mjs` (live dev page, proposal
applied in the page with the product's classes). **Ruled as drawn 2026-10-02 ("looks good, go ahead and build") —
D8, D9, D9a, D10; D9b fixed. D8a (the club's side) was not drawn and stays open. Built on dev the same day; W3 of
§258 rewritten for the window.** Build record below the decisions.

- **D8 — Payees is a window over the Ledger, not a page.** Owner: "do we need to open a new page for this? wouldn't a
  drawer be in line with our portal standard?" Finding: the picker's "Manage payees…" (`PayeeCombobox manageHref`, a
  Link) sits inside the bill window (`CommitmentView`) and the Add a bill form, so it leaves an open form — the trip
  refused for tags (`TagManagerDrawer` header). The team's other lists already open in place (`BudgetItemManagerModal`,
  `TagManagerDrawer`). Proposed: the list in the room frame (`RoomShell`), a payee one level in with
  `CoachModalHeader backLabel="Payees"`; from the picker it opens over the form and closes back to it. The
  `accounting/payees` route goes (dev only). Phone (owner, 2026-10-02): the figures go on a line UNDER the name —
  `tableAsCards cardsFramed` with `cardPhoneLine`, NOT `cardsOneLine` (today's page), and the name drops the kit
  `.name` 44px touch floor there because the row is the target. **D8a:** the club's Payees the same (its picker's door is inside
  `LedgerWindows`' entry window) — recommended, not drawn.
- **D9 — A payee is a record.** Owner: "I see entries of 1 but when I click it all I can do is change the name."
  `org_payees` holds name + notes only — no contact fields proposed. Proposed (the 10-01 reads-first standard): tiles
  Paid this season · Still to pay · Next due; this season's entries as the Ledger's own register rows (edge, Record on
  an unpaid installment, click opens what the Ledger opens); Note; header pencil ↔ ✓ for name + note; foot Merge /
  Delete-when-unused; Prev/Next. List columns Paid · Still to pay · Last paid. Finding: today's Entries counts
  `rep_team_expenses` naming it across ALL seasons (`listTeamPayees`) and Last used = `created_at`, not paid.
  **D9a:** this season only (recommended; every season makes a live screen read closed seasons — 2026-08-18 ruling).
- **D9b — DEFECT (not an ask):** `CommitmentView.seedPayee` seeds the Payee field from `payeePayer` only (3fc1a079,
  2026-08-27, on prod). After a rename or merge (`team_payee_merge` repoints `payee_id`, never `payee_payer`) the bill
  window keeps the old spelling; a bill with `payee_id` and no `payee_payer` shows an empty Payee, and the window's
  autosave PATCH sends `payeeId: null, payeePayer: null`, which the route writes — the payee is cleared by an
  unrelated edit. The fixture's "Diamond permit — fall block" shows it. Fix: read the payee's current name by
  `payee_id`, fall back to `payee_payer` only for a free-text name, and never send a payee the coach did not touch.
- **D10 — Tools holds the team's three lists.** Owner: "if the payees is the only thing in the tools dropdown then do
  we need a tools dropdown?" Proposed: Payees · Categories & items · Money tags under "The team's lists", each opening
  its existing window (two frames today; not unified here). Alternative: a plain Payees button.

### Round 3 — build record (2026-10-02, committed `b0b27612` with session 2)

- **Window:** `accounting/PayeesWindow.tsx` (+ `.module.css`) — ONE `RoomShell` whose props switch by level (list ↔
  payee), so the overlay never remounts between them; questions (new · merge · delete) carried over from the deleted
  page as `QuestionShell`s. The panel draws it BEFORE the read window, the bill and the money form (DOM order is the
  stack at one z-index), so an entry opened from a payee lands over it; opened from a picker it is `raised`
  (`components/coaches/overlayLayers.ts`, `RAISED_OVERLAY_Z = 401`, inline, on both frames) and its entries are not
  interactive (`payeeEntryRow(r, false)`). It closes when the tab hides (panel render-phase guard).
- **Shared frames:** `RoomShell` gained `back` (→ `CoachModalHeader backLabel` + `useDialogFloor onBack`), `subtitle`,
  `headerExtra`, `raised`; `QuestionShell` gained `raised`; `PayeeCombobox` gained `onManage` (a button; the club keeps
  `manageHref`). `CommitmentView` takes `onManagePayees` + `payeeChange` (a rename/merge made in the window while the
  bill is open repoints its draft without saving).
- **Money:** `lib/payee-money.ts` `payeeMoneyByPayee(book, payeeOf)` over the panel's whole-season `book.book`, a row
  naming its payee through the bill behind it (`expenseById.get(open.id).payeeId`). The panel's row is built from
  parts (`rowDoor`, `rowWhat`, `rowDateCell`, `rowCategoryCell`, `rowGo`) that both `registerRow` (unchanged output)
  and `payeeEntryRow` (no Item, no Balance, one Amount) compose; `renderPayeeRows` frames it without the sticky header.
- **Server:** `renameTeamPayee` → `updateTeamPayee(…, { name?, notes? })` (note ≤ 1000, empty clears; empty body 400);
  `listTeamPayees` returns `notes`. No migration (`org_payees.notes` exists).
- **D9b:** `REP_EXPENSE_WITH_PAYEE = '*, payee:org_payees(name)'`, asked for by the coach's expenses list only
  (`getRepTeamExpenses(…, { withPayeeName: true })` — the one read the screens print from; a single bill's read for
  the server's own checks stays on `*`); `RepTeamExpense.payeeName`; `lib/expense-payee.ts` `expensePayeeName` is the one display rule — the bill window's
  seed, the money form's seed AND its unchanged-check, and the bill export.
- **D10:** Tools → Payees (everyone) · Categories & items + Money tags (`canWriteMoney`), mounting the existing
  `BudgetItemManagerModal` and `TagManagerDrawer` from the panel.
- **Removed:** the `accounting/payees` route (never shipped); its page-actions guard entry; its two layout-baseline
  entries. The sweep keeps the id `coach-payees` (now the window, `interact: openPayeesWindow`, scoped to the room)
  and adds `coach-payee` (one payee).
- **Help:** `premium-money-payees` rewritten for the window and the record; the Ledger article's Tools line; the
  club's Payees article's pointer; search terms.
- **/simplify + /review (2026-10-02, high-risk tier), fixed before the commit:** a draft refused on save no longer
  comes back when the same payee is reopened (High); the record's "Received this season" tile is gone (no team row
  could fill it); the bill window applies a payee change as an updater, so a reseed for another bill in the same
  render is what it lands on; Tools opens one of the team's lists at a time; a refused save's REASON (an empty name;
  a name another payee has) shows under Name — the floating word says only "Couldn't save"; the dictionary's payee
  notes match the code.
- **Proof:** `verify:changed` green — unit 5546/5546; `tsc` clean after `next typegen`; focused lint 0 errors (no new
  warnings); CSS purity + selectors clean; spelling clean; layout sweep clean on `coach-payees`, `coach-payee`,
  `coach-transactions`. Browser probes (`.probe/lp3/verify*.mjs`, desk + 390) — see OQA §258.
- **Departure, said here:** in the list the name keeps the bold the page had (a list's name column, standard §3.6),
  and a read-only money assistant can now OPEN a payee and read it (the page let them open nothing).

## Session 1 — build record (2026-10-02, the server half: D5 data + routes, D7, D7a, D7b)

**What a person sees now:** a coach on a club team finds only the payees the club shares plus the team's own in the
payee picker (still under today's "Organization" / "This team" headings); nothing else is visible until session 2.
A standalone coach: no change. A club treasurer: no change on screen except that the Payees list's Entries and
Last used now count the club's own entries only.

**Three findings acted on (said to the owner before the work):**
1. **The picker narrowing alone was cosmetic** — the expense POST/PATCH accepted ANY `payeeId` (an unshared club
   payee, another team's, another org's). Both now refuse a payee the team cannot see (400 `payee_not_allowed`); an
   edit keeps the payee a record already names even after the club unshares it.
2. **The coach route with no team (`/api/coaches/[orgSlug]/payees`) is deleted** — nothing called it; in a club it
   listed every club payee to a coach and let a coach create a payee in the CLUB's list.
3. **The club's Payees counts were NOT the club's own** (the prompt said "stays") — `uses` / `lastUsed` and a merge's
   `moved` counted team expenses too, which shows the club team activity from before any sharing (against D7a). Now
   the club's `accounting_entries` only; a new `inUse` (any record names it) drives Delete vs Merge, so a payee only
   teams used still cannot be deleted.

**D7b counts (read-only, 2026-10-02):** dev — 6 club payees in 2 orgs (`dev-club-org`, `uat-rep-club`), **0 start
shared**, 6 stay the club's own, 0 standalone-org payees; prod — **no payees at all** (0 rows in `org_payees`), so the
launch step changes nothing there today. Neither database has a record naming another team's or another org's payee
(0 / 0 / 0). Re-count on prod at apply time (the verify block in MANUAL_PROD_STEPS) and record it here.

**Rollout (⚠ binding):** mig 316 to prod AFTER mig 315 and minutes BEFORE the ONE promote that carries sessions 1
and 2 together — `shared_at` is the D7a clock and must never start before a coach's picker shows "Your club sees
payments to these payees" (session 2). Those minutes are an accepted gap. Never promote session 1's code alone.
Recorded in `supabase/migrations/MANUAL_PROD_STEPS.json` beside the migration.

**/simplify + /review (high-risk, 2026-10-02):** cleanups applied (the rule's database filter lives beside the rule;
one counting fold, one name check, one money-access sentence; fewer round trips). /review — 4 lenses (security,
correctness, data/contract, concurrency + blast radius): no cross-team, coach→club or read-only-coach write found.
**Fixed:** (1) a club PATCH carrying both `name` and `sharedWithTeams` could save the share and then refuse the rename
— every check now runs first, then the rename, then the share; (2) mig 316 now refuses to run before mig 315;
(3) the delete refusal for a payee only a team's record names carried `uses: 0` — it carries no count now.
**Known, not fixed (recorded):** in a standalone org two simultaneous renames into the two index scopes could leave
two of the team's payees with one name (no index spans both; no such rows exist on either database); mig 313's team
move words only a unique-name clash, so a shared row in a standalone org would fail it raw (unreachable: nothing
shares there); the club's `inUse` stays true for a payee a team still names after the club unshares it — a yes/no,
needed because the delete is refused anyway (owner to confirm, see the hand-off).

**Proof:** `npm run check:club-money-atomicity -- --mutate` on dev — T12–T18 (sharing CHECK, own merge, every refusal,
named-elsewhere, merge into shared, standalone org, club merge keeps the LATER stamp), all 16 mutations killed;
`tests/unit/team-payees.test.ts` (the one rule, every read/write through it, the routes' gates, the expense check,
the club's own-lines-only counts, the migration's shape).

### The call list for session 2

Every response body below is JSON; a refusal is `{ error, code? }` — `error` is the sentence to show as written.

**Team picker — `GET /api/coaches/{org}/teams/{team}/payees?q=`** (money-read) → `{ payees: PickerPayee[] }`,
`PickerPayee = { id, teamId, name, scope: 'club' | 'team' }`, club rows first, 30 max, active only.
⚠ **Group by `scope`, never by `teamId`:** in a standalone org every row is `scope: 'team'` even with `teamId: null`
(today's `PayeeCombobox` groups by `teamId` and would file those under "Organization"). `'club'` → "Shared by your
club" + "Your club sees payments to these payees."; `'team'` → the team's own.
**New payee — `POST …/payees` `{ name, notes? }`** (money-write) → 201 `{ payee }`, always the team's own; 409 when the
team already has the name. Unchanged.

**Team Payees page — `GET …/payees?all=1`** (money-read) → `{ payees: TeamPayee[], shared: SharedPayee[] }`.
`TeamPayee = { id, name, isActive, uses, lastUsed }` — `uses` and `lastUsed` (a `YYYY-MM-DD` day) from THIS team's
records only. `SharedPayee = { id, name }` — the club's shared payees, read-only, the merge question's "listed first,
marked as the club's" targets; no counts by design. A standalone team's `shared` is always `[]`.

**Rename — `PATCH …/payees/{payee}` `{ name }`** (money-write) → `{ payee: { id, name } }`. Refusals:
400 `name_required` "Give the payee a name." · 400 `bad_name` "Keep the name to 200 characters." ·
403 `not_allowed` "This is the club’s payee: only the club can change it. To use one name, merge your own payee into
it." · 404 (another team's / unshared club / gone) · 409 `payee_exists` "Another of the team’s payees already has that
name. Merge them instead."

**Merge — `POST …/payees/{payee}/merge` `{ intoPayeeId }`** (money-write) → `{ moved, into }` — `moved` = this team's
records repointed. ⚠ The body key is the club's own (`intoPayeeId`, not the prompt's `{ into }`) so one screen can serve
both portals. Refusals: 400 `into_required` "Choose the payee to keep." · 400 `same_payee` "Choose a different payee
to keep." · 403 `not_allowed` (the payee being merged away is a shared club payee — the CLUBS sentence above) · 404
(anything the team cannot see — never confirms it exists) · 409 `named_elsewhere` "Another record outside this team
names this payee, so it can’t be merged here." ⚠ **When `into` is a club payee the merge question must carry the
notice** — the team's records join what the club sees (recorded on/after the share), and choosing it is the consent.

**Delete — `DELETE …/payees/{payee}`** (money-write) → `{ deleted: true }`. Refusals: 403 `not_allowed` · 404 ·
409 `payee_in_use` "This payee is named on N records. Merge it into another payee instead." (+ `uses`), or "A record
still names this payee. Merge it into another payee instead." (no `uses` — something outside the team names it).

**Expense saves** (`POST …/expenses`, `PATCH …/expenses/{id}`): 400 `payee_not_allowed` "Choose a payee from the list."
when `payeeId` is not the team's own or a shared club payee (PATCH: only when it CHANGES).

Every team route uses the live-season gate (`resolveLiveCoachTeamContext`): with no live season the answer is the
coded 409 season-closed refusal (the picker route returned a bare 404 before).

**Club Payees list — `GET /api/admin/accounting/payees?orgSlug=&all=1`** → `{ payees: ClubPayee[] }`,
`ClubPayee = { id, name, notes, isActive, uses, lastUsed, inUse, sharedWithTeams }` — `uses` / `lastUsed` the club's
own entries; `inUse` any record (a team's too) names it — **Delete shows only when `!inUse`** (built in this session:
the page's door and its merge hint read `inUse`); `sharedWithTeams` → the Teams column ("Shared with teams" / "The
club’s own").
**Club share switch — `PATCH /api/admin/accounting/payees/{payee}?orgSlug=` `{ sharedWithTeams: boolean }`** (and/or
`{ name }`; the club's Accounting holders) → `{ payee: { id, name?, sharedWithTeams? } }`. Asking for the state it
is already in changes nothing (never restarts the clock). Refusals: 400 `nothing_to_change` · 400 `bad_shared` ·
403 `not_allowed` "Only a club with teams can share its payees." (a standalone team's org, or no Rep Teams) · 404.
With both keys, every check runs before any write and a refused request changes nothing (the rename runs first —
its 409 `payee_exists` leaves the sharing untouched).
**Club merge** `moved` is now the club's own entries only (team records move too, uncounted). **Club delete** of a
payee only a team's record names: 409 `payee_in_use` "A team’s records name this payee. Merge it into another payee
instead." (no count).

## Session 2 — build record (2026-10-02, the screens: D1–D7 on both Ledgers)

**What a person sees now** (UX summary given to the owner before the code):
- **Coach (club or standalone), Money › Ledger:** a row prints the day ("Oct 1"); the balance lines name the
  window's full dates ("Starting balance · Sep 2, 2026", "Ending balance · Nov 1, 2026"); every row opens and ends in
  one arrow — Record beside it on an unpaid installment and nothing else; a row another tab wrote (Player Dues,
  Fundraising, Club) opens a READ window (its facts — amount, category, item, the family / who raised it / which
  installment, how it was paid, the day, its status — one sentence on where it is changed, one door there); a
  recorded row a read-only money assistant opens takes the same window with "Only someone who can enter the team's
  money can change it." (it did not open at all before). Phone: the club's card (K-25) from the shared kit, the
  balance lines plain between the cards. Toolbar: View · Export · ⋯ Tools ("The team's lists" → Payees) · Add a bill.
- **Coach, Money › Ledger › Payees** (new page, one level down, ← Ledger): the team's payees (Entries · Last used
  from this team's records), a window that renames as you type (the floating Saved), Merge (the club's shared payees
  first, "(the club's)", and the consent line when keeping one), Delete when no entry names it, New payee in the
  list's toolbar. In a club, "Shared by your club" read-only in the club's blue below it.
- **The payee picker (coach):** "Shared by your club" + "Your club sees payments to these payees." in the club's
  blue, "Your team's own", last row "Manage payees…". An unshared club payee is absent (session 1's rule).
- **Club treasurer:** the Ledger's toolbar Book · Export · ⋯ Tools ("This book" → Transfer; "The club's lists" →
  Payees) · Add entry; the balance lines carry the year; the note under the table is gone; the What at body weight
  (12px, 400 — it was 14px, 650: measured in the browser). The Payees page: a Teams column (Shared with teams chip /
  The club's own) and a Shared with teams switch in the payee window, both only for a club that runs teams.

**Departures from the drawings, said at build and recorded:**
1. **The coach's Opening balance line** carried a "Change →" button (to Team settings › Money) — a control in a
   ledger cell, which D3 rules out and no drawing covered. The whole line is now the door: its words a link, the
   row opens on a click, the cell holds the chevron every row ends in. Named in the register's "what stays
   different" list. Owner may prefer the button back.
2. **"How it was paid"** — the register's rows did not carry it, so `lib/coach-register-book.ts` now reads each
   derived row's method (dues payment / payout, a drive or sponsor hand-in, a club installment's sent-or-paid method
   and reference, a request's) into `paidHow`, with `origin` (which record it came from) and `installmentNumber`.
   No figure changes; `sourceLabel` (its only reader was the worded link) is removed.
3. **The window's frame differs by portal on purpose:** the admin's `KitDialog` is admin-only by rule, so the shared
   part is the BODY (`LedgerLineRead` — facts box + where-sentence) and each portal draws its own frame. The club's
   `Facts` IS the kit's `RecordFacts` now.
4. **The coach Tools drawing still printed years on the rows** — D1 and the coach desk-after frame were followed.
5. **New payee lives in the Payees list's toolbar**, not the page header (the page-actions ruling: a create sits with
   the list it adds to), white, as the club's.
6. **One window, three views (name · merge · delete)** on the coach's Payees page, never a question stacked on a
   question (`QuestionShell` stacks once over a list); the rename lands before Merge or Delete asks.
7. **"Manage payees…" on the club's picker too** (was "Manage payees", no ellipsis) — one spelling for one door.
8. **The club Ledger's phone toolbar:** Tools (⋯) made the three icons wrap under a long book name; the Book pill
   gained a `shrink` option (its name ellipsised) so the row stays one line.

**Where it lives:** the shared kit `components/coaches/kit/Ledger.{tsx,module.css}` (the What's name at body weight,
the phone card, the phone balance lines, the facts box, the read body; exported from the kit's index);
`lib/ledger-format.ts` (THE date rule: `ledgerRowDate`, `ledgerBalanceLabel`); `lib/money-fetch.ts` (`moneyFetch` /
`jsonInit` / `refusalText`, re-exported by MoneyKit); `lib/team-payee-scope.ts` `clubSharesPayees` (the one rule the
PATCH refuses on and both club screens ask); coach `accounting/LedgerLineWindow.tsx`, `accounting/payees/page.tsx`
(+ `Payees.module.css`); `PayeeCombobox` (`scope` grouping, `manageHref` replacing `foot`, the ruled words as
exported constants). Guard: `tests/unit/ledger-parity-screens-guard.test.ts` (D1/D2 one rule, D3 no control but
Record + every row opens + the read body shared, D3 ⚖ neither What bold + a card title bold, D4 one card, D6 Tools on
both, D7 scope grouping and the words); `club-stage3a-screens-guard` (Payees behind Tools), `team-payees.test.ts`
(the one share rule), `coach-page-actions-guard` (the new page header).

**Fixture (walks):** `seed-uat-coach-fixture.mjs` §13a (idempotent) — the club shares Town of Milton and keeps both
Mizuno spellings; the team's own "Milton, Town of", named on a bill (Diamond permit — fall block, one installment a
week overdue → Record); a Chocolate sale hand-in three days ago (a Fundraising row in the window).
`seed-club-fixture.mjs` shares Town of Milton at build. Applied to dev 2026-10-02 with a one-off of §13a alone
(`.probe/lp2/topup.mjs`), not a whole re-seed, so no walk in progress was rebuilt under its walker.

**/simplify (2026-10-02, four lenses):** one home for the money fetch helpers (`lib/money-fetch.ts`); the coach
Payees page wears the kit's name and chevron (no copies); one balance-line label for the desk row and the phone line;
the read window's sentence written once; the Book pill shrinks by its own `shrink` option (no reach into the pill's
markup by position); "may this club share?" answered by the one pure rule on both club screens (the list route's
`canShare` withdrawn); the installment number carried as a field, not parsed from text; `sourceLabel` removed.
Efficiency lens: clean.

**/review (2026-10-02, high-risk tier, five lenses — correctness, security & tenancy, data & contract,
concurrency, blast radius):** gate green (verify:changed, typecheck, focused lint; check:layout NOT run — the saved
UAT coach sign-in had expired and a sweep needs the owner's go-ahead). **Fixed, and guarded in
`ledger-parity-screens-guard.test.ts`:** (High) a read window left open when the coach switched to Bills or another
Money tab came back by itself, stale, on return — it now CLOSES when its view or tab goes away; (Medium) the club's
payee window could be closed while its share switch was still saving, leaving the Teams column stale — it holds
while the switch saves; (Low) after a refused rename, a corrected name closed inside the autosave's pause was never
sent — the refusal's one hold resets on typing (both Payees pages; the same latch in the club's line window
`EditLineWindow` is report-only); (Low) a legacy drive entry's read window dropped "dated the day it was recorded" —
the row now carries `datedWhenRecorded` and the window labels its date "Recorded on". **Confirmed safe:** server
gates behind every hidden button, no cross-team or unshared-club payee leak, `paidHow` shows a read-only assistant
nothing its home tab doesn't, the fixtures' sharing step satisfies mig 316's CHECK, no stale caller of any removed
class / prop / field. **By design, not changed:** the picker's and merge question's "your club sees payments"
describes Stage 3b's view before it is built — D7a needs the notice to exist before the count starts. ⚠ The
Ledger's new "how it was paid" read uses mig 315's columns, already required on production before this promote.

**/design (2026-10-02, warm + dark, desk + phone):** applied — the coach Payees page's New payee is the
portal's "+" on a phone (house rule 3); the Tools menus' items are worded only, as drawn (the icons were the
build's, not the drawing's); the "Shared by your club" list drops its one-column heading row (standard §3.10); the
merge question's sentence stands apart from its Keep field. **Report-only:** the kit's list toolbar puts any action
on its own line under a count on a phone (the count's reading measure is wider than a phone — every coach list with
a count and a button; a kit-wide call); the club Book pill's ellipsis on a phone can hide the part of a long book
name that tells books apart (owner call: hide the pill's "Book" word at ≤ 640, or accept); pre-existing, not this
project's: the coach windows' panel shows a blue focus outline on open in Dark, and the compact Record button's
outline is faint in Dark.

**Proof before the walks** (`.probe/lp2/verify.mjs`, dev, warm, 1440 + 390): coach rows day-only, balance lines dated,
no link and no button in a last cell but Record, a chevron on every row; the What 400 / 12px on both Ledgers, a phone
card's title 650 / 14px with upright labels; the read windows for a dues payment, a club installment and a drive
hand-in as drawn; the coach and club Tools menus' headings and items; the club's Teams column and switch; the merge
question's consent line. ⚠ The saved UAT coach sign-in expired mid-probe ("Unauthorized"), so the picker and the
Payees list were last captured before it — re-run after `auth-setup` (owner asked first).

## Revisions after ratification

- **2026-10-02 · D3, the What's weight (owner, with the two coach Ledger screenshots):** the coach's regular-weight
  What is the look both Ledgers take; the club's register drops its bold. Not a register exception — the standard
  asks the name to be a real button (§3.6), not to be bold — but K-01's row in TABLE_EXCEPTION_REGISTER.md should
  say "the What at body weight on both Ledgers" when session 2 builds it, so the club's other tables (Payees,
  Teams, Allocations), whose names ARE bold, are not "fixed" to match by a later pass. The hub's drawings show bold
  names; their captions now say so.

## Kept differences (to record in TABLE_EXCEPTION_REGISTER.md at build)

Cash on hand vs Balance (Ask 6) · Date default Around today vs This month (Ask 6) · Item column + Tags filter
coach-only (club entries carry neither; 3b, C09) · View pill vs Book pill (one book vs several) · Transfer club-only ·
page headers (each portal's header rule) · the coloured row edge coach-only (scheduled/overdue states; a club line is
posted/pending/void) · "No team cash" chip coach-only · page width.

## Build notes (once ruled)

- D1/D2: one date rule per portal for a ledger row and one for a balance row; the coach's Starting / Opening /
  Ending lines read the window the Date pill already holds.
- D3: the coach's `registerRow` — all rows tappable; action cell = chevron (+ Record when `settle`); derived rows open
  the shared read window (promote `LineWindow`'s read shape, or a shared `LedgerLineWindow`, with a `home` door). The
  coach's What keeps its regular weight; **the club's What goes to the same weight** (its `Money.module.css` `.what`
  carries 650 today) — the button stays, only the weight changes (revised 2026-10-02). ⚠ If the club's phone card
  takes its title from the same class, keep the card's title as drawn (a card's lead cell is its title, standard
  §3.7) unless the owner extends the ruling.
- D4: promote the club's K-25 card recipe (Money.module.css) to the shared kit; the coach register's phone stack
  uses it.
- D5: team-scope payee routes (list with counts, PATCH rename, POST merge) under `api/coaches/[orgSlug]/teams/[teamId]/payees`;
  merge = one DB step repointing `rep_team_expenses.payee_id` (and any other `payee_id`) — widen `club_payee_merge`
  to a team scope or add its twin (**migration** → DATA_DICTIONARY + snapshots, prod before the promote).
- Guards: no ledger cell on either portal holds a control other than Record; one date rule each; the shared phone
  card is the only one the two Ledgers render.
- Help (`/docs`): the coach's Ledger articles (opening a row, dates, Payees) and the club's Ledger article (the note).
  Demos: check tour stops anchored on a ledger row's pencil or worded button.
- QA: a walk on the hub once built.

## Out of scope

Everything in "Kept differences"; Stage 3b's club-side figures; the owed window-footer ruling; table sizes (already
equal).
