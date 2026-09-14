# Practices: the room opens on the next practice, and becomes the home for templates and drills

**Product brief · 14 September 2026 · stage 0 of a seven-stage re-evaluation · ruled, built on dev and walked 2026-09-14 (QA §186 passed 24/24)**
Companions: [plan](COACH_PRACTICES_REEVALUATION_PLAN.md) · [the walk and every stage's proposal](https://claude.ai/code/artifact/5c3d2f1b-5159-4d99-bad7-c48b2820da28) (one artifact: the walk, each stage's before/after, the decisions, the plan, this brief, the QA walk)

## Why

A coach opens Practice plans to answer one question — *what do I still need to do before the next practice?* — and the room did not
answer it. It opened on a filter chip and a list of eight rows; the chip counted practices that had already happened (in September it
said three needed a plan, all in May); a past practice was offered "Plan this practice"; and the coach's library lived in another room
named for player development, where the drill library's only door had just been removed. The wider re-evaluation found a bigger shape
problem on the plan page itself (a form where a document should be) — that is stages 1–3. Stage 0 fixes the front door.

## What changes (stage 0)

| Change | What the coach sees and does | Benefit |
|---|---|---|
| The next practice is a card | Practice plans opens on one card — when, where, the practice's name, whether it has a plan — carrying the room's one lime button: **Plan this practice**, **Open the plan**, or on the day **Run practice**. | The one row a coach came for is the first thing on the screen, with the one thing to do. |
| The count means what's still to come | "Needs a plan" counts upcoming practices only, and disappears at zero. | The room stops nagging about May. |
| The past reads as a record | A past practice with no plan says "No plan written · Open" (never "Plan this practice"); a practice the coach wrote up shows the first line of "How it went" on its row. | Looking back over the season stops being a click per row. |
| The row says how the plan fits | "3 blocks · 60 of 90 min" when the practice has an end time. | A 20-minute plan on a 90-minute practice no longer reads like a full one. |
| One room, three tabs | Practices · Templates · Drills. The two libraries move under Practice plans exactly as they were; Skills & Goals keeps metrics, goals and sessions. Old links land in the right place. | The library lives where it is used; drills get their door back. |
| A shorter first screen | A new team reads one headline, one sentence, the arc *Schedule it → Plan it → Print it or run it → Write how it went*, and one button that opens the Add Practice form directly. | Half the words, one tap fewer. |
| The Overview knows | When the next event is a practice, the Overview's card offers Plan / Open / Run by state; attendance stays as the quiet link. | The first screen a coach sees points at the right thing. |

## Who sees what

Writing a plan, a drill or a template needs *Schedule: View + edit* (unchanged). Everyone with schedule access sees the Practices
tab and can open and print a plan. An assistant with schedule view only sees no Templates or Drills tab — the libraries would refuse
them, so the doors are absent rather than dead. Nothing here changes what is included in Premium.

## Tradeoffs and calls made

- The no-plan card carries **one** action. A "Start from a template" link was drawn beside it; building it means changing the plan
  page, which is stage 1's work. Dropped for now, easy to add then.
- The card takes the shape of the Overview's existing "one thing" card so the two look like one thing.
- A past practice's row now says "record", but the page behind it is still today's editor until stage 1 draws its read-only face.

## Success criteria

- A coach opening Practice plans sees the next practice and its one action without scrolling, on desktop and phone.
- "Needs a plan" never counts a practice that has passed.
- No past practice anywhere on the hub is offered "Plan this practice".
- Templates and Drills are reachable from Practice plans in one tap; every old link redirects; a schedule-view-only assistant sees neither tab.
- The Overview's card for a practice offers the plan (or the run screen on the day), not attendance, whenever the coach can act on it.

## What comes next

Stage 1, **The blank page** — the plan page as a document. Its first decision is whether the plan page and the printed sheet keep
reading the players' goals now that goals live in Skills & Goals (the recommendation on record: keep the reads, rail folded shut).
Mockups before any code.
