# Public Visual Redesign — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --report`. Read-only analysis.
> Literal hex colors in public `*.module.css` that should be `var(--*)` tokens.

## Summary

- **22** literal hex colors across **6** files
- **21** map exactly to an existing token (safe swaps — dark-identical, fix light-mode drift)
- **1** have no token match (custom colors — leave, or promote to a new token case-by-case)

## Worst offenders (fix these tranches first)

- `app/teams/[id]/team-profile.module.css` — 9
- `app/[orgSlug]/schedule/schedule.module.css` — 4
- `app/[orgSlug]/standings/standings.module.css` — 3
- `app/[orgSlug]/teams/teams.module.css` — 3
- `app/[orgSlug]/Home.module.css` — 2
- `components/public/MyTeamDock.module.css` — 1

## Exact-token candidates (safe to swap, verify light mode)

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/Home.module.css:181` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/Home.module.css:1072` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:1510` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:1915` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:2116` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:2359` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:976` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:1339` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:1504` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/teams/teams.module.css:199` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/teams/teams.module.css:284` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/teams/teams.module.css:296` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:16` | `#ffffff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:86` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:146` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:289` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:319` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:331` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:497` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:515` | `#fff` | `--white` / `--on-primary` |
| `components/public/MyTeamDock.module.css:58` | `#fff` | `--white` / `--on-primary` |

## Custom colors (no token match — decide per-instance)

| File:line | Literal |
|---|---|
| `app/teams/[id]/team-profile.module.css:20` | `#000000` |
