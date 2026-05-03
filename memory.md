# Tournament Management System: Battle of the Bats

## Business Overview
- **Tournament**: "Battle of the Bats," a youth softball tournament hosted by the Milton Bats.
- **Goal**: A professional, high-performance platform for team registrations, scheduling, results tracking, and public engagement across multiple age divisions (U11-U19).

## Technical Architecture
- **Stack**: Next.js (App Router), TypeScript, Supabase (Database & Auth), AWS Amplify (CI/CD Hosting).
- **Package Manager**: pnpm (v10+).
- **Deployment Strategy**: 
  - `dev` branch for local development and testing.
  - `master` branch for production (Amplify deployment).
  - **CRITICAL**: Never push or commit to the `master` branch automatically. Deployment to `master` must only occur when explicitly requested by the USER.
  - `.npmrc` configured to automatically approve built dependencies (e.g., `sharp`) for seamless Amplify builds.
- **Testing Protocol**:
  - The user is responsible for all visual verification and browser-based testing unless explicitly requested otherwise.
  - The AI model's role is to provide a list of recommended test cases/tasks to ensure full coverage of changes.

## Data Model & Unified Lifecycle
- **Single Source of Truth**: Successfully migrated from a dual-table system to a unified `teams` table. 
- **Team Workflow**: Signups enter as `pending` or `waitlist` (based on division capacity). Admin approval moves them to `accepted`, which automatically triggers:
  - Public visibility on the "Teams" page and in the "Schedule."
  - Generation of a public Team Profile.
- **Key Tables**:
  - `teams`: Unified registration and roster data (no legacy pool suffixes).
  - `age_groups`: Division settings (capacity, pool counts, coordinator links).
  - `games`: Scheduling, diamond assignments, and score tracking (`game_date`, `game_time`).
  - `tournaments`: Multi-year support; system enforces only one "Live" tournament at a time.

## Key Technical Lessons & Constraints
- **Supabase Ambiguity**: When multiple foreign keys point to the same table (e.g., `home_team_id` and `away_team_id`), queries MUST use explicit relationship naming (e.g., `teams!games_home_team_id_fkey`) to avoid "Multiple Choices" errors.
- **Local Dev**: Requires a `.env.local` file with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for full administrative and public API testing.
- **UI/UX**: Public-facing team names are clean. All pool assignments are handled exclusively via the `pool_id` relationship to the `pools` table.
- **Notifications**: All pop-up notifications, alerts, and confirmations MUST use the custom application-styled components (e.g., `FeedbackModal`) rather than default browser `alert()` or `confirm()` dialogs. This ensures a premium, integrated experience across all administrative workflows.
- **Pool Logic**: Divisions either have 0 pools or at least 2 pools. If `poolCount < 2`, all pool UI elements are hidden on both admin and public pages.
- **Scheduling**: The schedule generator and results entry only pull teams with `status = 'accepted'`.
- **Time Formatting**: All game times MUST be displayed in a 12-hour format (e.g., "6:00 PM") using the `formatTime` utility. Avoid 24-hour formats in the UI to ensure consistency for users.
- **AI Token Efficiency**: To avoid hitting rate limits on large files, prefer `replace_file_content` for surgical, line-specific edits instead of rewriting entire files with `write_to_file`. This is especially critical for large components like `page.tsx` or `db.ts`.


## Future Considerations
- **Double Elimination Brackets**: The playoff system currently supports single elimination only. Double elimination (with a losers bracket and cross-connections) should be revisited once the custom bracket builder is stable. This would require extending the bracket canvas to render a parallel losers bracket with merge points back into the winners bracket.

## Multi-Tenancy Implementation Status (as of May 2026)

### Completed
- **Phase 1 — Auth Foundation**: Supabase Auth replaces hardcoded credentials. `middleware.ts` guards `/admin/*`. `OrgProvider` context. `/auth/login` and `/auth/signup` pages. `/api/auth/signup` route creates user + org + member atomically.
- **Phase 2 — API Security + RLS**: `lib/api-auth.ts` shared helper guards all `/api/admin/*` routes. `supabase/migrations/002_rls.sql` enables RLS on all 11 tables with public-read + org-member-write policies. Registrations endpoint scoped to org. Plan limit enforced on tournament creation.
- **RLS Bug Fix**: `getOrganizationByUserId` used anon client which can't read `organization_members` under RLS. Fixed: `api-auth.ts` uses `supabaseAdmin`; `org-context.tsx` uses browser client (JWT attached).

### Branch State
- `master`: Phase 1 + Phase 2 (without 401 fix — the fix is on dev only)
- `dev`: Everything above including the 401 fix. **Deploy dev → master before starting Phase 3.**

### Manual Steps Still Required
- Run `supabase/migrations/002_rls.sql` in Supabase SQL Editor if not yet done (enables RLS)
- Confirm registrations page loads after 401 fix is deployed to master

### Next: Phase 3 — Multi-Org Routing & Page Migration
See `MULTI_TENANT_ARCHITECTURE.md` Section 8, Phase 3 for full task list. Summary:
- Add `[orgSlug]` dynamic segment: all public pages move under `app/[orgSlug]/`
- New `app/[orgSlug]/layout.tsx` resolves slug → org via DB, provides OrgContext
- Add 301 redirects: `/schedule` → `/milton-softball/schedule`, etc.
- Update middleware to attach `x-org-id` header from slug
- Move admin pages to `app/[orgSlug]/admin/` (protected by org membership)
- Update `lib/db.ts` calls to accept and filter by `orgId`
- Backward-compat: Milton Softball slug is `milton-softball`

### Key Org Data
- Organization name: Milton Softball Association
- Organization slug: `milton-softball` (set during signup or migration)
- All existing tournaments linked to this org via `organization_id`

## Workspace State (as of April 2026)
- The unified database migration is complete and verified.
- Deployment issues regarding pnpm script approvals are resolved via `.npmrc`.
- API routes for profiles and stats are optimized for the unified schema and robust against relationship ambiguity.
- **Task Tracking**: A [TODO.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/TODO.md) file is maintained in the root to track active development tasks across model sessions.
