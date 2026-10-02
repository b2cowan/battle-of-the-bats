# Ledger Parity — plan

**Hub (mockup, decisions, brief, plan):** https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo — source
`docs/projects/active/LEDGER_PARITY_HUB.html`, frames in `docs/projects/active/ledger-parity/` (captured from the
live screens by `.probe/lp/shots.mjs`: BEFORE = the page as it renders; AFTER = the same page with the change applied
in the DOM). PM brief: `LEDGER_PARITY_PM_BRIEF.md`.

**Status:** RATIFIED 2026-10-02 — owner: "I agree with your recommendations on D1-D7" (D1–D7, D7a, D7b, every one as recommended). Build prompts: `LEDGER_PARITY_SERVER_PROMPT.md` (session 1) then `LEDGER_PARITY_SCREENS_PROMPT.md` (session 2); both reach production in ONE promote. Nothing built.

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
  Proposed: every row tappable; one chevron column; the name bold (the club's `nameButton` pattern, the keyboard door);
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

## Kept differences (to record in TABLE_EXCEPTION_REGISTER.md at build)

Cash on hand vs Balance (Ask 6) · Date default Around today vs This month (Ask 6) · Item column + Tags filter
coach-only (club entries carry neither; 3b, C09) · View pill vs Book pill (one book vs several) · Transfer club-only ·
page headers (each portal's header rule) · the coloured row edge coach-only (scheduled/overdue states; a club line is
posted/pending/void) · "No team cash" chip coach-only · page width.

## Build notes (once ruled)

- D1/D2: one date rule per portal for a ledger row and one for a balance row; the coach's Starting / Opening /
  Ending lines read the window the Date pill already holds.
- D3: the coach's `registerRow` — all rows tappable; action cell = chevron (+ Record when `settle`); derived rows open
  the shared read window (promote `LineWindow`'s read shape, or a shared `LedgerLineWindow`, with a `home` door).
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
