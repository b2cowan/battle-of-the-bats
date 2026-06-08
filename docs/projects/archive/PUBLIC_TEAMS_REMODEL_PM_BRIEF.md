# PM Brief — Public Teams Pages Card Grid Remodel

**Status:** Built 2026-06-02 · Awaiting browser verification

---

## What we're changing

We're redesigning two public-facing pages that fans and parents use during a tournament: the **Teams list** and the **individual Team profile**.

---

## What users see after the change

### Teams list page

**Before:** A plain text list of team names, grouped into cards by pool. Very minimal — just names with a Follow button.

**After:** A **card grid** (three across on desktop, stacked on mobile). Each card shows:
- A coloured team logo tile (auto-generated initials + colour based on team name)
- Team name, pool label, W-L-T record, pool rank, and points — all at a glance
- A red pulsing **LIVE** badge when a game is currently in progress
- Next game time when no live game is active
- "Pool play complete" when all pool games are done
- Follow and Team → links in the card footer

The division filter now works like a selector between named divisions (no "show all" — always one division at a time). Within a division, teams are still separated by pool if the tournament uses pools.

### Individual team page

**Before:** A two-column layout — a stat sidebar (record + info) on the left, schedule list on the right.

**After:**
- **← All Teams** back link
- **Hero card** spanning the full width — team avatar, team name in large bold text, division/pool/coach subtitle, record + pool rank + points + run differential in a single row
- **Stat tiles** — a 2×2 grid (4-across on desktop) showing Points, Pool Rank (with "In playoff spot" label if applicable), Runs For, Runs Against
- **Form section** — coloured W/L/T outcome bubbles for the last 5 games (pool play + playoffs), plus a highlighted "Next Game" row with opponent and time
- **Schedule & Results** — game-by-game list with date, opponent, home/away, result badges (W/L/T + score), LIVE badge for in-progress games
- Roster section removed

---

## Why this matters

- **Mobile-first fans** now get a much richer experience — the old design was sparse on small screens
- **Tournament day usability** — live badges and at-a-glance stats are what fans want when they're at the park
- **Following a team** is more prominent: the followed team has a highlighted card border and the follow bar stays pinned at the top
- **Coaches and parents** can find record, rank, and next game without drilling into each team

---

## Success criteria

- Teams list renders the card grid correctly on desktop (3-col) and mobile (1-col)
- Avatar colours are consistent and visually distinct per team
- Live badge appears/disappears correctly based on game time window
- Individual team hero card shows correct record, rank, points, and run differential
- Form bubbles reflect actual game results (pool + playoff)
- Back navigation returns to the teams list for the correct tournament
