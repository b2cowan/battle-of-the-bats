'use client';
/**
 * THE CLUB BAND — "The club today" (Club Tier Stage 13b, A1; owner Asks 2 and 4; hub tab 12 "Homes").
 *
 * One joined band above "This morning" on the Overview, for the owner and the club admin: Cash on hand · Owed to the club ·
 * This week · Needs someone. Each tile opens its lines; a tile the reader cannot open is ABSENT (the route leaves its key
 * out), never greyed. "This morning" and "Your programs" stay exactly as they are. The summary plan's tiles (players, free
 * time) join this same band later; the drawn ghost tile is not built.
 *
 * ⚖ Read from its OWN route, after "This morning" has rendered (`ready`) — never inside the brief, which loads on every
 * club screen. Loading is the band's own skeleton below the folded content; a failure is one quiet retry line and leaves
 * "This morning" alone; one part that fails costs its own tile ("Didn't load"), not the band.
 * ⚖ The club's money here is Accounting's own definitions; a team's figure is the team's standing WITH THE CLUB, never the
 * coach's books (D1, owner 2026-11-06).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { fmt } from '@/lib/coach-money-summary';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { kit } from '@/components/coaches/kit';
import { CLUB_BAND_WORDS as W, type ClubBand as Band, type ClubBandPart } from '@/lib/club-band-view';
import ck from './ClubKit.module.css';
import styles from './ClubBand.module.css';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; band: Band };

export default function ClubBand({ slug, base, ready }: {
  slug: string;
  base: string;
  /** "This morning" has rendered (or failed): only then does the band ask. The parent mounts this for the owner / club admin only. */
  ready: boolean;
}) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => { setLoad({ state: 'loading' }); setRevision(n => n + 1); }, []);

  useEffect(() => {
    if (!ready || !slug) return;
    const controller = new AbortController();
    fetch(`/api/admin/club-band?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store', signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('band'); return r.json(); })
      .then(band => { if (!controller.signal.aborted) setLoad({ state: 'ready', band: band as Band }); })
      .catch(() => { if (!controller.signal.aborted) setLoad({ state: 'error' }); });
    return () => controller.abort();
  }, [ready, slug, revision]);

  if (load.state === 'error') {
    return (
      <Shell>
        <p className={styles.retry} role="status">
          {W.failed}{' '}
          <button type="button" className={ck.link} onClick={retry}>{W.retry}</button>
        </p>
      </Shell>
    );
  }
  if (load.state === 'loading') {
    // Nothing until "This morning" has rendered; then the band's own skeleton, so the page does not jump twice.
    return ready ? <Shell busy><div className={styles.skeleton} /></Shell> : null;
  }

  const { band } = load;
  // A part that failed costs its own tile ("Didn't load"), not the band. A tile built from two reads (Owed: teams + house
  // league; Needs someone: coach gaps, owing, forms) says "Didn't load" when ANY of them failed, never a figure that is
  // silently low or a "Nothing to chase" that is really "don't know".
  const failedTile = (part: ClubBandPart, label: string) => (band.failed.includes(part) ? <FailedTile key={part} label={label} /> : null);
  const readFailed = (part: ClubBandPart) => band.failed.includes(part);

  // ── Cash on hand ──
  const cash = band.cash ? (
    <DoorTile key="cash" label={W.cash.label} href={`${base}/accounting`}
      figure={band.cash.books === 0 ? W.cash.none : fmt(band.cash.amount)} words={band.cash.books === 0}>
      {band.cash.books > 0 && <span className={styles.caption}>{W.cash.books(band.cash.books)}</span>}
    </DoorTile>
  ) : failedTile('cash', W.cash.label);

  // ── Owed to the club: the teams' Owed (Accounting's) and house league's Still owing, each its own existing figure ──
  let owed: React.ReactNode = failedTile('owed', W.owed.label);
  if (band.owed && !readFailed('owed')) {
    const { teams, league } = band.owed;
    const total = Math.round(((teams?.amount ?? 0) + (league?.amount ?? 0)) * 100) / 100;
    const overdue = teams && teams.overdue > 0 ? fmt(teams.overdue) : null;
    const desk = [
      teams && teams.amount > 0 ? W.owed.teams(fmt(teams.amount), overdue) : null,
      league && league.amount > 0 ? W.owed.league(fmt(league.amount)) : null,
    ].filter(Boolean).join(' · ');
    owed = (
      <DoorTile key="owed" label={W.owed.label} href={`${base}${teams ? '/accounting/teams' : '/accounting'}`}
        figure={total > 0 ? fmt(total) : W.owed.nothing} words={total <= 0} tone={overdue ? 'warn' : undefined}>
        {total > 0 && (
          <span className={styles.caption}>
            <span className={styles.capDesk}>{desk}{teams ? <> · {W.owed.door}</> : null}</span>
            <span className={styles.capPhone}>{overdue ? W.owed.overdueShort(overdue) : desk}</span>
          </span>
        )}
      </DoorTile>
    );
  }

  // ── This week ──
  const week = band.week ? (
    <DoorTile key="week" label={W.week.label} href={`${base}/calendar`}
      figure={band.week.count === 0 ? W.week.nothing : W.week.on(band.week.count)} words={band.week.count === 0}>
      <span className={styles.caption}>
        {band.week.next ? (
          <>
            <span className={styles.capDesk}>{W.week.next(formatShortWeekdayDate(band.week.next.day), band.week.next.who)}</span>
            <span className={styles.capPhone}>{W.week.nextShort(formatShortWeekdayDate(band.week.next.day))}</span>
          </>
        ) : W.week.nothingSoon}
      </span>
    </DoorTile>
  ) : failedTile('week', W.week.label);

  // ── Needs someone: only what "This morning" does not already say ──
  const n = band.needs;
  const lines: { key: string; desk: string; phone: string; href: string }[] = [];
  if (n?.noHeadCoach && n.noHeadCoach.count > 0) {
    lines.push({
      key: 'coach',
      desk: W.needs.noHeadCoach(n.noHeadCoach.count, n.noHeadCoach.firstTeamName),
      phone: W.needs.noHeadCoachShort(n.noHeadCoach.count, n.noHeadCoach.firstTeamName),
      href: n.noHeadCoach.firstTeamId ? `${base}/rep-teams/teams/${n.noHeadCoach.firstTeamId}/coaches` : `${base}/rep-teams`,
    });
  }
  if (n?.leagueOwing && n.leagueOwing.players > 0) {
    lines.push({
      key: 'owing',
      desk: W.needs.leagueOwing(n.leagueOwing.players),
      phone: W.needs.leagueOwingShort(n.leagueOwing.players),
      href: n.leagueOwing.seasonId ? `${base}/house-league/seasons/${n.leagueOwing.seasonId}/money` : `${base}/house-league`,
    });
  }
  if (n?.formsMissing && n.formsMissing.forms > 0) {
    const text = W.needs.formsMissing(n.formsMissing.forms);
    lines.push({ key: 'forms', desk: text, phone: text, href: `${base}/families?show=forms` });
  }
  const needs = n && !readFailed('needs') ? (
    <div key="needs" className={styles.tile}>
      <span className={styles.label}>{W.needs.label}</span>
      {lines.length > 0 ? (
        <ul className={styles.lines}>
          {lines.map(l => (
            <li key={l.key} className={styles.line}>
              <Link href={l.href}>
                <span className={styles.capDesk}>{l.desk}</span>
                <span className={styles.capPhone}>{l.phone}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <span className={styles.caption}>{W.needs.nobody}</span>}
    </div>
  ) : failedTile('needs', W.needs.label);

  // Nothing at all for this reader (no gate passed): the band is not drawn, and does not leave a heading over nothing.
  const tiles = [cash, owed, week, needs].filter(Boolean);
  if (tiles.length === 0) return null;

  return (
    <Shell day={band.today}>
      <div className={styles.band} data-tiles={Math.min(tiles.length, 4)} role="group" aria-label={W.title}>
        {tiles}
      </div>
    </Shell>
  );
}

/** The band's section: the eyebrow (dated once the band has loaded) over whatever the state draws. */
function Shell({ day, busy, children }: { day?: string; busy?: boolean; children: React.ReactNode }) {
  return (
    <section className={ck.section} aria-labelledby="hub-band" aria-busy={busy || undefined}>
      <div className={ck.sectionHead}>
        <span id="hub-band" className={kit.eye}>{day ? W.eyebrow(formatShortWeekdayDate(day)) : W.title}</span>
      </div>
      {children}
    </section>
  );
}

/** A tile that opens its lines: label with the arrow, one figure (words, muted, when there is nothing to count), a caption. */
function DoorTile({ label, href, figure, words, tone, children }: {
  label: string; href: string; figure: string; words?: boolean; tone?: 'warn'; children?: React.ReactNode;
}) {
  return (
    <Link href={href} className={styles.tile}>
      <span className={styles.label}>{label}<ArrowUpRight size={13} aria-hidden className={styles.arrow} /></span>
      {words
        ? <span className={`${styles.figure} ${styles.figureWords}`} data-tone="muted">{figure}</span>
        : <span className={styles.figure} data-tone={tone}>{figure}</span>}
      {children}
    </Link>
  );
}

function FailedTile({ label }: { label: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.figure} ${styles.figureWords}`} data-tone="muted">{W.tileFailed}</span>
    </div>
  );
}
