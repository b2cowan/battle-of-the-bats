import 'server-only';
import { canonicalAppOrigin } from './app-origin';
import type { LegalDocKey } from './legal-documents';
import { legalPagePath } from './legal-paths';
import { legalPagesMode, type LegalPagesMode } from './legal-pages-switch';

/**
 * EVERY LINK TO A LEGAL PAGE IS BUILT HERE (GST/HST Stage 6 step 6.2, Chunk 1h) — a server component asks `legalPageHref`, a
 * client component asks `useLegalLinks()` (`components/legal/LegalLinksProvider.tsx`, fed by `resolveLegalLinks`). Nothing else
 * types a `/legal/` address: `tests/unit/legal-links-guard.test.ts` fails the build when something does.
 *
 * The href is an ABSOLUTE platform URL. On a club's own web address `/legal/...` is "not found" by design (`lib/club-host.ts`), and
 * the account menu also renders on club and tournament sites, so a relative link would dead-end there.
 */

export { legalPagePath };

/** The absolute address of a legal page (server only). */
export const legalPageHref = (doc: LegalDocKey, version?: string): string => `${canonicalAppOrigin()}${legalPagePath(doc, version)}`;

/** What the provider hands client components: null when the pages are off, so a link simply does not render. */
export interface LegalLinks {
  mode: Exclude<LegalPagesMode, 'off'>;
  termsHref: string;
  privacyHref: string;
}

export function resolveLegalLinks(env: Record<string, string | undefined> = process.env): LegalLinks | null {
  const mode = legalPagesMode(env);
  if (mode === 'off') return null;
  return { mode, termsHref: legalPageHref('terms'), privacyHref: legalPageHref('privacy') };
}
