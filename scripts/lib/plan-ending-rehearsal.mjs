/**
 * PLANS END AT THE RENEWAL DATE · STAGE 3 — the pure half of the Stripe test-clock rehearsal (G10, G13 a).
 *
 * `scripts/rehearse-plan-ending.mjs` drives Stripe and reads the dev database; everything that decides anything lives here,
 * where it is unit-tested without Stripe (`tests/unit/plan-ending-rehearsal.test.ts`):
 *   · `refusal` — test key and dev database, or nothing runs (scripts/lib/billing-walk-fixture.mjs, shared with the walk seeds);
 *   · `CASES` — each case's steps and its EXPECTED end state, written before any run;
 *   · `evaluate` / `classify` — PASS, FAIL or SURPRISE;
 *   · `notYet` — what a wait is still waiting for (a timeout names it);
 *   · `portalGate` — case 0 reads the shared portal audit (scripts/lib/stripe-portal-audit.mjs);
 *   · `resetSelection` — exactly the marker's clubs and clocks;
 *   · `renderReport` — the evidence report the owner walk reads.
 *
 * Two kinds of expectation:
 *   must    — what OUR code should leave. Wrong = FAIL.
 *   assumed — what the plan assumed STRIPE does. Wrong = SURPRISE (even when our end state is right): the report names it.
 */
export { refusal, DEV_REF } from './billing-walk-fixture.mjs';

export const MARKER = 'plan-ending-rehearsal';
export const RETENTION_DAYS = 90; // BILLING_RETENTION_DAYS (lib/billing-cancellation-policy.ts) — a club, not a Coaches Portal
export const DAY = 86_400_000;

// ── Matchers ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const is = value => ({ kind: 'is', value });
export const present = () => ({ kind: 'present' });
export const absent = () => ({ kind: 'absent' });
/** A count; a count nobody recorded is 0. */
export const count = value => ({ kind: 'count', value });
/** The same instant as another observed path (to the minute: Stripe stores seconds, we store milliseconds). */
export const sameAs = path => ({ kind: 'sameAs', path });
/** Exactly equal to the value at another observed path (an amount, a count, a flag). */
export const equals = path => ({ kind: 'equals', path });
/** Exactly `days` whole days after another observed path (the data clock). */
export const daysAfter = (path, days) => ({ kind: 'daysAfter', path, days });
/** A later instant than another observed path. */
export const laterThan = path => ({ kind: 'laterThan', path });
/** A list of event types: holds this type at least once. */
export const includes = type => ({ kind: 'includes', type });
/** A list of event types: never holds this type. */
export const excludes = type => ({ kind: 'excludes', type });
/** A list of event types: these appear in this order (other events may sit between them). */
export const inOrder = types => ({ kind: 'inOrder', types });
/** The webhook ledger rows: every delivered event ran to the end, none failed. */
export const allProcessed = () => ({ kind: 'allProcessed' });

export const must = (label, path, matcher) => ({ label, path, matcher, level: 'must' });
export const assumed = (label, path, matcher) => ({ label, path, matcher, level: 'assumed' });

/** `a.b.c` into an observed object; array indexes are ordinary keys. */
function get(observed, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), observed);
}

const ms = value => (value == null ? NaN : typeof value === 'number' ? value : new Date(value).getTime());
const show = value => (value === undefined ? 'nothing' : JSON.stringify(value));

/** One expectation against the observed state → `{ ok, actual, detail }`. */
export function evaluate(expectation, observed) {
  const { path, matcher } = expectation;
  const actual = get(observed, path);
  const other = matcher.path ? get(observed, matcher.path) : undefined;
  switch (matcher.kind) {
    case 'is':
      return { ok: actual === matcher.value, actual, detail: `expected ${show(matcher.value)}, saw ${show(actual)}` };
    case 'present':
      return { ok: actual != null && actual !== '', actual, detail: `expected a value, saw ${show(actual)}` };
    case 'absent':
      return { ok: actual == null, actual, detail: `expected nothing, saw ${show(actual)}` };
    case 'count': {
      const n = actual ?? 0;
      return { ok: n === matcher.value, actual: n, detail: `expected ${matcher.value}, saw ${n}` };
    }
    case 'sameAs': {
      const ok = Number.isFinite(ms(actual)) && Number.isFinite(ms(other)) && Math.abs(ms(actual) - ms(other)) < 60_000;
      return { ok, actual, detail: `expected the same instant as ${matcher.path} (${show(other)}), saw ${show(actual)}` };
    }
    case 'equals':
      return { ok: actual !== undefined && actual === other, actual, detail: `expected ${matcher.path} (${show(other)}), saw ${show(actual)}` };
    case 'daysAfter': {
      const want = ms(other) + matcher.days * DAY;
      const ok = Number.isFinite(ms(actual)) && Number.isFinite(want) && Math.abs(ms(actual) - want) < 60_000;
      return { ok, actual, detail: `expected ${matcher.days} days after ${matcher.path} (${show(other)}), saw ${show(actual)}` };
    }
    case 'laterThan': {
      const ok = Number.isFinite(ms(actual)) && Number.isFinite(ms(other)) && ms(actual) > ms(other) + 60_000;
      return { ok, actual, detail: `expected later than ${matcher.path} (${show(other)}), saw ${show(actual)}` };
    }
    case 'includes': {
      const list = actual ?? [];
      return { ok: list.includes(matcher.type), actual: list, detail: `expected ${matcher.type} among [${list.join(', ')}]` };
    }
    case 'excludes': {
      const list = actual ?? [];
      return { ok: !list.includes(matcher.type), actual: list, detail: `expected no ${matcher.type} among [${list.join(', ')}]` };
    }
    case 'inOrder': {
      const list = actual ?? [];
      let at = -1;
      const missing = [];
      for (const type of matcher.types) {
        const next = list.indexOf(type, at + 1);
        if (next < 0) { missing.push(type); continue; }
        at = next;
      }
      return {
        ok: missing.length === 0, actual: list,
        detail: missing.length ? `expected ${matcher.types.join(' → ')}; out of order or missing: ${missing.join(', ')} in [${list.join(', ')}]` : `${matcher.types.join(' → ')}`,
      };
    }
    case 'allProcessed': {
      const rows = actual ?? [];
      const bad = rows.filter(r => r.error || (!r.processed && !r.ignored));
      return { ok: bad.length === 0, actual: rows.length, detail: bad.length ? `unfinished or failed: ${bad.map(r => `${r.type}${r.error ? ` (${r.error})` : ''}`).join(', ')}` : `${rows.length} delivered, all ran` };
    }
    default:
      throw new Error(`Unknown matcher ${matcher.kind}`);
  }
}

/** The labels of the expectations not yet met — what a wait is still waiting for. */
export function notYet(expectations, observed) {
  return expectations.filter(e => !evaluate(e, observed).ok).map(e => e.label);
}

/**
 * A case's verdict. FAIL: a step went wrong, a wait timed out (naming what never arrived), or a `must` is wrong. SURPRISE:
 * every `must` held but Stripe did something the plan did not assume. PASS: both held.
 *
 * @param {{ expectations: Array<{ label: string, path: string, matcher: any, level: string }>, observed: any,
 *   timedOut?: string[], stepErrors?: string[] }} input
 */
export function classify({ expectations, observed, timedOut = [], stepErrors = [] }) {
  const checks = expectations.map(e => ({ ...e, ...evaluate(e, observed) }));
  const failed = checks.filter(c => !c.ok && c.level === 'must');
  const surprised = checks.filter(c => !c.ok && c.level === 'assumed');
  const reasons = [
    ...stepErrors.map(s => `step failed: ${s}`),
    ...timedOut.map(t => `timed out waiting for: ${t}`),
    ...failed.map(c => `${c.label} — ${c.detail}`),
    ...surprised.map(c => `SURPRISE · ${c.label} — ${c.detail}`),
  ];
  const verdict = stepErrors.length || timedOut.length || failed.length ? 'FAIL' : surprised.length ? 'SURPRISE' : 'PASS';
  return { verdict, checks, reasons };
}

// ── Case 0 · the portal (G13 a) ─────────────────────────────────────────────────────────────────────────────────────

/** Reads the shared portal audit's checks: `missing` = ours does not exist in this mode yet (open the portal once, re-read). */
export function portalGate(checks) {
  const config = checks.find(c => c.key === 'configuration');
  const missing = config?.status !== 'PASS';
  return { ok: !missing && !checks.some(c => c.status === 'FAIL'), missing };
}

// ── Reset ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Exactly what the rehearsal made: clubs carrying the marker, clocks whose name starts with it. Nothing else. With `caseIds`,
 * only those cases' clubs and clocks (a re-run of one case leaves the walk's other kept clubs alone).
 * @param {{ orgs?: Array<{ id: string, name?: string, internal_notes?: string | null }>, clocks?: Array<{ id: string, name?: string | null }>,
 *   caseIds?: string[] | null }} found
 */
export function resetSelection({ orgs = [], clocks = [], caseIds = null }) {
  const ours = orgs.filter(o => o.internal_notes === MARKER);
  const clockOurs = clocks.filter(c => typeof c.name === 'string' && c.name.startsWith(`${MARKER} `));
  if (!caseIds) return { orgIds: ours.map(o => o.id), clockIds: clockOurs.map(c => c.id) };
  return {
    orgIds: ours.filter(o => caseIds.some(id => o.name === clubName(id))).map(o => o.id),
    clockIds: clockOurs.filter(c => caseIds.some(id => c.name?.startsWith(clockPrefix(id)))).map(c => c.id),
  };
}

/** A case's club name and its clock's name prefix (the trailing space keeps case 1 apart from 10 and 11). */
export const clubName = id => `Rehearsal ${id} Club`;
export const clockPrefix = id => `${MARKER} ${id} `;

// ── The cases (EXPECTED states written before any run) ──────────────────────────────────────────────────────────────
//
// Each case: `setup` (one club on its own test clock), `steps` the driver performs in order, and `expect`. Steps:
//   ownerCancel · ownerKeep · ownerDowngrade {keep} · ownerMove {plan} — the dev site's own routes, signed in as the club's owner
//   operatorEndNow {reason}                     — the operator's End now, signed in as the UAT platform operator
//   stripeFlag {on}                             — cancel_at_period_end set through Stripe's API (the portal's EFFECT, not its page)
//   rawFlagOnScheduled                          — ask Stripe to set the flag on a schedule-managed subscription; record the answer
//   failingCard                                 — make the customer's default card one that declines (pm_card_chargeCustomerFail)
//   createTournament {name}                     — a tournament written into the record during the wait (not the create screen)
//   touchMetadata {times}                       — real `customer.subscription.updated` events that change nothing
//   advance {to, days?, hours}                  — move the clock: to 'periodEnd' | 'trialEnd' | 'start' (+days), plus hours
//   wait {until}                                — poll the dev database until each holds, or time out naming what never did
//   snapshot {as}                               — record the state under a name (`start` and `end` are taken by the driver)
//   resendEvent {type}                          — Stripe CLI `events resend` of this case's event of that type to the dev endpoint
//   signedReplay {type}                         — the same event's content under a NEW event id, signed with our webhook secret
//
// Observed shape (per snapshot): org{…} · intent{…} (the newest row) · intents{total, pending, applied, cancel, downgrade} ·
// retained{account, tournament} · events{subscription_canceled, plan_downgraded} · emails{<kind>: n} · tournaments{<name>: status}
// · stripe{status, cancel_at_period_end, cancel_at, ended_at, schedule, plan, current_period_end, paid_cents, last_paid_cents,
// open_invoices} · stripeEvents[types in this snapshot's window] · ledger[{id, type, processed, ignored, error, attempts}] ·
// ledgerTypes[types]. A snapshot's window runs from the previous NAMED snapshot; re-taking a name keeps its window.
// Plus `setup.{periodEnd, trialEnd, priceCents}` and `notes.*` from the steps.

const allRan = must('every message Stripe delivered ran to the end', 'end.ledger', allProcessed());
const pendingIn = (snap, what = 'a waiting cancel') => must(what, `${snap}.intents.pending`, count(1));
const movedOn = must('the renewal date moved on', 'end.org.current_period_end', laterThan('setup.periodEnd'));
const renewedOn = plan => [
  must('renewed: active', 'end.org.subscription_status', is('active')),
  must('renewed: the plan is unchanged', 'end.org.plan_id', is(plan)),
  must("renewed: the date is Stripe's new period end", 'end.org.current_period_end', sameAs('end.stripe.current_period_end')),
  movedOn,
];

/** Once END to end: the click's own email, never a second from Stripe's late echo of the same change. */
const endsOnOnce = must('the "ends on" email went once, end to end', 'end.emails.plan_ends_on', count(1));
/** After a Keep or a Renew, at the END (Stripe's echo of the keep lands after the "kept" snapshot): nothing came back. */
const keptForGood = rows => [
  must('at the end: the "kept" email still only once', 'end.emails.plan_kept', count(1)),
  must('at the end: nothing waits', 'end.intents.pending', count(0)),
  must(`at the end: ${rows} row(s), no second cancel`, 'end.intents.total', count(rows)),
];

const ended = [
  must('the club is suspended (cancelled)', 'end.org.subscription_status', is('canceled')),
  must('the waiting cancel became the applied ending', 'end.intent.status', is('applied')),
  must('one ending, no second row', 'end.intents.applied', count(1)),
  must('the ending is dated by Stripe\'s own end', 'end.intent.effective_at', sameAs('end.stripe.ended_at')),
  must('suspended from the END DATE', 'end.org.billing_suspended_at', sameAs('end.stripe.ended_at')),
  must('the data clock runs 90 days from the end date', 'end.intent.retention_until', daysAfter('end.stripe.ended_at', RETENTION_DAYS)),
  must('one account restore record', 'end.retained.account', count(1)),
  must('one "subscription cancelled" platform event', 'end.events.subscription_canceled', count(1)),
  must('the "ended" email, once', 'end.emails.cancellation_confirmation', count(1)),
  must('the record no longer names a subscription', 'end.org.stripe_subscription_id', absent()),
  allRan,
];

export const CASES = [
  {
    id: '1', title: 'Control: renews with nothing pending',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [movedOn] },
    ],
    expect: [
      ...renewedOn('tournament_plus'),
      must('no ending row', 'end.intents.total', count(0)),
      must('nothing archived or retained', 'end.retained.account', count(0)),
      must('no "ends on" email', 'end.emails.plan_ends_on', count(0)),
      must('no "ended" email', 'end.emails.cancellation_confirmation', count(0)),
      allRan,
      assumed('the renewal was charged', 'end.stripeEvents', includes('invoice.payment_succeeded')),
      assumed('no subscription ended', 'end.stripeEvents', excludes('customer.subscription.deleted')),
    ],
  },
  {
    id: '2', title: 'Cancel, monthly',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting'), must('the "ends on" email stamped', 'waiting.intent.ends_on_email_sent_at', present())] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the ending applied', 'end.intent.status', is('applied')), must('the "ended" email stamped', 'end.intent.ended_email_sent_at', present())] },
    ],
    expect: [
      must('the cancel waits as a cancel', 'waiting.intent.intent_type', is('cancellation')),
      must('it waits for the renewal date', 'waiting.intent.effective_at', sameAs('setup.periodEnd')),
      must('the account stays active while it waits', 'waiting.org.subscription_status', is('active')),
      must('Stripe holds the cancel at period end', 'waiting.stripe.cancel_at_period_end', is(true)),
      must('the "ends on" email, once', 'waiting.emails.plan_ends_on', count(1)),
      ...ended,
      must('the "ends on" email still only once', 'end.emails.plan_ends_on', count(1)),
      must('the tournament is retained', 'end.retained.tournament', count(1)),
      assumed('Stripe ended the subscription AT the period end', 'end.stripe.ended_at', sameAs('setup.periodEnd')),
      assumed('the end arrived as "subscription deleted"', 'end.stripeEvents', includes('customer.subscription.deleted')),
      assumed('nothing was charged at the end', 'end.stripeEvents', excludes('invoice.payment_succeeded')),
    ],
  },
  {
    id: '3', title: 'Cancel, annual (one month in, then past the year)',
    setup: { plan: 'tournament_plus', cycle: 'annual', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'advance', to: 'start', days: 31, hours: 0 },
      { do: 'snapshot', as: 'month' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the ending applied', 'end.intent.status', is('applied'))] },
    ],
    expect: [
      must('it waits for the year\'s end', 'waiting.intent.effective_at', sameAs('setup.periodEnd')),
      must('one month in: still active', 'month.org.subscription_status', is('active')),
      must('one month in: still waiting', 'month.intent.status', is('pending')),
      must('one month in: nothing retained', 'month.retained.account', count(0)),
      must('one month in: no "ended" email', 'month.emails.cancellation_confirmation', count(0)),
      assumed('one month in: no invoice', 'month.stripeEvents', excludes('invoice.created')),
      assumed('one month in: no charge', 'month.stripeEvents', excludes('invoice.payment_succeeded')),
      assumed('one month in: nothing ended', 'month.stripeEvents', excludes('customer.subscription.deleted')),
      ...ended,
      endsOnOnce,
      assumed('Stripe ended the subscription AT the year\'s end', 'end.stripe.ended_at', sameAs('setup.periodEnd')),
    ],
  },
  {
    id: '4', title: 'Cancel while trialing (G5)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', trialDays: 14, tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'advance', to: 'trialEnd', hours: 2 },
      { do: 'wait', until: [must('the ending applied', 'end.intent.status', is('applied'))] },
    ],
    expect: [
      must('it waits for the trial\'s end', 'waiting.intent.effective_at', sameAs('setup.trialEnd')),
      must('the "ends on" email, once', 'waiting.emails.plan_ends_on', count(1)),
      ...ended,
      endsOnOnce,
      must('no "trial ending, add a card" email (G5)', 'end.emails.trial_ending', count(0)),
      must('nothing was ever charged', 'end.stripe.paid_cents', count(0)),
      assumed('Stripe sent its "trial will end" message (so G5 had something to skip)', 'end.stripeEvents', includes('customer.subscription.trial_will_end')),
      assumed('Stripe ended the subscription AT the trial\'s end', 'end.stripe.ended_at', sameAs('setup.trialEnd')),
    ],
  },
  {
    // Re-framed (2026-11-04): with a cancel already waiting Stripe never charges again, so a card cannot fail "while a cancel
    // waits" by itself. The honest version: the renewal's card fails, and the owner cancels while the account is past due.
    id: '5', title: 'A card fails at renewal, then the owner cancels while past due',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'failingCard' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the account is past due', 'pastDue.org.subscription_status', is('past_due'))] },
      { do: 'snapshot', as: 'pastDue' },
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the ending applied', 'end.intent.status', is('applied'))] },
    ],
    expect: [
      assumed('the failed renewal arrived as "payment failed"', 'pastDue.stripeEvents', includes('invoice.payment_failed')),
      must('a past-due account can still cancel at its date (past due counts as paying)', 'waiting.intent.intent_type', is('cancellation')),
      must('it waits for the unpaid period\'s end', 'waiting.intent.effective_at', sameAs('waiting.stripe.current_period_end')),
      must('while it waits the record says past due (an unpaid bill AND an end date — the owner judges this state)', 'waiting.org.subscription_status', is('past_due')),
      ...ended,
      endsOnOnce,
      assumed('Stripe\'s retries did not end it early: it ended on the date', 'end.stripe.ended_at', sameAs('waiting.intent.effective_at')),
      assumed('no retry succeeded', 'end.stripeEvents', excludes('invoice.payment_succeeded')),
    ],
  },
  {
    id: '6a', title: 'Cancel then Renew, the portal\'s EFFECT set through Stripe\'s API (not the portal page)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'stripeFlag', on: true },
      { do: 'wait', until: [must('a waiting cancel from Stripe', 'waiting.intents.pending', count(1)), must('the "ends on" email stamped', 'waiting.intent.ends_on_email_sent_at', present())] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'stripeFlag', on: false },
      { do: 'wait', until: [must('the waiting cancel is withdrawn', 'kept.intents.pending', count(0)), must('the "kept" email stamped', 'kept.intent.kept_email_sent_at', present())] },
      { do: 'snapshot', as: 'kept' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [movedOn] },
    ],
    expect: [
      must('the row says it came from Stripe\'s portal', 'waiting.intent.door', is('stripe_portal')),
      must('it waits for the renewal date', 'waiting.intent.effective_at', sameAs('setup.periodEnd')),
      must('the "ends on" email, once', 'waiting.emails.plan_ends_on', count(1)),
      must('Renew withdrew the row', 'kept.intent.status', is('canceled')),
      must('the "kept" email, once', 'kept.emails.plan_kept', count(1)),
      ...renewedOn('tournament_plus'),
      must('no "ended" email', 'end.emails.cancellation_confirmation', count(0)),
      must('the "kept" email still only once', 'end.emails.plan_kept', count(1)),
      must('nothing retained', 'end.retained.account', count(0)),
      allRan,
    ],
  },
  {
    id: '6b', title: 'Owner cancels over a cheaper move, then Renews the portal\'s way (the Part C open item)',
    setup: { plan: 'club_large', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerMove', plan: 'club' },
      { do: 'wait', until: [must('Stripe holds the cheaper move', 'moved.stripe.schedule', present())] },
      { do: 'snapshot', as: 'moved' },
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'stripeFlag', on: false },
      { do: 'wait', until: [must('the waiting cancel is withdrawn', 'renewed.intents.pending', count(0))] },
      { do: 'snapshot', as: 'renewed' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [movedOn] },
    ],
    expect: [
      must('the cancel set the cheaper move aside (held on the row)', 'waiting.intent.held_move_plan', is('club')),
      must('the cancel released Stripe\'s schedule', 'waiting.stripe.schedule', absent()),
      must('Renew withdrew the row', 'renewed.intent.status', is('canceled')),
      must('the "kept" email, once', 'renewed.emails.plan_kept', count(1)),
      assumed('as the plan notes: Renew does NOT put the cheaper move back', 'renewed.stripe.schedule', absent()),
      assumed('so it renews at the higher price, on Club Large', 'end.org.plan_id', is('club_large')),
      must('renewed: active', 'end.org.subscription_status', is('active')),
      ...keptForGood(1),
      endsOnOnce,
      allRan,
    ],
  },
  {
    id: '7', title: 'Cancel while a cheaper-plan move waits, then Keep (G1)',
    setup: { plan: 'club_large', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerMove', plan: 'club' },
      { do: 'wait', until: [must('Stripe holds the cheaper move', 'moved.stripe.schedule', present())] },
      { do: 'snapshot', as: 'moved' },
      { do: 'rawFlagOnScheduled' },
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'ownerKeep' },
      { do: 'wait', until: [must('the waiting cancel is withdrawn', 'kept.intents.pending', count(0)), must('Stripe holds the cheaper move again', 'kept.stripe.schedule', present())] },
      { do: 'snapshot', as: 'kept' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the club is on Club', 'end.org.plan_id', is('club'))] },
    ],
    expect: [
      assumed('Stripe refuses a cancel flag on a schedule-managed subscription', 'notes.rawFlag.refused', is(true)),
      must('the cancel set the cheaper move aside (held on the row)', 'waiting.intent.held_move_plan', is('club')),
      must('the cancel released Stripe\'s schedule', 'waiting.stripe.schedule', absent()),
      must('Stripe holds the cancel at period end', 'waiting.stripe.cancel_at_period_end', is(true)),
      must('Keep cleared Stripe\'s cancel', 'kept.stripe.cancel_at_period_end', is(false)),
      must('Keep re-scheduled the cheaper move', 'kept.stripe.schedule', present()),
      must('the "kept" email, once', 'kept.emails.plan_kept', count(1)),
      must('renewed as Club (never at the Club Large price)', 'end.org.plan_id', is('club')),
      must('Stripe bills Club now', 'end.stripe.plan', is('club')),
      must('the renewal charge is the Club price', 'end.stripe.last_paid_cents', equals('setup.priceCents.club')),
      must('active', 'end.org.subscription_status', is('active')),
      ...keptForGood(1),
      endsOnOnce,
      allRan,
    ],
  },
  {
    id: '8', title: 'Free downgrade, a tournament created during the wait (G2)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Kept Cup', 'active'], ['Other Cup', 'active']] },
    steps: [
      { do: 'ownerDowngrade', keep: ['Kept Cup'] },
      { do: 'wait', until: [pendingIn('waiting', 'a waiting move'), must('the "move scheduled" email stamped', 'waiting.intent.ends_on_email_sent_at', present())] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'createTournament', name: 'Wait Cup' },
      { do: 'snapshot', as: 'during' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the move applied', 'end.intent.status', is('applied')), must('the "now on the free plan" email stamped', 'end.intent.ended_email_sent_at', present())] },
    ],
    expect: [
      must('it waits as a move, not a cancel', 'waiting.intent.intent_type', is('downgrade')),
      must('it waits for the renewal date', 'waiting.intent.effective_at', sameAs('setup.periodEnd')),
      must('limits unchanged while it waits', 'during.org.plan_id', is('tournament_plus')),
      must('the tournament limit is unchanged while it waits', 'during.org.tournament_limit', equals('start.org.tournament_limit')),
      must('the "move scheduled" email, once', 'waiting.emails.plan_downgrade_scheduled', count(1)),
      must('on the date: the free plan', 'end.org.plan_id', is('tournament')),
      must('on the date: the account stays active', 'end.org.subscription_status', is('active')),
      must('on the date: never suspended', 'end.org.billing_suspended_at', absent()),
      must('the picked tournament survives', 'end.tournaments.Kept Cup', is('active')),
      must('the other is archived', 'end.tournaments.Other Cup', is('archived')),
      must('the one made during the wait is archived', 'end.tournaments.Wait Cup', is('archived')),
      must('a restore record for each archived tournament', 'end.retained.tournament', count(2)),
      must('no account restore record (a move is not an ending)', 'end.retained.account', count(0)),
      must('the data clock runs 90 days from the date', 'end.intent.retention_until', daysAfter('end.stripe.ended_at', RETENTION_DAYS)),
      must('one "plan downgraded" platform event', 'end.events.plan_downgraded', count(1)),
      must('no cancellation event', 'end.events.subscription_canceled', count(0)),
      must('no cancellation row', 'end.intents.cancel', count(0)),
      must('the "now on the free plan" email, once', 'end.emails.plan_downgraded', count(1)),
      must('no "ended" email', 'end.emails.cancellation_confirmation', count(0)),
      allRan,
      assumed('Stripe ended the subscription AT the period end', 'end.stripe.ended_at', sameAs('setup.periodEnd')),
    ],
  },
  {
    id: '9', title: 'Free downgrade, then the owner cancels (replaces it), then Keep',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Only Cup', 'active']] },
    steps: [
      { do: 'ownerDowngrade', keep: ['Only Cup'] },
      { do: 'wait', until: [pendingIn('moving', 'a waiting move')] },
      { do: 'snapshot', as: 'moving' },
      { do: 'ownerCancel' },
      { do: 'wait', until: [must('the waiting change is now a cancel', 'replaced.intent.intent_type', is('cancellation'))] },
      { do: 'snapshot', as: 'replaced' },
      { do: 'ownerKeep' },
      { do: 'wait', until: [must('nothing waits', 'kept.intents.pending', count(0))] },
      { do: 'snapshot', as: 'kept' },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [movedOn] },
    ],
    expect: [
      must('the cancel replaced the move: one waiting row', 'replaced.intents.pending', count(1)),
      must('Keep cleared Stripe\'s cancel', 'kept.stripe.cancel_at_period_end', is(false)),
      must('the "kept" email, once', 'kept.emails.plan_kept', count(1)),
      must('renewed on the full paid plan, not the downgrade', 'end.org.plan_id', is('tournament_plus')),
      must('active', 'end.org.subscription_status', is('active')),
      must('nothing archived', 'end.tournaments.Only Cup', is('active')),
      must('no restore records', 'end.retained.tournament', count(0)),
      must('no "plan downgraded" event', 'end.events.plan_downgraded', count(0)),
      must('no "now on the free plan" email', 'end.emails.plan_downgraded', count(0)),
      must('renewed: the date is Stripe\'s new period end', 'end.org.current_period_end', sameAs('end.stripe.current_period_end')),
      ...keptForGood(2),
      allRan,
    ],
  },
  {
    id: '10', title: 'End now (operator, immediate)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'operatorEndNow', reason: 'Rehearsal: End now' },
      { do: 'wait', until: [must('Stripe stopped', 'end.stripe.status', is('canceled')), must('the ending applied', 'end.intent.status', is('applied')), must('Stripe\'s "deleted" ran here', 'end.ledgerTypes', includes('customer.subscription.deleted'))] },
    ],
    expect: [
      must('the club is suspended (cancelled)', 'end.org.subscription_status', is('canceled')),
      must('Stripe stopped', 'end.stripe.status', is('canceled')),
      must('the typed reason is recorded', 'end.intent.reason', is('Rehearsal: End now')),
      must('one ending — Stripe\'s "deleted" did not make a second', 'end.intents.applied', count(1)),
      must('one "subscription cancelled" platform event', 'end.events.subscription_canceled', count(1)),
      must('one account restore record', 'end.retained.account', count(1)),
      must('the "ended" email, once', 'end.emails.cancellation_confirmation', count(1)),
      allRan,
    ],
  },
  {
    id: '11', title: 'A replayed "subscription deleted" (G7)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting')] },
      { do: 'advance', to: 'periodEnd', hours: 2 },
      { do: 'wait', until: [must('the ending applied', 'applied.intent.status', is('applied')), must('the "ended" email stamped', 'applied.intent.ended_email_sent_at', present())] },
      { do: 'snapshot', as: 'applied' },
      { do: 'resendEvent', type: 'customer.subscription.deleted' },
      { do: 'snapshot', as: 'resent' },
      { do: 'signedReplay', type: 'customer.subscription.deleted' },
      { do: 'snapshot', as: 'end' },
    ],
    expect: [
      must('Stripe accepted the re-send of the same message (a duplicate leaves no trace here, so its arrival is not observable)', 'notes.resend.sent', is(true)),
      must('after the re-send: still one ending', 'resent.intents.applied', count(1)),
      must('after the re-send: still one "ended" email', 'resent.emails.cancellation_confirmation', count(1)),
      { ...must('the new-id copy was accepted by the dev site', 'notes.replay.status', is(200)), half: 'b' },
      { ...must('the new-id copy ran (its own ledger row)', 'notes.replay.ledgerProcessed', is(true)), half: 'b' },
      must('after every copy: one ending', 'end.intents.applied', count(1)),
      must('after every copy: one "ended" email', 'end.emails.cancellation_confirmation', count(1)),
      must('after every copy: one platform event', 'end.events.subscription_canceled', count(1)),
      must('after every copy: one account restore record', 'end.retained.account', count(1)),
      must('after every copy: the tournament\'s restore record once', 'end.retained.tournament', count(1)),
      must('the ending\'s date did not move', 'end.intent.effective_at', sameAs('applied.intent.effective_at')),
      must('the data clock did not move', 'end.intent.retention_until', sameAs('applied.intent.retention_until')),
    ],
  },
  {
    id: '12a', title: 'An "updated" storm on a waiting cancel',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Spring Classic', 'active']] },
    steps: [
      { do: 'ownerCancel' },
      { do: 'wait', until: [pendingIn('waiting'), must('the "ends on" email stamped', 'waiting.intent.ends_on_email_sent_at', present())] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'touchMetadata', times: 5 },
    ],
    expect: [
      must('one waiting row', 'end.intents.pending', count(1)),
      must('no other row', 'end.intents.total', count(1)),
      must('still a cancel', 'end.intent.intent_type', is('cancellation')),
      must('the date did not move', 'end.intent.effective_at', sameAs('waiting.intent.effective_at')),
      must('the "ends on" email, once', 'end.emails.plan_ends_on', count(1)),
      allRan,
    ],
  },
  {
    id: '12b', title: 'An "updated" storm on a waiting free downgrade (the Stage 2 collision)',
    setup: { plan: 'tournament_plus', cycle: 'monthly', tournaments: [['Only Cup', 'active']] },
    steps: [
      { do: 'ownerDowngrade', keep: ['Only Cup'] },
      { do: 'wait', until: [pendingIn('waiting', 'a waiting move'), must('the "move scheduled" email stamped', 'waiting.intent.ends_on_email_sent_at', present())] },
      { do: 'snapshot', as: 'waiting' },
      { do: 'touchMetadata', times: 5 },
    ],
    expect: [
      must('one waiting row', 'end.intents.pending', count(1)),
      must('NO cancellation row', 'end.intents.cancel', count(0)),
      must('still a move', 'end.intent.intent_type', is('downgrade')),
      must('the date did not move', 'end.intent.effective_at', sameAs('waiting.intent.effective_at')),
      must('the "move scheduled" email, once', 'end.emails.plan_downgrade_scheduled', count(1)),
      must('no "ends on" email', 'end.emails.plan_ends_on', count(0)),
      allRan,
    ],
  },
];

/** A step as the run log and `--list` print it. */
export function stepLabel(s) {
  return [s.do, s.as, s.plan, s.on !== undefined && (s.on ? 'on' : 'off'), s.keep && `keep ${s.keep.join(', ')}`, s.name,
    s.times && `×${s.times}`, s.to && `→ ${s.to}`, s.days && `+${s.days}d`, s.hours && `+${s.hours}h`].filter(Boolean).join(' ');
}

/**
 * Roots an expectation reads that the case never fills: a snapshot it takes (`start`, `end`, every `snapshot` step, the one
 * each `wait` polls) or the run's own `setup` and `notes`. Empty for a well-formed case.
 */
export function unknownRoots(caseDef) {
  const names = new Set(['start', 'end']);
  for (const step of caseDef.steps) {
    if (step.do === 'snapshot') names.add(step.as);
    if (step.do === 'wait') for (const e of step.until) names.add(e.path.split('.')[0]);
  }
  const roots = e => [e.path, e.matcher.path].filter(Boolean).map(p => p.split('.')[0]);
  const all = [...caseDef.expect, ...caseDef.steps.flatMap(s => s.until ?? [])].flatMap(roots);
  return [...new Set(all.filter(r => !names.has(r) && r !== 'setup' && r !== 'notes'))];
}

// ── The report ──────────────────────────────────────────────────────────────────────────────────────────────────────

const MARK = { PASS: '✅ PASS', FAIL: '❌ FAIL', SURPRISE: '⚠️ SURPRISE' };

/** The evidence report (`report.md`): one section per case. `run` = { startedAt, site, portal, cases: [result], cleanup }. */
export function renderReport(run) {
  const lines = [];
  const tally = Object.fromEntries(Object.keys(MARK).map(k => [k, run.cases.filter(c => c.verdict === k).length]));
  lines.push('# Plans end at the renewal date · Stage 3 rehearsal');
  lines.push('');
  lines.push(`Run ${run.startedAt} against ${run.site} (Stripe test mode, dev database).`);
  lines.push('');
  lines.push(`**${run.cases.length} cases:** ${Object.entries(tally).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(' · ')}`);
  lines.push('');
  if (run.portal) {
    lines.push(`## 0 · Portal settings (G13 a) — ${run.portal.ok ? MARK.PASS : MARK.FAIL}`);
    lines.push('');
    for (const c of run.portal.checks) lines.push(`- ${c.status} · ${c.key}: ${c.detail}`);
    lines.push('');
  }
  lines.push('**Not proven here:** Stripe\'s hosted portal page itself (case 6 sets its effect through the API), a real bank\'s decline (case 5 uses Stripe\'s test card that declines after attaching), anything the daily job decides on the real calendar (the seven-day reminder, the overdue count, Finish this ending now), and a Coaches Portal\'s ending (every case is a club).');
  lines.push('');
  for (const c of run.cases) {
    lines.push(`## ${c.id} · ${c.title} — ${MARK[c.verdict] ?? c.verdict}${c.cutNote ? ` · ✂️ ${c.cutNote}` : ''}`);
    lines.push('');
    if (c.club) lines.push(`Club: ${c.club.name} (${c.club.slug}) · owner ${c.club.email} · clock ${c.club.clockId}`);
    if (c.steps?.length) {
      lines.push('');
      lines.push('**Done:**');
      for (const s of c.steps) lines.push(`- ${s.label}${s.result ? ` → ${s.result}` : ''}`);
    }
    if (c.stripeEvents?.length) {
      lines.push('');
      lines.push(`**What Stripe sent, in order:** ${c.stripeEvents.join(' → ')}`);
    }
    if (c.reasons?.length) {
      lines.push('');
      lines.push('**Why not a clean pass:**');
      for (const r of c.reasons) lines.push(`- ${r}`);
    }
    if (c.checks?.length) {
      lines.push('');
      lines.push('| | Expected | Observed |');
      lines.push('|---|---|---|');
      for (const k of c.checks) lines.push(`| ${k.ok ? '✓' : k.level === 'must' ? '✗' : '⚠'} | ${k.label} | ${String(k.detail).replace(/\|/g, '\\|')} |`);
    }
    if (c.classification) {
      lines.push('');
      lines.push(`**Classification:** ${c.classification}`);
    }
    lines.push('');
  }
  if (run.cleanup) {
    lines.push('## Clean-up');
    lines.push('');
    for (const l of run.cleanup) lines.push(`- ${l}`);
    lines.push('');
  }
  return lines.join('\n');
}
