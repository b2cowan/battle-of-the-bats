import './_sponsorships-open-for-test.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_DEFAULTS, ALL_CAPABILITY_KEYS } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { MODULE_CATALOG } from '../../lib/plan-module-entitlements.ts';
import { MEMBER_PROGRAMS, whatTheyCanOpen } from '../../lib/member-access.ts';
import { changesInvoiceDetails, opensSponsorships } from '../../lib/club-sponsorships-place.ts';
import {
  formatGstNumber, homePlacesShowing, homeStrip, isGstNumber, lastDayOf, normalizeGstNumber, packageFull, parsePackageInput,
  parsePrice, parseSettingsPatch, parseSponsorInput, placeShowing, EMPTY_SETTINGS, HOME_STRIP_MAX, SPONSOR_LIST_MAX,
  type ClubSponsor,
} from '../../lib/club-sponsorships.ts';
import { BUSINESS_FORM_SHAPE, readQuestionInput, SEASON_FORM_SHAPE, formShape } from '../../lib/club-form.ts';
import { SPONSORSHIPS_WORDS as W } from '../../lib/club-sponsorships-words.ts';
import { sponsorshipsTabs } from '../../lib/admin-kit-nav.ts';
import type { OrgRole } from '../../lib/types.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6, PART 1 — THE CLUB'S SPONSORSHIPS PLACE (owner rulings 2026-11-22, plan BOARD_READY_PLAN.md §5).
 * Who opens it (ask 12 + note; round 2 ask 4), the one sponsor list (asks 1, 5, 11), packages (asks 6, 7), Invoice details
 * (ask 9), the sponsorship form's shape (ask 8), and the gate every route asks.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const org = (planId: string, extra: Partial<EntitlementOrg> = {}) =>
  ({ planId, subscriptionStatus: 'active', enabledAddons: [], ...extra }) as unknown as EntitlementOrg;
const CLUB = org('club');
const member = (role: OrgRole, capabilities: Record<string, boolean> | null = null, limited = false) => ({ role, capabilities, limited });

describe('who opens Sponsorships (ask 12 + note; round 2 tab 3)', () => {
  it('is a real per-member access, on by default for owner, admin and treasurer only', () => {
    assert.ok(ALL_CAPABILITY_KEYS.includes('module_sponsorships'));
    // The owner passes every check regardless of its defaults; the other two seats hold it, nobody else does.
    for (const [role, caps] of Object.entries(ROLE_DEFAULTS)) {
      if (role === 'owner') continue;
      assert.equal(caps.has('module_sponsorships'), role === 'admin' || role === 'treasurer', role);
    }
    for (const role of ['owner', 'admin', 'treasurer'] as const) assert.ok(opensSponsorships(member(role), CLUB), role);
    for (const role of ['league_admin', 'league_registrar', 'staff', 'official', 'coach'] as const) assert.ok(!opensSponsorships(member(role), CLUB), role);
  });
  it('a club can turn it on for anyone, e.g. a registrar, and off for an admin', () => {
    assert.ok(opensSponsorships(member('league_registrar', { module_sponsorships: true }), CLUB));
    assert.ok(!opensSponsorships(member('admin', { module_sponsorships: false }), CLUB));
  });
  it('rides League Plus and both Club bands, never a tournament plan or a team workspace', () => {
    for (const p of ['league', 'club', 'club_large'] as const) assert.ok(PLAN_CONFIG[p].moduleEntitlements.includes('module_sponsorships'), p);
    for (const p of ['tournament', 'tournament_plus', 'team'] as const) assert.ok(!PLAN_CONFIG[p].moduleEntitlements.includes('module_sponsorships'), p);
    assert.ok(!opensSponsorships(member('owner'), org('tournament_plus')));
    assert.ok(MODULE_CATALOG.some(m => m.key === 'module_sponsorships'));
  });
  it('a member limited to some rep team groups never opens it (every sponsor and deal is club-wide)', () => {
    assert.ok(!opensSponsorships(member('admin', null, true), CLUB));
  });
  it('Invoice details are changed by owner, admins and the treasurer only (round 2 ask 4)', () => {
    assert.ok(changesInvoiceDetails(member('treasurer'), CLUB));
    assert.ok(!changesInvoiceDetails(member('league_registrar', { module_sponsorships: true }), CLUB), 'a registrar given Sponsorships reads them');
  });
  it('Manage member lists Sponsorships after Accounting, only on a plan that carries it', () => {
    const i = MEMBER_PROGRAMS.findIndex(p => p.module === 'module_sponsorships');
    assert.equal(MEMBER_PROGRAMS[i - 1]?.module, 'module_accounting');
    assert.ok(whatTheyCanOpen({ role: 'league_registrar', capabilities: null }, CLUB).some(r => r.module === 'module_sponsorships' && !r.roleDefault));
    assert.ok(!whatTheyCanOpen({ role: 'admin', capabilities: null }, org('tournament_plus')).some(r => r.module === 'module_sponsorships'));
  });
  it('the place has four tabs, Deals · Packages · Sponsors · Setup', () => {
    assert.deepEqual(sponsorshipsTabs('/c/admin').map(t => t.label), ['Deals', 'Packages', 'Sponsors', 'Setup']);
  });
});

describe('the gate every route asks', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('route.ts') ? [p.replace(/\\/g, '/')] : [];
  });
  const routes = walk('app/api/admin/sponsorships');
  it('every handler asks requireSponsorships first', () => {
    assert.ok(routes.length >= 12, `${routes.length} routes`);
    for (const r of routes) {
      const src = readCode(r);
      const handlers = src.match(/export const (GET|POST|PATCH|DELETE) = withObservability/g) ?? [];
      const gates = src.match(/requireSponsorships\(req/g) ?? [];
      assert.ok(handlers.length > 0, r);
      // A shared lookup (the package document route's `packageOf`) asks once for every handler that calls it.
      assert.ok(gates.length >= 1 && (gates.length >= handlers.length || /async function packageOf/.test(src)), r);
    }
  });
  it('Invoice details save only for the three seats (`invoice: true`)', () => {
    assert.match(readCode('app/api/admin/sponsorships/settings/route.ts'), /requireSponsorships\(req, \{ invoice: true \}\)/);
  });
  it('the place\'s layout asks the same pure answer before any tab mounts', () => {
    assert.match(readCode('app/[orgSlug]/admin/sponsorships/layout.tsx'), /opensSponsorships\(/);
  });
});

describe('the one sponsor list (asks 1, 5, 11)', () => {
  const sp = (id: string, position: number, places: ClubSponsor['places']): ClubSponsor => ({ id, name: id, logoUrl: null, link: null, position, places });
  const club = (endsOn: string | null) => ({ id: `p${Math.random()}`, kind: 'club' as const, targetId: null, endsOn, source: 'typed' as const, dealId: null });
  it('a last day is inclusive, in the club\'s day', () => {
    assert.ok(placeShowing({ endsOn: '2027-03-31' }, '2027-03-31'));
    assert.ok(!placeShowing({ endsOn: '2027-03-31' }, '2027-04-01'));
    assert.ok(placeShowing({ endsOn: null }, '2099-01-01'));
  });
  it('the home strip is the club places showing, in order, at most 20; the list holds 100', () => {
    const list = Array.from({ length: 25 }, (_, i) => sp(`s${i}`, 25 - i, [club(null)]));
    assert.equal(homeStrip(list, '2027-01-01').length, HOME_STRIP_MAX);
    assert.equal(homeStrip(list, '2027-01-01')[0].id, 's24', 'by position');
    assert.equal(homePlacesShowing([sp('a', 1, [club('2026-01-01')]), sp('b', 2, [club(null)])], '2027-01-01'), 1);
    assert.equal(SPONSOR_LIST_MAX, 100);
    assert.match(readFileSync('supabase/migrations/525_a_club_keeps_its_sponsors_and_sells_packages.sql', 'utf8'), />= 100 THEN/);
  });
  it('a sponsor\'s caption names its latest last day, or none when one place has no last day', () => {
    assert.equal(lastDayOf({ places: [club('2027-05-31'), club('2027-08-31')] }), '2027-08-31');
    assert.equal(lastDayOf({ places: [club('2027-05-31'), club(null)] }), null);
  });
  it('a typed sponsor shows on the club by default; a division or team needs which one; never twice in one spot', () => {
    const ok = parseSponsorInput({ name: 'Miller Foods', places: [{ kind: 'club', endsOn: '2027-12-31' }] });
    assert.ok(ok.ok && ok.value.places[0].kind === 'club' && ok.value.places[0].targetId === null);
    assert.deepEqual(parseSponsorInput({ name: 'X', places: [{ kind: 'division' }] }), { ok: false, error: W.sponsor.errTarget });
    assert.deepEqual(parseSponsorInput({ name: 'X', places: [{ kind: 'club' }, { kind: 'club' }] }), { ok: false, error: W.sponsor.errTwice });
    assert.deepEqual(parseSponsorInput({ name: ' ' }), { ok: false, error: W.sponsor.errName });
  });
});

describe('packages (asks 6, 7; Full grey, round 2 ask 5)', () => {
  it('a price is money, before tax', () => {
    assert.equal(parsePrice('$1,000.00'), 1000);
    assert.equal(parsePrice('2500'), 2500);
    assert.equal(parsePrice('12.345'), null);
    assert.equal(parsePrice('abc'), null);
  });
  it('a package names its kind of place; How many may be empty for no limit', () => {
    const p = parsePackageInput({ name: 'Division sponsor', price: '1,000.00', placeKind: 'division', howMany: '4', items: [{ text: 'A field banner at Riverdale Park' }] });
    assert.ok(p.ok && p.value.howMany === 4 && p.value.logoOnSite && p.value.items.length === 1);
    const open = parsePackageInput({ name: 'Club partner', price: 2500, placeKind: 'club', howMany: '' });
    assert.ok(open.ok && open.value.howMany === null);
    assert.equal(parsePackageInput({ name: 'X', price: 1, placeKind: 'division', howMany: '0' }).ok, false);
  });
  it('Full = every place paid, invoiced or offered; no limit is never full', () => {
    assert.ok(packageFull({ howMany: 2 }, { paid: 1, invoiced: 0, offered: 1 }), 'an open offer holds its place');
    assert.ok(!packageFull({ howMany: 2 }, { paid: 1, invoiced: 0, offered: 0 }));
    assert.ok(!packageFull({ howMany: null }, { paid: 9, invoiced: 9, offered: 9 }));
  });
  it('"Full" is the kit\'s neutral chip, never the amber one', () => {
    const screen = readCode('components/admin/kit/club/sponsorships/PackagesScreen.tsx');
    assert.match(screen, /<span className=\{ck\.chip\}>\{W\.packages\.full\}<\/span>/);
    assert.doesNotMatch(screen, /chipWarn/);
  });
});

describe('Invoice details (ask 9)', () => {
  it('the GST/HST number is checked for its form and stored without spaces', () => {
    assert.ok(isGstNumber('81234 5678 RT0001'));
    assert.equal(normalizeGstNumber('81234 5678 rt0001'), '812345678RT0001');
    assert.equal(formatGstNumber('812345678RT0001'), '81234 5678 RT0001');
    assert.ok(!isGstNumber('12345 RT0001'));
  });
  it('registered needs a number; off by default', () => {
    assert.equal(EMPTY_SETTINGS.registered, false);
    assert.deepEqual(parseSettingsPatch({ registered: true }, EMPTY_SETTINGS), { ok: false, error: W.invoice.errNumberNeeded });
    const r = parseSettingsPatch({ registered: true, gstHstNumber: '81234 5678 RT0001' }, EMPTY_SETTINGS);
    assert.ok(r.ok && r.value.registered && r.value.gstHstNumber === '812345678RT0001');
  });
  it('the mailing address is the club\'s one column (mig 454), changed here for every club', () => {
    const r = parseSettingsPatch({ mailingAddress: '200 Park Road, Riverdale ON K0A 1B0' }, EMPTY_SETTINGS);
    assert.ok(r.ok && r.value.mailingAddress === '200 Park Road, Riverdale ON K0A 1B0');
    assert.match(readCode('lib/club-sponsorships-server.ts'), /upsertOrgPublicSiteContent\(orgId, \{ mailingAddress: next\.mailingAddress \}\)/);
  });
});

describe('the sponsorship form (ask 8)', () => {
  it('a business form has no Asked, no Health switch and no draft board', () => {
    assert.deepEqual(formShape('business'), BUSINESS_FORM_SHAPE);
    assert.deepEqual(formShape('child_signup'), SEASON_FORM_SHAPE);
    const r = readQuestionInput({ label: 'Banner size you’ll supply', type: 'short_answer', asked: 'per_subject', health: true, onBoard: true }, null, () => 'x', BUSINESS_FORM_SHAPE);
    assert.ok('write' in r);
    assert.equal(r.write.asked, 'once');
    assert.equal(r.write.health, false);
    assert.equal(r.write.on_board, false);
  });
  it('the club owns exactly one, and a season\'s form stays a child sign-up', () => {
    const sql = readFileSync('supabase/migrations/525_a_club_keeps_its_sponsors_and_sells_packages.sql', 'utf8');
    assert.match(sql, /owner_table IN \('league_seasons', 'organizations'\)/);
    assert.match(sql, /owner_table = 'organizations' AND subject_kind = 'business' AND owner_id = org_id/);
  });
});

describe('the words (§9, ask 15, round 2 ask 6)', () => {
  const all = JSON.stringify(W);
  it('never "donation", "gift", "tax receipt", nor "advertising" for a placement', () => {
    for (const w of [/donation/i, /\bgift/i, /tax receipt/i, /advertising/i]) assert.doesNotMatch(all, w);
  });
  it('"e-transfer" in a sentence, "E-transfer" at the start; never "E-Transfer" or "e-Transfer"', () => {
    assert.doesNotMatch(all, /E-Transfer|e-Transfer/);
    assert.equal(W.invoice.etransfer, 'By e-transfer to');
  });
  it('the Payouts sponsorship row\'s words, verbatim (round 2 tab 1)', () => {
    assert.equal(W.payouts.sponsorshipsLabel, 'Processing fee on sponsorships');
    assert.equal(W.payouts.registrationsLabel, 'Processing fee on registrations');
    assert.match(W.payouts.clubPaysHint, /This is the default\.$/);
  });
});

describe('the migration keeps every table off the browser', () => {
  const sql = readFileSync('supabase/migrations/525_a_club_keeps_its_sponsors_and_sells_packages.sql', 'utf8');
  for (const t of ['club_sponsors', 'club_sponsor_places', 'club_sponsorship_packages', 'club_sponsorship_settings']) {
    it(t, () => {
      assert.match(sql, new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`public\\.${t}`));
    });
  }
  it('anon and authenticated get nothing; the service role is granted explicitly', () => {
    assert.match(sql, /FROM anon, authenticated;/);
    assert.match(sql, /TO service_role;/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
  });
});
