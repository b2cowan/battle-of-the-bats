# Public Tournament Mobile Experience PM Brief

## Proposed Functionality

Create a mobile-first public tournament experience for coaches, parents, players, and visitors. The work covers the public home page, registration, schedule, standings/results, teams, rules, news, hidden pages, empty states, and post-event public viewing.

The biggest changes are:

- A compact mobile schedule control bar with a filter bottom sheet.
- A real registration Review step before final submit.
- Consistent hidden and empty states with organizer contact and useful next links.
- A stronger mobile first viewport for public tournament home pages, especially when no Tournament Plus banner is configured.
- A clearer post-event public story for free Tournament and Tournament Plus.

## Why It Matters

Public tournament pages are where coaches, parents, players, and visitors judge whether the event is organized. On mobile, they are often standing at a field, checking a schedule between games, registering quickly, or trying to confirm final results.

The current public surface has the right features, but several mobile patterns are too desktop-like: schedule controls can stack heavily, registration promises a Review step that does not exist, and unavailable states do not always tell visitors what to do next.

This work makes the public experience feel reliable on tournament day.

## Customer Impact

Coaches can register teams with more confidence because they review the division, fee/waitlist information, contact details, custom answers, and payment note before submitting.

Parents and players can find the right schedule faster using division/team filters that fit a phone.

Visitors who land on hidden, unpublished, empty, or completed pages get useful guidance instead of a dead end.

Organizers get fewer support questions because public pages explain registration status, schedule availability, final results, and who to contact.

Tournament Plus customers get stronger premium presentation through branding and post-event polish, while free Tournament remains a complete public event product.

## Priority

High for the public Tournament experience. Admin mobile hardening has already been completed through Phase H, and this is the next natural public-facing quality pass before calling the overall tournament experience excellent on mobile.

## Plan-Tier Positioning

Free Tournament should include:

- FieldLogicHQ default public styling.
- Public home, registration, schedule, standings/results, teams, rules, and news.
- Schedule filters and iCal export.
- Standard registration fields, capacity, waitlist collection, and external payment guidance.
- Clear hidden/empty states and post-event public record.

Tournament Plus should add:

- Custom logo, theme, color mode, card style, and hero/banner image.
- Custom registration questions and file fields.
- Targeted communications and targeted public news behavior where already supported.
- Admin post-event summary/reporting.
- Richer branded post-event presentation.

The free tier should not feel broken or incomplete. Plus should feel more polished, branded, and operationally powerful.

## Success Criteria

- Mobile schedule controls fit cleanly at 390x844 with no horizontal overflow.
- Visitors can filter by division, team, pool/playoff, list/bracket, and export a calendar without stacked control clutter.
- Public registration has a real Info -> Review -> Next Steps flow.
- Hidden and empty pages include organizer contact when available plus useful next links.
- Public tournament home communicates event name, dates/status, host, and primary action in the first mobile viewport.
- Completed tournaments point visitors to final standings/results where available.
- Free and Plus experiences both pass mobile UAT at 375x667, 390x844, and 430x932.

## Recommended Delivery

Deliver in six phases:

1. Shared public unavailable/empty state pattern.
2. Public schedule mobile controls.
3. Registration Review step.
4. Hero first viewport and post-event home story.
5. Page-specific polish and route-specific analytics surfaces.
6. Verification, documentation, and handoff.

The schedule and registration changes should be prioritized because they solve the most direct mobile workflow problems.
