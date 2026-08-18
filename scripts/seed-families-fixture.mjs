/**
 * seed-families-fixture.mjs — the MESSY FIXTURE CLUB (Families Book P2, chunk A).
 *
 * Seeds a throwaway org (`qa-families-fixture`) carrying every failure case the
 * Families area exists to handle — because production is empty, we build a broken
 * club on purpose and iterate against it (plan §5, reordering note 1). This is the
 * permanent test bed for the worklist, the family page and the duplicate queue.
 *
 * ⚠ NEVER seed any of this into `riverdale-*` (the public demo worlds).
 *
 * The manufactured cases, and which screen each exercises:
 *   1. Same parent, spelling variants that DON'T normalize away
 *      (dana.cole@example.com vs d.cole@outlook.example, same surname + phone)
 *      → the duplicate queue's surname+phone proposal.
 *   2. A parent who changed address mid-season (family_link invited → claimed)
 *      → former address searchable; person with two addresses.
 *   3. Siblings split across a rep team and house league (Reyes: two rep + one
 *      league child; Aoki-Sharma: rep child + league child on a shared inbox)
 *      → THE cross-programme household, zero occurrences in real data.
 *   4. A shared family inbox under two surnames (family.aoki.sharma@…)
 *      → one person, two child surnames — the report's human-judgement case.
 *   5. An opt-out filed under an address the parent no longer uses
 *      (family_email_optouts on the OLD address of case 2)
 *      → the suppression-through-the-person problem Phase 3 must close.
 *   6. Children naming no guardian at all (2 roster rows)
 *      → the worklist's "No family on file" lens.
 *   7. Overdue dues, one family reminded, one never
 *      → the owes-money lens + the "Chased" column.
 *   8. Missing forms (waiver/medical templates with gaps)
 *      → the missing-forms lens (rep-only, per §5.3 gap 7).
 *   9. Families in a COMPLETED league season with nothing this season
 *      → the "not back this season" lens.
 *  10. A league registration with waiver_accepted_at recorded (mig 252) and
 *      others without → the consent panel's honest split.
 *
 * Idempotent: every insert is keyed on a natural lookup first. Ends by calling
 * families_attach_people(org) — the same attach the area runs — and printing
 * a summary. Run: node scripts/seed-families-fixture.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '..', '.env.local'), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (url.includes('qcttcboqysynwcdyghil')) { console.error('✗ Refusing to run against PRODUCTION.'); process.exit(1); }

const db = createClient(url, key);
const ok = (m) => console.log(`  ✓ ${m}`);
const die = (step, error) => { console.error(`✗ ${step}:`, error?.message ?? error); process.exit(1); };

const ORG_SLUG = 'qa-families-fixture';
const YEAR = 2026;

// ── 1. The throwaway org ──────────────────────────────────────────────────────
let { data: org } = await db.from('organizations').select('id, slug').eq('slug', ORG_SLUG).maybeSingle();
if (!org) {
  const ins = await db.from('organizations').insert({
    name: 'QA Families Fixture (throwaway)', slug: ORG_SLUG,
    plan_id: 'club', subscription_status: 'active',
    is_public: false, is_discoverable: false,
    internal_notes: 'Families Book P2 chunk A — the messy fixture club. Safe to wipe.',
  }).select('id, slug').single();
  if (ins.error) die('org insert', ins.error);
  org = ins.data;
}
ok(`org ${org.slug} (${org.id})`);

// ── 2. Rep team + program years (2026 active, 2025 completed) ─────────────────
async function ensureTeam(name, slug) {
  let { data: t } = await db.from('rep_teams').select('id, name').eq('org_id', org.id).eq('slug', slug).maybeSingle();
  if (!t) {
    const ins = await db.from('rep_teams').insert({ org_id: org.id, name, slug }).select('id, name').single();
    if (ins.error) die(`team ${slug}`, ins.error);
    t = ins.data;
  }
  return t;
}
async function ensureProgramYear(teamId, year, status) {
  let { data: p } = await db.from('rep_program_years').select('id, year').eq('team_id', teamId).eq('year', year).maybeSingle();
  if (!p) {
    const ins = await db.from('rep_program_years')
      .insert({ team_id: teamId, org_id: org.id, name: `${year} Season`, year, status })
      .select('id, year').single();
    if (ins.error) die(`program year ${year}`, ins.error);
    p = ins.data;
  }
  return p;
}
const team = await ensureTeam('Fixture Falcons U13', 'fixture-falcons-u13');
const py = await ensureProgramYear(team.id, YEAR, 'active');
const pyPast = await ensureProgramYear(team.id, YEAR - 1, 'completed');
ok(`rep team + program years ${YEAR} (active) / ${YEAR - 1} (completed)`);

// ── 3. Roster — the manufactured guardians ────────────────────────────────────
// [first, last, guardianFirst, guardianLast, email, phone]
const ROSTER = [
  ['Morgan', 'Reyes',        'Alex', 'Reyes',     'alex.reyes@example.com',         '555-0100'], // multi-child + cross-programme (league Milan)
  ['Riley',  'Reyes',        'Alex', 'Reyes',     'Alex.Reyes@Example.com',         '555-0100'], // spelling variant that DOES normalize away → same person
  ['Casey',  'Nguyen-Ortiz', null,   null,        null,                             null      ], // no guardian at all
  ['Devon',  'Nguyen-Ortiz', null,   null,        null,                             null      ], // no guardian at all
  ['Peyton', 'Cole',         'Dana', 'Cole',      'dana.cole@example.com',          '555-0101'], // duplicate pair half A
  ['Quinn',  'Aoki',         'Lee',  'Aoki',      'family.aoki.sharma@example.com', '555-0102'], // shared inbox, two surnames + cross-programme
  ['Rowan',  'Petit',        'Noor', 'Petit',     'noor.p@old.example',             '555-0103'], // address change mid-season (link claims new)
  ['Sasha',  'Ionescu',      'Ilie', 'Ionescu',   'ilie.ionescu@example.com',       '555-0104'], // owes + REMINDED
  ['Tatum',  'Whitehall',    'Val',  'Whitehall', 'val.whitehall@example.com',      '555-0105'], // owes + NEVER reminded
];
const { data: existingRoster } = await db.from('rep_roster_players')
  .select('id, player_first_name, player_last_name').eq('program_year_id', py.id);
const rosterByName = new Map((existingRoster ?? []).map(r => [`${r.player_first_name} ${r.player_last_name}`, r]));
const playerIds = {};
for (let i = 0; i < ROSTER.length; i++) {
  const [first, last, gFirst, gLast, gEmail, gPhone] = ROSTER[i];
  const nameKey = `${first} ${last}`;
  let row = rosterByName.get(nameKey);
  if (!row) {
    const ins = await db.from('rep_roster_players').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      player_first_name: first, player_last_name: last, player_number: String(i + 1),
      guardian_first_name: gFirst, guardian_last_name: gLast,
      guardian_email: gEmail, guardian_phone: gPhone,
      status: 'active', source: 'admin_manual', display_order: i,
    }).select('id, player_first_name, player_last_name').single();
    if (ins.error) die(`roster ${nameKey}`, ins.error);
    row = ins.data;
  }
  playerIds[nameKey] = row.id;
}
ok(`roster ${YEAR}: ${ROSTER.length} children (2 with no guardian)`);

// Last season's roster: a rep family that did NOT come back (not-back lens, rep side).
if (!rosterByName.has('Harlow Grant')) {
  const { data: pastRow } = await db.from('rep_roster_players')
    .select('id').eq('program_year_id', pyPast.id).eq('player_last_name', 'Grant').maybeSingle();
  if (!pastRow) {
    const ins = await db.from('rep_roster_players').insert({
      program_year_id: pyPast.id, team_id: team.id, org_id: org.id,
      player_first_name: 'Harlow', player_last_name: 'Grant', player_number: '12',
      guardian_first_name: 'Jesse', guardian_last_name: 'Grant',
      guardian_email: 'j.grant@example.com', guardian_phone: '555-0106',
      status: 'active', source: 'admin_manual', display_order: 0,
    });
    if (ins.error) die('past roster Grant', ins.error);
  }
}
ok(`roster ${YEAR - 1}: the Grant family (won't return)`);

// ── 4. Tryout row — duplicate pair half B ─────────────────────────────────────
// Same child (Peyton Cole), same surname + phone, DIFFERENT address that does
// not normalize away → surname+phone AND surname+shared-child proposals.
{
  const { data: t } = await db.from('rep_tryout_registrations')
    .select('id').eq('org_id', org.id).eq('guardian_email', 'd.cole@outlook.example').maybeSingle();
  if (!t) {
    const ins = await db.from('rep_tryout_registrations').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      player_first_name: 'Peyton', player_last_name: 'Cole',
      guardian_first_name: 'D.', guardian_last_name: 'Cole',
      guardian_email: 'd.cole@outlook.example', guardian_phone: '555-0101',
      status: 'pending_review', consent_data_collection: true, consent_at: new Date().toISOString(),
    });
    if (ins.error) die('tryout Cole', ins.error);
  }
}
ok('tryout row: the Cole duplicate pair (surname+phone, surname+child)');

// ── 5. Family link — the address change (invited → claimed) ───────────────────
{
  const { data: fl } = await db.from('family_links')
    .select('id').eq('org_id', org.id).eq('invited_email', 'noor.p@old.example').maybeSingle();
  if (!fl) {
    const ins = await db.from('family_links').insert({
      org_id: org.id, rep_team_id: team.id, role: 'guardian',
      player_id: playerIds['Rowan Petit'],
      invited_email: 'noor.p@old.example', claimed_email: 'noor.petit@example.com',
      status: 'verified', verified_via: 'coach_approved',
      relationship: 'Parent', approved_at: new Date().toISOString(),
    });
    if (ins.error) die('family link Petit', ins.error);
  }
}
ok('family link: Noor Petit changed address (noor.p@old.example → noor.petit@example.com)');

// ── 6. The opt-out filed under the FORMER address ─────────────────────────────
{
  const { data: opt } = await db.from('family_email_optouts')
    .select('id').eq('org_id', org.id).eq('email', 'noor.p@old.example').maybeSingle();
  if (!opt) {
    const ins = await db.from('family_email_optouts').insert({
      org_id: org.id, email: 'noor.p@old.example', source: 'announcement_footer',
    });
    if (ins.error) die('optout Petit', ins.error);
  }
}
ok('opt-out on the OLD address — the danger case Phase 3 must resolve through the person');

// ── 7. Dues — owes money + the Chased column ──────────────────────────────────
async function ensureDues(nameKey, { paid, reminded }) {
  const playerId = playerIds[nameKey];
  const { data: sched } = await db.from('rep_player_dues_schedules')
    .select('id').eq('program_year_id', py.id).eq('player_id', playerId).maybeSingle();
  if (sched) return;
  const ins = await db.from('rep_player_dues_schedules').insert({
    org_id: org.id, team_id: team.id, program_year_id: py.id,
    player_id: playerId, total_amount: 450,
  }).select('id').single();
  if (ins.error) die(`dues schedule ${nameKey}`, ins.error);
  const mk = (n, daysAgoDue) => ({
    schedule_id: ins.data.id, player_id: playerId, org_id: org.id, team_id: team.id,
    installment_number: n, amount: 150,
    due_date: new Date(Date.now() - daysAgoDue * 86_400_000).toISOString().slice(0, 10),
    paid_at: paid > (n - 1) ? new Date(Date.now() - daysAgoDue * 86_400_000).toISOString() : null,
    reminder_sent_at: (!(paid > (n - 1)) && reminded) ? new Date(Date.now() - 14 * 86_400_000).toISOString() : null,
  });
  const ii = await db.from('rep_player_dues_installments').insert([mk(1, 90), mk(2, 45), mk(3, 10)]);
  if (ii.error) die(`dues installments ${nameKey}`, ii.error);
}
await ensureDues('Morgan Reyes',    { paid: 3, reminded: false }); // fully paid
await ensureDues('Riley Reyes',     { paid: 2, reminded: false }); // owes 150, never reminded
await ensureDues('Sasha Ionescu',   { paid: 1, reminded: true  }); // owes 300, REMINDED
await ensureDues('Tatum Whitehall', { paid: 0, reminded: false }); // owes 450, never
ok('dues: Reyes paid/owing split · Ionescu reminded · Whitehall never chased');

// ── 8. Forms — templates + gaps (missing-forms lens) ──────────────────────────
async function ensureTemplate(name, type) {
  const { data: t } = await db.from('rep_document_templates')
    .select('id').eq('org_id', org.id).eq('name', name).maybeSingle();
  if (t) return t.id;
  const ins = await db.from('rep_document_templates').insert({
    org_id: org.id, team_id: team.id, name, document_type: type,
    storage_path: `fixtures/${ORG_SLUG}/${type}.pdf`, file_name: `${type}.pdf`, file_size: 1024,
    is_active: true,
  }).select('id').single();
  if (ins.error) die(`template ${name}`, ins.error);
  return ins.data.id;
}
const waiverTpl = await ensureTemplate('Season Waiver', 'waiver');
await ensureTemplate('Medical Form', 'medical_consent');
// Every rostered child EXCEPT Peyton Cole and Sasha Ionescu has a signed waiver on file.
for (const nameKey of Object.keys(playerIds)) {
  if (nameKey === 'Peyton Cole' || nameKey === 'Sasha Ionescu') continue;
  const playerId = playerIds[nameKey];
  const { data: doc } = await db.from('rep_player_documents')
    .select('id').eq('player_id', playerId).eq('document_type', 'waiver').maybeSingle();
  if (!doc) {
    const ins = await db.from('rep_player_documents').insert({
      player_id: playerId, team_id: team.id, org_id: org.id,
      document_type: 'waiver', template_id: waiverTpl,
      storage_path: `fixtures/${ORG_SLUG}/signed/${playerId}.pdf`,
      file_name: 'waiver-signed.pdf', file_size: 2048,
    });
    if (ins.error) die(`player doc ${nameKey}`, ins.error);
  }
}
ok('forms: waivers on file for all but Cole + Ionescu (the missing-forms lens)');

// ── 9. House league — this season + last season ───────────────────────────────
async function ensureSeason(name, slug, status, waiverText) {
  let { data: s } = await db.from('league_seasons').select('id, name').eq('org_id', org.id).eq('slug', slug).maybeSingle();
  if (!s) {
    const ins = await db.from('league_seasons').insert({
      org_id: org.id, name, slug, sport: 'baseball', status,
      registration_fee: 150, waiver_text: waiverText ?? null,
    }).select('id, name').single();
    if (ins.error) die(`season ${slug}`, ins.error);
    s = ins.data;
  }
  return s;
}
async function ensureDivision(seasonId, name) {
  let { data: d } = await db.from('league_divisions').select('id').eq('season_id', seasonId).eq('name', name).maybeSingle();
  if (!d) {
    const ins = await db.from('league_divisions').insert({ season_id: seasonId, name, capacity: 30 }).select('id').single();
    if (ins.error) die(`division ${name}`, ins.error);
    d = ins.data;
  }
  return d;
}
const seasonNow = await ensureSeason(`Summer ${YEAR}`, `summer-${YEAR}`, 'active',
  'I accept the fixture club waiver: risks, photos, and the return of equipment.');
const seasonPast = await ensureSeason(`Summer ${YEAR - 1}`, `summer-${YEAR - 1}`, 'completed', null);
const divNow = await ensureDivision(seasonNow.id, 'U11');
const divPast = await ensureDivision(seasonPast.id, 'U11');

async function ensureLeagueReg(seasonId, divisionId, first, last, gFirst, gLast, gEmail, gPhone, opts = {}) {
  const { data: r } = await db.from('league_registrations')
    .select('id').eq('season_id', seasonId).eq('player_first_name', first).eq('player_last_name', last).maybeSingle();
  if (r) return;
  const ins = await db.from('league_registrations').insert({
    season_id: seasonId, org_id: org.id, division_id: divisionId,
    player_first_name: first, player_last_name: last,
    player_date_of_birth: opts.dob ?? null,
    guardian_first_name: gFirst, guardian_last_name: gLast,
    guardian_email: gEmail, guardian_phone: gPhone ?? null,
    status: 'active', source: 'public_form',
    registration_fee_paid: opts.paid ?? false,
    waiver_accepted_at: opts.waiverAccepted ? new Date().toISOString() : null,
  });
  if (ins.error) die(`league reg ${first} ${last}`, ins.error);
}
// THE cross-programme households (0 occurrences in real data — the whole premise):
await ensureLeagueReg(seasonNow.id, divNow.id, 'Milan', 'Reyes', 'Alex', 'Reyes', 'alex.reyes@example.com', '555-0100',
  { paid: true, waiverAccepted: true, dob: '2016-04-12' });
await ensureLeagueReg(seasonNow.id, divNow.id, 'Ari', 'Sharma', 'Lee', 'Aoki', 'family.aoki.sharma@example.com', '555-0102',
  { paid: false, waiverAccepted: true, dob: '2015-09-03' }); // shared inbox, two surnames
await ensureLeagueReg(seasonNow.id, divNow.id, 'Nico', 'Tran', 'Thuy', 'Tran', 'thuy.tran@example.com', '555-0107',
  { paid: false, dob: '2015-01-20' }); // league-only family, unpaid, no waiver recorded
// Last season only (not back):
await ensureLeagueReg(seasonPast.id, divPast.id, 'Ola', 'Femi', 'Bisi', 'Femi', 'bisi.femi@example.com', '555-0108',
  { paid: true });
ok('league: Reyes + Aoki-Sharma span BOTH programmes · Tran unpaid · Femi not back');

// ── 10. Attach — the same call the Families area makes ───────────────────────
{
  const { error } = await db.rpc('families_attach_people', { p_org_id: org.id });
  if (error) die('families_attach_people', error);
}
const { count: people } = await db.from('org_people').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
const { count: addresses } = await db.from('org_person_emails').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
ok(`attached: ${people} people, ${addresses} addresses`);
console.log('\nDone. The messy fixture club is ready:');
console.log(`  org slug: ${ORG_SLUG}`);
console.log('  Expect: ~10 people · 1 person with 2 addresses (Petit) · 1 shared inbox with 2 surnames (Aoki-Sharma)');
console.log('  · 2 cross-programme households (Reyes, Aoki-Sharma) · 1 duplicate proposal (Cole) · 2 no-guardian children');
console.log('  · opt-out under a FORMER address (Petit) · 2 not-back families (Grant, Femi)');
