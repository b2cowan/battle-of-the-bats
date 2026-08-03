# Ask the Front Office — PM Brief

**Status:** Planned (green-lit 2026-08-02). Plan: `ASK_FRONT_OFFICE_PLAN.md`.

## What the coach sees

A question box at the top of the premium portal. In version one it offers a row of ready-made
questions to tap — "Who hasn't played catcher recently?", "What does each family still owe?",
"Who's missed the most practices?" Tapping one returns a direct, specific answer in one sentence,
with the receipts underneath: the actual game dates, lineup entries, or installment rows the
answer came from, each linking to the full report. In version two, the coach can simply type the
question in their own words and get the same receipted answer.

## Why it matters

This is the moment a volunteer coach's weekend operation gets an analyst that never forgets
anything they've logged — the feature a coach shows another coach in the parking lot. It also
compounds the value of every data-entry habit the portal asks for: attendance, lineups, and dues
records become answers, not chores.

## The trust promise (and how it's kept)

Every answer is assembled from the team's own records and shows its evidence. The AI (version
two) is only allowed to *understand the question* — it picks which of the team's own lookups to
run; it can never write a fact. If it misreads a question, the receipts are visibly wrong; it can
never be confidently, invisibly wrong. Assistants with limited permissions can only ask what
their permissions allow — a helper without money access cannot get a dues answer by any phrasing.

## Customer impact & cost

Answers in a couple of seconds; roughly a cent or two per typed question in AI cost (pennies per
coach per month). If the AI service is ever down, the tappable questions still work — cut-day
never depends on a third party.

## What needs the owner before version two

A privacy ruling: typed questions and team records (including players' first names) would flow to
Anthropic's API (not used for training under commercial terms). There is a stricter option that
sends jersey numbers instead of names so no child's name ever leaves the platform. This ruling —
plus whether the feature is premium-included or separately gated — should be logged as a business
decision when made.

## Success criteria

- A coach can get a correct, receipted answer for each launch question on a team with real data,
  and an honest "nothing recorded yet" on an empty one.
- A restricted assistant can never obtain an answer their permissions don't allow.
- Typed questions route correctly ≥90% on a phrasing test set; everything else refuses cleanly.
- No answer ever renders without its receipts.
