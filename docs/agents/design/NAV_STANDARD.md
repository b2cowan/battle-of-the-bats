# Nav standard

**Ruled 2026-10-17** by the owner, all fourteen asks of the Nav Consistency Review as recommended (*"looks good, i agree
with your recommendations"*). Hub: https://claude.ai/artifact/RtcrWCxpfuNMkTRQMK8pA3 (source
`docs/projects/active/NAV_CONSISTENCY_REVIEW_HUB.html`). This is Club Tier Stage 8's nav review
(`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6).

**Covers:** the desktop sidebar, the phone bottom bar and the phone More sheet of the club admin, the tournament admin
(the same sidebar, in tournament mode), the Premium Coaches Portal and the free Coaches Portal. Platform admin is an
exception (below).

**Built** 2026-10-17 by `docs/projects/active/NAV_CONSISTENCY_PLAN.md`, stages A–D (§10 there has the as-built notes;
the QA walks are owed). Two rulings joined at the build, the same day: **one club phone bar** and its tile set (N8), with
their fill rule. A new nav row, sheet row, icon or tile is checked against
this page, the way a table is checked against `TABLE_AND_LIST_STANDARD.md`. A departure is written into the
exceptions below when it is made, never discovered later.

---

## The rules

| # | Rule |
|---|---|
| **N1 · Type** | Sidebar rows 14px, icons 14px, the sidebar foot 12px. Group headings are 11px capitals (`--type-label`), 700, 0.1em tracking, quiet ink, **in the sidebar's face, in the sidebar and in the More sheet** (Ask A1). On a phone, sheet rows are 16px with 17px icons, and a long label wraps in its column: the column gives, never the word. |
| **N2 · Headings** | A heading over **pages** folds (the chevron at its right), and the group holding the page you're on is always open. A heading over **places** (Programs, Organization, Tournament) never folds; a place opens because you're in it. Both kinds share one size and one spacing: 12px above, 6px below. |
| **N3 · Chevrons** | A sidebar row carries a chevron only when it can open pages under it (Ask A2): Rep teams, House league (a season's pages), Families, Organization. Public site opens one page and carries none. One strength everywhere: 55%. |
| **N4 · The sidebar foot** | Help, then the other portal (named by destination: "Coaches Portal" / "Admin"), then Collapse sidebar, last. **Sign out and Send feedback live in the account menu only** (the 2026-09-01 one-sign-out rule, now applied to the admin; Ask B1). "Public site" appears once per screen: as the nav's Public site row where there is one (its page links to the live site), otherwise as a foot door. |
| **N5 · Icons** | One icon per idea, one idea per icon: the dictionary below (Ask A3). A new icon is checked at 14px against its neighbours, because a pair that differs at 22px can look alike at 14px. |
| **N6 · Words** | Sentence case. A door is named by where it goes, never "Back to…" (2026-07-31). Ruled here: **"Rep teams"** (Ask A4, with a one-spelling sweep of help articles, their search words and the marketing pages), and with it **"House league"** and **"Public site"** (owner, 2026-10-18; all three gated by `check:spelling` — a club's own season name such as "2026 Fall House League" is its data and keeps its case); the tournament sheet's **"Club overview"** (Ask A5); the admin top strip names its portal **"Admin Area"**, its name in the Workspaces list, the way the coach strip says "Coaches Portal" (Ask A6). |
| **N7 · The More sheet** | One order for every operator portal (Ask B2): (1) the place you're in, a tournament only (Club overview, then the tournament picker); (2) Notifications; (3) the tiles; (4) the sidebar's groups, under the sidebar's names, in the sidebar's order, two columns, an icon on every row, never folded; (5) **You**: Account, Home, the other portal; (6) Help, Send feedback, Download app (only where a phone or tablet browser can install), Sign out — one foot component for every sheet (`MoreSheetFoot`). The club sheet's Organization group opens with the Organization page itself (Ask B3); the tournament sheet's Admin group carries Accounting (Ask B4). **In the demo sandbox** a sheet shows none of Account, Home, Send feedback, Download app or Sign out: each leads out of the demo or signs the shared demo user out (the top strip hides the account menu for the same reason). |
| **N8 · Tiles** | None, or three, right after Notifications, for pages reached again and again from a phone (Asks C1–C3). Each label fits one line at 360px (12px bold); a page whose name doesn't fit isn't a tile. **Fixed** tiles are not listed again in their group; tiles that **come and go** with a tournament's phase stay listed in their group, so the groups never change under your thumb. A tile carries its page's waiting count, as a row would. A fourth tile is a design decision. The sets: **Premium coach** Practice plans · Lineups · Skills & Goals (2026-09-20) · **Club admin** Schedules · House league · Families (owner 2026-10-17, replacing Calendar · Schedules · Families; House league only once the club runs a season) · **Tournament admin, game day only** Check-in · Staff kit · Teams (none on a plan without Check-in or Staff kit). The free portal's tiles are its tools, not shortcuts (an exception). |
| **N10 · One club phone bar** | **Overview · Calendar · Rep teams · Accounting · More** on every club (owner 2026-10-17: "we will have consistency, and Calendar would be a more widely used section for all org users anyways"), replacing Overview + the club's first three programs. **A door this person or plan cannot open is filled by the next program the club runs**, in the sidebar's order (League Plus: Overview · Calendar · House league · Families · More), and the club tiles fill the same way; nothing appears twice. A program the plan carries but the club does not run yet never fills a tab or a tile: it is a quiet row in More. When fewer than three doors are left for the tiles, there are none. A cancelled club's bar is More alone. One rule, `lib/nav-tiles.ts` (`clubPhoneNav`); the tournament bar is unchanged (it follows the phase). |
| **N9 · One row style** | The admin, the Premium coach and the free coach sidebars draw their rows, headings and the page-you're-on highlight the same way: the olive tint across the full row, 600 weight, no bar, no rounded pill (Ask D1). The free sidebar's width and team header stay as ruled 2026-10-15 (P5). |

## The icon dictionary (N5)

Lucide names as imported. "Changed" is what the ruling moves; everything else already holds.

| # | Idea | Icon | Changed by the ruling |
|---|---|---|---|
| 1 | Overview of a club or team | `LayoutGrid` | Premium coach Overview (was `LayoutDashboard`), free coach Overview (was `Home`) |
| 2 | A tournament's Dashboard | `Gauge` | sidebar and phone bar (was `LayoutDashboard`, which matched the Overview grid at 14px) |
| 3 | A schedule of games | `Calendar` | free coach Schedule (was `CalendarClock`) |
| 4 | The club Calendar | `CalendarClock` | — |
| 5 | The club scheduler (Schedules) | `ChartGantt` | club Schedules (was `ClipboardList`, Tryouts' icon) |
| 6 | Tryouts | `ClipboardList` | — |
| 7 | Tournaments | `Trophy` | the tournament sidebar's Tournaments list (was `List`) |
| 8 | Results | `Medal` | tournament Results, sidebar and phone bar (was `Trophy`) |
| 9 | Season's End (the one door a closed season's nav shows) | `Archive` | Premium coach Season's End (was `Trophy`) |
| 10 | Public site | `Globe` | tournament Public site (was `Paintbrush`), the sidebar foot door (was `Home`) |
| 11 | Email to many people | `Mail` | Premium coach Email families (was `Megaphone`) |
| 12 | Announcements (free portal) | `Megaphone` | — |
| 13 | Money, fees, accounting | `DollarSign` | free coach Fees (was `CircleDollarSign`) |
| 14 | Coaches Portal (the door to it) | `Users2` (`users-round`) | admin phone More (was `UserCheck`, Check-in's) |
| 15 | Members | `IdCard` | club Members (was `Users2`, the Coaches Portal door's) |
| 16 | Check-in | `UserCheck` | — |
| 17 | Home (all your workspaces) | `Home` (`house`) | — |
| 18 | Awards (a coach's records, not in a nav) | `Award` | — (named so Results' `Medal` stays apart from it) |

## Exceptions (different on purpose)

- **The club sidebar groups places; the coach sidebar groups pages.** A club runs several programs and a program opens
  because you're inside it; a coach runs one team and its page groups fold (N2 holds both).
- **Tournaments replaces the sidebar** rather than opening under its row: an event has about 17 pages in three groups.
- **The tournament phone bar, and its tiles, change with the phase** (bar ruled 2026-10-16; tiles: game day only).
- **Phone rows are bigger than sidebar rows** (16px / 17px icons against 14px / 14px): they're for thumbs.
- **The More sheet never folds.** You open it to find something.
- **The free portal's tiles are its tools** (every tool the coach turned on, then Explore), not shortcuts.
- **Sidebar widths stay as they are:** admin 240px, Premium coach 220px (its layouts are tuned to it), free coach 248px
  with its team header (ruled 2026-10-15, P5). One width was considered and left.
- **Platform admin keeps its own look** (a ruled exception in its layout).
- **The folded sidebar strip keeps its own row look** (N9 changed the full sidebar's rows only): the free strip keeps its
  rounded tile, lime tint and edge bar for the page you're on.
- **The free portal's install prompt shows on its signed-in pages only** (owner, 2026-10-17), never on sign-up or
  checkout, which share its layout: so its manifest comes with the portal's shell, not the layout.
- **The chevron follows the pages, not a list of names.** N3 names Families among the rows that open pages; Club Stage
  5b makes Families one page with tabs, so from then on it carries no chevron, by the same rule (more than one page, or
  House league).
- **The tournament bar's Communications tab reads "Messages"** on a plan without Chat, because "Communications" doesn't
  fit a phone tab. ⚠ Open, not ruled: one page with two names. A wording call for `/marketing` (keep as a written
  exception, or a shorter name everywhere).
