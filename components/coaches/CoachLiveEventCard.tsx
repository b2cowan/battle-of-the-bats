import FanViewLink from '@/components/shared/FanViewLink';
import { deriveCoachLifecycleChip } from '@/lib/coach-tournament-lifecycle';
import type { FanViewRegistration } from '@/lib/coach-alert-registration';
import styles from './CoachLiveEventCard.module.css';

/**
 * CoachLiveEventCard — the overview's compact "your tournament" block ("The Flip" P3, owner call
 * 2026-07-23 rev 4). The ⇄ Fan view door originally sat beneath whatever live-event card the
 * overview's phase anchor happened to show — but that anchor isn't always about the tournament
 * ("Nothing on your schedule"), leaving the link floating with no event context. This block is
 * self-contained: a small card naming the event (lifecycle chip + name + dates) with the ⇄ Fan
 * view link beneath it. Deliberately NO follow/alert affordance (owner call 2026-07-23 — the
 * public side owns those; the portal doesn't push follow at the coach). ONE component for both
 * tiers so the block can't drift. Server-safe (no hooks).
 */

function formatRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  if (!end || end === start) return new Date(start).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${s} - ${new Date(end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function CoachLiveEventCard({ event }: { event: FanViewRegistration }) {
  const today = new Date().toISOString().split('T')[0];
  const chip = deriveCoachLifecycleChip(event.startDate, event.endDate, today);
  const live = chip.state === 'live' || chip.state === 'game_day';
  const upcoming = chip.state === 'upcoming' || chip.state === 'future';
  const dates = formatRange(event.startDate, event.endDate);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {live && (
          <span className={`${styles.chip} ${styles.chipLive}`}>
            <span className={styles.chipDot} aria-hidden />
            Live now
          </span>
        )}
        {upcoming && <span className={`${styles.chip} ${styles.chipUpcoming}`}>Upcoming</span>}
        <span className={styles.name}>{event.name ?? 'Your tournament'}</span>
        {dates && <span className={styles.dates}>{dates}</span>}
      </div>
      <FanViewLink orgSlug={event.orgSlug} tournamentSlug={event.tournamentSlug} />
    </div>
  );
}
