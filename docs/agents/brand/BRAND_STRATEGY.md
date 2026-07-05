# FieldLogicHQ Brand Strategy

## Coaches Portal Unification Addendum

**Added 2026-05-25.** The product previously described as Coach Portal, Team, or standalone Team is now one customer-facing product: **Coaches Portal**.

Current rule:

- Tournament participants receive Basic Coaches Portal access for tournament registrations, schedules, status, announcements, and history.
- Paid standalone coaches, org-billed coaches, and Club coaches receive Premium Coaches Portal access in the same portal.
- Upgrading adds premium tools without removing tournament history.
- Canceling paid access returns the coach to Basic Coaches Portal rather than removing their account.
- Use `/coaches` as the product route. Legacy coach/team signup routes should redirect into `/coaches` before launch.
- Customer-facing copy should say Coaches Portal, not Team plan, Team subscription, or standalone Team.

See `docs/projects/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md` for the canonical implementation direction.

*Last updated: 2026-05-24 — established in marketing strategy session*

---

## 1. Brand Positioning Statement

**FieldLogicHQ is the operating platform for people who run community sport** — whether that's one team, one tournament, one season, or an entire club.

Every word is deliberate:
- **"operating platform"** — not a tool, not an app. A platform implies breadth and that you run your whole operation here.
- **"people who run"** — centres the operator, not the sport. Coaches, league presidents, tournament organizers, club executives.
- **"community sport"** — describes the grassroots, volunteer-run nature of the audience without tying the brand to a single country. Leaves room for expansion while remaining specific to the context we serve.
- **"one team … one tournament … one season … an entire club"** — explicitly validates all four segments in a single sentence.

---

## 2. The Core Promise

> FieldLogicHQ gives volunteer sports org operators their evenings back.

Every piece of copy — headlines, feature descriptions, plan cards, FAQ answers, upsell messages — should trace back to this. Time recovered. Effort reduced. Administration handled.

If a headline doesn't connect to this promise, even loosely, rewrite it.

---

## 3. The Hero Line

**"Less admin. More sport."**

This is the umbrella headline across all surfaces and all four segments. It is persona-agnostic by design:
- A tournament organizer: less admin running brackets and schedules = more sport for players
- A house league admin: less admin managing registrations and standings = more sport
- An org president: less admin across the whole club = more sport for everyone
- A coach: less admin on rosters and lineups = more time coaching

Do not change this line without a documented brand strategy decision. It is the single most valuable piece of copy the brand owns.

---

## 4. Tone and Voice

**Practical. Direct. Warm.** Like the most organized person on the volunteer board — not a startup founder, not a SaaS marketing team.

### What this means in practice

- Talk like a knowledgeable colleague, not a vendor
- Assume the audience is competent — never condescend
- Respect their time — no filler, no padding, no preamble
- Confident without being braggy; helpful without being sycophantic
- **Specificity beats superlatives**: "14-team round-robin in 3 minutes" beats "powerful scheduling tools"
- **Outcome before feature**: "standings update automatically" beats "real-time standings engine"
- **Volunteer empathy**: acknowledge the audience's reality — evenings and weekends, unpaid, doing this for the kids

### The audience

**Primary**: Volunteer administrators running community sports organizations — hockey associations, baseball leagues, soccer clubs. They are not tech buyers. They manage registrations and schedules on evenings and weekends, often unpaid. Their pain is time, not capability.

**Secondary**: Paid staff at larger clubs (Club-tier orgs) with rep teams and accounting needs. More sophisticated, but still operators first — not developers, not marketers.

**Individual coaches**: Often the same person as above but operating at a team level rather than org level. Time-strapped, technically capable, motivated by what's best for their players.

---

## 5. Vocabulary Rules

### Always use
| Use | Example |
|---|---|
| Full plan names | Tournament, Tournament Plus, League, Club |
| Specific numbers | "14-team round-robin in 3 minutes" |
| Outcome language | "standings update automatically after each game" |
| Volunteer empathy | "that Saturday morning you'd rather spend on the sidelines" |
| "Registration" for player/team enrollment | not "signup" |
| "Express interest" for unavailable features | not "join the waitlist" |

### Never use
| Forbidden | Use instead |
|---|---|
| unlock | "available on Tournament Plus and above" |
| supercharge | (omit — lead with the outcome) |
| level up | (omit) |
| game-changing | (omit) |
| powerful | (name the specific capability instead) |
| robust | (omit) |
| feature-rich | (list the features) |
| seamlessly | (omit) |
| leverage | use |
| utilize | use |
| streamline | (describe what is actually faster) |
| intuitive | (show it, don't claim it) |
| best-in-class | (omit) |
| cutting-edge | (omit) |
| "join the waitlist" | "express interest — be notified when [X] opens" |
| "Canadian pricing" | "CAD pricing" or "built for Canadian organizations" |

### Plan names — non-negotiable
Always use the full plan name. Never abbreviate or invent a shorthand. **Canonical names/prices/capacity: `docs/agents/strategy/PLAN_PRICING_FACTS.md` — do not restate numbers here.**

| Full name | Never say |
|---|---|
| Tournament *(free)* | "the free plan", "free tier", "starter" |
| Tournament Plus | "Plus", "Pro", "the paid plan" |
| League *(free floor)* | "League Starter", "Starter" |
| League Plus *($89 paid tier)* | "League" (that's the free floor now), "the league plan" |
| Club | "the club plan", "enterprise", "top tier" |
| Club · Association *(larger Club band)* | "Club Large", "enterprise" |
| Premium Coaches Portal | "Coach Portal", "Team plan", "Coaches Portal Premium" |

**League naming (ratified 2026-06-22):** mirrors Tournament — **League (free floor) → League Plus (paid $89)**. The 2026-06-13 rebrand stands; this supersedes any older "League = $89" framing in this doc.

---

## 6. Four Market Segments

These are parallel offerings for different types of operators — not a seniority ladder. A coach buying the Coaches Portal is not a "lower tier" than an org president on Club. Each segment has a distinct persona, pain point, and product.

---

### Segment 1 — Tournament Organizers

**Who they are**: Volunteer or staff administrators running single or recurring tournaments. Could be a club running an annual event, a sport association running a provincial qualifier, or a school running an intramural tournament. Often a one-person operation on the day.

**Their pain**: Building brackets in spreadsheets, scheduling across fields by hand, texting scores to someone who updates a whiteboard, fielding 40 emails from coaches about seeding, and starting from scratch every year.

**Our promise**: From first team registration to final standings — without the manual work in between.

**Tone**: Specific and concrete. Use numbers. "Build a 16-team double-elimination bracket in under 3 minutes." Don't sell features; show the time saved.

**Plans**: Tournament (free, no credit card) → Tournament Plus ($39/mo, $390/yr)

**CTA**: "Start running your tournament — free, no credit card required"

**Strategic note**: This is the primary acquisition channel. Tournament organizers are the first to see the brand, and many of them are also org presidents or coaches. The tournament experience is the top of the funnel for segments 2, 3, and 4. The brand experience during a tournament must feel like it belongs to a bigger platform — not just a bracket tool.

---

### Segment 2 — House League Administrators

**Who they are**: Presidents, registrars, or program directors at community leagues running seasonal house league operations. Sold to the president or senior exec, not a committee. Typically managing 100–500 player registrations per season.

**Their pain**: Player registration in Google Forms, team assignments in a spreadsheet, schedule conflicts discovered by a parent calling on a Saturday morning, standings updated manually after every game night, parent emails going out from personal inboxes.

**Our promise**: Run your entire season — registration, draft, schedule, standings — in one dashboard. Parents get automated notifications; you don't send a single email manually.

**Tone**: Emphasize the full season arc. "From first registration to final standings." This is a longer commitment than a tournament — copy should reflect sustained relief, not a one-time fix.

**Plan**: League ($89/mo, $890/yr)

**CTA**: "Express interest — be notified when League opens for your organization"

**Strategic note**: League is a peer of Club, not a stepping stone to it. A pure house league association belongs on League and has no reason to be on Club. Do not imply an upgrade path from League to Club in League-facing copy.

---

### Segment 3 — Club & Rep Team Organizations

**Who they are**: Presidents or senior executives of established clubs running rep team programs. Often also running a house league program under the same roof. Managing coaching staff, org-wide finances, tryouts, and annual program years. Sold at the org-president level.

**Their pain**: Coaching staff operating independently in WhatsApp groups and spreadsheets. Org exec with no visibility into team rosters, finances, or documents without asking. Tryouts managed by email chains. No central record of anything from year to year.

**Our promise**: Give coaches the autonomy to run their teams; give the org exec the visibility they need — without the constant check-ins and "can you send me the roster" requests.

**Tone**: Emphasize the org/coach relationship. The president gets control and visibility; the coach gets independence and tools. Both win. Frame around what disappears: the middle-man communication, the duplicate data entry, the lost files.

**Plan**: Club — banded by club size (Club from $219/mo, up to 15 teams; **Club · Association** for 15–30 teams, custom above 30). Includes house league, unlimited tournaments, accounting, and the **Premium Coaches Portal for the whole coaching staff — every team included, no per-team fee**. *(Canonical prices/bands: `docs/agents/strategy/PLAN_PRICING_FACTS.md`; while early-access, public framing is "Club — from $219/mo" and the firm Club · Association band price is held.)*

**CTA**: "Express interest — be notified when Club opens for your organization"

**Strategic note**: Club includes house league features. Many clubs that run rep teams also run a house league program — they do not need to purchase League separately. Club is the complete platform. Make this explicit in plan copy.

---

### Segment 4 — Individual Head Coaches (Coaches Portal)

**Who they are**: Head coaches of a single rep team, operating independently of a parent organization — or in an org that hasn't adopted FieldLogicHQ yet. Managing their own roster, schedule, team budget, lineups, and documents. Motivated by what's best for their players and their own time.

**Their pain**: Roster in a group text, lineup in a notes app, team fees tracked in someone's head, travel documents emailed in pieces, game schedule shared as a PDF that's immediately outdated.

**Our promise**: Manage your team with the same tools org-level admins use — lineups, budgets, scheduling, documents — whether or not your organization is on FieldLogicHQ.

**Plan**: Premium Coaches Portal standalone ($29/mo)

**CTA**: "Express interest — be notified when the Coaches Portal opens"

**The bridge message** — this is the critical copy element for this segment:

> "If your organization isn't on FieldLogicHQ yet, we still have a product for you. And when they join, your team account carries over automatically."

This message:
- Validates the standalone as a complete product (not a fallback)
- Plants a natural seed for org adoption (coaches become internal advocates)
- Removes the "I'd have to start over" objection when the org joins
- Never implies the coach is being charged twice

**Pricing bridge — how to present the org vs. standalone rate**:

On Club-facing copy:
> "Club includes the Premium Coaches Portal for your **whole coaching staff** — every coach, every team, no per-team fee. Coaches already on the standalone Premium Coaches Portal ($29/month)? Their account carries over and rolls into your Club plan automatically when your org joins."

On Coach-facing copy:
> "Start independently with the standalone Premium Coaches Portal at $29/month — everything you need to run your team, whether or not your organization is on FieldLogicHQ. When your org joins Club, your portal is **included** in their plan: your account carries over and you stop paying the standalone rate."

**Strategic note**: The Coaches Portal is a genuine product, not a consolation prize. Copy must convey completeness and autonomy first, with the org-level bridge as a secondary note — not the headline.

---

## 7. Tier Structure and Positioning Rules

### The tiers at a glance

> **Canonical prices, capacity, and gating live in `docs/agents/strategy/PLAN_PRICING_FACTS.md`** — that table is the source of truth (kept matched to the app config). The summary below is for orientation only; if it ever disagrees with the Facts doc, the Facts doc wins. ⚠ Some values are **decided / not yet built** (Club repackaging) — see the Facts doc for status.

| Plan | Monthly | Who it's for |
|---|---|---|
| Tournament *(free)* | Free | Running a single tournament |
| Tournament Plus | $39 | Running multiple tournaments or wanting auto-scheduling |
| League *(free floor)* | Free | A first house-league season (held for launch) |
| League Plus | $89 | Running a full house league program |
| Club ⭐ | $219 *(up to 15 teams)* | Running a full club — rep teams, house league, tournaments, accounting; whole coaching staff included |
| Club · Association | $379 *(15–30 teams; custom > 30)* | A larger club / association |
| Premium Coaches Portal *(standalone)* | $29 | Individual team management (carries over, and is **included**, when the org joins Club) |

*The per-team "$19 additional team" add-on is retired — Club includes the whole coaching staff within its band.*

### Rules

1. **Tiers are not a seniority ladder.** League and Club are peers for different org types — not a progression. A pure house league org is not a "smaller" version of a Club org. They are different organizations.

2. **League is not a prerequisite for Club.** An org president running rep teams goes directly to Club — they do not need to have been on League first. Make this explicit in FAQ copy.

3. **Club includes house league.** Many clubs run rep teams and a house league. They do not pay for both Club and League. Club is the complete platform.

4. **The Coaches Portal is a standalone product.** It is not Club Lite. It is not a trial. It is the full team management product for coaches whose org isn't on FieldLogicHQ.

5. **Most Popular: Club.** Not because it's cheapest or in the middle, but because it returns the most volunteer hours. Copy should emphasize recovered time, not feature count.

6. **Annual billing saves approximately two months** on each paid plan. Messaging: "Save two months — pay annually."

---

## 8. Site Architecture

The homepage's job is to help visitors recognize themselves and route to the right page — not to show everything the platform does.

### Proposed structure

```
/                               → Umbrella homepage (4 persona paths, above the fold)
/for-tournament-organizers      → Tournament segment page (live, fully purchasable)
/for-leagues                    → League segment page (marketed live, interest CTA)
/for-clubs                      → Club segment page (marketed live, interest CTA)
/for-coaches                    → Coaches Portal segment page (marketed live, interest CTA)
/pricing                        → Full 4-tier table + Club capacity-band row (Club / Club · Association) + coach standalone row
/platform/[module]              → Module deep-dives (existing, keep as-is)
/auth/signup                    → Tournament plan onboarding (default entry point)
/coaches                        → Coaches Portal entry and signup
```

### Homepage persona routing

The four entry points should appear prominently, above the fold, with a one-line description that makes self-selection immediate:

> — Running a tournament → **for you**
> — Managing a house league season → **for you**
> — Running a club with rep teams → **for you**
> — Coaching a single team → **for you**

### "Express interest" pattern for unavailable segments

For segments not yet open for purchase, use a consistent pattern:
- Label: "Express interest — be notified when [League / Club / Coaches Portal] opens"
- No waitlist queue language
- No commitment implied
- Captures email for launch notification

---

## 9. Tournament as Acquisition Funnel

Tournaments are the primary acquisition channel. The funnel:

1. **Org signs up for Tournament (free)** → first brand impression; must feel like a bigger platform, not just a bracket tool
2. **During tournament** → contextual, non-intrusive discovery of other modules (in-app placement, not interruption)
3. **Coaches use scorekeeping during tournament** → natural Coaches Portal discovery moment; this is where coaches first interact with the FieldLogicHQ UI
4. **Post-tournament email** → "Your tournament wrapped. Here's what else FieldLogicHQ can handle for your organization this season."
5. **Tournament organizer who is also an org president** → sees League and Club paths during onboarding; no hard push, but the paths are visible

**Implication for in-app copy**: Every in-app upsell or discovery moment for non-tournament features should be framed around what the org already experienced — "You ran your tournament here. Your house league season can live here too."

---

## 10. Geographic Positioning

**CAD pricing** is a concrete differentiator — call it out explicitly on pricing surfaces (stats bars, plan cards, footnotes).

**Do not use "Canadian" in headlines, hero copy, persona routing cards, or brand identity statements.** The platform is not scoped to Canada — using "Canadian" in positioning limits future expansion and excludes non-Canadian orgs who may be using or evaluating the product.

**Preferred framing**: "Built for how community sport actually runs" — sport-agnostic, geography-neutral, still specific to the volunteer-operator context.

**Where "Canadian" is acceptable**: factual callouts only — "Billed in CAD", "CAD pricing", plan card footnotes. Never as a brand identity claim.

Do not promise "Canadian payment processing" as a feature unless local payment infrastructure is confirmed.

---

## 11. Competitive Positioning

Never name competitors in public-facing copy (Teamsnap, LeagueApps, SportsEngine, etc.). Position against *the old way*, not against a named product.

**The old way** to reference:
- Spreadsheets (tournament brackets, standings, rosters, budgets)
- Email chains (registration, tryout communication, parent notifications)
- Separate tools stitched together (registration form + scheduling app + group chat)
- Institutional knowledge walking out the door when a volunteer turns over

**Our positioning**: FieldLogicHQ replaces the patchwork. One platform, one login, one place where the season lives from start to finish — for every role in the organization.

---

## 12. Copy Review Checklist

Before publishing any public-facing copy, verify:

- [ ] Connects to "less admin. More sport." or the core time-recovery promise
- [ ] Uses outcome language, not feature language
- [ ] Uses the correct full plan name (no abbreviations)
- [ ] Contains no forbidden words (see Section 5)
- [ ] Persona is clear — does this read like it was written for the specific audience?
- [ ] Tiers are not presented as a seniority ladder (unless the copy is specifically about upgrading Tournament → Tournament Plus)
- [ ] Coaches Portal is positioned as a complete product, not a fallback
- [ ] No competitor names used
- [ ] No unshipped features claimed as available

---

*This document is the canonical brand reference. All persona pages, pricing copy, email copy, and in-app upsell messaging should be consistent with it. The approved pricing page copy lives in `docs/agents/brand/PRICING_PAGE_COPY.md`. Design decisions live in `memory/design_decisions.md`.*
