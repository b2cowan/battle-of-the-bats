import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { billingTestLoader } from './_billing-test-loader.ts';
import {
  ACCEPTANCE_BOX_PARTS,
  ACCEPTANCE_BOX_TEXT,
  ACCEPTANCE_DOORS,
  TERMS_ACCEPTED_KEY,
  acceptanceRow,
  hadEarlierPublishedAcceptance,
  isAccepted,
  mirroredTermsVersion,
} from '../../lib/legal-acceptance-rules.ts';
import { recordLegalAcceptance, writeFixtureAcceptance } from '../../scripts/lib/record-legal-acceptance.mjs';

/**
 * ACCEPTANCE OF THE TERMS — the engine (GST/HST Stage 6 step 6.3, Chunk A; rulings R1–R10 of 2026-11-09). Behaviour, run for
 * real over a fake database: the rule, the record, the check every shell and gated route asks, and who is exempt. Production is
 * off until 6.7, so "dark means invisible" is proved first.
 */

const root = resolve(import.meta.dirname, '../..');
const OFF = {};
const PREVIEW = { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' };
type Row = Record<string, unknown>;

// ---------------------------------------------------------------- the rule

describe('isAccepted: the truth table', () => {
  it('the pages off is NOT APPLICABLE — the caller does nothing', () => {
    assert.equal(isAccepted('draft', null), null);
    assert.equal(isAccepted('2027-01-01', null), null);
    assert.equal(isAccepted(null, null), null);
  });
  it('draft satisfies draft (the dev preview)', () => assert.equal(isAccepted('draft', 'draft'), true));
  it('a draft NEVER satisfies a date — nothing accepted on a preview counts on production', () => {
    assert.equal(isAccepted('draft', '2027-01-01'), false);
  });
  it('a date never satisfies draft', () => assert.equal(isAccepted('2027-01-01', 'draft'), false));
  it('a date satisfies an older or equal oldest-accepted date, never a newer one', () => {
    assert.equal(isAccepted('2027-03-01', '2027-01-01'), true);
    assert.equal(isAccepted('2027-01-01', '2027-01-01'), true);
    assert.equal(isAccepted('2026-12-31', '2027-01-01'), false);
  });
  it('nothing recorded, or a malformed version, is not accepted', () => {
    assert.equal(isAccepted(null, 'draft'), false);
    assert.equal(isAccepted('', '2027-01-01'), false);
    assert.equal(isAccepted('v2', '2027-01-01'), false);
  });
  it('"updated" needs an earlier PUBLISHED acceptance — a draft row reads "published"', () => {
    assert.equal(hadEarlierPublishedAcceptance(null), false);
    assert.equal(hadEarlierPublishedAcceptance('draft'), false);
    assert.equal(hadEarlierPublishedAcceptance('2027-01-01'), true);
  });
  it('the mirror reads only a non-empty string at its key', () => {
    assert.equal(mirroredTermsVersion({ [TERMS_ACCEPTED_KEY]: 'draft' }), 'draft');
    assert.equal(mirroredTermsVersion({ [TERMS_ACCEPTED_KEY]: '' }), null);
    assert.equal(mirroredTermsVersion({ [TERMS_ACCEPTED_KEY]: 7 }), null);
    assert.equal(mirroredTermsVersion(null), null);
  });
});

// ---------------------------------------------------------------- the words and the schema agree

describe('the box sentence and the door list have one home each', () => {
  it('the box text is Terms §20 (1) with the link markup stripped (read from the draft until 6.7, so a /legal edit fails loudly)', () => {
    const draft = readFileSync(resolve(root, 'docs/agents/legal/drafts/TERMS_OF_SERVICE.md'), 'utf8');
    const item1 = draft.slice(draft.indexOf('**(1) Account creation'), draft.indexOf('**(2) The sign-in screen'));
    const line = item1.split(/\r?\n/).find(l => l.startsWith('> ☐ '));
    assert.ok(line, 'the draft §20 (1) box line was found');
    const fromDraft = line!.slice('> ☐ '.length).replace(/\[([^\]]+)\]/g, '$1').trim();
    // The draft writes a straight apostrophe; the product sets the typographic one.
    assert.equal(ACCEPTANCE_BOX_TEXT.replace(/’/g, "'"), fromDraft);
  });
  it('the stored sentence is the rendered parts joined, both link labels included', () => {
    const p = ACCEPTANCE_BOX_PARTS;
    assert.equal(ACCEPTANCE_BOX_TEXT, p.lead + p.terms + p.middle + p.privacy + p.end);
    assert.equal(p.terms, 'Terms of Service');
    assert.equal(p.privacy, 'Privacy Policy');
  });
  it('the door list is exactly the migration CHECK', () => {
    const sql = readFileSync(resolve(root, 'supabase/migrations/455_every_tick_is_kept.sql'), 'utf8');
    const check = sql.match(/legal_acceptances_door_check CHECK \(door IN \(([\s\S]*?)\)\)/);
    assert.ok(check, 'the door CHECK was found in migration 455');
    const fromSql = [...check![1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual(fromSql, [...ACCEPTANCE_DOORS]);
  });
});

// ---------------------------------------------------------------- the record and the check, over a fake database

function harness({ rows = [] as Row[], staff = [] as string[], failInsert = false } = {}) {
  const table: Row[] = rows.map(r => ({ ...r }));
  const reads: string[] = [];
  const mirrorWrites: Array<{ id: string; app_metadata: Row }> = [];
  const supabaseAdmin = {
    from: (name: string) => {
      assert.equal(name, 'legal_acceptances');
      let userId: unknown;
      const q = {
        select: () => q,
        eq: (_c: string, v: unknown) => { userId = v; return q; },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          reads.push(String(userId));
          const mine = table.filter(r => r.user_id === userId).sort((a, b) => String(b.accepted_at).localeCompare(String(a.accepted_at)));
          return { data: mine[0] ?? null, error: null };
        },
        insert: async (row: Row) => {
          if (failInsert) return { error: { message: 'down' } };
          table.push({ ...row, accepted_at: new Date().toISOString() });
          return { error: null };
        },
      };
      return q;
    },
    auth: { admin: { updateUserById: async (id: string, attrs: { app_metadata: Row }) => { mirrorWrites.push({ id, app_metadata: attrs.app_metadata }); return { error: null }; } } },
  };
  const staffChecks: string[] = [];
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin },
    './platform-auth': { isPlatformAdminEmail: async (email: string) => { staffChecks.push(email); return staff.includes(email); } },
  });
  const mod = load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
  const exempt = load('lib/legal-acceptance-exempt.ts') as typeof import('../../lib/legal-acceptance-exempt.ts');
  return { mod, exempt, db: supabaseAdmin, table, reads, mirrorWrites, staffChecks };
}

const person = (over: Row = {}) => ({ id: 'u1', email: 'pat@example.test', app_metadata: {}, ...over });

describe('dark means invisible: with the pages off nothing is read, recorded or refused', () => {
  it('the state is off, without a query', async () => {
    const h = harness();
    assert.deepEqual(await h.mod.checkAcceptance(person(), OFF), { state: 'off', hadEarlier: false });
    assert.deepEqual(h.reads, []);
    assert.deepEqual(h.staffChecks, []);
  });
  it('recordAcceptance records nothing, whatever it is sent', async () => {
    const h = harness();
    assert.deepEqual(await h.mod.recordAcceptance({ user: person(), door: 'signup', shownTermsVersion: undefined }, OFF), { ok: true, recorded: false });
    assert.equal(h.table.length, 0);
    assert.deepEqual(h.mirrorWrites, []);
  });
  it('requireAcceptance passes', async () => {
    const h = harness();
    assert.deepEqual(await h.mod.requireAcceptance(person(), OFF), { ok: true });
  });
  it('a fixture records nothing (production records nothing while off)', async () => {
    const h = harness();
    await h.mod.recordFixtureAcceptance(person(), OFF);
    await writeFixtureAcceptance(h.db, person(), OFF);
    assert.equal(h.table.length, 0);
    assert.equal(acceptanceRow(person(), 'fixture', OFF), null);
  });
});

describe('recordAcceptance in the dev preview', () => {
  it('refuses terms_changed when the page showed another version, and writes nothing', async () => {
    const h = harness();
    for (const shown of ['2027-01-01', undefined, null]) {
      assert.deepEqual(await h.mod.recordAcceptance({ user: person(), door: 'signup', shownTermsVersion: shown }, PREVIEW), { ok: false, code: 'terms_changed' });
    }
    assert.equal(h.table.length, 0);
    assert.deepEqual(h.mirrorWrites, []);
  });
  it('writes the row — both versions, the exact sentence, the door, the email as text — THEN the mirror', async () => {
    const h = harness();
    assert.deepEqual(await h.mod.recordAcceptance({ user: person(), door: 'sign_in_screen', shownTermsVersion: 'draft' }, PREVIEW), { ok: true, recorded: true });
    assert.equal(h.table.length, 1);
    const row = { ...h.table[0] };
    delete row.accepted_at;
    assert.deepEqual(row, {
      user_id: 'u1', user_email: 'pat@example.test', terms_version: 'draft', privacy_version: 'draft',
      box_text: ACCEPTANCE_BOX_TEXT, door: 'sign_in_screen',
    });
    assert.deepEqual(h.mirrorWrites, [{ id: 'u1', app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }]);
  });
  it('no IP address and no device are kept (R1)', async () => {
    const h = harness();
    await h.mod.recordAcceptance({ user: person(), door: 'signup', shownTermsVersion: 'draft' }, PREVIEW);
    assert.deepEqual(Object.keys(h.table[0]).sort(), ['accepted_at', 'box_text', 'door', 'privacy_version', 'terms_version', 'user_email', 'user_id']);
  });
  it('a failed insert writes no mirror — the mirror never claims what the table lacks', async () => {
    const h = harness({ failInsert: true });
    assert.deepEqual(await h.mod.recordAcceptance({ user: person(), door: 'signup', shownTermsVersion: 'draft' }, PREVIEW), { ok: false, code: 'save_failed' });
    assert.deepEqual(h.mirrorWrites, []);
  });
});

describe('checkAcceptance: the table is the truth, the mirror a cache', () => {
  it('a mirror that says accepted costs no query at all', async () => {
    const h = harness();
    assert.equal(await h.mod.acceptanceState(person({ app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }), PREVIEW), 'accepted');
    assert.deepEqual(h.reads, []);
    assert.deepEqual(h.staffChecks, []);
  });
  it('no mirror, a row in the table: accepted, and the mirror is repaired', async () => {
    const h = harness({ rows: [{ user_id: 'u1', terms_version: 'draft', accepted_at: '2026-11-09T10:00:00Z' }] });
    assert.equal(await h.mod.acceptanceState(person(), PREVIEW), 'accepted');
    assert.deepEqual(h.mirrorWrites, [{ id: 'u1', app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }]);
  });
  it('nothing recorded: needed, as "published" (no earlier version)', async () => {
    const h = harness();
    assert.deepEqual(await h.mod.checkAcceptance(person(), PREVIEW), { state: 'needed', hadEarlier: false });
    assert.deepEqual(h.mirrorWrites, []);
  });
  it('a mirror that holds something the table does not satisfy is confirmed against the table', async () => {
    const h = harness();
    assert.equal(await h.mod.acceptanceState(person({ app_metadata: { [TERMS_ACCEPTED_KEY]: '2027-01-01' } }), PREVIEW), 'needed');
    assert.deepEqual(h.reads, ['u1']);
  });
  it('requireAcceptance refuses a needed person with a 409 terms_required carrying the version to show', async () => {
    const h = harness();
    const r = await h.mod.requireAcceptance(person(), PREVIEW);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.response.status, 409);
    assert.deepEqual(await r.response.json(), {
      error: 'Before you continue, you need to agree to our current Terms of Service. Reload this page to see them.',
      code: 'terms_required', termsVersion: 'draft', hadEarlier: false,
    });
  });
  it('a fixture account records once: a second run adds no row', async () => {
    const h = harness();
    await h.mod.recordFixtureAcceptance(person(), PREVIEW);
    await h.mod.recordFixtureAcceptance(person({ app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }), PREVIEW);
    assert.equal(h.table.length, 1);
    assert.equal(h.table[0].door, 'fixture');
  });
  it('the script/UAT writer inserts the same row the app does, once, and only its throwing form throws', async () => {
    const h = harness();
    await writeFixtureAcceptance(h.db, person(), PREVIEW);
    await writeFixtureAcceptance(h.db, person({ app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }), PREVIEW);
    assert.equal(h.table.length, 1);
    const row = { ...h.table[0] };
    delete row.accepted_at;
    assert.deepEqual(row, acceptanceRow(person(), 'fixture', PREVIEW));
    assert.deepEqual(h.mirrorWrites, [{ id: 'u1', app_metadata: { [TERMS_ACCEPTED_KEY]: 'draft' } }]);
    const down = harness({ failInsert: true });
    await assert.rejects(writeFixtureAcceptance(down.db, person(), PREVIEW), /acceptance row was not written/);
    await recordLegalAcceptance(down.db, person(), PREVIEW); // the scripts' form warns and carries on
    assert.deepEqual(down.mirrorWrites, []);
  });
});

describe('who is exempt: exactly staff and the demo accounts (R4)', () => {
  it('the kinds are pinned', () => {
    const h = harness();
    assert.deepEqual([...h.exempt.ACCEPTANCE_EXEMPT_KINDS], ['staff', 'demo'],
      'R4: exactly two kinds are exempt — FieldLogicHQ staff and the demo accounts. Fixture and seed accounts record acceptance; a third kind is an owner decision.');
  });
  it('the demo accounts read exempt, never see the screen, and cost no staff query', async () => {
    const h = harness();
    for (const email of ['demo-organizer@example.com', 'demo-coach@example.com']) {
      assert.equal(await h.mod.acceptanceState(person({ email }), PREVIEW), 'exempt');
    }
    assert.deepEqual(h.staffChecks, []);
    assert.deepEqual(h.reads, []);
  });
  it('staff read exempt; a customer is not', async () => {
    const h = harness({ staff: ['ops@fieldlogichq.test'] });
    assert.equal(await h.mod.acceptanceState(person({ email: 'ops@fieldlogichq.test' }), PREVIEW), 'exempt');
    assert.equal(await h.exempt.acceptanceExemption({ email: 'pat@example.test' }), null);
    assert.equal(await h.exempt.acceptanceExemption({ email: null }), null);
  });
  it('a staff member is let through by requireAcceptance', async () => {
    const h = harness({ staff: ['ops@fieldlogichq.test'] });
    assert.deepEqual(await h.mod.requireAcceptance(person({ email: 'ops@fieldlogichq.test' }), PREVIEW), { ok: true });
  });
});
