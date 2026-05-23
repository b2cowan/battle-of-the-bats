<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Project convention: this repo uses the Next.js 16 `proxy.ts` request interception convention. Do not recreate a root `middleware.ts`; update `proxy.ts` and its exported `proxy()` function instead.
<!-- END:nextjs-agent-rules -->

# AI Interaction Rules
See [AGENCY_RULES.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/AGENCY_RULES.md) for project-wide planning and testing requirements.

# Local Dev Server

This app depends on Supabase during request handling, including `proxy.ts` session checks and platform-admin auth. When an AI assistant starts the local Next.js dev server, it must run `npm run dev` with network access/escalated permissions. Starting the server inside a network-restricted sandbox can still bind `localhost:3000`, but Supabase calls fail with `EACCES`, causing login pages to hang without useful browser errors.

After starting the dev server, verify `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns HTTP 200 and check the server log for no Supabase `EACCES` fetch failures.

## Restart rule - keep the dev server running unless a restart is required

Do not restart the dev server after routine page, component, style, or copy edits. Prefer leaving the existing `npm run dev` process up and relying on Next.js hot reload so the user can keep testing without avoidable downtime.

After any session that adds new files, deletes files, changes shared modules (e.g. `lib/db.ts`, `lib/types.ts`, any context provider), changes `proxy.ts`, or changes config/package/env behavior, the dev server **must** be restarted before handing off to the user for browser testing.

Batch restart-required changes and restart once near handoff whenever possible.

**Important — stop the server BEFORE deleting `.next` on Windows.** Node.js holds file locks on chunks in the running cache. Deleting `.next` while the server is running causes partial deletion; the server then runs with a corrupted cache and returns 500 for all routes.

Correct sequence:
1. Stop the dev server (Ctrl+C in the terminal, or kill the `node` process)
2. Delete the cache: `rm -rf .next`
3. Restart: `npm run dev`
4. Wait for "✓ Ready" before testing in the browser

Symptoms of a stale cache — page never loads, "compiling → rendering → compiling" loop in the terminal, or 500 Internal Server Error on all routes — are always fixed by this sequence. Do not ask the user to debug these symptoms; just stop, clear, and restart proactively.
