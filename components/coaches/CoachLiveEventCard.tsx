import FanViewLink from '@/components/shared/FanViewLink';
import { deriveCoachLifecycleChip } from '@/lib/coach-tournament-lifecycle';
import type { FanViewRegistration } from '@/lib/coach-alert-registration';
import styles from './CoachLiveEventCard.module.css';
import { tournamentToday } from '@/lib/timezone';

/**
 * CoachLiveEventCard — the overview's compact "your tournament" block ("The Flip" P3, owner call
 * 2026-07-23 rev 4). The ⇄ Fan view door originally sat beneath whatever live-event card the
 * overview's phase anchor happened to show — but that anchor isn't always about the tournament
 * ("Nothing on your schedule"), leaving the link floating with no event context. This block is
 * self-contained: a small card naming the event (lifecycle chip + name + dates) with the ⇄ Fan
 * view link beneath it. Deliberately NO follow/alert affordance (owner call 2026-07-23 — the
 * public side owns those; the portal doesn't push follow at the coach). Server-safe (no hooks).
 *
 * ⚠ TRUTH-UP 2026-07-30 (DF-1): this is now the PREMIUM tail row only. It used to be the "one
 * component for both tiers" block, but the free Overview's copy sat directly beneath a list that
 * already named the same tournament — so the free side folded into the single shared
 * `CoachRegistrationCard`, which is also a door to the record. `layout="card"` therefore has no
 * caller today; it is kept because it is the honest standalone presentation and costs nothing.
 * The shared rules the old comment protected did not move: lifecycle derivation lives in
 * `lib/coach-tournament-lifecycle`, and which registration counts as "current" plus whether a row
 * has a fan-view door both live in `lib/coach-alert-registration` — so a new state still lands on
 * both tiers by construction.
 */

function formatRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  if (!end || end === start) return new Date(start).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${s} - ${new Date(end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function CoachLiveEventCard({
  event,
  layout = 'card',
}: {
  event: FanViewRegistration;
  /** 'card' = the standalone block (free portal); 'row' = one line in the premium tail. */
  layout?: 'card' | 'row';
}) {
  const today = tournamentToday();
  const chip = deriveCoachLifecycleChip(event.startDate, event.endDate, today);
  const live = chip.state === 'live' || chip.state === 'game_day';
  const upcoming = chip.state === 'upcoming' || chip.state === 'future';
  const dates = formatRange(event.startDate, event.endDate);

  const stateChip = live ? (
    <span className={`${styles.chip} ${styles.chipLive}`}>
      <span className={styles.chipDot} aria-hidden />
      Live now
    </span>
  ) : upcoming ? (
    <span className={`${styles.chip} ${styles.chipUpcoming}`}>Upcoming</span>
  ) : chip.state === 'complete' ? (
    // Chunk I: a FINISHED event used to render with no chip at all — the card drew Live or
    // Upcoming and then went silent, so a tournament that ended two weeks ago sat in exactly the
    // slot a live one occupies, indistinguishable from it. Silence is not a state.
    <span className={`${styles.chip} ${styles.chipDone}`}>Finished</span>
  ) : (
    // 'unknown' (an event with no start date) is the ONE case that legitimately has nothing to
    // say. Labelling it "Finished" would be a guess dressed as a fact — the opposite of the fix
    // above, and it would have reached the free tier too.
    null
  );

  if (layout === 'row') {
    return (
      <div className={styles.row}>
        {stateChip}
        <span className={styles.name}>{event.name ?? 'Your tournament'}</span>
        {dates && <span className={styles.dates}>{dates}</span>}
        <FanViewLink orgSlug={event.orgSlug} tournamentSlug={event.tournamentSlug} />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {stateChip}
        <span className={styles.name}>{event.name ?? 'Your tournament'}</span>
        {dates && <span className={styles.dates}>{dates}</span>}
      </div>
      <FanViewLink orgSlug={event.orgSlug} tournamentSlug={event.tournamentSlug} />
    </div>
  );
}
