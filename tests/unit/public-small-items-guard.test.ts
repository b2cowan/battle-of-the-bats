/**
 * Board Ready sweep 3, the small public items: what an anonymous reader may learn from a draft season, a post aimed at a
 * held-back division, and the card-payment yes/no for a tournament that is not live.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { publicPosts, publicNotices } from '../../lib/public-tournament-shape.ts';
import { isPublicTournamentStatus } from '../../lib/public-pages.ts';
import type { Announcement, Division, Tournament } from '../../lib/types.ts';

const divisions = [
  { id: 'open', scheduleVisibility: 'published' },
  { id: 'held', scheduleVisibility: 'unpublished' },
] as unknown as Pick<Division, 'id' | 'scheduleVisibility'>[];
const post = (id: string, divisionIds: string[] | null, pinned = false) => ({ id, title: id, body: id, pinned, divisionIds }) as unknown as Announcement;

describe('posts aimed at a held-back division', () => {
  it('publicPosts keeps a post for everyone and for a published division, drops one for a held-back division, ignores a stale id', () => {
    const list = [post('all', null), post('open', ['open']), post('held', ['held']), post('both', ['open', 'held']), post('gone', ['deleted'])];
    assert.deepEqual(publicPosts(list, divisions).map(p => p.id), ['all', 'open', 'gone']);
  });
  it('the Schedule strip\'s notices follow the same rule (one filter, not two)', () => {
    const t = { publicHiddenPages: [], settings: {} } as unknown as Pick<Tournament, 'publicHiddenPages' | 'settings'>;
    const list = [post('all', null, true), post('held', ['held'], true), post('quiet', null, false)];
    assert.deepEqual(publicNotices(list, t, divisions).map(n => n.id), ['all']);
  });
  it('the Overview cuts to three AFTER the filter, the News page and the nav\'s count read it too', () => {
    assert.match(readCode('components/public/TournamentHomeContent.tsx'), /publicPosts\(allAnnouncements, divisions\)\.slice\(0, 3\)/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/news/page.tsx'), /announcements=\{publicPosts\(announcements, divisions\)\}/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /publicPosts\(frameAnnouncements, divisions\)\.length/);
    assert.match(readCode('lib/public-frame-server.ts'), /publicPosts\(announcements, divisions\)\.length/);
  });
  it('a rule section aimed at a held-back division is dropped from the Rules page, its feed section and the nav\'s count', () => {
    // Stage 10: the page and its printable copy read one shape, which runs the held-back test itself over the FULL list.
    assert.match(readCode('lib/public-rules-shape.ts'), /const book = publicPosts\(rules, allDivisions\)/);
    assert.match(readCode('components/public/PublicRules.tsx'), /shapePublicRules\(\{ rules, resources, allDivisions: divisions/);
    assert.match(readCode('lib/public-tournament-data.ts'), /rules: publicPosts\(rules, divisions\)/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /publicPosts\(frameRules, divisions\)\.length/);
    assert.match(readCode('lib/public-frame-server.ts'), /publicPosts\(rules, divisions\)\.length/);
  });
  it('the News and Rules pages name published divisions only in their picker', () => {
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/news/page.tsx'), /divisions=\{divisions\.filter\(d => d\.scheduleVisibility === 'published'\)\}/);
    assert.match(readCode('lib/public-rules-shape.ts'), /const published = allDivisions\.filter\(d => d\.scheduleVisibility === 'published'\)/);
    assert.match(readCode('components/public/PublicRules.tsx'), /divisions=\{shape\.divisions\}/);
  });
});

describe('a draft season is not named to the public', () => {
  for (const page of ['register', 'status']) {
    it(`/league/[season]/${page} answers 404 for a draft season`, () => {
      const code = readCode(`app/[orgSlug]/league/[seasonSlug]/${page}/page.tsx`);
      // Through the house league rule's one question (Club Website Stage 1), which is false for a draft season.
      assert.match(code, /if \(!isPublicLeagueSeason\(season\)\) notFound\(\);/);
    });
  }
  it('the register page\'s tab does not name a draft season either', () => {
    assert.match(readCode('app/[orgSlug]/league/[seasonSlug]/register/page.tsx'), /isPublicLeagueSeason\(season\) \? `Register for \$\{season\.name\}` : null/);
  });
});

describe('the card-payment yes/no for a tournament', () => {
  it('only an active or completed tournament has a public site', () => {
    assert.equal(isPublicTournamentStatus('active'), true);
    assert.equal(isPublicTournamentStatus('completed'), true);
    for (const status of ['draft', 'canceled', 'cancelled', '', null, undefined]) assert.equal(isPublicTournamentStatus(status), false, String(status));
  });
  it('the route throttles first, then asks whether the event is public, before it answers anything about payments', () => {
    const route = readCode('app/api/pay/tournament/[tournamentId]/route.ts');
    const throttle = route.indexOf('throttlePublicForm(req)');
    const gate = route.indexOf('tournamentHasPublicSite(tournamentId)');
    const answer = route.indexOf('tournamentTakesOnlinePayments(tournamentId)');
    assert.ok(throttle > 0 && gate > throttle && answer > gate);
    assert.match(route, /return NextResponse\.json\(\{ online: false \}\)/);
  });
  it('the public-site check refuses a canceled organization and a malformed id', () => {
    const lib = readCode('lib/tournament-online-payments.ts');
    assert.match(lib, /if \(!\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(tournamentId\)\) return false;/);
    assert.match(lib, /org\.subscription_status !== 'canceled'/);
  });
});
