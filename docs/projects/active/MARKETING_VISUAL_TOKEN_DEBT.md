# Marketing Site — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=marketing --report`. Read-only analysis.
> Hardcoded colors in marketing `*.module.css` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **14** hardcoded colors across **3** files (8 hex · 6 brand rgba)
- **14** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **0** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **0** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `components/marketing/tournament-growth.module.css` — 10
- `app/page.module.css` — 3
- `components/EarlyAccessForm.module.css` — 1

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/page.module.css:11` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/page.module.css:19` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/page.module.css:20` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `components/EarlyAccessForm.module.css:111` | `#fca5a5` | `--pa-neg` |
| `components/marketing/tournament-growth.module.css:21` | `#d9f99d` | `--primary-light` / `--logic-lime` |
| `components/marketing/tournament-growth.module.css:74` | `#93c5fd` | `--pa-info` |
| `components/marketing/tournament-growth.module.css:85` | `#d9f99d` | `--primary-light` / `--logic-lime` |
| `components/marketing/tournament-growth.module.css:98` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/marketing/tournament-growth.module.css:117` | `#d9f99d` | `--primary-light` / `--logic-lime` |
| `components/marketing/tournament-growth.module.css:118` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/marketing/tournament-growth.module.css:128` | `#93c5fd` | `--pa-info` |
| `components/marketing/tournament-growth.module.css:48` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/marketing/tournament-growth.module.css:86` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/marketing/tournament-growth.module.css:87` | `rgb(217,249,157)` | `--logic-lime-rgb` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
