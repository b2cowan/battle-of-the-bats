# Build prompt — Navigation, Phase 3: the tournament phone (the bar names the page, the small line names the event)

> One session, pasted into a fresh chat (`/clear` first), after Phase 2 has landed. Written 2026-11-11 from the owner's
> rulings (asks E1–E16 all as recommended; E5 is this phase's ask), from what Phase 2 Parts A and B actually shipped, and
> from a code survey of the phone's chrome the same day. Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`
> (§0, §3, §4 E5 and E11, §5 Phase 3, §6, and the Phase 2 records). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`.
> **Model: Opus for this session** (first-paint and heading-semantics judgement, many pinned guards). Helpers read on Sonnet.

## What Phase 2 shipped that this phase stands on
- **A tournament page knows its event on the server's first paint** (Phase 0). The bar's first paint is server-rendered through
  `AdminEventHeader`; the More sheet is a client mount (dynamic import). A new swap on first paint is a regression of Phase 0.
- **One rule names an event's state:** `eventPhaseOf` / `eventSwitchLine` / `eventSwitchOrder` in `lib/admin-event-cell.ts`
  (dates, phase word, finished events sink to the list's foot — 2026-11-11). The phone's small line and sheet read these;
  they never keep a third copy. (`AdminKitBottomNav` and `AdminContextStrip` still call `resolveEventPhase` directly — fold
  them onto `eventPhaseOf` if you touch them.)
- **A page is named once on a computer** (Part B): `deskTitleAt` (`components/admin/kit/kit-tournament-groups.ts`) is the pure
  rule over the sidebar's lit row (null for the preview, a place, a cancelled account). `DeskNamedPage` provides it;
  `AdminPageHeader` sets `data-desk-named` (`'actions'` or `'empty'`); the hiding is CSS only, `@media (min-width: 901px)` in
  `AdminPageHeader.module.css`. Its comment and `DeskNamedPage.tsx` carry **`PHASE-3:`** markers: this phase makes it the both-widths answer.
- **The org-wide tournament screens** (the Tournaments list, a Tournament plan's Plan & billing, Settings & access for a
  tournament-only organization) name themselves on a computer. On the phone the bar names the ORG there today (P3).
- **T6, ruled 2026-11-11 (accept as built): the chevron/door to the list shows whenever there is an event.** The phone's small
  line is therefore always tappable, even with one event — its sheet holds that event and "All tournaments".
- **The phone breakpoint is 900 px and below** (not 768): `@media (max-width: 900px)`; the desktop is `min-width: 901px`.

## Read first, in this order
1. The plan: §0, §3 (the proposed standard, item 3 the phone bar), §4 (E5, E11, E12), §5 Phase 3 and the Phase 2 Part A/B records
   (including the T1 amendment of 2026-11-11 and P3), §6. `memory/design_decisions.md` 2026-11-09 entries.
   `docs/agents/design/NAV_STANDARD.md` (N7 item 1 — "then the tournament picker (until navigation Phase 3)" — is yours to rewrite).
2. The drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 — **tab 6 "A club's tournament on a phone"** (the bar before / after,
   "the small line, tapped" as a sheet, the More sheet losing its second switcher) and tab 15's phone frames. Whole screen, 390 × 844.
3. Code (a helper locates, you read the hunks you edit): `components/admin/AdminEventHeader.tsx` (the one phone bar; mounted in
   `app/[orgSlug]/admin/AdminChrome.tsx`) + `AdminKitEventHeader.module.css` (padding recipe, 36 px row, `.meta` line, `.nameLink`'s
   44 px tap box), `components/admin/useAdminPlace.tsx` (title / dates / chip / `titleHref`; ~L55–98), `components/admin/DeskNamedPage.tsx`,
   `components/admin/AdminPageHeader.tsx` + `.module.css` (~L95), `components/admin/kit/AdminKitBottomNav.tsx` (the More sheet's
   tournament picker at ~L288–311: label, the native `<select id="admin-mob-tournament-select">`, the `" - Live"` suffix, the single-event span;
   the sheet is the in-tree `.dropdown` + `.sheetScrim` from `CoachesBottomNav.module.css`), `components/coaches/CoachTeamSwitchSheet.tsx` +
   `SheetFrame.tsx` (the shape to copy: opener ref, Escape / Back / scrim tap / focus return handled for you — add no dismiss hook of your own;
   rendered in-tree, **needs `--coach-foot-clear` — check the admin shell defines it**), `components/admin/kit/AdminKitRail.tsx` (`EventCell`: how rows
   are built, `onPick`, `allHref`), `components/admin/kit/EventSwitchMenu.tsx` (**not reusable on a phone** — a fixed, anchor-measured 320 px popover; reuse only
   `EventSwitchRow` and the two-line row classes `convWhatOpt / convWhatOptName / convWhatOptSub` from `coaches.module.css`; `.switchRow` etc. live in
   the sidebar's stylesheet), and the guards listed under Gotchas.
Broad reading goes to a helper (CLAUDE.md); check its claims against the code before building on them.

## Gate (blocking, before any code)
1. **The drawings mostly exist (tab 6); draw only what they do not show,** then `/design` it, republish to the same artifact and bring me the rulings:
   - the **org-wide tournament screens on a phone** (the Tournaments list, Plan & billing, Settings & access): today the bar names the org. Recommended:
     the bar names the screen and carries **no event line**, because no event is theirs (matches the desktop strip). Say if you disagree.
   - the **small line with a long event name**, and with **one event** (T6: still tappable), and **a person scoped to one event**;
   - the sheet **after Phase 2's changes** (finished events at the foot, the current one olive with a check, "All tournaments" at the foot);
   - the page's top row on a phone once its paper title is gone: the actions and the "?" last (E11, both widths); a page with **no actions** draws nothing.
   If tab 6 already shows a state, say so and skip it.
2. **One answer on the tap size:** the small line is a 44 px target (drawn); the bar's total height will change from today's ~53 px — measure before and after
   (`--admin-header-h` is published by a ResizeObserver, so sticky toolbars follow; verify the ones that sit under the bar).
3. **Heading semantics:** on a computer the strip's name is the page's one `<h1>`; on a phone the bar's name becomes it (and the paper `<h1>` is hidden on both).
   Say how you keep exactly one `<h1>` per width (`admin-header-bar-guard` pins this).
4. Present the **product-manager UX summary** and the task list before any code. No commit without my yes.

## What this session changes
- **The bar names the page** (E5): the bar's first line is the sidebar's row you are on (from `deskTitleAt`), as on the strip; the page's own 20 px paper title goes
  (CSS: widen the `data-desk-named` hide to both widths, delete the "phone keeps the whole header" wording; keep the actions row and the "?" last).
- **The event rides the small line** under it: event name · dates · phase chip (the chip stays — 2026-11-07 / round 5), tappable, a 44 px target; it opens the event list.
- **The event list is a sheet** (the same rows as the desktop list — name, then "dates · phase", the current one olive with a check, finished events last, "All tournaments"
  at the foot), built in the `CoachTeamSwitchSheet` / `SheetFrame` shape. Picking an event keeps you on the same page (`setCurrentTournament`), as on desktop.
  A person scoped to some events sees only theirs.
- **The More sheet loses its picker:** the native `<select>`, "Current tournament", `" - Live"` and the single-event fallback go; the sheet opens on Notifications and
  then the tiles (NAV_STANDARD N7 item 1 rewritten). Delete what dies with it: the `useTournament()` bits only the picker used, the `kit` import if unused, the
  `.switcher / .switcherSelect / .switcherName` rules in `AdminKitFrame.module.css`, the stale comment at ~L267.
- **The words stay in one place:** the phase words are `PHASE_LABEL` via `eventPhaseOf`. No second spelling of Game day / Open / Completed.

**Not this phase:** the Coaches Portal (Phases 4–5), the desktop (done), the club's phone bar, NAV_STANDARD's full rewrite and the help articles beyond the sentences
this changes (Phase 6 — but rewrite N7 item 1 now), a tournament page's own content.

## Gotchas
- **First paint is a gate.** The bar's name and the small line must be right in the server's HTML (scripts off) for both org kinds, with one event and many, and must
  not change after load. The sheet is a client mount — that is fine; the bar is not.
- **Tournament pages re-title the tab** (`AdminTitleManager`); the tab title is the sidebar's words. Measure the final tab title if the bar's label feeds it.
- **Guards that pin today's phone** — update each expectation deliberately, in the open, and say so:
  `tests/unit/admin-header-bar-guard.test.ts` (padding recipe; the small line's order; **one `<h1>` per width**; phone shell scroll),
  `admin-nav-phase2b.test.ts` (the `@media (min-width: 901px)` regex ~L83–90; "the phone keeps the org name" ~L72–80),
  `nav-standard-guard.test.ts` (the More sheet's order and parity, ~L515–570), `admin-kit-nav.test.ts` (~L323 "keeps `tournamentGroups` until Phase 3"),
  `admin-event-cell.test.ts`. **New guards:** the phone's More sheet has no `<select>`; the sheet reads `eventSwitchOrder` / `eventSwitchLine`; one rule names the page on both widths.
- **Probes:** `.probe/nav-phase2b/firstpaint.mjs` (JS off vs on, 1440 / 1366 / 390, both org kinds; saved sign-ins are under `.probe/nav-phase2b/auth/` and
  `tests/uat/.auth/` — refresh them first), `.probe/nav-phase0/firstpaint.mjs` (records every name seen after load — catches swaps), `.probe/nav-phase1/phone.mjs`
  (390 × 844 touch capture of the More sheet). `.probe/navrec.mjs` still names `#admin-mob-tournament-select` and will go stale.
- **The demo sandbox** runs this chrome: the build fails if a tour destination or anchor vanishes. Do not add re-read notes; run `npm run check:demos`.
- **Spelling gate** (`npm run check:spelling`); the clock is "8:00 a.m." via `formatTime()`; dates via `formatStoredDate`.
- **Shared working copy:** other sessions' hunks sit in the bar, the bottom nav and the CSS. `git diff` each file before editing; commit only your own hunks
  (private index, exact hunks). **No commit without my yes.**
- Dev server: do not restart for routine edits; this phase deletes CSS and may add a file, so restart once near hand-off (`npm run dev` only; stop before clearing `.next`).

## Steps
1. Gate items 1–4.
2. Build. Then `npm run verify:changed`, `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, and `npm run check:layout --changed` on a tournament tab page,
   the Tournaments list, Members and Overview at 390 (dev server; never a whole-product sweep).
3. **Measure and report:** the bar before and after (height, the small line, a short / two-line / cut event name); one event vs many vs scoped; the first paint
   (scripts off) vs after load for both org kinds at 390; the sheet's rows and its keyboard / Back / scrim behaviour on a touch-emulated phone; the tab title; one `<h1>` per width.
4. `/design` on the built screens against the drawings; `/simplify` (a new sheet and a both-widths rule); `/review`.
5. `/docs`: help articles that say "pick the tournament in More" or describe the phone's event bar.
6. Write the owner walk (a checkable Artifact; one purpose per walk — the bar and the small line; the event sheet; the More sheet; the org-wide screens; the demo; a person
   scoped to one event), the ledger §, the plan's Phase 3 section with the measurements, the TODO line, the prompts index row and project memory (positive facts, "built 2026-MM-DD").
7. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Done when
- On a phone, a tournament page's bar names the page; the event, its dates and phase ride the small line; tapping the line opens a sheet of the person's events with
  "All tournaments" at its foot; picking one stays on the page.
- No paper title repeats the bar's name at either width; page buttons and the "?" keep the page's top row, the "?" last; a header with no actions draws nothing.
- The More sheet has no tournament picker and no " - Live".
- First paint is right at 390 for both org kinds with nothing swapping after load; the tab title is right; exactly one `<h1>` per width.
- Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design`, `/simplify` and `/review` findings applied or recorded.
