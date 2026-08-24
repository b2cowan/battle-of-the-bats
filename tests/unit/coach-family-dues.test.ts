import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeFamilyDues,
  familyLabel,
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

/* The naming rule has TWO callers now — the "who owes" answer and the season settlement sheet's
   family list — so it is tested directly rather than only through the rollup that used to own it. */
describe('familyLabel', () => {
  it('one recorded surname names the family', () => {
    const l = familyLabel(['March'], ['Maya March', 'Sam March']);
    assert.equal(l.label, 'the Marches');
    assert.equal(l.receiptLabel, 'March family');
    assert.equal(l.labelledByPlayer, false);
  });

  it('TWO surnames under one household fall back to the players — naming a family something nobody in it is called is worse than using first names', () => {
    const l = familyLabel(['March', 'Okari'], ['Maya March', 'Dev Okari']);
    assert.equal(l.label, "Maya and Dev's family");
    assert.equal(l.receiptLabel, 'Maya and Dev');
    assert.equal(l.labelledByPlayer, true);
  });

  it('NO surname — a caller with no guardian-PII grant passes none — reads as the players', () => {
    const l = familyLabel([], ['#7 Maya March']);
    assert.equal(l.receiptLabel, 'Maya', 'the jersey number is not part of a name');
    assert.equal(l.labelledByPlayer, true);
  });

  it('blank and duplicate surnames do not defeat the single-surname rule', () => {
    assert.equal(familyLabel(['March', ' March ', ''], ['Maya March']).receiptLabel, 'March family');
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

describe('paidUp groups (the family statement prints receipts too)', () => {
  const run = (players: FamilyDuesPlayer[]) => computeFamilyDues({ players, todayISO: TODAY });

  it('a settled family appears as a full group, named, in paidUp', () => {
    const r = run([
      player('p1', 'Maya Chen', { guardianKey: 'j@x.com', guardianLastName: 'Chen', installments: [inst('2026-07-25', 150, '2026-07-20')] }),
      player('p2', 'Liam Ng', { guardianKey: 'k@x.com', guardianLastName: 'Ng', installments: [inst('2026-09-01', 100)] }),
    ]);
    assert.equal(r.paidUp.length, 1);
    assert.equal(r.paidUp[0].label, 'the Chens');
    assert.equal(r.paidUp[0].unpaid.length, 0);
    assert.equal(r.paidUpCount, 1, 'the count and the list agree by construction');
    assert.equal(r.owing.length, 1, 'an owing family never appears in paidUp');
  });

  it('paidUp is alphabetical — the hand-out order', () => {
    const r = run([
      player('p1', 'Ava Zhou', { guardianKey: 'z@x.com', guardianLastName: 'Zhou', installments: [inst('2026-07-01', 50, '2026-06-30')] }),
      player('p2', 'Ben Adler', { guardianKey: 'a@x.com', guardianLastName: 'Adler', installments: [inst('2026-07-01', 50, '2026-06-30')] }),
    ]);
    assert.deepEqual(r.paidUp.map(g => g.label), ['the Adlers', 'the Zhous']);
  });

  it('a never-billed player is in neither list', () => {
    const r = run([player('p1', 'Maya', { guardianKey: 'j@x.com' })]);
    assert.equal(r.paidUp.length, 0);
    assert.equal(r.owing.length, 0);
    assert.equal(r.familyCount, 0);
  });
});
