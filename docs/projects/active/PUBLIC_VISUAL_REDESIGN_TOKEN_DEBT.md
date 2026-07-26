# Public Visual Redesign — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=public --report`. Read-only analysis.
> Hardcoded colors in public `*.module.css` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **43** hardcoded colors across **7** files (36 hex · 7 brand rgba)
- **21** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **18** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **4** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `components/league/register.module.css` — 19
- `components/rep-teams/register.module.css` — 14
- `app/[orgSlug]/teams/teams.module.css` — 3
- `app/[orgSlug]/Home.module.css` — 2
- `app/[orgSlug]/schedule/schedule.module.css` — 2
- `app/[orgSlug]/standings/standings.module.css` — 2
- `components/public/MyTeamDock.module.css` — 1

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/Home.module.css:197` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/Home.module.css:1335` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/schedule/schedule.module.css:560` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/schedule/schedule.module.css:1601` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/standings/standings.module.css:1220` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/standings/standings.module.css:1391` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/teams/teams.module.css:199` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/teams/teams.module.css:409` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/teams/teams.module.css:413` | `#000000` | `--black` |
| `components/league/register.module.css:53` | `#f87171` | `--danger-light` |
| `components/league/register.module.css:73` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:75` | `#f87171` | `--danger-light` |
| `components/league/register.module.css:83` | `#f87171` | `--danger-light` |
| `components/league/register.module.css:117` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:132` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:156` | `#fbbf24` | `--warning-light` |
| `components/league/register.module.css:188` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:204` | `#f87171` | `--danger-light` |
| `components/league/register.module.css:215` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:216` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/league/register.module.css:256` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:113` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:114` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:118` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:250` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/league/register.module.css:251` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/public/MyTeamDock.module.css:89` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/rep-teams/register.module.css:53` | `#f87171` | `--danger-light` |
| `components/rep-teams/register.module.css:73` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:75` | `#f87171` | `--danger-light` |
| `components/rep-teams/register.module.css:83` | `#f87171` | `--danger-light` |
| `components/rep-teams/register.module.css:112` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:121` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:131` | `#f87171` | `--danger-light` |
| `components/rep-teams/register.module.css:142` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:143` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/register.module.css:174` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:168` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/register.module.css:169` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
| `components/league/register.module.css:64` | `#f0f0f0` |
| `components/league/register.module.css:262` | `#f0f0f0` |
| `components/rep-teams/register.module.css:64` | `#f0f0f0` |
| `components/rep-teams/register.module.css:180` | `#f0f0f0` |
