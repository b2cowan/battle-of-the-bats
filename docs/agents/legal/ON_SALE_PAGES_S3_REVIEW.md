# On-sale pages S3 review (as built, uncommitted on dev)
**Last verified:** 2026-11-20
**Re-verify by:** the promote that carries S3; any edit to `HowTheTrialWorks.tsx`, the `trial_ending` email, `PLAN_AVAILABILITY_WHO`, the plan-move options; first Québec account
**Depends on facts:** Terms 2026-11-17 §7, §8, Québec paragraph; `ON_SALE_PAGES_S1_REVIEW.md`, `ON_SALE_PAGES_S2_REVIEW.md`; `CLUB_ON_SALE_COPY.md` W58-W63, W68, W75

## Verdict
No condition on the Ask 27 words is broken. **One must-fix (a promise the product cannot keep for League Plus), three should-fixes, four lawyer's-eye notes.** Read from the code as built; moves read at `lib/plan-move-options.ts:7-12`, `lib/plan-move.ts:27-38, 179-224`, `lib/plan-billing-profile.ts:233-237`.

## 1. "How the trial works" (`components/marketing/HowTheTrialWorks.tsx`)
- My two additions are in: "The trial is for your {club's|league's} first paid plan." (step 1) and "…and the plan renews until you cancel." (step 4). Both match Terms §7 (first paid plan only; charged on that date unless you cancel) and §8 (automatic renewal until cancelled). No Terms conflict. The section shows by plan gate, not by viewer, so a returning customer sees "first paid plan" and no trial at checkout: adequate disclosure.
- **Step 3 is accurate.** The handler (`lib/billing-webhook-handler.ts:885-915`) emails every active owner with the date. Its three skips are: the owner already chose to stop (`cancel_at_period_end`, `cancel_at`, or a pending ending), the subscription is not the record's, or no owner email. In every skip the owner has already cancelled, so "to stop, cancel before that date" is not left false. No wording change.
- **Lawyer's-eye note 1:** the email is a template (`key: 'trial_ending'`) a platform admin can edit, and its date falls back to "soon" if Stripe sends no `trial_end`. Same class as `RENEWAL_REMINDER_AND_QUEBEC_GATE.md`'s finding. The binding date promise stays Terms §7 (checkout and the trial-confirmation email); step 3 is the extra one. Do not let the template lose the date.
- **Lawyer's-eye note 2:** step 2 "Your whole plan is on from the first day." is true only if nothing the plan includes is held off by a flag at the flip (family online payments, the guardian tier). If any is, name it or cut the sentence to "Your plan's tools are on from the first day."

## 2. Changed promises
**(a) FAQ "Which Club plan do I need?"** (`app/pricing/page.tsx:305`): "move up at any time, prorated charge shown before you confirm" is true for Club to Club · Association (Stripe preview, same figure charged, `plan-move.ts:27-30`). "Waits for your next renewal, needs 15 teams or fewer" is true (`:33-35, 213-224`). It is refused while a cancel or move waits (Terms §8 says so). Fine.

**MUST FIX: League Plus can change nothing** (`plan-billing-profile.ts:233-237`; no row in `MOVES`), and Club to League Plus does not exist. Now that League Plus is on sale, these are false for its buyer: `pricing/page.tsx:31` and `PricingSection` trust list "Upgrade or downgrade at any time", `for-leagues/page.tsx:127` and `for-clubs/page.tsx:149` (same words), and the FAQ "Can I change plans later?" (`pricing/page.tsx:183`: "Yes, at any time … billing adjusts pro-rata"). A house league that grows rep teams has no move: a new checkout, no proration, no second trial (Terms §7). Replacements:
- `for-leagues/page.tsx:127`: drop the third fact (or "Cancel any time; your plan runs to the end of the period you paid for").
- `for-clubs/page.tsx:149`: "Move between Club and Club · Association when you need to"
- `pricing/page.tsx:31`: "Move up to a larger Club plan at any time"
- FAQ answer: "It depends on the plan. Tournament Plus can move up to Club or Club · Association, and Club to Club · Association, at any time: you see the prorated charge before you confirm, and a move doesn't start a second trial. A move down takes effect at your next renewal. League Plus can't be moved to another plan yet." Whether to build a League Plus to Club move is an owner call (`/plan`).

**(b) Club · Association card lines** ("Premium Coaches Portal for every coach on 16 to 30 teams — no per-team fee"; "Start here, or move up from Club when you pass 15 teams"): true (same modules as Club, `plan-config.ts:127-146`; the up move exists). Pass.

**(c) SHOULD FIX, `for-clubs/page.tsx:77`:** "A coach who already has a standalone portal won't be charged for it again when you move to Club." It credits the club's move with what is the coach's own step: the coach moves their team in, their own plan ends at once, and the unused part is not refunded (recent commit `731fc586d`; Terms T5 is held, the published §8 covers it only generally). A coach is a consumer buyer. Replace with: "A coach who already has a standalone portal can move their team in; their own plan then ends and they aren't charged for it again." The no-refund fact stays at the coach's yes, which is where the owner ruled it. The same ambiguity sits in `pricing/page.tsx:326` (closed wording, S1-reviewed): leave until the coach move is proved (Ask 13).

**(d) "More than 30 teams? Email {support address} for a custom quote."** Fine. An invitation to write to us promises no price or availability; nothing is collected on the page; replies to a person who wrote first are not a CEM.

**(e) "coming soon" on League Plus.** No imminence defect as built: no date, no "early access", the sentence says "isn't open for sign-up yet", and the plan is built and set to open with Club (`BUSINESS_DECISIONS.md` 2026-11-06). **Lawyer's-eye note 3:** a date-free "coming soon" held for months while the gate is parked is a general-impression risk (Competition Act s. 74.01). If the owner parks either plan, retire the words.

**(f) The interest form lists only closed plans** (`EarlyAccessForm.tsx`). No CASL effect: the box is still unticked, still worded "feature and release updates for the areas I selected", and only a tick is consent (route `early-access/route.ts:117`). Hiding a plan removes a choice, never adds a recipient. **Lawyer's-eye note 4:** "areas" means the feature list, so a visitor who ticks the box having chosen only a plan has a thin scope for a later "plan opens" email; send that email only to ticked rows, as `ON_SALE_PAGES_S1_REVIEW.md` already requires.

## 3. SHOULD FIX: the availability line says "organizations" where individuals buy
`PLAN_AVAILABILITY_WHO` ("Available to organizations in Canada, outside Québec for now.") now shows under every /pricing band (`PricingSection.tsx:610`) and in home's price rows (`app/page.tsx:595`). Both include the Premium Coaches Portal, bought by individuals; Terms say "organizations and individuals in Canada" (Québec paragraph). My S2 ruling was for the club and league doors only. On the two shared surfaces use: "Available in Canada, outside Québec for now. Prices are in Canadian dollars." (home: the first sentence only). Keep the "organizations" words on /for-clubs, /for-leagues and the two start doors.

## Sources
Code as cited; Terms `lib/legal-documents/terms/2026-11-17.md` §7, §8, Québec paragraph. No new outside research.

## Lawyer's eye needed?
No new item beyond the four notes; none blocks.
