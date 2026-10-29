# PM brief — Public tournament pages: easy to read in a parking lot, and a door to the club

**Status:** drawings ruled 2026-10-27; Stages 1 and 2 built and owner-walked (plan §9). Stage 3 Part 2 implements the
phone Schedule behind the preview switch (committed `68acfe331`, 2026-10-29); Part 3 adds the game page and desktop
arrangement on the same date. Owner visual checks are recorded separately. Priority: the next public-page stage.
Plan: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`. Mockups: the review hub (Claude Artifact).

## Stage 3 Part 2 — the phone Schedule (2026-10-29)

Families choose a division and stage in two rows, land on today's games and open earlier confirmed results when needed.
Live games show their scores and Directions in their time slot. Search still finds teams and public coach names. The
Playoffs list keeps placement standings above its games and ends with a bracket door to Standings until Stage 4 moves it.
Cancelled games have no Directions; unconfirmed scores read Unofficial. A held-back division reveals no games.

My games and the followed team's calendar are installed-app controls only. Following is done on a team's own page;
the old follow strip, scorebug, year picker, alerts, My Team rail, repeated heading and List/Bracket switch do not appear
in this Schedule. The admin preview has plain rows with no game or maps links. The preview switch preserves the current
customer-facing Schedule until Stage 8.

Success: a family can find when and where without passing the old control stack; hidden games stay hidden, deep links
open the right game, and live updates preserve each game's place. The owner checks the fixtures at 360 and 390 px;
Part 3 adds the game page and the full desktop arrangement.

## Stage 3 Part 3 — where and when first (2026-10-29)

A family opening a game sees its time, field, address and a full Directions button before the score. The next card
shows both teams, the round and the game's state; the last card holds the division, round, game length and any notes.
Championship names the round; Final describes a confirmed result. A cancelled game keeps its address with no Directions,
scores or share action. An unofficial result keeps the scores and share action and says it awaits confirmation.

On a desktop, Schedule controls and rows use the available width; the game's facts sit beside its location and score.
My games and calendar remain exclusive to the installed app. The admin preview keeps plain Schedule rows and has no
separate game-page destination. The preview switch preserves the existing public pages until Stage 8.

Success: Directions is on the first phone screen; the desktop adds room without changing the task; scores update as
before, a game enters/leaves Live now at the correct time, and a newly withheld game disappears from an open page.

## What changes for a family
- **The phone home answers "where is my next game" on the first screen.** On game day it opens with your team (if you
  follow one), the games being played now, and the next games with their field and directions. Today the next
  scheduled game is about two phone screens down, under repeated summaries.
- **Calmer to read.** Tournament pages move to the same light ground, type and white tab row as the club's own site.
  The capitals in a typewriter face go. The organizer's colour stays the first thing you see, as a band across the
  top.
- **Nothing is taken away.** Parts with nothing in them no longer show as big empty boxes; everything that has
  content is still there, a tap away at most.
- **One word for each state**, matching the club's Tournaments tab: Live now, This weekend, Registration open, Finished.
- **The pay link is a focused page** with no tournament menus beside it.
- **Every page leads with its job** (round 2): the Schedule opens on today's live and next games; a game's page opens
  with when, where and Directions; Standings opens with the table (the bracket moves to Playoffs); a team's page opens
  with its next game. Tabs with nothing in them (News, Rules) hide; Register and Champions become tabs while they
  have something to show.
- **In a phone browser these are web pages** (no app bar, Sign in at the top, as on club pages); inside the installed
  app the app bar is there.

## What changes for a club
- **The club gets advertised, not just linked.** A card on the tournament's home shows the club and what is open
  there right now (a tryout, a house-league sign-up), with a "Visit the club" button. Every tournament page's footer
  says who hosts it.
- **Sponsors on tournaments.** The club keeps one sponsor list and picks which tournaments each sponsor appears on.

- **The club decides how its tournaments look.** One new setting on the club's public site: "Club's look by default"
  (a tournament can be given its own) or "Always the club's look". A tournament's own
  settings show "The club's colours" as a real choice, with a preview. Switching the rule never erases a tournament's
  own look.

## What changes for a standalone organizer (not a club)
- The same calmer pages in the organizer's colour if their plan includes branding, or a neutral dark band if it is a
  free event. No club card. Nothing depends on a club existing.

## Found along the way (fix first)
- **A schedule the organizer has not published can still reach families**: the tournament home lists its games while
  the schedule page says "coming soon" and team pages say no games. This is a real defect, not demo data, and it is
  worth fixing before any redesign.
- **A club's tournaments lose the club's colours without anyone choosing that**: the first time anyone saves a
  tournament's settings page, even to turn a page on or off, it switches to the FieldLogicHQ default look.
- A few small wording bugs: a game in play with no score shows a lone dash; the club home calls a tournament three
  weeks away "Live"; the countdown says "First pitch", which is one sport's word.

## Why it matters
- A tournament is the moment strangers see a club. Today that moment is a dark, dense page with a small name link.
- Families read these pages outdoors on a phone; daylight-readable pages are the job.
- Clubs and their tournaments should feel like one product.

## The trade
- The dark game-day look and the organizer's dark/light switch go away (a fallback keeps dark as an option).
- Two older design rulings are reversed knowingly: tournament pages "stay the venue" in their own dark look, and the
  uppercase typewriter labels. The venue idea survives as the organizer's colour band.

## Success looks like
- On a 390px phone on game day, the first "Up next" game is on the first screen.
- No empty boxes on any tournament page.
- A visiting parent reaches the club in one tap, and sees something to sign up for.
- A club and its tournament side by side read as the same site in two colours of the same frame.

## Owner decisions needed (in the hub's Asks tab)
The ground, the type, the home's order, the club card, sponsors (and their plan gate, via `/strategy`), the pay page,
fixing the defects now, and the state words.
