# Navigation evaluation across the three portals — plan

**Status (2026-11-09):** evaluation done; drawings rounds 1–3 published; **asks E1–E16 RULED 2026-11-09, all as recommended** (owner: "looks good, i think we are ready to start the build prompts", then "Yes, all as recommended"; design log entry of that date). Build prompts: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` (Phase 0 + 1 written; each later prompt written after the phase before it lands). Nothing built. Session prompt:
`ADMIN_NAV_EVALUATION_PLAN_PROMPT.md`. Drawings: `ADMIN_NAV_EVALUATION_DRAWINGS.html`, published as https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4
(round 1 + /design; round 2 from the owner's notes + /design — see §0).

**⚖ RULED by the owner 2026-11-09 — the strip words:** the portal word over the sidebar names which of the three you are in:
**"Club"** (club admin), **"Events"** (a tournament, and a tournament-only org's screens — "Tournament" measured 246px
against the 240px cell), **"Coach"** (Coaches Portal; "Coaches" alone read as unfinished). Measured with the shipped type:
Club 194, Events 210, Coach 205 (of 240). "Admin Area" / "Coaches Portal" stay in the Workspaces list and wherever there's
room. The club's foot door reads **"Club"** (settles the word /marketing was to pick). /marketing checks "Events" against
the brand voice before the build. Build note: the one strip-label constant becomes a word per portal.

## 0b. Round 3 (owner, 2026-11-09) — Help leaves the growing foot
The owner asked whether Help and Plan & billing (both seldom used) should move to the account menu. Drawn as recommended:
**Help moves into the account menu beside What's new**; **Plan & billing stays in the foot** (its bill pill is the owner's
warning, and it is the organization's while the account menu is the person's, shared across organizations and public
pages). The 2026-09-01 "Help stays out of the menu" rule's reasons were no duplicate doors (a move keeps one) and the
release dot on the sidebar's Help (removed 2026-11-07). Foot after: Plan & billing (owner), hairline, portal doors,
Collapse. Phone unchanged (Help already at the More sheet's foot). Ask **E16** (A as drawn; B both move with a bill-only
dot on the avatar; C leave both).
/design (round 3, applied): the menu drawn as shipped (theme = caption over a full-width switch; min-width 240);
Help is the second settings row (HelpCircle 15), opens the portal's help (admin help varies by section; coach
`/{org}/coaches/help`) in a new tab; **desk-only and opt-in** (like What's new): never on public / family / marketing
menus nor the phone Account sheet; the **demo sandbox keeps Help in its sidebar foot** (the sandbox hides the account
menu); the coach rail's lit Help is lost (accepted). ⚖ Supersedes 2026-09-01 "Help stays out of the menu" (restated
2026-11-07) and rewrites N4. The drawing omits the menu's Terms · Privacy line: another session's uncommitted work is
changing it.

## 0. Round 2 (owner's notes, 2026-11-09) — supersedes the matching parts of §2–§5
The owner, reading round 1, asked four things; all four were taken (the answers argued on the merits, in the chat):
1. **The other portals become doors in every sidebar's foot** (the person sees the two they are not in). One foot order:
   Plan & billing, Help, hairline, the portal doors (Club · Tournaments · Coaches Portal, less the current one),
   Collapse sidebar. "Club overview" leaves the tournament sidebar; **Tournaments leaves the club's Programs** (a row that
   swaps the whole sidebar is a portal door). The coach foot already did this ("Tournaments you run", "Admin",
   `CoachesSidebar.tsx:459-469`). Phone: the doors sit in the More sheet's You group (Account, What's new, Home, doors,
   Plan & billing). The club door's word is drawn "Club" — /marketing names it, never "Organization" (a club
   place). ⚠ N10: a club whose phone bar or tiles were filled by Tournaments gets its next program. Ask E4 (replaces
   round 1's "Club overview stays").
2. **One sidebar width, 240px** — the coach portal widens from 220 (reverses the 2026-10-17 exception; measure the coach
   pages at 1280 at the build). The strip says **"Coach"** (owner 2026-11-09: "Coaches" alone read as unfinished; "Coach" pairs with "Admin"); "Coaches Portal" stays everywhere else, as "Admin Area" does (E9).
3. **No folding** in the tournament and coach sidebars: headings become labels, the list scrolls between the pinned cell
   and the foot (at 1440×900 the coach list's last two rows scroll). A sidebar chevron then only ever means "switch",
   which removes the N3 exception round 1's /design pass asked for. New ask E14.
4. **The place's facts move to the strip's right end** (before View site): an event's dates + phase chip; a team's
   "2026 Season · 3-2-1 · NEXT Sun 9:30 a.m. practice" (E2 and E7 flip to the strip; "Next" stays on every screen).
   The cell keeps the name alone, on up to two lines.

**Round 2 /design pass (applied):** the coach foot door keeps its shipped words "Tournaments you run" (it sat beside the
Season group's Tournaments row, same trophy); the Coaches Portal door is `users-round` (N5 #14), not Teams' `users`;
Shield joins the icon dictionary as the Admin door (#21); a record's own facts sit beside its name (round 5 Q4) and the
place's facts stay at the strip's right end in quiet ink behind a hairline, giving way first between 900 and ~1100 wide
(the page's name never truncates); 1366×768 and 1000px frames drawn (the foot stays pinned, rows scroll); "no folding"
and "one width" scoped to the tournament and Premium coach sidebars (the support console still folds; the free portal
keeps 248); a club that has not run a tournament keeps its "Also on your plan" row as the way in, the foot door appearing
once it hosts one; Tournaments leaves the N10 fill order. **New ask E15:** a person whose only program is tournaments gets
the house-league exception (13a Ask 8, 2026-11-06): Tournaments leads their sidebar as a row. Written-standard edits owed
at the build: N2, N3, N4 (the other portals, one row each), N5 (#21 Shield), N6 ("Club" vs "Admin Area"), N7 item 1,
N9 (A11 folded pill), the width exception; retire A5 (2026-10-17). PM brief: `ADMIN_NAV_EVALUATION_PM_BRIEF.md`. Parent project:
`ADMIN_HEADER_BAR_PLAN.md` ("After this project", queued 2026-11-08 at walk §495; logo ask C1 folded in 2026-11-09).

**The ask (owner 2026-11-09):** review the navigation of the club admin, the tournament admin and the Premium Coaches
Portal against the new club admin (Admin header bar Phases 1–4), for consistency, deciding for each difference whether
it is justified; test (not assume) the owner's idea for tournaments: the tournament's name in the sidebar where the org
sits today, a quiet chevron to switch, and the page names in the bar.

---

## 1. What is shipped today (verified in the code and measured)

Measured on the dev server, 2026-11-09, at 1440×900 and 390×844 (`.probe/nav-eval/measure.mjs`, screenshots beside it;
UAT sign-ins refreshed first; one desktop reading re-taken after the event finished loading).

**One shell.** The tournament admin is not a separate shell: `/{org}/admin/tournaments/*` renders inside the club admin's
`AdminChrome` — the same strip (`AdminTopStrip`), sidebar (`AdminKitRail`), pinned bar (`AdminEventHeader`, one place
model `useAdminPlace`), phone bar (`AdminKitBottomNav`). Inside a tournament the sidebar swaps to `TournamentRail`
(`AdminKitRail.tsx:221`): Operations / Setup / Admin folding groups. The Coaches Portal has its own shell
(`CoachesChrome`, `CoachesSidebar`, `CoachTeamHeader`, `CoachPageHeader`) that shares the strip's skin, the phone bar's
stylesheet, the More-sheet parts, the account menu and the Workspaces pill.

| | Club | Tournament (club's event) | Coaches Portal |
|---|---|---|---|
| Sidebar top | 45px cell: 24px initials tile + club 14/700, links to Overview (`AdminKitRail.tsx:120`) | the same club cell, then "Club overview", a "Tournament" label and a **native `<select>`** (34px, 14/600; plain text with one event) (`AdminKitRail.tsx:293`) | **no cell**; a native `<select>` of teams with a "No live season" optgroup (`CoachesSidebar.tsx:318`) |
| Desktop strip | split at the sidebar edge; "ADMIN"; the place 16/700 | split; the **event** 16/700 + dates 12px + phase chip | **unsplit**; "COACHES PORTAL"; no place |
| Second pinned band | tabs (45px) on a place with tabs | none | the team bar, **56px**: team 16/700 + mono club · season · record, "Next …", help "?" |
| Page name | in the strip (no paper title) | in the page, **20/700, scrolls** | in the page, **20/700 + 34px icon tile, scrolls** |
| Pinned height | 93 (tabs) / 48 | 48 | **104** |
| Phone bar | the place 16/700 (+ tabs); 51 / 95px | the event 16/700 + mono dates · chip; 53px; then the page's 20px title | team 14/700 + chevron + record; 37px; then the page's 20px title + tile |
| Phone switcher | — (season: chevron in the bar) | More sheet "Current tournament" `<select>` with " - Live" | team name + chevron → "Your teams" sheet (`CoachTeamSwitchSheet`) |
| Collapsed tile | 24px initials | 40px mono initials, opens the strip menu with status words | team's first word, opens "Your teams" |
| Page help | none on a club place | at the page title's right, scrolls | pinned in the team bar |

Same in all three (no change proposed): sidebar rows 14px / 38px / 14px icons; group headings 11px capitals; the phone
bottom bar (72px, 22px icons, 10px labels; the slot sets differ on purpose); the More sheet's order (N7); the account
menu; the Workspaces pill and the other-portal sidebar-foot door; the icon dictionary (N5); the fonts (the warm skin
changes colour only).

**Two facts that shape the build:**
- **A tournament has no address.** The chosen event lives in browser state (`setCurrentTournament`,
  `lib/tournament-context.tsx:149`); the URL carries no event. The page learns it after a client fetch, so on desktop the
  strip names the club for a moment (several seconds on dev) before the event. Moving the event into the cell would make
  that a visible flicker of the sidebar's head.
- **Switching an event keeps you on the same page** (state only); switching a team or a season changes the route.

**Inside the club admin itself (the standard is not perfect):** the back link hovers and divides differently in the
phone bar and the desktop strip (`AdminKitEventHeader.module.css:87` vs `AdminTopStrip.module.css:58`); the collapsed
club tile (24px) and the tournament tile (40px) differ; the tournament list says " - Live" only on a phone and a status
word only in the collapsed menu; the club cell and the Overview row are two doors to Overview (kept: the cell is a name
that opens its front page, in every portal under the proposal).

## 2. The verdict on the owner's idea — right, with three changes

The club's rule is: **the cell names whose sidebar it is; the strip names the row you are on; tabs name its pages.**
Inside an event the sidebar is the event's (the written exception "Tournaments replaces the sidebar"), so the rule puts
the event in the cell and the page in the strip. Today does the opposite. The owner's idea is a move plus a restyle of
the switcher, not a new feature.

**A10 (2026-11-07) is reworded, not reversed.** Its reason: an event's name must not sit above Members or Plan & billing
(Members grants access per tournament; billing is the organization's). Under the proposal those screens name themselves
in the strip and (E3) get the organization's own sidebar with the org in the cell, so the reason is served better than
today, where the event's dropdown heads the sidebar on Members.

**The 2026-08-02 ruling ("the admin rail carries no identity and no status")** — its reasons were duplication and a
hand-rolled phase. The proposal keeps one copy (the event leaves the strip), reads the one phase rule, and keeps the
fact on screen (the cell is pinned). Round 4 already put the club's name in the rail for the same reason.

The three changes:
1. **E3:** a tournament's org-wide screens get the organization's sidebar (org in the cell, no chevron).
2. **E5:** on a phone the event stays on screen: the bar names the page, the event rides the small line and opens the list.
3. **E4:** the way back to the club is the existing "Club overview" row, first under the cell. The club's name leaves the
   sidebar inside an event (the owner's own trade).

**Risks:** the first-paint flicker (above, Phase 0); a long event name truncates in the 240px cell (today's `<select>`
truncates it too — the list and the hover name show it whole); in the 220px coach sidebar the facts line must stay short
("2026 · 3-2-1").

## 3. The proposed standard

1. **The sidebar's top cell** — names whose sidebar it is. Optional mono facts line. A quiet chevron only when there is
   more than one to choose from, opening one list (desktop popover drawn from the collapsed sidebar's existing menu:
   status word per row, "All tournaments" at the foot; phone sheet). With a chevron the whole cell opens the list; without one (the club) it opens the front page.
   Collapsed: one 40px tile, logo or initials.
2. **The desktop strip** — split at the sidebar's edge; over the page: back arrow (one level down), the page's name,
   quiet facts; then View site, bell, account, Workspaces.
3. **The phone bar** — names the page (the place, in the club). The event or team rides the small line and opens the
   list. One switcher per width.
4. **The page** — no second title; buttons in its toolbar row; tabs pinned in the band where a place has pages.

**Kept different on purpose:** club sidebar = places, tournament and coach sidebars = pages in folding groups (N2); the
tournament phone bar follows the phase; a tournament's team/game opens as a window; a team with no live season has ONE
door (cell + Season's End, decided server-side by `CoachTeamSeasonGate`; no new finished-season branch); widths 240 / 220
(unless E9 = B); the club's name stays off the phone bar (A4) while an event and a team stay on it (they can change).

## 4. Asks — ⚖ RULED 2026-11-09: every ask = A (the recommended column), E14–E16 included

| # | Ask | Recommended (A) | Other |
|---|---|---|---|
| E1 | The tournament idea | Yes, with the changes drawn (E3–E5) | B as first described (event in the cell on every tournament screen); C keep today |
| E2 | The place's facts on desktop (round 2) | At the strip's right end, before View site; the cell keeps the name alone on up to two lines | B the cell's second line (round 1) |
| E3 | Org-wide tournament screens | The organization's own sidebar, org in the cell | B keep the event's sidebar |
| E4 | The other portals (round 2) | Doors in every sidebar foot, one order; "Club overview" leaves the tournament sidebar; Tournaments leaves the club's Programs; phone: the More sheet's You group; club door word by /marketing | B keep "Club overview" and the Programs row |
| E5 | Tournament on a phone | Bar names the page; event on the small line opens the list; page title and More dropdown go | B keep today |
| E6 | Coaches Portal, desktop | Adopt: team cell + chevron, split strip names the page, team bar goes, buttons to the toolbar | B keep the team bar |
| E7 | Coach record, "Next", "Game day" (round 2) | At the strip's right end on every screen, where the team bar showed them | B on Overview only |
| E8 | Coaches Portal, phone | Bar names the page; team + record on the small line opens "Your teams" | B keep the team in the bar |
| E9 | One sidebar width (round 2) | 240px for admin + Premium coach; the coach strip says "Coach" (word ruled by the owner 2026-11-09) | B keep 220 for the coach portal |
| E10 | The logo in the cell (ask C1; drawn in all three portals, open + collapsed + phone sheet, with a wide and a very light logo) | Show it: org's; event's then org's; team crest then colour; initials when none or when wider than 2 : 1 (a wordmark is a sliver at 24px); white ground + hairline ring; one 40px collapsed tile; on a phone only in the switching sheet | B initials only; C not in the phone sheet |
| E11 | Page help "?" | One place: the right end of the page's top row, always last, desktop and phone | B leave each |
| E12 | Tidy-ups found | Fix all three (back-link look, list status words, first-paint flicker — flicker first) | B leave |
| E13 | Free Coaches Portal | Out of this project; a later look | B include |
| E14 | Folding group headings (round 2) | No folding anywhere: labels, the list scrolls between the pinned cell and the foot | B keep folding (N3 then needs a switcher exception) |
| E16 | Help / Plan & billing out of the foot (round 3) | Help → account menu beside What's new; Plan & billing stays | B both move, bill-only avatar dot; C leave both |
| E15 | A person whose only program is tournaments (round 2 /design) | The house-league exception: Tournaments leads their sidebar as a row | B no exception; C keep Tournaments in Programs for everyone |

Logo facts for E10 (from `docs/agents/db/DATA_DICTIONARY.md`): `organizations.logo_url` (uploaded or a made stock logo),
`tournaments.logo_url` (overrides the org's), a team's crest in `rep_teams.pdf_settings.logoDataUrl`. Nothing new to store.

## 5. Build phases (if ruled) — by dependency and rework risk

- **Phase 0 · The chosen event on first paint.** The server knows the selected event (a cookie beside the stored choice,
  or the address) so the cell and the strip paint right the first time. Everything after reads it; building the cell
  first would ship a flicker and rework it. Also decide here whether an event earns an address (out of scope unless the
  owner asks; record the question).
- **Phase 1 · The shared cell and its list.** One cell component (name on up to two lines, chevron, tile with logo) and the one sidebar foot (Plan & billing, Help, the portal doors, Collapse) and one list
  (popover / sheet), drawn from the shipped `SidebarStripMenu` rows and the `SingleSelectDropdown` chevron face. Club
  cell swaps in first (pixel-identical except the 40px collapsed tile, E10) so the club walks pass unchanged.
- **Phase 2 · Tournament desktop.** Event in the cell; native `<select>` deleted; strip names the page
  (`useAdminPlace` names the lit row); paper titles drop where the strip names the page (Phase 3's `TabPageHeader`
  hand-off pattern); org-wide screens get the org sidebar (E3); `isTournamentOrgScreen` stays the one list.
- **Phase 3 · Tournament phone.** Bar names the page; the small line opens the sheet; More loses its dropdown (N7 item 1
  rewritten).
- **Phase 4 · Coaches Portal desktop.** Sidebar widened to 240 and unfolded (E9, E14); strip split with the word "Coach" and the team's facts at its right end (E7); team cell replacing the `<select>`;
  `CoachTeamHeader` desktop removed; `CoachPageHeader` title/icon tile dropped where the strip names the page, buttons to
  a toolbar row; nested pages' back arrows into the strip; the closed-season page titled "2025 Season" in the strip;
  `CoachTeamSeasonGate` untouched. ⚠ The header-bar project's guards pin the portal as "pixel-identical"
  (`ADMIN_HEADER_BAR_PLAN.md` L182, L261, L448, L548) — retire them deliberately in this phase, not silently.
- **Phase 5 · Coaches Portal phone.** Bar names the page; the team on the small line opens `CoachTeamSwitchSheet`.
- **Phase 6 · Words, help, demos, sweep, walk.** NAV_STANDARD rewritten (N7 item 1, N11, exceptions, the cell);
  `memory/design_decisions.md` entry; help articles (`/docs`); demo tour anchors (the build fails if one vanishes);
  `check:layout --changed` on the touched screens, the full sweep on staging; one closing walk.

## 6. The /design pass (2026-11-09) — what it changed in the drawings
- **The whole cell opens the list** when there is more than one to choose from (the chevron is its sign); a club's cell
  (nothing to switch) still opens Overview. Reason: a name opening one thing beside a chevron opening another is the
  ambiguity the 2026-11-06 ruling removed. Needs a written N3 exception (a switcher's chevron) and amends round 4's
  "the cell opens Overview" for event and team cells (in E1).
- **Page help stays off the strip**: one home, the right end of the page's top row, always last (2026-08-11 / 08-25:
  top right, last, never the top strip). E11 rewritten; drawings moved.
- **The phase stays a chip** on the cell's line and the phone's small line (2026-11-07 / round 5).
- **E3 drawn with shipped rows only**: a tournament-only org has no "Account" group (its org links are empty); the
  organization becomes the place "Settings & access" with Members · Payouts · PDF settings as tabs (N11). States that it
  reverses round 5's "keep their own heading" for these screens.
- **Worst-case cell** drawn (a long event name at 240px; a team on game day at 220px); E7 puts the chip in place of the
  record on game day because the 220px line holds about 17 characters.
- **Phone**: the small line drawn as a 44px target; the + as a 44px square; the view switch 44px; the sheet's close in a
  44px box; a closed-season phone frame (Season's End + More, the one door) added.
- **Today frames corrected** to the shipped screens (open groups, Members' real body and buttons, "Add Player",
  Plan & billing's count).
- **Rulings the asks now name**: 2026-08-25 identity bar (E6, E8), 2026-08-26 way back in the page header (E6), round 4
  option C's reason (E4), N6 "Coaches Portal" (E9), N7 item 1 (E5).

## 7. Not done here
No code. No `/strategy` entry (no business decision). The coach strip word is ruled ("Coach"); the club door's word ("Club", E4) goes to `/marketing` before the build; no plan gate
changes, so no `/billing`. The free Coaches Portal is out unless E13 = B.
