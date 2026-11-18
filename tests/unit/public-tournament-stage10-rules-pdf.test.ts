import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shapePublicRules } from '../../lib/public-rules-shape.ts';
import { rulesBandLine, rulesHeadingColour, rulesPdfFilename, rulesStampLine } from '../../lib/export/rules-pdf.ts';
import { rulesViewAllUrl } from '../../lib/export/rules-qr.ts';
import { CLUB_NEAR_BLACK } from '../../lib/club-colour-roles.ts';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { Division, Resource, RuleSection } from '../../lib/types.ts';

/**
 * Public tournament pages Stage 10, Part 1: the printable rules. The shape the page and the file share (A1 narrowing, G2's
 * whole-book numbers, A9's labels, a held-back division's section never shown), the file's small words, and the route's
 * refusals — every one the page's path makes, because a route handler runs no layout.
 */
const div = (id: string, name: string, order: number, published = true): Division => ({
  id, tournamentId: 't', name, minAge: null, maxAge: null, order, scheduleVisibility: published ? 'published' : 'draft',
} as Division);
const DIVS = [div('d11', 'U11', 0), div('d13', 'U13', 1), div('d15', 'U15', 2, false)];
const rule = (title: string, divisionIds: string[] | null = null, items = ['A point.']): RuleSection => ({
  id: title, tournamentId: 't', title, icon: 'Shield', order: 0, divisionIds,
  items: items.map((content, n) => ({ id: `${title}${n}`, ruleId: title, content, order: n })),
});
const BOOK = [
  rule('General'),
  rule('Pitching limits', ['d13']),
  rule('U15 tiebreakers', ['d15']),        // held back with U15's schedule
  rule('Weather'),
  rule('Protests', ['d11', 'd13']),
];
const LINKS: Resource[] = [{ id: 'x', tournamentId: 't', label: 'Rulebook', url: 'https://example.org/book', order: 0 }];
const shape = (prefName: string | null, view: string | null = null, rules = BOOK) =>
  shapePublicRules({ rules, resources: LINKS, allDivisions: DIVS, prefName, view });
const numbered = (s: ReturnType<typeof shape>) => s.sections.map(x => `${x.number} ${x.title}`);

describe('Stage 10: the shape the Rules page and its file share', () => {
  it('the whole book: a held-back division’s section is not in it, and the numbers run over what is (G2)', () => {
    const s = shape(null);
    assert.deepEqual(numbered(s), ['1 General', '2 Pitching limits', '3 Weather', '4 Protests']);
    assert.equal(s.narrowedTo, null);
    assert.deepEqual(s.divisions.map(d => d.name), ['U11', 'U13'], 'the picker names published divisions only');
  });
  it('narrowed to U11: untagged sections plus U11’s, keeping the whole-book numbers (a gap is allowed)', () => {
    const s = shape('U11');
    assert.deepEqual(numbered(s), ['1 General', '3 Weather', '4 Protests']);
    assert.deepEqual(s.narrowedTo, { id: 'd11', name: 'U11' });
  });
  it('View all overrides the saved division (A1)', () => {
    assert.deepEqual(numbered(shape('U11', 'all')), numbered(shape(null)));
    assert.equal(shape('U11', 'all').narrowedTo, null);
  });
  it('a saved division that is held back, unknown, or a book with no tagged section does not narrow', () => {
    assert.equal(shape('U15').narrowedTo, null);
    assert.equal(shape('U7').narrowedTo, null);
    assert.equal(shapePublicRules({ rules: [rule('A'), rule('B')], resources: [], allDivisions: DIVS, prefName: 'U11' }).narrowedTo, null);
  });
  it('A9: a division-kept section carries its names in the organizer’s division order; an untagged one carries none', () => {
    const s = shape(null);
    assert.deepEqual(s.sections.map(x => x.divisionLabel), [null, 'U13 only', null, 'U11, U13 only']);
    const reversed = shapePublicRules({ rules: [rule('P', ['d13', 'd11'])], resources: [], allDivisions: DIVS, prefName: null });
    assert.equal(reversed.sections[0].divisionLabel, 'U11, U13 only');
  });
  it('a stale tag (a deleted division) names nothing, and the section stays where the page put it', () => {
    const s = shapePublicRules({ rules: [rule('Old', ['gone']), rule('New')], resources: [], allDivisions: DIVS, prefName: null });
    assert.deepEqual(s.sections.map(x => [x.title, x.divisionLabel]), [['Old', null], ['New', null]]);
  });
  it('a U13-only section in the middle of a narrowed U13 copy keeps its place and number', () => {
    assert.deepEqual(numbered(shape('U13')), ['1 General', '2 Pitching limits', '3 Weather', '4 Protests']);
  });
  it('anchors are the page’s old title anchors, a repeated title disambiguated without moving the first', () => {
    const s = shapePublicRules({ rules: [rule('Game length'), rule('Game length')], resources: [], allDivisions: DIVS, prefName: null });
    assert.deepEqual(s.sections.map(x => x.anchor), ['rule-game-length', 'rule-game-length-2']);
  });
  it('downloads are never narrowed (A7), and points keep the organizer’s text', () => {
    assert.deepEqual(shape('U11').resources, [{ label: 'Rulebook', url: 'https://example.org/book' }]);
    const s = shapePublicRules({ rules: [rule('R', null, ['One\nTwo', 'Three'])], resources: [], allDivisions: DIVS, prefName: null });
    assert.deepEqual(s.sections[0].items, ['One\nTwo', 'Three']);
  });
});

describe('Stage 10: the file’s words', () => {
  it('A5: headings wear the colour at 4.5 : 1 on white, else ink; a malformed colour is ink', () => {
    assert.equal(rulesHeadingColour('#1E3A8A'), '#1E3A8A');
    assert.equal(rulesHeadingColour('#F2C230'), CLUB_NEAR_BLACK);
    assert.equal(rulesHeadingColour('red'), CLUB_NEAR_BLACK);
  });
  it('the band line names the dates and the host, and the division when narrowed', () => {
    assert.equal(rulesBandLine({ dates: 'Nov 21–23, 2026', hostedBy: 'Riverdale Minor Ball', narrowedTo: null }),
      'Tournament rules · Nov 21–23, 2026 · Hosted by Riverdale Minor Ball');
    assert.equal(rulesBandLine({ dates: 'Nov 21–23, 2026', hostedBy: null, narrowedTo: 'U11' }), 'U11 rules · Nov 21–23, 2026');
    assert.equal(rulesBandLine({ dates: null, hostedBy: null, narrowedTo: null }), 'Tournament rules');
  });
  it('A3: the stamp is the org clock in the house spelling', () => {
    assert.equal(rulesStampLine('2026-11-18T20:12:00Z'), 'Rules as of Wed, Nov 18, 2026, 3:12 p.m.');
  });
  it('the file is named after the event, without characters a file name cannot hold', () => {
    assert.equal(rulesPdfFilename('Fall Classic 2026'), 'Fall Classic 2026 rules.pdf');
    assert.equal(rulesPdfFilename('U13/U15 "Cup"'), 'U13 U15 Cup rules.pdf');
  });
  it('A4: the code opens the Rules page on every division', () => {
    assert.equal(rulesViewAllUrl('https://club.example/cup/rules'), 'https://club.example/cup/rules?view=all');
  });
});

// ── The route: the real handler, with only the database, the request host and the forward replaced. ──
type Tournament = { id: string; name: string; status: string; publicHiddenPages?: string[]; startDate: string | null; endDate: string | null };
function harness(o: { org?: Record<string, unknown> | null; tournament?: Tournament | null; rules?: RuleSection[]; cookie?: string } = {}) {
  const org = o.org === undefined ? { id: 'org', name: 'Riverdale Minor Ball', slug: 'club', planId: 'tournament', subscriptionStatus: 'active' } : o.org;
  const tournament = o.tournament === undefined
    ? { id: 't', name: 'Fall Classic 2026', status: 'active', startDate: '2026-11-21', endDate: '2026-11-23' } : o.tournament;
  const load = billingTestLoader({
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/club-forward': { forwardToOwnAddress: async () => {} },
    '@/lib/db': {
      getOrganizationBySlug: async () => org,
      getPublicTournamentBySlug: async () => tournament,
      getRules: async () => o.rules ?? BOOK,
      getResources: async () => LINKS,
      getDivisions: async () => DIVS,
    },
    'next/headers': { cookies: async () => ({ get: (n: string) => (n === 'fl_agpref_club' && o.cookie ? { value: o.cookie } : undefined) }) },
    '@/lib/module-entitlements': { resolveOrgHomeHref: async () => null },
    '@/lib/org-links': { orgLinks: async () => (path: string) => `/club${path}` },
    '@/lib/request-host': { requestHost: async () => 'www.fieldlogichq.ca' },
    '@/lib/export/resolve-pdf-settings': { deriveLogoDataUrl: async () => null },
  });
  const { GET } = load('app/[orgSlug]/[tournamentSlug]/rules/pdf/route.ts') as {
    GET: (req: Request, ctx: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) => Promise<Response> };
  return (query = '', ip = `10.0.0.${Math.floor(Math.random() * 250)}`) => GET(
    new Request(`https://www.fieldlogichq.ca/club/cup/rules/pdf${query}`, { headers: { 'x-forwarded-for': ip } }),
    { params: Promise.resolve({ orgSlug: 'club', tournamentSlug: 'cup' }) });
}

describe('Stage 10: the route answers only where the page would', () => {
  it('serves a PDF inline, unindexed and never cached, named after the event', async () => {
    const res = await harness()();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition') ?? '', /^inline; filename="Fall Classic 2026 rules\.pdf"/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  });
  for (const [name, setup] of [
    ['no such organization', { org: null }],
    ['a cancelled organization (the tournament layout’s refusal)', { org: { id: 'org', name: 'X', slug: 'club', planId: 'tournament', subscriptionStatus: 'canceled' } }],
    ['a tournament that is not published (getPublicTournamentBySlug says no)', { tournament: null }],
    ['the Rules page switched off', { tournament: { id: 't', name: 'Cup', status: 'active', startDate: null, endDate: null, publicHiddenPages: ['rules'] } }],
    ['no rule sections at all', { rules: [] }],
    ['only a held-back division’s section', { rules: [rule('U15 only', ['d15'])] }],
  ] as const) {
    it(`404 for ${name}`, async () => {
      const res = await harness(setup as Parameters<typeof harness>[0])();
      assert.equal(res.status, 404);
      assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    });
  }
  it('a narrowed copy with nothing for that division is refused like an empty page', async () => {
    const res = await harness({ rules: [rule('Pitching limits', ['d13'])], cookie: 'U11' })();
    assert.equal(res.status, 404);
    assert.equal((await harness({ rules: [rule('Pitching limits', ['d13'])], cookie: 'U11' })('?view=all')).status, 200);
  });
  it('a visitor past the limit is told to wait, not served', async () => {
    const get = harness();
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await get('', '10.9.9.9')).status;
    assert.equal(last, 429);
  });
});
