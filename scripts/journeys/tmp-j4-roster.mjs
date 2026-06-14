// One-off: insert the 3 rep roster players the dev seed silently failed to create
// (seed used source 'admin'; CHECK allows tryout|admin_manual). Idempotent.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TEAM = 'e1520a86-f6ea-4b74-8aa9-c4525d38bada';
const YEAR = '75fc5490-a175-4c1c-8ed8-29cfee3a3eed';
const ORG = '6f6f613b-79ed-44b6-9e7d-41e1b61ada4b';

const { count } = await db.from('rep_roster_players').select('id', { count: 'exact', head: true }).eq('program_year_id', YEAR);
if (count > 0) { console.log(`already ${count} players — skipping`); process.exit(0); }

const players = [
  { first: 'Jordan', last: 'Dev', num: '7' },
  { first: 'Taylor', last: 'Test', num: '12' },
  { first: 'Morgan', last: 'Seed', num: '24' },
];
const { error } = await db.from('rep_roster_players').insert(players.map(p => ({
  program_year_id: YEAR,
  team_id: TEAM,
  org_id: ORG,
  player_first_name: p.first,
  player_last_name: p.last,
  player_number: p.num,
  guardian_first_name: 'Parent',
  guardian_last_name: p.last,
  guardian_email: `parent.${p.last.toLowerCase()}@dev.local`,
  status: 'active',
  source: 'admin_manual',
})));
console.log(error ? 'FAIL: ' + error.message : 'created 3 roster players (source admin_manual)');
