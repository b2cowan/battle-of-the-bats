import { NextResponse } from 'next/server';
import { requirePlatformOwnerApi } from '@/lib/platform-owner';
import { withObservability } from '@/lib/observability';
import { makePreviewClub } from '@/lib/prospect-clubs-server';
import { MAKE_WORDS } from '@/lib/prospect-clubs';
import { zonedWallClockToUtc } from '@/lib/timezone';

/**
 * POST /api/platform-admin/prospect-clubs — Make a club for a meeting (Club Website Track P, Session P2; owner ruling T2:
 * the owner only, by the one owner allowlist, never a platform role). Multipart: the window's fields and the logo.
 *
 * Answers: 200 `{ orgId, slug }` (made, with its whole sample) · 400 `{ fieldErrors }` (each said under its field) ·
 * 409 `{ cap: true }` (five open) · 500 `{ error }` ("Nothing was made. Try again."; reported to Errors).
 */
function text(form: FormData, key: string, max = 2000): string {
  const raw = form.get(key);
  return typeof raw === 'string' ? raw.slice(0, max) : '';
}

export const POST = withObservability(async (req: Request) => {
  const gate = await requirePlatformOwnerApi();
  if (gate.response) return gate.response;
  const { auth } = gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'That didn’t go through. Try again.' }, { status: 400 });
  }
  const logo = form.get('logo');
  // The meeting arrives as the club's wall clock (`YYYY-MM-DDTHH:MM`, America/Toronto), the window's one field.
  const meeting = text(form, 'meeting', 16);
  const [date, time] = meeting.split('T');
  const input = {
    name: text(form, 'name', 200),
    slug: text(form, 'slug', 100),
    sport: text(form, 'sport', 40),
    province: text(form, 'province', 2),
    logo: logo instanceof File ? { type: logo.type, size: logo.size } : null,
    source: text(form, 'source'),
    primary: text(form, 'primary', 7),
    accent: text(form, 'accent', 7),
    line: text(form, 'line', 400),
    meeting,
    meetingAt: zonedWallClockToUtc(date, time),
  };
  if (!(logo instanceof File)) return NextResponse.json({ fieldErrors: { logo: MAKE_WORDS.err.logo } }, { status: 400 });

  const result = await makePreviewClub(input, logo, { id: auth.user.id, email: auth.user.email ?? '' });
  if (result.ok) return NextResponse.json({ orgId: result.orgId, slug: result.slug });
  if (result.kind === 'fields') return NextResponse.json({ fieldErrors: result.errors }, { status: 400 });
  if (result.kind === 'cap') return NextResponse.json({ cap: true }, { status: 409 });
  return NextResponse.json({ error: MAKE_WORDS.failed }, { status: 500 });
}, { route: '/api/platform-admin/prospect-clubs' });
