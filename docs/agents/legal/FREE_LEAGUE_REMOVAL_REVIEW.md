# Free League removal, Stage 1 — what the published words and the start doors promise now
**Last verified:** 2026-11-19 (code read at commit `859a2d0b5`: `app/api/org/create/route.ts:66`, `app/api/billing/create-checkout/route.ts:102`, `app/[orgSlug]/admin/onboarding/PaidPlanStep.tsx:105`, `app/(consumer)/start/league/page.tsx`, `components/PricingSection.tsx` League card; the deleted route read at `d5784ba47`; Terms 2026-11-17 and the held Terms 0.2 draft searched for free-League wording)
**Re-verify by:** the League Plus gate opening on production; the first Québec account; any edit to `planTrialLine`, `PLAN_LINE_WORDS` or the League card's note; the next Terms version
**Depends on facts:** `ON_SALE_PAGES_S2_REVIEW.md` (the League Plus start door was approved there); Terms 2026-11-17 §1, §7, §8, §17; `LEGAL_FACTS.md` (Canada only; nothing sold yet)

## Question(s) this answers
Does retiring the free League (house league sold only on League Plus, Club and Club · Association; the free sign-up and its create route deleted; the League Plus card now says the trial sentence and "Start your League Plus trial") leave any published document, page or acceptance step promising something the product no longer does, or lacking something the old path carried?

## Finding
**No MUST-FIX. Nothing to apply in this change's files.** Four points, in order of weight.
1. **The published Terms and Privacy Policy never described a free League.** The Terms say only "Some plans are free. A free plan has the limits shown on the pricing page" (§ plans), which stays true (Tournament and the free Coaches Portal remain free). No document under `lib/legal-documents/`, no draft under `drafts/`, and no other file in `docs/agents/legal/` names a free League, a League Starter or `free_floor`. The help articles and pricing/brand records were already cleaned in the build; the code census at `859a2d0b5` finds none on a customer-facing surface.
2. **The acceptance step is not lost.** The deleted free route called `requireAcceptance` (`d5784ba47: app/api/league/create/route.ts:81`); the League Plus door goes through `/api/org/create` (`:66`) and `/api/billing/create-checkout` (`:102`), both of which call it first, and the Stage 1 test edits removed only the deleted route's entries from the gate lists (`legal-acceptance-gates.test.ts`). The plan step carries the organization-authority sentence the S2 review asked for ("You're starting this plan for {name}, and you confirm you're allowed to agree to the Terms on its behalf", `PaidPlanStep.tsx:105`) and `PlanTermsLine`.
3. **The League Plus card now matches checkout.** The old card said "No credit card required" and "Start free" next to a button that leads to a paid plan step: the exact defect the one trial sentence was written to end (canon, 2026-09-25; Ask 7, 2026-11-18). It now carries the ruled sentence with League Plus's length (30 days) and "Start your League Plus trial". Consumer-protection reading (Terms §7, §8): trial length, the first charge "plus applicable taxes", and the payment method taken at checkout are all said before purchase. **Two small notes, no action required:** (a) the card quotes the code value of the trial length, not the server value a platform admin can override (the S2 review's condition (a) asks for the server value on the plan step, which the step does; the card has the same exposure as the Club card); (b) a signed-in organization that already pays and moves up to League Plus is shown the trial line on the card but gets no second trial (the sentence's own doc comment says to show it only where a trial applies) — checkout's preview shows what applies, so nobody is charged on the card's words.
4. **People who came in under the old free offer.** Production never showed it: `LEAGUE_STARTER_BETA` was off there and the free League floor held 0 organizations (counts only, 2026-11-19), so no customer on production was offered "Free — one season…" at sign-up. The dev fixture is not a customer. An account that picked the League door anyway sees the paid plan step when League Plus opens; its Home card ("Your league") names no price, but nothing is charged before the plan step shows the price, cycle and trial and the buyer presses the button. A wording gap, not a legal one.

Privacy and CASL: nothing collected, sent or promised changes except less is recorded (the seven free-League analytics event types are gone; no rows existed). No email was added or changed; the "League Plus opens" interest email stays a CEM governed by `ON_SALE_PAGES_S1_REVIEW.md`.

## What the product does today
As above, read at `859a2d0b5`. Not checked: production's hosted environment variables (whether `LEAGUE_STARTER_BETA` was ever set there is the owner's to confirm when removing it).

## Recommendation
- Nothing to change in the Terms, Privacy Policy, data terms or subprocessor list for this change.
- **Owner questions (copy, not law):** (1) one line on Home's waiting "Your league" card saying League Plus is a paid plan and the price is shown before anything is charged — `/marketing`'s wording, a `/plan` small item; (2) whether the League card's note should read the server's trial length — only worth doing with the same fix for the Club card.
- **Release step (owner):** remove `LEAGUE_STARTER_BETA` from any hosted environment; confirm in the same step it was never on in production.

## Sources
- Terms of Service 2026-11-17 (`lib/legal-documents/terms/2026-11-17.md`) — read 2026-11-19
- `ON_SALE_PAGES_S2_REVIEW.md`, `ON_SALE_PAGES_S1_REVIEW.md` — this folder

## Lawyer's eye needed?
No new item. The S2 review's open points (whether a personal account's tick binds the organization; the Québec French-language rules for standard-form contracts) are unchanged and still the owner's to take to a lawyer when they choose.
