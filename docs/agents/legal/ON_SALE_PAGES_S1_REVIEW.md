# On-sale pages S1 — promises review (interest form, coach-into-Club line, trial sentence)
**Last verified:** 2026-11-18
**Re-verify by:** the promote that carries S1; Club or League Plus opening (S2); Bill C-36; first Québec customer
**Depends on facts:** Club, Club · Association and League Plus closed on production; nothing sold; CASL express consent needed for any "your plan is open" email; Terms 2026-11-17 §8

## Question(s) this answers
Five changed promises in S1 (owner rulings 2026-11-18, Asks 6, 13, 31, W72, W73, W50): the unticked interest box and its window words, "you won't be charged for the portal again", the sports FAQ answer, the trial sentence, the closed /start/club page.

## Finding
1. **Unticked default is right under CASL** (express consent is not given by a box ticked for the visitor). Three loose ends: (a) `app/api/early-access/route.ts:117` stores `release_notifications_consent: consentSent !== false`, so any caller that sends NO box value is recorded as a yes. The coach interest form (`components/coaches/CoachStartInterest.tsx`, no box, says "we'll be in touch") is exactly that caller; the runbook (`CLUB_GATE_FLIP_RUNBOOK.md` Step 6.1) emails "those who gave consent", so those leads would be emailed on no express consent. (b) The window's intro line and `GATED_PLAN_INTEREST_LINE` (`lib/plan-config.ts:181`) promise "we'll let you know when it opens" to everyone, then the saved screen tells an unticked visitor they won't be told. (c) The "opens" email is a CEM (it invites a purchase): by hand is fine, but it needs the sender's name, contact address and a working unsubscribe line; Step 6 lists none.
2. **"Won't be charged for the portal again" is true in code** (`lib/team-ownership-transfer.ts:534-545`: the coach's own subscription is cancelled the moment the move completes). It is also true that **it is cancelled at once, no refund, no proration** (ruling 2026-09-28) while Terms 2026-11-17 §8 promises a cancelled plan "stays fully active until the end of the period you have already paid for" and "No refunds for part-periods" because of that. A yearly coach forfeits up to eleven months, undisclosed. No Terms sentence carves it out. The move is on production but unproved, and no club can receive a team yet (Facts doc, Coach bridge).
3. **Sports answer is true:** sport is chosen per tournament, season and team (`lib/sports.ts` OFFERED list), and `getSportPack` drives tie-breakers, points, score words (`lib/sports.ts:116-135`).
4. **Trial sentence is a fair promise** at checkout's 14 days: `create-checkout/route.ts:412-414` withholds the trial from a returning customer and checkout says so before payment (`plan-billing-words.ts:445`); no `payment_method_collection` override, so a payment method is taken. One defect: /pricing shows it while Tournament Plus's Founding Season is active (`app/pricing/page.tsx:372`, ungated); /for-tournament-organizers gates it on `!tpPromoActive`.
5. **/start/club is fine**: "coming soon" matches the closed gate; the false "we set up Club with you" line is gone.

## Recommendation
See the review reply: change (1a) default to no for a new lead with no box; (1b) reword both lines; add the CEM footer to Step 6; (2) owner question on the forfeited remainder, and gate the in-product "everything comes with it" lines until a production walk of the move; (4) add `!tpPromoActive` on /pricing.

## Sources
Code lines above, read 2026-11-18. CASL s.6(1), 6(2), 10(1) text not re-fetched this session (prior reading in `CASL_SECOND_PARENT_EMAIL.md`).

## Lawyer's eye needed?
No gate. If the owner wants one: whether the forfeited remainder on a move is an unfair term for an individual buyer (Ontario CPA 2002).
