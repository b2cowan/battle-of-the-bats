import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  LEGAL_DOCUMENTS, LEGAL_DOC_KEYS, isVersionDate, isPublishedVersion, publishedFilePath, publishedVersions, versionSpan,
} from '../../lib/legal-documents.ts';
import { LEGAL_PAGES_PUBLISHED } from '../../lib/legal-pages-switch.ts';
import { filterMarkers } from './_legal-markers.ts';
import { readSource, sourceExists } from './_source-code.ts';

/**
 * A PUBLISHED LEGAL VERSION IS FROZEN BY THE BUILD (GST/HST Stage 6 step 6.2, ruling Q1). Every `published` entry names a dated
 * file whose sha256 (CRLF normalized to LF) is recorded; an edit fails here. Nothing is published yet, so most of this holds
 * vacuously today and starts biting at step 6.7.
 */
const REPO = path.join(import.meta.dirname, '..', '..');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

describe('the registry', () => {
  for (const doc of LEGAL_DOC_KEYS) {
    const entry = LEGAL_DOCUMENTS[doc];

    it(`${doc}: the draft file exists`, () => {
      assert.ok(sourceExists(entry.draftPath), entry.draftPath);
    });

    it(`${doc}: every published version is a dated, frozen file`, () => {
      for (const p of entry.published) {
        assert.ok(isVersionDate(p.version), `${p.version} is not YYYY-MM-DD`);
        const file = publishedFilePath(doc, p.version);
        assert.ok(sourceExists(file), `${file} is missing`);
        assert.equal(sha(readSource(file)), p.sha256, `${file} was edited — a published version is frozen; publish a new dated version instead`);
      }
    });

    it(`${doc}: every file in the versions folder is listed`, () => {
      const dir = path.join(REPO, 'lib', 'legal-documents', doc);
      if (!existsSync(dir)) return;
      const onDisk = readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
      for (const v of onDisk) assert.ok(isPublishedVersion(doc, v), `${doc}/${v}.md is on disk but not listed in the registry`);
    });

    it(`${doc}: oldestAccepted is not newer than current, and both are listed versions`, () => {
      assert.equal(entry.current === null, entry.oldestAccepted === null, 'current and oldestAccepted are set together');
      if (entry.current === null || entry.oldestAccepted === null) return;
      assert.ok(isPublishedVersion(doc, entry.current), 'current is not a published version');
      assert.ok(isPublishedVersion(doc, entry.oldestAccepted), 'oldestAccepted is not a published version');
      assert.ok(entry.oldestAccepted <= entry.current, 'oldestAccepted is newer than current');
    });

    it(`${doc}: a published file carries no owner note and no unfilled [bracket] fact`, () => {
      for (const p of entry.published) {
        const text = readSource(publishedFilePath(doc, p.version));
        assert.deepEqual(filterMarkers(text), [], `${doc}/${p.version}.md carries an owner note`);
        assert.equal(/\[[^\]\n]+\](?!\()/.test(text), false, `${doc}/${p.version}.md has a still-blank [bracket] fact`);
      }
    });
  }

  it('when the pages are published, both documents have a listed current and oldestAccepted', () => {
    if (!LEGAL_PAGES_PUBLISHED) return;
    for (const doc of LEGAL_DOC_KEYS) {
      const e = LEGAL_DOCUMENTS[doc];
      assert.ok(e.current && isPublishedVersion(doc, e.current), `${doc} has no published current version`);
      assert.ok(e.oldestAccepted && isPublishedVersion(doc, e.oldestAccepted), `${doc} has no oldestAccepted`);
    }
  });

  it('no /legal placeholder is left in the page words', () => {
    assert.equal(/TODO\(\/legal\)/.test(readSource('lib/legal-words.ts')), false);
  });
});

describe('versionSpan: the last day an earlier version applied is the day before the next one', () => {
  it('computes the span from the published list (fixture, not the registry)', () => {
    const saved = LEGAL_DOCUMENTS.terms.published;
    LEGAL_DOCUMENTS.terms.published = [
      { version: '2027-03-01', sha256: 'x' },
      { version: '2027-09-01', sha256: 'y' },
      { version: '2028-01-01', sha256: 'z' },
    ];
    try {
      assert.deepEqual(publishedVersions('terms'), ['2028-01-01', '2027-09-01', '2027-03-01']);
      assert.deepEqual(versionSpan('terms', '2027-03-01'), { from: '2027-03-01', to: '2027-08-31' });
      assert.deepEqual(versionSpan('terms', '2027-09-01'), { from: '2027-09-01', to: '2027-12-31' });
      assert.deepEqual(versionSpan('terms', '2028-01-01'), { from: '2028-01-01', to: null });
      assert.equal(versionSpan('terms', '1999-01-01'), null);
    } finally {
      LEGAL_DOCUMENTS.terms.published = saved;
    }
  });
});
