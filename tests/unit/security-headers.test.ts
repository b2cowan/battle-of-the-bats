/**
 * SECURITY HEADERS (owner, 2026-10-19). Production sent no framing rule and no HSTS, so any site could show the admin
 * and coach screens inside its own frame (clickjacking). next.config.ts now sends three headers on every path; this test
 * fails if one is removed or weakened.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../../next.config.ts';

async function everyPathHeaders(): Promise<Record<string, string>> {
  assert.equal(typeof nextConfig.headers, 'function', 'next.config.ts must define headers()');
  const rules = await nextConfig.headers!();
  const all = rules.find((r) => r.source === '/:path*');
  assert.ok(all, 'a headers rule must cover every path (/:path*)');
  assert.ok(!('has' in all) && !('missing' in all), 'the every-path rule must not be conditional');
  return Object.fromEntries(all.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

describe('security headers on every response', () => {
  it('no other site may frame our pages', async () => {
    const h = await everyPathHeaders();
    assert.match(h['content-security-policy'] ?? '', /frame-ancestors 'self'(;|$)/);
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
  });

  it('browsers are told to stay on HTTPS for at least a year, on this host only', async () => {
    const h = await everyPathHeaders();
    const hsts = h['strict-transport-security'] ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    assert.ok(maxAge >= 31536000, `max-age must be at least one year (got ${maxAge})`);
    assert.doesNotMatch(hsts, /includeSubDomains/i, 'includeSubDomains reaches subdomains nobody has audited');
    assert.doesNotMatch(hsts, /preload/i, 'preload is a hard-to-undo commitment, not set without an owner ruling');
  });
});
