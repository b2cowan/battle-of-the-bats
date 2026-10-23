'use client';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { pickTodayRow } from '@/lib/coach-schedule-phone';
import { tournamentToday } from '@/lib/timezone';

/**
 * THE LIST OPENS ON TODAY, IN ITS OWN FRAME, AT EVERY WIDTH (phone stage 2 · C1, owner 2026-09-21: "open on today's date,
 * not open then scroll"; at a desk too since Club Tier 6c, Ask 3 — standard §11 C3). The coach's Schedule and a team's
 * schedule (admin) open their season list through here, so the two cannot open differently.
 *
 * Before first paint: the frame's top is published (`--schedule-frame-top`) for the stylesheet to size the frame from
 * (`.scheduleListFrame`, clear of the shell's bottom bar), and the list is positioned with TODAY at the top — the now
 * line under its pinned month band, or the last row when the season is behind today (the spacer under the list,
 * `tailRef`, lets it reach the top). The DAY decides, never the instant (`pickTodayRow` on the rows' `data-day`).
 * `trigger` is what makes an open a fresh one (the loaded list, the view, the team).
 *
 * `day` (Club Tier Stage 7d): a link that names a DAY — "Games on your Schedule" on a tournament's page,
 * `?day=YYYY-MM-DD` — opens the list on that day instead of today (its first row on or after it; no
 * now line, which marks today). A day, never a year: the list stays the working season's.
 */
export function useScheduleOpensOnToday({ scrollerRef, tailRef, active, trigger, day = null }: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  tailRef: RefObject<HTMLDivElement | null>;
  /** The List is on screen and loaded. */
  active: boolean;
  trigger: string;
  /** Open on this club-local day (`YYYY-MM-DD`) instead of today. */
  day?: string | null;
}) {
  // The linked day belongs to the FIRST open only: a later fresh open (another view and back, a reload of the
  // list after an add) opens on today again, as every other visit does. A re-run of the same open (same
  // `trigger`, e.g. StrictMode's second pass) keeps the day.
  const dayOpenedAt = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const linkedDay = day && (dayOpenedAt.current === null || dayOpenedAt.current === trigger) ? day : null;
    const fit = () => scroller.style.setProperty('--schedule-frame-top', `${Math.round(scroller.getBoundingClientRect().top + window.scrollY)}px`);
    fit();
    window.addEventListener('resize', fit);
    if (getComputedStyle(scroller).overflowY === 'auto') {
      const rows = Array.from(scroller.querySelectorAll<HTMLElement>('[data-day]'));
      const today = linkedDay ?? tournamentToday();
      const at = pickTodayRow(rows.map(r => r.dataset.day ?? ''), today);
      if (linkedDay && at >= 0) dayOpenedAt.current = trigger;
      // No dated row to open on (an empty season, only games still to be scheduled): no spacer either — a frame of
      // empty paper to scroll would read as something missing.
      if (at < 0 && tailRef.current) tailRef.current.style.height = '0px';
      if (at >= 0) {
        // The now line when a row is still ahead of it; the last row when the season is behind it.
        const nowLine = linkedDay ? null : scroller.querySelector<HTMLElement>('[data-now-line]');
        const target = nowLine && (rows[rows.length - 1].dataset.day ?? '') >= today ? nowLine : rows[at];
        const bandH = scroller.querySelector<HTMLElement>('[data-row-band]')?.offsetHeight ?? 0;
        // A box's top inside the scroller — summed up the offset chain, since a row's own offsetParent is the frame.
        const topIn = (el: HTMLElement) => {
          let t = 0;
          for (let n: HTMLElement | null = el; n && n !== scroller; n = n.offsetParent as HTMLElement | null) t += n.offsetTop;
          return t;
        };
        const targetTop = topIn(target);
        const tail = tailRef.current;
        if (tail) {
          tail.style.height = '0px';
          tail.style.height = `${Math.max(0, targetTop - bandH + scroller.clientHeight - topIn(tail))}px`;
        }
        scroller.scrollTop = Math.max(0, targetTop - bandH);
      }
    }
    return () => window.removeEventListener('resize', fit);
  }, [active, trigger, scrollerRef, tailRef, day]);
}
