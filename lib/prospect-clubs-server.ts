import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { ensureOrgLogoBucket, ORG_LOGO_BUCKET } from './org-logo-storage';
import { readImageSize } from './org-logo-measure';
import { isReservedOrgSlug } from './reserved-slugs';
import { openPreviewOrgIds } from './preview-org-server';
import { writePlatformAuditLog } from './platform-audit';
import { captureError } from './observability';
import {
  MAKE_REFUSAL_CODES, MAKE_WORDS, OPEN_PREVIEW_CAP, makeFieldErrors,
  type MakeErrors, type MakeInput, type PreviewRecord,
} from './prospect-clubs';

/**
 * lib/prospect-clubs-server.ts — the reads and the one write behind Prospect clubs (Club Website Track P, Session P2).
 * The owner-only door is the route's (`app/api/platform-admin/prospect-clubs/route.ts`); this file trusts its caller.
 */

/** Every preview ever made (open, claimed, removed), newest first. Throws when it cannot read. */
export async function readPreviewRecords(): Promise<PreviewRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .select('org_id, org_slug, org_name, meeting_at, made_by, claimed_at, removed_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`[prospect-clubs] could not read the previews: ${error.message}`);
  return ((data ?? []) as {
    org_id: string; org_slug: string; org_name: string; meeting_at: string; made_by: string | null;
    claimed_at: string | null; removed_at: string | null;
  }[]).map(r => ({
    orgId: r.org_id, slug: r.org_slug, name: r.org_name, meetingAt: r.meeting_at, madeBy: r.made_by,
    claimedAt: r.claimed_at, removedAt: r.removed_at,
  }));
}

export type MakeResult =
  | { ok: true; orgId: string; slug: string }
  | { ok: false; kind: 'fields'; errors: MakeErrors }
  | { ok: false; kind: 'cap' }
  | { ok: false; kind: 'failed' };

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// The club's NAME is checked by the database step alone (exact, any case; PV011 a club that runs its own, PV015 a preview
// already made): a name check through the API's pattern matching would read `*` as a wildcard (/review 2026-11-25).

/** The club made, read back: a lost answer from a step that did commit must not take its logo away. */
async function clubWasMade(orgId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('organizations').select('id').eq('id', orgId).maybeSingle();
  if (error) throw new Error(`[prospect-clubs] could not read the club back: ${error.message}`);
  return !!data;
}

async function addressTaken(slug: string): Promise<boolean> {
  if (isReservedOrgSlug(slug)) return true; // a route's name or a retired demo club's (lib/reserved-slugs.ts)
  const { data, error } = await supabaseAdmin.from('organizations').select('id').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`[prospect-clubs] could not check the address: ${error.message}`);
  return !!data;
}

/**
 * Make a preview club: every refusal first (the window's, then the ones that need the database), then the logo into the
 * club's folder, then ONE database step (mig 536) that makes the club, its record and the whole sample. All or nothing:
 * a refused or failed step leaves no club, and the logo file is taken back out.
 */
export async function makePreviewClub(input: MakeInput, logo: File, actor: { id: string; email: string }): Promise<MakeResult> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const errors = makeFieldErrors({ ...input, logo: { type: logo.type, size: logo.size } });
  if (Object.keys(errors).length > 0) return { ok: false, kind: 'fields', errors };

  try {
    if ((await openPreviewOrgIds()).length >= OPEN_PREVIEW_CAP) return { ok: false, kind: 'cap' };
    if (await addressTaken(slug)) return { ok: false, kind: 'fields', errors: { slug: MAKE_WORDS.err.slugTaken } };
  } catch (err) {
    await captureError(err, { severity: 'error' });
    return { ok: false, kind: 'failed' };
  }

  // The file's own bytes decide whether it is an image (the type a browser sends is only its word).
  const bytes = new Uint8Array(await logo.arrayBuffer());
  const size = sniffedType(bytes) === logo.type ? await readImageSize(bytes) : null;
  if (!size || !size.width || !size.height) return { ok: false, kind: 'fields', errors: { logo: MAKE_WORDS.err.logoType } };

  const orgId = randomUUID();
  const path = `${orgId}/logo.${EXT[logo.type]}`;
  let uploaded = false;
  try {
    await ensureOrgLogoBucket();
    const { error: upErr } = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).upload(path, bytes, { contentType: logo.type, upsert: false });
    if (upErr) throw new Error(`[prospect-clubs] the logo did not upload: ${upErr.message}`);
    uploaded = true;
    const { data: urlData } = supabaseAdmin.storage.from(ORG_LOGO_BUCKET).getPublicUrl(path);

    const { error } = await supabaseAdmin.rpc('make_preview_club', {
      p_org_id: orgId,
      p_name: name,
      p_slug: slug,
      p_sport: input.sport,
      p_province_code: input.province,
      p_logo_url: `${urlData.publicUrl}?v=${Date.now()}`,
      p_logo_aspect: size.width / size.height,
      p_logo_source_url: input.source.trim(),
      p_theme_primary: input.primary.toLowerCase(),
      p_theme_accent: input.accent.toLowerCase(),
      p_line: input.line.trim() || null,
      p_meeting_at: input.meetingAt,
      p_made_by: actor.id,
    });
    if (error) {
      const refusal = MAKE_REFUSAL_CODES[error.code as keyof typeof MAKE_REFUSAL_CODES];
      if (!refusal) {
        // Not a refusal: the answer may have been lost after the step committed (/review 2026-11-25). Read the club back:
        // made → it is made, logo kept; unknown → keep the logo (a stray file is cheaper than a club with no logo).
        let made: boolean | null;
        try { made = await clubWasMade(orgId); } catch { made = null; }
        if (made !== false) uploaded = false;
        if (made !== true) throw new Error(`[prospect-clubs] the club was not made: ${error.code ?? ''} ${error.message}`);
        await captureError(new Error(`[prospect-clubs] the make answered ${error.code || 'no code'} but the club exists`), { severity: 'warning' });
      } else {
        // A refusal: nothing was made, so the logo comes back out.
        await removeLogo(path);
        uploaded = false;
        if (refusal === 'cap') return { ok: false, kind: 'cap' };
        if (refusal === 'exists') return { ok: false, kind: 'fields', errors: { name: MAKE_WORDS.err.exists(name) } };
        if (refusal === 'hasPreview') return { ok: false, kind: 'fields', errors: { name: MAKE_WORDS.err.hasPreview(name) } };
        if (refusal === 'slug') return { ok: false, kind: 'fields', errors: { slug: MAKE_WORDS.err.slugTaken } };
        if (refusal === 'quebec') return { ok: false, kind: 'fields', errors: { province: MAKE_WORDS.err.quebec } };
        return { ok: false, kind: 'fields', errors: { meeting: MAKE_WORDS.err.meetingWindow } };
      }
    }
  } catch (err) {
    if (uploaded) await removeLogo(path);
    await captureError(err, { severity: 'error' });
    return { ok: false, kind: 'failed' };
  }

  // The record of who made it lives on the preview row (made_by); this is the console's own trail. Best-effort: the club
  // exists, and a missing log row must not report a failure that did not happen.
  await writePlatformAuditLog(actor.email, orgId, 'preview_club_made', 'organization_previews', null, {
    slug, meetingAt: input.meetingAt, logoSource: input.source.trim(),
  }, { reason: 'A preview club for a sales meeting (Prospect clubs, Track P)' }).catch(() => undefined);

  return { ok: true, orgId, slug };
}

/** The image type the bytes themselves say (PNG, JPEG or WebP), so a file named one thing and holding another is refused. */
function sniffedType(b: Uint8Array): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP') return 'image/webp';
  return null;
}

async function removeLogo(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([path]);
  if (error) console.error('[prospect-clubs] a logo file was left behind after a make that did not finish:', path, error.message);
}
