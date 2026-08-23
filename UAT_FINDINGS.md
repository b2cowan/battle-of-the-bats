# UAT Findings Log

This file is maintained by the `/uat` agent. Each run appends new findings.
Approved and applied fixes are marked `[FIXED]`. Open findings remain listed
until manually closed or fixed.

> **Note:** Run `/uat` in Claude Code to start a new test session.
> Run `/uat fix` to re-analyse open findings and propose fixes without re-running tests.

---

## Run 2026-08-23 — coach-tryouts-smoke + tryout-blindfold-boundary (23 tests: 21 ✅ / 2 ❌)

### F-001 [FIXED] · medium · /[org]/coaches/teams/[teamId]/tryouts · head coach
**Stale spec selector — scorecard builder heading.** coach-tryouts-smoke.spec.ts asserts the
builder modal via `h3[class*="modalTitle"]`, but the scorecard-weights rebuild (commit
e1eaa0b0, 2026-08-17) renamed that heading's class and gave it a stable id
(`rubric-builder-title`). The modal opens fine (visible in the failure snapshot) — the spec
has been failing since 08-17. Not a product defect; not caused by the One-Room rebuild.
Proposed: target `h3#rubric-builder-title`.

### F-002 [FIXED] · low · /[org]/coaches/teams/[teamId]/roster · head coach
**Stale spec expectation — roster column width.** The spec expects the list view at max-width
960 and only ?view=depth at 1200, but a committed ruling made data-dense surfaces take the
wide column unconditionally (roster/page.tsx: "supersedes" comment). Product is behaving as
ruled; the spec predates it. Not caused by the One-Room rebuild. Proposed: expect 1200 on
both views, keep the CoachScrollX + phone swipe-hint assertions.

**Resolution (2026-08-23, "apply all"):** both fixes applied. Peeling F-001 exposed three more
layers of the same 08-17 drift in the same test, all repaired in the same pass: the discard
dialog's stake copy ("how they count", not "their weights" — the §50 ruling), the note field
becoming per-row/collapsed with a reworded placeholder, and the Next DEV overlay's
<nextjs-portal> host intercepting phone-size taps (hidden via injected style in the spec's
signIn — dev chrome only, does not exist in prod). Final: both specs 23/23 green.

