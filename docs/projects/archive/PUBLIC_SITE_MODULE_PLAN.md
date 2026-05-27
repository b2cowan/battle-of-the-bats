# Public Site Module Plan (`module_public_site`)

**Phase 3 of PLATFORM_ROADMAP.md** — Validates the full add-on model (plan entitlements, org add-on flag, hub tile, sidebar section, three-layer enforcement) at the lowest complexity point.

**Status:** Complete ✅ — shipped to master.

**Answers to pre-implementation questions:**
- Q1: Structured fields only (tagline, description, social links, contact email). No markdown/block editor.
- Q2: Live tournament data appears automatically from the existing tournaments table. No curation layer.
- Q3: Always `fieldlogichq.ca/[orgSlug]`. Custom domain option deferred and tracked in TODO.md.

---

## Goals

1. Add a new `org_public_site_content` table to store org-branded copy (tagline, description, social links, contact email).
2. Build an admin editor at `/admin/public-site/` for owners and admins to fill in and save this content.
3. Modify `app/[orgSlug]/page.tsx` to show a full branded org home when the module is enabled — with the org's content and a live card for each active tournament — instead of auto-redirecting to the single active tournament.
4. Apply all five layers of the Module Build Checklist.
5. Be the first module to exercise `hasModuleEntitlement()` in production.

---

## Phase 3 Task Checklist

### A — DB Schema (Migration 015)

- [x] **A1** — Create `supabase/migrations/015_org_public_site.sql`

```sql
CREATE TABLE IF NOT EXISTS org_public_site_content (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tagline                 text,
  description             text,
  contact_email           text,
  social_instagram        text,
  social_facebook         text,
  social_x                text,
  social_website          text,
  show_upcoming_tournaments boolean   NOT NULL DEFAULT true,
  show_archives_link      boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_public_site_content_org_id_key
  ON org_public_site_content(org_id);

-- Allow any authenticated org member to read (public page reads via anon client anyway)
-- Only API route (using service role or auth client) writes; RLS is enforced at the route level.
ALTER TABLE org_public_site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read public site content"
  ON org_public_site_content FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE RLS policies — the API route enforces auth before calling the DB helper.
-- Reads on the public-facing page use the anon client which bypasses RLS for SELECT
-- (the table has no sensitive data — all content is intended to be public).
-- To allow anon reads:
CREATE POLICY "public can read public site content"
  ON org_public_site_content FOR SELECT
  TO anon
  USING (true);
```

**Note:** Run this migration in Supabase before enabling the module on any org.

---

### B — TypeScript Type + DB Helpers

- [x] **B1** — Add `OrgPublicSiteContent` interface to `lib/types.ts`

```ts
export interface OrgPublicSiteContent {
  id: string;
  orgId: string;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialX: string | null;
  socialWebsite: string | null;
  showUpcomingTournaments: boolean;
  showArchivesLink: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [x] **B2** — Add DB helpers to `lib/db.ts`

```ts
export async function getOrgPublicSiteContent(orgId: string): Promise<OrgPublicSiteContent | null> {
  const { data } = await supabase
    .from('org_public_site_content')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    orgId: data.org_id,
    tagline: data.tagline,
    description: data.description,
    contactEmail: data.contact_email,
    socialInstagram: data.social_instagram,
    socialFacebook: data.social_facebook,
    socialX: data.social_x,
    socialWebsite: data.social_website,
    showUpcomingTournaments: data.show_upcoming_tournaments,
    showArchivesLink: data.show_archives_link,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertOrgPublicSiteContent(
  orgId: string,
  content: Partial<Omit<OrgPublicSiteContent, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await supabase
    .from('org_public_site_content')
    .upsert(
      {
        org_id: orgId,
        tagline: content.tagline ?? null,
        description: content.description ?? null,
        contact_email: content.contactEmail ?? null,
        social_instagram: content.socialInstagram ?? null,
        social_facebook: content.socialFacebook ?? null,
        social_x: content.socialX ?? null,
        social_website: content.socialWebsite ?? null,
        show_upcoming_tournaments: content.showUpcomingTournaments ?? true,
        show_archives_link: content.showArchivesLink ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );
}
```

---

### C — API Routes

- [x] **C1** — Create `app/api/admin/public-site/route.ts`

Pattern: GET to fetch, PATCH to save. Dual enforcement gate before any logic.

```ts
// GET
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_public_site')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_public_site')) return forbidden();

  const content = await getOrgPublicSiteContent(ctx.org.id);
  return NextResponse.json(content ?? {});
}

// PATCH
export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_public_site')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_public_site')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  const body = await req.json();
  await upsertOrgPublicSiteContent(ctx.org.id, body);
  return NextResponse.json({ ok: true });
}
```

**Input validation (PATCH):** Trim all strings. Enforce max lengths:
- `tagline`: 100 chars
- `description`: 1000 chars
- `contactEmail`: 254 chars (RFC 5321)
- Social URLs: 500 chars each. Reject anything that doesn't start with `https://` after trimming (or is null/empty).

---

### D — Admin Editor UI

- [x] **D1** — Create `app/[orgSlug]/admin/public-site/layout.tsx` (minimal passthrough)

```tsx
export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [x] **D2** — Create `app/[orgSlug]/admin/public-site/page.tsx`

**Client component.** After `useOrg()`:
1. If `!hasCapability(userRole, userCapabilities, 'module_public_site')` → render `<AccessDenied />`.
2. On mount, `GET /api/admin/public-site` → populate form state.
3. On save, `PATCH /api/admin/public-site` with form body.

**Form fields:**

| Field | Input | Max | Hint |
|---|---|---|---|
| Tagline | `text` | 100 | Short headline shown below your org name on the public page |
| About | `textarea` | 1000 | A paragraph describing your organization — shown in the hero section |
| Contact email | `email` | 254 | Displayed publicly as a contact address |
| Instagram | `url` | 500 | Full URL (e.g. https://instagram.com/yourorg) |
| Facebook | `url` | 500 | Full URL |
| X / Twitter | `url` | 500 | Full URL |
| Website | `url` | 500 | Any external site |
| Show upcoming tournaments | `checkbox` | — | Auto-display active tournament cards on your public page |
| Show archives link | `checkbox` | — | Display a link to your past tournaments archive |

**Page layout pattern:** Match the card/section structure from `org/settings/page.tsx`. Two sections:
1. "Page Content" — tagline, description, contact email
2. "Social Links" — four URL fields
3. "Display Options" — two toggles
4. Save footer with unsaved-state tracking (same `isDirty` + beforeunload guard pattern as settings)

**Note to implementer:** The hero image and org logo are managed in Org Settings. Add a contextual link at the top of the editor: `"To update your logo or hero image, visit → Org Settings"`.

---

### E — Module Build Checklist (all five layers)

#### Layer 1: Route Handler Gate
- [x] **E1** — Implemented in task C1 above. Both `hasCapability` + `hasModuleEntitlement` on every handler.

#### Layer 2: Page Component Guard
- [x] **E2** — Implemented in task D2 above. Guard renders `<AccessDenied />` for users without the cap.

The `<AccessDenied />` component should be consistent with how other admin pages handle this. Use inline JSX if a shared component doesn't already exist:

```tsx
if (!hasCapability(userRole, userCapabilities, 'module_public_site')) {
  return (
    <div className="p-8 text-center">
      <Globe size={32} className="mx-auto mb-4 opacity-40" />
      <h2 className="font-bold text-lg mb-2">Access Restricted</h2>
      <p className="text-sm text-data-gray">
        You don't have access to the Public Site module.
        Contact your organization owner to enable it.
      </p>
    </div>
  );
}
```

#### Layer 3: Sidebar Nav Item
- [x] **E3** — Add to `components/admin/AdminSidebar.tsx`

Detection: `pathname.startsWith(`${base}/public-site`)` → renders a new "Public Site" sidebar section.

```tsx
const isPublicSite = pathname.startsWith(`${base}/public-site`);
const canSeePublicSite = userRole
  ? hasCapability(userRole, userCapabilities, 'module_public_site')
  : false;
```

In the sidebar render, add a new `{isPublicSite && (...)}` block parallel to the existing `isOrgAdmin` and tournament blocks:

```tsx
{isPublicSite && (
  <>
    {backLink}
    <div className={styles.navSection}>
      <div className={styles.sectionHeader}>Public Site</div>
      <nav className={styles.nav}>
        {navLink('public-site', Globe, 'Site Editor', `${base}/public-site`, pathname === `${base}/public-site`)}
      </nav>
    </div>
  </>
)}
```

Import `Globe` from `lucide-react`.

The module section detection logic in the sidebar must also be updated so that `!isHub && !isOrgAdmin && !isPublicSite` triggers the tournament operations mode (not `!isHub && !isOrgAdmin` as today).

#### Layer 4: Hub Tile
- [x] **E4** — Add to `app/[orgSlug]/admin/page.tsx`

Add `canSeePublicSite`:
```tsx
const canSeePublicSite = !loading && userRole
  ? hasCapability(userRole, userCapabilities, 'module_public_site')
  : false;
```

Add tile entry to the `tiles` array:
```tsx
canSeePublicSite && {
  label: 'Public Site',
  desc: 'Edit your org-branded public page: tagline, description, and social links',
  icon: Globe,
  href: `${base}/public-site`,
},
```

This tile is only visible when the org has the module cap granted (either by the org owner enabling it or an add-on entitlement). Import `Globe` from `lucide-react`.

#### Layer 5: Layout Passthrough
- [x] **E5** — Implemented in task D1 above. Minimal `<>{children}</>` passthrough. `OrgProvider` and `TournamentProvider` are already in the parent `admin/layout.tsx`.

---

### F — Public-Facing Page (`app/[orgSlug]/page.tsx`)

- [x] **F1** — Add module check and branch rendering logic

**Import `hasModuleEntitlement`** at the top of the server component.

**After fetching the org**, check module entitlement:
```ts
const hasPublicSite = org ? hasModuleEntitlement(org, 'module_public_site') : false;
```

**If `hasPublicSite` is true:**
- Fetch `siteContent = await getOrgPublicSiteContent(org.id)` 
- Skip the single-active-tournament redirect entirely
- Render the public site template (see below)

**If `hasPublicSite` is false:**
- Existing behavior unchanged (single active tournament → redirect; otherwise show current page)

**Public site template structure** (rendered when module is enabled):

```
[Hero section]
  - Org logo (existing `org.logoUrl`)
  - Org name (existing `org.name`)
  - Tagline from `siteContent.tagline` (if set)
  - Description from `siteContent.description` (if set)
  - Social link row (Instagram, Facebook, X, Website icons → links)
  - Contact email link (if `siteContent.contactEmail` set)

[Upcoming Tournaments section — if `siteContent.showUpcomingTournaments`]
  - Filtered: tournaments where `status === 'active'`
  - Card per tournament: name, dates, age range (from ageGroups), CTA link to `/{orgSlug}/{tournamentSlug}`
  - If no active tournaments: "No active tournaments right now — check back soon."

[Archives section — if `siteContent.showArchivesLink`]
  - Simple CTA card: "Past Tournaments → /{orgSlug}/archives"
  - Only render if at least one archive row exists for this org (query `getArchivesByOrg`)
```

**No redirect when the module is enabled.** The org home is the destination, not a waypoint.

---

### G — Testing Module Gating

Follow the Module Build Checklist testing pattern from PLATFORM_ROADMAP.md:

1. As owner: Manage modal → Capability Overrides → Module Access → set `module_public_site` to Revoke → Save.
2. Sign in as that admin in incognito.
3. Confirm:
   - Hub tile is not shown.
   - Direct URL `/{orgSlug}/admin/public-site` renders the access-denied state.
   - `GET /api/admin/public-site` returns 403.
4. As owner: restore the cap. Confirm tile and editor return.
5. As platform admin: remove `module_public_site` from `org.enabled_addons` (via DB or platform admin UI). Confirm entitlement check fails — tile and editor are gone even for owner.

---

## File Map (New + Modified)

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/015_org_public_site.sql` | New ✅ | Table, unique index, RLS policies |
| `lib/types.ts` | Modified ✅ | Add `OrgPublicSiteContent` interface |
| `lib/db.ts` | Modified ✅ | Add `getOrgPublicSiteContent`, `upsertOrgPublicSiteContent` |
| `lib/api-auth.ts` | Modified ✅ | Bug fix: `enabledAddons` was missing from org object — `hasModuleEntitlement` would always return false without this |
| `lib/org-context.tsx` | Modified ✅ | Bug fix: same `enabledAddons` omission in the client-side OrgProvider |
| `app/api/admin/public-site/route.ts` | New ✅ | GET + PATCH with dual enforcement gate |
| `app/[orgSlug]/admin/public-site/layout.tsx` | New ✅ | Minimal passthrough layout |
| `app/[orgSlug]/admin/public-site/page.tsx` | New ✅ | Client-side editor form |
| `app/[orgSlug]/admin/public-site/public-site.module.css` | New ✅ | Editor page styles |
| `app/[orgSlug]/admin/page.tsx` | Modified ✅ | Add hub tile (Layer 4) |
| `components/admin/AdminSidebar.tsx` | Modified ✅ | Add sidebar section + fix `!isPublicSite` guard on tournament mode (Layer 3) |
| `app/[orgSlug]/page.tsx` | Modified ✅ | Branch on `hasModuleEntitlement` — public site template vs existing behavior (Layer F) |
| `app/[orgSlug]/Home.module.css` | Modified ✅ | New CSS classes for public site template (org logo, social links, tournament cards, archives CTA) |

---

## Build Order

1. ✅ A1 — Migration file written (must still be run in Supabase before testing)
2. ✅ B1, B2 — Types and DB helpers
3. ✅ C1 — API route
4. ✅ D1, D2 — Layout passthrough + editor page
5. ✅ E3, E4 — Sidebar and hub tile
6. ✅ F1 — Public page branching
7. ✅ G — Full gating test (verified)

---

## Out of Scope (Deferred)

- Custom domain support (tracked in TODO.md)
- Rich text / markdown editor for the description field
- Per-tournament "hide from public site" toggle (use draft status for now)
- Image upload for the public site itself (logo and hero are managed in Org Settings)
- Registration CTA customization (tournament register links auto-surface from active tournament cards)
