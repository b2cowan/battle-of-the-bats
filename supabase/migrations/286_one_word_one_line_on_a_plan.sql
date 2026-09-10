-- 286 — One word, one line on a plan
-- (COACH_BUDGET_ONE_WORD_ONE_LINE_PLAN §Phase 3 — owner-approved 2026-09-09, mockup a6a3b078,
--  rulings Q1–Q5 all taken as recommended.)
--
-- THE RULING: a budget word carries **exactly one line per season plan**. Picking a word that is
-- already on the plan ADDS to the line that is there. This migration makes that true of the data
-- that already exists, and then makes it true in the database so no door can ever break it again.
--
-- ⚠⚠ WHY THE THIRD LEVEL GOES AT ALL. Real spending is matched to the plan by ITEM, never by line
-- (`rollupMoneyReport` keys `ItemRow` on `itemId`). Two lines on one word are, to every figure the
-- product prints, one thing wearing two labels: no variance, no match, no total can tell them
-- apart. The by-period grid has never been able to show the level, and a note-less second line was
-- named after its own month — which the When column beside it already printed. On this repo's own
-- fixture "Entry Fees" appeared three times in one column for weeks and nobody reported it,
-- because the rows still added up.
--
-- ⚠⚠ BLAST RADIUS, MEASURED ON BOTH DATABASES 2026-09-09 IMMEDIATELY BEFORE WRITING THIS (queried
-- live, never read off a plan):
--   · dev  — 60 budget lines, 8 with no word at all; **5 twin groups (10 lines), 4 of which carry
--            a note**, biggest group 2, affecting 3 of 11 plans.
--   · prod — 21 budget lines, 0 without a word; **1 twin group (2 lines), neither carrying a
--            note**, affecting 1 of 4 plans.
-- So the join below rewrites six lines on dev and one on prod, and joins four notes in total. This
-- is the cheapest this will ever be: no customer keeps a real budget on production yet.
--
-- ⚠⚠⚠ THE TWO FOREIGN KEYS ARE THE WHOLE RISK, AND THEY POINT IN OPPOSITE DIRECTIONS. Both were
-- read out of the committed snapshots before this was written:
--   · `rep_budget_periods.budget_line_id`        → ON DELETE **CASCADE**. Delete a loser first and
--     its payment periods go with it — the schedule this entire change exists to preserve.
--   · `rep_player_dues_schedules.budget_line_id` → ON DELETE **SET NULL**. A player's dues schedule
--     can point at a budget line; a plain delete silently unlinks it and NOTHING on any screen
--     would ever say so.
-- Both are re-pointed at the keeper BEFORE any delete. Do not reorder the statements below.
--
-- ⚠ WORD-LESS LINES ARE NOT TOUCHED. Pre-mig-243 lines carry no item and cannot be joined by one;
-- they keep their own typed descriptions and go on reporting in the "Not itemized" bucket. The
-- unique index is deliberately PARTIAL for exactly this reason, and no new line can be word-less:
-- both write doors have refused that since mig 243.
--
-- ⚠ ONE ITEM IS ONE DIRECTION, so the index needs no direction column. `line_kind` is derived from
-- the word (mig 280) and a word lives on exactly one shelf, so a single item can never hold both a
-- cost and a funding line.
--
-- Not schema-invisible on both counts: part 2 creates an index (the drift check sees it), part 1
-- rewrites rows (it cannot). Declared in MANUAL_PROD_STEPS.json accordingly.

-- ── Part 1 — join the twins ─────────────────────────────────────────────────────────────────────
do $$
declare
  g            record;
  keeper       uuid;
  merged_total numeric;
  merged_notes text;
  scheduled    numeric;
begin
  for g in
    select program_year_id, team_id, item_id
      from rep_budget_lines
     where item_id is not null
     group by 1, 2, 3
    having count(*) > 1
  loop
    -- The EARLIEST line survives, so the id a dues schedule or a bookmark already points at is the
    -- one that stays alive wherever possible. `id` breaks a same-timestamp tie deterministically.
    select id
      into keeper
      from rep_budget_lines
     where program_year_id = g.program_year_id
       and team_id         = g.team_id
       and item_id         = g.item_id
     order by created_at, id
     limit 1;

    -- The sum, and the notes joined in the order they were written. `nullif(btrim(...), '')` drops
    -- the empty ones so a single note never arrives wearing a stray "; ".
    select sum(total_amount),
           nullif(string_agg(nullif(btrim(coalesce(notes, '')), ''), '; '
                             order by created_at, id), '')
      into merged_total, merged_notes
      from rep_budget_lines
     where program_year_id = g.program_year_id
       and team_id         = g.team_id
       and item_id         = g.item_id;

    -- ⚠ RE-POINT BEFORE DELETING (see the header). The payment periods first.
    update rep_budget_periods
       set budget_line_id = keeper
     where budget_line_id in (
             select id from rep_budget_lines
              where program_year_id = g.program_year_id
                and team_id         = g.team_id
                and item_id         = g.item_id
                and id <> keeper);

    -- ⚠ Then the dues schedules, whose link would otherwise be nulled in silence.
    update rep_player_dues_schedules
       set budget_line_id = keeper
     where budget_line_id in (
             select id from rep_budget_lines
              where program_year_id = g.program_year_id
                and team_id         = g.team_id
                and item_id         = g.item_id
                and id <> keeper);

    delete from rep_budget_lines
     where program_year_id = g.program_year_id
       and team_id         = g.team_id
       and item_id         = g.item_id
       and id <> keeper;

    update rep_budget_lines
       set total_amount = merged_total,
           notes        = merged_notes,
           updated_at   = now()
     where id = keeper;

    -- The joined schedule reads in date order, undated last — the order every surface prints it in.
    with ordered as (
      select id,
             row_number() over (order by period_date nulls last, sort_order, id) - 1 as rn
        from rep_budget_periods
       where budget_line_id = keeper
    )
    update rep_budget_periods p
       set sort_order = ordered.rn
      from ordered
     where ordered.id = p.id;

    /* ⚠ THE UNSCHEDULED REMAINDER BECOMES A REAL UNDATED PERIOD (owner ruling Q4). Join a dated
       $900.00 onto an undated $600.00 and the line is legitimately part-scheduled — but every
       write door enforces "the split sums to the total" (readPeriodsPayload, ±$0.02), so leaving
       the gap implicit would make the very next edit of that line impossible to save. An undated
       period is a shape the product already has: it is what the grid's "No date yet" column is
       built from, and it is the honest answer rather than a date nobody chose.
       ⚠ Only when a split exists at all. No periods anywhere means the whole total is undated,
       which every reader already handles — inventing one there would be noise. */
    select coalesce(sum(amount), 0)
      into scheduled
      from rep_budget_periods
     where budget_line_id = keeper;

    if scheduled > 0 and (merged_total - scheduled) > 0.02 then
      insert into rep_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
      values (keeper,
              'No date yet',
              null,
              round(merged_total - scheduled, 2),
              (select coalesce(max(sort_order), -1) + 1
                 from rep_budget_periods where budget_line_id = keeper));
    end if;
  end loop;
end $$;

-- ── Part 2 — make it true, rather than merely enforced in three routes ───────────────────────────
-- The form, the spreadsheet import and "bring last season's plan" all create budget lines, and all
-- three now refuse a duplicate word. This is what makes that a fact rather than three agreements.
create unique index if not exists rep_budget_lines_one_line_per_item
    on rep_budget_lines (program_year_id, team_id, item_id)
 where item_id is not null;
