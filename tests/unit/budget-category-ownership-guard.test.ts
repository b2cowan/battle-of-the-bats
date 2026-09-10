/**
 * WHOSE PICKER A BUDGET *CATEGORY* APPEARS IN (mig 277).
 *
 * The one-level-up sibling of `coach-budget-item-tiers.test.ts`, and it exists for the same reason
 * that one does: the failure is silent. A heading one team invented showing up in another team's
 * picker looks like a longer list, not like a bug — and by the time anyone notices, two teams are
 * planning under each other's words and a rename touches a screen nobody meant to touch.
 *
 * Owner ruling 2026-09-04, in his words:
 *
 *   > "teams should not be able to create shared categories, there are 2 types of categories:
 *   >  shared (created by the org to be used by org and team) and local (ones coaches create that
 *   >  only they use but the org can read on their statements and such)."
 *
 * ⚠⚠ THE FIRST BLOCK IS THE ANTI-DRIFT GUARD AND IT IS THE POINT OF THE FILE. Categories are meant
 * to read the item predicates by IDENTITY — aliases, not copies — because both levels now carry the
 * same two ownership columns and any second implementation would be free to disagree with the first
 * one quietly. `assert.equal` on the function objects is what makes "one definition" enforceable
 * rather than merely intended: re-implement `categoryVisibleToTeam` as its own function and this
 * fails, even if the new copy is correct on the day it is written.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  budgetItemTier, itemVisibleToTeam, itemOfferedToClub,
  budgetCategoryTier, categoryVisibleToTeam, categoryOfferedToClub,
} from '../../lib/coach-budget-item-tiers.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

const CLUB = 'org-riverdale';
const OTHER_CLUB = 'org-somewhere-else';
const TEAM = 'team-14u';
const OTHER_TEAM = 'team-12u';

const platformCategory  = { org_id: null,       team_id: null };
const sharedCategory    = { org_id: CLUB,       team_id: null };
const ourCategory       = { org_id: CLUB,       team_id: TEAM };
const otherTeamCategory = { org_id: CLUB,       team_id: OTHER_TEAM };
const otherClubCategory = { org_id: OTHER_CLUB, team_id: null };

describe('category predicates are the item predicates', () => {
  it('is ONE definition per rule, aliased — never a second copy', () => {
    assert.equal(budgetCategoryTier, budgetItemTier);
    assert.equal(categoryVisibleToTeam, itemVisibleToTeam);
    assert.equal(categoryOfferedToClub, itemOfferedToClub);
  });
});

describe('budgetCategoryTier', () => {
  it('reads the two ownership columns as three tiers', () => {
    assert.equal(budgetCategoryTier(platformCategory), 'platform');
    assert.equal(budgetCategoryTier(sharedCategory), 'club');
    assert.equal(budgetCategoryTier(ourCategory), 'team');
  });
});

describe('categoryVisibleToTeam', () => {
  it('offers standard, club-shared and our own', () => {
    assert.equal(categoryVisibleToTeam(platformCategory, CLUB, TEAM), true);
    assert.equal(categoryVisibleToTeam(sharedCategory, CLUB, TEAM), true);
    assert.equal(categoryVisibleToTeam(ourCategory, CLUB, TEAM), true);
  });

  it('NEVER offers another team’s heading — the leak this column exists to close', () => {
    assert.equal(categoryVisibleToTeam(otherTeamCategory, CLUB, TEAM), false);
  });

  it('never offers another club’s, at any tier', () => {
    assert.equal(categoryVisibleToTeam(otherClubCategory, CLUB, TEAM), false);
  });
});

describe('categoryOfferedToClub', () => {
  it('lets the club plan under standard and its own shared headings', () => {
    assert.equal(categoryOfferedToClub(platformCategory, CLUB), true);
    assert.equal(categoryOfferedToClub(sharedCategory, CLUB), true);
  });

  it('refuses a team’s own heading — the club READS it, and never files against it', () => {
    // Owner ruling Q1: the club sees every team's category on its reports. Seeing is not owning:
    // a club line filed under one would sit on a word the club cannot rename and the team can.
    assert.equal(categoryOfferedToClub(ourCategory, CLUB), false);
    assert.equal(categoryOfferedToClub(otherTeamCategory, CLUB), false);
  });

  it('refuses another club’s', () => {
    assert.equal(categoryOfferedToClub(otherClubCategory, CLUB), false);
  });
});

/**
 * ⚠⚠ SOURCE GUARDS. Every one of these routes was a live leak the day migration 277 landed, and
 * each is a filter somebody could remove during a refactor without a single test going red —
 * because the visible symptom of removing one is a LONGER list, which reads as more data, not less
 * safety. `tests/unit/coach-budget-item-tiers.test.ts` guards the same shape one level down.
 *
 * ⚠ THE STRINGS MATTER MORE THAN THE COUNT. A route that filters items but not the category rows
 * around them passes any "does this file mention the predicate?" check, which is why each entry
 * names the CATEGORY predicate specifically.
 */
const CATEGORY_VISIBILITY_GUARDS: Array<{ file: string; needs: string; why: string }> = [
  {
    file: 'app/api/coaches/[orgSlug]/budget-items/route.ts',
    needs: 'categoryVisibleToTeam',
    why: 'the coach picker: without it, one team’s heading appears in another team’s list',
  },
  {
    file: 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/import/route.ts',
    needs: 'categoryVisibleToTeam',
    why: 'an import matches on WORDS, so a guessable name could file a plan under another team’s heading',
  },
  {
    file: 'app/api/admin/accounting/budget-categories/[catId]/items/route.ts',
    needs: 'categoryOfferedToClub',
    why: 'the club creating a shared item under a team’s private heading would hide it from everyone else',
  },
  {
    file: 'app/api/admin/accounting/budget-plan/lines/route.ts',
    needs: 'resolveOrgBudgetCategory',
    why: 'a club line naming a bare category id, with no item to derive from, went to the database unread',
  },
  {
    file: 'app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts',
    needs: 'resolveOrgBudgetCategory',
    why: 'the PATCH beside it had the same hole',
  },
];

describe('every category-listing route applies an ownership filter', () => {
  for (const { file, needs, why } of CATEGORY_VISIBILITY_GUARDS) {
    it(`${file} → ${needs} (${why})`, () => {
      const src = read(file);
      assert.ok(
        src.includes(needs),
        `${file} no longer calls ${needs}. This is a LEAK, not a lint failure: ${why}.`,
      );
    });
  }
});

describe('the coach create path scopes its uniqueness check', () => {
  it('checks visible categories, not every category in the org', () => {
    const src = read('app/api/coaches/[orgSlug]/budget-items/route.ts');
    /* ⚠ THE FAILURE THIS GUARDS IS A REFUSAL, NOT A LEAK, and it is the one migration 277 creates
       by existing: team B types a name team A invented privately, and is refused a heading it has
       no way to find, open or use. Items hit this exact wall between migs 240 and 248. */
    assert.ok(
      src.includes('listVisibleBudgetCategories'),
      'the coach category create path must check the name against VISIBLE categories only — '
      + 'an org-wide check refuses a coach on the strength of a heading they cannot see.',
    );
  });

  it('writes the owning team on a category a coach creates', () => {
    const src = read('app/api/coaches/[orgSlug]/budget-items/route.ts');
    assert.ok(
      /team_id:\s*catTeamId/.test(src),
      'a category a coach creates must carry its team — without it every heading is silently '
      + 'club-wide again and nobody can be given a rename.',
    );
  });
});

describe('renaming a category', () => {
  it('has a club door and a coach door; delete exists only for a coach, only on an EMPTY heading of their own', () => {
    const club  = read('app/api/admin/accounting/budget-categories/[catId]/route.ts');
    const coach = read('app/api/coaches/[orgSlug]/budget-categories/[catId]/route.ts');

    assert.ok(club.includes('export const PATCH'), 'the club needs a rename door');
    assert.ok(coach.includes('export const PATCH'), 'a coach needs a rename door for their own');

    /* ⚠ DELETE STAYS ABSENT ON THE CLUB SIDE. The data-integrity rule is unchanged: budget_items.category_id
       is ON DELETE CASCADE, so dropping a heading that holds anything takes its items with it and blanks
       the filing on every record filed against them, across every team. */
    assert.ok(!club.includes('export const DELETE'), 'category DELETE must not exist (club side)');

    /* ⚠ THE COACH SIDE GAINED ONE (owner ruling Q3, 2026-09-09) — for a heading of the team's own that
       holds NOTHING, which is the only case the rule above does not reach. What keeps it safe is that
       "nothing" is asked of every table that can name a category, not just the items: seven of them
       point at budget_categories ON DELETE SET NULL, so a naive delete would not fail — it would silently
       blank a filing. The route must count the items AND walk BUDGET_ITEM_REFERENCES before deleting. */
    assert.ok(coach.includes('export const DELETE'), 'the coach door must offer DELETE for an empty own heading (Q3)');
    const del = coach.slice(coach.indexOf('export const DELETE'));
    assert.ok(/from\('budget_items'\)[\s\S]{0,200}count/.test(del), 'DELETE must count the items under the heading first');
    assert.ok(/countBudgetCategoryUsage\(/.test(del), 'DELETE must walk every table that can name a category — through countBudgetCategoryUsage, the item counter\'s twin over BUDGET_ITEM_REFERENCES');
    assert.ok(del.indexOf('countBudgetCategoryUsage(') < del.indexOf('.delete()'), 'the reference walk must come BEFORE the delete');
    assert.ok(/\.delete\(\)[\s\S]{0,120}\.eq\('team_id', teamId\)/.test(del), 'the delete must re-assert the team on the write (check-then-act)');
  });

  it('the club’s door refuses a team’s own heading', () => {
    const club = read('app/api/admin/accounting/budget-categories/[catId]/route.ts');
    assert.ok(
      /existing\.team_id/.test(club),
      'the club can SEE a team’s heading but must never rename one — Q1, 2026-09-04',
    );
    assert.ok(
      club.includes("ctx!.role !== 'owner'") && club.includes("ctx!.role !== 'treasurer'"),
      'shared-category rename is Owner/Treasurer only, matching every other write on this route family',
    );
  });

  it('the coach’s door refuses anything that is not this team’s own', () => {
    const coach = read('app/api/coaches/[orgSlug]/budget-categories/[catId]/route.ts');
    assert.ok(
      /category\.team_id !== teamId/.test(coach),
      'a coach may only rename their own team’s heading',
    );
    assert.ok(
      coach.includes('denyUnlessTeamMoneyWrite'),
      'the acting team is named by the caller and checked, never inferred from the row',
    );
  });
});
