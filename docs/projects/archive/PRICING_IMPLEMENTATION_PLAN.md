# Pricing — Phase 1 Implementation Plan

**Status:** Complete (Phase 1A + 1C implemented 2026-05-12)
**Date:** 2026-05-12
**Content spec:** `PRICING_PAGE_COPY.md`
**Scope:** A (plan-config) + C (public pricing page). Stripe and in-app billing page are Phase 2.

---

## UX Summary (Product Manager View)

After this phase, two things change for users:

**What prospective customers see:** A new `/pricing` page exists at fieldlogichq.ca/pricing with the full four-plan layout — plan cards with a monthly/annual billing toggle, a feature comparison table, upgrade bridge callouts, Most Popular callout for Club, an FAQ section, and a bottom CTA. The homepage continues to show a compact pricing section. Both use the new plan names and prices.

**What happens inside the platform:** The plan config is updated so that when new orgs are created, they land on the `tournament` plan (free). Module access is now determined entirely by plan tier — League orgs automatically have the public site and house league modules enabled, Club orgs have all four modules. No manual admin step required to enable modules for appropriately-planned orgs.

No existing orgs are affected (no live clients). No Stripe changes in this phase.

---

## Phase 1A — Plan Config

### 1. `lib/types.ts`

Change the `OrgPlan` union type:

```ts
// Before
export type OrgPlan = 'starter' | 'pro' | 'elite';

// After
export type OrgPlan = 'tournament' | 'tournament_plus' | 'league' | 'club';
```

### 2. `lib/plan-config.ts`

Add `annualPrice: number` to the `PlanConfig` interface. Rewrite `PLAN_CONFIG` with four entries. Keep the `9999` convention for "unlimited" (existing pattern). Remove `priceId` from all plans for now — Stripe is Phase 2.

New plan config:

| Key | Label | Monthly | Annual | Tournaments | Seats | Officials Free | Module Entitlements |
|-----|-------|---------|--------|-------------|-------|----------------|---------------------|
| `tournament` | Tournament | $0 | $0 | 1 | 3 | No | CORE only |
| `tournament_plus` | Tournament Plus | $39 | $390 | 3 | 5 | Yes | CORE only |
| `league` | League | $89 | $890 | 9999 | 10 | Yes | CORE + public_site + house_league |
| `club` | Club | $179 | $1790 | 9999 | 9999 | Yes | CORE + public_site + house_league + accounting + rep_teams |

CORE_MODULES stays the same: `['module_tournaments', 'module_communications', 'module_members']`

### 3. Ripple effects — grep and fix

After changing `OrgPlan`, TypeScript will surface every location that references the old plan values. Work through each:

- Default plan on new org creation (likely in org creation logic / seed files)
- Any switch/case on `org.planId` values
- Any hardcoded `'starter'`, `'pro'`, `'elite'` string comparisons
- Dev seed data

`lib/module-entitlements.ts` — **no changes needed.** The two-axis check reads from `PLAN_CONFIG` dynamically.

---

## Phase 1C — Pricing Page

### Overview

The existing `PricingSection.tsx` component is completely rewritten — it currently holds old plan data (wrong names, prices, features). A new dedicated `/pricing` page is built that contains all sections from `PRICING_PAGE_COPY.md`. The homepage continues to use `<PricingSection />` in compact form.

### Files to create/modify

| File | Action | Notes |
|------|--------|-------|
| `components/PricingSection.tsx` | Rewrite | New plan data, 4 cards, billing toggle defaults to annual |
| `components/PricingSection.module.css` | Update | 4-column grid, Club card elevated treatment |
| `app/pricing/page.tsx` | Create | Full pricing page — all sections |
| `app/pricing/page.module.css` | Create | Page-level layout styles |

### PricingSection.tsx rewrite spec

The component is used on the homepage (compact). It should render the four plan cards with the billing toggle. The homepage wraps it in its own section heading — the component itself just renders the toggle + cards.

**Plan data (sourced from `PRICING_PAGE_COPY.md` Section 4):**

Tournament (Free):
- No badge
- Features: Manual tournament scheduling, Manual score entry, Basic standings, Field and diamond management, 3 staff / admin seats, 1 active tournament
- Upgrade nudge: "Need automated scheduling or bracket tools? → Tournament Plus"
- CTA: "Get Started Free" → `/auth/signup`
- Not highlighted

Tournament Plus ($39 / $390/yr):
- No "Most Popular" badge
- Features: Everything in Tournament + Automated schedule generation, Bracket generator, Email announcements and communications, Tournament archives and history, 3 non-archived tournament slots, 5 staff / admin seats, Unlimited officials seats
- Not-included note: "Built for tournament organizers — house league, accounting, and rep team tools not included."
- Upgrade nudge: "Running a public-facing league? → League"
- CTA: "Start Free Trial" → `/auth/signup`
- Not highlighted

League ($89 / $890/yr):
- No badge
- Features: Everything in Tournament Plus + Public organization page, House League module, League-scoped communications, Advanced member roles and permissions, 10 staff / admin seats
- Upgrade nudge: "Managing finances, tryouts, or competitive teams? → Club"
- CTA: "Start Free Trial" → `/auth/signup`
- Not highlighted

Club ($179 / $1,790/yr):
- "Most Popular" badge
- Features: Everything in League + Accounting module (org ledger, team invoicing, payment reconciliation, expense tracking), Rep Teams module (tryouts, rosters, player documents, coaches portal, team finances), Unlimited staff / admin seats
- "Why most popular" blurb: "Most organizations choose Club because of what they stop doing: hunting down payments, managing tryouts over email, reconciling team finances in spreadsheets."
- CTA: "Start Free Trial" → `/auth/signup`
- Highlighted card (elevated visual treatment)

**Toggle behaviour:**
- Default state: Annual (not monthly)
- Annual label: "Annual — 2 months free"
- Monthly label: "Monthly"
- Annual savings shown per card: Tournament Plus saves $78, League saves $178, Club saves $358

**Visual notes (match existing site design language):**
- Dark background, monospace font (`font-mono`), blueprint-blue borders
- Club card: `border-logic-lime` or equivalent accent, slightly elevated
- Check marks for included features — do NOT use X marks for excluded. Use `—` or omit
- Keep the existing CSS module pattern

### `/pricing` page spec

Full dedicated pricing page. All content from `PRICING_PAGE_COPY.md`. Sections in order:

**[1] Hero**
- H1: "Plans that match how your organization actually operates."
- Subheadline: "Pick the plan that fits where you are today. No modules to buy separately. No seat surprises. No contract required."
- Trust signals (4 items, icon row): Canadian pricing (CAD), No contracts — cancel anytime, 14-day free trial on paid plans, Plans can be changed at any time

**[2] Billing toggle + Plan cards**
- Reuse or inline `PricingSection` — or render the cards directly
- Defaults to Annual billing

**[3] Feature comparison table**
- "Compare all plans" anchor
- Grouped by category (see PRICING_PAGE_COPY.md Section 5):
  - Tournaments & Scheduling (use text values for scheduling row: "Manual" / "Automated" — ChatGPT table structure)
  - Staff & Access
  - Communications
  - Public Presence
  - House League
  - Accounting
  - Rep Teams
  - Free Trial
- Use ✓ for included, — (en dash) for not included. No ✗.
- Club column gets accent highlight

**[4] Upgrade bridge (3 callout blocks)**
- Tournament → Tournament Plus: "Ready to stop building schedules by hand?" (question format)
- Tournament Plus → League: "Running a public-facing organization?" (question format)
- League → Club: "When operations grow, disconnected tools become the problem." (declaration format — stronger here)
- Each has body copy and a "Start Free Trial" CTA (see PRICING_PAGE_COPY.md Section 6)

**[5] Most Popular callout — Club deep-dive**
- Headline: "Why most clubs choose the Club plan"
- Subheadline: "It's not about features. It's about time."
- Body paragraphs (see PRICING_PAGE_COPY.md Section 7)
- 3-column icon callout: Hours recovered / One place for everything / Built for the whole org

**[6] FAQ**
- Section headline: "Questions? We've got answers."
- Section subheadline: "Especially for volunteer-run organizations — we know the questions."
- Q1 (featured first): "Is this too complex for a volunteer-run organization?"
- Q2: "How does billing work?"
- Q3: "What happens when my free trial ends?"
- Q4: "Can I change plans later?"
- Q5: "Do I need a credit card to get started?"
- Q6: "What if we get stuck?"
- Q7: "Can I use FieldLogicHQ for multiple sports?"
- Q8: "Are officials counted against my seat limit?"
- Q9: "Is there a setup fee or onboarding cost?"
- Q10 (add from ChatGPT review): "Is the platform only for tournaments?"
- Full answer copy for each: see PRICING_PAGE_COPY.md Section 9
- Render as an accordion or static expand — accordion preferred for scannability

**[7] Bottom CTA**
- Headline (use ChatGPT's version): "Spend less time managing operations and more time running your organization."
- Subtext: "Free plan available. No credit card required for trials. Cancel anytime."
- Button 1 (primary): "Get Started Free" → `/auth/signup`
- Button 2 (secondary): "Have questions? Talk to us." → contact or `/auth/signup` for now

### Homepage update

The homepage `page.tsx` pricing section currently reads:
```
<h2>Simple pricing. Start free.</h2>
<p>Start for free — no credit card needed. Upgrade as you grow.</p>
<PricingSection />
```

Update the heading copy to match new positioning:
- H2: "Plans built for how you operate."
- Subtext: "From your first tournament to a full club — one platform that grows with you."

Add a "See full pricing →" link below `<PricingSection />` that anchors to `/pricing`.

---

## Build Order

1. `lib/types.ts` — OrgPlan type change first (TypeScript will surface all downstream errors)
2. `lib/plan-config.ts` — new PLAN_CONFIG
3. Fix all TypeScript errors from the type change (grep for old plan key strings)
4. `components/PricingSection.tsx` + `.module.css` — rewrite with new data
5. `app/pricing/page.tsx` + `.module.css` — new full pricing page
6. `app/page.tsx` — update homepage heading copy and add /pricing link

---

## Out of Scope (Phase 2)

- Stripe product/price setup
- In-app billing page (upgrade CTAs, current plan display, Stripe portal link)
- In-app feature gate upgrade messages
- Annual billing Stripe price IDs
- Any auth-gated plan management
