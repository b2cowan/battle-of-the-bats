/**
 * seed-draft-scale-fixture.mjs — a house-league division at REAL size, for the draft board (owner 2026-10-26: "120 players
 * and 10 teams … truer to real life than the <10 registrants we have been dealing with").
 *
 * Builds, on `dev-league-org` (Dev League Org), the season
 *
 *   Draft Test 2027 · draft-test-2027 · registration closed · one division "U12 Division" (born 2015–2016, capacity 120)
 *   10 teams (Cardinals … Rays, colours, no coaches) · 120 ACCEPTED players, nobody on a team, no ratings
 *   101 households (2 with three children, 15 with two) · about half carry a sign-up note · 80 paid $165, 40 owing
 *
 * ⚠ Payments go THROUGH the one money writer (`club_league_money`, action `receive`, as the org owner). A row's
 * `registration_fee_paid` flag alone counts for nothing: the board and Money read the ledger.
 * People are attached through `families_attach_people` (the one home for minting people), so Families shows them.
 *
 * Always a clean rebuild: the season's posted payments are removed first (they would otherwise sit in the club's
 * books with no registration), then the season (cascading its division, teams and registrations), then it is built
 * again. Deterministic: the same names, households, notes and payers every run.
 *
 * ⚠ DEV ONLY. Runs through `scripts/db-query.mjs --dev`; there is no flag that points it anywhere else.
 * Run: node --env-file=.env.local scripts/seed-draft-scale-fixture.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORG = 'dev-league-org';
const SLUG = 'draft-test-2027';
const FEE = 165;

let seed = 20271;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rand() * a.length)];

const FIRST = ['Liam','Noah','Oliver','Elijah','Lucas','Mason','Logan','Ethan','Jack','Leo','Owen','Henry','Wyatt','Caleb','Hudson',
  'Isaac','Theo','Felix','Miles','Jasper','Emma','Olivia','Ava','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail',
  'Ella','Scarlett','Chloe','Nora','Lily','Hazel','Aria','Zoe','Maya','Ivy','Arjun','Rohan','Priya','Aanya','Kai','Mateo',
  'Santiago','Sofia','Camila','Yuki','Hana','Wei','Jun','Aiden','Ryan','Declan','Finn','Rowan','Quinn','Avery','Riley',
  'Jordan','Parker','Reese','Elliot','Sienna','Clara','Ruby','Stella','Violet','Gabriel','Samuel','Benjamin','Nathan','Dylan'];
const LAST = ['Smith','Brown','Tremblay','Martin','Roy','Wilson','MacDonald','Gagnon','Johnson','Taylor','Campbell','Anderson',
  'Leblanc','Lee','Clark','Walker','Thompson','White','Young','Wright','Scott','Mitchell','Patel','Singh','Chen','Wong','Nguyen',
  'Kim','Park','Ali','Khan','Sharma','Gill','Fraser','Morrison','Stewart','Murphy','Kelly',"O'Brien",'Ross','Reid','Bell',
  'Hughes','Graham','Fortin','Bouchard','Pelletier','Lavoie','Cote','Bergeron','Russo','Rossi','Costa','Silva','Santos',
  'Fernandes','Novak','Kowalski','Schmidt','Muller','Jansen','DeVries','Okafor','Mensah','Haddad','Yilmaz','Ito','Sato'];
const PARENT = ['Sarah','Jessica','Jennifer','Amanda','Melissa','Stephanie','Nicole','Laura','Rachel','Megan','Michael','David',
  'Chris','Matt','Jason','Kevin','Brian','Dan','Mark','Ryan','Anita','Deepa','Mei','Lin','Carlos','Ana','Tomas','Fatima','Omar','Kofi'];
const POS = [null, null, null, 'Pitcher', 'Catcher', 'Infield', 'Outfield', 'Shortstop', 'First base', 'Anywhere'];
const NOTES = [null, null, null, null, null, null, 'Asthma — inhaler in bag', 'Wants to play with a friend from school',
  'First year playing', 'Played rep last year', 'Peanut allergy (EpiPen)', 'Left-handed', 'Can only make Tuesdays in June'];
const TEAMS = [['Cardinals','#c8102e'],['Blue Jays','#134a8e'],['Tigers','#fa4616'],['Orioles','#df4601'],['Red Sox','#bd3039'],
  ['Mariners','#005c5c'],['Twins','#002b5c'],['Royals','#004687'],['Astros','#eb6e1f'],['Rays','#8fbce6']];
const q = s => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

// Households: 2 of three children, 15 of two, the rest single — 120 children in all.
const sizes = [3, 3, ...Array(15).fill(2)];
while (sizes.reduce((a, b) => a + b, 0) < 120) sizes.push(1);
const usedNames = new Set(), usedEmails = new Set(), rows = [];
for (const size of sizes) {
  const last = pick(LAST), gFirst = pick(PARENT);
  let email = `${gFirst}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@dev.local';
  for (let n = 2; usedEmails.has(email); n++) email = email.replace(/\d*@/, `${n}@`);
  usedEmails.add(email);
  const phone = rand() < 0.8 ? `905-555-${String(1000 + Math.floor(rand() * 9000))}` : null;
  const source = rand() < 0.85 ? 'public_form' : 'admin_manual';
  const day = Math.floor(rand() * 75); // signed up May 1 – mid July 2026
  const registeredAt = new Date(Date.UTC(2026, 4, 1, 12 + Math.floor(rand() * 10), Math.floor(rand() * 60)) + day * 864e5).toISOString();
  const paid = rand() < 0.75;
  for (let k = 0; k < size; k++) {
    let first;
    do { first = pick(FIRST); } while (usedNames.has(`${first} ${last}`));
    usedNames.add(`${first} ${last}`);
    const dob = new Date(Date.UTC(2015 + Math.floor(rand() * 2), 0, 1) + Math.floor(rand() * 365) * 864e5).toISOString().slice(0, 10);
    rows.push({ first, last, dob, gFirst, email, phone, source, registeredAt, paid, pos: pick(POS), note: pick(NOTES) });
  }
}
const values = rows.map(r => `(${[q(r.first), q(r.last), q(r.dob), q(r.pos), q(r.note), q(r.gFirst), q(r.last), q(r.email), q(r.phone),
  q(r.source), q(r.registeredAt), r.paid, r.source === 'public_form' ? q(r.registeredAt) : 'NULL'].join(', ')})`).join(',\n    ');

const build = `DO $seed$
DECLARE v_org uuid; v_season uuid; v_div uuid;
BEGIN
  SELECT id INTO v_org FROM organizations WHERE slug = ${q(ORG)};
  IF v_org IS NULL THEN RAISE EXCEPTION '${ORG} not found'; END IF;
  DELETE FROM accounting_entries e USING league_registrations r, league_seasons s
   WHERE e.source_module = 'league_registration' AND e.source_entity_id = r.id AND r.season_id = s.id
     AND s.org_id = v_org AND s.slug = ${q(SLUG)};
  DELETE FROM league_seasons WHERE org_id = v_org AND slug = ${q(SLUG)};

  INSERT INTO league_seasons(org_id, name, slug, sport, status, description, registration_fee, auto_approve_under_capacity,
    auto_promote_waitlist, registration_open_at, registration_close_at, registration_closed_at, season_start_date, season_end_date,
    waiver_text, ask_email_consent, owing_amber_days)
  VALUES (v_org, 'Draft Test 2027', ${q(SLUG)}, 'softball', 'registration_closed',
    'A full-size division for trying the team draft: 120 players, 10 teams.', ${FEE}, true, true,
    '2026-05-01 12:00:00+00', '2026-07-15 23:59:00+00', '2026-07-15 23:59:00+00', '2027-06-01', '2027-08-31',
    'I acknowledge that softball involves risk of injury and consent to my child participating in Dev League programming.', true, 14)
  RETURNING id INTO v_season;

  INSERT INTO league_divisions(season_id, name, capacity, sort_order, born_from_year, born_to_year)
  VALUES (v_season, 'U12 Division', 120, 0, 2015, 2016) RETURNING id INTO v_div;

  INSERT INTO league_teams(season_id, division_id, name, color, sort_order)
  SELECT v_season, v_div, t.name, t.color, t.ord
  FROM (VALUES ${TEAMS.map(([n, c], i) => `(${q(n)}, ${q(c)}, ${i})`).join(', ')}) AS t(name, color, ord);

  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name, player_date_of_birth,
    player_position_pref, player_notes, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, source,
    registered_at, registration_fee_paid, waiver_accepted_at, fee_amount, status)
  SELECT v_org, v_season, v_div, r.f, r.l, r.dob::date, r.pos, r.note, r.gf, r.gl, r.em, r.ph, r.src,
    r.reg::timestamptz, false, r.waiver::timestamptz, ${FEE}, 'active'
  FROM (VALUES
    ${values}
  ) AS r(f, l, dob, pos, note, gf, gl, em, ph, src, reg, paid, waiver);
END $seed$;
SELECT families_attach_people(id) FROM organizations WHERE slug = ${q(ORG)};`;

// The payers, through the one money writer, dated the day they signed up.
const payers = rows.filter(r => r.paid);
const pay = `WITH paid AS (
  SELECT r.id, r.season_id, r.org_id, r.registered_at::date AS day,
         (ARRAY['etransfer','etransfer','etransfer','cash','cheque'])[1 + (abs(hashtext(r.id::text)) % 5)] AS method
  FROM league_registrations r JOIN league_seasons s ON s.id = r.season_id JOIN organizations o ON o.id = s.org_id
  WHERE o.slug = ${q(ORG)} AND s.slug = ${q(SLUG)} AND r.guardian_email IN (${[...new Set(payers.map(r => q(r.email)))].join(', ')})
), owner AS (
  SELECT m.user_id FROM organization_members m JOIN organizations o ON o.id = m.organization_id
  WHERE o.slug = ${q(ORG)} AND m.role = 'owner' LIMIT 1
)
SELECT count(*) AS payments, count(*) FILTER (WHERE (res).refusal IS NOT NULL) AS refused
FROM (SELECT club_league_money(p_org => org_id, p_season => season_id, p_registration => id, p_action => 'receive',
        p_amount => ${FEE}, p_day => day, p_method => method, p_reason => NULL,
        p_actor => (SELECT user_id FROM owner), p_entry => NULL) AS res FROM paid) x;`;

const check = `SELECT s.name,
  (SELECT count(*) FROM league_teams t WHERE t.season_id = s.id) AS teams,
  (SELECT count(*) FROM league_registrations r WHERE r.season_id = s.id AND r.status = 'active') AS players,
  (SELECT count(*) FROM league_registrations r WHERE r.season_id = s.id AND r.team_id IS NOT NULL) AS on_a_team,
  (SELECT count(DISTINCT guardian_email) FROM league_registrations r WHERE r.season_id = s.id) AS households,
  (SELECT count(*) FROM league_registrations r WHERE r.season_id = s.id AND r.person_id IS NULL) AS unattached,
  (SELECT count(DISTINCT e.source_entity_id) FROM accounting_entries e JOIN league_registrations r ON r.id = e.source_entity_id
    WHERE r.season_id = s.id AND e.status = 'posted') AS paid
FROM league_seasons s JOIN organizations o ON o.id = s.org_id WHERE o.slug = ${q(ORG)} AND s.slug = ${q(SLUG)};`;

const dir = mkdtempSync(join(tmpdir(), 'draft-scale-'));
const run = (name, sql) => {
  const file = join(dir, name);
  writeFileSync(file, sql);
  return execFileSync(process.execPath, ['scripts/db-query.mjs', '--dev', '-f', file], { encoding: 'utf8' }).trim();
};
try {
  run('build.sql', build);
  console.log('payments:', run('pay.sql', pay));
  console.log('season:  ', run('check.sql', check));
  console.log(`✓ ${rows.length} players in ${sizes.length} households · ${payers.length} paid · Dev League Org → Draft Test 2027`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
