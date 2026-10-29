/**
 * lib/public-host-card.ts — THE HOST CARD AND THE CHAMPIONS, AS THE FRAME OVERVIEW SAYS THEM (Public tournament pages
 * Stage 2 Part 3; plan docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §5 and §6, Ask 4 / Ask B). Pure, so
 * tests/unit/public-host-card.test.ts pins them.
 *
 * THE HOST CARD is the club as advertising: "Hosted by {club}", what is OPEN NOW at it (the club home's own list,
 * nothing typed for it) and a Visit the club button. It exists only when the organizer has a public club page — the
 * same door the band and the footer use (`publicFrameHost`, so the three cannot disagree) AND the club's open-now read
 * answered (`loadHostClubOpenNow` is null for a closed site or a plan without one). A tournament-only organizer, or an
 * organization with tournaments but no club site (whose door is its tournament list), gets the footer's line and no card.
 */
import { clubInitials } from './club-site';
import type { ClubOpenNowRow } from './club-open-now';
import type { PublicFrameHost } from './public-frame';
import type { TierChampion } from './champions';
import { tierBadgeLabel } from './champions';

/** How many open items the card lists; the club home's page has the rest. */
export const HOST_OPEN_ROWS = 3;

export interface HostCardView {
  name: string;
  initials: string;
  logoUrl: string | null;
  /** The club's home; null in the organizer's admin preview, where the card is plain text like the band. */
  href: string | null;
  /** Empty: the card says the club runs teams and programs all year. */
  open: { key: string; href: string | null; title: string; sub: string | null }[];
}

export function hostCardView(i: {
  host: PublicFrameHost | null;
  /** `loadHostClubOpenNow`: null = no public club site, [] = nothing open. */
  openNow: readonly ClubOpenNowRow[] | null;
  logoUrl: string | null;
  isPreview: boolean;
  /** The club's home, spelled for the address the visitor is on. */
  clubHref: string;
}): HostCardView | null {
  if (i.host?.kind !== 'hosted' || i.openNow === null) return null;
  return {
    name: i.host.name,
    initials: clubInitials(i.host.name),
    logoUrl: i.logoUrl,
    href: i.isPreview ? null : i.clubHref,
    open: i.openNow.slice(0, HOST_OPEN_ROWS).map(r => ({ key: r.key, href: i.isPreview ? null : r.href, title: r.title, sub: r.sub })),
  };
}

export interface ChampionCardView {
  key: string;
  /** The division's name; shown when the event has more than one. */
  division: string | null;
  /** "Champion" or the tier's own badge ("Gold · Champion"); null for a single bracket in a single division. */
  badge: string | null;
  name: string;
  /** "Beat Pirates 7–4 in the championship"; null when the final names no loser. */
  beat: string | null;
  top: boolean;
}

/**
 * One card per decided final (the Champions page's look: the division, the team, the score), top tier first within a
 * division, in the organizer's division order. `deriveTierChampions` already walks divisions in order; this only words
 * what it found.
 */
export function championCards(champions: readonly TierChampion[], multiDivision: boolean): ChampionCardView[] {
  return champions.map((c, i) => {
    const score = c.championScore != null && c.runnerUpScore != null ? ` ${c.championScore}–${c.runnerUpScore}` : '';
    return {
      key: `${c.division}-${c.tierLabel ?? 'single'}-${i}`,
      division: multiDivision ? c.division : null,
      badge: c.tierLabel || !c.isTopTier ? tierBadgeLabel(c.tierLabel, c.isTopTier) : null,
      name: c.champion,
      beat: c.runnerUp ? `Beat ${c.runnerUp}${score}${c.isTopTier ? ' in the championship' : ''}` : null,
      top: c.isTopTier,
    };
  });
}
