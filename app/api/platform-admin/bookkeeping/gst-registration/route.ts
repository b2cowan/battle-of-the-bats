import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { isExpenseDate } from '@/lib/bookkeeping-expenses';
import { REGISTRATION_QUESTION } from '@/lib/bookkeeping-gst';
import { hasGstTaxSchema, insertGstRegistrationRevision, listGstRegistrationRevisions } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

/**
 * The GST/HST registration effective date (GST/HST Stage 4a): a setting with its history, because every credit
 * reads it. A change is a new revision with a required reason; nothing else is stored, and every credit is worked
 * out again on its next read. Owner allowlist only, like every Bookkeeping route.
 */
const ROUTE = '/api/platform-admin/bookkeeping/gst-registration';

export const GET = withObservability(async () => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  try {
    if (!await hasGstTaxSchema()) return NextResponse.json({ schemaReady: false, current: null, history: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const history = await listGstRegistrationRevisions();
    return NextResponse.json({ schemaReady: true, current: history[0] ?? null, history }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load the registration date' }, { status: 500 });
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
  } catch { return NextResponse.json({ error: 'This change could not be read. Reload the page and try again.' }, { status: 400 }); }
  const effectiveDate = input.effectiveDate;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const expectedRevision = input.expectedRevision;
  if (!isExpenseDate(effectiveDate)) return NextResponse.json({ field: 'effectiveDate', error: REGISTRATION_QUESTION.dateMissing }, { status: 400 });
  if (!reason) return NextResponse.json({ field: 'reason', error: REGISTRATION_QUESTION.reasonMissing }, { status: 400 });
  if (reason.length > 500) return NextResponse.json({ field: 'reason', error: 'Keep the reason to 500 characters.' }, { status: 400 });
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1) {
    return NextResponse.json({ error: 'This change could not be read. Reload the page and try again.' }, { status: 400 });
  }
  try {
    if (!await hasGstTaxSchema()) return NextResponse.json({ error: 'Bookkeeping storage is being updated; try again after the upgrade' }, { status: 503 });
    const history = await listGstRegistrationRevisions();
    const current = history[0];
    if (!current || current.revision !== expectedRevision) return NextResponse.json({ error: 'The registration date changed; reload before saving' }, { status: 409 });
    if (current.effective_date === effectiveDate) return NextResponse.json({ field: 'effectiveDate', error: 'That is already your registration date.' }, { status: 400 });
    // Two saves racing for the same revision: the primary key refuses the second (23505 below).
    const registration = await insertGstRegistrationRevision({ revision: current.revision + 1, effective_date: effectiveDate,
      reason, created_by: gate.auth!.user.id });
    return NextResponse.json({ registration, history: [registration, ...history] }, { status: 201 });
  } catch (error) {
    const conflict = error && typeof error === 'object' && 'code' in error && error.code === '23505';
    return NextResponse.json({ error: conflict ? 'The registration date changed; reload before saving' : 'Unable to save the registration date' }, { status: conflict ? 409 : 500 });
  }
}, { route: ROUTE });
