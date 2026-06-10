import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fingerprint, normalizeStack } from '../../lib/observability/fingerprint.ts';
import { redactValue, redactContext, scrubEmails } from '../../lib/observability/redact.ts';

// ── fingerprint / normalizeStack ─────────────────────────────────────────────
// The normalization regex is the grouping tuning knob: pin its behavior so a future tweak
// that accidentally merges distinct bugs (or splits one) is caught here, not in production.

describe('normalizeStack', () => {
  it('strips line:col, file paths, uuids, hex and digit runs', () => {
    const stack = [
      'Error: boom',
      '    at doThing (C:\\Users\\b2cow\\app\\lib\\db.ts:412:19)',
      '    at handler (/var/task/app/api/register/route.ts:198:7)',
    ].join('\n');
    const norm = normalizeStack(stack);
    assert.ok(!/\d+:\d+/.test(norm), 'no line:col remains');
    assert.ok(!norm.includes('b2cow'), 'absolute path collapsed');
    assert.ok(norm.startsWith('at '), 'keeps only frames, drops the message line');
  });

  it('returns empty string for missing stacks', () => {
    assert.equal(normalizeStack(undefined), '');
    assert.equal(normalizeStack(null), '');
    assert.equal(normalizeStack(''), '');
  });
});

describe('fingerprint', () => {
  it('is a stable 16-char hex', () => {
    const fp = fingerprint({ route: '/api/x', errorName: 'TypeError', stack: 'at a\nat b' });
    assert.match(fp, /^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical input', () => {
    const a = fingerprint({ route: '/api/x', errorName: 'TypeError', stack: 'at foo (x.ts:1:2)' });
    const b = fingerprint({ route: '/api/x', errorName: 'TypeError', stack: 'at foo (x.ts:1:2)' });
    assert.equal(a, b);
  });

  it('groups the SAME bug across requests with different line numbers / ids', () => {
    const a = fingerprint({ route: '/api/teams', errorName: 'PostgrestError', stack: 'at q (db.ts:412:19)\nat h (route.ts:120:5)' });
    const b = fingerprint({ route: '/api/teams', errorName: 'PostgrestError', stack: 'at q (db.ts:733:11)\nat h (route.ts:204:9)' });
    assert.equal(a, b, 'same frames, different line numbers → same fingerprint');
  });

  it('separates DIFFERENT routes / error names', () => {
    const base = { errorName: 'Error', stack: 'at a (x.ts:1:1)' };
    assert.notEqual(
      fingerprint({ ...base, route: '/api/a' }),
      fingerprint({ ...base, route: '/api/b' }),
    );
    assert.notEqual(
      fingerprint({ route: '/api/a', stack: base.stack, errorName: 'TypeError' }),
      fingerprint({ route: '/api/a', stack: base.stack, errorName: 'RangeError' }),
    );
  });
});

// ── redaction ────────────────────────────────────────────────────────────────

describe('redactContext', () => {
  it('redacts sensitive keys by name (incl. minor-data fields)', () => {
    const out = redactContext({
      password: 'hunter2',
      authorization: 'Bearer abc',
      date_of_birth: '2012-01-01',
      guardian: 'Jane Doe',
      email: 'kid@example.com',
      teamId: 'abc-123',
      nested: { token: 'xyz', keep: 'ok' },
    }) as Record<string, unknown>;
    assert.equal(out.password, '[redacted]');
    assert.equal(out.authorization, '[redacted]');
    assert.equal(out.date_of_birth, '[redacted]');
    assert.equal(out.guardian, '[redacted]');
    assert.equal(out.email, '[redacted]');
    assert.equal(out.teamId, 'abc-123', 'non-sensitive key preserved');
    assert.equal((out.nested as Record<string, unknown>).token, '[redacted]');
    assert.equal((out.nested as Record<string, unknown>).keep, 'ok');
  });

  it('truncates very long strings', () => {
    const long = 'x'.repeat(5000);
    const out = redactValue(long) as string;
    assert.ok(out.length < 5000 && out.endsWith('…[truncated]'));
  });

  it('redacts compound email keys (substring match, not just \\bemail\\b)', () => {
    const out = redactContext({ user_email: 'a@b.com', emailAddress: 'c@d.com', teamId: 'x' }) as Record<string, unknown>;
    assert.equal(out.user_email, '[redacted]');
    assert.equal(out.emailAddress, '[redacted]');
    assert.equal(out.teamId, 'x');
  });

  it('handles null / undefined safely', () => {
    assert.deepEqual(redactContext(null), {});
    assert.deepEqual(redactContext(undefined), {});
  });
});

describe('scrubEmails', () => {
  it('redacts email VALUES inside free-text (messages / stacks)', () => {
    const msg = 'Failed to send invite to coach@example.com after 3 tries';
    const out = scrubEmails(msg);
    assert.ok(!out.includes('coach@example.com'));
    assert.ok(out.includes('[redacted-email]'));
  });

  it('leaves plain domains (not full addresses) alone', () => {
    const out = scrubEmails('GET https://api.example.com/v1 failed');
    assert.ok(out.includes('api.example.com'));
    assert.ok(!out.includes('[redacted-email]'));
  });

  it('scrubs emails when a string flows through redactValue', () => {
    const out = redactValue('contact parent.guardian@school.org for consent') as string;
    assert.ok(!out.includes('parent.guardian@school.org'));
    assert.ok(out.includes('[redacted-email]'));
  });
});
