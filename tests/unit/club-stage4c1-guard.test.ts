import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB RUNS ITS OWN SITE — THE WIRING (Club Tier Stage 4c-1). The rules are tested in club-stage4c1.test.ts; this
 * pins where they are used, so a refactor cannot quietly drop one:
 *   · the editor saves through ONE checked patch (a refused field says why and is never saved — F05);
 *   · the notice is never autosaved, is the owner's or an admin's, and shows under the bar on every club page;
 *   · the About page asks the one public-club rule, and its address is a static club section;
 *   · the old look is gone.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const read = (p: string) => readFileSync(p, 'utf8');
const EDITOR = 'app/[orgSlug]/admin/public-site/page.tsx';
const ROUTE = 'app/api/admin/public-site/route.ts';
const NOTICE_ROUTE = 'app/api/admin/public-site/notice/route.ts';

describe('the editor saves through one checked patch', () => {
  it('the route checks every field with parsePublicSitePatch, answers a refusal with its field, and writes only what was sent', () => {
    const route = read(ROUTE);
    assert.match(route, /parsePublicSitePatch\(body\)/);
    assert.match(route, /\{ error: parsed\.error, field: parsed\.field \}, \{ status: 400 \}/);
    // Who may save: one rule for both editor routes (lib/public-site-access.ts) — owner or admin to write.
    assert.match(route, /publicSiteEditor\(req, \{ write: true \}\)/);
    assert.match(read('lib/public-site-access.ts'), /write && ctx\.role !== 'owner' && ctx\.role !== 'admin'/);
    assert.doesNotMatch(route, /sanitizeUrl|URL_RE/, 'the silent null-on-bad-link is gone');
  });
  it('the save writes only the fields it is given (no full-row null-out)', () => {
    const db = read('lib/db.ts');
    const fn = db.slice(db.indexOf('export async function upsertOrgPublicSiteContent'), db.indexOf('// ── The club notice'));
    assert.match(fn, /if \(v !== undefined\) row\[column\] = v;/);
    assert.doesNotMatch(fn, /\?\? null,/);
  });
  it('the old look retired: no Save Changes, no Display Options, no Page Content, no admin-kit fork', () => {
    // Code only: the header comment names what left.
    const editor = read(EDITOR).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    for (const gone of [/Save Changes/, /Display Options/, /Page Content/, /useAdminKit/, /showUpcomingTournaments|showArchivesLink/]) {
      assert.doesNotMatch(editor, gone);
    }
    assert.match(editor, /<SavePill\b/);
    assert.match(editor, /<ReorderList\b/);
    assert.match(editor, /<ReorderRow key=\{r\.key\} id=\{r\.key\} number/, 'the number is the handle');
  });
});

describe('the club notice', () => {
  it('is posted, never autosaved, and only by an owner or admin', () => {
    const card = read('app/[orgSlug]/admin/public-site/ClubNoticeCard.tsx');
    assert.match(card, /onClick=\{\(\) => void post\(\)\}/);
    assert.doesNotMatch(card, /useRecordAutosave|setTimeout/);
    const route = read(NOTICE_ROUTE);
    assert.equal((route.match(/publicSiteEditor\(req, \{ write: true \}\)/g) ?? []).length, 2, 'Post and End now both write');
    assert.doesNotMatch(route, /export const GET/, 'the editor reads the notice with its other data');
  });
  it('shows under the bar on every club page, and takes itself down when it ends', () => {
    assert.match(read('components/public/ClubFrame.tsx'), /\{club\.notice && <ClubNoticeBanner notice=\{club\.notice\} \/>\}/);
    assert.match(read('app/[orgSlug]/layout.tsx'), /getLiveClubNotice\(org\.id, nowIso\)/);
    assert.match(read('components/public/ClubNoticeBanner.tsx'), /setTimeout\(\(\) => setEnded\(true\), left\)/);
  });
});

describe('the About page', () => {
  it('asks the one public-club rule and is a static club section (never read as a tournament slug)', () => {
    assert.match(read('app/[orgSlug]/about/page.tsx'), /requirePublicClubPage\(orgSlug, 'about'\)/);
    assert.match(read('lib/consumer-routes.ts'), /'about', 'archives'/);
    assert.match(read('lib/public-club-access.ts'), /about: 'module_public_site'/);
  });
  it('never says the club is compliant, and never shows a player', () => {
    const page = read('app/[orgSlug]/about/page.tsx').split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(page, /complian|approved|verified|certified/i);
    assert.doesNotMatch(page, /player/i);
  });
});
