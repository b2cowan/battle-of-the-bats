import { NextResponse } from 'next/server';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { recordCatalogChangeApplication } from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { upsertPlanConfigOverride } from '@/lib/plan-config-db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';
import { withObservability } from '@/lib/observability';

const VALID_TYPES = new Set(['plan_version', 'feature_matrix', 'addon', 'pricing', 'grandfathering', 'campaign', 'trial']);
const VALID_STATUSES = new Set(['draft', 'needs_review', 'approved', 'rejected', 'implemented', 'canceled']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'launch_blocker']);

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanOptionalDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type StripePriceUpdateProposal = {
  kind: 'stripe_price_update';
  stripePriceId: string;
  planId: string;
  billingCycle: string;
  environment: string;
  currentPriceId: string | null;
  proposedPriceId: string | null;
  changeNote: string | null;
};

type StripePriceRow = {
  id: string;
  plan_id: string;
  billing_cycle: string;
  environment: string;
  price_id: string | null;
  product_name: string | null;
  updated_at: string;
  updated_by_email: string | null;
  last_change_note: string | null;
};

type PlanGatingUpdateProposal = {
  kind: 'plan_gating_update';
  planId: string;
  currentStatus: string;
  proposedStatus: string;
  changeNote: string | null;
};

type PlanConfigUpdateProposal = {
  kind: 'plan_config_update';
  planId: string;
  current: {
    tournamentLimit: number | null;
    seatLimit: number | null;
    trialDays: number | null;
  };
  proposed: {
    tournamentLimit: number | null;
    seatLimit: number | null;
    trialDays: number | null;
  };
  changeNote: string | null;
};

type PlanGatingRow = {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
  last_change_note: string | null;
};

type PlanConfigRow = {
  id: string;
  plan_id: string;
  tournament_limit: number | null;
  seat_limit: number | null;
  trial_days: number | null;
  updated_at: string | null;
  updated_by_email: string | null;
  last_change_note: string | null;
};

function getStripePriceUpdateProposal(value: unknown): StripePriceUpdateProposal | null {
  if (!value || typeof value !== 'object') return null;
  const proposal = value as Record<string, unknown>;

  if (proposal.kind !== 'stripe_price_update') return null;
  if (typeof proposal.stripePriceId !== 'string' || !proposal.stripePriceId.trim()) return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;
  if (typeof proposal.billingCycle !== 'string' || !proposal.billingCycle.trim()) return null;
  if (typeof proposal.environment !== 'string' || !proposal.environment.trim()) return null;

  return {
    kind: 'stripe_price_update',
    stripePriceId: proposal.stripePriceId.trim(),
    planId: proposal.planId.trim(),
    billingCycle: proposal.billingCycle.trim(),
    environment: proposal.environment.trim(),
    currentPriceId: typeof proposal.currentPriceId === 'string' && proposal.currentPriceId.trim()
      ? proposal.currentPriceId.trim()
      : null,
    proposedPriceId: typeof proposal.proposedPriceId === 'string' && proposal.proposedPriceId.trim()
      ? proposal.proposedPriceId.trim()
      : null,
    changeNote: sanitizePlatformChangeNote(proposal.changeNote),
  };
}

function getPlanGatingUpdateProposal(value: unknown): PlanGatingUpdateProposal | null {
  if (!value || typeof value !== 'object') return null;
  const proposal = value as Record<string, unknown>;
  if (proposal.kind !== 'plan_gating_update') return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;
  if (typeof proposal.currentStatus !== 'string' || !proposal.currentStatus.trim()) return null;
  if (typeof proposal.proposedStatus !== 'string' || !proposal.proposedStatus.trim()) return null;

  return {
    kind: 'plan_gating_update',
    planId: proposal.planId.trim(),
    currentStatus: proposal.currentStatus.trim(),
    proposedStatus: proposal.proposedStatus.trim(),
    changeNote: sanitizePlatformChangeNote(proposal.changeNote),
  };
}

function cleanNullableInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number') return undefined;
  if (!Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function cleanPlanConfigShape(value: unknown): PlanConfigUpdateProposal['current'] | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const tournamentLimit = cleanNullableInteger(record.tournamentLimit);
  const seatLimit = cleanNullableInteger(record.seatLimit);
  const trialDays = cleanNullableInteger(record.trialDays);

  if (tournamentLimit === undefined || seatLimit === undefined || trialDays === undefined) return null;
  return { tournamentLimit, seatLimit, trialDays };
}

function getPlanConfigUpdateProposal(value: unknown): PlanConfigUpdateProposal | null {
  if (!value || typeof value !== 'object') return null;
  const proposal = value as Record<string, unknown>;
  if (proposal.kind !== 'plan_config_update') return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;

  const current = cleanPlanConfigShape(proposal.current);
  const proposed = cleanPlanConfigShape(proposal.proposed);
  if (!current || !proposed) return null;

  return {
    kind: 'plan_config_update',
    planId: proposal.planId.trim(),
    current,
    proposed,
    changeNote: sanitizePlatformChangeNote(proposal.changeNote),
  };
}

async function applyStripePriceUpdateProposal(
  changeRequestId: string,
  proposal: StripePriceUpdateProposal,
  actorEmail: string,
): Promise<
  | {
      ok: true;
      stripePrice: StripePriceRow;
      stripeValidation: { checked: boolean; active?: boolean; product?: string | null };
      alreadyCurrent?: boolean;
    }
  | { ok: false; response: NextResponse }
> {
  if (proposal.proposedPriceId && !proposal.proposedPriceId.startsWith('price_')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Proposed price ID must start with price_' }, { status: 400 }),
    };
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('stripe_prices')
    .select('*')
    .eq('id', proposal.stripePriceId)
    .maybeSingle<StripePriceRow>();

  if (currentError) {
    return {
      ok: false,
      response: NextResponse.json({ error: currentError.message }, { status: 500 }),
    };
  }
  if (!current) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Stripe price slot not found' }, { status: 404 }),
    };
  }
  if (
    current.plan_id !== proposal.planId ||
    current.billing_cycle !== proposal.billingCycle ||
    current.environment !== proposal.environment
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'The proposed price change no longer matches the current price slot.' }, { status: 409 }),
    };
  }
  const currentPriceId = current.price_id ?? null;
  if (currentPriceId !== proposal.currentPriceId) {
    if (currentPriceId === proposal.proposedPriceId) {
      const stripeValidation = { checked: false };
      await recordCatalogChangeApplication(
        changeRequestId,
        'stripe_price',
        proposal.stripePriceId,
        actorEmail,
        {
          id: current.id,
          plan_id: current.plan_id,
          billing_cycle: current.billing_cycle,
          environment: current.environment,
          price_id: currentPriceId,
          change_note: proposal.changeNote,
          stripe_validation: stripeValidation,
          approval_mode: 'inline_catalog_request',
          already_current: true,
          expected_previous_price_id: proposal.currentPriceId,
        },
      );

      return { ok: true, stripePrice: current, stripeValidation, alreadyCurrent: true };
    }

    return {
      ok: false,
      response: NextResponse.json({
        error: `The Stripe price slot changed after this request was created. Current slot value is ${currentPriceId ?? 'empty'}; this request expected ${proposal.currentPriceId ?? 'empty'}. Create a fresh request from the current row, or cancel this stale request if the current value is already correct.`,
        currentPriceId,
        expectedPreviousPriceId: proposal.currentPriceId,
        proposedPriceId: proposal.proposedPriceId,
      }, { status: 409 }),
    };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const keyEnvironment = secretKey.startsWith('sk_live_') ? 'live' : secretKey ? 'sandbox' : null;
  let stripeValidation: { checked: boolean; active?: boolean; product?: string | null } = { checked: false };

  if (proposal.proposedPriceId && keyEnvironment && current.environment === keyEnvironment) {
    try {
      const price = await getStripe().prices.retrieve(proposal.proposedPriceId);
      stripeValidation = {
        checked: true,
        active: price.active,
        product: typeof price.product === 'string' ? price.product : price.product?.id ?? null,
      };
      if (!price.active) {
        return {
          ok: false,
          response: NextResponse.json({ error: 'Stripe price exists but is inactive.' }, { status: 400 }),
        };
      }
    } catch (error) {
      return {
        ok: false,
        response: NextResponse.json({ error: (error as Error).message || 'Stripe price validation failed' }, { status: 400 }),
      };
    }
  }

  const updatedAt = new Date().toISOString();
  const { data: updatedPrice, error: updateError } = await supabaseAdmin
    .from('stripe_prices')
    .update({
      price_id: proposal.proposedPriceId || null,
      updated_at: updatedAt,
      updated_by_email: actorEmail,
      last_change_note: proposal.changeNote,
    })
    .eq('id', proposal.stripePriceId)
    .select('*')
    .single<StripePriceRow>();

  if (updateError) {
    return {
      ok: false,
      response: NextResponse.json({ error: updateError.message }, { status: 500 }),
    };
  }

  await writePlatformAuditLog(
    actorEmail,
    null,
    'update_stripe_price_id',
    'price_id',
    {
      id: current.id,
      plan_id: current.plan_id,
      billing_cycle: current.billing_cycle,
      environment: current.environment,
      price_id: current.price_id,
      change_note: current.last_change_note ?? null,
    },
    {
      id: current.id,
      plan_id: current.plan_id,
      billing_cycle: current.billing_cycle,
      environment: current.environment,
      price_id: proposal.proposedPriceId || null,
      change_note: proposal.changeNote,
      stripe_validation: stripeValidation,
      approved_change_request_id: changeRequestId,
      approval_mode: 'inline_catalog_request',
    },
  );

  await recordCatalogChangeApplication(
    changeRequestId,
    'stripe_price',
    proposal.stripePriceId,
    actorEmail,
    {
      id: current.id,
      plan_id: current.plan_id,
      billing_cycle: current.billing_cycle,
      environment: current.environment,
      price_id: proposal.proposedPriceId || null,
      change_note: proposal.changeNote,
      stripe_validation: stripeValidation,
      approval_mode: 'inline_catalog_request',
    },
  );

  return { ok: true, stripePrice: updatedPrice, stripeValidation };
}

async function applyPlanGatingUpdateProposal(
  changeRequestId: string,
  proposal: PlanGatingUpdateProposal,
  actorEmail: string,
): Promise<
  | { ok: true; planGating: PlanGatingRow; alreadyCurrent?: boolean }
  | { ok: false; response: NextResponse }
> {
  const validPlans = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
  const validStatuses = ['live', 'early_access'];
  if (!validPlans.includes(proposal.planId) || !validStatuses.includes(proposal.currentStatus) || !validStatuses.includes(proposal.proposedStatus)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid plan availability proposal.' }, { status: 400 }) };
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('plan_gating')
    .select('*')
    .eq('plan_key', proposal.planId)
    .maybeSingle<PlanGatingRow>();

  if (currentError) {
    return { ok: false, response: NextResponse.json({ error: currentError.message }, { status: 500 }) };
  }
  if (!current) {
    return { ok: false, response: NextResponse.json({ error: 'Plan availability row not found.' }, { status: 404 }) };
  }
  if (current.gating_status !== proposal.currentStatus) {
    if (current.gating_status === proposal.proposedStatus) {
      await recordCatalogChangeApplication(
        changeRequestId,
        'plan_gating',
        proposal.planId,
        actorEmail,
        {
          planKey: proposal.planId,
          gatingStatus: current.gating_status,
          changeNote: proposal.changeNote,
          approval_mode: 'inline_catalog_request',
          already_current: true,
          expected_previous_status: proposal.currentStatus,
        },
      );
      return { ok: true, planGating: current, alreadyCurrent: true };
    }

    return {
      ok: false,
      response: NextResponse.json({
        error: `Plan availability changed after this request was created. Current status is ${current.gating_status}; this request expected ${proposal.currentStatus}.`,
        currentStatus: current.gating_status,
        expectedPreviousStatus: proposal.currentStatus,
        proposedStatus: proposal.proposedStatus,
      }, { status: 409 }),
    };
  }

  const updatedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('plan_gating')
    .update({
      gating_status: proposal.proposedStatus,
      updated_at: updatedAt,
      updated_by_email: actorEmail,
      last_change_note: proposal.changeNote,
    })
    .eq('plan_key', proposal.planId)
    .select('*')
    .single<PlanGatingRow>();

  if (updateError) {
    return { ok: false, response: NextResponse.json({ error: updateError.message }, { status: 500 }) };
  }

  await writePlatformAuditLog(
    actorEmail,
    null,
    'update_plan_gating',
    'gating_status',
    {
      planKey: proposal.planId,
      gatingStatus: current.gating_status,
      changeNote: current.last_change_note ?? null,
      approvedChangeRequestId: changeRequestId,
    },
    {
      planKey: proposal.planId,
      gatingStatus: proposal.proposedStatus,
      changeNote: proposal.changeNote,
      approvedChangeRequestId: changeRequestId,
      approval_mode: 'inline_catalog_request',
    },
  );

  await recordCatalogChangeApplication(
    changeRequestId,
    'plan_gating',
    proposal.planId,
    actorEmail,
    {
      planKey: proposal.planId,
      gatingStatus: proposal.proposedStatus,
      changeNote: proposal.changeNote,
      approval_mode: 'inline_catalog_request',
    },
  );

  return { ok: true, planGating: updated };
}

async function applyPlanConfigUpdateProposal(
  changeRequestId: string,
  proposal: PlanConfigUpdateProposal,
  actorEmail: string,
): Promise<
  | { ok: true; planConfig: PlanConfigRow; alreadyCurrent?: boolean }
  | { ok: false; response: NextResponse }
> {
  const validPlans = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
  if (!validPlans.includes(proposal.planId)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid plan config proposal.' }, { status: 400 }) };
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('plan_config_overrides')
    .select('*')
    .eq('plan_id', proposal.planId)
    .maybeSingle<PlanConfigRow>();

  if (currentError) {
    return { ok: false, response: NextResponse.json({ error: currentError.message }, { status: 500 }) };
  }

  const currentShape = {
    tournamentLimit: current?.tournament_limit ?? null,
    seatLimit: current?.seat_limit ?? null,
    trialDays: current?.trial_days ?? null,
  };
  const currentMatchesExpected =
    currentShape.tournamentLimit === proposal.current.tournamentLimit &&
    currentShape.seatLimit === proposal.current.seatLimit &&
    currentShape.trialDays === proposal.current.trialDays;
  const currentMatchesProposed =
    currentShape.tournamentLimit === proposal.proposed.tournamentLimit &&
    currentShape.seatLimit === proposal.proposed.seatLimit &&
    currentShape.trialDays === proposal.proposed.trialDays;

  if (!currentMatchesExpected) {
    if (currentMatchesProposed && current) {
      await recordCatalogChangeApplication(
        changeRequestId,
        'plan_config',
        proposal.planId,
        actorEmail,
        {
          plan_id: proposal.planId,
          tournament_limit: current.tournament_limit,
          seat_limit: current.seat_limit,
          trial_days: current.trial_days,
          change_note: proposal.changeNote,
          approval_mode: 'inline_catalog_request',
          already_current: true,
          expected_previous_config: proposal.current,
        },
      );
      return { ok: true, planConfig: current, alreadyCurrent: true };
    }

    return {
      ok: false,
      response: NextResponse.json({
        error: 'Plan limits changed after this request was created. Create a fresh request from the current plan values.',
        current: currentShape,
        expectedPrevious: proposal.current,
        proposed: proposal.proposed,
      }, { status: 409 }),
    };
  }

  const previous = current
    ? {
        tournament_limit: current.tournament_limit,
        seat_limit: current.seat_limit,
        trial_days: current.trial_days,
        change_note: current.last_change_note ?? null,
      }
    : null;

  await upsertPlanConfigOverride(
    proposal.planId,
    {
      tournament_limit: proposal.proposed.tournamentLimit,
      seat_limit: proposal.proposed.seatLimit,
      trial_days: proposal.proposed.trialDays,
    },
    actorEmail,
    proposal.changeNote,
  );

  const { data: updated, error: updatedError } = await supabaseAdmin
    .from('plan_config_overrides')
    .select('*')
    .eq('plan_id', proposal.planId)
    .single<PlanConfigRow>();

  if (updatedError) {
    return { ok: false, response: NextResponse.json({ error: updatedError.message }, { status: 500 }) };
  }

  await writePlatformAuditLog(
    actorEmail,
    null,
    'update_plan_config_override',
    proposal.planId,
    previous,
    {
      tournament_limit: proposal.proposed.tournamentLimit,
      seat_limit: proposal.proposed.seatLimit,
      trial_days: proposal.proposed.trialDays,
      change_note: proposal.changeNote,
      approved_change_request_id: changeRequestId,
      approval_mode: 'inline_catalog_request',
    },
  );

  await recordCatalogChangeApplication(
    changeRequestId,
    'plan_config',
    proposal.planId,
    actorEmail,
    {
      plan_id: proposal.planId,
      tournament_limit: proposal.proposed.tournamentLimit,
      seat_limit: proposal.proposed.seatLimit,
      trial_days: proposal.proposed.trialDays,
      change_note: proposal.changeNote,
      approval_mode: 'inline_catalog_request',
    },
  );

  return { ok: true, planConfig: updated };
}

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const requestType = cleanText(body.request_type, 80) ?? '';
  const title = cleanText(body.title, 160);
  const priority = cleanText(body.priority, 40) ?? 'medium';

  if (!VALID_TYPES.has(requestType)) {
    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  const status = body.submit_for_review === true ? 'needs_review' : 'draft';
  const submittedAt = status === 'needs_review' ? new Date().toISOString() : null;

  const insert = {
    request_type: requestType,
    title,
    description: cleanText(body.description, 2000),
    status,
    priority,
    target_plan_id: cleanText(body.target_plan_id, 80),
    target_addon_key: cleanText(body.target_addon_key, 120),
    effective_at: cleanOptionalDateTime(body.effective_at),
    impact_summary: cleanText(body.impact_summary, 1200),
    proposal: typeof body.proposal === 'object' && body.proposal !== null ? body.proposal : {},
    submitted_by_email: submittedAt ? auth.user.email! : null,
    submitted_at: submittedAt,
    created_by_email: auth.user.email!,
    updated_by_email: auth.user.email!,
  };

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'create_catalog_change_request',
    data.id,
    null,
    data,
  );

  return NextResponse.json({ ok: true, changeRequest: data });
}, { route: '/api/platform-admin/product-catalog/change-requests' });

export const PATCH = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  const status = cleanText(body.status, 40);
  const implementationNotes = sanitizePlatformChangeNote(body.implementation_notes);

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
  }

  const stripePriceProposal = getStripePriceUpdateProposal(current.proposal);
  const planGatingProposal = getPlanGatingUpdateProposal(current.proposal);
  const planConfigProposal = getPlanConfigUpdateProposal(current.proposal);
  const shouldApplyStripePriceProposal = status === 'approved' && stripePriceProposal && current.status !== 'implemented';
  const shouldApplyPlanGatingProposal = status === 'approved' && planGatingProposal && current.status !== 'implemented';
  const shouldApplyPlanConfigProposal = status === 'approved' && planConfigProposal && current.status !== 'implemented';
  const appliedStripePrice = shouldApplyStripePriceProposal
    ? await applyStripePriceUpdateProposal(current.id, stripePriceProposal, auth.user.email!)
    : null;
  const appliedPlanGating = shouldApplyPlanGatingProposal
    ? await applyPlanGatingUpdateProposal(current.id, planGatingProposal, auth.user.email!)
    : null;
  const appliedPlanConfig = shouldApplyPlanConfigProposal
    ? await applyPlanConfigUpdateProposal(current.id, planConfigProposal, auth.user.email!)
    : null;

  if (appliedStripePrice && !appliedStripePrice.ok) {
    return appliedStripePrice.response;
  }
  if (appliedPlanGating && !appliedPlanGating.ok) {
    return appliedPlanGating.response;
  }
  if (appliedPlanConfig && !appliedPlanConfig.ok) {
    return appliedPlanConfig.response;
  }

  const now = new Date().toISOString();
  const appliedGeneratedProposal = Boolean(
    shouldApplyStripePriceProposal ||
    shouldApplyPlanGatingProposal ||
    shouldApplyPlanConfigProposal,
  );
  const nextStatus = appliedGeneratedProposal ? 'implemented' : status;
  const update: Record<string, string | null> = {
    status: nextStatus,
    updated_at: now,
    updated_by_email: auth.user.email!,
  };

  if ((status === 'needs_review' || appliedGeneratedProposal) && !current.submitted_at) {
    update.submitted_at = now;
    update.submitted_by_email = auth.user.email!;
  }

  if (status === 'approved' || status === 'rejected') {
    update.reviewed_at = now;
    update.reviewed_by_email = auth.user.email!;
  }

  if (appliedGeneratedProposal) {
    update.implementation_notes = implementationNotes
      ?? (appliedStripePrice?.ok && appliedStripePrice.alreadyCurrent
        ? 'Marked implemented because the Stripe price slot already matched this approved request.'
        : appliedPlanGating?.ok && appliedPlanGating.alreadyCurrent
          ? 'Marked implemented because plan availability already matched this approved request.'
          : appliedPlanConfig?.ok && appliedPlanConfig.alreadyCurrent
            ? 'Marked implemented because plan limits already matched this approved request.'
            : 'Approved and applied from the generated product request.');
  } else if (implementationNotes !== null) {
    update.implementation_notes = implementationNotes;
  }

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_catalog_change_request_status',
    id,
    {
      status: current.status,
      implementation_notes: current.implementation_notes,
    },
    {
      status: data.status,
      implementation_notes: data.implementation_notes,
      applied_stripe_price_id: shouldApplyStripePriceProposal ? stripePriceProposal.stripePriceId : null,
      applied_plan_gating: shouldApplyPlanGatingProposal ? planGatingProposal.planId : null,
      applied_plan_config: shouldApplyPlanConfigProposal ? planConfigProposal.planId : null,
    },
  );

  return NextResponse.json({
    ok: true,
    changeRequest: data,
    appliedStripePrice: appliedStripePrice && appliedStripePrice.ok
      ? {
          ...appliedStripePrice.stripePrice,
          stripe_validation: appliedStripePrice.stripeValidation,
          already_current: appliedStripePrice.alreadyCurrent === true,
        }
      : null,
    appliedPlanGating: appliedPlanGating && appliedPlanGating.ok
      ? {
          ...appliedPlanGating.planGating,
          already_current: appliedPlanGating.alreadyCurrent === true,
        }
      : null,
    appliedPlanConfig: appliedPlanConfig && appliedPlanConfig.ok
      ? {
          ...appliedPlanConfig.planConfig,
          already_current: appliedPlanConfig.alreadyCurrent === true,
        }
      : null,
  });
}, { route: '/api/platform-admin/product-catalog/change-requests' });
