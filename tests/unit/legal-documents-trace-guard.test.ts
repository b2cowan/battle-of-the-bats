/**
 * THE LEGAL PAGES' TEXT MUST REACH THE DEPLOYED SERVER (release 2026-11-22, found by the layout sweep on staging).
 * `lib/legal-page-data.ts` reads each frozen document with `readFileSync(path.join(process.cwd(), publishedFilePath(...)))`, a path
 * built at request time that the build's file tracing cannot follow. Without `outputFileTracingIncludes` in next.config.ts the
 * deployed `/legal/terms` and `/legal/privacy` failed with ENOENT (HTTP 500) while every local run passed. Nothing local can show
 * it, so this test pins the three things that keep it working: the includes exist, they cover every `app/legal` route that reads
 * a document, and the read still goes through the one function the includes were written for.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import nextConfig from '../../next.config.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const LEGAL_APP = path.join(ROOT, 'app/legal');

/** Every page under app/legal, as the route it serves ('/legal/terms/[version]'). */
function legalRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) { legalRoutes(full, acc); continue; }
    if (name === 'page.tsx') {
      const rel = path.relative(path.join(ROOT, 'app'), dir).replaceAll('\\', '/');
      acc.push('/' + rel);
    }
  }
  return acc;
}

/** The includes key pattern, read the way the docs describe it: `*` is one path segment. */
function keyCovers(key: string, route: string): boolean {
  const k = key.split('/');
  const r = route.split('/');
  return k.length === r.length && k.every((seg, i) => seg === '*' || seg === r[i]);
}

describe('the legal documents are packaged for the deployed server', () => {
  const includes = (nextConfig as { outputFileTracingIncludes?: Record<string, string[]> }).outputFileTracingIncludes ?? {};

  it('next.config.ts includes the frozen document files', () => {
    const withDocs = Object.entries(includes).filter(([, globs]) => globs.some((g) => g.includes('lib/legal-documents')));
    assert.ok(withDocs.length > 0, 'outputFileTracingIncludes must name ./lib/legal-documents/**/*.md (see this file\'s header)');
    for (const [, globs] of withDocs) {
      assert.ok(globs.some((g) => g.endsWith('.md')), 'the include must cover the .md files');
    }
  });

  it('every page that reads a document is covered by an include key', () => {
    const readers = legalRoutes(LEGAL_APP).filter((r) => {
      const file = path.join(ROOT, 'app', r, 'page.tsx');
      return readFileSync(file, 'utf8').includes('legal-page-data');
    });
    assert.ok(readers.length >= 7, `expected the seven document pages under app/legal, found ${readers.join(', ')}`);
    const keys = Object.entries(includes).filter(([, g]) => g.some((x) => x.includes('lib/legal-documents'))).map(([k]) => k);
    for (const route of readers) {
      assert.ok(
        keys.some((k) => keyCovers(k, route)),
        `${route} reads a legal document but no outputFileTracingIncludes key covers it (keys: ${keys.join(', ')})`,
      );
    }
  });

  it('the documents are still read through legal-page-data at the repo-relative path the includes name', () => {
    const src = readFileSync(path.join(ROOT, 'lib/legal-page-data.ts'), 'utf8');
    assert.ok(src.includes('process.cwd()') && src.includes('publishedFilePath'), 'the read changed: re-check the includes against it');
    const reg = readFileSync(path.join(ROOT, 'lib/legal-documents.ts'), 'utf8');
    assert.ok(reg.includes('`lib/legal-documents/${doc}/${version}.md`'), 'the document path changed: update the includes in next.config.ts');
  });
});
