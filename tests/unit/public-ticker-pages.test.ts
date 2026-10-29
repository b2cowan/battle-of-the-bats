import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pageCarriesTicker, TICKER_PAGES } from '../../lib/public-ticker-pages.ts';

/** Today's games line leaves the Overview, the Schedule and a game's page, and stays on every other page (Ask 17). */
describe('the pages that carry today\'s games line', () => {
  const on = (path: string) => pageCarriesTicker(path, 'riverdale', 'summer-classic');
  it('not the Overview, the Schedule or a game\'s page', () => {
    assert.equal(on('/riverdale/summer-classic'), false);
    assert.equal(on('/riverdale/summer-classic/schedule'), false);
    assert.equal(on('/riverdale/summer-classic/schedule/g1'), false);
  });
  it('every other page, and the pages under them', () => {
    for (const p of ['standings', 'teams', 'playoffs', 'news', 'rules']) assert.ok((TICKER_PAGES as readonly string[]).includes(p), p);
    for (const p of TICKER_PAGES) assert.equal(on(`/riverdale/summer-classic/${p}`), true, p);
    assert.equal(on('/riverdale/summer-classic/teams/t1'), true);
  });
  it('never another tournament, a look-alike slug, or a missing slug', () => {
    assert.equal(on('/riverdale/summer-classic-2/schedule'), false);
    assert.equal(on('/riverdale/fall-classic/schedule'), false);
    assert.equal(pageCarriesTicker('/riverdale/summer-classic/schedule', 'riverdale', ''), false);
  });
});
