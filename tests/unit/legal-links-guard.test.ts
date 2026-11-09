import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * EVERY LEGAL LINK IS BUILT IN ONE PLACE (GST/HST Stage 6 step 6.2, Chunk 1h). A server component asks `legalPageHref`, a client
 * component asks `useLegalLinks()`; the redirects and routes ask `legalPagePath`. No other file types a `/legal` address, because
 * a hand-typed href would render with the switch off and would be a relative link that dead-ends on a club's own web address.
 */
const HOME = ['lib/legal-links.ts', 'lib/legal-paths.ts'];
const code = () => [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('lib', '.tsx'),
  ...filesUnder('components', '.ts'), ...filesUnder('components', '.tsx')].filter(f => !HOME.includes(f));

describe('no hand-typed legal address', () => {
  it('no file but the helper contains a "/legal/ or \'/legal/ or `/legal/ string', () => {
    const offenders = code().filter(f => /["'`]\/legal(?:\/|["'`])/.test(readCode(f)));
    assert.deepEqual(offenders, [], 'build legal links with legalPageHref / legalPagePath (server) or useLegalLinks() (client)');
  });

  it('the helper is where the path is built', () => {
    assert.match(readCode('lib/legal-paths.ts'), /`\/legal\/\$\{doc\}`/);
  });
});
