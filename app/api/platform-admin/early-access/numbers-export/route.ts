import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { buildXLSXWorkbook } from '@/lib/export/xlsx';
import { generateCSV } from '@/lib/export/csv';
import { formulaSafeRow } from '@/lib/export/formula-safe';
import { readAccounts, readLeadBook, readPaying } from '@/lib/lead-book';
import { isSignedUp } from '@/lib/lead-numbers';
import { numbersView, parsePeriod, tableRows } from '@/lib/lead-numbers-view';

/**
 * Leads › Numbers › Tools › Export the numbers (Support console Stage 7 Part 5). Counts only — no lead's name or
 * address — for the period and filter on screen, through the one definition. The growth power alone.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  const book = await readLeadBook();
  if (book.kind === 'not_read') return NextResponse.json({ error: 'The leads could not be read just now.' }, { status: 503 });
  const leads = book.value;
  const period = parsePeriod(sp.get('period') ?? undefined, leads);
  const signed = leads.filter(isSignedUp).map(l => l.orgId).filter((x): x is string => !!x);
  const [pay, accounts] = await Promise.all([readPaying(signed), readAccounts()]);
  const token = (k: string) => (sp.get(k) ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const m = numbersView(leads, period, { plan: token('plan'), source: token('source'), tag: token('tag'), page: (sp.get('page') ?? '').slice(0, 60) },
    pay, accounts, new Set(leads.map(l => l.orgId).filter((x): x is string => !!x)), new Date());
  const n = m.numbers;

  const headers = ['Table', 'Row', 'Leads', 'Signed up', 'Rate', 'Pay now', 'Days'];
  const section = (name: string, rows: (string | number)[][]) => rows.map(r => [name, ...r]);
  const rows = [
    ['Band', `Leads arrived (${m.period.label})`, n.arrived, '', '', '', ''],
    ['Band', 'Signed up', '', n.signedUp, n.signedUpRate === null ? '—' : `${n.signedUpRate}%`, n.payNow ?? 'Not read', n.timeToSignUp?.middle ?? '—'],
    ['Band', 'New accounts', n.newAccounts?.total ?? 'Not read', '', '', '', ''],
    ...section('By page', tableRows(n.byPage, true)),
    ...section('By plan', tableRows(n.byPlan, true)),
    ...section('By source', tableRows(n.bySource, false)),
    ...section('By link tag', tableRows(n.byTag, false)),
    ...n.byMonth.map(x => ['Month by month', x.month, x.arrived, x.signedUp, '', '', '']),
  ].map(r => formulaSafeRow(r));
  const date = tournamentToday();

  if (sp.get('format') === 'csv') {
    return new NextResponse(generateCSV(headers, rows), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lead-numbers-${date}.csv"`, 'Cache-Control': 'no-store' },
    });
  }
  const buffer = await buildXLSXWorkbook(headers, rows, 'Lead numbers').xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="lead-numbers-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}, { route: '/api/platform-admin/early-access/numbers-export' });
