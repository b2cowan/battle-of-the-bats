import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HelpSection } from '../../lib/help-content/index.ts';
import {
  buildHelpArticles,
  buildHelpHashIndex,
  findNeighbours,
  answersOf,
} from '../../lib/help-content/articles.ts';

/**
 * The article model is what every deep link in the product resolves through —
 * ~102 anchored links across 56 files, plus nine Money screens that target their
 * own sub-topic. The property that matters is that a hash which worked when the
 * guide was one long page still names the right article now, so these tests pin
 * the ids rather than the rendering.
 */

// Content is a ReactNode; these tests never render, so a string stands in.
const sections: HelpSection[] = [
  {
    id: 'plain-topic',
    group: 'Getting started',
    heading: 'A topic with no sub-topics',
    content: 'body',
    faqs: [{ id: 'faq-plain', question: 'Q?', answer: 'A' }],
  },
  {
    id: 'premium-money',
    group: 'Premium',
    heading: 'Managing your team’s money',
    content: 'overview',
    subtopics: [
      { id: 'premium-money-cards', title: 'The season dashboard: three cards', content: 'a' },
      { id: 'premium-money-dues', title: 'Player dues & recording payments', content: 'b' },
      { title: 'A sub-topic with no explicit id', content: 'c' },
    ],
    faqs: [{ question: 'Where do I start?', answer: 'Here' }],
  },
  {
    id: 'hidden-topic',
    group: 'Premium',
    heading: 'Hidden from the contents list',
    hideFromContents: true,
    content: 'body',
  },
];

describe('help articles — the guide as a set of pages', () => {
  test('a section with sub-topics becomes a topic page plus one article per answer', () => {
    const articles = buildHelpArticles(sections);
    const ids = articles.map(a => a.id);

    assert.deepEqual(ids, [
      'plain-topic',
      'premium-money',
      'premium-money-cards',
      'premium-money-dues',
      'premium-money-t-a-sub-topic-with-no-explicit-id-3',
      'hidden-topic',
    ]);

    assert.equal(articles[0].kind, 'section');
    assert.equal(articles[1].kind, 'topic');
    assert.equal(articles[2].kind, 'answer');
  });

  test('an answer carries its place in the topic, for the "5 / 11" cue', () => {
    const articles = buildHelpArticles(sections);
    const dues = articles.find(a => a.id === 'premium-money-dues')!;

    assert.equal(dues.positionInTopic, 2);
    assert.equal(dues.topicSize, 3);
    assert.equal(dues.sectionHeading, 'Managing your team’s money');
  });

  test('a hidden section is still an addressable article', () => {
    const articles = buildHelpArticles(sections);
    const hidden = articles.find(a => a.id === 'hidden-topic')!;

    assert.equal(hidden.hideFromContents, true);
    assert.equal(hidden.kind, 'section');
  });

  test('every anchor the single-scroll guide answered to still resolves', () => {
    const index = buildHelpHashIndex(sections);

    // A section link lands on its topic page.
    assert.deepEqual(index.get('premium-money'), { articleId: 'premium-money' });
    // A sub-topic link lands on that answer — the case the 9 Money screens use.
    assert.deepEqual(index.get('premium-money-dues'), { articleId: 'premium-money-dues' });
    // A FAQ link lands on the owning section, with the question to open.
    assert.deepEqual(index.get('faq-plain'), { articleId: 'plain-topic', faqId: 'faq-plain' });
    // Generated FAQ ids resolve the same way.
    assert.deepEqual(index.get('premium-money-faq-1'), {
      articleId: 'premium-money',
      faqId: 'premium-money-faq-1',
    });
  });

  test('an unknown hash resolves to nothing rather than the wrong article', () => {
    const index = buildHelpHashIndex(sections);
    assert.equal(index.get('was-never-a-thing'), undefined);
  });

  test('a page-level question resolves to the landing page, where it renders', () => {
    const pageFaqs = [{ id: 'faq-who-can-run-bulk' }, {}];
    const index = buildHelpHashIndex(sections, pageFaqs);

    // No articleId = the landing page; the question still opens.
    assert.deepEqual(index.get('faq-who-can-run-bulk'), { faqId: 'faq-who-can-run-bulk' });
    assert.deepEqual(index.get('faq-2'), { faqId: 'faq-2' });
  });

  test('a colliding id can never re-point an address that already resolved', () => {
    // Ids are hand-authored; nothing structurally stops a later FAQ being given
    // an id an earlier section already uses. The single-scroll guide scanned a
    // list front-to-back, so the earliest declaration won — a Map would hand the
    // address to the LAST writer and silently move a published support link.
    const colliding: HelpSection[] = [
      { id: 'money', heading: 'The real one', content: 'x' },
      { id: 'later', heading: 'A later section', content: 'x', faqs: [{ id: 'money', question: 'q', answer: 'a' }] },
    ];
    const index = buildHelpHashIndex(colliding);

    assert.deepEqual(index.get('money'), { articleId: 'money' }, 'the first declaration keeps the address');
  });

  test('Next steps through a topic, then rolls on to the next topic', () => {
    const articles = buildHelpArticles(sections);

    const insideTopic = findNeighbours(articles, 'premium-money-cards');
    assert.equal(insideTopic.next?.article.id, 'premium-money-dues');
    assert.equal(insideTopic.next?.sameTopic, true);
    assert.equal(insideTopic.previous?.article.id, 'premium-money');
    assert.equal(insideTopic.previous?.sameTopic, true);

    const lastAnswer = findNeighbours(articles, 'premium-money-t-a-sub-topic-with-no-explicit-id-3');
    assert.equal(lastAnswer.next?.article.id, 'hidden-topic');
    assert.equal(lastAnswer.next?.sameTopic, false);
  });

  test('the ends of the guide have no neighbour to offer', () => {
    const articles = buildHelpArticles(sections);
    assert.equal(findNeighbours(articles, 'plain-topic').previous, undefined);
    assert.equal(findNeighbours(articles, 'hidden-topic').next, undefined);
    assert.deepEqual(findNeighbours(articles, 'not-an-article'), {});
  });

  test('no guide declares the same id twice', () => {
    // The collision guard above keeps a duplicate from MOVING a published link,
    // but a duplicate still leaves the newcomer unreachable and can make an
    // answer render its namesake's body. Cheaper to forbid them outright: this
    // reads the guide sources directly, because the content modules are .tsx and
    // cannot be imported by this runner.
    const dir = join(process.cwd(), 'lib', 'help-content');
    const offenders: string[] = [];

    for (const file of readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
      const source = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const seen = new Set<string>();
      for (const match of source.matchAll(/^\s*id:\s*'([^']+)'/gm)) {
        if (seen.has(match[1])) offenders.push(`${file}: ${match[1]}`);
        seen.add(match[1]);
      }
    }

    assert.deepEqual(offenders, [], 'duplicate help ids');
  });

  test('a topic knows its own answers, and a plain section has none', () => {
    const articles = buildHelpArticles(sections);

    assert.deepEqual(
      answersOf(articles, 'premium-money').map(a => a.title),
      ['The season dashboard: three cards', 'Player dues & recording payments', 'A sub-topic with no explicit id'],
    );
    assert.deepEqual(answersOf(articles, 'plain-topic'), []);
  });
});
