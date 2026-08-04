'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import Link from 'next/link';
import { Telescope, Check, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  recordChip, recordTone, resultLetter,
  OPPONENT_SUMMARY_MAX, OPPONENT_OBSERVATION_MAX, type OpponentBookEntry,
} from '@/lib/coach-opponents';
import type { RepTeamOpponentObservation } from '@/lib/types';
import { formatInOrgZone } from '@/lib/timezone';
import styles from '../../../../../coaches.module.css';

/** One observation row — shared by the per-meeting and "General" groups so the shape
 *  (author chip, tag, eraser) can never drift between them. */
function ObservationRow({ o, showDate, manyAuthors, canErase, onRemove }: {
  o: RepTeamOpponentObservation;
  showDate: boolean;
  manyAuthors: boolean;
  canErase: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className={styles.scoutObs}>
      <span className={styles.scoutObsBody}>
        {o.body}
        {manyAuthors && o.createdByName && <span className={styles.scoutObsAuthor}> — {o.createdByName}</span>}
        {showDate && <span className={styles.scoutObsAuthor}> · {formatInOrgZone(o.createdAt, { month: 'short', day: 'numeric' })}</span>}
      </span>
      {o.tag && <span className={styles.scoutObsTag}>{o.tag}</span>}
      {canErase && (
        <button type="button" className={styles.scoutObsDelete} aria-label="Remove observation" title="Remove observation" onClick={() => onRemove(o.id)}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

interface CardPayload {
  opponent: OpponentBookEntry;
  observations: RepTeamOpponentObservation[];
  tags: string[];
  canWriteSummary: boolean;
  isHeadCoach: boolean;
  viewerId: string;
}

// One opponent's book: record + meetings across every season, the observation log, and
// "the book line". Everything a schedule-holder can read; the book line is notes-gated;
// observation deletion is head-coach-any / author-own (the eraser).
export default function CoachOpponentCardPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }>;
}) {
  const { orgSlug, teamId, opponentKey } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/opponents/${opponentKey}`;

  const [data, setData] = useState<CardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [obsBody, setObsBody] = useState('');
  const [obsTag, setObsTag] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load this opponent');
      const payload: CardPayload = await res.json();
      setData(payload);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load this opponent');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Derived groupings, memoized so keystrokes in the two textareas don't rebuild them.
  // Must sit above the early returns (rules of hooks), so it null-guards `data` itself.
  const derived = useMemo(() => {
    const meetings = data?.opponent.meetings ?? [];
    const observations = data?.observations ?? [];
    const shownObs = filterTag ? observations.filter(o => o.tag === filterTag) : observations;
    const obsByEvent = new Map<string, RepTeamOpponentObservation[]>();
    const generalObs: RepTeamOpponentObservation[] = [];
    for (const o of shownObs) {
      if (o.eventId && meetings.some(m => m.eventId === o.eventId)) {
        const list = obsByEvent.get(o.eventId) ?? [];
        list.push(o);
        obsByEvent.set(o.eventId, list);
      } else {
        generalObs.push(o);
      }
    }
    const seasons: { year: string; meetings: typeof meetings }[] = [];
    for (const m of meetings) {
      const year = formatInOrgZone(m.startsAt, { year: 'numeric' });
      const bucket = seasons.find(s => s.year === year);
      if (bucket) bucket.meetings.push(m); else seasons.push({ year, meetings: [m] });
    }
    return { obsByEvent, generalObs, seasons };
  }, [data, filterTag]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) return <div className={styles.notAssigned}>You are not assigned to this team.</div>;
  if (loading) return <div className={styles.loadingState}>Loading…</div>;
  if (error || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error || 'Could not load this opponent'}</p>
        <Link href={`${base}/history/opponents`} className={styles.scoutBackLink}>‹ All opponents</Link>
      </div>
    );
  }

  const { opponent, observations, tags } = data;
  const summaryValue = summaryDraft ?? opponent.summary ?? '';

  async function saveSummary() {
    if (summaryDraft === null || summaryDraft.trim() === (opponent.summary ?? '')) { setSummaryDraft(null); return; }
    setSummaryStatus('saving');
    try {
      const res = await fetch(apiBase, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryDraft, displayName: opponent.displayName }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save');
      setSummaryStatus('saved');
      setSummaryDraft(null);
      await load();
    } catch {
      setSummaryStatus('error');
    }
  }

  async function logObservation() {
    const body = obsBody.trim();
    if (!body) return;
    setLogging(true);
    setLogError('');
    try {
      const res = await fetch(`${apiBase}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, tag: obsTag, opponentName: opponent.displayName }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save the observation');
      setObsBody('');
      setObsTag(null);
      await load();
    } catch (e: unknown) {
      setLogError(e instanceof Error ? e.message : 'Could not save the observation');
    } finally {
      setLogging(false);
    }
  }

  async function removeObservation(id: string) {
    try {
      const res = await fetch(`${apiBase}/observations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      /* leave the row; a failed delete is visible by its persistence */
    }
  }

  const canErase = (o: RepTeamOpponentObservation) =>
    data.isHeadCoach || (o.createdBy != null && o.createdBy === data.viewerId);
  const manyAuthors = new Set(observations.map(o => o.createdByName ?? '?')).size > 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Telescope size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>{opponent.displayName}</h1>
            <p className={styles.pageSub}>
              <Link href={`${base}/history/opponents`} className={styles.scoutBackLink}>‹ All opponents</Link>
            </p>
          </div>
        </div>
        <span className={styles.scoutRecChip} data-tone={recordTone(opponent.record)}>
          {recordChip(opponent.record)}
        </span>
      </div>

      <div className={styles.scoutStatRow}>
        <div className={styles.scoutStat}>
          <span className={styles.scoutStatV}>{opponent.unitFor}</span>
          <span className={styles.scoutStatL}>{sportPack.score.forAbbr} · {sportPack.score.unitPlural.toLowerCase()} for</span>
        </div>
        <div className={styles.scoutStat}>
          <span className={styles.scoutStatV}>{opponent.unitAgainst}</span>
          <span className={styles.scoutStatL}>{sportPack.score.againstAbbr} · against</span>
        </div>
        <div className={styles.scoutStat}>
          <span className={styles.scoutStatV}>{opponent.streak ?? '—'}</span>
          <span className={styles.scoutStatL}>streak</span>
        </div>
      </div>
      {opponent.scrimmageCount > 0 && (
        <p className={styles.scoutFootnote}>
          + {opponent.scrimmageCount} scrimmage{opponent.scrimmageCount === 1 ? '' : 's'} listed below — never counted in the record.
        </p>
      )}

      {/* The book line — the coach's distilled read; what every glance surface shows first. */}
      <div className={styles.scoutBookLine}>
        <div className={styles.scoutBookHead}>
          <span className={styles.scoutBookLabel}>The book line</span>
          <span className={styles.saveStatus} aria-live="polite">
            {summaryStatus === 'saving' ? 'Saving…'
              : summaryStatus === 'error' ? <button type="button" className={styles.saveRetry} onClick={saveSummary}>Couldn’t save · Retry</button>
              : summaryStatus === 'saved' ? <><Check size={13} /> Saved</>
              : null}
          </span>
        </div>
        {data.canWriteSummary ? (
          <textarea
            className={styles.scoutBookInput}
            value={summaryValue}
            maxLength={OPPONENT_SUMMARY_MAX}
            placeholder="Your one-sentence read on this team — what you'd tell an assistant five minutes before the game."
            onChange={e => { setSummaryDraft(e.target.value); setSummaryStatus('idle'); }}
            onBlur={saveSummary}
            rows={2}
          />
        ) : (
          <p className={styles.scoutBookRead}>
            {opponent.summary ?? 'Nothing in the book line yet.'}
          </p>
        )}
        {opponent.lastNoteUpdatedAt && summaryStatus === 'idle' && (
          <span className={styles.scoutBookMeta}>updated {formatInOrgZone(opponent.lastNoteUpdatedAt, { month: 'short', day: 'numeric' })}</span>
        )}
      </div>

      {/* Log an observation — open to every schedule-holder, attributed (owner-ratified). */}
      <div className={styles.scoutLog}>
        <textarea
          className={styles.scoutLogInput}
          value={obsBody}
          maxLength={OPPONENT_OBSERVATION_MAX}
          placeholder="Log an observation — one line, e.g. “their SS cheats up with runners on”"
          onChange={e => setObsBody(e.target.value)}
          rows={2}
        />
        <div className={styles.scoutTagRow}>
          {tags.map(t => (
            <button
              key={t}
              type="button"
              className={styles.scoutTagChip}
              data-on={obsTag === t ? 'yes' : 'no'}
              onClick={() => setObsTag(obsTag === t ? null : t)}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            className={`btn btn-lime ${styles.scoutLogSave}`}
            disabled={logging || obsBody.trim().length === 0}
            onClick={logObservation}
          >
            {logging ? 'Saving…' : 'Save observation'}
          </button>
        </div>
        <p className={styles.scoutFootnote}>
          Refer to opposing players by jersey number or position, never by name — they’re someone else’s kids.
        </p>
        {logError && <p className={styles.errorText}>{logError}</p>}
      </div>

      {/* Filter + timeline */}
      {observations.length > 0 && (
        <div className={styles.scoutTagRow} role="group" aria-label="Filter observations by tag">
          <button type="button" className={styles.scoutTagChip} data-on={filterTag === null ? 'yes' : 'no'} onClick={() => setFilterTag(null)}>All</button>
          {tags.filter(t => observations.some(o => o.tag === t)).map(t => (
            <button key={t} type="button" className={styles.scoutTagChip} data-on={filterTag === t ? 'yes' : 'no'} onClick={() => setFilterTag(t)}>{t}</button>
          ))}
        </div>
      )}

      {opponent.meetings.length === 0 && observations.length === 0 && (
        <p className={styles.scoutFootnote}>No games against {opponent.displayName} on file yet — observations you log now will be waiting when you meet them.</p>
      )}

      {derived.seasons.map(s => (
        <div key={s.year} className={styles.scoutSeason}>
          <div className={styles.scoutSeasonLabel}>{s.year} season</div>
          {s.meetings.map(m => (
            <div key={m.eventId} className={styles.scoutMeeting}>
              <div className={styles.scoutMeetingRow}>
                <span className={styles.scoutMeetingRes} data-r={m.result ?? 'none'}>{resultLetter(m.result)}</span>
                <span className={styles.scoutMeetingScore}>
                  {m.teamScore != null && m.opponentScore != null ? `${m.teamScore}–${m.opponentScore}` : '—'}
                </span>
                <span className={styles.scoutMeetingName}>
                  {m.name}
                  {m.eventType === 'scrimmage' && <span className={styles.scoutExh}>EXH</span>}
                </span>
                <span className={styles.scoutMeetingDate}>{formatInOrgZone(m.startsAt, { month: 'short', day: 'numeric' })}</span>
              </div>
              {(derived.obsByEvent.get(m.eventId) ?? []).map(o => (
                <ObservationRow key={o.id} o={o} showDate={false} manyAuthors={manyAuthors} canErase={canErase(o)} onRemove={removeObservation} />
              ))}
            </div>
          ))}
        </div>
      ))}

      {derived.generalObs.length > 0 && (
        <div className={styles.scoutSeason}>
          <div className={styles.scoutSeasonLabel}>General</div>
          {derived.generalObs.map(o => (
            <ObservationRow key={o.id} o={o} showDate manyAuthors={manyAuthors} canErase={canErase(o)} onRemove={removeObservation} />
          ))}
        </div>
      )}
    </div>
  );
}
