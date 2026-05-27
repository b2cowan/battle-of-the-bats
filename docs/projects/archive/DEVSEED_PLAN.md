# Dev Seed Dashboard — Implementation Plan

## Location
`/dev` — standalone page, gated by `NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'`.
DevPlanSwitcher widget gains a "Dev Tools →" link.

## Seed Cards (dependency order)

| Card | Creates | Depends On |
|---|---|---|
| Platform Admin | `platform@dev.local` auth user + platform_users row | nothing |
| Org + Owner | `dev-test-org` org + `owner@dev.local` auth user | nothing |
| User Set | admin/staff/coach/league-admin @dev.local → org members | org exists |
| Tournament | 1 tournament + 2 age groups + 8 teams + 12 games | org exists |
| House League | 1 season + 2 divisions + 6 teams + 4 registrations + games | org exists |
| Rep Team | 1 team + 1 program year + 3 players + 2 events | org exists |

All passwords: `devpass123`
All slugs are fixed so seeds are idempotent.

## API Routes
- `GET  /api/dev/seed/status`          — returns counts + org context
- `POST /api/dev/seed/platform-user`   — seed platform admin
- `POST /api/dev/seed/org`             — seed org + owner
- `POST /api/dev/seed/users`           — seed user set
- `POST /api/dev/seed/tournament`      — seed tournament with schedule
- `POST /api/dev/seed/house-league`    — seed HL season
- `POST /api/dev/seed/rep-team`        — seed rep team
- `POST /api/dev/seed/wipe`            — wipe everything (org cascade + auth.users)

All routes return 404 if NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true'.

## UI
- `/dev/page.tsx` — client component, fetches status on load + after each action
- `/dev/dev.module.css` — dark dev-yellow theme
- Cards show: description, current count, dependency lock reason, Seed button
- Inline log panel shows result of last action
- Danger Zone section has Wipe Everything button with confirm dialog
