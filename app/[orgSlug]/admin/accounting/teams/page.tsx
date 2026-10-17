'use client';
/**
 * Accounting › TEAMS (⚖ Club Accounting · Teams, Ask 1 — ruled 2026-10-16, hub M3iNQq4N8cRWeZCdN6G8Ps screen 2).
 *
 * The list a treasurer sweeps: every team and its money for the fiscal year on the Year pill, the Overview's teams table
 * moved here WHOLE (its columns, group bands, the amber request count, the red overdue caption, the locked "held by the
 * team" column, its closing row and its band). Second in Accounting's row, only for a club that runs rep teams.
 *   toolbar — the Year pill (lead — the year the other money tabs share), a quiet Group filter (absent when the club has
 *             no groups; never remembered between visits, the one-toolbar ruling's reason), Export pinned right.
 *   table   — `TeamsTable`, used only here. A team still owing on a CLOSED year gets one line under its Outstanding naming
 *             what that year still owes, red while any of it is late (Ask 8, correction C2) — the row keeps the year's
 *             figure, so Allocated − Collected = Outstanding still holds.
 * No band: Allocations and Payment requests open on their list too; the totals are the table's closing row.
 * A row opens the team's account inside this tab (`teams/{teamId}`).
 *
 * ⚖ ONE READ, ONE DEFINITION: the Overview's own read (`/api/admin/accounting/summary`) — `summary.teams` (each row with
 * its earlier years' lines) and `summary.teamsCash` — so the two screens can never disagree about a team's figure.
 */
import { useCallback, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { CoachListToolbar } from '@/components/coaches/kit';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import ExportMenu from '@/components/admin/ExportMenu';
import { LoadFailed, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import YearPill, { useClubYear } from '@/components/admin/kit/club/money/YearPill';
import TeamsTable from '@/components/admin/kit/club/money/TeamsTable';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import { BOARD_TEAMS_EXPORT_COLUMNS, boardTeamsExportRows, teamsCashOf, type BoardSummary } from '@/lib/club-budget-report';
import { SUMMARY_WORDS, TEAMS_WORDS } from '@/lib/club-money-words';
import type { FiscalYearOption } from '@/lib/club-fiscal-year';
import { buildFilename, downloadCSVBlob, downloadXLSX, generateCSV } from '@/lib/export';
import LoadingState from '@/components/shared/LoadingState';

/** What this tab reads of the Overview's read. */
interface Read {
  years: FiscalYearOption[];
  summary: BoardSummary;
}

/** The Group filter's id for a team in no group. */
const NO_GROUP = '__none__';

export default function AccountingTeamsTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;

  const [year, setYear] = useClubYear(slug);
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState<Set<string>>(() => new Set());

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<Read>(`/api/admin/accounting/summary?${q}${year ? `&year=${year}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, q, year, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const summary = read?.summary ?? null;
  const groupOptions = useMemo(() => {
    const names = new Set<string>();
    let none = false;
    for (const t of summary?.teams ?? []) { if (t.groupName) names.add(t.groupName); else none = true; }
    if (names.size === 0) return [];
    return [
      ...[...names].sort((a, b) => a.localeCompare(b)).map(n => ({ id: n, label: n })),
      ...(none ? [{ id: NO_GROUP, label: TEAMS_WORDS.noGroup }] : []),
    ];
  }, [summary]);
  // A picked group the year on screen doesn't have (the Year pill moved) narrows nothing, and the pill reads at rest — a
  // filter the reader can't see or clear must never hide teams.
  const picked = useMemo(() => new Set([...groups].filter(g => groupOptions.some(o => o.id === g))), [groups, groupOptions]);
  const shown = useMemo(() => (summary?.teams ?? [])
    .filter(t => picked.size === 0 || picked.has(t.groupName ?? NO_GROUP)), [summary, picked]);
  const held = useMemo(() => teamsCashOf(shown), [shown]);

  if (failed) return <LoadFailed title="We couldn’t load the teams." onRetry={() => void load()} />;
  if (!read || !summary) return <LoadingState label="Loading the teams…" />;

  return (
    <>
      <CoachListToolbar actions={<TeamsExport summary={summary} teams={shown} held={held} orgSlug={slug} />}>
        <YearPill year={summary.year.key} years={read.years} onChange={setYear} />
        {groupOptions.length > 0 && (
          <MultiSelectDropdown restQuiet label={TEAMS_WORDS.group} options={groupOptions} selected={picked} onChange={setGroups}
            allLabel={TEAMS_WORDS.everyGroup} />
        )}
      </CoachListToolbar>

      {summary.teams.length === 0 ? (
        <p className={moneyKit.lead1}>No teams yet. A team appears here once the club adds it in Rep teams.</p>
      ) : (
        <>
          <TeamsTable teams={shown} hrefOf={id => `${base}/teams/${id}`} isPhone={isPhone} />
          <p className={cr.heldBand}>
            <Lock size={12} aria-hidden /> {isPhone ? SUMMARY_WORDS.teamsCashBandShort(held.total) : TEAMS_WORDS.heldBand(held.total, held.teamCount)}
          </p>
        </>
      )}
    </>
  );
}

/** The table as a file — the board report's own teams rows (`boardTeamsExportRows`), the teams on screen: Excel first,
 *  then CSV, one button (the export ruling). */
function TeamsExport({ summary, teams, held, orgSlug }: {
  summary: BoardSummary; teams: BoardSummary['teams']; held: BoardSummary['teamsCash']; orgSlug: string;
}) {
  const headers = BOARD_TEAMS_EXPORT_COLUMNS.map(c => c.label);
  const body = () => boardTeamsExportRows({ teams, teamsCash: held }).map(r => BOARD_TEAMS_EXPORT_COLUMNS.map(c => r[c.key] ?? ''));
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: 'teams', scope: summary.year.name }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={teams.length === 0}
      onExportXLSX={() => downloadXLSX(name('xlsx'), headers, body(), 'Teams')}
      onExportCSV={() => downloadCSVBlob(name('csv'), generateCSV(headers, body()))}
    />
  );
}
