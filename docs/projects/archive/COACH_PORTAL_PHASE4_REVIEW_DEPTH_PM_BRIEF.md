# Coaches Portal — Phase 4: Review Depth · PM Brief

> **For:** a stakeholder who hasn't read the full plan.
> **Companion plan:** [COACH_PORTAL_PHASE4_REVIEW_DEPTH_PLAN.md](COACH_PORTAL_PHASE4_REVIEW_DEPTH_PLAN.md)
> **Status:** **Content-complete (2026-07-07).** The three highest-value features shipped to the shared dev branch — the who-hasn't-paid list, the season-over-season comparison, and per-player attendance reliability — each reviewed and documented. The fourth (tournament placement) was **cut** because it would only be truthful for tournaments hosted on FieldLogicHQ and blank/misleading for the majority run off-platform (the same reason the earlier Standings feature was cut). No database change. Not yet released to production; owner browser-test pending.

## What this is

The final content phase of the Coaches Portal review. Phase 3 fixed *finding* things (a menu that matches how a coach thinks, a front door for the lineup builder). Phase 4 delivers the other half of the paid-product promise: turning the data the portal **already collects** — game results, attendance, dues, past seasons — into **decision-useful, resonant views**. Nothing new is collected; these are new screens over existing data.

## What a coach experiences differently

- **Chasing dues becomes a two-minute job.** Today the home screen tells a coach *how many* players have paid nothing. Phase 4 turns that number into a **named list with a one-tap reminder** — no spreadsheet cross-check. *(Ships first.)*
- **They can see if the team is improving.** A **this-season-vs-last-season** view: win/loss trend, dues collected, expenses, roster size. Builds on the small "Last season" tile Phase 3 already added. Answers the question every coach asks — "are we better than last year?"
- **They can see who actually shows up.** A season-long **attendance reliability** view per player, framed supportively (helping fair playing-time and spotting a kid drifting away — not a shame-board).
- **Where we have the data, they see how they placed.** For tournaments **hosted on FieldLogicHQ**, a "2nd, Pool B" style placement card — reusing the existing standings engine.

## Why it matters

This is the **retention and value-perception** phase. A coach who can *see* their season's story — money handled, team improving, results — feels the subscription earning itself. It's also the most emotionally resonant work (records, comparisons, "you're improving"), which is exactly what coaches show off and renew for.

## The one real tradeoff

**Tournament placement has the same limitation that killed the Standings feature:** it's only truthful for a tournament **hosted on FieldLogicHQ**, where the platform holds every team's games. Most tournaments run off-platform, so a placement card would be blank or misleading for the majority. **Recommendation:** build it only for hosted tournaments (honest, clearly scoped) or cut it — never imply a placement we can't back with data.

## Priority & sequencing

1. **Who-hasn't-paid list** — highest utility-per-effort; upgrades a number coaches already see into a job they can finish.
2. **Season-over-season comparison** — high emotional payoff, builds on work already shipped.
3. **Per-player attendance reliability** — valuable; needs careful, non-punitive framing.
4. **Tournament placement** — only if we go "hosted-only"; otherwise cut.

## Expected customer impact

- Treasurer-minded coaches feel the dues list immediately (less chasing, faster collection).
- Returning coaches get the "are we improving?" payoff at season boundaries.
- Fairer playing-time conversations backed by real attendance data.
- No hollow or misleading data anywhere — placement only where it's real.

## Success criteria

- "Who hasn't paid anything?" is a named list + reminder, and its count always matches the home-screen badge.
- "How does this season compare to last?" is answerable in-portal.
- Attendance reliability reads as supportive, per player.
- Placement appears only where the data is real.
- Zero database migrations; assistant-coach permissions intact; no free-portal regression.

## Cost / shape

New screens over existing data plus a few read-only endpoints. No schema change, no data migration. After Phase 4, a light **Phase 5** verification sweep confirms assistant-coach permissions hold across everything Phases 1–4 added.
