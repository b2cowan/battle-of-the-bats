# Build prompt — Navigation, Phase 2: tournament desktop (the event in the cell, the page named in the strip)

> One session, pasted into a fresh chat (`/clear` first), after Phase 1 has landed. Written 2026-11-10 from the owner's
> rulings (asks E1–E16 all as recommended) and from what Phase 0 and Phase 1 (Parts A and B) actually shipped. Plan of
> record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (§0, §0b, §4, §5 Phase 2, §6, and the Phase 0 / Phase 1
> records). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. If the session runs deep, stop after **Part A** (the cell, the
> list, the folding, the width), write the hand-off, and do Part B (the strip names the page, the paper titles drop,
> the org-wide screens, page help) in a second session.

## What Phases 0 and 1 shipped that this phase stands on
- **A tournament page knows its event on the server's first paint** (Phase 0, `fd857b765`). The admin layout seeds the
  tournament provider (the list this person may open + the chosen event, from a per-organization cookie and the
  address). Anything this phase adds that names or depends on the event reads the provider's current event, never a
  fetch of its own. **A new swap on first paint is a regression of Phase 0, not polish.** The measuring tool:
  `.probe/nav-phase0/firstpaint.mjs` (server paint with scripts off, then every change after load; refresh saved
  sign-ins first).
- **The tab title is re-asserted on tournament pages** (the admin title manager watches the head there). If the strip
  label starts to feed a title, measure the final tab title on a club page and a tournament page.
- **The strip says "Events" on tournament screens, "Club" on club screens** (Phase 1 Part A, `664f9113d`), decided from
  the address on the server. The sidebar foot is one order (Plan & billing, hairline, the other portals, Collapse);
  Help lives in the desktop account menu; "Club overview" already left the tournament rail and the tournament More sheet.
- **The one logo tile exists** (Part B, `eb30602fb`): `components/shared/SidebarLogoTile.tsx` (props: source, aspect,
  name, size). It was built for all three portals; the **event passes its own source in this phase** (E10: the event's
  logo, else the organization's, else initials; the 1 : 2 … 2 : 1 shape rule and the "wider/taller → initials" rule are
  in `lib/logo-aspect.ts`; a tournament's logo is `tournaments.logo_url`, which today has no stored shape — decide, in
  the gate, whether it measures at upload like the organization's did (a migration, then) or the tile measures on load
  and accepts one swap; the first-paint rule above is why this is a question). The club cell (`ClubCell` in
  `components/admin/kit/AdminKitRail.tsx`) is the pattern: the name on up to two lines (14 px bold, 16 px leading),
  the whole name on hover only when cut, the cell 45 px tall so its bottom line meets the tab band's.
- **The back link wears one look** in the strip, the phone bar and the paper header (Part B).
- Walks passed: §504 (Part A), §507 (Part B). Phase 0's walk was deferred to **this phase's walk** — it must also prove
  that a tournament page shows the event, not the club, on first paint (both org kinds, 1440 and 390).

## Read first, in this order
1. The plan: §0, §0b, the strip-word ruling, §4 (E1, E2, E3, E10 event, E11, E12 (2), E14 as ruled), §5 Phase 2, §6
   (the /design pass: the whole cell opens the list; page help stays off the strip; the phase is a chip on the cell's
   line; E3 drawn with shipped rows only). The design-log entries of 2026-11-09 (top of `memory/design_decisions.md`).
   `docs/agents/design/NAV_STANDARD.md` (N3 needs a written switcher exception; N4, N6, N7, N10, N11).
2. The drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 (source `ADMIN_NAV_EVALUATION_DRAWINGS.html`). Read the
   tabs for the tournament desktop (the sidebar with the event in the cell and the list open, the strip with facts at its
   right end, the org-wide screen with the org's sidebar and "Settings & access", the worst-case long event name at
   240 px, the 1366 × 768 frame) and the Asks tab for E1, E2, E3, E10, E11, E12, E14.
3. Code: `components/admin/kit/AdminKitRail.tsx` (`TournamentRail`: the native `<select id="admin-tournament-select">`
   and the strip tile — both go; the group headings that fold), `components/admin/kit/AdminKitFrame.module.css`,
   `components/admin/AdminTopStrip.tsx` + `AdminBarPlace.tsx` + `AdminEventHeader.tsx` + `useAdminPlace.tsx` (the strip
   names the lit row; `useAdminPlace` excludes tournament org screens at ~L59), `lib/admin-kit-nav.ts`
   (`isTournamentOrgScreen` at ~L931 — **stays the one list**; the tournament nav model and its groups),
   `lib/workspace-labels.ts`, `components/admin/kit/club/PlaceFrame.tsx` (`TabPageHeader`: the pattern for a page that
   drops its title where the strip names the place), `components/admin/AdminPageHeader*`, the tournament providers
   (`lib/tournament-context*`), and the guards that pin these (`tests/unit/admin-header-bar-guard.test.ts`,
   `admin-kit-nav.test.ts`, `nav-standard-guard.test.ts`, `sidebar-strip-guard.test.ts`, `admin-cancelled-one-page-guard.test.ts`).
   **Do not touch** `AdminKitBottomNav.tsx`'s tournament select or the phone bar — that is Phase 3.

Broad reading goes to a helper (CLAUDE.md); check its claims against the code before building on them.

## Gate (blocking, before any code)
1. **Mockups only for what the drawings do not show.** Candidates: the event's logo tile in the cell with a wide, a tall
   and a very light logo (tab 13's states, reused for the event); a tournament with **no** logo and an organization with
   none; the cell with exactly one event (nothing to switch: no chevron, still opens that event's Overview); the
   org-wide screens for a **tournament-only organization** vs. one that also runs a club; the strip's right end on a
   long tournament name + dates + phase chip at 1366 px. Add them as a new tab, republish to the same artifact, run
   `/design` on them, then bring me the rulings. If every state is already drawn, say so and skip.
2. **Settle the event logo's shape** (above) and say what it costs: a migration (dev first, prod at the promote) or a
   one-swap-on-load.
3. Present the **product-manager UX summary** and the task list before any code.

> **⚖ GATE RULED 2026-11-10 — start at Steps 2.**
> - The rulings are in the plan, §4, under "Phase 2 gate ruling(s)": the logo, the status words, the scope, and T1–T6.
> - The states are drawn in tab 14 of the drawings (`/design` pass applied), published to the same artifact.
> - **This prompt's Part A is amended by those rulings:**
>   - The cell holds the name alone; there is **no chip in the cell** (E2; the line below predates round 2).
>   - The chevron shows whenever the person can reach the organization's tournament screens, even with one event (T6).
>   - The list rows are the standard two-line dropdown row: name, then dates · phase; the current row is olive with a
>     check (T3 + the owner's change).
>   - There is no game-day dot on the collapsed tile (T4).
>   - A badly shaped event logo shows the event's initials (T5).
>   - The event logo's shape is stored at upload, which is a migration.
> - Part B carries T1 and T2.

## What this session changes
**Part A — the sidebar**
- **The event heads the sidebar in the cell** (E1, E10): the event's name on up to two lines, the logo tile (24 px open,
  40 px folded — the same `SidebarLogoTile`). ~~the phase as a chip on the cell's line~~ (superseded, see the gate box).
  **When the person has a choice the whole cell opens the list** (the chevron is its sign — §6, amended by T6); without
  one, it opens that event's Dashboard. The native
  `<select>` and the strip tile are deleted. The list is a switcher window in the house kind (not a native control);
  keyboard: open, arrow, Enter, Escape returns focus to the cell.
- **No folding anywhere in the tournament sidebar** (E14): group headings become labels; the list scrolls between the
  pinned cell and the foot. Write the N3 exception for the switcher's chevron in `NAV_STANDARD.md`.
- **One sidebar width** (E9 scope for this portal): the tournament sidebar takes the club's 240 px if it differs today.
  Measure; do not guess.
- **The list's status words** (E12 (2)): the same words wherever an event's status is shown (list, chip, strip) —
  one spelling, one source.

**Part B — the strip, the pages, the org-wide screens**
- **The strip names the page** (E2): `useAdminPlace` names the lit row; the place's facts (dates, phase) sit at the
  strip's **right end, before View site**. The cell keeps the name alone.
- **Paper titles drop where the strip names the page** (the `TabPageHeader` hand-off pattern). Only where the strip
  names it; a screen the strip cannot name keeps its title.
- **Org-wide tournament screens get the organization's own sidebar** (E3): the org in the cell; a tournament-only
  organization has no "Account" group — the organization becomes the place "Settings & access" with Members · Payouts ·
  PDF settings as tabs (N11, §6). `isTournamentOrgScreen` stays the one list.
- **Page help "?" (E11)**: the right end of the page's top row, always last, never on the strip. Tournament screens
  first; do not add a second home.

**Not this phase:** the phone (Phase 3), the Coaches Portal (Phases 4–5), the club's sidebar (done), NAV_STANDARD's full
rewrite and the help articles (Phase 6 — but write the N3 exception now), a tournament page's own content.

## Gotchas
- **First paint is a gate.** The cell, the tile, the chip and the strip's facts must be right in the server's HTML for
  both org kinds and for a person with one event and many. Measure with scripts off.
- **Tournament pages re-title the tab after hydration.** If the strip label changes, measure the final tab title.
- **Tournament-only vs. mixed organizations** take different org-wide screens (E3); test both fixtures.
- **A person who can open one event of many** (a scoped role) must see only theirs in the list.
- **The demo sandbox** (`riverdale-minor-ball`) runs this chrome: the build fails if a tour destination or anchor stops
  existing. Do not add "re-read" notes to the demo files; run `npm run check:demos`.
- **The header-bar project's guards** may pin the tournament chrome as it is; update an expectation deliberately, in the
  open, and say so.
- **Spelling gate** (`npm run check:spelling`): one spelling per word; the clock is "8:00 a.m." via `formatTime()`; dates
  via `formatStoredDate`.
- **Shared working copy:** other sessions' uncommitted hunks sit in the rail, the frame CSS and the strip. `git diff` each
  file before editing; commit only your own hunks (private index, exact hunks). **No commit without my yes.**
- Dev server: do not restart for routine edits; this phase adds files, so restart once near hand-off
  (`npm run dev` only; stop before clearing `.next`).

## Steps
1. Gate items 1–3.
2. Build Part A, then Part B (or hand off after A). Then `npm run verify:changed`, `npm run typecheck`,
   `npm run check:spelling`, `npm run check:demos`, and `npm run check:layout --changed` on the tournament overview, a
   tournament tab page, an org-wide screen (Members) and the tournaments list at 1440, 1366 × 768 (dev server; never a
   whole-product sweep).
3. **Measure and report:** the cell with a short, a two-line and a cut event name; one event vs. many; the logo, a wide
   logo, none; open and folded; the cell's line against the tab band's; the first paint (scripts off) vs. after load for
   both org kinds; the strip's right end at 1366; the org-wide screen's sidebar for a tournament-only org and a mixed
   one; the switcher by keyboard.
4. `/design` on the built screens against the drawings; `/simplify` (a new switcher window and cell); `/review`.
5. `/docs`: help articles that name "the tournament dropdown", "Club overview" in a tournament, or where Help sits.
6. Write the owner walk (a checkable Artifact; one purpose per walk — the cell and list; the strip and titles; the
   org-wide screens; the demo; Phase 0's first-paint proof), the ledger §, the plan's Phase 2 section with the
   measurements, the TODO line, the prompts index row and project memory (positive facts, "built 2026-MM-DD").
7. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Hand-off to Part B (written 2026-11-10, when Part A was built)
> **Part A is built** (record: plan §5 Phase 2, "Part A BUILT 2026-11-10"; walk §508). Paste this prompt into a fresh
> session and **build Part B only** — the strip names the page, paper titles drop, the org-wide screens (E3 + T1), page
> help (E11), and T2 ("Your notifications", `/marketing` checks the words). Read the plan's Part A record first.
- **What Part A left for you:** the event's cell (`EventCell`, `AdminKitRail.tsx`) and its list (`EventSwitchMenu.tsx`)
  are built; the strip (`AdminTopStrip`, `useAdminPlace`) is untouched and still names the event with its dates and
  chip — that is your first change. `eventSwitchLine` (`lib/admin-event-cell.ts`) already joins the dates and the phase
  word; the strip's facts should read the same rule (`resolveEventPhase` + `PHASE_LABEL` — consider one shared
  `eventPhaseOf` so the strip and the list cannot drift; /review noted the field mapping is written twice).
- **The org-wide screens (E3, T1):** today the event's cell heads Settings & access / Members / Tournaments too
  (`eventHeads` in `AdminKitRail`). In a club those screens take the club's own sidebar and cell (T1); in a
  tournament-only organization, the organization's short sidebar with the org in the cell (E3). `isTournamentOrgScreen`
  stays the one list. The list's "All tournaments" foot stays the way back from an event.
- **Not yours:** the phone (Phase 3); the shared sidebar switcher extraction (first step of Phase 4 — see the plan).
- **The walk §508 may come back with findings** — check the ledger before starting.

## Done when
- A tournament sidebar's head is the event: name, logo or initials, phase chip; more than one event → the whole cell
  opens the list; one → it opens Overview; no native `<select>` remains on desktop.
- Nothing in the tournament sidebar folds; the list scrolls between the pinned cell and the foot.
- The strip names the page with the dates and phase at its right end, before View site; pages that the strip names have
  dropped their paper titles; page help is the last item at the right end of the page's top row.
- Org-wide tournament screens show the organization's own sidebar with the org in the cell.
- First paint is right for both org kinds with nothing swapping after load; the tab title is correct.
- Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design`, `/simplify` and `/review`
  findings applied or recorded.
