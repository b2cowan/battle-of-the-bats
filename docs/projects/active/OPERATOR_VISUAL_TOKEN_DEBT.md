# Operator Visual Cleanup — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=operator --report`. Read-only analysis.
> Hardcoded colors in operator `*.module.css` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **319** hardcoded colors across **49** files (203 hex · 116 brand rgba)
- **162** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **52** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **105** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `components/rep-teams/TryoutDayCard.module.css` — 32
- `components/rep-teams/TryoutFlowHeader.module.css` — 24
- `app/platform-admin/dev-tools/dev.module.css` — 23
- `components/rep-teams/TryoutCheckIn.module.css` — 20
- `app/[orgSlug]/scorekeeper/scorekeeper.module.css` — 17
- `components/rep-teams/TryoutAcceptDrawer.module.css` — 17
- `app/[orgSlug]/admin/admin-common.module.css` — 14
- `app/tryout-score/[token]/tryout-score.module.css` — 13
- `app/[orgSlug]/admin/org/members/members.module.css` — 12
- `app/platform-admin/dev-tools/playbook.module.css` — 12
- `app/[orgSlug]/admin/tournaments/branding/branding.module.css` — 10
- `components/accounting/UpcomingPayablesPanel.module.css` — 9
- `components/notifications/notifications.module.css` — 8
- `app/platform-admin/email/email.module.css` — 7
- `app/[orgSlug]/admin/admin.module.css` — 6
- `app/[orgSlug]/admin/onboarding/onboarding.module.css` — 6
- `app/platform-admin/email-templates/email-templates.module.css` — 6
- `app/platform-admin/users/users.module.css` — 6
- `components/notifications/EnablePushBanner.module.css` — 6
- `components/notifications/notifications-page.module.css` — 5

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/admin/admin-common.module.css:176` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:176` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:199` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:199` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:201` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:201` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:202` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:202` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:212` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:212` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:213` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin-common.module.css:213` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin.module.css:158` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin.module.css:159` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin.module.css:160` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/admin.module.css:164` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/admin.module.css:165` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/admin.module.css:166` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:3` | `#86efac` | `--pa-pos` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:19` | `#86efac` | `--pa-pos` |
| `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:11` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:12` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:192` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:193` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:539` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:540` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:562` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:563` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:610` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:611` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:616` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:617` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:624` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/members/members.module.css:625` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:348` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:349` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:871` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/org/settings/settings.module.css:872` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#fcd34d` | `--pa-caution` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:617` | `#0F1123` | `--on-lime` |
| `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:858` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1290` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:441` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:507` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:1663` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:119` | `#000` | `--black` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:477` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:480` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/coaches/coaches.module.css:237` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css:3` | `#f97316` | `--evt-external-tournament` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:8` | `#f8fafc` | `--pa-option-text` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:13` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:16` | `#fca5a5` | `--pa-neg` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:199` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:200` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:201` | `rgb(59,130,246)` | `--info-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:286` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:287` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:329` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:527` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:528` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/change-requests/change-requests.module.css:299` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:165` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:166` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:189` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:190` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:201` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:202` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:380` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:385` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:395` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:409` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:429` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:430` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:437` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:617` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:618` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:629` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:629` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:646` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:647` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:1010` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:1011` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/dev.module.css:1012` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/playbook.module.css:132` | `#60a5fa` | `--info-light` |
| `app/platform-admin/dev-tools/playbook.module.css:164` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/platform-admin/dev-tools/playbook.module.css:126` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/playbook.module.css:130` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/dev-tools/playbook.module.css:146` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/playbook.module.css:162` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/platform-admin/email-templates/email-templates.module.css:394` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/email-templates/email-templates.module.css:395` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/email-templates/email-templates.module.css:402` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/email-templates/email-templates.module.css:493` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email-templates/email-templates.module.css:494` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email-templates/email-templates.module.css:495` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:216` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:217` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:240` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:241` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:568` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/email/email.module.css:569` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/platform-admin/login/platform-login.module.css:120` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/login/platform-login.module.css:121` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:116` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/plans-pricing/plans-pricing.module.css:1032` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/users/users.module.css:353` | `#000` | `--black` |
| `app/platform-admin/users/users.module.css:206` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/users/users.module.css:207` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/users/users.module.css:369` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/users/users.module.css:370` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/users/users.module.css:376` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/tryout-score/[token]/tryout-score.module.css:6` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/tryout-score/[token]/tryout-score.module.css:15` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/tryout-score/[token]/tryout-score.module.css:40` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:67` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:75` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:108` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:109` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:110` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/tryout-score/[token]/tryout-score.module.css:123` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/tryout-score/[token]/tryout-score.module.css:124` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/tryout-score/[token]/tryout-score.module.css:41` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/accounting/BudgetItemPicker.module.css:44` | `#60a5fa` | `--info-light` |
| `components/accounting/UpcomingPayablesPanel.module.css:149` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/accounting/UpcomingPayablesPanel.module.css:314` | `#f97316` | `--evt-external-tournament` |
| `components/accounting/UpcomingPayablesPanel.module.css:315` | `#f97316` | `--evt-external-tournament` |
| `components/admin/AdminBottomNav.module.css:311` | `rgb(239,68,68)` | `--danger-rgb` |
| `components/admin/tournament/TournamentAdminUI.module.css:458` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/admin/tournament/TournamentAdminUI.module.css:459` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/coaches/CoachesBottomNav.module.css:157` | `rgb(239,68,68)` | `--danger-rgb` |
| `components/coaches/DepthChartBoard.module.css:15` | `#93c5fd` | `--pa-info` |
| `components/coaches/DepthChartBoard.module.css:16` | `#fca5a5` | `--pa-neg` |
| `components/feedback/FeedbackWidget.module.css:73` | `#f1f5f9` | `--fl-text` |
| `components/feedback/FeedbackWidget.module.css:87` | `#0a0f0a` | `--pa-option-bg` |
| `components/feedback/FeedbackWidget.module.css:100` | `#f87171` | `--danger-light` |
| `components/notifications/EnablePushBanner.module.css:47` | `#fca5a5` | `--pa-neg` |
| `components/notifications/EnablePushBanner.module.css:17` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/notifications/EnablePushBanner.module.css:18` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/notifications/notifications-page.module.css:148` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/notifications/notifications-page.module.css:165` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications-page.module.css:172` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications-page.module.css:210` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications-page.module.css:255` | `#1E3A8A` | `--platform-primary` |
| `components/notifications/notifications.module.css:41` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/notifications/notifications.module.css:64` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/notifications/notifications.module.css:116` | `#1E3A8A` | `--platform-primary` |
| `components/notifications/notifications.module.css:226` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications.module.css:233` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications.module.css:250` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/notifications/notifications.module.css:285` | `#1E3A8A` | `--platform-primary` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:65` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:79` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:82` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:87` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:98` | `#f87171` | `--danger-light` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:108` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:118` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:119` | `#fbbf24` | `--warning-light` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:129` | `#fbbf24` | `--warning-light` |
| `components/rep-teams/TryoutCheckIn.module.css:16` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutCheckIn.module.css:36` | `#4ade80` | `--success-light` |
| `components/rep-teams/TryoutCheckIn.module.css:45` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:54` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:70` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:92` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:92` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutCheckIn.module.css:95` | `#4ade80` | `--success-light` |
| `components/rep-teams/TryoutCheckIn.module.css:101` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:125` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutCheckIn.module.css:71` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:50` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:71` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:89` | `#f87171` | `--danger-light` |
| `components/rep-teams/TryoutDayCard.module.css:108` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:141` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:158` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:186` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:201` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:230` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:230` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:230` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutDayCard.module.css:231` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutDayCard.module.css:232` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutDayCard.module.css:235` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:250` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:251` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:394` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/rep-teams/TryoutDayCard.module.css:399` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/rep-teams/TryoutDayCard.module.css:47` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:49` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:54` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:251` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutDayCard.module.css:254` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:25` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:29` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:37` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:37` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutFlowHeader.module.css:46` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:69` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:76` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:76` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutFlowHeader.module.css:77` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:77` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `components/rep-teams/TryoutFlowHeader.module.css:79` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:92` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:99` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:25` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:26` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `components/rep-teams/TryoutFlowHeader.module.css:46` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
| `app/[orgSlug]/admin/accounting/accounting.module.css:4` | `#a78bfa` |
| `app/[orgSlug]/admin/accounting/accounting.module.css:5` | `#1a1f2e` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css:28` | `#f0f0f0` |
| `app/[orgSlug]/admin/accounting/budget/budget.module.css:38` | `#f0f0f0` |
| `app/[orgSlug]/admin/admin-common.module.css:6` | `#f6c453` |
| `app/[orgSlug]/admin/admin-common.module.css:7` | `#ccff66` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:165` | `#a78bfa` |
| `app/[orgSlug]/admin/house-league/house-league.module.css:1162` | `#a78bfa` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:2` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:4` | `#fecaca` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:18` | `#080b12` |
| `app/[orgSlug]/admin/onboarding/onboarding.module.css:20` | `#fecaca` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#fb923c` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:310` | `#c084fc` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:576` | `#080B14` |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css:585` | `#F5F7FC` |
| `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1822` | `#0b0f14` |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:1104` | `#111111` |
| `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:825` | `#0a0c12` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:108` | `#333` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:115` | `#ccc` |
| `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css:121` | `#333` |
| `app/[orgSlug]/admin/tournaments/summary/summary.module.css:4` | `#fecaca` |
| `app/[orgSlug]/coaches/coaches.module.css:98` | `#a9bdf5` |
| `app/[orgSlug]/coaches/coaches.module.css:99` | `#7aa2f7` |
| `app/[orgSlug]/coaches/coaches.module.css:100` | `#c9e89a` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css:3` | `#1a1f2e` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:9` | `#e2e8f0` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:10` | `#cbd5e1` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:11` | `#172036` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:12` | `#020617` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:14` | `#fcd9a3` |
| `app/[orgSlug]/scorekeeper/scorekeeper.module.css:15` | `#e6f5c4` |
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
| `app/platform-admin/email/email.module.css:3` | `#0b0f14` |
| `app/tryout-score/[token]/tryout-score.module.css:7` | `#f0f0f0` |
| `app/tryout-score/[token]/tryout-score.module.css:101` | `#f0f0f0` |
| `components/accounting/BudgetItemPicker.module.css:36` | `#f0f0f0` |
| `components/accounting/BudgetItemPicker.module.css:47` | `#1a1f2e` |
| `components/accounting/PayeeCombobox.module.css:88` | `#1a1f2e` |
| `components/accounting/PayeeCombobox.module.css:135` | `#4fa3e0` |
| `components/accounting/UpcomingPayablesPanel.module.css:64` | `#4fa3e0` |
| `components/accounting/UpcomingPayablesPanel.module.css:219` | `#4fa3e0` |
| `components/accounting/UpcomingPayablesPanel.module.css:309` | `#facc15` |
| `components/accounting/UpcomingPayablesPanel.module.css:310` | `#facc15` |
| `components/accounting/UpcomingPayablesPanel.module.css:329` | `#facc15` |
| `components/accounting/UpcomingPayablesPanel.module.css:330` | `#facc15` |
| `components/admin/TournamentSetupWizard.module.css:2` | `#080b12` |
| `components/admin/TournamentSetupWizard.module.css:3` | `#fecaca` |
| `components/billing/PlanArticlePanel.module.css:27` | `#0e1117` |
| `components/billing/PlanArticlePanel.module.css:68` | `#f0f0f0` |
| `components/billing/PlanArticlePanel.module.css:90` | `#f0f0f0` |
| `components/billing/PlanArticlePanel.module.css:108` | `#f0f0f0` |
| `components/billing/UpgradeGate.module.css:10` | `#b8ff57` |
| `components/billing/UpgradeGate.module.css:17` | `#b8ff57` |
| `components/coaches/CoachesBottomNav.module.css:6` | `#0d111a` |
| `components/coaches/DepthChartBoard.module.css:14` | `#bef264` |
| `components/notifications/EnablePushBanner.module.css:40` | `#f0f0f0` |
| `components/notifications/EnablePushBanner.module.css:57` | `#0b1220` |
| `components/notifications/EnablePushBanner.module.css:89` | `#f0f0f0` |
| `components/notifications/notifications.module.css:199` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:15` | `#141414` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:25` | `#141414` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:28` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:37` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:50` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:61` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:108` | `#f0f0f0` |
| `components/rep-teams/TryoutAcceptDrawer.module.css:126` | `#141414` |
| `components/rep-teams/TryoutCheckIn.module.css:24` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:32` | `#c7d2fe` |
| `components/rep-teams/TryoutCheckIn.module.css:43` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:54` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:78` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:81` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:114` | `#141414` |
| `components/rep-teams/TryoutCheckIn.module.css:117` | `#f0f0f0` |
| `components/rep-teams/TryoutCheckIn.module.css:123` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:23` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:76` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:88` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:108` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:121` | `#141414` |
| `components/rep-teams/TryoutDayCard.module.css:126` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:138` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:205` | `#f0f0f0` |
| `components/rep-teams/TryoutDayCard.module.css:219` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:13` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:19` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:30` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:39` | `#b6ef5a` |
| `components/rep-teams/TryoutFlowHeader.module.css:47` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:69` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:90` | `#f0f0f0` |
| `components/rep-teams/TryoutFlowHeader.module.css:96` | `#f0f0f0` |
