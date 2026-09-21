'use client';
import { Check, TriangleAlert, X } from 'lucide-react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell from './QuestionShell';
import { CoachRowList, CoachRowBand, CoachRow } from './CoachRowList';
import s from './LineupCheck.module.css';

/**
 * THE LINEUP CHECK — everything a lineup still needs from the coach, behind ONE door (owner,
 * 2026-09-18: "a single banner telling me that I have issues in multiple innings, then I click it
 * to see a modal … then click through each inning in the existing modal to remedy. 7 rows above
 * the lineup on the main page is not a good user experience").
 *
 * What the builder used to stack above the grid — the attendance mismatch strip with its Add /
 * Remove buttons, one card per inning with open roles, the clash line, the uneven-bench line — is
 * this one Question, in three groups: Attendance (the same one-tap fixes), Innings (one row per
 * inning that needs a decision, each a door into the inning lens), Fair play. The strip on the
 * page keeps only the state, the mark and one sentence naming what is waiting.
 *
 * ⚠ It lists reasons, it never guesses causes: an inning row says which roles are open and how
 * many players are undecided; the one proven cause the generator can name (no eligible pitcher
 * under the cap, D7) is the only cause on a row. The rest is the lens's job, role by role.
 */

export type LineupMarkState = 'ok' | 'warn' | 'bad';

/** The status symbol — one round mark, the same on the builder's strip, this check's header and
 *  the inning lens's header. The word beside it carries the meaning; `label` is that word for
 *  assistive tech where the mark stands alone. */
export function LineupStateMark({ state, label, inHeader = false }: { state: LineupMarkState; label: string; inHeader?: boolean }) {
  const Icon = state === 'ok' ? Check : state === 'bad' ? X : TriangleAlert;
  return (
    <span className={`${s.mark}${inHeader ? ` ${s.headerMark}` : ''}`} data-state={state} role="img" aria-label={label}>
      <Icon size={14} strokeWidth={3} aria-hidden />
    </span>
  );
}

export interface LineupCheckInning {
  inning: number;
  state: 'warn' | 'bad';
  /** "P, 2B open · 2 players undecided" — the facts, joined. */
  caption: string;
}

export interface LineupCheckAttendance {
  /** Players marked In or Late on the Schedule who are not in the lineup. */
  coming: string[];
  /** Players in the lineup whom the Schedule has marked Out. */
  out: string[];
  onAddComing: () => void;
  onRemoveOut: () => void;
}

export interface LineupCheckProps {
  open: boolean;
  onClose: () => void;
  state: LineupMarkState;
  /** The word the mark stands for, when the builder has a more exact one than the state's default
   *  — "Marked ready" on a lineup the coach has marked ready with innings still open (D11). */
  stateLabel?: string;
  subtitle: string;
  periodLabel: string;
  attendance?: LineupCheckAttendance;
  innings: LineupCheckInning[];
  /** The innings nobody has started — one row ("Innings 4–7 · Not started"), opening the first. */
  untouched: { label: string; first: number } | null;
  /** The one shared fact across the open-role innings, said once on the band — "P open in all 6". */
  patternNote: string | null;
  /** Bench innings spread, when uneven enough to say so. */
  benchSpread: { min: number; max: number } | null;
  onOpenInning: (inning: number) => void;
  onOpenPlayingTime: () => void;
}

export default function LineupCheck({
  open, onClose, state, stateLabel, subtitle, periodLabel, attendance, innings, untouched, patternNote, benchSpread, onOpenInning, onOpenPlayingTime,
}: LineupCheckProps) {
  const period = periodLabel.toLowerCase();
  const hasAttendance = !!attendance && (attendance.coming.length > 0 || attendance.out.length > 0);
  const hasInnings = innings.length > 0 || untouched != null;
  const stateWord = stateLabel ?? (state === 'ok' ? 'every role covered' : state === 'bad' ? 'position clash' : 'needs a decision');

  return (
    <QuestionShell
      open={open}
      onClose={onClose}
      ariaLabel="Lineup check — what this lineup still needs"
      title="Lineup check"
      subtitle={subtitle}
      headerExtra={<LineupStateMark state={state} label={stateWord} inHeader />}
      scroll
      wide
    >
      <div className={`${coach.scrollPane} ${s.body}`}>
        {hasAttendance && attendance && (
          <>
            <CoachRowList inset label="Attendance">
              <CoachRowBand>Attendance</CoachRowBand>
              {/* The FACT is the title; the names are the caption — a caption wraps without limit,
                  a title clamps at two lines, and a game can have five names here. */}
              {attendance.out.length > 0 && (
                <CoachRow
                  mark={<LineupStateMark state="warn" label="Marked Out" />}
                  title="In the lineup but marked Out on the Schedule"
                  caption={attendance.out.join(', ')}
                  beside={
                    <button type="button" className={coach.btnSecondary} onClick={attendance.onRemoveOut}>
                      Remove {attendance.out.length} Out {attendance.out.length === 1 ? 'player' : 'players'}
                    </button>
                  }
                />
              )}
              {attendance.coming.length > 0 && (
                <CoachRow
                  mark={<LineupStateMark state="warn" label="Marked in" />}
                  title="Marked in on the Schedule but not in the lineup"
                  caption={attendance.coming.join(', ')}
                  beside={
                    <button type="button" className={coach.btnSecondary} onClick={attendance.onAddComing}>
                      Add {attendance.coming.length} coming {attendance.coming.length === 1 ? 'player' : 'players'}
                    </button>
                  }
                />
              )}
            </CoachRowList>
            <p className={s.note}>Nothing changes until you tap a button — or fix the attendance on the Schedule if that&apos;s what&apos;s wrong.</p>
          </>
        )}

        {hasInnings && (
          <CoachRowList inset label={`${periodLabel}s that need a decision`}>
            <CoachRowBand>
              {periodLabel}s{patternNote && <span className={s.bandNote}> · {patternNote}</span>}
            </CoachRowBand>
            {innings.map(row => (
              <CoachRow
                key={row.inning}
                as="button"
                onClick={() => onOpenInning(row.inning)}
                mark={<LineupStateMark state={row.state} label={row.state === 'bad' ? 'Position clash' : 'Open'} />}
                title={`${periodLabel} ${row.inning}`}
                caption={row.caption}
                door={{ label: 'Review' }}
                aria-label={`Review ${period} ${row.inning} — ${row.caption}`}
              />
            ))}
            {untouched && (
              <CoachRow
                as="button"
                onClick={() => onOpenInning(untouched.first)}
                mark={<LineupStateMark state="warn" label="Not started" />}
                title={untouched.label}
                titleWeight="plain"
                caption="Not started — every role is still open"
                door={{ label: 'Review', quiet: true }}
              />
            )}
          </CoachRowList>
        )}

        {benchSpread && (
          <CoachRowList inset label="Fair play">
            <CoachRowBand>Fair play</CoachRowBand>
            <CoachRow
              as="button"
              onClick={onOpenPlayingTime}
              mark={<LineupStateMark state="warn" label="Uneven" />}
              title="Uneven bench time"
              titleWeight="plain"
              caption={`Players sit between ${benchSpread.min} and ${benchSpread.max} ${period}s.`}
              door={{ label: 'Playing time' }}
            />
          </CoachRowList>
        )}
      </div>
    </QuestionShell>
  );
}
