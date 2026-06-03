# Public Tournament Mobile Experience Plan

## Purpose

Make public tournament pages excellent on mobile for coaches, parents, players, and visitors. The public experience should make it easy to register a team, check the schedule on tournament day, find results, confirm rules, read news, and recover gracefully when a page is hidden, empty, unpublished, or unavailable.

This is a follow-up to the archived Tournament Experience Excellence work. Admin mobile hardening is complete through Phase H; this plan owns the remaining public and participant-facing mobile work.

## Archive Status

Archived on 2026-06-02 as implementation-complete for the public coach/parent mobile experience.

Completed scope:

- Public registration Info -> Review -> Next Steps, including waitlist handling.
- Tournament Day public home mode and Follow My Team.
- Mobile schedule controls with live team search and filter sheet.
- Compact selectable schedule rows and public game detail pages.
- Results/Standings mobile clarity and completed-tournament public record value.
- Completed tournament public home record.
- Shared public empty/unavailable state pattern across high-traffic public routes.

Explicit deferrals:

- Browser visual/design refinements move to a separate design project.
- Route-specific analytics surfaces remain future product work.
- Plus shareable post-event recap remains a separate product decision.

## Product Manager UX Summary

After this work, a visitor opening a public tournament page on a phone should immediately understand the event: who is hosting it, when it runs, whether registration is open, what to tap next, and where to find schedule/results updates. Coaches registering a team should complete the form with confidence, review their details before submitting, and see clear next steps afterward. Tournament-day visitors should filter the schedule by division or team without fighting stacked controls.

Free Tournament remains a complete public event presence with FieldLogicHQ default styling, registration, schedule, standings, teams, rules, news, results, and useful hidden/empty states. Tournament Plus adds premium presentation and operations value: custom branding, hero/banner imagery, custom registration fields/files, targeted communications, post-event summaries, and richer recap moments.

## Source Context

- Archived journey audit: `docs/projects/archive/TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md`
- Archived admin section review: `docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md`
- Memory: `memory/tournament-experience-excellence.md`
- Current public routes: `app/[orgSlug]/[tournamentSlug]/**`
- Shared public data: `lib/public-tournament-data.ts`, `lib/public-tournament-client.ts`, `lib/public-pages.ts`
- Plan gates: `lib/plan-features.ts`

Relevant archived findings:

| ID | Topic | Status |
| --- | --- | --- |
| JNY-03 | Public registration stepper promises Review but submits directly | Implemented 2026-05-29 |
| JNY-12 | Public schedule controls likely wrap/overflow on mobile | Implemented 2026-06-01 |
| JNY-15 | Free Tournament post-event story needs clearer framing | Implemented 2026-06-02 |
| JNY-16 | Public acquisition analytics surfaces are too coarse | Open |
| JNY-17 | Public hidden/empty states need contact and next links | Partially addressed 2026-05-29 |
| JNY-18 | Public hero fallback is too abstract when no Plus banner exists | Open |

2026-05-29 implementation note: the home hero intentionally keeps registration out of the hero because the public nav Register action owns team registration. Waitlist entry now happens inside the registration flow when a selected division is full.

## Goals

- Create a mobile-first public tournament experience for coaches, parents, players, and visitors.
- Put the first useful public action close to the top of every route.
- Convert schedule controls into a compact mobile pattern that handles many divisions, long team names, playoffs, brackets, and calendar export.
- Make registration honest by either adding a real Review step or simplifying the stepper. This plan chooses a real Review step.
- Standardize hidden, closed, unpublished, empty, and not-found states with organizer contact and useful next links.
- Let public visitors follow one team on a device so parents and coaches can return directly to the schedule context they care about.
- Clarify the public post-event story for both free Tournament and Tournament Plus.
- Improve the public tournament first viewport, especially when no Plus hero banner is configured.
- Keep free Tournament useful and complete while preserving Plus branding/customization value.
- Define a browser UAT plan that the user can run per project workflow.

## Non-Goals

- No schema changes unless implementation later discovers an unavoidable data gap.
- No online tournament payment collection.
- No new public CMS or free-form page builder.
- No changes to `proxy.ts` expected from this plan.
- No admin mobile scope beyond links needed for public verification.

## Primary Mobile Journeys

| Journey | Visitor Goal | Current Risk | Target Experience |
| --- | --- | --- | --- |
| Register a team | Submit team/contact/division/custom field details and understand payment next steps | Stepper shows Review but submit happens from Info | Info form leads to Review, then final submit, then Next Steps confirmation |
| Check schedule | Find games by division, team, pool/playoff, list/bracket, and add calendar | Inline tabs/toggles/selects/calendar button can stack awkwardly | Compact control bar plus bottom sheet filters, with one calendar action |
| Follow a team | Parents and coaches want one-tap access to their own team's schedule | Visitors must search/filter again on every visit | Browser-local Follow My Team preference highlights the team and focuses schedule context |
| Find standings/results | Check live or final results by division/pool | Empty and pending states can feel generic | Clear standings/results state with schedule/results cross-links |
| View teams | Confirm accepted teams and team profiles | Empty/hidden states are sparse | Division/pool team lists with helpful empty state and schedule/register links |
| Read rules/news | Confirm tournament rules, resources, announcements, and updates | Empty states do not always guide next action | Rules/news empty states include organizer contact and nearby public links |
| Hidden/unavailable pages | Understand why a page is unavailable and where to go instead | Direct URL hidden-page states are generic | Shared unavailable state with contact email and visible next links |
| Post-event visit | Revisit final results, teams, and event recap | Free post-event story is under-framed | Free: final public record. Plus: branded recap/summary path and renewal/share value |

## Product Decisions

### Schedule Controls

Use a compact mobile control bar plus bottom sheet pattern.

Desktop and wide tablet can keep an inline toolbar, cleaned up with CSS classes instead of inline styles. Mobile should not use a row of division tabs plus multiple segmented controls.

Recommended mobile layout:

- Top control bar under the page header:
  - Native `select` for Division.
  - Live Team/Coach search field on the page so results update as the visitor types.
  - "Filters" button showing active view-filter count.
  - Calendar icon/text button with accessible label.
- Bottom sheet contents:
  - Stage segmented control: Pool Play / Playoffs.
  - View segmented control when Playoffs is active: List / Bracket.
  - Reset and Apply actions.
- Active summary line:
  - Example: `View Playoffs - Bracket`
  - Keep it short and wrap safely.
- Calendar action:
  - Uses the currently selected scope.
  - Label remains concise on mobile: `Calendar`.
  - Accessible label explains whether it exports all visible games or the selected team.

Rationale:

- Division and team names can be long.
- The existing public route supports multiple axes of filtering.
- Visitors mostly need division and team search as live page controls on phones.
- A sheet can preserve less-frequent view controls without pushing games below a stack of controls.

### Registration Flow

Add a real Review step rather than removing the stepper.

Rationale:

- Registration can include fee details, waitlist state, custom questions, file uploads, and external payment instructions.
- Coaches benefit from seeing the selected division, waitlist/closed state, contact email, and submitted custom answers before the final submit.
- The existing three-step labels are already conceptually right: Info, Review, Next Steps.

Target flow:

1. Info: team name, coach/contact name, email, division, fee/waitlist notices, custom fields/files.
2. Review: read-only summary with Edit actions, organizer contact, payment note, waitlist warning if applicable, file names, and final submit.
3. Next Steps: confirmation, email summary, organizer review, payment instructions, and related public links.

Implementation notes:

- Current state type is `form | submitting | success | error`; add `review`.
- Validate required fields before moving to Review.
- Do not upload files until final submit from Review.
- Preserve the existing waitlist collection behavior for free Tournament.
- Keep Tournament Plus custom fields/files included in the review summary.

### Hidden And Empty States

Create a shared public state pattern for:

- Page hidden by organizer.
- No public tournament found or inactive/canceled org where applicable.
- Registration not open or division closed.
- Schedule unpublished for whole tournament or selected division.
- No games for selected filters.
- No accepted teams.
- No standings yet.
- No rules/resources.
- No news posts.

Every state should try to include:

- Plain title.
- One sentence explaining what happened.
- Organizer contact email when available: `tournament.contactEmail ?? organization.contactEmail`.
- Contextual next links from visible public pages.
- One primary route back to the tournament home.

Suggested shared component:

- `components/public/PublicTournamentState.tsx`
- Accepts `icon`, `title`, `description`, `contactEmail`, `links`, `primaryLink`, and optional `compact`.

### Post-Event Public Story

Free Tournament should get a clear final public record:

- Home hero/status says the tournament is complete.
- Primary CTA prefers Final Standings or Results when visible.
- Schedule remains useful as historical game detail.
- Teams remains available for accepted teams.
- News can carry final announcements.
- Empty states explain that final results may not have been posted yet.

Tournament Plus should add premium post-event value:

- Branded hero/banner and custom styling remain active.
- Public home can show a richer completed-event recap block when enough data exists.
- Admin Plus Summary remains the operational/reporting tool.
- A future public recap link can be considered, but should be a separate product decision if it becomes externally shareable.

### Hero And First Viewport

The public tournament home first viewport should build trust even without a Tournament Plus banner.

Target mobile first viewport:

- Tournament name is the dominant signal.
- Date range, host organization, registration/status, and primary action are visible without scrolling.
- At least a hint of the next section is visible on common mobile heights.
- The fallback hero is information-led, not only decorative.
- If no Plus banner is configured, use a structured event masthead based on tournament facts and platform theme, not abstract-only decoration.
- Plus banner, logo, theme, light mode, and card style remain Plus-and-above behavior.

Current implementation note:

- `components/public/TournamentHomeContent.tsx` falls back to decorative `heroBg`/orb/grid layers and `app/[orgSlug]/Home.module.css` sets `.hero { min-height: 100vh; }`.
- Implementation should reduce mobile hero height and replace or de-emphasize the abstract fallback with event-specific information.

### Accessibility And Touch Targets

Minimum expectations:

- Interactive controls should be at least 44px high on mobile.
- Native selects need visible labels or accessible labels.
- Filter bottom sheet needs focus management, `aria-modal`, close button, Escape handling, and focus return.
- Buttons should have text or clear accessible labels; do not rely on emoji-only controls.
- Calendar action should use a real icon plus text/label, not only the current emoji.
- Segmented controls should expose selected state.
- Text must wrap without clipping inside buttons, filter summaries, cards, and team names.
- No page-level horizontal overflow at 375px, 390px, or 430px.
- Color contrast must hold in dark and Plus light mode themes.
- Respect reduced motion where animations are not essential.

## Plan-Tier Implications

| Surface | Free Tournament | Tournament Plus |
| --- | --- | --- |
| Public home | FieldLogicHQ default theme, event facts, status, public CTAs, Powered by badge | Custom logo/theme/colors/card style/light mode/banner when configured |
| Hero fallback | Information-led default masthead | Same fallback if no banner, but Plus custom theme can style it |
| Registration | Standard fields, division capacity, waitlist collection, external payment note | Custom fields, file fields, same review flow, richer branded presentation |
| Schedule | Public schedule, division/team filters, pool/playoff view, iCal export | Same public controls, plus branded styling inherited from Plus settings |
| Standings/results | Public final/live record | Same public record, plus stronger post-event branding |
| News/rules/teams | Public pages with visibility controls | Targeted news visibility and Plus branding where already supported |
| Hidden/empty states | Contact plus useful links | Same, with Plus branding/customization |
| Post-event | Final public record and next links | Admin post-event summary, branded recap potential, reporting/share value |

Do not put free Public Pages controls or public participant basics behind Plus gates. Plus value should be premium presentation, richer operations, and reporting, not basic public usability.

## Implementation Phases

### Phase 0 - Decision Lock And Baseline

Tasks:

- [x] Create this implementation plan.
- [x] Create the PM brief.
- [ ] Confirm active UAT orgs and at least one data-rich public tournament for each tier.
- [ ] Decide whether public post-event recap remains home-page content only or needs a future public summary route.

Acceptance criteria:

- Product decisions above are approved or edited.
- Implementation can proceed without reopening the schedule control and registration review direction.

### Phase 1 - Shared Public State And Data Support

Likely files:

- `components/public/PublicTournamentState.tsx`
- `components/public/PublicTournamentState.module.css`
- `lib/public-pages.ts`
- `lib/public-tournament-data.ts`
- `app/[orgSlug]/[tournamentSlug]/layout.tsx`
- Public pages under `app/[orgSlug]/[tournamentSlug]/**`

Tasks:

- [x] Add a shared unavailable/empty state component.
- [ ] Add a helper to derive visible next links from `publicHiddenPages`.
- [ ] Ensure public page data exposes enough contact/context for all states.
- [x] Replace generic hidden-page messages on Schedule, Teams, Standings, Register, Rules, News, and Results.
- [x] Ensure direct hidden-page URLs still render a helpful page rather than a confusing dead end.

Acceptance criteria:

- Hidden pages show organizer contact when available and at least Home plus two relevant public links when visible.
- Empty states are specific to the route and state.
- No free public feature becomes Plus-gated.

2026-06-02 shared state note: `components/public/PublicTournamentState.tsx` now provides the shared public unavailable/empty pattern. It is used on Schedule, Standings, Teams, Register, Rules, News, public game details, and public home schedule/news fallbacks. Direct hidden URLs for News and Rules now show an unavailable state instead of falling straight through to not-found.

### Phase 2 - Public Schedule Mobile Controls

Likely files:

- `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx`
- `app/[orgSlug]/schedule/schedule.module.css`
- Possible new `components/public/PublicScheduleControls.tsx`
- Possible new `components/public/PublicScheduleFilterSheet.tsx`

Tasks:

- [ ] Extract public schedule controls from inline markup into a dedicated component.
- [x] Replace mobile division tabs with a compact select/filter pattern.
- [x] Add bottom sheet for stage/view filters on mobile while keeping division and team search live on the page.
- [x] Keep desktop toolbar readable and avoid inline style sprawl.
- [x] Replace emoji calendar button with icon/text and accessible label.
- [x] Preserve all existing filtering and iCal behavior.
- [x] Handle long division names and long team names.
- [x] Ensure bracket view is discoverable only when playoffs are active.

Acceptance criteria:

- First game or honest empty state is visible shortly after the control bar on 390x844.
- No horizontal overflow at 375px, 390px, 430px.
- Calendar export works for all visible games and selected team scope.
- Pool/playoff and bracket/list choices survive filter changes where appropriate.

2026-06-01 implementation note: mobile schedule controls now use a compact division/filter bar, a live on-page Team/Coach search field, and an accessible bottom sheet for Pool Play/Playoffs plus List/Bracket. The sheet uses draft values until Apply, includes Reset, locks body scroll while open, supports Escape close, and returns focus to the Filters button. Mobile game rows were loosened so time/status, matchup, and location breathe instead of compressing into the desktop grid.

2026-06-01 refinement note: mobile schedule row typography and badges were reduced further, with centered team/score matchups below the time/status line and lighter date/control text for better small-screen scanability.

### Phase 3 - Public Registration Review Step

Likely files:

- `app/[orgSlug]/[tournamentSlug]/register/page.tsx`
- `app/[orgSlug]/register/register.module.css`
- `components/marketing/RegistrationConfirmationCta.tsx` only if next-step links need polish

Tasks:

- [x] Add `review` step state.
- [x] Validate required fields before Review.
- [x] Build mobile-friendly review summary.
- [x] Include division availability, waitlist state, closed state, fee/deposit details, payment note, and organizer contact.
- [x] Include Tournament Plus custom answers and file names.
- [x] Add Edit actions that return to Info without losing entered values.
- [x] Submit only from Review.
- [x] Update stepper active/done states and mobile spacing.
- [x] Add success next links to Schedule, Rules, and Home when visible.

Acceptance criteria:

- Stepper labels match actual flow.
- A required custom field/file blocks Review and points the user back to the relevant input.
- Waitlist submissions clearly say the team is joining the waitlist before final submit.
- Success state explains organizer review and external payment handling.

### Phase 4 - First Viewport And Post-Event Home Story

Likely files:

- `components/public/TournamentHomeContent.tsx`
- `app/[orgSlug]/Home.module.css`
- Possibly `lib/public-tournament-data.ts` if more facts are needed

Tasks:

- [ ] Redesign mobile hero fallback around event facts rather than abstract-only decoration. Deferred to separate design project.
- [x] Add state-dependent tournament-day home mode so in-progress events lead with useful games/results/venue information.
- [x] Reduce the in-progress mobile hero height so the tournament-day panel appears sooner.
- [x] Add the browser-local followed-team home card when a visitor has saved a team on the device.
- [x] Keep Tournament Plus banner behavior intact.
- [x] Prefer Final Standings/Results CTA when tournament status is completed and those pages are visible.
- [x] Add free post-event public record framing.
- [ ] Add Plus-branded completed-event recap treatment only where supported by current data. Deferred to separate design project.
- [ ] Verify Powered by badge and acquisition banner do not obscure primary mobile actions. Browser visual verification closed out of this project.

Acceptance criteria:

- Mobile home first viewport shows event name, dates/status, host, and primary action.
- No banner fallback still feels trustworthy and event-specific.
- Completed tournaments point visitors toward final standings/results where available.
- Plus branding remains visible but does not reduce basic usability.

2026-06-01 implementation note: the first Phase 4 slice adds Tournament Day Home Mode for in-progress/public-schedule events. The public home now shows a day panel with Today's Games, Latest Finals, Field Shortcuts, Event Snapshot, and a browser-local My Team card when a visitor has followed a team. The full event-specific fallback hero redesign and completed-event recap framing remain open.

2026-06-02 completed record note: completed tournament home now becomes a final public record instead of showing an empty upcoming-games block. The hero compacts, the primary action prefers Final Standings, Schedule is relabeled as Game Log, and a Final Public Record section shows score counts, pending-review/unscored counts, accepted teams, top standings by division, and latest final scores linking into public game details. Browser visual testing and design-only refinements are closed out of this project and should move to a separate design project.

### Phase 5 - Page-Specific Public Polish And Analytics Surfaces

Likely files:

- `app/[orgSlug]/[tournamentSlug]/teams/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/standings/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/results/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/news/page.tsx`
- `components/marketing/TournamentAcquisitionBanner.tsx`
- `components/marketing/PoweredByBadge.tsx`
- `components/marketing/RegistrationConfirmationCta.tsx`

Tasks:

- [x] Standardize mobile empty states on Teams, Standings/Results, Schedule, Register, Rules, News, game details, and public home schedule/news fallbacks. Team Profile loading/error microstates remain route-specific.
- [x] Add browser-local Follow My Team preference across Teams, Team Profile, and Schedule.
- [x] Improve public Results/Standings mobile clarity for final scores, pending-review scores, followed-team usefulness, and completed-tournament record value.
- [ ] Add route-specific acquisition analytics surfaces such as `public_schedule`, `public_register`, `registration_confirmation`, and `public_powered_by_badge`.
- [ ] Check long team names, division names, rules/resources, and news titles at mobile widths.
- [ ] Ensure hidden nav pages are absent from nav but direct URLs remain useful.

Acceptance criteria:

- Route-specific analytics surfaces are more precise than the current `public_home` default.
- Empty states consistently tell visitors what to do next.
- Public pages stay readable with long real-world tournament names and team names.

2026-06-01 Results/Standings implementation note: `/{orgSlug}/{tournamentSlug}/results` continues to redirect into Standings, so the public Standings page now carries the combined Results & Standings experience. Mobile visitors see division-level counts for final scores, pending-review scores, and games remaining; followed-team visitors get a My Team record/latest-score panel with schedule/profile shortcuts; standings rows show a visible Pending badge instead of only an asterisk; and a Recent Scores section gives completed tournaments a clearer final public record. Shared public standings data now includes games, accepted teams, and venues so the score record can render from the public page payload.

2026-06-02 density refinement note: after mobile review, the product split is Schedule owns game-by-game scores and Standings owns ranking/consequences. Mobile Standings now uses a compact `final / pending / remaining` line, a slim My Team strip, a reduced `Team / REC / RD / PTS` table, and hides the duplicate Recent Scores feed on phones. Mobile Schedule rows were tightened into dense game-log rows with time, matchup, score/status, and venue using less vertical space.

2026-06-02 visual hierarchy refinement note: a follow-up mobile review found the standings header too cramped and the dense schedule rows too far from the admin Results & Scoring pattern. Standings now keeps tie-breaker order as footer context below the table instead of in the header. Public Schedule/result rows now mirror the admin scoring row structure: short date dividers, compact date/time plus status, centered W/L/T score matchups, muted venue context, and a followed-team star in the right rail instead of the admin edit pencil.

2026-06-02 density correction note: after another mobile review, the rule is to compress supporting chrome before shrinking core data. Public Schedule mobile controls, followed-team bar, TBD notice, and score-row metadata were tightened. Mobile Standings table text and padding were increased again because the table was readable on phone; the surrounding summary/My Team chrome remains compact.

2026-06-02 row cleanup note: public Schedule rows no longer show "Scheduled" on every unscored game. Final/Pending/Cancelled status badges stay in the top-right rail on the same row as date/time and render before the followed-team star. Venue display now uses two compact lines when data is available: parent venue first, facility/surface second, with the whole block still linking to maps.

2026-06-02 row/detail split note: follow-up product review moved venue context out of the high-volume Schedule list. Public Schedule rows now act as compact selectable game-index rows with date/time, matchup, score/status, and followed-team star only. A new public game details route owns venue, facility/surface, Google Maps link, notes, division, stage, status, and full matchup context.

### Phase 6 - Verification, Docs, And Handoff

Tasks:

- [ ] Run TypeScript and focused lint for touched files.
- [ ] If new files/shared modules are added, restart the dev server per AGENTS.md before browser handoff.
- [ ] Update this plan with verification results.
- [ ] Update PM brief if product decisions change during implementation.
- [ ] Update memory and TODO at handoff.

Acceptance criteria:

- Non-browser verification passes.
- Browser UAT checklist below is ready for user sign-off.
- No dev server is left in a broken/restarting state.

## UAT And Browser Verification Plan

Per project workflow, the user owns browser-based visual verification unless explicitly requested otherwise. The implementation handoff should provide URLs and exact scenarios.

Recommended orgs:

- Free Tournament: `uat-test-org`
- Tournament Plus: `uat-plus-org`

Viewports:

- Mobile small: 375x667
- Mobile target: 390x844
- Mobile large: 430x932
- Desktop sanity: 1440x1000

Global checks:

- No page-level horizontal scrollbar.
- First useful action or state is visible without excessive control stacking.
- Touch targets feel at least 44px high.
- Buttons and filter summaries wrap without clipping.
- Nav hidden pages are not shown.
- Direct hidden-page URL shows helpful unavailable state.
- Organizer contact email appears where available.
- Light mode Plus branding remains readable.
- No stuck loading, wrong-org data, 500s, or console request failures.

Schedule scenarios:

- Many divisions with long names.
- Long team names in team filter.
- All divisions unpublished.
- One division unpublished.
- Pool Play list.
- Playoffs list.
- Playoffs bracket.
- Selected team filter.
- Calendar export with no team selected.
- Calendar export with selected team.
- No games for selected filter.

Registration scenarios:

- Open registration with standard fields.
- Open registration with Tournament Plus custom required field.
- File custom field where applicable.
- Full division triggering waitlist.
- Closed division.
- Tournament registration not open.
- Hidden Registration page direct URL.
- Review step Edit action.
- Successful submit Next Steps state.
- Failed submit/error state if safely reproducible.

Public page scenarios:

- Home with no Plus banner configured.
- Home with Plus banner configured.
- Completed tournament home.
- Standings before games.
- Standings after games.
- Results/final scores.
- Teams empty.
- Teams grouped by division/pool.
- Team profile with no games.
- Rules empty and populated.
- News empty and populated.

## Open Questions

- Should Tournament Plus eventually get a public shareable post-event recap route, or should the Plus Summary remain admin-only for now?
- Should the schedule bottom sheet apply filters immediately or require an explicit Apply button? This plan recommends Apply for predictable mobile control.
- Should the public Results route be merged conceptually with Standings in mobile navigation, or remain separate as currently routed?
- Should the hero show primary venue/location if the tournament has multiple diamonds? Current data may not provide a single canonical venue.

## Final Recommendation

This project is closed and archived. Future work should start from a new plan for public visual/design refinement, analytics surfaces, or a Plus shareable post-event recap rather than reopening this implementation project.
