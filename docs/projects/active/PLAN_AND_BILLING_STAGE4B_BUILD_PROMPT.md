# Plan & billing · Stage 4b · Part 1: the workspace flip (build prompt)

> **Written 2026-10-30.** Paste into a new Codex chat on `dev`. **Re-verify every lead before building on it**: they were read in the code
> on 2026-10-30, and code moves. This prompt is **Part 1 of four** in `PLAN_AND_BILLING_STAGE4B_PLAN.md` (§4). It is server-only and ships
> **dark**: nothing calls it until Part 2 adds the move. Parts 2-4 each get their own prompt, written when the part before lands. Stop at
> this part's boundary even if you have room left.
>
> Read first, in this order: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`; then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`;
> then **`PLAN_AND_BILLING_STAGE4B_PLAN.md` in full** (§3.1-§3.2 are your spec; §5 is what you propose before building; §6 is your test
> contract); then the top entry of `docs/agents/strategy/BUSINESS_DECISIONS.md` (the "WORKSPACE FLIP" handoff); then the code named below.
>
> **Other sessions share this working copy.** Stage explicit paths only, commit only your own hunks, **ask the owner before each commit** (an
> earlier yes does not carry over), never push, run `git show --stat HEAD` after every commit. The branch is `dev`.
>
> **Recommended model: Opus 5.5** (a data change on money-adjacent records, one shared-module consolidation). Helpers stay on Sonnet; use
> them for broad reading (the census), and open every line a decision turns on yourself.
>
> **Database rule.** Write the migration file. **Do not apply it to any database**, and never to production. Ask the owner how it reaches
> dev before you try. Prod waits for the release.

## What this part makes true

A workspace that is a coach's standalone Coaches Portal can be turned into a club **in place** by one server step, in one database
transaction, repeatable without harm. After it runs, **no coach-portal behaviour survives on that organization**: it is no longer hidden
from the directory, its billing link is the club's, a later cancellation runs the Club path and the Club email (never the portal's), the
portal's free-time and Keep Premium readers no longer pick it up, and the coach's team, roles and web address are untouched. No screen
changes in this part, and no existing screen is allowed to change.

## What you may not do

Change prices, plan names, gates or `lib/plan-config.ts`; build any screen, route a user can reach, or the move itself (Part 2); add a
way back down to Premium; touch the Founding offer; delete the `team_workspaces` row; apply any migration; edit hooks, settings or
shared check scripts (owner's 2026-09-26 ruling: only on his word, in their own commit). Do not "tidy" anything the plan does not name.

## Rulings already made (owner, 2026-10-30; plan §5; do not reopen, record nothing they did not rule)

(1) `is_discoverable` **stays false** after the flip until the coach opts in. (2) The six hand-copied portal tests are **replaced by
`isTeamWorkspaceOrg`**: do it, and show the exact hunks in your report. (3) The hook lives **inside `applyPlanChangeSideEffects`**. (4) The old
365-day retention rows from an earlier cancellation are **left alone and reported**. (5) The email-audience question is **dropped**: the owner
said Founding Season is being deprecated soon, so do not investigate or change the Founding audience filter. Nothing else about the Founding
offer is ruled; leave its rules and the comp-ending behaviour as they are.

Everything else in this part is specified below. If the code contradicts the spec (a column that is not there, a reader the plan did not
name), **stop and say so in your first message** rather than choosing.

## The work

1. **The RPC** (a new migration; the next free number, today's newest is 413, so check): `flip_workspace_into_club(p_org_id, p_plan,
   p_club_name)` in plpgsql, **a sibling of the bridge's `move_team_into_club`** (`supabase/migrations/313_*`, current body in `351_*`).
   Copy its shape: `FOR UPDATE` on the rows it writes; every write in one transaction; idempotent (if `account_kind` is already
   `'organization'`, return "already flipped" and write nothing); one `org_audit_log` row in the same transaction; `service_role` only.
   It refuses, by named exception, when the org is not a coach workspace, when the target plan is not a Club plan, or when the
   organization has no settled paid Club subscription **or** (free-time start) a started Club trial (mirror `NOT_SETTLED` in
   `lib/portal-keep-premium.ts:122-125`). It does **not** need the bridge's "other teams" or "open tournament" refusals (same org, nothing
   moves), but it should refuse and report if the workspace holds more than one team, so a surprise is visible.
   It sets exactly what plan §3.2 lists: `account_kind='organization'`; `team_workspace_status=NULL`; `plan_id`; `tournament_limit` from
   `PLAN_CONFIG`; `name` to `p_club_name` when given (NULL keeps today's); clears `billing_suspended_*`; tombstones the `team_workspaces`
   row (`workspace_state='org_owned'`, `billing_mode='club_included'`, `stripe_*` NULL, keep `rep_team_id` and `primary_owner_user_id`);
   ends the `team_entitlements` row (`status='cancelled'`, `ends_at=now`); revokes the staff-given free-time grant (`org_overrides`,
   `revoked_at`) with its audit entry (reuse `lib/portal-keep-premium.ts:185-205`, do not re-invent); revokes open `team_org_links`
   rows; strips the workspace-only staff grants `tournaments` and `registerTournaments` (`WORKSPACE_ONLY_GRANTS`,
   `lib/coach-capabilities.ts:~915`) **from every place they are stored**: `rep_team_staff_memberships.capabilities`, the
   `rep_team_coaches` projection, `organization_members.capabilities`, and pending staff-invite `initialCapabilities`
   (`lib/coach-membership.ts:~869-899`). It leaves `slug`, `team_limit`, `free_floor`, the org's billing columns, the owner and
   head-coach memberships and the `basic_coach_teams` shadow alone. **Do not copy the bridge's "canceled + cleared ids"** for the org
   itself: a free-time coach starts as stored `canceled`, held open by an override grant, and the Club subscription writes the real status.
2. **The TypeScript wrapper**, in the style of the bridge's (`lib/team-ownership-transfer.ts:~514-530` for the refusal matching,
   `:594-637` for what the app does after commit). Return named refusals, never a thrown string. No Stripe call lives in the RPC.
3. **The hook.** Call the wrapper from the one place every entry meets: `applyPlanChangeSideEffects` (`lib/plan-move.ts:~223-256`), which the
   move apply, the webhook subscription arm (`app/api/billing/webhook/route.ts:~454`) and the operator route all call; add the mock
   checkout's direct plan write (`create-checkout/route.ts:~140-150`). It must be safe to call twice and safe when the org is not a
   workspace (a club-to-club move calls the same function). **Nothing can reach it yet** because no `team → club` move exists.
4. **The consolidation** (ruled): replace the hand-copied portal tests in `lib/api-auth.ts:145`,
   `lib/db.ts:~4170`, `lib/free-time.ts:383`, `lib/org-membership-policy.ts:34`, `lib/team-org-links.ts:402` and
   `lib/founding-season-desk.ts:180` with `isTeamWorkspaceOrg` from `lib/team-workspace-kind.ts` (a one-line adapter where a row is
   snake_case). Behaviour must be byte-identical for every existing fixture; run the full set of portal tests before and after.
5. **The census.** With a helper, list every file that reads `account_kind`, `isTeamWorkspaceOrg` or `team_workspaces.stripe_subscription_id`
   (about 90 files; plan §3.1 groups them) and decide for each: *correct after the flip*, *needs a change* (do it, smallest hunk), or
   *portal-only by design* (allowlist with a reason). **Anything the flip leaves portal-ish that is not on the allowlist is a finding.**
   `tests/unit/plan-reader-door-guard.test.ts` keeps an allowlist of files that name `plan_id`; the new module goes on it with its reason.
6. **The guard test** `tests/unit/workspace-flip-guard.test.ts`, the two layers in plan §6, plus: the flip is idempotent; a late event
   carrying the old Premium price after the flip is a no-op; a Club cancellation after the flip takes the Club path (the portal
   retention window and email are never chosen); `free_floor` and `team_limit` stay NULL; the six consolidated places agree for every
   fixture. Copy the pattern of `tests/unit/team-move-coverage.test.ts` (it reads the schema snapshot and the RPC source) and
   `tests/unit/support-console-stage4b-inforce-guard.test.ts`.
7. **Schema = dictionary, same unit of work:** `docs/agents/db/DATA_DICTIONARY.md` gains the flip (and anything it changes about
   `team_workspace_status`, `workspace_state`, `billing_mode`); run `npm run refresh:snapshots`; `npm run check:dictionary` passes.

## Checks (focused, serial; report anything skipped)

`npm run verify:changed` and the focused tests for every file you touched; `npm run typecheck` (shared modules changed); the portal,
billing and free-time test families named in plan §3.1 before and after; `npm run check:spelling`. Do not restart the dev server for
this part (no screen changed); say so. **Do not run a browser or any Stripe call.**

## Report back (your final message)

What you proved, how (tests that fail without the change); the census result (counts, the allowlist, every finding); what the migration
does, its number, and that it is **not applied anywhere**; the exact consolidation hunks; anything in the shipped code that
looked wrong, listed and **not** fixed; what you could not verify (live Stripe, a real workspace, client-side org caches after a flip).
Tag every statement about the product **[saw in code]**, **[from the plan]** or **[my guess]**. Then offer `/review` (this is a
substantive, shared-module, money-adjacent change) and, if you added a helper or touched the six shared files, `/simplify` first. Name the
exact files you want to commit and wait for his yes. **Stop. Part 2 (the money) has its own prompt.**
