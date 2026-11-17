import 'server-only';
/**
 * CLUB COMMUNICATIONS — THE COLLEAGUE SENDER (Stage 1, Session 1): the club's email to its COACHES and its BOARD.
 *
 * Colleague mail (legal §2a.3): one email per person, five at a time, From "{Club} via FieldLogicHQ", Reply-To the club's
 * public contact or the sender (R2, one mode per send), no unsubscribe, no club band, no family footer, no link of ours, the
 * pinned lines of `club-group-email-words.ts`. The family path is never used and never imported (legal §2a.4, T4).
 *
 * Every decision is the server's: the seat (`seatOf`), the group (`chooseCoaches` / `chooseBoard`, read live), the recount
 * (the PEOPLE, coach ask 11), the just-sent check (the claim, 60 seconds; no daily allowance, coach ask 12), who may finish
 * a stopped send (ask 14 / the board's narrower rule). No response carries an address (T17); a nameless person is "A coach".
 *
 * Plan: docs/projects/active/CLUB_COMMUNICATIONS_PLAN.md · legal: docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md.
 */
import type { User } from '@supabase/supabase-js';
import type { OrgRole } from './types';
import { supabaseAdmin } from './supabase-admin';
import { getAuthContextWithRole, unauthorized, type AuthContextWithRole } from './api-auth';
import { sendEmail } from './email';
import { clubPublicContact } from './club-email-context';
import { canOpenModule } from './member-access';
import { hasModuleEntitlement, isTournamentOnlyWorkspace } from './module-entitlements';
import { inParallel } from './supabase-paging';
import { writeOrgAudit } from './org-audit';
import { getUserPersonName } from './user-display';
import { usableContactEmail } from './email-club-identity';
import {
  GROUP, LINES, MAIL, SAY, renderColleagueEmail, renderInboxCopy, type BoardSeat, type ColleagueBasis, type ColleagueKind, type ReplyMode,
} from './club-group-email-words';
import {
  canFinish, chooseBoard, chooseCoaches, cleanName, coachBasis, coachLine, displayName, groupKey, groupOffered, isSender, namesPending,
  parseColleagueGroup, pickable, recount, replyTarget, seatOf, unionCoaches, type BoardMember, type CoachGroup, type ColleagueGroup, type CoachPerson,
  type Seat, type Seen,
} from './club-group-email-rules';
import { loadCoachRows, type CoachRows } from './club-group-email-people';
import { loadBoardMembers } from './club-group-email-board';
import { lastColleagueSend, loadReadableSend, STOPPED_AFTER_MS, type ReadableSend } from './club-group-email-read';

export type Out = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; body: { error: string; code: string } & Record<string, unknown> };
const refuse = (status: number, code: string, error: string, extra: Record<string, unknown> = {}): Out =>
  ({ ok: false, status, body: { error, code, ...extra } });
const okay = (body: Record<string, unknown>): Out => ({ ok: true, body });

// ── The gate ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seat, from the signed-in member as they are NOW (active only: `getAuthContextWithRole` refuses invited and suspended). */
export function seatFor(ctx: AuthContextWithRole): Seat {
  return seatOf({
    role: ctx.role,
    switchOn: canOpenModule(ctx, ctx.org, 'module_communications'),
    teamLimited: !!ctx.repGroupIds,
    tournamentOnly: isTournamentOnlyWorkspace(ctx.org),
    planRep: hasModuleEntitlement(ctx.org, 'module_rep_teams'),
    planLeague: hasModuleEntitlement(ctx.org, 'module_house_league'),
    leagueModule: canOpenModule(ctx, ctx.org, 'module_house_league'),
  });
}

/** Every colleague route's first step: signed in, an active member of this club, a seat with at least one group. */
export async function colleagueGate(req: Request): Promise<{ ctx: AuthContextWithRole; seat: Seat } | { failure: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { failure: unauthorized() };
  const seat = seatFor(ctx);
  if (!seat.any) return { failure: Response.json({ error: SAY.noPlace, code: 'no_place' }, { status: 403 }) };
  return { ctx, seat };
}

// ── The sender, the reply target ─────────────────────────────────────────────────────────────────────────────────────────

/** The sender's name as the club holds it (their member name, else their account's), never an address (R1). */
async function senderNameOf(orgId: string, user: User): Promise<string | null> {
  const { data } = await supabaseAdmin.from('organization_members').select('display_name')
    .eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
  return cleanName(data?.display_name as string | null) ?? cleanName(getUserPersonName(user));
}

/** R2: the reply mode a request asks for; the club when it has a contact and the request names none. */
function replyModeOf(body: Record<string, unknown>, clubContact: string | null): ReplyMode {
  if (body.replyTo === 'club' || body.replyTo === 'sender') return body.replyTo;
  return clubContact ? 'club' : 'sender';
}

/** The address the email promises replies reach, or the refusal (the rule is `replyTarget`, legal addendum finding 5). */
function replyTargetOf(mode: ReplyMode, senderEmail: string | null, clubContact: string | null): { replyTo: string } | Out {
  const t = replyTarget(mode, senderEmail, clubContact);
  return t.ok ? { replyTo: t.replyTo } : refuse(t.status, t.code, t.error);
}

// ── The world a seat writes to ───────────────────────────────────────────────────────────────────────────────────────────

interface CoachWorld { rows: CoachRows; people: CoachPerson[] }
async function coachWorld(ctx: AuthContextWithRole, seat: Seat): Promise<CoachWorld> {
  const c = seat.coaches ?? { rep: false, league: false };
  const rows = await loadCoachRows(ctx.org.id, c);
  return { rows, people: unionCoaches(rows.rep, rows.league) };
}
const liveSeasonsOf = (w: CoachWorld) => w.rows.seasons.map(s => ({ id: s.id, divisionIds: s.divisions.map(d => d.id) }));

/** One person as a response may show them: a key, a name (or the nameless word) and a line. Never an address. */
const shownCoach = (p: CoachPerson) => ({ key: p.key, name: p.name ?? 'A coach', line: coachLine(p) });
const shownMember = (m: BoardMember) => ({ key: `u:${m.userId}`, name: displayName({ name: m.name, boardRole: m.role }, 'board'), line: LINES.seat(m.role) });

// ── Options: what the window offers this seat (GET) ──────────────────────────────────────────────────────────────────────

export async function colleagueOptions(ctx: AuthContextWithRole, seat: Seat, kind: ColleagueKind): Promise<Out> {
  const sender = { userId: ctx.user.id, email: ctx.user.email ?? null };
  const [clubContact, name, lastSent] = await Promise.all([
    clubPublicContact(ctx.org.id), senderNameOf(ctx.org.id, ctx.user), lastColleagueSend(ctx, seat, kind),
  ]);
  const replies = {
    club: clubContact ? { name: ctx.org.name, address: clubContact } : null,
    me: usableContactEmail(ctx.user.email) ? { address: ctx.user.email } : null,
    default: clubContact ? 'club' : 'sender',
  };
  const common = { kind, replies, senderNamed: !!name, lastSent };

  if (kind === 'board') {
    if (!seat.board) return refuse(403, 'not_offered', SAY.notOffered);
    const members = await loadBoardMembers(ctx.org.id);
    const all = chooseBoard(members, { kind: 'board', group: 'board_all' }, seat, sender);
    if (!all.ok) return refuse(all.status, all.code, all.error);
    const pending = members.filter(m => m.status === 'invited' && m.userId !== ctx.user.id);
    return okay({
      ...common, offered: all.people.length > 0, count: all.people.length, noAddress: all.noAddress.length,
      pick: all.people.map(shownMember), pending: pending.length,
      pendingNamed: namesPending(seat) ? pending.map(shownMember) : null,
      copy: false, // never on board email (legal addendum 6a)
    });
  }

  if (!seat.coaches) return refuse(403, 'not_offered', SAY.notOffered);
  const w = await coachWorld(ctx, seat);
  const count = (group: CoachGroup) => { const r = chooseCoaches(w.people, group, seat, sender, liveSeasonsOf(w)); return r.ok ? r.people.length : 0; };
  return okay({
    ...common,
    groups: {
      all: groupOffered(seat, 'coaches_all') ? { count: count({ kind: 'coaches', group: 'coaches_all' }) } : null,
      rep: groupOffered(seat, 'rep_staff') ? {
        count: count({ kind: 'coaches', group: 'rep_staff' }), headCount: count({ kind: 'coaches', group: 'rep_head' }),
      } : null,
      league: groupOffered(seat, 'league_season') ? w.rows.seasons.map(s => ({
        id: s.id, name: s.name, count: count({ kind: 'coaches', group: 'league_season', seasonId: s.id }),
        divisions: s.divisions.map(d => ({ id: d.id, name: d.name, count: count({ kind: 'coaches', group: 'league_division', seasonId: s.id, divisionId: d.id }) })),
      })) : null,
    },
    pick: pickable(w.people, seat).filter(p => !!p.email && !isSender(p, sender)).map(shownCoach),
    // Invited rep coaches are left out and named by team (coach ask 8), to the seats that may see rep names; the head-coach
    // ones alone for "Head coaches only".
    invited: seat.coaches.rep ? w.rows.invited.map(i => i.line) : [],
    invitedHead: seat.coaches.rep ? w.rows.invited.filter(i => i.head).map(i => i.line) : [],
    copy: !!clubContact,
  });
}

// ── The audience: "See who gets it" and the count the Send button carries (POST action 'count') ──────────────────────────

interface Audience {
  group: ColleagueGroup;
  coaches: CoachPerson[] | null;
  members: BoardMember[] | null;
  noAddress: number;
  pending: BoardMember[];
  world: CoachWorld | null;
}

async function audienceOf(ctx: AuthContextWithRole, seat: Seat, body: Record<string, unknown>): Promise<Audience | Out> {
  const parsed = parseColleagueGroup(body);
  if (!parsed.ok) return refuse(parsed.status, parsed.code, parsed.error);
  const group = parsed.value;
  const sender = { userId: ctx.user.id, email: ctx.user.email ?? null };
  if (group.kind === 'board') {
    const members = await loadBoardMembers(ctx.org.id);
    const r = chooseBoard(members, group, seat, sender);
    if (!r.ok) return refuse(r.status, r.code, r.error);
    return { group, coaches: null, members: r.people, noAddress: r.noAddress.length, world: null,
      pending: group.group === 'board_all' ? members.filter(m => m.status === 'invited' && m.userId !== ctx.user.id) : [] };
  }
  const w = await coachWorld(ctx, seat);
  const r = chooseCoaches(w.people, group, seat, sender, liveSeasonsOf(w));
  if (!r.ok) return refuse(r.status, r.code, r.error);
  return { group, coaches: r.people, members: null, noAddress: r.noAddress.length, pending: [], world: w };
}

const isOut = (x: unknown): x is Out => typeof x === 'object' && x !== null && 'ok' in x && (x as Out).ok === false;
const peopleOf = (a: Audience) => a.coaches ? a.coaches.map(shownCoach) : (a.members ?? []).map(shownMember);

/** The rep invitations a group leaves out (coach ask 8): All coaches and Rep coaches every one, Head coaches only the head ones. */
function invitedFor(a: Audience, seat: Seat): string[] {
  if (a.group.kind !== 'coaches' || !seat.coaches?.rep || !a.world) return [];
  if (a.group.group === 'coaches_all' || a.group.group === 'rep_staff') return a.world.rows.invited.map(i => i.line);
  if (a.group.group === 'rep_head') return a.world.rows.invited.filter(i => i.head).map(i => i.line);
  return [];
}

export async function colleagueCount(ctx: AuthContextWithRole, seat: Seat, body: Record<string, unknown>): Promise<Out> {
  const a = await audienceOf(ctx, seat, body);
  if (isOut(a)) return a;
  return okay({
    kind: a.group.kind, count: peopleOf(a).length, people: peopleOf(a), noAddress: a.noAddress, invited: invitedFor(a, seat),
    pending: a.pending.length, pendingNamed: namesPending(seat) ? a.pending.map(shownMember) : null,
  });
}

// ── The words of a send ──────────────────────────────────────────────────────────────────────────────────────────────────

function wordsOf(body: Record<string, unknown>): { subject: string; message: string } | Out {
  const subject = typeof body.subject === 'string' ? body.subject.replace(/\s*[\r\n]+\s*/g, ' ').trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!subject) return refuse(400, 'subject', SAY.needSubject);
  if (!message) return refuse(400, 'message', SAY.needMessage);
  if (subject.length > 200 || message.length > 5000) return refuse(400, 'too_long', SAY.tooLong);
  return { subject, message };
}

const firstName = (name: string | null) => name?.split(/\s+/)[0] ?? null;

interface Rcpt { key: string; aliases: string[]; userId: string | null; leagueCoachId: string | null; name: string | null; line: string | null;
  basis: ColleagueBasis; boardRole: BoardSeat | null; rep: boolean; houseLeague: boolean; email: string }

/** A name and a line as the record may hold them (its CHECKs: no '@', 200 and 300 characters): a team called "A @ B" or a
 *  very long name must not refuse the whole send (/review 2026-11-17). */
const storedName = (n: string | null) => (n ? n.replace(/@/g, ' at ').slice(0, 200).trim() || null : null);
const storedLine = (l: string | null) => (l ? l.replace(/@/g, ' at ').slice(0, 300).trim() || null : null);

function recipientsOf(a: Audience): Rcpt[] {
  if (a.coaches) return a.coaches.map(p => ({
    key: p.key, aliases: p.aliases, userId: p.userId, leagueCoachId: p.userId ? null : p.leagueCoachId, name: storedName(p.name),
    line: storedLine(coachLine(p)), basis: coachBasis(p, a.group.group), boardRole: null, rep: p.rep.length > 0,
    houseLeague: p.league.length > 0, email: p.email!,
  }));
  return (a.members ?? []).map(m => ({
    key: `u:${m.userId}`, aliases: [`u:${m.userId}`], userId: m.userId, leagueCoachId: null, name: storedName(m.name),
    line: LINES.seat(m.role), basis: 'board' as const, boardRole: m.role, rep: false, houseLeague: false, email: m.email!,
  }));
}

function groupLabelOf(a: Audience): string {
  const g = a.group;
  switch (g.group) {
    case 'coaches_all': return GROUP.coachesAll;
    case 'rep_staff': return GROUP.repStaff;
    case 'rep_head': return GROUP.repHeadLabel;
    case 'league_season': case 'league_division': {
      const s = a.world?.rows.seasons.find(x => x.id === g.seasonId);
      const d = g.group === 'league_division' ? s?.divisions.find(x => x.id === g.divisionId)?.name : null;
      return GROUP.leagueLabel(s?.name ?? '', d);
    }
    case 'coaches_picked': return GROUP.pickedLabel(a.coaches?.length ?? 0);
    case 'board_all': return GROUP.boardLabel;
    case 'board_picked': return GROUP.boardPickedLabel(a.members?.length ?? 0);
  }
}

// ── "See the email" (POST action 'preview') ──────────────────────────────────────────────────────────────────────────────

export async function colleaguePreview(ctx: AuthContextWithRole, seat: Seat, body: Record<string, unknown>): Promise<Out> {
  const a = await audienceOf(ctx, seat, body);
  if (isOut(a)) return a;
  const [clubContact, name] = await Promise.all([clubPublicContact(ctx.org.id), senderNameOf(ctx.org.id, ctx.user)]);
  const mode = replyModeOf(body, clubContact);
  const r = recipientsOf(a)[0] ?? null;
  const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : '(subject)';
  const message = typeof body.body === 'string' && body.body.trim() ? body.body.trim() : '(message)';
  const mail = renderColleagueEmail({
    club: ctx.org.name, mode, sender: { name: name ?? '', role: ctx.role }, subject, body: message,
    recipient: r ? { firstName: firstName(r.name), basis: r.basis, boardRole: r.boardRole } : { firstName: null, basis: a.group.kind === 'board' ? 'board' : 'picked', boardRole: a.group.kind === 'board' ? 'admin' : null },
  });
  return okay({ subject: mail.subject, html: mail.html, fromName: mail.fromName });
}

// ── The send (POST action 'send') ────────────────────────────────────────────────────────────────────────────────────────

/** One person's email, sent; a throw is that person's failure, logged with the send's id only (never an address, §2d.6). */
async function deliverOne(sendId: string, to: string, mail: { subject: string; html: string; fromName: string }, kind: 'club_coach_email' | 'club_board_email' | 'club_inbox_copy', replyTo: string): Promise<'sent' | 'failed'> {
  try {
    const r = await sendEmail(to, mail.subject, mail.html, { kind, replyTo, fromName: mail.fromName });
    return r.status === 'sent' || r.status === 'skipped' ? 'sent' : 'failed';
  } catch {
    console.error('[club-group-email] a message was refused by the transport (send', sendId, ')');
    return 'failed';
  }
}

async function markRecipient(id: string, status: 'sent' | 'failed') {
  const { error } = await supabaseAdmin.from('club_group_email_recipients').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('[club-group-email] an outcome was not recorded (the send goes on):', error.message);
}

export async function sendColleagueEmail(ctx: AuthContextWithRole, seat: Seat, body: Record<string, unknown>): Promise<Out> {
  const a = await audienceOf(ctx, seat, body);
  // A group the seat may no longer send to: "You can no longer send this." (coach drawing tab 4). Other refusals say their own.
  if (isOut(a)) return a.body.code === 'not_offered' ? refuse(403, 'not_offered', SAY.lostRight) : a;
  const kind = a.group.kind;

  const [clubContact, senderName] = await Promise.all([clubPublicContact(ctx.org.id), senderNameOf(ctx.org.id, ctx.user)]);
  if (!senderName) return refuse(409, 'need_name', SAY.needName); // R1
  const mode = replyModeOf(body, clubContact);
  const target = replyTargetOf(mode, ctx.user.email ?? null, clubContact);
  if ('ok' in target) return target;
  const words = wordsOf(body);
  if ('ok' in words) return words;
  const wantCopy = body.copyClub === true;
  if (wantCopy && (kind === 'board' || !clubContact)) return refuse(400, 'copy_not_offered', SAY.notOffered);

  const people = recipientsOf(a);
  // The recount compares the PEOPLE the sender was shown with the people now (coach ask 11). Nothing goes on any change. The
  // names it echoes are the caller's own, so they are taken as plain text, short.
  const expected: Seen[] = Array.isArray(body.expected)
    ? (body.expected as unknown[]).filter((e): e is Seen => typeof e === 'object' && e !== null && typeof (e as Seen).key === 'string')
      .map(e => ({ key: e.key, name: typeof e.name === 'string' ? e.name.trim().slice(0, 200) || null : null }))
    : [];
  if (expected.length === 0) return refuse(400, 'expected', SAY.failed);
  const rc = recount(expected, people.map(p => ({ key: p.key, name: p.name, aliases: p.aliases })), kind);
  if (!rc.same) return refuse(409, 'changed', rc.error, { count: rc.count, people: peopleOf(a) });
  if (people.length === 0) return refuse(409, 'nobody', kind === 'board' ? SAY.nobodyBoard : SAY.nobodyCoaches);

  // The claim: the just-sent check, and the send + its words + its people, in ONE transaction (mig 492): a crash or a lost
  // reply can never leave a send that has no one in it.
  const ids = people.map(() => crypto.randomUUID());
  const claim = await supabaseAdmin.rpc('club_group_email_claim', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_kind: kind, p_group_kind: a.group.group, p_group_key: groupKey(a.group),
    p_label: groupLabelOf(a).slice(0, 500), p_params: paramsOf(a.group), p_reaches_rep: people.some(p => !p.houseLeague) && kind === 'coaches',
    p_reaches_house_league: people.some(p => p.houseLeague), p_sender_name: senderName.slice(0, 200), p_sender_role: ctx.role, p_reply_to: mode,
    p_club_copy: wantCopy, p_subject: words.subject, p_body: words.message,
    p_recipients: people.map((p, i) => ({
      id: ids[i], user_id: p.userId, league_coach_id: p.leagueCoachId, name: p.name, line: p.line, basis: p.basis,
      board_role: p.boardRole, rep: p.rep, house_league: p.houseLeague,
    })),
    p_left_out_count: a.noAddress + a.pending.length + invitedFor(a, seat).length,
  });
  if (claim.error) throw claim.error;
  const c = claim.data as { ok: boolean; code?: string; sendId?: string };
  if (!c.ok || !c.sendId) return refuse(409, 'just_sent', SAY.justSent);
  const sendId = c.sendId;
  const sends = () => supabaseAdmin.from('club_group_email_sends');

  const sender = { name: senderName, role: ctx.role };
  const mailKind = kind === 'board' ? 'club_board_email' : 'club_coach_email';
  const outcomes = await inParallel(people, 5, async (p) => {
    const i = people.indexOf(p);
    const mail = renderColleagueEmail({
      club: ctx.org.name, mode, sender, subject: words.subject, body: words.message,
      recipient: { firstName: firstName(p.name), basis: p.basis, boardRole: p.boardRole },
    });
    const s = await deliverOne(sendId, p.email, mail, mailKind, target.replyTo);
    await markRecipient(ids[i], s);
    return s;
  });
  const reached = outcomes.filter(s => s === 'sent').length;
  const failed = outcomes.length - reached;
  if (reached === 0) {
    // Nobody got it, so it was no send: the claim goes (and its people and words with it) and it never reads as Last sent —
    // unless a "send to the ones it missed" has since taken the row (only possible after 15 minutes), which keeps it.
    await sends().delete().eq('id', sendId).eq('org_id', ctx.org.id).eq('status', 'sending').is('retried_at', null);
    return refuse(502, 'not_delivered', SAY.notDelivered);
  }
  const { error: doneErr } = await sends().update({ reached_count: reached, failed_count: failed, status: 'done' }).eq('id', sendId);
  if (doneErr) console.error('[club-group-email] the log could not be completed (the send went):', doneErr.message);

  // The club-inbox copy (R4): coach email only, colleague-built, not a recipient, recorded without the address.
  let copy: string | null = null;
  if (wantCopy && clubContact) {
    const contact = clubContact.trim().toLowerCase();
    copy = people.some(p => p.email.trim().toLowerCase() === contact) ? 'already_listed'
      : await deliverOne(sendId, clubContact, {
        ...renderInboxCopy({ club: ctx.org.name, mode, senderName, groupLabel: groupLabelOf(a), reached, subject: words.subject, body: words.message }),
        fromName: MAIL.from(ctx.org.name),
      }, 'club_inbox_copy', target.replyTo);
    const { error } = await sends().update({ club_copy: copy }).eq('id', sendId);
    if (error) console.error('[club-group-email] the copy\'s outcome was not recorded:', error.message);
  }

  await writeOrgAudit(ctx.org.id, ctx.user.id, null, kind === 'board' ? 'club_board_emailed' : 'club_coaches_emailed',
    { sendId, group: a.group.group, count: people.length, reached, failed, replyTo: mode, copy });
  const missed = people.filter((_, i) => outcomes[i] !== 'sent');
  return okay({
    sendId, kind, count: people.length, reached, failed, copy,
    missedNamed: missed.length > 0 && missed.length <= 3 ? missed.map(p => p.name ?? (kind === 'board' ? 'A board member' : 'A coach')) : null,
  });
}

function paramsOf(g: ColleagueGroup): Record<string, unknown> {
  switch (g.group) {
    case 'league_season': return { seasonId: g.seasonId };
    case 'league_division': return { seasonId: g.seasonId, divisionId: g.divisionId };
    case 'coaches_picked': case 'board_picked': return { picked: g.keys.length };
    default: return {};
  }
}

// ── "Send to the ones it missed" (POST [sendId] action 'finish') ─────────────────────────────────────────────────────────

export async function finishColleagueEmail(ctx: AuthContextWithRole, seat: Seat, sendId: string): Promise<Out> {
  const send = await loadReadableSend(ctx, seat, sendId);
  if (!send) return refuse(404, 'not_found', SAY.notFound);
  if (!canFinish(seat, ctx.user.id, send)) return refuse(403, 'not_yours', SAY.finishWho(send.kind, send.senderName));
  if (send.wordsClearedAt) return refuse(409, 'words_gone', SAY.wordsGone); // T25
  if (send.state !== 'stopped') return refuse(409, 'not_stopped', SAY.notStopped);

  // One mode per send (legal addendum 3): the stored mode, the stored sender, the reply target read now.
  const clubContact = send.replyTo === 'club' ? await clubPublicContact(ctx.org.id) : null;
  let senderEmail: string | null = null;
  if (send.replyTo === 'sender' && send.sentBy) {
    try { senderEmail = (await supabaseAdmin.auth.admin.getUserById(send.sentBy)).data.user?.email ?? null; } catch { senderEmail = null; }
  }
  const target = replyTargetOf(send.replyTo, senderEmail, clubContact);
  if ('ok' in target) return target;

  // Whom it missed, and where each is NOW — read BEFORE the row is taken (/review 2026-11-17), so a failed read never leaves
  // a stopped email held for 15 minutes with nothing sent.
  const { data: missedRows, error: mErr } = await supabaseAdmin.from('club_group_email_recipients')
    .select('id, user_id, league_coach_id, name, basis, board_role').eq('send_id', sendId).in('status', ['pending', 'failed']);
  if (mErr) throw mErr;
  const addressOf = await stillInTheGroup(ctx, seat, send);
  if ('ok' in addressOf) return addressOf;

  // Taking the row is the press's claim: a second press finds it taken, and nothing goes twice. Words the nightly clean-up
  // has just deleted are never sent: the take only matches a send that still has them.
  const cutoff = new Date(Date.now() - STOPPED_AFTER_MS).toISOString();
  const { data: taken, error } = await supabaseAdmin.from('club_group_email_sends').update({ retried_at: new Date().toISOString() })
    .eq('id', sendId).eq('org_id', ctx.org.id).eq('status', 'sending').lt('sent_at', cutoff).is('words_cleared_at', null)
    .or(`retried_at.is.null,retried_at.lt.${cutoff}`).select('id').maybeSingle();
  if (error) throw error;
  if (!taken) return refuse(409, 'not_stopped', SAY.notStopped);
  const { data: words, error: wErr } = await supabaseAdmin.from('club_group_email_bodies').select('subject, body').eq('send_id', sendId).maybeSingle();
  if (wErr) throw wErr;
  if (!words) return refuse(409, 'words_gone', SAY.wordsGone);

  const outcomes = await inParallel(missedRows ?? [], 5, async (r) => {
    const key = r.user_id ? `u:${r.user_id}` : `c:${r.league_coach_id}`;
    const to = addressOf.get(key);
    // No longer in the group (left the club, the team, the board, or the division the email went to): not sent, failed.
    if (!to) { await markRecipient(r.id as string, 'failed'); return 'failed' as const; }
    const mail = renderColleagueEmail({
      club: ctx.org.name, mode: send.replyTo, sender: { name: send.senderName ?? '', role: (send.senderRole ?? 'admin') as OrgRole },
      subject: words.subject as string, body: words.body as string,
      recipient: { firstName: firstName(r.name as string | null), basis: r.basis as ColleagueBasis, boardRole: r.board_role as string | null },
    });
    const s = await deliverOne(sendId, to, mail, send.kind === 'board' ? 'club_board_email' : 'club_coach_email', target.replyTo);
    await markRecipient(r.id as string, s);
    return s;
  });
  const { data: all, error: cErr } = await supabaseAdmin.from('club_group_email_recipients').select('status').eq('send_id', sendId);
  if (cErr) throw cErr;
  const reached = (all ?? []).filter(x => x.status === 'sent').length;
  const failed = (all ?? []).filter(x => x.status === 'failed').length;
  // Counts only from people still on the record: if the clock has removed them, the counts already stored stand.
  const done = (all ?? []).length > 0 ? { reached_count: reached, failed_count: failed, status: 'done' } : { status: 'done' };
  const { error: doneErr } = await supabaseAdmin.from('club_group_email_sends').update(done).eq('id', sendId);
  if (doneErr) console.error('[club-group-email] the finished send could not be completed:', doneErr.message);
  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'club_group_email_finished', { sendId, tried: outcomes.length, reached, failed });
  return okay({ sendId, tried: outcomes.length, reached, failed });
}

/**
 * key → address for the people who are STILL in the group the email went to (/review 2026-11-17: not merely "a coach of the
 * club"): the board's active seats; for a coach group, that group re-chosen now from the stored kind and parameters; for a
 * pick, the people this seat may still pick. A season no longer under way refuses, rather than failing everyone it missed.
 */
async function stillInTheGroup(ctx: AuthContextWithRole, seat: Seat, send: ReadableSend): Promise<Map<string, string> | Out> {
  const map = new Map<string, string>();
  if (send.kind === 'board') {
    for (const m of await loadBoardMembers(ctx.org.id)) if (m.status === 'active' && m.email) map.set(`u:${m.userId}`, m.email);
    return map;
  }
  const w = await coachWorld(ctx, seat);
  let people: CoachPerson[];
  if (send.groupKind === 'coaches_picked') {
    people = pickable(w.people, seat);
  } else {
    const p = send.params as { seasonId?: string; divisionId?: string };
    const g = (send.groupKind === 'league_division' ? { kind: 'coaches', group: 'league_division', seasonId: p.seasonId ?? '', divisionId: p.divisionId ?? '' }
      : send.groupKind === 'league_season' ? { kind: 'coaches', group: 'league_season', seasonId: p.seasonId ?? '' }
      : { kind: 'coaches', group: send.groupKind }) as CoachGroup;
    const r = chooseCoaches(w.people, g, seat, { userId: send.sentBy ?? '', email: null }, liveSeasonsOf(w));
    if (!r.ok) return refuse(r.status, r.code, r.error);
    people = r.people;
  }
  for (const p of people) if (p.email) for (const a of p.aliases) map.set(a, p.email);
  return map;
}

// ── "Send again to these people" (GET [sendId]/again): the pick filled in, nothing sent ──────────────────────────────────

export async function againColleagueEmail(ctx: AuthContextWithRole, seat: Seat, sendId: string): Promise<Out> {
  const send = await loadReadableSend(ctx, seat, sendId);
  if (!send) return refuse(404, 'not_found', SAY.notFound);
  if (send.namesClearedAt) return refuse(409, 'names_gone', SAY.namesGone);
  const pickGroup = send.kind === 'board' ? 'board_picked' : 'coaches_picked';
  if (!groupOffered(seat, pickGroup)) return refuse(403, 'not_offered', SAY.notOffered);
  const { data: rows, error } = await supabaseAdmin.from('club_group_email_recipients').select('user_id, league_coach_id').eq('send_id', sendId);
  if (error) throw error;
  const was = (rows ?? []).map(r => (r.user_id ? `u:${r.user_id}` : `c:${r.league_coach_id}`));
  // Only the people this seat may pick NOW (a coach who left the club, a seat no longer on the board, drop out, counted). A
  // stored key maps to the person's key today (a house-league coach recorded by their row who has since signed in).
  const now = new Map<string, string>();
  if (send.kind === 'board') {
    const members = await loadBoardMembers(ctx.org.id);
    for (const m of members) if (m.status === 'active' && m.email && m.userId !== ctx.user.id) now.set(`u:${m.userId}`, `u:${m.userId}`);
  } else {
    const w = await coachWorld(ctx, seat);
    for (const p of pickable(w.people, seat)) {
      if (!p.email || p.userId === ctx.user.id) continue;
      now.set(p.key, p.key);
      for (const l of p.league) now.set(`c:${l.leagueCoachId}`, p.key);
      if (p.userId) now.set(`u:${p.userId}`, p.key);
    }
  }
  const keys = [...new Set(was.map(k => now.get(k)).filter((k): k is string => !!k))];
  return okay({
    kind: send.kind, group: pickGroup, keys, dropped: was.length - keys.length,
    // T19: the subject is copied; the message opens empty.
    subject: send.subject,
  });
}
