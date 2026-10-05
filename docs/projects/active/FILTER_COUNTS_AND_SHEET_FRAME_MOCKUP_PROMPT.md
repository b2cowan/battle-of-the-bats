# Prompt — mockups: filter counts wording, and one shared sheet frame

Paste everything below the line into a new Claude Code session in this repo.

---

You are drawing two sets of mockups for the owner of FieldLogicHQ. **Mockups only: change no product code.** The
owner rules on what you draw; a build follows in a later session. Both came out of the Ledger Phone Filter work
(committed `687187cf` 2026-10-02; hub https://claude.ai/artifact/9MkS5tTMA7RvytnUXCsVdx; plan
`docs/projects/active/LEDGER_PHONE_FILTER_PLAN.md` → /simplify and /review records), where both were found and
deliberately left alone because each needs a ruling.

## How this owner works (binding — read CLAUDE.md, AGENTS.md and AGENCY_RULES.md first)

- **Disagree out loud, before the work.** If a question below is the wrong question, say so first. Argue from what
  the code does, not from this prompt: every fact below is a lead to verify, not a truth to repeat.
- **Mockups are Claude Artifacts, one hub per project** (`docs/agents/design/PROJECT_HUB_TEMPLATE.html`; tabs
  Mockup · Decisions · PM Brief; a QA tab only later). These are **two projects, so two hubs**, each with its own
  source file in `docs/projects/active/` and a one-line TODO.md entry pointing at it. Load the `artifact-design`
  skill before writing either.
- **Draw on the live screens, at true size.** Capture the running app with Playwright and apply each proposal
  in-page with the product's own CSS classes, then screenshot. Phone frames 390×844 (also 360 where width
  matters), desk 1280 or 1440, Warm and Dark. The working recipe is `.probe/lf/shots.mjs` + `.probe/lf/lib.js`;
  copy it into `.probe/<your-dir>/`, never into test-results/. Traps: park the mouse in the left gutter before
  every shot (a click leaves a hover shade on a card); if a page lands on /auth/login, re-sign the UAT logins
  (`npx playwright test --config playwright.config.ts --project=auth-setup -g "coach|rep-club owner"`); never run
  a full layout sweep against the shared dev server; start the server only with `npm run dev`.
- **Every highlight is clickable** (a numbered marker or a NEW / RESTYLED / UNCHANGED tag opens its explanation),
  each decision carries a recommendation and its alternative, and every drawing is checked against the Coaches
  Portal's WRITTEN formatting rules (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`, `memory/design_decisions.md`,
  `components/coaches/kit/CoachKit.module.css`) before the owner sees it. Parse each hub's inline scripts before
  publishing (one unescaped apostrophe kills every tab).
- **Write to the owner as a product owner**: what a coach or treasurer sees and does differently, the trade-off, and
  your recommendation. No file paths in your messages to them (they belong in the hubs' plan notes).
- Other sessions share this working copy on `dev`. You are not editing product code, so you should not collide.
  Do not touch files you did not create.

## Project 1 — How a filter's choices show their counts

**What the owner saw:** on a desk, a Ledger filter with one choice ticked reads its count inside the pill, e.g.
**Status · Actual (23)**, and more than one reads **2 selected**. The new phone sheet reads the same state as
**Actual, Overdue**, without the counts. Two wordings for one state.

**Facts to verify in the code:**
- `components/coaches/MultiSelectDropdown.tsx` — the pill's summary: none ticked = its "all" word; one = that
  option's label; more = "N selected". At rest (`restQuiet`) the pill shows only its name. It also supports a
  per-option `count`, drawn as a quiet number at the row's end (`.multiSelectCount` in
  `components/shared/FilterPill.module.css`). The phone sheet row strips a trailing "(n)" (`bareLabel`).
- Five filters write the count INTO the label instead: the coach Ledger's Status on Timeline and on Bills / Payment
  schedule, the coach Ledger's Tags (`app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`), and the
  club Ledger's Type and Status (`app/[orgSlug]/admin/accounting/ledger/page.tsx`). The Awards report's filter
  (`.../history/awards/panel.tsx`) already uses the quiet `count`. Grep for any others.
- Rules the counts carry, which any wording must keep: counts are of what is there BEFORE this filter narrows (so a
  ticked option never reports itself back); on Bills, **Partly paid** overlaps Overdue and Outstanding, so the
  numbers add up to more than the rows (owner ruling 2026-08-20); Status rests on a deliberate subset.

**Draw:** today and two or three options, each on a desk (panel open and pill closed, one choice and two choices)
and on a phone (the Filter sheet's row and its open choices), for the coach's Status and the club's Type at least.
Options to consider, and challenge: (A) today; (B) the count as the quiet end-of-row number, as Awards does, and the
pill naming the choice without a count; (C) B, and the pill naming up to two or three choices ("Actual, Scheduled")
instead of "2 selected", the same words as the phone row. Say what each costs a reader. **Decisions to pose:** where
the count lives; what a narrowed pill says; whether desk and phone must read identically; whether Awards and the
practice library follow the same rule. Flag every surface the ruling would change.

## Project 2 — One sheet frame for the phone

**What the owner saw:** the Filter sheet borrows the Tools menu's drawer, and the drawer's own stylesheet says that
once a third caller wants the shape it should become one shared frame. Looking closer, the portal has **many**
bottom-sheet-like surfaces built several ways, not three.

**Facts to verify in the code, then extend:**
- The Tools menu drawer: `components/coaches/CoachToolbarMenu.module.css` (`.drawer`, `.drawerTitle`, the grab line,
  ≤640, above the bottom nav; read its long comment). The Filter sheet reuses those classes
  (`components/coaches/FilterGroup.tsx`).
- The lineup builder's panels: `.lineupAutoMenu` (≤900) and `.lineupDrawerOverNav` in
  `app/[orgSlug]/coaches/coaches.module.css`, with `components/coaches/LineupSheetScrim.tsx`.
- Sheets on the `.sheetScrim` recipe and their own modules: AwardSheet, CallUpSheet, CoachRsvpSheet,
  CoachPlayerSwitchSheet, CoachTeamSwitchSheet, LineupPositionSheet, LineupCopyFrom, CoachNotificationReader, the
  bottom nav's More sheet (`CoachesBottomNav`), TagManagerDrawer, HelpDrawer; the club admin's
  `components/admin/BottomSheet.tsx`; room windows (`components/coaches/RoomShell.tsx`) on a phone. Find any others.
- Owner rulings that bind the frame: a FORM covers the bottom nav and a MENU sits on top of it (2026-09-23, see
  `.lineupDrawerOverNav`'s comment); covering the nav is not taking it away; the drawer form E1 (2026-09-22: flush to
  the bar, 18px top radius, grab line, page dimmed); a drawer renders in-tree so it inherits `--coach-foot-clear`;
  a scrim renders inside the dismiss boundary (a touch dismissal once fell through and pressed the button beneath).

**Draw:** first an **inventory screen**: every sheet captured at 390 in its open state, side by side, with a table of
what differs (top radius, grab line, title style, padding, how it closes, whether it covers or sits above the nav,
scrim colour, maximum height, scrolling, aria-modal and Escape behaviour). Mark each difference: chosen on purpose
(cite the ruling) or drift. Then the **proposal**: one frame with as few named variants as the rulings need (likely
"menu" and "form"), each surface redrawn in it with NEW / RESTYLED / UNCHANGED tags, and what a coach would notice
change on each. **Decisions to pose:** the variants; which differences are kept on purpose; the order to move the
surfaces in (small, separate steps, because lineup and practice screens are being worked on in parallel); whether
the club admin's sheet joins. Say plainly where merging would cost more than it saves.

## Hand back

Two hub links, a short message per hub (what you drew, your recommendation per decision, what you would not
change), and any defect found while drawing, reported, not fixed.
