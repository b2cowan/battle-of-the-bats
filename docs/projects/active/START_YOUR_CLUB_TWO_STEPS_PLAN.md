# Start your club in two steps — plan

**Status:** on the board (Owner Morning Brief).

**Ruled** 2026-11-16 (owner, all six asks A) on the drawings https://claude.ai/artifact/Swg71ETYVZXeFjgAUZThbj
(source `START_YOUR_CLUB_TWO_STEPS_DRAWINGS.html`). Decision entry: `memory/design_decisions.md`, 2026-11-16.
PM brief: `START_YOUR_CLUB_TWO_STEPS_PM_BRIEF.md`.

## The problem
The charge and the terms sat below the fold of one long window, while the pinned **Start my club** button was on screen from
the first moment — so it could be pressed before the charge or terms were ever seen. The charge also depends on the typed
address, so the order the form is filled in is the order the window stacks.

## What was built
`components/billing/PlanMoveDialog.tsx`, in-place mode only (Premium → Club, all three starts: a plan with a subscription,
free time with a trial, no trial):

| | Step 1 of 2 · Your club | Step 2 of 2 · Review the charge |
|---|---|---|
| Body | owner sentence, (free-time band + trial sentence), club name, billing address, web address — unchanged | read-back (club, billing address, web address, **Change**), (Monthly / Yearly), figures, renewal line, terms |
| Foot buttons | **Cancel**, **Next** | **Back**, **Start my club** / **Continue to checkout** |
| Foot sentence | what is missing, or "The charge and terms come next." | "Charged to the payment method you already use." / "Next, you add a payment method on our secure payment page." |

- The kit's own step bar (`progress`) and step line (`identity`), worded as New tournament's ("Step 1 of 3 · The tournament").
- **Next is absent, not greyed** until the name and the address pass their checks; the foot says what is missing (the name's
  shipped sentence, then the first line the address check refuses). A held address (US closed, Québec) never gets a Next; the
  foot says why, in amber.
- A changed country or province still loads the charge again (2026-11-05 ruling, unchanged), now in the background while the
  buyer is on step 1; step 2 shows "Loading the charge…" if it has not arrived. A charge that changed on the press still shows
  the server's sentence and asks for a second press.
- **Back never wipes** — all state lives in the window, not in a step.
- Plain plan moves (rep-team bands) are untouched: one window, no step bar, no Next.

## Words
`PLAN_BILLING_WORDS.clubUpgrade`: `stepLine`, `next`, `back`, `nextFoot`, `readClub`, `readAddress` (new). No existing
sentence changed.

## Tests changed
`plan-billing-actions.test.ts` (Start your club: Next absent without a name, Next → step 2, Back keeps the name, the toggle on
step 2, the address-error foot), `gst-hst-6-4-renewal-reminder.test.ts` (the form-shown guard), and the UAT scenario
`premium-to-club-path.spec.ts` (Next before Start / checkout; the empty-name refusal became "Next is absent").

## Open
- ~~Walk: owner on desktop and phone~~ **Walked by the owner 2026-11-16** inside the walk he was already running that day; closed on
  his word ("I already walked this earlier, it was part of the walk I was already walking, close it"). No defect reported. No
  separate ledger section.
- ~~`/review` still owed~~ **`/review` RUN 2026-11-17** on commit `643816aba` (high-risk tier: money and Terms acceptance): no Critical, High or Medium finding. Confirmed from the code: the paid button and the Terms line sit together on step 2 only; a quote older than the typed country and province cannot be paid (the paid button waits and the server re-checks the charge); every refusal lands on step 1's fields or on its own door, none dead-ends; Back and Change keep what was typed. One advisory, left as is: Next shows while the quote is still loading (step 2 then waits, paid button disabled). Not run: the updated UAT scenario (needs a live fixture), `check:layout` (no dev server up), the full `verify:changed` suite. Typecheck shows only the two known `layout-run-journal` errors. Heads-up: `gst-hst-6-4-renewal-reminder.test.ts` "the address form shows the notice under Province when Québec is chosen" is red in the working tree because another session's uncommitted edit to `BillingAddressFields.tsx` changed the markup it matches (not this commit). `/docs` (help articles that describe the window) **moved into Plan & billing Stage 5**, the one help pass
  (`PLAN_AND_BILLING_STAGE5_BUILD_PROMPT.md`).
- Pre-existing, not from this change: the workspace-flip census (three unlisted files), the css-selector check
  (platform-admin record.module), the admin old-look/type baselines, a type error in `layout-run-journal.test.ts`.
