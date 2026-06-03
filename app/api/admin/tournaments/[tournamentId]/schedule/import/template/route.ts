import ExcelJS from 'exceljs';
import {
  TOURNAMENT_SCHEDULE_IMPORT_HEADERS,
  TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION,
  formatTournamentScheduleTemplateRows,
} from '@/lib/import/tournament-schedule';
import { generateCSV } from '@/lib/import/csv';
import {
  authorizeTournamentScheduleImport,
  json,
  loadTournamentScheduleImportContext,
  slugify,
  type RouteParams,
} from '../shared';

export const runtime = 'nodejs';

function applyHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
}

function autoSizeColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach(column => {
    let max = 10;
    column.eachCell?.({ includeEmpty: true }, cell => {
      max = Math.max(max, String(cell.value ?? '').length);
    });
    column.width = Math.min(max + 2, 64);
  });
}

async function buildWorkbook(input: {
  mode: 'current' | 'empty';
  tournamentName: string;
  rows: (string | number | null | undefined)[][];
  divisions: { id: string; name: string }[];
  teams: { id: string; divisionId: string; name: string; status: string | null }[];
  venues: { id: string; name: string; facilities: { id: string; name: string }[] }[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldLogicHQ';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRows([
    ['FieldLogicHQ Tournament Schedule Import'],
    ['Template Version', TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION],
    ['Template type', input.mode === 'current' ? 'Current schedule' : 'Empty template'],
    ['Tournament', input.tournamentName],
    ['Safe workflow', 'Upload creates a preview only. Schedule apply is intentionally disabled in this preview release.'],
    ['Game ID', 'Keep this value for future updates. Leave blank only when previewing new scheduled games.'],
    ['Game Type', 'Use pool for V1. Playoff/bracket imports are preview-blocked for now.'],
    ['Game Date', 'Use yyyy-mm-dd.'],
    ['Start Time', 'Use 24-hour HH:MM.'],
    ['Status values', 'scheduled, cancelled'],
    ['Scores', 'Do not add scores. Submitted/completed/scored games are blocked.'],
  ]);
  instructions.getColumn(1).width = 24;
  instructions.getColumn(2).width = 100;

  const data = workbook.addWorksheet('Data');
  applyHeaderStyle(data.addRow([...TOURNAMENT_SCHEDULE_IMPORT_HEADERS]));
  input.rows.forEach(row => data.addRow(row.map(value => value ?? '')));
  data.views = [{ state: 'frozen', ySplit: 1 }];
  autoSizeColumns(data);

  const reference = workbook.addWorksheet('Reference');
  applyHeaderStyle(reference.addRow([
    'Division ID',
    'Division Name',
    'Team ID',
    'Team Name',
    'Team Division ID',
    'Venue ID',
    'Venue Name',
    'Facility ID',
    'Facility Name',
    'Allowed Statuses',
  ]));
  const facilities = input.venues.flatMap(venue =>
    venue.facilities.map(facility => ({ venue, facility }))
  );
  const rowCount = Math.max(input.divisions.length, input.teams.length, input.venues.length, facilities.length, 2);
  const statuses = ['scheduled', 'cancelled'];
  for (let i = 0; i < rowCount; i += 1) {
    reference.addRow([
      input.divisions[i]?.id ?? '',
      input.divisions[i]?.name ?? '',
      input.teams[i]?.id ?? '',
      input.teams[i]?.name ?? '',
      input.teams[i]?.divisionId ?? '',
      input.venues[i]?.id ?? facilities[i]?.venue.id ?? '',
      input.venues[i]?.name ?? facilities[i]?.venue.name ?? '',
      facilities[i]?.facility.id ?? '',
      facilities[i]?.facility.name ?? '',
      statuses[i] ?? '',
    ]);
  }
  autoSizeColumns(reference);

  return workbook.xlsx.writeBuffer();
}

export async function GET(req: Request, { params }: RouteParams) {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentScheduleImport(req, tournamentId, { blockLocked: false });
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const mode = url.searchParams.get('mode') === 'empty' ? 'empty' : 'current';

  try {
    const context = await loadTournamentScheduleImportContext({
      tournamentId,
      orgId: auth.ctx.org.id,
      tournament: auth.tournament,
    });
    const rows = mode === 'current' ? formatTournamentScheduleTemplateRows(context) : [];
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slugify(auth.tournament.name)}-schedule-import-${mode}-${date}.${format}`;

    if (format === 'csv') {
      const csv = generateCSV([...TOURNAMENT_SCHEDULE_IMPORT_HEADERS], rows);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const buffer = await buildWorkbook({
      mode,
      tournamentName: auth.tournament.name,
      rows,
      divisions: context.divisions,
      teams: context.teams,
      venues: context.venues,
    });

    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Schedule template could not be generated.' }, 500);
  }
}
