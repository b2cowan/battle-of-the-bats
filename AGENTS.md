<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Project convention: this repo uses the Next.js 16 `proxy.ts` request interception convention. Do not recreate a root `middleware.ts`; update `proxy.ts` and its exported `proxy()` function instead.
<!-- END:nextjs-agent-rules -->

# AI Interaction Rules
See [AGENCY_RULES.md](AGENCY_RULES.md) for project-wide planning and testing requirements.

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

## Memory rule — sweeps, and what the dev server keeps

On Next ≤16.2.x the dev server held every compiled route for the life of the process — a swept
server was a spent server, and this rule required a restart after every sweep. **Re-measured on
16.3.0 (2026-08-12): compile memory now largely returns at the process level, and a full sweep no
longer spends the server.** But the dev runtime still leaks per REQUEST (an open upstream bug — the
history and numbers live in `scripts/dev.mjs`'s header, their single home), compiles still spike
while they run, and the JS heap never hands back what it holds. The discipline relaxes; it does not
vanish:

- **Restart after a full sweep is no longer mandatory on 16.3+.** Restart instead when the server
  has taken sustained heavy browsing (only a restart returns the per-request drip), and always when
  a sweep **aborted** partway.
- **Do not launch a sweep against a server that is also being used for something else.** A cold
  sweep compiles ~29 routes back to back; that is still the single heaviest thing this repo asks
  of it.
- **Start the dev server only with `npm run dev`.** It goes through `scripts/dev.mjs`, which is the only thing imposing a heap ceiling and the only thing that restarts the server when it dies. ⚠ Never "simplify" that back to `node --max-old-space-size=N node_modules/next/dist/bin/next dev` — Next reads that limit from the `NODE_OPTIONS` **environment variable** only, silently discards a command-line one, and substitutes **half of installed RAM**. That inert flag sat in `package.json` for months. **`scripts/dev.mjs` is the single home for the measurements and the incident history — read its header before changing it, and do not restate its numbers here or anywhere else** (they go stale independently, which is how a rule ends up citing figures that stopped being true).
- Override the ceiling for a one-off heavy run with `DEV_HEAP_MB=<mb> npm run dev`; the sweeps' abort floor moves with `DEV_FREE_FLOOR_MB=<mb>`.

The sweeps refuse to start, and abort mid-run, when free memory falls through the floor — see `scripts/memory-guard.mjs`. **An abort is a failure, not a pass:** it exits non-zero before writing anything, because a sweep that stopped early has unmeasured screens and a baseline written from one records the product as cleaner than it is.
