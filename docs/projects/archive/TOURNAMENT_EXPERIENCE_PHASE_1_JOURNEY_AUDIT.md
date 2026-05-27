# Tournament Experience Excellence - Phase 1 Journey Audit

> Status: Complete - static audit
> Completed: 2026-05-22
> Parent plan: `docs/projects/archive/TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md`

## Audit Method

This was a static journey audit of the Tournament and Tournament Plus experience. No browser visual verification was run in this phase.

Sources reviewed:

- Public pricing and onboarding entry points.
- Tournament admin routes under `app/[orgSlug]/admin/tournaments/**`.
- Tournament management route at `app/[orgSlug]/admin/org/tournaments/page.tsx`.
- Public tournament routes under `app/[orgSlug]/[tournamentSlug]/**`.
- Tournament plan feature definitions in `lib/plan-features.ts`.
- Plus-gated API routes for registration, schedule, communication, branding, cloning, and summaries.
- Project plans now archived with this record: `TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md`, `TOURNAMENT_SECTION_REVIEW_PLAN.md`, and `TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md`.

## Executive Summary

The core product direction is sound: free Tournament is a complete starter-event product, and Tournament Plus is the serious operations plan. The biggest Phase 1 product-boundary finding has been resolved: free Tournament includes basic selected-row registration updates and waitlist collection, while Tournament Plus owns registration exports, payment reminders, targeted communication, custom fields, waitlist promotion/automation, and reporting.

The second major theme is workflow density. Registrations, Schedule, and Results have moved to the shared records-first pattern and passed Phase 2C data-rich QA for Free and Tournament Plus on desktop and mobile. Communication, Dashboard, Branding, Registration Questions, and the supporting setup pages still carry stacked controls, repeated locked states, or old page-specific layouts.

The third theme is mobile. Public schedule and several admin routes still rely on inline flex rows, tab strips, and dense tool clusters that need real mobile verification before the experience can be called tournament-day ready.

## Journey Map

| Journey | Primary Routes | Current Read |
| --- | --- | --- |
| Signup and first setup | `/pricing`, `/{orgSlug}/admin/onboarding`, `/{orgSlug}/admin/org/tournaments`, `/{orgSlug}/admin/tournaments/dashboard` | Strong plan positioning, but Plus setup prompts need sharper follow-through after the first tournament is created. |
| Tournament setup | `dashboard`, `settings`, `settings/event`, `settings/registration-fields`, `branding`, `venues`, `rules`, `contacts`, `age-groups` | Setup exists, but navigation is split between dashboard nudges, settings cards, and re-exported org pages. |
| Registration intake | Public `register`, admin `teams`, registration export/bulk/payment APIs | Functional and increasingly strong. Bulk action and waitlist boundaries are now explicit; Phase G should verify code/copy/API behavior stays aligned. |
| Schedule and scoring | Admin `schedule`, admin `results`, public `schedule`, public `standings` | Feature-complete. Admin Schedule and Results are reformatted; Phase 2C data-rich QA passed for Free/Plus desktop/mobile, including seeded games and Results score modal entry. |
| Communication | Admin `communication`, admin `announcements`, `api/send-message`, public `news` | Targeting is gated and server-protected, but composer-first UX still needs work. |
| Public participant path | Public home, register, schedule, standings, teams, rules, news | Solid surface area; mobile controls and hidden/empty states need polish. |
| Post-event flow | `summary`, `archives`, public results/standings, clone routes | Plus summary is strong; free post-event next steps need a clearer product story. |
| Role and plan behavior | `lib/plan-features.ts`, scoped admin APIs, settings pages | Most gates exist, but the feature matrix and product copy need reconciliation. |

## Findings Register

| ID | Journey | Severity | Status | Finding | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| JNY-01 | Plan gates / Registration intake | High | Resolved - verify | Bulk registration boundary is now explicit: basic selected-row status/payment updates are available on all tournament plans; Plus owns registration exports, payment reminders, targeting, custom fields, waitlist promotion, and reporting. | `lib/plan-features.ts` keeps `bulk_registration_actions` at `tournament`. Pricing/help/memory now describe basic selected-row updates as free. Bulk registration analytics now use `tournament_registration_operation_used`. | Verify during Phase G that pricing, help, API behavior, and analytics remain aligned. |
| JNY-02 | Plan gates / Registration intake | High | Resolved - verify | Waitlist behavior is now split: free Tournament can collect overflow/waitlist registrations; Tournament Plus unlocks promotion, queue management, and automation. | `app/api/register/route.ts` logs waitlist joins as `waitlist_collection`. `app/api/admin/teams/route.ts` keeps `promote-from-waitlist` behind `waitlist_automation`. | Verify during Phase G that public registration, admin promotion, pricing, and help copy describe the split consistently. |
| JNY-03 | Public registration | Medium | Open | The public registration page shows a three-step indicator with "Info", "Review", and "Next Steps", but the form submits directly from the info step. | `app/[orgSlug]/[tournamentSlug]/register/page.tsx` renders the stepper but has no review screen before submission. | Either add an actual review step before submit, or simplify the indicator so it does not promise a review step. |
| JNY-04 | Signup and first setup | Medium | Open | Tournament Plus setup does not strongly prompt the paid setup tasks immediately after the first tournament is created. Custom registration questions, branding, payment-readiness setup, and targeted communication are core Plus value but are not all surfaced as first-run next actions. | Onboarding creates a draft tournament and redirects into tournament admin. Dashboard nudges include venues, fees, rules, and branding, but registration questions are primarily discoverable through Settings. | Add a Plus-aware first-run checklist or setup strip that includes registration questions, branding, fee schedule/payment instructions, staff/access, and communication readiness. |
| JNY-05 | Tournament setup | Medium | Open | Settings & Access omits several destinations that organizers naturally read as tournament setup: Branding/Public Site, Venues, Rules & Resources, Contacts, and Divisions. | `app/[orgSlug]/admin/tournaments/settings/page.tsx` includes Event Settings, Registration Questions, Tournaments & Seasons, Staff & Access, and Plan & Subscription only. | Decide whether Settings should be a complete tournament setup hub. If yes, add concise setup cards or "Related setup" links for Branding, Venues, Rules, Contacts, and Divisions. |
| JNY-06 | Tournament setup / Role context | Medium | Reconciled | Re-exported org pages were a suspected context risk. Section review Phase A/B found Venues, Staff & Access, Organization Settings, and Subscription acceptable inside the tournament admin shell; the remaining risk is page-language clarity such as the Staff & Access title. | `venues/page.tsx` re-exports `org/diamonds/page`. `settings/members/page.tsx` re-exports `org/members/page`. `settings/subscription/page.tsx` re-exports `org/billing/page`. Section review now treats these as acceptable unless browser testing shows confusion. | Do not require wrapper work now. Recheck during browser verification; fix page titles or explanatory copy only where users actually lose context. |
| JNY-07 | Core operations / Schedule | High | Fixed + verified | Admin Schedule had stacked controls before the game list. Section review C1 moved primary controls into `TournamentAdminToolbar` and advanced tools into a Tools menu; Phase 2C verified seeded Free/Plus games on desktop and 390x844 mobile with no page-level horizontal overflow or duplicate pool labels. | `app/[orgSlug]/admin/tournaments/schedule/page.tsx` was updated during the section review and org-scoped fetches now include `orgSlug`. | Continue remaining Phase H pages; Schedule core QA is complete. |
| JNY-08 | Core operations / Results | Medium | Fixed + verified | Results repeated the stacked controls pattern and rendered the Pending Review explanation inline above the game list. The legend now lives in `StatusLegendPopover`, controls use `TournamentAdminToolbar`, Export moved into the toolbar, no-current-tournament state no longer spins forever, and Phase 2C verified score modal entry on both plans and viewport sizes. | `app/[orgSlug]/admin/tournaments/results/page.tsx` has the section-review C2 reformat, org-scoped fetches, loading hardening, and Phase 2C modal verification. | Decide scorekeeper strategy separately; Results core QA is complete. |
| JNY-09 | Core operations / Communication | Medium | Open | Communication is improved, but message composition still comes after the recipient block. When recipient editing is open, filters can push the composer far below the fold. | `app/[orgSlug]/admin/tournaments/communication/page.tsx` renders Recipients first, then expanded filter cards before subject/body. | Make the composer primary, keep recipient summary compact, and move full recipient editing to drawer/bottom sheet or a tightly collapsed panel. |
| JNY-10 | Tournament setup / Branding | High | Partially fixed | Free Public Pages controls were previously below a Tournament Plus branding gate. Section review BUG-03 has reordered the free Public Pages card above the first gate; repeated/large Plus locked states still need C4 polish. | `app/[orgSlug]/admin/tournaments/branding/page.tsx` was reordered during section review; a second advanced branding gate still remains. | Complete C4: organize Branding into clear sections and replace repeated full gates with one compact locked-state pattern plus disabled inline controls. |
| JNY-11 | Tournament setup / Registration Questions | Medium | Open | Existing registration questions appear after the "Add a Question" form. For an active tournament, review/edit should come before creation. | `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx` renders the Add Question form before the existing fields list. | Show Active Questions first. Move Add Question into a modal, drawer, or compact inline action. |
| JNY-12 | Mobile / Public schedule | Medium | Open | Public schedule uses division tabs, pool/playoff toggle, team filter, bracket/list toggle, and iCal button in inline/flex rows. This is likely to wrap awkwardly or overflow with many divisions or long team names. | `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx` uses inline tab/toggle/filter rows and a team-specific "Add to Calendar" label. | Convert mobile schedule controls to a compact filter bar: division select, team filter, view mode, and one calendar action. Verify at 390x844. |
| JNY-13 | Mobile / Admin operations | Medium | Partially verified | Shared tournament-admin primitives are being adopted unevenly. Registrations, Schedule, and Results now use the shared header/toolbar layer and passed Phase 2C Free/Plus desktop/mobile data-rich QA; Communication, Dashboard, Branding, Registration Questions, and supporting pages still need adoption or verification. | Registrations uses `TournamentAdminHeader`, `TournamentAdminToolbar`, and `SelectionActionBar`. Section review C1 updated Schedule and C2 updated Results. Final Phase 2C matrix lives at `test-results/tournament-phase2c/phase2c-final-check.json`. | Continue the section review phases in the order already planned: Communication, Branding, Registration Questions, Dashboard, Manage/Archives, then supporting pages and full mobile verification. |
| JNY-14 | Scorekeeper / Day-of operations | Medium | Open | Score entry currently depends on the full Results & Scoring admin page. Phase 2C confirmed the existing Results score modal opens on desktop and mobile for both Free and Plus, but the broader scorekeeper experience may still be too dense for on-field operators. | `app/[orgSlug]/admin/tournaments/results/page.tsx` is an admin operations page with export, filters, status chips, search, and scoring modal. | Decide whether to create a lightweight scorekeeper route or make Results sufficiently mobile-first for scorekeepers. This remains an open product decision. |
| JNY-15 | Post-event flow | Medium | Open | Tournament Plus has a strong post-event summary, but the free Tournament post-event next step is less explicit. Free organizers should still understand how to publish final results, preserve the public record, and decide whether Plus is useful for summary/reporting. | `summary/page.tsx` is Plus-gated. `archives` and public results exist, but the free "after completion" story is not framed in the umbrella plan or dashboard findings. | Add a free post-event state in Dashboard/Archives: public results link, basic archive/history cue, and a compact Plus summary/clone/report prompt. |
| JNY-16 | Analytics / Public acquisition | Low-Med | Open | Public acquisition components use `surface: 'public_home'` even when shown from registration confirmation or other public routes. This limits funnel attribution. | `TournamentAcquisitionBanner`, `PoweredByBadge`, and `RegistrationConfirmationCta` all pass `surface: 'public_home'`. The current path is tracked separately, but the named surface is too coarse. | Use route-specific surfaces such as `public_home`, `public_schedule`, `public_register`, `registration_confirmation`, and `public_powered_by_badge`. |
| JNY-17 | Public hidden/empty states | Low-Med | Open | Some public hidden/empty states are generic and do not consistently give visitors the organizer contact or a useful next page. | Public register/schedule/teams/standings pages have basic empty states; registration closed has contact email, but hidden-page states are more generic. | Standardize public unavailable states with contact email when available plus links back to visible pages. |
| JNY-18 | Public visual design | Low | Open | Public tournament home falls back to an abstract decorative hero when no Plus hero image is available. It is serviceable, but it does not add much event-specific trust. | `components/public/TournamentHomeContent.tsx` renders fallback hero background elements when there is no hero banner. | Later public polish should make the fallback more event-information-led, with stronger first-viewport signal from tournament name, dates, location, status, and primary action. |

## Priority Backlog

### Phase 2 Structural Fixes

- JNY-01: Verify resolved bulk registration boundary during Phase G.
- JNY-02: Verify resolved waitlist collection vs automation boundary during Phase G.
- JNY-06: Recheck re-exported pages during browser verification; only fix title/copy where context confusion appears.
- JNY-10: Finish Branding locked-state/section polish now that Public Pages ordering is fixed.

### Phase 3 Core Operations

- JNY-07: Schedule records-first reformat is verified for Free/Plus desktop/mobile with seeded games.
- JNY-08: Results toolbar reformat is verified for Free/Plus desktop/mobile with seeded games and score modal entry.
- JNY-09: Communication composer-first reformat.
- JNY-13: Continue shared primitive adoption across admin pages.
- JNY-14: Decide scorekeeper/mobile scoring strategy.

### Phase 4 Setup And Plus Polish

- JNY-04: Plus-aware first-run setup prompts.
- JNY-05: Broaden Settings & Access or add related setup links.
- JNY-11: Registration Questions active-list-first layout.

### Phase 5 Public And Participant Experience

- JNY-03: Public registration stepper/review mismatch.
- JNY-12: Public schedule mobile control compression.
- JNY-15: Free post-event next-step story.
- JNY-16: Public acquisition analytics surface precision.
- JNY-17: Public hidden/empty state polish.
- JNY-18: Public hero fallback polish.

## Product Decisions Needed Before Implementation

1. Resolved: basic selected-row registration updates stay free; Plus owns advanced registration operations.
2. Resolved: free Tournament includes waitlist collection; Tournament Plus unlocks waitlist promotion/automation.
3. Should Settings & Access become the complete setup hub, or should setup remain split between Dashboard and individual nav items?
4. Should scorekeepers get a dedicated mobile-first scoring route?
5. Should the public page polish happen before or after the admin-page sweep?

## Verification Notes

- No browser or Playwright checks were run for the original static audit.
- Phase 2C later added a Playwright data-rich core admin matrix for Free and Tournament Plus at desktop 1440px and mobile 390x844. Registrations, Schedule, and Results all returned HTTP 200 with seeded content visible, no page-level horizontal overflow, no duplicate pool labels, no false no-tournament/loading state, no console errors, and working Results score modal entry.
- Any implementation that changes shared tournament-admin components, context providers, or route structure should follow the repo restart rule before user browser testing.
