import { NextRequest, NextResponse } from 'next/server';
import {
  cleanNextAction,
  cleanOptionalDate,
  EARLY_ACCESS_SELECT,
  isLeadSource,
  isLostReason,
  leadAuditValues,
  PICKABLE_STATUSES,
} from '@/lib/early-access-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';

/**
 * A lead's edit, saved whole by the lead page's check mark (Support console Stage 7 Part 4; owner Q6: no reason, no
 * confirm window). Signed up is never a step picked here: it comes only from linking a club (`./link`), and a linked
 * lead's step moves only by unlinking it. Lost needs a reason; any other step clears it. Notes are their own store
 * (`./notes`). The audit entry keeps field names, the step and the fixed-list codes, never a value anyone typed.
 */
type PatchBody = {
  step?: unknown;
  lostReason?: unknown;
  source?: unknown;
  sourceWords?: unknown;
  nextAction?: unknown;
  followUpDueAt?: unknown;
  markContacted?: unknown;
};

type LeadRow = Record<string, unknown> & {
  internal_status: string;
  linked_at: string | null;
  lost_reason: string | null;
};

const SELECT = `${EARLY_ACCESS_SELECT}, source, source_words, lost_reason, linked_at, step_changed_at`;

function cleanWords(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, 500) : null;
}

export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;

  const { leadId } = await params;
  if (!isUuid(leadId)) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as PatchBody | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  }
  if (body.step !== undefined && !(PICKABLE_STATUSES as readonly unknown[]).includes(body.step)) {
    return NextResponse.json({ error: 'Pick a step from the list' }, { status: 400 });
  }
  if (body.lostReason !== undefined && body.lostReason !== null && !isLostReason(body.lostReason)) {
    return NextResponse.json({ error: 'Pick why it was lost from the list' }, { status: 400 });
  }
  if (body.source !== undefined && body.source !== null && !isLeadSource(body.source)) {
    return NextResponse.json({ error: 'Pick a source from the list' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('early_access_leads').select(SELECT).eq('id', leadId).maybeSingle<LeadRow>();
  if (currentError) {
    console.error('[platform-admin] early-access current read error:', currentError);
    return NextResponse.json({ error: 'Unable to load early-access lead' }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, string | null> = { updated_at: now };

  if (body.source !== undefined) update.source = (body.source as string | null) ?? null;
  if (body.sourceWords !== undefined) update.source_words = cleanWords(body.sourceWords);
  if (body.followUpDueAt !== undefined) update.follow_up_due_at = cleanOptionalDate(body.followUpDueAt);
  if (body.nextAction !== undefined) update.next_action = cleanNextAction(body.nextAction);
  if (body.markContacted === true) {
    update.last_contacted_at = now;
    update.last_contacted_by = auth.user.email ?? null;
    // Mark contacted moves a New lead to Contacted; a lead further on keeps its step (Stage 7: a Signed up lead's step
    // is its link's, and Lost keeps its reason).
    if (body.step === undefined && current.internal_status === 'new') update.internal_status = 'contacted';
  }

  if (body.step !== undefined && body.step !== current.internal_status) {
    if (current.linked_at) {
      return NextResponse.json({ error: 'This lead has a club linked. Unlink the club to move its step.' }, { status: 409 });
    }
    update.internal_status = body.step as string;
  }
  const nextStep = update.internal_status ?? current.internal_status;
  if (nextStep === 'lost') {
    const reason = body.lostReason !== undefined ? body.lostReason : current.lost_reason;
    if (!isLostReason(reason)) {
      return NextResponse.json({ error: 'Pick why it was lost before saving.', field: 'lostReason' }, { status: 400 });
    }
    update.lost_reason = reason;
  } else if (current.lost_reason) {
    update.lost_reason = null;
  }
  if (update.internal_status && update.internal_status !== current.internal_status) update.step_changed_at = now;

  const { data, error } = await supabaseAdmin
    .from('early_access_leads').update(update).eq('id', leadId).select(SELECT).single();
  if (error) {
    console.error('[platform-admin] early-access update error:', error);
    return NextResponse.json({ error: 'Unable to update early-access lead' }, { status: 500 });
  }

  // Field names, the step and the fixed-list codes only: the Audit log is every role's, a lead's details are not (Stage 7 Part 0).
  const audit = leadAuditValues(current as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_early_access_lead',
    leadId,
    audit.oldValue,
    audit.newValue,
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/early-access/[leadId]' });
