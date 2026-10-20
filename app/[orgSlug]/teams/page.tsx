import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { clubTeamsAddress, isPublicClubSiteOpen } from '@/lib/public-club-access';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { forwardClubShortcut } from '@/lib/club-shortcut';
import { clubPageMetadata, getClubBySlug } from '@/lib/club-page-meta';
import { readClubTeams } from '@/lib/club-public-teams';
import { pluralize } from '@/lib/utils';
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
 */
export default async function ClubTeamsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
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

  const { bands, count } = await readClubTeams(org.id);
  // A club that lists no team has no Teams tab and no list to show — never "0 teams".
  if (count === 0) return forwardClubShortcut(orgSlug, 'teams');
  const href = (slug: string) => `/${orgSlug}/teams/${slug}`;

  return (
    <div className={styles.column}>
      <div className={styles.title}>
        <h1 className={kit.title}>Teams</h1>
        <p className={kit.sub}>{pluralize(count, 'team')}</p>
      </div>

      {/* Phone: the table standard's phone form — one frame, the whole row the door, the chevron last. */}
      <div className={`${kit.list} ${styles.phone}`}>
        {bands.map((band, i) => (
          <Fragment key={i}>
            {band.name && <div className={kit.listBand}>{band.name}</div>}
            {band.teams.map(t => (
              <Link key={t.slug} href={href(t.slug)} className={kit.row}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{t.name}</span>
                  {t.division && <span className={kit.rowSub}>{t.division}</span>}
                </span>
                {t.tryoutsOpen && <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>}
              </Link>
            ))}
          </Fragment>
        ))}
      </div>

      {/* Desk: a table. The name is the link; the row is the shortcut; one chevron column. */}
      <div className={`${kit.list} ${styles.desk}`}>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">Team</th><th scope="col">Tryouts</th><th aria-hidden="true" /></tr>
          </thead>
          {bands.map((band, i) => (
            <tbody key={i}>
              {band.name && <tr className={styles.bandRow}><th scope="colgroup" colSpan={3} className={kit.listBand}>{band.name}</th></tr>}
              {band.teams.map(t => (
                <tr key={t.slug} className={styles.teamRow}>
                  <td>
                    <Link href={href(t.slug)} className={styles.teamLink}>{t.name}</Link>
                    {t.division && <span className={kit.rowSub}>{t.division}</span>}
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
        </table>
      </div>
    </div>
  );
}
