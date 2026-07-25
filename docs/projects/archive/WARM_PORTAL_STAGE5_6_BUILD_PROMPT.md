# Build Prompt — Warm Coaches Portal, STAGE 5 (chat + tryouts) then STAGE 6 (QA + public release)

**For a NEW chat.** This continues `docs/projects/active/WARM_PORTAL_THEME_OPTION_PLAN.md`. Stages 0–4
are **COMMITTED on `dev`** and owner-reviewed. Your job is **Stage 5** (chat + tryouts) then **Stage 6**
(whole-portal QA + the single public release). Do Stage 5 fully, owner-review it, THEN Stage 6 — do not
one-shot the public release before the QA sweep passes.

## State you inherit (all committed on `dev`, dev-gated)
- **The warm portal is live behind a flag.** All warm CSS is scoped to
  `html[data-user-theme="warm"] [data-coach-warm-enabled]`. The marker is emitted by the two coaches
  shells (the org-embedded Premium layout `app/[orgSlug]/coaches/layout.tsx` via a `display:contents`
  wrapper placed **above** `HelpDrawerProvider`/`ConfirmProvider` so pop-up dialogs warm too; the
  standalone Basic `CoachPortalShell`) **only** when `NEXT_PUBLIC_COACH_WARM_PREVIEW=1`
  (`lib/coach-warm-preview.ts`). Off in prod → portal stays dark, byte-identical.
- **The warm dictionary lives in `app/globals.css`** inside the gated block (~line 428): the coaches
  `--home-*` palette, dark-token remaps (`--pitch-black`→paper, `--card-bg`/`--surface*`→white, the
  `--white-N` ramp→ink/line tiers, `--logic-lime`/`--blueprint-blue`→olive, status→warm), category
  accents `--home-plum`/`--home-rust`, the 6 `--evt-*` event-colour warm variants, `--gold`→gold-strong,
  and `--on-team-color: #ffffff` (globals `:root`) for text on name-hash colour badges.
- **Stages 0–4 done:** chrome (both shells), all clean display surfaces, all money ledgers + roster,
  Depth Chart, Lineups, Schedule. **The shared `coaches.module.css` had a full 160-literal role-based
  sweep** (Stage 4) so token-driven surfaces warm for free — chat/tryouts will benefit.

## Reusable techniques (proven Stages 2–4 — reuse verbatim)
1. **Token-driven `var(--…)` flips automatically** — nothing to do.
2. **Inline `style={{}}` literal** → role-based `var(--home-X, <EXACT-ORIGINAL-LITERAL>)`. Dark falls
   back to the exact literal (byte-identical; `--home-*` is undefined outside the gate); warms under it.
   Map by ROLE not alpha: text→`--home-ink`/`--home-ink-soft`/`--home-dim`, card→`--home-card`,
   inset/hover→`--home-olive-soft`, border→`--home-line`/`--home-line-strong`.
3. **Status hexes** → existing warm-remapped tokens: `#4ade80`→`var(--success-light)`,
   `#f87171`→`var(--danger-light)`, `#f59e0b`→`var(--warning)`. Translucent status/tints →
   `color-mix(in srgb, var(--token) N%, transparent)` (N = alpha×100; keeps dark identical + warms).
4. **`*.module.css` literal** → same fallback pattern, OR an additive
   `:global(html[data-user-theme="warm"] [data-coach-warm-enabled]) .cls { … }` rule (never edit the
   dark declaration). A component's OWN private tokens → remap them in an in-file warm block.
5. **Text on a name-hash / event colour fill** (avatars, monograms, month bars) → `var(--on-team-color)`
   (stays light in both themes). If a fill colour is too light for white text, deepen that colour token.
6. **Element-level `opacity` on a coloured chip fades text AND fill together** (kills contrast) — if a
   surface fades a chip via inline opacity, restore full opacity + a muted chip under a warm-gated rule.
7. **Pop-ups/dialogs must render UNDER the marker** — if a provider renders a modal as a sibling of the
   shell, the marker must sit ABOVE that provider (see the layout fix). Global `.modal`/`.modal-overlay`
   are token-driven and warm once inside the marker.

## First actions — GATES (verify; do NOT assume)
1. **Concurrent-drift re-verify (critical — other chats ship to `dev` daily; a Tournament-Seam chat has
   been editing coaches files in parallel all week).** Re-check `HEAD` is `dev`; confirm the globals warm
   block, the layout marker placement, and the surfaces you're about to touch are intact. Stage explicit
   pathspecs only; `git show --stat HEAD` after every commit; leave other chats' files alone.
2. **Confirm the preview works:** `NEXT_PUBLIC_COACH_WARM_PREVIEW=1` in `.env.local`; set the account
   theme to **Warm** (Account → Appearance); **restart the dev server** (env + layout-provider changes
   require it — stop, `rm -rf .next`, `npm run dev`, wait for Ready, verify `/platform-admin/login` =
   200, no Supabase EACCES). Open a coaches team.
3. **Present a plain-language PM/UX summary + per-surface plan in-conversation BEFORE any code**
   (AGENCY_RULES blocking gate). Then build.

## STAGE 5 scope — chat + tryouts (ratified specs are BINDING)
**Coach chat** (`app/(consumer)/chat/*` reached from the portal + the coach team chat rooms):
- **Ratified R3-3 / TH-5: chat FOLLOWS the theme.** The ChatPanel `.panelWarm` warm remap already exists
  — EXTEND it, do not fork. Warm pass on the coach chat's own **room-list / master-detail chrome** and
  any portal-opened room. Verify rendered `class=""` under Turbopack (composes is non-transitive — see
  `memory/reference_turbopack_composes_and_theming.md`).

**Tryouts + check-in** (`app/[orgSlug]/coaches/teams/[teamId]/tryouts/*`):
- **Ratified TH-5: tryouts warm WITH the SUNLIGHT FLOOR — this is a design REQUIREMENT, not optional.**
  Tryouts/check-in are used **outdoors in glare**, so: solid fills (not faint tints), bold weight,
  explicit text labels, **never colour-alone** to convey state. Review every tryout surface explicitly
  against glare/legibility, not just "does it warm." (This is the one place where the airy warm defaults
  are deliberately overridden toward high-contrast solidity.)

Full spec: `memory/design_decisions.md` TH-5 (2026-07-21) + round-2 artifact `bb6c9b81…`.

## STAGE 6 scope — whole-portal QA + the single public release
1. **Whole-portal QA sweep in BOTH themes.** Walk every surface (incl. modals, popovers, toasts-equiv,
   empty states, skeletons, both shells, mobile reflows). Dark = pixel-identical for non-choosers; warm =
   no dark islands, no invisible/low-contrast text, CTAs/toggles/badges on-spec. Fix stragglers.
   Also: PWA status-bar tint on portal routes under warm.
2. **The single public release (TH-5 §4 — the one high-stakes step):**
   - Remove the dev-flag condition so the portal joins the toggle (the marker now emits on pref=warm
     alone). This is the ONLY behavioural change — the marker/scoping architecture is unchanged.
   - Update the Account → Appearance picker copy to include the coaches workspace (it deliberately does
     NOT promise it today).
   - `/docs` — the Appearance help guide gains the coaches workspace.
   - Verify `⚠ prod-pending mig 195` (`user_preferences`) is handled in the release bundle.
3. **Flag the known residuals** carried from earlier stages: the operator token ratchet does NOT scan
   `components/accounting/` (extend its scan roots + re-baseline as a small follow-up); the tournament-
   record opponent badge may still need the `--on-team-color` fix (verify).

## Per-stage quality gates
`/design` fidelity vs the round-2 artifact (label every element NEW/RESTYLED/UNCHANGED — enforce the
sunlight floor on tryouts) → `/simplify` → `/review` → owner browser review on dev behind the flag.
`verify:changed` each stage; `typecheck` if you touch a shared module. Operator ratchet green (note: a
red from another session's admin file is not yours — confirm the offending file before reacting).

## Discipline
One shared `dev` branch (re-check `HEAD` before committing) · plain-language PM summary before code ·
commit with explicit pathspecs, per-action owner OK only (never `git add -A`; `git show --stat HEAD`
after) · leave other chats' files alone (a parallel chat edits `schedule/page.tsx` + admin files —
coordinate, don't collide) · offer `/review` + `/docs` at stage end · report honestly in product-owner
voice · dark byte-identical at every step.

## Definition of done
Stage 5: coach chat + tryouts render fully warm under the flag (tryouts pass the sunlight-floor review),
dark byte-identical, gates green, owner-reviewed. Stage 6: whole portal QA-clean in both themes, then the
single public release ships (flag condition removed, picker copy + `/docs` updated, mig 195 in the
bundle) — the warm coaches portal is live in the Appearance toggle for everyone.
