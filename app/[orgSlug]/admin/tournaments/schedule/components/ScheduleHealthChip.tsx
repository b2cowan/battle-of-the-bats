'use client';

/**
 * Schedule Health chip (C4) — an always-visible at-a-glance score in the sticky
 * planning toolbar. Tapping opens the full health detail WITHOUT moving the
 * user's scroll position: a `BottomSheet` on mobile, an anchored popover on
 * desktop. Both reuse `ScheduleHealthContent`; the inline panel below stays as
 * the home for the full breakdown (incl. team table).
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { ScheduleMetrics } from '@/lib/schedule-metrics';
import BottomSheet from '@/components/admin/BottomSheet';
import { ScheduleHealthContent } from './ScheduleHealthPanel';
import styles from '../schedule-admin.module.css';

export default function ScheduleHealthChip({ metrics }: { metrics: ScheduleMetrics }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Desktop popover: dismiss on outside-click + Esc (the mobile sheet handles its own).
  useEffect(() => {
    if (!open || isMobile) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  const warningCount = metrics.venueConflictCount + metrics.bufferConflictCount + metrics.travelBufferWarningCount;
  const warnTone = metrics.venueConflictCount > 0 ? 'danger' : 'warning';

  return (
    <div className={styles.healthChipWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.healthChip}
        data-tone={metrics.healthTone}
        aria-expanded={open}
        aria-label={`Schedule health ${metrics.healthScore} of 100${warningCount > 0 ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}`}
        onClick={() => setOpen(value => !value)}
      >
        <span className={styles.healthChipDot} aria-hidden />
        <span className={styles.healthChipScore}>{metrics.healthScore}</span>
        <small className={styles.healthChipMax}>/100</small>
        {warningCount > 0 && (
          <span className={styles.healthChipWarn} data-tone={warnTone} aria-hidden>⚠ {warningCount}</span>
        )}
        <ChevronDown size={13} className={styles.healthChipCaret} aria-hidden />
      </button>

      {open && !isMobile && (
        <div className={styles.healthPopover} role="dialog" aria-label="Schedule health detail">
          <div className={styles.healthPopoverHead}>
            <Activity size={13} aria-hidden />
            <span>Schedule Health</span>
            <strong data-tone={metrics.healthTone}>{metrics.healthScore}<small>/100</small></strong>
          </div>
          <div className={styles.healthPopoverBody}>
            <ScheduleHealthContent metrics={metrics} showTeamTable={false} />
          </div>
        </div>
      )}

      {isMobile && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={`Schedule Health · ${metrics.healthScore}/100`}
          ariaLabel="Schedule health detail"
        >
          <ScheduleHealthContent metrics={metrics} showTeamTable />
        </BottomSheet>
      )}
    </div>
  );
}
