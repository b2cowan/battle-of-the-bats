'use client';
/**
 * "Birth years" in the Add division and Edit division windows (Club Tier Stage 4c-2 Part A; copy B1–B4, C12(b), K5). One
 * more field in the window: the boxes are the shared pair (`BornYearsBoxes`, in the kit's own field look since the windows
 * moved onto the kit — Club Tier Stage 9a, Part 4); the hint, the held line and the cut-off sentence stay here, and the
 * window has no "Change in Settings" link (B3). The rule is `lib/born-years.ts`; what to say and whether Save may go is
 * `divisionBornState`, worked out ONCE by the window (it needs the same answer for its button) and handed down — this file
 * only draws it.
 */
import { cutoffSentence, divisionBornHint, type Cutoff } from '@/lib/born-years';
import { BornYearsBoxes } from '@/components/admin/kit/club/BornYears';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import born from '@/components/admin/kit/club/BornYears.module.css';
import type { divisionBornState } from '@/lib/birthday-cutoff';

export default function DivisionBornYears({
  idPrefix, from, to, state, onChange, cutoff, sportLabel,
}: {
  idPrefix: string;
  from: string;
  to: string;
  /** What the boxes say and whether Save may go (`divisionBornState`) — the window's one answer, also read by its button. */
  state: ReturnType<typeof divisionBornState>;
  onChange: (from: string, to: string) => void;
  cutoff: Cutoff;
  /** The season's sport, as families and the admin read it ("Softball"). */
  sportLabel: string;
}) {
  const describedBy = `${idPrefix}-born-note`;

  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${idPrefix}-born-label`}>Birth years</span>
      <div role="group" aria-labelledby={`${idPrefix}-born-label`}>
        <BornYearsBoxes
          from={from}
          to={to}
          onFrom={v => onChange(v, to)}
          onTo={v => onChange(from, v)}
          cutoff={cutoff}
          held={!!state.held}
          describedBy={describedBy}
        />
      </div>
      <p id={describedBy} className={state.held ? born.held : ck.hint} role={state.held ? 'alert' : undefined}>
        {state.held ?? divisionBornHint(state.years ?? { from: null, to: null }, cutoff)}
      </p>
      <p className={ck.hint}>{cutoffSentence(sportLabel, cutoff)}</p>
    </div>
  );
}
