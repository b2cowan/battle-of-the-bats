import ExcelJS from 'exceljs';
import {
  TOURNAMENT_TEAM_IMPORT_HEADERS,
  TOURNAMENT_TEAM_IMPORT_TEMPLATE_VERSION,
  formatTournamentTeamTemplateRows,
} from '@/lib/import/tournament-teams';
import { generateCSV } from '@/lib/import/csv';
import {
  authorizeTournamentTeamImport,
  json,
  loadTournamentTeamImportContext,
  slugify,
  type RouteParams,
} from '../shared';
import { withObservability } from '@/lib/observability';

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
    column.width = Math.min(max + 2, 56);
  });
}

async function buildWorkbook(input: {
  mode: 'current' | 'empty';
  tournamentName: string;
  divisions: { id: string; name: string }[];
  rows: (string | number | null | undefined)[][];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldLogicHQ';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRows([
    ['FieldLogicHQ Tournament Teams Import'],
    ['Template Version', TOURNAMENT_TEAM_IMPORT_TEMPLATE_VERSION],
    ['Template type', input.mode === 'current' ? 'Current data' : 'Empty template'],
    ['Tournament', input.tournamentName],
    ['Safe workflow', 'Upload creates a preview only. No data changes until Apply Add/Update is confirmed.'],
    ['Team ID', 'Keep this value for updates. Leave blank only when creating a new team.'],
    ['Division ID', 'Use the Reference sheet values when possible. Division Name can be used when unique.'],
    ['Status values', 'pending, accepted, rejected, waitlist'],
    ['Payment Status values', 'pending, paid'],
  ]);
  instructions.getColumn(1).width = 24;
  instructions.getColumn(2).width = 96;

  const data = workbook.addWorksheet('Data');
  applyHeaderStyle(data.addRow([...TOURNAMENT_TEAM_IMPORT_HEADERS]));
  input.rows.forEach(row => data.addRow(row.map(value => value ?? '')));
  data.views = [{ state: 'frozen', ySplit: 1 }];
  autoSizeColumns(data);

  const reference = workbook.addWorksheet('Reference');
  applyHeaderStyle(reference.addRow(['Division ID', 'Division Name', 'Allowed Statuses', 'Allowed Payment Statuses']));
  const rowCount = Math.max(input.divisions.length, 4);
  const statuses = ['pending', 'accepted', 'rejected', 'waitlist'];
  const payments = ['pending', 'paid'];
  for (let i = 0; i < rowCount; i += 1) {
    reference.addRow([
      input.divisions[i]?.id ?? '',
      input.divisions[i]?.name ?? '',
      statuses[i] ?? '',
      payments[i] ?? '',
    ]);
  }
  autoSizeColumns(reference);

  return workbook.xlsx.writeBuffer();
}

export const GET = withObservability(async (req: Request, { params }: RouteParams) => {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentTeamImport(req, tournamentId, { blockLocked: false });
  if ('response' in auth) return auth.response!;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const mode = url.searchParams.get('mode') === 'empty' ? 'empty' : 'current';

  try {
    const context = await loadTournamentTeamImportContext({ tournamentId, orgId: auth.ctx.org.id });
    const rows = mode === 'current'
      ? formatTournamentTeamTemplateRows({ divisions: context.divisions, teams: context.existingTeams })
      : [];
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slugify(auth.tournament.name)}-teams-import-${mode}-${date}.${format}`;

    if (format === 'csv') {
      const csv = generateCSV([...TOURNAMENT_TEAM_IMPORT_HEADERS], rows);
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
      divisions: context.divisions,
      rows,
    });

    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Template could not be generated.' }, 500);
  }
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/import/template' });
