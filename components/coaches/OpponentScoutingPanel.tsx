'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { formatInOrgZone } from '@/lib/timezone';
import {
  recordChip, recordTone, resultLetter, normalizeOpponentName,
  OPPONENT_OBSERVATION_MAX, type OpponentBookEntry,
} from '@/lib/coach-opponents';
import type { RepTeamOpponentObservation } from '@/lib/types';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The schedule drawer's Scouting tab — the GLANCE surface of the Opponent Scouting Book
 * (deep home: Insights → Opponents). Self-contained: fetches the opponent card itself so
 * the schedule page's already-large orchestration gains no new data shape. Also the
 * capture surface for "log an observation" against THIS game (open contribution,
 * attributed — owner-ratified 2026-08-04).
 */
export default function OpponentScoutingPanel({
  orgSlug, teamId, eventId, opponentName,
}: {
  orgSlug: string;
  teamId: string;
  /** The game this tab is open on — new observations link to it. */
  eventId: string;
  opponentName: string;
}) {
  const key = encodeURIComponent(normalizeOpponentName(opponentName));
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/opponents/${key}`;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<{
    opponent: OpponentBookEntry;
    observations: RepTeamOpponentObservation[];
    tags: string[];
  } | null>(null);
  const [error, setError] = useState('');
  const [obsBody, setObsBody] = useState('');
  const [obsTag, setObsTag] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  // The panel unmounts on every tab/event switch; a slow fetch resolving afterwards must
  // not call setState on the corpse. One ref covers both load() and logObservation().
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load the book');
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

  async function logObservation() {
    const body = obsBody.trim();
    if (!body) return;
    setLogging(true);
    try {
      const res = await fetch(`${apiBase}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, tag: obsTag, eventId, opponentName }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save');
      if (!mountedRef.current) return;
      setObsBody('');
      setObsTag(null);
      await load();
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      if (mountedRef.current) setLogging(false);
    }
  }

  if (error && !data) return <p className={styles.errorText}>{error}</p>;
  if (!data) return <div className={styles.loadingState}>Loading…</div>;

  const { opponent, observations, tags } = data;
  const latest = observations.slice(0, 2);

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

      {latest.map(o => (
        <div key={o.id} className={styles.scoutObs}>
          <span className={styles.scoutObsBody}>
            {o.body}
            {o.createdByName && <span className={styles.scoutObsAuthor}> — {o.createdByName}</span>}
          </span>
          {o.tag && <span className={styles.scoutObsTag}>{o.tag}</span>}
        </div>
      ))}
      {observations.length > 2 && (
        <p className={styles.scoutFootnote}>+ {observations.length - 2} more on the full page.</p>
      )}

      <textarea
        className={styles.scoutLogInput}
        value={obsBody}
        maxLength={OPPONENT_OBSERVATION_MAX}
        placeholder="Log an observation from this game — numbers and positions, never opposing players’ names"
        onChange={e => setObsBody(e.target.value)}
        rows={2}
      />
      <div className={styles.scoutTagRow}>
        {tags.map(t => (
          <button key={t} type="button" className={styles.scoutTagChip} data-on={obsTag === t ? 'yes' : 'no'} onClick={() => setObsTag(obsTag === t ? null : t)}>
            {t}
          </button>
        ))}
      </div>
      {error && data && <p className={styles.errorText}>{error}</p>}
      <div className={styles.scoutPanelLinks}>
        <button type="button" className={styles.scoutPanelLink} disabled={logging || obsBody.trim().length === 0} onClick={logObservation}>
          {logging ? 'Saving…' : 'Save observation'}
        </button>
        <Link href={`${base}/history/opponents/${key}`} className={styles.scoutPanelLink}>
          Everything we know ›
        </Link>
      </div>
    </div>
  );
}
