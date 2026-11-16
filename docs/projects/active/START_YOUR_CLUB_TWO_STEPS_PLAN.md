# Start your club in two steps — plan

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
- Walk: owner on desktop and phone (see the PM brief's "How to try it").
- `/review`, `/docs` (help articles that describe the window) offered at handoff.
- Pre-existing, not from this change: the workspace-flip census (three unlisted files), the css-selector check
  (platform-admin record.module), the admin old-look/type baselines, a type error in `layout-run-journal.test.ts`.
