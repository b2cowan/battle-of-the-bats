# Pricing Page Copy — Canonical Record

*Approved: 2026-05-24 — established in marketing strategy session with /marketing agent*
*Source of truth for `app/pricing/page.tsx` copy. All agents reference this file rather than re-deriving copy.*

---

## Implementation notes

**Coaches Portal unification addendum (2026-05-25):** Pricing copy must treat Coaches Portal as one product with a free Basic state for tournament participants and a paid Premium state for standalone, org-billed, and Club coaches. Do not publish "Team" as a separate customer-facing plan. `/coaches` is the product route; legacy coach/team signup routes should redirect into `/coaches` before launch. Tournament participants get Basic Coaches Portal records at no charge. Paid Coaches Portal keeps CAD $29/month and CAD $290/season positioning unless pricing is changed by the owner. Public CTAs remain "Express interest" until the unified launch checklist passes; after launch, paid CTAs should start Coaches Portal signup. See `docs/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`.

- **URL rename**: Route Coaches Portal buyers to `/coaches` as part of the pricing page update. Affects: `BUYER_SEGMENTS[2].href`, the Coaches Portal section `<Link>`, and any cross-links from tournament confirmation and post-event emails (Phases 7C/7D).
- **Coaches Portal status**: Same as League and Club — marketed as a real forthcoming product, not purchasable yet. All CTAs use "Express interest" pattern, not signup links.
- **"Early Access" language**: Retired. Use "express interest — be notified when [X] opens" throughout.

---

## Page metadata

```
title: Pricing — FieldLogicHQ
description: Simple, honest pricing for every role in your organization — from running one tournament to managing a full club. Tournament and Tournament Plus are available now. League, Club, and the Coaches Portal are coming soon.
```

---

## Hero section

### Headline
> Plans built around how you actually operate.

### Sub
> Tournament and Tournament Plus are live — start free, no credit card required. League, Club, and the Coaches Portal are open for interest while we finish those workflows.

---

## Trust signals bar

```
Billed in CAD — no conversion surprises
No contracts — cancel anytime
Free plan available — no credit card required
Plans can be changed at any time
```

---

## Segment picker

### Header
- **Eyebrow**: Find your plan
- **Title**: What does your role look like?
- **Sub**: Not every plan is for every organization. Pick the role that fits — you'll land in the right place.

### Card 1 — Tournament organizer
- **Eyebrow**: Tournament organizer
- **Title**: I run tournaments.
- **Body**: From first team registration to final standings — free to start, no spreadsheets required.
- **CTA**: See tournament plans →
- **href**: `#org-plans`

### Card 2 — League or club leader
- **Eyebrow**: League or club leader
- **Title**: I run a league or a full club.
- **Body**: One platform for the whole season — house league registration, rep teams, accounting, and org-wide oversight. Available soon; express interest now.
- **CTA**: See League and Club →
- **href**: `#org-plans`

### Card 3 — Coach or team manager
- **Eyebrow**: Coach or team manager
- **Title**: I manage one competitive team.
- **Body**: A full Coaches Portal for one rep team — roster, lineups, budget, and schedule — without needing a full org account. Available soon; express interest now.
- **CTA**: Express interest →
- **href**: Early access modal (same pattern as League/Club)
- **featured**: true

---

## Coaches Portal plan section

### Labels and headline
- **Label**: For coaches running one team
- **Title**: Your team. Your Coaches Portal.

### Body
> The Coaches Portal is a standalone workspace built for a single rep team — everything a head coach needs to run a season, whether or not the organization is on FieldLogicHQ. If they join later, your workspace carries over automatically.

### Feature list
```
Full roster management — positions, jersey numbers, and season history
Game schedule, attendance tracking, and lineup builder with PDF export
Team budget, player dues, expense tracking, and payment reminders
Documents, season setup checklist, and year-over-year history
Tournaments included — run round robins, exhibition weekends, and local events
Tournament history included — every event your team has been part of, all in one place
Link to your parent organization anytime, without transferring ownership
```

### Pricing
- **Primary**: $29 CAD / month · $290 CAD / season (save two months)
- **Note**: One tournament slot active at a time — archive and reuse for new events.

### CTA
- **Label**: Express interest →
- **Action**: Early access modal, `initialPlanInterest: ['coaches_portal']`, `initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents']`

---

## Tournament Plus plan card — canonical feature list

*Approved 2026-05-25. Applied to `PricingSection.tsx` and `for-tournament-organizers/page.tsx`. Previously 17 items — trimmed to 9 by grouping related features. The old "Registration Control Bundle" umbrella label is removed; individual grouped bullets replace it.*

```
Everything in Tournament
Unlimited tournament slots
Automated schedule generation and playoff bracket builder
Custom registration fields, file uploads, and waitlist promotion
Registration exports — Excel, CSV, and PDF
Advanced payment tracking and post-tournament reporting
Full branding control — no FieldLogicHQ badge
Permanent sealed archives, tournament cloning, and targeted announcements
10 staff / admin seats · unlimited officials
```

**compactFeatures (5 items — wizard/modal use):**
```
Everything in Tournament
Unlimited tournament slots
Automated scheduling and bracket builder
Full branding control
10 staff / admin seats · unlimited officials
```

---

## Org plans section

### Header
- **Eyebrow**: For organizations
- **Title**: Tournament, League, and Club plans
- **Sub**: Use these plans when you manage events or organization-wide operations. Coaching a single team? The Coaches Portal is the right fit.

---

## Comparison table

### Column headers
```
Feature | Tournament | Tournament Plus | League | Club
```

*Below the table, add a single line:*
> League and Club are available for early interest — express interest to be notified when self-serve checkout opens. Coaches Portal follows the same timeline.

### Category: Tournaments & Scheduling
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Non-archived tournament slots | 1 | Unlimited | Unlimited | Unlimited |
| Tournament scheduling | Manual | Manual + automated | Manual + automated | Manual + automated |
| Playoff games / brackets | Manual | Generator included | Generator included | Generator included |
| Tournament archive flow | Basic archive | Sealed archives | Sealed archives | Sealed archives |
| Field and diamond management | ✓ | ✓ | ✓ | ✓ |
| Score entry and standings | ✓ | ✓ | ✓ | ✓ |

### Category: Registration Operations
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Team registration form | Standard fields | Custom fields + files | Custom fields + files | Custom fields + files |
| Registration exports (Excel, CSV, PDF) | — | Included | Included | Included |
| Selected-row registration updates | Included | Included | Included | Included |
| Division capacity and waitlists | Collection + review | Promotion tools | Promotion tools | Promotion tools |
| Payment and deposit tracking | Basic tracking | Advanced reporting | Advanced reporting | Advanced reporting |

### Category: Data & Exports
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Schedule export (Excel, CSV, iCal) | ✓ | ✓ | ✓ | ✓ |
| Results export (Excel, CSV) | ✓ | ✓ | ✓ | ✓ |
| Registration exports (Excel, CSV, PDF) | — | Included | Included | Included |
| PDF reports with branded templates | — | Included | Included | Included |
| League registration and standings exports | — | — | Included | Included |
| Rep team and accounting PDF reports | — | — | — | Included |

### Category: Staff & Access
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Staff / admin seats | 3 | 10 | 10 | Unlimited |
| Officials seats | Counted | Unlimited (free) | Unlimited (free) | Unlimited (free) |
| Advanced member roles and permissions | — | — | ✓ | ✓ |

### Category: Communications
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Basic team/contact email | ✓ | ✓ | ✓ | ✓ |
| Targeted tournament announcements | — | Included | Included | Included |
| League-scoped communications | — | — | ✓ | ✓ |

### Category: Public Presence
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Tournament public branding | FieldLogicHQ default | Full control | Full control | Full control |
| Powered by FieldLogicHQ badge | Shown | Not shown | Not shown | Not shown |
| Public organization page | — | — | ✓ | ✓ |
| Branded tournament listing | — | — | ✓ | ✓ |

### Category: House League
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| House League module | — | — | ✓ | ✓ |
| Player registration workflows | — | — | ✓ | ✓ |
| Season and division management | — | — | ✓ | ✓ |
| League scheduling and standings | — | — | ✓ | ✓ |

### Category: Accounting
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Accounting module | — | — | — | ✓ |
| Organization ledger | — | — | — | ✓ |
| Team invoicing | — | — | — | ✓ |
| Payment reconciliation | — | — | — | ✓ |
| Expense tracking | — | — | — | ✓ |

### Category: Rep Teams & Coaches Portal
| Feature | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Rep Teams module | — | — | — | ✓ |
| Tryout registration | — | — | — | ✓ |
| Roster management | — | — | — | ✓ |
| Player document management | — | — | — | ✓ |
| Team financial management | — | — | — | ✓ |
| Coaches Portal accounts (3 included) | — | — | — | ✓ |
| Additional Coaches Portal accounts | — | — | — | $19/mo each |

### Club plan card — feature list (approved 2026-05-25)
```
Everything in League
Unlimited staff / admin seats
Accounting module
Organization ledger and expense tracking
Team invoicing and payment reconciliation
Rep Teams module
Tryout registration and roster management
Player documents and season history
Team financial management
Coaches Portal — 3 team accounts included
Additional Coaches Portal accounts at $19/mo each
```

### Club plan card — tagline (approved 2026-05-25)
> The complete operating system for established clubs — tournaments, house league, rep teams, accounting, and coaching staff, all in one place.

---

## Upgrade bridges

### Bridge 1: Tournament → Tournament Plus
- **Label**: Tournament → Tournament Plus
- **Headline**: Running more than one tournament a year?
- **Body**: Tournament Plus removes the single-event limit and adds the tools that make repeat events sustainable: unlimited tournaments, automated scheduling, custom registration fields, file uploads, full export suite, payment reminders, waitlist promotion, and post-event archives. Ten staff seats and unlimited officials included.
- **CTA**: Start 14-Day Trial →
- **href**: `/auth/signup`
- **earlyAccess**: false

### Bridge 2: Tournament Plus → League
- **Label**: Tournament Plus → League
- **Headline**: Running a full house league season?
- **Body**: League adds everything beyond the tournament: a public organization page, house league registration and season management, division scheduling and standings, and advanced roles for registrars and program coordinators. Available soon — express interest to be notified when it opens.
- **CTA**: Express interest →
- **earlyAccess**: true
- **initialPlanInterest**: `['league']`
- **initialFeaturesInterested**: `['house_league', 'registration', 'public_site']`

### Bridge 3: League → Club
- **Label**: League → Club
- **Headline**: Running rep teams alongside your league?
- **Body**: Club is the complete platform for established clubs — tournaments, house league, rep teams, and accounting in one place. Includes three Coaches Portal accounts for your coaching staff, with additional teams at $19/month. Available soon — express interest to be notified when it opens.
- **CTA**: Express interest →
- **earlyAccess**: true
- **initialPlanInterest**: `['club']`
- **initialFeaturesInterested**: `['accounting', 'rep_teams', 'coach_portal']`

---

## Club/League deep-dive section

### Title
> League and Club — what's coming next

### Sub
> We're finishing the workflows before opening self-serve checkout. Here's what they cover.

### Body (3 paragraphs — keep existing content, update framing)

**Paragraph 1:**
> Tournament and Tournament Plus are the live plans available today. League and Club are shown here so organizations can understand the full platform direction before committing their tournament workflow to us.

**Paragraph 2:**
> League is focused on house league registration, divisions, seasons, public organization pages, and registrar workflows. Club adds rep teams and accounting — plus three Coaches Portal accounts for your coaching staff — for organizations that need the complete operating system.

**Paragraph 3:**
> If you want either tier, start on a live tournament plan now or express interest below. That keeps the launch honest while giving interested clubs a path into the roadmap.

### Status callouts (3 items)
| Label | Body |
|---|---|
| Available now | Tournament is the free plan — no credit card, no time limit. Tournament Plus adds registration control, schedule automation, brackets, archives, branding, and reporting. |
| Coming next | League and Club workflows are being finished before self-serve checkout opens. The Coaches Portal follows the same timeline. |
| Express interest | Share your details and module priorities before the broader plans launch. Nothing to buy yet — just a place in the notification queue. |

### CTA
- **Label**: Express interest →
- **Action**: Early access modal, `initialPlanInterest: ['league', 'club']`, `initialFeaturesInterested: ['house_league', 'registration', 'accounting', 'rep_teams']`

---

## FAQ

### Section header
- **Title**: Common questions — answered plainly.
- **Sub**: No jargon. No sales pitch. Just what you need to know before signing up.

### Full FAQ list

**Q: Is this too complex for a volunteer-run organization?** *(featured — badge: "Volunteer orgs")*
> No — and we built it with volunteer-run orgs specifically in mind. FieldLogicHQ is used by associations where the "tech person" is whoever stepped up at the last AGM. The platform is designed around tasks your team already does — scheduling, communications, score entry, registration — just without the spreadsheets and email chains. You don't need to configure anything complicated to get started. Most organizations are running their first tournament within an afternoon of signing up.

---

**Q: Is the platform only for tournaments?**
> No. Tournament and Tournament Plus are the live self-serve plans today, and the Coaches Portal is coming for coaches managing a single rep team. League and Club — covering house league seasons, rep team management, and accounting — are the next parts of the platform. They're shown here so your organization can plan ahead.

---

**Q: What if I only manage one competitive team?**
> Use the Coaches Portal. It's a standalone workspace for one rep team — roster, schedule, budget, documents, attendance, and lineups. No org account needed. If your organization joins FieldLogicHQ later, your workspace carries over automatically. The Coaches Portal is coming soon — express interest to be notified.

---

**Q: Can I buy League, Club, or the Coaches Portal today?**
> Not through self-serve checkout yet. Tournament and Tournament Plus are available now. League, Club, and the Coaches Portal are shown as coming-soon previews so organizations and coaches can plan ahead and express interest while those workflows are finished.

---

**Q: How does billing work?**
> Tournament Plus is billed monthly or annually in Canadian dollars. Monthly billing renews automatically each month. Annual billing is charged once per year — you pay for 10 months and get 12, which works out to roughly two months free. No contracts, no penalties.

---

**Q: What happens when my free trial ends?**
> At the end of your 14-day Tournament Plus trial, your plan continues at the regular rate for the billing period you chose. We'll send a reminder before it ends. Cancel before the trial closes and you won't be charged. Your data stays available for 90 days after cancellation — nothing is deleted immediately.

---

**Q: Can I change plans later?**
> Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There's no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that's exactly how the plans are designed.

---

**Q: Do I need a credit card to get started?**
> No card is required for the free Tournament plan. Tournament Plus trials use secure Stripe Checkout and collect payment details at signup, with the first payment charged automatically only after the trial ends.

---

**Q: What if we get stuck?**
> Every workflow is documented in plain language — written for the person who stepped up to run the org, not a developer. Most organizations are running their first tournament within an afternoon of signing up. If something's unclear, documentation is the first stop. If that doesn't cover it, you can reach us directly.

---

**Q: Can I use FieldLogicHQ for multiple sports?**
> Yes. The platform is sport-agnostic — used by softball associations, hockey organizations, soccer leagues, and baseball clubs. Field naming, team structures, scoring, and season setup all work across sports. If you run multiple associations, each one is managed as its own organization.

---

**Q: Are officials counted against my seat limit?**
> No — from Tournament Plus and above, officials seats are always free and never count against your staff/admin seat limit. The seat limit applies to administrative staff: people who create events, manage schedules, enter scores, and configure the organization.

---

**Q: Is there a setup fee or onboarding cost?**
> No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the live tournament tools. Documentation covers every available setup step.

---

## Bottom CTA section

### Title
> Less admin. More sport.

### Sub
> Start free with Tournament. Tournament Plus includes a 14-day trial. League, Club, and the Coaches Portal are coming soon — express interest to be notified.

### Primary CTA
- **Label**: Get Started Free →
- **href**: `/auth/signup`

### Secondary CTA
- **Label**: Express interest →
- **Action**: Early access modal, `initialPlanInterest: ['league', 'club']`, `initialFeaturesInterested: ['house_league', 'registration', 'accounting', 'rep_teams']`

### Footnote
> All plans are billed in CAD. No contracts. No setup fees.

---

## Change log

| Date | Change |
|---|---|
| 2026-05-25 | Tournament Plus plan card: feature list trimmed from 17 to 9 bullets by grouping related features. "Registration Control Bundle" umbrella label removed; replaced with grouped specifics. compactFeatures updated to match. Applied consistently to PricingSection.tsx, for-tournament-organizers/page.tsx, and this doc. Free tier "Schedule generator" corrected to "Manual scheduling across fields and time slots" to match comparison table. Coaches Portal callout added to homepage pricing section. |
| 2026-05-25 | Club plan card: tagline rewritten to remove "A preview of" framing; feature list expanded from 4 to 11 bullets (Accounting and Rep Teams broken into specific lines; Coaches Portal given dedicated bullet with "3 included / $19 add-on" pricing). Club compactFeatures updated to 5 items matching new specificity. Gated plan CTA corrected from "Join Early Access" to "Express interest" per canonical copy. Comparison table footnote updated to reference Coaches Portal standalone option. |
| 2026-05-24 | Initial approved copy established. "Team" → "Coaches Portal" throughout. "Join Early Access" → "Express interest" throughout. Route migration into `/coaches` noted as implementation task. Tournament history feature confirmed for Coaches Portal launch. Hero headline confirmed as "Plans built around how you actually operate." |
