/**
 * Unit tests for the Flip twin resolver — the mapping table, both directions.
 *
 * No test runner is configured in this repo; these run on Node's built-in runner (Node 24 strips TS
 * types natively), so from the repo root:  `node --test lib/flip-twins.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFlip,
  primaryTarget,
  parseReturnMemory,
  type FlipContext,
  type FlipResolution,
} from './flip-twins.ts';

const ORG = 'milton-bats';
const SLUG = 'summer-slam';
const liveCtx: FlipContext = { orgSlug: ORG, tournamentSlug: SLUG, isDraft: false };
const draftCtx: FlipContext = { orgSlug: ORG, tournamentSlug: SLUG, isDraft: true };

function single(res: FlipResolution) {
  assert.equal(res.kind, 'single', `expected a single-target resolution, got ${res.kind}`);
  return (res as Extract<FlipResolution, { kind: 'single' }>).target;
}
function adminPath(screen: string) {
  return `/${ORG}/admin/tournaments/${screen}`;
}

// ── to-public: admin screen → public page (Phase 1 core) ─────────────────────────────────────────

// Every admin → public flip is a single target with a uniform "Public site" label; only the HREF is
// page-matched (owner call 2026-07-23). Drafts read "Preview site".
test('admin → public: each mapped screen page-matches the href but reads a uniform "Public site"', () => {
  const cases: Array<[string, string]> = [
    // [admin screen, expected href] — Results' public counterpart is the Schedule
    ['dashboard', `/${ORG}/${SLUG}`],
    ['communication', `/${ORG}/${SLUG}/news`],
    ['schedule', `/${ORG}/${SLUG}/schedule`],
    ['registrations', `/${ORG}/${SLUG}/teams`],
    ['rules', `/${ORG}/${SLUG}/rules`],
    ['results', `/${ORG}/${SLUG}/schedule`],
  ];
  for (const [screen, href] of cases) {
    const target = single(resolveFlip({ pathname: adminPath(screen), direction: 'to-public', ctx: liveCtx }));
    assert.equal(target.href, href, `href for ${screen}`);
    assert.equal(target.label, 'Public site', `label for ${screen}`);
  }
});

test('admin → public: unmapped screens fall back to the Overview front page (never absent, never wrong)', () => {
  for (const screen of ['check-in', 'staff-kit', 'data-tools', 'archives', 'settings', 'venues', 'divisions', 'branding', 'summary']) {
    const target = single(resolveFlip({ pathname: adminPath(screen), direction: 'to-public', ctx: liveCtx }));
    assert.equal(target.href, `/${ORG}/${SLUG}`, `${screen} should fall back to the Overview root`);
    assert.equal(target.label, 'Public site');
  }
});

test('admin → public: a path with no admin screen still resolves to the Overview root', () => {
  const target = single(resolveFlip({ pathname: `/${ORG}/admin/tournaments`, direction: 'to-public', ctx: liveCtx }));
  assert.equal(target.href, `/${ORG}/${SLUG}`);
  assert.equal(target.label, 'Public site');
});

test('admin → public: nested sub-paths resolve by their top screen segment', () => {
  const target = single(resolveFlip({ pathname: adminPath('settings/event'), direction: 'to-public', ctx: liveCtx }));
  assert.equal(target.href, `/${ORG}/${SLUG}`); // settings is unmapped → Overview root
  assert.equal(target.label, 'Public site');
});

// ── Draft → preview base + "Preview site" label ────────────────────────────────────────────────────

test('draft tournaments resolve into the admin PREVIEW shell and read "Preview site"', () => {
  const previewBase = `/${ORG}/admin/tournaments/preview/${SLUG}`;
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(schedule.href, `${previewBase}/schedule`);
  assert.equal(schedule.label, 'Preview site');

  const overview = single(resolveFlip({ pathname: adminPath('dashboard'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(overview.href, previewBase);
  assert.equal(overview.label, 'Preview site');

  const results = single(resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(results.href, `${previewBase}/schedule`);
  assert.equal(results.label, 'Preview site');
});

// ── gameId passthrough ───────────────────────────────────────────────────────────────────────────

test('gameId is carried onto the public Schedule deep-link from both Schedule and Results', () => {
  const ctx: FlipContext = { ...liveCtx, gameId: 'game-123' };
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx }));
  assert.equal(schedule.href, `/${ORG}/${SLUG}/schedule?highlightGameId=game-123`);
  const results = single(resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx }));
  assert.equal(results.href, `/${ORG}/${SLUG}/schedule?highlightGameId=game-123`);
});

test('gameId is url-encoded', () => {
  const ctx: FlipContext = { ...liveCtx, gameId: 'a b/c' };
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx }));
  assert.equal(schedule.href, `/${ORG}/${SLUG}/schedule?highlightGameId=a%20b%2Fc`);
});

// ── Coach / official hats (P3 seed) ──────────────────────────────────────────────────────────────

test('coach + official surfaces flip to the public Schedule, reading "Public site"', () => {
  for (const hat of ['coach', 'official'] as const) {
    const target = single(resolveFlip({ pathname: `/${ORG}/coaches`, direction: 'to-public', hat, ctx: liveCtx }));
    assert.equal(target.href, `/${ORG}/${SLUG}/schedule`);
    assert.equal(target.label, 'Public site');
  }
});

// ── to-role: public page → admin screen (reverse map) ────────────────────────────────────────────

test('public → admin: each section maps back to its admin screen', () => {
  const pub = (section: string) => (section ? `/${ORG}/${SLUG}/${section}` : `/${ORG}/${SLUG}`);
  const cases: Array<[string, string]> = [
    ['', `/${ORG}/admin/tournaments/dashboard`], // overview root
    ['schedule', `/${ORG}/admin/tournaments/schedule`],
    ['standings', `/${ORG}/admin/tournaments/results`], // no admin standings screen
    ['teams', `/${ORG}/admin/tournaments/registrations`],
    ['news', `/${ORG}/admin/tournaments/communication`],
    ['rules', `/${ORG}/admin/tournaments/rules`],
    ['register', `/${ORG}/admin/tournaments/registrations`],
  ];
  for (const [section, href] of cases) {
    const target = single(resolveFlip({ pathname: pub(section), direction: 'to-role', hat: 'admin', ctx: liveCtx }));
    assert.equal(target.href, href, `section "${section}"`);
    assert.equal(target.label, 'Admin');
  }
});

test('public → admin: Standings carries the "comes from scores" honesty note', () => {
  const target = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/standings`, direction: 'to-role', ctx: liveCtx }));
  assert.equal(target.sublabel, 'Standings come from these scores');
});

test('public → admin: a game context prefers Results with the existing ?gameId= focus param', () => {
  const ctx: FlipContext = { ...liveCtx, gameId: 'g9' };
  const target = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/schedule`, direction: 'to-role', ctx }));
  assert.equal(target.href, `/${ORG}/admin/tournaments/results?gameId=g9`);
});

test('public → admin: the hat drives the label', () => {
  const coach = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/schedule`, direction: 'to-role', hat: 'coach', ctx: liveCtx }));
  assert.equal(coach.label, 'Coach');
  const official = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/schedule`, direction: 'to-role', hat: 'official', ctx: liveCtx }));
  assert.equal(official.label, 'Scorekeeper');
});

// ── Staff scoping: nearest permitted screen, never a 403 ─────────────────────────────────────────

test('to-role: an out-of-scope twin lands on the nearest permitted screen', () => {
  // Staffer can only open Schedule + Check-in. A Standings→Results twin is out of scope → Schedule.
  const ctx: FlipContext = { ...liveCtx, allowedAdminScreens: ['schedule', 'check-in'] };
  const target = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/standings`, direction: 'to-role', ctx }));
  assert.equal(target.href, `/${ORG}/admin/tournaments/schedule`);
});

test('to-role: an empty allow-list means unscoped (owner/admin) — exact twin', () => {
  const ctx: FlipContext = { ...liveCtx, allowedAdminScreens: [] };
  const target = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/standings`, direction: 'to-role', ctx }));
  assert.equal(target.href, `/${ORG}/admin/tournaments/results`);
});

// ── primaryTarget (the shared single-destination picker) ─────────────────────────────────────────

test('primaryTarget returns the sole target for single, and index 0 for a multi resolution', () => {
  const fromResults = resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx: liveCtx });
  assert.equal(primaryTarget(fromResults).href, `/${ORG}/${SLUG}/schedule`);
  assert.equal(primaryTarget(fromResults).label, 'Public site');

  // Multi (e.g. a future multi-hat popover) → the first target.
  const roles: FlipResolution = {
    kind: 'multi',
    label: 'Roles',
    targets: [{ href: '/admin-x', label: 'Admin' }, { href: '/coach-x', label: 'Coach' }],
  };
  assert.equal(primaryTarget(roles).href, '/admin-x');
});

// ── Return-memory parse ──────────────────────────────────────────────────────────────────────────

test('parseReturnMemory accepts a fresh, well-formed snapshot', () => {
  const now = 1_000_000;
  const raw = JSON.stringify({ originUrl: '/a/b/schedule', label: 'Schedule', ts: now - 1000 });
  assert.deepEqual(parseReturnMemory(raw, now), { originUrl: '/a/b/schedule', label: 'Schedule', ts: now - 1000 });
});

test('parseReturnMemory rejects null, malformed JSON, missing fields, and stale snapshots', () => {
  const now = 1_000_000;
  assert.equal(parseReturnMemory(null, now), null);
  assert.equal(parseReturnMemory('{not json', now), null);
  assert.equal(parseReturnMemory(JSON.stringify({ label: 'x', ts: now }), now), null); // no originUrl
  assert.equal(parseReturnMemory(JSON.stringify({ originUrl: '/a', ts: now }), now), null); // no label
  assert.equal(parseReturnMemory(JSON.stringify({ originUrl: '/a', label: 'x' }), now), null); // no ts
  const stale = JSON.stringify({ originUrl: '/a', label: 'x', ts: now - 60 * 60 * 1000 });
  assert.equal(parseReturnMemory(stale, now), null); // an hour old → stale
});
