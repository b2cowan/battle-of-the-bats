import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getEntitledTeamMembership } from '@/lib/coach-membership';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { crestBytes } from '@/lib/team-crest';
import { withObservability } from '@/lib/observability';

/**
 * GET — the team's crest as a picture (navigation Phase 4, C7, owner 2026-11-11): the sidebar's team cell and the team list
 * show it from here, so no page carries every team's picture inline. The same door as the document settings it is kept in
 * (`../pdf-settings` GET): any coach on the team. Reads only the picture (a JSON path), never the rest of the team.
 *
 * Cached privately and for good: the address carries the crest's version (`?v=`, lib/coach-team-tile.ts `teamCrestUrl`), so
 * a new picture is a new address. 404 when the team has none — the tile falls to the team's colour.
 */
export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const [teamRow, membership] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('org_id, crest:pdf_settings->>logoDataUrl').eq('id', teamId).maybeSingle(),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
  ]);
  if (teamRow.error) return NextResponse.json({ error: teamRow.error.message }, { status: 500 });
  const team = teamRow.data as { org_id: string; crest: string | null } | null;
  if (!team || team.org_id !== ctx.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!membership) return forbidden();

  const bytes = crestBytes(team.crest);
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Every stored crest is a PNG: the save route re-encodes whatever was uploaded (`normalizeLogoDataUrl`).
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/crest' });
