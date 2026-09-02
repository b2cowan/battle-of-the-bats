# Agent Verification Workflow

- 2026-06-03: The default AI-agent verification process is resource-aware. Do not run full-project lint and TypeScript checks after every small slice.
- Prefer `npm run verify:changed` for normal iteration. It runs ESLint only against changed JS/TS files discovered from git.
- In a busy/dirty worktree, use `npm run verify:changed -- <file...>` or `npm run lint:focused -- <file...>` for explicit touched-file lint so unrelated user changes are not swept into the check.
- Use `npm run typecheck` for shared modules, route/auth/proxy/config changes, API/data contract changes, broad refactors, and release-style handoffs.
- Run expensive checks serially and avoid running full lint/typecheck/Playwright while the Next.js dev server is actively compiling.
- If a full check hangs, consumes excessive resources, or risks crashing the workstation, stop it and report the skipped verification and residual risk instead of letting it continue indefinitely.
- Browser and visual verification remain user-owned unless explicitly requested.
- 2026-09-01: `verify:changed` gained two gates you can trip without knowing they exist.
  - **`check:css-selectors`** — fails on a NEW dead class in a `*.module.css`, or on a NEW pair of
    top-level rules for the same single class that set the same property to different values (the
    second is a real cascade bug: one silently wins for every caller of both). Today's population is
    baselined, so only what you add is red. Inventory: `npm run check:css-selectors:report`.
    Re-baseline (last resort): `npm run check:css-selectors:init`.
    ⚠ It deliberately does NOT flag the base-plus-variant idiom (a shared `.a, .b { }` block then a
    `.b { }` override) or `@media` overrides — those are correct CSS, and a check that flagged them
    would be wrong far more often than right.
  - **`check:root`** — fails on any non-gitignored file or directory at the repo root that is not on
    the allowlist. If you genuinely need a new root file, add it to `scripts/check-root-files.mjs`;
    if it is scratch, put it in the session scratchpad, not the repo.
- 2026-09-01: `npm run check:dead:report` reports unused files/exports/types (knip, fetched by npx —
  NOT a dependency, NOT a gate). It cannot see CSS, and it cannot see code that runs but can no
  longer do anything. Findings: `docs/projects/active/DEAD_CODE_REPORT.md`.

See `docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md` for the command-level workflow.
