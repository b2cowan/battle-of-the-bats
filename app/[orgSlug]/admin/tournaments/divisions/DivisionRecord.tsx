'use client';
/**
 * A DIVISION'S RECORD — Tournament admin redesign Stage 5 (E4, ask A50 record A; A52; F28, F88), built to hub v45.
 * The kit's record window (Stage 2's team record, Stage 4's event record): full screen with ← on a phone, a window at
 * a desk. It READS first; the head's pencil turns the whole division into its form, which saves as you go (the
 * floating pill), and ✓ returns to reading (the 2026-10-01 standard, which Q 3.1's autosave meets).
 *
 *   Registration        its teams ("6 of 6 · full" — good news, never red), its waitlist, open or closed in words with
 *                       the door to Teams, where registration opens and closes (J1-040)
 *   Pools               its pools, and who picks them
 *   Its own settings    fee, game length, tie-breakers, contact — its own, or "The event's"
 *   Delete              ends the body, asks ONCE with what goes (the counts the list read), never a second round
 *   foot                the divisions before and after it, named
 *
 * The same window CREATES a division (Add division): it asks, with Cancel. Mistakes sit under their field — no browser
 * alert box anywhere — and a failed save is the pill's "Couldn't save · Retry". A completed event's record reads only.
 * An Exhibition's division never speaks of playoff seeding and saves no playoff setting (F88).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordDelete, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import TieBreakerEditor from '@/components/admin/TieBreakerEditor';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { DIVISION_WORDS as W, deleteQuestion, teamsFigure, type DivisionCounts } from '@/lib/division-words';
import { boardMoney, breakerPhrase } from '@/lib/tournament-board-words';
import { formatStoredDate } from '@/lib/timezone';
import { clampRunDiffCap, normalizeTieBreakers, type TieBreaker } from '@/lib/tie-breakers';
import type { Division, DivisionSettings, TournamentSettings } from '@/lib/types';
import styles from './DivisionRecord.module.css';

export type DivisionRow = Division & { counts?: DivisionCounts };

export type DivisionMember = { id: string; email: string; displayName: string | null; title: string | null; role: string };

type Form = {
  name: string;
  minAge: string;
  maxAge: string;
  capacity: string;
  usePools: boolean;
  poolCount: string;
  poolNames: string[];
  selfSelect: boolean;
  contactMemberId: string;
  ownFee: boolean;
  depositAmount: string;
  depositDueDate: string;
  totalFeeAmount: string;
  totalFeeDueDate: string;
  ownTiming: boolean;
  gameMinutes: string;
  bufferMinutes: string;
  ownTieBreakers: boolean;
  tieBreakers: TieBreaker[];
  runDiffCap: string;
};

const num = (v: number | null | undefined) => (v == null ? '' : String(v));
const poolLetter = (i: number) => String.fromCharCode(65 + i);
const WHOLE = /^\d+$/;

function formOf(d: Division | null, eventBreakers: TieBreaker[]): Form {
  const pools = d?.poolCount ?? 0;
  const names = (d?.poolNames ?? '').split(',').map(n => n.trim());
  const hasOwnFee = d != null && (d.totalFeeAmount != null || d.depositAmount != null);
  const hasOwnTiming = typeof d?.settings?.game_duration_minutes === 'number' || typeof d?.settings?.buffer_minutes === 'number';
  const ownBreakers = Array.isArray(d?.playoffConfig?.tieBreakers) && d!.playoffConfig!.tieBreakers!.length > 0;
  return {
    name: d?.name ?? '',
    minAge: num(d?.minAge),
    maxAge: num(d?.maxAge),
    capacity: d?.capacity ? String(d.capacity) : '',
    usePools: pools >= 2,
    poolCount: String(pools >= 2 ? pools : 2),
    poolNames: Array.from({ length: Math.max(pools, 2) }, (_, i) => names[i] ?? ''),
    selfSelect: Boolean(d?.requiresPoolSelection),
    contactMemberId: d?.contactMemberId ?? '',
    ownFee: hasOwnFee,
    depositAmount: num(d?.depositAmount),
    depositDueDate: d?.depositDueDate ?? '',
    totalFeeAmount: num(d?.totalFeeAmount),
    totalFeeDueDate: d?.totalFeeDueDate ?? '',
    ownTiming: hasOwnTiming,
    gameMinutes: num(d?.settings?.game_duration_minutes),
    bufferMinutes: num(d?.settings?.buffer_minutes),
    ownTieBreakers: ownBreakers,
    tieBreakers: ownBreakers ? normalizeTieBreakers(d!.playoffConfig!.tieBreakers) : [...eventBreakers],
    runDiffCap: typeof d?.playoffConfig?.maxRunDiffPerGame === 'number' && d.playoffConfig.maxRunDiffPerGame > 0
      ? String(d.playoffConfig.maxRunDiffPerGame) : '',
  };
}

/** The mistake that holds a save, and the field it sits under. */
function mistakeOf(f: Form): { field: 'name' | 'ages' | 'capacity'; text: string } | null {
  if (!f.name.trim()) return { field: 'name', text: W.nameHeld };
  const min = f.minAge.trim();
  const max = f.maxAge.trim();
  if ((min && !WHOLE.test(min)) || (max && !WHOLE.test(max))) return { field: 'ages', text: W.agesWhole };
  if (min && max && Number(min) > Number(max)) return { field: 'ages', text: W.agesOrder };
  if (f.capacity.trim() && !WHOLE.test(f.capacity.trim())) return { field: 'capacity', text: W.capacityWhole };
  return null;
}

export type Scopes = {
  fee: TournamentSettings['fee_scope'] | null;
  timing: TournamentSettings['game_timing_scope'] | null;
  tieBreakers: TournamentSettings['tie_breaker_scope'] | null;
};

/** What the division route takes — the old window's payload, with "Use the event's" saying so (null) explicitly. */
function payloadOf(f: Form, d: Division | null, ctx: { tournamentId: string; order: number; scopes: Scopes; exhibition: boolean }) {
  const pools = f.usePools ? Math.min(10, Math.max(2, Number(f.poolCount) || 2)) : 0;
  const feeOwn = ctx.scopes.fee === 'per_division' || f.ownFee;
  const timingOwn = ctx.scopes.timing === 'per_division' || f.ownTiming;
  const breakersOwn = ctx.scopes.tieBreakers === 'per_division' || f.ownTieBreakers;
  const settings: DivisionSettings = { ...(d?.settings ?? {}) };
  delete settings.game_duration_minutes;
  delete settings.buffer_minutes;
  if (ctx.scopes.timing !== 'tournament' && timingOwn) {
    const gd = parseInt(f.gameMinutes, 10);
    const buf = parseInt(f.bufferMinutes, 10);
    if (!Number.isNaN(gd) && gd > 0) settings.game_duration_minutes = gd;
    if (!Number.isNaN(buf) && buf >= 0) settings.buffer_minutes = buf;
  }
  // An Exhibition has no playoffs (F88): its division saves the tie-breakers and the cap only — never a playoff setting.
  const playoffDefaults = ctx.exhibition ? {} : { type: 'single', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 4 };
  const playoffConfig = {
    ...(d ? {} : playoffDefaults),
    // null = the event's order (resolveTieBreakers falls back to it); an explicit null clears a past override.
    tieBreakers: ctx.scopes.tieBreakers !== 'tournament' && breakersOwn ? normalizeTieBreakers(f.tieBreakers) : null,
    maxRunDiffPerGame: ctx.scopes.tieBreakers !== 'tournament' && breakersOwn ? clampRunDiffCap(f.runDiffCap) : null,
  };
  const money = (v: string) => (v.trim() && Number(v) >= 0 ? Number(v) : null);
  const feeShown = ctx.scopes.fee !== 'tournament' && ctx.scopes.fee !== 'free';
  return {
    tournamentId: ctx.tournamentId,
    name: f.name.trim(),
    minAge: f.minAge.trim() ? Number(f.minAge) : null,
    maxAge: f.maxAge.trim() ? Number(f.maxAge) : null,
    order: ctx.order,
    contactMemberId: f.contactMemberId || null,
    capacity: f.capacity.trim() ? Number(f.capacity) : null,
    poolCount: pools,
    poolNames: pools ? f.poolNames.slice(0, pools).map((n, i) => n.replace(/,/g, ' ').trim() || poolLetter(i)).join(',') : undefined,
    requiresPoolSelection: pools ? f.selfSelect : false,
    playoffConfig,
    // Where the card shows the fee: its own, or none (the event's) — unticking "Its own fee" clears it. Where it doesn't
    // (one fee for the event, or none tracked), what the division holds is left as it is.
    depositAmount: !feeShown ? d?.depositAmount ?? null : feeOwn ? money(f.depositAmount) : null,
    depositDueDate: !feeShown ? d?.depositDueDate ?? null : feeOwn ? f.depositDueDate || null : null,
    totalFeeAmount: !feeShown ? d?.totalFeeAmount ?? null : feeOwn ? money(f.totalFeeAmount) : null,
    totalFeeDueDate: !feeShown ? d?.totalFeeDueDate ?? null : feeOwn ? f.totalFeeDueDate || null : null,
    settings,
  };
}

async function post(url: string, body: unknown, fallback: string, signal?: AbortSignal) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const json = await res.json().catch(() => null) as { error?: string; counts?: DivisionCounts; gameCount?: number; scoredGameCount?: number; teamCount?: number } | null;
  return { ok: res.ok, status: res.status, json, fallback };
}

export default function DivisionRecord({
  division, base, orgSlug, tournament, members, canWrite, order, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add division (the same window, creating). */
  division: DivisionRow | null;
  /** `/{org}/admin/tournaments` */
  base: string;
  orgSlug: string;
  tournament: { id: string; settings: TournamentSettings | undefined; sport: string | null; exhibition: boolean };
  members: DivisionMember[];
  /** Not a completed event, and this member may change divisions. */
  canWrite: boolean;
  /** Its place in the list (a new one goes last). */
  order: number;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** Re-reads the list (after a save, a create, a delete). */
  onChanged: () => Promise<void>;
}) {
  const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const settings = tournament.settings;
  const scopes: Scopes = {
    fee: settings?.fee_scope ?? null,
    timing: settings?.game_timing_scope ?? null,
    tieBreakers: settings?.tie_breaker_scope ?? null,
  };
  const eventBreakers = normalizeTieBreakers(settings?.tie_breakers);
  const eventMinutes = settings?.game_duration_minutes ?? 90;
  const eventBuffer = settings?.buffer_minutes ?? 15;
  const creating = division === null;

  // ── The form: the whole division, read first, edited whole (the pencil) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState(division?.id ?? 'new');
  const [serverSig, setServerSig] = useState(() => JSON.stringify(formOf(division, eventBreakers)));
  const [form, setForm] = useState<Form>(() => formOf(division, eventBreakers));
  const [shownMistake, setShownMistake] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const formRef = useRef(form);
  const formForRef = useRef(formFor);
  // The division and the event's scopes as they are NOW (a re-read after a save), for the save that runs next.
  const divisionRef = useRef(division);
  const scopesRef = useRef(scopes);
  useEffect(() => { formRef.current = form; formForRef.current = formFor; divisionRef.current = division; scopesRef.current = scopes; });
  const editing = !creating && canWrite && editingId === division?.id;
  const changed = useRef(false);

  const mistake = mistakeOf(form);
  const sig = JSON.stringify(form);
  /** The form as the server last took it — a flush with nothing new sends nothing (/review 2026-10-10). A re-read of the
   *  division (its server copy, below) is what the server holds. */
  const savedSigRef = useRef(sig);
  useEffect(() => { savedSigRef.current = serverSig; }, [serverSig]);

  /** ONE save at a time (the record lesson): the autosave and a flush queue behind each other. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback((signal?: AbortSignal) => {
    const id = division?.id;
    const run = chain.current.catch(() => {}).then(async () => {
      if (!id || formForRef.current !== id) return;
      const f = formRef.current;
      if (mistakeOf(f)) return;
      const fSig = JSON.stringify(f);
      if (fSig === savedSigRef.current) return;
      const d = divisionRef.current;
      const r = await post(`/api/admin/divisions${orgQuery}`, {
        action: 'update', id,
        data: payloadOf(f, d, { tournamentId: tournament.id, order: d?.order ?? order, scopes: scopesRef.current, exhibition: tournament.exhibition }),
      }, W.saveFailed, signal);
      if (!r.ok) throw new Error(r.json?.error && !/[_A-Z]{6,}/.test(r.json.error) ? r.json.error : W.saveFailed);
      savedSigRef.current = fSig;
      changed.current = true;
      setLeaveError('');
    });
    chain.current = run;
    return run;
  }, [division?.id, orgQuery, tournament.id, tournament.exhibition, order]);
  const writeSig = useCallback((signal: AbortSignal) => write(signal), [write]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: editing, loading: false, sig, blocked: mistake?.text ?? null, write: writeSig, failText: W.saveFailed,
  });

  // Stepped to another division, or this one was re-read with nothing unsaved: start from the server.
  const incoming = JSON.stringify(formOf(division, eventBreakers));
  if ((division?.id ?? 'new') !== formFor || (incoming !== serverSig && !dirty && !saving && !creating)) {
    if ((division?.id ?? 'new') !== formFor) setEditingId(null);
    setFormFor(division?.id ?? 'new');
    setServerSig(incoming);
    setForm(formOf(division, eventBreakers));
    setShownMistake(false);
    setLeaveError('');
    settle();
  }
  const set = (patch: Partial<Form>) => { setForm(f => ({ ...f, ...patch })); setLeaveError(''); if (!creating) touch(); };

  /** Leaving (✕, ←, Previous, Next) or ✓ sends what is unsaved first. A mistake typed and not fixed: leaving drops it
   *  (every good state before it is already saved); ✓ says it under its field. */
  const flushThen = async (go: () => void, finishing = false) => {
    if (!editing) { go(); return; }
    if (mistake) {
      if (finishing) { setShownMistake(true); return; }
      await chain.current.catch(() => {});
      settle();
      go();
      return;
    }
    try {
      await write();
      settle();
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : W.saveFailed);
      return;
    }
    go();
  };
  const leave = (go: () => void) => void flushThen(async () => {
    if (changed.current) { changed.current = false; await onChanged(); }
    go();
  });
  const toggleEdit = () => {
    if (!editing) { setEditingId(division!.id); return; }
    void flushThen(async () => {
      setEditingId(null);
      if (changed.current) { changed.current = false; await onChanged(); }
    }, true);
  };

  // ── Add division: the same window, asking ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy) return;
    if (mistake) { setShownMistake(true); return; }
    setBusy(true);
    setCreateError('');
    try {
      const r = await post(`/api/admin/divisions${orgQuery}`, {
        action: 'save',
        data: payloadOf(form, null, { tournamentId: tournament.id, order, scopes, exhibition: tournament.exhibition }),
      }, W.saveFailed);
      if (!r.ok) throw new Error(r.json?.error && !/[_A-Z]{6,}/.test(r.json.error) ? r.json.error : W.saveFailed);
      await onChanged();
      onClose();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : W.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  // ── Delete: asked ONCE, with what goes ──
  const [asking, setAsking] = useState(false);
  const [askCounts, setAskCounts] = useState<DivisionCounts | null>(null);
  const [askError, setAskError] = useState('');
  const counts: DivisionCounts = askCounts ?? division?.counts ?? { games: 0, scoredGames: 0, teams: 0, waitlist: 0 };
  async function doDelete() {
    if (!division) return;
    setBusy(true);
    setAskError('');
    try {
      // A save in flight finishes first: an update landing after the delete would fail on a division that is gone.
      await chain.current.catch(() => {});
      const known = Boolean(askCounts ?? division.counts);
      const r = await post(`/api/admin/divisions${orgQuery}`, known
        ? { action: 'delete', id: division.id, force: true, expected: { games: counts.games, scoredGames: counts.scoredGames, teams: counts.teams } }
        : { action: 'delete', id: division.id }, 'Couldn’t delete it. Nothing was changed.');
      if (r.status === 409 && (r.json?.counts || r.json?.error === 'DIVISION_HAS_GAMES')) {
        // It changed since the question was asked (a team registered): ask again with what it holds now.
        setAskCounts(r.json?.counts ?? {
          games: r.json?.gameCount ?? 0, scoredGames: r.json?.scoredGameCount ?? 0, teams: r.json?.teamCount ?? 0, waitlist: 0,
        });
        setAskError('It changed since you opened it. This is what it holds now.');
        return;
      }
      if (!r.ok) throw new Error(r.json?.error && !/[_A-Z]{6,}/.test(r.json.error) ? r.json.error : 'Couldn’t delete it. Nothing was changed.');
      setAsking(false);
      await onChanged();
      onClose();
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Couldn’t delete it. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  // ── Reading ──
  const d = division;
  const memberName = (id: string | null | undefined) => {
    const m = members.find(x => x.id === id);
    return m ? (m.displayName ?? m.email) : null;
  };
  const feeLine = (() => {
    if (!d) return '';
    if (d.totalFeeAmount != null || d.depositAmount != null) {
      const parts = [
        d.totalFeeAmount != null ? boardMoney(d.totalFeeAmount) : null,
        d.depositAmount != null && d.depositAmount > 0
          ? `${boardMoney(d.depositAmount)} deposit${d.depositDueDate ? ` by ${formatStoredDate(d.depositDueDate, { withYear: false })}` : ''}`
          : null,
      ].filter(Boolean);
      return parts.join(' · ');
    }
    return scopes.fee === 'per_division' ? W.noFee : W.theEvents;
  })();
  const lengthLine = d && typeof d.settings?.game_duration_minutes === 'number'
    ? W.ownLength(d.settings.game_duration_minutes) : W.theEventsLength(eventMinutes);
  const breakersLine = d && scopes.tieBreakers !== 'tournament' && Array.isArray(d.playoffConfig?.tieBreakers) && d.playoffConfig!.tieBreakers!.length
    ? breakerPhrase(normalizeTieBreakers(d.playoffConfig!.tieBreakers), tournament.sport) : W.theEvents;
  const poolNames = d?.pools?.length ? d.pools.map(p => p.name) : [];
  const identity = d ? [teamsFigure(d.acceptedCount ?? 0, d.capacity)].join(' · ') : W.noneLine;

  // ── The form's fields ──
  const fields = (
    <>
      <div className={screenParts.recordFields}>
        <label className={`${ck.field} ${screenParts.recordFieldWide}`} htmlFor="division-name">
          <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="division-name" className={ck.input} value={form.name} maxLength={60} placeholder="e.g. U13" onChange={e => set({ name: e.target.value })} data-autofocus="" />
          {shownMistake && mistake?.field === 'name' && <FormError inPlace>{mistake.text}</FormError>}
        </label>
        <label className={ck.field} htmlFor="division-youngest">
          <span className={ck.label}>{W.youngest}</span>
          <input id="division-youngest" className={ck.input} inputMode="numeric" value={form.minAge} onChange={e => set({ minAge: e.target.value.trim() })} />
        </label>
        <label className={ck.field} htmlFor="division-oldest">
          <span className={ck.label}>{W.oldest}</span>
          <input id="division-oldest" className={ck.input} inputMode="numeric" value={form.maxAge} onChange={e => set({ maxAge: e.target.value.trim() })} />
        </label>
        <div className={screenParts.recordFieldWide}>
          {mistake?.field === 'ages' ? <FormError inPlace>{mistake.text}</FormError> : <p className={ck.hint}>{W.agesHint}</p>}
        </div>
        <label className={ck.field} htmlFor="division-capacity">
          <span className={ck.label}>{W.capacity}</span>
          <input id="division-capacity" className={ck.input} inputMode="numeric" value={form.capacity} onChange={e => set({ capacity: e.target.value.trim() })} />
          {mistake?.field === 'capacity' ? <FormError inPlace>{mistake.text}</FormError> : <span className={ck.hint}>{W.capacityHint}</span>}
        </label>
      </div>

      <div className={`${ck.switchRow}${form.usePools ? '' : ` ${ck.switchRowOff}`}`}>
        <div className={ck.switchText}><span className={ck.switchName} id="division-pools-label">{W.splitPools}</span></div>
        <button type="button" role="switch" aria-checked={form.usePools} aria-labelledby="division-pools-label" className={ck.switch}
          onClick={() => set({ usePools: !form.usePools })} />
      </div>
      {form.usePools && (
        <div className={styles.pools}>
          <label className={ck.field} htmlFor="division-pool-count">
            <span className={ck.label}>{W.poolCount}</span>
            <select id="division-pool-count" className={ck.select} value={form.poolCount}
              onChange={e => {
                const n = Number(e.target.value);
                set({ poolCount: e.target.value, poolNames: Array.from({ length: n }, (_, i) => form.poolNames[i] ?? '') });
              }}>
              {Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className={styles.poolNames}>
            {Array.from({ length: Number(form.poolCount) || 2 }, (_, i) => (
              <label key={i} className={ck.field} htmlFor={`division-pool-${i}`}>
                <span className={ck.label}>{W.poolName(poolLetter(i))}</span>
                <input id={`division-pool-${i}`} className={ck.input} maxLength={40} value={form.poolNames[i] ?? ''} placeholder={poolLetter(i)}
                  onChange={e => { const names = [...form.poolNames]; names[i] = e.target.value; set({ poolNames: names }); }} />
              </label>
            ))}
          </div>
          <div className={`${ck.switchRow}${form.selfSelect ? '' : ` ${ck.switchRowOff}`}`}>
            <div className={ck.switchText}><span className={ck.switchName} id="division-selfselect-label">{W.teamsPickSwitch}</span></div>
            <button type="button" role="switch" aria-checked={form.selfSelect} aria-labelledby="division-selfselect-label" className={ck.switch}
              onClick={() => set({ selfSelect: !form.selfSelect })} />
          </div>
        </div>
      )}

      <label className={ck.field} htmlFor="division-contact">
        <span className={ck.label}>{W.contact}</span>
        <select id="division-contact" className={ck.select} value={form.contactMemberId} onChange={e => set({ contactMemberId: e.target.value })}>
          <option value="">{W.contactEvents}</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.displayName ?? m.email}{m.title ? ` — ${m.title}` : ''}</option>
          ))}
        </select>
      </label>

      {scopes.fee !== 'tournament' && scopes.fee !== 'free' && (
        <div className={styles.own}>
          {scopes.fee === 'per_division' ? (
            <p className={styles.ownHead}>{W.fee}<span className={repKit.req} aria-hidden>*</span> <span className={ck.hint}>{W.requiredHere}</span></p>
          ) : (
            <label className={styles.ownCheck}>
              <input type="checkbox" checked={form.ownFee} onChange={e => set({ ownFee: e.target.checked })} />
              <span>{W.ownFee}</span>
            </label>
          )}
          {(scopes.fee === 'per_division' || form.ownFee) && (
            <div className={screenParts.recordFields}>
              <label className={ck.field}><span className={ck.label}>{W.totalFee}</span>
                <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={form.totalFeeAmount} onChange={e => set({ totalFeeAmount: e.target.value })} /></label>
              <label className={ck.field}><span className={ck.label}>{W.totalDue}</span>
                <input className={ck.input} type="date" value={form.totalFeeDueDate} onChange={e => set({ totalFeeDueDate: e.target.value })} /></label>
              <label className={ck.field}><span className={ck.label}>{W.depositAmount}</span>
                <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={form.depositAmount} onChange={e => set({ depositAmount: e.target.value })} /></label>
              <label className={ck.field}><span className={ck.label}>{W.depositDue}</span>
                <input className={ck.input} type="date" value={form.depositDueDate} onChange={e => set({ depositDueDate: e.target.value })} /></label>
            </div>
          )}
        </div>
      )}

      {scopes.timing !== 'tournament' && (
        <div className={styles.own}>
          {scopes.timing === 'per_division' ? (
            <p className={styles.ownHead}>{W.gameLength}<span className={repKit.req} aria-hidden>*</span> <span className={ck.hint}>{W.requiredHere}</span></p>
          ) : (
            <label className={styles.ownCheck}>
              <input type="checkbox" checked={form.ownTiming} onChange={e => set({ ownTiming: e.target.checked })} />
              <span>{W.ownTiming}</span>
              {!form.ownTiming && <span className={ck.hint}>{W.theEventsLength(eventMinutes)}</span>}
            </label>
          )}
          {(scopes.timing === 'per_division' || form.ownTiming) && (
            <div className={screenParts.recordFields}>
              <label className={ck.field}><span className={ck.label}>{W.gameMinutes}</span>
                <input className={ck.input} type="number" min="1" max="600" step="5" inputMode="numeric" placeholder={String(eventMinutes)} value={form.gameMinutes} onChange={e => set({ gameMinutes: e.target.value })} /></label>
              <label className={ck.field}><span className={ck.label}>{W.bufferMinutes}</span>
                <input className={ck.input} type="number" min="0" max="120" step="5" inputMode="numeric" placeholder={String(eventBuffer)} value={form.bufferMinutes} onChange={e => set({ bufferMinutes: e.target.value })} /></label>
            </div>
          )}
        </div>
      )}

      {scopes.tieBreakers !== 'tournament' && (
        <div className={styles.own}>
          {scopes.tieBreakers === 'per_division' ? (
            <p className={styles.ownHead}>{W.tieBreakers}<span className={repKit.req} aria-hidden>*</span> <span className={ck.hint}>{W.requiredHere}</span></p>
          ) : (
            <label className={styles.ownCheck}>
              <input type="checkbox" checked={form.ownTieBreakers} onChange={e => set({ ownTieBreakers: e.target.checked, tieBreakers: e.target.checked ? form.tieBreakers : [...eventBreakers] })} />
              <span>{W.ownTieBreakers}</span>
            </label>
          )}
          {(scopes.tieBreakers === 'per_division' || form.ownTieBreakers) && (
            <>
              <p className={ck.hint}>{W.tieBreakersFor(tournament.exhibition)}</p>
              <TieBreakerEditor
                idPrefix="division"
                value={form.tieBreakers}
                onChange={nextBreakers => set({ tieBreakers: nextBreakers })}
                cap={form.runDiffCap}
                onCapChange={raw => set({ runDiffCap: raw })}
                capHelp="Blank = the event’s. Caps the difference column only."
              />
            </>
          )}
        </div>
      )}
    </>
  );

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={W.add}
        identity={W.noneLine}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? W.creating : W.add}</button>
          </>
        )}
      >
        <FormError>{createError}</FormError>
        {fields}
      </KitDialog>
    );
  }

  const question = d ? deleteQuestion(d.name, counts) : null;
  return (
    <>
      <KitDialog
        kind="form"
        title={editing ? (form.name.trim() || d!.name) : d!.name}
        ariaLabel={d!.name}
        identity={identity}
        status={editing ? (
          <SavePill inline saving={saving} dirty={dirty} error={leaveError || saveError || null} held={mistake?.text ?? null} onRetry={() => void handleSave()} />
        ) : undefined}
        edit={canWrite ? { editing, onToggle: toggleEdit, label: W.edit } : undefined}
        onClose={() => leave(onClose)}
        busy={busy}
        steps={{
          prev: prev ? { name: prev.name, onStep: () => leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.noun,
        }}
      >
        {editing ? fields : (
          <>
            <RecordSection title={W.registration}>
              <dl className={screenParts.recordFacts}>
                <div><dt>{W.teams}</dt><dd>{teamsFigure(d!.acceptedCount ?? 0, d!.capacity)}</dd></div>
                {d!.counts && d!.counts.waitlist > 0 && <div><dt>{W.waitlist}</dt><dd>{d!.counts.waitlist}</dd></div>}
                <div><dt>{W.registration}</dt><dd>{d!.isClosed ? W.registrationClosed : W.registrationOpen}</dd></div>
              </dl>
              <Link className={styles.door} href={`${base}/registrations?division=${encodeURIComponent(d!.id)}`}>{W.registrationDoor}</Link>
            </RecordSection>
            <RecordSection title={W.pools}>
              <dl className={screenParts.recordFacts}>
                <div><dt>{W.pools}</dt><dd>{poolNames.length >= 2 ? poolNames.join(' · ') : W.noPools}</dd></div>
                {poolNames.length >= 2 && <div><dt>{W.whoPicks}</dt><dd>{d!.requiresPoolSelection ? W.teamsPick : W.youAssign}</dd></div>}
              </dl>
            </RecordSection>
            <RecordSection title={W.ownSettings}>
              <dl className={screenParts.recordFacts}>
                <div><dt>{W.fee}</dt><dd>{feeLine}</dd></div>
                <div><dt>{W.gameLength}</dt><dd>{lengthLine}</dd></div>
                <div><dt>{W.tieBreakers}</dt><dd>{breakersLine}</dd></div>
                <div><dt>{W.contact}</dt><dd>{memberName(d!.contactMemberId) ?? W.theEventsContact}</dd></div>
              </dl>
            </RecordSection>
          </>
        )}
        {canWrite && (
          <RecordSection>
            <RecordDelete onClick={() => { setAskError(''); setAskCounts(null); setAsking(true); }} disabled={busy}>{W.deleteDivision}</RecordDelete>
          </RecordSection>
        )}
      </KitDialog>

      {asking && question && (
        <KitDialog
          kind="question"
          title={question.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void doDelete()} disabled={busy}>{question.action}</button>
            </>
          )}
        >
          <p>{question.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
