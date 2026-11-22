/**
 * prospect-demo-signup-form.mjs — the club's own sign-up questions and the U9 friend requests, for the Milton
 * presentation's Demo 5 (house league end to end: a parent signs up, the admin places the parent-coaches' children,
 * the draft keeps families and friends together). Plan: docs/projects/active/MILTON_DEMO_WORLD_PLAN.md §9.
 *
 * Runs only when the club config has `signupForm` (Kestrel Bay, the on-sale pictures' club, has none).
 *
 *   planSignupForm(cfg, regs)   PURE, before the registrations are written: picks the parent-helpers and the friend
 *                               pairs from the world's registrations (the world is seeded, so the picks are the same on
 *                               every rebuild), and gives the live sign-up's friend her FIXED friend code (so the run
 *                               sheet can print it once and it survives every rebuild).
 *   writeSignupForm(ctx, plan)  after the registrations: the season's form (through the product's own
 *                               club_form_for_season), its questions, one submission per family-made sign-up, the
 *                               answers, and the friend requests, all in the shapes the sign-up form and the registrar
 *                               write them (mig 513 / 515 / 461).
 *
 * Nothing here needs its own reset: the season's delete takes its form (trigger club_form_owner_gone, mig 513) and the
 * form takes its questions, submissions and answers; the friend requests go with the season and the registrations.
 *
 * Shapes the product reads, checked against the code 2026-11-21:
 *  - A question asked ONCE per sign-up ("Can a parent help?") hangs on the submission, with no subject; the screens find it
 *    through the submission's `ref`, which is the registration's signup_ref, or its id when it has none (the seed's
 *    registrations have none). So a once-answer reaches ONE child: the helpers are picked from one-child households.
 *  - A question created after a child signed up reads "Not asked" on that child; the questions are dated before the
 *    season opened, so a staff-added child with no answer reads "Not answered", as it would.
 *  - The draft keeps only CONFIRMED links. A friend named by a code in the same division is confirmed on save (no one
 *    decides it); a friend named by name is confirmed by the registrar (decided_by / decided_at).
 *  - A keep-together group is at most 3 children with brothers and sisters, so no pair below joins a group past 3.
 */

/** The check letter of a friend code (lib/league-friend-code.ts; the SQL twin is league_friend_code_new). */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHECK = 'ABCDEFGHJKLMNPQRSTUVWXY';
export function friendCode(data) {
  if (!/^[2-9A-HJ-NP-Z]{5}$/.test(data)) throw new Error(`friend code data "${data}" is not five code characters`);
  let sum = 0;
  for (let i = 0; i < 5; i++) sum += (i + 1) * ALPHABET.indexOf(data[i]);
  return data + CHECK[sum % 23];
}
export const showCode = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;

const addDaysIso = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString();

/** Pure. Mutates only `friendCode` on the live friend's registration (the insert carries it; the trigger fills the rest). */
export function planSignupForm(cfg, regs) {
  const f = cfg.signupForm;
  if (!f) return null;
  const div = f.division;
  const homeSize = new Map();
  for (const r of regs) homeSize.set(r.household, (homeSize.get(r.household) ?? 0) + 1);
  const parentEmail = cfg.people?.parent?.email?.toLowerCase();
  const family = (r) => r.source === 'public_form';
  const inDiv = regs.filter(r => r.div === div && r.status === 'active');
  // One-child households in the division, family-made, never the +parent household; in order of arrival.
  const singles = inDiv.filter(r => family(r) && homeSize.get(r.household) === 1 && r.household.toLowerCase() !== parentEmail);
  // The parent-coaches and the friend pairs need their own children (9 in the pairs, the live friend among them); the
  // assistant and field set-up offers may fall on children in a pair (Milton's U9 has 14 one-child families).
  const need = f.helpers.coach + 9;
  if (singles.length < need) throw new Error(`signupForm: ${div} has ${singles.length} one-child sign-ups, ${need} needed`);
  // Spread the picks through the list rather than taking the first few (the earliest sign-ups are not the parent-coaches).
  const left = [...singles];
  const take = (n, every) => { const out = []; let i = 0; while (out.length < n && left.length) { i %= left.length; out.push(left.splice(i, 1)[0]); i += every - 1; } return out; };
  const coach = take(f.helpers.coach, 4);
  const pool = take(9, 1);
  const live = pool[8];
  const offers = singles.filter(r => !coach.includes(r) && r !== live);
  const assistant = offers.filter((_, i) => i % 3 === 0).slice(0, f.helpers.assistant);
  const fieldSetup = offers.filter((_, i) => i % 3 === 1).slice(0, f.helpers.fieldSetup);

  // Twins (or any two-child household) wholly in the division: a friend joins them as the third.
  const homes = new Map();
  for (const r of inDiv) homes.set(r.household, [...(homes.get(r.household) ?? []), r]);
  const pair = [...homes.values()].find(list => list.length === 2 && list.every(r => r.div === div) && homeSize.get(list[0].household) === 2
    && list[0].household.toLowerCase() !== parentEmail);
  if (!pair) throw new Error(`signupForm: no two-child household wholly in ${div}`);

  const [s0, s1, s2, s3, s4, s5, s6, s7] = pool;
  // Each link: who asked (`from`), who was named (`to`), how (code or name), and whether the other family asked back.
  const links = [
    { from: s0, to: s1, by: 'code' }, { from: s1, to: s0, by: 'code' },   // both asked
    { from: s2, to: s3, by: 'name' },                                     // named by name, confirmed by the registrar
    { from: s4, to: pair[0], by: 'code' },                                // a friend joins the twins: a group of 3
    { from: coach[0], to: s5, by: 'name' },                               // follows a parent-coach's locked child
    { from: s6, to: s7, by: 'code' },
  ];
  live.friendCode = friendCode(f.liveFriendCode);
  return { div, coach, assistant, fieldSetup, links, live, twins: pair };
}

/** After the registrations exist (each reg has its `id`). */
export async function writeSignupForm(ctx, plan) {
  const { db, one, insertAll, cfg, ORG, SEASON, ADMIN, regs, ok } = ctx;
  const f = cfg.signupForm;
  const formId = await one('club form', db.rpc('club_form_for_season', { p_season: SEASON, p_moved: false }));
  // Dated before the season opened, so no child reads "Not asked".
  const first = regs.map(r => r.registeredAt).sort()[0];
  const asked = addDaysIso(first, -14);
  const qrows = f.questions.map((q, i) => ({
    id: crypto.randomUUID(), org_id: ORG, form_id: formId, question_type: q.type, label: q.label,
    choices: (q.choices ?? []).map(label => ({ id: crypto.randomUUID(), label, offered: true })),
    required: !!q.required, asked: q.asked ?? 'per_subject', health: !!q.health, on_board: !!q.board, sort_order: i,
    archived_at: null, created_at: asked,
  }));
  await insertAll('club_form_questions', qrows);
  const Q = Object.fromEntries(f.questions.map((q, i) => [q.key, qrows[i]]));
  const choiceId = (key, label) => Q[key].choices.find(c => c.label === label).id;

  // One submission per family-made sign-up (staff-added children never saw the form).
  const family = regs.filter(r => r.source === 'public_form');
  const subs = await insertAll('club_form_submissions', family.map(r => ({
    org_id: ORG, form_id: formId, ref: r.id, guardian_email: r.guardian.email.toLowerCase(), created_at: r.registeredAt,
  })), 'id, ref');
  const subOf = new Map(subs.map(s => [s.ref, s.id]));

  const answers = [];
  const per = (q, r, v) => answers.push({ org_id: ORG, form_id: formId, question_id: q.id, submission_id: subOf.get(r.id),
    subject_table: 'league_registrations', subject_id: r.id, created_at: r.registeredAt, updated_at: r.registeredAt, ...v });
  const once = (q, r, v) => answers.push({ org_id: ORG, form_id: formId, question_id: q.id, submission_id: subOf.get(r.id),
    subject_table: null, subject_id: null, created_at: r.registeredAt, updated_at: r.registeredAt, ...v });

  // T-shirt size: every family; sized by division, a deterministic spread.
  const sizes = f.tShirtByDivision;
  family.forEach((r, i) => { const s = sizes[r.div]; if (s && Q.tee) per(Q.tee, r, { value_choice_ids: [choiceId('tee', s[i % s.length])] }); });
  // Allergies or medical needs (a health question: never on the board): most families answer, nearly all "None".
  if (Q.allergies) family.forEach((r, i) => {
    if (i % 4 === 3) return; // left blank
    per(Q.allergies, r, { value_text: i % 9 === 0 ? f.allergyNotes[(i / 9) % f.allergyNotes.length] : 'None' });
  });
  // Can a parent help? (asked once per sign-up; shows on the draft board)
  const helped = new Set();
  const help = (r, labels) => { helped.add(r.id); once(Q.help, r, { value_choice_ids: labels.map(l => choiceId('help', l)) }); };
  plan.coach.forEach(r => help(r, ['Coach']));
  plan.assistant.forEach((r, i) => help(r, i % 2 ? ['Assistant coach', 'Field set-up'] : ['Assistant coach']));
  plan.fieldSetup.forEach(r => help(r, ['Field set-up']));
  // Other divisions: a few offers too, so the question reads as the club's, not the demo's.
  const homeSize = new Map();
  for (const r of regs) homeSize.set(r.household, (homeSize.get(r.household) ?? 0) + 1);
  family.filter(r => r.div !== plan.div && homeSize.get(r.household) === 1).forEach((r, i) => {
    if (i % 6 === 0) help(r, [i % 12 === 0 ? 'Assistant coach' : 'Field set-up']);
  });
  await insertAll('club_form_answers', answers);

  // Friend requests (mig 461): one row per friend a family named, on the asking child's sign-up.
  const { data: codes, error } = await db.from('league_registrations').select('id, friend_code').eq('season_id', SEASON)
    .in('id', [...new Set(plan.links.flatMap(l => [l.from.id, l.to.id]).concat(plan.live.id))]);
  if (error) throw error;
  const codeOf = new Map(codes.map(c => [c.id, c.friend_code]));
  if (codeOf.get(plan.live.id) !== plan.live.friendCode) throw new Error(`live friend code is ${codeOf.get(plan.live.id)}, expected ${plan.live.friendCode}`);
  const slot = new Map();
  const rows = plan.links.map(l => {
    const n = (slot.get(l.from.id) ?? 0) + 1;
    slot.set(l.from.id, n);
    // A family names its friend when it signs up; a CODE resolves only once the friend's sign-up exists (mig 461's save), so
    // a code request is dated at the later of the two sign-ups. A NAME is matched by the registrar an hour after that.
    const later = l.from.registeredAt > l.to.registeredAt ? l.from.registeredAt : l.to.registeredAt;
    const base = { org_id: ORG, season_id: SEASON, registration_id: l.from.id, slot: n, state: 'confirmed', matched_registration_id: l.to.id,
      created_at: l.by === 'code' ? later : l.from.registeredAt, updated_at: later };
    if (l.by === 'code') return { ...base, code_entered: codeOf.get(l.to.id), decided_at: later };
    const decided = new Date(Date.parse(later) + 3600000).toISOString();
    return { ...base, typed_first: l.to.first, typed_last: l.to.last, typed_parent: `${l.to.guardian.first} ${l.to.guardian.last}`,
      decided_by: ADMIN, decided_at: decided, updated_at: decided };
  });
  await insertAll('league_friend_requests', rows);

  ok(`${qrows.length} sign-up questions (${f.questions.map(q => `"${q.label}"`).join(', ')}) · ${subs.length} sign-ups answered · ${answers.length} answers`);
  ok(`${plan.div} "Can a parent help?": Coach ${plan.coach.length} · Assistant coach ${plan.assistant.length} · Field set-up ${plan.fieldSetup.length}`);
  ok(`${rows.length} confirmed friend requests in ${plan.div} (one pair both asked; one friend joins the twins ${plan.twins[0].first} and ${plan.twins[1].first} ${plan.twins[0].last})`);
  return {
    coaches: plan.coach.map(r => ({ child: `${r.first} ${r.last}`, parent: `${r.guardian.first} ${r.guardian.last}`, email: r.guardian.email })),
    liveFriend: { child: `${plan.live.first} ${plan.live.last}`, code: showCode(plan.live.friendCode) },
  };
}
