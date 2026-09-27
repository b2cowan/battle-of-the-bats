'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueStandingsRow } from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const STANDINGS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Rank', key: 'rank',           format: 'number' },
  { label: 'Team', key: 'teamName',       format: 'text'   },
  { label: 'GP',   key: 'gamesPlayed',    format: 'number' },
  { label: 'W',    key: 'wins',           format: 'number' },
  { label: 'L',    key: 'losses',         format: 'number' },
  { label: 'T',    key: 'ties',           format: 'number' },
  { label: 'Pts',  key: 'points',         format: 'number' },
  { label: 'GF',   key: 'runsFor',        format: 'number' },
  { label: 'GA',   key: 'runsAgainst',    format: 'number' },
  { label: 'Diff', key: 'runDifferential',format: 'number' },
];

interface SeasonInfo { id: string; name: string; }

export default function StandingsPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, user, userRole, userCapabilities } = useOrg();
  // Admin Design Continuity slice 2: the kit's patch over each hand-set style while the switch is on.
  const kx = useKitStyle();
  // J3-012: every /api/admin fetch must carry the org slug so the server resolves the URL's org.
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const canView = hasCapability(userRole ?? 'staff', userCapabilities ?? null, 'module_house_league');

  const [season, setSeason]         = useState<SeasonInfo | null>(null);
  const [divisions, setDivisions]   = useState<LeagueDivision[]>([]);
  const [selectedDiv, setSelectedDiv] = useState<string>('');
  const [standings, setStandings]   = useState<LeagueStandingsRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Load season + divisions
  useEffect(() => {
    if (!canView) return;
    fetch(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`)
      .then(r => r.json())
      .then(d => {
        if (d.season) setSeason({ id: d.season.id, name: d.season.name });
        if (d.divisions?.length) {
          setDivisions(d.divisions);
          setSelectedDiv(d.divisions[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [seasonId, canView, orgQuery]);

  // Load standings when division changes
  const loadStandings = useCallback(async (divId: string) => {
    if (!divId) return;
    setStandingsLoading(true);
    try {
      const orgParam = orgQuery ? orgQuery.replace('?', '&') : '';
      const r = await fetch(
        `/api/admin/house-league/seasons/${seasonId}/standings?divisionId=${divId}${orgParam}`,
      );
      const d = await r.json();
      setStandings(d.standings ?? []);
    } finally {
      setStandingsLoading(false);
    }
  }, [seasonId, orgQuery]);

  useEffect(() => {
    if (selectedDiv) loadStandings(selectedDiv);
  }, [selectedDiv, loadStandings]);

  // ── Export ──────────────────────────────────────────────────────────────────

  const selectedDivName = divisions.find(d => d.id === selectedDiv)?.name;

  function buildStandingsExportRows() {
    return standings.map((row, i) => ({
      rank:            i + 1,
      teamName:        row.team.name,
      gamesPlayed:     row.gamesPlayed,
      wins:            row.wins,
      losses:          row.losses,
      ties:            row.ties,
      points:          row.points,
      runsFor:         row.runsFor,
      runsAgainst:     row.runsAgainst,
      runDifferential: row.runDifferential,
    }));
  }

  function handleExportXLSX() {
    const rows     = buildStandingsExportRows();
    const headers  = serializeHeaders(STANDINGS_EXPORT_COLS);
    const data     = serializeRows(rows, STANDINGS_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'standings', scope: season?.name ?? selectedDivName },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Standings');
  }

  function handleExportCSV() {
    const rows     = buildStandingsExportRows();
    const headers  = serializeHeaders(STANDINGS_EXPORT_COLS);
    const data     = serializeRows(rows, STANDINGS_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'standings', scope: season?.name ?? selectedDivName },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  if (!user) return null;
  if (!canView) {
    return (
      <div className={styles.page}>
        <p style={kx({ color: 'var(--white-40)', fontSize: '0.9rem' }, KIT_INK.tertiary)}>
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={styles.page}>
        <p style={kx({ color: 'var(--white-40)', fontSize: '0.9rem' }, KIT_INK.tertiary)}>Loading…</p>
      </div>
    );
  }

  // The table's row styles, built once per render rather than once per row (slice 2 /simplify).
  const leaderRowStyle = kx({ background: 'rgba(var(--logic-lime-rgb),0.04)' }, { background: 'var(--home-olive-soft)' });
  const rankCellStyle = kx({ textAlign: 'center', color: 'var(--white-30)', fontWeight: 600 }, KIT_INK.tertiary);
  const leaderNameStyle = kx({ fontWeight: 600, color: 'var(--logic-lime)' }, KIT_INK.accent);
  const teamNameStyle = kx({ fontWeight: 600, color: '#f0f0f0' }, KIT_INK.primary);

  return (
    <div className={styles.page}>
      {/* Header — today's as `legacy` while the switch is off. On the kit the breadcrumb becomes the
          eyebrow (still a link to House league) and the way up to the season (F3). */}
      <AdminPageHeader
        crumbs={[{ href: `/${orgSlug}/admin/house-league`, label: 'House league' }]}
        title="Standings"
        backTo={season ? { href: `/${orgSlug}/admin/house-league/seasons/${seasonId}`, label: season.name } : undefined}
        legacy={
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}>
            <BarChart2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--white-40)', marginBottom: '0.2rem' }}>
              <Link href={`/${orgSlug}/admin/house-league`} style={{ color: 'inherit', textDecoration: 'none' }}>
                House League
              </Link>
              {season && (
                <>
                  {' / '}
                  <Link
                    href={`/${orgSlug}/admin/house-league/seasons/${seasonId}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {season.name}
                  </Link>
                </>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f0f0f0' }}>
              Standings
            </h1>
          </div>
        </div>
      </div>
        }
      />

      {/* Toolbar */}
      <div className={styles.scheduleToolbar}>
        {divisions.length > 1 && (
          <select
            className={styles.divSelect}
            value={selectedDiv}
            onChange={e => setSelectedDiv(e.target.value)}
          >
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={standings.length === 0}
          />
        </div>
      </div>

      {/* Standings table */}
      {standingsLoading ? (
        <p style={kx({ color: 'var(--white-40)', fontSize: '0.9rem' }, KIT_INK.tertiary)}>Loading standings…</p>
      ) : standings.length === 0 ? (
        <div style={kx({
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          border: '1px dashed var(--white-10)',
          borderRadius: '2px',
          color: 'var(--white-35)',
          fontSize: '0.9rem',
        }, KIT_SURFACE.empty)}>
          No completed games yet — standings will appear once scores are entered.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th style={{ width: '2.5rem', textAlign: 'center' }}>#</th>
                <th>Team</th>
                <th style={{ textAlign: 'center' }}>GP</th>
                <th style={{ textAlign: 'center' }}>W</th>
                <th style={{ textAlign: 'center' }}>L</th>
                <th style={{ textAlign: 'center' }}>T</th>
                <th style={{ textAlign: 'center' }}>Pts</th>
                <th style={{ textAlign: 'center' }}>GF</th>
                <th style={{ textAlign: 'center' }}>GA</th>
                <th style={{ textAlign: 'center' }}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team.id} style={i === 0 ? leaderRowStyle : undefined}>
                  <td style={rankCellStyle}>
                    {i + 1}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      {row.team.color && (
                        <span className={styles.teamDot} style={{ background: row.team.color }} />
                      )}
                      <span style={i === 0 ? leaderNameStyle : teamNameStyle}>
                        {row.team.name}
                      </span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{row.gamesPlayed}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.wins}</td>
                  <td style={{ textAlign: 'center' }}>{row.losses}</td>
                  <td style={{ textAlign: 'center' }}>{row.ties}</td>
                  <td className={styles.scoreCell} style={{ textAlign: 'center' }}>{row.points}</td>
                  <td style={{ textAlign: 'center' }}>{row.runsFor}</td>
                  <td style={{ textAlign: 'center' }}>{row.runsAgainst}</td>
                  <td style={{
                    textAlign: 'center',
                    fontWeight: 600,
                    color: row.runDifferential > 0
                      ? 'var(--success-light)'
                      : row.runDifferential < 0
                        ? 'var(--danger-light)'
                        : 'var(--white-40)',
                  }}>
                    {row.runDifferential > 0 ? '+' : ''}{row.runDifferential}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {standings.length > 0 && (
        <p style={kx({ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--white-30)' }, KIT_INK.tertiary)}>
          Pts: W=2, T=1, L=0 &nbsp;·&nbsp; Tiebreaker: run differential, then runs for
        </p>
      )}
    </div>
  );
}
