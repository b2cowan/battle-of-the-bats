# Ledger Parity · session 1 — the server half: shared payees, a team's own payees, and what the screens read

> Paste into a fresh session on `dev`. Written 2026-10-02, the day the drawings were **ratified** (owner: *"I agree
> with your recommendations on D1-D7"* — every decision as recommended, D7a and D7b included). Session 2
> (`LEDGER_PARITY_SCREENS_PROMPT.md`) builds the screens on what this session ships.
>
> **The spec is the hub:** https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo — Mockup screens 6–8 and the Decisions
> tab (D5, D7, D7a, D7b). Plan: `docs/projects/active/LEDGER_PARITY_PLAN.md` (§ "Round 2"). Business rule:
> `docs/agents/strategy/BUSINESS_DECISIONS.md` → **2026-10-02 "A club can SHARE payees…"** — binding; read it whole.
>
> **Read first:** memory `project_ledger_parity`, `project_club_tier_readiness`, `reference_coach_money_check_then_act`,
> `reference_cascade_collisions_coach_budget`, `feedback_check_means_report_not_fix`; the in-repo
> `docs/agents/db/DATA_DICTIONARY.md` § `org_payees` (⚠ its gotcha 1 says team payees arise only inside team-workspace
> orgs — the coach TEAM route creates team-scoped payees in a club too; verify against the code and correct the
> dictionary in this change).

## What this session ships (no screens)

The data and routes for **D5** (a Payees page for every team), **D7** (the club chooses which of its payees teams
use) and its two transition rules. **The club's "what the teams recorded" report is NOT this project — it is Club
Tier Stage 3b** (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, the D1 note above "3b —"); this session stores what that
report will need (`shared_at`) and writes its definition into the plan.

## Preconditions (check before code)

1. **Branch `dev`; the earlier one-button-size work is committed** (`git log` shows the "one admin button size"
   commit; if `app/globals.css`, the club Ledger page or the schedule module still carry uncommitted hunks, stop and
   ask the owner).
2. **The UX summary for the owner comes first** (AGENCY_RULES) — short, the drawings are ratified: what changes for a
   coach in a club, a standalone coach and a club treasurer (in this half: nothing visible yet except what the
   picker lists — say so).
3. **Git:** private index, explicit pathspecs. **Ask before** a dev-server restart, a sweep, or `auth-setup` — the
   owner may be walking on the same server.
4. **Today's behaviour, measured 2026-10-02 (re-read it, don't trust this line):** `searchOrgPayees(org, q, teamId)`
   (`lib/db.ts`) returns `team_id IS NULL OR team_id = teamId`, so in a club **every coach's picker lists every club
   payee** (`components/accounting/PayeeCombobox.tsx`, section "Organization"). The coach TEAM route
   (`app/api/coaches/[orgSlug]/teams/[teamId]/payees`) creates team-scoped payees; the coach ORG route
   (`app/api/coaches/[orgSlug]/payees`) is team-scoped only in a team-workspace org (`isTeamWorkspaceOrg`). The club
   manages `team_id IS NULL` rows (`lib/club-payees.ts`, `app/api/admin/accounting/payees/**`,
   `club_payee_merge` in mig 315, which repoints `accounting_entries` and `rep_team_expenses`).

## What to build

### A · One migration (next free number)

- `org_payees.shared_with_teams boolean NOT NULL DEFAULT false` and `org_payees.shared_at timestamptz` (set when a
  club payee is shared; cleared when unshared; the 3b report counts only team payments recorded on or after it — D7a).
  A CHECK that only a club-scope row (`team_id IS NULL`) can be shared.
- **D7b data step:** in every **club** org (NOT a team-workspace org), every `team_id IS NULL` payee that any
  team-side record already names starts **shared**, `shared_at = now()`. Every other club payee starts unshared.
  **COUNT it on dev and read-only on prod first** (how many orgs, how many payees, how many stay unshared) and put the
  counts in the plan. ⚠ The stamp is the migration's time, and the migration goes on prod minutes before the promote
  that ships the picker's notice; those minutes are an accepted gap (record it).
- **Team-workspace (standalone) orgs are untouched:** their `team_id IS NULL` rows are the team's own (the team-move
  rule in the dictionary says so) and stay visible to the coach whatever the flag.
- `team_payee_merge(p_org, p_team, p_from, p_into)` — one database step, the shape and codes of
  `club_payee_merge` (lock both rows in id order, `same_payee` / `not_found` / `not_allowed`): `from` must be the
  team's own (in a workspace org, a `team_id IS NULL` row counts as the team's own); `into` is the team's own **or a
  shared club payee of the same org** (never an unshared club payee, never another team's); repoint **this team's**
  team-side records (grep every FK to `org_payees` — at least `rep_team_expenses.payee_id`; never `accounting_entries`
  of the club), then delete `from`. Server-only (revoke from anon/authenticated), like mig 315's functions.
- **Club merge keeps sharing honest:** when `club_payee_merge` folds a shared payee into another, the kept one is
  shared if either was, with the **later** of the two `shared_at` stamps (so no payment recorded before a notice is
  ever counted). Change it in this migration (a `CREATE OR REPLACE`).
- DATA_DICTIONARY (`org_payees` columns + the corrected gotcha + the two functions), `npm run refresh:snapshots`,
  `check:dictionary`, the schema-parity baseline (dev-only until the promote, house convention), MANUAL_PROD_STEPS
  (prod **before** the promote that carries session 2).

### B · What a team's picker lists (D7)

- `searchOrgPayees` for a **club** team returns **shared** club payees + the team's own, each marked by scope so the
  picker can group them ("Shared by your club" / "Your team's own" — session 2 draws it). A **team-workspace** org:
  unchanged (all its rows are the team's).
- **The club's own pickers keep every club payee** (the club Ledger's line window, the admin budget forms): grep every
  caller of `searchOrgPayees` / the payee routes (`CommitmentView`, the expenses panel, `LedgerWindows`, the coach ORG
  route) and keep each on the scope it means. A unit test pins: a club team sees shared + own, never unshared club
  payees, never another team's; the club sees all of its own; a workspace org sees all of its own.

### C · The club shares a payee (D7)

- The club's payee PATCH (`app/api/admin/accounting/payees/[payeeId]`) accepts `sharedWithTeams` — the same gate as
  rename (the club's accounting holders: owner, treasurer, an admin with Accounting). Share stamps `shared_at = now()`;
  unshare clears it (a later re-share starts a new clock). Unsharing never touches an entry that names the payee — it
  only leaves the pickers.
- The club's payee list read (`listClubPayees`) carries `sharedWithTeams` for the list's Teams column. **Its Entries
  count stays the club's own entries** — never a count of team records (that is 3b's report, and only for shared
  payees).

### D · A team's own payees (D5)

Under `app/api/coaches/[orgSlug]/teams/[teamId]/payees`:
- **GET (the Payees page):** the team's own payees with an entry count and last-used date read from **this team's
  records only**, plus (club teams) the shared club payees as read-only rows (name only — no club or other-team
  counts). Gate: the team's money-read permission.
- **PATCH `[payeeId]`** rename (team's own only; a club payee refuses `not_allowed`; a duplicate name in scope → 409).
- **POST `[payeeId]/merge`** `{ into }` → `team_payee_merge`; codes surface as words the screens can show.
- **DELETE `[payeeId]`** only when no record names it (the club's rule).
- Gate writes on the team's money-write permission (`canWriteMoney`), re-checked on the server. A test proves a coach
  can't rename, merge or delete a club payee, can't merge into an unshared club payee or another team's payee, and
  never sees another team's payees or counts.

### E · The 3b report's definition (write it, don't build it)

In the Club Tier plan's Stage 3b scope, under the D1 note: the report reads, for one shared club payee, each team's
**paid** team-side records naming it whose recorded time is on or after `shared_at` — team, amount, date — plus the
teams with none ("Nothing recorded"), labelled as what teams recorded, not proof of payment. Name the exact table/
column the "recorded" time comes from after reading the schema.

## Gates

- `verify:changed`, `typecheck`, the unit tests above, `check:dictionary`, snapshot freshness, schema parity, the
  club-money gates (`check:club-money-atomicity` gains `team_payee_merge` if it lists functions by name).
- `/simplify`, then `/review` at the **high-risk** tier (a migration, a money function, and a change to what one
  party can see of another's data — the security lens attacks cross-team and coach→club writes), then `/docs` only if
  a help line about pickers is now wrong (most help waits for session 2).

## Hand-off

- **The call list for session 2** in `LEDGER_PARITY_PLAN.md`: every route, request/response shape, refusal code and
  word, the picker's scope marker, and the counts from the D7b data step.
- An owner-voice summary: what a coach in a club now finds in the payee picker (only what the club shares, plus their
  own), and that nothing else is visible yet.
- Memory (`project_ledger_parity`), TODO, the plan. **Commit only when the owner says**, from a private index.
- ⚠ **Sessions 1 and 2 reach production in ONE promote.** D7a's clock (`shared_at`) must never start before a coach's
  picker shows "Your club sees payments to these payees" — session 2 draws that line. Write this into
  MANUAL_PROD_STEPS beside the migration and into the plan's rollout.
