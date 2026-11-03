/**
 * THE OWNER'S EMAIL after a change that asked for the password again (Stage 0, Part 10, tab 5; Asks 8 and 9): it names
 * the person, never "You"; it says what actually happened; the clock is the product's one clock, Eastern.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { staffChangeAlertEmail, type BulkChangeAlert, type PriceSwitchAlert } from '../../lib/staff-change-alert-email.ts';

// 9:14 a.m. and 9:13 a.m. Eastern on Nov 2, 2026 (EST, UTC-5).
const common = { actor: 'sam@fieldlogichq.ca', at: '2026-11-02T14:14:07Z', passwordAt: '2026-11-02T14:13:58Z' };
const bulk = (over: Partial<BulkChangeAlert>): BulkChangeAlert => ({
  ...common, kind: 'bulk', bulkOperationId: 'op-1', reason: 'Trial extended for the clinic.', accounts: 37,
  action: { type: 'subscription_status_override', status: 'Trial', lastDay: '2026-12-31' },
  changed: 35, already: 0, failed: 0, skipped: { portals: 2, billed: 0, ownClubs: 0 }, also: { clubTrials: 0, compsEnded: 0, archived: 0, archivedAccounts: 0 }, ...over,
});
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the owner email', () => {
  it('a billing status run: the person, the result, the reason, the password time', () => {
    const { subject, html } = staffChangeAlertEmail(bulk({}));
    assert.equal(subject, 'Bulk change: 35 accounts now read Trial through Dec 31');
    const body = text(html);
    assert.match(body, /sam@fieldlogichq\.ca set the billing status of 37 accounts to Trial through Dec 31, 2026, at 9:14 a\.m\. Eastern on Nov 2\./);
    assert.match(body, /Result: 35 changed, 2 skipped \(Coaches Portals\)/);
    assert.match(body, /Reason: Trial extended for the clinic\./);
    assert.match(body, /Password last entered at 9:13 a\.m\./);
    assert.match(body, /Their real billing in Stripe is unchanged\./);
    assert.match(body, /If you did not expect this, open the audit log now\. Each account can be put back from its own record\./);
    assert.match(html, /\/platform-admin\/audit\?action=run_bulk_operation/);
    assert.doesNotMatch(body, /\bYou (set|moved|removed|switched)/);
  });

  it('a plan run says what else happened, and that Stripe was not touched', () => {
    const { subject, html } = staffChangeAlertEmail(bulk({
      accounts: 12, action: { type: 'plan_change', plan: 'Tournament Plus' }, changed: 10,
      skipped: { portals: 0, billed: 2, ownClubs: 0 }, also: { clubTrials: 1, compsEnded: 0, archived: 3, archivedAccounts: 2 },
    }));
    assert.equal(subject, 'Bulk change: 10 accounts moved to Tournament Plus');
    const body = text(html);
    assert.match(body, /moved 12 accounts to Tournament Plus at 9:14 a\.m\. Eastern on Nov 2\./);
    assert.match(body, /Result: 10 changed, 2 skipped \(Stripe still bills them\)/);
    assert.match(body, /Also: 1 Club trial started · 3 tournaments over the new limit archived across 2 accounts/);
    assert.match(body, /Nothing in Stripe was changed\./);
  });

  it('an extra feature run counts the ones already as asked', () => {
    const { subject, html } = staffChangeAlertEmail(bulk({
      accounts: 8, action: { type: 'module_addon_enablement', feature: 'House league', on: false }, changed: 6, already: 2,
      skipped: { portals: 0, billed: 0, ownClubs: 0 },
    }));
    assert.equal(subject, 'Bulk change: House league removed from 8 accounts');
    assert.match(text(html), /Result: 6 removed, 2 already removed/);
  });

  it('a Production price switch: before and after, and the way back', () => {
    const alert: PriceSwitchAlert = {
      ...common, kind: 'price', changeRequestId: 'cr-1', reason: 'Club annual rises for new customers.',
      slot: 'Club annual', newPriceId: 'price_1Nx', newAmount: '$660.00 a year', oldPriceId: 'price_1Mz',
    };
    const { subject, html } = staffChangeAlertEmail(alert);
    assert.equal(subject, 'Production price switched: Club annual');
    const body = text(html);
    assert.match(body, /switched the Production Club annual price at 9:14 a\.m\. Eastern on Nov 2\. New customers are charged price_1Nx \(\$660\.00 a year\) from now on\./);
    assert.match(body, /Before: price_1Mz/);
    assert.match(body, /Switching back is a new request with the old price\./);
    assert.match(html, /action=update_stripe_price_id/);
  });

  it('a Production price cleared says new customers cannot buy it, never "charged no price"', () => {
    const { subject, html } = staffChangeAlertEmail({
      ...common, kind: 'price', changeRequestId: 'cr-2', reason: 'Retired.',
      slot: 'Club annual', newPriceId: null, newAmount: null, oldPriceId: 'price_1Mz',
    });
    assert.equal(subject, 'Production price cleared: Club annual');
    const body = text(html);
    assert.match(body, /cleared the Production Club annual price at 9:14 a\.m\. Eastern on Nov 2\. New customers cannot buy it until a price is set\./);
    assert.doesNotMatch(body, /no price/);
  });

  it('a last day in another year keeps its year in the subject', () => {
    const { subject } = staffChangeAlertEmail(bulk({
      action: { type: 'subscription_status_override', status: 'Trial', lastDay: '2027-03-04' },
    }));
    assert.match(subject, /through Mar 4, 2027$/);
  });

  it('what a staff member typed is escaped', () => {
    const { html } = staffChangeAlertEmail(bulk({ reason: '<b>pilot</b>' }));
    assert.match(html, /&lt;b&gt;pilot&lt;\/b&gt;/);
  });
});
