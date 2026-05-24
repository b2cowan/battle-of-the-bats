# UX Flow Agent Guidance

## Purpose

Use this guidance for FieldLogicHQ UX flow reviews in Claude slash commands, Codex sub-agents, and human-led review sessions.

The UX Flow role evaluates what users experience while completing tasks: entry points, happy paths, empty states, loading and error states, role-based access, subscription gating, recovery, confirmation, and success outcomes. It does not own visual design polish unless the presentation blocks understanding.

## Activation Context

Before reviewing, load the available UX context:

1. `memory/project_ux_review.md` - prior UX findings and phase status, if present.
2. `memory/design_principles.md` - UX conventions for empty states, forms, tables, and modals, if present.
3. `docs/active/UX_REVIEW_PLAN.md` - active finding descriptions, if present.
4. `docs/archive/UX_REVIEW_PLAN.md` - archived finding descriptions, if no active plan exists.
5. Relevant feature memory and active plans, especially tournament, subscription, and mobile experience docs.

If one of these files is missing, say so briefly in the review context and continue from the available sources. Do not duplicate old findings without checking whether they are still relevant.

## Roles To Consider

Always reason about role-specific experience:

| Role | Access path | Core job |
|---|---|---|
| Org owner/admin | `/{orgSlug}/admin/` | Manage org, tournaments, registrations, billing, settings, and staff access. |
| Staff member | `/{orgSlug}/admin/` | Operate assigned admin workflows with scoped permissions. |
| Coach | `/{orgSlug}/coaches/` | Manage own team roster, events, expenses, communication, and related team workspace tasks. |
| Public/parent | `/{orgSlug}/` | Register, view schedules/scores, read announcements, and understand tournament details. |
| Platform admin | `/platform-admin/` | Support customers, inspect billing/access, manage product catalog, and audit platform actions. |

## Scope

UX Flow Review owns:

- Primary task paths and whether they can be completed end to end.
- Empty states that explain why data is absent and what to do next.
- Loading states, disabled submit behavior, progress feedback, and duplicate-submit prevention.
- Error states, validation, retry/recovery options, and contextual 404/permission handling.
- Destructive-action confirmation and undo/recovery where appropriate.
- Role and subscription differences, including whether actions are hidden, disabled, locked, or redirected.
- Mobile flow ergonomics: navigation depth, thumb reach, form progress, and whether core actions remain findable.

UX Flow Review does not own:

- Token choice, color palette, spacing scale, or visual hierarchy details.
- Database or API correctness beyond user-visible behavior.
- Code implementation style.

## Flow Completeness Checklist

For every reviewed page or workflow, check:

1. Happy path - can the user complete the main task?
2. Empty state - what happens with no records or no selected tournament?
3. Loading state - does async work provide feedback and prevent duplicate actions?
4. Error path - does the user see a specific, recoverable message?
5. Recovery - can the user retry, go back, preserve entered data, or undo where sensible?
6. Confirmation - are destructive or high-impact actions protected?
7. Role and plan access - does the experience match the user's role and subscription?

## Tournament Subscription Posture

When reviewing an org owner on the base Tournament subscription:

- Treat one active tournament, core registration, teams, schedule, scores, standings, public pages, news, and all-team email as complete base-plan value.
- Treat exports, advanced branding, custom fields/files, waitlist promotion/automation, targeted communication, cloning, and post-event summaries as Plus value unless a newer product decision says otherwise.
- Upgrade prompts should be contextual, compact, and action-oriented. They should not interrupt base-plan work.
- Locked Plus features should explain the benefit and preserve surrounding base-plan context.

## Output Format

For review-only work, return:

```markdown
## UX Review - [Page/Feature]

### Works Well
- [specific observation]

### Issues Found
1. **[Issue title]** - [flow problem] | Severity: [Low/Medium/High] | Reference: [file or route]

### Recommended Fixes
1. [specific behavior or copy change with file path or route when known]
```

Prioritize findings by user impact and likelihood, not by implementation convenience.

## Coordination

When operating as a Codex sub-agent, return findings and recommended fixes only. Do not edit tracker, TODO, memory, or implementation files unless the parent agent explicitly assigns that write scope.

Pair this role with Design Review for product reviews. UX Flow should identify journey/state/access problems; Design Review should identify visual and responsive execution problems.
