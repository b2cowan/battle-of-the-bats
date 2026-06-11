/**
 * Cleaner 5i test setup: revert the Halton email hack and make Milton Bats U11
 * (a real b2cowan team) the team in today's LIVE game, so the live scorebug can be
 * tested on a genuinely-owned team. Run AFTER seed-live-tournament.mjs.
 * Run: node --env-file=.env.local scripts/setup-5i-milton-live.mjs
 */
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const today = new Date().toISOString().split('T')[0];
const now = new Date().toISOString();

const { data: org } = await db.from('organizations').select('id').eq('slug', 'dev-test-org').single();
const { data: t } = await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'live-demo').single();
const { data: divs } = await db.from('divisions').select('id, name').eq('tournament_id', t.id);
const u11 = divs.find(d => d.name === 'U11');

// 1) Revert the Halton email hijack so the claim list is honest again.
await db.from('teams').update({ email: 'coach@dev.local' }).eq('tournament_id', t.id).ilike('name', 'Halton Hawks%');

// 2) Find Milton Bats U11 (real b2cowan team).
const { data: milton } = await db.from('teams').select('id, name')
  .eq('tournament_id', t.id).eq('division_id', u11.id).ilike('name', 'Milton Bats%').maybeSingle();
if (!milton) { console.log('❌ Milton Bats U11 not found in live-demo'); process.exit(1); }

// 3) Pick a Milton game to make LIVE today — prefer a real (non-playoff) game; move it to today.
const { data: games } = await db.from('games')
  .select('id, game_date, game_time, status, home_team_id, away_team_id, is_playoff')
  .eq('tournament_id', t.id)
  .or(`home_team_id.eq.${milton.id},away_team_id.eq.${milton.id}`)
  .order('game_date', { ascending: true }).order('game_time', { ascending: true });
const target = (games ?? []).find(g => g.game_date === today && !g.is_playoff)
  ?? (games ?? []).find(g => !g.is_playoff)
  ?? (games ?? [])[0];
if (!target) { console.log('❌ Milton Bats U11 has no games'); process.exit(1); }

const miltonHome = target.home_team_id === milton.id;
await db.from('games').update({
  game_date: today,
  status: 'submitted',                 // submitted + date===today → renders LIVE
  home_score: miltonHome ? 3 : 2,
  away_score: miltonHome ? 2 : 3,
  score_submitted_at: now,
  score_submission_source: 'admin_results',
}).eq('id', target.id);

const oppId = miltonHome ? target.away_team_id : target.home_team_id;
const { data: opp } = oppId ? await db.from('teams').select('name').eq('id', oppId).maybeSingle() : { data: null };

console.log('✅ Done.');
console.log(`   Reverted Halton Hawks email → coach@dev.local (off your claim list).`);
console.log(`   Milton Bats U11 is now LIVE today vs ${opp?.name ?? 'TBD'} — Milton leads 3-2 (game ${target.id}).`);
console.log(`   Open Milton Bats (live scorebug + real names + deep links): /coaches/tournaments/${milton.id}`);
