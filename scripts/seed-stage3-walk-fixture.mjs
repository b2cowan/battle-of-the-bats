/**
 * seed-stage3-walk-fixture.mjs — ONE THROWAWAY EVENT for the Stage 3 (the schedule) owner walks (Tournament admin
 * redesign; owner 2026-10-11: "yes add the stage 3 walk").
 *
 * The schedule's build walks need an event whose games are still to come: the day opens on an event's first day before
 * it, the rain delay is offered only for games dated today or later, and the round-robin generator, a move with Undo and
 * Publish all need an event nobody else's walk reads. The Plus test club's Championship is in June (past) and the club
 * fixture's invitational belongs to the Club Tier walks, so this seeds its own, idempotently, on `uat-plus-org`:
 *
 *   UAT Stage 3 Walk · uat-stage3-walk · Active · next Saturday–Sunday (at least three days out) · NO games
 *
 * A copy of the Championship 2026's STRUCTURE only — its divisions (each unpublished), pools and numbered pool spots,
 * accepted and waitlisted teams (in their pools and spots), venues with their diamonds, settings and fees. No games, no scores, no check-ins, no account
 * links. Nothing in it can email a real person: the teams' addresses are `@example.test` (the Championship's own; any
 * other is rewritten), the contact is the UAT owner's `.local` address, and results emails are off.
 *
 * --reset   delete it (and everything in it) first, then seed it again on fresh dates.
 * --remove  delete it and stop (after the owner signs the walks off).
 * --playoffs-only   the SECOND throwaway event instead, for the Playoff generator's walk (Stage 3 addendum, 2026-10-12):
 *           "UAT Stage 3 Playoffs Only" · uat-stage3-playoffs-only · the same copy with the event's format set to
 *           playoffs only (no round robin), and each division's accepted teams given seed numbers in REVERSE name order,
 *           so "By seed number" visibly reorders the seed list. Combine with --reset / --remove.
 *
 * ⚠ DEV ONLY. Reads .env.local and refuses to run against the production project.
 * Run: node --env-file=.env.local scripts/seed-stage3-walk-fixture.mjs [--reset | --remove]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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
const SOURCE_SLUG = 'uat-phase2c-plus-championship-2026';
const playoffsOnly = process.argv.includes('--playoffs-only');
const SLUG = playoffsOnly ? 'uat-stage3-playoffs-only' : 'uat-stage3-walk';
const NAME = playoffsOnly ? 'UAT Stage 3 Playoffs Only' : 'UAT Stage 3 Walk';
const CONTACT = 'uat-owner@uat-test-org.local';
const reset = process.argv.includes('--reset');
const remove = process.argv.includes('--remove');

const fail = (label, error) => { console.error(`✗ ${label}: ${error?.message ?? error}`); process.exit(1); };
const chk = (label, { error }) => { if (error) fail(label, error); };

const { data: org, error: orgError } = await db.from('organizations').select('id, name').eq('slug', ORG_SLUG).maybeSingle();
if (orgError || !org) fail(`${ORG_SLUG} not found`, orgError ?? 'no row');

const { data: existing, error: findError } = await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', SLUG).maybeSingle();
if (findError) fail('lookup', findError);

if (existing && (reset || remove)) {
  chk('delete', await db.from('tournaments').delete().eq('id', existing.id).eq('org_id', org.id));
  console.log(`  · deleted ${NAME} (${existing.id})`);
} else if (existing) {
  console.log(`✓ ${NAME} already seeded — /${ORG_SLUG}/admin/tournaments/schedule?tournamentId=${existing.id}`);
  process.exit(0);
}
if (remove) { if (!existing) console.log(`  · ${NAME} was not there`); process.exit(0); }

// ── the source's structure ──
const { data: src, error: srcError } = await db.from('tournaments').select('*').eq('org_id', org.id).eq('slug', SOURCE_SLUG).maybeSingle();
if (srcError || !src) fail(`source ${SOURCE_SLUG}`, srcError ?? 'no row');
const read = async (label, q) => { const { data, error } = await q; if (error) fail(label, error); return data ?? []; };
const divisions = await read('divisions', db.from('divisions').select('*').eq('tournament_id', src.id));
const pools = divisions.length ? await read('pools', db.from('pools').select('*').in('division_id', divisions.map(d => d.id))) : [];
const teams = await read('teams', db.from('teams').select('*').eq('tournament_id', src.id).in('status', ['accepted', 'waitlist']));
const venues = await read('venues', db.from('diamonds').select('*').eq('tournament_id', src.id));
const facilities = venues.length ? await read('facilities', db.from('venue_facilities').select('*').in('venue_id', venues.map(v => v.id))) : [];

// ── next Saturday at least three days out, and the Sunday after ──
const DAY = 86_400_000;
const iso = d => d.toISOString().slice(0, 10);
const now = new Date();
const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
let sat = new Date(today.getTime() + 3 * DAY);
while (sat.getUTCDay() !== 6) sat = new Date(sat.getTime() + DAY);
const start = iso(sat), end = iso(new Date(sat.getTime() + DAY));

// ── the event ──
const tid = randomUUID();
const event = {
  ...src,
  id: tid, name: NAME, slug: SLUG, year: sat.getUTCFullYear(),
  status: 'active', is_active: false,                 // the club's own active event keeps its flag
  start_date: start, end_date: end,
  contact_email: CONTACT, default_contact_member_id: null,
  notify_teams_on_complete: false, results_notified_at: null, results_notification_sent_count: 0,
  list_in_directory: false, playoffs_published_at: null, champions_crowned_at: null,
  chat_reminder_last_sent_at: null, chat_reminder_last_sent_by: null, chat_reminder_last_sent_count: null,
  ...(playoffsOnly ? { settings: { ...(src.settings ?? {}), format: 'playoff_only' } } : {}),
};
delete event.created_at;
chk('insert event', await db.from('tournaments').insert(event));

const divMap = {}, poolMap = {}, venueMap = {};
for (const d of divisions) {
  divMap[d.id] = randomUUID();
  // A fresh event has announced nothing: the source's "Playoffs are set" stamp (mig 327) must not ride along, or the
  // walk's publish never announces.
  const row = { ...d, id: divMap[d.id], tournament_id: tid, schedule_visibility: 'unpublished', playoffs_announced_at: null };
  delete row.created_at;
  chk(`division ${d.name}`, await db.from('divisions').insert(row));
}
for (const p of pools) {
  poolMap[p.id] = randomUUID();
  const row = { ...p, id: poolMap[p.id], division_id: divMap[p.division_id] };
  delete row.created_at;
  chk(`pool ${p.name}`, await db.from('pools').insert(row));
}
// A division placed by numbered pool spots (U11, U13): the spots first, empty; the teams name theirs; then each spot
// names its team (the link is written both ways, as the teams API does).
const slots = pools.length ? await read('pool slots', db.from('pool_slots').select('*').in('pool_id', pools.map(p => p.id))) : [];
const slotMap = {}, teamMap = {};
for (const s of slots) {
  slotMap[s.id] = randomUUID();
  const row = { ...s, id: slotMap[s.id], pool_id: poolMap[s.pool_id], division_id: divMap[s.division_id], tournament_id: tid, team_id: null };
  delete row.created_at;
  chk(`pool slot ${s.id}`, await db.from('pool_slots').insert(row));
}
const safe = (addr, name) => (addr && /@example\.test$/i.test(addr) ? addr : `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`);
// --playoffs-only: each division's accepted teams get seed numbers in REVERSE name order (Z… is seed 1).
const seedOf = {};
if (playoffsOnly) {
  for (const d of divisions) {
    const accepted = teams.filter(t => t.division_id === d.id && t.status === 'accepted').sort((a, b) => String(b.name).localeCompare(String(a.name)));
    accepted.forEach((t, i) => { seedOf[t.id] = i + 1; });
  }
}
for (const t of teams) {
  teamMap[t.id] = randomUUID();
  const row = {
    ...t, id: teamMap[t.id], tournament_id: tid, division_id: divMap[t.division_id],
    pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null, slot_id: t.slot_id ? slotMap[t.slot_id] ?? null : null, seed: seedOf[t.id] ?? null,
    email: safe(t.email, t.name), coach_email: t.coach_email ? safe(t.coach_email, t.name) : null,
    check_in_status: 'not_arrived', checked_in_at: null, checked_in_by_user_id: null, checked_in_by_name: null, check_in_notes: null,
    roster_submitted_at: null, roster_confirmed_at: null,
  };
  delete row.created_at;
  chk(`team ${t.name}`, await db.from('teams').insert(row));
}
for (const s of slots) {
  if (!s.team_id || !teamMap[s.team_id]) continue;
  chk(`pool slot team ${s.id}`, await db.from('pool_slots').update({ team_id: teamMap[s.team_id] }).eq('id', slotMap[s.id]));
}
for (const v of venues) {
  venueMap[v.id] = randomUUID();
  const row = { ...v, id: venueMap[v.id], tournament_id: tid };
  delete row.created_at;
  chk(`venue ${v.name}`, await db.from('diamonds').insert(row));
}
for (const f of facilities) {
  const row = { ...f, id: randomUUID(), tournament_id: tid, venue_id: venueMap[f.venue_id] };
  delete row.created_at;
  chk(`facility ${f.name}`, await db.from('venue_facilities').insert(row));
}

console.log(`✓ ${NAME} seeded on ${org.name}${playoffsOnly ? ' (playoffs only, seeds in reverse name order)' : ''}: ${start} – ${end} · ${divisions.length} divisions (unpublished) · ${pools.length} pools · ${slots.length} pool spots · ${teams.length} teams · ${venues.length} venues · ${facilities.length} diamonds · no games`);
console.log(`  /${ORG_SLUG}/admin/tournaments/schedule?tournamentId=${tid}`);
