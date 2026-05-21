# Tournament Admin UX Reformat PM Brief

## Proposed Functionality

Clean up tournament admin pages so each page leads with the user's actual work: registrations, games, scores, messages, settings, or tournament records. Secondary tools will move into compact toolbars, overflow menus, drawers, popovers, or contextual action bars.

The work will be delivered one page at a time, starting with Registrations, after a small shared UI foundation is created for consistency.

## Why It Matters

Tournament organizers use these pages under time pressure. The current Registrations page now makes users scroll past buttons, headers, explanations, payment upsells, and bulk controls before seeing the first registrant. That creates friction, especially on mobile.

This effort protects the value of new Tournament Plus features by presenting them as helpful tools instead of visual clutter.

## Customer Impact

- Faster access to the records admins came to manage.
- Better mobile usability for on-site tournament work.
- More consistent admin navigation across tournament pages.
- Less frustration from plan-gated features occupying prime screen space.
- Clearer workflows for bulk actions, payment tools, schedule tools, and communication targeting.

## Priority

High. Registrations should be treated as the first implementation phase after shared primitives because it has the most visible regression and is central to tournament operations.

## Role and Access Differences

This project is a layout and workflow cleanup. It should not change role permissions, module access, or plan entitlements.

Owners and tournament staff should keep the same capabilities they have today. Tournament Plus tools remain plan-gated, but their locked states become more compact and less disruptive.

## Success Criteria

- On Registrations, the first team or slot is visible without scrolling on a normal laptop viewport.
- On mobile, core list content appears after a compact header and toolbar, not after several stacked panels.
- Bulk actions appear only after selecting records.
- Premium upsells are compact and contextual.
- Schedule and Results use the same toolbar language as Registrations.
- Supporting tournament admin pages use consistent header/action placement.

## Release Strategy

Ship in small phases. Each page should be independently reviewable and should preserve its current behavior while improving layout. Start with the shared toolbar/action primitives, then apply them to Registrations, Schedule, Results, and the remaining affected pages.

