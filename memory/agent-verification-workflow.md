# Agent Verification Workflow

- 2026-06-03: The default AI-agent verification process is resource-aware. Do not run full-project lint and TypeScript checks after every small slice.
- Prefer `npm run verify:changed` for normal iteration. It runs ESLint only against changed JS/TS files discovered from git.
- In a busy/dirty worktree, use `npm run verify:changed -- <file...>` or `npm run lint:focused -- <file...>` for explicit touched-file lint so unrelated user changes are not swept into the check.
- Use `npm run typecheck` for shared modules, route/auth/proxy/config changes, API/data contract changes, broad refactors, and release-style handoffs.
- Run expensive checks serially and avoid running full lint/typecheck/Playwright while the Next.js dev server is actively compiling.
- If a full check hangs, consumes excessive resources, or risks crashing the workstation, stop it and report the skipped verification and residual risk instead of letting it continue indefinitely.
- Browser and visual verification remain user-owned unless explicitly requested.

See `docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md` for the command-level workflow.
