# Stage 8 — the new look on for everyone (PM brief)

**Status:** asks A–D ruled 2026-11-03; Parts 1–5 committed on `dev` (2026-11-03 to 11-04); Part 6a (the whole-stage review,
the layout check, the owner walk §456) built 2026-11-04. **Stage 8 is ready to ship; the promote is 6b**, its own release
session when the owner calls the release. Nothing has reached customers yet. Plan: `PUBLIC_TOURNAMENT_STAGE8_PLAN.md` (§20).

## What it is
Every public tournament page has been rebuilt in the new look (light, the venue's colours on the club's ground, pinned tabs, the readable
schedule and standings, the focused pay page). Customers still see the old pages, because the new ones are behind a private preview switch.
Stage 8 turns the new look on for everyone, removes the old pages and the switch, and updates the help guides and the demo to match.

## What a customer sees and does differently
- **Visitors and families:** the new pages, with nothing to opt into. The same links keep working.
- **Organizers:** the Branding page keeps only controls that change something: a Look card (colours and type, with a live preview of the
  tournament's band) and the logo. The old Dark/Light, Font, Card style, Hero banner and App icon controls are gone.
- **Installed or home-screen icons:** always the FieldLogicHQ icon. (This was ruled 2026-11-03: the product is one branded app that reaches
  many teams and tournaments. In practice only the iPhone "Add to Home Screen" icon changes; installed apps already use ours.)
- **Role differences:** none beyond the above; club owners keep their club-wide rule for their tournaments' look.

## Why it matters
Two public looks have to be maintained and tested while the switch exists, and the demo and help guides cannot tell the new story until
it is on. This is the stage where the whole redesign reaches customers.

## Impact
Small today: production holds 6 tournaments; none carries stray default colours; 3 hold an old font value, which the release empties.
The risk is in the **size of the deletion** (thousands of lines of old page code and about 150 lines of tests that read the old code),
not in the data.

## Decisions waiting for the owner
A: retire the tournament hero banner (recommend yes). B: Dark/Light, card style and per-tournament font go (recommend yes; already implied
by Stage 1a). C: drop the dead database columns now or later (recommend later). D: icon change in the same release as the flip (recommend
yes).

## Priority and success
Next after the owner calls. Done when a customer opens any public page and sees the new look with no step, the Branding page has no dead
control, the demo tour lands on every step, nothing refers to the switch, and the build and layout sweep are green.
