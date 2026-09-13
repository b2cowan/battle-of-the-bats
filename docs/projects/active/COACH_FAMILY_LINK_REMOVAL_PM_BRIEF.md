# PM Brief — Family link removal (Coaches Portal)

**Decision:** owner, 2026-09-12. **Plan:** `COACH_FAMILY_LINK_REMOVAL_PLAN.md`. **Hub:**
https://claude.ai/code/artifact/46987cce-34c3-4643-b0e8-b09d6e5c0f1f (mockup · brief · plan ·
decisions · QA walk).

## What changes for the coach

The **Team family access** section disappears from the bottom of the Roster page. A coach can no
longer create a family link, nobody can use one to ask to follow the team, and there is no
follower list or approval queue to tend. The Roster page ends where the roster ends.

The one control on that card that still does something — **Schedule visibility** (Staff only /
Families / Public link) — moves to **Team settings → Sharing**. Same three settings, same
meanings: Staff only keeps games and practices inside the coaching staff and stops a shared game
page opening; Families lets connected people see the full schedule; Public link also puts it on
the team's public page. The Sharing section's summary line names the current setting, so a coach
doesn't have to open it to know. Head coaches and assistants who manage the schedule can change
it; everyone else sees it as text.

Nothing else in the family layer changes: a player's parent or guardian keeps their portal
(behind the platform-wide guardian switch, which stays off pending the privacy review), the coach
still previews the family season recap on a player's page, sharing a single game link still
works, and the club admin still sees how many families are connected per team.

## Why it matters

Grandparent-and-relative following was a door the owner decided the product does not need.
Leaving the card in place would keep showing every premium coach a "Create link" control for a
path being retired, and would keep an unused approval queue on a page coaches visit every week.

## Customer impact

No customer loses anything they were using: on production, no team had ever created a family
link and no follower existed. Every premium coach sees a shorter Roster page and finds Schedule
visibility in Team settings the next time they look for it — the help guide tells them where it
went, in plain words, and why.

One consequence for later: when the guardian tier opens, a parent will get in only through a
coach-sent invite — there is no longer a team link to ask through.

## Priority

Owner-directed. Small in customer impact; medium in code (a database step ships with it and must
be on production before or with the release — never after).

## Success criteria

- No coach screen, help article or API offers a way to create, share, request through, approve
  or reset a family link.
- Schedule visibility is set from Team settings and still governs the public team page and
  sharing a game.
- Guardian portal, family recap preview and game-link sharing behave exactly as before.
- Build gates green: type check, unit tests (3,639 pass), help-search spelling, dictionary
  coverage, CSS selectors, demo worlds — and schema parity once the migration is on both
  databases. Family-layer access probes: 38/38 pass.
