# Tournament Owner/Admin Mobile Review

Started: 2026-05-24

## 1. Review scope

This is a read-only first pass for an organization owner/admin on the base Tournament subscription, using a mobile viewport around 390x844. The focus is the admin tournament experience, not public visitor pages.

Scenario assumptions:

- Role: organization owner/admin.
- Plan: base Tournament, not Tournament Plus.
- Device: phone-sized admin use around 390x844.
- Product posture: base Tournament should feel like a complete manual tournament product. Plus should feel like an operations upgrade, not a requirement for basic setup or tournament-day work.

Guidance used:

- `AGENCY_RULES.md`
- `memory/agents/design-review-agent.md`
- `memory/agents/ux-flow-agent.md`
- `memory/agents/codex-subagent-coordination.md`
- `memory/tournament-free-tier-ux.md`
- `memory/tournament-plus-positioning.md`
- `memory/tournament-experience-excellence.md`
- `docs/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md`
- `docs/archive/TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md`

Context note: the design/UX guidance refers to `memory/design_system.md`, `memory/design_decisions.md`, `memory/design_principles.md`, and `memory/project_ux_review.md`, but those files were not present in this checkout. This pass continued from available tournament-specific memory and active/archive plans.

No browser verification was run in this pass, and no app code was changed.

Sub-agent passes used:

- Design Review sub-agent: visual density, touch target, branding lock, venues table, and subscription-context findings incorporated below.
- UX Flow sub-agent: admin entry fallback, venue org scoping, mobile activation, subscription plan-order, export lock, settings lock, and dashboard branding findings incorporated below.

## 2. Mobile journey map

| Journey | Base-plan owner/admin goal | Current mobile risk |
| --- | --- | --- |
| Enter tournament admin | Open the tournament admin area and understand the active tournament, status, and next task | Bottom nav hides most tournament setup and support routes in a long More menu; completed tournaments add Summary without plan context |
| Launch a draft tournament | Finish required setup and activate public registration/page | Required checklist is clear, but clone and branding prompts can over-index on Plus-only value |
| Manage registrations/teams | Review teams, accept/reject/waitlist, mark deposit/paid, add teams, inspect waitlist | Selection action bar may collide with the fixed bottom nav; export and payment-readiness locks are not consistently actionable on mobile |
| Build and publish schedule | Manually add games, publish divisions, export schedule, optionally use Plus automation | Base manual scheduling appears complete, but locked automation in Tools relies on hover-title explanations that mobile users cannot access |
| Enter results | Score and finalize games, open scorekeeper view, export results where allowed | Dense toolbar plus score status controls need browser verification; scorekeeper link is useful but needs mobile reachability checks |
| Communicate updates | Post public news and send all-team email | Base all-team email exists, but targeted communication is mostly hidden rather than explained as Plus value |
| Configure tournament basics | Manage divisions, venues, contacts, rules, event settings, public page visibility | Settings hub omits several basic setup routes; venues still appears to use a desktop table pattern |
| Understand subscription | Confirm current plan, slot usage, seats, and upgrade path | Subscription page has strong plan copy, but its mobile route is a re-export from org billing and contains broad upgrade comparison content |
| Complete or archive event | Preserve results, archive completed tournament, understand summary/reporting upgrade | Free archive value is present, but Sealed Records/Plus appears before free archived tournament history |

## 3. Pages and routes reviewed

Shared shell and navigation:

- `/{orgSlug}/admin` shell: `app/[orgSlug]/admin/AdminChrome.tsx`, `app/[orgSlug]/admin/admin.module.css`
- Desktop sidebar: `components/admin/AdminSidebar.tsx`, `components/admin/AdminSidebar.module.css`
- Mobile bottom nav: `components/admin/AdminBottomNav.tsx`, `components/admin/AdminBottomNav.module.css`
- Shared tournament admin primitives: `components/admin/tournament/TournamentAdminUI.tsx`, `components/admin/tournament/TournamentAdminUI.module.css`

Tournament entry and dashboard:

- `/{orgSlug}/admin/tournaments`
- `/{orgSlug}/admin/tournaments/dashboard`
- `/{orgSlug}/admin/tournaments/manage`
- `/{orgSlug}/admin/org/tournaments`
- `components/admin/TournamentSetupWizard.tsx`

Core base-plan operations:

- `/{orgSlug}/admin/tournaments/teams`
- `/{orgSlug}/admin/tournaments/schedule`
- `/{orgSlug}/admin/tournaments/results`
- `/{orgSlug}/admin/tournaments/announcements`
- `/{orgSlug}/admin/tournaments/communication`
- `/{orgSlug}/admin/tournaments/rules`
- `/{orgSlug}/admin/tournaments/venues`
- `/{orgSlug}/admin/tournaments/contacts`
- `/{orgSlug}/admin/tournaments/age-groups`

Plan-gated and subscription surfaces:

- `/{orgSlug}/admin/tournaments/branding`
- `/{orgSlug}/admin/tournaments/settings`
- `/{orgSlug}/admin/tournaments/settings/event`
- `/{orgSlug}/admin/tournaments/settings/registration-fields`
- `/{orgSlug}/admin/tournaments/settings/members`
- `/{orgSlug}/admin/tournaments/settings/organization`
- `/{orgSlug}/admin/tournaments/settings/subscription`
- `/{orgSlug}/admin/tournaments/summary`
- `/{orgSlug}/admin/tournaments/archives`

## 4. Design findings

1. **Selected-row action bar may sit behind mobile bottom navigation** - Severity: High
   Reference: `components/admin/tournament/TournamentAdminUI.module.css:599`, `components/admin/AdminBottomNav.module.css:11`, `app/[orgSlug]/admin/admin.module.css:41`
   The shared `SelectionActionBar` becomes sticky at `bottom: 0.75rem` with `z-index: 90`, while the mobile bottom nav is fixed at the bottom with `z-index: 300`. On registration workflows, selected-row actions such as Accept, Waitlist, Deposit, Paid, Workspace Invite, and Reject risk being covered by the bottom nav. Recommended fix: offset the selection bar above the admin bottom nav using a shared mobile bottom inset token.

2. **Shared mobile controls likely miss the 44px touch target bar** - Severity: High
   Reference: `components/admin/tournament/TournamentAdminUI.module.css`, `app/[orgSlug]/admin/admin-common.module.css`
   The shared tournament toolbar and common admin CSS include compact selects, segmented controls, menu buttons, chips, icon buttons, and row inputs that are often visually around 22-36px tall. Dense controls are useful on desktop, but mobile admin is a tournament-day operating mode. Recommended fix: apply a mobile-only minimum height of 44px for tappable toolbar controls, chips, menu items, row icon buttons, and inline score/action controls.

3. **Mobile More menu is doing too much navigation work** - Severity: Medium-High
   Reference: `components/admin/AdminBottomNav.tsx:75`, `components/admin/AdminBottomNav.tsx:289`, `components/admin/AdminBottomNav.module.css:94`
   Primary mobile tabs cover Registrations, Schedule, Results, and More. More contains tournament switcher, Set as Live, Preview Site, Dashboard, News, Communication, Rules, Contacts, Venues, Divisions, Manage, Settings, Past Tournaments, org routes, and logout. It scrolls, but it is not task-grouped around setup versus tournament-day operations. Recommended fix: split More into compact grouped sections with stronger labels, and consider a dedicated mobile tournament switcher/header action outside the long menu.

4. **Summary appears in mobile nav without plan context** - Severity: Medium
   Reference: `components/admin/AdminBottomNav.tsx:75`, `components/admin/AdminBottomNav.tsx:79`, `app/[orgSlug]/admin/tournaments/summary/page.tsx:259`
   Completed or archived tournaments add `Summary` to mobile More for all plans, but the Summary route is Plus-gated. A base-plan owner can tap what looks like a normal operational route and land on an upgrade card. Recommended fix: either label it `Summary (Plus)` in mobile nav, show a lock badge in More, or keep it out of base nav and surface a compact Plus prompt from completed-state dashboard/archive context.

5. **Venues still depends on a desktop table pattern** - Severity: High
   Reference: `app/[orgSlug]/admin/org/diamonds/page.tsx:95`, `app/[orgSlug]/admin/org/diamonds/page.tsx:112`, `app/[orgSlug]/admin/org/diamonds/page.tsx:113`
   The tournament Venues route re-exports the org Diamonds page, which renders a plain `table-wrap` table with no `data-label` mobile-card pattern in the reviewed code. This is a likely horizontal-scrolling or cramped-action risk at 390px. Recommended fix: give Venues the same labeled mobile-card treatment as Divisions, Contacts, and Archives.

6. **Branding page can still feel Plus-dominated after the free Public Pages section** - Severity: High
   Reference: `app/[orgSlug]/admin/tournaments/branding/page.tsx:327`, `app/[orgSlug]/admin/tournaments/branding/page.tsx:342`, `app/[orgSlug]/admin/tournaments/branding/page.tsx:474`, `app/[orgSlug]/admin/tournaments/branding/page.tsx:510`, `app/[orgSlug]/admin/tournaments/branding/page.tsx:537`
   Public page visibility is now correctly before advanced branding, but a base user then sees repeated locked cards for logo, theme, hero, font, and card style. On mobile this can become a long upsell wall. Recommended fix: collapse advanced locked controls into one compact "Tournament Plus branding" preview section, while keeping Public Pages as the primary free task.

7. **Several high-density mobile areas still use inline styles instead of shared responsive primitives** - Severity: Low-Medium
   Reference: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:339`, `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:409`, `app/[orgSlug]/admin/tournaments/contacts/page.tsx:118`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx:448`
   Clone callouts, optional setup rows, contact callouts, and schedule publish chips have custom inline layout. These are harder to harden consistently for 390px. Recommended fix: move recurring callout/action-row patterns into shared CSS or tournament-admin primitives.

## 5. UX flow findings

1. **Admin entry can dead-end without an actionable fallback** - Severity: High
   Reference: `app/[orgSlug]/admin/AdminHubClient.tsx:64`
   The admin hub can show "Opening tournament management..." while it decides where to send the user. If the startup-task fetch fails or never resolves, a mobile owner may be stuck before reaching tournament admin. Recommended fix: add a timeout/error fallback that offers direct links to Tournament Dashboard and Manage Tournaments.

2. **Settings hub is not a complete base tournament setup hub** - Severity: High
   Reference: `app/[orgSlug]/admin/tournaments/settings/page.tsx:35`, `app/[orgSlug]/admin/tournaments/settings/page.tsx:46`, `app/[orgSlug]/admin/tournaments/settings/page.tsx:54`
   The setup tab includes Event settings, Registration questions, and Tournaments & seasons. It omits several routes a base owner naturally expects from "settings/setup": Divisions, Venues, Contacts, Rules, Public Pages/Branding, Schedule publishing, and Announcements. Recommended fix: decide whether Settings is a complete setup hub. If yes, add base-plan setup cards before Plus-only cards.

3. **Locked settings card is disabled, so mobile users cannot learn or upgrade from it** - Severity: Medium-High
   Reference: `app/[orgSlug]/admin/tournaments/settings/page.tsx:106`, `app/[orgSlug]/admin/tournaments/settings/page.tsx:129`, `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx:185`
   `Registration questions` becomes a disabled `div` with a hover title when the plan lacks `custom_registration_fields`, while the actual registration-fields page has a clearer locked explanation. On mobile, the hover title is unavailable and the card is not tappable. Recommended fix: make locked cards tappable to a locked explanation page or subscription-context drawer.

4. **Locked Toolbar menu items rely on hover title instead of mobile-tappable explanation** - Severity: Medium-High
   Reference: `components/admin/tournament/TournamentAdminUI.tsx:274`, `components/admin/tournament/TournamentAdminUI.tsx:278`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx:537`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx:547`
   `ToolbarMenuItem` suppresses `onSelect` when `locked` is true and only exposes `lockTitle` via the title attribute. On mobile, locked Auto-Generate and Playoff Wizard items show a lock but do not open an explanation or upgrade path. Recommended fix: allow locked menu items to trigger an explanatory modal/bottom sheet with the Plus benefit and subscription link.

5. **Mobile More menu can activate a tournament too casually** - Severity: High
   Reference: `components/admin/AdminBottomNav.tsx:121`, `components/admin/AdminBottomNav.tsx:263`
   `Set as Live` appears in the bottom-nav More menu and falls back to `window.alert` on failure. Activation is high-impact and should use the same checklist and confirmation posture as Dashboard/Manage, especially on mobile where accidental taps are more likely. Recommended fix: remove direct activation from More, or route it through a confirmation/checklist state.

6. **Venues route is not clearly org-scoped in reviewed client calls** - Severity: High
   Reference: `app/[orgSlug]/admin/tournaments/venues/page.tsx:1`, `app/[orgSlug]/admin/org/diamonds/page.tsx:41`
   The tournament Venues page re-exports org Diamonds, and the reviewed client fetch uses `tournamentId` without `orgSlug`. For multi-org owners, this risks wrong or empty venue data depending on API auth context. Recommended fix: pass `orgSlug` through venue fetch/save/delete calls and preserve the visited org context.

7. **Draft dashboard clone prompt appears as a normal action before plan context** - Severity: Medium
   Reference: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:339`, `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:351`, `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:833`
   When previous tournaments exist, the dashboard shows "Clone setup" as a standard action. The Plus restriction appears only after opening the modal. For base users, this can feel like an available setup shortcut that turns into an upgrade interruption. Recommended fix: label the dashboard prompt as Plus, or hide/collapse it behind a compact "repeat event tools" upsell.

8. **Registration exports look available until tapped** - Severity: High
   Reference: `app/[orgSlug]/admin/tournaments/teams/page.tsx:580`, `app/[orgSlug]/admin/tournaments/teams/page.tsx:585`, `app/[orgSlug]/admin/tournaments/teams/page.tsx:1096`
   The Registrations header renders `ExportMenu` with XLSX/CSV/PDF, but `guardExport()` blocks all registration export actions for base Tournament. The visual affordance does not signal Plus until after interaction. Recommended fix: show a lock/Plus badge in the Export button/menu for registration exports on base, with a clear path to subscription.

9. **Subscription page compares outside the tournament upgrade path** - Severity: Medium-High
   Reference: `app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx:1`, `app/[orgSlug]/admin/org/billing/page.tsx:27`, `app/[orgSlug]/admin/org/billing/page.tsx:720`
   The tournament-local subscription page re-exports org billing, whose plan order includes Team before Tournament Plus. For a base Tournament owner, Team is not the operations upgrade they are looking for. Recommended fix: lead this route with a Tournament versus Tournament Plus comparison, then show League/Club as broader organization plans and filter/hide Team unless it is contextually relevant.

10. **Communication hides targeted send controls rather than explaining the boundary** - Severity: Low-Medium
   Reference: `app/[orgSlug]/admin/tournaments/communication/page.tsx:102`, `app/[orgSlug]/admin/tournaments/communication/page.tsx:258`, `app/[orgSlug]/admin/tournaments/communication/page.tsx:279`
   Base users get all-team email, which is good. But the locked targeting explanation is inside `recipientsOpen`, and the Edit Recipients button only renders when targeting is available. The Plus boundary may be undiscoverable. Recommended fix: keep the all-team composer primary, but add one compact disabled/locked row for "Target by division/status/team" with an upgrade explanation.

11. **Archives presents Plus sealed records before free archive history** - Severity: Medium
   Reference: `app/[orgSlug]/admin/tournaments/archives/page.tsx:109`, `app/[orgSlug]/admin/tournaments/archives/page.tsx:123`, `app/[orgSlug]/admin/tournaments/archives/page.tsx:195`, `app/[orgSlug]/admin/tournaments/archives/page.tsx:230`
   The page copy says archived tournaments are available on free, but the first content section is `Sealed Records`, which is Plus value. The free archived tournament list comes later. Recommended fix: put free "Archived tournaments" first for base plans, then show sealed records as a compact Plus enhancement.

12. **Selected registration bulk bar includes an acquisition action alongside core operations** - Severity: Low-Medium
   Reference: `app/[orgSlug]/admin/tournaments/teams/page.tsx:1266`, `app/[orgSlug]/admin/tournaments/teams/page.tsx:1300`
   After selecting teams, `Workspace Invite` appears beside Accept, Waitlist, Deposit, Paid, and Reject. On mobile this can crowd core tournament administration and blur whether the action helps the current tournament or promotes a separate Team workspace. Recommended fix: move workspace invites under Tools or secondary actions on mobile.

## 6. Base Tournament subscription findings

What is strong:

- Base Tournament includes manual scheduling, standard registration, team status management, waitlist collection, results/scoring, standings, public news, contacts, venues, rules/resources, public page visibility, and all-team email.
- Core plan boundaries in `lib/plan-features.ts` align with the product posture: `bulk_registration_actions` and `waitlist_collection` are base, while custom fields/files, payment readiness, waitlist automation, targeted announcements, cloning, advanced branding, and post-event summary are Plus.
- Schedule and Results include base-friendly exports for schedule/results XLSX/CSV and iCal where applicable, with PDF gated separately.

Where base feels incomplete:

- Settings does not collect the base setup essentials in one place, so a mobile owner has to hunt through More for Divisions, Venues, Contacts, Rules, Branding/Public Pages, and Announcements.
- Dashboard optional setup labels "Public site & branding" as logo/banner/theme customization, which is mostly Plus language. Base users mainly need page visibility and default public presentation confidence.
- Completed-event base flow is under-framed. A base owner can view results and archive, but the product does not strongly say "your free public record is preserved; Plus adds summary/reporting/cloning."
- Subscription clarity is too broad for this scenario. A base Tournament owner should first see the path from Tournament to Tournament Plus before unrelated Team or future org-wide plans.

Where base feels over-upsold:

- Branding advanced controls repeat locked notes across several cards.
- Archives leads with Plus sealed records.
- Summary appears as a normal completed-state navigation item before it becomes an upgrade card.
- Clone setup appears as a normal dashboard action before the Plus restriction is disclosed.

## 7. Plus upsell and gating findings

| Surface | Current behavior | Mobile/base risk | Recommended posture |
| --- | --- | --- | --- |
| Branding | Free Public Pages first, then multiple locked advanced cards | Long Plus wall after the free task | One compact advanced branding upsell preview after Public Pages |
| Registration questions | Disabled card in Settings; direct route has useful locked page | Mobile users cannot tap disabled card | Tappable locked card or inline subscription drawer |
| Schedule automation | Locked ToolbarMenu items with hover-only title | No mobile explanation or CTA | Locked item opens modal/sheet with Plus benefit |
| Registration export | Export button appears normal, guard blocks on tap | Feels like a broken/withheld core action | Gated export button/menu with Plus badge before tap |
| Payment readiness | Locked Tools menu item has upgrade copy, but no action | Reads as unavailable text, not a path | Tappable locked explanation with subscription link |
| Targeted communication | Edit controls hidden for base | Boundary is too invisible | Compact locked targeting row under all-team email summary |
| Summary | Normal mobile nav item on completed/archived tournaments | Base lands on upsell page from nav | Label as Plus or surface from completed dashboard/archive only |
| Clone | Dashboard and setup wizard include clone workflow | Base sees repeat-event value before plan context | Mark as Plus at entry point, keep manual new tournament path dominant |
| Sealed archives | First section in Archives | Plus appears before free archive value | Put free archived tournaments/history first for base plans |
| Subscription route | Org billing comparison includes Team and broader org plans | Tournament Plus path can be buried | Lead with Tournament vs Tournament Plus, then secondary broader plans |

## 8. Priority implementation queue

P0 - Mobile usability blockers:

1. Offset `SelectionActionBar` above the fixed `AdminBottomNav` on mobile and verify Registrations selected-row actions at 390x844.
2. Raise shared mobile admin touch targets to 44px minimum for toolbar controls, chips, menu items, and row actions.
3. Convert Venues table to the shared labeled mobile-card pattern.
4. Pass `orgSlug` through tournament Venues fetch/save/delete flows.
5. Add an actionable fallback for the admin hub "Opening tournament management..." state.
6. Remove or guard bottom-nav `Set as Live` behind the dashboard/manage activation confirmation.
7. Replace hover-only locked `ToolbarMenuItem` explanations with tappable locked states on mobile.

P1 - Base-plan completeness and navigation clarity:

1. Expand Settings hub with base setup cards or related setup links for Divisions, Venues, Contacts, Rules, Public Pages, and Announcements.
2. Rework mobile More menu grouping so setup, tournament-day operations, history, and org/account routes are easier to scan.
3. Add a completed-event base flow: public results link, archive/history cue, and compact Plus summary/clone/reporting nudge.
4. Make the tournament subscription route lead with Tournament versus Tournament Plus before broader plan comparisons.

P2 - Plus gating polish:

1. Make disabled/locked Settings cards tappable to locked explanations.
2. Add Plus labels/locks to Summary in mobile nav or remove it from base-plan nav.
3. Make registration exports visually gated before tap on base Tournament.
4. Move clone dashboard prompt behind explicit Plus labeling for base plans.
5. Put free archived tournament history before sealed records on Archives for base plans.

P3 - Density and consistency cleanup:

1. Collapse repeated advanced Branding locks into one compact Plus preview section.
2. Move Workspace Invite out of the primary mobile selection bar.
3. Replace page-specific inline responsive layouts with shared tournament admin callout/action primitives.
4. Add a compact targeted communication locked row while keeping all-team email as the main base-plan composer.

## 9. Browser verification checklist

Use a base Tournament org, preferably the seeded/free UAT org if available. Viewport: 390x844. Also spot-check 375x667 and 430x932.

Global mobile checks:

- No page-level horizontal scrollbar.
- Fixed bottom nav does not cover sticky action bars, save footers, modal actions, or final list rows.
- First useful task or honest empty state appears without excessive scrolling.
- Touch targets feel at least 44px tall.
- Buttons and labels wrap without clipping.
- Locked Plus states explain what is locked without relying on hover.
- Base-plan tasks are visible before Plus upsell content.
- Error and empty states include a recovery action where appropriate.
- Admin entry resolves quickly or offers Dashboard/Manage fallback links if startup routing fails.

Routes to verify first:

- `/{orgSlug}/admin/tournaments/dashboard`
- `/{orgSlug}/admin/tournaments/teams`
- `/{orgSlug}/admin/tournaments/schedule`
- `/{orgSlug}/admin/tournaments/results`
- `/{orgSlug}/admin/tournaments/communication`
- `/{orgSlug}/admin/tournaments/announcements`
- `/{orgSlug}/admin/tournaments/rules`
- `/{orgSlug}/admin/tournaments/venues`
- `/{orgSlug}/admin/tournaments/contacts`
- `/{orgSlug}/admin/tournaments/branding`
- `/{orgSlug}/admin/tournaments/archives`
- `/{orgSlug}/admin/tournaments/settings`
- `/{orgSlug}/admin/tournaments/settings/event`
- `/{orgSlug}/admin/tournaments/settings/registration-fields`
- `/{orgSlug}/admin/tournaments/settings/subscription`

Critical scenarios:

- Select registrations and confirm the sticky selection action bar is fully visible above the bottom nav.
- Open mobile More menu with a long tournament name and confirm all setup/history/org links are reachable.
- Confirm `Set as Live` cannot be triggered casually from mobile More without a checklist/confirmation step.
- Try locked Auto-Generate and Playoff Wizard from Schedule Tools on a base plan.
- Try registration Export on a base plan and verify the lock is visible before action.
- Visit Branding as a base user and confirm Public Pages is the first useful task.
- Visit Archives as a base user and confirm free archived tournament history is not buried under sealed-record upsell.
- Complete or use a completed tournament and confirm Summary does not look like an ungated base feature.
- Open Add/Edit modals for team, game, venue, contact, announcement, and rule/resource on 390x844.
- Verify Settings hub helps a base owner reach the full setup path without needing to memorize More menu locations.
- Verify subscription shows Tournament Plus as the primary tournament upgrade path and does not present Team as a misleading upgrade.

## 10. Open questions

1. Should Settings become the complete tournament setup hub, or should Dashboard remain the setup hub and Settings stay narrower?
2. Should the mobile bottom nav reserve a primary tab for Dashboard during draft/completed states, then switch to Registrations/Schedule/Results during active tournament operations?
3. Should Summary be hidden from base-plan navigation, labeled as Plus, or shown only as a compact completed-event upsell?
4. Should locked Plus controls open a shared upgrade bottom sheet instead of linking directly to subscription?
5. Should Workspace Invite remain in the registration selection bar, or move to a lower-priority Team acquisition workflow?
6. Should base-plan Branding be renamed in navigation/copy to "Public Pages" with Advanced Branding nested below it?
7. Should Archives be split into "Archived tournaments" and "Sealed records" with plan-specific ordering?
8. Is a dedicated lightweight mobile scorekeeper/admin scoring route still needed, or is the current Scorekeeper View enough for the owner/admin scenario?
9. Should Team ever appear on the tournament-local subscription page, or should it be reserved for coach/team acquisition contexts?
