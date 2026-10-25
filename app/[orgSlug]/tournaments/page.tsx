import { forwardToOwnAddress } from '@/lib/club-forward';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTournamentsByOrg } from '@/lib/db';
import { listClubArchives } from '@/lib/club-archives';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubSiteContent } from '@/lib/club-page-meta';
import { clubTournamentRows } from '@/lib/club-home-data';
import { clubTournamentParts, TOURNAMENT_STATUS_WORD } from '@/lib/club-site-home';
import { isSectionShown } from '@/lib/club-site-sections';
import { siteSectionCarries } from '@/lib/public-site-editor-facts';
import { orgLinks } from '@/lib/org-links';
import { formatEventDateRange, tournamentToday } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import kit from '@/components/public/ClubKit.module.css';
import styles from './ClubTournaments.module.css';

export const dynamic = 'force-dynamic';

/** "Tournaments · Lakeshore Lynx" — the built "page · club" pattern. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, club => ({
    name: 'Tournaments',
    description: `Current, upcoming and past tournaments hosted by ${club.name}.`,
  }), { path: '/tournaments' });
}

/**
 * THE CLUB'S TOURNAMENTS PAGE (Club Tier Stage 4f; drawings ruled 2026-10-25, Asks 1, 4 and 6; words
 * CLUB_TIER_STAGE4F_COPY.md). One page for every tournament the club hosts, behind one tab: Current and upcoming (the
 * home's rows, chips and dates), then Past tournaments — finished ones nobody sealed yet, opening their own sites, then
 * the sealed records, opening their archive pages (`clubTournamentParts` decides which tournament is which, once).
 * It took over the Past tournaments page, whose address forwards here (#past).
 *
 * The club's Tournaments switch covers this page with the home's section and the tab; Past tournaments is its
 * sub-option, and off it leaves only Current and upcoming. A part with nothing in it is absent; with no part at all the
 * page is the club's "not found", as its tab is absent. A failed read is the club's error, never an empty page that
 * would say the club hosts nothing.
 */
export default async function ClubTournamentsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await forwardToOwnAddress(orgSlug, '/tournaments');
  // The one rule (Club Tier Stage 4a): the site open and the plan carrying tournaments.
  const org = await requirePublicClubPage(orgSlug, 'tournaments');

  // The tournaments read starts with the switches' read; the sealed list waits for them (it is skipped while hidden).
  const tournamentsRead = getTournamentsByOrg(org.id, { strict: true });
  tournamentsRead.catch(() => {}); // awaited below; this only keeps a refusal above from leaving it unhandled
  const siteContent = await getClubSiteContent(org.id);
  const prefs = { order: siteContent?.homeSectionOrder, hidden: siteContent?.homeSectionsHidden };
  const carries = siteSectionCarries(org);
  if (!isSectionShown('tournaments', prefs, carries)) notFound();
  const pastShown = isSectionShown('archives', prefs, carries);

  const today = tournamentToday();
  const [all, archives] = await Promise.all([
    tournamentsRead,
    pastShown ? listClubArchives(org.id, { strict: true }) : Promise.resolve([]),
  ]);
  const parts = clubTournamentParts(all, archives, today);
  const href = await orgLinks(orgSlug);

  // Past tournaments, one shape for both kinds. A finished one not sealed yet opens its own site and has no figures on
  // file ("—"); its dates always carry the year, because the past is read across years. A sealed one opens its record.
  const past: PastRow[] = !pastShown ? [] : [
    ...parts.finished.map(t => ({
      key: t.id, href: href(`/${t.slug}`), name: t.name,
      season: (t.endDate ?? t.startDate)?.slice(0, 4) ?? String(t.year),
      sub: formatEventDateRange(t.startDate, t.endDate, true),
      division: null, champion: null, teams: null, games: null, facts: null,
    })),
    ...parts.archives.map(a => ({
      key: a.id, href: href(`/archives/${a.id}`), name: a.tournamentName, season: a.season,
      sub: [a.season, a.division].filter(Boolean).join(' · ') || null,
      division: a.division, champion: a.winnerTeamName, teams: a.totalTeams, games: a.totalGames,
      facts: [
        a.totalTeams != null ? pluralize(a.totalTeams, 'team') : null,
        a.totalGames != null ? pluralize(a.totalGames, 'game') : null,
      ].filter(Boolean).join(' · ') || null,
    })),
  ];
  const count = parts.current.length + past.length;
  if (count === 0) notFound();
  const current = await clubTournamentRows(parts.current, today, href);

  return (
    <div className={styles.column}>
      <div className={styles.title}>
        <h1 className={kit.title}>Tournaments</h1>
        <p className={kit.sub}>{pluralize(count, 'tournament')}</p>
      </div>

      {current.length > 0 && (
        <section className={kit.section} aria-labelledby="current">
          <h2 id="current" className={kit.sectionTitle}>Current and upcoming</h2>
          {/* Phone: the home's rows, chip and all. */}
          <div className={`${kit.list} ${styles.phone}`}>
            {current.map(t => (
              <Link key={t.id} href={t.href} className={`${kit.row} ${kit.rowStack}`}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{t.name}</span>
                  {t.dates && <span className={kit.rowSub}>{t.dates}</span>}
                </span>
                {t.status && <span className={`${kit.chip} ${kit.chipOk}`}>{TOURNAMENT_STATUS_WORD[t.status]}</span>}
              </Link>
            ))}
          </div>
          {/* Desk: Tournament · Dates · Status. The name is the link; the row is the shortcut. */}
          <div className={`${kit.list} ${styles.desk}`}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Tournament</th><th scope="col">Dates</th><th scope="col">Status</th><th aria-hidden="true" /></tr>
              </thead>
              <tbody>
                {current.map(t => (
                  <tr key={t.id} className={styles.tableRow}>
                    <td><Link href={t.href} className={styles.nameLink}>{t.name}</Link></td>
                    <td>{t.dates ?? '—'}</td>
                    <td>{t.status ? <span className={`${kit.chip} ${kit.chipOk}`}>{TOURNAMENT_STATUS_WORD[t.status]}</span> : '—'}</td>
                    <td className={styles.chev} aria-hidden="true" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className={kit.section} aria-labelledby="past">
          <h2 id="past" className={kit.sectionTitle}>Past tournaments</h2>
          {/* Phone: one recipe — the name, then its dates (not sealed yet) or its season and division, then a sealed
              record's champion and counts on lines of their own. No chip: the heading says they are finished. */}
          <div className={`${kit.list} ${styles.phone}`}>
            {past.map(r => (
              <Link key={r.key} href={r.href} className={kit.row}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{r.name}</span>
                  {r.sub && <span className={kit.rowSub}>{r.sub}</span>}
                  {r.champion && <span className={kit.rowSub}>Champion: <span className={styles.champion}>{r.champion}</span></span>}
                  {r.facts && <span className={kit.rowSub}>{r.facts}</span>}
                </span>
              </Link>
            ))}
          </div>
          {/* Desk: the built Past tournaments table; a figure not on file is "—". */}
          <div className={`${kit.list} ${styles.desk}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Season</th><th scope="col">Tournament</th><th scope="col">Division</th>
                  <th scope="col">Champion</th><th scope="col" className={styles.num}>Teams</th>
                  <th scope="col" className={styles.num}>Games</th><th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {past.map(r => (
                  <tr key={r.key} className={styles.tableRow}>
                    <td>{r.season}</td>
                    <td><Link href={r.href} className={styles.nameLink}>{r.name}</Link></td>
                    <td>{r.division ?? '—'}</td>
                    <td className={r.champion ? styles.championCell : undefined}>{r.champion ?? '—'}</td>
                    <td className={styles.num}>{r.teams ?? '—'}</td>
                    <td className={styles.num}>{r.games ?? '—'}</td>
                    <td className={styles.chev} aria-hidden="true" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/** A Past tournaments row, either kind (a finished tournament not sealed yet, or a sealed record). */
interface PastRow {
  key: string;
  href: string;
  name: string;
  season: string;
  /** The phone row's line under the name: the dates, or the season and division. */
  sub: string | null;
  division: string | null;
  champion: string | null;
  teams: number | null;
  games: number | null;
  /** The phone row's counts line ("18 teams · 41 games"). */
  facts: string | null;
}
