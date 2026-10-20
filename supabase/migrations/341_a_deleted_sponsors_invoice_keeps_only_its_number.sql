-- 341: a deleted sponsor's invoice keeps only its number — Coach Sponsor Invoice (owner ruling 2026-10-20).
--
-- Owner, asked whether the tombstone row should keep the sponsor's contact details once the sponsorship is deleted:
-- "it can keep the number". Migration 339 keeps the row (fundraiser_id ON DELETE SET NULL) so the number is never
-- handed to a second business; that row no longer needs who the sponsor was or how to reach them.
--
-- The moment the sponsor link goes NULL — the foreign key's own SET NULL, which fires row triggers like any UPDATE —
-- the bill-to contact is cleared. The number (season_year + seq), the amount, the dates and the description stay:
-- they are the team's bookkeeping, not the sponsor's contact. bill_to_name is NOT NULL, so it reads a fixed word.

create or replace function public.rep_sponsor_invoices_forget_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fundraiser_id is null and old.fundraiser_id is not null then
    new.bill_to_name      := 'Deleted sponsorship';
    new.bill_to_attention := null;
    new.bill_to_email     := null;
    new.bill_to_address   := null;
  end if;
  return new;
end;
$$;

drop trigger if exists rep_sponsor_invoices_forget_contact on public.rep_sponsor_invoices;
create trigger rep_sponsor_invoices_forget_contact
  before update of fundraiser_id on public.rep_sponsor_invoices
  for each row execute function public.rep_sponsor_invoices_forget_contact();

revoke all on function public.rep_sponsor_invoices_forget_contact() from public, anon, authenticated;

comment on function public.rep_sponsor_invoices_forget_contact() is
  'Coach Sponsor Invoice (mig 341, owner 2026-10-20 "it can keep the number"): when a sponsorship is deleted and its '
  'invoice row''s fundraiser_id goes NULL, clears the bill-to contact. The number, amount, dates and description stay.';
