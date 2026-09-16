import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * SKILLS & GOALS — find and define (development lifecycle Phase 1, mockup screens 1 + 2; built
 * 2026-09-12). The exit condition (plan §10): a coach can define a test with its aim and method,
 * define a skill, find a less-used metric on the Players view, and reach a named player's Goals
 * or Results view from a link that returns them to where they were; legacy records read honestly.
 *
 * ⚠ METHOD. Status and payload assertions on the routes, plus a few RENDERED probes over the
 * populated UAT fixture (a green sweep over an empty fixture proves nothing — §58). `innerText`
 * applies `text-transform`, so both sides of a text comparison are lower-cased.
 *
 * ⚠ WRITES ONLY WHAT IT TAKES BACK. The definitions this file creates are named "Probe …" and
 * removed at the end (their probe readings taken back first, so the RESTRICT FK cannot object), and
 * the fixed-unit walk is run on a probe test of its own (never on the fixture's sprint, whose
 * readings the owner walk pins). A leftover "Probe" definition from a crashed run is reported, not
 * worked around.
 *
 * Runs on the shared UAT fixture (`uat-test-org`). By file path, never `-g`:
 *   npx playwright test --config playwright.config.ts tests/uat/scenarios/coach-development-metrics.spec.ts
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

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_PROJECT_REF)) {
  throw new Error('coach-development-metrics.spec.ts refuses to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION.');
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ORG_SLUG = process.env.UAT_ORG_SLUG!;
const COACH = process.env.UAT_COACH_EMAIL!;
const PASSWORD = process.env.UAT_COACH_PASSWORD!;

let teamId = '';
let devonId = '';
let sprintId = '';

test.beforeAll(async () => {
  const { data: org } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  const { data: team } = await admin.from('rep_teams').select('id').eq('org_id', org!.id).eq('name', 'UAT Test Team').single();
  teamId = team!.id;
  const { data: py } = await admin.from('rep_program_years')
    .select('id').eq('team_id', teamId).eq('status', 'active').order('year', { ascending: false }).limit(1).single();
  const { data: devon } = await admin.from('rep_roster_players')
    .select('id').eq('program_year_id', py!.id).eq('player_first_name', 'Devon').eq('player_last_name', 'Test').limit(1).single();
  devonId = devon!.id;
  const { data: sprint } = await admin.from('rep_team_measurable_types')
    .select('id').eq('team_id', teamId).ilike('name', '60-yd sprint').eq('is_active', true).limit(1).single();
  sprintId = sprint!.id;
  // A crashed run leaves probe definitions behind — say so rather than work around it.
  const { data: strays } = await admin.from('rep_team_measurable_types').select('name').eq('team_id', teamId).ilike('name', 'Probe %');
  if (strays && strays.length > 0) {
    throw new Error(`Leftover probe definitions from a crashed run: ${strays.map(s => s.name).join(', ')} — retire them from Metrics before re-running.`);
  }
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}
const api = () => `/api/coaches/${ORG_SLUG}/teams/${teamId}/development/measurable-types`;
const base = () => `/${ORG_SLUG}/coaches/teams/${teamId}`;
async function call(page: Page, method: 'get' | 'post' | 'patch' | 'delete', url: string, data?: unknown) {
  const res = await page.request[method](url, { data, timeout: 60_000 });
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body };
}
const created: string[] = [];

test.describe('the definition contract, through the routes', () => {
  test('defines a test with its aim and method, a range test, and a skill; a legacy row reads honestly', async ({ page }) => {
    await signIn(page, COACH);

    const list = await call(page, 'get', `${api()}?all=1`);
    expect(list.status).toBe(200);
    const types = list.body.types as Array<Record<string, unknown>>;
    const throwSpeed = types.find(t => t.name === 'Throw speed')!;
    expect(throwSpeed.aim).toBe('record');
    expect(throwSpeed.method).toBeNull();
    expect(throwSpeed.headline).toBe('last');
    const skill = types.find(t => t.name === 'Sets feet before throwing')!;
    expect(skill.kind).toBe('skill');
    expect(skill.unit).toBeNull();
    expect((skill.descriptors as string[]).length).toBe(3);

    const test1 = await call(page, 'post', api(), {
      name: 'Probe throw distance', unit: 'feet', aim: 'higher', method: 'From the line, three steps.', attemptsPerSession: 3,
    });
    expect(test1.status).toBe(201);
    const t1 = test1.body.type as Record<string, unknown>;
    created.push(t1.id as string);
    expect(t1.headline).toBe('best');
    expect(t1.aim).toBe('higher');

    const range = await call(page, 'post', api(), {
      name: 'Probe changeup', unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68, method: 'Radar gun.', attemptsPerSession: 3,
    });
    expect(range.status).toBe(201);
    created.push((range.body.type as Record<string, unknown>).id as string);
    expect((range.body.type as Record<string, unknown>).headline).toBe('in_range');

    const badRange = await call(page, 'post', api(), { name: 'Probe bad', unit: 'mph', aim: 'range', rangeFrom: 68, rangeTo: 62 });
    expect(badRange.status).toBe(400);

    const skillDef = await call(page, 'post', api(), { kind: 'skill', name: 'Probe skill', descriptors: ['With support', 'Independently'] });
    expect(skillDef.status).toBe(201);
    created.push((skillDef.body.type as Record<string, unknown>).id as string);
    expect((skillDef.body.type as Record<string, unknown>).unit).toBeNull();

    // A skill takes no number, and no session can be started against skills alone (the sprint exists, so this one is about the reading).
    const reading = await call(page, 'post', `/api/coaches/${ORG_SLUG}/teams/${teamId}/roster/${devonId}/development/measurables`,
      { measurableTypeId: (skillDef.body.type as Record<string, unknown>).id, value: 3, recordedOn: new Date().toISOString().slice(0, 10) }); // utc-intentional: any valid date
    expect(reading.status).toBe(400);
  });

  test('the unit is fixed once a result exists (owner, 2026-09-15): rename, method and aim keep the series; a unit change is refused; delete is for a definition nothing points at', async ({ page }) => {
    await signIn(page, COACH);
    // A probe test WITH a reading of its own — the fixture's sprint is the owner's, never the probe's.
    const made = await call(page, 'post', api(), { name: 'Probe series', unit: 'seconds', aim: 'lower', method: 'Standing start.' });
    expect(made.status).toBe(201);
    const probeId = (made.body.type as Record<string, unknown>).id as string;
    created.push(probeId);
    // Without a result the unit is an ordinary edit.
    const earlyUnit = await call(page, 'patch', `${api()}/${probeId}`, { unit: 's' });
    expect(earlyUnit.status).toBe(200);
    expect((earlyUnit.body.type as Record<string, unknown>).unit).toBe('s');
    const backAgain = await call(page, 'patch', `${api()}/${probeId}`, { unit: 'seconds' });
    expect(backAgain.status).toBe(200);

    const today = new Date().toISOString().slice(0, 10); // utc-intentional: any valid date will do for a probe reading
    const read = await call(page, 'post', `/api/coaches/${ORG_SLUG}/teams/${teamId}/roster/${devonId}/development/measurables`,
      { measurableTypeId: probeId, value: 9.1, recordedOn: today, note: 'metrics probe' });
    expect(read.status).toBe(201);
    const entryId = (read.body.entry as { id: string }).id;

    // The editor's read says so.
    const editorRead = await call(page, 'get', `${api()}/${probeId}`);
    expect(editorRead.body.hasReadings).toBe(true);
    expect(editorRead.body.hasRecords).toBe(true);
    // Rename keeps the series.
    const renamed = await call(page, 'patch', `${api()}/${probeId}`, { name: 'Probe series (renamed)' });
    expect(renamed.status).toBe(200);
    // A method change keeps the series (owner, 2026-09-14) — it is the coach's note, never a fork.
    const methodChange = await call(page, 'patch', `${api()}/${probeId}`, { method: 'Flying start.' });
    expect(methodChange.status).toBe(200);
    // Aim and attempts never fork.
    const aimChange = await call(page, 'patch', `${api()}/${probeId}`, { aim: 'higher', attemptsPerSession: 2 });
    expect(aimChange.status).toBe(200);
    // A unit change is refused, in the one sentence, and nothing changed — no successor, no retire.
    const unitChange = await call(page, 'patch', `${api()}/${probeId}`, { unit: 'ms' });
    expect(unitChange.status).toBe(400);
    expect(unitChange.body.error).toContain('retire this test and start a new one');
    const after = await call(page, 'get', `${api()}/${probeId}`);
    expect((after.body.type as Record<string, unknown>).unit).toBe('seconds');
    expect((after.body.type as Record<string, unknown>).isActive).toBe(true);
    // A definition with a record cannot be deleted — it is retired instead.
    const refused = await call(page, 'delete', `${api()}/${probeId}`);
    expect(refused.status).toBe(409);
    // The reading stays where it was, in its unit.
    const profile = await call(page, 'get', `/api/coaches/${ORG_SLUG}/teams/${teamId}/roster/${devonId}/development`);
    const entry = (profile.body.measurables as Array<{ id: string; unit: string; measurableTypeId: string }>).find(m => m.id === entryId)!;
    expect(entry.unit).toBe('seconds');
    expect(entry.measurableTypeId).toBe(probeId);

    // Take the probe reading back (the routes, never the database) — and now nothing points at it,
    // so the route deletes it.
    const gone = await call(page, 'delete', `/api/coaches/${ORG_SLUG}/teams/${teamId}/roster/${devonId}/development/measurables/${entryId}`);
    expect(gone.status).toBe(200);
    const emptied = await call(page, 'get', `${api()}/${probeId}`);
    expect(emptied.body.hasRecords).toBe(false);

    // PLAN it on a probe session first (the sprint beside it, nothing recorded against either), so
    // the delete has a plan to drop it from — and the session must not keep naming a test that is gone.
    const sessionsApi = `/api/coaches/${ORG_SLUG}/teams/${teamId}/development/sessions`;
    const session = await call(page, 'post', sessionsApi, {
      sessionDate: today, note: 'metrics probe session',
      scope: { metricIds: [sprintId, probeId], playerIds: [devonId], attempts: { [sprintId]: 1, [probeId]: 2 } },
    });
    expect(session.status).toBe(201);
    const sessionId = (session.body.session as { id: string }).id;
    try {
      const deleted = await call(page, 'delete', `${api()}/${probeId}`);
      expect(deleted.status).toBe(200);
      expect((await call(page, 'get', `${api()}/${probeId}`)).status).toBe(404);
      created.splice(created.indexOf(probeId), 1);
      const { data: planAfter } = await admin.from('rep_team_evaluation_sessions').select('scope_metric_ids, scope_attempts').eq('id', sessionId).single();
      expect(planAfter!.scope_metric_ids).toEqual([sprintId]);
      expect(planAfter!.scope_attempts).toEqual({ [sprintId]: 1 });
    } finally {
      // The probe session goes through its own route (a session with nothing recorded deletes clean).
      expect((await call(page, 'delete', `${sessionsApi}/${sessionId}`)).status).toBe(200);
    }
  });
});

test.describe('the three views and the exact addresses, rendered', () => {
  test('the Sessions tab carries the tour anchor (the Overview is the landing since stage 0); the hub has no Players tab; Coverage in Insights is the one roster table, with the chosen metric and ITS date; the way back returns', async ({ page }) => {
    await signIn(page, COACH);
    await page.goto(`${base()}/development?section=sessions`);
    await expect(page.locator('[data-sandbox-tour="development-sessions"]')).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Skills and Goals views' });
    await expect(tabs.getByRole('link', { name: 'Metrics' })).toBeVisible();
    // Re-evaluation stage 4 (G1): the Players tab is gone; its old address lands on the Overview.
    await expect(tabs.getByRole('link', { name: 'Players' })).toHaveCount(0);
    await page.goto(`${base()}/development?section=players`);
    await expect(page.getByText('Everything in Skills & Goals')).toBeVisible();

    // The board's old address lands on the one roster table — Insights → Coverage.
    await page.goto(`${base()}/development/board`);
    await page.waitForURL(url => url.pathname.endsWith('/history') && url.searchParams.get('section') === 'development', { timeout: 30_000 });

    // Show Throw speed: Devon's row shows the km/h result and the date it was recorded on.
    const throwSpeed = (await call(page, 'get', `${api()}?all=1`)).body.types as Array<{ id: string; name: string }>;
    const ts = throwSpeed.find(t => t.name === 'Throw speed')!;
    const coverage = `${base()}/history?section=development&metric=${ts.id}`;
    await page.goto(coverage);
    const devonRow = page.locator('tr', { hasText: 'Devon Test' });
    await expect(devonRow).toBeVisible();
    expect((await devonRow.innerText()).toLowerCase()).toContain('84 km/h');
    // A player with nothing under this metric is ONE dash — the legend under the table says what it means.
    const caseyRow = page.locator('tr', { hasText: 'Casey Test' });
    expect((await caseyRow.innerText())).toContain('—');
    await expect(page.getByText(/— no result this season/)).toBeVisible();
    // The count line is the first thing under the toolbar; the retired prose is gone.
    await expect(page.getByText(/of 12 players (has|have) a Throw speed result this season/)).toBeVisible();
    await expect(page.getByText('Set goals and record in Skills & Goals →')).toHaveCount(0);
    await expect(page.getByText('Returning player')).toHaveCount(0);
    // The head coach holds the grant, so the door to the room is offered under the table.
    await expect(page.getByRole('link', { name: 'Record in Skills & Goals →' })).toBeVisible();

    // The name is a link into the record's Results view, carrying the metric and the way back.
    const href = await devonRow.getByRole('link', { name: /Devon Test/ }).getAttribute('href');
    expect(href).toContain('section=development');
    expect(href).toContain('view=results');
    expect(href).toContain(`metric=${ts.id}`);
    expect(decodeURIComponent(href!)).toContain(`return=${coverage}`);
    await page.goto(href!);
    await expect(page.locator('#development')).toBeVisible();
    // The header's way back names where the coach came from and returns there.
    const back = page.getByRole('link', { name: 'Back to Insights' });
    await expect(back).toBeVisible();
    expect(await back.getAttribute('href')).toBe(coverage);

    // Current focus — the goals as words — is Coverage's first Show choice, with Internal notes.
    await page.goto(`${base()}/history?section=development&metric=focus`);
    const devonFocus = page.locator('tr', { hasText: 'Devon Test' });
    await expect(devonFocus).toBeVisible();
    expect(await devonFocus.innerText()).toContain('First-step quickness off the bag');
    await expect(page.getByText(/of 12 players (has|have) a goal being worked on/)).toBeVisible();
  });

  test('Metrics lists every definition with what a record means; the retired rows are the same table', async ({ page }) => {
    await signIn(page, COACH);
    await page.goto(`${base()}/development?section=metrics`);
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    const text = (await table.innerText()).toLowerCase();
    expect(text).toContain('throw speed');
    // The method is the coach's note, never a claim on the row, and a test without one is not a to-do (owner, 2026-09-14).
    expect(text).not.toContain('method');
    expect(text).not.toContain('unfinished');
    expect(text).toContain('lower is the aim');
    // One word per kind (stage 1, B1): the row reads "Sets feet before throwing · skill".
    expect(text).toContain('· skill');
    expect(text).not.toContain('observed skill');
    expect(text).not.toContain('measured test');
    expect(text).toContain('aim: 62–68 mph');
    // The retired fold opens on the SAME table — rows, not pills — each saying it is retired.
    await page.getByText(/^Retired \(\d+\)$/).click();
    const retiredTable = page.locator('details table');
    await expect(retiredTable).toBeVisible();
    const retiredText = (await retiredTable.innerText()).toLowerCase();
    expect(retiredText).toContain('shuttle run · seconds');
    expect(retiredText).toContain('retired');
    // The definition is a SHEET over the Metrics tab (stage 1): the old page address redirects into
    // `?edit=`, the sheet opens on a definition with results and shows the rule and the live read-back.
    await page.goto(`${base()}/development/metrics/${sprintId}`);
    await expect(page).toHaveURL(/section=metrics&edit=/);
    const sheet = page.getByRole('dialog').first();
    await expect(sheet.getByRole('heading', { name: '60-yd sprint' })).toBeVisible();
    await expect(sheet.getByLabel('Method')).toHaveValue(/Standing start/);
    await expect(sheet.getByText(/Changing a definition later/)).toBeVisible();
    await expect(sheet.getByText(/Reads back as/)).toContainText('lower is the aim');
    // Preview is a modal over the sheet, and it never promises "faster".
    await sheet.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByRole('dialog').nth(1);
    await expect(preview.getByText(/seconds lower since the earlier date/)).toBeVisible();
    await expect(preview.getByText(/never “faster”/)).toBeVisible();
    await preview.getByRole('button', { name: 'Close' }).click();
    // A clean Cancel lands back on the Metrics tab with no sheet.
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/section=metrics$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.afterAll(async () => {
  // Remove every probe definition this file created. A probe's readings were taken back above, so
  // the RESTRICT FK cannot object — and leaving them retired would put four "Probe …" rows in the
  // Retired disclosure the owner walks.
  for (const id of created) {
    const del = await admin.from('rep_team_measurable_types').delete().eq('id', id).eq('team_id', teamId);
    expect(del.error, ).toBeNull();
  }
  const { data: strayReadings } = await admin.from('rep_player_measurables').select('id').eq('note', 'metrics probe');
  expect(strayReadings ?? []).toHaveLength(0);
});
