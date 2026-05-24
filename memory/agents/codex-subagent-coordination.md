# Codex Sub-Agent Coordination

## Purpose

Use this playbook when Codex coordinates multiple reviewers for FieldLogicHQ work. It keeps Codex sub-agents aligned with the shared Claude/Codex agent guidance without turning every review into a noisy committee.

## Parent Agent Responsibilities

The parent Codex agent owns:

- The user conversation, scope, and final recommendations.
- Loading project rules from `AGENTS.md`, `AGENCY_RULES.md`, and relevant memory.
- Deciding which sub-agents are useful.
- Preventing overlapping write scopes.
- Synthesizing design and UX findings into one prioritized action plan.
- Updating `TODO.md`, memory, trackers, and plan docs when needed.

## When To Spawn

Spawn sub-agents only when the user asks for sub-agents, delegation, parallel review, or a design/UX agent style review.

Good fits:

- A Design Review sub-agent can inspect visual consistency while the parent maps routes and data.
- A UX Flow sub-agent can inspect task states while the parent checks subscription rules.
- Separate explorers can answer bounded codebase questions, such as "where is the mobile bottom nav defined?"

Poor fits:

- The immediate blocking step on the critical path.
- Broad, vague reviews with no page, role, or scenario.
- Work where two agents would edit the same files.

## Standard Review Pair

For a mobile tournament-owner review, use this split:

| Reviewer | Reads | Owns | Does not do |
|---|---|---|---|
| Design Review | `memory/agents/design-review-agent.md`, relevant pages/CSS/screenshots | Visual hierarchy, responsive layout, touch targets, token consistency | Flow completeness or entitlement policy |
| UX Flow Review | `memory/agents/ux-flow-agent.md`, relevant pages/routes/API behavior | Happy/empty/loading/error/recovery states, role and plan access | Styling or token choice |
| Parent Codex | Both outputs plus local code context | Final synthesis, priority, implementation plan, docs | Duplicating sub-agent work without reason |

## Spawn Prompt Template

Use a concise prompt like this:

```text
You are the FieldLogicHQ [Design Review/UX Flow] reviewer for this task.
Read [shared guidance file] first and follow it.
Scenario: [role, plan, device, page/flow].
Return findings only in the shared review format.
Do not edit files, TODO, memory, or trackers.
Focus on [bounded routes/files].
```

If implementation is delegated, assign an explicit disjoint file scope and remind the worker that other agents may be editing nearby files.

## Output Contract

Sub-agent findings should include:

- Route or file reference.
- Severity.
- User impact.
- Specific recommended fix.
- Whether the issue is design-owned, UX-owned, or needs product confirmation.

The parent agent should combine duplicates, resolve conflicts, and present one practical path forward.

## Memory And Tracker Writes

Only one agent should edit shared docs during a task. By default, that is the parent Codex agent.

Sub-agents may propose:

- Design decisions for `memory/design_decisions.md`.
- UX findings for review trackers.
- TODO entries.

They should not write those files unless explicitly assigned.
