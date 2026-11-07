# Build prompt — Admin header, Phase 1: the bar's new shape

> Paste everything below the line into a fresh session (`/clear` first). Written 2026-11-07, after the owner ruled
> option 4 and asks A2–A10 (all as recommended). Plan of record: `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`.

---

Admin header: the bar names where you are — **Phase 1, the bar's new shape.** Product code this time.

## Read first, in this order

1. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: owner rulings (option 4, A2–A10, all ruled 2026-11-07), the
   rulings it knowingly departs from, Phase 1's checklist and the Architectural Decisions. Then the PM brief beside it.
2. The drawings: artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC (source
   `docs/projects/active/ADMIN_HEADER_ROWS_DRAWINGS.html`). Build to them. Use the Screen switch: "A tournament" and
   "Overview" are this phase's screens. The `.hb.quiet` / `.meta` rules in the drawing's CSS are the measured recipe.
3. The top entry of `memory/design_decisions.md` (2026-11-07, "THE ADMIN'S PINNED BAR NAMES WHERE YOU ARE").
4. `components/admin/AdminEventHeader.tsx` and `components/admin/kit/AdminKitEventHeader.module.css` in full (you
   are rewriting them). Then the coaches portal's masthead meta line (`.teamHeaderMeta`; grep for it) for the voice.
5. `docs/projects/active/WHATS_NEW_HOME_PLAN.md` status line. Its "What's new" note sits directly under the Overview
   heading you are removing.

Broad reading goes to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## What this phase changes (and what it does not)

**In scope:**

- **The small line moves under the name.** In a tournament the bar reads: the event's name (still a link to its
  dashboard), then on a small line UNDER it: the club (desktop only) · the dates · the status chip. Today that line sits
  ABOVE the name in capitals; it becomes the coaches portal's meta voice (`--font-data`, `--type-label`, normal weight,
  no tracking, no capitals, `--text-tertiary`, dot separators drawn between siblings). The chip keeps its shipped look.
- **Phone (A2 = second line):** on a phone the small line is a second line in the bar (dates · chip, no club). It never
  folds away.
- **No scroll collapse, anywhere.** Remove the `collapsed` state and its scroll listener, the `.collapsed` rules, the
  second chip copy (`chip('collapsed')` / `chipCollapsed`), and `compact={collapsed}` on the FlipPill. The bar holds
  its height at every width.
- **The portal masthead's padding recipe:** 0.5rem block padding on desktop, 0.45rem on a phone. The 44px controls in
  the bar (the globe, and later the back link and the switcher) keep their tap size by a −4px block overhang, so the bar
  does not grow to the tap floor. See the drawing's `.hb.quiet` rules.
- **Overview (A3):** the paper heading `<AdminPageHeader title="Overview" />` in
  `components/admin/kit/club/ClubHubKit.tsx` goes. The bar already names the club there. The first content (the What's
  new note when it shows, else "This morning") starts 1rem under the bar on a phone and 1.4rem on desktop (as drawn).
  Keep the note's placement as its plan rules it.
- **Heading semantics, written in the component's header comment:** on club screens the bar's name is the page's
  `<h1>`; inside a tournament the name stays a link and the page's own title stays the `<h1>`. **In Phase 1 the bar's
  name is the `<h1>` on Overview only.** Every other club screen still draws its own paper heading until Phase 2, and
  two `<h1>`s on one page is the defect to avoid.
- `--admin-header-h` keeps publishing the bar's height. It now changes only when you navigate, never on scroll. Check
  that every in-page sticky element reading it still sits flush.

**Not this phase:**

- Places handing their name, facts and tabs to the bar: Rep teams, a season, a team, Accounting, Families,
  Organization. That is Phase 2. So in Phase 1 every club screen except Overview still shows the club's name in the bar
  as today (one line, no small line), and its own heading and tabs on the paper.
- The club's name on the small line (A4). It arrives with Phase 2, when the bar names a place.
- Calendar, Schedules, record pages, the tournament-only org's own screens (A10): Phase 3.
- The coaches portal. Untouched. `HubTabBar` is not touched in this phase.

## Gotchas

- **Shared working tree.** Other sessions have uncommitted edits in `ClubHubKit.tsx` (Club Stage 13b, the club band)
  and in `tests/unit/club-stage1-screens-guard.test.ts`. Read the live file before editing. Change only your hunks.
  Never revert theirs. Stage explicit pathspecs only, and check `git show --stat HEAD` after any commit.
- **The type check** (`scripts/check-admin-type.mjs`, the 10-19 A14 ratchet) counts the data face outside allowed
  roles. The small line is ruled to be the eyebrow moved under the name, so mark it `/* type-ok: eyebrow */`. Do not
  raise the baseline or edit the script.
- **The Overview guard.** `club-stage1-screens-guard.test.ts` asserts `<AdminPageHeader title="Overview" />`. A3
  reverses that, so rewrite the test. The assertion becomes: no paper heading on the hub, and the hub is never titled
  with the club's name on the paper. Keep its other assertions, including the 10-01 rule "no club name in a page
  eyebrow", which still holds for paper headers.
- Find every test that pins the header's collapse or the eyebrow-above-name shape (grep `AdminEventHeader`,
  `chipCollapsed`, `collapsed`, `eyebrowOrg`, `--admin-header-h` under `tests/unit`). Update them to the new shape.
- **Demo tours.** If a tour anchors on the Overview heading, `npm run check:demos` fails. Move the anchor; do not
  delete the step.
- **Dates and times** only through `formatStoredDate` / `formatTime`. Spelling gate: `npm run check:spelling`.
- **Dev server:** this changes a shared component, so restart it before hand-off (AGENTS.md). Start it with
  `npm run dev` only.

## Steps

1. Present the **product-manager UX summary** (AGENCY_RULES, blocking): what an organizer and a club admin see
   differently, phone and desktop, and that Phase 1 is visible mainly in tournaments and on Overview. Then the task list.
2. Build. Then `npm run verify:changed`, `npm run typecheck` (shared module), `npm run check:spelling`,
   `npm run check:demos`, and `npm run check:layout --changed` on a tournament screen and Overview (dev server; never a
   whole-product sweep there).
3. Run `/design` on the built screens against the drawings, and apply its fixes. Offer `/simplify` only if you added a
   new abstraction. Then `/review`.
4. Offer `/docs`: help articles that describe the header, the Overview heading, or "the bar shrinks when you scroll"
   (`lib/help-content/*.tsx`, including `keywords` / `searchText`).
5. Write the owner walk as a checkable Artifact, with ONE purpose: the bar on a tournament screen and on Overview,
   phone and desktop, at rest and scrolled. Give it the next free § in `docs/projects/active/OWNER_QA_LEDGER.md` (never
   re-sort the numbers).
6. Tick Phase 1's boxes in the plan with what was built, update the TODO.md line and the project memory, and record the
   positive fact ("built 2026-MM-DD, walk §N owed"), never "uncommitted".
7. **Do not commit without asking me.** When I say yes, the commit takes only this phase's files.

## Done when

- Inside a tournament, the event's name sits on top and the club · dates · status line sits under it. On a phone the
  line is dates · status. Nothing moves when you scroll, at any width.
- Overview has one title: the club's name, in the bar. The page starts with the What's new note or "This morning".
- Every other club screen looks as it does today, apart from the steadier bar.
- No page has two `<h1>`s. The tournament name still opens the dashboard.
- Guards, typecheck, spelling and demos pass. The `/design` and `/review` findings are applied or recorded.
