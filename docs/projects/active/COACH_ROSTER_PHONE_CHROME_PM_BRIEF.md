# PM Brief — Roster on a phone: four cards above the fold instead of one

**Built on dev 2026-08-24 · owner QA §93 owed · no migration · no data change**

Mockup: https://claude.ai/code/artifact/59f76b6b-9d4a-4fb4-a7f4-b3c66b7581de

## The problem

A coach opening the Roster on their phone saw **one player**. Everything above the list — the team
bar, the page title, the count, the view toggle, the export, and two lines of hints — filled roughly
two thirds of the screen. The list the page is named after started near the bottom.

## What a coach sees differently

**The team bar is two lines instead of four.** It says who you are — team, your role, club, season —
across the full width, and stops. The "Next Wed 6:00 p.m. practice" line no longer appears on a
phone. Neither does the game-day line: a coach knows they have a game, and that space is the
scarcest on the screen.

**The count, the List / Depth chart toggle and the export share one row** instead of stacking into
three. The export sits at the right-hand end where it belongs, rather than tucked underneath on the
left where it had drifted.

**One hint line above the list, not two.** The warning about players missing a position stays on
top, because that is something to act on. The tip explaining the reorder arrows moved below the
list, next to the arrows it describes.

**Net: the first player now appears about 244px down instead of roughly 400 — four cards above the
fold instead of one.**

## What does not change

- **Desktop and tablet are untouched.** The next-practice and game-day lines still sit in the team
  bar there; nothing moved, nothing shrank.
- **Nothing becomes unreachable.** On game day the bench console is still one tap away: the
  **Schedule** tab is on the bottom bar of every page, and the game's row there carries its own
  **Game day** button. The Overview card offers it too.
- **The public-site link stays on phones.** It shares the same corner as the status but is a door
  rather than a fact, so it was deliberately kept.
- **The Schedule screen gets the same one-row toolbar for free**, since both screens share it.

## Tradeoffs taken

- **A coach on a phone loses the at-a-glance "what's next".** Judged acceptable: it already
  disappeared the moment they scrolled, and the Overview and Schedule tabs both answer it in one tap.
- **The game-day shortcut in the team bar is gone on phones.** Argued for keeping and overruled —
  correctly, because two attempts to keep it at 390px produced an ellipsis rather than a usable link.
- **The title band was left alone.** It is the single biggest remaining saving, and changing it is a
  decision about all forty coach screens rather than this one.

## The guides were updated too

Two in-app help articles described something a phone no longer shows, and both were fixed in the same
unit of work:

- **"The bar across the top"** now says plainly that on a phone the bar is your team and season only —
  on game day as well — and points at Overview or Schedule for what's next.
- **"Game day: running the bench from your phone"** no longer tells a coach to tap a line in the top
  bar that isn't there. It names the **Schedule tab at the bottom of the screen** as the quickest way
  into the bench console at the field.

**The old search words were kept on purpose.** A coach whose phone stopped showing "next event in the
header" will search exactly that phrase — so it still finds the article, which now explains where it
went. Removing the term would have hidden the answer at the moment it's most wanted.

## How to check it

Open a team's **Roster on a phone** (or a 390px-wide browser window):

1. The team bar is two lines, with no "Next …" on the right.
2. The count, the toggle and the export are on one line, export at the right edge.
3. Only the position warning sits above the list; the reorder tip is below it.
4. Tap the export — every file it offered before is still there.
5. Widen to a desktop window: the team bar's right-hand side is back, exactly as before.
6. On a game day, check the **Schedule** tab still offers **Game day** on the game's row.
