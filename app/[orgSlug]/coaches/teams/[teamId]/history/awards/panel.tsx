'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { Award, ChevronRight, Printer, Trash2, Pencil } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import AwardSheet from '@/components/coaches/AwardSheet';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import { canManageAwards } from '@/lib/coach-capabilities';
import styles from '../../../../coaches.module.css';
import { CoachListToolbar } from '@/components/coaches/kit';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import type { RepPlayerAward, RepTeamAwardType } from '@/lib/types';
import { formatStoredDate } from '@/lib/timezone';
import { awardTypeLabel } from '@/lib/rep-award-occasion';

/** "Apr 28" — the house formatter, never the browser's locale (the certificate's own lesson). */
const shortDate = (a: RepPlayerAward) => formatStoredDate(a.awardedAt, { withYear: false });
/** What an award was for, as both history tables print it. */
const awardFor = (a: RepPlayerAward) => a.occasionLabel ?? (a.tournamentLabel || 'General');

// "Who's earning it?" — a new report (not a metric folded into an existing one, unlike the
// "vs tag" report) because a player leaderboard is a genuinely different shape: players ranked
// by recognition, not games. Owner-confirmed placement as the Insights hub's 5th tile,
// 2026-07-12 (see COACH_TAGS_AWARDS_PLAN.md P2).
export function AwardsPanel({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  /**
   * ⚠⚠ AN ARCHIVE DOOR SINCE 2026-08-16 (archive rail Phase 2, owner-approved with the phase).
   * This page is BOTH a record and an instrument — it gives awards, manages the type library and
   * removes rows — so becoming season-aware meant three separate things, not one:
   *
   *   1. **Read the season** and send it to both fetches (the routes have been on the season-read
   *      rail since Chunk F; the page simply never asked).
   *   2. **Put the instruments away in a record.** Give / Manage / Remove are absent in a finished
   *      season — CLAUDE.md rule 1, records in, instruments out. The server refuses them anyway:
   *      every write verb here resolves the ACTIVE year and cannot address a past season at all.
   *   3. **Stop the report spanning seasons.** Fixed at the route, not here — see the awards GET.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const caps = page.capabilities;
  /**
   * ⚠ `isRecord` is GONE (2026-08-18). It hid "Give an award", the old award-type manager link and the
   * per-row Remove control, and swapped four sentences into the past tense — all to describe a
   * finished season, which this page is no longer rendered for. The keepsake half (printing a
   * certificate) never depended on it and is untouched.
   */
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const { loading: ctxLoading } = useCoaches();
  const confirm = useConfirm();
  // On a phone the history is a table whose ROW opens the award's sheet (phone plan §14.13); the
  // desktop keeps its five columns and three icons.
  const isPhone = useIsPhone();

  const [awardTypes, setAwardTypes] = useState<RepTeamAwardType[]>([]);
  const [awards, setAwards] = useState<RepPlayerAward[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string; number: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // The Award filter — empty = every award (MultiSelectDropdown's own rule).
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(() => new Set());
  // The award whose sheet is open (a phone), by id so a quiet re-read hands it the fresh record.
  const [openAwardId, setOpenAwardId] = useState<string | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  // Editing an already-given award (Awards One Tag Idiom Part A) reuses the give form — null
  // when the modal is giving a NEW award instead.
  const [editingAward, setEditingAward] = useState<RepPlayerAward | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [noSeason, setNoSeason] = useState(false);

  /**
   * ⚠ The key carries the season, and every write is guarded against a stale run — the switcher
   * rewrites this page's own URL and the page does not remount, so a team-only key paints one
   * season's leaderboard under another's chip, and an unguarded write from a superseded run can
   * strand the page on "Loading report…" for good. Same shape as the results page and the hub.
   */
  const loadKey = teamId;

  /**
   * ⚠⚠ STALENESS IS INTERNAL, BECAUSE AN OPT-IN GUARD GETS FORGOTTEN — and it was, three times
   * (`/review` 2026-08-16).
   *
   * This started as `load(isStale)` with a no-op default, so only the caller that remembered to
   * pass a predicate was protected. The mount effect remembered. The three WRITE-triggered reloads
   * — after removing an award, and the two modals' `onChanged` — did not, and Phase 2 is what made
   * that reachable: it put a season chip on this page for the first time, and the chip re-navigates
   * without remounting. Delete an award, switch season before the reload lands, and the superseded
   * run stamps ITS key into `loadedFor` — the page falls back to "Loading report…" and **stays
   * there forever**, because nothing in the effect's deps has changed so it never re-fires.
   *
   * A generation counter makes every run stale the moment a newer one starts, whoever started it.
   * The caller cannot opt out, and a fourth caller added later is protected without knowing this
   * comment exists — which is the only kind of guard that survives.
   */
  const runRef = useRef(0);
  const load = useCallback(async (isCancelled: () => boolean = () => false, { quiet = false, withTypes = true }: { quiet?: boolean; withTypes?: boolean } = {}) => {
    const myRun = ++runRef.current;
    // Superseded by a newer run (any caller), or cancelled by the effect (unmount / season change).
    const isStale = () => isCancelled() || runRef.current !== myRun;
    // ⚠ QUIET = the award's sheet saved (phone plan §14.13). It autosaves as the coach edits, and a
    // loud reload swapped the whole report for "Loading report…" behind the open sheet on every
    // pause in typing. Quiet re-reads the list in place, and a failed quiet read leaves the report
    // as it stands — the save itself already landed. `withTypes: false` = a save on the award's sheet
    // (a player, a note), which cannot have changed the award-type library, so it is not re-read.
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const [typesRes, awardsRes] = await Promise.all([
        withTypes ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`) : Promise.resolve(null),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`),
      ]);
      // No active program year is a legitimate state, not a retryable failure — the same
      // honest-empty branch this report's three siblings already have (WI-7). ⚠ Far RARER now:
      // with a season on the request the routes resolve that season and answer normally, which is
      // what gives a coach with no live assignment their own past season's awards at all.
      if (typesRes?.status === 404 || awardsRes.status === 404) {
        if (isStale()) return;
        setNoSeason(true);
        setAwardTypes([]);
        setAwards([]);
        setPlayers([]);
        return;
      }
      if ((typesRes && !typesRes.ok) || !awardsRes.ok) throw new Error();
      const types = typesRes ? await typesRes.json() : null;
      const data = await awardsRes.json();
      if (isStale()) return;
      setNoSeason(false);
      if (types) setAwardTypes(types.tags ?? []);
      setAwards(data.awards ?? []);
      setPlayers(data.players ?? []);
    } catch {
      if (!isStale() && !quiet) setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      if (!isStale()) {
        setLoadedFor(loadKey);
        setLoading(false);
      }
    }
  }, [orgSlug, teamId, loadKey]);
  const reloadQuietly = useCallback(() => { void load(undefined, { quiet: true }); }, [load]);
  const reloadAwardsQuietly = useCallback(() => { void load(undefined, { quiet: true, withTypes: false }); }, [load]);

  useEffect(() => {
    if (ctxLoading) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() => load(isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ `hasAccess` covers live AND archived assignments — the live-assignment test that stood here
  // told a coach with no live assignment their own finished season's team was "not found".
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }
  // ⚠ THAT season's grant (governing rule 1), never the coach's current one — a coach cleared for
  // awards today but not in 2024 must not read 2024's leaderboard. The API re-decides this
  // independently and is the authority; this only keeps the page from drawing onto a 403.
  if (!caps || !canManageAwards(caps)) {
    return (
      <div className={styles.notAssigned}>
        <h2>No access</h2>
        <p>You don’t have access to awards for this team.</p>
      </div>
    );
  }

  // The Award filter's options are the types with at least one award (an unused type self-hides,
  // as the chips it replaced did), most-given first, each with its count.
  const typeChips = awardTypes
    .map(t => ({ type: t, count: awards.filter(a => a.awardTypeId === t.id).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
  /* ⚠ ONE FILTER, BOTH TABLES (phone plan §14.13 · R9, owner 2026-09-25). The owner asked for a
     multi-select on the history; the chips above the leaderboard already filtered BOTH tables, so a
     second, history-only filter would have put two filters over one field on one screen — the
     chip says MVP, the history's says big bat, and the history comes up empty. The one multi-select
     REPLACES the chips. A chosen type that no longer has an award (removed, merged) drops out. */
  const selected = new Set([...selectedTypeIds].filter(id => typeChips.some(c => c.type.id === id)));
  const visibleAwards = selected.size ? awards.filter(a => selected.has(a.awardTypeId)) : awards;
  // Print is for ONE award at a time — a stack of mixed certificates is not a thing a coach prints.
  const printType = selected.size === 1 ? typeChips.find(c => selected.has(c.type.id))?.type ?? null : null;
  const openAward = openAwardId ? awards.find(a => a.id === openAwardId) ?? null : null;

  const leaderboard = (() => {
    const byPlayer = new Map<string, { playerId: string; playerName: string; total: number; byType: Map<string, { type: RepTeamAwardType | undefined; count: number }> }>();
    for (const a of visibleAwards) {
      const entry = byPlayer.get(a.playerId) ?? { playerId: a.playerId, playerName: a.playerName ?? 'Unknown player', total: 0, byType: new Map() };
      entry.total += 1;
      const t = entry.byType.get(a.awardTypeId) ?? { type: a.awardType, count: 0 };
      t.count += 1;
      entry.byType.set(a.awardTypeId, t);
      byPlayer.set(a.playerId, entry);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.total - a.total);
  })();

  /** Asks, then removes. 'removed' / 'kept' (the coach said no) / the sentence of a failure — the
   *  award's sheet shows that sentence itself, since the page's own line sits behind the sheet. */
  async function handleDelete(award: RepPlayerAward): Promise<'removed' | 'kept' | string> {
    // ⚠ It used to ask "Undo MVP for Blake Test? This can't be undone." — offering an undo and
    // denying one in the same breath (found drawing the phone sheet, 2026-09-25).
    const ok = await confirm({
      title: `Remove ${award.playerName ?? 'this player'}’s ${award.awardType?.name ?? 'award'}?`,
      message: 'This can’t be undone.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return 'kept';
    setDeleteError('');
    setBusyId(award.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards/${award.id}`, { method: 'DELETE' });
      if (res.ok) {
        // Quietly, in place — a loud load swapped the whole report for "Loading report…" and lost the
        // coach's place in the list (/review, 2026-09-25).
        reloadQuietly();
        return 'removed';
      }
      const d = await res.json().catch(() => ({ error: res.statusText }));
      const message = d.error ?? 'Could not remove this award';
      setDeleteError(message);
      return message;
    } catch {
      const message = 'Could not remove this award — check your connection and try again.';
      setDeleteError(message);
      return message;
    } finally {
      setBusyId(null);
    }
  }

  return (
    /* ⚠ NO WRAPPER, NO BACK LINK, NO HEADER — this is a PANEL (reports portal P1, 2026-08-18).
       The hub owns `styles.page`, the <h1> and the help "?", and its tab row is what tells a coach
       they are on Awards. "Give an award" stays in the panel's own toolbar rather than moving to
       the hub header — the page-level action ruling (2026-08-13) puts a tab-scoped action beside
       the thing it names, and a hub header above the tab row cannot see which tab is open.
       ⚠ The old separate award-type manager link retired from here (Awards Join the One Tag
       Idiom Part B) — the door lives inside the Give window now, where every other tag
       library's door lives too. */
    <>
      {loading || loadedFor !== loadKey ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noSeason ? (
        <div className={styles.emptyState}>
          <Award size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No season set up yet</p>
          <p className={styles.emptyStateSub}>Awards live inside a season — start one from your team settings and this report fills in.</p>
        </div>
      ) : (
        <>
          {/* ⚠⚠ ONE ROW OF CONTROLS, directly above the leaderboard (phone plan §14.13 · R7 + R9, owner
              2026-09-25): the Award filter at the left, "Give an award" at the right. The kit's list
              toolbar — the tap floor is the kit's.
              · "Give an award" is WHITE, the weight a finished game's own sheet gives the same button.
                Insights reads a season back to a coach; the lime fill made the report's one instrument
                its loudest mark. It cannot go: this is the only door for an award that is not for an
                event on the schedule (season's end, a tournament recorded ahead).
              · The line "N awards given this season across N award types" is GONE, and so is the
                narrowed form of it ("🏆 MVP: 3 given") — the counts live in the filter's list, the
                leaderboard's totals, and the Print link.
              · With fewer than two award types in use the filter self-hides, as the chips did, and
                Give sits alone at the right. */}
          <CoachListToolbar
            actions={players.length > 0 && (
              <button className={`${styles.btnSecondary} ${styles.tapFloor}`} onClick={() => { setEditingAward(null); setGiveOpen(true); }}>🏆 Give an award</button>
            )}
          >
            {/* A rosterless team gets a reason, not a blank player picker (WI-7). */}
            {players.length === 0 ? (
              <p className={styles.insightsBasis} style={{ margin: 0 }}>🏆 Add players to your roster first — then you can give awards.</p>
            ) : typeChips.length > 1 && (
              <MultiSelectDropdown
                label="Award"
                options={typeChips.map(c => ({ id: c.type.id, label: `${c.type.emoji ? `${c.type.emoji} ` : ''}${c.type.name}`, count: c.count }))}
                selected={selected}
                onChange={setSelectedTypeIds}
                restQuiet
              />
            )}
          </CoachListToolbar>

          {awards.length === 0 ? (
            <div className={styles.emptyState}>
              <Award size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              <p className={styles.emptyStateTitle}>No awards given yet</p>
              <p className={styles.emptyStateSub}>
                Hand out your first one right after a game wraps, or use the button above.
              </p>
            </div>
          ) : (
            <>
              <section style={{ marginBottom: '1.75rem' }}>
                <p className={styles.sectionKicker}>Leaderboard</p>
                {/* A TABLE, on the same frame as the history under it (table standard, 2026-09-16).
                    It was a stack of divs borrowing the Tags settings row — rank, a bold name with
                    the chips on a second line, a data-face total — and the one thing on this screen
                    still sitting on the paper once the frame painted the card. A reader compares
                    totals across rows (who has more), which is the standard's test for a table, not
                    a card list; as a table it takes the frame, the heading row, the compact density
                    and the figure twin for free, with no recipe of its own. */}
                {/* ⚠ NOT `sticky` (/review, 2026-09-24): the leaderboard FITS a phone (R1's first question), and
                    its first column is the RANK — a pinned "1, 2, 3" with the names swiped away would tie a figure
                    to no one. The scroller is only the safety net for an overflow, where its hint still shows; the
                    name may wrap (`insightsNameCell`) rather than widen the table past the frame. */}
                <CoachScrollX hint="Swipe for the totals" scrollerClassName={styles.insightsTableWrap}>
                  <table className={styles.insightsTable}>
                    <thead><tr><th className={styles.tdShrink}>#</th><th>Player</th><th>Awards</th><th className={styles.insightsNumHead}>Total</th></tr></thead>
                    <tbody>
                      {leaderboard.map((row, i) => (
                        <tr key={row.playerId}>
                          <td className={`${styles.tdShrink} ${styles.mutedInline}`}>{i + 1}</td>
                          <td className={styles.insightsNameCell}>{row.playerName}</td>
                          <td>
                            <span className={styles.lineupChips}>
                              {Array.from(row.byType.values()).map((t, ti) => (
                                <span key={ti} className={styles.lineupChip}>{t.type?.emoji ? `${t.type.emoji} ` : ''}{t.count}× {t.type?.name ?? 'Award'}</span>
                              ))}
                            </span>
                          </td>
                          <td className={styles.insightsNum}>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CoachScrollX>
              </section>

              <section>
                {/* Print N certificates sits at the heading's right, beside the rows it prints (phone plan
                    §14.13): the toolbar that carried it is now the filter's row, which has no room for it
                    at 390 once the filter is narrowed. Chunk D 3.4 — awards night, printed — offered only
                    for ONE chosen award type: "print every award this season" is a stack of mismatched
                    certificates, not a thing a coach wants. ⚠ Carries the year: the certificate names the
                    season it was won in, and that page reads it from the URL. */}
                <div className={styles.awardsHistoryHead}>
                  <p className={styles.sectionKicker}>Full history</p>
                  {printType && visibleAwards.length > 0 && (
                    <Link
                      href={`${base}/history/awards/certificate?typeId=${printType.id}`}
                      className={`${styles.linkBtnAccent} ${styles.awardsPrintLink}`}
                    >
                      <Printer size={13} aria-hidden /> Print {visibleAwards.length} certificate{visibleAwards.length === 1 ? '' : 's'}
                    </Link>
                  )}
                </div>
                {deleteError && <p className={styles.errorText}>{deleteError}</p>}
                {isPhone ? (
                  /* ⚠⚠ ON A PHONE, A TABLE THAT FITS (phone plan §14.13 · R8, owner 2026-09-25 — reversing
                     stage 6's R2c cards after seeing them built). Date · Player · Award, what the award was
                     for under it, and no note in the row: the note is read in the award's sheet. It fits
                     at 360 with nothing to swipe (R1's first question) because it chose its columns —
                     R2c's option B, the five columns swiped, kept each row's actions off to the right.
                     · THE ROW OPENS THE AWARD, and its last column is a CHEVRON — the 2026-09-03 ruling:
                       one chevron on every row, "this opens", opening what the row's tap opens. The
                       chevron is a real button named for its award (the 2026-09-01 rule: a clickable row
                       is mouse-only without one); the row's own tap is the bigger target. A row tap that
                       ends a text selection is a selection, not a door (the Club tab's rule).
                     · A NAME CLAIMS ITS WIDTH FIRST (`.awardsPlayerCell`): a long occasion ("Practice
                       review — written up") widened the Award column and wrapped every name in the table;
                       now the occasion wraps under its own award. */
                  /* It FITS (R1's first question), so the scroller is only the safety net for an overflow —
                     a very long name — where its hint still shows. Unpinned, as the leaderboard is. */
                  <CoachScrollX hint="Swipe for the award" scrollerClassName={styles.insightsTableWrap} wrapCells>
                    <table className={`${styles.insightsTable} ${styles.awardsHistoryPhone}`}>
                      <thead><tr><th className={styles.tdShrink}>Date</th><th>Player</th><th>Award</th><th aria-hidden /></tr></thead>
                      <tbody>
                        {visibleAwards.map(a => {
                          const awardText = awardTypeLabel(a.awardType, '—');
                          const forText = awardFor(a);
                          return (
                            <tr
                              key={a.id}
                              className={styles.rowTappable}
                              onClick={() => { if (window.getSelection()?.toString()) return; setOpenAwardId(a.id); }}
                            >
                              <td className={styles.tdShrink}>{shortDate(a)}</td>
                              <td className={styles.awardsPlayerCell}>{a.playerName}</td>
                              <td>{awardText}<span className={styles.listRowSub}>{forText}</span></td>
                              <td className={styles.awardsChevronCell}>
                                <button
                                  type="button"
                                  className={`${styles.linkBtn} ${styles.listRowToggle}`}
                                  aria-label={`Open ${a.playerName ?? 'this player'}’s ${a.awardType?.name ?? 'award'}`}
                                  onClick={e => { e.stopPropagation(); setOpenAwardId(a.id); }}
                                >
                                  <ChevronRight size={18} className={styles.listRowChevron} aria-hidden />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CoachScrollX>
                ) : (
                  /* The desktop and tablet keep their five columns, the note among them, and three icons. */
                  <CoachScrollX hint="Swipe for the note and the actions" scrollerClassName={styles.insightsTableWrap}>
                    <table className={styles.insightsTable}>
                      <thead><tr><th>Player</th><th>Award</th><th>For</th><th className={styles.tdShrink}>Date</th><th>Note</th><th aria-hidden /></tr></thead>
                      <tbody>
                        {visibleAwards.map(a => {
                          const awardText = awardTypeLabel(a.awardType, '—');
                          const forText = awardFor(a);
                          const certificateHref = `${base}/history/awards/certificate?awardId=${a.id}`;
                          return (
                          <tr key={a.id}>
                            <td>{a.playerName}</td>
                            <td>{awardText}</td>
                            <td className={styles.mutedInline}>{forText}</td>
                            <td className={styles.tdShrink}>{shortDate(a)}</td>
                            <td className={styles.mutedInline}>{a.note || '—'}</td>
                            <td>
                              {/* Two clicks from the history the coach already keeps (3.4). */}
                              <Link
                                title="Print certificate"
                                href={certificateHref}
                                style={{ color: 'var(--white-45)', padding: '0.2rem', display: 'inline-block' }}
                              >
                                <Printer size={13} aria-hidden />
                              </Link>
                              {/* Fix a mis-given award without a delete-and-redo (Awards One Tag
                                  Idiom Part A) — same live-instrument posture as Remove below. */}
                              <button
                                title="Edit"
                                disabled={busyId === a.id}
                                onClick={() => { setEditingAward(a); setGiveOpen(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--white-45)', padding: '0.2rem' }}
                              >
                                <Pencil size={13} />
                              </button>
                              {/* ⚠ Removing an award UNDOES a night that has happened. It is a live
                                  instrument, and the DELETE route resolves the ACTIVE year — so it
                                  cannot reach a closed season whatever this screen renders. */}
                              <button
                                title="Remove"
                                disabled={busyId === a.id}
                                onClick={() => { void handleDelete(a); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--white-45)', padding: '0.2rem' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CoachScrollX>
                )}
              </section>
            </>
          )}
        </>
      )}

      {giveOpen && (
        <GiveAwardModal
          orgSlug={orgSlug}
          teamId={teamId}
          players={players}
          awardTypes={awardTypes}
          // An event-linked award being edited shows its own event as a fixed "For:" line, same
          // as giving one from that event's own window; a general award (or a fresh give) leaves
          // this null so the tournament-label input shows instead. Which event an award is FOR is
          // never editable, so this is read-only context, not a field the form writes back.
          eventContext={editingAward?.eventId
            ? {
                id: editingAward.eventId,
                eventType: editingAward.eventType ?? null,
                label: `${editingAward.occasionLabel ?? 'This event'} — ${new Date(`${editingAward.awardedAt}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`,
              }
            : null}
          editing={editingAward}
          onClose={() => { setGiveOpen(false); setEditingAward(null); }}
          onChanged={() => { void load(); }}
        />
      )}

      {/* The award's sheet (a phone) — outside the loading branch like the Give window, so a quiet
          re-read after a save never unmounts it; keyed on the award, so another award starts fresh. */}
      {isPhone && openAward && (
        <AwardSheet
          key={openAward.id}
          orgSlug={orgSlug}
          teamId={teamId}
          award={openAward}
          awards={awards}
          awardTypes={awardTypes}
          players={players}
          certificateHref={`${base}/history/awards/certificate?awardId=${openAward.id}`}
          dateText={shortDate(openAward)}
          onClose={() => setOpenAwardId(null)}
          onSaved={reloadAwardsQuietly}
          onLibraryChanged={reloadQuietly}
          onRemove={handleDelete}
        />
      )}
    </>
  );
}
