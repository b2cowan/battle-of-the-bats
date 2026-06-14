// One-off: fixture IDs for the J6 shots spec. Run: node --env-file=.env.local scripts/journeys/tmp-j6-ids.mjs
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: org } = await db.from('organizations').select('id, slug, plan_id').eq('slug', 'dev-test-org').single();
console.log('org:', org.id, org.plan_id);

for (const slug of ['live-demo', 'completed-demo']) {
  const { data: t } = await db.from('tournaments').select('id, slug, status, start_date, end_date').eq('org_id', org.id).eq('slug', slug).maybeSingle();
  console.log(slug + ':', t ? `${t.id} status=${t.status} ${t.start_date}→${t.end_date}` : 'MISSING');
  if (!t) continue;
  const { data: games } = await db.from('games').select('id, status, game_date, game_time, home_score, away_score, home_team_id, away_team_id, division_id').eq('tournament_id', t.id).order('game_date').order('game_time');
  for (const g of games ?? []) {
    console.log(`  game ${g.id} ${g.game_date} ${g.game_time} status=${g.status} score=${g.away_score}-${g.home_score}`);
  }
  const { data: teams } = await db.from('teams').select('id, name, division_id').eq('tournament_id', t.id).ilike('name', '%U11%').limit(4);
  for (const tm of teams ?? []) console.log(`  team ${tm.id} "${tm.name}" div=${tm.division_id}`);
}
