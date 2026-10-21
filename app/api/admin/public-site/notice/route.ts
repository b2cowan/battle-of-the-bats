import { NextResponse } from 'next/server';
import { endClubNotices, postClubNotice } from '@/lib/db';
import { publicSiteEditor } from '@/lib/public-site-access';
import { NOTICE_DETAIL_MAX, NOTICE_MAX, noticeEndsAt, type NoticeEnds } from '@/lib/club-notice';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { withObservability } from '@/lib/observability';

/**
 * The club notice (Club Tier Stage 4c-1, Ask 16). Unlike the rest of the editor it is never autosaved: it tells
 * families something, so it waits for Post notice (the 2026-10-09 exception to edit-autosaves). One at a time — a new
 * post closes the old one. Owner or admin, as the editor. (The editor reads the live notice with its other data:
 * GET /api/admin/public-site?with=editor.)
 */
function parseEnds(raw: unknown): NoticeEnds | null {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (e.kind === 'tonight' || e.kind === 'tomorrow') return { kind: e.kind };
  if (e.kind === 'at' && typeof e.date === 'string' && typeof e.time === 'string') return { kind: 'at', date: e.date, time: e.time };
  return null;
}

const refused = (field: string, error: string) => NextResponse.json({ error, field }, { status: 400 });

/** Post notice (and Update notice, which posts a new one in its place). */
export const POST = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const notice = typeof body?.notice === 'string' ? body.notice.trim() : '';
  if (!notice) return refused('notice', W.noticeEmpty);
  if (notice.length > NOTICE_MAX) return refused('notice', W.noticeTooLong(NOTICE_MAX));
  const detail = typeof body?.detail === 'string' ? body.detail.trim() : '';
  if (detail.length > NOTICE_DETAIL_MAX) return refused('detail', W.detailTooLong(NOTICE_DETAIL_MAX));
  const ends = parseEnds(body?.ends);
  const postedAt = new Date().toISOString();
  const endsAt = ends ? noticeEndsAt(ends, postedAt) : null;
  if (!endsAt) return refused('ends', W.pastTime);

  try {
    const posted = await postClubNotice(r.ctx.org.id, {
      notice,
      detail: detail || null,
      postedAt,
      endsAt,
      postedByUserId: r.ctx.user.id,
      postedByEmail: r.ctx.user.email ?? 'unknown',
    });
    return NextResponse.json({ notice: posted });
  } catch (e) {
    console.error('notice POST failed', e);
    return NextResponse.json({ error: W.postFailed }, { status: 500 });
  }
}, { route: '/api/admin/public-site/notice' });

/** End now. */
export const DELETE = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  try {
    await endClubNotices(r.ctx.org.id, r.ctx.user.email ?? 'unknown');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('notice DELETE failed', e);
    return NextResponse.json({ error: W.endFailed }, { status: 500 });
  }
}, { route: '/api/admin/public-site/notice' });
