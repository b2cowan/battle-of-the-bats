# Tournament Plus Repeat-Event Setup V2 PM Brief

## Proposed Functionality

Improve the existing Tournament Plus cloning feature into a polished repeat-event setup workflow.

Organizers will be able to start a new tournament from a previous one, choose what setup to reuse, understand what will not copy, and land in a draft with clear next steps.

## Why It Matters

The strongest Tournament Plus promise is not just more features. It is that returning organizers do not need to rebuild the same tournament every season.

Many tournament directors repeat the same work each year: divisions, venues, rules, registration questions, fee setup, public page settings, and branding. Tournament Plus should preserve that work and turn next year's setup into review-and-adjust instead of start-over.

## Customer Impact

Returning tournament organizers save meaningful setup time.

New drafts are safer because teams, scores, registrations, payments, uploaded files, and stale schedules are not copied accidentally.

The workflow also reinforces why Tournament Plus is worth keeping after an event ends: the completed tournament becomes the starting point for the next one.

## Priority

High for Tournament Plus product positioning.

This is the clearest paid value story for organizations that run annual or recurring events, and it connects naturally to post-event retention.

## Success Criteria

- A Plus organizer can start the next tournament from a completed prior event in a few clear steps.
- The UI clearly explains what copies and what never copies.
- The cloned tournament opens as a draft with next-step links to review setup before activation.
- Free Tournament users see a concise Tournament Plus prompt instead of a confusing disabled clone action.
- Analytics can tell which repeat-event entry points are used and whether clones are completed.

## Progress Note - 2026-05-29

The first visible slice is implemented on the post-event Summary page. Tournament Plus users now see a "Reuse this setup" action, complete a simple draft form, review what carries forward and what never copies, and land on a draft-created screen with review links.

Remaining V2 work should extend the same language and clarity into the new tournament wizard, tournament list, and dashboard entry points.

## Progress Note - Setup Wizard Slice

The New Tournament setup wizard now uses the same repeat-event framing. Organizers can choose "Reuse a previous tournament setup," pick a completed/recent source, review carried-forward and never-copied sections, and create a draft without seeing clone-oriented language. The Manage Tournaments completion modal now recognizes reused setup drafts and gives a review checklist.

Remaining V2 work should focus on tournament list/dashboard entry points, configurable copy options, analytics metadata, and help copy.

## Progress Note - Draft Dashboard Slice

The draft dashboard now gives returning organizers a simple "Reuse setup from a previous tournament" prompt when other tournaments exist. Plus users choose a source tournament, confirm what carries forward and what is never copied, and see a completion state with copied counts and a reminder to review setup before publishing. Free users see a Tournament Plus upgrade action instead of an inactive clone control.

Remaining V2 work should focus on the tournament-list entry point, configurable copy options, analytics metadata, stale-source warnings, and help copy.

## Progress Note - Tournament List Slice

Manage Tournaments now includes a row-level "Reuse setup" action for eligible non-archived tournaments. Plus users jump directly into the reused-setup draft flow with that source preselected; Free users see a clear "Reuse with Plus" upgrade action instead of a dead control.

Remaining V2 work should focus on configurable copy options, analytics metadata, stale-source warnings, and help copy.

## Progress Note - Configurable Copy Options

The reused-setup draft flow now lets Plus users choose which setup areas to bring forward before creating the draft. Safe defaults remain selected, and organizers can turn off event structure, locations, registration setup, public presence, or content. The selected groups are passed through to the existing clone API flags.

Remaining V2 work should focus on analytics metadata, stale-source warnings, help copy, and browser review of the responsive option layout.

## Progress Note - Stale-Source Guidance

The reused-setup confirmation now shows a "Review before publishing" advisory panel when the source tournament is older, still draft/active, or selected copy groups such as registration/public content deserve a second look. This keeps reuse fast while making the review responsibilities explicit before activation.

Remaining V2 work should focus on analytics metadata, help copy, and browser review of the responsive option layout.

## Progress Note - Analytics Metadata

Repeat-event setup attempts and completions now include richer product analytics metadata: source surface, source tournament status/year, target year, selected copy groups, warning count, and warning keys. The draft-dashboard populate flow also records the dashboard source surface.

Remaining V2 work should focus on help copy and browser review of the responsive option layout.

## Progress Note - Help Copy Alignment

Tournament help now has a dedicated "Reuse setup for repeat tournaments" topic. It explains where organizers start the workflow, which setup groups can copy, what is never copied, why the result remains a private draft, and what to review before activation. Setup, registration, and closeout help were lightly cross-linked so the repeat-event story appears at the moments where organizers ask those questions.

Remaining V2 work should focus on browser review of the responsive option layout and end-to-end repeat-event flow.

## Out Of Scope

- Public "clone this tournament format" acquisition.
- Reusable template library.
- Copying teams, registrations, scores, games, waitlists, payments, uploaded files, or private notes.
- Online tournament payment collection.

## Related Follow-Ups

Separate high-value Tournament Plus ideas are logged for later:

- Registration Command Center.
- Schedule Generator Quality Report.
- Game-Day Command Center.
- Post-Event Wrap V2.
