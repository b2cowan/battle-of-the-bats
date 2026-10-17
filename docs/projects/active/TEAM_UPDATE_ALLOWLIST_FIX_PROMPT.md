# Security fix: the tournament team update writes only what the Teams screen edits

> Paste into a fresh session on `dev`. Written 2026-10-16 from the owner's task list (Wave 1, item 1; flagged there as
> the one urgent item). **One small session: verify, fix, prove, review, ship.** Precedents: the unused email route
> removed as its own change (`5941a292`, 2026-10-12, free tier F11) and the orphaned registration route removed
> (`43ce9cbb`, 2026-10-14). Same shape: its own commit, its own TODO line, a short record, no feature work riding along.

## The hole (found by the free tournament tier build, 2026-10-16; recorded, not fixed)

`FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` §12, "Pre-existing, found and reported, not fixed here": *"the team update route
writes any column it is sent (no allow-list), so an admin who knows another organization's tournament id could move a
team into it."*

What the code does today (read 2026-10-16; **re-read it before you trust this**):

- `app/api/admin/teams/route.ts`, the `POST` handler's bulk-update branch (after the `promote-from-waitlist`,
  `swap-slots` and `create-team` actions): `items` comes straight from `body.ids + body.updates` or
  `body.updates[]`, and each row is written as `const dbUpdates: any = { ...item.updates }`, with a few camelCase keys
  renamed (`poolId`, `paymentStatus`, `depositPaid`, `totalPaid`, `slotId`, `waitlistPosition`, `adminNotes`, `seed`)
  and **every other key passed through to `teams` as a column**.
- The org check (`requireTournamentInOrg`) and the scope check (`scopeGuard`) run against each team's **current**
  `tournament_id`. Nothing checks the **new** values. So, from inside your own organization:
  - `tournament_id` → another organization's tournament: your team appears in their event (their Teams list, their
    public site), and you lose access to it afterwards;
  - `division_id`, `pool_id`, `slot_id` → ids from another tournament or organization: the row points into someone
    else's event. **`poolId`'s rename is not checked against the team's tournament either**, so this is wider than
    `tournament_id`;
  - columns the screen never edits at all: `checked_in_by_user_id`, `checked_in_by_name`, `checked_in_at`,
    `registered_at`, `roster_submitted_at`, `roster_confirmed_at`, `payment_collected_at`, `coach_email`, `id`.
- The prod `teams` columns (snapshot 2026-10-16): id, tournament_id, division_id, name, coach, email, pool_id, status,
  payment_status, registered_at, admin_notes, deposit_paid, total_paid, waitlist_position, slot_id, check_in_status,
  checked_in_at, checked_in_by_user_id, checked_in_by_name, roster_submitted_at, roster_confirmed_at,
  payment_collected_at, check_in_notes, seed, coach_email. Decide from the snapshot or live `information_schema`,
  never from migration files.

**Who can do it:** any signed-in admin or staff member of any organization who can write teams in a tournament of
their own. That is every organizer on every plan, free included. The admin needs the other tournament's id, which
public pages and links can expose. This is a write across organizations on production.

## What the screens actually send (the allow-list is built from this, not from the table)

Read every caller of the bulk-update branch and list each key it sends. As read on 2026-10-16:

- `app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx`: `TeamRecordUpdates` =
  `name, coach, email, seed, depositPaid, totalPaid, adminNotes, poolId` (only the changed fields).
- `app/[orgSlug]/admin/tournaments/registrations/page.tsx`: `status` (`accepted` / `rejected` via `patch`),
  `paymentStatus` (`paid` / `pending`), and `poolId` alone (single and bulk pool moves, and the "distribute" pass).
- Possibly more: `slotId`, `waitlistPosition` and `divisionId`/`division_id` have handling in the route (the rename
  block, and the chat refresh that fires on `division_id` / `status`). Find out which screen sends them, if any. **A
  key no caller sends leaves the allow-list.** If something still needs it, it is a server-side action, not a
  pass-through.

Grep wider than the registrations folder: `grep -rn "admin/teams" app components lib`, plus anything that builds the
fetch through a helper. Read the GET handler too, so you know which ids the screen holds for each row.

## The fix

1. **An explicit allow-list of the keys a person may set**, mapped to columns. Unknown keys **refuse the whole
   request** with a 400 and a plain sentence. Do not drop them quietly: a caller sending a key it shouldn't is a bug to
   surface. Keep the existing `teamUpdateAllowed` (invite-only plan) check and the J5-026 paid-mark enrichment exactly
   as they are.
2. **Every id in an update is checked against the team's own tournament** before the write: a `pool_id` must be a pool
   of that tournament, a `slot_id` a slot of that tournament, and a `division_id` (if it stays) a division of it. A
   cross-tournament id refuses the request. `tournament_id` is never settable here. Moving a team between events is not
   a feature of this route.
3. **Validate the shapes the allow-list admits:** `status` and `payment_status` from their known sets; money as
   non-negative finite numbers; `email` / `coach_email` through the same normalizer the coach-side route uses
   (`app/api/coaches/tournaments/[teamId]/route.ts`); `seed` as today.
4. **Widen the question once, but keep the fix narrow.** Sweep for the same class: a route that writes a
   request-shaped object, or writes a foreign id it never checks against the caller's org or tournament. Start from
   `grep -rnE "\.update\((body|updates|patch|data|payload)\)" app/api` and read how each `updates` is built (on
   2026-10-16 the divisions, games, tournaments, communications and coaches/tournaments routes built theirs field by
   field). **Report every finding with its blast radius; fix only this route's hole in this commit.** Anything else
   found becomes its own TODO line and, if it is a cross-tenant write, its own small fix the same way.
5. **Production read (read-only):** look for evidence it was ever used. Find any team whose `division_id`, `pool_id`
   or `slot_id` belongs to a different tournament than its `tournament_id`, and any team whose tournament's org has
   no member who ever wrote it, if the audit trail allows. Auto mode has refused service-role reads against
   production before (2026-10-16). **Tell the owner what the read answers and let them approve or run it**; never
   route around the refusal. Report the counts; change no data.

## Proof

- A unit guard (`tests/unit/team-update-allowlist-guard.test.ts` or beside the route's existing tests):
  - every key a caller sends is admitted;
  - an unknown key (`tournament_id`, `checked_in_by_user_id`, `id`) refuses;
  - a `pool_id` / `slot_id` from another tournament refuses;
  - the invite-only refusals still fire.

  Also a source scan that fails if the branch goes back to spreading the request object.
- On dev, a read-only probe in `.probe/`: post the Teams screen's real payloads (rename, seed, pool move, accept,
  reject, mark paid, deposit), each is admitted and behaves as before, then the hostile payloads, each refused. Ask the
  owner before driving the browser; one browser tester at a time.
- `npm run typecheck`, `npm run verify:changed`, the existing guards that read this route (grep `tests/unit` for
  `admin/teams`), `check:spelling` on the new refusal sentence.
- **`/review` at the high-risk tier** (auth, a shared route, money fields). Fix what it confirms.

## Ship

- **Its own commit**, nothing else in it. Stage explicit paths only (the working copy holds other sessions' changes:
  Needs attention clears itself is mid-build in the notifications, Check-in and Payment requests files), and run
  `git show --stat HEAD` after. **Commit only on the owner's word.**
- **Then put the decision to the owner, in one line each:**
  - (a) ride the next release, if it is within a day or two (it waits on Needs attention and the free plan's marketing
    words);
  - (b) a one-change hotfix to production now.

  ⚠ `.claude/commands/release.md` has **no written hotfix path**: production moves by promoting `dev`, which is 21+
  commits ahead. A hotfix means a pinned cherry-pick onto `master` through `/release`. Say that plainly and let the
  owner choose. Don't improvise a promote.
- Records: the 🔒 TODO line already under Active Tasks (written with this prompt; add the commit, and "on prod" only once
  it is), the free tier plan §12's
  "Pre-existing" sentence pointed at the fix, and the TODO free-tier line's "NEXT: … the team-update column allow-list"
  marked done. No customer copy changes; no help change (nothing a customer sees changes, unless the sweep finds a screen
  that relied on a dropped key; then it's a bug fix, reported).

## Hand-off

Write it for a product owner: what could happen before, what happens now, what the production read found, what else
the sweep found, and the release-or-hotfix question.

## Outcome (executed 2026-10-16)

**Committed `f44c2857` 2026-10-16** (the route, the list, the guard — nothing else in it). Release: see the TODO line.

**Built.** `lib/team-update-allowlist.ts` is the list: the ten keys the screens send (`name, coach, email, seed,
depositPaid, totalPaid, adminNotes, poolId, status, paymentStatus`) mapped to columns, value checks, the refusal
sentences, and the pool decision. The route's update branch reads the request only through it; an unknown key, a bad
value or a malformed id refuses the whole request (400). A pool must be the team's **own division's** in its own
tournament — stricter than "same tournament", and every pool control on the Teams screen already offers only the
division's pools. One tournament per request (the lock, fees and email names were read from the first team's).
A FieldLogicHQ staff address is refused as Add team refuses it. `teamUpdateAllowed` and the J5-026 paid-in-full
enrichment are unchanged and reach the same verdicts (they read both spellings).

**Widened, out loud, in the same commit:** the same route had the same hole twice more. `promote-from-waitlist`
took a `slotId` no screen sent and nothing checked (any organization's slot could be written); it now always takes the
team's own division's lowest open spot. `swap-slots` checked slot A's tournament but not slot B's (a swap wrote
another organization's slot and team); slot B must now be in slot A's tournament and division, refused after the
organization check.

**Two visible side effects, both toward the documented encodings:** clearing a coach's name stores NULL (was `''`,
the two-encodings split migrations 202 + 204 removed), and the team email is stored lowercase (as registration and the
coach's own contact route store it; the claim matches case-insensitively).

**Proof.** `tests/unit/team-update-allowlist-guard.test.ts`, 22 cases: the keys each screen sends read from their
source (a new Team-record field fails the build, not every save), hostile keys, pools, the invite-only refusals on the
checked columns, and a source scan — `body` read once in the update branch, one typed copy of the update, the one
merge is J5-026's, each refusal returns, ordering checks fail on a missing line. Mutation-checked: 13 mutants, all
killed (`.probe/tual-mutants.cjs`). Dev probe `.probe/tual-probe.mjs`, 34/34 (signs in without a browser). Full
typecheck clean; `/review` at the high tier — five lenses, no defect in the change; the guard was tightened on its
finding.

**Production read** — `.probe/tual-prod-read.mjs`, read-only, waits for the owner's approval (auto mode refuses a
service-role read of production). It counts teams and spots pointing across events; there is no audit trail of team
edits, so it cannot say who wrote a row. **Run 2026-10-16 on the owner's word: clean.** Production holds 62 teams,
6 tournaments, 9 divisions and **no pools or spots at all** — so the pool and spot doors were never usable there. No team
sits in another tournament's division, and no team points at a tournament that no longer exists. Its limit: a team
moved whole (tournament AND division both set to the other event's) leaves no structural footprint, and nothing
records who edited a team.

**The sweep (report-only; each its own TODO line).** Most serious first:
1. **Pool-slots route, cross-organization and destructive.** Sync capacity and ensure act on any pool id sent — an
   organizer can delete another organization's empty spots and add spots to its pools, and the reply lists that
   organization's spots and team names. Swap checks slot A only; assign writes any team id. Any member with
   schedule-structure rights on any plan.
   → **Fixed `73c903db` 2026-10-16.** Ensure, the schedule generator's one call, checks the division against the
   tournament and every pool against the division (`lib/pool-slots-ensure.ts`); sync-capacity, assign, unassign, swap
   and rename had no caller and were removed (rename, left at first, rewrote game labels by spot id past the lock —
   the review's one finding). Dev probe `.probe/psl-probe.mjs` 17/17; guard 8/8, 6 mutants killed.
2. **Games route, cross-organization pointers.** Bulk save, create, save-bracket, replace-division and update write
   division, team, spot, bracket and lane ids unchecked against the game's tournament. A game can sit in another
   organization's division and schedule reads; a foreign lane lets that organization's lane move re-place it.
   → **Fixed `d81869ee` 2026-10-16** (`lib/game-references.ts`): bulk save, create, the bracket editor's new games and the one-game
   update refuse a division, team, spot or lane that isn't the game's tournament's (a team of another event in the same
   organization too); the generator saves were already safe in their database functions (migrations 320, 327).
   `bracket_id` is left alone — a grouping key, not a reference. The review added: the id deletes treat a game with no
   tournament as not found. Bulk save has no screen caller today; it is checked, not removed (it is the generators'
   documented door). Dev probe `.probe/grf-probe.mjs` 25/25; guards 18/18, 11 mutants killed.
3. Smaller, same organization or pointers only: DELETE ignores the completed-event lock; Add team writes its status
   unchecked; a division's contact member, an accounting ledger's tournament and an entry's payee are not checked
   against the organization.
   → **Fixed `09df6e8e` 2026-10-16:** the delete lock, Add team's status, and one shared check (`lib/org-references.ts`) that the
   division contact, the club book's tournament and the line's payee are the organization's.
Not swept: `app/api/league`, `family`, `consumer`, `billing`, `dev`, `platform-admin`, and most of the ~100 coach
routes (only those reading ids from the body).

## Second sweep (2026-10-16, report-only)

The areas the first sweep skipped, read whole by six reviewers in parallel: all 206 coach-portal routes (roster and
development, schedule, money, tryouts and the rest), platform admin + dev tools + billing + sign-in, and the public,
family, consumer, chat and notification routes. Reads as well as writes this time. The five serious findings were
re-read in the code before being recorded. Each is its own TODO line.

**Serious, most first:**
1. **Public game stats** (`app/api/public/stats`, GET, anonymous): the team branch interpolates `teamId` into a
   PostgREST `.or()` string on a service-role client — `?teamId=x,id.not.is.null` returns every game in every
   organization (teams, scores, dates, locations), unpublished included; no tournament, status or visibility scope at
   all. The only caller (`RegisterContent.tsx`) uses the `tournament_id` branch (registration counts), whose
   no-parameter form also counts every tournament's teams. Fix: remove the team branch; scope the counts to a public
   tournament.
   → **Fixed `4d0cb0fe` 2026-10-16:** the team branch removed; counts for one active or completed tournament only (a malformed
   id, a draft or no id answers `{}`); `tests/unit/public-stats-guard.test.ts` also refuses any template-built filter
   string in `app/api/public`. Anonymous dev probe 6/6.
2. **Platform support/billing → super admin** (`platform-admin/users/[id]/update`, `manage_support`): changes any
   auth user's email with `email_confirm: true`; platform roles resolve from the session email (bootstrap list or
   `platform_users`), so freeing the super admin's email and taking it escalates. Same root: `ban`,
   `revoke-sessions`, `reset` on staff accounts; `orgs/[id]/transfer-ownership` on any club. Fix: email change
   super-admin only; refuse support actions on platform-staff targets.
   → **Fixed `7dd43ebe` 2026-10-16** (`lib/platform-staff-guard.ts`): update, ban, revoke-sessions, confirm-email and reset refuse
   (403) for any role but super_admin when the target account's email, or an email the action names, is staff; support
   and billing keep every action on customers. `transfer-ownership` is left as it is — moving a customer club's
   ownership is support's job and grants no platform role. Dev probe 12/12; `tests/unit/platform-staff-guard.test.ts`.
3. **Invitation pre-claim** (`auth/coach-signup`, anonymous): `createUser({ email_confirm: true })` for any unused
   email, no verification, no throttle; `reconcilePendingInvitesForUser` re-points pending invites by confirmed
   email. Fix: verify by link as `auth/signup` and `team-signup` do (its three callers: accept-assistant-invite,
   start/league, start/team). The 409 is also an account-existence oracle.
   → **Owner ruled 2026-10-16: verify every sign-up.** Five screens gain a check-your-email state, so it is drawn first:
   `SIGNUP_EMAIL_VERIFICATION_HUB.html` (https://claude.ai/artifact/C1Y8LPfo1q6dWDnQHzHh4d), design-reviewed, V1–V3
   ruled as recommended (building). **Interim committed `7bbfbebb`:** the route is rate-limited (15 per 15 minutes per source, 5 an hour per
   address, 60 per 5 minutes overall), `tests/unit/coach-signup-throttle-guard.test.ts`.
4. **Registrations list inside a club** (`app/api/registrations`, GET): `getAuthContext` with no role, capability
   or tournament scope; `select('*')` on teams → `coach_email`, `email`, `payment_status`, `admin_notes` for
   every tournament of the org, to any non-suspended member including `invited`. Fix: the Teams screen's capability +
   `scopeGuard`.
   → **Fixed `b15b01fe` 2026-10-16:** `getAuthContextWithScope` (accepted members only) + `canOpenModule(…, 'module_tournaments')`
   + `scopeGuard` / the assigned list, name lookups scoped to the org. The same gap was on `/api/admin/teams` GET (any
   accepted member with no assignment, a scorekeeper included) — closed with the same check.
   `tests/unit/team-reads-guard.test.ts`.
5. **Public team profile** (`app/api/public/team-profile`): resolves the tournament with `{ admin: true }` by slug —
   no status (draft/archived served), no `isPublicPageEnabled`, no unpublished-division check, no canceled-org check;
   returns the team's games spread whole (notes included), standings and every team name. Fix: the public pages'
   resolver (`getPublicContext` / `getPublicTournamentBySlug`).
   → **Fixed `b15b01fe` 2026-10-16:** canceled-org check, `getPublicTournamentBySlug` (a draft answers 404); games only with the
   Schedule page on and the division published; standings only with Standings on as well; notes stripped; names limited
   to accepted teams in the shown games; the share card follows the same record rule. The Teams switch is not applied:
   it hides the team LIST, and the schedule and a followed team link to team pages (review finding). Noted, not
   changed: the public SCHEDULE's own payload still carries an unpublished division's games and their notes (the screen
   hides them) — a follow-up.

**Owner call:** the returning-player scan (`development/continuity` GET) returns prior-season guardian names, emails
and birth dates behind `canWriteDevelopment` only — ruling 9 (2026-09-11) moved it onto the delegable grant; the
`rosterPii` permission that redacts the same fields on the roster is not consulted. Recommended: redact unless
`rosterPii`.

**Small** (one TODO line): `register` POST no throttle; `expenses` POST `eventId` and `events` POST
`parentEventId` unchecked (integrity; the expense one may block the other team's event delete); `syncDrillTags`
filters org only; tag item/merge doors filter team but not kind; `tournament-games` has no schedule/tournament grant
check; `tryout-candidates/[id]` and `tryout-sessions/[id]` don't pin the active year, and `tryout-score/[token]`
scores a closed season; `orgs/[id]/identity` skips reserved/demo slugs; `early-access` upserts by email;
`forgot-password` no throttle. Very low: push-subscription takeover needs the endpoint secret; `org-context`
returns Stripe ids to any member of that org.

**Clean** (read whole): the coach portal has no cross-organization or cross-team hole — team, membership and child ids
are proved on every handler, a removed coach loses writes at once, staff delegation can't escalate; the family portal,
calendar feeds, chat, notifications and the consumer follows scope to the user; billing's webhook verifies Stripe's
signature and every billing route takes the org from the caller's own membership; dev tools are off on production;
every platform-admin route has a guard (the finding is a role being too wide, not a missing guard).
