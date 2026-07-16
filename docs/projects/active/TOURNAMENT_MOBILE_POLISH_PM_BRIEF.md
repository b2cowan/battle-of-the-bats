# PM Brief — Tournament Mobile Polish

**Status:** In flight — Track A + Round 1 are built and committed; Round 2 is built on dev
(awaiting your phone pass); Round 3 mockups are ready for your decisions (see the Round 3
section at the bottom). Nothing below has been removed or restructured — only polished.
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

## Round 3 (ALL FOUR DECISIONS ACCEPTED 2026-07-16 — design work complete, build queued)

**Mockups:** `claude.ai/code/artifact/0d4161cc-0583-4167-9bc6-78683508e3b9` — real phone
screenshots of today's pages beside drawn proposals, photographed during a genuinely live
playoff day. All four decisions below were accepted as recommended on 2026-07-16 (the "my team"
bar shrinks on the two duplicate pages), plus one copy call: the team page's "Form" card is
renamed **"Recent results."** The build runs after the Round 2 work is committed.

**What this round covers.** The last two fan surfaces — the Teams list and the individual team
page — plus the one policy question deferred since Round 1: what the bottom "my team" bar does
on pages that already show the same live score.

**What a fan gets:**

1. **The team page stops making you scroll for results.** Today the team header (name, three
   full-width buttons, stats) eats about 40% of the screen before a single game appears. The
   proposal keeps every button and every stat but fits them in one row, so the team's form and
   its live game land on the first screen. The page also finally gets a **score-alerts switch** —
   fans decide they care about a team on this exact page, and until now it was the one place
   that couldn't turn alerts on.
2. **A team's games read like the schedule.** The team page's game list still uses an older,
   bulkier card style — about 1.7× fewer games per screen than the main schedule, in a
   different font system. It adopts the schedule's row look: date · time · diamond on one quiet
   line, the score in scoreboard digits, and the live game on top showing its running score
   (today that row shows only a "LIVE" tag, no score).
3. **The Teams list gets the scoreboard treatment.** Records align digit-for-digit down the
   list, pool headings and "1st · 6 pts" labels match the rest of the app's data styling, and
   the coach's name appears as a quiet second line under the team (same treatment standings
   already got in Round 2). The bottom navigation labels join the same type system.
4. **The "my team" bar question (the one real decision — G1).** When you follow a team, a bar
   with its live score rides above the navigation on every page. On two pages it duplicates
   what's already on screen: the Schedule (which pins your team's card up top) and the team's
   own page. Both options are mocked side by side: keep the bar full-size everywhere, or let it
   shrink to a small floating score pill on just those two pages (tap to bring it back; it
   never disappears, and nothing it offers is lost). **Recommendation: shrink it there** — on
   those pages it only repeats what the page already says, and hides content behind its own
   duplicate.

**Why it matters.** This is the last of the fan-facing polish: after these four calls, every
public page speaks one visual language, and the plan's remaining work is build-only. The alerts
switch on team pages is also a small growth lever — it puts the "notify me" moment where the
interest actually forms.

**Expected impact.** More games visible per screen on team pages (~1.7×), one fewer dead-end
for alerts sign-ups, a Teams list that reads like the rest of the event, and (with the
recommended dock choice) a full row of content back on two busy pages.

**Priority.** Medium-high — it completes an already-committed initiative while the test events
are fresh; all four items are small builds that reuse conventions Rounds 1–2 already shipped.

**Success criteria.** On a phone: team page shows results without scrolling; its game rows
match the schedule's look and density; records on the Teams list align vertically; alerts can
be turned on from a team page; and (if approved) the my-team bar shrinks on Schedule + team
pages and springs back with one tap. Nothing anywhere is removed.

**The one open policy question (G1), in one sentence:** on the two pages that already show your
team's live score inline, should the bottom my-team bar stay full-size or shrink to a tap-to-
restore pill (recommended: shrink)?
