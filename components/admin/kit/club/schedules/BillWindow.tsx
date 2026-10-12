'use client';
/**
 * BILL THE TEAMS (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimen 14 step 4; Ask 23; plan §6 "Ask 23").
 * "The bill" in Fair shares opens it, FILLED IN from the schedule and its permit: the permit's budget line, the
 * permit's cost (or a part of it, when the club covers some), the split By the time each team got (each field at the
 * permit's price), and payments that FOLLOW THE TIME (One · Monthly · Every two months · Dates I choose — each payment
 * that team's slots in its months). The table under it is worked out as the server works it (`lib/club-schedule-bill.ts`,
 * the same pure arithmetic `computeBill` runs): each team's share and each payment, group rows, and the closing row that
 * says whether it matches the permit.
 *
 * ⚖ THE BILL RIDES WITH THE SCHEDULE (3d Ask 7b: a bill goes live when made, and its terms never change): this window
 * only adds it to the schedule. Finalize makes it ONE club allocation, each team with its own payments, in the same step
 * that books the slots. A final schedule's bill reads here, never changes — a change to the time is billed at Send the
 * changes (build question B).
 * ⚖ MONEY: the window opens only for those who hold the club's Accounting (`canMoney`); the route refuses anyone else.
 */
import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { RecordAction, repKit } from '../RepKit';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { fmt } from '@/lib/coach-money-summary';
import { formatStoredDate, isCalendarDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { billShares, closingRow, paymentPeriods, pricedMinutes, teamInstallments, type BillSlot, type PaymentPlan } from '@/lib/club-schedule-bill';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, closingRowLine, moneyCents as money } from '@/lib/club-schedule-words';
import { NO_GROUP, isStale, viewBillSlots, type ScheduleView } from '@/lib/club-schedule-view';
import { Statement } from './ScheduleParts';
import sch from './Schedules.module.css';

interface BillFromLine { id: string; description: string; categoryName: string; itemName: string | null; planned: number; allocated: number; left: number }

const PLANS: { id: PaymentPlan; label: string }[] = [
  { id: 'one', label: W.billOne }, { id: 'monthly', label: W.billMonthly }, { id: 'two_months', label: W.billTwoMonths }, { id: 'dates', label: W.billDates },
];

export default function BillWindow({ q, view, nameOf, onSaved, onStale, onClose }: {
  q: string;
  view: ScheduleView;
  nameOf: (teamId: string) => string;
  onSaved: (text: string) => void;
  /** The schedule changed under the window: the page re-reads it. */
  onStale?: () => void;
  onClose: () => void;
}) {
  const existing = view.bill;
  const pricing = view.pricing;
  const final = view.schedule.state === 'final';
  const [lines, setLines] = useState<{ year: string; lines: BillFromLine[] } | null>(null);
  const [lineId, setLineId] = useState<string>(existing?.lineId ?? pricing?.lineId ?? '');
  const [part, setPart] = useState<boolean>(existing?.amount != null || pricing?.fullHour == null);
  const [amountText, setAmountText] = useState(existing?.amount != null ? existing.amount.toFixed(2) : '');
  const [plan, setPlan] = useState<PaymentPlan>(existing?.plan ?? 'two_months');
  const firstOfStart = `${view.schedule.startsOn.slice(0, 7)}-01`;
  const [firstDue, setFirstDue] = useState(existing?.firstDue ?? firstOfStart);
  const [dates, setDates] = useState<string[]>(existing?.dates?.length ? existing.dates : [firstOfStart]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const savedLineId = existing?.lineId ?? null;
  useEffect(() => {
    if (final) return;
    let live = true;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<{ year: { name: string }; lines: BillFromLine[] }>(`/api/admin/accounting/bill-from?${q}`).then(r => {
      if (!live) return;
      if (r.ok) {
        setLines({ year: r.data.year.name, lines: r.data.lines });
        // The permit's line is only a suggestion: when this year's list can't bill to it, the window says "No line" and
        // sends none — never a line the select doesn't show (/review). A saved bill keeps its own.
        if (!savedLineId) setLineId(id => (id && !r.data.lines.some(l => l.id === id) ? '' : id));
      }
      else setLines({ year: '', lines: [] });
    }).catch(() => { if (live) setLines({ year: '', lines: [] }); });
    return () => { live = false; };
  }, [q, final, savedLineId]);

  // ── The bill, worked out as the server works it ──
  const billSlots: BillSlot[] = useMemo(() => viewBillSlots(view.slots), [view.slots]);
  const amount = part ? (Number(amountText.replace(/[$,\s]/g, '')) || null) : null;
  const priced = useMemo(() => pricedMinutes(billSlots), [billSlots]);
  const fullHour = pricing?.fullHour ?? null;
  const endsOn = view.schedule.endsOn;
  // Worked out once per change to the bill's inputs — each team's payments walk every slot it holds.
  const { rows, dues } = useMemo(() => {
    if (final && existing) {
      return { rows: existing.teams.map(t => ({ teamId: t.teamId, cents: t.cents, hours: t.pricedHours, installments: t.installments })), dues: existing.dues };
    }
    const shares = part && !(amount && amount > 0) ? null : billShares(priced, { fullHour, amount: amount && amount > 0 ? amount : null, teamOrder: view.teamOrder });
    const periods = paymentPeriods(plan, { firstDue: isCalendarDate(firstDue) ? firstDue : null, dates: plan === 'dates' ? dates.filter(isCalendarDate) : null, lastDay: endsOn });
    return {
      rows: shares ? [...shares.shares].map(([teamId, cents]) => ({ teamId, cents, hours: Math.round(((priced.get(teamId) ?? 0) / 60) * 100) / 100, installments: teamInstallments(teamId, cents, billSlots, periods) })) : [],
      dues: periods.map(p => p.due),
    };
  }, [final, existing, priced, fullHour, part, amount, view.teamOrder, plan, firstDue, dates, endsOn, billSlots]);
  const totalCents = rows.reduce((n, r) => n + r.cents, 0);
  const closing = closingRow(totalCents, pricing?.permitCost ?? existing?.permitCost ?? null);
  /** What the whole of the handed-out time comes to at the permit's price — the option's own figure. */
  const timePriceCents = fullHour != null ? billShares(priced, { fullHour, amount: null })?.timePriceCents ?? null : null;

  // A team's time, in the drawing's words: "25 full-field slots · 37.5 h" / "25 full + 25 half · 75 h".
  const kinds = useMemo(() => {
    const out = new Map<string, { full: number; half: number; all: number }>();
    for (const s of view.slots) {
      for (const t of s.teamIds) {
        const k = out.get(t) ?? out.set(t, { full: 0, half: 0, all: 0 }).get(t)!;
        k.all += 1;
        if (Math.abs(s.weight - 1) < 0.0001) k.full += 1;
        else if (Math.abs(s.weight - 0.5) < 0.0001) k.half += 1;
      }
    }
    return out;
  }, [view.slots]);
  const caption = (teamId: string, hours: number) => {
    const k = kinds.get(teamId) ?? { full: 0, half: 0, all: 0 };
    return W.billTeamCaption(k.full, k.half, k.all - k.full - k.half, hours);
  };
  const groupsOf = new Map<string, { name: string; teamIds: string[] }>();
  for (const r of rows) {
    const t = view.teams.find(x => x.id === r.teamId);
    const key = t?.groupId ?? NO_GROUP;
    (groupsOf.get(key) ?? groupsOf.set(key, { name: t?.groupName ?? W.notInGroup, teamIds: [] }).get(key)!).teamIds.push(r.teamId);
  }
  const grouped = [...groupsOf.keys()].some(k => k !== NO_GROUP);
  const payOf = (teamIds: string[], due: string) => rows.filter(r => teamIds.includes(r.teamId))
    .reduce((n, r) => n + Math.round((r.installments.find(i => i.dueDate === due)?.amount ?? 0) * 100), 0);
  const line = lines?.lines.find(l => l.id === lineId) ?? null;
  const word = line?.itemName ?? line?.description ?? null;

  const problem = (): string | null => {
    if (part && !(amount && amount > 0)) return W.billNeedAmount;
    if (!rows.length) return pricing?.fullHour == null ? W.billNeedAmount : W.billNoTimeYet;
    if (plan === 'dates' ? !dates.some(isCalendarDate) : !isCalendarDate(firstDue)) return plan === 'dates' ? W.billNeedDates : W.billNeedFirst;
    return null;
  };
  async function save(bill: object | null) {
    if (busy) return;
    if (bill) { const p = problem(); if (p) { setError(p); return; } }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ version: number }>(`/api/admin/schedules/${encodeURIComponent(view.schedule.id)}?${q}`,
        jsonInit('PATCH', { action: 'bill', version: view.schedule.version, bill }));
      if (!r.ok) { if (isStale(r.data)) onStale?.(); setError(refusalText(r.data, R.notSaved)); setBusy(false); return; }
      onSaved(bill ? W.billAdded : W.billRemoved);
    } catch {
      setError(R.notSaved);
      setBusy(false);
    }
  }
  const billBody = () => ({
    lineId: lineId || null, permitId: pricing?.permitId ?? null, amount: part ? amount : null, plan,
    firstDue: plan === 'dates' ? null : firstDue, dates: plan === 'dates' ? [...new Set(dates.filter(isCalendarDate))].sort() : null,
  });

  const half = pricing?.fullHour != null && view.slots.some(s => Math.abs(s.weight - 0.5) < 0.0001) ? fmt(pricing.fullHour / 2) : null;
  const table = (
    <div className={repKit.tableFrame}>
      <table className={repKit.table} aria-label={W.billTitle}>
        <thead>
          <tr>
            <th scope="col">{W.colTeam}</th>
            <th scope="col" className={repKit.num}>{W.colShare}</th>
            {dues.map(d => <th key={d} scope="col" className={repKit.num}>{formatStoredDate(d, { withYear: false })}</th>)}
          </tr>
        </thead>
        <tbody>
          {(grouped ? [...groupsOf.keys()] : ['~all']).flatMap(key => {
            const g = grouped ? groupsOf.get(key)! : { name: '', teamIds: rows.map(r => r.teamId) };
            const head = grouped ? [(
              <tr key={`g-${key}`} className={sch.grp}>
                <td><b>{g.name}</b> <span className={repKit.dim}>· {pluralize(g.teamIds.length, 'team')}</span></td>
                <td className={repKit.num}><b>{money(rows.filter(r => g.teamIds.includes(r.teamId)).reduce((n, r) => n + r.cents, 0))}</b></td>
                {dues.map(d => <td key={d} className={repKit.num}><b>{money(payOf(g.teamIds, d))}</b></td>)}
              </tr>
            )] : [];
            return [...head, ...g.teamIds.map(id => {
              const r = rows.find(x => x.teamId === id)!;
              return (
                <tr key={id}>
                  <td>{nameOf(id)}<span className={sch.billCaption}>{caption(id, r.hours)}</span></td>
                  <td className={repKit.num}>{money(r.cents)}</td>
                  {dues.map(d => <td key={d} className={repKit.num}>{money(Math.round((r.installments.find(i => i.dueDate === d)?.amount ?? 0) * 100))}</td>)}
                </tr>
              );
            })];
          })}
          <tr className={sch.grp}>
            <td><b>{pluralize(rows.length, 'team')}</b></td>
            <td className={repKit.num}><b>{money(totalCents)}</b></td>
            {dues.map(d => <td key={d} className={repKit.num}><b>{money(payOf(rows.map(r => r.teamId), d))}</b></td>)}
          </tr>
        </tbody>
      </table>
      <p className={repKit.notes}>{closingRowLine(closing)}</p>
    </div>
  );

  if (final && existing) {
    return (
      <KitDialog kind="form" wide eyebrow={view.schedule.name} title={W.billTitle} onClose={onClose}>
        {table}
        <p className={ck.hint}>{R.billFinal}</p>
      </KitDialog>
    );
  }

  return (
    <KitDialog
      kind="form"
      wide
      eyebrow={view.schedule.name}
      title={W.billTitle}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void save(billBody())} disabled={busy}>{existing ? W.billSave : W.billAdd}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <div className={sch.pair}>
        <label className={ck.field} htmlFor="bill-from">
          <span className={ck.label}>{W.billFrom}</span>
          <select id="bill-from" className={ck.select} value={lineId} onChange={e => setLineId(e.target.value)} disabled={!lines}>
            <option value="">{lines ? W.billNoLine : W.billLoading}</option>
            {(lines?.lines ?? []).map(l => <option key={l.id} value={l.id}>{`${l.description}${lines?.year ? ` · ${lines.year}` : ''}`}</option>)}
            {lineId && lines && !lines.lines.some(l => l.id === lineId) && <option value={lineId}>{W.billNoLine}</option>}
          </select>
          {line && <span className={ck.hint}>{(lineId === pricing?.lineId ? W.billFromHint : W.billFromOther)(fmt(line.planned), fmt(line.left))}</span>}
        </label>
        <label className={ck.field} htmlFor="bill-for">
          <span className={ck.label}>{W.billFor}</span>
          <select id="bill-for" className={ck.select} value={part ? 'part' : 'whole'} onChange={e => setPart(e.target.value === 'part')} disabled={pricing?.fullHour == null}>
            {pricing?.fullHour != null && <option value="whole">{timePriceCents != null ? W.billWhole(money(timePriceCents)) : W.billWholeTime}</option>}
            <option value="part">{W.billPart}</option>
          </select>
          <span className={ck.hint}>{pricing?.fullHour == null ? W.billNoPermitHint : W.billPartHint}</span>
        </label>
      </div>
      {part && (
        <label className={ck.field} htmlFor="bill-amount">
          <span className={ck.label}>{W.billAmount}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="bill-amount" className={ck.input} inputMode="decimal" placeholder="$0.00" value={amountText} onChange={e => setAmountText(e.target.value)} />
        </label>
      )}
      <div className={sch.pair}>
        <label className={ck.field} htmlFor="bill-split">
          <span className={ck.label}>{W.billSplit}</span>
          <select id="bill-split" className={ck.select} value="time" onChange={() => {}}>
            <option value="time">{W.billSplitTime}</option>
          </select>
          <span className={ck.hint}>{pricing?.fullHour != null ? W.billSplitHint(fmt(pricing.fullHour), half) : W.billSplitHintPlain}</span>
        </label>
        <div className={ck.field}>
          <span className={ck.label} id="bill-pay-label">{W.billPayments}</span>
          <div className={sch.pair}>
            <select className={ck.select} aria-labelledby="bill-pay-label" value={plan} onChange={e => setPlan(e.target.value as PaymentPlan)}>
              {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {plan !== 'dates' && (
              <input type="date" className={ck.input} aria-label={W.billFirstDue} value={firstDue} onChange={e => setFirstDue(e.target.value)} />
            )}
          </div>
          {plan === 'dates' && (
            <div className={sch.chips}>
              {dates.map((d, i) => (
                <input key={i} type="date" className={ck.input} aria-label={`${W.billDates} ${i + 1}`} value={d}
                  onChange={e => setDates(ds => ds.map((x, k) => (k === i ? e.target.value : x)))} />
              ))}
              <button type="button" className={sch.door} onClick={() => setDates(ds => [...ds, ''])}>{W.billAddDate}</button>
            </div>
          )}
          <span className={ck.hint}>{W.billPaymentsHint[plan]}</span>
        </div>
      </div>
      {rows.length > 0 ? table : <p className={ck.hint}>{problem() ?? W.billNoTimeYet}</p>}
      <Statement lead={W.billStatementLead} rest={W.billStatement(dues.length, word)} />
      {existing && (
        <div className={sch.ends}>
          <RecordAction icon={<Trash2 size={14} aria-hidden />} onClick={() => void save(null)} disabled={busy}>{W.billRemove}</RecordAction>
        </div>
      )}
    </KitDialog>
  );
}
