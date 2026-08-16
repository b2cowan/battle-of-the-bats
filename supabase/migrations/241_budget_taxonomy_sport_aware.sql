-- 241 — The starting budget vocabulary knows what sport the team plays
-- (owner ruling 2026-08-16, from a real club budget)
--
-- ⚠ THE DEFAULT LIBRARY WAS DIAMOND-SHAPED AND THE PLATFORM IS NOT. Bats, Batting Cages, Diamond
-- Permits, Umpire Fees, Plate Fees — a basketball club opening the budget planner met a vocabulary
-- that did not describe its season. That was survivable while the item was an optional label. It
-- stopped being survivable with migration 240, which made the ITEM the name of every budget row:
-- the wrong vocabulary is now the coach's whole plan, on screen and in every export.
--
-- The Sport Pack (lib/sports.ts) already owns this kind of language everywhere else in the product
-- — positions, period names, the word for a game. Budgets were the one place it did not reach.
--
-- ⚠ AN ARRAY, NOT A SINGLE SPORT, and that is the point rather than future-proofing. Baseball and
-- softball genuinely share a vocabulary — one diamond, one set of umpires, one cage — so a single
-- `sport` column would force either duplicate rows (two "Diamond Permits" a club could pick the
-- wrong one of) or a false choice between them.
--
-- ⚠ NULL MEANS EVERY SPORT, and most rows are NULL. Uniforms, travel, insurance, bank fees and
-- league registration are what a season costs whatever is being played; only the genuinely
-- sport-shaped words get tagged. A default of "universal" also means every row written before this
-- migration keeps behaving exactly as it did.

alter table budget_categories
  add column if not exists sports text[];

alter table budget_items
  add column if not exists sports text[];

comment on column budget_categories.sports is
  'Which sports this category is offered to (mig 241). NULL = every sport, which is the common '
  'case — most of what a season costs is sport-agnostic. Values are Sport Pack ids from '
  'lib/sports.ts (softball, baseball, basketball, soccer, hockey, volleyball, lacrosse, other); '
  '⚠ compare through normalizeSportId, because rep_teams.sport holds mixed casing ("Baseball" and '
  '"baseball" both exist in live data). Enforced in the app, not the database: the one predicate '
  'is itemVisibleToTeam in lib/coach-budget-items.ts, shared by the picker and every write path.';

comment on column budget_items.sports is
  'Which sports this item is offered to (mig 241) — same rule as budget_categories.sports. NULL = '
  'every sport. ⚠ An item is only reachable if its CATEGORY is also offered to that sport; the '
  'category is the coarser gate and is checked first.';

-- ── 1. Tag what is genuinely diamond vocabulary ──────────────────────────────────────────────
-- Baseball and softball, together. Everything not named here stays NULL — universal.
update budget_items i set sports = array['softball','baseball']
  from budget_categories c
 where i.category_id = c.id
   and i.org_id is null
   and (
        (c.name = 'Facilities' and i.name in ('Diamond Permits'))
     or (c.name = 'Officials'  and i.name in ('Umpire Fees', 'Plate Fees'))
     or (c.name = 'Team Gear'  and i.name in ('Bats', 'Balls'))
     or (c.name = 'Training'   and i.name in ('Batting Cages'))
   );

-- ── 2. The three placements that stopped reading as sentences ────────────────────────────────
-- ⚠ The item NAMES the row now, so a coach reads "Tournaments / Uniforms" as a heading, and it
-- does not parse — Team Gear already carries the same thing. Retired rather than deleted: lines
-- already pointing at it keep resolving their name, they are simply never offered again. (`is_misc`
-- is the existing "in the database, never in the picker" flag — mig 240 retired Misc the same way.)
update budget_items i set is_misc = true
  from budget_categories c
 where i.category_id = c.id and i.org_id is null
   and c.name = 'Tournaments' and i.name in ('Uniforms', 'Travel');

-- Cage/tunnel hire is a FACILITY a team books, not instruction it buys. Moved rather than
-- duplicated, so the lines already pointing at it follow to the right heading.
update budget_items i
   set category_id = (select id from budget_categories where org_id is null and name = 'Facilities'),
       name = 'Cage or tunnel rental'
  from budget_categories c
 where i.category_id = c.id and i.org_id is null
   and c.name = 'Training' and i.name = 'Batting Cages';

-- ── 3. Two categories a real season needs and had nowhere to put ─────────────────────────────
-- Drawn from a real club budget (owner, 2026-08-16). "League & fees" is the biggest hole it
-- exposed: that budget carries THREE separate registration lines, and the only place we offered
-- for them was org-scoped, which a coach cannot reach — so they were landing under Tournament
-- entry fees and inflating the one line a coach most wants to trust.
insert into budget_categories (org_id, name, scope, sort_order, is_default, sports)
select null, v.name, 'team', v.sort_order, true, null
  from (values ('Travel', 65), ('League & Fees', 75)) as v(name, sort_order)
 where not exists (
   select 1 from budget_categories where org_id is null and name = v.name
 );

-- ── 4. The items themselves ──────────────────────────────────────────────────────────────────
-- All NULL sports: transport, meals, registration, insurance and bank fees cost the same whatever
-- is being played. Sport-shaped additions are tagged in step 5.
insert into budget_items (category_id, org_id, name, sort_order, is_default, is_misc, sports)
select c.id, null, v.name, v.sort_order, true, false, null
  from (values
    -- Travel — also the home for team meals, which a real budget carries several lines of
    -- (team dinners, snacks, banquet) and which had nowhere to go at all.
    ('Travel',        'Transport',                 10),
    ('Travel',        'Accommodation',             20),
    ('Travel',        'Team meals',                30),
    -- League & Fees — the biggest gap the real budget exposed.
    ('League & Fees', 'League registration',       10),
    ('League & Fees', 'Association fees',          20),
    ('League & Fees', 'Insurance',                 30),
    ('League & Fees', 'Software & subscriptions',  40),
    ('League & Fees', 'Bank & payment fees',       50),
    -- Training splits into instruction and equipment; it used to be one word for three things.
    ('Training',      'Skills instruction',        40),
    ('Training',      'Strength & conditioning',   50),
    ('Training',      'Practice equipment',        60),
    -- Facilities gains indoor space (a gym is not a dome and neither is a diamond).
    ('Facilities',    'Indoor space',              25),
    -- Team Gear: what a real roster actually buys, plus the staff nobody budgeted for.
    ('Team Gear',     'Pants',                     15),
    ('Team Gear',     'Socks',                     16),
    ('Team Gear',     'Coach & staff apparel',     60),
    -- The trophies, as distinct from the evening they are handed out at.
    ('Events',        'Player awards & gifts',     50)
  ) as v(category_name, name, sort_order)
  join budget_categories c on c.org_id is null and c.name = v.category_name
 where not exists (
   select 1 from budget_items existing
    where existing.category_id = c.id and existing.org_id is null
      and lower(existing.name) = lower(v.name)
 );

-- ── 5. Sport-shaped additions ────────────────────────────────────────────────────────────────
-- Helmets are diamond gear here; a hockey or lacrosse club needs its own word and will add one.
update budget_items i set sports = array['softball','baseball']
  from budget_categories c
 where i.category_id = c.id and i.org_id is null
   and c.name = 'Facilities' and i.name = 'Cage or tunnel rental';

insert into budget_items (category_id, org_id, name, sort_order, is_default, is_misc, sports)
select c.id, null, 'Helmets', 17, true, false, array['softball','baseball']
  from budget_categories c
 where c.org_id is null and c.name = 'Team Gear'
   and not exists (
     select 1 from budget_items existing
      where existing.category_id = c.id and existing.org_id is null
        and lower(existing.name) = 'helmets'
   );
