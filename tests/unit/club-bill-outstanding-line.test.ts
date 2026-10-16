/**
 * A TEAM'S BILL LEADS WITH MONEY THAT ADDS UP; ITS DATE IS A LINE UNDER OUTSTANDING (owner 2026-10-16, option A of the
 * decision sheet https://claude.ai/artifact/EDktV4ykGYaSx6fLxMKC2t).
 *
 * Stage 11d's Credited made the club's bill window five figures — Billed · Credited · Collected · Outstanding · Next due —
 * and the portal's money band holds four across, so the fifth fell to a row of its own with the band's grey beside it
 * (the owner's screenshot, §308 W2's 15U AA). Five could not fit the 800px window: "$2,700.00" needs 119.5px at the
 * band's 24px figure, five across leaves it 116. The date was the one figure that was not money, and the payment rows
 * under the band already carry it — so it became the line under Outstanding, saying why the bill needs you.
 *
 * Held here: the line's words and their order (late, then sent, then next due, then nothing), and that the window
 * draws no Next due figure. The band itself is unchanged — its recipe stays three or four figures.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { billOutstandingLine, daysLateWords } from '../../lib/club-money-words.ts';

const readCode = (p: string) => readFileSync(p, 'utf8');
// The second argument is the oldest late payment's days late as its row reads them (15 on Oct 16 for an Oct 1 payment).
const none = { count: 0 };

describe('the line under Outstanding: why the bill needs you', () => {
  it('one payment late: its date and how late, in red — "Oct 1 · 15 days late" (§308 W2’s 15U AA)', () => {
    assert.deepEqual(
      billOutstandingLine({ overdue: { count: 1 }, sent: none, nextDue: { dueDate: '2026-12-01' }, oldestOverdueDate: '2026-10-01' }, 15),
      { late: true, text: 'Oct 1 · 15 days late' },
    );
  });
  it('one day late is singular', () => {
    assert.equal(billOutstandingLine({ overdue: { count: 1 }, sent: none, nextDue: null, oldestOverdueDate: '2026-10-15' }, 1)?.text, 'Oct 15 · 1 day late');
    assert.equal(daysLateWords(1), '1 day late');
  });
  it('two or more late: the count and the oldest date — "2 late · since Oct 1"', () => {
    assert.deepEqual(
      billOutstandingLine({ overdue: { count: 2 }, sent: none, nextDue: null, oldestOverdueDate: '2026-10-01' }, 15),
      { late: true, text: '2 late · since Oct 1' },
    );
  });
  it('late beats sent: both put a bill in Needs you, and late is the club’s to chase', () => {
    assert.equal(billOutstandingLine({ overdue: { count: 1 }, sent: { count: 1 }, nextDue: null, oldestOverdueDate: '2026-10-01' }, 15)?.late, true);
  });
  it('sent and waiting for the club beats the next date — it is what the club has to do', () => {
    assert.deepEqual(
      billOutstandingLine({ overdue: none, sent: { count: 1 }, nextDue: { dueDate: '2026-12-01' }, oldestOverdueDate: null }, 0),
      { late: false, text: 'Sent · confirm it' },
    );
    assert.equal(billOutstandingLine({ overdue: none, sent: { count: 2 }, nextDue: null, oldestOverdueDate: null }, 0)?.text, '2 sent · confirm them');
  });
  it('on time: the next payment’s date, quiet — "Next due Dec 1"', () => {
    assert.deepEqual(
      billOutstandingLine({ overdue: none, sent: none, nextDue: { dueDate: '2026-12-01' }, oldestOverdueDate: null }, 0),
      { late: false, text: 'Next due Dec 1' },
    );
  });
  it('nothing owed: no line — Outstanding $0.00 says it', () => {
    assert.equal(billOutstandingLine({ overdue: none, sent: none, nextDue: null, oldestOverdueDate: null }, 0), null);
  });
});

describe('the club’s bill window draws money only', () => {
  const bill = readCode('components/admin/kit/club/money/BillWindows.tsx');
  it('no Next due figure in the band', () => {
    assert.doesNotMatch(bill, /key: 'next'/);
    assert.doesNotMatch(bill, /label: 'Next due'/);
  });
  it('the line rides as Outstanding’s caption, red (with the warning mark) only when late', () => {
    // its days late are the late rows' own (the server's count), never the browser's day (/review 2026-10-16)
    assert.match(bill, /const owedLine = billOutstandingLine\(f, Math\.max\(0, \.\.\.bill\.installments\.filter\(i => i\.state === 'overdue'\)\.map\(i => i\.daysLate\)\)\);/);
    // the row's chip says it in the one wording
    assert.match(bill, /\{i\.state === 'overdue' && <LateChip days=\{i\.daysLate\} \/>\}/);
    assert.match(bill, /key: 'outstanding', label: 'Outstanding', figure: money\(f\.outstanding\),\s*caption: owedLine && \(owedLine\.late\s*\? <span className=\{moneyKit\.owedLate\}><AlertTriangle size=\{11\} aria-hidden \/>\{owedLine\.text\}<\/span>\s*: owedLine\.text\)/);
  });
  it('the late line wears the band’s danger ink, and may wrap on a phone', () => {
    const css = readCode('components/admin/kit/club/money/Money.module.css');
    assert.match(css, /\.owedLate \{ color: var\(--badge-danger-ink\); font-weight: 600; white-space: nowrap; \}/);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.owedLate \{ white-space: normal; \}/);
  });
});
