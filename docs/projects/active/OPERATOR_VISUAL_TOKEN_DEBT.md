# Operator Visual Cleanup — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=operator --report`. Read-only analysis.
> Literal hex colors in operator `*.module.css` that should be `var(--*)` tokens.

## Summary

- **74** literal hex colors across **26** files
- **10** map exactly to an existing token (safe swaps — dark-identical, fix light-mode drift)
- **64** have no token match (custom colors — leave, or promote to a new token case-by-case)

## Worst offenders (fix these tranches first)

- `app/[orgSlug]/admin/tournaments/branding/branding.module.css` — 17
- `app/[orgSlug]/scorekeeper/scorekeeper.module.css` — 9
- `app/platform-admin/dev-tools/playbook.module.css` — 8
- `app/[orgSlug]/admin/onboarding/onboarding.module.css` — 6
- `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css` — 4
- `app/[orgSlug]/coaches/coaches.module.css` — 3
- `components/coaches/DepthChartBoard.module.css` — 3
- `app/[orgSlug]/admin/accounting/accounting.module.css` — 2
- `app/[orgSlug]/admin/admin-common.module.css` — 2
- `app/[orgSlug]/admin/house-league/house-league.module.css` — 2
- `app/platform-admin/change-requests/change-requests.module.css` — 2
- `components/admin/TournamentSetupWizard.module.css` — 2
- `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css` — 1
- `app/[orgSlug]/admin/accounting/budget/budget.module.css` — 1
- `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — 1

## Exact-token candidates (safe to swap, verify light mode)

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:13` | `#fbbf24` | `--warning-light` |
| `app/platform-admin/dev-tools/playbook.module.css:132` | `#60a5fa` | `--info-light` |

## Custom colors (no token match — decide per-instance)

| File:line | Literal |
|---|---|
| `app/[orgSlug]/admin/accounting/accounting.module.css:4` | `#a78bfa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:5` | `#1a1f2e` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:28` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:38` | `#f0f0f0` |
| `app/[orgSlug]/admin/admin-common.module.css:6` | `#f6c453` |
| `app/[orgSlug]/admin/admin-common.module.css:7` | `#ccff66` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:165` | `#a78bfa` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:1185` | `#a78bfa` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:2` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:3` | `#86efac` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:4` | `#fecaca` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:18` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:19` | `#86efac` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:20` | `#fecaca` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#fb923c` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#fcd34d` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:344` | `#c084fc` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:634` | `#080B14` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:643` | `#F5F7FC` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:675` | `#0F1123` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#fb923c` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#fcd34d` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:776` | `#c084fc` |
| `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:2001` | `#0b0f14` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:1103` | `#111111` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:909` | `#0a0c12` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:108` | `#333` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:115` | `#ccc` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:119` | `#000` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:121` | `#333` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:4` | `#fecaca` |
| `app/[orgSlug]/coaches/coaches.module.css:98` | `#a9bdf5` |
| `app/[orgSlug]/coaches/coaches.module.css:99` | `#7aa2f7` |
| `app/[orgSlug]/coaches/coaches.module.css:100` | `#c9e89a` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:3` | `#f97316` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:3` | `#1a1f2e` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:8` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:9` | `#e2e8f0` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:10` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:11` | `#172036` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:12` | `#020617` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:14` | `#fcd9a3` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:15` | `#e6f5c4` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:16` | `#fca5a5` |
| `app/platform-admin/bulk-operations/bulk-operations.module.css:3` | `#fde68a` |
| `app/platform-admin/change-requests/change-requests.module.css:3` | `#07100b` |
| `app/platform-admin/change-requests/change-requests.module.css:4` | `#bfdbfe` |
| `app/platform-admin/customer-users/customer-users.module.css:1` | `#1a1a1a` |
| `app/platform-admin/dev-tools/dev.module.css:8` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:5` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:140` | `#a78bfa` |
| `app/platform-admin/dev-tools/playbook.module.css:144` | `#fb923c` |
| `app/platform-admin/dev-tools/playbook.module.css:152` | `#22d3ee` |
| `app/platform-admin/dev-tools/playbook.module.css:156` | `#f472b6` |
| `app/platform-admin/dev-tools/playbook.module.css:160` | `#2dd4bf` |
| `app/platform-admin/dev-tools/playbook.module.css:164` | `#a3e635` |
| `app/platform-admin/email/email.module.css:3` | `#0b0f14` |
| `app/platform-admin/users/users.module.css:353` | `#000` |
| `components/admin/TournamentSetupWizard.module.css:2` | `#080b12` |
| `components/admin/TournamentSetupWizard.module.css:3` | `#fecaca` |
| `components/coaches/CoachesBottomNav.module.css:6` | `#0d111a` |
| `components/coaches/DepthChartBoard.module.css:12` | `#bef264` |
| `components/coaches/DepthChartBoard.module.css:13` | `#93c5fd` |
| `components/coaches/DepthChartBoard.module.css:14` | `#fca5a5` |
