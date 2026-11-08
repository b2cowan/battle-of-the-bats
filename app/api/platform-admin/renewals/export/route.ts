import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { buildXLSXWorkbook } from '@/lib/export/xlsx';
import { generateCSV } from '@/lib/export/csv';
import { formulaSafeRow } from '@/lib/export/formula-safe';
import { writePlatformAuditLogStrict } from '@/lib/platform-audit';
import { stripeKeyIsLive } from '@/lib/stripe-mode';
import { readComingUp, readUnpaid } from '@/lib/renewals-read';
import {
  COMING_EXPORT_HEADERS, UNPAID_EXPORT_HEADERS, buildComingView, buildUnpaidView, comingExportRows, paramsFrom, paramsQuery,
  unpaidExportRows,
} from '@/lib/renewals';

/**
 * Customers › Renewals › Export (Plans & pricing Stage 2 Part 4b; registry `platform-admin-renewals-coming-up` and
 * `platform-admin-renewals-unpaid`). Super admin, Billing and Support (the page's readers). The rows on screen, the same
 * columns, following the page's filters, built by the SAME functions the page uses. Our own tables only, no Stripe call.
 * The audit entry (who, when, which list, how many rows) is written BEFORE the file is built; if it cannot be written,
 * nothing is sent. Every cell is formula-safe. No person's name, email, address or card is in either file.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('renewals', 'view');
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
  const params = paramsFrom(k => sp.get(k));
  const today = tournamentToday();
  const live = stripeKeyIsLive();

  let headers: string[];
  let rows: Array<Array<string | number>>;
  let name: string;
  if (params.view === 'unpaid') {
    const view = buildUnpaidView(await readUnpaid(live), params, today);
    if (!view.read) return NextResponse.json({ error: 'The bills could not be read just now. Nothing was exported.' }, { status: 503 });
    headers = UNPAID_EXPORT_HEADERS;
    rows = unpaidExportRows(view.rows);
    name = 'unpaid-bills';
  } else {
    const view = buildComingView(await readComingUp(), params, today);
    if (!view.read) return NextResponse.json({ error: 'The renewals could not be read just now. Nothing was exported.' }, { status: 503 });
    headers = COMING_EXPORT_HEADERS;
    rows = comingExportRows(view.rows);
    name = 'renewals-coming-up';
  }

  try {
    await writePlatformAuditLogStrict(auth.user.email!, null, 'export_renewals', params.view, null,
      { rows: rows.length, format, list: paramsQuery(params) || 'default', mode: live ? 'live' : 'test' }, {});
  } catch {
    return NextResponse.json({ error: 'The export could not be recorded in the audit log, so nothing was sent.' }, { status: 503 });
  }

  const safe = rows.map(r => formulaSafeRow(r));
  if (format === 'csv') {
    return new NextResponse(generateCSV(headers, safe), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}-${today}.csv"`, 'Cache-Control': 'no-store' },
    });
  }
  const buffer = await buildXLSXWorkbook(headers, safe, params.view === 'unpaid' ? 'Unpaid bills' : 'Coming up').xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}, { route: '/api/platform-admin/renewals/export' });
