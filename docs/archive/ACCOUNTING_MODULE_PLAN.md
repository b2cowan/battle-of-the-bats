# Accounting Module Plan (`module_accounting`)

**Phase 4 of PLATFORM_ROADMAP.md** — The org's own financial management layer.

**Status:** In progress — plan approved, implementation not started.

**Answers to pre-implementation questions:**
- Q1: Track and document only — no connection to real-world payment systems. Entries are entered manually.
- Q2: Owner-only access in Phase 4. `treasurer` role is explicitly deferred to the Phase 5/6 C2 role model expansion and must be included in that plan.
- Q3: Distinct per-entity ledgers (org, tournament, and future team/season), with the org owner able to see all. Multi-ledger architecture is designed now so the schema never needs a breaking migration. Tournament ledgers are in scope for Phase 4B. Team/season ledgers are deferred to Phase 5/6.
- Q4: Standalone for Phase 4. Schema includes `source_module` / `source_entity_id` columns for future auto-generation by house league and rep teams modules, but no auto-generation is wired in Phase 4.

---

## For the Product Manager

**What changes for an org admin after Phase 4:**

Today, org admins have no financial record-keeping within FieldLogicHQ. Everything lives in spreadsheets, notes, or separate apps — disconnected from the tournaments and teams the platform already manages.

After Phase 4, an org admin can:

- **Track the org's own finances** — Record income (e.g., sponsorships, grants, membership fees) and expenses (e.g., equipment purchases, administrative costs) in a running ledger tied to the organization.
- **Track tournament finances separately** — Each tournament can have its own ledger. Record what the org invested in that tournament (diamond rentals, prize money, umpire fees) and what it brought in (gate receipts, vendor fees). The tournament's books stay separate from the org's books.
- **Transfer funds between ledgers** — When the org allocates a budget to a tournament, a single transfer action creates matching entries in both the org ledger (outgoing) and the tournament ledger (incoming), keeping both sides balanced.
- **Track outstanding amounts** — Mark entries as "pending" (not yet received or paid) and reconcile them to "posted" when settled. An org that invoices a team for dues can record the expected amount immediately and mark it received when the cheque arrives.
- **See a consolidated financial overview** — A single dashboard shows all ledgers, their balances, and recent activity. The org owner can drill into any individual ledger without leaving the admin shell.

**What this is not:**

This module does not process or collect payments. No credit cards, no Stripe, no bank connections. It is a digital record-keeping tool — the equivalent of a well-structured spreadsheet — purpose-built for sports organizations that collect money offline and need a single place to record it.

**Copy note:** "Billing" in the sidebar and org settings refers to FieldLogicHQ charging the organization for its subscription. The Accounting module refers entirely to the organization's own financial operations. These two things must never be described with the same language in any UI copy.

---

## Goals

1. Design a multi-ledger database architecture that supports org, tournament, team, and season ledgers from day one — without a future breaking migration.
2. Implement the org-level ledger in Phase 4A.
3. Implement tournament ledgers and inter-ledger transfers in Phase 4B.
4. Build a consolidated reporting overview (Phase 4C) that lets the org owner see all ledgers at a glance.
5. Apply all five layers of the Module Build Checklist.
6. Note the `treasurer` role deferred item so it is not forgotten in Phase 5/6.
7. Defer team and season ledgers to Phase 5/6 when those entities exist; schema accommodates them with zero structural change.

---

## Module Build Checklist (all five layers are mandatory)

| Layer | Status |
|---|---|
| Route handler gate (`hasCapability` + `hasModuleEntitlement`) | Phase 4A — C section |
| Page component guard (`<AccessDenied />` when cap missing) | Phase 4A — D section |
| Sidebar nav item + section detection | Phase 4A — E3 |
| Hub tile | Phase 4A — E4 |
| Org admin layout passthrough | Phase 4A — D1 |

---

## Treasurer Role — Deferred Item

The `treasurer` OrgRole must be added during the Phase 5/6 C2 role model expansion. When C2 is designed, include:
- `treasurer` added to `OrgRole` union type in `lib/types.ts`
- `ROLE_DEFAULTS['treasurer']` grants `module_accounting` and read-only `module_members`; no other module caps
- `ROLE_DEFAULTS['treasurer']` does NOT grant `billing` (FieldLogicHQ subscription management stays owner-only)
- All accounting route handlers currently gated to `owner` must be updated to also accept `treasurer`
- Sidebar `canSeeAccounting` check updated to include `treasurer` role

Until C2 is built, accounting access is owner-only (plus any admin granted `module_accounting` via capability override).

---

## Phase 4A — Core Ledger Architecture + Org Ledger

### A — DB Schema (Migration 016)

**Status: Complete ✓**

**File:** `supabase/migrations/016_org_accounting.sql`

```sql
-- ---------------------------------------------------------------
-- Accounting ledgers: one row per financial entity.
-- entity_type='org' + entity_id IS NULL → the org's own ledger.
-- entity_type='tournament' + entity_id = tournament.id → per-tournament ledger.
-- entity_type='team' + entity_id = team.id → deferred (Phase 5/6).
-- entity_type='league_season' + entity_id = season.id → deferred (Phase 5/6).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_ledgers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type  text        NOT NULL
                           CHECK (entity_type IN ('org', 'tournament', 'team', 'league_season')),
  entity_id    uuid,                          -- NULL for org-level ledger
  name         text        NOT NULL,
  currency     char(3)     NOT NULL DEFAULT 'CAD',
  is_archived  boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, entity_type, entity_id)    -- prevents duplicate ledgers for the same entity
);

-- ---------------------------------------------------------------
-- Accounting entries: each income/expense/transfer line item.
-- amount is always positive; entry_type conveys directionality.
-- linked_entry_id: points to the matching entry in the other ledger
-- for inter-ledger transfers (both sides created atomically via RPC).
-- status: 'pending' = receivable/payable not yet settled;
--         'posted'  = settled / recorded;
--         'void'    = cancelled (kept for audit trail, excluded from totals).
-- source_module + source_entity_id: nullable; populated by future
--   auto-generation from house_league/rep_teams modules.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id        uuid        NOT NULL REFERENCES accounting_ledgers(id) ON DELETE CASCADE,
  entry_date       date        NOT NULL,
  description      text        NOT NULL,
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  entry_type       text        NOT NULL
                               CHECK (entry_type IN ('income', 'expense', 'transfer_in', 'transfer_out')),
  status           text        NOT NULL DEFAULT 'posted'
                               CHECK (status IN ('pending', 'posted', 'void')),
  category         text,                      -- free-text label (e.g. "prize pool", "umpires", "sponsorship")
  linked_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  source_module    text,                      -- e.g. 'module_house_league' — populated by future auto-gen
  source_entity_id uuid,                      -- foreign key to the source entity in that module
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_entries_ledger_id_idx
  ON accounting_entries(ledger_id);

CREATE INDEX IF NOT EXISTS accounting_entries_entry_date_idx
  ON accounting_entries(ledger_id, entry_date DESC);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE accounting_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's ledgers (API enforces write auth)
CREATE POLICY "org members can read ledgers"
  ON accounting_ledgers FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Entries inherit read access via the ledger's org membership check
CREATE POLICY "org members can read entries"
  ON accounting_entries FOR SELECT
  USING (
    ledger_id IN (
      SELECT al.id FROM accounting_ledgers al
      WHERE al.org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------
-- RPC: create an inter-ledger transfer atomically.
-- Called by the /api/admin/accounting/transfers route.
-- Creates matching entries in both ledgers within a single transaction.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_accounting_transfer(
  p_from_ledger_id  uuid,
  p_to_ledger_id    uuid,
  p_amount          numeric(12,2),
  p_entry_date      date,
  p_description     text,
  p_category        text,
  p_created_by      uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_out_id uuid := gen_random_uuid();
  v_in_id  uuid := gen_random_uuid();
BEGIN
  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id, created_by)
  VALUES
    (v_out_id, p_from_ledger_id, p_entry_date, p_description, p_amount, 'transfer_out', 'posted', p_category, v_in_id,  p_created_by),
    (v_in_id,  p_to_ledger_id,   p_entry_date, p_description, p_amount, 'transfer_in',  'posted', p_category, v_out_id, p_created_by);
END;
$$;
```

**Run this migration in Supabase before enabling the module on any org.**

---

### B — TypeScript Types + DB Helpers

**B1 — Add to `lib/types.ts`** ✓

```ts
export type AccountingEntityType = 'org' | 'tournament' | 'team' | 'league_season';
export type AccountingEntryType  = 'income' | 'expense' | 'transfer_in' | 'transfer_out';
export type AccountingEntryStatus = 'pending' | 'posted' | 'void';

export interface AccountingLedger {
  id: string;
  orgId: string;
  entityType: AccountingEntityType;
  entityId: string | null;
  name: string;
  currency: string;
  isArchived: boolean;
  createdAt: string;
}

export interface AccountingEntry {
  id: string;
  ledgerId: string;
  entryDate: string;          // ISO date string YYYY-MM-DD
  description: string;
  amount: number;             // always positive; entry_type gives direction
  entryType: AccountingEntryType;
  status: AccountingEntryStatus;
  category: string | null;
  linkedEntryId: string | null;
  sourceModule: string | null;
  sourceEntityId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Summary shape used by the overview and ledger header
export interface LedgerSummary {
  ledger: AccountingLedger;
  postedIncome: number;
  postedExpenses: number;
  pendingIncome: number;
  pendingExpenses: number;
  netPosted: number;    // postedIncome - postedExpenses (transfers cancel out within the org)
}
```

**B2 — Add to `lib/db.ts`** ✓

```ts
// ---- Ledger helpers ----

export async function getOrgLedger(orgId: string): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'org')
    .is('entity_id', null)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateOrgLedger(orgId: string, orgName: string): Promise<AccountingLedger> {
  const existing = await getOrgLedger(orgId);
  if (existing) return existing;
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'org', entity_id: null, name: `${orgName} — General` })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getOrgAllLedgers(orgId: string): Promise<AccountingLedger[]> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLedger);
}

export async function getLedgerById(ledgerId: string, orgId: string): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('id', ledgerId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateTournamentLedger(
  orgId: string,
  tournamentId: string,
  tournamentName: string
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'tournament')
    .eq('entity_id', tournamentId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'tournament', entity_id: tournamentId, name: tournamentName })
    .select()
    .single();
  return mapLedger(data!);
}

// ---- Entry helpers ----

export async function getLedgerEntries(
  ledgerId: string,
  opts: { status?: AccountingEntryStatus; limit?: number; offset?: number } = {}
): Promise<AccountingEntry[]> {
  let q = supabaseAdmin
    .from('accounting_entries')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit)  q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  const { data } = await q;
  return (data ?? []).map(mapEntry);
}

export async function createEntry(
  ledgerId: string,
  input: Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category'>,
  createdBy: string
): Promise<AccountingEntry> {
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .insert({
      ledger_id:    ledgerId,
      entry_date:   input.entryDate,
      description:  input.description,
      amount:       input.amount,
      entry_type:   input.entryType,
      status:       input.status,
      category:     input.category ?? null,
      created_by:   createdBy,
    })
    .select()
    .single();
  return mapEntry(data!);
}

export async function updateEntry(
  entryId: string,
  ledgerId: string,
  input: Partial<Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category'>>
): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({
      ...(input.entryDate    !== undefined && { entry_date:  input.entryDate }),
      ...(input.description  !== undefined && { description: input.description }),
      ...(input.amount       !== undefined && { amount:      input.amount }),
      ...(input.entryType    !== undefined && { entry_type:  input.entryType }),
      ...(input.status       !== undefined && { status:      input.status }),
      ...(input.category     !== undefined && { category:    input.category }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function voidEntry(entryId: string, ledgerId: string): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function getLedgerSummary(ledger: AccountingLedger): Promise<LedgerSummary> {
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .select('entry_type, status, amount')
    .eq('ledger_id', ledger.id)
    .neq('status', 'void');
  const rows = data ?? [];
  const sum = (type: AccountingEntryType, status: AccountingEntryStatus) =>
    rows.filter(r => r.entry_type === type && r.status === status)
        .reduce((acc, r) => acc + Number(r.amount), 0);
  const postedIncome   = sum('income',   'posted') + sum('transfer_in',  'posted');
  const postedExpenses = sum('expense',  'posted') + sum('transfer_out', 'posted');
  return {
    ledger,
    postedIncome,
    postedExpenses,
    pendingIncome:   sum('income',  'pending'),
    pendingExpenses: sum('expense', 'pending'),
    netPosted: postedIncome - postedExpenses,
  };
}

// ---- Mappers ----

function mapLedger(row: any): AccountingLedger {
  return {
    id:         row.id,
    orgId:      row.org_id,
    entityType: row.entity_type,
    entityId:   row.entity_id ?? null,
    name:       row.name,
    currency:   row.currency,
    isArchived: row.is_archived,
    createdAt:  row.created_at,
  };
}

function mapEntry(row: any): AccountingEntry {
  return {
    id:             row.id,
    ledgerId:       row.ledger_id,
    entryDate:      row.entry_date,
    description:    row.description,
    amount:         Number(row.amount),
    entryType:      row.entry_type,
    status:         row.status,
    category:       row.category ?? null,
    linkedEntryId:  row.linked_entry_id ?? null,
    sourceModule:   row.source_module ?? null,
    sourceEntityId: row.source_entity_id ?? null,
    createdBy:      row.created_by,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}
```

---

### C — API Routes

All accounting routes use the **dual enforcement gate** (capability + plan entitlement) before any action. Write operations are restricted to `owner` (and `treasurer` once C2 is built). The module-level cap gate allows delegating read access to other admins via capability override without granting write access.

---

**C1 — `app/api/admin/accounting/ledgers/route.ts`** ✓

```ts
// GET  — returns all ledgers for the org with their summaries
// POST — creates a new ledger (e.g., a manually named org sub-ledger)
```

GET:
1. `getAuthContextWithScope()` → 401 if null
2. `hasCapability(ctx.role, ctx.capabilities, 'module_accounting')` → 403 if false
3. `hasModuleEntitlement(ctx.org, 'module_accounting')` → 403 if false
4. `getOrCreateOrgLedger(ctx.org.id, ctx.org.name)` (ensures the org ledger always exists)
5. `getOrgAllLedgers(ctx.org.id)` → compute `getLedgerSummary` for each
6. Return `{ ledgers: LedgerSummary[] }`

POST (owner-only):
1. Same dual gate + `if (ctx.role !== 'owner') return forbidden()`
2. Body: `{ name: string; entityType: 'org' | 'tournament'; entityId?: string }`
3. Validate: name max 100 chars, non-empty; entityType in allowed enum
4. Insert into `accounting_ledgers`

---

**C2 — `app/api/admin/accounting/ledgers/[ledgerId]/route.ts`** ✓

```ts
// GET   — fetch ledger detail + paginated entries
// PATCH — rename a ledger (owner-only)
```

GET query params: `?status=posted|pending|void&limit=50&offset=0`

Ownership check: verify `ledger.orgId === ctx.org.id` before returning data.

---

**C3 — `app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts`** ✓

```ts
// GET  — paginated entry list (same filters as C2 GET, scoped per ledger)
// POST — create a new entry
```

POST body:
```ts
{
  entryDate:   string;  // YYYY-MM-DD
  description: string;  // max 500 chars
  amount:      number;  // positive decimal, max 999999.99
  entryType:   'income' | 'expense';   // transfers use the dedicated /transfers route
  status:      'posted' | 'pending';
  category:    string | null;          // max 100 chars
}
```

Server validation: amount > 0, amount ≤ 999999.99, description non-empty, entryDate is a valid date (not more than 1 year in the future).

---

**C4 — `app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts`** ✓

```ts
// PATCH — edit entry (owner-only; cannot edit transfer entries or voided entries)
// DELETE → voiding: sets status='void', does not hard-delete (audit trail)
```

Guard: entries with `entry_type IN ('transfer_in', 'transfer_out')` cannot be PATCH edited individually — they must be voided as a pair (future enhancement). For now, return 400 with message: "Transfer entries cannot be edited directly. Void the transfer and re-create it."

---

**C5 — `app/api/admin/accounting/transfers/route.ts`** ✓

```ts
// POST — create an inter-ledger transfer (owner-only)
```

Body:
```ts
{
  fromLedgerId: string;
  toLedgerId:   string;
  amount:       number;
  entryDate:    string;
  description:  string;
  category:     string | null;
}
```

Validation:
- Both ledgers must belong to `ctx.org.id`
- `fromLedgerId !== toLedgerId`
- Same amount/date/description guards as C3

Action: call Postgres RPC `create_accounting_transfer` (defined in the migration). This creates both entries atomically.

---

### D — Admin UI Pages

**D1 — `app/[orgSlug]/admin/accounting/layout.tsx`** ✓ (minimal passthrough)

```tsx
export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**D2 — `app/[orgSlug]/admin/accounting/page.tsx`** ✓ — Overview

Client component. After `useOrg()`:

1. Guard: if `!hasCapability(userRole, userCapabilities, 'module_accounting')` → render `<AccessDenied />` (see pattern in E2).
2. On mount: `GET /api/admin/accounting/ledgers` → populate `ledgers: LedgerSummary[]`.
3. Render: page header "Accounting Overview", then a summary card per ledger.

**Summary card per ledger:**
- Ledger name + entity type badge (Org / Tournament)
- Net balance (posted income − posted expenses), formatted as currency
- Pending amount row (if any pending entries exist)
- "View Ledger →" link to `${base}/accounting/ledger/${ledger.id}`

Owner-only "Add Ledger" button (bottom of page) → opens a modal to create a manually named org sub-ledger. Tournament ledgers are created automatically from the ledger detail page or the transfer flow — not from this button.

**D3 — `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx`** ✓ — Ledger Detail

Client component. After `useOrg()`:

1. Same capability guard as D2.
2. On mount: `GET /api/admin/accounting/ledgers/[ledgerId]?limit=50` → populate `ledger`, `entries`, `summary`.
3. Header: ledger name, entity type badge, posted balance, pending balance.
4. Tab row: "Posted" | "Pending" | "All" — switches the `status` filter for the entry list.
5. Entry table columns: Date | Description | Category | Type | Amount | Status | Actions
   - Amount: income/transfer_in in green with `+`; expense/transfer_out in red with `−`.
   - Status badge: posted (solid), pending (outline), void (strikethrough, muted).
   - Actions (owner only): Edit (pencil icon) | Void (x icon). Linked transfer entries show a "linked" indicator; void action on a transfer shows a warning that both sides will be voided (future enhancement — for now, 400 from server is acceptable).
6. Owner-only "Add Entry" button → inline form row or slide-over panel:
   - Fields: Date, Description, Category (text with suggested values), Amount, Type (income / expense), Status (posted / pending)
   - "Add Transfer" button → opens a modal (see below)
7. Pagination: "Load more" when > 50 entries.

**Add Transfer modal** (owner-only, from ledger detail):
- From: current ledger (pre-filled, read-only)
- To: dropdown of other org ledgers (fetched from `GET /api/admin/accounting/ledgers`)
- If the target is a tournament ledger that doesn't exist yet: show a "Create ledger for [Tournament Name]" option — calls `POST /api/admin/accounting/ledgers` first, then the transfer
- Amount, Date, Description, Category fields (same validation)
- Submit → `POST /api/admin/accounting/transfers`

**Category suggestions (shown as datalist or autocomplete):**
```
Prize pool, Diamond rental, Umpire fees, Trophies & medals, Equipment,
Registration fees, Sponsorship, Grant, Fundraising, Food & beverages,
Administrative, Marketing, Travel subsidy, Other
```
These are suggestions only — any free text is valid.

---

### E — Module Build Checklist

#### E1 — Route Handler Gate

Implemented in all C-section routes:
```ts
if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
```

#### E2 — Page Component Guard

In both D2 and D3 (after `useOrg()` resolves):
```tsx
if (!hasCapability(userRole, userCapabilities, 'module_accounting')) {
  return (
    <div className="p-8 text-center">
      <DollarSign size={32} className="mx-auto mb-4 opacity-40" />
      <h2 className="font-bold text-lg mb-2">Access Restricted</h2>
      <p className="text-sm text-data-gray">
        You don't have access to the Accounting module.
        Contact your organization owner to enable it.
      </p>
    </div>
  );
}
```

#### E3 — Sidebar Nav Item ✓

**File:** `components/admin/AdminSidebar.tsx`

Add imports:
```ts
import { DollarSign, Receipt, Layers } from 'lucide-react';
```

Add detection variable (alongside `isOrgAdmin`, `isPublicSite`):
```ts
const isAccounting = pathname.startsWith(`${base}/accounting`);

const canSeeAccounting = userRole
  ? hasCapability(userRole, userCapabilities, 'module_accounting')
  : false;
```

Update the tournament operations guard from:
```ts
{!isHub && !isOrgAdmin && !isPublicSite && (
```
to:
```ts
{!isHub && !isOrgAdmin && !isPublicSite && !isAccounting && (
```

Add accounting sidebar block (parallel to existing `isPublicSite` block):
```tsx
{isAccounting && canSeeAccounting && (
  <>
    {backLink}
    <div className={styles.navSection}>
      <div className={styles.sectionHeader}>Accounting</div>
      <nav className={styles.nav}>
        {navLink('accounting', DollarSign, 'Overview',
          `${base}/accounting`,
          pathname === `${base}/accounting`)}
        {navLink('accounting-org', Receipt, 'Org Ledger',
          `${base}/accounting`,  // navigates to overview; org ledger is the first card
          false)}
      </nav>
    </div>
  </>
)}
```

**Note:** Dynamic per-ledger links in the sidebar are not rendered — the overview page is the navigation hub for individual ledgers. This keeps the sidebar static and predictable regardless of how many ledgers exist.

#### E4 — Hub Tile ✓

**File:** `app/[orgSlug]/admin/page.tsx`

Add import: `import { DollarSign } from 'lucide-react';` (add to existing lucide import line)

Add capability check:
```tsx
const canSeeAccounting = !loading && userRole
  ? hasCapability(userRole, userCapabilities, 'module_accounting')
  : false;
```

Add tile entry to the `tiles` array (after Public Site tile):
```tsx
canSeeAccounting && {
  label: 'Accounting',
  desc: 'Track income, expenses, and financial activity across the org and each tournament',
  icon: DollarSign,
  href: `${base}/accounting`,
},
```

#### E5 — Layout Passthrough ✓

Implemented in D1 above.

---

## Phase 4B — Tournament Ledger + Inter-Ledger Transfers

All DB infrastructure for this phase is already in the migration from Phase 4A (the `accounting_ledgers` table supports `entity_type='tournament'`). Phase 4B is UI and workflow only.

### F — Tournament Ledger Access from Tournament Operations

**F1 — Link from tournament admin to its ledger**

In `app/[orgSlug]/admin/` (tournament operations area), add an "Accounting" nav item to `TOURNAMENT_NAV` in `AdminSidebar.tsx`. This item is conditional: only rendered when `canSeeAccounting` is true.

```ts
// Add to TOURNAMENT_NAV only when canSeeAccounting — handle this in the render loop,
// not by adding it to the static TOURNAMENT_NAV array
```

Or alternatively: add a fixed "Accounting" link at the bottom of the Tournament nav section, rendered conditionally:

```tsx
{canSeeAccounting && navLink(
  'tournament-accounting', DollarSign, 'Accounting',
  `${base}/accounting?tournamentId=${currentTournament?.id}`,
  false
)}
```

That URL navigates to the accounting overview with a `tournamentId` query param, which the overview page uses to auto-scroll to or highlight the matching tournament ledger.

**F2 — Auto-create tournament ledger on first visit**

When the overview page loads, for each tournament returned by `useTournament()`, check whether a ledger exists. If it does not, offer the owner an "Open Ledger" button per tournament card that calls `POST /api/admin/accounting/ledgers` with `entityType: 'tournament'` and `entityId: tournament.id`. This avoids creating empty ledgers for every tournament on first run.

**Note:** `getOrCreateTournamentLedger` in the DB helpers is available for server-side auto-creation if preferred (e.g., auto-create on the first transfer to that tournament).

---

## Phase 4C — Reporting Overview

### G — Org-Wide Financial Summary

**G1 — Add a totals row to the accounting overview page (D2)**

After the per-ledger cards, render a "Org Totals" summary section:
- Total posted income across all ledgers
- Total posted expenses across all ledgers
- Net position

**Clarification note:** Transfers between ledgers cancel within the org (a transfer_out in the org ledger is offset by a transfer_in in the tournament ledger). The net totals row should NOT double-count transfers. The `getLedgerSummary` helper already separates transfers from income/expense for this reason. The totals row sums only `income` and `expense` entry types across all ledgers, not `transfer_in` / `transfer_out`.

**G2 — Date range filter on the overview**

Simple date-range picker (From / To dates) that passes `?from=YYYY-MM-DD&to=YYYY-MM-DD` to `GET /api/admin/accounting/ledgers`. The API passes these to `getLedgerEntries` as `.gte('entry_date', from).lte('entry_date', to)` filters. Defaults to the current calendar year.

---

## Testing Module Gating

Follow the Module Build Checklist testing pattern from PLATFORM_ROADMAP.md:

1. As owner: Manage modal → Capability Overrides → Module Access → set `module_accounting` to Revoke → Save.
2. Sign in as that admin in incognito.
3. Confirm:
   - Hub tile is not shown.
   - Direct URL `/{orgSlug}/admin/accounting` renders the access-denied state.
   - `GET /api/admin/accounting/ledgers` returns 403.
4. As owner: restore the cap. Confirm tile and overview return.
5. As platform admin: remove `module_accounting` from `org.enabled_addons` (via DB). Confirm entitlement check fails — tile and pages are gone even for owner.

---

## File Map (New + Modified)

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/016_org_accounting.sql` | New | Tables, indexes, RLS, `create_accounting_transfer` RPC |
| `lib/types.ts` | Modified | Add `AccountingLedger`, `AccountingEntry`, `LedgerSummary`, enums |
| `lib/db.ts` | Modified | Add all ledger + entry helpers + mappers |
| `app/api/admin/accounting/ledgers/route.ts` | New | GET (list + summaries) + POST (create ledger) |
| `app/api/admin/accounting/ledgers/[ledgerId]/route.ts` | New | GET (detail + entries) + PATCH (rename) |
| `app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts` | New | GET (paginated) + POST (create entry) |
| `app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts` | New | PATCH (edit) + DELETE→void |
| `app/api/admin/accounting/transfers/route.ts` | New | POST inter-ledger transfer (calls RPC) |
| `app/[orgSlug]/admin/accounting/layout.tsx` | New | Minimal passthrough layout (Layer 5) |
| `app/[orgSlug]/admin/accounting/page.tsx` | New | Overview: all ledger summaries + totals (Layer 2) |
| `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx` | New | Ledger detail: entry table + add/edit/void + transfer modal |
| `app/[orgSlug]/admin/accounting/accounting.module.css` | New | Accounting-specific styles |
| `app/[orgSlug]/admin/page.tsx` | Modified | Add Accounting hub tile (Layer 4) |
| `components/admin/AdminSidebar.tsx` | Modified | Add `isAccounting` detection + Accounting section + `!isAccounting` guard on tournament mode (Layer 3) |

---

## Build Order

1. **A** — Migration file (must be run in Supabase before any testing)
2. **B1, B2** — Types and DB helpers
3. **C1–C5** — API routes (can be built in order C1 → C2 → C3 → C4 → C5)
4. **D1** — Layout passthrough
5. **E3, E4** — Sidebar and hub tile (quick wins; validate the shell before the pages)
6. **D2** — Overview page
7. **D3** — Ledger detail page
8. **F1, F2** — Tournament ledger access from tournament ops sidebar
9. **G1, G2** — Reporting totals and date range filter
10. **Module gating test** — Full five-layer verification

---

## Deferred Items

| Item | Deferred to |
|---|---|
| `treasurer` OrgRole | Phase 5/6 C2 role model expansion (design then; see note in plan above) |
| Team ledgers (`entity_type='team'`) | Phase 5 (`module_house_league`) when team entity exists |
| League season ledgers (`entity_type='league_season'`) | Phase 5 (`module_house_league`) |
| Auto-generated entries from module registrations | Phase 5/6 (uses `source_module` + `source_entity_id` columns already in schema) |
| Voiding both sides of a transfer atomically from the UI | Can be added after Phase 4A is complete; server already supports it via RPC |
| Export to CSV / print view | Post-Phase 4 polish |
| Receivables aging report (overdue pending income) | Post-Phase 4 polish |
| Multi-currency support | Not planned; `currency` column is reserved but all UX assumes CAD |
