# Tournament Limit & URL Restructuring Plan

## Decisions Made
- **Limit model (1C):** Active-only gating. Archives are free. `tournament_limit` on orgs = max simultaneous `active` tournaments.
- **Status model (2C):** Replace `is_active: boolean` with `status: 'draft' | 'active' | 'completed' | 'archived'`.
- **URL model (3B):** Per-tournament URLs — `/[orgSlug]/[tournamentSlug]/schedule`. Old flat URLs become redirect wrappers.
- **Slug uniqueness:** Unique per org among non-archived tournaments only. Same slug (e.g. `battle-of-the-bats`) can be reused across years once the old one is archived.

## Active Limits by Plan

| Plan | Active Limit | Archive Limit | Marketing angle |
|---|---|---|---|
| Starter | 1 | Unlimited | One tournament at a time |
| Pro | 2 | Unlimited | Run summer and fall ball simultaneously |
| Elite | Unlimited | Unlimited | No limits |

---

## Phase 1 — Database Schema
**Prerequisite for all other phases. Run directly in Supabase SQL editor. No code changes yet.**

### 1.1 Add `status` column and backfill

```sql
-- Add status column (default 'completed' so existing inactive rows are correct)
ALTER TABLE tournaments
  ADD COLUMN status text NOT NULL DEFAULT 'completed'
  CHECK (status IN ('draft', 'active', 'completed', 'archived'));

-- Backfill from is_active
UPDATE tournaments SET status = 'active'    WHERE is_active = true;
UPDATE tournaments SET status = 'completed' WHERE is_active = false;
```

### 1.2 Add `slug` column and backfill

```sql
-- Add nullable slug column
ALTER TABLE tournaments ADD COLUMN slug text;

-- Backfill: kebab-case from name, lowercase, collapse non-alphanumeric to hyphens
UPDATE tournaments
SET slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));

-- Make NOT NULL after backfill
ALTER TABLE tournaments ALTER COLUMN slug SET NOT NULL;
```

### 1.3 Partial unique index

```sql
-- Slug must be unique per org only among non-archived tournaments.
-- Archived tournaments free up their slug for reuse.
CREATE UNIQUE INDEX idx_tournament_org_slug_non_archived
  ON tournaments (organization_id, slug)
  WHERE status != 'archived';
```

### 1.4 Verify

```sql
-- Confirm: no nulls, all statuses valid, no duplicate slugs within non-archived
SELECT organization_id, slug, COUNT(*)
FROM tournaments
WHERE status != 'archived'
GROUP BY organization_id, slug
HAVING COUNT(*) > 1;
-- Should return 0 rows.
```

---

## Phase 2 — TypeScript Foundation
**Updates types and DB mappers. Keeps `isActive` as a derived field so existing code doesn't break yet. Also fixes the multi-tenant `is_active` mass-update bug.**

### Files to change

#### `lib/types.ts`
- Add `export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived';`
- Add `slug: string` to `Tournament` interface
- Add `status: TournamentStatus` to `Tournament` interface
- Keep `isActive: boolean` as a derived convenience field (note: `status === 'active'`)

```typescript
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Tournament {
  id: string;
  organizationId?: string;
  year: number;
  name: string;
  slug: string;               // URL-safe identifier; unique per org among non-archived
  status: TournamentStatus;   // lifecycle state
  isActive: boolean;          // derived: status === 'active'. Kept for compatibility.
  startDate?: string;
  endDate?: string;
}
```

#### `lib/db.ts` — `mapTournament`
```typescript
function mapTournament(r: any): Tournament {
  const status: TournamentStatus = r.status ?? (r.is_active ? 'active' : 'completed');
  return {
    id:             r.id,
    organizationId: r.organization_id ?? undefined,
    year:           r.year,
    name:           r.name,
    slug:           r.slug ?? '',
    status,
    isActive:       status === 'active',
    startDate:      r.start_date ?? undefined,
    endDate:        r.end_date ?? undefined,
  };
}
```

#### `lib/db.ts` — Fix multi-tenant bug in `saveTournament` and `updateTournament`
Both functions do `.update({ is_active: false }).neq('id', '0000...')` without org scoping. Replace with:
```typescript
// In saveTournament — before insert:
if (t.isActive && t.organizationId) {
  await supabase.from('tournaments')
    .update({ is_active: false })
    .eq('organization_id', t.organizationId);
}

// In updateTournament — before update:
if (t.isActive && tournamentOrgId) {
  await supabase.from('tournaments')
    .update({ is_active: false })
    .eq('organization_id', tournamentOrgId)
    .neq('id', id);
}
```
Note: `saveTournament` and `updateTournament` in db.ts are largely bypassed in favour of API routes in the admin. These fixes are defensive. The canonical path for tournament mutation is `app/api/admin/tournaments/route.ts`, which already scopes by `auth.org.id`.

#### `lib/db.ts` — Add `getTournamentBySlug`
```typescript
export async function getTournamentBySlug(
  orgId: string,
  slug: string
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .neq('status', 'archived')   // archived tournaments are not addressable by slug
    .single();
  if (error || !data) return null;
  return mapTournament(data);
}
```

#### `lib/tournament-context.tsx`
Change `ts.find(t => t.isActive)` to `ts.find(t => t.status === 'active')` — functionally equivalent but explicit.

### No UI changes in this phase. Deploy and verify data mapping is correct.

---

## Phase 3 — Admin UI: Status Transitions & Slug Management
**Replaces the boolean "Set Live" toggle with explicit status transitions. Adds slug field to tournament forms. Adds active-limit enforcement.**

### 3.1 `app/api/admin/tournaments/route.ts`

Replace `set-active` action with `set-status` action. Add limit enforcement before activating.

```typescript
// New action: set-status
if (action === 'set-status' && id && data?.status) {
  const newStatus: TournamentStatus = data.status;

  // Enforce active limit before activating
  if (newStatus === 'active') {
    const org = auth.org;
    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'active')
      .neq('id', id);

    const limit = org.tournamentLimit; // now means active limit
    if (limit < 9999 && (count ?? 0) >= limit) {
      return Response.json(
        { error: `Your plan allows ${limit} active tournament${limit === 1 ? '' : 's'}. Archive or complete another before activating this one.` },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ status: newStatus, is_active: newStatus === 'active' })
    .eq('id', id)
    .eq('organization_id', auth.org.id);  // org-scoped for safety

  if (error) throw error;
}
```

Also update the `update` action to accept and persist `slug` and `status` (remove `isActive` from the update payload — derive `is_active` from status server-side).

Add a `check-slug` action for client-side slug uniqueness validation:
```typescript
if (action === 'check-slug' && data?.slug && data?.excludeId) {
  const { count } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', auth.org.id)
    .eq('slug', data.slug)
    .neq('status', 'archived')
    .neq('id', data.excludeId ?? '');
  return Response.json({ available: (count ?? 0) === 0 });
}
```

### 3.2 `app/[orgSlug]/admin/tournaments/page.tsx`

Key UI changes:
- **Remove** "Set as live (public) tournament" checkbox from the create/edit form.
- **Add** a slug input field to the create/edit form. Auto-populate from name on creation; show a validation indicator (available / taken).
- **Replace** "Set Live" button in the table with status transition buttons:
  - If `draft`: **Activate** button (→ active), **Delete** button
  - If `active`: **Complete** button (→ completed)
  - If `completed`: **Activate** button (→ active), **Archive** button (→ archived), **Delete** button
  - If `archived`: no status change buttons (archived is terminal); **Delete** button
- Status badges: Draft (neutral), Live (success with dot), Completed (primary), Archived (neutral/muted)
- Sort order: active first, then completed by year desc, then draft, then archived

Slug utility (put in `lib/utils.ts` or inline):
```typescript
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

### 3.3 `lib/tournament-context.tsx`

The admin `TournamentProvider` calls `getTournaments()` (the non-org-scoped version). This is a pre-existing issue but non-critical for single-tenant usage today. No change needed here for this phase; flag for the multi-tenant hardening backlog.

The `refresh` logic: `setCurrentState(saved ?? active ?? ts[0] ?? null)` — `active` is now `ts.find(t => t.status === 'active')`. Update accordingly.

### 3.4 `components/admin/AdminSidebar.tsx`

The "Set Active" button calls `setActiveTournament(currentTournament.id)` from db.ts. Replace with an API call to the new `set-status` action. Or remove entirely — the status transition is now handled from the Tournaments page.

---

## Phase 4 — Billing Page + Plan Config
**Updates the usage meter to count active-only. Confirm Pro/Elite active limits before deploying.**

### 4.1 `lib/plan-config.ts`

The `tournamentLimit` field now means **max simultaneous active tournaments**. Update values:
- Starter: `tournamentLimit: 1` (unchanged)
- Pro: `tournamentLimit: 2` (was 5 total; marketing copy: "Run summer and fall ball")
- Elite: `tournamentLimit: 9999` (unchanged)

Add a comment clarifying the semantics:
```typescript
// tournamentLimit = max number of simultaneously ACTIVE tournaments.
// Completed and archived tournaments do not count toward this limit.
```

### 4.2 `app/[orgSlug]/admin/billing/page.tsx`

Change the usage calculation:
```typescript
// Before:
const usageCount = tournaments.length;

// After:
const usageCount = tournaments.filter(t => t.status === 'active').length;
```

Update labels and copy:
- Header label: "Active tournaments" (was "Tournaments used")
- Count display: `${usageCount} active / ${usageLimitLabel} allowed`
- Plan feature bullet in upgrade cards: "Up to X active tournaments" (was "Up to X tournaments")
- Elite feature bullet: "Unlimited active tournaments"

---

## Phase 5 — Public URL Restructuring
**The largest phase. Creates the `/[orgSlug]/[tournamentSlug]/` route tree. Old flat URLs become thin redirect wrappers. OrgNavContext gains tournament slug awareness.**

### 5.1 New Route Structure

```
app/[orgSlug]/
  layout.tsx                   ← unchanged: org theme CSS vars, fonts
  page.tsx                     ← updated: landing/redirect logic (see 5.2)
  archives/
    page.tsx                   ← unchanged: org-level, not tournament-scoped
    [archiveId]/
      page.tsx                 ← unchanged
  [tournamentSlug]/            ← NEW directory
    layout.tsx                 ← NEW: resolves tournament, syncs slug to nav context
    schedule/
      page.tsx                 ← MOVED from app/[orgSlug]/schedule/page.tsx
    standings/
      page.tsx                 ← MOVED
    teams/
      page.tsx                 ← MOVED
      [id]/
        page.tsx               ← MOVED
    results/
      page.tsx                 ← MOVED
    news/
      page.tsx                 ← MOVED
    rules/
      page.tsx                 ← MOVED
    register/
      page.tsx                 ← MOVED from app/[orgSlug]/register/page.tsx

  -- Old flat paths become redirect wrappers (NOT deleted) --
  schedule/
    page.tsx                   ← thin redirect → /${orgSlug}/${activeSlug}/schedule
  standings/
    page.tsx                   ← thin redirect
  teams/
    page.tsx                   ← thin redirect
  results/
    page.tsx                   ← thin redirect
  news/
    page.tsx                   ← thin redirect
  rules/
    page.tsx                   ← thin redirect
  register/
    page.tsx                   ← thin redirect
```

### 5.2 `app/[orgSlug]/page.tsx` — Updated landing logic

```typescript
// 0 active tournaments → show "coming soon" (current empty-state already handles this)
// 1 active tournament → redirect to /[orgSlug]/[slug]/schedule
// 2+ active tournaments → show tournament chooser list
const activeTournaments = allTournaments.filter(t => t.status === 'active');
if (activeTournaments.length === 1) {
  redirect(`/${orgSlug}/${activeTournaments[0].slug}/schedule`);
}
// else render chooser or coming-soon
```

### 5.3 Redirect wrappers for old flat URLs

All old public page files become server-side redirects. Pattern:
```typescript
// app/[orgSlug]/schedule/page.tsx
import { redirect } from 'next/navigation';
import { getOrganizationBySlug, getActiveTournamentByOrg } from '@/lib/db';

export default async function ScheduleRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  const active = org ? await getActiveTournamentByOrg(org.id) : null;
  if (active?.slug) redirect(`/${orgSlug}/${active.slug}/schedule`);
  redirect(`/${orgSlug}`);
}
```
Same pattern for `standings`, `teams`, `results`, `news`, `rules`, `register`. The `teams/[id]` redirect wrapper also needs to carry `params.id` through.

These wrappers keep old bookmarks and external links working. They are not temporary — keep them permanently.

### 5.4 `app/[orgSlug]/[tournamentSlug]/layout.tsx` — NEW

```typescript
import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getTournamentBySlug } from '@/lib/db';
import TournamentNavSync from '@/components/TournamentNavSync';

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  const tournament = await getTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  return (
    <>
      <TournamentNavSync slug={tournament.slug} tournamentName={tournament.name} />
      {children}
    </>
  );
}
```

Note: `app/[orgSlug]/layout.tsx` already runs for all pages under `[orgSlug]`, sets org theme and calls `OrgNavSync`. The tournament layout is nested inside it — no duplication.

### 5.5 `components/OrgNavContext.tsx` — Add tournament slug

```typescript
interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  tournamentSlug: string | null;   // NEW
  tournamentName: string | null;   // NEW (for display in nav if needed)
  setOrgNav: (logoUrl: string | null, orgName: string) => void;
  setTournamentNav: (slug: string | null, name: string | null) => void;  // NEW
}
```

The `setOrgNav` signature is unchanged (called from `OrgNavSync` which lives in the org layout). Add a separate `setTournamentNav` setter.

### 5.6 `components/TournamentNavSync.tsx` — NEW client component

```typescript
'use client';
import { useEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

export default function TournamentNavSync({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const { setTournamentNav } = useOrgNav();
  useEffect(() => {
    setTournamentNav(slug, tournamentName);
    return () => setTournamentNav(null, null);  // clear on unmount (navigating away)
  }, [slug, tournamentName, setTournamentNav]);
  return null;
}
```

### 5.7 `components/Navbar.tsx` — Inject tournament slug into hrefs

```typescript
const { logoUrl, orgName, tournamentSlug } = useOrgNav();

// NAV_KEYS links:
const href = tournamentSlug
  ? `/${orgSlug}/${tournamentSlug}/${l.key}`
  : `/${orgSlug}/${l.key}`;  // fallback for non-tournament pages (e.g. archives)

// Register button:
const registerHref = tournamentSlug
  ? `/${orgSlug}/${tournamentSlug}/register`
  : `/${orgSlug}/register`;

// Logo/home link: stays at /${orgSlug} (org landing page)
```

### 5.8 Page migration checklist

Each moved page needs these updates:
- Remove standalone `getActiveTournamentByOrg` call — tournament is now provided by the `[tournamentSlug]/layout.tsx` resolver
- The tournament ID is obtained by fetching via `getTournamentBySlug(org.id, params.tournamentSlug)` within the page, or passed via context
- The `YearSelector` component becomes a tournament switcher — links to `/${orgSlug}/${t.slug}/schedule` instead of being a client-side state switch (this is the big UX win: tournament switching changes the URL)

Pages to migrate (all under `app/[orgSlug]/`):
- [ ] `schedule/page.tsx` → `[tournamentSlug]/schedule/page.tsx`
- [ ] `standings/page.tsx` → `[tournamentSlug]/standings/page.tsx`
- [ ] `teams/page.tsx` → `[tournamentSlug]/teams/page.tsx`
- [ ] `teams/[id]/page.tsx` → `[tournamentSlug]/teams/[id]/page.tsx`
- [ ] `results/page.tsx` → `[tournamentSlug]/results/page.tsx`
- [ ] `news/page.tsx` → `[tournamentSlug]/news/page.tsx`
- [ ] `rules/page.tsx` → `[tournamentSlug]/rules/page.tsx`
- [ ] `register/page.tsx` → `[tournamentSlug]/register/page.tsx`

### 5.9 `YearSelector` evolution

The `YearSelector` component (used on schedule, teams, standings pages as a client-side state switcher) changes to a tournament navigator. Since switching tournament now changes the URL, `YearSelector` becomes a set of `<Link>` elements instead of `<button onClick>`:

```typescript
// Instead of: onClick={() => onSelect(t)}
// Becomes a Link:
<Link href={`/${orgSlug}/${t.slug}/${currentPage}`}>
  {t.year}
</Link>
```
The component needs `orgSlug` and `currentPage` (e.g. `'schedule'`) as props, and the list of non-archived tournaments to navigate between.

### 5.10 `next.config.ts` — Add a single safety redirect

The old flat paths are handled by the redirect wrapper pages (5.3). The one static redirect needed is to keep the root-level paths (`/schedule` etc.) that existed before the multi-tenant migration working. These already exist in `next.config.ts` and still point to `/milton-bats/schedule` — those will chain through to the redirect wrapper. No new entries needed, but verify the chain works after deployment.

### 5.11 Admin sidebar "View public site" link

`AdminSidebar.tsx` likely links to `/${orgSlug}/schedule` (the flat URL). After Phase 5 this redirects correctly. No urgent change, but consider updating to link to the active tournament's URL directly for a cleaner experience.

---

## Cross-Phase: Files with `isActive` References

These files reference `t.isActive` and will need attention — most are unchanged in Phases 1–4 because `isActive` is kept as a derived field. In Phase 5 they should be updated to use `t.status` directly:

| File | Current usage | When to update |
|---|---|---|
| `lib/db.ts` | `ts.find(t => t.isActive)` in `getActiveTournamentByOrg` | Phase 2 |
| `lib/tournament-context.tsx` | `ts.find(t => t.isActive)` | Phase 2 |
| `app/[orgSlug]/admin/tournaments/page.tsx` | `t.isActive` in JSX, "Set Live" button | Phase 3 |
| `app/[orgSlug]/layout.tsx` | `getActiveTournamentByOrg` call | Phase 5 (revisit) |
| `app/[orgSlug]/page.tsx` | `activeTournament` from `getActiveTournamentByOrg` | Phase 5 |
| `components/YearSelector.tsx` | `t.isActive` for live dot display | Phase 5 |
| `components/admin/AdminSidebar.tsx` | `setActiveTournament` call | Phase 3 |
| `app/[orgSlug]/news/page.tsx` | `getActiveTournamentByOrg` | Phase 5 |
| `app/[orgSlug]/schedule/page.tsx` | `getActiveTournamentByOrg` | Phase 5 (becomes redirect) |
| `app/[orgSlug]/standings/page.tsx` | `getActiveTournamentByOrg` | Phase 5 |
| `app/[orgSlug]/teams/page.tsx` | `getActiveTournamentByOrg` | Phase 5 |
| `app/[orgSlug]/rules/page.tsx` | `getActiveTournamentByOrg` | Phase 5 |
| `app/api/admin/setup-tournament/route.ts` | `isActive: true` on new tournament | Phase 3 |
| `app/api/public/tournaments/route.ts` | `isActive` filter | Phase 3 |

---

## Deployment Order

Each phase should be deployed to `dev` and verified before moving to the next.

1. **Phase 1** (DB only) — Run SQL, verify in Supabase studio. No deploy needed.
2. **Phase 2** (Types + mapper) — Low-risk type update. Deploy to dev, verify admin loads correctly.
3. **Phase 3** (Admin UI + API) — New status buttons. Test creating tournaments, activating, completing, archiving. Test limit enforcement on Starter.
4. **Phase 4** (Billing page) — Visual change only. Verify usage counts are correct.
5. **Phase 5** (URL restructuring) — High-impact. Deploy to dev, test all public pages at new URLs, test all redirect wrappers, test Navbar links, test YearSelector navigation.

---

## Decisions Closed

All options resolved. No open decisions remain before implementation can begin.
