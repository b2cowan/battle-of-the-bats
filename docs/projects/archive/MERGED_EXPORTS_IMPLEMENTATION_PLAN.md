# Export Enhancements — Merged Implementation Plan

**Status:** All phases complete (2026-05-21) — Phase H (pricing/marketing) ✅
**Created:** 2026-05-20
**Merges:** `EXPORT_ENHANCEMENTS_PLAN.md` + `EXPORTS_IMPLEMENTATION_PLAN.md`
**Module scope:** Tournament, House League, Rep Teams, Accounting, Coaches Portal, Public site, Platform Admin, Pricing/Marketing, Help Documentation

---

## PM Brief

**What this is:** A platform-wide overhaul of every data export surface in FieldLogicHQ, establishing exports as a first-class, consistent feature — not an afterthought bolted onto individual pages. The plan covers four deliverables: (1) upgrade all existing CSV exports to Excel (.xlsx) as the default, (2) add calendar-compatible schedule exports (.ics) so coaches and families can import games directly into their calendars, (3) introduce branded PDF reports for print-ready documents, and (4) establish a platform-wide "export standard" that ensures every admin table offers the same consistent experience — now and as new features are built.

**Why it matters:** Org admins routinely need data outside the platform — insurance submissions, check-in sheets, post-event board reports, sharing standings, importing game schedules into Google Calendar. Right now every export produces a plain CSV that requires extra steps, loses formatting, and looks unprofessional when handed to a parent, insurance provider, or board member. Excel opens directly in Google Sheets without conversion. Branded PDFs let orgs put a professional document in front of anyone. Calendar exports give coaches and families one-click schedule import. And a consistent export standard means users never encounter the frustrating inconsistency of "why can I export the schedule but not the standings?"

**Expected customer impact:**
- **All tiers:** Richer data out of the platform, less manual reformatting — Excel replaces CSV with no extra effort
- **Tournament Plus:** Branded PDF reports become a tangible, visible differentiator — the thing coaches mention when explaining why their org uses the paid plan
- **League:** Registration and standings exports; iCal schedule downloads for team contacts and parents
- **Club:** Roster PDFs replace manually assembled Word documents; dues summaries replace emailed spreadsheets; budget-vs-actual reports go directly to the AGM

**Priority:** Medium-high. The xlsx migration (Phases B + C) is low effort and delivers immediate value to every org. PDF infrastructure is the largest investment but unlocks the most visible differentiator. iCal is low effort with outsized adoption effect with coaches and parents.

**Success criteria:**
1. All existing Export buttons produce xlsx by default; CSV remains a secondary option
2. No admin table-of-records in the platform lacks an Export button — the export standard is fully implemented
3. Tournament schedule pages (admin + public) have a working iCal download button
4. A PDF settings admin page exists with logo, header, footer, orientation, density, and privacy controls
5. At least three PDF export surfaces are live: tournament registrations, schedule, and results
6. A dedicated "Exports & Downloads" help article exists and is cross-linked from every relevant module help page
7. Pricing comparison table and plan cards reflect export capabilities accurately

---

## The Export Standard

> **Rule:** Every admin page that displays a filterable table of records — with five or more columns, or where the data is intended to flow outside the platform — requires an **explicit export decision**: either (a) include the standard `ExportMenu` component, or (b) document why export is not appropriate by setting `omittedReason` in `lib/export/catalog.ts`. No table can be silently skipped.

This rule exists to prevent two failure modes: (1) a user who can export one table wondering why the next table doesn't — a consistency gap that erodes trust in the platform, and (2) a developer shipping a table without thinking about export at all. Requiring a documented decision — not just a button — makes gaps intentional rather than accidental. "Every table exports" sounds right but isn't safe; "every table has a documented export decision" is. The `ExportMenu` component makes the implementation cheap, so most tables will include an export; `omittedReason` handles the legitimate exceptions.

### What qualifies as an "export surface"

**Must have:** Paginated or filtered list of records with tabular structure — registrations, teams, game schedules, rosters, ledger entries, standings, members.

**Does not need exports:** Single-record detail views (one team's profile page), configuration forms (venue settings, division setup), wizard steps, and modal forms.

**Edge cases:** Public-facing pages (tournament schedule, league schedule) should offer at minimum an iCal download where applicable and optionally an xlsx/PDF download when the data is logistical (schedule, standings). If a table page intentionally has no export, document the reason in `lib/export/catalog.ts` using the `omittedReason` field. Valid reasons include: data is too sensitive to export in any form, the page is a configuration surface rather than a data surface, the module is not yet in scope, or the route is a legacy page being deprecated. A missing `omittedReason` on a table page with no `ExportMenu` is a bug.

### The ExportMenu contract

Every `ExportMenu` instance must:

1. **Offer xlsx as the primary download** — clicking "Export" without opening the dropdown triggers xlsx. This is the default, non-negotiable.
2. **Offer CSV as a secondary option** — always present, always visible in the dropdown. Never removed.
3. **Offer iCal where the data is temporal** — any page showing game schedules, practice calendars, or dated events must include iCal as a dropdown option.
4. **Offer PDF where documents are the goal** — pages where the output is likely to be printed, emailed to a parent, or submitted externally. PDF is a paid-plan feature gated at `tournament_plus` and above.
5. **Respect current filters** — the exported data must match what the user currently sees on screen. If the full dataset differs from the visible page (server-side pagination), show a "All matching records" option alongside "Current view."
6. **Apply server-side entitlement checks** — export API routes must enforce plan gates independently of the UI. UI gates are UX; server gates are security.
7. **Use a consistent filename pattern** — `{org-or-tournament}-{dataset}-{scope}-{yyyy-mm-dd}.{ext}` (e.g., `milton-bats-schedule-u15-2026-05-20.xlsx`).
8. **Exclude sensitive fields by default** — columns marked `sensitive: true` (internal admin notes, guardian phone/email, player medical notes) are omitted from the standard export output. When a page has sensitive fields that users may need, a second opt-in option must appear explicitly in the dropdown — "Excel with contact details" or "Excel with internal notes" — with a name that makes clear what is being included. Sensitive inclusion is a conscious choice, not the default. If the export name, the requesting role, and the documented use case all clearly justify including a sensitive field in the base export, it may be included by default — but that justification must be written in the catalog entry's `sensitiveFieldPolicy` field.

### Developer checklist for new pages

When building a new admin page with a data table:

- [ ] Determine if the page qualifies as an export surface (use the "What qualifies" rules above); if not, document the decision in `lib/export/catalog.ts` with `omittedReason` and stop here
- [ ] Import and render `<ExportMenu>` in the page header actions area
- [ ] Define column definitions using `ExportColumnDef[]` from `lib/export/table.ts`
- [ ] Review each column: mark guardian contacts, player medical notes, and internal admin notes as `sensitive: true` — they are excluded from the default export automatically
- [ ] If any sensitive field should appear in the base export by default (not opt-in), document the specific role, export name, and use-case justification in the catalog entry's `sensitiveFieldPolicy` field
- [ ] Pass the current filtered rows into the menu
- [ ] Set the `formats` prop: `['xlsx', 'csv']` minimum; add `'ics'` for temporal data; add `'pdf'` for print-worthy documents
- [ ] Set the `featureKey` prop to the relevant `PlanFeature` — the menu handles gating UI automatically
- [ ] If data may exceed client state (server-side pagination), add a server-side export route and pass the URL via `serverExportUrl` prop
- [ ] Add server-side `hasPlanFeature()` check in the export route
- [ ] Add an entry to `lib/export/catalog.ts` — either with full export details or with `omittedReason` if this table intentionally has no export
- [ ] Add a row to the availability table in `lib/help-content/exports.tsx`
- [ ] Update the export section in the relevant module help file

### Export catalog

Add `lib/export/catalog.ts` with one entry per export surface. This makes exports discoverable, auditable, and keeps pricing copy aligned with real capability.

```typescript
export interface ExportCatalogEntry {
  id: string;
  label: string;
  module: 'tournaments' | 'house_league' | 'rep_teams' | 'accounting' | 'coaches' | 'org' | 'platform_admin';
  page: string;
  file: string;
  formats: ('xlsx' | 'csv' | 'ics' | 'pdf')[];
  defaultFormat: 'xlsx' | 'csv';
  minPlan?: 'tournament' | 'tournament_plus' | 'league' | 'club';
  moduleGate?: string;
  // Who can reach this export surface
  audiences: ('org_admin' | 'coach' | 'treasurer' | 'platform_admin' | 'public')[];
  // Specific capabilities required beyond the plan gate, e.g. 'can_export_with_contacts'
  // Enables granular role control when plan-level gates are too coarse
  requiredCapabilities?: string[];
  // Whether any columns in this export are marked sensitive
  includesSensitiveFields: boolean;
  // 'excluded_by_default'        — sensitive columns appear only in the opt-in variant
  // 'opt_in_required'            — user must take a deliberate action to include them (same as above, explicit label)
  // 'included_justified'         — sensitive columns are in the base export; justification must be written here
  sensitiveFieldPolicy?: 'excluded_by_default' | 'opt_in_required' | 'included_justified';
  sensitiveFieldJustification?: string; // Required when policy = 'included_justified'
  respectsCurrentFilters: boolean;
  serverSide: boolean;
  helpSummary: string;
  // Set when a table page intentionally has no export — replaces the ExportMenu.
  // A table page with no ExportMenu and no omittedReason is a bug.
  omittedReason?: string;
}
```

The catalog is the single source of truth for the help documentation availability table and for auditing coverage gaps.

---

## Phase A — Export Audit

### A1: Existing CSV Export Inventory

| # | Context | Page | File | Columns exported | Plan gate | Notes |
|---|---------|------|------|-----------------|-----------|-------|
| 1 | Tournament Registrations | Teams & Registrations | `app/[orgSlug]/admin/tournaments/teams/page.tsx` | Team, Coach, Email, Status, Slot, Waitlist #, Payment | `tournament_plus` | Exports selected division; uses shared `downloadCSV` |
| 2 | Tournament Schedule | Schedule Management | `app/[orgSlug]/admin/tournaments/schedule/page.tsx` | Date, Time, Division, Home Team, Away Team, Location, Status | **Ungated** | Respects current filter; uses shared `downloadCSV` |
| 3 | Tournament Results | Results & Scoring | `app/[orgSlug]/admin/tournaments/results/page.tsx` | Date, Time, Division, Home/Away Team, Scores, Status | **Ungated** | Respects current filter; uses shared `downloadCSV` |
| 4 | Accounting | Ledger Detail | `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx` | Date, Description, Category, Type, Amount, Status | Club (accounting module) | Uses **inline Blob** — not shared utility; must be normalized |
| 5 | Platform Admin | Early Access Leads | `app/api/platform-admin/early-access/export/route.ts` | Lead data, interest, status, consent, notes | Platform admin only | **Server-side** streaming CSV; capped 1000 rows; applies current filters |
| 6 | Legacy Tournament | Teams | `app/admin/teams/page.tsx` | Team, Coach, Email, Status, Slot, Waitlist #, Payment | Ungated | Legacy `/admin` route; mirrors #1 |
| 7 | Legacy Tournament | Schedule | `app/admin/schedule/page.tsx` | Date, Time, Division, Teams, Location, Status | Ungated | Legacy route; mirrors #2 |
| 8 | Legacy Tournament | Results | `app/admin/results/page.tsx` | Date, Time, Division, Teams, Scores, Status | Ungated | Legacy route; mirrors #3 |

**No xlsx, iCal, or PDF dependency exists in `package.json` today.**

**Accounting ledger (#4) uses its own inline Blob** — technical debt; must be normalized to the shared export layer.

**Legacy routes (#6–8):** Confirm with owner whether these routes are still user-visible. If deprecated, document that and migrate canonical routes only.

---

### A2: Pages With Tabular Data — No Export Yet

| Area | Page | File | Key columns | Priority | Formats | Plan gate |
|------|------|------|-------------|---------|---------|-----------|
| House League | Season Registrations | `…/house-league/seasons/[id]/registrations/page.tsx` | Player, DOB, guardian, email, phone, division, status, jersey/position pref | **P0** | xlsx, CSV, PDF | League |
| Rep Teams | Tryout Registrations | `…/rep-teams/…/tryouts/page.tsx` | Player, DOB, guardian, email, phone, notes, status | **P0** | xlsx, CSV, PDF | Club |
| Coaches Portal | Roster | `…/coaches/teams/[id]/roster/page.tsx` | Player, number, DOB, guardian, email, phone, status | **P0** | xlsx, CSV, PDF | Club |
| Coaches Portal | Player Dues | `…/coaches/teams/[id]/accounting/dues/page.tsx` | Player, total fee, paid, outstanding, installments | **P0** | xlsx, CSV, PDF | Club |
| Accounting | Budget vs. Actual | `…/accounting/budget-vs-actual/page.tsx` | Category, line, budgeted, actual, variance | **P0** | xlsx, CSV, PDF | Club |
| Coaches Portal | Schedule | `…/coaches/teams/[id]/schedule/page.tsx` | Date, time, event type, opponent, location | **P1** | xlsx, CSV, iCal | Club | ✅ D2+E2 |
| House League | Season Schedule | `…/house-league/seasons/[id]/schedule/page.tsx` | Date, time, home team, away team, location, status | **P1** | xlsx, CSV, iCal | League | ✅ D2+E3 |
| House League | Season Standings | `…/house-league/seasons/[id]/standings/page.tsx` | Team, W, L, T, points, GF, GA | **P1** | xlsx, CSV | League | ✅ D2 |
| House League | Season Teams | `…/house-league/seasons/[id]/teams/page.tsx` | Team name, division, player count | **P1** | xlsx, CSV | League | ✅ D2 |
| Accounting | Budget Plan | `…/accounting/budget/page.tsx` | Category, line, total, allocated, collected | **P1** | xlsx, CSV | Club | ✅ D2 |
| Rep Teams | Roster (admin view) | `…/rep-teams/…/program-years/[id]/page.tsx` | Player, number, DOB, status | **P1** | xlsx, CSV, PDF | Club | ✅ D2 (PDF coming soon) |
| Rep Teams | Cost Allocations | `…/rep-teams/allocations/page.tsx` | Allocation, team split, installments, paid, outstanding | **P1** | xlsx, CSV, PDF | Club |
| Org | Members | `…/admin/org/members/page.tsx` | Name, email, role, status, last sign-in | **P2** | xlsx, CSV | Tournament Plus |
| Org | Member Audit | `…/admin/org/members/audit/page.tsx` | Audit log entries | **P2** | xlsx, CSV | Owner/admin |
| Org | Diamonds/Venues | `…/admin/org/diamonds/page.tsx` | Name, address, notes | **P2** | xlsx, CSV | Free (reference data) |
| Platform Admin | Organizations | `app/platform-admin/orgs/page.tsx` | Org name, plan, status, owner | **P2** | xlsx, CSV | Platform admin |
| Platform Admin | Customer Users | `app/platform-admin/customer-users/page.tsx` | User, org, role, status | **P2** | xlsx, CSV | Platform admin |
| Platform Admin | Audit Log | `app/platform-admin/audit/page.tsx` | Audit entries | **P2** | xlsx, CSV | Platform admin |

---

## Phase B — Shared Export Foundation

This phase builds the reusable infrastructure that all subsequent phases depend on. No new export surfaces are added here — purely the shared layer.

### B1: File Structure

```
lib/export/
  catalog.ts     — Central export surface registry (all entries)
  table.ts       — ExportColumnDef, buildFilename, serializeRows
  csv.ts         — CSV string generation + client-side download
  xlsx.ts        — Workbook construction + client-side download
  ics.ts         — iCal event building + download (see Phase D)
  pdf.ts         — PDF report builder (see Phase E)
  index.ts       — Re-exports

components/admin/
  ExportMenu.tsx — Shared dropdown UI; used on every export surface

lib/reports/     — Per-report data builders (one file per PDF report type)
components/reports/
  ReportHeader.tsx
  ReportFooter.tsx
  ReportTable.tsx
```

### B2: `lib/export/table.ts`

```typescript
export interface ExportColumnDef {
  label: string;
  key: string;
  format?: 'text' | 'number' | 'currency' | 'date' | 'datetime';
  sensitive?: boolean;         // Excluded unless user opts in
  includeInPDF?: boolean;      // Default true
}

// Canonical filename: {org-or-tournament}-{dataset}-{scope}-{date}.{ext}
export function buildFilename(
  parts: { org?: string; tournament?: string; dataset: string; scope?: string },
  ext: string
): string {
  const segs = [parts.org ?? parts.tournament, parts.dataset, parts.scope]
    .filter(Boolean)
    .map(s => s!.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return `${segs.join('-')}-${new Date().toISOString().split('T')[0]}.${ext}`;
}

export function serializeRows<T extends Record<string, unknown>>(
  rows: T[], cols: ExportColumnDef[], includeSensitive = false
): (string | number)[][] {
  const activeCols = cols.filter(c => includeSensitive || !c.sensitive);
  return rows.map(row =>
    activeCols.map(col => {
      const v = row[col.key];
      return v === null || v === undefined ? '' : String(v);
    })
  );
}
```

### B3: `lib/export/xlsx.ts`

**Library: `xlsx` (SheetJS)** — pure client-side, widely used, supports column auto-sizing, good enough for V1. Evaluate `exceljs` if multi-sheet workbooks or per-cell formatting becomes a requirement.

```typescript
import * as XLSX from 'xlsx';

export function downloadXLSX(
  filename: string, headers: string[], rows: (string | number)[][], sheetName = 'Data'
) {
  const wsData = [headers, ...rows.map(r => r.map(c => c ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
```

### B4: `lib/export/csv.ts`

```typescript
export function generateCSV(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map(row =>
    row.map(cell => {
      const v = String(cell ?? '');
      return (v.includes(',') || v.includes('"') || v.includes('\n'))
        ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')
  ).join('\n');
}

export function downloadCSVBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}
```

### B5: `components/admin/ExportMenu.tsx`

```typescript
interface ExportMenuProps {
  label?: string;
  formats: ('xlsx' | 'csv' | 'ics' | 'pdf')[];
  onExportXLSX: () => void;
  onExportCSV: () => void;
  onExportICS?: () => void;
  onExportPDF?: () => void;
  hasSensitiveOption?: boolean;
  onExportXLSXWithNotes?: () => void;
  disabled?: boolean;
  featureKey?: PlanFeature;          // Menu renders upgrade tooltip for gated formats
  serverExportUrl?: string;          // For paginated data: API route for full export
}
```

Rendered menu structure:

```
[ ↓ Export  ▾ ]      ← primary click = xlsx
    Excel (.xlsx)     ← always first
    CSV               ← always present
    ── divider ──
    Calendar (.ics)   ← if formats includes 'ics'
    PDF report        ← if formats includes 'pdf'; dimmed + tooltip if plan too low
    ── divider ──
    Excel with internal notes  ← if hasSensitiveOption
```

The component handles: plan gate tooltip (via `requiresPlanCopy()`), disabled state when no rows, loading state during server-side export, and upgrade nudge on click of gated item.

### B6: Library Installation

Before installing, run a brief package audit for each dependency. Check: (1) last publish date and maintenance activity, (2) open CVEs on the npm advisory database or Snyk, (3) license compatibility (MIT/Apache-2.0 are acceptable; GPL requires review), and (4) whether the package has a known history of supply-chain issues.

| Package | Purpose | License to verify | Key check |
|---------|---------|-------------------|-----------|
| `xlsx` (SheetJS) | Excel workbook generation | Apache-2.0 | Large community; verify no open high CVEs in current version |
| `ics` | iCal event generation | MIT | Small scope; check npm advisory database |
| `jspdf` | PDF document generation | MIT | Verify active maintenance and current release |
| `jspdf-autotable` | Table layout plugin for jsPDF | MIT | Version-lock to match jsPDF major version |

Run the audit after install:

```bash
npm install xlsx ics jspdf jspdf-autotable
npm audit --audit-level=high
```

If `npm audit` reports any high or critical vulnerabilities in the newly installed packages, do not proceed — assess the finding before shipping the export feature.

SheetJS, `ics`, and jsPDF ship their own TypeScript types. If a separate `@types/*` package is listed in the jsPDF docs for the version you install, add it too.

### B7: Plan Feature Keys in `lib/plan-features.ts`

```typescript
// New keys
| 'schedule_xlsx_export'        // xlsx/CSV tournament schedule — free
| 'results_xlsx_export'         // xlsx/CSV tournament results — free
| 'ical_export'                 // iCal any schedule — free
| 'pdf_exports'                 // PDF generation — tournament_plus+
| 'pdf_template_settings'       // Custom PDF header/footer/logo — tournament_plus+
| 'league_exports'              // All export formats for league module — league+
| 'club_exports'                // All export formats for club module — club+
| 'bulk_operational_workbook'   // Multi-sheet combined workbook export — tournament_plus+

// Minimum plan mapping
schedule_xlsx_export:        'tournament',
results_xlsx_export:         'tournament',
ical_export:                 'tournament',
pdf_exports:                 'tournament_plus',
pdf_template_settings:       'tournament_plus',
league_exports:              'league',
club_exports:                'club',
bulk_operational_workbook:   'tournament_plus',
```

Add `requiresPlanCopy()` cases:

```typescript
case 'pdf_exports':
  return 'PDF exports are included with Tournament Plus, League, and Club.';
case 'pdf_template_settings':
  return 'Custom PDF headers, logos, and footers are included with Tournament Plus, League, and Club.';
case 'league_exports':
  return 'Data exports for house league seasons are included with League and Club.';
case 'club_exports':
  return 'Data exports for rep teams and accounting are included with Club.';
case 'bulk_operational_workbook':
  return 'Full tournament export workbooks (registrations, schedule, and results in one file) are included with Tournament Plus, League, and Club.';
```

**Server-side entitlement:** Every export API route calls `hasPlanFeature()` independently of the UI check. UI gates are UX only.

---

## Phase C — Migrate Existing Exports ✅

All eight existing export buttons migrate to `ExportMenu` with xlsx as the primary format. No behavior change for free-plan users on surfaces they already had access to.

### C1: Per-surface migration ✅

| Surface | File | Formats | New additions | Plan gate | Status |
|---------|------|---------|---------------|-----------|--------|
| Tournament Registrations | `…/admin/tournaments/teams/page.tsx` | xlsx, CSV, PDF | PDF (gated) | `tournament_plus` | ✅ |
| Tournament Schedule | `…/admin/tournaments/schedule/page.tsx` | xlsx, CSV, iCal, PDF | iCal + PDF | xlsx/iCal: free; PDF: `tournament_plus` | ✅ |
| Tournament Results | `…/admin/tournaments/results/page.tsx` | xlsx, CSV, PDF | PDF | xlsx: free; PDF: `tournament_plus` | ✅ |
| Accounting Ledger | `…/accounting/ledger/[id]/page.tsx` | xlsx, CSV | Normalize Blob → shared util | Club (module gate) | ✅ |
| Early Access Leads | `app/api/platform-admin/early-access/export/route.ts` + `EarlyAccessClient.tsx` | xlsx, CSV | `format=xlsx\|csv` query param; server-side ExcelJS | Platform admin | ✅ |

**Legacy routes (#6–8 from A1 inventory):** Deferred pending Open Decision #1 owner confirmation (see Open Decisions section).

**Filename standardization** — `{org-or-tournament}-{dataset}-{scope}-{date}.{ext}`:
- `teams-2026-05-20.csv` → `milton-bats-registrations-u15-2026-05-20.xlsx`
- `schedule-2026-all-2026-05-20.csv` → `milton-bats-schedule-2026-2026-05-20.xlsx`
- `results-2026-all-2026-05-20.csv` → `milton-bats-results-2026-2026-05-20.xlsx`
- `ledger-name-credits-2026-05-20.csv` → `org-ledger-name-credits-2026-05-20.xlsx`

---

## Phase D — iCal (.ics) Export

### D1: `lib/export/ics.ts`

Key design decisions:
- **Deterministic UIDs** (`{gameId}@fieldlogichq.ca`) — re-importing de-duplicates correctly
- **Cancelled games** set `STATUS:CANCELLED` — calendar apps handle them appropriately
- **Timezone:** `America/Toronto` for all Canadian orgs (V1); configurable per org in V2
- **Duration:** Default 2 hours for games, 1.5 hours for practices; pull from org settings in V2

```typescript
import { createEvents, type EventAttributes } from 'ics';

export interface ICSEventInput {
  gameId: string;
  title: string;          // "{HomeTeam} vs {AwayTeam} — {Division}"
  date: string;           // "2026-07-12" ISO date
  time?: string;          // "14:00" 24-hr; absent = all-day event
  durationHours?: number; // Default 2
  location?: string;
  description?: string;
  organizerName?: string;
  organizerEmail?: string;
  url?: string;           // Link back to public schedule
  cancelled?: boolean;
}

export function downloadICS(filename: string, events: ICSEventInput[], orgDomain = 'fieldlogichq.ca') {
  const { error, value } = createEvents(events.map(e => ({
    uid: `${e.gameId}@${orgDomain}`,
    title: e.title,
    start: parseStart(e.date, e.time),
    duration: { hours: e.durationHours ?? 2 },
    location: e.location,
    description: e.description,
    status: e.cancelled ? 'CANCELLED' : 'CONFIRMED',
    url: e.url,
    organizer: e.organizerEmail ? { name: e.organizerName, email: e.organizerEmail } : undefined,
  } as EventAttributes)));
  if (error || !value) return;
  const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}
```

### D2: Two-Level iCal Strategy

**Level 1 (this plan): Static one-time download** — snapshot of the current filtered schedule. Simple, no token management, works immediately.

**Level 2 (future): Subscribable calendar URL** — persistent signed URL that calendar apps poll and stays up to date. Requires: signed token per scope, revocation, caching, privacy review. Track in TODO after Level 1 ships.

### D3: iCal Surfaces — Priority Order

| Location | File | Ship when | Plan gate |
|----------|------|-----------|-----------|
| **Public tournament schedule — all games** | `[orgSlug]/[tournamentSlug]/schedule/page.tsx` | Phase D (first) | Free — public page |
| **Public tournament schedule — team-filtered** | Same page, filtered by registered team via URL param or team picker | Phase D (with all-games) | Free — exported games match the visible filtered view |
| **Admin tournament schedule** | `…/admin/tournaments/schedule/page.tsx` | Phase C migration | Free |
| **Coaches portal — team schedule** | `…/coaches/teams/[id]/schedule/page.tsx` | Phase C/D1 | Club |
| **Admin house league schedule** | `…/house-league/seasons/[id]/schedule/page.tsx` | Phase D — P1 | League |
| **Public house league schedule** | `[orgSlug]/league/[seasonSlug]/schedule/page.tsx` | Phase D — P1 | Free — public |
| Officials schedule | (future) | V2 | — |

The team-filtered tournament schedule iCal is the highest-value iCal surface for coaches and parents: a family can download only their team's games into their calendar, not the entire tournament. This uses the same `downloadICS` function — the filtered rows passed to the export are already filtered to the selected team, so no special implementation is needed beyond the filter UI.

**UI placement on public pages:** iCal gets its own standalone "📅 Add to Calendar" button — not inside the admin export dropdown. Public users (coaches, parents) are not in an admin mental model; a dedicated button increases adoption. On the public schedule page, a team filter dropdown (if teams are published) lets the user choose their team before downloading.

---

## Phase E — PDF Export Infrastructure

### E1: Library Selection

**Primary: `jsPDF` + `jspdf-autotable`**
- Client-side, lazy-loaded, ~250KB total
- Excellent tabular output with header row styling, alternating rows, auto-sizing
- Logo support via `addImage()` (base64)
- Good enough for all tabular reports in V1

**Escalation path: `@react-pdf/renderer`**
- React component model; better for complex multi-column layouts
- ~600KB; requires separate render tree
- Adopt if jsPDF proves insufficient for P1 reports

**Not recommended now: Puppeteer/Playwright** — highest HTML fidelity but requires server-side function; check Amplify/serverless constraints first. Reserve for a future complex layout if truly needed.

**Lazy-load pattern:**

```typescript
async function handleExportPDF() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ]);
  const doc = buildTablePDF(jsPDF, autoTable, { title, headers, rows, settings });
  doc.save(filename);
}
```

### E2: `lib/export/pdf.ts` — Report Builder Interface

```typescript
export interface OrgPdfSettings {
  headerLine1: string;            // Org name
  headerLine2?: string;           // Optional second line
  footerText?: string;            // Custom footer text
  showDateStamp: boolean;         // "Exported: 2026-05-20"
  showPageNumbers: boolean;       // "Page 1 of 3"
  showBranding: boolean;          // FieldLogicHQ logo; always true for free plan
  orientation: 'portrait' | 'landscape';
  accentColor: string;            // Header row background hex
  logoDataUrl?: string;           // Base64 org logo
  reportDensity: 'compact' | 'readable';
  includeGuardianContacts: boolean;
  includePlayerNotes: boolean;
  includeInternalNotes: boolean;  // Default: false
}

export function buildTablePDF(
  jsPDF: typeof import('jspdf').default,
  autoTable: typeof import('jspdf-autotable').default,
  options: {
    title: string;
    subtitle?: string;
    headers: string[];
    rows: (string | number)[][];
    settings: OrgPdfSettings;
    groups?: { label: string; rows: (string | number)[][] }[];
  }
): import('jspdf').jsPDF { /* ... */ }
```

### E3: PDF Settings Admin Page

**Route:** `/{orgSlug}/admin/org/settings/pdf`
**Access:** Owner and Admin; Treasurer can generate PDF exports but cannot control org-wide settings

| Setting | UI | Default | Notes |
|---------|-----|---------|-------|
| Org name in header | Text input | Org name | Override for reports only |
| Second header line | Text input | (blank) | e.g., "2026 Tournament Season" |
| Logo source | Toggle (org logo / upload override) | Org logo | |
| Footer text | Textarea | (blank) | Contact, website, legal note |
| Generated date in footer | Toggle | On | "Exported: 2026-05-20" |
| Page numbers | Toggle | On | "Page 1 of 3" |
| FieldLogicHQ branding | Toggle | **Force-on for free Tournament** | Toggle available for Tournament Plus+ |
| Default orientation | Select | Portrait | Per-export can override |
| Accent colour | Colour picker | Org brand colour or neutral blue | Header rows, dividers |
| Report density | Select | Readable | Compact = more rows/page |
| Include guardian contacts | Toggle | On | Registration and roster PDFs |
| Include player notes | Toggle | On | Player-level notes |
| Include internal admin notes | Toggle | **Off** | Notes never shown to registering families |
| Preview | Button | — | Sample PDF with anonymized placeholder data |
| Filename pattern preview | Static display | `org-dataset-scope-date.pdf` | Live updates as you type |

**DB storage:** JSONB column on `orgs`:
```sql
ALTER TABLE orgs ADD COLUMN pdf_settings JSONB DEFAULT '{}';
```

**API:** `GET /api/admin/org/pdf-settings` + `POST /api/admin/org/pdf-settings`

**Plan gate:** Page accessible at `tournament_plus` and above. Free Tournament orgs can generate PDFs with default FieldLogicHQ branding, but cannot customize the template.

### E4: PDF Export Surfaces — Priority Order

#### P0 — Ship with PDF foundation

| Report | File | Layout | Plan gate | Use cases |
|--------|------|--------|-----------|-----------|
| Tournament Registrations — Check-in / Insurance Sheet | `…/admin/tournaments/teams/page.tsx` | Portrait; page break per division | `tournament_plus` | Check-in desk, insurance submission |
| Tournament Schedule — Field Ops Sheet | `…/admin/tournaments/schedule/page.tsx` | Landscape; compact density | `tournament_plus` | Field supervisors, scorekeepers, venue contacts |
| Tournament Results — Post-Event Report | `…/admin/tournaments/results/page.tsx` | Portrait; grouped by division; champions callout | `tournament_plus` | Board summary, social media share, archive |

#### P1 — Second PDF wave

| Report | File | Plan gate | Use cases |
|--------|------|-----------|-----------|
| Coaches Roster — Travel / Insurance | `…/coaches/teams/[id]/roster/page.tsx` | Club | Tournament entry packages, provincial association, insurance |
| Coaches Player Dues Statement | `…/coaches/teams/[id]/accounting/dues/page.tsx` | Club | End-of-season parent statement |
| Accounting Budget vs. Actual — Board Report | `…/admin/accounting/budget-vs-actual/page.tsx` | Club | AGM handout, board financial review |

#### P2 — Future

- House League Season Registrations (League)
- House League Standings sheet (League)
- Rep Teams Tryout Registration Report (Club)
- Tournament packet: schedule + standings + rules combined (Tournament Plus)
- Platform admin customer account summary (internal)

---

## Phase F — Help Documentation

The exports help section must be thorough enough that a volunteer org admin — non-technical, running their first tournament — can understand what they can export, which format to choose, and what to do with the file.

### F1: New File `lib/help-content/exports.tsx`

Rendered at `app/[orgSlug]/admin/help/exports/page.tsx`. Cross-linked from every relevant module help page.

---

#### Intro

> Exports let you take data from FieldLogicHQ and use it in other tools — a spreadsheet, a calendar app, a printed document, or an email attachment. Every export in FieldLogicHQ works the same way: find the table you want to export, click the Export button in the top right of that section, and choose the format. The default is always Excel. It opens directly in Google Sheets, Microsoft Excel, Apple Numbers, or any other spreadsheet tool without any conversion step.

---

#### Section 1: Export formats — which one to choose

**Excel (.xlsx) — the default for almost everything**

> Excel is the right choice when you need to sort, filter, calculate totals, or share data with someone who will work in a spreadsheet. The file opens directly in Google Sheets (no conversion required), Microsoft Excel, Apple Numbers, and most other spreadsheet tools.
>
> When you click Export on any table in FieldLogicHQ, you get an Excel file automatically. You don't need to select it — it's always the default. If you're not sure which format to use, use Excel.
>
> **Common uses:** registration check-in lists, results summaries for the board, team rosters for insurance submissions, ledger data for accounting review.

**CSV — for importing into other software**

> CSV is a plain-text format that every tool can read. Use it when you need to import data into another system — a custom database, a form-filling tool, or older software that doesn't accept xlsx files. CSV doesn't preserve formatting or formulas, but it is universally compatible.
>
> CSV is always available as the second option in the Export menu.
>
> **Common uses:** importing registrations into another platform, feeding data to a custom reporting script, compatibility with legacy systems.

**Calendar (.ics) — for adding games to any calendar app**

> The Calendar export creates a file that any calendar app can read. When you open it, every game or event in the export is added to your calendar as a separate event — with the correct date, time, location, and opponent. This works with Google Calendar, Apple Calendar, Microsoft Outlook, and any other app that supports the standard iCal format.
>
> Calendar export is available on schedule pages and is free on all plans.
>
> **Common uses:** coaches adding the full season schedule to their phone's calendar, parents importing tournament game times, officials confirming their assigned game times.
>
> **How to import into Google Calendar:** Download the .ics file. Go to calendar.google.com, click the gear icon → Settings, scroll to "Import & Export" in the left menu, click Import, select the file, choose which calendar to add events to, then click Import.
>
> **How to import into Apple Calendar:** Open the downloaded .ics file directly — Calendar will ask which calendar to add the events to and confirm.
>
> **How to import into Microsoft Outlook:** Open the .ics file — Outlook will show a preview and prompt to add the events.
>
> **Note:** The Calendar export is a snapshot taken at the moment you download it. If games are changed or cancelled afterward, your calendar will not update automatically. Re-download and re-import to get the latest schedule. A live, automatically-updating calendar subscription link is planned for a future release.

**PDF — for printing, sharing, or submitting documents**

> A PDF export produces a formatted, ready-to-share document. Use it when the output is going to a printer, to a parent's inbox, to an insurance body, or to the board. PDF exports use your organization's branding — your logo and colors in the header, your name, and optional footer text.
>
> PDF exports are available on Tournament Plus, League, and Club plans. Free Tournament plan organizations get PDFs with default FieldLogicHQ branding.
>
> **Common uses:** tournament check-in sheets, team rosters for provincial association submissions, budget vs. actual for the board, dues statements for parents.
>
> **Customizing PDFs:** Go to Organization Settings → PDF Settings to configure your default header, logo, footer, page numbers, accent colour, and privacy options. These settings apply to every PDF you export.

---

#### Section 2: Where exports are available

> Exports are available on every major data table in FieldLogicHQ. If a page shows a list of records — registrations, teams, games, rosters, ledger entries, standings — it has an Export button. If a format column is blank below, that format doesn't apply to that type of data.

| Module | Page | Excel | CSV | Calendar (.ics) | PDF | Plan required |
|--------|------|:-----:|:---:|:---------------:|:---:|--------------|
| **Tournaments** | Teams & Registrations | ✓ | ✓ | — | ✓ | Tournament Plus |
| **Tournaments** | Schedule | ✓ | ✓ | ✓ | ✓ | Excel/CSV/iCal: any plan · PDF: Plus |
| **Tournaments** | Results & Scoring | ✓ | ✓ | — | ✓ | Excel/CSV: any plan · PDF: Plus |
| **House League** | Season Registrations | ✓ | ✓ | — | ✓ | League |
| **House League** | Season Schedule | ✓ | ✓ | ✓ | — | League |
| **House League** | Season Standings | ✓ | ✓ | — | — | League |
| **House League** | Season Teams | ✓ | ✓ | — | — | League |
| **Rep Teams** | Tryout Registrations | ✓ | ✓ | — | ✓ | Club |
| **Rep Teams** | Roster (admin view) | ✓ | ✓ | — | ✓ | Club |
| **Coaches Portal** | Team Roster | ✓ | ✓ | — | ✓ | Club |
| **Coaches Portal** | Player Dues | ✓ | ✓ | — | ✓ | Club |
| **Coaches Portal** | Team Schedule | ✓ | ✓ | ✓ | — | Club |
| **Accounting** | Ledger | ✓ | ✓ | — | — | Club |
| **Accounting** | Budget vs. Actual | ✓ | ✓ | — | ✓ | Club |
| **Accounting** | Budget Plan | ✓ | ✓ | — | — | Club |
| **Org Admin** | Members | ✓ | ✓ | — | — | Tournament Plus |

> **If a page you expect to have an export doesn't:** Check your plan level first. If your plan includes the module and the Export button is missing, contact support — every data table in FieldLogicHQ is designed to have an export option, and a missing button is a bug.

---

#### Section 3: What gets exported — filters and scope

> Exports always reflect the filters you have applied on screen. If you're viewing the Under-15 division in tournament registrations, the export contains only Under-15 teams. If you've filtered to "Pending" status, only pending registrations are exported.
>
> This is intentional — it lets you export exactly the slice you need without editing the file afterward. To export everything, clear all filters before exporting.
>
> For large datasets that span multiple pages, the export downloads all matching records — not just what's visible on screen. The export button will say "All matching records" in those cases.

---

#### Section 4: Sensitive data and privacy

> Sensitive fields — guardian email addresses, phone numbers, player notes, and internal admin notes — are **excluded from exports by default**. The standard export contains names, statuses, division assignments, and other non-contact data.
>
> When an export surface has optional sensitive data that you may need, the Export menu shows additional opt-in choices, clearly labeled with what they include:
> - **"Excel with contact details"** — adds guardian email and phone number columns
> - **"Excel with internal notes"** — adds internal admin notes that the registering family never sees
>
> These are deliberate choices that require you to select them explicitly. They are never the default.
>
> The two variants are separate because they serve different use cases: contact details go to coaches and staff who need to communicate with families; internal notes go to administrators managing registrations and should rarely leave the admin team. Choose only what you need for the task at hand.
>
> PDF privacy defaults can be configured in **Org Settings → PDF Settings** — set your preferences for guardian contacts and internal notes once, and every PDF export follows those defaults unless you override them at export time.

---

#### Section 5: Customizing PDF exports

> Before generating PDFs for external use, configure the PDF template so every report looks consistent.
>
> Go to **Org Admin → Settings → PDF Settings**.
>
> **Header:** Enter your organization's full name as it should appear at the top of every report. Add a second line if you want a subtitle (event name, season year). Upload your logo — it appears beside your name in the header.
>
> **Footer:** Add footer text for a contact email, website URL, or a note like "Confidential — for board use only." Turn on page numbers and the generated date if your reports go into formal meeting packages or archived files.
>
> **Branding:** On Tournament Plus and above, you can turn off the FieldLogicHQ footer logo. On the free Tournament plan, it always appears.
>
> **Accent colour:** The header row of every table uses your accent colour. It defaults to your organization's brand colour if configured, or a neutral blue. Match it to your printed letterhead or team colours.
>
> **Report density:** Compact mode fits more rows per page — better for large registration lists or dense schedules. Readable mode has more spacing — better for documents read carefully, like dues statements or board reports.
>
> **Privacy toggles:** Set defaults for whether guardian contact details, player notes, and internal admin notes are included. You can still override them per export from the export menu.
>
> **Preview:** Click Preview to download a sample PDF using anonymized placeholder data before generating a real export.

---

#### Section 6: Troubleshooting

**Can I open an xlsx file in Google Sheets?**
> Yes, directly. Go to drive.google.com, click New → File upload, select the xlsx file. Google Sheets opens it without any conversion step. You can also drag the file onto sheets.google.com.

**My PDF header doesn't show my logo — why?**
> Check that a logo has been uploaded in Org Settings first. If PDF Settings shows "use org logo" and no logo has been uploaded to the main Org Settings page, the header shows text only. Upload a logo in org settings, then return to PDF Settings.

**My export is missing some records — why?**
> Check the active filters. Exports match what you see on screen — if the list is filtered, only filtered records are exported. Clear all filters and export again to get the full dataset.

**Do exports update automatically?**
> No. Exports are snapshots taken at the moment you download. If data changes afterward, re-export. Calendar (.ics) exports are also snapshots — a live subscribable calendar URL is planned for a future release.

**The PDF option is greyed out — why?**
> PDF exports are available on Tournament Plus, League, and Club plans. If the PDF option is disabled, your organization is on the free Tournament plan. Upgrade to Tournament Plus for PDF exports and template customization.

**Excel opens in Protected View — what do I do?**
> This is a Microsoft Office security feature for files downloaded from the internet. Click "Enable Editing" in the yellow bar at the top. The file is safe — it was generated directly from your FieldLogicHQ data.

**Who can export data?**
> Anyone who can see the table can export it — there are no extra role restrictions for exporting beyond what the page already requires to view. Owners and Admins can export across all modules they have access to. Treasurers can export accounting data. Coaches can export their own team's roster, dues, and schedule through the Coaches Portal. Staff can export schedules and results.

---

### F2: Module-Level Cross-Links

Each module help file gets a brief export subsection pointing to the main article:

- **`lib/help-content/tournaments.tsx`** — add to registrations and schedule sections: "Registration lists, schedules, and results can be exported in Excel, CSV, iCal, and PDF formats. See the [Exports & Downloads guide] for formats and plan requirements."
- **`lib/help-content/accounting.tsx`** — "Ledger entries and budget reports export to Excel and CSV. Budget vs. actual also exports to PDF for board meetings. See [Exports & Downloads]."
- Add similar one- or two-sentence cross-links when `house-league.tsx`, `rep-teams.tsx`, and `coaches.tsx` are created.

Add export-related search keywords to each module's `searchText` field:
`export xlsx csv excel spreadsheet calendar ics pdf report print insurance check-in board`

### F3: Help Hub Card

Add an "Exports & Downloads" card to the help hub. Icon: `Download`. Short description: "Export registrations, schedules, rosters, and reports to Excel, CSV, iCal, or PDF — and configure branded PDF templates."

### F4: Contextual Help Callouts in the UI

| Location | Callout content |
|----------|----------------|
| Public tournament schedule — near iCal button | "Add these games to your Google Calendar, Apple Calendar, or Outlook in one step." |
| PDF settings page — intro | "These settings apply to every PDF exported from this organization. Change them anytime — they don't affect files already downloaded." |
| First PDF export when `pdf_settings` is empty | Inline nudge: "PDF settings haven't been configured yet. Your export will use defaults. [Configure PDF Settings →]" |
| Export menu — PDF option when plan too low | Tooltip: from `requiresPlanCopy('pdf_exports')` |

---

## Phase G — Subscription Plan Mapping

### G1: Complete Export-to-Plan Matrix

| Export | Format(s) | Plan | Rationale |
|--------|-----------|------|-----------|
| Tournament schedule | xlsx, CSV, iCal | Free | Logistical data; benefits field ops and coaches equally |
| Tournament results | xlsx, CSV | Free | Public data already visible on the website |
| Tournament schedule | PDF | Tournament Plus | Branded print is the visible paid benefit |
| Tournament results | PDF | Tournament Plus | Post-event branded output |
| Tournament registrations | xlsx, CSV | Tournament Plus | Existing `registration_export` gate — preserve |
| Tournament registrations | PDF | Tournament Plus | Check-in / insurance sheet |
| Org members | xlsx, CSV | Tournament Plus | Compliance and access audit |
| House League registrations | xlsx, CSV, PDF | League | League module gate covers all formats |
| House League schedule | xlsx, CSV, iCal | League | League module gate |
| House League standings | xlsx, CSV | League | League module gate |
| House League teams | xlsx, CSV | League | League module gate |
| Rep team tryout registrations | xlsx, CSV, PDF | Club | Club module gate |
| Rep team roster (admin) | xlsx, CSV, PDF | Club | Club module gate |
| Coaches portal roster | xlsx, CSV, PDF | Club | Club module gate |
| Coaches portal dues | xlsx, CSV, PDF | Club | Club module gate |
| Coaches portal schedule | xlsx, CSV, iCal | Club | Club module gate |
| Accounting ledger | xlsx, CSV | Club | Accounting module gate |
| Accounting budget | xlsx, CSV | Club | Accounting module gate |
| Accounting budget-vs-actual | xlsx, CSV, PDF | Club | Accounting module gate |
| Early access leads | xlsx, CSV | Platform admin | Internal; not customer-plan-gated |
| Platform admin orgs/users | xlsx, CSV | Platform admin | Internal |

### G2: Upsell Behaviour

When a user on a lower plan clicks a gated format in `ExportMenu`:
- Item is visually dimmed with an upgrade lock icon
- Tooltip shows `requiresPlanCopy(feature)`
- Clicking opens the existing upgrade flow (subscription page or upgrade modal)

---

## Phase H — Public-Facing Marketing Updates

### H1: `components/PricingSection.tsx` — Plan Card Feature Lists

**Tournament Plus card:**
- Replace: ~~`'CSV export and bulk registration actions'`~~
- Add: `'Registration exports — Excel, CSV, and PDF for check-in, insurance, and reporting'`
- Add: `'Schedule and results exports with iCal calendar download'`
- Add: `'Customizable PDF templates with your logo, header, and footer'`

### H2: `app/pricing/page.tsx` — Comparison Table

Add a **"Data & Exports"** category to `COMPARISON_CATEGORIES`:

```javascript
{
  label: 'Data & Exports',
  rows: [
    { feature: 'Schedule export (Excel, CSV, iCal)',       tournament: '✓', plus: '✓',         league: '✓',       club: '✓' },
    { feature: 'Results export (Excel, CSV)',              tournament: '✓', plus: '✓',         league: '✓',       club: '✓' },
    { feature: 'Registration exports (Excel, CSV, PDF)',   tournament: '—', plus: 'Included',   league: 'Included', club: 'Included' },
    { feature: 'PDF reports with branded templates',       tournament: '—', plus: 'Included',   league: 'Included', club: 'Included' },
    { feature: 'League registration and standings exports', tournament: '—', plus: '—',         league: 'Included', club: 'Included' },
    { feature: 'Rep team and accounting PDF reports',      tournament: '—', plus: '—',         league: '—',       club: 'Included' },
  ],
}
```

Update the existing Registration Operations row:
- `'CSV registration export'` → `'Registration exports (Excel, CSV, PDF)'`

**Upgrade bridge copy (Tournament → Tournament Plus):**
> "Tournament Plus adds the operational tools real organizers need: unlimited tournament slots, 10 staff seats, custom registration questions, file uploads, **Excel and PDF exports for registrations, schedules, and results — check-in sheets, insurance documents, and field ops handouts**, bulk actions, waitlists, full branding, cloning, targeted announcements, and post-event summaries."

### H3: Platform Pages

| Page | Update |
|------|--------|
| `app/platform/tournaments/page.tsx` | Replace "CSV" references with "Excel, CSV, and PDF" |
| `app/platform/house-league/page.tsx` | Add: "Registration, schedule, and standings exports in Excel and CSV. Calendar (.ics) download for team contacts." |
| `app/platform/accounting/page.tsx` | Update: "Excel and CSV exports. Board-ready PDF reports for budget vs. actual and ledger summaries." |
| `app/platform/rep-teams/page.tsx` | Add: "Roster PDFs for provincial associations and insurance. Player dues statements for parent distribution." |
| `app/page.tsx` | Update any "spreadsheet export" or "CSV" mentions to "Excel, CSV, iCal, and PDF exports" |
| `lib/help-content/org.tsx` — subscription section | Add: "Tournament Plus includes Excel and PDF exports for registrations, schedules, and results — useful for check-in sheets, insurance submissions, and post-event board reports." |

---

## Phase I — Deferred / Out of Scope for V1

These items are tracked here to mark what is intentionally excluded from the current build scope, so they don't get accidentally treated as missed work. Each should be added to TODO as a follow-on item once the V1 phases ship.

### I1: Subscribable Calendar URLs

A live calendar feed that calendar apps poll and stay up to date when games are rescheduled or cancelled. This is Level 2 of the two-level iCal strategy. It requires:

- Signed, opaque calendar tokens scoped to org / team / season / tournament
- Token revocation without breaking all other subscribers
- Response caching to avoid hammering the DB on every calendar app sync
- Privacy review: tokens must not expose private notes or contact data
- A UI for coaches to copy their subscription URL

Track in TODO as: "ICS subscribable calendar URL — Level 2 (see Phase I in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md)."

### I2: Multi-Sheet Operational Workbook

A single `.xlsx` download with Registrations, Schedule, and Results as separate tabs — a complete tournament packet in one file. This is a `bulk_operational_workbook` feature (Tournament Plus and above). Deferred because:

- SheetJS supports multi-sheet workbooks (`XLSX.utils.book_append_sheet` called multiple times)
- The data loading is straightforward — all three datasets are already loaded on their respective admin pages
- The user-facing value is clear (one file to email to a co-director)
- Deferred only because Phase C must ship and stabilize first so column definitions are consistent

Track in TODO as: "Full tournament export workbook — multi-sheet XLSX (see Phase I in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md)."

### I3: PDF Orientation Per-Export Overrides

Phase E stores orientation as an org-level PDF setting (portrait default; landscape for schedule exports specifically). Per-export user-selectable orientation — a toggle in the export UI before generating the PDF — is deferred. Assess whether org-level defaults are sufficient after P0 PDF surfaces ship.

### I4: Sensitive Export Audit Log

Log to the org audit trail whenever an export containing guardian contacts or internal notes is generated: who exported, when, which surface, which sensitive variant. Useful for compliance and data governance. Deferred until audit log infrastructure is mature enough to support structured entry types beyond the current free-form event log.

---

## Implementation Build Order

```
Phase B     — Shared export foundation (lib/export/, ExportMenu, install xlsx + ics + jspdf; security audit first)
Phase C     — Migrate 8 existing exports to ExportMenu + xlsx default + normalize accounting ledger
Phase D1    — P0 new table exports (HL registrations, tryout regs, coaches roster + dues, budget-vs-actual)
Phase E1    — iCal: lib/export/ics.ts + public tournament schedule all-games + team-filtered (highest-impact first) ✅
Phase E2    — iCal: coaches portal schedule ✅ 2026-05-21
Phase E3    — iCal: house league schedule admin ✅ 2026-05-21
Phase F1    — PDF settings: DB migration + admin page + API routes ✅ 2026-05-21
Phase F2    — PDF foundation: lib/export/pdf.ts + Report components ✅ 2026-05-21
Phase F3    — PDF P0 surfaces: tournament registrations, schedule, results ✅ 2026-05-21
Phase D2    — P1 new table exports (coaches schedule, HL schedule/standings/teams, budget plan, rep roster) ✅ 2026-05-21
Phase F4    — PDF P1 surfaces: coaches roster, dues statement, budget-vs-actual ✅ 2026-05-21
Phase D3    — P2 new table exports (org members, diamonds, platform admin exports) ✅ 2026-05-21
Phase G     — Help documentation (exports.tsx + help page + hub card + module cross-links) ✅ 2026-05-21
Phase H     — lib/plan-features.ts additions + upsell copy
           — Pricing page + platform pages + home page + org help copy ✅ 2026-05-21

── Future / out of scope for V1 ─────────────────────────────────────────────
Phase I1    — Subscribable calendar URLs (signed tokens, revocation, caching, privacy review)
Phase I2    — Multi-sheet operational workbook (registrations + schedule + results in one xlsx)
Phase I3    — Per-export PDF orientation toggle
Phase I4    — Sensitive export audit log
```

---

## Dependencies

| Capability | Package | Notes |
|-----------|---------|-------|
| Excel export | `xlsx` (SheetJS) | Client + server-side (early access route); includes types |
| iCal export | `ics` | Client-side; includes types |
| PDF export | `jspdf` + `jspdf-autotable` | Client-side; lazy-loaded; includes types |
| DB | — | `pdf_settings JSONB` column on `orgs` |

**Before installing:** Run the security and license check described in Phase B6. Confirm MIT or Apache-2.0 licenses and no open high/critical CVEs.

```bash
npm install xlsx ics jspdf jspdf-autotable
npm audit --audit-level=high
```

---

## Open Decisions

1. **Legacy `/admin` routes** — Confirm with owner whether `app/admin/teams`, `app/admin/schedule`, `app/admin/results` are still user-visible. If deprecated, migrate canonical routes only and document.

2. **Free Tournament registration export** — Current positioning gates all registration export at `tournament_plus`. Confirm whether any registration CSV access on free Tournament should be preserved or if the gate stays as-is.

3. **Multi-sheet xlsx workbooks** — A "full tournament export" as a single xlsx with Registrations + Schedule + Results on separate sheets would be high value. V2 scope — mark in TODO when Phase C ships.

4. **iCal on public tournament schedule** — Confirmed recommendation: yes, ship in Phase E1. Verify no layout constraint on the public schedule page before building.

5. **PDF orientation per-export vs. per-org** — Recommendation: org-level default from PDF settings; per-export landscape override on schedule export specifically. Track per-export overrides as Phase F enhancement if org-level default is sufficient for V1.

6. **`@react-pdf/renderer` evaluation** — Assess jsPDF output quality after the first three P0 surfaces. Migrate to `@react-pdf/renderer` before P1 surfaces if quality is insufficient.

7. **Subscribable calendar URL** — Track as a follow-on feature in TODO after static iCal download ships. Requires signed token design, revocation, caching, and privacy review.

8. **Sensitive export audit log** — Should exports that include guardian contacts or internal notes be logged in the org audit trail? Useful for compliance. Consider as a V2 addition alongside audit log work.

---

## Verification Checklist

Browser-based visual verification is the user's responsibility per `AGENCY_RULES.md`.

**All export formats:**
- [ ] xlsx opens correctly in Google Sheets without errors or garbled characters
- [ ] CSV escapes commas, quotes, newlines, and empty cells correctly
- [ ] Active filters on screen are reflected in the export (not the full unfiltered dataset)
- [ ] Filename follows the standardized pattern
- [ ] Plan gate UI shows the correct tooltip for users below the required plan
- [ ] Server-side export routes enforce plan gate independently of the UI
- [ ] "All matching records" option works for paginated server-side exports

**iCal exports:**
- [ ] Import works in Google Calendar (web)
- [ ] Import works in Apple Calendar (macOS or iOS)
- [ ] Cancelled games appear with CANCELLED status, not as active events
- [ ] Re-importing the same file does not create duplicate events (stable UIDs)

**PDF exports:**
- [ ] Org logo renders correctly (test PNG and JPG)
- [ ] Page numbers display on multi-page reports
- [ ] Custom header and footer text from PDF settings appear
- [ ] Privacy toggles correctly hide/show guardian contacts and notes
- [ ] Free-plan PDFs show FieldLogicHQ branding; paid plans can suppress it
- [ ] Long team names and email addresses do not overflow table cells
- [ ] Landscape orientation works correctly for schedule exports
- [ ] PDF preview on settings page uses placeholder data, not real data

**Help documentation:**
- [ ] Search for `xlsx`, `csv`, `calendar`, `ics`, `pdf`, `report`, `spreadsheet`, `check-in`, `insurance` returns relevant help articles
- [ ] Cross-links from module help files point to the correct exports help page
- [ ] Availability table in exports help matches implemented reality

---

*Merged 2026-05-20. Supersedes `EXPORT_ENHANCEMENTS_PLAN.md` and `EXPORTS_IMPLEMENTATION_PLAN.md`. Both source files are kept as historical context with redirect headers.*
