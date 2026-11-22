# Free time ending reminders (clubs) and free time with no end date (coaches)
**Last verified:** 2026-11-20 (code read the same day; CASL text not re-fetched — reasoning rests on the ss.1(2), 6(1), 6(2), 6(6) reading recorded in `CASL_LATE_BILL_EMAIL.md`, verified 2026-11-13)
**Re-verify by:** 2026-11-20 + 12 months, or a trigger: either email gains a price, a discount, an offer or a link other than the account's own billing page; staff ending free time early starts emailing; the Terms gain a free-time clause; Bill C-36; first Québec customer
**Depends on facts:** `LEGAL_FACTS.md` (seller identity, CASL position on account emails); `FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` §4/§5 (the Founding holders' free time through September 30, 2027)

## Question(s) this answers
1. Is the club's 14- and 3-day "free time ending" email (kind `club_free_time_ending`, `FREE_TIME_SAME_RULES_PLAN.md`) a commercial electronic message, and does it need an unsubscribe?
2. Are its promises true: "nothing you made is deleted", "the tools … close then", "its information is kept for 90 days from that day, and you'll get an email with the date"?
3. Does it meet the condition set at Stage 2a/2b (club reminders ship with, or before, the code that removes the Founding card's "we'll remind you during the summer")?
4. Does free time with no end date on a Coaches Portal need wording or a notice promise?

## Finding
1. **CASL: most likely not a CEM, the same reading as the coach's reminder and the late bill.** The email states a fact about the club's own account (what was given, its last free day, what happens the day after) and points only to the club's own Plan & billing page. One sentence, "To keep {plan}, contact us.", invites a purchase, which is the soft spot under the s.1(2) purpose test. It carries no price, discount, deadline offer or promotion, mirrors the billing page's own words, and is the same class as the coach email's "you can choose it now" + Keep Premium button that the Stage 2a review accepted as a service notice. On the worst reading it is a CEM within s.6(6) (factual information about an ongoing account), which lifts **consent only**: the identification block and unsubscribe would then be owed. The safe position therefore rests on "not a CEM", and holds only while the email stays free of offers, prices and links other than the account's own billing page.
2. **Promises — true as built:**
   - *Whole plan:* the grant's end runs no code (`lib/free-time.ts` foldGrants reads it; nothing deletes); the club reads as its own plan again. "Nothing is charged" true (a grant, no Stripe). Over the free plan's tournament limit, tournaments are kept and a new one waits, as the line says (matches the billing band, reviewed at 2a).
   - *Sections:* no job acts on a section grant's expiry (only this reminder reads `module_addon` ends); the section is gated off, its records stay. True.
   - *Billing status on a reopened ended club:* `lib/free-time-reclose-server.ts` endAgain → `applyEnding(… notifyOwner: true, freeTimeEnded: true)` and `extendKept(…, BILLING_RETENTION_DAYS)` (= 90, `lib/billing-cancellation-policy.ts:6`): closed again, a fresh 90 days from that day, and the owners emailed the date. True. ("Closes again" covers what the ending does: suspended, site off, tournaments archived — the follow-up email names them.)
   - *Billing status, other:* vague but true ("goes back to how it was before the free time").
3. **Stage 2b condition: met.** The two former Founding clubs hold a dated `plan_tier` grant above their own plan (migration 510), so the job emails every active owner on September 16 and September 27, 2027 (14 and 3 days before September 30, 2027 — late summer, inside the old card's promise). It runs on the daily job already scheduled on production (migration 408, applied 2026-10-30) and needs the grant switch on (confirmed 2026-10-25) and migration 512 on production **before** the promote. Stage 2b must still reach production only together with this item.
4. **Coach, no end date:** free time is a gratuitous benefit our Terms do not mention; staff can end it now, and ending it sends no email. "With no end date" can read as "for good". Not misleading in law (nothing was paid for it), but a fairness and complaint risk. Cheap fix: say "no end date set". Do **not** add a promise of notice the product does not keep.

## What the product does today
- Words: `lib/club-free-time-reminders-words.ts`; job `lib/club-free-time-reminders.ts` (every active owner via `orgOwnerEmails`, demo addresses excluded, Coaches Portals and suspended clubs skipped, no email when nothing changes at the end, claimed before sent, once per end per wave); step in `app/api/platform-admin/portal-free-time-daily/route.ts`; logged as an account email with a fixed label, never the subject (`lib/email-kinds.ts`).
- Coach band and cancel refusal: `lib/portal-free-time.ts` (`portalFreeTimeCopy` open state, `coachCancelRefusal(null)`).

## Recommendation (applied 2026-11-20 in the build session)
- **Button on the reopened-ended-club email: "Choose a plan" → "Open Plan & billing"**, so all four shapes carry the same neutral pointer and the only purchase-flavoured words are the one "To keep" sentence.
- **Coach no end date:** band text "FieldLogicHQ gave you Premium, with no end date set. Nothing is charged."; cancel refusal "… free from FieldLogicHQ, with no end date set." Keep the title as is.
- **Hold the line in code:** a build guard that the email's words never carry `$`, a price, "discount", "offer" or a link other than the billing page (the unit test already bars `$|price|lose|cancel`).
- Owner question (not a legal requirement): should ending free time early, or ending an open-ended one, tell the coach or club by email? **RULED 2026-11-20: no** (owner "i agree" to the recommendation; staff end it early only by arrangement with the customer). Nothing promises an email, so nothing needs re-wording.

## Sources
- `CASL_LATE_BILL_EMAIL.md` finding 1 (CASL ss.1(2), 6(1), 6(2), 6(6), SOR/2012-36 s.2(1); read on laws-lois.justice.gc.ca 2026-11-13) — the reasoning reused here.
- Index rows for Stage 2a and 2b (`LEGAL_INDEX.md`) — the condition and the coach-notice precedent.

## Lawyer's eye needed?
No for the email as built (the owner decides). One line a lawyer could confirm with the others already listed: whether a "to keep {plan}, contact us" sentence in an account notice tips it into a CEM under s.1(2).
