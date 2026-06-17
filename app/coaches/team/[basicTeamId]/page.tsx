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
  COACHES_TOURNAMENTS_PATH,
  coachTeamPath,
} from '@/lib/coaches-portal-routes';
import TeamHQ from '@/components/coaches/TeamHQ';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachOverviewInvite from '@/components/coaches/CoachOverviewInvite';
import { Rocket, Users, CalendarDays, Megaphone } from 'lucide-react';
import type { CSSProperties } from 'react';
import { teamColor, teamInitials } from '@/lib/team-color';
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

  // First-run banner: a brand-new team with nothing entered yet. Falls away on
  // its own once the coach adds anything (no persisted dismiss state needed).
  const isFirstRun =
    players.length === 0 &&
    events.length === 0 &&
    fees.length === 0 &&
    announcements.length === 0 &&
    history.length === 0;

  return (
    <div className={`${shared.page} ${styles.pageWide}`}>
      <div
        className={styles.identityBand}
        style={{ '--team-color': teamColor(team.name) } as CSSProperties}
      >
        <p className={styles.identityWatermark} aria-hidden>{teamInitials(team.name)}</p>
        <div className={styles.identityMonogram} aria-hidden>{teamInitials(team.name)}</div>
        <div className={styles.identityText}>
          <h1 className={styles.identityName}>{team.name}</h1>
          <p className={styles.identityMeta}>
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

      {/* Discovery nudge (Variant A): a quiet, dismissible invite to turn on the persisted-roster
          wedge → degrades to a faint line on dismiss (never erased; Explore link stays in the rail).
          Suppressed during first-run (the onboarding banner leads) and once roster is already on. */}
      {!isFirstRun && (
        <section className={shared.section}>
          <CoachOverviewInvite
            basicTeamId={basicTeamId}
            rosterActivated={team.activatedFeatures.includes('roster')}
          />
        </section>
      )}

      {isFirstRun && (
        <section className={shared.section}>
          <CoachEmptyState
            icon={<Rocket size={22} aria-hidden />}
            eyebrow="Get started"
            headline="Let's set up your team"
            description="Three quick steps and your team home is ready to share."
            primaryAction={{ label: 'Add your first player', href: `${coachTeamPath(basicTeamId)}/roster` }}
          >
            <ol className={styles.firstRunSteps}>
              <li className={styles.firstRunStep}>
                <span className={styles.firstRunStepIcon}><Users size={15} aria-hidden /></span>
                Add your players to build the roster
              </li>
              <li className={styles.firstRunStep}>
                <span className={styles.firstRunStepIcon}><CalendarDays size={15} aria-hidden /></span>
                Add practices and games to the schedule
              </li>
              <li className={styles.firstRunStep}>
                <span className={styles.firstRunStepIcon}><Megaphone size={15} aria-hidden /></span>
                Send your first announcement to parents
              </li>
            </ol>
          </CoachEmptyState>
        </section>
      )}

      {/* The four team-ops editors (Roster / Schedule / Fees / Announcements) now live on their
          own sub-routes (/coaches/team/{id}/roster etc.) — reached via the rail once activated.
          The Overview keeps the at-a-glance stat strip (above) + tournament history (below). */}

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
