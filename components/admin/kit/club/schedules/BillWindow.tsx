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
 * A SCHEDULE ON SEVERAL PERMITS (Session C; drawing tab 5): each slot is priced at its own permit's price, or every slot at
 * one rate for all — "Price the time", shown only when the time has more than one price (P2 A). The total is the same
 * either way (P1 A); a typed part is shared by what each team's time costs, or by its hours (P3 A). Once made, the window
 * reads the rate each permit was billed at, and any permit billed later at its own price (P9 B).
 */
import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { RecordAction, repKit } from '../RepKit';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { fmt } from '@/lib/coach-money-summary';
import { formatStoredDate, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { closingRow, DEFAULT_PRICE_MODE, paymentPeriods, priceTheBill, pricedMinutes, pricedMinutesByPermit, teamInstallments, type BillSlot, type PaymentPlan, type PriceMode } from '@/lib/club-schedule-bill';
import { PART_WORDS, SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, closingRowLine, moneyCents as money } from '@/lib/club-schedule-words';
import { NO_GROUP, isStale, pricingHourOf, viewBillSlots, type ScheduleView } from '@/lib/club-schedule-view';
import { Statement } from './ScheduleParts';
import sch from './Schedules.module.css';
import DateInput from '@/components/shared/DateInput';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import BillLineNotice from './BillLineNotice';

interface BillFromLine { id: string; description: string; categoryName: string; itemName: string | null; planned: number; allocated: number; left: number }

const PLANS: { id: PaymentPlan; label: string }[] = [
  { id: 'one', label: W.billOne }, { id: 'monthly', label: W.billMonthly }, { id: 'two_months', label: W.billTwoMonths }, { id: 'dates', label: W.billDates },
];

export default function BillWindow({ q, view, addedPart = null, nameOf, onSaved, onReview, onStale, onClose }: {
  q: string;
  view: ScheduleView;
  /** An added part's bill (Phase 8, Session 3 — drawing tab 5): opened from Send the changes' "Bill it…". Its eyebrow is the
   *  part's own name ("Fall practices · Time added Nov 16"); only the statement differs — a bill of its own. */
  addedPart?: { label: string; parentName: string } | null;
  nameOf: (teamId: string) => string;
  onSaved: (text: string) => void;
  /** A schedule finalized WITHOUT a bill (13c): its terms go on to Send the bill, which makes the bill and tells the
   *  coaches. Nothing is saved here — the schedule stays final and the terms ride with the send. */
  onReview: (terms: object) => void;
  /** The schedule changed under the window: the page re-reads it. */
  onStale?: () => void;
  onClose: () => void;
}) {
  const existing = view.bill;
  const pricing = view.pricing;
  const final = view.schedule.state === 'final';
  /** Finalized with no bill: the window is a form again, and its button reviews the bill instead of saving it. */
  const late = final && !existing;
  const [lines, setLines] = useState<{ year: string; lines: BillFromLine[] } | null>(null);
  const [lineId, setLineId] = useState<string>(existing?.lineId ?? pricing?.lineId ?? '');
  const [partPicked, setPart] = useState<boolean>(existing?.amount != null || !(pricing?.permits ?? []).some(x => x.fullHour != null));
  const [amountText, setAmountText] = useState(existing?.amount != null ? existing.amount.toFixed(2) : '');
  const [plan, setPlan] = useState<PaymentPlan>(existing?.plan ?? 'one');
  const [mode, setMode] = useState<PriceMode>(existing?.mode ?? pricing?.mode ?? DEFAULT_PRICE_MODE);
  const firstOfStart = `${view.schedule.startsOn.slice(0, 7)}-01`;
  // A bill made late opens on today, never on a start-of-schedule date that has already passed.
  const firstDefault = late && firstOfStart < tournamentToday() ? tournamentToday() : firstOfStart;
  const [firstDue, setFirstDue] = useState(existing?.firstDue ?? firstDefault);
  const [dates, setDates] = useState<string[]>(existing?.dates?.length ? existing.dates : [firstDefault]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const savedLineId = existing?.lineId ?? null;
  useEffect(() => {
    if (final && !late) return;
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
  }, [q, final, late, savedLineId]);

  // ── The bill, worked out as the server works it ──
  const billSlots: BillSlot[] = useMemo(() => viewBillSlots(view.slots), [view.slots]);
  const priced = useMemo(() => pricedMinutes(billSlots), [billSlots]);
  const hourOf = useMemo(() => pricingHourOf(pricing), [pricing]);
  /** The whole of the handed-out time at its price (null when not all of it has one) — and whether it has more than one. */
  const timeBill = useMemo(() => priceTheBill(billSlots, { hourOf, mode, amount: null, teamOrder: view.teamOrder }), [billSlots, hourOf, mode, view.teamOrder]);
  const priceable = timeBill?.timePriceCents != null;
  // Time one permit prices and another does not has no whole-time price: the club types what the teams pay, never a window
  // with the amount field hidden and nothing to bill by (/review, Session C).
  const part = partPicked || (!priceable && [...priced.values()].some(m => m > 0));
  const amount = part ? (Number(amountText.replace(/[$,\s]/g, '')) || null) : null;
  const multi = !!timeBill?.multiPrice;
  const endsOn = view.schedule.endsOn;
  // Worked out once per change to the bill's inputs — each team's payments walk every slot it holds.
  const { rows, dues } = useMemo(() => {
    if (final && existing) {
      return { rows: existing.teams.map(t => ({ teamId: t.teamId, cents: t.cents, hours: t.pricedHours, installments: t.installments })), dues: existing.dues };
    }
    const shares = !part ? timeBill : amount && amount > 0 ? priceTheBill(billSlots, { hourOf, mode, amount, teamOrder: view.teamOrder }) : null;
    const periods = paymentPeriods(plan, { firstDue: isCalendarDate(firstDue) ? firstDue : null, dates: plan === 'dates' ? dates.filter(isCalendarDate) : null, lastDay: endsOn });
    return {
      rows: shares ? [...shares.shares].map(([teamId, cents]) => ({ teamId, cents, hours: Math.round(((priced.get(teamId) ?? 0) / 60) * 100) / 100, installments: teamInstallments(teamId, cents, billSlots, periods, shares.paymentWeight) })) : [],
      dues: periods.map(p => p.due),
    };
  }, [final, existing, priced, hourOf, mode, part, amount, view.teamOrder, plan, firstDue, dates, endsOn, billSlots, timeBill]);
  const totalCents = rows.reduce((n, r) => n + r.cents, 0);
  const closing = closingRow(totalCents, pricing?.permitCost ?? existing?.permitCost ?? null);
  /** What the whole of the handed-out time comes to at the permits' prices — the option's own figure. */
  const timePriceCents = timeBill?.timePriceCents ?? null;
  const permitsBehind = pricing?.permits.length ?? 0;
  const permitName = new Map((pricing?.permits ?? []).map(x => [x.id, x.name]));
  const byPermit = useMemo(() => pricedMinutesByPermit(billSlots), [billSlots]);
  /** "Milton spring $60.00 a full field, an hour · Halton Hills $90.00" — each permit behind the time, its own hour. */
  const eachHint = W.billPriceEachHint((pricing?.permits ?? []).filter(x => x.fullHour != null).map(x => ({ name: x.name, hour: fmt(x.fullHour!) })));
  // One rate (P1 A): the time at the permits’ prices over its full-field hours (rep teams only, as the bill counts them).
  const oneRateHour = timeBill && multi ? (timeBill.rate * 60) / 100 : null;
  const fullFieldHours = timeBill && multi ? timeBill.timePriceCents! / timeBill.rate / 60 : 0;

  // A team's time, in the drawing's words: "25 full-field slots · 37.5 h" / "25 full + 25 half · 56.3 h" / "50 shared
  // slots · 37.5 h" (Stage 11c: a slot it shares is its own kind — half a facility for the bill, whatever the field).
  const kinds = useMemo(() => {
    const out = new Map<string, { full: number; half: number; shared: number; all: number }>();
    for (const s of view.slots) {
      for (const t of s.teamIds) {
        const k = out.get(t) ?? out.set(t, { full: 0, half: 0, shared: 0, all: 0 }).get(t)!;
        k.all += 1;
        if (s.teamIds.length > 1) k.shared += 1;
        else if (Math.abs(s.weight - 1) < 0.0001) k.full += 1;
        else if (Math.abs(s.weight - 0.5) < 0.0001) k.half += 1;
      }
    }
    return out;
  }, [view.slots]);
  const caption = (teamId: string, hours: number) => {
    const k = kinds.get(teamId) ?? { full: 0, half: 0, shared: 0, all: 0 };
    // More than one price: the team's hours by permit, so "why does 15U AA pay more?" is answered in the row.
    if (multi) {
      const parts = [...(byPermit.get(teamId) ?? [])].filter(([, m]) => m > 0)
        .map(([id, m]) => `${Math.round((m / 60) * 10) / 10} ${permitName.get(id) ?? W.billNoLineName}`);
      return W.billTeamByPermit(k.all, parts);
    }
    return W.billTeamCaption(k.full, k.half, k.shared, k.all - k.full - k.half - k.shared, hours);
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
    if (!rows.length) return !priceable ? W.billNeedAmount : W.billNoTimeYet;
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
  const amountField = (
    <label className={ck.field} htmlFor="bill-amount">
      <span className={ck.label}>{W.billAmount}<span className={repKit.req} aria-hidden>*</span></span>
      <input id="bill-amount" className={ck.input} inputMode="decimal" placeholder="$0.00" value={amountText} onChange={e => setAmountText(e.target.value)} />
    </label>
  );
  const billBody = () => ({
    lineId: lineId || null, permitId: pricing?.permitId ?? null, amount: part ? amount : null, plan, mode,
    firstDue: plan === 'dates' ? null : firstDue, dates: plan === 'dates' ? [...new Set(dates.filter(isCalendarDate))].sort() : null,
  });

  const half = pricing?.fullHour != null && view.slots.some(s => Math.abs(s.weight - 0.5) < 0.0001) ? fmt(pricing.fullHour / 2) : null;
  const splitHint = multi
    ? (part ? (mode === 'one_rate' ? W.billSplitPartOne : W.billSplitPartEach) : (mode === 'one_rate' ? W.billSplitHintOne : W.billSplitHintEach))
    : pricing?.fullHour != null ? W.billSplitHint(fmt(pricing.fullHour), half) : W.billSplitHintPlain;
  /** The read-only view's terms (P9 B item 5): the rates kept, and a permit billed later at its own price. */
  const keptWords = (() => {
    const kept = existing?.kept ?? [];
    const first = kept.filter(k => !k.later), later = kept.filter(k => k.later);
    const list = (ks: typeof kept) => W.billPriceEachHint(ks.map(k => ({ name: k.permitName, hour: fmt(k.fullHour) })));
    const out: string[] = [];
    if (new Set(first.map(k => k.fullHour)).size > 1) out.push(W.billKeptEach(list(first)));
    else if (first.length > 1 && existing?.mode === 'one_rate') out.push(W.billKeptOne(fmt(first[0].fullHour)));
    if (later.length) out.push(W.billKeptLater(list(later)));
    return out;
  })();
  // The table, then its closing line UNDER the frame (inside it, the window's paragraph rule pressed it flush against the
  // frame's edges), and a step before the statement (owner 2026-10-13: "squished").
  const table = (
    <div className={sch.billTable}>
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
                    <td>{nameOf(id)}<span className={repKit.cellSub}>{caption(id, r.hours)}</span></td>
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
      </div>
      <p className={`${repKit.notes} ${sch.billNote}`}>{closingRowLine(closing, view.fairness.totals.open, permitsBehind)}</p>
    </div>
  );

  if (final && existing) {
    return (
      <KitDialog kind="form" size="wide" eyebrow={view.schedule.name} title={W.billTitle} onClose={onClose}>
        {table}
        {keptWords.map(w => <p key={w} className={ck.hint}>{w}</p>)}
        <p className={ck.hint}>{R.billFinal}</p>
      </KitDialog>
    );
  }

  return (
    <KitDialog
      kind="form"
      size="wide"
      eyebrow={view.schedule.name}
      title={W.billTitle}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => { if (!late) { void save(billBody()); return; } const p = problem(); if (p) setError(p); else onReview(billBody()); }} disabled={busy}>
            {late ? W.billLateGo : existing ? W.billSave : W.billAdd}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <div className={sch.pair}>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="bill-from">{W.billFrom}</label>
          {/* The portal's two-line dropdown (the Role picker's shape): the line's name, what it has planned and left on the
              line beneath. A native select cannot carry a second line. */}
          <SublinedChoice
            id="bill-from" label={W.billFrom} variant="toolbar" disabled={!lines}
            triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
            placeholder={W.billLoading}
            value={lines ? lineId : null}
            onChange={setLineId}
            options={[
              { value: '', name: W.billNoLineName, sub: W.billNoLineSub },
              ...(lines?.lines ?? []).map(l => ({
                value: l.id, name: l.description,
                sub: `${lines?.year ? `${lines.year} · ` : ''}${W.billFromOther(fmt(l.planned), fmt(l.left))}`,
              })),
              ...(lineId && lines && !lines.lines.some(l => l.id === lineId) ? [{ value: lineId, name: W.billNoLineName, sub: W.billNoLineSub }] : []),
            ]}
          />
          {line && <span className={ck.hint}>{lineId === pricing?.lineId
            ? (pricing?.lineFrom ? W.billFromMost(pricing.lineFrom, fmt(line.planned), fmt(line.left)) : W.billFromHint(fmt(line.planned), fmt(line.left)))
            : W.billFromOther(fmt(line.planned), fmt(line.left))}</span>}
        </div>
        <label className={ck.field} htmlFor="bill-for">
          <span className={ck.label}>{W.billFor}</span>
          <select id="bill-for" className={ck.select} value={part ? 'part' : 'whole'} onChange={e => setPart(e.target.value === 'part')} disabled={!priceable}>
            {priceable && <option value="whole">{(permitsBehind > 1 ? W.billWholePermits : W.billWhole)(money(timePriceCents!))}</option>}
            <option value="part">{W.billPart}</option>
          </select>
          <span className={ck.hint}>{!priceable ? W.billNoPermitHint : W.billPartHint}</span>
        </label>
      </div>
      {/* Accounting's allocations on the line, a bill bigger than what's left, and a permit's line it can't offer —
          said, never silent (13d-4 A). Warns only: nothing below changes for it. */}
      {lines && (
        <BillLineNotice q={q} lineId={lineId} billCents={totalCents > 0 ? totalCents : null}
          droppedLineId={!savedLineId && pricing?.lineId && !lines.lines.some(l => l.id === pricing.lineId) ? pricing.lineId : null} />
      )}
      {/* "Price the time" (P2 A): absent, not disabled, when the time has one price — and then the amount sits alone, full
          width, exactly as a one-permit schedule always showed it. */}
      {multi ? (
        <div className={sch.pair}>
          <label className={ck.field} htmlFor="bill-price">
            <span className={ck.label}>{W.billPrice}</span>
            <select id="bill-price" className={ck.select} value={mode} onChange={e => setMode(e.target.value as PriceMode)}>
              <option value="each_permit">{W.billPriceEach}</option>
              <option value="one_rate">{W.billPriceOne}</option>
            </select>
            <span className={ck.hint}>{mode === 'one_rate' && oneRateHour != null
              ? W.billPriceOneHint(money(timePriceCents!), W.hours(fullFieldHours), fmt(oneRateHour))
              : eachHint}</span>
          </label>
          {part ? amountField : <div />}
        </div>
      ) : part ? amountField : null}
      <div className={sch.pair}>
        <div className={ck.field}>
          <span className={ck.label} id="bill-split-label">{W.billSplit}</span>
          <p className={sch.fixedValue} aria-labelledby="bill-split-label">{W.billSplitTime}</p>
          <span className={ck.hint}>{splitHint}</span>
        </div>
        <div className={ck.field}>
          <span className={ck.label} id="bill-pay-label">{W.billPayments}</span>
          <div className={sch.pair}>
            <select className={ck.select} aria-labelledby="bill-pay-label" value={plan} onChange={e => setPlan(e.target.value as PaymentPlan)}>
              {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {plan !== 'dates' && (
              <DateInput className={ck.input} aria-label={W.billFirstDue} value={firstDue} onChange={v => setFirstDue(v)} />
            )}
          </div>
          {plan === 'dates' && (
            <div className={sch.chips}>
              {dates.map((d, i) => (
                <DateInput key={i} className={ck.input} aria-label={`${W.billDates} ${i + 1}`} value={d}
                  onChange={v => setDates(ds => ds.map((x, k) => (k === i ? v : x)))} />
              ))}
              <button type="button" className={sch.door} onClick={() => setDates(ds => [...ds, ''])}>{W.billAddDate}</button>
            </div>
          )}
          <span className={ck.hint}>{W.billPaymentsCount(plan, dues.length, isCalendarDate(firstDue) ? formatStoredDate(firstDue) : null)}</span>
        </div>
      </div>
      {rows.length > 0 ? table : <p className={ck.hint}>{problem() ?? W.billNoTimeYet}</p>}
      {addedPart && !late
        ? <Statement lead={PART_WORDS.billPartLead(addedPart.label)} rest={PART_WORDS.billPartRest(view.schedule.name, addedPart.parentName)} />
        : <Statement lead={late ? W.billLateLead : W.billStatementLead} rest={(late ? W.billLateStatement : W.billStatement)(dues.length, word)} />}
      {existing && (
        <div className={sch.ends}>
          <RecordAction icon={<Trash2 size={14} aria-hidden />} onClick={() => void save(null)} disabled={busy}>{W.billRemove}</RecordAction>
        </div>
      )}
    </KitDialog>
  );
}
