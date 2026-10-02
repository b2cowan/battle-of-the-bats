# Ledger Parity — plan

**Hub (mockup, decisions, brief, plan):** https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo — source
`docs/projects/active/LEDGER_PARITY_HUB.html`, frames in `docs/projects/active/ledger-parity/` (captured from the
live screens by `.probe/lp/shots.mjs`: BEFORE = the page as it renders; AFTER = the same page with the change applied
in the DOM). PM brief: `LEDGER_PARITY_PM_BRIEF.md`.

**Status:** RATIFIED 2026-10-02 — owner: "I agree with your recommendations on D1-D7" (D1–D7, D7a, D7b, every one as recommended). Build prompts: `LEDGER_PARITY_SERVER_PROMPT.md` (session 1) then `LEDGER_PARITY_SCREENS_PROMPT.md` (session 2); both reach production in ONE promote. **Session 1 (the server half) built on dev 2026-10-02; mig 316 applied to dev 2026-10-02** — record and the call list for session 2 in § "Session 1 — build record" below. Session 2 (the screens) next.

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
