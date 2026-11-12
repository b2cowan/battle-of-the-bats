# House-league friend requests (Board Ready Stage 1) — who sees the names, what the draft does with them, when they go
**Last verified:** 2026-11-12 (Part 3 read against the uncommitted diff; PIPEDA and CASL text not re-fetched — nothing new is emailed and no new kind of data is collected)
**Re-verify by:** the promote of Parts 1–3; a Québec club; any email or notice that names a friend; the form sentence is edited
**Depends on facts:** FieldLogicHQ is service provider to the club for sign-up data; the club decides to turn the feature on (a season setting); no Québec customer; nothing sold yet.

## Question(s) this answers
Does the form's sentence — "Only the club staff who work on sign-ups and teams see these names, and only to put friends on the same team. They are deleted after the season." (`lib/league-friends.ts:120`) — still hold once the board and the draft use the requests (Part 3)?

## Finding
- **Who sees names: holds.** Every friend surface (queue, record, board marks and popover, after-draft view, export) reads behind `houseLeagueRefusal(ctx, 'read')` — the same action as the registrations list, which also returns guardian email and phone. `read` is `canOpenModule(member, org, 'module_house_league')` (`lib/house-league-access.ts` `read: opens`): owner, admin, league admin and registrar by role default (`lib/roles.ts`), plus any member the club has granted House league. Treasurer, coach, staff and official do not have it by default; a house-league team coach (a `league_team_coaches` row) gets only the team page. So "staff who work on sign-ups and teams" is accurate; the club can widen it by granting the program, which is the club's own choice. `run` (the draft) is a subset of `read`, so there is no seat that runs the draft yet cannot read the names.
- **Board route returns ids, never a typed name** (`teams-board/route.ts`, `league-friend-draft.ts` `divisionLinks`); the child is named on screen from the board's own registration row. A unit test pins the gate, the single `readDivisionFriendLinks` caller set, and that the draft route returns no link.
- **"Only to put friends on the same team": one soft spot.** "Keep apart from a friend…" uses a confirmed request to put two children on DIFFERENT teams. Same data, same purpose (team placement), registrar-initiated, no new data, families are not told. Not a breach; the sentence is literally narrower than the feature.
- **Deletion holds.** `draft_outcome` (mig 473) and `kept_apart_by/at` (mig 461) are columns of `league_friend_requests`; mig 471 deletes every row of the season when it is marked finished, and the nightly backstop (mig 472) deletes after 60 days. Nothing else stores friend data: only `lib/league-friend-queue-server.ts` and `lib/league-friends-server.ts` touch the table; no club export, family file or people list reads it. What remains is the team a child was placed on (`draft_team_id`, `team_locked_at` on the registration), which is the purpose, not friend data. Residuals: files a registrar downloaded (the club's copy) and database backups, which roll off on the host's schedule.
- **Export.** Names only in the Friend requests view's own file (children's names, no parent names); "Excel with contact details" gains the two name-free columns only. The new reason text goes through `formulaSafe` for CSV; Excel writes strings as text.

## What the product does today
Checked against the code on 2026-11-12: `app/api/admin/house-league/seasons/[seasonId]/{teams-board,draft,friends}/route.ts`, `lib/league-friend-draft.ts`, `lib/league-friend-queue-server.ts`, migs 461/471/472/473, `components/admin/kit/club/league/registrations/{friendRequestsExport,RegistrationsScreen}.tsx`. No audit-log write, no email, no outreach to a "Not signed up" family.

## Recommendation
1. Owner call (low): keep the form sentence as is and note Keep apart in the policy as "team placement", or reword to "only to decide which team they play on" — still a restriction, not a widening.
2. Should-fix before the Parts 1–3 promote: the privacy policy draft has no friend-request text. Add to §5 (what we hold: a child's first and last name typed by a parent about another family's child, an optional parent's name, a friend code; the club decides, we process; used only for team placement) and §9 (kept until the season is marked finished, or 60 days after its last day; backups roll off; an erasure request goes through the club, which can use "Delete request…").
3. Minor: a registrar's "Can't honour" note is free text that reaches the view's export; consider a one-line field hint "Don't record anything about a family's circumstances".
4. The draft route's comment ("anyone who runs the draft gets groups kept, without names") describes a seat that does not exist; harmless, correct it when next touched.

## Sources
Code and migrations above (read 2026-11-12). PIPEDA Schedule 1 principles 4.4 (limiting collection), 4.5 (limiting use, retention) — from `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (2026-11-05); not re-fetched.

## Lawyer's eye needed?
Optional, owner's call: whether a parent typing another family's child's name is indirect collection needing notice to that family (the plan already lists it). Re-check at the first Québec club.
