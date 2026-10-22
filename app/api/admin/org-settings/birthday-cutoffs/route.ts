import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { loadBirthdaySports } from '@/lib/birthday-cutoff-server';
import { cleanCutoffs } from '@/lib/born-years';
import { normalizeSportId } from '@/lib/sports';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';

/** A club with rep teams or house league has teams to count; any other has none, so the card is absent for it. */
function appliesTo(org: Parameters<typeof hasModuleEntitlement>[0]): boolean {
  return hasModuleEntitlement(org, 'module_rep_teams') || hasModuleEntitlement(org, 'module_house_league');
}

/**
 * GET — what Settings' "When birthdays count from" card shows (Club Tier Stage 4c-2 Part A): the club's saved cut-offs and one
 * row per sport it runs, with the counts and the places that carry birth years (the card works out its own sentences from the
 * one rule in `lib/born-years.ts`). Owner only, as the card and Settings (ruled 2026-10-22; Stage 13 may revisit). `applies` is false for an organization with
 * neither rep teams nor house league: it has no teams to count, so the card is absent for it, never an empty promise.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  if (!appliesTo(ctx.org)) return NextResponse.json({ applies: false, cutoffs: {}, sports: [] });

  const sports = await loadBirthdaySports(ctx.org.id);
  return NextResponse.json({ applies: true, cutoffs: ctx.org.birthdayCutoffs ?? {}, sports });
}, { route: '/api/admin/org-settings/birthday-cutoffs' });

/**
 * PATCH `{ sport, cutoff: { m, d } }` — the owner's save of ONE sport's date (January 1 removes the key). The route merges that
 * sport into the stored map and returns the whole saved map, so two tabs or two quick changes never overwrite each other's
 * sports, and a Retry resends only the sport that failed.
 * ⚖ The OWNER'S ALONE, one gate (owner ruling 2026-10-22, Club Tier Stage 4c-2: matching Settings; Stage 13 may revisit) — it
 * is not "the club's look", so it has no door through `/api/admin/org-settings`. Like the GET it is for a club with rep teams
 * or house league. A date that is not on the lists is refused (K8); so is a sport the club does not run, unless it is already
 * stored, so an old entry is never trapped.
 */
export const PATCH = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  if (!appliesTo(ctx.org)) return forbidden();

  const body = await req.json().catch(() => null) as { sport?: unknown; cutoff?: unknown } | null;
  const sport = body?.sport;
  if (typeof sport !== 'string' || sport !== normalizeSportId(sport)) {
    return NextResponse.json({ error: "That isn't a sport your club runs." }, { status: 400 });
  }
  const cleaned = cleanCutoffs({ [sport]: body?.cutoff });
  if (!cleaned) return NextResponse.json({ error: 'Pick a month and day from the lists.' }, { status: 400 });

  const stored = ctx.org.birthdayCutoffs ?? {};
  const next = { ...stored };
  delete next[sport];
  if (cleaned[sport]) {
    // A sport the club does not run is refused, unless it is already stored.
    const allowed = sport in stored || (await loadBirthdaySports(ctx.org.id)).some(s => s.id === sport);
    if (!allowed) return NextResponse.json({ error: "That isn't a sport your club runs." }, { status: 400 });
    next[sport] = cleaned[sport];
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update({ birthday_cutoffs: next })
    .eq('id', ctx.org.id)
    .select('birthday_cutoffs')
    .single();
  if (error) return captureAndJson(error, { error: "Couldn't save your changes. Try again." }, 500);
  return NextResponse.json({ birthdayCutoffs: data.birthday_cutoffs ?? {} });
}, { route: '/api/admin/org-settings/birthday-cutoffs' });
