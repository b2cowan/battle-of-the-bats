'use client';
/**
 * NEW ALLOCATION, IN THE LINE'S WINDOW (Club Tier Stage 3c, session 2 — hub v46 specimen 6; Ask 6, S3C-09, C17, C10).
 *
 * One form for both doors (3a/3b: one way to bill teams, not two):
 *   · FROM A LINE — the line window's "Allocate $X" turns the window into this form: the head says what is billed and
 *     from where (what is left, what was already allocated), the body is the form, the foot Cancel (back to the line,
 *     nothing made) and the lime Create allocation. No step bar: the line's facts were on screen a moment ago. The
 *     amount starts at what is left and can't go above it (the server refuses above it too, 409 `over_line`, under
 *     the line's lock).
 *   · FROM ALLOCATIONS — the same window asks first what it bills from: a cost line on the open year's plan with
 *     something left (each with what's left), or "an off-plan bill". Picking a line fills the head and caps the amount.
 *     Nothing replaces the pasted ledger-entry id (C17): no screen ever read it.
 *
 * The form (a create ASKS — nothing saves until Create, 2026-09-24): Name, Amount, Split (Evenly · By amount · By
 * percentage · By sessions) and Pay by (One payment, or installments with their dates), chosen ONCE per bill; then
 * the teams as a FORM TABLE (the shared part, `components/shared/FormTable`): Team · Share · Due; every team that can
 * be billed ticked; Share an input under By amount, By percentage or By sessions; a row expands in place to give that
 * team its own payments, which keep their shape as its share moves (`followShare`, §283 W8) and have a plain way back
 * ("Use the bill's schedule"); the closing row sums the ticked teams and says the difference from the amount. Labels in
 * sentence case; no "(optional)"; required marked with the asterisk; "Season", never "Program Year".
 *
 * PICKED BY GROUP (Ask 11, owner 2026-10-08 — "it is very manual to tick and untick every team … can we select groups
 * (i.e. … 40% to one group and 60% to another and update manually after)?"):
 *   · the teams sit under their rep-team GROUPS, in the club's own group order (Rep Teams'), teams in no group last
 *     under "Not in a group"; a heading's box ticks its group (checked, mixed, empty); All · None beside "Team". A club
 *     with no groups keeps the flat list with All · None;
 *   · under By percentage or By amount a heading takes a figure of its own and spreads it evenly over its ticked teams
 *     (`spreadGroupFigure`, exact to the hundredth or the cent); retype any team and the heading shows the group's sum;
 *     tick or untick a team and a typed group figure spreads again. A typing aid only: the body still sends one value
 *     per team, and the group is never stored on the bill;
 *   · teams in age order inside a group (9U before 11U — the list sorted as text, 9U AA after 16U AA);
 *   · the season is a quiet note beside the team's name, not a column; Due speaks only for a team paying on its own
 *     schedule ("Its own · 3 payments") — Pay by already says when the bill is due;
 *   · a team with no running season leaves the list (S3C-09 still holds: only a RUNNING season is billed, the server
 *     refuses another): one line under it, "2 teams aren't running a season", opens to name each and when it closed;
 *   · the button says what it bills ("Bill 7 teams · $1,500.00"), and a refusal sits beside it (`FormError` in the
 *     window's foot, KitDialog's reason slot).
 *
 * ⚠ NO FIGURE IS AUTHORITATIVE HERE: the shares shown are worked out in cents the server's way (`shareCents`, the
 * one split rule in lib/club-bill-split.ts) so the table adds up as typed; the server splits again and is the one
 * that writes (`club_allocation_create`, the allocation and its line link in ONE step).
 */
import { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit, useDeferredLoad } from '../RepKit';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { followShare, shareCents, spreadGroupFigure } from '@/lib/club-bill-split';
import { toCents, toDollars } from '@/lib/coach-register';
import { NEW_ALLOCATION_WORDS as W } from '@/lib/club-money-words';
import { FormError, jsonInit, money, moneyFetch, moneyKit, parseAmount, refusalText } from './MoneyKit';
import cr from './ClubReport.module.css';

type Split = 'even' | 'fixed' | 'percentage' | 'sessions';
const SPLITS: { id: Split; label: string }[] = [
  { id: 'even', label: W.splitEven },
  { id: 'fixed', label: W.splitFixed },
  { id: 'percentage', label: W.splitPercent },
  { id: 'sessions', label: W.splitSessions },
];

interface TeamOption {
  id: string; name: string;
  /** Its rep-team group and the club's order for it (Ask 11), or null. */
  group: { id: string; name: string; order: number } | null;
  season: { id: string; name: string } | null;
  lastSeason: { name: string; closedOn: string | null } | null;
}

/** The heading key of the teams in no group. */
const NO_GROUP = '~none';
/** Age order: "9U AA" before "11U AA" (a text sort put it after "16U AA"), then the name. */
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
/** The club's group order (Rep Teams'), then age order inside each group; teams in no group last. */
const teamOrder = (a: TeamOption, b: TeamOption) => {
  if (!a.group !== !b.group) return a.group ? -1 : 1;
  if (a.group && b.group && a.group.id !== b.group.id) {
    return a.group.order - b.group.order || byName(a.group.name, b.group.name) || a.group.id.localeCompare(b.group.id);
  }
  return byName(a.name, b.name);
};
const groupKeyOf = (t: TeamOption) => t.group?.id ?? NO_GROUP;
interface BillFromLine { id: string; description: string; categoryName: string; itemName: string | null; planned: number; allocated: number; left: number }
/** One of a team's own payments, as typed. */
interface OwnPayment { dueDate: string; amount: string }

/** What the window bills from, when opened from a line: the line, its year, what's left and what's allocated. */
export interface AllocateFromLine {
  id: string; description: string; left: number; allocated: number; yearName: string;
}

const MAX_AMOUNT = 9_999_999.99;

/** "33.33" → 33.33; anything not a positive number → null. */
const positive = (s: string): number | null => {
  const n = Number(s.replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function AllocationWindow({ q, line, onMade, onCancel }: {
  q: string;
  /** From a line (its window turned into this form); absent from the Allocations tab (the form asks Bill from). */
  line?: AllocateFromLine;
  /** Created: the sentence the floating pill says, once. */
  onMade: (text: string, allocationId: string) => void;
  /** Cancel, ×, Escape, Back: nothing is made (from a line, back to the line). */
  onCancel: () => void;
}) {
  const isPhone = useIsPhone();

  const [error, setError] = useState('');

  // ── What it bills from (from Allocations only) ──
  const [billFrom, setBillFrom] = useState<{ year: { key: string; name: string }; lines: BillFromLine[] } | null>(null);
  const [pick, setPick] = useState<string>(''); // a line id, 'off', or '' (not chosen)
  const loadBillFrom = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<{ year: { key: string; name: string }; lines: BillFromLine[] }>(`/api/admin/accounting/bill-from?${q}`).catch(() => null);
    if (r?.ok) setBillFrom(r.data);
    else setError('What this can bill from couldn’t be loaded. Close this and try again.');
  }, [q]);
  useDeferredLoad(!line, loadBillFrom);
  const picked = line ? null : billFrom?.lines.find(l => l.id === pick) ?? null;
  const source: AllocateFromLine | null = line ?? (picked ? {
    id: picked.id, description: picked.description, left: picked.left, allocated: picked.allocated, yearName: billFrom?.year.name ?? '',
  } : null);
  const offPlan = !line && pick === 'off';

  // ── The teams ──
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const loadTeams = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<{ teams: TeamOption[] }>(`/api/admin/accounting/team-options?${q}`).catch(() => null);
    if (!r?.ok) { setTeamsFailed(true); return; }
    setTeams(r.data.teams);
    setTicked(new Set(r.data.teams.filter(t => t.season).map(t => t.id)));
  }, [q]);
  useDeferredLoad(true, loadTeams);

  // ── The bill ──
  const [name, setName] = useState(line?.description ?? '');
  const [amountText, setAmountText] = useState(line ? line.left.toFixed(2) : '');
  const [split, setSplit] = useState<Split>('even');
  /** The bill's due dates — one for One payment, several for installments (their count is the schedule). */
  const [dates, setDates] = useState<string[]>(['']);
  const payments = dates.length;
  const [values, setValues] = useState<Record<string, string>>({});
  /** A team's own payments, and the share they were last made for (`forC`, cents): see `ownRows`. */
  const [own, setOwn] = useState<Record<string, { rows: OwnPayment[]; forC: number }>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  /** A group's figure as typed on its heading (Ask 11), by group key — spread over the group's ticked teams. */
  const [groupTyped, setGroupTyped] = useState<Record<string, string>>({});
  /** The line naming the teams with no running season, opened. */
  const [noSeasonOpen, setNoSeasonOpen] = useState(false);

  // ── The teams that can be billed, in the club's group order and age order; the rest named under the list ──
  const billable = useMemo(() => (teams ?? []).filter(t => t.season).sort(teamOrder), [teams]);
  const noSeason = useMemo(() => (teams ?? []).filter(t => !t.season).sort((a, b) => byName(a.name, b.name)), [teams]);
  /** Headings only when the club sorts its teams into groups; a club with none keeps the flat list. */
  const groupKeys = useMemo(
    () => (billable.some(t => t.group) ? [...new Set(billable.map(groupKeyOf))] : []),
    [billable],
  );
  const membersOf = (key: string) => billable.filter(t => groupKeyOf(t) === key);

  /** Spread a group's typed figure over its ticked teams (exact to the hundredth or the cent). */
  const fillGroup = (key: string, typed: string, tickedNow: ReadonlySet<string>) => {
    if (split !== 'percentage' && split !== 'fixed') return;
    const members = membersOf(key).filter(t => tickedNow.has(t.id));
    const parts = spreadGroupFigure(typed, members.length, split);
    setValues(v => {
      const next = { ...v };
      members.forEach((t, i) => { next[t.id] = parts ? parts[i] : ''; });
      return next;
    });
  };
  /** A new set of ticked teams: every group with a typed figure spreads it again over its teams now ticked. */
  const tickTo = (next: Set<string>) => {
    setTicked(next);
    for (const [key, typed] of Object.entries(groupTyped)) fillGroup(key, typed, next);
  };
  const tickTeam = (id: string, on: boolean) => {
    const next = new Set(ticked ?? []);
    if (on) next.add(id); else next.delete(id);
    tickTo(next);
  };
  const tickGroup = (key: string, on: boolean) => {
    const next = new Set(ticked ?? []);
    for (const t of membersOf(key)) { if (on) next.add(t.id); else next.delete(t.id); }
    tickTo(next);
  };
  /** A team's own figure, retyped: its group heading now shows the group's sum instead of what was typed there. */
  const setTeamValue = (t: TeamOption, text: string) => {
    setValues(v => ({ ...v, [t.id]: text }));
    const key = groupKeyOf(t);
    if (groupTyped[key] != null) setGroupTyped(g => { const x = { ...g }; delete x[key]; return x; });
  };
  const setGroupFigure = (key: string, text: string) => {
    setGroupTyped(g => ({ ...g, [key]: text }));
    fillGroup(key, text, ticked ?? new Set());
  };

  const amount = parseAmount(amountText, MAX_AMOUNT);
  const totalC = amount != null ? toCents(amount) : 0;
  // In a memo of its own: the React compiler can't tell `amount` is a number, so a bare call reading it in render
  // counts as a possible change to it, and the window's memos are skipped (react-hooks/preserve-manual-memoization).
  const amountWords = useMemo(() => (amount != null ? money(amount) : null), [amount]);

  const pickLine = (id: string) => {
    setPick(id);
    const l = billFrom?.lines.find(x => x.id === id);
    if (l) {
      setName(n => (n.trim() && !billFrom?.lines.some(x => x.description === n) ? n : l.description));
      setAmountText(l.left.toFixed(2));
    }
  };

  const setPaymentCount = (n: number) => setDates(d => Array.from({ length: n }, (_, i) => d[i] ?? ''));

  // In the order on screen, so the server's leftover cent goes to the first team the treasurer sees (Evenly's rule).
  const inBill = useMemo(() => billable.filter(t => ticked?.has(t.id)), [billable, ticked]);

  /** Each ticked team's share, in cents — the server's one rule (`shareCents`), so the closing row adds up exactly. */
  const sharesC = useMemo((): Map<string, number> => {
    const out = new Map<string, number>();
    if (inBill.length === 0) return out;
    if (split === 'fixed') {
      for (const t of inBill) { const v = positive(values[t.id] ?? ''); out.set(t.id, v == null ? 0 : toCents(v)); }
      return out;
    }
    const weights = inBill.map(t => (split === 'even' ? 1 : positive(values[t.id] ?? '') ?? 0));
    const cents = shareCents(totalC, weights);
    inBill.forEach((t, i) => out.set(t.id, cents[i]));
    return out;
  }, [inBill, split, values, totalC]);

  /** A team's own payments as they stand: redivided to its share when the share has moved since they were made
   *  (`followShare` — they keep their shape, not their dollars); null when it pays on the bill's schedule. */
  const ownRows = (id: string): OwnPayment[] | null => {
    const o = own[id];
    if (!o) return null;
    const next = followShare(o.rows.map(r => toCents(positive(r.amount) ?? 0)), o.forC, sharesC.get(id) ?? 0);
    return next ? o.rows.map((r, i) => ({ ...r, amount: toDollars(next[i]).toFixed(2) })) : o.rows;
  };
  const dropOwn = (id: string) => setOwn(o => { const x = { ...o }; delete x[id]; return x; });

  const sumC = [...sharesC.values()].reduce((a, b) => a + b, 0);
  // In hundredths of a percent, the server's own rule (club-bill-split): 33.33 × 3 is 99.99, within a hundredth.
  const percentHundredths = split === 'percentage'
    ? Math.round(inBill.reduce((s, t) => s + (positive(values[t.id] ?? '') ?? 0), 0) * 100) : 10000;

  // The closing row's difference, in words — and whether it is one (anything but "nothing left over").
  const diff = ((): { words: string; bad: boolean } => {
    if (inBill.length === 0) return { words: '', bad: false };
    if (split === 'percentage' && Math.abs(percentHundredths - 10000) > 1) {
      const d = String(Math.abs(10000 - percentHundredths) / 100);
      return { words: percentHundredths < 10000 ? W.percentShort(d) : W.percentOver(d), bad: true };
    }
    const d = totalC - sumC;
    if (d === 0) return { words: W.nothingLeft, bad: false };
    return { words: d > 0 ? W.short(money(toDollars(d))) : W.over(money(toDollars(-d))), bad: true };
  })();

  /** Why Create can't go yet, in words — or null. A create asks: the reason is said when Create is pressed. */
  const problem = (): string | null => {
    if (!line && !source && !offPlan) return W.pickLine;
    if (!name.trim()) return 'Give the allocation a name.';
    if (amount == null) return 'The amount must be above zero.';
    if (source && amount > source.left + 0.005) return W.amountUpTo(money(source.left));
    if (billable.length === 0) return W.nothingToBill;
    if (inBill.length === 0) return W.pickTeams;
    if (dates.some(d => !d)) return W.pickDue;
    if (split !== 'even' && inBill.some(t => positive(values[t.id] ?? '') == null)) {
      return split === 'fixed' ? 'Give each ticked team its share.' : split === 'percentage' ? 'Give each ticked team its percentage.' : 'Give each ticked team its number of sessions.';
    }
    if (diff.bad) return `The teams’ shares don’t add up: ${diff.words}.`;
    for (const t of inBill) {
      const rows = ownRows(t.id);
      if (!rows) continue;
      if (rows.some(r => !r.dueDate || positive(r.amount) == null)) return `Each of ${t.name}’s own payments needs a date and an amount.`;
      const c = rows.reduce((s, r) => s + toCents(positive(r.amount) ?? 0), 0);
      if (c !== (sharesC.get(t.id) ?? 0)) return `${t.name}’s own payments add up to ${money(toDollars(c))}, and its share is ${money(toDollars(sharesC.get(t.id) ?? 0))}.`;
    }
    return null;
  };

  async function create() {
    if (busy) return;
    const p = problem();
    if (p) { setError(p); return; }
    setBusy(true); setError('');
    try {
      const body = {
        description: name.trim(),
        amount,
        split: { method: split },
        schedule: payments === 1 ? { kind: 'one', dueDate: dates[0] } : { kind: 'installments', dueDates: dates },
        teams: inBill.map(t => {
          const mine = ownRows(t.id);
          return {
            teamId: t.id,
            programYearId: t.season!.id,
            ...(split !== 'even' ? { value: positive(values[t.id] ?? '') } : {}),
            ...(mine ? { installments: mine.map(r => ({ dueDate: r.dueDate, amount: positive(r.amount) })) } : {}),
          };
        }),
        sourceBudgetLineId: source?.id ?? null,
        notes: notes.trim() || null,
      };
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ allocation: { id: string; totalAmount: number } }>(`/api/admin/rep-teams/allocations?${q}`, jsonInit('POST', body));
      if (!r.ok) { setError(refusalText(r.data, W.failed)); setBusy(false); return; }
      onMade(W.made(money(r.data.allocation.totalAmount), inBill.length), r.data.allocation.id);
    } catch {
      setError(W.offline);
      setBusy(false);
    }
  }

  // ── The teams' rows ──
  /** Due speaks only for a team paying on a schedule of its own: Pay by already says when the bill is due. */
  const ownDue = (t: TeamOption) => {
    const rows = ownRows(t.id);
    return rows ? W.ownDue(rows.length) : null;
  };
  const shareCell = (t: TeamOption) => {
    const c = sharesC.get(t.id) ?? 0;
    if (split === 'even') return money(toDollars(c));
    return (
      <span className={moneyKit.shareCell}>
        <input className={`${ck.input} ${moneyKit.shareInput}`} inputMode="decimal" value={values[t.id] ?? ''}
          aria-label={`${t.name}’s ${split === 'fixed' ? 'share' : split === 'percentage' ? 'percentage' : 'sessions'}`}
          placeholder={split === 'fixed' ? '$0.00' : '0'}
          onChange={e => setTeamValue(t, e.target.value)} />
        {split === 'percentage' && <span className={moneyKit.shareUnit}>%</span>}
        {split !== 'fixed' && <span className={moneyKit.shareFigure}>{money(toDollars(c))}</span>}
      </span>
    );
  };
  /** A group heading's Share: its own figure under By percentage or By amount (spread over its ticked teams), and
   *  the group's total. What it shows: the figure as typed, or — once a team was retyped — the group's sum. */
  const groupShareCell = (key: string, label: string, compact = false) => {
    const on = membersOf(key).filter(t => ticked?.has(t.id));
    const totalOn = on.reduce((s, t) => s + (sharesC.get(t.id) ?? 0), 0);
    if (on.length === 0) return '';
    if (split !== 'percentage' && split !== 'fixed') return money(toDollars(totalOn));
    const typed = groupTyped[key];
    const sumUnits = on.every(t => positive(values[t.id] ?? '') != null)
      ? on.reduce((s, t) => s + Math.round((positive(values[t.id] ?? '') ?? 0) * 100), 0) : null;
    const shown = typed ?? (sumUnits == null ? '' : split === 'fixed' ? (sumUnits / 100).toFixed(2) : String(sumUnits / 100));
    return (
      <span className={moneyKit.shareCell}>
        <input className={`${ck.input} ${moneyKit.shareInput}`} inputMode="decimal" value={shown}
          aria-label={W.groupFigure(label, split === 'fixed' ? 'share' : 'percentage')}
          placeholder={split === 'fixed' ? '$0.00' : '0'}
          onChange={e => setGroupFigure(key, e.target.value)} />
        {split === 'percentage' && <span className={moneyKit.shareUnit}>%</span>}
        {split === 'percentage' && !compact && <span className={moneyKit.shareFigure}>{money(toDollars(totalOn))}</span>}
      </span>
    );
  };
  const ownForm = (t: TeamOption) => {
    const mine = ownRows(t.id);
    const rows = mine ?? Array.from({ length: Math.max(payments, 2) }, (_, i) => ({ dueDate: dates[i] ?? '', amount: '' }));
    const shareC = sharesC.get(t.id) ?? 0;
    // An edit is made for the share as it stands now: if the share moves later, these redivide (`ownRows`). While the
    // share has no figure (a percentage being retyped) an edit keeps the share the payments were made for (/review).
    const setRows = (next: OwnPayment[]) => setOwn(o => ({ ...o, [t.id]: { rows: next, forC: shareC > 0 ? shareC : o[t.id]?.forC ?? 0 } }));
    const evenly = (n: number) => {
      const cents = shareCents(shareC, Array.from({ length: n }, () => 1));
      return cents.map((c, i) => ({ dueDate: rows[i]?.dueDate ?? dates[i] ?? '', amount: toDollars(c).toFixed(2) }));
    };
    const sum = rows.reduce((s, r) => s + toCents(positive(r.amount) ?? 0), 0);
    return (
      <div className={moneyKit.ownPayments}>
        <label className={moneyKit.ownCount}>
          <span>{W.paysIn}</span>
          <select className={ck.select} value={mine ? rows.length : 0}
            onChange={e => {
              const n = Number(e.target.value);
              if (n === 0) { dropOwn(t.id); return; }
              setRows(evenly(n));
            }}>
            <option value={0}>{W.billsSchedule(payments === 1 ? W.payOne : W.payInstallments(payments))}</option>
            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{W.ownSchedule(n)}</option>)}
          </select>
        </label>
        {mine && rows.map((r, i) => (
          <span key={i} className={moneyKit.ownRow}>
            <input type="date" className={ck.input} value={r.dueDate} aria-label={`${t.name}, payment ${i + 1} due`}
              onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, dueDate: e.target.value } : x)))} />
            <input className={ck.input} inputMode="decimal" value={r.amount} aria-label={`${t.name}, payment ${i + 1} amount`}
              onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
          </span>
        ))}
        {mine && sum !== shareC && <span className={cr.lateCaption}>{W.paymentsAddUp(money(toDollars(sum)), money(toDollars(shareC)))}</span>}
        {/* The way back, said plainly: the team pays on the bill's schedule again, and its row folds. */}
        {mine && (
          <button type="button" className={`${ck.link} ${moneyKit.ownBack}`}
            onClick={e => {
              // The row folds and this button goes with it: hand the focus to the row's chevron, not the page (/review).
              const dialog = e.currentTarget.closest('[role="dialog"]');
              dropOwn(t.id);
              setOpen(s => { const n = new Set(s); n.delete(t.id); return n; });
              requestAnimationFrame(() => dialog?.querySelector<HTMLButtonElement>(
                `button[aria-expanded][aria-label="${CSS.escape(W.ownPayments(t.name))}"]`)?.focus());
            }}>
            {W.useBillsSchedule}
          </button>
        )}
      </div>
    );
  };

  // Only teams with a running season are rows (S3C-09); the rest are named under the list.
  const rows: FormTableRow[] = billable.map(t => {
    const isIn = !!ticked?.has(t.id);
    const own = isIn ? ownDue(t) : null;
    return {
      key: t.id,
      name: t.name,
      group: groupKeys.length ? groupKeyOf(t) : undefined,
      nameNote: t.season!.name,
      ticked: isIn,
      tickLabel: W.tick(t.name),
      onTick: next => tickTeam(t.id, next),
      cells: {
        share: isIn ? shareCell(t) : '',
        due: own ? <span className={moneyKit.ownDue}>{own}</span> : '',
      },
      // The share is at the record's end (its figure, and the dollars beside a percentage), so the line is the season.
      phoneLine: [t.season!.name, own].filter(Boolean).join(' · '),
      phoneFigure: isIn ? (split === 'even' ? money(toDollars(sharesC.get(t.id) ?? 0)) : shareCell(t)) : undefined,
      expand: isIn ? {
        open: open.has(t.id),
        label: W.ownPayments(t.name),
        onToggle: () => setOpen(s => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; }),
        content: ownForm(t),
      } : undefined,
    };
  });
  const groups: FormTableGroup[] = groupKeys.map(key => {
    const members = membersOf(key);
    const label = key === NO_GROUP ? W.notInGroup : members[0].group!.name;
    const on = members.filter(t => ticked?.has(t.id)).length;
    const cell = groupShareCell(key, label);
    // A phone band has room for the figure only: the closing band above already says the total.
    const band = isPhone ? groupShareCell(key, label, true) : cell;
    return {
      key,
      label,
      count: W.teamsCount(members.length),
      state: on === 0 ? 'none' : on === members.length ? 'all' : 'some',
      onTick: next => tickGroup(key, next),
      tickLabel: W.tickGroup(label),
      cells: { share: cell },
      phoneFigure: band || undefined,
    };
  });
  const allNone = (
    <span className={moneyKit.allNone}>
      <button type="button" className={ck.link} aria-label={W.allLabel} onClick={() => tickTo(new Set(billable.map(t => t.id)))}>{W.all}</button>
      <span aria-hidden>·</span>
      <button type="button" className={ck.link} aria-label={W.noneLabel} onClick={() => tickTo(new Set())}>{W.none}</button>
    </span>
  );

  const eyebrow = source && line
    ? W.fromLineEyebrow(source.description, source.yearName, money(source.left), source.allocated > 0.005 ? money(source.allocated) : null)
    : W.eyebrow;
  const title = line ? W.fromLineTitle(line.description) : W.title;

  return (
    <KitDialog
      kind="form"
      wide
      eyebrow={eyebrow}
      title={title}
      onClose={onCancel}
      busy={busy}
      footerStart={!isPhone ? <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button> : undefined}
      footer={(
        <>
          {isPhone && <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button>}
          <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>
            {busy ? W.billing : W.bill(inBill.length, isPhone ? null : amountWords)}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      {!line && (
        <label className={ck.field} htmlFor="na-from">
          <span className={ck.label}>{W.billFrom}<span className={repKit.req} aria-hidden>*</span></span>
          <select id="na-from" className={ck.select} value={pick} onChange={e => (e.target.value === 'off' ? setPick('off') : pickLine(e.target.value))}>
            <option value="">{billFrom ? W.billFromPick(billFrom.year.name) : 'Loading…'}</option>
            {billFrom && billFrom.lines.length > 0 && (
              <optgroup label={W.billFromLines(billFrom.year.name)}>
                {billFrom.lines.map(l => <option key={l.id} value={l.id}>{l.description} · {W.lineLeft(money(l.left))}</option>)}
              </optgroup>
            )}
            <optgroup label={W.billFromNone}>
              <option value="off">{W.offPlan} · {W.offPlanDetail}</option>
            </optgroup>
          </select>
          {billFrom && billFrom.lines.length === 0 && <span className={ck.hint}>{W.noLinesLeft(billFrom.year.name)}</span>}
        </label>
      )}
      <div className={moneyKit.allocFields}>
        <label className={ck.field} htmlFor="na-name">
          <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="na-name" className={ck.input} value={name} maxLength={200} onChange={e => setName(e.target.value)} />
        </label>
        <label className={ck.field} htmlFor="na-amount">
          <span className={ck.label}>{W.amount}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="na-amount" className={`${ck.input} ${moneyKit.amountInput}`} inputMode="decimal" value={amountText} placeholder="$0.00"
            onChange={e => setAmountText(e.target.value)} />
          {source && <span className={ck.hint}>{W.amountUpTo(money(source.left))}</span>}
        </label>
        <label className={ck.field} htmlFor="na-split">
          <span className={ck.label}>{W.split}</span>
          {/* A group's figure was a percentage or an amount: a new split starts the headings over. */}
          <select id="na-split" className={ck.select} value={split} onChange={e => { setSplit(e.target.value as Split); setGroupTyped({}); }}>
            {SPLITS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <div className={ck.field}>
          <span className={ck.label} id="na-pay-label">{W.payBy}<span className={repKit.req} aria-hidden>*</span></span>
          <div className={moneyKit.payBy}>
            <select className={ck.select} aria-labelledby="na-pay-label" value={payments} onChange={e => setPaymentCount(Number(e.target.value))}>
              <option value={1}>{W.payOne}</option>
              {[2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{W.payInstallments(n)}</option>)}
            </select>
            {dates.map((d, i) => (
              <input key={i} type="date" className={ck.input} value={d} aria-label={payments === 1 ? W.dueOn : `${W.dueOn}, payment ${i + 1}`}
                onChange={e => setDates(ds => ds.map((x, k) => (k === i ? e.target.value : x)))} />
            ))}
          </div>
        </div>
      </div>

      {teamsFailed ? <p className={ck.hint}>The teams couldn’t be loaded. Close this and try again.</p>
        : !teams ? <p className={ck.loading}>Loading the teams…</p>
        : teams.length === 0 ? <p className={ck.hint}>The club has no teams to bill yet.</p>
        : (
          <>
            {isPhone && billable.length > 0 && <div className={moneyKit.teamsHead}><span className={ck.label}>{W.teams}</span>{allNone}</div>}
            {billable.length > 0 && (
              <FormTable
                ariaLabel={W.teamsLabel}
                expandLabel={W.ownPaymentsHead}
                leadLabel={<>{W.team}{allNone}</>}
                columns={[
                  { key: 'share', label: W.share, numeric: true, width: '34%' },
                  { key: 'due', label: W.dueOn, width: '22%' },
                ]}
                rows={rows}
                groups={groups}
                closing={{
                  label: W.teamsCount(inBill.length),
                  cells: {
                    share: money(toDollars(sumC)),
                    due: <span className={diff.bad ? cr.negative : repKit.dim}>{diff.words}</span>,
                  },
                  phone: `${W.teamsCount(inBill.length)} · ${money(toDollars(sumC))}`,
                  note: diff.words,
                  noteBad: diff.bad,
                }}
              />
            )}
            {/* The teams that can't be billed: out of the list, one line that opens to name them (Ask 11). */}
            {noSeason.length > 0 && (
              <div className={moneyKit.noSeason}>
                <button type="button" className={moneyKit.noSeasonToggle} aria-expanded={noSeasonOpen} onClick={() => setNoSeasonOpen(o => !o)}>
                  <ChevronDown size={15} aria-hidden className={noSeasonOpen ? moneyKit.noSeasonOpen : undefined} />
                  {W.noSeasonCount(noSeason.length)}
                </button>
                {noSeasonOpen && (
                  <ul className={moneyKit.noSeasonList}>
                    {noSeason.map(t => <li key={t.id}><b>{t.name}</b> · {W.noSeasonWhy(t.lastSeason)}</li>)}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

      <label className={ck.field} htmlFor="na-notes">
        <span className={ck.label}>{W.notes}</span>
        <input id="na-notes" className={ck.input} value={notes} maxLength={500} placeholder={W.notesHint} onChange={e => setNotes(e.target.value)} />
      </label>
    </KitDialog>
  );
}
