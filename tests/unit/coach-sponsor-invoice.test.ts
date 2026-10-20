import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultInvoiceDescription,
  formatInvoiceNumber,
  invoiceAmount,
  invoiceStanding,
  isRealDate,
  normalizePaymentDetails,
  oneLineAddress,
  paymentDetailsEmpty,
} from '../../lib/coach-sponsor-invoice';

describe('coach sponsor invoice rules (mig 339)', () => {
  it('numbers by season year, zero-padded to three (A2)', () => {
    assert.equal(formatInvoiceNumber(2026, 3), '2026-003');
    assert.equal(formatInvoiceNumber(2026, 42), '2026-042');
    assert.equal(formatInvoiceNumber(2027, 1234), '2027-1234');
  });

  it('invoices the pledge, else what arrived — never a typed figure', () => {
    assert.equal(invoiceAmount(750, 0), 750);
    // Sent more than pledged: invoiced what was sent, so the payments never out-add the invoice.
    assert.equal(invoiceAmount(750, 900), 900);
    assert.equal(invoiceAmount(null, 500), 500);
    assert.equal(invoiceAmount(0, 0), 0);
  });

  it('reads unpaid, part paid and paid in full from the arrivals (A1)', () => {
    assert.deepEqual(invoiceStanding(750, []), { standing: 'unpaid', paid: 0, balance: 750, paidOn: null });
    assert.deepEqual(invoiceStanding(750, [{ amount: 250, receivedDate: '2026-10-30' }]),
      { standing: 'part', paid: 250, balance: 500, paidOn: null });
    assert.deepEqual(
      invoiceStanding(750, [{ amount: 500, receivedDate: '2026-11-04' }, { amount: 250, receivedDate: '2026-10-30' }]),
      { standing: 'paid', paid: 750, balance: 0, paidOn: '2026-11-04' },
    );
    // More arrived than invoiced: still paid in full, never a negative balance.
    assert.equal(invoiceStanding(500, [{ amount: 600, receivedDate: null }]).balance, 0);
  });

  it('keeps only the three payment details, trimmed, empties dropped', () => {
    assert.deepEqual(
      normalizePaymentDetails({ chequeAddress: '  12 Elm St  ', etransferEmail: '', questionsTo: 'Priya', gst: '123' }),
      { chequeAddress: '12 Elm St', questionsTo: 'Priya' },
    );
    assert.deepEqual(normalizePaymentDetails(null), {});
    assert.equal(paymentDetailsEmpty({ questionsTo: 'Priya' }), true);
    assert.equal(paymentDetailsEmpty({ etransferEmail: 'a@b.ca' }), false);
  });

  it('never prints the sponsor notes in the default description', () => {
    assert.equal(defaultInvoiceDescription('2026 Season'), 'Team sponsorship — 2026 Season');
    assert.equal(defaultInvoiceDescription(null), 'Team sponsorship');
  });

  it('accepts only real calendar dates', () => {
    assert.equal(isRealDate('2026-10-20'), true);
    assert.equal(isRealDate('2026-02-31'), false);
    assert.equal(isRealDate('2026-99-99'), false);
    assert.equal(isRealDate(''), false);
    assert.equal(isRealDate(null), false);
  });

  it('folds a typed address onto one line', () => {
    assert.equal(oneLineAddress('c/o Priya Nand, 112 Birch Crescent\r\nRiverdale ON  K0A 2C0\n'), 'c/o Priya Nand, 112 Birch Crescent, Riverdale ON  K0A 2C0');
    assert.equal(oneLineAddress(null), '');
  });
});
