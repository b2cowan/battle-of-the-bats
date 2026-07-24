# Exploration Prompt — Warmer Coaches Portal + App-Wide Theming & Brandability

**For a NEW chat. This is an EXPLORATION + DESIGN prompt, NOT a build.** Produce a deep analysis,
honest effort sizing, and ratifiable mockups; write **no production code** until the owner approves
a specific scope. Three related workstreams tied by one throughline: *how themeable is our app, and
what would it take to give coaches (and the owner) more theme control?*

---

## Context — what just shipped
The Founding Season "Coaches Portal warm sign-up JOURNEY" restyle (`design_decisions.md` **S1-2**)
shipped to `dev` (commit `50c09ab5`): the `/start` family, `/coaches/start` signup, the new
`/coaches/welcome` success screen, and the in-portal upgrade inserts now wear the consumer **warm**
theme (paper `#F8F4ED` ground, white cards, ink `#241E15` / olive `#57651E`, ink-on-lime CTAs).

**S1-2 deliberately left the OPERATING coaches portal (roster / schedule / fees / dues / lineups)
DARK** — to avoid the "half-warm interactive-chrome trap" that deferred `/account/notifications`.
The owner now wants to explore going further, plus two adjacent questions about app-wide theming.

## READ FIRST (in order)
1. `memory/design_decisions.md` — **S1-2**, **S1-1**, **R1-4** (the additive `--home-*` warm token
   system + its deliberate consumer-shell-only scope), **R1-2** (the intentional warm→dark
   "walking into the venue" handoff). These explain WHY the operating portal was left dark.
2. `memory/design_system.md` — the full CSS custom-property (design-token) reference.
3. `app/globals.css` `:root` — the actual centralized token definitions. Note the comment on
   `--primary`: *"overridden per-org via inline style on [orgSlug] wrapper"* — per-org brand theming
   already rides the token cascade.
4. `components/consumer/warmTheme.module.css` — the `--home-*` tokens + the `.warmVars` (tokens only)
   vs `.warm` (tokens + paper ground) split; the `composes: warmVars` pattern used to bring warm
   tokens into non-consumer surfaces during the S1-2 build.
5. `lib/themes.ts` + how `[data-color-mode="light"]` / per-org color mode is applied — the current
   light/dark + per-org branding machinery.
6. `scripts/check-public-tokens.mjs` — the token-debt **ratchet**: it enforces "no new hard-coded hex"
   on `app/[orgSlug]` (excl. /admin/), `app/teams`, `components/public` — and **EXCLUDES the
   `admin`, `scorekeeper`, and `coaches` segments** (they own their styling, not token-enforced).
7. `memory/project_warm_coaches_portal_followup.md` — the owner's follow-up note that spawned this.

## Preliminary findings (head start — verify + deepen these)
- **Branding IS centralized** in `app/globals.css` `:root` (`--primary`, surfaces, semantic colors,
  radii, shadows, the `--white-*` alpha scale). Changing a token propagates to every `var(--*)`
  consumer. Per-org brand color already re-themes the app automatically.
- **Enforcement is partial:** the ratchet disciplines PUBLIC surfaces but **excludes admin /
  scorekeeper / coaches**, and there's grandfathered token debt (a baseline of existing literal hex).
  So a rebrand propagates cleanly on tokenized surfaces but can MISS hard-coded spots in the operator
  tools + the debt.
- **Themes today:** dark (default) + per-org light mode (`[data-color-mode]`) + the warm `--home-*`
  system — but **warm is scoped to the consumer shell, not a full app theme.**

---

## Workstream A — Warmer OPERATING Coaches Portal (deep analysis + mockups)
Explore warming the operating coaches portal (currently platform dark: `#0A0A0A` + blueprint grid,
`#111827` cards, lime accent) to the consumer warm language.
- **Inventory every operating-portal surface** (team overview, roster, schedule, fees, dues, budget,
  lineups, documents, announcements, chat, development, etc.) — current theming + what warming each
  takes. Which are display-heavy (cleanly warm-able) vs dense-interactive (the half-warm trap risk)?
- **Resolve the core tension:** R1-4/S1-2 warn that warming a dense interactive tool half-way is the
  trap. Is a FULL warm operating portal coherent, or does it re-hit the seam? Where's the boundary?
- **Interaction with per-team brand:** a Premium team workspace can carry its own brand color — how
  does warm coexist with a team's brand accent?
- **Effort:** honest T-shirt sizing per surface + overall; how much is pure token remap vs structural.
- **Mockups (ratifiable):** the warmed operating portal — at least team overview + roster + schedule +
  fees, mobile + desktop, every element labeled **NEW / RESTYLED / UNCHANGED**.
- **Recommendation:** worth it? all-at-once vs incremental? sequencing vs Workstream B.

## Workstream B — User-selectable themes (light / dark / warm toggle, MS-Teams-style)
The owner wants users to toggle themes like MS Teams (light / dark / warm / …).
- **Feasibility + effort tiers.** The app has dark + per-org light + consumer warm, but warm isn't a
  full app theme and operator areas aren't token-enforced. Size: "light/dark toggle on the consumer
  app" vs "full 3-theme, app-wide incl. operator tools."
- **Analyze the mechanics:** (1) theme-picker UI + persistence (account setting vs per-device); (2)
  applying the chosen theme at the root (a `data-theme` attribute / class) and how it cascades; (3)
  defining each theme as a COMPLETE token set; (4) promoting warm to a full app theme.
- **THE load-bearing question — user choice vs org branding:** when a user picks "light" but is inside
  an org/tournament with its own brand colors (or a coach in a branded team), **whose colors win?**
  Propose the model (e.g. user pref governs neutral chrome; org brand governs accent; or org-branded
  surfaces opt out of the user toggle). This decision gates everything.
- **Scope:** which surfaces get the toggle (consumer app only? coaches portal? admin? public
  org-branded pages)?
- **Mockup:** the theme picker + each theme applied to one representative screen.

## Workstream C — Branding-color centralization audit ("change one color → see it everywhere?")
Answer the owner's exact question: can changing a primary button from one blue to another propagate
app-wide without hunting thousands of lines and risking misses?
- **Audit + quantify.** Confirm the centralized token model. Run `node scripts/check-public-tokens.mjs
  --report` for the public debt. **Grep the operator areas (`admin`, `coaches`, `scorekeeper`) for
  literal hex** to size the NON-tokenized surface — this is the "would miss it" risk; put a number on it.
- **Recommend the path to truly single-source branding:** close the token gaps in operator areas +
  retire the debt; effort estimate + a phased plan.
- **Runtime-editable branding (bonus):** feasibility of an owner-facing "brand settings" surface that
  edits the palette live (writes token values) vs code-time edits. What's the lift, what breaks?

---

## Deliverables
- A written deep-analysis doc in `docs/projects/active/` covering A, B, C — honest effort sizing +
  a clear recommendation and phased plan per workstream.
- Ratifiable **mockups** (warm operating portal; theme picker + the themes) — owner sign-off BEFORE
  any build (build-to-approved-mockups rule).
- A short plain-language **PM brief** (AGENCY_RULES).
- Direct answers to the open questions below.

## Discipline
- Analysis + mockups FIRST; **no production code** until the owner ratifies a scope.
- Present a plain-language UX summary + PM brief before any build (AGENCY_RULES).
- One shared `dev` branch; explicit pathspecs; **no commit/push without the owner's per-action OK.**
- If any workstream becomes a build, it gets its own `_PLAN.md` + `_PM_BRIEF.md` and a `/design`
  fidelity pass + `/review`.

## Open questions for the owner (surface these early)
1. **Sequencing:** is the warm operating portal a "next" or a "someday"? Does the theme toggle
   (Workstream B) supersede a one-off warm portal (i.e. build the toggle and warm becomes one option)?
2. **User theme vs org brand:** when they conflict, which wins? (the decision that gates Workstream B)
3. **Toggle scope:** just the consumer app, or everywhere?
4. **Runtime-editable branding:** how important is an owner-facing brand-settings page vs code-time?
