'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Check, Share2, Trophy, Library } from 'lucide-react';
import { formatInOrgZone } from '@/lib/timezone';
import {
  recordChip, recordTone, resultLetter, normalizeOpponentName,
  OPPONENT_OBSERVATION_MAX, type OpponentBookEntry,
} from '@/lib/coach-opponents';
import { ordinal } from '@/lib/playoff-bracket';
import type { OpponentTournamentIntel, OpponentTournamentIntelGame } from '@/lib/coach-tournament-intel';
import type { RepTeamOpponentObservation } from '@/lib/types';
import ScoutTagFilter from './ScoutTagFilter';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/** The intel payload as the route serves it — the pure shape, whose results additionally
 *  carry the two schedule labels the route attaches. Only that field is re-stated, so the
 *  pinned server shape stays the single definition. */
type TournamentIntel = Omit<OpponentTournamentIntel, 'results'> & {
  results: (OpponentTournamentIntelGame & { dateLabel: string; timeLabel: string | null })[];
};

/** Four fetch sites in this file share one error idiom — one copy of it, not four. */
async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? fallback);
}

/**
 * The schedule drawer's Scouting tab — the GLANCE surface of the Opponent Scouting Book
 * (deep home: Insights → Opponents). Self-contained: fetches the opponent card itself so
 * the schedule page's already-large orchestration gains no new data shape. Also the
 * capture surface for "log an observation" against THIS game (open contribution,
 * attributed — owner-ratified 2026-08-04).
 */
export default function OpponentScoutingPanel({
  orgSlug, teamId, eventId, opponentName, mirrored = false,
}: {
  orgSlug: string;
  teamId: string;
  /** The game this tab is open on — new observations link to it. */
  eventId: string;
  opponentName: string;
  /** Mirrored tournament game? Only then does "Their tournament so far" have a source (P3). */
  mirrored?: boolean;
}) {
  const key = encodeURIComponent(normalizeOpponentName(opponentName));
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/opponents/${key}`;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<{
    opponent: OpponentBookEntry;
    observations: RepTeamOpponentObservation[];
    tags: string[];
    canShareToStaffChat?: boolean;
    /** Club Shared Book: only the COUNT — the drawer stays a glance and renders no sibling
     *  prose (plan §4.3), so it asks the card route for `?club=count` and the server skips
     *  assembling blocks it would only throw away. */
    clubObservationCount?: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [obsBody, setObsBody] = useState('');
  const [obsTag, setObsTag] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  /** Tag filter over the log (P2, mockup Stage 6) — mirrors the card page's filter. */
  const [filterTag, setFilterTag] = useState<string | null>(null);
  /** How many observations went in THIS sitting (S5) — the saved-line + add-another cue. */
  const [savedCount, setSavedCount] = useState(0);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const obsInputRef = useRef<HTMLTextAreaElement>(null);
  // Synchronous re-entry guards: `disabled` reflects committed state, so a fast double-tap
  // fires twice before the re-render — and neither POST is idempotent (two identical
  // observations / two chat snapshots).
  const busyRef = useRef({ log: false, share: false });

  // The panel unmounts on every tab/event switch; a slow fetch resolving afterwards must
  // not call setState on the corpse. One ref covers both load() and logObservation().
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      // `?club=count` — this tab shows the club's NUMBER and none of its prose, so it asks the
      // server not to assemble what it would discard. Every other field is unchanged.
      const res = await fetch(`${apiBase}?club=count`);
      await throwIfNotOk(res, 'Could not load the book');
      const payload = await res.json();
      if (!mountedRef.current) return;
      setData(payload);
      setError('');
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load the book');
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  /**
   * "Their tournament so far" (P3) — assembled server-side from the SAME tournament's
   * organizer data, refreshed every time the tab opens (that's the point: Sunday's tab
   * carries this morning's scores). Fails soft in both directions: a blip costs the block,
   * never the tab, and `{ intel: null }` (external tournament, no results yet) is a state
   * — the block is simply absent, not apologized for.
   */
  const [intel, setIntel] = useState<TournamentIntel | null>(null);
  useEffect(() => {
    // Non-mirrored games never fetch, and the render below gates on `mirrored` too — no
    // state reset needed here (the panel remounts per event; see the mountedRef note above).
    if (!mirrored) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/tournament-intel`);
        if (!res.ok) return;
        const payload = await res.json();
        if (live && mountedRef.current) setIntel(payload.intel ?? null);
      } catch { /* absent, never an error state */ }
    })();
    return () => { live = false; };
  }, [mirrored, orgSlug, teamId, eventId]);

  async function logObservation() {
    const body = obsBody.trim();
    if (!body || busyRef.current.log) return;
    busyRef.current.log = true;
    setLogging(true);
    try {
      const res = await fetch(`${apiBase}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, tag: obsTag, eventId, opponentName }),
      });
      await throwIfNotOk(res, 'Could not save');
      if (!mountedRef.current) return;
      setObsBody('');
      setObsTag(null);
      // The one-sitting loop (S5, mockup 1b): confirm in place and hand the keyboard back —
      // several observations in a row without re-finding the input.
      setSavedCount(c => c + 1);
      obsInputRef.current?.focus();
      await load();
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      busyRef.current.log = false;
      if (mountedRef.current) setLogging(false);
    }
  }

  async function shareToStaffChat() {
    if (busyRef.current.share) return;
    busyRef.current.share = true;
    setShareStatus('sharing');
    try {
      const res = await fetch(`${apiBase}/share-to-staff-chat`, { method: 'POST' });
      await throwIfNotOk(res, 'Could not share');
      if (mountedRef.current) setShareStatus('shared');
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setShareStatus('error');
      setError(e instanceof Error ? e.message : 'Could not share');
    } finally {
      busyRef.current.share = false;
    }
  }

  if (error && !data) return <p className={styles.errorText}>{error}</p>;
  if (!data) return <div className={styles.loadingState}>Loading…</div>;

  const { opponent, observations, tags } = data;
  // Tag chips filter the log (All + only tags in use), exactly as the card page does.
  const usedTags = tags.filter(t => observations.some(o => o.tag === t));
  const shownObs = filterTag ? observations.filter(o => o.tag === filterTag) : observations;
  const latest = shownObs.slice(0, 2);
  // One day of intel results → clock times tell them apart; a multi-day event → dates do.
  const intelSameDay = intel ? new Set(intel.results.map(r => r.gameDate ?? '')).size <= 1 : true;

  return (
    <div className={styles.scoutPanel}>
      <div className={styles.scoutPanelHead}>
        <span className={styles.scoutPanelTitle}>All-time vs {opponent.displayName}</span>
        <span className={styles.scoutRecChip} data-tone={recordTone(opponent.record)}>{recordChip(opponent.record)}</span>
      </div>

      {opponent.lastMeeting && opponent.lastMeeting.result && (
        <div className={styles.scoutMeetingRow}>
          <span className={styles.scoutMeetingRes} data-r={opponent.lastMeeting.result}>
            {resultLetter(opponent.lastMeeting.result)}
          </span>
          <span className={styles.scoutMeetingScore}>
            {opponent.lastMeeting.teamScore != null ? `${opponent.lastMeeting.teamScore}–${opponent.lastMeeting.opponentScore}` : '—'}
          </span>
          <span className={styles.scoutMeetingName}>Last meeting</span>
          <span className={styles.scoutMeetingDate}>{formatInOrgZone(opponent.lastMeeting.startsAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      )}

      {opponent.summary ? (
        <div className={styles.scoutBookLine}>
          <span className={styles.scoutBookLabel}>The book line</span>
          <p className={styles.scoutBookRead}>{opponent.summary}</p>
        </div>
      ) : (
        <p className={styles.scoutFootnote}>Nothing in the book line yet — the full page has the editor.</p>
      )}

      {mirrored && intel && (
        <div className={styles.scoutIntel}>
          <span className={styles.scoutIntelLabel}>
            <Trophy size={11} aria-hidden /> Their tournament so far
          </span>
          {intel.results.map(r => (
            <div key={r.gameId} className={`${styles.scoutMeetingRow} ${styles.scoutIntelRow}`}>
              <span className={styles.scoutMeetingRes} data-r={r.result}>{resultLetter(r.result)}</span>
              <span className={styles.scoutMeetingScore}>{r.theirScore}–{r.otherScore}</span>
              <span className={styles.scoutIntelOpp}>
                vs {r.otherTeamName}
                {/* The scoreline is a nominal margin, and the totals below skip it — say so. */}
                {r.isForfeit && <span className={styles.scoutIntelFlag}>forfeit</span>}
              </span>
              <span className={styles.scoutMeetingDate}>{intelSameDay ? (r.timeLabel ?? r.dateLabel) : r.dateLabel}</span>
            </div>
          ))}
          <p className={styles.scoutIntelStanding}>
            {intel.standing
              ? `${ordinal(intel.standing.rank)} ${intel.standing.poolName ? `in ${intel.standing.poolName}` : 'in their division'} · `
              : ''}
            {intel.unitFor} for / {intel.unitAgainst} against
          </p>
          <p className={styles.scoutIntelSource}>
            From {intel.tournamentName}&rsquo;s live results — refreshed each time you open this.
          </p>
        </div>
      )}

      <ScoutTagFilter tags={usedTags} value={filterTag} onChange={setFilterTag} />

      {latest.map(o => (
        <div key={o.id} className={styles.scoutObs}>
          <span className={styles.scoutObsBody}>
            {o.body}
            {o.createdByName && <span className={styles.scoutObsAuthor}> — {o.createdByName}</span>}
          </span>
          {o.tag && <span className={styles.scoutObsTag}>{o.tag}</span>}
        </div>
      ))}
      {shownObs.length > 2 && (
        <p className={styles.scoutFootnote}>+ {shownObs.length - 2} more on the full page.</p>
      )}

      {/* Club Shared Book (mockup 8c) — ONE quiet line, only when the club actually has
          something, deep-linking to the card's club section. No sibling prose inline: the
          drawer is Friday night's glance, and the masthead nudge + practice bridge keep
          speaking for this team's own book only. */}
      {(data.clubObservationCount ?? 0) > 0 && (
        <Link href={`${base}/history/opponents/${key}#club`} className={styles.scoutClubTease}>
          <Library size={13} aria-hidden />
          Your club has {data.clubObservationCount} more observation
          {data.clubObservationCount === 1 ? '' : 's'} on {opponent.displayName} ›
        </Link>
      )}

      {savedCount > 0 && (
        <p className={styles.scoutSavedLine} aria-live="polite">
          <Check size={12} aria-hidden /> {savedCount === 1 ? 'Saved' : `${savedCount} saved this sitting`} — add another?
        </p>
      )}
      <textarea
        ref={obsInputRef}
        className={styles.scoutLogInput}
        value={obsBody}
        maxLength={OPPONENT_OBSERVATION_MAX}
        placeholder="Log an observation from this game — numbers and positions, never opposing players’ names"
        onChange={e => setObsBody(e.target.value)}
        rows={2}
      />
      {/* ⚖ A DROPDOWN, NOT A PILL ROW (owner, §129 walk F2, 2026-09-02 — the standing
          form-selects-are-dropdowns ruling reaches the last pill-row select). The vocabulary is
          the FIXED sport-pack list; a tag is optional, and "No tag" is a complete answer. */}
      <select
        className={styles.select}
        value={obsTag ?? ''}
        aria-label="Tag this observation"
        onChange={e => setObsTag(e.target.value || null)}
      >
        <option value="">No tag</option>
        {tags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {error && data && <p className={styles.errorText}>{error}</p>}
      <div className={styles.scoutPanelLinks}>
        <button type="button" className={styles.scoutPanelLink} disabled={logging || obsBody.trim().length === 0} onClick={logObservation}>
          {logging ? 'Saving…' : 'Save observation'}
        </button>
        {data.canShareToStaffChat && (
          <button type="button" className={styles.scoutPanelLink} disabled={shareStatus === 'sharing'} onClick={shareToStaffChat}>
            <Share2 size={12} aria-hidden />{' '}
            {shareStatus === 'sharing' ? 'Sharing…' : shareStatus === 'shared' ? 'Shared ✓' : 'Share to staff chat'}
          </button>
        )}
        <Link href={`${base}/history/opponents/${key}`} className={styles.scoutPanelLink}>
          Everything we know ›
        </Link>
      </div>
    </div>
  );
}
