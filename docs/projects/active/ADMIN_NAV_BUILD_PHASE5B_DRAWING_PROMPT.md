# Drawing prompt — Navigation, Phase 5b: the player page joins the tab rule (tabs at the top, the summary inside Details, the name is the switcher)

> One **drawing** session, pasted into a fresh chat (`/clear` first). **No code.** Written 2026-11-12 after walk §519 PASSED 32/32,
> from the owner's Phase 5b ruling (plan `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 **Phase 5b** — read it first; where
> this prompt and the plan differ, the plan wins). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` row 5b. **Model: Opus** (layout judgement,
> first-paint and heading reasoning). Helpers read on Sonnet; open the cited lines yourself before building on a claim.
> **The output is a published drawing + the asks for the owner's rulings.** The build prompt is written only after he rules.

## The one-paragraph version
Every tabbed room in the Coaches Portal now pins its tabs at the top — except the player page, which was carved out on purpose
(Phase 4b R5) and still stacks a summary card (a chips line and four tiles: Dues, Attendance, Family, Awards) above its tabs. Since
Phase 4 the computer's strip names the player, so the page's own top row is left holding only a "Switch player" dropdown, alone on
the right. The owner ruled (2026-11-12): **the player's tabs go to the top like every other tabbed room; the summary card moves
inside the Details tab only; and the player switcher is the player's name with a ▾ in the top chrome at every width.** Draw that,
whole screen, before/after, computer and phone, and bring back the few decisions the ruling did not settle.

## What is already settled or built — do NOT redraw or re-ask
- **The phone half of 5b's original ruling is built** (another session, 2026-11-12, owner ruling there — `docs/agents/design/NAV_STANDARD.md`
  **N13 · One level down**): on a phone, one level down, the team bar is the arrow then the **record's own name**, portaled from the page
  (`components/coaches/CoachBarName.tsx`); the player's name button (its ▾, its roster sheet) is what lands in the bar; **no team door
  one level down** (so one chevron per bar); until the page names the record the bar says the kind of place ("Player"). The phone also
  has its own **45px band** directly under the team bar (`bandSlotPhone`, N11) that the banded rooms' tab rows dock into.
  ⚠ **Check the commit state first** (`git log -- components/coaches/CoachBarName.tsx`): if that work is not committed yet, stop and
  tell the owner — this drawing must be drawn FROM the shipped phone bar and band, not from a guess at them.
- **The computer's strip already names the record** (owner 2026-11-11, `recordSlot` in `CoachDeskTitle.tsx`): "← Roster │ Avery Test".
- **The band** is reserved by the address (`coachBandAt` / `BAND_ROOMS` in `lib/coach-team-nav.ts` — five rooms today). Adding the
  player page is the mechanism; the drawing shows the result.
- Tabs keep their address (`?tab=`), and `?section=` deep links keep working (`lib/coach-player-tabs.ts` holds the tab table).
- **A closed season has one door** (`CoachTeamSeasonGate`): a player page is unreachable for a team with no live season. Nothing to draw.

## Read first
1. Plan §5 **Phase 5b** (the ruling, its five points, what it reverses), the Phase 4b record (R5) and Phase 5 record; NAV_STANDARD N11 + N13.
2. The player page: `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx` — the header comment at ~L60 (five tabs with an
   address), the switcher (`switchPlayer` select above 640, the name button `playerNameSwitch` on a phone), the glance block (chips +
   four tiles, ~L655–750, each tile a door to a section on another tab), the tab bar (`HubTabBar sticky`, ~L753), `SaveStatusPill`,
   `CoachPlayerSwitchSheet`. Read the hunks, not the whole file.
3. The shipped controls you will draw from (memory: draw a control from its SHIPPED component): the computer's event switch list
   (`components/admin/kit/EventSwitchMenu.tsx`, 320px, `SublinedChoice`'s skin) and the coach team cell's list; the phone's `CoachPlayerSwitchSheet`; `HubTabBar`.
4. Screens to capture as "before" (UAT coach `uat-coach@uat-test-org.local` · `UATPassword2026!`, UAT Test Team, any player — Avery
   Test has a pitching profile, dues credit, no guardian): 1440 × 900 and 390 × 844 (touch). Restart nothing; use the running dev server.

## What to draw (whole screens, true size, before | after, computer and phone)
1. **Details tab, computer** — strip "← Roster │ Avery Test ▾"; tabs in the band; the summary card at the top of Details, then Player.
   The empty dropdown row is gone.
2. **Details tab, phone** — bar "← │ Avery Test ▾" (as N13 ships it), tabs in the phone band directly under it, summary card, Player
   section with its pencil.
3. **Another tab (This season), both widths** — no summary card; first section directly under the tabs.
4. **The switcher open**, both widths — computer: the list under the name in the strip (the shipped switch-list shape); phone: the
   roster sheet (unchanged).
5. **Edge cases:** a long name (names wrap, never clip — stage 4 · E5) in the strip and in the bar, with the heights it costs; a player
   **off the roster**; a roster of one (no ▾); an assistant coach without roster write (read-only record, no pencils); a coach without
   the money gate (no Dues tile); the tablet (768).

## The asks to bring back (recommend one; the first option is your recommendation)
- **A1 · Where "Off the roster" lives.** Today it is the summary card's only badge ("the ONE state worth stating"). If the card is on
  Details only, a coach on This season / Notes no longer sees that the player is off the roster. Options: (A) a chip beside the name in
  the strip / bar (the header's `titleChips` already portal with the title — check what N13 and `recordSlot` do with chips at 390);
  (B) Details only, with the rest; (C) a line at the top of every tab.
- **A2 · The computer's switch list.** The phone's sheet lists the roster; the computer has a native `<select>`. Recommend the shipped
  switch-list shape (the event / team list) and say what each row carries (name, jersey #, "Off the roster"?), keyboard contract, and
  that switching keeps the tab (it does today) and saves a pending edit first (it does today — `switchTo`).
- **A3 · The summary card's tiles on Details.** Each tile opens a section on another tab. Keep them as doors (recommend), and say
  whether the card keeps its chips line (pitching, positions, age, years with the team) on Details or those move into the Player section.
- **A4 · The tile that points at its own tab.** None will once the card is Details-only — confirm, and confirm `?tab=details&section=`
  links from elsewhere (the roster's prompts, notifications) still land somewhere sensible.
- **A5 · First paint.** The band and the bar's record name must be right on the server's first paint (the Phase 0 lesson). Measure
  today's first paint of a player page at both widths (JS off = the server's paint; probe pattern in `.probe/nav-phase4/`,
  `.probe/nav-phase5/`) and say what moves when the player loads: the strip/bar name ("Player" → "Avery Test"), the tabs (gated ones —
  Skills & goals, Notes — appear by capability), the card.
- **A6 · Anything else the drawing surfaces** — a disagreement with the ruling goes here, argued from the code, before the owner
  rules (AGENCY_RULES: disagree out loud).

## How to present it
- One Claude **Artifact** (HTML), the house drawing layout (memory: mockups as Claude Artifacts — sticky tabs, Everything / Show only
  what differs; whole-screen before/after; true size). Every highlight clickable to its note.
- Run **`/design` on the drawing before hand-off** and apply what it finds. Publish to a NEW artifact; save the source as
  `docs/projects/active/ADMIN_NAV_PHASE5B_DRAWINGS.html`; link it from the plan's Phase 5b record and the prompts index row 5b.
- In the chat: the **product-manager UX summary** (what the coach sees and does differently, both widths, who is affected), then the
  asks A1–A6 with recommendations. **No code, no commit.** Record the rulings in the plan when he gives them, then write
  `ADMIN_NAV_BUILD_PHASE5B_PROMPT.md` (the build) — which must also: add the player page to NAV_STANDARD N11 (delete "the player page's
  tabs … dock under the strip once scrolled past"), update the player page's header comment (hub F10 / R5 reversed, with the reason),
  update `coach-band-phase4b` / `coach-nav-phase5` guards in the open, and fold into the Phase 6 closing walk.
