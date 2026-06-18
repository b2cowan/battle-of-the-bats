/**
 * Repair a legacy playoff bracket whose `bracket_code` values use a NON-canonical
 * scheme (e.g. G1..G7 — sequential "Game N" codes from an older generator) that
 * the current renderer can't group into rounds.
 *
 * Why this is needed
 * ------------------
 * The bracket diagram groups games into round COLUMNS via `bracketRoundInfo()`
 * (lib/playoff-bracket.ts), which only understands canonical codes
 * (R{n}-, QF, SF, FIN, WB, LB, GF, CON, PL, P3). Any unrecognised code (like
 * "G3") falls through to a per-game default column at rank 1000, so every game
 * lands in its own column in query-return order — that's the "flat row of
 * single-game columns, G7 before G6, connectors crisscrossing" symptom.
 *
 * Winner/Loser ADVANCEMENT is a separate mechanism — advancePlayoffs() string-
 * matches `"Winner " + bracket_code` against placeholders — so it is INDEPENDENT
 * of the code scheme and keeps working as long as codes/placeholders stay in
 * lockstep (and the games share a bracket_id, or all have null).
 *
 * What this does
 * --------------
 * Re-codes each game to the canonical manual scheme `R{round}-{n}` (rendered as
 * ordered "Round N" columns) where `round` is the game's depth in the
 * Winner/Loser feed graph, and rewrites every `Winner <oldcode>` / `Loser
 * <oldcode>` placeholder in lockstep. PRESERVES everything else: Seed #N
 * placeholders, home/away team-ids, dates, times, locations, scores, status,
 * bracket_id.
 *
 * DRY RUN by default (prints current bracket + planned changes). Pass --apply to
 * write. bracket_id is NEVER modified here — it only reports distinct ids so you
 * can spot an advancement-breaking split.
 *
 * Run (prod):
 *   node --env-file=.env.production.local scripts/repair-legacy-bracket-codes.mjs --tournament=<slug-or-id> [--org=<slug>] [--division=<name-or-id>] [--apply]
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── args ─────────────────────────────────────────────────────────────────────
const arg = (k) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=').slice(1).join('=') : null; };
const has = (k) => process.argv.includes(`--${k}`);
const APPLY = has('apply');
const tournamentArg = arg('tournament');
const orgArg = arg('org');
const divisionArg = arg('division');
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');

if (!tournamentArg) { console.error('Missing --tournament=<slug-or-id>'); process.exit(1); }

// Codes already in a canonical round scheme → no re-code needed.
const CANONICAL_RE = /^(R\d+-|QF|SF|FIN|WB|LB|GF|CON|PL|P3|3RD|IF)/i;
const REF_RE = /^(Winner|Loser)\s+(.+)$/i;
const natKey = (code) => { const m = /(\d+)\s*$/.exec(code || ''); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };

async function main() {
  // ── resolve tournament ──
  let tq = db.from('tournaments').select('id, name, slug, org_id, organizations(slug)');
  tq = isUuid(tournamentArg) ? tq.eq('id', tournamentArg) : tq.eq('slug', tournamentArg);
  const { data: tours, error: te } = await tq;
  if (te) { console.error('tournament lookup failed:', te.message); process.exit(1); }
  let matches = tours || [];
  if (orgArg) matches = matches.filter(t => t.organizations?.slug === orgArg);
  if (matches.length === 0) { console.error('No tournament matched.'); process.exit(1); }
  if (matches.length > 1) {
    console.error('Ambiguous — multiple tournaments match. Re-run with --tournament=<id> (or add --org=<slug>):');
    for (const t of matches) console.error(`  ${t.id}  ${t.slug}  (org ${t.organizations?.slug})  "${t.name}"`);
    process.exit(1);
  }
  const t = matches[0];
  console.log(`Tournament: "${t.name}"  slug=${t.slug}  org=${t.organizations?.slug}  id=${t.id}\n`);

  // ── load playoff games ──
  const { data: games, error: ge } = await db
    .from('games')
    .select('id, division_id, bracket_id, bracket_code, home_placeholder, away_placeholder, home_team_id, away_team_id, game_date, game_time, location, status')
    .eq('tournament_id', t.id)
    .eq('is_playoff', true);
  if (ge) { console.error('games load failed:', ge.message); process.exit(1); }

  const { data: divs } = await db.from('divisions').select('id, name').eq('tournament_id', t.id);
  const divName = (id) => divs?.find(d => d.id === id)?.name || id;

  let pool = games || [];
  if (divisionArg) {
    pool = pool.filter(g => g.division_id === divisionArg || divName(g.division_id) === divisionArg);
  }
  if (pool.length === 0) { console.error('No playoff games found for that scope.'); process.exit(1); }

  const byDivision = new Map();
  for (const g of pool) { if (!byDivision.has(g.division_id)) byDivision.set(g.division_id, []); byDivision.get(g.division_id).push(g); }

  const writes = [];
  for (const [divId, divGames] of byDivision) {
    console.log(`── Division: ${divName(divId)} (${divGames.length} playoff games) ───────────────────`);

    const ids = [...new Set(divGames.map(g => g.bracket_id))];
    if (ids.length > 1) {
      console.log(`  ⚠ ${ids.length} distinct bracket_id values in this division: ${ids.map(x => x || 'null').join(', ')}`);
      console.log('    advancePlayoffs SKIPS advancement between games whose bracket_ids differ (when both non-null).');
      console.log('    If teams are not flowing, that is a likely cause — re-coding alone will not fix it.\n');
    }

    const hasLegacy = divGames.some(g => g.bracket_code && !CANONICAL_RE.test(g.bracket_code));
    if (!hasLegacy) { console.log('  ✓ All codes already canonical — no re-code needed.\n'); continue; }

    const byCode = new Map(divGames.map(g => [g.bracket_code, g]));
    const depsOf = (g) => [g.home_placeholder, g.away_placeholder]
      .map(p => REF_RE.exec(p || '')?.[2])
      .filter(c => c && byCode.has(c));

    // round = 1 + max(round of feeders); feederless games = round 1. Fixpoint.
    const round = new Map();
    for (let guard = 0; guard < 200; guard++) {
      let changed = false;
      for (const g of divGames) {
        const deps = depsOf(g);
        let r;
        if (deps.length === 0) r = 1;
        else { if (!deps.every(d => round.has(d))) continue; r = 1 + Math.max(...deps.map(d => round.get(d))); }
        if (round.get(g.bracket_code) !== r) { round.set(g.bracket_code, r); changed = true; }
      }
      if (!changed) break;
    }
    for (const g of divGames) if (!round.has(g.bracket_code)) { round.set(g.bracket_code, 1); console.log(`  ⚠ ${g.bracket_code}: round could not be resolved (dangling ref?) — defaulting to Round 1.`); }

    // assign R{round}-{n}, ordered within a round by the old code's trailing number.
    const remap = new Map();
    const maxRound = Math.max(...round.values());
    for (let r = 1; r <= maxRound; r++) {
      const inRound = divGames.filter(g => round.get(g.bracket_code) === r).sort((a, b) => natKey(a.bracket_code) - natKey(b.bracket_code) || a.bracket_code.localeCompare(b.bracket_code));
      inRound.forEach((g, i) => remap.set(g.bracket_code, `R${r}-${i + 1}`));
    }

    const reref = (p) => { const m = REF_RE.exec(p || ''); if (!m) return p; const nc = remap.get(m[2]); return nc ? `${m[1]} ${nc}` : p; };

    for (const g of divGames.slice().sort((a, b) => natKey(a.bracket_code) - natKey(b.bracket_code))) {
      const nc = remap.get(g.bracket_code);
      const nh = reref(g.home_placeholder);
      const na = reref(g.away_placeholder);
      const codeChg = nc && nc !== g.bracket_code;
      const phChg = nh !== g.home_placeholder || na !== g.away_placeholder;
      console.log(`  ${g.bracket_code.padEnd(6)} -> ${(nc || g.bracket_code).padEnd(7)}  [${g.away_placeholder || 'TBD'} / ${g.home_placeholder || 'TBD'}]`
        + (phChg ? `  =>  [${na || 'TBD'} / ${nh || 'TBD'}]` : ''));
      if (codeChg || phChg) writes.push({ id: g.id, bracket_code: nc, home_placeholder: nh, away_placeholder: na });
    }
    console.log('');
  }

  if (writes.length === 0) { console.log('Nothing to change.'); return; }

  if (!APPLY) {
    console.log(`DRY RUN — ${writes.length} game(s) would be updated. Re-run with --apply to write.`);
    return;
  }
  console.log(`Applying ${writes.length} update(s)...`);
  for (const w of writes) {
    const { error } = await db.from('games').update({ bracket_code: w.bracket_code, home_placeholder: w.home_placeholder, away_placeholder: w.away_placeholder }).eq('id', w.id);
    if (error) { console.error(`  ❌ ${w.id}:`, error.message); process.exit(1); }
  }
  console.log('✓ Done. Reload the Schedule → Playoffs view to confirm the bracket tree renders correctly.');
}

main().catch(e => { console.error(e); process.exit(1); });
