# Warm Coaches Portal & App-Wide Theming — Exploration Analysis

**Status: EXPLORATION COMPLETE — no production code written. Awaiting owner ratification of a scope.**
Source prompt: `WARM_COACHES_PORTAL_AND_THEMING_EXPLORATION_PROMPT.md` (same folder).
Companion: `WARM_COACHES_PORTAL_AND_THEMING_PM_BRIEF.md` + the ratification mockup artifacts:
Round 1 (ratified direction, TH-2): `https://claude.ai/code/artifact/f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e`
Round 2 (hard frames, RATIFIED 2026-07-21 = TH-5): `https://claude.ai/code/artifact/bb6c9b81-6148-4808-aa52-288ec993409f`
Build plan unlocked by TH-5: `WARM_PORTAL_THEME_OPTION_PLAN.md` + `_PM_BRIEF.md`

Method: 27-agent exploration (5 recon readers over the portal inventory, theming machinery, token
debt, prior-art traps, and the built warm vocabulary → 3 workstream analysts → adversarial
verification of 18 load-bearing claims → completeness critic). **7 claims were refuted and the
corrections are folded in below** (see §8 Corrections log) — including three that changed analyst
sequencing logic, so the recommendations here are the *post-correction* versions.

---

## 0. Executive summary & the reconciled critical path

**The three workstreams are one project in disguise.** They share a single prerequisite — closing
the operator-surface token debt and reconciling the platform's duplicate brand token — and a single
architectural decision (the user-theme vs org-brand precedence model) that gates everything else.

**Recommended critical path (each step independently shippable):**

| # | Step | Owner workstream | Size | Blocked by |
|---|------|------------------|------|-----------|
| 0 | Ratify the theme contract: precedence model **M2** + a new `data-user-theme` root attribute (design-decision entry, no build) | B | XS | owner call |
| 1 | Reconcile `--blueprint-blue` → derive from `--primary`; extend the token ratchet to operator segments (new roots + separate operator baseline — small script work, **not** a pure config flip) | C (P1) | S (~2–3 days) | nothing — do first |
| 2 | Consumer-shell **Dark⇄Warm toggle** (picker on Account, account-level persistence + localStorage fast path, no-flash root script, dynamize the warm route check) | B (T0) | S | 0; needs a small user-pref storage decision (flag to `/db`) |
| 3 | Operator debt closure: mechanical swaps (~137 fixes) then judgment tranche (~60–80 decisions) | C (P2–P3) | M–L | 1 |
| 4 | **Warm operating coaches portal — built AS the toggle's warm mode** behind `[data-user-theme="warm"]`, never as a permanent one-off reskin. Incremental order: chrome → CLEAN display surfaces → dense-table primitives (built once) → Schedule/Lineups last | A | XL (~27–29k lines in scope) | 0, 1, 3 (partial), its own mockup round |
| 5 | Light theme leg (net-new design) + runtime platform brand editor (clone of the shipped org editor) | B / C | M / S–M | 2 / 3 |

**Direct answers to the owner's four questions** are in §1. The headline: **yes, the theme toggle
(B) supersedes a one-off warm portal (A)** — warm becomes one selectable theme, and A's build is the
CSS that makes that option real on the coaches surface. Building A first as a permanent reskin
means redoing ~28k lines of work the moment a toggle needs it conditional.

---

## 1. Direct answers to the owner's open questions

**Q1 — Sequencing: is the warm operating portal a "next" or a "someday"? Does the toggle supersede it?**
The toggle supersedes it. Recommendation: warm-portal is a **"later, via the toggle"** — decide the
theme contract now (step 0), ship the cheap consumer toggle (step 2), and build the warm portal as
that toggle's coaches-scoped warm mode once operator debt is closed. The standalone business case
for a permanent warm reskin is weak: S1-2 warmed the sign-up journey because first impressions
drive conversion; the operating portal's job is operational trust during dense, repeated use —
exactly what the dark data-dense language was chosen for — and nothing surfaced shows it is a
retention pain point today. As a *theme option*, though, coach choice costs nothing extra beyond
the CSS A was going to write anyway.

**Q2 — When user theme and org brand conflict, which wins?**
**Org brand wins on org-branded surfaces; the user's theme never reaches them (model M2).**
Org-branded public surfaces (tournament pages, org home, public team pages) opt out of the personal
toggle entirely; the toggle governs only platform-neutral chrome (consumer shell, coaches portal,
eventually admin). This generalizes two decisions already ratified: R1-2 ("walking into the venue"
— org theming stays fixed regardless of the visitor's shell state) and the nav-merge neutral-bar
rule. It is also the only model that is safe *by construction*: the org-driven `data-color-mode`
mechanism verifiably never activates outside tournament/preview routes today, so the two
authorities' domains never overlap — no runtime "who wins" logic to get wrong (this codebase has
three documented regressions from exactly that dual-authority failure class).

**Q3 — Toggle scope: consumer app only, or everywhere?**
Phased: **consumer shell first** (warm already exists end-to-end there; Dark⇄Warm is small),
**coaches portal second** (once A's warm CSS exists behind the attribute), **admin deferred
indefinitely** (largest debt, internal audience, lowest value per cost), **scorekeeper excluded**
(not because it can't be tokenized — 48% of its literals map straight onto existing tokens — but
because many scorekeeper sessions are guest links with no account to carry a preference),
**org-branded public pages never** (per M2).

**Q4 — How important is runtime-editable branding vs code-time?**
**Low urgency, real option value — do not build now.** The org-level brand editor already ships
(preset swatches + custom pickers + live preview, plan-gated). A platform-level clone is only
S–M work *after* debt closure — but the platform brand rarely changes, and an editor shipped today
would be false advertising: it would visibly miss the ~200+ hard-coded operator-surface colors and
everything keyed to the duplicate `--blueprint-blue` token. The durable value is in the debt
closure itself (which A and B also need). Revisit the editor once C-P3 is substantially done.

---

## 2. How theming actually works today (verified mechanism map)

Three theme layers coexist, all server-driven, **zero user/device persistence anywhere**:

1. **Platform dark** — `app/globals.css` `:root` (dark is the design target). Note the platform
   brand blue exists as **two independently-declared tokens with coincidentally identical values**:
   `--primary`/`--primary-rgb` (line ~22, org-overridable) and `--blueprint-blue`/`-rgb` (line ~307,
   "additive platform tokens" block). Nothing derives one from the other. `--blueprint-blue(-rgb)`
   is consumed **887 times across 70 source files** (`coaches.module.css` alone: 101 refs — the
   entire coach-portal accent system) and the per-org override never touches it.
2. **Per-org / per-tournament brand** — `resolveTheme()` (`lib/themes.ts`) → inline `:root` style
   injection on the `[orgSlug]` / tournament layout wrappers. Writes only the `--primary` family +
   `--border`/`--glow`/`--on-primary` (+ opt-in font vars). `--logic-lime` has **no override path
   at all** — per-org brand is a one-hue (blue-slot) system. Org/tournament DB columns:
   `theme_preset/theme_primary/theme_accent/theme_font/theme_card_style` (+ tournament-only
   `color_mode`, plan-gated behind `advanced_tournament_branding`).
   Light mode = `buildPublicLightModeCssVars()` injected at `:root`, **only ever on tournament
   public/preview routes** (5 setter sites, all tournament-scoped; the org home page never sets it —
   its ~15 light-mode CSS rules are currently dead).
3. **Warm consumer skin** — additive `--home-*` tokens (`components/consumer/warmTheme.module.css`):
   `.warmVars` (tokens only — the shared nav) vs `.warm` (tokens + paper ground). Activated by a
   **pure static route-prefix check** (`isWarmSkinPath`, `lib/consumer-routes.ts`) — no DB, no
   localStorage, no account condition. ~11 live `composes: warmVars` mounts + one confirmed dead
   mount (`app/team/page.module.css`, orphaned after the route became a redirect).

**Warm propagation mechanics (corrected during verification):** the warm tokens are additive, but
`.warm` sets ordinary `background`/`color`, and **`color` inherits** — a bare descendant inside
`.warm` renders warm ink automatically. Coverage gaps occur only where a component carries its own
explicit dark declarations (e.g. `background: var(--surface)`, `color: var(--white-45)`), which is
most real components. The proven fix is the **scoped token remap** (`ChatPanel.module.css`
`.panelWarm`: one block remaps 23 dark tokens onto `--home-*` equivalents + 4 surgical selector
overrides), whose current dictionary lacks only `--surface` and `--data-gray` for the shared
primitives sampled. So "promote warm to a full theme" = a widened remap dictionary applied per
shell + hand-edits for literals — not a from-scratch parallel token system.

**The only user-preference precedent** is the admin density toggle: per-device localStorage +
a no-flash inline script in the ROOT layout (nested layouts re-create scripts on client nav — the
comment explains why root-only). Its manual UI was **removed** because the change was imperceptible
("a toggle that produces no perceived change has negative UX value") — the bar a theme toggle
clears easily, and the exact plumbing pattern it should reuse. (Housekeeping: the exported
`DENSITY_NO_FLASH_SCRIPT` constant in `lib/admin-density.tsx` is dead — the live script is a
hand-copied literal in `app/layout.tsx`; a theme script should consolidate, not add a third copy.)

---

## 3. Workstream A — warming the operating coaches portal

### 3.1 What the portal actually is (two portals, one name)

- **FREE Basic portal** — `app/coaches/team/[basicTeamId]/**` behind `CoachPortalShell`
  (485/554 lines, CSS is **zero-hex token-clean** — the best-positioned shell for a remap).
  Progressive disclosure (Tier-2 sections appear after "Turn on"). Hosts the ONLY warm-inside-dark
  content today: the three S1-2 bounded inserts (`ScopeShelf`, `ScopeCeilingInterest`,
  `CoachExploreCatalog` premium block) via `composes: warmVars` + own paper ground + deepened shadow.
- **PAID Premium portal** — `app/[orgSlug]/coaches/teams/[teamId]/**` (15 sections) behind
  `CoachesSidebar`/`CoachesBottomNav`, all styled from **one 3,975-line `coaches.module.css`**
  imported by 32 of 35 team pages + 11 shared components (7× the next-largest CSS module — the
  single highest-leverage AND highest-risk artifact in any warming project). Zero warm content by
  design. Notably: **no blueprint-grid / hud-panel texture anywhere in either portal** (grep-zero)
  — the "blueprint grid" framing in the prompt applies to admin, not the coaches portal.

### 3.2 Per-surface warm-ability (full table)

Verdicts: CLEAN = token remap once the dictionary is widened · NEEDS-NEW-PRIMITIVES = blocked on
missing warm vocabulary · TRAP-RISK = a partial pass reproduces the `/account/notifications` bug.

**Shared chrome (must land first):**

| Surface | Density | Verdict | Size | Notes |
|---|---|---|---|---|
| `coaches.module.css` (3,975 ln) | — | TRAP-RISK | XL | 17 raw hex + 328 rgba; needs a real pass + widened remap dictionary (`--surface`, `--surface-2`, `--border`, `--data-gray`) |
| CoachesSidebar (223) | DISPLAY | CLEAN | S | remaps once chrome dictionary exists |
| CoachesBottomNav (263/158) | DISPLAY | TRAP-RISK | M | confirmed literals: `#0d111a` sheet ground, `rgba(0,0,0,.65)` shadow, `#f87171` logout row — hand-edits, no remap reaches them |
| CoachPortalShell (485/554) | DISPLAY | CLEAN | S | zero hex |

**Paid team pages:** Overview (1,115, MIXED, NEEDS-NEW-PRIMITIVES, L — 6 card families) ·
Roster + player profile (849+676, DENSE, NEEDS-NEW-PRIMITIVES, L — dnd-kit reorder has zero warm
precedent; recurring `#0f1123` on-lime CTA literal) · **Schedule (2,523 — TRAP-RISK, XL**: literal
`EVENT_COLORS` hex map reused at 10+ call sites, win/loss/tie hex in TSX, only 4 `var()` uses in
the whole file; calendar grid + slide-over + multi-step modals — the highest-probability half-warm
repeat in the project) · Money hub (484, CLEAN, M) · **Dues (1,334, TRAP-RISK/NEEDS-PRIMITIVES, XL**
— 20 inline hex, ledger table + refund calculator + player modal; the missing warm ledger
primitive) · Budget (1,037/565, L) · BVA (718/457, M–L — `CumulativeChart` unaudited, flag for a
spike) · Expenses (732, M) · Fundraisers (292+477, M) · Payment-requests/Allocations (442/269, S/M)
· Announcements (50, S) · Attendance (154, CLEAN, S) · Chat (35 + shared `CoachChatView`, **see
carve-out below**) · Development (223+179+316, L) · Documents (291, CLEAN, S) · History/Insights
(473 + 5 reports, CLEAN, M) · **Lineups (548+587+534+185, TRAP-RISK, XL** — drag-sortable batting
order + per-inning grid; zero warm drag-and-drop precedent anywhere in the app) · Settings (327,
CLEAN, M) · Staff (60, S) · Tournaments (116+32, CLEAN, M) · **Tryouts (138+35 — carve-out**:
sunlight/outdoor legibility is an orthogonal hard constraint; own decision regardless of theme).

**Free team pages:** Overview/TeamHQ (290 + 513/629, CLEAN-ish, M — already coexists with a live
warm insert today) · Roster/Schedule editors (506/382, 427/360, M) · Fees (665/658, M — small
ledger gap) · Announcements (256/469, S) · Chat (33, shared) · Tournaments (99+…, M) · Explore
(36+184/279, S — premium block already warm).

### 3.3 The core tension, resolved

**Position: the unit that goes warm-or-not is the whole coaches identity** — chrome + every
team-scoped page in BOTH tiers — never a route-by-route slice. The half-warm trap bites *within one
rendered surface* (the documented failure: a global dark table reset painting a `--surface-2`
header over a warm `thead`), and its UX cousin bites *within one tool* (Roster/Schedule/Dues are
tabs of one continuously-used tool; temperature flicker on every tab reads as unfinished). Theme
changes at a *navigation identity boundary* are already accepted platform language (R1-2,
admin↔coaches↔public are separate identity contexts today).

**Stays outside the boundary:** admin console (separate identity + own 211-literal baseline),
scorekeeper (shared-device, single-purpose, often account-less), public tournament pages (binding
R1-2 — not revisitable here).

**Two carve-outs decided separately, not silently folded in:**
- **Tryouts / day-of field surfaces** — glare legibility (solid fills, bold weight, never
  color-alone; pale warm tints fail in sunlight) is an accessibility floor on TOP of any theme.
- **Coach Chat** — correction from the verify pass: warming coach chat is **not** free and **not**
  merely technical. The `.panelWarm` remap exists but is consumer-variant-only **by ratified
  decision** (R3-3: "rooms opened inside the coaches portal or admin keep those shells' existing
  chat skin"), and `CoachChatView`'s own 249-line chrome is un-warmed. If the portal's whole
  identity goes warm, the shell's skin IS warm and R3-3's per-shell rule is *satisfied*, not
  violated — but that reading must be ratified explicitly, and the CoachChatView chrome pass
  scoped in (S–M, not zero).

### 3.4 Per-team brand color coexistence

**There is no live team-brand theming in the paid portal today** — settings has no color control;
the three color mechanisms that exist (admin-assigned `rep_teams.color` shown only as list-row
swatch dots; name-hash `teamColor()` identity accents in the FREE tier; a separate name-hash for
roster avatar chips) are not coach-editable and never theme a page. The stored team hex is
"verbatim, no validation" — an admin can store near-white today. Proposed precedence rule for warm
(also fixes latent dark-mode risk):

1. **Ground never changes** — team color is an identity layer (borders, hero band, monogram,
   chips), never a surface recolor. Matches the existing `color-mix` accent architecture.
2. **Fills need a near-white guard** on warm (white cards): defensive `1px solid
   var(--home-line-strong)` border, or fall back to the hashed color above ~L92%.
3. **Team color as text follows a generalized E3 rule** — clamp lightness toward the olive band on
   paper (raw lime→olive is the precedent); `teamInk()` is tuned for content-ON-a-fill, not
   color-as-text-on-paper, and cannot be reused as-is (verified, including the math).
4. **Hue-exclusion band near live-red** (`--home-live`) so a team's brand red is never misread as
   a live/error signal — same defensive pattern as `teamColor()`'s existing lime-band exclusion.
5. **Consolidate the guards first**: `onPrimaryColor()` (themes.ts) and `teamInk()` (team-color.ts)
   are two hand-synced duplicates already; a third would compound the anti-pattern. One shared
   `contrastGuard(color, ground)` before any of this ships.

### 3.5 Effort & recommendation (A)

**Total in scope ≈ 27,000–29,000 lines** (~25× the S1-2 journey). Composition: ~15% foundational
chrome (highest leverage + highest risk in one artifact) · ~35% pure token remap · ~30% new
primitives built once and reused (the dense-table/ledger family across ~6 surfaces) · ~20%
structural TRAP-RISK (Schedule, Lineups/DepthChart, BottomNav literals) where risk concentrates far
beyond its line share.

**Recommendation: do not build as a standalone permanent reskin.** Build it — if and when the owner
wants it — as the toggle's warm mode behind `[data-user-theme="warm"]` (Step 4 of the critical
path), after C-P1 and with C-P2/P3 running just ahead. Incremental order that never leaves a
half-warm state visible *within the warm mode*: chrome → CLEAN display surfaces → dense-table
primitives once → Schedule + Lineups last (each gated on its own design spike), Tryouts and Chat as
explicit carve-out decisions. Every increment is one atomic per-surface pass — ground + cards +
inputs + tables + banners + CTA together (the S1-2 checklist), auditing for global dark resets that
bleed through.

### 3.6 Mockup requirements (ratification round)

The prompt's minimum (Overview/Roster/Schedule/Dues × mobile+desktop, NEW/RESTYLED/UNCHANGED
labels) **plus the hard frames, or the round ratifies only the cheap 80%**: Schedule's modal +
calendar states, one zero-precedent primitive (Lineups drag grid or Depth Chart board), the
team-color stress test (near-white + near-live-red), the BottomNav "More" sheet (hard-coded today),
and a boundary frame (warm portal → dark admin/tournament handoff). The published mockup artifact
covers the minimum set + picker/themes + the stress strip; the hard frames are called out inside it
as a required follow-up round before any build ratification is final.

---

## 4. Workstream B — user-selectable themes

### 4.1 Feasibility tiers

- **T0 — consumer shell, Dark⇄Warm: S.** Warm is already end-to-end on all five consumer routes;
  the work is plumbing only (picker, persistence, no-flash script, dynamize `isWarmSkinPath()` —
  verified pure/static today with no flag infrastructure nearby).
- **T0 + Light leg: M.** No neutral-light theme exists anywhere (the only light mechanism is
  org-brand-coupled and tournament-scoped). A consumer Light theme is a net-new design+build pass
  across ~8–10 modules — comparable to the original warm build. Ship Dark⇄Warm first; Light is a
  fast-follow.
- **T1 + coaches portal: L–XL, but it is Workstream A's scope.** The toggle-specific increment on
  top of A's CSS is small (attribute-gating + plumbing). ~95% of the work is shared with A.
- **T2 + admin/scorekeeper: XL, defer.** Gated on operator tokenization. Correction from the verify
  pass: scorekeeper is *more* tractable than first analyzed — 48% of its 58 literals map exactly
  onto existing tokens (mechanical remap + a few new semantic tokens, the same sweep pattern this
  repo has executed on other files), so T2's cost is real but overstated by "needs a rewrite."
  The scope call stands anyway on audience/value grounds (guest-link sessions, internal admin).

### 4.2 Mechanics

- **Persistence: account-level source of truth + localStorage fast path.** No user-preference
  storage exists anywhere today (verified: no users/prefs table; the user-keyed table *pattern*
  exists via notification prefs). A minimal theme-preference field is a prerequisite migration —
  **flag to `/db` at build start** (small; single column or minimal prefs table; decision owner:
  `/db`, timeline: before T0 ships). No-flash: the proven root-layout inline-script pattern
  (density), reconciling account value post-fetch.
- **Application: a NEW `data-user-theme` attribute on `<html>`** — never reuse `data-color-mode`
  (org authority), never a class. Because the org mechanism verifiably never fires on the toggle's
  domain, single-authority-per-token holds architecturally. One injection point per theme; no
  second `:root`-equivalent block may re-declare the same properties (three documented regressions
  from that failure class: next/font dev/prod font swap, muted-text 2.6:1, gold-strong ordering).
- **Complete token sets: the widened-remap route, not a parallel token system.** Corrected
  mechanism per §2: `[data-user-theme="warm"]`-scoped remap of the dark base tokens onto `--home-*`
  values per shell + hand-edits for literals. "Complete" = the remap dictionary covers every base
  token the shell's components consume (audit per shell; current known gaps: `--surface`,
  `--data-gray`) + zero surviving literals (C's ratchet extension enforces this going forward).
- **Contrast machinery per theme**: every accent used as text needs its `-strong`/ink companion
  audited per ground (E3 lime→olive; gold→gold-strong precedents). `--blueprint-blue` has no
  light/warm-safe text variant today. Consolidate the duplicated luminance guards first (§3.4-5).
- **PWA status-bar chrome**: `theme-color` meta is a single static dark value; a Light/Warm user
  would keep a dark Android status bar unless the meta becomes dynamic — small, but scope it into
  T0 rather than discovering it at QA.

### 4.3 Precedence models (the load-bearing decision)

- **M1 — user theme governs neutral chrome, org accents survive on top.** Plausible later; today it
  requires a new org-accent × 3-grounds contrast validator (org accents are only validated against
  dark). Medium extra effort, real untested-combination risk.
- **M2 — org-branded surfaces opt out of the toggle entirely (RECOMMENDED).** Zero collision by
  construction; generalizes R1-2 + the neutral-bar decision; lowest effort. Nuance from the verify
  pass: on the *coaches portal* M2 is about scope (the toggle governs it because it is
  platform-neutral chrome), and note the portal's accent system rides `--blueprint-blue`, which
  per-org branding never touches — after C-P1 aliases it to `--primary`, org accents would begin
  reaching coaches chrome for custom-branded orgs. **Rider to ratify with M2: whether coaches-portal
  accents should follow org brand (post-alias behavior) or stay platform-blue (pin the portal to a
  platform token).** Flagged, not silently decided.
- **M3 — org brand auto-derived across themes.** Decline for now: unbounded color-science risk
  (hue-preserving warm/light variants of arbitrary org hexes), no ratified backing, needs preview
  tooling + escape hatches.

### 4.4 Scope & sequencing (B)

Consumer shell now → coaches portal via A → admin deferred → scorekeeper excluded → org-branded
public pages never (M2). Decide the contract (M2 + attribute) BEFORE either workstream builds —
this repo already has one documented case of a ratified nav-skin decision silently overtaken by a
concurrent build one day later; A and B are exactly two concurrent projects sharing a surface.

---

## 5. Workstream C — branding centralization audit

### 5.1 The owner's question, answered for both brand layers

**Platform layer — "change the primary button blue": NO, one edit does not propagate today.**
Two edits are required just at the token level (`--primary` AND `--blueprint-blue` — two
independent declarations, coincidentally equal, 887 consumers on the latter that per-org overrides
and any `--primary`-only edit both miss). Beyond tokens, a rebrand would visibly miss, ranked by
exposure:

1. **`.card-glass`** — hard-coded purple-black tint (`rgba(26,21,48,…)`), org-selectable card style
   that reaches public fan pages; disconnected from every brand token.
2. **Scorekeeper** — 58 literals incl. 13 bare brand-blue/lime accents and the FieldLogicHQ
   wordmark itself hand-painted lime in its layout; in-person visibility at the scoring table.
3. **Coaches portal** — ~45 standalone literals + 22 raw brand-RGB tuple duplicates + the
   `EVENT_COLORS`/win-loss maps in TSX.
4. **Admin console** — ~125 standalone literals + 13 tuple duplicates.
5. **Transactional email** — 183 hex occurrences of 15 distinct values across ~60 template
   functions in one file (+ a small 4-color constants block in the markup helpers); email can't
   consume CSS vars — needs its own constants consolidation, not a token fix.
6. **`.btn-lime` on-color text (`#0f1123`) / `.btn-danger` raw rgba** — one file, platform-wide
   blast radius.
7. **PWA manifest / root meta / icon-generator / brand SVGs** — the near-black `#0a0a0f` is the
   *intentional* platform brand constant duplicated across ~8 build-time surfaces (a JSON route
   can't resolve CSS vars); a rebrand needs a documented manual-sync list, not "rewiring."

**Public surfaces are essentially clean** — 15 trivial literals total (`#fff`/`#000`), none
brand-related. The prior token sweeps worked; the ratchet held.

**Per-org layer: YES, works today by design** — `resolveTheme()` + one inline `:root` injection,
consistent across org/tournament/preview/OG-image call sites. Known gaps: `--blueprint-blue`
consumers ignore org brand (2 spots inside the org home page itself); `--logic-lime` has no
override path (one-hue brand system); **per-team brand has no live theming mechanism at all** —
the stored team hex drives only swatch dots while portal identity accents use a name-hash that
ignores it.

### 5.2 Phased plan to single-source

- **P0 (with P1): `--blueprint-blue` reconciliation** — alias to `var(--primary)` or inject both
  together. 2-line edit; the real cost is visual re-verification across the 887-ref blast radius
  (coaches portal + admin dashboard + chat first). Must land before P2–P4 are trusted.
- **P1: ratchet extension — S (~2–3 days, corrected from "config change").** Requires new scan
  roots (`app/coaches`, `components/coaches`, `components/admin`, `app/platform-admin`,
  scorekeeper's actual location) — the current walk never visits them regardless of the exclude
  list — plus a separate operator baseline/report so two initiatives don't conflate. Wire into
  `verify:changed`. Stops new debt immediately; blocks nothing.
- **P2: mechanical tranche — S–M (2–4 days).** ~82 exact-token hex swaps + ~55 brand-RGB tuple
  fixes ≈ 137 fixes across ~45–50 files. Scorekeeper's swaps get per-swap visual QA (its token
  matches are largely coincidental).
- **P3: judgment tranche — M–L (1–2 weeks).** ~200 standalone customs clustering into ~60–80 real
  decisions (e.g. DepthChartBoard's pinned palette is one decision: keep-documented) + 6 globals.css
  shared-class fixes. **✅ EXECUTED on dev 2026-07-21 (uncommitted; adversarially-verified zero-visual-change):
  operator baseline 365→74 literals; new global tokens `--on-lime` + `--success/warning/danger/info-light`
  (status-text tier) + platform-admin `--pa-*` console set; bespoke surfaces → component-scoped var palettes;
  owner ratified strip-dead-fallbacks + finishing the latent `--danger-light`/`--warning-light` convention
  (fixes ~7 no-fallback danger-text sites). Plan: `OPERATOR_TOKEN_JUDGMENT_TRANCHE_PLAN.md`.**
- **P4: inline-TSX sweep — L (1–2 weeks), trailing.** 258 inline hex across 63 files; highest
  regression risk (some literals feed conditional logic — `EVENT_COLORS`); doesn't block A/B's
  remap technique. The ~3,000 white/black-alpha rgba literals are separate maintainability cleanup,
  not brand-relevant.
- **Then (optional): the platform brand-settings page** — clone the shipped org editor
  (`resolveTheme()` + live `:root` preview, verified in production since the 2026-07-10 release);
  budget separately for email constants, the manifest/meta/icon sync list, and the consolidated
  contrast guard.

**Verification strategy:** ratchet `--report` as the audit trail per tranche; targeted screenshot
diffs on the highest-reference files; a dedicated manual visual pass for the blueprint-blue alias
(highest-blast-radius single edit in the whole program).

---

## 6. Failure modes & hard constraints registry (any theming work must respect)

1. **Half-warm interactive-chrome trap** — the `/account/notifications` deferral; the eventual fix
   surfaced the literal mechanism (global dark table reset over a warm thead). Rule: every warm
   surface flips ground + cards + inputs + banners + CTA together, atomically per surface.
2. **Bounded warm-insert technique** — the only sanctioned warm-inside-dark pattern: `composes:
   warmVars` + own paper ground + border + deepened shadow ("olive text needs a warm ground to stay
   legible" — it's a contrast requirement, not styling taste). Scales to doorway cards only.
3. **Equal-specificity dual-authority CSS is a recurring bug class** (next/font dev/prod font swap;
   muted-text 2.6:1 regression; gold-strong ordering) — one injection point per token per theme.
4. **E3 generalized** — no pastel accent as small text on light/warm grounds without a darkened
   companion (`lime→olive`, `gold→gold-strong`); `--blueprint-blue` needs one before any light leg.
5. **Concurrent-project decision drift** — a ratified bar-skin decision was overtaken by a
   concurrent build within a day; decide the A/B contract before either builds.
6. **Imperceptible-toggle precedent** — density's manual toggle was removed; a theme toggle must be
   screenshot-obvious (dark/warm/light is).
7. **Sunlight/day-of legibility** — an additive accessibility floor for field surfaces (Tryouts,
   check-in): solid fills + bold + text labels, never color-alone, no pale tints as sole signal.
8. **Ratchet blind spot** — operator segments are unwatched today; any theming build runs its own
   hex audit until C-P1 lands.
9. **PWA/OS chrome** — static `theme-color` meta + manifest colors don't follow any theme or brand
   change; scope the dynamic meta into T0 and the manifest into the rebrand sync list.
10. **SW cache discipline** — any new top-level route added by this work joins the SW denylist +
    cache-version bump (PII-leak rule).

---

## 7. What was checked and how (confidence)

5 recon agents (portal inventory incl. deep UI structure of the four mockup surfaces; theming
machinery; token-debt quantification with reproducible commands; prior-art/failure-mode
reconstruction; warm-vocabulary catalog + 12-primitive gap list) → 3 analysts → 18 load-bearing
claims adversarially verified against the code (7 refuted, corrections folded in) → completeness
critic (all its gaps addressed in this doc: reconciled sequencing in §0/§1, blueprint-blue folded
into A+B reasoning, ratchet-effort corrected, Tryouts/DB-field/runtime-importance answered).

## 8. Corrections log (refuted claims — what changed)

1. *"Coach Chat warm is near-zero cost, proven"* → REFUTED. Remap exists but is consumer-only by
   ratified R3-3; CoachChatView chrome (249 lines) un-warmed. §3.3 carve-out.
2. *"Warm tokens don't propagate automatically"* → REFUTED as stated. `color` inherits under
   `.warm`; the gap is explicitly-dark-styled components. §2, §4.2.
3. *"Remap dictionary missing --surface/--blueprint-blue-rgb/--data-gray"* → PARTLY REFUTED:
   `--blueprint-blue-rgb` IS remapped; true gaps are `--surface`, `--data-gray`.
4. *"Scorekeeper needs a rewrite, not tokenizable"* → REFUTED. 48% exact-token matchable;
   remap + small token additions. T2 cheaper than stated; scope call unchanged. §4.1.
5. *"Ratchet extension is a config change"* → REFUTED. New roots + separate baseline = small
   script work (S, not XS). §5.2 P1.
6. *"Email debt 156 vs 6-all-lime"* → counts corrected to 183 occurrences/15 values vs 7/4 values;
   plan shape unchanged. §5.1.
7. *"PWA manifest has zero wiring to any brand source"* → REFUTED. `#0a0a0f` is the intentional
   platform brand constant duplicated by structural necessity; needs a sync list, not rewiring. §5.1.

## 9. Key facts index (for future sessions)

- Duplicate brand token: `--primary` (globals.css ~:22) vs `--blueprint-blue` (~:307); 887 refs/70
  files on the latter; org override list is `app/[orgSlug]/layout.tsx:67-78`.
- Warm activation: `lib/consumer-routes.ts` `isWarmSkinPath()` (pure route check).
- Remap template: `components/chat/ChatPanel.module.css` `.panelWarm` (23 tokens + 4 overrides).
- Bounded insert: `components/coaches/ScopeShelf.module.css` / `CoachExploreCatalog.module.css:120-137`.
- Operator debt (live re-scan): admin 211 hex (25/51 files, ~125 standalone) + 142 inline TSX;
  coaches 66 (13/32 files, ~45 standalone) + 107 inline; scorekeeper 58 (1 file, 28 token-matchable)
  + 9 inline incl. the lime wordmark. Public: 15 trivial.
- Brand-RGB tuple duplicates: admin 13 · coaches 22 · scorekeeper 20.
- Org brand editor (clonable): `app/[orgSlug]/admin/org/settings/page.tsx` (~:167-171, :544-604,
  :618-625, :744-751), custom pickers plan-gated.
- No user theme preference anywhere; density (`fl_admin_density`) is the only visual pref, device-local.
- Coaches portal totals: `coaches.module.css` 3,975 ln (32/35 team pages import it); Schedule 2,523;
  Dues 1,334; Overview 1,115; whole warm scope ≈27–29k lines.
