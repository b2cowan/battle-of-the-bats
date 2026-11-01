import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FOCUSED_SECTIONS, isFocusedPublicPage } from '../../lib/public-focused-page.ts';
import { pageCarriesTicker, TICKER_PAGES } from '../../lib/public-ticker-pages.ts';
import { readCode, filesUnder } from './_source-code.ts';

/**
 * The focused page (Stage 7, Ask 6): the team pay page wears no event chrome. ONE rule says which page that is
 * (lib/public-focused-page.ts); every chrome piece asks it, so none of them names `pay` itself.
 */
describe('the focused page — one rule', () => {
  const focused = (path: string) => isFocusedPublicPage(path, 'riverdale', 'summer-classic');

  it('is the team pay page, with or without a trailing slash', () => {
    assert.equal(focused('/riverdale/summer-classic/pay/abc.def'), true);
    assert.equal(focused('/riverdale/summer-classic/pay/abc.def/'), true);
  });

  it('is no other page, no other tournament and no look-alike', () => {
    for (const p of ['', '/schedule', '/schedule/g1', '/teams/pay', '/register', '/pay']) {
      assert.equal(focused(`/riverdale/summer-classic${p}`), false, p || 'the Overview');
    }
    assert.equal(focused('/riverdale/summer-classic-2/pay/abc'), false);
    assert.equal(focused('/riverdale/fall-classic/pay/abc'), false);
    assert.equal(isFocusedPublicPage('/riverdale/summer-classic/pay/abc', 'riverdale', ''), false);
  });

  it('a focused page never carries today\'s games line', () => {
    for (const s of FOCUSED_SECTIONS) {
      assert.ok(!(TICKER_PAGES as readonly string[]).includes(s), `${s} is focused and on the ticker list`);
      assert.equal(pageCarriesTicker(`/riverdale/summer-classic/${s}/abc`, 'riverdale', 'summer-classic'), false, s);
    }
  });

  it('no chrome piece hard-codes the pay page instead of asking the rule', () => {
    // A public client piece that tests the path for `/pay` decides the focused page on its own, and drifts the day a
    // second focused page is added. The pay page's own folder, its content and the link builder legitimately say it.
    const offenders = [...filesUnder('components/public', '.tsx'), ...filesUnder('components/public', '.ts')]
      .filter((f) => !/TeamPay|PayBlock/.test(f))
      // `/api/pay/…` is a fetch, not a page test.
      .filter((f) => /(?<!\/api)\/pay(?=['"`/])/.test(readCode(f)) && /usePublicPathname|usePathname/.test(readCode(f)));
    assert.deepEqual(offenders, []);
  });
});

/**
 * Part 2: the focused page as built. The layout wraps every piece that goes away there in the one gate, under the frame
 * only; the band and the footer change shape by asking the same rule; the pay page decides "focused" from the switch.
 */
describe('the focused page — the chrome asks the rule', () => {
  const layout = readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx');

  it('the gate asks the rule and nothing else', () => {
    const gate = readCode('components/public/NotOnFocusedPage.tsx');
    assert.match(gate, /isFocusedPublicPage\(pathname, orgSlug, tournamentSlug\) \? null/);
  });

  it('the layout gates only under the frame', () => {
    assert.match(layout, /const unlessFocused = \(node: React\.ReactNode\) => \(frameOn\s*\? <NotOnFocusedPage/);
  });

  it('every piece that goes away on the focused page is wrapped in the frame-on branch', () => {
    for (const piece of ['TournamentSideRail publicFrame', 'PublicAppOnly><MyTeamDock', 'PublicAppOnly><FollowDeepLinkPrompt',
      'PublicAppOnly><FollowAccountNudge', 'PublicAppOnly><AccountFollowSync']) {
      assert.ok(layout.includes(`unlessFocused(<${piece}`), `${piece} is not gated`);
    }
    assert.match(layout, /unlessFocused\(\s*<AlertsNudge/);
    assert.match(layout, /unlessFocused\(\s*<InstallAppPrompt/);
    assert.match(layout, /\{unlessFocused\(growthChrome\)\}<div className=\{`\$\{clubFrameStyles\.tokens\}/);
    // Switch off keeps today's markup: the off branch of the dock and the follow prompt is not wrapped.
    assert.match(layout, /\) : <MyTeamDock\s+orgSlug/);
    assert.match(layout, /\{!frameOn && growthChrome\}/);
  });

  it('the band and the footer change shape by the rule, never in the admin preview', () => {
    const band = readCode('components/public/TournamentBand.tsx');
    assert.match(band, /const focused = !preview && isFocusedPublicPage\(pathname, orgSlug, tournamentSlug\)/);
    assert.match(band, /data-public-frame-focused-band=""/);
    const foot = readCode('components/public/TournamentFooter.tsx');
    assert.match(foot, /const short = !basePath && isFocusedPublicPage\(pathname, orgSlug, tournamentSlug\)/);
    // A5: the short footer's credit is every plan's but the demo's (a free event wears no badge there).
    assert.match(foot, /\{!isDemoOrgSlug\(orgSlug\) && <BuiltOnCredit className=\{clubStyles\.credit\} \/>\}/);
  });

  it('the pay page reads "frame on" as "focused" only because its section is the focused one', () => {
    // The content side (heading, contact line, no page floor) keys on the switch; the chrome keys on the rule. They
    // agree only while the pay route is a focused section — the day it is not, this fails before they disagree.
    assert.ok((FOCUSED_SECTIONS as readonly string[]).includes('pay'));
    assert.equal(isFocusedPublicPage('/o/t/pay/abc', 'o', 't'), true);
  });

  it('the pay page is focused only with the switch on, and only then looks up the contact', () => {
    const page = readCode('app/[orgSlug]/[tournamentSlug]/pay/[token]/page.tsx');
    assert.match(page, /const focused = await isPublicFrameOn\(\)/);
    assert.match(page, /focused \? addressContact\(orgSlug, tournamentSlug\)/);
    const content = readCode('components/public/TeamPayContent.tsx');
    // A1 / A2: no contact line on clearing (its own sentence names the club) or under another tournament's address.
    assert.match(content, /focused && contactEmail && view\.kind !== 'clearing' && !view\.misaddressed/);
  });
});
