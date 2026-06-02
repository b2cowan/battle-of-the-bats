# Registration Command Center V1 PM Brief

## Objective

Make the existing Teams / Registrations page feel like the organizer's daily registration work surface: what needs a decision, what needs money, what is missing intake, and what is not placed yet.

The dashboard should stay a high-level "what needs attention?" surface. It should point organizers into the registrations page with the right bucket focused, not introduce a separate registrations workflow.

## Product Shape

- No new sidebar item in V1.
- The existing Teams / Registrations page remains the command surface.
- The dashboard adds a compact Registration Attention panel near the existing Registration and Payments panels.
- Desktop registrations view shows compact bucket cards and a small division breakdown.
- Mobile registrations view shows a summary row that opens a bottom drawer.

## Plan Behavior

Free Tournament:
- Shows basic pending-review and waitlist attention counts.
- Shows Tournament Plus copy for the richer command center: payment readiness, missing required intake, file collection, placement readiness, and reminder workflows.

Tournament Plus, League, and Club:
- Get actionable attention buckets.
- Bucket actions reuse the current division-first registrations model.
- Reminder, custom field, waitlist automation, and export gates remain governed by the existing feature flags.

## V1 Attention Buckets

- Pending review
- Waitlist
- Unpaid accepted teams
- Past-due accepted teams
- Missing required registration answers or files
- Accepted teams not placed into configured slots

## UX Guardrails

- Keep the Teams page readable. The command center should be a strip, not a second dashboard.
- Do not force an all-division registrations table. If a bucket spans divisions, show division choices.
- Keep mobile compact: one row above the toolbar, drawer only when requested.
- Use existing page context and filters wherever possible.

