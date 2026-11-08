import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { readGstReturnWorksheet } from '@/lib/gst-return-worksheet-read';
import { visibleCustomers } from '@/lib/console-money-sales-tax-wait';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { chunked } from '@/lib/supabase-paging';
import { isCalendarDate } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';
import type { Worksheet } from '@/lib/gst-return-worksheet';

/**
 * THE GST/HST RETURN VIEW'S READ (GST/HST Stage 4b Session B). Bookkeeping › Reports › View · GST/HST return.
 *
 * ⚖ THE GATE COMES FIRST. The worksheet reads every sale on the platform with the service role, so the Bookkeeping gate (a
 * confirmed platform-staff session on the owner allowlist, `requireBookkeepingApi`, the gate every Bookkeeping route uses) runs
 * before anything is read (Session A review, 2026-11-07). Bookkeeping holds no power in `PLATFORM_POWERS`: the allowlist is
 * its gate, and it is stricter than any staff power.
 *
 * Returns the engine's worksheet unchanged (every figure, part, state and "Before you file" item is the engine's), how the
 * registration date read, and, per invoice in the period, the club whose Money tab shows it. That last part is Stage 3's own rule
 * (`visibleCustomers`), so a shared customer's sale reads "on no club's list" here exactly when Money refuses it; it fails on
 * its own (`clubs: null`) and never blanks a figure. Read only.
 */
const ROUTE = '/api/platform-admin/bookkeeping/gst-return';
const NO_STORE = { 'Cache-Control': 'no-store' };

export type ReturnClub = { orgId: string; name: string };
export type GstReturnResponse = {
  worksheet: Worksheet;
  registration: 'set' | 'unset' | 'failed';
  /** Invoice id → the club whose Money tab shows it, or null when no club's does (a shared customer). Null = not read. */
  clubs: Record<string, ReturnClub | null> | null;
};

async function clubsFor(worksheet: Worksheet): Promise<GstReturnResponse['clubs']> {
  const invoices = worksheet.parts[101].invoices;
  if (!invoices.length) return {};
  try {
    const shown = await visibleCustomers();
    const orgIds = [...new Set(invoices.flatMap(i => shown.get(i.customerId) ?? []))];
    const names = new Map<string, string>();
    for (const chunk of chunked(orgIds, 100)) {
      const { data, error } = await supabaseAdmin.from('organizations').select('id, name').in('id', chunk);
      if (error) throw error;
      for (const row of (data ?? []) as { id: string; name: string | null }[]) names.set(row.id, row.name ?? 'Club');
    }
    return Object.fromEntries(invoices.map(i => {
      const orgId = shown.get(i.customerId);
      return [i.invoiceId, orgId ? { orgId, name: names.get(orgId) ?? 'Club' } : null];
    }));
  } catch (err) {
    console.warn('[platform-admin] GST/HST return clubs read failed:', (err as { code?: string }).code ?? 'error');
    return null;
  }
}

export const GET = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const from = req.nextUrl.searchParams.get('from') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  if (!isCalendarDate(from) || !isCalendarDate(to)) return NextResponse.json({ error: 'Choose both dates for the return.' }, { status: 400 });
  if (from > to) return NextResponse.json({ error: 'Choose a From date on or before the To date.' }, { status: 400 });
  try {
    const { worksheet, registration } = await readGstReturnWorksheet({ from, to });
    const body: GstReturnResponse = { worksheet, registration, clubs: await clubsFor(worksheet) };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    console.warn('[platform-admin] GST/HST return failed:', (err as { code?: string }).code ?? 'error');
    return NextResponse.json({ error: 'Unable to work out the return' }, { status: 500 });
  }
}, { route: ROUTE });
