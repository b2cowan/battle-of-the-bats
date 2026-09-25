# Prompt — Coaching from a phone · Stage 6 design phase (Reports)

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-24, at the
> close of the §228 walk (stage 5 · People, committed `5a3e6888`). **Design only — no product code until
> the owner rules.**

---

You are picking up **stage 6 of "Coaching from a phone"** — the LAST stage of the project: the DESIGN
phase for **Reports** on a phone (the Insights screens, plus the notification-preview clamp). Your
deliverable is true-size drawings and a short list of decisions for the owner to rule on. You build
nothing in this session.

## Read first (in this order, and only these)

1. `docs/projects/archive/COACH_MOBILE_EXPERIENCE_PLAN.md` — §1 (the findings table, rows **9 Reports**
   and **10 Notifications & help**), §2 (the seven standing rules; **S.4** one figure, one qualifier and
   **S.7** a table stays a table are the two this stage applies), §3 (the stage ladder, row 6), §5 (out
   of scope), §6 (no migrations, no year parameters). ⚠ §2's **S.6 text is stale** — "Saved" is NOT a
   fact in the title row; it is the transient pill (ruled 2026-09-20). The hub's "The walk" tab has the
   current wording.
2. The project hub — one artifact for the whole project: https://claude.ai/artifact/WqHGTXUmrns81UN6e2PJvC
   (source `docs/projects/archive/COACH_MOBILE_EXPERIENCE_HUB.html`). Read **"The walk"** stations 9 and
   10 (Q 9.1, Q 10.1) and the **"5 · People"** tab, especially **F5** — ruled and built 2026-09-24, and
   the nearest precedent you have (below). Match the visual identity of the stage 4 and 5 drawings; the
   stage-5 frame styles (`s5-*`) are scoped to their tab, so a new tab needs its own scope.
3. `docs/projects/active/OWNER_QA_LEDGER.md` **§228** (walked and passed 2026-09-24, with the mid-walk
   rulings recorded under it).
4. The table rules already in force — a fitting table on a phone is THEIR rule, not a new one:
   `COACH_ROW_LIST_RECIPE_PLAN.md` ("a list is a table when a COLUMN answers the question") and
   `APP_WIDE_TABLE_CONSISTENCY_PLAN.md`. Skim; don't re-derive.
5. The screens: the Insights page `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` (its tab list —
   Dashboard · Results · Attendance · Playing Time · Development · Awards · Scouting Book — and each
   tab's panel under `history/*/`), and the notifications page under `app/[orgSlug]/coaches/notifications`.

## What stage 6 is about (the findings it answers)

Measured on the 2026-09-19 walk at 390×844:
- **Attendance report: 2,729px** — twelve stacked cards × ~110px for what is a **three-column table**
  (name · games · practices). As a table it is 12 × 44 = 528px, and the comparison DOWN the column —
  the whole point of a report — survives. The cards destroy it.
- **The Insights tab row cuts "Playing time"** at 390, where the player page's own tabs already know to
  use short labels.
- **Notifications: 2,127px**, week-in-review previews of ~40 words running five lines. The walk's
  answer: clamp previews to two lines on a phone. Nothing else about notifications or help changes (help
  is one dark surface, by ruling).

⚠ The walk measured **one** report. The stacked-card treatment (`data-label` cells) appears wherever a
table goes under 640px, so **measure every Insights tab before drawing any of them** — some tables will
genuinely not fit, and they keep their cards. The deliverable is the RULE plus its application, report by
report, not one screen.

## Rulings to build ON, not reopen

- **F5 (2026-09-24) is your precedent for figures.** On a phone, a figure that repeats a section's own
  header is not drawn again; the rest go on ONE line (number bold, word after, no boxes); a SUM is drawn
  as a ledger. Expect Insights' Dashboard to have the same problem the player's Season tab had — check
  it, and apply F5's reasoning rather than inventing a second idiom.
- **S.4 · one figure, one qualifier** on phone tiles; **S.3 · today first** (a sessions list mixing past
  and future opens on today — the walk noted the Insights sessions list opens on the newest).
- **Playing-time vocabulary**: innings and shares, never "fair". **Team progress is never
  player-ranked** — a report may not reorder players by a score. Playing-time analytics are
  live-season-only, permanently.
- **A closed season is one page** (CLAUDE.md). Insights is a LIVE-season surface; no report learns a year.
  Don't draw a season picker or a history layer.
- **Header glyphs are borderless on a phone** (the section pencil, Upload, the sheet ✎/✓); **every
  highlight is clickable** (a chip opens its explanation on tap); **mobile actions are icon-only**; the
  transient Saved pill; the drawer rule (a FORM covers the nav, a MENU sits on top of it).
- **One spelling everywhere a customer reads it**, and **the clock is "8:00 a.m."**. ⚠ Note while you
  are in the tab list: "Playing Time" and "Scouting Book" are Title Case beside sentence-case siblings
  ("Playing time" on the page's own report links). Flag it; the owner rules.

## What to produce

1. **Measure before drawing.** A Playwright probe in the gitignored `.probe/` folder (never
   `test-results/` — a plain `npm test` wipes it), signed in with `tests/uat/.auth/coach.json`, at
   **390×844 and 360×780**, on every Insights tab and the notifications page. Read every number from the
   browser's own geometry, never from a screenshot. Record per report: page height, the table's column
   count, **whether its columns fit at 390 and at 360** (measure the table's natural width, don't guess),
   rows visible on screen one, the tab row's overflow, and any figure that repeats its own heading.
   ⚠ The fixture has only a few games and practices — say where a real season (40+ events, 14 players)
   would change the answer, and seed nothing without asking.
2. **Draw on the SAME hub**, as a new tab **"6 · Reports"**. True size (390px frames that do not reflow),
   **whole-screen before/after** per report that changes, the tab row at 390 and 360, and a notification
   before/after. Every annotation clickable. Say which "before" frames are captures and which are drawn.
3. **Decisions**, each with options, a recommendation and its tradeoff, and a paste-back box. At minimum:
   - **R1 · the rule.** When does a report table stay a table on a phone? Propose the test (columns that
     fit at 360 without horizontal scroll? a column count? a width?) — and what a table that does NOT fit
     becomes (today's cards, or a pinned-first-column scroller).
   - **R2 · the application.** Every Insights report, one line each: stays a table · becomes one · keeps
     cards — with its measured reason.
   - **R3 · the tab row.** Short phone labels (the walk proposed Results · Attendance · Playing ·
     Development), or a scroller, or the player page's pattern — and the Title Case flag above.
   - **R4 · the notification clamp.** Two lines on a phone, the item's own page for the rest.
   - Anything the measurement shows that this list misses — say so; don't force-fit it.
4. **Touch targets — name them, don't hide them.** The portal's tap-target project
   (`COACH_TOUCH_TARGET_DEBT_PLAN.md`) is named and not started; whether it starts is an open owner
   decision. Report how many sub-44px controls each report has; don't fold that project into this stage
   unless the owner says so.
5. **Update the plan** (a §14 "Stage 6 — Reports" with measurements and decisions; the §3 ladder row)
   and the **PM brief** (`COACH_MOBILE_EXPERIENCE_PM_BRIEF.md`).

## Working rules for this owner

- **Push back out loud** when a premise is wrong — argue from what the code does, not from a plan's
  claim. Don't manufacture disagreement.
- **Product-owner voice** in every reply: what a coach sees and does differently, and the tradeoffs.
  File paths and code stay out of chat; they belong in the plan.
- **The hub is shared with other sessions.** Before every publish, read the live version, merge, then
  publish from your file — never overwrite a newer version. ⚠ When editing the hub by script, anchor on
  the stage-6 tab: ids like `data-step="B5"` repeat across tabs (a first-match replace hit the wrong walk
  once).
- **Stage only your own files**, on `dev`, in a private index. Other sessions have uncommitted work in
  the same working copy (the portal stylesheet, the ledger, TODO, the help content, the layout files) —
  and another session may have STAGED files in the shared index. Don't commit without the owner's say-so.
- **Don't launch a full layout sweep.** The owner tests on the shared dev server. Scope it with
  `--only=` (with the equals sign); if the sweep aborts on the memory floor, that is a failure, not a
  pass, and the server wants a restart before the next run.
- **No code** until the owner pastes back the rulings.
