# Build Prompt — Warm Coaches Portal, STAGE 2 (clean display surfaces)

**For a NEW chat.** This continues `docs/projects/active/WARM_PORTAL_THEME_OPTION_PLAN.md`. Stages 0
(groundwork) and 1 (chrome, both portals) are **COMMITTED on `dev`** (`7e5c6bf0`), reviewed
(`/simplify` + `/review`, no defects), and dark is byte-identical. Your job is **Stage 2 only** —
the low-risk "clean display surfaces" — then hand off. Do NOT one-shot later stages.

## State you inherit (all on `dev`, committed `7e5c6bf0`)
- **A gated warm token-flip is live.** All warm CSS is scoped to
  `html[data-user-theme="warm"] [data-coach-warm-enabled]`. The marker is emitted by BOTH shells
  (the org-embedded Premium layout via a `display:contents` wrapper around shell+bottom-nav; the
  standalone Basic `CoachPortalShell` root) **only** when `NEXT_PUBLIC_COACH_WARM_PREVIEW=1`
  (`lib/coach-warm-preview.ts`). Off in prod → portal stays dark. Dark is byte-identical because
  every warm rule is purely **additive** (no existing dark declaration is ever edited).
- **The warm dictionary + palette live in `app/globals.css`** inside the gated block: the `--home-*`
  warm palette is inlined there (the coaches copy — do NOT fork or touch the consumer's
  `warmTheme.module.css`), and the block redefines the dark tokens the shells consume
  (`--pitch-black`→paper, `--card-bg`/`--surface*`→white, the `--white-N` ramp→ink/line tiers,
  `--logic-lime`/`--blueprint-blue`→olive, status→warm equivalents). **~99% of any token-driven
  surface warms for free** the moment it renders under the marker.
- **The remap technique + its two escape hatches** (learned in Stage 1 — reuse them):
  1. **Token-driven color (`var(--…)`) flips automatically** — nothing to do.
  2. **Literal `rgba()/hex` a token can't reach** → add an **additive, warm-gated** rule. In a
     `*.module.css` use the prefix `:global(html[data-user-theme="warm"] [data-coach-warm-enabled]) .localClass { … }`; in `globals.css` use the bare selector. Never edit the dark declaration.
  3. **A component with its OWN private tokens** (e.g. `DepthChartBoard` defines `--ink`/`--panel`
     locally) → remap those locals in an in-file `.wrap`-style warm block. Watch for this pattern.
- **Ratified warm language rules (binding — apply on every surface):** ink-on-lime CTAs use TRUE
  lime + dark ink (`--home-lime`/`--home-lime-ink`, restored per-element — the global remap turns
  lime→olive, which is correct ONLY for lime-as-text/accent, never lime-as-FILL); active
  segments/toggles are **ink-filled** (`--home-ink` bg + `--home-paper` text); raw lime never as
  text on paper (olive); gold as TEXT/glyph → `--gold-strong` (#856611, legible on white), not
  `--gold`. Full spec: `design_decisions.md` TH-1…TH-5 + round-1 artifact
  `f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e` + round-2 `bb6c9b81-6148-4808-aa52-288ec993409f`.

## First actions — GATES (verify; do NOT assume)
1. **Concurrent-drift re-verify (critical — other chats ship to `dev` daily):** confirm the Stage-0/1
   warm block in `app/globals.css`, the gate wiring, and the coaches shells' current token state are
   intact and that no other chat changed the surfaces you're about to touch. Reconcile drift first.
2. **Confirm the preview works in the browser:** `NEXT_PUBLIC_COACH_WARM_PREVIEW=1` is already in
   `.env.local` on the owner's dev machine. Set the account theme to **Warm** (Account → Appearance),
   **restart the dev server** (env + any new files require it — stop, `rm -rf .next`, `npm run dev`,
   wait for Ready, verify `/platform-admin/login` = 200, no Supabase EACCES), open a coaches team.
3. **Present a plain-language PM/UX summary + your per-surface plan in-conversation BEFORE any code**
   (AGENCY_RULES blocking gate). Then build.

## Stage 2 scope — the CLEAN display surfaces (plan §"Stage 2")
Attendance · Staff · Documents · Settings · Money hub · History/Insights (6 report pages) ·
Announcements · Tournaments wrappers · free-tier Overview/TeamHQ · portal home. **Low risk** — they
mostly flip via tokens; your work is to confirm that and mop up literal exceptions.

**Method, per surface (atomic — never leave a surface half-warm):**
- Render it under the flag and diff visually against dark. Most of it should already be warm.
- Hunt the literal exceptions (`rgba(255,255,255,…)`, `rgba(0,0,0,…)`, stray hex, component-local
  private tokens) and add additive warm-gated overrides so **ground + cards + inputs + tables +
  banners + CTA flip together**. No white-on-cream invisible text/borders; no dark islands.
- Apply the ratified rules (ink-on-lime CTAs, ink-filled toggles, gold-strong glyphs, olive not
  raw lime as text).
- Confirm **dark is byte-identical** (it will be, as long as you only ADD warm-gated rules and never
  edit a dark declaration) and the **operator ratchet stays green**
  (`node scripts/check-public-tokens.mjs --scope=operator` — floor 74; warm values are tokens/rgba,
  never new hex in a `*.module.css`; put any new literal in `globals.css`).

**Out of scope for Stage 2** (leave for their stages): dense-table/ledger primitive (Stage 3:
Roster/Dues/Budget/BVA/Expenses/etc.), the trap surfaces (Stage 4: Schedule incl. the not-yet-warm
`--evt-*` event palette, Lineups, Depth Chart's full fidelity pass), chat + tryouts (Stage 5), the
final QA sweep + public release (Stage 6).

## Per-stage quality gates
`/design` fidelity vs the two artifacts (label every element NEW/RESTYLED/UNCHANGED) → `/simplify`
→ `/review` → owner browser review on dev behind the flag. `verify:changed` each stage;
`typecheck` only if you touch a shared module. Operator ratchet green.

## Discipline
One shared `dev` branch (re-check `HEAD` before committing) · plain-language PM summary before code ·
commit with **explicit pathspecs, per-action owner OK only** (never `git add -A`; `git show --stat
HEAD` after) · leave other chats' files alone · offer `/review` + `/docs` at stage end · report
honestly (what's warm, what's deferred, residual risk) in **product-owner voice**.

## Definition of done (Stage 2)
Every listed clean display surface renders fully warm under the flag — no dark islands, no invisible
white-on-cream text/borders, CTAs and toggles on-spec — **dark byte-identical** for non-choosers,
operator ratchet green, each surface owner-reviewed on dev behind the flag. Stays dev-gated; the
single public release is still Stage 6.
