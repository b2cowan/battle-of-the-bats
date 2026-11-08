import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { hasGstReturnFilingsTable, insertGstReturnFiling, listGstReturnFilings } from '@/lib/bookkeeping-store';
import { checkFiling, filingSummary, freezeSources, type GstReturnFiling } from '@/lib/gst-return-filing';
import { readGstReturnWorksheet } from '@/lib/gst-return-worksheet-read';
import { FILING, refusalWords } from '@/lib/gst-return-worksheet-text';
import { WORKSHEET_LINES } from '@/lib/gst-return-worksheet';
import { isCalendarDate, orgDayKey } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';

/**
 * "MARK AS FILED" (GST/HST Stage 4b Session C). Bookkeeping › Reports › View · GST/HST return.
 *
 * ⚖ THE GATE COMES FIRST: the worksheet reads every sale on the platform with the service role (`requireBookkeepingApi`, the owner
 *   allowlist every Bookkeeping route uses).
 * ⚖ THE SERVER FREEZES WHAT IT WORKS OUT ITSELF. The body names the period, the filed-on date, a reason and the revision the person
 *   was looking at; never a figure. The worksheet is recomputed here and that is what is saved (lib/gst-return-filing.ts).
 * ⚖ APPEND-ONLY: there is no PATCH or DELETE. Marking the same dates again appends an amended filing with a reason.
 */
const ROUTE = '/api/platform-admin/bookkeeping/gst-return/filings';
const NO_STORE = { 'Cache-Control': 'no-store' };
const today = () => orgDayKey(new Date().toISOString());

/** The filings, newest first, without their sources (the return view reads one period's comparison from the gst-return GET). */
export const GET = withObservability(async () => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  try {
    const filings = await listGstReturnFilings();
    return NextResponse.json({ filings: filings.map(filingSummary) }, { headers: NO_STORE });
  } catch (err) {
    console.warn('[platform-admin] GST/HST filings list failed:', (err as { code?: string }).code ?? 'error');
    return NextResponse.json({ error: 'Unable to load your filings' }, { status: 500 });
  }
}, { route: ROUTE });

export const POST = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const origin = req.headers.get('origin');
  try {
    if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    input = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: 'This filing could not be read. Reload the page and try again.' }, { status: 400 }); }
  // The only fields read. Anything else in the body (a figure, a line) is ignored.
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  // `shownLines` is the fingerprint of the lines the question showed: COMPARED with the server's own worksheet, never saved.
  const { from: rawFrom, to: rawTo, filedOn: rawFiledOn, reason: rawReason, shownLines: rawShown, expectedRevision } = input;
  const from = text(rawFrom);
  const to = text(rawTo);
  const filedOn = text(rawFiledOn);
  const reason = text(rawReason).trim();
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return NextResponse.json({ error: 'Choose both dates for the return.' }, { status: 400 });
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    return NextResponse.json({ error: 'This filing could not be read. Reload the page and try again.' }, { status: 400 });
  }

  try {
    if (!await hasGstReturnFilingsTable()) return NextResponse.json({ error: FILING.storageNotReady }, { status: 503 });
    const { worksheet, filings } = await readGstReturnWorksheet({ from, to });
    if (filings.state === 'failed') return NextResponse.json({ error: 'Your filed periods couldn’t be read. Try again.' }, { status: 500 });
    const check = checkFiling({ worksheet, filings: filings.filings, filedOn, today: today(), expectedRevision: expectedRevision as number, reason, shownLines: text(rawShown) });
    if (!check.ok) {
      const field = check.refusal.why.startsWith('filed_on') ? 'filedOn' : check.refusal.why.startsWith('reason') ? 'reason' : undefined;
      // 409 = what the screen shows is out of date: it reads the period again.
      const stale = check.refusal.why === 'changed' || check.refusal.why === 'figures_changed' || check.refusal.why === 'overlaps';
      return NextResponse.json({ field, why: check.refusal.why, error: refusalWords(check.refusal) }, { status: stale ? 409 : 400 });
    }
    const lines = Object.fromEntries(WORKSHEET_LINES.map(line => [line, worksheet.lines[line].cents!])) as GstReturnFiling['lines'];
    const filing = await insertGstReturnFiling({
      // The next number after the newest read above: a filing saved in between takes it, and this one is refused (below).
      filingNo: (filings.filings[0]?.filingNo ?? 0) + 1,
      period: worksheet.period,
      periodRevision: check.periodRevision,
      filedOn,
      registrationDate: worksheet.registrationDate!,
      lines,
      wholeDollars101: worksheet.parts[101].wholeDollars!,
      partial: worksheet.partial,
      openItems: worksheet.unresolved.filter(u => u.affects.length > 0).length,
      sources: freezeSources(worksheet),
      reason: check.periodRevision > 1 ? reason : null,
      createdBy: gate.auth!.user.id,
    });
    return NextResponse.json({ filing: filingSummary(filing) }, { status: 201 });
  } catch (error) {
    const conflict = error && typeof error === 'object' && 'code' in error && (error.code === '23505' || error.code === '40001');
    if (!conflict) console.warn('[platform-admin] GST/HST filing failed:', (error as { code?: string }).code ?? 'error');
    // A key or concurrency collision means another filing (of any period) was saved at the same moment: try again, nothing is lost.
    return NextResponse.json(conflict ? { why: 'busy', error: refusalWords({ why: 'busy' }) } : { error: 'Unable to save the filing' }, { status: conflict ? 409 : 500 });
  }
}, { route: ROUTE });
