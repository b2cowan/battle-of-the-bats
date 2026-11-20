import 'server-only';
import { TC_HISTORY } from './house-league-team-changes-words';
import { supabaseAdmin } from './supabase-admin';
import { getLeagueEmailLog, resolvePersonNamer } from './db';
import type { ColleagueKind } from './club-group-email-words';
import { CLUB_EMAIL_STOPPED_AFTER_MS, FAMILY_EMAILS_TAB_WORDS as W, SEASON_EMAIL_WORDS as SW, familiesNamed } from './families-words';
import { PRACTICES_CHANGED_NOTICE } from './club-schedule-league-words';
import { PRACTICES_SENT_NOTICE } from './league-practice-tell';
import { SCHEDULE_NOTICE_WORDS } from './league-schedule-words';
import { pluralize } from './utils';

/**
 * THE EMAILS TAB (Club Tier Stage 7c — Ask 7 A, drawing 5): every email the club sent from Families, newest first. Two
 * sources merged, a page at a time (every Families read is paged):
 *
 *   · Email families — `family_email_sends` (mig 347): the subject, the message, who it went to, and counts. "Reached x
 *     of y"; "Sending…" while it goes; "Stopped at x of y" once a send has sat unfinished past the grace period.
 *   · Message this family — `family_messages` (mig 334): the date and who sent it, NEVER the words and never a count (the
 *     Stage 5a rule, unchanged). Its row says so honestly ("1 family", no x of y) rather than inventing numbers.
 *
 * ⚖ SINCE 9d-1 (owner 9d1·3, 9d1·4, 9d1·7, 9d1·10, 2026-10-26) the same record is a house-league SEASON's too:
 *   · Families › Emails lists a season's emails with the season named, and filters by season (All · Club-wide · each).
 *   · The season's own history (`readSeasonHistory`) lists only its own: typed emails, one-family messages (no words),
 *     automatic notices to many families (`league_season_notices`, tagged Automatic), and the OLD log read-only under
 *     "Earlier emails · counted per child" (`league_email_log`, which nothing writes again).
 *   · An email's window names the families it missed and those who opted out (`family_email_recipients`) and, when it
 *     stopped partway, offers "Send to the N it missed".
 *
 * Nothing here is editable. Gated by the route (`requireFamiliesAccess`, or the season's email right).
 */

const EMAILS_PAGE = 50;

/** A one-family row's name: the person's name as the club holds it, or "A family" — NEVER the address `personDisplayName`
 *  falls back to (Club Communications, legal §2c no-address-fallback rule, T17). */
function familyNameOf(p: { first_name?: string | null; last_name?: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || W.nameless;
}

export interface EmailLogRow {
  key: string;
  /** club: a typed email (club-wide or a season's); family: a one-household message; notice: an automatic notice to many
   *  families (9d1·4); earlier: the old season log (read-only, counted per child). */
  kind: 'club' | 'family' | 'notice' | 'earlier' | ColleagueKind;
  id: string;
  sentAt: string;
  /** The subject (a typed email), or null (a one-household message keeps no words). */
  subject: string | null;
  /** Who it went to: the audience in words, or the family's name. */
  to: string;
  by: string | null;
  /** The season it belongs to (its allowance, 9d1·6), or null for a club-wide email. */
  seasonId: string | null;
  /** A typed email's or a notice's counts; null for a one-household message and an old row. */
  counts: { families: number; reached: number; optedOut: number; failed: number; coaches: number } | null;
  /** An old row's "11 sent · 2 didn't go" (counted per child). */
  oldReached?: string;
  /** A notice's own kind: Publish teams (9c), a practice change the club's Send the changes made (Stage 11b Part 5),
   *  Publish schedule or a division's schedule changes (House League 9d-2b, f4). */
  noticeKind?: NoticeKind;
  /** A `team_changes` notice: of its families, how many the convenor chose NOT to email (Don't email). */
  skipped?: number;
  /** A notice's division, for its body's words ("when U12 Division's schedule was published"). */
  division?: string | null;
  state: 'sending' | 'stopped' | 'done';
  /** A typed email's audience kind as sent (every · teams · season · list): who may finish it follows it (ask 14). */
  audienceKind?: string;
}

export type NoticeKind = 'teams_published' | 'practices_changed' | 'schedule_published' | 'games_changed' | 'practices_sent' | 'team_changes';

/** A notice's subject and To (f4: "Schedule published: U12 Division" · "U12 Division · 66 families · reached 66"). */
function noticeFace(kind: NoticeKind, division: string | null, families: number, reached: number): { subject: string; to: string } {
  switch (kind) {
    // A practice change reaches the families of the teams it touched, never the whole season.
    case 'practices_changed': return { subject: PRACTICES_CHANGED_NOTICE.subject(division), to: division ?? pluralize(families, 'family', 'families') };
    case 'schedule_published': return { subject: SCHEDULE_NOTICE_WORDS.publishedSubject(division), to: SCHEDULE_NOTICE_WORDS.to(division, families, reached) };
    case 'games_changed': return { subject: SCHEDULE_NOTICE_WORDS.changesSubject(division), to: SCHEDULE_NOTICE_WORDS.to(division, families, reached) };
    // House League 9d-3: a league admin told a division's families their practice times (copy section E).
    case 'practices_sent': return { subject: PRACTICES_SENT_NOTICE.subject(division), to: SCHEDULE_NOTICE_WORDS.to(division, families, reached) };
    // House League team-change emails: one press of Review and email or Don't email after publishing (TC·4).
    case 'team_changes': return { subject: TC_HISTORY.subject(division), to: division ?? SW.everyone };
    default: return { subject: SW.teamsPublished(division), to: division ?? SW.everyone };
  }
}

/** A schedule notice is a send that can stop partway (9d-2b): its `failed_count` is every family still to reach (failed,
 *  or never tried), recounted after each send — so "stopped" is exactly when "Send to the N it missed" has someone to send. */
function noticeState(kind: NoticeKind, n: { id: string; failed_count: number }, inFlight: ReadonlySet<string>): EmailLogRow['state'] {
  if (kind !== 'schedule_published' && kind !== 'games_changed' && kind !== 'practices_sent') return 'done';
  return n.failed_count === 0 ? 'done' : inFlight.has(n.id) ? 'sending' : 'stopped';
}

/** A schedule notice whose send holds a row right now (`sending`, under the claim's own ten minutes): it reads "sending",
 *  not "stopped", while its emails are going. A failed read says none — the page still loads. */
const SENDING_FRESH_MS = 10 * 60 * 1000;
async function noticesSending(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const fresh = new Date(Date.now() - SENDING_FRESH_MS).toISOString();
    // A schedule notice's families, and (9d-3) a practice-times notice's households.
    const reads = await Promise.all(['league_schedule_emails', 'league_practice_emails'].map(table => supabaseAdmin.from(table)
      .select('notice_id').in('notice_id', [...ids]).eq('status', 'sending').gt('updated_at', fresh).limit(1000)));
    const failed = reads.find(r => r.error);
    if (failed?.error) throw failed.error;
    return new Set(reads.flatMap(r => (r.data ?? []).map(x => (x as { notice_id: string }).notice_id)));
  } catch (err) {
    console.error('[families-emails-log] which schedule sends are in flight was not read:', err instanceof Error ? err.message : String(err));
    return new Set();
  }
}

export interface EmailLogPage {
  rows: EmailLogRow[];
  /** Every email the club has sent from Families — read with the first page only (0 on a later page). */
  total: number;
  /** The cursor for the next page (the oldest row's time), or null at the end. */
  next: string | null;
  /** The seasons with an email, for the Season filter (first page only). */
  seasons: { id: string; name: string }[];
}

/** The Season filter: every email, the club-wide ones, or the emails of the seasons ticked (Communications' Filter). */
export type EmailLogFilter = 'all' | 'club' | { seasonIds: readonly string[] };

const CLUB_COLS = 'id, sent_at, sent_by, subject, audience_kind, audience_label, season_id, family_count, reached_count, opted_out_count, failed_count, coach_count, status, retried_at';

/** One typed email's row. "Stopped" is one still unfinished past the grace period (the server died mid-send); a resend
 *  ("Send to the N it missed") restarts the grace period. */
function clubRow(r: any, by: string | null, now: number, to: string = r.audience_label): EmailLogRow {
  const since = Math.max(new Date(r.sent_at).getTime(), r.retried_at ? new Date(r.retried_at).getTime() : 0);
  return {
    key: `club:${r.id}`, kind: 'club', id: r.id, sentAt: r.sent_at, subject: r.subject, to, by, seasonId: r.season_id ?? null, audienceKind: r.audience_kind,
    state: r.status === 'done' ? 'done' : now - since > CLUB_EMAIL_STOPPED_AFTER_MS ? 'stopped' : 'sending',
    counts: { families: r.family_count, reached: r.reached_count, optedOut: r.opted_out_count, failed: r.failed_count, coaches: r.coach_count },
  };
}

async function seasonNames(orgId: string, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from('league_seasons').select('id, name').eq('org_id', orgId).in('id', [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map(s => [s.id as string, s.name as string]));
}

/**
 * Which family emails this reader may see (Club Communications, legal §2c; built by `familyReader`,
 * `lib/club-communications-place.ts`). The rows a reader may not read are never READ, so they are absent, not hidden:
 *   · all    — every typed email; a one-family message only with the Families book (ask 13);
 *   · league — a league seat: a season's emails (from either door) and "Every family"; a one-family message only when it
 *              was sent from a season. Never a rep team's, a Families list's, or a message to one family sent from Families.
 */
export type FamilyLogReader = { scope: 'all'; oneFamily: boolean } | { scope: 'league' };
const EVERY_READER: FamilyLogReader = { scope: 'all', oneFamily: true };

/** A typed email this reader may read (the league rule, as one predicate on a row). */
export function familySendReadable(reader: FamilyLogReader, row: { season_id: string | null; audience_kind: string }): boolean {
  return reader.scope === 'all' || !!row.season_id || row.audience_kind === 'every';
}
/** A league seat reading a club-wide family email sees its message and counts and NO names (ask 4): the record can't tell
 *  which of its named families are house-league ones. */
export function familyNamesShown(reader: FamilyLogReader, row: { season_id: string | null }): boolean {
  return reader.scope === 'all' || !!row.season_id;
}

export async function readEmailLog(orgId: string, before: string | null, filter: EmailLogFilter = 'all', reader: FamilyLogReader = EVERY_READER): Promise<EmailLogPage> {
  // The Season filter, on any of the three reads below (each a query on a table with season_id).
  const narrow = (q: any) => (filter === 'all' ? q : filter === 'club' ? q.is('season_id', null) : q.in('season_id', [...filter.seasonIds]));
  // The reader's own rows (legal §2c), on top of the filter.
  const sendsFor = (q: any) => (reader.scope === 'league' ? q.or('season_id.not.is.null,audience_kind.eq.every') : q);
  const messagesFor = (q: any) => (reader.scope === 'league' ? q.not('season_id', 'is', null) : q);
  const readsMessages = reader.scope === 'league' || reader.oneFamily;
  const none = { data: [] as any[], count: 0, error: null };
  const club = sendsFor(narrow(supabaseAdmin.from('family_email_sends').select(CLUB_COLS).eq('org_id', orgId)));
  const family = messagesFor(narrow(supabaseAdmin.from('family_messages').select('id, sent_at, sent_by, person_id, season_id').eq('org_id', orgId)));
  // The totals are the first page's: a "Show more" page does not re-count.
  const total = (table: 'family_email_sends' | 'family_messages') => before
    ? Promise.resolve({ count: 0, error: null })
    : (table === 'family_email_sends' ? sendsFor : messagesFor)(narrow(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId)));
  // The filter's seasons: every season the club has emailed (first page only; one column, bounded).
  const withSeason = (table: 'family_email_sends' | 'family_messages') => before
    ? Promise.resolve({ data: [] as { season_id: string }[], error: null })
    : supabaseAdmin.from(table).select('season_id').eq('org_id', orgId).not('season_id', 'is', null).limit(2000);
  const [clubRows, familyRows, clubTotal, familyTotal, sendSeasons, messageSeasons] = await Promise.all([
    (before ? club.lt('sent_at', before) : club).order('sent_at', { ascending: false }).limit(EMAILS_PAGE),
    readsMessages ? (before ? family.lt('sent_at', before) : family).order('sent_at', { ascending: false }).limit(EMAILS_PAGE) : Promise.resolve(none),
    total('family_email_sends'),
    readsMessages ? total('family_messages') : Promise.resolve(none),
    withSeason('family_email_sends'),
    readsMessages ? withSeason('family_messages') : Promise.resolve(none),
  ]);
  for (const r of [clubRows, familyRows, clubTotal, familyTotal, sendSeasons, messageSeasons]) if (r.error) throw r.error;

  type Raw = { kind: 'club'; r: any } | { kind: 'family'; r: any };
  const merged: Raw[] = [
    ...(clubRows.data ?? []).map((r: any) => ({ kind: 'club' as const, r })),
    ...(familyRows.data ?? []).map((r: any) => ({ kind: 'family' as const, r })),
  ].sort((a, b) => String(b.r.sent_at).localeCompare(String(a.r.sent_at))).slice(0, EMAILS_PAGE);

  const personIds = [...new Set(merged.filter(m => m.kind === 'family').map(m => m.r.person_id as string))];
  const filterSeasonIds = [...(sendSeasons.data ?? []), ...(messageSeasons.data ?? [])].map(r => r.season_id as string);
  const [nameOf, people, seasons] = await Promise.all([
    resolvePersonNamer(orgId, merged.map(m => m.r.sent_by)),
    personIds.length
      ? supabaseAdmin.from('org_people').select('id, first_name, last_name, email_normalized').eq('org_id', orgId).in('id', personIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    seasonNames(orgId, [...filterSeasonIds, ...merged.map(m => m.r.season_id).filter(Boolean)]),
  ]);
  if (people.error) throw people.error;
  // A family with no name on file reads "A family", never its address (legal §2c, T17).
  // A league seat reads a one-family row as its season's own list shows it: "the Patel family", never a first name.
  const familyName = new Map((people.data ?? []).map((p: any) => [p.id as string,
    reader.scope === 'league' ? (p.last_name ? SW.oneFamilyTo(p.last_name) : W.nameless) : familyNameOf(p)]));

  const now = Date.now();
  // A season's email names its season (9d1·7): "Dev House League 2026 · Jays".
  const named = (seasonId: string | null, to: string) => {
    const s = seasonId ? seasons.get(seasonId) : null;
    return s ? SW.seasonTo(s, to) : to;
  };
  const rows: EmailLogRow[] = merged.map(m => m.kind === 'club'
    ? clubRow(m.r, nameOf(m.r.sent_by), now, named(m.r.season_id, m.r.audience_label))
    : {
      key: `family:${m.r.id}`, kind: 'family', id: m.r.id, sentAt: m.r.sent_at, subject: null, seasonId: m.r.season_id ?? null,
      to: named(m.r.season_id, familyName.get(m.r.person_id) ?? W.nameless), by: nameOf(m.r.sent_by), counts: null, state: 'done',
    });
  // More to read when either source filled its page, or the merge left rows over (they are older than the cursor).
  const clubN = clubRows.data?.length ?? 0;
  const familyN = familyRows.data?.length ?? 0;
  const more = clubN === EMAILS_PAGE || familyN === EMAILS_PAGE || clubN + familyN > rows.length;
  return {
    rows, total: (clubTotal.count ?? 0) + (familyTotal.count ?? 0),
    next: more && rows.length > 0 ? rows[rows.length - 1].sentAt : null,
    seasons: [...new Set(filterSeasonIds)].map(id => ({ id, name: seasons.get(id) ?? '' })).filter(s => s.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** One typed email, as sent: its words, its counts, and — since 9d-1 — the families it missed and those who opted out
 *  (named one to three), and how many a stopped email could still reach. */
export interface ClubEmailRecord extends EmailLogRow {
  /** '' once the retention clock deleted the words (12 months after the send; mig 492) — `wordsCleared` says so. */
  body: string;
  wordsCleared: boolean;
  missed: number;
  /** ABSENT (not null, not hidden) for a reader who may not see this email's names (ask 4, T12). */
  missedNamed?: string | null;
  optedOutNamed?: string | null;
}

/** One typed email for THIS reader: null when they may not read it (the route answers Not found). */
export async function readClubEmail(orgId: string, sendId: string, reader: FamilyLogReader = EVERY_READER): Promise<ClubEmailRecord | null> {
  const { data, error } = await supabaseAdmin.from('family_email_sends')
    .select(`${CLUB_COLS}, body, words_cleared_at`).eq('org_id', orgId).eq('id', sendId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!familySendReadable(reader, data as any)) return null;
  const names = familyNamesShown(reader, data as any);
  const [nameOf, recipients, seasons] = await Promise.all([
    resolvePersonNamer(orgId, [data.sent_by]),
    // A reader who may not see names never has them read (the counts below come from the row itself, `clubRow`).
    names ? supabaseAdmin.from('family_email_recipients').select('family_name, status').eq('send_id', sendId)
      : supabaseAdmin.from('family_email_recipients').select('status').eq('send_id', sendId),
    seasonNames(orgId, data.season_id ? [data.season_id] : []),
  ]);
  if (recipients.error) throw recipients.error;
  const rows = (recipients.data ?? []) as { family_name?: string | null; status: string }[];
  const missed = rows.filter(r => r.status === 'pending' || r.status === 'failed');
  const optedOut = rows.filter(r => r.status === 'opted_out');
  const season = data.season_id ? seasons.get(data.season_id) : null;
  return {
    ...clubRow(data, nameOf(data.sent_by), Date.now(), season ? SW.seasonTo(season, data.audience_label) : data.audience_label),
    body: data.body ?? '',
    wordsCleared: !!data.words_cleared_at,
    missed: missed.length,
    ...(names ? {
      missedNamed: familiesNamed(missed.map(r => r.family_name ?? null)),
      optedOutNamed: familiesNamed(optedOut.map(r => r.family_name ?? null)),
    } : {}),
  };
}

/** The season's sent history (frame e): its own typed emails, one-family messages and automatic notices, newest first;
 *  and the old log, read-only, apart. */
export interface SeasonHistory {
  rows: EmailLogRow[];
  earlier: EmailLogRow[];
}

const SEASON_HISTORY_MAX = 200;

export async function readSeasonHistory(orgId: string, seasonId: string): Promise<SeasonHistory> {
  const [sends, messages, notices, old] = await Promise.all([
    supabaseAdmin.from('family_email_sends').select(CLUB_COLS).eq('org_id', orgId).eq('season_id', seasonId)
      .order('sent_at', { ascending: false }).limit(SEASON_HISTORY_MAX),
    supabaseAdmin.from('family_messages').select('id, sent_at, sent_by, person_id').eq('org_id', orgId).eq('season_id', seasonId)
      .order('sent_at', { ascending: false }).limit(SEASON_HISTORY_MAX),
    supabaseAdmin.from('league_season_notices').select('id, kind, division_id, family_count, reached_count, failed_count, skipped_count, created_by, created_at')
      .eq('org_id', orgId).eq('season_id', seasonId).order('created_at', { ascending: false }).limit(SEASON_HISTORY_MAX),
    // ⚠ READ-ONLY (9d1·3): nothing writes league_email_log again. A read that fails hides the old rows, never the page.
    getLeagueEmailLog(seasonId).catch(() => []),
  ]);
  for (const r of [sends, messages, notices]) if (r.error) throw r.error;

  const personIds = [...new Set((messages.data ?? []).map(m => m.person_id as string))];
  const divisionIds = [...new Set((notices.data ?? []).map(n => n.division_id).filter(Boolean) as string[])];
  const [nameOf, people, divisions] = await Promise.all([
    resolvePersonNamer(orgId, [
      ...(sends.data ?? []).map(r => r.sent_by), ...(messages.data ?? []).map(r => r.sent_by),
      ...(notices.data ?? []).map(r => r.created_by), ...old.map(r => r.sentBy),
    ]),
    personIds.length
      ? supabaseAdmin.from('org_people').select('id, first_name, last_name, email_normalized').eq('org_id', orgId).in('id', personIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    divisionIds.length
      ? supabaseAdmin.from('league_divisions').select('id, name').eq('season_id', seasonId).in('id', divisionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (people.error) throw people.error;
  if (divisions.error) throw divisions.error;
  const familyOf = new Map((people.data ?? []).map((p: any) => [p.id as string, p.last_name ? SW.oneFamilyTo(p.last_name) : familyNameOf(p)]));
  const divisionOf = new Map((divisions.data ?? []).map((d: any) => [d.id as string, d.name as string]));
  const inFlight = await noticesSending((notices.data ?? []).filter(n => n.failed_count > 0).map(n => n.id as string));

  const now = Date.now();
  const rows: EmailLogRow[] = [
    ...(sends.data ?? []).map(r => clubRow(r, nameOf(r.sent_by), now)),
    ...(messages.data ?? []).map((m): EmailLogRow => ({
      key: `family:${m.id}`, kind: 'family', id: m.id, sentAt: m.sent_at, subject: null, seasonId,
      to: familyOf.get(m.person_id) ?? W.nameless, by: nameOf(m.sent_by), counts: null, state: 'done',
    })),
    ...(notices.data ?? []).map((n): EmailLogRow => {
      const division = n.division_id ? divisionOf.get(n.division_id) ?? null : null;
      const kind = n.kind as NoticeKind;
      return {
        key: `notice:${n.id}`, kind: 'notice', id: n.id, sentAt: n.created_at, seasonId,
        ...noticeFace(kind, division, n.family_count, n.reached_count),
        noticeKind: kind, division, skipped: kind === 'team_changes' ? (n.skipped_count as number) : undefined, by: nameOf(n.created_by), state: noticeState(kind, n, inFlight),
        counts: { families: n.family_count, reached: n.reached_count, optedOut: 0, failed: n.failed_count, coaches: 0 },
      };
    }),
  ].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const bare: Record<string, string> = { division: SW.division, team: SW.teams, status: SW.status };
  const earlier: EmailLogRow[] = old.map(o => ({
    key: `earlier:${o.id}`, kind: 'earlier', id: o.id, sentAt: o.sentAt, subject: o.subject, seasonId,
    to: bare[o.audience] ? SW.notRecorded(bare[o.audience]) : o.audience, by: nameOf(o.sentBy), counts: null, state: 'done',
    oldReached: SW.oldReached(o.countSent, o.countSkipped),
  }));
  return { rows, earlier };
}
