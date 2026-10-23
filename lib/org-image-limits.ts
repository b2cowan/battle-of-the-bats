/**
 * lib/org-image-limits.ts — WHAT A CLUB'S LOGO AND BANNER PHOTO MAY BE: one home for the limits the upload routes enforce
 * and the Public site editor says before it sends a byte (so the hint, the browser's check and the route cannot drift).
 */
/** The public storage bucket every org and tournament logo lives in (lib/org-logo-storage.ts makes it; a club sponsor's
 *  logo is in it too — lib/sponsor-logo.ts). Here, not there, because this module is pure and the editor imports it. */
export const ORG_LOGO_BUCKET = 'org-logos';
export const ORG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ORG_LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const ORG_BANNER_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
