'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Undo2, Redo2 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import PositionProfileEditor from '@/components/coaches/PositionProfileEditor';
import type { RepRosterPlayer, LineupSettings } from '@/lib/types';
import styles from './DepthChartBoard.module.css';

// The "Depth chart" view of the Roster page (P5 — Lineup Intelligence). One editable profile per
// player, mirroring the player-detail page's model exactly so the two surfaces write the same thing.
// Saved via the same per-player PATCH (server derives primary/secondary + the stored profile via
// buildLineupProfileWrite) — the board never introduces a new write path.
interface PlayerProfile {
  best: string[]; okay: string[]; never: string[];
  isPitcher: boolean; rank: number; maxInnings: string; // '' = no cap
  aSquad: boolean;
}
type Board = Record<string, PlayerProfile>;

interface ProgramYearMeta { year?: number; name?: string; lineupSettings?: LineupSettings | null }

function playerToProfile(p: RepRosterPlayer, pitcherPos: string | null): PlayerProfile {
  const prefs = playerPositionPrefs(p, pitcherPos);
  const pit = p.lineupProfile?.pitcher;
  return {
    best: prefs.preferred, okay: prefs.canPlay, never: prefs.never,
    isPitcher: !!pit, rank: pit?.rank ?? 1, maxInnings: pit?.maxInnings != null ? String(pit.maxInnings) : '',
    aSquad: p.lineupProfile?.aSquad ?? false,
  };
}

// Mirror the server's cap sanitization (normalizePitcher) so the client signature equals what the
// server actually stores — otherwise a value like '0' persists as 1 while the client still thinks it's
// dirty/clean based on '0', so it never reconciles until a full reload.
function sanitizeCap(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.min(99, Math.max(1, Math.round(n))) : null;
}

function profilePayload(pp: PlayerProfile, pitcherPos: string | null) {
  return {
    preferred: pp.best, canPlay: pp.okay, never: pp.never,
    pitcher: pitcherPos && pp.isPitcher ? { rank: pp.rank, maxInnings: sanitizeCap(pp.maxInnings) } : null,
    aSquad: pp.aSquad,
  };
}
const sigOf = (pp: PlayerProfile, pitcherPos: string | null) => JSON.stringify(profilePayload(pp, pitcherPos));
const cloneBoard = (b: Board): Board => JSON.parse(JSON.stringify(b));

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden';

export default function DepthChartBoard({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const pitcherPos = sportPack.pitcherPosition; // 'P' for diamond sports, null when the sport has no mound
  const fieldCols = pitcherPos ? sportPack.fieldPositions.filter(p => p !== pitcherPos) : sportPack.fieldPositions;
  const canEdit = !!assignment?.capabilities.rosterWrite; // same gate as the player page + the PATCH endpoint
  const canView = !!assignment && assignment.capabilities.roster !== 'off';
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [programYear, setProgramYear] = useState<ProgramYearMeta | null>(null);
  const [board, setBoard] = useState<Board>({});
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [openId, setOpenId] = useState<string | null>(null);
  const [hist, setHist] = useState({ u: 0, r: 0 }); // undo/redo stack sizes in STATE (never read refs during render)

  const boardRef = useRef<Board>({});
  const savedRef = useRef<Record<string, string>>({});   // last-persisted signature per player
  const dirtyRef = useRef<Set<string>>(new Set());
  const undoRef = useRef<Board[]>([]);
  const redoRef = useRef<Board[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {}); // always points at the latest flush (avoids a stale debounce)
  const cancelledRef = useRef(false); // set on unmount so a failed final flush can't reschedule forever
  useEffect(() => { boardRef.current = board; }, [board]);

  const load = useCallback(async () => {
    setFetching(true); setLoadError(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load the roster.');
      const active: RepRosterPlayer[] = (data.players ?? []).filter((p: RepRosterPlayer) => p.status === 'active');
      const initial: Board = {}; const saved: Record<string, string> = {};
      for (const p of active) { const pp = playerToProfile(p, pitcherPos); initial[p.id] = pp; saved[p.id] = sigOf(pp, pitcherPos); }
      setPlayers(active);
      setProgramYear(data.programYear ?? null);
      setBoard(initial); boardRef.current = initial; savedRef.current = saved;
      undoRef.current = []; redoRef.current = []; dirtyRef.current = new Set();
      setHist({ u: 0, r: 0 });
      setSaveState('idle');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load.');
    } finally { setFetching(false); }
  }, [orgSlug, teamId, pitcherPos]);

  useEffect(() => { if (!assignmentsLoading && canView) void load(); }, [assignmentsLoading, canView, load]);
  // On unmount (e.g. switching back to the List view), flush any pending debounced save so an edit
  // made in the last ~0.9s isn't lost. State updates after unmount are no-ops (React 18).
  useEffect(() => () => {
    cancelledRef.current = true; // block any reschedule from the final flush below
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirtyRef.current.size) flushRef.current(); // one best-effort save of pending edits; never re-loops
  }, []);

  const scheduleSave = useCallback(() => {
    if (cancelledRef.current) return; // unmounted — don't arm timers on a dead instance
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { flushRef.current(); }, 900);
  }, []); // fires the latest flush via the ref; flush itself reads refs, not closure state

  const flush = useCallback(async () => {
    if (!canEdit) return;
    const ids = [...dirtyRef.current];
    if (!ids.length) { setSaveState(s => (s === 'saving' ? 'saved' : s)); return; }
    setSaveState('saving');
    let anyError = false, forbidden = false;
    for (const id of ids) {
      const pp = boardRef.current[id];
      if (!pp) { dirtyRef.current.delete(id); continue; }
      const payload = profilePayload(pp, pitcherPos);
      const sig = JSON.stringify(payload);
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineupProfile: payload }),
        });
        if (!res.ok) {
          // 403 (no longer permitted) and 404 (player gone) can't be fixed by retrying — drop them so
          // the badge doesn't loop forever on "Retry". Anything else is treated as retryable.
          if (res.status === 403) { forbidden = true; dirtyRef.current.delete(id); }
          else if (res.status === 404) { dirtyRef.current.delete(id); }
          else anyError = true;
          continue;
        }
        // Race guard: only mark clean if this player hasn't changed since we captured the payload
        // (an edit made mid-save stays dirty and re-saves). Client stays authoritative — no re-sync.
        const cur = boardRef.current[id];
        if (cur && sigOf(cur, pitcherPos) === sig) { dirtyRef.current.delete(id); savedRef.current[id] = sig; }
      } catch { anyError = true; }
    }
    if (forbidden) setSaveState('forbidden');
    else if (anyError) setSaveState('error');
    else if (dirtyRef.current.size) { setSaveState('saving'); scheduleSave(); }
    else setSaveState('saved');
  }, [canEdit, orgSlug, teamId, pitcherPos, scheduleSave]);
  useEffect(() => { flushRef.current = () => { void flush(); }; }, [flush]);

  // Apply a mutation to one player. pushUndo=false for continuous inputs (the innings cap field) so
  // typing doesn't flood the undo history — undo is the mis-TAP safety net, not a keystroke log.
  const mutate = useCallback((id: string, updater: (p: PlayerProfile) => PlayerProfile, pushUndo = true) => {
    if (!canEdit) return;
    // boardRef is the SYNCHRONOUS source of truth (updated here + in applySnapshot/load), not the
    // post-render `board` state — so two mutations in one tick each see the prior one's result (the
    // undo snapshot and the mid-save race guard both read boardRef).
    const cur = boardRef.current;
    if (!cur[id]) return; // player no longer on the board (e.g. after a reload) — no-op
    if (pushUndo) {
      undoRef.current.push(cloneBoard(cur));
      if (undoRef.current.length > 50) undoRef.current.shift();
    }
    redoRef.current = []; // ANY new edit invalidates redo (including the innings-cap field, pushUndo=false)
    const nextP = updater(cur[id]);
    const next = { ...cur, [id]: nextP };
    boardRef.current = next;
    setBoard(next);
    if (savedRef.current[id] === sigOf(nextP, pitcherPos)) dirtyRef.current.delete(id); else dirtyRef.current.add(id);
    setHist({ u: undoRef.current.length, r: redoRef.current.length });
    scheduleSave();
  }, [canEdit, pitcherPos, scheduleSave]);

  const applySnapshot = useCallback((snap: Board) => {
    for (const id of Object.keys(snap)) {
      const sig = sigOf(snap[id], pitcherPos);
      if (savedRef.current[id] === sig) dirtyRef.current.delete(id); else dirtyRef.current.add(id);
    }
    setBoard(snap); boardRef.current = snap;
    setHist({ u: undoRef.current.length, r: redoRef.current.length });
    scheduleSave();
  }, [pitcherPos, scheduleSave]);

  const undo = useCallback(() => {
    if (!canEdit) return;
    const snap = undoRef.current.pop(); if (!snap) return;
    redoRef.current.push(cloneBoard(boardRef.current));
    applySnapshot(snap);
  }, [canEdit, applySnapshot]);
  const redo = useCallback(() => {
    if (!canEdit) return;
    const snap = redoRef.current.pop(); if (!snap) return;
    undoRef.current.push(cloneBoard(boardRef.current));
    applySnapshot(snap);
  }, [canEdit, applySnapshot]);

  // ── field cell cycle: unset → Best → Okay → Never → unset ──
  const cycleField = (id: string, code: string) => mutate(id, p => {
    const cur = p.best.includes(code) ? 'b' : p.okay.includes(code) ? 'o' : p.never.includes(code) ? 'n' : '';
    const next = cur === '' ? 'b' : cur === 'b' ? 'o' : cur === 'o' ? 'n' : '';
    const best = p.best.filter(c => c !== code);
    const okay = p.okay.filter(c => c !== code);
    const never = p.never.filter(c => c !== code);
    if (next === 'b') best.push(code); else if (next === 'o') okay.push(code); else if (next === 'n') never.push(code);
    return { ...p, best, okay, never };
  });
  // desktop pitcher chip cycle: not-a-pitcher → Ace(1) → #2 → … → #5 → not-a-pitcher
  const cyclePitcher = (id: string) => mutate(id, p => {
    if (!p.isPitcher) return { ...p, isPitcher: true, rank: 1 };
    if (p.rank >= 5) return { ...p, isPitcher: false };
    return { ...p, rank: p.rank + 1 };
  });
  const toggleASquad = (id: string) => mutate(id, p => ({ ...p, aSquad: !p.aSquad }));
  const rankLabel = (pp: PlayerProfile) => !pp.isPitcher ? '—' : pp.rank === 1 ? 'Ace' : `#${pp.rank}`;
  const stateOf = (pp: PlayerProfile, code: string) =>
    pp.best.includes(code) ? 'b' : pp.okay.includes(code) ? 'o' : pp.never.includes(code) ? 'n' : '';

  // ── caps summary from the season defaults ──
  const caps = programYear?.lineupSettings ?? null;
  const capBits: React.ReactNode[] = [];
  if (caps?.maxInningsPerPosition != null) capBits.push(<span key="r">Rotation <b>≤{caps.maxInningsPerPosition}</b> IP/pos</span>);
  if (caps?.pitcherMaxInningsDefault != null) capBits.push(<span key="p">Pitching <b>≤{caps.pitcherMaxInningsDefault}</b> IP</span>);
  if (caps?.minInningsPerPlayer != null) capBits.push(<span key="m">Min <b>{caps.minInningsPerPlayer}</b> IP/player</span>);

  // ── states ──
  if (assignmentsLoading || (fetching && canView)) return <p className={styles.readOnlyNote} style={{ padding: 24 }}>Loading…</p>;
  if (!assignment) return <div className={styles.empty}><p>You are not assigned to this team.</p></div>;
  if (!canView) return <div className={styles.empty}><p>You don’t have access to this team’s roster.</p></div>;
  if (loadError) return <div className={styles.empty}><p>{loadError}</p><button className={styles.editlink} onClick={() => void load()}>Try again</button></div>;

  const saveStatus = (
    <span className={styles.saveStat} aria-live="polite" aria-atomic="true">
      {saveState === 'saving' && <>Saving…</>}
      {saveState === 'saved' && <><span className={styles.chk}>✓</span> Saved</>}
      {saveState === 'error' && <>Couldn’t save · <button className={styles.saveRetry} onClick={() => void flush()}>Retry</button></>}
      {saveState === 'forbidden' && <>You can no longer edit this team.</>}
    </span>
  );
  const saveBar = canEdit ? (
    <div className={styles.saveBar}>
      <button className={styles.iconBtn} onClick={undo} disabled={!hist.u} title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
      <button className={styles.iconBtn} onClick={redo} disabled={!hist.r} title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
      {saveStatus}
      <Link href={`${base}/schedule`} className={styles.autofill}>Prepare a game lineup →</Link>
    </div>
  ) : (
    <p className={styles.readOnlyNote}>View only — ask the head coach to change positions, pitching, or A-squad.</p>
  );

  return (
    <div className={styles.wrap}>
      {/* season "Lineup rules" that frame the board */}
      <div className={styles.capsBar}>
        {capBits.length
          ? capBits.map((b, i) => <span key={i} style={{ display: 'inline-flex', gap: 10 }}>{i > 0 && <span className={styles.dot}>·</span>}{b}</span>)
          : <span className={styles.capsNone}>No lineup rules set</span>}
        <Link href={`${base}/settings#lineup-rules-title`} className={styles.editlink}>Edit in Settings →</Link>
      </div>

      {players.length === 0 ? (
        <section className={`${styles.card} ${styles.empty}`}>
          <p>No active players yet. <Link href={`${base}/roster`}>Add your roster →</Link> to build the depth chart.</p>
        </section>
      ) : (
        <>
          {/* ── Desktop / tablet: the grid ── */}
          <div className={styles.desktopGrid}>
            <section className={`${styles.card} ${styles.gridCard}`}>
              <div className={styles.legend}>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swB}`} />Best (ranked)</span>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swO}`} />Okay</span>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swN}`} />Never</span>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swX}`} />Not set</span>
                <span className={styles.tip}>Tap a cell to cycle · Best cells number in the order you pick them</span>
              </div>
              <div className={styles.gridScroll}>
                <table className={styles.table} style={{ minWidth: 150 + (pitcherPos ? 86 : 0) + 64 + fieldCols.length * 56 }}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.cPlayer}>Player</th>
                      {pitcherPos && <th scope="col" className={`${styles.cPitch} ${styles.colPitch}`} style={{ left: 150 }}>Pitcher</th>}
                      <th scope="col" className={`${styles.cASquad} ${styles.colASquad}`} style={{ left: pitcherPos ? 236 : 150 }}>A-squad</th>
                      {fieldCols.map(c => <th scope="col" key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => {
                      const pp = board[p.id]; if (!pp) return null;
                      return (
                        <tr key={p.id}>
                          <td className={styles.cPlayer}>
                            <span className={styles.pnum}>#{p.playerNumber || '—'}</span>
                            <Link href={`${base}/roster/${p.id}`} className={styles.pname}>{p.playerFirstName} {p.playerLastName}</Link>
                          </td>
                          {pitcherPos && (
                            <td className={styles.cPitch} style={{ left: 150 }}>
                              <span className={styles.pitch}>
                                <button type="button" className={`${styles.pchip}${pp.isPitcher ? '' : ' ' + styles.off}`} onClick={() => cyclePitcher(p.id)} disabled={!canEdit}
                                  aria-pressed={pp.isPitcher}
                                  aria-label={`${p.playerFirstName} pitching: ${pp.isPitcher ? rankLabel(pp) : 'not a pitcher'}.${canEdit ? ' Tap to change.' : ''}`}>{rankLabel(pp)}</button>
                                {pp.isPitcher && (
                                  <input className={styles.capInput} type="number" min={1} max={20} placeholder="cap" value={pp.maxInnings}
                                    disabled={!canEdit} aria-label={`Max innings per game for ${p.playerFirstName}`}
                                    onChange={e => mutate(p.id, x => ({ ...x, maxInnings: e.target.value }), false)} />
                                )}
                              </span>
                            </td>
                          )}
                          <td className={styles.cASquad} style={{ left: pitcherPos ? 236 : 150 }}>
                            <button type="button" className={`${styles.star}${pp.aSquad ? ' ' + styles.on : ''}`} onClick={() => toggleASquad(p.id)} disabled={!canEdit}
                              aria-pressed={pp.aSquad} title="Gold-medal starter"
                              aria-label={`${p.playerFirstName} A-squad: ${pp.aSquad ? 'yes' : 'no'}.${canEdit ? (pp.aSquad ? ' Tap to remove.' : ' Tap to add.') : ''}`}>★</button>
                          </td>
                          {fieldCols.map(code => {
                            const st = stateOf(pp, code);
                            const rank = st === 'b' ? pp.best.indexOf(code) + 1 : 0;
                            const word = st === 'b' ? 'Best ' + rank : st === 'o' ? 'Okay' : st === 'n' ? 'Never' : 'not set';
                            return (
                              <td key={code}>
                                <button type="button" className={`${styles.cellbtn}${st ? ' ' + styles[st] : ''}`} onClick={() => cycleField(p.id, code)} disabled={!canEdit}
                                  aria-label={`${p.playerFirstName} at ${code}: ${word}.${canEdit ? ' Tap to change.' : ''}`}>
                                  {st === 'b' ? rank : st === 'o' ? '✓' : st === 'n' ? '✕' : ''}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            {saveBar}
            <p className={styles.foot}>Edits here write the same profile as each player’s page — positions, pitching, and A-squad stay in sync. Saves automatically as you go.</p>
          </div>

          {/* ── Phone: per-player accordion ── */}
          <div className={styles.mobileAcc}>
            <div className={styles.acc}>
              {players.map(p => {
                const pp = board[p.id]; if (!pp) return null;
                const open = openId === p.id;
                return (
                  <div key={p.id} className={`${styles.pcardRow}${open ? ' ' + styles.open : ''}`}>
                    <button type="button" className={styles.pcardHead} onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open}>
                      <span className={styles.pnum}>#{p.playerNumber || '—'}</span>
                      <span className={styles.pname}>{p.playerFirstName} {p.playerLastName}</span>
                      <span className={styles.miniChips}>
                        {pp.best.map((c, i) => <span key={c} className={styles.miniChip}>{c} {i + 1}</span>)}
                        {pitcherPos && pp.isPitcher && <span className={styles.miniPit}>{rankLabel(pp)}{pp.maxInnings ? ` ≤${pp.maxInnings}` : ''}</span>}
                      </span>
                      {pp.aSquad && <span className={styles.miniStarHead} aria-hidden>★</span>}
                      <span className={styles.chev} aria-hidden>▶</span>
                    </button>
                    {open && (
                      <div className={styles.pcardBody}>
                        <PositionProfileEditor
                          positions={fieldCols}
                          value={{ best: pp.best, okay: pp.okay, never: pp.never }}
                          disabled={!canEdit}
                          onChange={next => mutate(p.id, x => ({ ...x, best: next.best, okay: next.okay, never: next.never }))}
                        />
                        {pitcherPos && (
                          <>
                            <div className={styles.grpLbl}>Pitching</div>
                            <div className={styles.pitchRow}>
                              <label className={styles.checkLabel}>
                                <input type="checkbox" checked={pp.isPitcher} disabled={!canEdit}
                                  onChange={e => mutate(p.id, x => ({ ...x, isPitcher: e.target.checked }))} />
                                <span>This player pitches</span>
                              </label>
                              {pp.isPitcher && (
                                <>
                                  <div className={styles.fieldMini}>
                                    <label htmlFor={`rk-${p.id}`}>Rank</label>
                                    <select id={`rk-${p.id}`} className={styles.rankSelect} value={pp.rank} disabled={!canEdit}
                                      onChange={e => mutate(p.id, x => ({ ...x, rank: Number(e.target.value) }))}>
                                      <option value={1}>1 — Ace</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                                    </select>
                                  </div>
                                  <div className={styles.fieldMini}>
                                    <label htmlFor={`cap-${p.id}`}>Max IP / game</label>
                                    <input id={`cap-${p.id}`} className={styles.capNum} type="number" min={1} max={20} placeholder="No limit" value={pp.maxInnings}
                                      disabled={!canEdit} onChange={e => mutate(p.id, x => ({ ...x, maxInnings: e.target.value }), false)} />
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        <div className={styles.aSquadRow}>
                          <div>
                            <div className={styles.lab}>A-squad</div>
                            <p className={styles.sub}>Gold-medal starter — protected in competitive games</p>
                          </div>
                          <button type="button" className={`${styles.miniStar}${pp.aSquad ? ' ' + styles.on : ''}`} onClick={() => toggleASquad(p.id)} disabled={!canEdit}
                            aria-pressed={pp.aSquad}
                            aria-label={`${p.playerFirstName} A-squad: ${pp.aSquad ? 'yes' : 'no'}.${canEdit ? (pp.aSquad ? ' Tap to remove.' : ' Tap to add.') : ''}`}>★</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {saveBar}
          </div>
        </>
      )}
    </div>
  );
}
