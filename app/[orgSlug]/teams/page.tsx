import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { clubTeamsAddress, isPublicClubSiteOpen } from '@/lib/public-club-access';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { forwardClubShortcut } from '@/lib/club-shortcut';
import { clubPageMetadata, getClubBySlug } from '@/lib/club-page-meta';
import { readClubLeagueDivisions, readClubTeams } from '@/lib/club-public-teams';
import { bornPickOf, bornPlacesSentence, joinSub, keepsBornYear } from '@/lib/club-born-public';
import { tournamentToday } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import BornInPill from '@/components/public/BornInPill';
import kit from '@/components/public/ClubKit.module.css';
import styles from './ClubTeams.module.css';

export const dynamic = 'force-dynamic';

/** "Teams · Lakeshore Lynx" — the Teams page names itself like every club page (End state 8). An org whose `/teams` is
 *  still the shortcut forwards before anything renders, so its title is never seen. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'Teams');
}

/**
 * THE CLUB'S TEAMS PAGE (Club Tier Stage 4b-2a; End state 2, Asks 4A + 9A, ruled 2026-10-19). Until 4b-2a this address
 * was a shortcut into the running tournament's visiting teams — which a club's family read as "the club's teams" (S4-07).
 *
 * Every team the club fields that is not archived, under the club's own groups (the admin's group on each team; a club
 * with no groups gets one list), each saying whether its tryouts are open — from the one public tryout rule, so there is
 * nothing to keep up to date. Phone: one frame of hairlined rows, the whole row the door. Desk: a table, Team ·
 * Tryouts, because the Tryouts column answers the question. NOT on a row: players (never, on any public page), coaches
 * (the team page, when they opt in — 4c), the division where the band already says it. An archived team is not listed,
 * but its page still opens for old links.
 *
 * Stage 4c-2: each team says which birth years it is for ("Born 2012–2013", from `lib/born-years.ts` — nothing here
 * formats it), and one pick-one pill, Born in, narrows the page to a year (`?born=2015`, so a filtered list can be
 * shared): it keeps the teams whose years overlap that year, every team with none, and adds the club's house-league
 * divisions for it under their own band. The meta then counts places — a team or a division.
 */
export default async function ClubTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ born?: string | string[] }>;
}) {
  const { orgSlug } = await params;

  // Wherever there is no Teams page to show, the address stays the old shortcut — printed tournament links and QR codes
  // carry `/{org}/teams` — forwarding into the running tournament, else the club's "not found" (Ask 9A): an org whose plan
  // does not carry the page, a club whose site is switched off (tournament pages stay up when it is, BUSINESS_DECISIONS
  // 2026-07-22; with nothing running, the "not found" is the refusal), and a club that lists no team (below).
  // (The layout's own read of the club, cached for the request — no second query to decide.)
  const probe = await getClubBySlug(orgSlug);
  if (!probe || clubTeamsAddress(probe) === 'shortcut' || !isPublicClubSiteOpen(probe)) return forwardClubShortcut(orgSlug, 'teams');

  // The one rule (Club Tier Stage 4a).
  const org = await requirePublicClubPage(orgSlug, 'teams');

  // A failed house-league read costs the divisions a pick would add, never the page.
  const [{ bands, count }, league] = await Promise.all([
    readClubTeams(org.id, org.birthdayCutoffs),
    readClubLeagueDivisions(org, orgSlug).catch(() => null),
  ]);
  // A club that lists no team has no Teams tab and no list to show — never "0 teams".
  if (count === 0) return forwardClubShortcut(orgSlug, 'teams');
  const href = (slug: string) => `/${orgSlug}/teams/${slug}`;

  // Born in: the menu offers every year a team or a house-league division names; no year, no pill. A pick narrows the
  // teams (a team with no years always stays) and adds the divisions for that year, under their own band.
  const { menu, pick } = bornPickOf(
    [...bands.flatMap(b => b.teams.map(t => t.born)), ...(league?.divisions.map(d => d.born) ?? [])],
    (await searchParams).born,
    Number(tournamentToday().slice(0, 4)),
  );
  // Each row's line under its name is worked out once; the phone list and the desk table both draw it.
  const shown = (pick == null ? bands : bands
    .map(b => ({ ...b, teams: b.teams.filter(t => keepsBornYear(t.born, pick)) }))
    .filter(b => b.teams.length > 0))
    .map(b => ({ ...b, teams: b.teams.map(t => ({ ...t, sub: joinSub([t.born.line, t.division]) })) }));
  const divisions = pick == null || !league ? [] : league.divisions.filter(d => keepsBornYear(d.born, pick));
  const places = shown.reduce((n, b) => n + b.teams.length, 0) + divisions.length;
  const divisionRows = divisions.map(d => ({
    key: d.id,
    name: `${d.name} house league`,
    sub: joinSub([d.born.line, league?.seasonWords]),
  }));

  return (
    <div className={styles.column}>
      <div className={styles.title}>
        <h1 className={kit.title}>Teams</h1>
        <p className={kit.sub}>{pick == null ? pluralize(count, 'team') : bornPlacesSentence(places, pick)}</p>
      </div>

      {menu.length > 0 && <BornInPill path={`/${orgSlug}/teams`} years={menu} picked={pick} />}

      {places > 0 && <>
      {/* Phone: the table standard's phone form — one frame, the whole row the door, the chevron last. */}
      <div className={`${kit.list} ${styles.phone}`}>
        {shown.map((band, i) => (
          <Fragment key={i}>
            {band.name && <div className={kit.listBand}>{band.name}</div>}
            {band.teams.map(t => (
              <Link key={t.slug} href={href(t.slug)} className={kit.row}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{t.name}</span>
                  {t.sub && <span className={kit.rowSub}>{t.sub}</span>}
                </span>
                {t.tryoutsOpen && <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>}
              </Link>
            ))}
          </Fragment>
        ))}
        {league && divisionRows.length > 0 && (
          <>
            <div className={kit.listBand}>House league</div>
            {divisionRows.map(r => (
              <Link key={r.key} href={league.href} className={kit.row}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{r.name}</span>
                  {r.sub && <span className={kit.rowSub}>{r.sub}</span>}
                </span>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Desk: a table. The name is the link; the row is the shortcut; one chevron column. */}
      <div className={`${kit.list} ${styles.desk}`}>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">Team</th><th scope="col">Tryouts</th><th aria-hidden="true" /></tr>
          </thead>
          {shown.map((band, i) => (
            <tbody key={i}>
              {band.name && <tr className={styles.bandRow}><th scope="colgroup" colSpan={3} className={kit.listBand}>{band.name}</th></tr>}
              {band.teams.map(t => (
                <tr key={t.slug} className={styles.teamRow}>
                  <td>
                    <Link href={href(t.slug)} className={styles.teamLink}>{t.name}</Link>
                    {t.sub && <span className={kit.rowSub}>{t.sub}</span>}
                  </td>
                  <td>
                    {t.tryoutsOpen
                      ? <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>
                      : <><span aria-hidden="true" className={styles.none}>—</span><span className={kit.srOnly}>Not taking sign-ups</span></>}
                  </td>
                  <td className={styles.chev} aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          ))}
          {league && divisionRows.length > 0 && (
            <tbody>
              <tr className={styles.bandRow}><th scope="colgroup" colSpan={3} className={kit.listBand}>House league</th></tr>
              {divisionRows.map(r => (
                <tr key={r.key} className={styles.teamRow}>
                  <td>
                    <Link href={league.href} className={styles.teamLink}>{r.name}</Link>
                    {r.sub && <span className={kit.rowSub}>{r.sub}</span>}
                  </td>
                  <td><span aria-hidden="true" className={styles.none}>—</span></td>
                  <td className={styles.chev} aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      </>}
    </div>
  );
}
