# Inline Component Colors — Token-Debt Inventory

> Auto-generated: `node scripts/check-public-tokens.mjs --scope=tsx --report`. Read-only analysis.
> Hardcoded colors in tsx `.tsx` files that should be `var(--*)` tokens.
> Brand `rgba()` is flagged; `rgba(255,255,255,…)`/`rgba(0,0,0,…)` alphas are not (they are the --white-NN/--black-NN family).

## Summary

- **428** hardcoded colors across **89** files (357 hex · 71 brand rgba)
- **330** map exactly to a current token — dark-identical swaps, verify LIGHT mode
- **19** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first
- **79** have no token match — promote to a token, or annotate `/* token-exempt: why */`

## Worst offenders

- `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx` — 15
- `app/[orgSlug]/league/[seasonSlug]/page.tsx` — 15
- `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx` — 14
- `app/platform-admin/dev-tools/page.tsx` — 14
- `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx` — 13
- `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx` — 13
- `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx` — 13
- `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx` — 12
- `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx` — 12
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx` — 11
- `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx` — 11
- `app/[orgSlug]/scorekeeper/layout.tsx` — 11
- `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx` — 10
- `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx` — 10
- `app/[orgSlug]/admin/tournaments/branding/page.tsx` — 10
- `app/[orgSlug]/admin/org/settings/page.tsx` — 9
- `app/[orgSlug]/archives/[archiveId]/page.tsx` — 9
- `app/[orgSlug]/league/page.tsx` — 9
- `app/platform-admin/change-requests/ChangeRequestsClient.tsx` — 9
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx` — 8

## Exact-token candidates

| File:line | Literal | Candidate token(s) |
|---|---|---|
| `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx:40` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:110` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:142` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:155` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:206` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:233` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:253` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:103` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:115` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:119` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:123` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#FCA5A5` | `--pa-neg` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#FCD34D` | `--pa-caution` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:146` | `#86EFAC` | `--pa-pos` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:147` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx:148` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:67` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:92` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:97` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:104` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx:269` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx:530` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx:595` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:409` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:446` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:446` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:485` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:497` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:558` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:583` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:683` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:683` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx:715` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/page.tsx:694` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/budget/page.tsx:710` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx:408` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/accounting/page.tsx:263` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/accounting/page.tsx:317` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/house-league/page.tsx:277` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/page.tsx:291` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:121` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:122` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:123` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:195` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:198` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx:238` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx:239` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx:723` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:93` | `#22C55E` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:94` | `#F97316` | `--evt-external-tournament` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:95` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:447` | `#22C55E` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:490` | `#22C55E` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:677` | `#F97316` | `--evt-external-tournament` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:760` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:93` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:93` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:447` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx:490` | `rgb(34,197,94)` | `--success-rgb` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:143` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:562` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx:255` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx:257` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx:95` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx:326` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/admin/org/settings/page.tsx:45` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/org/settings/page.tsx:46` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/org/settings/page.tsx:86` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/org/settings/page.tsx:99` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/org/settings/page.tsx:100` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/org/settings/page.tsx:229` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/org/settings/page.tsx:230` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/org/settings/page.tsx:778` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/org/settings/page.tsx:791` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/org/settings/pdf/page.tsx:317` | `#1e293b` | `--bracket-card` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:153` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:203` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:207` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:213` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:214` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:247` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:255` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:289` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:292` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:297` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:331` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:351` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:367` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:420` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:420` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:446` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:458` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:504` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:536` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:642` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:642` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:672` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:88` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:121` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:122` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:130` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:134` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx:134` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/documents/page.tsx:226` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/documents/page.tsx:282` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/documents/page.tsx:282` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/documents/page.tsx:372` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/page.tsx:436` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/page.tsx:545` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/page.tsx:551` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/page.tsx:598` | `#3b82f6` | `--info` / `--evt-scrimmage` |
| `app/[orgSlug]/admin/rep-teams/past/page.tsx:78` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:44` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:45` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:71` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:71` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:230` | `#000` | `--black` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:301` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:322` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:367` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:398` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/rename-slugs/page.tsx:308` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx:34` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx:34` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx:165` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/page.tsx:84` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx:210` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx:217` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/page.tsx:204` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:12` | `#f97316` | `--evt-external-tournament` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:13` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:14` | `#3b82f6` | `--info` / `--evt-scrimmage` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:15` | `#22c55e` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:16` | `#a855f7` | `--evt-practice` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:17` | `#6b7280` | `--evt-team-event` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:82` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:86` | `#22c55e` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:86` | `#ef4444` | `--danger` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:86` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:306` | `#ef4444` | `--danger` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:332` | `#22c55e` | `--success` / `--evt-league-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:332` | `#ef4444` | `--danger` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx:332` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:602` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:624` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:752` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:773` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:794` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:833` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:844` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:873` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:884` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:895` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:968` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:969` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:67` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:68` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:129` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:152` | `#1E3A8A` | `--platform-primary` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:153` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:546` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:547` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:548` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:550` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/admin/tournaments/registrations/page.tsx:2126` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx:1942` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:396` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:492` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:518` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:517` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx:517` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:1012` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:1012` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:1076` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:1006` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:1007` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2208` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2208` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2237` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2584` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2727` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2198` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2201` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/[orgSlug]/admin/tournaments/staff-kit/page.tsx:57` | `#0a0a0a` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/admin/tournaments/staff-kit/page.tsx:57` | `#ffffff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:170` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:189` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:252` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:276` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:277` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:322` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:388` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:408` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/[archiveId]/page.tsx:438` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/page.tsx:90` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/page.tsx:133` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/archives/page.tsx:201` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/[orgSlug]/archives/page.tsx:222` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/check-in/layout.tsx:56` | `#94A3B8` | `--data-gray` |
| `app/[orgSlug]/check-in/layout.tsx:73` | `#F1F5F9` | `--fl-text` |
| `app/[orgSlug]/check-in/layout.tsx:74` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/check-in/layout.tsx:78` | `#94A3B8` | `--data-gray` |
| `app/[orgSlug]/check-in/layout.tsx:89` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/[fundraiserId]/page.tsx:265` | `#a855f7` | `--evt-practice` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/[fundraiserId]/page.tsx:317` | `#a855f7` | `--evt-practice` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/[fundraiserId]/page.tsx:323` | `#f97316` | `--evt-external-tournament` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/page.tsx:195` | `#a855f7` | `--evt-practice` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:355` | `#a855f7` | `--evt-practice` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:406` | `#f97316` | `--evt-external-tournament` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:21` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:22` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:23` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:130` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:215` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:284` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:284` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:292` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:319` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:373` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:370` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:380` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:152` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:245` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:151` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:154` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:109` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:235` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:259` | `#a3e635` | `--logic-lime  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:291` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:291` | `#f87171` | `--danger-light` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:108` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:111` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:204` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:12` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:13` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:14` | `#94a3b8` | `--data-gray` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:29` | `#f1f5f9` | `--fl-text` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:113` | `#f1f5f9` | `--fl-text` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:113` | `#0a0a0a` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:129` | `#fcd34d` | `--pa-caution` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:168` | `#94a3b8` | `--data-gray` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:169` | `#94a3b8` | `--data-gray` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:170` | `#94a3b8` | `--data-gray` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:126` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:127` | `rgb(245,158,11)` | `--warning-rgb` |
| `app/[orgSlug]/league/page.tsx:18` | `#4ade80` | `--success-light` |
| `app/[orgSlug]/league/page.tsx:19` | `#fbbf24` | `--warning-light` |
| `app/[orgSlug]/league/page.tsx:20` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/league/page.tsx:198` | `#60a5fa` | `--info-light` |
| `app/[orgSlug]/league/page.tsx:233` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/scorekeeper/layout.tsx:56` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/scorekeeper/layout.tsx:64` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `app/[orgSlug]/scorekeeper/layout.tsx:70` | `#94A3B8` | `--data-gray` |
| `app/[orgSlug]/scorekeeper/layout.tsx:82` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/scorekeeper/layout.tsx:85` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/scorekeeper/layout.tsx:98` | `#F1F5F9` | `--fl-text` |
| `app/[orgSlug]/scorekeeper/layout.tsx:99` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/scorekeeper/layout.tsx:103` | `#94A3B8` | `--data-gray` |
| `app/[orgSlug]/scorekeeper/layout.tsx:123` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/[orgSlug]/scorekeeper/layout.tsx:63` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/scorekeeper/layout.tsx:84` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx:216` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx:178` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx:180` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx:133` | `#0A0A0A` | `--bg` / `--pitch-black` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx:113` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx:114` | `rgb(163,230,53)` | `--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change` |
| `app/coaches/join/page.tsx:258` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/join/page.tsx:258` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/join/page.tsx:337` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/join/page.tsx:337` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/join/page.tsx:405` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/join/page.tsx:405` | `rgb(34,197,94)` | `--success-rgb` |
| `app/coaches/team/[basicTeamId]/tournaments/page.tsx:62` | `#0f1123` | `--on-lime` |
| `app/dev/email-preview/page.tsx:227` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/dev/email-preview/page.tsx:228` | `#f1f5f9` | `--fl-text` |
| `app/dev/email-preview/page.tsx:234` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `app/dev/email-preview/page.tsx:249` | `#f1f5f9` | `--fl-text` |
| `app/dev/email-preview/page.tsx:256` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/global-error.tsx:31` | `#0a0a0a` | `--bg` / `--pitch-black` |
| `app/global-error.tsx:41` | `#f87171` | `--danger-light` |
| `app/global-error.tsx:54` | `#2563eb` | `--pa-option-checked-bg` |
| `app/global-error.tsx:55` | `#93c5fd` | `--pa-info` |
| `app/global-error.tsx:40` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/global-error.tsx:40` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/page.tsx:372` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:793` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:800` | `#4ade80` | `--success-light` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:800` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:800` | `#f87171` | `--danger-light` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:800` | `#94a3b8` | `--data-gray` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:806` | `#94a3b8` | `--data-gray` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:810` | `#94a3b8` | `--data-gray` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:816` | `#f87171` | `--danger-light` |
| `app/platform-admin/change-requests/ChangeRequestsClient.tsx:821` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/platform-admin/dev-tools/page.tsx:109` | `#86efac` | `--pa-pos` |
| `app/platform-admin/dev-tools/page.tsx:110` | `#93c5fd` | `--pa-info` |
| `app/platform-admin/dev-tools/page.tsx:109` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/page.tsx:109` | `rgb(34,197,94)` | `--success-rgb` |
| `app/platform-admin/dev-tools/page.tsx:110` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/dev-tools/page.tsx:110` | `rgb(59,130,246)` | `--info-rgb` |
| `app/platform-admin/dev-tools/page.tsx:603` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/dev-tools/page.tsx:604` | `rgb(239,68,68)` | `--danger-rgb` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:41` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:41` | `#F1F5F9` | `--fl-text` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:43` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:363` | `#93c5fd` | `--pa-info` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:41` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx:42` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/platform-admin/email-templates/page.tsx:30` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/platform-admin/email/EmailDashboardClient.tsx:185` | `#f87171` | `--danger-light` |
| `app/platform-admin/email/EmailDashboardClient.tsx:267` | `#f87171` | `--danger-light` |
| `app/platform-admin/email/EmailDashboardClient.tsx:715` | `#4ade80` | `--success-light` |
| `app/platform-admin/email/EmailDashboardClient.tsx:716` | `#f59e0b` | `--warning` / `--evt-tournament-game` |
| `app/platform-admin/email/EmailDashboardClient.tsx:717` | `#f87171` | `--danger-light` |
| `app/platform-admin/email/EmailDashboardClient.tsx:815` | `#f87171` | `--danger-light` |
| `app/platform-admin/email/EmailDashboardClient.tsx:280` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/platform-admin/observability/CallsVsErrorsChart.tsx:62` | `#f87171` | `--danger-light` |
| `app/platform-admin/observability/CallsVsErrorsChart.tsx:65` | `#f87171` | `--danger-light` |
| `app/platform-admin/observability/CallsVsErrorsChart.tsx:80` | `#f87171` | `--danger-light` |
| `app/tryout-response/[token]/page.tsx:24` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `app/tryout-response/[token]/page.tsx:24` | `#F1F5F9` | `--fl-text` |
| `app/tryout-response/[token]/page.tsx:25` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/tryout-response/[token]/page.tsx:139` | `#fbbf24` | `--warning-light` |
| `app/tryout-response/[token]/page.tsx:25` | `rgb(30,58,138)` | `--platform-primary-rgb` / `--primary-rgb` / `--blueprint-blue-rgb` |
| `app/unsubscribe/confirmed/page.tsx:50` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `app/unsubscribe/confirmed/page.tsx:61` | `#F1F5F9` | `--fl-text` |
| `app/unsubscribe/confirmed/page.tsx:84` | `#F1F5F9` | `--fl-text` |
| `app/unsubscribe/confirmed/page.tsx:36` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/unsubscribe/confirmed/page.tsx:44` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `app/unsubscribe/confirmed/page.tsx:117` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/LegacyInstallBanner.tsx:75` | `#111827` | `--bg-3` / `--surface` / `--hud-surface` |
| `components/LegacyInstallBanner.tsx:79` | `#F1F5F9` | `--fl-text` |
| `components/LegacyInstallBanner.tsx:88` | `#D9F99D` | `--primary-light` / `--logic-lime` |
| `components/LegacyInstallBanner.tsx:76` | `rgb(217,249,157)` | `--logic-lime-rgb` |
| `components/coaches/ContinuityCompareCard.tsx:25` | `#fcd34d` | `--pa-caution` |
| `components/coaches/PositionProfileEditor.tsx:42` | `#93c5fd` | `--pa-info` |
| `components/coaches/PositionProfileEditor.tsx:43` | `#fca5a5` | `--pa-neg` |
| `components/coaches/StartNextSeasonModal.tsx:167` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/coaches/StartNextSeasonModal.tsx:167` | `rgb(245,158,11)` | `--warning-rgb` |
| `components/coaches/UpgradeSummaryBanner.tsx:108` | `#fff` | `--white` / `--on-primary` / `--on-team-color` |
| `components/feedback/FeedbackLauncher.tsx:44` | `#94A3B8` | `--data-gray` |
| `components/public/ShareScoreButton.tsx:79` | `#1E3A8A` | `--platform-primary` |
| `components/rep-teams/TryoutDecisionBoard.tsx:240` | `#fcd34d` | `--pa-caution` |
| `components/volunteer/ShellSignOutButton.tsx:39` | `#94A3B8` | `--data-gray` |

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
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:67` | `#0A0A12` |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx:79` | `#0A0A12` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:114` | `#f0f0f0` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:177` | `#f0f0f0` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:181` | `#f0f0f0` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx:162` | `#1a1a2e` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:132` | `#1a1f2e` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx:167` | `#f0f0f0` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx:239` | `#f0f0f0` |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx:71` | `#1a1f2e` |
| `app/[orgSlug]/admin/org/tournaments/page.tsx:697` | `#f6c453` |
| `app/[orgSlug]/admin/rep-teams/page.tsx:331` | `#facc15` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:43` | `#facc15` |
| `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx:229` | `#facc15` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx:331` | `#a78bfa` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/page.tsx:271` | `#f0f0f0` |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx:651` | `#f0f0f0` |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx:20` | `#0a0a12` |
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx:2145` | `#0d0f18` |
| `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx:248` | `#add` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:650` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:852` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:858` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:861` | `#f0f0f0` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/payment-requests/page.tsx:34` | `#facc15` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/payment-requests/page.tsx:39` | `#facc15` |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/payment-requests/page.tsx:215` | `#facc15` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:24` | `#a78bfa` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:142` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx:262` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/register/page.tsx:87` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:124` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:233` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:279` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:74` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:235` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:246` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx:344` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx:162` | `#f0f0f0` |
| `app/[orgSlug]/league/[seasonSlug]/status/page.tsx:57` | `#f0f0f0` |
| `app/[orgSlug]/league/page.tsx:21` | `#a78bfa` |
| `app/[orgSlug]/league/page.tsx:92` | `#f0f0f0` |
| `app/[orgSlug]/league/page.tsx:211` | `#f0f0f0` |
| `app/[orgSlug]/league/page.tsx:312` | `#e0e0e0` |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx:97` | `#f0f0f0` |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx:206` | `#f0f0f0` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx:71` | `#f0f0f0` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx:153` | `#4fa3e0` |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx:72` | `#f0f0f0` |
| `app/global-error.tsx:32` | `#e5e5e5` |
| `app/global-error.tsx:45` | `#9ca3af` |
| `app/layout.tsx:59` | `#0a0a0f` |
| `app/platform-admin/dev-tools/page.tsx:111` | `#fde68a` |
| `app/platform-admin/dev-tools/page.tsx:112` | `#a5b4fc` |
| `app/platform-admin/dev-tools/page.tsx:113` | `#a5b4fc` |
| `app/platform-admin/dev-tools/page.tsx:114` | `#f9a8d4` |
| `app/platform-admin/dev-tools/page.tsx:1377` | `#f0f0f0` |
| `app/platform-admin/dev-tools/page.tsx:1399` | `#ffff00` |
| `app/tryout-response/[token]/page.tsx:24` | `#0b0f14` |
| `app/tryout-response/[token]/page.tsx:145` | `#0b0f14` |
| `app/unsubscribe/confirmed/page.tsx:26` | `#0b0f14` |
| `components/coaches/CoachThemeColor.tsx:19` | `#0a0a0f` |
| `components/coaches/PositionProfileEditor.tsx:41` | `#bef264` |
| `components/coaches/PositionProfileEditor.tsx:148` | `#f7fee7` |
| `components/coaches/PositionProfileEditor.tsx:170` | `#bef264` |
| `components/coaches/PositionProfileEditor.tsx:171` | `#ecfccb` |
| `components/coaches/UpgradeSummaryBanner.tsx:144` | `#bfdbfe` |
| `components/consumer/ConsumerThemeManager.tsx:31` | `#0a0a0f` |
| `components/help/HelpHubClient.tsx:127` | `#9654` |
| `components/rep-teams/TryoutRubricCard.tsx:162` | `#f0f0f0` |
