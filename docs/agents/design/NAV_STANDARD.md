# Nav standard

**Ruled 2026-10-17** by the owner, all fourteen asks of the Nav Consistency Review as recommended (*"looks good, i agree
with your recommendations"*). Hub: https://claude.ai/artifact/RtcrWCxpfuNMkTRQMK8pA3 (source
`docs/projects/active/NAV_CONSISTENCY_REVIEW_HUB.html`). This is Club Tier Stage 8's nav review
(`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6).

**Covers:** the desktop sidebar, the phone bottom bar and the phone More sheet of the club admin, the tournament admin
(the same sidebar, in tournament mode), the Premium Coaches Portal and the free Coaches Portal, and — since **2026-10-24**
(Support console Stage 1, owner ruling F1/D4) — the **platform admin's support console**: its top strip, folding menu, foot
(Help, then Collapse sidebar) and narrow-width menu panel follow N1–N6 and N9. It was an exception until then.

**Built** 2026-10-17 by `docs/projects/active/NAV_CONSISTENCY_PLAN.md`, stages A–D (§10 there has the as-built notes;
the QA walks are owed). **Club Tier Stage 13i** (2026-11-06, `docs/projects/active/CLUB_TIER_STAGE13I_BUILD_PROMPT.md`) rebuilt the club sidebar to places only and wrote N2, N3, N4, N7, N9, N10 and N11 as built: Session A the tab rows, Session B the sidebar and the More sheet. Two rulings joined at the build, the same day: **one club phone bar** and its tile set (N8), with
their fill rule. A new nav row, sheet row, icon or tile is checked against
this page, the way a table is checked against `TABLE_AND_LIST_STANDARD.md`. A departure is written into the
exceptions below when it is made, never discovered later.

---

## The rules

| # | Rule |
|---|---|
| **N1 · Type** | Sidebar rows 14px, icons 14px, the sidebar foot 12px. Group headings are 11px capitals (`--type-label`), 700, 0.1em tracking, quiet ink, **in the sidebar's face, in the sidebar and in the More sheet** (Ask A1). On a phone, sheet rows are 16px with 17px icons, and a long label wraps in its column: the column gives, never the word. |
| **N2 · Headings** | **⚖ Rewritten 2026-11-06** (Club Tier Stage 13i, owner: Asks 1–3 and 5–9 = A, Ask 4 = B — "this looks good, i agree with your recommendations"; drawing https://claude.ai/artifact/T42raG41vUxt7gjdJEjQMR tab 6). The **club sidebar lists places only**, never a place's pages, so nothing opens under a row and no club heading folds. Overview, Calendar and Schedules sit unheaded at the top; then **Programs** (Rep teams, House league, Tournaments) and **Club** (Accounting, Families, Public site, Organization), with "Also on your plan" after Programs as before. A heading is drawn over two or more rows; a lone row keeps the heading's space with no word (the registrar's House league and Organization). *(As built: "Also on your plan" is said over one row too — it is the reason its rows are quiet, not a group's name.)* The groups are a map beside the programs' own order (`clubPlaceGroups`), never a reordering of it (N10). The coach sidebar's page groups and a tournament's Operations, Setup and Admin fold as before: a heading over pages folds and the group holding your page is always open. Both kinds share one size and one spacing: 12px above, 6px below. |
| **N3 · Chevrons** | **⚖ Rewritten 2026-11-06** (Club Tier Stage 13i, owner: Asks 1–3 and 5–9 = A, Ask 4 = B — "this looks good, i agree with your recommendations"; drawing https://claude.ai/artifact/T42raG41vUxt7gjdJEjQMR tab 6). **A chevron means a fold, and only a fold carries one**: a coach sidebar's page group and a tournament's group headings. A club sidebar row carries none: every row opens its place's front door, and a place's pages are its tabs (N11). The collapsed sidebar follows: every club icon is a straight link to its place, no program or Organization menus. One strength everywhere: 55%. |
| **N4 · The sidebar foot** | *Unchanged in substance by 13i, now written as built (Ask 4 = B, 2026-11-06):* **Plan & billing** (the owner, with its fee-invoice pill), then Help, then the other portal (named by destination: "Coaches Portal" / "Admin", when you hold one), then Collapse sidebar, last. **Plan & billing is not an Organization tab**, and its page draws no Organization tabs; on it, its foot row is the one lit row. **Sign out and Send feedback live in the account menu only** (the 2026-09-01 one-sign-out rule, now applied to the admin; Ask B1). "Public site" appears once per screen. **⚖ Ask 9 = A (owner 2026-11-06, Club Tier Stage 13a):** the header pill reads **"View site"** on the club's own screens and opens the live site (tournament screens keep their words; on a phone it is the globe, its spoken name "View site"); the owner's and admin's **Public site** row opens the editor; there is **no** "Public site" foot door or More-sheet door, since the pill is on every screen the sidebar is (F-NAV-5: the same place, named twice). |
| **N5 · Icons** | One icon per idea, one idea per icon: the dictionary below (Ask A3). A new icon is checked at 14px against its neighbours, because a pair that differs at 22px can look alike at 14px. |
| **N6 · Words** | Sentence case. A door is named by where it goes, never "Back to…" (2026-07-31). Ruled here: **"Rep teams"** (Ask A4, with a one-spelling sweep of help articles, their search words and the marketing pages), and with it **"House league"** and **"Public site"** (owner, 2026-10-18; all three gated by `check:spelling` — a club's own season name such as "2026 Fall House League" is its data and keeps its case); the tournament sheet's **"Club overview"** (Ask A5); the admin top strip names its portal **"Admin Area"**, its name in the Workspaces list, the way the coach strip says "Coaches Portal" (Ask A6). |
| **N7 · The More sheet** | One order for every operator portal (Ask B2): (1) the place you're in, a tournament only (Club overview, then the tournament picker); (2) Notifications; (3) the tiles; (4) the sidebar's **places**, under the sidebar's names, in the sidebar's order, two columns, an icon on every row, never folded — **a place's pages are never sheet rows** (13i, 2026-11-06): they are its tabs, so the club sheet lists Organization once, and a one-row group draws no heading (the owner's Tournaments); (5) **You**: Account, Home, the other portal, Plan & billing (the owner, with its fee-invoice pill), as before; (6) Help, Send feedback, Download app (only where a phone or tablet browser can install), Sign out — one foot component for every sheet (`MoreSheetFoot`). *(⚰ "The club sheet's Organization group opens with the Organization page itself", Ask B3 — retired by 13i: Organization is one row.)* the tournament sheet's Admin group carries no Accounting row (Ask B4 reversed, owner 2026-10-30 — the club's book is not an event page; a tournament admin manages payments on Teams). **In the demo sandbox** a sheet shows none of Account, Home, Send feedback, Download app or Sign out: each leads out of the demo or signs the shared demo user out (the top strip hides the account menu for the same reason). |
| **N8 · Tiles** | None, or three, right after Notifications, for pages reached again and again from a phone (Asks C1–C3). Each label fits one line at 360px (12px bold); a page whose name doesn't fit isn't a tile. **Fixed** tiles are not listed again in their group; tiles that **come and go** with a tournament's phase stay listed in their group, so the groups never change under your thumb. A tile carries its page's waiting count, as a row would. A fourth tile is a design decision. The sets: **Premium coach** Practice plans · Lineups · Skills & Goals (2026-09-20); **while chat is paused, Lineups · Skills & Goals · Money** (owner, chat pause P3T, 2026-10-18 — Practice plans is on the bar then; the owner's pick over Tournaments) · **Club admin** Schedules · House league · Families (owner 2026-10-17, replacing Calendar · Schedules · Families; House league only once the club runs a season — or, for a person whose only program it is, from day one: N10's exception, 2026-11-06) · **Tournament admin, game day only** Check-in · Staff kit · Teams (none on a plan without Check-in or Staff kit). The free portal's tiles are its tools, not shortcuts (an exception). |
| **N10 · One club phone bar** | **Overview · Calendar · Rep teams · Accounting · More** on every club (owner 2026-10-17: "we will have consistency, and Calendar would be a more widely used section for all org users anyways"), replacing Overview + the club's first three programs. **A door this person or plan cannot open is filled by the next program the club runs**, in **the programs' own order** — Rep teams, House league, Accounting, Families, Public site, Tournaments (`LEAD_ORDER`), written out since 13i (2026-11-06) so that moving Tournaments up into the sidebar's Programs changes no club's bar or tiles (League Plus: Overview · Calendar · House league · Families · More), and the club tiles fill the same way; nothing appears twice. A program the plan carries but the club does not run yet never fills a tab or a tile: it is a quiet row in More. When fewer than three doors are left for the tiles, there are none. A cancelled club's bar is More alone. One rule, `lib/nav-tiles.ts` (`clubPhoneNav`); the tournament bar is unchanged (it follows the phase). **⚖ The one exception (owner 2026-11-06, Club Tier Stage 13a Ask 8 = A):** for a person whose ONLY program is house league (the league admin and the registrar by default; decided by what they can open, never the role's name), house league counts as run before the club has a season: it leads the rail, takes the bar's third slot and gets its Overview card. Reason: it is their whole job, and on a brand-new club "Also on your plan" or the More sheet hid it from them (F-L1-2, F-R1-3). Everyone who opens anything else (owner, admin, treasurer) keeps the rule as written. One place: `personClubShape` (`lib/admin-kit-nav.ts`), read by `useAdminKitNav`. |
| **N9 · One row style** | The admin, the Premium coach and the free coach sidebars draw their rows, headings and the page-you're-on highlight the same way: the olive tint across the full row, 600 weight, no bar, no rounded pill (Ask D1). The free sidebar's width and team header stay as ruled 2026-10-15 (P5). **The row's end, in fixed places** (Support console Stage 2 design pass, 2026-10-25): the view-only **eye** first, then the amber **waiting count** beside it — they answer different questions (can I change this; is anything waiting), so neither replaces the other. **A folded heading carries one amber pill, the sum of its rows' counts, and loses it when opened** (owner ruling A11, 2026-10-25; the console's menu first — `app/platform-admin/console-menu.ts` `foldedGroupCount`). **13i (2026-11-06): a club place's row carries the sum of its pages' waiting counts, and each tab carries its own** (House league's registrations in the sidebar, Registrations' on its tab; Rep teams' assistant coaches on the row and on the Assistant coaches tab), at every depth. The eye, where a person can read a place but not change it, sits on the row and on each tab it applies to. |
| **N11 · Pages on the page** | **New 2026-11-06** (Club Tier Stage 13i, Asks 1, 3, 6 and 7 = A). **A place with more than one page shows them as tabs under its title**: one component everywhere (`HubTabBar`, Accounting's tabs), a sideways-scrolling strip below 900 with a › cue and the current tab in view. One tab is lit. A tab a person cannot open is not drawn; a place with one page draws no strip. A place inside a place (a team, a season) replaces the strip with its own, and its header names the way up by destination ("← Teams", "← Seasons"). A **record's** own page one level down (an allocation, a team's account, a registration, a team's History, Rename team addresses) keeps its back arrow and has no tab row (2026-09-30, kept). A page's own filters are the toolbar's left-hand view choice (2026-10-17), never a second row of tabs. A create button sits in its tab's toolbar, never the place's header. A tab's own actions stay on that tab. **Every tab is its own page address** (Back, bookmarks and notification links keep working), and the strip is drawn with the page frame, before the page's data arrives, so nothing shifts. The lists: `repTeamsTabs`, `teamTabs`, `seasonTabs`, `orgTabs` (Organization: Members · Audit log · Settings · Venue library · PDF settings, or "The board" in Members' place — **never Plan & billing**, Ask 4 = B), `accountingTabs`, `familiesTabs` (`lib/admin-kit-nav.ts`). **⚖ What this reverses, on purpose:** the second half of the 2026-09-30 Accounting ruling ("separate jobs are listed in the rail; Rep teams stays in the rail"), for the reason that ruling gave for Accounting — on a phone a tab row reaches every page in one tap, and the phone has no sidebar to list pages in. Its other clause (a record's page one level down: a back arrow, no tab row) stands. |

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
| 19 | Today (the support console's front door: what is waiting on us) | `Inbox` (a tray) | the console's Overview (was `LayoutGrid`) — Support console Stage 2, 2026-10-25. Never the house, which stays Home's (#17) |

## Exceptions (different on purpose)

- **The club sidebar groups places; the coach sidebar groups pages.** A club runs several programs, each a place whose
  pages are its tabs (N11) — nothing opens under a club row; a coach runs one team and its page groups fold (N2 holds both).
- **Tournaments replaces the sidebar** rather than opening under its row: an event has about 17 pages in three groups.
- **The tournament phone bar, and its tiles, change with the phase** (bar ruled 2026-10-16; tiles: game day only).
- **Phone rows are bigger than sidebar rows** (16px / 17px icons against 14px / 14px): they're for thumbs.
- **The More sheet never folds.** You open it to find something.
- **The free portal's tiles are its tools** (every tool the coach turned on, then Explore), not shortcuts.
- **Sidebar widths stay as they are:** admin 240px, Premium coach 220px (its layouts are tuned to it), free coach 248px
  with its team header (ruled 2026-10-15, P5). One width was considered and left.
- **The support console's foot has no other-portal door** (2026-10-24): Help, then Collapse sidebar. Staff hold no workspace, so there
  is nothing to name by destination. Its strip names the portal "Support console" (N6) and carries no bell and no Find box yet
  (Find is Stage 2; nothing sits behind a bell). Below 900 its menu opens as a panel from a button in the strip (it has no bottom bar).
  *(The earlier line "Platform admin keeps its own look" retired the same day.)*
- **The folded sidebar strip keeps its own row look** (N9 changed the full sidebar's rows only): the free strip keeps its
  rounded tile, lime tint and edge bar for the page you're on.
- **The free portal's install prompt shows on its signed-in pages only** (owner, 2026-10-17), never on sign-up or
  checkout, which share its layout: so its manifest comes with the portal's shell, not the layout.
- *(⚰ "The chevron follows the pages, not a list of names" — retired 2026-11-06 by 13i: no club row carries a chevron, N3.)*
- **The tournament bar's Communications tab reads "Messages"** on a plan without Chat, because "Communications" doesn't
  fit a phone tab. ⚠ Open, not ruled: one page with two names. A wording call for `/marketing` (keep as a written
  exception, or a shorter name everywhere). **While chat is paused (2026-10-18, ruling P4) no plan has Chat, so every
  event's Open and game-day bar shows Messages** — the exception now holds on every plan until one name is chosen,
  which waits for the Messages product (E2); the email tools stay as they are meanwhile (E6).
- **While chat is paused (2026-10-18; `lib/chat-pause.ts`, rulings P2–P4F):** the home bar is Home · Scores · Account
  (the place left empty: the signed-out bar's shape); the Premium coach bar is Overview · Schedule · **Practices** ·
  Roster · More — the Practice plans page under a shorter tab name because "Practice plans" is cut to "Practice pl…" at
  360 (the "Site" for Public site precedent: a bar label may be shorter than its page's name, never different in kind);
  the free coach bar is Overview · Tournaments · More. Chat's place is read from the switch, so un-pausing restores today's
  bars in one commit.
