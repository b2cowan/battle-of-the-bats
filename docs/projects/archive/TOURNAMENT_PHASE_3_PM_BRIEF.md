# Tournament Signup Experience - Phase 3 PM Brief

Status: Implemented; pending browser verification
Date: 2026-05-13
Audience: Product management, design, and implementation planning

## Summary

Phase 3 focuses on the public tournament experience: the page that organizers share with teams, coaches, and families after setup. Phase 1 made the flow safer and more credible. Phase 2 made first tournament setup easier. Phase 3 should make the shared tournament page clearer, more action-oriented, and better at converting visitors into registrations.

The goal is to help organizers confidently publish a tournament and give visitors an obvious answer to: "Can I register, and what do I do next?"

## Proposed Functionality Changes

### 1. Improve Public Registration CTA Logic

Make the public tournament hero show the right primary action based on registration availability.

Recommended states:
- Active tournament with open divisions: "Register Team"
- Active tournament with all divisions full or closed: "Registration Closed" or "Join Waitlist" if waitlist is supported
- Draft tournament: not publicly visible
- Completed tournament: "View Results" or "View Schedule" instead of registration

Why it matters:
The public page is often the first thing coaches see. The primary CTA should match what they can actually do. This reduces confusion and prevents organizers from receiving questions that the page could answer directly.

### 2. Add Registration Availability Messaging

Add clear public-facing registration status near the hero or registration section.

Recommended messages:
- "Registration is open"
- "Registration opens soon"
- "Registration is closed"
- "Some divisions are full"
- "Contact the organizer for availability"

Why it matters:
Tournament registration is time-sensitive. Coaches need to know whether they can still enter a team before investing time in the form or contacting the organizer.

### 3. Prompt For Contact Email Before Activation

Before a tournament is activated, make sure the organizer has a usable public contact email at the tournament or organization level.

Recommended behavior:
- Show a warning or checklist item if no contact email is configured.
- Allow the organizer to add the email from the activation flow or tournament settings.
- Use tournament contact email first, then org contact email as fallback.

Why it matters:
Public registration, closed-state messaging, and email footers all need a reliable organizer contact. A missing contact email makes the tournament feel less trustworthy and can route support questions to the wrong person.

### 4. Add A Launch Readiness Checklist

Before activating a tournament, show a short readiness checklist for the organizer.

Recommended checks:
- Tournament name and dates are set
- At least one division exists
- Public contact email is configured
- Registration status is understood
- Public page can be previewed
- Optional: diamonds, rules, and welcome announcement are configured

Why it matters:
Activation changes the tournament from private setup to public-facing registration. A simple checklist helps organizers avoid publishing incomplete pages and gives them confidence that they are ready.

### 5. Add Admin Draft Preview Path

Since draft tournaments are hidden from anonymous users, give admins an explicit way to preview the public tournament experience before activation.

Recommended behavior:
- Add "Preview public page" from tournament setup/status actions.
- Preview should be available only to authenticated org admins.
- Preview should make it visually clear that the tournament is still a draft.

Why it matters:
Organizers need to review the public page before sharing it. Hiding draft pages is correct for safety, but admins still need a preview workflow.

## Expected Customer Impact

Phase 3 should make the publish-and-share moment feel more complete. Organizers should know whether they are ready to go live, and visitors should immediately understand whether registration is open.

Expected outcomes:
- More registrations from shared tournament links
- Fewer support questions about whether registration is open
- Fewer incomplete tournaments published by mistake
- More organizer confidence before activating a tournament
- Better public experience for coaches and families

## Product Priority

Recommended priority: High

This phase affects the externally visible part of the product and the main business outcome for tournament organizers: collecting registrations. It is also a natural continuation after Phase 1 safety fixes and Phase 2 setup improvements.

## Success Criteria

Phase 3 is successful when:
- Public tournament pages show a registration CTA only when registration is actually available.
- Visitors can quickly understand registration status.
- Organizers are warned before activation if required launch information is missing.
- A tournament can be previewed by admins before activation without exposing draft content publicly.
- Public contact email is available before registration is opened.
- Completed tournaments no longer present registration as the primary action.
