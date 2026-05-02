# Workspace Agency Rules

These rules apply to all AI coding assistants working in this repository.

## Workflow Requirements
- **Planning First**: For every request, the agent must provide an **Implementation Plan** and/or **Task List** of items being reviewed and actioned before proceeding with significant changes.
- **Verification**: The user is responsible for performing all **browser-based testing** and visual verification unless explicitly asked otherwise. This is intended to minimize model token usage and browser tool execution.
- **Documentation**: Maintain the `memory.md` file as a living record of the project's state, technical decisions, and progress.

## Branch and Deployment Policy
- **CRITICAL**: All commits go to the `dev` branch by default. Never commit or push to `master` unless the user explicitly requests a deployment.
- `dev` → active development branch (default for all AI-generated commits)
- `master` → production branch, triggers Amplify CI/CD deploy. Only push when user says so.
- If the current branch is `master` when starting work, ask the user to confirm before committing there.

## Technical Context
- Refer to `AGENTS.md` for Next.js specific version rules.
- Refer to `memory.md` for current project state and data models.
