import 'server-only';
import { canonicalAppOrigin } from './app-origin';
import { currentVersion, legalPageLive, type LegalPageKey } from './legal-documents';
import { legalPagePath, SECURITY_PATH } from './legal-paths';
import { legalPagesOn } from './legal-pages-switch';

/**
 * EVERY LINK TO A LEGAL PAGE IS BUILT HERE (GST/HST Stage 6 step 6.2, Chunk 1h) — a server component asks `legalPageHref`, a
 * client component asks `useLegalLinks()` (`components/legal/LegalLinksProvider.tsx`, fed by `resolveLegalLinks`). Nothing else
 * types a `/legal/` address: `tests/unit/legal-links-guard.test.ts` fails the build when something does.
 *
 * The href is an ABSOLUTE platform URL. On a club's own web address `/legal/...` is "not found" by design (`lib/club-host.ts`), and
 * the account menu also renders on club and tournament sites, so a relative link would dead-end there.
 */

/** The absolute address of a legal page (server only). */
export const legalPageHref = (doc: LegalPageKey, version?: string): string => `${canonicalAppOrigin()}${legalPagePath(doc, version)}`;

/** What the provider hands client components: null when the pages are off, so a link simply does not render. */
export interface LegalLinks {
  termsHref: string;
  privacyHref: string;
  /** The Terms version these links open — what an account door's tick box sends back as `termsVersion` (step 6.3, Chunk B), so
   *  the server refuses a tick given to words that changed while the page was open. `'draft'` in the preview. */
  termsVersion: string;
  /** The two pages a person reads but never accepts (Board Ready 0a-5): null until each has a published text, so the marketing
   *  footer shows no link to a "not found" page. The sign-in doors never read these — they keep the two things accepted there. */
  dataTermsHref: string | null;
  subprocessorsHref: string | null;
  /** The public Security page (Board Ready §0c, S3): it goes live with the legal pages, so it exists whenever these links do. The
   *  marketing footer and "Questions a board asks" link it; the sign-in doors never do. */
  securityHref: string;
}

const hrefWhenLive = (page: LegalPageKey, env: Record<string, string | undefined>): string | null =>
  legalPageLive(page, env) ? legalPageHref(page) : null;

export function resolveLegalLinks(env: Record<string, string | undefined> = process.env): LegalLinks | null {
  const termsVersion = currentVersion('terms', env);
  if (!legalPagesOn(env) || termsVersion === null) return null;
  return {
    termsHref: legalPageHref('terms'), privacyHref: legalPageHref('privacy'), termsVersion,
    dataTermsHref: hrefWhenLive('data-terms', env), subprocessorsHref: hrefWhenLive('subprocessors', env),
    securityHref: `${canonicalAppOrigin()}${SECURITY_PATH}`,
  };
}
