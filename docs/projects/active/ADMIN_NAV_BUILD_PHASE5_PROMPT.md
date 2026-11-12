# Build prompt — Navigation, Phase 5: the Coaches Portal on a phone (the bar names the page, the small line names the team)

> One session, pasted into a fresh chat (`/clear` first), after Phase 4b landed (code committed `24054c127`; walk §517 PASSED 31/31
> on 2026-11-12). Written 2026-11-12 from the owner's rulings (asks E1–E16 all as recommended; **E8 is this phase's ask**, with E11
> and R6 of Phase 4b), from what Phases 3, 4 and 4b actually shipped, and from the plan's records. Plan of record:
> `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (§0, §3, §4 E8 / E10 / E11, §5 Phase 3 + Phase 4 + Phase 4b records, §6).
> Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. **Model: Opus for this session** (first-paint and heading-semantics judgement, a
> phone-height budget, many pinned guards). Helpers read on Sonnet; check their claims against the code before building on them.
> **Where this prompt and the plan differ, the plan wins.**

## The one-paragraph version
On a computer the Coaches Portal is finished: the team heads the sidebar, the strip names the page and carries the team's facts and the
"?", the tabs pin in a band. On a phone it is still the old shape: a 37 px team bar that names the **team** (name · record · "?") on one
line, the page's own title below it, and tabs inside the page. This phase gives the phone the same grammar the tournament phone got in
Phase 3: **the bar names the page; the team rides the small line and opens "Your teams"; the page's paper title goes; help has one door;
and the tabs follow the same rule as the computer's band if the phone can afford it.**

## What the earlier phases shipped that this one stands on (verify before building)
- **Phase 3 (tournament phone) is the template.** Same grammar, already walked (§512, 26/26): `AdminEventHeader` names the page from
  `deskTitleAt`; the event rides the small line, a 44 px target, opening a sheet built in the `CoachTeamSwitchSheet` / `SheetFrame` shape;
  the paper title is hidden on both widths (`data-desk-named`); one `<h1>` per width. Read its record in the plan (§5 Phase 3) and its
  measurements before drawing anything: the bar's height, the long-name case, the first-paint gate.
- **Phase 4 (coach computer):** the nav list lives once in `lib/coach-team-nav.ts` (sidebar, `COACH_MORE_SECTIONS`, `coachDeskTitleAt`,
  `coachDrillBack`). **The strip's page name is already derived there** — the phone bar must read the same rule, never a fourth copy.
  The team's facts are rendered on the server by the `@stripFacts` parallel-route slot from one cached loader (`lib/coach-team-masthead.ts`)
  that the phone's team bar also reads. `CoachDeskTitle` is the provider; a page's `<h1>` or "← back" one level down.
- **Phase 4b (coach computer tabs + help):** `--coach-band-h` is 0 on a phone today. The "?" is **one publisher** (the page header) into
  **one entry** held by `CoachStripHelpProvider`, read by the strip AND by the phone's team bar. **On a phone the "?" still sits in the
  team bar, and the More sheet's Help row still opens the full guide.** The owner's R6 (2026-11-11): *"the phone follows with the same
  rule in Phase 5"* — the same rule as the computer is "tabs pinned under the top, buttons stay in the page"; and the 4b record says
  the phone's single help door **moves into the More sheet's Help row, which opens the page's panel (today the full guide)**.
- **Prior phone rulings that this phase re-opens.** *Phone re-evaluation stage 1 · B2 (2026-09-21): the team bar is ONE 36 px line on every
  screen — name · record · "?" — and the Overview's club · season line renders unpinned beneath it.* Treat that as **reference, not
  authority** (CLAUDE memory: decide on merit; cite a ruling's reason). E8 (2026-11-09, A) is newer and says the bar names the page and
  the team + record ride the small line. Say in the gate what the 09-21 reason was and whether it still holds.
- **The phone breakpoint is 900 px and below** for the nav (`@media (max-width: 900px)`; desktop is `min-width: 901px`), but the team bar's
  one-line collapse is ≤ 640. The 641–900 range is real (a tablet) — decide it explicitly; do not leave it to fall out of the CSS.
- **A team with no live season has ONE door** (`CoachTeamSeasonGate`, decided server-side). The phone's bar, bottom bar and More sheet
  must collapse to that single entry exactly as the computer's navs do. Do not add a finished-season branch; if a closed season needs to
  show something it needs a shelf on its one page (CLAUDE.md).
- The **free Coaches Portal** (`CoachFreeBottomNav`, `wall`, `free`) is out of scope (E13).

## Read first, in this order
1. The plan: §0, §3 (the standard, items 3 and 4), §4 (E8, E10, E11, E13), §5 Phase 3, Phase 4 and Phase 4b records (including the
   R3 revision of 2026-11-12 and "Owed"), §6. `memory/design_decisions.md` entries for 2026-09-21 (phone stage 1 · B2) and 2026-11-09.
   `docs/agents/design/NAV_STANDARD.md` (N7, N11, N12 — Phase 6 rewrites the whole, but fix what this phase makes false).
2. The drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 — the tabs that show the coach phone and the "Your teams" sheet
   (E8, E10: the team's crest → colour → initials tile in the sheet only; initials when the crest is wider than 2 : 1). Whole screen, 390 × 844.
   Phase 4b's drawings (https://claude.ai/artifact/VkSTdrAUv9Rbgbwu4gYiun, source `COACH_TABS_TOPROW_DRAWINGS.html`) are the computer's;
   the phone was explicitly left for this phase.
3. Code (a helper locates, you read the hunks you edit): `components/coaches/CoachTeamHeader.tsx` (the phone bar today; its long header
   comment holds the 08-18 and 09-21 history), `CoachTeamSwitchSheet.tsx` + `SheetFrame.tsx` (the sheet to keep — it already exists, with
   the crest tile logic via `lib/coach-team-tile.ts`), `CoachesBottomNav.tsx` (the More sheet; `MoreSheetFoot`, `helpHref`),
   `CoachPageHeader.tsx` (the page's top row, `data-desk-named` / `data-desk-drill`, `actionsPhoneOnly`), `CoachDeskTitle.tsx`,
   `CoachTopStrip.tsx` + `CoachStripHelpProvider`, `CoachPageHelpSlot.tsx`, `lib/coach-team-nav.ts`, `lib/coach-team-masthead.ts`,
   `lib/coach-strip-facts.ts`, `CoachesChrome.tsx`, and `components/admin/AdminEventHeader.tsx` (what Phase 3 built — copy its shape,
   not its names). `--coach-header-h` is the register every sticky offset on a phone reads; it is 37 px today.
Broad reading goes to a helper; ask for paths with line numbers and a verdict, not a dump.

## Gate (blocking, before any code)
The drawings mostly exist (E8, E10) for the old shape; **draw what they do not show**, then `/design` it, republish to a NEW artifact
(link it from the plan) and bring me the rulings. Whole screens at 390 × 844, true size, with the Phase 3 phone beside it for comparison.
1. **The bar before / after** on: Overview, a tabbed page (Money), a plain page (Roster), a drill-in (a player, a game) with its back
   arrow, the Ledger, a long page name, a long team name, a team with a crest and a team without, a team with several teams (the chevron)
   and a standalone team (no chevron — E8: the small line is not tappable when there is nothing to choose).
2. **What rides the small line.** E8 says team + record. Today's meta line is *club · season · record · status* ("Game day — Lions, 6:30 p.m.").
   Propose which facts survive on a 390 px line and in what order; the computer's strip uses `lib/coach-strip-facts.ts` — reuse its rule rather
   than invent a second one, or say why the phone differs. Include the finished-season "Complete" chip and the Overview's Draft / non-active
   season state (C5: it used to wear badges on the page title).
3. **Where the "?" lives on a phone.** Options to draw: (A) stays in the bar's right end (today); (B) moves into the More sheet's Help row
   and opens the page's panel (the 4b record's stated direction); (C) both. Recommend one and **argue it from the code**: what the
   page's panel is, whether it can open from a sheet without closing the sheet first, and what happens on a page that publishes no help.
   Note the owner's standing direction that help's place should be the same across all three portals — say how this answer fits the
   tournament phone (which keeps its "?" last in the page's top row, E11) and the club.
4. **The tabs on a phone (R6).** The computer pins them in a 45 px band under the strip. Measure what 390 × 844 can afford: bar + band + the
   Ledger's pinned toolbar and column heads. Phase 4b took the Ledger to 230 px on a 768-high computer (29.9 %); a phone is shorter and the
   bottom bar already takes ~72 px. Recommend **pin the tab row under the bar** or **leave tabs in the page on a phone**, with the numbers,
   and name the pages where it differs (Money 7 tabs, Insights 7 — both overflow a 390 row; the existing arrows / scroll behaviour must
   survive). If you recommend not pinning, say that this reverses the sentence "the phone follows with the same rule" and why the reason
   holds; I decide.
5. **Heights.** Today 37 px bar. Measure before and after in the real browser (touch-emulated), in px, for each state above;
   `--coach-header-h` is published by a ResizeObserver or a CSS variable — say which, and verify every sticky element under it (register
   toolbars, tab rows, the lineup builder, the schedule's week bar, the practice-plan editors' footers).
6. **Heading semantics.** On a computer the strip's name is the page's one `<h1>`; on a phone the bar's name becomes it and the paper
   `<h1>` is hidden on both. Say how you keep exactly one `<h1>` per width (`coach-nav-phase4.test.ts` and the header-bar guards pin this).
7. **The 641–900 range** (tablet): which shell does it wear, and does any of this change there?
8. Present the **product-manager UX summary** and the task list before any code. **No commit without my yes.** Disagree out loud: if
   the cleanest answer is "do less than E8 says on the phone", say so before building (the 09-21 phone work was a deliberate, measured
   decision about height).

## What this session changes (provisional; the gate's rulings win)
- **The bar names the page** (E8): the first line is the page name from the same rule as the strip (`coachDeskTitleAt` / `coachDrillBack`),
  with the back arrow one level down. The page's own paper title goes (widen the `data-desk-named` hide to the phone; delete the
  "phone keeps the whole header" wording; keep the actions row and the "?" rule the gate settles).
- **The team rides the small line** under it: team · record (and whatever the gate keeps), tappable only with 2+ teams, a 44 px target;
  it opens the existing "Your teams" sheet (`CoachTeamSwitchSheet`). Picking a team goes to that team's Overview, as on the computer's cell.
- **The old 36 px team bar and the Overview's unpinned page line** are retired or re-homed per the gate (the 09-21 shape dies on purpose;
  record the reason in `memory/design_decisions.md`).
- **Help** per the gate's answer (3). If the More sheet's Help row opens the page's panel, the sheet's `MoreSheetFoot` and the free portal
  share a component — do not break the free portal's foot.
- **Tabs** per the gate's answer (4).
- **The More sheet** keeps its order and parity with the sidebar (`COACH_MORE_SECTIONS`); a closed-season team shows its ONE door.

**Not this phase:** the computer (done); the free Coaches Portal; the tournament admin's and the club's "?" (only if I like it after
this phase's walk — a separate decision); NAV_STANDARD's full rewrite and the help articles beyond the sentences this changes (Phase 6 —
but fix N7 / N11 / N12 where they become false); a page's own content.

## Gotchas
- **First paint is a gate.** The bar's page name, the small line and the "?" must be right in the server's HTML (scripts off) for: one team,
  a club coach with several teams, a team between seasons, the demo; and must not change after load. The computer's probe is
  `.probe/nav-phase4/desk.mjs` (and `run2.json`); Phase 3's is `.probe/nav-phase2b/firstpaint.mjs` + `.probe/nav-phase0/firstpaint.mjs`
  (records every name seen after load — catches swaps). Refresh saved sign-ins first (`.probe/nav-phase2b/auth/`, `tests/uat/.auth/`).
- **Pages that load client-side** have a known first-paint exception on the computer (the opponent page, Documents' header, Overview's
  setup chip). Do not make the phone worse; list them.
- **Guards that pin today's phone** — update each expectation deliberately, in the open, and say so: `coach-nav-phase4.test.ts`,
  the header-bar and sidebar-strip guards, `nav-standard-guard.test.ts` (the More sheet's order and parity), `coach-history-endpoint-guard`
  (nothing here should touch it), and the 4b band tests. Add guards: one rule names the page on both widths; the phone bar reads
  `coachDeskTitleAt`; one `<h1>` per width; the "?" has exactly one door per width.
- **`--coach-header-h`** is read in many places (4b added `--coach-band-h` beside it). Change the value, never a dozen consumers.
- **The dev server** is shared; do not start a sweep on it. `npm run check:layout --changed` on the few screens you touched, at 390.
  Restart only when the session adds or deletes files (`npm run dev` only; stop before clearing `.next`).
- **Spelling gate** (`npm run check:spelling`); the clock is "8:00 a.m." via `formatTime()`.
- **The demo sandbox** runs this chrome (`riverdale-ridge`): the build fails if a tour destination or anchor vanishes. Run `npm run check:demos`;
  add no "re-read" notes.
- **Shared working copy:** other sessions' hunks sit in `CoachPageHeader`, `CoachTopStrip`, `CoachDeskTitle`, `coach-team-nav`,
  `coaches.module.css` and `coach-nav-phase4.test.ts` (the record-slot work). `git diff` each file before editing; commit only your own
  hunks (private index, exact hunks). **No commit without my yes.**
- **Phase 4b's open leftovers are not yours to fix on the way past,** but do not make them worse: `coach-findability-smoke` and
  `coach-membership-smoke` find the "?" in the strip (not yet run); two Money help pictures need re-capturing from the demo world.

## Steps
1. Gate items 1–8. Stop for my rulings.
2. Build. Then `npm run verify:changed`, `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, and
   `npm run check:layout --changed` on Overview, Money, Roster, Lineups, Season's End and a player page at 390.
3. **Measure and report:** the bar before and after (height; the small line; short / two-line / cut names); one team vs several vs a
   closed season; the first paint (scripts off) vs after load; the sheet's keyboard / Back / scrim behaviour on a touch-emulated phone;
   sticky offsets under the bar; the tab title; one `<h1>` per width; 641–900.
4. `/design` on the built screens against the drawings; `/simplify` (a both-widths rule and a retired component); `/review`.
5. `/docs`: help articles that describe the phone's team bar, the "?" on a phone, or "More → Help".
6. Write the owner walk (a checkable Artifact; one purpose per walk — the bar and the small line; the team sheet; the tabs; the "?";
   the More sheet; a closed season; the demo), the ledger §, the plan's Phase 5 section with the measurements, the TODO line, the prompts
   index row and project memory (positive facts, "built 2026-MM-DD").
7. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Done when
- On a phone, a team page's bar names the page (with a back arrow one level down); the team and its record ride the small line; with 2+
  teams tapping the line opens "Your teams"; picking one lands on that team.
- No paper title repeats the bar's name at any width; page buttons keep the page's top row; a header with nothing to show draws nothing.
- The "?" has one door on a phone, as ruled at the gate, and a page with no help draws none.
- Tabs behave as ruled at the gate; every sticky element under the bar still sits flush (measured).
- A team with no live season shows one door on the phone's bar, bottom bar and More sheet.
- First paint is right at 390 with nothing swapping after load; exactly one `<h1>` per width; the 641–900 range is decided and tested.
- Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design`, `/simplify` and `/review` findings applied or recorded.
