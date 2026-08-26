'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Plus, Printer } from 'lucide-react';
import { useDiscardGuard, touched } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import {
  downloadPDF, buildFilename, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { checkinSheetHeadings, checkinTickColumn } from '@/lib/export/tryout-checkin-columns';
import { tournamentToday } from '@/lib/timezone';
import { describeTryoutSession, tryoutSessionDay } from '@/lib/tryout-session-label';
import type { RepTryoutRegistration, RepTryoutSession } from '@/lib/types';
import TryoutNamesSwitch from './TryoutNamesSwitch';
import styles from './TryoutCheckIn.module.css';

const BLANK_WALKUP = { first: '', last: '', email: '' };

interface Props {
  /** The candidate API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-candidates`. */
  apiBase: string;
  /** The tryout-sessions API base — read at PRINT time so the sheet can name its session, and
   *  PATCHed by the names switch in the header. The hub (the only caller) always passes it; the
   *  switch is gated on it rather than made required so an embedder that only wants the list
   *  degrades to a list instead of a crash. */
  sessionsBase?: string;
  /** For the printed sheet's branding: resolved team → club → defaults at print time. */
  orgSlug?: string;
  teamId?: string;
  /**
   * Whose paper the printed sheet is (D1). The TEAM layer, matching the tryout report on the
   * same screen: the team's name, over the club's crest/colour until the team sets its own.
   */
  teamName?: string | null;
  /** Check-in face of the tryouts hub (One-Room build, 2026-08-23): no back link — the hub's
   *  face row owns navigation — and the desktop layout caps its width and goes two-column. */
  embedded?: boolean;
  /** Is this face the one on screen? The hub keeps faces mounted display:none, so coming back
   *  on screen quietly re-syncs the list — check-ins land from other devices and evaluators. */
  active?: boolean;
  onError?: (msg: string) => void;
  /** Fired after any successful check-in change or walk-up add, so the hub's overview (face
   *  hint, guide, tab checks) follows without waiting for a window refocus. */
  onChanged?: () => void;
}

const fullName = (c: RepTryoutRegistration) => `${c.playerFirstName} ${c.playerLastName ?? ''}`.trim();

/**
 * Which session the sheet is most likely for: the one running TODAY, else the next one still to
 * come, else the last one held. Only a hint on the chooser — the coach still picks.
 *
 * ⚠ "Today" is the CLUB's calendar day, not the device's — a coach travelling with the team must
 * still be offered the session the club is running today (the standing date rule in this repo).
 */
function suggestSession(sessions: RepTryoutSession[]): string | null {
  if (sessions.length === 0) return null;
  const todayKey = tournamentToday();
  const today = sessions.find(s => tryoutSessionDay(s.startsAt) === todayKey);
  if (today) return today.id;
  const now = Date.now();
  const upcoming = sessions.find(s => Date.parse(s.startsAt) >= now);
  return (upcoming ?? sessions[sessions.length - 1]).id;
}

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 100 ? String(age) : '';
}

export default function TryoutCheckIn({
  apiBase, sessionsBase, orgSlug, teamId, teamName,
  embedded, active = true, onError, onChanged,
}: Props) {
  const [candidates, setCandidates] = useState<RepTryoutRegistration[]>([]);
  /** Chunk F: which candidates were here before, keyed by registration id (server-matched). */
  const [returning, setReturning] = useState<Record<string, { priorProgramYearName: string; kind: string }> | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const recentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [walkupOpen, setWalkupOpen] = useState(false);
  const [walkup, setWalkup] = useState(BLANK_WALKUP);
  const [savingWalkup, setSavingWalkup] = useState(false);
  const [printing, setPrinting] = useState(false);
  /** Non-null while the coach is choosing WHICH session this sheet is for. */
  const [sessionChoices, setSessionChoices] = useState<RepTryoutSession[] | null>(null);

  useOverlayOpen(walkupOpen || sessionChoices !== null);
  const guardedWalkupClose = useDiscardGuard({
    dirty: touched(walkup, BLANK_WALKUP),
    close: () => setWalkupOpen(false),
    noun: 'walk-up',
  });

  const fail = useCallback((m: string) => { onError ? onError(m) : console.error(m); }, [onError]);

  // Sequence token (/review 2026-08-23): quiet refreshes replace the whole list, and a check-in
  // tap is optimistic — a refresh airborne when the tap lands must be discarded, or it repaints
  // the pre-tap state over the row. `setCheckin` bumps the token to invalidate anything in flight.
  const loadSeq = useRef(0);
  // `quiet` refreshes in place: no loading blank, and a failed background refresh is not the
  // coach's problem — the list on screen is still the truth as of a moment ago.
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load candidates');
      if (seq !== loadSeq.current) return; // superseded by a newer load or a toggle
      setIsAnonymous(data.isAnonymous ?? true);
      setCandidates(data.candidates ?? []);
      setReturning(data.returning ?? null);
    } catch (e: any) {
      if (!quiet) fail(e.message ?? 'Failed to load candidates.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (recentTimer.current) clearTimeout(recentTimer.current); }, []);

  /**
   * ⚠⚠ THE PRINT FLOW IS SEQUENCE-TOKENED, exactly like `load()` above, and clearing state was
   * not enough on its own.
   *
   * The coach portal does NOT remount when a coach switches team, so a chooser left open on team A
   * would still be on screen for team B — and picking a session there would print team B's
   * candidates under team A's session heading. Resetting the state on a team change closed that
   * door, but left a second one open: the sessions fetch already IN FLIGHT for team A resumes after
   * the reset and calls `setSessionChoices` with team A's sessions, RE-OPENING the chooser over
   * team B with nothing on it naming a team (/review, high-risk tier, 2026-08-24). Picking a row
   * then produced exactly the mismatched file the reset existed to prevent.
   *
   * The token makes a stale response inert; the reset keeps the screen honest. Both are needed.
   * (The standing lesson from the Rosters pass: adding an export re-severities every pre-existing
   * race on the screen.)
   */
  const printSeq = useRef(0);
  useEffect(() => {
    printSeq.current++;
    setSessionChoices(null);
    setPrinting(false);
  }, [apiBase]);

  // Check-ins keep landing from other devices and evaluators — re-sync quietly on window
  // refocus and when this face comes back on screen (/review 2026-08-23: once mounted inside
  // the hub, this list never refetched for the life of the page). Guarded off in-flight writes;
  // the sequence token discards stale responses.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current && !togglingId && !savingWalkup) load(true);
    wasActive.current = active;
  }, [active, togglingId, savingWalkup, load]);
  useEffect(() => {
    const onFocus = () => { if (!togglingId && !savingWalkup) load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [togglingId, savingWalkup, load]);

  // Which session the chooser marks "Most likely" — one scan per render, not one per row.
  const suggestedId = sessionChoices ? suggestSession(sessionChoices) : null;

  const checkedCount = candidates.filter(c => c.isCheckedIn).length;
  const total = candidates.length;

  const filtered = candidates.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const bib = (c.bibNumber ?? '').toLowerCase();
    if (isAnonymous) return bib.includes(q);
    return fullName(c).toLowerCase().includes(q) || bib.includes(q);
  });

  async function setCheckin(c: RepTryoutRegistration, value: boolean) {
    if (togglingId) return;
    loadSeq.current++; // invalidate any refresh already in flight — its snapshot predates this tap
    setTogglingId(c.id);
    setCandidates(prev => prev.map(p => (p.id === c.id ? { ...p, isCheckedIn: value } : p)));  // optimistic
    try {
      const res = await fetch(`${apiBase}/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCheckedIn: value }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed'); }
      const data = await res.json();
      setCandidates(prev => prev.map(p => (p.id === c.id ? data.registration : p)));
      onChanged?.();
      if (value) {
        setRecentId(c.id);
        if (recentTimer.current) clearTimeout(recentTimer.current);
        recentTimer.current = setTimeout(() => setRecentId(r => (r === c.id ? null : r)), 3500);
      } else if (recentId === c.id) {
        setRecentId(null);
      }
    } catch (e: any) {
      setCandidates(prev => prev.map(p => (p.id === c.id ? { ...p, isCheckedIn: !value } : p)));  // revert
      fail(e.message ?? 'Failed to update check-in.');
    } finally {
      setTogglingId(null);
    }
  }

  async function addWalkup() {
    if (!walkup.first.trim()) return;
    setSavingWalkup(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerFirstName: walkup.first, playerLastName: walkup.last, guardianEmail: walkup.email }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.errors?.playerFirstName ?? d.error ?? 'Failed to add'); }
      setWalkupOpen(false);
      setWalkup(BLANK_WALKUP);
      await load();
      onChanged?.();
    } catch (e: any) {
      fail(e.message ?? 'Failed to add walk-up.');
    } finally {
      setSavingWalkup(false);
    }
  }

  /**
   * Build the printed sheet.
   *
   * ⚠ Everything it prints is read at PRINT TIME — the branding and the sessions are fetched on
   * the click, and the candidate list is whatever is on screen. Nothing is cached across the
   * morning: this surface stays mounted for a whole tryout, and a cached copy would go on
   * printing a look the coach has since changed or a session that has since moved.
   */
  const buildSheet = useCallback(async (session: RepTryoutSession | null) => {
    const blind = isAnonymous;
    // ⚠ The columns live in ONE place the contract test also imports — a privacy promise that
    // checks a test's own copy of a column list proves nothing (QA §86).
    const headers = checkinSheetHeadings(blind);
    const tickColumn = checkinTickColumn(blind);
    const rows = candidates.map(c => {
      const age = ageFromDob(c.playerDateOfBirth);
      return blind
        ? [c.bibNumber ?? '', age, '', '']
        : [c.bibNumber ?? '', fullName(c) || `Bib ${c.bibNumber ?? ''}`, age, '', ''];
    });

    // The line under the title. A tryout with sessions names the one this paper is FOR — two
    // sessions on one weekend used to print identical sheets. Without sessions it still says
    // when it was printed, so the paper is never undated.
    const printedOn = new Date().toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    const subtitle = [
      session ? describeTryoutSession(session) : `Printed ${printedOn}`,
      // A volunteer handed a sheet of bib numbers should not have to wonder where the names went.
      blind ? 'Blind evaluation — names hidden on purpose' : '',
    ].filter(Boolean).join('  ·  ');

    // Team paper (D1/D4): team name, team look over the club's. Fetched per export, never cached.
    const fetched = orgSlug && teamId
      ? await fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)
      : null;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(fetched ?? {}) };

    await downloadPDF(
      buildFilename({ org: orgSlug, dataset: 'tryout-check-in' }, 'pdf'),
      'Tryout check-in', subtitle, headers, rows, settings,
      {
        identity: teamName ?? undefined,
        // It is a list of people down a page — portrait, whatever the org's default is.
        shape: { orientation: 'portrait' },
        // The one column somebody fills in by hand gets a box to fill in.
        penColumns: [tickColumn],
      },
    );
  }, [candidates, isAnonymous, orgSlug, teamId, teamName]);

  async function printSheet() {
    if (printing) return;
    const seq = ++printSeq.current;
    setPrinting(true);
    try {
      let sessions: RepTryoutSession[] = [];
      if (sessionsBase) {
        const res = await fetch(sessionsBase);
        // ⚠ A non-ok response must NOT read as "this tryout has no sessions". Swallowing it printed
        // an UNDATED sheet — silently reproducing the very defect naming the session exists to fix
        // (two sessions on one weekend, identical paper), with nothing telling the coach why
        // (/review 2026-08-24). Only a genuinely absent `sessionsBase` means "no sessions".
        if (!res.ok) throw new Error('Could not read your tryout dates — try again in a moment.');
        sessions = (await res.json()).sessions ?? [];
      }
      if (seq !== printSeq.current) return; // the coach changed team while this was in flight
      const live = sessions.filter(s => s.status !== 'cancelled');
      if (live.length > 1) {
        // More than one session: the coach says which morning this paper is for. Today's, or
        // the next one still to come, is pre-selected — the answer on all but one tryout day.
        setSessionChoices(live);
        return;
      }
      await buildSheet(live[0] ?? null);
    } catch (e: any) {
      if (seq === printSeq.current) fail(e.message ?? 'Failed to build the sheet.');
    } finally {
      if (seq === printSeq.current) setPrinting(false);
    }
  }

  /** Pick one session from the chooser and print it. */
  async function printForSession(session: RepTryoutSession | null) {
    const seq = ++printSeq.current;
    setSessionChoices(null);
    setPrinting(true);
    try {
      await buildSheet(session);
    } catch (e: any) {
      if (seq === printSeq.current) fail(e.message ?? 'Failed to build the sheet.');
    } finally {
      if (seq === printSeq.current) setPrinting(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>Loading…</p>;

  return (
    <div className={`${styles.wrap} ${embedded ? styles.wrapEmbedded : ''}`}>
      <div className={styles.header}>
        <div className={styles.progressRow}>
          <span className={styles.progressText}>{checkedCount} <span className={styles.total}>/ {total} checked in</span></span>
          {/* The state IS the control (owner 2026-08-25). This was an inert chip that reported
              blind mode and left a coach hunting three stages forward for the switch. Every
              candidate row's name follows it, so the list reloads on change. */}
          {sessionsBase && <TryoutNamesSwitch
            apiBase={sessionsBase}
            canWrite
            blind={isAnonymous}
            onChanged={b => { setIsAnonymous(b); load(true); onChanged?.(); }}
            onError={fail}
          />}
        </div>
        <div className={styles.bar}><div className={styles.barFill} style={{ width: total ? `${(checkedCount / total) * 100}%` : '0%' }} /></div>
        <input
          className={styles.search}
          type="text"
          inputMode="search"
          placeholder={isAnonymous ? 'Search bib #…' : 'Search name or bib…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className={styles.addBtn} onClick={() => { setWalkup(BLANK_WALKUP); setWalkupOpen(true); }}>
            <Plus size={15} /> Add walk-up
          </button>
          <button type="button" className={styles.addBtn} onClick={printSheet} disabled={candidates.length === 0 || printing}>
            <Printer size={15} /> {printing ? 'Building…' : 'Print sheet'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {total === 0
            ? 'No candidates yet. Add a walk-up, or open registration so families can sign up.'
            : 'No matches.'}
        </p>
      ) : (
        <div className={styles.list}>
          {filtered.map(c => {
            const checked = c.isCheckedIn;
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.row} ${checked ? styles.rowChecked : ''}`}
                onClick={() => setCheckin(c, !checked)}
                disabled={togglingId === c.id}
              >
                <span className={styles.bib}>{c.bibNumber ?? '—'}</span>
                <span className={styles.main}>
                  {isAnonymous
                    ? <span className={styles.bibOnly}>Bib {c.bibNumber ?? '—'}</span>
                    : <span className={styles.name}>{fullName(c) || `Bib ${c.bibNumber ?? '—'}`}</span>}
                  {/*
                    Chunk F (D-F1): "have we seen this person before?" Deliberately a MARKER, not
                    a link — the whole row is a tap-to-check-in target, and a nested link inside it
                    would fight the primary action on the one screen where speed matters most. The
                    coach opens the season switcher to read what was said; this just tells them
                    there is something to read. Suppressed in an anonymous tryout, where the point
                    is that names are hidden.
                  */}
                  {!isAnonymous && returning?.[c.id] && (
                    <span className={styles.returning}>
                      {returning[c.id].kind === 'roster'
                        ? `On the ${returning[c.id].priorProgramYearName} roster`
                        : `Tried out in ${returning[c.id].priorProgramYearName}`}
                    </span>
                  )}
                </span>
                {checked && recentId === c.id && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.undo}
                    onClick={e => { e.stopPropagation(); setCheckin(c, false); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setCheckin(c, false); } }}
                  >
                    Undo
                  </span>
                )}
                <span className={styles.state}>
                  <span className={`${styles.stateIcon} ${checked ? styles.iconOn : styles.iconOff}`}>
                    {checked && <Check size={18} strokeWidth={3} />}
                  </span>
                  <span className={`${styles.stateLabel} ${checked ? styles.labelOn : styles.labelOff}`}>
                    {checked ? 'Checked in' : 'Tap to check in'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {walkupOpen && (
        <div className={styles.scrim} onClick={() => !savingWalkup && guardedWalkupClose()}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add walk-up</h3>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input className={styles.input} value={walkup.first} maxLength={80} onChange={e => setWalkup(w => ({ ...w, first: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input className={styles.input} value={walkup.last} maxLength={80} onChange={e => setWalkup(w => ({ ...w, last: e.target.value }))} />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Guardian email <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>· optional</span></label>
              <input className={styles.input} type="email" value={walkup.email} maxLength={200} onChange={e => setWalkup(w => ({ ...w, email: e.target.value }))} placeholder="Add now or later" />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => guardedWalkupClose()} disabled={savingWalkup}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={addWalkup} disabled={savingWalkup || !walkup.first.trim()}>
                {savingWalkup ? 'Adding…' : 'Add & check in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Which morning is this paper for? Only asked when the tryout has more than one session —
          two sessions on one weekend used to print identical, undated sheets. */}
      {sessionChoices && (
        <div className={styles.scrim} onClick={() => setSessionChoices(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Which session is this sheet for?</h3>
            <div className={styles.sessionList}>
              {sessionChoices.map(s => {
                const suggested = s.id === suggestedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.sessionBtn}
                    autoFocus={suggested}
                    onClick={() => printForSession(s)}
                  >
                    <span className={styles.sessionWhen}>{describeTryoutSession(s)}</span>
                    {suggested && <span className={styles.sessionHint}>Most likely</span>}
                  </button>
                );
              })}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setSessionChoices(null)}>Cancel</button>
              <button type="button" className="btn btn-ghost" onClick={() => printForSession(null)}>
                No session — just today’s date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
