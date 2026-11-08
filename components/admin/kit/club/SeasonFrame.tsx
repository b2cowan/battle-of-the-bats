'use client';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE SEASON IS A PLACE (⚖ Club Tier Stage 13i, A4 — Asks 1 and 6 = A, owner 2026-11-06; drawing tabs 2, 4, 6).
 *
 * One header on every season page, desk and phone alike: "← Seasons" (the way up, named by where it goes), the eyebrow
 * "House league", the season's NAME with its switch chevron, the status pill — then the season's tab row (`seasonTabs`,
 * the pages this person can open; Registrations carries its waiting count). It replaced the rail's season block and its
 * `<select>`, the phone's season card and pill strip (`SeasonPhoneFrame`, retired), and every season page's own "← Seasons"
 * / "← {season}" back link and title (`TabPageHeader`).
 *
 * ⚖ THE SWITCH (owner 2026-11-06, Settle 4): the title's chevron opens the product's shipped pick-one menu — the Year
 * pill's (`SingleSelectDropdown`, `face="chevron"`): its panel on a desk, its sheet on a phone, live seasons first and a
 * finished one marked. A pick keeps the page you are on. Drawn only when there is another season to switch to.
 *
 * An address under the season that is no tab — a club schedule read from the season's Schedule — is a RECORD page one
 * level down (owner 2026-11-06): it keeps its own back arrow and this frame draws no header or tab row over it. Whether an
 * address is a tab is decided by the address alone, so the header and the row draw before the season's data arrives.
 *
 * ⚖ THE HEADER AND THE TABS ARE IN THE PINNED BAR (Admin header bar Phase 2, owner 2026-11-07): "← Seasons", the season's
 * name with its switcher, the small line (the club on desktop · "House league" · the status chip — a second line on a
 * phone too, A2 = a) and the tab row pinned inside the bar. The name is cut to one line with "…"; the switcher and the
 * chip never are. Nothing on the paper above the page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { markTabs, useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import { seasonGroup, seasonPageHref, seasonSegment, toReviewLabel } from '@/lib/house-league-season';
import { useHouseLeagueAccess, useHouseLeagueSeasons } from '../useHouseLeagueSeasons';
import { WaitingCount } from './money/MoneyKit';
import PlaceFrame from './PlaceFrame';
import SeasonStatePill from './SeasonStatePill';
import { RepChip } from './RepKit';

// ⚖ A PAGE THAT READ ITS SEASON NAMES IT (Admin header bar Phase 2 /review, 2026-11-07). The season list is House league's
// (`useHouseLeagueSeasons`, its route refuses anyone without House league's read), but a treasurer opens a season's Money
// through Accounting (`readMoney`), and the bar read "Season" there for good. The Money page's own read carries the
// season's name, so it publishes it (`usePublishSeasonName`), as a team's pages publish the team's head.
let named: { seasonId: string; name: string } | null = null;
const nameListeners = new Set<() => void>();
const subscribeName = (l: () => void) => { nameListeners.add(l); return () => { nameListeners.delete(l); }; };

/** A season page that read its season without the season list: the bar names the season from this read. */
export function usePublishSeasonName(seasonId: string | null, name: string | null): void {
  useEffect(() => {
    if (!seasonId || !name || (named?.seasonId === seasonId && named.name === name)) return;
    named = { seasonId, name };
    nameListeners.forEach(l => l());
  }, [seasonId, name]);
}

export default function SeasonFrame({ children }: { children: ReactNode }) {
  const { seasonId } = useParams<{ seasonId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  // The season list is House league's read: someone who opens only a season's Money (a treasurer) is never sent to ask.
  const seasons = useHouseLeagueSeasons(!!useHouseLeagueAccess(null)?.read);
  const season = seasons.find(s => s.id === seasonId) ?? null;
  const published = useSyncExternalStore(subscribeName, () => named, () => null);
  const pageName = published?.seasonId === seasonId ? published.name : null;

  // Is this address one of the season's tabs, and which of its pages are this person's (the season gate, `seasonAccess`:
  // its read, readMoney and email do not depend on the season's state, so the row is known as soon as the member is)? The
  // bar asks the same question from the address alone, so its first paint is this frame's ("Season" until it loads).
  const place = useClubPlaceAt();
  if (!place?.back || !place.key.startsWith('season:')) return <>{children}</>;
  // The way up (`place.back`) is "← Seasons", the league's season list: the switch keeps you under it.
  const league = place.back.href;

  const count = season?.pendingReviewCount ?? 0;
  const tabs = markTabs(place.tabs, id => (id === 'registrations' && count > 0 ? <WaitingCount n={count} label={toReviewLabel(count)} /> : null));

  // The switch's rows: live seasons first (the list's own order), a finished one marked in its row only — the title beside
  // the chevron already names the season on screen, and its pill says where it stands.
  const switchOptions = seasons.map(s => ({
    id: s.id,
    label: s.name,
    rowMark: seasonGroup(s) === 'past' ? <RepChip tone="neutral">Finished</RepChip> : undefined,
  }));
  return (
    <PlaceFrame place={{
      ...place,
      title: season?.name ?? pageName ?? place.title,
      tabs,
      switcher: season && seasons.length > 1 ? (
        <SingleSelectDropdown
          face="chevron"
          label="Switch season"
          value={season.id}
          options={switchOptions}
          onChange={id => router.push(seasonPageHref(`${league}/seasons/${id}`, seasonSegment(pathname)))}
        />
      ) : undefined,
      chip: season ? <SeasonStatePill season={season} /> : undefined,
    }}>
      {children}
    </PlaceFrame>
  );
}
