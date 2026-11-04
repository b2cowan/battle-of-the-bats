/**
 * A NEW PLAN JOINS EVERY LIST, OR THE BUILD SAYS WHICH ONE IT MISSED (Plans & pricing Stage 1 Part 2).
 *
 * Adding a plan means adding its key to many lists. The ones typed `Record<OrgPlan, …>` are already held by
 * the type checker (PLAN_CONFIG, PLAN_RANK, PLAN_BILLING_DEFINITIONS, the onboarding gating map). The ones
 * below are not: an `OrgPlan[]` can be short, and a plain string list or `Record<string, …>` can be anything.
 * A missed one fails silently at runtime: a staff picker without the plan, a validator that refuses it, a
 * label that prints the raw key (the account switcher printed "CLUB_LARGE" until this test found it).
 *
 * The check reads each list's SOURCE TEXT rather than importing it, because several live in client
 * components the test runner cannot load, and so nothing had to be exported just to be tested.
 *
 * Every plan in PLAN_CONFIG must appear in every list, or be on that list's `exclusions` with its reason.
 * A partial list (the pricing cards, the plans free time can give) is a decision point: a new plan fails
 * here until someone decides whether it belongs. An exclusion that is no longer true fails too.
 *
 * What a test cannot check offline (database CHECK constraints, the Stripe price slots in each environment,
 * the Facts doc's prose, copy, help, demo) is the human half of the checklist:
 * docs/agents/strategy/PLAN_PRICING_FACTS.md, "Adding a plan: the checklist".
 *
 * Deliberately NOT registered, because whether a plan belongs is a product question with no recorded answer
 * (found 2026-11-03; raise them when a plan is next added rather than encoding a guess here):
 *   the early-access sign-up's PLAN_OPTIONS (league and club only), the upgrade panel's PANEL_PLANS (no
 *   club_large), the pricing strip's GATED_STRIP_LINES, the plan articles, and the dev-tool pickers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_CONFIG } from '../../lib/plan-config';
import type { OrgPlan } from '../../lib/types';

const CHECKLIST = 'docs/agents/strategy/PLAN_PRICING_FACTS.md, "Adding a plan: the checklist"';

interface PlanList {
  file: string;
  identifier: string;
  /** Plans deliberately absent from this list, each with the reason. */
  exclusions?: Partial<Record<OrgPlan, string>>;
}

const PLAN_LISTS: PlanList[] = [
  // Every plan, no exceptions.
  { file: 'lib/plan-module-entitlements.ts', identifier: 'PLAN_ORDER' },
  { file: 'lib/plan-config-db.ts', identifier: 'PLAN_ORDER' },
  { file: 'lib/plan-gating-server.ts', identifier: 'ALL_PLANS' },
  { file: 'lib/billing-retention.ts', identifier: 'PLAN_ORDER' },
  { file: 'lib/plan-ending.ts', identifier: 'MOVE_PLANS' },
  { file: 'lib/platform-metrics.ts', identifier: 'PLAN_ORDER' },
  { file: 'lib/user-contexts.ts', identifier: 'PLAN_LABELS' },
  { file: 'app/[orgSlug]/admin/onboarding/page.tsx', identifier: 'PLAN_ORDER' },
  { file: 'app/[orgSlug]/admin/org/billing/mock-portal/MockPortalClient.tsx', identifier: 'PLANS' },
  { file: 'app/api/platform-admin/product-catalog/campaigns/route.ts', identifier: 'VALID_PLANS' },
  { file: 'app/api/platform-admin/product-catalog/change-requests/route.ts', identifier: 'validPlans' },
  { file: 'app/platform-admin/bulk-operations/BulkOperationsClient.tsx', identifier: 'PLANS' },
  { file: 'app/platform-admin/bulk-operations/BulkOperationsClient.tsx', identifier: 'PLAN_LABELS' },
  { file: 'app/platform-admin/orgs/OrgsClient.tsx', identifier: 'PLANS' },
  { file: 'app/platform-admin/orgs/OrgsClient.tsx', identifier: 'PLAN_LABELS' },
  { file: 'app/platform-admin/plans-pricing/PlansPricingClient.tsx', identifier: 'PLAN_ORDER' },
  { file: 'app/platform-admin/plans-pricing/PlansPricingClient.tsx', identifier: 'PLAN_META' },
  { file: 'app/platform-admin/change-requests/ChangeRequestsClient.tsx', identifier: 'PLAN_LABELS' },

  // Partial on purpose: a new plan must be decided into or out of each.
  {
    file: 'components/PricingSection.tsx',
    identifier: 'RENDERED_PLAN_KEYS',
    exclusions: {
      team: 'its card shows only in the marketing layout (TEAM_PLAN), not in the plan grid',
      club_large: 'a capacity band of Club, shown on the Club card rather than its own',
    },
  },
  {
    file: 'app/platform-admin/plans-pricing/PlansPricingClient.tsx',
    identifier: 'PRICE_PLAN_ORDER',
    exclusions: { tournament: 'free, so it has no Stripe price slot' },
  },
  {
    file: 'lib/free-time.ts',
    identifier: 'GRANTABLE_PLANS',
    exclusions: {
      tournament: 'the free plan; there is nothing to give',
      team: 'not on the grantable list of owner ruling Q2/T13',
      league: 'League Plus is parked (owner ruling Q2/T13)',
    },
  },
  {
    file: 'lib/early-access-admin.ts',
    identifier: 'EARLY_ACCESS_PLAN_LABELS',
    exclusions: {
      tournament: 'always on sale, never early access',
      tournament_plus: 'always on sale, never early access',
    },
  },
  {
    file: 'lib/start-door.ts',
    identifier: 'START_PLANS',
    exclusions: { team: 'a coach signs up through the coach door, not the pricing page pick' },
  },
];

/** The literal assigned to each `identifier = …` in the source (all of them: a route can hold two copies). */
function literalsOf(source: string, identifier: string): string[] {
  const found: string[] = [];
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\b[^=]*=`, 'g');
  for (const match of source.matchAll(declaration)) {
    let i = (match.index ?? 0) + match[0].length;
    while (i < source.length && source[i] !== '[' && source[i] !== '{') i++;
    let literal = '';
    let depth = 0;
    let quote: string | null = null;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        literal += ch;
        if (ch === '\\') literal += source[++i] ?? '';
        else if (ch === quote) quote = null;
        continue;
      }
      // A comment inside the list can hold an apostrophe or a quoted plan name; neither is the list.
      if (ch === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') i++;
        literal += '\n';
        continue;
      }
      literal += ch;
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    found.push(literal);
  }
  return found;
}

/** A plan key as a quoted string or an object key, never as part of a longer key ('tournament' ≠ 'tournament_plus'). */
function holdsPlan(literal: string, plan: string): boolean {
  return new RegExp(`(['"\`])${plan}\\1|(^|[\\s{,])${plan}\\s*:`, 'm').test(literal);
}

/** Every way the registered lists fall short of PLAN_CONFIG, as a sentence naming the plan and the place. */
function checklistProblems(plans: string[], read: (file: string) => string): string[] {
  const problems: string[] = [];
  for (const list of PLAN_LISTS) {
    const literals = literalsOf(read(list.file), list.identifier);
    if (literals.length === 0) {
      problems.push(`${list.identifier} is no longer declared in ${list.file}; update PLAN_LISTS in this test.`);
      continue;
    }
    literals.forEach((literal, n) => {
      const where = `${list.identifier}${literals.length > 1 ? ` (copy ${n + 1} of ${literals.length})` : ''} in ${list.file}`;
      for (const plan of plans) {
        const excluded = list.exclusions?.[plan as OrgPlan];
        const present = holdsPlan(literal, plan);
        if (!present && !excluded) problems.push(`Plan ${plan} is incomplete: not in ${where}.`);
        if (present && excluded) problems.push(`Plan ${plan} is in ${where}, but this test records it as excluded ("${excluded}"). Remove the stale exclusion.`);
      }
    });
    for (const plan of Object.keys(list.exclusions ?? {})) {
      if (!plans.includes(plan)) problems.push(`${list.identifier} in ${list.file} has an exclusion for "${plan}", which is not a plan.`);
    }
  }
  return problems;
}

const sourceCache = new Map<string, string>();
const readSource = (file: string) => {
  if (!sourceCache.has(file)) sourceCache.set(file, readFileSync(join(process.cwd(), file), 'utf8'));
  return sourceCache.get(file)!;
};
const PLANS = Object.keys(PLAN_CONFIG);

describe('a new plan joins every plan list', () => {
  it('every plan is in every registered list, or excluded with a reason', () => {
    const problems = checklistProblems(PLANS, readSource);
    assert.deepEqual(problems, [], `${problems.join('\n')}\nThe rest of a new plan's steps: ${CHECKLIST}.`);
  });

  it('a plan missing from a list fails with a sentence naming the plan and the place', () => {
    const problems = checklistProblems([...PLANS, 'club_mega'], readSource);
    assert.ok(problems.includes('Plan club_mega is incomplete: not in PLAN_ORDER in lib/plan-config-db.ts.'), problems.join('\n'));
    assert.ok(problems.includes('Plan club_mega is incomplete: not in validPlans (copy 2 of 2) in app/api/platform-admin/product-catalog/change-requests/route.ts.'), problems.join('\n'));
    assert.ok(problems.includes('Plan club_mega is incomplete: not in RENDERED_PLAN_KEYS in components/PricingSection.tsx.'), problems.join('\n'));
    assert.equal(problems.length, PLAN_LISTS.length + 1, 'every list (and the second validPlans copy) should name the missing plan once');
  });

  it('ignores a comment inside a list: its apostrophe does not derail the match, its plan name does not count', () => {
    const source = "const PLAN_ORDER: OrgPlan[] = [\n  'tournament', // the club's free plan, not 'club'\n  'league',\n];\nconst OTHER = ['club'];";
    const [literal, ...rest] = literalsOf(source, 'PLAN_ORDER');
    assert.equal(rest.length, 0);
    assert.equal(holdsPlan(literal, 'league'), true);
    assert.equal(holdsPlan(literal, 'club'), false);
  });

  it('tells a plan key from a longer key that contains it', () => {
    assert.equal(holdsPlan("['tournament_plus', 'club_large']", 'tournament'), false);
    assert.equal(holdsPlan("['tournament_plus', 'club_large']", 'club'), false);
    assert.equal(holdsPlan('{\n  club_large: "Club · Association",\n}', 'club'), false);
    assert.equal(holdsPlan('{\n  tournament:      "Tournament",\n}', 'tournament'), true);
    assert.equal(holdsPlan("new Set(['league', 'club'])", 'club'), true);
  });
});
