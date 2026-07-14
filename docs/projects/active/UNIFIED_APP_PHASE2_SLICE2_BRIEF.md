# UX Brief — Phase 2, Slice 2: The Follows feed comes alive

**Status:** proposed — for owner sign-off before build. No database change (reads existing game/schedule data). Follows on from Slice 1 (accounts + follows), which is built.
**Visual reference:** Screen 3 ("The Follows feed") in the approved Phase 2 mockups — https://claude.ai/code/artifact/fb678e17-c8ef-44b0-bc52-ec17c74ab9fe

## In one line
Slice 1 made **Following** a list of the teams you follow. Slice 2 turns that list into a **live game-day feed** — each team shows what's actually happening right now.

## What changes for people
- **The Following tab becomes a feed, grouped by what matters most:**
  - **Live now** — teams playing this second, with the score: *"Thunder 3–2 · Top 5th"* (pulsing green). Tap → straight to the live game.
  - **Coming up** — the next scheduled game: *"Riptide · Sat 10:00 AM · Field 3"*.
  - **Recent** — the latest result: *"Lightning beat Sharks 7–4 · Final"*.
  - Anything live floats to the top, so opening the app on game day shows your teams' live scores first.
- **The Scores tab becomes a clean platform-wide live board** — every tournament underway across FieldLogicHQ, whether or not you follow it; this is where you *discover* live action beyond your own teams. (Decision 2026-07-13: your live teams live only in **Following** now, so the two tabs no longer overlap — the old "your live teams" strip comes off Scores.)
- **Signed out**, the Following feed still works on this device's follows (same as Slice 1) — enriched with live game state, so a no-account fan gets the game-day view too.

**The tab split, in one line:** **Following = your teams** (live/next/recent, personal) · **Scores = everyone's live games right now** (discovery) · **Discover = the full searchable directory** (all states).

## What stays the same
- The follows themselves, the account + "claim your device follows" flow, and the anonymous device path — Slice 2 only changes **how each followed team is displayed**, not how following works.
- No pricing/gating change. (Alerts are Slice 3.)

## Why it matters
This is the payoff of following: the app becomes a **game-day dashboard for your teams across every tournament**, not a static bookmark list. It's what makes a parent open the app instead of texting "what's the score?" — and it's the retention hook the whole consumer layer is built to earn.

## Tradeoffs & notes (plain-language)
- The feed reads live game data for each followed team across possibly several tournaments, so there's a **freshness-vs-load** balance: in this slice the feed refreshes when you open it (and can auto-refresh while you watch), rather than holding a constant live connection. Real-time *push* alerts are Slice 3.
- **No new database table** (a deliberate contrast with Slice 1) — this is a read/display layer over game data that already exists.
- A team between games shows its next game or last result; a team whose tournament has nothing scheduled shows a quiet "no games yet."
- A followed team whose tournament ended or was removed drops out cleanly (no dead rows).

## How you'll test it
1. Follow teams across three states — one in a **live** tournament, one with an **upcoming** game, one that's **completed**.
2. Open **Following** → confirm the live team shows a **score at the top**, the upcoming shows a **time/field**, the completed shows a **final result**.
3. Tap each row → lands on the right game/tournament.
4. Open **Scores** → your live followed team shows its score in the strip.
5. Signed out, repeat with device follows → same enriched feed.

## Not in this slice
Per-team alert preferences (All / Game-day only / Mute) and the honest **"alerts not offered by this event"** gate — that's **Slice 3**, the final piece of Phase 2.
