import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LIST_MAX } from '../../lib/public-site-patch.ts';
import { PUBLIC_SITE_WORDS as W } from '../../lib/public-site-words.ts';
import { ORG_LOGO_BUCKET } from '../../lib/org-image-limits.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SPONSORS — THE WIRING (Club Tier Stage 4d). The rules are tested in club-stage4d.test.ts; this pins where
 * they are used, so a refactor cannot quietly drop one:
 *   · the database cap and the code's cap are one number; the logo bucket is the one the club logos use;
 *   · the logo route is the Public site editor's (owner or admin), opens the file, and deletes only the club's own;
 *   · the "has it ended" filter is the PUBLIC pages' loaders' — never the shared read the editor uses;
 *   · the strip is on the HOME only, the section on the About page only — never the frame, the footer or another page;
 *   · sponsors are not a home section, and do not count toward "N of 4 ready", and do not open the About page;
 *   · the club's thank-you wears none of the coach money book's words.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const read = (p: string) => readFileSync(p, 'utf8');
/** Code only: comments (block and line) removed, so a header that names what is NOT here is not a hit. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

const ROUTE = 'app/api/admin/public-site/sponsor-logo/route.ts';
const EDITOR = 'app/[orgSlug]/admin/public-site/page.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); } else if (/\.(ts|tsx)$/.test(name)) out.push(p.replaceAll('\\', '/'));
  }
  return out;
}

describe('the database and the code agree', () => {
  it('the CHECK in mig 353 is the code\'s cap, and the column is NOT NULL with an empty-list default', () => {
    const sql = read('supabase/migrations/353_the_clubs_sponsors.sql');
    assert.match(sql, new RegExp(`jsonb_array_length\\(sponsors\\) <= ${LIST_MAX.sponsors}\\)`));
    assert.match(sql, /sponsors jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  });
  it('the logo bucket is the one public bucket every org logo lives in, named once', () => {
    assert.equal(ORG_LOGO_BUCKET, 'org-logos');
    assert.match(code('lib/org-logo-storage.ts'), /export \{ ORG_LOGO_BUCKET \}/, 'the storage module re-exports the one name');
    assert.match(code('lib/sponsor-logo.ts'), /import \{ ORG_LOGO_BUCKET \} from '\.\/org-image-limits'/);
    assert.doesNotMatch(code('lib/sponsor-logo.ts'), /'org-logos'/);
  });
  it('the data dictionary names the column', () => {
    assert.match(read('docs/agents/db/DATA_DICTIONARY.md'), /dict:col:org_public_site_content\.sponsors/);
  });
});

describe('the logo route is the Public site editor\'s, opens the file and deletes only the club\'s own', () => {
  const route = code(ROUTE);
  it('both verbs ask the editor rule (owner or admin to write), never the Look rule the club logo uses', () => {
    assert.equal((route.match(/publicSiteEditor\(req, \{ write: true \}\)/g) ?? []).length, 2);
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
    assert.match(route, /select\('sponsors'\)\.eq\('org_id', org\.id\)/, 'the stored column, read with the server\'s own access');
    // Compared by the file named (not the string typed), and a failed read deletes nothing.
    assert.match(route, /parseSponsorLogoUrl\(s\.logoUrl, org\.id\)\?\.objectPath === parsed\.objectPath/);
    assert.match(route, /if \(error\) return NextResponse\.json\(\{ error: W\.saveFailed \}, \{ status: 500 \}\)/);
    assert.match(route, /status: 409/);
  });
  it('a sponsors save never stores a logo whose file is gone (a stale tab), and the upload refuses an oversized body early', () => {
    assert.match(code('app/api/admin/public-site/route.ts'), /parsed\.patch\.sponsors = await withoutMissingLogos\(r\.ctx\.org\.id, parsed\.patch\.sponsors\)/);
    assert.match(code(ROUTE), /get\('content-length'\)\) > ORG_LOGO_MAX_BYTES/);
  });
  it('a save or read that names no club never keeps a logo (fails closed); only the editor\'s own pre-send check may', () => {
    const patchSrc = code('lib/public-site-patch.ts');
    assert.match(patchSrc, /ctx\.orgId \? isOwnSponsorLogo\(logoUrl, ctx\.orgId, ctx\.supabaseOrigin\) : !!ctx\.clientCheck/);
    assert.match(patchSrc, /ROW\[kind\]\(row, \{ clientCheck: true \}\)/);
  });
  it('the editor deletes a file only AFTER the list that stopped using it was saved', () => {
    const rec = code('app/[orgSlug]/admin/public-site/SiteListRecord.tsx');
    const write = rec.slice(rec.indexOf('const write = useCallback'), rec.indexOf('const { saving, dirty'));
    assert.ok(write.indexOf('await onSave(values)') < write.indexOf('await sweep('), 'sweep follows the save');
    const create = rec.slice(rec.indexOf('async function create()'), rec.indexOf('// ── Remove: asks first'));
    assert.ok(create.indexOf('await onSave(values)') < create.indexOf('await sweep('));
    const remove = rec.slice(rec.indexOf('async function doRemove()'), rec.indexOf('const fieldsForm'));
    assert.ok(remove.indexOf('await onRemove()') < remove.indexOf('await discardAll('));
  });
});

describe('the ended filter belongs to the public pages\' loaders', () => {
  it('the home\'s loader and the About page filter; the shared read and the editor do not', () => {
    assert.match(code('lib/club-home-data.ts'), /sponsors: sponsorsShowing\(siteContent\?\.sponsors\)/);
    assert.match(code('app/[orgSlug]/about/page.tsx'), /sponsorsShowing\(content\?\.sponsors\)/);
    const db = read('lib/db.ts');
    // Code only: the read's own comment names the filter it must NOT apply.
    const fn = db.slice(db.indexOf('export async function getOrgPublicSiteContent'), db.indexOf('/** Each editable field')).replace(/\/\/.*$/gm, '');
    assert.match(fn, /cleanSiteList\('sponsors'/);
    assert.doesNotMatch(fn, /sponsorsShowing/, 'the editor reads this too and must see an ended sponsor');
    assert.doesNotMatch(code(EDITOR), /sponsorsShowing/);
  });
  it('the day check is the club\'s calendar day, not an instant', () => {
    const lib = code('lib/club-sponsors.ts');
    assert.match(lib, /tournamentToday\(now, timeZone\)/);
    assert.doesNotMatch(lib, /club-notice|noticeEndsAt/, 'the notice\'s instant clock is not reused');
  });
});

describe('the strip is the home\'s and the section is the About page\'s — nowhere else', () => {
  it('only the home component and the About page import the sponsor parts', () => {
    const users = [...walk('app'), ...walk('components'), ...walk('lib')]
      .filter(p => !p.endsWith('ClubSponsors.tsx') && /ClubSponsors['"]/.test(read(p)));
    assert.deepEqual(users.sort(), ['app/[orgSlug]/about/page.tsx', 'components/public/ClubSiteHome.tsx']);
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
  it('the sponsor card sits in the lists row, after Questions, and the row names sponsors', () => {
    const editor = code(EDITOR);
    assert.ok(editor.indexOf("{listPart('questions')}") < editor.indexOf("{listPart('sponsors')}"));
    assert.equal(W.lists, 'Contacts, documents and sponsors');
  });
  it('the four lists are folded lines, one open at a time, each saying what is inside (owner 2026-10-23, option 1)', () => {
    const editor = code(EDITOR);
    assert.match(editor, /useState<ListKind \| null>\(null\)/, 'the row opens with every list folded');
    assert.match(editor, /setOpenList\(isOpen \? null : kind\)/, 'opening another list closes the first');
    assert.match(editor, /aria-expanded=\{isOpen\}/);
    assert.match(editor, /W\.listPeekSponsors\(/);
    assert.equal(W.listPeekSponsors(3, 1), '3 showing · 1 ended');
    assert.equal(W.listPeekSponsors(3, 0), '3 showing');
  });
  it('the public footer door keeps its own words', () => {
    assert.match(read('components/public/ClubFooter.tsx'), />Contacts and documents<\/Link>/);
  });
});

describe('the editor window follows the portal\'s record rules', () => {
  const rec = code('app/[orgSlug]/admin/public-site/SiteListRecord.tsx');
  it('only a required field carries the star (no "(optional)" tags anywhere in the sponsor words)', () => {
    assert.match(rec, /!f\.optional && <span className=\{repKit\.req\}/);
    for (const [k, v] of Object.entries(W)) if (/sponsor|lastDay|logo/i.test(k) && typeof v === 'string') assert.doesNotMatch(v, /optional/i, k);
  });
  it('a new sponsor asks (Save); cancelling throws the files made for it away', () => {
    assert.match(rec, /const cancel = \(\) => \{ void discardAll\(\); onClose\(\); \};/);
    assert.match(rec, /onClick=\{cancel\} disabled=\{busy\}>\{W\.cancel\}/);
    assert.match(rec, /disabled=\{busy \|\| uploading\}/, 'Save waits for an upload');
  });
  it('the logo box takes only JPG, PNG and WebP and shows the server\'s own refusal', () => {
    const f = code('app/[orgSlug]/admin/public-site/SponsorLogoField.tsx');
    assert.match(f, /ORG_IMAGE_TYPES\.join\(','\)/);
    assert.match(f, /role="alert"/);
    assert.doesNotMatch(f, /dangerouslySetInnerHTML/);
  });
});

describe('the club\'s thank-you wears none of the coach money book\'s words', () => {
  it('no sponsorship, invoice, paid, amount, arrival, partner, supporter, tier or expired in the sponsor words', () => {
    const banned = /sponsorship|invoice|\bpaid\b|amount|arrival|partner|supporter|backer|\btier\b|expired/i;
    for (const [k, v] of Object.entries(W)) {
      if (!/sponsor|lastDay|logo|noLogo/i.test(k) || typeof v !== 'string') continue;
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
