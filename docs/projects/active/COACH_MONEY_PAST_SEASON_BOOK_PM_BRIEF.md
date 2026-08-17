# PM brief — How the season added up

**Approved 2026-08-17 · P4 of history-in-place · plan: `COACH_MONEY_PAST_SEASON_BOOK_PLAN.md` ·
mockups: artifact `3cbb9ecd`**

## What changes for a coach

- **A finished season keeps its books, after the next one starts.** Today a coach can read the whole
  money book for a season that has ended — budget, dues, spending, fundraising, all of it — right up
  until the day the new season opens. Then it disappears. On that season's own **Season's End** page
  there is now a quiet closed section, **How the season added up**, that keeps the answer.
- **It opens to the season's statement:** what was planned per category, what was actually spent, and
  the difference — with the season total at the bottom, and a line for what came in from dues,
  fundraising and sponsorship.
- **The shut section already answers the headline.** Before opening it, a coach sees *"$110 under"*
  or *"$240 over"*. Most of the time that is the whole question, and they never open it.
- **Only coaches trusted with money see it.** The section is absent for anyone without money access —
  including assistants who can read everything else on that page.

## Why it matters

The gap was narrower than it looked, and the loudest part of it was reachability rather than a
missing feature: the product already computes and renders a finished season's whole money story, and
then makes it unreachable the moment the team rolls forward. A coach asked at the AGM what last
season actually cost has no way to answer.

Putting the statement on Season's End is the cheapest honest home. That page is already about one
named season, so nobody can be confused about which year they are reading, and it never appears
during a live season, so the screens a treasurer uses on a Tuesday cost nothing at all.

## The tradeoffs taken, with eyes open

- **One tab of seven, not the whole hub.** Only *Budget vs Actual* is a record of what happened; the
  other six are places where money is moved, billed, recorded or edited. Making those readable for a
  closed year would have been the season switcher coming back in money's clothing. A coach who wants
  the underlying detail can still export it while the season is current.
- **The statement is flat here.** On the live screen its figures are doors — into the budget editor,
  into a month's detail. In the closed book they are just figures. That is deliberate: a record must
  not be an entrance to a live tool, and two of those doors were quietly broken for two days last
  week without anyone noticing.
- **Past figures are shown CORRECTED, not as they looked at the time.** The statement's arithmetic
  was fixed on 2026-08-17, so an older season now adds up differently than it did then — and more
  accurately. Money should be right rather than faithful to an old mistake. This is the opposite of
  the call taken on playing time, and deliberately so: that report re-interprets judgement calls,
  this one adds up receipts.
- **Nothing points the portal at a past year.** No switcher, no second menu. The one page that
  already reads a named season is the one that gained the section.

## Priority

Small. It is one collapsed section and one existing report learning to answer for a named season —
no new database work, and nothing added to any screen a coach uses during the season.

## Success criteria

- After a season rolls over, a coach with money access can still answer "what did last season cost,
  and did we come in under?" from that season's own page.
- The Tuesday money screens are pixel-for-pixel unchanged.
- A coach without money access never sees the section, and is refused if they go looking.
- Nothing in the closed book opens a live editing screen.
