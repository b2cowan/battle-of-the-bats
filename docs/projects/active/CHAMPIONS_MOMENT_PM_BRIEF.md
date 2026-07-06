# PM Brief — Champions Crowned (tournament-complete moment)

**One-liner:** Give the *end* of a tournament the same celebratory "moment" the *start of playoffs* already gets — an automatic notification, a home-page hero takeover, and a shareable page — the instant the champion is crowned.

## The problem
Today, when playoffs finish, nothing changes on its own. The public home page stays stuck on "The Bracket Is Set" — as if the games haven't happened — until an organizer manually marks the tournament "completed." Most don't, so the event's biggest moment (crowning the champion) lands with silence.

Meanwhile, the *start* of playoffs is already a polished moment: a push + in-app alert to staff and fans, a home-page takeover, and a shareable "Playoff Picture" page. The finish deserves the mirror image.

## Proposed functionality
When the whole tournament's playoffs finish and the champion(s) are decided:
1. **A one-time alert** goes out — an in-app bell + push to staff, and a push to fans with score alerts on (Tournament Plus and above) — "🏆 Champions crowned," linking to the results.
2. **The public home page** flips to a **Champions celebration** — the winning team(s) front and center with runner-up and a share button.
3. **A shareable "Champions" recap page** is published (the finish-line counterpart to the Playoff Picture) — champions, final scores, final standings.

The alert fires once and never re-sends if scores are later edited. Formally "closing out / archiving" the tournament stays a separate, optional step the organizer can do whenever.

## Why it matters
- **Fans get the payoff.** The moment they care about most — who won — is delivered automatically, on their phone and on the page, instead of a stale "bracket is set."
- **Zero organizer effort.** It happens off the scores they already enter. No new checklist item.
- **Shareability = reach.** A clean "Champions" page is exactly what a winning team and a host org want to post — free distribution for the platform and the event.
- **Consistency.** Every tournament now has a beginning-of-playoffs moment and an end-of-tournament moment, on autopilot.

## Customer impact
- **Fans / families:** a celebratory push + page when the champion is crowned.
- **Organizers:** a more professional-feeling event with no extra work; the close-out step is now purely administrative.
- **Winning teams:** a shareable results page.

Also fixes a latent correctness issue: in tournaments with tiered brackets (e.g. a Gold/Championship tier and a Silver/Consolation tier), the champion shown is now reliably the **true championship winner**, not whichever final happened to finish first.

## Priority
High — small, self-contained, high-visibility; completes the "moments" pair the platform already started with the playoff-set feature.

## Success criteria
- The moment fires exactly once, only when the **whole** tournament's playoffs are complete (all brackets/tiers/divisions resolved), and never re-blasts on a later edit.
- The home hero and recap page show the **correct** champion in tiered brackets.
- Fan push respects the Tournament Plus+ gate; staff alerts work on all tiers.
- Hidden-standings tournaments don't leak results through the recap page.

## Explicitly out of scope
- Auto-marking the tournament "completed" (stays a manual close-out).
- A "division winner" moment for pool-play-only tournaments with no bracket.
