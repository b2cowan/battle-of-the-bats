# Board Ready · Stage 0a — the third access sweep (report-only, 2026-11-10)

> Plan of record: `BOARD_READY_PLAN.md` §5 Stage 0a. Prompt: `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md`. Earlier sweeps:
> `TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md` § Second sweep (2026-10-16) and the Club Tier Stage 0 sweep.
> **This session found and reported. Nothing was fixed.** Each fix waits for the owner's go and lands as its own commit.

## Scope and method

- **What was read:** every file added or changed since 2026-10-16 (`git log --since=2026-10-16`; 1,776 files still present, 373
  API routes) under `app/api/`, `app/[orgSlug]/`, the public and consumer trees, server `lib/` and `proxy.ts`, plus the
  **whole** of file storage (every bucket and every route that uploads or signs a link), whatever its date.
- **How:** nine reviewers in parallel, one area each: house league · families and the family app · club money · scheduler,
  permits and venues · everything anonymous · the Coaches Portal · platform admin, cron and demos · file storage · club
  admin core, members and sign-in. Each route was asked one question: who can reach it, and does the server check the
  organization, the seat and the object's owner? Then status and visibility for public reads.
- **Re-read:** every finding ranked Serious or Medium was re-opened in the code by the main session before it was recorded
  (lines cited below). Smaller items are the reviewers' traces, marked as such.
- **Proved on dev only** (`.probe/sweep3-prove.mjs`, sessions minted by a one-off sign-in link, no password changed, no seed
  run; production never touched). Only one write was sent: the score-review switch PATCHed back to its own value
  (it was confirmed unchanged). The other storage step was a probe file that was uploaded and then deleted.

## Verdict in one paragraph

**No route lets one club read another club's people.** The tenant wall held everywhere it was tested: every house-league,
family, money, scheduling, coach and platform route ties the ids it is sent back to the caller's own organization, team or
family. The worst findings are **inside a club**: the tournament admin's reads let a club's own assistant coaches and
volunteer scorekeepers into screens meant for the people who run the club. One finding crosses clubs, and it is about
files, not personal information: the public rules-and-resources file store lets any signed-in account delete or replace
any club's files.

## Findings, most serious first

### 1 · SERIOUS — a club's assistant coaches and scorekeepers read every tournament's sent emails and who they went to — **PROVEN**
- **Route:** `GET /api/admin/communications?orgSlug=&tournamentId=` — `app/api/admin/communications/route.ts:105-127`.
  The only checks are an active membership (`getAuthContextWithScope`), the tournament scope and tournament-in-org. There
  is no capability check (the POST beside it needs `create_tournaments`, :136). It returns `select('*')`, mapped at :55-73,
  including `emailRecipients` (every address the email went to, with the team names), `emailFailedAddresses` and the
  sender's email.
- **Why a coach passes:** every accepted assistant-coach invite writes an **active** `role='coach'` club membership
  (`lib/assistant-invites.ts:592-600`). It is capability-less, but `getAuthContextWithScope` (`lib/api-auth.ts:337-362`)
  admits any active member. With no tournament-assignment rows, `assignedTournamentIds` is null, which means
  "unrestricted". A removed coach's row is deleted once they hold no team (`lib/coach-membership.ts:971-988`), so
  removal works. The problem is what a current one reaches.
- **Who:** any current coach or assistant coach on any of the club's teams; any scorekeeper/official; any staff member.
  The scope is every tournament the club runs, past and present.
- **What they get:** every announcement and email-only message the club ever posted for that tournament, including deleted
  ones, and the **email addresses of every registered team's contacts**, most of them visiting teams from other clubs.
- **Exploit:** a signed-in assistant coach opens `/api/admin/communications?orgSlug=<club>&tournamentId=<id>`. A tournament
  id is on every public tournament page.
- **Proof (dev):** `coach@dev.local` (a `coach` row, no assignments) and `j8-scorekeeper@dev.local` (an `official`) each got
  **200 with all 3 posts** and the recipient and failed-address fields. The same code is on production (`origin/master`
  :108/:122). The recipient list has been stored since mig 314 (2026-09-30).
- **Fix:** require `module_communications` or `send_communications` on the GET, as the POST requires `create_tournaments`.
  Then check whether a capability-less `coach` row should pass `getAuthContextWithScope` at all (see finding 3; one fix
  could close the class).
- **→ Fixed together with finding 3, W2 fix A, 2026-11-11** (committed `3d9b1ec13` 2026-11-11). The GET asks the tournaments
  area **and** `post_announcements` or `send_communications`: the Communication screen's own rule (`lib/flip-twins.ts`
  `ADMIN_SCREEN_CAPABILITIES`), not the `module_communications` this line proposed. Staff hold `post_announcements` by
  default, and that proposal would have locked them out of a screen the product says they open. Details and the outcome
  under finding 3.

### 2 · SERIOUS (crosses clubs; files, not people) — any signed-in account can delete or replace any club's rules and resource files — **PROVEN**
- **Where:** the public `resources` storage bucket. Mig 087 L20-28 grants INSERT and DELETE to **any `authenticated`
  user** with only `bucket_id = 'resources'`. Mig 311 removed the prod-only "anyone" policies and kept these on purpose,
  because the Rules screen uploads and deletes straight from the browser (`lib/db.ts:1576` remove, `:1590-1592` upload).
  Keys are flat (`Date.now()-name`, no club prefix) and the public read policy lists them. Already noted as a follow-up in
  `DB_ARCHITECTURE_REVIEW.md:122`; never fixed.
- **Who:** anyone with any account on the platform: a parent, another club's coach, someone who just signed up. They need
  only the public browser key.
- **What they do:** delete every club's tournament rules and resource files. Or delete one and upload a different file
  under the same name, so the club's own published link serves the stranger's PDF or Office file (up to 50 MB). No
  personal information is read. This is defacement and an integrity failure across clubs.
- **Exploit:** `supabase.storage.from('resources').remove(['<name from the public link>'])` with any session.
- **Proof (dev):** `coach@dev.local` uploaded a probe file; `j8-scorekeeper@dev.local`, a different account, deleted it
  (`removed=1`, gone). The policy carries no club condition at all, so the second account could have been anyone's.
  Production has the same two policies per mig 311's own notes; the live policy list was not read (prod is never read here).
- **Fix:** drop the two `authenticated` policies, move upload and delete to a server route that checks the club, the
  tournament and `post_rules`, and key new files under `{orgId}/{tournamentId}/…`.
- **→ Fixed, W2 fix B, 2026-11-11** (committed `b164c707e` 2026-11-11; migration 462 applied to dev; production: code first, then
  462 — registered in `MANUAL_PROD_STEPS.json`, and production state lives in the release-history record). The row writes below
  and the upload-limit owner call are the two open items it leaves.
- **→ The link rows, fixed too (W2 fix B follow-up, owner yes 2026-11-11; committed `ad978ce6b` 2026-11-11; migration 465 applied to dev; production: code first,
  then 465; production state lives in the release-history record).** Create, rename/repoint and reorder now go through `POST`/`PATCH /api/admin/resources` (club + `post_rules` + event checked), and
  465 takes INSERT/UPDATE/DELETE on the table from signed-in accounts. A new address must be http(s), an email link or `#` (a
  `javascript:` link would run for every visitor), and a file address must be in the caller's own club folder. Proof:
  `.probe/sweep3-fixB2-prove.mjs` (25 checks: owner/admin work; another club, a coach row, a scorekeeper and a parent are refused;
  a direct browser write is refused). **Same shape, fixed in the third step (owner yes 2026-11-11; committed `551bd4f82`; migration 466 applied to
  dev; production: code first, then 466):** the Rules SECTIONS (`rules`, `rule_items`) were written from the browser under the
  same "member of the club" policy. They now go through `POST`/`PUT`/`PATCH`/`DELETE /api/admin/rules` (club + `post_rules` +
  the event of every row; a section's divisions must be the same event's, which the browser path never asked; the icon must be
  one the screen offers). Proof: `.probe/sweep3-fixB3-prove.mjs` (34 checks, incl. a direct browser write refused on both
  tables). **Review fixes (same day):** a saved section that still names a since-deleted division is saved with the dead id dropped (it would otherwise have been refused for ever; a list with nothing live left is refused, never widened to every division); two points sharing one id are refused; the save stops between steps when the browser has given up on it. **Known, narrowed:** a save that times out and is retried can still add a point twice when the first request had already finished its inserts (the old browser path had a wider window); the real fix is one database transaction. **Also open (owner call, not a regression):** neither the row route nor the file route refuses writes on a completed (sealed) event, as the old browser path did not; the pool and schedule routes do. **Follow-up audit after migration 465 reaches production:** the query in its prod-steps note lists any old link row with a non-web address.
- **Found while building the fix (W2 fix B, 2026-11-11) — the link ROWS are not capability-checked.** The `resources`
  TABLE's insert/update/delete policies (`resources_member_*`, mig 009) ask `can_access_tournament(tournament_id)`: the
  caller is a member of the event's club and in scope for it. They do not ask `post_rules`. The Rules screen writes those
  rows straight from the browser (`saveResource`, `updateResource`, `saveResourceOrder` in `lib/db.ts`), so a capability-less
  `coach` row of the club can still add, rename, repoint or reorder the public Rules page's links with the public key and its
  session. It is inside one club (not across clubs) and changes no file; the stored files are now closed. **Not fixed
  here:** closing it moves those three writes behind a route too. **Owner call:** do it as its own small fix (recommended —
  the same shape as this one) or leave it. The delete of a row now goes through the file route, which asks `post_rules`.
- **Design notes of the fix (dev, 2026-11-11):** the delete takes the ROW id; it removes the row, then the stored file only
  when (a) the address is this project's own public address in the bucket, (b) the key is under the caller's club folder or
  is an old flat key, and (c) **no other row in any event still names the key**. (c) is what stops a typed link that imitates
  another club's flat-key address from getting that club's file deleted, and it keeps a copied event's shared file alive.
  Old flat files can be removed only by the club whose row is the last to name them.
- **→ Decided, owner 2026-11-11: keep 9 MB; the Add file form says so** ("A PDF, image, Word or Excel file, up to 9 MB.", and the picker filters to those types). **The upload limit drops from 50 MB to 9 MB (found by /review, 2026-11-11).** Uploads now pass through the server,
  and every `/api/*` request goes through the proxy, which buffers a body only up to 10 MB (Next's `proxyClientMaxBodySize`
  default) and cuts the rest. A 20 MB rulebook would arrive as a broken form. So the route and the screen stop a file over
  9 MB with a plain message ("That file is over 9 MB. Choose a smaller one."). Other document routes cap at 10 MB for the same
  reason. **Options:** keep 9 MB (recommended; a rules PDF is rarely larger) · raise `proxyClientMaxBodySize` in the shared
  Next config (every route then buffers that much) · a signed-upload flow where the browser sends the file straight to storage
  under a one-time address from the server (keeps 50 MB; more to build). The 9 MB is `RESOURCE_MAX_BYTES` in one place.

### 3 · MEDIUM — the same "any member" door on three more tournament-admin routes — **PROVEN (two of three)**
- `GET /api/admin/tournaments` (`lib/admin-tournament-list.ts:31` on dev; `app/api/admin/tournaments/route.ts:274-279` on
  production): `select('*')` of every tournament in scope. That includes the tournament's contact email and the settings
  JSON, which carries the payment instructions. **Proof:** both probe accounts got 200 with 9 tournaments and those fields.
- `PATCH /api/admin/tournament-branding` (`route.ts:113` gate list, `:189` write): `requireScoreFinalization` sits
  **outside** the `manage_branding` gate, so any member in scope can switch a tournament's score review on or off. That
  switch decides whether a scorekeeper's own scores are held for review (`get-score.ts:269`). **Proof:** both accounts got
  200 sending the current value back (value confirmed unchanged).
- Reviewer trace, not probed: `GET /api/admin/divisions` (fees, contact member ids); `GET`/`POST
  /api/admin/org/startup-tasks` (contact email; any member writes the setup flag that locks the owner's onboarding choice);
  `GET /api/admin/members/[memberId]/assignments` (plain `getAuthContext`, so an invited member reads anyone's assignments).
- **Fix:** one rule. The tournament-admin reads require `module_tournaments` (or a narrower capability per route), and
  `requireScoreFinalization` needs `create_tournaments`. Consider making a capability-less `coach` row fail
  `getAuthContextWithScope` outright. The Coaches Portal uses its own resolvers, so it doesn't depend on that row passing.
  That would close findings 1 and 3 together. A census of `getAuthContextWithScope` callers with no capability check is
  the first step of the fix.
- **→ Fixed together with finding 1, W2 fix A, 2026-11-11** (committed `3d9b1ec13` 2026-11-11).
  - **Shape: per route, NOT the shared check.** The census (239 route files) shows coach rows legitimately call two
    admin routes: their own notification preferences on the account page, and the free-time band in the portal. A
    coach given "Run tournaments" holds the tournament bundle as overrides. So the question is the capability, never
    the role, and `getAuthContextWithScope` is unchanged.
  - **Wider than this finding.** The same hole was on `games`, `pool-slots`, `schedule-facility-lanes`, `venues`,
    `tournament-activity` and `tournament-branding` GET. On `tournament-archives` and `org-settings`, plain
    `getAuthContext` admitted an invitee. All of them now need the tournaments area; `org-settings` an accepted member.
  - **Per-route gates:**
    - `divisions`: the tournaments area or `canGate`, because the gate's check-in board reads it.
    - `tournaments` list: one rule (`adminTournamentListView`), asked by the route and the layout's first paint. Full rows
      go to holders of the tournaments area. Id, name, year and status go to a member manager (the Manage window) or
      the club's Accounting holder (the treasurer's "Add a ledger"). Everyone else is refused.
    - `check-slug`: the tournaments area.
    - Score review: `create_tournaments`. The branding PATCH also starts at the tournaments area.
    - `startup-tasks`: GET needs the tournaments area; POST is owner or admin only.
    - `assignments`: GET is self or `manage_members`. PUT (/review) is never your own row below the owner, and a
      manager limited to some tournaments may give only those, never "every tournament".
  - **Guard:** `tests/unit/admin-reads-capability-guard.test.ts`. Every `app/api/admin/**` GET that resolves a member must
    refuse by what they hold; a check computed only into a response field doesn't count. It carries an explicit
    allow-list with reasons and was kill-tested with 13 mutants, all caught.
  - **Probe:** `.probe/sweep3-fixA-prove.mjs`.
    - Owner and admin: 200 everywhere.
    - Staff: 200 on their screens' reads, refused on score review and setup steps.
    - Coach row and scorekeeper: refused on every route. The scorekeeper keeps divisions, the check-in list and the
      score screen.
    - Invitee: 401.
    - Own-row assignment PUT: 403.
    - `.probe/sweep3-prove.mjs`: both accounts 403 on all three routes.
  - **Left open:**
    - ⚖ **Owner question:** the Venue library's rule ("a coaching login opens nothing of the club's; every other member
      reads it") lets a scorekeeper and staff read the permits, their documents and the library view. Is that meant?
    - Staff read email recipients on the Communication screen by its own rule, which pairs with finding 5's owner
      call.
    - The check-in board's divisions read carries fee amounts to a gate volunteer (low).
    - The score feed's submitter emails and notes stay on the Small line.

### 4 · MEDIUM — still open from sweep 2 (owner call): the returning-player scan shows guardian contacts without the roster-privacy grant
- `GET /api/coaches/[orgSlug]/teams/[teamId]/development/continuity` (handler ~L55-190) returns prior-season guardian first
  and last name, email and the child's birth date behind `canWriteDevelopment` only. `rosterPii` is not consulted.
  `?target=roster` always works; `?target=registrations` only when the tryout isn't blind.
- **Who:** an assistant coach whose head coach switched on Development but not roster privacy. **Fix (recommended in sweep
  2):** redact unless `rosterPii`. The existing TODO owner-call line stands.

### 5 · MEDIUM (owner call) — a tournament "staff" member exports every team's contacts, payments and private notes
- `GET /api/admin/tournaments/[tournamentId]/registrations/export` (`route.ts:108-125`): `module_tournaments` + scope +
  org only. The `staff` role holds `module_tournaments` by default (`lib/roles.ts:63-67`). The CSV carries coach and
  contact emails, payment status and amounts, and admin notes. Sweep 2's fix put `/api/registrations` GET on
  `module_tournaments` deliberately, so the screen read may be a ruling. The export, and the admin notes in both, look
  wider than a schedule-and-check-in volunteer needs. The sibling actions (bulk, reminders, resend, import) all need
  `manage_registrations`.
- **Fix (recommended):** the export and `admin_notes` need `manage_registrations`, or record that staff should read them.

### 6 · MEDIUM — a hidden Schedule page still sends its games through three other public sections (anonymous)
- `GET /api/public/tournament-data?section=teams-preview | standings-preview | playoffs` — `lib/public-tournament-data.ts:
  139-140` keys these sections on the Teams, Standings or bracket switch only, and each returns
  `games: onlyPublishedGames(…)` (:215-245). An organizer who hid Schedule still publishes every published division's
  dates, times, places, teams and scores. No notes and no submitters are sent, so this is display data, not personal data.
  `team-profile` and the `scores` section already honour the Schedule switch.
- **Fix:** blank `games` and `standingsByDivision` in those branches when Schedule is hidden.

### 7 · MEDIUM-SMALL — an unsubscribe link writes on a plain visit, so mail scanners can unsubscribe people
- `GET /unsubscribe` (`app/unsubscribe/route.ts` — the user, guardian and org branches all upsert or update on GET; re-read).
  Corporate mail scanners that pre-open links can opt a family out, or turn off a club's FieldLogicHQ emails. The org
  token is one per club, shared by every footer. The effect is mail silently not arriving. The stop links
  (second parent, invitation) already use a confirm page and a POST for exactly this reason.
- **Fix:** a confirm page that writes only on POST (keep a one-click POST for the mail header). Route the wording to `/legal`
  (CASL: an unsubscribe must be easy, which one click on a confirm page still is).

### Small (one TODO line; reviewers' traces unless marked)
- **Demo sandbox billing:** the demo write block matches a demo club in the URL only, and the billing POSTs name the club in
  the body. An anonymous "See it live" visitor can therefore reach portal, checkout, setup-payment, move, cancel and
  downgrade on the demo clubs. Only `billing/location` refuses. No real data; demo state and Stripe test objects only.
- **Scorekeeper feed** (`app/api/official/[orgSlug]/score/get-score.ts:175-190, 310-312`, re-read): sends game notes, venue
  notes and the **email of whoever submitted each score** to every scorekeeper.
- **Team pay links** (`lib/team-pay-link.ts`) never expire and can't be revoked per team (the league link has a version). A
  forwarded email shows that team's receipts (card brand and last 4) and can start a payment for that team.
- **Venue permit file** (`app/api/admin/org/permits/document/route.ts:34-48`, re-read): any non-coach member gets the file,
  which may state the fee that the screens hide from non-money seats. `?teams=1` lists every rep team, ignoring group limits.
- **Coach revoke of a family link** ends the parent's access to that child on **every** team (the link is child-wide since
  mig 453), not just the coach's own team.
- **House-league registrations search** escapes only `%` and `_`, so commas can add `.or()` conditions. Still bounded to the
  season, by a caller who can read all of it.
- **Draft season name** shows on the public register and status pages (every other public league page answers 404).
- **Anonymous feedback form:** the per-address limit keys on a header the caller sets, and the limits are per server
  instance, so the admin inbox can be flooded.
- **Sign-up answers** tell an anonymous caller that an email has a pending invitation, and to which club. Per-instance,
  header-keyed throttles; `account-check` is the same oracle by design.
- **Rep-team link to a tournament registration** skips the group limit (`admin/teams/rep-team-link`).
- **Upload paths** take the file name and the browser's file type as sent (rep-team documents, templates). Bounded to the
  club's private bucket.
- **Dev seed guard** (`lib/platform-auth.ts:164-195`) has no production check of its own. Defence in depth: the flag is off
  in production and a super admin is required.
- Also: `pay/tournament/[id]` answers yes/no for any id, unthrottled; family claim doesn't check `email_confirmed_at`
  (defence in depth); members/invite adds an existing account as active with no acceptance (consent call), and fails past
  1,000 platform users; an admin can edit an owner's display name; `request-deletion` puts the reason unescaped into the
  operator email; `payouts/return` builds its redirect from the request host; one Stripe expiry handler ignores the
  event's account; `weekOf=garbage` returns 500; Overview and News show posts aimed at a held-back division; Rules sends
  held-back divisions' settings.

### Sweep 2's open items, re-checked
- Public SCHEDULE payload carrying unpublished divisions and notes: **FIXED** (`lib/public-tournament-data.ts:185-209`
  `onlyPublishedGames`, notes stripped in `lib/public-teams.ts`; re-read).
- `register` POST and `forgot-password` throttles: **closed** (both throttled now). Residual: per-instance limits and a
  header-keyed source.
- Returning-player scan without `rosterPii`: **still open** (finding 4).
- `org-context` Stripe ids to any member: not re-checked (no file in scope touched it).

## Clean (read whole, correctly checked)
- **House league:** all 40+ season routes go through one action-keyed gate plus a season-in-org check. Every child id
  (division, team, registration, game, practice, send, refund) is tied to the season. Anonymous league routes, the signed
  versioned sign-up and pay links, the coach team page (a fixed column list with no birth dates or notes), and the coach
  and family calendar feeds are all checked.
- **Families:** every Families admin route needs the explicit Families grant (off by default for every role, admin
  included; group-limited members refused), and every object is checked against the club. The family app reads only the
  parent's own verified links and sends an allow-list (no medical data, no birth dates). Claim tokens are random, hashed,
  expiring, single-use and email-bound. Stop links write only on POST.
- **Club money:** Stripe Connect, billing and Resend webhooks verify signatures and never take the club from the payload.
  The payout account id is read from our records only, and connecting is owner-only. All six bank-check routes and ~45
  accounting routes are gated, with every id checked against the club. New money tables are server-only.
- **Scheduling:** the club scheduler (owner/admin), the send recipients (computed on the server; the request can only
  narrow them), the house-league schedule, and the venue-clash lookups (a shared venue never shows another club's
  bookings).
- **Public:** the tournament and club public gates (canceled, status, site switch, plan), team profile, the rep-team public
  page (games only, never practices or players), league public pages (a draft answers 404), tryout sign-up, `proxy.ts`
  host routing (an allow-list; no open redirect).
- **Coaches Portal:** every team route proves team, club and live membership before the capability. A removed coach loses
  access at once. The closed-season page reads only its own team's year. Chat checks membership (and is paused). Admin
  rep-team routes need the Rep Teams grant and the group limit.
- **Platform:** all 96 platform-admin routes are guarded. The staff-account guard covers all five person actions. Cron
  routes use a constant-time secret and fail closed. Support search runs through server-only functions with no filter
  strings. The demo door is an allow-list with no path into a real club.
- **Storage:** player documents, templates, logos, banners, sponsor art, permits and the owner's receipts. Every signed link
  is minted from our own record after a club, seat and owner check, and lives one hour. No private file sits in a public
  bucket.

## Who sees what — seat by seat (for the board pack)

Plain words. "Their club" means only the club they belong to; no seat reads another club. Defaults are shown. A club owner
can widen or narrow any member's access on the Members screen. Items marked **(today)** are the findings above and close
when they are fixed.

| Seat | Personal information it can read |
|---|---|
| **Owner** | Everything in their club: every member's name and email; every family's contacts, address, children's birth dates, medical and emergency details, payments and notes (the Families book); every team's roster and documents; the club's books and bank records; billing. |
| **Admin** | Everything the owner reads in the programs the plan carries (tournaments, house league, rep teams, club money, the public site). **Not** the Families book unless the owner grants it, and not billing. |
| **Treasurer** | The club's money: books, bank check, payees, what each team and family owes and has paid (names and amounts, no contact details). The Members list (names and emails). No rosters, no Families book. |
| **League admin** | House league: each registration's child name and birth date, guardian names, emails and phone, sign-up notes (which can be medical), player ratings, payments. The Members list. |
| **League registrar** | As the league admin, except ratings and running the draft. Can email families and take fees. |
| **Staff** (tournament volunteer) | Their assigned tournaments: teams and their contact emails, payment status and admin notes (finding 5, an owner call); roster names and birth dates at the check-in gate. **(today)** the tournament emails and who they went to, and every tournament's full record (findings 1, 3). |
| **Official / scorekeeper** | The day's games; at the gate, roster names, jersey numbers, birth dates and amounts owed. **(today)** other scorekeepers' emails in the score feed, the tournament emails and recipients, and every tournament's full record (findings 1, 3). |
| **Head coach / assistant coach** (rep teams) | Their own team only. Player names and numbers always. Guardian contacts, birth dates, medical and emergency details and signed documents **only** with the roster-privacy grant, which the head coach decides. Dues and notes only with those grants. **(today)** past-season guardian names, emails and birth dates through the returning-player scan without that grant (finding 4); the club's tournament emails and recipients (finding 1). |
| **House-league coach** | Their own team: player names and each family's guardian name, emails and phone. No birth dates, notes or fees. |
| **Family (signed in)** | Their own children (first names), the team schedule and announcements, their own fees and receipts, and who else is connected to their child. Never another family's child, birth dates or medical details. |
| **Holder of a pay or sign-up link** (emailed) | That one team's or sign-up's amounts and receipts (card brand and last 4), children's first names, a masked email. |
| **Anyone (no sign-in)** | Team names, schedules and scores the club published, coach names only where the coach or club chose to list them, the club's public contact. No players, no family contacts, no birth dates, no health information. |
| **FieldLogicHQ staff** | Support sees account names, emails and sign-in status to help customers, and every action is audit-logged. No staff screen shows children's health data or birth dates. The company's books are owner-only. |

**Sold or shared?** Not a code question this sweep answers. `LEGAL_FACTS.md` holds the "no analytics, ads, AI service or
SMS" facts; the sweep found no route that sends club data to a third party beyond the named suppliers (Supabase, Stripe,
Resend, AWS).

## Recommended fix order
1. **Findings 1 + 3 together:** the tournament-admin reads need a capability, the score-review switch needs
   `create_tournaments`, and a decision on whether a capability-less coach row passes the shared check. One commit, a guard
   test, a dev probe.
2. **Finding 2:** the resources store moves behind a server route (a migration drops two policies; the Rules screen's
   upload and delete change). Its own commit; the prod migration goes with the code.
3. **Finding 4** (the standing owner call) and **finding 5** (an owner call): small, once ruled.
4. **Findings 6 and 7**, then the Small line.
