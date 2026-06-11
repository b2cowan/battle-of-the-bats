import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const today = new Date().toISOString().split('T')[0];
const { data: org } = await db.from('organizations').select('id').eq('slug', 'dev-test-org').single();
const { data: t } = await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'live-demo').single();
const { data: divs } = await db.from('divisions').select('id, name').eq('tournament_id', t.id);
const u11 = divs.find(d => d.name === 'U11');
const { data: milton } = await db.from('teams').select('id, name').eq('tournament_id', t.id).eq('division_id', u11.id).ilike('name', 'Milton Bats%').maybeSingle();
const { data: games } = await db.from('games').select('id, home_team_id, away_team_id, home_score, away_score')
  .eq('tournament_id', t.id).eq('game_date', today).eq('status', 'submitted')
  .or(`home_team_id.eq.${milton.id},away_team_id.eq.${milton.id}`);
const g = games[0];
if (!g) { console.log('No live Milton game today.'); process.exit(1); }
const miltonHome = g.home_team_id === milton.id;
const field = miltonHome ? 'home_score' : 'away_score';
const cur = (miltonHome ? g.home_score : g.away_score) ?? 0;
await db.from('games').update({ [field]: cur + 1, score_submitted_at: new Date().toISOString(), score_submission_source: 'admin_results' }).eq('id', g.id);
console.log(`Milton score bumped ${cur} -> ${cur + 1}. Watch it roll within ~30s (no refresh).`);
