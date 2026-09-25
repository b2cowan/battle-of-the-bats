/**
 * AWARD CERTIFICATES ON PAPER (owner, 2026-09-25 — "the certificate printing is pretty awful").
 *
 * Two certificates printed on FOUR sheets: the page sits inside the coaches portal's shell, its print
 * rules only hid its own toolbar, so the sidebar and team header printed alone on sheet one, the
 * shell's header ran across the top of every sheet (cutting off the frame's top edge), each
 * certificate was pushed right by the sidebar's width, and a blank sheet came last. The fix hands
 * the paper a COPY of the certificates portalled onto <body>, and hides every other child of
 * <body> in print — so no shell ruling can put the portal back on the paper. This pins that shape.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');
const DIR = 'app/[orgSlug]/coaches/teams/[teamId]/history/awards/certificate';
const page = read(`${DIR}/page.tsx`);
const css = read(`${DIR}/certificate.module.css`);

describe('award certificates print one to a sheet, and nothing else reaches the paper', () => {
  it('the certificates are copied straight onto <body> for print, in the browser only', () => {
    assert.match(page, /createPortal\(\s*<div className=\{cert\.printCopy\} data-certificate-print>/);
    assert.match(page, /document\.body,\s*\)\}/);
    assert.match(page, /useSyncExternalStore\(noSubscribe, \(\) => true, \(\) => false\)/, 'no portal during the server render');
  });

  it('in print, every other child of <body> leaves the page — the shell is never chased by its classes', () => {
    assert.match(css, /:global\(body\):has\(> \.printCopy\) > :global\(\*\):not\(\.printCopy\) \{ display: none !important; \}/);
    assert.match(css, /\.printCopy \{ display: none; \}/, 'the copy is hidden on screen');
  });

  /* "do we need these?" (owner, 2026-09-25) — the browser prints its own date, title, address and page
     number in the page MARGIN; a page with no margin gives it nowhere to put them. The printer's margin
     lives inside the sheet as padding instead. */
  it('the page has NO margin (no browser header/footer); the sheet pads itself clear of the paper edge', () => {
    assert.match(page, /@page \{ size: 11in 8\.5in; margin: 0; \}/);
    assert.match(page, /<div key=\{a\.id\} className=\{cert\.printPage\}>\{sheet\(a\)\}<\/div>/);
    const print = css.slice(css.indexOf('@media print {'));
    assert.match(print, /\.printCopy \.printPage \{[\s\S]*?width: 11in;[\s\S]*?height: 8\.45in;[\s\S]*?padding: 0\.35in;[\s\S]*?break-after: page;[\s\S]*?break-inside: avoid;/);
    assert.match(print, /\.printCopy \.printPage:last-child \{ break-after: auto; \}/, 'no blank sheet after the last certificate');
  });

  it('the frame is a border, so the "turn on background graphics" note is gone for good', () => {
    // the sentence a coach could read — the comment recording why it went may still name it
    assert.doesNotMatch(page, /Turn on background graphics in your/);
    assert.doesNotMatch(page, /cert\.barNote/);
    assert.doesNotMatch(css, /\.barNote/);
  });

  it('the date is the house formatter\'s, never the browser locale ("May 14", never "14 May")', () => {
    assert.match(page, /formatStoredDate\(a\.awardedAt, \{ withYear: false, longMonth: true \}\)/);
    assert.doesNotMatch(page, /formatShortDate|toLocaleDateString/);
  });
});
