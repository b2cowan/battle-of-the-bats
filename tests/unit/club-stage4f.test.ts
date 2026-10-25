import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubTournamentParts, clubHomeTournaments } from '../../lib/club-site-home.ts';
import { activeOrgSectionKey, orgSectionsFor } from '../../lib/org-public-sections.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A TOURNAMENTS TAB (Club Tier Stage 4f; drawings ruled 2026-10-25, all seven asks option A; words
 * CLUB_TIER_STAGE4F_COPY.md). One Tournaments tab and page hold current, upcoming and past; the Past tournaments tab
 * retired into it, its address forwards, and an archive page lights the tab with no back link.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const today = '2026-10-25'; // a Sunday
const t = (id: string, status: string, startDate: string | null, endDate: string | null = startDate) => ({ id, status, startDate, endDate });
const sealedRecord = (id: string, tournamentId: string | null, season: string) => ({ id, tournamentId, season });

describe('the page\'s parts (clubTournamentParts)', () => {
  const all = [
    t('live', 'active', '2026-10-24', '2026-10-26'),
    t('winter', 'active', '2027-02-06', '2027-02-07'),
    t('undated', 'active', null),
    t('draft', 'draft', '2026-11-14'),
    t('showcase', 'completed', '2026-10-03', '2026-10-04'),
    t('slam', 'active', '2026-08-14', '2026-08-16'), // still "active" after its dates: finished
    t('spring', 'completed', '2026-05-01', '2026-05-03'), // sealed
    t('gone', 'archived', '2025-06-01'), // archived and never sealed: no public site, no record
    t('old', 'archived', '2025-09-12', '2025-09-14'), // archived and sealed
  ];
  const archives = [
    sealedRecord('a-old', 'old', '2025'),
    sealedRecord('a-spring', 'spring', '2026'),
    sealedRecord('a-deleted', null, '2024'), // its tournament was deleted after the seal
  ];
  const parts = clubTournamentParts(all, archives, today);

  it('Current and upcoming: running and coming, soonest first; a draft never; an undated one last', () => {
    assert.deepEqual(parts.current.map(x => x.id), ['live', 'winter', 'undated']);
  });
  it('a finished tournament nobody sealed is listed, newest end date first (Ask 4)', () => {
    assert.deepEqual(parts.finished.map(x => x.id), ['showcase', 'slam']);
  });
  it('one row per tournament: a sealed one is its record, whatever its status (owner 2026-10-25)', () => {
    assert.ok(!parts.finished.some(x => x.id === 'spring'));
    assert.deepEqual(parts.archives.map(a => a.id), ['a-spring', 'a-old', 'a-deleted']);
  });
  it('an archived tournament that was never sealed is on no list', () => {
    assert.ok(![...parts.current, ...parts.finished].some(x => x.id === 'gone'));
  });
  it('the records sort newest season first, keeping the read\'s order within a season', () => {
    const same = clubTournamentParts([], [sealedRecord('b', 'x', '2026'), sealedRecord('c', 'y', '2025'), sealedRecord('a', 'z', '2026')], today);
    assert.deepEqual(same.archives.map(a => a.id), ['b', 'a', 'c']);
  });
  it('Current and upcoming is the home\'s list without its recently finished ones', () => {
    const home = clubHomeTournaments(all, today).map(x => x.id);
    assert.deepEqual(home.filter(id => parts.current.some(x => x.id === id)), parts.current.map(x => x.id));
    assert.ok(home.includes('showcase')); // the home keeps a just-finished one for 30 days, under Finished
  });
});

describe('the tab (Asks 1, 6, 7)', () => {
  it('Tournaments replaces Past tournaments, after House league by default', () => {
    assert.deepEqual(orgSectionsFor({ league: true, tournaments: true, teams: true }).map(s => s.label), ['Home', 'Teams', 'House league', 'Tournaments']);
  });
  it('lit on the page, on an archive page and on the old address', () => {
    for (const path of ['/lynx/tournaments', '/lynx/tournaments#past', '/lynx/archives', '/lynx/archives/abc']) {
      assert.equal(activeOrgSectionKey(path, 'lynx'), 'tournaments', path);
    }
  });
});

describe('the wiring', () => {
  const ORG = 'app/[orgSlug]';
  it('the page asks the one rule, then the club\'s Tournaments switch, and reads strictly', () => {
    const code = readCode(`${ORG}/tournaments/page.tsx`);
    assert.match(code, /forwardToOwnAddress\(orgSlug, '\/tournaments'\)/);
    assert.match(code, /requirePublicClubPage\(orgSlug, 'tournaments'\)/);
    assert.match(code, /isSectionShown\('tournaments'/);
    assert.match(code, /isSectionShown\('archives'/);
    assert.match(code, /getTournamentsByOrg\(org\.id, \{ strict: true \}\)/);
    // The sealed list without the sealed snapshot (only an archive's own page reads that).
    assert.match(code, /listClubArchives\(org\.id, \{ strict: true \}\)/);
    assert.doesNotMatch(code, /getArchivesByOrg/);
    // The home's rows, not a second copy of them.
    assert.match(code, /clubTournamentRows\(/);
  });
  it('the old Past tournaments address forwards permanently to the page\'s past part', () => {
    const code = readCode(`${ORG}/archives/page.tsx`);
    assert.match(code, /forwardToOwnAddress\(orgSlug, '\/tournaments#past'\)/);
    assert.match(code, /permanentRedirect\(href\('\/tournaments#past'\)\)/);
  });
  it('an archive page has no "← Past tournaments" (the lit tab is the way back)', () => {
    assert.doesNotMatch(readCode(`${ORG}/archives/[archiveId]/page.tsx`), /Past tournaments/);
  });
  it('the router and the club\'s own address both know the page', () => {
    assert.match(readCode('lib/consumer-routes.ts'), /'tournaments'/);
    assert.match(readCode('lib/club-host.ts'), /'teams', 'tournaments', 'tryouts'/);
  });
  it('the tab asks the page\'s own question, with Past tournaments as its sub-option', () => {
    const code = readCode('lib/org-section-availability.ts');
    assert.match(code, /shownByClub\('tournaments', hidden\)/);
    assert.match(code, /shownByClub\('archives', hidden\)/);
  });
  it('the editor draws a sub-option inside its row (the rows stay the drag list and the section count)', () => {
    const code = readCode(`${ORG}/admin/public-site/page.tsx`);
    assert.match(code, /\{r\.option && \(/);
    assert.match(code, /className=\{styles\.subOption\}/);
  });
  it('the phone row brings the current tab into view, the coach hubs\' one rule', () => {
    assert.match(readCode('components/public/OrgSectionTabs.tsx'), /useActiveTabInView\(rowRef, 8, \[activeKey\]\)/);
    assert.match(readCode('components/shared/HubTabBar.tsx'), /useActiveTabInView\(barRef, 48,/);
    const rule = readCode('lib/use-active-tab-in-view.ts');
    assert.match(rule, /aria-current="page"/);
    assert.match(rule, /behavior: 'instant'/);
  });
});
