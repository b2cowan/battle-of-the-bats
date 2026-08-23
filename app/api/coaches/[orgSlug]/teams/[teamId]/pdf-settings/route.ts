import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getRepTeam, updateRepTeamPdfLook } from '@/lib/db';
import { getEntitledTeamMembership, requireHeadCoachMembership } from '@/lib/coach-membership';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { hasPlanFeature } from '@/lib/plan-features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  resolveOrgPdfSettings,
  applyTeamLook,
  normalizeLogoDataUrl,
  type TeamPdfLook,
} from '@/lib/export/resolve-pdf-settings';
import { withObservability } from '@/lib/observability';

/**
 * The team layer of document branding (PDF Export Quality Phase 1, decision 7).
 *
 * GET  — the settings TEAM paper is generated with (team → club → defaults, team name as the
 *        header identity). Any coach on the team may read; every coach export surface fetches
 *        this. With `?card=1`, additionally returns the `look` block the "How your documents
 *        look" card renders (both layers separately, incl. the club's logo) — export surfaces
 *        omit it, which roughly halves the payload when a logo is in play.
 * PUT  — replace the team's look. Head coach only, on plans that include customization
 *        (pdf_template_settings — Tournament Plus+ orgs, and the standalone Premium portal).
 *        {} returns the team to full inheritance ("Use club look").
 *
 * ⚠ No program-year requirement on either verb: the look lives on the TEAM and outlasts any
 * season (like the club-book switch, unlike lineup caps). Membership is the gate.
 */

export const GET = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  // All three lookups are independent of each other — one round-trip's worth of latency,
  // not three (the sibling team route's idiom).
  const [team, membership, orgRow] = await Promise.all([
    getRepTeam(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
    supabaseAdmin.from('organizations').select('pdf_settings').eq('id', ctx.org.id).single(),
  ]);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!membership) return forbidden();
  if (orgRow.error) return NextResponse.json({ error: orgRow.error.message }, { status: 500 });

  const canCustomize = hasPlanFeature(ctx.org.planId, 'pdf_template_settings');
  const club = await resolveOrgPdfSettings({
    id: ctx.org.id,
    name: ctx.org.name,
    planId: ctx.org.planId,
    logoUrl: ctx.org.logoUrl ?? null,
    pdfSettings: (orgRow.data?.pdf_settings as Record<string, unknown> | null) ?? {},
  });

  // Export-ready: what every document this team prints carries.
  const settings = applyTeamLook(club, team.name, team.pdfLook, canCustomize);

  if (req.nextUrl.searchParams.get('card') !== '1') {
    return NextResponse.json({ settings });
  }

  const isStandalone =
    isTeamWorkspaceOrg(ctx.org) &&
    ctx.org.teamWorkspaceStatus !== 'org_owned' &&
    ctx.org.teamWorkspaceStatus !== 'archived';

  return NextResponse.json({
    settings,
    // For the card: the two layers, separately.
    look: {
      team: team.pdfLook ?? {},
      club: {
        // A standalone team's "club" is its own workspace org — the card hides the
        // inheritance framing when isStandalone is true.
        name: ctx.org.name,
        logoDataUrl: club.logoDataUrl ?? null,
        accentColor: club.accentColor,
        footerText: club.footerText ?? null,
      },
      teamColor: team.color ?? null,
      canCustomize,
      isHeadCoach: membership.coachRole === 'head_coach',
      isStandalone,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings' });

/** Data-URL guard: pre-normalized PNG/JPEG only, bounded so one crest can't bloat every export. */
const LOGO_DATA_URL_MAX_CHARS = 420_000; // ≈300 KB of binary after base64 inflation
const LOGO_DATA_URL_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FOOTER_MAX_CHARS = 200;

export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await requireHeadCoachMembership(
    orgSlug, teamId, 'Only the head coach can change how documents look.',
  );
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  if (!hasPlanFeature(ctx.org.planId, 'pdf_template_settings')) {
    return NextResponse.json(
      { error: 'Document customization is not included in this plan.' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const look: TeamPdfLook = {};
  if (body.logoDataUrl != null) {
    if (
      typeof body.logoDataUrl !== 'string' ||
      body.logoDataUrl.length > LOGO_DATA_URL_MAX_CHARS ||
      !LOGO_DATA_URL_RE.test(body.logoDataUrl)
    ) {
      return NextResponse.json(
        { error: 'Crest must be a PNG or JPEG image under 300 KB.' },
        { status: 400 },
      );
    }
    // Server-side teeth behind the client's canvas downscale: DECODE and re-encode the
    // image through sharp (bounded pixels, bounded bytes). A hand-crafted PUT carrying a
    // small-bytes/huge-pixels bomb is rejected here — never stored and served to every
    // other viewer of this team's documents.
    const normalized = await normalizeLogoDataUrl(body.logoDataUrl);
    if (!normalized) {
      return NextResponse.json({ error: 'Crest must be a valid image.' }, { status: 400 });
    }
    look.logoDataUrl = normalized;
  }
  if (body.accentColor != null) {
    if (typeof body.accentColor !== 'string' || !HEX_COLOR_RE.test(body.accentColor)) {
      return NextResponse.json({ error: 'Accent colour must be a hex value like #7A1F2B.' }, { status: 400 });
    }
    look.accentColor = body.accentColor;
  }
  if (body.footerText != null) {
    if (typeof body.footerText !== 'string' || body.footerText.length > FOOTER_MAX_CHARS) {
      return NextResponse.json(
        { error: `Footer line must be ${FOOTER_MAX_CHARS} characters or fewer.` },
        { status: 400 },
      );
    }
    const trimmed = body.footerText.trim();
    if (trimmed) look.footerText = trimmed;
  }

  // Whole-object replace: absent keys mean "inherit the club's", and {} is "Use club look".
  await updateRepTeamPdfLook(team.id, look);
  return NextResponse.json({ ok: true, team: look });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings' });
