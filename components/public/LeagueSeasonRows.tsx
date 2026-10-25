import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { publicSeasonLinks, publicSeasonState } from '@/lib/house-league-season';
import type { LeagueSeasonStatus } from '@/lib/types';
import kit from './ClubKit.module.css';
import s from './LeagueSeasonRows.module.css';

/**
 * EVERY LIVE HOUSE-LEAGUE SEASON, ONE ROW EACH (Club Tier Stage 9a, Part 5; owner Q14; frame E; words
 * HOUSE_LEAGUE_STAGE9A_COPY.md §8). The league page and the club home (both the public-site home and the fallback home)
 * draw this one list, so a season is never named two ways: its name (the row's door to its page), what is happening
 * (Registration open · Registration closed · Starts {date} · Playing now · Final standings), and its own links at 44 px.
 * Before 9a every one of those surfaces showed only the newest live season (F04).
 */
export type PublicLeagueSeason = {
  id: string;
  name: string;
  status: LeagueSeasonStatus;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  /** The season's public page, spelled for the address the visitor is on (`/league/{slug}`, or the club's own host's). */
  href: string;
};

export default function LeagueSeasonRows({ seasons, today, label }: {
  seasons: readonly PublicLeagueSeason[];
  today: string;
  label: string;
}) {
  return (
    <ul className={s.list} aria-label={label}>
      {seasons.map(season => {
        const href = season.href;
        const state = publicSeasonState(season, today);
        return (
          <li key={season.id} className={s.row}>
            <div className={s.top}>
              <Link href={href} className={s.name}>{season.name}</Link>
              {state && <span className={`${kit.chip} ${state.tone === 'ok' ? kit.chipOk : kit.chipNeutral}`}>{state.label}</span>}
              <ChevronRight size={18} className={s.chevron} aria-hidden />
            </div>
            <div className={s.links}>
              {publicSeasonLinks(season, href).map(l => (
                <Link key={l.label} href={l.href} className={`${s.link}${l.primary ? ` ${s.linkPrimary}` : ''}`} aria-label={`${l.label}, ${season.name}`}>
                  {l.label}
                </Link>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
