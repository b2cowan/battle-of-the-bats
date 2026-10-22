'use client';

import { useState } from 'react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import { repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { formatStoredDate } from '@/lib/timezone';
import { matchOwnTeamDivision } from '@/lib/own-team-division-match';
import { ADD_OUR_TEAMS_WORDS as W } from '@/lib/registration-words';
import type { OwnTeamOption } from '@/lib/club-own-teams-entry';
import type { Division } from '@/lib/types';
import styles from '../teams-admin.module.css';

/** One of the club's teams as the window lists it (the server's, lib/club-own-teams-entry.ts). */
export type { OwnTeamOption };

/**
 * ADD OUR TEAMS (Club Tier Stage 7b; drawing #e-add, Ask 5 A). One window, the club's teams, a division each; Add enters every
 * ticked team, accepted and linked, in one step, or none (the server names the team it refused). A computer shows a short table at
 * 640 (Team · Division, every row's field visible; picking a division ticks the row); a phone fills the screen and a ticked row
 * gets its full-width 44 px field under it. The count is the foot's sentence (`footerStart`); "Our teams enter with no fee" is a standing fact, so it ends the intro.
 */
export default function AddOurTeamsWindow({ options, divisions, orgSlug, tournamentId, onClose, onAdded }: {
  options: OwnTeamOption[];
  divisions: Division[];
  orgSlug: string | undefined;
  tournamentId: string;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const open = options.filter(o => o.state === 'open');
  const already = options.filter(o => o.state === 'in');
  const noSeason = options.filter(o => o.state === 'no-season');
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [chosen, setChosen] = useState<Map<string, string>>(() => new Map(
    open.map(o => [o.repTeamId, matchOwnTeamDivision(o, divisions) ?? ''] as const),
  ));
  // Only a team that is still open can be sent: the list can refresh under the window (another admin enters one), so the count
  // and the room left come from the open rows that are ticked, never from the raw ticks.
  const picked = open.filter(o => ticked.has(o.repTeamId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tick = (id: string, on: boolean) => {
    setError(null);
    setTicked(cur => { const next = new Set(cur); if (on) next.add(id); else next.delete(id); return next; });
  };
  const choose = (id: string, divisionId: string) => {
    setError(null);
    setChosen(cur => new Map(cur).set(id, divisionId));
    if (divisionId) tick(id, true);
  };

  /** Room left in a division for THIS row: its accepted teams and the other ticked rows going there. No refusal (owner Q3). */
  const roomLine = (id: string): string | null => {
    const division = divisions.find(d => d.id === chosen.get(id));
    if (!division || division.capacity == null) return null;
    const others = picked.filter(o => o.repTeamId !== id && chosen.get(o.repTeamId) === division.id).length;
    const left = division.capacity - (division.acceptedCount ?? 0) - others;
    return left > 0 ? W.spotsLeft(division.name, left) : W.full(division.name);
  };

  const add = async () => {
    const missing = picked.filter(o => !chosen.get(o.repTeamId)).map(o => o.name);
    if (missing.length) { setError(W.needsDivision(missing)); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/our-teams${orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, entries: picked.map(o => ({ repTeamId: o.repTeamId, divisionId: chosen.get(o.repTeamId) })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : W.failed); return; }
      onAdded(picked.length);
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  };

  const count = picked.length;
  const field = (o: OwnTeamOption) => {
    const room = ticked.has(o.repTeamId) ? roomLine(o.repTeamId) : null;
    return (
      <span className={styles.aotField}>
        <select
          className={ck.select}
          value={chosen.get(o.repTeamId) ?? ''}
          onChange={e => choose(o.repTeamId, e.target.value)}
          aria-label={W.divisionFor(o.name)}
          disabled={busy}
        >
          <option value="">{W.choose}</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {room && <span className={styles.aotRoom}>{room}</span>}
      </span>
    );
  };

  return (
    <KitDialog
      kind="form"
      size="medium"
      title={W.title}
      onClose={onClose}
      busy={busy}
      dirty={count > 0}
      openOn="panel"
      footerStart={count > 0 ? <span>{W.ticked(count)}</span> : undefined}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy || count === 0}>
            {busy ? W.adding : W.add(count)}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <p className={styles.aotIntro}>{W.intro}<span className={styles.aotIntroMore}> {W.introMore}</span> {W.noFee}</p>
      {options.length === 0 ? (
        <p className={repKit.dim}>{W.noTeams}</p>
      ) : (
        <div className={`${repKit.tableFrame} ${styles.aotFrame}`}>
          <table className={`${repKit.table} ${styles.aotTable}`}>
            <thead>
              <tr>
                <th className={styles.aotTickCol}><span className="sr-only">Tick</span></th>
                <th>{W.colTeam}</th>
                <th>{W.colDivision}</th>
              </tr>
            </thead>
            <tbody>
              {already.length > 0 && <tr className={repKit.band}><td colSpan={3}>{W.bandIn}</td></tr>}
              {already.map(o => {
                const line = W.enteredOn(o.enteredDivision ?? null, formatStoredDate(o.enteredAt ?? '', { withYear: false }));
                return (
                  <tr key={o.repTeamId} className={styles.aotDim}>
                    <td className={styles.aotTickCol}><input type="checkbox" className={screenParts.check22} checked disabled aria-label={o.name} /></td>
                    <td><span className={styles.aotName}>{o.name}</span><span className={styles.aotSubPhone}>{line}</span></td>
                    <td className={`${repKit.dim} ${styles.aotDivCell}`}>{line}</td>
                  </tr>
                );
              })}
              {open.length > 0 && <tr className={repKit.band}><td colSpan={3}>{W.bandYours}</td></tr>}
              {open.map(o => {
                const on = ticked.has(o.repTeamId);
                return (
                  <tr key={o.repTeamId} data-ticked={on || undefined}>
                    <td className={styles.aotTickCol}>
                      <input
                        type="checkbox"
                        className={screenParts.check22}
                        checked={on}
                        onChange={e => tick(o.repTeamId, e.target.checked)}
                        disabled={busy}
                        id={`aot-${o.repTeamId}`}
                      />
                    </td>
                    <td>
                      <label className={styles.aotName} htmlFor={`aot-${o.repTeamId}`}>{o.name}</label>
                      {!o.hasHeadCoach && <span className={styles.aotSub}>{W.noHeadCoach}</span>}
                      <span className={styles.aotPhoneField}>{on && field(o)}</span>
                    </td>
                    <td className={styles.aotDivCell}>{field(o)}</td>
                  </tr>
                );
              })}
              {noSeason.length > 0 && <tr className={repKit.band}><td colSpan={3}>{W.bandNoSeason}</td></tr>}
              {noSeason.map(o => (
                <tr key={o.repTeamId} className={styles.aotDim}>
                  <td className={styles.aotTickCol}><input type="checkbox" className={screenParts.check22} disabled aria-label={o.name} /></td>
                  <td><span className={styles.aotName}>{o.name}</span><span className={styles.aotSubPhone}>{W.noSeasonLine}</span></td>
                  <td className={`${repKit.dim} ${styles.aotDivCell}`}>{W.noSeasonLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.aotHint}>{W.hint}</p>
    </KitDialog>
  );
}
