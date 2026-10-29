Updated the copy document, impact inventory, plan §9, PM brief, and one-line TODO entry. **Part 1 has not started.** No runtime code, tests, automation, or drawing file was edited; no commit made.

I read all 879 lines of the drawing source. The complete comparison is recorded in [copy §12](C:/Users/b2cow/Documents/tournament-website/docs/projects/active/PLAN_AND_BILLING_COPY.md:481).

**Included lists:** Tournament, Tournament Plus, League Plus, Club, and Club · Association match item for item. Premium differs:

- The drawing’s **seven items** detail roster/contact information; schedule/attendance/lineups; budget/dues/expenses/reminders; documents/checklist/season-end record; tournament entries/results; tournament history; and hosted tournaments with PDF schedules/results.
- The proposed **five items** summarise portal tools, budget/reminders, and hosting, and explicitly include unlimited coaching staff and tournament admin seats.
- Today’s published article has **eight items**, including its final parent-organization link item. Its wording remains protected independently.

My recommendation is the **seven drawn items for Premium billing**, with its hosting item absent during staff free time, while preserving all eight published article items.

These are the remaining wording and presentation differences. Recommendations are recorded as recommendations, not rulings:

| Difference | Drawing versus copy proposal | Recommendation |
|---|---|---|
| Included heading | “What {plan} includes” versus “What's included” | Keep the universal copy heading. |
| Free price | “Free forever” versus “Free” | Keep “Free”. |
| Capacity column | “Holds” versus “Teams” where relevant | Use “Holds” across the tables. |
| Usage captions | “Tournament at a time” and “tournaments · unlimited” versus “Tournament slots” and named meters | Keep the drawn connected figures; use clear, pluralised captions. |
| Founding helper | Lowercase “normally”, without a final period | Use the copy’s sentence case and punctuation. |
| Founding band | “Choose a plan for {year}” versus “for your {year} season” | Keep the copy’s season wording. |
| Organization cancellation | Unqualified “everything … comes back” versus restoration within the retention window and plan limits | Keep the bounded copy promise. |
| Premium cancellation paragraph | “Cancelling suspends Premium” plus an inline offline list versus shorter Premium-specific sentences | Keep the shorter copy; show offline detail in the window. |
| Premium warning | Immediate shutdown plus inline list versus immediate shutdown, retention period, and Basic-records reassurance | Keep the copy and the shared offline list together. |
| Retention paragraph | “Reactivating brings it all back” and a sample archive count versus actual counts and limited restoration | Use actual counts and bounded promises. |
| Premium Keep button | “Keep Premium” versus potentially “Keep Premium Coaches Portal” | Use “Keep Premium”. |
| Premium confirmation | “Cancel and suspend” versus “Cancel Premium” | Use “Cancel Premium”. The entry button “Cancel Premium…” is already ruled. |
| Cancellation footer | No left-hand sentence versus “Your data is kept for {days} days.” | Keep the copy’s footer sentence. |
| Cancelled coach label | “{workspace} is cancelled” versus “Premium is cancelled” | Use “Premium is cancelled”; Basic remains available. |
| Reactivation heading | “Everything comes back” versus “restore your data” | Keep the copy. |
| Restoration checklist | Unqualified tournament restoration versus retention-window and slot-limit qualifications | Keep the qualified copy and explain any retained remainder. |
| Premium reactivation button | Full product name versus “Reactivate Premium” | Use the short label. |
| Additional cancelled prose | Drawing omits the copy’s extra explanations and introduction | Omit redundant paragraphs; retain necessary retention information. |
| Downgrade title | Drawing ends with “?”; copy does not | Use the question mark. |
| Downgrade reason | “Why are you downgrading?” and the full records helper versus “Note for your records” | Use the drawing’s wording. |
| Downgrade buttons | “Keep Tournament Plus” / “Confirm downgrade” versus generic Close / target-naming confirmation | Keep “Keep {currentPlan}”; name the target on the confirmation. |
| Lost-feature warning | Detailed eight-feature list versus a generic warning | Keep the detailed list from the shared data source, plus the saved-branding explanation. |
| Duplicate downgrade door | Drawing shows it in Change plan **and** Reduce or cancel | Show it once, in Change plan. |
| Club offline list | Short program names with team counts versus detailed server descriptions without those counts | Keep one shared source; decide whether its display retains the concise names and team count. |
| Premium offline-slot name | “Premium tournament slot” versus “Premium local tournament slot” | Keep the existing server wording. |
| Quiet tournament shelf | Retained by Ask 12, but absent from the drawn body | Reuse the shipped content as the quiet final section. |
| Window close | Drawing uses an X icon on desktop and Back on phone; copy specifies plain × | Reuse shipped behavior: plain × on desktop, Back on phone forms. |

Three drawing inconsistencies also need acknowledging:

- It still lists hosting during Premium free time despite saying hosting is unavailable. Follow the existing hosting exclusion.
- Some closed Club rows still show “Move” despite the drawing’s own Contact us rule. Follow the live sale gate.
- Two Premium admin frames force an Organization eyebrow despite their captions saying it should be absent. Follow the existing no-organization ruling.

Your current reply resolves the organization free-time differences: use the approved **contact invitation**, and preserve the existing running copy rather than copying the drawing’s unconditional “Nothing is charged for this” sentence.

**Trial findings:** the default trials are 14 days for Tournament Plus, 30 for League Plus, and 90 for both Club sizes. Actual organization checkout uses configurable trial days and withholds another trial after a qualifying prior subscription. Paid plan moves start no new trial. Premium defaults to no trial; Keep Premium explicitly omits one.

Checkout collects a **payment method**, including during trials, but the routes do not restrict that method to cards. Collection defaults to required; available methods come from Stripe settings. [Stripe Checkout reference](https://docs.stripe.com/api/checkout/sessions/create).

I recommend:

> “{days}-day trial — you add a payment method at checkout, and you're first charged when the trial ends.”

Show that only when eligibility and duration are confirmed; otherwise use “Payment details collected in Stripe” or omit the trial sentence. **The remaining wording decision is whether to replace the existing Club helper’s “card” wording consistently across its surfaces.** I recommend doing so, rather than changing checkout to force cards.

**Upgrade-door finding:** neither desktop tables nor phone cards show “See what {plan} includes”. The drawing’s only similar link is on the later-stage Basic-team footer. Your requirement for the billing door is recorded. Placement still needs a ruling; I recommend a quiet details link beneath each target plan’s name on desktop and phone, but have not drawn or implemented it.

**Free-time change impact:**

- Runtime readers: `BillingKit.tsx` and the existing admin billing page; the tournament subscription page re-exports that page.
- Renderer/type consumer: `FreeTimeBand.tsx`.
- Both organization ending strings need updating: the band and the separate billing line.
- Only `free-time-surfaces.test.ts:65` pins the old organization sentence. Its running, closed-plan, and ended-state assertions stay; an ending billing-line assertion should be added.
- The Club help paragraph saying customers can “choose it there” must follow the change.
- Portal sentence tests, Keep Premium, Overview, and reminder behavior remain unchanged.

The complete pre-edit census is in [copy §14](C:/Users/b2cow/Documents/tournament-website/docs/projects/active/PLAN_AND_BILLING_COPY.md:601).

**Token coverage recommendation:** ordinary CSS and inline-color checks already cover `components/billing`. Leave the script and harmless stale entry alone. Optionally extend the stricter whole-file rule to the future billing-body stylesheet, through a separately requested automation commit.

Validation: document checks and spelling passed. All **11,507 tests passed**. Full `verify:changed` then stopped on an unrelated ESLint configuration error: missing `react-hooks` plugin. I did not rerun typecheck or touch the other sessions’ scheduling work.
