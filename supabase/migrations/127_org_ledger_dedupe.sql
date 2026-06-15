-- Migration 127: org General-ledger dedupe + singular-General guard (J4-020, FP-1 Phase B)
--
-- THE BUG (Blocker): the "+ Add Ledger" button posted {entityType:'org'} with no entityId, so it
-- inserted a SECOND (org_id,'org',NULL) row — colliding with the singular auto-managed General
-- ledger. The UNIQUE(org_id,entity_type,entity_id) index treats NULLs as DISTINCT, so nothing
-- blocked it and the 409 guard never fired. From then on getOrgLedger's .maybeSingle() hit
-- multiple rows → swallowed the error → returned null → getOrCreateOrgLedger inserted ANOTHER
-- "— General" on every ledger-list GET (snowball), and payment-request approvals / installment
-- payments posted real transfers into whichever fresh empty General was just created — scattering
-- the club's money across copies.
--
-- THE FIX (three parts; this migration is the data + schema half):
--   1. Code: user-created org sub-ledgers now get a non-NULL entity_id (distinct from the General);
--      getOrgLedger no longer swallows multi-row (orders by created_at, takes the oldest).
--   2. THIS MIGRATION:
--      (a) DEDUPE — for each org with >1 (org,'org',NULL) row, pick the OLDEST as canonical,
--          re-point every accounting_entries.ledger_id from the duplicate Generals to it, then
--          delete the now-empty duplicate Generals. No financial line is lost — entries are
--          consolidated, not dropped. Transfers are two entries linked via linked_entry_id; each
--          entry's ledger_id is re-pointed independently, preserving the pairing.
--      (b) GUARD — a partial unique index so AT MOST ONE (org_id,'org',NULL) row can ever exist
--          per org again. (The base UNIQUE key can't do this because NULLs are distinct there.)
--
-- Idempotent: the dedupe is a no-op once each org has a single General; CREATE INDEX IF NOT EXISTS.
-- DEPLOY: dev-first (apply-migration-api.mjs --dev), then prod (--prod) with check:migrations green.
-- Touches LIVE financial data on prod — run the dedupe SELECT below as a dry-run before --prod.

begin;

-- (a) DEDUPE — re-point entries off duplicate Generals onto the oldest General per org.
with ranked as (
  select
    id,
    org_id,
    row_number() over (partition by org_id order by created_at asc, id asc) as rn
  from public.accounting_ledgers
  where entity_type = 'org' and entity_id is null
),
canonical as (
  select org_id, id as canonical_id from ranked where rn = 1
),
duplicates as (
  select r.id as dup_id, c.canonical_id
  from ranked r
  join canonical c on c.org_id = r.org_id
  where r.rn > 1
)
update public.accounting_entries e
set ledger_id = d.canonical_id
from duplicates d
where e.ledger_id = d.dup_id;

-- Delete the now-empty duplicate Generals (every entry has been re-pointed above).
with ranked as (
  select
    id,
    row_number() over (partition by org_id order by created_at asc, id asc) as rn
  from public.accounting_ledgers
  where entity_type = 'org' and entity_id is null
)
delete from public.accounting_ledgers
where id in (select id from ranked where rn > 1);

-- (b) GUARD — enforce a single NULL-entity org General per org going forward.
create unique index if not exists accounting_ledgers_one_org_general
  on public.accounting_ledgers (org_id)
  where entity_type = 'org' and entity_id is null;

commit;

-- Dry-run (run BEFORE --prod to see what would be merged; expect 0 rows on a clean DB):
--   select org_id, count(*) from public.accounting_ledgers
--   where entity_type='org' and entity_id is null group by org_id having count(*) > 1;
