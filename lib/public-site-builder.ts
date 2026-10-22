/**
 * lib/public-site-builder.ts — THE PUBLIC SITE BUILDER'S RULES (ruled 2026-10-21, A1–A9;
 * docs/projects/active/PUBLIC_SITE_BUILDER_PLAN.md). Pure; tested in tests/unit/public-site-builder.test.ts.
 *
 *   A4 — THREE LOOKS, named for what they look like. The club's pages have only three type pairs (`clubFace`): the warm
 *        pair (Barlow titles over Inter) for "system" and "barlow" alike, DM Serif over DM Sans, and Inter throughout. So the
 *        picker offers three, a club that picked System or Barlow reads as Classic, and Classic stores the default
 *        ("system"). Tournament pages keep their own four-way picker (FONT_OPTIONS) — this is the club's only.
 *   A8 — THE ROWS' MARKS: what makes each of the four parts ready. Nothing is required to go live; the marks only say
 *        what is left. ⚖ A new club's site is ONLINE from the start (organizations.is_public defaults true), so the marks
 *        follow the parts, not a first Go live.
 */
import { clubFace } from './club-site';
import { PUBLIC_SITE_WORDS as W } from './public-site-words';
import type { SiteEditRow } from './site-edit-marks';

/**
 * A9 — CLICK THE PREVIEW TO EDIT: the editor rows a part of the club's page can name (the marks are `siteEdit(row)` in
 * lib/site-edit-marks.ts), each with the row's own title. The preview tells the editor through a message of type
 * `PREVIEW_MESSAGE` from its own origin: `{ edit: row }` on a click.
 */
export const SITE_EDIT_ROWS: Record<SiteEditRow, string> = {
  look: W.look,
  home: W.homePage,
  about: W.aboutCard,
  lists: W.lists,
  notice: W.notice,
};
export const PREVIEW_MESSAGE = 'site-preview';

/**
 * OPTION A — WHO CHANGES THE CLUB'S LOOK (ruled 2026-10-21): the owner or an admin. The site's on/off switch, its
 * directory listing, the club's name and its web address stay the owner's: the org-settings route refuses an admin any
 * field outside `CLUB_LOOK_FIELDS` (lib/public-site-access.ts asks the role; the editor's preview asks the same).
 */
export const CLUB_LOOK_ROLES: readonly string[] = ['owner', 'admin'];
/** The org-settings fields an admin may send: the colours and the type. Anything else from an admin is refused whole. */
export const CLUB_LOOK_FIELDS: readonly string[] = ['themePreset', 'themePrimary', 'themeAccent', 'themeFont'];

export type ClubLook = 'classic' | 'serif' | 'clean';

/** The three looks, in the picker's order, with the font each stores. */
export const CLUB_LOOKS: readonly { key: ClubLook; font: string }[] = [
  { key: 'classic', font: 'system' },
  { key: 'serif', font: 'dm-serif' },
  { key: 'clean', font: 'inter' },
];

export function clubLookOf(themeFont: string | null | undefined): ClubLook {
  const face = clubFace(themeFont);
  return face === 'dm-serif' ? 'serif' : face === 'inter' ? 'clean' : 'classic';
}

export interface BuilderFacts {
  logoUrl: string | null | undefined;
  themePreset: string | null | undefined;
  themePrimary: string | null | undefined;
  tagline: string | null | undefined;
  contactEmail: string | null | undefined;
  contacts: number;
  documents: number;
  questions: number;
}

export interface BuilderReadiness {
  look: boolean;
  home: boolean;
  about: boolean;
  lists: boolean;
  ready: number;
  of: 4;
}

export function builderReadiness(f: BuilderFacts): BuilderReadiness {
  // A logo, or any colour but the platform's own default.
  const look = !!f.logoUrl || !!f.themePrimary || (!!f.themePreset && f.themePreset !== 'platform');
  // The home page shows the club's sections in the default order from the start.
  const home = true;
  const about = !!f.tagline?.trim() && !!f.contactEmail?.trim();
  const lists = f.contacts + f.documents + f.questions > 0;
  return { look, home, about, lists, ready: [look, home, about, lists].filter(Boolean).length, of: 4 };
}
