/**
 * Seed a PLAYOFF-ONLY tournament with one 11-team, no-pool division so byes can be
 * exercised: 11 teams → 16-slot bracket → 5 byes for the top seeds. Open the
 * Playoff Bracket Builder → Seed Teams shows the bye preview → pick a format →
 * Generate to see byes carried into the fork.
 *
 * Idempotent. Run: node --experimental-strip-types --env-file=.env.local scripts/seed-byedemo.mts
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SLUG = 'bye-demo';
const NAME = 'Bye Demo — 11 Teams';
const DIV = 'Open';
const TEAM_NAMES = ['Aces', 'Bandits', 'Cyclones', 'Dragons', 'Eagles', 'Falcons', 'Gators', 'Hawks', 'Ironmen', 'Jaguars', 'Knights']; // 11

function fail(label: string, error: { message: string } | null) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error(`org ${ORG_SLUG} not found`); process.exit(1); }

// Clone an existing tournament's shape so we don't miss NOT NULL columns.
const { data: srcT } = await db.from('tournaments').select('*').eq('org_id', orgId).eq('slug', 'branded-light');
const src = srcT?.[0];
if (!src) { console.error('source tournament branded-light not found'); process.exit(1); }

// Wipe prior bye-demo (idempotent).
const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', SLUG);
for (const t of existing ?? []) {
  const { data: ds } = await db.from('divisions').select('id').eq('tournament_id', t.id);
  await db.from('games').delete().eq('tournament_id', t.id);
  await db.from('teams').delete().eq('tournament_id', t.id);
  if (ds?.length) await db.from('pools').delete().in('division_id', ds.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', t.id);
  await db.from('tournaments').delete().eq('id', t.id);
  console.log(`Wiped prior ${SLUG}`);
}

const today = new Date().toISOString().split('T')[0];
const end = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
const tid = randomUUID();
const newT: Record<string, unknown> = {
  ...src,
  id: tid,
  slug: SLUG,
  name: NAME,
  status: 'active',
  is_active: false,
  start_date: today,
  end_date: end,
  settings: { ...(src.settings ?? {}), format: 'playoff_only' },
};
delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
fail('insert tournament', (await db.from('tournaments').insert(newT)).error);

const divId = randomUUID();
fail('insert division', (await db.from('divisions').insert({
  id: divId,
  tournament_id: tid,
  name: DIV,
  display_order: 1,
  capacity: 16,
  pool_count: 0,
  requires_pool_selection: false,
  is_closed: false,
  schedule_visibility: 'published_teams',
  playoff_config: { type: 'single', format: 'single', crossover: 'reseed', teamsQualifying: TEAM_NAMES.length, hasThirdPlace: false, tieBreakers: ['h2h', 'rd', 'rf', 'ra'] },
}).select().single()).error);

const now = new Date().toISOString();
const teamRows = TEAM_NAMES.map((name, i) => ({
  id: randomUUID(),
  tournament_id: tid,
  division_id: divId,
  name,
  coach: `Coach ${name}`,
  email: `coach.${name.toLowerCase()}@example.com`,
  status: 'accepted',
  payment_status: 'paid',
  registered_at: new Date(Date.parse(now) - (TEAM_NAMES.length - i) * 60_000).toISOString(),
}));
fail('insert teams', (await db.from('teams').insert(teamRows)).error);

const byes = (() => { let p = 1; while (p < TEAM_NAMES.length) p *= 2; return p - TEAM_NAMES.length; })();
console.log(`\n✅ Seeded "${NAME}" — playoff-only, division "${DIV}", ${TEAM_NAMES.length} teams, no pools.`);
console.log(`   ${TEAM_NAMES.length} teams → 16-slot bracket → ${byes} byes (top ${byes} seeds skip round 1).`);
console.log(`\n   Admin: /${ORG_SLUG}/admin/tournaments/schedule (pick "${NAME}") → Playoff Bracket Builder`);
console.log(`     → Seed Teams (drag/Randomize, bye preview) → pick a format → Preview/Generate`);
