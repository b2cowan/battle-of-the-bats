# Founding Season — Go-to-Market Plan

**Status:** Planning  
**Target:** Tournament portal launch — 2026 founding cohort  
**Offer window:** Now through December 31, 2026  
**PM Brief:** See [FOUNDING_SEASON_PM_BRIEF.md](FOUNDING_SEASON_PM_BRIEF.md)

---

## Context

FieldLogicHQ is going to market with the tournament portal first. Tournament and Tournament Plus are the two live tiers. The strategy for the first operating year is to acquire a founding cohort of real organizations running real tournaments — generating platform validation, social proof, and a paying customer base by January 2027.

The offer: **Tournament Plus ($39/month) is free through December 31, 2026 for organizations that sign up during the founding season.**

The framing: not a trial, not a promotion. A **Founding Season** — orgs are participants in building the platform, waiving fees in exchange for real usage, feedback, and referrals.

---

## The Offer

| What | Detail |
|---|---|
| **Who** | Any org that signs up through December 31, 2026 |
| **What they get** | Tournament Plus features at no cost |
| **What they're waiving** | $39/month (state this clearly everywhere) |
| **When it ends** | December 31, 2026 |
| **What happens January 1** | Convert to $39/mo paid or fall back to Tournament (free) |
| **No credit card required** | Not until October — first payment ask is October 1 in-app, November 1 email |

### Key execution rules
1. **Always name the $39/mo price.** Every touchpoint — homepage callout, welcome email, in-app banner — must state the value being waived. Orgs that don't know the price will churn when asked to pay it.
2. **"Founding Season" is the frame, not "free trial."** This positions orgs as participants, not testers.
3. **Build conversion expectation from day one.** The January 2027 ask should feel like a natural renewal — not a surprise charge.
4. **Qualify at onboarding.** A single "How many tournaments does your organization run per year?" question in the post-signup onboarding flow segments high-value orgs (3+) from explorers — used to prioritize outreach, not to gate access.

---

## Target Segment

Primary: Tournament organizers running **2+ events per year** — the core Tournament Plus buyer.  
Secondary: First-time tournament organizers willing to run a real event on the platform.  
Not targeted: Orgs that sign up and never run a tournament (watch for this in metrics).

---

## Phase 1 — Marketing Assets

### 1A. Homepage callout (`app/page.tsx`)

Add a "Founding Season" callout banner between the hero and the persona grid — or as a persistent eyebrow label above the hero headline.

**Proposed callout copy:**
```
FOUNDING SEASON · FREE THROUGH DECEMBER 31, 2026

Tournament Plus ($39/month) is free for organizations that sign up before the end of 2026.
We're in our founding season — we want real tournaments on the platform, not demos.

[Start your organization →]
```

**Placement options:**
- Option A: Full-width banner immediately above the hero section (high visibility, easy to dismiss)
- Option B: Eyebrow label in the hero itself, just above "Less admin. More sport." (lower friction, always visible)
- Option C: A dedicated callout card inside the pricing section, adjacent to the Tournament Plus plan card (catches pricing intent)

Recommended: **Option C** (pricing section) plus a smaller echo in the hero eyebrow row.

### 1B. Pricing page (`app/pricing/page.tsx` + `docs/projects/archive/PRICING_PAGE_COPY.md`)

On the Tournament Plus plan card, add a "Founding Season" badge:

```
TOURNAMENT PLUS
————————————————
⬡ FOUNDING SEASON — FREE THROUGH DEC 31, 2026
  Normally $39/month

[Start free — no credit card required]
```

Below the plan cards, add a founding season note:
```
Tournament Plus is free through December 31, 2026 for founding organizations.
Starting January 2027, the standard $39/month rate applies.
No contract. Cancel anytime.
```

### 1C. Tournament organizer persona page (`/for-tournament-organizers`)

Add a founding season section near the pricing CTA:

```
RUNNING YOUR FIRST TOURNAMENT THIS YEAR?

Tournament Plus is free for founding organizations through December 31, 2026 — 
auto-scheduling, brackets, communications, and archives, at no cost while we build 
our first season together.

[Start free — no credit card required]
```

### 1D. Qualifying question — post-signup onboarding flow

After signup, the onboarding checklist (or org setup wizard step 1) should ask:

```
How many tournaments does your organization run per year?

○ 1 — just getting started
○ 2–3 — a few each season
○ 4 or more — running a full tournament program
```

This field is stored on the org record. Platform admin uses it to filter and prioritize November outreach. It does not gate any features — it's purely segmentation data.

**Implementation note:** Add a `tournaments_per_year` column (or use the existing `settings` JSONB on `organizations`) and display this question as a non-blocking step in the onboarding checklist. Pre-populate based on their answer if they came through a persona page ("I'm a tournament organizer" vs. "I run a club").

---

## Phase 2 — In-App Messaging

### 2A. Billing page founding season banner

Two states depending on time of year:

**Before October 1 (no payment ask yet):**
```
FOUNDING SEASON ACTIVE

You're running Tournament Plus free through December 31, 2026 as a founding organization.
Tournament Plus is normally $39/month — your plan renews on January 1, 2027.
No credit card required until then.

[Learn about your plan →]
```

**October 1 – December 31 (soft payment CTA):**
```
FOUNDING SEASON ACTIVE · ENDS DECEMBER 31

Your founding season includes Tournament Plus free through December 31, 2026.
Add a payment method now to continue without interruption on January 1.

[Add payment method — takes 2 minutes →]   [See plan details →]
```

**Implementation note:** Use the existing `org_overrides` comp_period infrastructure to flag founding season orgs (`comp_until = 2027-01-01`). The billing page already has conditional rendering for plan status — add a `isFoundingSeason` check alongside the existing `isTrialing` check. The October 1 switch can be a date comparison against `comp_until` vs. `new Date()` — no additional data needed.

### 2B. Signup confirmation page / welcome state

On the post-signup landing (onboarding checklist or dashboard), add a single founding season acknowledgment:

```
Welcome to your founding season.

Tournament Plus is free through December 31, 2026. You'll receive a reminder before 
the standard $39/month rate applies in January 2027.

→ [Set up your first tournament]
```

---

## Phase 3 — Email Sequence

All four emails should be written and loaded into the Resend template stack before the founding season offer launches. The sequence runs automatically based on org `created_at` date.

### Email 1 — Welcome (send immediately at signup)

**Subject:** Your founding season starts now — Tournament Plus is free through Dec 31

**Body framework:**
```
Hi [name],

You're in. [org_name] is set up on FieldLogicHQ and running Tournament Plus free 
through December 31, 2026 as a founding organization.

Tournament Plus ($39/month) gives you:
— Auto-scheduling across any number of fields and time slots
— Single and double-elimination brackets
— Team communications and announcements
— Tournament archives — every past event preserved
— Up to 3 active tournaments at once

All of it, free until January 1, 2027. No credit card required.

To get your first tournament running:
→ [Set up your tournament]

If anything doesn't work the way you'd expect, reply to this email. We read everything.

— The FieldLogicHQ team
```

**Copy notes:**
- Name the $39/mo value immediately — in the subject line and first paragraph
- List the features concisely — this is the only email where a feature list is appropriate (first contact, sets expectations)
- The "reply to this email" line is intentional — founding orgs are a feedback pipeline, not just customers

### Email 2 — Activity check-in (send ~60 days post-signup, or after first tournament)

**Subject:** How's your season going? [org_name] update

**Body framework:**
```
Hi [name],

It's been [X weeks] since [org_name] joined FieldLogicHQ.

[IF has run a tournament:]
You've run [N] tournament(s) — [X] teams registered, [Y] games played.
That's [Z] schedule exports and score entries you didn't have to do in a spreadsheet.

[IF no tournament yet:]
You haven't run your first tournament yet — which means you still have 
[N weeks] of free Tournament Plus before January 1.

If you've got an upcoming event, now's the time to set it up:
→ [Set up a tournament]

We're also curious: what's working, and what isn't? Reply and tell us.

Your founding season runs through December 31, 2026. 
Starting January 1, Tournament Plus is $39/month — or you can continue free 
on the Tournament plan (1 active tournament, manual scheduling).

— The FieldLogicHQ team
```

**Copy notes:**
- Personalize based on actual tournament activity (API call to get tournament/game counts)
- Plant the January 2027 conversion without making it the point of the email
- The feedback ask builds the org relationship

### Email 3 — Renewal nudge (send November 1, 2026 to all founding season orgs)

**Subject:** Your founding season ends December 31 — here's what happens next

**Body framework:**
```
Hi [name],

Your FieldLogicHQ founding season ends December 31, 2026.

Starting January 1, Tournament Plus is $39/month. Here's what that means for [org_name]:

[IF has active tournaments:]
Your [N] active tournament(s), all registered teams, scores, and archives carry over 
automatically — nothing changes except the billing.

[IF has tournament history:]
Your [N] past tournament(s) stay in your archives regardless of which plan you're on.

To continue on Tournament Plus starting January 1:
→ [Add a payment method — takes 2 minutes]

If $39/month isn't right for [org_name], you can also continue free on the Tournament plan:
1 active tournament, manual scheduling, no cost.
→ [See plan comparison]

Questions? Reply to this email.

— The FieldLogicHQ team
```

**Copy notes:**
- This is the most important email in the sequence
- Lead with what happens (plan conversion), not a pressure sell
- Explicitly mention what they keep regardless of plan (archives, history) — removes the "will I lose my data?" anxiety
- Offer the free alternative without shame — the goal is trust, not extraction

### Email 4 — Final reminder (send December 15, 2026)

**Subject:** 2 weeks left in your founding season — [org_name]

**Body framework:**
```
Hi [name],

Quick reminder: your founding season ends in 16 days, on December 31.

[IF has NOT added payment:]
If you'd like to continue with Tournament Plus starting January 1 ($39/month), 
add a payment method now:
→ [Add payment method]

[IF HAS added payment:]
You're all set — Tournament Plus continues at $39/month starting January 1.
Nothing else to do.

Either way, everything you've built on FieldLogicHQ stays with you.

— The FieldLogicHQ team
```

**Copy notes:**
- Short. Purely functional. One CTA.
- The "everything stays with you" line is essential — reduces anxiety about transitioning

---

## Payment Method Collection Timeline

No credit card is ever required during the founding season. The collection sequence is:

| Date | Touch | Medium |
|---|---|---|
| Signup → September 30 | "Free through Dec 31" only — no payment ask | In-app banner |
| October 1 | Billing page banner switches to soft "Add payment method" CTA | In-app |
| November 1 | Renewal nudge email — primary CTA is "Add payment method" | Email |
| December 15 | Final reminder — conditional on whether card has been added | Email |
| January 1 | Charge card (Stripe) or downgrade to Tournament free | Automated / platform admin |

**Stripe flow:** The "Add payment method" link should open a Stripe Setup Intent session (not a checkout) — this saves a card on file without charging it. The January 1 charge is then a subscription activation against the saved payment method. This is the cleanest UX: one card-entry moment, no surprise charges.

**If Stripe Phase G is not live by October 1:** Defer the in-app payment CTA. The November email still goes out but with "we'll reach out to set up billing before January 1" instead of a direct payment link.

---

## Phase 5 — Feature Spotlight Email Series

**Goal:** Position FieldLogicHQ as a full platform — not just a tournament tool. The founding cohort includes tournament organizers who also run leagues and clubs, and coaches who need a team workspace. This series introduces each module with outcome-focused copy, drives early access interest for League and Club, and seeds Coaches Portal signups.

**Cadence:** Calendar-driven, not triggered per-signup. Sent to all founding season participants at fixed dates — everyone on the list at that date receives that email, regardless of when they joined.

**Audience segmentation:**
- Org owners: receive all five spotlights
- Coaches with tournament accounts (registered through the coach portal): receive Email 5C (Coaches Portal) and Email 5E (The Full Picture)

### Email calendar

| Email | Send Date | Topic | Audience |
|---|---|---|---|
| 5A — Club founding promotion | **August 1** | Club free through Dec 31 — sign up before your September season | Org owners |
| 5B — House League spotlight | September 1 | House League module preview + early access | Org owners |
| 5C — Coaches Portal spotlight | October 1 | Coaches Portal — for your coaches and standalone coaches | Org owners + coaches |
| 5D — Club last chance | October 15 | Final Club offer reminder before year-end | Org owners who haven't signed up for Club |
| 5E — The full picture | November 15 | Platform roadmap + referral ask + payment CTA | All founding season participants |

**Rationale for the August Club promotion:** Most Canadian club sports (hockey, soccer, baseball) plan their fall season in August — tryouts, rep team rosters, house league registrations, and budget prep happen before September. An org that starts its season on existing tools in September is effectively locked in for the year. The August window is the last viable acquisition moment for fall-starting clubs.

---

### Email 5A — Club Founding Promotion (send August 1, 2026)

**Audience:** Org owners  
**Subject:** Before your September season starts — Club is free through December 31

**Body framework:**
```
Hi [name],

Most clubs are planning their September season right now.
Tryouts. Rep team rosters. League registrations. Budget prep.

If you're managing all of that across multiple tools — this is worth 15 minutes.

Club on FieldLogicHQ puts your entire organization in one place:

— Tournaments: same tools you're already using on your founding season
— House League: registration, draft, schedule, standings, parent notifications —
   no manual emails
— Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own 
   programs; your executive team gets the visibility
— Accounting: org ledger, team invoicing, budget vs. actual

Your executive team sees everything. Your coaches run their own teams.
Nobody is sending weekly update emails.

Club is normally $179/month, unlimited staff seats.
As a founding organization, Club is free through December 31, 2026.

If you're starting a September season, the time to set this up is now —
not after you're three months in on the same old process.

→ [Start on Club — free through December 31]

Questions about whether Club is right for [org_name]? Reply to this email.

— The FieldLogicHQ team
```

**Copy notes:**
- "Not after you're three months in on the same old process" is the most important line — habit lock-in is the real competitor, not other software
- Open with the September season start — creates immediate relevance before any feature mention
- Name the $179/mo value explicitly, then show the founding season waiver
- The reply CTA invites a direct conversation — Club orgs are worth that

**Dependency — Club availability:** Two paths depending on Stripe Phase G timing:
- **If Stripe Phase G is live by August 1:** Self-serve Club checkout available. CTA goes to `/auth/signup?plan=club` or `/pricing`.
- **If Stripe Phase G is not live:** CTA goes to a short "Get set up on Club" form (name, org, email). Platform admin manually provisions on Club comp period within 24 hours. This adds operational overhead but does not block the promotion.

---

### Email 5B — House League Spotlight (send September 1, 2026)

**Audience:** Org owners  
**Subject:** What running a house league actually looks like on FieldLogicHQ

**Body framework:**
```
Hi [name],

You're running tournaments. But if [org_name] also runs a house league season — 
or if that's where you're headed — here's what that looks like.

From opening registration to final standings:

— Parents register players online. You set division limits; waitlists fill automatically.
— Draft day uses a live board — pick order, team builds, no spreadsheet.
— The schedule generates itself. Parents get automated game notifications 
   without you sending a single email.
— Standings update the moment scores are entered.

No parallel spreadsheets. No manual notifications. One dashboard.

Available on the League plan ($89/month) and Club plan ($179/month).
Both are free through December 31, 2026 for founding organizations.

If you're planning a league season:
→ [Get set up on League — free through December 31]

— The FieldLogicHQ team
```

**Copy notes:** Outcome-first structure. "From first registration to final standings" pattern from brand voice. Now includes a founding season CTA for League — the September timing is pre-season for many league orgs, so this email has genuine conversion potential.

---

### Email 5C — Coaches Portal Spotlight (send October 1, 2026)

**Audience:** Org owners + coaches with tournament accounts  
**Subject:** For the coaches on your teams — a workspace that's actually theirs

**Body framework (org owner version):**
```
Hi [name],

The coaches managing teams in your tournaments are tracking rosters in group texts, 
lineups in notes apps, and team fees in someone's head.

The Coaches Portal gives them one place for all of it:

— Full roster management with season history
— Lineup builder — plan your starting lineup, export to PDF
— Team budget and player dues tracking
— Document management: consent forms, medical notes, eligibility files

It works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ.
A coach can sign up independently, on their own billing, and manage their team year-round.

Standalone at $29/month, or included in League and Club plans.

Know a coach who needs this? 
→ [Send them this link]

Or express your own interest:
→ [I'm interested in the Coaches Portal]

— The FieldLogicHQ team
```

**Body framework (coach version — for coaches with tournament accounts):**
```
Hi [name],

You've been through a tournament on FieldLogicHQ. But managing your team 
between tournaments is still probably spread across your phone, email, and memory.

The Coaches Portal is built for exactly that:

— Your full roster, season over season
— Lineups you can plan, save, and export to PDF
— Team budget: dues in, expenses out, who owes what
— Documents in one place — consent, medical, eligibility

No organization account required. Your team workspace, on your timeline.
Standalone at $29/month.

Express your interest — we'll reach out directly:
→ [I want the Coaches Portal]

— The FieldLogicHQ team
```

**Copy notes:** Two versions — org owner (framed as "a tool for your coaches," includes a forward CTA as a lightweight referral loop) and coach (direct, first-person). The forward link in the org owner version is shareable without any referral tracking overhead.

---

### Email 5D — Club Last Chance (send October 15, 2026)

**Audience:** Org owners who have NOT converted to Club after Email 5A  
**Subject:** Last reminder — Club is still free through December 31

**Body framework:**
```
Hi [name],

A quick follow-up to our August note about Club.

If [org_name] is running a house league, rep teams, or both alongside your tournaments —
Club is free through December 31, 2026 as part of your founding season.

After the new year, it's $179/month. Starting now, it costs nothing.

The longer you wait to set it up, the deeper into the season you go 
on separate systems.

→ [Start on Club — free through December 31]

— The FieldLogicHQ team
```

**Copy notes:**
- Short. One CTA. No feature list — that was Email 5A.
- "The longer you wait to set it up, the deeper into the season you go on separate systems" is the urgency line. Factual, not pushy.
- Only send to orgs that have NOT already signed up for Club — suppress for converted orgs.

---

### Email 5E — The Full Picture (send November 15, 2026)

**Audience:** All founding season participants (org owners + coaches)  
**Subject:** Where FieldLogicHQ is headed — a note from the founding season

**Body framework:**
```
Hi [name],

You're one of the first organizations running on FieldLogicHQ. Here's a brief update 
on where things are headed.

WHAT'S LIVE TODAY
— Tournament and Tournament Plus: free for your founding season through December 31
— House League, Rep Teams, and Accounting: available on League and Club (also free 
   through December 31 for founding organizations)
— Tournament Coach Portal for coaches tracking their teams

WHAT'S COMING IN 2027
— Coaches Portal standalone — a full season workspace for one team ($29/month)
— Expanded public org site tools
— And more, based on what this first season has taught us

You've helped us build this — by running real events on the platform and telling us 
what worked and what didn't.

If you know another tournament organizer, league admin, or coach who should be here:
→ [Share FieldLogicHQ]

And if you haven't added a payment method yet:
→ [Continue after December 31 — takes 2 minutes]

See you in 2027.

— The FieldLogicHQ team
```

**Copy notes:** Two jobs — genuine thank-you with platform roadmap summary, and the second-to-last payment CTA before the December 15 hard reminder. Referral ask comes first.

---

## Phase 4 — Platform Admin Tracking

### 4A. Founding season org flag

Add `founding_season: boolean` (or use existing `org_overrides.comp_until` date) to track eligible orgs.

**Implementation options:**
- Option A: A `founding_season` boolean column on `organizations` (simple, queryable)
- Option B: Use existing `org_overrides` comp_period — set `comp_until = 2027-01-01` for all orgs that sign up during the window (no schema change needed)

Recommended: **Option B** (no migration required — existing comp_period infrastructure).

### 4B. Platform admin view — Founding Season filter

Add a "Founding Season" filter to the Organizations list:
- Filterable by: founding season orgs, tournament activity (0 / 1-2 / 3+), last login, payment method added Y/N
- Columns: org name, owner email, signed up date, tournaments run, last active, conversion status
- Export to CSV for November outreach

### 4C. January 2027 conversion flow

Before December 31, 2026, define the conversion action:
- Orgs that added a payment method: auto-charge $39/month on January 1 (Stripe Phase G must be live)
- Orgs that did not: downgrade to Tournament (free) on January 1 — platform admin bulk action
- Platform admin sends a manual "converted" or "downgraded" status update to the audit log

**Dependency:** Stripe Phase G (production cutover) must be complete before January 1, 2027 for billing conversion to work. If Stripe isn't live by November, the conversion flow is manual (platform admin adjusts plan + owner pays via Stripe separately).

---

## Copy Assets Checklist

### Marketing (public-facing)
| Asset | Location | Status |
|---|---|---|
| Homepage founding season callout (hero + pricing echo) | `app/page.tsx` | [ ] |
| Pricing page founding season badge + note | `app/pricing/page.tsx` | [ ] |
| Tournament organizer persona page section | `app/for-tournament-organizers/page.tsx` | [ ] |

### In-App
| Asset | Location | Status |
|---|---|---|
| Billing page banner — pre-October (no payment ask) | Billing page component | [ ] |
| Billing page banner — October onwards (payment CTA) | Billing page component | [ ] |
| Signup confirmation / onboarding founding season message | Onboarding checklist | [ ] |
| Qualifying question ("how many tournaments per year?") | Onboarding checklist | [ ] |

### Core Conversion Email Sequence
| Asset | Location | Status |
|---|---|---|
| Welcome email (Day 1) | Resend template | [ ] |
| Activity check-in email (~Day 60) | Resend template + cron trigger | [ ] |
| Renewal nudge email (November 1) | Resend template + cron trigger | [ ] |
| Final reminder email (December 15) | Resend template + cron trigger | [ ] |

### Feature Spotlight Email Series
| Asset | Audience | Send Date | Status |
|---|---|---|---|
| 5A — Club founding promotion | Org owners | August 1, 2026 | [ ] |
| 5B — House League spotlight | Org owners | September 1, 2026 | [ ] |
| 5C — Coaches Portal spotlight (org owner version) | Org owners | October 1, 2026 | [ ] |
| 5C — Coaches Portal spotlight (coach version) | Coach accounts | October 1, 2026 | [ ] |
| 5D — Club last chance | Org owners (not yet on Club) | October 15, 2026 | [ ] |
| 5E — The full picture | All founding season participants | November 15, 2026 | [ ] |

### Platform Admin & Documentation
| Asset | Location | Status |
|---|---|---|
| Founding season org filter + conversion tracking | Platform admin orgs page | [ ] |
| `docs/projects/active/PRICING_PAGE_COPY.md` | Updated with founding season copy | [ ] |

---

## Conversion Success Metrics

### Tournament conversion (January 2027)
| Metric | Target |
|---|---|
| Founding season signups by Dec 31 | 30–50 orgs |
| Orgs that run at least 1 tournament | ≥ 60% of signups |
| Orgs that run 3+ tournaments | ≥ 20% of signups |
| Tournament Plus → paid conversion rate | ≥ 35% of active orgs |
| MRR on February 1, 2027 | ≥ $500 (13+ paying orgs) |
| Churn in January 2027 | < 50% of founding cohort |

### Upsell pipeline (from spotlight series)
| Metric | Target |
|---|---|
| Early access leads from spotlight emails | ≥ 15 (League/Club/Coaches combined) |
| Coaches Portal interest signups | ≥ 20 coach accounts |
| Club early access pipeline | ≥ 5 qualified orgs |
| Founding orgs upgrading to League/Club by Feb 2027 | ≥ 3 |

---

## Resolved Decisions

1. **Existing orgs:** Product is not live yet — no existing orgs. Founding season offer applies only to new signups. Resolved.
2. **Qualifying question:** Confirmed. "How many tournaments does your organization run per year?" added to post-signup onboarding (non-blocking). See Phase 1D.
3. **Stripe Phase G timing:** Confirmed live well before December 31. Payment method collection begins October 1 (in-app soft CTA) and November 1 (email). See Payment Method Collection Timeline section.
4. **Referral incentive:** Not needed. The forward CTA in Email 5B (Coaches Portal spotlight) and the shareable link in Email 5D serve as lightweight referral mechanisms without formal incentive tracking.

---

## Remaining Open Decision

**Spotlight email send dates:** The August/September/October/November dates above assume an external launch in June/July 2026. If the launch date shifts, adjust the spotlight calendar proportionally — the Club promotion (5A) must stay in August regardless, as that is the pre-season planning window for fall clubs. The remaining 4 emails can compress if needed, but 5A is the one with a hard seasonal deadline.

**Club self-serve availability:** If Stripe Phase G is not live by August 1, the Club promotion uses a manual provisioning path (contact form → platform admin comp period). This must be decided and the fallback path built before the August 1 send date.
