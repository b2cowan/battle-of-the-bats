// Board Ready trust close-out 4 (owner 2026-11-18): the club's billing facts reach the owner's and admins' browsers only.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { orgForBrowser } from '../../lib/org-for-browser.ts';
import type { Organization } from '../../lib/types';

const org = {
  id: 'o', name: 'Club', slug: 'club', planId: 'club',
  stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', currentPeriodEnd: '2027-01-01T00:00:00Z',
  subscriptionPeriod: 'annual', subscriptionAmountCents: 120000, subscriptionCurrency: 'cad', repTeamSubscriptionItemId: 'si_1',
  contactEmail: 'club@example.com',
} as unknown as Organization;

const FACTS = ['stripeCustomerId', 'stripeSubscriptionId', 'currentPeriodEnd', 'subscriptionPeriod', 'subscriptionAmountCents', 'subscriptionCurrency', 'repTeamSubscriptionItemId'] as const;

describe('orgForBrowser', () => {
  test('the owner and admins get the record whole', () => {
    for (const role of ['owner', 'admin']) assert.deepEqual(orgForBrowser(org, role), org);
  });
  test('every other seat, and no seat, gets the billing facts blank and the rest intact', () => {
    for (const role of ['staff', 'official', 'league_admin', 'league_registrar', 'treasurer', 'coach', null, undefined]) {
      const out = orgForBrowser(org, role) as unknown as Record<string, unknown>;
      for (const f of FACTS) assert.ok(out[f] == null, `${String(role)}: ${f} is blank`);
      assert.equal(out.planId, 'club');
      assert.equal(out.contactEmail, 'club@example.com');
    }
  });
});

describe('guard — the record crosses into the browser only through orgForBrowser', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk('app');
  test('no layout or page seeds initialOrg with the raw record', () => {
    const bad = files.filter(f => /initialOrg=\{\s*(?!orgForBrowser\()/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(bad, []);
  });
  test('the org-context route sends the record through it', () => {
    const src = readFileSync('app/api/org-context/route.ts', 'utf8');
    assert.match(src, /org:\s*orgForBrowser\(ctx\.org,\s*ctx\.role\)/);
  });
});
