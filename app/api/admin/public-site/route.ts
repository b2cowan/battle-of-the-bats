import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getOrgPublicSiteContent, upsertOrgPublicSiteContent } from '@/lib/db';

const URL_RE = /^https:\/\/.+/;
const MAX_TAGLINE     = 100;
const MAX_DESCRIPTION = 1000;
const MAX_EMAIL       = 254;
const MAX_URL         = 500;

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_public_site')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_public_site')) return forbidden();
  return null;
}

export async function GET() {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const content = await getOrgPublicSiteContent(ctx!.org.id);
  return NextResponse.json(content ?? {});
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json();

  const tagline     = body.tagline     != null ? String(body.tagline).trim().slice(0, MAX_TAGLINE)     : null;
  const description = body.description != null ? String(body.description).trim().slice(0, MAX_DESCRIPTION) : null;

  const contactEmail = body.contactEmail != null
    ? String(body.contactEmail).trim().slice(0, MAX_EMAIL) || null
    : null;

  function sanitizeUrl(raw: unknown): string | null {
    if (raw == null) return null;
    const s = String(raw).trim().slice(0, MAX_URL);
    if (!s) return null;
    if (!URL_RE.test(s)) return null;
    return s;
  }

  await upsertOrgPublicSiteContent(ctx!.org.id, {
    tagline:                  tagline || null,
    description:              description || null,
    contactEmail,
    socialInstagram:          sanitizeUrl(body.socialInstagram),
    socialFacebook:           sanitizeUrl(body.socialFacebook),
    socialX:                  sanitizeUrl(body.socialX),
    socialWebsite:            sanitizeUrl(body.socialWebsite),
    showUpcomingTournaments:  body.showUpcomingTournaments !== false,
    showArchivesLink:         body.showArchivesLink !== false,
  });

  return NextResponse.json({ ok: true });
}
