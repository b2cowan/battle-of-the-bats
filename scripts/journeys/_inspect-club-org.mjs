// Temp inspection helper for staging — safe to delete.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ORG = '6f6f613b-79ed-44b6-9e7d-41e1b61ada4b';

const { data: org } = await db.from('organizations').select('id, slug, name, plan, is_public').eq('id', ORG).single();
console.log('ORG:', JSON.stringify(org));

const { data: team } = await db.from('rep_teams').select('id, name, slug').eq('org_id', ORG);
console.log('REP TEAMS:', JSON.stringify(team));

const { data: years } = await db.from('rep_program_years').select('id, team_id, name, year, status').eq('org_id', ORG);
console.log('PROGRAM YEARS:', JSON.stringify(years));

const { data: coaches } = await db.from('rep_team_coaches').select('id, team_id, user_id, coach_role').eq('org_id', ORG);
console.log('TEAM COACHES:', JSON.stringify(coaches));

const { data: ledgers } = await db.from('accounting_ledgers').select('id, name, entity_type, entity_id').eq('org_id', ORG);
console.log('LEDGERS:', JSON.stringify(ledgers));

const { data: lines } = await db.from('org_budget_lines').select('id, description, total_amount, season_year').eq('org_id', ORG);
console.log('BUDGET LINES:', JSON.stringify(lines));

const { data: seasons } = await db.from('league_seasons').select('id, name, slug, status').eq('org_id', ORG);
console.log('HL SEASONS:', JSON.stringify(seasons));

const { data: cats } = await db.from('budget_categories').select('id, name, scope, org_id, is_default').or(`org_id.is.null,org_id.eq.${ORG}`).order('sort_order');
console.log('BUDGET CATEGORIES:', JSON.stringify(cats));

const { data: payreq } = await db.from('rep_team_payment_requests').select('id, description, amount, status').eq('org_id', ORG);
console.log('PAYMENT REQUESTS:', JSON.stringify(payreq));

const { data: users } = await db.auth.admin.listUsers();
for (const e of ['club-owner@dev.local', 'coach@dev.local', 'owner@dev.local']) {
  const u = users.users.find(x => x.email === e);
  if (!u) { console.log(e, '-> MISSING'); continue; }
  const { data: m } = await db.from('org_members').select('org_id, role, created_at, organizations(slug)').eq('user_id', u.id).order('created_at');
  console.log(e, '->', u.id, JSON.stringify(m));
}
