# Build prompt — Navigation, Phase 5b: the player page joins the tab rule (tabs at the top, the summary in Details, the name is the switcher)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-12 from the owner's rulings on the drawing
> (https://claude.ai/artifact/SAVNjmaraLUazZqVTPAXRR v2, source `docs/projects/active/ADMIN_NAV_PHASE5B_DRAWINGS.html`; owner: "looks good,
> go ahead with the build prompt" = **A1–A6 all as recommended**, A3 with the phone figure rows). Plan of record:
> `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 **Phase 5b** (the ruling's five points, the drawing record, the rulings line).
> Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` row 5b. **Model: Opus** (one title element that must live in two chromes, first paint,
> heading semantics, an autosave race). Helpers read on Sonnet; open the cited lines yourself before building on a claim.
> **Where this prompt and the plan differ, the plan wins.** No gate: the drawing is ruled. Build to it.

## The one-paragraph version
Every tabbed room in the Coaches Portal pins its tabs at the top except the player page, which still stacks a lone "Switch player"
dropdown row, a summary card (a chips line + four tiles) and then its tabs (~300 px down on a computer). Build the ruled shape: **the
player's tabs sit in the band from rest at both widths; the summary shows on Details only (tiles on a computer and tablet, the
dashboard's figure rows on a phone); the player's name with a ▾ in the strip (computer) or bar (phone/tablet) is the switcher; the
dropdown row is gone; "Off the roster" rides beside the name in the chrome; a long name wraps in the phone bar and the strip's facts
give way before the name.**

## Already built — stand on it, do not rebuild (verify each before relying on it)
- **N13 + the phone band, committed `dc1351820`** (`git log -- components/coaches/CoachBarName.tsx`): on a phone one level down the
  team bar is "← │ {record name}", the page's title PORTALED into the bar's slot (`CoachBarName`, `useCoachBarNameSlot`); the player's
  name BUTTON is what lands there today (its ref and the sheet's state stay the page's); until the page names the record the bar says
  the kind of place (`coachDrillBack().here` → "Player", `.teamBarHere`). No team door one level down. The phone band
  (`bandSlotPhone`, N11) sits under the bar at `--coach-header-h`, which the bar publishes from its measured height (ResizeObserver in
  `CoachTeamHeader`), so a taller bar moves the band with it.
- **The computer's strip names the record** (`recordSlot` in `CoachDeskTitle` / `CoachTopStrip`; `CoachPageHeader` portals `<h1>` +
  `titleChips` into it as "← Roster │ Avery Test"). ⚠ It portals a **text** title only (`deskRecord = … typeof title === 'string'`),
  deliberately: the player's phone title is a button owning a ref, and a second copy would steal it.
- **The band** (Phase 4b): `coachBandAt` / `BAND_ROOMS` in `lib/coach-team-nav.ts` reserve it **by the address** (today five rooms,
  one-segment addresses only — `seg.length === 1`); `HubTabBar band` portals the row into the shell's slot (`HubBandSlot`: `el` on a
  computer, `phoneEl` on a phone); `--coach-band-h` 45 px; the section deep-link margin already reads it.
- **The dashboard's figure rows on a phone** (`components/coaches/CoachFigureRows.tsx`: `CoachFigureRows` + `CoachFigureRow`; owner
  B3·B5·B6 2026-09-20/21, Insights A1 2026-09-25): one white frame, label + ONE fact caption left, figure right, chevron; **phone-only by
  stylesheet** (`.figureRows` hidden above 640; the caller hides its wide form at ≤640 with its own class — never a JS media query).
- **The switch list** (`components/admin/kit/EventSwitchMenu.tsx` on `SidebarMenu`, `SidebarSwitchList.module.css`, the `convWhat*`
  rows in `coaches.module.css`) and the **roster sheet** (`CoachPlayerSwitchSheet`, on `SheetFrame`).
- The player page: `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx` — `switchTo` (~L596, saves a pending edit first,
  keeps the tab), `switchPlayer` select (~L603), the name button `title` (~L618, `canSheet` ~L537 uses `useIsPhone` = 640), the glance
  block (~L679–751), `HubTabBar sticky` (~L753), the early `LoadingState` return (~L541). Tabs table: `lib/coach-player-tabs.ts`.

## What to build (the rulings, as specification)
1. **Tabs in the band, from rest, both widths (ruling point 1).** Add the player page's address (`roster/{playerId}`, two segments) to
   the band's rooms without loosening the one-segment rule for anything else (no other two-segment address gets a band). Swap the
   player page's `HubTabBar sticky` for `band`. Tabs keep `?tab=` and `?section=`. Computer band 48–93, phone/tablet band under the bar.
2. **A5 · First paint.** The band is reserved by the address on the server's paint (it is, once (1) lands — verify). **Draw the tab row
   before the player's record arrives:** it needs only the coach's access (the `TAB_GATE` capabilities), never the player — move it out
   from behind the `assignmentsLoading || fetching` early return (keep the loading line for the body). While access is unknown, the
   band stays empty rather than showing three tabs that become five. **The computer strip's empty record slot shows the kind of place**
   ("Player", from `coachDrillBack().here`) until the page fills it, exactly as the phone bar's `.teamBarHere` does — this is one rule
   for every drill-in on the computer, not the player page alone (say so in N13). After this, the only things that change when the
   player loads are the name (same line) and the page body under a band that does not move. Measure it (below).
3. **The summary on Details only (ruling point 2, A3, A4, A6·4).**
   - Render the card only when `tab === 'details'`, above the Player section.
   - **Chips line:** keep only *years with the team* (`withTeam`). Pitching, positions, A-squad and age go — the Player section directly
     below states each. "Off the roster" leaves the card (item 5).
   - **Computer and tablet (>640):** the four tiles stay doors to their sections (Dues/Attendance/Awards → This season, Family → Family
     & paperwork); **the grid fits the count** (three across when the Dues tile is absent — no empty fourth slot).
   - **Phone (≤640): the dashboard's figure rows, not 2×2 tiles** (`CoachFigureRows`, the same row per figure, each a door to the same
     section). A row's caption is a **fact or nothing**. From today's tile feet: Dues — "$X credit held" and "n/m installments paid" stay;
     "No dues this season" goes (the figure "None set" says it, as words). Attendance — "14 recorded · 2 not recorded" and "Nothing
     recorded yet" stay. Family — the email/phone and "Kept to the head coach" stay; "Add a contact" goes (a hint). Awards — "this season"
     goes. A figure that is words ("Paid", "None set", "No contact", a guardian's name) uses the row's `words` form. Wide form hidden at
     ≤640 by its own class; no JS media query.
   - **A4:** no tile points at Details; the roster's "+ Add a position" (`tab=details&section=player`) must still land on the Player
     section, clear of the band — check it.
4. **The switcher = the name ▾ in the top chrome at every width (ruling point 3, A2, A6·2, A6·3).**
   - **Delete the dropdown row** (`switchPlayer` select). With no actions the header row draws nothing at any width (it already
     collapses: `data-desk-drill='empty'` / `data-phone-row`) — verify the 32 px gap above it is gone too.
   - **Computer (>900):** "← Roster │ Avery Test ▾" — the name and a 16 px chevron are ONE button (the cell recipe, N3: one target,
     never a name beside a separate chevron) in the strip's record slot. It opens the **switch list**: `SidebarMenu`, 320 wide, 2 px under
     the name, head "Players", 44 px rows with hairlines, each row the player's name and "#{number}" in the list's trailing slot
     (`convWhatOptLive`), the current player olive with a check, a long roster scrolling inside the list's height cap, no foot row (the
     arrow already leads to Roster). Keyboard = `SidebarMenu`'s contract: Enter / Space / ↓ on the name opens; focus lands on the
     current player; arrows rove; Enter picks; Escape, Tab and a click outside close; focus returns to the name. Picking calls
     `switchTo` (saves a pending edit first, keeps the tab; a save that cannot land keeps the coach here with the pill saying so).
   - **⚠ The one hard part: one title, two chromes.** The strip's slot takes text only today, and the phone's bar already holds the name
     button. Design it so each width has exactly one switcher button with one ref and one open state — e.g. the page renders the name
     button once and `CoachPageHeader` portals it into whichever slot the current width shows (`useIsPhoneNav`, the chrome's 900 split),
     or two buttons with separate refs — and argue the choice from the code before writing it. Both bars are in the DOM at every width
     (see `CoachDeskTitle`'s comment), so a single element cannot be portaled into both. One visible `<h1>` per width must still hold.
   - **Phone and tablet (≤900): the name ▾ opens the roster sheet** (`CoachPlayerSwitchSheet`, unchanged rows). The switcher follows the
     **chrome's** split (≤900, `useIsPhoneNav`), not the content's (≤640, `useIsPhone`): the tablet loses today's dropdown row and gets
     the sheet. The record-vs-form split stays at 640.
   - **No ▾** with a roster of one, or for a player **off the roster** (today's phone rule, now at every width — the list has no "you
     are here" row). The computer loses its jump from an off-roster player straight to another; the arrow to Roster is the way.
   - **A6·3 · the phone sheet saves first, like the computer.** Today its rows are links the `UnsavedChangesGuard` intercepts ("Leave
     without saving?") while an edit sits inside the autosave pause. Ruled: picking a player from the sheet saves the pending edit and
     goes (`switchTo`), no question. Keep the rows as links if you can (their header comment says not to turn them into buttons — that
     reason was the guard's question, which this ruling retires; rewrite the comment with the new reason). Make sure the guard still
     asks on every OTHER way out of a dirty page.
5. **A1 · "Off the roster" in the chrome.** Pass it as the header's `titleChips` (it travels with the title into the strip and the bar);
   keep the shipped look (`.badge.badgeDraft`: neutral, not a colour — a fact, not an action). On every tab. Check the bar at 390 with a
   long name + the chip (it wraps under item 6), and the strip at 1101–1440.
6. **A6·1 · Long names.** *Phone bar:* the record's name **wraps** (stage 4 · E5 — a name a coach typed is never cut); today
   `.teamBarSlot > .teamBarName > button > span` and `.teamBarName` cut it with "…". One rule for every drill-in's name in the slot (a
   lineup or an opponent name is typed too) — say if you find one that must stay one line, and why. The bar grows; the band follows
   `--coach-header-h` — measure 1-, 2- and 3-line names. *Computer strip:* one line by design (walk §486 E), but **on a record's page the
   team's facts give way before the name** (today the facts are `flex: none` and the name is cut between ≈1100 and ≈1420 with a 40-char
   name, and at 1440 with the chip). The team is named in the sidebar cell. Pick the mechanism (hide the facts when the place cannot hold
   name + chip + facts) and measure at 1101, 1280, 1420, 1440 with "Maximilien-Alexandre Beauchemin-Tremblay" ± the chip.

## Words and records to change in the same unit of work
- `docs/agents/design/NAV_STANDARD.md` **N11**: add the player page to the band's rooms and **delete** "The player page's tabs sit under
  its summary and dock under the strip once scrolled past."; **N13**: the computer's slot says the kind of place until named; the
  record's name wraps on a phone; the player's name ▾ is the switcher at every width (≤900 the sheet, above it the list); **N3** if the
  cell-recipe sentence needs the record switcher named.
- The player page's header comment (~L61–73, "the glance card is the index on every tab") and the glance comment (~L679): hub F10 and
  Phase 4b R5 **reversed on purpose** (owner 2026-11-12) — the reason: since Phase 4 the strip names the player, so the page's own top
  row held only the dropdown and the tabs sat ~300 px below every other room; F10's reason survives because Details is the landing tab.
  The `switchPlayer` / `title` comments (~L583–617). `lib/coach-player-tabs.ts` ("the glance card carries the mid-season answer on every
  tab"). `CoachPlayerSwitchSheet`'s header ("The desktop and the 641–768 band keep the Switch player `<select>`"; the links-not-buttons
  reason). `CoachPageHeader`'s "A TEXT TITLE ONLY" note.
- `memory/design_decisions.md`: one 2026-11-12 entry (the ruling, A1–A6, the reasons, what it reverses).
- Guards, **updated in the open, each change named in the report:** `tests/unit/coach-band-phase4b.test.ts` (the band's rooms; the
  player page's tab bar is `band`, not `sticky`), `tests/unit/coach-nav-phase5.test.ts` (and `coach-nav-phase4` where it pins the
  text-only record slot or the select), `nav-standard-guard` if it pins N11's sentence. **Add:** the player page's address has a band and
  no other two-segment address does; no `<select>` on the player page; the summary renders on Details only; the phone figure rows exist
  and the wide tiles hide at ≤640 by class; the off-roster chip is a `titleChips`; no ▾ for a roster of one / an off-roster player.

## Gotchas
- **First paint is a gate.** Probe it with scripts off and with per-frame sampling at 1440, 390 and 768:
  `.probe/nav-phase5b/paint.mjs` + `lib.mjs` (signs in without a browser; the fixture is UAT Test Team / Avery Test, ids in
  `.probe/nav-phase5b/settled.json`). Today's numbers to beat are in the plan's 5b drawing record.
- **The autosave race.** `switchTo` returns early while a save is in flight and stops on a failed save; keep both. Test a switch inside
  the debounce at both widths, and a failed save (clear the first name) — the coach must stay on the page.
- **One `<h1>` per width** (the strip's name on a computer, the bar's on a phone); the paper title stays hidden.
- **The free Coaches Portal** has no strip slot or band; the player page there must keep working (check what it renders — do not add
  a branch for it unless something breaks).
- **A team with no live season** has one door (`CoachTeamSeasonGate`); a player page is unreachable there. Nothing to build.
- **Shared working copy:** other sessions have uncommitted files in this tree (sign-in, club audit log, legal). `git diff` every file
  before editing; commit only your hunks through a private index. **No commit without the owner's yes.**
- **Dev server:** do not restart for page edits; restart (via `npm run dev` only) if you add or delete files. No sweeps on it;
  `npm run check:layout --changed` on the player page at 1440, 390 and 768.
- **Spelling gate**; the demo check (`npm run check:demos` — the tour may anchor the player page).

## Steps
1. Read the plan's 5b record and the drawing (all panels; the notes D1–D8 and the asks A1–A6 are the spec's annotations). Present the
   product-manager UX summary and the task list. Argue item 4's "one title, two chromes" design in a few lines, then build.
2. Build items 1–6 and the words. Then `npm run verify:changed`, `npm run typecheck`, the guards above, `npm run check:spelling`,
   `npm run check:demos`, `npm run check:layout --changed` (player page, 1440 / 390 / 768).
3. **Measure and report** (px, dev): computer Details/This season first-section y (drawn ≈246 / 125), phone (≈322 / 114), tablet;
   the band at 48–93 / under the bar at every width; first paint scripts-off and per-frame (what changes when the player loads — only the
   name and the body); the switch list open (position, keyboard, focus return, tab kept, save-first); the sheet's save-first; long names
   (phone bar heights 1/2/3 lines, band flush; strip at 1101/1280/1420/1440 ± chip); off-roster; roster of one; an assistant without
   roster write (record view, no pencils, the switcher kept); a coach without the money gate (three tiles across; three rows).
4. `/design` on the built screens against the drawing; `/simplify` (a title in two chromes, a band rule that learned a second shape);
   `/review`.
5. `/docs`: help articles that mention the "Switch player" dropdown, the summary on every tab, or the player page's tabs.
6. **No walk of its own:** add the 5b checks to the **Phase 6 closing walk** (`ADMIN_NAV_BUILD_PHASE6_PROMPT.md` — one purpose per
   walk: the player page's tabs + summary; the switcher at three widths; long names + off-roster). Update the plan's 5b record with the
   measurements, the prompts index row, the TODO line and project memory (positive facts: "built 2026-MM-DD").
7. **Do not commit without the owner's yes.** On the yes, only this session's files, exact hunks, through a private index on HEAD.

## Done when
- At every width the player's tabs sit in the band from the first paint; nothing below the chrome jumps into place above the body.
- The dropdown row is gone; the name ▾ in the strip opens the switch list (computer) and in the bar opens the roster sheet (≤900);
  both keep the tab and save a pending edit first; no ▾ for a roster of one or an off-roster player.
- The summary shows on Details only: tiles that fit their count above 640, the figure rows at 640 and below, captions facts only;
  the chips line keeps only years with the team; "Off the roster" sits beside the name in the chrome on every tab.
- The computer's strip says "Player" until the record names itself; a long name wraps in the phone bar (the band follows) and keeps
  its room in the strip at 1101–1440.
- NAV_STANDARD N11 / N13, the code comments and the guards say what the code does; checks pass; `/design`, `/simplify`, `/review`,
  `/docs` applied or recorded; the 5b checks are in the Phase 6 closing walk.
