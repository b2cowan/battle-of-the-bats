# Shared Surfaces — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=shared --report`. Read-only analysis.
> Hardcoded colors in shared `*.module.css` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **60** hardcoded colors across **7** files (51 hex · 9 brand rgba)
- **42** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **0** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **18** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `components/help/help.module.css` — 44
- `components/notifications/PushPermissionPrompt.module.css` — 10
- `components/InstallAppPrompt.module.css` — 2
- `components/TeamAvatar.module.css` — 1
- `components/chat/ChatManagePanel.module.css` — 1
- `components/chat/ChatPanel.module.css` — 1
- `components/chat/CoachChatView.module.css` — 1

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `components/InstallAppPrompt.module.css:75` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/InstallAppPrompt.module.css:88` | `#000` | `--black` |
| `components/TeamAvatar.module.css:8` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/chat/ChatManagePanel.module.css:112` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/chat/ChatPanel.module.css:371` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/chat/CoachChatView.module.css:154` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/help/help.module.css:25` | `#4ade80` | `--success-light` |
| `components/help/help.module.css:31` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/help/help.module.css:40` | `#4ade80` | `--success-light` |
| `components/help/help.module.css:41` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/help/help.module.css:75` | `#4ade80` | `--success-light` |
| `components/help/help.module.css:76` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `components/help/help.module.css:154` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:390` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:459` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:461` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:500` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:538` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:677` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1015` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1095` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1143` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1261` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1276` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1312` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/help/help.module.css:1336` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/help/help.module.css:1354` | `#f1f5f9` | `--fl-text` |
| `components/help/help.module.css:29` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/help/help.module.css:30` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/help/help.module.css:460` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/help/help.module.css:1059` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `components/help/help.module.css:1060` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/notifications/PushPermissionPrompt.module.css:34` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/notifications/PushPermissionPrompt.module.css:41` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/notifications/PushPermissionPrompt.module.css:47` | `#fca5a5` | `--pa-neg` |
| `components/notifications/PushPermissionPrompt.module.css:65` | `#fca5a5` | `--pa-neg` |
| `components/notifications/PushPermissionPrompt.module.css:96` | `#f1f5f9` | `--fl-text` |
| `components/notifications/PushPermissionPrompt.module.css:125` | `#fca5a5` | `--pa-neg` |
| `components/notifications/PushPermissionPrompt.module.css:18` | `rgb(239,68,68)` | `--danger-rgb` |
| `components/notifications/PushPermissionPrompt.module.css:19` | `rgb(239,68,68)` | `--danger-rgb` |
| `components/notifications/PushPermissionPrompt.module.css:25` | `rgb(239,68,68)` | `--danger-rgb` |
| `components/notifications/PushPermissionPrompt.module.css:26` | `rgb(239,68,68)` | `--danger-rgb` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
| `components/help/help.module.css:19` | `#4fa3e0` |
| `components/help/help.module.css:39` | `#4fa3e0` |
| `components/help/help.module.css:68` | `#4fa3e0` |
| `components/help/help.module.css:74` | `#4fa3e0` |
| `components/help/help.module.css:151` | `#4fa3e0` |
| `components/help/help.module.css:164` | `#1a1f2e` |
| `components/help/help.module.css:186` | `#1a1f2e` |
| `components/help/help.module.css:212` | `#1a1f2e` |
| `components/help/help.module.css:553` | `#cbe79a` |
| `components/help/help.module.css:595` | `#4fa3e0` |
| `components/help/help.module.css:845` | `#080c14` |
| `components/help/help.module.css:894` | `#07090f` |
| `components/help/help.module.css:905` | `#07090f` |
| `components/help/help.module.css:1182` | `#cbe79a` |
| `components/help/help.module.css:1199` | `#4fa3e0` |
| `components/help/help.module.css:1380` | `#4fa3e0` |
| `components/help/help.module.css:1396` | `#b9f04a` |
| `components/help/help.module.css:1433` | `#b9f04a` |
