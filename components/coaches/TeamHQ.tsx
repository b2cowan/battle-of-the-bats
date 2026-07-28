import { CalendarClock, CircleDollarSign, Megaphone, Trophy, Users } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import LocalDateTime from './LocalDateTime';
import Countdown from '@/components/public/Countdown';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { CoachTournamentPhase } from '@/lib/coach-tournament-phase';
import type { BasicCoachRegistrationGame } from '@/lib/basic-coach-teams';
import styles from './TeamHQ.module.css';
import { tournamentToday } from '@/lib/timezone';

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
  /** B1.4: the organizer's (or tournament's) logo, shown beside the team monogram in the
   *  tournament hero. Null/absent keeps today's monogram-only head. Decorative — the org
   *  name is already rendered as text. */
  organizerLogoUrl?: string | null;
  /** YYYY-MM-DD start date, for the accepted-prep countdown / headline. */
  startDate: string | null;
  dateRangeLabel: string | null;
  /** 5m afterglow (result phase only) — final W-L-T from the team's completed games. */
  record?: { wins: number; losses: number; ties: number } | null;
  /** 5m afterglow — public standings link, present only when the tournament is public. */
  standingsHref?: string | null;
  /** A3: the game-day hero keeps ONE next-game line (the countdown's game-day analogue);
   *  the full today detail lives in the Schedule zone beside the live scorebug. */
  todayGames?: HeroTodayGame[];
  /** A3 (result phase): the share action rendered inside the result card — the record page
   *  passes SharePageButton so "how we finished" and "share it" live together. */
  shareSlot?: ReactNode;
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
  // A3.2: named "At a glance" (the visible h2 lives in the Overview page). Never "HQ" —
  // that's the Premium tier's word (companion vs HQ framing).
  return (
    <section className={styles.hqStrip} aria-label="At a glance">
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

function TournamentTeamHQ(props: TournamentTeamHQProps) {
  const {
    phase,
    statusLabel,
    statusBadgeClass,
    statusDesc,
    teamName,
    tournamentName,
    orgName,
    organizerLogoUrl,
    startDate,
    dateRangeLabel,
    record,
    standingsHref,
    todayGames,
    shareSlot,
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

  // Headline + sub per phase. Pending/waitlist/rejected reuse the existing
  // registration-status copy (statusDesc); accepted gets the prep narrative.
  // A3: the hero is status + countdown ONLY — fee, checklist, contact, and the
  // today detail all moved into the record page's four zones (approved mockups
  // 2026-07-26); game day earns its own headline now that the hero is this lean.
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
  } else if (phase === 'game_day') {
    headline = 'Game day!';
  } else {
    headline = "You're in!";
  }
  const splitIdentity = accepted; // accepted_prep / schedule_live / game_day / result

  // Accepted countdown: future start → live "First game in N days"; otherwise a
  // static, honest line (no live scores until 5i / no afterglow until 5m).
  const today = tournamentToday();
  const beforeStart = Boolean(startDate) && (today < (startDate as string));

  const todayGameCount = todayGames?.length ?? 0;
  const nextTodayGame = todayGames?.[0] ?? null;

  /* B3 (owner call 2026-07-27): the RESULT hero is the result card and nothing else.
     Everything the head carried is already stated immediately above it in BOTH shells —
     the free portal's persistent header (tournament · org eyebrow, team name, dates) and
     Premium's in-page header ("{team}" + "{tournament} ({year}) - {org}") — so the phase
     headline, the status chip, the tournament/org lines AND the trailing date line were
     the same facts a third and fourth time, stacked. The status itself still has exactly
     one home: the Status & Payment zone below. */
  const resultOnly = phase === 'result';

  return (
    <div
      className={`${styles.hero} ${phaseAccentClass}${celebration ? ` ${styles.heroCelebration}` : ''}${resultOnly ? ` ${styles.heroResultOnly}` : ''}`}
      style={heroStyle}
      aria-label="Tournament status"
    >
      {celebration && <p className={styles.heroWatermark} aria-hidden>{monogram}</p>}
      {!resultOnly && (
      <div className={styles.heroHead}>
        {/* B1.4 — the organizer's own mark. This is a REAL uploaded logo, which is why it
            survived the 2026-07-27 removal of the auto-generated team-initial squares: an
            organizer's actual crest carries identity, two derived letters carried none.
            Decorative (the org name is already text below), hence empty alt + aria-hidden. */}
        {/* Org logos are arbitrary remote URLs (Supabase storage / customer CDNs) with no
            configured next/image loader — the public event header renders them the same way. */}
        {organizerLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organizerLogoUrl}
            alt=""
            aria-hidden
            className={styles.heroOrgLogo}
            loading="lazy"
            decoding="async"
          />
        )}
        {/* (Owner call 2026-07-27: the auto-generated team-initial square is gone — two
            letters derived from the team name told a coach nothing they couldn't read in
            the title beside it. The organizer's real logo above is the identity mark.) */}
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

      {/* Game-day line (A3) — the countdown's game-day analogue: ONE line pointing at the
          next game; the full today detail (location, home/away, scorebug) lives in the
          Schedule zone below. Falls back to "Event underway" when nothing is on today. */}
      {phase === 'game_day' && (
        nextTodayGame ? (
          <p className={styles.heroCountdown}>
            {todayGameCount > 1 ? `${todayGameCount} games today · next ` : 'Next game today · '}
            <strong>
              {nextTodayGame.timeLabel ?? 'TBD'} vs {nextTodayGame.opponentName}
            </strong>
          </p>
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
          {shareSlot}
        </div>
      )}

      {/* Result phase states the range once, inside the card's lead row — no trailing repeat. */}
      {dateRangeLabel && !resultOnly && <p className={styles.heroDates}>{dateRangeLabel}</p>}
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
