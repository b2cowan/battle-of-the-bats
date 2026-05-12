# Tournament Admin URL Restructure Plan

> Scope: Move all tournament operational admin pages from flat `/{orgSlug}/admin/{page}` paths
> to `/{orgSlug}/admin/tournaments/{page}` — matching the module-based URL pattern used by
> house-league, rep-teams, and accounting.
>
> No redirects needed (no active users at time of writing).
> Do not start until Phase 1 UX fixes are committed to dev.

---

## Motivation

Every other module in the admin shell follows `admin/{module}/…`:
- `admin/house-league/seasons/{id}/registrations`
- `admin/rep-teams/teams/{id}/program-years/{id}/roster`
- `admin/accounting/ledger/{id}`

Tournament operational pages currently sit flat at `admin/dashboard`, `admin/schedule`,
`admin/results`, etc. As new top-level admin pages are added it becomes ambiguous whether
`admin/dashboard` is a tournament page or a platform page.

---

## Recommended URL scheme

**Keep** `admin/tournaments/` as the section entry point. The existing
`app/[orgSlug]/admin/tournaments/page.tsx` is already a redirect shim — update its target only.

| Old path | New path |
|---|---|
| `/admin/tournaments` (redirect shim) | stays — redirect target updates (see below) |
| `/admin/dashboard` | `/admin/tournaments/dashboard` |
| `/admin/announcements` | `/admin/tournaments/announcements` |
| `/admin/contacts` | `/admin/tournaments/contacts` |
| `/admin/age-groups` | `/admin/tournaments/age-groups` |
| `/admin/teams` | `/admin/tournaments/teams` |
| `/admin/schedule` | `/admin/tournaments/schedule` |
| `/admin/results` | `/admin/tournaments/results` |
| `/admin/rules` | `/admin/tournaments/rules` |
| `/admin/communication` | `/admin/tournaments/communication` |
| `/admin/archives` | `/admin/tournaments/archives` |

---

## Files to move (git mv)

```
app/[orgSlug]/admin/dashboard/          → app/[orgSlug]/admin/tournaments/dashboard/
app/[orgSlug]/admin/announcements/      → app/[orgSlug]/admin/tournaments/announcements/
app/[orgSlug]/admin/contacts/           → app/[orgSlug]/admin/tournaments/contacts/
app/[orgSlug]/admin/age-groups/         → app/[orgSlug]/admin/tournaments/age-groups/
app/[orgSlug]/admin/teams/              → app/[orgSlug]/admin/tournaments/teams/
app/[orgSlug]/admin/schedule/           → app/[orgSlug]/admin/tournaments/schedule/
  (includes Generator.tsx, PlayoffWizard.tsx, components/)
app/[orgSlug]/admin/results/            → app/[orgSlug]/admin/tournaments/results/
app/[orgSlug]/admin/rules/              → app/[orgSlug]/admin/tournaments/rules/
  (includes RulesAdmin.tsx)
app/[orgSlug]/admin/communication/      → app/[orgSlug]/admin/tournaments/communication/
app/[orgSlug]/admin/archives/           → app/[orgSlug]/admin/tournaments/archives/
```

---

## Files to update (no move)

### 1. `app/[orgSlug]/admin/tournaments/page.tsx`

The existing redirect shim. Update both redirect targets:

```tsx
// Before
router.replace(`/${slug}/admin/dashboard`);          // → with tournament
router.replace(`/${slug}/admin/org/tournaments`);    // → without tournament

// After
router.replace(`/${slug}/admin/tournaments/dashboard`);   // → with tournament
router.replace(`/${slug}/admin/org/tournaments`);         // unchanged
```

### 2. `components/admin/AdminSidebar.tsx`

**a) Add explicit tournament detection** (replace the catch-all):

```tsx
// Add alongside other is* flags
const isTournaments = pathname.startsWith(`${base}/tournaments`);

// Replace the catch-all condition for the tournament ops sidebar:
// Before: !isHub && !isOrgAdmin && !isPublicSite && !isAccounting && !isHouseLeague && !isRepTeams
// After: isTournaments
```

**b) Update `TOURNAMENT_NAV` href generation:**

The `navLink` calls in the tournament ops block render hrefs as `${base}/${item.key}`.
Change to `${base}/tournaments/${item.key}`:

```tsx
// In the tournament ops block, change:
const href   = `${base}/${item.key}`;
// to:
const href   = `${base}/tournaments/${item.key}`;
```

**c) Update accounting sidebar link in tournament ops context:**

```tsx
// Before
currentTournament ? `${base}/accounting?tournamentId=${currentTournament.id}` : `${base}/accounting`
// After — no change needed; accounting is a separate module section, link stays
```

### 3. `app/[orgSlug]/admin/page.tsx`

Update the auto-redirect for single-module tournament users:

```tsx
// Before
router.replace(`${base}/tournaments`);
// After — the hub tile still goes to /tournaments (the shim), which then redirects to dashboard
// The auto-redirect should skip the shim and go directly:
router.replace(`${base}/tournaments/dashboard`);
```

### 4. `components/admin/AdminBottomNav.tsx`

Audit for any hardcoded tournament nav paths (`/admin/dashboard`, `/admin/schedule`, etc.)
and update them to the new `admin/tournaments/{key}` paths.

---

## Grep check before merging

After the file moves and edits, run these to find any stale references:

```
grep -r "/admin/dashboard"    app/ components/ --include="*.tsx" --include="*.ts"
grep -r "/admin/schedule"     app/ components/ --include="*.tsx" --include="*.ts"
grep -r "/admin/results"      app/ components/ --include="*.tsx" --include="*.ts"
grep -r "/admin/announcements" app/ components/ --include="*.tsx" --include="*.ts"
grep -r "/admin/archives"     app/ components/ --include="*.tsx" --include="*.ts"
```

---

## Build order

1. `git mv` all 10 page directories to their new locations
2. Update `TOURNAMENT_NAV` href generation in `AdminSidebar.tsx`
3. Add `isTournaments` flag; replace catch-all condition
4. Update `admin/tournaments/page.tsx` redirect target
5. Update `admin/page.tsx` auto-redirect
6. Audit and update `AdminBottomNav.tsx`
7. Run grep checks, fix any remaining references
8. Browser test: hub tile → tournament management, tournament ops sidebar active states, back link

---

## Verification checklist (browser)

- [ ] Hub "Tournament Management" tile navigates correctly
- [ ] With an active tournament: lands on `/admin/tournaments/dashboard`
- [ ] Without a tournament: lands on `/admin/org/tournaments`
- [ ] All tournament sidebar items highlight correctly on their respective pages
- [ ] "Back to All Sections" link returns to admin hub
- [ ] House league, rep teams, accounting, org admin sidebars unaffected
- [ ] `AdminBottomNav` tournament items navigate to correct new paths
