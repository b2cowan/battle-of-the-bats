import 'server-only';
/**
 * CLUB COMMUNICATIONS — READING THE COACH AND BOARD EMAILS (Stage 1, Session 1). The list rows, one record, and a window's
 * Last sent line, each FILTERED IN HERE by `canReadSend` (legal §2c): a row the reader may not read is ABSENT (not hidden), a
 * record they may not read is NOT FOUND (a refusal would confirm a board conversation happened without them), and a league
 * seat's record names only its house-league coaches (`shapeRecipients`, T13). No response carries an address.
 *
 * Session 2 merges these rows with the family log into Communications' one list; it calls these, never the tables.
 */
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { RECORD, SAY, type ColleagueKind, type ReplyMode } from './club-group-email-words';
import { canFinish, canReadSend, shapeRecipients, type Seat, type SendFacts, type StoredRecipient } from './club-group-email-rules';

/** A send still `sending` this long after it started (or was last retried) reads as Stopped — the family send's length. */
export const STOPPED_AFTER_MS = 15 * 60 * 1000;

const SEND_COLS = 'id, kind, group_kind, group_label, group_params, reaches_rep, sent_by, sender_name, sender_role, reply_to, club_copy, sent_at, '
  + 'retried_at, recipient_count, left_out_count, reached_count, failed_count, status, words_cleared_at, names_cleared_at';

export interface ReadableSend extends SendFacts {
  id: string; label: string; params: Record<string, unknown>; senderName: string | null; senderRole: string | null; replyTo: ReplyMode; clubCopy: string | null;
  sentAt: string; retriedAt: string | null; count: number; leftOut: number; reached: number; failed: number;
  state: 'sending' | 'stopped' | 'done'; wordsClearedAt: string | null; namesClearedAt: string | null; subject: string | null;
}

type Row = Record<string, unknown>;
function stateOf(r: Row): ReadableSend['state'] {
  if (r.status === 'done') return 'done';
  const from = Math.max(new Date(r.sent_at as string).getTime(), r.retried_at ? new Date(r.retried_at as string).getTime() : 0);
  return Date.now() - from > STOPPED_AFTER_MS ? 'stopped' : 'sending';
}
function toSend(r: Row, subject: string | null): ReadableSend {
  return {
    id: r.id as string, kind: r.kind as ColleagueKind, groupKind: r.group_kind as string, reachesRep: !!r.reaches_rep,
    sentBy: (r.sent_by as string | null) ?? null, label: r.group_label as string, params: (r.group_params as Record<string, unknown>) ?? {}, senderName: (r.sender_name as string | null) ?? null,
    senderRole: (r.sender_role as string | null) ?? null, replyTo: r.reply_to as ReplyMode, clubCopy: (r.club_copy as string | null) ?? null,
    sentAt: r.sent_at as string, retriedAt: (r.retried_at as string | null) ?? null, count: r.recipient_count as number,
    leftOut: r.left_out_count as number, reached: r.reached_count as number, failed: r.failed_count as number, state: stateOf(r),
    wordsClearedAt: (r.words_cleared_at as string | null) ?? null, namesClearedAt: (r.names_cleared_at as string | null) ?? null, subject,
  };
}

/** Which of these sends the viewer was a recipient of (the board's read rule asks it). */
async function recipientOf(viewerId: string, sendIds: readonly string[]): Promise<Set<string>> {
  if (sendIds.length === 0) return new Set();
  const { data, error } = await supabaseAdmin.from('club_group_email_recipients').select('send_id')
    .eq('user_id', viewerId).in('send_id', [...sendIds]);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.send_id as string));
}

async function subjectsOf(sendIds: readonly string[]): Promise<Map<string, string>> {
  if (sendIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from('club_group_email_bodies').select('send_id, subject').in('send_id', [...sendIds]);
  if (error) throw error;
  return new Map((data ?? []).map(r => [r.send_id as string, r.subject as string]));
}

/** The readable sends among some rows, newest first. */
async function readable(ctx: AuthContextWithRole, seat: Seat, rows: Row[]): Promise<ReadableSend[]> {
  const boardIds = rows.filter(r => r.kind === 'board').map(r => r.id as string);
  const mine = await recipientOf(ctx.user.id, boardIds);
  const kept = rows.filter(r => canReadSend(seat, ctx.user.id, {
    kind: r.kind as ColleagueKind, groupKind: r.group_kind as string, reachesRep: !!r.reaches_rep, sentBy: (r.sent_by as string | null) ?? null,
  }, mine.has(r.id as string)));
  const subjects = await subjectsOf(kept.map(r => r.id as string));
  const sends = kept.map(r => toSend(r, subjects.get(r.id as string) ?? null));
  // A send that never finished wrote no counts: its people say how far it got (/review 2026-11-17).
  const unfinished = sends.filter(x => x.state !== 'done').map(x => x.id);
  if (unfinished.length > 0) {
    const { data, error } = await supabaseAdmin.from('club_group_email_recipients').select('send_id, status').in('send_id', unfinished);
    if (error) throw error;
    for (const x of sends.filter(y => y.state !== 'done')) {
      const rows = (data ?? []).filter(d => d.send_id === x.id);
      if (rows.length) { x.reached = rows.filter(d => d.status === 'sent').length; x.failed = rows.filter(d => d.status === 'failed').length; }
    }
  }
  return sends;
}

/** One send, if this reader may read it; else null (the route answers Not found). */
export async function loadReadableSend(ctx: AuthContextWithRole, seat: Seat, sendId: string): Promise<ReadableSend | null> {
  if (!seat.any) return null;
  const { data, error } = await supabaseAdmin.from('club_group_email_sends').select(SEND_COLS).eq('id', sendId).eq('org_id', ctx.org.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await readable(ctx, seat, [data as unknown as Row]))[0] ?? null;
}

export const COLLEAGUE_PAGE = 50;
const SLICE = 100;

/** A row as a list or a Last sent line may show it: never the sender's account id or the group's raw parameters. */
export type ListedSend = Omit<ReadableSend, 'sentBy' | 'params'> & { isMine: boolean };
const listed = (ctx: AuthContextWithRole, x: ReadableSend): ListedSend => {
  const { sentBy, params: _params, ...rest } = x;
  void _params;
  return { ...rest, isMine: sentBy === ctx.user.id };
};

/** Readable sends, newest first, read in slices until `want` are found or the log ends. `scanned`: where the scan stopped. */
async function scan(ctx: AuthContextWithRole, seat: Seat, before: string | null, want: number, opts: { kind?: ColleagueKind; reachedOnly?: boolean } = {}):
  Promise<{ rows: ReadableSend[]; scanned: string | null }> {
  const out: ReadableSend[] = [];
  let cursor = before;
  for (let guard = 0; guard < 20 && out.length < want; guard++) {
    let q = supabaseAdmin.from('club_group_email_sends').select(SEND_COLS).eq('org_id', ctx.org.id)
      .order('sent_at', { ascending: false }).limit(SLICE);
    if (opts.kind) q = q.eq('kind', opts.kind);
    if (opts.reachedOnly) q = q.gt('reached_count', 0);
    if (cursor) q = q.lt('sent_at', cursor);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...await readable(ctx, seat, rows));
    if (rows.length < SLICE) return { rows: out, scanned: null };
    cursor = rows[rows.length - 1].sent_at as string;
  }
  return { rows: out, scanned: cursor };
}

/** The list's coach and board rows this reader may read, newest first, a page at a time (`before` = the `next` it was given). */
export async function listColleagueEmails(ctx: AuthContextWithRole, seat: Seat, before: string | null, kind?: ColleagueKind): Promise<{ rows: ListedSend[]; next: string | null }> {
  if (!seat.any) return { rows: [], next: null };
  const { rows, scanned } = await scan(ctx, seat, before, COLLEAGUE_PAGE + 1, { kind });
  const page = rows.slice(0, COLLEAGUE_PAGE);
  // More readable rows past the page: continue after its last row. Otherwise continue where the scan stopped (it always
  // moves forward, even past a long run of rows this reader may not read), or end.
  const next = rows.length > COLLEAGUE_PAGE ? page[page.length - 1].sentAt : scanned;
  return { rows: page.map(x => listed(ctx, x)), next };
}

/** A window's "Last sent" line (follows the read rule: never a board subject to a non-reader). */
export async function lastColleagueSend(ctx: AuthContextWithRole, seat: Seat, kind: ColleagueKind): Promise<{ at: string; by: string | null; subject: string | null; reached: number } | null> {
  if (!seat.any) return null;
  const first = (await scan(ctx, seat, null, 1, { kind, reachedOnly: true })).rows[0];
  return first ? { at: first.sentAt, by: first.senderName, subject: first.subject, reached: first.reached } : null;
}

/** One coach or board email's record, shaped for THIS reader. */
export async function readColleagueEmail(ctx: AuthContextWithRole, seat: Seat, sendId: string) {
  const send = await loadReadableSend(ctx, seat, sendId);
  if (!send) return null;
  const [{ data: words }, { data: rows, error }] = await Promise.all([
    supabaseAdmin.from('club_group_email_bodies').select('subject, body').eq('send_id', sendId).maybeSingle(),
    supabaseAdmin.from('club_group_email_recipients').select('name, line, basis, board_role, house_league, rep, status')
      .eq('send_id', sendId).order('name', { ascending: true }),
  ]);
  if (error) throw error;
  const stored: StoredRecipient[] = (rows ?? []).map(r => ({
    name: (r.name as string | null) ?? null, line: (r.line as string | null) ?? null, basis: r.basis as StoredRecipient['basis'],
    boardRole: (r.board_role as string | null) ?? null, houseLeague: !!r.house_league, rep: !!r.rep, status: r.status as StoredRecipient['status'],
  }));
  const who = shapeRecipients(seat, send.kind, stored);
  const finish = send.state === 'stopped'
    ? (canFinish(seat, ctx.user.id, send) ? { may: true, line: null } : { may: false, line: SAY.finishWho(send.kind, send.senderName) })
    : null;
  const { sentBy: _sentBy, params: _params, ...shown } = send;
  void _sentBy; void _params;
  return {
    ...shown,
    body: (words?.body as string | undefined) ?? null,
    subject: (words?.subject as string | undefined) ?? null,
    replies: RECORD.repliesWent(send.replyTo === 'club' ? ctx.org.name : (send.senderName ?? ctx.org.name)),
    copy: send.clubCopy === 'sent' ? RECORD.copySent : send.clubCopy === 'failed' ? RECORD.copyFailed : send.clubCopy === 'already_listed' ? RECORD.copyListed : null,
    note: RECORD.note,
    wordsCleared: send.wordsClearedAt ? RECORD.wordsCleared : null,
    namesCleared: send.namesClearedAt ? RECORD.namesCleared : null,
    people: who.people,
    others: who.others,
    finish,
    canSendAgain: !send.namesClearedAt && (send.kind === 'board' ? seat.board : !!seat.coaches),
    isMine: send.sentBy === ctx.user.id,
  };
}

/**
 * How many coach and board emails this reader may read, and of which kinds (Communications' count "7 emails" and its
 * Filter, Session 2). The facts only — no subject, no body, no recipient — filtered by the same `canReadSend`.
 */
export async function colleagueSummary(ctx: AuthContextWithRole, seat: Seat): Promise<Record<ColleagueKind, number>> {
  if (!seat.any) return { coaches: 0, board: 0 };
  const { data, error } = await supabaseAdmin.from('club_group_email_sends').select('id, kind, group_kind, reaches_rep, sent_by')
    .eq('org_id', ctx.org.id).limit(5000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const mine = await recipientOf(ctx.user.id, rows.filter(r => r.kind === 'board').map(r => r.id as string));
  const kept = rows.filter(r => canReadSend(seat, ctx.user.id, {
    kind: r.kind as ColleagueKind, groupKind: r.group_kind as string, reachesRep: !!r.reaches_rep, sentBy: (r.sent_by as string | null) ?? null,
  }, mine.has(r.id as string)));
  return { coaches: kept.filter(r => r.kind === 'coaches').length, board: kept.filter(r => r.kind === 'board').length };
}
