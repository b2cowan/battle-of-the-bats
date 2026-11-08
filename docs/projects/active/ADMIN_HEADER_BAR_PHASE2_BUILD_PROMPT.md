# Build prompts — Admin header, Phase 2: places hand their name, facts and tabs to the bar

> Two sessions, each pasted into a fresh chat (`/clear` first). Written 2026-11-07, after Phase 1 was walked (§486, 12/12)
> and committed (`5451558f9`, `d8f49c846`). Plan of record: `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md` (Phase 2).
> Session A builds the mechanism and the first two places. Session B does the other places, the sticky census and the walk.
> The split is a suggestion, not a ruling: if A finishes with room to spare, B's first frames can ride along.

---

# SESSION A — the hand-off mechanism, the in-bar tab row, Rep teams and a season

Admin header: the bar names where you are — **Phase 2, session A.** Product code.

## Read first, in this order

1. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: the rulings (option 4, asks A2–A10), "Rulings this knowingly departs
   from", Phase 1's "as built" notes (they carry lessons), Phase 2's checklist, and "To settle in Phase 2".
2. The drawings: artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC (source
   `docs/projects/active/ADMIN_HEADER_ROWS_DRAWINGS.html`). Use the Screen switch: **Rep teams** and **A season** are this
   session's screens. Build to them, phone and desktop.
3. The top entry of `memory/design_decisions.md` (2026-11-07, "THE ADMIN'S PINNED BAR NAMES WHERE YOU ARE").
4. `components/admin/AdminEventHeader.tsx` and `components/admin/kit/AdminKitEventHeader.module.css` in full (Phase 1
   just rewrote them), then `app/[orgSlug]/admin/AdminChrome.tsx`.
5. `components/admin/kit/club/PlaceFrame.tsx`, `RepTeamsFrame.tsx`, `SeasonFrame.tsx`, and `components/shared/HubTabBar.tsx`
   with its stylesheet (**shared with the coaches portal**).
6. `lib/admin-kit-nav.ts`: it already resolves the place and its tabs from the path.

Broad reading and censuses go to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## What this session changes

- **The hand-off.** A context provided by the admin shell. A place frame fills it with: title, back link, switcher,
  small-line facts, status chip, tabs. The bar renders what it is given and falls back to what it shows today (the club's
  name on Overview, the event in a tournament).
- **No flash of the wrong name.** Settle the open decision ("To settle in Phase 2"): the bar must know the place from
  the ROUTE before the frame's data arrives, and show the frame's placeholder name on the same line, so nothing shifts
  and the club's name never appears and swaps. Record the decision in the plan's Architectural Decisions.
- **The tab row moves into the bar** for the places built this session. `PlaceFrame` stops drawing its header and its
  `HubTabBar` on the paper and registers them with the bar. `TabActions` / `TabPageHeader` stay where they are.
- **`HubTabBar`: an in-bar variant behind a new opt-in prop.** No bottom border of its own; the overflow fade and
  chevron paint the bar's white, not the paper. **The coaches portal must look exactly as it does today.**
- **Rep teams** (`RepTeamsFrame.tsx`): the bar names "Rep teams", club on the small line (desktop only, A4), six tabs
  with their waiting counts.
- **A season** (`SeasonFrame.tsx`): back link "Seasons", the season's name, the season switcher, the status chip; seven
  tabs. On a phone the small line is a second line (A2 = a): "House league · Registration open".
- **One title per screen:** the paper heading of these places goes. Every other place still draws its own until session B.
- **`<h1>` rule, now widened.** The bar's name is the page's one `<h1>` on the club Overview AND on every place that
  hands it a name. Inside a tournament it stays a link and the page's own title stays the `<h1>`. Rewrite the component's
  header comment and the guard that pins "the bar's name is an `<h1>` on Overview only"
  (`tests/unit/club-stage1-screens-guard.test.ts`). Two `<h1>`s on one page is the defect to avoid.
- **A long name is cut to ONE line with "…"** (owner, walk §486 E). A season name beside a switcher is the hard case:
  measure it on a phone and say what you did.

**Not this session:** Team, Accounting, Families, Organization (session B). Calendar, Schedules, record pages, tournament-only
orgs (Phase 3). The coaches portal's look.

## Gotchas (learned in Phase 1)

- **Specificity.** A phone rule that hides the club dot must match the separator rule's specificity, or "· Nov 1–3" shows.
  Check each hidden separator on a real phone width.
- **The layout sweep's `ready: 'h1'`.** A bar `<h1>` releases it before the page body mounts. Any sweep entry for a place
  must wait for a body marker, as the hub entries now do (`[data-club-hub]`). Add one per frame and re-point the entries.
- **`--admin-header-h`** now changes when you navigate. The bar gets TALLER on a place (the tabs sit in it); everything
  reading the variable must follow. Session B does the full sticky census, but do not ship a place whose own sticky parts
  slide under the bar: check the two places you build (the draft board and the season's group heads are the likely ones).
- **Shared working tree.** Another session has an uncommitted hunk in `components/admin/kit/club/league/teams/Teams.module.css`
  (the card head's pencil and bin spacing). Read the live file; change only your hunks. `TODO.md` and `OWNER_QA_LEDGER.md` carry
  other sessions' edits too. Stage explicit pathspecs only; never `git add -A`.
- **Type check** (`scripts/check-admin-type.mjs`, A14): the small line is the eyebrow moved, marked `/* type-ok: eyebrow */`.
  Do not raise the baseline or edit the script.
- **Demo tours** anchored on a removed paper heading fail `npm run check:demos`. Move the anchor; do not delete the step.
- **Dates and times** only through `formatStoredDate` / `formatTime`. Gate: `npm run check:spelling`.
- **Dev server:** shared component and shell change, so restart it before hand-off (AGENTS.md). Only `npm run dev`.

## Steps

1. Present the **product-manager UX summary** (blocking): what a club admin sees differently on Rep teams and a season,
   phone and desktop. Then the task list.
2. Build. Then `npm run verify:changed`, `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, and
   `npm run check:layout --changed` on the touched screens (dev server; never a whole-product sweep there).
3. **Prove the portal is untouched:** the coaches portal's tab row, measured before and after, identical.
4. `/design` on the built screens against the drawings; apply its fixes. Offer `/simplify` (a new shared abstraction is
   being added). Then `/review`.
5. Tick session A's boxes in the plan with what was built and any measurement; update the TODO.md line and project memory
   with the positive fact ("built 2026-MM-DD"). No walk yet: one walk covers the whole phase after session B.
6. **Do not commit without asking me.** On my yes, the commit takes only this session's files, built in a private index
   on the current HEAD (see the memory note on partial commits).

## Done when

- Rep teams and a season each show ONE title, in the bar, with the tab row pinned inside it. Nothing moves on scroll.
- Opening either place never shows the club's name first. A long name is one line with "…".
- Every other club place looks as before. The coaches portal is pixel-identical.
- No page has two `<h1>`s. Guards, typecheck, spelling and demos pass. `/design` and `/review` findings are applied or recorded.

---

# SESSION B — a team, Accounting, Families, Organization, the sticky census, and the Phase 2 walk

Admin header: the bar names where you are — **Phase 2, session B.** Product code, then one owner walk. Start only after
session A is built (the hand-off, the in-bar `HubTabBar` variant, Rep teams and a season exist).

## Read first

Everything in session A's list, then the plan's Phase 2 "as built" notes that session A wrote (the mechanism and the
no-flash decision). Drawings Screen switch: **A team**, **Accounting**, plus Families and Organization (same shape as
Rep teams). Broad reading goes to a helper agent.

## What this session changes

- **A team** (`TeamFrame.tsx`): "← Teams" back link, the team's name, small line club · Rep teams · group · season chip;
  on a phone the group drops (measured 13px over in the drawing). Five tabs.
- **Accounting** (`money/AccountingFrame.tsx`): the bar names "Accounting", nine tabs pinned in it. **A5:** on a phone the
  sideways tab row stays, pinned (about five of nine tabs on screen; the open tab scrolls into view). **A6:** the bar does
  not say which fiscal year; the Year pill keeps that. A team's account in Accounting is NOT a record page (ruled 2026-10-16).
- **Families** (`families/FamiliesFrame.tsx`) and **Organization** (`OrgFrame.tsx`): the place's name in the bar, its tabs
  pinned inside it, the paper heading gone. Organization's tab row never includes Plan & billing (13i). Read each place's
  role gating: a one-tab person must not see an empty tab row in the bar.
- **The sticky census.** Every `position: sticky` under the club admin that sits in the page scroller must clear the taller
  bar with `top: var(--admin-header-h)`. Known: the draft pool bar and column head (`league/teams/Teams.module.css`),
  `LeagueSeason.module.css` `.groupHead`, Accounting's `MoneyMonthGrid` head, the Schedules day bands, and
  `AdminKitFrame.module.css`. Census by helper agent; verify each on a real screen at rest and scrolled, phone and desktop.
- **The shell's `scroll-margin` / scroll-into-view offsets** (the Calendar's `scroll-margin` comment names the old 61px):
  re-measure every anchor that clears the bar.

## Gotchas

The same as session A's, plus: **a one-tab or restricted role.** Frames show different tabs by role and plan; the bar's tab
row must equal what the person could open, with no gap or placeholder. **Pinned tabs are every place or none** (the
2026-08-19 reversal): do not ship one place with the old paper tab row.

## Steps

1. PM UX summary (blocking), task list, build, then the same checks as session A (`verify:changed`, `typecheck`,
   `check:spelling`, `check:demos`, `check:layout --changed`).
2. `/design` on every place built across both sessions; apply fixes. `/review` on the whole phase's diff (it is shared
   chrome and role-gated). Offer `/docs`: help articles that describe the place headers or "scroll back up to the tabs"
   (`lib/help-content/*.tsx`, incl. `keywords` / `searchText`).
3. Write the owner walk as a checkable Artifact with ONE purpose: **every place's bar, phone and desktop, at rest and
   scrolled, as the owner and as a restricted role.** Next free § in `OWNER_QA_LEDGER.md` (never re-sort numbers).
4. Tick Phase 2 in the plan, update the TODO.md line and project memory ("built 2026-MM-DD, walk §N owed").
5. **Do not commit without asking me.**

## Done when

- Rep teams, a season, a team, Accounting, Families and Organization each show ONE title in the bar with the tabs pinned
  inside it; no place keeps a paper heading or a paper tab row.
- Nothing slides under the taller bar on any screen; the draft board, group heads, month grid and day bands sit flush.
- A restricted role sees only its own tabs. The coaches portal is untouched.
- Guards, typecheck, spelling, demos and the layout check pass; `/design` and `/review` findings applied or recorded; the walk is published.
