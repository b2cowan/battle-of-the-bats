# Workspace Agency Rules

These rules apply to all AI coding assistants working in this repository.

## Platform context

**FieldLogicHQ** is a multi-tenant sports club and league management platform for Canadian sports organizations. Each org gets an isolated space at `/{orgSlug}/`. The platform is modular (tournaments, house league, rep teams, accounting, public site) and billed on a four-tier SaaS model (Tournament / Tournament Plus / League / Club). See `README.md` for full context.

## Workflow Requirements
- **Planning First**: For every request, the agent must provide an **Implementation Plan** and/or **Task List** of items being reviewed and actioned before proceeding with significant changes.
- **Product Manager UX Plan (required)**: Before implementing any feature, the agent MUST present a plain-language UX summary in the conversation — written for a product manager, not an engineer. This summary must describe what the user sees and does differently after the change, the benefits, and any role-based access differences. This is a blocking step: no code changes may begin until this summary has been presented.
- **PM Briefs for Plans (required)**: Whenever an agent creates or updates a dedicated implementation plan for a significant feature, phase, or project, it MUST also create or update a short product-manager brief. The PM brief should be plain-language, outcome-focused, and cover proposed functionality, why it matters, expected customer impact, priority, and success criteria.
- **Verification**: The user is responsible for performing all **browser-based testing** and visual verification unless explicitly asked otherwise. This is intended to minimize model token usage and browser tool execution.
- **Documentation**: Maintain project memory via the Claude auto-memory system (`memory/MEMORY.md` index + per-topic files in `memory/`). This is the living record of project state and technical decisions.
- **Task Tracking**: Agents MUST update the `TODO.md` file in the root directory. Mark items as completed `[x]` and move them to the `✅ Completed Tasks` section once verified.

## Documentation Structure

All planning and reference documentation must follow this two-tier structure:

### `TODO.md` — High-level task list only
- One line per task (or a small nested group for closely related sub-items)
- Links to the relevant detailed plan file for full implementation notes
- No file paths, SQL, code blocks, or step-by-step instructions
- Example entry: `- [ ] **Item 1** — Generalized design token refactor (see DESIGN_SYSTEM_PLAN.md)`

### Dedicated plan files — Full implementation detail
- Every significant feature or phase gets its own `.md` file in the repo root
- Contains: goals, task checklists with file paths, SQL snippets, architectural decisions, build order
- Named descriptively: `MULTI_TENANT_ARCHITECTURE.md`, `DESIGN_SYSTEM_PLAN.md`, etc.
- Existing examples to follow: `MULTI_TENANT_ARCHITECTURE.md`, `DESIGN_SYSTEM_PLAN.md`

When an agent is asked to write up an implementation plan, it must create a new dedicated file and add only a summary line to `TODO.md` that links to it.

## Branch and Deployment Policy
- **CRITICAL**: All commits go to the `dev` branch by default. Never commit or push to `master` unless the user explicitly requests a deployment.
- `dev` → active development branch (default for all AI-generated commits)
- `master` → production branch, triggers Amplify CI/CD deploy. Only push when user says so.
- If the current branch is `master` when starting work, ask the user to confirm before committing there.

## Technical Context
- Refer to `AGENTS.md` for Next.js specific version rules.
- Refer to `memory/MEMORY.md` (index) and per-topic files in `memory/` for current project state and data models.
