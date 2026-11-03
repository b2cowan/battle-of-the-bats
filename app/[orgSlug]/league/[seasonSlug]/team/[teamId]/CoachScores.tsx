'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Check, Flag } from 'lucide-react';
import { SCORE_WORDS as W, type CoachScoreRow } from '@/lib/league-coach-scores';
import { orgDayKey } from '@/lib/timezone';
import { When, clockAt } from './CoachSchedule';
import column from '../../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';
import s from './CoachScores.module.css';

// Loaded when a coach opens a window, as Subscribe's is: the window wears the portal's stylesheet, which it brings with it.
const EnterScoreWindow = dynamic(() => import('./CoachScoreWindows').then(m => m.EnterScoreWindow), { ssr: false });
const ReportScoreWindow = dynamic(() => import('./CoachScoreWindows').then(m => m.ReportScoreWindow), { ssr: false });

/**
 * THE COACH'S SCORES (House League 9e-3, rulings 9e·7 to 9e·9; COPY §5–§7, drawings c1–c3): the team's started games,
 * newest first. The home team's coach has "Enter the score" (from the start time, even yesterday's) and, while the score is
 * theirs to change, "Change the score"; the away coach reads who entered it and has "Report this score" (a phone shows the
 * flag mark alone). The rows and their lines are decided on the server (`coachScoreView`): this island only opens the
 * windows, says the toast, and reads the page again so the standing line moves with the score. Nobody is emailed.
 */
export default function CoachScores({ rows, standings, live, orgSlug, seasonSlug, teamId }: {
  rows: CoachScoreRow[];
  /** The division's "Show standings": where a score counts. */
  standings: boolean;
  /** A live season (a finished one lists its scores with no doors and no foot). */
  live: boolean;
  orgSlug: string;
  seasonSlug: string;
  teamId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<CoachScoreRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const today = orgDayKey(new Date().toISOString());
  const base = `/api/league/${encodeURIComponent(orgSlug)}/${encodeURIComponent(seasonSlug)}/team/${teamId}/games`;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const done = (said: string) => { setOpen(null); setToast(said); router.refresh(); };
  const windowProps = { onStale: () => router.refresh(), onClose: () => setOpen(null) };

  return (
    <>
      {rows.length > 0 && (
        <ul className={`${kit.list} ${s.list}`}>
          {rows.map(r => {
            const scored = r.homeScore != null && r.awayScore != null;
            const door = r.view.door;
            const press = (e: MouseEvent<HTMLButtonElement>) => { opener.current = e.currentTarget; setOpen(r); };
            return (
              <li key={r.gameId} className={`${s.row} ${door === 'enter' ? s.rowEnter : ''}`}>
                {/* The day, the match, the place: the public schedule's own words, one short block. */}
                <div className={s.text}>
                  <When iso={r.startsAt} today={today} />
                  <span className={column.matchName}>{r.homeName} vs {r.awayName} · {clockAt(r.startsAt)}</span>
                  {(r.place || r.home) && (
                    <span className={column.place}>
                      {r.place}
                      {r.home && <span className={s.home}>{W.homeTag}</span>}
                    </span>
                  )}
                </div>
                {/* The result is the row's biggest thing. A screen reader still hears "Final 7–4". */}
                {scored && (
                  <span className={s.score}>
                    <span className={s.sr}>{W.final(r.homeScore!, r.awayScore!)}</span>
                    <span aria-hidden>{r.homeScore}–{r.awayScore}</span>
                  </span>
                )}
                {r.view.line && <span className={`${column.place} ${s.line}`}>{r.view.line}</span>}
                {door === 'enter' && (
                  <button type="button" className={`${kit.btn} ${kit.btnOutline} ${kit.btnSm} ${s.door}`} onClick={press}>{W.enter}</button>
                )}
                {/* An entered score is not a to-do: Change is a quiet word, Report the flag alone on a phone. */}
                {door === 'change' && (
                  <button type="button" className={`${s.change} ${s.door}`} aria-label={W.change} onClick={press}>{W.changeShort}</button>
                )}
                {door === 'report' && (
                  <button type="button" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${s.flag} ${s.door}`}
                    aria-label={W.report} onClick={press}>
                    <Flag size={16} aria-hidden />
                    <span className={s.flagLabel}>{W.report}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {live && <p className={kit.sub}>{W.foot(standings)}</p>}
      {open && (open.view.door === 'report'
        ? <ReportScoreWindow row={open} endpoint={`${base}/${open.gameId}/report`} opener={opener} {...windowProps} onSaved={() => done(W.repToast)} />
        : <EnterScoreWindow row={open} standings={standings} endpoint={`${base}/${open.gameId}/score`} opener={opener} {...windowProps} onSaved={() => done(W.saved(standings))} />)}
      <div className={s.toast} data-shown={toast ? 'yes' : 'no'} role="status" aria-live="polite">
        {toast && <><Check size={14} aria-hidden /> {toast}</>}
      </div>
    </>
  );
}
