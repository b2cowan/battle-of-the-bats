# PM Brief — Coach Premium Phase 5: In-Portal Season & Division

**One-liner:** Give a standalone Premium coach the two year-end controls they currently can't reach without an org admin — **start their next season themselves**, and **change their team's division** — so a one-person Premium team can actually run year after year.

**Plan:** [COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md](COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md) · **Parent:** [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md)

## Why it matters

The Premium pitch is "run your competitive team across seasons." But today only an **org admin** can create or advance a season, and a standalone Premium coach has no admin — so at year-end they're stuck. Division is also frozen (set once at signup, then removed from signup on the promise it returns here). Phase 5 closes both gaps and makes the multi-season promise real for the coaches most likely to pay: solo operators.

## What the coach can do differently

1. **Start next season** — a new **Settings** area (and a year-end prompt on their team overview) lets the head coach roll into next season in one step. Their **current roster comes with them** automatically; they prune/add as needed. They can optionally bring over their **fee plan** and their **planned budget**. The **schedule starts fresh**, and last year's **actual money** (payments made, spending, paid history) stays behind. Last season becomes **read-only history** under Past Seasons. After rolling, they get an honest "here's what carried / check these" summary.
2. **Edit division** — the team's division (e.g. "U13 Tier 1") is now visible and editable in Settings, and shows on the team overview.

## Who can do it

- **Standalone Premium coaches (head coach):** full self-service — exactly the audience this is for.
- **Assistant coaches:** can view, but can't roll the season or change division.
- **Org-owned / club-adopted teams:** unchanged — the **club admin** keeps season and division control (they already have the admin tools). The coach sees division read-only with a "managed by your club" note.

## What carries vs. what's fresh (start next season)

| Carries forward | Optional (coach's choice) | Always fresh / stays behind |
|---|---|---|
| Active roster (players + contacts) | Fee plan (amounts/installments, dates shifted a year) | Schedule (empty new season) |
| Coaching assignments | Planned budget (projected buckets) | Payments, paid history, actual spending |
| | | Player waivers/documents (re-collect each season) |

## Tradeoffs

- Carried **fee due dates are shifted by a year** as a convenience, not validated against the real new-season calendar — the coach is told to confirm them.
- **Waivers don't carry** (they're per-season by design) — flagged in the summary.
- Built with **no database change** and **no impact on other teams or the billing pipeline** — lowest-risk path, ships independent of the still-pending upgrade-flow migrations.

## Success criteria

- A standalone Premium head coach rolls into next season with no admin help; roster is present, schedule is empty, last season is read-only under Past Seasons.
- The optional budget/fee carries do what they say; the summary honestly lists anything to double-check.
- Division is editable for standalone head coaches and correctly read-only/admin-managed for org-owned teams.

## Priority

**Companion to the now-complete Premium upgrade flow.** Required for the multi-season promise but separable; ships on its own. No production migration coordination needed.
