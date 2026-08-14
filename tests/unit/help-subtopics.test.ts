import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveSectionId,
  resolveSubtopicId,
  type HelpSection,
  type HelpSubtopic,
} from '../../lib/help-content/index.ts';

// The scannable-format standard (2026-08-14) hangs deep links, jump chips, and the
// drawer expanders off ONE id resolver, shared by the guide and the drawer. These
// tests pin the resolver so a refactor can't silently re-anchor published support
// links (`#premium-money-cards` in an email must keep resolving forever).

function subtopic(overrides: Partial<HelpSubtopic>): HelpSubtopic {
  return { title: 'Recording payments', content: null, ...overrides };
}

describe('resolveSubtopicId', () => {
  it('prefers an explicit id verbatim', () => {
    assert.equal(
      resolveSubtopicId('premium-money', subtopic({ id: 'premium-money-cards' }), 0),
      'premium-money-cards',
    );
  });

  it('falls back to a section-prefixed title slug WITH the index folded in', () => {
    assert.equal(
      resolveSubtopicId('premium-money', subtopic({ title: 'Recording payments' }), 3),
      'premium-money-t-recording-payments-4',
    );
  });

  it('slugs punctuation and ampersands the way section ids do', () => {
    assert.equal(
      resolveSubtopicId('premium-money', subtopic({ title: 'Imports, exports & templates!' }), 0),
      'premium-money-t-imports-exports-templates-1',
    );
  });

  it('falls back to a placeholder slug when a title slugs to nothing', () => {
    assert.equal(resolveSubtopicId('premium-money', subtopic({ title: '???' }), 2), 'premium-money-t-topic-3');
  });

  it('two subtopics with IDENTICAL titles never share an anchor', () => {
    const first = resolveSubtopicId('premium-money', subtopic({ title: 'Payments' }), 0);
    const second = resolveSubtopicId('premium-money', subtopic({ title: 'Payments' }), 1);
    assert.notEqual(first, second);
  });

  it('titles that slug identically never share an anchor', () => {
    const first = resolveSubtopicId('s', subtopic({ title: 'Refunds (players)' }), 0);
    const second = resolveSubtopicId('s', subtopic({ title: 'Refunds — players' }), 1);
    assert.notEqual(first, second);
  });

  it('cannot collide with the parent section id or FAQ ids', () => {
    const id = resolveSubtopicId('premium-money', subtopic({ title: 'faq 1' }), 0);
    assert.notEqual(id, 'premium-money');
    assert.ok(id.startsWith('premium-money-t-'));
  });
});

describe('subtopic ids stay unique within a section', () => {
  it('distinct titles resolve to distinct anchors', () => {
    const section: HelpSection = {
      id: 'premium-money',
      heading: 'Managing your team’s money',
      content: null,
      subtopics: [
        subtopic({ title: 'The season dashboard' }),
        subtopic({ title: 'Player dues & recording payments' }),
        subtopic({ title: 'Payables & the payment schedule' }),
      ],
    };
    const sectionId = resolveSectionId(section, 0);
    const ids = (section.subtopics ?? []).map((t, i) => resolveSubtopicId(sectionId, t, i));
    assert.equal(new Set(ids).size, ids.length);
  });
});
