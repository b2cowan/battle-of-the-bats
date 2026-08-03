# Coach Sandbox with Season Phases — PM Brief

**Status:** Planned (owner agreed 2026-08-02). Plan: `COACH_SANDBOX_SEASON_PHASES_PLAN.md`.

## What a prospect sees

One tap from the coaches marketing page — no login, no email — and they're inside the real
premium Coaches Portal on a fictional demo team. A slim banner says "Sandbox — nothing here is
saved," and a dock offers five moments of a team's year: **Tryout day, Off-season, Season start,
Mid-season, Season's End.** Each tap drops them into that moment's best screen: live tryout
scoring mid-evaluation; a budget with real expenses and dues underway; a finished schedule; the
mid-season Overview with a game this Saturday; a closed season with its Wrapped recap. They can
wander anywhere, open anything, even edit on screen — and the moment they try to save, the
sandbox says: "Not saved here — start your own team free to keep this."

## Why it matters

The portal's breadth is its pitch, but breadth across a *year* can't be seen in one visit — no
single moment contains tryouts AND practice plans AND budgets AND Season Wrapped. The phase dock
answers the question every evaluating coach actually asks — "what does my October look like?" —
in five taps. And because the sandbox IS the real product (not screenshots, not a replica), it
always shows the current portal with zero drift, and it proves look-and-feel in a way no
marketing page can. It's also a shareable link: a coach who likes it can text it to their
co-coach, which is the cheapest word-of-mouth we can buy.

## Tradeoffs made

- **Look, don't keep.** Visitors share one demo team, so nothing anyone does is saved — edits
  work on screen and vanish. This is what makes no-login safe, and the save moment doubles as
  the signup pitch.
- **Phased delivery.** Launch with three moments (Tryout day, Mid-season, Season's End — the
  most differentiated), add Off-season and Season start next. The machinery is built once.
- **The closed season is real.** Season's End is produced through the genuine season-close
  process, per the archive ruling — slower to build, but the demo can never show a state the
  real product can't reach.
- All players and families are fictional; the demo can never email anyone.

## Bonus value

The five seeded teams become permanent internal QA fixtures and screenshot/marketing sources —
every future feature can be tested against realistic teams at five points of the season
lifecycle.

## How to test (owner QA at launch)

Open the sandbox link in a private browser window (no account): confirm you land in the portal
with the banner and dock; visit all launch moments and confirm each lands on its showcase screen
with alive-looking data; try to save a lineup edit and confirm the nudge (and that nothing
persists on refresh); confirm "Email families" cannot actually send; come back the next day and
confirm the demo still says "today" (dates re-anchored).

## Success criteria

A cold visitor reaches the portal in one tap and can see all launch moments inside two minutes;
nothing a visitor does persists or sends; the demo never shows stale dates; the "start your own"
door is present at every dead end.
