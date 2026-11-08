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
import type { ReactNode } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { useOrg } from '@/lib/org-context';
import { clubPlaceAt, kitCountText } from '@/lib/admin-kit-nav';
import { seasonGroup, seasonPageHref, seasonSegment, toReviewLabel } from '@/lib/house-league-season';
import { useHouseLeagueAccess, useHouseLeagueSeasons } from '../useHouseLeagueSeasons';
import frame from '../AdminKitFrame.module.css';
import PlaceFrame from './PlaceFrame';
import SeasonStatePill from './SeasonStatePill';
import { RepChip } from './RepKit';

export default function SeasonFrame({ children }: { children: ReactNode }) {
  const { orgSlug: urlSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { canOpen, currentOrg } = useOrg();
  // The club's own slug, as the bar reads it: a frame and a bar that spelled the club two ways would key two places.
  const orgSlug = currentOrg?.slug ?? urlSlug;
  const seasons = useHouseLeagueSeasons(true);
  const season = seasons.find(s => s.id === seasonId) ?? null;
  // The season's pages do not depend on the season's state (`houseLeagueAccess`'s read, readMoney and email), so the row is
  // known as soon as the member is.
  const access = useHouseLeagueAccess(null);

  const league = `/${orgSlug}/admin/house-league`;
  // Is this address one of the season's tabs (`seasonTabs(seasonPath, access)` for the row)? The bar asks the same
  // question from the address alone, so its first paint is this frame's ("Season" until the season loads).
  const place = clubPlaceAt(pathname, `/${orgSlug}/admin`, { canUse: canOpen, seasonAccess: access });
  if (!place) return <>{children}</>;

  const count = season?.pendingReviewCount ?? 0;
  const tabs = place.tabs.map(t => (t.id === 'registrations' && count > 0
    ? { ...t, mark: <span className={frame.count} style={{ marginLeft: 0 }} aria-label={toReviewLabel(count)}>{kitCountText(count)}</span> }
    : t));

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
      // The way up (`place.back`) is "← Seasons", to the league's season list.
      title: season?.name ?? place.title,
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
