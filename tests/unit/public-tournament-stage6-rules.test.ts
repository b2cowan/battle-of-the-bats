import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader as componentLoader } from './_billing-test-loader.ts';
import { between, readCode, readSource, sourceExists } from './_source-code.ts';
import { visibleTournamentTabs } from '../../lib/tournament-page-tabs.ts';
import type PublicRules from '../../components/public/PublicRules.tsx';
import type PublicDisclosure from '../../components/public/PublicDisclosure.tsx';

const load = componentLoader({
  '@/lib/org-links': { orgLinks: async () => (path: string) => `/club${path}` },
  'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
});
const { default: Rules } = load('components/public/PublicRules.tsx') as { default: typeof PublicRules };
const { default: Disclosure } = load('components/public/PublicDisclosure.tsx') as { default: typeof PublicDisclosure };
type Props = Parameters<typeof PublicRules>[0];
const rule = (title: string, divisionIds?: string[]) => ({
  id: title, title, tournamentId: 't', order: 0, divisionIds,
  items: [{ id: 'item', ruleId: title, order: 0, content: `${title}: original text <unchanged>` }],
});
const props = (extra: Partial<Props> = {}): Props => ({
  orgSlug: 'club', tournamentSlug: 'cup', pageEnabled: true, prefName: null, contactEmail: null,
  rules: [rule('Game length'), rule('Weather and delays')], resources: [], divisions: [], ...extra,
});
const render = async (p: Props) => renderToStaticMarkup(await Rules(p));

describe('Stage 6 Part 2: Rules renders the original content inside the preview frame', () => {
  it('hidden and empty direct links render the established state without rules or downloads', async () => {
    const hidden = await render(props({ pageEnabled: false }));
    assert.match(hidden, /Rules unavailable/);
    assert.doesNotMatch(hidden, /original text|aria-expanded/);
    const empty = await render(props({ rules: [] }));
    assert.match(empty, /Rules coming soon/);
    assert.doesNotMatch(empty, /aria-expanded/);
  });
  it('keeps every rule item, escapes it as text and starts all sections closed', async () => {
    const html = await render(props());
    assert.match(html, /Game length: original text &lt;unchanged&gt;/);
    assert.match(html, /Weather and delays: original text &lt;unchanged&gt;/);
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 2);
    assert.match(html, /id="rule-game-length"/);
    assert.match(html, /Copy a link to Game length/);
  });
  it('keeps the division preference and view=all escape hatch without applying the schedule publish gate', async () => {
    const tagged = props({
      rules: [rule('All divisions'), rule('U11 rule', ['u11']), rule('U13 rule', ['u13'])], prefName: 'U11',
      divisions: [{ id: 'u11', name: 'U11' }, { id: 'u13', name: 'U13' }] as Props['divisions'],
    });
    const filtered = await render(tagged);
    assert.match(filtered, /U11 rule: original/);
    assert.match(filtered, /All divisions: original/);
    assert.doesNotMatch(filtered, /U13 rule: original/);
    assert.match(filtered, /\/club\/cup\/rules\?view=all/);
    assert.match(await render({ ...tagged, view: 'all' }), /U13 rule: original/);
    assert.doesNotMatch(readCode('components/public/PublicRules.tsx'), /onlyPublished|schedulePublished/);
  });
  it('puts resources last and also supports a resources-only Rules page', async () => {
    const resources = [{ id: 'pdf', tournamentId: 't', order: 0, label: 'Conduct PDF', url: 'https://example.test/conduct.pdf' }];
    const html = await render(props({ resources }));
    assert.ok(html.indexOf('Downloads &amp; Resources') > html.indexOf('Weather and delays: original'));
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    const only = await render(props({ rules: [], resources }));
    assert.doesNotMatch(only, /Rules coming soon/);
    assert.match(only, /Conduct PDF/);
  });
  it('has no copy, download or email action in the admin preview', async () => {
    const html = await render(props({ isPreview: true, contactEmail: 'public@example.test',
      resources: [{ id: 'pdf', tournamentId: 't', order: 0, label: 'Conduct PDF', url: 'https://example.test/conduct.pdf' }],
    }));
    assert.match(html, /Conduct PDF/);
    assert.doesNotMatch(html, /Copy a link|mailto:|href="https:/);
  });
  it('sends only public section text and resource links to the interactive list', async () => {
    const tree = await Rules(props()) as ReactElement<{ children: ReactNode[] }>;
    const list = tree.props.children.at(-1) as ReactElement<{ sections: Record<string, unknown>[] }>;
    assert.deepEqual(Object.keys(list.props.sections[0]).sort(), ['anchor', 'icon', 'items', 'title']);
  });
  it('has no jump pills, keeps a shared single-open state and initial/hash-change section reveal', () => {
    const code = readCode('components/public/PublicRuleSections.tsx');
    assert.match(code, /open=\{openAnchor === section.anchor\}/);
    assert.match(code, /modalOnDesktop/);
    assert.match(code, /window\.addEventListener\('hashchange', revealHash\)/);
    assert.match(code, /revealHash\(\);/);
    assert.match(code, /url\.searchParams\.set\('view', 'all'\)/);
    const css = readSource('components/public/PublicRules.module.css');
    // The rows are the one way in; a second row of pills opened the same windows (owner 2026-11-01).
    assert.doesNotMatch(code, /Jump to a rules section/);
    assert.doesNotMatch(css, /\.jump/);
  });
});

describe('PublicDisclosure keeps existing consumers and accepts the Rules group state', () => {
  const html = (extra: Partial<Parameters<typeof PublicDisclosure>[0]>) => renderToStaticMarkup(createElement(
    Disclosure as ComponentType<Omit<Parameters<typeof PublicDisclosure>[0], 'children'>>, { title: 'A section', ...extra }, 'Original text',
  ));
  it('keeps the closed and opened-in-place modes, and a deep link opens a section through the controlled `open` prop (Part 3: `reveal` and `desktopOpen` are gone)', () => {
    assert.match(html({}), /aria-expanded="false"/);
    assert.match(html({ open: true }), /aria-expanded="true"/);
    assert.match(html({ open: true }), /data-open="true"/);
    const source = readCode('components/public/PublicDisclosure.tsx');
    assert.doesNotMatch(source, /reveal|desktopOpen|data-desktop-open/);
    // Rules opens the deep-linked section from its hash by controlling open (PublicRuleSections).
    assert.match(readCode('components/public/PublicRuleSections.tsx'), /open=\{openAnchor === section\.anchor\}/);
  });
  it("is a list of one by itself, and one item of the caller's list when joined, with an optional anchor", () => {
    assert.match(html({}), /^<div class="list"><section class="item">/);
    assert.match(html({ joined: true, id: 'rule-x' }), /^<section id="rule-x" class="item">/);
    assert.doesNotMatch(html({ joined: true }), /class="list"/);
  });
  it('lets a group override the internal state in either direction', () => {
    assert.match(html({ open: true }), /aria-expanded="true"/);
    assert.match(html({ open: false }), /aria-expanded="false"/);
  });
});

describe('News/Rules tab decisions agree on every navigation surface', () => {
  for (const hasNews of [false, true]) for (const hasRules of [false, true]) {
    it(`independently follows content: news=${hasNews}, rules=${hasRules}`, () => {
      const keys = visibleTournamentTabs([], true, { hasNews, hasRules, registrationOpen: false, hasChampion: false }).map(t => t.key);
      assert.equal(keys.includes('news'), hasNews);
      assert.equal(keys.includes('rules'), hasRules);
      assert.ok(keys.includes('playoffs'));
      const hidden = visibleTournamentTabs(['news', 'rules'], false, { hasNews, hasRules, registrationOpen: false, hasChampion: false });
      assert.ok(hidden.every(t => t.key !== 'news' && t.key !== 'rules'));
    });
  }
  it('all three frame renderers pass content to the shared list; the Navbar has no tournament list left (Stage 8 Part 3d)', () => {
    for (const component of ['TournamentTopTabs', 'TournamentSideRail', 'TournamentFooter']) {
      assert.match(readCode(`components/public/${component}.tsx`), /visibleTournamentTabs\([^;\n]*, (?:resolvedFrameContent|frameContent)\)/);
    }
    assert.doesNotMatch(readCode('components/Navbar.tsx'), /visibleTournamentTabs|TournamentTopTabs/);
  });
  it('Rules has one body on both routes (Stage 8 Part 3a), and News keeps its existing body and direct link', () => {
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx');
    const bodies = {
      live: readCode('app/[orgSlug]/[tournamentSlug]/rules/page.tsx'),
      preview: between(preview, "if (section === 'rules')", "if (section === 'champions')"),
    };
    for (const [route, code] of Object.entries(bodies)) {
      assert.match(code, /return <PublicRules\s/, route);
      assert.doesNotMatch(code, /isPublicFrameOn|RulesContent/, route);
    }
    assert.ok(!sourceExists('components/public/RulesContent.tsx'), 'the old Rules body is back');
    assert.ok(!sourceExists('app/[orgSlug]/rules/rules.module.css'), 'the old Rules styles are back');
    const news = readCode('app/[orgSlug]/[tournamentSlug]/news/page.tsx');
    assert.match(news, /<NewsContent/);
    assert.doesNotMatch(news, /isPublicFrameOn|hasNews|frameContent/);
  });
});
