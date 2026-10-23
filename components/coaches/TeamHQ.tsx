import { CalendarClock, CircleDollarSign, Megaphone, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import LocalDateTime from './LocalDateTime';
import type { BasicCoachRegistrationGame } from '@/lib/basic-coach-teams';
import styles from './TeamHQ.module.css';
import { homeAwayWord } from '@/lib/game-clock-labels';

// Shared Team HQ shell (slice 5g). Source-agnostic: callers pass already-computed
// counts/values — this component never re-fetches.
//   - `standalone`  = the org-less Basic team home stat strip (5g).
//   - `tournament`  = the phase-adaptive tournament-coach hero (5h): Pending /
//                     Accepted-Prep today; 5i adds the game-day bridge, 5m the
//                     afterglow. Stays read-only + pitch-free pre-event.

type StandaloneTeamHQProps = {
  variant: 'standalone';
  rosterCount: number;
  nextEvent: { title: string; startsAt: string } | null;
  /** C5: registration-fed fallback for the schedule tile — a freshly-claimed team's
   *  Overview said "Schedule: None" during a live tournament. Only consulted when
   *  `nextEvent` is null (the coach's own entries always win the tile). */
  registrationGame?: BasicCoachRegistrationGame | null;
  /** Self-entered player-fee ledger (money owed TO the coach). */
  unpaidTotal: number;
  unpaidCount: number;
  /** WI-2A: the real TOURNAMENT entry fee owed to the ORGANIZER, summed across the team's accepted
   *  registrations. `null` when the team is in no tournament (no fee context) — the Fees tile then
   *  shows only the self-entered player fees, unchanged. `0` means clear/paid. */
  tournamentFee?: number | null;
  recipientCount: number;
  historyCount: number;
  latestHistoryLabel: string;
  /** DF-5: Tier-2 tools already switched on (mig 131). A tile for a tool that is OFF and genuinely
   *  empty says what it would give the coach instead of reporting a zero — five tiles reading
   *  `0 · None · $0.00 · 0` was the free tier's version of "explanatory chrome outranking the
   *  coach's own information". Omitted → every tile keeps its number (the tournament variant and
   *  any future caller are unaffected). */
  activatedFeatures?: string[];
  /** DF-1/DF-3: the Tournaments tile is now the door to the full list, which left the Overview
   *  when it stopped duplicating the Tournaments tab. Omitted → a plain, doorless tile. */
  historyHref?: string;
};

/* ⚰ The `tournament` variant (the record page's tinted hero) is GONE — Club Tier Stage 7d (T4): the coach's
   tournament page states its status once, as a chip under the title. Only the free Overview's strip remains. */
type TeamHQProps = StandaloneTeamHQProps;

// Kept identical to the helper that previously lived in the standalone page so money
// renders byte-for-byte the same after the extraction.
function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

/** DF-5 — the honest "this tool isn't on yet" face for a tile, in companion voice (one short warm
 *  line, never the premium empty states' teaching contract). Deliberately NOT a link: the tile stays
 *  a read-only stat, so it can't rebuild the one-way door the setup panel exists to close. */
const OFF_TILE: Record<'roster' | 'schedule' | 'fees' | 'announcements', string> = {
  roster: 'Keep your team list, reuse it every event.',
  schedule: 'Your practices beside your tournament games.',
  fees: 'Track who has paid you.',
  announcements: 'One message to every parent.',
};

function StandaloneTeamHQ({
  rosterCount,
  nextEvent,
  registrationGame,
  unpaidTotal,
  unpaidCount,
  tournamentFee,
  recipientCount,
  historyCount,
  latestHistoryLabel,
  activatedFeatures,
  historyHref,
}: StandaloneTeamHQProps) {
  // C5: with no self-entered events, borrow the live/next game from the team's
  // tournament registration instead of claiming "None" mid-event.
  const regGame = nextEvent ? null : registrationGame ?? null;

  // DF-5: a tile goes to its "not on" face only when the tool is off AND it has nothing real to
  // report. The tool sub-routes are NOT gated on activation (a coach can reach /schedule by
  // bookmark and add an event while the tool stays off), and the Fees tile also carries the REAL
  // tournament entry fee owed to the organizer — which has nothing to do with the fees tool. So
  // "not on" must never be printed over a number that exists: that would be a worse lie than the
  // zero it replaces.
  const off = (key: keyof typeof OFF_TILE, empty: boolean) =>
    empty && activatedFeatures !== undefined && !activatedFeatures.includes(key);
  const rosterOff = off('roster', rosterCount === 0);
  const scheduleOff = off('schedule', !nextEvent && !regGame);
  const feesOff = off('fees', tournamentFee == null && unpaidCount === 0 && unpaidTotal === 0);
  const announcementsOff = off('announcements', recipientCount === 0);
  const regGameScore = regGame && regGame.myScore !== null && regGame.oppScore !== null
    ? `${regGame.myScore}–${regGame.oppScore}`
    : null;
  const regGameSub = regGame
    ? [
        regGame.dateLabel,
        regGame.timeLabel,
        regGame.location,
        regGame.tournamentName ? `from ${regGame.tournamentName}` : null,
      ].filter(Boolean).join(' · ')
    : null;
  // A3.2: named "At a glance" (the visible h2 lives in the Overview page). Never "HQ" —
  // that's the Premium tier's word (companion vs HQ framing).
  return (
    <section className={styles.hqStrip} aria-label="At a glance">
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><Users size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Roster</span>
          {rosterOff ? (
            <><strong className={styles.hqOff}>Not on</strong><p>{OFF_TILE.roster}</p></>
          ) : (
            <>
              <strong>{rosterCount}</strong>
              <p>{rosterCount === 1 ? '1 player' : `${rosterCount} players`}</p>
            </>
          )}
        </div>
      </div>
      <div className={`${styles.hqItem}${regGame ? ` ${styles.hqItemReg}` : ''}`}>
        <div className={styles.hqIcon}><CalendarClock size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Schedule</span>
          {scheduleOff ? (
            <><strong className={styles.hqOff}>Not on</strong><p>{OFF_TILE.schedule}</p></>
          ) : regGame ? (
            <>
              <strong>
                {homeAwayWord(regGame.isHome)} {regGame.opponentName}
                {regGame.isLive && regGameScore ? ` · ${regGameScore}` : ''}
                {regGame.isLive && (
                  <span className={styles.hqLive}>
                    <span className={styles.hqLiveDot} aria-hidden />LIVE
                  </span>
                )}
              </strong>
              <p>{regGameSub}</p>
            </>
          ) : (
            <>
              <strong>{nextEvent ? 'Next' : 'None'}</strong>
              <p>
                {nextEvent ? (
                  <>
                    {nextEvent.title} - <LocalDateTime value={nextEvent.startsAt} />
                  </>
                ) : 'No upcoming events'}
              </p>
            </>
          )}
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><CircleDollarSign size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Fees</span>
          {/* WI-2A: when the team is in a tournament, lead with the ENTRY fee (money owed to the
              organizer — the higher-stakes "am I clear for this event" line, alarm-styled when owed),
              then the self-entered PLAYER fees below. Off-tournament, the tile is unchanged.
              An entry fee outranks the DF-5 "not on" face — it is the organizer's money, not the
              fees tool's data, so it must show whether or not the coach has switched fees on. */}
          {feesOff ? (
            <><strong className={styles.hqOff}>Not on</strong><p>{OFF_TILE.fees}</p></>
          ) : tournamentFee != null ? (
            <>
              {tournamentFee > 0 ? (
                <strong className={styles.hqFeeAlert}>Entry fee · {formatMoney(tournamentFee)} owed</strong>
              ) : (
                <strong>Entry fee · clear</strong>
              )}
              <p>Player fees: {formatMoney(unpaidTotal)} · {unpaidCount === 1 ? '1 unpaid' : `${unpaidCount} unpaid`}</p>
            </>
          ) : (
            <>
              <strong>{formatMoney(unpaidTotal)}</strong>
              <p>{unpaidCount === 1 ? '1 unpaid fee' : `${unpaidCount} unpaid fees`}</p>
            </>
          )}
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><Megaphone size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Announcements</span>
          {announcementsOff ? (
            <><strong className={styles.hqOff}>Not on</strong><p>{OFF_TILE.announcements}</p></>
          ) : (
            <>
              <strong>{recipientCount}</strong>
              <p>{recipientCount === 1 ? 'contact ready' : 'contacts ready'}</p>
            </>
          )}
        </div>
      </div>
      {/* DF-3: the Tournaments tile takes the full-width final row wherever the strip is 2-up, and
          carries the door to the full list — the Overview now names one tournament, so this is
          where "and the rest" lives. */}
      <div className={`${styles.hqItem} ${styles.hqItemWide}`}>
        <div className={styles.hqIcon}><Trophy size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Tournaments</span>
          <strong>{historyCount}</strong>
          <p>{latestHistoryLabel}</p>
          {/* The door sits OUTSIDE the sub-line, not appended to it. That paragraph is clamped to
              two lines, so a long "{status} - {tournament name}" silently swallowed the link — a
              hard cut with no ellipsis, i.e. a door that vanishes with no affordance at all. Its
              own line also gives it a real tap target instead of a ~16px inline sliver. */}
          {historyHref && historyCount > 0 && (
            <Link href={historyHref} className={styles.hqTileLink}>See all &rarr;</Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default function TeamHQ(props: TeamHQProps) {
  return <StandaloneTeamHQ {...props} />;
}
