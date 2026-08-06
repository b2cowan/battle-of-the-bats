# PM Brief — Standings Page Remodel + Race to Playoffs

**Status:** Planned  
**Priority:** High  
**Tier:** All tiers (public-facing feature)

---

## What we're shipping

A complete remodel of the public tournament standings page, adding two features: a visual "Race to Playoffs" view and a live playoff bracket display.

---

## What customers see

### New: Race to Playoffs view (toggle)

A view toggle appears on the standings page for any division where a playoff structure is configured. Standard view remains the default; a single click switches to Race to Playoffs.

The Race to Playoffs view shows the top 3 teams as large podium cards — the leader centred and raised, 2nd and 3rd flanking. Each card shows the team's badge, points total, and record. A bold dashed red line across the page marks the playoff cutoff ("PLAYOFF CUTOFF · 4 ADVANCE"), instantly showing fans which teams are in and which are out. If a user has starred "My Team," their card gets a "YOU" chip so they find themselves immediately without reading numbers.

Teams ranked 4th and below appear as compact rows beneath the podium, carrying the same cutoff context.

### Improved: Standard view

The "My Team" bar at the top of the standard table gets a cleaner wide-card treatment that shows current position and final result more prominently. The table itself is unchanged.

### New: Live playoff bracket

Once playoff games are scheduled, a read-only bracket diagram appears beneath the standings — showing who plays who in each round, current scores, and advancement. On desktop this is a visual bracket tree with connecting lines. On mobile it collapses to a grouped rounds list.

When all pool play games are complete and the playoff phase begins, the bracket automatically moves to the top of the page and the standings table moves below it — reflecting the shift in what fans care about.

---

## Why it matters

The current standings page is a stats table. For a tournament fan or parent, the most important question is "is my team making playoffs?" — that answer requires reading 6 rows of numbers and knowing the cutoff. The Race to Playoffs view answers that question in one glance.

The playoff bracket gives fans and coaches a single public page to track advancement through the tournament — no more checking back and forth between schedule and standings.

---

## Who benefits

- **Fans and parents** — instant visual answer to "are we in?" without reading the full table
- **Coaches** — bracket visibility during live playoffs without needing admin access
- **Tournament organizers** — the page sells the drama of the tournament better, especially for multi-day events

---

## Success criteria

- Race to Playoffs view renders correctly for 4-, 6-, and 8-team divisions with and without pools
- Playoff cutoff line appears at the correct position based on `teamsQualifying`
- "YOU" chip correctly identifies the followed team
- Bracket renders all rounds in correct elimination order
- Bracket flips above standings when pool play completes
- Both views are fully usable on mobile
- Standard view is the default; preference is remembered per division per browser
