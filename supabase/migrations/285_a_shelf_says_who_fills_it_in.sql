-- 285 — A shelf says who fills it in, and a drive names the line it is raising for
-- (COACH_FUNDRAISING_ONE_WAY_IN_PLAN §3.1 — owner-approved model, mockup 8aa1e633, 2026-09-08.)
--
-- THE RULING, in the owner's frame: **the category a word sits in decides who fills its number in
-- and where it reports.** Fundraising and Sponsorship money is ALWAYS recorded on the Fundraising
-- tab — a fundraiser names which Fundraising line it is raising for, a sponsor which Sponsorship
-- line — and everything else is always typed into "Other money in". A line reports under its
-- category's shelf.
--
-- ⚠⚠ MIGRATION 280 PUT THE ANSWER ON THE WORD; THIS PUTS IT ON THE SHELF, AND THE TWO ARE NOT THE
-- SAME FACT. 280's `budget_items.actual_source` says who reports THIS WORD's actual, and its own
-- header states the load-bearing default: a word a coach or a club invents is born 'typed', because
-- "a word a coach invents has no machinery behind it". That was right while the shelf meant nothing.
-- Under this ruling the shelf IS the machinery: a coach who files "Bake sale money" under
-- Fundraising has said it will be filled in from a drive, and the product now knows that at the
-- moment the word is created. So 280's default survives — it is still what a word gets when nothing
-- says otherwise — and this column is what says otherwise.
--
-- ⚠ THE DEFECT IT CLOSES (plan finding 5): every coach- and club-created word is born 'typed', and
-- 'typed' derives `other_income`, so a word added to the FUNDRAISING shelf reported under "Other
-- income" while its own row read "Fundraising · …". The row said one thing and the heading said
-- another, forever, with no way for the coach to correct it.
--
-- ⚠ BLAST RADIUS TODAY: ZERO, MEASURED ON BOTH DATABASES 2026-09-08 immediately before writing this
-- (the same read mig 280 made a week earlier, repeated rather than trusted):
--   · NO club- or coach-created money-in `budget_items` exist on dev or on production. Every
--     money-in word in existence is a PLATFORM one, and every platform one already carries the
--     `actual_source` this migration's shelf implies — so part 3 below matches zero rows and no
--     word changes what reports it.
--   · Exactly ONE `rep_team_money_in` income row sits on a non-typed word on each database, and it
--     is the same record both times: the coach demo's $480 "Team hoodie order — margin" on
--     Fundraising · Merchandise sales (riverdale-ridge). The demo seed turns it into a drive with a
--     whole-team entry in this same release; nothing else is touched, and legacy typed rows stay
--     readable and counted exactly as they are today.
--
-- ⚠⚠⚠ RELEASE ORDER: THIS CANNOT REACH PRODUCTION AHEAD OF MIGRATIONS 274, 276, 280 AND 282, all of
-- which were still prod-owed when this was written (verified against production's own
-- `information_schema`, not against a plan: `budget_items.actual_source` does not exist there, and
-- neither does the platform "Other Income" category). Part 3 reads `actual_source`; part 1's whole
-- purpose is to feed `budgetLineKindForItem`, which stores `other_income`; and part 4's backfill
-- reads `rep_budget_lines.line_kind = 'sponsorship'` against a library where Grant has moved
-- shelves. Applied out of order this fails outright rather than silently, which is the cheaper of
-- the two — but it is written down here so nobody has to discover that.

-- ── 1. The shelf carries its source ─────────────────────────────────────────────────────────────
--
-- ⚠ A COLUMN, NOT A NAME LOOKUP — mig 280's own reasoning, one level up. The alternative was
-- deriving at item-create time from the platform category's NAME, which is cheap and wrong the day
-- a club invents its own category called "Fundraising": that club's word has no drives behind it and
-- must stay typed. A column is what the category IS.
--
-- ⚠ THE DEFAULT IS AGAIN THE LOAD-BEARING HALF. Every category except the two platform shelves named
-- below is 'typed' — platform Tournaments and Other Income, every club-shared heading, every team's
-- own heading, INCLUDING a club heading that happens to share a name with one of ours. A shelf
-- defaulting to a derived source would close its words' rows to the only way their money can be
-- recorded (lib/coach-money-derived.ts: one row, one source).
alter table budget_categories
  add column if not exists income_source text not null default 'typed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'budget_categories'::regclass and conname = 'budget_categories_income_source_check'
  ) then
    alter table budget_categories
      add constraint budget_categories_income_source_check
      check (income_source in ('typed', 'fundraiser', 'sponsor'));
  end if;
end $$;

-- ⚠ PLATFORM ROWS ONLY (`org_id is null`), MATCHED BY NAME ONCE, HERE. This is the one place a name
-- may decide it: the platform library's names are ours and cannot change under us, and after this
-- statement nothing in the product ever looks a shelf up by name again.
update budget_categories
   set income_source = 'fundraiser'
 where org_id is null and lower(name) = 'fundraising';

update budget_categories
   set income_source = 'sponsor'
 where org_id is null and lower(name) = 'sponsorship';

comment on column budget_categories.income_source is
  'WHO FILLS IN THE MONEY-IN WORDS ON THIS SHELF (mig 285): ''typed'' = the coach records each '
  'arrival themselves under "Other money in", ''fundraiser'' = a drive on the Fundraising tab '
  'reports it, ''sponsor'' = a sponsor does. ⚠ THIS IS WHAT A NEW WORD''S budget_items.actual_source '
  'IS DERIVED FROM (owner ruling 2026-09-08): a word filed on the Fundraising shelf is a fundraising '
  'word FROM BIRTH — recorded on the Fundraising tab, reported under Fundraising — where before this '
  'every coach- and club-created word was born ''typed'' and reported under Other income whatever '
  'shelf it sat on. ⚠ It also FILTERS the "Raising for" picker on a fundraiser (fundraiser shelf) '
  'and on a sponsor (sponsor shelf), and the server checks the match: a drive cannot raise for a '
  'sponsorship word by API either. ⚠ NOT NULL, default ''typed'' — every shelf but the two PLATFORM '
  'ones set here, a club heading sharing one of their names included. ⚠ No coach or club write path '
  'accepts it; only a migration can move a shelf, and moving one re-files every word on it the next '
  'time each is saved (the same rule budget_items.actual_source records).';

-- ── 2. A drive or a sponsor names the line it is raising for ────────────────────────────────────
--
-- ⚠⚠ WHY IT IS ON THE RECORD AND NOT DERIVED. Until now nothing linked a drive to a budget line at
-- all, so `placeDerivedActual` (lib/coach-money-derived.ts) placed the whole per-source POOL by what
-- the plan happened to claim: one fundraising line and it landed there; TWO and both rows went blank
-- while the money collected in a row called "Not itemized". A team was punished for planning
-- carefully. The record says which line it is raising for, and the pool stops being a pool.
--
-- ⚠ THE CATEGORY IS STORED ALONGSIDE THE ITEM and re-derived from it on every write — mig 282 part
-- 2's rule, and the reason is written out there: Budget vs. Actual reads the two levels in DIFFERENT
-- orders, so a row keeping one heading while its word lives under another reports under two
-- headings depending which half of the page is asking.
--
-- ⚠ ON DELETE SET NULL on both, matching every other table that files against the taxonomy
-- (rep_team_expenses, rep_team_money_in, rep_team_payment_requests, rep_allocation_splits). A drive
-- whose line was removed keeps its money and reads as the honest gap it now is.
--
-- ⚠⚠ AND `rep_fundraisers` JOINS `BUDGET_ITEM_REFERENCES` IN THE SAME COMMIT
-- (lib/coach-budget-item-usage.ts). That list is what the fold, the publish route and the remove
-- guard walk, `tests/unit/budget-item-references-guard.test.ts` fails the build on a foreign key it
-- does not cover, and the 2026-08-17 defect it exists to prevent was exactly this: a new table
-- pointing at budget_items and nobody adding it, so every record filed against an absorbed word lost
-- its classification silently on a path that reported success.
alter table rep_fundraisers
  add column if not exists budget_item_id uuid references budget_items(id) on delete set null;

alter table rep_fundraisers
  add column if not exists budget_category_id uuid references budget_categories(id) on delete set null;

create index if not exists idx_rep_fundraisers_budget_item on rep_fundraisers(budget_item_id);

comment on column rep_fundraisers.budget_item_id is
  'THE BUDGET LINE THIS RECORD IS RAISING FOR (mig 285) — the word its realised money lands on in '
  'Budget vs. Actual. Filtered to the record''s own shelf and checked server-side: a '
  'kind=''fundraiser'' record may only point at a word whose category income_source is '
  '''fundraiser'', a kind=''sponsor'' record only at a ''sponsor'' one. ⚠ NULLABLE, and NULL is a '
  'real state rather than an oversight: every record written before this migration that the backfill '
  'could not place UNAMBIGUOUSLY was left null on purpose (see the backfill note), and such a record '
  'still places by the legacy pool rule with a quiet nudge in its room. ⚠ budget_category_id is '
  'stored beside it and re-derived FROM it on every write (mig 282 part 2''s rule) — the report reads '
  'the two levels in different orders. ⚠ ON DELETE SET NULL: deleting the line does NOT re-point the '
  'drive (plan §4) — the money then reads as income not in the plan, which is honest.';

comment on column rep_fundraisers.budget_category_id is
  'The shelf of `budget_item_id`, stored alongside it and re-derived from it on every write '
  '(mig 285; the rule is mig 282 part 2''s). Never set independently — a record filed under a '
  'category its own word does not live in makes the report''s two levels disagree about one row.';

-- ── 3. Every existing word already agrees with its shelf — asserted, not assumed ─────────────────
--
-- ⚠ THIS MATCHED ZERO ROWS ON BOTH DATABASES when it was written, and it is here for the invariant
-- rather than for the rows: from this release a money-in word's `actual_source` IS its shelf's
-- `income_source` (the coach and club item-create paths derive it, never taking it from the body).
-- Anything already out of step would be a word whose row reads "Fundraising · …" under an "Other
-- income" heading — finding 5 — so it is brought into line here rather than left as a state the
-- product can no longer produce but still has to render.
--
-- ⚠ MONEY-OUT WORDS ARE UNTOUCHED. `budget_items_out_is_typed_check` (mig 280) makes a spending
-- word always typed, and the direction filter is what keeps this statement on the right side of it.
update budget_items i
   set actual_source = c.income_source
  from budget_categories c
 where c.id = i.category_id
   and i.direction = 'in'
   and i.actual_source <> c.income_source;

-- ── 4. Backfill: link a record to the line today's report ALREADY places it on ───────────────────
--
-- ⚠⚠ THE RULE IS "PRESERVE TODAY'S REPORT", NOT "FILL IN THE BLANKS", and the difference is a team's
-- money moving rows behind their back. A team that budgeted ONLY *Merchandise sales* sees its drive
-- money on that line today, because `placeDerivedActual` places a pool on the single line that
-- claims it. Blanket-defaulting every drive to the standard word *Fundraising drive* would jump that
-- team's money to a row they never planned while Merchandise went blank — the mockup's "what ships
-- with it" §3, the one that bites.
--
-- So: a record is linked ONLY where its season's plan is unambiguous — every money-in line of that
-- record's kind points at ONE item. Two lines on one item still count as one item (the same answer
-- `placeDerivedActual` gives), two DIFFERENT items leave it null, and no line at all leaves it null.
-- A null record keeps today's pooled placement exactly and meets one quiet nudge in its own room,
-- which is the only place a coach ever sees the legacy state.
--
-- ⚠ THE KINDS ARE MATCHED THROUGH THE LINE KIND, never through a name: `funding` is a drive's kind
-- and `sponsorship` is a sponsor's — the same mapping `LINE_KIND_ACTUAL_SOURCE` holds in code.
-- `other_income` lines are deliberately absent: nothing reports them, which is what typed means.
--
-- ⚠ THE CATEGORY COMES FROM THE ITEM, not from the budget line, even though the line stores one. The
-- item is the authority (mig 282 moved a word between shelves and had to re-point six tables' stored
-- categories to match); reading the line's copy here would import any staleness it happens to carry.
with claim as (
  select l.program_year_id,
         case when l.line_kind = 'sponsorship' then 'sponsor' else 'fundraiser' end as record_kind,
         count(distinct l.item_id)          as item_count,
         -- ⚠ `array_agg`, not `min` — Postgres has no `min(uuid)`, and casting through text to get
         -- one would be picking an item by the alphabetical order of its id. The row is only used
         -- where `item_count = 1`, so any element of the array IS the item.
         (array_agg(distinct l.item_id))[1] as item_id
    from rep_budget_lines l
   where l.line_kind in ('funding', 'sponsorship')
     and l.item_id is not null
   group by 1, 2
)
update rep_fundraisers f
   set budget_item_id     = c.item_id,
       budget_category_id = i.category_id
  from claim c
  join budget_items i on i.id = c.item_id
 where c.item_count = 1
   and c.program_year_id = f.program_year_id
   and c.record_kind = coalesce(f.kind, 'fundraiser')
   and f.budget_item_id is null;
