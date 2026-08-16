'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Trophy } from 'lucide-react';
import { useCoaches, resolveClosedAssignment, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import SeasonWrappedCard from '@/components/coaches/SeasonWrappedCard';
import CoachSeasonFinishedNotice from '@/components/coaches/CoachSeasonFinishedNotice';
import { hasRecordAccess } from '@/lib/coach-capabilities';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import styles from '../../../coaches.module.css';

/**
 * Season's End — the landing surface for a finished season (Batch 3, P0 #1; approved mockups =
 * spec). Leads with Season Wrapped, says how the families engaged with it, points at the compare
 * list, and names the honest path to the next season (standalone head coach: start it; club coach:
 * the team reappears when the admin staffs next season).
 *
 * ⚠ **THE LAST PAGE IN THE PORTAL THAT READS A YEAR** (P2, 2026-08-16, Design A). With the season
 * dial deleted, `?year=` survives here and on the `wrapped` route it calls — and nowhere else —
 * because the compare list's per-year "Season Wrapped →" links are the look-back layer's only
 * route to a season that is not the team's working one. Without the parameter this page IS the
 * working season, which is how a coach lands here when their season ends.
 *
 * Reached three ways, all of them deliberate: the nav's first slot once the working season has
 * finished, the Overview's redirect for the same state, and a per-year link from the compare list.
 */
export default function SeasonEndPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, closedAssignments, loading, refresh } = useCoaches();
  const { currentOrg } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year');
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const active = assignments.find(a => a.teamId === teamId) ?? null;
  // Shared closed-state predicate (lib/coaches-context.tsx) — same rule as the navs.
  const closed = resolveClosedAssignment(assignments, closedAssignments, teamId);
  const page = useCoachSeasonPage(orgSlug, teamId);
  /**
   * ⚠ WHICH season this page is describing is NOT `page.isReadOnly`. That answers for the team's
   * WORKING season; this page can also be handed a specific past year by the compare list, while
   * the team is mid-season. Everything below therefore reads the year from the URL when it is
   * there and falls back to the working season only when it is not.
   */
  const showingWorkingSeason = !yearParam || yearParam === page.season?.programYearId;
  /** The working season is still under way and no year was named ⇒ there is no end to look at. */
  const seasonStillUnderWay = showingWorkingSeason && !!page.season && !page.season.isReadOnly;

  const [wrapped, setWrapped] = useState<SeasonWrappedPayload | null>(null);
  /** Counts only — the route omits this entirely for a coach without guardian-contact access. */
  const [recapEngagement, setRecapEngagement] = useState<{ viewers: number; eligible: number } | null>(null);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [rolloverOpen, setRolloverOpen] = useState(false);

  /**
   * ⚠ The guards below run at RENDER time, and effects fire regardless of which branch renders —
   * so without this line a helper's visit still issues a `/wrapped` request that the route is
   * guaranteed to refuse, after it has done the season and assignment lookups to find that out.
   * Worse, the 403 lands in the `.catch` and sets the generic "couldn't be loaded" error, which is
   * the broken-page outcome the honest screen exists to replace.
   */
  const mayReadWrapped = page.hasAccess && (!page.capabilities || hasRecordAccess(page.capabilities));

  useEffect(() => {
    if (loading || !mayReadWrapped || seasonStillUnderWay) return;
    let cancelled = false;
    setFetching(true);
    setError('');
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/wrapped${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(json => {
        if (cancelled) return;
        setWrapped(json.wrapped as SeasonWrappedPayload);
        setRecapEngagement(json.recapEngagement ?? null);
      })
      .catch(() => { if (!cancelled) setError('This season’s wrap-up couldn’t be loaded — refresh to try again.'); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [loading, mayReadWrapped, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  if (loading) return <p className={styles.muted}>Loading...</p>;

  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  /**
   * ⚠ **WHERE A HELPER ACTUALLY LANDS** (owner ruling 2026-08-03). Signing in sends them to the
   * portal root, which redirects a team with no live season straight here; so does the nav's first
   * slot, and so does the team switcher. This is the screen they see.
   *
   * Not a gate: the Wrapped route refuses them on its own and the nav hides the door. This is the
   * altitude choice that stops the refusal rendering as a broken page.
   */
  if (page.capabilities && !hasRecordAccess(page.capabilities)) {
    return <CoachSeasonFinishedNotice />;
  }

  /**
   * ⚠ THE SEASON IS STILL RUNNING. Reachable by typing the URL, or from a bookmark made in the
   * months when a coach could dial into this page from anywhere. It used to answer by quietly
   * showing the NEWEST FINISHED season's Wrapped instead — a hidden season choice, which is exactly
   * what P2 deleted, and with the page-title season chip gone nothing on screen would have said
   * which year it was. So it says so, and points at the list that does hold the finished ones.
   */
  if (seasonStillUnderWay) {
    return (
      <div className={styles.page}>
        <CoachPageHeader
          icon={Trophy}
          title="Season's End"
          helpLabel="Season's End"
          help={{ module: 'coaches', sectionIds: ['premium-season-end'], fullGuideHref: `/${orgSlug}/coaches/help#premium-season-end` }}
        />
        <section className={styles.setupPanel}>
          <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
            <strong>{page.programYearName}</strong> is still under way. When it finishes, this is
            where it gets wrapped up — the season&apos;s story, and how many families opened their
            player&apos;s recap.
          </p>
          <Link href={`${base}/history/results`} className={styles.seasonDoorRow}>
            <span>
              Compare every season
              <small>Records, roster size and money summaries, season by season</small>
            </span>
            <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
          </Link>
        </section>
      </div>
    );
  }

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const orgName = currentOrg?.name ?? 'your club';
  // The forward path only renders in the CLOSED-ONLY state; a coach browsing a past season
  // of a rolled-forward team already has their active season.
  const coachRole = active?.coachRole ?? closed?.coachRole ?? 'assistant_coach';
  const showStartNext = !active && !!closed && isTeamWorkspace && coachRole === 'head_coach';

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the page names ITSELF, not the team — this was the same
          masthead-repeat the Overview had. Chunk B (P1 #17): a coach reaching this months later
          has the least context of anyone, so the help icon earns its place here. */}
      <CoachPageHeader
        icon={Trophy}
        title="Season's End"
        helpLabel="Season's End"
        help={{ module: 'coaches', sectionIds: ['premium-season-end'], fullGuideHref: `/${orgSlug}/coaches/help#premium-season-end` }}
      />

      {fetching ? (
        <div className={styles.loadingState}>Wrapping up the season…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : wrapped ? (
        /* Desktop shell D3 (2026-08-01): the Wrapped card and the recap/doors sit side by
           side on desktop instead of a 560px strip floating in empty space; stacks ≤900. */
        <div className={styles.seasonSpread}>
          <SeasonWrappedCard wrapped={wrapped} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Chunk D 3.5 — did the families read the recaps? COUNTS ONLY: the product does not
              record, and this page cannot show, WHICH family opened one. Absent entirely when
              no guardian was connected to this season — a "0 of 0" is not a fact worth
              printing, and it would read as a failure rather than as "nobody signed up". */}
          {recapEngagement && recapEngagement.eligible > 0 && (
            /* data-sandbox-tour: the beat the demo's closing step rings — the recap the families
               actually opened. Inert off a demo org. */
            <section className={styles.setupPanel} aria-labelledby="season-end-recaps"
              data-sandbox-tour="season-recaps">
              <p className={styles.setupKicker} id="season-end-recaps">Family season recaps</p>
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                <b>{recapEngagement.viewers} of {recapEngagement.eligible}</b> connected
                {recapEngagement.eligible === 1 ? ' family has' : ' families have'} opened their
                player&apos;s recap for this season.
              </p>
            </section>
          )}

          <section className={styles.setupPanel} aria-labelledby="season-end-doors">
            <p className={styles.setupKicker} id="season-end-doors">Look back any time</p>
            {/* ⚠ THE SENTENCE MOVED WITH THE MODEL (P2, 2026-08-16). It used to promise the whole
                record set "from the menu", which was true of a season the ARCHIVE was displaying.
                What is true now: when this IS the team's working season, the menu is still the
                coach's own and every record in it opens read-only. When the coach arrived from the
                compare list to read an OLDER year, the menu belongs to the live season — so the
                honest offer is this page and the list, not a menu that would answer for a
                different year. */}
            <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
              {showingWorkingSeason
                ? 'Everything from this season is still here — roster, schedule, attendance, lineups, money records, documents and tryouts. Open any of them from the menu.'
                : 'This season’s story is kept here. Your menu is showing the season the team is on now.'}
            </p>
            {/* ⚠ Every current member of the staff, not just the head coach (owner ruling,
                reverted with Design A on 2026-08-16 — see the compare list's own note). This door
                exists FOR that list, so gating one without the other made the link succeed while
                quietly not delivering. */}
            <Link href={`${base}/history/results`} className={styles.seasonDoorRow}>
              <span>
                Compare every season
                <small>Records, roster size and money summaries, season by season</small>
              </span>
              <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
            </Link>
          </section>

          {showStartNext && closed && (
            <>
              <button type="button" className={`btn btn-lime ${styles.setupNextCta}`} onClick={() => setRolloverOpen(true)}>
                Start next season
              </button>
              <p className={styles.seasonEndNote}>
                Starting next season carries your roster and staff forward. This season stays right here, read-only.
              </p>
            </>
          )}

          {active && (
            <Link href={base} className={styles.btnSecondary} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={15} aria-hidden /> Go to {active.programYearName}
            </Link>
          )}

          {!active && !isTeamWorkspace && (
            <section className={styles.setupPanel}>
              <p className={styles.seasonEndNote}>
                Seasons are managed by <strong>{orgName}</strong>. When you&apos;re on next season&apos;s
                coaching staff, the team reappears here automatically.
              </p>
            </section>
          )}
          </div>
        </div>
      ) : null}

      {rolloverOpen && closed && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={closed.programYearName}
          defaultNextYear={(closed.programYearYear ?? new Date().getFullYear()) + 1}
          onClose={() => setRolloverOpen(false)}
          onDone={async () => {
            setRolloverOpen(false);
            await refresh();
            router.push(base);
          }}
        />
      )}
    </div>
  );
}
