import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { previewNote, previewStateOf } from '../../lib/tryout-blurb-preview.ts';

/**
 * "How families see it" beside the tryout blurb box (drawn and ruled 2026-10-22, TRYOUT_BLURB_PREVIEW_MOCKUP.html): the
 * state it draws follows the public page's one rule, the line under it appears only where the picture cannot say it, and
 * the preview wears the club's colours without ever becoming a club page.
 */
describe('the state the preview draws', () => {
  it('an open sign-up switch is the open page, whatever else is known', () => {
    assert.equal(previewStateOf(true, null), 'open');
    assert.equal(previewStateOf(true, 0), 'open');
  });
  it('switch off with a tryout day still ahead is "not open yet"', () => {
    assert.equal(previewStateOf(false, 2), 'notOpenYet');
  });
  it('switch off with no day ahead is closed (a finished tryout reads the same: the words are hidden in both)', () => {
    assert.equal(previewStateOf(false, 0), 'closed');
  });
  it('draws nothing until the days are known, rather than the wrong page', () => {
    assert.equal(previewStateOf(false, null), null);
  });
});

describe('the line under the preview', () => {
  it('closed: one amber sentence, whatever is typed', () => {
    assert.deepEqual(previewNote('closed', 'Open to players born 2012.'), { words: 'Families don’t see your words right now.', warn: true });
  });
  it('an empty box says the section is simply absent, in the quiet ink', () => {
    const n = previewNote('open', '   ');
    assert.equal(n?.warn, false);
    assert.match(n!.words, /without a “From the club” section/);
    assert.ok(previewNote('notOpenYet', ''));
  });
  it('words written on an open or not-open-yet page need no line: the picture shows them', () => {
    assert.equal(previewNote('open', 'Bring a glove.'), null);
    assert.equal(previewNote('notOpenYet', 'Bring a glove.'), null);
  });
});

describe('the preview wears the club\'s tokens, not the page frame', () => {
  const css = readFileSync('components/public/ClubFrame.module.css', 'utf8');
  const view = readFileSync('components/rep-teams/TryoutLandingView.tsx', 'utf8');
  const preview = readFileSync('components/admin/kit/club/TryoutBlurbPreview.tsx', 'utf8');
  it('the tokens are one scope shared by the frame and the preview, and each face rule covers both', () => {
    assert.match(css, /\.site,\s*\.tokens \{/);
    assert.match(css, /\.site\[data-club-face='dm-serif'\],\s*\.tokens\[data-club-face='dm-serif'\]/);
    assert.match(css, /\.site\[data-club-face='inter'\],\s*\.tokens\[data-club-face='inter'\]/);
  });
  it('only `.site` paints the body and fills the screen: the admin page around the preview keeps its own ground', () => {
    assert.match(css, /:global\(body\):has\(\.site\) \{/);
    assert.doesNotMatch(css, /:has\(\.tokens\)/);
    const site = css.slice(css.indexOf('\n.site {'));
    assert.match(site, /min-height: 100dvh/);
    assert.doesNotMatch(css.slice(0, css.indexOf('\n.site {')), /min-height: 100dvh/);
  });
  it('the preview is the real page, inert, with no way back and no use of `.site`', () => {
    assert.match(preview, /<TryoutLandingView\s+preview\b/);
    assert.match(preview, /\binert\b/);
    assert.match(preview, /frameStyles\.tokens/);
    assert.doesNotMatch(preview, /frameStyles\.site/);
    assert.match(view, /\{!preview && \(\s*<Link href=\{teamHref\}/);
  });
});
