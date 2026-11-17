import 'server-only';
import { readClubEmail, readEmailLog, type ClubEmailRecord, type EmailLogFilter, type EmailLogRow } from './families-emails-log';
import { colleagueSummary, listColleagueEmails, type ListedSend } from './club-group-email-read';
import { familyDoor, seasonDoorOpen } from './club-communications-place';
import type { CommunicationsGate } from './club-communications-auth';
import { SAY, type ColleagueKind } from './club-group-email-words';

/**
 * CLUB COMMUNICATIONS — THE ONE LIST (Stage 1, Session 2; drawing tabs 1 and 3). One reader over the family log
 * (`readEmailLog`, narrowed to this reader by `familyReader`) and Session 1's coach and board log (`listColleagueEmails`,
 * each row filtered by `canReadSend`). Neither source is read wider than this reader may see, so a row they may not read is
 * absent from the response, never hidden by the screen (legal §2c).
 *
 * Paging: each source pages on its own cursor (the time of its oldest row read). The merged page keeps only the rows newer
 * than the LATER of the two cursors, so nothing between them is skipped; "Show more" continues from there.
 *
 * A season's Email families tab keeps its own reader (`readSeasonHistory`) — the same tables, narrowed to that season.
 */

export type CommsFilter = 'all' | 'families' | 'coaches' | 'board' | { seasonId: string };
export type CommsKind = 'families' | ColleagueKind;

/** How a stopped family email is finished from here (ask 14): back down the door it came from, or who can. */
export type CommsFinish = { door: 'club' } | { door: 'season'; seasonId: string } | { line: string };
export interface CommsRow extends EmailLogRow { finish?: CommsFinish }

export interface CommsPage {
  rows: CommsRow[];
  /** The reader's emails under this filter (first page only; 0 on a later page). */
  total: number;
  next: string | null;
  /** First page only: the seasons emailed and the kinds this reader has rows of (the filter's choices, ask 8). */
  seasons: { id: string; name: string }[];
  kinds: CommsKind[];
}

function colleagueRow(x: ListedSend): CommsRow {
  return {
    key: `${x.kind}:${x.id}`, kind: x.kind, id: x.id, sentAt: x.sentAt, subject: x.subject, to: x.label, by: x.senderName, seasonId: null,
    counts: { families: x.count, reached: x.reached, optedOut: 0, failed: x.failed, coaches: 0 }, state: x.state,
  };
}

/** Who may finish a stopped family email (ask 14): anyone who may send to that same group now, by its own door. */
export function familyFinish(g: Pick<CommunicationsGate, 'facts'>, row: Pick<EmailLogRow, 'seasonId' | 'audienceKind' | 'by'>): CommsFinish {
  // A season's email goes back down its season's door; an owner or admin without the house league finishes it from the
  // club's, which admits every row but a list's (/review 2026-11-17: the screen and the route said different things).
  if (row.seasonId && seasonDoorOpen(g.facts)) return { door: 'season', seasonId: row.seasonId };
  const mayClub = familyDoor(g.facts) === 'club' && (row.audienceKind !== 'list' || g.facts.holdsBook);
  // The non-board words ("{Sender} or an admin can send it…"): a family email is never a board one.
  return mayClub ? { door: 'club' } : { line: SAY.finishWho('coaches', row.by) };
}

const familyFilter = (f: CommsFilter): EmailLogFilter | null =>
  f === 'all' || f === 'families' ? 'all' : typeof f === 'object' ? { seasonId: f.seasonId } : null;
const colleagueFilter = (f: CommsFilter): ColleagueKind | 'all' | null =>
  f === 'all' ? 'all' : f === 'coaches' || f === 'board' ? f : null;

export async function readCommunications(g: CommunicationsGate, before: string | null, filter: CommsFilter): Promise<CommsPage> {
  const fam = g.families ? familyFilter(filter) : null;
  const col = g.seat.any ? colleagueFilter(filter) : null;
  const first = !before;
  const [family, colleague, counts, everything] = await Promise.all([
    fam ? readEmailLog(g.ctx.org.id, before, fam, g.families!) : null,
    col ? listColleagueEmails(g.ctx, g.seat, before, col === 'all' ? undefined : col) : null,
    first && g.seat.any ? colleagueSummary(g.ctx, g.seat) : null,
    // The filter's choices come from the reader's whole log, whatever is filtered now (first page only).
    first && g.families && filter !== 'all' ? readEmailLog(g.ctx.org.id, null, 'all', g.families) : null,
  ]);

  const familyRows: CommsRow[] = (family?.rows ?? []).map(r => r.kind === 'club' && r.state === 'stopped' ? { ...r, finish: familyFinish(g, r) } : r);
  const colleagueRows = (colleague?.rows ?? []).map(colleagueRow);
  // Keep only what both sources have read down to (the later cursor), so no row between them is skipped.
  const cut = [family?.next, colleague?.next].filter((x): x is string => !!x).sort().pop() ?? null;
  const rows = [...familyRows, ...colleagueRows]
    .filter(r => !cut || r.sentAt >= cut)
    // Code-unit order, the same order as the cut above (both sources return one timestamptz form).
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));

  const familyTotal = family?.total ?? 0;
  const colleagueTotal = counts ? (col === 'all' ? counts.coaches + counts.board : col ? counts[col] : 0) : 0;
  const famAll = filter === 'all' ? family : everything;
  const kinds: CommsKind[] = !first ? [] : [
    ...((famAll?.total ?? 0) > 0 ? ['families' as const] : []),
    ...(counts && counts.coaches > 0 ? ['coaches' as const] : []),
    ...(counts && counts.board > 0 ? ['board' as const] : []),
  ];
  return {
    rows,
    total: first ? familyTotal + colleagueTotal : 0,
    next: cut,
    seasons: first ? (famAll?.seasons ?? []) : [],
    kinds,
  };
}

/** One family email's record for this reader (null = Not found), with how a stopped one is finished from here. */
export async function readCommunicationsFamily(g: CommunicationsGate, sendId: string): Promise<(ClubEmailRecord & { finish?: CommsFinish }) | null> {
  if (!g.families) return null;
  const rec = await readClubEmail(g.ctx.org.id, sendId, g.families);
  if (!rec) return null;
  return rec.state === 'stopped' ? { ...rec, finish: familyFinish(g, rec) } : rec;
}
