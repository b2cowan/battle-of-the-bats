/**
 * seed-stripe-walk-tournament.mjs — the walk-only tournament the Stripe end-to-end QA walks (Walk 0 and Walk 9) sign in to.
 *
 * WHAT IT BUILDS (under UAT Rep Club, `uat-rep-club` — the ONLY dev club with a connected Stripe test account):
 *   · "Stripe Walk Invitational" (slug `stripe-walk-invitational`) — ACTIVE, starts 45 days out (Toronto calendar day),
 *     public registration OPEN, the fee TRACKED (deposit $100.00, total $300.00 — "one fee for the whole event"), the
 *     organizer contact email = the address you pass with `--inbox` (so the organizer's "New Registration" alert, and
 *     every email Walk 9 asks for, lands in YOUR inbox). The contact is hidden on the public pages (the address is
 *     yours, not the club's).
 *   · Division "Walk 13U" — capacity 12, EMPTY: the next registration is a normal Pending one.
 *   · Division "Walk 15U" — capacity 1, already holding ONE accepted team, "Walk Filler Team": the next registration
 *     lands on the WAITLIST.
 *
 * HOW THE PRODUCT READS IT (verified against the live dev row of `uat-rep-club-invitational-2026`, the club's fixture
 * tournament, and the code that reads it):
 *   · "fee tracked" is the ABSENCE of `settings.fee_scope = 'free'` (lib/tournament-payments-tracked.ts). We store
 *     `fee_scope: 'tournament'`, as the fixture does.
 *   · The amounts are COLUMNS on `tournaments`: `deposit_amount` 100, `total_fee_amount` 300, `fee_schedule_mode`
 *     'tournament' (lib/registration-amount-due.ts → registrationFee). Due dates stay empty, as in the fixture — a
 *     stored date would drift out from under the walk.
 *   · Registration is open when (app/api/register/route.ts + lib/registration-state.ts): status 'active'; today <
 *     start_date; the division is not `is_closed`; `public_hidden_pages` does not contain 'register'; the host plan
 *     has `open_registration` (Club does). A division is full when its non-rejected teams >= capacity (and the
 *     division has no pool slots) → the next entry is 'waitlist'.
 *   · The organizer's alert goes to `default_contact_member_id`'s email, else `contact_email`, else the org owner,
 *     else the platform admin inbox. We leave the member NULL and `notify_mode` 'all' (re-asserted on every run), so it
 *     lands on `contact_email`.
 *
 * Run:    node --env-file=.env.local scripts/seed-stripe-walk-tournament.mjs --inbox you@example.com
 *         node --env-file=.env.local scripts/seed-stripe-walk-tournament.mjs --inbox you@example.com --reset
 *
 *   --inbox <address>  REQUIRED, never defaulted. A real inbox you can read (plus-addressing is fine). *.local cannot
 *                      receive mail and is refused.
 *   --reset            Between walk runs: removes EVERY team registered to this tournament except "Walk Filler Team",
 *                      with their payments, online payments, receipts and ledger lines in the tournament's own book,
 *                      pay-link stamps and coach links; puts the filler back to an unpaid, accepted state; then makes
 *                      sure the rest of the fixture is in place. Every delete is scoped by this tournament's id.
 *
 * Re-running without --reset is safe: the tournament, the two divisions and the filler are looked up first and only
 * put back to the shape above (a start date that has drifted inside 14 days is moved out to 45 days; teams a walk
 * registered are left alone).
 *
 * ⚠ DEV ONLY. Refuses to run unless the Supabase URL it loaded is the dev project (npgnrxaitgbtbtvvykto). Needs the
 * `uat-rep-club` org: run `node --env-file=.env.local scripts/seed-club-fixture.mjs` first if it is missing.
 * ⚠ Reset removes rows on the product's side only. Test payments stay in the Stripe sandbox (refund or ignore them
 *   there); Stripe's log of them is not ours to delete.
 */
import { createClient } from '@supabase/supabase-js';

// ── Constants ──────────────────────────────────────────────────────────────────
const DEV_REF = 'npgnrxaitgbtbtvvykto';
const ORG_SLUG = 'uat-rep-club';
const TOURNAMENT_SLUG = 'stripe-walk-invitational';
const TOURNAMENT_NAME = 'Stripe Walk Invitational';
const FILLER_NAME = 'Walk Filler Team';
const DIVISIONS = [
  { name: 'Walk 13U', capacity: 12, display_order: 0 },
  { name: 'Walk 15U', capacity: 1, display_order: 1 },
];
const DEPOSIT = 100;
const TOTAL = 300;
const DAYS_OUT = 45;     // the start date a fresh seed gets
const MIN_DAYS_OUT = 14; // a re-run moves a start date that has drifted inside this
const DAY = 86_400_000;

// ── Arguments (parsed and refused BEFORE anything touches the environment or the database) ──────────────────────
const argv = process.argv.slice(2);
const usage = [
  'Usage: node --env-file=.env.local scripts/seed-stripe-walk-tournament.mjs --inbox <your real email address> [--reset]',
  '  --inbox  REQUIRED. Where the organizer\'s emails go. Never defaulted.',
  '  --reset  Remove every team registered to the walk tournament except "Walk Filler Team" (and their payments).',
].join('\n');
function refuse(message) { console.error(`✗ ${message}\n\n${usage}`); process.exit(1); }

let inbox = null;
let RESET = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--reset') RESET = true;
  else if (a === '--inbox') { inbox = argv[i + 1] ?? ''; i++; }
  else if (a.startsWith('--inbox=')) inbox = a.slice('--inbox='.length);
  else refuse(`Unknown argument "${a}".`);
}
if (inbox === null) refuse('--inbox is required. Pass the real address the walk\'s emails should reach.');
inbox = inbox.trim().toLowerCase();
if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/.test(inbox)) refuse(`"${inbox}" is not an email address.`);
if (/\.(local|invalid|test|example|localhost)$/.test(inbox) || /@example\.(com|org|net)$/.test(inbox)) {
  refuse(`"${inbox}" cannot receive mail. Use a real inbox (plus-addressing such as you+walk@gmail.com is fine).`);
}

// ── Environment: dev only ──────────────────────────────────────────────────────
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try { process.loadEnvFile('.env.local'); } catch { /* the check below says what is missing */ }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
const ref = (() => { try { return new URL(url).hostname.split('.')[0]; } catch { return ''; } })();
if (ref !== DEV_REF) {
  console.error(`✗ Refusing to run: the Supabase project in this environment is "${ref || url}", not the dev project (${DEV_REF}).`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);
const head = (m) => console.log(`\n── ${m} ${'─'.repeat(Math.max(0, 74 - m.length))}`);
async function one(label, q) { const { data, error } = await q; die(label, error); return data; }

/** The Toronto calendar day, n days from now (the product's own "today" — lib/timezone.ts tournamentToday). */
const torontoDay = (n = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(new Date(Date.now() + n * DAY));

/** Rows a delete removed, counted (Supabase returns the rows only when asked). */
async function del(label, q) {
  const { data, error } = await q.select('id');
  die(label, error);
  return data?.length ?? 0;
}
const inChunks = (ids, n = 100) => { const out = []; for (let i = 0; i < ids.length; i += n) out.push(ids.slice(i, i + n)); return out; };

// ── The club ───────────────────────────────────────────────────────────────────
head(`Stripe walk tournament — ${RESET ? 'reset + ' : ''}ensure (dev project ${DEV_REF})`);
const org = await one('find org', db.from('organizations').select('id, slug, name, plan_id').eq('slug', ORG_SLUG).maybeSingle());
if (!org) {
  console.error(`✗ No organization with slug "${ORG_SLUG}" on dev. Build it first:\n    node --env-file=.env.local scripts/seed-club-fixture.mjs`);
  process.exit(1);
}
ok(`org ${org.name} (${org.slug}, plan ${org.plan_id})`);

// ── The tournament ─────────────────────────────────────────────────────────────
// The settings object mirrors the club's fixture tournament's, keys and all (read from dev, 2026-10-28).
const settings = {
  format: 'round_robin_playoffs',
  fee_scope: 'tournament',
  tie_breakers: ['h2h', 'rd', 'rf', 'ra'],
  buffer_minutes: 15,
  roster_require: false,
  game_timing_scope: 'tournament',
  tie_breaker_scope: 'tournament',
  roster_max_players: null,
  roster_min_players: null,
  roster_require_dob: false,
  roster_waiver_text: '',
  coach_email_payment: true,
  coach_email_game_day: true,
  coach_email_schedule: true,
  payment_instructions: '',
  coach_email_pause_all: false,
  coach_email_rejection: true,
  game_duration_minutes: 90,
  max_run_diff_per_game: null,
  roster_require_jersey: false,
  roster_require_waiver: false,
  show_fees_on_register: true,
  coach_email_acceptance: true,
  coach_email_confirmation: true,
  payment_instructions_on_form: false,
  schedule_travel_venue_buffer_minutes: 0,
  schedule_travel_facility_buffer_minutes: 0,
};

let t = await one('find tournament', db.from('tournaments').select('id, slug, name, status, start_date, end_date, year, settings').eq('org_id', org.id).eq('slug', TOURNAMENT_SLUG).neq('status', 'archived').maybeSingle());
const fresh = !t;
let startDate = t?.start_date ?? null;
const needsDates = !startDate || startDate < torontoDay(MIN_DAYS_OUT);
if (needsDates) startDate = torontoDay(DAYS_OUT);
const endDate = needsDates || !t?.end_date ? torontoDay(DAYS_OUT + 2) : t.end_date;

// What the registration route reads, asserted on every run: the organizer alert must land on contact_email.
const shape = {
  name: TOURNAMENT_NAME,
  year: Number(startDate.slice(0, 4)),
  status: 'active',
  is_active: true,
  start_date: startDate,
  end_date: endDate,
  sport: 'baseball',
  list_in_directory: false,           // a walk fixture stays out of the public directory
  contact_email: inbox,
  contact_show_on_public: false,      // the address is the walker's — not published on the public pages
  contact_show_to_coaches: true,
  default_contact_member_id: null,    // else the alert goes to that member, not to contact_email
  notify_mode: 'all',
  public_hidden_pages: [],            // 'register' in here would close the form
  fee_schedule_mode: 'tournament',
  deposit_amount: DEPOSIT,
  total_fee_amount: TOTAL,
  deposit_due_date: null,
  total_fee_due_date: null,
};
if (fresh) {
  t = await one('insert tournament', db.from('tournaments').insert({ org_id: org.id, slug: TOURNAMENT_SLUG, settings, ...shape }).select('id, slug').single());
  ok(`tournament "${TOURNAMENT_NAME}" created (${startDate} → ${endDate})`);
} else {
  // Keep any settings a walk changed; put back the keys the fee and the email depend on.
  const merged = { ...settings, ...(t.settings ?? {}), fee_scope: 'tournament', show_fees_on_register: true, coach_email_pause_all: false, coach_email_confirmation: true };
  die('update tournament', (await db.from('tournaments').update({ ...shape, settings: merged }).eq('id', t.id)).error);
  ok(`tournament "${TOURNAMENT_NAME}" found and put back to shape${needsDates ? ` (dates moved to ${startDate} → ${endDate})` : ` (dates kept: ${startDate})`}`);
}
const tournamentId = t.id;

// ── Reset: remove every walk registration except the filler ───────────────────
async function reset() {
  head('Reset — what is there, then what goes');
  const teams = await one('read teams', db.from('teams').select('id, name').eq('tournament_id', tournamentId));
  const doomed = teams.filter(x => x.name !== FILLER_NAME);
  const doomedIds = doomed.map(x => x.id);
  const ops = await one('read online payments', db.from('online_payments').select('id, processing_cost_entry_id').eq('tournament_id', tournamentId));
  const opIds = ops.map(x => x.id);
  // Online payments that belong to a doomed team but carry no tournament id are caught too.
  const extraOps = doomedIds.length ? await one('read online payments by team', db.from('online_payments').select('id, processing_cost_entry_id').in('team_id', doomedIds)) : [];
  for (const o of extraOps) if (!opIds.includes(o.id)) { opIds.push(o.id); ops.push(o); }

  const payments = await one('read team payments', db.from('tournament_team_payments').select('id, entry_id').eq('tournament_id', tournamentId));
  const receipts = await one('read fee receipts', db.from('tournament_fee_receipts').select('id, entry_id').eq('tournament_id', tournamentId));
  const items = opIds.length ? await one('read online items', db.from('online_payment_items').select('id, entry_id').in('online_payment_id', opIds)) : [];
  const refunds = opIds.length ? await one('read online refunds', db.from('online_payment_refunds').select('id, refund_entry_id, processing_cost_entry_id').in('online_payment_id', opIds)) : [];
  const claims = doomedIds.length ? await one('read claims', db.from('team_workspace_claims').select('id').eq('tournament_id', tournamentId).in('tournament_team_id', doomedIds)) : [];

  // The ledger lines these rows posted — only lines in THIS tournament's own book are removed.
  const book = await one('read book', db.from('accounting_ledgers').select('id').eq('org_id', org.id).eq('entity_type', 'tournament').eq('entity_id', tournamentId).maybeSingle());
  const entryIds = [...new Set([
    ...payments.map(x => x.entry_id), ...receipts.map(x => x.entry_id), ...items.map(x => x.entry_id),
    ...refunds.flatMap(x => [x.refund_entry_id, x.processing_cost_entry_id]), ...ops.map(x => x.processing_cost_entry_id),
  ].filter(Boolean))];
  let ownEntryIds = [];
  if (book && entryIds.length) {
    for (const part of inChunks(entryIds)) ownEntryIds.push(...(await one('read entries', db.from('accounting_entries').select('id').eq('ledger_id', book.id).in('id', part))).map(x => x.id));
  }
  const bookCount = async () => (book ? (await db.from('accounting_entries').select('id', { count: 'exact', head: true }).eq('ledger_id', book.id)).count ?? 0 : 0);

  const before = {
    teams: teams.length, 'teams to remove': doomed.length, 'team payments': payments.length, 'online payments': ops.length,
    'online items': items.length, 'online refunds': refunds.length, 'fee receipts': receipts.length,
    'ledger lines to remove': ownEntryIds.length, 'ledger lines in the tournament book': await bookCount(), 'workspace claims': claims.length,
  };
  console.log('  before:', JSON.stringify(before));
  if (entryIds.length !== ownEntryIds.length) console.log(`  ! ${entryIds.length - ownEntryIds.length} referenced ledger line(s) sit outside this tournament's book and are NOT touched.`);

  // Order matters: children of the online payments and the ledger lines first (foreign keys are NO ACTION).
  const removed = {};
  if (opIds.length) {
    removed['online refunds'] = 0; removed['online items'] = 0;
    for (const part of inChunks(opIds)) {
      await del('delete unassigned refunds', db.from('online_refunds_unassigned').delete().in('online_payment_id', part));
      removed['online refunds'] += await del('delete online refunds', db.from('online_payment_refunds').delete().in('online_payment_id', part));
      removed['online items'] += await del('delete online items', db.from('online_payment_items').delete().in('online_payment_id', part));
    }
  }
  removed['team payments'] = await del('delete team payments', db.from('tournament_team_payments').delete().eq('tournament_id', tournamentId));
  removed['fee receipts'] = await del('delete fee receipts', db.from('tournament_fee_receipts').delete().eq('tournament_id', tournamentId));
  removed['online payments'] = 0;
  for (const part of inChunks(opIds)) removed['online payments'] += await del('delete online payments', db.from('online_payments').delete().in('id', part));
  removed['ledger lines'] = 0;
  for (const part of inChunks(ownEntryIds)) removed['ledger lines'] += await del('delete ledger lines (a closed fiscal year refuses this)', db.from('accounting_entries').delete().in('id', part));
  if (claims.length) removed['workspace claims'] = await del('delete claims', db.from('team_workspace_claims').delete().in('id', claims.map(x => x.id)));
  // Teams last: this takes the coach links, roster, custom answers, adjustments and check-in rows with them.
  removed.teams = 0;
  for (const part of inChunks(doomedIds)) removed.teams += await del('delete teams', db.from('teams').delete().in('id', part));
  // Adjustments are per team; any left on the filler go too (its figures are zeroed below).
  await del('delete filler adjustments', db.from('tournament_team_entry_adjustments').delete().eq('tournament_id', tournamentId));
  console.log('  removed:', JSON.stringify(removed));

  const after = await one('read teams after', db.from('teams').select('id, name').eq('tournament_id', tournamentId));
  console.log(`  after: ${after.length} team(s) left — ${after.map(x => x.name).join(', ') || 'none'} · ledger lines in the tournament book: ${await bookCount()}`);
}
if (RESET) await reset();

// ── The divisions ──────────────────────────────────────────────────────────────
head('Divisions and the filler team');
const divId = {};
for (const d of DIVISIONS) {
  const existing = await one(`find ${d.name}`, db.from('divisions').select('id').eq('tournament_id', tournamentId).eq('name', d.name).maybeSingle());
  const row = { capacity: d.capacity, display_order: d.display_order, is_closed: false };
  if (existing) {
    die(`update ${d.name}`, (await db.from('divisions').update(row).eq('id', existing.id)).error);
    divId[d.name] = existing.id;
    ok(`division "${d.name}" found (capacity ${d.capacity}, open)`);
  } else {
    const made = await one(`insert ${d.name}`, db.from('divisions').insert({ tournament_id: tournamentId, name: d.name, ...row }).select('id').single());
    divId[d.name] = made.id;
    ok(`division "${d.name}" created (capacity ${d.capacity})`);
  }
}

// The filler: an ACCEPTED, unpaid team with no email or coach (nothing can be sent to it), in the capacity-1 division.
const filler = await one('find filler', db.from('teams').select('id').eq('tournament_id', tournamentId).eq('name', FILLER_NAME).maybeSingle());
const fillerShape = {
  division_id: divId['Walk 15U'], status: 'accepted', payment_status: 'pending', waitlist_position: null,
  deposit_paid: 0, total_paid: 0, entry_lowered: 0, fee_book_baseline: 0, payment_collected_at: null, pay_link_sent_at: null,
  check_in_status: 'not_arrived', checked_in_at: null,
};
if (filler) {
  die('update filler', (await db.from('teams').update(fillerShape).eq('id', filler.id)).error);
  ok(`"${FILLER_NAME}" found and put back to accepted + unpaid in Walk 15U`);
} else {
  await one('insert filler', db.from('teams').insert({ tournament_id: tournamentId, name: FILLER_NAME, registered_at: new Date().toISOString(), ...fillerShape }).select('id').single());
  ok(`"${FILLER_NAME}" created — accepted in Walk 15U, so its capacity of 1 is full`);
}

// ── What the registration route will see ───────────────────────────────────────
const counts = await one('count teams', db.from('teams').select('division_id, status').eq('tournament_id', tournamentId));
const live = (id) => counts.filter(x => x.division_id === id && x.status !== 'rejected').length;
ok(`Walk 13U holds ${live(divId['Walk 13U'])} of 12 · Walk 15U holds ${live(divId['Walk 15U'])} of 1 (${live(divId['Walk 15U']) >= 1 ? 'next entry waitlists' : 'NOT full — the waitlist walk will not hold'})`);

const site = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.includes('dev.fieldlogichq.ca') ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '') : 'https://dev.fieldlogichq.ca';
console.log(`
Done. Organizer contact (alerts and walk emails go here): ${inbox}

  Public page : ${site}/${ORG_SLUG}/${TOURNAMENT_SLUG}
  Register    : ${site}/${ORG_SLUG}/${TOURNAMENT_SLUG}/register
  Organizer   : ${site}/${ORG_SLUG}/admin/tournaments/registrations  (sign in as the club owner, pick "${TOURNAMENT_NAME}")

Next: walk "Walk 0 — Setup check" (it opens the public page and the register form), then Walk 9.
Between walk runs:  node --env-file=.env.local scripts/seed-stripe-walk-tournament.mjs --inbox ${inbox} --reset
(Reset clears the product's rows only; test payments stay in the Stripe sandbox.)`);
