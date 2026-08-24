/**
 * The per-family dues statement assembler (lib/coach-dues-statement.ts).
 *
 * The claims that matter, in privacy-first order:
 *   1. ONE HOUSEHOLD'S CHILDREN AND NOBODY ELSE'S — siblings sharing a familyKey collapse into
 *      one statement, and no other family's name or figure appears anywhere in it.
 *   2. The PII seam holds: with guardian surnames redacted (null), grouping still works via the
 *      opaque key and the household is addressed by the children's names.
 *   3. Every figure is the dues screen's arithmetic: installment asks are the served NET
 *      remainder, never the face value; "received" is cash coverage, not a re-derivation.
 *   4. The tone contract: a family with nothing left gets a receipt ("Thank you"), not a bill.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFamilyDuesStatements, type StatementPlayerInput } from '../../lib/coach-dues-statement';

const TODAY = '2026-08-23';

function player(over: Partial<StatementPlayerInput> & { playerId: string; playerFirstName: string }): StatementPlayerInput {
  return {
    playerLastName: null,
    familyKey: null,
    guardianLastName: null,
    schedule: { totalAmount: 1450 },
    installments: [],
    coverage: [],
    payments: [],
    credits: [],
    payouts: [],
    paidAmount: 0,
    outstanding: 0,
    totalCredits: 0,
    leftToSend: 0,
    creditApplied: 0,
    owedBack: 0,
    ...over,
  };
}

/** The Marchand hard case: two siblings, a partial payment, a credit, one open installment. */
function marchands(guardianLastName: string | null = 'Marchand'): StatementPlayerInput[] {
  return [
    player({
      playerId: 'isla', playerFirstName: 'Isla', playerLastName: 'Marchand',
      familyKey: 'fam-marchand', guardianLastName,
      installments: [
        { id: 'i1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
        { id: 'i2', dueDate: '2026-08-01', amount: 500, paidAt: null, remainingAmount: 300 },
        { id: 'i3', dueDate: '2026-10-01', amount: 450, paidAt: null, remainingAmount: 325, creditApplied: 125 },
      ],
      coverage: [
        { installmentId: 'i1', allocated: 500 },
        { installmentId: 'i2', allocated: 200 },
        { installmentId: 'i3', allocated: 0 },
      ],
      payments: [
        { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
        { amount: 200, receivedDate: '2026-08-10', method: 'cash', note: 'At practice' },
      ],
      credits: [{ amount: 125, creditDate: '2026-07-12', description: 'Bottle drive rebate' }],
      paidAmount: 700, outstanding: 750, totalCredits: 125, leftToSend: 625, creditApplied: 125,
    }),
    player({
      playerId: 'emmett', playerFirstName: 'Emmett', playerLastName: 'Marchand',
      familyKey: 'fam-marchand', guardianLastName,
      installments: [
        { id: 'e1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
        { id: 'e2', dueDate: '2026-08-01', amount: 500, paidAt: '2026-07-30T12:00:00Z', remainingAmount: 0 },
        { id: 'e3', dueDate: '2026-10-01', amount: 450, paidAt: null, remainingAmount: 450 },
      ],
      coverage: [
        { installmentId: 'e1', allocated: 500 },
        { installmentId: 'e2', allocated: 500 },
        { installmentId: 'e3', allocated: 0 },
      ],
      payments: [
        { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
        { amount: 500, receivedDate: '2026-07-30', method: 'etransfer', note: null },
      ],
      paidAmount: 1000, outstanding: 450, totalCredits: 0, leftToSend: 450,
    }),
  ];
}

const chen = () => player({
  playerId: 'maya', playerFirstName: 'Maya', playerLastName: 'Chen',
  familyKey: 'fam-chen', guardianLastName: 'Chen',
  installments: [
    { id: 'm1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
    { id: 'm2', dueDate: '2026-08-01', amount: 500, paidAt: '2026-07-26T12:00:00Z', remainingAmount: 0 },
  ],
  coverage: [{ installmentId: 'm1', allocated: 500 }, { installmentId: 'm2', allocated: 500 }],
  payments: [
    { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
    { amount: 500, receivedDate: '2026-07-26', method: 'etransfer', note: null },
  ],
  schedule: { totalAmount: 1000 },
  paidAmount: 1000, outstanding: 0, totalCredits: 0, leftToSend: 0,
});

const flat = (s: { schedules: { label: string; rows: string[][] }[]; payments: string[][]; credits: string[][]; payouts: string[][]; next: string[] }) =>
  JSON.stringify([s.schedules, s.payments, s.credits, s.payouts, s.next]);

describe('one household, and nobody else', () => {
  it('collapses siblings into ONE statement covering both children', () => {
    const out = buildFamilyDuesStatements({ players: [...marchands(), chen()], todayISO: TODAY });
    assert.equal(out.length, 2);
    const m = out.find(s => s.receiptLabel === 'Marchand family')!;
    assert.ok(m, 'the household is named by its surname');
    assert.equal(m.label, 'the Marchands');
    assert.equal(m.childrenLine, 'Isla and Emmett');
    assert.equal(m.schedules.length, 2, 'one schedule section per child');
  });

  it('no other family’s name or figure appears anywhere in a statement', () => {
    const out = buildFamilyDuesStatements({ players: [...marchands(), chen()], todayISO: TODAY });
    const m = out.find(s => s.receiptLabel === 'Marchand family')!;
    const c = out.find(s => s.receiptLabel === 'Chen family')!;
    assert.ok(!flat(m).includes('Maya'), 'the Marchands never see the Chens');
    assert.ok(!flat(c).includes('Isla') && !flat(c).includes('Emmett'), 'and vice versa');
  });

  it('groups by the opaque key even when guardian surnames are redacted, and addresses by the children', () => {
    const out = buildFamilyDuesStatements({ players: marchands(null), todayISO: TODAY });
    assert.equal(out.length, 1, 'siblings still collapse without PII');
    assert.equal(out[0].label, "Isla and Emmett's family");
    assert.equal(out[0].receiptLabel, 'Isla and Emmett');
  });

  it('a player with no dues arrangement gets no statement at all', () => {
    const out = buildFamilyDuesStatements({
      players: [player({ playerId: 'x', playerFirstName: 'Sam', schedule: null })],
      todayISO: TODAY,
    });
    assert.equal(out.length, 0);
  });

  it('statements come out alphabetically — the hand-out order', () => {
    const out = buildFamilyDuesStatements({ players: [...marchands(), chen()], todayISO: TODAY });
    assert.deepEqual(out.map(s => s.receiptLabel), ['Chen family', 'Marchand family']);
  });
});

describe('the figures are the dues screen’s own arithmetic', () => {
  it('quotes the NET remainder, never the face value, on an open installment', () => {
    const out = buildFamilyDuesStatements({ players: marchands(), todayISO: TODAY });
    const isla = out[0].schedules.find(s => s.label.startsWith('Isla'))!;
    const aug = isla.rows[1];
    assert.equal(aug[2], '$500.00', 'face amount stays in the Amount column');
    assert.equal(aug[3], '$200.00', 'cash received is the coverage figure');
    assert.equal(aug[5], '$300.00', 'the ask is the remainder — never $500 again');
    assert.equal(aug[6], 'Still open');
  });

  it('shows the credit on the installment it lowered, and statuses read as words', () => {
    const out = buildFamilyDuesStatements({ players: marchands(), todayISO: TODAY });
    const isla = out[0].schedules.find(s => s.label.startsWith('Isla'))!;
    const oct = isla.rows[2];
    assert.equal(oct[4], '$125.00');
    assert.equal(oct[5], '$325.00');
    assert.equal(oct[6], 'Upcoming');
    assert.ok(isla.rows[0][6].startsWith('Paid '), 'a paid installment names its date');
  });

  it('headline stats: billed / received / credits / left to send, as the household’s totals', () => {
    const out = buildFamilyDuesStatements({ players: marchands(), todayISO: TODAY });
    assert.deepEqual(out[0].stats, {
      billed: '$2,900.00', received: '$1,700.00', credits: '$125.00', leftToSend: '$1,075.00',
    });
  });

  it('payments arrive oldest first, across both children, with method labels a parent reads', () => {
    const out = buildFamilyDuesStatements({ players: marchands(), todayISO: TODAY });
    const p = out[0].payments;
    assert.equal(p.length, 4);
    assert.deepEqual(p.map(r => r[1]), ['Isla', 'Emmett', 'Emmett', 'Isla']);
    assert.equal(p[3][3], 'Cash');
    assert.equal(p[0][3], 'E-Transfer');
  });
});

describe('what’s next, in sentences', () => {
  it('names the open installment, aggregates the last payment across children, and mentions the credit', () => {
    const out = buildFamilyDuesStatements({ players: marchands(), todayISO: TODAY });
    const next = out[0].next;
    assert.ok(next[0].includes('$300.00') && next[0].includes('still open'), next[0]);
    assert.ok(next[1].includes('$775.00') && next[1].includes('across both players') && next[1].startsWith('The last payment'), next[1]);
    assert.ok(next.some(s => s.includes('Credits of $125.00')), 'the applied credit is acknowledged');
  });

  it('a paid-up family reads as a receipt, never a bill', () => {
    const out = buildFamilyDuesStatements({ players: [chen()], todayISO: TODAY });
    assert.equal(out[0].paidUp, true);
    assert.deepEqual(out[0].next, ['Nothing — Maya’s dues are fully paid. Thank you!']);
    assert.equal(out[0].stats.leftToSend, '$0.00');
    assert.equal(out[0].stats.credits, '—');
  });

  it('credit set aside (keep_separate) gets its own sentence instead of a false "applied"', () => {
    const held = player({
      playerId: 'r', playerFirstName: 'Riley', familyKey: 'fam-r', guardianLastName: 'Osei',
      installments: [{ id: 'r1', dueDate: '2026-10-01', amount: 400, paidAt: null, remainingAmount: 400 }],
      coverage: [{ installmentId: 'r1', allocated: 0 }],
      credits: [{ amount: 150, creditDate: '2026-07-01', description: 'Raffle' }],
      schedule: { totalAmount: 400 },
      outstanding: 400, totalCredits: 150, leftToSend: 400, creditApplied: 0, owedBack: 150,
    });
    const out = buildFamilyDuesStatements({ players: [held], todayISO: TODAY });
    assert.ok(!out[0].next.some(s => s.includes('applied for you')), 'no false "applied" claim');
    assert.ok(out[0].next.some(s => s.includes('$150.00 in credit is set aside')), out[0].next.join(' | '));
  });

  it('money handed back appears as its own rows, only when it happened', () => {
    const withPayout = { ...chen(), payouts: [{ amount: 75, paidDate: '2026-08-01', method: 'cash' as const, note: null }] };
    const out = buildFamilyDuesStatements({ players: [withPayout], todayISO: TODAY });
    assert.equal(out[0].payouts.length, 1);
    assert.equal(out[0].payouts[0][2], '$75.00');
    const none = buildFamilyDuesStatements({ players: [chen()], todayISO: TODAY });
    assert.equal(none[0].payouts.length, 0);
  });

  it('two siblings sharing a first name keep their surnames apart', () => {
    const twins = [
      player({
        playerId: 'a', playerFirstName: 'Sam', playerLastName: 'Reyes-Okafor', familyKey: 'fam-t',
        installments: [{ id: 'a1', dueDate: '2026-09-01', amount: 100, paidAt: null, remainingAmount: 100 }],
        coverage: [{ installmentId: 'a1', allocated: 0 }],
        schedule: { totalAmount: 100 }, outstanding: 100, leftToSend: 100,
      }),
      player({
        playerId: 'b', playerFirstName: 'Sam', playerLastName: 'Okafor', familyKey: 'fam-t',
        installments: [{ id: 'b1', dueDate: '2026-09-01', amount: 100, paidAt: null, remainingAmount: 100 }],
        coverage: [{ installmentId: 'b1', allocated: 0 }],
        schedule: { totalAmount: 100 }, outstanding: 100, leftToSend: 100,
      }),
    ];
    const out = buildFamilyDuesStatements({ players: twins, todayISO: TODAY });
    const labels = out[0].schedules.map(s => s.label);
    assert.ok(labels[0].startsWith('Sam Reyes-Okafor') && labels[1].startsWith('Sam Okafor'), labels.join(' | '));
  });
});
