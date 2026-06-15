/** Give denver bobcats (U13) a couple of games vs real U13 teams so the 5i coach
 * bridge has something to render. Once the U13 division is published, opponents show
 * real team names (mig 129 — two-state schedule; the old placeholder/TBD publish mode
 * was removed). Idempotent (clears denver's games first). Run AFTER the live-demo seed.
 * Run: node --env-file=.env.local scripts/add-denver-games.mjs */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const today = new Date().toISOString().split('T')[0];
const now = new Date().toISOString();

const { data: org } = await db.from('organizations').select('id').eq('slug', 'dev-test-org').single();
const { data: t } = await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'live-demo').single();
const { data: divs } = await db.from('divisions').select('id, name').eq('tournament_id', t.id);
const u13 = divs.find(d => d.name === 'U13');

const { data: denver } = await db.from('teams').select('id, name')
  .eq('tournament_id', t.id).eq('division_id', u13.id).ilike('name', 'denver%').maybeSingle();
if (!denver) { console.log('❌ denver bobcats (U13) not found in live-demo'); process.exit(1); }

const { data: others } = await db.from('teams').select('id, name')
  .eq('tournament_id', t.id).eq('division_id', u13.id).eq('status', 'accepted').neq('id', denver.id);
if (!others?.length) { console.log('❌ no other U13 teams to play'); process.exit(1); }
const oppA = others.find(x => /bears/i.test(x.name)) ?? others[0];
const oppB = others.find(x => /eagles/i.test(x.name)) ?? others[1] ?? others[0];

// Copy a full existing game so every NOT-NULL column is populated, then override.
const { data: ref } = await db.from('games').select('*').eq('tournament_id', t.id).limit(1).maybeSingle();
const mk = (o) => {
  const r = { ...ref, id: randomUUID(),
    division_id: u13.id, is_playoff: false,
    home_placeholder: null, away_placeholder: null, bracket_code: null, bracket_id: null,
    home_slot_id: null, away_slot_id: null, schedule_facility_lane_id: null,
    score_submitted_by_user_id: null, score_submitted_by_email: null,
    home_score: null, away_score: null, score_submitted_at: null, score_submission_source: null,
    ...o };
  delete r.created_at;
  return r;
};

// Idempotent: clear any prior denver games first.
await db.from('games').delete().eq('tournament_id', t.id).or(`home_team_id.eq.${denver.id},away_team_id.eq.${denver.id}`);

const games = [
  mk({ game_date: today, game_time: '11:00:00', home_team_id: denver.id, away_team_id: oppA.id, status: 'scheduled' }),
  mk({ game_date: today, game_time: '15:30:00', home_team_id: oppB.id, away_team_id: denver.id, status: 'completed', home_score: 3, away_score: 6, score_submitted_at: now, score_submission_source: 'admin_results' }),
];
const { error } = await db.from('games').insert(games);
if (error) { console.error('insert failed:', error.message); process.exit(1); }

console.log(`✅ Added 2 U13 games for denver bobcats:`);
console.log(`   • vs ${oppA.name} — 11:00 today (scheduled)`);
console.log(`   • @ ${oppB.name} — 15:30 today (final, denver won 6-3)`);
console.log(`   Refresh /coaches/tournaments/${denver.id} — once U13 is published, opponents show real names;`);
console.log(`   each row deep-links to a public game page with the same matchup.`);
