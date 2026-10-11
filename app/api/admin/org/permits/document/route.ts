import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { canSaveVenueLibrary } from '@/lib/venue-library';
import { PERMIT_WORDS as W } from '@/lib/permit-words';
import { isUuid } from '@/lib/utils';

// ---------------------------------------------------------------------------
// A PERMIT'S DOCUMENT — the issuer's copy, kept with the permit (Club Tier Stage 10a; hub specimen 2: "Document — its name
// and size, opened by the signed link, replaced by a new upload").
//
// GET  ?orgSlug=&id=<permit>        — { url }: a ONE-HOUR signed link to read it. The storage path is never sent.
// POST ?orgSlug=&id=<permit>        — multipart `file`: PDF, JPEG or PNG, 10 MB at most. Replaces the one there (the old
//                                     file is removed once the new one is recorded).
//
// The private `org-permit-documents` bucket was made by mig 322 (never in the dashboard), with NO storage policies: this
// route reads and writes it with the service role, as `rep-team-documents` is used. Path:
// `${org.id}/permits/${permitId}/${uuid}-${name}`.
// WHO: the Venue library's readers read it (a coach never does); its savers replace it.
// ---------------------------------------------------------------------------

const BUCKET = 'org-permit-documents';
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024;

const refusal = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status });

type Gate =
  | { error: Response }
  | { ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>; permit: { id: string; org_id: string; document_path: string | null } };

async function gate(req: Request): Promise<Gate> {
  const params = new URL(req.url).searchParams;
  const ctx = await getAuthContextWithRole({ orgSlug: params.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (!hasOrgVenueLibrary(ctx.org.planId)) return { error: refusal(403, 'plan_lacks_permits', W.planLocked) };
  if (ctx.role === 'coach') return { error: forbidden() };
  const id = params.get('id') ?? '';
  if (!isUuid(id)) return { error: refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.') };
  // The tenant wall (supabaseAdmin bypasses row security).
  const { data: permit, error } = await supabaseAdmin.from('org_permits')
    .select('id, org_id, document_path').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!permit || permit.org_id !== ctx.org.id) return { error: refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.') };
  return { ctx, permit: permit as { id: string; org_id: string; document_path: string | null } };
}

export const GET = withObservability(async (req: Request) => {
  try {
    const g = await gate(req);
    if ('error' in g) return g.error;
    if (!g.permit.document_path) return refusal(404, 'no_document', 'This permit has no document.');
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(g.permit.document_path, 3600);
    if (error || !data?.signedUrl) return refusal(502, 'document_unavailable', 'The document couldn’t be opened just now. Try again.');
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    return captureAndJson(err, { error: 'The document couldn’t be opened just now. Try again.', code: 'document_failed' }, 500);
  }
}, { route: '/api/admin/org/permits/document' });

export const POST = withObservability(async (req: Request) => {
  try {
    const g = await gate(req);
    if ('error' in g) return g.error;
    if (!canSaveVenueLibrary(g.ctx.role, g.ctx.capabilities)) {
      return refusal(403, 'no_venue_permission', 'Your role can’t change the club’s permits. Ask your club’s owner or an admin.');
    }
    // Refused before the body is read: an upload past the limit (with the form's own few bytes) never fills the server.
    if (Number(req.headers.get('content-length') ?? 0) > MAX_SIZE + 64 * 1024) {
      return refusal(413, 'file_size', 'The file is over 10 MB. Upload a smaller copy.');
    }
    let form: FormData;
    try { form = await req.formData(); } catch { return refusal(400, 'bad_upload', 'That upload didn’t arrive whole. Try again.'); }
    const file = form.get('file');
    if (!(file instanceof File)) return refusal(400, 'no_file', 'Choose the permit’s file to upload.');
    if (!TYPES.includes(file.type)) return refusal(400, 'file_type', 'Upload a PDF, JPG or PNG.');
    if (file.size > MAX_SIZE) return refusal(400, 'file_size', 'The file is over 10 MB. Upload a smaller copy.');

    const name = file.name.replace(/[^\w.\- ()]+/g, '_').slice(-120) || 'permit';
    const path = `${g.ctx.org.id}/permits/${g.permit.id}/${crypto.randomUUID()}-${name}`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (upErr) return refusal(502, 'upload_failed', 'The document couldn’t be saved just now. Try again.');
    const addedAt = new Date().toISOString();
    const { data: took, error } = await supabaseAdmin.from('org_permits').update({
      document_path: path, document_name: file.name.slice(0, 200), document_size: file.size, document_type: file.type,
      document_added_at: addedAt, updated_at: addedAt, updated_by: g.ctx.user.id,
    }).eq('id', g.permit.id).eq('org_id', g.ctx.org.id).select('id');
    if (error || !took?.length) {
      // The row didn't take it (or the permit went meanwhile): the new file is an orphan — take it back.
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      return refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.');
    }
    if (g.permit.document_path) {
      const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove([g.permit.document_path]);
      if (rmErr) console.error('[permits] the replaced document stayed behind:', rmErr);
    }
    return NextResponse.json({ success: true, document: { name: file.name.slice(0, 200), size: file.size, addedAt, type: file.type } });
  } catch (err) {
    return captureAndJson(err, { error: 'The document couldn’t be saved just now. Try again.', code: 'document_failed' }, 500);
  }
}, { route: '/api/admin/org/permits/document' });
