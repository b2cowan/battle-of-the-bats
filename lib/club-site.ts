/**
 * lib/club-site.ts — the small, pure decisions behind a club's site frame (Club Tier Stage 4b-1): what its pages are
 * called, how it describes itself, its initials, its social links, its faces. Pure so they are unit-tested
 * (lib/club-site.test.ts); the server-side reads that feed them live in lib/club-page-meta.ts.
 */
import type { OrgPublicSiteContent } from './types';

/**
 * A club page's browser-tab title: "page · club" (End state 8, ruled 2026-10-19; words /marketing 2026-10-20). The
 * home, and any page that cannot name itself (a team that does not exist), is the club's name alone.
 */
export function clubPageTitle(page: string | null | undefined, clubName: string): string {
  const named = page?.trim();
  return named ? `${named} · ${clubName}` : clubName;
}

/** The longest a description runs before it is cut at a word (search results show about this much). */
const DESCRIPTION_MAX = 160;
/** A "sentence" shorter than this is an abbreviation ("St.", "Est. 1998"), not the end of the first sentence. */
const SENTENCE_MIN = 24;

/**
 * How a club's pages describe themselves to search and link previews: the club's own words — its tagline, else the
 * first sentence of its description — and when it has written neither, its name. NEVER FieldLogicHQ's sales line
 * (S4-02), and never a generic "teams, tryouts and house league", which would be false for a club without one.
 */
export function clubDescription(content: Pick<OrgPublicSiteContent, 'tagline' | 'description'> | null, clubName: string): string {
  const tagline = content?.tagline?.trim();
  if (tagline) return tagline;
  const description = content?.description?.trim().replace(/\s+/g, ' ');
  if (description) {
    // The first sentence end at least SENTENCE_MIN in: "St." and "Est. 1998" are abbreviations, not a sentence.
    const end = [...description.matchAll(/[.!?](?=\s|$)/g)].find(m => m.index + 1 >= SENTENCE_MIN);
    const sentence = end ? description.slice(0, end.index + 1) : description;
    if (sentence.length <= DESCRIPTION_MAX) return sentence;
    const cut = sentence.slice(0, DESCRIPTION_MAX - 1);
    return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
  }
  return clubName;
}

/** Up to two initials for the logo tile of a club with no logo: "Lakeshore Lynx" → "LL", "Harbourview" → "H". */
export function clubInitials(clubName: string): string {
  const words = clubName.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  return words.slice(0, 2).map(w => (w.match(/[\p{L}\p{N}]/u)?.[0] ?? '').toUpperCase()).join('');
}

export type ClubSocialKind = 'instagram' | 'facebook' | 'x' | 'website';

/** The club's social links in the footer's order; a link it has not given is absent. Only http(s) addresses. */
export function clubSocials(
  content: Pick<OrgPublicSiteContent, 'socialInstagram' | 'socialFacebook' | 'socialX' | 'socialWebsite'> | null,
): { kind: ClubSocialKind; href: string }[] {
  if (!content) return [];
  const all: [ClubSocialKind, string | null][] = [
    ['instagram', content.socialInstagram],
    ['facebook', content.socialFacebook],
    ['x', content.socialX],
    ['website', content.socialWebsite],
  ];
  return all
    .map(([kind, href]) => ({ kind, href: href?.trim() ?? '' }))
    .filter(({ href }) => /^https?:\/\//i.test(href));
}

/**
 * The club's chosen font as the site's faces (Ask 1A: the warm faces by default, the club's chosen font kept). Barlow
 * is a TITLE face — a condensed face for running text would be unreadable — so a club that chose it keeps it on its
 * titles, which is what the warm pair already is.
 */
export function clubFace(themeFont: string | null | undefined): 'warm' | 'dm-serif' | 'inter' {
  if (themeFont === 'dm-serif') return 'dm-serif';
  if (themeFont === 'inter') return 'inter';
  return 'warm';
}
