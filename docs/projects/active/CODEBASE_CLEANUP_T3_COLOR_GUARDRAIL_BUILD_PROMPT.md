# Color-Token Guardrail — Move #2 Build Prompt (widen coverage + zero the baselines)

> **How to use:** paste this whole prompt into a NEW chat. It executes **Tranche 3** of
> `docs/projects/active/CODEBASE_CLEANUP_PLAN.md` — extended with rgba/inline coverage and a
> zero-out sweep — on top of the color-token **guardrail enforcement** shipped 2026-07-25.
> Read the plan's Tranche 3 + Tranche 4 "Token drift" section and this whole prompt FIRST.

## The goal (why this exists)

A rebrand should be **edit the central color tokens once → ship → nothing straggles.** Today
that promise leaks because some colors are typed directly into individual stylesheets/pages
instead of pointing at the central tokens in `app/globals.css` `:root`. There is now a
guardrail that catches such stragglers, but it has blind spots and the existing debt is
"grandfathered". This work closes the loop: **watch every surface in every color format, then
drive the existing debt to zero.** After this, any hardcoded color anywhere fails the gate the
moment it's added, and a rebrand is genuinely one edit.

## What already exists (Move #1 — SHIPPED 2026-07-25, do NOT redo)

- **The guardrail:** `scripts/check-public-tokens.mjs` — a per-file **ratchet** over
  `*.module.css` in two scopes (`public`, `operator`). Modes: default `check` (fail if any file
  exceeds its baseline), `--report` (writes the token-debt inventory doc), `--init` (snapshot/lower
  the baseline), and **`--staged <files…>`** (pre-commit mode: checks only the staged modules).
  Currently flags **literal HEX only**. Baselines: `scripts/.public-token-baseline.json`,
  `scripts/.operator-token-baseline.json`. Reports:
  `docs/projects/active/PUBLIC_VISUAL_REDESIGN_TOKEN_DEBT.md`, `OPERATOR_VISUAL_TOKEN_DEBT.md`.
- **Automatic enforcement (commits `418c16a4`, `9ec452a3`, `b86dac26`):**
  - `.githooks/pre-commit` (staged-files-only) blocks a commit that ADDS a literal; wired via
    `package.json` `"prepare": git config core.hooksPath .githooks` (activates on install) and
    `.gitattributes` pins the hook to LF. The hook iterates `SCOPES` — **new scopes you add are
    covered automatically.**
  - `amplify.yml` runs `check-public-tokens.mjs` + `--scope=operator` before the build = the
    unbypassable deploy backstop. **When you add scopes, add their `--scope=` lines here too.**
  - `verify:changed` already runs both current scopes.
- **Both current scopes are GREEN on `dev`** (team-profile.module.css + 3 coaches `--home-lime`
  literals were tokenized). Central white/black anchors `--white`/`--black` exist in globals.

## The work

### Part A — Widen coverage to every surface (plan Tranche 3, items 1–5)
Add/extend scopes in `check-public-tokens.mjs`'s `SCOPES` map exactly per **Tranche 3** of the
plan: new **`consumer`** scope (C36), new **`marketing`** scope (C37), extend **`operator`**
(C38/C39/C47) and **`public`** (C24/C25). Respect the plan's excludes (e.g. `warmTheme.module.css`
**DEFINES** tokens — literal hex there is correct, never scan it; `ConsumerShell` stays in
public.files). Then:
- Wire each new scope into `amplify.yml` and `verify:changed` (the pre-commit hook auto-covers
  them via the `SCOPES` iteration — verify this).
- **OWNER DECISION (C40):** shared surfaces (`chat/*`, `tournament-growth`, `FlipPill`,
  `InstallAppPrompt`, `TeamAvatar`) render in both public + operator shells. Either a third
  `shared` scope with its own baseline, or double-list. Get a call before extending; default
  recommendation = a `shared` scope so the debt isn't double-counted.

### Part B — Catch rgba()/rgb() brand-color literals (the biggest blind spot)
Today the scanner only sees `#hex`. **Most brand-color debt is rgba** (audit: ~132 rgba consumer,
~191 rgba marketing, ~304 rgba operator). Extend the scanner to flag `rgb()/rgba()` literals
**whose channels match a known brand color**, mapped to its `-rgb` token — NOT every rgba:
- Build the target set from globals' `--X-rgb: R, G, B;` declarations (e.g. `--platform-primary-rgb`
  = `30, 58, 138`; `--logic-lime-rgb` = `217, 249, 157`; `--home-rust-rgb` = `180, 83, 9`). Flag
  `rgba(30,58,138,…)` → `rgba(var(--platform-primary-rgb),…)`, etc. (plan C29 = 33 sites, C31 = 11 sites).
- **Stale-brand list:** `rgba(163,230,53,…)` is the PRE-refresh lime (C30, ~20 sites × 8 files) —
  flag it → current lime token, but this **changes the rendered hue** → eyeball pass, not a blind
  swap.
- **Do NOT flag** `rgba(255,255,255,…)` / `rgba(0,0,0,…)` white/black alphas — those are the
  `--white-NN`/`--black-NN` family, not brand colors (a separate, lower-priority pass at most).
- Keep this behind the same ratchet/baseline mechanics so it lands incrementally.

### Part C — (stretch) inline color literals in `.tsx`
Colors hard-coded in `style={{…}}` / string literals in JSX are invisible to a `.module.css`
scanner (this session found one: a `--home-rust-rgb` inline fallback). Add a companion check or a
scoped scan for `style={{` color literals. Lower priority than A/B; flag and defer if large.

### Part D — Zero the baselines (surface by surface)
For each scope: run `--report`, tokenize the literals (reference plan Tranche 4 "Token drift":
C29/C30/C31/C33 swaps, and **C34** warm-gate alias freeze), then `--init` to lock the LOWER count.
Repeat until every scope's baseline is **0**. Only then is the guarantee total (any literal, any
surface, fails instantly). Cautions:
- **Light-mode drift:** the report marks "exact-token" swaps as dark-identical but they can shift
  LIGHT mode — visually verify light + dark (+ the warm coaches portal) after each surface.
- **Pure white/black math anchors** (e.g. `color-mix(... white/black)`) are NOT brand colors — use
  `var(--white)`/`var(--black)` or the `white`/`black` keywords, don't invent brand tokens for them.
- Don't scan/tokenize files that DEFINE tokens (`warmTheme.module.css`, globals).

## Coordination rules (binding — shared working copy)
- **ONE shared `dev` branch** for all agents. Re-check `git rev-parse --abbrev-ref HEAD` = `dev`
  before every commit. Never `git add -A`; **explicit pathspecs only** (bracket dirs like
  `[orgSlug]` need `:(literal)` pathspecs). Prefer **atomic `git commit -- <paths>`** — a concurrent
  session rebased mid-work last time and orphaned a commit; atomic pathspec commits survived.
  `git show --stat HEAD` after each commit; if foreign files slipped in, reset + restage.
- **A concurrent coaches-portal design session may be editing CSS.** Re-verify against the live
  tree before editing any stylesheet; do the broad zero-out when that work has settled.
- **Per-action owner OK before each commit** (suggested: one commit per scope/surface).
- Prod checks use `origin/master` after a fresh `git fetch`.

## Verification bar
- All scopes `check` GREEN; re-run `--init` to freeze the new (lower/zero) baselines.
- `npm run typecheck` (only if you touch non-CSS); `npm run verify:changed` (expect green once
  baselines are re-frozen).
- **Visual spot-check** each swept surface in light + dark + warm portal (token swaps can shift
  light mode / hue — especially the stale-lime C30 set).
- Confirm the guardrail now self-covers the new scopes: the pre-commit hook blocks a test literal
  in a newly-covered surface, and `amplify.yml` runs every scope.
- Clean dev-server restart (stop → `rm -rf .next` → `npm run dev` → Ready) before handing off.

## Report back
Per scope: literals tokenized (count + surface), any hue/light-mode changes to eyeball, the C40
shared-scope decision outcome, whether rgba/inline coverage landed or was deferred (with residual
count), commit hashes, and final baseline numbers (target 0). Note anything left for a follow-up.
