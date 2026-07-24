# Public Visual Redesign — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --report`. Read-only analysis.
> Literal hex colors in public `*.module.css` that should be `var(--*)` tokens.

## Summary

- **15** literal hex colors across **6** files
- **13** map exactly to an existing token (safe swaps — dark-identical, fix light-mode drift)
- **2** have no token match (custom colors — leave, or promote to a new token case-by-case)

## Worst offenders (fix these tranches first)

- `app/teams/[id]/team-profile.module.css` — 4
- `app/[orgSlug]/standings/standings.module.css` — 3
- `app/[orgSlug]/teams/teams.module.css` — 3
- `app/[orgSlug]/Home.module.css` — 2
- `app/[orgSlug]/schedule/schedule.module.css` — 2
- `components/public/MyTeamDock.module.css` — 1

## Exact-token candidates (safe to swap, verify light mode)

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/Home.module.css:198` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/Home.module.css:1412` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:546` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/schedule/schedule.module.css:2048` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:1117` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:1530` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/standings/standings.module.css:1701` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/teams/teams.module.css:199` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/teams/teams.module.css:409` | `#ffffff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:15` | `#ffffff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:93` | `#fff` | `--white` / `--on-primary` |
| `app/teams/[id]/team-profile.module.css:168` | `#fff` | `--white` / `--on-primary` |
| `components/public/MyTeamDock.module.css:89` | `#fff` | `--white` / `--on-primary` |

## Custom colors (no token match — decide per-instance)

| File:line | Literal |
|---|---|
| `app/[orgSlug]/teams/teams.module.css:413` | `#000000` |
| `app/teams/[id]/team-profile.module.css:19` | `#000000` |
