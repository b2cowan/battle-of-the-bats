import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { BOOKKEEPING_VIEWS, REPORT_VIEWS, REPORT_VIEW_LABELS, bookkeepingAddress, bookkeepingPlace, reportViewControl } from '../../lib/bookkeeping-navigation.ts';

const ID = 'b2026102-3000-4000-8000-000000000001';

describe('Bookkeeping addresses', () => {
  it('round-trips each view with an open record and keeps the underlying list filters', () => {
    for (const view of BOOKKEEPING_VIEWS) {
      const original = new URLSearchParams({ category: 'Bank charges', q: '$18.08', from: '2026-10-01' });
      const url = new URL(bookkeepingAddress(original, { view, record: ID }), 'http://localhost');
      assert.deepEqual(bookkeepingPlace(url.searchParams), { view, record: ID, form: null, attention: false, report: 'spending' });
      for (const [key, value] of original) assert.equal(url.searchParams.get(key), value);
    }
  });

  it('only opens a supported view and requires a valid record for Correct or Void', () => {
    for (const view of ['sources', 'record', 'add', 'invalid']) {
      assert.equal(bookkeepingPlace(new URLSearchParams({ view })).view, 'overview');
    }
    for (const form of ['correct', 'void']) {
      assert.equal(bookkeepingPlace(new URLSearchParams({ form, record: 'invalid' })).form, null);
      assert.equal(bookkeepingPlace(new URLSearchParams({ form, record: ID })).form, form);
    }
    assert.equal(bookkeepingPlace(new URLSearchParams('form=add')).form, 'add');
  });

  it('closing a window removes only its own place and switching views clears the attention filter', () => {
    const current = new URLSearchParams({ view: 'expenses', record: ID, form: 'correct', attention: '1', q: 'Hosting' });
    const closed = new URL(bookkeepingAddress(current, { record: null, form: null }), 'http://localhost');
    assert.deepEqual(bookkeepingPlace(closed.searchParams), { view: 'expenses', record: null, form: null, attention: true, report: 'spending' });
    assert.equal(closed.searchParams.get('q'), 'Hosting');
    const switched = new URL(bookkeepingAddress(closed.searchParams, { view: 'reports', attention: false }), 'http://localhost');
    assert.deepEqual(bookkeepingPlace(switched.searchParams), { view: 'reports', record: null, form: null, attention: false, report: 'spending' });
  });
});

describe('Reports views (thin View control, owner 2026-11-07)', () => {
  // A second view the registry does not have yet, to prove the pill appears at two. Cast: no such key exists today.
  const SECOND = 'second' as unknown as (typeof REPORT_VIEWS)[number];

  it('Spending is the default, and an unknown or missing report falls back to it', () => {
    assert.equal(REPORT_VIEWS[0], 'spending');
    for (const query of ['view=reports', 'view=reports&report=nonsense', 'view=reports&report=', 'view=reports&report=SPENDING']) {
      assert.equal(bookkeepingPlace(new URLSearchParams(query)).report, 'spending', query);
    }
    assert.equal(bookkeepingPlace(new URLSearchParams('view=reports&report=spending')).report, 'spending');
  });

  it('the default view writes no report key, so today\'s Reports address stays the canonical one', () => {
    const params = new URLSearchParams({ view: 'reports', category: 'Bank charges' });
    assert.equal(bookkeepingAddress(params, { report: 'spending' }), '/platform-admin/bookkeeping?view=reports&category=Bank+charges');
    const named = new URLSearchParams({ view: 'reports', report: 'spending' });
    assert.equal(bookkeepingAddress(named, { report: 'spending' }), '/platform-admin/bookkeeping?view=reports');
    // A view's address survives opening and closing a record, and a trip through another tab.
    const withView = new URLSearchParams({ view: 'reports', report: 'later_view' });
    const opened = new URL(bookkeepingAddress(withView, { record: ID }), 'http://localhost');
    assert.equal(opened.searchParams.get('report'), 'later_view');
    const back = new URL(bookkeepingAddress(new URL(bookkeepingAddress(opened.searchParams, { view: 'expenses', record: null }), 'http://localhost').searchParams, { view: 'reports' }), 'http://localhost');
    assert.equal(back.searchParams.get('report'), 'later_view');
  });

  it('with one available view there is no pill; with two there is, and the address picks between them', () => {
    const one = reportViewControl('spending', [{ key: 'spending', available: true }]);
    assert.deepEqual(one, { current: 'spending', options: null });
    const unavailable = reportViewControl('spending', [{ key: 'spending', available: true }, { key: SECOND, available: false }]);
    assert.equal(unavailable.options, null, 'an unavailable view is not a choice');
    assert.equal(reportViewControl(SECOND, [{ key: 'spending', available: true }, { key: SECOND, available: false }]).current, 'spending',
      'an address naming an unavailable view lands on the first available one');
    const two = reportViewControl(SECOND, [{ key: 'spending', available: true }, { key: SECOND, available: true }]);
    assert.equal(two.current, SECOND);
    assert.deepEqual(two.options?.map(option => option.id), ['spending', SECOND]);
    assert.equal(two.options?.[0].label, 'Spending');
  });

  it('the page registry carries Spending, renders the pill only from the control\'s options, and adds no tab', () => {
    const source = readFileSync(new URL('../../app/platform-admin/bookkeeping/BookkeepingClient.tsx', import.meta.url), 'utf8');
    assert.match(source, /\{ key: 'spending', available: true, render: \(\) => <ReportsSpending/);
    assert.match(source, /\{reportControl\.options && <div className=\{styles\.reportViewBar\}>\s*<SingleSelectDropdown lead label="View"/);
    assert.deepEqual([...BOOKKEEPING_VIEWS], ['overview', 'expenses', 'ledger', 'reports']);
    // Spending's drill-down narrows the export and the record window's steps only while Spending is on screen (/review
    // 2026-11-07): keyed on the Reports TAB, a drill-down made on Spending would narrow the next view's export too.
    assert.match(source, /const spendingOpen = view === 'reports' && reportControl\.current === 'spending'/);
    assert.match(source, /: spendingOpen \? reportRows :/);
    assert.match(source, /expenseFilterParams\(filters \?\? \(spendingOpen && drilled/);
    assert.doesNotMatch(source, /view === 'reports' \? reportRows|view === 'reports' && drilled/);
    // A view marked unavailable is never drawn, even when the address names it.
    assert.match(source, /reportViews\.find\(entry => entry\.key === reportControl\.current && entry\.available\)/);
  });

  it('every report view has words for the pill', () => {
    for (const view of REPORT_VIEWS) assert.ok(REPORT_VIEW_LABELS[view]?.trim(), view);
  });
});
