import { forwardToOwnAddress } from '@/lib/club-forward';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getArchivesByOrg } from '@/lib/db';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import kit from '@/components/public/ClubKit.module.css';
import styles from './archives.module.css';

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'Past tournaments', { path: '/archives' });
}

// The whole row is the link, so each cell's link fills it and stays a 44px tap target on a phone.
const cellLink = {
  color: 'inherit',
  textDecoration: 'none',
  display: 'block',
  padding: '0.75rem 1.5rem 0.75rem 0',
  minHeight: '44px',
  boxSizing: 'border-box',
} as const;

export default async function ArchivesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await forwardToOwnAddress(orgSlug, '/archives');
  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts).
  const org = await requirePublicClubPage(orgSlug, 'archives');
  const href = await orgLinks(orgSlug);

  const archives = await getArchivesByOrg(org.id);

  return (
    // The pages' own column (`.container`): the club's bar takes the same edge, so the heading sits under its logo.
    <div className="container" style={{ paddingBlock: '2rem 5rem', fontFamily: 'var(--club-text-face)', color: 'var(--club-text)' }}>
      <div style={{ maxWidth: '1100px' }}>

        {/* Page header */}
        <div
          style={{
            borderBottom: '1px solid var(--club-line)',
            paddingBottom: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          <h1 className={kit.title} style={{ margin: 0 }}>
            Past tournaments
          </h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)', marginTop: '0.375rem' }}>
            Tournaments {org.name} has hosted
          </div>
        </div>

        {archives.length === 0 ? (
          <div className={kit.empty}>
            No past tournaments yet.
          </div>
        ) : (
          <>
          {/* A phone: one stacked row per tournament, nothing scrolled sideways. */}
          <ul className={styles.stack}>
            {archives.map(a => {
              const facts = [
                a.totalTeams != null ? `${a.totalTeams} ${a.totalTeams === 1 ? 'team' : 'teams'}` : null,
                a.totalGames != null ? `${a.totalGames} ${a.totalGames === 1 ? 'game' : 'games'}` : null,
              ].filter(Boolean);
              const where = [a.season, a.division].filter(Boolean);
              return (
                <li key={a.id} className={styles.stackRow}>
                  <Link href={href(`/archives/${a.id}`)} className={styles.stackLink}>
                    <span className={styles.stackName}>{a.tournamentName}</span>
                    {where.length > 0 && <span className={styles.stackLine}>{where.join(' · ')}</span>}
                    {a.winnerTeamName && (
                      <span className={styles.stackLine}>
                        Champion: <span className={styles.stackChampion}>{a.winnerTeamName}</span>
                      </span>
                    )}
                    {facts.length > 0 && <span className={styles.stackLine}>{facts.join(' · ')}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className={styles.tableWrap} style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--club-line-2)' }}>
                  <th className={kit.band} style={{ textAlign: 'left', paddingRight: '1.5rem', paddingBottom: '0.625rem' }}>Season</th>
                  <th className={kit.band} style={{ textAlign: 'left', paddingRight: '1.5rem', paddingBottom: '0.625rem' }}>Tournament</th>
                  <th className={kit.band} style={{ textAlign: 'left', paddingRight: '1.5rem', paddingBottom: '0.625rem' }}>Division</th>
                  <th className={kit.band} style={{ textAlign: 'left', paddingRight: '1.5rem', paddingBottom: '0.625rem' }}>Champion</th>
                  <th className={kit.band} style={{ textAlign: 'right', paddingRight: '1.5rem', paddingBottom: '0.625rem' }}>Teams</th>
                  <th className={kit.band} style={{ textAlign: 'right', paddingBottom: '0.625rem' }}>Games</th>
                </tr>
              </thead>
              <tbody>
                {archives.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--club-line)' }}>
                    <td style={{ color: 'var(--club-soft)' }}>
                      <Link href={href(`/archives/${a.id}`)} style={cellLink}>
                        {a.season}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--club-text)' }}>
                      <Link href={href(`/archives/${a.id}`)} style={cellLink}>
                        {a.tournamentName}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--club-soft)' }}>
                      <Link href={href(`/archives/${a.id}`)} style={cellLink}>
                        {a.division ?? '—'}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--club-text)', fontWeight: 700 }}>
                      <Link href={href(`/archives/${a.id}`)} style={cellLink}>
                        {a.winnerTeamName ?? '—'}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--club-soft)' }}>
                      <Link href={href(`/archives/${a.id}`)} style={cellLink}>
                        {a.totalTeams ?? '—'}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--club-soft)' }}>
                      <Link href={href(`/archives/${a.id}`)} style={{ ...cellLink, paddingRight: 0 }}>
                        {a.totalGames ?? '—'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
