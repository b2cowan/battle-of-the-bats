# Agent Verification Workflow

This repo uses resource-aware verification so local AI sessions do not freeze the workstation or destabilize the Next.js dev server.

## Default Loop

- During normal implementation, prefer focused validation over full-project sweeps.
- Use `npm run verify:changed` to lint changed JS/TS files from git.
- Use `npm run lint:focused -- <file...>` when a specific touched-file list is clearer.
- If the working tree already contains unrelated user/project changes, do not use broad changed-file verification blindly. Use `npm run verify:changed -- <file...>` or `npm run lint:focused -- <file...>` for the files touched by the current task.
- Run checks serially. Do not run full lint, TypeScript, Playwright, and active Next.js compilation at the same time.
- If a check appears hung or starts consuming excessive resources, stop it and report what did and did not run.

## When To Run Full TypeScript

Run `npm run typecheck` when the change touches shared contracts or high-risk surfaces:

- `lib/**` shared helpers, types, auth, billing, entitlements, or database mapping
- `proxy.ts`, Next config, package/env behavior, route interception, or app layout providers
- API route request/response contracts, migrations, generated types, or broad imports
- Multi-page refactors where a local lint pass is not a meaningful safety net

For routine copy, CSS, isolated component, or page-level visual edits, focused lint is usually enough during iteration. Save full TypeScript for handoff only if risk justifies it.

## Handoff Notes

Every handoff should state the verification tier used:

- Focused: changed-file lint or explicit touched-file lint
- Type-aware: full `npm run typecheck`
- Full: typecheck plus full `npm run lint` or build
- Deferred: skipped due to resource risk, existing unrelated failures, or user-owned browser verification

Browser and visual verification remain user-owned unless the user explicitly asks the agent to run browser tests.
