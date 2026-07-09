import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  daysUntil,
  classifyCampaignSend,
  formatPlannedDate,
  UPCOMING_WINDOW_DAYS,
} from '../../lib/marketing-schedule.ts';

const TODAY = '2026-07-09';

describe('daysUntil', () => {
  it('counts whole days forward and backward', () => {
    assert.equal(daysUntil('2026-07-09', TODAY), 0);
    assert.equal(daysUntil('2026-07-10', TODAY), 1);
    assert.equal(daysUntil('2026-07-01', TODAY), -8);
    assert.equal(daysUntil('2026-08-08', TODAY), 30);
  });
});

describe('classifyCampaignSend', () => {
  it('sent wins over everything', () => {
    assert.equal(classifyCampaignSend({ plannedDate: '2026-01-01', sent: true, todayISO: TODAY }), 'sent');
  });
  it('no planned date (or trigger) is auto', () => {
    assert.equal(classifyCampaignSend({ plannedDate: null, sent: false, todayISO: TODAY }), 'auto');
    assert.equal(classifyCampaignSend({ plannedDate: '2026-08-01', sent: false, isTrigger: true, todayISO: TODAY }), 'auto');
  });
  it('date today or earlier is past_due', () => {
    assert.equal(classifyCampaignSend({ plannedDate: TODAY, sent: false, todayISO: TODAY }), 'past_due');
    assert.equal(classifyCampaignSend({ plannedDate: '2026-07-01', sent: false, todayISO: TODAY }), 'past_due');
  });
  it('within the window is due_soon; the window boundary is inclusive', () => {
    assert.equal(classifyCampaignSend({ plannedDate: '2026-07-20', sent: false, todayISO: TODAY }), 'due_soon');
    assert.equal(classifyCampaignSend({ plannedDate: '2026-08-08', sent: false, todayISO: TODAY }), 'due_soon'); // exactly 30
  });
  it('beyond the window is planned', () => {
    assert.equal(classifyCampaignSend({ plannedDate: '2026-08-09', sent: false, todayISO: TODAY }), 'planned'); // 31 days
    assert.equal(classifyCampaignSend({ plannedDate: '2026-12-15', sent: false, todayISO: TODAY }), 'planned');
  });
  it('window constant is 30', () => {
    assert.equal(UPCOMING_WINDOW_DAYS, 30);
  });
});

describe('formatPlannedDate', () => {
  it('formats without timezone drift', () => {
    assert.equal(formatPlannedDate('2026-11-01'), 'Nov 1, 2026');
    assert.equal(formatPlannedDate('2026-12-15'), 'Dec 15, 2026');
  });
});
