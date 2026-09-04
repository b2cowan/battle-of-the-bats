-- 277 — A category belongs to somebody
-- (COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN — owner-approved from mockup ab93e2ad, 2026-09-04.)
--
-- Owner ruling, in his words: "teams should not be able to create shared categories, there are 2
-- types of categories: shared (created by the org to be used by org and team) and local (ones
-- coaches create that only they use but the org can read on their statements and such). we don't
-- need to have a complex mechanism where a coach can create and share amongst other teams or the
-- org. keep it simple."
--
-- ⚠⚠ THIS REVERSES A DELIBERATE DECISION MADE BY MIGRATION 240, and the comment it reverses is
-- still sitting in the coach route this migration makes wrong: "CATEGORIES ARE STILL ORG-WIDE. A
-- category is a heading, not a name: there are a dozen of them, clubs want them shared, and the
-- report's top level would fragment if each team invented its own." 240 gave ITEMS the three tiers
-- and consciously withheld them from categories. What the intervening three weeks showed is the
-- cost of that half-measure: a category a coach invents is silently everyone's, nothing records who
-- made it, and so NOBODY could be given a rename — the club could relabel a word it did not write,
-- and the team that wrote it could relabel six other teams' screens. The fragmentation 240 feared
-- is answered by the same thing that answered it for items: the club still SEES every team's
-- category on its own reports (owner ruling Q1, 2026-09-04), it simply is not offered one team's
-- word in another team's picker.
--
-- The three tiers are 240's, unchanged, now read from budget_categories too:
--
--   org_id NULL                  → PLATFORM default. Everyone sees it. Nobody can rename it.
--   org_id set, team_id NULL     → CLUB-SHARED. Every team in the org sees it; the club's own
--                                  budget files against it. Owner/Treasurer can rename it.
--   org_id set, team_id set      → THAT TEAM'S OWN. Only that team's picker offers it, and that
--                                  team renames it. The club reads it on cross-team reports.
--
-- ⚠ NO BACKFILL, AND THAT IS THE RULING (owner Q2, 2026-09-04). Every category that exists today
-- was created under the flat model and carries no record of who made it — a coach's and an admin's
-- are byte-identical rows. Attributing them by guesswork would take a heading six teams are
-- planning against and hand it to one of them. They all stay team_id NULL, which is to say SHARED,
-- which is exactly what they behave as today. Nothing changes underneath anybody.
alter table budget_categories
  add column if not exists team_id uuid references rep_teams(id) on delete cascade;

comment on column budget_categories.team_id is
  'WHO OWNS THIS CATEGORY (mig 277). NULL with org_id NULL = platform default, visible to everyone, '
  'renamable by nobody. NULL with org_id set = CLUB-SHARED, visible to every team in that org and to '
  'the club''s own budget, renamable by an Owner or Treasurer. Set = that TEAM''S OWN, offered in '
  'that team''s picker ONLY and renamable by that team''s coaches — the club still SEES it on '
  'cross-team reports (owner ruling Q1, 2026-09-04) but never edits it, and never files its own '
  'budget against it. Same three tiers and the same predicates as budget_items.team_id (mig 240): '
  'budgetItemTier / itemVisibleToTeam / itemOfferedToClub in lib/coach-budget-item-tiers.ts read '
  'both tables, aliased there under category names. ⚠ CASCADE, not SET NULL, for the same reason as '
  'items — a deleted team''s private headings must not silently become the club''s. Note the cascade '
  'is TWO HOPS here: budget_items.category_id is itself ON DELETE CASCADE, so deleting a team drops '
  'that team''s categories and the items filed under them. Records pointing at those items are '
  'protected separately (every budget_item_id / budget_category_id reference is ON DELETE SET NULL, '
  'and a row that loses its item renders under "Not itemized" rather than vanishing).';

create index if not exists budget_categories_team_idx
  on budget_categories (team_id) where team_id is not null;

-- ⚠ NO UNIQUE INDEX IS ADDED, DELIBERATELY. budget_categories has never had one — duplicate names
-- are silently allowed today and the POST route's 23505→409 branch has always been dead code for
-- categories (DATA_DICTIONARY, budget_categories.name). Adding one here would be a second change
-- riding a migration that exists for one reason, and it would fail outright on any org that already
-- holds a duplicate.
--
-- ⚠⚠ BUT THE APP-SIDE CHECK MUST MOVE, AND THIS IS THE TRAP THIS MIGRATION CREATES IF IT DOESN'T.
-- The coach create path refuses a name that already exists anywhere in the org. The moment a
-- category can be private, that refusal starts firing on rows the asking team CANNOT SEE: team B
-- types "Provincials Trip", team A invented one privately last week, and team B is refused a name
-- it has no way to find, look at, or use. Items hit this exact wall on the mig-240/248 pair. The
-- check is scoped to VISIBLE categories (platform + club-shared + this team's own) in the same
-- change that ships this column.
