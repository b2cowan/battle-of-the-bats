'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BottomSheet from '@/components/admin/BottomSheet';
import { useHouseLeagueAccess, useHouseLeagueSeasons } from '../useHouseLeagueSeasons';
import { seasonGroup, seasonPageHref, seasonPagesFor, seasonSegment, toReviewLabel } from '@/lib/house-league-season';
import SeasonStatePill from './SeasonStatePill';
import styles from './SeasonPhoneFrame.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE SEASON ON A PHONE (Club Tier Stage 9a, 9a·3; frame C): above every season page, the season's header —
 * its name, what is happening (the pill), and a 44 px switch button, symbol alone — and a strip of the season's pages as
 * 44 px pills that scrolls sideways, the page you are on scrolled into view, the amber count on Registrations.
 *
 * Phone only: the desk keeps the rail's season block (9a·2), so this renders nothing above 900 px (CSS). It lives INSIDE
 * house league's own page. ⚠ The phone bar and its More sheet are Stage 13's and are not touched here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export default function SeasonPhoneFrame() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const pathname = usePathname();
  const seasons = useHouseLeagueSeasons(true);
  const season = seasons.find(s => s.id === seasonId) ?? null;
  const access = useHouseLeagueAccess(season);
  const [switching, setSwitching] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const seasonPath = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;
  const at = seasonSegment(pathname);
  const pages = access ? seasonPagesFor(access) : [];

  // The page you are on is in view, without moving the screen itself.
  useEffect(() => {
    const strip = stripRef.current;
    const on = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !on) return;
    strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
  }, [at, pages.length, season?.id]);

  if (!season || !access) return null;

  return (
    <div className={styles.frame}>
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={styles.eyebrow}>Season</span>
          <b className={styles.name}>{season.name}</b>
        </div>
        <SeasonStatePill season={season} />
        {seasons.length > 1 && (
          <button type="button" className={styles.switch} aria-label="Switch season" onClick={() => setSwitching(true)}>
            <ChevronDown size={18} aria-hidden />
          </button>
        )}
      </div>
      {pages.length > 1 && (
        <nav className={styles.strip} ref={stripRef} aria-label="Season pages">
          {pages.map(p => {
            const current = at === p.segment;
            const count = p.key === 'registrations' ? season.pendingReviewCount : 0;
            return (
              <Link
                key={p.key}
                href={seasonPageHref(seasonPath, p.segment)}
                className={`${styles.pill}${current ? ` ${styles.pillOn}` : ''}`}
                aria-current={current ? 'page' : undefined}
              >
                {p.label}
                {count > 0 && <span className={styles.count} aria-label={toReviewLabel(count)}>{count > 9 ? '9+' : count}</span>}
              </Link>
            );
          })}
        </nav>
      )}
      <BottomSheet open={switching} onClose={() => setSwitching(false)} title="Switch season">
        <ul className={styles.list}>
          {seasons.map(s => (
            <li key={s.id}>
              <Link
                href={seasonPageHref(`/${orgSlug}/admin/house-league/seasons/${s.id}`, at)}
                className={`${styles.option}${s.id === seasonId ? ` ${styles.optionOn}` : ''}`}
                aria-current={s.id === seasonId ? 'true' : undefined}
                onClick={() => setSwitching(false)}
              >
                <span className={styles.optionName}>{s.name}</span>
                {seasonGroup(s) === 'past' && <span className={styles.finished}>Finished</span>}
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
