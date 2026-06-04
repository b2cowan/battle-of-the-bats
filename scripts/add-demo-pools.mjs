/**
 * Give a demo tournament's busiest division two pools and split its teams across
 * them — so the schedule scope picker (divisions → pools) has something to show.
 *
 * Idempotent: re-running wipes the division's pools first, then recreates them.
 * Runs for both live-demo and the source dev-tournament-2026 (so a re-seed keeps it).
 *
 * Run: node --env-file=.env.local scripts/add-demo-pools.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SLUGS = ['live-demo', 'dev-tournament-2026'];

const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error('org dev-test-org not found'); process.exit(1); }

for (const slug of SLUGS) {
  const { data: tours } = await db.from('tournaments').select('id, name').eq('org_id', orgId).eq('slug', slug);
  const t = tours?.[0];
  if (!t) { console.log(`- ${slug}: not found, skipping`); continue; }

  const { data: divs } = await db.from('divisions').select('id, name').eq('tournament_id', t.id);
  const { data: teams } = await db.from('teams').select('id, division_id, name').eq('tournament_id', t.id);

  // Pick the division with the most teams.
  const counts = {};
  (teams ?? []).forEach(tm => { counts[tm.division_id] = (counts[tm.division_id] || 0) + 1; });
  const divId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const div = (divs ?? []).find(d => d.id === divId);
  if (!div) { console.log(`- ${slug}: no division with teams, skipping`); continue; }
  const divTeams = (teams ?? []).filter(tm => tm.division_id === divId);
  if (divTeams.length < 2) { console.log(`- ${slug}: ${div.name} has <2 teams, skipping`); continue; }

  // Wipe existing pools for this division (idempotent).
  const { data: existing } = await db.from('pools').select('id').eq('division_id', divId);
  if (existing?.length) {
    await db.from('teams').update({ pool_id: null }).in('pool_id', existing.map(p => p.id));
    await db.from('pools').delete().eq('division_id', divId);
  }

  // Create two pools.
  const poolA = randomUUID(), poolB = randomUUID();
  const { error: pErr } = await db.from('pools').insert([
    { id: poolA, division_id: divId, name: 'Pool A', display_order: 0 },
    { id: poolB, division_id: divId, name: 'Pool B', display_order: 1 },
  ]);
  if (pErr) { console.error(`❌ ${slug} insert pools:`, pErr.message); process.exit(1); }

  // Tell the division it has 2 pools (UI consistency).
  await db.from('divisions').update({ pool_count: 2, pool_names: 'Pool A,Pool B', requires_pool_selection: true }).eq('id', divId);

  // Split teams across the two pools.
  const half = Math.ceil(divTeams.length / 2);
  for (let i = 0; i < divTeams.length; i++) {
    await db.from('teams').update({ pool_id: i < half ? poolA : poolB }).eq('id', divTeams[i].id);
  }

  console.log(`✅ ${slug}: ${div.name} → Pool A (${half} teams), Pool B (${divTeams.length - half} teams)`);
}

console.log('Done. Refresh the schedule page → the scope picker should show pools under that division.');
