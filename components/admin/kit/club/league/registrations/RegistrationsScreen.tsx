'use client';
/**
 * A HOUSE-LEAGUE SEASON'S REGISTRATIONS, ON THE CLUB KIT (Club Tier Stage 9b-2, Part 3; copy HOUSE_LEAGUE_STAGE9B2_COPY.md
 * §1–§9; drawings HOUSE_LEAGUE_STAGE9B_DRAWINGS.html b2 §1–§3). The page that was 1,157 lines of old look and hand-rolled
 * modals, rebuilt once:
 *
 *   the head      — "Registrations" under the season's name, + Add registration (absent on a finished season);
 *   the tabs      — To review (the amber count) · Active · Waitlist · Ended, in the address (`?tab=`), and Friend requests
 *                   (Board Ready Stage 1 Part 2, drawing tab 4: its own amber count; absent at None or off the plan);
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
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { kitCountText } from '@/lib/admin-kit-nav';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import AnswerColumnsWindow from './AnswerColumnsWindow';
import RecordFormSections from './RecordFormSections';
import { ANSWER_COLUMNS_MAX, STAFF_FORM_WORDS, gridCellText, type SeasonAnswerGrid, type StaffFormGrid } from '@/lib/club-form-staff-words';
import { toggleKey } from '@/lib/toggle-key';
import { announceSeasonsChanged, useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import KitDialog, { DialogCancel, type KitStep } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { Callout, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { NotYours } from '../../NotYours';
import { moneyFetch } from '../../money/MoneyKit';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
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
import { clearingShareCents, isClearing } from '@/lib/league-debits';
import {
  bulkActions, bulkResult, endedKind, feeCell, isOpenReg, matchesPicks, matchesSearch, owesNow, phoneDetail, playerName, guardianName,
  priceOn, REG_TABS, regDay, regTab, regFilterCounts, regFilterOffer, rowActions, seasonHasFees, signupChildren, tallyWhy, whyOf, isRegTab,
  NO_PICKS, NOT_PLACED,
  type BulkKey, type PriceChange, type RegFilterGroup, type RegFilterPicks, type RegRights, type RegTab, type RegsDivision, type RegsRead, type RegsSeason,
  type RowActionKey, type Why, howOf,
} from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import { joinWithAnd } from '@/lib/utils';
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
import { blocksRefund } from '@/lib/online-payment-dispute';
import { DISPUTE_WORDS } from '@/lib/online-payment-words';
import RegistrationsList, { type RegRowModel, type RowNote } from './RegistrationsList';
import UndoWindow from './UndoWindow';
import WhoseWindow from './WhoseWindow';
import type { MenuItem } from './RowMenu';
import { exportCsv, exportPdf, exportXlsx, type ExportRow } from './registrationsExport';
import FriendRequestsView from './FriendRequestsView';
import { askedText, buildQueue, friendTallies, honouredText, requestLines, toConfirmCount, FRIEND_QUEUE_WORDS, type FriendPlacement, type FriendsRead } from '@/lib/league-friend-queue';
import { divisionDrafted, friendResult, FRIEND_RESULT_WORDS } from '@/lib/league-friend-draft';
import css from './Registrations.module.css';
import { useSeasonEmailOpen } from '@/components/admin/kit/useCommunicationsFacts';

/** A list longer than this draws its first rows and "… n more". */
const PAGE = 50;
/** The Filter's Documents group (drawing tab 6 · A): its one row is Needs a new tick. */
const DOCS_KEY = 'documents';
const DOCS_NEEDS = 'needsTick';

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
  | { kind: 'payLinkAnyway'; reg: LeagueRegistration }
  | { kind: 'newLink'; reg: LeagueRegistration }
  | { kind: 'add' };

interface TeamLite { id: string; name: string; divisionId: string }

/** The first names on a registration's sign-up, for "Send a new link" (the menu hint and the confirm name the same children). */
function signupKids(reg: LeagueRegistration, all: readonly LeagueRegistration[]) {
  const kids = signupChildren(reg, all);
  return { names: joinWithAnd(kids.map(k => k.playerFirstName)), many: kids.length > 1 };
}

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
  const router = useRouter();
  const base = `/${orgSlug}/admin/house-league/seasons/${seasonId}/registrations`;

  const [season, setSeason] = useState<RegsSeason | null>(null);
  const [divisions, setDivisions] = useState<RegsDivision[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [read, setRead] = useState<RegsRead | null>(null);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  // Board Ready Stage 1 Part 2: the season's friend requests (A11: read behind the same check as the list).
  const [friends, setFriends] = useState<FriendsRead | null>(null);

  // Who may (the one house-league gate): a finished season locks the registrations and keeps the fee (Q16).
  // Reading comes from the member alone (so the first read can start); every control comes from the SEASON-AWARE answer,
  // null until the season has loaded, so nothing writable paints before the page knows the season is finished (Q16).
  const gate = useHouseLeagueAccess();
  const access = useSeasonAccess(season);
  const emailOpen = useSeasonEmailOpen();

  const [scope, setScope] = useState('');
  const [query, setQuery] = useState('');
  // 13e-3: Money's "Open on Registrations" arrives with Fee: Owing on (`?tab=active&fee=owing`) — the one Fee pick a link
  // can set (Registrations' link vocabulary is not widened past it). Read once, on arrival.
  const [picks, setPicks] = useState<RegFilterPicks>(() => (search.get('fee') === 'owing' ? { ...NO_PICKS, fee: new Set(['owing']) } : NO_PICKS));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [act, setAct] = useState<Act | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; stayed: number } | null>(null);
  const [landed, setLanded] = useState<RegTab | null>(null);
  // Board Ready Stage 4 Part 3 (ruling 11): the Filter's answer groups (a question's choices; Documents › Needs a new tick),
  // and the Answer columns window (the person's columns ride the read; a save writes them into it).
  const [answerPicks, setAnswerPicks] = useState<Record<string, ReadonlySet<string>>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);

  const beginRead = useLatestRead();
  // The first read (and a retry) reads everything. A reload after a press reads the registrations, and the season only when
  // that press can have moved a division's counts (a Move, a status change or ending, an add); the teams never change here.
  const load = useCallback(async ({ season: withSeason = true, teams: withTeams = true }: LoadScope = {}) => {
    if (!orgSlug || !seasonId) return;
    const current = beginRead();
    const [seasonRes, regsRes, teamsRes, friendsRes] = await Promise.all([
      withSeason ? moneyFetch<{ season?: RegsSeason & Record<string, unknown>; divisions?: RegsDivision[] }>(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`).catch(() => null) : null,
      moneyFetch<RegsRead>(`/api/admin/house-league/seasons/${seasonId}/registrations${orgQuery}`).catch(() => null),
      withTeams ? moneyFetch<{ teams?: TeamLite[] }>(`/api/admin/house-league/seasons/${seasonId}/teams${orgQuery}`).catch(() => null) : null,
      moneyFetch<FriendsRead>(`/api/admin/house-league/seasons/${seasonId}/friends${orgQuery}`).catch(() => null),
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
    // An extra never takes the list down: a failed friends read keeps the last one (or none).
    if (friendsRes?.ok) setFriends({ on: !!friendsRes.data.on, requests: friendsRes.data.requests ?? [], placement: friendsRes.data.placement ?? {} });
    if (withTeams) setTeams((teamsRes?.ok ? teamsRes.data.teams ?? [] : []).map(t => ({ id: t.id, name: t.name, divisionId: t.divisionId })));
    setRead({
      registrations: regsRes.data.registrations ?? [], money: regsRes.data.money ?? {},
      priceChanges: regsRes.data.priceChanges ?? [], today: regsRes.data.today, payLinks: !!regsRes.data.payLinks, payoutsOn: !!regsRes.data.payoutsOn,
      unrecordedCard: regsRes.data.unrecordedCard ?? {}, returnedRefunds: regsRes.data.returnedRefunds ?? {},
      cardRefunds: regsRes.data.cardRefunds ?? {}, notMatched: regsRes.data.notMatched ?? {}, debits: regsRes.data.debits ?? {},
      disputes: regsRes.data.disputes ?? {},
      form: regsRes.data.form ?? null,
    });
    setFailed(null);
  }, [orgSlug, seasonId, orgQuery, beginRead]);
  useDeferredLoad(!orgLoading && !!orgSlug && !!gate?.read, load);

  // ── Derived ────────────────────────────────────────────────────────────────────────────────────
  const regs = useMemo(() => read?.registrations ?? [], [read]);
  const regById = useMemo(() => new Map(regs.map(r => [r.id, r])), [regs]);
  const friendsOn = !!friends?.on;
  const queue = useMemo(() => (friends?.on ? buildQueue(friends.requests, regs) : []), [friends, regs]);
  const tallies = useMemo(() => (friends?.on ? friendTallies(friends.requests, regs, queue) : new Map<string, { asked: number; honoured: number | null }>()), [friends, regs, queue]);
  const hasFriend = useCallback((r: LeagueRegistration) => (tallies.get(r.id)?.asked ?? 0) > 0, [tallies]);
  const placement = useMemo<FriendPlacement>(() => friends?.placement ?? {}, [friends]);
  const today = read?.today ?? '';
  const rights: RegRights = useMemo(() => ({
    // Email needs the Communications switch too (Club Communications ask 5: off = no group email from any screen).
    register: !!access?.register, takeFees: !!access?.takeFees, run: !!access?.run, email: !!access?.email && emailOpen,
    payLinks: !!read?.payLinks,
  }), [access, read?.payLinks, emailOpen]);
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

  /**
   * The record's Friend requests section (Part 3, tab 6): what this child's family asked, each with its result once the
   * division has drafted (its queue state before), and the families who asked for this child (a confirmed or code match
   * only: a name suggestion is not a fact). Absent when there is nothing on either side.
   */
  function friendRecord(reg: LeagueRegistration) {
    if (!friendsOn) return null;
    const R = FRIEND_RESULT_WORDS;
    const all = requestLines(queue);
    const drafted = divisionDrafted(reg.divisionId, regs, placement);
    const asked = all.filter(l => l.asker.id === reg.id).map(line => {
      const { q, match } = line;
      const named = match && (line.confirmed || q.matchedRegistrationId) ? playerName(match) : '—';
      const parent = q.typedParent ? ` ${R.record.parent(q.typedParent)}` : '';
      let state: string;
      if (drafted) {
        const res = friendResult(line, { placement, teamName, day: v => regDay(v, today) });
        state = `${res.honoured ? FRIEND_QUEUE_WORDS.honoured : FRIEND_QUEUE_WORDS.notHonoured} · ${res.why}`;
      } else {
        state = q.state === 'not_signed_up' ? FRIEND_QUEUE_WORDS.notSignedUpWord
          : q.state === 'cant_honour' ? FRIEND_QUEUE_WORDS.cantHonourWord(q.reason, q.note)
            : line.confirmed ? R.record.confirmed : R.record.toConfirm;
      }
      return `${askedText(q)}${parent} → ${named} · ${state}`;
    });
    const askedFor = all
      .filter(l => l.asker.id !== reg.id && l.match?.id === reg.id && (l.confirmed || !!l.q.matchedRegistrationId))
      .map(l => R.record.family(playerName(l.asker)));
    if (asked.length === 0 && askedFor.length === 0) return null;
    return {
      asked,
      askedFor: [...new Set(askedFor)],
      onOpen: () => { setOpenId(null); setScope(reg.divisionId ?? ''); router.push(`${base}?tab=friends`, { scroll: false }); },
    };
  }

  const scoped = useMemo(() => (scope ? regs.filter(r => r.divisionId === scope) : regs), [regs, scope]);
  const counts = useMemo(() => {
    const c: Record<RegTab, number> = { review: 0, active: 0, waitlist: 0, ended: 0 };
    for (const r of scoped) c[regTab(r.status)] += 1;
    return c;
  }, [scoped]);
  // F-R5-1 (13e, drawing tab 3 note 3): while a search is typed, each view's count is its matches — the match shows on its
  // tab before anyone taps. Never one list across views: their rows carry different buttons (Approve is To review's).
  const searching = query.trim().length > 0;
  // The search runs once over the scoped list; each view's matches and the open view's rows are both read from it.
  const matched = useMemo(() => (searching ? scoped.filter(r => matchesSearch(r, query)) : scoped), [scoped, query, searching]);
  const matchCounts = useMemo(() => {
    const c: Record<RegTab, number> = { review: 0, active: 0, waitlist: 0, ended: 0 };
    if (searching) for (const r of matched) c[regTab(r.status)] += 1;
    return c;
  }, [matched, searching]);
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
  // The fifth view is not a registration status: it is its own address, and absent when the season asks for no friends.
  const friendsView = friendsOn && asked === 'friends';
  const [seenFriends, setSeenFriends] = useState(friendsView);
  if (seenFriends !== friendsView) { setSeenFriends(friendsView); setSelected(new Set()); setShown(PAGE); setNotes({}); }
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
  // ⚖ 13e-3: what of each child's fee is clearing — the same reading Money's Still owing takes (`clearingShareCents`), so
  // Fee: Owing keeps a child with part of the fee clearing, owing the rest, as Money does.
  const clearingOf = useCallback((r: LeagueRegistration) => clearingShareCents(read?.debits?.[r.id]), [read]);

  // ── The sign-up form's answers (Board Ready Stage 4 Part 3; drawing tab 6 · A) ─────────────────────────
  // The read never holds a health question; only live questions are columns or filters, and only ones with choices filter.
  const form: StaffFormGrid | null = read?.form ?? null;
  const needsTickIds = useMemo(() => new Set(form?.needsTick ?? []), [form]);
  const liveQs = useMemo(() => (form?.questions ?? []).filter(q => !q.archived && !q.health), [form]);
  const filterQs = useMemo(() => liveQs.filter(q => q.choices.length > 0), [liveQs]);
  const columnQs = useMemo(() => (form?.columns ?? [])
    .flatMap(id => liveQs.filter(q => q.id === id)).slice(0, ANSWER_COLUMNS_MAX), [form, liveQs]);
  const answerOf = useCallback((regId: string, qid: string) => form?.cells[regId]?.[qid], [form]);
  /** A registration passes the answer groups (any ticked choice within a group; every group), leaving out `except`. */
  const answerMatch = useCallback((regId: string, except?: string) => Object.entries(answerPicks).every(([key, set]) => {
    if (key === except || set.size === 0) return true;
    if (key === DOCS_KEY) return needsTickIds.has(regId);
    const q = filterQs.find(x => x.id === key);
    if (!q) return true; // a question the club archived since: its pick filters nothing
    const live = [...set].filter(id => q.choices.some(c => c.id === id)); // a removed choice's pick, likewise
    if (live.length === 0) return true;
    const c = answerOf(regId, key);
    return c?.state === 'answered' && c.choiceIds.some(id => live.includes(id));
  }), [answerPicks, needsTickIds, filterQs, answerOf]);
  const answerPicksOn = Object.entries(answerPicks).some(([key, set]) => set.size > 0
    && (key === DOCS_KEY || filterQs.some(q => q.id === key && q.choices.some(c => set.has(c.id)))));

  // The Filter (Team · Fee · Flags). A pick belongs to the tab whose menu offers it (Refunded is the Ended tab's, Team the
  // Active tab's): a hidden pick filters nothing.
  const scopeTeams = useMemo(() => (scope ? teams.filter(t => t.divisionId === scope) : []), [teams, scope]);
  const offer = useMemo(
    () => regFilterOffer(tab, { charges, payLinks: !!read?.payLinks, teamIds: scopeTeams.map(t => t.id), friends: friendsOn }),
    [tab, charges, read?.payLinks, scopeTeams, friendsOn],
  );
  const activePicks: RegFilterPicks = useMemo(() => {
    const only = (g: RegFilterGroup) => new Set([...picks[g]].filter(k => offer[g].includes(k)));
    return { team: only('team'), fee: only('fee'), flags: only('flags') };
  }, [picks, offer]);
  const basePicksOn = activePicks.team.size + activePicks.fee.size + activePicks.flags.size > 0;
  const filterOn = basePicksOn || answerPicksOn;
  const searchedTab = useMemo(() => matched.filter(r => regTab(r.status) === tab), [matched, tab]);
  // The shipped picks once; the answer groups narrow that, and count their choices over it (Stage 4 Part 3).
  const baseMatched = useMemo(
    () => searchedTab.filter(r => !basePicksOn || matchesPicks(activePicks, r, fees.get(r.id)!.state, undefined, clearingOf(r), hasFriend(r))),
    [searchedTab, basePicksOn, activePicks, fees, clearingOf, hasFriend],
  );
  const tabRegs = useMemo(() => {
    const list = baseMatched.filter(r => answerMatch(r.id));
    if (tab === 'waitlist') return list.sort((a, b) => (a.waitlistPosition ?? 9999) - (b.waitlistPosition ?? 9999));
    if (tab === 'ended') return list.sort((a, b) => Date.parse(b.endedAt ?? b.updatedAt) - Date.parse(a.endedAt ?? a.updatedAt));
    return list;
  }, [baseMatched, tab, answerMatch]);

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
      case 'newLink': return { key, label: M.newLink.label, hint: M.newLink.hint(signupKids(reg, read?.registrations ?? []).names) };
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
    const actions = rowActions(reg, fee.state, linesOf(reg.id), rights, isClearing(read?.debits?.[reg.id]));
    // 12b: a card payment that couldn't go on this row, or a card refund that came back — the desk's doors (any tab).
    // 12d-1 Part 3 (words §1.2): no refund to the card while a dispute on it is open (the record's block says why).
    if (rights.takeFees && read?.unrecordedCard?.[reg.id]?.length && !blocksRefund(read?.disputes?.[reg.id]?.status ?? '')) actions.all.push('refundCard');
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
      // Stage 4 Part 3: the chosen answer columns ("Not asked", never a blank) and the amber Needs a new tick.
      answers: columnQs.map(q => gridCellText(form, reg.id, q)),
      needsTick: needsTickIds.has(reg.id),
    };
  }, [fees, divisionName, teamName, today, linesOf, rights, itemFor, busyIds, notes, read, columnQs, form, needsTickIds]);

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
      case 'newLink': setAct({ kind: 'newLink', reg }); break;
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
  async function payLinkOne(reg: LeagueRegistration, despiteLostDispute = false) {
    markBusy([reg.id], true);
    const r = await patchRegistration(orgQuery, seasonId, reg.id, despiteLostDispute ? { payLink: true, despiteLostDispute } : { payLink: true });
    markBusy([reg.id], false);
    // 12d-1 ruling 5: after a lost card dispute (this child's or a sibling's, the server's answer) the send asks first.
    if (!r.ok && r.code === 'dispute_lost_ask') { setAct({ kind: 'payLinkAnyway', reg }); return; }
    if (!r.ok) { setNotes(n => ({ ...n, [reg.id]: { text: r.error } })); return; }
    afterWrite(false);
    say(REGS_WORDS.payLink.sent(reg.guardianEmail));
  }

  // ── A new family link (Signed-in family accounts Stage 1, drawing tab 4): the confirm names the children it covers ──
  async function runNewLink(reg: LeagueRegistration) {
    const r = await patchRegistration(orgQuery, seasonId, reg.id, { newLink: true });
    setAct(null);
    if (!r.ok) { setNotes(n => ({ ...n, [reg.id]: { text: r.error } })); return; }
    afterWrite(false);
    say(REGS_WORDS.newLink.sent(reg.guardianEmail));
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
      const r = await patchRegistration(orgQuery, seasonId, reg.id, { payLink: true, bulk: true });
      if (r.ok) sent += 1;
      else if (r.code === 'dispute_lost') { stayed.push(reg.id); disputeSkipped += 1; } // a lost sibling (12d-1 Part 4)
      else { stayed.push(reg.id); failed += 1; }
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
  // Stage 4 Part 3 (ruling 13): a column per question the read holds (never a health one in the list's read), in the
  // form's order; an archived question reads "{label} (no longer asked)".
  const answerColsOf = (g: SeasonAnswerGrid | null) => (g?.questions ?? []).map(q => ({
    id: q.id, health: q.health, type: q.type, label: q.archived ? STAFF_FORM_WORDS.noLongerAskedHeader(q.label) : q.label,
  }));
  const answersFor = (g: SeasonAnswerGrid | null, cols: ReturnType<typeof answerColsOf>, regId: string) =>
    Object.fromEntries(cols.map(c => [c.id, gridCellText(g, regId, c).text]));
  const answerCols = answerColsOf(form);
  const exportRows: ExportRow[] = tabRegs.map(reg => {
    const f = fees.get(reg.id);
    const t = tallies.get(reg.id);
    return {
      reg, division: divisionName(reg.divisionId) ?? '', fee: f?.alert?.text ?? f?.chip?.text ?? f?.primary ?? '',
      // Board Ready Stage 1 Part 2 (tab 7): two name-free columns, only on a season that takes friend requests.
      ...(friendsOn ? { friends: { requests: t?.asked ?? 0, honoured: honouredText(t) } } : {}),
      ...(form ? { answers: answersFor(form, answerCols, reg.id) } : {}),
    };
  });
  // "Excel with contact details and health answers": the health answers are read from the server only now (the list never
  // holds them), for the rows the screen shows. The server records the read in the club's audit log.
  const exportWithHealth = async () => {
    const r = await moneyFetch<{ form: SeasonAnswerGrid | null }>(`/api/admin/house-league/seasons/${seasonId}/registrations/answers${orgQuery}`).catch(() => null);
    if (!r?.ok) { setNotice(STAFF_FORM_WORDS.healthExportFailed); return; }
    const full = r.data.form;
    const cols = answerColsOf(full);
    await exportXlsx(exportRows.map(row => ({ ...row, answers: answersFor(full, cols, row.reg.id) })), currentOrg?.slug, tab, true, cols, true);
  };

  // ── The header ─────────────────────────────────────────────────────────────────────────────────
  // ⚖ None of its own (Club Tier Stage 13i, A4): Registrations is a tab of its season, whose frame draws the one header
  // ("← Seasons", the season's name and its switch, the status chip) and the season's tab row above it. Add registration
  // is the toolbar's last control (the 2026-10-17 toolbar rule: a create at the right end).
  if (orgLoading || !gate) return <PageLoading label={REGS_WORDS.loading} />;
  if (!gate.read) return <NotYours page="houseLeague" />;
  if (!read && !failed) return <PageLoading label={REGS_WORDS.loading} />;
  if (failed || !season || !read) {
    return (
      <div className={repKit.page}>
        <LoadFailed title={REGS_WORDS.failed} onRetry={() => { setFailed(null); void load(); }} />
      </div>
    );
  }

  // ── The views ──────────────────────────────────────────────────────────────────────────────────
  // ⚖ THE VIEW IS THE OLIVE "VIEW" PILL, NOT A SWITCH (owner 2026-11-18, option D of REGISTRATIONS_TOOLBAR_OPTIONS.html;
  // it supersedes the 2026-11-06 Ask 6 switch). To review · Active · Waitlist · Ended · Friend requests are five views of
  // one list, and the written rule (2026-10-10, ONE CALENDAR) is a switch for up to three views, the olive View pill for
  // four or more. The five-view switch was also the widest thing on the line (~473px), which pushed Export and Add
  // registration onto a second line on a laptop. Each view keeps its own address (`?tab=`), so Back, a bookmark and a
  // notification's link land on the same view.
  // THE QUEUE STAYS ON THE FACE: To review's amber count rides beside whichever view is chosen (`pillMark` on every
  // option), so the number people act on is never hidden behind a closed menu. In the menu To review and Friend requests
  // carry their amber count at the row's end (`detail`), the others the quiet one. A zero is not drawn.
  // Board Ready Stage 1 Part 2 (A13): Friend requests carries its own amber count (the rows still to confirm, in the
  // division picked, as the other counts are). Absent at None or off the plan.
  const friendsWaiting = toConfirmCount(scope ? queue.filter(r => r.asker.divisionId === scope) : queue);
  const reviewChip = (n: number) => <span className={frame.count} aria-label={REGS_WORDS.reviewAria(n)}>{kitCountText(n)}</span>;
  const queueMark = !searching && counts.review > 0 ? reviewChip(counts.review) : undefined;
  const viewOptions = [
    ...REG_TABS.map(id => ({
      id,
      label: REGS_WORDS.tab[id],
      detail: searching
        ? <span aria-label={REGS_WORDS.matchesAria(matchCounts[id])}>{matchCounts[id]}</span>
        : counts[id] > 0 ? (id === 'review' ? reviewChip(counts[id]) : String(counts[id])) : undefined,
      pillMark: searching
        ? <span className={css.tabCount} aria-label={REGS_WORDS.matchesAria(matchCounts[id])}>{matchCounts[id]}</span>
        : queueMark,
    })),
    ...(friendsOn ? [{
      id: 'friends',
      label: FRIEND_QUEUE_WORDS.view,
      detail: friendsWaiting > 0 ? <span className={frame.count} aria-label={FRIEND_QUEUE_WORDS.viewAria(friendsWaiting)}>{kitCountText(friendsWaiting)}</span> : undefined,
      pillMark: searching ? undefined : queueMark,
    }] : []),
  ];
  const viewPill = (
    <SingleSelectDropdown
      lead
      label={REGS_WORDS.viewLabel}
      options={viewOptions}
      value={friendsView ? 'friends' : tab}
      onChange={id => router.push(`${base}?tab=${id}`, { scroll: false })}
    />
  );

  if (friendsView) {
    return (
      <div className={`${repKit.page} ${repKit.moneyFrame} ${css.screen}`} data-fills-when-folded>
        <FriendRequestsView
          viewPill={viewPill}
          rows={queue}
          divisions={divisions}
          scope={scope}
          onScope={setScope}
          regs={regs}
          placement={placement}
          divisionName={divisionName}
          teamName={teamName}
          today={today}
          canDecide={!!access?.register}
          isPhone={isPhone}
          orgQuery={orgQuery}
          seasonId={seasonId}
          orgSlug={orgSlug}
          planId={currentOrg?.planId}
          onChanged={() => load({ season: false, teams: false })}
          // The child's record, on the child's own view (opened here, not through the one-time ?reg= link, which opens a
          // child once per visit: /review 2026-11-11).
          onOpenRegistration={id => { const r = regById.get(id); if (!r) return; setOpenId(id); router.push(`${base}?tab=${regTab(r.status)}`, { scroll: false }); }}
          say={say}
        />
        {notice && <NoticePill key={notice} message={notice} onDone={() => setNotice(null)} />}
      </div>
    );
  }

  // ── The Filter: Team · Fee · Flags, each choice counted given the other groups' ticks ──────────────────
  const filterCounts = regFilterCounts(searchedTab.filter(r => answerMatch(r.id)), r => fees.get(r.id)!.state, activePicks, offer, clearingOf, hasFriend);
  const W = REGS_WORDS;
  const optionWord: Record<RegFilterGroup, (k: string) => string> = {
    team: k => (k === NOT_PLACED ? W.notPlaced : scopeTeams.find(t => t.id === k)?.name ?? k),
    fee: k => (k === 'owing' ? W.filterOwing : k === 'received' ? W.filterReceived : W.filterRefunded),
    flags: k => (k === 'asked' ? W.filterAsked : k === 'late' ? W.filterLate(season.owingAmberDays)
      : k === 'noPayLink' ? W.filterNoPayLink : k === 'friend' ? FRIEND_QUEUE_WORDS.flag : W.filterNotes),
  };
  const toggle = (g: RegFilterGroup, k: string) => {
    setPicks(prev => {
      const next = new Set(prev[g]);
      if (next.has(k)) next.delete(k); else next.add(k);
      return { ...prev, [g]: next };
    });
    setShown(PAGE); clearSelection();
  };
  const baseGroups = (['team', 'fee', 'flags'] as const).map(g => ({
    key: g,
    label: g === 'team' ? W.filterTeam : g === 'fee' ? W.filterFee : W.filterFlags,
    note: g === 'team' && !scope ? W.filterPickDivision : undefined,
    options: offer[g].map(k => ({ key: k, label: optionWord[g](k), count: filterCounts[g].get(k) ?? 0 })),
    selected: [...activePicks[g]],
    onToggle: (k: string) => toggle(g, k),
  })).filter(g => g.options.length > 0);
  // Stage 4 Part 3 (drawing tab 6 · A): one group per question with choices, then Documents › Needs a new tick. Each choice
  // is counted given every other group's ticks, as the shipped groups are. Health questions never reach this read.
  const answerBase = baseMatched;
  const toggleAnswer = (key: string, k: string) => {
    setAnswerPicks(prev => ({ ...prev, [key]: toggleKey(prev[key] ?? new Set<string>(), k) }));
    setShown(PAGE); clearSelection();
  };
  const answerGroups = [
    ...filterQs.map(q => {
      const among = answerBase.filter(r => answerMatch(r.id, q.id));
      return {
        key: `q:${q.id}`, label: q.label,
        options: q.choices.map(c => ({
          key: c.id, label: c.label,
          count: among.filter(r => { const x = answerOf(r.id, q.id); return x?.state === 'answered' && x.choiceIds.includes(c.id); }).length,
        })),
        selected: [...(answerPicks[q.id] ?? [])],
        onToggle: (k: string) => toggleAnswer(q.id, k),
      };
    }),
    ...(form && (needsTickIds.size > 0 || (answerPicks[DOCS_KEY]?.size ?? 0) > 0) ? [{
      key: DOCS_KEY, label: STAFF_FORM_WORDS.documentsGroup,
      options: [{ key: DOCS_NEEDS, label: STAFF_FORM_WORDS.needsNewTick, count: answerBase.filter(r => answerMatch(r.id, DOCS_KEY) && needsTickIds.has(r.id)).length }],
      selected: [...(answerPicks[DOCS_KEY] ?? [])],
      onToggle: (k: string) => toggleAnswer(DOCS_KEY, k),
    }] : []),
  ];
  const groups = [...baseGroups, ...answerGroups];
  const resetFilter = () => { setPicks(NO_PICKS); setAnswerPicks({}); setShown(PAGE); };

  // ── The empty states ───────────────────────────────────────────────────────────────────────────
  const E = REGS_WORDS.empty;
  const emptyCard = (() => {
    if (regs.length === 0) return <EmptyCard title={E.all.title}>{E.all.body}</EmptyCard>;
    if (searching) {
      // 13e (drawing tab 3 note 4): a miss on this view names the view that has the child, and goes there keeping the search.
      const elsewhere = searchedTab.length === 0 ? REG_TABS.filter(id => id !== tab && matchCounts[id] > 0) : [];
      if (elsewhere.length === 0) return <EmptyCard title={E.search} />;
      const go = elsewhere[0];
      // The count is the search's matches, so the button clears the Filter as it goes: a pick kept from here (Fee: Owing,
      // from Money's "Open on Registrations") would hide the very child it promises on a view whose children cannot owe.
      const showIn = () => { setPicks(NO_PICKS); router.push(`${base}?tab=${go}`, { scroll: false }); };
      return (
        <EmptyCard
          title={`${E.searchMiss(W.tab[tab], query.trim())} ${E.searchElsewhere(elsewhere.map(id => ({ n: matchCounts[id], tab: W.tab[id] })))}`}
          action={<button type="button" className="btn btn-outline" onClick={showIn}>{E.showIn(matchCounts[go], W.tab[go])}</button>}
        />
      );
    }
    if (filterOn) return <EmptyCard title={E.filter} action={<button type="button" className="btn btn-outline" onClick={resetFilter}>{REGS_WORDS.filterClear}</button>} />;
    const e = tab === 'review' ? (season.autoApproveUnderCapacity ? E.reviewAuto : E.review) : tab === 'active' ? E.active : tab === 'waitlist' ? E.waitlist : E.ended;
    return <EmptyCard title={e.title}>{e.body}</EmptyCard>;
  })();

  // ⚖ 13e-3 (drawing tab 2, the way back): Fee: Owing names its twin — only when it is TRUE: Active, every division, no
  // search, Owing the only pick. Both lists ask the one rule (`stillOwingCents`), so the count is the same children as Money's
  // Still owing; with a division picked the list is a part of them and the line goes. The count is the list's own.
  const onlyOwing = activePicks.fee.size === 1 && activePicks.fee.has('owing') && activePicks.team.size === 0 && activePicks.flags.size === 0;
  const twinLine = tab === 'active' && !scope && !searching && onlyOwing && tabRegs.length > 0 ? (
    <p className={css.twinLine}>
      {W.twin(tabRegs.length)}{' '}
      <Link href={`/${orgSlug}/admin/house-league/seasons/${seasonId}/money?tab=owing`}>{W.twinOpen}</Link>
    </p>
  ) : null;

  const raised = openId != null;
  const picked = selectedRegs.length;
  const newLinkFor = act?.kind === 'newLink' ? signupKids(act.reg, read?.registrations ?? []) : null;

  return (
    <div className={`${repKit.page} ${repKit.moneyFrame} ${css.screen}`} data-selecting={picked > 0 || undefined} data-fills-when-folded>
      {/* THE LINE FITS BY STEPS, NOT BY WRAPPING (owner 2026-11-18, option D): the box is a container (`data-toolbar-fit`), so the shrinking
          below is decided by the toolbar's OWN width (the sidebar can be 240 or 64). Under ~1,150px Export and Add registration
          lose their words; at tablet width (~900px) Search tucks into its square and the division picker narrows. Search is
          the last thing to give way. Only screens that sit inside a `data-toolbar-fit` container take these steps. */}
      <div className={css.toolbarBox} data-toolbar-fit>
      <div className={`${tb.toolbar} ${css.toolbarWrap}`}>
        {/* A scope that does not depend on the view leads and the view follows (ONE CALENDAR, 2026-10-10). */}
        <DivisionPicker
          divisions={[{ id: '', name: REGS_WORDS.scopeAll, waiting: 0 }, ...divisions.map(d => ({ id: d.id, name: d.name, waiting: reviewByDivision.get(d.id) ?? 0 }))]}
          value={scope}
          // Another division's teams are not this one's: a team tick goes, "Not placed" stays (a tick never hides out of reach).
          onChange={id => { setScope(id); setPicks(prev => ({ ...prev, team: new Set([...prev.team].filter(k => k === NOT_PLACED)) })); setShown(PAGE); clearSelection(); }}
          words={{ waiting: REGS_WORDS.scopeToReview, waitingElsewhere: REGS_WORDS.scopeElsewhere }}
        />
        {viewPill}
        <span className={tb.toolbarSpacer} aria-hidden />
        <div className={tb.deskFilters}>{searchField.field}</div>
        {searchField.toggle}
        {groups.length > 0 && (
          <FilterMenu groups={groups} label={REGS_WORDS.filter} onLabel={REGS_WORDS.filterOn} resetLabel={REGS_WORDS.filterClear} onReset={resetFilter} align="end" />
        )}
        {/* Every plan that runs a house league exports (the free League plan that could not is gone, owner 2026-11-19). */}
        <ExportMenu
          formats={['xlsx', 'csv', 'pdf']}
          onExportXLSX={() => exportXlsx(exportRows, currentOrg?.slug, tab, false, answerCols)}
          onExportCSV={() => exportCsv(exportRows, currentOrg?.slug, tab, answerCols)}
          onExportPDF={() => exportPdf({
            rows: exportRows, divisionOrder: divisions.map(d => ({ id: d.id, name: d.name })), orgSlug: currentOrg?.slug, orgName: currentOrg?.name,
            orgQuery, seasonName: season.name, tab, query,
          })}
          /* ⚠ THE SURFACE'S OWN GATE, NOT THE GENERIC ONE: a module granted by an add-on can put an org above the
             generic PDF bar without ever reaching League. */
          pdfFeatureKey="league_exports"
          hasSensitiveOption
          sensitiveOptionLabel="Excel with contact details"
          onExportXLSXWithSensitive={() => exportXlsx(exportRows, currentOrg?.slug, tab, true, answerCols)}
          // Only when the form asks a health question: otherwise this file would be the one above it.
          extraSensitiveOption={form?.hasHealth ? {
            label: STAFF_FORM_WORDS.healthExport, hint: STAFF_FORM_WORDS.healthExportHint, onExport: exportWithHealth,
          } : undefined}
          planId={currentOrg?.planId}
          disabled={tabRegs.length === 0}
        />
        {/* Stage 4 Part 3 (drawing tab 6 · A): Tools (⋯) after Export and before the lime Add — absent on a phone (its one
            item does nothing there) and while the form has no question that can be a column. */}
        {!isPhone && liveQs.length > 0 && (
          <CoachToolbarMenu
            label={STAFF_FORM_WORDS.tools}
            icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
            triggerClassName={tb.tool}
          >
            <CoachToolbarMenuItem label={STAFF_FORM_WORDS.answerColumns} onSelect={() => setColumnsOpen(true)} />
          </CoachToolbarMenu>
        )}
        {access?.register && (
          <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone} ${css.addBtn}`} aria-label={REGS_WORDS.add} title={REGS_WORDS.add} onClick={() => setAct({ kind: 'add' })}>
            <Plus size={14} aria-hidden /><span className={`${ck.btnWord} ${css.addWord}`}>{REGS_WORDS.add}</span>
          </button>
        )}
      </div>
      {searchField.row}
      </div>
      <FilterLine picks={pickedLabels(groups)} label={REGS_WORDS.filter} />
      {twinLine}

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
            answerHeads={isPhone ? [] : columnQs.map(q => q.label)}
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
      {columnsOpen && (
        <AnswerColumnsWindow
          questions={liveQs}
          chosen={columnQs.map(q => q.id)}
          onClose={() => setColumnsOpen(false)}
          onSave={async ids => {
            const r = await moneyFetch<{ columns?: string[] }>(`/api/admin/house-league/seasons/${seasonId}/registrations/answers${orgQuery}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionIds: ids }),
            }).catch(() => null);
            if (!r?.ok) return false;
            const columns = r.data.columns ?? ids;
            setRead(prev => (prev?.form ? { ...prev, form: { ...prev.form, columns } } : prev));
            return true;
          }}
        />
      )}
      {openReg && (
        <RegistrationRecordWindow
          key={openReg.id}
          model={modelFor(openReg)}
          clearingCents={clearingOf(openReg)}
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
          friends={friendRecord(openReg)}
          formSections={form ? <RecordFormSections seasonId={seasonId} regId={openReg.id} orgQuery={orgQuery} childName={openReg.playerFirstName} /> : null}
          dispute={read?.disputes?.[openReg.id] ?? null}
          orgSlug={orgSlug}
          canDesk={rights.takeFees}
          isPhone={isPhone}
          focus={openReg.id === openedLink ? linkedAt : openReg.id === feeFocus ? 'fee' : null}
          onAnotherWay={id => openAnotherWay(openReg, id)}
          // Signed-in family accounts Stage 3 (ask 6): the desk (as "Add registration") adds or changes it; sends nothing.
          onSecondEmail={rights.register ? async value => {
            const r = await patchRegistration(orgQuery, seasonId, openReg.id, { guardianEmail2: value });
            if (!r.ok) return r.error;
            await load({ season: false, teams: false });
            return null;
          } : null}
          // Signed-in family accounts Stage 4a (Part 8.1): Send again / Remove a parent, the same right as "Send a new link".
          onFamily={rights.register ? {
            sendAgain: async which => {
              const r = await patchRegistration(orgQuery, seasonId, openReg.id, { familySendAgain: which });
              if (!r.ok) return { error: r.error };
              await load({ season: false, teams: false });
              return { sentTo: (which === 'first' ? openReg.guardianEmail : openReg.guardianEmail2) ?? '' };
            },
            remove: async linkId => {
              const r = await patchRegistration(orgQuery, seasonId, openReg.id, { familyRemove: linkId });
              if (!r.ok) return r.error;
              await load({ season: false, teams: false });
              return null;
            },
          } : null}
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
          payoutsOn={!!read?.payoutsOn}
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
      {act?.kind === 'payLinkAnyway' && (
        <ConfirmWindow
          title={DISPUTE_WORDS.sendAnywayTitle}
          body={DISPUTE_WORDS.sendAnywayBody(false)}
          go={DISPUTE_WORDS.sendAnywayGo}
          onClose={() => setAct(null)}
          onConfirm={async () => { const reg = act.reg; setAct(null); await payLinkOne(reg, true); }}
        />
      )}
      {act?.kind === 'newLink' && newLinkFor && (
        <ConfirmWindow
          title={REGS_WORDS.newLink.title}
          body={REGS_WORDS.newLink.body(newLinkFor.names, newLinkFor.many, act.reg.guardianEmail)}
          go={REGS_WORDS.newLink.go}
          onClose={() => setAct(null)}
          onConfirm={() => runNewLink(act.reg)}
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
