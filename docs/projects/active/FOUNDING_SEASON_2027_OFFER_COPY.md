# Founding Season 2027 — Offer Copy Canon

**Status:** ✅ **APPROVED 2026-09-07** (owner, on mockup sheet `61a78f09`: "looks good, go for it")
and **committed `2f02a949` on `dev` 2026-09-07** — every sentence below is live behind the signup-window gate, and
the dates in it are derived in code from `lib/plan-config.ts` (see `PRICING_PAGE_COPY.md`'s
2026-09-07 amendment). Copy appendix of `FOUNDING_SEASON_2027_PLAN.md`. Two deviations from the
draft, both flagged in §10: the coach consequence line ships in its FALLBACK form until the
read-only window is built, and the homepage callout note in §3 was corrected (see there).
**Owner decisions this copy is written against (ratified in conversation 2026-09-07, to be logged
by `/strategy`):** free period ends **September 30, 2027**; signup window closes **December 31,
2026**; **no second promotion** after the window; the end-of-season ask is a **2028 plan choice,
annual first**; coaches who do not continue keep a **read-only window** (ratified in principle,
length = the existing 90-day retention period, to be built before September 2027); the homepage
persona-card badge rule of 2026-08-07 **stands**.
**Facts:** prices and plan names from `docs/agents/strategy/PLAN_PRICING_FACTS.md` — Tournament Plus
$39/month · $390/year; Premium Coaches Portal $29/month · $290/year. This document restates them
only inside customer sentences.

---

## 1. The rules for this offer's words

1. **The headline is the promise, not the program.** "Your 2027 season, free." leads. "Founding
   Season" is the eyebrow / program label on the line above or the badge, never the headline.
   A prospect does not know what a Founding Season is; they know what a free season is.
2. **One precise sentence, verbatim, everywhere the offer is explained** (the "offer line"):
   > Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when
   > you sign up by December 31, 2026. No credit card.
   Where a surface speaks for one product only, drop the other product's name and keep every
   other word.
3. **Always name the price being waived,** as "normally $39/month" / "normally $29/month".
   (Standing execution rule from the original Founding Season plan: an organization that never
   saw the price churns when asked to pay it.)
4. **Always say what happens after,** in one line (the "after line"):
   > In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then,
   > and there is nothing to cancel.
   Product-specific consequence lines (what happens if you don't continue) live on the persona
   pages and the FAQ, never on the homepage — the two products end differently.
5. **Dates are written in full, one way:** "September 30, 2027", "December 31, 2026". No
   abbreviated months, no "Sept.", no "Jan 1". (One spelling everywhere a customer reads it.)
6. **Sport-neutral:** never "summer season", "summer", "ball season". "Your 2027 season" is the
   phrase; the precise date carries the meaning for every sport's calendar.
7. **Never:** "trial", "free trial", "limited time", "hurry", "don't miss out", "act now",
   "unlock", exclamation marks. The deadline is stated as a fact, once per surface.
8. **"Sign up" is creating an account.** "Registration" stays reserved for players and teams
   entering something.
9. **Post-window state is written now,** so nothing is scrambled on January 1, 2027. Every offer
   surface renders only while the signup window is open; the pages beneath already carry the
   list-price copy.

---

## 2. Site-wide offer bar (NEW — every marketing page, demo pages included)

### Offer bar — desktop
**Current:** none — new element
**Proposed:** `Founding Season · Your 2027 season, free — sign up by December 31, 2026 · See the offer →`
**Why:** The one place a visitor who lands anywhere (demo, changelog, a public tournament page) sees the offer. Promise, deadline, one link. Links to `/pricing#founding-season`.

### Offer bar — phone
**Proposed:** `Your 2027 season, free — sign up by December 31 →`
**Why:** Same words, fewer of them; the year is on the page it opens.

---

## 3. Homepage

### Hero eyebrow row (the small "Founding Season · … free through Dec 31, 2026 · No credit card required" line above the headline)
**Current:** `Founding Season · Tournament Plus & Premium Coaches Portal free through Dec 31, 2026 · No credit card required`
**Proposed:** **Removed.** The bar above and the panel below replace it.
**Why:** A footnote-weight line above the headline is the whisper the owner objected to; it also names the date a third time on one screen once the panel exists.

### Hero headline + sub-headline
**Current:** `Less admin. More sport.` / `Purpose-built for the people running community sports organizations on evenings and weekends — from your first tournament to a full club program.`
**Proposed:** **Unchanged.** (Brand hero line — do not change without a documented brand decision.)

### Offer panel (NEW — directly under the sub-headline, above the persona cards)
**Current:** none — new element
**Proposed:**
- Eyebrow: `Founding Season`
- Headline: `Your 2027 season, free.`
- Body: `Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when you sign up by December 31, 2026. No credit card.`
- Two product lines (text, not buttons — the persona cards below are the doors):
  - `Tournament Plus — normally $39/month`
  - `Premium Coaches Portal — normally $29/month`
- After line: `In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.`
**Why:** The promise at headline weight, the precise sentence once, the prices being waived, and the honest "what happens after" — all before the visitor chooses a door. The panel carries the calendar so the persona cards do not have to.

### Persona cards (Tournament / Coaches Portal)
**Current:** badges `Free to start · no credit card`; bodies unchanged
**Proposed:** **Unchanged.** (2026-08-07 ruling: cards state availability and the absence of a payment barrier, never the promo calendar.)
**Why:** The panel above now carries the offer; the cards stay the routing, and the "then $X" trap on the Tournament card stays closed.

### Plans section — "Founding Season" callout box (the bordered box under "Plans built for how you operate.")
**Current:** a boxed callout: `Founding Season · Free through December 31, 2026` / `Tournament Plus ($39/month) and the Premium Coaches Portal ($29/month) are free for organizations and coaches that sign up before the end of 2026.` / `We're in our founding season — we want real tournaments and real teams on the platform, not demos. Sign up today and run your season at no cost through December 31.` / `Start free →`
**Proposed:** **Replaced** by one line under the section sub-heading: `Founding Season: Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when you sign up by December 31, 2026.`
**Why:** With the panel in the hero, a second box says the same thing three screens later in a different voice. One line keeps the plans section honest without a second pitch. *(Correction at build, 2026-09-07: the draft said the box's button sent coaches to the Basic door. The box in fact carried TWO links — "Start your organization →" to the chooser and "Start your coaches portal →" straight to the Premium door — so the box itself was not the mis-route. The chooser's coach card WAS the mis-route for anyone arriving at `/start` from any other "Start free", and that fix in §7 stands on its own.)*

---

## 4. `/for-tournament-organizers`

### Hero sub-headline
**Current:** `Register teams, build your schedule, run the bracket, and post live scores — all in one place. Free to start, no credit card required.`
**Proposed (while the window is open):** `Register teams, build your schedule, run the bracket, and post live scores — all in one place. Tournament Plus is free for your whole 2027 season when you sign up by December 31, 2026 — normally $39/month.`
**Post-window:** current copy returns.
**Why:** The page led with the permanent free plan, which reads as a trial to a stranger. Leading with the Plus season states the bigger thing first; the free plan is still on the plan card below.

### Hero trust row
**Current:** `Free plan — no time limit` · `No credit card required` · `Billed in CAD`
**Proposed (window open):** `Free through September 30, 2027` · `Normally $39/month` · `No credit card required`
**Post-window:** current row returns.
**Why:** The three facts a skeptical organizer checks before clicking: how long, what it's worth, what it costs me today.

### Primary button
**Current:** `Start free`
**Proposed:** **Unchanged.** The promise above makes it literal.

### Plan card — Tournament Plus note
**Current:** `Free through Dec 31, 2026 — Founding Season · $390/year from Jan 2027`
**Proposed:** `Founding Season · free through September 30, 2027 · normally $39/month or $390/year`
**Why:** Full-date canon; names both list prices; drops the "from Jan" clause, which now belongs to the after line.

### Plan card — Tournament (free) note
**Current:** `No credit card. No time limit.`
**Proposed:** **Unchanged.** This is where "no time limit" belongs — on the plan it is true of.

### Founding Season card (the boxed section below the plan grid)
**Current:** eyebrow `Running your first tournament this year?` / title `Tournament Plus is free for founding organizations through December 31, 2026.` / body `Auto-scheduling, brackets, communications, and archives — at no cost while we build our first season together. Normally $39/month. No credit card required.` / button `Start free — no credit card required`
**Proposed:**
- Eyebrow: `Running more than one event in 2027?`
- Title: `Tournament Plus is free for your whole 2027 season.`
- Body: `Auto-scheduling, brackets, communications, and archives for every event you run through September 30, 2027 — normally $39/month. Sign up by December 31, 2026. No credit card.`
- Consequence line: `In September 2027 you'll choose a plan for your 2028 season. If you don't continue, your organization moves to the free Tournament plan and keeps everything it built.`
- Button: `Start free`
**Why:** The eyebrow was aimed at first-timers, who are served by the free plan; Tournament Plus is for organizations running two or more events. The consequence line is true for this product (downgrade to the free floor, data kept) and is the sentence that removes "what's the catch". Button wording matches the hero (one hand, not two — 2026-08-07).

### Bottom CTA sub-line
**Current:** (existing sub-line under "the closing headline")
**Proposed (window open):** `Tournament Plus is free through September 30, 2027 when you sign up by December 31, 2026 — normally $39/month. No credit card.`
**Why:** The last thing read before the last button repeats the offer line, single-product form.

---

## 5. `/for-coaches`

### Hero sub-headline
**Current:** `Every coach on FieldLogicHQ starts with the free Coaches Portal — a companion for the tournaments you enter. The Premium Coaches Portal turns it into your team's operations HQ: roster, lineups, budget, schedule, and documents for the whole season. No org account needed, and your workspace carries over if your organization joins later.`
**Proposed (window open):** `The Premium Coaches Portal is your team's operations HQ — roster, lineups, budget, schedule, and documents for the whole season. It's free for your whole 2027 season when you sign up by December 31, 2026 — normally $29/month. No organization account needed, and your workspace carries over if your organization joins later.`
**Post-window:** current copy returns.
**Why:** The current hero makes a coach sort out two tiers before reaching the offer. While the window is open the page sells one thing. The free Basic companion moves to the plan grid (below), where the two-family framing already lives.

### Hero note (under the buttons)
**Current:** `Free until Jan 1, 2027 — then $29/month. No credit card required to start.`
**Proposed:** `Free through September 30, 2027 — normally $29/month. No credit card required.`
**Why:** Full-date canon; "normally" instead of "then" — the after line owns what happens next.

### Hero trust row
**Current:** `Free until Jan 1, 2027` · `then $29/month` · `No org account needed`
**Proposed:** `Free through September 30, 2027` · `Normally $29/month` · `No org account needed`

### Plan card — Premium Coaches Portal
**Current:** `Free` / `until Jan 1, 2027` / `then $29/month · no credit card required · Standalone, no org required`
**Proposed:** `Free` / `through September 30, 2027` / `Normally $29/month or $290/year · no credit card · standalone, no org required`

### Plan card — Basic Coaches Portal (the free companion)
**Current:** (existing card copy)
**Proposed:** add one line: `Free with no end date — a companion for the tournaments you enter.`
**Why:** The honest reassurance that free coaching with us does not end in September 2027 — the point the 2026-08-07 ruling made about overstating the cost of coaching with us — moved from the hero to the card it is true of.

### Consequence line (in the plan grid or the bottom CTA, once per page)
**Proposed:** `In September 2027 you'll choose a plan for your 2028 season. If you don't continue, your Premium portal closes and your season stays readable for 90 days.`
**Why:** True only once the read-only window is built (ratified in principle 2026-09-07). ⚠ **Do not publish this sentence before that window exists.** Until then the line is: `In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then.`

### Bottom CTA sub-line
**Current:** `Start your Premium Coaches Portal free — $0 until January 1, 2027, then $29/month. No credit card required.`
**Proposed:** `Start your Premium Coaches Portal free — free through September 30, 2027 when you sign up by December 31, 2026, normally $29/month. No credit card.`

---

## 6. `/pricing`

### Offer strip (NEW — above the plan cards, anchored `#founding-season`)
**Current:** none — the offer is a badge on two cards and a footnote under the grid
**Proposed:** eyebrow `Founding Season` / headline `Your 2027 season, free.` / line: the offer line verbatim / after line verbatim.
**Why:** This is where the site-wide bar lands; the page must answer in the same words at the top, not in a footnote.

### Plan card badge (Tournament Plus + Premium Coaches Portal)
**Current:** `⬡ Founding Season — Free until Jan 1, 2027` / `Normally $39/month`
**Proposed:** price block shows `$0` with `through September 30, 2027` beneath and `normally $39/month · $390/year` as the note; badge reduces to `Founding Season`.
**Why:** The price block is where the eye goes on a pricing card; the offer belongs in it, not in a badge above the tagline. Layout is `/design`'s.

### Footnote under the grid
**Current:** `Tournament Plus and the Premium Coaches Portal are free through December 31, 2026 for founding organizations and coaches. Starting January 2027, the standard rates ($39/month and $29/month) apply. No contract. Cancel anytime.`
**Proposed:** the after line: `In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.`

### Comparison table — "Founding Season offer" row
**Current:** `Free through Dec 31, 2026`
**Proposed:** `Free through September 30, 2027 · sign up by December 31, 2026`

### FAQ — "What happens after the Founding Season offer ends?"
**Current:** `Tournament Plus is free through December 31, 2026 for organizations that sign up during the founding season — no credit card required. Starting January 2027, the standard rate of $39/month applies. We'll send a reminder before then.`
**Proposed:** `Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 for everyone who signs up by December 31, 2026 — no credit card. We'll remind you during the summer, and in September 2027 you'll choose a plan for your 2028 season: monthly or annual, at the standard rates ($39/month or $390/year for Tournament Plus; $29/month or $290/year for the Premium Coaches Portal). If you don't continue, an organization moves to the free Tournament plan and keeps everything it built.` *(Add the coach sentence from §5 once the read-only window exists.)*

### FAQ — "Do I need a credit card to get started?"
**Current:** `No. Tournament is free — no credit card, no time limit. During the Founding Season (through December 31, 2026), Tournament Plus is also free with no payment details required. Starting January 2027, paid plans use secure Stripe Checkout.`
**Proposed:** `No. Tournament is free — no credit card, no time limit. Sign up by December 31, 2026 and Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 with no payment details either. When you choose a plan for 2028, payment is by card through Stripe.`

### FAQ — post-window replacement (written now, shown from January 1, 2027)
**Proposed:** Q: `Can I still get the Founding Season offer?` A: `The Founding Season closed on December 31, 2026. Tournament is free with no time limit, and Tournament Plus is $39/month or $390/year. The Basic Coaches Portal is free with no time limit, and the Premium Coaches Portal is $29/month or $290/year. No contract; cancel anytime.`
**Why:** Written before the deadline so the page never asserts an expired date and never hedges about a second offer (there is none).

---

## 7. `/start` (the get-started chooser)

### "Run a tournament" card
**Current:** tag `Free` / `Create a tournament free — registration, schedule, brackets, and a public site. No credit card.`
**Proposed (window open):** tag `2027 season free` / `Create a tournament free — registration, schedule, brackets, and a public site. Tournament Plus is free through September 30, 2027. No credit card.`

### "Coach a team" card
**Current:** tag `Free` / `A free team home for your season — no organization needed. Track your registrations and team.` — and the card opens the **free Basic** team setup.
**Proposed (window open):** tag `2027 season free` / `Your team's operations HQ — roster, lineups, budget, schedule, and documents. Free through September 30, 2027, no organization needed.` — and the card opens the **Premium Coaches Portal** door.
**Post-window:** current card and door return.
**Why:** The homepage's own offer button sends coaches here, and the card it lands on today does not give the advertised product. ⚠ Flow decision for `/ux` and the build plan: where the Basic companion door lives while the window is open (recommended: a quiet line beneath the cards, `Just entering tournaments? The Basic Coaches Portal is free with no end date →`).

---

## 8. Signup and welcome surfaces (the "signup pages throughout the app")

### Premium Coaches Portal signup page — Founding Season pill
**Current:** `⬡ Founding Season` beside the price
**Proposed:** `Founding Season · free through September 30, 2027 · normally $29/month`

### Coach welcome screen (after signup)
**Current:** `⬡ Founding Season · free until Jan 1, 2027`
**Proposed:** `Founding Season · free through September 30, 2027 · in September you'll choose a plan for 2028`

### Organization onboarding — plan step
**Current:** `Welcome to your founding season. Tournament Plus is free through December 31, 2026. No credit card required. You'll receive a reminder before the standard $39/month rate applies in January 2027.`
**Proposed:** `Welcome to your Founding Season. Tournament Plus is free through September 30, 2027 — normally $39/month. No credit card. We'll remind you during the summer, and in September 2027 you'll choose a plan for your 2028 season.`

### Organization billing page — Founding Season banner and card-saved note
**Current:** `Nothing will be charged before January 1, 2027 — your founding season stays free through December 31, 2026` (and the "Add payment method" ask from October 1, 2026)
**Proposed:** `Nothing will be charged before October 1, 2027 — your Founding Season stays free through September 30, 2027.` The "Add payment method" ask moves to the summer of 2027 (dates set by the plan).
**Why:** ⚠ Time-critical: the current banner starts asking for a card on October 1, 2026 with copy that will be wrong the day the date moves.

### Welcome emails (organization + coach) and the ten campaign emails
**Proposed:** rewritten in a separate `/marketing` pass against the summer-2027 calendar (open the card window in June, nudge in August, final notice mid-September, plan choice by September 30). The Club and League spotlight emails are retired while those products are parked. Not part of the pages work.

---

## 9. Post-window state (from January 1, 2027) — what every surface shows

- Offer bar, homepage panel, pricing strip, plans-section line: **gone**.
- Persona-page heroes and trust rows: **current list-price copy returns** (already written and live behind the promo toggle).
- Plan cards: list price, no badge.
- `/start` cards: `Free` tags and current bodies return; the coach card opens the Basic door again.
- FAQ: the replacement question in §6.
- ⚠ Everything above keys off the **signup window** (closes December 31, 2026), not the free-period end (September 30, 2027). The two dates are separate for the first time; the build must not tie the offer surfaces to the wrong one.

---

## 10. Flags raised in this pass (for `/design`, `/ux`, `/strategy`, the plan)

1. **Chooser routing** (§7): the coach card must open the Premium door while the window is open, and the Basic door needs a home.
2. **Coach consequence line** (§5) is contingent on the read-only window being built; the fallback line is written.
3. **Billing-page card ask** (§8) is live on October 1, 2026 — the date must move before then.
4. **Timezone of "by December 31, 2026"**: the plan must fix the instant (recommended: end of day Eastern) — the copy never says a time.
5. **"Founding Season" as a program label** survives the extension: the 2026 cohort of three accounts is simply extended to the same date, so there is one Founding Season, not two.
6. **Sport neutrality**: no "summer" anywhere; "your 2027 season" + the full date.
