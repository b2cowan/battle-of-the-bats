import { CalendarClock, CheckCircle2, Circle, CircleDollarSign, Clock, Megaphone, TriangleAlert, Trophy, Users, XCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import LocalDateTime from './LocalDateTime';
import Countdown from '@/components/public/Countdown';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { CoachTournamentStatus } from '@/lib/coach-status-model';
import type { CoachTournamentPhase } from '@/lib/coach-tournament-phase';
import type { BasicCoachRegistrationGame } from '@/lib/basic-coach-teams';
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
  /** 5m afterglow (result phase only) — final W-L-T from the team's completed games. */
  record?: { wins: number; losses: number; ties: number } | null;
  /** 5m afterglow — public standings link, present only when the tournament is public. */
  standingsHref?: string | null;
  /** Theme 1 (5h) pending entry-fee preview — the organizer's fee schedule amount, shown
   *  on the pending phase as "$N · due if accepted". Null when no fee schedule is set. */
  pendingFeeAmount?: number | null;
  /** Theme 1 (5i) game-day Today card — games happening today, server-derived (no poll
   *  in the hero; the live scorebug lives in CoachLiveSchedule below). */
  todayGames?: HeroTodayGame[];
};

/** Minimal shape the game-day Today card needs (a server-derived slice of the schedule). */
export type HeroTodayGame = {
  timeLabel: string | null;
  location: string | null;
  opponentName: string;
  isHome: boolean;
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

// Date-only (YYYY-MM-DD) due dates render as the literal calendar day (T00:00:00),
// matching TournamentStatusBlock so the glance strip + detail block agree.
function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(value + 'T00:00:00') : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
}: StandaloneTeamHQProps) {
  // C5: with no self-entered events, borrow the live/next game from the team's
  // tournament registration instead of claiming "None" mid-event.
  const regGame = nextEvent ? null : registrationGame ?? null;
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
      <div className={`${styles.hqItem}${regGame ? ` ${styles.hqItemReg}` : ''}`}>
        <div className={styles.hqIcon}><CalendarClock size={17} aria-hidden /></div>
        <div>
          <span className={styles.hqLabel}>Schedule</span>
          {regGame ? (
            <>
              <strong>
                vs {regGame.opponentName}
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
              then the self-entered PLAYER fees below. Off-tournament, the tile is unchanged. */}
          {tournamentFee != null ? (
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
  /** Colours the (plain, right-aligned) state text — e.g. past-due Fee → danger. The
   *  row stays uniform with its siblings (no pill, no second line); the red fee glance
   *  strip above owns the alarm + the "Was due" date, so it's never duplicated here. */
  stateTone?: 'danger';
};

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className={styles.checklist}>
      {items.map(item => (
        <li
          key={item.key}
          className={`${styles.checkItem} ${item.done ? styles.checkItemDone : item.awaiting ? styles.checkItemAwaiting : ''}`}
        >
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
          <span className={`${styles.checkState}${item.stateTone === 'danger' ? ` ${styles.checkStateDanger}` : ''}`}>
            {item.state}
          </span>
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
    record,
    standingsHref,
    pendingFeeAmount,
    todayGames,
  } = props;

  const heroStyle = { '--team-color': teamColor(teamName) } as CSSProperties;
  const monogram = teamInitials(teamName);
  const accepted = phase !== 'pending' && phase !== 'rejected';
  // Theme 4: the celebration phases (accepted / prep / schedule-live) wear the
  // 18% team-hue wash + watermark. game_day + result carry their own phase-semantic
  // washes (Theme 1, via the accent class below), so they skip the team-hue wash.
  const celebration = accepted && phase !== 'game_day' && phase !== 'result';

  // Theme 1: per-phase left-border accent. The chip itself reuses the registration
  // status badge (statusBadgeClass) passed by the caller — one source for the label.
  const phaseAccentClass =
    phase === 'pending'
      ? styles.heroAccentInfo
      : phase === 'rejected'
        ? styles.heroAccentDanger
        : phase === 'game_day'
          ? styles.heroAccentSuccess
          : styles.heroAccentLime; // accepted_prep / schedule_live / result

  // Fee glance strip (accepted, fee scheduled + unpaid). The amount/due/contact live
  // here as the GLANCE layer; the process note ("organizer records payment manually")
  // stays in the detail status block below — never duplicated here.
  const feeDueLabel = formatDateOnly(status?.fee.dueDate ?? null);
  const feeAmountLabel = status?.fee.amountDue != null ? formatMoney(status.fee.amountDue) : null;
  const showFeeStrip = Boolean(accepted && status?.fee.hasSchedule && !status?.fee.isPaid);
  const feePastDue = status?.fee.state === 'past-due';

  // Headline + sub per phase. Pending/waitlist/rejected reuse the existing
  // registration-status copy (statusDesc); accepted gets the prep narrative.
  let headline: string;
  // accepted / result split the identity onto two stacked lines (tournament over org);
  // pending / rejected use the status-description sentence as a single sub line.
  let sub: string | null = null;
  if (phase === 'pending') {
    headline = 'Registration submitted';
    sub = statusDesc || null;
  } else if (phase === 'rejected') {
    headline = 'Not selected for this event';
    sub = statusDesc || null;
  } else if (phase === 'result') {
    headline = "That's a wrap!";
  } else {
    headline = "You're in!";
  }
  const splitIdentity = accepted; // accepted_prep / schedule_live / game_day / result

  // Accepted countdown: future start → live "First game in N days"; otherwise a
  // static, honest line (no live scores until 5i / no afterglow until 5m).
  const today = new Date().toISOString().split('T')[0];
  const beforeStart = Boolean(startDate) && (today < (startDate as string));

  const checklist: ChecklistItem[] = [];
  if (phase === 'pending') {
    checklist.push({ key: 'registered', label: 'Registered', state: registeredDateLabel ? `Submitted ${registeredDateLabel}` : 'Submitted', done: true });
    checklist.push({ key: 'decision', label: 'Decision', state: 'Awaiting organizer', done: false, awaiting: true });
  } else if (accepted && phase !== 'result') {
    // Result phase collapses the prep checklist (the event is over) — the afterglow block below
    // shows the final record + standings link instead (5m, J5-052).
    checklist.push({ key: 'registered', label: 'Registered', state: registeredDateLabel ?? 'Submitted', done: true });
    checklist.push({ key: 'accepted', label: 'Accepted', state: 'Confirmed', done: true });
    // Fee — only when the organizer set a fee schedule; read-only state, no amount
    // (the detailed amount/due/contact lives in the status block below).
    if (status?.fee.hasSchedule) {
      // Past-due (J5-034): plain red "Past due" state text, uniform with the other rows.
      // The red fee glance strip above owns the alarm + amount + "Was due" date, so the
      // checklist no longer repeats it as a pill + a second red line. Merely owed → plain
      // "Owed". Binary by design (no third state) — mirrors the locked fee vocabulary.
      const feePastDueRow = !status.fee.isPaid && status.fee.state === 'past-due';
      checklist.push({
        key: 'fee',
        label: 'Fee',
        state: status.fee.isPaid ? 'Paid' : feePastDueRow ? 'Past due' : 'Owed',
        done: status.fee.isPaid,
        stateTone: feePastDueRow ? 'danger' : undefined,
      });
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

  const todayGameCount = todayGames?.length ?? 0;
  const nextTodayGame = todayGames?.[0] ?? null;

  return (
    <div
      className={`${styles.hero} ${phaseAccentClass}${celebration ? ` ${styles.heroCelebration}` : ''}`}
      style={heroStyle}
      aria-label="Tournament status"
    >
      {celebration && <p className={styles.heroWatermark} aria-hidden>{monogram}</p>}
      <div className={styles.heroHead}>
        <div className={styles.heroMonogram} aria-hidden>{monogram}</div>
        <div className={styles.heroHeadText}>
          {/* Headline + status chip share the top row; the chip is pinned right
              (margin-left:auto) and never shrinks. Both are fixed phrases that don't
              depend on tournament/org name length, so this row stays stable. */}
          <div className={styles.heroTitleRow}>
            <h2 className={styles.heroTitle}>{headline}</h2>
            <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
          </div>
          {splitIdentity ? (
            <>
              {tournamentName && <p className={styles.heroSub}>{tournamentName}</p>}
              {orgName && <p className={styles.heroSubOrg}>{orgName}</p>}
            </>
          ) : (
            sub && <p className={styles.heroSub}>{sub}</p>
          )}
        </div>
      </div>

      {/* Pending entry-fee preview (5h) — only when the organizer set a fee schedule.
          "due if accepted" keeps it honest: nothing is owed until the team is in. */}
      {phase === 'pending' && pendingFeeAmount != null && pendingFeeAmount > 0 && (
        <div className={styles.heroFeePreview}>
          <span className={styles.heroFeePreviewLabel}>Entry fee preview</span>
          <span className={styles.heroFeePreviewAmount}>{formatMoney(pendingFeeAmount)} · due if accepted</span>
        </div>
      )}

      {/* Fee glance strip (5h) — accepted + fee scheduled + unpaid. Owed (amber) vs
          past-due (red, role=alert). Process note stays in the detail block below. */}
      {showFeeStrip && (
        <div
          className={`${styles.heroFeeStrip} ${feePastDue ? styles.heroFeeStripDanger : styles.heroFeeStripWarn}`}
          role={feePastDue ? 'alert' : undefined}
        >
          <span className={styles.heroFeeStripIcon}>
            {feePastDue ? <XCircle size={15} aria-hidden /> : <TriangleAlert size={15} aria-hidden />}
          </span>
          <div className={styles.heroFeeStripText}>
            <span className={styles.heroFeeStripHead}>
              {feePastDue
                ? `Fee past due${feeAmountLabel ? ` · ${feeAmountLabel}` : ''}`
                : `Fee owed${feeAmountLabel ? ` · ${feeAmountLabel}` : ''}${!feePastDue && feeDueLabel ? ` · due ${feeDueLabel}` : ''}`}
            </span>
            {feePastDue && feeDueLabel && <span className={styles.heroFeeStripSub}>Was due {feeDueLabel}</span>}
            {contactEmail && (
              <span className={styles.heroFeeStripSub}>
                Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </span>
            )}
          </div>
        </div>
      )}

      {accepted && beforeStart && startDate && (
        <p className={styles.heroCountdown}>
          {/* Before a schedule exists (accepted_prep) there's no "first game" to count to — count
              to the tournament start. Once the schedule is live, "First game in" is honest again. */}
          <Countdown
            target={`${startDate}T00:00:00`}
            prefix={phase === 'accepted_prep' ? 'Tournament starts in ' : 'First game in '}
            whenPast={null}
          />
        </p>
      )}

      {/* Game-day Today card (5i) — a server-derived summary that points DOWN to the
          CoachLiveSchedule scorebug below (it does NOT poll). Falls back to the plain
          "Event underway" line when no games are scheduled for today. */}
      {phase === 'game_day' && (
        todayGameCount > 0 ? (
          <div className={styles.heroTodayCard}>
            <span className={styles.heroTodayLabel}>Today</span>
            <span className={styles.heroTodayCount}>
              {todayGameCount === 1 ? '1 game today' : `${todayGameCount} games today`}
            </span>
            {nextTodayGame && (
              <span className={styles.heroTodayNext}>
                Next: {nextTodayGame.timeLabel ?? 'TBD'}
                {nextTodayGame.location ? ` · ${nextTodayGame.location}` : ''} · vs {nextTodayGame.opponentName}{' '}
                <span className={styles.heroTodaySide}>({nextTodayGame.isHome ? 'Home' : 'Away'})</span>
              </span>
            )}
          </div>
        ) : (
          <p className={styles.heroCountdown}><strong>Event underway</strong></p>
        )
      )}
      {/* Result trophy card (5m). Champion styling ("Champions!" + Trophy) is gated on a
          placement source — not wired yet, so every team gets the clean "Event complete"
          record card. When placement lands, branch the lead row on placement === 1. */}
      {phase === 'result' && (
        <div className={styles.heroResultCard}>
          <p className={styles.heroResultLead}>
            <Trophy size={16} aria-hidden />
            <span>Event complete{dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</span>
          </p>
          {record && (record.wins + record.losses + record.ties) > 0 ? (
            <p className={styles.heroResultRecord}>
              <span className={styles.heroResultRecordLabel}>Final record</span>
              <strong>{record.wins}-{record.losses}-{record.ties}</strong>
            </p>
          ) : (
            <p className={styles.heroResultNote}>No completed game scores recorded for your team.</p>
          )}
          {standingsHref && (
            <a className={styles.heroResultLink} href={standingsHref}>View final standings →</a>
          )}
        </div>
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
