# Plan & billing — Stage 4 handoff and owner walk

**Implemented 2026-10-30, following the owner's four rulings in this session.**
Plan: [one experience](PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md). Authority:
[Stage 4 prompt](PLAN_AND_BILLING_STAGE4_BUILD_PROMPT.md). Stage 3 prerequisite verified at `32093672f`.

## Customer outcome and roles

Team settings starts with a read-only card: a building icon, “Plan”, “Covered by {Club}”, and
“Your club pays for this team’s Coaches Portal. There is nothing to manage here.” The card reuses
`CoachCard`, `CoachEyebrow` and the coach header icon tile, with wrapping for long club names. It has
no prices, links, buttons or new tap targets. Billing remains owner-only.

The existing authenticated team GET supplies nullable `planCoverage`, after its team/org/entitled-membership
checks. A viewer who is an active owner/admin of the PAYING club gets no card. A linked workspace's own
owner may still be covered by another club; the role read uses the payer's ID, not the workspace's.
Today's Team settings access includes every active coach (Club Tier 4c-2); the older prompt's assistant
example does not authorize narrowing that access. No settings grants were changed.

## Owner rulings accepted in this session

1. **Hide for the paying club's owner/admin who also coaches.** Other covered coaches get the approved card.
2. **Use the CAD form on all price upsells.** Before: `$29/month per team`. After: `$29 CAD / month per team`.
   Config supplies the amount; the billing words module supplies the price format, “per team”, and founding variants.
3. **Keep today's destinations.** Checkout when open, the explainer when gated, including “See everything it includes”.
   Source/team parameters and founding CTA variants are preserved. No plan-details step or Premium → Club path.
4. **Move Explore's existing list into the registry.** The `explore` variant preserves all seven descriptions/order,
   including assistant coaches with their own sign-in. Billing's and the published article's lists stay intact.

All four upsell files source the full plan label from config, including Explore's aria-label and StartInterest's
heading/thank-you sentence. ScopeShelf's Support-console `note` and its caller are preserved.
These before/after amounts illustrate the approved format; [Plan & pricing facts](../../agents/strategy/PLAN_PRICING_FACTS.md)
and `lib/plan-config.ts` remain pricing authority and were checked to agree.

## What “club-paid” means

- Native non-team-workspace orgs cover their teams. This follows `isTeamWorkspaceOrg` and the existing
  club-owned-team entitlement bypass, rather than assuming only the `club` plan qualifies.
- A team workspace can also be covered: `club_included`, `org_team_addon`, or `club_extra_team`, with a
  different identifiable `billingOwnerOrgId` and active/trialing/past-due workspace coverage. These are the
  Support console's `CLUB_BILLED_MODES`; `applyOrgTeamAddonBilling` writes the payer ID and cancels direct coverage.
- The payer's name comes through the existing `getOrganizationBySlug` reader and entitlement door, so staff grants
  retain their ordinary effect. No new raw organization-plan/status reader or guard exemption is introduced.
- Direct payment, staff platform overrides, visibility-only links, archived workspaces, old moved-workspace
  addresses, missing/self/workspace payers, unknown/incomplete/unpaid/cancelled coverage have no card.
  A moved team is covered under its new native club. Existing cancellation walls/auth rails stay authoritative.
- **Ambiguous cases held:** a club mode with missing payer/unknown subscription status makes no coverage claim.
  A failed payer or role read hides the card and logs the failure; the rest of Team settings still loads (owner ruling
  2026-10-30, replacing the earlier throw-into-the-error-path behaviour). The resolver still throws; the settings GET catches it. A missing active membership in the paying club is allowed: a linked coach need not be that club's member.
  A missing/unreadable paying organization yields no card. No live data census of these legacy cases was performed.

## Money wording collision

No Money edits. Dues says “covered by credits” in `CollectionSchedule.tsx`, and “Covered by fundraising” /
“Covered by credit” in `panel.tsx`. These describe family-fee settlement. The new card names the club, labels
itself Plan, and explicitly names the team's Coaches Portal on Team settings. Confusion risk is low.

## Baseline cleanup findings

The deleted implementations occur only in the three existing guards (and docs); those guards and `getBillingHref`
remain. `check-public-tokens.mjs` stays unchanged. No layout sweep/baseline refresh ran.

Both required generators were attempted, without hand-edits:

- `npm.cmd run check:css-selectors:init` removes the obsolete billing CSS entry, but also admits unrelated new dead
  classes and four platform-admin orphan imports. Its output was restored to its starting contents rather than
  accepting unrelated regressions. This baseline awaits a clean generator run.
- `node scripts/check-admin-type.mjs --init` refuses to write because of unrelated rises:
  `components/admin/kit/club/PayoutsCard.module.css: face 0 → 1`,
  `components/shared/SystemScreen.module.css: track 0 → 1`, and
  `app/platform-admin/early-access/[leadId]/lead.module.css: face 0 → 1`.
  Its stale billing entry likewise awaits a clean generator run. No shared check script was changed.

## Changed files, grouped

- Coverage: `lib/team-plan-coverage.ts`, `components/coaches/TeamPlanCoverageCard.tsx` and its CSS;
  the existing team GET and Team settings page.
- Shared plan facts/copy: `lib/plan-billing-profile.ts`, `lib/plan-billing-words.ts`;
  ScopeShelf, CoachExploreCatalog, ScopeCeilingInterest, CoachStartInterest.
- Tests: `team-plan-coverage`, `plan-billing-coach-upsells`, and the existing profile/source guard tests.
- Tracking: this walk, the main plan, PM brief, and TODO index. Other sessions' edits are preserved.

## Validation and state coverage

The active source guard covers all four upsells and the new card, including JSX/aria-label plan names;
no literal exceptions or deferred tests. Rendered upsell tests replace the config name/price to prove the
screens follow data, and exercise normal/founding copy, both checkout gates, destinations and the Support note.
The actual payer resolver is tested across modes/statuses, payer types and roles. The actual settings GET is
exercised for entitled assistants, denied/foreign teams, and nullable coverage; denied access never reads the payer.

Exact final check/server results are in the plan's Stage 4 progress entry. Logs: `.probe/plan-billing-stage4/`.
A first raw-payer-column read was caught by the plan-reader guard and corrected by reusing the existing reader.

| State/flow | Automated evidence | Remaining owner check |
|---|---|---|
| Native/linked club payment, direct payment, platform free time | Resolver matrix and actual settings GET | Live fixtures and payer name |
| Paying-club owner/admin; linked workspace owner | Payer-scoped role query and error/absence cases | Browser role switch |
| Cancelled/past due/trial/unknown/missing payer | Resolver matrix; existing walls retained | Live wall and grace-period appearance |
| Removed/unentitled/foreign-team coach | Actual API refuses before payer lookup | Browser access |
| Loading/error/empty coverage | Existing settings path; error propagation and empty card render | Loading/error appearance |
| Normal/founding/gated upsells | Rendered tests with changed config and existing URLs | Readable layout and click-through |
| 390px, long name, warm/dark | Wrapping rules; escaped name render; first-card placement | Geometry and appearance |
| Stripe success/card saved/next season/move/invoices | Payment code unchanged; destinations retained | No new Stripe flow walked in Stage 4 |

## Owner walk

- [ ] Club coach: exact read-only Plan card first, with the correct club name and no billing door.
- [ ] Long club name at 390px and desktop; warm/dark themes; no horizontal overflow.
- [ ] Paying club owner/admin who coaches: card absent; billing still owner-only.
- [ ] Linked club-paid workspace: paying club name; its workspace owner remains eligible unless also club owner/admin.
- [ ] Direct standalone, Basic, platform free time: card absent.
- [ ] Cancelled/suspended club or linked coverage: wall/no working settings card.
- [ ] Removed/unentitled coach: existing denial; eligible assistants retain current settings access.
- [ ] Empty/loading/error: existing settings treatment, with no unsupported coverage claim.
- [ ] Normal/founding/gated upsell copy and existing destinations; Explore's unchanged list; saved-work note retained.

Done 2026-10-30: `/simplify`, `/review` (no Critical/High/Medium; see the plan's Stage 4 "Claude steps" entry), `/docs` (coach FAQ
“Who pays for my team?”). Baseline cleanup stays blocked by other projects' rises and orphans (same entry). Added to the walk: Explore's
non-founding price now reads “$29 CAD / month” in the large price type — check it does not crowd the button at 390px.
Walk artifact published 2026-10-30: https://claude.ai/artifact/CQEVBr87PcDbvA8aatRnni (source `PLAN_AND_BILLING_STAGE4_OWNER_WALK.html`, ledger §429).
Baseline cleanup has the findings above. Commit only on the owner's instruction; never push from this task.
