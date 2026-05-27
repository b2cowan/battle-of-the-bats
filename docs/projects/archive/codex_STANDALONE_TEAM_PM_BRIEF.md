# Standalone Team Workspace PM Brief

## Proposed Functionality

FieldLogicHQ should launch a standalone Team workspace as a first-class product, not as a later bolt-on. The workspace gives a coach or team manager a complete operating home for one competitive team: roster, schedule, dues, budget, documents, payment reminders, lineup cards, tournament history, and the ability to create free-tier local tournaments.

The product should still use the existing organization-scoped data model behind the scenes. A standalone team gets a lightweight technical organization record, but the customer sees a team-first experience instead of an org admin shell.

## Current Implementation Status

- Phase 2A is complete: the Team provisioning service creates the lightweight workspace org, rep team, active season, coach assignment, workspace row, entitlement row, and ledgers.
- Phase 2B is complete for checkout plumbing: direct Team checkout, webhook recovery, subscription sync, and checkout completion redirect shell are implemented; Stripe sandbox price verification remains pending.
- Phase 2C is complete: Team workspaces now default to the Coaches Portal, the landing page uses Team-first language, coach-facing access is filtered through active team entitlements plus coach assignment, and org-wide rep-team admin remains gated behind `module_rep_teams`.
- Phase 2D is complete: `/team` is the public coach signup surface, Team-only account creation avoids normal org onboarding, and the form starts the existing Team checkout flow.
- Phase 2E is closed by user sign-off: Platform Admin Dev Tools has a Team checkout readiness checker for Stripe price IDs, webhook secret, app URL, and Team availability, plus the mock-billing toggle and setup checklist.
- Phase 3A is complete: tournament team contacts can open secure claim links, see prefilled team activation details, and proceed through Team checkout with email verification.
- Phase 3B is complete: tournament organizers can select eligible teams from the tournament teams admin screen and send Team workspace claim invitations in bulk. Claimed, waitlisted, rejected, and missing-email teams are skipped so organizers do not need to manually manage claim safety rules.
- Phase 4A is complete: standalone Team coaches can request a Basic visibility link to a parent organization, and organization owners/admins can approve or decline the request from Organization Admin. Approval records the association without transferring billing, ownership, roster/document/accounting access, or org-wide rep-team admin rights.
- Phase 4B is complete: organization owners/admins can invite a standalone Team workspace to connect, and the Team coach can accept or decline from the Coaches Portal. Acceptance creates the same Basic visibility association as Phase 4A and still does not transfer billing, ownership, roster/document/accounting access, parent-org team entitlements, or org-wide rep-team admin rights.
- Phase 4C is complete: once Basic linking is active, coaches can request org-paid Team billing or accept an org billing invitation, and organization owners/admins can approve and complete org Team add-on checkout. The organization becomes the payer while the coach keeps day-to-day ownership and Basic sharing remains the access boundary.
- Phase 6A is complete and smoke-tested: coaches can open schedule events and mark active roster players In, Out, Late, or Unknown with optional notes. This adds the first game-day value feature without changing linked-org visibility or ownership boundaries.
- Phase 6B/6C are complete and smoke-tested: coaches can save baseball/softball lineups in Everyone bats or 9 player ball mode, export lineup PDFs, and see a data-driven Season setup checklist on the team overview.
- Phase 7A is complete and smoke-tested: public pricing now starts with a segment choice, presents Team as the path for one competitive team, defaults the Team CTA to seasonal signup, and keeps organization pricing/onboarding unchanged.
- Phase 7B is complete and smoke-tested: the public Team page now acts as a coach-specific landing page around the existing signup form, emphasizing tournament continuity, season operations, game-day tools, quick local tournaments, and parent-org readiness.
- Phase 7C is complete and smoke-tested: tournament registration confirmation, public tournament banners, registration/claim emails, and post-event results emails now tell coaches how to keep tournament teams organized in a Team workspace while preserving existing organizer CTAs.
- Phase 7D is complete: billing surfaces now guide Team coaches toward parent-org linking and org billing when appropriate, and guide organizations with three or more active org-paid Team add-ons toward Club as the better multi-team operating model. These prompts are informational and do not change access, ownership, or billing state by themselves.
- Phase 8 focused automated launch verification is complete: pricing, direct Team mock checkout, tournament-claim mock checkout, one free-tier Team tournament slot, Basic org linking, coach attendance access boundaries, lineup/checklist, and platform-assisted ownership transfer all pass. Remaining launch checks are manual Stripe/mobile/cancellation checks rather than new product functionality.
- Phase 9 is complete for launch cleanup: coach, organization, and platform-admin help now explain Team, season rollover, free-tier local tournaments, org linking, billing transfer, ownership transfer, Team add-ons versus Club, and launch readiness. A dedicated owner launch checklist now covers Stripe Dashboard setup, FieldLogicHQ price rows, manual sandbox smokes, and release notes.

## Strategic Shift

The original research treated standalone Team as a second phase because independent coaches looked like a cold acquisition market. The business strategy has changed: coaches are already one of the best acquisition targets because they participate in tournaments hosted on FieldLogicHQ.

That turns standalone Team into a tournament-to-team conversion funnel:

1. A coach participates in a FieldLogicHQ tournament.
2. They experience the public schedule, results, communications, and event operations.
3. FieldLogicHQ invites them to keep managing the same team after the tournament.
4. The coach activates a Team workspace with roster, dues, schedule, documents, accounting, and lineup tools.
5. The coach can also create quick unofficial tournaments with nearby teams, giving those invited teams a natural first exposure to FieldLogicHQ.
6. If the team later connects to a parent organization, billing and selected data can be linked or transferred.

This is a stronger path than asking coaches to discover FieldLogicHQ from scratch.

## Why It Matters

The current Club-only model creates a gap. A coach can interact with FieldLogicHQ during a tournament but has no clean next step unless their full organization buys Club. That wastes a warm acquisition moment.

Standalone Team gives FieldLogicHQ a small, high-value product that can convert coaches who already know the platform. It also creates internal champions inside clubs: a coach can start with one team, prove the workflow, and later bring the parent organization into Club.

Team should also include the free Tournament-tier toolset as a selling feature. A coach who organizes a quick local round robin, exhibition weekend, or unofficial mini-tournament is creating a marketing loop for FieldLogicHQ because every invited team touches the public schedule, results, registration, and communication experience.

## Customer Impact

- Coaches get a polished season-management workspace without needing board approval.
- Tournament organizers indirectly become a lead source for Team subscriptions.
- Team subscribers become lightweight tournament organizers, creating a second acquisition loop through the local teams they invite.
- Parents and players get a more organized team experience through better schedules, dues tracking, documents, and communication surfaces.
- Organizations can later link to or take over teams instead of forcing coaches to recreate data.
- Club remains the executive layer for multi-team oversight, house league, full accounting, public site, and organization administration.

## Product Model

Every rep team should be treated as a workspace that can have one of three relationship states:

| State | Meaning | Billing |
| --- | --- | --- |
| Independent | Coach or manager owns the team workspace. No parent organization is connected. | Team pays directly. |
| Linked | Team remains coach-managed but is associated with a parent organization for visibility, billing, or selected reporting. | Coach or org can pay, depending on link settings. |
| Org-owned | Team is fully owned by a Club organization. Org admins manage oversight and billing. | Included in Club rules or billed as extra team quantity. |

This avoids a false choice between "standalone" and "org team." The better model is: a team can start independent, link to an org, and eventually become org-owned if both sides want that.

## Season Identity And History

A standalone Team workspace should behave like a team inside an organization: the workspace persists across seasons, but each season can have its own identity and operating data.

Example: "U13 Jr Milton Bats" may become "U13 Sr Milton Bats" the next season, with a new roster, new schedule, new dues plan, new budget, and new documents. The team should not have to create a brand-new account and lose history. Instead, the coach starts a new season/program year inside the same workspace.

The customer-facing history should show:

- Prior season names and age groups.
- Prior rosters, schedules, dues, documents, budgets, and tournament participation.
- Current season workspace with the active team name and current operating data.

This matters for tournament-to-team acquisition because a team may be claimed from one event, continue through multiple seasons, and later link to or transfer into a parent organization without losing its record.

## Billing Model

Billing ownership should be separate from data ownership.

Recommended billing modes:

| Mode | Meaning |
| --- | --- |
| Direct Team | Coach/team manager pays for one Team workspace. |
| Org Team Add-on | A Tournament Plus or League org pays for a specific linked team without upgrading to Club. |
| Club Included | A Club org owns the team under its included rep-team allowance. |
| Club Extra Team | A Club org owns more active rep teams than the included allowance and pays the lower Club extra-team rate. |
| Platform Override | Platform admin grants temporary access for trials, support, or migration cleanup. |

Locked pricing:

- Public plan name: **Team**.
- Direct Team and org-billed Team add-on: **$29 CAD/team/month** or **$290 CAD/team/year/season**.
- Club extra rep team add-on: **$19 CAD/team/month** or **$190 CAD/team/year**, replacing the previous $20/$200 price point so Club clearly has better per-team value.
- Team includes free Tournament-tier tournament creation by default. This should allow one non-archived tournament at a time, matching the free Tournament plan's simple one-off event model. It should not include Tournament Plus features or formal archive workflows unless the team later upgrades or buys a separate tournament upgrade.

Club should still be positioned as the better value once an organization has 3 or more active paid teams because it adds executive visibility, accounting, house league, tournaments, public site, and staff management. This should be a soft nudge only. If an organization chooses to keep paying the higher Team add-on rate instead of subscribing to Club, the product should allow that.

## Data Linking

The team-to-org link should control what the organization can see and do. It should not automatically expose all player, document, medical, or parent data.

Recommended sharing levels:

| Sharing Level | Org Can See |
| --- | --- |
| Basic | Team name, sport, age group, coaches, season, tournament history, roster count. |
| Roster Summary | Basic plus player names and jersey numbers. |
| Financial Summary | Basic plus dues totals, paid/unpaid summary, budget summary, and team ledger summary. |
| Full Org-Owned | Full team data under the organization's normal Club permissions. |

Sensitive data such as medical notes, private documents, parent contact details, and coach notes should stay private unless the team becomes org-owned or an explicit sharing rule is introduced later.

Default sharing level when a Team links to an organization: **Basic**. The organization should see the team identity, coach contact, season, tournament history, and roster count unless both sides approve a higher sharing level or the team becomes org-owned.

## Core Customer Journeys

### Tournament Coach Claim

A coach participates in a tournament and receives a post-registration or post-event CTA:

> Keep managing this team on FieldLogicHQ.

The coach signs in, verifies access to the tournament team contact email, and activates a Team workspace prefilled with team name, sport, age group, and tournament history.

Organizers can also trigger this from the tournament teams admin screen by selecting pending or accepted teams and sending Team claim invitations. This supports post-event follow-up without forcing organizers to manually build one-off links.

### Direct Team Signup

A coach lands on a Team page, starts a Team subscription, creates the team, and enters the coaches portal immediately.

### Org Links A Team

An organization invites an independent Team workspace to link, or the coach requests to link to the organization. The implemented first link is Basic visibility: both sides approve the association, but the coach keeps billing, ownership, roster, documents, accounting, and day-to-day team access. Once Basic linking is active, the coach and organization can also approve org-paid billing without expanding data access. Full org-owned transfer remains a later, higher-impact workflow.

### Org Takes Over Billing

A Club, League, or Tournament Plus org can become the billing owner for a linked team. The team's operational workspace does not need to be destroyed or recreated. Billing switches first; full data ownership can happen later.

Billing transfer requires approval from both sides: the coach/team owner and the organization owner. The organization completes the org Team add-on checkout, while the coach keeps the Coaches Portal and Basic sharing remains the access boundary.

### Team Becomes Org-Owned

If both sides approve, the team can be fully absorbed into the organization's rep team module. The coach keeps portal access, and the org gains normal admin visibility.

## MVP Scope

The first build should include:

- Team plan and pricing catalog support.
- Lightweight team workspace creation using a hidden/stub organization.
- Team-first onboarding for direct coach signup.
- Tournament-team claim flow from tournament registration/contact data.
- Multi-season Team workspace lifecycle: create a new season/program year, update season name/age group, and preserve previous seasons.
- Team-to-org link requests and approvals.
- Billing ownership modes for direct Team and org-billed Team add-on.
- Coaches portal access for standalone and linked teams.
- Free-tier tournament creation for Team workspaces, positioned as quick local tournaments or exhibition weekends with other nearby teams.
- Team billing/settings page with "link to organization" and "transfer billing" actions.
- Platform admin visibility into team workspaces, links, and billing state.
- Segment-first pricing entry for "I manage one competitive team." Implemented and smoke-tested on public pricing.
- Initial coaches portal value package: roster, schedule, dues, documents, budget, payment reminders, attendance, first-run setup checklist, and baseball/softball lineup PDF. Attendance is implemented. Roster position fields, lineup building, and the coach overview setup checklist are implemented and smoke-tested: coaches can choose Everyone bats or 9 player ball, plan defensive positions by inning, treat Bench as an inning position in Everyone bats, and export lineup PDFs. Public pricing and the Team landing page now explain this package without requiring coaches to understand Club pricing.

## Not In MVP

- Full parent portal.
- Full in-app group messaging.
- Real-time scorekeeping or advanced player stats.
- GameChanger API integration or CSV import.
- Tournament Plus tournament features for Team workspaces unless separately upgraded.
- Medical/allergy fields unless privacy language and access controls are approved.
- Fully self-serve complex merge conflict resolution.
- A separate team tenant model that bypasses organizations.

## Success Criteria

- A tournament coach can activate a Team workspace without creating a full organization manually.
- A direct coach signup can reach the coaches portal after checkout and team setup.
- A Team subscriber can create and run a free-tier local tournament from the Team workspace.
- A standalone coach can roll a team into a new season with a new name, roster, schedule, dues, and budget while keeping prior-season history.
- A Team workspace can be linked to an existing organization without recreating roster, schedule, dues, or documents.
- Billing can be owned by the coach or by a linked organization.
- A Club org can absorb a team into org-owned state with no loss of core team data.
- Team workspaces do not unlock unrelated org admin modules.
- Club remains clearly more valuable for multi-team organizations.

## Release Strategy

Build the final intended product model from the onset. There are no live clients yet, so the implementation does not need to preserve a staged beta packaging model. The work can still be delivered internally in phases, but the data model, billing model, and UX should assume public Team signup, tournament claiming, org linking, billing transfer, and Club upgrade paths from the beginning.

1. Build the Team workspace foundation and direct Team onboarding.
2. Add tournament-to-team claiming.
3. Add team-to-org links and billing transfer.
4. Add segment-first pricing and coach-facing tournament CTAs.
5. Add the first coaches portal enhancement bundle.

The foundation should be designed up front so that direct Team, tournament-claimed Team, org-billed Team add-on, and Club-owned Team all use the same underlying team workspace model.

## Locked Product Decisions

- Public name: **Team**.
- Direct Team and org-billed Team add-on price: **$29 CAD/team/month** or **$290 CAD/team/year/season**.
- Club extra rep team add-on price: **$19 CAD/team/month** or **$190 CAD/team/year**.
- Team includes free Tournament-tier tournament creation as a default selling feature.
- Team tournament access is limited to one non-archived/free-tier tournament at a time.
- Launch posture: build the final public product model, not an invite-only beta-only structure.
- Default org-link sharing level: **Basic**.
- Billing transfer approval: both coach/team owner and organization owner must approve.
- Club upgrade path: soft nudge at 3+ active paid teams; no hard stop if the organization chooses to keep paying the higher Team add-on rate.
- Seasonal billing should be the default presentation, with monthly available as a secondary option.
- Existing free Tournament orgs are allowed to pay for org-billed Team add-ons by default.

## Launch Documentation And Stripe Prep

Phase 9 delivered launch documentation for:

- What the Team plan includes.
- How coaches create and roll over seasons while preserving history.
- How free-tier Team tournaments work and when to upgrade to Tournament Plus.
- How org linking and Basic sharing work.
- How billing transfer works and why both sides approve it.
- How Team, org Team add-ons, Club included teams, and Club extra teams differ.

The release now includes `docs/projects/active/codex_STANDALONE_TEAM_LAUNCH_CHECKLIST.md` as the owner checklist. The expected Stripe updates remain:

- Create Team monthly price at **$29 CAD**.
- Create Team annual/seasonal price at **$290 CAD**.
- Create org Team add-on monthly price at **$29 CAD**.
- Create org Team add-on annual/seasonal price at **$290 CAD**.
- Create new Club extra rep team monthly price at **$19 CAD**.
- Create new Club extra rep team annual price at **$190 CAD**.
- Replace the old $20/$200 Club extra-team price references in FieldLogicHQ after the new Stripe prices exist.
- Confirm sandbox and live Stripe price IDs are entered in the platform's Stripe price configuration before launch.
