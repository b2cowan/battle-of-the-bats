/**
 * house-league-signup-race.mjs — races real sign-ups against the DEV database (Club Tier Stage 9b-1, Part 3; mig 362).
 *
 * Each call below is its own HTTP request and so its own database transaction, fired together: the database
 * functions' season lock is the only thing that keeps them apart. Proves:
 *   1. twelve families racing for two spots: exactly two get one, the other ten are waitlisted 1–10 with no shared place;
 *   2. the same child sent five times at once: one registration, four refused as duplicates;
 *   3. on a review-first season a received child holds its spot, so the next child is waitlisted;
 *   4. staff accepting a waitlisted child into a full division are refused;
 *   5. a child holding a spot leaves → the first waiting child is promoted in the same step and the line closes up;
 *   6. nobody jumps the line: a newcomer joins a waitlist that exists, even when a spot is free;
 *   7. staff waitlisting a spot-holder hands the spot to the first child waiting (one change, one email);
 *   8. moving a child to another division keeps both lines unbroken and refuses a full division;
 *   9. with no date of birth, the same child is the same name under the same guardian email.
 *
 * Creates a throwaway season in the `dev-league-org` fixture and deletes it at the end (cascade), pass or fail.
 * Refuses to run against production.
 *
 *   node scripts/house-league-signup-race.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (.env.local)');
if (url.includes('qcttcboqysynwcdyghil')) throw new Error('This script runs against DEV only.');
const db = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };
const must = ({ data, error }) => { if (error) throw error; return data; };
const one = d => (Array.isArray(d) ? d[0] : d);

const child = (first, last = 'Racer', dob = '2016-05-01') => ({
  first, last, dob, guardianFirst: 'Pat', guardianLast: last, guardianEmail: `${first.toLowerCase()}.${last.toLowerCase()}@dev.local`,
  source: 'public_form',
});
const place = (org, season, division, c) => db.rpc('league_registration_place', {
  p_org: org, p_season: season, p_division: division, p_child: c, p_want: 'auto',
  p_signup_ref: null, p_signup_position: null, p_fee: 165,
}).then(r => one(must(r)));
const rows = async (division) => must(await db.from('league_registrations')
  .select('id, player_first_name, status, waitlist_position').eq('division_id', division));

const org = must(await db.from('organizations').select('id').eq('slug', 'dev-league-org').single()).id;
const stamp = Date.now().toString(36);
const season = must(await db.from('league_seasons').insert({
  org_id: org, name: `Race ${stamp}`, slug: `race-${stamp}`, status: 'draft', auto_approve_under_capacity: true,
}).select('id').single()).id;

try {
  const [d1, d2] = must(await db.from('league_divisions').insert([
    { season_id: season, name: 'Two spots', capacity: 2, sort_order: 0 },
    { season_id: season, name: 'One spot', capacity: 1, sort_order: 1 },
  ]).select('id, name')).sort((a, b) => a.name.localeCompare(b.name)).reverse().map(d => d.id);

  // 1 · twelve at once for two spots
  const names = Array.from({ length: 12 }, (_, i) => `Kid${String(i + 1).padStart(2, '0')}`);
  await Promise.all(names.map(n => place(org, season, d1, child(n))));
  const r0 = await rows(d1);
  const held = r0.filter(x => x.status === 'active');
  const wait = r0.filter(x => x.status === 'waitlisted').map(x => x.waitlist_position).sort((a, b) => a - b);
  check(held.length === 2, `twelve racing for two spots: ${held.length} got one (expected 2)`);
  check(wait.join() === Array.from({ length: 10 }, (_, i) => i + 1).join(), `the other ten are waitlisted 1–10 with no shared place (${wait.join(',')})`);

  // 2 · the same child five times at once
  const same = await Promise.all(Array.from({ length: 5 }, () => place(org, season, d1, child('Twin', 'Same', '2016-01-01'))));
  check(same.filter(x => !x.refusal).length === 1 && same.filter(x => x.refusal === 'duplicate').length === 4,
    `the same child five times: ${same.filter(x => !x.refusal).length} placed, ${same.filter(x => x.refusal === 'duplicate').length} refused as duplicates`);

  // 3 · a received child holds its spot (review-first)
  must(await db.from('league_seasons').update({ auto_approve_under_capacity: false }).eq('id', season));
  const a = await place(org, season, d2, child('First', 'Review'));
  const b = await place(org, season, d2, child('Second', 'Review'));
  check(a.status === 'pending_review' && b.status === 'waitlisted' && b.waitlist_position === 1,
    `review-first: the first is received (${a.status}), the second waits (${b.status} ${b.waitlist_position})`);

  // 4 · staff accepting a waitlisted child into a full division are refused
  const mv = one(must(await db.rpc('league_registration_move', { p_org: org, p_season: season, p_registration: b.id, p_to: 'active', p_notes: null, p_promote: true })));
  check(mv.refusal === 'full', `staff accepting into a full division: refused (${mv.refusal})`);

  const line = async (division) => (await rows(division)).filter(x => x.status === 'waitlisted')
    .sort((x, y) => x.waitlist_position - y.waitlist_position);
  const contiguous = (ws) => ws.map(x => x.waitlist_position).join() === ws.map((_, i) => i + 1).join();
  const end = (reg, promote) => db.rpc('league_registration_end', {
    p_org: org, p_season: season, p_registration: reg, p_status: 'withdrawn', p_notes: null, p_actor: null, p_promote: promote,
  }).then(x => one(must(x)));

  // 5 · a child holding a spot leaves → the first waiting child is promoted IN THE SAME STEP, and the line closes up
  let firstWaiting = (await line(d1))[0];
  const ended = await end(held[0].id, true);
  let r = await rows(d1);
  check(ended.promoted === firstWaiting.id && r.find(x => x.id === firstWaiting.id)?.status === 'active'
    && r.filter(x => x.status === 'active').length === 2, `a spot frees: the first waiting child (${firstWaiting.player_first_name}) is promoted in the same step`);
  check(contiguous(await line(d1)), 'the line closes up');

  // 6 · nobody jumps the line: a spot freed with auto-promote off goes to no newcomer
  await end(held[1].id, false);
  const late = await place(org, season, d1, child('Latecomer'));
  check(late.status === 'waitlisted', `a spot is free but children are waiting: the newcomer joins the line (${late.status} ${late.waitlist_position})`);
  const filled = must(await db.rpc('league_waitlist_promote', { p_org: org, p_season: season, p_division: d1 }));
  check(filled !== null && filled !== late.id, 'the free spot goes to the first child waiting, not the newcomer');
  check(must(await db.rpc('league_waitlist_promote', { p_org: org, p_season: season, p_division: d1 })) === null,
    'promoting again with no free spot does nothing');

  // 7 · staff waitlisting a child who held a spot: the first child waiting gets it, the moved child goes to the end
  const holder = (await rows(d1)).find(x => x.status === 'active');
  firstWaiting = (await line(d1))[0];
  const back = one(must(await db.rpc('league_registration_move', { p_org: org, p_season: season, p_registration: holder.id, p_to: 'waitlisted', p_notes: null, p_promote: true })));
  let ws = await line(d1);
  check(back.changed && back.promoted === firstWaiting.id && ws[ws.length - 1].id === holder.id && contiguous(ws),
    `waitlisting a spot-holder: ${firstWaiting.player_first_name} promoted, the moved child last, the line unbroken`);
  const again = one(must(await db.rpc('league_registration_move', { p_org: org, p_season: season, p_registration: holder.id, p_to: 'waitlisted', p_notes: null, p_promote: true })));
  check(again.changed === false, 'the same move twice changes nothing the second time (one email)');

  // 8 · another division: a waitlisted child joins the END of the new line and the old line closes up; a spot-holder
  //     cannot be moved into a full division
  const mover = (await line(d1))[0];
  const cd = one(must(await db.rpc('league_registration_change_division', { p_org: org, p_season: season, p_registration: mover.id, p_division: d2, p_promote: true })));
  const d2line = await line(d2);
  check(!cd.refusal && d2line[d2line.length - 1].id === mover.id && contiguous(d2line) && contiguous(await line(d1)),
    `moving a waitlisted child to another division: end of the new line (${d2line.length}), both lines unbroken`);
  const spotHolder = (await rows(d1)).find(x => x.status === 'active');
  const full = one(must(await db.rpc('league_registration_change_division', { p_org: org, p_season: season, p_registration: spotHolder.id, p_division: d2, p_promote: true })));
  check(full.refusal === 'full', `moving a spot-holder into a full division: refused (${full.refusal})`);

  // 9 · with no date of birth, "the same child" is the same name under the same guardian email
  const noDob = (email) => ({ ...child('Emma', 'Wilson', ''), guardianEmail: email });
  const e1 = await place(org, season, d1, noDob('one@dev.local'));
  const e2 = await place(org, season, d1, noDob('two@dev.local'));
  const e3 = await place(org, season, d1, noDob('ONE@dev.local'));
  check(!e1.refusal && !e2.refusal && e3.refusal === 'duplicate',
    'two Emma Wilsons from two families both sign up; the same family twice is refused');
  const spaced = await place(org, season, d1, child('Twin', '  same ', '2016-01-01'));
  check(spaced.refusal === 'duplicate', 'a name with different case and spacing is still the same child');
} finally {
  must(await db.from('league_seasons').delete().eq('id', season));
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
