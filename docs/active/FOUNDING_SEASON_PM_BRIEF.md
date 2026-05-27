# Founding Season — PM Brief

**Status:** Planning  
**Owner:** Marketing / Growth  
**Offer window:** Now through December 31, 2026  
**Full implementation plan:** [FOUNDING_SEASON_PLAN.md](FOUNDING_SEASON_PLAN.md)

---

## What This Is

A time-bounded offer giving new organizations free access to Tournament Plus (normally $39/month) through the end of 2026. Positioned as a **"Founding Season"** — not a trial, not a coupon. Orgs that sign up during this window are founding participants in the platform's first operating year.

---

## Why It Matters

FieldLogicHQ is launching the tournament portal first. The single biggest barrier to growth in year one isn't pricing — it's trust. Volunteer sports admins have been burned by bad software. They won't pay $39/month for a platform they've never used.

Removing the financial barrier for the founding cohort solves the trust problem while generating something money can't buy: real organizations running real tournaments. That usage becomes platform validation, case studies, referrals, and ultimately paying customers by January 2027.

Tournament Plus is the right tier to give away. The free Tournament plan is good enough to test the product but not deep enough to create habits. Tournament Plus — with auto-scheduling, brackets, and communications — is where the "this actually works" moment happens. That's the moment that creates a paying customer.

---

## What Customers Experience

- They land on a site that openly states the offer: *"Tournament Plus is free through December 31, 2026 for founding organizations."*
- They sign up with no credit card required. The onboarding flow asks one qualifying question: "How many tournaments does your organization run per year?" — used for outreach segmentation, not access gating.
- Their welcome email confirms the $39/month value being waived and the December 31 end date — no surprises.
- Their in-app billing page shows a "Founding Season" banner instead of an upgrade prompt. From October 1, the banner adds a "Add payment method" CTA so conversion is frictionless on January 1.
- They receive a 4-email conversion sequence: activity check-in (~60 days), renewal nudge (November 1), full-picture note (November 15), and final reminder (December 15).
- Between August and October, they also receive a **4-part feature spotlight series** — one email each on the House League module, Coaches Portal, Club tier, and the full platform roadmap. Each spotlight includes an early access interest CTA. Tournament organizers who also run leagues or employ coaches may convert to League or Club before the end of the founding season.
- On January 1, they either convert to $39/month (Tournament Plus) or fall back to the free Tournament plan — their data and history stay either way.

---

## Expected Customer Impact

- **30–50 founding organizations** running real tournaments by December 31, 2026
- **≥ 35% conversion** to paying Tournament Plus in January 2027 (target: 13+ paying orgs, ~$500+ MRR)
- **≥ 15 early access leads** generated for League, Club, and Coaches Portal through the spotlight series
- **≥ 3 founding orgs** upgrading to League or Club before January 2027 if those tiers open during the season
- Founding orgs become the platform's first social proof and referral engine
- Real tournament data validates feature decisions for League and Club module development

---

## Priority

**High.** This is the go-to-market strategy for the tournament portal launch. Without a defined acquisition offer, the platform has no mechanism to convert public marketing into real customers during the first operating year.

---

## Success Criteria

| Milestone | Target |
|---|---|
| Founding season callout live on homepage + pricing | Before first external marketing push |
| Email sequence built and loaded in Resend | Before first org signs up under this offer |
| 20+ orgs on the platform by October 31 | Mid-season health check |
| ≥ 60% of signing orgs run at least 1 tournament | Validates activation, not just signups |
| ≥ 35% paid conversion by February 1, 2027 | Founding season ROI |

---

## Dependencies

- **Stripe Phase G** (production billing cutover) must complete before January 1, 2027 for the conversion flow to work. If delayed, the January conversion is manual.
- **Resend email stack** must support cron-triggered emails (Day 60 check-in, November 1 nudge, December 15 reminder) — confirm EventBridge or equivalent scheduler is available.
- **Platform admin founding season filter** is needed before November to enable targeted outreach.

---

## What This Is Not

- A permanent free tier expansion (Tournament stays the free tier)
- A trial (no auto-charge at end of period without credit card on file)
- A discount on a paid subscription (it's a comp period, not a reduced rate)
