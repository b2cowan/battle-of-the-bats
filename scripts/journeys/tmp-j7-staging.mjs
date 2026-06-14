// One-off J7 staging: completed 2025 season for the past-season/re-registration leg.
// NOTE: organizations.contact_email does NOT exist (dev or prod) despite lib/api-auth.ts
// reading it — org.contactEmail is always null. Audit finding, not a staging task.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: org, error: orgErr } = await db.from('organizations').select('id').eq('slug', 'dev-league-org').single();
if (orgErr) { console.error('org lookup:', orgErr.message); process.exit(1); }

const { data: s25 } = await db.from('league_seasons').select('id').eq('org_id', org.id).eq('slug', 'dev-league-2025').maybeSingle();
if (!s25) {
  const { error } = await db.from('league_seasons').insert({
    org_id: org.id,
    name: 'Dev House League 2025',
    slug: 'dev-league-2025',
    sport: 'softball',
    division: 'U10',
    status: 'completed',
    description: 'The 2025 season - thanks for a great year!',
    registration_fee: 140,
    auto_generate_fees: false,
    auto_approve_under_capacity: true,
    auto_promote_waitlist: true,
    season_start_date: '2025-06-01',
    season_end_date: '2025-08-31',
  });
  console.log(error ? 'season25 FAIL: ' + error.message : 'season25 created (completed)');
} else {
  console.log('season25 exists');
}
