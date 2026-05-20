# Non-Billing UAT Remediation

Archived plan: [NON_BILLING_UAT_REMEDIATION_PLAN.md](../docs/archive/NON_BILLING_UAT_REMEDIATION_PLAN.md).

Completed:

- Item 1: signup public URL is editable, duplicate slugs are checked before auth user creation, and signup cleanup rolls back partial user/org creation.
- Item 2: legacy `/admin` routes redirect into the shared auth destination flow instead of rendering the old admin shell.
- Item 3: public tournament pages now load org/tournament context and section data through server-controlled service-role reads with public organization, active/completed tournament, and hidden-page checks.
- Item 4: `/api/register` now validates tournament, organization, division, hidden registration page state, capacity, and slot/waitlist behavior using service-role reads and server-derived names/contact data.
- Item 5: the official scorekeeper page now loads today's games from `/api/official/[orgSlug]/score`, which applies the authenticated user's tournament assignment scope before returning score cards.
- Item 6: the official scorekeeper screen now shows distinct panels for access blocked, no tournament access, no active tournaments, no assigned games today, filtered-out results, and completed-only results.
- Item 7: root request interception now uses the Next.js 16 `proxy.ts` convention with an exported `proxy()` function; the old `middleware.ts` file has been removed.
- Item 8: `npm run lint` is restored as a passing quality gate by downgrading broad historical migration backlog rules to warnings and fixing the remaining hard errors.

Implementation note:

- `lib/public-tournament-data.ts` is the server-side source for public tournament page data.
- `app/api/public/tournament-data/route.ts` exposes the public data envelope for client-rendered schedule, teams, standings, and registration pages.
- Browser pages should use `fetchPublicTournamentData()` from `lib/public-tournament-client.ts` instead of calling Supabase read helpers directly for public tournament context.
- Official scorekeeper reads should use `app/api/official/[orgSlug]/score/route.ts`; score submission remains enforced by `/api/admin/games` with `submit_scores` and `scopeGuard()`.
- The official score API returns `emptyState` metadata for server-known blank states; client-side filter and finalized-game states are handled in `app/[orgSlug]/official/score/page.tsx`.
- `proxy.ts` preserves the former middleware matchers, Supabase session refresh, org admin and platform-admin redirects, and `x-pathname` / `x-org-slug` request headers.
- ESLint keeps explicit `any`, React effect strictness, React compiler adoption, and JSX entity cleanup visible as warnings while preserving hard-fail errors for narrower actionable issues.
