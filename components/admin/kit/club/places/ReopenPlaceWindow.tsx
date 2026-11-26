'use client';
/**
 * REOPEN A PLACE (Club Website Stage 2, K11 A; the drawing's tab 3, "Reopen"). The question, then its result in the same
 * window. Reopen takes the strip and every rep mark down at once and emails each marked game's coach one line; it moves
 * no game, so the postponed house league games stay under "Needs a new date" and the result goes straight to giving them
 * new dates (which tells their families, as today).
 */
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { CLOSE_WORDS as W, type StaffClosure } from '@/lib/place-closure-window';
import { closedPlaceName } from '@/lib/place-closures';
import s from './ClosePlace.module.css';

export type ReopenClosure = Pick<StaffClosure, 'id' | 'scope' | 'placeName' | 'facilityName' | 'firstDay' | 'leagueCalledOff' | 'seasonIds' | 'marks' | 'markTeams' | 'markTeamNames'>;

export default function ReopenPlaceWindow({ orgSlug, closure, onReopened, onClose }: {
  orgSlug: string;
  closure: ReopenClosure;
  onReopened: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ coaches: number; stillWaiting: number; seasonIds: string[] } | null>(null);
  const place = closedPlaceName(closure) ?? W.everyPlace;
  const coaches = closure.markTeams.length;

  async function reopen() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/org/place-closures/${closure.id}?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reopen' }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok || !data) { setError((data as { error?: string } | null)?.error ?? W.loadFailed); return; }
    onReopened();
    const d = data as { coaches: number; stillWaiting: number; seasonIds?: string[] };
    setDone({ coaches: d.coaches, stillWaiting: d.stillWaiting, seasonIds: d.seasonIds ?? closure.seasonIds });
  }

  if (done) {
    const seasonHref = done.seasonIds[0] ? `/${orgSlug}/admin/house-league/seasons/${done.seasonIds[0]}/schedule` : null;
    return (
      <KitDialog kind="form" eyebrow={W.dayValue(closure.firstDay, '')} title={W.reopened(place)} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.done}</DialogCancel>
            {done.stillWaiting > 0 && seasonHref && <Link className="btn btn-lime" href={seasonHref}>{W.newDates}</Link>}
          </>
        )}>
        <div className={`${ck.notice} ${ck.noticeGood}`} aria-live="polite">
          <CheckCircle2 size={16} aria-hidden />
          <span className={ck.noticeBody}>{W.reopenedSite(done.coaches, closure.markTeamNames.length === 1 ? closure.markTeamNames[0] : null)}</span>
        </div>
        {done.stillWaiting > 0 && (
          <div className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden />
            <span className={ck.noticeBody}><b>{W.reopenedStill(done.stillWaiting)}</b>{W.reopenedStillRest(done.stillWaiting)}</span>
          </div>
        )}
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="question" title={W.reopenTitle(place)} onClose={onClose} busy={busy}
      footer={(
        <>
          <DialogCancel>{W.reopenKeep}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void reopen()}>{W.reopenGo(coaches)}</button>
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <p className={s.para}>{W.reopenSite}</p>
      {closure.marks > 0 && <p className={s.para}>{W.reopenMarks(closure.marks, closure.markTeamNames.length === 1 ? closure.markTeamNames[0] : null, place)}</p>}
      {closure.leagueCalledOff > 0 && <p className={s.para}><b>{W.reopenStill(closure.leagueCalledOff)}</b>{W.reopenStillRest}</p>}
    </KitDialog>
  );
}
