# Early Access Platform Admin Implementation Plan

## Goal

Give FieldLogicHQ platform admins a focused launch pipeline for people and organizations that submit the League/Club early-access form. This should help segment interest, prioritize pilot candidates, and send thoughtful launch updates without becoming a full marketing automation product.

## UX Summary

Platform admins will see a new **Early Access** area in Platform Admin. It will show every early-access lead with searchable/filterable columns, a lead detail drawer, status management, internal notes, and export/copy tools for outreach. Admins can quickly answer questions like "who wants House League registration?", "which Club leads care about accounting?", and "who should we contact for beta feedback?"

## Scope

### In Scope

- Platform Admin navigation item: **Early Access**
- Lead list from `early_access_leads`
- Filters for plan interest, feature interest, status, consent, sport/program, and date range
- Text search across name, email, organization, role, sport/program, and notes
- Lead detail drawer with all submitted fields
- Lead status updates
- Internal notes
- Bulk actions for filtered/selected leads:
  - copy email addresses
  - export CSV
  - mark contacted
- Basic outreach templates surfaced as copyable text
- Optional contact history entries for manual outreach logging

### Out of Scope For MVP

- Sending bulk email directly from FieldLogicHQ
- Unsubscribe/preference-center workflow
- Campaign analytics
- Automated drip campaigns
- A/B testing or audience journeys
- Deliverability management

## Data Model

Existing table:

- `early_access_leads`

Additions:

```sql
alter table early_access_leads
  add column if not exists internal_status text not null default 'new',
  add column if not exists internal_notes text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_contacted_by text,
  add column if not exists converted_org_id uuid references organizations(id) on delete set null;

create index if not exists idx_early_access_leads_internal_status
  on early_access_leads(internal_status, created_at desc);
```

Allowed statuses:

- `new`
- `qualified`
- `contacted`
- `pilot_candidate`
- `waiting_for_launch`
- `converted`
- `not_a_fit`
- `do_not_contact`

Optional contact history table:

```sql
create table if not exists early_access_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references early_access_leads(id) on delete cascade,
  event_type text not null,
  subject text,
  body text,
  created_by text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table early_access_lead_events enable row level security;
```

Access pattern:

- Platform Admin APIs use `supabaseAdmin`.
- Direct browser access remains blocked by RLS.

## API Routes

### `GET /api/platform-admin/early-access`

Returns paginated leads with filters.

Query params:

- `q`
- `plan`
- `feature`
- `status`
- `consent`
- `dateFrom`
- `dateTo`
- `limit`
- `offset`

Response:

- `leads`
- `total`
- `countsByStatus`
- `countsByPlan`
- `countsByFeature`

### `PATCH /api/platform-admin/early-access/[leadId]`

Updates platform-admin managed fields:

- `internalStatus`
- `internalNotes`
- `lastContactedAt`
- `convertedOrgId`

### `POST /api/platform-admin/early-access/bulk`

Supports bulk actions:

- `mark_contacted`
- `set_status`
- `log_event`

### `GET /api/platform-admin/early-access/export`

Returns CSV for the current filter set.

## UI Build

### Phase 1: Navigation And List

Files:

- `components/platform-admin/PlatformAdminSidebar.tsx` or equivalent sidebar component
- `app/platform-admin/early-access/page.tsx`
- `app/platform-admin/early-access/early-access.module.css`
- `app/api/platform-admin/early-access/route.ts`

Tasks:

- Add **Early Access** nav item.
- Build page shell matching existing Platform Admin UI.
- Add summary cards:
  - total leads
  - new leads
  - pilot candidates
  - consented leads
- Add table columns:
  - organization
  - contact
  - plan interest
  - feature interest
  - sport/program
  - status
  - submitted

### Phase 2: Filters And Search

Files:

- `app/platform-admin/early-access/page.tsx`
- `app/api/platform-admin/early-access/route.ts`

Tasks:

- Add search box.
- Add filter controls for plan, feature, status, consent, and date range.
- Preserve filters in URL query params.
- Add pagination.
- Add empty states for no leads and no matching filters.

### Phase 3: Lead Detail Drawer

Files:

- `components/platform-admin/EarlyAccessLeadDrawer.tsx`
- `app/api/platform-admin/early-access/[leadId]/route.ts`

Tasks:

- Show full lead details.
- Show submitted notes.
- Show source path and submission count.
- Edit internal status.
- Edit internal notes.
- Mark as contacted.
- Mark as pilot candidate.
- Mark as converted with optional org link.

### Phase 4: Outreach Helpers

Files:

- `components/platform-admin/EarlyAccessBulkActions.tsx`
- `app/api/platform-admin/early-access/export/route.ts`
- `app/api/platform-admin/early-access/bulk/route.ts`

Tasks:

- Select rows.
- Copy emails for selected or filtered leads.
- Export CSV.
- Bulk mark contacted.
- Add copyable templates:
  - Thanks for joining early access
  - League beta opening
  - Club beta opening
  - House League registration preview
  - Accounting/Rep Teams roadmap update
  - Feedback call invite
  - Feature now available

### Phase 5: Manual Contact History

Files:

- `supabase/migrations/045_early_access_admin_fields.sql`
- `app/api/platform-admin/early-access/[leadId]/events/route.ts`
- `components/platform-admin/EarlyAccessLeadDrawer.tsx`

Tasks:

- Add event logging table if approved.
- Show lead timeline.
- Log manual outreach notes.
- Log bulk action events.

## Marketing Platform Expansion

If this becomes a real marketing platform, add:

- Campaign builder with saved drafts and audience segments
- Resend/Postmark/SES bulk-send integration
- Subscription preferences and unsubscribe links
- Suppression list and bounce/complaint handling
- Campaign history per lead
- Opens/clicks/deliverability metrics
- Segments saved as reusable audiences
- Automated journeys/drip sequences
- A/B subject testing
- UTM/source attribution
- Lead scoring and lifecycle stages
- Conversion tracking from early-access lead to signed-up org and paid plan
- Compliance tooling: consent audit trail, unsubscribe enforcement, data export/delete

This should be a later product decision. The MVP should stay a launch pipeline, not a newsletter system.

## Verification

- Apply migration in dev.
- Submit a test early-access lead from public pricing.
- Verify lead appears in Platform Admin.
- Test filters/search/pagination.
- Update lead status and internal notes.
- Export CSV and verify selected fields.
- Confirm non-platform users cannot access Platform Admin APIs.
- Browser verification remains user-owned per project rules unless explicitly requested.

## Implementation Status

First MVP slice is implemented:

- `supabase/migrations/045_early_access_admin_fields.sql`
- `app/platform-admin/early-access/page.tsx`
- `app/platform-admin/early-access/EarlyAccessClient.tsx`
- `app/platform-admin/early-access/early-access.module.css`
- `app/api/platform-admin/early-access/route.ts`
- `app/api/platform-admin/early-access/[leadId]/route.ts`
- `app/api/platform-admin/early-access/export/route.ts`
- `lib/early-access-admin.ts`

Included in this slice:

- Platform Admin nav item
- Lead list, search, plan/feature/status/consent filters
- Summary counts for the loaded segment
- Lead detail panel
- Internal status and notes
- Mark contacted
- Copy consented emails
- Filtered CSV export
- Copyable outreach templates

Deferred from the full plan:

- Saved URL filters
- Pagination controls beyond the API limit/offset support
- Date range controls in the UI
- Selected-row bulk actions
- Manual contact-history timeline
- Full marketing campaign sending
