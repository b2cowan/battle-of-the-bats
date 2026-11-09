import type { LegalDocKey } from './legal-documents';

/**
 * WHERE THE LEGAL PAGES LIVE (GST/HST Stage 6 step 6.2) — the only file besides `lib/legal-links.ts` that types the address.
 * No `server-only` import, so the marketing bar (a client component) can ask whether a path is a legal page.
 */

/** The page's path on the platform: a document's current page, or one published version's page. */
export const legalPagePath = (doc: LegalDocKey, version?: string): string =>
  version ? `/legal/${doc}/${version}` : `/legal/${doc}`;

/** Is this pathname one of the legal pages? (The marketing bar and footer treat them as marketing ground.) */
export const isLegalPath = (pathname: string): boolean => pathname === '/legal' || pathname.startsWith('/legal/');
