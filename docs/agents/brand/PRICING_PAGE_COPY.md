# FieldLogicHQ — Pricing Page Copy

**Status:** Live — Phase 2/3 audit amendments applied 2026-05-27  
**Original draft:** 2026-05-12  
**Last updated:** 2026-05-27  
**Supersedes:** Previous three-tier + module add-on strategy (initial draft, no longer on disk)

---

## ⚠️ AMENDMENTS — Phase 1 + Phase 2/3 Brand Audit (applied 2026-05-27)

The sections below document all copy changes applied to the live pages after the brand strategy audit. Where original draft copy in this document conflicts with an amendment, the amendment wins. The live page files are always the authoritative state; this document records the approved intent.

### Phase 1 amendments (applied 2026-05-27)
- `/for-tournament-organizers` planNote → "Free through Dec 31, 2026 — Founding Season · $390/year from Jan 2027"; CTA → "Start Free — No Credit Card →"
- `/pricing` Bridge 1 CTA → "Start Free — No Credit Card" (not "Start Free Trial")
- `/pricing` trust signal → "Tournament is free" (not "Tournament is the free plan")
- `app/page.tsx` — "Club" capitalized in Step 01 How It Works desc
- `/for-leagues` + `/for-clubs` — "Plans can change at any time" → "Upgrade or downgrade at any time"
- `/for-leagues` plan section sub → "League is opening soon. Express interest to be notified when self-serve checkout opens for your organization."
- `/for-coaches` ctaSub → "No commitment required."
- `/for-coaches` cross-sell Q → "Is your organization on FieldLogicHQ yet?"
- `lib/plan-config.ts` `tournament_plus.seatLimit` corrected 10 → 5 (also fixed in ComparisonTable, PLUS_FEATURES, pricing bridge body)

### Phase 2 amendments (applied 2026-05-27)
- `app/page.tsx` Step 03 desc → "Enter scores from the field, publish results, and keep your tournament history on record — every event your org has run, in one place." (removed roadmap hedge)
- `/for-leagues` "How it works" H2 → "Registration to final standings — four steps." (was duplicate of H1)
- `/for-leagues` Coaches Portal cross-sell body → "A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed. And when your organization joins FieldLogicHQ, their workspace carries over automatically."
- `/for-coaches` plan section sub → "One team, one tournament at a time — roster, lineups, budget, schedule, and documents, all in one place. Standalone, or as part of a Club subscription when your org joins."
- `/pricing` trust signals → "Tournament is free — no credit card required" + "Upgrade or downgrade at any time"
- `/pricing` Coaches Portal callout body → added bridge sentence: "When your org joins Club, your workspace carries over automatically."
- `/pricing` FAQ "What happens when my free trial ends?" → replaced with "What happens after the Founding Season offer ends?" (see Section 9 below for approved answer)
- `/pricing` FAQ "Do I need a credit card?" → updated to reflect Founding Season (no card required for Tournament Plus through Dec 31, 2026)
- `/pricing` "Express interest" stat body → removed "notification queue" language

### Phase 4 amendments (applied 2026-05-28)
- Seat limits removed from all paid plans (Tournament Plus, League, Club). Free Tournament tier retains 3-seat limit as soft abuse guard only.
- `lib/plan-config.ts` — `tournament_plus.seatLimit` and `league.seatLimit` set to 9999 (Unlimited)
- All pricing copy updated: Tournament Plus and League now show "Unlimited staff / admin seats" everywhere
- Comparison table Staff & Access row: Plus "5" → "Unlimited", League "10" → "Unlimited"
- Appendix quick-reference table updated accordingly
- FAQ "Are officials counted against my seat limit?" replaced with "Is there a limit on how many staff accounts I can have?" — answer clarifies unlimited on all paid plans, 3-seat soft limit on free tier only
- In-app upgrade banner for seat limit now applies to free Tournament tier only
- Members page: removed "Tournament Plus staffing pattern" note referencing 10-seat allowance

### Phase 3 amendments (applied 2026-05-27)
- `/pricing` segment picker expanded from 3 → 4 cards: "League or club leader" split into "House league administrator" and "Club executive" as separate cards
- `/pricing` upgrade bridge labels: "Tournament Plus → League" changed to "House league administrators"; "League → Club" changed to "Club executives"; body copy rewritten to remove tier-ladder framing and explicitly state no prior plan is required
- `/pricing` ComparisonTable Availability section: "Free trial / 14 days" row → "Founding Season offer / Free through Dec 31, 2026"; "Payment details at signup" for Tournament Plus → "No (Founding Season)"

### Sections in this document that are superseded by amendments
- **Section 2 Trust Signals** — see amendment above for current approved copy
- **Section 4 Card 2** — badge and CTA use "Founding Season" not "14-Day Free Trial"; see amendments
- **Section 6 Upgrade Bridges** — Bridge 2 and Bridge 3 labels and body copy are superseded; see amendments
- **Section 9 FAQ** — "What happens when my free trial ends?" and "Do I need a credit card?" are superseded; see Section 9 LIVE FAQ below
- **Appendix tournament slots** — Tournament Plus tournament slots are unlimited (9999), not 3; config was corrected

### ⏰ Post-Founding Season update checklist (before Jan 1, 2027)
When December 31, 2026 passes, update the following before January billing activates:
- [ ] Hero sub — remove "no credit card required" from Tournament Plus mention
- [ ] Founding Season callout card on homepage and pricing page — remove or replace
- [ ] FAQ "What happens after the Founding Season offer ends?" — replace with cancellation FAQ
- [ ] FAQ "Do I need a credit card?" — update Tournament Plus answer
- [ ] ComparisonTable Availability section — update "Founding Season offer" row and "Payment details at signup"
- [ ] `lib/plan-config.ts` — review `trialDays` for `tournament_plus` before Stripe billing goes live
- [ ] Update this document to remove all Founding Season references

---

## SECTION 9 — LIVE FAQ (authoritative — supersedes original Section 9)

The following are the approved live FAQ answers as of 2026-05-27. The original Section 9 below retains useful framing guidance but the specific answers here take precedence.

**Q: What happens after the Founding Season offer ends?**  
A: Tournament Plus is free through December 31, 2026 for organizations that sign up during the founding season — no credit card required. Starting January 2027, the standard rate of $39/month applies. We'll send a reminder before the offer closes. Your data and settings stay in place regardless of what you choose at renewal.

**Q: Do I need a credit card to get started?**  
A: No. Tournament is free — no credit card, no time limit. During the Founding Season (through December 31, 2026), Tournament Plus is also free with no payment details required. Starting January 2027, paid plans use secure Stripe Checkout.

*All other FAQ answers in original Section 9 remain approved and current.*

---

## Structural Notes

The new pricing model bundles all modules into four named plans. There are no à la carte module add-ons. Plans are named after organizational roles, not SaaS seniority tiers. This document contains all copy needed to build the pricing page.

---

## 1. PAGE LAYOUT (recommended structure, top to bottom)

```
[1] PAGE HERO — headline, subheadline, trust signals
[2] BILLING TOGGLE — Monthly | Annual (save ~2 months)
[3] PRICING CARDS — 4 plans, horizontal row
[4] FEATURE COMPARISON TABLE — full breakdown
[5] UPGRADE BRIDGE — 3 short "why upgrade" callout blocks
[6] MOST POPULAR CALLOUT — Club deep-dive justification
[7] TESTIMONIAL STRIP — 4 cards, one per plan
[8] FAQ — volunteer-org-first, 8 questions
[9] BOTTOM CTA — "Start Free" + "Talk to us"
```

---

## 2. PAGE HERO

### Primary Headline (H1)
> Plans that match how your organization actually operates.

### Alternative Headlines
> Simple, honest pricing for Canadian sports organizations.

> From your first tournament to your full club — one platform that grows with you.

### Subheadline (shown below H1)
> Pick the plan that fits where you are today. No modules to buy separately. No seat surprises. No contract required.

### Alternative Subheadlines
> Every plan is built around what your organization needs to run — not arbitrary usage limits.

> FieldLogicHQ handles the admin. You handle the sport.

### Trust Signals (icon row beneath hero, 3–4 items)
- Canadian organization, Canadian pricing (CAD)
- No contracts — cancel anytime
- Plan-specific paid trials: 14 days for Tournament Plus, 30 days for League, 90 days for Club early adopters
- Plans can be changed at any time

---

## 3. BILLING TOGGLE

```
[ Monthly ]   [ Annual — Save 2 Months ]
```

**Toggle label copy options:**
- Annual (Save ~2 Months Free)
- Annual Billing — Pay for 10, Get 12
- Switch to Annual — You Save on Every Plan

**Tooltip/note on annual:**
> Annual plans are billed once per year. You can switch back to monthly at renewal. No penalty for upgrading mid-year.

---

## 4. PRICING CARDS

Layout: four equal-width cards in a horizontal row. Club card is visually elevated (border highlight, "Most Popular" badge). Cards include: plan name, subtitle, price, CTA, feature list, and a brief "not included" callout at the bottom of lower-tier cards.

---

### CARD 1 — TOURNAMENT (Free)

**Plan Name:** Tournament

**Subtitle/tagline:**
> Everything you need to run a basic tournament.

**Price Display:**

| Billing | Display |
|---------|---------|
| Monthly | Free |
| Annual | Free |

**CTA Button:**
> Get Started Free

**Feature List:**
- Manual tournament scheduling
- Basic standard team registration
- Waitlist management and team status tracking
- Score entry and results
- Standings
- Venue management
- Public news posts
- Basic team/contact email
- Default FieldLogicHQ styling
- 3 staff / admin seats
- 1 tournament slot

**"What's next" upgrade nudge (bottom of card):**
> Need automated scheduling or bracket tools? → Tournament Plus

---

### CARD 2 — TOURNAMENT PLUS ($39 / $390)

**Plan Name:** Tournament Plus

**Subtitle/tagline:**
> Professional tournament management without the league complexity.

**Price Display:**

| Billing | Display |
|---------|---------|
| Monthly | $39 CAD / month |
| Annual | $390 CAD / year *(you save $78 — 2 months free)* |

**Badge:** 14-Day Free Trial

**CTA Button:**
> Start Free Trial

**Feature List:**
- Everything in Tournament
- Automated schedule generation
- Bracket generator
- Email announcements and communications
- Tournament archives and history
- Unlimited tournament slots
- Unlimited staff / admin seats
- Unlimited officials seats

**"Not included" callout:**
> This plan is built for tournament organizers who don't need league or club features. House league, accounting, and rep team management are not included — by design.

**"What's next" upgrade nudge:**
> Running a public-facing league or registrations? → League

---

### CARD 3 — LEAGUE ($89 / $890)

**Plan Name:** League

**Subtitle/tagline:**
> Manage your league, registrations, and public presence — all in one place.

**Price Display:**

| Billing | Display |
|---------|---------|
| Monthly | $89 CAD / month |
| Annual | $890 CAD / year *(you save $178 — 2 months free)* |

**Badge:** 14-Day Free Trial

**CTA Button:**
> Start Free Trial

**Feature List:**
- Everything in Tournament Plus
- Public organization page (branded, tournament-listed)
- House League — registration, divisions, seasons, and standings
- League-scoped communications
- Advanced member roles and permissions

**"What's next" upgrade nudge:**
> Managing finances, tryouts, or competitive teams? → Club

---

### CARD 4 — CLUB ($179 / $1,790) ⭐ Most Popular

**Plan Name:** Club

**Badge:** Most Popular

**Subtitle/tagline:**
> The complete operating system for your sports organization.

**Price Display:**

| Billing | Display |
|---------|---------|
| Monthly | $179 CAD / month |
| Annual | $1,790 CAD / year *(you save $358 — 2 months free)* |

**Badge:** 14-Day Free Trial

**CTA Button:**
> Start Free Trial

**Feature List:**
- Everything in League
- Accounting — org ledger, invoicing, expense tracking, and payment reconciliation
- Rep Teams — tryouts, rosters, player documents, and season history
- Coaches Portal — 3 team accounts included; additional accounts at $19/mo

**"Why most popular" blurb (shown within or beneath the card):**
> Most organizations choose Club because of what they stop doing: hunting down payments, managing tryouts over email, reconciling team finances in spreadsheets. Club eliminates the manual work that takes up treasurer and executive time all season. If your organization runs rep teams or manages money, it pays for itself quickly.

---

## 5. FEATURE COMPARISON TABLE

Full breakdown, grouped by category. Shown below the pricing cards with a "Compare all plans" toggle or section anchor.

### Table Headers

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|

---

### Category: Tournaments & Scheduling

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Non-archived tournament slots | 1 | Unlimited | Unlimited | Unlimited |
| Manual scheduling | ✓ | ✓ | ✓ | ✓ |
| Automated schedule generation | — | ✓ | ✓ | ✓ |
| Bracket generator | — | ✓ | ✓ | ✓ |
| Tournament archives and history | — | ✓ | ✓ | ✓ |
| Field and diamond management | ✓ | ✓ | ✓ | ✓ |
| Score entry | ✓ | ✓ | ✓ | ✓ |
| Standings | ✓ | ✓ | ✓ | ✓ |

---

### Category: Staff & Access

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Staff / admin seats | 3 | Unlimited | Unlimited | Unlimited |
| Officials seats | Counted toward limit | Unlimited | Unlimited | Unlimited |
| Advanced member roles and permissions | — | — | ✓ | ✓ |

---

### Category: Communications

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Email announcements | — | ✓ | ✓ | ✓ |
| League-scoped communications | — | — | ✓ | ✓ |

---

### Category: Public Presence

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Public organization page | — | — | ✓ | ✓ |
| Branded tournament listing | — | — | ✓ | ✓ |

---

### Category: House League

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| House League module | — | — | ✓ | ✓ |
| Player registration workflows | — | — | ✓ | ✓ |
| Season and division management | — | — | ✓ | ✓ |
| League scheduling and standings | — | — | ✓ | ✓ |

---

### Category: Accounting

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Accounting module | — | — | — | ✓ |
| Organization ledger | — | — | — | ✓ |
| Team invoicing | — | — | — | ✓ |
| Payment reconciliation | — | — | — | ✓ |
| Expense tracking | — | — | — | ✓ |

---

### Category: Rep Teams

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Rep Teams module | — | — | — | ✓ |
| Tryout registration | — | — | — | ✓ |
| Roster management | — | — | — | ✓ |
| Player document management | — | — | — | ✓ |
| Coaches portal | — | — | — | ✓ |
| Team financial management | — | — | — | ✓ |

---

### Category: Free Trial

| Feature | Tournament | Tournament Plus | League | Club |
|---------|-----------|-----------------|--------|------|
| Trial length | — | 14 days | 30 days | 90 days |
| Payment details at signup | — | ✓ | ✓ | ✓ |

---

## 6. UPGRADE BRIDGE CALLOUTS

Three short blocks, placed between cards or after the comparison table. Each makes the upgrade case in plain language.

---

### Tournament → Tournament Plus

**Headline:**
> Ready to stop building schedules by hand?

**Body:**
> Tournament Plus gives you automated scheduling, bracket generation, and email communications. For organizations running more than one event a year, the time saved on schedule builds alone is worth the upgrade.

**CTA:** Start Free Trial

---

### Tournament Plus → League

**Headline:**
> Running a public-facing organization?

**Body:**
> League adds a branded public page for your organization, a full house league module with registration and season management, and the advanced permissions your registrar and division coordinators need. One platform for everything members interact with.

**CTA:** Start Free Trial

---

### League → Club

**Headline:**
> Still managing rep team finances in spreadsheets?

**Body:**
> Club adds full accounting and rep team management — the two things that consume the most volunteer time in any organization. Invoicing, payment tracking, tryout coordination, roster management, player documents, and a coaches portal are all included. Most Club organizations recover that time within the first season.

**CTA:** Start Free Trial

---

## 7. MOST POPULAR CALLOUT SECTION (Club deep-dive)

This is a standalone section below the pricing cards — a brief feature callout block that explains why Club earns the "Most Popular" designation despite being the highest-priced plan.

**Section Headline:**
> Why most clubs choose the Club plan

**Section Subheadline:**
> It's not about features. It's about time.

**Body:**
> The two tools that Club adds — accounting and rep team management — are where sports organizations lose the most time every season. Chasing payments. Reconciling who owes what. Coordinating tryouts over email. Keeping track of player documents. Sending rosters to coaches who then manage their own spreadsheets.
>
> Club centralizes all of it. Treasurers get a real ledger. Team managers stop chasing paper. Coaches have their own portal. And the executive doesn't spend Sunday nights in a spreadsheet.
>
> That's why it's the most popular plan — not because organizations want the most features, but because they want their volunteer hours back.

**Icon callouts (3-column layout):**

| Icon | Label | Microcopy |
|------|-------|-----------|
| ⏱ | Hours recovered every season | Accounting and rep team tools eliminate the manual coordination that costs volunteer orgs most of their time |
| 📋 | One place for everything | Rosters, finances, documents, schedules, and communications — no more fragmented tools |
| 👥 | Built for the whole org | Treasurers, coaches, registrars, and executives each get the access they need without stepping on each other |

---

## 8. UPGRADE-ORIENTED MICROCOPY

Short text fragments for use in banners, tooltips, and inline upgrade prompts throughout the platform.

### In-app upgrade banners (by feature gate)

**When a user hits the 1-tournament limit (Tournament plan):**
> Running more than one event? Tournament Plus removes the single-tournament limit — run as many as you need.

**When a user tries to add a 4th staff member (Tournament free plan):**
> You've reached the 3-seat staff limit on the free Tournament plan. Upgrade to Tournament Plus for unlimited staff seats.

**When a user accesses a gated feature (communications):**
> Email announcements are included on Tournament Plus and above. Upgrade to reach your participants directly from FieldLogicHQ.

**When a user accesses a gated feature (bracket generator):**
> Bracket generation is a Tournament Plus feature. Your current plan supports manual scheduling.

**When a user accesses a gated feature (public site):**
> A public organization page is included on League and above — give your members a place to find your schedule, results, and registration.

**When a user accesses a gated feature (house league):**
> House League management is included on the League plan. Upgrade to run registrations, manage divisions, and publish standings publicly.

**When a user accesses a gated feature (accounting):**
> The Accounting module is included on the Club plan. Track payments, reconcile invoices, and manage your org ledger in one place.

**When a user accesses a gated feature (rep teams):**
> Rep Team management is included on the Club plan — tryouts, rosters, documents, and a coaches portal, all connected.

### Billing page plan comparison microcopy

**Below plan name on billing page (current plan card):**
- Tournament: You're on the free plan. Upgrade anytime — no credit card required until you're ready.
- Tournament Plus: You're on Tournament Plus. Running a league or registration workflow? League unlocks those tools.
- League: You're on League. Need accounting or rep team tools? Club is the complete platform.

### Billing page upgrade card copy — question → action pattern (approved 2026-05-28)

Feature lists have been removed from upgrade cards. Each card now shows a self-identifying question, a one-sentence value line, and a link to open the plan article panel. The upgrade button is separate and stays visible for users who don't need convincing.

**Tournament Plus card:**
- Question: "Ready to stop building your schedule by hand?"
- Sub: "Tournament Plus handles schedule generation, brackets, and email communications — so you're not starting from scratch for every event."
- Link: "See what Tournament Plus includes →"

**League card:**
- Question: "Does your organization run a year-round league, or need a public-facing presence?"
- Sub: "League adds player registration, house league season management, a public org page, and automated parent notifications."
- Link: "See what League includes →"

**Club card:**
- Question: "Coordinating rep teams or managing org finances outside the platform?"
- Sub: "Club adds full accounting and rep team management — the two tools that take the most time from any volunteer organization."
- Link: "See what Club includes →"

**Article panel:** Clicking "See what [Plan] includes →" opens a right-side slide-out panel rendering the same content used by `/for-tournament-organizers`, `/for-leagues`, and `/for-clubs`. Content is sourced from `lib/plan-article-content.ts` — updating that file propagates to both the public pages and the billing panel.

### Annual upsell (on billing page, monthly subscribers)
> Switch to annual billing and get two months free. No other changes to your plan — cancel anytime at renewal.

---

## 9. FAQ SECTION

### Section Headline
> Questions? We've got answers.

### Section Subheadline
> Especially for volunteer-run organizations — we know the questions.

---

### Volunteer Organization FAQ (featured, appears first)

**Q: Is this too complex for a volunteer-run organization?**

> No — and we built it with volunteer-run orgs specifically in mind. FieldLogicHQ is used by associations where the "tech person" is whoever stepped up at the last AGM. The platform is designed around tasks that your team already does (scheduling, communications, score entry, registration) — just without the spreadsheets and email chains. You don't need to configure anything complicated to get started. Most organizations are running their first tournament within an afternoon of signing up. If you get stuck, the documentation covers every feature in plain language, and Club plan subscribers get direct support access.

---

### General FAQ

**Q: How does billing work?**

> Paid plans are billed monthly or annually in Canadian dollars. Monthly billing renews automatically each month. Annual billing is charged once per year — you pay for 10 months and get 12, which works out to roughly 2 months free. You can switch between monthly and annual at any renewal date. No contracts, no penalties.

**Q: What happens when my free trial ends?**

> At the end of your trial, your plan continues at the regular rate for the plan and billing period you selected. Tournament Plus trials run 14 days, League trials run 30 days, and Club early-adopter trials run 90 days. We'll send reminders before your trial ends. If you decide not to continue, you can cancel before the trial period closes and you won't be charged. Your data stays available for 90 days after cancellation in case you change your mind.

**Q: Can I change plans later?**

> Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There's no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that's exactly how the plans are designed.

**Q: Do I need a credit card to get started?**

> No card is required for the free Tournament plan. Paid plan trials use secure Stripe Checkout and collect payment details at signup, with the first payment charged automatically only after the trial ends.

**Q: What if we get stuck?**

> FieldLogicHQ is designed to be self-serve — every workflow is built to be completed without needing to contact anyone. Documentation covers every feature in plain language, written for administrators who aren't technical. In practice, most organizations are fully operational after an afternoon of setup. If something isn't clear, the documentation is the first place to look, and it's updated as the platform evolves.

**Q: Can I use FieldLogicHQ for multiple sports?**

> Yes. The platform is sport-agnostic — it's used by softball associations, hockey organizations, soccer leagues, and baseball clubs. You configure your organization around your sport: field naming, team structures, scoring, and season setup all work across sports. If you run multiple associations, each one is managed as its own organization within the platform.

**Q: Is there a limit on how many staff accounts I can have?**

> Not on any paid plan. Tournament Plus, League, and Club all include unlimited staff seats — add as many admins, schedulers, and scorekeepers as you need. The free Tournament tier includes 3 staff seats as a soft limit. On the free tier, officials count toward that limit; on all paid plans there is no staff seat limit at all.

**Q: Is there a setup fee or onboarding cost?**

> No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the platform. The documentation covers every setup step, including first-season configuration, accounting setup, and rep team structure.

---

## 10. TESTIMONIAL THEMES (copy directions — one per plan)

These are intended as guidance for sourcing real testimonials or writing representative ones. Do not publish these as real quotes.

---

**Tournament plan testimonial direction:**

*Profile:* A first-time tournament organizer — a parent volunteer, minor sports coordinator, or new committee member who has never managed an event digitally before. They were expecting a learning curve and were surprised by how quickly they got started. The copy should focus on ease of setup, not features. The emotional payoff is confidence: "I actually knew what I was doing."

*Theme:* "I ran my first tournament in two days and didn't need help from anyone."

---

**Tournament Plus testimonial direction:**

*Profile:* A tournament director or organization that runs 3–5 events per year across multiple age divisions. They used to spend hours building schedules in Excel. The copy should be about time savings and professionalism — they now look like they have a dedicated operations team, even though it's still just 2 people. The emotional payoff is relief and scale.

*Theme:* "What used to take a full weekend now takes a couple of hours."

---

**League testimonial direction:**

*Profile:* A recreational league registrar or operations lead. They replaced a combination of a WordPress site, Google Forms for registration, and email blasts to division coordinators. Everything was disconnected. The copy should focus on consolidation — one login, everything in one place, members can actually find information. The emotional payoff is order and legitimacy.

*Theme:* "Our members can actually find everything now. It looks like a real league."

---

**Club testimonial direction:**

*Profile:* A club executive or treasurer of a competitive sports organization — softball association, hockey club, soccer club. The copy should focus on the accounting and rep team tools specifically. Before Club, they were managing rep team finances in spreadsheets, coordinating tryouts over email, and spending significant time tracking which families owed what. The emotional payoff is recovered time — hours per week that now go somewhere useful.

*Theme:* "I used to spend every Sunday night in a spreadsheet. That's done."

---

## 11. VISUAL HIERARCHY RECOMMENDATIONS

**Page flow priority:** Hero → Toggle → Cards → Comparison Table → FAQ → Bottom CTA

**Club card visual treatment:**
- Elevated appearance: slightly taller card, subtle drop shadow or border highlight in brand accent color
- "Most Popular" badge: top-right badge, solid accent color background, white text
- The badge should read "Most Popular" — not "Best Value" or "Recommended." Most Popular is a fact claim; the other two are opinions that invite skepticism.
- The card body copy (the "why most popular" blurb) should appear inline on the card or immediately adjacent — don't make users scroll to justify the choice

**Annual billing toggle:**
- Default state should be Annual (not Monthly) — it shows the better value and anchors the user's expectations higher. Monthly toggle should still be one click away.
- Show savings clearly on annual view: add "Save $X" or "2 months free" beneath each paid plan price on annual toggle

**Feature comparison table:**
- Group by category (as structured above) — don't flatten into a single alphabetical list
- Use ✓ for included, — (en dash) for not included. Avoid ✗ — it feels punitive. The dash is neutral and the card copy already handles the "not included" framing for lower tiers.
- Sticky header row on scroll
- Highlight the Club column with the same accent treatment as the pricing card

**Upgrade bridge callouts:**
- Place between the comparison table and the FAQ
- Style as a 3-column feature callout row, not a plain text block
- Each callout should have an icon or visual to break up the text

---

## 12. FRICTION-REDUCTION SUGGESTIONS

**Pricing anxiety:**
- The "no credit card required" signal should appear near each CTA button — not just in the FAQ. Repeat it visually where decisions happen.
- Add the "cancel anytime" reassurance inline on the paid plan cards, not just in the FAQ
- Show "CAD" clearly and early — Canadian orgs are accustomed to seeing USD pricing on US SaaS tools and calculating conversion in their heads. Making CAD explicit immediately removes that friction.

**Feature comprehension:**
- Avoid feature jargon in the card lists. "Bracket generator" is fine. "Automated schedule generation" is fine. Don't write "advanced scheduling engine" or "dynamic bracket management" — plain language wins.
- For the comparison table, consider adding a one-line description below each category header so users understand what they're evaluating without needing to click into docs.

**Plan selection confidence:**
- The subtitles (one-line tagline per plan) do the heaviest lifting for self-selection. Keep them visible at all times — don't collapse them on mobile.
- Consider adding a "Not sure which plan is right?" link that anchors to the FAQ or surfaces a 3-question self-selection tool.

**Mobile layout:**
- On mobile, default to showing the Club card first (since it's Most Popular) rather than left-to-right ordering, which would show Tournament first and require the user to swipe to reach the recommended plan.
- Make the billing toggle persistent (sticky) so users can switch between monthly and annual pricing while scrolling through plans.

**Trust signals:**
- Add a "Used by Canadian sports organizations in [sport], [sport], and [sport]" signal beneath the hero — specificity builds trust better than generic "trusted by X organizations."
- If you have org logo permission from any current customers, a small logo strip near the bottom of the page outperforms any written testimonial for purchase confidence.

**CTA text:**
- "Get Started Free" for Tournament — zero friction
- "Start Free Trial" for all paid plans — sets expectation (trial, not commitment)
- Bottom-of-page secondary CTA: "Have questions? Talk to us." — provides an escape valve for orgs that need reassurance before signing up

---

## 13. BOTTOM CTA SECTION

**Primary CTA:**
> Start running your organization on FieldLogicHQ.

**Subtext:**
> Free plan available. Paid trials collect payment details up front and charge only after the trial. Cancel anytime.

**Button 1 (primary):**
> Get Started Free

**Button 2 (secondary):**
> Have questions? Talk to us.

**Supporting copy below buttons:**
> All plans are billed in CAD. No contracts. No setup fees.

---

## APPENDIX: PRICING QUICK REFERENCE

| | Tournament | Tournament Plus | League | Club |
|---|---|---|---|---|
| Monthly | Free | $39 | $89 | $179 |
| Annual | Free | $390 | $890 | $1,790 |
| Annual savings | — | $78 (~2 months) | $178 (~2 months) | $358 (~2 months) |
| Staff seats | 3 | Unlimited | Unlimited | Unlimited |
| Officials seats | Counted toward 3-seat limit | Unlimited | Unlimited | Unlimited |
| Non-archived tournament slots | 1 | Unlimited | Unlimited | Unlimited |
| Automated scheduling | — | ✓ | ✓ | ✓ |
| Bracket generator | — | ✓ | ✓ | ✓ |
| Communications | — | ✓ | ✓ | ✓ |
| Tournament archives | — | ✓ | ✓ | ✓ |
| Public organization page | — | — | ✓ | ✓ |
| House League module | — | — | ✓ | ✓ |
| Accounting module | — | — | — | ✓ |
| Rep Teams module | — | — | — | ✓ |
| Unlimited staff seats | — | ✓ | ✓ | ✓ |
| Free trial | — | 14 days | 30 days | 90 days |
