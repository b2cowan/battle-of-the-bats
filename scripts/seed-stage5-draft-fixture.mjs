/**
 * seed-stage5-draft-fixture.mjs — ONE THROWAWAY DRAFT on the Plus test club (Tournament admin redesign Stage 5, owner
 * 2026-10-10: "Yes, seed one draft").
 *
 * No test club held a draft, so the draft's board — Stage 5's "Before you activate" checklist, "Start from a past
 * tournament", the preview door — could not be probed, swept or walked. This seeds one, idempotently (looked up by its
 * public link first), on `uat-plus-org` (Tournament Plus):
 *
 *   UAT Stage 5 Draft · uat-stage5-draft · Draft · May 14–16 next year · no divisions, no venues, no rules
 *
 * Deliberately EMPTY: a draft with no divisions is the state the board offers "Start from a past tournament" in, and the
 * checklist's first open row ("Divisions") is the next step. It has no contact of its own, and the club has no email
 * today, so "Who teams can write to" reads "Your organization's owner, …" (since 2026-10-19 the owner is the last
 * contact, never missing). Walks that need a READY draft add a division on screen.
 *
 * --reset  delete the draft (and everything in it) first, then seed it again.
 *
 * ⚠ DEV ONLY. Reads .env.local and refuses to run against the production project.
 * Run: node --env-file=.env.local scripts/seed-stage5-draft-fixture.mjs [--reset]
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
if (url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const ORG_SLUG = 'uat-plus-org';
const SLUG = 'uat-stage5-draft';
const NAME = 'UAT Stage 5 Draft';
const reset = process.argv.includes('--reset');

const { data: org, error: orgError } = await db.from('organizations').select('id, name, plan_id').eq('slug', ORG_SLUG).maybeSingle();
if (orgError || !org) { console.error(`✗ ${ORG_SLUG} not found: ${orgError?.message ?? 'no row'}`); process.exit(1); }

const { data: existing, error: findError } = await db.from('tournaments').select('id, status').eq('org_id', org.id).eq('slug', SLUG).maybeSingle();
if (findError) { console.error(`✗ lookup: ${findError.message}`); process.exit(1); }

if (existing && reset) {
  const { error } = await db.from('tournaments').delete().eq('id', existing.id).eq('org_id', org.id);
  if (error) { console.error(`✗ reset: ${error.message}`); process.exit(1); }
  console.log(`  · deleted the old draft (${existing.id})`);
} else if (existing) {
  if (existing.status !== 'draft') {
    const { error } = await db.from('tournaments').update({ status: 'draft', is_active: false }).eq('id', existing.id);
    if (error) { console.error(`✗ back to draft: ${error.message}`); process.exit(1); }
    console.log('  · moved back to Draft');
  }
  console.log(`✓ ${NAME} already seeded — /${ORG_SLUG}/admin/tournaments/dashboard?tournamentId=${existing.id}`);
  process.exit(0);
}

const year = new Date().getFullYear() + 1;
const { data: created, error: insertError } = await db.from('tournaments').insert({
  org_id: org.id,
  name: NAME,
  slug: SLUG,
  year,
  status: 'draft',
  is_active: false,
  start_date: `${year}-05-14`,
  end_date: `${year}-05-16`,
}).select('id').single();
if (insertError) { console.error(`✗ insert: ${insertError.message}`); process.exit(1); }
console.log(`✓ ${NAME} seeded on ${org.name} — /${ORG_SLUG}/admin/tournaments/dashboard?tournamentId=${created.id}`);
