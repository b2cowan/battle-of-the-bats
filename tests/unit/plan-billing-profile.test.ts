import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_ARTICLE_CONTENT } from '../../lib/plan-article-content.ts';
import {
  PLAN_BILLING_PROFILES, PLAN_BILLING_DEFINITIONS, createPlanBillingRegistry,
  planCancellationImpact, type PlanBillingDefinition,
} from '../../lib/plan-billing-profile.ts';
import { moveDirection } from '../../lib/plan-move-options.ts';
import { upgradePlansFor } from '../../lib/plan-upgrade.ts';
import {
  BILLING_RETENTION_DAYS, COACHES_PORTAL_RETENTION_DAYS, organizationShutdownAreas,
} from '../../lib/billing-cancellation-policy.ts';
import { readCode } from './_source-code.ts';

describe('Plan & billing profiles', () => {
  it('covers every OrgPlan and holds config references, not copied prices/names/caps', () => {
    assert.deepEqual(Object.keys(PLAN_BILLING_PROFILES).sort(), Object.keys(PLAN_CONFIG).sort());
    for (const key of Object.keys(PLAN_CONFIG) as (keyof typeof PLAN_CONFIG)[]) {
      const profile = PLAN_BILLING_PROFILES[key];
      assert.strictEqual(profile.config, PLAN_CONFIG[key]);
      assert.ok(profile.included.billing.length > 0 && profile.included.article.length > 0);
      assert.ok(!('onSale' in profile), 'availability belongs to the live gate');
    }
  });

  it('requires BOTH nonempty display variants, including for a future plan', () => {
    const config = { future: { ...PLAN_CONFIG.team } };
    const valid: PlanBillingDefinition<'future'> = {
      ...PLAN_BILLING_DEFINITIONS.team, changes: [], discoveryPlans: undefined, included: { billing: ['Billing feature'], article: ['Article feature'] },
    };
    for (const variant of ['billing', 'article'] as const) {
      const missing = { ...valid, included: { ...valid.included, [variant]: undefined } } as unknown as PlanBillingDefinition<'future'>;
      assert.throws(() => createPlanBillingRegistry(config, { future: missing }), /both included-item variants/);
      assert.throws(() => createPlanBillingRegistry(config, { future: { ...valid, included: { ...valid.included, [variant]: [] } } }), /both included-item variants/);
    }
    assert.throws(() => createPlanBillingRegistry(config, {} as Record<'future', PlanBillingDefinition<'future'>>), /both included-item variants/);
  });

  it('accepts an extra plan through data only and follows its own config', () => {
    const config = { ...PLAN_CONFIG, future_plan: { ...PLAN_CONFIG.team, label: 'Future fixture', monthlyPrice: 123, annualPrice: 1230, teamLimit: 42 } };
    const definitions: Record<keyof typeof config, PlanBillingDefinition<keyof typeof config>> = {
      ...PLAN_BILLING_DEFINITIONS,
      future_plan: {
        ...PLAN_BILLING_DEFINITIONS.team, changes: [], usageMeters: ['teams'],
        included: { billing: ['Future billing fixture'], article: ['Future article fixture'] },
      },
    };
    const registry = createPlanBillingRegistry(config, definitions);
    assert.equal(registry.future_plan.key, 'future_plan');
    assert.equal(registry.future_plan.config.label, 'Future fixture');
    assert.equal(registry.future_plan.config.monthlyPrice, 123);
    assert.equal(registry.future_plan.config.annualPrice, 1230);
    assert.equal(registry.future_plan.config.teamLimit, 42);
    assert.deepEqual(registry.future_plan.usageMeters, ['teams']);
    assert.deepEqual(registry.future_plan.included, definitions.future_plan.included);
    config.future_plan.monthlyPrice = 456;
    config.future_plan.label = 'Updated fixture';
    assert.equal(registry.future_plan.config.monthlyPrice, 456);
    assert.equal(registry.future_plan.config.label, 'Updated fixture');
    assert.notEqual(PLAN_CONFIG.team.monthlyPrice, 456, 'fixture never mutates production config');
  });

  it('describes only the existing upgrade, move and downgrade mechanisms', () => {
    const actual = Object.values(PLAN_BILLING_PROFILES).flatMap(p => p.changes.map(c => `${p.key}:${c.mechanism}:${c.target}`)).sort();
    assert.deepEqual(actual, [
      'tournament:checkout:tournament_plus',
      'tournament_plus:downgrade:tournament',
      'tournament_plus:move:club', 'tournament_plus:move:club_large',
      'club:move:club_large', 'club_large:move:club',
    ].sort());
    for (const p of Object.values(PLAN_BILLING_PROFILES)) {
      for (const c of p.changes) {
        if (c.mechanism === 'move') assert.ok(moveDirection(p.key, c.target));
        if (c.mechanism === 'checkout') assert.ok(upgradePlansFor(p.key).includes(c.target as 'tournament_plus'));
      }
    }
    assert.deepEqual(PLAN_BILLING_PROFILES.team.changes, [], 'joining a club is not a new plan move');
  });

  it('keeps the Premium seven, the downgrade losses, the Club team meters and the Founding Season display flag', () => {
    assert.deepEqual(PLAN_BILLING_PROFILES.team.included.billing, PLAN_ARTICLE_CONTENT.team.features.slice(0, 7), 'D1: seven drawn billing items');
    assert.equal(PLAN_BILLING_PROFILES.tournament_plus.downgradeLosses?.length, 8, 'D23: detailed feature-loss list');
    for (const p of Object.values(PLAN_BILLING_PROFILES)) {
      const club = p.key === 'club' || p.key === 'club_large';
      assert.deepEqual(p.usageMeters, club ? ['teams'] : ['tournament_slots', 'staff_seats']);
      assert.equal(p.showFoundingSeason, !club, 'display of existing comps, never a comp grant');
    }
  });
});

describe('published article preservation — owner baseline 2026-10-28', () => {
  it('preserves Explore’s seven descriptions and order in its own registry variant', () => {
    assert.deepEqual(PLAN_BILLING_PROFILES.team.included.explore, [
      'Game lineups', 'Attendance tracking', 'Assistant coaches with their own sign-in',
      'Team documents', 'Dues schedules & automatic reminders', 'A season budget',
      'Carry your roster into next season',
    ]);
  });
  const baseline = {
    team: [8, '1b4299dfd7c357ddda00976eda1b1fc1eaa0585cad1e9f2e887aab754c386133'],
    tournament_plus: [11, 'c5c3224090d8b2b2a794cbffe1ce06d5e67e0c28c6a45419d65be6d392b794d1'],
    league: [12, '7bc70028124f074200bb2bd6494df2a19b99d1737702814a1b4035c8f70b9ce2'],
    club: [10, '61f13d4eaf3215fa04e60f142a2c82736fc2e152ba1ed8678542512a4d8eb97a'],
  } as const;
  it('keeps the published article keys, and every feature string/order byte for byte', () => {
    assert.deepEqual(Object.keys(PLAN_ARTICLE_CONTENT).sort(), Object.keys(baseline).sort());
    for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) {
      const features = PLAN_ARTICLE_CONTENT[key].features;
      assert.strictEqual(features, PLAN_BILLING_PROFILES[key].included.article);
      assert.equal(features.length, baseline[key][0], key);
      assert.equal(createHash('sha256').update(JSON.stringify(features), 'utf8').digest('hex'), baseline[key][1], key);
    }
  });
  it('every admin plan delegates to the shared body and its registry-owned lists', () => {
    assert.match(readCode('app/[orgSlug]/admin/org/billing/page.tsx'), /return <BillingKit \/>/);
    assert.match(readCode('components/billing/BillingBody.tsx'), /profile\.included\.billing\.filter/);
    assert.match(readCode('components/admin/kit/club/BillingKit.tsx'), /<BillingBody billingBase=/);
    for (const f of ['app/[orgSlug]/admin/org/billing/page.tsx', 'components/billing/BillingBody.tsx']) {
      assert.doesNotMatch(readCode(f), /const (?:PLAN_FEATURES|CLUB_INCLUDES)\s*=/);
    }
  });
});

describe('one cancellation projection, no server imports in the registry', () => {
  it('includes add-ons even on a plan without those modules, in the existing server order', () => {
    const profile = PLAN_BILLING_PROFILES.tournament;
    const ordinary = planCancellationImpact(profile);
    assert.equal(ordinary.retentionDays, BILLING_RETENTION_DAYS);
    assert.equal(ordinary.shutsDown.length, 3);
    const augmented = planCancellationImpact(profile, ['module_families', 'module_public_site', 'unrelated']);
    assert.deepEqual(augmented.shutsDown.slice(3), [
      'Public organization site', 'The Families area — household records, the family worklist, and duplicate review',
    ]);
    assert.deepEqual(augmented.shutsDown, organizationShutdownAreas(PLAN_CONFIG.tournament, ['module_families', 'module_public_site', 'unrelated']));
    assert.equal(planCancellationImpact(PLAN_BILLING_PROFILES.team).retentionDays, COACHES_PORTAL_RETENTION_DAYS);
    assert.equal(planCancellationImpact(PLAN_BILLING_PROFILES.team, ['module_families']).shutsDown.length, 3);
    assert.deepEqual(planCancellationImpact(PLAN_BILLING_PROFILES.club, [], 9).shortShutsDown, [
      'Rep teams and every team’s coach portal (9 teams)', 'Accounting', 'Families', 'the public site', 'house league', 'tournaments',
    ]);
  });
  it('server preflight shares the data and the retention policy, and keeps the owned-plan read', () => {
    const src = readCode('lib/billing-retention.ts');
    assert.match(src, /shutsDown: organizationShutdownAreas\(PLAN_CONFIG\[ownPlanOf\(org\)\], org\.enabledAddons\)/);
    assert.match(src, /shutsDown: \[\.\.\.PREMIUM_COACH_SHUTDOWN_AREAS\]/);
    assert.match(src, /from '\.\/billing-cancellation-policy'/);
    assert.match(readCode('lib/plan-move.ts'), /from '\.\/plan-move-options'/);
    for (const path of ['lib/plan-billing-profile.ts', 'lib/billing-cancellation-policy.ts', 'lib/plan-move-options.ts']) {
      assert.doesNotMatch(readCode(path), /from ['"][^'"]*(?:supabase|plan-move['"]|billing-retention['"]|stripe|email)|import ['"]server-only/);
    }
  });
});
