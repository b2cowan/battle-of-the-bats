/** Stage 3 layout fixtures, DEV only. Reversible changes to the existing marked Lakeshore fixture, never the demo.
 * node --env-file=.env.local scripts/seed-public-stage3-fixtures.mjs prepare | show | undo
 * After prepare: score | final | unofficial | cancelled | no-score | soon (the same semifinal; every write reads back).
 * prepare: seven pool-play dates + one scored live playoff game; the final moves to three hours after it (a final never
 * starts before the semifinals that feed it). show is the read-back; undo restores the saved rows.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY || url.includes('qcttcboqysynwcdyghil')) throw new Error('Requires the DEV .env.local; production is refused.');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const mode = process.argv[2] ?? 'show';
const faces = ['score', 'final', 'unofficial', 'cancelled', 'no-score', 'soon'];
if (!['prepare', 'show', 'undo', ...faces].includes(mode)) throw new Error('Use prepare, show, undo, score, final, unofficial, cancelled, no-score or soon.');
const backup = new URL('../.probe/stage3-fixture-undo.json', import.meta.url);
const columns = 'id,game_date,game_time,status,home_score,away_score';
async function read(query) { const { data, error } = await query; if (error) throw error; return data; }
async function write(query) { const { error } = await query; if (error) throw error; }
const org = await read(db.from('organizations').select('id,internal_notes').eq('slug', 'stage1-lakeshore-lightning').single());
if (!org.internal_notes?.includes('seed-public-frame-fixtures.mjs')) throw new Error('Not the marked development fixture.');
const tournament = await read(db.from('tournaments').select('id,start_date,end_date').eq('org_id', org.id).eq('slug', 'fall-classic').single());
let games = await read(db.from('games').select(`${columns},is_playoff,home_team_id,away_team_id,bracket_code`).eq('tournament_id', tournament.id).order('id'));
const pool = games.filter(g => !g.is_playoff).slice(0, 7);
const live = games.find(g => g.is_playoff && g.home_team_id && g.away_team_id && /^SF/.test(g.bracket_code ?? ''));
const localDate = instant => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
const today = localDate(new Date());
const addDays = n => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return localDate(d); };
const savedGame = g => Object.fromEntries(columns.split(',').map(k => [k, g[k]]));
const stamp = instant => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
// The final waits on the semifinals, so it moves with them: three hours after the semifinal this run puts at `instant`.
const finalGame = games.find(g => g.is_playoff && g.bracket_code === 'FIN');
function saveFinal() {
  const saved = JSON.parse(readFileSync(backup, 'utf8'));
  if (!finalGame || saved.games.some(g => g.id === finalGame.id)) return;
  saved.games.push(savedGame(finalGame));
  writeFileSync(backup, JSON.stringify(saved, null, 2));
}
async function moveFinalAfterSemifinals(instant) {
  if (!finalGame) return;
  const later = new Date(instant.getTime() + 3 * 60 * 60_000);
  await write(db.from('games').update({ game_date: localDate(later), game_time: stamp(later) }).eq('id', finalGame.id).eq('tournament_id', tournament.id));
  const playoffs = (await read(db.from('games').select('game_date,game_time,bracket_code').eq('tournament_id', tournament.id).eq('is_playoff', true)));
  const at = g => `${g.game_date} ${g.game_time?.slice(0, 5)}`;
  const final = playoffs.find(g => g.bracket_code === 'FIN');
  for (const sf of playoffs.filter(g => /^SF/.test(g.bracket_code ?? ''))) assert.ok(at(sf) < at(final), `${sf.bracket_code} (${at(sf)}) must start before the final (${at(final)})`);
}

if (mode === 'prepare') {
  if (pool.length !== 7 || !live) throw new Error('Seed the public-frame fixtures first: seven pool games and a named semifinal are required.');
  if (existsSync(backup)) {
    const saved = JSON.parse(readFileSync(backup, 'utf8'));
    if (saved.tournament.id !== tournament.id || saved.games.some(g => !games.some(current => current.id === g.id))) throw new Error('The saved undo belongs to an older fixture. Resolve it before preparing again.');
  } else {
    mkdirSync(new URL('../.probe/', import.meta.url), { recursive: true });
    writeFileSync(backup, JSON.stringify({ tournament, liveGameId: live.id, games: [...pool, live].map(savedGame) }, null, 2));
  }
  await write(db.from('tournaments').update({ start_date: addDays(-3), end_date: addDays(3) }).eq('id', tournament.id));
  for (let i = 0; i < pool.length; i++) {
    await write(db.from('games').update({ game_date: addDays(i - 3) }).eq('id', pool[i].id).eq('tournament_id', tournament.id));
  }
  saveFinal();
  const started = new Date(Date.now() - 10 * 60_000);
  const time = stamp(started);
  await write(db.from('games').update({ game_date: localDate(started), game_time: time, status: 'scheduled', home_score: 3, away_score: 2 }).eq('id', live.id).eq('tournament_id', tournament.id));
  await moveFinalAfterSemifinals(started);
  games = await read(db.from('games').select(`${columns},is_playoff`).eq('tournament_id', tournament.id));
  for (let i = 0; i < pool.length; i++) assert.equal(games.find(g => g.id === pool[i].id)?.game_date, addDays(i - 3));
  assert.equal(games.find(g => g.id === live.id)?.home_score, 3);
} else if (faces.includes(mode)) {
  if (!existsSync(backup)) throw new Error('Run prepare first so the original game can be restored.');
  const saved = JSON.parse(readFileSync(backup, 'utf8'));
  if (saved.tournament.id !== tournament.id || !games.some(g => g.id === saved.liveGameId)) throw new Error('Saved fixture target does not match.');
  const offset = mode === 'soon' ? 3 : mode === 'unofficial' ? -240 : -10;
  const instant = new Date(Date.now() + offset * 60_000);
  const fields = {
    game_date: localDate(instant),
    game_time: stamp(instant),
    status: mode === 'final' ? 'completed' : mode === 'unofficial' ? 'submitted' : mode === 'cancelled' ? 'cancelled' : 'scheduled',
    home_score: mode === 'no-score' || mode === 'soon' ? null : 4,
    away_score: mode === 'no-score' || mode === 'soon' ? null : 2,
  };
  saveFinal();
  await write(db.from('games').update(fields).eq('id', saved.liveGameId).eq('tournament_id', tournament.id));
  await moveFinalAfterSemifinals(instant);
  const result = await read(db.from('games').select(columns).eq('id', saved.liveGameId).single());
  for (const [key, value] of Object.entries(fields)) assert.equal(key === 'game_time' ? result[key]?.slice(0, 5) : result[key], value);
  games = await read(db.from('games').select(`${columns},is_playoff`).eq('tournament_id', tournament.id));
} else if (mode === 'undo') {
  if (!existsSync(backup)) throw new Error('No saved Stage 3 fixture state to restore.');
  const saved = JSON.parse(readFileSync(backup, 'utf8'));
  if (saved.tournament.id !== tournament.id || saved.games.some(g => !games.some(current => current.id === g.id))) throw new Error('Undo does not match this marked fixture.');
  await write(db.from('tournaments').update({ start_date: saved.tournament.start_date, end_date: saved.tournament.end_date }).eq('id', tournament.id));
  for (const { id, ...fields } of saved.games) await write(db.from('games').update(fields).eq('id', id).eq('tournament_id', tournament.id));
  games = await read(db.from('games').select(`${columns},is_playoff`).eq('tournament_id', tournament.id));
  for (const g of saved.games) assert.deepEqual(savedGame(games.find(current => current.id === g.id)), g);
  unlinkSync(backup);
}

console.log(JSON.stringify({ mode, poolDates: [...new Set(games.filter(g => !g.is_playoff).map(g => g.game_date))].sort(),
  playoffGames: games.filter(g => g.is_playoff).map(g => ({ id: g.id, date: g.game_date, time: g.game_time, status: g.status, home: g.home_score, away: g.away_score })) }, null, 2));
