/**
 * seed-club-children.mjs — gives the UAT Rep Club the two child shapes the layout sweep needs to MEASURE
 * Club Tier Stage 14's screens instead of their empty states (owner 2026-11-06).
 *
 *   1. A child with TWO SEASONS. The seed writes a roster per season directly, so every returning player is a
 *      separate child per season. The three shared households (Okafor, Lindqvist, Tremblay) are joined here the way
 *      the roll joins a returning child, so their child's page has a season history and a "Split records" button.
 *   2. ONE POSSIBLE-DUPLICATE PAIR in the Children queue: one returning player whose older entry carries a birth
 *      date and whose newer entry does not, same parent address — the "birth date missing on one side" card. Without
 *      it the queue's switch reads "Children · 0" and the sweep measures the empty state.
 *
 * DEV only. Re-runnable (a join already done and a pair already made are skipped). Writes nothing else, never touches
 * a sign-in or a password — so it is safe next to the saved test sessions, unlike a full re-seed.
 * `seed-club-fixture.mjs` runs it last; it can also be run on its own:
 *
 *   node --env-file=.env.local scripts/seed-club-children.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local'); process.exit(1); }
if (url.includes('qcttcboqysynwcdyghil')) { console.error('✗ Refusing to run: that is the PRODUCTION project.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const ORG_SLUG = 'uat-rep-club';
const HOUSEHOLD_EMAILS = ['okafor.family@example.test', 'k.lindqvist@example.test', 'julie.tremblay@example.test'];
const PAIR_BIRTH_DATE = '2012-04-18';

const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);

const { data: org, error: orgErr } = await db.from('organizations').select('id').eq('slug', ORG_SLUG).maybeSingle();
die('club lookup', orgErr);
if (!org) { console.error(`✗ No "${ORG_SLUG}" — run scripts/seed-club-fixture.mjs first.`); process.exit(1); }

const { data: rows, error: rowsErr } = await db.from('rep_roster_players')
  .select('id, child_id, player_first_name, player_last_name, team_id, guardian_email, player_date_of_birth, status, rep_program_years ( status, created_at )')
  .eq('org_id', org.id).neq('status', 'callup');
die('roster read', rowsErr);

// Group a returning player's entries by team + name + parent address.
const groups = new Map();
for (const r of rows) {
  const k = [r.team_id, r.player_first_name, r.player_last_name, (r.guardian_email ?? '').toLowerCase()].join('|');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const newestFirst = (a, b) => String(b.rep_program_years?.created_at ?? '').localeCompare(String(a.rep_program_years?.created_at ?? ''));

// ── 1 · join the shared households' seasons ──────────────────────────────────────────────────────────────────────
let joined = 0;
for (const entries of groups.values()) {
  if (entries.length < 2 || !HOUSEHOLD_EMAILS.includes((entries[0].guardian_email ?? '').toLowerCase())) continue;
  const [keep, ...rest] = [...entries].sort(newestFirst);
  for (const old of rest) {
    if (!old.child_id || old.child_id === keep.child_id) continue;
    const { error } = await db.rpc('org_children_join', { p_keep: keep.child_id, p_absorb: old.child_id, p_keep_identity: false });
    die(`join ${keep.player_first_name} ${keep.player_last_name}`, error);
    joined++;
  }
}
ok(joined ? `${joined} returning child record(s) of the shared households joined — each now has two seasons` : 'shared households already joined');

// ── 2 · one possible-duplicate pair for the Children queue ───────────────────────────────────────────────────────
const { data: kids, error: kidsErr } = await db.from('org_children').select('id, first_name, last_name, date_of_birth').eq('org_id', org.id);
die('children read', kidsErr);
const byId = new Map(kids.map(c => [c.id, c]));
const { data: nos, error: nosErr } = await db.from('child_match_rejections').select('child_a_id, child_b_id').in('child_a_id', kids.map(c => c.id));
die('stored no read', nosErr);
const rejected = new Set((nos ?? []).flatMap(n => [`${n.child_a_id}|${n.child_b_id}`, `${n.child_b_id}|${n.child_a_id}`]));

// Already made? A same-name, same-parent pair of DIFFERENT children where exactly one carries a birth date.
const candidates = [];
for (const entries of groups.values()) {
  if (entries.length < 2 || HOUSEHOLD_EMAILS.includes((entries[0].guardian_email ?? '').toLowerCase())) continue;
  const [newer, older] = [...entries].sort(newestFirst);
  if (!newer.child_id || !older.child_id || newer.child_id === older.child_id) continue;
  if (rejected.has(`${newer.child_id}|${older.child_id}`)) continue;
  candidates.push({ newer, older, a: byId.get(newer.child_id), b: byId.get(older.child_id) });
}
const already = candidates.find(c => !!c.a?.date_of_birth !== !!c.b?.date_of_birth);
if (already) {
  ok(`a possible-duplicate pair already exists (${already.newer.player_first_name} ${already.newer.player_last_name})`);
} else {
  const pick = candidates.filter(c => !c.a?.date_of_birth && !c.b?.date_of_birth)
    .sort((x, y) => (x.newer.player_last_name + x.newer.player_first_name).localeCompare(y.newer.player_last_name + y.newer.player_first_name))[0];
  if (!pick) { console.error('✗ No returning player to make the pair from.'); process.exit(1); }
  die('birth date on the older entry', (await db.from('rep_roster_players').update({ player_date_of_birth: PAIR_BIRTH_DATE }).eq('id', pick.older.id)).error);
  // The entry's date reaches its child by trigger; confirm it did, and set it on the child directly if it did not.
  const { data: child, error: childErr } = await db.from('org_children').select('date_of_birth').eq('id', pick.older.child_id).maybeSingle();
  die('child re-read', childErr);
  if (!child?.date_of_birth) die('birth date on the older child', (await db.from('org_children').update({ date_of_birth: PAIR_BIRTH_DATE }).eq('id', pick.older.child_id)).error);
  ok(`${pick.newer.player_first_name} ${pick.newer.player_last_name}: older season has a birth date, this season's does not — one card in the Children queue`);
}
