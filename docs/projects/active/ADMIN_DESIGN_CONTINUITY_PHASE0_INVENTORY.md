# Admin Design Continuity — Phase 0 Inventory

> **Date:** 2026-09-25 · **Status:** read-only desk measurement (no code changed). The screenshot/
> layout-sweep baseline named in the plan's Phase 0 bullet ("add every admin route to the layout
> sweep… record today's dark baseline") is a **separate, follow-up step** — it requires running
> `scripts/layout-screens.mjs`, which this pass deliberately did not do (hard read-only constraint
> while the owner was live-testing the dev server). Everything below is static-file measurement:
> directory walks, grep/regex counts, and one read-only Node script (`measure.mjs`, appendix §A).
> Plan of record: `docs/projects/active/ADMIN_DESIGN_CONTINUITY_PLAN.md`.

## Headline

The admin surface is **86 screens** (27 of them tournament) across **54 stylesheets holding 812 raw
colour literals** and **1,868 colour-carrying-candidate inline `style={{…}}` blocks** — both figures
in the plan verify EXACTLY against a fresh count (appendix §B), so the plan's sizing is trustworthy,
not a rough guess. Extending the lens to the admin-adjacent libraries the task also asked about
(`components/accounting`, `components/help`, `components/charts`, plus the scorekeeper/official/
check-in routes) adds **~30 more files and ~230 more literals** on top of that core. The one-account
warm/dark mechanism (`app/globals.css`'s `[data-coach-warm-enabled]` block) already remaps **111 of
the 144 distinct CSS custom properties** admin code reads — but the **33 it does not** are not evenly
"safe": they include the org's own brand tokens (by design, R1), a **materially incomplete white/
black alpha ramp** (`--white-4/-15/-25` and `--black-20/-30/-40` have no warm answer at all), the
`.card` recipe's own **`--highlight-top`/`--shadow`/`--shadow-sm`** (used by all 227 `.card` call
sites), and several admin-local one-off accents (`--acct-violet`, `--help-accent`, `--sk-*`). A
genuinely good-news finding: the highest-volume global classes admin already leans on — `.btn`
(567×), `.btn-ghost` (251×), `.btn-lime` (102×), `.btn-outline` (82×), `.btn-primary` (64×), and
`.card:hover`'s glow — **already have warm-specific overrides written and shipped**, scoped under the
very marker the admin lacks (`app/globals.css:1140-1192`). Flipping the marker on buys those ~1,066
call sites their warm skin for free; it is the literals, the inline styles, and a handful of
structural leaks (below) that cost the phase its size.

---

## 1. Per-area table

Methodology: each area is a set of real files (directory prefixes + named files), walked once and
measured with `measure.mjs` (appendix §A). "CSS raw colour literals" = hex (`#rgb`/`#rrggbb[aa]`) +
`rgb()/rgba()/hsl()/hsla()` calls that do **not** contain `var(...)` anywhere inside their
parentheses (comments stripped first). "Token-rgb alpha" = the `rgba(var(--x-rgb), …)` idiom,
counted separately as instructed — it came back **0** everywhere in admin (the idiom is a
coaches-portal-only convention today; see §5). "Inline style blocks" = `style={{…}}` with balanced-
brace extraction; "colour-mentioning" = the block contains a `color/background/backgroundColor/
borderColor/border/fill/stroke/boxShadow/outline/outlineColor` key. Brand-token counts match on the
exact token name (`--primary` does not also match `--primary-rgb`).

| Area | Screens (`page.tsx`) | .css files | CSS raw literals (hex / func) | white-alpha `rgba(255,255,255,…)` | Brand tokens in CSS (`--primary*`/`--border`/`--glow*`) | Inline `style={{` blocks | …colour-mentioning (literal / var) | Hex in TSX/TS |
|---|---|---|---|---|---|---|---|---|
| Frame/shell | 0 | 7 | 34 (2/32) | 10 | 1 (`--border`) | 2 | 2 (0 / 2) | 0 |
| Hub + onboarding | 2 | 1 | 65 (6/59) | 51 | 15 (`--border`) | 37 | 22 (0 / 22) | 0 |
| Organization | 12 | 6 | 137 (0/137) | 125 | 51 (8 `--primary-rgb`, 4 `--primary`, 3 `--primary-light`, 35 `--border`, 1 `--glow-sm`) | 151 | 60 (2 / 55) | 11 |
| Rep Teams | 17 | 1 | 76 (0/76) | 73 | 5 (`--border`, TSX only) | 379 | 181 (**63** / 108) | 82 |
| Accounting¹ | 5 | 7 | 274 (10/264) | 233 | 2 (`--border`,`--primary-light`) | 149 | 64 (16 / 47) | 18 |
| Families | 3 | 1 | 7 (0/7) | 7 | 0 | 16 | 6 (0 / 3) | 0 |
| Public Site editor | 1 | 1 | 17 (0/17) | 17 | 1 (`--border`) | 6 | 0 | 0 |
| House League | 8 | 1 | 55 (2/53) | 39 | 2 (`--border`) | 258 | 109 (**18** / 80) | 29 |
| Tournaments² | 27 | 27 | 205 (24/181) | 110 | 74 (29 `--primary-rgb`, 10 `--primary`, 7 `--primary-light`, 20 `--border`, 1 `--glow-sm`, +15 `--border` in TSX, +1 `--primary-faint` TSX) | 857 | 373 (**23** / 334) | 26 |
| Scorekeeper & Gate³ | 4 | 2 | 16 (8/8) | 0 | 0 | 30 | 20 (**12** / 8) | 10 |
| Help⁴ | 10 | 1 | 150 (12/138) | 106 | 44 (21 `--primary-light`, 23 `--border`) | 0 | 0 | 0 |
| Other admin | 1 | 6 | 8 (0/8) | 5 | 1 (`--primary-light`) | 19 | 9 (2 / 6) | 0 |
| **Total (this scope)** | **90⁵** | **61** | **1,044** (64/980) | **776** | — | **1,904** | **846** (176 literal / …) | **176** |

¹ Includes `components/accounting/**` (4 files) alongside `app/[orgSlug]/admin/accounting/**`.
² Includes `components/admin/tournament/**`, `components/admin/import/**`, and the tournament-only
components living directly in `components/admin/` (`TournamentCreationPreview`, `TournamentSetupWizard`,
`TournamentStyleCards`, `CheckInBoard`, `CoinTossRecorder`, `TieBreakerEditor`).
³ `app/[orgSlug]/scorekeeper/**` + `app/[orgSlug]/official/**` + `app/[orgSlug]/check-in/**`. All
three are guest-link screens (no login) — see §4 Scorekeeper row.
⁴ `components/help/**` (15 files) + `app/[orgSlug]/admin/help/**` (10 screens). Zero inline
`style={{` anywhere in help — it is CSS-Modules-only, which is good hygiene but means **all** of its
150 literals live in one 1,900-line stylesheet (`components/help/help.module.css`).
⁵ 90 here vs. the plan's "86 admin screens" because this table's Help row folds in the 10
`app/[orgSlug]/admin/help/**` pages (which the plan's 86 *also* includes — 86 = every `page.tsx`
under `app/[orgSlug]/admin/**`, confirmed in appendix §B) plus the 4 Scorekeeper/Gate screens, which
sit *outside* `app/[orgSlug]/admin/**` and so are additional to the plan's 86, not double-counted
within it.

**Why this table's grand total (1,044 literals / 61 sheets) exceeds the plan's headline (812 / 54):**
the plan's 812/54 is scoped strictly to `app/[orgSlug]/admin/**` + `components/admin/**`; this table
additionally reaches into `components/accounting`, `components/help`, and the scorekeeper/official/
check-in routes because the task asked those areas to be measured too. Appendix §B reproduces the
plan's exact 812/54/1,868/86 figures independently, byte-for-byte, so both numbers are trustworthy —
they are simply different scopes.

---

## 2. Theme reach

**(a) Marker presence.** `grep -rn "data-coach-warm-enabled" app/[orgSlug]/admin components/admin`
returns exactly one hit, and it is **inert**: `components/admin/AdminSkeleton.module.css:18` already
carries a `:global(html[data-user-theme="warm"] [data-coach-warm-enabled]) .block { … }` rule —
written defensively (or copy-pasted from a coach pattern) for a marker that, today, no admin ancestor
ever sets. Confirmed: **no admin layout or shell element carries the marker.** `app/[orgSlug]/
admin/layout.tsx`, `AdminChrome.tsx` and `AdminTitleManager.tsx` set none of `data-user-theme`,
`data-coach-warm-enabled`, or anything theme-related.

**(b)/(c) Tokens read vs. tokens remapped.** Admin CSS+TSX reads **144 distinct** `var(--x)`
references. The warm block (`app/globals.css:809-1047`) redefines **111** of them. **33 are not
remapped**, and they are not evenly disposable:

| Category | Not-remapped tokens | Verdict |
|---|---|---|
| Org brand (by design, R1) | `--primary` (13), `--primary-rgb` (36), `--primary-faint` (1), `--glow-sm` (2) | Correct to leave unmapped — R1 removes admin's *reads* of these, not the tokens |
| **White-alpha ramp gap** | `--white-25` (4 uses — `admin-common.module.css`, `onboarding.module.css`, `ScheduleTimeline.module.css`, `schedule-admin.module.css`), `--white-15` (1), `--white-4` (1) | **Real gap.** The warm block remaps `--white-03/05/10/20/30/35/40/45/50/55/60/65/70/75/80/85/90` — a near-complete ladder — but skips these three steps entirely. Any admin surface using them stays literal white-on-white under warm. |
| **Black-alpha ramp — entirely unmapped** | `--black-20` (13), `--black-30` (3), `--black-40` (2), bare `--black` (1) | **Real gap**, bigger than it looks: 13 uses of `--black-20` is real weight, and there is *no* warm equivalent anywhere in the ramp — a dark-overlay scrim would render as an unchanged black wash on a cream card. |
| **`.card` recipe itself** | `--highlight-top` (7), `--shadow` (5), `--shadow-sm` (2) | **Real gap, high blast radius** (227 `.card` uses admin-wide). `--highlight-top` *does* have a light variant, but it is gated by the unrelated `[data-color-mode="light"]` selector (`app/globals.css:343-348`, the **org's public colour-mode**, which admin never carries per the plan's own note) — not by `[data-coach-warm-enabled]`. `--shadow`/`--shadow-sm` have no light counterpart anywhere in `globals.css`. |
| Admin-local one-off accents | `--acct-violet` (3, `accounting.module.css`), `--help-accent` (3, `help.module.css`), `--on-lime` (5), `--dark-navy` (1), `--lifecycle-color` (2), `--chip-pending`/`--chip-accepted` (2 each), `--plan-error-text`/`--modal-error-text` (2/1), `--teams-select-bg` (1), `--onboarding-modal-bg`/`--wizard-modal-bg`/`--acct-panel-bg` (2/1/2) | Each needs individual triage — some are already `token-exempt`-annotated (§5), most just need a warm-aware value or promotion to an existing token. |
| Scorekeeper's own palette | `--sk-ink`, `--sk-ink-dim`, `--sk-ink-faint`, `--sk-bg`, `--sk-bg-deep`, `--sk-amber`, `--sk-red`, `--sk-warm`, `--sk-lime-tint` | Not a "gap" so much as a **separate system** — see §4/§5. |
| Structural (not colour; fine to ignore) | `--font-data`/`--font-display`/`--font-sans`, `--type-body`/`--type-support`/`--type-label`/`--type-heading`/`--type-token`, `--radius`/`-sm`/`-md`/`-xs`, `--admin-*-h` sizing tokens, `--nav-*`, `--vv*`, `--transition`, `--ease-spring`, `--blur-bar`, `--icon-door-*`, `--table-pad-compact` | No remap needed — these aren't colour. |
| **`--border-1` (bug, not a gap)** | 1 use, `app/[orgSlug]/admin/org/tournaments/tournaments-admin.module.css:509` | **Undefined token.** `globals.css` defines `--border`, `--border-2`, `--border-subtle` — never `--border-1`. This `border-top: 1px solid var(--border-1)` has been resolving against nothing since it was written; likely a typo for `--border-2`. Pre-existing bug, surfaced by this pass, unrelated to the warm program but worth a one-line fix whenever that file is touched. |

**Top 30 tokens by usage** (full list of all 144 in `measure-output.json`, not attached — see
appendix): `--blueprint-blue-rgb` 615, `--font-data` 561, `--logic-lime` 495, `--logic-lime-rgb` 334,
`--white-40` 312, `--data-gray` 215, `--warning` 150, `--white-60` 148, `--warning-rgb` 138,
`--border-2` 135, `--danger` 134, `--danger-rgb` 130, `--white-30` 128, `--white-90` 123, `--border`
120, `--white` 115, `--white-70` 104, `--white-50` 103, `--fl-text` 98, `--blueprint-blue` 98,
`--white-80` 95, `--success` 70, `--white-45` 66, `--bg-2` 64, `--surface` 64, `--white-5` 63,
`--success-rgb` 55, `--white-35` 55, `--white-55` 55, `--hud-surface` 48. All 30 of these **are**
remapped — the heavy hitters are safe; the gaps live further down the tail.

---

## 3. Global classes

Counted across all admin TSX (className string matches, word-bounded):

| Class | Uses | Colour source | Follows warm remap? |
|---|---|---|---|
| `.btn` | 567 | `background: var(--white-10)` etc. (base) | Yes |
| `.btn-ghost` | 251 | Tokens only | Yes |
| `.btn-lime` | 102 | Tokens; **plus a warm-specific override already exists** (`globals.css:1140`) | Yes (and already re-skinned) |
| `.btn-outline` | 82 | Tokens; **warm override exists** (`:1169`) | Yes |
| `.badge` (+ variants) | 82 | Mixed — see below | Mixed |
| `.btn-primary` | 64 | Tokens; **warm override exists** (`:1155`) | Yes |
| `.btn-danger` | 38 | `rgba(var(--danger-rgb),0.25)` on hover — token-rgb | Yes |
| `.hud-label` | 34 | Token | Yes, but see §5 (mono/uppercase HUD identity, not just colour) |
| `.form-input` | 137 | Tokens | Yes |
| `.form-label` | 107 | Tokens | Yes |
| `.card` | 227 | Base is token-driven, but `.card:hover` border-color is `var(--primary)` (org colour — R1 target) and its `box-shadow` pulls `--highlight-top`/`--glow-sm`, **neither remapped** (§2c) | **Partial** |

Badge variants found: `badge-danger`, `badge-info`, `badge-neutral`, `badge-primary`, `badge-success`,
`badge-warning`. `.badge-success/-warning/-danger` mix a token-driven `color` (`var(--success)` etc.,
remapped) with a **literal** `rgba(…,0.12)` background and a **literal** `rgba(…,0.3)` border
(`globals.css:1601-1603`) — the wash tint itself will not shift with the theme (visually this is
probably tolerable; a light tint reads fine on both grounds, but it is not "token-driven" as asked).
`.badge-info` is fully token-driven (`rgba(var(--info-rgb),…)`). **`.badge-primary`/`.badge-purple`
is the one worth a flag**: its background is `var(--primary-faint)` (org token, **not** remapped) and
its text is `var(--primary-light)` (**is** remapped, to olive) — under the marker these two halves of
one badge would decouple, pairing an org-coloured wash with olive text. That pairing needs a decision
in the Phase 1 mockup, not just a mechanical remap.

---

## 4. Pattern → kit map

| Admin pattern | Kit component | Fit |
|---|---|---|
| Page header (icon + title + subtitle) | `CoachPageHeader` (`components/coaches/CoachPageHeader.tsx`) | Good — but the kit's ruling is **NO subtitle slot** (2026-08-11 ruling, binding); admin pages that currently print a subtitle line will need to relocate that text (into the body, a card, or a title chip) rather than getting a like-for-like port. |
| Tile/door grid | `CoachCard` / `CoachDoorCard` (`components/coaches/kit`) | Good |
| Card | `CoachCard` (kit) | Good |
| Data table (narrow record lists) | `CoachRowList` / `CoachRow` / `CoachRowBand` + `docs/agents/design/TABLE_AND_LIST_STANDARD.md` | Good |
| **Dense multi-column financial table** (ledger, budget-vs-actual, member audit) | Same standard, **untested at this density** | **Confirm, don't assume.** The standard was drawn for coach-portal record lists (roster rows, schedule rows); BVA/ledger tables are wider and more numeric. Needs its own mockup pass against a real dense table, not a rubber-stamp. |
| Status badge | `.badge-*` global classes (see §3) | Partial — badge-primary pairing needs a decision |
| Primary/secondary/danger/ghost buttons | `.btn-lime` / `.btn-ghost` / `.btn-danger` / `.btn-outline` global classes | Good, and cheapest — warm skins already shipped |
| Modal/dialog (incl. `FeedbackModal`, confirm dialogs) | `CoachModalHeader` + the coach dialog/sheet floor (`useDialogFloor.ts`) | Good for the header row; `FeedbackModal.module.css` is already in the token gate's **`shared`** scope (§5), i.e. cross-shell by design — confirm it, don't rebuild it |
| Form fields and selects | `.form-input`/`.form-label` globals + `SingleSelectDropdown`/`MultiSelectDropdown`/comboboxes (`components/coaches/*Combobox.tsx`) | Good |
| Tabs and filter pills | `CoachTabBar` | Good, though `CoachTabBar` is built for a **fixed small tab set** (Money hub, Insights) — an admin filter-pill row with dynamic/many values may not fit its scroll-and-arrow contract as-is |
| Empty state | `CoachEmptyState` | Good |
| Access-denied wall | `CoachNotGranted` | Good — and its whole reason for existing (11 pages each phrasing a refusal differently) is exactly the kind of drift admin has too |
| Toasts/feedback | `FeedbackModal` (shared scope already) | Good |
| Collapsible card | `CoachCollapseSection` | Good |
| Export menu | `CoachExportButton` | Good |
| Sidebar nav | `CoachesSidebar` | **Partial — see GAP list** (single-team scope) |
| Phone bottom nav + More sheet | `CoachesBottomNav` (4 primary tabs + More sheet, `components/coaches/CoachesBottomNav.tsx`) | Good pattern match for the *shape*; admin's More sheet needs the same one-list-item-per-module discipline the coach nav already enforces |
| Tournament switcher | *(admin already has one — `AdminSidebar`/`AdminBottomNav` reference a switcher today, per plan §3 Phase 1b "keeps its switcher")* | N/A — not a kit gap, an admin-native pattern to restyle in place |
| Date/time pickers | Native `input[type=date/time]`, themed via the warm block's own calendar-picker-indicator rules (`globals.css:1694-1730`) | Good — **not a component gap**, but those rules are scoped under `[data-coach-warm-enabled]` too, so admin gets them "for free" only once it carries the marker |
| Charts | `components/charts/*` (`Sparkline`, `SeasonTrendChart`, `MonthlyAttendanceChart`, `DevelopmentProgressChart`) | **Not used anywhere in admin today** (confirmed by grep — zero admin imports of any of the four). Admin has no chart usage to migrate *from*; any admin screen that later wants a trend line has a ready-made, already-themed component to reach for. |

### GAP list

1. **Multi-program desktop rail** — CONFIRMED absent. `CoachRail` (kit) is a list of *rows inside one
   team's content* (a stat + a coloured dot per row), not a switcher between peer programs. The admin
   needs to move between Rep Teams / House League / Tournaments / Accounting / Organization — a
   different shape than anything in the kit.
2. **Settings switch row** — CONFIRMED absent, in *both* admin and the kit. Grepped for `role="switch"`
   and any `SwitchRow`/`ToggleRow` component across `components/coaches/**`: zero hits. Neither side
   has this solved.
3. **Plan-and-capacity card** — CONFIRMED absent. `UpgradeSummaryBanner` (kit) is the nearest relative
   but it's an upgrade-CTA banner, not a capacity/plan-limits display.
4. **Role/permission matrix** — CONFIRMED absent anywhere in the kit.
5. **Tournament event header in kit form** — CONFIRMED absent; `AdminEventHeader` has no kit
   equivalent (the coach portal has no multi-day "event" concept — a team plays in tournaments, it
   doesn't run one).
6. **Dense multi-column admin data table** — see the table row above: the *standard* exists but has
   never been proven against a wide financial grid; treat as an open question for the mockup session,
   not a settled "yes."
7. *(New, found during this pass, not in the plan's first list)* **A themed "scrim"/overlay tint.**
   `--black-20/-30/-40` have zero warm answer (§2c) and 18 combined uses — any admin overlay/backdrop
   built on them needs either a new warm value or a swap to an existing themed token.

---

## 5. Surprises

- **A raw-colour gate already exists and is already wired into `verify:changed`** —
  `scripts/check-public-tokens.mjs`, `operator` scope, covers `app/[orgSlug]/admin`,
  `components/admin`, `components/accounting`, `components/charts`, plus the coach/scorekeeper/
  platform-admin trees, and runs via `npm run check:tokens` / inside `verify:changed`
  (`package.json:14`). **But it is narrower than Phase 1 needs**: by its own header comment it flags
  (1) any literal hex and (2) only `rgb()/rgba()` triples that numerically match a `--*-rgb` **brand**
  token — it deliberately does *not* flag arbitrary `rgba()/hsla()` literals (white/black alphas,
  one-off tints), which is exactly the bulk of the 812-literal count (769 of 812 are the excluded
  `rgb/rgba/hsl` family, only 43 are hex). Its current baseline for `operator`
  (`scripts/.operator-token-baseline.json`) is a literal `{}` — zero violations — because the admin
  hex that does exist is either tokenized or annotated `/* token-exempt: reason */` already (e.g.
  `accounting.module.css:4`, `help.module.css:1770`). **Phase 1's "admin raw-colour gate" bullet
  should extend this existing script's rule set, not build a parallel one** — and needs to decide
  whether the white/black-alpha family it currently excludes should now be in scope, since that
  family is precisely where the ramp gaps in §2c live.
- **The org's `data-card-style` setting already reaches into every admin `.card`.**
  `app/[orgSlug]/layout.tsx:168` sets `data-card-style={org.themeCardStyle ?? 'default'}` on the
  whole `[orgSlug]` tree — admin included, since admin nests inside that layout. `globals.css`'s
  `[data-card-style="glass"] .card` rule (`:1414`) is a **literal** `rgba(26,21,48,0.4)` translucent
  dark panel with `backdrop-filter: blur`. Any org that picked the "glass" or "outlined" public card
  style today gets that same variant on **every one of its admin's 227 `.card` uses**, unrelated to
  dark/warm at all. R1 talks about `--primary`/`--border`/`--glow*` leaking from the org; this is a
  second, structural leak (a whole card *recipe* variant, not just a colour) that the plan doesn't
  currently name. Phase 1 needs an explicit decision: admin should not inherit `data-card-style` at
  all, which likely means scoping that selector to exclude the admin subtree or giving the admin
  shell its own `data-card-style="default"` override.
- **Admin's "HUD" identity is a typeface choice, not just a colour scheme.** `--font-data` (`var(
  --font-mono, 'IBM Plex Mono'), monospace`, `globals.css:649`) is read 561 times across 47 admin
  files — the single most-used custom property in the entire admin surface. The kit's own uppercase-
  eyebrow convention (`--type-label`, `CoachKit.module.css:96-109`) is uppercase + letter-spaced but
  **not monospace** — it rides whatever the surrounding proportional font is. Converting admin's
  colour tokens will leave every one of those 47 files still reading as a data-console. Whether the
  admin keeps a monospace "readout" feel for numbers/scores or moves fully to the kit's proportional
  ladder is a real design call for the Phase 1 mockup session, independent of theming.
- **One admin screen is not CSS Modules at all.** `app/[orgSlug]/admin/tournaments/rules/
  RulesAdmin.tsx:962-1109` is a ~147-line `<style jsx global>` (styled-jsx) block, not a
  `.module.css` file — it is almost entirely token-driven already (0 raw hex, 1 raw `rgba()`), so it
  isn't a colour problem, but it sits outside the file-extension-based tooling (mine and, likely,
  `check-public-tokens.mjs`'s per-file scanning) and is worth a manual confirmation pass rather than
  assuming the automated gate sees it the same way it sees a `.module.css` sibling.
- **Scorekeeper/gate runs its own, wholly separate palette.** `scorekeeper.module.css:10-12` defines
  `--sk-ink`, `--sk-ink-dim`, `--sk-ink-faint` (plus `--sk-bg`, `--sk-bg-deep`, `--sk-amber`,
  `--sk-red`, `--sk-warm`, `--sk-lime-tint` elsewhere), each individually `token-exempt`-annotated,
  with **zero connection** to the shared `--white-NN`/`--home-*` ramp. R3 makes this simpler than it
  looks, though: scorekeeper is warm-only (no dark toggle to support), so this is "author one new
  palette," not "remap an existing one under two themes."
- **Blueprint/grid decorative backgrounds are rare, not pervasive.** A first grep for "blueprint" hit
  nearly every admin stylesheet, but that was almost entirely `var(--blueprint-blue)` (a colour
  token) matching the word, not an actual grid-pattern background. Narrowing to real
  `background-image: linear-gradient(...)`/`radial-gradient(...)` decorative fills found exactly six
  files (`families.module.css`, `ScheduleTimeline.module.css`, `settings-access.module.css`,
  `staff-kit.module.css`, `AdminContextStrip.module.css`, `TournamentStyleCards.module.css`) — a
  small, enumerable list, not a portal-wide texture to strip.
- **No third-party chart widgets, no baked-in-dark images, no `fill="#hex"` SVGs found in admin** —
  each was checked (`recharts`/`chart.js`/`d3` imports: zero; `<svg … fill="#…">` literal: zero). Not
  claiming certainty from a static grep (an SVG could set fill via a CSS rule the regex didn't target,
  or import a `.svg` file whose colours live inside the asset itself) — worth a visual spot-check in
  the mockup session, but nothing surfaced as a known landmine here.
- **PDF/email builders are confirmed separate.** `lib/export/*`, `lib/email.ts` and friends build
  their own styled strings independently of both the admin's CSS Modules and the kit; the plan's
  "out of scope" list already names PDFs/exports/emails, and nothing found here contradicts that —
  admin screens do not share styling code with the export/email builders.

---

## 6. Suggested order for Phase 1

Grounded in the numbers above, cheapest-and-lowest-risk first:

1. **Frame/shell + Families + Public Site editor** — the three smallest surfaces (16, 4, and 3 files;
   34/7/17 raw literals). Families and Public Site editor both show **zero literal-colour inline
   style blocks** — everything there is already token-driven CSS, which means the work is close to
   "flip the marker + fix the handful of `--white-25`/`--black-*`/`--highlight-top` gaps" rather than
   a line-by-line rewrite. A natural pilot for proving the marker mechanism end-to-end before
   committing to the bigger areas.
2. **Buttons and badges, portal-wide, as their own slice** — not an "area" but a cross-cutting win:
   `.btn`/`.btn-ghost`/`.btn-lime`/`.btn-outline`/`.btn-primary` (1,066 combined uses) already have
   warm CSS shipped and scoped to the marker; the only remaining work is the `.badge-primary`
   text/background pairing decision (§3) and confirming the badge wash tints read acceptably on
   cream (§3, likely fine, needs a look not a rebuild).
3. **Hub/Onboarding, Organization, House League** — medium-sized (4–20 files, 55–137 literals each),
   and Organization is the natural home for R1's brand-token removal work anyway (it carries the
   heaviest concentration of `--primary`/`--primary-rgb`/`--border` reads outside Tournaments — 51
   combined occurrences).
4. **Rep Teams and Accounting** — both carry heavy **literal-colour inline-style debt** (Rep Teams:
   379 blocks, 63 with a hardcoded colour; Accounting: 149 blocks, 16 hardcoded, plus the
   highest literal-density stylesheet set at 274 raw literals across only 7 CSS files). Money screens
   are also gated by the plan's own binding rule — "every history shelf gets its own owner mockup
   session" — so Accounting should get a dedicated mockup pass regardless of sequencing here.
5. **Tournaments last among the "restyle" areas, and treated as its own sub-project inside Phase 1
   if it turns out too big for one pass** — it is the single largest surface by every measure (86
   files, 27 screens, 205 CSS literals, 857 inline blocks, the heaviest org-brand-token coupling at
   74 combined `--primary*`/`--border`/`--glow-sm` reads, the styled-jsx outlier, and the schedule/
   bracket components' SVG connector drawing). Phase 3 already plans to give tournaments its own
   project once Phase 1 lands; nothing here argues against that split — if anything it reinforces it.
6. **Scorekeeper/Gate** — small in file count (10) but **100% net-new palette authorship**, not a
   remap (§5). Cheap in effort, but schedule it as its own short slice rather than folding it into an
   "admin restyle" pass, since none of the admin remap work transfers.
7. **Help last** — the smallest *mechanical* change (drop `[data-help-surface]` from the dark-reassert
   join at `globals.css:1077-78`) but the largest **unverified surface at once**: help has never
   rendered in anything but fixed dark, so its 150 literals and 1,900-line stylesheet need a full
   visual pass the moment the toggle flips, with no prior warm rendering to compare against.

---

## Appendix A — Reproducible commands

All read-only. Run from the repo root (`C:\Users\b2cow\Documents\tournament-website`), Git Bash.

```bash
# Screens (page.tsx) and stylesheets under the admin tree, matching the plan's own scope exactly:
find "app/[orgSlug]/admin" -name "page.tsx" | wc -l                      # -> 86
find "app/[orgSlug]/admin" -name "*.module.css" | wc -l                  # -> 33
find "components/admin" -name "*.module.css" | wc -l                     # -> 21   (33+21 = 54)

# Raw colour literals in that same 54-file scope (hex, then rgb/rgba/hsl/hsla EXCLUDING var()):
FILES=$(find "app/[orgSlug]/admin" "components/admin" -name "*.module.css")
grep -ohE '#[0-9a-fA-F]{3,8}' $FILES | wc -l                              # -> 43
grep -ohE '\b(rgba?|hsla?)\([^()]*\)' $FILES | grep -v 'var(' | wc -l     # -> 769   (43+769 = 812)

# Inline style={{ blocks in that same scope's TSX:
FILES=$(find "app/[orgSlug]/admin" "components/admin" -name "*.tsx")
grep -oh 'style={{' $FILES | wc -l                                        # -> 1868

# Tournament screen count within the 86:
find "app/[orgSlug]/admin/tournaments" -name "page.tsx" | wc -l           # -> 27

# Warm-block remapped token names (the marker's own definition block):
awk 'NR==809,NR==1047' app/globals.css | grep -oE '^\s*--[a-zA-Z0-9-]+:' | sed 's/^\s*//;s/:$//' | sort -u

# Marker presence check on the admin shell (expect: only the inert AdminSkeleton hit):
grep -rn "data-coach-warm-enabled" "app/[orgSlug]/admin" "components/admin"

# Existing raw-colour gate scope + baseline:
sed -n '1,120p' scripts/check-public-tokens.mjs        # SCOPES.operator config
cat scripts/.operator-token-baseline.json              # {}  (zero current violations, by ITS rules)

# data-card-style leak:
grep -rn "data-card-style" app --include="*.tsx"

# --font-data (monospace HUD) reach:
grep -rl -- "--font-data" "app/[orgSlug]/admin" "components/admin" --include="*.css" | wc -l   # -> 47
```

For the fuller per-area breakdown in §1 (which reaches beyond the 54/86-file plan scope into
`components/accounting`, `components/help`, `components/charts`, and the scorekeeper/official/
check-in routes), a small read-only Node script (`measure.mjs`) walked the repo once, built one file
set per area from explicit directory/file lists, and applied the same hex/`rgb()`-family regexes plus
a balanced-brace extractor for `style={{…}}` blocks. The script and its raw JSON output are session
scratch files (not part of this repo) and are reproducible from the commands above plus the area
definitions in §1's footnotes; nothing in the script wrote to any project file.
