'use client';
/**
 * A HOUSE-LEAGUE SEASON'S REGISTRATIONS, ON THE CLUB KIT (Club Tier Stage 9b-2, Part 3; copy HOUSE_LEAGUE_STAGE9B2_COPY.md
 * §1–§9; drawings HOUSE_LEAGUE_STAGE9B_DRAWINGS.html b2 §1–§3). The page that was 1,157 lines of old look and hand-rolled
 * modals, rebuilt once:
 *
 *   the head      — "Registrations" under the season's name, + Add registration (absent on a finished season);
 *   the tabs      — To review (the amber count) · Active · Waitlist · Ended, in the address (`?tab=`);
 *   the toolbar   — the division, Search, Filter (Fee), Export (one button, Excel first) and Tools (Email families);
 *   the list      — a table at a desk, one framed row a child on a phone, the money on every row (the Fee cell is read from
 *                   the one money function, `feeState`), ONE primary action a row and the rest behind ⋯;
 *   the bulk bar  — ticked rows: Approve / Promote · Waitlist · Mark received · Move division · Email, the screen looping
 *                   the single-row press and saying the result in the copy's lines (a clean result fades; a partial one
 *                   stays until dismissed and keeps the rows that stayed ticked). Decline and Withdraw are one at a time;
 *   the windows   — Mark received · the ending (Decline / Withdraw / Release) · Correct the price · Move · Undo · Email ·
 *                   Add, every one the kit's window, sentences in the foot's left and buttons at its right.
 *
 * WHO MAY (the one gate, `lib/house-league-access.ts`): `register` (statuses; off on a finished season), `takeFees` (Mark
 * received, Undo, Correct the price, refunds; OPEN on a finished season), `run` (Move division; the registrar does not see
 * it), `email`. A control the member cannot use is not drawn.
 */
import { useCallback, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { isFreeFloorLeague } from '@/lib/free-floor';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { announceSeasonsChanged, useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { type KitStep } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { Callout, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../../money/MoneyKit';
import HubTabBar from '@/components/shared/HubTabBar';
import DivisionPicker from '@/components/admin/tournament/DivisionPicker';
import FilterMenu, { FilterLine, pickedLabels } from '@/components/admin/tournament/FilterMenu';
import { useToolbarSearch } from '@/components/admin/tournament/useToolbarSearch';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import {
  BULK_WORDS, FULL_WORDS, MOVE_WORDS, RECV_WORDS, REGS_WORDS,
  type EndMode,
} from '@/lib/house-league-money-words';
import { formatLeagueMoney, lastPayment, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import {
  bulkActions, bulkResult, endedKind, feeCell, matchesFee, matchesSearch, owesNow, phoneDetail, playerName, guardianName,
  priceIn, REG_TABS, regDay, regTab, rowActions, seasonHasFees, tallyWhy, whyOf, isRegTab,
  type BulkKey, type PriceChange, type RegRights, type RegTab, type RegsDivision, type RegsRead, type RegsSeason,
  type RowActionKey, type Why,
} from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';
import AddRegistrationWindow from './AddRegistrationWindow';
import BulkBar from './BulkBar';
import ConfirmWindow from './ConfirmWindow';
import EmailWindow from './EmailWindow';
import EndWindow from './EndWindow';
import MoveWindow, { type MoveOutcome, type MoveTarget } from './MoveWindow';
import PriceWindow from './PriceWindow';
import ReceiveWindow, { type ReceiveOutcome, type ReceiveTarget } from './ReceiveWindow';
import RegistrationRecordWindow from './RegistrationRecordWindow';
import RegistrationsList, { type RegRowModel, type RowNote } from './RegistrationsList';
import UndoWindow from './UndoWindow';
import type { MenuItem } from './RowMenu';
import { exportCsv, exportPdf, exportXlsx, type ExportRow } from './registrationsExport';
import css from './Registrations.module.css';

/** A list longer than this draws its first rows and "… n more". */
const PAGE = 50;

type Act =
  | { kind: 'receive'; ids: string[] }
  | { kind: 'end'; id: string; mode: EndMode }
  | { kind: 'price'; id: string }
  | { kind: 'move'; ids: string[] }
  | { kind: 'undo'; id: string }
  | { kind: 'email'; ids: string[] }
  | { kind: 'seasonEmail' }
  | { kind: 'confirm'; verb: 'approve' | 'promote' | 'waitlist'; ids: string[] }
  | { kind: 'add' };

interface TeamLite { id: string; name: string }

export default function RegistrationsScreen() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const orgSlug = currentOrg?.slug ?? '';
  // J3-012: every /api/admin fetch carries the org slug so the server resolves the URL's org.
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const base = `/${orgSlug}/admin/house-league/seasons/${seasonId}/registrations`;

  const [season, setSeason] = useState<RegsSeason | null>(null);
  const [divisions, setDivisions] = useState<RegsDivision[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [read, setRead] = useState<RegsRead | null>(null);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);

  // Who may (the one house-league gate): a finished season locks the registrations and keeps the fee (Q16).
  const access = useHouseLeagueAccess(season);

  const [scope, setScope] = useState('');
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [act, setAct] = useState<Act | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; stayed: number } | null>(null);
  const [landed, setLanded] = useState<RegTab | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!orgSlug || !seasonId) return;
    const current = beginRead();
    const [seasonRes, regsRes, teamsRes] = await Promise.all([
      moneyFetch<{ season?: RegsSeason & Record<string, unknown>; divisions?: RegsDivision[] }>(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`).catch(() => null),
      moneyFetch<RegsRead>(`/api/admin/house-league/seasons/${seasonId}/registrations${orgQuery}`).catch(() => null),
      moneyFetch<{ teams?: TeamLite[] }>(`/api/admin/house-league/seasons/${seasonId}/teams${orgQuery}`).catch(() => null),
    ]);
    if (!current()) return;
    if (seasonRes?.status === 404) { setFailed('missing'); return; }
    if (!seasonRes?.ok || !regsRes?.ok || !seasonRes.data.season) { setFailed('error'); return; }
    const s = seasonRes.data.season;
    setSeason({
      id: s.id, name: s.name, status: s.status, registrationFee: s.registrationFee ?? null, owingAmberDays: s.owingAmberDays ?? 14,
      autoPromoteWaitlist: !!s.autoPromoteWaitlist, autoApproveUnderCapacity: !!s.autoApproveUnderCapacity, earlyBirdUntil: s.earlyBirdUntil ?? null,
    });
    setDivisions((seasonRes.data.divisions ?? []).map(d => ({
      id: d.id, name: d.name, capacity: d.capacity ?? null, price: d.price ?? null, earlyPrice: d.earlyPrice ?? null,
      heldCount: d.heldCount ?? 0, waitlistCount: d.waitlistCount ?? 0,
    })));
    setTeams((teamsRes?.ok ? teamsRes.data.teams ?? [] : []).map(t => ({ id: t.id, name: t.name })));
    setRead({
      registrations: regsRes.data.registrations ?? [], money: regsRes.data.money ?? {},
      priceChanges: regsRes.data.priceChanges ?? [], today: regsRes.data.today,
    });
    setFailed(null);
  }, [orgSlug, seasonId, orgQuery, beginRead]);
  useDeferredLoad(!orgLoading && !!orgSlug && !!access?.read, load);

  // ── Derived ────────────────────────────────────────────────────────────────────────────────────
  const regs = useMemo(() => read?.registrations ?? [], [read]);
  const today = read?.today ?? '';
  const rights: RegRights = useMemo(() => ({
    register: !!access?.register, takeFees: !!access?.takeFees, run: !!access?.run, email: !!access?.email,
  }), [access]);
  const charges = season ? seasonHasFees(season, divisions) : false;

  const linesOf = useCallback((id: string): LeagueMoneyLine[] => read?.money[id] ?? [], [read]);
  const changesByReg = useMemo(() => {
    const m = new Map<string, PriceChange[]>();
    for (const c of read?.priceChanges ?? []) m.set(c.registrationId, [...(m.get(c.registrationId) ?? []), c]);
    return m;
  }, [read]);
  const divisionName = useCallback((id: string | null) => (id ? divisions.find(d => d.id === id)?.name ?? null : null), [divisions]);
  const teamName = useCallback((id: string | null) => (id ? teams.find(t => t.id === id)?.name ?? null : null), [teams]);

  const scoped = useMemo(() => (scope ? regs.filter(r => r.divisionId === scope) : regs), [regs, scope]);
  const counts = useMemo(() => {
    const c: Record<RegTab, number> = { review: 0, active: 0, waitlist: 0, ended: 0 };
    for (const r of scoped) c[regTab(r.status)] += 1;
    return c;
  }, [scoped]);
  const reviewByDivision = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of regs) if (r.status === 'pending_review' && r.divisionId) m.set(r.divisionId, (m.get(r.divisionId) ?? 0) + 1);
    return m;
  }, [regs]);

  // The landing tab: the day's work (a registration waiting for an answer), else the roster. Chosen once, on the first read.
  const firstLanding: RegTab = counts.review > 0 ? 'review' : 'active';
  if (read && landed == null) setLanded(firstLanding);
  const asked = search.get('tab');
  const tab: RegTab = isRegTab(asked) ? asked : landed ?? firstLanding;
  // A tab link changes the address only; the page keeps its state, so what belonged to the old tab is dropped here (the
  // React way to follow a value: adjusted during render, so the stale tab never paints).
  const [seenTab, setSeenTab] = useState(tab);
  if (seenTab !== tab) { setSeenTab(tab); setSelected(new Set()); setShown(PAGE); setNotes({}); }

  const fees = useMemo(() => {
    const m = new Map<string, ReturnType<typeof feeCell>>();
    if (!season || !read) return m;
    for (const r of regs) m.set(r.id, feeCell(r, season, linesOf(r.id), read.today, changesByReg.get(r.id) ?? []));
    return m;
  }, [regs, season, read, linesOf, changesByReg]);

  const feeFilterOn = charges && picks.size > 0;
  const tabRegs = useMemo(() => {
    const list = scoped.filter(r => regTab(r.status) === tab && matchesSearch(r, query)
      && (!feeFilterOn || matchesFee(fees.get(r.id)!.state, picks)));
    if (tab === 'waitlist') return list.sort((a, b) => (a.waitlistPosition ?? 9999) - (b.waitlistPosition ?? 9999));
    if (tab === 'ended') return list.sort((a, b) => Date.parse(b.endedAt ?? b.updatedAt) - Date.parse(a.endedAt ?? a.updatedAt));
    return list;
  }, [scoped, tab, query, feeFilterOn, fees, picks]);

  const bulkKeys = useMemo(() => bulkActions(tab, rights, charges), [tab, rights, charges]);
  const selectable = bulkKeys.length > 0;
  const selectedRegs = useMemo(() => tabRegs.filter(r => selected.has(r.id)), [tabRegs, selected]);
  const searchField = useToolbarSearch({ value: query, onChange: q => { setQuery(q); setShown(PAGE); setSelected(new Set()); }, label: REGS_WORDS.search });

  const itemFor = useCallback((key: RowActionKey, reg: LeagueRegistration, fee: ReturnType<typeof feeCell>, division: string | null): MenuItem => {
    const name = playerName(reg);
    const M = REGS_WORDS.menu;
    const balance = fee.state.kind === 'owing' || fee.state.kind === 'part' ? fee.state.owing : 0;
    switch (key) {
      case 'approve': return { key, label: REGS_WORDS.act.approve };
      case 'markReceived': return { key, label: M.markReceived.label, hint: M.markReceived.hint(formatLeagueMoney(balance)) };
      case 'move': return { key, label: M.move.label, hint: M.move.hint };
      case 'correct': return { key, label: M.correct.label, hint: M.correct.hint };
      case 'release': return { key, label: M.release.label, hint: M.release.hint };
      case 'withdraw': return { key, label: M.withdraw.label, hint: M.withdraw.hint };
      case 'decline': return { key, label: M.decline.label, hint: M.decline.hint };
      case 'email': return { key, label: M.email.label, hint: M.email.hint };
      case 'undo': return { key, label: M.undo.label, hint: M.undo.hint };
      case 'waitlist': return { key, label: M.waitlist.label, hint: M.waitlist.hint(name) };
      case 'promote': return { key, label: M.promote.label, hint: M.promote.hint(name, division ?? REGS_WORDS.noDivision) };
    }
  }, []);

  /** One registration as the list draws it. */
  const modelFor = useCallback((reg: LeagueRegistration): RegRowModel => {
    const fee = fees.get(reg.id)!;
    const division = divisionName(reg.divisionId);
    const team = teamName(reg.teamId);
    const ended = reg.status === 'declined' || reg.status === 'withdrawn';
    const kind = endedKind(reg);
    const playerSub = ended && reg.endedAt
      ? REGS_WORDS.player[kind](regDay(reg.endedAt, today))
      : reg.source === 'admin_manual' ? REGS_WORDS.player.byHand(regDay(reg.registeredAt, today)) : REGS_WORDS.player.signedUp(regDay(reg.registeredAt, today));
    const asked = !ended && reg.withdrawRequestedAt ? REGS_WORDS.player.asked(regDay(reg.withdrawRequestedAt, today)) : null;
    const actions = rowActions(reg, fee.state, linesOf(reg.id), rights);
    const sheet = actions.all.map(k => itemFor(k, reg, fee, division));
    const primaryLabel = actions.primary === 'approve' ? REGS_WORDS.act.approve
      : actions.primary === 'markReceived' ? REGS_WORDS.act.markReceived
        : actions.primary === 'promote' ? REGS_WORDS.act.promote : null;
    return {
      reg,
      name: playerName(reg),
      playerSub: asked ? `${playerSub} · ${asked}` : playerSub,
      division,
      divisionSub: !division ? null : team ?? (ended ? null : REGS_WORDS.notPlaced),
      guardian: guardianName(reg),
      email: reg.guardianEmail.trim(),
      fee,
      phoneLine: phoneDetail(division ?? REGS_WORDS.noDivision, team, fee),
      primary: actions.primary,
      primaryLabel,
      busy: busyIds.has(reg.id),
      menu: sheet.filter(i => i.key !== actions.primary),
      sheet,
      sheetSub: REGS_WORDS.sheetSub(division ?? REGS_WORDS.noDivision, fee.primary),
      note: notes[reg.id] ?? null,
    };
  }, [fees, divisionName, teamName, today, linesOf, rights, itemFor, busyIds, notes]);

  const rowModels = useMemo(() => tabRegs.slice(0, shown).map(modelFor), [tabRegs, shown, modelFor]);

  // ── Saying what happened ───────────────────────────────────────────────────────────────────────
  const say = (text: string) => setNotice(text);
  const markBusy = (ids: readonly string[], on: boolean) => setBusyIds(prev => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  });
  const afterWrite = () => { void load(); announceSeasonsChanged(); };
  const clearSelection = () => setSelected(new Set());
  const nameOf = (id: string) => { const r = regs.find(x => x.id === id); return r ? playerName(r) : ''; };

  /** A batch's result: a clean one fades, a partial one stays until dismissed and keeps its stayed rows ticked. */
  function present(r: { text: string; partial: boolean }, stayed: readonly string[]) {
    afterWrite();
    if (r.partial) { setResult({ text: r.text, stayed: stayed.length }); setSelected(new Set(stayed)); } else { setResult(null); say(r.text); clearSelection(); }
  }

  // ── Status presses (Approve · Promote · Waitlist) ──────────────────────────────────────────────
  const statusBody = (verb: 'approve' | 'promote' | 'waitlist') => ({ status: verb === 'waitlist' ? 'waitlisted' : 'active' });

  async function statusOne(reg: LeagueRegistration, verb: 'approve' | 'promote' | 'waitlist') {
    setNotes(n => { const rest = { ...n }; delete rest[reg.id]; return rest; });
    markBusy([reg.id], true);
    const r = await patchRegistration(orgQuery, seasonId, reg.id, statusBody(verb));
    markBusy([reg.id], false);
    if (!r.ok) {
      const name = playerName(reg);
      const division = divisionName(reg.divisionId) ?? '';
      const full = r.code === 'division_full';
      setNotes(n => ({
        ...n,
        [reg.id]: full
          ? (verb === 'promote'
            ? { text: FULL_WORDS.promote(division, name) }
            : { text: FULL_WORDS.approve(division), offer: { label: FULL_WORDS.offer(name), key: 'waitlist' } })
          : { text: r.error },
      }));
      if (r.status === 409 && !full) void load();
      return;
    }
    afterWrite();
    say(BULK_WORDS.done[verb].clean(1));
  }

  async function runBulkStatus(verb: 'approve' | 'promote' | 'waitlist', ids: readonly string[]) {
    const rows = ids.map(id => regs.find(r => r.id === id)).filter((r): r is LeagueRegistration => !!r);
    let ok = 0;
    const whys: Why[] = [];
    const stayed: string[] = [];
    for (const reg of rows) {
      const r = await patchRegistration(orgQuery, seasonId, reg.id, statusBody(verb));
      if (r.ok) { ok += 1; continue; }
      whys.push(whyOf(r, { division: divisionName(reg.divisionId), free: false }));
      stayed.push(reg.id);
    }
    setAct(null);
    present(bulkResult({ verb, ok, tally: tallyWhy(whys) }), stayed);
  }

  // ── Mark received ──────────────────────────────────────────────────────────────────────────────
  const receiveTargets = (ids: readonly string[]): ReceiveTarget[] => ids.flatMap(id => {
    const reg = regs.find(r => r.id === id);
    const fee = reg ? fees.get(reg.id) : undefined;
    if (!reg || !fee || (fee.state.kind !== 'owing' && fee.state.kind !== 'part')) return [];
    const last = lastPayment(linesOf(reg.id));
    return [{
      reg, name: playerName(reg), division: divisionName(reg.divisionId) ?? REGS_WORDS.noDivision, owing: fee.state.owing,
      price: owesNow(reg, season!), received: receivedOf(linesOf(reg.id)), lastDay: last?.day ?? null,
    }];
  });

  /** Why a ticked row was not part of a Mark received batch (copy §2.2). */
  function skipWhy(reg: LeagueRegistration): Why {
    const kind = fees.get(reg.id)?.state.kind;
    return kind === 'received' ? { key: 'received' } : kind === 'free' ? { key: 'free' }
      : kind === 'review' || kind === 'waitlist' ? { key: 'notAccepted' } : { key: 'ended' };
  }

  function finishReceive(out: ReceiveOutcome, requested: readonly string[]) {
    setAct(null);
    const whys: Why[] = [];
    const stayed: string[] = [];
    for (const id of requested) {
      const reg = regs.find(r => r.id === id);
      if (!reg || out.done.includes(id)) continue;
      const refused = out.refused.find(x => x.id === id);
      whys.push(refused ? whyOf(refused.refusal, { division: divisionName(reg.divisionId), free: owesNow(reg, season!) <= 0 }) : skipWhy(reg));
      stayed.push(id);
    }
    if (requested.length === 1 && out.done.length === 1) { afterWrite(); say(RECV_WORDS.done(nameOf(requested[0]))); clearSelection(); return; }
    present(bulkResult({ verb: 'markReceived', ok: out.done.length, tally: tallyWhy(whys) }), stayed);
  }

  // ── Move ───────────────────────────────────────────────────────────────────────────────────────
  const moveTargets = (ids: readonly string[]): MoveTarget[] => ids.flatMap(id => {
    const reg = regs.find(r => r.id === id);
    return reg ? [{ reg, name: playerName(reg), from: divisionName(reg.divisionId), received: receivedOf(linesOf(reg.id)) }] : [];
  });

  function finishMove(out: MoveOutcome, requested: readonly string[]) {
    setAct(null);
    if (requested.length === 1 && out.done.length === 1) { afterWrite(); say(MOVE_WORDS.done(playerName(out.done[0]), out.division)); clearSelection(); return; }
    present(bulkResult({ verb: 'move', ok: out.done.length, tally: out.tally, division: out.division, kept: out.kept }), out.stayed);
  }

  // ── Row and bulk actions ───────────────────────────────────────────────────────────────────────
  function pickRow(reg: LeagueRegistration, key: RowActionKey) {
    switch (key) {
      case 'approve': void statusOne(reg, 'approve'); break;
      case 'promote': void statusOne(reg, 'promote'); break;
      case 'waitlist': void statusOne(reg, 'waitlist'); break;
      case 'markReceived': setAct({ kind: 'receive', ids: [reg.id] }); break;
      case 'move': setAct({ kind: 'move', ids: [reg.id] }); break;
      case 'correct': setAct({ kind: 'price', id: reg.id }); break;
      case 'release': setAct({ kind: 'end', id: reg.id, mode: 'released' }); break;
      case 'withdraw': setAct({ kind: 'end', id: reg.id, mode: 'withdrawn' }); break;
      case 'decline': setAct({ kind: 'end', id: reg.id, mode: 'declined' }); break;
      case 'email': setAct({ kind: 'email', ids: [reg.id] }); break;
      case 'undo': setAct({ kind: 'undo', id: reg.id }); break;
    }
  }

  function runBulk(key: BulkKey) {
    const ids = selectedRegs.map(r => r.id);
    if (ids.length === 0) return;
    if (key === 'approve' || key === 'promote' || key === 'waitlist') { setAct({ kind: 'confirm', verb: key, ids }); return; }
    if (key === 'email') { setAct({ kind: 'email', ids }); return; }
    if (key === 'move') { setAct({ kind: 'move', ids }); return; }
    // Mark received: only the owing ones go to the window; the rest are said in the result.
    if (receiveTargets(ids).length === 0) { finishReceive({ done: [], refused: [] }, ids); return; }
    setAct({ kind: 'receive', ids });
  }

  // ── The record's neighbours ────────────────────────────────────────────────────────────────────
  const openReg = openId ? regs.find(r => r.id === openId) ?? null : null;
  const openAt = openId ? tabRegs.findIndex(r => r.id === openId) : -1;
  const stepTo = (r: LeagueRegistration): KitStep => ({ name: playerName(r), onStep: () => setOpenId(r.id) });
  const recordSteps = openAt >= 0 ? {
    prev: openAt > 0 ? stepTo(tabRegs[openAt - 1]) : null,
    next: openAt < tabRegs.length - 1 ? stepTo(tabRegs[openAt + 1]) : null,
    position: `${openAt + 1} of ${tabRegs.length}`,
  } : null;

  // ── Export ─────────────────────────────────────────────────────────────────────────────────────
  const exportRows: ExportRow[] = tabRegs.map(reg => ({ reg, division: divisionName(reg.divisionId) ?? '', fee: fees.get(reg.id)?.primary ?? '' }));
  const freeFloor = !!currentOrg && isFreeFloorLeague(currentOrg);

  // ── The header ─────────────────────────────────────────────────────────────────────────────────
  const header = (
    <AdminPageHeader
      eyebrow={season ? REGS_WORDS.eyebrow(season.name) : 'House league'}
      title={REGS_WORDS.title}
      backTo={{ href: `/${orgSlug}/admin/house-league/seasons/${seasonId}`, label: season?.name ?? 'Season' }}
      inlineActions
      actions={access?.register ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} aria-label={REGS_WORDS.add} onClick={() => setAct({ kind: 'add' })}>
          <Plus size={14} aria-hidden /><span className={ck.btnWord}>{REGS_WORDS.add}</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || !access) return <PageLoading header={header} label={REGS_WORDS.loading} />;
  if (!access.read) return <div className={repKit.page}>{header}<EmptyCard title={REGS_WORDS.noAccess} /></div>;
  if (!read && !failed) return <PageLoading header={header} label={REGS_WORDS.loading} />;
  if (failed || !season || !read) {
    return (
      <div className={repKit.page}>
        {header}
        <LoadFailed title={REGS_WORDS.failed} onRetry={() => { setFailed(null); void load(); }} />
      </div>
    );
  }

  // ── The tabs ───────────────────────────────────────────────────────────────────────────────────
  const tabs = REG_TABS.map(id => ({
    id,
    label: REGS_WORDS.tab[id],
    href: `${base}?tab=${id}`,
    mark: counts[id] > 0
      ? (id === 'review'
        ? <span className={frame.count} style={{ marginLeft: 0 }} aria-label={REGS_WORDS.reviewAria(counts[id])}>{counts[id] > 9 ? '9+' : counts[id]}</span>
        : <span className={css.tabCount}>{counts[id]}</span>)
      : undefined,
  }));

  // ── The Fee filter ─────────────────────────────────────────────────────────────────────────────
  const feeOptions = [
    { key: 'owing', label: REGS_WORDS.filterOwing },
    { key: 'received', label: REGS_WORDS.filterReceived },
    ...(tab === 'ended' ? [{ key: 'refunded', label: REGS_WORDS.filterRefunded }] : []),
  ];
  const groups = charges ? [{
    key: 'fee', label: REGS_WORDS.filterFee, options: feeOptions,
    selected: [...picks].filter(k => feeOptions.some(o => o.key === k)),
    onToggle: (k: string) => { setPicks(prev => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; }); setShown(PAGE); clearSelection(); },
  }] : [];
  const resetFilter = () => { setPicks(new Set()); setShown(PAGE); };

  // ── The empty states ───────────────────────────────────────────────────────────────────────────
  const E = REGS_WORDS.empty;
  const emptyCard = (() => {
    if (regs.length === 0) return <EmptyCard title={E.all.title}>{E.all.body}</EmptyCard>;
    if (query.trim()) return <EmptyCard title={E.search} />;
    if (feeFilterOn) return <EmptyCard title={E.filter} action={<button type="button" className="btn btn-outline" onClick={resetFilter}>{REGS_WORDS.filterClear}</button>} />;
    const e = tab === 'review' ? (season.autoApproveUnderCapacity ? E.reviewAuto : E.review) : tab === 'active' ? E.active : tab === 'waitlist' ? E.waitlist : E.ended;
    return <EmptyCard title={e.title}>{e.body}</EmptyCard>;
  })();

  const raised = openId != null;
  const actReg = (id: string) => regs.find(r => r.id === id);
  const picked = selectedRegs.length;

  return (
    <div className={`${repKit.page} ${repKit.moneyFrame} ${css.screen}`} data-selecting={picked > 0 || undefined}>
      {header}
      <HubTabBar tabs={tabs} activeId={tab} ariaLabel={REGS_WORDS.tabsLabel} remeasureKey={`${counts.review}-${counts.active}-${counts.waitlist}-${counts.ended}`} />

      <div className={tb.toolbar}>
        <DivisionPicker
          divisions={[{ id: '', name: REGS_WORDS.scopeAll, waiting: 0 }, ...divisions.map(d => ({ id: d.id, name: d.name, waiting: reviewByDivision.get(d.id) ?? 0 }))]}
          value={scope}
          onChange={id => { setScope(id); setShown(PAGE); clearSelection(); }}
          words={{ waiting: REGS_WORDS.scopeToReview, waitingElsewhere: REGS_WORDS.scopeElsewhere }}
        />
        <span className={tb.toolbarSpacer} aria-hidden />
        <div className={tb.deskFilters}>{searchField.field}</div>
        {searchField.toggle}
        {groups.length > 0 && (
          <FilterMenu groups={groups} label={REGS_WORDS.filter} onLabel={REGS_WORDS.filterOn} resetLabel={REGS_WORDS.filterClear} onReset={resetFilter} align="end" />
        )}
        {/* Exports are a paid-League capability. The free League Starter floor hides the menu. NOTE: exports are 100%
            client-side (no server route). If a server export route is ever added for house-league it MUST guard
            isFreeFloorLeague(org) → 403. */}
        {freeFloor ? (
          <span className="badge badge-neutral" title="Exports are part of League. Upgrade to export your registrations.">Exports · League</span>
        ) : (
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={() => exportXlsx(exportRows, currentOrg?.slug, tab, false)}
            onExportCSV={() => exportCsv(exportRows, currentOrg?.slug, tab)}
            onExportPDF={() => exportPdf({
              rows: exportRows, divisionOrder: divisions.map(d => ({ id: d.id, name: d.name })), orgSlug: currentOrg?.slug, orgName: currentOrg?.name,
              orgQuery, seasonName: season.name, tab, query,
            })}
            /* ⚠ THE SURFACE'S OWN GATE, NOT THE GENERIC ONE: a module granted by an add-on can put an org above the
               generic PDF bar without ever reaching League. */
            pdfFeatureKey="league_exports"
            hasSensitiveOption
            sensitiveOptionLabel="Excel with contact details"
            onExportXLSXWithSensitive={() => exportXlsx(exportRows, currentOrg?.slug, tab, true)}
            planId={currentOrg?.planId}
            disabled={tabRegs.length === 0}
          />
        )}
        {rights.email && (
          <CoachToolbarMenu
            label={REGS_WORDS.tools}
            icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
            collapseOnPhone
            bareOnPhone
            drawerOnPhone
            drawerTitle={REGS_WORDS.tools}
            triggerClassName={tb.tool}
          >
            <CoachToolbarMenuItem label={REGS_WORDS.toolsEmail} onSelect={() => setAct({ kind: 'seasonEmail' })} />
          </CoachToolbarMenu>
        )}
      </div>
      {searchField.row}
      <FilterLine picks={pickedLabels(groups)} label={REGS_WORDS.filter} />

      {result && (
        <Callout tone="warn" role="status" action={<button type="button" className="btn btn-outline" onClick={() => setResult(null)}>{BULK_WORDS.dismiss}</button>}>
          <b>{result.text}</b>
          <span className={css.resultSub}>{BULK_WORDS.stayed(result.stayed)}</span>
        </Callout>
      )}

      {picked > 0 && !isPhone && (
        <BulkBar count={picked} actions={bulkKeys} isPhone={false} showHelp={false} onAct={runBulk} onClear={clearSelection} />
      )}

      {tabRegs.length === 0 ? emptyCard : (
        <>
          <RegistrationsList
            rows={rowModels}
            showFee={charges}
            isPhone={isPhone}
            selectable={selectable}
            selected={selected}
            hidden={Math.max(0, tabRegs.length - shown)}
            onMore={() => setShown(n => n + PAGE)}
            onSelectAll={() => setSelected(rowModels.every(r => selected.has(r.reg.id)) ? new Set() : new Set(rowModels.map(r => r.reg.id)))}
            onToggle={id => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
            onOpen={setOpenId}
            onPrimary={row => row.primary && pickRow(row.reg, row.primary)}
            onPick={(row, key) => pickRow(row.reg, key)}
            onNote={(row, key) => void statusOne(row.reg, key)}
          />
          {charges && <p className={repKit.notes}>{REGS_WORDS.fee.foot}</p>}
        </>
      )}

      {picked > 0 && isPhone && (
        <BulkBar count={picked} actions={bulkKeys} isPhone showHelp={rights.register && tab !== 'ended'} onAct={runBulk} onClear={clearSelection} />
      )}

      {/* ── The record ── */}
      {openReg && (
        <RegistrationRecordWindow
          key={openReg.id}
          model={modelFor(openReg)}
          season={season}
          seasonName={season.name}
          teamName={teamName(openReg.teamId)}
          lines={linesOf(openReg.id)}
          changes={changesByReg.get(openReg.id) ?? []}
          today={today}
          showFee={charges}
          statusWord={openReg.status === 'waitlisted' && openReg.waitlistPosition != null
            ? `${REGS_WORDS.tab.waitlist} · ${REGS_WORDS.waitingPosition(openReg.waitlistPosition)}`
            : regTab(openReg.status) === 'ended' ? ({ declined: 'Declined', withdrawn: 'Withdrawn', released: 'Spot released' } as const)[endedKind(openReg)]
              : REGS_WORDS.tab[regTab(openReg.status)]}
          steps={recordSteps}
          onPick={key => pickRow(openReg, key)}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* ── The windows (every one the kit's; raised over the record when it is open) ── */}
      {act?.kind === 'receive' && (
        <ReceiveWindow
          seasonName={season.name}
          targets={receiveTargets(act.ids)}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={out => finishReceive(out, act.ids)}
        />
      )}
      {act?.kind === 'end' && actReg(act.id) && (
        <EndWindow
          reg={actReg(act.id)!}
          name={nameOf(act.id)}
          mode={act.mode}
          division={divisionName(actReg(act.id)!.divisionId) ?? REGS_WORDS.noDivision}
          regs={regs}
          lines={linesOf(act.id)}
          autoPromote={season.autoPromoteWaitlist}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={(done) => { setAct(null); afterWrite(); say(done.said); setSelected(prev => { const n = new Set(prev); n.delete(act.id); return n; }); }}
        />
      )}
      {act?.kind === 'price' && actReg(act.id) && (() => {
        const reg = actReg(act.id)!;
        const changes = changesByReg.get(reg.id) ?? [];
        const division = divisions.find(d => d.id === reg.divisionId);
        const early = division ? priceIn(division, season, reg) : null;
        const price = owesNow(reg, season);
        const kind = changes.some(c => c.kind === 'corrected') ? 'corrected' : early?.early && early.amount === price ? 'early' : 'regular';
        return (
          <PriceWindow
            reg={reg}
            name={playerName(reg)}
            price={price}
            kind={kind}
            lines={linesOf(reg.id)}
            changes={changes}
            today={today}
            orgQuery={orgQuery}
            seasonId={seasonId}
            raised={raised}
            onClose={() => setAct(null)}
            onChanged={() => void load()}
            onDone={said => { setAct(null); afterWrite(); say(said); }}
          />
        );
      })()}
      {act?.kind === 'move' && (
        <MoveWindow
          season={season}
          divisions={divisions}
          targets={moveTargets(act.ids)}
          regs={regs}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={out => finishMove(out, act.ids)}
        />
      )}
      {act?.kind === 'undo' && actReg(act.id) && lastPayment(linesOf(act.id)) && (
        <UndoWindow
          regId={act.id}
          name={nameOf(act.id)}
          payment={lastPayment(linesOf(act.id))!}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={said => { setAct(null); afterWrite(); say(said); }}
        />
      )}
      {(act?.kind === 'email' || act?.kind === 'seasonEmail') && (
        <EmailWindow
          seasonName={season.name}
          audience={act.kind === 'email' ? { kind: 'selected', regs: act.ids.map(actReg).filter((r): r is LeagueRegistration => !!r) } : { kind: 'season' }}
          allRegs={regs}
          divisions={divisions}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          onClose={() => setAct(null)}
          onSent={said => { setAct(null); say(said); if (act.kind === 'email') clearSelection(); }}
        />
      )}
      {act?.kind === 'confirm' && (
        <ConfirmWindow
          title={BULK_WORDS.confirm[act.verb].title(act.ids.length)}
          body={BULK_WORDS.confirm[act.verb].body}
          go={BULK_WORDS.confirm[act.verb].go(act.ids.length)}
          onClose={() => setAct(null)}
          onConfirm={() => runBulkStatus(act.verb, act.ids)}
        />
      )}
      {act?.kind === 'add' && (
        <AddRegistrationWindow
          seasonName={season.name}
          divisions={divisions}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          onClose={() => setAct(null)}
          onAdded={said => { setAct(null); afterWrite(); say(said); }}
        />
      )}

      {notice && <NoticePill key={notice} message={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}
