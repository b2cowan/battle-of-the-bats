# The demos stop holding up development and releases — PM Brief

**Priority:** High (process cost on every release). **Status:** built on dev 2026-09-13; the first
production build after it ships is the proof. Plan: `DEMO_PROCESS_DECOUPLING_PLAN.md`.

## What changes

**Before:** every feature change was asked to update the public demos in the same piece of work,
every release stopped until someone re-seeded the live demo from a laptop, and more than half of
the project's standing instructions were about the demos. Despite all of that, the demo's narration
went stale five releases running.

**After:**
- **The live demo rebuilds itself when a release changes it.** Nothing to run, nothing owed. If a
  release changes the demo world or the database, the production build rebuilds the demo from
  exactly the code it is deploying. If nothing changed, it does nothing.
- **Releases never wait on the demo.** The check that used to stop a promote now runs the morning
  after, as a monitor.
- **The demo's story is curated once per release cycle**, in a dedicated `/demos` session with a
  checklist — not on every commit. The only per-commit signal left is automatic: if a screen the
  tour points at moves or disappears, the build fails until the tour is fixed.
- **Sentences are harder to break.** Every number the demo quotes is now checked against the
  seeded world by machine, and sentences describe what a screen is *for* rather than what it
  happens to show today.
- **The standing instructions are short again** — the demo section is a paragraph, not a history.

## Why it matters

Roughly one in eleven commits since August carried demo work; releases were routinely blocked on a
manual step that was still owed weeks later; and every agent session started by reading 1,500 words
of demo history. The demo is the product's shop window — it should follow the product, not gate it.

## Customer impact

None visible. A prospect walking either demo sees the same worlds, told in slightly plainer
sentences. The live demo will now be current within minutes of a release rather than days or weeks.

## Trade-offs accepted

- A brand-new feature shows up in the demo's *narration* at the next `/demos` pass, not the same
  day. (The seeded world itself updates with the release.)
- The demo is rebuilt during the deploy rather than at 4 a.m.; a prospect mid-tour at that exact
  moment could see a screen refresh. Same window migrations already accept.

## Success criteria

- No release in the next quarter waits on a demo step.
- `check:demos:prod` is green the morning after every release without anyone running a seed.
- The demo sections of CLAUDE.md stay under 200 words.
- Each `/demos` pass takes one session and records its date.
