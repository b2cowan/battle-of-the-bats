# My Team Card — Unify the Followed-Team Card (PM Brief)

**Status:** Planned — design locked 2026-07-03 · Branch: dev · No migration

## The problem (what the owner saw)
On the public tournament pages, a fan who follows a team gets a "your team" card at the top — team badge, record, rank, and what's next. But that card is drawn **differently on the Standings page than on the Schedule page**. The Schedule version reads cleanly (badge, bold name, "vs opponent," a clear NEXT UP / LIVE block). The Standings version is a flat, cramped line of small grey text with no badge and no hierarchy — hard to scan. Owner reported it directly.

The root cause is that the same idea was built four separate times and quietly drifted apart, with nothing keeping them in sync.

## What we're doing
Build **one shared "My Team" card** and use it on both the Standings page and the Schedule page (mobile and desktop). Same badge, same bold name, same "record · rank · division," same "vs opponent," same NEXT UP / LIVE / FINAL block everywhere.

**Scope (owner-approved "compact trio"):** the Standings card, the Schedule mobile card, and the Schedule desktop card. The richer **home-page** card and the game-day **dock** (the little bar during games) stay as they are for now.

## What the user sees differently
- **Standings:** the followed-team card is transformed — it gets a team badge, the opponent, a proper NEXT UP / LIVE / FINAL block, and clear visual hierarchy, so it's as easy to read as Schedule. It also picks up two touches it never had: the card links through to the team's page, and its colour now matches the org's brand (it was an off-brand green before).
- **Schedule:** looks and behaves the same as today — no visible change. (It's the reference design; we're bringing Standings up to it.)

## Why it matters
- Fixes the reported readability problem on Standings.
- Ends the drift: the next time we improve this card (as we did in June), the change lands on every fan page at once instead of one place at a time.
- Sets up the broader **Standings Remodel** work, which touches the same page.

## Tradeoffs / risk
- Unifying means we **do touch the Schedule card the owner already likes.** The layout there won't change, but any shared-component swap on a live, real-time page carries regression risk — so Schedule (mobile + desktop) must be verified pixel-identical before sign-off. This is the accepted cost of killing the drift for good rather than maintaining a look-alike copy.
- The Standings card's colour visibly changes from green to the org's brand colour (intended — the green was inconsistent with every other followed-team surface).

## Success criteria
- Standings and Schedule followed-team cards are visibly the same card.
- Schedule mobile + desktop unchanged to the eye and still update live.
- Standings shows badge, record, rank-in-division, opponent, and a labelled NEXT UP / LIVE / FINAL block; "View my division" still works.
- No accessibility regression on the light fan surface (small labels still legible).

## Access / roles
No change — this is public, no-account fan UI on the public tournament pages.
