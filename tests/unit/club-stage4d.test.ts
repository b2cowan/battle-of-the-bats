import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { cleanSiteList, LIST_MAX, parsePublicSitePatch, checkListRow } from '../../lib/public-site-patch.ts';
import { sponsorEnded, sponsorsShowing, sponsorRowSub, sponsorCounts } from '../../lib/club-sponsors.ts';
import { parseSponsorLogoUrl, sponsorLogoPublicPath, SPONSOR_LOGO_MAX_WIDTH, SPONSOR_LOGO_MAX_HEIGHT } from '../../lib/sponsor-logo.ts';
import { prepareSponsorLogo } from '../../lib/sponsor-logo-image.ts';
import { clubAboutPageShows } from '../../lib/club-about.ts';
import { PUBLIC_SITE_WORDS as W } from '../../lib/public-site-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SPONSORS (Club Tier Stage 4d; drawings ruled 2026-10-19 Ask 17, gate 2026-10-23; words
 * CLUB_TIER_STAGE4D_COPY.md). The pure rules: the fourth list kind's row check, the logo address and the logo's safe
 * re-encode, and the end-day clock. The wiring is pinned in club-stage4d-guard.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://abcd1234.supabase.co';
const FILE = '33333333-3333-4333-8333-333333333333.png';
const logoUrl = (org = ORG, file = FILE, origin = ORIGIN) => `${origin}/storage/v1/object/public/org-logos/${org}/sponsors/${file}`;
const ctx = { orgId: ORG, supabaseOrigin: ORIGIN };
let n = 0;
const newId = () => `new-${n++}`;
const patch = (sponsors: unknown) => parsePublicSitePatch({ sponsors }, newId, ctx);

describe('a sponsor row: name required, the rest optional', () => {
  it('a name alone is a sponsor, and absent fields are absent (never empty strings)', () => {
    const r = patch([{ name: '  Riverside Dental ' }]);
    assert.ok(r.ok);
    assert.deepEqual(r.patch.sponsors, [{ id: 'new-0', name: 'Riverside Dental' }]);
  });
  it('no name is refused in the house words', () => {
    const r = patch([{ name: '   ' }]);
    assert.ok(!r.ok);
    assert.equal(r.field, 'sponsors');
    assert.equal(r.error, 'Add the name first.');
  });
  it('a name over the limit is refused, never silently cut', () => {
    const r = patch([{ name: 'x'.repeat(81) }]);
    assert.ok(!r.ok);
    assert.equal(r.error, 'The name can be up to 80 characters.');
    assert.ok(patch([{ name: 'x'.repeat(80) }]).ok);
  });
  it('a link is completed to https and a bad one is refused in the same words as a document link', () => {
    const ok = patch([{ name: 'A', link: 'riversidedental.ca' }]);
    assert.ok(ok.ok);
    assert.equal(ok.patch.sponsors?.[0].link, 'https://riversidedental.ca');
    const bad = patch([{ name: 'A', link: 'javascript:alert(1)' }]);
    assert.ok(!bad.ok);
    assert.equal(bad.error, "That isn't a web address. Paste the link, starting with https://");
  });
  it('a last day must be a real calendar day; blank means none', () => {
    const ok = patch([{ name: 'A', endsOn: '2027-12-31' }, { name: 'B', endsOn: '' }]);
    assert.ok(ok.ok);
    assert.equal(ok.patch.sponsors?.[0].endsOn, '2027-12-31');
    assert.ok(!('endsOn' in ok.patch.sponsors![1]));
    for (const bad of ['2027-02-30', 'soon', '12/31/2027', '2027-13-01']) {
      const r = patch([{ name: 'A', endsOn: bad }]);
      assert.ok(!r.ok, bad);
      assert.equal(r.error, "That isn't a date. Pick the last day from the calendar.");
    }
  });
  it('a last day already passed is allowed (the sponsor is simply ended)', () => {
    assert.ok(patch([{ name: 'A', endsOn: '2020-01-01' }]).ok);
  });
  it('twenty sponsors is the cap, in words', () => {
    assert.equal(LIST_MAX.sponsors, 20);
    assert.ok(patch(Array.from({ length: 20 }, (_, i) => ({ name: `S${i}` }))).ok);
    const r = patch(Array.from({ length: 21 }, (_, i) => ({ name: `S${i}` })));
    assert.ok(!r.ok);
    assert.equal(r.error, 'You have twenty sponsors. Remove one to add another.');
    assert.equal(W.listFull(20, 'sponsors'), 'You have twenty sponsors. Remove one to add another.');
  });
  it('a row keeps its id and a new one is named by the server', () => {
    const r = patch([{ id: 'keep-me', name: 'A' }, { name: 'B' }]);
    assert.ok(r.ok);
    assert.equal(r.patch.sponsors?.[0].id, 'keep-me');
    assert.match(r.patch.sponsors![1].id, /^new-\d+$/);
  });
  it('the editor window asks the same check before it sends', () => {
    assert.equal(checkListRow('sponsors', { name: '' }), 'Add the name first.');
    assert.equal(checkListRow('sponsors', { name: 'A', endsOn: 'soon' }), "That isn't a date. Pick the last day from the calendar.");
    assert.equal(checkListRow('sponsors', { name: 'A' }), null);
  });
});

describe('a sponsor logo can only be a file this club uploaded', () => {
  it('accepts the address the upload route writes', () => {
    const r = patch([{ name: 'A', logoUrl: logoUrl() }]);
    assert.ok(r.ok);
    assert.equal(r.patch.sponsors?.[0].logoUrl, logoUrl());
  });
  it('refuses another club\'s folder, another host, http, a nested path and a wrong file name', () => {
    for (const bad of [
      logoUrl(OTHER), logoUrl(ORG, FILE, 'https://evil.example.com'), logoUrl().replace('https://', 'http://'),
      logoUrl().replace('/sponsors/', '/sponsors/x/'), logoUrl(ORG, 'logo.png'), logoUrl(ORG, `${FILE}?v=1`).replace('?v=1', '/../x.png'),
      'https://abcd1234.supabase.co@evil.example.com/storage/v1/object/public/org-logos/' + ORG + '/sponsors/' + FILE,
    ]) {
      const r = patch([{ name: 'A', logoUrl: bad }]);
      assert.ok(!r.ok, bad);
      assert.equal(r.error, "That logo didn't come from here. Upload it again.");
    }
  });
  it('parses the object path the route may delete, and nothing else', () => {
    assert.deepEqual(parseSponsorLogoUrl(logoUrl(), ORG, ORIGIN), { objectPath: `${ORG}/sponsors/${FILE}` });
    assert.equal(parseSponsorLogoUrl(logoUrl(OTHER), ORG, ORIGIN), null);
    assert.equal(parseSponsorLogoUrl(null, ORG, ORIGIN), null);
    assert.equal(parseSponsorLogoUrl('not a url', ORG, ORIGIN), null);
    assert.equal(sponsorLogoPublicPath(ORG, FILE), `/storage/v1/object/public/org-logos/${ORG}/sponsors/${FILE}`);
  });
});

describe('a stored list reaches a page only as the route would have saved it', () => {
  it('drops a row with no name, keeps the cap, and drops ONLY a logo that is not ours', () => {
    const raw = [
      { id: 'a', name: 'Good', logoUrl: logoUrl(), link: 'https://good.ca', endsOn: '2027-01-01' },
      { id: 'b', name: '' },
      { id: 'c', name: 'Bad logo', logoUrl: 'https://evil.example.com/x.png' },
      { id: 'd', name: 'Bad link', link: 'javascript:alert(1)' },
      'nonsense',
    ];
    const out = cleanSiteList('sponsors', raw, ctx);
    assert.deepEqual(out.map(r => r.id), ['a', 'c']);
    assert.equal((out[1] as { logoUrl?: string }).logoUrl, undefined, 'the row stays, the logo goes');
    assert.equal((out[0] as { logoUrl?: string }).logoUrl, logoUrl());
  });
  it('reads at most twenty and gives a missing id a name', () => {
    const out = cleanSiteList('sponsors', Array.from({ length: 25 }, () => ({ name: 'S' })), ctx);
    assert.equal(out.length, 20);
    assert.equal(new Set(out.map(r => r.id)).size, 20);
  });
  it('a non-list is no list', () => {
    assert.deepEqual(cleanSiteList('sponsors', null, ctx), []);
  });
});

describe('a sponsor leaves the public pages the day AFTER its last day, in the club zone', () => {
  const s = (endsOn?: string) => ({ id: 'x', name: 'X', ...(endsOn ? { endsOn } : {}) });
  it('no last day never lapses', () => {
    assert.equal(sponsorEnded(s(), '2099-01-01'), false);
  });
  it('the last day itself still shows; the next day does not', () => {
    assert.equal(sponsorEnded(s('2026-10-23'), '2026-10-23'), false);
    assert.equal(sponsorEnded(s('2026-10-23'), '2026-10-24'), true);
  });
  it('11:59 p.m. Toronto on the last day shows; midnight does not (EDT, UTC−4)', () => {
    const list = [s('2026-10-23')];
    assert.equal(sponsorsShowing(list, new Date('2026-10-24T03:59:00Z')).length, 1);
    assert.equal(sponsorsShowing(list, new Date('2026-10-24T04:00:00Z')).length, 0);
  });
  it('across the autumn clock change the edge moves with the zone', () => {
    const list = [s('2026-10-31')];
    assert.equal(sponsorsShowing(list, new Date('2026-11-01T03:59:00Z')).length, 1);
    assert.equal(sponsorsShowing(list, new Date('2026-11-01T04:00:00Z')).length, 0);
    const after = [s('2026-11-01')];
    assert.equal(sponsorsShowing(after, new Date('2026-11-02T04:59:00Z')).length, 1, 'EST: 11:59 p.m. is 04:59Z');
    assert.equal(sponsorsShowing(after, new Date('2026-11-02T05:00:00Z')).length, 0);
  });
  it('another zone moves the edge (the zone is a parameter; today every club is Toronto)', () => {
    const list = [s('2026-10-23')];
    // Vancouver (PDT, UTC−7): 11:59 p.m. on the 23rd is 06:59Z on the 24th, when Toronto has already ended it.
    assert.equal(sponsorsShowing(list, new Date('2026-10-24T05:00:00Z'), 'America/Toronto').length, 0);
    assert.equal(sponsorsShowing(list, new Date('2026-10-24T05:00:00Z'), 'America/Vancouver').length, 1);
    assert.equal(sponsorsShowing(list, new Date('2026-10-24T07:00:00Z'), 'America/Vancouver').length, 0);
  });
  it('keeps the club\'s order', () => {
    const list = [s('2030-01-01'), s(), s('2020-01-01'), s('2031-01-01')].map((r, i) => ({ ...r, id: `r${i}` }));
    assert.deepEqual(sponsorsShowing(list, new Date('2026-10-23T12:00:00Z')).map(r => r.id), ['r0', 'r1', 'r3']);
  });
  it('the editor counts what is showing and what has ended, and words each row', () => {
    const list = [s('2030-01-01'), s(), s('2020-01-01')];
    assert.deepEqual(sponsorCounts(list, '2026-10-23'), { total: 3, ended: 1 });
    assert.equal(sponsorRowSub(s('2027-12-31'), '2026-10-23'), 'Until Dec 31, 2027');
    assert.equal(sponsorRowSub(s(), '2026-10-23'), 'No last day');
    assert.equal(sponsorRowSub(s('2026-12-31'), '2027-01-01'), 'Last day was Dec 31, 2026');
  });
});

describe('the lists card counts sponsors beside the other lists', () => {
  it('words', () => {
    assert.equal(W.listsSummary(0, 0, 0, 3, 1), '3 sponsors · 1 ended');
    assert.equal(W.listsSummary(2, 3, 0, 3, 0), '2 contacts · 3 documents · 3 sponsors');
    assert.equal(W.listsSummary(0, 0, 0, 1, 0), '1 sponsor');
    assert.equal(W.listsSummary(0, 0, 0, 0, 0), 'Optional · none yet');
    assert.equal(W.listsSummary(1, 1, 1), '1 contact · 1 document · 1 question', 'the old three-count call still reads the same');
  });
  it('a club with only sponsors still has no About page: sponsors never open it', () => {
    assert.equal(clubAboutPageShows({ description: null, contacts: [], documents: [], questions: [], sponsors: [{ id: 'a', name: 'A' }] } as never), false);
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
