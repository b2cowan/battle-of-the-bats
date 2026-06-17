/**
 * Throwaway seed for the Coach Nav Rebuild test (dev only). Creates a clean coach account
 * pre-loaded with the scenarios b2cowan@outlook.com can't show: MULTI-TEAM (dropdown) + an
 * ACCEPTED / LIVE registration (lifecycle chip + accepted portal). Idempotent-ish: deletes any
 * prior seed for this email first. Run: node scripts/seed-coach-nav-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const EMAIL = 'coach-navtest@dev.local';
const PASSWORD = 'devpass123';
const FIRST = 'Casey', LAST = 'Coach';

// Targets (from live dev): Live Demo (game-day window) + Battle of the Bats (upcoming).
const LIVE = { tournamentId: 'fb7ea6ee-cb7e-4c85-97f3-6f65481d9900', divisionId: '5d0c3f13-0000-0000-0000-000000000000' }; // U11 published — id resolved below
const BOTB = { tournamentId: 'b8f6d5ef-0f53-4841-85df-ac403cfb1db7', divisionId: '95f71662-0000-0000-0000-000000000000' };

async function resolveDiv(tournamentId, name) {
  const { data } = await sb.from('divisions').select('id').eq('tournament_id', tournamentId).eq('name', name).limit(1);
  return data?.[0]?.id ?? null;
}

async function main() {
  // ── Clean any prior seed ──
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find(u => (u.email || '').toLowerCase() === EMAIL);
  if (existing) {
    const { data: mem } = await sb.from('basic_coach_team_users').select('basic_coach_team_id').eq('user_id', existing.id);
    const teamIds = (mem || []).map(m => m.basic_coach_team_id);
    if (teamIds.length) {
      const { data: links } = await sb.from('basic_coach_team_registrations').select('tournament_team_id').in('basic_coach_team_id', teamIds);
      const regIds = (links || []).map(l => l.tournament_team_id);
      await sb.from('basic_coach_team_registrations').delete().in('basic_coach_team_id', teamIds);
      if (regIds.length) await sb.from('teams').delete().in('id', regIds);
      await sb.from('basic_coach_team_users').delete().eq('user_id', existing.id);
      await sb.from('basic_coach_teams').delete().in('id', teamIds);
    }
    await sb.auth.admin.deleteUser(existing.id);
    console.log('Cleaned prior seed for', EMAIL);
  }

  // ── Auth user (confirmed, password set) ──
  const { data: created, error: uErr } = await sb.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: FIRST, last_name: LAST, full_name: `${FIRST} ${LAST}` },
  });
  if (uErr) throw uErr;
  const userId = created.user.id;
  console.log('Created auth user', EMAIL, userId);

  const liveDiv = await resolveDiv(LIVE.tournamentId, 'U11');
  const botbDiv = await resolveDiv(BOTB.tournamentId, 'U11');

  // ── Two teams, each with an ACCEPTED registration ──
  const teams = [
    { name: 'Hamilton Hawks', tournamentId: LIVE.tournamentId, divisionId: liveDiv },   // live/game-day chip
    { name: 'Burlington Bears', tournamentId: BOTB.tournamentId, divisionId: botbDiv }, // upcoming chip
  ];

  for (const t of teams) {
    const { data: bt, error: btErr } = await sb.from('basic_coach_teams').insert({
      name: t.name, normalized_name: t.name.toLowerCase(),
      primary_coach_name: `${FIRST} ${LAST}`, primary_coach_email: EMAIL,
      source: 'tournament_registration', activated_features: [],
    }).select('id').single();
    if (btErr) throw btErr;

    await sb.from('basic_coach_team_users').insert({
      basic_coach_team_id: bt.id, user_id: userId, role: 'owner', status: 'active',
    });

    const { data: reg, error: rErr } = await sb.from('teams').insert({
      tournament_id: t.tournamentId, division_id: t.divisionId, name: t.name,
      coach: `${FIRST} ${LAST}`, email: EMAIL, status: 'accepted',
      payment_status: 'pending', registered_at: '2026-06-01T12:00:00Z',
    }).select('id').single();
    if (rErr) throw rErr;

    await sb.from('basic_coach_team_registrations').insert({
      basic_coach_team_id: bt.id, tournament_team_id: reg.id,
      linked_by_user_id: userId, link_source: 'registration_flow',
    });

    console.log(`  ${t.name}: team ${bt.id.slice(0, 8)} + accepted reg ${reg.id.slice(0, 8)} in tournament ${t.tournamentId.slice(0, 8)}`);
  }

  console.log('\n=== SEED COMPLETE ===');
  console.log('Login:', EMAIL, '/', PASSWORD);
  console.log('2 teams (multi-team dropdown), both ACCEPTED: Hamilton Hawks (Live Demo, game-day) + Burlington Bears (Battle of the Bats, upcoming).');
}

main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
