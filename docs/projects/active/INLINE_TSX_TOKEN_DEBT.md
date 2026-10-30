# Inline Component Colors — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=tsx --report`. Read-only analysis.
> Hardcoded colors in tsx `.tsx` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **78** hardcoded colors across **20** files (69 hex · 9 brand rgba)
- **58** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **0** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **20** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx` — 15
- `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx` — 13
- `app/[orgSlug]/admin/tournaments/branding/page.tsx` — 8
- `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx` — 6
- `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx` — 5
- `app/dev/email-preview/page.tsx` — 5
- `app/global-error.tsx` — 4
- `components/LegacyInstallBanner.tsx` — 4
- `components/coaches/PositionProfileEditor.tsx` — 4
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` — 2
- `app/[orgSlug]/admin/tournaments/staff-kit/page.tsx` — 2
- `components/coaches/UpgradeSummaryBanner.tsx` — 2
- `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx` — 1
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx` — 1
- `app/[orgSlug]/admin/org/settings/pdf/page.tsx` — 1
- `components/coaches/ContinuityCompareCard.tsx` — 1
- `components/feedback/FeedbackLauncher.tsx` — 1
- `components/help/HelpHubClient.tsx` — 1
- `components/public/ShareScoreButton.tsx` — 1
- `components/rep-teams/TryoutDecisionBoard.tsx` — 1

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx:40` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:110` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:142` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:155` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:206` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:233` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:253` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:103` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:115` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:119` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:123` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#FCA5A5` | `--pa-neg` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#FCD34D` | `--pa-caution` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#86EFAC` | `--pa-pos` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(239,68,68)` | `--danger-rgb` / `--pv-danger-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(245,158,11)` | `--warning-rgb` / `--pv-warning-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(34,197,94)` | `--success-rgb` / `--pv-success-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(239,68,68)` | `--danger-rgb` / `--pv-danger-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(245,158,11)` | `--warning-rgb` / `--pv-warning-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(34,197,94)` | `--success-rgb` / `--pv-success-rgb` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:73` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:98` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:103` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:111` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:213` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/org/settings/pdf/page.tsx:325` | `#1e293b` | `--bracket-card` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:96` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:97` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:97` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:394` | `#ffffff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:485` | `#ffffff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:485` | `#ffffff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:485` | `#ffffff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:77` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:83` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:88` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:85` | `rgb(239,68,68)` | `--danger-rgb` / `--pv-danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:85` | `rgb(239,68,68)` | `--danger-rgb` / `--pv-danger-rgb` |
| `app/[orgSlug]/admin/tournaments/staff-kit/page.tsx:86` | `#0a0a0a` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/admin/tournaments/staff-kit/page.tsx:86` | `#ffffff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/dev/email-preview/page.tsx:291` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `app/dev/email-preview/page.tsx:292` | `#f1f5f9` | `--fl-text` |
| `app/dev/email-preview/page.tsx:298` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `app/dev/email-preview/page.tsx:315` | `#f1f5f9` | `--fl-text` |
| `app/dev/email-preview/page.tsx:322` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `app/global-error.tsx:13` | `#615A54` | `--sandbox-warm-dim` |
| `app/global-error.tsx:14` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `app/global-error.tsx:86` | `#FFFFFF` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `components/LegacyInstallBanner.tsx:75` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/LegacyInstallBanner.tsx:79` | `#F1F5F9` | `--fl-text` |
| `components/LegacyInstallBanner.tsx:88` | `#D9F99D` | `--platform-primary-light` / `--primary-light` / `--logic-lime` / `--logic-lime-fixed` |
| `components/LegacyInstallBanner.tsx:76` | `rgb(217,249,157)` | `--logic-lime-rgb` / `--lime-strong-rgb` / `--logic-lime-fixed-rgb` / `--pv-logic-lime-rgb` / `--pv-lime-strong-rgb` |
| `components/coaches/ContinuityCompareCard.tsx:25` | `#fcd34d` | `--pa-caution` |
| `components/coaches/PositionProfileEditor.tsx:53` | `#fca5a5` | `--pa-neg` |
| `components/coaches/UpgradeSummaryBanner.tsx:108` | `#fff` | `--platform-on-primary` / `--white` / `--on-primary` / `--white-fixed` / `--sandbox-warm-card` / `--on-team-color` |
| `components/feedback/FeedbackLauncher.tsx:52` | `#94A3B8` | `--data-gray` |
| `components/public/ShareScoreButton.tsx:66` | `#1E3A8A` | `--platform-primary` |
| `components/rep-teams/TryoutDecisionBoard.tsx:513` | `#fcd34d` | `--pa-caution` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:12` | `#EFC44D` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:110` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:125` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:183` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:196` | `#FF3B30` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:200` | `#FF3B30` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:242` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:103` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:134` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:73` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:85` | `#0A0A12` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:202` | `#1a1f2e` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx:151` | `#f0f0f0` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:51` | `#0a0a12` |
| `app/global-error.tsx:78` | `#4A4235` |
| `components/coaches/PositionProfileEditor.tsx:52` | `#bef264` |
| `components/coaches/PositionProfileEditor.tsx:280` | `#bef264` |
| `components/coaches/PositionProfileEditor.tsx:281` | `#ecfccb` |
| `components/coaches/UpgradeSummaryBanner.tsx:144` | `#bfdbfe` |
| `components/help/HelpHubClient.tsx:127` | `#9654` |
