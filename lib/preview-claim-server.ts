import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability';
import { writePlatformAuditLog } from './platform-audit';
import { planLabel } from './platform-labels';
import { forgetPreviewOrgId } from './preview-org-server';
import { utcToZonedInputs } from './timezone';
import { isClaimCodeShape, normaliseClaimCode, type ClaimDoorState } from './preview-claim';
import { previewDayLabel } from './preview-ended';
import { readEndedPreview } from './preview-ended-server';
import { previewLinkRefusedForAddress, readSentLink, type SentLink } from './preview-link-email-server';
import { claimPassMatches, claimVisitorKey, claimVisitorKeyFromIp, signClaimPass } from './preview-claim-pass';

export { claimVisitorKey, claimVisitorKeyFromIp };

/**
 * lib/preview-claim-server.ts — the room window's reads and writes, and the claim (Club Website Track P, Session P3).
 * Every write is ONE database step (mig 540); this file shapes what goes in and what comes back. The owner-only door is
 * the platform-admin routes'; the claim's door (signed in, Terms, one club, on sale) is `app/api/start/claim/route.ts`.
 */

// The pass and the visitor key live in lib/preview-claim-pass.ts (pure, so a test signs and checks them).

// ── The code page (tab 6.1, 6.7) ──────────────────────────────────────────────────────────────────────────────────────
export type ClaimClub = {
  orgId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primary: string | null;
  accent: string | null;
};

export type ClaimDoor =
  | { state: Exclude<ClaimDoorState, 'missing'>; club: ClaimClub; removedOn: string | null }
  | { state: 'missing' };

type DoorAnswer = { state: string; org_id?: string; name?: string; removed_at?: string | null; code?: string };

async function door(slug: string, code: string | null, visitor: string): Promise<DoorAnswer> {
  const { data, error } = await supabaseAdmin.rpc('preview_claim_door', { p_slug: slug, p_code: code, p_visitor: visitor });
  if (error) throw new Error(`[preview-claim] the door could not be read: ${error.message}`);
  return (data ?? { state: 'missing' }) as DoorAnswer;
}

async function clubOf(orgId: string, fallback: { name: string; slug: string }): Promise<ClaimClub> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url, theme_primary, theme_accent')
    .eq('id', orgId)
    .maybeSingle();
  const o = data as { name: string; slug: string; logo_url: string | null; theme_primary: string | null; theme_accent: string | null } | null;
  return {
    orgId,
    name: o?.name ?? fallback.name,
    slug: o?.slug ?? fallback.slug,
    logoUrl: o?.logo_url ?? null,
    primary: o?.theme_primary ?? null,
    accent: o?.theme_accent ?? null,
  };
}

/** Which frame the code page shows. Throws when it cannot read (the page says the door can't be opened). */
export async function readClaimDoor(slug: string, visitor: string): Promise<ClaimDoor> {
  const a = await door(slug, null, visitor);
  if (a.state === 'missing' || !a.org_id) return { state: 'missing' };
  // Session P4 (T12): a removal says "ended" for 90 days, then the address is an ordinary not-found; and never once a
  // club holds the address again (the ended page's own rule, /review 2026-11-26).
  if (a.state === 'removed' && !(await readEndedPreview(slug))) return { state: 'missing' };
  const club = await clubOf(a.org_id, { name: a.name ?? slug, slug });
  return { state: a.state as Exclude<ClaimDoorState, 'missing'>, club, removedOn: previewDayLabel(a.removed_at) };
}

export type CodeCheck =
  | { ok: true; orgId: string; pass: string }
  | { ok: false; state: 'wrong' | 'resting' | 'claimed' | 'removed' | 'missing' | 'shape'; removedOn?: string | null };

/** The code page's Continue. A wrong code is counted in the database; five in an hour rest the door (T7). */
export async function checkClaimCode(slug: string, typed: string, visitor: string): Promise<CodeCheck> {
  const code = normaliseClaimCode(typed);
  if (!isClaimCodeShape(code)) return { ok: false, state: 'shape' };
  const a = await door(slug, code, visitor);
  if (a.state === 'ok' && a.org_id && a.code) {
    const pass = signClaimPass(a.org_id, a.code);
    if (!pass) throw new Error('[preview-claim] no pass secret (PAY_LINK_SECRET)');
    return { ok: true, orgId: a.org_id, pass };
  }
  if (a.state === 'removed') {
    return (await readEndedPreview(slug)) ? { ok: false, state: 'removed', removedOn: previewDayLabel(a.removed_at) } : { ok: false, state: 'missing' };
  }
  if (a.state === 'wrong' || a.state === 'resting' || a.state === 'claimed' || a.state === 'missing') return { ok: false, state: a.state };
  return { ok: false, state: 'missing' };
}

/** The club a pass is good for, with its current code; null when the pass is not (or no longer) good. */
export async function openClaimPass(slug: string, pass: string | null | undefined): Promise<{ club: ClaimClub; code: string } | null> {
  if (!pass) return null;
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .select('org_id, org_slug, org_name, claim_code, claimed_at, removed_at')
    .eq('org_slug', slug.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[preview-claim] the pass could not be read: ${error.message}`);
  const r = data as { org_id: string; org_slug: string; org_name: string; claim_code: string | null; claimed_at: string | null; removed_at: string | null } | null;
  if (!r || r.claimed_at || r.removed_at || !r.claim_code) return null;
  if (!claimPassMatches(pass, r.org_id, r.claim_code)) return null;
  return { club: await clubOf(r.org_id, { name: r.org_name, slug: r.org_slug }), code: r.claim_code };
}

// ── The claim (tab 6.3; T8, T14) ──────────────────────────────────────────────────────────────────────────────────────
export type ClaimResult =
  | { ok: true; slug: string }
  | { ok: false; kind: 'not_open' | 'code' | 'one_club' | 'failed' };

/** THE CLAIM: hands over the owner seat, clears the marker and the whole sample, records the tick, in one step. */
export async function claimPreviewClub(p: {
  orgId: string; code: string; user: { id: string; email: string }; boxText: string; startPlan: 'club' | 'club_large';
}): Promise<ClaimResult> {
  const { data, error } = await supabaseAdmin.rpc('claim_preview_club', {
    p_org_id: p.orgId, p_code: p.code, p_user_id: p.user.id, p_user_email: p.user.email,
    p_box_text: p.boxText, p_start_plan: p.startPlan,
  });
  if (error) {
    if (error.code === 'PV020') return { ok: false, kind: 'not_open' };
    if (error.code === 'PV021') return { ok: false, kind: 'code' };
    if (error.code === 'PV027') return { ok: false, kind: 'one_club' };
    // "Didn't finish": error alerts stay on for a preview (tab 6.7), so we hear before they write.
    await captureError(new Error(`[preview-claim] the claim did not finish (${error.code || 'no code'}): ${error.message}`), {
      severity: 'error', org: { id: p.orgId }, user: { id: p.user.id },
    });
    return { ok: false, kind: 'failed' };
  }
  await writePlatformAuditLog(p.user.email, p.orgId, 'preview_club_claimed', 'organization_previews', null,
    { startPlan: p.startPlan }, { reason: 'The club claimed its preview (Track P)' }).catch(() => undefined);
  return { ok: true, slug: String(data) };
}

// ── The room window (tab 4) ───────────────────────────────────────────────────────────────────────────────────────────
export type RoomGame = {
  tournament: string;
  division: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string;
  time: string;
  durationMinutes: number;
};

export type RoomView = {
  orgId: string;
  name: string;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  primary: string | null;
  accent: string | null;
  meetingAt: string;
  /** The meeting as the change window holds it: `YYYY-MM-DDTHH:MM`, Eastern. */
  meetingInput: string;
  code: string | null;
  resting: boolean;
  game: RoomGame | null;
  /** T13: false until FieldLogicHQ has a mailing address; the window refuses Send and says why. */
  canEmail: boolean;
  /** Session P4: the one email, once it has gone (the address masked, the day); the window shows it in place of the form. */
  emailSent: SentLink | null;
};

/** Everything the room window shows for one OPEN preview; null when it is claimed, removed or gone. */
export async function readRoom(orgId: string): Promise<RoomView | null> {
  const [{ data: rec, error: recErr }, { data: org }, { data: site }] = await Promise.all([
    supabaseAdmin.from('organization_previews')
      .select('org_id, org_slug, org_name, meeting_at, claim_code, claimed_at, removed_at').eq('org_id', orgId).maybeSingle(),
    supabaseAdmin.from('organizations')
      .select('id, name, slug, logo_url, theme_primary, theme_accent, is_preview').eq('id', orgId).maybeSingle(),
    supabaseAdmin.from('org_public_site_content').select('tagline').eq('org_id', orgId).maybeSingle(),
  ]);
  if (recErr) throw new Error(`[preview-claim] the room could not be read: ${recErr.message}`);
  const r = rec as { org_id: string; org_slug: string; org_name: string; meeting_at: string; claim_code: string | null; claimed_at: string | null; removed_at: string | null } | null;
  const o = org as { name: string; slug: string; logo_url: string | null; theme_primary: string | null; theme_accent: string | null; is_preview: boolean } | null;
  if (!r || r.claimed_at || r.removed_at || !o?.is_preview) return null;

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [{ count }, game, emailSent] = await Promise.all([
    supabaseAdmin.from('preview_claim_tries').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).gt('tried_at', hourAgo),
    readLiveGame(orgId),
    readSentLink(orgId),
  ]);

  const zoned = utcToZonedInputs(r.meeting_at);
  return {
    orgId,
    name: o.name,
    slug: o.slug,
    tagline: (site as { tagline: string | null } | null)?.tagline ?? null,
    logoUrl: o.logo_url,
    primary: o.theme_primary,
    accent: o.theme_accent,
    meetingAt: r.meeting_at,
    meetingInput: `${zoned.date}T${zoned.time}`,
    code: r.claim_code,
    resting: (count ?? 0) >= 5,
    game,
    canEmail: !previewLinkRefusedForAddress(),
    emailSent,
  };
}

/** The live game: the preview tournament's first game (the one at the meeting time, mig 540 save_preview_score). */
export async function readLiveGame(orgId: string): Promise<RoomGame | null> {
  const { data: tourn } = await supabaseAdmin
    .from('tournaments').select('id, name').eq('org_id', orgId).order('created_at', { ascending: true }).limit(1).maybeSingle();
  const t = tourn as { id: string; name: string } | null;
  if (!t) return null;
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, game_date, game_time, duration_minutes, status, home_score, away_score, home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name), division:divisions(name)')
    .eq('tournament_id', t.id)
    .order('game_date', { ascending: true })
    .order('game_time', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  const g = game as {
    game_date: string; game_time: string; duration_minutes: number | null; status: string;
    home_score: number | null; away_score: number | null;
    home: { name: string } | { name: string }[] | null; away: { name: string } | { name: string }[] | null;
    division: { name: string } | { name: string }[] | null;
  } | null;
  if (!g) return null;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  return {
    tournament: t.name,
    division: one(g.division)?.name ?? null,
    home: one(g.home)?.name ?? 'Home',
    away: one(g.away)?.name ?? 'Away',
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    date: g.game_date,
    time: String(g.game_time).slice(0, 5),
    durationMinutes: g.duration_minutes ?? 90,
  };
}

export type RoomWriteResult = { ok: true } | { ok: false; kind: string };

function roomError(error: { code?: string; message: string }, what: string, orgId: string): RoomWriteResult {
  const known: Record<string, string> = {
    PV014: 'meeting', PV020: 'not_open', PV022: 'not_undoable', PV023: 'not_claimed',
    PV024: 'no_game', PV025: 'final', PV026: 'not_started',
  };
  const kind = error.code ? known[error.code] : undefined;
  if (kind) return { ok: false, kind };
  void captureError(new Error(`[preview-claim] ${what} failed (${error.code || 'no code'}): ${error.message}`), {
    severity: 'error', org: { id: orgId },
  });
  return { ok: false, kind: 'failed' };
}

async function audit(actor: { id: string; email: string }, action: string, orgId: string, details: Record<string, unknown> = {}) {
  await writePlatformAuditLog(actor.email, orgId, action, 'organization_previews', null, details,
    { reason: 'The room window, Prospect clubs (Track P)' }).catch(() => undefined);
}

export async function saveRoomScore(orgId: string, home: number, away: number, final: boolean, actor: { id: string; email: string }): Promise<RoomWriteResult> {
  const { error } = await supabaseAdmin.rpc('save_preview_score', { p_org_id: orgId, p_home: home, p_away: away, p_final: final });
  if (error) return roomError(error, 'the score', orgId);
  if (final) await audit(actor, 'preview_game_marked_final', orgId, { home, away });
  return { ok: true };
}

export async function moveRoomMeeting(orgId: string, meetingAt: string, actor: { id: string; email: string }): Promise<RoomWriteResult> {
  const { error } = await supabaseAdmin.rpc('move_preview_meeting', { p_org_id: orgId, p_meeting_at: meetingAt });
  if (error) return roomError(error, 'the meeting move', orgId);
  await audit(actor, 'preview_meeting_moved', orgId, { meeting_at: meetingAt });
  return { ok: true };
}

/** New code: the old one stops working (and every pass made from it), and the door's rest is lifted. */
export async function newRoomCode(orgId: string, actor: { id: string; email: string }): Promise<RoomWriteResult> {
  const { data: code, error: codeErr } = await supabaseAdmin.rpc('preview_claim_code');
  if (codeErr || typeof code !== 'string') return roomError(codeErr ?? { message: 'no code' }, 'the new code', orgId);
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .update({ claim_code: code })
    .eq('org_id', orgId).is('claimed_at', null).is('removed_at', null)
    .select('org_id');
  if (error) return roomError(error, 'the new code', orgId);
  if (!data?.length) return { ok: false, kind: 'not_open' };
  await supabaseAdmin.from('preview_claim_tries').delete().eq('org_id', orgId);
  await audit(actor, 'preview_claim_code_replaced', orgId);
  return { ok: true };
}

/** "Let them try again" (/legal finding 5): a person who mistyped in the room is not held for an hour. */
export async function letRoomTryAgain(orgId: string, actor: { id: string; email: string }): Promise<RoomWriteResult> {
  const { error } = await supabaseAdmin.from('preview_claim_tries').delete().eq('org_id', orgId);
  if (error) return roomError(error, 'the door reopening', orgId);
  await audit(actor, 'preview_claim_door_reopened', orgId);
  return { ok: true };
}

// ── After the claim (tab 2; T10, T15) ─────────────────────────────────────────────────────────────────────────────────
export type ClaimedView = {
  orgId: string;
  name: string;
  claimedAt: string;
  claimantEmail: string | null;
  planLabel: string | null;
  subscriptionStatus: string | null;
  /** A Stripe customer exists (checkout was started): the undo is refused from here (/billing 2026-11-25 note 6). */
  reachedCheckout: boolean;
};

/** The claimed rows' facts: who claimed (for the masked line), the plan state. One read for the whole list. */
export async function readClaimedFacts(orgIds: readonly string[]): Promise<Map<string, Omit<ClaimedView, 'name' | 'claimedAt'>>> {
  const out = new Map<string, Omit<ClaimedView, 'name' | 'claimedAt'>>();
  if (orgIds.length === 0) return out;
  const [{ data: orgs }, { data: claims }] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, plan_id, subscription_status, stripe_customer_id').in('id', [...orgIds]),
    supabaseAdmin.from('preview_claim_records').select('org_id, kind, user_email, at').in('org_id', [...orgIds]).order('at', { ascending: false }),
  ]);
  const lastClaim = new Map<string, string | null>();
  for (const c of (claims ?? []) as { org_id: string; kind: string; user_email: string | null }[]) {
    if (!lastClaim.has(c.org_id)) lastClaim.set(c.org_id, c.kind === 'claim' ? c.user_email : null);
  }
  for (const o of (orgs ?? []) as { id: string; plan_id: string | null; subscription_status: string | null; stripe_customer_id: string | null }[]) {
    const paid = o.plan_id && o.plan_id !== 'tournament';
    out.set(o.id, {
      orgId: o.id,
      claimantEmail: lastClaim.get(o.id) ?? null,
      planLabel: paid ? planLabel(o.plan_id!) : null,
      subscriptionStatus: paid ? o.subscription_status : null,
      reachedCheckout: Boolean(o.stripe_customer_id),
    });
  }
  return out;
}

/** Does this account hold a seat in this club (the claimer coming back after a lost answer, /review 2026-11-25)? */
export async function holdsSeatIn(userId: string, orgId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('organization_members')
    .select('id').eq('user_id', userId).eq('organization_id', orgId).eq('status', 'active').maybeSingle();
  return !error && Boolean(data);
}

/** Did this club come from a claimed preview (the setup checklist's one line, tab 6.5)? A failed read answers no. */
export async function isClaimedPreview(orgId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('organization_previews').select('org_id').eq('org_id', orgId).not('claimed_at', 'is', null).maybeSingle();
  return !error && Boolean(data);
}

export async function undoRoomClaim(orgId: string, actor: { id: string; email: string }): Promise<RoomWriteResult> {
  const { error } = await supabaseAdmin.rpc('undo_preview_claim', { p_org_id: orgId, p_actor: actor.id });
  if (error) return roomError(error, 'the undo', orgId);
  forgetPreviewOrgId(orgId);
  await audit(actor, 'preview_claim_undone', orgId);
  return { ok: true };
}
