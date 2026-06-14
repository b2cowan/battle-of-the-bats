# J3-012 + J4-012 Org-Context Fail-Closed Sweep — Edit Convention Spec

> Working spec for the sweep agents. Delete after the sweep lands. Branch: `feat/free-tier-coaches`.

The contract change is already in `lib/api-auth.ts`:
- `AuthContextOptions` now has `requireOrgSlug?: boolean`.
- When `orgSlug` is absent AND `requireOrgSlug: true`, `getAuthContext` returns null (fail closed) instead of first-membership.
- `getAuthContextWithRole` / `getAuthContextWithScope` forward `options` unchanged, so the flag works through them.

## TRANCHE 1 — Admin server routes (`app/api/admin/**`)

These routes are FLAT — no `[orgSlug]` path segment. Read orgSlug from the query string.

For EVERY `getAuthContext` / `getAuthContextWithRole` / `getAuthContextWithScope` call that does
NOT already pass `{ orgSlug }`:

1. Ensure the handler receives the request. The handler is wrapped in `withObservability(async (req: Request, ...) => ...)`.
   - If the handler signature is `async () =>` (no params), change it to `async (req: Request) =>`.
   - If it's `async (req: Request, ...) =>` or `async (req: NextRequest, ...) =>`, leave the signature.
   - If it already builds `const url = new URL(req.url)`, reuse that.
2. Immediately after the handler opens (before the auth call), add:
   ```ts
   const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
   ```
   (If a `const url = new URL(req.url)` already exists, use `url.searchParams.get('orgSlug') ?? undefined` instead of constructing a second URL.)
3. Change the auth call to pass the fail-closed options:
   ```ts
   const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
   ```
   (same for `getAuthContext` / `getAuthContextWithScope`). Preserve the original variable name (`ctx`, `auth`, etc.).
4. Do NOT touch calls that already pass `{ orgSlug }` — instead, ADD `requireOrgSlug: true` to them:
   `{ orgSlug }` → `{ orgSlug, requireOrgSlug: true }`. (These are correct already; the flag documents intent and lets the lint guard pass.)

EDGE CASES:
- Handlers in `[tournamentId]/notification-preferences/route.ts` derive `orgSlug` from a fetched
  `orgRow.slug`. Leave the orgSlug source; just add `requireOrgSlug: true`.
- A route may have multiple handlers (GET/POST/PATCH/DELETE) — fix each.
- Shared helper files (`.../import/shared.ts`) already receive `req` — add orgSlug read + flag.
- Do NOT change gate/capability logic, queries, or anything else. Auth call + signature only.

## TRANCHE 2 — Coach server routes (`app/api/coaches/[orgSlug]/**`)

These have `orgSlug` in the PATH params. The established correct pattern is
`app/api/coaches/[orgSlug]/assignments/route.ts`.

- Most files have a `resolveCoachContext(orgSlug, teamId)` (or similar) helper that calls bare
  `getAuthContext()`. The `orgSlug` is already in scope (passed into the helper). Change:
  `const ctx = await getAuthContext();` → `const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });`
- If the call is directly in the handler, `orgSlug` comes from `await params`. Ensure it's destructured
  (`const { orgSlug } = await params;`) before the auth call, then pass `{ orgSlug, requireOrgSlug: true }`.
- These routes already have a `ctx.org.slug !== orgSlug` guard AFTER the auth call — leave it; it's
  now redundant-but-harmless defense in depth.

## TRANCHE 3 — Client fetches (`app/[orgSlug]/admin/**`, `components/admin/**`, etc.)

Every client `fetch('/api/admin/...')` must carry `?orgSlug=<slug>`.

- Org slug source on the client: `const { currentOrg } = useOrg();` (from `@/lib/org-context`) →
  `currentOrg?.slug`. If the component already has `currentOrg` / an `orgSlug` from `useParams()`, reuse it.
- Append pattern (match the established one in
  `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:516`):
  ```ts
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  ```
  - For a URL with NO existing query string: append `${orgQuery}`.
  - For a URL that ALREADY has a `?` (e.g. `/api/admin/x?from=...`): append
    `&orgSlug=${encodeURIComponent(currentOrg.slug)}`.
- Do NOT add orgSlug to fetches that are NOT `/api/admin/...` (coach `/api/coaches/[orgSlug]/...` already
  carry it in the path; public/billing/auth endpoints are out of scope).
- Preserve method/headers/body exactly. Only the URL changes.

## Out of scope (DO NOT TOUCH)
- `app/api/billing/**`, `app/api/auth/me`, `app/api/registrations/[id]`, `app/api/feedback`,
  `app/[orgSlug]/archives/**` — orgless-by-design; they keep the first-membership fallback.
- platform-admin (separate auth).
- Server-component layouts that already pass `{ orgSlug }` (admin/layout, coaches/layout, etc.).

## Verification per tranche
- `npm run typecheck` after server tranches (shared-module-adjacent).
- `npm run lint:focused -- <changed files>`.
