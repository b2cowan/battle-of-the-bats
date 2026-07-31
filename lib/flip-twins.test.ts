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
  resolveScorekeeperFlip,
  allowedAdminScreens,
  primaryTarget,
  parseReturnMemory,
  flipSurfaceLabel,
  publicGamePageHref,
  publicTeamPageHref,
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

test('coach surfaces flip to the event front page; official to the Schedule — both read "Public site"', () => {
  // Coach → the public Overview (owner call 2026-07-23: "see it as fans do" lands on the front page).
  const coach = single(resolveFlip({ pathname: `/${ORG}/coaches`, direction: 'to-public', hat: 'coach', ctx: liveCtx }));
  assert.equal(coach.href, `/${ORG}/${SLUG}`);
  assert.equal(coach.label, 'Public site');
  // Official → the Schedule (scores are the scorekeeper's whole job).
  const official = single(resolveFlip({ pathname: `/${ORG}/scorekeeper`, direction: 'to-public', hat: 'official', ctx: liveCtx }));
  assert.equal(official.href, `/${ORG}/${SLUG}/schedule`);
  assert.equal(official.label, 'Public site');
});

test('coach + official with NO tournament in context fall back to the org public root (never `//schedule`)', () => {
  for (const hat of ['coach', 'official'] as const) {
    for (const tournamentSlug of [undefined, null, ''] as const) {
      const target = single(resolveFlip({
        pathname: `/${ORG}/coaches`,
        direction: 'to-public',
        hat,
        ctx: { orgSlug: ORG, tournamentSlug },
      }));
      assert.equal(target.href, `/${ORG}`, `slug=${JSON.stringify(tournamentSlug)}`);
      assert.equal(target.label, 'Public site');
    }
  }
});

// ── Scorekeeper header pill (P3): direct / chooser / org fallback ────────────────────────────────

test('scorekeeper flip: one tournament in view goes direct to its public Schedule', () => {
  const res = resolveScorekeeperFlip({ orgSlug: ORG, tournaments: [{ name: 'Summer Slam', slug: SLUG }] });
  assert.equal(single(res).href, `/${ORG}/${SLUG}/schedule`);
  assert.equal(single(res).label, 'Public site');
});

test('scorekeeper flip: two or more tournaments open the chooser, one row per event', () => {
  const res = resolveScorekeeperFlip({
    orgSlug: ORG,
    tournaments: [
      { name: 'Summer Slam', slug: SLUG },
      { name: 'Fall Kickoff', slug: 'fall-kickoff' },
    ],
  });
  assert.equal(res.kind, 'multi');
  const multi = res as Extract<FlipResolution, { kind: 'multi' }>;
  assert.equal(multi.label, 'Public site');
  assert.deepEqual(multi.targets.map(t => t.href), [
    `/${ORG}/${SLUG}/schedule`,
    `/${ORG}/fall-kickoff/schedule`,
  ]);
  assert.deepEqual(multi.targets.map(t => t.label), ['Summer Slam', 'Fall Kickoff']);
  assert.ok(multi.targets.every(t => t.sublabel === 'Public schedule'));
});

test('scorekeeper flip: no tournaments in view falls back to the org public site (pill never absent)', () => {
  const target = single(resolveScorekeeperFlip({ orgSlug: ORG, tournaments: [] }));
  assert.equal(target.href, `/${ORG}`);
  assert.equal(target.label, 'Public site');
});

// ── Coach public-link helpers (single-sourced base construction) ─────────────────────────────────

test('publicGamePageHref and publicTeamPageHref build the public game/team page routes', () => {
  assert.equal(publicGamePageHref(liveCtx, 'game-1'), `/${ORG}/${SLUG}/schedule/game-1`);
  assert.equal(publicTeamPageHref(liveCtx, 'team-1'), `/${ORG}/${SLUG}/teams/team-1`);
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

// ── Public → admin: carry the event id so the flip lands on THIS tournament (P2) ─────────────────

test('to-role: adminTournamentId is carried onto the page-matched admin href (?tournamentId=)', () => {
  const ctx: FlipContext = { ...liveCtx, adminTournamentId: 'evt-1' };
  const schedule = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/schedule`, direction: 'to-role', ctx }));
  assert.equal(schedule.href, `/${ORG}/admin/tournaments/schedule?tournamentId=evt-1`);
  // With a game context both params ride along (gameId first, then tournamentId).
  const game = single(resolveFlip({ pathname: `/${ORG}/${SLUG}/schedule`, direction: 'to-role', ctx: { ...ctx, gameId: 'g9' } }));
  assert.equal(game.href, `/${ORG}/admin/tournaments/results?gameId=g9&tournamentId=evt-1`);
});

test('to-public: adminTournamentId is NOT applied (the admin shell already has its tournament)', () => {
  // The admin-shell direction never sets adminTournamentId, so its hrefs stay bare.
  const ctx: FlipContext = { ...liveCtx, adminTournamentId: 'evt-1' };
  const target = single(resolveFlip({ pathname: adminPath('schedule'), direction: 'to-public', ctx }));
  assert.equal(target.href, `/${ORG}/${SLUG}/schedule`); // public twin, unaffected
});

// ── Surface labels (a return link is named by WHERE IT GOES, never "Back to …") ──────────────────

test('flipSurfaceLabel names the SURFACE, not the screen — one vocabulary with the stateless pill', () => {
  // Every admin screen reads "Admin". The old behaviour named the screen ("Results", "Dashboard"),
  // which is what produced "Back to Dashboard" beside a pill that said "Public site".
  assert.equal(flipSurfaceLabel(adminPath('results')), 'Admin');
  assert.equal(flipSurfaceLabel(adminPath('registrations')), 'Admin');
  assert.equal(flipSurfaceLabel(`/${ORG}/admin/tournaments`), 'Admin');
  assert.equal(flipSurfaceLabel(`/${ORG}/admin/org/settings`), 'Admin');
});

test('flipSurfaceLabel names every public tournament page "Public site"', () => {
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}`), 'Public site');
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}/schedule`), 'Public site');
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}/standings`), 'Public site');
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}/schedule/game-123`), 'Public site');
});

test('flipSurfaceLabel names both coach portals and the scorekeeper shell', () => {
  assert.equal(flipSurfaceLabel('/coaches/tournaments/3f2a-uuid'), 'Coaches Portal'); // free portal
  assert.equal(flipSurfaceLabel('/coaches/team/abc123'), 'Coaches Portal');
  assert.equal(flipSurfaceLabel(`/${ORG}/coaches/teams/t1/tournaments/r1`), 'Coaches Portal'); // premium
  assert.equal(flipSurfaceLabel(`/${ORG}/coaches`), 'Coaches Portal');
  assert.equal(flipSurfaceLabel(`/${ORG}/scorekeeper`), 'Scorekeeper');
});

test('flipSurfaceLabel ignores query + hash (the stored origin URL carries them)', () => {
  assert.equal(flipSurfaceLabel(`/${ORG}/admin/tournaments/schedule?tournamentId=t1`), 'Admin');
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}/schedule?highlightGameId=g1`), 'Public site');
  assert.equal(flipSurfaceLabel(`/${ORG}/${SLUG}#status`), 'Public site');
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

// ── P4/WI-2: staff scoping on the public→admin flip ──────────────────────────────────────────────

test('allowedAdminScreens: unrestricted operator (null capabilities) → undefined (exact twin)', () => {
  assert.equal(allowedAdminScreens(null), undefined);
  assert.equal(allowedAdminScreens(undefined), undefined);
});

test('allowedAdminScreens: a scores-only official reaches results + dashboard, nothing else', () => {
  const allowed = allowedAdminScreens({ submit_scores: true });
  assert.deepEqual(allowed, ['dashboard', 'results']);
});

test('allowedAdminScreens: dashboard is the floor — a staffer with zero action caps still lands somewhere', () => {
  assert.deepEqual(allowedAdminScreens({}), ['dashboard']);
  assert.deepEqual(allowedAdminScreens({ submit_scores: false }), ['dashboard']);
});

test('allowedAdminScreens: either capability opens a screen (any-of, not all-of)', () => {
  assert.ok(allowedAdminScreens({ update_schedule: true })?.includes('schedule'));
  assert.ok(allowedAdminScreens({ manage_schedule_structure: true })?.includes('schedule'));
  assert.ok(allowedAdminScreens({ check_in_teams: true })?.includes('registrations'));
});

test('public→admin flip: a scores-only staffer on public Teams never lands on registrations', () => {
  const res = resolveFlip({
    pathname: '/acme/summer-slam/teams',
    direction: 'to-role',
    hat: 'admin',
    ctx: {
      orgSlug: 'acme',
      tournamentSlug: 'summer-slam',
      adminTournamentId: 't1',
      allowedAdminScreens: allowedAdminScreens({ submit_scores: true }),
    },
  });
  const href = primaryTarget(res).href;
  // The preferred twin for Teams is `registrations` — out of scope for this staffer, so the
  // resolver falls back WITHIN scope. Per the shipped fallback order, that's `dashboard` (first
  // permitted), not `results`. The acceptance bar is "never a screen they'd bounce off", not
  // "the most topically useful screen" — re-ranking the fallback order is a separate question.
  assert.doesNotMatch(href, /registrations/);
  assert.match(href, /\/admin\/tournaments\/dashboard/);
});

test('public→admin flip: a scores-only staffer on a public GAME still lands on results (in scope)', () => {
  const res = resolveFlip({
    pathname: '/acme/summer-slam/schedule/g1',
    direction: 'to-role',
    hat: 'admin',
    ctx: {
      orgSlug: 'acme',
      tournamentSlug: 'summer-slam',
      adminTournamentId: 't1',
      gameId: 'g1',
      allowedAdminScreens: allowedAdminScreens({ submit_scores: true }),
    },
  });
  // Game context prefers `results`, which this staffer CAN open — so the exact twin survives scoping.
  assert.match(primaryTarget(res).href, /\/admin\/tournaments\/results/);
});

test('public→admin flip: an unrestricted operator still gets the exact page-matched twin', () => {
  const res = resolveFlip({
    pathname: '/acme/summer-slam/teams',
    direction: 'to-role',
    hat: 'admin',
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam', adminTournamentId: 't1', allowedAdminScreens: allowedAdminScreens(null) },
  });
  assert.match(primaryTarget(res).href, /\/admin\/tournaments\/registrations/);
});

// ── P4/WI-3: never flip onto a public page the organizer hid ─────────────────────────────────────

const HIDDEN_CTX: FlipContext = {
  orgSlug: 'acme',
  tournamentSlug: 'summer-slam',
  hiddenPublicPages: ['news'],
};

test('admin→public: a hidden twin falls back to the event front page', () => {
  const res = resolveFlip({ pathname: '/acme/admin/tournaments/communication', direction: 'to-public', hat: 'admin', ctx: HIDDEN_CTX });
  assert.equal(primaryTarget(res).href, '/acme/summer-slam');
});

test('admin→public: a VISIBLE twin is unaffected by an unrelated hidden page', () => {
  const res = resolveFlip({ pathname: '/acme/admin/tournaments/schedule', direction: 'to-public', hat: 'admin', ctx: HIDDEN_CTX });
  assert.equal(primaryTarget(res).href, '/acme/summer-slam/schedule');
});

test('admin→public: no hidden set at all behaves exactly as before', () => {
  const res = resolveFlip({
    pathname: '/acme/admin/tournaments/communication',
    direction: 'to-public',
    hat: 'admin',
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam' },
  });
  assert.equal(primaryTarget(res).href, '/acme/summer-slam/news');
});

test('admin→public: the official hat falls back when Schedule itself is hidden', () => {
  const res = resolveFlip({
    pathname: '/acme/scorekeeper',
    direction: 'to-public',
    hat: 'official',
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam', hiddenPublicPages: ['schedule'] },
  });
  assert.equal(primaryTarget(res).href, '/acme/summer-slam');
});

test('admin→public: hiding standings (e.g. playoff-only) redirects the Results twin to the front page', () => {
  const res = resolveFlip({
    pathname: '/acme/admin/tournaments/results',
    direction: 'to-public',
    hat: 'admin',
    // Results twins to `schedule`, so hiding standings must NOT affect it...
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam', hiddenPublicPages: ['standings'] },
  });
  assert.equal(primaryTarget(res).href, '/acme/summer-slam/schedule');
});

test('admin→public: a game deep-link is preserved when Schedule is visible, dropped when hidden', () => {
  const visible = resolveFlip({
    pathname: '/acme/admin/tournaments/results',
    direction: 'to-public',
    hat: 'admin',
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam', gameId: 'g1' },
  });
  assert.equal(primaryTarget(visible).href, '/acme/summer-slam/schedule?highlightGameId=g1');

  const hidden = resolveFlip({
    pathname: '/acme/admin/tournaments/results',
    direction: 'to-public',
    hat: 'admin',
    ctx: { orgSlug: 'acme', tournamentSlug: 'summer-slam', gameId: 'g1', hiddenPublicPages: ['schedule'] },
  });
  // Falls back to the front page — and must NOT smuggle the game id onto it.
  assert.equal(primaryTarget(hidden).href, '/acme/summer-slam');
});
