# PM Brief — Tournament Mobile Polish

**Status:** Proposed — awaiting owner sign-off. Nothing has been built.
**Full plan:** `TOURNAMENT_MOBILE_POLISH_PLAN.md` (same folder).

## What this is

A fan opened your tournament on their phone and we graded every public page against the Phase 3
mockups' bar: broadcast-scoreboard density, calm chrome, every number in the "data face," and
red reserved for one thing — what's live right now. We photographed and *measured* every page
(dark, light, and a custom-branded org; 390px and 360px phones; following a team and not), then
had every claimed problem independently challenged before it made this list. About 55 verified
improvements survived, organized into six shippable phases.

## What a fan gets, in plain terms

1. **"What's live right now" becomes unmissable and honest.** Today, on championship day: the
   home page body doesn't show the two semifinals being played (only the scrolling ticker does);
   the schedule opens on *pool play from two days ago*; the bracket labels a game in progress
   "Pending" in amber; and the game page already declares a Winner/Loser mid-game. After Phase 1,
   every surface agrees: live games lead, wear the same small red LIVE chip everywhere, and
   nobody gets called a loser until the game is over.
2. **Everything is comfortably tappable.** Roughly a dozen everyday controls — the share button,
   the alerts bell, Follow, the bracket zoom buttons, the banner dismiss — are below the
   platform's own minimum thumb size. One pass fixes them all without changing how anything looks.
3. **The first screen goes to the games, not the poster.** The home page currently spends up to
   two-thirds of the first screen on a hero banner (repeating the tournament name the top bar
   already shows), and the schedule spends nearly half the screen on controls before the first
   game. We slim these to a compact identity strip — and finally show the event's dates on
   mobile, which today only desktop users see.
4. **Numbers look like a scoreboard everywhere.** Scores, records, standings columns and status
   chips currently switch fonts and styles page to page (the same team record appears in four
   different styles). A small set of one-line fixes makes every number and chip read as one system.
5. **Branded and light-mode tournaments become fully legible.** On light-themed events, some
   status text and the "following/alerts on" indicators fall below readable contrast — one is
   effectively invisible. Fixes follow patterns the platform already uses.
6. **Two upgrades the mockups promise that today's pages don't have:** the field/diamond on each
   schedule row (the data is already loaded, just never shown), and — as its own follow-up
   project — a schedule that reads as one "today" timeline instead of splitting the same day
   across pool sections.

## What we deliberately protect

The score ticker, the live broadcast scorecards, the follow-a-team loop (pinned card, dock,
alerts), per-org theming, and the "Standings becomes the bracket on playoff day" behavior are
already at or above the mockup bar — nothing there is rewritten. No backend changes, no
navigation restructure, nothing removed.

## Decisions wanted at sign-off

1. Should the bottom "my team" bar slim itself on the two pages that already show the same live
   score inline? (Recommended: yes, auto-collapse.)
2. Green-light the day-first schedule timeline as its own follow-up project?
3. Approve the compact event header direction (eyebrow · title · one data line) for all pages?
4. Approve the single "quiet label" style so it can be logged as a binding design decision?

## Priority & effort

Phase 1 (live honesty) and Phase 2 (tap sizes) are the game-day payoff and are mostly small,
low-risk styling/logic guards — a fan feels both immediately. Phases 3–5 are polish that
compounds; Phase 6 holds the two structural upgrades. Every phase ships independently.

## Success criteria

- On a live tournament day, the first screen of Home and Schedule each shows at least one live
  game without scrolling or tapping; no surface anywhere shows "Pending"/W/L on a live game.
- Zero interactive elements under the 44px thumb floor on public pages (re-measured by the same
  harness that found them).
- Light-mode and custom-branded events pass the same contrast checks as the default theme.
- No horizontal scrolling anywhere at 360px (already true — must stay true).
