# Consumer App — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=consumer --report`. Read-only analysis.
> Hardcoded colors in consumer `*.module.css` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **43** hardcoded colors across **8** files (21 hex · 22 brand rgba)
- **37** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **2** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **4** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `app/(consumer)/auth/auth.module.css` — 23
- `components/consumer/AppearanceCard.module.css` — 8
- `components/home/PendingInvitationsCard.module.css` — 4
- `components/consumer/ScoresClient.module.css` — 3
- `components/consumer/HomePersonalization.module.css` — 2
- `app/(consumer)/chat/chat-inbox.module.css` — 1
- `app/(consumer)/discover/page.module.css` — 1
- `components/consumer/FollowingList.module.css` — 1

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/(consumer)/auth/auth.module.css:157` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/(consumer)/auth/auth.module.css:172` | `#f87171` | `--danger-light` |
| `app/(consumer)/auth/auth.module.css:327` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/(consumer)/auth/auth.module.css:29` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:36` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:37` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:81` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:82` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:91` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:137` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:166` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/(consumer)/auth/auth.module.css:167` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/(consumer)/auth/auth.module.css:179` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:180` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:207` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:223` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/(consumer)/auth/auth.module.css:224` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/(consumer)/auth/auth.module.css:236` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:237` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:265` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:266` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:294` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/auth/auth.module.css:310` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/(consumer)/chat/chat-inbox.module.css:118` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/(consumer)/discover/page.module.css:560` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/AppearanceCard.module.css:82` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/AppearanceCard.module.css:83` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/AppearanceCard.module.css:88` | `#0a0a0a` | `--bg` / `--pitch-black` |
| `components/consumer/AppearanceCard.module.css:90` | `#1e293b` | `--bracket-card` |
| `components/consumer/AppearanceCard.module.css:91` | `#d9f99d` | `--primary-light` / `--logic-lime` |
| `components/consumer/FollowingList.module.css:96` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/HomePersonalization.module.css:214` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/HomePersonalization.module.css:260` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/ScoresClient.module.css:115` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/ScoresClient.module.css:239` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/consumer/ScoresClient.module.css:363` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/home/PendingInvitationsCard.module.css:114` | `#fca5a5` | `--pa-neg` |
| `components/home/PendingInvitationsCard.module.css:4` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/home/PendingInvitationsCard.module.css:5` | `rgb(217,249,157)` | `--logic-lime-rgb` |

## No token match — decide per-instance

| File:line | Literal |
|---|---|
| `components/consumer/AppearanceCard.module.css:81` | `#f8f4ed` |
| `components/consumer/AppearanceCard.module.css:84` | `#57651e` |
| `components/consumer/AppearanceCard.module.css:89` | `#0f1115` |
| `components/home/PendingInvitationsCard.module.css:92` | `#c7ed6f` |
