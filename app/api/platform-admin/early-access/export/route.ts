import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { buildXLSXWorkbook } from '@/lib/export/xlsx';
import { generateCSV } from '@/lib/export/csv';
import { formulaSafeRow } from '@/lib/export/formula-safe';
import { consoleDate } from '@/lib/console-dates';
import { EARLY_ACCESS_STATUS_LABELS, leadPageLabel } from '@/lib/early-access-admin';
import { featureWords, lostWords, planWords, sourceWords } from '@/lib/lead-views';
import { askedNotToBeContacted, listFromParams, readList, recordExport } from '@/lib/lead-writes';

/**
 * Tools › Export (Support console Stage 7 Part 9; owner Q10 + build gate §6-5, "as drawn"). Super admin, Product and
 * Growth only. Every lead in the list the screen shows — no 1,000-row cap. The audit entry (who, when, how many, which
 * list) is written BEFORE the file is built; if it cannot be written, nothing is sent. Every cell a stranger's words can
 * reach is made formula-safe, and a lead who asked not to be contacted has an empty email cell.
 */
const HEADERS = ['Arrived', 'Name', 'Email', 'Organization', 'Role', 'Sport or program', 'Plans', 'Features', 'Step',
  'Why it was lost', 'Source', 'Source recorded by', 'Source detail', 'Arrived from', 'Said yes to release emails', 'Last contacted', 'Next action',
  'Follow-up', 'Signed up', 'In their words'];

export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
  const params = listFromParams(sp);
  const list = await readList(params);
  if (list.kind === 'not_read') return NextResponse.json({ error: 'The leads could not be read just now. Nothing was exported.' }, { status: 503 });

  if (!(await recordExport(auth.user.email!, params, list.value.length, format))) {
    return NextResponse.json({ error: 'The export could not be recorded in the audit log, so nothing was sent.' }, { status: 503 });
  }

  const rows = list.value.map(l => formulaSafeRow([
    consoleDate(l.createdAt),
    l.name,
    askedNotToBeContacted(l) ? '' : l.email,
    l.organizationName ?? '',
    l.role ?? '',
    l.sports ?? '',
    planWords(l.plans),
    featureWords(l.features) ?? '',
    EARLY_ACCESS_STATUS_LABELS[l.step],
    lostWords(l.lostReason) ?? '',
    sourceWords(l.source),
    l.sourceFromForm ? 'The form' : l.source ? 'Staff' : '',
    l.sourceWords ?? '',
    leadPageLabel(l.sourcePath),
    l.consent ? 'Yes' : 'No',
    l.lastContactedAt ? consoleDate(l.lastContactedAt) : '',
    l.nextAction ?? '',
    l.followUpDueAt ?? '',
    l.linkedAt ? consoleDate(l.signedUpAt) : '',
    l.words ?? '',
  ]));
  const date = tournamentToday();

  if (format === 'csv') {
    return new NextResponse(generateCSV(HEADERS, rows), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-${date}.csv"`, 'Cache-Control': 'no-store' },
    });
  }
  const buffer = await buildXLSXWorkbook(HEADERS, rows, 'Leads').xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}, { route: '/api/platform-admin/early-access/export' });
