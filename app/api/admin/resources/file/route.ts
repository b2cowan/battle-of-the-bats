import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';
import {
  RESOURCE_ALLOWED_MIME,
  RESOURCE_BUCKET as BUCKET,
  RESOURCE_MAX_BYTES,
  isClubKey,
  keySpellings,
  mayRemoveKey,
  resourceKeyFromUrl,
  resourceObjectPath,
} from '@/lib/resource-file-storage';

/**
 * THE RULES SCREEN'S FILES (Board Ready W2 fix B, sweep 3 finding 2). The `resources` bucket used to let ANY signed-in account
 * upload and delete from the browser; it now takes no browser writes at all. Upload and delete come here: the caller must be a
 * member of THIS club with `post_rules`, in scope for the event, and the event must be the club's. The row writes (the link's
 * name and address) stay on the Rules screen's own path; this route stores and removes the FILE.
 *
 *   POST   ?orgSlug&tournamentId  (multipart `file`)  → { url }   filed under {orgId}/{tournamentId}/{uuid}-{name}
 *   DELETE ?orgSlug               ({ resourceId })    → { ok }    takes the ROW id, never a path: the row says which file
 */
export const POST = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithScope({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'post_rules')) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  // The event must be this club's BEFORE the write: the id becomes part of the stored path.
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  // Refused before the body is read when it is plainly too large (the file's own size is checked again below).
  if (Number(req.headers.get('content-length')) > RESOURCE_MAX_BYTES + 256 * 1024) {
    return NextResponse.json({ error: 'File must be 9 MB or smaller' }, { status: 400 });
  }
  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!RESOURCE_ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, image, Word and Excel files are allowed' }, { status: 400 });
  }
  if (file.size > RESOURCE_MAX_BYTES) return NextResponse.json({ error: 'File must be 9 MB or smaller' }, { status: 400 });

  const path = resourceObjectPath(ctx.org.id, tournamentId, randomUUID(), file.name);
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) {
    console.error('resources/file upload failed', uploadError);
    return NextResponse.json({ error: 'Couldn’t upload the file' }, { status: 500 });
  }
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}, { route: '/api/admin/resources/file' });

export const DELETE = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithScope({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'post_rules')) return forbidden();

  const body = (await req.json().catch(() => null)) as { resourceId?: unknown } | null;
  const resourceId = typeof body?.resourceId === 'string' ? body.resourceId : '';
  if (!resourceId) return NextResponse.json({ error: 'Missing resourceId' }, { status: 400 });

  const { data: row, error: readError } = await supabaseAdmin.from('resources').select('id, tournament_id, url, created_at').eq('id', resourceId).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Couldn’t read the item' }, { status: 500 });
  // Already gone (deleted in another tab): the caller treats this as done. Row ids are random UUIDs, so this does not help anyone
  // guess another club's.
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = scopeGuard(ctx, row.tournament_id as string);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, row.tournament_id as string);
  if (wrongOrg) return wrongOrg;

  // The row goes first (it is what the public page lists); the stored file follows, and only when nothing else names it.
  const { error: rowError } = await supabaseAdmin.from('resources').delete().eq('id', row.id);
  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });

  const key = resourceKeyFromUrl(String(row.url ?? ''), process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  let fileKept = false;
  if (key && mayRemoveKey(key, ctx.org.id, row.created_at as string | null)) {
    if (await keyStillNamed(key, ctx.org.id)) {
      fileKept = true;
    } else {
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove([key]);
      if (error) console.error('resources/file remove failed', error);
    }
  } else if (key) {
    fileKept = true;
  }
  return NextResponse.json({ ok: true, fileKept });
}, { route: '/api/admin/resources/file' });

/** LIKE-escape so a file name's `_` and `%` match themselves (an over-match would only KEEP a file, never remove one). */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

/**
 * Does any OTHER row still name this stored file? A copied event reuses its source's address, so the file stays while one
 * does. For a key in this club's folder only this club's events count (a stranger's row that merely repeats a public address
 * cannot keep a club's file alive); a flat key belongs to nobody, so any row anywhere counts (a typed link can imitate one).
 * Both spellings of the address are tried, and a lookup that fails answers "yes": an orphan is harmless, a dead link is not.
 */
async function keyStillNamed(key: string, orgId: string): Promise<boolean> {
  let tournamentIds: string[] | null = null;
  if (isClubKey(key, orgId)) {
    const { data, error } = await supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId);
    if (error) return true;
    tournamentIds = (data ?? []).map(t => t.id as string);
  }
  for (const spelling of keySpellings(key)) {
    let query = supabaseAdmin
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .like('url', `%/${BUCKET}/${likeEscape(spelling)}%`);
    if (tournamentIds) query = query.in('tournament_id', tournamentIds);
    const { count, error } = await query;
    if (error || count) return true;
  }
  return false;
}
