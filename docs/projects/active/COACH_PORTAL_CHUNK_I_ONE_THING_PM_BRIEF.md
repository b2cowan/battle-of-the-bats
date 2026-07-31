# PM Brief — Coach Portal Chunk I: The One Thing

**One line:** the team Overview stops shouting five things at once and says one — the single thing that
matters to *this* coach today — with their team's real numbers directly underneath it.

**Status:** planned, not started. Direction approved 2026-07-30.
**Binding mockups:** `claude.ai/code/artifact/5ae1c9e4-c31e-4f83-a098-3fbaa0ae15cd` (phone + permissions).

---

## Why this is worth doing

A coach opened their Overview and was told, in two cards stacked on top of each other, to **add an event**
and to **close out the season**. Both cards were working as written — they just fire on the same situation,
and nothing on the page decides which one wins.

That's the visible symptom. The underlying issue is that the Overview has no sense of priority: nine
separate blocks each decide for themselves whether to appear, and they appear in whatever order they happen
to sit in. The result reads as a jumble, and the coach is left to work out which instruction to believe.

Meanwhile the part of the page with actual information — dues owed, roster size, budget, tournaments —
starts below the fold, behind two onboarding prompts, the contradiction, a tournament banner and the season
record. A coach in week nine of their season scrolls past everything the product knows about their team to
reach the only part they came for.

---

## What a coach sees differently

**One card at the top, never two.** The page opens with a single card that says the one thing that matters
right now. On a game day that's the game — opponent, arrival time, who's confirmed, whether the lineup is
set, and a Build lineup button. On a quiet week it's a question only the coach can answer — *"Your season
looks finished — 6–4, last game three weeks ago. Close it out?"* — with **"add the next event"** offered as
one of the answers, so nobody loses the door the old card was giving them. In the first week it's the next
setup step.

**Their team's numbers immediately underneath.** Six tiles — always the same six, in a slightly different
order depending on what's happening — sitting directly below the card instead of at the bottom of the page.
On a phone, four of them are visible without scrolling.

**A quiet tail instead of scattered bands.** Finished tournament, last season, this week, the announcements
nudge — everything that isn't today's work — collapses into one calm list at the bottom.

**A finished tournament now says it's finished.** Today a tournament that ended two weeks ago sits near the
top of the page with no label at all, in the same position a live one would occupy.

---

## Role differences — this is the part to review closely

The page now shows exactly one action, which means showing the wrong one to the wrong coach makes the whole
page useless. So the rule is: **the situation proposes a card; the coach's permissions decide whether they
get it.**

- **Lineups, schedule and attendance** are all-or-nothing grants — a coach either has the tool or doesn't
  see it at all — so "Build lineup" can never appear for someone who can't build one. On game day the
  button steps down gracefully: Build lineup → Take attendance → just the facts. The card never vanishes,
  because opponent, time and place matter to every coach on the staff.
- **Closing a season** is a head coach's job. An assistant sees the same sentence with no button:
  *"your club closes the season — your Season Wrapped appears here when they do."* That's how it already
  works today and it doesn't change.
- **Adding players** is head-coach-only. An assistant must never be told to do it. (This exact mistake was
  caught and fixed once before in the portal; the safeguard already exists and this work reuses it.)
- **Money** can be granted as read-only. Those coaches see the numbers and never a money button.
- **When nothing is actionable** for a coach, no card appears and the page simply opens on their numbers.
  A calm board is better than narrating a situation the reader can't act on.

**Assistant coaches gain two tiles they've never had.** A coach without money access loses the Dues and
Budget tiles — so instead of a thinner page, those two slots fill with the questions they actually own:
**Attendance** (*87% season average · 3 players under 70%*) and **Playing time** (*fairly even across 10
games · 2 players well below*). Both come from data the portal already collects and already protects
correctly; neither is visible at a glance to anyone today.

---

## Impact on other areas

- **The Season setup chip becomes the only home for onboarding.** The "New here? Take the 2-minute tour"
  offer stops sharing a bar with this season's next task — they were unrelated and read as one instruction.
- **The season record moves into a tile.** Its League / Tournament / Scrimmage filters move to the record
  page; the headline numbers stay on the Overview.
- **The free coach portal is unchanged** this round, apart from also gaining the "finished tournament"
  label. The two tiers will look further apart, which is consistent with the agreed direction (free = a
  companion, premium = an operating tool).
- **Nothing is stored differently.** No database change, no new data collection.

---

## Priority and sequencing

**High** — this is a reported defect on the portal's landing page, and it is the first screen every premium
coach sees.

The work splits into four passes, and **the first one alone fixes the contradiction** and can ship on its
own:

1. The single card and the quiet tail — closes the reported bug.
2. The six-tile board and the reordering.
3. The two new assistant-coach tiles.
4. Permission testing across coach types, plus help-guide updates.

---

## How to test it

Open a team's Overview as a head coach on four different teams — one with a game today, one with a game
later this week, one that's been quiet for three weeks, and one just starting out — and confirm you get
exactly one card each time, and that it's the right one.

Then repeat as an assistant coach with money access turned off, and again with lineups turned off. The card
should change or lose its button, never break, and never offer something the assistant can't do.

On a phone, check that the card and at least four numbers are visible before you scroll.

---

## Success criteria

- No coach, in any state, sees two instruction cards at once.
- A coach's team numbers are visible without scrolling on a phone.
- Every action on the page can be completed by the coach being shown it — verified across six coach types.
- A finished tournament is labelled as finished.
- An assistant coach's Overview is a full board, not a gap where money used to be.

---

## Open questions for the owner

1. A head coach who has set up neither dues nor a budget sees two greyed-out tiles side by side. Should
   those collapse into one "set up your team's money" tile until they've started, freeing a slot for
   Attendance? *(Recommended: yes.)*
2. Should head coaches also see the Attendance and Playing time tiles? That would mean a seventh tile.
   *(Recommended: no — they reach both from Insights, and money is the burden only they carry.)*
3. Confirm the season-record filters can live on the record page rather than the Overview.
   *(Recommended: yes — they're a setting, not a glanceable fact.)*
