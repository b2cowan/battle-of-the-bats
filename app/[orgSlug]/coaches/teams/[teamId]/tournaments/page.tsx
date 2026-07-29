'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { sortByCoachLifecycle } from '@/lib/coach-tournament-lifecycle';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { useOrg } from '@/lib/org-context';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import HelpButton from '@/components/help/HelpButton';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachRegistrationCard from '@/components/coaches/CoachRegistrationCard';
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

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Tournaments</h1>
            <p className={styles.pageSub}>Every tournament your team is entered in — live status, schedule, and results.</p>
          </div>
        </div>
        <HelpButton iconOnly label="Tournaments" help={helpRequest} />
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {data === null ? (
        <div className={styles.loadingState}>Loading tournaments…</div>
      ) : sorted.length > 0 ? (
        <>
          <div className={flow.panelIntro}>
            <p className={flow.panelIntroText}>Live and upcoming first — tap an entry for schedule, roster submission, and organizer updates.</p>
          </div>
          <div className={styles.tournamentHistoryList}>
            {sorted.map(entry => {
              const canFanView = Boolean(entry.org?.slug && entry.tournament?.slug &&
                (entry.tournament.status === 'active' || entry.tournament.status === 'completed'));

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
                  fanView={canFanView ? { orgSlug: entry.org!.slug, tournamentSlug: entry.tournament!.slug! } : null}
                />
              );
            })}
          </div>
        </>
      ) : data.linkage !== 'none' ? (
        // State C — linked (workspace or admin-link), just nothing recorded yet this season.
        // Checked first: a bridged team with zero entries is "no tournaments yet", never the
        // "nothing linked" copy below, regardless of which linkage produced the bridge.
        <CoachEmptyState
          compact
          icon={<Trophy size={20} aria-hidden />}
          headline="No tournaments yet this season"
          description="Your past and upcoming tournament entries appear here the moment you're registered."
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
    </div>
  );
}
