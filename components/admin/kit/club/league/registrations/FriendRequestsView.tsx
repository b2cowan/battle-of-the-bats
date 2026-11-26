'use client';
/**
 * FRIEND REQUESTS, THE FIFTH REGISTRATIONS VIEW (Board Ready Stage 1 Part 2; drawing tab 4, the export half of tab 7;
 * rulings A2, A11, A13 with its drawn-in proposals). One row per request — who asked, what the parent typed, the best
 * match this season — in three bands (To confirm · Confirmed · Closed). A Both asked pair is ONE row and ONE Confirm.
 * The row's one button is the likely answer (the Registrations recipe: olive outline); the rest sit behind ⋯. Clicking
 * the row opens the request with every match. The toolbar has no lime: the division, search, Filter (Show only) and
 * Export (the view's own file, children's names only).
 *
 * AFTER THE DRAFT (Part 3; drawing tab 6, A3): once the division picked has drafted, the bands become the result — Not
 * honoured first (the ones a registrar may want to fix by hand), then Honoured — each request with its reason, read from
 * the teams as they stand now. Every row still opens the request and keeps its ⋯ (Delete request… must stay reachable).
 *
 * WHO MAY: the screen mounts this only for a reader of Registrations (A11), on a season that takes friend requests.
 * Deciding is the desk's `register` right; without it every decision is absent (a reader reads).
 */
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { RepChip, RowAction, repKit, ClubRowList, ClubRowBand, EmptyCard, Callout } from '@/components/admin/kit/club/RepKit';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import ExportMenu from '@/components/admin/ExportMenu';
import DivisionPicker from '@/components/admin/tournament/DivisionPicker';
import FilterMenu, { FilterLine, pickedLabels } from '@/components/admin/tournament/FilterMenu';
import { useToolbarSearch } from '@/components/admin/tournament/useToolbarSearch';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError, jsonInit, moneyFetch, refusalText } from '../../money/MoneyKit';
import { BULK_WORDS, REGS_WORDS } from '@/lib/house-league-money-words';
import { playerName, regDay } from '@/lib/house-league-registrations';
import {
  askedPhrase, askedSub, askedText, friendFold, reasonOf, requestLines, BANDS, FRIEND_QUEUE_WORDS,
  type Band, type CantHonourReason, type FriendPlacement, type QueueMark, type QueueRow,
} from '@/lib/league-friend-queue';
import { friendResult, FRIEND_RESULT_WORDS, type FriendResult, type ResultLine } from '@/lib/league-friend-draft';
import type { LeagueRegistration, OrgPlan } from '@/lib/types';
import CantHonourWindow from './CantHonourWindow';
import FriendRequestWindow from './FriendRequestWindow';
import { exportFriendsCsv, exportFriendsXlsx } from './friendRequestsExport';
import css from './Registrations.module.css';

const W = FRIEND_QUEUE_WORDS;
const R = FRIEND_RESULT_WORDS;
const PAGE = 50;
const MARKS: readonly QueueMark[] = ['code', 'bothAsked', 'noMatch', 'differentDivision'];

type Decision =
  | { act: 'confirm'; items: { id: string; matchId: string }[] }
  | { act: 'notSignedUp' | 'reopen' | 'delete'; ids: string[] }
  | { act: 'cantHonour'; ids: string[]; reason: CantHonourReason; note: string | null };

type MenuKey = 'pickAnother' | 'notSignedUp' | 'cantHonour' | 'reopen' | `open:${string}` | `delete:${number}`;

type Act =
  | { kind: 'pick'; row: QueueRow }
  | { kind: 'cant'; row: QueueRow }
  | { kind: 'delete'; row: QueueRow; index: number };

export default function FriendRequestsView({
  viewPill, rows, divisions, scope, onScope, regs, placement, divisionName, teamName, today, canDecide, isPhone,
  orgQuery, seasonId, orgSlug, planId, onChanged, onOpenRegistration, say,
}: {
  /** The Registrations view switch, drawn first in this view's toolbar. */
  viewPill: ReactNode;
  rows: readonly QueueRow[];
  divisions: readonly { id: string; name: string }[];
  /** The division picked (shared with the other views): '' is every division. */
  scope: string;
  onScope: (id: string) => void;
  regs: readonly LeagueRegistration[];
  /** Where the draft dealt each child and the locks (Part 3): a drafted division reads its result. */
  placement: FriendPlacement;
  divisionName: (id: string | null) => string | null;
  teamName: (id: string | null) => string | null;
  today: string;
  canDecide: boolean;
  isPhone: boolean;
  orgQuery: string;
  seasonId: string;
  orgSlug: string;
  planId: OrgPlan | undefined;
  onChanged: () => Promise<void> | void;
  onOpenRegistration: (id: string) => void;
  say: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<ReadonlySet<QueueMark>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState<Record<Band, number>>({ toConfirm: PAGE, confirmed: PAGE, closed: PAGE });
  const [act, setAct] = useState<Act | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [shownResult, setShownResult] = useState({ no: PAGE, yes: PAGE });
  const searchField = useToolbarSearch({ value: query, onChange: q => { setQuery(q); setSelected(new Set()); }, label: W.search });

  // ── Narrowing ─────────────────────────────────────────────────────────────────────────────────
  const scoped = useMemo(() => (scope ? rows.filter(r => r.asker.divisionId === scope) : rows), [rows, scope]);
  const searched = useMemo(() => {
    const q = friendFold(query);
    if (!q) return scoped;
    return scoped.filter(r => [
      playerName(r.asker), r.partner ? playerName(r.partner) : '', r.match ? playerName(r.match) : '',
      ...r.requests.map(x => [x.typedFirst, x.typedLast].filter(Boolean).join(' ')),
    ].some(s => friendFold(s).includes(q)));
  }, [scoped, query]);
  const listed = useMemo(() => (picks.size ? searched.filter(r => [...picks].some(m => r.marks.has(m))) : searched), [searched, picks]);
  const byBand = useMemo(() => {
    const m: Record<Band, QueueRow[]> = { toConfirm: [], confirmed: [], closed: [] };
    for (const r of listed) m[r.band].push(r);
    return m;
  }, [listed]);
  const waitingByDivision = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.band === 'toConfirm' && r.asker.divisionId) m.set(r.asker.divisionId, (m.get(r.asker.divisionId) ?? 0) + 1);
    return m;
  }, [rows]);

  // ── After the draft (tab 6) ───────────────────────────────────────────────────────────────────
  const draftedDivisions = useMemo(
    () => new Set(regs.filter(r => r.status === 'active' && r.divisionId && placement[r.id]?.dealt).map(r => r.divisionId!)),
    [regs, placement],
  );
  const resultOf = useCallback((line: ResultLine): FriendResult | null => (line.asker.divisionId && draftedDivisions.has(line.asker.divisionId)
    ? friendResult(line, { placement, teamName, day: v => regDay(v, today) }) : null), [draftedDivisions, placement, teamName, today]);
  const drafted = !!scope && draftedDivisions.has(scope);
  const results = useMemo(() => (drafted ? requestLines(listed).map(line => ({ line, result: resultOf(line)! })) : []), [drafted, listed, resultOf]);
  const resultBands = { no: results.filter(r => !r.result.honoured), yes: results.filter(r => r.result.honoured) };

  // ── Deciding ──────────────────────────────────────────────────────────────────────────────────
  async function decide(d: Decision, keys: readonly string[]): Promise<string | null> {
    setBusy(prev => new Set([...prev, ...keys]));
    try {
      const r = await moneyFetch<{ changed?: number; code?: string }>(`/api/admin/house-league/seasons/${seasonId}/friends${orgQuery}`, jsonInit('POST', d));
      if (!r.ok) {
        if (r.status === 409) await onChanged();
        return refusalText(r.data, W.failed);
      }
      await onChanged();
      return null;
    } catch {
      return W.failed;
    } finally {
      setBusy(prev => { const n = new Set(prev); for (const k of keys) n.delete(k); return n; });
    }
  }
  const idsOf = (row: QueueRow) => row.requests.map(q => q.id);
  const first = (r: LeagueRegistration) => r.playerFirstName;

  async function primary(row: QueueRow) {
    if (row.action === 'confirm' && row.best) {
      const refused = await decide({ act: 'confirm', items: row.best }, [row.key]);
      if (refused) { setResult(refused); return; }
      say(W.done.confirmed(first(row.asker), first(row.partner ?? row.match!)));
    } else if (row.action === 'pick') setAct({ kind: 'pick', row });
    else if (row.action === 'cantHonour') setAct({ kind: 'cant', row });
    else if (row.action === 'notSignedUp') {
      const refused = await decide({ act: 'notSignedUp', ids: idsOf(row) }, [row.key]);
      if (refused) { setResult(refused); return; }
      say(W.done.notSignedUp);
    }
  }

  async function pickMenu(row: QueueRow, key: MenuKey) {
    if (key === 'pickAnother') { setAct({ kind: 'pick', row }); return; }
    if (key === 'cantHonour') { setAct({ kind: 'cant', row }); return; }
    if (key.startsWith('open:')) { onOpenRegistration(key.slice(5)); return; }
    if (key.startsWith('delete:')) { setAct({ kind: 'delete', row, index: Number(key.slice(7)) }); return; }
    const verb = key as 'notSignedUp' | 'reopen';
    // A covered row holds no decision of its own: moving it back is moving nothing.
    const refused = await decide({ act: verb, ids: idsOf(row) }, [row.key]);
    if (refused) { setResult(refused); return; }
    say(verb === 'reopen' ? W.done.reopened : W.done.notSignedUp);
  }

  function menuFor(row: QueueRow): { key: MenuKey; label: string }[] {
    const M = W.menu;
    const items: { key: MenuKey; label: string }[] = [];
    const typed = !row.requests[0].code;
    if (canDecide) {
      if (row.band === 'toConfirm' && !row.partner) {
        if (typed && row.action !== 'pick') items.push({ key: 'pickAnother', label: M.pickAnother });
        if (row.action !== 'notSignedUp') items.push({ key: 'notSignedUp', label: M.notSignedUp });
        if (row.action !== 'cantHonour') items.push({ key: 'cantHonour', label: M.cantHonour });
      } else if (row.band === 'toConfirm') {
        items.push({ key: 'cantHonour', label: M.cantHonour });
      } else if (row.band === 'confirmed') {
        if (typed && !row.partner) items.push({ key: 'pickAnother', label: M.pickAnother });
        items.push({ key: 'cantHonour', label: M.cantHonour });
        if (!row.covered) items.push({ key: 'reopen', label: M.reopen });
      } else {
        items.push({ key: 'reopen', label: M.reopen });
      }
    }
    items.push({ key: `open:${row.asker.id}`, label: M.open(first(row.asker)) });
    if (row.partner) items.push({ key: `open:${row.partner.id}`, label: M.open(first(row.partner)) });
    if (canDecide) {
      if (row.partner) {
        items.push({ key: 'delete:0', label: M.deleteOf(first(row.asker)) });
        items.push({ key: 'delete:1', label: M.deleteOf(first(row.partner)) });
      } else items.push({ key: 'delete:0', label: M.delete });
    }
    return items;
  }

  // ── Bulk: Confirm best match ───────────────────────────────────────────────────────────────────
  // A tick holds only while its row is still to confirm: a row decided one at a time leaves the selection (/review).
  const selectedRows = listed.filter(r => selected.has(r.key) && r.band === 'toConfirm');
  async function confirmBest() {
    const withBest = selectedRows.filter(r => r.band === 'toConfirm' && r.best);
    const left = selectedRows.length - withBest.length;
    if (withBest.length === 0) { setResult(W.bulk.skipped(left)); return; }
    const refused = await decide({ act: 'confirm', items: withBest.flatMap(r => r.best!) }, withBest.map(r => r.key));
    if (refused) { setResult(refused); return; }
    setSelected(new Set(selectedRows.filter(r => !r.best).map(r => r.key)));
    // (Rows that left To confirm drop out of selectedRows on the next read.)
    if (left > 0) setResult(`${W.bulk.done(withBest.length)} ${W.bulk.skipped(left)}`);
    else { setResult(null); say(W.bulk.done(withBest.length)); }
  }

  // ── Cells ─────────────────────────────────────────────────────────────────────────────────────
  const chip = (m: QueueMark) => <RepChip key={m} tone={m === 'differentDivision' ? 'warn' : 'neutral'}>{W.mark[m]}</RepChip>;
  const chipsOf = (row: QueueRow, only: readonly QueueMark[]) => only.filter(m => row.marks.has(m)).map(chip);

  function playerCell(row: QueueRow): { name: string; sub: string } {
    if (row.partner) return { name: W.pairName(playerName(row.asker), playerName(row.partner)), sub: W.pairSub(divisionName(row.asker.divisionId)) };
    return { name: playerName(row.asker), sub: W.signedUp(divisionName(row.asker.divisionId), regDay(row.asker.registeredAt, today)) };
  }

  function askedCell(row: QueueRow): { lead: string; sub: string | null } {
    if (row.partner) {
      // Same shape as every other row: what the family typed on top, the next line quiet. The parent is read from the
      // match column ("Liam's parent matches") and the request window, so it is not put on this line.
      return { lead: askedText(row.requests[0]), sub: W.pairAsked(askedText(row.requests[1])) };
    }
    return { lead: askedText(row.requests[0]), sub: askedSub(row.requests[0]) };
  }

  function matchCell(row: QueueRow): { lead: ReactNode; sub: string | null; muted?: boolean } {
    const q = row.requests[0];
    const line = (r: LeagueRegistration) => W.matchLine(playerName(r), divisionName(r.divisionId));
    if (row.band === 'closed') {
      return { lead: q.state === 'not_signed_up' ? W.notSignedUpWord : W.cantHonourWord(q.reason, q.note), sub: W.markedBy(q.decidedBy, regDay(q.decidedAt, today)), muted: true };
    }
    if (row.band === 'confirmed') {
      const sub = row.covered ? W.coveredLine(first(row.match!))
        : q.code && !q.decidedBy ? W.confirmedWhenEntered
          : W.confirmedBy(q.decidedBy, regDay(q.decidedAt, today));
      const gone = row.match && (row.match.status === 'withdrawn' || row.match.status === 'declined')
        ? W.withdrew(first(row.match), regDay(row.match.endedAt, today)) : null;
      return { lead: row.match ? <>{line(row.match)} {chipsOf(row, ['code', 'bothAsked'])}</> : '—', sub: gone ?? sub };
    }
    if (row.partner) {
      const a = row.candidates.find(c => c.reg.id === row.partner!.id);
      const why = a ? (a.first === 'same' && a.last === 'same' ? W.sameNames : reasonOf({ ...a, parent: false })) : W.sameNames;
      return { lead: <>{chipsOf(row, ['bothAsked', 'code'])}</>, sub: W.bothWhy(why, a?.parent ? first(row.partner) : null) };
    }
    switch (row.action) {
      case 'confirm': {
        if (q.code) return { lead: <>{line(row.match!)} {chip('code')}</>, sub: null };
        const lead = row.candidates.find(c => c.reg.id === row.match?.id);
        const others = row.candidates.filter(c => c.sameDivision).length - 1;
        return { lead: line(row.match!), sub: [lead ? reasonOf(lead) : null, others > 0 ? W.otherMatches(others) : null].filter(Boolean).join(' · ') };
      }
      case 'pick': {
        const same = row.candidates.filter(c => c.sameDivision);
        return { lead: W.possible(same.length), sub: same.slice(0, 3).map(c => playerName(c.reg)).join(' · '), muted: true };
      }
      case 'cantHonour': {
        const lead = row.candidates[0];
        return { lead: <>{row.match ? line(row.match) : '—'} {chipsOf(row, ['code'])} {chip('differentDivision')}</>, sub: lead ? reasonOf(lead) : null };
      }
      default:
        return { lead: W.noOne, sub: q.code ? W.noCodeMatch : W.checkedAll, muted: true };
    }
  }

  // A reader without the desk's right gets no decision: the row still opens the request to read.
  const actionOf = (row: QueueRow) => (row.band === 'toConfirm' && row.action
    ? (canDecide ? <RowAction disabled={busy.has(row.key)} onClick={() => void primary(row)}>{W.act[row.action]}</RowAction> : null)
    : <span className={repKit.dim}>{row.band === 'confirmed' ? W.stateWord.confirmed : W.stateWord.closed}</span>);

  const rowMenu = (row: QueueRow) => {
    const items = menuFor(row);
    const cell = playerCell(row);
    const deleteAt = items.findIndex(i => i.key.startsWith('delete:'));
    return (
      <CoachToolbarMenu variant="glyph" label={W.moreFor(cell.name)} icon={<MoreHorizontal size={18} aria-hidden />}
        drawerOnPhone drawerTitle={cell.name} panelMinWidth={280} triggerClassName={css.moreTrigger}>
        {isPhone && <CoachToolbarMenuHeading>{cell.sub}</CoachToolbarMenuHeading>}
        {items.map((item, i) => (
          <Fragment key={item.key}>
            {i === deleteAt && i > 0 && <CoachToolbarMenuSeparator />}
            <CoachToolbarMenuItem label={item.label} onSelect={() => void pickMenu(row, item.key)} />
          </Fragment>
        ))}
      </CoachToolbarMenu>
    );
  };

  const tickable = (row: QueueRow) => canDecide && row.band === 'toConfirm';
  const toggle = (key: string) => setSelected(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const more = (band: Band, hidden: number) => (hidden > 0
    ? <button type="button" className={css.moreRow} onClick={() => setShown(s => ({ ...s, [band]: s[band] + PAGE }))}>{W.more(hidden)}</button>
    : null);

  // ── The list ──────────────────────────────────────────────────────────────────────────────────
  const bandsShown = BANDS.filter(b => byBand[b].length > 0);
  const anySelectable = canDecide && byBand.toConfirm.length > 0;

  function deskTable() {
    const cols = 4 + (anySelectable ? 1 : 0);
    const shownToConfirm = byBand.toConfirm.slice(0, shown.toConfirm);
    const allOn = shownToConfirm.length > 0 && shownToConfirm.every(r => selected.has(r.key));
    return (
      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              {anySelectable && (
                <th scope="col" className={css.tickCol}>
                  <label className={css.tickTap}>
                    <input type="checkbox" className={screenParts.check22} checked={allOn} aria-label={W.selectAll}
                      onChange={() => setSelected(allOn ? new Set() : new Set(shownToConfirm.map(r => r.key)))} />
                  </label>
                </th>
              )}
              <th scope="col">{W.col.player}</th>
              <th scope="col">{W.col.asked}</th>
              <th scope="col">{W.col.match}</th>
              <th scope="col"><span className={repKit.srOnly}>{W.col.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {bandsShown.map(band => {
              const list = byBand[band];
              const hidden = Math.max(0, list.length - shown[band]);
              return [
                <tr key={`band-${band}`} className={repKit.band}><td colSpan={cols}>{W.band[band]} · {list.length}</td></tr>,
                ...list.slice(0, shown[band]).map(row => {
                  const p = playerCell(row), a = askedCell(row), m = matchCell(row);
                  return (
                    <tr key={row.key} className={repKit.rowOpens} data-selected={selected.has(row.key) || undefined}
                      onClick={() => { if (window.getSelection()?.toString()) return; setAct({ kind: 'pick', row }); }}>
                      {anySelectable && (
                        <td className={css.tickCol} onClick={e => e.stopPropagation()}>
                          {tickable(row) && (
                            <label className={css.tickTap}>
                              <input type="checkbox" className={screenParts.check22} checked={selected.has(row.key)}
                                onChange={() => toggle(row.key)} aria-label={W.selectRow(p.name)} />
                            </label>
                          )}
                        </td>
                      )}
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                          onClick={e => { e.stopPropagation(); setAct({ kind: 'pick', row }); }}>{p.name}</button>
                        <span className={repKit.cellSub}>{p.sub}</span>
                      </td>
                      <td>{a.lead}{a.sub && <span className={repKit.cellSub}>{a.sub}</span>}</td>
                      <td>
                        <span className={`${css.friendMatch}${m.muted ? ` ${repKit.dim}` : ''}`}>{m.lead}</span>
                        {m.sub && <span className={repKit.cellSub}>{m.sub}</span>}
                      </td>
                      <td className={css.actionsCol} onClick={e => e.stopPropagation()}>
                        <span className={css.actions}>{actionOf(row)}{rowMenu(row)}</span>
                      </td>
                    </tr>
                  );
                }),
                ...(hidden > 0 ? [<tr key={`more-${band}`}><td colSpan={cols}>{more(band, hidden)}</td></tr>] : []),
              ];
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // The result (tab 6): one row per request, Not honoured first. The match column names the team as it stands.
  const matchedTo = (line: ResultLine) => (line.match && (line.confirmed || line.q.matchedRegistrationId)
    ? W.matchLine(playerName(line.match), line.match.teamId ? teamName(line.match.teamId) : null) : null);
  const moreResults = (k: 'no' | 'yes', hidden: number) => (
    <button type="button" className={css.moreRow} onClick={() => setShownResult(v => ({ ...v, [k]: v[k] + PAGE }))}>{W.more(hidden)}</button>
  );
  const resultKeys = (['no', 'yes'] as const).filter(k => resultBands[k].length > 0);

  function resultTable() {
    const cols = 5;
    return (
      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col">{R.col.player}</th>
              <th scope="col">{R.col.asked}</th>
              <th scope="col">{R.col.matched}</th>
              <th scope="col">{R.col.inDraft}</th>
              <th scope="col"><span className={repKit.srOnly}>{W.col.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {resultKeys.map(k => {
              const list = resultBands[k];
              const hidden = Math.max(0, list.length - shownResult[k]);
              return [
                <tr key={`band-${k}`} className={repKit.band}><td colSpan={cols}>{k === 'no' ? R.band.notHonoured : R.band.honoured} · {list.length}</td></tr>,
                ...list.slice(0, shownResult[k]).map(({ line, result: res }) => {
                  const matched = matchedTo(line);
                  return (
                    <tr key={line.q.id} className={repKit.rowOpens}
                      onClick={() => { if (window.getSelection()?.toString()) return; setAct({ kind: 'pick', row: line.row }); }}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                          onClick={e => { e.stopPropagation(); setAct({ kind: 'pick', row: line.row }); }}>{playerName(line.asker)}</button>
                        <span className={repKit.cellSub}>{teamName(line.asker.teamId) ?? ''}</span>
                      </td>
                      <td>{askedText(line.q)}</td>
                      <td className={matched ? undefined : repKit.dim}>{matched ?? '—'}</td>
                      <td>
                        <RepChip tone={res.honoured ? 'neutral' : 'warn'}>{res.honoured ? W.honoured : W.notHonoured}</RepChip>
                        <span className={repKit.cellSub}>{res.why}</span>
                      </td>
                      <td className={css.actionsCol} onClick={e => e.stopPropagation()}>
                        <span className={css.actions}>{rowMenu(line.row)}</span>
                      </td>
                    </tr>
                  );
                }),
                ...(hidden > 0 ? [<tr key={`more-${k}`}><td colSpan={cols}>{moreResults(k, hidden)}</td></tr>] : []),
              ];
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function resultPhone() {
    return (
      <ClubRowList label={W.view}>
        {resultKeys.flatMap(k => {
          const list = resultBands[k];
          const hidden = Math.max(0, list.length - shownResult[k]);
          return [
            <ClubRowBand key={`band-${k}`} count={list.length}>{k === 'no' ? R.band.notHonoured : R.band.honoured}</ClubRowBand>,
            ...list.slice(0, shownResult[k]).map(({ line, result: res }) => (
              <li key={line.q.id} className={`${repKit.rowItem} ${css.pRow}`} data-row-list-row>
                <button type="button" className={css.pMain} aria-haspopup="dialog" onClick={() => setAct({ kind: 'pick', row: line.row })}>
                  <span className={css.pName}>{playerName(line.asker)}</span>
                  <span className={css.pDetail}>{[teamName(line.asker.teamId), W.askedFor(askedText(line.q)), matchedTo(line)].filter(Boolean).join(' · ')}</span>
                  <span className={css.pSub}>{res.honoured ? W.honoured : W.notHonoured} · {res.why}</span>
                </button>
                <span className={css.pMore}>{rowMenu(line.row)}</span>
              </li>
            )),
            ...(hidden > 0 ? [<li key={`more-${k}`} className={repKit.rowItem} data-row-list-row>{moreResults(k, hidden)}</li>] : []),
          ];
        })}
      </ClubRowList>
    );
  }

  function phoneList() {
    return (
      <ClubRowList label={W.view}>
        {bandsShown.flatMap(band => {
          const list = byBand[band];
          const hidden = Math.max(0, list.length - shown[band]);
          return [
            <ClubRowBand key={`band-${band}`} count={list.length}>{W.band[band]}</ClubRowBand>,
            ...list.slice(0, shown[band]).map(row => {
              const p = playerCell(row), a = askedCell(row), m = matchCell(row);
              const on = selected.has(row.key);
              return (
                <li key={row.key} className={`${repKit.rowItem} ${css.pRow}`} data-row-list-row data-selected={on || undefined}>
                  {tickable(row) && (
                    <label className={css.pTick}>
                      <input type="checkbox" className={screenParts.check22} checked={on} onChange={() => toggle(row.key)} aria-label={W.selectRow(p.name)} />
                    </label>
                  )}
                  <button type="button" className={css.pMain} aria-haspopup="dialog" onClick={() => setAct({ kind: 'pick', row })}>
                    <span className={css.pName}>{p.name}</span>
                    <span className={css.pDetail}>{row.partner ? p.sub : [divisionName(row.asker.divisionId), row.requests[0].code ? a.lead : W.askedFor(a.lead), row.requests[0].typedParent ? W.parentTyped(row.requests[0].typedParent) : null].filter(Boolean).join(' · ')}</span>
                    <span className={css.pSub}>{m.lead}{m.sub ? ` · ${m.sub}` : ''}</span>
                  </button>
                  <span className={css.pMore}>{rowMenu(row)}</span>
                  {row.band === 'toConfirm' && row.action && canDecide && <span className={css.pLow}>{actionOf(row)}</span>}
                </li>
              );
            }),
            ...(hidden > 0 ? [<li key={`more-${band}`} className={repKit.rowItem} data-row-list-row>{more(band, hidden)}</li>] : []),
          ];
        })}
      </ClubRowList>
    );
  }

  // ── The Filter: Show only ─────────────────────────────────────────────────────────────────────
  const groups = [{
    key: 'show',
    label: W.filterTitle,
    options: MARKS.map(m => ({ key: m, label: W.mark[m], count: searched.filter(r => r.marks.has(m)).length })),
    selected: [...picks],
    onToggle: (k: string) => { setPicks(prev => { const n = new Set(prev); if (n.has(k as QueueMark)) n.delete(k as QueueMark); else n.add(k as QueueMark); return n; }); setSelected(new Set()); },
  }];
  const resetFilter = () => setPicks(new Set());

  const empty = rows.length === 0 ? <EmptyCard title={W.empty.title}>{W.empty.body}</EmptyCard>
    : query.trim() ? <EmptyCard title={W.emptySearch} />
      : picks.size ? <EmptyCard title={W.emptyFilter} action={<button type="button" className="btn btn-outline" onClick={resetFilter}>{REGS_WORDS.filterClear}</button>} />
        : <EmptyCard title={W.emptyDivision} />;

  const exportArgs = { rows: listed, orgSlug, divisionName, teamName, resultOf };
  const picked = selectedRows.length;

  return (
    <>
      <div className={css.toolbarBox} data-toolbar-fit>
      <div className={`${tb.toolbar} ${css.toolbarWrap}`}>
        <DivisionPicker
          divisions={[{ id: '', name: REGS_WORDS.scopeAll, waiting: 0 }, ...divisions.map(d => ({ id: d.id, name: d.name, waiting: waitingByDivision.get(d.id) ?? 0 }))]}
          value={scope}
          onChange={id => { onScope(id); setSelected(new Set()); }}
          words={{ waiting: W.viewAria, waitingElsewhere: W.scopeElsewhere }}
        />
        {viewPill}
        <span className={tb.toolbarSpacer} aria-hidden />
        <div className={tb.deskFilters}>{searchField.field}</div>
        {searchField.toggle}
        <FilterMenu groups={groups} label={REGS_WORDS.filter} onLabel={REGS_WORDS.filterOn} resetLabel={REGS_WORDS.filterClear} onReset={resetFilter} align="end" />
        <ExportMenu
          formats={['xlsx', 'csv']}
          onExportXLSX={() => exportFriendsXlsx(exportArgs)}
          onExportCSV={() => exportFriendsCsv(exportArgs)}
          planId={planId}
          disabled={listed.length === 0}
        />
      </div>
      {searchField.row}
      </div>
      <FilterLine picks={pickedLabels(groups)} label={REGS_WORDS.filter} />

      {result && (
        <Callout tone="warn" role="status" action={<button type="button" className="btn btn-outline" onClick={() => setResult(null)}>{BULK_WORDS.dismiss}</button>}>
          <b>{result}</b>
        </Callout>
      )}

      {picked > 0 && (
        <div className={isPhone ? css.bulkDock : css.bulkInline} role="toolbar" aria-label={BULK_WORDS.barAria}>
          {isPhone ? (
            <span className={css.bulkDockCount}>
              <b>{BULK_WORDS.count(picked)}</b>
              <button type="button" className={css.bulkClear} onClick={() => setSelected(new Set())}>{BULK_WORDS.clear}</button>
            </span>
          ) : <b className={css.bulkCount}>{BULK_WORDS.count(picked)}</b>}
          <button type="button" className="btn btn-outline" disabled={busy.size > 0} onClick={() => void confirmBest()}>{W.bulk.confirmBest}</button>
          {!isPhone && <span className={css.bulkSpacer} aria-hidden />}
          {!isPhone && <button type="button" className={css.bulkClear} onClick={() => setSelected(new Set())}>{BULK_WORDS.clear}</button>}
        </div>
      )}

      {listed.length === 0 ? empty : (
        <>
          {drafted ? (isPhone ? resultPhone() : resultTable()) : isPhone ? phoneList() : deskTable()}
          {drafted && <p className={repKit.notes}>{R.foot(resultBands.yes.length, results.length)}</p>}
          <p className={repKit.notes}>{W.foot}</p>
        </>
      )}

      {act?.kind === 'pick' && (
        <FriendRequestWindow
          key={act.row.key}
          row={act.row}
          regs={regs}
          divisionName={divisionName}
          today={today}
          canDecide={canDecide}
          onClose={() => setAct(null)}
          onConfirm={async items => {
            const refused = await decide({ act: 'confirm', items }, [act.row.key]);
            if (refused) return refused;
            const match = regs.find(r => r.id === items[0].matchId);
            setAct(null);
            say(W.done.confirmed(first(act.row.asker), match ? first(match) : ''));
            return null;
          }}
        />
      )}
      {act?.kind === 'cant' && (
        <CantHonourWindow
          first={first(act.row.asker)}
          asker={playerName(act.row.asker)}
          asked={act.row.requests[0].code ? (act.row.match ? playerName(act.row.match) : askedPhrase(act.row.requests[0])) : askedText(act.row.requests[0]).replace(/[“”]/g, '')}
          otherDivision={act.row.marks.has('differentDivision')}
          onClose={() => setAct(null)}
          onSave={async (reason, note) => {
            const refused = await decide({ act: 'cantHonour', ids: idsOf(act.row), reason, note }, [act.row.key]);
            if (refused) return refused;
            setAct(null);
            say(W.done.cantHonour);
            return null;
          }}
        />
      )}
      {act?.kind === 'delete' && (
        <DeleteWindow
          row={act.row}
          index={act.index}
          onClose={() => setAct(null)}
          onDelete={async () => {
            const q = act.row.requests[act.index];
            const refused = await decide({ act: 'delete', ids: [q.id] }, [act.row.key]);
            if (refused) return refused;
            setAct(null);
            say(W.done.deleted);
            return null;
          }}
        />
      )}
    </>
  );
}

/** Delete request… (A12 / /legal): removes one request completely, so the club can answer a family's erasure ask. */
function DeleteWindow({ row, index, onClose, onDelete }: {
  row: QueueRow; index: number; onClose: () => void; onDelete: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const asker = index === 0 ? row.asker : row.partner!;
  const q = row.requests[index];
  const D = FRIEND_QUEUE_WORDS.del;
  return (
    <KitDialog
      kind="question"
      title={D.title(asker.playerFirstName)}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <DialogCancel>{D.cancel}</DialogCancel>
          <button type="button" className="btn btn-danger" disabled={busy}
            onClick={async () => { setBusy(true); setError(''); const r = await onDelete(); setBusy(false); if (r) setError(r); }}>
            {busy ? D.working : D.go}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <p className={ck.hint}>{D.body(asker.playerFirstName, askedPhrase(q))}</p>
    </KitDialog>
  );
}

