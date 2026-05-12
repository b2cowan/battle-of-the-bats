# UX Review — Findings & Phased Implementation Plan

> Generated: 2026-05-11 | Source: full codebase review across all user roles
> See TODO.md for the tracking entry that links to this file.

---

## How to read this document

Each finding is tagged with a **role**, a **finding ID**, a **priority** (High / Medium / Low), and a **file reference**. Findings are grouped into five implementation phases ordered by impact vs. effort. Phases 1–2 are bugs and critical usability gaps; Phases 3–5 are improvements and polish.

---

## Phase 1 — Critical bugs & multi-tenancy fixes

*These items either break the product for non-Milton orgs, cause 404s, or silently misdirect users. Fix before onboarding any new external org.*

---

### 1A — Multi-tenancy copy leak on the default `/{orgSlug}` page ✅

- **Finding:** F1-1
- **Status:** Complete — default branch replaced with FieldLogicHQ-branded placeholder (0 tournaments) and tournament selector (2+ tournaments). Hardcoded Milton copy removed entirely.
- **File:** `app/[orgSlug]/page.tsx`

---

### 1B — Accounting sidebar "Org Ledger" item is broken ✅

- **Finding:** F6-1
- **Status:** Complete — "Overview" renamed to "Ledgers" (accurate label for the current page); "Org Ledger" duplicate removed. A true Overview/dashboard will be built in Phase 4.
- **File:** `components/admin/AdminSidebar.tsx`

---

### 1C — House League "Notifications" sidebar link resolves to a 404 ✅

- **Finding:** F5-1
- **Status:** Complete (Phase 1 part) — broken sidebar link removed. Notifications page to be built in Phase 3 (item 3E); link will be re-added then.
- **File:** `components/admin/AdminSidebar.tsx`

---

### 1D — Staff/single-module auto-redirect sends users to the wrong page ✅

- **Finding:** F4-1
- **Status:** Complete — redirect target changed from `${base}/tournaments` to `${base}/dashboard`.
- **File:** `app/[orgSlug]/admin/page.tsx`

---

## Phase 2 — Coaches portal gaps

*The coaches portal has no mobile navigation, a dead-end "not assigned" state, and a misleading accounting page for unconfigured teams. These are the first things a coach will encounter.*

---

### 2A — No mobile navigation in the coaches portal ✅

- **Finding:** F7-1
- **Status:** Complete — `CoachesBottomNav` created with My Teams / Schedule (team-scoped) / More drawer (Roster, Accounting, Documents, History, Logout). Mounted in coaches layout. Hidden on desktop via CSS, shown on mobile (≤900px). Blueprint-blue theme matches coaches portal.
- **Files:** `components/coaches/CoachesBottomNav.tsx`, `components/coaches/CoachesBottomNav.module.css`, `app/[orgSlug]/coaches/layout.tsx`

---

### 2B — "Not assigned to any teams" is a dead end ✅

- **Finding:** F7-5
- **Status:** Complete — not-assigned state now shows org name in the message, a mailto link to `org.contactEmail` (or fallback "Contact your org admin" when null), and a "← Back to [org name]" link to `/{orgSlug}`. No additional DB query needed — `contactEmail` was already in `getAuthContext()`.
- **File:** `app/[orgSlug]/coaches/layout.tsx`

---

### 2C — Accounting page shows all zeros with no explanation when unconfigured ✅

- **Finding:** F7-3
- **Status:** Complete — informational banner renders above quick-link sections when `budgetAmount === null && duesCollected === 0 && totalExpenses === 0`. Banner text is action-oriented ("Set your team budget above, then track player dues, expenses, and org allocations using the sections below") rather than implying the coach must wait for admin. Banner disappears once any data exists.
- **File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx`

---

### 2D — Program year not shown in the coaches sidebar team list ✅

- **Finding:** F7-4 (partial)
- **Status:** Complete — `programYearName` now rendered as a second line below the team name in the sidebar team list, at reduced opacity (0.3). `programYearName` was already in the `CoachingAssignment` type — no new query needed.
- **File:** `components/coaches/CoachesSidebar.tsx`

---

## Phase 3 — Owner & operator improvements

*Module activation visibility, onboarding gaps, season management friction, and league admin broken workflow.*

---

### 3A — Onboarding flow covers only the tournament module

- **Finding:** F2-1
- **File:** `app/[orgSlug]/admin/onboarding/page.tsx`
- **Problem:** The 3-step checklist (plan info, invite member, create tournament) has no awareness of which modules the org has enabled. An owner who purchased for house league or rep teams finishes onboarding having done nothing relevant to those modules.
- **Fix:** After the existing 3 steps, add conditional steps based on enabled modules:
  - If `module_house_league` is enabled: "Create your first league season" → links to `/admin/house-league`
  - If `module_rep_teams` is enabled: "Create your first rep team" → links to `/admin/rep-teams`
  - If `module_public_site` is enabled: "Set up your public page" → links to `/admin/public-site`
- These steps should be optional (same "skip" pattern as today) but visible to orient the owner.

---

### 3B — No self-service visibility into module enablement

- **Finding:** F2-2
- **File:** Billing page `app/[orgSlug]/admin/org/billing/page.tsx`
- **Problem:** `enabled_addons` is only settable from the platform admin. An org owner has no UI showing which modules their plan includes, which are active, and how to activate one. The admin hub silently omits tiles for disabled modules.
- **Fix:** Add a "Modules" section to the billing page. For each module the plan includes, show:
  - Name + one-line description
  - Status: "Active" (green) or "Not yet enabled" (muted)
  - If not enabled: CTA button "Request to enable →" that sends a pre-filled email to support or opens a contact form (no self-serve toggle needed yet — this removes the silent gap without requiring platform-admin automation).

---

### 3C — "Organization Admin" tile lands on Members, not an org overview ✅

- **Finding:** F2-3
- **File:** `app/[orgSlug]/admin/page.tsx` line 62; would require new `app/[orgSlug]/admin/org/page.tsx`
- **Problem:** The hub tile description promises "Members, billing, settings, diamonds, and tournament records" but the href is `/admin/org/members`. An owner or admin looking for Settings or Billing has to discover the sidebar.
- **Fix:** Create `app/[orgSlug]/admin/org/page.tsx` as a simple hub page with tiles for: Members, Tournament Records, Diamonds, Billing (owner only), Settings (owner only). Update the hub tile href to `${base}/org`. This is a 1-page addition with no new data fetching — the tiles are purely navigation.

---

### 3D — Season status cannot be changed from the seasons list ✅

- **Finding:** F5-2
- **File:** `app/[orgSlug]/admin/house-league/page.tsx`, `SeasonCard` component (line 431+)
- **Problem:** A league admin managing multiple concurrent seasons must click into each one to transition its status. Season cards show the status badge but have no action.
- **Fix:** Add a status-transition button to each season card. Show one contextually appropriate action based on current status:
  - `draft` → "Open Registration"
  - `registration_open` → "Close Registration"
  - `registration_closed` → "Start Season" (transitions to `active`)
  - `active` → "Mark Complete"
  - `completed` → "Archive" (destructive, confirm dialog)
  Each button calls the existing status-update API route inline. Only visible to `isAdmin` users.

---

### 3E — Create the House League Notifications page (or remove the link) ✅

- **Finding:** F5-1 (Phase 1 removes the link; Phase 3 builds the page)
- **File:** Need to create `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx`
- **Problem:** The email dispatch feature from Phase 5K has an API but no admin UI page. The sidebar link (once re-added) needs a destination.
- **Fix:** Build the notifications page as a form with:
  - Subject line input
  - Message body textarea
  - Recipient audience selector: "All active registrants", "Waitlist", "Pending review"
  - Send button that calls the existing Phase 5K `/api/admin/house-league/seasons/[seasonId]/notify` route (or equivalent)
  - Sent history table below the form (if the API logs dispatches)

---

### 3F — Season detail index page has no clear landing content ✅

- **Finding:** F5-5
- **Status:** Complete (no-op) — the sidebar sub-nav regex correctly matches the index path, so Registrations/Teams/Schedule/Standings links already render when an admin lands on the season index page. The index page itself shows divisions management and lifecycle controls, which are the correct landing content. No redirect needed.
- **File:** `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx`
- **Problem:** Clicking "View Season →" from the seasons list takes the admin to the season index page, but the sidebar sub-nav items (Registrations, Teams, Schedule, etc.) only render when you're on a sub-path — not on the index page itself. The index page may render as empty or with minimal content.
- **Fix:** Add a `redirect` to `/registrations` in the season index page so the admin always lands on the most relevant first page. The sidebar sub-nav will then be visible immediately. One-line change: `redirect(`.../seasons/${seasonId}/registrations`)` in the page component.

---

### 3G — Cross-module "what needs attention" strip on the admin hub ✅

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §1 (Cross-Module Dashboard); original review F2-5
- **File:** `app/[orgSlug]/admin/page.tsx`
- **Problem:** The admin hub is a grid of module tiles with no activity summary. An owner returning after a few days away has to click into every module to find out what needs attention. The only summary view is the tournament-scoped dashboard.
- **Fix:** Below the hub tile grid, add a "Needs attention" strip that aggregates pending action counts across active modules. Only show non-zero items:
  - Pending team registrations from active tournaments
  - Pending house league registrations from registration-open seasons
  - Open rep team tryout applications
  Counts are fetched server-side from existing tables. Each count is a link to the relevant page. This strip is only shown to roles that have access to the relevant module (capability-gated). No new data model changes needed.

---

## Phase 4 — Platform admin & treasurer improvements

*Operational tooling gaps that matter as the platform scales.*

---

### 4A — Platform admin overview has no actionable signal ✅

- **Finding:** F8-1
- **File:** `app/platform-admin/page.tsx`
- **Problem:** 4 raw count cards (Orgs, Users, Tournaments, Teams) with nothing actionable. A platform admin arriving here learns nothing that requires action.
- **Fix:** Add a second row of health-indicator cards queried from Supabase:
  - Organizations with `subscription_status = 'past_due'` — link to orgs list filtered by that status
  - New orgs created in the last 7 days
  - (Optional) Tournaments currently active across all orgs
  Each card is a count + label, same visual pattern as the existing stat cards. Requires adding 2–3 targeted Supabase queries in `getStats()`.

---

### 4B — Audit log has no filter/search and caps at 200 rows ✅

- **Finding:** F8-2
- **File:** `app/platform-admin/audit/page.tsx`
- **Problem:** 200-row hard limit, no search, no filter. Finding actions for a specific org requires visual scanning.
- **Fix:**
  - Convert the page to a client component (or add a search form with server-side filtering via query params)
  - Add an org name/email search input
  - Add a date range filter (from/to)
  - Add an action type filter (dropdown of distinct action values)
  - Increase or paginate beyond 200 entries (add `offset` pagination with prev/next controls)

---

### 4C — Platform admin sidebar has no active-page indicator ✅

- **Finding:** F8-3
- **File:** `app/platform-admin/layout.tsx` lines 37–44
- **Problem:** All nav links use the same `styles.navLink` class with no active state detection. The current page is not visually indicated.
- **Fix:** Add `usePathname()` to the layout (client component) and apply an `styles.navLinkActive` class when `pathname === href` or `pathname.startsWith(href)`. Small CSS addition and a `'use client'` conversion for the layout.

---

### 4D — No direct link from orgs list to an org's admin shell ✅

- **Finding:** F8-4
- **File:** `app/platform-admin/orgs/OrgsClient.tsx` and/or `app/platform-admin/orgs/[id]/OrgDetailClient.tsx`
- **Problem:** A platform admin troubleshooting an org's config must manually construct `/{orgSlug}/admin`.
- **Fix:** Add a "Go to Admin →" link in each org row (linking to `/${org.slug}/admin`) and on the org detail page. One `<Link>` addition per location.

---

### 4E — Treasurer cannot create tournament ledgers ✅

- **Finding:** F6-2
- **File:** `app/[orgSlug]/admin/accounting/page.tsx` line 274
- **Problem:** Both the "Tournaments without a ledger" section and the "+ Add Ledger" button are `isOwner`-gated. A treasurer who needs to open a ledger must ask the owner to do it.
- **Fix:** Expand the gate to include `userRole === 'treasurer'` for tournament ledger creation. The org-level sub-ledger creation can remain owner-only. This is a one-line predicate change per gate.

---

### 4F — Users page caps silently at 1000 records ✅ (skipped — platform users list is internal staff only; no cap risk)

- **Finding:** F8-5
- **File:** `app/platform-admin/users/page.tsx`, `lib/db.ts` `getPlatformUsers()`
- **Problem:** `listUsers({ page: 1, perPage: 1000 })` silently drops any users beyond 1000. No indicator in the UI.
- **Fix:** Add a "Showing first 1000 users" note near the total count when the result set equals 1000. Longer term: implement proper server-side pagination using Supabase's `page` parameter.

---

### 4G — Treasurer: Export ledger as CSV ✅

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §2 (Export & Reporting)
- **File:** `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx`
- **Problem:** There is no way to export ledger entries for sharing with a board or external accountant. The treasurer must manually transcribe data.
- **Fix:** Add an "Export CSV" button to the ledger detail page header. On click, serialize the current filtered entry list to CSV (columns: date, description, category, type, amount, status) and trigger a browser download. This is a client-side operation — no new API route needed. Format: `{ledger-name}-{date-range}.csv`.
- **Scope:** The existing filtered entries are already in component state; the export is a pure JS `Blob` + `URL.createObjectURL` pattern.

---

### 4H — Treasurer: Category auto-suggest in accounting entry forms ✅

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §2 (Data Entry Efficiency)
- **File:** `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx` (entry creation form)
- **Problem:** Category is a free-text field. A treasurer creating dozens of entries manually types the same categories repeatedly (e.g., "Umpire Fees", "Diamond Rental", "Registration Income"). No suggestions means inconsistent naming, which hurts filtering and reporting.
- **Fix:** Fetch the distinct category values already present in this org's ledger entries and offer them as a `<datalist>` autocomplete on the category input. The `<datalist>` HTML element provides native browser autocomplete with no third-party dependency. Requires one lightweight `SELECT DISTINCT category FROM accounting_entries WHERE org_id = ?` query.

---

## Phase 5 — Public experience & polish

*Discovery, empty states, and cross-cutting polish. Lower urgency but improves first impressions for parents and new org owners.*

---

### 5A — No rep team tryout path on the org home page ✅

- **Finding:** F1-2
- **File:** `app/[orgSlug]/page.tsx` — both branches
- **Problem:** A parent who hears "tryouts are open" has no route from the org homepage to the form.
- **Fix:** In both the `module_public_site` branch and the default branch, add a "Rep Teams" section when `module_rep_teams` is enabled and at least one active program year has `tryoutOpen = true`. The section heading is "Try Out" and the CTA links to `/${orgSlug}/teams`.
- **Data needed:** `getRepTeams(org.id)` with a filter for active program years that have `tryout_open = true`. Add this query to the page's data fetching (parallel with existing queries).

---

### 5B — House league CTA absent from default org home branch ✅

- **Finding:** F1-3
- **File:** `app/[orgSlug]/page.tsx` — default branch (no `module_public_site`)
- **Problem:** Orgs using house league without the public site module have no link to league registration from their home page.
- **Fix:** Port the house league CTA block from the `module_public_site` branch into the default branch. The data fetch for `getLeagueSeasons()` is already done conditionally in the `module_public_site` branch — add it to the default branch when `module_house_league` is enabled.

---

### 5C — Tryout registration closed page gives no forward path ✅

- **Finding:** F1-4
- **File:** `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx` lines 86–110
- **Fix:** When `!programYear.tryoutOpen`, show:
  - A note about expected open date if `programYear.tryoutRegistrationOpenDate` is set
  - The org's contact email (fetched once alongside the other data) with "Questions? Contact us."

---

### 5D — Contact email on public site lacks a label ✅

- **Finding:** F1-5 / already noted in TODO.md "Public Site Offering Evaluation"
- **File:** `app/[orgSlug]/page.tsx` line 116
- **Fix:** Change the anchor text from the raw email to "Contact Us" with a tooltip or aria-label of the email address, or prepend "Contact:" as a `<span>` before the link.

---

### 5E — Action badges on coaches team hub cards ✅

- **Finding:** F7-4 (partial)
- **File:** `app/[orgSlug]/coaches/page.tsx`
- **Problem:** A coach with multiple teams has no way to know which needs attention from the hub.
- **Fix:** Extend the assignments data (in `getCoachingAssignmentsForUser` or via a separate summary query) to include:
  - `overdueInstallments: number` — count of past-due payment installments
  - `upcomingEventsCount: number` — events in the next 7 days
  Render these as small badge/chip indicators on each team card when non-zero.
- **Scope note:** The DB queries for this need to be efficient — add to the coaching assignments helper, not fetched per-card client-side.

---

### 5F — Standardise empty states and loading states across the app ✅

- **Finding:** CX-8
- **Scope:** App-wide
- **Problem:** Some sections have well-designed empty states (icon + heading + description + CTA); others render a plain `<p className={styles.muted}>` sentence.
- **Fix approach:** Audit all "No X yet" and "Loading…" occurrences. For every loading state, replace bare `<p>Loading…</p>` tags with a consistent skeleton or spinner component. For every empty state, ensure all four elements are present: icon, heading, muted description, and (where applicable) a CTA button. No new component is required — reuse the existing `emptyState` CSS class pattern already present in house league and rep teams.

---

### 5G — Season switcher in the house league sidebar ✅

- **Finding:** F5-4
- **File:** `components/admin/AdminSidebar.tsx`, house league section
- **Problem:** Switching between active seasons (U11, U13, U15) requires navigating back to the Seasons list each time.
- **Fix:** When `currentSeasonId` is set, add a `<select>` dropdown above the season sub-nav items listing all non-archived seasons. `onChange` navigates to `.../seasons/{newId}/registrations`. Follow the existing tournament switcher pattern at lines 279–316 of `AdminSidebar.tsx`.
- **Data needed:** The seasons list is not currently in the sidebar's context. Options: (a) pass it down from the house league layout via a context provider, or (b) fetch it client-side in the sidebar with a small `useSWR`/`useEffect` call scoped to the house league section.

---

### 5H — Official/Scorekeeper: Mobile score entry UX ✅

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §6
- **File:** `app/[orgSlug]/official/score/page.tsx`, `app/[orgSlug]/official/page.tsx`
- **Problem:** Officials submit scores from the field — often outdoors in bright sunlight on a phone with spotty connectivity. The current implementation hasn't been audited for mobile-specific concerns.
- **Fix checklist (verify via browser testing):**
  - Score inputs should use `type="number"` with large tap targets (min 44px height)
  - Buttons should be high-contrast and full-width on mobile
  - The page should handle submission gracefully when the network is slow: show a loading state, disable the submit button while in-flight, and surface a retry prompt on failure rather than a silent error
  - The game assignment list (`/official`) should be scannable with large text and clear diamond/time info — no horizontal scroll required on a 375px screen

---

### 5I — Public: House league registration form UX and post-registration status ✅

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §5
- **Files:** `app/[orgSlug]/league/[seasonSlug]/register/page.tsx`, confirmation email template
- **Problem:** Three gaps for registrants:
  1. The registration form may not clearly indicate which divisions are waitlist-only vs. have open capacity — a parent picks a division and gets waitlisted without expecting it.
  2. After submitting, the parent has no way to check their status other than the confirmation email.
  3. Mobile responsiveness of the multi-field registration form hasn't been audited.
- **Fix:**
  1. On the division selector, show capacity status inline: "Open (12 spots remaining)", "Waitlist only", "Closed". Pull from `ageGroup.capacity` and active registration count.
  2. Add a status page at `/{orgSlug}/league/{seasonSlug}/status?email={email}` or include a registration lookup link in the confirmation email so parents can self-serve their status without contacting the org.
  3. Audit the form on a 375px viewport: ensure inputs are full-width, labels are above (not beside) inputs, and the submit button is large enough to tap.

---

## Deferred & decided items

*Items from the original test plan that are either intentionally out of scope, require significant product investment, or have already been decided against.*

---

### D1 — Bulk operations for admins

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §1
- **Status:** Deferred to future planning
- **What:** Bulk-changing registration statuses, bulk-assigning teams, bulk-editing schedule slots. These are high-value for orgs with 100+ registrations but require significant UI work (multi-select, confirmation flows, async batch API).
- **Decision:** Not in scope for the current UX phase. Revisit after Phase 3 ships and an org is operating at scale. At that point, the registrations page is the highest-priority target for bulk actions.

---

### D2 — Coach real-time alerts (rain delays, diamond changes)

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §4
- **Status:** Deferred — future product feature
- **What:** Instant SMS or push notifications to coaches when there's a schedule change or rain delay. This is different from the existing email dispatch (which is manual and batch). Real-time alerts require a WebSocket or webhook layer plus a notification delivery service (e.g., Twilio, Firebase).
- **Decision:** The existing email communication tools (tournament announcements, house league notifications) partially address this for now. Real-time alerts are a future product feature to plan once WebSocket infrastructure is in scope.

---

### D3 — Calendar sync for team schedules

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §5
- **Status:** Deferred enhancement
- **What:** Export a team's schedule as an `.ics` file or Google Calendar link so parents can subscribe to game times in their phone's calendar app.
- **Decision:** Good future feature. Technically straightforward (generate an `.ics` file from the schedule query). Add to Deferred Enhancements in TODO.md when the time is right — likely alongside any broader "parent-facing" polish pass.

---

### D4 — Email template preview before dispatch

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §3 (Inline Communication)
- **Status:** Deferred
- **What:** Allow a league admin or registrar to preview the rendered email before sending to registrants.
- **Decision:** The notification page (3E) should include a preview capability when it's built. Note it as a requirement in 3E's implementation, not a separate item.

---

### D5 — Platform admin impersonation / support mode

- **Source:** UX_IMPROVEMENT_TEST_PLAN.md §7
- **Status:** Decided against — not building
- **What:** Allow a platform admin to view the app as a specific org user without their password, to aid troubleshooting.
- **Decision:** No impersonation was an explicit product decision (logged in memory). Platform admins troubleshoot via the org detail page (4D adds a "Go to Admin" link), the audit log, and direct DB access when needed. This decision should not be revisited without a specific support incident that can't be resolved another way.

---

## Summary table — all findings by phase

| Phase | ID | Role | Summary | Priority |
|---|---|---|---|---|
| 1 | 1A | Public | Multi-tenancy copy leak on default org home | High |
| 1 | 1B | Treasurer | Broken "Org Ledger" accounting sidebar item | High |
| 1 | 1C | League Admin | House League "Notifications" link → 404 | High |
| 1 | 1D | Staff | Auto-redirect sends staff to wrong page | High |
| 2 | 2A | Coach | No mobile nav in coaches portal | High |
| 2 | 2B | Coach | "Not assigned" state is a dead end | Medium |
| 2 | 2C | Coach | Accounting shows zeros with no explanation | Medium |
| 2 | 2D | Coach | Program year invisible in coaches sidebar | Medium |
| 3 | 3A | Owner | Onboarding only covers tournament module | High |
| 3 | 3B | Owner | No visibility into module enablement | High |
| 3 | 3C | Owner/Admin | Org Admin tile lands on Members, not a hub | Medium |
| 3 | 3D | League Admin | Season status not changeable from list | High |
| 3 | 3E | League Admin | Notifications page missing | High |
| 3 | 3F | League Admin | Season detail index has no content | Medium |
| 3 | 3G | Owner/Admin | No cross-module pending-items summary on hub | Medium |
| 4 | 4A | Platform Admin | Overview page shows no actionable signal | High |
| 4 | 4B | Platform Admin | Audit log no filter, 200-row cap | High |
| 4 | 4C | Platform Admin | Sidebar has no active-page indicator | Medium |
| 4 | 4D | Platform Admin | No link to org's admin shell from orgs list | Medium |
| 4 | 4E | Treasurer | Treasurer cannot create tournament ledgers | Medium |
| 4 | 4F | Platform Admin | Users page caps silently at 1000 | Medium |
| 4 | 4G | Treasurer | No ledger CSV export for reporting | Medium |
| 4 | 4H | Treasurer | Category field has no auto-suggest | Low |
| 5 | 5A | Public | No tryout registration path on org home | High |
| 5 | 5B | Public | House league CTA absent from default home | Medium |
| 5 | 5C | Public | Tryout closed page has no forward path | Medium |
| 5 | 5D | Public | Contact email has no label | Low |
| 5 | 5E | Coach | Team hub cards show no pending indicators | Medium |
| 5 | 5F | All | Inconsistent empty/loading states | Low |
| 5 | 5G | League Admin | No season switcher in sidebar | Medium |
| 5 | 5H | Official | Mobile score entry UX not audited | Medium |
| 5 | 5I | Public | Registration form capacity display + status tracking | Medium |
| — | D1 | Admin | Bulk operations (registrations, teams) | Deferred |
| — | D2 | Coach | Real-time alerts (rain delays, diamond changes) | Deferred |
| — | D3 | Public | Calendar sync for team schedules | Deferred |
| — | D4 | League Admin | Email template preview before dispatch | Deferred (part of 3E) |
| — | D5 | Platform Admin | Impersonation / support mode | Decided: not building |
