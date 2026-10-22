import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { mayOpenSiteEditor, mayWriteSite } from '@/lib/public-site-rules';

type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>;

/**
 * WHO CHANGES THE CLUB'S LOOK — its logo, colours, type and banner (Public site builder, Option A, ruled 2026-10-21): the
 * owner, or an admin who has the editor (the public-site capability on a plan that carries the module). The site's on/off
 * switch, its directory listing, the club's name and its web address stay the OWNER's (the org-settings route refuses an
 * admin anything outside `CLUB_LOOK_FIELDS`).
 *
 * ⚖ An admin needs the editor, not just the role: the look was an owner's thing on every plan, and the ruling widened it
 * for the club's public site — a tournament-only organization has no such site and no editor, so its admin gains nothing.
 * The owner changes the look wherever it was theirs before.
 */
export async function clubLookEditor(req: Request): Promise<{ ctx: Ctx; error?: never } | { ctx?: never; error: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.role === 'owner') return { ctx };
  if (ctx.role !== 'admin' || !mayOpenSiteEditor(ctx)) return { error: forbidden() };
  return { ctx };
}

/**
 * WHO MAY USE THE PUBLIC-SITE EDITOR — one rule for its two routes (the site's words and lists, and the club notice;
 * Club Tier Stage 4c-1). Reading needs the public-site capability on a plan that carries the module; writing — a save,
 * a notice posted or ended — is the owner's or an admin's.
 */
export async function publicSiteEditor(req: Request, { write }: { write: boolean }): Promise<{ ctx: Ctx; error?: never } | { ctx?: never; error: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (!mayOpenSiteEditor(ctx)) return { error: forbidden() };
  if (write && !mayWriteSite(ctx.role)) {
    return { error: NextResponse.json({ error: W.readOnly }, { status: 403 }) };
  }
  return { ctx };
}
