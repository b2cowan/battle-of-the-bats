# Operator Visual Cleanup — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=operator --report`. Read-only analysis.
> Literal hex colors in operator `*.module.css` that should be `var(--*)` tokens.

## Summary

- **365** literal hex colors across **55** files
- **18** map exactly to an existing token (safe swaps — dark-identical, fix light-mode drift)
- **347** have no token match (custom colors — leave, or promote to a new token case-by-case)

## Worst offenders (fix these tranches first)

- `app/[orgSlug]/admin/accounting/accounting.module.css` — 28
- `app/[orgSlug]/scorekeeper/scorekeeper.module.css` — 20
- `app/[orgSlug]/admin/tournaments/branding/branding.module.css` — 19
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css` — 19
- `app/[orgSlug]/admin/onboarding/onboarding.module.css` — 18
- `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css` — 17
- `app/[orgSlug]/admin/org/members/members.module.css` — 16
- `app/[orgSlug]/coaches/coaches.module.css` — 14
- `app/platform-admin/dev-tools/dev.module.css` — 14
- `app/platform-admin/dev-tools/playbook.module.css` — 14
- `app/platform-admin/email/email.module.css` — 14
- `app/platform-admin/change-requests/change-requests.module.css` — 13
- `app/[orgSlug]/admin/org/settings/settings.module.css` — 11
- `app/platform-admin/plans-pricing/plans-pricing.module.css` — 11
- `components/admin/TournamentSetupWizard.module.css` — 10

## Exact-token candidates (safe to swap, verify light mode)

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:687` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/admin/org/members/members.module.css:147` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/org/members/members.module.css:191` | `#ef4444` | `--danger` |
| `app/[orgSlug]/admin/org/members/members.module.css:261` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/admin/org/members/members.module.css:537` | `#ef4444` | `--danger` |
| `app/[orgSlug]/admin/org/members/members.module.css:565` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/org/members/members.module.css:570` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/org/members/members.module.css:611` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:140` | `#fff` | `--white` / `--on-primary` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:186` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/org/tournaments/tournaments-admin.module.css:43` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:1660` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:3470` | `#f59e0b` | `--warning` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:3481` | `#ef4444` | `--danger` |
| `app/platform-admin/email-templates/email-templates.module.css:565` | `#0f172a` | `--bg-2` / `--surface-2` |
| `components/admin/CheckInBoard.module.css:443` | `#d9f99d` | `--primary-light` |
| `components/admin/ExportMenu.module.css:45` | `#111827` | `--bg-3` / `--surface` |
| `components/admin/ExportMenu.module.css:62` | `#fff` | `--white` / `--on-primary` |

## Custom colors (no token match — decide per-instance)

| File:line | Literal |
|---|---|
| `app/[orgSlug]/admin/accounting/accounting.module.css:29` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:87` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:94` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:96` | `#1a1f2e` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:114` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:115` | `#a78bfa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:138` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:139` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:140` | `#f87171` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:171` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:190` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:191` | `#f87171` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:233` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:239` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:262` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:288` | `#1a1f2e` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:308` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:395` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:395` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:427` | `#a78bfa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:432` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:433` | `#f87171` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:445` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:446` | `#f87171` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:447` | `#a78bfa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:458` | `#60a5fa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:459` | `#fbbf24` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:476` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:28` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:60` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:61` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:75` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:76` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:123` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:124` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:149` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:155` | `#fbbf24` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:175` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:217` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:218` | `#fbbf24` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:219` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:230` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:231` | `#fbbf24` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:232` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:241` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:38` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:90` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:91` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:156` | `#4ade80` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:198` | `#f87171` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:249` | `#f87171` |
| `app/[orgSlug]/admin/admin-common.module.css:161` | `#f6c453` |
| `app/[orgSlug]/admin/admin-common.module.css:162` | `#ccff66` |
| `app/[orgSlug]/admin/admin-common.module.css:163` | `#60a5fa` |
| `app/[orgSlug]/admin/admin-common.module.css:168` | `#f6c453` |
| `app/[orgSlug]/admin/admin-common.module.css:169` | `#ccff66` |
| `app/[orgSlug]/admin/admin-common.module.css:190` | `#60a5fa` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:165` | `#a78bfa` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:1184` | `#a78bfa` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:53` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:94` | `#4ade80` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:170` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:259` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:279` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:396` | `#c5f955` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:447` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:713` | `#c5f955` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:770` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:894` | `#4ade80` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:917` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:946` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:971` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:1005` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:1013` | `#86efac` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:1021` | `#f0f0f0` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:1078` | `#fecaca` |
| `app/[orgSlug]/admin/org/billing/billing.module.css:379` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:32` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:80` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:86` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:36` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:65` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:141` | `#4ade80` |
| `app/[orgSlug]/admin/org/members/members.module.css:209` | `#1a1a2e` |
| `app/[orgSlug]/admin/org/members/members.module.css:230` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:241` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:381` | `#4ade80` |
| `app/[orgSlug]/admin/org/members/members.module.css:634` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/members/members.module.css:648` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:36` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:506` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:611` | `#12101e` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:632` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:690` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:711` | `#12101e` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:734` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:755` | `#f0f0f0` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:855` | `#12101e` |
| `app/[orgSlug]/admin/org/venues/venues-admin.module.css:226` | `#e54c4c` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:30` | `#f0f0f0` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:62` | `#60a5fa` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:87` | `#f0f0f0` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:94` | `#60a5fa` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:121` | `#f87171` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:144` | `#60a5fa` |
| `app/[orgSlug]/admin/public-site/public-site.module.css:145` | `#60a5fa` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:200` | `#0f1123` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#fb923c` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#fcd34d` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#4ade80` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#60a5fa` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#c084fc` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:343` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:612` | `#0f1123` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:632` | `#080B14` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:640` | `#F5F7FC` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:671` | `#0F1123` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#fb923c` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#fcd34d` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#4ade80` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#60a5fa` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#c084fc` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:771` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:2000` | `#0b0f14` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:815` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:816` | `#fbbf24` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:865` | `#111111` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:949` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:956` | `#f5f5f5` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:957` | `#1a1f2b` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:908` | `#0a0c12` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:1014` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:1020` | `#fbbf24` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:1229` | `#f87171` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:106` | `#333` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:113` | `#ccc` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:117` | `#000` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:119` | `#333` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:110` | `#0f1123` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:477` | `#fecaca` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:540` | `#0f1123` |
| `app/[orgSlug]/coaches/coaches.module.css:229` | `#f87171` |
| `app/[orgSlug]/coaches/coaches.module.css:233` | `#f87171` |
| `app/[orgSlug]/coaches/coaches.module.css:540` | `#84cc16` |
| `app/[orgSlug]/coaches/coaches.module.css:1922` | `#84cc16` |
| `app/[orgSlug]/coaches/coaches.module.css:1944` | `#84cc16` |
| `app/[orgSlug]/coaches/coaches.module.css:1944` | `#0f1123` |
| `app/[orgSlug]/coaches/coaches.module.css:3118` | `#84cc16` |
| `app/[orgSlug]/coaches/coaches.module.css:3170` | `#84cc16` |
| `app/[orgSlug]/coaches/coaches.module.css:3836` | `#a9bdf5` |
| `app/[orgSlug]/coaches/coaches.module.css:3872` | `#c9e89a` |
| `app/[orgSlug]/coaches/coaches.module.css:3877` | `#a9bdf5` |
| `app/[orgSlug]/coaches/coaches.module.css:3888` | `#a9bdf5` |
| `app/[orgSlug]/coaches/coaches.module.css:3889` | `#7aa2f7` |
| `app/[orgSlug]/coaches/coaches.module.css:3889` | `#7aa2f7` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:36` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:59` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:90` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:354` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:371` | `#f97316` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:418` | `#f97316` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:432` | `#f97316` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:448` | `#60a5fa` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:36` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:59` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:87` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:184` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:204` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:243` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:263` | `#4ade80` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:282` | `#4ade80` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:286` | `#60a5fa` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:315` | `#1a1f2e` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:338` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:404` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:409` | `#60a5fa` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:448` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:468` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:480` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:481` | `#f87171` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:490` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:562` | `#4ade80` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:27` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:54` | `#e2e8f0` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:79` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:124` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:140` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:162` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:173` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:179` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:220` | `#172036` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:239` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:307` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:318` | `#fbbf24` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:349` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:415` | `#f8fafc` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:434` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:449` | `#020617` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:508` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:517` | `#fcd9a3` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:522` | `#e6f5c4` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:548` | `#fca5a5` |
| `app/coaches/coaches-portal.module.css:182` | `#0f1123` |
| `app/coaches/coaches-portal.module.css:188` | `#0f1123` |
| `app/platform-admin/audit/audit.module.css:182` | `#050705` |
| `app/platform-admin/audit/audit.module.css:227` | `#0a0f0a` |
| `app/platform-admin/bulk-operations/bulk-operations.module.css:99` | `#fca5a5` |
| `app/platform-admin/bulk-operations/bulk-operations.module.css:130` | `#fcd34d` |
| `app/platform-admin/bulk-operations/bulk-operations.module.css:136` | `#fca5a5` |
| `app/platform-admin/bulk-operations/bulk-operations.module.css:296` | `#fde68a` |
| `app/platform-admin/change-requests/change-requests.module.css:89` | `#fca5a5` |
| `app/platform-admin/change-requests/change-requests.module.css:95` | `#86efac` |
| `app/platform-admin/change-requests/change-requests.module.css:134` | `#f8fafc` |
| `app/platform-admin/change-requests/change-requests.module.css:138` | `#2563eb` |
| `app/platform-admin/change-requests/change-requests.module.css:298` | `#93c5fd` |
| `app/platform-admin/change-requests/change-requests.module.css:308` | `#fca5a5` |
| `app/platform-admin/change-requests/change-requests.module.css:335` | `#86efac` |
| `app/platform-admin/change-requests/change-requests.module.css:341` | `#93c5fd` |
| `app/platform-admin/change-requests/change-requests.module.css:347` | `#fca5a5` |
| `app/platform-admin/change-requests/change-requests.module.css:358` | `#fca5a5` |
| `app/platform-admin/change-requests/change-requests.module.css:370` | `#93c5fd` |
| `app/platform-admin/change-requests/change-requests.module.css:410` | `#07100b` |
| `app/platform-admin/change-requests/change-requests.module.css:534` | `#bfdbfe` |
| `app/platform-admin/customer-users/customer-users.module.css:190` | `#86efac` |
| `app/platform-admin/customer-users/customer-users.module.css:196` | `#fcd34d` |
| `app/platform-admin/customer-users/customer-users.module.css:260` | `#1a1a1a` |
| `app/platform-admin/customer-users/customer-users.module.css:308` | `#1a1a1a` |
| `app/platform-admin/dev-tools/dev.module.css:27` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:53` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:77` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:178` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:325` | `#86efac` |
| `app/platform-admin/dev-tools/dev.module.css:327` | `#fca5a5` |
| `app/platform-admin/dev-tools/dev.module.css:397` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:408` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:439` | `#86efac` |
| `app/platform-admin/dev-tools/dev.module.css:444` | `#fca5a5` |
| `app/platform-admin/dev-tools/dev.module.css:767` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:796` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:829` | `#ffff00` |
| `app/platform-admin/dev-tools/dev.module.css:945` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:15` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:128` | `#60a5fa` |
| `app/platform-admin/dev-tools/playbook.module.css:132` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:136` | `#a78bfa` |
| `app/platform-admin/dev-tools/playbook.module.css:140` | `#fb923c` |
| `app/platform-admin/dev-tools/playbook.module.css:148` | `#22d3ee` |
| `app/platform-admin/dev-tools/playbook.module.css:152` | `#f472b6` |
| `app/platform-admin/dev-tools/playbook.module.css:156` | `#2dd4bf` |
| `app/platform-admin/dev-tools/playbook.module.css:160` | `#a3e635` |
| `app/platform-admin/dev-tools/playbook.module.css:278` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:399` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:444` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:488` | `#ffff00` |
| `app/platform-admin/dev-tools/playbook.module.css:510` | `#ffff00` |
| `app/platform-admin/early-access/early-access.module.css:345` | `#93c5fd` |
| `app/platform-admin/early-access/early-access.module.css:352` | `#86efac` |
| `app/platform-admin/early-access/early-access.module.css:359` | `#fca5a5` |
| `app/platform-admin/early-access/early-access.module.css:364` | `#fca5a5` |
| `app/platform-admin/early-access/early-access.module.css:370` | `#86efac` |
| `app/platform-admin/email-templates/email-templates.module.css:440` | `#86efac` |
| `app/platform-admin/email/email.module.css:207` | `#4ade80` |
| `app/platform-admin/email/email.module.css:220` | `#f87171` |
| `app/platform-admin/email/email.module.css:232` | `#f87171` |
| `app/platform-admin/email/email.module.css:250` | `#93c5fd` |
| `app/platform-admin/email/email.module.css:284` | `#4ade80` |
| `app/platform-admin/email/email.module.css:374` | `#0b0f14` |
| `app/platform-admin/email/email.module.css:432` | `#0b0f14` |
| `app/platform-admin/email/email.module.css:464` | `#f87171` |
| `app/platform-admin/email/email.module.css:483` | `#4ade80` |
| `app/platform-admin/email/email.module.css:536` | `#4ade80` |
| `app/platform-admin/email/email.module.css:542` | `#f87171` |
| `app/platform-admin/email/email.module.css:583` | `#f87171` |
| `app/platform-admin/email/email.module.css:650` | `#f87171` |
| `app/platform-admin/email/email.module.css:655` | `#f87171` |
| `app/platform-admin/feedback/feedback.module.css:53` | `#0a0f0a` |
| `app/platform-admin/feedback/feedback.module.css:161` | `#050705` |
| `app/platform-admin/feedback/feedback.module.css:228` | `#f87171` |
| `app/platform-admin/feedback/feedback.module.css:246` | `#0a0f0a` |
| `app/platform-admin/feedback/feedback.module.css:252` | `#f87171` |
| `app/platform-admin/observability/observability.module.css:307` | `#0a0f0a` |
| `app/platform-admin/observability/observability.module.css:548` | `#050705` |
| `app/platform-admin/observability/observability.module.css:605` | `#0a0f0a` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:81` | `#86efac` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:82` | `#fcd34d` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:814` | `#86efac` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:917` | `#060807` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:1005` | `#fcd34d` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:1038` | `#fcd34d` |
| `app/platform-admin/orgs/[id]/orgDetail.module.css:1044` | `#fca5a5` |
| `app/platform-admin/orgs/orgs.module.css:134` | `#86efac` |
| `app/platform-admin/orgs/orgs.module.css:320` | `#86efac` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:417` | `#f8fafc` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:421` | `#2563eb` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:470` | `#fca5a5` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:476` | `#86efac` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:930` | `#86efac` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:967` | `#86efac` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:981` | `#93c5fd` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:993` | `#fca5a5` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:1061` | `#93c5fd` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:1276` | `#86efac` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:1453` | `#86efac` |
| `app/platform-admin/plans/plans.module.css:84` | `#86efac` |
| `app/platform-admin/stripe-prices/stripe-prices.module.css:91` | `#86efac` |
| `app/platform-admin/stripe-prices/stripe-prices.module.css:222` | `#86efac` |
| `app/platform-admin/users/users.module.css:352` | `#000` |
| `app/platform-admin/users/users.module.css:410` | `#060807` |
| `components/admin/AdminBottomNav.module.css:85` | `#0f1123` |
| `components/admin/AdminBottomNav.module.css:310` | `#f87171` |
| `components/admin/AdminBottomNav.module.css:311` | `#f87171` |
| `components/admin/CheckInBoard.module.css:207` | `#60a5fa` |
| `components/admin/ExportMenu.module.css:93` | `#7dd3fc` |
| `components/admin/ExportMenu.module.css:103` | `#fbbf24` |
| `components/admin/ExportMenu.module.css:124` | `#fbbf24` |
| `components/admin/TournamentSetupWizard.module.css:19` | `#080b12` |
| `components/admin/TournamentSetupWizard.module.css:62` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:102` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:154` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:344` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:502` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:573` | `#fecaca` |
| `components/admin/TournamentSetupWizard.module.css:595` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:661` | `#f0f0f0` |
| `components/admin/TournamentSetupWizard.module.css:807` | `#f0f0f0` |
| `components/admin/tournament/PersonaPanel.module.css:81` | `#4fa3e0` |
| `components/coaches/AnnouncementEditor.module.css:250` | `#0f1123` |
| `components/coaches/CoachExploreCatalog.module.css:83` | `#0f1123` |
| `components/coaches/CoachesBottomNav.module.css:39` | `#4fa3e0` |
| `components/coaches/CoachesBottomNav.module.css:65` | `#4fa3e0` |
| `components/coaches/CoachesBottomNav.module.css:66` | `#4fa3e0` |
| `components/coaches/CoachesBottomNav.module.css:94` | `#0d111a` |
| `components/coaches/CoachesBottomNav.module.css:136` | `#4fa3e0` |
| `components/coaches/CoachesBottomNav.module.css:151` | `#f87171` |
| `components/coaches/CoachesBottomNav.module.css:152` | `#f87171` |
| `components/coaches/DepthChartBoard.module.css:10` | `#bef264` |
| `components/coaches/DepthChartBoard.module.css:11` | `#93c5fd` |
| `components/coaches/DepthChartBoard.module.css:12` | `#fca5a5` |
| `components/coaches/FeeEditor.module.css:502` | `#0f1123` |
| `components/coaches/FeeEditor.module.css:623` | `#0f1123` |
| `components/coaches/HeadCoachEditor.module.css:130` | `#0f1123` |
| `components/coaches/RosterEditor.module.css:363` | `#0f1123` |
| `components/coaches/ScheduleEditor.module.css:228` | `#0f1123` |
| `components/coaches/ScheduleEditor.module.css:347` | `#0f1123` |
| `components/coaches/TournamentRosterSubmit.module.css:288` | `#0f1123` |
