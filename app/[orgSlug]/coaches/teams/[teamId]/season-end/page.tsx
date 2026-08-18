'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Trophy } from 'lucide-react';
import { useCoaches, resolveClosedAssignment, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import { useOrg } from '@/lib/org-context';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import SeasonWrappedCard from '@/components/coaches/SeasonWrappedCard';
import CoachSeasonFinishedNotice from '@/components/coaches/CoachSeasonFinishedNotice';
import { canReadPastPracticePlans, canViewMoney, hasRecordAccess } from '@/lib/coach-capabilities';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import { formatInOrgZone } from '@/lib/timezone';
import styles from '../../../coaches.module.css';

/**
 * The closed money book (P4) — one statement section, flattened.
 *
 * ⚠ These are the ONLY fields the shelf reads out of the budget-vs-actual payload, and the narrow
 * type is the point: that payload also carries the month grid, the by-activity lens, the unbudgeted
 * list and every drill-in the live panel needs. A record must not become an entrance to a live
 * editor, so what is not typed here is not rendered here.
 */
type SeasonStatementCategory = {
  categoryId: string | null;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
};
type SeasonStatement = {
  expenses: { categories: SeasonStatementCategory[]; budgeted: number; actual: number; variance: number };
  revenue: { categories: SeasonStatementCategory[]; actual: number };
};

/** ⚠ Two decimal places, matching the live statement — the same season must not read as two
 *  different figures depending on which screen a coach opened. Sign is printed by the caller. */
const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One row of "The practices you ran" — the season-scoped list C3 added (P3). */
type SeasonPractice = {
  eventId: string;
  name: string;
  startsAt: string;
  hasPlan: boolean;
  planSummary: string | null;
  hasRecap: boolean;
  tags: { id: string; name: string }[];
};

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
 *
 * ⚠ **P3 C3 (2026-08-16) MADE THIS PAGE A DOOR AS WELL AS A DESTINATION.** It grows one collapsed
 * section — the practices that season, each row opening the read-only plan page that already
 * ships. That is why this page is the shelf's home: it already describes ONE NAMED SEASON, so
 * nothing here can be mistaken for the live year, and no live season renders it, so the busy
 * screens pay nothing. The section carries a NARROWER gate than the page — see `mayReadPractices`.
 *
 * ⚠ **P4 (2026-08-17) ADDED THE SECOND AND LAST SHELF** — the closed money book, this season's
 * statement, flattened. Both shelves are collapsed by default and both are absent during a live
 * season; what separates them is WHO, and that is the thing to keep straight: practices key on
 * `canReadPastPracticePlans`, money on `canViewMoney`. An assistant with attendance and lineups but
 * no money access reads one and not the other. Three gates now live on this page (the page itself,
 * plus one per shelf) — a fourth section must state which of them it belongs to, or it will inherit
 * whichever it happens to be pasted beside.
 *
 * ⚠ There is no P5. The look-back layer is closed at two shelves by ruling; a third needs a new
 * owner decision, not a phase that is already approved.
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
   * "The practices you ran" (P3 C3). `null` until answered, so an empty season renders the section
   * saying so rather than a permanent spinner.
   *
   * ⚠ Fetched separately from Wrapped, and deliberately: it carries a NARROWER gate (see
   * `mayReadPractices`), so folding it into the Wrapped payload would have widened it to everyone
   * who may read a season's story — including the money-only assistant that route's own note
   * describes.
   */
  const [practices, setPractices] = useState<SeasonPractice[] | null>(null);
  const [practicesTruncated, setPracticesTruncated] = useState(false);
  /**
   * ⚠ The season id comes back FROM THE ROUTE, never from `yearParam` or the nav. This page renders
   * with no year at all in the everyday between-seasons case, and every row's link has to name the
   * season it belongs to — taking it from the answer is the only source that is right in both
   * cases and cannot drift from the rows beside it.
   */
  const [practiceSeasonId, setPracticeSeasonId] = useState<string | null>(null);
  /** The closed money book (P4). `null` until answered; the section is absent either way. */
  const [statement, setStatement] = useState<SeasonStatement | null>(null);

  /**
   * ⚠ The guards below run at RENDER time, and effects fire regardless of which branch renders —
   * so without this line a helper's visit still issues a `/wrapped` request that the route is
   * guaranteed to refuse, after it has done the season and assignment lookups to find that out.
   * Worse, the 403 lands in the `.catch` and sets the generic "couldn't be loaded" error, which is
   * the broken-page outcome the honest screen exists to replace.
   */
  const mayReadWrapped = page.hasAccess && (!page.capabilities || hasRecordAccess(page.capabilities));
  /**
   * ⚠ **THE PRACTICES SECTION IS NARROWER THAN THE PAGE IT SITS ON** (plan §5 risk 2). Season's End
   * gates on `hasRecordAccess`; the read route behind every one of these rows has always ALSO
   * required `canViewSchedule`, precisely so a helper who runs one station cannot type the URL. So
   * this second entry point calls the SAME named predicate both routes behind it call — the door
   * and the lock cannot drift, because they are one symbol. The section is simply absent for
   * anyone the plans are not for; the server refuses them regardless.
   */
  const mayReadPractices = page.hasAccess
    && (!page.capabilities || canReadPastPracticePlans(page.capabilities));
  /**
   * ⚠ **THE MONEY SHELF'S GATE IS A DIFFERENT ONE AGAIN** (P4). Two shelves now sit on this page
   * with two different keys, and that is deliberate rather than untidy: the practices shelf asks
   * "is the team's record yours, and do you belong at practice?", while the money book asks the one
   * question money has always asked. An assistant trusted with attendance and lineups but not with
   * the books reads the practices and never sees the statement. The route refuses them either way;
   * this is the door, not the lock.
   */
  const mayReadMoney = page.hasAccess
    && (!page.capabilities || canViewMoney(page.capabilities));

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

  /**
   * The practices this season, for the collapsed section below (P3 C3).
   *
   * ⚠ It fails QUIETLY — a failure leaves `practices` null and the section absent. This is a quiet
   * shelf below the season's story, not the story itself: a red error line under the Wrapped card
   * because a secondary list did not load would make a working page read as a broken one, which is
   * the exact shape the honest-refusal work on this page was written to remove.
   *
   * ⚠ Same `?year=` the Wrapped fetch carries, from the same source. Two fetches on one page that
   * resolve the season differently is how a page ends up describing two years at once.
   */
  useEffect(() => {
    if (loading || !mayReadPractices || seasonStillUnderWay) return;
    let cancelled = false;
    /**
     * ⚠⚠ **CLEARED BEFORE THE FETCH, NOT ONLY AFTER IT** (`/review` 2026-08-16). The `cancelled`
     * flag stops an OLD answer overwriting a NEW one; it does nothing about the old answer already
     * on screen. The Wrapped effect beside this one hides itself with `setFetching(true)`, and the
     * whole content block waits on that — so when the coach picks a different year from the compare
     * list, Wrapped's answer can land first and render the new season's card with THIS state still
     * holding the previous season's practices, and every row linking with the previous season's id.
     * A page describing two years at once is the exact failure this page's own note warns about;
     * the two fetches shared their INPUT (`yearParam`) but not their visible output.
     */
    setPractices(null);
    setPracticeSeasonId(null);
    setPracticesTruncated(false);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-practices${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { practices?: SeasonPractice[]; truncated?: boolean; season?: { programYearId?: string } }) => {
        if (cancelled) return;
        setPractices(json.practices ?? []);
        setPracticesTruncated(!!json.truncated);
        setPracticeSeasonId(json.season?.programYearId ?? null);
      })
      .catch(() => { /* quiet by design — see above */ });
    return () => { cancelled = true; };
  }, [loading, mayReadPractices, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  /**
   * The closed money book (P4) — this season's statement.
   *
   * ⚠ Clears before fetching, for the reason `/review` established on the practices shelf: the
   * `cancelled` flag stops an old answer overwriting a new one, and does nothing about the old
   * answer already on screen. Wrapped hides itself while refetching, so on a year change its answer
   * can land first and render the new season's card above the PREVIOUS season's money.
   *
   * ⚠ Fails QUIET, same posture as the practices shelf: a secondary shelf that could not load must
   * not make a working page read as broken.
   *
   * ⚠ It asks the LIVE Budget vs Actual route with a year — deliberately not a second endpoint.
   * One arithmetic; a season's figures must not depend on which screen asked (the defect fixed in
   * `14af00f0`, where three walks of the same records disagreed).
   */
  useEffect(() => {
    if (loading || !mayReadMoney || seasonStillUnderWay) return;
    let cancelled = false;
    setStatement(null);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { report?: SeasonStatement }) => {
        if (cancelled || !json.report) return;
        setStatement(json.report);
      })
      .catch(() => { /* quiet by design — see above */ });
    return () => { cancelled = true; };
  }, [loading, mayReadMoney, seasonStillUnderWay, orgSlug, teamId, yearParam]);

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

          {/* ── "The practices you ran" (P3 C3) ──────────────────────────────────────────────
              ⚠ **COLLAPSED BY DEFAULT, and that is a binding design constraint rather than a
              taste** (CLAUDE.md ruling §1.6: a history shelf that makes the live screen noisier is
              a failed design). It costs a live season nothing at all — no live season renders this
              page — and it stays below the season's story here, because Season Wrapped is what a
              coach opens this page for.

              ⚠ It is on SEASON'S END and nowhere else. The obvious home, a drawer on the Practice
              plans hub, was rejected in the mockup session (plan §3): it was the only proposal that
              put weight on a screen a coach opens on a Tuesday, and it would have sat directly
              above the Plan templates door as a second entrance to one library. Season's End is
              already a page about ONE NAMED SEASON, which is also how it answers "which year am I
              reading?" without a label — the chip that used to answer that was a switcher. */}
          {practices && practices.length > 0 && (
            <CoachCollapseSection
              sectionId="season-practices"
              title="The practices you ran"
              meta={`${practices.length}${practicesTruncated ? '+' : ''}`}
              defaultOpen={false}
            >
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                Every practice this season that has a plan or a note about how it went. Read-only —
                open one and it reads exactly as you wrote it.
              </p>
              {/* ⚠ THE TRUNCATION IS STATED, never silent (plan §5 risk 1). A list headed "the
                  practices you ran" that quietly stops short tells a coach they ran fewer than
                  they did — the one way this section can lie about a season. */}
              {practicesTruncated && (
                <p className={styles.formHint}>
                  Showing the {practices.length} most recent — this season held more than that.
                </p>
              )}
              <div className={styles.lineupFrontList}>
                {practices.map(p => (
                  <Link
                    key={p.eventId}
                    /* ⚠ The season AND where the coach came from, both explicit. The year is what
                       lets the plan page resolve a season the team may no longer be on; `from` is
                       what sends the back link here instead of to the Development report, which
                       answers for a different year. */
                    href={`${base}/history/development/practices/${p.eventId}`
                      + `?from=season-end${practiceSeasonId ? `&year=${encodeURIComponent(practiceSeasonId)}` : ''}`}
                    className={styles.seasonDoorRow}
                  >
                    <span>
                      {formatInOrgZone(p.startsAt, { month: 'short', day: 'numeric' })} · {p.name}
                      {/* ⚠ A practice with a recap and NO plan is a legitimate row — the shared
                          read is "either, not both" on purpose, because a coach who wrote nothing
                          beforehand and everything afterwards produced exactly the record this
                          section exists to show. It must never be offered under a label promising
                          a plan, so the row says which it is. Neither 404s: the route behind them
                          refuses only a cancelled practice, a foreign season and a non-practice.

                          ⚠ The planless label READS `hasRecap` rather than assuming it (`/review`
                          2026-08-16). The route drops rows that carry neither, so this branch
                          should always be a recap — but the flag was already on the payload and
                          unused, and a label that asserts a note exists must be the one thing that
                          checked. The fallback is deliberately quiet: it claims nothing. */}
                      <small>
                        {p.hasPlan
                          ? p.planSummary ?? 'Plan'
                          : p.hasRecap
                            ? 'No plan written — your note about how it went'
                            : 'No plan written'}
                        {p.tags.length > 0 ? ` · ${p.tags.map(t => t.name).join(' · ')}` : ''}
                      </small>
                    </span>
                    <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
                  </Link>
                ))}
              </div>
            </CoachCollapseSection>
          )}

          {/* ── "How the season added up" — the closed money book (P4) ────────────────────────
              ⚠ **COLLAPSED, and its SHUT FACE already answers the question.** Most of the time
              "did we come in under?" is the whole enquiry, so the summary chip carries it and the
              coach never opens the section. Same binding constraint as the practices shelf above:
              the live content is the primary focus, and a shelf that makes the screen noisier is a
              failed design however useful the history is.

              ⚠ **FLAT — NO CELL IS A LINK, and that is the build's one real constraint** (plan §7).
              On the LIVE Budget vs Actual screen these same figures are doors: rows expand, month
              cells open the budget editor, the undated figure opens a chooser. A record must not be
              an entrance to a live instrument — and two of those doors were quietly broken for two
              days last week, which is how little anyone would notice if this one led somewhere
              wrong. There is deliberately no level down here at all.

              ⚠ Gated on MONEY access, not record access — a different key from the shelf above it.
              See `mayReadMoney`. */}
          {statement && statement.expenses.categories.length > 0 && (
            <CoachCollapseSection
              sectionId="season-statement"
              title="How the season added up"
              meta={statement.expenses.variance === 0
                ? 'On plan'
                : `${fmtMoney(statement.expenses.variance)} ${statement.expenses.variance > 0 ? 'under' : 'over'}`}
              defaultOpen={false}
            >
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                What this season planned to spend, and what it actually spent. Read-only — the
                season is closed.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.devBoardTable}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Planned</th>
                      <th style={{ textAlign: 'right' }}>Actual</th>
                      <th style={{ textAlign: 'right' }}>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.expenses.categories.map(cat => (
                      <tr key={cat.categoryId ?? cat.categoryName}>
                        <td>{cat.categoryName}</td>
                        <td data-label="Planned" style={{ textAlign: 'right' }}>{fmtMoney(cat.budgeted)}</td>
                        <td data-label="Actual" style={{ textAlign: 'right' }}>{fmtMoney(cat.actual)}</td>
                        {/* ⚠ The word carries the meaning, never the colour alone — olive and the
                            danger tone sit ~1.0 ΔE apart for a deuteranope, so "under"/"over" is
                            what a coach reads, and the tint only reinforces it. */}
                        <td data-label="Difference" style={{ textAlign: 'right' }}>
                          {cat.variance === 0
                            ? '—'
                            : `${fmtMoney(cat.variance)} ${cat.variance > 0 ? 'under' : 'over'}`}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td>
                      <td data-label="Planned" style={{ textAlign: 'right' }}>
                        <strong>{fmtMoney(statement.expenses.budgeted)}</strong>
                      </td>
                      <td data-label="Actual" style={{ textAlign: 'right' }}>
                        <strong>{fmtMoney(statement.expenses.actual)}</strong>
                      </td>
                      <td data-label="Difference" style={{ textAlign: 'right' }}>
                        <strong>
                          {statement.expenses.variance === 0
                            ? '—'
                            : `${fmtMoney(statement.expenses.variance)} ${statement.expenses.variance > 0 ? 'under' : 'over'}`}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* What came IN that season — one quiet line, so the statement is not read as the
                  whole story. Absent when the team recorded no money coming in at all: a "$0.00"
                  here would read as a failure rather than as "nothing was recorded". */}
              {statement.revenue.actual > 0 && (
                <p className={styles.formHint}>
                  Money in: {fmtMoney(statement.revenue.actual)}
                  {statement.revenue.categories.length > 0
                    ? ` — ${statement.revenue.categories.map(c => c.categoryName).join(', ')}`
                    : ''}
                </p>
              )}
            </CoachCollapseSection>
          )}

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

          {/* ⚠ **NO "GO TO <LIVE SEASON>" BUTTON** — removed 2026-08-17 (owner, from the §53 walk),
              and it is worth saying why so it does not come back. It was a leftover from the archive
              era, when Season's End was a PLACE the portal could be steered into and a coach needed
              an exit. Design A deleted that place: the nav is always the LIVE season's nav, so every
              door in it already goes where this button went.

              ⚠ It also contradicted the note directly above it — "Your menu is showing the season the
              team is on now" — by offering to take the coach somewhere they already were. And it only
              ever rendered for a ROLLED-FORWARD team (a team between seasons has no live season to
              offer), i.e. precisely the coach whose sidebar is already the live season. */}

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
