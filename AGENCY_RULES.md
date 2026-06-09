# Workspace Agency Rules

These rules apply to all AI coding assistants working in this repository.

## Platform context

**FieldLogicHQ** is a multi-tenant sports club and league management platform for Canadian sports organizations. Each org gets an isolated space at `/{orgSlug}/`. The platform is modular (tournaments, house league, rep teams, accounting, public site) and billed on a four-tier SaaS model (Tournament / Tournament Plus / League / Club). See `README.md` for full context.

## Workflow Requirements
- **Planning First**: For every request, the agent must provide an **Implementation Plan** and/or **Task List** of items being reviewed and actioned before proceeding with significant changes.
- **Product Manager UX Plan (required)**: Before implementing any feature, the agent MUST present a plain-language UX summary in the conversation — written for a product manager, not an engineer. This summary must describe what the user sees and does differently after the change, the benefits, and any role-based access differences. This is a blocking step: no code changes may begin until this summary has been presented.
- **PM Briefs for Plans (required)**: Whenever an agent creates or updates a dedicated implementation plan for a significant feature, phase, or project, it MUST also create or update a short product-manager brief. The PM brief should be plain-language, outcome-focused, and cover proposed functionality, why it matters, expected customer impact, priority, and success criteria.
- **Verification**: The user is responsible for performing all **browser-based testing** and visual verification unless explicitly asked otherwise. This is intended to minimize model token usage and browser tool execution.
- **Resource-aware static checks**: During routine coding, prefer focused validation (`npm run verify:changed` or `npm run lint:focused -- <file...>`) over repeated full-project lint/typecheck sweeps. Run `npm run typecheck` when changes touch shared modules, route/auth/proxy/config behavior, API/data contracts, or broad refactors. Run expensive checks serially, stop checks that appear hung or dangerously resource-heavy, and report any skipped verification plus residual risk. See `docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md` and `memory/agent-verification-workflow.md`.
- **Documentation**: Maintain project memory via the Claude auto-memory system (`memory/MEMORY.md` index + per-topic files in `memory/`). This is the living record of project state and technical decisions.
- **Task Tracking**: Agents MUST update the `TODO.md` file in the root directory. Mark items as completed `[x]` and move them to the `✅ Completed Tasks` section once verified.

## Documentation Structure

All planning and reference documentation follows a three-tier structure:

### `TODO.md` — High-level task list only
- One line per task (or a small nested group for closely related sub-items)
- Links to the relevant detailed plan file for full implementation notes
- No file paths, SQL, code blocks, or step-by-step instructions
- Example entry: `- [ ] **Item 1** — Generalized design token refactor (see docs/projects/active/DESIGN_SYSTEM_PLAN.md)`

### `docs/projects/` — Project plans with a lifespan
- `docs/projects/active/` — plans for features currently in flight
- `docs/projects/archive/` — completed or cancelled project plans
- Every significant feature gets its own `_PLAN.md` + `_PM_BRIEF.md` pair in `docs/projects/active/`
- When a project completes and is verified, move both files: `Move-Item docs/projects/active/X.md docs/projects/archive/X.md`
- TODO.md links should always point to the current location

### `docs/agents/` — Living reference documents (never archived)
- Per-agent subdirectories: `brand/`, `design/`, `db/`, `ops/`
- These hold the canonical reference documents each agent loads on activation
- **Do NOT move these to archive** — they evolve in place, they have no end date
- When creating new reference content for an agent, write it to the agent's subfolder
- `docs/agents/brand/` → `/marketing` agent (brand strategy, copy canon, pricing copy)
- `docs/agents/design/` → `/design` agent (design reviews, visual guidelines)
- `docs/agents/db/` → `/db` + `/dba` agents (architecture review, schema snapshots, SQL utilities)
- `docs/agents/ops/` → `/release` + dev ops reference (setup guides, runbooks)

When an agent is asked to write up an implementation plan, it must create a new dedicated file at `docs/projects/active/<PLAN_NAME>.md` and add only a summary line to `TODO.md` that links to it.

## Branch and Deployment Policy
- **CRITICAL**: All commits go to the `dev` branch by default. Never commit or push to `master` unless the user explicitly requests a deployment.
- `dev` → active development branch (default for all AI-generated commits)
- `master` → production branch, triggers Amplify CI/CD deploy. Only push when user says so.
- If the current branch is `master` when starting work, ask the user to confirm before committing there.

## Technical Context
- Refer to `AGENTS.md` for Next.js specific version rules.
- Refer to `memory/MEMORY.md` (index) and per-topic files in `memory/` for current project state and data models.
- **Schema = dictionary, same unit of work.** Any migration or field-meaning change must update `docs/agents/db/DATA_DICTIONARY.md` and refresh the dev+prod snapshots (`npm run refresh:snapshots`). Decide whether a column exists from those snapshots / live `information_schema` — **never** from migration files (they mislead in a drifted DB). `npm run check:dictionary` (part of `npm run verify:changed`) fails when a schema change isn't reflected in the dictionary.
