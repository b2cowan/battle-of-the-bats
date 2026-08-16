# Workspace Agency Rules

These rules apply to all AI coding assistants working in this repository.

## Platform context

**FieldLogicHQ** is a multi-tenant sports club and league management platform for Canadian sports organizations. Each org gets an isolated space at `/{orgSlug}/`. The platform is modular (tournaments, house league, rep teams, accounting, public site) and billed on a four-tier SaaS model (Tournament / Tournament Plus / League / Club). See `README.md` for full context.

## Workflow Requirements
- **Disagree out loud, by default (owner, 2026-08-16).** If you think a request, plan, or premise is
  wrong, **say so before doing the work** — not in the summary afterwards, where a concern becomes a
  defence rather than feedback. The owner uses these sessions to pressure-test his own thinking; an
  agreeable answer he cannot trust is worth less than a disagreement he can argue with.
  - **Argue from what the code does**, never from what a plan claims it does. Plans in this repo have
    been wrong repeatedly, including an audit row that would have led to building the exact opposite
    of a standing owner ruling.
  - **Re-frame a wrong question rather than answering it.** The highest-value push-back is usually
    "you're being asked the wrong thing", not "your answer is wrong" — a settled ruling has been
    presented as an open question here, and answering it as asked would have reversed it by accident.
  - ⚠⚠ **Widen the question when the evidence is wider than the ask.** The expensive miss is
    answering a narrow question the evidence does not limit you to. Asked *"who should see the
    multi-season history?"*, the honest answer was *"that isn't the problem — removing a coach
    doesn't remove them, so an ex-coach still reads everything."*
  - **Do not manufacture disagreement.** When the direction is right, say so plainly and name where
    the risk actually sits. Inventing objections to appear rigorous is the opposite of this rule.
- **Planning First**: For every request, the agent must provide an **Implementation Plan** and/or **Task List** of items being reviewed and actioned before proceeding with significant changes.
- **Product Manager UX Plan (required)**: Before implementing any feature, the agent MUST present a plain-language UX summary in the conversation — written for a product manager, not an engineer. This summary must describe what the user sees and does differently after the change, the benefits, and any role-based access differences. This is a blocking step: no code changes may begin until this summary has been presented.
- **PM Briefs for Plans (required)**: Whenever an agent creates or updates a dedicated implementation plan for a significant feature, phase, or project, it MUST also create or update a short product-manager brief. The PM brief should be plain-language, outcome-focused, and cover proposed functionality, why it matters, expected customer impact, priority, and success criteria.
- **Verification**: The user is responsible for performing all **browser-based testing** and visual verification unless explicitly asked otherwise. This is intended to minimize model token usage and browser tool execution.
- **Resource-aware static checks**: During routine coding, prefer focused validation (`npm run verify:changed` or `npm run lint:focused -- <file...>`) over repeated full-project lint/typecheck sweeps. Run `npm run typecheck` when changes touch shared modules, route/auth/proxy/config behavior, API/data contracts, or broad refactors. Run expensive checks serially, stop checks that appear hung or dangerously resource-heavy, and report any skipped verification plus residual risk. See `docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md` and `memory/agent-verification-workflow.md`.
- **Documentation**: Two memory stores exist — do not conflate them. The **Claude auto-memory** lives OUTSIDE the repo (a per-user store, loaded automatically into Claude Code sessions) and is the living record Claude maintains. The **in-repo `memory/` directory** is the cross-assistant store read by other AI tools; any write there must update `memory/MEMORY.md` in the same change (that index has drifted months behind its own files before).
- **Task Tracking**: Agents MUST update the `TODO.md` file in the root directory. Mark items as completed `[x]` and move them to the `✅ Completed Tasks` section once verified.
- **Status wording (anti-drift)**: In TODO.md, plan headers, ledgers, and memory, never record a deliverable's state as a perishable negative — "uncommitted", "NOT on prod", "DEV-ONLY" go stale silently the moment another session ships (the 2026-08-10 audit found ~25 such claims, all false). Record the positive fact with its anchor instead: "committed `<hash>` <date>", "applied to prod <date> (job N)". Deployment state has one home — the release-history record and the Owner QA Ledger; other docs point there rather than restating it. After every production promote, run the post-release truth-up checklist in `.claude/commands/release.md` (Phase 2b).

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
- Exception — **living program documents**: `OWNER_QA_LEDGER.md` and the `PROGRAM_*.md` module ledgers live in `active/` with no end date; they follow the `docs/agents/` rules instead (evolve in place, never archived, no PLAN/PM-brief pairing).

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
- **CRITICAL — ONE SHARED BRANCH: `dev`.** Every chat / agent works on the **`dev`** branch. Do **not** create per-initiative or per-feature branches; do **not** start work on `fix/*`, `feat/*`, or any other branch. This is a deliberate change (2026-06-15) to stop concurrent agents colliding across divergent branches. If you find yourself on any branch other than `dev` when starting or resuming work, switch to `dev` first (`git checkout dev`) before committing.
- `dev` → the single active development branch for ALL AI-generated commits.
- `master` → production branch, triggers Amplify CI/CD deploy. **Never** commit or push to `master` unless the user explicitly requests a deployment. If the current branch is `master` when starting work, switch to `dev`.
- **Concurrent-work safety (multiple agents share this one working copy):**
  - Another agent may switch the branch or leave files staged/modified mid-session. Re-check `git rev-parse --abbrev-ref HEAD` before committing — if it's not `dev`, switch back.
  - Stage **explicit pathspecs only** — never `git add -A`/`git add .`. After every commit, run `git show --stat HEAD` and confirm only your files landed; if foreign files slipped in, `git reset --soft HEAD~1` + `git restore --staged <file>` and re-commit.
  - `<system-reminder>` file snapshots can be **stale** (showing pre-edit content). Verify actual file state from `git show <ref>:<path>` or a fresh Read before reacting — do not assume a reminder reflects the committed truth.

## Technical Context
- Refer to `AGENTS.md` for Next.js specific version rules.
- Refer to `memory/MEMORY.md` (index) and per-topic files in `memory/` for current project state and data models.
- **Schema = dictionary, same unit of work.** Any migration or field-meaning change must update `docs/agents/db/DATA_DICTIONARY.md` and refresh the dev+prod snapshots (`npm run refresh:snapshots`). Decide whether a column exists from those snapshots / live `information_schema` — **never** from migration files (they mislead in a drifted DB). `npm run check:dictionary` (part of `npm run verify:changed`) fails when a schema change isn't reflected in the dictionary.
