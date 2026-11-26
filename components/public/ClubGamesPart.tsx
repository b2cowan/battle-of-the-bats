'use client';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { ClubGameRow, ClubGamesRead } from '@/lib/club-games-read';
import { isNewerGamesRead } from '@/lib/club-game-live';
import {
  BAND_ROWS, GAMES_HOME_WORDS as W, failLine, gameContext, gameHeadTime, homeGamesView, movedLine,
  type HomeGameItem, type HomeGamesBand,
} from '@/lib/club-games-home';
import { orgHref } from '@/lib/club-base';
import { MARK_WORDS } from '@/lib/place-closures';
import { directionsHref } from '@/lib/family-schedule-format';
import { sideResult } from '@/lib/public-game-row';
import { fetchClubGames, useClubGamesCheck } from '@/lib/hooks/useClubGamesCheck';
import { ScheduleMatchup, type GameRowState, type MatchupSide } from './PublicGameRow';
import DirectionsLink from './DirectionsLink';
import ClubMoreRow, { useShowMore } from './ClubMoreRow';
import scheduleStyles from './PublicSchedule.module.css';
import PublicSectionHead from './PublicSectionHead';
import kit from './ClubKit.module.css';
import parts from './PublicParts.module.css';
import styles from './ClubGamesPart.module.css';

/**
 * THE CLUB HOME'S GAMES PART (Club Website Stage 1, Pass 2; drawing tabs 2, 3 and 6; Stage 0 A1–A3, G1–G11). It sits
 * right under Open now. The page renders it from the one games read (`lib/club-games-read.ts`); while a game window is
 * open it checks every 30 seconds (`useClubGamesCheck`) and redraws from the newer answer — never from an older one held
 * at the edge (`isNewerGamesRead`). What it says is `homeGamesView`'s (lib/club-games-home.ts); this only draws it.
 *
 *   · Every game row is the shipped stacked row (`ScheduleMatchup`, R6) and every tournament row the shipped link row
 *     (R7) — in the 540 column on a computer too (G8 · A). Under Live now the pill is left off and the green edge stays
 *     (R9); the edge is the status green, never the club's colour.
 *   · Four rows a band, then one row opening the rest in place; "Show fewer" closes it and brings its heading back.
 *   · `initial === null`: the first read failed (G11 · A) — titled "Games", one line and Try again. All or nothing: the
 *     read never hands over a partial day. A failed 30-second check says nothing and keeps what is on screen.
 */
export default function ClubGamesPart({ orgSlug, ownHost, initial, leagueHref }: {
  orgSlug: string;
  ownHost: boolean;
  initial: ClubGamesRead | null;
  /** The house league schedule the failure line points to, or null when the club shows no house league. */
  leagueHref: string | null;
}) {
  const [read, setRead] = useState<ClubGamesRead | null>(initial);
  const [trying, setTrying] = useState(false);
  const onRead = useCallback((incoming: ClubGamesRead) => {
    setRead(shown => (!shown || isNewerGamesRead(incoming, shown) ? incoming : shown));
  }, []);
  useClubGamesCheck({ orgSlug, window: read?.checkWindow ?? null, since: initial?.asOf ?? new Date(0).toISOString(), onRead });
  const view = useMemo(() => (read ? homeGamesView(read, Date.parse(read.asOf)) : null), [read]);
  const href = (path: string) => orgHref({ slug: orgSlug, ownHost }, path);

  if (!read) {
    const tryAgain = async () => {
      setTrying(true);
      const again = await fetchClubGames(orgSlug);
      setTrying(false);
      if (again) onRead(again);
    };
    return (
      <section className={kit.section} aria-labelledby="games">
        <PublicSectionHead id="games" title={W.failTitle} />
        <div className={`${kit.list} ${styles.fail}`}>
          <p className={styles.failLine}>
            {leagueHref
              ? <>{W.failLead} <Link href={leagueHref}>{W.failLink}</Link> {W.failTail}</>
              : failLine()}
          </p>
          <button type="button" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm}`} onClick={tryAgain} disabled={trying}>
            {W.tryAgain}
          </button>
        </div>
      </section>
    );
  }

  if (!view) return null;
  return (
    <section className={kit.section} aria-labelledby="games">
      <PublicSectionHead id="games" title={view.title} note={view.date ?? undefined} />
      <div className={kit.list}>
        {view.bands.map(band => <Band key={band.key} band={band} today={view.today} href={href} />)}
        {view.doors.length > 0 && (
          <ul className={`${parts.gameList} ${styles.rows}`}>
            {view.doors.map(d => (
              <li key={d.key}>
                <Link href={href(d.path)} className={`${kit.row} ${styles.flat}`}>
                  <span className={kit.rowMain}>
                    <span className={kit.rowName}>{d.title}</span>
                    <span className={kit.rowSub}>{d.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Band({ band, today, href }: { band: HomeGamesBand; today: string; href: (path: string) => string }) {
  // Closing brings the band's heading back into view, so the page does not jump past it (tab 2).
  const { open, ref, toggle } = useShowMore<HTMLHeadingElement>();
  const shown = band.more && !open ? band.items.slice(0, BAND_ROWS) : band.items;
  return (
    <>
      {band.title && <h3 ref={ref} className={`${kit.listBand} ${styles.bandHead}`}>{band.title}</h3>}
      <ul className={`${parts.gameList} ${styles.rows}`}>
        {shown.map(item => <li key={item.key}><Item item={item} band={band.key} today={today} href={href} /></li>)}
        {band.more && (
          <li><ClubMoreRow open={open} onToggle={toggle} title={band.more.title} sub={band.more.sub} className={styles.flat} /></li>
        )}
      </ul>
    </>
  );
}

function Item({ item, band, today, href }: {
  item: HomeGameItem; band: HomeGamesBand['key']; today: string; href: (path: string) => string;
}): ReactNode {
  if (item.kind !== 'game') {
    const title = item.kind === 'tournament' ? item.name : item.title;
    // A running tournament under Live now wears the live edge (R9); its row opens its Overview (A3).
    return (
      <Link href={href(item.path)} className={`${kit.row} ${styles.flat}${item.kind === 'tournament' && band === 'live' ? ` ${scheduleStyles.edge}` : ''}`}>
        <span className={kit.rowMain}>
          <span className={kit.rowName}>{title}</span>
          <span className={kit.rowSub}>{item.sub}</span>
        </span>
      </Link>
    );
  }
  return <GameRow row={item.row} today={today} href={href} />;
}

/** One game, as tab 3 draws each kind. */
function GameRow({ row, today, href }: { row: ClubGameRow; today: string; href: (path: string) => string }) {
  const live = row.state === 'live';
  const final = row.state === 'final';
  const rep = row.program === 'rep';
  const score = row.score;
  // Home first as stored; the shipped house league schedule reads away, then home.
  const away: MatchupSide = { name: row.away, score: null, result: null };
  const home: MatchupSide = { name: row.home, score: null, result: null, own: rep || undefined };
  if (score && (final || (live && rep))) {
    home.score = score.home;
    away.score = score.away;
    // Winner bold only on a result someone saved: a rep game never ended reads as its score alone (G7).
    if (final && row.decided) {
      home.result = sideResult(score.home, score.away);
      away.result = sideResult(score.away, score.home);
    }
  }
  // A rep row puts the club's team first (as on a team's page); a house league result puts the winner first.
  const sides = rep || (final && home.result === 'win') ? [home, away] : [away, home];
  // A game still to play, or past its window with no score, has no pill; every other state is the shipped pill's own.
  const state: GameRowState | undefined = row.state === 'coming' || row.state === 'noScore' || (final && !row.decided)
    ? undefined : row.state;
  const noScore = live && !rep ? W.scoreAfter
    : (live && !score) || row.state === 'noScore' ? W.noScoreYet
      : row.state === 'moved' ? movedLine(row) ?? undefined
        : row.closedPlace ? MARK_WORDS.line({ place: row.closedPlace })
        : undefined;
  // The field on a game still to play or on now; Directions only on Live now and only to a real address (tab 3).
  const showPlace = row.place && (live || row.state === 'coming' || row.state === 'postponed' || row.state === 'cancelled');
  const directions = live ? directionsHref(row.address) : null;
  return (
    <ScheduleMatchup form="stacked" pill={!live} state={state} time={gameHeadTime(row, today)} division={gameContext(row)}
      href={href(row.path)} sides={sides} noScore={noScore}
      place={showPlace ? { text: row.place!, action: directions ? <DirectionsLink href={directions} name={`Directions to ${row.place}`} /> : undefined } : undefined} />
  );
}
