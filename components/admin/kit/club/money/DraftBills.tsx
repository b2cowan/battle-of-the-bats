'use client';

/**
 * "BEING BILLED (DRAFT)" — A SCHEDULE'S BILL BEFORE IT IS SENT, IN ACCOUNTING (Club Tier Stage 13d-3, Ask 15 A; drawing
 * tab 4 notes 1-5, tab 7 notes 4-5). Three pieces, one read (`useDraftBills` → /api/admin/accounting/being-billed):
 *
 *   · `BeingBilledRows` — the budget line window's group: each schedule, what it would bill and to how many teams, a
 *     door to its fair shares;
 *   · `FairSharesWindow` — the shares, READ ONLY, drawn as Accounting's own window. A treasurer can't open Schedules, so
 *     it never links there for them; an owner or an admin (`opensSchedules`) also gets "Open the schedule";
 *   · `DraftBillNotice` — New allocation's warning under the choice. It WARNS and never blocks (Stage 6a): Bill stays
 *     live, because a treasurer may be billing something the schedule doesn't cover.
 *
 * The figures are the schedule's own bill (`readDraftBills`); nothing here computes a share.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { Callout, repKit } from '../RepKit';
import { RecordFacts } from '@/components/coaches/kit';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useOrg } from '@/lib/org-context';
import { DRAFT_BILL_WORDS as W, hoursNumber, type DraftBill, type DraftBillTeam } from '@/lib/club-draft-bill';
import { money, moneyFetch, moneyKit } from './MoneyKit';
import cr from './ClubReport.module.css';
import pm from '../Permits.module.css';

export interface DraftBillsRead { bills: DraftBill[]; opensSchedules: boolean }

/** The bills not sent yet — one line's (`lineId`), or every line's (null). Null while loading; a failed read is none:
 *  a warning that can't load never stands in the way of the screen. */
export function useDraftBills(q: string, lineId: string | null, wanted = true): DraftBillsRead | null {
  const [read, setRead] = useState<DraftBillsRead | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    moneyFetch<DraftBillsRead>(`/api/admin/accounting/being-billed?${q}${lineId ? `&line=${encodeURIComponent(lineId)}` : ''}`)
      .then(r => { if (live) setRead(r.ok ? r.data : { bills: [], opensSchedules: false }); })
      .catch(() => { if (live) setRead({ bills: [], opensSchedules: false }); });
    return () => { live = false; };
  }, [q, lineId, wanted]);
  return wanted ? read : null;
}

/** The line window's "Being billed (draft)" group: one row per schedule, each a door to its fair shares. */
export function BeingBilledRows({ bills, onOpen }: { bills: readonly DraftBill[]; onOpen: (b: DraftBill) => void }) {
  if (!bills.length) return null;
  return (
    <section className={cr.recordSection} aria-label={W.heading}>
      <h3 className={cr.recordSectionTitle}>{W.heading}</h3>
      <div className={cr.windowRows}>
        {bills.map(b => (
          <button key={b.scheduleId} type="button" className={cr.windowRow} aria-haspopup="dialog"
            aria-label={W.sharesLabel(b.name)} onClick={() => onOpen(b)}>
            <span className={cr.windowRowMain}>
              <span className={cr.windowRowTitle}>{b.name}</span>
              <span className={`${cr.windowRowSub} ${cr.draftBillSub}`}>{W.row(b)}</span>
            </span>
            <span className={`${cr.draftBillDoor} ${repKit.deskOnly}`}>{W.sharesDoor}</span>
            <ChevronRight size={16} aria-hidden className={cr.windowRowEnd} />
          </button>
        ))}
      </div>
    </section>
  );
}

const teamLabel = (t: DraftBillTeam) => (t.others ? W.otherTeams(t.others) : t.name);
const shareOf = (t: DraftBillTeam) => (t.cents == null ? W.noShare : money(t.cents / 100));
/** Past four teams the phone folds the rest (tab 7 note 5). */
const PHONE_SHOWN = 4;

/** THE FAIR SHARES, READ ONLY — Accounting's own window over a schedule's bill not sent yet. */
export function FairSharesWindow({ bill, opensSchedules, onClose }: {
  bill: DraftBill; opensSchedules: boolean; onClose: () => void;
}) {
  const isPhone = useIsPhone();
  const orgSlug = useOrg().currentOrg?.slug ?? '';
  const [unfolded, setUnfolded] = useState(false);
  const rows = bill.teams;
  const folded = isPhone && !unfolded && rows.length > PHONE_SHOWN + 1 ? rows.length - PHONE_SHOWN : 0;
  const shown = folded ? rows.slice(0, PHONE_SHOWN) : rows;
  const open = opensSchedules && orgSlug
    ? <Link href={`/${orgSlug}/admin/schedules/${bill.scheduleId}`} className="btn btn-outline">{W.openSchedule}</Link>
    : undefined;
  return (
    <KitDialog
      kind="form"
      size="medium"
      eyebrow={W.eyebrow(bill)}
      title={W.title(bill.name)}
      onClose={onClose}
      footerStart={open}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>Done</button>}
    >
      <p className={ck.hint}>{isPhone ? W.leadShort : W.lead}</p>
      <RecordFacts rows={[
        [W.factBill, W.bill(bill)],
        [W.factHours, W.hours(bill)],
        [W.factPlan, W.plan(bill)],
      ]} />
      {rows.length > 0 && (isPhone ? (
        <div className={cr.windowRows}>
          {shown.map(t => (
            <div key={t.teamId ?? 'others'} className={cr.windowRow}>
              <span className={cr.windowRowMain}>
                <span className={cr.windowRowTitle}>{teamLabel(t)}</span>
                <span className={cr.windowRowSub}>{W.hoursOnly(t.hours)}</span>
              </span>
              <span className={pm.rowFigure}>{shareOf(t)}</span>
            </div>
          ))}
          {folded > 0 && (
            <button type="button" className={cr.windowRow} aria-expanded={false} onClick={() => setUnfolded(true)}>
              <span className={cr.windowRowMain}><span className={cr.windowRowSub}>{W.moreTeams(folded)}</span></span>
              <ChevronDown size={16} aria-hidden className={cr.windowRowEnd} />
            </button>
          )}
        </div>
      ) : (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">{W.colTeam}</th>
                <th scope="col" className={repKit.num}>{W.colHours}</th>
                <th scope="col" className={repKit.num}>{W.colShare}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.teamId ?? 'others'}>
                  <td>{teamLabel(t)}</td>
                  <td className={repKit.num}>{hoursNumber(t.hours)}</td>
                  <td className={repKit.num}>{shareOf(t)}</td>
                </tr>
              ))}
              <tr className={moneyKit.closeRow}>
                <td>{W.total(bill.teamCount)}</td>
                <td className={repKit.num}>{hoursNumber(bill.hours)}</td>
                <td className={repKit.num}>{bill.cents == null ? W.noShare : money(bill.cents / 100)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </KitDialog>
  );
}

/** New allocation's warning, the moment a line a schedule is billing is picked (and from the line's Allocate). */
export function DraftBillNotice({ bills, onOpen }: { bills: readonly DraftBill[]; onOpen: (b: DraftBill) => void }) {
  if (!bills.length) return null;
  return (
    <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
      <b>{W.warnTitle(bills)}</b>{' '}
      {bills.map(b => W.warnOne(b)).join(' ')} {W.warnEnd}
      <span className={repKit.calloutSub}>
        {bills.map(b => (
          <button key={b.scheduleId} type="button" className={ck.link} aria-haspopup="dialog" onClick={() => onOpen(b)}>
            {W.warnDoor(bills.length > 1 ? b.name : undefined)}
          </button>
        ))}
      </span>
    </Callout>
  );
}
