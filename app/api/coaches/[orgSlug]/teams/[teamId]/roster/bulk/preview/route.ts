import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { parseCSV } from '@/lib/import/csv';
import { parseXLSX } from '@/lib/import/xlsx';
import { ImportParseError } from '@/lib/import/types';
import { rowsFromParsedImportFile, MAX_BULK_ROSTER_ROWS } from '@/lib/coach-roster-bulk';

/** Generous ceiling — a 200-row roster sheet is a few KB; anything larger isn't a roster. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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
 * Parse an uploaded roster spreadsheet into reviewable draft rows (Batch 2, P0 #7).
 *
 * Read-only: nothing is written here. The coach reviews and corrects the returned rows in the
 * preview table, then posts them to `../bulk` to commit. Pasted lists never reach this route —
 * they parse in the browser so the preview updates as the coach types.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  // Same gate as the write itself: only someone who could add these players may preview them.
  // (The program year is resolved above purely to reject a team with no active season, the same
  // precondition the commit route enforces.)
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a spreadsheet to upload.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That file is too large — export just the roster sheet.' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xlsm');
  const isCsv = name.endsWith('.csv') || name.endsWith('.txt');
  if (!isXlsx && !isCsv) {
    return NextResponse.json({ error: 'Upload an Excel (.xlsx) or CSV file.' }, { status: 400 });
  }

  try {
    const parsed = isXlsx
      ? await parseXLSX(await file.arrayBuffer(), MAX_BULK_ROSTER_ROWS)
      : parseCSV(await file.text(), MAX_BULK_ROSTER_ROWS);

    // Draft rows only — the sheet re-validates on every edit against the roster it already holds,
    // and the commit route validates independently against the live roster. Returning warnings
    // here too would be a third copy of the same rules, stale the moment the coach fixes a cell.
    return NextResponse.json({
      rows: rowsFromParsedImportFile(parsed),
      headers: parsed.headers,
    });
  } catch (error: unknown) {
    if (error instanceof ImportParseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'That file could not be read. Try saving it as a CSV.' }, { status: 400 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/bulk/preview' });
