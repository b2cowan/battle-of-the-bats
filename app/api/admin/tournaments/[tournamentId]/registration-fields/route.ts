import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  createTournamentRegistrationField,
  getTournamentRegistrationFields,
  reorderTournamentRegistrationFields,
  type TournamentRegistrationFieldInput,
} from '@/lib/db';
import type { TournamentRegistrationFieldType } from '@/lib/types';
import { withObservability } from '@/lib/observability';

const FIELD_TYPES = new Set<TournamentRegistrationFieldType>([
  'short_text',
  'long_text',
  'dropdown',
  'checkbox',
  'file',
]);

type RouteParams = { params: Promise<{ tournamentId: string }> };

async function getScopedTournament(tournamentId: string, ctx: Awaited<ReturnType<typeof getAuthContextWithScope>>) {
  if (!ctx) return { response: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return { response: forbidden() };

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { response: denied };

  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, org_id')
    .eq('id', tournamentId)
    .maybeSingle<{ id: string; org_id: string | null }>();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!tournament || tournament.org_id !== ctx.org.id) {
    return { response: forbidden() };
  }

  if (!hasPlanFeature(ctx.org.planId, 'custom_registration_fields')) {
    return {
      response: NextResponse.json(
        { error: requiresTournamentPlusCopy('custom_registration_fields') },
        { status: 403 },
      ),
    };
  }

  return { tournament };
}

function parseOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
}

function parseFieldInput(body: Record<string, unknown>): TournamentRegistrationFieldInput | { error: string } {
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const fieldType = body.fieldType;
  if (!label) return { error: 'Question label is required.' };
  if (typeof fieldType !== 'string' || !FIELD_TYPES.has(fieldType as TournamentRegistrationFieldType)) {
    return { error: 'Choose a supported question type.' };
  }
  const options = parseOptions(body.options);
  if (fieldType === 'dropdown' && options.length === 0) {
    return { error: 'Dropdown questions need at least one option.' };
  }
  return {
    label,
    fieldType: fieldType as TournamentRegistrationFieldType,
    options,
    required: body.required === true,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
  };
}

export const GET = withObservability(async (_req: NextRequest, { params }: RouteParams) => {
  const orgSlug = _req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  const { tournamentId } = await params;
  const scoped = await getScopedTournament(tournamentId, ctx);
  if ('response' in scoped) return scoped.response!;

  const fields = await getTournamentRegistrationFields(tournamentId, { includeArchived: false });
  return NextResponse.json({ fields });
}, { route: '/api/admin/tournaments/[tournamentId]/registration-fields' });

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const scoped = await getScopedTournament(tournamentId, ctx);
  if ('response' in scoped) return scoped.response!;

  const body = await req.json() as Record<string, unknown>;
  if (body.action === 'reorder' && Array.isArray(body.fields)) {
    const existing = await getTournamentRegistrationFields(tournamentId);
    const existingIds = new Set(existing.map(field => field.id));
    const fields = body.fields
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        return typeof row.id === 'string' && typeof row.sortOrder === 'number'
          ? { id: row.id, sortOrder: row.sortOrder }
          : null;
      })
      .filter(Boolean) as Array<{ id: string; sortOrder: number }>;
    if (fields.some(field => !existingIds.has(field.id))) {
      return NextResponse.json({ error: 'Invalid registration question order.' }, { status: 400 });
    }
    await reorderTournamentRegistrationFields(fields);
    return NextResponse.json({ ok: true });
  }

  const input = parseFieldInput(body);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const current = await getTournamentRegistrationFields(tournamentId);
  const field = await createTournamentRegistrationField(tournamentId, ctx.org.id, {
    ...input,
    sortOrder: input.sortOrder ?? current.length,
  });

  return NextResponse.json({ field }, { status: 201 });
}, { route: '/api/admin/tournaments/[tournamentId]/registration-fields' });
