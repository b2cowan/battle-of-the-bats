/**
 * lib/site-edit-marks.ts — WHICH EDITOR ROW SETS A PART OF THE CLUB'S PAGE (Public site builder A9, ruled 2026-10-21).
 *
 * The public components that draw the club's bar, sections, notice and footer mark each part with `data-site-edit`; the
 * editor's preview reads it so a click opens the row that sets that part. Nothing a family's page acts on. The marks are
 * written ONLY through `siteEdit(row)`, so a row that does not exist is a type error, and a test pins both halves
 * (tests/unit/public-site-builder.test.ts). Tiny and free of words on purpose: the public components import it.
 */
export const SITE_EDIT_ROW_KEYS = ['look', 'home', 'about', 'lists', 'notice'] as const;
export type SiteEditRow = (typeof SITE_EDIT_ROW_KEYS)[number];

export const isSiteEditRow = (v: unknown): v is SiteEditRow => SITE_EDIT_ROW_KEYS.some(k => k === v);

/** Spread onto the part: `<header {...siteEdit('look')}>`. */
export const siteEdit = (row: SiteEditRow) => ({ 'data-site-edit': row }) as const;
