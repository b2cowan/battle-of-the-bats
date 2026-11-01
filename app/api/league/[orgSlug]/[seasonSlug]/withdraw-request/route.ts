import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { registrationReference } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { houseLeagueDeskUserIds } from '@/lib/notify-recipients';
import { ASK_WORDS } from '@/lib/house-league-money-words';
import { openSignupLink } from '@/lib/league-signup-link';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/withdraw-request — a family asks to withdraw a child (Club Tier 9b-2 Part 6,
 * copy §14). The possession proof is the family's "Your sign-up" link alone (Signed-in family accounts Stage 1: the email
 * and reference stopped opening anything, rulings 2026-10-31), read through the one door (`openSignupLink`), so a link the
 * club replaced or a finished season's closed link asks nothing. The child is named by its own registration code among
 * the children that link's sign-up shows. Asking changes nothing on its own — the child keeps their place; the
 * house-league desk sees the ask in Needs attention, and it clears itself when the registration ends (lib/needs-attention.ts `withdrawRequest`).
 * Throttled like every public family form. A refusal never says whether an email is registered.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { child?: unknown; note?: unknown; token?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: ASK_WORDS.errGeneric }, { status: 400 }); }

  const code = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8) : '');
  const child = code(body.child);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (child.length !== 8 || !token) return NextResponse.json({ error: ASK_WORDS.errGeneric }, { status: 400 });

  type Row = { id: string; status: string; player_first_name: string; player_last_name: string; guardian_first_name: string; guardian_last_name: string; signup_ref: string | null; withdraw_requested_at: string | null };
  const COLUMNS = 'id, status, player_first_name, player_last_name, guardian_first_name, guardian_last_name, signup_ref, withdraw_requested_at';
  // Possession: only a child of the sign-up the link opens, and only the child named.
  const link = await openSignupLink(token, { at: { orgId: org.id, seasonId: season.id } });
  let reg: Row | undefined;
  if (link.ok) {
    const { data, error } = await supabaseAdmin.from('league_registrations').select(COLUMNS).in('id', link.rows.map(r => r.id));
    if (error) throw error;
    reg = ((data ?? []) as Row[]).find(r => registrationReference(String(r.id)) === child);
  }
  if (!reg) return NextResponse.json({ error: ASK_WORDS.errGeneric }, { status: 404 });
  // A finished season takes no asks: there is nothing left to withdraw from (the status page offers no door then).
  if (season.status === 'completed' || season.status === 'archived') {
    return NextResponse.json({ error: ASK_WORDS.errFinished, code: 'finished' }, { status: 409 });
  }
  if (reg.status === 'declined' || reg.status === 'withdrawn') {
    return NextResponse.json({ error: ASK_WORDS.errEnded(reg.player_first_name, reg.status), code: 'ended' }, { status: 409 });
  }
  if (reg.withdraw_requested_at) {
    return NextResponse.json({ error: ASK_WORDS.errTwice(reg.player_first_name), code: 'twice' }, { status: 409 });
  }

  // One open ask per registration: the write itself refuses a second (a double press, two tabs).
  const at = new Date().toISOString();
  const { data: wrote, error: writeError } = await supabaseAdmin.from('league_registrations')
    .update({ withdraw_requested_at: at, withdraw_request_note: note, updated_at: at })
    .eq('id', reg.id).is('withdraw_requested_at', null).not('status', 'in', '(declined,withdrawn)')
    .select('id');
  if (writeError) throw writeError;
  if (!wrote?.length) return NextResponse.json({ error: ASK_WORDS.errTwice(reg.player_first_name), code: 'twice' }, { status: 409 });

  // The desk's notice (Needs attention). A failed notice never fails the family's ask: the registration carries it.
  try {
    const userIds = await houseLeagueDeskUserIds(org);
    if (userIds.length) {
      await notify({
        orgId: org.id,
        eventType: 'house_league_withdraw_request',
        title: ASK_WORDS.noticeTitle(`${reg.player_first_name} ${reg.player_last_name}`),
        body: ASK_WORDS.noticeBody(`${reg.guardian_first_name} ${reg.guardian_last_name}`.trim(), season.name, note),
        link: `/${org.slug}/admin/house-league/seasons/${season.id}/registrations`,
        metadata: { registrationId: reg.id, seasonId: season.id },
        userIds,
      });
    }
  } catch (e) {
    console.error('[league-withdraw-request] desk notice failed:', e);
  }

  return NextResponse.json({ ok: true, requestedAt: at });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/withdraw-request' });
