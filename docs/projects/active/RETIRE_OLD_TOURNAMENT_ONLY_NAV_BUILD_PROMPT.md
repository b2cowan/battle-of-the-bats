# Build prompt — Retire the old tournament-only menu, steps 1 and 3: one tournaments-list address, and the typed-only pages sent home

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-20 from the census and the owner's rulings of the
> same day (calls 1–4, then **1R**, which replaced call 1). Plan of record:
> `docs/projects/active/RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md` — its **Census (2026-11-20)** section, the rulings, and
> "Build order". Board line: `navigation` in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`.
> **Model: Opus** (a `proxy.ts` change runs on every request; several pinned guards). Helpers read on Sonnet.

## Scope — what this session is, and is not
- **In:** plan step 1 (the duplicate address `/admin/org/tournaments` becomes a redirect; the page's code moves to its real
  home; the build guard), the two small fixes found on the way (the invitation-declined notice's link; the UAT test that
  visits an address that does not exist), and plan step 3 (the pages a workspace can only reach by typing the address send
  it home).
- **Out — do not start:** plan step 2 under ruling 1R (a Premium coach's tournament-side Staff & access, Audit log and
  Settings retired; name and web address, print options and the deletion request moved into the Coaches Portal). It waits
  for a drawing, `/strategy` (the Premium board seats) and `/legal` (the deletion request). **Leave the old Account group,
  `/admin/org/members`, `/org/members/audit`, `/org/settings` and `/org/settings/pdf` exactly as they are for a Premium
  workspace** — they are its only door to those settings until step 2 gives them a portal home.

## What is true today (census, server HTML on dev 2026-11-20; re-check, don't trust)
- **A Tournament / Tournament Plus organization** never sees the old Account group. Its `/admin/org/*` addresses all
  redirect to `/admin/tournaments` (`app/[orgSlug]/admin/org/layout.tsx:35-36`) — which **drops `?create=1`** on the old
  list address.
- **A running Premium Coaches Portal (one-team workspace, plan `team`)** sees the old group on every non-event admin page,
  including the list it reaches from "Tournaments you run" (`/admin/tournaments/manage`) and the duplicate address.
- **`app/[orgSlug]/admin/tournaments/manage/page.tsx` is one line**, `export { default } from '../../org/tournaments/page';`.
  The real page and its only stylesheet (`tournaments-admin.module.css`, imported by nothing else) live under
  `app/[orgSlug]/admin/org/tournaments/`.
- **Nothing in the product links to the old address** (doors, help, demo tours, UAT all use `/tournaments/manage`). The page
  reads `create` (`org/tournaments/page.tsx:57-60, 84-91`); `source` is typed but never read.
- `proxy.ts:134-149` already holds legacy forwards (`tournaments/teams`, `org/team-links`) built on
  `request.nextUrl.clone()`, which keeps the search.
- **Typed-only pages** that draw a refusal inside the menu for a workspace without the program: `/admin/house-league`,
  `/admin/calendar`, `/admin/schedules`, `/admin/public-site` (both kinds of workspace), and `/admin/org/board`,
  `/admin/org/venues` (a Premium workspace only; a Tournament plan never reaches `/admin/org`). `accounting`, `families` and
  `rep-teams` already send such workspaces away from their layouts (`accounting/layout.tsx:36-37` is the pattern).

## Read first, in this order
1. The plan: Census section (the table, "Debt 1", "Found on the way", "Build order", the rulings and **1R**).
2. `AGENTS.md` (Next 16: `proxy.ts`, never `middleware.ts`; read `node_modules/next/dist/docs/` for anything about
   redirects you are unsure of) and its dev-server restart rule.
3. Code, the hunks you edit: `proxy.ts:120-160`; `app/[orgSlug]/admin/org/tournaments/page.tsx`;
   `app/[orgSlug]/admin/tournaments/manage/page.tsx`; `app/[orgSlug]/admin/org/layout.tsx`; `accounting/layout.tsx`,
   `families/layout.tsx`, `rep-teams/layout.tsx` (the send-away pattern); `lib/coach-portal-request.ts:81-110`
   (`getStandaloneAdminHref` — where a Premium workspace's member lands); `lib/admin-page-help.ts:192-197`;
   `app/api/auth/invitations/[memberId]/route.ts:66-74`; `lib/billing-urls.ts:68-74` (`getMembersHref`).
Broad reading goes to a helper (CLAUDE.md); check its claims against the code before building on them.

## Gate (blocking, before any code)
1. **Each typed-only page's refusal condition**, read from the page itself (a helper lists them with lines): the redirect
   fires on **exactly** the condition under which the page today shows its refusal, **and** only for a Premium workspace or a
   tournament-only organization. A club or league that lacks the program keeps today's screen (it may carry an upgrade
   door). Bring the four conditions back before writing a redirect.
2. **Where "home" is:** a Premium workspace → its Coaches Portal landing (reuse `getStandaloneAdminHref`, or the plain
   `/{org}/coaches` the accounting layout uses — say which and why); a tournament-only organization → `/admin/tournaments`
   (the org layout's own target).
3. Present the **product-manager UX summary** and the task list. No commit without the owner's yes.

## What this session changes
**Step 1 — one address for the tournaments list**
- `app/[orgSlug]/admin/tournaments/manage/page.tsx` becomes the real page (move the file and its stylesheet; fix the header
  comment that says "manage re-exports this"); delete `app/[orgSlug]/admin/org/tournaments/`.
- `proxy.ts`: `/{org}/admin/org/tournaments` (and anything under it) redirects to `/{org}/admin/tournaments/manage`, search
  kept, beside the existing legacy forwards; a 307 as `org/team-links` uses unless you find a reason for 301 (say it).
- Move every path-keyed reference with the file (census "Debt 1" list): `lib/admin-page-help.ts:195-196` (delete the
  old-address branch — `/tournaments/manage` already has its topic) and its test (`admin-page-help.test.ts:131,135`);
  `scripts/layout-screens.mjs:1649` (sweep `/tournaments/manage` instead, or drop the duplicate screen if it already exists);
  `scripts/check-public-tokens.mjs:618`; `scripts/lib/admin-old-look.mjs:24`; the three baselines
  (`scripts/.admin-restyled-baseline.json:106,111`, `.css-selector-baseline.json:33`, `.tsx-token-baseline.json:50`) — re-key,
  don't regenerate the whole file; the tests that read the page by path (`tournament-stage5-create.test.ts:146`,
  `tournament-one-at-a-time.test.ts:110`, `admin-header-bar-guard.test.ts:295`); `admin-tab-title.test.ts:17`;
  `components/admin/TournamentCreationPreview.tsx:91` (comment).
- **A build guard:** a unit test that fails when any source file outside `proxy.ts` and that test names `admin/org/tournaments`.
- **Found on the way 2:** the invitation-declined notice's link uses `getMembersHref(slug, planId)` instead of the
  hard-coded `/admin/org/members` (a Tournament-plan owner currently lands on the Tournaments list).
- **Found on the way 3:** `tests/uat/scenarios/tournament-admin.spec.ts:130-133` visits `/tournaments/settings/organization`,
  which does not exist; point it at a real Settings & access page and assert something that would fail on a 404.

**Step 3 — the typed-only pages send the workspace home**
- `/admin/house-league`, `/admin/calendar`, `/admin/schedules`, `/admin/public-site`: a server-side send-away (a layout, the
  accounting pattern) on the gate's conditions, for a Premium workspace or a tournament-only organization.
- `/admin/org/board`, `/admin/org/venues`: a Premium workspace goes to its Coaches Portal (1R: no Staff & access to land on).
- Unit tests for each: the two workspace kinds redirect; a club and a league are untouched.

## Gotchas
- **Do not touch** the old Account group, the team-workspace exemption in `useAdminKitNav.ts:37-44`, or any `/admin/org/*`
  page other than `tournaments`, `board` and `venues` — step 2 owns them (see Scope).
- **`.claude/settings.json:111` names the old folder's stylesheet** in a permission line. It is shared automation
  (`WATCHED_PATHS`): leave it, and say in the hand-off that it now points at a file that no longer exists.
- **Typed routes:** run `npx next typegen` after moving the page before trusting `npm run typecheck`.
- `proxy.ts` changing, files added and deleted → **restart the dev server at hand-off** (AGENTS.md: stop it before deleting
  `.next`). Do not restart a server another session started mid-work; batch it to the end.
- `?create=1` must still open the setup wizard after the redirect, including from a Tournament-plan organization (today it
  is lost there). Check it from the server's response (`Location` keeps the search), not by reading the code.
- A layout redirect does not see `searchParams`; the proxy forwards the search as `x-search` if you ever need it
  (`tournaments/settings/club-home.tsx` shows the pattern). The typed-only pages carry no search worth keeping.
- `npm run verify:changed` on what you touched; `npm run typecheck` (shared route and proxy behaviour); the unit tests for
  every file above; `npm run check:layout -- --changed` for the list page on the dev server (not a whole-product sweep).

## Steps
1. Gate (above). Wait for the owner.
2. Step 1: move the page, the proxy redirect, the path-keyed references, the guard, the two fixes. Unit tests green.
3. Step 3: the send-aways and their tests.
4. Prove it on the dev server from the server's response, signed in as UAT Test Org's owner (Tournament plan) and UAT
   Standalone's owner (a running Premium workspace; `.probe/retire-nav-census/html.mjs` signs in without a browser):
   the old address answers a redirect to `/tournaments/manage` with `?create=1&source=x` intact for both; each typed-only page
   redirects home for both; a club owner's `/admin/house-league` and `/admin/calendar` are unchanged.
5. `/review` on the diff (proxy and route behaviour = substantive). Offer `/docs` only if a help article changes (expected:
   none besides the page-help branch).
6. Record: the plan's "Build order" marks steps 1 and 3 built with the commit hash; the board's navigation line moves on to
   step 2's drawing. No walk of its own: its checks join the project's one closing walk (plan step 4).
7. Restart the dev server; hand off with what to look at, in product-owner words. No commit without the owner's yes.

## Done when
- One address for the tournaments list; the old one redirects with its search, for every kind of workspace.
- A build guard fails on a new link to the old address.
- The typed-only pages no longer show a refusal inside the menu for a Premium workspace or a tournament-only organization;
  clubs and leagues are unchanged.
- The invitation-declined notice opens Members on every plan; the UAT test checks a real page.
- The old Account group and the Premium workspace's `/admin/org` settings pages are exactly as they were (step 2's).
