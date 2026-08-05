import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrgCoachSettings, type OrgCoachSettings } from '@/lib/assistant-invites';
import { setOrgClubBookSharingEnabled } from '@/lib/db';
import { resolveClubBookAccessFor } from '@/lib/coach-club-book';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

/**
 * GET — the org's coach-level levers. Rep-teams members may read; writes owner/admin.
 *
 * ⚠ Two storage homes behind one shape, deliberately. `require_assistant_approval` lives in the
 * `organizations.coach_settings` jsonb (mig 174); `club_book_sharing_enabled` is a COLUMN
 * (mig 227) because the club-layer read filters teams on the matching `rep_teams` column and a
 * shared jsonb bag would make every write a read-modify-write of unrelated settings. The route
 * is the org's coach settings either way — the client should not have to know which is which.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  const settings = await getOrgCoachSettings(ctx!.org.id);
  // ⚠ Through the canonical resolver, not a raw plan check: `lib/coach-club-book.ts` is the ONE
  // place that decides who may use this feature, and the route that flips the org-level key is
  // the last place that should hold a second opinion. No team here — an org-level answer only.
  const clubBook = resolveClubBookAccessFor(ctx!.org);
  return NextResponse.json({
    ...settings,
    // Namespaced so a per-feature answer never collides with the jsonb bag's own key catalog.
    // `available` false ⇒ the switch is ABSENT, never locked (owner ruling §8 Q3 — a non-Club
    // org sees no trace of the feature).
    club_book: { available: clubBook.planIncluded, enabled: clubBook.orgEnabled },
    can_write: ctx!.role === 'owner' || ctx!.role === 'admin',
  });
}, { route: '/api/admin/org/coach-settings' });

// POST — the org's coach levers: the assistant-approval requirement, and (mig 227) whether this
// club's teams may share their opponent books with each other.
export const POST = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));

  // Club Shared Book (its own column, mig 227). Plan-gated server-side: the switch is absent
  // for a non-Club org, and a hand-rolled request must not be able to enable what the plan
  // does not include.
  let clubBookSharingEnabled = ctx!.org.clubBookSharingEnabled;
  if (typeof body.club_book_sharing_enabled === 'boolean') {
    if (!resolveClubBookAccessFor(ctx!.org).planIncluded) {
      return NextResponse.json({ error: 'Not available on this plan.' }, { status: 403 });
    }
    // A JSON error, like the jsonb write below — not an unhandled throw. The realistic failure
    // is an environment where migration 227 has not landed yet (the column simply is not there):
    // the admin gets a sentence they can act on instead of a blank 500.
    try {
      clubBookSharingEnabled = await setOrgClubBookSharingEnabled(
        ctx!.org.id, body.club_book_sharing_enabled,
      );
    } catch {
      return NextResponse.json(
        { error: 'Could not change book sharing for this organization.' }, { status: 500 },
      );
    }
  }

  // Merge onto existing settings so we never clobber future keys.
  const current = await getOrgCoachSettings(ctx!.org.id);
  const next: OrgCoachSettings = { ...current };
  if (typeof body.require_assistant_approval === 'boolean') {
    next.require_assistant_approval = body.require_assistant_approval;
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ coach_settings: next })
      .eq('id', ctx!.org.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    coachSettings: next,
    club_book_sharing_enabled: clubBookSharingEnabled,
  });
}, { route: '/api/admin/org/coach-settings' });
