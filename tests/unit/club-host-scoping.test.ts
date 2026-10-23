/**
 * CLUB TIER 4e, PART 1: a host that is not ours is a club's own web address, and three things must know it.
 * (1) The legacy `/teams`-style shortcuts forward to ONE club (milton-bats); on a club's address they sent a visitor
 * to another club - proven live in the hosting spike. (2) robots.txt and (3) the sitemap named www's address on
 * every host. Pinned here; the host-to-club lookup that fills a club's own sitemap arrives with Part 4.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../../next.config.ts';
import { OWN_HOST_PATTERN, bareHost, isOwnHost, siteOriginForHost } from '../../lib/own-hosts.ts';
import { robotsFor } from '../../lib/robots-rules.ts';

const SITE = 'https://www.fieldlogichq.ca';

describe('which hosts are ours', () => {
  it('knows the platform, its subdomains, previews and local addresses', () => {
    for (const h of [
      'www.fieldlogichq.ca', 'fieldlogichq.ca', 'dev.fieldlogichq.ca', 'sites.fieldlogichq.ca',
      'fieldlogichq.com', 'www.fieldlogichq.com', 'main.d3ld0l2bgmmlga.amplifyapp.com',
      'localhost', 'localhost:3000', '192.168.2.200:3000', 'WWW.FieldLogicHQ.ca', '',
    ]) assert.equal(isOwnHost(h), true, h);
  });

  it('treats anything else as a club\'s own address', () => {
    for (const h of ['www.lakeshorelynx.ca', 'lakeshorelynx.ca', 'teams.lynx.org', 'fieldlogichq.ca.evil.com', 'notfieldlogichq.ca', 'evilfieldlogichq.com'])
      assert.equal(isOwnHost(h), false, h);
  });

  it('strips the port and case the way Next does before matching', () => {
    assert.equal(bareHost('WWW.Lynx.CA:8443'), 'www.lynx.ca');
  });

  it('names the host itself on a club address and the configured site on ours', () => {
    assert.equal(siteOriginForHost('www.lakeshorelynx.ca', SITE), 'https://www.lakeshorelynx.ca');
    assert.equal(siteOriginForHost('dev.fieldlogichq.ca', SITE), SITE);
  });
});

describe('the legacy shortcuts stay on our own hosts', () => {
  const SHORTCUTS = ['/schedule', '/results', '/register', '/rules', '/news', '/teams', '/teams/:id', '/admin/:path*'];

  it('every legacy shortcut is limited to our hosts, with the same rule robots and the sitemap use', async () => {
    const redirects = await nextConfig.redirects!();
    for (const source of SHORTCUTS) {
      const r = redirects.find((x) => x.source === source && x.destination.startsWith('/milton-bats'));
      assert.ok(r, `${source} shortcut must still exist`);
      const host = (r.has ?? []).find((h) => h.type === 'host');
      assert.ok(host && 'value' in host, `${source} must be limited to our own hosts`);
      assert.equal(host.value, OWN_HOST_PATTERN);
    }
  });

  it('the pattern, anchored the way Next anchors it, matches ours and never a club', () => {
    const re = new RegExp(`^${OWN_HOST_PATTERN}$`);
    assert.ok(re.test('www.fieldlogichq.ca'));
    assert.ok(re.test('localhost'));
    assert.ok(!re.test('www.lakeshorelynx.ca'));
    assert.ok(!re.test('fieldlogichq.ca.evil.com'));
  });
});

describe('robots.txt answers for the host it is served on', () => {
  it('points a crawler on a club\'s address at that address\' own sitemap', () => {
    assert.equal(robotsFor('www.lakeshorelynx.ca', SITE).sitemap, 'https://www.lakeshorelynx.ca/sitemap.xml');
  });
  it('is unchanged on ours', () => {
    assert.equal(robotsFor('www.fieldlogichq.ca', SITE).sitemap, `${SITE}/sitemap.xml`);
    assert.equal(robotsFor(null, SITE).sitemap, `${SITE}/sitemap.xml`);
  });
  it('keeps the same private-surface rules on every host', () => {
    const a = robotsFor('www.lakeshorelynx.ca', SITE).rules;
    const b = robotsFor('www.fieldlogichq.ca', SITE).rules;
    assert.deepEqual(a, b);
  });
});
