import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
  getNextRegistrationGameForTeam,
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
import { getActivePremiumPortalSlug } from '@/lib/coach-team-page';
import HelpButton from '@/components/help/HelpButton';
import TeamHQ from '@/components/coaches/TeamHQ';
import { pickFanViewRegistration } from '@/lib/coach-alert-registration';
import CoachLiveEventCard from '@/components/coaches/CoachLiveEventCard';
import CoachTeamSetupPanel from '@/components/coaches/CoachTeamSetupPanel';
import CoachOverviewInvite from '@/components/coaches/CoachOverviewInvite';
import ScopeShelf from '@/components/coaches/ScopeShelf';
import { registrationStatusLabel } from '@/lib/coaches-status';
import CoachRegistrationCard from '@/components/coaches/CoachRegistrationCard';
import { tournamentToday } from '@/lib/timezone';
import shared from '../../coaches-portal.module.css';
import styles from './team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

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

  // Upgraded to a live Premium portal → send the coach there (the free overview is read-only history).
  const premiumSlug = await getActivePremiumPortalSlug(team.teamWorkspaceId);
  if (premiumSlug) {
    redirect(`/${premiumSlug}/coaches`);
  }

  // C5: an empty self-entered schedule during a tournament said "None" while the team's
  // game was live two taps away — borrow the registration's live/next game for the tile.
  // Chained off only the two fetches it actually needs, inside the same Promise.all, so
  // its queries overlap the other four instead of running after all six settle.
  const historyPromise = getBasicCoachTournamentHistoryForTeam(basicTeamId);
  const eventsPromise = getBasicCoachTeamEvents(basicTeamId);
  const registrationGamePromise = Promise.all([historyPromise, eventsPromise]).then(
    ([teamHistory, teamEvents]) =>
      !findNextEvent(teamEvents) && teamHistory.length > 0
        ? getNextRegistrationGameForTeam(teamHistory)
        : null,
  );
  const [history, players, events, fees, announcements, announcementRecipientSummary, registrationGame] = await Promise.all([
    historyPromise,
    getBasicCoachTeamPlayers(basicTeamId),
    eventsPromise,
    getBasicCoachTeamFees(basicTeamId),
    getBasicCoachTeamAnnouncements(basicTeamId),
    getBasicCoachTeamAnnouncementRecipientSummary(basicTeamId),
    registrationGamePromise,
  ]);

  const nextEvent = findNextEvent(events);
  const unpaidFees = fees.filter(fee => fee.status === 'unpaid');
  const unpaidTotal = unpaidFees.reduce((total, fee) => total + fee.amount, 0);

  // WI-2A: the REAL tournament entry fee (money owed to the organizer) so the Fees tile can't read a
  // false "$0" while an entry fee is outstanding. `amountDue` on each accepted registration already
  // carries the outstanding fee (buildCoachTournamentStatus); null tournamentFee = no accepted
  // registration → the tile keeps its self-entered-only display.
  const acceptedRegistrations = history.filter(entry => entry.registration.status === 'accepted');
  const tournamentFee = acceptedRegistrations.length > 0
    ? acceptedRegistrations.reduce((total, entry) => total + (entry.amountDue ?? 0), 0)
    : null;
  const latestHistory = history[0] ?? null;
  const latestHistoryLabel = latestHistory
    ? `${registrationStatusLabel(latestHistory.registration.status)} - ${latestHistory.tournament?.name ?? latestHistory.registration.name}`
    : 'No tournaments yet';

  // S5 → P3 ("The Flip"): quiet round trip to the public event from the Overview — the shared
  // eligibility rule (live/upcoming public event, any registration status), same as premium.
  const fanViewEntry = pickFanViewRegistration(history);

  // Setup panel gate (owner decision 2026-07-29 — see FREE_COACH_ONBOARDING_PLAN.md §2):
  // scratch teams only, and it survives partial progress so a finished step can actually
  // render as finished. The old all-empty `isFirstRun` gate vanished the instant anything
  // was entered, which made the completed-step state unreachable.
  //   • history.length === 0 → a team that arrived via a tournament registration is NOT
  //     shown a setup card; its Overview keeps the "beyond this tournament" divider + the
  //     roster nudge, exactly as before.
  //   • fees is deliberately NOT a signal — it isn't one of the three approved steps.
  const setupStepsDone = {
    roster: players.length > 0,
    schedule: events.length > 0,
    announcements: announcements.length > 0,
  };
  const isSettingUp =
    history.length === 0 &&
    !(setupStepsDone.roster && setupStepsDone.schedule && setupStepsDone.announcements);

  const today = tournamentToday();

  return (
    <div className={`${shared.page} ${styles.pageWide}`}>
      {/* A2: team identity lives in the persistent shell header now (the old identity band is
          retired — stated once, by the chrome). This slim head keeps the page h1 + "?" help —
          ONE row at every width (A3 QA: the stacked mobile "?" row read as wasted space). */}
      <div className={`${shared.sectionHeader} ${styles.headRow}`}>
        <h1 className={shared.sectionTitle}>Overview</h1>
        <div className={styles.sectionHeadEnd}>
          <HelpButton
            help={{ module: 'coaches', sectionIds: ['overview'], fullGuideHref: '/coaches/help#overview' }}
            label="Overview"
            iconOnly
          />
        </div>
      </div>

      {/* A3 QA (owner call 2026-07-27): tournaments LEAD the page — they're why a
          first-tournament coach is here. (The A2 chat doorway is retired — the global
          Chat tab in the bottom bar is the one chat door.) */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Your tournaments</h2>
        </div>
        {history.length === 0 ? (
          <div className={shared.empty}>
            <p>This team isn&apos;t in any tournaments yet. When you register it for one, the registration and schedule show up here.</p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {/* A3.3: the shared registration card (lifecycle chip + one anatomy across all
                three lists). fanView stays null HERE — the Fan view door for a live event
                lives in the CoachLiveEventCard block below (P3 rev-4, no duplicate). */}
            {history.map(entry => (
              <CoachRegistrationCard
                key={entry.registration.id}
                href={`${COACHES_TOURNAMENTS_PATH}/${entry.registration.id}`}
                title={entry.tournament?.name ?? entry.registration.name}
                registrationStatus={entry.registration.status}
                startDate={entry.tournament?.startDate ?? null}
                endDate={entry.tournament?.endDate ?? null}
                today={today}
                metaParts={[entry.org?.name]}
                fanView={null}
              />
            ))}
          </div>
        )}
      </section>

      {/* P3 rev-5 (owner call): the compact "your tournament" block — event card naming the live/
          upcoming public event + its ⇄ Fan view door. No alerts/follow affordance here — the
          public side already carries those; the portal doesn't push follow at the coach. */}
      {fanViewEntry && (
        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Your event</h2>
          </div>
          <CoachLiveEventCard event={fanViewEntry} />
        </section>
      )}

      {/* A3 QA: an explicit seam between the tournament group above and the team tools
          below — a first-tournament coach must never read roster/schedule/fees as
          something the tournament requires. Free-floor framing per copy canon (these
          tools ARE free; the season HQ pitch lives in Explore). Hidden for a team with
          no registrations — there, the whole page is team tools. */}
      {history.length > 0 && (
        <div className={styles.toolsDivider} role="separator" aria-label="Your team's own tools">
          <p className={styles.toolsDividerEyebrow}>Your team — beyond this tournament</p>
          <p className={styles.toolsDividerNote}>
            Everything below belongs to your team, not this tournament — free tools to try
            whenever you like, and they carry over to every event you enter.{' '}
            <Link href={`${coachTeamPath(basicTeamId)}/explore`}>See everything included &rarr;</Link>
          </p>
        </div>
      )}

      {/* A3.2: every persistent Overview block announces itself in the same slim mono
          register the page h1 already uses (the stat strip previously had only a
          screen-reader label). */}
      <div className={shared.sectionHeader}>
        <h2 className={shared.sectionTitle}>At a glance</h2>
      </div>
      <TeamHQ
        variant="standalone"
        rosterCount={players.length}
        nextEvent={nextEvent ? { title: nextEvent.title, startsAt: nextEvent.startsAt } : null}
        registrationGame={registrationGame}
        unpaidTotal={unpaidTotal}
        unpaidCount={unpaidFees.length}
        tournamentFee={tournamentFee}
        recipientCount={announcementRecipientSummary.recipientCount}
        historyCount={history.length}
        latestHistoryLabel={latestHistoryLabel}
      />

      {/* Discovery nudge (Variant A): a quiet, dismissible invite to turn on the persisted-roster
          wedge → degrades to a faint line on dismiss (never erased; Explore link stays in the rail).
          Suppressed while the setup panel leads (its step 1 already owns the roster invitation, so
          the two must never stack) and once roster is already on. */}
      {!isSettingUp && (
        <section className={shared.section}>
          <CoachOverviewInvite
            basicTeamId={basicTeamId}
            rosterActivated={team.activatedFeatures.includes('roster')}
          />
        </section>
      )}

      {/* Setup panel: every step is honest about state and carries its own action — a tool that
          isn't on yet is switched on FROM the step and opened, so no step can name a section the
          coach has no way to reach (the defect this replaced). One click skips the whole thing. */}
      {isSettingUp && (
        <section className={shared.section}>
          <CoachTeamSetupPanel
            basicTeamId={basicTeamId}
            activatedFeatures={team.activatedFeatures}
            stepsDone={setupStepsDone}
          />
        </section>
      )}

      {/* The four team-ops editors (Roster / Schedule / Fees / Announcements) now live on their
          own sub-routes (/coaches/team/{id}/roster etc.) — reached via the rail once activated.
          The Overview keeps the at-a-glance stat strip (above) + tournament history (below). */}

      {/* (Tournament history moved to the TOP of the page — "Your tournaments" — A3 QA.) */}

      {/* C4: ONE light Premium hook on the Overview once any section has real content —
          before this, a new/light coach only ever saw pitches on the Explore tab. The
          per-section shelves still gate on their own section's content; this is the
          team-level catch-all. Never rendered on the tournament variant (game day
          stays pitch-free — locked decision). */}
      {(players.length > 0 || events.length > 0 || fees.length > 0 || announcements.length > 0) && (
        <ScopeShelf basicTeamId={basicTeamId} section="overview" />
      )}
    </div>
  );
}
