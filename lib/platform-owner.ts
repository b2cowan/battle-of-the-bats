/**
 * lib/platform-owner.ts — "the owner", by name, for the pages that are the owner's and no role's (Bookkeeping, and since
 * Club Website Track P Session P2, Prospect clubs: owner ruling T2 2026-11-25, "only the owner makes one").
 *
 * ONE allowlist (`BOOKKEEPING_OWNER_EMAILS`, read in `lib/bookkeeping-access.ts`), re-exported under the name the
 * non-bookkeeping callers mean, so there is never a second list to keep in step. A platform role alone never grants it.
 */
export { canAccessBookkeeping as isPlatformOwner, requireBookkeepingApi as requirePlatformOwnerApi } from './bookkeeping-access';
