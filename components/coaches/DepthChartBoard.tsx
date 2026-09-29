'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Undo2, Redo2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useBackStep } from '@/components/coaches/useBackStep';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerPositionPrefs, positionStateOf, cyclePositionState } from '@/lib/lineup-profile';
import { hasRecordAccess } from '@/lib/coach-capabilities';
import HelpTooltip from '@/components/help/HelpTooltip';
import PositionProfileEditor from '@/components/coaches/PositionProfileEditor';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import type { RepRosterPlayer, LineupSettings } from '@/lib/types';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from './DepthChartBoard.module.css';

// The "Depth chart" view of the Roster page (P5 — Lineup Intelligence). One editable profile per
// player, mirroring the player-detail page's model exactly so the two surfaces write the same thing.
// Saved via the same per-player PATCH (server derives primary/secondary + the stored profile via
// buildLineupProfileWrite) — the board never introduces a new write path.
//
// Three states per field cell (owner, 2026-09-12): Best (ranked, numbered in tap order), Never, or
// BLANK — and blank means "fine anywhere they're not Never". The fourth "Okay" state is gone: it
// was defined with the same words as blank, was read as distinct only in Competitive mode, and
// nothing after Auto-fill ever showed it. A fill-in spot is a low-ranked Best now.
interface PlayerProfile {
  best: string[]; never: string[];
  isPitcher: boolean; rank: number; maxInnings: string; // '' = no cap
  aSquad: boolean;
}
type Board = Record<string, PlayerProfile>;

interface ProgramYearMeta { year?: number; name?: string; lineupSettings?: LineupSettings | null }

function playerToProfile(p: RepRosterPlayer, pitcherPos: string | null): PlayerProfile {
  const prefs = playerPositionPrefs(p, pitcherPos);
  const pit = p.lineupProfile?.pitcher;
  return {
    best: prefs.preferred, never: prefs.never,
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
    preferred: pp.best, never: pp.never,
    pitcher: pitcherPos && pp.isPitcher ? { rank: pp.rank, maxInnings: sanitizeCap(pp.maxInnings) } : null,
    aSquad: pp.aSquad,
  };
}
const sigOf = (pp: PlayerProfile, pitcherPos: string | null) => JSON.stringify(profilePayload(pp, pitcherPos));
const cloneBoard = (b: Board): Board => JSON.parse(JSON.stringify(b));

// 'dirty' = edits waiting for the debounce; 'saving' = a request really open (the pill's three-state rule).
// The desktop grid's three pinned columns — their widths, mirrored in the module's .cPlayer / .cPitch /
// .cASquad rules, and the sticky offsets that stack them. ONE place, so a width change cannot leave a
// pinned column overlapping or gapping its neighbour.
const PINNED = { player: 150, pitch: 150, aSquad: 80 } as const;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'forbidden';

export default function DepthChartBoard({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const pitcherPos = sportPack.pitcherPosition; // 'P' for diamond sports, null when the sport has no mound
  const fieldCols = pitcherPos ? sportPack.fieldPositions.filter(p => p !== pitcherPos) : sportPack.fieldPositions;
  const canEdit = !!assignment?.capabilities.rosterWrite; // same gate as the player page + the PATCH endpoint
  // A1 (2026-08-03): the depth chart is a view of the roster page, so it follows record access.
  const canView = !!assignment && hasRecordAccess(assignment.capabilities);
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

  // ── THE PLAYER SHEET (phone only — owner ruling D1, 2026-09-29) ──
  // On a phone a player no longer folds open inside the list: the row opens their editor as the
  // portal's full-screen sheet, with the back arrow to the list, Previous / Next at its foot (D2),
  // and the phone's own back gesture closing it. A FORM covers the nav (the drawer-layer ruling),
  // so the sheet registers with the overlay counter. Desktop and tablet keep the grid.
  const isPhone = useIsPhone();
  const sheetOpen = isPhone && openId !== null;
  useOverlayOpen(sheetOpen);
  useBackStep(sheetOpen, () => setOpenId(null));
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (openId) {
      lastOpenRef.current = openId;
      // Previous / Next change the player without closing: start the new one at its top, and land
      // a keyboard or screen-reader user in the sheet.
      sheetRef.current?.scrollTo({ top: 0 });
      sheetRef.current?.focus({ preventScroll: true });
      return;
    }
    // Closed: back on the row of the player last shown (after Next × 8, that is where the coach is).
    const id = lastOpenRef.current;
    lastOpenRef.current = null;
    const row = id ? document.querySelector<HTMLButtonElement>(`[data-depth-row="${id}"]`) : null;
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  }, [openId]);

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
  // ⚠ THE GUARD IS RESET ON MOUNT (owner, 2026-09-29 — "they don't seem to be saving"). It used to be
  // set only in the cleanup, which is right for a real unmount and fatal under React's development
  // double-mount: the first pass's cleanup set it, nothing ever cleared it, and `scheduleSave` then
  // refused every edit — the board looked edited and never sent a single save.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true; // block any reschedule from the final flush below
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current.size) flushRef.current(); // one best-effort save of pending edits; never re-loops
    };
  }, []);

  // A refresh, a closed tab or a pocketed phone must not eat the last second of edits (the save waits
  // ~0.9s for more taps): on visibility loss, best-effort keepalive saves go out for whatever is still
  // unsaved — the game-day console's pattern. The ordinary debounced save still runs if the page comes
  // back; the same body twice is harmless (the PATCH writes the whole profile).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || !canEdit) return;
      for (const id of dirtyRef.current) {
        const pp = boardRef.current[id];
        if (!pp) continue;
        try {
          void fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${id}`, {
            method: 'PATCH', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineupProfile: profilePayload(pp, pitcherPos) }),
          });
        } catch { /* best-effort only */ }
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [canEdit, orgSlug, teamId, pitcherPos]);

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
    else if (dirtyRef.current.size) { setSaveState('dirty'); scheduleSave(); }
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
    setSaveState(s => (s === 'saving' ? s : 'dirty'));
    scheduleSave();
  }, [canEdit, pitcherPos, scheduleSave]);

  const applySnapshot = useCallback((snap: Board) => {
    for (const id of Object.keys(snap)) {
      const sig = sigOf(snap[id], pitcherPos);
      if (savedRef.current[id] === sig) dirtyRef.current.delete(id); else dirtyRef.current.add(id);
    }
    setBoard(snap); boardRef.current = snap;
    setHist({ u: undoRef.current.length, r: redoRef.current.length });
    setSaveState(s => (s === 'saving' ? s : 'dirty'));
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

  // ── field cell cycle: blank → Best → Never → blank ──
  // The transition table itself lives once, in lib/lineup-profile.ts, shared with the player
  // page's picker — this just merges the {best, never} delta into the player's richer profile.
  const cycleField = (id: string, code: string) => mutate(id, p => ({ ...p, ...cyclePositionState(p, code) }));
  // Pitcher rank is a dropdown on the grid too (a field choosing one value is a dropdown — owner,
  // 2026-08-22; the phone accordion always was one). 0 = not a pitcher. The old chip cycled through
  // six states, so un-pitchering a #2 was four autosaved taps.
  const setPitcherRank = (id: string, rank: number) => mutate(id, p =>
    rank <= 0 ? { ...p, isPitcher: false } : { ...p, isPitcher: true, rank });
  const toggleASquad = (id: string) => mutate(id, p => ({ ...p, aSquad: !p.aSquad }));
  const rankWord = (rank: number) => rank === 1 ? 'Ace' : `#${rank}`;
  const rankLabel = (pp: PlayerProfile) => !pp.isPitcher ? '—' : rankWord(pp.rank);
  // 'b'/'n'/'' are this board's own short codes for its CSS classes + ARIA text — mapped from the
  // shared PositionState rather than re-derived, so there is one place deciding what a position IS.
  const stateOf = (pp: PlayerProfile, code: string) => {
    const s = positionStateOf(pp, code);
    return s === 'best' ? 'b' : s === 'never' ? 'n' : '';
  };

  // ── caps summary from the season defaults ──
  const caps = programYear?.lineupSettings ?? null;
  const capBits: React.ReactNode[] = [];
  if (caps?.maxInningsPerPosition != null) capBits.push(<span key="r">Rotation <b>≤{caps.maxInningsPerPosition}</b> IP/pos</span>);
  if (caps?.pitcherMaxInningsDefault != null) capBits.push(<span key="p">Pitching <b>≤{caps.pitcherMaxInningsDefault}</b> IP</span>);
  if (caps?.minInningsPerPlayer != null) capBits.push(<span key="m">Min <b>{caps.minInningsPerPlayer}</b> IP/player</span>);

  // ── states ──
  if (assignmentsLoading || (fetching && canView)) return <CoachLoading label="Loading the depth chart…" />;
  if (!assignment) return <div className={styles.empty}><p>You are not assigned to this team.</p></div>;
  if (!canView) return <div className={styles.empty}><p>You don’t have access to this team’s roster.</p></div>;
  if (loadError) return <div className={styles.empty}><p>{loadError}</p><button className={styles.editlink} onClick={() => void load()}>Try again</button></div>;

  // The autosave word is the portal's ONE pill (the transient-Saved ruling, 2026-09-20): at the
  // window's foot, above the phone bar — and over the player sheet, just above its docked foot (the
  // stylesheet raises it over any full-screen form). Only a failure persists. "No longer permitted"
  // is not a retryable failure, so it is a sentence where the coach is working instead.
  const forbiddenNote = saveState === 'forbidden'
    ? <p className={styles.readOnlyNote} role="alert">You can no longer edit this team.</p>
    : null;
  const saveBar = canEdit ? (
    <div className={styles.saveBar}>
      <button className={styles.iconBtn} onClick={undo} disabled={!hist.u} title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
      <button className={styles.iconBtn} onClick={redo} disabled={!hist.r} title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
      <Link href={`${base}/schedule`} className={styles.autofill}>Prepare a game lineup →</Link>
    </div>
  ) : (
    <p className={styles.readOnlyNote}>View only — ask the head coach to change positions, pitching, or A-squad.</p>
  );

  // The player the sheet shows, and their neighbours for Previous / Next (D2) — the roster's order.
  const sheetIdx = sheetOpen ? players.findIndex(x => x.id === openId) : -1;
  const sheetPlayer = sheetIdx >= 0 ? players[sheetIdx] : null;
  const sheetProfile = sheetPlayer ? board[sheetPlayer.id] : null;
  const nameOf = (x: RepRosterPlayer) => `${x.playerFirstName} ${x.playerLastName}`.trim();
  const sheet = sheetPlayer && sheetProfile ? {
    p: sheetPlayer, pp: sheetProfile, name: nameOf(sheetPlayer),
    prev: sheetIdx > 0 ? players[sheetIdx - 1] : null,
    next: sheetIdx < players.length - 1 ? players[sheetIdx + 1] : null,
  } : null;

  return (
    <div className={styles.wrap}>
      {/* season "Lineup rules" that frame the board */}
      <div className={styles.capsBar}>
        {capBits.length
          ? capBits.map((b, i) => <span key={i} style={{ display: 'inline-flex', gap: 10 }}>{i > 0 && <span className={styles.dot}>·</span>}{b}</span>)
          : <span className={styles.capsNone}>No lineup rules set</span>}
        {/* ⚠ `?section=`, not a `#hash`. Settings groups are collapsed by default now — a hash
            scrolls to a shut card and leaves the coach to guess which one to open, whereas the
            query param opens it, scrolls to it and flashes it once. */}
        <Link href={`${base}/settings?section=lineup-rules`} className={styles.editlink}>Edit in Settings →</Link>
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
              {/* Two swatches and a sentence — blank is not a choice a coach makes, so it gets no
                  box (it used to sit in this row as a fourth "Not set" swatch). The ★ line says
                  WHEN A-squad matters; the column header repeats it as a tooltip. */}
              <div className={styles.legend}>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swB}`} />Best (ranked)</span>
                <span className={styles.swatch}><span className={`${styles.sw} ${styles.swN}`} />Never</span>
                <span className={styles.swatch}>Blank = fine anywhere they’re not Never</span>
                <span className={styles.swatch}><span className={styles.legendStar} aria-hidden>★</span>A-squad — gold-medal starter, kept off the bench in Competitive games</span>
                <span className={styles.tip}>Tap a cell to cycle · Best cells number in the order you pick them · re-order on the player’s page</span>
              </div>
              {/* CoachScrollX owns the scroller AND its swipe hint together (Chunk A rule) — this
                  was the portal's last bare sideways scroller (f9-2 remainder, Chunk E WI-4). The
                  board keeps its own 3-column sticky implementation (Player/Pitcher/A-squad pin
                  against the scroller CoachScrollX renders); frame=false — the card already
                  draws the frame. */}
              <CoachScrollX hint="swipe for more positions" frame={false} className={styles.gridScrollWrap} scrollerClassName={styles.gridScroller}>
                <table className={styles.table} style={{ minWidth: PINNED.player + (pitcherPos ? PINNED.pitch : 0) + PINNED.aSquad + fieldCols.length * 56 }}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.cPlayer}>Player</th>
                      {pitcherPos && <th scope="col" className={`${styles.cPitch} ${styles.colPitch}`} style={{ left: PINNED.player }}>Pitcher</th>}
                      <th scope="col" className={`${styles.cASquad} ${styles.colASquad}`} style={{ left: PINNED.player + (pitcherPos ? PINNED.pitch : 0) }}>
                        <span className={styles.colASquadInner}>A-squad
                          <HelpTooltip title="A-squad" body="A gold-medal starter. In Competitive games Auto-fill gives A-squad players their Best positions and, with the A-squad dial set to prioritized, keeps them off the bench. It does nothing in Balanced or Development games." />
                        </span>
                      </th>
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
                            <td className={styles.cPitch} style={{ left: PINNED.player }}>
                              <span className={styles.pitch}>
                                <select className={`${styles.pchip}${pp.isPitcher ? '' : ' ' + styles.off}`} value={pp.isPitcher ? pp.rank : 0} disabled={!canEdit}
                                  aria-label={`${p.playerFirstName} pitching rank: ${pp.isPitcher ? rankLabel(pp) : 'not a pitcher'}`}
                                  onChange={e => setPitcherRank(p.id, Number(e.target.value))}>
                                  <option value={0}>—</option>
                                  {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{rankWord(r)}</option>)}
                                </select>
                                {pp.isPitcher && (
                                  <span className={styles.capUnit}>
                                    <input className={styles.capInput} type="number" min={1} max={20} placeholder="no cap" value={pp.maxInnings}
                                      disabled={!canEdit} aria-label={`Max innings per game for ${p.playerFirstName}`}
                                      onChange={e => mutate(p.id, x => ({ ...x, maxInnings: e.target.value }), false)} />
                                    <span aria-hidden>IP</span>
                                  </span>
                                )}
                              </span>
                            </td>
                          )}
                          <td className={styles.cASquad} style={{ left: PINNED.player + (pitcherPos ? PINNED.pitch : 0) }}>
                            <button type="button" className={`${styles.star}${pp.aSquad ? ' ' + styles.on : ''}`} onClick={() => toggleASquad(p.id)} disabled={!canEdit}
                              aria-pressed={pp.aSquad} title="Gold-medal starter"
                              aria-label={`${p.playerFirstName} A-squad: ${pp.aSquad ? 'yes' : 'no'}.${canEdit ? (pp.aSquad ? ' Tap to remove.' : ' Tap to add.') : ''}`}>★</button>
                          </td>
                          {fieldCols.map(code => {
                            const st = stateOf(pp, code);
                            const rank = st === 'b' ? pp.best.indexOf(code) + 1 : 0;
                            const word = st === 'b' ? 'Best ' + rank : st === 'n' ? 'Never' : 'blank — fine';
                            return (
                              <td key={code}>
                                <button type="button" className={`${styles.cellbtn}${st ? ' ' + styles[st] : ''}`} onClick={() => cycleField(p.id, code)} disabled={!canEdit}
                                  aria-label={`${p.playerFirstName} at ${code}: ${word}.${canEdit ? ' Tap to change.' : ''}`}>
                                  {st === 'b' ? rank : st === 'n' ? '✕' : ''}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CoachScrollX>
            </section>
            {saveBar}
            {forbiddenNote}
            {/* What Auto-fill will DO with the board — the sentence a coach needs before building
                their first lineup, and the same one the Auto-fill mode picker and help now carry. */}
            <p className={styles.footNote}><strong>What Auto-fill does with this:</strong> it never places a player at a Never. Your Best ranks matter most in Competitive games; Balanced rotates anyone rated Best; Development rotates everyone.</p>
            <p className={styles.foot}>Saves automatically as you go — Undo and Redo above if you mis-tap.</p>
          </div>

          {/* ── Phone: the players as ONE framed list; a row opens the player's sheet (D1) ── */}
          <div className={styles.mobileAcc}>
            <div className={styles.acc}>
              {players.map(p => {
                const pp = board[p.id]; if (!pp) return null;
                return (
                  <div key={p.id} className={styles.pcardRow}>
                    <button type="button" className={styles.pcardHead} data-depth-row={p.id} aria-haspopup="dialog"
                      onClick={() => setOpenId(p.id)}>
                      <span className={styles.pnum}>#{p.playerNumber || '—'}</span>
                      <span className={styles.pname}>{p.playerFirstName} {p.playerLastName}</span>
                      <span className={styles.miniChips}>
                        {/* The Best positions in priority order — the SEQUENCE is the order ("C CF 2B"), so no rank
                            number on a chip (owner, 2026-09-29). The desktop grid keeps its numbers: its
                            columns are the positions in a fixed order. */}
                        {pp.best.map(c => <span key={c} className={styles.miniChip}>{c}</span>)}
                        {pitcherPos && pp.isPitcher && <span className={styles.miniPit}>{rankLabel(pp)}{pp.maxInnings ? ` ≤${pp.maxInnings}` : ''}</span>}
                      </span>
                      {pp.aSquad && <span className={styles.miniStarHead} aria-hidden>★</span>}
                      <span className={styles.chev} aria-hidden><ChevronRight size={18} /></span>
                    </button>
                  </div>
                );
              })}
            </div>
            {saveBar}
            {forbiddenNote}
          </div>
        </>
      )}
      {canEdit && players.length > 0 && (
        <SaveStatusPill
          saving={saveState === 'saving'}
          dirty={saveState === 'dirty'}
          error={saveState === 'error' ? 'Couldn’t save' : null}
          onRetry={() => void flush()}
        />
      )}
      {sheet && (
          <div className={coach.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) setOpenId(null); }}>
            <div ref={sheetRef} className={coach.modal} role="dialog" aria-modal="true" aria-label={`${sheet.name}, depth chart`} tabIndex={-1}>
              <CoachModalHeader title={sheet.name} subtitle={`#${sheet.p.playerNumber || '—'} · Depth chart`} onClose={() => setOpenId(null)} closeAriaLabel="Back to the depth chart" />
              <div className={styles.sheetBody}>
                <PositionProfileEditor
                  positions={fieldCols}
                  value={{ best: sheet.pp.best, never: sheet.pp.never }}
                  disabled={!canEdit}
                  menuCoversNav
                  onChange={nextValue => mutate(sheet.p.id, x => ({ ...x, best: nextValue.best, never: nextValue.never }))}
                />
                {pitcherPos && (
                  <>
                    <div className={styles.grpLbl}>Pitching</div>
                    <div className={styles.pitchRow}>
                      <label className={styles.checkLabel}>
                        <input type="checkbox" checked={sheet.pp.isPitcher} disabled={!canEdit}
                          onChange={e => mutate(sheet.p.id, x => ({ ...x, isPitcher: e.target.checked }))} />
                        <span>This player pitches</span>
                      </label>
                      {sheet.pp.isPitcher && (
                        <>
                          <div className={styles.fieldMini}>
                            <label htmlFor={`rk-${sheet.p.id}`}>Rank</label>
                            <select id={`rk-${sheet.p.id}`} className={styles.rankSelect} value={sheet.pp.rank} disabled={!canEdit}
                              onChange={e => mutate(sheet.p.id, x => ({ ...x, rank: Number(e.target.value) }))}>
                              <option value={1}>1 — Ace</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                            </select>
                          </div>
                          <div className={styles.fieldMini}>
                            <label htmlFor={`cap-${sheet.p.id}`}>Max IP / game</label>
                            <input id={`cap-${sheet.p.id}`} className={styles.capNum} type="number" min={1} max={20} placeholder="No cap" value={sheet.pp.maxInnings}
                              disabled={!canEdit} onChange={e => mutate(sheet.p.id, x => ({ ...x, maxInnings: e.target.value }), false)} />
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
                  <button type="button" className={`${styles.miniStar}${sheet.pp.aSquad ? ' ' + styles.on : ''}`} onClick={() => toggleASquad(sheet.p.id)} disabled={!canEdit}
                    aria-pressed={sheet.pp.aSquad}
                    aria-label={`${sheet.p.playerFirstName} A-squad: ${sheet.pp.aSquad ? 'yes' : 'no'}.${canEdit ? (sheet.pp.aSquad ? ' Tap to remove.' : ' Tap to add.') : ''}`}>★</button>
                </div>
                {!canEdit && <p className={styles.readOnlyNote}>View only — ask the head coach to change positions, pitching, or A-squad.</p>}
                {/* Saving is quiet here — only a failure speaks, and it speaks HERE: the list's save
                    bar is behind the sheet (the transient-Saved ruling: only an error persists). */}
                {forbiddenNote}
              </div>
              {(sheet.prev || sheet.next) && (
                <div className={`${coach.modalFooter} ${styles.sheetFoot}`}>
                  {sheet.prev && (
                    <button type="button" className={`${coach.btnSecondary} ${styles.sheetStep}`} onClick={() => setOpenId(sheet.prev?.id ?? null)}
                      aria-label={`Previous player, ${nameOf(sheet.prev)}`}>
                      <ChevronLeft size={18} aria-hidden />
                      <span className={styles.sheetStepText}>{nameOf(sheet.prev)}</span>
                    </button>
                  )}
                  {sheet.next && (
                    <button type="button" className={`${coach.btnSecondary} ${styles.sheetStep} ${styles.sheetStepNext}`} onClick={() => setOpenId(sheet.next?.id ?? null)}
                      aria-label={`Next player, ${nameOf(sheet.next)}`}>
                      <span className={styles.sheetStepText}>{nameOf(sheet.next)}</span>
                      <ChevronRight size={18} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
