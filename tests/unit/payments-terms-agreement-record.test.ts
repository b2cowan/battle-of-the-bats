/**
 * Club Tier Stage 12 — the payments terms agreement record (mig 497) and the required refund policy (owner 2026-11-17).
 *
 *   · Every tick is kept, append-only, and outlives the organization and the account (payments terms §15: "We record who
 *     agreed, when, and to which version, and keep that record for at least six years after your account closes").
 *   · The record is written BEFORE the payouts row's standing changes, in each of the three actions that tick.
 *   · The refund policy is required: asked in the Before window, never cleared, and its absence pauses payments.
 *
 * The lock itself (UPDATE / DELETE / TRUNCATE refused; a club deletion leaves the row) is proved on dev by
 * scripts/payments-terms-agreements-lock-check.sql.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { paymentsTermsAgreementRow } from '../../lib/payments-terms-agreement.ts';
import { PAYMENTS_TERMS_VERSION, PAYOUTS_WORDS } from '../../lib/online-payment-words.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(REPO, p), 'utf8');
const MIGRATION = read('supabase/migrations/497_every_payments_terms_tick_is_kept.sql');
const ROUTE = read('app/api/admin/payouts/route.ts');
const CARD = read('components/admin/kit/club/PayoutsCard.tsx');

describe('the record outlives the organization and the account, and is never edited (mig 497)', () => {
  it('no foreign key at all — not to organizations, not to users (the mig-451 retention pattern)', () => {
    assert.doesNotMatch(MIGRATION.replace(/--.*$/gm, ''), /REFERENCES/i);
    const constraints = JSON.parse(read('docs/agents/db/schema-snapshots/schema-dump-constraints-dev.json')) as
      Array<{ table_name: string; constraint_type: string; constraint_name: string }>;
    const mine = constraints.filter(c => c.table_name === 'payments_terms_agreements');
    assert.ok(mine.some(c => c.constraint_type === 'PRIMARY KEY'), 'apply migration 497 to dev and refresh the snapshots');
    assert.deepEqual(mine.filter(c => c.constraint_type === 'FOREIGN KEY').map(c => c.constraint_name), [],
      'a key to organizations or users would cascade or empty the record when the club or person is deleted');
  });

  it('append-only: a row trigger refuses UPDATE and DELETE, a statement trigger refuses TRUNCATE, with no exception', () => {
    assert.match(MIGRATION, /CREATE TRIGGER payments_terms_agreements_append_only\s+BEFORE UPDATE OR DELETE ON public\.payments_terms_agreements\s+FOR EACH ROW/);
    assert.match(MIGRATION, /CREATE TRIGGER payments_terms_agreements_no_truncate\s+BEFORE TRUNCATE ON public\.payments_terms_agreements\s+FOR EACH STATEMENT/);
    const fn = /CREATE OR REPLACE FUNCTION public\.payments_terms_agreements_refuse_change\(\)[\s\S]*?\$\$;/.exec(MIGRATION)?.[0] ?? '';
    assert.doesNotMatch(fn, /RETURN NEW/, 'no UPDATE is let through');
  });

  it('the actions the code writes are the CHECK’s, and changing who pays is not one of them', () => {
    const check = /action IN \(([^)]*)\)/.exec(MIGRATION)?.[1] ?? '';
    const listed = [...check.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
    assert.deepEqual(listed, ['agree_again', 'backfill', 'reconnect', 'set_up']);
    const written = [...ROUTE.matchAll(/recordPaymentsTermsAgreement\(\{[^}]*action: '([a-z_]+)'/g)].map(m => m[1]).sort();
    assert.deepEqual(written, ['agree_again', 'reconnect', 'set_up']);
  });
});

describe('the row: who, which club, which version, the exact sentence shown — no IP, no device', () => {
  const row = paymentsTermsAgreementRow({
    org: { id: 'org-1', name: 'UAT Rep Club' }, user: { id: 'u-1', email: 'owner@club.test' }, action: 'set_up', at: '2026-11-17T12:00:00Z',
  });
  it('carries exactly the promised fields', () => {
    assert.deepEqual(Object.keys(row).sort(), ['action', 'agreed_at', 'box_text', 'org_id', 'org_name', 'terms_version', 'user_email', 'user_id']);
  });
  it('the sentence is the one the window shows, from the club’s name; the version is the one the route checked', () => {
    assert.equal(row.box_text, 'I agree to the FieldLogicHQ payments terms for UAT Rep Club.');
    assert.equal(row.box_text, PAYOUTS_WORDS.before.termsCheckbox('UAT Rep Club'));
    assert.equal(row.terms_version, PAYMENTS_TERMS_VERSION);
    assert.match(CARD, /\{W\.before\.termsCheckbox\(clubName\)\}/, 'the window renders the same words function');
  });
  it('an account with no email is still recorded (the CHECK needs text)', () => {
    assert.equal(paymentsTermsAgreementRow({ org: { id: 'o', name: 'C' }, user: { id: 'u' }, action: 'agree_again', at: 'now' }).user_email, 'unknown');
  });
});

describe('the record is written before the standing changes, in every action that ticks', () => {
  const connect = /case 'connect': \{[\s\S]*?\n    case 'agree_terms'/.exec(ROUTE)?.[0] ?? '';
  const agree = /case 'agree_terms': \{[\s\S]*?\n    \}/.exec(ROUTE)?.[0] ?? '';
  it('setting up: after every check, before Stripe creates the account and before the row is written', () => {
    const rec = connect.indexOf("action: 'set_up'");
    assert.ok(rec > connect.indexOf('requireFreshCode()'), 'after the checks');
    assert.ok(rec < connect.indexOf('createClubAccount('), 'before Stripe');
    assert.ok(rec < connect.indexOf(".upsert("), 'before the standing');
    // Stripe-owned pricing (owner 2026-11-18): replacing an old-setting account is a set-up too, recorded before its update.
    assert.ok(rec < connect.indexOf('stripe_account_id: acct.id, fees_collector: CLUB_ACCOUNT_FEES_COLLECTOR, livemode'), 'before the replacement');
  });
  it('reconnecting: after Stripe’s closed-account check, before the row is updated, and the update’s error is checked', () => {
    const rec = connect.indexOf("action: 'reconnect'");
    assert.ok(rec > connect.indexOf('.closed)'), 'a reconnect Stripe refuses records nothing');
    // The LAST clearing of the disconnect is the reconnect's (the one before it replaces an old-setting account, below).
    assert.ok(rec < connect.lastIndexOf('disconnected_at: null'), 'before the standing');
    assert.match(connect, /if \(reconnectError\) throw reconnectError;/);
  });
  it('agreeing again: after the tick and the version, before the row', () => {
    const rec = agree.indexOf("action: 'agree_again'");
    assert.ok(rec > agree.indexOf('termsChanged()') && rec < agree.indexOf(".update("));
  });
});

describe('THE REFUND POLICY IS REQUIRED (owner 2026-11-17)', () => {
  it('setting up refuses a connect without one, before the address and Stripe; both writes store it', () => {
    const connect = /case 'connect': \{[\s\S]*?\n    case 'agree_terms'/.exec(ROUTE)?.[0] ?? '';
    const refuse = connect.indexOf("PAYOUTS_WORDS.before.policyRequired, code: 'refund_policy_required'");
    assert.ok(refuse > 0 && refuse < connect.indexOf('requireBillingLocation('));
    assert.equal(connect.split('refund_policy: policy.text').length - 1, 3, 'the new row, the replaced account (Stripe-owned pricing) and the reconnect all store the policy');
  });
  it('the Payouts card’s autosave can change it, never clear it — and saving it settles the paused item at once', () => {
    const patch = /export const PATCH = [\s\S]*?\n\}, \{ route/.exec(ROUTE)?.[0] ?? '';
    assert.match(patch, /PAYOUTS_WORDS\.record\.policyRequired, code: 'refund_policy_required' \}, \{ status: 400 \}/);
    assert.doesNotMatch(patch, /refund_policy = text \|\| null/);
    assert.match(patch, /if \('refund_policy' in update\) await clearSettled\(\{ orgIds: \[ctx\.org\.id\], kinds: \['payouts_need_attention'\] \}\);/);
  });
  it('the card: a blank is put back, never sent; paused for the policy, the button opens the record', () => {
    assert.match(CARD, /if \(!policy\.trim\(\)\) \{ setPolicy\(view\.refundPolicy\); setDirty\(false\); setBlankRefused\(true\); return; \}/);
    assert.match(CARD, /if \(forPolicy\) setEditing\(true\);/);
    assert.match(CARD, /forPolicy \? W\.writePolicy : W\.button\[state\]/);
  });
  it('the words no longer promise a missing link; they say payments are paused', () => {
    assert.equal(PAYOUTS_WORDS.record.policyEmpty, 'None written. Online payments are paused until one is.');
    assert.doesNotMatch(JSON.stringify(PAYOUTS_WORDS), /won’t see a Refund policy link/);
  });
});
