# On-sale pages S4 Part 3 — free time catches an ending paid plan (the words as built)
**Last verified:** 2026-11-21
**Re-verify by:** the next Terms version (draft 0.4) is published; the fall-back's rule changes (e.g. judged at a date other than the plan's end); free time ever given a price
**Depends on facts:** LEGAL_FACTS.md (the seller; CASL position on account notices); the published Terms and Privacy Policy 2026-11-17

## Question(s) this answers
- Do the words built for call 40 option A (owner 2026-11-21) promise only what the ending does (Competition Act s. 74.01; /legal caught version 1 promising the fall-back before it was true)?
- Are the changed emails still transactional notices under CASL?
- Do the published Terms and Privacy Policy still describe the product truthfully?

## Finding
- **The table line is a true conditional.** "Starting a plan doesn't end your free time. If the plan ends while your free time runs, {org} goes back to free Tournament Plus through {date}." matches the code (`freeTimeCatchesEnd`: the free time must cover the instant the plan ends; a plan that outlasts it closes as before). "While your free time runs" also covers staff ending free time early. The drawn "If you stop it, …" would have over-promised for a yearly plan — the owner's choice of words removes the s. 74.01 exposure version 1 had.
- **The cancel window, Reduce or cancel and the notice** say the fall-back only when the server's own rule says free time covers that end date (`fallBackFor`), and list only what actually stops. True as at the moment shown.
- **The emails stay transactional** (CASL s. 6(6): they confirm or give notice about a subscription the recipient holds; no offer, no price in the "has ended" email). The fall-back words are sent as built-in text even where a template was customised, so a stored template cannot reintroduce "suspended". **Applied in this read (SHOULD):** the ends-on and reminder emails now add "Tools that come only with {plan} turn off." and the "has ended" email "Tools that came only with {plan} are off." — only when the paid plan carried tools the free plan does not — so the notice says what stops as well as what stays (the move emails' existing words).
- **Terms (2026-11-17):** §8 (cancelling runs to the period end, no part-period refunds) is unchanged by the fall-back. §9 ("When a paid plan ends, your organization's space closes to new activity and we keep your information … 90 days … then may delete it") now over-describes a fall-back: the space does NOT close and nothing is counted down. The product does more for the customer than §9 says, not less — no detriment, no MUST-FIX — but the Terms should say it. **Privacy Policy (2026-11-17):** the 90-day retention is a "may be deleted" ceiling for an ENDED plan; a club that falls back keeps its information as any open club does. No conflict.
- **Known gap (staff ending free time early after an ends-on email went):** the email said the club goes back to free time; if staff then end the free time early, the plan's end closes the club. The words were true when sent and the later change is FieldLogicHQ's own act, so the exposure is small, but the owner would be surprised. Ending free time early sends no email today (FREE_TIME_SAME_RULES_PLAN.md).

## What the product does today
Checked against the build: lib/free-time.ts `freeTimeCatchesEnd`; lib/plan-ending.ts `applyFallBack` (no suspension, no archive beyond the granted plan's limit, no account record); lib/plan-billing-words.ts `W.fallBack`; lib/plan-ending-emails.ts `onTheDay`; lib/plan-ending-server.ts `sendEndedEmail` / `endingEmailFacts` (builtInOnly); app/api/billing/cancel/preflight/route.ts (`fallBackFor`).

## Recommendation
1. Ship the words as built (with the tools sentence above).
2. **Terms draft 0.4, §9 (next version, not a re-acceptance trigger on its own):** add "If free time we gave your organization is still running when a paid plan ends, your organization goes back to that free plan instead, and this section does not apply." → owner, with the next Terms version.
3. **Staff ending free time early while a cancel waits (route to `/plan`):** the End-it-now window on a club whose paid plan's cancel is waiting should tell staff that the club was told it goes back to free time and will now close on the end date, and offer to email the owner.

## Sources
- Competition Act, R.S.C. 1985, c. C-34, s. 74.01 — https://laws-lois.justice.gc.ca/eng/acts/c-34/section-74.01.html — accessed 2026-11-21 (relied on as already recorded in this index's earlier S2/S3 reads)
- CASL, S.C. 2010, c. 23, s. 6(6) — https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html — accessed 2026-11-21 (as recorded in CASL_FREE_TIME_ENDING_REMINDERS.md)
- Internal: lib/legal-documents/terms/2026-11-17.md §8–§9; lib/legal-documents/privacy/2026-11-17.md retention — read 2026-11-21

## Lawyer's eye needed?
No.
