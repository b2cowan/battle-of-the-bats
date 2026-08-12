# Prompt — plan the Next.js 16.2.4 → 16.3.0 upgrade

**How to use this:** paste everything below the line into a fresh session. It is self-contained.
The measurements in it were taken on 2026-08-11 on the owner's machine; ask the agent to
**re-verify rather than trust them** — several claims in this investigation were wrong on first
telling and had to be corrected, which is exactly why the numbers are written down with their
method attached.

---

## The task

We are on **Next 16.2.4**. Its **development** server leaks memory per request and dies during
ordinary use. **Next 16.3.0** is stable, is the current `latest`, and targets exactly this bug.

Plan that upgrade. **Do not implement anything until I approve the plan.** Investigate, scope,
recommend, wait.

Produce the two documents this repo expects for a significant piece of work: a plan at
`docs/projects/active/NEXT_16_3_UPGRADE_PLAN.md` and a plain-language brief at
`docs/projects/active/NEXT_16_3_UPGRADE_PM_BRIEF.md`, plus the one-line summary in `TODO.md`
linking to them. There is already an Active Task entry for this — update it rather than adding a
second.

## Why we're doing it (measured 2026-08-11 — re-verify the version facts, at least)

The dev server's memory was investigated properly with the V8 inspector, forcing a full garbage
collection before every reading. Working-set numbers were deliberately not trusted, because they
cannot distinguish retained memory from garbage V8 simply hadn't collected yet — and that
distinction was the entire question.

What was found:

- **~2.7 MB retained per request, never returned, with no plateau.** 360 requests against a
  single *already-compiled* page added ~973 MB, with `arrayBuffers` climbing dead-linearly.
- Cold boot ≈ 255 MB live heap. First request ≈ **+780 MB** one-off framework load.
- Each additional **public** route compiled ≈ +70–100 MB. Each additional **coach** page ≈
  **+240 MB**, roughly 3× heavier.
- **~21 coach pages of ordinary manual clicking exhausts a 6 GB ceiling** and the server dies.
  This is *not* a sweep-only problem — that was the initial (wrong) reading, disproved by the
  owner simply browsing the portal while the report was being written.
- A sampling heap profile attributed **~126 MB of ~144 MB of surviving bytes** to
  `next/dist/compiled/next-server/app-page-turbo.runtime.dev.js` — the **dev** build of Next's
  runtime. Our own compiled chunks contributed ~1 MB. A scan of our code for unbounded
  module-level accumulators found none; every shared collection is a fixed lookup table.

Upstream: [vercel/next.js#81161](https://github.com/vercel/next.js/issues/81161) and
[#91396](https://github.com/vercel/next.js/issues/91396). Turbopack caches aggressively by design
and the cache grew without bound in long dev sessions. **16.3.0 is reported to cut dev memory by
up to 90% with no configuration changes.**

**Production is very likely unaffected** — it loads `app-page.runtime.prod.js`, a different build
— but this is **UNPROVEN**. Closing it needs a production-build test. Treat it as an open
question, not a settled fact.

## What is already in place (do not re-derive; do decide what to keep)

Mitigations shipped 2026-08-11, all uncommitted at time of writing:

- **`scripts/dev.mjs`** — `npm run dev` goes through it. It sets the heap ceiling (6144 MB,
  `DEV_HEAP_MB` overrides) and **supervises the server, auto-restarting it on the out-of-memory
  abort** with a visible restart counter, guarded against boot-loops.
  ⚠ **Read the comment block before touching it.** The ceiling *must* be set via the
  `NODE_OPTIONS` environment variable: `next dev` reads the limit from there and **only** there,
  silently discards a command-line `--max-old-space-size`, and substitutes **half of installed
  RAM**. That inert flag sat in `package.json` for months and is why the server was reaching
  10.9 GB and taking the machine down.
- **`scripts/memory-guard.mjs`** — the browser-driving sweeps (`check:layout`, the mobile
  capture) refuse to start without headroom and abort mid-run if free memory falls through a
  floor, exiting non-zero *before* writing any baseline.
- **A standing rule in `AGENTS.md`**, beside the restart rules.

**Part of your plan must be what happens to these after the upgrade.** If 16.3.0 delivers, some
are scaffolding that should be relaxed or removed, and some are worth keeping permanently on
their own merits. Say which, and why. Do not assume "upgrade lands ⇒ delete the guards."

## Constraints and traps specific to this repo

Verify each of these rather than taking them on faith:

- **`AGENTS.md` warns this Next line carries breaking changes** and that the guides in
  `node_modules/next/dist/docs/` must be read before writing code. This is a minor version bump,
  but treat the warning as live.
- This repo uses the **Next 16 `proxy.ts` request-interception convention**, not a root
  `middleware.ts`. A framework bump is exactly the kind of change that could disturb it.
- **The production build is pinned to webpack** (`next build --webpack`) so `sharp`'s native
  binaries bundle correctly. Dev uses Turbopack. Confirm whether 16.3.0 changes anything here —
  and whether the pin is still needed, since it is a workaround with a cost.
- `amplify.yml` sets `NODE_OPTIONS=--max-old-space-size=7168` for the production build. That one
  was always correct. Check whether 16.3.0 changes production build memory enough to revisit it.
- Package manager is **pnpm**, and there is a known Amplify trap: a `pnpm-workspace.yaml` at the
  root **aborts the build**, so it is gitignored. Do not introduce one.
- Scale, for test-planning: ~273 pages and ~457 API routes.
- **Branch policy: everything happens on the single shared `dev` branch.** Never create a
  feature branch. Never push to `master` unless deployment is explicitly requested.

## Sequencing — this matters, please think about it

`dev` currently carries feature work that has not yet been promoted to production. Bundling a
framework upgrade into the same production promote as a pile of unreleased feature commits means
that if anything breaks in production, the cause is ambiguous between the two.

Address this explicitly: should the upgrade ship as its own isolated promote, before or after the
pending work? What does the ordering cost either way? There is also live owner QA in flight (the
Owner QA Ledger) — a framework bump underneath someone mid-QA invalidates what they have already
checked. Factor that in.

## What I want from you

### 1. Verify the current state
Confirm the installed and declared Next version, that 16.3.0 is stable and current, and what sits
between 16.2.4 and 16.3.0. Read the actual release notes and changelog — not summaries — and
report what you find, **including anything that contradicts the notes above.**

### 2. Scope the breaking changes
Go through what changed between our version and 16.3.0 and map it onto **this** codebase: which
changes touch code we actually have, which are irrelevant, which are uncertain. Name the files
that need attention. Be explicit about what you could not determine.

### 3. Assess the risk honestly
Where could this break production, and how would we find out — from a build failure, a test
failure, or only from a customer? Pay attention to anything that would fail *quietly*. Include
the `proxy.ts` convention, auth/session handling, the webpack pin, and image handling via `sharp`.

### 4. Write the verification plan
Static checks, the test suite, the layout sweep, the demo-sandbox checks, and a production build.
State what a pass looks like for each.

**It must include re-running the memory measurements**, using the same method — inspector plus a
forced GC, not working-set numbers — so we can confirm the gain happened *on this machine* rather
than trusting the release notes. The measurement scripts used on 2026-08-11 were throwaway; decide
whether they should become a permanent, committed check, and say why either way.
**A "did it work?" plan that cannot produce a before/after number is not acceptable.**

### 5. Give me a rollback story
If it goes wrong after a production promote, what is the fastest safe way back, and what does that
cost?

### 6. Recommend a sequence
Concrete ordered steps, each with what it produces and how we know it worked, plus where the
approval gates sit.

## How to talk to me

I'm the product owner, not the engineer on this. Lead with what changes for me and for customers,
what it costs, and what could go wrong. Keep file paths and mechanics in the plan document, not in
the conversation. If I ask for the technical breakdown, switch fully into detail.

If you find a reason this upgrade is a bad idea, or that it won't actually fix the problem, say so
plainly — that is a useful answer, not a failure to deliver.
