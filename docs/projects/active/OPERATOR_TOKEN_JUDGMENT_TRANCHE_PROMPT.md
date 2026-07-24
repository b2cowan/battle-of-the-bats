# Build Prompt — Operator Token Debt, P3 Judgment Tranche

**For a NEW chat.** This executes the P3 (judgment) tranche of the operator color-debt cleanup —
the last prerequisite before the warm coaches-portal build
(`WARM_PORTAL_THEME_OPTION_PLAN.md`). P2 (mechanical) is DONE and committed (`fadfb2ee`:
136 value-identical swaps, 22 files, adversarially verified). **P3 is still a
ZERO-VISUAL-CHANGE refactor** — if any spot seems to *want* a value change, flag it separately;
never change a rendered color in this tranche.

## State you inherit

- Operator ratchet live: `node scripts/check-public-tokens.mjs --scope=operator`
  (baseline `scripts/.operator-token-baseline.json` = **365 literals / 55 files**; report
  `docs/projects/active/OPERATOR_VISUAL_TOKEN_DEBT.md` = the file:line inventory —
  **347 custom** + 18 inert `var(--x, #fallback)` literals which are FINE, leave them).
- `--platform-primary` pin (TH-3a): operator chrome derives from the pinned platform family;
  org brand never reaches operator surfaces. Any new blue you touch follows that rule.
- Binding program decisions: design_decisions.md **TH-1…TH-5** (grep, the file is 400KB).
  Evidence base: `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` §5 + §9.

## The task

For every custom literal in the operator report (they cluster by component into roughly 60–80
decisions), decide and apply ONE of:

1. **PROMOTE to an existing global token** — only when the literal is byte-identical to the
   token's value AND the semantic intent matches (P2 already took the obvious ones; expect few).
2. **PROMOTE to a NEW named token** — only when ≥2 distinct components share the value/intent,
   or it's genuinely semantic (a status, a brand constant). New globals go in `app/globals.css`
   with a comment; keep the palette small — token sprawl is its own debt.
3. **CONVERT to component-scoped custom properties** — the workhorse outcome. A local
   `--xx-*` block at the top of the module (the DepthChartBoard pattern) keeps the palette
   deliberate AND makes the surface remappable later (the scoped-remap technique needs vars —
   any vars). Right answer for e.g. the scorekeeper's remaining slate greys and any pinned
   bespoke palettes.
4. **KEEP + DOCUMENT** — a deliberate one-off stays a literal with a one-line comment saying
   why (e.g. "pinned 2026-07-02 design audit"). DepthChartBoard's best/okay/never palette is
   ONE such decision (already pinned; the WARM variant is separately ratified in TH-5 and is
   NOT this tranche's job).

**Out of scope:** inline-TSX hex (P4, 258 hits — the schedule `EVENT_COLORS` map specifically
belongs to the warm-portal build's Stage 0); email templates (structurally literal); the
~3,000 white/black-alpha rgba duplicates (separate low-priority cleanup); anything under
`app/[orgSlug]` public, `app/teams`, `components/public` (public scope is clean and separately
ratcheted).

## Method (workflow-friendly)

1. Regenerate the report (`--scope=operator --report`) and build the cluster table: file/component
   → literals → proposed outcome (1–4) → rationale. **Present the full table for review before
   applying** — invoke `/design` on the contentious clusters (it loads the design-decisions
   canon); batch the trivial ones.
2. Apply per cluster. Every replacement value-identical; comments added for keeps.
3. Adversarial verify (the P2 pattern): independent reviewers over the diff per segment checking
   value-identity + semantic fit + no comment/fallback corruption. Fix, re-scan.
4. Re-freeze: `--scope=operator --init` (expect a large drop from 365 — target is literals ≈
   documented-keeps only), regenerate the report, `npm run verify:changed`.
5. Update the tranche status in `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` §5.2 + TODO.md +
   memory (`project_warm_coaches_portal_followup`). Commit with explicit pathspecs, one commit
   per logical batch, **per-action owner OK only** (never `git add -A`; `git show --stat HEAD`
   after each).

## Discipline

One shared `dev` branch (re-check HEAD) · plan + plain-language PM summary in-conversation
before code (AGENCY_RULES) · no dev-server restart needed for CSS-only edits, but restart before
handoff if any shared module/new file lands · offer `/review` at the end · report honestly:
anything skipped + residual risk named.

## Definition of done

Operator report shows only documented keeps + inert fallbacks; ratchet frozen at the new floor;
zero visual change verified; commits landed with owner OKs; the warm-portal build's "coaches-
segment debt substantially closed" prerequisite is satisfiable — say so explicitly in the
handoff summary.
