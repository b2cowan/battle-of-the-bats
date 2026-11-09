# Navigation across the three portals — PM brief

**Status (2026-11-09):** evaluation and drawings done; the owner's calls (E1–E13) are owed. Nothing built.
Plan: `ADMIN_NAV_EVALUATION_PLAN.md`.

## Proposed functionality
One way of saying "where you are" in the club admin, the tournament admin and the Coaches Portal:
- **The top of the sidebar names whose sidebar it is**: the club, the tournament, or the team. Where there is more than
  one tournament or team, a small chevron next to the name opens the list to switch. The plain form dropdowns go.
- **The bar at the top names the page you are on**, with a back arrow when you are one level down.
- **On a phone**, the bar names the page; the tournament or team sits on a small line under it, and tapping that line
  switches.
- **The Coaches Portal loses its second pinned bar** (the team bar), giving every coach screen back 56px.
- **The collapsed sidebar shows your logo** (club, tournament or team crest, already uploadable today).

## Why it matters
An owner who also runs a tournament and coaches a team meets three different answers to "where am I?" today: the club
in the sidebar, the tournament in the top bar, the team in a second bar, and a page name that scrolls away in two of the
three. The club admin was just rebuilt around one clear rule; this carries the rule to the other two so the product
feels like one app.

## Customer impact
- Club admins running a tournament: the tournament is always named at the head of its sidebar, and switching is one
  quiet click; the way back to the club ("Club overview") is unchanged.
- Tournament-only organizations: the same, and their organization-wide screens (Members, Plan & billing) clearly belong
  to the organization, not to whichever tournament was last picked.
- Coaches: more of the roster, schedule and practice plan on screen; the page name stays pinned; switching teams works
  the same way on a phone and a computer. A closed season still opens on its one page.
- Nothing changes about who can open what.

## Priority
After the Admin header bar project (closed 2026-11-09). The first build step fixes a real defect found by the audit: a
tournament page names the club for a moment before the tournament loads.

## Success criteria
- On every screen of all three portals, the sidebar's top names whose sidebar it is and the top bar names the page; no
  screen carries a second title.
- One switching control shape (name + chevron) everywhere; no native dropdown in any navigation.
- The tournament's name is right on the first paint (no flicker from the club's name).
- The coach desktop pinned area drops from 104px to 48px.
- A multi-role owner walks club → tournament → coaches portal and back on a computer and a phone without looking in
  more than one place to know where they are (the closing walk).
