'use client';
/**
 * The schedule's exports: the spreadsheet and CSV rows, the PDF report, and the bracket PDFs when the bracket is on
 * screen. Moved out of the schedule page as it was (Stage 3 Part 0, a pure move).
 */
import { useEffect, useState } from 'react';
import { formatTime } from '@/lib/utils';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { downloadBracketPDF } from '@/lib/export/bracket-pdf';
import { buildScheduleDocument } from '@/lib/export/schedule-document';
import type { Division, Game, Team, Tournament } from '@/lib/types';
import type { useOrg } from '@/lib/org-context';

// ── Export column definitions ─────────────────────────────────────────────
// No sensitive fields on this surface — schedule data is operational/public.
const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',      key: 'date'     },
  { label: 'Time',      key: 'time'     },
  { label: 'Division',  key: 'division' },
  { label: 'Home Team', key: 'homeTeam' },
  { label: 'Away Team', key: 'awayTeam' },
  { label: 'Location',  key: 'location' },
  { label: 'Status',    key: 'status'   },
];

export function useScheduleExport({
  currentOrg, currentTournament, orgSlug, layout, filtered, divisionGames, activeDivision, teams,
  getGroupName, resolveTeam, getGameVenueDisplay,
}: {
  currentOrg: ReturnType<typeof useOrg>['currentOrg'];
  currentTournament: Tournament | null;
  orgSlug: string | undefined;
  layout: 'list' | 'bracket' | 'timeline';
  filtered: Game[];
  divisionGames: Game[];
  activeDivision: Division | undefined;
  teams: Team[];
  getGroupName: (id: string) => string;
  resolveTeam: (id: string, placeholder?: string) => string;
  getGameVenueDisplay: (g: Game) => { name: string; sublabel?: string };
}) {
  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  useEffect(() => {
    // D4: server-resolved — org-name header fallback + the org's uploaded logo, print-ready.
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}&resolve=1` : '?resolve=1';
    void fetchResolvedPdfSettings(`/api/admin/org/pdf-settings${orgQuery}`).then(setPdfSettings);
  }, [orgSlug]);

  // ── Export handlers ────────────────────────────────────────────────────
  function buildScheduleRows() {
    return filtered.map(g => ({
      date:     g.date ?? '',
      time:     formatTime(g.time),
      division: getGroupName(g.divisionId),
      homeTeam: resolveTeam(g.homeTeamId, g.homePlaceholder),
      awayTeam: resolveTeam(g.awayTeamId, g.awayPlaceholder),
      location: (() => {
        const display = getGameVenueDisplay(g);
        return display.sublabel ? `${display.name} - ${display.sublabel}` : display.name;
      })(),
      status:   g.status,
    }));
  }

  async function handleExportXLSX() {
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'xlsx'),
      serializeHeaders(SCHEDULE_EXPORT_COLS),
      serializeRows(buildScheduleRows(), SCHEDULE_EXPORT_COLS),
      'Schedule',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const rows    = serializeRows(buildScheduleRows(), SCHEDULE_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') }, 'csv'),
      generateCSV(headers, rows),
    );
  }


  async function doPdfExport() {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    // ⚠ The PDF does NOT share the spreadsheet's rows. A wall copy is grouped by day, speaks the
    // words this screen's own status filter uses, and drops a column that says the same thing on
    // every row — none of which belongs in a file somebody sorts and filters. The xlsx/CSV/iCal
    // exports above still carry every column and every raw value.
    const { headers, groups } = buildScheduleDocument(buildScheduleRows());
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: String(currentTournament?.year ?? '') },
      'pdf',
    );
    await downloadPDF(filename, 'Tournament Schedule', currentTournament?.name, headers, [], settings, {
      identity: currentOrg?.name,
      // The schedule is a wide many-game grid: landscape + compact is the report's own
      // shape (D2), not an org preference.
      shape: { orientation: 'landscape', density: 'compact' },
      groups,
    });
  }

  async function handleExportPDF() {
    // Context-aware: when the bracket is on screen, export the visual bracket;
    // List/Timeline export the schedule game table.
    if (layout === 'bracket') {
      await handleExportBracketPDF();
      return;
    }
    // The "set up your PDF template" nudge is gone: resolved settings always carry the org's
    // name and logo now (D1/D4), so an untouched org's export is already presentable.
    await doPdfExport();
  }

  async function handleExportBracketPDF(blank: boolean = false) {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
      orientation: 'landscape',
    };
    const bracketGames = divisionGames.filter(g => g.isPlayoff);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: blank ? 'bracket-blank' : 'bracket', scope: activeDivision?.name ?? String(currentTournament?.year ?? '') },
      'pdf',
    );
    await downloadBracketPDF(
      filename,
      `${activeDivision?.name ?? 'Division'} — Playoff Bracket${blank ? ' (Blank)' : ''}`,
      currentTournament?.name,
      bracketGames,
      teams,
      settings,
      blank,
    );
  }

  return { handleExportXLSX, handleExportCSV, handleExportPDF, handleExportBracketPDF };
}
