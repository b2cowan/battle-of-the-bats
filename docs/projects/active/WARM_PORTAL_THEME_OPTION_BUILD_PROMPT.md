# Build Prompt — Warm Coaches Portal (Theme Option)

**For a NEW chat.** This executes `docs/projects/active/WARM_PORTAL_THEME_OPTION_PLAN.md` — turning the
coaches portal into a **selectable warm theme** (dark stays the default for everyone else). It is an
**XL, multi-session build** (~27–29k lines in scope). Do NOT try to one-shot it: clear the gates,
build the early confidence stages, get an owner review on dev behind the internal flag, then proceed
stage-by-stage. The whole value proposition is that **dark stays byte-identical for non-choosers at
every step** — protect that above all.

## State you inherit (all on `dev`)
- **Theme Toggle Foundation — COMMITTED** (`e657d2c5` + `c8ad9416`): the `data-user-theme` attribute is
  live end-to-end (account-level preference, no-flash script, dynamic status-bar tint), the consumer
  Dark⇄Warm switcher works (Account → Appearance), and `--platform-primary` pins operator chrome so org
  brand never reaches the portal (TH-3a). ⚠ its migration is prod-pending — this build targets dev.
- **Operator token debt substantially closed** — P2 mechanical (`fadfb2ee`) + **P3 judgment (`97da8989`)**.
  The coaches shells were **just tokenized** (new `--on-lime`, `--*-light` status tier, `--tag-*`/`--sk-*`
  and other per-surface scoped palettes). This is the remap technique's hook — the warm build targets
  TOKENS, and there are far more of them now than the analysis assumed. Operator ratchet floor = 74
  (`node scripts/check-public-tokens.mjs --scope=operator`); keep it green.
- **Binding decisions:** `memory/design_decisions.md` **TH-1…TH-5** (grep — the file is large). **Binding
  visual spec = two artifacts:** round-1 `f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e` + round-2
  `bb6c9b81-6148-4808-aa52-288ec993409f`. Label every element **NEW / RESTYLED / UNCHANGED** against them.
- **Warm language template:** the consumer app's `--home-*` system; `ChatPanel` `.panelWarm` is the proven
  remap template (extend it for chat — don't fork). Evidence: `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md`.

## First actions — GATES (verify all; do NOT assume — plan §"Hard prerequisites")
1. Confirm the foundation is live in the browser (`data-user-theme` toggling, account persistence, no-flash).
2. **Concurrent-drift re-verify (critical — other chats ship daily):** audit the coaches shells' CURRENT
   token/theme state against live code — especially the **post-P3 token coverage** — plus the chat
   components' variant wiring and the round-1/2 frame assumptions, IMMEDIATELY before building. Reconcile
   any drift before touching anything.
3. Present the **plain-language PM/UX summary + your stage plan in-conversation before any code** (AGENCY_RULES
   blocking gate). Then build.

## Non-negotiables (where this build goes wrong if you forget)
- **Scope every warm rule to `[data-user-theme="warm"]`** (or the shell class it resolves to). Dark output
  must be byte-identical for non-choosers at EVERY stage — verify per stage, not just at the end.
- **Atomic per-surface flips (the half-warm trap):** warm ground + cards + inputs + tables + banners + CTA
  flip TOGETHER. Never paper-tint-over-dark, never a warm thead on a dark table body. This trap already
  deferred `/account/notifications` once.
- **Internal dev flag until FULL coverage; ONE public release** (TH-5 release rule). Until then the portal
  renders dark regardless of preference, and the Appearance picker copy must NOT promise the coaches
  workspace. No half-shipped warm portal.
- **One account preference, everywhere** — the portal never gets its own theme control (TH-1 rider). Its only
  per-shell behavior is its DEFAULT (dark) for users who never chose.
- **Warm values are TOKENS, never new literals** — warm depth-chart tints, event-color variants, clash reds
  become named tokens so the operator ratchet stays green. No fresh hexes in modules.
- **Sunlight floor on tryouts/day-of** (ratified): solid fills, bold weight, explicit text labels, pale
  accents out of the signal path — never color-alone. It's a hard design constraint inside the warm variant.
- **The 4 TH-5 warm decisions** are binding: unified live-red clash cues (`#D9482B`), olive-alpha heat ramp,
  3-tint Best/Okay/Never depth palette with ink rank numbers (the DARK board keeps its pinned 2026-07-02
  palette untouched), gold-strong A-squad star. Chat follows the theme; tryouts warm-with-the-floor.

## Build arc (plan stages 0–6 — full detail in the plan)
Stage 0 shared groundwork (single contrast guard, team-color warm guards, widen the remap dictionary,
tokenize schedule `EVENT_COLORS`/win-loss literals) → **Stage 1 chrome** (the shared `coaches.module.css`
base pass is the highest-leverage/highest-risk artifact — audit for global dark resets that bleed through;
sidebar, bottom-nav + More sheet + logout, portal shell) → Stage 2 CLEAN display surfaces (confidence
builder) → **Stage 3 the dense-table/ledger primitive built ONCE**, then applied across roster/dues/budget/
BVA/expenses/etc. → **Stage 4 trap-risk surfaces, each isolated** (Schedule as one atomic pass, Lineups drag
+ clash + heat, Depth Chart) — never split a Stage-4 surface across sessions → Stage 5 chat + tryouts →
Stage 6 full-coverage QA (no dark islands: modals, popovers, empty states, skeletons) + the one public release.

## Per-stage quality gates
`/design` fidelity vs the two artifacts (NEW/RESTYLED/UNCHANGED) → `/simplify` (new warm primitives are new
abstractions) → `/review` → owner browser review on dev behind the flag. `verify:changed` each stage;
`typecheck` on shared-module stages; operator ratchet stays green.

## Discipline
One shared `dev` branch (re-check `HEAD` before committing) · plain-language PM summary before code · commit
per stage with **explicit pathspecs, per-action owner OK only** (never `git add -A`; `git show --stat HEAD`
after each) · offer `/review` + `/docs` at stage ends · report honestly — anything skipped + residual risk named.

## Definition of done (overall)
The coaches portal renders fully warm under `[data-user-theme="warm"]` with the sunlight floor honored on
day-of surfaces, **byte-identical dark for every non-chooser**, zero dark islands, operator ratchet green,
and the single public release has flipped the portal into the Appearance picker with the copy + help-docs
updated. Each stage is its own owner-reviewed increment behind the internal flag until that final release.
