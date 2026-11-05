'use client';
/**
 * "BRING BACK A PAST PLAYER" (Club Tier Stage 14 S3 — the drawing's tab 3, version 2, ruled 2026-11-04).
 *
 * The 640 window (each row carries a trailing chip), the Pay out sheet's tick list, opened from Add Player's second
 * door line. It lists this team's earlier seasons' children who are not on the working season — their latest entry,
 * with the season it was — and brings the ticked ones back ON THE SAME CHILD, active, with their history. Past dues are
 * shown and stay on their own book. Birth date, family and dues show only with the roster-details grant (the server
 * leaves them out otherwise).
 *
 * `usePastPlayers` is the one loader: the Add Player question and the paste check match a typed name against the
 * same list (the add routes re-check it on the server).
 */
import { useEffect, useMemo, useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell, { QuestionCancel, QuestionReason } from '@/components/coaches/QuestionShell';
import type { RepRosterPlayer } from '@/lib/types';
import type { BornYears, Cutoff } from '@/lib/born-years';
import { normName } from '@/lib/continuity-match';
import { pluralize } from '@/lib/utils';
import { playerName } from '@/lib/coach-roster-name';
import {
  PICKER_TITLE, PICKER_SEARCH, PICKER_EMPTY_NONE, PICKER_NO_MATCH, PICKER_READ_FAILED,
  pickerHint, pickerChosen, pickerListedNote, pickerFootLine, pickerSubmit, pickerEmptyNoneHint, pickerEmptyAll,
  pickerRowLine, duesChip, bornChip, pastPlayerName,
  type PastPlayer, type WorkingSeason,
} from '@/lib/past-player-words';

export interface PastPlayersPayload {
  players: PastPlayer[];
  /** Past children already answered "no" for a same-name player on this season — never asked again. */
  answeredNo?: string[];
  hasEarlierSeasons: boolean;
  workingSeason: WorkingSeason;
  born: BornYears;
  cutoff: Cutoff;
  rosterPii: boolean;
  teamName: string;
}

/** Read the team's past players once while `enabled`; `reload` reads again (after a bring-back). */
export function usePastPlayers(orgSlug: string, teamId: string, enabled: boolean) {
  const [data, setData] = useState<PastPlayersPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    // Closed: forget the list, so the next open never shows a child who was brought back a moment ago.
    if (!enabled) { void Promise.resolve().then(() => setData(null)); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/past-players`);
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body) { setFailed(true); return; }
        setFailed(false);
        setData(body as PastPlayersPayload);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId, enabled, seq]);
  return { data, failed, reload: () => setSeq(n => n + 1) };
}

export default function PastPlayersPicker({
  open, orgSlug, teamId, onClose, onAdded,
}: {
  open: boolean;
  orgSlug: string;
  teamId: string;
  onClose: () => void;
  /** The entries made, and the sentence the roster's notice reads. */
  onAdded: (created: RepRosterPlayer[], message: string) => void;
}) {
  const { data, failed } = usePastPlayers(orgSlug, teamId, open);
  const [ticked, setTicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => { setTicked([]); setSearch(''); setError(''); });
  }, [open]);

  const shown = useMemo(() => {
    const q = normName(search);
    const all = data?.players ?? [];
    return q ? all.filter(p => normName(pastPlayerName(p)).includes(q)) : all;
  }, [data, search]);

  const team = data?.teamName ?? '';
  const season = data?.workingSeason ?? null;
  const empty = !!data && data.players.length === 0;

  async function submit() {
    if (ticked.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/past-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childIds: ticked }),
      });
      const body = await res.json().catch(() => null);
      const created: RepRosterPlayer[] = body?.created ?? [];
      const skipped: { message: string }[] = body?.skipped ?? [];
      if (created.length === 0) {
        setError(skipped[0]?.message ?? body?.error ?? 'Those players could not be brought back.');
        return;
      }
      const lead = created.length === 1
        ? `${playerName(created[0])} is back on the roster.`
        : `${pluralize(created.length, 'player')} are back on the roster.`;
      onAdded(created, [lead, ...skipped.map(s => s.message)].join(' '));
    } catch {
      setError('Those players could not be brought back. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuestionShell open={open} onClose={onClose} busy={busy} wide
      ariaLabel={PICKER_TITLE} title={PICKER_TITLE}
      headerExtra={!empty && data ? <span className={styles.discToggleMeta}>{pickerChosen(ticked.length)}</span> : undefined}
      footerStart={!empty && season ? <span className={styles.pastFootLine}>{pickerFootLine(season)}</span> : undefined}
      footer={empty || failed ? (
        <button type="button" className={styles.btnSecondary} onClick={onClose}>Close</button>
      ) : <>
        <QuestionCancel className={styles.btnSecondary} />
        <button type="button" className={styles.btnPrimary} onClick={() => void submit()}
          disabled={busy || ticked.length === 0}>
          {busy ? 'Bringing back…' : pickerSubmit(ticked.length)}
        </button>
      </>}>
      {failed ? (
        <p className={styles.formHint}>{PICKER_READ_FAILED}</p>
      ) : !data ? (
        <p className={styles.formHint}>Reading this team’s past players…</p>
      ) : empty ? (
        data.hasEarlierSeasons && season
          ? <p><b>{pickerEmptyAll(team, season)}</b></p>
          : <>
              <p><b>{PICKER_EMPTY_NONE}</b></p>
              <p className={styles.formHint}>{pickerEmptyNoneHint(team)}</p>
            </>
      ) : (
        <>
          {season && <p className={`${styles.pastHint} ${styles.pastHintDesk}`}>{pickerHint(team, season)}</p>}
          <input type="search" className={`${styles.input} ${styles.pastSearch}`} placeholder={PICKER_SEARCH}
            aria-label={PICKER_SEARCH} value={search} onChange={e => setSearch(e.target.value)} />
          {shown.length === 0 ? (
            <p className={styles.formHint}>{PICKER_NO_MATCH}</p>
          ) : (
            <div className={styles.debtList} role="group" aria-label={PICKER_TITLE}>
              <div className={styles.rollListBody}>
                {shown.map(p => {
                  const on = ticked.includes(p.childId);
                  const dues = duesChip(p);
                  // The phone's amber second line: the birth-year warning first, then money owing (tab 3, 390).
                  const warn = p.bornWarning ?? (dues?.tone === 'warn' ? dues.text : null);
                  return (
                    <label key={p.childId} className={`${styles.debtRow} ${on ? styles.debtRowOn : ''}`}>
                      <input type="checkbox" checked={on}
                        onChange={e => setTicked(t => e.target.checked ? [...t, p.childId] : t.filter(id => id !== p.childId))} />
                      <span className={styles.debtWhat}>
                        <b className={styles.pastRowName}>
                          {pastPlayerName(p)}
                          {p.status === 'inactive' && <span className={styles.chipQuiet}>Inactive</span>}
                          {p.status === 'callup' && <span className={styles.chipQuiet}>Call-up</span>}
                        </b>
                        <span className={styles.pastLineLong}>{pickerRowLine(p)}</span>
                        <span className={styles.pastLineShort}>{pickerRowLine(p, true)}</span>
                        {warn && <span className={styles.pastWarnLine}>{warn}</span>}
                      </span>
                      {(p.bornWarning || dues) && (
                        <span className={styles.pastChips}>
                          {p.bornWarning && p.dateOfBirth && <span className={`${styles.pastChip} ${styles.pastChipWarn}`}>{bornChip(p.dateOfBirth)}</span>}
                          {dues && <span className={`${styles.pastChip} ${dues.tone === 'good' ? styles.pastChipGood : styles.pastChipWarn}`}>{dues.text}</span>}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {season && <p className={`${styles.formHint} ${styles.pastHintDesk}`}>{pickerListedNote(season)}</p>}
        </>
      )}
      <QuestionReason className={styles.errorText}>{error}</QuestionReason>
    </QuestionShell>
  );
}
