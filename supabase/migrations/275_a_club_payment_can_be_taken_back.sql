-- 275: A CLUB PAYMENT CAN BE TAKEN BACK — the transfer says which entry it made, and old
-- payments are adopted where the match is beyond doubt.
-- (COACH_MONEY_LIST_ROOM_QUESTION_PLAN §9 — owner, §134 walk 2026-09-03.)
--
-- THE CASE. "Record as paid" on a club installment is the fastest write in the coaches portal: one
-- tap, no question asked. It is also the ONLY money a coach records that could not be taken back —
-- a dues payment, a payout and a credit all have a remove; this had none, for coaches or for club
-- admins. So the least-guarded write in the product was also the only irreversible one, and the
-- tap does not merely set a flag: it posts a real transfer between the team's ledger and the
-- club's. Tapping the wrong row moved money and left no way home.
--
-- WHY A SCHEMA CHANGE IS NEEDED FOR WHAT SOUNDS LIKE A BUTTON. To take the payment back you must
-- void the two entries it posted, and nothing recorded which two they were:
-- `create_accounting_transfer` generates both ids inside the function and RETURNS VOID, so every
-- caller has always thrown them away. `rep_allocation_installments.accounting_entry_id` has
-- existed since the table did and no code has ever written it (the data dictionary says so in
-- as many words). Reversal by "find an entry that looks about right" is exactly the kind of
-- guess this codebase keeps deleting; the function tells the caller what it made instead.
--
-- ⚠ THE RETURN TYPE CHANGES, WHICH IS WHY THIS IS A DROP AND NOT A REPLACE. Postgres will not
-- change a function's return type in place. All four call sites ignore the result today
-- (`.rpc()` reads only `error`), so widening void → uuid is backward-compatible at every one of
-- them; the two allocation routes then start reading it. The out-entry is returned rather than the
-- in-entry because the payer's side is the one a team's record hangs off — its partner is one
-- `linked_entry_id` hop away, which is how the void reaches both halves.

drop function if exists create_accounting_transfer(uuid, uuid, numeric, date, text, text, uuid);

create or replace function create_accounting_transfer(
  p_from_ledger_id  uuid,
  p_to_ledger_id    uuid,
  p_amount          numeric(12,2),
  p_entry_date      date,
  p_description     text,
  p_category        text,
  p_created_by      uuid
) returns uuid
language plpgsql
as $$
declare
  v_out_id uuid := gen_random_uuid();
  v_in_id  uuid := gen_random_uuid();
begin
  insert into accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id, created_by)
  values
    (v_out_id, p_from_ledger_id, p_entry_date, p_description, p_amount, 'transfer_out', 'posted', p_category, v_in_id,  p_created_by),
    (v_in_id,  p_to_ledger_id,   p_entry_date, p_description, p_amount, 'transfer_in',  'posted', p_category, v_out_id, p_created_by);
  -- The PAYER's half. Its partner is reachable through linked_entry_id, so one id addresses both.
  return v_out_id;
end;
$$;

comment on function create_accounting_transfer(uuid, uuid, numeric, date, text, text, uuid) is
  'Posts both halves of an inter-ledger transfer in one transaction and RETURNS the transfer_out '
  '(payer-side) entry id — mig 275. Callers that need to reverse the transfer later must store it; '
  'the transfer_in half is reachable via accounting_entries.linked_entry_id. Returned void before '
  '275, which is why rep_allocation_installments.accounting_entry_id sat unwritten for so long.';

-- ── ADOPTING THE PAYMENTS THAT WERE ALREADY MADE ────────────────────────────────────────────────
-- Without this every already-paid installment would refuse to be undone on the day the feature
-- ships — correct, and useless. The match is deliberately narrow: same team ledger, same category,
-- same amount, and the description this exact code path writes. ⚠ AMBIGUITY IS SKIPPED, NEVER
-- GUESSED. Both uniqueness windows must be 1 — one entry for that installment AND one installment
-- for that entry — so a team that paid two identically-numbered, identically-sized installments
-- keeps both unlinked and the undo honestly refuses rather than voiding the wrong money. Nothing
-- here writes an entry, changes a status, or moves a cent; it only fills in a back-link.
with candidate as (
  select
    i.id as installment_id,
    e.id as entry_id,
    count(*) over (partition by i.id) as entries_for_installment,
    count(*) over (partition by e.id) as installments_for_entry
  from rep_allocation_installments i
  join rep_allocation_splits s
    on s.id = i.split_id
  join accounting_ledgers l
    on l.org_id = s.org_id
   and l.entity_type = 'team'
   and l.entity_id = s.team_id
  join accounting_entries e
    on e.ledger_id = l.id
   and e.entry_type = 'transfer_out'
   and e.status = 'posted'
   and e.category = 'rep_allocation'
   and e.amount = i.amount
   and e.description = 'Rep allocation payment — installment #' || i.installment_number::text
  where i.paid_at is not null
    and i.accounting_entry_id is null
)
update rep_allocation_installments t
   set accounting_entry_id = c.entry_id
  from candidate c
 where t.id = c.installment_id
   and c.entries_for_installment = 1
   and c.installments_for_entry = 1;

comment on column rep_allocation_installments.accounting_entry_id is
  'The transfer_out (team-side) entry that "Record as paid" posted for this installment — written '
  'from mig 275 onward, and backfilled by 275 for older payments whose entry matched beyond doubt. '
  'NULL means either unpaid, or paid before 275 with no unambiguous match: the undo REFUSES on a '
  'paid installment with no link rather than clearing the stamp and leaving the money moved. '
  'Never a paid flag — paid_at is. Cleared when the payment is taken back, alongside paid_at.';
