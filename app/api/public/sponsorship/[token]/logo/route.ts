import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { prepareSponsorLogo } from '@/lib/sponsor-logo-image';
import { ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { storeDealLogo } from '@/lib/club-sponsorship-deals-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CLUB_FORM_BUCKET } from '@/lib/club-form-server';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';

export const dynamic = 'force-dynamic';

const P = DEAL_WORDS.page;

/**
 * POST /api/public/sponsorship/[token]/logo — the business sends its logo (round 1 tab 4 "Your logo"; "Send it later from
 * this page"). Multipart `file`: JPG, PNG or WebP up to 2 MB, re-encoded to the sponsor-logo PNG (≤480×216). It stays
 * PRIVATE on the deal until the deal's place shows (paid, or the club ticks the logo line — ask 5); only then is it copied
 * to the public logo bucket (lib/club-sponsorship-deals-server.ts). Throttled first; the token's deal only; refused once the
 * deal is paid (the club changes the logo on the Sponsors tab then). Answers a one-hour link to show it back.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token } = await params;
  const at = await dealForLink(token);
  if ('failure' in at) return at.failure;
  const { org, deal } = at;
  if (deal.state === 'paid') return NextResponse.json({ error: P.errClosed, code: 'closed' }, { status: 409 });

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > ORG_LOGO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: P.logoRefused, code: 'too_big' }, { status: 413 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: P.logoFailed }, { status: 400 }); }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: P.logoFailed }, { status: 400 });
  if (file.size > ORG_LOGO_MAX_BYTES || !(ORG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: P.logoRefused, code: 'type' }, { status: 415 });
  }
  const prepared = await prepareSponsorLogo(Buffer.from(await file.arrayBuffer()), file.type);
  if (!prepared.ok) return NextResponse.json({ error: P.logoRefused, code: 'type' }, { status: 415 });
  try {
    await storeDealLogo(org.id, deal.id, prepared.png);
    const { data } = await supabaseAdmin.from('club_sponsor_deals').select('logo_path, club_sponsors(logo_url)').eq('org_id', org.id).eq('id', deal.id).maybeSingle();
    const row = data as { logo_path: string | null; club_sponsors: { logo_url: string | null } | { logo_url: string | null }[] | null } | null;
    const joined = row?.club_sponsors ?? null;
    const sponsor = Array.isArray(joined) ? joined[0] : joined;
    // Still waiting: a one-hour link to the private copy. Already showing (its place is up): the public logo.
    const url = row?.logo_path
      ? (await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(row.logo_path, 3600)).data?.signedUrl ?? null
      : sponsor?.logo_url ?? null;
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    console.error('[sponsorship-link] storing a logo failed:', (e as { code?: string })?.code ?? 'no code');
    return NextResponse.json({ error: P.logoFailed }, { status: 500 });
  }
}, { route: '/api/public/sponsorship/[token]/logo' });
