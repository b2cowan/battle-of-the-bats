import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { parseCSV } from '@/lib/import/csv';
import { parseXLSX } from '@/lib/import/xlsx';
import { ImportParseError } from '@/lib/import/types';
import {
  rowsFromMonthGrid, rowsFromList, rowsFromPayables,
  MAX_IMPORT_ROWS, type BudgetImportShape,
} from '@/lib/coach-budget-import';

/** A budget sheet is a few KB; anything bigger isn't a budget. Mirrors the roster importer. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SHAPES: BudgetImportShape[] = ['month-grid', 'list', 'payables'];

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/**
 * Parse an uploaded budget spreadsheet into reviewable draft rows (chunk H2).
 *
 * Read-only: nothing is written here. The coach corrects the returned rows in the preview table —
 * which re-reviews them against the plan and taxonomy it already holds — and then posts them to
 * `../import` to commit, where they are reviewed a second time against the live plan.
 *
 * Gated on `money: write` ONLY. It must never borrow the admin Data Tools gate
 * (`bulk_data_imports`, a Tournament-Plus org feature) — that would paywall a premium coach
 * behind an unrelated organisation's plan.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  // The same gate as the write itself: only someone who could enter these lines may preview them.
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const shapeRaw = String(form?.get('shape') ?? '');
  const shape = SHAPES.includes(shapeRaw as BudgetImportShape) ? shapeRaw as BudgetImportShape : null;

  if (!shape) {
    return NextResponse.json({ error: 'Choose which kind of sheet this is.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a spreadsheet to upload.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That file is too large — export just the budget sheet.' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xlsm');
  const isCsv = name.endsWith('.csv') || name.endsWith('.txt');
  if (!isXlsx && !isCsv) {
    return NextResponse.json({ error: 'Upload an Excel (.xlsx) or CSV file.' }, { status: 400 });
  }

  try {
    const parsed = isXlsx
      ? await parseXLSX(await file.arrayBuffer(), MAX_IMPORT_ROWS)
      : parseCSV(await file.text(), MAX_IMPORT_ROWS);

    // The season year anchors bare month names ("Sep" with no year) — see the reader.
    const rows = shape === 'payables'
      ? rowsFromPayables(parsed)
      : shape === 'list'
        ? rowsFromList(parsed)
        : rowsFromMonthGrid(parsed, programYear.year);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'That sheet has no rows we could read. Check it has a header row, or start from the template.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ rows, headers: parsed.headers, shape });
  } catch (error: unknown) {
    if (error instanceof ImportParseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'That file could not be read. Try saving it as a CSV.' }, { status: 400 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/import/preview' });
