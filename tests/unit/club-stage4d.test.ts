import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { placeShowing } from '../../lib/club-sponsorships.ts';
import { parseSponsorLogoUrl, sponsorLogoPublicPath, SPONSOR_LOGO_MAX_WIDTH, SPONSOR_LOGO_MAX_HEIGHT } from '../../lib/sponsor-logo.ts';
import { prepareSponsorLogo } from '../../lib/sponsor-logo-image.ts';
import { tournamentToday, ORG_TIME_ZONE } from '../../lib/timezone.ts';
import { PUBLIC_SITE_WORDS as W } from '../../lib/public-site-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SPONSORS (Club Tier Stage 4d; drawings ruled 2026-10-19 Ask 17, gate 2026-10-23; words
 * CLUB_TIER_STAGE4D_COPY.md). The pure rules: the logo address and the logo's safe re-encode, and the end-day clock.
 * The list itself moved to Sponsorships (Board Ready Stage 6; board-ready-stage6-sponsorships.test.ts) and the site
 * editor's copy of it was retired (Part 4b). The wiring is pinned in club-stage4d-guard.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://abcd1234.supabase.co';
const FILE = '33333333-3333-4333-8333-333333333333.png';
const logoUrl = (org = ORG, file = FILE, origin = ORIGIN) => `${origin}/storage/v1/object/public/org-logos/${org}/sponsors/${file}`;

describe('a sponsor logo can only be a file this club uploaded', () => {
  it('refuses another club\'s folder, another host, http, a nested path and a wrong file name', () => {
    assert.ok(parseSponsorLogoUrl(logoUrl(), ORG, ORIGIN));
    for (const bad of [
      logoUrl(OTHER), logoUrl(ORG, FILE, 'https://evil.example.com'), logoUrl().replace('https://', 'http://'),
      logoUrl().replace('/sponsors/', '/sponsors/x/'), logoUrl(ORG, 'logo.png'), logoUrl(ORG, `${FILE}?v=1`).replace('?v=1', '/../x.png'),
      'https://abcd1234.supabase.co@evil.example.com/storage/v1/object/public/org-logos/' + ORG + '/sponsors/' + FILE,
    ]) assert.equal(parseSponsorLogoUrl(bad, ORG, ORIGIN), null, bad);
  });
  it('parses the object path the route may delete, and nothing else', () => {
    assert.deepEqual(parseSponsorLogoUrl(logoUrl(), ORG, ORIGIN), { objectPath: `${ORG}/sponsors/${FILE}` });
    assert.equal(parseSponsorLogoUrl(logoUrl(OTHER), ORG, ORIGIN), null);
    assert.equal(parseSponsorLogoUrl(null, ORG, ORIGIN), null);
    assert.equal(parseSponsorLogoUrl('not a url', ORG, ORIGIN), null);
    assert.equal(sponsorLogoPublicPath(ORG, FILE), `/storage/v1/object/public/org-logos/${ORG}/sponsors/${FILE}`);
  });
});

describe('a sponsor leaves the public pages the day AFTER its last day, in the club zone', () => {
  const shows = (endsOn: string | null, at: string, zone: string = ORG_TIME_ZONE) => placeShowing({ endsOn }, tournamentToday(new Date(at), zone));
  it('11:59 p.m. Toronto on the last day shows; midnight does not (EDT, UTC−4)', () => {
    assert.equal(shows('2026-10-23', '2026-10-24T03:59:00Z'), true);
    assert.equal(shows('2026-10-23', '2026-10-24T04:00:00Z'), false);
  });
  it('across the autumn clock change the edge moves with the zone', () => {
    assert.equal(shows('2026-10-31', '2026-11-01T03:59:00Z'), true);
    assert.equal(shows('2026-10-31', '2026-11-01T04:00:00Z'), false);
    assert.equal(shows('2026-11-01', '2026-11-02T04:59:00Z'), true, 'EST: 11:59 p.m. is 04:59Z');
    assert.equal(shows('2026-11-01', '2026-11-02T05:00:00Z'), false);
  });
  it('another zone moves the edge (the zone is a parameter; today every club is Toronto)', () => {
    // Vancouver (PDT, UTC−7): 11:59 p.m. on the 23rd is 06:59Z on the 24th, when Toronto has already ended it.
    assert.equal(shows('2026-10-23', '2026-10-24T05:00:00Z', 'America/Toronto'), false);
    assert.equal(shows('2026-10-23', '2026-10-24T05:00:00Z', 'America/Vancouver'), true);
    assert.equal(shows('2026-10-23', '2026-10-24T07:00:00Z', 'America/Vancouver'), false);
  });
});

describe('the lists card counts the About page\'s three lists', () => {
  it('words', () => {
    assert.equal(W.listsSummary(2, 3, 0), '2 contacts · 3 documents');
    assert.equal(W.listsSummary(0, 0, 0), 'Optional · none yet');
    assert.equal(W.listsSummary(1, 1, 1), '1 contact · 1 document · 1 question');
  });
});

describe('the logo is opened and re-saved, never trusted', () => {
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#2F6B2F' } }).png().toBuffer();

  it('a good PNG comes back as a small PNG that fits the box, never enlarged', async () => {
    const r = await prepareSponsorLogo(await png(1600, 800), 'image/png');
    assert.ok(r.ok);
    const meta = await sharp(r.png).metadata();
    assert.equal(meta.format, 'png');
    assert.ok(meta.width! <= SPONSOR_LOGO_MAX_WIDTH && meta.height! <= SPONSOR_LOGO_MAX_HEIGHT);
    const small = await prepareSponsorLogo(await png(100, 40), 'image/png');
    assert.ok(small.ok);
    assert.equal((await sharp(small.png).metadata()).width, 100);
  });
  it('a JPEG and a WebP are accepted too', async () => {
    const jpg = await sharp({ create: { width: 200, height: 80, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const webp = await sharp({ create: { width: 200, height: 80, channels: 3, background: '#fff' } }).webp().toBuffer();
    assert.ok((await prepareSponsorLogo(jpg, 'image/jpeg')).ok);
    assert.ok((await prepareSponsorLogo(webp, 'image/webp')).ok);
  });
  it('a declared type that is not JPG, PNG or WebP is refused before it is opened', async () => {
    const r = await prepareSponsorLogo(await png(50, 50), 'image/svg+xml');
    assert.ok(!r.ok);
    assert.equal(r.error, "That file isn't a JPG, PNG or WebP image. Choose a different one.");
  });
  it('a mislabelled file (a TIFF called a PNG) is refused as the wrong type', async () => {
    const tiff = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).tiff().toBuffer();
    const r = await prepareSponsorLogo(tiff, 'image/png');
    assert.ok(!r.ok);
    assert.equal(r.error, "That file isn't a JPG, PNG or WebP image. Choose a different one.");
  });
  it('bytes that are not an image are refused as unreadable', async () => {
    const r = await prepareSponsorLogo(Buffer.from('this is not a picture at all'), 'image/png');
    assert.ok(!r.ok);
    assert.equal(r.error, "We couldn't read that image. Try a different file.");
  });
  it('an SVG with a script in it, called a PNG, never gets in', async () => {
    const r = await prepareSponsorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(1)</script></svg>'), 'image/png');
    assert.ok(!r.ok);
  });
  it('a file over 2 MB is refused as too big', async () => {
    const r = await prepareSponsorLogo(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png');
    assert.ok(!r.ok);
    assert.equal(r.error, 'That file is over 2 MB. Choose a smaller one.');
  });
  it('a pixel bomb (small file, enormous picture) is refused as unreadable', async () => {
    const bomb = await png(4200, 4200);
    assert.ok(bomb.length < 2 * 1024 * 1024, 'flat colour compresses far below the byte limit');
    const r = await prepareSponsorLogo(bomb, 'image/png');
    assert.ok(!r.ok);
    assert.equal(r.error, "We couldn't read that image. Try a different file.");
  });
});
