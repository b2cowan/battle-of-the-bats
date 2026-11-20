# Build prompt — Settings in both workspaces: the deletion request, names and addresses, and retiring a Premium coach's tournament-side settings

> **Three sessions, in order. Each is pasted into a fresh chat (`/clear` first) and ends with the owner's yes to commit.**
> Written 2026-11-20 from the drawing and its rulings. One prompt for two plans:
> - `docs/projects/active/RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md` — step 2 (ruling **1R**, the board-seats ruling, and
>   "⚖ Step 2a, the drawing — RULED 2026-11-20"), and step 4 (the guard and the one walk).
> - `docs/projects/active/TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md` — Stage 1 (rulings A1–A11), Stage 2 (`/legal`, L-A and
>   L-B ruled), Stage 3 (the build).
>
> **The approved drawing is the spec:** https://claude.ai/artifact/K6TYzjQ1NZSZxfug9u4Rpz **version 3** (source
> `docs/projects/active/SETTINGS_BOTH_WORKSPACES_DRAWINGS.html`; every numbered mark has its note). Wording of the deletion
> window and section: `docs/agents/legal/ORG_DELETION_REQUEST_WINDOW.md` § Recommendation (v0.2, L-A applied). Design log
> entry: `memory/design_decisions.md` "2026-11-20 — SETTINGS IN BOTH WORKSPACES". Board lines: `tournament-settings` and
> `navigation` in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`.
> **Model: Opus** for all three (shared billing body, a migration, auth-scoped routes, redirects). Helpers read on Sonnet.

## Why three sessions, and why this order
- **Session 1, the deletion request**, stands alone: a record, the route, one shared window, one section on the shared
  billing body. It also carries the Premium plan card's one-column change (same file, same screen).
- **Session 2, names and addresses**, gives every setting a working home: the Tournament plans' Name & address tab, and
  the Premium portal's Organization rows and More print options.
- **Session 3, the retirement**, removes the Premium coach's tournament-side Account group and sends its old addresses to
  the homes Session 2 built. It must come last, or a redirect lands on a row that doesn't exist yet.

## Standing rules for every session
- `AGENTS.md` (Next 16, `proxy.ts` never `middleware.ts`, the dev-server restart rule) and `AGENCY_RULES.md`: one `dev`
  branch; stage explicit pathspecs; other sessions share this working copy (check `git status` before staging and commit
  only your own lines — `memory`: partial commit out of shared files).
- **The product-manager UX summary and the task list come first; no code before the gate is answered.**
- Build to the drawing. A control the product already has is reused, not redrawn (the Web address window, the collapse
  sections, the setting rows, the pill switch, the lime segmented choice, `KitDialog`).
- One spelling (`npm run check:spelling`); dates with `formatStoredDate`; no new CSS token without saying so.
- Broad reading goes to a helper; open the cited lines yourself before building on a claim. **The census lines below
  are from 2026-11-20: re-check, don't trust.**
- `npm run verify:changed` on what you touched; `npm run typecheck` (shared modules and routes are touched in every
  session); unit tests for every changed rule; `npm run check:layout -- --changed` on the touched screens (dev server,
  never a whole-product sweep).
- `/review` before hand-off (substantive in all three). `/docs` where a help article changes (Sessions 2 and 3).
- Hand off in product-owner words; restart the dev server when files are added or shared modules change. **No commit
  without the owner's yes.**

---

## Session 1 — The deletion request, both workspaces

### Scope
- **In:** the request record (A10); the route's changes (privacy@, the record, an acknowledgement to every active owner —
  L-B); a way for our staff to mark a request answered; **one** shared deletion window with the v0.2 wording (L-A); a
  **"Delete {name}"** section, last on Plan & billing, for the Premium Coaches Portal (running, cancelled) and the Tournament
  plans (free, Plus); the "Request sent" line; the Premium plan card without the seats meter, one column (A7).
- **Out:** the club's Settings page keeps its own card and place (its window question is gate item 4); no change to what
  our staff tool deletes or refuses.

### What is true today
- Window: `components/admin/kit/club/SettingsKit.tsx:336-373` (card, `KitDialog kind="question"`, reason field, the
  `PaymentsEndingSection`), mounted only on `/admin/org/settings`. Route: `app/api/admin/org/request-deletion/route.ts` —
  owner only, POST emails `fieldlogichq@gmail.com` (`orgDeletionRequestHtml`, `lib/email.ts:1931-1956`), **records nothing,
  sends the owner nothing**; GET returns the online-payments ending section.
- Billing body: `components/billing/BillingBody.tsx` (words `lib/plan-billing-words.ts`) serves `/coaches/billing` (Premium)
  and `/admin/tournaments/settings/subscription` (Tournament plans). "Reduce or cancel" `:472-482` (paid only); cancelled
  Premium `:288-336`; plan card `:347-412`, the meters from `usageMeters` (`lib/plan-billing-profile.ts:204`:
  `['tournament_slots','staff_seats']` for `team`); `capFull` paints a full bar `--home-live` (`Billing.module.css:62`).
- Our staff tool's deletion (`app/api/platform-admin/orgs/[id]/delete/route.ts`) refuses an uncancelled subscription
  (`:174-181`) and money in flight (`:185-190`), and deletes no sign-in account. This is why L-A's wording is what it is.
- Every active owner already gets the purchase email: find how that list is built and reuse it.

### Gate (blocking)
1. **The record's shape**, from `ORG_DELETION_REQUEST_WINDOW.md` finding 9: organization id **and its name and web address
   as text** (the record must outlive the organization: no cascade delete), who asked (account id + email as text), when,
   reason, status (sent · answered · withdrawn · deleted), when answered, by whom. Next free migration number (513 was the
   last on 2026-11-20 — check), RLS: owner reads their own organization's open request; writes only through the route and
   the platform admin. Bring the table back before writing it.
2. **What "answered" means and where staff set it:** recommend one control on the organization's platform-admin page
   ("Mark answered", with the date), and the deletion route marking any open request **deleted** as part of the deletion
   record. Say where the staff action is recorded (platform admin already records every staff change).
3. **The acknowledgement email to every active owner** (L-B): its words, drafted for `/legal`'s CASL check before
   hand-off. Not commercial: no offer, no pricing. It says who asked, for which organization, when, that we reply within
   30 days, that nothing is deleted until confirmed, and that a co-owner who did not agree should reply.
4. **The club's window:** recommend the club's Settings card opens the same shared window with the same v0.2 wording
   (one window, one text; the legal findings apply to it equally) — its card and place unchanged. Owner's call.
5. **The plan card (A7):** for the `team` profile the seats meter goes and the card is one column with the line
   "1 of 1 tournament slot in use" (count words from the existing usage words). Confirm the Tournament plans' card is
   untouched (their 3 staff seats stay).
6. PM UX summary + task list.

### What it builds
- Migration + `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`, same unit of work.
- Route: POST records the request and emails **privacy@fieldlogichq.ca** (no longer the Gmail address; same fields), then the
  acknowledgement to every active owner; refuses a second open request (returns the open one); GET also returns the open
  request so the section can show the sent line. Owner only, as today.
- The shared window (moved out of `SettingsKit.tsx` once, used by the billing body and, per gate 4, the club card):
  wording exactly as `ORG_DELETION_REQUEST_WINDOW.md` § Recommendation — the reply line (several owners → "{name}'s
  owners"), **What is deleted** (Premium vs Tournament wording) + "Download or print anything you need to keep first.",
  **What isn't** (sign-ins incl. coaches'/staff's, our purchase records and the note of the deletion, backups), the
  **paid line** only while a paid period runs ("{Plan} is paid until {date}. We can delete {name} then, or now. Deleting
  now ends {plan} early, and the time left isn't refunded. Tell us which when we reply."), the online-payments part where
  it applies, "Why are you leaving?" (optional) + hint, **Don't send** · red **Send deletion request**.
- **Check in the build:** the payments part's "Export them first from Accounting" — name a page a Tournament Plus
  organization actually has, or route the words to `/marketing` + `/legal` if none exists.
- The section, last on the billing body for `team`, `tournament`, `tournament_plus` (drawing tabs 3 and 5): after Reduce or
  cancel when paid; after "Managing more than tournaments?" on the free plan; after "Basic records are still available" when
  Premium is cancelled. Button: white, red words (the Cancel door's class). Once sent: the olive check line
  "Request sent {date}. We'll reply to {owner email} within 30 days." until answered.
- Platform admin: the open request shown on the organization's page, Mark answered (gate 2).
- Unit tests: owner-only; one open request; record survives the organization's deletion; the section's three placements
  and the cancelled state; the paid line only while paid; `team` has no seats meter, the Tournament plans keep theirs.
- `/legal` on the acknowledgement email's words before hand-off. Carry-forward: the Privacy Policy §9 clause (legal index)
  becomes due once this ships — say so in the hand-off, don't edit the published policy.

### Done when
A Premium owner (running and cancelled) and a Tournament owner (free and Plus) can send a request from Plan & billing;
privacy@ receives it; every owner gets the acknowledgement; the sent line stays until staff mark it answered; the record
survives deletion; Premium's plan card has no seats meter.

---

## Session 2 — Names and addresses, both workspaces; More print options

### Scope
- **In:** the Tournament plans' **Name & address** tab (A1, A3, A9); the Premium portal's Organization rows — **Team name**
  (A5), **Web address**, **When birthdays count from** (A6) — and **More print options** inside How your documents look (A8).
- **Out:** removing anything from the tournament side (Session 3).

### What is true today
- Tournament plans: tabs `tournamentSettingsTabs` `lib/admin-kit-nav.ts:1072-1081` (Members · Payouts · PDF settings · Web
  address); `app/[orgSlug]/admin/tournaments/settings/web-address/WebAddressTab.tsx` (one card, lime "Change the address",
  "Owner only" for others); shared `WebAddressWindow.tsx` (PATCH `/api/admin/org-settings`, then navigates to
  `/{newSlug}/admin/tournaments/settings/web-address`); words `lib/web-address-words.ts`. The name saves through the same
  PATCH (`name`, owner only, `:73-77`); its hint today lives in `SettingsKit.tsx:275-303` (max 40).
- Premium: Team settings `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` — Organization section `:1081-1109`
  (standalone + head coach; meta hard-coded "Not connected to a club"); How your documents look
  `components/coaches/TeamDocumentsLookCard.tsx` (`/api/coaches/{org}/teams/{id}/pdf-settings?card=1`; "The team's NAME is
  not a setting", `:17-18`). The team PATCH (`app/api/coaches/[orgSlug]/teams/[teamId]/route.ts:252-408`) takes **no name**.
- The workspace is named `"{teamName} Coaches Portal"` at creation (`lib/team-checkout.ts:133`,
  `lib/team-workspace-provisioning.ts:285`); `teamWorkspaceDisplayName` (`lib/coaches-portal-routes.ts:23`) strips the
  suffix for display.
- Birthday cutoff: `BirthdayCutoffCard.tsx`; the GET answers `applies:false` without `module_rep_teams` /
  `module_house_league` (`app/api/admin/org-settings/birthday-cutoffs/route.ts:11-13, 27`) — so a Premium coach never sees
  it, while the portal reads it (next season's birth years, roster warnings, tryout decisions).
- Org PDF settings: `app/[orgSlug]/admin/org/settings/pdf/page.tsx:200-394` (who can save: owner or admin).

### Gate (blocking)
1. **Team name save (A5):** which records carry the team's name (the team row, any season or tournament registration
   snapshot, the public team page, calendar feed names, certificates) and which of those should follow a rename and which
   keep the name they were made with. Bring the list with lines. Then: one save that renames the team **and** sets the
   workspace name to "{new} Coaches Portal", in one transaction; max length; owner only (a non-owner head coach reads).
2. **The web address from the portal:** the shared window's after-save destination must be the portal's Team settings for a
   Premium workspace (not the tournament tab). Every portal link built from the slug is the warning's subject — check the
   window's warning text still tells the truth for a coach (their public team page, their tournaments' links).
3. **Birthday cutoff for Premium (A6):** the narrowest change that lets a Premium workspace read and set its cutoff (one
   sport), without making the card appear on a Tournament plan. Say where the gate changes.
4. **More print options (A8):** the seven rows map to existing org PDF fields (page numbers, generated date, branding,
   default orientation, density, guardian contacts, player notes) and save through the card's one **Save look**; who may
   save (owner; a non-owner head coach reads — A3). The paper preview reflects page numbers, date and the mark.
5. **Name & address tab (A1):** label "Name & address"; keep the address `/tournaments/settings/web-address` or move it with
   a redirect — recommend keep (fewer moving parts; the tab title is what people read). Both buttons the white button (A9).
6. PM UX summary + task list.

**⚖ Session 2 gate — RULED 2026-11-20** (owner, "i agree with your recommendations", all six calls):
- **C1 — what follows a rename.** The team, the workspace ("{new} Coaches Portal"), the free-team record behind the
  register picker, the "{team} staff" chat room (only while it still carries the old name), invites still waiting, and
  the first season's label only while that season is live and still reads the untouched "{old} {year}". Records keep the
  name they were made with: past registrations, sealed results, Stripe's checkout notes, deletion/terms/retention
  snapshots, sent emails and notifications. Both web addresses (workspace and public team page) stay. One database
  function, one transaction; 40 characters; the workspace owner only.
- **C2 — Player notes is dropped.** No printout reads it (the switch changes nothing); More print options ships **six**
  rows. Building notes onto roster printouts is a privacy-weighted feature of its own → `/plan` if ever wanted.
- **C3 — the drawn lines that weren't true are rewritten to the product** (words to `/marketing`): Guardian contacts (no
  per-print choice — the roster with contacts follows the switch), Page direction and Spacing (the money reports follow
  them; the rosters and the dues list keep their own shape), Date printed (the paper says "Exported: {date}", and an
  existing workspace prints it — the row reads its real value, on), the mark ("Generated by FieldLogicHQ").
- **C4 — the Club-on-sale condition moves onto the Join a club row** (and the who line's second sentence) so the
  Organization section's own rows show whether or not Club is on sale.
- **C5 — the doubled name is fixed here:** the public team page's club line, the coach's calendar-feed name and the award
  certificate's organization line strip the " Coaches Portal" suffix for a team workspace.
- **C6 — the birthday window is built like the Name window** (not drawn): title, "{sport} · only the owner can change
  it", month and day, Cancel · lime "Save date".
- The web address window takes its after-save destination and its words from the screen that opens it; the portal's
  warning names the team's public page and the tournaments the coach runs.
- **⚠ C5 re-opened at the build (2026-11-20):** the public side carries the raw "{team} Coaches Portal" name in ~20 places
  (the club frame's bar and footer, tab titles, share cards, search listing, both calendar feeds, the tryouts card, every
  public page of a tournament the coach hosts, the rules PDF), with no one loader to fix it in. What a team's public site
  calls itself with no club above it is a design question with one answer for all of them — recommended to `/plan` as its
  own item; not built here. Owner's answer owed.

**Built 2026-11-20 (Session 2), not committed.** Function `rename_team_workspace` (mig 517, applied to DEV; prod owed
before the promote — MANUAL_PROD_STEPS.json). Words for `/marketing` (all in `lib/workspace-identity-words.ts`,
`lib/team-print-options.ts`, `lib/web-address-words.ts`): the Name & address tab and its Name window; Team settings ›
Organization's meta, who line, three rows and the Team name and birthday windows (the birthday window was not drawn —
C6); the coach's web address hint and warning (`teamHint`, `teamWarning`, `teamDoorLine`); More print options' six rows
and summary (C3's rewrites: Guardian contacts, Page direction, Spacing, "Exported: {date}", "Generated by FieldLogicHQ").
Help synced (`/docs`): tournaments' "Your name and web address", coaches' Team settings › How your documents look and
Organization (the stale "Parent organization" answer replaced). Not measured by the layout check: no Premium-owner
fixture exists, and the Tournament-owner sign-in had expired (renewing it signs everyone out — owner's word owed).
Found on the way, Session 1's: two whole-suite guards fail on the deletion request — `possessive-guard` (hand-built
"’s" in `lib/org-deletion-words.ts`) and `team-move-coverage` (`org_deletion_requests` carries `org_id` and the team
move does not say what happens to it).

### What it builds
- Tournament plans: the tab renamed; the card gains the Name row (Rename → a window built like the Web address window:
  title "Name", "{name} · only the owner can change it", field "Name *" with the hint "Shown in the navigation bar and on
  your public pages. Your web address stays the same." and the count, Cancel · lime "Save name"); "Change the address" goes
  white; non-owners read "Owner only" on both rows.
- Premium Organization section (drawing tab 2): meta "{team} · not in a club"; who line "The owner changes these. If a club
  asks…"; rows Team name (Rename → "Team name" window), Web address (the shared window), When birthdays count from
  (Change), then Join a club. Owner only to change; a non-owner head coach sees the rows with "Owner only".
- How your documents look: a folded **More print options** part under the footer row, its summary line naming the current
  state ("Page numbers on · FieldLogicHQ mark on · Portrait"), the seven rows (pill switches; the lime segmented choice for
  Page direction and Spacing). The org PDF page's other fields are not carried (A8).
- Unit tests: the rename moves both names; owner-only saves; the birthday gate opens for Premium only; the print options
  save through Save look; the tab label and white buttons.
- `/docs`: Coaches help (rename, web address, print options, birthday cutoff) and the tournament help (Name & address).
  Words for `/marketing` listed in the plan.

### Done when
A Premium owner renames the team (the portal and the workspace follow), changes the web address and the birthday cutoff,
and sets the print options, all from Team settings; a Tournament owner renames the organization from Name & address; others
read, never write.

---

## Session 3 — Retire a Premium coach's tournament-side settings; the guard

### Scope
- **In (plan step 2d + step 4's guard):** for a running Premium workspace, the tournament side's **Account group** goes
  (desktop rail; the phone already lost it 2026-11-06); `/admin/org/members`, `/admin/org/members/audit`,
  `/admin/org/settings` and `/admin/org/settings/pdf` redirect to their portal homes; the two-step requirement switch goes
  with Settings; the deep links that land a Premium workspace there are re-pointed; the coaches' help rewritten; the build
  guard that no non-event admin page draws an "Account" group.
- **Out:** clubs and leagues (unchanged); the board-seat conversion rule (owed to `/plan` as an owner call — production has
  no Premium Admin or Staff, counted 2026-11-20; if the gate finds any on dev, stop and ask).

### What is true today
- The group: `components/admin/kit/AdminKitRail.tsx:298-308` (`tournamentOnly && orgLinks.length > 0`); the Premium
  exemption `components/admin/kit/useAdminKitNav.ts:37-44`. Rows: Staff & access · Audit log (owner) · Settings · PDF
  settings.
- Deep links into those pages for a Premium workspace: the Staff kit's invite (`staff-kit/page.tsx:109`,
  `getMembersHref`), Event settings' web address (`settings/event/page.tsx:917`, `getWebAddressHref`), `lib/billing-urls.ts`
  (`getMembersHref`, `orgSettingsOnTournamentSide`), the phone More sheet's "Settings & access" row for a team workspace
  (`kit-tournament-groups.ts:51`). Help: `lib/help-content/coaches.tsx:1119, 5941`.
- The 2026-11-20 Plan & billing Stage 3 rule "do not redirect these for a team workspace" (`PLAN_AND_BILLING_STAGE3_BUILD_PROMPT.md:94`)
  is superseded by 1R: add its amendment note.

### Gate (blocking)
1. **Every way in** (a helper's census, re-checked): links, pushes, notices, help, demo tours and UAT scenarios that reach
   the four pages for a Premium workspace. Each gets a destination.
2. **The destinations:** Staff & access and Audit log → the team's **Staff** page; Settings → Team settings, Organization
   section open; PDF settings → Team settings, How your documents look open (say how a section is opened from the address).
   For a member with the tournament grant and no team: where they land (`getStandaloneAdminHref` — never the no-team wall).
3. **The phone More sheet's "Settings & access" row** for a team workspace: remove it (nothing behind it any more) —
   confirm it shows nowhere else.
4. Confirm Tournament / Tournament Plus are untouched (they never had the group; their Settings & access keeps its tabs).
5. PM UX summary + task list.

### What it builds
- The group and the exemption deleted; the redirects (in the org layout or the pages' layouts, matching the typed-only
  pages' rule from steps 1 and 3 — `lib/typed-only-pages.ts`, `redirectWorkspaceWithoutProgram`); the deep links
  re-pointed; the More sheet row removed.
- Guard: a unit test that no non-event admin page draws an "Account" group for any plan; tests for each redirect.
- `/docs`: the coaches' help rewritten (people on the Staff page; settings in Team settings).
- Record: the plan's build order marks step 2 built; the board's `navigation` line moves on to step 4's one walk.

### Done when
A running Premium coach's tournament side shows Tournaments, Plan & billing and the Coaches Portal door only; every old
address lands on its portal home; nothing links to the retired pages; clubs and the Tournament plans are unchanged.

---

## After the three sessions — the one walk
One walk (`/tasks`), shared by both plans: a Premium coach on a computer and a phone (rename, address, birthday, print
options, deletion request, the old addresses), a Tournament owner and a Tournament Plus owner (Name & address, the
deletion request), an admin reading "Owner only", a club's Settings page unchanged, and the steps 1 and 3 checks already
built. The owner's word closes both plans.
