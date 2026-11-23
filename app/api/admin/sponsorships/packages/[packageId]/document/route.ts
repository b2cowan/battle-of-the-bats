import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPackage, setPackageDocument } from '@/lib/club-sponsorships-server';
import { CLUB_FORM_BUCKET } from '@/lib/club-form-server';
import { readDocumentUpload } from '@/lib/club-form-route';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';

/**
 * A PACKAGE'S SPONSORSHIP DOCUMENT (Board Ready Stage 6, Part 1; round 1 tab 2): an optional PDF up to 8 MB, Stage 4's
 * document field (`readDocumentUpload` checks the bytes, never the browser's type). Private, in the club forms' bucket
 * under the club's own prefix (the club purge finds it). POST adds or replaces it, DELETE removes it, GET opens it for the
 * club through a link signed for one hour. The business opens it from its link in Part 2.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ packageId: string }> };
const notFound = () => NextResponse.json({ error: W.say.notFound, code: 'not_found' }, { status: 404 });

type Found = { orgId: string; pkg: NonNullable<Awaited<ReturnType<typeof readPackage>>> };
async function packageOf(req: Request, params: Params['params']): Promise<Found | { failure: Response }> {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return { failure: gate.failure };
  const { packageId } = await params;
  if (!isUuid(packageId)) return { failure: notFound() };
  const pkg = await readPackage(gate.ctx.org.id, packageId);
  if (!pkg) return { failure: notFound() };
  return { orgId: gate.ctx.org.id, pkg };
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await packageOf(req, params);
  if ('failure' in r) return r.failure;
  if (!r.pkg.documentPath) return notFound();
  const { data, error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(r.pkg.documentPath, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'The file didn’t open. Try again.' }, { status: 500 });
  return new NextResponse(null, {
    status: 302,
    headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  });
}, { route: '/api/admin/sponsorships/packages/[packageId]/document' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await packageOf(req, params);
  if ('failure' in r) return r.failure;
  const upload = await readDocumentUpload(req);
  if ('error' in upload) return refused(W.pkg.errPdf, upload.status);
  if (!upload.pdf) return refused(W.pkg.errPdf);
  const path = `${r.orgId}/sponsorship-packages/${r.pkg.id}/${randomUUID()}.pdf`;
  const { error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, upload.pdf.bytes, { contentType: 'application/pdf', upsert: false });
  if (error) return refused(W.say.failed, 500);
  await setPackageDocument(r.orgId, r.pkg.id, { path, name: upload.pdf.displayName, size: upload.pdf.size });
  if (r.pkg.documentPath) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([r.pkg.documentPath]).catch(() => undefined);
  return NextResponse.json({ document: { name: upload.pdf.displayName, size: upload.pdf.size } });
}, { route: '/api/admin/sponsorships/packages/[packageId]/document' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await packageOf(req, params);
  if ('failure' in r) return r.failure;
  await setPackageDocument(r.orgId, r.pkg.id, null);
  if (r.pkg.documentPath) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([r.pkg.documentPath]).catch(() => undefined);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/packages/[packageId]/document' });
