# Toolbar Rules — one layout, one search, one shape language for every list (build)

> Paste into a fresh session on `dev`. Written 2026-10-17, the day the rules were **ruled**: all asks as recommended
> (owner: *"looks good"*). **Four stages**, the first a census with no code. No migration, no API change.
>
> **The spec is the hub:** https://claude.ai/artifact/SPjRTAB6kVqd9vJ8x1vuza (**version 5**). Read it whole, at Desk
> and at Phone 390 (the toggle at the top). The Rules section is the law; the frames show it on Check-in, Results,
> Schedule, Practice plans, Skills & Goals, the club Ledger and the Calendar. Every New / Restyled / Moved /
> Unchanged tag is a requirement. Where a frame's prose and the plan disagree, the plan wins and you say so.
> - **The plan is the call list:** `docs/projects/active/TOOLBAR_RULES_PLAN.md` — §1 the seven rules with a build
>   test each, §2 screen by screen, §3 stages, §4 guards, §5 walks, §6 out of scope, §7 risks, §10 departures.
> - **The ruling, whole:** `memory/design_decisions.md`, top entry "2026-10-17 — EVERY LIST'S TOOLBAR …". The table
>   standard's §3.9 is already reworded to it (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`).
> - Where you must depart, say so at build time and record why in plan §10; never silently.
>
> **Read first:** the plan whole; `AGENTS.md` (this Next.js is not the one you know — read `node_modules/next/dist/docs/`
> before routing or config work); `AGENCY_RULES.md` (one branch, `dev`; explicit pathspecs; one spelling; status
> wording); `CLAUDE.md` (broad reading goes to a helper; open a helper's cited lines before relying on them).

## What you are building, in one paragraph
Every list toolbar in the tournament admin, the club admin and the coaches portal follows one split: **the left
picks which list** (a view choice, or the list's count), **the right finds and narrows inside it** (Search, filters,
Tools), page actions stay where each portal keeps them. One rounded search field (magnifier, 16rem on a desk, the
room's height) replaces every screen's own. What picks which list is rounded; what narrows or acts keeps its square
corners. Check-in's arrival buttons take Results' rounded view pill. The two Ledgers keep their own filter row — the
written register exception (Rule 7).

## Stage 0 — census (no code; present it, wait for the owner)
Delegate the reading (a helper; it reads, you check the cited lines). One table, every list toolbar in the three
surfaces: screen as a user names it · file:line · left today · right today · changes by rule number (1–7). It must:
1. Confirm or correct every row of plan §2.
2. **Classify every club and coach pill** with the 10-07 "two faces" test (`memory/design_decisions.md`, search "Two
   faces, two jobs"): olive `lead` = picks what is read → LEFT, rounded; plain `restQuiet` narrowing → RIGHT,
   square. Budget's When / Columns / Collapse all, BvA's Compare / Showing, Accounting Teams' Group are the ones the
   plan could not settle.
3. Fill the coaches portal rows (roster, schedule, dues, fundraisers, awards, notifications, player development, …).
4. List every screen the two shared pickers reach (the `lead` pill in `components/shared/FilterPill.module.css`, the
   view switch `.calViews` in `app/[orgSlug]/coaches/coaches.module.css` ~6220) — Stage 2 changes them all at once.
Anything not foreseen in plan §2 is an **ask** for the owner, never a silent build. Publish the census as a tab on the
hub (same URL: read it first with the Artifact tool, then publish to it) and stop for the owner's yes.

## Stage 1 — the search field
- **One shared component** (memory: a shared component beats a shared class) — rounded (999px), a 14px magnifier,
  16rem on a desk, inset outline that turns olive on focus, the room's height (a prop or a variant: admin = the admin
  control height, 44 at ≤768; coach rooms = 44 at every width — the car-park rationale, `coaches.module.css` ~11634),
  and the two phone behaviours: the tournament toolbar's 44px square that opens a full-width field with ✕ under the
  line (today's `ScheduleToolbar` phone behaviour), and the coach rooms' own full-width row.
- Adopt it everywhere plan §2 tags **S**: Results, Schedule, Teams, Check-in (and the gate), Practice plans (all three
  tabs and its picker/docked hosts), Skills & Goals Sessions, the Opponents book. Families only if its Stage 5b work
  is committed — see below.
- Retire the looks it replaces: `.scoutSearch`, the tournament `AdminToolbar.module.css` `.searchField` face, the
  Sessions `.input`. Delete what nothing renders (`check:css-selectors` will tell you).
- **Words (W):** the placeholder is "Search <noun>…" with the dots; the accessible name and "Clear …" keep none.
  Today `SCHEDULE_DAY_WORDS.search` ("Search teams") feeds the placeholder, the aria-label and "Clear search teams"
  — add a placeholder-only word rather than putting "…" into that one. "Find a session…" → "Search sessions…".
  Grep for the other spelling first; `npm run check:spelling`.

## Stage 2 — shapes (Rules 4 and 6)
- The olive `lead` pill rounds (one rule in `FilterPill.module.css`; it reaches the coaches portal — walk those too).
- The view switch rounds (`.calViews`; shared by the club Calendar, Venue library, rep-team schedule and the coach
  schedule).
- Teams' division picker rounds (`AdminToolbar.module.css` `.divisionSelect` / trigger), keeping its waiting dot and
  amber count; match Schedule's Day pill.
- `repKit.views` (rep-team Tryouts, the tournament Communication page) takes the view pill: rounded, count in the
  lighter ink, not " · n" inline.
- Check-in's arrival buttons: on a desk (the organizer's board AND the gate's — one board) Results' view pill, 38px,
  sized to their words. **The gate's pinned bottom bar and both phones' four-up bar stay exactly as they are** —
  `DayOfFilterButton` (`components/volunteer/DayOfBottomBars.tsx`) is shared with the volunteer shell, so the
  rounded face is the inline/desk variant only.
- Narrowing pills, Filter, Tools, Export and buttons keep their square corners.

## Stage 3 — placement (Rules 1, 2, 7)
- Practice plans: a count left ("24 drills"; "2 of 24 drills" while a search or tag narrows), search right then
  Tags; the Tags panel right-anchors (it left-anchors at ≤640 today — re-walk at 390). The count is the page's only:
  the picker sheet and the 320px docked library keep a full-width search row and no count.
- The club screens tagged P in plan §2: narrowings move right of the gap, before the screen's actions (do NOT
  reorder Export · Tools · [lime add] on money screens — Ledger Parity D6). Payment requests gains a count.
- The Calendar **and the coach schedule together** (`components/coaches/ScheduleCalendarViews.tsx` ~733–800):
  Venue · Program · Team and the clash pill right, before Export; the time-zone note stays with the dates (10-09).
- Schedule detail: the view switch comes from the section head into the toolbar's left; filters right.
- **Rule 7 — leave the two Ledgers' filter row alone** (club `accounting/ledger/page.tsx`, coach
  `accounting/expenses/panel.tsx`): their only change is the rounded Book (Stage 2).

## Families — coordinate, don't collide
Club Stage 5b (the Families screens) is being built in another session, uncommitted, with search beside the Show
pill. The ruling moves search right; the amendment note sits at the top of `CLUB_FAMILIES_BOOK_PLAN.md`. Check
`git status` / `git log` for `components/admin/kit/club/families/`: if it is still uncommitted, do not touch those
files — leave it to that session (its plan says so); if committed, adopt the shared field and the placement there.

## Guards (plan §4)
Extend `tests/unit/tournament-stage3-part7-guard.test.ts` (it holds Check-in and Teams on the shared line) or add a
toolbar-rules guard: every list search renders the shared component; no narrowing pill left of the gap outside the
two Ledgers; the `lead` pill and view switch rounded. A guard that cannot be made precise is a finding, not a
reason to skip.

## Each stage
`npm run verify:changed -- <files>` (other sessions' failures are theirs — name them, don't fix them); `npm run
typecheck` when shared modules change; `node scripts/check-layout-invariants.mjs --only=<ids>` for the touched
screens on the running dev server (never a whole-product sweep on dev); `/review`; then the owner's walk; then ONE
commit with explicit pathspecs and `git show --stat HEAD`. Offer `/docs` where help text names a toolbar position
(Stage 3) and `/simplify` after Stage 1 (a new shared component).

## Walks (QA ledger; one purpose per walk; a checkable artifact — add it to the hub as a QA Walk tab)
W1 the search field everywhere (size, words, both phone behaviours) · W2 the shapes (rounded picks vs square
narrows; Check-in desk vs phone vs the gate; the coach portal's pickers) · W3 placement (Practice plans, the club
screens, the Calendar with the coach schedule) · W4 the two Ledgers unchanged but the rounded Book.

## Out of scope
House league's four legacy toolbars; the rep-teams list's native group select; making the two sides' phone search
behave alike; anything Stage 0 finds beyond plan §2 until the owner rules it.
