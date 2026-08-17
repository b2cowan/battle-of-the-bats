/**
 * report-families-backfill.mjs — the Families Book Phase 1 deliverable.
 *
 * ⚠ PHASE 1 IS NOT "THE MIGRATION RAN". It is this report, read by the owner. If the
 * numbers look wrong, matching gets fixed BEFORE a single screen exists. A clean run is
 * NOT approval. (docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md §5 P1, and the build
 * prompt's §3 exit criterion.)
 *
 * ⚠⚠ THE POINT OF KEEPING THIS SCRIPT: as of 2026-08-17 there is NO REAL CLUB DATA on
 * either database. Production holds exactly one organization carrying families and it is
 * the Riverdale Ridge demo club; dev holds that same demo club plus five test/QA orgs. The
 * plan's premise — "the riskiest thing is proven against REAL CLUB DATA before anything
 * depends on it" — is therefore NOT satisfiable today, and a clean report proves the
 * MECHANISM works, not that the MATCHING is right for a real club.
 *
 * So the durable deliverable is this script, not the numbers it prints today. Run it again
 * against the first real club's data — that is the moment the exit criterion is actually
 * met, and the moment to decide whether Phase 2 may start.
 *
 * READ-ONLY. Every statement is a SELECT; it never writes to either database.
 *
 *   node scripts/report-families-backfill.mjs            # dev (default)
 *   node scripts/report-families-backfill.mjs --prod     # production (read-only)
 *   node scripts/report-families-backfill.mjs --json     # machine-readable
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (one account PAT reaches both projects).
 * Requires migration 251 to have been applied to the target environment.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const PROJECT_REFS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.local');
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const TARGET = ARGS.includes('--prod') ? 'prod' : 'dev';
const AS_JSON = ARGS.includes('--json');
const PROJECT_REF = PROJECT_REFS[TARGET];

// The one email-shape rule, mirrored from lib/guardian-email.ts. An address that would not
// be SENDABLE is an address we do not mint a person from — "we made a record for them" and
// "we would email them" must never disagree.
const SHAPE = String.raw`^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$`;

function apiQuery(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function q(sql) {
  const first = sql.trim().replace(/^\(+/, '').split(/\s+/)[0]?.toLowerCase();
  if (!['select', 'with'].includes(first)) {
    throw new Error(`report-families-backfill is READ-ONLY; refusing "${first}".`);
  }
  const res = await apiQuery(sql);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Query failed (HTTP ${res.status}): ${res.body.slice(0, 600)}`);
  }
  return JSON.parse(res.body);
}

const n = v => Number(v ?? 0);

// ── the queries ───────────────────────────────────────────────────────────────

// 1. Families created, per org, split by source.
const Q_PER_ORG = `
WITH src AS (
  SELECT r.org_id, r.person_id, 'rep_roster' AS source FROM rep_roster_players r WHERE r.person_id IS NOT NULL
  UNION ALL SELECT t.org_id, t.person_id, 'tryout'      FROM rep_tryout_registrations t WHERE t.person_id IS NOT NULL
  UNION ALL SELECT l.org_id, l.person_id, 'league'      FROM league_registrations l     WHERE l.person_id IS NOT NULL
  UNION ALL SELECT f.org_id, f.person_id, 'family_link' FROM family_links f             WHERE f.person_id IS NOT NULL
)
SELECT o.name AS org, o.slug,
       (SELECT count(*) FROM org_people p WHERE p.org_id = o.id)                                        AS people,
       (SELECT count(*) FROM org_person_emails e WHERE e.org_id = o.id)                                 AS addresses,
       count(DISTINCT src.person_id) FILTER (WHERE src.source = 'rep_roster')  AS from_rep_roster,
       count(DISTINCT src.person_id) FILTER (WHERE src.source = 'tryout')      AS from_tryout,
       count(DISTINCT src.person_id) FILTER (WHERE src.source = 'league')      AS from_league,
       count(DISTINCT src.person_id) FILTER (WHERE src.source = 'family_link') AS from_family_link
  FROM organizations o
  LEFT JOIN src ON src.org_id = o.id
 WHERE EXISTS (SELECT 1 FROM org_people p WHERE p.org_id = o.id)
 GROUP BY o.id, o.name, o.slug
 ORDER BY people DESC`;

// 2. Suspected duplicates — surname+phone, or surname+shared child. NEVER merged.
const Q_DUP_PHONE = `
SELECT o.name AS org, a.last_name, a.phone, a.email_normalized AS email_a, b.email_normalized AS email_b
  FROM org_people a
  JOIN org_people b ON b.org_id = a.org_id AND b.id > a.id
   AND lower(btrim(b.last_name)) = lower(btrim(a.last_name))
   AND regexp_replace(b.phone, '[^0-9]', '', 'g') = regexp_replace(a.phone, '[^0-9]', '', 'g')
  JOIN organizations o ON o.id = a.org_id
 WHERE a.last_name IS NOT NULL AND a.phone IS NOT NULL
   AND length(regexp_replace(a.phone, '[^0-9]', '', 'g')) >= 7
 ORDER BY 1, 2`;

// A "shared child" is two DIFFERENT people named on rows for the same child, across rep and
// league alike.
//
// ⚠ The child is matched on NAME WITHIN AN ORG, not name + birth date. That is weaker than
// the plan assumes, and deliberately so: birth dates are recorded on almost no rep row (see
// the coverage line in the report), so including one would silently drop nearly every
// comparison instead of tightening it. The consequence is honest and bounded — this list is
// a PROPOSAL FOR A HUMAN, never an auto-merge, so a false positive costs a glance while a
// missed one costs a duplicate that survives.
const Q_DUP_CHILD = `
WITH child_person AS (
  SELECT r.org_id, lower(btrim(r.player_first_name)) AS first,
         lower(btrim(coalesce(r.player_last_name,''))) AS last, r.person_id
    FROM rep_roster_players r WHERE r.person_id IS NOT NULL
   UNION ALL
  SELECT t.org_id, lower(btrim(t.player_first_name)), lower(btrim(t.player_last_name)), t.person_id
    FROM rep_tryout_registrations t WHERE t.person_id IS NOT NULL
   UNION ALL
  SELECT l.org_id, lower(btrim(l.player_first_name)), lower(btrim(l.player_last_name)), l.person_id
    FROM league_registrations l WHERE l.person_id IS NOT NULL
)
SELECT o.name AS org, c.first || ' ' || c.last AS child,
       count(DISTINCT c.person_id) AS distinct_people,
       string_agg(DISTINCT p.email_normalized, ' | ') AS emails
  FROM child_person c
  JOIN org_people p ON p.id = c.person_id
  JOIN organizations o ON o.id = c.org_id
 GROUP BY o.name, c.first, c.last
HAVING count(DISTINCT c.person_id) > 1
   -- Only interesting when the guardians' surnames also agree; different surnames on one
   -- child is ordinarily two real guardians of that child, not a duplicated one.
   AND count(DISTINCT lower(btrim(coalesce(p.last_name, '')))) = 1
 ORDER BY distinct_people DESC`;

// 3. Children not confidently attached, by reason.
const Q_UNATTACHED = `
WITH rows AS (
  SELECT 'rep_roster'  AS source, r.org_id, r.guardian_email AS email, r.person_id,
         r.player_first_name || ' ' || coalesce(r.player_last_name, '') AS child
    FROM rep_roster_players r
  UNION ALL
  SELECT 'tryout', t.org_id, t.guardian_email, t.person_id, t.player_first_name || ' ' || t.player_last_name
    FROM rep_tryout_registrations t
  UNION ALL
  SELECT 'league', l.org_id, l.guardian_email, l.person_id, l.player_first_name || ' ' || l.player_last_name
    FROM league_registrations l
)
SELECT o.name AS org, rows.source,
       count(*)                                                                       AS total_rows,
       count(*) FILTER (WHERE rows.person_id IS NOT NULL)                             AS attached,
       count(*) FILTER (WHERE rows.email IS NULL OR btrim(rows.email) = '')           AS no_email,
       count(*) FILTER (WHERE rows.email IS NOT NULL AND btrim(rows.email) <> ''
                          AND lower(btrim(rows.email)) !~ '${SHAPE}')                 AS malformed_email,
       count(*) FILTER (WHERE rows.person_id IS NULL
                          AND rows.email IS NOT NULL AND btrim(rows.email) <> ''
                          AND lower(btrim(rows.email)) ~ '${SHAPE}')                  AS unexplained
  FROM rows JOIN organizations o ON o.id = rows.org_id
 GROUP BY o.name, rows.source
 ORDER BY o.name, rows.source`;

// The malformed addresses themselves — a short list is worth more than a count.
const Q_MALFORMED = `
SELECT o.name AS org, x.source, x.email, x.child
  FROM (
    SELECT 'rep_roster' AS source, r.org_id, r.guardian_email AS email,
           r.player_first_name || ' ' || coalesce(r.player_last_name,'') AS child
      FROM rep_roster_players r WHERE r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''
    UNION ALL
    SELECT 'tryout', t.org_id, t.guardian_email, t.player_first_name || ' ' || t.player_last_name
      FROM rep_tryout_registrations t
    UNION ALL
    SELECT 'league', l.org_id, l.guardian_email, l.player_first_name || ' ' || l.player_last_name
      FROM league_registrations l
  ) x JOIN organizations o ON o.id = x.org_id
 -- Blank is NOT malformed, it is ABSENT, and it is already counted as no_email above.
 -- Listing it in both places double-reports one row as two different problems.
 WHERE btrim(x.email) <> ''
   AND lower(btrim(x.email)) !~ '${SHAPE}'
 ORDER BY 1, 2 LIMIT 50`;

// One address on children with clearly different surnames — the "shared inbox" case. These
// ARE attached (one person), which may be right (one parent, two surnames in the family) or
// wrong (a club-office address typed onto every row). Worth a human's eye either way.
const Q_SHARED_ADDRESS = `
WITH child_rows AS (
  SELECT r.person_id, lower(btrim(coalesce(r.player_last_name,''))) AS child_last FROM rep_roster_players r WHERE r.person_id IS NOT NULL
  UNION ALL SELECT t.person_id, lower(btrim(t.player_last_name)) FROM rep_tryout_registrations t WHERE t.person_id IS NOT NULL
  UNION ALL SELECT l.person_id, lower(btrim(l.player_last_name)) FROM league_registrations l WHERE l.person_id IS NOT NULL
)
SELECT o.name AS org, p.email_normalized,
       count(DISTINCT c.child_last) AS distinct_child_surnames,
       string_agg(DISTINCT c.child_last, ', ') AS surnames
  FROM child_rows c
  JOIN org_people p ON p.id = c.person_id
  JOIN organizations o ON o.id = p.org_id
 WHERE c.child_last <> ''
 GROUP BY o.name, p.email_normalized
HAVING count(DISTINCT c.child_last) > 1
 ORDER BY distinct_child_surnames DESC LIMIT 50`;

// 4. Guardians appearing in MORE THAN ONE source — the cross-module wins.
const Q_CROSS_SOURCE = `
WITH src AS (
  SELECT r.person_id, 'rep_roster' AS source FROM rep_roster_players r WHERE r.person_id IS NOT NULL
  UNION ALL SELECT t.person_id, 'tryout'      FROM rep_tryout_registrations t WHERE t.person_id IS NOT NULL
  UNION ALL SELECT l.person_id, 'league'      FROM league_registrations l     WHERE l.person_id IS NOT NULL
  UNION ALL SELECT f.person_id, 'family_link' FROM family_links f             WHERE f.person_id IS NOT NULL
)
SELECT o.name AS org, p.email_normalized,
       count(DISTINCT src.source) AS sources,
       string_agg(DISTINCT src.source, ', ' ORDER BY src.source) AS which
  FROM src JOIN org_people p ON p.id = src.person_id
  JOIN organizations o ON o.id = p.org_id
 GROUP BY o.name, p.email_normalized
HAVING count(DISTINCT src.source) > 1
 ORDER BY sources DESC, 1, 2`;

// The headline the whole project rests on: ONE PARENT, TWO PROGRAMS. A person carrying both
// a rep row (roster or tryout) and a house-league row is a household that is invisible in
// both modules today and visible for the first time here.
const Q_CROSS_MODULE = `
SELECT o.name AS org, p.email_normalized, p.first_name, p.last_name,
       (SELECT count(*) FROM rep_roster_players r WHERE r.person_id = p.id)       AS rep_children,
       (SELECT count(*) FROM rep_tryout_registrations t WHERE t.person_id = p.id) AS tryout_children,
       (SELECT count(*) FROM league_registrations l WHERE l.person_id = p.id)     AS league_children
  FROM org_people p JOIN organizations o ON o.id = p.org_id
 WHERE EXISTS (SELECT 1 FROM league_registrations l WHERE l.person_id = p.id)
   AND (EXISTS (SELECT 1 FROM rep_roster_players r WHERE r.person_id = p.id)
     OR EXISTS (SELECT 1 FROM rep_tryout_registrations t WHERE t.person_id = p.id))
 ORDER BY 1, 2`;

// Every child row that now names a person, with the raw pieces of a child identity.
const KIDS_CTE = `
kids AS (
  SELECT r.person_id, lower(btrim(r.player_first_name)) AS first,
         lower(btrim(coalesce(r.player_last_name, ''))) AS last, r.player_date_of_birth AS dob
    FROM rep_roster_players r WHERE r.person_id IS NOT NULL
   UNION ALL
  SELECT t.person_id, lower(btrim(t.player_first_name)), lower(btrim(t.player_last_name)), t.player_date_of_birth
    FROM rep_tryout_registrations t WHERE t.person_id IS NOT NULL
   UNION ALL
  SELECT l.person_id, lower(btrim(l.player_first_name)), lower(btrim(l.player_last_name)), l.player_date_of_birth
    FROM league_registrations l WHERE l.person_id IS NOT NULL
)`;

// Households: one person, several children.
//
// ⚠ TWO WAYS THIS COUNT GOES WRONG, both found and fixed while writing this report, both of
// them INFLATING sibling counts — which is the direction that matters, because a sibling
// discount is the headline commercial promise resting on this number:
//
//   1. Keying the child by SOURCE counted one child twice when they tried out and then made
//      the roster. The key carries no source.
//   2. Keying the child by name + BIRTH DATE split one child into two when one row recorded
//      a birth date and the other did not — which is nearly every row (see the birth-date
//      coverage line in the report). So a birth date SPLITS two same-named children only
//      when both rows actually carry one, and is otherwise ignored rather than trusted.
const Q_HOUSEHOLDS = `
WITH ${KIDS_CTE},
per_name AS (
  SELECT person_id, first, last,
         count(DISTINCT dob) FILTER (WHERE dob IS NOT NULL) AS dobs
    FROM kids GROUP BY person_id, first, last
)
SELECT count(*) FILTER (WHERE c = 1) AS one_child,
       count(*) FILTER (WHERE c = 2) AS two_children,
       count(*) FILTER (WHERE c >= 3) AS three_or_more
  FROM (SELECT person_id, sum(GREATEST(dobs, 1)) AS c FROM per_name GROUP BY person_id) x`;

// How much of a child identity actually exists. The answer governs how far the duplicate
// scan above can be trusted, so it is reported rather than assumed.
const Q_DOB_COVERAGE = `
SELECT 'rep_roster' AS source, count(*) AS rows, count(player_date_of_birth) AS with_birth_date FROM rep_roster_players
UNION ALL SELECT 'tryout', count(*), count(player_date_of_birth) FROM rep_tryout_registrations
UNION ALL SELECT 'league', count(*), count(player_date_of_birth) FROM league_registrations`;

// People whose ONLY source is a tryout — the reversibility number for the "should a
// candidate who never made the team get a record?" decision.
const Q_TRYOUT_ONLY = `
SELECT count(*) AS tryout_only
  FROM org_people p
 WHERE EXISTS (SELECT 1 FROM rep_tryout_registrations t WHERE t.person_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM rep_roster_players r    WHERE r.person_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM league_registrations l  WHERE l.person_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM family_links f          WHERE f.person_id = p.id)`;

// The alias hop (family_links invited_email → claimed_email). Accepted hops are the only
// place a FORMER address exists today; refused ones are chains/contradictions we would not
// resolve automatically.
const Q_ALIAS = `
WITH raw AS (
  SELECT f.org_id, lower(btrim(f.invited_email)) AS from_email, lower(btrim(f.claimed_email)) AS to_email
    FROM family_links f
   WHERE f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> '' AND btrim(f.invited_email) <> ''
     AND lower(btrim(f.claimed_email)) IS DISTINCT FROM lower(btrim(f.invited_email))
),
unambiguous AS (
  SELECT org_id, from_email FROM raw GROUP BY org_id, from_email HAVING count(DISTINCT to_email) = 1
)
SELECT (SELECT count(DISTINCT (org_id, from_email)) FROM raw)                                    AS hops_seen,
       (SELECT count(*) FROM unambiguous)                                                        AS unambiguous,
       (SELECT count(*) FROM org_person_emails WHERE NOT is_current)                             AS former_addresses_recorded`;

// ⚠ FOR PHASE 3, NOT PHASE 1. Phase 1 stores NO contact preference on the person (see the
// migration header). These are the conflicts a stored preference would have had to resolve —
// and the count of opt-outs whose person holds more than one address, which is where a
// "newest wins" rule would silently re-subscribe someone.
const Q_PREFERENCE = `
SELECT
  (SELECT count(*) FROM (
     SELECT t.org_id, lower(btrim(t.guardian_email)) e
       FROM rep_tryout_registrations t
      WHERE t.consent_email_comms IS NOT NULL
      GROUP BY 1, 2 HAVING count(DISTINCT t.consent_email_comms) > 1) x)                  AS guardians_with_conflicting_email_consent,
  (SELECT count(*) FROM family_email_optouts)                                             AS optouts_total,
  (SELECT count(*) FROM family_email_optouts oo
    WHERE EXISTS (SELECT 1 FROM org_person_emails e WHERE e.org_id = oo.org_id
                    AND e.email_normalized = lower(btrim(oo.email))))                     AS optouts_matching_a_person,
  (SELECT count(*) FROM family_email_optouts oo
    WHERE EXISTS (SELECT 1 FROM org_person_emails e
                  JOIN org_person_emails e2 ON e2.person_id = e.person_id AND e2.id <> e.id
                  WHERE e.org_id = oo.org_id AND e.email_normalized = lower(btrim(oo.email))))
                                                                                          AS optouts_on_a_person_with_other_addresses,
  (SELECT count(*) FROM family_consents c
    WHERE NOT EXISTS (SELECT 1 FROM org_person_emails e WHERE e.org_id = c.org_id
                        AND e.email_normalized = lower(btrim(c.guardian_email))))         AS consents_with_no_person`;

// Integrity: the invariants the migration claims to hold.
const Q_INTEGRITY = `
SELECT
  (SELECT count(*) FROM org_people p
    WHERE NOT EXISTS (SELECT 1 FROM org_person_emails e
                       WHERE e.person_id = p.id AND e.is_current
                         AND e.email_normalized = p.email_normalized))                    AS people_without_matching_current_address,
  (SELECT count(*) FROM org_person_emails e
    JOIN org_people p ON p.id = e.person_id WHERE p.org_id <> e.org_id)                   AS address_org_mismatch,
  (SELECT count(*) FROM rep_roster_players r JOIN org_people p ON p.id = r.person_id
    WHERE p.org_id <> r.org_id)                                                           AS roster_cross_org_attachment,
  (SELECT count(*) FROM league_registrations l JOIN org_people p ON p.id = l.person_id
    WHERE p.org_id <> l.org_id)                                                           AS league_cross_org_attachment,
  (SELECT count(*) FROM league_registrations WHERE org_id IS NULL)                        AS league_rows_without_org`;

// ── render ────────────────────────────────────────────────────────────────────

function table(rows, cols) {
  if (!rows.length) return '    (none)';
  const head = cols ?? Object.keys(rows[0]);
  const width = head.map(h => Math.max(String(h).length, ...rows.map(r => String(r[h] ?? '').length)));
  const line = cells => '    ' + cells.map((c, i) => String(c ?? '').padEnd(width[i])).join('  ');
  return [line(head), line(width.map(w => '-'.repeat(w))), ...rows.map(r => line(head.map(h => r[h])))].join('\n');
}

const H = t => `\n\n${'═'.repeat(78)}\n  ${t}\n${'═'.repeat(78)}`;

async function main() {
  const [perOrg, dupPhone, dupChild, unattached, malformed, sharedAddr,
         crossSource, crossModule, households, dobCoverage, tryoutOnly, alias, preference, integrity] =
    await Promise.all([Q_PER_ORG, Q_DUP_PHONE, Q_DUP_CHILD, Q_UNATTACHED, Q_MALFORMED,
      Q_SHARED_ADDRESS, Q_CROSS_SOURCE, Q_CROSS_MODULE, Q_HOUSEHOLDS, Q_DOB_COVERAGE,
      Q_TRYOUT_ONLY, Q_ALIAS, Q_PREFERENCE, Q_INTEGRITY].map(q));

  if (AS_JSON) {
    console.log(JSON.stringify({
      target: TARGET, perOrg, dupPhone, dupChild, unattached, malformed, sharedAddr,
      crossSource, crossModule, households: households[0], dobCoverage,
      tryoutOnly: tryoutOnly[0], alias: alias[0], preference: preference[0],
      integrity: integrity[0],
    }, null, 2));
    return;
  }

  const people = perOrg.reduce((s, r) => s + n(r.people), 0);
  const addresses = perOrg.reduce((s, r) => s + n(r.addresses), 0);

  console.log(H(`FAMILIES BOOK — PHASE 1 REPORT  ·  ${TARGET.toUpperCase()}`));
  console.log(`
  ${people} people created across ${perOrg.length} organization(s), holding ${addresses} address(es).

  ⚠ READ THIS BEFORE READING THE NUMBERS. Nothing in the product reads any of this — no
  screen, no route, no permission. And on both databases today the data below is SEEDED
  DEMO AND TEST DATA, not a real club's records. A clean run proves the MECHANISM; it does
  not prove the MATCHING is right for a real club. Re-run this against the first real club
  before Phase 2 starts.`);

  console.log(H('1 · FAMILIES CREATED, PER ORG AND PER SOURCE'));
  console.log(table(perOrg));
  console.log(`
  A person counted under two sources is ONE person reached from both — the columns overlap
  on purpose, and that overlap is section 4.`);

  console.log(H('2 · SUSPECTED DUPLICATES  (detected, counted, NEVER merged)'));
  console.log(`
  Auto-matching happens on EXACT NORMALIZED EMAIL ONLY. Everything below is a PROPOSAL for a
  human. A wrong merge shows one parent another parent's children, which is strictly worse
  than leaving two records alone.

  a) Same surname + same phone, different email  —  ${dupPhone.length} pair(s)`);
  console.log(table(dupPhone));
  console.log(`
  b) Same child named by two different people with the same surname  —  ${dupChild.length} case(s)`);
  console.log(table(dupChild));

  console.log(H('3 · CHILDREN NOT CONFIDENTLY ATTACHED'));
  console.log(table(unattached));
  console.log(`
  "no_email" is a child whose row names no guardian at all — nothing to match, and the honest
  outcome is an unattached row, not a guess. "malformed_email" failed the same shape test the
  send path uses, so we neither create a person nor pretend we could email them.
  "unexplained" MUST BE ZERO: a well-formed address that produced no person is a bug in the
  backfill, not a data-quality finding.

  Malformed addresses in full:`);
  console.log(table(malformed));
  console.log(`
  One address named on children with different surnames — ${sharedAddr.length} case(s). These
  ARE attached as one person. That may be correct (one parent, two surnames in the household)
  or wrong (a club-office address typed onto every row). Human judgement, not a rule:`);
  console.log(table(sharedAddr));

  console.log(H('4 · GUARDIANS FOUND IN MORE THAN ONE SOURCE  (the point of the project)'));
  console.log(`
  ${crossSource.length} guardian(s) appear in more than one source.`);
  console.log(table(crossSource.slice(0, 40)));
  if (crossSource.length > 40) console.log(`    … and ${crossSource.length - 40} more.`);
  console.log(`
  ⚠ THE ONE THAT MATTERS — a parent with children in BOTH a rep program and house league.
  This is the household that is invisible in both modules today, and the reason League was
  brought into scope alongside Club:  ${crossModule.length} found.`);
  console.log(table(crossModule));
  console.log(`
  Household sizes (distinct children per person):`);
  console.log(table(households));
  console.log(`
  ⚠ HOW MUCH A CHILD'S IDENTITY IS ACTUALLY WORTH — read this before trusting the line above,
  and before anyone promises a sibling discount. A child is matched by NAME WITHIN AN ORG,
  because the birth date that would make it reliable is barely recorded:`);
  console.log(table(dobCoverage));
  console.log(`
  This is the same gap the project set out to close on the PARENT side, sitting on the CHILD
  side. Two same-named children in one club read as one child; a child registered twice under
  a nickname reads as two siblings. Nothing here is wrong — the counts above are the best the
  data supports — but "siblings" is an INFERENCE today, not a fact, and Phase 5's household
  money should not be built on it without a decision about child identity first.`);

  console.log(H('5 · JUDGEMENT CALLS, AND WHAT PHASE 3 INHERITS'));
  console.log(`
  Tryout-only people (a candidate who never made a roster and appears nowhere else):
      ${n(tryoutOnly[0]?.tryout_only)}
  Recommended KEEP: the club already holds their data, migration 214 already files a consent
  ledger row for them, and "export everything you hold about me" cannot answer for a family
  with no record. Deleting these is a one-line reversal if you disagree.

  Address changes witnessed through a family invitation (invited → claimed):
      hops seen ${n(alias[0]?.hops_seen)} · unambiguous ${n(alias[0]?.unambiguous)} · former addresses recorded ${n(alias[0]?.former_addresses_recorded)}
  A hop is accepted only when it is unambiguous and not part of a chain. This is the ONLY
  automatic way a person currently ends up with two addresses.

  ⚠ CONTACT PREFERENCES ARE DELIBERATELY NOT STORED ON THE PERSON IN PHASE 1.
  They already live in two ledgers keyed on (org, email) — the same key a person uses — so a
  person inherits them by join with no second copy that could drift. These are the numbers
  Phase 3 will have to resolve when it does attach them:

      guardians whose tryout rows disagree about email consent : ${n(preference[0]?.guardians_with_conflicting_email_consent)}
      opt-outs on file                                         : ${n(preference[0]?.optouts_total)}
      ... that match a person we created                       : ${n(preference[0]?.optouts_matching_a_person)}
      ... whose person holds MORE THAN ONE address             : ${n(preference[0]?.optouts_on_a_person_with_other_addresses)}   ← the dangerous ones
      consent records naming nobody we created                 : ${n(preference[0]?.consents_with_no_person)}

  The fourth line is the failure this project exists to prevent: an opt-out filed under an
  address the parent no longer uses. Today's suppression check looks up (org, email), so a
  parent who changed address would become emailable again. Phase 3's check must run through
  the PERSON, not the address it was filed under.`);

  console.log(H('6 · INTEGRITY  (every number here must be zero)'));
  console.log(table(integrity));

  const bad = Object.entries(integrity[0] ?? {}).filter(([, v]) => n(v) !== 0);
  const unexplained = unattached.reduce((s, r) => s + n(r.unexplained), 0);
  console.log('');
  if (bad.length || unexplained) {
    console.log(`  ✖ ${bad.map(([k, v]) => `${k}=${v}`).join(', ')}${unexplained ? `${bad.length ? ', ' : ''}unexplained-unattached=${unexplained}` : ''}`);
    console.log('  These are BACKFILL BUGS, not data-quality findings. Fix before Phase 2.');
    process.exitCode = 1;
  } else {
    console.log('  ✓ All invariants hold. This says the backfill did what it claims —');
    console.log('    it does NOT say the matching rules are right. That is section 2 to 4, and');
    console.log('    that judgement is the owner\'s.');
  }
  console.log('');
}

main().catch(e => { console.error(e.message); process.exit(1); });
