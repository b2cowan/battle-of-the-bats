/**
 * reset-botb-champions-moment.mjs  (DEV ONLY)
 *
 * Arms the "Champions crowned" completion moment on the mirrored Battle of the Bats so it
 * can be watched firing end-to-end:
 *   1. Reverts the Tier 1 (championship) final back to `scheduled` (clears its score), so the
 *      tournament's playoffs are NO LONGER complete → the home hero drops out of the Champions
 *      takeover.
 *   2. Clears tournaments.champions_crowned_at (the one-time notify guard) back to NULL.
 *
 * Then, logged in as the BOTB admin (scripts/seed-botb-admin.mjs → botb-admin@dev.local),
 * open the tournament Schedule, score that Tier 1 final again, and watch:
 *   • a "🏆 Champions crowned" bell/push to staff,
 *   • the public home hero flip to the Champions celebration (Brampton Blazers Gold),
 *   • the /champions recap update.
 *
 * Re-running the mirror (mirror-battle-of-the-bats.mjs) resets all scores to prod state; run
 * this again afterward to re-arm. Run: node scripts/reset-botb-champions-moment.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const TOURNAMENT_ID = '7ab0c79e-f29a-4512-9ac1-16aa661b324d'; // Battle of the Bats (prod mirror)

async function main() {
  // Find the Tier 1 (championship) final — the top tier's FIN game.
  const { data: finals } = await sb
    .from('games')
    .select('id, bracket_label, home_team_id, away_team_id, home_score, away_score')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('is_playoff', true)
    .ilike('bracket_code', 'FIN');

  if (!finals || finals.length === 0) {
    console.error('❌ No FIN games found. Run scripts/mirror-battle-of-the-bats.mjs first.');
    process.exit(1);
  }

  // Prefer the "Tier 1" label; else the first final.
  const tier1 = finals.find(f => (f.bracket_label || '').toLowerCase().includes('tier 1')) || finals[0];

  const { error: revertErr } = await sb
    .from('games')
    .update({
      status: 'scheduled',
      home_score: null,
      away_score: null,
      score_submitted_by_user_id: null,
      score_submitted_by_email: null,
      score_submitted_at: null,
      score_submission_source: null,
    })
    .eq('id', tier1.id);
  if (revertErr) throw revertErr;

  const { error: guardErr } = await sb
    .from('tournaments')
    .update({ champions_crowned_at: null })
    .eq('id', TOURNAMENT_ID);
  if (guardErr) throw guardErr;

  console.log('\n=== CHAMPIONS MOMENT ARMED ===');
  console.log('Reverted final:  ', tier1.bracket_label || '(unlabelled)', '— game', tier1.id);
  console.log('Guard cleared:   ', 'champions_crowned_at → NULL');
  console.log('\nNow, as botb-admin@dev.local:');
  console.log('  1. Open /milton-softball-organization/admin/tournaments/schedule');
  console.log('  2. Score the reverted championship final.');
  console.log('  3. Watch: staff bell "🏆 Champions crowned", home Champions hero, /champions recap.');
}

main().catch(e => { console.error('RESET FAILED:', e.message); process.exit(1); });
