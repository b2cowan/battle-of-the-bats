# Kickoff prompt — the Money hub's tables don't agree with each other (paste into a fresh chat)

Take the **coach portal's Money hub** and make its tables read as one product. Right now the same
thing — rows of money — is drawn three different ways across tabs of a single hub. Nothing here is
designed yet: **this starts at inventory, not at build.**

## The trigger, in the owner's words

Looking at Budget vs. Actual and Budget Plan side by side, 2026-08-13:

> *"I am also noticing that our formatting of tables is inconsistent across these screens, should we
> do something to aim for better consistency?"*

They are right, and the evidence is one screenshot per tab. Budget vs. Actual is a bordered data
grid with a tinted header row and right-aligned figures. Budget Plan is a stack of white cards with
a category header bar. Player Dues is a third treatment again. **Each is defensible alone; together
they make one hub look like three products.**

## Read first (in this order)

1. `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` — the action pass that just
   finished on these same screens. §4.1 is the tab-by-tab state you are inheriting; every tab now
   has one shared control row (`.panelToolbar` / `.panelToolbarActions` in `coaches.module.css`).
2. `memory/design_decisions.md` — the **three 2026-08-13 entries** at the top, newest first. They
   are binding and none of them is reopened by this work. The last one (Export placement) is the
   most recent state of these screens.
3. `memory/design_system.md` and `memory/design_principles.md` — the token vocabulary and the
   dark-first / data-density stance you are designing inside.
4. The screens themselves, in the browser, on a team with real money in it — **before** reading any
   of their code. The inconsistency is a visual fact; meet it as one.

## The work

**Phase A — inventory (do this first, and show it before proposing anything).** Every table-shaped
surface in the Money hub: Budget Plan (List and By period), Player Dues, Fundraisers, Expenses &
Payables (all three sub-tabs), Allocations, Payments, Budget vs. Actual (Categories and Months).
For each, record what it actually is today — container, header row treatment, row separators,
number alignment, how a row is drilled into, what it does on a phone, and which of them scroll
sideways. Name the ones that are the same idea drawn differently, and the ones that are genuinely
different problems.

**Phase B — decide one treatment, and defend the exceptions.** A single table treatment for the
hub, expressed as shared classes or a component, plus a written argument for each surface that
legitimately departs from it. **There ARE real exceptions here — do not flatten them:**

- ⚠ **The Budget vs. Actual month grid MUST scroll sideways on a phone with its first column
  pinned.** That is a ruling, not an accident (`memory/design_decisions.md`, Chunk H) and the
  layout sweep enforces the page itself never scrolls sideways.
- ⚠ **Card-stacking on phones is deliberate** (`.tableAsCards`), and each stacked cell carries its
  own label. A "consistent" desktop table that turns into an unreadable phone table is a
  regression, not a tidy-up.
- ⚠ **Budget Plan's card stack may be right.** It is an editable outline with nested lines and
  per-row actions, not a report. Consistency does not mean "make everything the grid".

**Phase C — apply it**, one tab at a time, with the rendered sweep between passes.

## The traps, stated so you don't rediscover them

- ⚠ **The 44px tap floor is enforced by a RENDERED sweep, not by reading code**
  (`npm run check:layout`). Three defects this month were invisible to every file-reading gate. Any
  row that gains a control must clear the floor at 390px.
- ⚠ **`npm run check:layout` will abort on memory on this machine.** It aborted six times in one
  session. Run it **sliced** — `--only=coach-accounting,coach-budget,coach-budget-vs-actual,
  coach-expenses,coach-dues` covers the Money hub at every width and completes comfortably; a full
  sweep needs `--width=` halves and a freshly restarted dev server. **An aborted sweep exits 0
  through a pipe — read the output, never the exit code.** Never lower `DEV_FREE_FLOOR_MB` to get
  a green tick; that moves the line rather than passing it.
- ⚠ **The baseline is a ratchet with reasons.** A new sub-44px entry must be fixed or recorded with
  a written justification (`scripts/.layout-baseline.json`). Prune only entries you can prove you
  fixed — an entry can also stop reproducing because the seeded data changed, and dropping it then
  records a screen as fixed when nobody fixed it.
- ⚠ **Anything drawn beside every row is drawn as many times as the list is long.** This cost two
  rejected builds on the Export menu in one day. Before adding a per-row affordance, multiply it by
  the row count and look at that number.
- ⚠ **Colour and contrast are guarded** (`npm run check:tokens`, `check:contrast`,
  `check:text-contrast`). No raw hex, no fading `--data-gray`; the third text tier is the white
  alpha ladder capped at /50.
- ⚠ **`composes` is NOT transitive under Turbopack**, and warm-portal literals must be tokenized —
  see `memory/reference_turbopack_composes_and_theming.md`.
- ⚠ **Money panels stay mounted** (`display:none` while inactive) so a half-filled form survives a
  tab switch. Whatever you do to a table must not remount its panel.

## House rules that have bitten this repo before

- Branch `dev`. Stage **explicit pathspecs**; bracketed dirs need `":(literal)app/[orgSlug]/…"`.
  Commit only on explicit owner OK; use `git commit -F <file>` (PS5.1 mangles inline quotes).
  After every commit run `git show --stat HEAD` — other agents share this working copy, and it
  currently holds substantial unrelated in-flight work.
- **Never `Get-Content | Set-Content` a source file** (ANSI mojibake). Use the Edit tool.
- **Mockups are the spec and go to Claude Artifacts.** Draw the options before building; the last
  three decisions on these screens were each made from a render and two of them reversed a
  decision made from prose.
- New files and shared-module changes ⇒ **restart the dev server before handoff** (stop → delete
  `.next` → `npm run dev` → wait for Ready).
- After the build: `/simplify`, then `/review`, then `npm run typecheck` + `npm test` +
  `npm run verify:changed`. ⚠ `verify:changed` currently fails on **schema parity** because prod is
  behind dev on migrations 230 and 231 — that is pre-existing and not yours to fix.
- **`/docs`**: the in-app Money guide (`lib/help-content/coaches.tsx`, `premium-money`) describes
  these screens. Same unit of work.
- **Demo check**: the coach sandbox (`riverdale-ridge`) has tour narration pointing at money
  screens. Grep the tour steps and the moments dock for any sentence describing a table.
- Owner QA rides `OWNER_QA_LEDGER.md` (Money is §12, Group 1C); update `TODO.md` and the plan's
  status line with the commit anchor when done.

## Before you write code

Two blocking steps, in order:

1. **Show the inventory** (Phase A) — the owner asked "should we do something", not "do this". The
   inventory is what makes that answerable.
2. Then the **plain-language UX summary** required by `AGENCY_RULES.md` — what a coach sees
   differently on each Money tab, desktop and phone, and what does not change.

## Scope discipline

The Money hub only. The same inconsistency exists across the wider coach portal (roster, schedule,
attendance, results) and almost certainly in the admin side too — **note what you see, fix nothing
outside Money.** If a shared table treatment falls out of this that could serve the whole portal
later, say so and design it to be liftable, but land it inside Money.

---

**Companion reading, if the export work comes up:** three mockups from 2026-08-13, in order —
`44162825` (where the buttons live), `6dfb7890` (which file type), `96675523` (where Export lives).
