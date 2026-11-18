# Board Ready · Stage 0a — the third access sweep (report-only, 2026-11-10)

> Plan of record: `BOARD_READY_PLAN.md` §5 Stage 0a. Prompt: `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md`. Earlier sweeps:
> `TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md` § Second sweep (2026-10-16) and the Club Tier Stage 0 sweep.
> **This session found and reported. Nothing was fixed.** Each fix waits for the owner's go and lands as its own commit.
>
> **State as of 2026-11-16 (a census of this report against the code on `dev`, read-only):** fixes A–E are committed
> (2026-11-11) and in `release/2026-11-15`. Of 48 items: **28 fixed and confirmed, 9 left open on purpose (owner
> calls), 9 open with no ruling (all small), 2 answerable only on production.** Two status lines below are stale and are
> left as written: "Returning-player scan … still open (finding 4)" (fixed, `d8a6bb4c0`), and "a See it live session
> can also create real clubs, leagues and teams" (today only a coach's team; club and league creation are turned away
> by the one-club rule, which lets a request through if its own read fails). The 18 not-fixed items are the owner's
> calls in `BOARD_READY_TRUST_CLOSE_CHECKLIST.html` (https://claude.ai/artifact/2KZrC64ucjBpWCgMkfPCej), numbered 1–18
> there; the rulings are recorded here when they come back.
>
> **RULED 2026-11-18 (owner, trust close-out paste-back: "Access calls 1A–22A, all as recommended"; no sign-off needed).**
> - **Fix (small, one commit each, awaiting the owner's go to build):** 1 refuse the demo account at all three create doors + a
>   build check · 2 permits and venue library read only by people who schedule, run tournaments or handle money · 3 "same
>   player" Confirm only for a coach who can see roster details · 4 billing facts sent only to owner and admins · 5 fee totals
>   not sent to check-in volunteers · 6 clean the name and check the type on upload · 7 a bad week in the address falls back
>   to the current week · 8 rules save as one database step · 9 permit file name and size hidden from readers who can't open
>   it ("File attached") · 10 permit save checks the member's own team groups · 11 "confirm your email first" message.
> - **Fix (larger):** 12 a "Send a new link" button for a team's pay link (**its own short drawing session first**) · 13 an
>   existing account is invited to accept, not attached on the spot (medium build) · 14 rules, files and links lock with a
>   completed event.
> - **Accepted as designed, reason on record:** 15 a coach's Remove ends the parent's link on every team (the window says
>   so) · 16 staff who can open Communication see recipients (the screen's own rule) · 17 the shared anonymous-feedback cap
>   of 40 a day (for now) · 18 sign-up names the club on a pending invitation, never the role (decided July, on purpose).
> - **Checks:** 19 "yes, run the read" of old link rows on production (**RUN 2026-11-18, read-only: 3 link rows in all, 0 with a non-web address, 0 script-like; nothing to clean**) · 20 live
>   Stripe, demo customers: **looked, none found (2026-11-18)**.
> - **21** plan the small build "refuse a second caller for the same scheduled job and minute" **before the first live club**
>   (a restored copy starts its jobs and calls the live site; Part C of the checklist does the by-hand step until then).
> - **22** the public roadmap may say **"a full access review of who can see what, every finding resolved"** once the fixes
>   above are live; until then it keeps "with its fixes live" (`PRODUCT_ROADMAP.md` §4 item 5).
>
> **Status, 13 (built 2026-11-18, dev; commit hash recorded on the queue's PROGRESS row):** an existing CONFIRMED account
> is now invited (a pending row, `invited_email` left empty as the mark) and accepts or declines on Home; an unconfirmed one
> gets the set-up invitation. Same chunk: demo and support addresses refused as invitees (one neutral answer); a demo
> account refused at both accept doors; a member edit can't set a pending row's status; a yes from Home is to the role the
> card showed; Cancel on a pending row sends no "removed" email and never deletes an account its owner already had.
> Proof `.probe/existing-invite-prove.mjs` (dev, 34/34); guard `tests/unit/existing-account-invite-guard.test.ts`.
> **Left, owner calls:** (a) a club's own COACH given a board role is still changed on the spot (asking first needs a
> place for the pending role, a schema change) — **RULED 2026-11-18 (owner): they accept too**, built as its own queue
> prompt (P2b in `BOARD_READY_TRUST_FIX_PROMPTS.md`); (b) a pending invitation never expires, holds a seat, and lands its
> invitee on Home at every sign-in until they act — **RULED 2026-11-18 (owner, as recommended with /legal): an
> unaccepted invitation runs out (30 days, a resend restarts it) and lapsed ones are removed**, queue prompt P2c; (c) the database's membership test (`is_org_member`,
> `can_access_tournament`) ignores status, so a pending invitee's browser session can read the club's venue library and
> its tournaments' team names (suspended members too: not new, now aimable at any existing account): one migration —
> **RULED 2026-11-18 (owner, as recommended): both count only active members**, queue prompt P2d.
> **Reported, not fixed:** "1,000 users" — the Members list is already fixed (`peopleSignInFacts`); the same page-1 read
> is live in the program-year coaches list and the platform staff-delete tool (2–5 lines each). The support check fails
> open on a database error and compares stored emails case-sensitively. The accept page without `?org` accepts the
> oldest pending row. `scripts/backfill-invited-email.mjs` predates the empty-email mark.
>
> **Status, 21 (built 2026-11-18, dev; commit hashes on the queue's PROGRESS row):** the owner chose the stronger option B
> over the once-a-minute cap. Every scheduled call carries a one-use receipt its own database wrote (mig 502); the live site
> runs a keyed call only after using up a receipt the LIVE database holds, for that job, inside 15 minutes. A restored copy
> is refused in any minute, a leaked key alone runs nothing, and one receipt never runs twice. A refusal answers a quiet
> "OK, nothing run" and opens an error in the platform error log, which emails once (review 2026-11-18). Proof `.probe/cron-receipt-prove.mjs` (dev); guard
> `tests/unit/cron-receipt-guard.test.ts`. Production: migration 502 FIRST, then the code. The by-hand Part C step stays.
>
> **BUILT 2026-11-18 — fixes 1–11 as ruled, one commit each on `dev` (2 and 9 share one):**
> - 1 demo account refused at every create door + build check — `49c4c9934` 2026-11-18 (two doors beyond the ruling's
>   three are guarded too, because both can create a coach team: claiming a tournament entry, and a signed-in sign-up).
> - 2 + 9 permits and Venue library read only by those who schedule, run tournaments or handle money; "File attached" for a
>   reader who can't open the file — `f781d0f0d` 2026-11-18.
> - 3 "same player" Confirm only with roster privacy — `2137f6f12` 2026-11-18.
> - 4 billing facts to owner and admins only — `140eed5a1` 2026-11-18.
> - 5 no fees to a gate-only volunteer — `9ec647290` 2026-11-18.
> - 6 upload type read from the file's bytes, stored name cleaned — `5258fae20` 2026-11-18.
> - 7 a bad week falls back to the current week — `517f30e36` 2026-11-18.
> - 8 a Rules section saves in one database step — `a3670460b` 2026-11-18. ⚠ **Production: apply migration 500 FIRST,
>   then the code** (the new save calls `rule_section_save`; code first = every Rules section edit answers 500). Nothing
>   else in fixes 1–11 touches the database.
> - 10 a permit save checks the member's own team groups — `643c2dd05` 2026-11-18.
> - 11 "confirm your email first" — `238bc70d3` 2026-11-18.
> - Walk: `OWNER_QA_LEDGER.md` §539 (`BOARD_READY_TRUST_CLOSE_WALK.html`).
>
> **Two premises above were wrong, corrected at build:** (4) the billing facts never went through the role-summary hook;
> they reached the browser through `/api/org-context` and the admin and Coaches Portal layouts, and those three are what
> changed. (8) "one database step" alone could not stop the double point: a retried save whose new points carry no id is a
> second insert however atomic it is. The screen now names each new point (its id) before its first save, and the one step
> upserts by that id.
>
> **Found while building, not fixed (no ruling covers them; owner calls):**
> - the club's player-document upload saves any `templateId` it is sent, unchecked (the coach route checks it);
> - creating a Rules section (POST) is still two inserts with a compensating delete (a retried create could add a section);
> - a member limited to some team groups can still save a permit held for the whole club (the ruling covered teams only);
> - …and can still delete a permit, or replace its file, held for a team outside their groups (ruling 10 named saving,
>   editing and renewing) — found by `/review` 2026-11-18;
> - the house-league schedule's "outside the permit" warnings send the permit's days, hours and id to anyone who reads the
>   season, a registrar included (ruling 2 named the Permits and Venue library screens) — `/review` 2026-11-18;
> - the permit file upload still takes the browser's word for the file type and stores its raw name (ruling 6 named player
>   documents and templates) — `/simplify` 2026-11-18.

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
- **⚖ Ruled, owner 2026-11-11: redact unless `rosterPii`, keep the match working. Committed `d8a6bb4c0` 2026-11-11 (W2 fix E).**
  The prior side's guardian names, email and the child's birth date come back null with `contactHidden: true`; the compare card then says
  they are shown to coaches with roster privacy instead of "no birth date on file". Matching still runs on the full identities.
  Probe (`.probe/sweep3-fixE-prove.mjs`): head coach sees all four fields; the Development assistant gets the same pair, none of them.
  ⚖ **New owner call (review):** the assistant can still press **Confirm — same player** on a pair judged by name and season alone, and a
  confirm unlocks the prior season's tryout history. Options: hide Confirm when the details are hidden (the head coach confirms) · leave.

### 5 · MEDIUM (owner call) — a tournament "staff" member exports every team's contacts, payments and private notes
- `GET /api/admin/tournaments/[tournamentId]/registrations/export` (`route.ts:108-125`): `module_tournaments` + scope +
  org only. The `staff` role holds `module_tournaments` by default (`lib/roles.ts:63-67`). The CSV carries coach and
  contact emails, payment status and amounts, and admin notes. Sweep 2's fix put `/api/registrations` GET on
  `module_tournaments` deliberately, so the screen read may be a ruling. The export, and the admin notes in both, look
  wider than a schedule-and-check-in volunteer needs. The sibling actions (bulk, reminders, resend, import) all need
  `manage_registrations`.
- **Fix (recommended):** the export and `admin_notes` need `manage_registrations`, or record that staff should read them.
- **⚖ Ruled, owner 2026-11-11: the export and the private admin notes need Manage registrations; staff keep the team list.** Built on dev
  (W2 fix E), committed `d8a6bb4c0`. The rule is one helper (`canManageRegistrations`: `manage_registrations` or
  `create_tournaments`, as import allows). **Correction to the finding:** the export file never carried admin notes; the notes were on the
  screen reads. The export route now refuses staff; `/api/registrations` **and `/api/admin/teams`** (found by /review: the schedule,
  bracket and Teams screens read it, and it returned the notes too) blank `admin_notes`; the Teams screen hides the Export menu and the
  Notes block for them. Probe: staff 403 on the export, 200 on both lists with null notes; owner and admin see the note.

### 6 · MEDIUM — a hidden Schedule page still sends its games through three other public sections (anonymous)
- `GET /api/public/tournament-data?section=teams-preview | standings-preview | playoffs` — `lib/public-tournament-data.ts:
  139-140` keys these sections on the Teams, Standings or bracket switch only, and each returns
  `games: onlyPublishedGames(…)` (:215-245). An organizer who hid Schedule still publishes every published division's
  dates, times, places, teams and scores. No notes and no submitters are sent, so this is display data, not personal data.
  `team-profile` and the `scores` section already honour the Schedule switch.
- **Fix:** blank `games` and `standingsByDivision` in those branches when Schedule is hidden.
- **→ Fixed, W2 fix C, 2026-11-11** (committed `ae474966e` 2026-11-11). Teams sends no games, and no records unless Standings and
  Schedule are both on. Standings and Playoffs send no round-robin games; **they keep the playoff games (owner 2026-11-11: go with the recommendation, keep)** (a test
  says hiding Schedule never hides the bracket, and a bracket is those games). Standings tables stay (their own switch). The share
  image keeps its games through a server-only option the HTTP route cannot pass.

### 7 · MEDIUM-SMALL — an unsubscribe link writes on a plain visit, so mail scanners can unsubscribe people
- `GET /unsubscribe` (`app/unsubscribe/route.ts` — the user, guardian and org branches all upsert or update on GET; re-read).
  Corporate mail scanners that pre-open links can opt a family out, or turn off a club's FieldLogicHQ emails. The org
  token is one per club, shared by every footer. The effect is mail silently not arriving. The stop links
  (second parent, invitation) already use a confirm page and a POST for exactly this reason.
- **Fix:** a confirm page that writes only on POST (keep a one-click POST for the mail header). Route the wording to `/legal`
  (CASL: an unsubscribe must be easy, which one click on a confirm page still is).
- **→ Fixed, W2 fix C, 2026-11-11** (committed `ae474966e` 2026-11-11). `/unsubscribe` is now a page that writes nothing; the
  button POSTs to `/api/unsubscribe`. Links already sent keep working. `/legal` reviewed (`CASL_UNSUBSCRIBE_CONFIRM_STEP.md`):
  wording and a masked family address applied. **Follow-up built** (`92f802403` 2026-11-11, owner: go with the recommendations): every mail with an unsubscribe footer
  now carries `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058) pointing at the new route; a GET there only redirects to the
  confirm page. Not sent through a real mail provider on dev, so the first live send is the check.

### 8 · MEDIUM (crosses clubs; low likelihood) — late finding 2026-11-11: two database merge functions answer any signed-in account — **FIXED on dev (mig 464)**
- Found by the two-step sign-in census (Board Ready two-step, Part 1), not by this sweep, which read routes and pages, not
  database grants. `merge_rep_team_tags` (mig 302's body) and `merge_rep_team_award_types` (mig 289) are SECURITY DEFINER,
  were granted EXECUTE to `authenticated` (migs 221, 239, 289, 302 each re-granted it), and neither asks who is calling.
  Any signed-in account, in any club, could call them straight on the database with two ids and merge one team's tags or
  award types into another's, re-pointing every link and deleting the one merged away.
- Likelihood is low: the ids are not listable by a signed-in token (the tag and award tables grant it nothing), and the
  app only calls them through the service role after its own checks (`lib/db.ts`).
- **Fixed (owner: fix now, its own commit):** mig 464 revokes EXECUTE from `authenticated`; the service role keeps it.
  Verified on dev 2026-11-11 (`has_function_privilege` false for `authenticated`, true for `service_role`). Prod: any time,
  independent of the code (MANUAL_PROD_STEPS.json).
- The same census found that a signed-in token can reach 15 tables directly (the mig 311 keep-list). None holds family,
  medical, roster or money rows; mig 463 now requires the code there too for a person with two-step on.

### Small (one TODO line; reviewers' traces unless marked)
- **Demo sandbox billing:** the demo write block matches a demo club in the URL only, and the billing POSTs name the club in
  the body. An anonymous "See it live" visitor can therefore reach portal, checkout, setup-payment, move, cancel and
  downgrade on the demo clubs. Only `billing/location` refuses. No real data; demo state and Stripe test objects only.
  **→ Fixed, W2 fix D, `0d424d8bc` 2026-11-11.** One shared refusal in every billing write; review also closed the payouts setup
  (POST, PATCH) and its Stripe return, which named the club only in the body. A build check sweeps them. `/accounting`: no change to
  what is charged or reported. Reports separate live from test mode but do not leave out the demo clubs: owner step, look for demo
  customers or invoices in LIVE Stripe.
- **Scorekeeper feed** (`app/api/official/[orgSlug]/score/get-score.ts:175-190, 310-312`, re-read): sends game notes, venue
  notes and the **email of whoever submitted each score** to every scorekeeper.
  **→ Fixed, W2 fix E `d8a6bb4c0` 2026-11-11 (committed `d8a6bb4c0`).** The feed stops sending game notes, venue notes and the
  submitter's id and email; the scorekeeper screen drew none of them. Probe with planted values: absent for the scorekeeper and the owner.
- **Team pay links** (`lib/team-pay-link.ts`) never expire and can't be revoked per team (the league link has a version). A
  forwarded email shows that team's receipts (card brand and last 4) and can start a payment for that team.
  **→ Fixed, W2 fix D, `90d2f23b0` 2026-11-11 (mig 467, dev only: apply to prod BEFORE the code).** The team link has a version like
  the family link; every link already emailed keeps working. Server side only (`replace_pay_link`); the club's "Send a new link"
  button needs a `/design` session. Review found and fixed: a team paying as the link is replaced is sent on to the current link.
- **Venue permit file** (`app/api/admin/org/permits/document/route.ts:34-48`, re-read): any non-coach member gets the file,
  which may state the fee that the screens hide from non-money seats. `?teams=1` lists every rep team, ignoring group limits.
  **→ Fixed, W2 fix E `d8a6bb4c0`.** The file opens for the Venue library's savers (owner, admin, league admin, "Run tournaments") and the
  Accounting seat; others see the file's name as plain text. `?teams=1` lists only the member's team groups. Probe: owner, admin, league
  admin, treasurer admitted; league registrar 403; a group-limited member sees only their 4 of 8 teams.
  Left open (review, Low): the file's **name and size** still show to every reader (a file named with the fee would leak it); a permit held
  for a team outside a limited member's groups may have no matching option in the edit list, and the save's check of the held-for team
  against their groups was not traced.
- **Coach revoke of a family link** ends the parent's access to that child on **every** team (the link is child-wide since
  mig 453), not just the coach's own team.
  **→ Wording route, W2 fix E (committed `d8a6bb4c0`).** Per-team ending would need a new per-team table (the link has no team since mig 453), so
  Remove now opens a confirm window: "This ends {parent}'s connection to {child} on every team, rep and house league, not only this one.
  Their calendar feed stops too, and they won't be invited again on their own." (before, Remove was immediate). Stock coach confirm window;
  `/design` has not looked at it. Nothing a parent reads changes, so no `/legal` pass.
- **House-league registrations search** escapes only `%` and `_`, so commas can add `.or()` conditions. Still bounded to the
  season, by a caller who can read all of it.
  **→ Fixed, W2 fix E `d8a6bb4c0`.** `, ( ) " .` become the single-character wildcard (a dotted email still finds itself); backslashes are escaped.
  Probe: a comma-carrying hostile search returns 0 rows, not everyone.
- **Draft season name** shows on the public register and status pages (every other public league page answers 404).
  **→ Fixed, W2 fix C, `ae474966e` 2026-11-11.**
- **Anonymous feedback form:** the per-address limit keys on a header the caller sets, and the limits are per server
  instance, so the admin inbox can be flooded.
  **→ Fixed, W2 fix D, `0d424d8bc` 2026-11-11.** Keyed on the address our own edge wrote (CloudFront's, else the last forwarded entry)
  and a database daily cap (5 per address, 40 anonymous in total, 10 per account). Owner steps: check one real production request's
  headers before the promote (an extra hop would make every anonymous visitor share one limit); the 40 total can be filled by about
  eight deliberate addresses to block anonymous feedback for a day (owner call to soften).
- **Sign-up answers** tell an anonymous caller that an email has a pending invitation, and to which club. Per-instance,
  header-keyed throttles; `account-check` is the same oracle by design.
- **Rep-team link to a tournament registration** skips the group limit (`admin/teams/rep-team-link`).
  **→ Fixed, W2 fix E `d8a6bb4c0`.** Link, unlink and the list honour the member's team groups. **/review found and fixed:** a link save
  REPLACES the registration's existing link, so a limited member could destroy a link to an out-of-group team they could not see; the
  save now also checks the link it would replace. Probe: Junior/Senior link, unlink and replace all behave.
- **Upload paths** take the file name and the browser's file type as sent (rep-team documents, templates). Bounded to the
  club's private bucket.
- **Dev seed guard** (`lib/platform-auth.ts:164-195`) has no production check of its own. Defence in depth: the flag is off
  in production and a super admin is required. **→ Fixed, W2 fix D, `0d424d8bc` 2026-11-11.**
- **W2 fix C (`ae474966e` 2026-11-11) fixed three of the "Also" items below:** `pay/tournament/[id]` (live, un-canceled tournament
  only, throttled), Overview and News posts aimed at a held-back division, and Rules sending held-back divisions. Rule sections
  tagged to a held-back division were the same class as the posts: **fixed in `92f802403`** (Rules page, feed section, nav count).
- Also: `pay/tournament/[id]` answers yes/no for any id, unthrottled;
- **W2 fix E (2026-11-11, committed `d8a6bb4c0`) on the "Also" members items:** an admin can no longer edit an owner row's name or title (the
  Manage window shows them locked); `members/invite` looks an account up across every page and fails closed. **⚖ Owner consent call, recorded
  and NOT changed:** the invite's existing-account branch adds the person as an *active* member with no acceptance. Lead noticed, not fixed:
  `GET /api/admin/members` also reads only the first 1,000 platform users, so past that the list would show blank names and emails. family claim doesn't check `email_confirmed_at`
  (defence in depth); members/invite adds an existing account as active with no acceptance (consent call), and fails past
  1,000 platform users; an admin can edit an owner's display name; `request-deletion` puts the reason unescaped into the
  operator email; `payouts/return` builds its redirect from the request host; one Stripe expiry handler ignores the
  event's account; `weekOf=garbage` returns 500; Overview and News show posts aimed at a held-back division; Rules sends
  held-back divisions' settings.
- **W2 fix D (`0d424d8bc` 2026-11-11) fixed four more of the "Also" items:** the family claim also checks `email_confirmed_at`;
  `payouts/return` builds its redirects on a trusted same-host origin; the Stripe "session expired" handler binds the event's account;
  `request-deletion` escapes the reason (and every field) in the operator email.
- **Found in W2 fix D's review, owner calls (not fixed):** a "See it live" session can also create real clubs, leagues and teams
  (`org/create`, `league/create`, `coaches/teams` name no club, so neither the proxy block nor the new refusal sees them; `org/create`
  also grants the Founding Season comp). A signed-in parent with an unconfirmed email who is refused a family claim sees the generic
  "didn't go through" message (near-unreachable).

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

## Carried in from TODO (2026-11-17, One Board Session 2)

- [ ] **Owner call still open (finding 2):** neither the file-store route nor the rules route locks a completed event. The file-store, link-row and Rules fixes are built (W2 fix B and after); their migrations go to production after the code.
