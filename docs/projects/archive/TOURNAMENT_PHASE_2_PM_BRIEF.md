# Tournament Signup Experience - Phase 2 PM Brief

Status: Implemented; pending browser verification
Date: 2026-05-13
Audience: Product management, design, and implementation planning

## Summary

Phase 2 focuses on making the first tournament setup experience feel guided, flexible, and production-ready for a new organization. Phase 1 removed the most trust-damaging issues: broken links, public draft exposure, premature registration, demo copy, and visible test tools. Phase 2 should now improve the organizer's first successful workflow: create a tournament, configure the right divisions, avoid URL mistakes, and know exactly what to do next.

The goal is to reduce setup uncertainty and make FieldLogicHQ feel like a polished SaaS product rather than an adapted internal tournament tool.

## Proposed Functionality Changes

### 1. Add Tournament Setup Presets

Replace the current fixed youth-division assumptions with selectable setup presets.

Recommended presets:
- Youth tournament: U9, U11, U13, U15, U17, U19
- Adult tournament: Open, Competitive, Recreational
- Custom tournament: organizer enters division names manually

Why it matters:
Different organizations run different sports, age structures, and competitive formats. Presets let common users move quickly while still giving non-youth or non-softball organizers confidence that the product fits them too.

### 2. Improve Division And Pool Setup

Make division configuration clearer by separating basic division setup from optional pool setup. Pools should feel like an advanced option, not something every organizer needs to understand immediately.

Recommended changes:
- Keep "Use Pools" off by default.
- Only show pool count and pool names after pools are enabled.
- Explain that pools are optional and used for grouping teams inside a division.
- Allow simple division creation without touching pool controls.

Why it matters:
Pools are useful for larger tournaments, but they add mental load during first setup. A simple default path helps smaller organizers create a tournament without worrying they are configuring the structure incorrectly.

### 3. Validate Tournament Slugs Before Creation

Add friendly validation for tournament public URL slugs before the organizer submits the form.

Recommended changes:
- Check whether the slug is available within the organization.
- Show inline feedback such as "URL available" or "This URL is already in use."
- Add server-side uniqueness protection so duplicate public URLs cannot be created accidentally.

Why it matters:
The tournament slug becomes part of the public registration and schedule URL. Duplicate or invalid slugs can make a tournament hard to share or unreachable. This is a small technical fix with high trust value.

### 4. Add A Setup-Oriented Success State

After a tournament is created, show a clear next-step screen instead of simply closing the modal or returning to the table.

Recommended next actions:
- Add or review divisions
- Add diamonds/venues
- Add contacts
- Preview public page
- Activate tournament when ready

Why it matters:
Creating the tournament is only the first step. A success state can guide the organizer through the rest of the launch checklist and reduce abandonment or confusion after the first save.

### 5. Make Onboarding Tournament-First

Adjust onboarding so a solo tournament organizer can complete onboarding after creating their first tournament. Inviting staff should remain recommended but should not block progress.

Recommended changes:
- Treat first tournament creation as the primary completion event for the free Tournament plan.
- Keep "Invite team member" as an optional/recommended task.
- Route the organizer toward tournament setup before broader admin tasks.

Why it matters:
Many tournament directors start alone. Blocking completion on inviting another person creates unnecessary friction and can make the app feel misaligned with how small organizations actually operate.

## Expected Customer Impact

Phase 2 should make the first 10 minutes after signup feel much more confident. A new organizer should understand what they are setting up, why each field matters, and what step comes next.

Expected outcomes:
- Faster first tournament creation
- Fewer setup mistakes around divisions, pools, and public URLs
- Better fit for non-demo, non-softball, and adult tournament customers
- Clearer path from signup to launch-ready tournament
- Higher confidence before activating registration

## Product Priority

Recommended priority: High

Phase 2 does not require a full redesign, but it addresses the core activation moment for a new customer. If the first tournament setup feels easy and trustworthy, the organizer is more likely to continue into registration, scheduling, and paid expansion.

## Success Criteria

Phase 2 is successful when:
- A new organizer can create a tournament without seeing demo-specific assumptions.
- The organizer can choose an appropriate division setup path.
- Pools are optional and do not confuse simple tournaments.
- Duplicate tournament URLs are blocked with a clear message.
- After creation, the organizer sees obvious next steps toward launch.
- A solo organizer can complete onboarding without inviting another user.
