import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeFamilyDues,
  familyPlural,
  type FamilyDuesPlayer,
} from '../../lib/coach-family-dues.ts';

const TODAY = '2026-08-02';

function player(
  playerId: string,
  playerName: string,
  opts: Partial<FamilyDuesPlayer> & { installments?: FamilyDuesPlayer['installments'] } = {},
): FamilyDuesPlayer {
  const installments = opts.installments ?? [];
  const outstanding = opts.outstanding ?? installments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
  return {
    playerId,
    playerName,
    guardianKey: opts.guardianKey ?? null,
    guardianLastName: opts.guardianLastName ?? null,
    outstanding,
    installments,
  };
}

const inst = (dueDate: string, amount: number, paidAt: string | null = null) => ({ dueDate, amount, paidAt });

function run(players: FamilyDuesPlayer[], todayISO = TODAY) {
  return computeFamilyDues({ players, todayISO });
}

describe('familyPlural', () => {
  it('follows the standard surname rule', () => {
    assert.equal(familyPlural('March'), 'Marches');
    assert.equal(familyPlural('Okari'), 'Okaris');
    assert.equal(familyPlural('Nguyen'), 'Nguyens');
    assert.equal(familyPlural('Ramos'), 'Ramoses');
    assert.equal(familyPlural('Fox'), 'Foxes');
    assert.equal(familyPlural('Walsh'), 'Walshes');
  });
  it('does NOT apply the y→ies rule to surnames', () => {
    assert.equal(familyPlural('Kelly'), 'Kellys');
  });
});

describe('computeFamilyDues', () => {
  it('reproduces the approved answer: two families, $240, most owed first', () => {
    const r = run([
      player('p1', 'Maya March', { guardianKey: 'j.march@x.com', guardianLastName: 'March',
        installments: [inst('2026-06-25', 150, '2026-06-24'), inst('2026-07-25', 150), inst('2026-08-25', 0)] }),
      player('p2', 'Dev Okari', { guardianKey: 'a.okari@x.com', guardianLastName: 'Okari',
        installments: [inst('2026-06-01', 90, '2026-06-01'), inst('2026-07-01', 90, '2026-07-01'), inst('2026-08-01', 90)] }),
      player('p3', 'Priya Shah', { guardianKey: 'p.shah@x.com', guardianLastName: 'Shah',
        installments: [inst('2026-07-01', 200, '2026-07-01')] }),
    ]);
    assert.equal(r.owing.length, 2);
    assert.equal(r.totalOutstanding, 240);
    assert.deepEqual(r.owing.map(g => g.label), ['the Marches', 'the Okaris']);
    assert.equal(r.paidUpCount, 1);
    assert.equal(r.familyCount, 3);
  });

  it('positions each installment inside its OWN player schedule', () => {
    const r = run([
      player('p1', 'Maya March', { guardianKey: 'j@x.com', guardianLastName: 'March',
        installments: [inst('2026-06-25', 150, '2026-06-24'), inst('2026-07-25', 150), inst('2026-08-25', 150)] }),
    ]);
    const u = r.owing[0].unpaid[0];
    assert.equal(u.index, 2);
    assert.equal(u.total, 3);
    assert.equal(u.amount, 150);
  });

  // ── Siblings: the whole reason this module exists ──────────────────────────
  it('rolls two siblings into ONE family with a combined balance', () => {
    const r = run([
      player('p1', 'Maya March', { guardianKey: 'j.march@x.com', guardianLastName: 'March', installments: [inst('2026-07-25', 150)] }),
      player('p2', 'Sam March', { guardianKey: 'j.march@x.com', guardianLastName: 'March', installments: [inst('2026-07-25', 150)] }),
    ]);
    assert.equal(r.owing.length, 1);
    assert.equal(r.owing[0].outstanding, 300);
    assert.equal(r.owing[0].label, 'the Marches');
    assert.deepEqual(r.owing[0].playerNames, ['Maya March', 'Sam March']);
    assert.equal(r.owing[0].unpaid.length, 2);
  });

  it('never merges two families that merely share a surname', () => {
    const r = run([
      player('p1', 'An Nguyen', { guardianKey: 'a.nguyen@x.com', guardianLastName: 'Nguyen', installments: [inst('2026-07-25', 100)] }),
      player('p2', 'Bo Nguyen', { guardianKey: 'b.nguyen@y.com', guardianLastName: 'Nguyen', installments: [inst('2026-07-25', 100)] }),
    ]);
    assert.equal(r.owing.length, 2);
    assert.equal(r.familyCount, 2);
  });

  it('treats a player with no guardian contact as their own family', () => {
    const r = run([
      player('p1', 'Maya March', { guardianLastName: 'March', installments: [inst('2026-07-25', 150)] }),
      player('p2', 'Sam March', { guardianLastName: 'March', installments: [inst('2026-07-25', 150)] }),
    ]);
    assert.equal(r.owing.length, 2, 'no evidence links them — never guess from a surname');
  });

  // ── The owner ruling: money access without guardian PII ────────────────────
  it('falls back to player names when guardian surnames are withheld, still grouping siblings', () => {
    const r = run([
      player('p1', '#7 Maya R.', { guardianKey: 'j.march@x.com', installments: [inst('2026-07-25', 150)] }),
      player('p2', '#9 Sam R.', { guardianKey: 'j.march@x.com', installments: [inst('2026-07-25', 150)] }),
    ]);
    assert.equal(r.owing.length, 1, 'grouping survives redaction — it uses the guardian key, not the name');
    assert.equal(r.owing[0].outstanding, 300);
    assert.equal(r.owing[0].label, "Maya and Sam's family");
    assert.equal(r.owing[0].labelledByPlayer, true);
  });

  it('uses a single first name for a one-child family', () => {
    const r = run([player('p1', 'Maya R.', { guardianKey: 'j@x.com', installments: [inst('2026-07-25', 150)] })]);
    assert.equal(r.owing[0].label, "Maya's family");
  });

  it('falls back to player names when a household has two different surnames', () => {
    const r = run([
      player('p1', 'Maya March', { guardianKey: 'shared@x.com', guardianLastName: 'March', installments: [inst('2026-07-25', 150)] }),
      player('p2', 'Dev Okari', { guardianKey: 'shared@x.com', guardianLastName: 'Okari', installments: [inst('2026-07-25', 90)] }),
    ]);
    assert.equal(r.owing.length, 1);
    assert.equal(r.owing[0].label, "Maya and Dev's family");
    assert.equal(r.owing[0].labelledByPlayer, true);
  });

  it('does not report labelledByPlayer when the family has a surname', () => {
    const r = run([player('p1', 'Maya March', { guardianKey: 'j@x.com', guardianLastName: 'March', installments: [inst('2026-07-25', 150)] })]);
    assert.equal(r.owing[0].labelledByPlayer, false);
  });

  // ── Overdue is a calendar question ─────────────────────────────────────────
  it('does not call an installment due TODAY overdue', () => {
    const r = run([player('p1', 'Maya', { guardianKey: 'j@x.com', installments: [inst(TODAY, 150)] })]);
    assert.equal(r.owing[0].unpaid[0].overdue, false);
  });
  it('calls yesterday overdue', () => {
    const r = run([player('p1', 'Maya', { guardianKey: 'j@x.com', installments: [inst('2026-08-01', 150)] })]);
    assert.equal(r.owing[0].unpaid[0].overdue, true);
  });

  // ── Honest denominators ────────────────────────────────────────────────────
  it('excludes players who were never billed from the family count', () => {
    const r = run([
      player('p1', 'Maya', { guardianKey: 'j@x.com', installments: [inst('2026-07-25', 150)] }),
      player('p2', 'Unbilled', { guardianKey: 'u@x.com' }),
    ]);
    assert.equal(r.familyCount, 1);
    assert.equal(r.paidUpCount, 0);
  });

  it('counts a fully-paid family as paid up, not owing', () => {
    const r = run([player('p1', 'Maya', { guardianKey: 'j@x.com', installments: [inst('2026-07-25', 150, '2026-07-20')] })]);
    assert.deepEqual(r.owing, []);
    assert.equal(r.paidUpCount, 1);
    assert.equal(r.totalOutstanding, 0);
  });

  it('handles an empty roster without throwing', () => {
    const r = run([]);
    assert.deepEqual(r.owing, []);
    assert.equal(r.familyCount, 0);
    assert.equal(r.totalOutstanding, 0);
  });

  it('orders unpaid installments earliest due first across the whole family', () => {
    const r = run([
      player('p1', 'Maya', { guardianKey: 'j@x.com', installments: [inst('2026-09-01', 50)] }),
      player('p2', 'Sam', { guardianKey: 'j@x.com', installments: [inst('2026-07-01', 50)] }),
    ]);
    assert.deepEqual(r.owing[0].unpaid.map(u => u.dueDate), ['2026-07-01', '2026-09-01']);
  });

  it('rounds combined balances to cents rather than leaking float drift', () => {
    const r = run([
      player('p1', 'Maya', { guardianKey: 'j@x.com', outstanding: 0.1, installments: [inst('2026-07-01', 0.1)] }),
      player('p2', 'Sam', { guardianKey: 'j@x.com', outstanding: 0.2, installments: [inst('2026-07-01', 0.2)] }),
    ]);
    assert.equal(r.owing[0].outstanding, 0.3);
    assert.equal(r.totalOutstanding, 0.3);
  });
});
