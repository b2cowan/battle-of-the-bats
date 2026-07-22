# Warm Coaches Portal (Theme Option) — Build Plan

**Ratified basis (all owner-decided 2026-07-21, design_decisions.md):** TH-1…TH-4 (theming
contract: M2 precedence, `data-user-theme`, warm-as-option, build order) + **TH-5** (round-2 hard
frames ratified; chat follows the theme; tryouts warm with the sunlight floor; portal joins the
toggle only at FULL coverage) + TH-3a (operator chrome pinned to `--platform-primary`; org brand
never reaches the portal).

**Binding visual spec:** round-1 artifact `f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e` + round-2
artifact `bb6c9b81-6148-4808-aa52-288ec993409f`. The build labels every element
NEW / RESTYLED / UNCHANGED against these frames.

**Evidence base:** `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` (per-surface table §3.2, gap
list, effort §3.5, key facts §9).

---

## Hard prerequisites (gates — verify ALL at build start, do not assume)

1. **Theme Toggle Foundation shipped** (`THEME_TOGGLE_FOUNDATION_PLAN.md` Phases 0–2):
   `data-user-theme` live end-to-end (attribute, account persistence, no-flash script, consumer
   switcher working in the browser).
2. **Cleanup landed** (TH-3a form): `--platform-primary` constant driving both `--primary`
   default and `--blueprint-blue`; operator ratchet active (`--scope=operator`).
3. **Coaches-segment debt tranches substantially done** (analysis §5.2 P2 mechanical + P3
   judgment for the `coaches` segment specifically — the remap technique cannot reach literals;
   building before closing them means re-auditing mid-build).
4. **Concurrent-drift re-verify** (failure-mode registry §6.5): confirm the coaches shells'
   current theme state, the chat components' variant wiring, and the round-1/2 frame assumptions
   against the live code IMMEDIATELY before build — other chats ship daily.

## Scope

- **Both portals** — the org-embedded Premium portal AND the standalone/free Basic portal — the
  whole coaches identity: chrome (sidebar, bottom nav + More sheet, portal shell), all team
  sections, portal home, **chat (ratified: follows the theme — includes the warm pass on the
  coach chat's own room-list/master-detail chrome)**, and **tryouts (ratified: warm WITH the
  sunlight floor — solid fills, bold weight, explicit labels, never color-alone)**.
- **Every rule of the warm language as ratified:** `--home-*` values only; raw lime never as text
  on paper (olive); mono kickers; ink-filled active segments; ink-on-lime CTAs; the four TH-5
  decisions (unified live-red clash cues, olive heat ramp, 3-tint depth palette with ink rank
  numbers, gold-strong star).
- **All CSS scoped to `[data-user-theme="warm"]`** (or the shell-level class it resolves to) —
  dark output must remain byte-identical for non-choosers at every stage.
- **Out of scope:** admin, scorekeeper, public/org-branded pages (M2), the Light theme, the dark
  lineup-builder's own clash-color inconsistency (separate call), S1-2 journey pages (already
  warm).

## One preference, everywhere (binding, TH-1 rider 2026-07-21)

The portal never gets its own theme control. It reads the SAME account-level preference the
consumer app uses (one row per user, identity-scoped — never per-org/per-workspace); the
Account → Appearance card is the single home. The portal's only per-shell behavior is its
DEFAULT for users who never chose (dark), which an explicit pick overrides.

## Release rule (binding, TH-5 §4)

The coaches portal is **not offered in the Appearance picker until warm coverage is complete**.
Build stages land behind an internal dev flag (env/localStorage guard, never user-visible);
owner reviews per stage on dev; ONE public release flips the portal into the toggle. The
Appearance picker copy gains "…and coaches workspace" only in that release.

## Build stages (each = atomic per-surface flips; ground+cards+inputs+tables+banners+CTA together)

- **Stage 0 — shared groundwork.** Consolidate the two luminance contrast guards into one shared
  utility (analysis §3.4-5) + implement the team-color warm guards (near-white hairline fallback,
  text-lightness clamp toward the olive band, live-red hue-exclusion). Widen the warm remap
  dictionary (known gaps: `--surface`, `--data-gray`; audit per shell). Tokenize the schedule
  `EVENT_COLORS` + win/loss/tie literals (TSX → tokens) so the warm variants have something to
  hook — behavior-neutral on dark.
- **Stage 1 — chrome.** `coaches.module.css` base pass (the 3,975-line shared stylesheet — the
  highest-leverage/highest-risk artifact; audit for global dark resets that bleed through),
  CoachesSidebar, CoachesBottomNav (hand-edit its literals incl. the More sheet + logout row —
  round-1 frame 8 is the spec), CoachPortalShell (token-clean; remap).
- **Stage 2 — CLEAN display surfaces.** Attendance, Staff, Documents, Settings, Money hub,
  History/Insights (6 pages), Announcements, Tournaments wrappers, free-tier Overview/TeamHQ,
  portal home. Low risk; exercises the widened dictionary.
- **Stage 3 — the dense-table/ledger primitive, built ONCE** (round-1 frames 2/4 = spec), then
  applied across Roster (+ player profile), Dues, Budget, BVA (+ chart pass), Expenses,
  Fundraisers, Payment-requests, Allocations, Development board, and the free-tier
  Roster/Schedule/Fee/Announcement editors.
- **Stage 4 — trap-risk surfaces, each in its own isolated pass** (round-2 frames = spec):
  Schedule (list/week/month + slide-over + RSVP editor + add/edit modal + day sheet — one atomic
  pass, its EVENT_COLORS treatment per round-1 frame 3), Lineups (drag affordances + clash
  treatment + olive heat + templates/auto-fill popovers + bottom-anchored mobile menus), Depth
  Chart (3-tint + gold-strong star + pitcher pills).
- **Stage 5 — chat + tryouts.** Coach chat: warm variant wiring for portal-opened rooms + the
  room-list/master-detail chrome pass (the conversation panel's warm remap already exists —
  extend, don't fork). Tryouts + check-in: warm variant with the sunlight floor as a design
  REQUIREMENT (review explicitly against glare rules).
- **Stage 6 — full-coverage QA + release.** Whole-portal sweep in both themes (pixel-identity
  dark; no dark islands warm — including modals, popovers, toasts-equivalents, empty states,
  skeletons); PWA status-bar tint on portal routes; then the one public release: portal joins the
  toggle + picker copy update + help-docs sync (`/docs` — the Appearance guide gains the coaches
  workspace).

## Per-stage quality gates

`/design` fidelity pass vs the two artifacts (every element NEW/RESTYLED/UNCHANGED) → `/simplify`
(new warm primitives = new abstractions) → `/review` → owner browser review on dev behind the
internal flag. Static checks per AGENCY_RULES (`verify:changed`; `typecheck` on shared-module
stages). The operator ratchet must stay green (warm CSS uses tokens, never new literals — the
depth-chart warm tints and event-color warm variants become named tokens, not hexes in modules).

## Effort & sequencing reality

XL overall (~27–29k lines in scope; composition per analysis §3.5: ~15% chrome / ~35% remap /
~30% primitives-once / ~20% structural). Stages 0–2 are the confidence builders; Stage 4 is where
the half-warm trap lives — never split a Stage-4 surface across sessions without finishing its
pass. Runs AFTER the foundation ships; coordinate with any concurrent nav-merge/coaches work via
the decision log before each stage (drift rule).

---

## Stage 0 — BUILT on dev (2026-07-21). Behavior-neutral on dark; verified.

Gates all re-verified green immediately before build (foundation live end-to-end; operator ratchet
at 74; coaches shells ~99% token-clean post-P3). Delivered:

1. **Consolidated contrast utility** — `lib/color-contrast.ts` is the single WCAG-luminance/ink-pick
   home; `lib/themes.ts` (`onPrimaryColor`, 0.42 crossover) and `lib/team-color.ts` (`teamInk`, 0.20
   crossover) both delegate. **Both thresholds preserved** (the module parameterizes the crossover on
   purpose — a naive merge under-contrasts warm team golds; do not collapse). Proven identical to the
   prior inline code across 400k random cases (0 mismatches). The module also carries the ratified
   warm team-colour guards — `excludeLiveRedHue`, `warmTeamHairline`, `warmTeamTextColor` — exported
   for Stage 1 (chrome hairlines) / Stage 4 (lineup accents) to consume.
2. **Schedule colours tokenized** — the schedule `EVENT_COLORS` map + all win/loss/tie/cancelled
   literals moved out of the TSX. Six named `--evt-*` tokens in `globals.css` (dark = original hues);
   result badges reuse `--success`/`--danger`/`--warning`; the two soft chips use `color-mix` so they
   track their token. A `resultColor()` helper removes the thrice-duplicated win/loss/tie ternary.
   Byte-identical on dark.

### The warm remap dictionary (Stage-1 build spec — the token→--home-* mapping to apply under the gated warm scope)

| Dark token(s) | Warm value | Notes |
|---|---|---|
| `--pitch-black` (shell/main ground) | `--home-paper` | the whole-portal cream canvas flip |
| `--hud-surface` / `--card-bg` | `--home-card` (white) | cards/panels |
| `--structural-slate` | `--home-card` / paper-2 | confirm per surface vs mockups |
| `--fl-text`, `--white-90/85/80` | `--home-ink` | primary text tier |
| `--white-70/65`, `--data-gray` | `--home-ink-soft` / `--home-dim` | secondary / meta text |
| `--white-10/8/5/03` | `--home-line` / `--home-card` / `--home-paper` | hairlines, insets (mirror `.panelWarm`) |
| `--black-N` | keep (scrims stay dark) | modal dims |
| `--logic-lime` (accent) | `--home-olive` | raw lime NEVER as text on paper; `--on-lime` CTA keeps ink-on-lime |
| `--blueprint-blue(-rgb)` | `--home-line-rgb` / olive | per `.panelWarm` precedent |
| `--danger`/`--warning`/`--success` | `--home-live`/`--home-amber`/`--home-win` | already have warm counterparts |
| `--evt-*` | warm-legible event hues | define in the Stage-4 Schedule pass (round-1 frame 3) |
| `--gold-strong` | `#856611` | the legible-on-white gold (round-2 A-squad star) |

### ⚠ Two things a var-override CANNOT reach — Stage 1 base-pass must tokenize them first
- **~178 literal `rgba(255,255,255,.0X)` / `rgba(0,0,0,.X)` overlays** in `coaches.module.css` — swap
  to the value-identical `--white-N`/`--black-N` tokens (behavior-neutral on dark) so the warm scope
  reaches them. This is the bulk of the Stage-1 shared-stylesheet base pass.
- **`CoachesBottomNav` "More" sheet** — bespoke dark literals (`#0d111a` ground, `rgba(13,17,26,.97)`,
  `rgba(0,0,0,.65)` shadow, hand-copied blueprint-blue rgba, logout hover) — hand-edit per round-1
  frame 8. (`CoachPortalShell`'s single `rgba(0,0,0,.5)` mobile scrim is low-risk, stays dark.)

### ⚠⚠ Activation gate (CRITICAL, discovered at Stage 0) — the shared-preference trap
The theme preference is **one account-wide setting shared with the consumer app** (TH-1 rider). A coach
who picked Warm for the consumer app **already has `data-user-theme="warm"` on the page**. Therefore
warm coaches CSS must **NOT** key off raw `[data-user-theme="warm"]` — doing so would flip the portal
warm for those users the instant any warm rule ships, shipping a half-warm portal to real people and
breaking both the byte-identical-dark guarantee and the TH-5 one-release rule. **Stage 1 wires the
gate:** `CoachPortalShell` emits a marker (e.g. `data-coach-warm`) **only when (pref = warm AND the
internal dev flag is on)**; every warm coaches selector keys off that marker. The single public release
(Stage 6) is the removal of the dev-flag condition — nothing else. Until then the portal renders dark
regardless of preference. (This is why Stage 0 ships zero live warm CSS: the dictionary above is inert
spec until the Stage-1 gate exists.)
