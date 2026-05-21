# Coaches Portal — Standalone Access, Pricing Architecture & Enhancement Research

**Session type:** Research only — no code changes  
**Date:** 2026-05-21  
**Author:** Claude (Sonnet 4.6) — original, unmodified  
**Status:** Draft for review  
**PM brief embedded below.** Future build sessions will use this as their brief.

---

## Executive Summary

Five key findings:

1. **The per-team add-on is the fastest path to market.** The most frustrated buyer right now is the Tournament or League org that has rep teams but won't upgrade to Club. Eighty percent of the billing infrastructure for a per-team add-on (Stripe per-team quantity sync, `enabled_addons`, `syncRepTeamBilling`) already exists. This can unlock the coaches portal for individual teams without a new product tier.

2. **A standalone Team plan makes sense as a second phase, not the first.** Independent rep teams (no parent org) are a real but harder-to-reach market. The stub-org approach makes it architecturally feasible, but it introduces onboarding and acquisition challenges that need to be solved separately. Build the per-team add-on first; use the learnings to design the standalone plan.

3. **The pricing page has a structural problem.** Five tiers displayed in a single upgrade ladder implies a path that most buyers don't follow. Tournament organizers, league admins, club operators, and individual coaches are four distinct buyer personas — they don't start free and upgrade; they enter at the tier that fits them. A segment-selector pricing page removes this friction without adding engineering complexity.

4. **Lineup cards and attendance tracking are high-ROI V1 enhancements.** Both are simple, high-demand features that coaches in every sport need. The existing PDF export infrastructure (Phase F) already supports lineup cards with minimal additional work. Attendance tracking is a schema extension on the existing event table.

5. **GameChanger integration is a partnership conversation, not a dev project.** No public API exists. A deep link ("Open in GameChanger") can be shipped today for free; CSV import is a reasonable interim. A formal integration requires a business development conversation with Dick's Sporting Goods.

---

## Research Question 1: Standalone Coaches / Rep Team Access

### 1A — Who Is the Customer?

Three distinct buyer personas interact with the rep team / coaches portal system. Each has a different relationship with the platform and different unmet needs.

---

#### Persona 1: The Org Owner (Current Club Subscriber)

**Who they are:** A volunteer executive or paid administrator for a multi-team sports club. They purchase Club at $179/month on behalf of the whole organization. All rep teams, coaches, and administrative functions fall under one account.

**What they can do today:**
- Full org-level admin (members, billing, org site)
- Rep team and program year creation/management
- Tryout registration and approval queue
- Cost allocation and rep team accounting
- House league management (bundled in Club)
- Tournament module (bundled)

**What they cannot do:** Nothing meaningful is blocked — Club is the all-access tier.

**Friction points:** The price point ($179/month) is the barrier to entry. An org that only needs rep team management and doesn't care about house league or advanced accounting is overpaying for bundled modules they don't use. There is no "just the rep teams" option.

---

#### Persona 2: The Unaffiliated Team (Independent Coach)

**Who they are:** A head coach whose team operates independently — no parent club structure, or the parent club uses a different platform. In Canadian amateur sports, this is common in softball, baseball, and some hockey contexts (AAA/AA independent entries). The coach is effectively the org owner, wearing every hat.

**What they can do today on FieldLogicHQ:** Nothing useful. Creating an org requires purchasing Club at $179/month just to access rep team tooling — a prohibitive entry point for a single team.

**What they need:** Roster management, team schedule, dues tracking, documents. No interest in org-level admin tools, house league, or tournaments.

**Friction point:** The only way in is $179/month with no trial or lighter tier. This means FieldLogicHQ is invisible to this entire buyer segment. They are currently using GameChanger (stats), TeamSnap (scheduling/communication), or spreadsheets. There is no acquisition path into the platform.

**Unmet need severity: High.** This persona is completely unserved by the current pricing architecture.

---

#### Persona 3: The Cost-Conscious Org (Tournament or League Tier)

**Who they are:** A sports club that is already on FieldLogicHQ at the Tournament or League tier. They run tournaments or a house league season, have a relationship with the platform, and also field one or more rep teams — but they have decided not to upgrade to Club ($179/month).

**What they can do today:** All tournament or house league functions. They can see the rep teams module mentioned in the platform but cannot access it.

**What their coaches need:** The coaches portal — roster management, schedule, dues, documents — for their one or two rep teams.

**Friction point:** The jump from League ($89/month) to Club ($179/month) is a 100% price increase. For an org that only wants the coaches portal for two teams, this is an unreasonable ask. They know the platform, trust it, and would happily pay an incremental amount — just not double their current subscription.

**Unmet need severity: High.** This persona is the most immediately actionable — they already have an account, trust the platform, and want to pay more. The platform just isn't offering them the right product.

---

### 1B — Standalone "Team" Plan — Feasibility Analysis

#### Technical Feasibility

The current data model has a deep dependency on `org_id`. Every rep team entity — `rep_teams`, `rep_program_years`, `rep_roster_players`, `rep_team_coaches`, `rep_team_events`, `rep_player_dues_schedules`, `rep_document_templates`, and six more tables — carries an `org_id` foreign key. The coaches portal auth guard resolves coach access via `rep_team_coaches(org_id, team_id, user_id)`. The `/{orgSlug}/coaches/` route tree requires an org slug to resolve.

**This means a standalone team cannot exist in the current model without an org anchor.** Two architectural paths exist:

**Path A — Stub org (recommended):** When a coach signs up for a standalone Team plan, the platform automatically creates a lightweight organization in the background. This org is invisible to the coach — they see "Team Dashboard," not an org admin shell. All existing data models, RLS policies, and API routes work without modification. The stub org would have `plan_id = 'team'` (new tier), no tournament access, no house league, and no accounting module. The coach interacts only through `/{orgSlug}/coaches/`.

Complexity: Medium-low. The primary work is the onboarding flow (create user → create stub org → create team + program year in sequence), plan gating, and billing. The data model is unchanged.

**Path B — Org-independent team tenant:** Refactor all rep team tables to make `org_id` optional and introduce a `team_tenant_id` alternative. Every API route, RLS policy, and auth context would need updating.

Complexity: Very high. Touches 15+ tables and all coaches portal API routes. Not recommended — the stub org approach delivers the same product outcome at a fraction of the engineering cost.

**Verdict:** Path A (stub org) is feasible. It is a product boundary change, not a data model change.

---

#### Pricing

The Club tier ($179/month) delivers: rep teams, coaching portal, accounting module, house league module, org admin, unlimited tournaments, and unlimited staff seats. A standalone Team plan delivers: coaches portal for one team, roster, schedule, dues, documents, and nothing else.

Suggested pricing for a standalone Team plan:

| Plan | Monthly | Annual |
|------|---------|--------|
| Team | $29/month | $290/year |

**Rationale:** $29/month is accessible for a volunteer coach (under $350/year), positions clearly below Tournament Plus ($39/month), and leaves meaningful margin. Annual is approximately 17% off, matching the savings cadence of other plans. If a second team is added, trigger an upsell to $49/month (two teams) or prompt upgrade to the per-team add-on model.

**Alternative: $19/month** if research shows acquisition is the priority and the primary goal is market entry. Risk: undervalues the product; hard to raise later.

---

#### Upgrade Path

The natural "bring your team with you" flow:

1. A coach signs up for the standalone Team plan (stub org created automatically)
2. Their organization later joins FieldLogicHQ or purchases Club
3. The org admin invites the coach and their team is migrated into the real org's account
4. The stub org is archived; all team data (roster, schedule, dues history, documents) transfers intact via a reassignment of `org_id` on the relevant tables
5. The standalone Team subscription cancels; billing moves to the org's Club plan
6. The coach's portal experience is unchanged — same routes, same data, new sidebar context (real org name)

This migration is technically straightforward (an `org_id` update across the rep team tables) and can be done via a platform-admin action initially. It becomes a self-serve flow once the Team plan is validated.

The pitch to coaches: "Start with your team today. When your club is ready, your data comes with you."

---

#### Market Size

Canadian youth sports registration by sport (approximate active registered players):

| Sport | Registered (approx.) | Typical rep team composition |
|-------|---------------------|------------------------------|
| Hockey | 600,000 | Club-organized; strong association infrastructure |
| Soccer | 800,000 | Mix of club and independent; many small clubs |
| Baseball/Softball | 200,000 combined | Many independent teams; tournament circuit is common |
| Basketball | 150,000 | Growing; many school/community-based independent teams |

In hockey, the majority of rep teams operate under registered clubs with existing management tools (HockeyTech, etc.). The independent-team market is smaller.

In softball and baseball, the tournament circuit culture means many rep teams are independently organized by parent coaches who enter provincial/regional associations directly, without a formal club structure. Estimate: 25–35% of rep-level teams in softball/baseball have no formal club management platform.

Soccer's club structure is stronger, but many U9–U14 community-level rep programs are organized informally. Estimate: 15–20% without a platform.

**Conservative estimate:** If FieldLogicHQ can access 5,000 independent or under-served rep teams across Canada at $29/month, that is $145,000/month ($1.74M ARR) in a market segment that generates zero revenue today. Even 500 teams ($14,500/month) meaningfully diversifies the revenue base and provides a new acquisition channel into the org buyer funnel.

---

### 1C — Alternative: Per-Team Add-On for Existing Orgs

Rather than a new plan, a Tournament or League org can purchase a **Rep Teams add-on** that unlocks the coaches portal for one or more specific teams.

#### Architectural Fit

This fits the existing architecture extremely well:

- The `enabled_addons` column on `organizations` already supports per-module unlocking
- The `module_rep_teams` entitlement check in `hasModuleEntitlement()` can be updated to check for the add-on alongside Club plan membership
- The per-team Stripe billing from Phase E (`syncRepTeamBilling()`, `rep_team_subscription_item_id`) is already implemented and could be adapted for add-on billing
- The Platform Admin product catalog (Phase 5) already supports add-on catalog records

**This is approximately 80% built.** The remaining 20% is: (a) a UI surface for purchasing the add-on at the org billing page, (b) a platform-admin toggle to enable the add-on for an org, and (c) the Stripe product/price configuration for the add-on SKU.

#### Pricing Model

| Teams | Monthly cost |
|-------|-------------|
| 1 team | $19/month |
| 2 teams | $35/month |
| 3 teams | $49/month |
| 4+ teams | Prompt upgrade to Club ($179/month — save $X) |

**Upgrade trigger:** When an org enables a 4th active team, surface: "You have 4 rep teams. Club at $179/month includes rep teams plus house league, accounting, and unlimited tournaments. That's better value than adding more teams individually." At 3 teams paying $49/month add-on, Club becomes compelling at roughly 4× teams.

#### Marketing Complexity

**Simpler to sell than a standalone plan** — the prospect already has an account and a billing relationship. The purchase is a single click at the billing page (similar to upgrading a plan). No new onboarding required, no new org creation, no acquisition cost.

**However:** It does not solve the zero-acquisition problem for independent coaches who have no org on the platform. The per-team add-on and the standalone Team plan serve complementary markets.

---

### 1D — Recommendation

**Implement the per-team add-on first. Build the standalone Team plan in a second phase.**

**PM-facing rationale:** Right now, the platform's most frustrated customers are clubs and orgs that are already subscribed — at Tournament or League — who have rep teams but can't access the coaching portal without a 100% price increase. These customers already trust the platform and want to pay more; the platform just isn't offering them the right product. The per-team add-on unlocks this segment immediately, uses infrastructure that is already 80% built, and generates incremental revenue with low engineering cost. The standalone Team plan (for independent coaches with no org) is a real opportunity — representing potentially thousands of unserved teams across Canadian amateur sports — but it requires new onboarding flows, a new product tier, and an acquisition strategy for a buyer who currently doesn't know FieldLogicHQ exists. It is the right move for Phase 2, after the add-on validates the market. Together, these two moves transform the coaches portal from a bundled Club feature into a standalone revenue stream that can grow independently of org-level subscriptions.

---

## Research Question 2: Subscription Tier Rationalization

### 2A — Competitive Pricing Architecture Analysis

#### TeamSnap

TeamSnap uses a dual-track model that is highly instructive:
- **Teams** get their own pricing tier (Free / Lite / Club / Business) based on roster size and feature needs
- **Organizations/Clubs** get separate enterprise pricing with a completely different sales process

The team track is self-serve and low-friction. The org track is sales-assisted. The pricing page opens with "For Teams or Organizations?" — a literal segment selector. This is a proven model for a platform that serves both individual coaches and club administrators.

**Key takeaway:** Segment selection before pricing is the established convention in this space.

#### SportsEngine

SportsEngine (owned by NBC Sports Group) offers dedicated pages for "Teams," "Leagues/Clubs," and "Associations/National Governing Bodies." Each segment has its own plan stack and value proposition. The navigation literally branches on "what type of org are you?" The pricing page is not a single table — it is a decision tree.

**Key takeaway:** The most sophisticated operator in this market uses segment-first architecture. Competitors who don't do this lose buyers who don't self-identify with the generic ladder.

#### Notion / Figma (SaaS comparables)

Both products distinguish Free / Professional / Team / Enterprise, where "Team" and "Professional" serve different buyers (individual power users vs. team operators). In both cases, the most important pricing page element is the persona identification question — "Are you an individual or part of a team?" — because it changes which plans are highlighted.

The Figma pricing page uses a "Starter / Professional / Organization / Enterprise" ladder, but the copy is explicitly persona-first: Starter is "For individuals and small projects," Professional is "For professional designers who want more," Organization is "For design teams that need to collaborate." Each tier is described by who you are, not just what you get.

**Key takeaway:** Outcome-and-persona-first copy outperforms feature-list copy for complex multi-segment products.

#### Squarespace / Wix

These platforms serve two segments (personal vs. business sites) with meaningfully different features. Both use a single pricing page with a prominent persona toggle or selector at the top. The page content adapts based on selection. Squarespace's "For Personal" vs. "For Business" toggle is the most-studied example of this pattern in the wild.

**Key takeaway:** A toggle or card selector at the top of a single pricing URL is lower friction than routing buyers to separate pages. But separate landing pages (fed by different acquisition channels) can still converge on the shared pricing page.

#### Pricing Architecture Patterns — Summary

| Pattern | Works best when | Risk |
|---------|----------------|------|
| Single linear ladder | All buyers upgrade through a natural sequence | Buyers who don't fit the ladder bounce |
| Segment selector on one page | 2–4 distinct segments, some overlap | Segments must be clearly self-identifiable |
| Separate pages per segment | Very different buyer journeys with no overlap | Buyers who straddle segments get lost |
| Modular/add-on pricing | Core platform is shared; capabilities diverge | Decision fatigue on the add-on layer |
| Annual vs. monthly toggle | When annual commitment is a meaningful decision | Clutters the page if not the primary decision |

---

### 2B — Current Tier Mapping to Buyer Segments

| Tier | Monthly | Primary buyer | Secondary buyer | Currently marketed to? | Conversion gap |
|------|---------|--------------|-----------------|----------------------|----------------|
| Tournament | Free | Single-event organizer | Small club testing the platform | Yes (live) | Low — free means no barrier |
| Tournament Plus | $39 | Serious tournament organizer | Multi-event club | Yes (live) | Moderate — same buyer, clear value add |
| League | $89 | League administrator | Club running a house league | No (early access) | High — different buyer persona, unclear entry point |
| Club | $179 | Full club operator | Multi-team org | No (early access) | High — different buyer, price is barrier |
| Team (proposed) | $29 | Individual coach / rep team | Independent team | Not yet | Total — persona is completely unserved |

**Biggest conversion gaps:**

1. **Tournament organizers → Tournament Plus:** Smallest gap because it is the same buyer type, same mental model. The gap that exists is mostly about communicating what Plus adds (auto-scheduling, brackets, communications) in a clear, outcome-focused way.

2. **Unserved segments → any tier:** League admins, club operators, and individual coaches represent the largest revenue opportunity but are not currently reachable via the pricing page. They either don't know FieldLogicHQ exists (independent coaches) or see pricing that isn't written for them (club operators reading tournament-focused copy).

3. **Tournament/League orgs → rep team tools:** The cost-conscious org at $89/month can see the rep teams module is locked but has no incremental path to unlock it. The next step jumps to $179/month. This is the most actionable gap.

**Under-marketed segments:**
- League administrators (entering at $89) — the pricing page is not yet live for this tier
- Full club operators (entering at $179) — same; early access only
- Independent coaches — no product exists for them yet

---

### 2C — Recommended Pricing Architecture

**Recommendation: Option B — Segment Selector on one pricing page.**

**What this looks like:**

The `/pricing` page opens with three prominent persona cards:
- 🏆 **"I run tournaments"** → shows Tournament ($0) and Tournament Plus ($39/month)
- 🏟 **"I manage a league or club"** → shows League ($89/month) and Club ($179/month)
- 👤 **"I coach a rep team"** → shows Team add-on ($19–49/month per team) or standalone Team plan ($29/month)

Each card is outcome-focused: "Run a tournament in under an hour" / "Manage an entire season, online" / "Everything your team needs, in one app."

The selected card expands to show 2–3 plan options for that persona. A "Compare all plans →" link at the bottom reveals the full feature comparison table for buyers who want to cross-compare.

**Why Option B over the alternatives:**

- **vs. Option A (two separate pages):** A single URL is easier to share, easier to maintain, and avoids buyers getting lost when they land on the wrong segment's page. Option B can be fed by segment-specific landing pages (which point to `/pricing?segment=tournaments` or similar) without requiring a full separate pricing page build.

- **vs. Option C (collapse to three tiers with add-ons):** Moving complexity to the add-on layer trades pricing page clarity for checkout complexity. The per-team add-on is a good specific decision; making the entire pricing model add-on-based creates a different kind of confusion.

- **vs. Option D (status quo + better copy):** Better copy will help, but the fundamental problem is that a single five-tier table forces prospects to read all five options and self-identify the right one. A segment selector does that work for them. Copy improvements are table stakes (always do them) but they don't solve the architecture problem.

**Trade-offs:**

- Engineering cost: Building the segment selector UI is low (a set of styled cards + conditional section rendering). Not a significant build.
- Risk: Some buyers don't fit a single segment (e.g., a club that runs tournaments AND a house league). The solution is a clear "I do more than one" path that routes to Club, which covers all modules.
- Risk: A segment selector can feel patronizing if the UI is clunky. The interaction needs to feel like "help me find the right fit" not "what box do you go in."

---

### 2D — Marketing Channel Implications

Understanding where each buyer segment discovers tools determines whether the pricing page or dedicated landing pages should be the primary acquisition surface.

#### Tournament Organizers
- **Discovery channels:** Provincial sport association websites (Softball Ontario, Baseball BC, etc.), Facebook groups for tournament convenors, word of mouth from other organizers, association newsletters
- **First touch:** "Set up your tournament in 5 minutes — free" landing page with a CTA that goes directly to signup, not the pricing page
- **Implication:** The free Tournament tier is the acquisition hook. The pricing page is where they land when evaluating Tournament Plus. Association partnership programs (co-marketing, referral credits) are the highest-leverage channel.

#### League Administrators
- **Discovery channels:** Municipal parks & rec departments, sport association board meetings, LinkedIn for org decision-makers, word of mouth from similar orgs
- **First touch:** A demo video (3–5 min) showing a full season setup — registration, draft, schedule, standings — followed by an early-access signup
- **Implication:** League admins are not impulse buyers. They do research over weeks or months. The pricing page is a destination for comparisons, not a first touch. Content marketing (blog posts: "How to run a house league season without a spreadsheet") is the acquisition channel.

#### Full Club Operators (Club tier)
- **Discovery channels:** Same as league admins, plus provincial sport governing body tools directories, peer recommendations from other club executives
- **First touch:** Reference from a trusted source (another club, an association), or a discovery call/demo
- **Implication:** At $179/month, this is a considered purchase. The pricing page is part of the research phase, not the conversion trigger. Sales-assist and demos close this segment, not self-serve checkout alone.

#### Individual Coaches / Rep Teams
- **Discovery channels:** GameChanger community, TeamSnap comparison searches ("TeamSnap alternatives"), provincial coach association channels, word of mouth from other coaches, social media coaching groups
- **First touch:** A landing page specifically for coaches: "Your team dashboard. Roster, schedule, dues — in one place. Free for 30 days." The FieldLogicHQ brand, org language, and tournament focus are distractions for this buyer.
- **Implication:** This segment may need a separate, coach-specific landing page (`/for-coaches` or `/team`) that speaks directly to their workflow without org/tournament framing. The pricing page is secondary; the coach-specific landing page is the acquisition hook.

**Overall implication for pricing page architecture:** The pricing page is primarily a research/comparison destination, not an acquisition surface. Segment-specific landing pages fed by segment-specific acquisition channels drive the first touch; the pricing page serves buyers who already know FieldLogicHQ and are comparing their options. Option B (segment selector on one page) serves this research phase well.

---

## Research Question 3: Coaches Portal Enhancement Opportunities

### Enhancement Prioritization Table

| Feature | Target persona | Complexity | Recommendation | Notes |
|---------|---------------|------------|---------------|-------|
| Lineup generation + PDF | Head coaches | Low | **V1** | Phase F PDF infrastructure already built; sport-agnostic card for V1 |
| Attendance tracking | Head coaches | Low | **V1** | Schema extension on `rep_team_events`; immediate value for roster management |
| Medical / allergy notes | Head coaches | Low | **V1 (gated)** | Coach-only field on player profile; private, no sharing; clear privacy disclosure needed |
| Jersey / equipment tracking | Head coaches | Low | **V2** | `player_number` already in schema; separate equipment log is a small addition |
| In-app stat logging | Coaches, parents (V2) | Medium | **V2** | Requires new schema + privacy policy; high value once lineup/attendance are live |
| Parent portal | Parents, families | Medium-High | **V2** | Token-scoped access pattern (precedent: HL draft coach room); meaningful demand |
| Team communication / messaging | Coaches, parents | Medium-High | **V2** | In-app threads are non-trivial; email system (Phase 6M) is a simpler bridge |
| GameChanger integration | Coaches (baseball/softball) | Low (partial) | **V1 (partial)** | Deep link = now; CSV import = V1; API integration = partnership conversation |
| Volunteer hour tracking | Org administrators | Low-Medium | **Not Now** | Niche use case; serves <10% of orgs with formal volunteer requirements |

---

### 3A — Lineup Generation + PDF Print

**What it is:** A coach sets a game lineup (batting order, positional assignments, line combinations, or starting roster depending on sport) and exports a formatted PDF — the "lineup card" handed to the umpire, referee, or opposing coach before a game.

**Sport-specific complexity:** Baseball batting orders are rigid and well-defined (1–9 positions). Hockey uses line combinations (forward lines + defense pairs + goalie). Soccer uses formations (4-4-2, 4-3-3, etc.) with a set of starters + subs. These formats differ enough that a sport-specific V2 would be meaningfully better than V1 — but a sport-agnostic V1 (ordered list of players with jersey numbers and assigned positions as free text) already covers the core need for all sports.

**V1 design:** A "Set Lineup" action on the schedule event detail page. The coach drags players into an ordered list, assigns a position label (free text or from a small sport-aware dropdown), adds a note, and exports as a PDF. The PDF uses `buildTablePDF()` from Phase F — it is essentially a simple table (position | name | jersey | notes) with org branding applied. Estimated additional work: 1 new page + 1 API route + trivial PDF template.

**Schedule connection:** Attaching the lineup to a specific `rep_team_event` record is the right model. Stores the lineup as a JSON field on the event or in a separate `rep_game_lineups` table. A new table is cleaner for future extensions.

**Audience:** Coaches in V1. Parents viewing lineup visibility is a natural V2 feature (if the parent portal is built). Referees and opponents receiving the PDF card is the primary use case.

**Precedent:** GameChanger offers a full batting order drag-and-drop with pinch hitter and position-by-inning assignment. TeamSnap's premium tier includes a lineup feature for team sports. Our V1 needs to be good enough to be useful, not as deep as GameChanger.

**Recommendation: V1.** High value, low complexity, leverages existing infrastructure. Flagship feature for the coaches portal that coaches in every sport understand immediately.

---

### 3B — In-App Stat Logging

**What it is:** Coaches or scorekeepers log game statistics within the portal — at minimum, win/loss result and team score (already stored in `rep_team_events.home_score / away_score / result`). Extended: per-player stats (goals, assists, saves, batting average, ERA, etc.).

**Minimum viable stat set:** The game-level result is already stored. Per-player stats require a new table: `rep_player_game_stats(id, event_id, program_year_id, player_id, stat_type, stat_value, created_by, created_at)`. A controlled vocabulary for `stat_type` (goals, assists, saves, hits, runs, strikeouts, etc.) by sport, set at the program year level, handles the multi-sport problem without requiring sport-specific schemas.

**Schedule intersection:** Stats are naturally a per-game-event input. The schedule page event detail view is the right entry point. A "Log Stats" action appears after the game is marked complete.

**Real-time vs. post-game:** Post-game entry is the right scope for V1. Real-time live scoring during a game requires a mobile-optimized, low-latency interface with WebSocket state sync — meaningful additional complexity. Post-game covers 95% of the use case and is far simpler to build correctly. V2 can add live scoring.

**Privacy:** Player stats for minor athletes are sensitive. Access model for V1: coaches see all players' stats; parents see only their child's stats (requires parent portal or a per-player shareable link). Public visibility is not appropriate without explicit consent. The privacy model must be documented in the platform's terms and disclosed during registration.

**PDF export:** Season summary report with per-player stat totals fits `buildTablePDF()` well. A "Season Stats Report" PDF is a natural addition to Phase F PDF surfaces.

**Schema complexity:** Generic schema (`stat_type` as string, `stat_value` as numeric) is flexible and doesn't require multiple sport-specific tables. Downside: no database-level enforcement of which stat types are valid for which sport. Recommendation: use a controlled vocabulary defined per-program-year (e.g., a `sport_stat_types` lookup), not hard-coded in the schema. This allows adding new sports and new stat types without migrations.

**GameChanger and iScore precedent:** GameChanger handles full baseball boxscore entry with individual at-bat tracking, pitch counts, and batting stats. It is excellent for baseball/softball. iScore handles live mobile scoring for multiple sports. FieldLogicHQ does not need to compete with these for depth in V1 — the goal is "useful for all coaches" not "better than GameChanger for baseball."

**Recommendation: V2.** Requires new schema, meaningful UI work, a privacy policy update, and coordination with the parent portal (to determine who can see what). High value but the right sequencing is: ship lineup cards and attendance in V1, then build stats once those validate the enhancement investment.

---

### 3C — GameChanger Integration

**What it is:** GameChanger (owned by Dick's Sporting Goods) is the dominant live scoring, stats, and replay app in North American baseball and softball. Many rep team coaches already use it. Research whether FieldLogicHQ can integrate.

**Does GameChanger offer a public API?** As of August 2025 (knowledge cutoff), GameChanger does not have a publicly documented developer API. Their API access is private and has historically been limited to formal integration partners. This may have changed — the current state should be verified directly. **Flag for business decision: does the owner want to invest time in a GameChanger partnership conversation?**

**Alternative integration paths:**

| Path | Complexity | Value | Recommended? |
|------|-----------|-------|-------------|
| Deep link ("Open in GameChanger") | Very low | Moderate | **Yes, do now** |
| CSV import from GameChanger | Low | Moderate | **Yes, V1** |
| Webhook/file-based sync | Medium | High | Requires partnership |
| Public API integration | N/A | High | No public API |
| Screen scraping | Very high | High | No — ToS violation |

**Deep link (immediate, free):** From a `rep_team_event` record for a baseball/softball game, display an "Open in GameChanger" link that launches the GameChanger app or website. This requires no API — just a correctly formatted URL or deep link scheme. Coaches who use both apps can navigate between them. Zero engineering cost beyond adding a link.

**CSV import (V1):** GameChanger allows coaches to export game logs and stats as CSV. FieldLogicHQ can accept those CSVs in a defined format and import game stats into the stats table (once built in 3B). This requires: a CSV import UI, a mapping layer from GC's export format to FieldLogicHQ's schema, and error handling. Low complexity, medium value. Useful for coaches who want historical stats from GC in FieldLogicHQ.

**Partnership conversation:** A formal integration would be mutually beneficial — GC gets exposure to the club management layer; FieldLogicHQ gets acquisition through GC's large coach community. A business development conversation is warranted before investing engineering time. GameChanger's reach in baseball/softball is significant, and their model (free app for coaches) aligns with FieldLogicHQ's individual-coach acquisition interest.

**Sports coverage:** GameChanger covers baseball, softball, basketball, and soccer. Strong overlap with FieldLogicHQ's primary sports. Limited value for hockey, which has its own ecosystem (HockeyTech, GameSheet).

**Recommendation:** Implement the deep link immediately (trivial effort). Pursue a partnership conversation before building CSV import or any deeper integration. Do not invest in stats logging (3B) purely to support a GameChanger integration that may not be needed if the partnership produces direct data sync.

---

### 3D — Other Enhancement Candidates

#### Team Communication / Group Messaging
In-app announcements or message threads per team, visible to coaches and parents. Currently, coaches communicate via the email reminder system (Phase 6M — payment reminders) and manually via external email. In-app communication would replace external group chats (Slack, GroupMe, email threads).

**Who benefits:** Coaches and parents equally — reduces context switching, keeps team communication in the platform.

**Complexity:** Medium-high. A real-time or near-real-time message thread requires push notification architecture or aggressive polling. A simpler "announcements" model (coach posts, parents see) is lower complexity and covers 70% of the use case. The email dispatch system (Phase 6M) is a close precedent.

**Recommendation: V2.** High demand but non-trivial to build correctly. A coach-to-parent announcement board (not a full messaging thread) can be V1 within the V2 cycle. Full two-way messaging with parent replies is a larger feature.

---

#### Attendance Tracking
Coaches mark players present, absent, or injured for each game or practice event. The result is an attendance record per player per event.

**Who benefits:** Coaches managing large rosters. Many provincial associations require attendance documentation for player eligibility. Parents benefit from knowing whether their child was marked absent.

**Complexity:** Low. Schema: a `rep_event_attendance(id, event_id, player_id, status, created_by, created_at)` table. UI: a simple checklist on the event detail page, pre-populated with the roster. An attendance export (CSV) is a natural addition for coach/admin reporting.

**Recommendation: V1.** Simple schema extension, immediate practical value, used in every sport, requested by coaches universally. A strong addition to the initial coaching portal enhancement pass alongside lineup cards.

---

#### Medical / Allergy Notes on Roster
Emergency contact and allergy/medical flags visible to coaches during a game. Currently, the player profile (`rep_roster_players`) has `notes` and `admin_notes` fields but no structured medical data.

**Who benefits:** Coaches responding to player medical situations on the field. This is a safety-critical feature — the right information at the right time can be life-saving.

**Complexity:** Low for implementation. The player profile page already exists; adding coach-only medical/allergy fields (structured: epi-pen Y/N, allergy details, emergency contact, any conditions) is a small addition. The complexity is in **access control and privacy**: these fields must be:
- Accessible only to assigned coaches for that player's team (already enforced by the franchise model)
- Never shown in exports or public contexts
- Disclosed clearly in the registration form / privacy policy as "shared with coaching staff"
- Retained only for the duration of the active program year

**Recommendation: V1 with access gates.** The safety case is compelling. Implementation is low complexity. The policy requirement (privacy disclosure at registration) is the primary gate — this needs to be written into the registration form's consent language before the feature ships.

---

#### Parent Portal
A read-only view of schedule, dues balance, lineup visibility, and team announcements for a player's family. Login-optional via a shareable link (token-scoped, similar to the House League draft coach room pattern).

**Who benefits:** Families of players — reduces "when is the game?" questions and keeps parents informed without direct coach communication.

**Complexity:** Medium-high. Requires either a parent account (with its own auth path) or a token-scoped shareable URL (simpler, stateless). The token approach is the right V1 — generate a per-player parent link that shows that player's schedule, dues balance, and upcoming events. No login required. The HL draft coach room pattern is a precedent for token-scoped access in this codebase.

**Recommendation: V2.** High demand and high value, but requires architecture work (token generation, a public-facing player page, and parent-appropriate data scoping). The right time to build this is after lineup cards and attendance tracking are live, so parents have meaningful data to view.

---

#### Volunteer Hour Tracking
Track family volunteer hours against a minimum requirement (common in some organizations).

**Who benefits:** Org administrators and families in clubs with formal volunteer requirements.

**Complexity:** Low-medium. A volunteer log table (family, hours, event description, approved by) plus a minimum requirement field on the program year.

**Recommendation: Not Now.** This is a niche feature — relevant to perhaps 10–20% of orgs with formal volunteer requirements. It has no benefit for independent coaches or orgs without this policy. Build broad features (lineup, attendance, stats) before narrow ones.

---

#### Jersey / Equipment Tracking
Log which jersey number and equipment items are assigned to each player.

**Who benefits:** Coaches and equipment managers for teams with large equipment inventories.

**Jersey number:** Already stored in `rep_roster_players.player_number`. No new schema needed — just a UI improvement to make jersey number assignment easier.

**Equipment tracking:** Would require a new `rep_player_equipment` table (player, item, assigned_at, returned_at). Moderate schema work for a feature most coaches handle with a spreadsheet or whiteboard.

**Recommendation: V2 for jersey UI improvement; Not Now for equipment log.** Jersey number editing is a trivial UX improvement that should happen during the next player profile polish pass. Full equipment inventory tracking is lower priority than stats, attendance, and the parent portal.

---

## Suggested Next Steps

These are ordered by impact-to-effort ratio and logical sequencing:

**1. Per-team add-on — build session (high priority)**
The most immediate revenue and UX impact. Infrastructure is 80% built. This unlocks the coaches portal for Tournament and League orgs that have rep teams. Estimated effort: 1–2 sessions. Unblocked today.

**2. Pricing page — segment selector redesign (medium priority)**
Restructure `/pricing` around a "What best describes you?" segment selector. Show 2–3 plans per segment rather than a five-tier table. This is a UI redesign, not a backend change. Low engineering cost, meaningful impact on conversion for League/Club/Team segments. Can be done in a single session alongside the add-on launch.

**3. Coaches portal V1 enhancements — build session**
In one pass, ship: (a) lineup card generation + PDF, (b) attendance tracking, (c) medical/allergy notes on player profile. These are all low-complexity additions that meaningfully expand the coaching portal's daily usefulness. High impact for retention of Club and Team plan subscribers.

**4. Standalone Team plan — architecture and product design session**
Define the stub-org onboarding flow, the `/team` acquisition landing page copy, and the plan gating logic. Then build in a separate session. This unlocks the independent-coach market segment. Phase 2 after the per-team add-on validates demand.

**5. GameChanger deep link (immediate, trivial)**
Add "Open in GameChanger" links to rep team event detail pages for baseball/softball events. Zero backend work. Do this in the next coaches portal session regardless of what else is in scope.

**6. In-app stat logging — V2 build session**
After lineup and attendance are live, design and build per-player game stats. This requires the stats schema, UI, and privacy policy update. Natural sequencing: build after the parent portal architecture is decided, so the privacy model for "who can see stats" is already designed.

**7. Parent portal — V2 build session**
Token-scoped per-player parent view. Build after stat logging and announcements are defined, so parents have meaningful data to view.

---

## Open Questions

These require a business decision before the relevant implementation can proceed:

1. **Per-team add-on price point:** Is $19/month per team the right number, or should this be higher/lower? The add-on pricing directly affects the Club upgrade trigger and the per-team add-on vs. Club trade-off math.

2. **Standalone Team plan — pursue or wait?** The per-team add-on serves existing orgs. A standalone Team plan serves independent coaches who have no org on the platform yet. Does the owner want to invest in the acquisition infrastructure (coach landing page, stub org onboarding) for this segment in the near term, or focus on deepening the existing org base first?

3. **GameChanger partnership — pursue?** A formal business development conversation with GameChanger (Dick's Sporting Goods) could unlock a meaningful integration and acquisition channel for coach-facing products. Does the owner want to initiate that conversation? This decision gates whether the CSV import path is worth building as an interim.

4. **Privacy policy update — scope before shipping medical notes:** Adding allergy/medical fields to the player profile requires an updated privacy disclosure in the player registration form and the platform's privacy policy. Does existing counsel need to review this language before it ships? This gates the medical/allergy notes feature.

5. **Parent portal — account or token-scoped link?** Two approaches: (a) parents create a FieldLogicHQ account and are linked to their player(s), or (b) coaches generate a shareable token link for each player's family (no login required). The account approach has better long-term product value (parents can update their info, receive notifications). The token approach is faster to build and removes friction. Which model does the owner prefer? This decision gates the parent portal architecture.

6. **Pricing page — single URL with segment selector, or separate landing pages per segment?** The research recommends a segment selector on `/pricing`, but separate acquisition landing pages (e.g., `/for-coaches`, `/for-leagues`) may be more effective for organic search and targeted campaigns. Is the owner prepared to invest in segment-specific landing pages, or is the pricing page the primary conversion surface for all segments?

7. **Volunteer hour tracking — is this a near-term commitment?** Two or three of the orgs in the early-access pipeline may have explicit volunteer requirements. If so, tracking this during onboarding conversations could reveal whether it is a deal-breaker for a meaningful segment, which would change its priority from "Not Now" to "V2."

---

*Research produced 2026-05-21 by Claude Sonnet 4.6. No code was written this session. Outputs are intended as the brief for future build sessions. This file uses the prefix `claude_` to distinguish it from any externally-modified copies.*
