# Codebase Cleanup — PM Brief

> Status: PROPOSED 2026-07-24. Nothing has been removed yet — this brief summarizes what a deep audit found and what you're being asked to decide. Details live in `CODEBASE_CLEANUP_ANALYSIS.md` (evidence) and `CODEBASE_CLEANUP_PLAN.md` (the step-by-step tranches).

## What happened

After we found and deleted the family of orphaned pre-multi-tenant pages, a full audit swept the entire codebase and both databases (dev and production) for more of the same: dead pages, duplicated code, hardcoded styling, unused packages and assets, dead database structures, and stale project trackers. Every "this is dead, remove it" claim was independently re-checked by a second agent whose only job was to prove it wrong. 208 findings survived; 173 fully confirmed, 30 confirmed-with-corrections, and 5 were successfully refuted (those are recorded as "do not remove" so future sweeps don't re-flag them).

## Three things need your attention regardless of the cleanup

1. **Production database permissions hole (most important).** On production only, six core data tables — announcements, fields, divisions, games, teams, tournaments — have leftover "allow public full access" rules. In plain terms: the public app key that every visitor's browser holds could be used to modify or delete live tournament data directly. Dev runs fine without these rules, so removing them is safe and small. This should be fixed before any other cleanup.
2. **A live database password is sitting in the code history.** Two old utility scripts contain the dev database password in plain text, and it's in the repository history permanently. The fix is to rotate that password, then delete the scripts.
3. **Three throwaway design-mockup web pages are publicly reachable** on the deployed site at guessable addresses. They should come down (the brand-preview page stays — that one's an intentional tool).

## What the cleanup actually removes

- **About 3,000 lines of confirmed-dead code**: two abandoned admin screens left behind after the Plans & Pricing merge, two never-used public bracket views, two dead API endpoints, ~60 never-called library functions, and several hundred lines of orphaned styling across ~25 stylesheets.
- **~20 one-off scripts** whose job finished weeks ago (migration checks, one-time seeds, an old screenshot harness). The Battle-of-the-Bats demo toolkit stays — it turned out to be your active QA kit, not dead code.
- **An unused software package, an unused configuration key, and 9 unused image files** (including leftover starter-template icons).
- **Dead database structures** (a superseded log table, 6 dead columns, ~10 indexes that nothing can ever use) — these are held in a separate, last, individually-approved tranche because database drops are irreversible.

## What the cleanup fixes (not just removes)

- **Project trackers get truthful again.** The July 22–23 production releases shipped far more than the trackers say: a dozen "waiting for production" warning markers, six TODO lines, and ~15 plan-document headers are stale in the same direction. Anyone starting a new chat today gets misled about what's live. This is a zero-risk, high-value pass.
- **The styling guardrail gets extended.** The hex-color ratchet currently doesn't watch the consumer app shell, the marketing site, chat, or several admin component libraries — roughly 800 hardcoded color values sit outside its view, including 20 uses of the old (pre-refresh) brand lime. The plan extends the guardrail and inventories the debt; actual recoloring stays a separate visual-reviewed effort.
- **A known timezone bug pattern re-appeared** in ~40 newer places (things flip to "today"/"overdue" a few hours early around midnight). The plan routes them through the established fix.
- **Real bugs surfaced by the audit**: a delete-safeguard on team budgets that silently never fires, and production missing a data-integrity link that dev has (deleting a division on prod can strand its games). Both get owner-decided fixes.

## What you're being asked to decide

1. **Go/no-go on Tranche 0** (the three security items above) — recommended immediately.
2. **Go/no-go per tranche** after that, in the suggested order: tracker truth-up → dead-code deletion → guardrail extension → consolidation work → database tranche last, each database drop individually.
3. **A handful of product calls** the audit deliberately didn't make for you: the four old `/platform/...` marketing pages (search engines may still have them — recommend adding redirects before deleting), when the legacy install-banner nudge has served its purpose, whether the five built-but-never-launched platform-admin features (user notes, bulk operations, metric snapshots, campaigns, plan versions) are still on the roadmap or should be formally retired, and whether an unused billing-suppression switch should be wired up or dropped.

## What this is worth

Less code to read and break, fewer look-alike duplicates for parallel sessions to diverge on, a styling guardrail with no blind spots, trackers that tell the truth, and a production database without a public-write hole. The audit itself is done and repeatable — the refuted list means the next sweep won't waste effort re-litigating things that only look dead.
