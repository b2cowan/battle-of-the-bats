import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import { normalizeGuardianEmail } from './guardian-email';
import { clubEmailFacts, readClubEmailOrg } from './club-email-context';
import { coachInvitationSenderName } from './email-club-identity';
import { insertAtWarmCardEnd, warmEmailDocument } from './email-envelope-warm';
import {
  acceptUrl, connectedLineHtml, EMPTY_FILL, fillInvitationSlots, invitationPanelHtml, repInvitationHtml, secondSenderFootnote,
  whoAddedHtml, type MailChild, type SlotFill,
} from './family-invitation-panel';
import { hasSecondParentStop } from './league-second-parent-footer';
import { buildInviteStopUrl } from './unsubscribe-token';
import { getCoachingAssignmentsForUser } from './db';
import { assertGuardianTier, GUARDIAN_TIER_ENABLED } from './family-guardian';
import { FAMILY_INVITATION_WORDS } from './family-invitation-words';
import {
  authUserOf, FamilyInvitationRefusal, invitationSenderOf, issuePlacementInvitation, issueRepInvitation, planPlacementInvitations,
  type AddressPlan, type InvitationSender,
} from './family-invitation';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE INVITATION IN THE EMAILS (Signed-in family accounts Stage 4a, Part 5; drawing tab 1; /legal draft (c) and its six
 * conditions; owner O1 = A, O3, O4).
 *
 *   placementInviteMailer   what the placement and moved emails carry, per address: the panel (Part 3 said invite), the
 *                           "already in the app" line (already connected), or NOTHING — today's email, byte for byte (none,
 *                           and always while the tier is off: the mailer is null and the builders draw no slots).
 *   sendRepInvitation       a rep coach's Send invitation, emailed (ruling 4), built to the commercial-message standard.
 *   resendRepInvitation     D's "Email me a new invitation" for a rep invitation.
 *   (The placement email's re-send — D, the club's Send again, Part 6's way back — is
 *    resendPlacementInvitation in lib/house-league-placement-mail.ts, where the placement email is built.)
 *
 * ⚠ The panel promotes nothing (/legal condition 6): no plan, price, offer or FieldLogicHQ pitch.
 * ⚠ The invitation link only opens the accept page (/family/claim/{token}); it never signs anyone in or shows a team.
 * ⚠ No address rides in any link: the accept page asks for it; the rep stop link is signed on the invitation.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const W = FAMILY_INVITATION_WORDS;

// ── The placement emails' mailer ─────────────────────────────────────────────────────────────

export interface PlacementInviteMailer {
  /** The first parent's slots for one email (the children it names). */
  firstFill(email: string, children: readonly MailChild[]): Promise<SlotFill>;
  /** A second parent's copy, finished: slots filled, and the sender line added when it carries the panel. `html` is the copy
   *  as lib/league-second-parent-mail.ts made it (greeting swapped, Stop footer in). */
  finishSecondCopy(to: string, html: string, firstParent: string, children: readonly MailChild[]): Promise<string>;
}

/**
 * The mailer for one send of placement or moved emails, or NULL — and then the builders draw no slots and every email is
 * today's — while the tier is off, or when the club's invitation would name a contact or address it does not have (Publish
 * refuses first; a late placement after the club cleared them sends today's email rather than words that are not true).
 * One invitation per address per send, however many of the send's emails name it (a later issue would replace it).
 */
export async function placementInviteMailer(orgId: string, registrationIds: readonly string[]): Promise<PlacementInviteMailer | null> {
  if (!GUARDIAN_TIER_ENABLED) return null;
  const sender = await invitationSenderOf(orgId);
  if (!sender.ready) return null;
  const plans = await planPlacementInvitations(orgId, registrationIds);
  if (plans.size === 0) return null;
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = (email: string) => {
    if (!tokens.has(email)) {
      // A failed issue sends that address today's email: an invitation is never the reason a placement email did not go.
      tokens.set(email, issuePlacementInvitation({ orgId, email, sentByUserId: null }).then(r => r?.token ?? null).catch(err => {
        console.error('[family-invitation-mail] an invitation was not issued (that email goes without it):', err instanceof Error ? err.message : String(err));
        return null;
      }));
    }
    return tokens.get(email)!;
  };
  return placementMailerFor({ orgId, sender, plans, tokenFor });
}

/** The mailer over decided plans and a token source (the re-send passes its one fresh token). */
export function placementMailerFor(p: {
  orgId: string; sender: InvitationSender; plans: ReadonlyMap<string, AddressPlan>;
  tokenFor: (email: string) => Promise<string | null>;
}): PlacementInviteMailer {
  /** This address's decision for THESE children: the panel names those it invites; else the line names those connected. */
  const decide = (email: string, children: readonly MailChild[]) => {
    const plan = p.plans.get(email);
    const of = (d: string) => children.filter(c => plan?.children.some(pc => pc.registrationId === c.registrationId && pc.decision === d));
    const invite = of('invite');
    if (invite.length) return { kind: 'invite' as const, named: invite };
    const connected = of('already_connected');
    return connected.length ? { kind: 'connected' as const, named: connected } : null;
  };
  return {
    async firstFill(raw, children) {
      const email = normalizeGuardianEmail(raw);
      const d = email ? decide(email, children) : null;
      if (!email || !d) return EMPTY_FILL;
      if (d.kind === 'connected') return { who: '', panel: connectedLineHtml(d.named) };
      const token = await p.tokenFor(email);
      return token ? { who: '', panel: invitationPanelHtml({ who: 'first', children: d.named, email, url: acceptUrl(token), sender: p.sender }) } : EMPTY_FILL;
    },
    async finishSecondCopy(raw, html, firstParent, children) {
      const email = normalizeGuardianEmail(raw);
      const d = email ? decide(email, children) : null;
      if (!email || !d) return fillInvitationSlots(html, EMPTY_FILL);
      if (d.kind === 'connected') return fillInvitationSlots(html, { who: '', panel: connectedLineHtml(d.named) });
      // The panel's fine print sends the reader to the Stop footer: no footer (no signing secret here), no panel.
      const token = hasSecondParentStop(p.orgId, email) ? await p.tokenFor(email) : null;
      if (!token) return fillInvitationSlots(html, EMPTY_FILL);
      const filled = fillInvitationSlots(html, {
        who: whoAddedHtml(firstParent, d.named),
        panel: invitationPanelHtml({ who: 'second', children: d.named, email, url: acceptUrl(token), sender: p.sender }),
      });
      return insertAtWarmCardEnd(filled, secondSenderFootnote(p.sender));
    },
  };
}

// ── The rep coach's invitation (ruling 4; drawing 1f) ────────────────────────────────────────

export interface RepCoach { id: string; email: string | null; name: string | null }

/**
 * The coach's Send invitation, emailed. Refused in words (FamilyInvitationRefusal) for everything issueRepInvitation refuses,
 * and — O1 = A + O3, tier on only, which is always here — for a club team whose club has no contact email or mailing address (a
 * coach team with no club uses the coach's own email, O4). An invitation that did not send is cancelled again, so the coach's
 * card never shows an invited row nobody received.
 */
export async function sendRepInvitation(params: {
  orgId: string; repTeamId: string; playerId: string; email: string; coach: RepCoach;
}): Promise<{ invitationId: string }> {
  assertGuardianTier();
  const sender = await invitationSenderOf(params.orgId, params.coach.email);
  if (!sender.ready) throw new FamilyInvitationRefusal('no_contact', W.rep.noClubContact);
  const issued = await issueRepInvitation({
    orgId: params.orgId, repTeamId: params.repTeamId, playerId: params.playerId, email: params.email, sentByUserId: params.coach.id,
  });
  try {
    await emailRepInvitation({ orgId: params.orgId, playerId: params.playerId, token: issued.token, invitationId: issued.invitationId, coach: params.coach, sender });
  } catch (e) {
    console.error('[family-invitation-mail] a rep invitation did not send (cancelled):', e instanceof Error ? e.message : String(e));
    // supabase-js answers a failed write in `error` (it does not throw); a network failure throws. Either is logged, and the
    // coach is still told it didn't send.
    const { error: cancelError } = await supabaseAdmin
      .from('family_invitations').update({ cancelled_at: new Date().toISOString() }).eq('id', issued.invitationId).is('used_at', null)
      .then(r => r, (err: unknown) => ({ error: { message: err instanceof Error ? err.message : String(err) } }));
    if (cancelError) console.error('[family-invitation-mail] an unsent rep invitation could not be cancelled:', cancelError.message);
    throw new FamilyInvitationRefusal('send_failed', W.rep.sendFailed);
  }
  return { invitationId: issued.invitationId };
}

async function emailRepInvitation(p: {
  orgId: string; playerId: string; token: string; invitationId: string; coach: RepCoach; sender: InvitationSender;
}): Promise<void> {
  const stopUrl = buildInviteStopUrl(p.invitationId);
  // The commercial-message standard needs a working way to refuse: no signing secret here, no invitation.
  if (!stopUrl) throw new Error('no invitation-stop link can be signed (UNSUBSCRIBE_SECRET)');
  const [{ data: inv, error: invError }, { data: entry, error: entryError }, club] = await Promise.all([
    supabaseAdmin.from('family_invitations').select('email').eq('id', p.invitationId).single(),
    supabaseAdmin.from('rep_roster_players').select('player_first_name, rep_teams(name)').eq('id', p.playerId).single(),
    p.sender.teamWorkspace ? null : readClubEmailOrg(p.orgId).then(clubEmailFacts),
  ]);
  if (invError) throw invError;
  if (entryError) throw entryError;
  const e = entry as unknown as { player_first_name: string; rep_teams: { name: string } | { name: string }[] | null };
  const to = (inv as { email: string }).email;
  const teamName = (Array.isArray(e.rep_teams) ? e.rep_teams[0] : e.rep_teams)?.name;
  if (!teamName) throw new Error('the invited player has no team');
  const coach = p.coach.name ?? 'The coach';
  const html = warmEmailDocument(
    repInvitationHtml({ coach, team: teamName, child: e.player_first_name, email: to, url: acceptUrl(p.token), stopUrl, sender: p.sender }),
    club,
  );
  const result = await sendEmail(to, W.repMail.subject(e.player_first_name, teamName), html, {
    kind: 'family_invitation',
    fromName: coachInvitationSenderName(p.coach.name, p.sender.teamWorkspace ? null : p.sender.clubName),
    replyTo: p.sender.contact,
  });
  if (result.status !== 'sent' && result.status !== 'skipped') throw new Error(`the send answered ${result.status}`);
}

/**
 * D's "Email me a new invitation" for a rep invitation: a fresh one to the SAME address for the same player, from the coach who
 * sent the first. Every refusal is swallowed: the page answers the same whether or not one was sent (ask 9).
 */
export async function resendRepInvitation(p: { orgId: string; email: string; repPlayerId: string | null; sentByUserId: string | null }): Promise<void> {
  try {
    // The coach who first sent it (the re-send names them).
    const coach = await authUserOf(p.sentByUserId);
    if (!coach || !p.repPlayerId) return;
    const { data, error } = await supabaseAdmin.from('rep_roster_players').select('team_id').eq('id', p.repPlayerId).maybeSingle();
    if (error || !data) return;
    const repTeamId = (data as { team_id: string }).team_id;
    // The coach is named on the email, so they must still coach this team with family-contact access (the Send invitation
    // button's own permission); a coach since removed sends nothing.
    const seats = await getCoachingAssignmentsForUser(p.orgId, coach.id);
    if (!seats.some(a => a.teamId === repTeamId && a.capabilities.rosterPii)) return;
    await sendRepInvitation({ orgId: p.orgId, repTeamId, playerId: p.repPlayerId, email: p.email, coach });
  } catch (e) {
    if (!(e instanceof FamilyInvitationRefusal)) {
      console.error('[family-invitation-mail] a rep re-send failed:', e instanceof Error ? e.message : String(e));
    }
  }
}
