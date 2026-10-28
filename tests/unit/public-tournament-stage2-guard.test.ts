import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES · STAGE 2, THE OVERVIEW (build prompt docs/projects/active/PUBLIC_TOURNAMENT_STAGE2_BUILD_PROMPT.md;
 * plan §5, Asks 3, 4, 17). Everything is built behind the preview switch: with it off, today's Overview, ticker, band and
 * explore row are exactly as they were. This guard holds that, and the rules the stage stands on.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const HOME = 'components/public/TournamentHomeContent.tsx';
const PARTS = ['PublicGameRow', 'PublicLiveCard', 'PublicSectionHead', 'PublicDoorRow'];
/** The files that may draw the shared parts: each renders only with the switch on. Part 2 adds the frame-on body. */
const FRAME_ONLY_USERS: string[] = [];

describe('the shared parts render only inside the new frame', () => {
  it('no page or component outside the frame-on Overview imports them', () => {
    const users = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => !PARTS.some(p => f.endsWith(`/${p}.tsx`)))
      .filter(f => PARTS.some(p => new RegExp(`from ['"][^'"]*/${p}['"]`).test(readSource(f))));
    assert.deepEqual(users.filter(f => !FRAME_ONLY_USERS.includes(f)), [], 'a shared part reached a page outside the switch');
  });
  it('their styles read only the frame\'s own light token set (they have no meaning outside it)', () => {
    const css = readSource('components/public/PublicParts.module.css');
    const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]);
    assert.ok(vars.length > 0);
    assert.deepEqual(vars.filter(v => !v.startsWith('--club-')), [], 'a shared part reads a token the frame does not set');
  });
  it('a score and a time are tabular figures; the heading door, the door row and the Directions target are 44 px or more', () => {
    const css = readSource('components/public/PublicParts.module.css');
    for (const sel of ['.when', '.scores', '.score', '.count']) {
      assert.match(css, new RegExp(`\\${sel} \\{[^}]*font-variant-numeric: tabular-nums`), sel);
    }
    assert.match(css, /\.headLink \{[^}]*min-height: 44px/);
    assert.match(css, /\.door \{[^}]*min-height: 56px/);
    assert.match(readCode('components/public/PublicLiveCard.tsx'), /<DirectionsLink /, 'the club pages\' one Directions control');
  });
});

describe('the moment helper is today\'s finished rule, exactly', () => {
  it('the old Overview keeps its own copy, unchanged, until Stage 8 deletes it — edit both or neither', () => {
    const home = readCode(HOME);
    assert.match(home, /const noUnplayedGames = !allGames\.some\(g => g\.status === 'scheduled'\);/);
    assert.match(home, /const eventEnded = !endDate \|\| now >= endDate;/);
    assert.match(home, /const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;/);
    assert.match(home, /isCompletedTournament \|\|\s*\(!scheduleWithheld && \(\(playoffsComplete && noUnplayedGames\) \|\| roundRobinComplete\)\);/);
    const moment = readCode('lib/tournament-moment.ts');
    assert.match(moment, /tournament\.status === 'completed' \|\|\s*\(!scheduleWithheld && \(\(playoffsComplete && noUnplayedGames\) \|\| roundRobinComplete\)\);/);
    assert.match(moment, /const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;/);
  });
});

describe('the band says Finished once the champion is crowned (owner, 2026-10-28)', () => {
  it('one rule for the band, the club home and the club\'s Tournaments tab: the word and the sorting move together', () => {
    const rule = readCode('lib/club-site-home.ts');
    assert.match(rule, /t\.status === 'completed' \|\| t\.status === 'archived' \|\| t\.championsCrownedAt \|\|/);
    assert.match(rule, /const isFinishedTournament = [^;]*!!t\.championsCrownedAt/);
  });
});

describe('the host card\'s Open now list (Ask 4 / Ask B)', () => {
  it('is the club home\'s own list, and its read asks the access question itself', () => {
    const data = readCode('lib/club-home-data.ts');
    assert.match(data, /const openNow = clubOpenNowRows\(publicLeagueSeasons, clubTryouts, today, href\);/);
    const body = data.slice(data.indexOf('export async function loadHostClubOpenNow'));
    assert.match(body, /if \(!isPublicClubSiteOpen\(org\) \|\| !hasModuleEntitlement\(org, 'module_public_site'\)\) return null;/);
    assert.match(body, /clubOpenNowRows\(leagueSeasons\.filter\(s => s\.status !== 'draft'\), tryouts, today, href\)/);
  });
});
