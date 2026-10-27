'use client';
/**
 * A HOUSE-LEAGUE SEASON'S REGISTRATIONS, ON THE CLUB KIT (Club Tier Stage 9b-2, Part 3; copy HOUSE_LEAGUE_STAGE9B2_COPY.md
 * §1–§9; drawings HOUSE_LEAGUE_STAGE9B_DRAWINGS.html b2 §1–§3). The page that was 1,157 lines of old look and hand-rolled
 * modals, rebuilt once:
 *
 *   the head      — "Registrations" under the season's name, + Add registration (absent on a finished season);
 *   the tabs      — To review (the amber count) · Active · Waitlist · Ended, in the address (`?tab=`);
 *   the toolbar   — the division, Search, Filter (Fee), and Export (one button, Excel first);
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
import { Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { isFreeFloorLeague } from '@/lib/free-floor';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { announceSeasonsChanged, useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import KitDialog, { DialogCancel, type KitStep } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { Callout, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../../money/MoneyKit';
import HubTabBar from '@/components/shared/HubTabBar';
import DivisionPicker from '@/components/admin/tournament/DivisionPicker';
import FilterMenu, { FilterLine, pickedLabels } from '@/components/admin/tournament/FilterMenu';
import { useToolbarSearch } from '@/components/admin/tournament/useToolbarSearch';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import {
  BULK_WORDS, CARD_REFUND_WORDS, FULL_WORDS, MOVE_WORDS, RECV_WORDS, REGS_WORDS,
  type EndMode,
} from '@/lib/house-league-money-words';
import { awaitsAnswer, refundTarget, type CardRefund } from '@/lib/league-card-refunds';
import { formatLeagueMoney, isOwing, lastPayment, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import { orgDayKey } from '@/lib/timezone';
import {
  bulkActions, bulkResult, endedKind, feeCell, isOpenReg, matchesPicks, matchesSearch, owesNow, phoneDetail, playerName, guardianName,
  priceOn, REG_TABS, regDay, regTab, regFilterCounts, regFilterOffer, rowActions, seasonHasFees, tallyWhy, whyOf, isRegTab,
  NO_PICKS, NOT_PLACED,
  type BulkKey, type PriceChange, type RegFilterGroup, type RegFilterPicks, type RegRights, type RegTab, type RegsDivision, type RegsRead, type RegsSeason,
  type RowActionKey, type Why, howOf,
} from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';
import AddRegistrationWindow from './AddRegistrationWindow';
import BulkBar from './BulkBar';
import ConfirmWindow from './ConfirmWindow';
import EmailFamiliesWindow from '../../families/EmailFamiliesWindow';
import EndWindow from './EndWindow';
import MoveWindow, { type MoveOutcome, type MoveTarget } from './MoveWindow';
import PriceWindow from './PriceWindow';
import ReceiveWindow, { type ReceiveOutcome, type ReceiveTarget } from './ReceiveWindow';
import RegistrationRecordWindow from './RegistrationRecordWindow';
import { isDisputeOpen } from '@/lib/online-payment-dispute';
import { DISPUTE_WORDS } from '@/lib/online-payment-words';
import RegistrationsList, { type RegRowModel, type RowNote } from './RegistrationsList';
import UndoWindow from './UndoWindow';
import WhoseWindow from './WhoseWindow';
import type { MenuItem } from './RowMenu';
import { exportCsv, exportPdf, exportXlsx, type ExportRow } from './registrationsExport';
import css from './Registrations.module.css';

/** A list longer than this draws its first rows and "… n more". */
const PAGE = 50;

type Act =
  // The windows that can refuse and read again keep what they OPENED on: a reload must never change their targets (a
  // refusal stays a refusal, and a second press sends what the first did).
  | { kind: 'receive'; ids: string[]; targets: ReceiveTarget[] }
  | { kind: 'end'; id: string; mode: EndMode; stripeRefundIds?: string[] }
  | { kind: 'price'; id: string }
  | { kind: 'move'; ids: string[]; targets: MoveTarget[] }
  | { kind: 'undo'; id: string; payment: LeagueMoneyLine }
  | { kind: 'email'; ids: string[] }
  | { kind: 'confirm'; verb: 'approve' | 'promote' | 'waitlist'; ids: string[] }
  | { kind: 'add' };

interface TeamLite { id: string; name: string; divisionId: string }

/** The row action that opens the ending window, and which ending it is. */
const END_MODE = { release: 'released', withdraw: 'withdrawn', decline: 'declined' } as const;

/** What a reload reads again: the season's own facts and divisions' counts, and the season's teams. The registrations always. */
interface LoadScope { season?: boolean; teams?: boolean }

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
  // Reading comes from the member alone (so the first read can start); every control comes from the SEASON-AWARE answer,
  // null until the season has loaded, so nothing writable paints before the page knows the season is finished (Q16).
  const gate = useHouseLeagueAccess();
  const access = useSeasonAccess(season);

  const [scope, setScope] = useState('');
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<RegFilterPicks>(NO_PICKS);
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
  // The first read (and a retry) reads everything. A reload after a press reads the registrations, and the season only when
  // that press can have moved a division's counts (a Move, a status change or ending, an add); the teams never change here.
  const load = useCallback(async ({ season: withSeason = true, teams: withTeams = true }: LoadScope = {}) => {
    if (!orgSlug || !seasonId) return;
    const current = beginRead();
    const [seasonRes, regsRes, teamsRes] = await Promise.all([
      withSeason ? moneyFetch<{ season?: RegsSeason & Record<string, unknown>; divisions?: RegsDivision[] }>(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`).catch(() => null) : null,
      moneyFetch<RegsRead>(`/api/admin/house-league/seasons/${seasonId}/registrations${orgQuery}`).catch(() => null),
      withTeams ? moneyFetch<{ teams?: TeamLite[] }>(`/api/admin/house-league/seasons/${seasonId}/teams${orgQuery}`).catch(() => null) : null,
    ]);
    if (!current()) return;
    if (seasonRes?.status === 404) { setFailed('missing'); return; }
    if (!regsRes?.ok || (withSeason && (!seasonRes?.ok || !seasonRes.data.season))) { setFailed('error'); return; }
    if (withSeason && seasonRes?.ok && seasonRes.data.season) {
      const s = seasonRes.data.season;
      setSeason({
        id: s.id, name: s.name, status: s.status, registrationFee: s.registrationFee ?? null, owingAmberDays: s.owingAmberDays ?? 14,
        autoPromoteWaitlist: !!s.autoPromoteWaitlist, autoApproveUnderCapacity: !!s.autoApproveUnderCapacity, earlyBirdUntil: s.earlyBirdUntil ?? null,
      });
      setDivisions((seasonRes.data.divisions ?? []).map(d => ({
        id: d.id, name: d.name, capacity: d.capacity ?? null, price: d.price ?? null, earlyPrice: d.earlyPrice ?? null,
        heldCount: d.heldCount ?? 0, waitlistCount: d.waitlistCount ?? 0,
      })));
    }
    if (withTeams) setTeams((teamsRes?.ok ? teamsRes.data.teams ?? [] : []).map(t => ({ id: t.id, name: t.name, divisionId: t.divisionId })));
    setRead({
      registrations: regsRes.data.registrations ?? [], money: regsRes.data.money ?? {},
      priceChanges: regsRes.data.priceChanges ?? [], today: regsRes.data.today, payLinks: !!regsRes.data.payLinks,
      unrecordedCard: regsRes.data.unrecordedCard ?? {}, returnedRefunds: regsRes.data.returnedRefunds ?? {},
      cardRefunds: regsRes.data.cardRefunds ?? {}, notMatched: regsRes.data.notMatched ?? {}, debits: regsRes.data.debits ?? {},
      disputes: regsRes.data.disputes ?? {},
    });
    setFailed(null);
  }, [orgSlug, seasonId, orgQuery, beginRead]);
  useDeferredLoad(!orgLoading && !!orgSlug && !!gate?.read, load);

  // ── Derived ────────────────────────────────────────────────────────────────────────────────────
  const regs = useMemo(() => read?.registrations ?? [], [read]);
  const regById = useMemo(() => new Map(regs.map(r => [r.id, r])), [regs]);
  const today = read?.today ?? '';
  const rights: RegRights = useMemo(() => ({
    register: !!access?.register, takeFees: !!access?.takeFees, run: !!access?.run, email: !!access?.email,
    payLinks: !!read?.payLinks,
  }), [access, read?.payLinks]);
  const charges = season ? seasonHasFees(season, divisions) : false;

  const linesOf = useCallback((id: string): LeagueMoneyLine[] => read?.money[id] ?? [], [read]);
  const refundsOf = useCallback((id: string) => read?.cardRefunds?.[id] ?? [], [read]);
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
  // 12c (F5): a Needs-attention item opens the child's record (?reg=…&at=fee|card), on the tab the child is on.
  const linkedId = search.get('reg');
  const linked = linkedId ? regById.get(linkedId) ?? null : null;
  const [openedLink, setOpenedLink] = useState<string | null>(null);
  if (linked && openedLink !== linked.id) { setOpenedLink(linked.id); setOpenId(linked.id); }
  const linkedAt = search.get('at') === 'card' ? 'card' : linked ? 'fee' : null;
  // 12c Part 7: "View the payment" opens the record at its Fee.
  const [feeFocus, setFeeFocus] = useState<string | null>(null);
  // 12c: a still-enrolled notice's answer (?answer=withdraw|link|keep), asked once on arrival; "whose was it?" (?whose=…).
  const linkedAnswer = search.get('answer');
  const [answered, setAnswered] = useState<string | null>(null);
  const whoseId = search.get('whose');
  const [whoseOpen, setWhoseOpen] = useState<string | null>(null);
  const [seenWhose, setSeenWhose] = useState<string | null>(null);
  if (whoseId && seenWhose !== whoseId) { setSeenWhose(whoseId); setWhoseOpen(whoseId); }
  const asked = search.get('tab') ?? (linked ? regTab(linked.status) : null);
  const tab: RegTab = isRegTab(asked) ? asked : landed ?? firstLanding;
  // A tab link changes the address only; the page keeps its state, so what belonged to the old tab is dropped here (the
  // React way to follow a value: adjusted during render, so the stale tab never paints).
  const [seenTab, setSeenTab] = useState(tab);
  if (seenTab !== tab) { setSeenTab(tab); setSelected(new Set()); setShown(PAGE); setNotes({}); }

  const fees = useMemo(() => {
    const m = new Map<string, ReturnType<typeof feeCell>>();
    if (!season || !read) return m;
    for (const r of regs) m.set(r.id, feeCell(r, season, linesOf(r.id), read.today, changesByReg.get(r.id) ?? [], refundsOf(r.id), read.notMatched?.[r.id] ?? null, read.debits?.[r.id] ?? null, read.disputes?.[r.id] ?? null));
    return m;
  }, [regs, season, read, linesOf, changesByReg, refundsOf]);

  // The Filter (Team · Fee · Flags). A pick belongs to the tab whose menu offers it (Refunded is the Ended tab's, Team the
  // Active tab's): a hidden pick filters nothing.
  const scopeTeams = useMemo(() => (scope ? teams.filter(t => t.divisionId === scope) : []), [teams, scope]);
  const offer = useMemo(
    () => regFilterOffer(tab, { charges, payLinks: !!read?.payLinks, teamIds: scopeTeams.map(t => t.id) }),
    [tab, charges, read?.payLinks, scopeTeams],
  );
  const activePicks: RegFilterPicks = useMemo(() => {
    const only = (g: RegFilterGroup) => new Set([...picks[g]].filter(k => offer[g].includes(k)));
    return { team: only('team'), fee: only('fee'), flags: only('flags') };
  }, [picks, offer]);
  const filterOn = activePicks.team.size + activePicks.fee.size + activePicks.flags.size > 0;
  const searchedTab = useMemo(() => scoped.filter(r => regTab(r.status) === tab && matchesSearch(r, query)), [scoped, tab, query]);
  const tabRegs = useMemo(() => {
    const list = searchedTab.filter(r => !filterOn || matchesPicks(activePicks, r, fees.get(r.id)!.state, undefined, !!fees.get(r.id)!.chip));
    if (tab === 'waitlist') return list.sort((a, b) => (a.waitlistPosition ?? 9999) - (b.waitlistPosition ?? 9999));
    if (tab === 'ended') return list.sort((a, b) => Date.parse(b.endedAt ?? b.updatedAt) - Date.parse(a.endedAt ?? a.updatedAt));
    return list;
  }, [searchedTab, tab, filterOn, fees, activePicks]);

  const bulkKeys = useMemo(() => bulkActions(tab, rights, charges), [tab, rights, charges]);
  const selectable = bulkKeys.length > 0;
  const selectedRegs = useMemo(() => tabRegs.filter(r => selected.has(r.id)), [tabRegs, selected]);
  const searchField = useToolbarSearch({ value: query, onChange: q => { setQuery(q); setShown(PAGE); setSelected(new Set()); }, label: REGS_WORDS.search });

  const itemFor = useCallback((key: RowActionKey, reg: LeagueRegistration, fee: ReturnType<typeof feeCell>, division: string | null): MenuItem => {
    const M = REGS_WORDS.menu;
    // Three items word their hint from the row, and approve is the primary's word; every other item is its label and a fixed hint.
    switch (key) {
      case 'approve': return { key, label: REGS_WORDS.act.approve };
      case 'markReceived': {
        const balance = fee.state.kind === 'owing' || fee.state.kind === 'part' ? fee.state.owing : 0;
        return { key, label: M.markReceived.label, hint: M.markReceived.hint(formatLeagueMoney(balance)) };
      }
      case 'waitlist': return { key, label: M.waitlist.label, hint: M.waitlist.hint(playerName(reg)) };
      case 'promote': return { key, label: M.promote.label, hint: M.promote.hint(playerName(reg), division ?? REGS_WORDS.noDivision) };
      case 'payLink': return { key, label: M.payLink.label, hint: reg.payLinkSentAt ? M.payLink.hintSent(regDay(reg.payLinkSentAt, today)) : M.payLink.hint };
      case 'refundCard': return { key, label: M.refundCard.label, hint: M.refundCard.hint(formatLeagueMoney(read?.unrecordedCard?.[reg.id]?.[0]?.amount ?? 0)) };
      case 'refundAnotherWay': return { key, label: M.refundAnotherWay.label, hint: M.refundAnotherWay.hint(formatLeagueMoney(read?.returnedRefunds?.[reg.id]?.[0]?.amount ?? 0)) };
      case 'viewPayment': {
        const last = lastPayment(linesOf(reg.id));
        return { key, label: M.viewPayment.label, hint: last ? M.viewPayment.hint(regDay(last.day, today), howOf(last)) : undefined };
      }
      default: return { key, label: M[key].label, hint: M[key].hint };
    }
  }, [read, today, linesOf]);

  /** One registration as the list draws it. */
  const modelFor = useCallback((reg: LeagueRegistration): RegRowModel => {
    const fee = fees.get(reg.id)!;
    const division = divisionName(reg.divisionId);
    const team = teamName(reg.teamId);
    const ended = !isOpenReg(reg);
    const kind = endedKind(reg);
    const playerSub = ended && reg.endedAt
      ? REGS_WORDS.player[kind](regDay(reg.endedAt, today))
      : reg.source === 'admin_manual' ? REGS_WORDS.player.byHand(regDay(reg.registeredAt, today)) : REGS_WORDS.player.signedUp(regDay(reg.registeredAt, today));
    const asked = !ended && reg.withdrawRequestedAt ? REGS_WORDS.player.asked(regDay(reg.withdrawRequestedAt, today)) : null;
    const actions = rowActions(reg, fee.state, linesOf(reg.id), rights, read?.debits?.[reg.id]?.state === 'clearing');
    // 12b: a card payment that couldn't go on this row, or a card refund that came back — the desk's doors (any tab).
    // 12d-1 Part 3 (words §1.2): no refund to the card while a dispute on it is open (the record's block says why).
    if (rights.takeFees && read?.unrecordedCard?.[reg.id]?.length && !isDisputeOpen(read?.disputes?.[reg.id]?.status ?? '')) actions.all.push('refundCard');
    if (rights.takeFees && read?.returnedRefunds?.[reg.id]?.length) actions.all.push('refundAnotherWay');
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
      sheetSub: REGS_WORDS.sheetSub(division ?? REGS_WORDS.noDivision, fee.alert?.text ?? fee.chip?.text ?? fee.primary),
      note: notes[reg.id] ?? null,
    };
  }, [fees, divisionName, teamName, today, linesOf, rights, itemFor, busyIds, notes, read]);

  const rowModels = useMemo(() => tabRegs.slice(0, shown).map(modelFor), [tabRegs, shown, modelFor]);

  // ── Saying what happened ───────────────────────────────────────────────────────────────────────
  const say = (text: string) => setNotice(text);
  const markBusy = (ids: readonly string[], on: boolean) => setBusyIds(prev => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  });
  /** A press landed: read the registrations again, and the season too when `counts` (a division's room can have moved). */
  const afterWrite = (counts: boolean) => { void load({ season: counts, teams: false }); announceSeasonsChanged(); };
  const clearSelection = () => setSelected(new Set());
  const nameOf = (id: string) => { const r = regById.get(id); return r ? playerName(r) : ''; };

  /** A batch's result: a clean one fades, a partial one stays until dismissed and keeps its stayed rows ticked. */
  function present(r: { text: string; partial: boolean }, stayed: readonly string[], counts: boolean) {
    afterWrite(counts);
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
    afterWrite(true);
    say(BULK_WORDS.done[verb].clean(1));
  }

  async function runBulkStatus(verb: 'approve' | 'promote' | 'waitlist', ids: readonly string[]) {
    const rows = ids.map(id => regById.get(id)).filter((r): r is LeagueRegistration => !!r);
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
    present(bulkResult({ verb, ok, tally: tallyWhy(whys) }), stayed, true);
  }

  // ── Mark received ──────────────────────────────────────────────────────────────────────────────
  const receiveTargets = (ids: readonly string[]): ReceiveTarget[] => ids.flatMap(id => {
    const reg = regById.get(id);
    const fee = reg ? fees.get(reg.id) : undefined;
    if (!reg || !fee || (fee.state.kind !== 'owing' && fee.state.kind !== 'part')) return [];
    if (fee.chip) return []; // 12c Part 6: a bank debit on its way is the payment (words §3.2)
    const last = lastPayment(linesOf(reg.id));
    return [{
      reg, name: playerName(reg), division: divisionName(reg.divisionId) ?? REGS_WORDS.noDivision, owing: fee.state.owing,
      price: owesNow(reg, season!), received: receivedOf(linesOf(reg.id)), lastDay: last?.day ?? null,
    }];
  });

  const openReceive = (ids: string[]) => setAct({ kind: 'receive', ids, targets: receiveTargets(ids) });

  /** Why a ticked row was not part of a Mark received batch (copy §2.2). */
  function skipWhy(reg: LeagueRegistration): Why {
    const kind = fees.get(reg.id)?.state.kind;
    if (fees.get(reg.id)?.chip) return { key: 'clearing' };
    return kind === 'received' ? { key: 'received' } : kind === 'free' ? { key: 'free' }
      : kind === 'review' || kind === 'waitlist' ? { key: 'notAccepted' } : { key: 'ended' };
  }

  function finishReceive(out: ReceiveOutcome, requested: readonly string[]) {
    setAct(null);
    const whys: Why[] = [];
    const stayed: string[] = [];
    for (const id of requested) {
      const reg = regById.get(id);
      if (!reg || out.done.includes(id)) continue;
      const refused = out.refused.find(x => x.id === id);
      whys.push(refused ? whyOf(refused.refusal, { division: divisionName(reg.divisionId), free: owesNow(reg, season!) <= 0 }) : skipWhy(reg));
      stayed.push(id);
    }
    if (requested.length === 1 && out.done.length === 1) { afterWrite(false); say(out.said ?? RECV_WORDS.done(nameOf(requested[0]))); clearSelection(); return; }
    present(bulkResult({ verb: 'markReceived', ok: out.done.length, tally: tallyWhy(whys) }), stayed, false);
  }

  // ── Move ───────────────────────────────────────────────────────────────────────────────────────
  const moveTargets = (ids: readonly string[]): MoveTarget[] => ids.flatMap(id => {
    const reg = regById.get(id);
    return reg ? [{ reg, name: playerName(reg), from: divisionName(reg.divisionId), received: receivedOf(linesOf(reg.id)) }] : [];
  });

  function finishMove(out: MoveOutcome, requested: readonly string[]) {
    setAct(null);
    if (requested.length === 1 && out.done.length === 1) { afterWrite(true); say(MOVE_WORDS.done(playerName(out.done[0]), out.division)); clearSelection(); return; }
    present(bulkResult({ verb: 'move', ok: out.done.length, tally: out.tally, division: out.division, kept: out.kept }), out.stayed, true);
  }

  // ── Row and bulk actions ───────────────────────────────────────────────────────────────────────
  function pickRow(reg: LeagueRegistration, key: RowActionKey) {
    switch (key) {
      case 'approve': case 'promote': case 'waitlist': void statusOne(reg, key); break;
      case 'markReceived': openReceive([reg.id]); break;
      case 'move': setAct({ kind: 'move', ids: [reg.id], targets: moveTargets([reg.id]) }); break;
      case 'correct': setAct({ kind: 'price', id: reg.id }); break;
      case 'release': case 'withdraw': case 'decline': setAct({ kind: 'end', id: reg.id, mode: END_MODE[key] }); break;
      case 'email': setAct({ kind: 'email', ids: [reg.id] }); break;
      case 'undo': { const payment = lastPayment(linesOf(reg.id)); if (payment) setAct({ kind: 'undo', id: reg.id, payment }); break; }
      case 'payLink': void payLinkOne(reg); break;
      case 'refundCard': { const s = read?.unrecordedCard?.[reg.id]?.[0]; if (s) setCardAct({ op: 'refundCard', reg, id: s.itemId, amount: s.amount }); break; }
      case 'refundAnotherWay': { const r = read?.returnedRefunds?.[reg.id]?.[0]; if (r) setCardAct({ op: 'refundAnotherWay', reg, id: r.refundId, amount: r.amount }); break; }
      // 12c Part 7: the record, opened at its Fee (the payment and its refunds in one place, §0j).
      case 'viewPayment': setFeeFocus(reg.id); setOpenId(reg.id); break;
    }
  }

  // ── A card payment's two desk doors (12b copy §7) ───────────────────────────────────────────────
  const [cardAct, setCardAct] = useState<{ op: 'refundCard' | 'refundAnotherWay'; reg: LeagueRegistration; id: string; amount: number } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  async function runCardAct() {
    if (!cardAct || cardBusy) return;
    setCardBusy(true); setCardError('');
    const r = await patchRegistration(orgQuery, seasonId, cardAct.reg.id, { [cardAct.op]: cardAct.id });
    setCardBusy(false);
    if (!r.ok) { setCardError(r.error); return; }
    const amount = formatLeagueMoney(cardAct.amount);
    setCardAct(null);
    afterWrite(false);
    say(cardAct.op === 'refundCard' ? REGS_WORDS.refundCard.done(amount) : REGS_WORDS.refundAnotherWay.done(amount));
  }

  // 12c: the still-enrolled answers. Withdraw opens today's ending window carrying the Stripe refund (one email, with the
  // block); Email the pay link and Keep enrolled ask first (each emails the family), then answer on the refund.
  const [enrolledAct, setEnrolledAct] = useState<{ reg: LeagueRegistration; answer: 'link' | 'keep'; refund: CardRefund } | null>(null);
  if (linked && read && linkedAnswer && answered !== `${linked.id}:${linkedAnswer}`) {
    setAnswered(`${linked.id}:${linkedAnswer}`);
    const waitingRefunds = (read.cardRefunds?.[linked.id] ?? []).filter(awaitsAnswer);
    if (waitingRefunds.length && access?.takeFees) {
      if (linkedAnswer === 'withdraw') setAct({ kind: 'end', id: linked.id, mode: END_MODE.withdraw, stripeRefundIds: waitingRefunds.map(r => r.id) });
      else if (linkedAnswer === 'link' || linkedAnswer === 'keep') setEnrolledAct({ reg: linked, answer: linkedAnswer, refund: waitingRefunds[0] });
    }
  }
  // 12d-1 (words §2.3): "paid twice" (?at=card) opens at the refund to the card. For a share that never went on the
  // registration that is the refund window itself (the record's card block lists only refunds already made), once.
  const [cardLinked, setCardLinked] = useState<string | null>(null);
  if (linked && read && linkedAt === 'card' && cardLinked !== linked.id) {
    setCardLinked(linked.id);
    const share = read.unrecordedCard?.[linked.id]?.[0];
    if (share && access?.takeFees) setCardAct({ op: 'refundCard', reg: linked, id: share.itemId, amount: share.amount });
  }
  async function runEnrolled() {
    if (!enrolledAct) return;
    const { reg, answer, refund } = enrolledAct;
    const r = await patchRegistration(orgQuery, seasonId, reg.id, { enrolledAnswer: { refundId: refund.id, answer } });
    setEnrolledAct(null);
    if (!r.ok) { say(r.error); return; }
    afterWrite(false);
    const E = CARD_REFUND_WORDS.enrolled;
    say(answer === 'link' ? E.doneLink(reg.guardianEmail) : E.doneKeep(reg.playerFirstName, reg.guardianEmail));
  }

  /** 12c: the Fee cell's amber pill and the record's button open "Record the refund sent another way" (the desk's). */
  function openAnotherWay(reg: LeagueRegistration, refundId: string) {
    const r = refundsOf(reg.id).find(x => x.id === refundId);
    if (r && rights.takeFees) setCardAct({ op: 'refundAnotherWay', reg, id: r.id, amount: r.amount });
  }

  // ── The pay link (12b copy §5) ─────────────────────────────────────────────────────────────────
  async function payLinkOne(reg: LeagueRegistration) {
    markBusy([reg.id], true);
    const r = await patchRegistration(orgQuery, seasonId, reg.id, { payLink: true });
    markBusy([reg.id], false);
    if (!r.ok) { setNotes(n => ({ ...n, [reg.id]: { text: r.error } })); return; }
    afterWrite(false);
    say(REGS_WORDS.payLink.sent(reg.guardianEmail));
  }

  /** One email per family: a sign-up's siblings share one pay link. */
  async function runBulkPayLink(ids: readonly string[]) {
    const families = new Map<string, LeagueRegistration>();
    const skipped: string[] = [];
    let clearingSkipped = 0;
    let disputeSkipped = 0;
    for (const id of ids) {
      const reg = regById.get(id);
      if (!reg) continue;
      // 12c Part 6: a family whose debit is clearing has nothing to pay yet (words §3.2's skipped reason).
      if (fees.get(id)!.chip) { skipped.push(id); clearingSkipped += 1; continue; }
      if (!isOwing(fees.get(id)!.state)) { skipped.push(id); continue; }
      // 12d-1 Part 3 (words §1.5): a family that took its money back through its bank hears from a person, not a reminder.
      const lost = read?.disputes?.[id];
      if (lost?.status === 'lost' && lost.lostBookedAt) { skipped.push(id); disputeSkipped += 1; continue; }
      const key = reg.signupRef ?? reg.id;
      if (!families.has(key)) families.set(key, reg);
    }
    markBusy(ids, true);
    let sent = 0;
    const stayed: string[] = [...skipped];
    let failed = 0;
    for (const reg of families.values()) {
      const r = await patchRegistration(orgQuery, seasonId, reg.id, { payLink: true });
      if (r.ok) sent += 1; else { stayed.push(reg.id); failed += 1; }
    }
    markBusy(ids, false);
    const P = REGS_WORDS.payLink;
    present(stayed.length
      ? { text: P.bulkPartial(sent, stayed.length, failed ? P.failed : clearingSkipped === stayed.length ? P.clearingWhy
        : disputeSkipped === stayed.length ? DISPUTE_WORDS.bulkWhy : P.nothingOwed), partial: true }
      : { text: P.bulkDone(sent), partial: false }, stayed, false);
  }

  function runBulk(key: BulkKey) {
    const ids = selectedRegs.map(r => r.id);
    if (ids.length === 0) return;
    if (key === 'approve' || key === 'promote' || key === 'waitlist') { setAct({ kind: 'confirm', verb: key, ids }); return; }
    if (key === 'email') { setAct({ kind: 'email', ids }); return; }
    if (key === 'payLink') { void runBulkPayLink(ids); return; }
    if (key === 'move') { setAct({ kind: 'move', ids, targets: moveTargets(ids) }); return; }
    // Mark received: only the owing ones go to the window; the rest are said in the result.
    if (receiveTargets(ids).length === 0) { finishReceive({ done: [], refused: [] }, ids); return; }
    openReceive(ids);
  }

  // ── The record's neighbours ────────────────────────────────────────────────────────────────────
  const openReg = openId ? regById.get(openId) ?? null : null;
  const openAt = openId ? tabRegs.findIndex(r => r.id === openId) : -1;
  const stepTo = (r: LeagueRegistration): KitStep => ({ name: playerName(r), onStep: () => setOpenId(r.id) });
  const recordSteps = openAt >= 0 ? {
    prev: openAt > 0 ? stepTo(tabRegs[openAt - 1]) : null,
    next: openAt < tabRegs.length - 1 ? stepTo(tabRegs[openAt + 1]) : null,
    position: `${openAt + 1} of ${tabRegs.length}`,
  } : null;

  // ── Export ─────────────────────────────────────────────────────────────────────────────────────
  const exportRows: ExportRow[] = tabRegs.map(reg => {
    const f = fees.get(reg.id);
    return { reg, division: divisionName(reg.divisionId) ?? '', fee: f?.alert?.text ?? f?.chip?.text ?? f?.primary ?? '' };
  });
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

  if (orgLoading || !gate) return <PageLoading header={header} label={REGS_WORDS.loading} />;
  if (!gate.read) return <div className={repKit.page}>{header}<EmptyCard title={REGS_WORDS.noAccess} /></div>;
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

  // ── The Filter: Team · Fee · Flags, each choice counted given the other groups' ticks ──────────────────
  const filterCounts = regFilterCounts(searchedTab, r => fees.get(r.id)!.state, activePicks, offer, r => !!fees.get(r.id)?.chip);
  const W = REGS_WORDS;
  const optionWord: Record<RegFilterGroup, (k: string) => string> = {
    team: k => (k === NOT_PLACED ? W.notPlaced : scopeTeams.find(t => t.id === k)?.name ?? k),
    fee: k => (k === 'owing' ? W.filterOwing : k === 'received' ? W.filterReceived : W.filterRefunded),
    flags: k => (k === 'asked' ? W.filterAsked : k === 'late' ? W.filterLate(season.owingAmberDays)
      : k === 'noPayLink' ? W.filterNoPayLink : W.filterNotes),
  };
  const toggle = (g: RegFilterGroup, k: string) => {
    setPicks(prev => {
      const next = new Set(prev[g]);
      if (next.has(k)) next.delete(k); else next.add(k);
      return { ...prev, [g]: next };
    });
    setShown(PAGE); clearSelection();
  };
  const groups = (['team', 'fee', 'flags'] as const).map(g => ({
    key: g,
    label: g === 'team' ? W.filterTeam : g === 'fee' ? W.filterFee : W.filterFlags,
    note: g === 'team' && !scope ? W.filterPickDivision : undefined,
    options: offer[g].map(k => ({ key: k, label: optionWord[g](k), count: filterCounts[g].get(k) ?? 0 })),
    selected: [...activePicks[g]],
    onToggle: (k: string) => toggle(g, k),
  })).filter(g => g.options.length > 0);
  const resetFilter = () => { setPicks(NO_PICKS); setShown(PAGE); };

  // ── The empty states ───────────────────────────────────────────────────────────────────────────
  const E = REGS_WORDS.empty;
  const emptyCard = (() => {
    if (regs.length === 0) return <EmptyCard title={E.all.title}>{E.all.body}</EmptyCard>;
    if (query.trim()) return <EmptyCard title={E.search} />;
    if (filterOn) return <EmptyCard title={E.filter} action={<button type="button" className="btn btn-outline" onClick={resetFilter}>{REGS_WORDS.filterClear}</button>} />;
    const e = tab === 'review' ? (season.autoApproveUnderCapacity ? E.reviewAuto : E.review) : tab === 'active' ? E.active : tab === 'waitlist' ? E.waitlist : E.ended;
    return <EmptyCard title={e.title}>{e.body}</EmptyCard>;
  })();

  const raised = openId != null;
  const picked = selectedRegs.length;

  return (
    <div className={`${repKit.page} ${repKit.moneyFrame} ${css.screen}`} data-selecting={picked > 0 || undefined}>
      {header}
      <HubTabBar tabs={tabs} activeId={tab} ariaLabel={REGS_WORDS.tabsLabel} remeasureKey={`${counts.review}-${counts.active}-${counts.waitlist}-${counts.ended}`} />

      <div className={tb.toolbar}>
        <DivisionPicker
          divisions={[{ id: '', name: REGS_WORDS.scopeAll, waiting: 0 }, ...divisions.map(d => ({ id: d.id, name: d.name, waiting: reviewByDivision.get(d.id) ?? 0 }))]}
          value={scope}
          // Another division's teams are not this one's: a team tick goes, "Not placed" stays (a tick never hides out of reach).
          onChange={id => { setScope(id); setPicks(prev => ({ ...prev, team: new Set([...prev.team].filter(k => k === NOT_PLACED)) })); setShown(PAGE); clearSelection(); }}
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
      </div>
      {searchField.row}
      <FilterLine picks={pickedLabels(groups)} label={REGS_WORDS.filter} />

      {result && (
        <Callout tone="warn" role="status" action={<button type="button" className="btn btn-outline" onClick={() => setResult(null)}>{BULK_WORDS.dismiss}</button>}>
          <b>{result.text}</b>
          {result.stayed > 0 && <span className={css.resultSub}>{BULK_WORDS.stayed(result.stayed)}</span>}
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
            onAlert={rights.takeFees ? (row, id) => openAnotherWay(row.reg, id) : undefined}
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
          onNote={key => void statusOne(openReg, key)}
          onClose={() => { setOpenId(null); setFeeFocus(null); }}
          cardRefunds={refundsOf(openReg.id)}
          dispute={read?.disputes?.[openReg.id] ?? null}
          orgSlug={orgSlug}
          canDesk={rights.takeFees}
          isPhone={isPhone}
          focus={openReg.id === openedLink ? linkedAt : openReg.id === feeFocus ? 'fee' : null}
          onAnotherWay={id => openAnotherWay(openReg, id)}
        />
      )}

      {/* ── The windows (every one the kit's; raised over the record when it is open) ── */}
      {act?.kind === 'receive' && (
        <ReceiveWindow
          seasonName={season.name}
          targets={act.targets}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={out => finishReceive(out, act.ids)}
        />
      )}
      {act?.kind === 'end' && regById.has(act.id) && (
        <EndWindow
          reg={regById.get(act.id)!}
          name={nameOf(act.id)}
          mode={act.mode}
          division={divisionName(regById.get(act.id)!.divisionId) ?? REGS_WORDS.noDivision}
          regs={regs}
          lines={linesOf(act.id)}
          autoPromote={season.autoPromoteWaitlist}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          raised={raised}
          stripeRefundIds={act.stripeRefundIds}
          debit={read?.debits?.[act.id] ?? null}
          payoutsOn={!!read?.payLinks}
          canRefund={rights.takeFees}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={(done) => { setAct(null); afterWrite(true); say(done.said); setSelected(prev => { const n = new Set(prev); n.delete(act.id); return n; }); }}
        />
      )}
      {/* 12c: a still-enrolled child's answer — a question first, since it emails the family. */}
      {enrolledAct && (() => {
        const E = CARD_REFUND_WORDS.enrolled;
        const r = enrolledAct.refund;
        const first = enrolledAct.reg.playerFirstName;
        const go = enrolledAct.answer === 'link' ? E.link : E.keep(first);
        return (
          <ConfirmWindow
            title={go}
            body={E.body(formatLeagueMoney(r.amount), refundTarget(r), regDay(r.createdAt, today), first, formatLeagueMoney(r.amount - r.feeBack))}
            go={go}
            onClose={() => setEnrolledAct(null)}
            onConfirm={runEnrolled}
          />
        );
      })()}
      {/* 12c: "whose was it?" — a part refund made in Stripe on a payment for two or more children. */}
      {whoseOpen && (
        <WhoseWindow
          orgQuery={orgQuery}
          seasonId={seasonId}
          unassignedId={whoseOpen}
          onClose={() => setWhoseOpen(null)}
          onDone={said => { setWhoseOpen(null); afterWrite(false); say(said); }}
        />
      )}
      {act?.kind === 'price' && regById.has(act.id) && (() => {
        const reg = regById.get(act.id)!;
        const changes = changesByReg.get(reg.id) ?? [];
        const division = divisions.find(d => d.id === reg.divisionId);
        const early = division ? priceOn(division, season, orgDayKey(reg.registeredAt)) : null;
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
            onDone={said => { setAct(null); afterWrite(false); say(said); }}
          />
        );
      })()}
      {act?.kind === 'move' && (
        <MoveWindow
          season={season}
          divisions={divisions}
          targets={act.targets}
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
      {cardAct && (
        // 12b copy §7: a card payment that couldn't go on the row goes back to the card; a returned refund is recorded
        // as sent another way. Money out, so the press is confirmed.
        <KitDialog
          kind="question"
          title={cardAct.op === 'refundCard' ? REGS_WORDS.refundCard.title(playerName(cardAct.reg)) : REGS_WORDS.refundAnotherWay.title(playerName(cardAct.reg))}
          onClose={() => { if (!cardBusy) { setCardAct(null); setCardError(''); } }}
          busy={cardBusy}
          footer={(
            <>
              <DialogCancel>Cancel</DialogCancel>
              <button type="button" className="btn btn-lime" onClick={() => void runCardAct()} disabled={cardBusy}>
                {cardBusy
                  ? (cardAct.op === 'refundCard' ? REGS_WORDS.refundCard.working : REGS_WORDS.refundAnotherWay.working)
                  : (cardAct.op === 'refundCard' ? REGS_WORDS.refundCard.submit(formatLeagueMoney(cardAct.amount)) : REGS_WORDS.refundAnotherWay.submit)}
              </button>
            </>
          )}
        >
          <p>{cardAct.op === 'refundCard' ? REGS_WORDS.refundCard.body(formatLeagueMoney(cardAct.amount)) : REGS_WORDS.refundAnotherWay.body(formatLeagueMoney(cardAct.amount))}</p>
          {cardAct.op === 'refundCard' && cardAct.reg.status === 'declined' && <p>{REGS_WORDS.refundCard.fee}</p>}
          {cardError && <p role="alert">{cardError}</p>}
        </KitDialog>
      )}
      {act?.kind === 'undo' && (
        <UndoWindow
          regId={act.id}
          name={nameOf(act.id)}
          payment={act.payment}
          gone={!linesOf(act.id).some(l => l.id === act.payment.id && l.status === 'posted')}
          today={today}
          orgQuery={orgQuery}
          seasonId={seasonId}
          onClose={() => setAct(null)}
          onChanged={() => void load()}
          onDone={said => { setAct(null); afterWrite(false); say(said); }}
        />
      )}
      {act?.kind === 'email' && (
        // The club's one email window, opened from this season: the bulk bar sends to the ticked families, a row's ⋯ to one
        // family (which never counts toward the season's three). The whole season is emailed from the season's Email families page.
        <EmailFamiliesWindow
          q={orgQuery.slice(1)}
          season={{
            id: seasonId, name: season.name, ticked: act.ids,
            registrationsHref: base, teamsHref: `/${orgSlug}/admin/house-league/seasons/${seasonId}/teams`,
          }}
          onClose={() => setAct(null)}
          onShowNoFamily={() => setAct(null)}
          onSent={said => { setAct(null); say(said); clearSelection(); }}
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
          onAdded={said => { setAct(null); afterWrite(true); say(said); }}
        />
      )}

      {notice && <NoticePill key={notice} message={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}
