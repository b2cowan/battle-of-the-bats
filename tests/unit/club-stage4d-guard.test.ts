import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_SITE_WORDS as W } from '../../lib/public-site-words.ts';
import { ORG_LOGO_BUCKET } from '../../lib/org-image-limits.ts';
import { between, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SPONSORS — THE WIRING (Club Tier Stage 4d). The rules are tested in club-stage4d.test.ts; this pins where
 * they are used, so a refactor cannot quietly drop one:
 *   · the old list column is read by nothing, and is dropped by a held migration; the logo bucket is the club logos';
 *   · the logo route is Sponsorships', opens the file, and deletes only the club's own;
 *   · the "has it ended" filter is the PUBLIC pages' loaders' — never the place's own read;
 *   · the strip is on the HOME only, the section on the About page only — never the frame, the footer or another page;
 *   · sponsors are not a home section, and do not count toward "N of 4 ready", and do not open the About page;
 *   · the club's thank-you wears none of the coach money book's words.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const read = (p: string) => readFileSync(p, 'utf8');
/** Code only: comments (block and line) removed, so a header that names what is NOT here is not a hit. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// Board Ready Stage 6 Part 1: the logo route moved with the list to Sponsorships (the site editor's own was retired; its
// in-use check read the old column, so it could have deleted a logo a sponsor in the new list still names).
const ROUTE = 'app/api/admin/sponsorships/sponsors/logo/route.ts';
const EDITOR = 'app/[orgSlug]/admin/public-site/page.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); } else if (/\.(ts|tsx)$/.test(name)) out.push(p.replaceAll('\\', '/'));
  }
  return out;
}

describe('the old list column is retired (Board Ready Stage 6 Part 4b)', () => {
  it('nothing reads or writes org_public_site_content.sponsors: no mapper, no column map, no patch field', () => {
    const db = read('lib/db.ts');
    const site = db.slice(db.indexOf('export async function getOrgPublicSiteContent'), db.indexOf('export async function upsertOrgPublicSiteContent'));
    assert.doesNotMatch(site, /sponsor/i);
    assert.doesNotMatch(code('lib/public-site-patch.ts'), /sponsor/i);
    assert.doesNotMatch(code('app/api/admin/public-site/route.ts'), /sponsor/i);
  });
  it('the drop is written, and recorded for the release (a dropped column is invisible to check:migrations)', () => {
    assert.match(read('supabase/migrations/538_the_old_sponsor_list_column_is_gone.sql'), /DROP COLUMN IF EXISTS sponsors/);
    assert.match(read('supabase/migrations/MANUAL_PROD_STEPS.json'), /"538_the_old_sponsor_list_column_is_gone\.sql"/);
  });
  it('the logo bucket is the one public bucket every org logo lives in, named once', () => {
    assert.equal(ORG_LOGO_BUCKET, 'org-logos');
    assert.match(code('lib/org-logo-storage.ts'), /export \{ ORG_LOGO_BUCKET \}/, 'the storage module re-exports the one name');
    assert.match(code('lib/sponsor-logo.ts'), /import \{ ORG_LOGO_BUCKET \} from '\.\/org-image-limits'/);
    assert.doesNotMatch(code('lib/sponsor-logo.ts'), /'org-logos'/);
  });
});

describe('the logo route is Sponsorships\', opens the file and deletes only the club\'s own', () => {
  const route = code(ROUTE);
  it('both verbs ask the Sponsorships gate, never the Look rule the club logo uses', () => {
    assert.equal((route.match(/requireSponsorships\(req\)/g) ?? []).length, 2);
    assert.doesNotMatch(route, /clubLookEditor/);
  });
  it('an upload is opened and re-saved, under a random name in the club\'s own folder, and never overwrites', () => {
    assert.match(route, /prepareSponsorLogo\(/);
    assert.match(route, /sponsorLogoObjectPath\(org\.id, newSponsorLogoFileName\(\)\)/);
    assert.match(route, /upsert: false/);
    assert.match(route, /contentType: 'image\/png'/);
    assert.doesNotMatch(route, /contentType: file\.type/, 'the declared type is never what is stored');
  });
  it('a file over 2 MB is refused before it is read into memory', () => {
    assert.match(route, /file\.size > ORG_LOGO_MAX_BYTES/);
    assert.ok(route.indexOf('file.size > ORG_LOGO_MAX_BYTES') < route.indexOf('arrayBuffer()'));
  });
  it('a delete names only this club\'s own sponsor logo and never one a saved sponsor still points at', () => {
    assert.match(route, /parseSponsorLogoUrl\(logoUrl, org\.id\)/);
    assert.match(route, /from\('club_sponsors'\)\.select\('logo_url'\)\.eq\('org_id', org\.id\)/, 'the one sponsor list, read with the server\'s own access');
    // Compared by the file named (not the string typed), and a failed read deletes nothing.
    assert.match(route, /parseSponsorLogoUrl\(s\.logo_url, org\.id\)\?\.objectPath === parsed\.objectPath/);
    assert.match(route, /if \(error\) return NextResponse\.json\(\{ error: W\.saveFailed \}, \{ status: 500 \}\)/);
    assert.match(route, /status: 409/);
  });
  it('the upload refuses an oversized body early, and a sponsor save keeps only a logo this club uploaded', () => {
    assert.match(code(ROUTE), /get\('content-length'\)\) > ORG_LOGO_MAX_BYTES/);
    // The refusal itself, not the name: a check whose answer is ignored keeps nobody's logo out.
    assert.match(code('app/api/admin/sponsorships/sponsors/route.ts'),
      /if \(v\.logoUrl && !isOwnSponsorLogo\(v\.logoUrl, org\.id\)\) return refused\(/);
    assert.match(code('app/api/admin/sponsorships/sponsors/[sponsorId]/route.ts'),
      /if \(v\.logoUrl && v\.logoUrl !== current\.logoUrl && !isOwnSponsorLogo\(v\.logoUrl, org\.id\)\) return refused\(/);
  });
});

describe('the ended filter belongs to the public pages\' loaders', () => {
  // ⚖ Board Ready Stage 6 (asks 1, 11): the one sponsor list moved to Sponsorships' own tables. The pages' loader is
  // `publicSponsorsFor` (the filter by the club's day, the home strip's 20); the place's own read keeps every sponsor.
  it('the home\'s loader and the About page filter; the place\'s read does not', () => {
    assert.match(code('lib/club-home-data.ts'), /publicSponsorsFor\(org\.id, org\.planId\)/);
    assert.match(code('lib/club-home-data.ts'), /sponsors: \(await sponsorList\)\.home/);
    assert.match(code('app/[orgSlug]/about/page.tsx'), /publicSponsorsFor\(org\.id, org\.planId\)[\s\S]*\.about/);
    const server = code('lib/club-sponsorships-server.ts');
    const place = server.slice(server.indexOf('export async function readSponsors'), server.indexOf('export async function readSponsor('));
    assert.doesNotMatch(place, /placeShowing|homeStrip/, 'the Sponsors tab must see an ended sponsor');
    const pub = between(readCode('lib/club-sponsorships-server.ts'), 'function publicSponsorsFor(', '\n}\n');
    assert.match(pub, /homeStrip\(list, today\)/);
    assert.match(pub, /const about = list\.filter\([^;]*placeShowing\(p, today\)/, 'the About page\'s own filter');
  });
  it('the day check is the club\'s calendar day, not an instant — on each public loader', () => {
    const server = readCode('lib/club-sponsorships-server.ts');
    for (const loader of ['publicSponsorsFor', 'divisionSponsorsFor']) {
      const body = between(server, `function ${loader}(`, '\n}\n', loader);
      assert.match(body, /tournamentToday\(now, ORG_TIME_ZONE\)/, loader);
      assert.match(body, /placeShowing\(/, `${loader}: an ended sponsor leaves`);
    }
    assert.doesNotMatch(code('lib/club-sponsorships.ts'), /club-notice|noticeEndsAt/, 'the notice\'s instant clock is not reused');
  });
});

describe('the strip is the home\'s and the section is the About page\'s — nowhere else', () => {
  // Board Ready Stage 6 (ask 1): a division's "Sponsored by" line, on its schedule and standings pages, joins the two.
  it('only the home component, the About page and a division\'s schedule and standings import the sponsor parts', () => {
    const users = [...walk('app'), ...walk('components'), ...walk('lib')]
      .filter(p => !p.endsWith('ClubSponsors.tsx') && /ClubSponsors['"]/.test(read(p)));
    assert.deepEqual(users.sort(), [
      'app/[orgSlug]/about/page.tsx', 'app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx',
      'app/[orgSlug]/league/[seasonSlug]/standings/page.tsx', 'components/public/ClubSiteHome.tsx',
    ]);
  });
  it('the frame, the footer and the shared frame data know nothing of sponsors', () => {
    for (const f of ['components/public/ClubFrame.tsx', 'components/public/ClubFooter.tsx', 'lib/club-frame-data.ts']) {
      assert.doesNotMatch(read(f), /sponsor/i, f);
    }
  });
  it('the strip is drawn once, after the sections, outside the grid of sections', () => {
    const home = code('components/public/ClubSiteHome.tsx');
    assert.equal((home.match(/<ClubSponsorStrip /g) ?? []).length, 1);
    assert.ok(home.indexOf('sections.map(') < home.indexOf('<ClubSponsorStrip'));
  });
  it('the About page puts Sponsors after Questions', () => {
    const about = code('app/[orgSlug]/about/page.tsx');
    assert.ok(about.indexOf('questions.map(') < about.indexOf('<ClubSponsorList'));
  });
  it('a link opens in a new tab as a sponsored link, and says so to a screen reader', () => {
    const src = code('components/public/ClubSponsors.tsx');
    assert.match(src, /target="_blank" rel="noopener noreferrer sponsored"/);
    assert.match(src, /\{W\.opensNewTab\}/);
  });
  it('a logo\'s alt text is the name where it stands alone, and empty where the name is beside it', () => {
    const src = code('components/public/ClubSponsors.tsx');
    assert.match(src, /<img src=\{s\.logoUrl\} alt=\{s\.name\} loading="lazy" \/>/);
    assert.match(src, /<img src=\{s\.logoUrl\} alt="" loading="lazy" \/>/);
  });
});

describe('sponsors are not a section, not "ready", and not a reason for the About page', () => {
  it('the home\'s section registry has no sponsors (no order, no hide switch, no migration of the two CHECKs)', () => {
    assert.doesNotMatch(read('lib/club-site-sections.ts'), /sponsor/i);
  });
  it('the editor does not count sponsors toward "N of 4 ready"', () => {
    const editor = code(EDITOR);
    const counts = editor.slice(editor.indexOf('const counts = {'), editor.indexOf('const setup ='));
    const readiness = counts.slice(0, counts.indexOf('const setup'));
    assert.match(readiness, /const counts = \{ contacts: [^}]*questions: [^}]*\};/);
    assert.doesNotMatch(readiness.match(/const counts = \{[^}]*\};/)![0], /sponsor/i);
    assert.doesNotMatch(read('lib/public-site-builder.ts'), /sponsor/i);
  });
  it('the About page\'s door still opens only for a contact, a document or a question', () => {
    assert.doesNotMatch(read('lib/club-about.ts'), /sponsor/i);
  });
  // Board Ready Stage 6 (ask 12, round 1 tab 1 RESTYLED): the list moved to Sponsorships; its line here is the door.
  it('the Sponsors line sits in the lists row, after Questions, as the door to Sponsorships', () => {
    const editor = code(EDITOR);
    assert.doesNotMatch(editor, /listPart\('sponsors'\)/, 'the list is Sponsorships\' now');
    assert.ok(editor.indexOf("{listPart('questions')}") < editor.indexOf('id="sponsors"'));
    assert.match(editor, /SPONSORSHIPS_WORDS\.siteDoor\.caption/);
    assert.match(editor, /opensSponsorships\(/, 'the door only for someone Sponsorships opens to');
    assert.equal(W.lists, 'Contacts, documents and sponsors');
  });
  it('the four lists are folded lines, one open at a time, each saying what is inside (owner 2026-10-23, option 1)', () => {
    const editor = code(EDITOR);
    assert.match(editor, /useState<ListKind \| null>\(null\)/, 'the row opens with every list folded');
    assert.match(editor, /setOpenList\(isOpen \? null : kind\)/, 'opening another list closes the first');
    assert.match(editor, /aria-expanded=\{isOpen\}/);
  });
  it('the public footer door keeps its own words', () => {
    assert.match(read('components/public/ClubFooter.tsx'), />Contacts and documents<\/Link>/);
  });
});

describe('the list window follows the portal\'s record rules', () => {
  it('only a required field carries the star', () => {
    assert.match(code('app/[orgSlug]/admin/public-site/SiteListRecord.tsx'), /!f\.optional && <span className=\{repKit\.req\}/);
  });
  it('asks the route\'s own row check, and holds a save while it refuses', () => {
    const rec = code('app/[orgSlug]/admin/public-site/SiteListRecord.tsx');
    assert.match(rec, /const mistake = checkListRow\(list\.kind, values\);/);
    assert.match(rec, /blocked: editing && !creating \? mistake : null/);
  });
});

describe('the logo box', () => {
  it('takes only JPG, PNG and WebP and shows the server\'s own refusal', () => {
    const f = code('app/[orgSlug]/admin/public-site/SponsorLogoField.tsx');
    assert.match(f, /ORG_IMAGE_TYPES\.join\(','\)/);
    assert.match(f, /role="alert"/);
    assert.doesNotMatch(f, /dangerouslySetInnerHTML/);
  });
  it('no "(optional)" tag in the sponsor words', () => {
    for (const [k, v] of Object.entries(W)) if (/sponsor|logo/i.test(k) && typeof v === 'string') assert.doesNotMatch(v, /optional/i, k);
  });
});

describe('the club\'s thank-you wears none of the coach money book\'s words', () => {
  it('no sponsorship, invoice, paid, amount, arrival, partner, supporter, tier or expired in the sponsor words', () => {
    const banned = /sponsorship|invoice|\bpaid\b|amount|arrival|partner|supporter|backer|\btier\b|expired/i;
    for (const [k, v] of Object.entries(W)) {
      if (!/sponsor|logo/i.test(k) || typeof v !== 'string') continue;
      assert.doesNotMatch(v, banned, k);
    }
  });
  it('the public words say Sponsors, once', () => {
    assert.equal(W.sponsorsHeading, 'Sponsors');
    assert.equal(W.sponsors, 'Sponsors');
  });
  it('the About page\'s section carries none of the words the About page never says', () => {
    const src = code('components/public/ClubSponsors.tsx') + code('app/[orgSlug]/about/page.tsx');
    assert.doesNotMatch(src, /\b(approved|verified|certified|compliant|compliance)\b/i);
  });
});

describe('the seeded fixture has the three shapes the walk needs', () => {
  it('a sponsor with a logo and a link, one with only a name, and one already ended', () => {
    const seed = read('scripts/seed-club-fixture.mjs');
    assert.match(seed, /LAKESHORE_SPONSORS/);
    const block = seed.slice(seed.indexOf('LAKESHORE_SPONSORS'), seed.indexOf('LAKESHORE_SPONSORS') + 2500);
    assert.match(block, /logoUrl/);
    assert.match(block, /link:/);
    assert.match(block, /endsOn: '20(1\d|2[0-5])-/, 'an end day already in the past');
  });
});
