# On-sale pages S2 (the Club and League Plus start doors) — promises, Québec wording, the Terms tick, the team-move sentence
**Last verified:** 2026-11-19 (code read: `lib/legal-pages-switch.ts`, `lib/legal-documents.ts`, `lib/legal-acceptance.ts`, `lib/legal-acceptance-rules.ts`, `components/legal/PlanTermsLine.tsx`, `lib/plan-trial-line.ts`, `lib/billing-location.ts`, `lib/plan-billing-words.ts:178`, `app/api/billing/create-checkout/route.ts:94-126`, `lib/team-ownership-transfer.ts:534-545`; Terms 2026-11-17 read in full; `git ls-tree origin/master` read after a fetch. No statute text re-read: Québec's French-language rules and Ontario's consumer rules are NOT re-researched here.)
**Re-verify by:** the promote that carries the legal switch; the owner rules the team-move sentence; the first Québec account; any edit to `planTrialLine`, `PLAN_LINE_WORDS` or the box sentence; Bill C-36
**Depends on facts:** Terms 2026-11-17 §1, §3, §6, §7, §8, §17, §18, §20; `LEGAL_FACTS.md` (Canada only, nothing sold yet); `ON_SALE_PAGES_S1_REVIEW.md`; `RENEWAL_REMINDER_AND_QUEBEC_GATE.md`

## Question(s) this answers
Four asks from the S2 build prompt Part 0: (1) the plan step's promises and who the Terms tick covers; (2) the Québec / US sentence on step 1 (Ask 15); (3) how the doors "fail visibly" if the Terms are not live; (4) the team-move forfeited-remainder sentence (NOT ruled).

## ⚠ A premise to correct first (it changes item 3)
The build prompt says `LEGAL_PAGES_PUBLISHED` "is off on dev" and that `requireAcceptance` passes. **That is not what the code does.**
- `LEGAL_PAGES_PUBLISHED` is a **code constant**, not an environment setting. It is `true` on `dev` (`lib/legal-pages-switch.ts:26`, flipped in `e5be7d3b5`, 2026-11-17) and **`false` on `origin/master`** (read 2026-11-19 after a fetch). While it is `true`, `legalPagesMode()` returns `published` in every environment (`:30-31`), so `currentVersion('terms')` is `2026-11-17` and `checkAcceptance` returns `needed` for any account with no recorded tick (`lib/legal-acceptance.ts:90-101`). On dev, `requireAcceptance` **refuses** (409 `terms_required`); it does not pass.
- The pass-through the prompt describes exists only in the other state: constant `false`, `oldestAcceptedVersion` is null, `checkAcceptance` returns `off` (`:91-92`), and `requireAcceptance` lets everything not `needed` through (`:185`). **That is production today.** Production sells Tournament Plus and the Premium Coaches Portal with no Terms tick until the promote that carries `e5be7d3b5`.
- Consequence for S2: the doors will be built and walked on dev **with the tick live**, which is the better test. The risk is not "dev passes"; it is **the constant being set back to `false` on a branch that is promoted while Club or League Plus is open** (the documented undo for 6.7 is "one revert", `e5be7d3b5`'s message), and any account that is exempt (staff, demo: `lib/legal-acceptance-exempt.ts`).
- The S2 doors reach production only by a promote of a dev commit, and `e5be7d3b5` is already an ancestor of dev. So the ordinary path carries the tick. The unusual paths (a revert, a cherry-pick, a hand-built release) are what item 3 guards.

## Finding

### 1. The plan step's promises
**Verdict: approve the copy doc's plan step as written (W48 and W53 with `planTrialLine` and `PlanTermsLine`), on three conditions, and add one sentence about the organization.**

What each promise rests on:
| Promise on the plan step | Terms section | What the code does |
|---|---|---|
| "{N}-day trial — you add a payment method at checkout, and you’re first charged, plus applicable taxes, when the trial ends." (`lib/plan-trial-line.ts:27`) | §7: length and first-payment date shown at checkout; "Unless you cancel before the trial ends, your payment method is charged the plan's price, plus applicable taxes, on that date"; §6: tax worked out from the billing address and shown as its own line before you pay | Checkout starts the trial with `trial_period_days` (`create-checkout/route.ts:433`) and none for a returning customer (`:412`). No "free" in the sentence, which matches §7's heading only loosely but does not over-claim. True. |
| "Your plan renews automatically until you cancel. You can cancel any time from your billing page…" (`PLAN_LINE_WORDS.lead`) | §8 Automatic renewal, Cancelling | True. In a trial the cancel schedules the end for the trial's last day and "no plan payment is taken" (`lib/plan-billing-words.ts:178`, `plan-ending-server.ts:505`), which is what §7 implies. |
| "If your plan starts with a trial, it ends on the date shown at checkout, and your payment method is charged then unless you cancel." (`PLAN_LINE_WORDS.trialMaybe`) | §7 | True. |
| "…your plan runs to the end of the period you’ve paid for" (`lead`) | §8 Cancelling | Reads oddly in a trial (nothing is paid yet) but is not untrue, and the trial sentence before it carries the real promise. Do not reword it: `PlanTermsLine` is one component read by many doors and pinned by `legal-acceptance-gates.test.ts:496-512`. |

**Conditions:**
- **(a) Say a trial only where one applies, from the server.** Pass `trial="known"` to `PlanTermsLine` ("Your trial ends on the date shown at checkout, and your payment method is charged then unless you cancel.") when `previewClubCheckout` says a trial applies, and pass nothing (no trial sentence, no `planTrialLine`) when it says none. Never the code value. A new org has no Stripe customer, so the trial is expected; a resumed or odd path must still read the server.
- **(b) Show the billing cycle beside the trial line.** The largest surprise a buyer can have is a full **year** taken at day 90 (Terms §8 gives a 30-day renewal email for a yearly plan; the Club trial is longer than the 38-day exception, so the ordinary reminder, not the purchase email, is the notice). The card already shows Monthly / Annual; the selected one must be named where the button is ("Billed yearly" / "Billed monthly"), no new promise. `/billing` Part 0 should confirm the 30-day reminder covers a yearly subscription whose first charge is a trial end (`lib/renewal-reminder.ts`; I did not trace it).
- **(c) Who the tick covers — add one sentence on the plan step.** The tick is at step 1, **before the club has a name**, and the box says "I agree to the Terms of Service and have read the Privacy Policy" with an 18-or-older line (`ACCEPTANCE_BOX_PARTS`). Terms §1: "if you accept them for a club… you confirm you are allowed to bind it." Nothing in the door connects the step-1 tick to the club. The plan step is the first moment the person is acting for a named organization, so say it there, above `PlanTermsLine`:

  > **You’re starting this plan for {club name}, and you confirm you’re allowed to agree to the Terms on its behalf.**

  League door: "…for {league name}…". It is a statement, not a second box (no second record; the step-1 record, the checkout, and the purchase email's "Bought by" line are the evidence, Terms §16). `PlanTermsLine` follows with its own "By continuing, you agree to the Terms of Service." Do not change the box sentence at step 1 (it is recorded word for word).
  **Honest limit:** a tick on a personal account plus a line before checkout is the normal way organizations accept online terms, but whether it binds the organization against a later denial of authority is for a lawyer; see below.

Also confirmed: the tax words inside the trial sentence are right (Terms §6, §7; the tax itself is `/accounting`'s). Nothing on the page may say "free", "no card" or "nothing is charged until…" (canon, 2026-09-25).

### 2. The Québec / US sentence on step 1 (Ask 15, ruled)
**Verdict: approve the ruling's content; here is the sentence.** It must be on step 1 (the account step) because the Québec refusal otherwise fires only at the address screen, after the account, the tick and the org exist (`regionClosed`, `lib/billing-location.ts:89`).

> **For organizations in Canada, outside Québec for now. Prices are in Canadian dollars.**

- Placement: under the sub-line, above the form (the copy doc's "small print under the button: none" stands; this is a line under the sub, not a promise at the button).
- It matches Terms §17 ("offered to… Canada. It is not currently offered in Québec") and §6 (Canadian dollars), and the product's own refusals ("We’re not selling in Québec yet.", `qcClosed`; "We’re not selling in the United States yet.", `usClosed`). "For now" carries no date and no promise to open; do not add one.
- It does not name the United States: "organizations in Canada" already excludes it, and a US-only line would invite a question the owner has not ruled.
- Accent and spelling: "Québec" as the product writes it everywhere.
- Build checks, not wording: the address screen on these doors must show the existing `qcClosed` / `usClosed` notice and stop **before** Stripe (the org stays free Tournament, the abandoned-checkout state). `regionClosed`'s "correct it on your billing page" assumes a billing page; on a brand-new door's address screen say it on the screen itself or confirm the billing page is reachable.
- Lawyer's eye (L7, not researched here): the Québec French-language rules for standard-form contracts are the reason to stop a Québec buyer **before** an English-only agreement is accepted. The step-1 line helps, but the tick is still taken from anyone who reaches the form. Nobody is known to be in this position.

### 3. Terms acceptance: how the doors "fail visibly"
**Verdict: your lean is right, with a scope and one test extension. Do (A) a runtime refusal in production, (B) a runbook line, (C) extend the existing source-assertion test. Skip a standalone build guard on the constant.**

**(A) A runtime refusal, scoped.** In `create-checkout`, immediately after `requireAcceptance` (`:96-97`), refuse when **all three** hold: the plan is `club`, `club_large` or `league` (the three S2 sells); `legalPagesMode(env)` is `off`; and the Stripe key is a **live** key (`!stripeKeyIsTest`). Answer 503, code `legal_pages_unpublished`, and `console.error` a line naming the plan (it reaches CloudWatch, the same place the other server errors go). Words for the buyer:

> **We can’t start a plan right now. Nothing has been charged. Please try again later or email support@fieldlogichq.ca.**

  Why this and not wider: Tournament Plus and the Premium Coaches Portal are on sale on production today with no tick (the pages are off there); a refusal on every paid plan would stop those sales before the promote that fixes them. The new plans have no such history. Why a runtime refusal at all: the open/closed state of these plans lives in a **database row** (`plan_gating`), the legal switch lives in a **code constant**, and no build can see both, so only the request can. It costs one `if`; it fails closed and says so; and it needs the Stripe-key condition so a dev revert is not blocked while testing. Put the same helper (one function, one place, `lib/legal-acceptance.ts`) in any new S2 route that starts a checkout or creates a paid org, so there is no second copy.

**(B) A runbook line, in `docs/agents/ops/CLUB_GATE_FLIP_RUNBOOK.md` Step 3 or a new Step 4.0**, because the flip is the one human moment: *"Before **Request live** on `club`, `club_large` or `league`: open `/legal/terms` on production and confirm it serves version 2026-11-17 (or later); open the sign-up page and confirm the tick box shows. If either is missing, do not flip. The checkout refuses these plans without the Terms, but the visitor should never see that."* (The runbook has no Terms line today.)

**(C) Extend the existing source test.** `tests/unit/legal-acceptance-gates.test.ts` already pins which routes call `requireAcceptance` before their first branch. Add the S2 routes to that list (every route that creates the org or starts the checkout) and add the account-step route to the account-door census in `legal-acceptance-doors.test.ts`. A new door that forgets the tick then fails the build, not a customer.

**(D) Amended after the coordinator's correction (same day): a build guard on the constant IS worth having, keyed to the doors, not to the plan gate.** The coordinator proposed (i) every route a paid door reaches calls `requireAcceptance` at its top and (ii) `LEGAL_PAGES_PUBLISHED` cannot be false while a paid org door exists. **Confirmed, with these amendments:**
- (i) is (C) above; agreed. Pin "at its top" the way the existing census does (before the first branch).
- (ii) works if it keys on the **existence of the S2 door files** (the two `/start/club` and `/start/league` open-state routes and the checkout), not on the plan gate: a unit test that fails (it must fail, not skip) when those files exist and `LEGAL_PAGES_PUBLISHED` is `false`. My earlier objection was to tying it to the plan's gate default, which production does not read; keyed to the doors it does catch the revert on a branch. Note the existing `legal-pages-switch.test.ts` "not published" block **skips** when the constant is true, so a revert would swap which block runs, not fail the build. The new guard is what makes a revert loud.
- Keep **(A) the runtime refusal as well**: the build guard only runs where tests run before a promote; the refusal catches a release that skipped them. Two cheap layers, different failure modes.
- Runbook line (B) gains the coordinator's second half: after the first live test purchase, confirm an acceptance record exists for that account. On production read it as a **count only** (rows in `legal_acceptances` for the owner's own test account), never a person's row (AGENCY_RULES, 2026-11-18).
- Stale comments: `lib/legal-acceptance.ts` header ("DARK MEANS INVISIBLE… production until 6.7") and the `legal-documents.ts` header describe the pre-6.7 state; they are a wording clean-up for the build session, not a behaviour change.

**A new door id costs a migration.** Acceptance rows are checked against a fixed list of door ids (`ACCEPTANCE_DOORS`, mirrored by `legal_acceptances_door_check`, mig 455; a unit test fails if the two differ). If the Club and League doors record under their own ids, that is a new migration and a dictionary line; recording under the existing `signup` door needs neither. `/legal` has no objection to either; `signup` is simpler, and the door is still known from the account's start pick.

### 4. The team-move forfeited-remainder sentence — direction RULED 2026-11-19, text drafted here, Terms version NOT yet published
**Status: the owner ruled the direction on 2026-11-19 (reported by the coordinator, (a) to (d) as proposed): (a) say it where the coach says yes to the move; (b) one Terms sentence carves the move out, as a Terms-version question, not a quiet edit; (c) keep "you won't be charged for your own Coaches Portal again" and gate the "everything comes with it" lines on Club being open; (d) a prorated refund is a separate, later decision. Also ruled the same day: the tax words stay inside Tournament Plus's trial sentence. The two texts below are drafts for the owner's approval of the wording; nothing is published.**

What the code does: a coach's own plan is cancelled at once, no proration, no refund (`lib/team-ownership-transfer.ts:534-545`). What the published Terms say: a cancelled plan runs to the end of the paid period (§8 Cancelling), "we do not give refunds or credits for the unused part of a period, whether you cancel, downgrade, or stop using the service" (§8), and **"If we end your plan for a reason that is not your fault, we will refund the unused part"** (§8, last paragraph). A team move is none of the first three, and it can be read as the last: without a carve-out the Terms promise the coach the refund the code does not give. So the problem is real and is a Terms question, not copy.

Drafted text for the **next Terms version** (the held draft `drafts/TERMS_OF_SERVICE.md` 0.2 is the vehicle; it would be edit **T5**; the published 2026-11-17 file is never edited). A new paragraph in §8 after "Downgrading":

> **If your team moves into a club.** If you agree to move your team into a club’s FieldLogicHQ space, your own plan ends on the day you agree, because the club’s plan then covers the team. We do not refund or credit the unused part of the period you paid for, and you will not be charged for your own plan again. Before you agree, we show you this and the date your plan would have run to.

Words at the moment of the coach's yes (ruled item (a); the wording is a draft): **"Your own plan ends today, because {club name} now covers this team. The unused part of what you paid, to {date}, is not refunded. You won’t be charged for your own plan again."**

**What the Terms version needs (the owner's and the publishing session's steps; not done here):**
1. Add the paragraph above as edit **T5** to the held draft `drafts/TERMS_OF_SERVICE.md` (0.2, which already carries T1 to T4). Start from the published file, set `draftPath` in `lib/legal-documents.ts`, keep the draft's owner-note shape so the preview filter test passes.
2. The owner approves the wording (these drafts are not yet approved).
3. At publication: a new dated version file, frozen with its sha256; `current` moves; **`oldestAccepted` moves only if the change is called significant under §18**, which brings back the accept-again screen and needs the 30-day email to every account owner first.
4. Publish before any club can receive a team on production. The confirm-screen sentence ships with the build that makes the move reachable and must not say more than the Terms in force say.

Still for the owner:
- **Is it a significant change?** §18 asks for 30 days' email and fresh acceptance for a change "that reduces your rights or increases what you pay". Read against §8's text, this carve-out removes a refund a coach could claim. My recommendation: publish it **before a club can receive a team on production** (no club is on sale there today, so nobody has had the right to lose) and bundle it in the held version with T1–T4; then it reaches every account as an ordinary new version and the fresh-acceptance question is the same one that version already answers. If a coach purchase exists and a move is possible first, treat it as significant.
- **The alternative that needs no Terms edit:** refund the unused part when the move happens (§8's own last paragraph already promises it). That is a money decision (`/accounting` for the credit note and tax on it), listed as the prompt's (d).
- **Consumer rule not researched.** A coach buys as an individual (Terms §16); whether Ontario's internet-agreement and cancellation rules let a buyer demand the unused part when a seller-side feature ends the plan early was not researched. `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` (2026-11-08) is the starting point. One more reason to show the words at the yes.

## What the product does today
Checked against the lines cited above. Not checked: the renewal-reminder path for a yearly trial (`/billing` Part 0), the S2 build itself (nothing is built yet), and the cancel route's trial branch beyond `plan-ending-server.ts:505` and the trial wording at `plan-billing-words.ts:178`.

## Recommendation
1. Plan step: approve the copy; conditions (a) trial from the server and `trial="known"`, (b) cycle named at the button, (c) the organization sentence above `PlanTermsLine`.
2. Step 1: "For organizations in Canada, outside Québec for now. Prices are in Canadian dollars."
3. Production must not sell without the tick: (A) a scoped runtime refusal in `create-checkout` (live key, `off`, the three plans), (B) a runbook line before "Request live", (C) the S2 routes added to the two acceptance source tests. The premise "off on dev" is wrong: it is `true` on dev and `false` on production until the next promote.
4. Team move: direction ruled 2026-11-19; the Terms paragraph (edit T5 in the held draft) and the confirm-screen sentence are drafted above for wording approval; the version bump follows the steps listed; the significant-or-minor call under §18 stays with the owner.

## Sources
- [Terms of Service 2026-11-17](../../../lib/legal-documents/terms/2026-11-17.md) — read 2026-11-19
- `lib/legal-pages-switch.ts`, `lib/legal-documents.ts`, `lib/legal-acceptance.ts`, `lib/legal-acceptance-rules.ts` — read 2026-11-19; `git ls-tree`/`git show origin/master:lib/legal-pages-switch.ts` after `git fetch`, 2026-11-19
- `docs/projects/active/CLUB_ON_SALE_COPY.md` W46–W53, `CLUB_ON_SALE_PAGES_PLAN.md` Asks 8, 14, 15 — read 2026-11-19
- No external source consulted; no statute or regulator page was opened for this review.

## Lawyer's eye needed?
Optional, owner's call (no gate): (1) whether a personal-account tick plus a "you confirm you are allowed to agree for {club}" line binds the organization if authority is later denied; (2) Québec French-language rules for the contract a Québec organization could accept at step 1 before the address screen refuses it; (3) the team-move carve-out against consumer-protection rules for a coach who bought as an individual, and whether §18 makes it a significant change.
