import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { formatStoredDate } from './timezone';
import {
  LEGAL_DOCUMENTS, isPublishedVersion, publishedFilePath, versionSpan, type LegalDocKey,
} from './legal-documents';
import { readDraftForPreview } from './legal-draft-preview';
import { legalPagePath } from './legal-links';
import { legalPagesMode } from './legal-pages-switch';
import {
  LEGAL_EFFECTIVE_BLANK_FACT, legalEarlierVersionLine, legalEffectiveLine, legalTitle, legalToBeFilled,
} from './legal-words';
import { marketingMetadata } from './marketing-metadata';

/**
 * WHAT A LEGAL ROUTE SHOWS (GST/HST Stage 6 step 6.2, Chunk 2a). One decision, made once per request:
 *
 *   · off                       → null (the route answers "not found")
 *   · preview                   → the draft, filtered, under the Draft banner; no `[version]` page exists
 *   · published, no version     → the frozen file of `current`
 *   · published, a listed date  → that frozen file; the current one reads like the main page, an earlier one carries the
 *                                 earlier-version line (4b)
 *   · anything else             → null
 *
 * `draft` is true ONLY when the text came from the draft file, so the banner cannot show on production.
 */
export interface LegalPageData {
  markdown: string;
  draft: boolean;
  /** (4a), as text; null in the preview, whose date line is the blank-date mark. */
  effectiveText: string | null;
  /** (4b), when the version is no longer current. */
  earlier: { text: string; currentHref: string } | null;
  /** Earlier versions and the preview stay out of search results. */
  noindex: boolean;
}

const longDate = (ymd: string) => formatStoredDate(ymd, { longMonth: true });

export function loadLegalPage(doc: LegalDocKey, version?: string, env: Record<string, string | undefined> = process.env): LegalPageData | null {
  const mode = legalPagesMode(env);
  if (mode === 'off') return null;

  if (mode === 'preview') {
    if (version) return null; // a version's own address exists only once it is published
    const markdown = readDraftForPreview(doc, env);
    return markdown === null ? null : { markdown, draft: true, effectiveText: null, earlier: null, noindex: true };
  }

  const current = LEGAL_DOCUMENTS[doc].current;
  if (!current) return null;
  const v = version ?? current;
  if (!isPublishedVersion(doc, v)) return null;
  const markdown = readFileSync(path.join(process.cwd(), publishedFilePath(doc, v)), 'utf8');
  if (v === current) return { markdown, draft: false, effectiveText: longDate(v), earlier: null, noindex: false };
  const span = versionSpan(doc, v);
  if (!span?.to) return null;
  return {
    markdown, draft: false, effectiveText: null, noindex: true,
    earlier: { text: legalEarlierVersionLine(longDate(span.from), longDate(span.to)), currentHref: legalPagePath(doc) },
  };
}

/** The date line's words: (4a), or (4a) with the blank-date mark while there is no effective date yet. */
export const effectiveLineText = (data: LegalPageData): string =>
  data.effectiveText !== null ? legalEffectiveLine(data.effectiveText) : legalEffectiveLine(legalToBeFilled(LEGAL_EFFECTIVE_BLANK_FACT));

/** Title and address through the marketing helper; the preview and earlier versions are `noindex`. */
export function legalPageMetadata(doc: LegalDocKey, version?: string): Metadata {
  const data = loadLegalPage(doc, version);
  return marketingMetadata({
    title: legalTitle(doc),
    path: legalPagePath(doc, version),
    noindex: data === null || data.noindex,
  });
}
