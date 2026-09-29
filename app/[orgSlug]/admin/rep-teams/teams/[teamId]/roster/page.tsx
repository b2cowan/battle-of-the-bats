'use client';
/**
 * Rep Teams › a team › Roster — READ-ONLY, on the team's live season (Club Tier Stage 2: the rail's
 * team block and the team page's Roster door card, specimen 2). It moved here from the season page,
 * with its three exports unchanged (the PDF is the wall-shaped reading a club files with its
 * association: names, numbers and positions, nothing private). A team with no live season shows its
 * last closed season's roster as a record. The coach keeps the roster; the club reads it (plan §4B).
 *
 * Not drawn in the Stage 2 hub — built to the benchmark: the portal's page header (back to the team),
 * the list toolbar (a count, Export pinned right), the table standard (display-face headings, the
 * number column right and tabular). Three columns fit a phone, so it stays a table there (§3.8).
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import {
  EmptyCard, LoadFailed, PageLoading, RepChip, repKit, TwoOpenNote, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { latestClosedSeasonOf, liveSeasonOf } from '@/lib/season-live';
import { pluralize } from '@/lib/utils';
import type { RepProgramYear, RepRosterPlayer, RepRosterStatus, RepTeam } from '@/lib/types';

const EXPORT_COLS: ExportColumnDef[] = [
  { label: '#', key: 'playerNumber', format: 'text' },
  { label: 'First Name', key: 'playerFirstName', format: 'text' },
  { label: 'Last Name', key: 'playerLastName', format: 'text' },
  { label: 'Date of Birth', key: 'playerDateOfBirth', format: 'date', sensitive: true },
  { label: 'Status', key: 'status', format: 'text' },
];
/** A roster player's standing — on screen and on the PDF's headings (call-ups never reach this list). */
const STANDING: Record<RepRosterStatus, string> = { active: 'Active', inactive: 'Inactive', callup: 'Call-up' };

interface TeamRead { team: RepTeam; programYears: RepProgramYear[] }

export default function TeamRosterPage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { currentOrg, loading: orgLoading } = useOrg();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const teamBase = `/${orgSlug}/admin/rep-teams/teams/${teamId}`;

  const [read, setRead] = useState<TeamRead | null>(null);
  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setLoadError(false);
    try {
      const teamRes = await fetch(`/api/admin/rep-teams/teams/${teamId}?light=1&${q}`, { cache: 'no-store' });
      if (!teamRes.ok) { if (current()) setLoadError(true); return; }
      const teamData = await teamRes.json() as TeamRead;
      if (!current()) return;
      setRead(teamData);
      const season = liveSeasonOf(teamData.programYears) ?? latestClosedSeasonOf(teamData.programYears);
      if (!season) { setPlayers([]); return; }
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/program-years/${season.id}/roster?${q}`, { cache: 'no-store' });
      if (!res.ok) { if (current()) setLoadError(true); return; }
      const list = ((await res.json()).players ?? []) as RepRosterPlayer[];
      if (current()) setPlayers(list);
    } catch {
      if (current()) setLoadError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [teamId, q, beginRead]);

  useDeferredLoad(!orgLoading, load);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`).then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [currentOrg, q]);

  const team = read?.team ?? null;
  usePageTitle(team ? `Roster · ${team.name}` : 'Roster');
  usePublishRailTeam(teamId, team?.name);
  const season = useMemo(() => (read ? liveSeasonOf(read.programYears) ?? latestClosedSeasonOf(read.programYears) : null), [read]);
  const isLive = !!season && (season.status === 'draft' || season.status === 'active');
  const active = players.filter(p => p.status === 'active').length;

  const rows = (sensitive: boolean) => serializeRows(players.map(p => ({
    playerNumber: p.playerNumber ?? '', playerFirstName: p.playerFirstName, playerLastName: p.playerLastName,
    playerDateOfBirth: p.playerDateOfBirth ?? '', status: p.status,
  })), EXPORT_COLS, sensitive);
  const file = (ext: 'xlsx' | 'csv' | 'pdf') => buildFilename({ org: orgSlug, dataset: 'roster', scope: team?.name }, ext);
  /** ⚠ Nothing private prints: no birthdate, no guardian, no notes — grouped by standing, a count on each. */
  async function exportPDF() {
    if (!players.length) return;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings ?? {}) };
    const pdfRow = (p: RepRosterPlayer) => [p.playerNumber ?? '', `${p.playerFirstName} ${p.playerLastName}`.trim(), p.primaryPosition ?? '', p.secondaryPosition ?? ''];
    // EVERY player lands in exactly one section — an unknown standing gets its own, never dropped.
    const known = ['active', 'inactive'];
    const order = [...known, ...[...new Set(players.map(p => p.status))].filter(s => !known.includes(s))];
    const groups = order
      .map(s => ({ label: STANDING[s as RepRosterStatus] ?? String(s), rows: players.filter(p => p.status === s).map(pdfRow) }))
      .filter(g => g.rows.length > 0)
      .map(g => ({ ...g, label: `${g.label} · ${g.rows.length}` }));
    await downloadPDF(file('pdf'), 'Team Roster', [team?.name, season?.name].filter(Boolean).join(' — ') || undefined,
      ['#', 'Player', 'Primary', 'Secondary'], [], settings,
      { groups, identity: currentOrg?.name ?? undefined, shape: { orientation: 'portrait' } });
  }

  const header = (
    <AdminPageHeader
      backTo={{ href: teamBase, label: team?.name ?? 'Team' }}
      crumbs={[{ label: 'Rep Teams' }, team?.groupName ? { label: team.groupName } : null]}
      title="Roster"
      titleChips={season ? <RepChip tone={isLive ? 'good' : 'neutral'}>{season.name} · {isLive ? 'Live' : 'Closed'}</RepChip> : null}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;
  if (loadError || !team) {
    return (
      <div className={repKit.page}>
        {header}
        <LoadFailed title="We couldn’t load this team’s roster." onRetry={() => { setLoading(true); void load(); }} />
      </div>
    );
  }
  if (!season) {
    return (
      <div className={repKit.page}>
        {header}
        <EmptyCard title="No season yet">A roster belongs to a season. Start {team.name}’s first season from its team page.</EmptyCard>
      </div>
    );
  }

  return (
    <div className={repKit.page}>
      {header}
      <TwoOpenNote teamName={read!.team.name} seasons={read!.programYears} showingName={season.name} teamHref={teamBase} />
      <CoachListToolbar
        lede={`${pluralize(active, 'player')} on the ${season.name}`}
        actions={
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={() => { void downloadXLSX(file('xlsx'), serializeHeaders(EXPORT_COLS), rows(false), 'Roster'); }}
            onExportCSV={() => downloadCSVBlob(file('csv'), generateCSV(serializeHeaders(EXPORT_COLS), rows(false)))}
            onExportPDF={exportPDF}
            pdfHint="Names, numbers and positions — safe to pin up"
            pdfFeatureKey="club_exports"
            planId={currentOrg?.planId}
            disabled={players.length === 0}
          />
        }
      />
      {players.length === 0 ? (
        <EmptyCard title="No players yet">
          {isLive
            ? `${team.name}’s coach adds players in the Coaches Portal, and an accepted tryout applicant joins the roster here too.`
            : `Nobody was on the ${season.name} roster.`}
        </EmptyCard>
      ) : (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col" className={repKit.num}>#</th>
                <th scope="col">Player</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td className={`${repKit.num}${p.playerNumber ? '' : ` ${repKit.dim}`}`}>{p.playerNumber ?? '—'}</td>
                  <td>{p.playerFirstName} {p.playerLastName}</td>
                  <td><RepChip tone={p.status === 'active' ? 'good' : 'neutral'}>{STANDING[p.status] ?? p.status}</RepChip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={repKit.notes}>{team.name}’s coaches keep the roster in their Coaches Portal; the club reads it here.</p>
    </div>
  );
}
