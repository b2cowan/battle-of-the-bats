import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { CLUB_FORM_BUCKET, ensureSeasonForm, readVersionRow } from '@/lib/club-form-server';
import { formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

export const dynamic = 'force-dynamic';

const ONE_HOUR = 3600;

/**
 * A DOCUMENT'S PDF, FOR THE CLUB (Board Ready Stage 4 Part 1). `?version=` names a version (the current one without it).
 * Anyone who can open the season may read the club's own documents; the path comes from the version row, never the
 * request, and the link it redirects to is signed for one hour (the published Privacy Policy's promise). Opened in a tab:
 * a club's own document, not a family's file (those download, Part 3).
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; documentId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'read', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const { documentId } = await params;
  const { data: doc } = await supabaseAdmin.from('club_form_documents').select('id').eq('id', documentId).eq('form_id', formId).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  const version = await readVersionRow(documentId, new URL(req.url).searchParams.get('version'));
  if (!version?.file_path) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  const { data, error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(version.file_path, ONE_HOUR);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'The file didn’t open. Try again.' }, { status: 500 });
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]/file' });
