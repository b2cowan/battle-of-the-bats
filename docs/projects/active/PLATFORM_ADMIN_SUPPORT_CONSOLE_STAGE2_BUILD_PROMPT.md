# Platform admin support console · Stage 2, Find, the menu by job, Today, the customer record (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-25, the day the owner ruled the Stage 2 drawings ("I agree with all of
> your recommendations"). **Re-verify every lead against the code before you build on it:** this prompt is a lead, not
> evidence, and so is any helper's summary. The working copy is shared with Club Tier and Bookkeeping sessions: stage
> explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit nothing without the
> owner's OK.

## 1 · What Stage 2 makes true

A support person starts every job the same way: *find the customer, read what has happened to them.*
- **Find**, in the strip on every console page, opened with `/`: people (email, name), clubs (name, web name, own web
  address, owner email) and Stripe numbers (whole customer, subscription and family-payment numbers), grouped, server-side,
  every account. The 1,000-account cap ends in all four places it lives.
- **The menu by job:** Today, then Customers · Health · Growth · Product · Records, System (dev only), Private finance.
  Roles trim it; the eye tells the truth; a folded group carries the sum of its counts.
- **Today** replaces Overview: what is waiting on us, grouped by job, a plain health line, the business numbers one door away.
- **The club record reads first:** title + chips + caption, a four-figure band, tabs Story · Money · Access · People &
  tournaments, opening on the Story. One pencil edits the whole record; the check mark confirms in one sentence and asks
  why. Put it back on plan, limit, section and running-override entries.
- **A person record**, new: Story · Clubs · Account.
- **One rulebook by power:** the menu, the pages and every console API read the same list.

## 2 · Rulings. Do not reopen them

- **The drawings are the spec:** https://claude.ai/artifact/Ub7fXLh29SC34Zp4oqKUx1 (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_DRAWINGS.html`). Build what they draw, including the design pass's applied fixes.
  Where this prompt and the drawings disagree, stop and ask.
- **The eleven asks, all as recommended** (`memory/design_decisions.md` 2026-10-25, "SUPPORT CONSOLE STAGE 2, ELEVEN ASKS"):
  A1 Billing loses Support's account powers (M3) · A2 Find follows the rulebook, Stripe numbers for Super admin, Billing,
  Support · A3 a trail of records opened, not words, 90 days · A4 the Story ships now with the "not in it yet" line · A5
  every real queue plus new errors and new feedback, nothing invented · A6 one pencil for the whole record, the check mark
  confirms + asks why · A7 the names as drawn · A8 both lists stay, People rows open the person record · A9 kickoff
  leftovers (nothing for this stage to build) · A10 charge numbers wait for Stage 3 · A11 a folded group shows the sum.
- **Standing:** R1–R8 (plan), Q1–Q7, F1, D1–D5, the Stage 1 rulings (shell, "Support console", Help in place, the
  account menu, sign-in always warm). **Cancel the subscription confirms in red** (console confirm rule 2026-06-26).
  **A record reads first, edits whole** (2026-10-01); the console's confirm-instead-of-autosave is its named exception.

## 3 · Read first

- The drawings (above): every frame, every tag (click them), the rulebook table, the Story entry table, the threat list
  (Find security), the boundary table, the design-pass box.
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: Status (the Stage 2 findings), R1–R8, the ladder. The PM brief.
- The project index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp: news is an `ArtifactData` write to `stages/s2`
  and `log/…`. Never republish it.
- `docs/agents/design/NAV_STANDARD.md`, `TABLE_AND_LIST_STANDARD.md`, the head of `memory/design_decisions.md`.
- The auto-memory `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`,
  `decision_waiting_count_is_amber_pill`, `decision_window_foot_text_left`, `decision_rare_door_ends_body`.
- `AGENTS.md`, `AGENCY_RULES.md` (PM UX summary before code; schema = dictionary in the same unit of work).

## 4 · Verified state (2026-10-25, re-verify)

| What | Then |
|---|---|
| Shell | `app/platform-admin/PlatformShell.tsx`: the strip's middle is empty on purpose (header comment ~line 10; the slot is between the portal label and `div.doors`). Rail = `PlatformAdminNav.tsx` (`BASE_NAV_GROUPS` ~41-99, `visibleGroups` ~102, the eye from `isPlatformAreaReadOnly` ~142, `PlatformNavBody` reused in the narrow drawer). |
| Two rulebooks | `lib/platform-areas.ts` `PLATFORM_AREAS` (nav + pages) vs `lib/platform-auth.ts` `ROLE_PERMISSIONS` (~26-33, most APIs via `hasPlatformPermission`). `organizations.writeRoles: []` while `manage_support` (super, support, **billing**), `manage_billing`, `manage_product` all write org data. Only email, early-access, email-templates, feedback, observability and pitch-deck APIs use `requirePlatformAreaApi` (~135). `company-users` GET answers any staff session (`getPlatformAuthContext`); `plan-config` / `plan-gating` GETs answer any session and **have no callers** (grep 2026-10-25). |
| Staff identity | `getPlatformAdminContext` (~74-97): `auth.getUser()`, then the email against `PLATFORM_ADMIN_EMAILS` (bootstrap super admin) or `platform_users` (`is_active`). **Never checks the email is confirmed.** Role read fresh per call, no cache. |
| Sign-in records | `@supabase/auth-js` 2.104.1 `listUsers({page, perPage})` only: no filter. `lib/auth-account-lookup.ts` pages up to 50×1000 for one exact email. No public mirror of auth emails or names. The 1,000 cap (single `perPage: 1000` page): `customer-users/page.tsx:51`, the orgs list's last sign-in (`orgs/page.tsx:45`), `lib/platform-metrics.ts:169` (owner inactive), `lib/founding-season-desk.ts:112`. The orgs list also selects organizations with no `.limit()` (PostgREST default cap). |
| Stripe ids | `organizations` and `team_workspaces` (`stripe_customer_id`, `stripe_subscription_id`), `online_payments` (`stripe_payment_intent_id`, `stripe_charge_id`: family payments to a club). Subscription charges are stored nowhere. `organizations.stripe_*` have no index. |
| Story sources | `platform_audit_log` (no reason column; reasons sit in `new_value` for plan, identity, ownership, overrides, own-address, retention; **none** for `update_addons`, `revoke_override`, `cancel_subscription`); user actions write `org_id` null with `field 'user_id'`. `org_overrides` (has `reason`), `org_internal_notes`, `platform_user_notes`, `platform_events` (downgraded, canceled, past due, recovered, `team_org_*`, `team_workspace_created`; **no purchase/upgrade**), `email_sends.recipient_org_id`, `org_audit_log` (member invited/role/suspended/removed), `feedback_submissions.org_id`, `organizations.created_at`. Account emails are unlogged. |
| Overview | `app/platform-admin/page.tsx`: five tiles, the Action queue (`:204-306`, role-gated tiles: past due, past due since visit, trials ending, overrides expiring, retention, missing owners, owner inactive (30 days), new leads, campaigns past due / due soon, approval queue), four tabs (`OverviewTabs`: Subscription, Growth, Usage, Notes). Last visit from `platform_admin_visits`. |
| Club record | `app/platform-admin/orgs/[id]/page.tsx` (618 lines, server) + `OrgDetailClient.tsx` (2,240 lines): band, Primary actions, Account context, five tabs (Support default: notes, identity form, ownership, own address, teams brought in, delete zone; Billing & access; Entitlements; People & tournaments; Activity = last 8 audit rows). Controls follow `canManageSupport/Billing/Product` props; section toggles show **disabled** for non-product. APIs under `app/api/platform-admin/orgs/[id]/…`. |
| People | No person page. `customer-users/page.tsx` + `CustomerUsersClient.tsx` (902 lines): in-memory filter of 1,000, 50 a page, per-row action menu (reset, ban, revoke sessions, confirm email, update, delete, notes) → `app/api/platform-admin/users/[id]/…`. Staff accounts excluded. |
| Logging | `instrumentation.ts:29-33` stores `request.path` **including the query string** in error context; `captureError` scrubs emails only, writes to CloudWatch too. `platform_admin_visits` keeps the path only. |
| Rate limit | `lib/rate-limit.ts`: in-memory, per instance; no console route uses it. |
| Migrations | Latest is `364_…`. A `SECURITY DEFINER` function in `public` is executable by PUBLIC and, by Supabase default grants, `anon` and `authenticated`. Precedent for a correct revoke: `178_bulk_reschedule_games_fn.sql:67-68`. Do **not** copy `221_…:432` / `239_…:229` (they leave `authenticated` able to call). |

## 5 · Scope: what Stage 2 is and is not

**Is:** the rulebook by power (+ M3, the confirmed-email check, the two closed gaps), the sign-in records lookup (one
migration) and the end of the 1,000 cap, Find, the menu by job and nine renames, Today + the Business numbers page, the
club record rebuilt (Story, one pencil, confirm, Put it back, read-only), the person record, the People list server-paged,
reasons kept on every change from now on, the trail of records opened.

**Is not:**
- Stripe reads of any kind: charges, refunds, invoices, last four, a charge number in Find (Stage 3, ruled A10).
- The reason column in the audit log (Stage 3). From Stage 2 on, a reason goes in `new_value` as plan changes do today.
- Recording customer purchases (ruled A4: Stage 3's Stripe read brings them).
- Free time, the `plan_tier` grant, Founding folded in (Stage 4). Overrides and "Overrides ending" stand in.
- Status, the health line's build/database/hosting checks, the sent-email log, errors on the Story (Stage 5).
- The insides of the renamed pages (Errors, Feedback, Leads, Campaigns, Pitch decks, Bulk changes, Staff): titles only.
- A tournament record. A phone design beyond Today. Bookkeeping's inside.

## 6 · Blocking gate: before any code

1. **Re-run §4** and note every row that moved.
2. **The rulebook table, in code terms.** Write the powers list (the drawings' "One rulebook" table, A1 applied) as a
   table: power → roles → every route and page control that uses it. Census **every** `hasPlatformPermission`,
   `canWritePlatformArea`, `canViewPlatformArea`, `requirePlatformArea*` and `isSuperAdmin` call under
   `app/platform-admin` and `app/api/platform-admin` (delegate the census). Show it to the owner only if a row would
   change who can open or do something beyond what the drawings say (A1's Billing changes are ruled; anything else is a
   security change, drawn first).
3. **Check every staff account is confirmed** before the confirmed-email check ships: list `platform_users` emails (dev and
   a read-only prod check) against `auth.users.email_confirmed_at`, and the bootstrap list. An unconfirmed staff account
   would be locked out; tell the owner first.
4. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build (after the gate), in parts

**Part 1 · One rulebook by power.**
- One module owns the powers (extend `lib/platform-areas.ts` or a sibling; do not add a third table). Areas keep view
  roles; each area's "write" becomes "holds any power this area's page uses", so the eye reads the truth (Growth and
  Read only see it on Clubs & portals and People; Support on Retention and Errors; Billing on Plans & pricing, Approval
  queue and, after A1, People).
- **A1:** Billing loses `manage_support`'s club and person powers. **Feedback triage stays with Billing** (area matrix,
  F3 2026-06-14): check the feedback routes do not reach it through `manage_support`. Billing keeps Email the owner.
- Every console API checks a power from the one list as its first step. `company-users` GET → super admin only. Delete
  `plan-config` and `plan-gating` (no callers; re-grep first).
- `getPlatformAdminContext` refuses a session whose email is not confirmed (after gate step 3).
- The record's controls read the same list (no more parallel `canManage*` props deciding differently).

**Part 2 · The sign-in records lookup (migration 365 or the next free number) and the end of the cap.**
- A read-only function over `auth.users` returning **exactly** id, email, display/full name (from metadata), last
  sign-in, created, banned-until, email-confirmed-at: search by email/name (`ILIKE … ESCAPE`, `%` `_` `\` literal,
  prefix-friendly), by id list, and a paged list for People. `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified,
  `LIMIT` inside. `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.
- Same unit of work: `docs/agents/db/DATA_DICTIONARY.md`, `npm run refresh:snapshots`, `check:dictionary`. Apply to dev
  only; prod is a release step (note it in the hand-off, never apply it here).
- Replace all four single-page reads (§4) with the lookup; give the orgs list an explicit, paged read.

**Part 3 · Find.**
- A POST route (body, never the address; `Cache-Control: no-store`; JSON only). First statement: the staff check + power.
  2–120 characters. Groups built per role: Clubs and People for every role; Stripe for Super admin, Billing, Support (A2).
  A hidden group's query is never started. 8 rows per group, best match first, with a total for "N more not listed".
  Stripe numbers match whole only. Staff accounts and the demo sandboxes' orgs are excluded; banned people show, marked.
- Errors on this path map to one fixed sentence before anything logs them; nothing logs the words.
- A per-staff-account limit (key = user id, not IP), documented as a speed bump.
- The strip box, the panel and its eight states exactly as drawn (rest, open-empty with Recent and "You can type",
  results with a person's clubs beneath, a Stripe number, a subscription charge number's sentence, nothing found, too
  many with the list doors, a trimmed role with the foot naming what was searched, the narrow window's glyph). `/` opens,
  ↑ ↓ move, Enter opens, Esc closes and returns focus. Placeholder per role ("Find a club or person" without Stripe).
  Recent = last five records opened, browser storage only, cleared at sign-out.

**Part 4 · The menu by job.**
- Groups and order exactly as the drawings' table; the nine renames rename the page titles too (A7). Founding season moves
  to Customers. Help and Collapse at the foot unchanged. Bookkeeping's group and rule unchanged.
- Folded group = one amber pill, the sum of its rows (A11); the eye and a row's pill in fixed places (eye, then pill).
- Today's icon is a tray; add it to the icon dictionary in `NAV_STANDARD.md` (the house stays Home's).
- `/docs` must follow (the help articles name the old menu and pages).

**Part 5 · Today and Business numbers.**
- Today: the health line (grey dot, "N errors in the last 24 hours", "Builds and the databases are not checked here
  yet", Errors ›), the waiting table grouped Customers / Health / Growth / Product with band totals, zero rows folded into
  a quiet "Clear: …" line, an all-clear group as one band line, the totals line and the Business numbers door. Queues: the
  Action queue's eleven (past due carries "N since your last visit" as its reason) + new errors (error groups first seen
  since the last visit) + new feedback (`status='new'`). Each queue shows only for roles that can open its list. Owner
  inactive reads the lookup, not the 1,000 page.
- Business numbers: Overview's four tabs moved whole, every figure kept. Not in the menu; Today's door opens it.
- Phone: one framed list per group (F-41), the strip with Find as its glyph.

**Part 6 · The club record.**
- Header: back link, name, plan + state chips, pencil, Email the owner, Add a note, help; caption: owner · web name (data
  face) · created. Band: Members (owner's last sign-in), Teams (club bands) or Tournaments first by plan, Renews.
- Story (default tab): one server-paged, newest-first list merging §4's sources, one source per kind (no double rows for
  an override and its audit row). Columns When · What happened (plain bold, not a link) · Who (never breaks) · Why
  ("Not recorded" grey for older rows) · Put it back. Type dropdown + search. The quiet line naming what is not in it yet.
- **One pencil (A6):** the record's facts become fields, only those the role may change (name, web name, plan, limits,
  sections); the tabs step aside; the check mark opens one confirm window (sentence left, Keep editing / Save changes
  right) that lists every change and asks Why*. Each changed field writes its own audit entry with the shared reason.
  Plan and limit changes go through `lib/operator-plan-change.ts` (one rule); sections through the existing addons write.
- **Put it back:** on plan, limit, section and running-override entries only, never on anything that reached Stripe or an
  inbox, absent (not disabled) elsewhere. Prefilled window with Why*; writes a new entry; marks the old one "Put back at …".
- **Reasons from now on:** sections, override ends and cancel-subscription store the reason in `new_value` like plan
  changes. The Stage 3 column is not built here.
- Tabs: Money (plan, state, renews/ends, the Stripe numbers in the data face with Open in Stripe, one line naming what
  Stage 3 adds), Access (plan and limits, sections, overrides running and past, the own web address; rare doors at the end:
  Cancel the subscription (red confirm), Delete the club (super admin, red, typed confirm as today)), People &
  tournaments (members opening the person record with Make owner on a row, tournaments, teams brought in).
- **Read-only (R6):** same record, same toolbar, no pencil, no Put it back, no rare doors, no Add a note, no Email the owner,
  no banner. The section switches stop showing disabled.
- **The trail (A3):** opening a club or person record writes one row (who, when, which, via Find or not), never the words,
  never on the Story. Keep 90 days **by pruning on write**, not a schedule (no new scheduled job). Super admin reads it in
  the Audit log under "Records opened". If the trail needs a table, it is in the same migration as Part 2.

**Part 7 · People and the person record.**
- People: server-paged through the lookup, no cap, rows open the record (A8). The row action menu goes.
- Person record: header (email, chips, pencil for name and email, Send a reset link, Add a note), caption, band (Clubs,
  Last signed in, Account created), tabs Story (audit rows with `field 'user_id'`, `platform_user_notes`, club invitations
  and joins, account created) · Clubs · Account (email, name, how they sign in, confirmed; rare doors Sign out everywhere,
  Ban this person (red confirm), Delete this person (super admin, red, typed confirm)). Every action's window states it
  cannot be taken back when it reaches an inbox.

## 8 · Guards (new unit tests)

1. The lookup function: `has_function_privilege` is false for `anon`, `authenticated`, `public` and true for
   `service_role`; a call with the anon key is refused.
2. Find's route is POST only; its first statement is the staff check; no session, a customer session and a disabled
   staff account get 401/403 with zero data reads.
3. Per-role snapshot: a role without a group's power gets no key and no count, and that group's query is never invoked.
4. No handler under Find reads `req.url` search params; the response sets `no-store`; no log, `captureError` context or
   audit row contains the search words (fixture word grep).
5. Input: 2–120 characters; `%`, `_`, `\` match literally; Stripe ids match whole only; 8 per group enforced in SQL; person
   columns exactly the listed set; staff and demo orgs excluded.
6. Every console API route resolves its role through the one powers list (a scan test, like Stage 1's guards).
   `company-users` GET is super admin only; `plan-config` / `plan-gating` are gone.
7. Billing cannot call any club-identity, ownership, own-address, note or person-action route; Billing can still triage
   feedback.
8. An unconfirmed email never yields a staff context.
9. The menu: group order and names as ruled; every entry's eye agrees with the powers list; Bookkeeping still follows
   `canAccessBookkeeping`; a folded group's pill is the sum of its rows.
10. Put it back is offered only on plan, limit, section and running-override entries.
11. The Story never shows a "Records opened" row.

## 9 · Verify

- `npx next typegen` then `npm run typecheck`; `lint:focused` on changed files; the guards directly with
  `node --import ./tests/ts-resolver.mjs --test <files>`; `check:dictionary`.
- ⚠ `npm test` / `verify:changed` clear `test-results/` for every session: run them only when no other session is
  mid-walk, and say so. Report your reds apart from other sessions' (Bookkeeping and Club Tier work is in flight).
- `check:layout -- --changed` on Today, Clubs & portals, the club record, People, the person record at 1440 and 1024,
  Warm and Dark; the overflow sweep in `.probe/pasc/` if the layout session is stale (Stage 1 lesson). Today at 390.
- Read-only probes only (`.probe/pasc/`, aborts non-GET). Never overwrite `tests/uat/.auth/platform-admin.json`.
- The owner does the browser testing.

## 10 · Hand-off

- **A QA walk as a checkable Artifact**, one purpose: "find any customer from one box and read what happened to them;
  each role sees only what it may". Per role sign-in cards (Super admin, Support, Billing, Growth, Read only) and walk
  tasks 4–12 from the kickoff walk. A matching Owner QA Ledger section; never sort its § numbers.
- **The prod steps** for the release: the migration, then the confirmed-email check. Name them; do not run them.
- **The index:** `stages/s2` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walk's link.
- **Records:** the plan's S2 row and Status, TODO, the PM brief, the auto-memory `project_platform_admin_support_console.md`,
  `NAV_STANDARD.md` (the tray icon, the eye in N9, the folded-group sum).
- **Offers:** `/simplify` then `/review` (high-risk: auth, a new read surface over personal data, a migration with a
  definer function, a shared nav); `/docs` (menu words, Today, Find, the record, People); `/db` for the migration review.
- No commit without the owner's OK.

## 11 · Do not

- Read Stripe, show charges or refunds, search a charge number, or add the audit reason column.
- Record customer purchases in the payment code.
- Build free time, Status, the sent-email log or anything Stage 4–5 draws.
- Change a renamed page's inside.
- Add a scheduled job, or wire anything that runs against production. Apply the migration to prod.
- Put search words in an address, a log line or the trail.
- Change who can open a page beyond the drawings and A1. Anything else is a security change, drawn first.
- Edit the base rules of shared components (ExportMenu, CollapsibleCard, `help.module.css`), or write `[data-admin-kit]`
  selectors in console CSS.
- Touch Bookkeeping's inside.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- the migration + dictionary + snapshots;
- the rulebook and auth changes (A1, confirmed email, closed routes) with their guards;
- Find;
- the menu, Today and Business numbers;
- the records (club, person, People);
- any watched script, in its own commit, with the behaviour named in the message.

## 13 · Context you would otherwise miss

- The drawings' example Story entries are invented; the club, owner, dates and figures are dev's real UAT Lakeshore Lynx.
- Founding Season's desk is read-only by an owner ruling (2026-09-07); it moves group, nothing else.
- Overview's "owner inactive" is 30 days, not the end state's 60.
- `lib/operator-plan-change.ts` is the one plan-change rule (bulk fix 2026-10-24): Put it back on a plan must go through it.
- Club tournaments are a row, not a record. A coaches portal and a tournament host are org-shaped records like a club; the
  band's first figure follows the plan.
- `.probe/pasc/capture-s2.mjs` and `render-s2.mjs` are the drawings' capture and render scripts.
- Open for later stages, ask again where they bear: the production timed-grant switch before Stage 4 (owner checks it);
  the morning check on Status at Stage 5.
