'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { sortByCoachLifecycle } from '@/lib/coach-tournament-lifecycle';
import { resolveRowFanView } from '@/lib/coach-alert-registration';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
import { canConfigureTeam } from '@/lib/coach-capabilities';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import CoachRegistrationCard from '@/components/coaches/CoachRegistrationCard';
import CoachHostedTournamentsSection, { type HostedTournamentsState } from '@/components/coaches/CoachHostedTournamentsSection';
import CoachTournamentChoiceCard from '@/components/coaches/CoachTournamentChoiceCard';
import { trackTournamentAcquisition } from '@/components/marketing/tournament-acquisition';
import type { HostedTournamentRow } from '@/app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route';
import styles from '../../../coaches.module.css';
import flow from '@/components/rep-teams/TryoutFlowHeader.module.css';
import { tournamentToday } from '@/lib/timezone';

interface TournamentHistoryEntry {
  registration: { id: string; name: string; status: string; registeredAt: string };
  tournament: { id: string; name: string; slug: string | null; year: number | null; startDate: string | null; endDate: string | null; status: string } | null;
  org: { id: string; slug: string; name: string } | null;
}

type Linkage = 'workspace' | 'admin-link' | 'none';

type TournamentHistoryData = {
  history: TournamentHistoryEntry[];
  basicCoachTeamId: string | null;
  linkage: Linkage;
};

export default function PremiumTeamTournamentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const { currentOrg } = useOrg();
  const { openHelp } = useHelpDrawer();
  // The page gates on the same predicate as its nav door (staff access review, 2026-09-10) — the
  // read behind it now refuses the same people, so nothing is fetched for a coach it would refuse.
  const { assignments, loading: coachesLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const notGranted = !!assignment && !canConfigureTeam(assignment.capabilities);
  const [data, setData] = useState<TournamentHistoryData | null>(null);
  const [error, setError] = useState('');

  const helpRequest = {
    module: 'coaches' as const,
    // Section ids ONLY — getHelpSections never walks faqs, so a faq id here silently resolves to
    // nothing and the drawer opens a section short. ('faq-premium-tournaments-where' lives inside
    // the 'tournaments' section, which is already listed, so nothing is lost by dropping it.)
    sectionIds: ['tournaments'],
    label: 'Tournaments',
    fullGuideHref: `/${orgSlug}/coaches/help#tournaments`,
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-history`);
      if (!res.ok) throw new Error('Tournaments could not be loaded');
      const json: Partial<TournamentHistoryData> = await res.json();
      setData({
        history: json.history ?? [],
        basicCoachTeamId: json.basicCoachTeamId ?? null,
        // Defensive default — the API's `linkage` field lands in a parallel change; until it
        // does, 'none' keeps this page's state logic honest rather than mis-reading State A/B.
        linkage: json.linkage ?? 'none',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tournaments could not be loaded');
    }
  }, [orgSlug, teamId]);

  // Waits for the assignments like every sibling page, so the read is never fired before the gate
  // can be evaluated (the provider is seeded server-side, so this is defence in depth).
  useEffect(() => { if (!coachesLoading && !notGranted) void Promise.resolve().then(load); }, [load, notGranted, coachesLoading]);

  // Owned here (not inside CoachHostedTournamentsSection) so the page can tell, before either
  // half of the season renders, whether BOTH are empty — the case CoachTournamentChoiceCard
  // exists for (stacked-onboarding review, 2026-09-13). `null` means "not resolved yet", same as
  // the section's own fetch used to mean, so the merge only activates once we actually know.
  const [hosted, setHosted] = useState<HostedTournamentsState>(null);
  useEffect(() => {
    if (coachesLoading || notGranted) return;
    let active = true;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/hosted-tournaments`)
      .then(res => (res.ok ? res.json() as Promise<{ canRun: boolean; tournaments: HostedTournamentRow[] }> : null))
      // Always lands on a definite value once the request settles — never leaves `hosted` stuck
      // at `null` on a failed/non-ok response. `awaitingMergeDecision` below waits on this exact
      // state for an empty top section, so a permanent `null` here would hang that page's loading
      // state forever instead of just quietly not offering the hosting door (review 2026-09-13).
      .then(json => { if (active) setHosted(json ? { canRun: !!json.canRun, tournaments: json.tournaments ?? [] } : { canRun: false, tournaments: [] }); })
      .catch(() => { if (active) setHosted({ canRun: false, tournaments: [] }); });
    return () => { active = false; };
  }, [orgSlug, teamId, coachesLoading, notGranted]);

  const today = tournamentToday();

  const isTeamWorkspace = isTeamWorkspaceOrg(currentOrg);

  const sorted = useMemo(
    () => data
      ? sortByCoachLifecycle(
          data.history,
          entry => entry.tournament?.startDate ?? null,
          entry => entry.tournament?.endDate ?? null,
          today,
        )
      : [],
    [data, today],
  );

  // The merge point: both halves of the season are genuinely empty (nothing entered, nothing
  // hosted), so CoachTournamentChoiceCard replaces both illustrated blocks with one — in EVERY
  // linkage state. The first cut (3698f8c7) left State C (linked, just nothing yet) out on the
  // theory that its `compact` card was a buttonless strip that could not stack badly; on prod it
  // rendered as a full medallion card, and a standalone workspace — whose linkage is ALWAYS
  // 'workspace' — got exactly the two stacked trophies the merge exists to remove (owner,
  // 2026-09-13). Which JOIN tile the merged card shows still follows the linkage.
  const hostEmpty = hosted !== null && hosted.canRun && hosted.tournaments.length === 0;
  const bothEmpty = data !== null && sorted.length === 0 && hostEmpty;

  // Only the "could this become the merged card?" shape needs to wait on the second fetch — a
  // team with real entries renders immediately either way, exactly as before. Without this, the
  // plain empty card could paint first and then get swapped out for CoachTournamentChoiceCard
  // moments later once `hosted` resolves — a jarring content swap this whole change exists to
  // avoid (review 2026-09-13). `hosted` always settles to a real value (see the fetch above), so
  // this never waits forever.
  const awaitingMergeDecision = data !== null && sorted.length === 0 && hosted === null;

  const hostSetupHref = `/${orgSlug}/admin/org/tournaments?create=1&source=coach_portal_tournaments`;
  const trackHostCta = (eventType: 'tournament_plus_acquisition_cta_viewed' | 'tournament_plus_acquisition_cta_clicked') =>
    trackTournamentAcquisition({
      eventType,
      acquisitionSource: 'coach_portal_tournaments',
      surface: 'admin_upgrade_gate',
      orgSlug,
      currentPath: window.location.pathname,
      ctaHref: hostSetupHref,
    });

  if (notGranted) {
    return (
      <div className={styles.page}>
        <CoachPageHeader icon={Trophy} title="Tournaments" helpLabel="Tournaments" help={helpRequest} />
        <CoachNotGranted
          icon={<Trophy size={20} aria-hidden />}
          section="Tournaments"
          plural
          what="The team’s tournament entries — registration, the live schedule, roster submission and organizer updates."
          blocker="Tournaments open with schedule editing. Ask your head coach to grant it."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the blurb is deleted — the list's own intro line says what
          this shows, and the empty state teaches it for a team with nothing entered yet. The page
          gains the section icon its siblings all have. */}
      <CoachPageHeader
        icon={Trophy}
        title="Tournaments"
        helpLabel="Tournaments"
        help={helpRequest}
      />

      {error && <p className={styles.errorText}>{error}</p>}

      {data === null || awaitingMergeDecision ? (
        <div className={styles.loadingState}>Loading tournaments…</div>
      ) : sorted.length > 0 ? (
        <>
          <div className={flow.panelIntro}>
            <p className={flow.panelIntroText}>Live and upcoming first — tap an entry for schedule, roster submission, and organizer updates.</p>
          </div>
          <div className={styles.tournamentHistoryList}>
            {sorted.map(entry => {
              /* One rule for every coach-facing tournament ROW, shared with the free portal's
                 lists and its Overview card. */
              const fanView = resolveRowFanView(entry);

              return (
                <CoachRegistrationCard
                  key={entry.registration.id}
                  href={`${base}/tournaments/${entry.registration.id}`}
                  title={entry.tournament?.name ?? entry.registration.name}
                  registrationStatus={entry.registration.status}
                  startDate={entry.tournament?.startDate ?? null}
                  endDate={entry.tournament?.endDate ?? null}
                  today={today}
                  metaParts={[entry.org?.name, entry.registration.name]}
                  fanView={fanView}
                />
              );
            })}
          </div>
        </>
      ) : bothEmpty ? (
        // Merged state (stacked-onboarding review, 2026-09-13): nothing entered AND nothing
        // hosted, so one card offers both doors instead of two full illustrated blocks stacked
        // on the page. The join tile branches the way the un-merged empties below do: self-serve
        // (A / a standalone workspace), already linked by the org (C), or link-required (B).
        <CoachTournamentChoiceCard
          headline="Your tournament season lives here"
          intro="Join tournaments other organizers run, or host your own — either way, it shows up here automatically."
          join={isTeamWorkspace ? {
            kicker: 'Join one',
            title: 'Register with any organizer',
            body: (
              <>
                Register on the organizer&apos;s public page using{' '}
                <strong>this account&apos;s email</strong> — the entry appears here the moment
                you&apos;re registered, with schedule, scores, and status.
              </>
            ),
            primaryAction: { label: 'How registering works', onClick: () => openHelp(helpRequest) },
            secondaryAction: { label: 'Browse public tournaments', href: '/discover' },
          } : data.linkage !== 'none' ? {
            kicker: 'Join one',
            title: 'No tournaments yet this season',
            body: (
              <>
                This season&apos;s entries appear here the moment{' '}
                {currentOrg?.name ?? 'your organization'} registers this team — with the live
                schedule and scores.
              </>
            ),
            primaryAction: { label: 'How linking works', onClick: () => openHelp(helpRequest) },
          } : {
            kicker: 'Link required',
            title: 'No tournaments linked yet',
            body: (
              <>
                When {currentOrg?.name ?? 'your organization'} registers this team for a
                tournament, they link the entry to your team and it shows up here automatically —
                with the live schedule and scores.
              </>
            ),
            primaryAction: { label: 'How linking works', onClick: () => openHelp(helpRequest) },
            blocker: "Only your organization can make that link — ask them if you're expecting one.",
          }}
          host={{
            title: 'Run your own tournament',
            body: 'A quick round robin or exhibition weekend, set up from here — registrations, schedule, scores and what visiting teams see, all on one page you run.',
            action: {
              label: 'Set up a tournament',
              href: hostSetupHref,
              onClick: () => trackHostCta('tournament_plus_acquisition_cta_clicked'),
            },
            onView: () => trackHostCta('tournament_plus_acquisition_cta_viewed'),
          }}
          payoff="Either way: games land on your Schedule ready for lineups, the chat room opens under Chat, and results count toward your season record in Insights."
        />
      ) : data.linkage !== 'none' ? (
        // State C — linked (workspace or admin-link), just nothing recorded yet this season, and
        // the viewer cannot host (otherwise the merged card above took it). Checked before A/B:
        // a bridged team with zero entries is "no tournaments yet", never the "nothing linked"
        // copy below, regardless of which linkage produced the bridge.
        <CoachEmptyState
          compact
          icon={<Trophy size={20} aria-hidden />}
          headline="No tournaments yet this season"
          description="This season's tournament entries appear here the moment you're registered."
          payoff="Once one lands, its games drop straight into your Schedule, its chat room opens under Chat, and its results count toward your season record in Insights."
        />
      ) : isTeamWorkspace ? (
        // State A — standalone/workspace team, never bridged: registration is self-serve by account email,
        // no org admin has to link anything. Point at /discover (Decision D4) to find an event.
        <CoachEmptyState
          icon={<Trophy size={22} aria-hidden />}
          headline="Your tournament season lives here"
          description={
            <>
              Register for any tournament on the organizer&apos;s public page using{' '}
              <strong>this account&apos;s email</strong> — the entry appears here automatically with schedule, scores, and status.
            </>
          }
          payoff="From there its games appear on your Schedule ready for lineups, the organizer's chat room opens under Chat, and results count toward your season record in Insights."
          primaryAction={{
            label: 'How registering works',
            onClick: () => openHelp(helpRequest),
          }}
          secondaryAction={{ label: 'Browse public tournaments', href: '/discover' }}
        />
      ) : (
        // State B — org-owned rep team, nothing linked yet (linkage === 'none', not a
        // team-workspace org): only the org admin can create the connection (mig-196
        // "Link to rep team" bridge), so no self-serve CTA is offered here.
        <CoachEmptyState
          icon={<Trophy size={22} aria-hidden />}
          headline="No tournaments linked yet"
          description={
            <>
              When {currentOrg?.name ?? 'your organization'} registers this team for a tournament, they link the entry to your team and it shows up here automatically — with the live schedule and scores.
            </>
          }
          payoff="Once linked, its games appear on your Schedule ready for lineups, the organizer's chat room opens under Chat, and results count toward your season record in Insights."
          blocker="Only your organization can make that link — ask them if you're expecting one."
          primaryAction={{
            label: 'How linking works',
            onClick: () => openHelp(helpRequest),
          }}
        />
      )}

      {/* The second half of the season — the tournament(s) this workspace RUNS — below the entries
          (owner ruling 2026-09-13). Renders nothing for anyone who cannot run one, and nothing
          here when bothEmpty is true: CoachTournamentChoiceCard above already offers that door. */}
      {(data !== null || error) && !bothEmpty && <CoachHostedTournamentsSection orgSlug={orgSlug} state={hosted} />}
    </div>
  );
}
