# Prompt — Board Ready Wave 1 · A: the third access sweep (report-only)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10. Plan of record:
> `docs/projects/active/BOARD_READY_PLAN.md` (§2 row 1, §3 first bullet, §5 Stage 0a, §7b step 1). Index:
> `BOARD_READY_PROMPTS_INDEX.md`.

## Why this exists
A real club board asked, *"does our data leak, and is it ever sold to vendors?"* The board pack (Stage 0c) will answer
that in writing, and it must be true. The last full access sweep was **2026-10-16** (second sweep, fixed in `b15b01fea`
and `4d0cb0fe`, on production). Since then house league, families, the family app, club money, the bank check, the
scheduler, permits, the club's public pages and pay links have all grown. Nothing has proven they don't leak.

This session **finds and reports**. It does not fix. Each serious finding is fixed afterwards with the owner's go, as
its own commit (CLAUDE.md "a check is report-only").

## Read first
1. `docs/projects/active/TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md`, the whole of § Second sweep. It covers the bug classes found last
   time and how they were proven:
   - a service-role client trusting ids from the request with no organization check;
   - request text interpolated into a PostgREST `.or()` filter;
   - "is a member" standing in for "may open this area";
   - pending invites counted as members;
   - public pages skipping the status and visibility checks other public pages apply.
2. The Club Tier Stage 0 security sweep record (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, search "Stage 0" and "I01",
   "F07") for the earlier tenant-boundary findings.
3. `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` (~L155): routes run service-role; the route is the enforcement layer.
4. The seats: `lib/types.ts` (member roles), `lib/board-roles.ts`, `lib/coach-capabilities.ts`, the staff and
   capability rules in memory `project_coach_staff_access_review.md`.

Broad reading goes to helpers (CLAUDE.md). A helper's finding is a lead. **Re-read every serious finding in the code
yourself before recording it.**

## Scope
Everything **added or changed since 2026-10-16** under `app/api/`, `app/[orgSlug]/`, `app/(public)` or other public trees,
`lib/` server code and `proxy.ts`. Get the list from `git log --since=2026-10-16 --name-only` and `git diff
b15b01fea..HEAD --stat`, not from a plan. Reads as well as writes, anonymous and signed-in. Split into parallel helper
areas (one message, in parallel):
- house league (sign-up, registrations, draft, placement, team pages, coach links and feeds);
- families and the family app (guardian tier, "Your sign-up" pages, pay links, unsubscribe, consents);
- club money (books, bank check, budgets, payouts, Stripe Connect routes, webhooks);
- scheduler, permits and venues;
- the club's public pages, sponsors and logos, and the public tournament pages changed since 10-16;
- the Coaches Portal routes changed since 10-16;
- platform admin, the support console, cron routes and the demo sandboxes;
- file storage: every bucket, its policies, and every route that hands out a signed link.

For each route the question is the same: **who can reach it, and does it check the organization, the seat, and the
object's owner on the server?** Tenant boundary first, seat second, then status and visibility for public reads.

## Proving
Prove a suspected serious finding on **dev only** with a probe. Use password sign-in plus the hand-built session cookie
(memory `reference_probe_signin_without_browser.md`). Scripts live in `.probe/`. Never run a probe against production and
never write to production. Don't seed while the dev server is in use by another session.

## Output
1. A new report doc, `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md`:
   - findings ranked most-serious first;
   - each with route and line, who can exploit it, what they get, a one-line exploit, proven or not, and the recommended fix.
2. **A seat-by-seat "who sees what" table.** For each seat (owner, admin, treasurer, registrar, league admin, staff,
   official, coach/staff capabilities, family, anonymous), list what personal information it can read. This table goes
   straight into the board pack, so write it plainly.
3. A one-line `TODO.md` entry per serious finding, linking the report.
4. A truth-up of the **🔒 lines already in `TODO.md`**. Check each against its detail record and `git merge-base
   --is-ancestor <hash> origin/master`. Archive the ones already fixed and on production
   (`docs/projects/archive/TODO_COMPLETED_ARCHIVE.md`), with the commit hash. Two were found stale on 2026-11-10, so expect more.
5. Update `BOARD_READY_PLAN.md` §5 Stage 0a with the report link and the count of findings.
6. A product-owner summary for the owner: what leaks today (if anything), who could reach it, and the recommended fix
   order. Then ask for the go on fixes.

## Standing rules
- Branch `dev`. Stage explicit paths only, never `git add -A`. Shared files (TODO.md, the archive) carry other sessions'
  hunks, so commit them through a private index (memory `reference_partial_commit_shared_tree.md`).
- **No commit without the owner's yes.** No fixes in this session unless the owner says so after the report.
- Do not change hooks, settings, database checks or anything that runs by itself (AGENCY_RULES, 2026-09-26).
