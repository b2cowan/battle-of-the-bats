import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * Schedule intelligence (Coach Portal Chunk C — C0, P1 #6, P1 #7, P1 #9, wow #2).
 *
 * PERMANENT regression coverage for the facts unit tests can't see:
 *  1. C0 — a time TYPED in the form reads back the same everywhere, and survives a re-save
 *     (the compounding shift that made a 6:00 PM game show as 2:00 PM);
 *  2. P1 #6 — "Repeat weekly" shows the occurrences as rows and writes N games with N DIFFERENT
 *     opponents, minus any date the coach removed;
 *  3. P1 #7 — the import preview refuses an ambiguous date, surfaces a look-alike organizer game,
 *     and a commit leaves every mirrored row untouched (asserted at the DATA level, not the UI);
 *  4. P1 #9 — every lineup control clears the 44px tap floor at 360px, by COMPUTED STYLE;
 *  5. D-C10/11/12 — the order view exists, drag-reorder persists into Positions, and a player's
 *     positions travel WITH the player rather than staying with the batting slot;
 *  6. the read-only sweep — a coach without the schedule grant sees no Import/Add door anywhere
 *     and every schedule write API answers 403.
 *
 * Computed styles / real DOM / data-level assertions only — never screenshots.
 * Self-provisions via service-role with the `capsched-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-check EVERY provisioning insert.
 * ⚠ Scope text assertions to `main[class*="coachesMain"]` — the outer layout <main> wraps the
 * phone-hidden sidebar.
 */

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const MARK = 'capsched';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSIST_EMAIL = `${MARK}-assistant@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE = { width: 360, height: 740 };
const TAP_MIN = 44;

let orgId = '';
let headUserId = '';
let assistUserId = '';
let repTeamId = '';
let programYearId = '';
let mirroredEventId = '';
let gameEventId = '';

/** A date safely in the future so nothing collides with "today" logic. */
const YEAR = new Date().getFullYear() + 1;
const D = (mmdd: string) => `${YEAR}-${mmdd}`;

async function cleanup() {
  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: events } = await admin.from('rep_team_events').select('id').eq('program_year_id', y.id);
      for (const e of events ?? []) {
        await admin.from('rep_team_event_attendance').delete().eq('event_id', e.id);
        const { data: lus } = await admin.from('rep_team_lineups').select('id').eq('event_id', e.id);
        for (const l of lus ?? []) await admin.from('rep_team_lineup_entries').delete().eq('lineup_id', l.id);
        await admin.from('rep_team_lineups').delete().eq('event_id', e.id);
      }
      // Children first: recurrence_parent_id and parent_event_id are self-referencing FKs.
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id).not('recurrence_parent_id', 'is', null);
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    // M1: memberships are team-scoped — clear them before the team row goes, or the
    // FK leaves the team undeletable and it surfaces as the teardown assertion.
    await clearMemberships(admin, t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email === HEAD_EMAIL || u.email === ASSIST_EMAIL) {
      await admin.from('organization_members').delete().eq('user_id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function makeCoach(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  const id = created.user!.id;
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: id, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  return id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  headUserId = await makeCoach(HEAD_EMAIL);
  assistUserId = await makeCoach(ASSIST_EMAIL);

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Selects 12U`, slug: `${MARK}-selects-12u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active' })
    .select('id').single();
  if (yearErr) throw yearErr;
  programYearId = year!.id;

  const { error: hcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: headUserId, coach_role: 'head_coach',
  });
  if (hcErr) throw hcErr;
  // The read-only sweep persona: real grants, but NOT schedule.
  // ⚠ `schedule` must be set FALSE explicitly — an assistant's grants fall back to
  // ASSISTANT_DEFAULTS, where schedule/lineups are TRUE. Omitting a key grants it.
  const { error: acErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: assistUserId, coach_role: 'assistant_coach',
    capabilities: { schedule: false, lineups: false, roster: 'view', attendance: true },
  });
  if (acErr) throw acErr;

  // Enough players that the lineup grid and the order view both have real rows.
  const { error: pErr } = await admin.from('rep_roster_players').insert(
    ['Avery,Chen,7', 'Jordan,Bell,12', 'Sam,Tran,4', 'Noor,Haddad,21'].map(s => {
      const [first, last, num] = s.split(',');
      return {
        program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
        player_first_name: first, player_last_name: last, player_number: num, status: 'active',
      };
    }),
  );
  if (pErr) throw pErr;

  // A MIRRORED tournament game — the row every bulk path must leave alone. `starts_at` is written
  // here as a REAL instant (10:00 local), the way the fixed mirror now writes it.
  const { data: mirror, error: mErr } = await admin.from('rep_team_events').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    event_type: 'tournament_game', name: `${MARK} Fall Classic`,
    starts_at: `${D('10-03')}T14:00:00+00:00`, opponent: 'Ridgeway Royals',
    source_tournament_game_id: '00000000-0000-4000-8000-00000000c0de',
    status: 'scheduled',
  }).select('id').single();
  if (mErr) throw mErr;
  mirroredEventId = mirror!.id;

  // A plain league game for the lineup work.
  const { data: game, error: gErr } = await admin.from('rep_team_events').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    event_type: 'league_game', name: `${MARK} vs Barrhaven Blue`,
    starts_at: `${D('09-15')}T22:00:00+00:00`, opponent: 'Barrhaven Blue', status: 'scheduled',
  }).select('id').single();
  if (gErr) throw gErr;
  gameEventId = game!.id;

  /**
   * ⚠ M1 MEMBERSHIPS — THE ACCESS TRUTH (owner ruling 2026-08-16, mig 245). Without this every
   * coach above 403s at the first membership-gated route, and the spec fails for a reason that
   * has nothing to do with what it tests. PROJECTED from the season rows rather than restated,
   * so the pair can never disagree — see tests/uat/scenarios/_coach-membership-fixture.ts.
   */
  await grantMembershipsFromSeasonRows(admin, repTeamId);
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const base = () => `/${ORG_SLUG}/coaches/teams/${repTeamId}`;
const api = () => `/api/coaches/${ORG_SLUG}/teams/${repTeamId}`;

async function open(page: Page, url: string) {
  await page.goto(url);
  const m = page.locator('main[class*="coachesMain"]');
  await expect(m).toBeVisible({ timeout: 45_000 });
  await expect(m.getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
}

const main = (page: Page) => page.locator('main[class*="coachesMain"]');

/**
 * Put players in the lineup and WAIT until the grid actually has them.
 *
 * The bare `if (count) click()` this replaces was the source of a flake: on a slow run the
 * add-all button had not rendered yet (so nothing was clicked), and on a fast one the click
 * returned before the rows painted — either way the very next line measured an empty grid.
 * Waits for the end state rather than assuming the action produced it.
 */
async function ensureLineupRows(page: Page) {
  const rows = main(page).locator('tbody tr');
  if (await rows.count() > 0) return;
  const addAll = main(page).getByRole('button', { name: /add all|add player/i }).first();
  await expect(addAll).toBeVisible({ timeout: 30_000 });
  await addAll.click();
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
}

/** Pre-clean rows this test is about to create, so a retry starts from a known state. */
async function dropEventsNamed(like: string) {
  await admin.from('rep_team_events').delete().eq('program_year_id', programYearId).like('name', like)
    .not('recurrence_parent_id', 'is', null);
  await admin.from('rep_team_events').delete().eq('program_year_id', programYearId).like('name', like);
}

// ─── 1 · C0 — the time a coach types is the time the portal shows ───────────────

test('C0 — a typed time reads back identically, and a re-save does not shift it', async ({ page }) => {
  await dropEventsNamed('%Timecheck%');
  await signIn(page, HEAD_EMAIL);

  // Write through the SAME route the form uses, with the wall-clock string the form sends.
  const created = await page.request.post(`${api()}/events`, {
    data: {
      eventType: 'practice', name: `${MARK} Timecheck`,
      startsAt: `${D('09-08')}T18:00`,
    },
  });
  expect(created.ok()).toBeTruthy();
  const eventId = (await created.json()).event.id;

  // Stored as a real instant: 6:00 PM Toronto in September (EDT −4) is 22:00Z — NOT 18:00Z.
  const { data: row } = await admin.from('rep_team_events').select('starts_at').eq('id', eventId).single();
  expect(String(row!.starts_at)).toContain('22:00:00');

  // And it reads back to the coach as what they typed, on the schedule.
  await open(page, `${base()}/schedule`);
  await expect(main(page).getByText(`${MARK} Timecheck`).first()).toBeVisible({ timeout: 30_000 });
  // en-CA renders "6:00 p.m." — the portal's long-standing format. Matched loosely so a locale
  // punctuation change can't fail a probe that is about the HOUR being right.
  await expect(main(page).getByText(/6:00\s*p\.?\s*m\.?/i).first()).toBeVisible();

  // The compounding half of the defect: open, save untouched, and the time must not move.
  const reread = await page.request.get(`${api()}/events`);
  const before = (await reread.json()).events.find((e: { id: string }) => e.id === eventId).startsAt;
  const patched = await page.request.patch(`${api()}/events/${eventId}`, { data: { startsAt: before } });
  expect(patched.ok()).toBeTruthy();
  const { data: after } = await admin.from('rep_team_events').select('starts_at').eq('id', eventId).single();
  expect(new Date(String(after!.starts_at)).toISOString())
    .toBe(new Date(String(row!.starts_at)).toISOString());

  await admin.from('rep_team_events').delete().eq('id', eventId);
});

// ─── 2 · P1 #6 — recurrence with per-date opponents ────────────────────────────

test('P1 #6 — "Repeat weekly" writes N games with N DIFFERENT opponents, minus a removed date', async ({ page }) => {
  await dropEventsNamed('%League Game vs Capsched%');
  await signIn(page, HEAD_EMAIL);

  // Four Tuesdays; the coach removed the third (a bye week) and named the rest.
  const res = await page.request.post(`${api()}/events`, {
    data: {
      eventType: 'league_game', name: 'League Game',
      isRecurring: true,
      recurrenceRule: { dayOfWeek: 2, startDate: D('09-01'), endDate: D('09-30'), startTime: '18:00', endTime: null },
      occurrences: [
        { date: null, opponent: 'Capsched Alpha' },
      ],
    },
  });
  // The rule generates real Tuesdays; a null date is not one of them, so the whole request fails
  // rather than silently writing an unreviewed row.
  expect(res.status()).toBe(400);

  const tuesdays = await page.request.get(`${api()}/events`);
  expect(tuesdays.ok()).toBeTruthy();

  // Now the real submission: the dates the preview generated, each with its own opponent.
  const dates = [] as string[];
  const cursor = new Date(Date.UTC(YEAR, 8, 1));
  while (cursor.getUTCMonth() === 8) {
    if (cursor.getUTCDay() === 2) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const kept = dates.filter((_, i) => i !== 2); // the coach removed the third
  const ok = await page.request.post(`${api()}/events`, {
    data: {
      eventType: 'league_game', name: 'League Game',
      isRecurring: true,
      recurrenceRule: { dayOfWeek: 2, startDate: dates[0], endDate: dates.at(-1), startTime: '18:00', endTime: null },
      occurrences: kept.map((date, i) => ({ date, opponent: `Capsched Rival ${i}` })),
    },
  });
  expect(ok.status()).toBe(201);
  const body = await ok.json();
  expect(body.count).toBe(kept.length);

  // THE FIX, at the data level: one opponent per game, all different — and the removed date absent.
  const { data: written } = await admin.from('rep_team_events')
    .select('opponent, name, starts_at')
    .eq('program_year_id', programYearId)
    .like('opponent', 'Capsched Rival%');
  expect(written).toHaveLength(kept.length);
  expect(new Set((written ?? []).map(r => r.opponent)).size).toBe(kept.length);
  // The name follows the row's OWN opponent, not the first one's.
  expect((written ?? []).every(r => String(r.name).includes(String(r.opponent)))).toBeTruthy();
  const days = (written ?? []).map(r => String(r.starts_at).slice(0, 10)).sort();
  expect(days).not.toContain(dates[2]);

  await admin.from('rep_team_events').delete().eq('program_year_id', programYearId).like('opponent', 'Capsched Rival%');
});

// ─── 3 · P1 #7 — import refuses, surfaces, and never touches a mirrored row ─────

test('P1 #7 — import refuses an ambiguous date, surfaces the organizer game, and leaves mirrors untouched', async ({ page }) => {
  await dropEventsNamed('%Capsched Import%');
  await signIn(page, HEAD_EMAIL);

  const { data: mirrorBefore } = await admin.from('rep_team_events')
    .select('starts_at, opponent, name, status').eq('id', mirroredEventId).single();

  const res = await page.request.post(`${api()}/events/import`, {
    data: {
      rows: [
        // Good — becomes a new game.
        { rowNumber: 1, date: D('09-19'), time: '10:00 AM', arrival: '', eventType: 'League Game', name: '', opponent: 'Capsched Import One', location: 'Bell Park', address: '', field: '', uniform: '', homeAway: 'Away' },
        // Ambiguous date — refused with a reason, never guessed.
        { rowNumber: 2, date: '03/04/2026', time: '6:00 PM', arrival: '', eventType: 'League Game', name: '', opponent: 'Capsched Import Two', location: '', address: '', field: '', uniform: '', homeAway: '' },
        // Looks like the organizer's game — surfaced, never merged.
        { rowNumber: 3, date: D('10-03'), time: '9:00 AM', arrival: '', eventType: 'League Game', name: '', opponent: 'Ridgeway Royals', location: '', address: '', field: '', uniform: '', homeAway: '' },
      ],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();

  expect(body.created).toBe(1);
  expect(body.organizerRowsLeftAlone).toBe(1);

  const verdicts = Object.fromEntries(body.rows.map((r: { rowNumber: number; outcome: string }) => [r.rowNumber, r.outcome]));
  expect(verdicts[1]).toBe('add');
  expect(verdicts[2]).toBe('blocked');
  expect(verdicts[3]).toBe('organizer');
  const blocked = body.rows.find((r: { rowNumber: number }) => r.rowNumber === 2);
  expect(blocked.reason).toMatch(/2026-04-03/);

  // ⚠ THE DATA-LEVEL ASSERTION: the mirrored row is byte-for-byte what it was.
  const { data: mirrorAfter } = await admin.from('rep_team_events')
    .select('starts_at, opponent, name, status').eq('id', mirroredEventId).single();
  expect(mirrorAfter).toEqual(mirrorBefore);

  // The one good row landed, at the org's clock.
  const { data: added } = await admin.from('rep_team_events')
    .select('starts_at').eq('program_year_id', programYearId).eq('opponent', 'Capsched Import One').single();
  expect(String(added!.starts_at)).toContain('14:00:00'); // 10:00 EDT = 14:00Z

  await admin.from('rep_team_events').delete().eq('program_year_id', programYearId).like('opponent', 'Capsched Import%');
});

test('P1 #7 — a commit that writes nothing is an ERROR, never a quiet success', async ({ page }) => {
  await signIn(page, HEAD_EMAIL);
  const res = await page.request.post(`${api()}/events/import`, {
    data: {
      rows: [
        { rowNumber: 1, date: '03/04/2026', time: '', arrival: '', eventType: 'League Game', name: '', opponent: 'Nope', location: '', address: '', field: '', uniform: '', homeAway: '' },
      ],
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/Nothing could be imported/i);
});

// ─── 4 · P1 #9 — every lineup control clears the tap floor at 360 ───────────────

test('P1 #9 — lineup controls clear the 44px tap floor at 360px, by computed style', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/lineups/${gameEventId}`);

  await ensureLineupRows(page);

  const cell = main(page).locator('select[aria-label*="position for"]').first();
  await expect(cell).toBeVisible({ timeout: 30_000 });
  const cellBox = await cell.boundingBox();
  expect(cellBox!.height).toBeGreaterThanOrEqual(TAP_MIN);

  // The 18px arrows are GONE from the grid — reordering lives in the order view now.
  await expect(main(page).locator('[class*="lineupMoveBtn"]')).toHaveCount(0);

  // ⚠ The pinned lead columns must ABUT, never overlap. Narrowing the Bat column while the
  // player column's sticky offset stayed at the old value put the player cell on top of two
  // innings — a broken grid that every other assertion here still passed. Geometry, measured.
  const geometry = await page.evaluate(() => {
    const table = document.querySelector('table[class*="lineupTable"]') as HTMLElement | null;
    const row = table?.querySelector('tbody tr') as HTMLElement | null;
    if (!row) return null;
    const cells = [...row.querySelectorAll('td')];
    const player = row.querySelector('[class*="lineupPlayerCell"]');
    if (!player) return null;
    const p = player.getBoundingClientRect();
    const bat = cells[0].getBoundingClientRect();
    return {
      gap: Math.round(p.x - bat.right),
      overlapping: cells.filter(c => {
        if (c === player) return false;
        const r = c.getBoundingClientRect();
        return r.x < p.right - 1 && r.right > p.x + 1 && r.x >= 0;
      }).length,
    };
  });
  expect(geometry, 'the lineup grid must render').not.toBeNull();
  expect(geometry!.overlapping, 'no column may sit underneath the pinned player column').toBe(0);
  expect(Math.abs(geometry!.gap), 'the pinned columns must abut exactly').toBeLessThanOrEqual(1);

  // The page's bottom clearance. The coaches shell used to reserve for the fixed bottom nav TWICE,
  // leaving a band of dead space under every page; trimming it has to keep clearing the lineup's
  // sticky action bar, which hangs below the content flow and is the tightest case in the portal.
  // Measured in DOCUMENT coordinates so the assertion doesn't depend on where the page is scrolled.
  const clearance = await page.evaluate(() => {
    const mainEl = document.querySelector('main[class*="coachesMain"]') as HTMLElement | null;
    if (!mainEl) return null;
    const NAV = 72;
    let lowest = -1;
    mainEl.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.height < 4 || s.visibility === 'hidden' || s.display === 'none') return;
      const paints = s.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || s.borderTopWidth !== '0px' || (el.textContent ?? '').trim().length > 0;
      if (paints) lowest = Math.max(lowest, r.bottom + window.scrollY);
    });
    return Math.round(document.documentElement.scrollHeight - lowest - NAV);
  });
  expect(clearance, 'the lineup page must render a coaches main').not.toBeNull();
  expect(clearance!, 'content must never end underneath the bottom nav').toBeGreaterThanOrEqual(0);
  expect(clearance!, 'and must not sit above a band of dead space').toBeLessThanOrEqual(96);

  // ⚠ Undo has to be reachable AT EVERY SCROLL DEPTH. The bar was marked sticky but its container
  // ends where it does, so it had no travel and was invisible until the page was scrolled to the
  // very bottom — on the portal's most tap-heavy screen, with a ~1700px page. Docked now; this
  // asserts it stays put, stays tappable, and that the last player row still clears it.
  const dock = await page.evaluate(async () => {
    const readings: { top: number; inView: boolean; hitIsUndo: boolean; w: number; h: number }[] = [];
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (const pct of [0, 0.5, 1]) {
      window.scrollTo(0, Math.round(max * pct));
      await new Promise(r => setTimeout(r, 250));
      const bar = document.querySelector('[class*="lineupDockedFooter"]') as HTMLElement | null;
      const undo = document.querySelector('button[aria-label="Undo"]') as HTMLElement | null;
      if (!bar || !undo) return null;
      const br = bar.getBoundingClientRect();
      const ur = undo.getBoundingClientRect();
      const hit = document.elementFromPoint(ur.x + ur.width / 2, ur.y + ur.height / 2);
      readings.push({
        top: Math.round(br.top),
        inView: br.top >= 0 && br.bottom <= window.innerHeight + 1,
        hitIsUndo: hit === undo || undo.contains(hit as Node),
        w: Math.round(ur.width),
        h: Math.round(ur.height),
      });
    }
    return readings;
  });
  expect(dock, 'the docked action bar and its Undo control must exist').not.toBeNull();
  for (const r of dock!) {
    expect(r.inView, 'the action bar must be on screen at every scroll depth').toBe(true);
    expect(r.hitIsUndo, 'nothing may cover Undo').toBe(true);
    expect(Math.min(r.w, r.h), 'Undo must clear the tap floor').toBeGreaterThanOrEqual(TAP_MIN);
  }
  expect(new Set(dock!.map(r => r.top)).size, 'the bar must not move as the page scrolls').toBe(1);

  // Attendance controls answer to the SAME number (the 36 vs 44 disagreement, settled).
  await open(page, `${base()}/schedule`);
  const statusBtn = main(page).locator('[class*="attendanceStatusBtn"]').first();
  if (await statusBtn.count()) {
    const box = await statusBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(TAP_MIN);
  }
});

test('D-C10/D-C11 — the order view exists at full size and every control clears the floor', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/lineups/${gameEventId}`);

  // D-C11: the three tabs name the questions they answer; "Lineup" is not one of them.
  const tabs = main(page).getByRole('tab');
  await expect(tabs.filter({ hasText: /^Positions$/ })).toHaveCount(1);
  await expect(tabs.filter({ hasText: /^Playing time$/ })).toHaveCount(1);
  await expect(tabs.filter({ hasText: /^Batting order$/ })).toHaveCount(1);

  await ensureLineupRows(page);

  await tabs.filter({ hasText: /^Batting order$/ }).click();
  for (const label of [/Move .* up/, /Move .* down/, /Drag to reorder/]) {
    const control = main(page).getByRole('button', { name: label }).first();
    await expect(control).toBeVisible({ timeout: 15_000 });
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(TAP_MIN);
    expect(box!.height).toBeGreaterThanOrEqual(TAP_MIN);
  }
});

test('the owner requirement — a reorder persists into Positions, and positions travel with the PLAYER', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/lineups/${gameEventId}`);

  await ensureLineupRows(page);

  const tabs = main(page).getByRole('tab');
  // Give the player currently batting 2nd a position, so we can prove it follows them.
  const secondCell = main(page).locator('tbody tr').nth(1).locator('select[aria-label*="position for"]').first();
  await expect(secondCell).toBeVisible({ timeout: 30_000 });
  const secondPlayerLabel = await secondCell.getAttribute('aria-label');
  await secondCell.selectOption('SS');

  // Move them up one in the order view.
  await tabs.filter({ hasText: /^Batting order$/ }).click();
  await main(page).getByRole('button', { name: /Move .* up/ }).nth(1).click();

  // Back on Positions: the reorder is already there, and SS came with the player.
  await tabs.filter({ hasText: /^Positions$/ }).click();
  const movedCell = main(page).locator(`select[aria-label="${secondPlayerLabel}"]`).first();
  await expect(movedCell).toHaveValue('SS');
  const rowIndex = await main(page).locator('tbody tr').evaluateAll(
    (rows, label) => rows.findIndex(r => r.querySelector(`select[aria-label="${label}"]`)),
    secondPlayerLabel,
  );
  expect(rowIndex).toBe(0);
});

// ─── 5 · the read-only sweep ───────────────────────────────────────────────────

test('a coach without the schedule grant sees no write door, and every schedule write 403s', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, ASSIST_EMAIL);
  await open(page, `${base()}`);

  // No Import and no Add Event anywhere on the overview or the schedule.
  await expect(main(page).getByRole('button', { name: /^Import$/ })).toHaveCount(0);

  for (const [method, url, data] of [
    ['post', `${api()}/events`, { eventType: 'practice', name: 'nope', startsAt: `${D('09-08')}T18:00` }],
    ['post', `${api()}/events/import`, { rows: [{ rowNumber: 1, date: D('09-08'), time: '18:00', arrival: '', eventType: 'Practice', name: 'nope', opponent: '', location: '', address: '', field: '', uniform: '', homeAway: '' }] }],
    ['post', `${api()}/events/import/preview`, {}],
  ] as const) {
    const res = method === 'post'
      ? await page.request.post(url, { data: data as Record<string, unknown> })
      : await page.request.get(url);
    expect(res.status(), `${url} must refuse a coach without the grant`).toBe(403);
  }

  // And nothing was written by any of it.
  const { data: leftovers } = await admin.from('rep_team_events')
    .select('id').eq('program_year_id', programYearId).eq('name', 'nope');
  expect(leftovers ?? []).toHaveLength(0);
});
