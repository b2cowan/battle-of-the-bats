-- 268: AN ENTRY IS AN ARRIVAL — the sponsor keeps its promise on its own row
-- (COACH_SPONSORSHIP_LIFECYCLE_PLAN §2, owner-ruled 2026-08-28: Q12 arrivals, Q16 multi-family
-- credit. Supersedes exactly one statement of migration 237: "the record IS the row and carries
-- exactly one entry.")
--
-- THE CASE. Hilltop Autos promises $2,000 in June and pays $250 in July and $250 in August.
-- Until now that story could not be told: a sponsor was one record plus exactly ONE entry, the
-- entry held the promise and the money interchangeably, and the second cheque had to be typed
-- over the first — two arrivals collapsed into one line dated whenever the treasurer reached the
-- keyboard. After this migration:
--
--   · the PROMISE lives on the sponsor row itself (pledged_amount);
--   · an ENTRY means exactly one thing, everywhere: money that actually landed — dated,
--     with a method, possibly several per sponsor;
--   · a PLEDGED sponsor therefore has ZERO entries (its old promise-holding entry is deleted
--     below, after proving it never carried money);
--   · the credited families move off the entry into rep_fundraiser_credit_plan — one row per
--     family share (Q16), so an arrival can fund several families' dues credits at once.
--
-- ⚠⚠ THIS IS THE STATEMENT THAT REACHES EXISTING CODE, and it is the same class of reach as
-- 237's "an entry may have no player" (which broke readers found only by sweep). Every reader
-- that derived a PLEDGED figure from an unrealised entry goes structurally blind the moment
-- pledged sponsors have no entries — the Phase-B build carries the counted inventory of every
-- such site (money-summary, the BvA forward lens, the register's scheduled pledge line, the
-- fundraisers list). Apply this migration only WITH that build; it is not a standalone tidy-up.

-- ── 1. The promise ──────────────────────────────────────────────────────────────────────────
alter table rep_fundraisers
  add column if not exists pledged_amount numeric;

comment on column rep_fundraisers.pledged_amount is
  'SPONSOR ONLY: the agreed amount — the promise, whether or not money has arrived yet. NULL on '
  'a fundraiser (a drive has targets in the budget plan, not here). "Still to come" is '
  'pledged_amount minus the sum of this sponsor''s arrivals, floored at zero. Set at create '
  'time (a sponsor recorded directly as received pledges what arrived); edited on the record''s '
  'settings.';

-- Backfill: every existing sponsor's single entry stated the agreement.
update rep_fundraisers f
   set pledged_amount = e.amount_raised
  from rep_fundraiser_entries e
 where e.fundraiser_id = f.id
   and f.kind = 'sponsor'
   and f.pledged_amount is null;

-- ── 2. The arrival's method ─────────────────────────────────────────────────────────────────
-- Same five tokens as every other money surface (mig 260's one list, owner 2026-08-22).
alter table rep_fundraiser_entries
  add column if not exists method text;

alter table rep_fundraiser_entries
  drop constraint if exists rep_fundraiser_entries_method_check;
alter table rep_fundraiser_entries
  add constraint rep_fundraiser_entries_method_check
  check (method is null or method in ('etransfer', 'cash', 'cheque', 'card', 'other'));

comment on column rep_fundraiser_entries.method is
  'How this arrival came in — the product-wide five-token list. NULL when not recorded (every '
  'row before 2026-08-28, and optional after). Sponsor arrivals set it from the recording '
  'forms; drive entries may adopt it later but nothing writes it for them yet.';

-- ── 3. The credit plan — who is credited, and by how much ───────────────────────────────────
-- One row per credited family (Q16). share_unit follows the standing rule: the credit STORES
-- dollars when the agreement was dollars; percent is provenance when the agreement was a rate.
create table if not exists rep_fundraiser_credit_plan (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id)      on delete cascade,
  team_id       uuid not null references rep_teams(id)          on delete cascade,
  fundraiser_id uuid not null references rep_fundraisers(id)    on delete cascade,
  player_id     uuid not null references rep_roster_players(id) on delete cascade,
  share_value   numeric not null check (share_value > 0),
  share_unit    text    not null check (share_unit in ('amount', 'percent')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (fundraiser_id, player_id)
);

comment on table rep_fundraiser_credit_plan is
  'SPONSOR ONLY: the agreed split of a sponsor''s credit among families — one row per family, '
  '$ or % each (owner ruling Q16, 2026-08-28). The PLAN is the agreement; the money is the '
  'rep_dues_credits rows that accrue per ARRIVAL (fundraiser_entry_id) as cheques land: a '
  'percent share earns pct x each arrival; a dollar share fills proportionally against '
  'pledged_amount and trues up on the arrival that reaches the pledge. Editing the plan '
  're-derives every arrival''s credits from scratch behind the payout floor. Drives never have '
  'rows here — their per-player credits stay snapshotted on their entries, unchanged.';

create index if not exists rep_fundraiser_credit_plan_fundraiser_idx
  on rep_fundraiser_credit_plan(fundraiser_id);
create index if not exists rep_fundraiser_credit_plan_player_idx
  on rep_fundraiser_credit_plan(player_id);
create index if not exists rep_fundraiser_credit_plan_org_idx
  on rep_fundraiser_credit_plan(org_id);

alter table rep_fundraiser_credit_plan enable row level security;

-- Mirrors rep_fundraiser_entries' posture (mig 030): org members read; coaches on the team or
-- money-side org roles write. The API writes through the service role and re-checks capability
-- itself; these policies are the browse-path floor.
create policy "read rep_fundraiser_credit_plan"
  on rep_fundraiser_credit_plan for select
  using (org_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

create policy "write rep_fundraiser_credit_plan"
  on rep_fundraiser_credit_plan for all
  using (
    org_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'treasurer')
    )
    or team_id in (
      select team_id from rep_team_coaches where user_id = auth.uid()
    )
  );

-- Backfill: each sponsor entry that named a family becomes that family's plan row, with the
-- unit its provenance recorded — percent when a rate was agreed, dollars when dollars were.
insert into rep_fundraiser_credit_plan
  (org_id, team_id, fundraiser_id, player_id, share_value, share_unit)
select e.org_id, e.team_id, e.fundraiser_id, e.player_id,
       case when coalesce(e.rebate_percent, 0) > 0 then e.rebate_percent else e.rebate_amount end,
       case when coalesce(e.rebate_percent, 0) > 0 then 'percent' else 'amount' end
  from rep_fundraiser_entries e
  join rep_fundraisers f on f.id = e.fundraiser_id
 where f.kind = 'sponsor'
   and e.player_id is not null
   and (coalesce(e.rebate_percent, 0) > 0 or coalesce(e.rebate_amount, 0) > 0)
on conflict (fundraiser_id, player_id) do nothing;

-- ── 4. Existing sponsor entries become honest arrivals ──────────────────────────────────────
-- A RECEIVED sponsor's entry is its first arrival: it gets the day its money actually posted
-- (the ledger row's own date — the truest record we hold), and gives up its player attribution
-- to the plan table above.
update rep_fundraiser_entries e
   set received_date = coalesce(
         e.received_date,
         (select a.entry_date from accounting_entries a where a.id = e.accounting_entry_id),
         e.created_at::date
       ),
       player_id = null
  from rep_fundraisers f
 where f.id = e.fundraiser_id
   and f.kind = 'sponsor'
   and f.sponsor_status = 'received';

-- ── 5. A pledged sponsor has zero entries ───────────────────────────────────────────────────
-- ⚠ Pre-flight: prove the rows we are about to delete never carried money. By the realised
-- invariant (mig 237 + the 2026-08-15 reader guards) a pledged sponsor's entry has no
-- accounting row and no credit; if one somehow does, refuse loudly rather than delete history.
do $$
declare bad integer;
begin
  select count(*) into bad
    from rep_fundraiser_entries e
    join rep_fundraisers f on f.id = e.fundraiser_id
   where f.kind = 'sponsor'
     and f.sponsor_status = 'pledged'
     and (e.accounting_entry_id is not null or e.credit_id is not null);
  if bad > 0 then
    raise exception '268 refused: % pledged-sponsor entr(y/ies) carry an accounting row or credit — a pledge with money behind it is corrupt state; heal it before this migration.', bad;
  end if;
end $$;

delete from rep_fundraiser_entries e
 using rep_fundraisers f
 where f.id = e.fundraiser_id
   and f.kind = 'sponsor'
   and f.sponsor_status = 'pledged';

-- ── 6. The comments catch up with the model ─────────────────────────────────────────────────
comment on column rep_fundraiser_entries.player_id is
  'The roster player this amount belongs to — on a FUNDRAISER entry, always set. On a SPONSOR '
  'entry (an ARRIVAL, as of 2026-08-28) always NULL: the credited families live on '
  'rep_fundraiser_credit_plan, and one arrival can fund several families'' credits via '
  'rep_dues_credits.fundraiser_entry_id. (This supersedes 237''s "a null player means no dues '
  'credit is possible".)';

comment on constraint rep_fundraiser_entries_fundraiser_id_player_id_key on rep_fundraiser_entries is
  'One row per PLAYER per drive. Does NOT cap a sponsor''s rows: sponsor arrivals all carry '
  'player_id NULL, and SQL NULLs are distinct for uniqueness — any number of arrivals satisfy '
  'this constraint. That is deliberate (mig 268): an entry is an arrival, and a sponsor may '
  'have many.';

comment on column rep_fundraiser_entries.credit_id is
  'DRIVE entries only, 1:1 with the credit their rebate created. RETIRED FROM THE WRITE PATH '
  'for sponsor arrivals (mig 268) — an arrival''s credits are found the other way, '
  'rep_dues_credits.fundraiser_entry_id, because one arrival can credit several families. '
  'Kept in place for drives and history; never dropped casually.';
