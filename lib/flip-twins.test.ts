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
function multi(res: FlipResolution) {
  assert.equal(res.kind, 'multi', `expected a multi-target resolution, got ${res.kind}`);
  return res as Extract<FlipResolution, { kind: 'multi' }>;
}
function adminPath(screen: string) {
  return `/${ORG}/admin/tournaments/${screen}`;
}

// ── to-public: admin screen → public page (Phase 1 core) ─────────────────────────────────────────

test('admin → public: each mapped screen lands on its public twin with the right label', () => {
  const cases: Array<[string, string, string]> = [
    // [admin screen, expected href suffix, expected label]
    ['dashboard', `/${ORG}/${SLUG}`, 'Public · Overview'],
    ['communication', `/${ORG}/${SLUG}/news`, 'Public · News'],
    ['schedule', `/${ORG}/${SLUG}/schedule`, 'Public · Schedule'],
    ['registrations', `/${ORG}/${SLUG}/teams`, 'Public · Teams'],
    ['rules', `/${ORG}/${SLUG}/rules`, 'Public · Rules'],
  ];
  for (const [screen, href, label] of cases) {
    const target = single(resolveFlip({ pathname: adminPath(screen), direction: 'to-public', ctx: liveCtx }));
    assert.equal(target.href, href, `href for ${screen}`);
    assert.equal(target.label, label, `label for ${screen}`);
  }
});

test('admin → public: Results is a two-target chooser (Schedule + Standings, with honesty note)', () => {
  const res = multi(resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx: liveCtx }));
  assert.equal(res.label, 'Public');
  assert.equal(res.targets.length, 2);
  assert.deepEqual(res.targets.map(t => t.href), [`/${ORG}/${SLUG}/schedule`, `/${ORG}/${SLUG}/standings`]);
  assert.deepEqual(res.targets.map(t => t.label), ['Public · Schedule', 'Public · Standings']);
  assert.equal(res.targets[1].sublabel, 'Standings come from these scores');
});

test('admin → public: unmapped screens fall back to Overview (never absent, never a wrong guess)', () => {
  for (const screen of ['check-in', 'staff-kit', 'data-tools', 'archives', 'settings', 'venues', 'divisions', 'branding', 'summary']) {
    const target = single(resolveFlip({ pathname: adminPath(screen), direction: 'to-public', ctx: liveCtx }));
    assert.equal(target.href, `/${ORG}/${SLUG}`, `${screen} should fall back to Overview root`);
    assert.equal(target.label, 'Public · Overview');
  }
});

test('admin → public: a path with no admin screen still resolves to Overview', () => {
  const target = single(resolveFlip({ pathname: `/${ORG}/admin/tournaments`, direction: 'to-public', ctx: liveCtx }));
  assert.equal(target.href, `/${ORG}/${SLUG}`);
  assert.equal(target.label, 'Public · Overview');
});

test('admin → public: nested sub-paths resolve by their top screen segment', () => {
  const target = single(resolveFlip({ pathname: adminPath('settings/event'), direction: 'to-public', ctx: liveCtx }));
  assert.equal(target.label, 'Public · Overview'); // settings is unmapped → Overview
});

// ── Draft → preview base + labels ────────────────────────────────────────────────────────────────

test('draft tournaments resolve into the admin PREVIEW shell and read "Preview"', () => {
  const previewBase = `/${ORG}/admin/tournaments/preview/${SLUG}`;
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(schedule.href, `${previewBase}/schedule`);
  assert.equal(schedule.label, 'Preview · Schedule');

  const overview = single(resolveFlip({ pathname: adminPath('dashboard'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(overview.href, previewBase);
  assert.equal(overview.label, 'Preview · Overview');

  const results = multi(resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx: draftCtx }));
  assert.equal(results.label, 'Preview');
  assert.deepEqual(results.targets.map(t => t.label), ['Preview · Schedule', 'Preview · Standings']);
});

// ── gameId passthrough ───────────────────────────────────────────────────────────────────────────

test('gameId is carried onto the public Schedule deep-link (both the direct + Results-chooser paths)', () => {
  const ctx: FlipContext = { ...liveCtx, gameId: 'game-123' };
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx }));
  assert.equal(schedule.href, `/${ORG}/${SLUG}/schedule?highlightGameId=game-123`);

  const results = multi(resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx }));
  assert.equal(results.targets[0].href, `/${ORG}/${SLUG}/schedule?highlightGameId=game-123`);
  // Standings never takes the highlight param.
  assert.equal(results.targets[1].href, `/${ORG}/${SLUG}/standings`);
});

test('gameId is url-encoded', () => {
  const ctx: FlipContext = { ...liveCtx, gameId: 'a b/c' };
  const schedule = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx }));
  assert.equal(schedule.href, `/${ORG}/${SLUG}/schedule?highlightGameId=a%20b%2Fc`);
});

// ── Coach / official hats (P3 seed) ──────────────────────────────────────────────────────────────

test('coach + official surfaces flip to the public Schedule', () => {
  for (const hat of ['coach', 'official'] as const) {
    const target = single(resolveFlip({ pathname: `/${ORG}/coaches`, direction: 'to-public', hat, ctx: liveCtx }));
    assert.equal(target.href, `/${ORG}/${SLUG}/schedule`);
    assert.equal(target.label, 'Public · Schedule');
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

test('primaryTarget returns the target for single and the Schedule twin (index 0) for the Results chooser', () => {
  const single = resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx: liveCtx });
  assert.equal(primaryTarget(single).href, `/${ORG}/${SLUG}/schedule`);
  assert.equal(primaryTarget(single).label, 'Public · Schedule');

  const multi = resolveFlip({ pathname: adminPath('results'), direction: 'to-public', ctx: liveCtx });
  assert.equal(primaryTarget(multi).href, `/${ORG}/${SLUG}/schedule`);
  assert.equal(primaryTarget(multi).label, 'Public · Schedule');
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
