/**
 * seed-botb-extra-divisions.mjs  (DEV ONLY)
 *
 * Adds FOUR fully-completed divisions to the dev "Battle of the Bats" tournament so
 * we can see what a finished, MANY-division tournament looks like on the public
 * Overview champion banner and the /champions recap:
 *
 *   U11  — 6 teams, NON-tiered single-elim  → one champion
 *   U15  — 8 teams, NON-tiered single-elim  → one champion
 *   U17  — 8 teams, TIERED (Tier 1: seeds 1–4 · Tier 2: seeds 5–8) → two tier champions
 *   U19  — 6 teams, TIERED (Tier 1: seeds 1–3 · Tier 2: seeds 4–6) → two tier champions
 *
 * Every division gets a full round-robin (all games scored) plus a resolved playoff
 * bracket, so standings, seeds, brackets, and champions all populate. The existing
 * U13 division is left untouched.
 *
 * Idempotent: wipes and recreates ONLY these four divisions (matched by name) and
 * their teams + games each run. Never deletes U13.
 *
 * Run: node scripts/seed-botb-extra-divisions.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL');
const db = createClient(SUPABASE_URL, get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const TOURNAMENT_ID = '7ab0c79e-f29a-4512-9ac1-16aa661b324d'; // Battle of the Bats (dev mirror)
const nowISO = new Date().toISOString();

// Dates within the event window (2026-07-03 … 2026-07-06). RR on days 1–2, playoffs day 3,
// mirroring the existing U13 (finals 07-05).
const RR_DATES = ['2026-07-03', '2026-07-04'];
const RR_TIMES = ['09:00:00', '10:30:00', '12:00:00', '13:30:00', '15:00:00', '16:30:00'];
const PO_DATE = '2026-07-05';
const PLAYOFF_CONFIG = { type: 'single', crossover: 'standard', hasThirdPlace: false };
const MERCY_DIFF = 7; // tournaments.settings.max_run_diff_per_game

// 28 distinct club names, sliced per division in strength order (index 0 = strongest = seed #1).
const TEAM_NAMES = [
  'Milton Mavericks', 'Oakville Outlaws', 'Burlington Bandits', 'Georgetown Giants', 'Guelph Gators', 'Halton Hurricanes',
  'Mississauga Mustangs', 'Brampton Blazers', 'Cambridge Cobras', 'Kitchener Kings', 'Waterloo Warriors', 'Acton Aces',
  'Campbellville Cyclones', 'Hamilton Hawks', 'Ancaster Angels', 'Dundas Dukes', 'Stoney Creek Storm', 'Grimsby Grizzlies',
  'Niagara Nitro', 'Flamborough Falcons', 'Erin Eagles', 'Rockwood Rockets', 'Fergus Flames', 'Elora Express',
  'Paris Panthers', 'Brantford Bolts', 'Caledonia Chargers', 'Dunnville Dragons',
];

const DIVISIONS = [
  { name: 'U11', order: 1, teams: 6, tiers: null },
  { name: 'U15', order: 4, teams: 8, tiers: null },
  { name: 'U17', order: 5, teams: 8, tiers: [{ name: 'Tier 1', from: 1, to: 4 }, { name: 'Tier 2', from: 5, to: 8 }] },
  { name: 'U19', order: 6, teams: 6, tiers: [{ name: 'Tier 1', from: 1, to: 3 }, { name: 'Tier 2', from: 4, to: 6 }] },
];

// ── pure single-elim bracket builder (mirrors lib/playoff-bracket.ts buildWinners) ──
function nextPow2(n) { let p = 1; while (p < n) p *= 2; return Math.max(1, p); }
function seedOrder(size) {
  let o = [1];
  while (o.length < size) { const len = o.length * 2; const nx = []; for (const s of o) { nx.push(s); nx.push(len + 1 - s); } o = nx; }
  return o;
}
function roundMeta(teamsInRound) {
  if (teamsInRound === 2) return { name: 'Final', code: () => 'FIN' };
  if (teamsInRound === 4) return { name: 'Semifinal', code: g => `SF${g}` };
  if (teamsInRound === 8) return { name: 'Quarterfinal', code: g => `QF${g}` };
  return { name: `Round of ${teamsInRound}`, code: g => `R${teamsInRound}-${g}` };
}
/** Matchups for an n-seed single-elim bracket, local `Seed #k` refs, creation (round) order. */
function buildSingleElim(n) {
  const size = nextPow2(n);
  let current = seedOrder(size).map(s => (s <= n ? `Seed #${s}` : null));
  const out = [];
  while (current.length > 1) {
    const meta = roundMeta(current.length);
    const next = []; let game = 0;
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i], b = current[i + 1];
      if (a && b) { game++; const code = meta.code(game); out.push({ code, round: meta.name, home: a, away: b }); next.push(`Winner ${code}`); }
      else next.push(a ?? b);
    }
    current = next;
  }
  return out;
}
/** Rewrite a local `Seed #k` into the global `Seed #(from-1+k)`; other refs pass through. */
const remapSeed = (ref, from) => {
  const m = ref.match(/^Seed #(\d+)$/);
  return m ? `Seed #${from - 1 + Number(m[1])}` : ref;
};

// Playoff time by round (parallel across tiers, mirrors existing U13).
function poTime(code) {
  if (code === 'FIN' || code === 'GF' || code === 'GF2') return '13:30:00';
  if (code.startsWith('SF')) return '11:00:00';
  return '09:00:00'; // QF / Round-of-N openers
}

// Deterministic per-game variety so scores don't all collapse to one value (FNV-1a).
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Decisive scores, capped at the mercy differential. `gap` = seed-rank distance; closer
// seeds trend to closer games. `seed` varies the exact line game-to-game.
function rrScore(gap, seed) {
  const h = hashStr(seed);
  const lose = 2 + (h % 5);                                   // 2..6
  const margin = Math.min(MERCY_DIFF, Math.max(1, 1 + gap), 2 + ((h >> 4) % 5)); // taper by gap + jitter
  return { win: lose + margin, lose };
}
function poScore(gap, seed) {
  const h = hashStr(seed);
  const lose = 2 + (h % 5);                                   // 2..6
  const margin = Math.max(1, Math.min(MERCY_DIFF, gap + 1, 1 + ((h >> 4) % MERCY_DIFF)));
  return { win: lose + margin, lose };
}

async function chk(label, { error }) { if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); } }

async function main() {
  console.log(`Target: ${SUPABASE_URL}`);
  const { data: tour } = await db.from('tournaments').select('id, name, status').eq('id', TOURNAMENT_ID).maybeSingle();
  if (!tour) { console.error('❌ Battle of the Bats not found in dev. Run scripts/mirror-battle-of-the-bats.mjs first.'); process.exit(1); }
  console.log(`Tournament: ${tour.name} (status=${tour.status})`);

  const names = DIVISIONS.map(d => d.name);

  // ── wipe prior copies of just these four divisions (idempotent; never touches U13) ──
  const { data: prior } = await db.from('divisions').select('id, name').eq('tournament_id', TOURNAMENT_ID).in('name', names);
  if (prior?.length) {
    const ids = prior.map(d => d.id);
    await db.from('games').delete().eq('tournament_id', TOURNAMENT_ID).in('division_id', ids);
    await db.from('teams').delete().eq('tournament_id', TOURNAMENT_ID).in('division_id', ids);
    await db.from('pools').delete().in('division_id', ids);
    await db.from('divisions').delete().in('id', ids);
    console.log(`Wiped prior copies of: ${prior.map(d => d.name).join(', ')}`);
  }

  let nameCursor = 0;
  const summary = [];

  for (const div of DIVISIONS) {
    const divId = randomUUID();
    await chk(`insert division ${div.name}`, await db.from('divisions').insert({
      id: divId, tournament_id: TOURNAMENT_ID, name: div.name, display_order: div.order,
      schedule_visibility: 'published', playoff_config: PLAYOFF_CONFIG, settings: {},
    }));

    // teams in strength order — teams[0] strongest = seed #1
    const teamRows = [];
    for (let i = 0; i < div.teams; i++) {
      teamRows.push({
        id: randomUUID(), tournament_id: TOURNAMENT_ID, division_id: divId,
        name: TEAM_NAMES[nameCursor++], status: 'accepted', payment_status: 'paid',
        seed: i + 1,
      });
    }
    await chk(`insert teams ${div.name}`, await db.from('teams').insert(teamRows));
    const teams = teamRows.map(t => t.id);              // index = strength rank (0 strongest)
    const seedTeam = k => teams[k - 1];                 // global Seed #k → team id
    const rankOf = id => teams.indexOf(id);             // lower = stronger

    const games = [];

    // ── round robin: every pair once; stronger (lower index) wins ──
    let rrIdx = 0;
    for (let i = 0; i < div.teams; i++) {
      for (let j = i + 1; j < div.teams; j++) {
        const { win, lose } = rrScore(j - i, `${div.name}-rr-${i}-${j}`); // home (i) is stronger
        games.push({
          id: randomUUID(), tournament_id: TOURNAMENT_ID, division_id: divId,
          home_team_id: teams[i], away_team_id: teams[j],
          game_date: RR_DATES[rrIdx % RR_DATES.length], game_time: RR_TIMES[rrIdx % RR_TIMES.length],
          location: `Diamond ${(rrIdx % 4) + 1}`, home_score: win, away_score: lose,
          status: 'completed', is_playoff: false,
          score_submission_source: 'admin_results', score_submitted_at: nowISO,
        });
        rrIdx++;
      }
    }

    // ── playoff bracket(s): one bracket per tier (or a single bracket when non-tiered) ──
    const brackets = div.tiers
      ? div.tiers.map(t => ({ label: t.name, from: t.from, matchups: buildSingleElim(t.to - t.from + 1).map(m => ({ ...m, home: remapSeed(m.home, t.from), away: remapSeed(m.away, t.from) })) }))
      : [{ label: null, from: 1, matchups: buildSingleElim(div.teams) }];

    const tierChamps = [];
    for (const br of brackets) {
      const bracketId = randomUUID();
      const winners = {}; // code → team id (within this bracket)
      const resolve = ref => {
        const s = ref.match(/^Seed #(\d+)$/); if (s) return seedTeam(Number(s[1]));
        const w = ref.match(/^Winner (\S+)$/); if (w) return winners[w[1]] ?? null;
        return null;
      };
      let finalWinner = null, finalLoser = null, finalWin = null, finalLose = null;
      for (const m of br.matchups) {                     // creation order = round order
        const home = resolve(m.home), away = resolve(m.away);
        const gap = Math.abs(rankOf(home) - rankOf(away));
        const strongerIsHome = rankOf(home) < rankOf(away);
        // Occasional upset between adjacent seeds so a few divisions don't crown the #1 seed.
        const upset = gap === 1 && (hashStr(`${div.name}-${br.label}-${m.code}-upset`) % 100) < 22;
        const winnerIsHome = upset ? !strongerIsHome : strongerIsHome;
        const { win, lose } = poScore(gap, `${div.name}-${br.label}-${m.code}`);
        winners[m.code] = winnerIsHome ? home : away;
        games.push({
          id: randomUUID(), tournament_id: TOURNAMENT_ID, division_id: divId,
          home_team_id: home, away_team_id: away,
          game_date: PO_DATE, game_time: poTime(m.code), location: `Diamond ${br.label === 'Tier 2' ? 2 : 1}`,
          home_score: winnerIsHome ? win : lose, away_score: winnerIsHome ? lose : win,
          status: 'completed', is_playoff: true,
          bracket_id: bracketId, bracket_code: m.code, bracket_label: br.label,
          home_placeholder: m.home, away_placeholder: m.away,
          score_submission_source: 'admin_results', score_submitted_at: nowISO,
        });
        if (m.code === 'FIN') {
          finalWinner = winners[m.code];
          finalLoser = finalWinner === home ? away : home;
          finalWin = win; finalLose = lose;
        }
      }
      const nameOf = id => teamRows.find(t => t.id === id)?.name;
      tierChamps.push(`${br.label ? br.label + ': ' : ''}${nameOf(finalWinner)} def. ${nameOf(finalLoser)} ${finalWin}–${finalLose}`);
    }

    // insert this division's games (chunked to stay well under any payload limit)
    for (let i = 0; i < games.length; i += 100) {
      await chk(`insert games ${div.name}`, await db.from('games').insert(games.slice(i, i + 100)));
    }

    summary.push({ div: div.name, teams: div.teams, games: games.length, champs: tierChamps });
  }

  console.log('\n✅ Seeded 4 completed divisions into Battle of the Bats:');
  for (const s of summary) {
    console.log(`\n  ${s.div} — ${s.teams} teams · ${s.games} games`);
    for (const c of s.champs) console.log(`     🏆 ${c}`);
  }
  console.log('\nPublic:  /milton-softball-organization/battle-of-the-bats');
  console.log('Recap:   /milton-softball-organization/battle-of-the-bats/champions');
}

main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
