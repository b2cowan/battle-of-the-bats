'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { Trophy, Check } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import styles from '../../../../coaches.module.css';
import type { RepTeamEvent, RepTeamTag } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
const TYPE_LABEL: Record<string, string> = { league_game: 'League', tournament_game: 'Tournament', scrimmage: 'Scrimmage' };

/* ⚠ The cross-season TYPE, its two formatters (`acceptanceRate`, `recordText`) and the `Link` /
   `Archive` / `ChevronDown` imports all went with the past-seasons list (2026-08-19). They are named
   here only so the next reader knows they were removed on purpose rather than mislaid: this report
   describes ONE season and no longer models, formats or fetches any other. */

function gameTitle(e: RepTeamEvent) {
  if (e.opponent) return `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}`;
  return e.name || 'Game';
}
function tally(list: RepTeamEvent[]) {
  return {
    w: list.filter(e => e.result === 'win').length,
    l: list.filter(e => e.result === 'loss').length,
    t: list.filter(e => e.result === 'tie').length,
  };
}
function recStr(r: { w: number; l: number; t: number }) {
  return `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
}

// "How are we doing?" — the season's game log + past seasons as a plain ARCHIVE.
// Deliberately NO season-over-season deltas (owner 2026-07-09: youth seasons
// aren't comparable across years — past seasons are a scrapbook, not a scoreboard).
export function ResultsPanel({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { loading: ctxLoading } = useCoaches();
  /**
   * ⚠⚠ WHICH SEASON — the whole point of this page's 2026-08-16 rework (archive rail Phase 1).
   *
   * This page used to decide what to show from `!assignment && !!closedAssignment` — "does this
   * coach still hold a LIVE assignment?" — which is a different question from the one the coach
   * asked. One missing question produced TWO wrong answers: a coach who still ran the team opened
   * a past season and got THIS season's record and game log with no chip to say so, while a coach
   * with no live assignment had the game log suppressed outright, so the archive's own results
   * door showed no results.
   *
   * The season now decides, and WHO is reading decides nothing. `page.capabilities` are that
   * season's (governing rule 1) and `page.isReadOnly` is derived from the SEASON, never from the
   * team — a rolled-forward team is not itself closed.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const sportPack = getSportPack(page.teamSport ?? DEFAULT_SPORT);
  const scoreUnit = sportPack.score.unit.toLowerCase();

  /* ⚠ `base` is gone too: the only link this report still built from it was the per-season
     "Season Wrapped →" row, and the report now contains no link that leaves the season. */
  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /**
   * Guards the stale flash on client-side switches — the page doesn't remount for either.
   * ⚠ The key was `${teamId}|${seasonQuery}` while a season switcher could rewrite this page's
   * own URL without remounting it. That trigger is deleted (P2, 2026-08-16) and the composite key
   * went with it — the TEAM half is still real, because this component survives a team switch.
   */
  const loadKey = teamId;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Coach Tags: the team's game-tag library + which tags each event carries (both already
  // returned by the events GET — this report is the first consumer of them).
  const [teamTags, setTeamTags] = useState<RepTeamTag[]>([]);
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, string[]>>({});
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  /**
   * ⚠⚠ EVERY WRITE IS GUARDED, not just the render (added by `/review` 2026-08-16).
   *
   * The `loadedFor`/`loadKey` pair guards what is PAINTED. It does not guard what is WRITTEN — and
   * once the season became a re-fire trigger, that gap became reachable in a routine flow: switch
   * to a slow season, switch again to a fast one, and the slow response lands last. Its `finally`
   * then stamps `loadedFor` with ITS season, which no longer matches the season on screen, so the
   * correct table the coach was already reading flips back to "Loading report…" — and stays there,
   * because nothing in `load`'s deps has changed, so the effect never re-fires. A page that paints
   * the right answer and then takes it away for good.
   *
   * Same `isStale()` shape the Lineups and Practice hubs adopted a day earlier for the same class
   * of bug. This page had only the render half of it.
   */
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      /* ⚠ THE CROSS-SEASON `/history` READ IS GONE (2026-08-19). It existed solely to fill the
         past-seasons list at the foot of this report, and the owner removed that list — a report
         about THIS season had no business ending in a table of every other one. One request saved
         on every visit to the tab; the route itself is untouched and still serves the closed-season
         page, which is where a finished year is read now. */
      const evRes = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      /* A team with NO season resolvable at all — not even a finished one — 403/404s on /events.
         ⚠ That USED to be a legitimate state worth rendering, because the past-seasons list below
         was the whole point of the page then. With that list gone there is nothing left to show, so
         it is an honest empty result rather than a special case. Any OTHER events failure (a 500)
         is still a real error — swallowing it would render a misleading "No results yet" over a
         team that has played games (adversarial review). */
      const eventsClosedOut = !evRes.ok && (evRes.status === 403 || evRes.status === 404);
      if (!evRes.ok && !eventsClosedOut) throw new Error();
      const ev = evRes.ok ? await evRes.json() : null;
      if (isStale()) return;
      // ⚠ CLEARED, not left alone, when the events read is refused. `eventsClosedOut` is a
      // legitimate state rather than an error, but skipping the writes entirely left the PREVIOUS
      // season's games in state while `loadedFor` said the new one had landed — which is the wrong
      // season's game log under the right season's chip, silently. Absent data reads as absent.
      setEvents(ev?.events ?? []);
      setTeamTags(ev?.tags ?? []);
      setTagsByEventId(ev?.tagsByEventId ?? {});
    } catch {
      if (!isStale()) setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      // ⚠ A stale run must not stamp its own season here — that is the whole defect.
      if (!isStale()) {
        setLoadedFor(loadKey);
        setLoading(false);
      }
    }
  }, [orgSlug, teamId, loadKey]);

  useEffect(() => {
    if (ctxLoading) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() => load(isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ `hasAccess` covers live AND archived assignments. The old test here was the live one only,
  // which is how the hub next door still tells a coach their own finished season's team "not found".
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Finalized = a result exists (unscored games never count — a null result is not a loss).
  const finalized = events
    .filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled' && e.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const byType = GAME_EVENT_TYPES
    .map(t => ({ type: t, ...tally(finalized.filter(e => e.eventType === t)) }))
    .filter(r => r.w + r.l + r.t > 0);
  const scored = finalized.filter(e => e.teamScore != null && e.opponentScore != null);
  const close = tally(scored.filter(e => Math.abs((e.teamScore ?? 0) - (e.opponentScore ?? 0)) === 1));
  const closeGames = close.w + close.l + close.t;

  // Coach Tags — "vs tag" filter. Chips are built from finalized games only (this report's own
  // scope), so a chip's count always matches how many rows selecting it will show; a tag with zero
  // finalized games simply never gets a chip (self-hides per the plan). Derived every render
  // (not synced via an effect) so a tag deleted/merged elsewhere just quietly stops matching.
  //
  // ⚠ The record suppression here is DELETED (2026-08-18), and the reason it existed is worth
  // keeping: game tags are a LIVE vocabulary the coach renames, merges and deletes as the season
  // goes, so offering a finished season's games filtered by a tag invented last week is a page
  // quietly answering a question nobody could have asked that year. This page now only ever shows
  // the live season, so the filter is always about the vocabulary that produced it.
  const tagChips = teamTags
    .map(tag => ({ tag, count: finalized.filter(e => (tagsByEventId[e.id] ?? []).includes(tag.id)).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  const activeTag = tagChips.find(c => c.tag.id === activeTagId)?.tag ?? null;
  const visibleGames = activeTag
    ? finalized.filter(e => (tagsByEventId[e.id] ?? []).includes(activeTag.id))
    : finalized;
  const tagRecord = activeTag ? tally(visibleGames) : null;
  // Result and score are independent nullable fields (a coach can log a W/L/T with no score
  // entered) — sum only games that actually HAVE both numbers, same guard as `scored` above,
  // so an unscored result can't silently fold into the total as a phantom 0–0.
  const tagRuns = activeTag
    ? visibleGames
        .filter(e => e.teamScore != null && e.opponentScore != null)
        .reduce((acc, e) => ({
          rf: acc.rf + (e.teamScore ?? 0),
          ra: acc.ra + (e.opponentScore ?? 0),
        }), { rf: 0, ra: 0 })
    : null;

  return (
    /* ⚠ NO WRAPPER, NO BACK LINK, NO HEADER — this is a PANEL now (reports portal P1, 2026-08-18).
       The hub owns `styles.page`, the `<h1>`, the help "?" and the tab row that names this report;
       a panel that re-declared any of them would nest a page inside a page and put a second title
       under the first. The back link went with the route: "Results" is a tab you are standing on,
       not a place you drilled into, so there is nothing to go back FROM. */
    <>
      {loading || loadedFor !== loadKey ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {finalized.length === 0 ? (
            <div className={styles.emptyState}>
              <Trophy size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              <p className={styles.emptyStateTitle}>No results yet</p>
              <p className={styles.emptyStateSub}>Once a game gets a score, it shows up here.</p>
            </div>
          ) : (
            <>
              {activeTag ? (
                <div className={styles.insightsTagSummary}>
                  <span className={styles.insightsTagSummaryLbl}>vs {activeTag.name}:</span>
                  <span className={styles.insightsTagSummaryRec}>{recStr(tagRecord!)}</span>
                  <span className={styles.insightsTagSummaryRuns}>{tagRuns!.rf} {scoreUnit} for, {tagRuns!.ra} against</span>
                </div>
              ) : (
                <p className={styles.insightsBasis}>
                  {byType.map((r, i) => `${i > 0 ? ' · ' : ''}${TYPE_LABEL[r.type]} ${recStr(r)}`).join('')}
                  {closeGames > 0 && <> · {recStr(close)} in one-{scoreUnit} games</>}
                </p>
              )}

              {tagChips.length > 0 && (
                <div className={styles.lineupFilterBar} role="group" aria-label="Filter by tag">
                  <button
                    type="button"
                    aria-pressed={!activeTag}
                    className={`${styles.lineupFilterChip} ${!activeTag ? styles.lineupFilterChipActive : ''}`}
                    onClick={() => setActiveTagId(null)}
                  >
                    {!activeTag && <Check size={12} aria-hidden />} All
                  </button>
                  {tagChips.map(c => (
                    <button
                      key={c.tag.id}
                      type="button"
                      aria-pressed={activeTag?.id === c.tag.id}
                      className={`${styles.lineupFilterChip} ${activeTag?.id === c.tag.id ? styles.lineupFilterChipActive : ''}`}
                      onClick={() => setActiveTagId(c.tag.id)}
                    >
                      {activeTag?.id === c.tag.id && <Check size={12} aria-hidden />} {c.tag.name} <b className={styles.lineupFilterCount}>{c.count}</b>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.insightsTableWrap}>
                <table className={styles.insightsTable}>
                  <thead><tr><th>Date</th><th>Game</th><th>Type</th><th>Result</th><th>Score</th>{tagChips.length > 0 && <th>Tags</th>}</tr></thead>
                  <tbody>
                    {visibleGames.map(e => (
                      <tr key={e.id}>
                        <td className={styles.insightsNum}>{new Date(e.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</td>
                        <td>{gameTitle(e)}</td>
                        <td className={styles.mutedInline}>{TYPE_LABEL[e.eventType]}</td>
                        <td><span className={styles.wltPip} data-r={e.result ?? undefined}>{e.result === 'win' ? 'W' : e.result === 'loss' ? 'L' : 'T'}</span></td>
                        <td className={styles.insightsNum}>
                          {e.teamScore != null && e.opponentScore != null ? `${e.teamScore}–${e.opponentScore}` : '—'}
                        </td>
                        {tagChips.length > 0 && (
                          <td>
                            {(tagsByEventId[e.id] ?? []).length > 0 ? (
                              <div className={styles.lineupChips}>
                                {(tagsByEventId[e.id] ?? []).map(tagId => {
                                  const tag = teamTags.find(t => t.id === tagId);
                                  return tag ? <span key={tagId} className={styles.lineupChip}>{tag.name}</span> : null;
                                })}
                              </div>
                            ) : (
                              <span className={styles.mutedInline}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/**
            * ⚠⚠ **THE PAST-SEASONS LIST IS DELETED FROM THIS REPORT** (owner, 2026-08-19).
            *
            * It listed every season the team has played — record, roster size, tryout acceptance —
            * with each row opening that season's own page, and it sat at the foot of a report about
            * THIS season. The owner's call on seeing it: it does not need to be here.
            *
            * ⚠⚠ **AND THE DOOR THAT POINTED AT IT WENT WITH IT.** Season's End's "Compare every
            * season" row is deleted in the same change, deliberately: a door onto a list that no
            * longer exists is the loop-back defect that page has already been fixed for once, and
            * leaving it would have been the more expensive half of this removal.
            *
            * ⚠ **KNOWN AND ACCEPTED CONSEQUENCE:** while a season is RUNNING there is now no route
            * to a previous season's page. Look-back happens once the current season is closed, when
            * the team's one door becomes its Season's End page. Anyone tempted to re-add a compare
            * list to a live screen is reopening a settled decision, not fixing an oversight.
            *
            * ⚠ The cross-season read itself is untouched — `/history` still serves every season and
            * the closed-season page still reads it. This removed a VIEW, not a contract.
            */}
        </>
      )}
    </>
  );
}
