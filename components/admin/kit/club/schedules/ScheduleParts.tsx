'use client';
/** Shared schedule state, team swatch, summary band, and statement components. */
import type { CSSProperties, ReactNode } from 'react';
import { RepChip } from '../RepKit';
import { SCHEDULE_WORDS } from '@/lib/club-schedule-words';
import sch from './Schedules.module.css';

/** The one state chip, only where it needs saying: Draft · In review (olive) · the amber Changed since sent. A sent
 *  schedule with nothing waiting says nothing more. */
export function ScheduleStateChip({ state, changed }: { state: 'draft' | 'in_review' | 'final'; changed: boolean }) {
  if (state === 'final') return changed ? <RepChip tone="warn">{SCHEDULE_WORDS.changedSinceSent}</RepChip> : null;
  if (state === 'in_review') return <span className={sch.reviewChip}>{SCHEDULE_WORDS.inReview}</span>;
  return <RepChip>{SCHEDULE_WORDS.draft}</RepChip>;
}

/** A team's colour as a small square — the one lead mark a list row carries (§3.10.7), never a rail on the row. */
export function Swatch({ colour }: { colour: string }) {
  return <span className={sch.swatch} style={{ '--tc': colour } as CSSProperties} aria-hidden />;
}

/** The statement box: one bold lead, the rest, and its bullets — what saving (or sending) does, said once. */
export function Statement({ lead, rest, bullets }: { lead: ReactNode; rest?: ReactNode; bullets?: readonly string[] }) {
  return (
    <div className={sch.statement}>
      <b>{lead}</b>{rest ? <> {rest}</> : null}
      {bullets && bullets.length > 0 && <ul>{bullets.map(b => <li key={b}>{b}</li>)}</ul>}
    </div>
  );
}

/** The joined band: tiles CONNECTED, never cards with gaps (2026-10-08) — Fair shares' four figures. `across`: one row of
 *  four, above the toolbar (Fair shares B); otherwise two by two. */
export function JoinedBand({ tiles, label, across = false }: { label: string; across?: boolean; tiles: { key: string; label: string; value: ReactNode; amber?: boolean }[] }) {
  return (
    <div className={`${sch.band}${across ? ` ${sch.bandAcross}` : ''}`} role="group" aria-label={label}>
      {tiles.map(t => (
        <div key={t.key} className={sch.bandTile}>
          <span className={sch.bandLabel}>{t.label}</span>
          <span className={`${sch.bandValue}${t.amber ? ` ${sch.amber}` : ''}`}>{t.value}</span>
        </div>
      ))}
    </div>
  );
}
