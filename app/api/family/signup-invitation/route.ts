import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm, throttlePublicFormRecipient } from '@/lib/public-form-throttle';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { openSignupLink } from '@/lib/league-signup-link';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resendPlacementInvitation } from '@/lib/house-league-placement-mail';

/**
 * "Not yet? Email me an invitation" on the EMAILED "Your sign-up" page (Signed-in family accounts Stage 4a, Part 6.6; drawing
 * 4.1). The placement email again, with a fresh invitation, to the FIRST address on that sign-up only (the address the page
 * already shows, partly hidden; ruling 9: never a separate create-an-account email). Nothing is typed here.
 *
 * ⚠ The sign-up link never becomes an account and never signs anyone in: this only sends an email to an address on file.
 * ⚠ ONE ANSWER, whatever happened ({ ok: true }): sent, nothing to send (no child placed, the address left or was removed, 18+,
 *   two guardians), a dead link, or a reached limit, as "Email me my link" since Stage 1. 404 while the guardian tier is off.
 */
export const POST = withObservability(async (req: Request) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const limited = throttlePublicForm(req);
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token || token.length > 400) return NextResponse.json({ ok: true });

  try {
    const link = await openSignupLink(token);
    if (link.ok) {
      const { data, error } = await supabaseAdmin.from('league_registrations')
        .select('org_id, guardian_email').eq('id', link.registrationId).maybeSingle();
      if (error) throw error;
      const row = data as { org_id: string; guardian_email: string | null } | null;
      const email = normalizeGuardianEmail(row?.guardian_email);
      // The per-address bucket is silent: a reached limit sends nothing and answers the same.
      if (row && email && !throttlePublicFormRecipient(email)) {
        await resendPlacementInvitation({ orgId: row.org_id, email, sentByUserId: null });
      }
    }
  } catch (e) {
    console.error('[family/signup-invitation] a re-send failed (the page is answered the same):', e instanceof Error ? e.message : String(e));
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/family/signup-invitation' });
