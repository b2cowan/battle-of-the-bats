/**
 * THE PUBLIC FEED SENDS ONLY WHAT THE PAGES SHOW (Stage 8 §16, owner-approved 2026-11-04).
 *
 * `/api/public/tournament-data` is anonymous and takes query params, so whatever `getPublicTournamentPageData` returns
 * is readable by anyone. These tests run the REAL feed against a fake database holding things that must never leave the
 * server, and read the JSON each section produces. The route's own section list is read from its source, so a section
 * added to the route without passing through the public shape is exercised here without anyone remembering to.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader as componentLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import { publicDivision, publicNotices, publicTournament, registerShowsFees } from '../../lib/public-tournament-shape.ts';
import type { PublicTournament } from '../../lib/public-tournament-shape.ts';
import { publicVenue } from '../../lib/public-teams.ts';
import type { PublicVenue } from '../../lib/public-teams.ts';
import type { Announcement, Division, Game, Team, Tournament, TournamentSettings, Venue } from '../../lib/types.ts';

// ── The fake database ───────────────────────────────────────────────────────────────────────────────────────────
const SECRET = {
  payment: 'PAYMENT_SECRET_ETRANSFER_TO_TREASURER',
  waiver: 'WAIVER_SECRET_TEXT',
  otherContact: 'RAW_CONTACT_OF_THE_OTHER_EVENT@example.test',
  heldTeam: 'HELD_BACK_TEAM_NAME',
  heldDivision: 'HELD_BACK_DIVISION_NAME',
  gameNote: 'PRIVATE_GAME_NOTE',
  venueNote: 'PRIVATE_VENUE_NOTE',
  fieldNote: 'PRIVATE_FIELD_NOTE',
  heldNotice: 'NOTICE_AIMED_AT_THE_HELD_BACK_DIVISION',
  unpinnedNotice: 'NOTICE_NOT_PINNED',
  internal: 'DIRECTORY_PROVINCE_FLAG',
};

function record(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', organizationId: 'org', year: 2026, name: 'The Classic', slug: 'cup', sport: 'baseball', status: 'active', isActive: true,
    startDate: '2026-11-07', endDate: '2026-11-08', contactEmail: 'RAW_CONTACT_ON_THE_RECORD@example.test',
    feeScheduleMode: 'tournament', depositAmount: 100, depositDueDate: '2026-10-01', totalFeeAmount: 500, totalFeeDueDate: '2026-11-01',
    logoUrl: 'https://img.test/logo.png', themePreset: 'forest', themePrimary: '#112233', themeAccent: '#445566', themeFont: 'inter',
    publicHiddenPages: [], coachNamesShowOnPublic: false, listInDirectory: true, directoryProvince: SECRET.internal,
    championsCrownedAt: null, requireScoreFinalization: true, notifyTeamsOnComplete: true, resultsNotifiedAt: '2026-11-09T00:00:00Z',
    settings: {
      format: 'round_robin_playoffs', game_duration_minutes: 75, tie_breakers: ['head_to_head'], tie_breaker_scope: 'tournament',
      fee_scope: 'tournament', show_fees_on_register: true, payment_instructions: SECRET.payment, payment_instructions_on_form: true,
      coach_email_confirmation: true, coach_email_acceptance: false, coach_email_pause_all: false,
      roster_waiver_text: SECRET.waiver, buffer_minutes: 20, rulesLayout: 'single',
    },
    ...over,
  } as Tournament;
}

const divisions = [
  { id: 'dA', tournamentId: 't1', name: 'U11 Open', minAge: 9, maxAge: 11, order: 1, scheduleVisibility: 'published', depositAmount: 50, totalFeeAmount: 250, pools: [] },
  { id: 'dB', tournamentId: 't1', name: SECRET.heldDivision, minAge: 12, maxAge: 13, order: 2, scheduleVisibility: 'unpublished', depositAmount: 60, totalFeeAmount: 300, pools: [] },
] as unknown as Division[];
const teams = [
  { id: 'tA', tournamentId: 't1', divisionId: 'dA', name: 'Open Team', status: 'accepted', coach: 'Coach A', email: 'coach@private.test', adminNotes: 'PRIVATE_ADMIN_NOTE' },
  { id: 'tB', tournamentId: 't1', divisionId: 'dB', name: SECRET.heldTeam, status: 'accepted', coach: 'Coach B' },
] as unknown as Team[];
const games = [
  // a published division's crossover game against a held-back team
  { id: 'g1', tournamentId: 't1', divisionId: 'dA', homeTeamId: 'tA', awayTeamId: 'tB', date: '2026-11-07', time: '10:00', status: 'scheduled', location: 'Park', isPlayoff: false, notes: SECRET.gameNote,
    scoreSubmittedByEmail: 'KEEPER_EMAIL@private.test', scoreSubmittedByUserId: 'KEEPER_USER_ID', scoreSubmittedAt: '2026-11-07T11:00:00Z', scoreSubmissionSource: 'KEEPER_SOURCE' },
  { id: 'g2', tournamentId: 't1', divisionId: 'dB', homeTeamId: 'tB', awayTeamId: 'tB', date: '2026-11-07', time: '12:00', status: 'scheduled', location: 'Park', isPlayoff: false, notes: SECRET.gameNote },
] as unknown as Game[];
const venues = [
  { id: 'v1', tournamentId: 't1', name: 'Lions Park', address: '1 Park Rd', notes: SECRET.venueNote,
    facilities: [{ id: 'f1', venueId: 'v1', tournamentId: 't1', name: 'Diamond 1', facilityType: 'diamond', displayOrder: 0, notes: SECRET.fieldNote }] },
] as unknown as Venue[];
const announcements = [
  { id: 'n1', tournamentId: 't1', title: 'Rain delay', body: 'NOTICE_FOR_EVERYONE', date: '2026-11-07', pinned: true, divisionIds: null },
  { id: 'n2', tournamentId: 't1', title: 'Held', body: SECRET.heldNotice, date: '2026-11-07', pinned: true, divisionIds: ['dB'] },
  { id: 'n3', tournamentId: 't1', title: 'Quiet', body: SECRET.unpinnedNotice, date: '2026-11-07', pinned: false, divisionIds: null },
] as unknown as Announcement[];

type Setup = { tournament?: Tournament; contact?: string | null };
function feed(setup: Setup = {}) {
  const t = setup.tournament ?? record();
  const other = record({ id: 't2', slug: 'old-event', name: 'Last Year', status: 'completed', year: 2025, contactEmail: SECRET.otherContact });
  const db = {
    getOrganizationBySlug: async () => ({ id: 'org', name: 'Club', slug: 'club', planId: 'tournament_plus', subscriptionStatus: 'active', contactEmail: 'club@public.test', requireScoreFinalization: true }),
    getTournamentsByOrg: async () => [t, other],
    resolveTournamentContactEmail: async () => (setup.contact === undefined ? null : setup.contact),
    getDivisions: async () => divisions, getTeams: async () => teams, getGames: async () => games, getVenues: async () => venues,
    getAnnouncements: async () => announcements,
    getRules: async () => [{ id: 'r1', tournamentId: 't1', title: 'Rule', body: 'Play fair', order: 0 }],
    getResources: async () => [],
    getTournamentRegistrationFields: async () => [],
    getStandings: async () => [],
  };
  const load = componentLoader({ './db': db, './supabase-admin': { supabaseAdmin: {} } });
  return load('lib/public-tournament-data.ts') as {
    getPublicTournamentPageData: (org: string, t: string | null, section?: string, opts?: { look?: boolean }) => Promise<Record<string, unknown> & { tournament: Record<string, unknown> | null } | null>;
  };
}

/** What the route serves — read from its source, so a section added there is swept here. */
const ROUTE_SECTIONS = [...readCode('app/api/public/tournament-data/route.ts').matchAll(/new Set<PublicTournamentSection>\(\[([^\]]+)\]/g)]
  .flatMap(m => [...m[1].matchAll(/'([a-z-]+)'/g)].map(x => x[1]));

const json = (value: unknown) => JSON.stringify(value);

describe('the route serves only the published-only sections', () => {
  it('reads the route\'s own list, and it holds no plain schedule/teams/standings and no consumer feed', () => {
    assert.ok(ROUTE_SECTIONS.length >= 7, `the sweep found ${ROUTE_SECTIONS.join(',')}`);
    for (const plain of ['schedule', 'teams', 'standings', 'scores']) assert.ok(!ROUTE_SECTIONS.includes(plain), `${plain} is served`);
    assert.deepEqual([...ROUTE_SECTIONS].sort(), ['context', 'playoffs', 'register', 'rules', 'schedule-preview', 'standings-preview', 'teams-preview']);
  });
  it('the section type no longer names the plain sections', () => {
    const type = readCode('lib/public-tournament-data.ts').match(/export type PublicTournamentSection =([^;]+);/)![1];
    assert.doesNotMatch(type, /'schedule'(?!-)|'teams'(?!-)|'standings'(?!-)/);
  });
});

describe('every section the route serves, read through the real feed', () => {
  const FORBIDDEN_EVERYWHERE = [SECRET.waiver, SECRET.otherContact, 'RAW_CONTACT_ON_THE_RECORD', SECRET.gameNote, SECRET.venueNote, SECRET.fieldNote,
    SECRET.heldNotice, SECRET.unpinnedNotice, SECRET.internal, 'PRIVATE_ADMIN_NOTE', 'coach@private.test', 'directoryProvince', 'listInDirectory',
    'notifyTeamsOnComplete', 'resultsNotifiedAt', 'buffer_minutes', 'roster_waiver_text', 'coach_email_acceptance', '"tournaments"', 'organizationId',
    'scoreSubmittedBy', 'scoreSubmittedAt', 'scoreSubmissionSource', 'KEEPER_EMAIL', 'KEEPER_USER_ID', 'KEEPER_SOURCE', 'Coach A', 'Coach B', 'sport'];
  for (const section of ROUTE_SECTIONS) {
    it(`${section}: none of the internal record, the other events, the notes or the held-back notice leaves the server`, async () => {
      const data = await feed({ contact: 'public@contact.test' }).getPublicTournamentPageData('club', 'cup', section);
      assert.ok(data, 'the feed answers');
      const body = json(data);
      for (const word of FORBIDDEN_EVERYWHERE) assert.ok(!body.includes(word), `${section} sends ${word}`);
      // The payment instructions go only on the Register section — the fixture has them set to show on the form, so any
      // other section that carries them is a leak.
      if (section !== 'register') assert.ok(!body.includes(SECRET.payment), `${section} sends the payment instructions`);
      assert.ok(!('tournaments' in data), `${section} sends the club's other events`);
    });
  }
  for (const section of ROUTE_SECTIONS.filter(s => s !== 'rules' && s !== 'register' && s !== 'context')) {
    it(`${section}: a held-back division's team and division names never appear`, async () => {
      const body = json(await feed().getPublicTournamentPageData('club', 'cup', section));
      assert.ok(!body.includes(SECRET.heldTeam), `${section} names the held-back team`);
      assert.ok(!body.includes(SECRET.heldDivision), `${section} names the held-back division`);
    });
  }
  it('the fee schedule is on no section but Register, and the divisions\' fees go with it', async () => {
    for (const section of ROUTE_SECTIONS.filter(s => s !== 'register')) {
      const data = await feed().getPublicTournamentPageData('club', 'cup', section);
      const body = json(data);
      for (const word of ['depositAmount', 'totalFeeAmount', 'depositDueDate', 'totalFeeDueDate', 'feeScheduleMode', 'fee_scope', 'payment_instructions']) {
        assert.ok(!body.includes(word), `${section} sends ${word}`);
      }
    }
  });
});

describe('what the pages need is still there', () => {
  it('context: the event facts, the public contact (never the raw one) and no other event', async () => {
    const data = (await feed({ contact: 'public@contact.test' }).getPublicTournamentPageData('club', 'cup', 'context'))!;
    assert.deepEqual(Object.keys(data.tournament!).filter(k => k !== 'settings').sort(),
      ['championsCrownedAt', 'contactEmail', 'endDate', 'id', 'name', 'publicHiddenPages', 'requireScoreFinalization', 'slug', 'startDate', 'status']);
    assert.equal(data.tournament!.contactEmail, 'public@contact.test');
  });
  it('a hidden contact stays hidden', async () => {
    const data = (await feed({ contact: null }).getPublicTournamentPageData('club', 'cup', 'context'))!;
    assert.equal(data.tournament!.contactEmail, undefined);
    assert.ok(!json(data).includes('RAW_CONTACT_ON_THE_RECORD'));
    assert.ok(!json(data).includes('club@public.test'), 'the organization-level address follows the same switch');
    assert.ok(!(data.organization as { contactEmail?: string | null }).contactEmail);
  });
  it('schedule-preview: published games, their teams, the venue facts, and the notice for everyone', async () => {
    const data = (await feed().getPublicTournamentPageData('club', 'cup', 'schedule-preview'))!;
    const body = json(data);
    assert.match(body, /Open Team/); assert.match(body, /Lions Park/); assert.match(body, /Diamond 1/); assert.match(body, /1 Park Rd/);
    assert.deepEqual((data.games as Game[]).map(g => g.id), ['g1']);
    assert.deepEqual(data.announcements, [{ id: 'n1', title: 'Rain delay', body: 'NOTICE_FOR_EVERYONE', pinned: true }]);
    assert.equal((data.tournament!.settings as Record<string, unknown>).game_duration_minutes, 75);
  });
  for (const section of ['schedule-preview', 'teams-preview', 'standings-preview', 'playoffs', 'scores']) {
    it(`${section}: the published game is there, its held-back opponent is blanked, and no note or scorekeeper rides along`, async () => {
      const data = (await feed().getPublicTournamentPageData('club', 'cup', section))!;
      assert.equal(data.pageEnabled, true, `${section} is on in the fixture — else this test proves nothing`);
      const list = data.games as Game[];
      assert.deepEqual(list.map(g => g.id), ['g1']);
      assert.equal(list[0].homeTeamId, 'tA'); assert.equal(list[0].awayTeamId, '', 'the door to the held-back opponent is shut');
      for (const key of ['notes', 'scoreSubmittedByEmail', 'scoreSubmittedByUserId', 'scoreSubmittedAt', 'scoreSubmissionSource']) assert.ok(!(key in list[0]), `${key} on a game`);
      // 'scores' keeps every accepted team in its teams list on purpose (server-only; the follow status counts them), so for
      // it the proof is that no game points at the held-back team; every other section also lists no such team at all.
      assert.ok(!json(section === 'scores' ? list : data).includes('"tB"'), 'the held-back team id appears where the browser can follow it');
    });
  }
  it('teams-preview says only THAT something is held back, never what', async () => {
    const data = (await feed().getPublicTournamentPageData('club', 'cup', 'teams-preview'))!;
    assert.equal(data.teamsWithheld, true);
  });
  it('a hidden News page sends no notice at all', async () => {
    const data = (await feed({ tournament: record({ publicHiddenPages: ['news'] }) }).getPublicTournamentPageData('club', 'cup', 'schedule-preview'))!;
    assert.deepEqual(data.announcements, []);
  });
  it('standings-preview keeps the tie-breaker settings the ranking note reads', async () => {
    const data = (await feed().getPublicTournamentPageData('club', 'cup', 'standings-preview'))!;
    const s = data.tournament!.settings as Record<string, unknown>;
    assert.deepEqual(s.tie_breakers, ['head_to_head']); assert.equal(s.tie_breaker_scope, 'tournament'); assert.equal(s.format, 'round_robin_playoffs');
  });
  it('register: the fee schedule shows, and the instructions only when the organizer put them on the form', async () => {
    const off = (await feed({ tournament: record({ settings: { ...record().settings, payment_instructions_on_form: false } }) }).getPublicTournamentPageData('club', 'cup', 'register'))!;
    assert.equal(off.tournament!.totalFeeAmount, 500);
    assert.equal((off.divisions as Division[])[0].totalFeeAmount, 250);
    assert.ok(!json(off).includes(SECRET.payment), 'instructions not set to appear on the form');
    const on = (await feed().getPublicTournamentPageData('club', 'cup', 'register'))!;
    assert.match(json(on), new RegExp(SECRET.payment));
    assert.equal((on.tournament!.settings as Record<string, unknown>).payment_instructions_on_form, true);
  });
  it('register: an event that does not track payments, or hides fees, sends no fee schedule and no instructions', async () => {
    for (const settings of [{ fee_scope: 'free' }, { show_fees_on_register: false }] as Partial<TournamentSettings>[]) {
      const t = record({ settings: { ...record().settings, payment_instructions_on_form: true, ...settings } });
      const data = (await feed({ tournament: t }).getPublicTournamentPageData('club', 'cup', 'register'))!;
      const body = json(data);
      for (const word of [SECRET.payment, 'depositAmount', 'totalFeeAmount', 'depositDueDate']) assert.ok(!body.includes(word), `${JSON.stringify(settings)} sends ${word}`);
    }
  });
  it('register with the Register page switched off sends no fee schedule and no instructions (an invite-only event always has it off)', async () => {
    const data = (await feed({ tournament: record({ publicHiddenPages: ['register'] }) }).getPublicTournamentPageData('club', 'cup', 'register'))!;
    assert.equal(data.pageEnabled, false);
    const body = json(data);
    for (const word of [SECRET.payment, 'depositAmount', 'totalFeeAmount', 'feeScheduleMode', 'fee_scope', 'payment_instructions']) assert.ok(!body.includes(word), `a hidden Register sends ${word}`);
  });
  it('a server-only caller can ask for the event\'s look; the default feed never carries it', async () => {
    const plain = (await feed().getPublicTournamentPageData('club', 'cup', 'context'))!;
    assert.ok(!('logoUrl' in plain.tournament!) && !('themePrimary' in plain.tournament!));
    const look = (await feed().getPublicTournamentPageData('club', 'cup', 'context', { look: true }))!;
    assert.equal(look.tournament!.themePrimary, '#112233'); assert.equal(look.tournament!.logoUrl, 'https://img.test/logo.png');
  });
  it('the consumer feed section stays server-side, and still leaves out notes', async () => {
    const data = (await feed().getPublicTournamentPageData('club', 'cup', 'scores'))!;
    assert.ok(!json(data).includes(SECRET.gameNote));
    assert.equal(data.gamesWithheld, true);
  });
  it('the shape builder leaves the server copy untouched', () => {
    const t = record(); const before = json(t);
    publicTournament(t, undefined, { register: true, look: true });
    assert.equal(json(t), before);
  });
});

describe('the pieces, one by one', () => {
  it('registerShowsFees: tracked and not switched off', () => {
    assert.equal(registerShowsFees({ fee_scope: 'tournament' }), true);
    assert.equal(registerShowsFees(undefined), true);
    assert.equal(registerShowsFees({ fee_scope: 'free' }), false);
    assert.equal(registerShowsFees({ show_fees_on_register: false }), false);
  });
  it('publicDivision drops only the fee schedule, and only when fees are not shown', () => {
    const d = divisions[0];
    const hidden = publicDivision(d, false);
    for (const key of ['depositAmount', 'depositDueDate', 'totalFeeAmount', 'totalFeeDueDate']) assert.ok(!(key in hidden), key);
    assert.equal(hidden.name, 'U11 Open'); assert.equal(hidden.minAge, 9); assert.equal(hidden.scheduleVisibility, 'published');
    assert.equal(publicDivision(d, true).totalFeeAmount, 250);
    assert.equal(d.totalFeeAmount, 250, 'the server copy is untouched');
  });
  it('publicNotices: pinned only, News on, nothing aimed at a held-back division, a stale id ignored', () => {
    const t = { publicHiddenPages: [] as never[], settings: undefined };
    const out = publicNotices(announcements, t, divisions);
    assert.deepEqual(out.map(n => n.id), ['n1']);
    assert.deepEqual(Object.keys(out[0]).sort(), ['body', 'id', 'pinned', 'title']);
    assert.deepEqual(publicNotices(announcements, { publicHiddenPages: ['news'], settings: undefined }, divisions), []);
    const stale = { ...announcements[0], id: 'n4', divisionIds: ['gone'] } as Announcement;
    assert.deepEqual(publicNotices([stale], t, divisions).map(n => n.id), ['n4'], 'an id with no division is not a held-back one');
    const mixed = { ...announcements[0], id: 'n5', divisionIds: ['dA', 'dB'] } as Announcement;
    assert.deepEqual(publicNotices([mixed], t, divisions), [], 'naming a held-back division together with a published one still names it');
    const published = { ...announcements[0], id: 'n6', divisionIds: ['dA'] } as Announcement;
    assert.deepEqual(publicNotices([published], t, divisions).map(n => n.id), ['n6']);
  });
  it('publicVenue drops venue and field notes and keeps the facts', () => {
    const v = publicVenue(venues[0]);
    assert.ok(!('notes' in v) && !('notes' in v.facilities![0]));
    assert.equal(v.name, 'Lions Park'); assert.equal(v.address, '1 Park Rd'); assert.equal(v.facilities![0].name, 'Diamond 1');
    assert.equal(venues[0].notes, SECRET.venueNote, 'the server copy is untouched');
  });
  it('the compiler holds the rule (npm run typecheck): a raw record is not a public tournament, a raw venue or field is not a public one', () => {
    // @ts-expect-error — a raw Tournament lacks the brand only publicTournament() can give
    const notPublic: PublicTournament = record();
    // @ts-expect-error — a raw Venue's `notes` is a string; a PublicVenue's can only be absent
    const notPublicVenue: PublicVenue = venues[0];
    // @ts-expect-error — nor is a raw field inside a venue: its `notes` too can only be absent
    const notPublicField: NonNullable<PublicVenue['facilities']>[number] = venues[0].facilities![0];
    assert.ok(notPublic && notPublicVenue && notPublicField); // runtime no-op; the point is the three directives above, which `npm run typecheck` enforces
  });
});

describe('the team-profile route has one published-only shape for every caller', () => {
  const route = readCode('app/api/public/team-profile/route.ts');
  it('reads only its three identifying parameters, and never returns the unscrubbed profile', () => {
    assert.deepEqual([...route.matchAll(/searchParams\.get\('([A-Za-z]+)'\)/g)].map(m => m[1]).sort(), ['orgSlug', 'teamId', 'tournamentSlug']);
    assert.doesNotMatch(route, /NextResponse\.json\(profile\b/);
    assert.equal((route.match(/teamProfilePreview\(/g) ?? []).length, 1);
  });
});

describe('the public data route itself (behaviour)', () => {
  async function call(url: string) {
    const seen: unknown[][] = [];
    const load = componentLoader({
      '@/lib/observability': { withObservability: (fn: unknown) => fn },
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/public-tournament-data': { getPublicTournamentPageData: async (...args: unknown[]) => { seen.push(args); return { ok: true }; } },
    });
    const { GET } = load('app/api/public/tournament-data/route.ts') as { GET: (req: Request) => Promise<Response> };
    const res = await GET(new Request(url));
    return { status: res.status, seen };
  }
  const base = 'http://localhost/api/public/tournament-data?orgSlug=club&tournamentSlug=cup';
  for (const section of ['schedule', 'teams', 'standings', 'scores', '__proto__', 'constructor']) {
    it(`section=${section} is refused before the feed is asked`, async () => {
      const r = await call(`${base}&section=${section}`);
      assert.equal(r.status, 400); assert.equal(r.seen.length, 0);
    });
  }
  it('a published-only section is answered, with exactly (org, tournament, section) — a caller can never ask for the look', async () => {
    const r = await call(`${base}&section=schedule-preview&look=true`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.seen, [['club', 'cup', 'schedule-preview']]);
  });
});

describe('every reader of the feed goes through the shape (source sweep)', () => {
  const feedCode = readCode('lib/public-tournament-data.ts');
  it('the feed builds `tournament` only through publicTournament, never from the record', () => {
    assert.match(feedCode, /tournament: tournament \? publicTournament\(tournament, /);
    assert.doesNotMatch(feedCode, /tournament: \{ \.\.\.tournament|tournaments,|tournaments:/);
  });
  it('every branch that returns divisions or venues scrubs them', () => {
    assert.doesNotMatch(feedCode, /^\s+divisions,\s*$|divisions: divisions\b/m, 'a raw divisions array in a returned object');
    assert.equal((feedCode.match(/divisions: sendDivisions\(divisions/g) ?? []).length, 5, 'schedule, teams, standings, rules and register each scrub the fee schedule');
    assert.match(feedCode, /const sendDivisions = \(divisions: Division\[\], register = false\) => publicDivisions\(divisions, tournament\.settings, register\);/);
    assert.doesNotMatch(feedCode, /^\s+venues,\s*$|venues: venues(?!\.map\(publicVenue\))/m, 'raw venues');
    assert.equal((feedCode.match(/venues\.map\(publicVenue\)/g) ?? []).length, 2, 'both venue reads go through publicVenue');
  });
  it('the schedule branch judges announcements against the full division list', () => {
    assert.match(feedCode, /announcements: publicNotices\(announcements, tournament, divisions\)/);
  });
  it('the admin preview builds its public data through the same shape', () => {
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx');
    assert.doesNotMatch(preview, /tournaments: \[tournament\]/);
    assert.match(preview, /publicTournament\(tournament, contactEmail \?\? undefined\)/);
    assert.match(preview, /publicTournament\(tournament, contactEmail \?\? undefined, \{ register: true \}\)/);
    assert.match(preview, /divisions: publicDivisions\(registerDivisions, tournament\.settings, true\)/);
  });
  it('the coach portal\'s live schedule and every server reader ask for a published-only section', () => {
    assert.match(readCode('components/coaches/CoachLiveSchedule.tsx'), /section: 'schedule-preview'/);
    for (const file of ['app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx', 'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx',
      'app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx', 'lib/follow-feed.ts']) {
      assert.match(readCode(file), /getPublicTournamentPageData\([^)]*'schedule-preview'/, file);
      assert.doesNotMatch(readCode(file), /getPublicTournamentPageData\([^)]*'(schedule|teams|standings)'/, file);
    }
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx'), /getPublicTournamentPageData\(orgSlug, tournamentSlug, 'teams-preview', \{ look: true \}\)/);
  });
  it('the tournament share image shows no count tiles while every division is held back, rather than dashes', () => {
    const image = readCode('app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx');
    assert.match(image, /showCounts: !\(data\.teamsWithheld && teams\.length === 0 && divisions\.length === 0\)/);
    assert.match(image, /\{c\.showCounts && stat\(c\.teamCount, 'TEAMS'\)\}/);
  });
  it('the tournament share image\'s live line follows the Schedule switch', () => {
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx'), /if \(todayGames\.length > 0 && isPublicPageEnabled\(t, 'schedule'\)\)/);
  });
  it('a game\'s page has no Notes fact', () => {
    assert.doesNotMatch(readCode('lib/public-game-detail.ts'), /key: 'notes'|label: 'Notes'/);
  });
});
