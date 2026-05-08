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
