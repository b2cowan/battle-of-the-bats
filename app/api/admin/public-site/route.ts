import { NextResponse } from 'next/server';
import { getLiveClubNotice, getOrgPublicSiteContent, upsertOrgPublicSiteContent } from '@/lib/db';
import { publicSiteEditor } from '@/lib/public-site-access';
import { publicSiteEditorFacts } from '@/lib/public-site-editor-facts';
import { parsePublicSitePatch } from '@/lib/public-site-patch';
import { withoutMissingLogos } from '@/lib/sponsor-logo-storage';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: false });
  if (r.error) return r.error;
  const org = r.ctx.org;

  // The editor (Stage 4c-1) asks for its rows' facts and the live notice too; other callers (onboarding) get the content.
  if (new URL(req.url).searchParams.get('with') === 'editor') {
    const contentRead = getOrgPublicSiteContent(org.id);
    const [content, editor, notice] = await Promise.all([
      contentRead,
      publicSiteEditorFacts(org, contentRead),
      getLiveClubNotice(org.id),
    ]);
    return NextResponse.json({ content: content ?? null, ...editor, notice });
  }
  const content = await getOrgPublicSiteContent(org.id);
  return NextResponse.json(content ?? {});
}, { route: '/api/admin/public-site' });

/**
 * Club Tier Stage 4c-1: each editor card saves itself, so this takes any subset of fields and stores ONLY those. A
 * refused field answers 400 with its name and the reason, and nothing in the request is saved (F05) — the editor shows
 * the reason beside the field. Owner or admin only.
 */
export const PATCH = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;

  const body = await req.json().catch(() => null);
  // The club's id lets a sponsor's logo be held to the club's own upload folder (lib/sponsor-logo.ts).
  const parsed = parsePublicSitePatch(body, undefined, { orgId: r.ctx.org.id });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  if (Object.keys(parsed.patch).length === 0) return NextResponse.json({ ok: true, saved: {} });
  // A stale tab must not save a sponsor pointing at a logo file another admin already replaced and removed.
  if (parsed.patch.sponsors) parsed.patch.sponsors = await withoutMissingLogos(r.ctx.org.id, parsed.patch.sponsors);

  try {
    await upsertOrgPublicSiteContent(r.ctx.org.id, parsed.patch);
  } catch (e) {
    console.error('public-site PATCH failed', e);
    return NextResponse.json({ error: W.saveFailed }, { status: 500 });
  }
  // What was stored, so the editor can say "Saved as https://…" and keep the new rows' ids.
  return NextResponse.json({ ok: true, saved: parsed.patch });
}, { route: '/api/admin/public-site' });
