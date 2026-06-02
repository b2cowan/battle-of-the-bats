# Registration Command Center V1 Plan

## Scope

Build the Registration Command Center as an enhancement to the existing Teams / Registrations page, plus a dashboard attention panel. Do not add a new page, route, or sidebar item.

## Implementation

1. Add shared registration-attention logic in `lib/registration-attention.ts`.
   - Define the six V1 bucket keys.
   - Compute counts, per-division counts, labels, tones, and Plus-only metadata.
   - Reuse one helper for dashboard API summaries and registrations page filtering.

2. Extend `/api/admin/tournament-dashboard`.
   - Include `registrationAttention` in the response.
   - Use existing teams, divisions, fee schedule, slot IDs, waitlist positions, registration fields, and registration answers.
   - No migration.

3. Update tournament dashboard UI.
   - Normalize existing dashboard team links to `/admin/tournaments/registrations`.
   - Add a compact Registration Attention panel near the existing Registration / Payments panels for active and pre-event states.
   - Link bucket rows to `/admin/tournaments/registrations?attention=<bucket>`.

4. Update Teams / Registrations page UI.
   - Fetch registration field definitions for Plus-capable orgs so required missing intake can be computed.
   - Add a Needs Attention strip above the toolbar.
   - Desktop: bucket cards and active bucket division breakdown.
   - Mobile: summary row opens bottom sheet with bucket and division choices.
   - Query handling applies the closest existing filters and focuses the command center.

5. Preserve existing gates.
   - Free users see basic counts plus Tournament Plus upgrade copy.
   - Plus, League, and Club get actionable buckets.
   - Existing payment reminders, waitlist automation, custom fields, and exports remain authoritative.

## Verification

- `npx.cmd tsc --noEmit --pretty false`
- Focused lint for:
  - `lib/registration-attention.ts`
  - `app/api/admin/tournament-dashboard/route.ts`
  - `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`
  - `app/[orgSlug]/admin/tournaments/registrations/page.tsx`

## Browser Scenarios

- Free Tournament sees educational/upgrade state.
- Plus user sees actionable buckets.
- Dashboard attention links focus the right registrations bucket.
- Mobile Teams page shows a compact row and bottom drawer.
- Missing required text/dropdown/checkbox/file answers appear in Missing Intake.
- Payment buckets respect tournament-level and division-level fee schedules.
- Slot-configured divisions show unplaced accepted teams only when slots exist.

