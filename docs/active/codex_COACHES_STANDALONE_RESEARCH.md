# Coaches Standalone Research

Research date: May 21, 2026
Audience: Product owner, product manager, future implementation session

## Executive Summary

- **Recommended packaging:** Use a hybrid model. Launch an org-level per-team Rep Team add-on first for Tournament Plus and League orgs, then pilot a standalone Team plan for unaffiliated coaches once team portability and billing architecture are deliberately designed.
- **Recommended pricing:** Price the team-level offer around **$29 CAD per active team per month** or **$290 CAD per team per year/season**, with an upgrade nudge at 3 active teams: "Club is better value and gives the executive full visibility."
- **Recommended pricing architecture:** Move to a segment-first pricing experience. Keep one `/pricing` URL, but lead with "What are you trying to run?" and show only the relevant plan set for Tournament Organizers, Leagues/Clubs, or Coaches/Teams.
- **Recommended portal roadmap:** V1 should strengthen the existing coaches portal with low-risk, game-day utilities: lineup cards/PDFs for baseball and softball, attendance, and lightweight equipment/jersey tracking. Advanced stats and GameChanger integration should wait.
- **GameChanger recommendation:** Do not build against unofficial GameChanger APIs or scraping paths. If baseball/softball demand is strong, support CSV import later and separately pursue a partnership conversation.

## PM Recommendation Memo

FieldLogicHQ should stop treating rep teams as only a Club-tier feature. The current Club plan is the right package for an executive running a whole organization, but it is too large and too expensive for a single coach who needs roster, schedule, dues, documents, and budget tools for one team.

The cleanest customer-facing story is:

1. **Club** is for organizations that want executive oversight across all rep teams, house league, accounting, and public operations.
2. **Team Add-on** is for existing FieldLogicHQ orgs that want to unlock the coaches portal for one or two rep teams without moving the whole org to Club yet.
3. **Team Plan** is for an unaffiliated coach or team manager who wants the coaches portal for one team and may later bring that team into a full organization account.

This gives FieldLogicHQ a smaller entry point for coaches while protecting the value of Club. It also creates a natural expansion path: a coach starts with one team, proves the workflow, and later tells the board, "We should bring the whole club onto this."

## Research Question 1 Findings - Standalone Team Plan

### 1A - Who Is The Customer?

| Persona | What They Want | What They Can Do Today | What They Cannot Do Today | Main Friction |
| --- | --- | --- | --- | --- |
| **Org owner** | Run the whole association from one account. Give coaches autonomy while keeping visibility. | On Club, they can use rep teams, coaches portal, accounting, house league, public site, and org administration. | On Tournament, Tournament Plus, or League, they cannot unlock rep teams unless the org upgrades or a platform admin manually enables the module. | Club is a full-platform purchase. If the org only has one or two competitive teams, the price and setup feel too large. |
| **Unaffiliated team** | Run one rep team without waiting for a parent org. The head coach or manager acts as the owner. | Today they can create an org only by choosing an existing plan, but rep team tooling is Club-only and assumes org-level setup. | They cannot buy a single-team coaches portal with no tournament, house league, or org accounting surface. | The product speaks to organizations, not standalone teams. The coach would be buying too much product to solve one-team problems. |
| **Cost-conscious org** | Keep the org on Tournament Plus or League, but let one or two coaches use the portal. | They can use the base plan features for tournaments or house league. Platform admins can technically enable add-ons, but there is no clean customer-facing purchase path. | They cannot pay for only the rep team/coaches portal module by team. | The org has a real need, but the only clean upgrade path is Club. That creates a "no purchase" outcome. |

### Product Friction By Persona

**Org owner:** The unmet need is not access to one team. It is packaged value clarity. Club should remain the "whole club operating system" with executive reporting, accounting, program visibility, unlimited staff, and bundled modules.

**Unaffiliated team:** The unmet need is a narrow workspace. They need one roster, one schedule, one dues tracker, one document hub, one budget, and one coach/admin account. They do not need public org pages, house league, tournament registration, org-wide members, or full accounting.

**Cost-conscious org:** The unmet need is a bridge. They may eventually become a Club customer, but asking them to jump from $39 or $89 to $179 before one coach proves value is a harder sell.

### 1B - Standalone Team Plan Feasibility

#### PM View

A standalone Team plan makes product sense, but it should not be the first implementation unless the owner is ready to make team portability a real product promise. The feature is attractive because it creates a new entry point, but the current platform is built around organizations as tenants. A standalone team is therefore not just "one more plan card"; it changes onboarding, billing, permissions, data ownership, and future migration.

#### Technical Feasibility

The current rep-team data model is strongly organization-scoped:

- `rep_teams`, `rep_program_years`, `rep_team_coaches`, roster, events, documents, dues, allocations, and expenses all carry `org_id`.
- Coaches access teams through `rep_team_coaches` assignments inside an organization.
- Entitlement checks expect an organization plan plus optional `enabled_addons`.
- The platform catalog and feature matrix currently know only four plan IDs: `tournament`, `tournament_plus`, `league`, and `club`.

The likely implementation path is a **stub organization** rather than a separate tenant type. In plain language: when a coach buys Team, FieldLogicHQ creates a hidden/lightweight organization record behind the scenes, creates one rep team, and sends the coach directly into the coaches portal instead of the full admin shell.

This is feasible, but it has real implications:

- A new `team` plan would touch plan config, product catalog constraints, Stripe price records, onboarding, pricing, billing, and auth destination logic.
- The admin shell would need to hide org-level tools so the buyer does not feel like they bought a broken Club account.
- Team limits would need enforcement: one active rep team, limited staff/coaches, no house league, no tournament module, no org accounting.
- Storage paths and data ownership must remain portable if the team later joins a Club org.

Avoid a separate data model path. It would create duplicate roster, schedule, dues, and document logic and make future merging much harder.

#### Pricing

Current internal pricing context:

| Existing Item | Price | Notes |
| --- | ---: | --- |
| Tournament Plus | $39 CAD/month | Serious tournament operations tier |
| League | $89 CAD/month | Coming soon/early access |
| Club | $179 CAD/month | Includes rep teams, coaches portal, accounting, house league, public site |
| Additional Club rep team | $20 CAD/month or $200 CAD/year | Club only; first 3 active rep teams included |

Recommended Team price:

- **Standalone Team plan:** $29 CAD/month, or $290 CAD/year/season.
- **Positioning:** "For one competitive team. Roster, schedule, dues, documents, budget, reminders, and game-day tools."
- **Reasoning:** It must be above the Club add-on team price because standalone teams do not also pay the Club base subscription. It must remain far below Club so the single-team buyer does not bounce.
- **Seasonal framing:** Coaches think in seasons more than SaaS months. The annual/season option should be the default checkout presentation, with monthly available for teams that are still deciding.

#### Upgrade Path

The strongest upgrade story is "bring your team with you."

When a parent organization later buys Club:

- The standalone team owner can invite the org owner to claim or connect the team.
- The team data migrates into the org account: roster, documents, schedule, dues, budget, and history.
- The coach keeps access through the same portal, but the org gains executive visibility.
- Billing switches from standalone Team to Club plus any applicable rep-team quantity.

This path must be designed before launch. If a standalone team cannot be moved cleanly later, the Team plan becomes a dead end rather than an acquisition channel.

#### Market Size

There is no single public dataset that cleanly reports "independent rep teams versus association-owned rep teams" across Canadian amateur sport. The best estimate has to be inferred from sport structure:

- Hockey is highly association-governed. BC Hockey reports roughly 130 minor hockey associations, 60,000 players, and 10,000 coaches in BC/Yukon alone, which implies most youth competitive teams sit under formal associations.
- Soccer is also heavily club/district-governed. Ontario Soccer reports 392,902 players, 26,000 coaches, 16 district associations, and 12 associate members, with support delivered through clubs and leagues.
- Softball has provincial/territorial association governance, but team-level financing is often very local. Oakville's rep softball page describes team-by-team costs, fundraising, coach-determined tournament schedules, and self-funded rep teams inside an association structure.
- Basketball appears more fragmented than hockey/soccer, with many independent clubs and program operators. This likely increases the standalone Team opportunity.

PM estimate:

- **70-85%** of rep/competitive teams in hockey, soccer, and softball operate under a formal club or association umbrella.
- **15-30%** are likely independent, semi-independent, academy-style, or practically coach-run even if technically affiliated.
- The standalone market is probably smaller than the full Club market, but it is meaningful because it reaches buyers FieldLogicHQ currently cannot monetize at all.

### 1C - Alternative: Org-Level Per-Team Add-on

#### PM View

The per-team add-on is the best first move. It solves a real buyer problem with less product confusion than launching a standalone Team plan immediately. An org owner can say: "We are not ready for Club, but we want the coaches portal for our U15A team this season."

#### Fit With `enabled_addons`

The existing `enabled_addons` model can unlock modules at the org level, and the product catalog already has a planned `extra_rep_team` add-on concept. However, a true per-team add-on needs more than the current boolean module switch:

- `enabled_addons` can say "rep teams is enabled."
- It cannot by itself say "only these two teams are entitled."
- A per-team add-on would need a team count, team assignment, or team-scoped entitlement layer.

That means the add-on fits the current architecture direction, but the future build should avoid simply adding `module_rep_teams` to `enabled_addons` with no team limit. That would accidentally create a cheap Club substitute.

#### Pricing Model

Recommended add-on price:

- **$29 CAD per active rep team per month**
- **$290 CAD per active rep team per year/season**
- Optionally include "first team free for 30 days" as a trial, not as a permanent free tier.

Upgrade trigger:

- 1 team: Team add-on is clearly cheaper.
- 2 teams: Team add-on is still reasonable for a cost-conscious org.
- 3 teams: Show "Club is better value" because League + 3 team add-ons is essentially the Club price.
- 4+ teams: Require or strongly steer to Club so FieldLogicHQ does not underprice organization-wide rep operations.

#### Marketing Complexity

This is easier to market to existing orgs than a standalone plan:

- The org already understands FieldLogicHQ.
- The buyer is already in the billing area.
- The pitch is concrete: "Unlock the coaches portal for this team."
- The upgrade path to Club is simple: "You now have enough teams that Club gives better value and more oversight."

It is harder to market externally because independent coaches do not want to create an organization first. That is why the add-on should not be the only long-term answer.

### 1D - Recommendation

**Recommendation: Hybrid, sequenced as add-on first, standalone Team second.**

Start with a per-team Rep Team add-on for Tournament Plus and League orgs. This captures immediate demand from cost-conscious organizations, validates willingness to pay, and reuses the existing organization tenant model. In parallel, design a standalone Team plan around a lightweight stub organization and a clear "bring your team with you" migration path. Do not keep the status quo: Club-only leaves money and product learning on the table, and it gives coaches a reason to choose TeamSnap, GameChanger, or spreadsheets instead.

## Research Question 2 Findings - Pricing Architecture

### 2A - Competitive Pricing Architecture Analysis

#### Sports Platforms

**TeamSnap** uses a segment split directly on its pricing page: clubs/leagues and single teams are different buying paths. Clubs/leagues are routed to flexible/custom pricing, while single teams can start free and upgrade for team-level features. This is the closest pattern to FieldLogicHQ's situation.

**SportsEngine** presents multiple product families for different use cases: HQ for clubs/teams/leagues, Motion for class-based businesses, Play for livestreaming, Tourney for tournaments, and AES for volleyball events. Its HQ pricing has recently leaned toward custom conversations while also showing buy-now entry pricing in some flows.

**RAMP InterActive** positions itself as a unified platform made of standalone products: registrations, websites, team app, gamesheets, and assigning. This supports a modular story without forcing every buyer through one linear upgrade ladder.

#### General Multi-Persona SaaS

**Notion** uses a small, familiar Free/Plus/Business/Enterprise ladder and separates individuals, small teams, growing businesses, and enterprise needs through copy and feature depth.

**Linear** uses a clear Free/Basic/Business/Enterprise ladder with team limits, issue limits, and admin/security features as the upgrade logic.

**Figma** combines plan tiers with seat types and product tabs. The key lesson is that a broad platform can expose complexity after the buyer has selected the relevant product area.

**Wix and Squarespace** both use plan ladders, but their navigation and solution pages segment buyers by business type and desired outcome. The pricing table is not asked to explain every use case alone.

### Pricing Patterns That Apply To FieldLogicHQ

| Pattern | Works For FieldLogicHQ? | PM Assessment |
| --- | --- | --- |
| Segment-first pricing pages | Yes | Best fit. Buyers are not all on one maturity ladder. |
| Feature-first pricing table | Partly | Useful as a secondary comparison, but too overwhelming as the first view. |
| Good/Better/Best per segment | Yes | Tournament can have Free/Plus. Club/League can have League/Club. Coaches can have Team/Club path. |
| Modular/add-on pricing | Yes, with guardrails | Good for Team add-ons, but dangerous if everything becomes a menu. |
| Annual vs monthly framing | Yes | Annual/seasonal billing reduces decision fatigue and matches sports seasons. |

### 2B - Current Tier Mapping To Buyer Segments

| Tier | Primary Buyer | Secondary Buyer | Currently Marketed To? | Conversion Risk |
| --- | --- | --- | --- | --- |
| Tournament | Single-event organizer | Small club running one tournament | Yes | Low. Clear free entry point. |
| Tournament Plus | Serious tournament organizer | Rep org running multiple tournaments | Yes | Moderate. Strong value, but still tournament-specific. |
| League | League administrator | Club running house league | Early access only | High. Useful segment, not yet fully sellable. |
| Club | Full club executive/treasurer | Rep-heavy association | Early access only | High. Strong value, but high price and broad scope. |
| Team (proposed) | Individual coach/team manager | Cost-conscious org pilot team | Not yet | Very high. No current purchase path. |

### Under-Marketed Segments

1. **League administrators** are under-marketed because League is early access and currently appears as a future tier rather than a focused segment landing path.
2. **Rep team coaches and managers** are unserved in pricing. They appear only as users inside Club, not as buyers.
3. **Club treasurers/executives** are partially under-marketed. Club copy exists, but the pricing experience competes with Tournament messaging instead of giving the executive a dedicated "run the club" path.

### Biggest Conversion Gap

The biggest gap is the **single-team coach/manager**. This person can immediately understand the coaches portal value, but the current product asks them to buy or influence a Club subscription. That creates a mismatch between value received and price/authority required.

### 2C - Recommended Pricing Architecture

**Recommendation: Option B - Segment selector on one pricing page, supported by segment-specific landing pages.**

Keep `/pricing` as the canonical public pricing URL, but the first decision should be:

> What are you trying to run?

Show three cards or tabs:

1. **A tournament** - Tournament and Tournament Plus.
2. **A league or club** - League and Club, plus the Rep Team add-on explanation.
3. **One competitive team** - Team plan, with a "Does your organization run multiple teams?" path to Club.

Once the visitor picks a segment, show only 2-3 relevant options. Keep the full feature matrix as a secondary comparison for buyers who want details.

#### Why This Beats The Other Options

| Option | Assessment |
| --- | --- |
| **A: Two separate pricing pages** | Cleaner for SEO and campaigns, but risks fragmentation and duplicate maintenance. Better as landing pages that feed into one pricing selector. |
| **B: Segment selector** | Best balance. One canonical URL, less cognitive load, and each visitor sees the right offer. |
| **C: Collapse to three tiers with module add-ons** | Too disruptive right now. It would blur current plan invariants and create more product-catalog work before League/Club are self-serve. |
| **D: Status quo + better copy** | Lowest effort, but unlikely to solve the core problem because the tiers are serving different buyers, not one ladder. |

### PM Rationale

FieldLogicHQ should sell by job-to-be-done, not by internal module order. A tournament organizer should not have to understand Club. A coach should not have to compare against League. A club executive should not have to mentally subtract tournament features to find the value of accounting and rep teams. A segment selector lets each buyer self-identify, then shows a small plan set that feels made for them.

### 2D - Marketing Channel Implications

| Buyer Segment | Where They Find Tools | Best First Touch | CTA |
| --- | --- | --- | --- |
| Tournament organizers | Other tournament directors, provincial/local association conversations, Facebook groups, tournament listing sites, word of mouth after attending an event | Short landing page with screenshots, sample public tournament, and a "clone last year's tournament" story | Start free or start Tournament Plus trial |
| League administrators | Municipal parks and recreation networks, local sport associations, registrar/volunteer referrals, existing website vendors | Demo video showing registration to team placement to schedule | Join early access / request league demo |
| Club executives/treasurers | Board meetings, association referrals, treasurer pain points, provincial sport contacts, peer clubs | Outcome page focused on payments owed, allocations, auditability, coach autonomy, and less spreadsheet work | Request Club walkthrough |
| Rep team coaches/managers | TeamSnap/GameChanger alternatives, coach Facebook groups, tournament circuits, parent-manager referrals, sport-specific forums | Single-team landing page with "dues, roster, schedule, documents in one place" and seasonal pricing | Start Team season / try one team |

This supports the segment-selector recommendation. Campaigns should land on segment-specific pages, but pricing should remain unified after the visitor chooses their job.

## Research Question 3 Findings - Coaches Portal Enhancements

### Enhancement Prioritization Table

| Feature | Target Persona | Complexity | Recommendation |
| --- | --- | --- | --- |
| Lineup generation + PDF print | Coaches, team managers, scorekeepers | Medium | **V1 for baseball/softball; V2 for sport-specific hockey/soccer formats** |
| In-app stat logging | Coaches, scorekeepers, org admins | High | **V2 lightweight post-game stats; advanced sport stats Not Now** |
| GameChanger integration | Baseball/softball coaches | High/external dependency | **Defer direct integration; consider CSV import or partnership later** |
| Team communication/group messaging | Coaches, parents, players | Medium-high | **V2** |
| Attendance tracking | Coaches, team managers | Low-medium | **V1** |
| Medical/allergy notes on roster | Coaches, player safety contacts | Medium with privacy risk | **V2 with strict privacy model** |
| Parent portal | Parents/guardians, coaches | Medium-high | **V2** |
| Volunteer hour tracking | Org admins, volunteer coordinators, parents | Medium | **Not Now for Team plan; V2 for Club** |
| Jersey/equipment tracking | Coaches, managers, equipment coordinators | Low-medium | **V2, with jersey number cleanup in V1 if cheap** |

### 3A - Lineup Generation + PDF Print

#### Feature

A coach opens a scheduled game, chooses "Set lineup," selects available players, sets batting order and field positions, and exports a clean PDF lineup card for the umpire/referee or personal bench use.

#### PM Assessment

This is a strong V1 candidate for baseball and softball because the job is concrete and competitors already train coaches to expect it. GameChanger supports starting lineups from a game and PDF lineup cards. TeamSnap supports app-based lineups that use availability and sport position presets.

SportsEngine research did not surface the same kind of dedicated lineup-card product. Its team app precedent is closer to roster, schedule, chat, RSVP, availability, and score entry. For FieldLogicHQ, that means GameChanger and TeamSnap are the stronger lineup references, while SportsEngine is more useful as a roster/schedule/team-communication reference.

#### Generic vs Sport-Specific

Do not try to make V1 perfectly sport-agnostic. A generic lineup builder will feel weak for every sport. Instead:

- V1: baseball/softball lineup card tied to a scheduled game.
- V1 fallback: simple "game roster" printout for non-diamond sports.
- V2: hockey lines and soccer starting formation if those sports show demand.

#### PDF Infrastructure Fit

The existing export roadmap already includes `jsPDF`, PDF settings, and planned coaches roster/dues/budget PDFs. Lineup cards are a good fit for that direction, but they should use shared PDF/export patterns rather than a one-off print button.

#### Schedule Connection

Lineups should connect to the schedule. The natural workflow is "set lineup for this game," not "make a lineup in a separate tool."

#### Visibility

V1 should be coach-only by default. Publishing to parents/players can come later because lineup visibility can create fairness and playing-time issues.

### 3B - In-App Stat Logging

#### Feature

Coaches or scorekeepers record simple per-game player stats after a game. The smallest useful version records participation plus scoring contributions. More advanced versions track sport-specific stats.

#### Minimum Viable Stat Set

The best cross-sport V2 is:

- Game result already exists on schedule events.
- Player attendance/participation.
- Player scoring events: goals, points, runs, or generic "score."
- Optional assists for sports where that is natural.
- Coach notes, private by default.

This does not replace GameChanger for baseball/softball scorekeeping. It gives non-stat-heavy teams a simple season log.

Precedent: GameChanger and iScore are both built around real-time scoring workflows, especially for baseball and softball. GameChanger combines scorekeeping, season stats, lineup tools, video, and staff exports. iScore emphasizes detailed in-game scorekeeping, pitch-by-pitch capture, scorebook output, and hundreds of tracked stats. FieldLogicHQ should not try to recreate that depth inside a first coaches-portal stats release.

#### UX Model

Post-game entry is the right starting model. Real-time scoring requires a very different mobile-first interface, conflict handling, undo flow, and sport-specific rules. It should not be bundled into a coaches portal V1.

#### Privacy

Stats for minors should default to private:

- Coaches and org admins can see team stats.
- Parents can see their own player's details only if a parent portal exists and the org enables it.
- Public stats should be off by default and require explicit org/team approval.

#### Data Model Direction

Use a generic event-stat foundation first, not separate full schemas for every sport. Advanced baseball/softball stats, goalie stats, pitch counts, batting average, ERA, and save percentage should remain out of scope until FieldLogicHQ decides whether it wants to compete with dedicated scoring apps.

### 3C - GameChanger Integration

#### Current API State

No official public GameChanger developer API was found in current research. Official supported data paths are export-oriented:

- Staff can export season stats as CSV for baseball, softball, and basketball teams.
- College baseball/softball teams can export game stats as XML.
- GameChanger terms prohibit automated access/scraping and commercial republishing without permission.

#### Integration Options

| Path | Assessment |
| --- | --- |
| Direct API | Not feasible unless GameChanger provides partner access. |
| CSV import | Feasible later. Best low-risk path if coaches already export GameChanger stats. |
| Deep links | Feasible as a convenience: "Open in GameChanger" from a schedule event. Limited value without sync. |
| Webhooks/file sync | Not available from public docs. |
| Screen scraping/unofficial APIs | Do not pursue. Legal, reliability, and terms-of-service risk are too high. |

#### Scope Fit

GameChanger is most valuable for baseball and softball. It supports many sports, but its deepest scorekeeping/stat advantage remains diamond sports. FieldLogicHQ is sport-agnostic and Canadian-org focused, so a GameChanger integration would help one segment but should not define the entire coaches portal roadmap.

#### Recommendation

Defer direct integration. Build FieldLogicHQ's own lightweight coach tools first: lineup cards, attendance, dues/documents/budget improvements, and later simple post-game stats. If baseball/softball coaches strongly ask for GameChanger compatibility, add CSV import as a V2/V3 feature and pursue a partnership conversation separately.

### 3D - Other Enhancement Candidates

**Team communication / group messaging:** Coaches and parents benefit from one official team thread or announcement channel, but messaging creates moderation, notification, consent, and support expectations. V2 recommendation: start with coach announcements and replies disabled or limited before building full chat.

**Attendance tracking:** Coaches need to know who is coming before setting lineups and planning practices. V1 recommendation: add attendance/availability on schedule events, coach-managed at first, with parent RSVP only after parent portal exists.

**Medical / allergy notes on roster:** This can be valuable on game day, especially for emergency care, but it handles sensitive minor data. V2 recommendation: implement only with role restrictions, clear labels, auditability, and export/privacy decisions.

**Parent portal:** Parents would benefit from a read-only schedule, dues balance, document status, and possibly attendance RSVP. V2 recommendation: high value, but do it after the Team plan and privacy model are stable; login-optional shared links need careful controls.

**Volunteer hour tracking:** This is more of an organization policy feature than a standalone team feature. Not Now for Team V1; consider V2 for Club because volunteer commitments are usually set at the association level.

**Jersey/equipment tracking:** Coaches and managers benefit from knowing jersey numbers, sizes, and assigned gear. V2 recommendation: useful and manageable, but lower urgency than attendance and lineup cards. If the current roster jersey number field needs polish, include that in V1.

## Suggested Next Steps

1. **Approve the packaging direction:** Hybrid, with per-team org add-on first and standalone Team plan second. This decision controls billing, product catalog, and pricing-page work.
2. **Set the initial price:** Recommended starting point is $29 CAD/team/month or $290 CAD/team/year/season, with "Club is better value" nudges at 3 active teams.
3. **Run 8-12 discovery calls:** Include 3 org owners, 3 cost-conscious League/Tournament Plus prospects, and 3-6 individual rep coaches/managers. Validate who pays, who administers, and whether seasonal pricing is clearer than monthly.
4. **Design the team-scoped entitlement model:** Before implementation, decide how FieldLogicHQ limits a non-Club org to one or two enabled rep teams without unlocking the entire Club module.
5. **Design team portability:** A standalone Team plan must be able to merge into a Club org later. Treat this as a launch requirement, not a future cleanup.
6. **Prototype the segment-first pricing page:** Keep `/pricing`, but show Tournament, League/Club, and Team/Coach selectors before plan cards.
7. **Build the first portal enhancement package:** Prioritize attendance, baseball/softball lineup cards with PDF export, and small roster/equipment polish. Defer stats and GameChanger.
8. **Decide whether to pursue GameChanger partnership:** If yes, make it a business-development workstream, not an engineering dependency.

## Open Questions

- Should standalone Team be available at public launch, or should it be invite-only until team portability is proven?
- Is the owner comfortable creating a new `team` plan ID, or should Team initially be represented as an add-on/subscription type behind a lightweight org?
- Should the Team add-on be available to free Tournament orgs, or only Tournament Plus and League orgs?
- What is the exact upgrade trigger: recommend Club at 3 teams, require Club at 4 teams, or allow unlimited paid add-on teams?
- Who owns billing for a team inside a cost-conscious org: the organization owner, the coach, or either?
- Does FieldLogicHQ want parent-facing access in the Team plan, or should Team V1 remain coach/manager only?
- What is the privacy policy for minor stats, medical notes, and document visibility before parent portal work begins?
- Should FieldLogicHQ pursue a GameChanger partnership before building stat import, or only after customer demand is proven?

## Sources Reviewed

- [TeamSnap pricing](https://www.teamsnap.com/pricing) - segment split between clubs/leagues and single teams.
- [TeamSnap lineups](https://www.teamsnap.com/teams/features/lineups) - app-based team lineups, availability tie-in, sport position presets.
- [TeamSnap statistics help](https://helpme.teamsnap.com/article/256-set-up-team-statistics) - paid team statistics setup and sport presets.
- [SportsEngine home/product architecture](https://www.sportsengine.com/) - separate product families for HQ, Motion, Play, Tourney, and AES.
- [SportsEngine HQ pricing update](https://www.sportsengine.com/hq-pricing-update-1-12-26/) - custom org pricing and buy-now HQ entry pricing.
- [SportsEngine team app](https://apps.apple.com/us/app/sportsengine-team-management/id499597400) - free team app positioning for roster, schedule, chat, RSVP, and availability.
- [iScore Baseball features](https://iscoresports.com/baseball/features.php) - detailed baseball/softball scorekeeping, scorebook output, and live scorecast model.
- [RAMP InterActive](https://www.rampinteractive.com/) - standalone sports administration modules that can work together as a unified platform.
- [Notion pricing](https://www.notion.com/pricing) - multi-tier SaaS ladder with annual/monthly framing.
- [Linear pricing](https://linear.app/pricing) - Free/Basic/Business/Enterprise ladder with team and admin limits.
- [Figma pricing](https://www.figma.com/pricing/) - plan tiers plus product/seat-type complexity behind a pricing selector.
- [Wix plans](https://www.wix.com/plans) and [Squarespace pricing](https://www.squarespace.com/pricing) - broad website/product pricing with solution segmentation.
- [GameChanger starting lineups](https://help.gc.com/hc/en-us/articles/360033202792-Starting-Lineups) - schedule-linked starting lineups and PDF lineup cards.
- [GameChanger lineup recommendations](https://help.gc.com/hc/en-us/articles/42067886646157-Lineup-Recommendations-BETA) - baseball/softball lineup recommendations tied to scored games.
- [GameChanger season stats export](https://help.gc.com/hc/en-us/articles/360043583651-Exporting-Season-Stats) - CSV export for staff on baseball, softball, and basketball teams.
- [GameChanger XML export](https://help.gc.com/hc/en-us/articles/24581262301453-XML-Export-College-Teams-Only) - XML export for college baseball/softball teams.
- [GameChanger Terms of Use](https://gc.com/terms) - restrictions relevant to scraping and automated access.
- [GameChanger App Store listing](https://apps.apple.com/us/app/gamechanger/id1308415878) - supported sports, team management, scoring, and stats positioning.
- [BC Hockey About Us](https://www.bchockey.net/about-us) - association/player/coach scale in BC and Yukon.
- [Ontario Soccer Who We Are](https://www.ontariosoccer.net/who-we-are) - registered player, coach, district, and member counts.
- [Softball Canada membership rules](https://softball.ca/resources/2026rulebook/?section=388) - provincial/territorial association governance.
- [Oakville Angels Rep League](https://www.oakvilleangels.com/rep-league/) - example of association-based but team-funded rep softball operations.
