'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldCheck, Users, Lock } from 'lucide-react';
import styles from './TournamentRosterSubmit.module.css';

/**
 * Coaches Portal — per-event roster SUBMIT island (free-tier Phase 5k).
 *
 * Calls the 5j API (`/api/coaches/tournaments/[teamId]/roster`): GET on mount for the
 * organizer requirements + the coach's master roster + the current snapshot + lock state,
 * then POST to copy a SELECTED subset of master players into the per-event snapshot.
 *
 * THE SEAM: organizer-required DOB / jersey are captured as per-event OVERRIDES here — they
 * are sent to the snapshot API only and NEVER touch the master roster
 * (`basic_coach_team_players`). The master's identity-only posture is preserved; a NEW snapshot
 * DOB still fires the same guardian-consent gate as the master editor.
 *
 * Requirements drive + hide the fields (DOB/jersey/waiver) and the min/max count; the API
 * re-validates everything server-side (this is convenience + parity, not the gate).
 */

type MasterPlayer = {
  id: string;
  name: string;
  jerseyNumber: string | null;
  dateOfBirth: string | null;
};

type SnapshotRow = {
  id: string;
  name: string;
  jerseyNumber: string | null;
  dateOfBirth: string | null;
  position: string | null;
  notes: string | null;
  source: string;
  sourcePlayerId: string | null;
};

type Requirements = {
  required: boolean;
  requireDob: boolean;
  requireJersey: boolean;
  requireWaiver: boolean;
  waiverText: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  effectiveMinPlayers: number;
};

type RosterState = {
  accepted: boolean;
  locked: boolean;
  tournamentCompleted: boolean;
  canSubmit: boolean;
  rosterSubmittedAt: string | null;
  rosterConfirmedAt: string | null;
};

type RosterData = {
  requirements: Requirements;
  masterPlayers: MasterPlayer[];
  snapshot: SnapshotRow[];
  state: RosterState;
};

/** Per-master-player edit state, keyed by master player id. */
type Selection = {
  selected: boolean;
  jersey: string;
  dob: string;
  /** DOB value as LOADED this session (from a prior submission or the master). Guardian consent is
   *  re-required only when `dob` is CHANGED away from this — not on an unchanged re-view (mirrors
   *  RosterEditor's originalDob). Position is intentionally absent: it's organizer-assigned at the
   *  gate (save_gate_roster), never coach-controlled. */
  initialDob: string;
  dobConsent: boolean;
};

function fmtDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TournamentRosterSubmit({ teamId }: { teamId: string }) {
  const router = useRouter();
  const base = `/api/coaches/tournaments/${teamId}/roster`;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RosterData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sel, setSel] = useState<Record<string, Selection>>({});
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(base, { headers: { Accept: 'application/json' } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? 'Could not load your event roster.');
        if (cancelled) return;
        const d = body as RosterData;
        setData(d);
        // Seed the per-player selection from the master roster + any existing coach submission
        // (re-submit pre-fills the prior selection + its overrides).
        const bySource = new Map<string, SnapshotRow>();
        for (const row of d.snapshot) {
          if (row.source === 'coach' && row.sourcePlayerId) bySource.set(row.sourcePlayerId, row);
        }
        const next: Record<string, Selection> = {};
        for (const m of d.masterPlayers) {
          const prior = bySource.get(m.id);
          const dob = (prior?.dateOfBirth ?? m.dateOfBirth ?? '') || '';
          next[m.id] = {
            selected: Boolean(prior),
            jersey: (prior?.jerseyNumber ?? m.jerseyNumber ?? '') || '',
            dob,
            // The loaded DOB is "already consented" — consent only re-fires if the coach CHANGES it.
            initialDob: dob,
            dobConsent: false,
          };
        }
        setSel(next);
        // A coach who already submitted has acknowledged any required waiver — don't force a re-tick
        // on a re-submit of the same roster (Q7: acknowledgment only, no stored document).
        if (d.requirements.requireWaiver && d.state.rosterSubmittedAt) setWaiverAccepted(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load your event roster.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [base]);

  // Plain derived values (React Compiler is off; these are cheap for a single team's roster).
  const masterById = new Map((data?.masterPlayers ?? []).map(m => [m.id, m] as const));
  const selectedIds = Object.keys(sel).filter(id => sel[id]?.selected);

  const setOne = (id: string, patch: Partial<Selection>) =>
    setSel(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // Client-side gate (the API re-validates authoritatively). Mirrors buildTournamentRosterSnapshot.
  function computeValidation(): { ok: boolean; message: string | null } {
    if (!data) return { ok: false, message: null };
    const r = data.requirements;
    const count = selectedIds.length;
    if (count === 0) return { ok: false, message: 'Select at least one player.' };
    if (count < r.effectiveMinPlayers) return { ok: false, message: `Select at least ${r.effectiveMinPlayers} players (you have ${count}).` };
    if (r.maxPlayers != null && count > r.maxPlayers) return { ok: false, message: `Select at most ${r.maxPlayers} players (you have ${count}).` };
    for (const id of selectedIds) {
      const s = sel[id];
      if (!s) continue; // defensive: selectedIds is derived from sel, so this never trips
      const m = masterById.get(id);
      const name = m?.name ?? 'A player';
      if (r.requireDob && !s.dob.trim()) return { ok: false, message: `Add a date of birth for ${name}.` };
      if (r.requireJersey && !s.jersey.trim()) return { ok: false, message: `Add a jersey number for ${name}.` };
      // Guardian consent re-fires only when the coach CHANGES the DOB this session (vs the loaded
      // value) — an unchanged prior-submission DOB was already consented (mirrors RosterEditor).
      const dobChanged = s.dob.trim().length > 0 && s.dob.trim() !== s.initialDob.trim();
      if (dobChanged && !s.dobConsent) return { ok: false, message: `Confirm guardian consent for ${name}'s date of birth.` };
    }
    if (r.requireWaiver && !waiverAccepted) return { ok: false, message: 'Acknowledge the waiver to submit.' };
    return { ok: true, message: null };
  }
  const validation = computeValidation();

  async function submit() {
    if (!data || !validation.ok || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Position is intentionally NOT sent — it's organizer-assigned at the gate, not coach-controlled.
      const players = selectedIds
        .map(id => {
          const s = sel[id];
          if (!s) return null;
          return {
            sourcePlayerId: id,
            jerseyNumber: s.jersey.trim() || null,
            dateOfBirth: s.dob.trim() || null,
          };
        })
        .filter((p): p is { sourcePlayerId: string; jerseyNumber: string | null; dateOfBirth: string | null } => p !== null);
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, waiverAccepted }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not submit your roster.');
      setSavedAt(body.submittedAt ?? new Date().toISOString());
      // Reflect the new submitted state locally + refresh the server-rendered hero checklist
      // / status block (roster_submitted_at flips to "Submitted").
      setData(prev => prev ? { ...prev, state: { ...prev.state, rosterSubmittedAt: body.submittedAt ?? prev.state.rosterSubmittedAt } } : prev);
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not submit your roster.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className={`card ${styles.card}`}><p className={styles.muted}>Loading your roster…</p></div>;
  }
  if (loadError || !data) {
    return <div className={`card ${styles.card}`}><p className={styles.error} role="alert">{loadError ?? 'Could not load your event roster.'}</p></div>;
  }

  const { requirements: r, masterPlayers, snapshot, state } = data;

  // ── Locked / completed → read-only confirmed roster ──────────────────────────
  if (state.locked || state.tournamentCompleted) {
    const rows = snapshot.length > 0 ? snapshot : [];
    return (
      <div className={`card ${styles.card}`}>
        <p className={styles.lockedNote}>
          <Lock size={14} aria-hidden />{' '}
          {state.locked
            ? 'The organizer has confirmed your roster at check-in. Contact them to make any changes.'
            : 'This tournament is complete — the roster is locked.'}
        </p>
        {rows.length > 0 ? (
          <ul className={styles.readList}>
            {rows.map(row => (
              <li key={row.id} className={styles.readRow}>
                <span className={styles.jersey}>{row.jerseyNumber || '—'}</span>
                <span className={styles.readName}>{row.name}</span>
                {row.position && <span className={styles.readMeta}>{row.position}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No roster was submitted for this event.</p>
        )}
      </div>
    );
  }

  // ── No master players yet → point the coach at their team home ───────────────
  if (masterPlayers.length === 0) {
    return (
      <div className={`card ${styles.card}`}>
        <p className={styles.muted}>
          Add players to your team&apos;s master roster first — then pick who&apos;s going to this event.
          You build your roster once on your team home and reuse it for every tournament.
        </p>
      </div>
    );
  }

  // ── Editor ───────────────────────────────────────────────────────────────────
  const reqChips: string[] = [];
  if (r.requireDob) reqChips.push('birthdates');
  if (r.requireJersey) reqChips.push('jersey numbers');
  if (r.minPlayers != null && r.maxPlayers != null && r.minPlayers <= r.maxPlayers) reqChips.push(`${r.minPlayers}–${r.maxPlayers} players`);
  else if (r.maxPlayers != null) reqChips.push(`up to ${r.maxPlayers} players`);
  else if (r.effectiveMinPlayers > 0) reqChips.push(`at least ${r.effectiveMinPlayers} players`);

  const count = selectedIds.length;
  const orgAddedCount = snapshot.filter(s => s.source !== 'coach').length;

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.intro}>
            Pick the players going to this event from your master roster. You can update this until the
            organizer confirms your roster at check-in.
          </p>
          {reqChips.length > 0 && (
            <p className={styles.reqLine}>This organizer requires: {reqChips.join(' · ')}.</p>
          )}
        </div>
        <span className={styles.countPill}>
          <Users size={14} aria-hidden /> {count} selected
        </span>
      </div>

      {orgAddedCount > 0 && (
        <p className={styles.muted}>
          {orgAddedCount === 1 ? '1 player was added by the organizer' : `${orgAddedCount} players were added by the organizer`} and isn&apos;t shown here — your submission won&apos;t remove them.
        </p>
      )}

      <ul className={styles.list}>
        {masterPlayers.map(m => {
          const s = sel[m.id];
          if (!s) return null;
          // Show the consent checkbox only when the coach has CHANGED the DOB this session.
          const newDob = s.dob.trim().length > 0 && s.dob.trim() !== s.initialDob.trim();
          return (
            <li key={m.id} className={`${styles.row} ${s.selected ? styles.rowOn : ''}`}>
              <label className={styles.pick}>
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={e => setOne(m.id, { selected: e.target.checked })}
                />
                <span className={styles.jersey}>{(s.selected ? s.jersey : m.jerseyNumber) || '—'}</span>
                <span className={styles.name}>{m.name}</span>
              </label>

              {s.selected && (r.requireDob || r.requireJersey) && (
                <div className={styles.fields}>
                  {r.requireJersey && (
                    <input
                      className={styles.fieldInput}
                      inputMode="numeric"
                      maxLength={16}
                      placeholder="Jersey #"
                      value={s.jersey}
                      onChange={e => setOne(m.id, { jersey: e.target.value })}
                      aria-label={`Jersey number for ${m.name}`}
                    />
                  )}
                  {r.requireDob && (
                    <input
                      className={styles.fieldInput}
                      type="date"
                      value={s.dob}
                      onChange={e => setOne(m.id, { dob: e.target.value, ...(e.target.value !== s.dob ? { dobConsent: false } : {}) })}
                      aria-label={`Date of birth for ${m.name}`}
                    />
                  )}
                </div>
              )}

              {s.selected && newDob && (
                <label className={styles.consent}>
                  <input type="checkbox" checked={s.dobConsent} onChange={e => setOne(m.id, { dobConsent: e.target.checked })} />
                  <span>
                    <ShieldCheck size={13} aria-hidden /> I have the parent/guardian&apos;s consent to share {m.name}&apos;s
                    date of birth with this organizer for the event.
                  </span>
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {r.requireWaiver && (
        <label className={styles.waiver}>
          <input type="checkbox" checked={waiverAccepted} onChange={e => setWaiverAccepted(e.target.checked)} />
          <span>{r.waiverText}</span>
        </label>
      )}

      {submitError && <p className={styles.error} role="alert">{submitError}</p>}
      {!submitError && savedAt && (
        <p className={styles.success}>
          Roster submitted{state.rosterConfirmedAt ? '' : ' — you can keep updating it until the organizer confirms it'}.
        </p>
      )}
      {!validation.ok && validation.message && <p className={styles.hint}>{validation.message}</p>}

      <button type="button" className={styles.submitBtn} onClick={submit} disabled={!validation.ok || submitting}>
        <Check size={15} aria-hidden /> {submitting ? 'Submitting…' : state.rosterSubmittedAt || savedAt ? 'Update submitted roster' : 'Submit roster'}
      </button>

      {(state.rosterSubmittedAt || savedAt) && (
        <p className={styles.muted}>
          Last submitted {fmtDate(savedAt ?? state.rosterSubmittedAt)}. The organizer confirms your roster at check-in.
        </p>
      )}
    </div>
  );
}
