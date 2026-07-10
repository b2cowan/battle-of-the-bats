# Registration Health Panel — PM Brief

## What changes for the organizer

The Registrations page now opens with a **Registration Health** card, right under the page title — the same "score out of 100 + at-a-glance tiles" format as the Schedule page's Schedule Health card. It's collapsible and remembers open/closed like the payments summary already on this page.

- **Score (0–100):** one number that tells you, at a glance, whether this tournament's registrations need attention.
- **Four tiles:** Teams accepted, Missing email, Payments (Tournament Plus only), Needs action (stuck-in-review or unplaced teams).
- **Issue list:** plain-English lines like "3 teams missing an email" or "U11: 9/12 filled — registration is closed with open spots left," each one clickable to jump straight to that filtered team list.

Nothing here requires new data entry — it's entirely built from information already on the page. It replaces "go check three different filters to see if anything's wrong" with one glance.

## Why it matters

Before this, an organizer had no single place to ask "is this tournament's registration in good shape?" Missing coach emails in particular were invisible until this session — there was no indicator anywhere that a team couldn't be reached. Now that's caught automatically and surfaced with a one-click fix path.

## What's gated vs. free

- Everything except the Payments tile works on every plan.
- Payments (unpaid / past due tracking) requires **Tournament Plus** — on lower tiers, that tile shows a small "Plus" badge and opens the upgrade prompt instead of showing numbers it can't accurately track (since fee schedules aren't a base-tier feature).

## What's NOT changing

- The Dashboard page's existing Registration and Payments panels are untouched — this lives only on the Registrations page itself, per your call not to duplicate what the Dashboard already shows.
- No new settings, no new required fields, no pricing/gating change.

## How to verify

1. Open Registrations for a tournament with a mix of statuses (some pending, some accepted, at least one missing an email).
2. Confirm the Registration Health card appears under the page title with a score and four tiles.
3. Click the "Missing email" tile (or its line in the issue list below) — confirm it jumps to the filtered team list from the earlier fix.
4. If on a non-Plus plan, confirm the Payments tile shows the "Plus" badge and clicking it opens the upgrade message rather than numbers.
5. If any division is closed with open capacity, confirm a line like "U11: 9/12 filled" appears and clicking it switches you to that division.

## Priority / status

Built, not yet browser-tested. Needs a dev-server restart (new files) before you can see it. `/review` recommended given it touches the shared registration-attention module used elsewhere (dashboard chips, deep-links).
