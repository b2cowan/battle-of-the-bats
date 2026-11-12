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
`tournaments.logo_url` (overrides the org's), a team's crest in `rep_teams.pdf_settings.logoDataUrl`. ~~Nothing new to
store.~~ **Superseded for the event by the Phase 2 gate ruling below.**

**⚖ Phase 2 gate ruling — the event's logo (owner, 2026-11-10).**
- **The cell uses the event's EXISTING logo.** That is the one its Public site page uploads (`tournaments.logo_url`).
  There is no second upload and no new logo field.
- **The source chain is E10 as ruled:** the event's own logo, else the organization's, else initials.
  - This deliberately does NOT copy the public page's plan rule. `resolveTournamentLook` falls back to the
    organization's logo only when the plan carries the public site, and shows no logo without advanced branding.
  - So a tournament-only organization that uploaded a logo sees it in its sidebar even where its public page does not
    use it.
- **The event's logo remembers its shape at upload,** as the organization's did in Part B (B4/B5, mig 458).
  - This adds a nullable `tournaments.logo_aspect`, measured in the tournament-logo upload route, cleared with the logo.
  - It is copied on clone, and a one-time pass measures the logos already uploaded.
  - The admin event seed carries the logo and its shape, so the cell is right on the server's first paint.
- **Cost:** a migration, applied on dev now and on prod at the promote, before the code.
  - Until the one-time pass runs, an event's own logo of unknown shape shows initials (B4).
  - The organization's fallback already has a stored shape, so it costs nothing.
- **Rejected:**
  - Measuring on load: it gives initials and then a swap on first paint, which is a regression of Phase 0.
  - Dropping the shape rule for events: a wide wordmark would be unreadable at 24 px, and it reverses B5.

**⚖ Phase 2 gate ruling — one set of words for an event's state (owner, 2026-11-10; E12 (2)).**
- The sidebar list, the cell's chip and the strip all use the **phase** words from `PHASE_LABEL`: Draft · Open ·
  Game day · Completed · Archived.
- The list's `STATUS_WORD` "Active" leaves the list.
- **The lifecycle controls keep "Active"**, because there it names the action. Those are Event settings' status, the
  Tournaments page's bands and the Activate / Reopen buttons. They are deliberately not part of this ruling.

**⚖ Phase 2 gate rulings — the rest (owner, 2026-11-10).**
- The states the drawings do not show are drawn as a new tab and given a `/design` pass before any code.
- This session builds **Part A only** (the sidebar). Part B goes to a fresh session.

**⚖ Phase 2 gate — the drawings' calls T1–T6, all A (owner, 2026-11-10; drawings tab 14, after a `/design` pass).**
- **T1:** a club's org-wide tournament screens use the club's own sidebar.
  - The Tournaments list lights the foot's Tournaments door, and in a club that door opens the list. Today it opens
    the chosen event's Dashboard.
  - The strip says "Club".
  - The tournament addresses for Members and PDF settings open the club's Organization tabs, so each screen has one
    home in a club.
  - A tournament-only organization keeps E3 as drawn.
  - This is Part B.
- **T2:** the event's personal "Notification preferences" page gets a row of its own, last in the event's sidebar,
  once Settings & access and Tournaments leave that label in Part B.
  - The working words are "Your notifications"; `/marketing` checks them.
  - Today its only door is a card on Settings & access.
- **T3:** the list window is 320 px.
  - **Owner's change:** its rows are the portal's standard two-line dropdown row (`SublinedChoice`):
    - the event's name on the first line, 14 px semibold;
    - its dates and phase word on a 12 px tertiary line under it ("Nov 1–3, 2026 · Game day");
    - 44 px rows with a hairline between them;
    - the olive tint under a pointer and on keyboard focus.
  - The current event shows its name in olive with an olive check on the right.
  - The head is that list's group band ("Tournaments"), and "All tournaments" sits at the foot.
  - It is the same window under the open cell and beside the collapsed tile.
- **T4:** no game-day dot on the collapsed tile; the strip's chip says it.
- **T5:** a too-wide or too-tall event logo falls back to the event's initials, never the organization's logo.
- **T6:** the chevron shows whenever the person can reach the organization's tournament screens, even with one event.
  - The list then holds that event and "All tournaments".
  - It hides only for someone who can open one event and nothing above it (a scoped volunteer), whose cell opens the
    event's Dashboard.
  - This amends E1's "more than one".
- **Stale wording in the Phase 2 prompt:** its line "the phase as a chip on the cell's line" predates round 2. E2
  holds: the cell keeps the name alone.

**⚖ Part B gate — three calls (owner, 2026-11-10, at the start of the Part B session).**
- **P1 · Web address = a fourth tab** of a tournament-only organization's Settings & access (Members · Payouts · PDF
  settings · Web address). Found at this gate: the E3 drawing (shipped rows only) left it out, and its only door was a card
  on the page that becomes the tabs. The tab shows today's address with "Change the address" (today's window), owner only.
  Drawn as tab 15 before it was built.
- **P2 · ONE HOME PER SETTING (the owner's rule, in his words: "if only the club sets it it should only live in the club
  portal, if tournaments can override then the overrides live in the tournament settings … people will be wondering what
  happened to their nav").** Asked whether the club's other org-wide tournament addresses should "open their club home",
  the owner rejected a settings door that navigates to the club. Verified in the code: no tournament overrides a club
  setting (PDF settings is one `organizations.pdf_settings`; Members is one page, a member's tournament scope set inside
  it). So **in a club** Settings & access, Members, PDF settings, Payouts and Plan & billing live only in the club portal
  and nothing on the tournament side points at them (the event's sidebar loses Settings & access in Part B; the phone's
  tournament More sheet loses it for a club — data only, the phone component untouched). An old link or bookmark to a
  tournament address opens the club's own page (a redirect; no row or button leads there). The event's own mute page is
  the event's (T2). T1's Tournaments list keeps the club's sidebar (ruled; leaving an event, not a settings door).
- **⚖ T1 AMENDED (owner, 2026-11-11, in conversation, after the Tournaments list proved a dead end: a club owner clicking a
  row got a housekeeping window with no way into the event).** In a club, the sidebar foot's **Tournaments door leaves the
  club for the tournament admin**, like the Club and Coaches Portal doors, and opens the **Dashboard of the event the choice
  rule lands on** (the last event opened in this browser; otherwise the Active one happening now or next to start, then the
  most recently finished; drafts only when nothing else exists: `closestToComeUp` in `lib/admin-event-choice.ts`). The
  **Tournaments list lives inside the tournament admin**: it wears the event's sidebar and the strip says EVENTS · Tournaments
  with no dates; its only door is the event switcher's **All tournaments**. No second door now ("cross that bridge later").
  Built: foot door href, `isTournamentEventShell`, the strip word, the redirect waiting for the event list, the record
  window's **Open tournament** button (Manage section, white button). Kept: a tournament-only organization's list keeps its own
  short sidebar; a club with no event yet keeps the club's sidebar so New tournament is there; Settings & access, Members, PDF
  settings, Payouts and Plan & billing are untouched (P2); the phone is unchanged (it already lands on the chosen event).
  Replaces T1's "the club's own sidebar on the list, the foot door lights, the strip says Club". Walk: §509 walk 4 rewritten
  (id `B4R`). **Also 2026-11-11 (owner, "option 1"): a Tournament-plan organization's Settings & access is a row in the event
  sidebar's foot, above Plan & billing** (E3 left it two clicks away behind All tournaments); not for a club, and the phone is
  unchanged (walks 2 and 3 carry it). Committed 2026-11-11: `f04142d98` (the list window's Open tournament button; one lime on Divisions and Venues) and `9991ad080` (the foot door, the list under the event's sidebar, the landing event). Open: whether the landing rule should prefer the nearest event over the remembered one.
- **P3 · The phone is unchanged until Phase 3**: titles drop on a computer only; the phone keeps its titles and its event
  bar. One exception: a tournament-only organization's Settings & access tab row shows on a phone as the club's
  Organization tabs already do.

## 5. Build phases (if ruled) — by dependency and rework risk

- **Phase 0 · The chosen event on first paint.** The server knows the selected event (a cookie beside the stored choice,
  or the address) so the cell and the strip paint right the first time. Everything after reads it; building the cell
  first would ship a flicker and rework it. Also decide here whether an event earns an address (out of scope unless the
  owner asks; record the question).
  - **✅ BUILT 2026-11-09, committed `fd857b765` 2026-11-09.** The choice is also kept in a
    cookie per organization (`flhq_admin_event_<org>`, path `/<org>/admin`, a year, not HttpOnly: the browser writes
    it, and it is a preference the server only looks up in the scoped list), written wherever `localStorage` is (the
    switcher, a caller's pick, the address, and a saved choice that predates the cookie). ONE rule picks the event on
    both sides (`lib/admin-event-choice.ts` `chooseTournament`: pick → `?tournamentId` → `?tournamentSlug` → saved
    (cookie, then `localStorage`) → active → first). ONE read lists the events
    (`lib/admin-tournament-list.ts`, shared with `GET /api/admin/tournaments`, same `getAuthContextWithScope` call, so
    the org filter and the assignment scope are the route's). On a **tournament page's full load only**, the admin
    layout hands the provider the list, the cookie and the address (the proxy forwards the query as `x-search`). The
    provider starts from them, and its mount read is quiet behind a seed (no `loading` flip) and keeps the objects
    when nothing changed. Club pages are unchanged (no seed; the browser's read is the only one, as before). The tab
    title: `AdminTitleManager` now puts its title back when the route's metadata title replaces it, **on tournament
    routes only**. Before Phase 0 that title was correct only because the late list re-ran the effect; the seed
    removed the re-run, and the first build left the tab stuck on "Admin | {org}". Club pages keep their own
    `usePageTitle` names.
  - **Measured 2026-11-09** (`.probe/nav-phase0/firstpaint.mjs`: JavaScript OFF = the server's paint; ON = every name
    the visible header showed; `before.json` / `after.json`). Divisions and Teams, the club's event (UAT Rep Club
    Invitational 2026) and a tournament-only org's (UAT Import Smoke Tournament), 1440 and 390. **Before:** the server
    painted the org's name, the event arrived 1.5–3.5 s later (2 names). **After:** the event on the server's paint,
    the only name seen, identical after load; the sidebar list 5 / 2 options from the first paint; the tab ends on
    "Divisions - {event} - {org} - FieldLogicHQ" as before. A stale cookie (a deleted id) and a foreign one (the other
    org's event) → the active event, the cookie left alone. A saved non-active choice → named on the first paint. An
    address choice (`?tournamentId`, `?tournamentSlug`) → named on the first paint and remembered. Controls unchanged:
    the club's Overview and Rep teams (1440 + 390) and a coach team page.
  - **Known and kept:** two tabs on two events — the last choice wins on the next load in both (as before). A choice
    saved only in `localStorage` before this build is named after one swap on the first load, then from the cookie.
    Event settings paints its blank form until its own read fills it (as before, now a moment earlier). A load within
    about a second of Toronto midnight, on a day an event's phase changes, can hydrate with a different phase chip
    (the chip reads today's date). The odds are about one in a day's seconds; recorded, not guarded. Staff kit's
    printed date has the same shape. Safari caps a script-written cookie at 7 days, so a person away longer on Safari
    gets the one-swap case again (the browser's copy wins and re-writes the cookie).
  - **`/review` 2026-11-09 (high-risk tier; four lenses: security & tenancy, correctness, concurrency & hydration,
    regression).** Security found no path to another organization's event or one outside a person's assignments (the
    seed uses the route's auth call and read). **Applied:**
    - **High:** the tab-title re-assert compared with the raw title, but `document.title` reads back collapsed
      whitespace, so a name with a double or trailing space would loop and freeze the tab. It now compares with the
      read-back form.
    - **Medium:** a failed quiet read emptied a good seed. It now keeps it.
    - **Low:** a switch made while the quiet read was in flight could be put back by the address's event (a deep
      link, or the sandbox dock). A switch now wins.
    - **Advisory:** `x-search` is forwarded on `/{org}/admin` only and deleted elsewhere. A cancelled organization's
      expected refusal is not logged as a failure. Cookie and address keys are capped at 200 characters.
    
    **Recorded:** the seed's second auth read costs about 3 database round-trips per tournament-page full load (it
    reuses the route's call on purpose, so the two can't drift). The re-assert overrides any FUTURE per-page dynamic
    title on a tournament route; Phase 2, which renames the strip, should know. `/legal`: the new cookie holds an
    event id only (a functional preference, nothing about a person). The privacy draft's "cookies needed to run
    FieldLogicHQ… a choice such as" covers it; offered, not run. Verify reds from other sessions' work were left alone.
- **Phase 1 · The shared cell and its list.** One cell component (name on up to two lines, chevron, tile with logo) and the one sidebar foot (Plan & billing, Help, the portal doors, Collapse) and one list
  (popover / sheet), drawn from the shipped `SidebarStripMenu` rows and the `SingleSelectDropdown` chevron face. Club
  cell swaps in first (pixel-identical except the 40px collapsed tile, E10) so the club walks pass unchanged.
  - **Gate (2026-11-09).** Tab **12 · Phase 1 states** added to the drawings (v7; v8 after /design): the tournament
    director (E15) at the club, on a club with no tournament yet, inside the event (Phase-1-only state) and on a phone;
    a club with no current tournament (owner); the club's and the tournament's More sheets; the demo foots; the N10 case.
    /design's eight findings applied (the You group is the shipped two-column grid; the director's phone added; the N10
    tile case drawn; "no current tournament" — archived counts as none; no empty foot block; pins moved; the Phase-1
    double door to Overview captioned; the coach demo holds no other portal). **Owner ruled tab 12 as drawn ("looks
    good, go for it").** /marketing confirmed **"Events"** (the tournament admin's own word — "Event settings", "Set Up
    Your Event"; the coach portal's schedule "events" never sit under it). The account menu's Terms · Privacy line: **its
    removal in the working copy is wanted** (owner, 2026-11-09); Help was built on the menu without it.
  - **✅ Part A BUILT + COMMITTED `664f9113d` 2026-11-09** (only this session's hunks; the heading rule, the menu's legal-line removal and the help articles' family-app and "Staff your board" edits stayed with their sessions). What changed:
    - **The foot, one order** (admin rail, club and tournament; the Premium coach rail): Plan & billing (the owner, bill
      pill) · hairline (only with something on both sides) · the other portals (admin: Club inside a club's tournament
      · Tournaments in the club once it hosts one · Coaches Portal; coach: Club — was "Admin" — · Tournaments you run) ·
      Collapse sidebar. The admin foot was built **pinned** outside the scrolling list (`railFoot`); **owner 2026-11-09
      reversed that on seeing it: the whole nav scrolls, the foot is its last rows, a spacer rests it at the bottom on a tall screen.** The coach rail keeps its structure (Phase 4 rebuilds it).
    - **Help** left every sidebar for the desktop account menu (under What's new, HelpCircle 15, new tab; opt-in
      `helpHref`, passed only by the admin strip and the Premium coach strip — never a wall, the free portal or the
      phone sheet). The phone keeps Help at the More sheet's foot; the demo sandboxes (no account menu) keep it at the
      top of their sidebar foot. One answer for the admin's help address: `adminHelpHref`.
    - **"Club overview"** left the tournament rail and the top of the tournament More sheet (it opens on
      Notifications); **Club** is the foot door and a You door.
    - **Tournaments** left the club's Programs and the phone's fill once hosted (`clubTournamentsDoor`): a foot door and
      a You door. E15: `personClubShape` marks it hosted for a person whose only program is tournaments
      (`personOnlyProgram`); it stays their Programs row and phone-bar slot. A club with no current tournament keeps
      "Also on your plan · Tournaments" and no door.
    - **The strip word** "Club" / "Events" (`ADMIN_STRIP_WORD`, `adminStripWord`, beside `WORKSPACE_KIND_LABEL`),
      from the address and the plan, so the server paints it; "Admin Area" stays everywhere else.
    - NAV_STANDARD N2, N4, N6, N7, N10 rewritten; help articles (org, coaches, tournaments) via `/docs`.
    - **Walk §504 PASSED 31/31 2026-11-09** (computer 14/14, phone 7/7, three other people 7/7, the two demos 3/3); no findings; the one call (foot "Tournaments" vs strip word "EVENTS") ticked through, words stay as built. Next: Part B.
  - **Measured 2026-11-09** (dev server, saved sign-ins refreshed first; `.probe/nav-phase1/`: `measure.mjs` →
    `measure.json` / `measure-run1.json`, `phone.mjs`, `coachfoot.mjs`, `sandbox.mjs`, screenshots beside them):
    - **The strip word** is right on the server's paint (JavaScript off) and never changes after load: club Overview,
      Rep teams, Accounting "CLUB"; the club's tournament and a tournament-only org "EVENTS"; one value in each live
      sequence. The Coaches Portal still says "Coaches Portal" (Phase 4).
    - **The foot**: club owner (after the club's brief) Plan & billing 1 · ── · Tournaments · Collapse; the owner in the
      tournament Plan & billing · ── · Club · Collapse; a club admin who is not the owner, in the tournament Club ·
      Collapse (no hairline), at the club Collapse alone; tournament-only owner Plan & billing · Collapse; a coach with
      no other portal Collapse alone (Help gone); the tournament demo …Help · Collapse and the coach demo …Help ·
      Collapse, no account menu in either. Server paint and live page agree on tournament pages.
    - **Pinned at 1366 × 768**: the foot ends at the viewport's bottom (768); the tournament rows scroll (664 of 539).
    - **The account menu** (desktop): What's new, **Help**, Notification settings, Send feedback, Account settings, Sign
      out — admin (club, tournament, tournament-only) and the Premium coach. The public club site's menu: no Help.
    - **The phone More sheet**: club owner — no Programs group; You = Account, What's new, Home, Tournaments, Plan &
      billing; then Help. Tournament — opens on Notifications; You = …, Club, Plan & billing.
    - **Known and kept (pre-existing):** on a CLUB page the club's shape arrives with its brief after load (no server
      seed), so until then the rail shows "Also on your plan · House league, Tournaments" and the foot has no Tournaments
      door (dev: 5–20 s). Phase 0 seeded tournament pages only. Phase 1 adds the foot door to what moves; the rows
      already moved. Follow-up for the owner: seed the club's shape on the server (Part B or Phase 2).
  - **N10 census (dev, read-only, 2026-11-09; `.probe/nav-phase1/census.mts` → `out-dev.json`):** 17 club orgs, 67
    active members. **One person's tiles change:** an admin without Families on Harbourtown Minor Ball (hosts, runs
    house league) — Schedules · Public site · Tournaments → none (three or none). **Six people** lose the More sheet's
    Tournaments row to the You door (UAT Rep Club ×3, Harbourtown ×2, QA Cancel Lab). No bar changed. All seven are
    test clubs. No tournament director exists on dev (E15 covered by unit tests). **Prod not read** (needs the owner's yes).
  - **Checks:** typecheck clean (8 GB heap), spelling clean, focused lint clean, the nav guards pass (633). The full
    suite's 15 failures and plan-billing-coach-host's 20 "component suspended" failures are other sessions' (the latter
    identical with this change's coach files at HEAD). `check:layout` (Overview, Rep teams, Accounting, the club's
    tournaments list, the coach team hub) passes at 390 / 768 / 1440 except three tap-floor findings on Overview's
    "Needs someone" links at 768 (another session's hub work); the tournament More sheet is unmeasurable there because
    the dev server's badge covers the More button (the probe forced the click and read it as drawn).
  - **Part B** (the club cell on two lines, the 40px logo tile for all three portals, the back link's look) → its own
    session.
    - **⚖ Owner answers before code, 2026-11-09 (all four as recommended):** (1) **seed the club's shape on the server in
      Part B** — the club page's sidebar rows and foot door right on the first paint (the brief's waiting counts still
      arrive after load: they decorate rows, they don't move them); (2) **logo size stored at upload** (stock logos are
      always square; a one-time fill measures the logos already uploaded — dev in the build, production at the promote
      with the owner's yes). Found at the gate: `organizations.logo_url` is on the server's first paint (`OrgProvider`
      seed), but no size is; the only stored size is the family-email cache in `pdf_settings.logoSize`, which a PDF
      settings save wipes, so the tile cannot lean on it; (3) **the logo open AND collapsed** (24px beside the name, 40px
      collapsed), as E10 ruled and tab 10 drew; (4) **the N10 census on production, read-only, before the next promote**
      — not this session's work.
    - **Drawings tab 13 · Part B** (v9, 2026-11-09): the three name lengths, the tile with six kinds of logo, the collapsed
      head at 45px vs tab 10's 58px, the back link in the strip and the phone bar. Not drawn before: the back link's hover
      (and the phone bar's back link at all), the wide-logo fallback, the collapsed cell's height against the band.
      Asks B1–B4 on the tab. **/design pass (v10, applied):** the initials drawn on the shipped 40px tile's white face
      (one frame for logo and initials = new ask B6; tab 10 had an olive tint that ships nowhere at 40px); a tall logo
      (taller than 1 : 2) = new ask B5, an addition to E10; a file that fails to load folded into B4 (initials); keyboard
      focus (cell ring open, the tile's own ring collapsed, the strip tile's 2px-out recipe), the collapsed name bubble
      and the back link's focus drawn; B1 gains C (36px tile); copy de-jargoned ("thin outline", "one-time pass").
      Build notes from the pass: the logo's white ground is a fixed white in the dark theme too (not `--home-card`, which
      turns dark); B3's tooltip needs an overflow measurement and none while collapsed (the bubble shows it); B2's tint
      only under `(hover: hover)` plus `:active` and `:focus-visible`, so it never sticks after a tap.
    - **⚖ Owner ruled tab 13 2026-11-09: B1–B6 all A** ("i agree with your recommendations"): B1 the collapsed cell
      stays 45px (the lines meet; 40px tile, 2px air); B2 the strip's back-link look in both (olive tint on hover/press,
      22px divider in the stronger shade); B3 the native tooltip only when the name is cut, never collapsed; B4 initials
      when the size is unknown or the file fails to load; B5 initials for a logo taller than 1 : 2 too (extends E10); B6
      one tile frame — white, thin outline — for logo and initials (the club's olive initials tile goes). Build in a fresh
      session from `ADMIN_NAV_BUILD_PHASE1_PARTB_PROMPT.md` (its hand-off block).
    - **Part B BUILT 2026-11-10**, committed `eb30602fb` 2026-11-10 (walk §507 PASSED 25/25 2026-11-10). The club cell: the name 14px bold on 16px leading, two lines,
      the whole name as the native tooltip only while cut and never folded; the one `SidebarLogoTile` (24px open, 40px folded,
      white ground and thin outline for logo and initials, fixed white in the dark theme, initials when the stored shape is
      outside 1 : 2 … 2 : 1, unknown, or the file fails to load). The shape is stored with the logo (`organizations.logo_aspect`,
      mig 458, dev only until the promote): an upload measures it, a made stock logo is 1, a removal clears it, and a one-time
      pass measured the logos already uploaded (dev; production at the promote with the owner's yes). The club's shape is read
      on the server (the layout and the brief's route share one read) and seeds the provider, so the Programs order, "Also on
      your plan" and the foot's Tournaments door are in the server's page; the brief's waiting counts still arrive after load.
      The back link: the strip's look (olive-soft tint under `(hover: hover)` plus press and keyboard focus; a 1 × 22px divider in
      the stronger line shade) in the strip, the phone bar and the paper header. **Measured (dev, UAT Rep Club, 1440):** first
      paint = after load for every logo case, the one swap is a broken file (B4); cell 45px open and folded, its line at 93px
      with the tab band's; two-line name fits with no tooltip, a cut one sets it, folded sets none. **Not done:** the N10
      production census (before the promote); the tournament's and the team's tile sources (Phases 2 and 4 pass their own).
    - **/design + /review of Part B (2026-11-10), committed `eb30602fb`.** /design: the cell (one-line, two-line and cut name), the tile (logo,
      initials, wide / tall / very light), folded, the dark theme and the back link (strip, phone bar, paper header) were looked at
      on dev against tab 13: nothing to change. /review (four lenses) FIXED: two guard tests that asserted the rail's old source; the logo
      size reader's pixel limit (a valid 5000 px logo was stored as "unknown" and drew initials; the reader only reads the header, so the
      limit is gone); the backfill writing over a logo a club changed during its slow reads; an orphan comment. **For the owner / the
      promote:** (1) apply migration 458 BEFORE the code, or logo upload, removal and the stock pick fail until it lands; (2) the one-time
      pass must run too, or every existing club shows initials; (3) kept as Low, not changed: the cut-name tooltip can miss a late web-font
      wrap, and a folded sidebar seen on a narrow screen never sets it; a name of only emoji (or a first letter outside the basic plane)
      draws a broken initial (the existing initials helper); the layout's seed of the club's shape does not refresh until the brief lands;
      two extra reads on a full admin load; two admins uploading at once can leave a mismatched shape (storage and row are last-writer-wins,
      as before); the house-wide keyboard-focus ring (navy) is faint on the dark sidebar (pre-existing, global).
- **Phase 2 · Tournament desktop.** Event in the cell; native `<select>` deleted; strip names the page
  (`useAdminPlace` names the lit row); paper titles drop where the strip names the page (Phase 3's `TabPageHeader`
  hand-off pattern); org-wide screens get the org sidebar (E3); `isTournamentOrgScreen` stays the one list.
  - **✅ Part A BUILT 2026-11-10** (the sidebar), committed `c9502c6a1` 2026-11-10. What changed:
    - **The event heads the tournament sidebar** (`EventCell` in `AdminKitRail.tsx`): the club cell's frame (45 px, the name 14/16 bold on up to
      two lines, the whole name as a tooltip only while cut, `CellName` now shared with the club cell), the one `SidebarLogoTile` (24 open, 40
      folded) and a 16 px down chevron (hidden folded). The tile's source is ONE pure rule, `eventTileSource` (`lib/admin-event-cell.ts`): the
      event's logo with its own shape, else the organization's with its shape, else initials; a badly shaped event logo stays the source, so the
      tile falls to the EVENT's initials (T5). The whole cell is one button that opens the list (§6); with no event yet the club cell shows.
    - **The switch list** (`EventSwitchMenu.tsx`): a 320 px `role="menu"` window wearing `SublinedChoice`'s list and rows (`convWhat*`), the
      "Tournaments" band, a row per event (name; "dates · phase word", `eventSwitchLine` — PHASE_LABEL words, E12 (2): "Active" left the list),
      the current event olive with a check, "All tournaments" (trophy) at the foot → the Tournaments list. Under the open cell (2 px below, 2 px
      in) or 8 px beside the folded tile. Keyboard: Enter / Space / ArrowDown open; focus on the current row; arrows rove; Escape and Tab close
      to the cell; a press outside, a page change or a resize closes. The sidebar raises its layer (z 70) while it is open.
    - **T6, built narrower than ruled — owner call RULED 2026-11-11: accept as built:** the chevron shows whenever the cell has an event. The ruled "no chevron" case (a scoped
      volunteer who can reach nothing above their event) has no member in the code today: every person who can open an event can open the
      Tournaments list (scoped people see only their events there), so the branch would be unreachable. Keeping a scoped volunteer off that
      list is a separate access change.
    - **No folding** (E14): the tournament headings are `.label`s; `fl_nav_groups`, the phase defaults (`defaultOpenFor`) and the folded-group
      wrapper are gone. The native `<select id="admin-tournament-select">`, its one-event span, the "Tournament" label, the strip's initials tile
      and its menu went with the cell; `StripMenuButton` lost its last caller and was deleted. NAV_STANDARD N3 has the switcher exception.
    - **One width**: measured, not changed — the club and the tournament sidebar are both 240 (one `--admin-rail-w`).
    - **The event logo's shape** (gate ruling): migration **460** `tournaments.logo_aspect` (dev 2026-11-10; prod at the promote, BEFORE the
      code). The upload route measures it (in parallel with the storage upload) and adds the `?v=` stamp the organization's route has; removal
      clears it; the clone and "reuse a setup" copy it only with the logo; the provider maps `logoUrl` + `logoAspect` (seed and browser read);
      the Public site page updates the cell at once through `patchTournament`. The one-time pass `scripts/backfill-org-logo-aspect.mjs` now
      covers events too (dev: 24 event logos measured, 0 unreadable). The fixture seed `seed-public-frame-fixtures.mjs` copies the shape too.
    - **Found and fixed by /review (pre-existing):** the tournament-logo route never checked that the event is the caller's organization's
      before writing or removing the storage file (`requireTournamentInOrg` now runs first in both).
  - **Measured 2026-11-10** (dev; `.probe/nav-phase2/measure.mjs` → `run1.json`, `run2.json`, screenshots; `switch.mjs`): the club's event
    (UAT Rep Club Invitational 2026: the club's crest, it has no logo) and a tournament-only org's (UAT Import Smoke Tournament: initials "UI",
    no logo anywhere), on Divisions and Settings & access, at 1440 and 1366, open and folded. **First paint = after load**: one value in every
    live sequence, the server's paint (scripts off) already the event with its tile; tab title unchanged ("Divisions - {event} - {org} -
    FieldLogicHQ"). Width 240 / folded 64; cell 45 px, bottom at 93 (the club's line). List: 320 wide at (2, 95) open / (71, 50) folded;
    rows 49–50 px (67 for a wrapped name), All tournaments 44; focus on the current row, ArrowDown moves, Escape closes onto the cell, ArrowDown
    on the cell opens; picking a row switches the event on the same page (strip and cell follow); All tournaments → /tournaments/manage.
    Names: one line fits, a long one cuts at two lines with "…". No `<select>`, no folding button, labels Operations / Setup / Admin. At 1366
    × 768 every event row fits; the foot scrolls (the owner's "whole nav scrolls"). `check:layout` (Dashboard, Divisions, Settings & access,
    Tournaments list) at 1440, 1366 and folded: no new findings. **Not measured on dev data:** one-event list, an event's own logo, a wide
    event logo (dev's measured event logos all belong to orgs without a UAT sign-in) — unit tests cover the rule, the walk's fixture shows them.
  - **/design** (against tab 14): no change needed; the open list's left edge moved from 8 px to the drawn 2 px. Recorded, not changed: the
    folded cell's focus ring is the club cell's inset ring (tab 13 drew a ring outside the tile — change both cells together if wanted).
  - **/simplify** applied: rows built only while open; the logo measured during the upload; `setTournamentLogo` → `patchTournament`; the
    chevron hides through `strip.fullOnly`; `StripMenuButton` + `.menuItemAdd/.menuItemPlus` deleted. **⚠ First step of Phase 4 (all four
    reviewers):** lift `EventSwitchMenu`'s keyboard contract and placement into ONE shared sidebar switcher (`components/shared/`) that
    `SidebarStripMenu` and the coach team cell also use — do it before the coach cell is built, or the contract is copied a third time; fold
    the `.rail:has(.switchMenu)` layer rule into it.
  - **/review** (high-risk; five lenses): fixed the org check above, the fixture seed's shape, and focus on resize. **Recorded (Low):** a
    copied event shares its source's logo FILE (replacing or removing it changes or breaks the copy while its stored shape stays — fixing means
    copying the file on clone); a failed row write after the storage upload leaves the new picture beside the old shape; a list re-read in
    flight can briefly put back the old logo after an upload (the next load heals it; discarding the read could strand a loud read's loading
    line); the Public site page can show the wrong event's logo if the event is switched mid-upload (pre-existing); two shared check scripts
    (`check-layout-invariants.mjs`, `admin-identity.mjs`) still seed the now-unread `fl_nav_groups` (watched automation — owner's call).
  - **Owed at the promote, in this order:** migration 460 to prod BEFORE the code (clone-with-branding, reuse-with-a-logo, logo upload and
    removal fail without it); then `node scripts/backfill-org-logo-aspect.mjs --prod` (dry run) and `--prod --write` (until then existing event
    logos show initials) — both with the owner's yes, beside mig 458's pass.
  - **Walk §508** (https://claude.ai/artifact/UC8MtahRswkropMWeTcDkp, source `ADMIN_NAV_PHASE2A_WALK.html`; fixture
    `scripts/walk-event-logo.mjs`): 3 walks, 24 checks; carries Phase 0's deferred first-paint proof. **✅ PASSED 24/24 2026-11-10, no findings** (Phase 0's first-paint proof closed with it). **Next: Part B** (the strip names the
    page, paper titles drop, the org-wide screens, page help; T1, T2) in a fresh session.
  - **✅ Part B BUILT 2026-11-10**, committed `33ac442a3` 2026-11-10 (the strip, the pages, the organization's screens); gate calls P1–P3 in §4; tab 15 drawn and
    published (/design applied). What changed:
    - **The strip names the page on a computer** (E2): one rule, `deskTitleAt` (`kit-tournament-groups.ts`) over the event sidebar's own
      list, decided once by `DeskTitleProvider` (`components/admin/DeskNamedPage.tsx`) for the strip and every page header. The lit row's
      word is the strip's `<h1>`; the event's dates + phase chip sit at its right end before View site (one hairline on their right; hidden
      ≤1100 px). The phase words come from ONE source, `eventPhaseOf` (`lib/admin-event-cell.ts`), which the switch list's line reads too.
      `AdminPageHeader` hides its title block above 900 px where the strip names the page (`data-desk-named`; with no actions the header
      draws nothing there); its actions keep the top row, "?" last (E11 — already the shape on every tournament page). The phone bar and
      phone titles are unchanged (P3). The org's Tournaments list and a Tournament plan's Plan & billing are named too (no facts).
    - **The event's sidebar = the event's pages** (E3, T1, T2): Settings & access and Tournaments left it (`deskTournamentGroups`);
      "Your notifications" (the event's mute page, /marketing approved the words; page title renamed from "Tournament notifications") is
      the last row under Admin, on the computer AND in the phone's More sheet (its only other door was the retired card page — /review).
    - **The organization's tournament screens wear the organization's sidebar** (`isTournamentEventPath` / `isTournamentOrgScreen`, the
      one list): a club's own (T1: its foot Tournaments door opens and lights the list; the strip says "Club"); a tournament-only
      organization's short one (E3: its cell, Tournaments, Settings & access — the row only for someone holding a tab, hidden in the
      sandbox). Keyboard focus moves to the new cell when the event's cell gives way (/review).
    - **Settings & access is a place on a Tournament plan** (E3 + P1): tabs Members · Payouts · PDF settings · Web address, each the
      person's own (`tournamentSettingsTabs`; Payouts from the server fact `tournamentPayoutsTab`, the payouts route's own gate, read by
      the admin layout so the tab row is right on the first paint); routed through `clubPlaceAt`, so it names itself on both widths (the
      P3 exception). `/tournaments/settings` is a door to the first tab (`TabsDoor`, now shared with the club's `/org`). The card page
      retired; the Web address tab took its fourth card.
    - **One home per setting in a club** (P2): `orgSettingsOnTournamentSide` (`lib/billing-urls.ts`) is the one rule (a Tournament plan
      that is no one-team workspace — `admin/org/layout.tsx`'s own test). Elsewhere the old tournament settings addresses open the club's
      own page with their search kept (`tournamentSideOnly` / `openClubHome`; Plan & billing through a layout so the shared billing
      page's routing is untouched); the phone's More sheet has no Settings & access row there.
    - **The tab title** says the sidebar's words and drops the event's name on the organization's screens (`lib/admin-tab-title.ts`; a
      test holds it to TOUR_GROUPS and the tabs).
  - **Measured 2026-11-10** (dev; `.probe/nav-phase2b/firstpaint.mjs`, `run1`–`run4t`, screenshots beside them): the club (UAT Rep Club,
    its Invitational on game day) and the tournament-only org (UAT Test Org) — event pages, the mute page, the lists, every Settings &
    access tab, Plan & billing, an admin without Payouts — at 1440, 1366 and 390. **The server's paint (scripts off) = the only place state
    during load on every screen**; one title per width; tab titles final and right. `check:layout` (Divisions, Teams, the club's list,
    Members, Web address, Your notifications) at 1440 and 1366: no new findings. Redirects keep the search (`redirect.mjs`).
  - **/design** (built vs. drawn): matches; Low, recorded: the page's top row sits ~14 px lower than drawn (the page's own padding kept).
    **/simplify** applied: one desk-title rule and provider (it had been derived three times, the phone bar included), one event-page
    test, one factory for the seven wrappers, a shared tabs door, one PDF-settings rule, a drift test for the tab words. Skipped: the
    redirect in the admin layout (misses client navigation), narrowing the payouts read, one both-widths naming answer (Phase 3).
    **/review** (high-risk, four lenses) FIXED: the phone had lost its door to the mute page (High); the redirect dropped the search
    (a checkout's success flag after an upgrade to Club); the sandbox showed a Settings & access row; focus fell to the body after "All
    tournaments"; the one-team workspace answered four ways. **Recorded (Low):** a click into an event before the list has loaded on a
    non-tournament first load can briefly show the old strip (the sidebar shares it); switching to an event without the current page's
    row flips the title for a render; the Payouts fact is frozen until reload (as the club's `clubHasPayouts`); 901–1100 px with the
    sidebar folded names the event only in the tile's bubble; the strip's event name no longer links to the Dashboard (E2: the cell holds it).
  - **Walk §509** (https://claude.ai/artifact/6b4BCkFNxB8RDnWq64cUDs, source `ADMIN_NAV_PHASE2B_WALK.html`): 4 walks, 32 checks after walk 4's rewrite (B4R); **PASSED 32/32 2026-11-11**. **Next:
    Phase 3** (the tournament phone); its prompt is written after this phase lands.
- **Phase 3 · Tournament phone.** Bar names the page; the small line opens the sheet; More loses its dropdown (N7 item 1
  rewritten). Prompt written 2026-11-11: `ADMIN_NAV_BUILD_PHASE3_PROMPT.md`.
  - **Gate ruled 2026-11-11** (drawings tab 16 "Phase 3 gate", /design applied before hand-off): **R1 A** the small line is the event's
    name · phase chip · chevron, no dates (they are the list rows' words; at 390 px dates cut the name first); **R2 A, WIDENED by the
    owner** — the event's logo tile leads every row of the event list on the phone sheet **and on the computer's sidebar menu** ("the
    logos down the list would be a nice addition"; accepted knowing an event with no logo of its own repeats the organization's);
    **R3 A** the organization's own screens (the Tournaments list, a Tournament plan's Plan & billing) name the screen with no event
    line — a tournament-only organization's name then shows nowhere on those phone screens (option C, its name as plain text, declined);
    **R4 A** one 44 px target over the page's name and the event line (a tap on "Divisions" opens the list; the bar's old event-name
    link to the Dashboard went — Dashboard is pinned in the bottom bar in every phase).
  - **BUILT 2026-11-11.** The bar's first line reads the strip's answer (`useDeskTitle`, one rule at both widths) as the page's `<h1>`;
    the event door is a `<button>` beside it whose own box reaches up over the name (padding + negative margin, positioned); an event page
    with no sidebar row (Summary before the event is over) keeps the event's name as a span, a chip-only door and its paper title. The
    paper title's hide (`data-desk-named`) lost its breakpoint. New `AdminEventSwitchSheet` (SheetFrame menu layer, the bar's sibling,
    closes past 900 px via `useIsPhoneNav`); rows built once (`eventSwitchRows`) and drawn once (`EventSwitchItems`) for both widths.
    More sheet: the `<select>`, "Current tournament", " - Live", the single-event span and `.switcher*` CSS deleted; its phase read
    folded onto `eventPhaseOf`. NAV_STANDARD N7 item 1 rewritten; help article `event-top-strip` updated (/docs).
  - **Measured (dev, 390 × 844 touch, `.probe/nav-phase3/phone.mjs`):** tournament bar **53.2 px after, 53 px before** (the height did
    not change; the gate expected it would); organization screens 51.4 px; the door's target 46 px tall (the layout check's tap floor
    passes on the button's own box). First paint (scripts off) = after load on every page, both org kinds, no swap (the server's
    bar is 1 px shorter until fonts/scripts settle — no content change). One visible `<h1>` per screen. Tab titles unchanged and
    right. Sheet: opens on the current event; Escape / Back / tap on the dim close it without leaving the page; picking another event
    closes it and stays; All tournaments opens the list; sheet foot 72 px above the screen's foot, bottom bar live. More sheet: no
    select, opens on Notifications. Desktop 1440: the list's rows carry the tile, the trophy aligned under the tiles, 320 px fits.
  - **Checks:** 384 navigation tests (new `admin-nav-phase3.test.ts`; five guards updated in the open: header-bar ×4, phase2b ×2,
    kit-nav ×2, event-cell ×2); typecheck, lint, tokens, spelling, demos green; `check:layout` at 390 (Divisions, Tournaments list,
    Members, the More sheet): no new findings. The full unit suite's 19 failures at the time were all other sessions' files.
  - **/design** (built vs drawn): no High; applied — focus ring offset off the glyphs, chevron in the line's ink, no tint while open.
    **/simplify** applied: `useIsPhoneNav` instead of a hand-rolled media query, one `focusCurrentItem`, no phase-word alias; skipped
    (recorded): renaming `useDeskTitle` (churn while other sessions edit nearby), moving the heading choice into `useAdminPlace`, a
    SheetFrame-level hide above 900 px. **/review** (standard tier, three lenses — correctness, state/accessibility, blast radius; the layout check at 390 first moved the door's target from a ::before onto the button's own box): FIXED — the open list was remembered per address and could reopen unasked on returning to a page by a path that skipped its close (two lenses). **Recorded (Low/advisory):** a client move into an event before the list has loaded can draw the bar without its event line for a beat (the Part B Low, same cause); a tournament-only organization's own screens on a phone have no way to change event but the Tournaments list (R3 as ruled); closing the list by widening past 900 px leaves focus on the page body; the door's target is sized from the name's 16 px × 1.2 line (re-measure if that type step changes); a dev-only mock billing portal keeps its own heading under Plan & billing (two headings, dev only); phone titles now read the sidebar's word ("Results", not "Results & scoring").
  - **Walk §512** (source `ADMIN_NAV_PHASE3_WALK.html`): 6 walks — the bar, the event list, the More sheet, the organization's
    screens, the computer's logos, the demo. **PASSED 26/26 2026-11-11**, no findings; R3 (no organization name on its own phone
    screens) ticked as reading right. **Next: Phase 4** (Coaches Portal desktop). Not walked: a person scoped to some events (no such fixture; the list is the tournament
    context's, which already holds only theirs). **Committed `98294c616` 2026-11-11**, carrying the 2026-11-11 "finished events last"
    order (`eventSwitchOrder`) it builds on, on top of `379bc17a1` (the other navigation session's §509 follow-ups, owner's "commit both").
- **Phase 4 · Coaches Portal desktop.** Sidebar widened to 240 and unfolded (E9, E14); strip split with the word "Coach" and the team's facts at its right end (E7); team cell replacing the `<select>`;
  `CoachTeamHeader` desktop removed; `CoachPageHeader` title/icon tile dropped where the strip names the page, buttons to
  a toolbar row; nested pages' back arrows into the strip; the closed-season page titled "2025 Season" in the strip;
  `CoachTeamSeasonGate` untouched. ⚠ The header-bar project's guards pin the portal as "pixel-identical"
  (`ADMIN_HEADER_BAR_PLAN.md` L182, L261, L448, L548) — retire them deliberately in this phase, not silently.
  **⚖ Gate ruled 2026-11-11 (drawings tab 17 "Phase 4 gate", artifact version 15; /design applied): C1–C9 all A.**
  - **C1** a page with only its "?" keeps a top row with the "?" alone at its right end (the tournament phone's rule); no buttons and no "?" → nothing drawn.
  - **C2** on game day the Game day chip + "Open the bench ›" stay at every width, as their own pair beside the page's name; the quiet words (club, season, opponent, time) give way at ≤1100 (the shipped `.facts` rule is `max-width: 1100px`).
  - **C3** the scouting reminder becomes a slim notice UNDER the page's top row, every team page, same words and ×, scrolls with the page (the buttons and "?" never move for it).
  - **C4** one level down the strip carries the back arrow and where it goes (today's words, one table: All opponents, Roster, Templates, Circuits, All lineups, Practice plans, Skills & goals, Tournaments, Season's End, Tryouts for Tryout history; the handout preview reads "← Player"); the page keeps the record's own title, chips and buttons, "?" last; the page's own back arrow goes. Reason: the coach drill-ins load their record client-side, so a record name in the strip could not be right on first paint (tab 7's "← Practice plans │ Tuesday hitting" is superseded).
  - **C5** Overview is the only coach page whose title carries badges: a non-active season state (Draft …) joins the strip's facts; Premium + division badges go on a computer; the phone keeps all three until Phase 5.
  - **C6** a picked team opens its Overview (a closed team its season's page), as today on both widths.
  - **C7** the crest is built in this phase: crest → the team's colour (`rep_teams.color`; dark initials on a light colour) → initials. The crest is `rep_teams.pdf_settings.logoDataUrl`: record its shape when saved, measure existing uploads once (dev in the build, prod at the promote with the owner's yes, as B4), serve it at its own address (never inline in the page). A crest past 2 : 1 / 1 : 2 falls to the colour.
  - **C8** the strip uses the sidebar's words ("Staff", "Settings", not "Coaching staff" / "Team settings"). The closed-season page is the one exception: the strip names the season through `mastheadSeasonLabel` ("2025 season", or the club's typed name), from the coach's team list (first paint); a long typed name is the one strip name that may be cut, after the facts.
  - **C9** for a club's team the club's name leads the strip's facts and is the first words to give way (today the team bar's meta is the only place it shows on a computer).
  - Facts use the coach's own shipped looks (olive "Game day", amber "Complete") and its words; a record drops a zero tie ("5-0"); a 0-0 record shows nothing; game day with no opponent and no event shows the chip alone. E7's "the chip replaces the record on game day" stands.
  - **Measured at the gate (dev, 2026-11-11, `.probe/nav-phase4/fit.mjs`):** 220 → 240 at 1280 / 1366 costs Overview, Roster, Schedule, Lineups and Money nothing (main 1060→1040 / 1146→1126; no overflow, wrap or new truncation). Unfolded rail ≈ 889 px: at 1366 × 768 Documents, Settings and the foot scroll; at 1440 × 900 only Collapse sidebar. One fixture team; re-measure in the build with a long roster and long opponent names.
  - **BUILT 2026-11-11 (working copy → one commit, see below).** One shared sidebar menu (`SidebarMenu`, placements `cell` / `beside`)
    now serves the event list, the free portal's strip menu and the new team cell. The coach sidebar is 240, unfolded, headed by
    `CoachTeamCell` (crest → colour → initials; chevron only with 2+ teams; "Your teams" then "No live season"; folded = the tile with
    the list beside it); folding retired. The nav list lives once (`lib/coach-team-nav.ts`: sidebar, More sheet, the strip's name,
    the drill-back words). The split strip on TEAM pages only ("Coach", the page's `<h1>` or "← back", the facts at the right end),
    its facts rendered on the server by a new parallel-route slot (`@stripFacts`) from the one cached loader the phone's team bar
    shares. Team bar hidden above 900 (`--coach-header-h` → 0); phone unchanged. The page's top row: `data-desk-named` /
    `data-desk-drill`, "?" last, a lone "?" packs right (C1), the scouting reminder under the row (C3). Crest (C7): `logoAspect`
    + `logoVersion` written by the pdf-settings PUT beside `logoDataUrl`, served at `…/teams/[teamId]/crest`, read by the coach list
    with JSON paths; NO migration; dictionary updated; `scripts/backfill-team-crest-aspect.mjs` (dev: nothing to measure).
  - **Measured (dev, `.probe/nav-phase4/desk.mjs`, runs 2 and 3):** first paint (scripts off) = after load for a one-team coach, a club
    coach with 3 teams, a team between seasons and the demo (exceptions as before: the opponent page, Documents' header, Overview's
    setup chip load client-side); one visible `<h1>` per width; the list's keyboard contract (focus on current, arrows, Escape
    returns to the cell, ArrowDown opens, Tab closes; folded opens beside); at 1440 × 900 only Collapse sidebar scrolls (18 px for a
    coach with no foot doors), at 1366 × 768 the last rows and the foot scroll; the facts hide at 1000 and narrower; phone bar 37 px,
    `--coach-header-h` 37 px, "?" in the bar. After the review fix, a soft-navigation probe (team A → notifications → A → B →
    hub → A, `.probe/nav-phase4/softnav.mjs`) draws the right strip every time with no page errors.
  - **Checks (2026-11-11):** typecheck clean (exit 0); the 14-file guard set plus the two help-content guards: 392 of 393 pass, the
    one failure the workspace-flip census naming other sessions' files (`lib/console-money-sales-tax-wait.ts`,
    `components/admin/DeskNamedPage.tsx`, `components/admin/kit/kit-tournament-groups.ts`); `check:spelling` and `check:demos`
    clean; `check-admin-type` and `check-css-selectors` flag only others' files (platform-admin, `statItem`);
    `check:layout` on coach-overview, coach-roster and coach-season-end at 1440 and at 390: no new findings (Roster's 12 at 390
    are baselined).
  - **/simplify** applied (four reviewers). **Skipped, recorded:** crest facts as real columns (a JSON path reads the whole jsonb,
    picture included, on every coach load — small; **owner call**, it means a migration); one drill-back table also feeding the pages'
    own `backTo` (9 call sites; the phone shows the page's arrow, the computer the table's, the words can drift); lifting `CellName`,
    the cell CSS and the switch-row markup into shared parts; moving the split-strip CSS out of `AdminTopStrip.module.css`; one client
    season hook (resolution repeated in about 5 components); an `inkOnBrand` helper shared with `lib/themes.ts`; `nudgeDay` shared
    with the team bar (Phase 5 retires the bar).
  - **/design** (built vs tab 17 and tab 7; run 3, 23 frames): **no High.** The strip, the "Coach" word, the facts, the cell, the
    list, the drill-in arrows and the closed-season page match. **Two Mediums, NOT fixed here — owner calls, because both are the
    queued top-row review (below), which changes both portals together and a Coaches-only fix would fork the rule:** (1) the "?" has
    no fixed x on a computer: ≈1390 on full-width pages, ≈1302 on 960-wide pages (Overview, Season's End, an opponent — where the
    back arrow and strip name also sit at x=272 against the title at 360), ≈1167 on Notifications — before Phase 4 it lived in the
    full-width team bar; (2) on Schedule and Roster the header's buttons and the page's own toolbar are two components: Schedule's
    "?" is alone on a row with the view switch, Export and Add event a row below (≈100 px from the strip to the first content);
    Roster's Export sits a row below Add Player / Import. **Recorded (Low):** the folded rail's tile measures 32 px, drawn 40 (the
    shared rule is the club cell's owner-ruled 32); a coach with no foot doors scrolls the rail 18 px at 1440 × 900 so Collapse sits 6 px
    under the edge; the live demo's banner + tour bar (147 px) push Staff … Collapse below the fold at 900; Notifications keeps the
    unsplit strip and still says "Coaches Portal" where team pages say "Coach"; the top row sits ≈14 px lower than drawn (the admin's
    accepted Low); the list rows show the season but not another team's record or game day (the team list doesn't carry them).
    **Not verifiable on dev (no fixture):** game day at 1000 / 1101, the scouting reminder, a one-team cell (no arrow), a long team
    name, a real crest upload (C7).
  - **/review** (high-risk, five lenses; report-only helper, claims checked against the code): the gate (`seasonFinished={!live &&
    !!closed}` literal), the phone (More sheet rows identical, `pageHeaderHelpDesk` / `deskNudge` hidden ≤ 900), the sticky offsets
    (every consumer reads `--coach-topstrip-top + --coach-header-h`; none hard-coded to the bar) and the crest / save routes (same
    door as the pdf-settings GET: signed in → same org → team in org → entitled membership; aspect and version measured from the
    stored bytes, never from the request; fixed `image/png` + `nosniff`; private one-year immutable cache keyed by the version) held.
    **FIXED:** (Medium) the strip's facts went stale when a coach left a team for notifications / billing / help / link-org / the hub
    and came back by a soft navigation (Next keeps a slot's last active state on its default, and reuses a matching node) — each of
    those pages now has an empty page in the slot, so leaving a team replaces its facts (guarded in `coach-nav-phase4`); (Low) a new
    crest now refreshes the sidebar's tile at once (`router.refresh()` after the save). **Recorded (Low):** re-saving an unchanged
    crest may change its version stamp if sharp's re-encode is not byte-identical (busts a one-year cache for nothing; unconfirmed);
    the crest route ignores `?v=` (a stale tab can cache the new picture under the old key; harmless, self-heals); the backfill's
    `wrote` count counts attempts. Not reviewed: the admin side of the shared menu refactor beyond its tests.
  - **/docs:** the Premium-portal help sections for collapsing the sidebar, where every tool lives, the bar across the top, the game
    day link, the scouting reminder and two "team switcher" mentions now describe the cell and the split strip; the free portal's
    help is unchanged (it keeps its `<select>`, its folded header and "Coaches Portal"). NAV_STANDARD: only N2, N3's chevron rule
    (superseded by the cell's switch chevron), the coach groups line and the widths line (220 exception retired) — the full rewrite
    is Phase 6. A pre-existing help line ("the whole menu still opens them, read-only") contradicts the one-page closed season;
    left for a separate `/docs` pass.
  - **Older walk checks this phase makes false (not edited — history):** `ADMIN_NAV_PHASE1B_WALK.html` L263 ("sidebar and strip look
    exactly as they did"), `ADMIN_NAV_PHASE1_WALK.html` L276 ("COACHES PORTAL" top left, on a team page), `BANK_CHECK_S3_WALK.html`
    L148 and the ledger sign-in line at §505 ("Switch team" select), `PLAN_AND_BILLING_STAGE2_OWNER_WALK` ("no team picker and no team
    masthead", borderline), `COACH_NAV_GROUPS_COLLAPSE_BUILD_PROMPT.md` L203 (the folding done-criterion), and unchecked ledger
    lines about the team masthead on a computer (≈ L2662, L6050, L7674).
  - **Not clean, and not this phase's:** about 40 unit failures in other sessions' money, two-step and support-console files;
    `verify-changed`'s ESLint config is broken (the `react-hooks` plugin is missing); token, old-look and index-coverage flags on
    others' files; a `statItem` dead class; the workspace-flip census lists others' files.
  - **Walk §514** (https://claude.ai/artifact/7ium3Z1NFePTBbMTcLUSXS, source `ADMIN_NAV_PHASE4_WALK.html`): 8 walks — the team cell
    and list, the strip, the top row and "?", a drill-in, a closed season, the folded rail, the demo, the phone — **PASSED 33/33 2026-11-11, no findings**.
  - **Owed at the promote, with the owner's yes (record; not run):** `node scripts/backfill-team-crest-aspect.mjs --prod`, then
    `--prod --write`. No migration. **Owner calls:** crest facts as real columns (a migration); the two top-row Mediums above (fold
    into the queued top-row review).
- **Phase 4b · Coaches Portal tabs + top row (added 2026-11-11, owner ask after the §514 walk passed 33/33).** The club pins a
  place's tabs in a band under the strip (standard §3 item 4: "tabs pinned in the band where a place has pages"); the Coaches
  Portal's tab bars (Money, Insights, History, Lineups, Practice plans …) sit inside the page body and scroll away, so the
  standard is not yet met there. No earlier phase owned it: Phases 1–4 changed the sidebar and the strip, Phase 5 is the phone
  bar, Phase 6 is words and the walk. **One drawing session covers both this and the queued top-row review below, because the
  pinned tab band and the "?" row compete for the same space.** Open point for the owner: Money's tab bar was set to NEVER
  sticky on 2026-08-19 (one tab pinned, six not = inconsistent chrome). Pinning every tab bar the same way does not bring that
  problem back, so the plan treats it as superseded by the standard — to be ruled, not assumed. Ordered BEFORE Phase 5: the
  phone bar has the same question and would otherwise be redrawn. Gate: drawings, then rulings, then build.
  **Drawings DRAWN 2026-11-11** (a separate artifact, not tab 18 of the older one: https://claude.ai/artifact/VkSTdrAUv9Rbgbwu4gYiun,
  source `COACH_TABS_TOPROW_DRAWINGS.html`; six tabs, measured at 1440 × 900 on dev): rulings **R1–R6 owed**. Measured: four tabbed
  pages stack 32 + 34 + 16 + 45 + 22 = 149px of chrome above the first content (content at y 197); five of seven pages carry a
  34px row holding only a "?". Option A (a 45px band under the strip with tabs + page buttons + "?") puts content at y 125; pinned
  chrome is 93px (A is new: the club's own band is tabs only, which is option B). The Ledger's own pins (toolbar 104 + heads 33) go
  from 185px to 230px pinned. Recommended: A, and the lone "?" on tab-less pages at the right end of the page's first heading
  (option 2). A first recommendation of the "?" in the strip was WITHDRAWN after /design: the 2026-07-31 ruling (memory
  `design_decisions.md` ~5382) holds the strip to leave-this-place doors, says a "?" is not an exit and not to re-propose the strip
  for contextual help; Help has since moved into the account menu, so the strip would be a second help door. **Not built. /design
  review DONE 2026-11-11 (two Highs fixed in the drawings: the withdrawn strip recommendation, A labelled new; Mediums fixed except
  a 1280 frame, given as numbers).**
  **⚖ RULED 2026-11-11 (owner, R1–R6):** **R1 = B, the club's own band** — tabs alone pinned under the strip on every coach page that has
  tabs, the page's buttons stay in the page below it (A, the new buttons-in-the-band pattern, NOT taken). **R2 = nothing rides the band's
  right end** (follows from R1). **R3 = option 2** — the "?" sits at the right end of the page's first heading/row, so the "?"-only row
  disappears; where a page has buttons the "?" stays last in that row as today. This does NOT reverse the 2026-07-31 ruling (help stays
  on the page, never the strip); what changes is the "?" no longer gets a row of its own. **Owner direction: help's place should be the
  same in all three portals; start in the Coaches Portal, and if he likes it after the walk, bring the tournament admin and the club
  over — a cross-portal help review, not built now.** **R4 = accept** the Ledger pinning 230px (check at 768px high before the walk).
  **R5 = as written** (Money 7, Insights 7, Lineups 2, Practice plans 4, Skills & goals 3; the player page's tabs stay under the glance block and dock under the
  strip once scrolled past; Tryouts stages and the editors' view switches stay). **R6 = before Phase 5; the phone follows with the same
  rule in Phase 5.** Net at rest: content 22px higher on the four tabbed pages from the band alone, plus about 50px on every page whose
  row held only a "?" (content to y 80 on a tab-less page; to y 125 + the band on a tabbed one). **Build prompt written 2026-11-11:
  `ADMIN_NAV_BUILD_PHASE4B_PROMPT.md` (Opus; a band-mechanism spike with a recommended shell-owned slot, a stop for the owner's yes on the "?" anchors before wiring ~20 pages).**
  **⚖ R3 REVISED 2026-11-12 (owner: "i agree with your recommendations", on https://claude.ai/artifact/YW35riPNZWMSUaxdSp6ksH).** A code survey found most pages have no first heading
  to hang the "?" on (tabbed pages open on tiles or lists; Email families on a paragraph; every gate and first load has none), so R3's anchors
  would give a different place per page. **The "?" lives in the top strip, between the bell and the account button, on every team page, pages
  with buttons too** (the buttons row keeps only its buttons). **This REVERSES the 2026-07-31 "not CoachTopStrip" boundary on purpose.**
  The account menu's Help row stays the full guide (new tab). **The phone:** its single help door moves into the More sheet's Help row,
  which will open the page's panel (today it opens the full guide) — **Phase 5**, not built here (R6). The tournament admin and the club
  follow only if the owner likes it after walking the Coaches Portal.
  **BUILT 2026-11-12 (walk https://claude.ai/artifact/2GSDgxgwjVsyUq3uqD3v2D, ledger §517; commit owed).** The band: a shell-owned slot reserved by the address (`coachBandAt`, five
  rooms), the page's tab bar portaled into it above 900 (`HubTabBar band`, `HubBandSlot`), `--coach-band-h` (one declaration, 0 on a
  page without tabs and on a phone) added to the register's base and the section deep-link margin. The "?": one publisher (the page header),
  one entry held by `CoachStripHelpProvider`, read by the strip and by the phone's team bar; a hosted header draws none; `actionsPhoneOnly`
  keeps Schedule's phone-only glyphs from leaving an empty row. Measured at 1440 × 900 on dev: band 48–93 full width on all five rooms; the
  Ledger pins toolbar 93 and column heads 197 = **230px (29.9% of 768)**; first content y 175 on a tabbed page with a buttons row, 125 without
  one, 80 on a tab-less page; the "?" between the bell and the account button with no overlap at 1440 / 1366 / 1280 / 1100; the phone unchanged
  (tabs in the page, team bar "?", no sideways scroll). /design (drawings, twice), /simplify, /review (a High fixed: the docked bar's arrows
  re-attach), /docs (13 sentences in the Premium guide, keywords, NAV_STANDARD N11 + new N12) and the demo check done. **Owed:** the walk; the
  commit (exact hunks only — CoachPageHeader, CoachTopStrip, CoachDeskTitle, coach-team-nav, coaches.module.css and coach-nav-phase4.test.ts
  also carry another session's record-slot hunks); two stale Money help pictures to re-capture from the demo world; `coach-findability-smoke`
  and `coach-membership-smoke` now find the "?" in the strip (not run); the Schedule layout-check note (a 2px spill on a clock-stamped span,
  unmatchable by the baseline, not in this change's reach — unproved). **Owner calls open:** none new; the Practice-plans room for a coach with
  no library collapses its reserved band once after load (accepted).
- **Phase 5 · Coaches Portal phone.** Bar names the page; the team on the small line opens `CoachTeamSwitchSheet`.
  - **BUILT 2026-11-12** (walk §519 https://claude.ai/artifact/3B4TgDuuJirmLGzToQLoQS, 8 walks / 32 checks; commit owed with
    the owner's yes). F7 amended at the build (owner): the game console's own back arrow (`.gdBackBtn`, the recap's and the
    error state's `.gdBack`) is removed — the bar's / strip's "← Schedule" (`coachDrillBack` game → `/schedule?event=`) is the
    one way back. Built: `CoachTeamHeader` reads `useCoachDeskTitle` (an `<h1>` on a named page, a back arrow + label one level
    down), the small line from `coachStripFacts` (team · Draft / Game day / Complete chip · record; tablet adds club · season and
    keeps the status at the right, read from `facts.status`), one 44px door (the tournament bar's R4 recipe) with 2+ teams
    (`coachTeamRoster`, now shared with `CoachTeamCell` — a team mid-rollover counts once); `CoachTeamSwitchSheet` rows from
    `teamSwitchGroups` (tile, season words, "No live season" via `SheetLabel`, tinted never checked); the paper title hides at
    every width (`data-desk-named`), `data-phone-row` ('empty' ≤900 / 'tablet' ≤640) drops a header with nothing to show at
    that width, the drill-in's own arrow hides at every width; the "?" stays (`CoachPageHelpSlot reserve`); `--coach-band-h`
    45px at every width and `HubTabBar`'s in-page row sticky under the bar ≤900 (full bleed by a border-image outset — the
    negative-margin form spilled 16px at the layout check); `--coach-bar-h` 53px is the bar's floor and the first paint's
    `--coach-header-h` stand-in. `CoachDeskTitle` names nothing for a team the coach is not on (/review). Guards: new
    `coach-nav-phase5.test.ts`; updated in the open: `coach-nav-phase4` (the named hide at every width; the game is no longer
    a null title), `coach-first-screen-guard` (B1's door is the small line; B2's one-line form retired, its reason kept),
    `sheet-frame-guard`-compatible label, `coach-band-phase4b` (the height at every width; the phone's sticky row; the "?"
    stays), `coach-page-actions-guard` (`reserve`). NAV_STANDARD N7 / N11 / N12 corrected; `memory/design_decisions.md`
    2026-11-12 records the 09-21 reason kept; help `coaches.tsx` "Getting around" → the bar, "On a phone" (bar, switching, tabs).
    **Measured** (dev, touch, 390 × 844 and 768): bar 53.2 px on every page (was 37 / 55), first paint = after load, the
    `--coach-header-h` 53 px in the server's paint; one visible `<h1>` per screen (the game page has none, as before); tabs pin
    53–98; the Ledger's toolbar 98–226 (226 + 72 = 35%); the builder's stepper at 53; the player's tabs dock at 53; the sheet:
    Escape returns focus to the line, Back closes without leaving, a dim tap closes; tablet chevron ~26 px after its line.
    Checks: typecheck ✓, guards ✓, spelling ✓, demos ✓, lint (no errors), `check:layout` 9 screens at 390 no new findings;
    the full `npm test` has failures in other sessions' areas only (signup, billing, club, payments, support console, practice
    plans' arrival words). /design (drawings + built), /simplify, /review (3 lenses) applied. **Owner calls, open:** the Game
    day chip is the portal's olive (the drawing drew red); a lone "+" row remains on pages with buttons (the computer's top-row
    review, owed); a live team's Season's End page is in no sidebar row, so the bar names the team and the page keeps its
    title (the computer's rule too); the sheet's rows show season words only (the team list carries no other team's record).
  - **Gate RULED 2026-11-12: F1–F8 all A, as recommended (owner: "all as recommended").** F3 A keeps the phone's "?" in
    the bar and More → Help stays the full guide — this REPLACES the 4b record's "the phone's help door moves into the More
    sheet's Help row" on purpose (one rule at both widths: the "?" in the fixed top chrome, the menu's Help = the guide).
  - **Gate drawn 2026-11-12** — https://claude.ai/artifact/Xej4haYGxUs7RtWWMTFbq2 (source
    `COACH_PHONE_BAR_DRAWINGS.html`; /design pass applied). Measured today at 390 × 844: team bar 37 px (768: 55 px),
    bottom bar 72, phone tab row 45, the Ledger's pinned toolbar 128; the "?" arrives after load (published in an effect)
    into held space; the game page has no heading at any width; the phone's Your teams sheet does NOT use the crest tile
    (only the desktop cell does). Recommendations: F1 one level down the bar names the way back, the record keeps its name
    and switcher in the page; F2 small line = team · state chip (Draft / Game day / Complete, from `coachStripFacts`) ·
    record; **F3 keep the "?" in the bar (disagrees with the 4b direction "into the More sheet's Help row")**; F4 pin the
    tabs under the bar (Ledger 35 % pinned); F5 keep the Overview's club · season strip; F6 one bar ≤ 900, the tablet's
    line adds club · season and keeps the status; F7 the game page joins `coachDrillBack` (back to Schedule); F8 the
    sheet's rows from `teamSwitchGroups` / `teamTile`.
- **Phase 6 · Words, help, demos, sweep, walk.** NAV_STANDARD rewritten (N7 item 1, N11, exceptions, the cell);
  `memory/design_decisions.md` entry; help articles (`/docs`); demo tour anchors (the build fails if one vanishes);
  `check:layout --changed` on the touched screens, the full sweep on staging; one closing walk.
- **Owner review owed (logged 2026-11-11, after the Phase 4 gate): the page's top row in the tournament admin and the Coaches
  Portal.** With the paper titles gone, the row that is left (the page's buttons and the "?") takes too much room for what it
  holds now that everything on its left is gone; on about twenty coach pages it is a full row for a lone "?" (C1). The owner
  wants the "?" and the top buttons in general looked at across both portals. Phase 4 builds C1 as ruled so the two portals
  stay one rule; this review then changes both together. Not a phase yet: draw it (whole screens, both portals, desktop and
  phone) once Phase 4 has landed, before Phase 6's closing walk.

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

**Recorded, not built (Phase 0, 2026-11-09): does an event earn its own address?** Today `/{org}/admin/tournaments/<page>`
carries no event; the choice is remembered (cookie + `localStorage`) and an address can name one only through
`?tournamentId`/`?tournamentSlug`. An address per event (`/{org}/admin/tournaments/{slug}/<page>`) would make links
exact, let two tabs hold two events across reloads and remove the remembered choice, at the cost of every tournament
route, link, help article and demo tour anchor moving, and of switching an event becoming a navigation (today it keeps
you on the page). Phase 0 made the remembered choice paint correctly, which removed the reason the question was urgent.
It is the owner's call whether to open it.
