import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import { getBasicCoachTeamPlayers } from '@/lib/basic-coach-roster';
import { getBasicCoachTeamEvents } from '@/lib/basic-coach-schedule';
import { getBasicCoachTeamFees } from '@/lib/basic-coach-fees';
import {
  getBasicCoachTeamAnnouncementRecipientSummary,
  getBasicCoachTeamAnnouncements,
} from '@/lib/basic-coach-announcements';
import {
  COACHES_HOME_PATH,
  COACHES_TOURNAMENTS_PATH,
  coachTeamPath,
} from '@/lib/coaches-portal-routes';
import RosterEditor from '@/components/coaches/RosterEditor';
import ScheduleEditor from '@/components/coaches/ScheduleEditor';
import FeeEditor from '@/components/coaches/FeeEditor';
import AnnouncementEditor from '@/components/coaches/AnnouncementEditor';
import ScopeCeilingInterest from '@/components/coaches/ScopeCeilingInterest';
import TeamHQ from '@/components/coaches/TeamHQ';
import { registrationStatusBadge, registrationStatusLabel } from '@/lib/coaches-status';
import shared from '../../coaches-portal.module.css';
import styles from './team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

function formatCalendarDate(value: string, options: Intl.DateTimeFormatOptions): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return date.toLocaleDateString('en-CA', options);
}

type TeamEventSummary = {
  startsAt: string;
  status: string;
};

function eventStartMs(event: TeamEventSummary): number {
  const ms = new Date(event.startsAt).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function findNextEvent<T extends TeamEventSummary>(events: T[]): T | null {
  const now = Date.now();
  return events
    .filter(event => event.status !== 'cancelled' && eventStartMs(event) >= now)
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))[0] ?? null;
}

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  // Ownership-gated: never emit a team name in <title> for a non-owner / signed-out
  // request (the page body is gated, but metadata runs independently of it).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { title: 'Your Team' };
  // Staff/platform-admins are not coaches — never resolve a team name for them (mirrors the
  // roster API guard so the page and APIs can't drift on who counts as an owner).
  if (user.email && (await isPlatformAdminEmail(user.email))) return { title: 'Your Team' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team?.name ?? 'Your Team' };
}

export default async function CoachTeamHomePage({ params }: RouteParams) {
  const { basicTeamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${coachTeamPath(basicTeamId)}`);
  }

  // Staff/platform-admins are not coaches — exclude them here too (this is the surface that
  // renders roster DOB / guardian contact), keeping the page consistent with the roster APIs.
  if (await isPlatformAdminEmail(user.email)) {
    notFound();
  }

  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  if (!team) {
    notFound();
  }

  const [history, players, events, fees, announcements, announcementRecipientSummary] = await Promise.all([
    getBasicCoachTournamentHistoryForTeam(basicTeamId),
    getBasicCoachTeamPlayers(basicTeamId),
    getBasicCoachTeamEvents(basicTeamId),
    getBasicCoachTeamFees(basicTeamId),
    getBasicCoachTeamAnnouncements(basicTeamId),
    getBasicCoachTeamAnnouncementRecipientSummary(basicTeamId),
  ]);

  const metaParts = [team.primaryCoachName, team.sport, team.ageGroup].filter(Boolean) as string[];
  const nextEvent = findNextEvent(events);
  const unpaidFees = fees.filter(fee => fee.status === 'unpaid');
  const unpaidTotal = unpaidFees.reduce((total, fee) => total + fee.amount, 0);
  const latestHistory = history[0] ?? null;
  const latestHistoryLabel = latestHistory
    ? `${registrationStatusLabel(latestHistory.registration.status)} - ${latestHistory.tournament?.name ?? latestHistory.registration.name}`
    : 'No tournaments yet';

  return (
    <div className={shared.page}>
      <nav className={styles.breadcrumb}>
        <Link href={COACHES_HOME_PATH}>Back to Coaches Portal</Link>
      </nav>

      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>{team.name}</h1>
          <p className={shared.sub}>
            {metaParts.length > 0 ? metaParts.join(' · ') : 'Your team home'}
          </p>
        </div>
      </div>

      <TeamHQ
        variant="standalone"
        rosterCount={players.length}
        nextEvent={nextEvent ? { title: nextEvent.title, startsAt: nextEvent.startsAt } : null}
        unpaidTotal={unpaidTotal}
        unpaidCount={unpaidFees.length}
        recipientCount={announcementRecipientSummary.recipientCount}
        historyCount={history.length}
        latestHistoryLabel={latestHistoryLabel}
      />

      {/* Master roster — the coach's primary owned data; leads the page. Identity only
          (name / jersey / optional contact / consent-gated DOB) — attendance, lineups, and
          positions stay Premium. The per-tournament roster submission is a later phase. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Roster</h2>
          <span className={styles.rosterCount}>
            {players.length} {players.length === 1 ? 'player' : 'players'}
          </span>
        </div>
        <RosterEditor basicTeamId={basicTeamId} initialPlayers={players} />
      </section>

      {/* Schedule — the coach's practices/games; parents are reached via comms (later slice).
          Basic schedule only (no recurrence/scores/attendance — those stay Premium). */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Schedule</h2>
          <span className={styles.rosterCount}>
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        <ScheduleEditor basicTeamId={basicTeamId} initialEvents={events} />
      </section>

      {/* Fees - manual tracking only. No payment processing, Stripe, dues automation, or partials. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Fees</h2>
          <span className={styles.rosterCount}>
            {fees.filter(fee => fee.status === 'unpaid').length} unpaid
          </span>
        </div>
        <FeeEditor basicTeamId={basicTeamId} initialFees={fees} players={players} />
      </section>

      {/* Announcements - one-way email to roster contact_email values only.
          No parent accounts, chat, replies inbox, SMS/push, reminders, or Premium pitch. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Announcements</h2>
          <span className={styles.rosterCount}>
            {announcementRecipientSummary.recipientCount} {announcementRecipientSummary.recipientCount === 1 ? 'recipient' : 'recipients'}
          </span>
        </div>
        <AnnouncementEditor
          basicTeamId={basicTeamId}
          initialAnnouncements={announcements}
          initialRecipientSummary={announcementRecipientSummary}
        />
      </section>

      {/* Scope ceiling - no checkout or unlock. Coaches can flag interest in tools that stay outside Basic. */}
      <section className={shared.section}>
        <ScopeCeilingInterest basicTeamId={basicTeamId} />
      </section>

      {/* Tournament history — empty for a no-tournament team; never leads the page. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Tournament history</h2>
        </div>
        {history.length === 0 ? (
          <div className={shared.empty}>
            <p>This team isn&apos;t in any tournaments yet. When you register it for one, the registration and schedule show up here.</p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {history.map(entry => {
              const badge = registrationStatusBadge(entry.registration.status);
              const label = registrationStatusLabel(entry.registration.status);
              const dateRange = entry.tournament?.startDate
                ? entry.tournament.endDate
                  ? `${formatCalendarDate(entry.tournament.startDate, { month: 'short', day: 'numeric' })} - ${formatCalendarDate(entry.tournament.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : formatCalendarDate(entry.tournament.startDate, { month: 'long', day: 'numeric', year: 'numeric' })
                : null;
              return (
                <Link
                  key={entry.registration.id}
                  href={`${COACHES_TOURNAMENTS_PATH}/${entry.registration.id}`}
                  className={styles.historyRow}
                >
                  <div className={styles.historyMain}>
                    <span className={styles.historyName}>{entry.tournament?.name ?? entry.registration.name}</span>
                    <span className={styles.historyMeta}>
                      {entry.org?.name ? `${entry.org.name}` : ''}
                      {dateRange ? `${entry.org?.name ? ' · ' : ''}${dateRange}` : ''}
                    </span>
                  </div>
                  <span className={`badge ${badge}`}>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
