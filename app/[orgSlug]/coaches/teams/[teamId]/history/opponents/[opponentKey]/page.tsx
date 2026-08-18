'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use } from 'react';
import { Telescope, Check, X, Share2, GitMerge } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  recordChip, recordTone, resultLetter,
  OPPONENT_SUMMARY_MAX, OPPONENT_OBSERVATION_MAX, type OpponentBookEntry,
} from '@/lib/coach-opponents';
import type { OpponentInsightLine } from '@/lib/coach-opponent-insights';
import {
  CLUB_TEAM_PREVIEW_COUNT, clubTeamExpanderLabel, clubObservationAttribution,
  type ClubBookBlock, type ClubBookTeamBlock,
} from '@/lib/coach-club-book';
import type { RepTeamOpponentObservation } from '@/lib/types';
import { formatInOrgZone } from '@/lib/timezone';
import ScoutTagFilter from '@/components/coaches/ScoutTagFilter';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import styles from '../../../../../coaches.module.css';

/** Seven fetch sites in this file share one error idiom — one copy of it, not seven. */
async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? fallback);
}

/** The "Same team as…" flow is one linear walk — closed → picking → confirming — so it is
 *  ONE state, not five booleans that could disagree about where the coach is. */
type MergeFlow =
  | { step: 'closed' }
  | { step: 'picking'; candidates: OpponentBookEntry[] | null }
  | { step: 'confirming'; target: OpponentBookEntry; merging: boolean };

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

/**
 * One sibling team's block in "From your club" (mockup 8b) — READ-ONLY by construction: there
 * is no eraser, no editor and no tag filter here, because curation stays with the team that
 * wrote the words. Amber spine marks it as someone else's voice.
 */
function ClubTeamBlock({ block }: { block: ClubBookTeamBlock }) {
  const [expanded, setExpanded] = useState(false);
  const expander = clubTeamExpanderLabel(block);
  const shown = expanded ? block.observations : block.observations.slice(0, CLUB_TEAM_PREVIEW_COUNT);

  return (
    <div className={styles.scoutClubTeam}>
      <div className={styles.scoutClubTeamHead}>
        <span className={styles.scoutClubTeamName}>{block.teamName}</span>
        <span className={styles.scoutRecChip} data-tone={recordTone(block.record)}>
          {recordChip(block.record)}
        </span>
      </div>
      {block.summary && (
        <div className={`${styles.scoutBookLine} ${styles.scoutClubBookLine}`}>
          <span className={styles.scoutBookLabel}>Their book line</span>
          <p className={styles.scoutBookRead}>{block.summary}</p>
        </div>
      )}
      {shown.map(o => (
        <div key={o.id} className={styles.scoutObs}>
          <span className={styles.scoutObsBody}>
            {o.body}
            <span className={styles.scoutObsAuthor}> — {clubObservationAttribution(o, block.teamName)}</span>
          </span>
          {o.tag && <span className={styles.scoutObsTag}>{o.tag}</span>}
        </div>
      ))}
      {expander && !expanded && (
        <button type="button" className={styles.scoutPanelLink} onClick={() => setExpanded(true)}>
          {expander}
        </button>
      )}
    </div>
  );
}

/** "From your club" — absent entirely when the club has nothing, never an empty shell. */
function ClubSection({ club }: { club: ClubBookBlock }) {
  return (
    <div id="club" className={styles.scoutSeason}>
      <div className={styles.scoutSeasonLabel}>From your club</div>
      {club.teams.map(t => <ClubTeamBlock key={t.teamId} block={t} />)}
      <p className={styles.scoutFootnote}>
        Shared by your club&rsquo;s teams — each team curates its own book. Records stay each
        team&rsquo;s own and are never averaged together; you can&rsquo;t edit or remove another
        team&rsquo;s notes, and they can&rsquo;t touch yours.
      </p>
    </div>
  );
}

interface CardPayload {
  opponent: OpponentBookEntry;
  observations: RepTeamOpponentObservation[];
  /** "The numbers vs them" (P2) — derived lines, each above its confidence floor. */
  insights: OpponentInsightLine[];
  /** This entry's merged-away spellings, for the "Same team as…" control's un-merge list. */
  aliases: { id: string; normalizedAlias: string }[];
  /** The club's other sharing teams on this opponent (Club Shared Book). Null = nothing to
   *  show, or this team isn't sharing — either way the section is absent. */
  club: ClubBookBlock | null;
  tags: string[];
  canWriteSummary: boolean;
  canShareToStaffChat: boolean;
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

  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const [shareError, setShareError] = useState('');

  const [mergeFlow, setMergeFlow] = useState<MergeFlow>({ step: 'closed' });
  const [mergeError, setMergeError] = useState('');

  // Synchronous re-entry guards: `disabled={…}` reflects COMMITTED state, so a fast
  // double-tap fires the handler twice before the re-render lands — and none of these
  // POSTs is idempotent (two identical observations / two chat snapshots).
  const busyRef = useRef({ log: false, share: false, merge: false });
  // Response sequencing: only the NEWEST load()'s payload may win. An un-merge's reload
  // racing an earlier, slower load would otherwise repaint the just-deleted alias.
  const loadSeqRef = useRef(0);
  // Which "Same team as…" opening the in-flight picker fetch belongs to — a response (or
  // error) from a session the coach already cancelled must change nothing.
  const mergeSeqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch(apiBase);
      await throwIfNotOk(res, 'Could not load this opponent');
      const payload: CardPayload = await res.json();
      if (seq !== loadSeqRef.current) return; // a newer load owns the screen
      setData(payload);
      setError('');
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load this opponent');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
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
  if (!assignment) return <CoachNotOnTeam />;
  if (loading) return <div className={styles.loadingState}>Loading…</div>;
  if (error || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error || 'Could not load this opponent'}</p>
        <CoachBackLink href={`${base}/history/opponents`}>All opponents</CoachBackLink>
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
      await throwIfNotOk(res, 'Could not save');
      setSummaryStatus('saved');
      setSummaryDraft(null);
      await load();
    } catch {
      setSummaryStatus('error');
    }
  }

  async function logObservation() {
    const body = obsBody.trim();
    if (!body || busyRef.current.log) return;
    busyRef.current.log = true;
    setLogging(true);
    setLogError('');
    try {
      const res = await fetch(`${apiBase}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, tag: obsTag, opponentName: opponent.displayName }),
      });
      await throwIfNotOk(res, 'Could not save the observation');
      setObsBody('');
      setObsTag(null);
      await load();
    } catch (e: unknown) {
      setLogError(e instanceof Error ? e.message : 'Could not save the observation');
    } finally {
      busyRef.current.log = false;
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

  async function shareToStaffChat() {
    if (busyRef.current.share) return;
    busyRef.current.share = true;
    setShareStatus('sharing');
    setShareError('');
    try {
      const res = await fetch(`${apiBase}/share-to-staff-chat`, { method: 'POST' });
      await throwIfNotOk(res, 'Could not share');
      setShareStatus('shared');
    } catch (e: unknown) {
      setShareStatus('error');
      setShareError(e instanceof Error ? e.message : 'Could not share');
    } finally {
      busyRef.current.share = false;
    }
  }

  async function openMerge() {
    const session = ++mergeSeqRef.current;
    setMergeFlow({ step: 'picking', candidates: null });
    setMergeError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/opponents`);
      await throwIfNotOk(res, 'Could not load the book');
      const payload = await res.json();
      if (session !== mergeSeqRef.current) return; // the coach cancelled this opening
      const all = (payload.opponents ?? []) as OpponentBookEntry[];
      const candidates = all.filter(e => e.key !== opponent.key);
      setMergeFlow(f => (f.step === 'picking' ? { step: 'picking', candidates } : f));
    } catch (e: unknown) {
      if (session !== mergeSeqRef.current) return; // a cancelled opening owes no error
      setMergeError(e instanceof Error ? e.message : 'Could not load the book');
    }
  }

  async function confirmMerge(target: OpponentBookEntry) {
    if (busyRef.current.merge) return;
    busyRef.current.merge = true;
    setMergeFlow({ step: 'confirming', target, merging: true });
    setMergeError('');
    try {
      const res = await fetch(`${apiBase}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The winner is the card in the URL; its display spelling rides along only for a
        // lazy mint. The loser's row (and its display name) is the server's to resolve.
        body: JSON.stringify({ winnerName: opponent.displayName, loserKey: target.key }),
      });
      await throwIfNotOk(res, 'Could not merge');
      setMergeFlow({ step: 'closed' });
      await load();
    } catch (e: unknown) {
      setMergeError(e instanceof Error ? e.message : 'Could not merge');
      setMergeFlow({ step: 'confirming', target, merging: false });
    } finally {
      busyRef.current.merge = false;
    }
  }

  async function removeAlias(aliasId: string) {
    setMergeError('');
    try {
      const res = await fetch(`${apiBase}/aliases/${aliasId}`, { method: 'DELETE' });
      await throwIfNotOk(res, 'Could not un-merge');
      await load();
    } catch (e: unknown) {
      setMergeError(e instanceof Error ? e.message : 'Could not un-merge');
    }
  }

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the way back was a SUBTITLE dressed as a link — it now
          uses the portal's one back-link treatment, above the header like every other drill-in.
          The record chip stays on the title row: it is this opponent's identity, not an action. */}
      <CoachBackLink href={`${base}/history/opponents`}>All opponents</CoachBackLink>
      <CoachPageHeader
        icon={Telescope}
        title={opponent.displayName}
        titleChips={
          <span className={styles.scoutRecChip} data-tone={recordTone(opponent.record)}>
            {recordChip(opponent.record)}
          </span>
        }
        helpLabel="Opponents"
        help={{ module: 'coaches', sectionIds: ['premium-scouting'], fullGuideHref: `/${orgSlug}/coaches/help#premium-scouting` }}
      />

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

      {/* "The numbers vs them" (P2, mockup 5a) — derived lines, each with its provenance
          chip. Below-floor lines are ABSENT server-side, never hedged (§4.6 honesty rule). */}
      {data.insights.length > 0 && (
        <div className={styles.scoutNumbers}>
          <div className={styles.scoutNumbersLabel}>The numbers vs them</div>
          {data.insights.map(line => (
            <div key={line.id} className={styles.scoutNumbersLine}>
              <span className={styles.scoutNumbersText}>{line.text}</span>
              <span className={styles.scoutProvChip}>from {line.fromGames} games</span>
            </div>
          ))}
        </div>
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

      {/* Game-plan share (P2, mockup 5c): a SNAPSHOT into the existing staff room — later
          edits never rewrite chat history. Absent without the grant or a staff room. */}
      {data.canShareToStaffChat && (
        <div className={styles.scoutShareRow}>
          <button
            type="button"
            className={styles.scoutPanelLink}
            disabled={shareStatus === 'sharing'}
            onClick={shareToStaffChat}
          >
            <Share2 size={13} aria-hidden />{' '}
            {shareStatus === 'sharing' ? 'Sharing…' : 'Share to staff chat'}
          </button>
          <span className={styles.saveStatus} aria-live="polite">
            {shareStatus === 'shared' && <><Check size={13} /> Shared</>}
            {shareStatus === 'error' && shareError}
          </span>
        </div>
      )}

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
      <ScoutTagFilter
        tags={tags.filter(t => observations.some(o => o.tag === t))}
        value={filterTag}
        onChange={setFilterTag}
      />

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

      {/* The club layer (mockup 8b) — below the team's OWN timeline, deliberately: your bench's
          words come first, the club's memory follows. */}
      {data.club && <ClubSection club={data.club} />}

      {/* "Same team as…" (P2, mockup Stage 6) — identity housekeeping, notes-gated. The
          quiet control opens a picker of other book entries; the confirm step shows the two
          records unifying BEFORE anything happens. Existing aliases un-merge from here too. */}
      {data.canWriteSummary && (
        <div className={styles.scoutMerge}>
          <div className={styles.scoutSeasonLabel}>Identity</div>
          {data.aliases.length > 0 && (
            <div className={styles.scoutAliasList}>
              {data.aliases.map(a => (
                <span key={a.id} className={styles.scoutAliasRow}>
                  also answers to “{a.normalizedAlias}”
                  <button
                    type="button"
                    className={styles.scoutObsDelete}
                    aria-label={`Un-merge ${a.normalizedAlias}`}
                    title="Un-merge — this spelling becomes its own entry again"
                    onClick={() => removeAlias(a.id)}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {mergeFlow.step === 'closed' ? (
            <button type="button" className={styles.scoutPanelLink} onClick={openMerge}>
              <GitMerge size={13} aria-hidden /> Same team as…
            </button>
          ) : mergeFlow.step === 'confirming' ? (
            <div className={styles.dupeNotice}>
              <p className={styles.dupeNoticeText}>
                <strong>{mergeFlow.target.displayName}</strong> ({recordChip(mergeFlow.target.record)}) will fold into{' '}
                <strong>{opponent.displayName}</strong> ({recordChip(opponent.record)}) — one record of{' '}
                <strong>
                  {recordChip({
                    wins: opponent.record.wins + mergeFlow.target.record.wins,
                    losses: opponent.record.losses + mergeFlow.target.record.losses,
                    ties: opponent.record.ties + mergeFlow.target.record.ties,
                  })}
                </strong>. Their observations and book line move here, and
                “{mergeFlow.target.displayName}” keeps working as another name for this team.
              </p>
              <div className={styles.dupeNoticeActions}>
                <button type="button" className="btn btn-lime" disabled={mergeFlow.merging} onClick={() => confirmMerge(mergeFlow.target)}>
                  {mergeFlow.merging ? 'Merging…' : 'Merge'}
                </button>
                <button
                  type="button"
                  className={styles.scoutPanelLink}
                  disabled={mergeFlow.merging}
                  onClick={openMerge /* back to the picker, list refetched */}
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.scoutMergePicker}>
              <p className={styles.scoutFootnote}>
                Pick the entry that is really this same team — its record and observations fold into this card.
              </p>
              {mergeFlow.candidates === null ? (
                <div className={styles.loadingState}>Loading…</div>
              ) : mergeFlow.candidates.length === 0 ? (
                <p className={styles.scoutFootnote}>No other opponents in the book yet.</p>
              ) : (
                <div className={styles.scoutMergeList}>
                  {mergeFlow.candidates.map(c => (
                    <button key={c.key} type="button" className={styles.scoutMergeOption} onClick={() => setMergeFlow({ step: 'confirming', target: c, merging: false })}>
                      <span className={styles.scoutMergeOptionName}>{c.displayName}</span>
                      <span className={styles.scoutRecChip} data-tone={recordTone(c.record)}>{recordChip(c.record)}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={styles.scoutPanelLink}
                onClick={() => { mergeSeqRef.current++; setMergeFlow({ step: 'closed' }); }}
              >
                Cancel
              </button>
            </div>
          )}
          {mergeError && <p className={styles.errorText}>{mergeError}</p>}
        </div>
      )}
    </div>
  );
}
