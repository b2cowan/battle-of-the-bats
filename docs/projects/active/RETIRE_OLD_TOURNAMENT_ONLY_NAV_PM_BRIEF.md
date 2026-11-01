# Retire the old tournament-only menu: PM brief

**Status:** not started. Opened 2026-10-30 (owner, during the Plan & billing Stage 3 walk). A census of what still depends on
the old menu comes first. Plan: `RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md`.

## What it is
FieldLogicHQ still carries a second, older left-hand menu for workspaces that only run tournaments: a "Tournaments" row and an
"Account" group (Staff & access, Audit log, Settings, PDF settings). The product's real tournament menu is the one inside a
tournament (Operations, Setup, Admin). This work removes the old menu, gives every page that still depends on it a proper home,
and gives the tournaments list one address instead of two.

## Why it matters
- **It already caused a mistake.** The new "Tournaments you run" door in the coaches portal landed on the old menu, because
  the tournaments list answers at two addresses and only one of them shows the real tournament menu. A coach following that
  link saw a menu no tournament user can reach any other way. It is fixed for those links, but nothing stops it recurring.
- **Two menus for one area is confusing.** Someone moving between the list and a tournament sees the menu change for no reason
  they can name.
- **It is a trap for the next feature.** Anyone adding a link to the tournaments list can pick the wrong address and ship a
  dead-end menu.

## What a customer would see
- Tournaments list: always the same menu as the rest of tournament admin, however they arrived.
- Staff & access, Audit log, Settings and PDF settings: still reachable, from a menu that matches the place they came from.
- No change to what any page does, and nothing disappears.

## Who is affected
Standalone coaches who host tournaments, and tournament-only workspaces. Clubs and the coaches portal itself are not changed.
Role access does not change; it only moves where the rows sit.

## Priority
Low to medium. Nothing is broken for customers today, since the known links are fixed. It should be done before more doors into
tournament admin are added (the Plan & billing and Stripe work add some), because each new door is another chance to repeat the
mistake.

## Risks and trade-offs
- **The main risk is stranding a page.** Some account pages, such as Staff & access for a standalone workspace, may only be
  reachable through the old menu. They have to be re-homed before the menu goes, which is why the census is step one.
- The old tournaments-list address should redirect rather than vanish, so bookmarks and old emails keep working.

## Success criteria
- One address for the tournaments list, and the old one redirects.
- Every page that used the old menu now shows a current menu, with each row still reachable on a computer and on a phone.
- A build check fails if anyone links to the old address again.
- The owner walks the tournament area from the coaches portal on a computer and a phone and never meets a menu that "isn't used anymore".
