# Registration health becomes a button and a window; the Teams "At a glance" card goes

**Owner ruled 2026-10-21** (six rulings, all as recommended, from the drawings at
https://claude.ai/artifact/Q6WGmAcK1crEAUqfD9ezEo, source `REGISTRATION_HEALTH_WINDOW_MOCKUP.html` in this folder). PM brief:
`REGISTRATION_HEALTH_WINDOW_PM_BRIEF.md`.

## What was ruled

1. The Teams "Registration health" row becomes a **header button** (score in its tone, name, amber issue count) that opens a **window** —
   the Schedule health shape (owner 2026-10-19). It sits first, before Export. On a phone it is the pulse icon with the count on its corner.
2. The window is the product's one wide form window: score with its scale and verdict ("Needs work · 3 issues · every division"), ONE
   joined band of four figures (Teams · Missing email · Payments · Needs action; three when the event does not track payments),
   then every issue with a "Show them" / "Show it" door. No footer, no rules, nothing to save.
3. The **dashboard's Registration card** gets the score as its first row (weeks-before board only, not a sixth card). It opens the same
   window. The score comes from the dashboard route, which scores with the Teams page's own calls.
4. The page stops naming problems in words — the words live in the window; the dashboard's follow-up rows still name them.
5. The **At a glance card is removed**. "Registration open/closed" becomes a **chip beside the division picker** (state in words, a dot,
   the spots) opening the Tools menu's own menu: one sentence and Close / Reopen registration. A plan-ended event keeps the plan's lock
   in the switch's place.
6. **Payments stays, as one slim line** above the team list (only where the payment tools, a tracked event and a division's accepted
   teams exist). It opens in place to today's detail.

## As built (2026-10-21)

- `lib/registration-health.ts`: `buildRegistrationCapacity`, `countRegistrationHealthTeams`, `RegistrationHealthView` — the one calculation
  the Teams page and `/api/admin/tournament-dashboard` both call (the schedule-health "one number" rule; guard in
  `tests/unit/registration-health-window.test.ts`).
- `components/admin/tournament/RegistrationHealthWindow.tsx` (+ module CSS): the window, shared by Teams and the dashboard.
- Teams: `HealthButton` first in the header (the `registration-health` tour anchor rides it), `RegistrationChip`, `PaymentsLine`;
  `TeamsGlance` and `RegistrationHealthPanel` deleted; the dead glance/health CSS removed; `GlanceRow` kept for Payments.
- Words: `REGISTRATION_HEALTH_WORDS`, `REGISTRATION_CHIP_WORDS`, `TEAMS_WORDS.spotsOf` in `lib/registration-words.ts`.
- Help: the Registration health FAQ, the close-registration article and the payments article reworded
  (`lib/help-content/tournaments.tsx`); the walkthrough line says "figure".
- Marketing shot `registration-health` now opens the window (`prepare`); **recapture owed** (the stored picture is the old panel; its
  `size` follows the next capture).

## Checks run

Typecheck clean; targeted guards 147/147 (new guard, toolbar, overlay, schedule-health one-number, payments-tracked, demo destinations,
slide library, club stage 3a); spelling, type, CSS purity, old-look, selectors, tokens and contrast gates green; eslint 0 errors.

## Committed 7c933a270 (2026-10-21)

`/review` (three lenses: Teams logic, the one-number claim, copy and demo drift) found no Critical or High. Fixed before the commit: the
window reopening by itself on both screens, the button showing while selecting or swapping, the toolbar overflowing at tablet width,
days-until-start read in the viewer's zone (now the organization's, one function), and help wording (the Divisions page has no switch).
Left as is, Low: the Teams page drops its registration-question fields when that fetch fails while the route keeps them; a checkbox
answer stored with inconsistent text and JSON reads differently on the two. `/docs` swept the help; the dashboard article now names the row.

## Still owed

- Browser check (owner): desk and phone — button, window, chip menu, Payments line, dashboard row, a filtered jump from the window,
  the toolbar at 700–900 px.
- `/demos` for the tour's "Go back three weeks" step (it relied on the panel arriving open in the sandbox; the window never arrives
  open) and the marketing recapture.
- The dev server needs a restart (new files).
- Phone: the drawing keeps Add team's words and Export as its symbol alone per the standing phone rule; Schedule's header may collapse
  its primary too — not confirmed, worth a look at the browser check.
