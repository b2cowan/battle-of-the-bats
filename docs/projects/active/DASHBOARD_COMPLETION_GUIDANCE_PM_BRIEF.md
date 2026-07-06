# Dashboard Completion Guidance — "Ready to Finalize" — PM Brief

> **Status:** Planning · **Created:** 2026-07-06 · **Priority:** High (small effort, everyday organizer confusion) · Plan: [DASHBOARD_COMPLETION_GUIDANCE_PLAN.md](DASHBOARD_COMPLETION_GUIDANCE_PLAN.md)

## The problem, in plain terms

When a tournament is finished — every game scored, playoffs done, champion crowned — the organizer's dashboard **still tells them "It's game day — enter and review scores."** It gives no sign that the event is over or that there's one last thing to do: mark the tournament complete.

The reason is that the dashboard's top "what's next" message is driven by the **calendar**, not by whether the games are actually done. As long as today is still within the tournament's dates, it says "game day," even at 100% complete. And the message that *should* eventually say "your event has wrapped up — mark it complete" is written into the system but, due to how the logic is wired, can essentially never appear for a real tournament. On top of that, the day *after* the event the same screen can show two contradictory messages at once ("It's game day" and "the dates have passed"), and the By-Division panel can say "Playoffs underway" right next to a crowned champion.

Net effect: at the moment of triumph — the whole event is done — the product points the organizer *backward* into score entry instead of *forward* to finishing up.

## What we're changing

The dashboard will **recognize when every game is resolved** and swap the top card from "It's game day" to a **"You're ready to finalize"** message whose main button is **Mark tournament complete** (with "Review scores" as a secondary link). The live game-day board (progress, champions, by-division) stays — only the guidance message at the top changes.

We'll also clean up the two related contradictions:
- Remove the duplicate "dates have passed" nudge so the organizer never sees two different "is it over?" messages at once.
- Fix "Playoffs underway" so it reads "Playoffs complete" (or disappears) once the bracket is finished and champions are set.

## Why it matters

- **Answers the obvious question.** "Everything's done — now what?" gets a clear, single next step instead of a stale prompt.
- **Gets tournaments finalized.** Marking complete is what locks the results as final and, on Tournament Plus, unlocks the event summary and "reuse this setup next year." Today nothing on the dashboard nudges toward it, so events can sit un-finalized.
- **Removes an embarrassing contradiction** at the best possible moment (the event just finished, a champion was just crowned).

## What the organizer sees / does differently

| Before | After |
|---|---|
| Finished tournament, last day → "It's game day — enter & review scores." | Finished tournament → "You're ready to finalize" + **Mark tournament complete**. |
| Day after the event → two conflicting messages ("game day" **and** "dates passed"). | One clear message; no contradiction. |
| By-Division shows a champion **and** "Playoffs underway." | Champion shown; footer reads "Playoffs complete" (or hides). |
| "Mark complete" only findable in Settings. | Offered right on the dashboard when it's actually time. |

Nothing changes for a tournament that's still in progress — the live game-day view behaves exactly as it does today. There are no role or plan differences to the trigger itself; the only Free-vs-Plus difference is the existing post-completion hand-off (Plus gets the event summary + reuse), which is unchanged.

## Scope & effort

- **No database changes**; the dashboard already knows the completion counts and champions. One small additive field on the dashboard data (to count forfeits as "resolved") keeps the trigger honest.
- Touches shared tournament-guidance logic + the admin dashboard, so it's a **substantive change** — it will go through `/review`, and we'll offer `/docs` for the close-out help recipe.
- Phased: **Phase 1** (the "ready to finalize" card + Mark-complete button) delivers the fix on its own; Phases 2–3 remove the contradictions.

## Open decisions for the owner

1. **How the "Mark tournament complete" button behaves** — for a safe first version, send the organizer to the existing (audited) complete-and-notify confirmation, rather than building a brand-new confirmation on the dashboard. Upgradeable to true one-click later.
2. **Premature "ready"** — if an organizer finishes pool play but hasn't built the playoff bracket yet, should we still say "ready to finalize"? Recommendation: suppress it until the bracket exists (details in the plan).
3. **Exact wording** of the new card — a quick `/design` + `/marketing` pass on voice.

## Success criteria

- A finished, still-active tournament shows "You're ready to finalize" with a working Mark-complete action, on the last day of the event (not a day later).
- No screen ever shows two conflicting "event is over" messages.
- "Playoffs underway" never appears alongside a crowned champion.
- Marking complete from the dashboard behaves identically to marking complete from Settings (same lock, same results-summary email).
