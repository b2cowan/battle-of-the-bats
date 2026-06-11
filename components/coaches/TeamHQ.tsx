import { CalendarClock, CheckCircle2, Circle, CircleDollarSign, Clock, Megaphone, Trophy, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import LocalDateTime from './LocalDateTime';
import Countdown from '@/components/public/Countdown';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { CoachTournamentStatus } from '@/lib/coach-status-model';
import type { CoachTournamentPhase } from '@/lib/coach-tournament-phase';
import styles from './TeamHQ.module.css';

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
  unpaidTotal: number;
  unpaidCount: number;
  recipientCount: number;
  historyCount: number;
  latestHistoryLabel: string;
};

type TournamentTeamHQProps = {
  variant: 'tournament';
  phase: CoachTournamentPhase;
  /** Registration status pill label (e.g. "Accepted", "Pending Review"). */
  statusLabel: string;
  /** Global badge class for the pill (e.g. "badge-success"). */
  statusBadgeClass: string;
  /** Long-form status copy — shown as the sub for pending / waitlist / rejected. */
  statusDesc: string;
  teamName: string;
  tournamentName: string | null;
  orgName: string | null;
  /** YYYY-MM-DD start date, for the accepted-prep countdown / headline. */
  startDate: string | null;
  dateRangeLabel: string | null;
  /** Organizer contact (mailto) — shown on rejected + as the accepted "questions?" line. */
  contactEmail: string | null;
  /** 5b status model — present for accepted teams; drives the checklist Fee/Roster/Check-in rows. */
  status: CoachTournamentStatus | null;
  /** Show the check-in milestone (game day onward only). */
  showCheckIn: boolean;
  /** Formatted "registered on" date for the first checklist milestone. */
  registeredDateLabel: string | null;
  /** Organizer requires an event roster (5f) → show the Roster milestone even before
   *  submission (as "Not submitted"). The actionable submit UI is the 5k card below. */
  rosterRequired?: boolean;
};

type TeamHQProps = StandaloneTeamHQProps | TournamentTeamHQProps;

// Kept identical to the helper that previously lived in the standalone page so money
// renders byte-for-byte the same after the extraction.
function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function StandaloneTeamHQ({
  rosterCount,
  nextEvent,
  unpaidTotal,
  unpaidCount,
  recipientCount,
  historyCount,
  latestHistoryLabel,
}: StandaloneTeamHQProps) {
  return (
    <section className={styles.hqStrip} aria-label="Team HQ">
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><Users size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Roster</span>
          <strong>{rosterCount}</strong>
          <p>{rosterCount === 1 ? '1 player' : `${rosterCount} players`}</p>
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><CalendarClock size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Schedule</span>
          <strong>{nextEvent ? 'Next' : 'None'}</strong>
          <p>
            {nextEvent ? (
              <>
                {nextEvent.title} - <LocalDateTime value={nextEvent.startsAt} />
              </>
            ) : 'No upcoming events'}
          </p>
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><CircleDollarSign size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Fees</span>
          <strong>{formatMoney(unpaidTotal)}</strong>
          <p>{unpaidCount === 1 ? '1 unpaid fee' : `${unpaidCount} unpaid fees`}</p>
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><Megaphone size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Announcements</span>
          <strong>{recipientCount}</strong>
          <p>{recipientCount === 1 ? 'contact ready' : 'contacts ready'}</p>
        </div>
      </div>
      <div className={styles.hqItem}>
        <div className={styles.hqIcon}><Trophy size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Tournaments</span>
          <strong>{historyCount}</strong>
          <p>{latestHistoryLabel}</p>
        </div>
      </div>
    </section>
  );
}

type ChecklistItem = {
  key: string;
  label: string;
  state: string;
  done: boolean;
  /** Renders the clock (awaiting) icon instead of the empty circle when not done. */
  awaiting?: boolean;
};

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className={styles.checklist}>
      {items.map(item => (
        <li key={item.key} className={`${styles.checkItem} ${item.done ? styles.checkItemDone : ''}`}>
          <span className={styles.checkIcon}>
            {item.done ? (
              <CheckCircle2 size={16} aria-hidden />
            ) : item.awaiting ? (
              <Clock size={16} aria-hidden />
            ) : (
              <Circle size={16} aria-hidden />
            )}
          </span>
          <span className={styles.checkLabel}>{item.label}</span>
          <span className={styles.checkState}>{item.state}</span>
        </li>
      ))}
    </ul>
  );
}

function TournamentTeamHQ(props: TournamentTeamHQProps) {
  const {
    phase,
    statusLabel,
    statusBadgeClass,
    statusDesc,
    teamName,
    tournamentName,
    orgName,
    startDate,
    dateRangeLabel,
    contactEmail,
    status,
    showCheckIn,
    registeredDateLabel,
    rosterRequired,
  } = props;

  const heroStyle = { '--team-color': teamColor(teamName) } as CSSProperties;
  const monogram = teamInitials(teamName);
  const accepted = phase !== 'pending' && phase !== 'rejected';

  // Headline + sub per phase. Pending/waitlist/rejected reuse the existing
  // registration-status copy (statusDesc); accepted gets the prep narrative.
  let headline: string;
  let sub: string | null;
  if (phase === 'pending') {
    headline = 'Registration submitted';
    sub = statusDesc || null;
  } else if (phase === 'rejected') {
    headline = 'Not selected for this event';
    sub = statusDesc || null;
  } else {
    headline = "You're in!";
    sub = [tournamentName, orgName].filter(Boolean).join(' · ') || null;
  }

  // Accepted countdown: future start → live "First game in N days"; otherwise a
  // static, honest line (no live scores until 5i / no afterglow until 5m).
  const today = new Date().toISOString().split('T')[0];
  const beforeStart = Boolean(startDate) && (today < (startDate as string));

  const checklist: ChecklistItem[] = [];
  if (phase === 'pending') {
    checklist.push({ key: 'registered', label: 'Registered', state: registeredDateLabel ?? 'Submitted', done: true });
    checklist.push({ key: 'decision', label: 'Decision', state: 'Awaiting organizer', done: false, awaiting: true });
  } else if (accepted) {
    checklist.push({ key: 'registered', label: 'Registered', state: registeredDateLabel ?? 'Submitted', done: true });
    checklist.push({ key: 'accepted', label: 'Accepted', state: 'Confirmed', done: true });
    // Fee — only when the organizer set a fee schedule; read-only state, no amount
    // (the detailed amount/due/contact lives in the status block below).
    if (status?.fee.hasSchedule) {
      checklist.push({ key: 'fee', label: 'Fee', state: status.fee.isPaid ? 'Paid' : 'Owed', done: status.fee.isPaid });
    }
    // Roster — shown when the organizer requires one (5f) OR once the coach has
    // submitted. "Not submitted" (awaiting) → "Submitted" → "Confirmed". The actionable
    // submit UI is the 5k card below the hero — this row is the read-only milestone.
    if (status) {
      const rosterDone = status.roster.state !== 'none';
      if (rosterRequired || rosterDone) {
        checklist.push({
          key: 'roster',
          label: 'Roster',
          state: status.roster.state === 'confirmed' ? 'Confirmed' : rosterDone ? 'Submitted' : 'Not submitted',
          done: rosterDone,
          awaiting: !rosterDone,
        });
      }
    }
    // Check-in — game day onward only (default 'not_arrived' reads as a problem otherwise).
    if (showCheckIn && status) {
      const checkedIn = status.checkIn.state === 'checked_in';
      checklist.push({
        key: 'checkin',
        label: 'Check-in',
        state: checkedIn ? 'Checked in' : status.checkIn.state === 'no_show' ? 'No-show' : 'Not arrived',
        done: checkedIn,
      });
    }
  }

  return (
    <div className={styles.hero} style={heroStyle} aria-label="Tournament status">
      <div className={styles.heroHead}>
        <div className={styles.heroMonogram} aria-hidden>{monogram}</div>
        <div className={styles.heroHeadText}>
          <h2 className={styles.heroTitle}>{headline}</h2>
          {sub && <p className={styles.heroSub}>{sub}</p>}
        </div>
        <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
      </div>

      {accepted && beforeStart && startDate && (
        <p className={styles.heroCountdown}>
          <Countdown target={`${startDate}T00:00:00`} prefix="First game in " whenPast={null} />
        </p>
      )}
      {/* game_day always has a non-null startDate (derivation requires today >= startDate),
          so "Event underway" never renders for a date-less event. schedule_live with a future
          date shows the countdown above; schedule_live with no dates shows neither (honest). */}
      {phase === 'game_day' && (
        <p className={styles.heroCountdown}><strong>Event underway</strong></p>
      )}
      {accepted && phase === 'result' && (
        <p className={styles.heroCountdown}><strong>Event complete</strong></p>
      )}

      {dateRangeLabel && <p className={styles.heroDates}>{dateRangeLabel}</p>}

      {checklist.length > 0 && <Checklist items={checklist} />}

      {phase === 'rejected' && contactEmail && (
        <p className={styles.heroContact}>
          Interested in another division or a future event? Reach out to{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      )}
      {accepted && contactEmail && (
        <p className={styles.heroContact}>
          Questions? <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      )}
    </div>
  );
}

export default function TeamHQ(props: TeamHQProps) {
  switch (props.variant) {
    case 'standalone':
      return <StandaloneTeamHQ {...props} />;
    case 'tournament':
      return <TournamentTeamHQ {...props} />;
    default:
      // Exhaustiveness guard: a new variant added to the union without a matching
      // case fails to compile here (no silent undefined-render fall-through).
      props satisfies never;
      return null;
  }
}
