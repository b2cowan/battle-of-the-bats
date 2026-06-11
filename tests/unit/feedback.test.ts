import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateFeedbackInput,
  isThrottled,
  categoryFromRoute,
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
} from '../../lib/feedback-shared.ts';

// ── validateFeedbackInput ────────────────────────────────────────────────────
// The /api/feedback gate: body is the only required field, type must be valid, category falls back
// to 'Other', and long free-text is capped. A regression here either drops valid feedback or lets
// junk into feedback_submissions.

describe('validateFeedbackInput', () => {
  it('accepts a minimal valid bug', () => {
    const r = validateFeedbackInput({ type: 'bug', body: 'It broke' });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.type, 'bug');
      assert.equal(r.value.body, 'It broke');
      assert.equal(r.value.category, 'Other'); // no category given → fallback
      assert.equal(r.value.title, null);
    }
  });

  it('rejects a missing/blank body', () => {
    assert.equal(validateFeedbackInput({ type: 'bug', body: '   ' }).ok, false);
    assert.equal(validateFeedbackInput({ type: 'bug' }).ok, false);
  });

  it('rejects an invalid type', () => {
    assert.equal(validateFeedbackInput({ type: 'rant', body: 'x' }).ok, false);
    assert.equal(validateFeedbackInput({ body: 'x' }).ok, false);
  });

  it('rejects a non-object payload', () => {
    assert.equal(validateFeedbackInput(null).ok, false);
    assert.equal(validateFeedbackInput('bug').ok, false);
    assert.equal(validateFeedbackInput([1, 2]).ok, false);
  });

  it('keeps a known category and rejects an unknown one to Other', () => {
    const known = validateFeedbackInput({ type: 'feedback', body: 'x', category: 'Billing' });
    assert.ok(known.ok && known.value.category === 'Billing');
    const unknown = validateFeedbackInput({ type: 'feedback', body: 'x', category: 'Nonsense' });
    assert.ok(unknown.ok && unknown.value.category === 'Other');
  });

  it('trims + caps title and body', () => {
    const longTitle = 'T'.repeat(MAX_TITLE_CHARS + 50);
    const longBody = 'B'.repeat(MAX_BODY_CHARS + 500);
    const r = validateFeedbackInput({ type: 'feature', body: longBody, title: `  ${longTitle}  ` });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.title?.length, MAX_TITLE_CHARS);
      assert.equal(r.value.body.length, MAX_BODY_CHARS);
    }
  });

  it('drops a non-object context to {}', () => {
    const r = validateFeedbackInput({ type: 'bug', body: 'x', context: 'oops' });
    assert.ok(r.ok && typeof r.value.context === 'object' && !Array.isArray(r.value.context));
  });
});

// ── isThrottled ──────────────────────────────────────────────────────────────
// Pure throttle decision — the route owns the map and only records a timestamp on accept.

describe('isThrottled', () => {
  // Realistic epoch ms — the route always passes Date.now(), so an unseen key (default 0) is never
  // throttled because now ≫ interval.
  const NOW = 1_700_000_000_000;

  it('is false when the key has never been seen', () => {
    assert.equal(isThrottled(new Map(), 'user-1', NOW, 3600_000), false);
  });

  it('is true within the interval and false after it', () => {
    const map = new Map<string, number>([['u', NOW]]);
    assert.equal(isThrottled(map, 'u', NOW + 60_000, 3600_000), true); // 1 min later, hour window
    assert.equal(isThrottled(map, 'u', NOW + 3600_001, 3600_000), false); // just past the window
  });
});

// ── categoryFromRoute ────────────────────────────────────────────────────────

describe('categoryFromRoute', () => {
  it('maps routes to sensible default categories', () => {
    assert.equal(categoryFromRoute('/milton-bats/admin/tournaments/schedule'), 'Tournaments');
    assert.equal(categoryFromRoute('/milton-bats/admin/accounting/ledgers'), 'Accounting');
    assert.equal(categoryFromRoute('/milton-bats/admin/billing'), 'Billing');
    assert.equal(categoryFromRoute('/coaches/teams'), 'Coaches');
    assert.equal(categoryFromRoute('/some/registration/flow'), 'Registrations');
    assert.equal(categoryFromRoute('/platform-admin/overview'), 'Other');
    assert.equal(categoryFromRoute(null), 'Other');
  });
});
