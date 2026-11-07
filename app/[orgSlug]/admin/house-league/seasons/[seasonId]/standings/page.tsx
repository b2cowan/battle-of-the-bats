'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
import styles from '../../../house-league.module.css';
import type { LeagueDivision } from '@/lib/types';
import { STANDINGS_WORDS as W, diffWords, type LeagueStandings, type StandingsLabels } from '@/lib/league-standings';
import LoadingState from '@/components/shared/LoadingState';
import { NotYours } from '@/components/admin/kit/club/NotYours';

// ── Export definition ─────────────────────────────────────────────────────────

/** The export's columns follow the season's sport (RF / RA / RD for ball, 9e·2); a shared place reads "T-3", as on screen. */
function standingsExportCols(l: StandingsLabels): ExportColumnDef[] {
  return [
    { label: 'Rank', key: 'rank',           format: 'text'   },
    { label: 'Team', key: 'teamName',       format: 'text'   },
    { label: 'GP',   key: 'gamesPlayed',    format: 'number' },
    { label: 'W',    key: 'wins',           format: 'number' },
    { label: 'L',    key: 'losses',         format: 'number' },
    { label: 'T',    key: 'ties',           format: 'number' },
    { label: 'Pts',  key: 'points',         format: 'number' },
    { label: l.forAbbr,     key: 'runsFor',         format: 'number' },
    { label: l.againstAbbr, key: 'runsAgainst',     format: 'number' },
    { label: l.diffAbbr,    key: 'runDifferential', format: 'number' },
    { label: W.admin.levelCol, key: 'levelWith', format: 'text' },
  ];
}

interface SeasonInfo { id: string; name: string; }
/** What families can see of the division (the route's answer). */
interface DivisionState { name: string; published: boolean; showStandings: boolean }

export default function StandingsPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, user } = useOrg();
  // Admin Design Continuity slice 2: the kit's patch over each hand-set style while the switch is on.
  const kx = useKitStyle();
  // J3-012: every /api/admin fetch must carry the org slug so the server resolves the URL's org.
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  // Who may read (the one house-league gate, Stage 9a): everyone who opens house league.
  const canView = !!useHouseLeagueAccess()?.read;

  const [season, setSeason]         = useState<SeasonInfo | null>(null);
  const [divisions, setDivisions]   = useState<LeagueDivision[]>([]);
  const [selectedDiv, setSelectedDiv] = useState<string>('');
  const [standings, setStandings]   = useState<LeagueStandings | null>(null);
  const [divState, setDivState]     = useState<DivisionState | null>(null);
  const [loading, setLoading]       = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);
  // A table that failed to load reads as empty, not as loading forever.
  const [loadFailed, setLoadFailed] = useState(false);
  // Only the newest request may write: a slower answer for the division just left is dropped.
  const latestLoad = useRef(0);

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
    const mine = ++latestLoad.current;
    setStandingsLoading(true);
    setLoadFailed(false);
    setStandings(null);
    setDivState(null);
    try {
      const orgParam = orgQuery ? orgQuery.replace('?', '&') : '';
      const r = await fetch(
        `/api/admin/house-league/seasons/${seasonId}/standings?divisionId=${divId}${orgParam}`,
      );
      const d = await r.json().catch(() => ({}));
      if (mine !== latestLoad.current) return;
      setStandings(d.standings ?? null);
      setDivState(d.division ?? null);
      setLoadFailed(!r.ok || !d.standings);
    } catch {
      if (mine === latestLoad.current) setLoadFailed(true);
    } finally {
      if (mine === latestLoad.current) setStandingsLoading(false);
    }
  }, [seasonId, orgQuery]);

  useEffect(() => {
    if (selectedDiv) loadStandings(selectedDiv);
  }, [selectedDiv, loadStandings]);

  // ── Export ──────────────────────────────────────────────────────────────────

  const selectedDivName = divisions.find(d => d.id === selectedDiv)?.name;

  const rows = standings?.rows ?? [];
  const scored = !!standings?.scored;

  function buildStandingsExportRows() {
    return rows.map(row => ({
      rank:            row.place == null ? '' : W.place(row.place, row.tied),
      teamName:        row.team.name,
      gamesPlayed:     row.gamesPlayed,
      wins:            row.wins,
      losses:          row.losses,
      ties:            row.ties,
      points:          row.points,
      runsFor:         row.runsFor,
      runsAgainst:     row.runsAgainst,
      runDifferential: row.runDifferential,
      levelWith:       W.admin.levelCell(row.levelWith.map(t => t.name)),
    }));
  }

  function buildExport(ext: 'xlsx' | 'csv') {
    const exportCols = standingsExportCols(standings!.labels);
    return {
      headers: serializeHeaders(exportCols),
      data: serializeRows(buildStandingsExportRows(), exportCols),
      filename: buildFilename(
        { org: currentOrg?.slug, dataset: 'standings', scope: season?.name ?? selectedDivName },
        ext,
      ),
    };
  }

  function handleExportXLSX() {
    const { headers, data, filename } = buildExport('xlsx');
    downloadXLSX(filename, headers, data, 'Standings');
  }

  function handleExportCSV() {
    const { headers, data, filename } = buildExport('csv');
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  if (!user) return null;
  if (!canView) return <NotYours page="houseLeague" />;
  if (loading) {
    return (
      <div className={styles.page}>
        <LoadingState label="Loading standings…" />
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
            disabled={!scored}
          />
        </div>
      </div>

      {/* What families can't see (9e·4, 9e·5): said above the table, which the club always sees. */}
      {divState && !standingsLoading && (!divState.showStandings ? (
        <p className={styles.standNote} role="note">{W.admin.noteOff(divState.name)}</p>
      ) : !divState.published ? (
        <p className={styles.standNote} role="note">{W.admin.noteUnpub(divState.name)}</p>
      ) : null)}

      {/* Standings table */}
      {standingsLoading || (!!selectedDiv && !standings && !loadFailed) ? (
        <LoadingState label="Loading standings…" />
      ) : !scored ? (
        <div style={kx({
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          border: '1px dashed var(--white-10)',
          borderRadius: '2px',
          color: 'var(--white-35)',
          fontSize: '0.9rem',
        }, KIT_SURFACE.empty)}>
          {W.admin.empty}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th scope="col" style={{ width: '2.5rem', textAlign: 'center' }}>{W.col.rank}</th>
                <th scope="col">{W.col.team}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.gp}>{W.col.gp}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.w}>{W.col.w}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.l}>{W.col.l}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.t}>{W.col.t}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.pts}>{W.col.pts}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={standings.labels.forName}>{standings.labels.forAbbr}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={standings.labels.againstName}>{standings.labels.againstAbbr}</th>
                <th scope="col" style={{ textAlign: 'center' }} title={W.tip.diff(standings.labels)}>{standings.labels.diffAbbr}</th>
                <th scope="col" title={W.admin.levelTip(standings.labels)}>{W.admin.levelCol}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const lead = row.place === 1;
                // A team with no counted game reads dashes, not zeros (copy §1.1).
                const dash = <span className={styles.standDash} title={W.tip.dash}>{W.dash}</span>;
                const n = (v: number) => (row.counted ? v : dash);
                return (
                  <tr key={row.team.id} style={lead ? leaderRowStyle : undefined}>
                    <td style={rankCellStyle} title={row.tied ? W.placeTip(row.place!) : undefined}>
                      {W.place(row.place!, row.tied)}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                        {row.team.color && (
                          <span className={styles.teamDot} style={{ background: row.team.color }} />
                        )}
                        <span style={lead ? leaderNameStyle : teamNameStyle}>
                          {row.team.name}
                        </span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{n(row.gamesPlayed)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{n(row.wins)}</td>
                    <td style={{ textAlign: 'center' }}>{n(row.losses)}</td>
                    <td style={{ textAlign: 'center' }}>{n(row.ties)}</td>
                    <td className={styles.scoreCell} style={{ textAlign: 'center' }}>{n(row.points)}</td>
                    <td style={{ textAlign: 'center' }}>{n(row.runsFor)}</td>
                    <td style={{ textAlign: 'center' }}>{n(row.runsAgainst)}</td>
                    <td style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      color: row.runDifferential > 0
                        ? 'var(--success-light)'
                        : row.runDifferential < 0
                          ? 'var(--danger-light)'
                          : 'var(--text-tertiary)', // 0 differential: --white-40 was 3.77:1 on Dark
                    }}>
                      {row.counted ? diffWords(row.runDifferential) : dash}
                    </td>
                    <td title={row.tied ? W.admin.levelTip(standings.labels) : undefined}>
                      {row.tied ? W.admin.levelCell(row.levelWith.map(t => t.name)) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* "How the table is ranked" (9e·2): the rules the public page shows, built from what the table sorts by. */}
      {standings && scored && !standingsLoading && (
        <div className={styles.rankBox}>
          <b>{W.rank.title}</b>
          <p>{W.rank.points(standings.rules.pointsPerWin, standings.rules.pointsPerDraw)}</p>
          <ol>{standings.rules.steps.map(step => <li key={step}>{W.rank.step(step, standings.labels)}</li>)}</ol>
          <p>{W.rank.shared}</p>
          <p className={styles.rankBoxHint}>{W.admin.rules(standings.labels.sport)}</p>
        </div>
      )}
    </div>
  );
}
