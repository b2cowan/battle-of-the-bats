/**
 * MAY A PUBLIC PAGE PROMISE "A FULL COPY OF YOUR CLUB'S INFORMATION"? — one rule, two places (Board Ready §0c, Security page S3).
 *
 * `/legal` (S1, 2026-11-21): the promise is written only in the Data Terms (§11), so a public page makes it once the Data Terms page
 * is published, or once the owner confirms the by-hand procedure (club on-sale plan Ask 29). "Questions a board asks" answer 4's
 * "or ask us for a full copy" and the Security page's full-copy line follow THIS predicate, so the confirmation, when it comes, is
 * one edit here and flips both. `tests/unit/security-page.test.ts` fails the build if either stops asking it.
 *
 * No `server-only` import, so the unit tests can load it; both callers are server components.
 */

/** Ask 29: flip to true, alone, when the owner confirms the by-hand full-copy procedure. */
export const FULL_COPY_BY_HAND_CONFIRMED: boolean = false;

export const fullCopyOffered = (legal: { dataTermsHref: string | null }): boolean =>
  FULL_COPY_BY_HAND_CONFIRMED || legal.dataTermsHref !== null;
