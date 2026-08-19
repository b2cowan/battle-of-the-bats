'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Scale, BarChart3 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import styles from '../../../../coaches.module.css';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';
import type { PositionRecencyMatrix } from '@/lib/coach-position-recency';
import { formatRecord } from '@/lib/coach-season-record';

/**
 * How a recency cell is tinted. Bands, not a gradient: the question is "has it been a while?", and
 * a continuous scale invites reading a 9 as meaningfully different from an 11.
 *
 * ⚠ The tint is a SECOND channel, never the only one — every cell also prints its number
 * ([[reference_warm_theme_badge_contrast]] and the olive↔danger ΔE finding: colour alone has failed
 * a deuteranope on this palette before).
 */
function recencyBand(days: number): 'fresh' | 'week' | 'stale' {
  if (days <= 7) return 'fresh';
  if (days <= 14) return 'week';
  return 'stale';
}

/** "today" / "yesterday" / "9 days" — the span, never a verdict about whether it is too long. */
function daysWord(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days`;
}

// One player per row — the five old accordion read-outs merged into a single table (design log
// 2026-07-09: reports are real tables, never stacked disclosure widgets).
interface PlayerRow {
  playerId: string;
  name: string;
  fieldInnings: number;
  benchInnings: number;
  backToBackGames: number;
  positions: string[];
  inningsPitched: number | null;
  perGameCap: number | null;
  overCapGames: number;
}

function mergeRows(a: SeasonLineupAnalytics): PlayerRow[] {
  const byId = new Map<string, PlayerRow>();
  const ensure = (playerId: string, name: string): PlayerRow => {
    let r = byId.get(playerId);
    if (!r) {
      r = { playerId, name, fieldInnings: 0, benchInnings: 0, backToBackGames: 0, positions: [], inningsPitched: null, perGameCap: null, overCapGames: 0 };
      byId.set(playerId, r);
    }
    return r;
  };
  for (const f of a.fairPlay) {
    const r = ensure(f.playerId, f.name);
    r.fieldInnings = f.fieldInnings;
    r.benchInnings = f.benchInnings;
  }
  for (const b of a.benchBalance) ensure(b.playerId, b.name).backToBackGames = b.backToBackGames;
  for (const p of a.positionVariety) ensure(p.playerId, p.name).positions = p.positions;
  for (const c of a.armCare) {
    const r = ensure(c.playerId, c.name);
    r.inningsPitched = c.inningsPitched;
    r.perGameCap = c.perGameCap;
    r.overCapGames = c.overCapGames;
  }
  // Most-benched first — this is the distribution question the page answers.
  return [...byId.values()].sort((x, y) => y.benchInnings - x.benchInnings);
}

export function PlayingTimePanel({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const periods = sportPack.periodLabelPlural.toLowerCase();
  const canLineups = !!assignment?.capabilities.lineups;

  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [recency, setRecency] = useState<PositionRecencyMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Guards the stale-team flash on client-side team switches (page doesn't remount).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  /**
   * ⚠⚠ **EVERY WRITE IS GUARDED, INCLUDING THE ONE IN `finally`** — this was the ONE report of the
   * six without the `isStale()` shape its five siblings all carry, and becoming a PANEL is what made
   * the gap reachable in ordinary use.
   *
   * The defect: `setLoadedFor(teamId)` ran unconditionally in `finally`, over a `teamId` captured in
   * the closure. Switch from team A to a faster team B and A's superseded response lands last,
   * stamping `loadedFor = 'A'` while the screen is showing B. The render guard below then reads
   * `loadedFor !== teamId` and falls back to "Loading report…" — forever, because nothing in the
   * effect's deps has changed, so it never re-fires. A page that paints the right answer and then
   * takes it away for good.
   *
   * ⚠ **As a PAGE this was survivable and as a PANEL it is not.** Leaving the report for another one
   * used to unmount it, which reset the state; panels stay mounted (`display:none`) by design, so a
   * stranded panel now stays stranded across every tab switch. Same reasoning, same `isStale()`
   * shape, as `results/panel.tsx` and the hub itself.
   */
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      // `?recency=1` (P2) rides the SAME call rather than adding a second round trip: the matrix is
      // a pivot of the very lineups this response is already computed from, so a second request
      // would re-read them and could disagree with the table beside it if a lineup was saved
      // between the two. ⚠ It names no season, and this route may never learn to — playing time is
      // live-season-only permanently (owner, 2026-08-16), because it is RECOMPUTED.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics?recency=1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!isStale()) {
        setAnalytics(data.analytics ?? null);
        // ⚠ Reset on every landing, not just on success-with-data: a team whose sport has no field
        // positions returns none, and keeping the previous team's matrix would attribute one team's
        // lineups to another.
        setRecency(data.recency ?? null);
      }
    } catch {
      if (!isStale()) setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      // ⚠ A stale run must not stamp its own team here — that is the whole defect.
      if (!isStale()) {
        setLoadedFor(teamId);
        setLoading(false);
      }
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() => load(isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, canLineups, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const rows = analytics && analytics.gamesWithLineup > 0 ? mergeRows(analytics) : [];
  /** The sport's word for one period or many — "3 innings" / "1 inning". Both new sections below
   *  quote a count of them, and the singular rule is theirs to share, not to repeat. */
  const periodWord = (n: number) => (n === 1 ? sportPack.periodLabel.toLowerCase() : periods);
  /** Both new sections look a player up in the matrix — the grid to re-order itself to match the
   *  table above, arm care to find each pitcher's rest. One Map, built once, instead of a scan of
   *  `recency.rows` per row and per pitcher. */
  const recencyByPlayer = new Map((recency?.rows ?? []).map(m => [m.playerId, m]));

  return (
    /* ⚠ NO WRAPPER AND NO HEADER — this is a PANEL (reports portal P1, 2026-08-18). The hub owns
       `styles.page`, the <h1> and the help "?".

       ⚠ The deliberate ABSENCE of a back link survives the move and is now structural rather than
       argued: this report had FOUR doors (the hub, the game console, an Overview tile and the team
       page's "Season insights →"), so a link asserting "Insights" was wrong for three arrivals out
       of four. Every one of those doors now lands on this TAB, where the tab row is the answer to
       "where am I?" and no back link has to guess. */
    <>
      {!canLineups ? (
        <div className={styles.emptyState}>
          <Scale size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      ) : loading || loadedFor !== teamId ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !analytics || analytics.gamesWithLineup === 0 ? (
        <div className={styles.emptyState}>
          <BarChart3 size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No playing-time data yet</p>
          <p className={styles.emptyStateSub}>Save a lineup for a few games and this report fills in on its own.</p>
        </div>
      ) : (
        <>
          <p className={styles.insightsBasis}>One row per player, based on the {analytics.gamesWithLineup} game{analytics.gamesWithLineup === 1 ? '' : 's'} you&apos;ve saved a lineup for.</p>

          {/* data-sandbox-tour: the beat the demo's "who's actually been on the field" step rings.
              Inert off a demo org — no styling, no behaviour. */}
          <div className={styles.insightsTableWrap} data-sandbox-tour="playing-time">
            <table className={styles.insightsTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>On field</th>
                  <th>Bench</th>
                  <th>Back-to-back sits</th>
                  <th>Positions played</th>
                  <th>Pitching</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const total = r.fieldInnings + r.benchInnings;
                  const pct = total > 0 ? Math.round((r.fieldInnings / total) * 100) : 0;
                  return (
                    <tr key={r.playerId}>
                      <td>{r.name}</td>
                      <td className={styles.insightsNum}>
                        {r.fieldInnings}
                        <span className={styles.insightsFieldBar} aria-hidden><i style={{ width: `${pct}%` }} /></span>
                      </td>
                      <td className={styles.insightsNum}>{r.benchInnings}</td>
                      <td className={styles.insightsNum}>{r.backToBackGames > 0 ? r.backToBackGames : '—'}</td>
                      <td>{r.positions.length ? r.positions.join(', ') : '—'}</td>
                      <td className={styles.insightsNum}>
                        {r.inningsPitched != null && r.inningsPitched > 0 ? (
                          <>
                            {r.inningsPitched} {sportPack.periodLabel === 'Inning' ? 'IP' : periods}
                            {r.perGameCap != null && <span className={styles.mutedInline}> · cap {r.perGameCap}/g</span>}
                            {r.overCapGames > 0 && <span className={styles.insightsFlagWarn}> ⚠ over cap ×{r.overCapGames}</span>}
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ══ POSITION RECENCY (Reports Portal P2) ═══════════════════════════════════════════
              The retired Ask bar's "who hasn't played a position lately?" made permanent. It reads
              as a matrix rather than one position at a time because the coach's real question is
              comparative — where the gaps are, not what the gap at shortstop is.

              ⚠⚠ **IT MAY ONLY CLAIM WHAT A SAVED LINEUP RECORDS** (`lib/coach-position-recency.ts`
              states this as its own contract). A dash is "no saved lineup has put them here",
              NOT "they can't play here" and NOT a season-long gap — and it must never be "improved"
              by reading a roster's primary-position field, because an intention is not a record.

              ⚠ It says how long it has been. It never says anyone is OWED a turn
              (memory/decision_playing_time_vocabulary.md: measurement in context, never a verdict).
              That is why there is no "longest wait" column, no ordering by staleness and no flag. */}
          {recency && recency.rows.length > 0 && recency.positions.length > 0 && (
            <section style={{ marginTop: '1.75rem' }}>
              <p className={styles.sectionKicker}>Position recency</p>
              <p className={styles.insightsBasis}>
                Days since each player last played each spot, from the {recency.gamesRead} game{recency.gamesRead === 1 ? '' : 's'} you&apos;ve saved a lineup for.
              </p>
              <div className={styles.insightsTableWrap}>
                <table className={styles.insightsTable}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      {recency.positions.map(p => (
                        <th key={p.code} className={styles.ptMatrixHead} scope="col" title={p.label}>{p.code}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ordered to match the table above — the two are read down together, and a
                        second ordering would make a coach re-find the same player twice. */}
                    {rows
                      .map(r => recencyByPlayer.get(r.playerId))
                      .filter((m): m is PositionRecencyMatrix['rows'][number] => !!m)
                      .map(m => (
                        <tr key={m.playerId}>
                          <td>{m.name}</td>
                          {recency.positions.map(p => {
                            const cell = m.byPosition[p.code];
                            return cell ? (
                              <td
                                key={p.code}
                                className={`${styles.insightsNum} ${styles.ptMatrixCell}`}
                                data-band={recencyBand(cell.daysSince)}
                                /* The receipt, on hover and to a screen reader: the number alone
                                   says "how long", this says "since what". */
                                title={`Last played ${p.label} ${daysWord(cell.daysSince)} ago — ${cell.innings} ${periodWord(cell.innings)}`}
                              >
                                {cell.daysSince}
                              </td>
                            ) : (
                              <td key={p.code} className={`${styles.insightsNum} ${styles.ptMatrixNever}`} title={`No saved lineup has put ${m.name} at ${p.label} this season`}>
                                &mdash;
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {/* ⚠ The legend explains the TINT; every cell still prints its own number, so the
                  colour is never the only channel carrying the reading. */}
              <div className={styles.ptMatrixLegend}>
                <span><i data-band="fresh" aria-hidden />Within a week</span>
                <span><i data-band="week" aria-hidden />1&ndash;2 weeks</span>
                <span><i data-band="stale" aria-hidden />Longer</span>
                <span><i data-band="never" aria-hidden />&mdash; not in a saved lineup this season</span>
              </div>
            </section>
          )}

          {/* ══ ARM CARE (Reports Portal P2) ═══════════════════════════════════════════════════
              The retired "whose arm needs a rest?" made permanent.

              ⚠⚠ **THE MOCKUP DREW THIS AGAINST A WEEKLY INNINGS CAP THAT DOES NOT EXIST, AND MUST
              NOT BE INVENTED.** It showed "16 of 18 · 2 left" with a bar filling toward a ceiling.
              This product has NO weekly and NO season innings limit: every cap it stores is PER
              GAME and is a number THE COACH SET (`lib/coach-arm-care.ts` states exactly this, and
              why — inventing a ceiling to warn against would be the product proposing a figure as
              though it were a rule, in the one place where the cost is a child's arm). The mockup
              also compared a SEASON innings total to a PER-GAME cap, which is the same conflation.

              Owner call, 2026-08-19: redraw it against real numbers rather than build a cap. So
              this is a table of what the saved lineups actually record — season workload, rest
              since the last outing, and the coach's own per-game cap — with no bar, no remainder
              and no ceiling. A real weekly cap, if it is ever wanted, is its own project: it needs
              a setting, and the game-day console's chip and `lib/lineup-caps.ts` must move with it
              so three surfaces never quote a child different ceilings. */}
          {sportPack.pitcherPosition && analytics.armCare.length > 0 && (
            <section style={{ marginTop: '1.75rem' }}>
              <p className={styles.sectionKicker}>Arm care</p>
              <div className={styles.insightsTableWrap}>
                <table className={styles.insightsTable}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Season</th>
                      <th>Last outing</th>
                      <th>Your per-game cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.armCare.map(c => {
                      // Rest comes from the SAME matrix above, at the sport's pitcher position —
                      // one derivation, so the two sections can never disagree about a date.
                      const rest = recencyByPlayer.get(c.playerId)
                        ?.byPosition[sportPack.pitcherPosition as string];
                      return (
                        <tr key={c.playerId}>
                          <td>{c.name}</td>
                          <td className={styles.insightsNum}>
                            {c.inningsPitched} {periods}
                            <span className={styles.mutedInline}> · {c.gamesPitched} game{c.gamesPitched === 1 ? '' : 's'}</span>
                          </td>
                          <td className={styles.insightsNum}>
                            {rest ? (
                              <>
                                {daysWord(rest.daysSince)}{rest.daysSince > 0 ? ' ago' : ''}
                                <span className={styles.mutedInline}> · {rest.innings} {periodWord(rest.innings)}</span>
                              </>
                            ) : '—'}
                          </td>
                          <td className={styles.insightsNum}>
                            {c.perGameCap != null ? (
                              <>
                                {c.perGameCap}/game
                                {c.overCapGames > 0 && (
                                  <span className={styles.insightsFlagWarn}> ⚠ over in {c.overCapGames} game{c.overCapGames === 1 ? '' : 's'}</span>
                                )}
                              </>
                            ) : (
                              /* No cap set anywhere. A surface handed null must say NOTHING rather
                                 than invent a ceiling the coach never set. */
                              <span className={styles.mutedInline}>not set</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* ⚠ THIS SENTENCE IS THE POINT OF THE WHOLE SECTION, not a footnote to it: it is what
                  stops a coach reading the figures above as a budget they are spending down. */}
              <p className={styles.insightsBasis} style={{ marginTop: '0.5rem' }}>
                Counted from saved lineups. There is no weekly or season {sportPack.periodLabelPlural.toLowerCase()} limit here &mdash; the only
                ceiling shown is the per-game cap you set yourself, in lineup settings.
              </p>
            </section>
          )}

          <section style={{ marginTop: '1.75rem' }}>
            <p className={styles.sectionKicker}>Which lineup wins?</p>
            {analytics.reusedLineups.length === 0 ? (
              <p className={styles.insightsQuietText}>No batting order has been reused across multiple games yet — once you run one twice, its record shows up here.</p>
            ) : (
              <>
                <div className={styles.insightsTableWrap}>
                  <table className={styles.insightsTable}>
                    <thead><tr><th>Batting order</th><th>Record</th><th>Times used</th></tr></thead>
                    <tbody>
                      {analytics.reusedLineups.map((r, i) => (
                        <tr key={i}>
                          <td>{r.label}</td>
                          <td className={styles.insightsNum}>
                            {r.scoredGames > 0
                              ? <b className={styles.insightsRecGood}>{formatRecord({ w: r.wins, l: r.losses, t: r.ties })}</b>
                              : <span className={styles.mutedInline}>no scores yet</span>}
                          </td>
                          <td className={styles.insightsNum}>
                            {r.games}{r.scoredGames > 0 && r.scoredGames < r.games ? <span className={styles.mutedInline}> ({r.scoredGames} scored)</span> : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.insightsBasis} style={{ marginTop: '0.5rem' }}>Records count only games with a score entered.</p>
              </>
            )}
          </section>

          <Link href={`${base}/lineups`} className={styles.insightsOpsLink}>Manage lineups →</Link>
        </>
      )}
    </>
  );
}
