import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * THE "TYPE YOUR CODE AGAIN" WINDOW WEARS THE SCREEN'S THEME (owner, 2026-11-12: it opened in the OLD dark navy over
 * the warm Manage-member window).
 *
 * `CodeAgainProvider` is mounted in the ROOT layout, beside every portal, so no theme marker reaches it. The warm /
 * dark palette and the admin kit's rules hang off the shell's marker, so a window left there reads the page's base
 * colours. It must therefore be drawn inside the open shell (or carry the marker itself where none is open).
 */
const provider = readCode('components/shared/CodeAgainProvider.tsx');

describe('the code-again window and its theme', () => {
  it('finds the open shell: the admin kit first, then the coaches marker, and carries the marker itself otherwise', () => {
    assert.match(provider, /document\.querySelector\('#main-content \[data-admin-kit\]'\)\s*\?\?\s*document\.querySelector\('#main-content \[data-coach-warm-enabled\]'\)/,
      'the host is the admin / volunteer shell, else the coaches shell — inside <main>, never a body-level panel\'s wrapper');
    assert.match(provider, /createPortal\(children, host\)/, 'with a shell open, the window is drawn inside it');
    assert.match(provider, /<div style=\{\{ display: 'contents' \}\} \{\.\.\.coachWarmAttr\}>/,
      'with no shell open, the window carries the coach marker so the Warm / Dark setting still decides');
  });

  it('never renders the window or the set-up notice outside that wrapper', () => {
    const body = provider.slice(provider.indexOf('export default function CodeAgainProvider'));
    // Strip every <InTheme>…</InTheme> span; nothing themed may be left over.
    const outside = body.replace(/<InTheme>[\s\S]*?<\/InTheme>/g, '');
    assert.doesNotMatch(outside, /<CodeAgainWindow\b/, 'the window sits inside <InTheme>');
    assert.doesNotMatch(outside, /styles\.setUpNotice/, 'the set-up notice sits inside <InTheme>');
    assert.equal((body.match(/<InTheme>/g) ?? []).length, 2, 'the window and the set-up notice are the two wrapped pieces');
  });
});
