# One Board — one place for where every project stands

> **Status:** the board is the status. This file holds the plan and the rulings, never a project's status.
> PM brief: [ONE_BOARD_PM_BRIEF.md](ONE_BOARD_PM_BRIEF.md). Page: the Owner Morning Brief
> (https://claude.ai/artifact/XihEHvASiYUqYKPUJScVUX), rendered from `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`.

## Why

On 2026-11-17 a census found about eight places that each typed a project's status: the plan header, the TODO line,
the product roadmap, the Club tier index page, the billing/tax/pricing sequence page, the brief's project list, the
saved `/tasks` list and Claude's memory. Every session updated one or two; the rest went stale. Evidence gathered the
same day (verified against the files):

- Group email to coaches: roadmap "Not started", Board Ready "nothing built", TODO "commit owed" — both build sessions
  are committed.
- Five plan headers say "PLANNED — nothing built" while their bodies record stages built and walked (GST/HST, Stripe
  from our admin, GST/HST Stage 6 Terms, Board Ready, Club tier).
- The billing/tax/pricing sequence page was last written 2026-11-06 and reads 3 of 19 done.
- The Club tier plan's §9 checklist has every box open, several for work that has landed.

Two causes: the same status typed in many places, and index pages whose status lives in a page database that cannot
change in the same commit as the work.

## Owner rulings (2026-11-17, all four as recommended)

1. **One board is the only home for a project's status.** Every other tracker points at it.
2. **The board is the Owner Morning Brief, grown up** — not a new page.
3. **TODO.md shrinks to one line per project, pointing at the board.** This amends the AGENCY_RULES "Task Tracking"
   rule; the amendment lands with the shrink (Session 2).
4. **A build check ("touch the plan, touch the board line") — yes, but only after the board has run for a few
   weeks.** It changes shared automation, so it is built only on the owner's word in that later session.

Related rulings of the same day: launch in **Canada first**; the US launch is after it. The Canadian launch means
**functionally able to onboard a club** (sign up, pay us on Stripe, connect its own Stripe, open a house league or a
tournament); marketing and the demo come after.

## Shape

**Three levels.**

1. **Goals** (3 to 5), each with a "done when" line: Canadian launch · The board pack can be shown · Ongoing quality ·
   US launch (after the Canadian launch).
2. **Projects** (about 20 — the brief's registry). Each carries: the goals it serves, one phase word, "now → next"
   stage, the single next action, what remains, what it waits on (other projects), and the steps only the owner can take.
3. **Steps** stay in each project's plan. The board never restates them.

**Lanes.** Now (at most three, the owner's order) · Next · Later · After launch (a project whose only goal is the US
launch). "Waiting on you" is a panel, not a lane: every owner-only step across the projects plus every walk owed.

**Phase words.** Planning · Drawing · Asks to rule · Building · Walk owed · Ready to release · Live · Parked.

**Where the status lives.** In the registry file, in the repo, so the session that finishes a stage changes the status
in the same commit. The script derives momentum, walks owed and production state as before; it also checks the board's
own rules (no more than three in Now; a Now project must not wait on an unfinished one; every `waitsOn` names a real
project) and prints a warning for each break. The page renders what the script writes.

## What every other tracker becomes

| Tracker | Becomes | Session |
|---|---|---|
| Brief project registry | The board's data (status, lanes, goals) | 1 |
| Brief page | The board: Today = Now, Waiting on you, goals; tabs for Goals, Projects, Product, Technology | 1 |
| Brief "priorities" document | Retired — the Now lane replaces it | 1 |
| "Canadian launch" | A **goal** on the board, not a plan. The items first thought orphaned all have a home: the onboarding run-through, support posture and rollback runbook are Club tier §9; the release-safety asks are the release-hardening plan (which also takes the "revisit minute-level recovery before the first live club" question); the payout test and the payments-terms prerequisite are the Stage 12 payments plan; the Stripe clean-up is item R of the Stripe-from-our-admin plan. A separate launch plan would have restated them — the drift this plan removes. | 1 |
| Billing/tax/pricing sequence page | Frozen as history, a last log row pointing at the board | 2 |
| Club tier index page | The Club project's detail page (stages, walks, drawings) with no status of its own | 2 |
| Plan headers | One line: "Status: on the board" (plus the plan's own stage list, which is the steps) | 2 |
| TODO.md | One line per project, pointing at the board; AGENCY_RULES amended | 2 |
| Memory index lines | Point at the board; stop restating status | 2 |
| Product roadmap Status column | Filled from the board, not typed | 2 |
| `/tasks` | Reads the board first; its waves follow the lanes | 2 |
| The "touch the plan, touch the board" check | Built after a few weeks of use, on the owner's word | 3 |

## Sessions

- **Session 1 (2026-11-17):** this plan + PM brief; registry gains goals, lanes,
  phase, stage, next, waitsOn, youOwe; the script writes a `board` document and checks the board's rules; the page
  shows the board; the projects that serve the Canadian launch are truth-checked; TODO line; the brief's how-to updated.
- **Session 2:** truth-check the remaining projects; freeze the sequence page; Club index loses its status; plan headers
  point at the board; TODO shrinks and AGENCY_RULES is amended; memory points at the board; roadmap status from the
  board; `/tasks` reads the board.
- **Session 3 (after a few weeks):** the build check, on the owner's word.

## Done when

Every open project's status is written in exactly one place, the board; TODO.md, plan headers, the roadmap and memory
point at it; and the owner can read the order of work, and what waits on him, from one page.
