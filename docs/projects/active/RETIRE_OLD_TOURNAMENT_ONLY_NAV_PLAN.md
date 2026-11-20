# Retire the old tournament-only menu and the duplicate tournaments-list address

**Status:** on the board (Owner Morning Brief).
**History (not kept current):** NOTE ONLY — nothing built. Opened 2026-10-30 (owner, during the Plan & billing Stage 3 walk, step 2).
**Why this exists:** the owner ruled the account-level menu ("Tournaments" row + "Account" group: Staff & access,
Audit log, Settings, PDF settings) is **an old nav the product no longer navigates to**, and asked for it to be
retired so nobody builds a link to it again.

## What happened (the mistake this note prevents)

The Stage 3 "Tournaments you run" door, and the older "host a tournament" buttons in the coaches portal, pointed at
`/{org}/admin/org/tournaments`. That address renders the same page as `/{org}/admin/tournaments/manage`
(`tournaments/manage/page.tsx` re-exports it), but the menu decides "am I inside the tournaments area?" from the
address starting with `/admin/tournaments`. So the duplicate address fell through to the old account-level menu
instead of the tournament menu (Operations / Setup / Admin). Fixed 2026-10-30: all three coach doors now use
`/admin/tournaments/manage`; the unit tests and the coach-wall-doors UAT scenario were moved with them.

## Two pieces of debt

1. **The duplicate address `/admin/org/tournaments`.** Make `/admin/tournaments/manage` the page's real home, turn
   the old address into a redirect (keeping `?create=1` and `source=`), and update the places that still name the
   old path: the page's own header comment, the layout-sweep screen list, the old-look and public-token checks that
   list the page's folder, and the two tests that read the page file by path.
2. **The account-level menu for a tournament-only workspace** (the `tournamentOnly` branch of the desktop rail and
   its phone-bar counterpart). Retire it once nothing lands on it. **Census 2026-11-20: a Tournament plan no longer
   reaches it and the phone counterpart is already gone; it is now a one-team workspace's (Premium Coaches Portal) only
   staff-and-settings menu — see the census.**

## First step when this is picked up — a census, not a build

Find every page that still renders under the account-level menu for a tournament-only or standalone-team
workspace. Suspects (unverified): the Admin hub, `/admin/org` and its Staff & access, Audit log, Settings and PDF
settings pages, and billing. Each needs a home inside the tournament menu (or the coaches portal) **before** the
old menu can go. Do not delete the menu first: that would strand whichever of those pages turns out to depend on it.

### Census (2026-11-20) — done; the four owner calls ruled the same day (below)

Method: two read-only helpers (the menu's gate and every route into it; every inbound link, redirect, help article and demo
anchor), the cited lines re-read in the main session, then the dev server's **server HTML** fetched as a signed-in owner
(`.probe/retire-nav-census/html.mjs`, no browser): UAT Test Org (Tournament plan) and UAT Standalone (a paid one-team
workspace, plan `team`). Nothing changed in code.

#### ⚠ The note's premise is half wrong

- **(a) A Tournament / Tournament Plus organization never sees the old menu any more.** Navigation Phase 2 Part B (E3,
  2026-11-10/11) emptied its organization links (`useAdminKitNav.ts:44`: `isTournamentTier && !isTeamWorkspace ? []`), so
  the Account group's condition (`AdminKitRail.tsx:298`, `tournamentOnly && orgLinks.length > 0`) is false for it, and its
  `/admin/org/*` addresses all redirect to `/admin/tournaments` (`org/layout.tsx:35-36`). Server HTML confirms: its hub, list,
  house-league and notifications pages draw the short sidebar *cell · Tournaments · Settings & access · Plan & billing*;
  `settings/members` and `settings/pdf` draw the event's sidebar with Settings & access in the foot. **For this kind of
  workspace the menu is already retired.**
- **(b) It is now the Premium Coaches Portal's staff-and-settings menu, and it is live.** A one-team workspace (plan `team`)
  carries only the tournament tools, so it is "tournament-only" (`module-entitlements.ts:63-65`, `plan-config.ts:28-41`), and
  it is exempt from the emptying (`useAdminKitNav.ts:37-44`, "it keeps /admin/org (staff and access)"). Server HTML
  confirms the sidebar *cell · Tournaments · **Account:** Staff & access · Audit log · Settings · PDF settings · Plan &
  billing · Coaches Portal*. This was deliberate: the Plan & billing Stage 3 build prompt says **"Do not redirect
  `/admin/org/tournaments`, `/admin/tournaments/**`, `/admin/org/members`, the audit log, org settings or PDF settings for a
  team workspace: they are the hosted-tournament shell, now reached from the portal"**
  (`PLAN_AND_BILLING_STAGE3_BUILD_PROMPT.md:94`), and the coaches' help tells owners to manage tournament staff from
  "Staff & access, in the sidebar's list on the Tournaments page" (`lib/help-content/coaches.tsx:1119, 5941`).
- **So "an old nav the product no longer navigates to" is not true; "a second menu shape nobody drew" is.** The team
  workspace's organization pages have **no tab row** (`OrgFrame.tsx:29-32`: "a one-team workspace has none"), so the Account
  group is the only way between them on a computer. Deleting it strands four pages. The work is not deletion; it is giving
  the Premium coach's tournament side the shape E3 gave a Tournament plan.
- **The phone needs nothing.** The Account group left the phone on 2026-11-06 (`403341b71`); the team workspace's More
  sheet keeps a "Settings & access" row (`kit-tournament-groups.ts:51`) that reaches `/tournaments/settings` →
  `/admin/org` → the first tab (`club-home.tsx` `openClubHome`, `org/page.tsx` TabsDoor).
- **Who reaches it:** the Coaches Portal's **Tournaments you run** door (`lib/coach-billing-access.ts:38-41`,
  `CoachHostedTournamentsSection.tsx:46`, `coaches/teams/[teamId]/tournaments/page.tsx:136`) → `/admin/tournaments/manage`,
  which draws the Account group; and sign-in / the retired hub for a member with the tournament grant and no team
  (`lib/coach-portal-request.ts:81-110`). Only for a **running** Premium portal: an ended one (`subscription_status =
  canceled`, 4 of 6 on dev) gets the cancelled-account page and no sidebar (`AdminChrome.tsx`), and a free coach is a
  `basic_coach_teams` row, not a workspace. Deep links that land a team workspace there: the Staff kit's invite button
  (`staff-kit/page.tsx:109`, `getMembersHref`), Event settings' web address (`settings/event/page.tsx:917`,
  `getWebAddressHref`), the Payouts status line and payout notices (`payoutsPath` → `/org/settings#payouts`).

#### Pages under the old menu (a running one-team workspace; server HTML 2026-11-20)

| Page | How it is reached | Proposed home | Why |
|---|---|---|---|
| Tournaments list `/admin/tournaments/manage` | Coaches Portal "Tournaments you run"; sign-in for a staff member with no team | Keeps its page; wears E3's short sidebar (*Tournaments · Settings & access*) | The list is the shell's front door; only its sidebar is wrong |
| Duplicate list `/admin/org/tournaments` | Nothing links to it (typed or old bookmark) | **Redirect** to `/admin/tournaments/manage`, search kept | Debt 1 below |
| Staff & access `/admin/org/members` | Account group; phone More → Settings & access; Staff kit invite | First tab of the workspace's **Settings & access** | Same job as a Tournament plan's Members tab |
| Audit log `/admin/org/members/audit` | Account group (owner); a link on Staff & access | Reached from Staff & access, as on a Tournament plan (`MembersKit.tsx:169-171`) — not a tab | E3 drew it that way; one rule for both kinds |
| Settings `/admin/org/settings` | Account group (owner, admin); web-address and payout links | A **Settings** tab of Settings & access, cards unchanged | It holds five cards — details, birthday cutoff, two-step requirement, payouts, delete — that the Tournament plan's tabs do not (see "Found on the way") |
| PDF settings `/admin/org/settings/pdf` | Account group | A tab of Settings & access | Same as a Tournament plan |
| `/admin/org` | Phone row; typed | Unchanged: the door to the first tab | Already does this |
| The board `/admin/org/board` | Typed only (not a tab for a team workspace, `admin-kit-nav.ts:1120`) | **Retire it** for a team workspace (redirect to Staff & access) | A club's concept; its staff page is its own |
| Venue library `/admin/org/venues` | Typed only (the plan has no library; the page still renders for the owner) | **Retire it** for a team workspace (redirect to Staff & access) | Not on the plan; no door |
| House league, Calendar, Schedules, Public site (`/admin/house-league`, `/calendar`, `/schedules`, `/public-site`) | Typed only | **Retire it**: redirect a team workspace to the Coaches Portal (as `accounting`, `families`, `rep-teams` already do) and a Tournament plan to `/admin/tournaments` | They draw a refusal inside the menu; the same gap exists on a Tournament plan |
| Notifications `/admin/notifications` | The phone's Notifications row | Unchanged; wears the short sidebar once the group goes | A real page; not stranded |
| Plan & billing, hub, onboarding | — | No change | Already redirect to `/coaches/billing` and `/coaches` (`org/billing/page.tsx:16-19`, `admin/page.tsx:6`) |

#### Debt 1, the duplicate address — every place that still names it

Nothing in the product links, pushes or redirects to it (help, demo tours, UAT and the coach doors all use
`/tournaments/manage`; the help content already links `../tournaments/manage`). It behaves three ways today: a club renders
it inside the Organization frame; a Tournament plan is sent to `/admin/tournaments` by the org layout, **dropping
`?create=1`**; a team workspace renders it under the old menu. Remaining names, all of which move with the page file:

- `app/[orgSlug]/admin/tournaments/manage/page.tsx:1` (the re-export — becomes the real file);
  `app/[orgSlug]/admin/org/tournaments/page.tsx:26-27` (header comment); `components/admin/TournamentCreationPreview.tsx:91` (comment)
- `lib/admin-page-help.ts:195-196` (the "?" topic for the old address only) and its test `tests/unit/admin-page-help.test.ts:131,135`
- `scripts/layout-screens.mjs:1649` (sweeps the old address); `scripts/check-public-tokens.mjs:618` (RESTYLED_DIRS);
  `scripts/lib/admin-old-look.mjs:24` (OWNERS); baselines `scripts/.admin-restyled-baseline.json:106,111`,
  `scripts/.css-selector-baseline.json:33`, `scripts/.tsx-token-baseline.json:50`
- tests reading the file by path: `tournament-stage5-create.test.ts:146`, `tournament-one-at-a-time.test.ts:110`,
  `admin-header-bar-guard.test.ts:295`; `admin-tab-title.test.ts:17` (tab title for that address)
- `.claude/settings.json:111` (a permission allowlist line naming the folder's CSS — shared automation; leave it unless the
  owner asks)
- docs: `PLAN_AND_BILLING_STAGE3_BUILD_PROMPT.md:21,73,88,94,108`, `COACH_TOURNAMENT_DELEGATION_PLAN.md:26,97,249`,
  `ADMIN_HEADER_BAR_PLAN.md:147`, `ADMIN_HEADER_BAR_PHASE3_BUILD_PROMPT.md:48,87` (historical; the Stage 3 line 94 gets an
  amendment note, since its reason — the portal's door — now uses `/tournaments/manage`)

**Is a redirect all it needs?** For behaviour, yes. The page reads `create` (`org/tournaments/page.tsx:57-60, 84-91`);
`source` is typed but never read (the analytics source travels as `acquisitionSource`). A redirect in `proxy.ts` beside the
existing legacy forwards (`:134-149`) keeps the whole search for free (`request.nextUrl.clone()`), covers client navigation
(the 2026-11-10 note: a layout redirect misses it), and is not a watched automation path. To *finish* the debt it also
needs the page code to live at `tournaments/manage`, the path-keyed lists, baselines and tests above moved with it, the
old-address help branch deleted, and the build guard from "Done when". `proxy.ts` changing means a dev-server restart at
hand-off.

#### Found on the way (not this note's; recorded so they are not lost)

1. **A Tournament-plan organization has no page to rename itself, require two-step sign-in, set the birthday cutoff, or
   delete the organization.** Those cards live only on `/admin/org/settings` (`SettingsKit.tsx`), which its org layout
   redirects away; the Settings & access tabs (Members · Payouts · PDF settings · Web address) carry none of them, and no
   tournament page does (searched `app/[orgSlug]/admin/tournaments/settings/`). E3 was drawn with shipped rows only, so
   this gap predates it. → owner call 4.
2. **The "invitation declined" notice links to `/admin/org/members`** (`app/api/auth/invitations/[memberId]/route.ts:71`),
   so on a Tournament plan it opens the Tournaments list, not Members. One-line fix with `getMembersHref`.
3. **A UAT test visits an address that does not exist** (`tests/uat/scenarios/tournament-admin.spec.ts:130-133`,
   `/tournaments/settings/organization`) and checks only that a page area shows, so it guards nothing.
4. The coaches' help (`coaches.tsx:1119, 5941`) describes the Account list as the way to Staff & access; it changes with
   step 2 (`/docs`).

#### Build order (by dependency and rework risk)

**Build prompt for steps 1 and 3** (written 2026-11-20, the owner's request): `RETIRE_OLD_TOURNAMENT_ONLY_NAV_BUILD_PROMPT.md`.
Step 2 starts with its drawing, not a build prompt.

**✅ Steps 1 and 3 BUILT 2026-11-20** (owner go "yes, build it", same day), reviewed (`/review`, four lenses, no
Critical/High; the Low fixes applied), proved on the dev server from the server's response; committed `f9d1b4507` 2026-11-20 on the owner's word ("commit"). What was
built and the gate's findings:
- **Step 1.** The page lives at `admin/tournaments/manage/` (the old folder deleted); `proxy.ts` forwards
  `/{org}/admin/org/tournaments[/…]` → `/{org}/admin/tournaments/manage`, 307, search kept (measured: `?create=1&source=x`
  survives for the Tournament plan, a Premium workspace and a club). Path-keyed lists, baselines, sweep screen
  (`admin-tournaments-list`) and tests re-pointed; the old-address help branch deleted. Guard:
  `tests/unit/tournaments-list-one-address-guard.test.ts` (any built form of `org/tournaments` outside `proxy.ts`).
  Found on the way 2: the declined notice links via `getMembersHref` on the plan right now (`effectiveOrgFactsForId`, a
  failed read falls back to the Organization's Members). Found on the way 3: the UAT test visits Settings & access › PDF
  settings and checks the status, the place's heading and the lit tab (passes).
- **Step 3.** One rule, `lib/typed-only-pages.ts`, asked by each page's layout through
  `redirectWorkspaceWithoutProgram` (`lib/coach-portal-request.ts`): a Premium workspace → its sign-in landing
  (`getStandaloneAdminHref`: the portal, or the tournaments list for a staff member with the tournament grant and no team —
  never the portal's no-team wall); a Tournament / Tournament Plus organization → `/admin/tournaments`. Clubs and leagues
  never. **The gate found two pages that were not refusals** for a Premium workspace: the Calendar (a working, doorless
  calendar of its tournament) and the board (no gate at all). Calendar: owner 2026-11-20, "send Premium home too"; the
  board as ruled. Both fire only while the plan carries nothing beyond the tournament tools (a workspace whose plan grows
  keeps them — `/review` finding). The Tournament plan's Calendar used to say a bare "Forbidden"; it now sends home.
- `.claude/settings.json:111` still names the old folder's stylesheet in a permission line (shared automation — left as
  is; it now points at a file that no longer exists).

1. **The duplicate address** — no owner call needed (the note already rules it): page code home at `tournaments/manage`,
   the `proxy.ts` redirect, the path-keyed references, the delete of the old help branch, a unit guard against a new link to
   `/admin/org/tournaments`. Fold in found-on-the-way 2 and 3. Independent of everything else; smallest; do it first.
2. **⚖ Replaced by 1R (2026-11-20):** step 2 is now (a) the drawing of the portal additions, (b) `/strategy` on the
   Premium board seats and `/legal` on the deletion request's wording — (a) and the `/legal` review are shared with
   [TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md](TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md) Stages 1–2, one drawing for both
   workspaces — (c) the portal's three settings built, (d) the old
   Account group, the tournament side's Staff & access / Audit log / Settings for a Premium workspace, and the two-step
   switch retired, with redirects for their old addresses (the coaches' help rewritten with `/docs`). The text below is
   the step as it stood under call 1, kept for the record.
   *(Superseded)* **The team workspace's Settings & access** (after call 1, plus a drawing if call 2 says so): the sidebar row in place of
   the Account group, a tab row on its organization pages (Staff & access · Settings · PDF settings; Audit log from Staff &
   access), the branch at `AdminKitRail.tsx:298-308` and the team-workspace exemption at `useAdminKitNav.ts:37-44` reviewed
   for deletion, the coaches' help rewritten, the unit tests, `check:layout --changed` on the touched screens. The
   phone is untouched. Depends on step 1 only in that both touch the list page's sidebar — doing 1 first means 2's layout
   check sees one address.
3. **The typed-only pages** (after call 3): redirects for the board, venue library, house league, calendar, schedules and
   public site. Independent of 2; after 2 so its redirects land on the finished shape.
4. **The guard and the close**: a unit test that no non-event admin page draws an "Account" group; one walk (`/tasks`)
   covering a Premium coach on a computer and a phone, and a Tournament-plan owner's list with `?create=1`.

The Tournament plan's missing settings (call 4) is a separate item whatever is ruled; if it is built, it shares step 2's
drawing so both kinds of workspace end on one Settings & access shape. **Opened 2026-11-20:**
[TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md](TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md) — its Stage 1 is step 2a's drawing
(one session for both workspaces) and its Stage 2 shares step 2b's `/legal` review of the deletion request.

#### Owner calls — ⚖ RULED 2026-11-20 (owner, in conversation: "1 yes, 2 yes, i am not asking you to change but I need to visualize what you are talking about here, 3 yes, 4 yes")

- ~~**1 · Yes** — a running Premium Coaches Portal gets the Tournament plan's Settings & access row and tab row, on its
  existing `/admin/org/*` addresses.~~ **REPLACED the same day by 1R below**, after the owner looked at the picture.
- **2 · Yes** — no new mockup session. The owner asked to **see** what step 2 means: a picture of today versus after,
  published as an artifact to look at, not a drawing for approval. (Overtaken by 1R: the picture was redrawn as 1R's
  portal settings, and 1R's portal additions are a new surface that needs its own drawing.)
- **3 · Yes** — redirect the typed-only pages away, in this project (step 3).
- **4 · Yes** — the Tournament plan's missing settings (rename, two-step requirement, birthday cutoff, delete) become
  their own board item, drawn together with step 2, routed through `/plan`. The item is not opened yet.

No build go was given with these rulings; the census was committed on the owner's word.

#### ⚖ 1R · RULED 2026-11-20 (owner, "yes, record it and redraw the picture") — replaces call 1

**Why call 1 was reopened.** Looking at the picture, the owner asked four questions: should a coach who is only running
a tournament be able to delete the organization there ("one delete home, and for a coach it should be in their own
portal"); are payouts even on the plan; is two-step management overhead; and does a coach need a second staff list
("2 places to manage users doesn't seem like good ux"). Read in the code (`Explore` helper, cited lines re-read), the
answers undid call 1:

- **Delete organization** only emails a deletion request to support (`app/api/admin/org/request-deletion/route.ts:19-48`,
  owner only, no plan check). The Coaches Portal has "Cancel Premium…" on its billing page
  (`components/billing/BillingBody.tsx:471-478`) and no deletion request; the tournament side's Settings was its only door.
- **Payouts:** online payments start at Tournament Plus; the free Tournament plan and Premium (`team`) are excluded
  (`lib/plan-features.ts:72-79, 159-161`). The Payouts card was already absent for a Premium coach; the first picture drew
  it by mistake.
- **Two-step:** the requirement switch shows and saves for a team workspace but does nothing — the rule exempts a coach's
  own workspace ("offered, with a nudge, never required: the coach is the only person who could reset it",
  `lib/two-step-rule.ts:14-15, 62`). A dead control. Personal two-step (`/account/security`) is untouched.
- **Staff:** already one list for coaches. The team staff page adds them and carries the **Run tournaments** switch
  (`components/coaches/CoachStaffSheet.tsx:152`), which projects the tournament grant onto the coach's membership
  (`lib/coach-membership.ts:863-903`). Staff & access shows them read-only ("Coaches are added and removed on each
  team's staff page", `MembersKit.tsx:424-432`). It adds only Admin and Staff board roles (`lib/board-roles.ts:72-85`;
  three seats, `plan-config.ts:63`). **Production, counted 2026-11-20 (counts only):** the one non-test Premium workspace
  has its owner and 5 coaches, no board members — nothing to strand.
- **PDF settings** are read by the portal's own printouts (lineups, practice plans, money exports, e.g.
  `coaches/teams/[teamId]/lineups/[eventId]/page.tsx:151, 768`), more than by the tournament; the portal already has
  **How your documents look** (team crest, accent colour, footer — `TeamDocumentsLookCard.tsx`), but the organization
  level carries more (page numbers, date stamp, orientation, FieldLogicHQ branding, privacy defaults for guardian
  contacts and notes, file names — `admin/org/settings/pdf/page.tsx:200-394`) with no portal door.
- **Name and web address** of the workspace can be changed only on the tournament side's Settings
  (`SettingsKit.tsx:275-312`); the portal has no rename (its team PATCH takes no name).

**The ruling.** For a Premium Coaches Portal (a running one-team workspace):

- **Retire** the tournament side's Staff & access, Audit log and Settings for it, and the old Account group with them.
  **No Settings & access place replaces it.** The tournament admin is just the tournament.
- **People have one home: the team staff page** (already there, with Run tournaments). The board roles (Admin, Staff)
  are no longer offered to a Premium workspace.
- **The portal gets the three real settings:**
  1. **Name and web address** — rows in team settings' **Organization** section (the standalone head coach's section,
     today only "Join a club").
  2. **Print options** — the rest of the organization's PDF settings joins **How your documents look** for a standalone
     team (a "More print options" part: page numbers, date stamp, orientation, branding, what printouts include, file
     names).
  3. **The deletion request** — on the portal's **Billing** page, its own section after Cancel Premium, shown to the
     owner whether or not the plan is still paid (someone who already cancelled may want their data gone).
- **Two-step requirement:** removed for a Premium workspace (it does nothing there).

**What 1R carries with it (not ruled — each goes where it belongs):**
- **A drawing first.** The portal additions are a new surface: drawn (`/design`) before they are built. The 2026-11-20
  picture (https://claude.ai/artifact/5JxvQHCQcWZHxuHCtt9Uqh, redrawn for 1R) shows the idea; it is not that drawing.
- **The three Premium board seats** are a packaging fact (`PLAN_PRICING_FACTS.md`, `plan-config.ts:63`): withdrawing board
  roles from Premium goes through `/strategy`, not quietly in the build.
- **The deletion request's new home** changes where a customer asks to close their account (the privacy policy promises
  "ask us to close your account"): `/legal` reviews the wording before hand-off.
- **Open for the drawing session:** the workspace's name ("Riverdale Ridge 13U Coaches Portal") is not the team's name, and
  the team's own name cannot be changed anywhere in the portal; decide which one the coach is renaming.
- **Found: the birthday cutoff.** The portal reads the organization's birthday cutoff (next season's birth years, roster
  warnings, tryout decisions) but a Premium coach cannot set it — the card hides itself without house league or rep teams
  (`birthday-cutoffs/route.ts:11-13`), so it is stuck at January 1. Not ruled; a candidate row for the same Organization
  section, to raise at the drawing.

**⚖ Step 2a, the drawing — RULED 2026-11-20** (owner, paste-back of all eleven asks, every one as recommended). Drawing:
https://claude.ai/artifact/K6TYzjQ1NZSZxfug9u4Rpz v1 (source `SETTINGS_BOTH_WORKSPACES_DRAWINGS.html`), drawn with the
sister plan's Stage 1; its A1/A2/A9–A11 are recorded there. For the Premium Coaches Portal:
- **A3:** the Organization section's name, web address and birthday rows are the **owner's**; a head coach who is not the
  owner sees them read-only ("Owner only"). The deletion request needs no rule (the billing page is owner-only).
- **A5 — the coach renames the TEAM.** One row, **Team name**; saving it renames the team and the workspace to
  "{new name} Coaches Portal" with it (the product already names a workspace that way and strips the suffix for display).
  Needs a new team-name save; the team PATCH takes no name today.
- **A6:** a **When birthdays count from** row in Organization — one date for the team's sport (the card's module gate does
  not let a Premium coach set it today).
- **A7:** with the seats meter gone, the plan card is **one column**; the slot is a line, "1 of 1 tournament slot in use"
  (a lone one-slot meter is full — danger-coloured — whenever the coach runs their one tournament).
- **A8:** **More print options** (folded inside How your documents look, saved by its one Save look) holds seven rows: Page
  numbers · Date printed · FieldLogicHQ mark · Page direction · Spacing · Guardian contacts · Player notes. Not carried:
  file names (a fixed pattern, no control), the two header lines, accent colour and footer (already in the card),
  internal admin notes (registration forms).
- **A4/A10/A11** as in the sister plan: the draft deletion window goes to `/legal`; each request is recorded and the
  "Request sent" line stays until answered; a paid plan keeps renewing and the window says so.
- Organization's meta becomes "{team} · not in a club" and its who line opens "The owner changes these."
No build go was given with these rulings.

**Step 2b's `/legal` on the deletion request ran 2026-11-20**, shared with the sister plan:
`docs/agents/legal/ORG_DELETION_REQUEST_WINDOW.md`, wording v0.2 on drawing tab 6. What it applied and the two owner
questions it raised (L-A: a paid plan blocks deletion; L-B: co-owners) are recorded in the sister plan's Stage 2.

**Call 4 narrows with it.** Two-step and the birthday cutoff are not tournament concerns, so the Tournament plan's real
gap is a **rename and a deletion request** only. **Opened through `/plan` 2026-11-20:**
[TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md](TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md). The re-check narrowed it again: the
Tournament plan already changes its **web address** (Settings & access › Web address), so the rename is the **name** only.

The calls as they were put:

1. **The premise.** For a Premium Coaches Portal owner, the "old menu" is their live staff-and-settings menu. Retire it
   by giving them the **same Settings & access row and tab row a Tournament plan has**, on their existing addresses
   (no redirect reversed, Stage 3's rule kept, Settings keeps all five cards)? *Recommended: yes.* Alternatives: move
   them onto the Tournament plan's addresses and tab set (loses four of Settings' cards unless call 4 lands first); or
   give these pages a home inside the Coaches Portal (a second settings home, against "one home per setting").
2. **A drawing for step 2?** It reuses E3's shipped shape; only the tab row's three tabs are new. *Recommended: no new
   mockup session — a `/design` check of the built screen against E3.*
3. **The typed-only pages** (board, venue library, house league, calendar, schedules, public site) for workspaces that do
   not have them: redirect them away (team workspace → Coaches Portal; Tournament plan → Tournaments list), the way
   accounting, families and rep teams already do? *Recommended: yes, in this project, step 3.*
4. **A Tournament-plan organization cannot rename itself, require two-step sign-in or delete itself anywhere.** Open it as
   its own item — a **Settings** tab on its Settings & access, drawn together with step 2? *Recommended: yes, its own board
   item; draw them together; route through `/plan`.*

## Rules until it is retired

- Never link to `/admin/org/tournaments`; use `/admin/tournaments/manage`.
- Check where a new door lands in a **browser** (the menu on arrival), not only that the page loads.

## Done when

- One address for the tournaments list; the old one redirects.
- No page renders the account-level tournament-only menu; its code and its phone counterpart are deleted.
- A build-time guard fails if a link to the old address is added.
