-- 242 — Three corrections to the sport tagging, found by reading the result
--
-- ⚠ WRITTEN BECAUSE 241 WAS CHECKED BY LOOKING AT WHAT A BASKETBALL TEAM WOULD ACTUALLY SEE, not
-- by re-reading the migration. Printing both libraries side by side took a minute and found three
-- things the SQL had looked perfectly reasonable about. Kept as its own migration rather than an
-- edit to 241: that one is already applied, and editing an applied migration is the drift this
-- repo's dictionary rules exist to stop.

-- ── 1. Balls are not a diamond word ──────────────────────────────────────────────────────────
-- ⚠ THE WORST OF THE THREE. 241 tagged "Balls" as softball+baseball alongside Bats, and the result
-- was a basketball team that could budget for jerseys, socks and a banner but not for balls. Bats
-- stay tagged — a bat really is diamond equipment; a ball is every sport that isn't hockey.
update budget_items i set sports = null
  from budget_categories c
 where i.category_id = c.id and i.org_id is null
   and c.name = 'Team Gear' and i.name = 'Balls';

-- ── 2. Every sport pays its officials; only some call them umpires ───────────────────────────
-- 241 left Officials holding nothing but "Certification" for a basketball club — the category was
-- there, and a coach could not name a single thing they actually pay for in it.
insert into budget_items (category_id, org_id, name, sort_order, is_default, is_misc, sports)
select c.id, null, 'Referee fees', 5, true, false,
       array['basketball','soccer','hockey','volleyball','lacrosse','other']
  from budget_categories c
 where c.org_id is null and c.name = 'Officials'
   and not exists (
     select 1 from budget_items existing
      where existing.category_id = c.id and existing.org_id is null
        and lower(existing.name) = 'referee fees'
   );

-- ── 3. A "dome" is a diamond-culture word ────────────────────────────────────────────────────
-- Winter dome hire is what a baseball or softball club books; every other sport books a gym or a
-- court, which 241 already added as the universal "Indoor space".
update budget_items i set sports = array['softball','baseball']
  from budget_categories c
 where i.category_id = c.id and i.org_id is null
   and c.name = 'Facilities' and i.name = 'Dome Time';
