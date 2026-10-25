'use client';
/**
 * HOUSE LEAGUE'S HOME (Club Tier Stage 9a, Part 3; owner 9a·1, Q14; frame A; words HOUSE_LEAGUE_STAGE9A_COPY.md §1).
 *
 * Seasons grouped by what is happening, not by when they were made: Running now (every live season, each labelled by the
 * pill — Q14) · Getting ready (only when a season is in draft) · Past seasons (a closed shelf with its count). Each row is a
 * whole link to the season's Overview; its one line of facts, a second line only when it has something true to say, and
 * the amber waiting count alone. Status changes left the home: they live in the season, and ask (9a·4).
 * Who may create: the one house-league gate's `run` (Q17: the club admin too).
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { LeagueCapUpgradeModal } from '@/components/admin/LeagueCapUpgrade';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { ClubRow, ClubRowList, ClubSection, EmptyCard, LoadFailed, PageLoading, repKit, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import SeasonStatePill from '@/components/admin/kit/club/SeasonStatePill';
import CreateLeagueSeasonDialog from '@/components/admin/kit/club/CreateLeagueSeasonDialog';
import { announceSeasonsChanged, useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { orderSeasons, seasonFactsLine, seasonGroup, seasonNoteLine, toReviewLabel } from '@/lib/house-league-season';
import { sportLabel } from '@/lib/sports';
import type { LeagueCapKind } from '@/lib/free-floor';
import type { LeagueSeasonSummary } from '@/lib/types';
import styles from '@/components/admin/kit/club/HouseLeagueHome.module.css';

export default function HouseLeagueHome() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const access = useHouseLeagueAccess();
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin/house-league`;

  const [summaries, setSummaries] = useState<LeagueSeasonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [capHit, setCapHit] = useState<LeagueCapKind | null>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setFailed(false);
    try {
      const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(orgSlug)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setSummaries(Array.isArray(data.seasons) ? data.seasons : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useDeferredLoad(!!currentOrg && !!access?.read, load);

  const canRun = !!access?.run;
  const header = (
    <AdminPageHeader
      eyebrow="House league"
      title="Seasons"
      inlineActions
      actions={canRun ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setCreating(true)} aria-label="Create season">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Create season</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || (access?.read && loading)) return <PageLoading header={header} label="Loading seasons…" />;

  if (!access?.read) {
    return (
      <div className={repKit.page}>
        <AdminPageHeader eyebrow="House league" title="Seasons" />
        <EmptyCard icon={<Users size={20} aria-hidden />} title="You don’t have access to this page." />
      </div>
    );
  }

  // One season's row, in whichever group it sits.
  const row = (s: LeagueSeasonSummary) => {
    const facts = { ...s.season, sport: sportLabel(s.season.sport), ...s };
    const note = seasonNoteLine({ ...facts, registrationFee: s.season.registrationFee }, canRun);
    return (
      <ClubRow
        key={s.season.id}
        as="link"
        href={`${base}/seasons/${s.season.id}`}
        title={<span className={styles.rowTitle}>{s.season.name} <SeasonStatePill season={s.season} /></span>}
        caption={
          <>
            <span>{seasonFactsLine(facts)}</span>
            {note && <span className={styles.note}>{note}</span>}
          </>
        }
        trail={s.pendingReviewCount > 0
          ? <span className={frame.count} style={{ marginLeft: 0 }} aria-label={toReviewLabel(s.pendingReviewCount)}>{s.pendingReviewCount > 9 ? '9+' : s.pendingReviewCount}</span>
          : undefined}
        chevron
      />
    );
  };

  const ordered = orderSeasons(summaries.map(s => ({ ...s, ...s.season, summary: s }))).map(x => x.summary);
  const running = ordered.filter(s => seasonGroup(s.season) === 'running');
  const ready = ordered.filter(s => seasonGroup(s.season) === 'ready');
  const past = ordered.filter(s => seasonGroup(s.season) === 'past');

  return (
    <div className={repKit.page}>
      {header}
      {failed && <LoadFailed title="We couldn’t load your seasons." onRetry={() => { setLoading(true); void load(); }} />}

      {!failed && summaries.length === 0 && (
        <EmptyCard
          icon={<Users size={20} aria-hidden />}
          title={canRun ? 'Run your first season' : 'No seasons yet.'}
          action={canRun ? <button type="button" className="btn btn-lime" onClick={() => setCreating(true)}>Create your first season</button> : undefined}
        >
          A season holds your age groups as divisions, with its registrations, teams, schedule and standings. Create one to get started.
        </EmptyCard>
      )}

      {!failed && summaries.length > 0 && (
        <>
          <ClubSection title="Running now" list>
            {running.length > 0
              ? <ClubRowList inset label="Running now">{running.map(row)}</ClubRowList>
              : <p className={styles.empty}>No season is running right now.</p>}
          </ClubSection>

          {ready.length > 0 && (
            <ClubSection title="Getting ready" list>
              <ClubRowList inset label="Getting ready">{ready.map(row)}</ClubRowList>
            </ClubSection>
          )}

          {past.length > 0 && (
            <section className={styles.shelf} aria-labelledby="hl-past-heading">
              <button
                type="button"
                className={styles.shelfToggle}
                aria-expanded={pastOpen}
                aria-controls="hl-past-list"
                onClick={() => setPastOpen(o => !o)}
              >
                <h2 id="hl-past-heading" className={styles.shelfTitle}>Past seasons</h2>
                <span className={styles.shelfCount}>{past.length}</span>
                <ChevronRight size={16} aria-hidden className={`${styles.shelfChevron}${pastOpen ? ` ${styles.shelfChevronOpen}` : ''}`} />
              </button>
              {pastOpen && (
                <div id="hl-past-list">
                  <ClubRowList inset label="Past seasons">{past.map(row)}</ClubRowList>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {creating && (
        <CreateLeagueSeasonDialog
          orgSlug={orgSlug}
          onClose={() => setCreating(false)}
          onCapHit={kind => { setCreating(false); setCapHit(kind); }}
          onCreated={season => {
            announceSeasonsChanged();
            // A new season's next step is its own page (the checklist, 9a·4). ⚠ Navigate with the window STILL OPEN:
            // closing it first lets its Back step tidy its history entry before the router has pushed, and that Back
            // cancels the navigation (KitDialog's header) — the coach landed back on a list that did not show the new
            // season. The page unmounts as it leaves, so the window goes with it.
            router.push(`${base}/seasons/${season.id}`);
          }}
        />
      )}
      {capHit && <LeagueCapUpgradeModal capHit={capHit} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}
