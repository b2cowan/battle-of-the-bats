import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule } from '@/lib/coach-capabilities';
import { parseCSV } from '@/lib/import/csv';
import { parseXLSX } from '@/lib/import/xlsx';
import { ImportParseError } from '@/lib/import/types';
import { rowsFromScheduleFile, isBlankScheduleRow, MAX_SCHEDULE_IMPORT_ROWS } from '@/lib/coach-schedule-import';

/** A season schedule is a few KB; anything bigger isn't a schedule. Mirrors the budget importer. */
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
 * Parse an uploaded schedule spreadsheet into reviewable draft rows (chunk C, P1 #7).
 *
 * Read-only: nothing is written here. The client re-reviews the returned rows against the events
 * it already holds, on every keystroke, and posts them to `../import` to commit — where they are
 * reviewed a SECOND time against live data, so a row the client called an add can become an update
 * at write time (H2 rule 2).
 *
 * A pasted block never reaches this route: the client parses paste itself. Only a real file does,
 * because `.xlsx` needs a server-side reader.
 *
 * Gated on `schedule: write` ONLY — never the admin Data Tools gate (`bulk_data_imports`, a
 * Tournament-Plus ORG feature), which would paywall a premium coach behind an unrelated
 * organisation's plan (H2 rule 5).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  // The same gate as the write itself: only someone who could add these events may preview them.
  const denied = denyUnless(
    canManageSchedule(assignment.capabilities),
    'You do not have permission to change the schedule. Ask the head coach to grant it.',
  );
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a spreadsheet to upload.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That file is too large — export just the schedule sheet.' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xlsm');
  const isCsv = name.endsWith('.csv') || name.endsWith('.txt');
  if (!isXlsx && !isCsv) {
    return NextResponse.json({ error: 'Upload an Excel (.xlsx) or CSV file.' }, { status: 400 });
  }

  try {
    const parsed = isXlsx
      ? await parseXLSX(await file.arrayBuffer(), MAX_SCHEDULE_IMPORT_ROWS)
      : parseCSV(await file.text(), MAX_SCHEDULE_IMPORT_ROWS);

    const rows = rowsFromScheduleFile(parsed).filter(r => !isBlankScheduleRow(r));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'That sheet has no rows we could read. Check it has a header row, or start from the template.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ rows, headers: parsed.headers });
  } catch (error: unknown) {
    if (error instanceof ImportParseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'That file could not be read. Try saving it as a CSV.' }, { status: 400 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/import/preview' });
