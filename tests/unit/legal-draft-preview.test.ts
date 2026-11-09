import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterDraftForPreview, TO_BE_FILLED_HREF } from '../../lib/legal-draft-filter.ts';
import { LEGAL_DOCUMENTS, LEGAL_DOC_KEYS } from '../../lib/legal-documents.ts';
import { filterMarkers } from './_legal-markers.ts';
import { readCode, readSource } from './_source-code.ts';

/**
 * THE DEV PREVIEW SHOWS THE /legal DRAFT, FILTERED OF EVERY OWNER NOTE (GST/HST Stage 6 step 6.2, ruling Q1). The test on the
 * REAL drafts is the safety net: if a draft trips it, the fix is a `/legal` edit to the draft, never a wider filter.
 */
describe('the filter on the real drafts', () => {
  for (const doc of LEGAL_DOC_KEYS) {
    const out = filterDraftForPreview(readSource(LEGAL_DOCUMENTS[doc].draftPath));

    it(`${doc}: no owner note reaches the preview`, () => {
      assert.deepEqual(filterMarkers(out), []);
    });

    it(`${doc}: no blockquote survives, and the text starts at the first numbered section`, () => {
      assert.equal(out.split('\n').some(l => l.startsWith('>')), false);
      assert.match(out, /^## 1\. /);
    });

    it(`${doc}: nothing from the owner-only tail or the product-copy subsection survives`, () => {
      assert.equal(out.includes('Before this can be published'), false);
      assert.equal(out.includes('The words the product shows'), false);
      assert.equal(out.includes('For a lawyer'), false);
    });

    it(`${doc}: a blank fact is a marked link, never a bare [bracket]`, () => {
      assert.equal(/\[[^\]\n]+\](?!\()/.test(out.replace(/\\[[\]]/g, '')), false);
    });
  }
});

describe('each rule, on a small fixture', () => {
  const draft = [
    '# TITLE — DRAFT',
    '',
    '| | |',
    '|---|---|',
    '',
    '---',
    '',
    '## 1. First',
    '',
    'Call **[phone]** or write to [mailing address].',
    '',
    '> NOTE — an owner aside',
    '> that runs on.',
    '',
    'Kept text with a [link](/privacy).',
    '',
    '> NOTES —',
    '> 1. another',
    '',
    '> A real quotation stays.',
    '',
    '## 2. Second',
    '',
    'Second text.',
    '',
    '### The words the product shows',
    '',
    'product copy',
    '',
    '## 3. Third',
    '',
    'Back to text.',
    '',
    '---',
    '',
    '## Before this can be published (owner)',
    '',
    'owner list',
    '',
    '---',
    '',
  ].join('\n');
  const out = filterDraftForPreview(draft);

  it('rule 1: drops everything through the first bare ---', () => {
    assert.equal(out.includes('TITLE'), false);
    assert.equal(out.includes('|---|'), false);
    assert.match(out, /^## 1\. First/);
  });
  it('rule 2: drops NOTE and NOTES blockquote blocks whole, keeps a real quotation', () => {
    assert.equal(out.includes('owner aside'), false);
    assert.equal(out.includes('that runs on'), false);
    assert.equal(out.includes('another'), false);
    assert.ok(out.includes('> A real quotation stays.'));
  });
  it('rule 3: drops the product-copy subsection up to the next heading, keeps what follows', () => {
    assert.equal(out.includes('product copy'), false);
    assert.ok(out.includes('Second text.'));
    assert.ok(out.includes('## 3. Third'));
    assert.ok(out.includes('Back to text.'));
  });
  it('rule 4: drops "Before this can be published" to the end, and the trailing rule', () => {
    assert.equal(out.includes('owner list'), false);
    assert.equal(out.trimEnd().endsWith('Back to text.'), true);
  });
  it('rule 5: a [fact] that is not a link becomes the to-be-filled mark; real links are untouched', () => {
    assert.ok(out.includes(`[\\[phone — to be filled\\]](${TO_BE_FILLED_HREF})`));
    assert.ok(out.includes(`[\\[mailing address — to be filled\\]](${TO_BE_FILLED_HREF})`));
    assert.ok(out.includes('[link](/privacy)'));
  });
  it('is stable on CRLF input', () => {
    assert.equal(filterDraftForPreview(draft.replace(/\n/g, '\r\n')), out);
  });
});

describe('the reader never touches the file system unless the preview is on', () => {
  const code = readCode('lib/legal-draft-preview.ts');
  it('checks the mode before reading', () => {
    const modeAt = code.indexOf("legalPagesMode(env) !== 'preview'");
    const readAt = code.indexOf('readFileSync(path.join');
    assert.ok(modeAt > 0 && readAt > modeAt, 'the mode check must come before the read');
    assert.match(code.slice(modeAt, readAt), /return null/);
  });
});
