import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  archiveTournamentRegistrationField,
  updateTournamentRegistrationField,
} from '@/lib/db';
import type { TournamentRegistrationFieldType } from '@/lib/types';

const FIELD_TYPES = new Set<TournamentRegistrationFieldType>([
  'short_text',
  'long_text',
  'dropdown',
  'checkbox',
  'file',
]);

type RouteParams = { params: Promise<{ tournamentId: string; fieldId: string }> };

async function guardField(tournamentId: string, fieldId: string) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return { response: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return { response: forbidden() };

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { response: denied };

  if (!hasPlanFeature(ctx.org.planId, 'custom_registration_fields')) {
    return {
      response: NextResponse.json(
        { error: requiresTournamentPlusCopy('custom_registration_fields') },
        { status: 403 },
      ),
    };
  }

  const { data: field, error } = await supabaseAdmin
    .from('tournament_registration_fields')
    .select('id, tournament_id, org_id')
    .eq('id', fieldId)
    .maybeSingle<{ id: string; tournament_id: string; org_id: string }>();

  if (error) return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!field || field.tournament_id !== tournamentId || field.org_id !== ctx.org.id) {
    return { response: forbidden() };
  }

  return { field };
}

function parseOptions(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { tournamentId, fieldId } = await params;
  const guarded = await guardField(tournamentId, fieldId);
  if ('response' in guarded) return guarded.response;

  const body = await req.json() as Record<string, unknown>;
  const patch: Parameters<typeof updateTournamentRegistrationField>[1] = {};

  if (body.label !== undefined) {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return NextResponse.json({ error: 'Question label is required.' }, { status: 400 });
    patch.label = label;
  }
  if (body.fieldType !== undefined) {
    if (typeof body.fieldType !== 'string' || !FIELD_TYPES.has(body.fieldType as TournamentRegistrationFieldType)) {
      return NextResponse.json({ error: 'Choose a supported question type.' }, { status: 400 });
    }
    patch.fieldType = body.fieldType as TournamentRegistrationFieldType;
  }
  if (body.options !== undefined) {
    patch.options = parseOptions(body.options) ?? [];
  }
  if (body.required !== undefined) patch.required = body.required === true;
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== 'number') return NextResponse.json({ error: 'Invalid sort order.' }, { status: 400 });
    patch.sortOrder = body.sortOrder;
  }

  if (patch.fieldType === 'dropdown' && (!patch.options || patch.options.length === 0)) {
    return NextResponse.json({ error: 'Dropdown questions need at least one option.' }, { status: 400 });
  }

  const field = await updateTournamentRegistrationField(fieldId, patch);
  return NextResponse.json({ field });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { tournamentId, fieldId } = await params;
  const guarded = await guardField(tournamentId, fieldId);
  if ('response' in guarded) return guarded.response;

  await archiveTournamentRegistrationField(fieldId);
  return NextResponse.json({ ok: true });
}
