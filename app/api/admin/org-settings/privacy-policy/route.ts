import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';
import { getOrgPrivacyPolicyHref, parsePrivacyPolicyInput, privacyLinkChange } from '@/lib/privacy-policy';
import { PRIVACY_LINK_AUDIT_ACTION } from '@/lib/member-audit';

/**
 * ORGANIZATION › SETTINGS › YOUR PRIVACY POLICY — the club's own privacy-policy link (Board Ready 4.P, owner 2026-11-21).
 *
 *   - The OWNER or an ADMIN reads and changes it (owner ruling 2026-11-21: "Owner and admin"). Every other seat is refused
 *     here, not only hidden on the screen.
 *   - GET answers what families are shown: the value through the seam (`getOrgPrivacyPolicyHref`), so an unsafe value left
 *     over from the old operator-only path reads as empty, never as a link.
 *   - PATCH `{ url: string | null }`: trimmed; empty or null clears; otherwise http(s) and at most 2,000 characters, by the
 *     seam's own rule (`parsePrivacyPolicyInput`), or 400 with the one sentence the field shows.
 *   - A change families can see is one line in the club's audit log, `{ change: 'added' | 'changed' | 'removed' }` and
 *     nothing else — the address itself stays out of the log, as the log keeps other values out. A save of the same value
 *     writes nothing; clearing a value that never showed as a link writes but logs nothing. The write is conditional on
 *     the value read (two tabs: the later save answers what the earlier one stored).
 */

async function readStored(orgId: string): Promise<{ ok: true; raw: string | null } | { ok: false }> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('privacy_policy_url')
    .eq('id', orgId)
    .maybeSingle<{ privacy_policy_url: string | null }>();
  if (error || !data) return { ok: false };
  return { ok: true, raw: data.privacy_policy_url };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>;

/** The one seat check both methods run first: the owner or an admin of the visited club, or the refusal to send. */
async function seat(req: Request): Promise<{ ctx: Ctx; refused: null } | { ctx: null; refused: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ctx: null, refused: unauthorized() };
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return { ctx: null, refused: forbidden() };
  return { ctx, refused: null };
}

export const GET = withObservability(async (req: Request) => {
  const s = await seat(req);
  if (s.refused) return s.refused;
  const stored = await readStored(s.ctx.org.id);
  if (!stored.ok) return NextResponse.json({ error: 'We couldn’t read the setting.' }, { status: 500 });
  return NextResponse.json({ url: getOrgPrivacyPolicyHref({ privacyPolicyUrl: stored.raw }) });
}, { route: '/api/admin/org-settings/privacy-policy' });

export const PATCH = withObservability(async (req: Request) => {
  const s = await seat(req);
  if (s.refused) return s.refused;
  const { ctx } = s;

  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  if (!body || typeof body !== 'object' || !('url' in body)) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  const parsed = parsePrivacyPolicyInput(body.url);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const next = parsed.value;

  const stored = await readStored(ctx.org.id);
  if (!stored.ok) return NextResponse.json({ error: 'We couldn’t read the setting.' }, { status: 500 });
  // Already as asked (a double press, or two tabs): nothing is written or logged.
  if ((stored.raw ?? null) === next) return NextResponse.json({ url: next });

  // Only from the value this request read, so a change saved meanwhile in another tab is never overwritten blind (and the
  // audit line's "before" is the true one).
  let write = supabaseAdmin.from('organizations').update({ privacy_policy_url: next }).eq('id', ctx.org.id);
  write = stored.raw === null ? write.is('privacy_policy_url', null) : write.eq('privacy_policy_url', stored.raw);
  const { data: written, error } = await write.select('id');
  if (error) return captureAndJson(error, { error: 'We couldn’t save that. Try again.' }, 500);
  if (!written?.length) {
    // Someone else saved first: answer what is stored now, and log nothing of ours.
    const now = await readStored(ctx.org.id);
    if (!now.ok) return NextResponse.json({ error: 'We couldn’t read the setting.' }, { status: 500 });
    return NextResponse.json({ url: getOrgPrivacyPolicyHref({ privacyPolicyUrl: now.raw }) });
  }

  // Nothing to log when families see no difference (clearing a value that never showed as a link).
  const change = privacyLinkChange(stored.raw, next);
  if (change) await writeOrgAudit(ctx.org.id, ctx.user.id, null, PRIVACY_LINK_AUDIT_ACTION, { change });

  return NextResponse.json({ url: next });
}, { route: '/api/admin/org-settings/privacy-policy' });
