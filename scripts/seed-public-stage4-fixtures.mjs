/** Stage 4 fixtures, DEV only. Dedicated marked clones: existing fixture and demo rows are never changed.
 * node --env-file=.env.local scripts/seed-public-stage4-fixtures.mjs prepare | show | score | no-score | soon | waiting | final | cancelled | withhold | withhold-all | publish | undo
 * Every write reads back. Undo removes only the reserved, marked clones, including a partially prepared run.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY || !new URL(url).hostname.startsWith('npgnrxaitgbtbtvvykto.')) throw new Error('Requires the known DEV project in .env.local; all other projects are refused.');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const mode = process.argv[2] ?? 'show';
if (!['prepare', 'show', 'score', 'no-score', 'soon', 'waiting', 'final', 'cancelled', 'withhold', 'withhold-all', 'publish', 'undo'].includes(mode)) throw new Error('Unknown Stage 4 fixture mode.');
const marker = 'seed-public-stage4-fixtures.mjs';
const file = new URL('../.probe/stage4-fixtures.json', import.meta.url);
const read = async query => { const { data, error } = await query; if (error) throw error; return data; };
const write = async query => { const { error } = await query; if (error) throw error; };
const org = await read(db.from('organizations').select('id,internal_notes').eq('slug', 'stage1-metro-sports').single());
assert.ok(org.internal_notes?.includes('seed-public-frame-fixtures.mjs'), 'Source must be the marked development fixture.');
const localDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const stamp = date => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
const day = n => { const date = new Date(`${localDate(new Date())}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + n); return localDate(date); };
const strip = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['created_at', 'updated_at', 'results_notified_at', 'results_notification_sent_count'].includes(key)));
let saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
if (saved) assert.equal(saved.orgId, org.id, 'Saved fixture organization changed.');
const save = () => { mkdirSync(new URL('../.probe/', import.meta.url), { recursive: true }); writeFileSync(file, JSON.stringify(saved, null, 2)); };
const owned = async fixture => {
  const row = await read(db.from('tournaments').select('id,slug,settings').eq('id', fixture.id).eq('org_id', org.id).maybeSingle());
  if (row) { assert.equal(row.slug, fixture.slug); assert.equal(row.settings?.stage4Fixture, marker); }
  return row;
};

if (mode === 'prepare') {
  assert.ok(!saved, 'A Stage 4 fixture set already exists. Use show or undo before preparing again.');
  const source = await read(db.from('tournaments').select('*').eq('org_id', org.id).eq('slug', 'spring-showcase').single());
  const [divisions, teams, games, venues, facilities] = await Promise.all([
    read(db.from('divisions').select('*').eq('tournament_id', source.id).order('display_order')),
    read(db.from('teams').select('*').eq('tournament_id', source.id)),
    read(db.from('games').select('*').eq('tournament_id', source.id)),
    read(db.from('diamonds').select('*').eq('tournament_id', source.id)),
    read(db.from('venue_facilities').select('*').eq('tournament_id', source.id)),
  ]);
  const pools = divisions.length ? await read(db.from('pools').select('*').in('division_id', divisions.map(d => d.id))) : [];
  assert.ok(divisions.length && teams.length >= 8 && games.some(g => g.bracket_code === 'FIN'), 'Seed the public-frame source first.');
  saved = { orgId: org.id, fixtures: ['live', 'mid-pool', 'seeded', 'eight', 'no-playoffs'].map(kind => ({ kind, id: randomUUID(), slug: `stage4-${kind}` })) };
  save(); // Reserve identities before the first insert so undo can clean a partial preparation.
  for (const fixture of saved.fixtures) {
    const big = fixture.kind === 'eight';
    const exhibition = fixture.kind === 'no-playoffs';
    const ids = new Map();
    const map = old => { if (!old) return null; if (!ids.has(old)) ids.set(old, randomUUID()); return ids.get(old); };
    await write(db.from('tournaments').insert({ ...strip(source), id: fixture.id, slug: fixture.slug,
      name: `Stage 4 · ${fixture.kind}`, status: 'active', is_active: false, list_in_directory: false,
      start_date: day(-1), end_date: day(3), champions_crowned_at: null,
      settings: { ...source.settings, stage4Fixture: marker, format: big ? 'playoff_only' : exhibition ? 'exhibition' : 'round_robin_playoffs' },
    }));
    const divs = big ? divisions.slice(0, 1) : divisions;
    const newDivisions = divs.map(d => ({ ...strip(d), id: map(d.id), tournament_id: fixture.id,
      schedule_visibility: 'published', ...(big ? { name: 'U15', pool_count: 1 } : {}),
      playoff_config: exhibition ? { tieBreakers: ['h2h', 'rd', 'rf', 'ra'] } : big
        ? { type: 'single', format: 'single', teamsQualifying: 8, crossover: 'standard', hasThirdPlace: false } : d.playoff_config,
    }));
    fixture.divisionId = newDivisions[0].id; save();
    await write(db.from('divisions').insert(newDivisions));
    if (!big && pools.length) await write(db.from('pools').insert(pools.map(p => ({ ...strip(p), id: map(p.id), division_id: map(p.division_id) }))));
    const newTeams = (big ? teams.slice(0, 8) : teams).map((t, index) => ({ ...strip(t), id: map(t.id), tournament_id: fixture.id,
      division_id: big ? newDivisions[0].id : map(t.division_id), pool_id: big ? null : map(t.pool_id), status: 'accepted',
      ...(big ? { name: index === 0 ? 'Hamilton-Wentworth Girls Fastpitch Development' : `Stage Four Team ${index + 1}` } : {}),
    }));
    await write(db.from('teams').insert(newTeams));
    if (venues.length) await write(db.from('diamonds').insert(venues.map(v => ({ ...strip(v), id: map(v.id), tournament_id: fixture.id }))));
    if (facilities.length) await write(db.from('venue_facilities').insert(facilities.map(f => ({ ...strip(f), id: map(f.id), tournament_id: fixture.id, venue_id: map(f.venue_id) }))));
    const normalize = g => ({ ...strip(g), id: randomUUID(), tournament_id: fixture.id, division_id: map(g.division_id),
      home_team_id: ids.get(g.home_team_id) ?? null, away_team_id: ids.get(g.away_team_id) ?? null,
      diamond_id: ids.get(g.diamond_id) ?? null, venue_facility_id: ids.get(g.venue_facility_id) ?? null,
      bracket_id: map(g.bracket_id), home_slot_id: null, away_slot_id: null, schedule_facility_lane_id: null,
      score_submitted_by_user_id: null, score_submitted_by_email: null,
      game_date: g.is_playoff ? day(1) : day(-1), game_time: g.is_playoff ? g.bracket_code === 'FIN' ? '16:00:00' : g.bracket_code === 'SF1' ? '10:00:00' : '12:00:00' : '09:00:00',
      ...(g.is_playoff ? { status: 'scheduled', home_score: null, away_score: null } : {}),
    });
    let rows;
    if (big) {
      const sample = games.find(g => g.is_playoff);
      const pairs = [[0, 7], [3, 4], [2, 5], [1, 6]];
      rows = pairs.map(([home, away], index) => ({ ...normalize(sample), division_id: fixture.divisionId,
        home_team_id: newTeams[home].id, away_team_id: newTeams[away].id, home_placeholder: null, away_placeholder: null,
        bracket_id: null, bracket_label: null, round_label: null, bracket_code: `QF${index + 1}`, game_date: day(1), game_time: `${10 + index * 2}:00:00`,
      }));
      for (let i = 0; i < 2; i++) rows.push({ ...normalize(sample), division_id: fixture.divisionId, home_team_id: null, away_team_id: null,
        home_placeholder: `Winner QF${i * 2 + 1}`, away_placeholder: `Winner QF${i * 2 + 2}`,
        bracket_id: null, bracket_label: null, round_label: null, bracket_code: `SF${i + 1}`, game_date: day(2), game_time: `${10 + i * 2}:00:00` });
      rows.push({ ...normalize(sample), division_id: fixture.divisionId, home_team_id: null, away_team_id: null,
        home_placeholder: 'Winner SF1', away_placeholder: 'Winner SF2', bracket_id: null, bracket_label: null, round_label: null,
        bracket_code: 'FIN', game_date: day(3), game_time: '10:00:00' });
    } else {
      rows = games.filter(g => !exhibition || !g.is_playoff).map(normalize);
      if (fixture.kind === 'mid-pool') {
        const counts = new Map();
        rows = rows.map(g => {
          if (g.is_playoff) return g;
          const count = counts.get(g.division_id) ?? 0;
          counts.set(g.division_id, count + 1);
          return count % 2 === 0 ? { ...g, status: 'scheduled', home_score: null, away_score: null, game_date: day(0), game_time: '18:00:00' } : g;
        });
        const selected = rows.filter(g => !g.is_playoff && g.division_id === fixture.divisionId);
        assert.ok(selected.some(g => g.status === 'scheduled') && selected.some(g => g.status === 'completed'));
      }
      if (fixture.kind === 'live') {
        const semis = rows.filter(g => g.is_playoff && /^SF/.test(g.bracket_code ?? '')).sort((a, b) => a.bracket_code.localeCompare(b.bracket_code));
        const final = rows.find(g => g.is_playoff && g.bracket_code === 'FIN');
        assert.equal(semis.length, 2); assert.ok(final);
        for (const sf of semis) Object.assign(sf, { status: 'completed', home_score: 6, away_score: 3, game_date: day(-1) });
        const started = new Date(Date.now() - 10 * 60_000);
        Object.assign(final, { home_team_id: semis[0].home_team_id, away_team_id: semis[1].home_team_id,
          status: 'scheduled', home_score: 3, away_score: 2, game_date: localDate(started), game_time: stamp(started) });
        fixture.liveGameId = final.id; fixture.divisionId = final.division_id; save();
      }
    }
    await write(db.from('games').insert(rows));
    const actual = await read(db.from('games').select('id,status,bracket_code,home_score,away_score,game_date,game_time,home_team_id,away_team_id').eq('tournament_id', fixture.id));
    assert.equal(actual.length, rows.length);
    for (const row of rows) {
      const actualRow = actual.find(g => g.id === row.id);
      for (const key of ['status', 'home_score', 'away_score', 'home_team_id', 'away_team_id', 'game_date']) assert.equal(actualRow[key], row[key]);
      assert.equal(actualRow.game_time?.slice(0, 5), row.game_time?.slice(0, 5));
    }
    if (big) assert.equal(actual.filter(g => /^QF/.test(g.bracket_code)).length, 4);
    if (exhibition) assert.equal(rows.filter(g => g.is_playoff).length, 0);
    console.log(`Prepared ${fixture.kind}: /stage1-metro-sports/${fixture.slug} (${rows.length} games, read back)`);
  }
} else {
  assert.ok(saved, 'Run prepare first.');
  if (mode === 'undo') {
    for (const fixture of saved.fixtures) {
      if (!await owned(fixture)) continue;
      const divisions = await read(db.from('divisions').select('id').eq('tournament_id', fixture.id));
      await write(db.from('games').delete().eq('tournament_id', fixture.id));
      await write(db.from('venue_facilities').delete().eq('tournament_id', fixture.id));
      await write(db.from('diamonds').delete().eq('tournament_id', fixture.id));
      await write(db.from('teams').delete().eq('tournament_id', fixture.id));
      if (divisions.length) await write(db.from('pools').delete().in('division_id', divisions.map(d => d.id)));
      await write(db.from('divisions').delete().eq('tournament_id', fixture.id));
      await write(db.from('tournaments').delete().eq('id', fixture.id).eq('org_id', org.id));
      assert.equal(await owned(fixture), null);
    }
    unlinkSync(file); console.log('All reserved Stage 4 clones removed and read back; source fixtures unchanged.');
  } else if (mode !== 'show') {
    const fixture = saved.fixtures.find(f => f.kind === 'live');
    assert.ok(await owned(fixture));
    if (['withhold', 'withhold-all', 'publish'].includes(mode)) {
      const visibility = mode === 'publish' ? 'published' : 'unpublished';
      const all = mode !== 'withhold';
      const query = db.from('divisions').update({ schedule_visibility: visibility }).eq('tournament_id', fixture.id);
      await write(all ? query : query.eq('id', fixture.divisionId));
      const actual = await read(db.from('divisions').select('id,schedule_visibility').eq('tournament_id', fixture.id));
      const changed = actual.filter(division => all || division.id === fixture.divisionId);
      assert.ok(changed.length);
      for (const division of changed) assert.equal(division.schedule_visibility, visibility);
      console.log(`Publication read-back: ${JSON.stringify(actual)}`);
    } else {
      const rows = await read(db.from('games').select('id,home_team_id,away_team_id,bracket_code').eq('tournament_id', fixture.id).eq('is_playoff', true));
      const semis = rows.filter(g => /^SF/.test(g.bracket_code ?? '')).sort((a, b) => a.bracket_code.localeCompare(b.bracket_code));
      for (const sf of semis) await write(db.from('games').update({ status: mode === 'waiting' && sf === semis[1] ? 'submitted' : 'completed', home_score: 6, away_score: 3, game_date: day(-1) }).eq('id', sf.id).eq('tournament_id', fixture.id));
      const instant = new Date(Date.now() + (mode === 'soon' || mode === 'waiting' ? 30 : -10) * 60_000);
      const fields = { status: mode === 'final' ? 'completed' : mode === 'cancelled' ? 'cancelled' : 'scheduled',
        home_score: ['no-score', 'soon', 'waiting'].includes(mode) ? null : 4, away_score: ['no-score', 'soon', 'waiting'].includes(mode) ? null : 2,
        home_team_id: semis[0].home_team_id, away_team_id: mode === 'waiting' ? null : semis[1].home_team_id,
        game_date: localDate(instant), game_time: stamp(instant),
      };
      await write(db.from('games').update(fields).eq('id', fixture.liveGameId).eq('tournament_id', fixture.id));
      await write(db.from('tournaments').update({ champions_crowned_at: mode === 'final' ? new Date().toISOString() : null }).eq('id', fixture.id).eq('org_id', org.id));
      const crown = await read(db.from('tournaments').select('champions_crowned_at').eq('id', fixture.id).single());
      assert.equal(Boolean(crown.champions_crowned_at), mode === 'final');
      const actual = await read(db.from('games').select(Object.keys(fields).join(',')).eq('id', fixture.liveGameId).single());
      for (const [key, value] of Object.entries(fields)) assert.equal(key === 'game_time' ? actual[key]?.slice(0, 5) : actual[key], value);
    }
    console.log(`${mode}: written and read back`);
  }
}
if (mode !== 'undo') for (const fixture of saved.fixtures) {
  assert.ok(await owned(fixture), `Missing ${fixture.kind}; use undo to clean a partial preparation.`);
  const [games, divisions, tournament] = await Promise.all([
    read(db.from('games').select('id,status,bracket_code,home_score,away_score,game_date,game_time').eq('tournament_id', fixture.id).eq('is_playoff', true)),
    read(db.from('divisions').select('name,schedule_visibility').eq('tournament_id', fixture.id)),
    read(db.from('tournaments').select('champions_crowned_at').eq('id', fixture.id).single()),
  ]);
  console.log(JSON.stringify({ kind: fixture.kind, path: `/stage1-metro-sports/${fixture.slug}`, divisions,
    championsCrownedAt: tournament.champions_crowned_at, games }));
}
