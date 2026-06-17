/**
 * Seed test fixtures for FP-5 Cluster 5 (Registrations + Staffing).
 *
 * Separate from the Cluster-4 fixture (which is deliberately EMPTY — it tests the
 * fees-optional / contact-gate path, so it must NOT have fees or teams). This
 * provisions a fully-populated tournament so the Cluster-5 registration fixes are
 * pure click-throughs, and an invited official for the staffing items.
 *
 * Shared login:  fp5-owner@dev.local  /  devpass123   (reused from Cluster 4)
 *
 * Org — "FP5 Cluster5 Test"  slug=fp5-c5-test   (plan tournament_plus — the
 *   payment surfaces J1-067/068/069 are Plus-gated, so we need Plus here)
 *
 *   Tournament "Slot Cup" slug=slot-cup, status=active:
 *     • fee schedule: $100 deposit / $500 total, tournament-wide
 *     • settings.payment_instructions PRE-FILLED (so J1-069 shows the saved text,
 *       not the generic placeholder)
 *     • division "U13": 2 pools (A,B) × 3 slots = 6 slots
 *         - 4 slots FILLED with accepted teams (one marked PAID, others pending)
 *         - 2 slots LEFT OPEN  → so accepting a 5th team auto-claims a slot (J1-066)
 *           and accepting a 6th/7th overflows into "Accepted — needs a spot"
 *         - 2 WAITLISTED teams (waitlist_position 1,2)
 *         - 1 PENDING team (no slot, awaiting accept) → accept it to watch
 *           auto-claim drop it into an open slot
 *
 *   Staffing fixture:
 *     • one INVITED official member (gate-helper@dev.local, role=official,
 *       status=invited) so the members list shows a scorekeeper invite to inspect
 *       (J1-077 — the invite always routes officials to /scorekeeper today).
 *
 * Idempotent: re-running wipes + recreates Slot Cup (org + users reused).
 *
 * Run: node --env-file=.env.local scripts/seed-fp5-cluster5.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OWNER_EMAIL = 'fp5-owner@dev.local';
const PASSWORD = 'devpass123';
const OFFICIAL_EMAIL = 'gate-helper@dev.local';

const ORG = { slug: 'fp5-c5-test', name: 'FP5 Cluster5 Test', plan: 'tournament_plus' };
const TOURN_SLUG = 'slot-cup';
const TOURN_NAME = 'Slot Cup';
const DIVISION = 'U13';

const DAY = 86_400_000;
const iso = (d) => d.toISOString().split('T')[0];
const today = new Date();
const startDate = iso(new Date(today.getTime() + 14 * DAY));
const endDate = iso(new Date(today.getTime() + 16 * DAY));
const depositDue = iso(new Date(today.getTime() + 5 * DAY));
const totalDue = iso(new Date(today.getTime() + 10 * DAY));

const PAYMENT_INSTRUCTIONS =
  'E-transfer to treasurer@slotcup.ca (password: slotcup2026). Put your team name + division in the memo. Balance due by the date above.';

function die(label, error) { if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); } }

// ── 1. shared owner auth user (reuse Cluster-4 login) ─────────────────────────
const { data: userList } = await db.auth.admin.listUsers();
let owner = userList?.users.find(u => u.email === OWNER_EMAIL);
if (!owner) {
  const { data, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
  die('createUser owner', error); owner = data.user;
  console.log(`created auth user ${OWNER_EMAIL}`);
} else {
  console.log(`auth user exists ${OWNER_EMAIL}`);
}

// official auth user (so the invite has a real identity to attach to if accepted)
let official = userList?.users.find(u => u.email === OFFICIAL_EMAIL);
if (!official) {
  const { data, error } = await db.auth.admin.createUser({ email: OFFICIAL_EMAIL, password: PASSWORD, email_confirm: true });
  die('createUser official', error); official = data.user;
  console.log(`created auth user ${OFFICIAL_EMAIL}`);
} else {
  console.log(`auth user exists ${OFFICIAL_EMAIL}`);
}

// ── 2. org + owner membership ─────────────────────────────────────────────────
let org = (await db.from('organizations').select('*').eq('slug', ORG.slug).maybeSingle()).data;
if (!org) {
  const row = {
    id: randomUUID(), name: ORG.name, slug: ORG.slug,
    plan_id: ORG.plan, subscription_status: 'active', tournament_limit: 1,
    is_public: true, theme_preset: 'platform', onboarding_completed_at: new Date().toISOString(),
  };
  die('insert org', (await db.from('organizations').insert(row)).error);
  org = row;
  console.log(`created org ${ORG.slug} (plan_id=${ORG.plan})`);
} else {
  if (org.plan_id !== ORG.plan) {
    die('reset plan', (await db.from('organizations').update({ plan_id: ORG.plan }).eq('id', org.id)).error);
  }
  console.log(`org exists ${ORG.slug} (plan_id=${ORG.plan})`);
}

async function ensureMember(userId, role, status) {
  let m = (await db.from('organization_members')
    .select('id, role, status').eq('organization_id', org.id).eq('user_id', userId).maybeSingle()).data;
  if (!m) {
    const id = randomUUID();
    const row = { id, organization_id: org.id, user_id: userId, role, status };
    if (status === 'active') row.accepted_at = new Date().toISOString();
    die(`insert member ${role}`, (await db.from('organization_members').insert(row)).error);
    console.log(`linked ${role} (${status}) member`);
    return id;
  }
  // keep role/status in sync on re-run
  if (m.role !== role || m.status !== status) {
    die(`update member ${role}`, (await db.from('organization_members').update({ role, status }).eq('id', m.id)).error);
  }
  return m.id;
}

await ensureMember(owner.id, 'owner', 'active');
// J1-077 staffing fixture: an INVITED official (scorekeeper) to inspect on the members page.
await ensureMember(official.id, 'official', 'invited');

// ── 3. wipe prior Slot Cup (idempotent) ───────────────────────────────────────
const prior = (await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', TOURN_SLUG)).data ?? [];
for (const t of prior) {
  const divs = (await db.from('divisions').select('id').eq('tournament_id', t.id)).data ?? [];
  await db.from('games').delete().eq('tournament_id', t.id);
  // clear slot links before deleting teams/slots
  await db.from('teams').delete().eq('tournament_id', t.id);
  if (divs.length) {
    const pools = (await db.from('pools').select('id').in('division_id', divs.map(d => d.id))).data ?? [];
    if (pools.length) await db.from('pool_slots').delete().in('pool_id', pools.map(p => p.id));
    await db.from('pools').delete().in('division_id', divs.map(d => d.id));
  }
  await db.from('venue_facilities').delete().eq('tournament_id', t.id);
  await db.from('diamonds').delete().eq('tournament_id', t.id);
  await db.from('divisions').delete().eq('tournament_id', t.id);
  await db.from('tournaments').delete().eq('id', t.id);
  console.log('wiped prior Slot Cup');
}

// ── 4. tournament — ACTIVE, tournament-wide fee schedule + saved instructions ──
const tid = randomUUID();
die('insert tournament', (await db.from('tournaments').insert({
  id: tid, org_id: org.id, slug: TOURN_SLUG, name: TOURN_NAME, year: 2026,
  status: 'active', is_active: true, start_date: startDate, end_date: endDate,
  fee_schedule_mode: 'tournament',
  deposit_amount: 100, deposit_due_date: depositDue,
  total_fee_amount: 500, total_fee_due_date: totalDue,
  contact_email: 'organizer@slotcup.ca',
  settings: { fee_scope: 'tournament', payment_instructions: PAYMENT_INSTRUCTIONS },
})).error);

// ── 5. division (open) + 2 pools × 3 slots ────────────────────────────────────
const did = randomUUID();
die('insert division', (await db.from('divisions').insert({
  id: did, tournament_id: tid, name: DIVISION, is_closed: false,
  pool_count: 2, pool_names: 'A,B', settings: {},
})).error);

const pools = [];
for (let i = 0; i < 2; i++) {
  const pid = randomUUID();
  die('insert pool', (await db.from('pools').insert({
    id: pid, division_id: did, name: ['A', 'B'][i], display_order: i,
  })).error);
  pools.push(pid);
}

// 3 slots per pool
const slots = []; // { id, poolId, displayName }
for (let p = 0; p < pools.length; p++) {
  for (let s = 1; s <= 3; s++) {
    const sid = randomUUID();
    const displayName = `${['A', 'B'][p]} Team ${s}`;
    die('insert pool_slot', (await db.from('pool_slots').insert({
      id: sid, pool_id: pools[p], tournament_id: tid, division_id: did,
      slot_number: s, display_name: displayName, team_id: null,
    })).error);
    slots.push({ id: sid, poolId: pools[p], displayName });
  }
}

// ── 6. teams in mixed states ──────────────────────────────────────────────────
// Helper to insert one team. slotIndex assigns into slots[] (and mirrors both sides).
let teamN = 0;
async function addTeam({ name, status, paymentStatus = 'pending', deposit = 0, total = 0, slotIndex = null, waitlist = null }) {
  teamN++;
  const teamId = randomUUID();
  die(`insert team ${name}`, (await db.from('teams').insert({
    id: teamId, tournament_id: tid, division_id: did,
    name, coach: `Coach ${teamN}`, email: `coach${teamN}@slotcup.ca`,
    status, payment_status: paymentStatus,
    deposit_paid: deposit, total_paid: total,
    slot_id: slotIndex != null ? slots[slotIndex].id : null,
    waitlist_position: waitlist,
    registered_at: new Date().toISOString(),
  })).error);
  // bidirectional slot link (gotcha: write BOTH sides)
  if (slotIndex != null) {
    die(`link slot ${name}`, (await db.from('pool_slots').update({ team_id: teamId }).eq('id', slots[slotIndex].id)).error);
  }
  return teamId;
}

// 4 accepted + placed (fill slots 0,1,2,3 → leaves slots 4,5 OPEN in pool B)
await addTeam({ name: 'River Hawks',  status: 'accepted', paymentStatus: 'paid',    deposit: 100, total: 500, slotIndex: 0 });
await addTeam({ name: 'Bay Bombers',  status: 'accepted', paymentStatus: 'pending', deposit: 100, total: 0,   slotIndex: 1 });
await addTeam({ name: 'Hill Toppers',  status: 'accepted', paymentStatus: 'pending', deposit: 0,   total: 0,   slotIndex: 2 });
await addTeam({ name: 'Lake Lightning', status: 'accepted', paymentStatus: 'pending', deposit: 0, total: 0,   slotIndex: 3 });

// 2 waitlisted (no slot)
await addTeam({ name: 'Pine Panthers',  status: 'waitlist', waitlist: 1 });
await addTeam({ name: 'Cedar Cyclones', status: 'waitlist', waitlist: 2 });

// 1 pending (no slot) — accept this to watch J1-066 auto-claim drop it into an open slot
await addTeam({ name: 'Maple Mavericks', status: 'pending' });

console.log(`\n✅ Seeded FP-5 Cluster 5 fixtures`);
console.log(`\n   Shared login:  ${OWNER_EMAIL} / ${PASSWORD}`);
console.log(`\n   Registrations (J1-066/067/068/069):`);
console.log(`     Teams:     /${ORG.slug}/admin/tournaments/registrations?tournamentId=${tid}`);
console.log(`     Dashboard: /${ORG.slug}/admin/tournaments/dashboard`);
console.log(`     • U13: 2 pools × 3 slots — 4 filled, 2 OPEN, 2 waitlisted, 1 pending`);
console.log(`     • Accept "Maple Mavericks" (pending) → auto-claims an open slot (J1-066)`);
console.log(`     • Promote both waitlisted teams to fill the last 2 open slots, then accept`);
console.log(`       another to see the "Accepted — needs a spot" overflow list`);
console.log(`     • Fee schedule $100/$500 + saved payment instructions → money strip (J1-068),`);
console.log(`       dashboard payment links (J1-067), reminder pre-fill (J1-069)`);
console.log(`\n   Staffing (J1-077):`);
console.log(`     Members:   /${ORG.slug}/admin/org/members`);
console.log(`     • ${OFFICIAL_EMAIL} invited as an official (scorekeeper) to inspect the invite path`);

// Explicit clean exit — the supabase-js client can keep the event loop alive, which
// otherwise surfaces as a non-zero exit after the work has already succeeded.
process.exit(0);
