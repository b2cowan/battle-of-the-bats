/** Manual Stage 6 DEV fixtures, following Stage 4/5's reserved marked-clone pattern.
 * node --env-file=.env.local scripts/seed-public-stage6-fixtures.mjs prepare|resume|show|content-on|news-on|news-off|rules-on|rules-off|withhold-one|publish-one|registration-close|registration-open
 * Reads Stage 4's source without changing it; reserves IDs before writes; every insert reads back.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(endpoint && new URL(endpoint).hostname === 'npgnrxaitgbtbtvvykto.supabase.co' && process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Only the known development database is permitted.');
const db = createClient(endpoint, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const mode = process.argv[2] ?? 'show';
assert.ok(['prepare', 'resume', 'show', 'content-on', 'news-on', 'news-off', 'rules-on', 'rules-off',
  'withhold-one', 'publish-one', 'registration-close', 'registration-open'].includes(mode));
const marker = 'seed-public-stage6-fixtures.mjs';
const file = new URL('../.probe/stage6-fixtures.json', import.meta.url);
let saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const read = async query => { const { data, error } = await query; if (error) throw error; return data; };
const save = () => { mkdirSync(new URL('../.probe/', import.meta.url), { recursive: true }); writeFileSync(file, JSON.stringify(saved, null, 2)); };
const clean = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['created_at', 'updated_at', 'results_notified_at', 'results_notification_sent_count'].includes(key)));
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const org = await read(db.from('organizations').select('id,internal_notes').eq('slug', 'stage1-metro-sports').single());
assert.ok(org.internal_notes?.includes('seed-public-frame-fixtures.mjs'));
if (saved) assert.equal(saved.orgId, org.id);

async function owned(fixture) {
  const row = await read(db.from('tournaments').select('id,slug,settings').eq('id', fixture.id).eq('org_id', org.id).single());
  assert.equal(row.slug, fixture.slug);
  assert.equal(row.settings?.stage6Fixture, marker);
}
async function insert(table, rows) {
  if (!rows.length) return;
  await read(db.from(table).insert(rows));
  const actual = await read(db.from(table).select('id').in('id', rows.map(row => row.id)));
  assert.deepEqual(actual.map(row => row.id).sort(), rows.map(row => row.id).sort());
}

if (mode === 'prepare' || mode === 'resume') {
  if (mode === 'prepare') assert.equal(saved, null, 'Stage 6 reserved fixtures already exist; use show or resume.');
  else assert.ok(saved, 'No reserved fixtures to resume.');
  const source = await read(db.from('tournaments').select('*').eq('org_id', org.id).eq('slug', 'stage4-live').single());
  assert.equal(source.settings?.stage4Fixture, 'seed-public-stage4-fixtures.mjs');
  const [divisions, teams, games] = await Promise.all([
    read(db.from('divisions').select('*').eq('tournament_id', source.id).order('display_order')),
    read(db.from('teams').select('*').eq('tournament_id', source.id)),
    read(db.from('games').select('*').eq('tournament_id', source.id)),
  ]);
  const final = games.find(game => game.is_playoff && game.bracket_code === 'FIN');
  assert.ok(divisions.length && teams.length >= 4 && final);
  saved ??= { orgId: org.id, fixtures: ['one', 'several', 'none', 'partial', 'held', 'register-open', 'register-closed', 'register-waitlist']
    .map(kind => ({ kind, id: randomUUID(), slug: `stage6-${kind}` })) };
  save();
  for (const fixture of saved.fixtures) {
    if (fixture.expectedCards !== undefined) { await owned(fixture); continue; }
    const registration = fixture.kind.startsWith('register-');
    const finished = ['one', 'several'].includes(fixture.kind);
    const multiple = ['several', 'partial', 'held'].includes(fixture.kind);
    const settings = { ...source.settings, stage6Fixture: marker, format: 'round_robin_playoffs' };
    delete settings.stage4Fixture;
    const prior = await read(db.from('tournaments').select('id').eq('id', fixture.id).maybeSingle());
    if (prior) {
      await owned(fixture);
      // Recover only an unfinished, reserved clone. Completed fixtures and source fixtures are never reset.
      for (const table of ['games', 'teams', 'divisions']) {
        await read(db.from(table).delete().eq('tournament_id', fixture.id));
        assert.equal((await read(db.from(table).select('id').eq('tournament_id', fixture.id))).length, 0);
      }
    } else await insert('tournaments', [{ ...clean(source), id: fixture.id, name: `Stage 6 QA · ${fixture.kind}`, slug: fixture.slug,
      status: 'active', is_active: false, list_in_directory: false, start_date: day(registration ? 14 : -3), end_date: day(registration ? 16 : -1),
      champions_crowned_at: finished ? new Date().toISOString() : null, notify_teams_on_complete: false,
      contact_email: null, default_contact_member_id: null, contact_show_on_public: false, public_hidden_pages: [], settings }]);
    await owned(fixture);
    const newDivisions = [], newTeams = [], newGames = [];
    for (let index = 0; index < (multiple ? 2 : 1); index++) {
      const divisionId = randomUUID();
      const held = fixture.kind === 'held' && index === 1;
      newDivisions.push({ ...clean(divisions[0]), id: divisionId, tournament_id: fixture.id, name: index ? 'U13' : 'U11',
        display_order: index, contact_member_id: null, pool_count: 1, pool_names: null, requires_pool_selection: false,
        is_closed: fixture.kind === 'register-closed', capacity: fixture.kind === 'register-waitlist' ? 2 : 16,
        schedule_visibility: held ? 'unpublished' : 'published' });
      const tiers = fixture.kind === 'several' && index === 0 ? ['Gold', 'Silver'] : [null];
      for (const [tierIndex, tier] of tiers.entries()) {
        const pair = teams.slice(tierIndex * 2, tierIndex * 2 + 2).map((team, side) => ({ ...clean(team),
          id: randomUUID(), tournament_id: fixture.id, division_id: divisionId, pool_id: null, slot_id: null, status: 'accepted',
          name: `${held ? 'Held-back' : index ? 'U13' : 'U11'} ${tier ?? ''} ${side ? 'Sample Runners-up' : 'Greater Riverdale Northern Lights Select Black (Johnstone)'}`.replace(/  /g, ' '),
          coach: 'QA Coach', email: 'stage6-qa@example.invalid', coach_email: null, admin_notes: 'STAGE6_PRIVATE_TEAM_NOTE',
          check_in_notes: null, payment_status: 'unpaid', deposit_paid: 0, total_paid: 0 }));
        newTeams.push(...pair);
        if (registration) continue;
        const pending = fixture.kind === 'none' || (fixture.kind === 'partial' && index === 1);
        newGames.push({ ...clean(final), id: randomUUID(), tournament_id: fixture.id, division_id: divisionId,
          home_team_id: pair[0].id, away_team_id: pair[1].id, game_date: day(-1), game_time: '15:00:00',
          status: pending ? 'scheduled' : 'completed', home_score: pending ? null : 7, away_score: pending ? null : 4,
          bracket_id: randomUUID(), bracket_label: tier, bracket_code: 'FIN', home_slot_id: null, away_slot_id: null,
          diamond_id: null, venue_facility_id: null, schedule_facility_lane_id: null,
          score_submitted_by_user_id: null, score_submitted_by_email: null, notes: 'STAGE6_PRIVATE_GAME_NOTE' });
      }
    }
    await insert('divisions', newDivisions);
    await insert('teams', newTeams);
    await insert('games', newGames);
    const actual = await read(db.from('games').select('id,status,home_score,away_score').eq('tournament_id', fixture.id));
    assert.equal(actual.length, newGames.length);
    for (const game of newGames) {
      const got = actual.find(row => row.id === game.id);
      for (const key of ['status', 'home_score', 'away_score']) assert.equal(got[key], game[key]);
    }
    fixture.expectedCards = finished ? newGames.length : 0;
    save();
  }
}
assert.ok(saved, 'Run prepare first.');
const contentFixture = saved.fixtures.find(fixture => fixture.kind === 'register-open');
if (['content-on', 'news-on', 'news-off', 'rules-on', 'rules-off'].includes(mode)) {
  await owned(contentFixture);
  contentFixture.contentIds ??= { news: randomUUID(), rule: randomUUID(), item: randomUUID(), resource: randomUUID() };
  save();
  const ids = contentFixture.contentIds;
  async function ensure(table, row) {
    if (!(await read(db.from(table).select('id').eq('id', row.id).maybeSingle()))) await insert(table, [row]);
  }
  if (mode === 'content-on' || mode === 'news-on') await ensure('announcements', {
    id: ids.news, tournament_id: contentFixture.id, title: '[Stage 6 QA] Welcome to the sample event',
    body: 'Sample public news for the Stage 6 owner walk. Check the tournament tabs for rules and registration.',
    published_at: new Date().toISOString(), pinned: true, channel_site: true, channel_email: false,
  });
  if (mode === 'news-off') {
    await read(db.from('announcements').delete().eq('id', ids.news).eq('tournament_id', contentFixture.id));
    assert.equal((await read(db.from('announcements').select('id').eq('id', ids.news))).length, 0);
  }
  if (mode === 'content-on' || mode === 'rules-on') {
    await ensure('rules', { id: ids.rule, tournament_id: contentFixture.id, title: '[Stage 6 QA] Conduct', display_order: 0 });
    await ensure('rule_items', { id: ids.item, rule_id: ids.rule, content: 'Respect officials, opponents and volunteers.', display_order: 0 });
    await ensure('resources', { id: ids.resource, tournament_id: contentFixture.id,
      label: '[Stage 6 QA] Sample resource', url: 'https://example.com/', display_order: 0 });
  }
  if (mode === 'rules-off') {
    await read(db.from('rule_items').delete().eq('id', ids.item).eq('rule_id', ids.rule));
    for (const [table, id] of [['resources', ids.resource], ['rules', ids.rule]]) {
      await read(db.from(table).delete().eq('id', id).eq('tournament_id', contentFixture.id));
      assert.equal((await read(db.from(table).select('id').eq('id', id))).length, 0);
    }
  }
  if (mode === 'content-on') {
    const resourceOnly = saved.fixtures.find(fixture => fixture.kind === 'register-closed');
    await owned(resourceOnly);
    resourceOnly.resourceId ??= randomUUID(); save();
    await ensure('resources', { id: resourceOnly.resourceId, tournament_id: resourceOnly.id,
      label: '[Stage 6 QA] Resource-only Rules page', url: 'https://example.com/', display_order: 0 });
  }
}
if (['withhold-one', 'publish-one'].includes(mode)) {
  const fixture = saved.fixtures.find(fixture => fixture.kind === 'one');
  await owned(fixture);
  const before = await read(db.from('tournaments').select('champions_crowned_at').eq('id', fixture.id).single());
  assert.ok(before.champions_crowned_at, 'This check requires the existing crown stamp.');
  const visibility = mode === 'withhold-one' ? 'unpublished' : 'published';
  await read(db.from('divisions').update({ schedule_visibility: visibility }).eq('tournament_id', fixture.id));
  const rows = await read(db.from('divisions').select('schedule_visibility').eq('tournament_id', fixture.id));
  assert.ok(rows.length && rows.every(row => row.schedule_visibility === visibility));
  const after = await read(db.from('tournaments').select('champions_crowned_at').eq('id', fixture.id).single());
  assert.equal(after.champions_crowned_at, before.champions_crowned_at);
}
if (['registration-close', 'registration-open'].includes(mode)) {
  await owned(contentFixture);
  const before = await read(db.from('tournaments').select('start_date,end_date').eq('id', contentFixture.id).single());
  contentFixture.registrationWindowBackup ??= before; save();
  const dates = mode === 'registration-close'
    ? { ...contentFixture.registrationWindowBackup, start_date: day(-1) } : contentFixture.registrationWindowBackup;
  await read(db.from('tournaments').update(dates).eq('id', contentFixture.id).eq('org_id', org.id));
  const actual = await read(db.from('tournaments').select('start_date,end_date').eq('id', contentFixture.id).single());
  assert.deepEqual(actual, dates);
}
for (const fixture of saved.fixtures) {
  await owned(fixture);
  const [tournament, divisions, news, rules, resources] = await Promise.all([
    read(db.from('tournaments').select('start_date,champions_crowned_at').eq('id', fixture.id).single()),
    read(db.from('divisions').select('schedule_visibility,is_closed').eq('tournament_id', fixture.id)),
    read(db.from('announcements').select('id').eq('tournament_id', fixture.id).eq('channel_site', true).is('deleted_at', null)),
    read(db.from('rules').select('id').eq('tournament_id', fixture.id)),
    read(db.from('resources').select('id').eq('tournament_id', fixture.id)),
  ]);
  console.log(`${fixture.kind}: /stage1-metro-sports/${fixture.slug}/${fixture.kind.startsWith('register-') ? 'register' : 'champions'}; ` +
    `start=${tournament.start_date}; crown=${Boolean(tournament.champions_crowned_at)}; schedules=${divisions.map(row => row.schedule_visibility).join(',')}; ` +
    `closedDivisions=${divisions.filter(row => row.is_closed).length}; news=${news.length}; rules=${rules.length}; resources=${resources.length}`);
}
