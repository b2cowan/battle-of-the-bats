'use client';

/**
 * THE BILL WINDOW SEES ACCOUNTING'S ALLOCATIONS (Club Tier Stage 13d-4, Ask 4 A; drawing tab 4 notes 6-7) — the mirror of
 * New allocation's "a draft schedule is billing this line". Under "Bill from", for an owner or an admin who holds
 * Accounting (the only people the Bill window opens for):
 *
 *   · the line chosen already carries allocations → each by name, amount and teams: "billing it here charges those
 *     teams twice" if they were for this time;
 *   · the bill is more than the line has left → it says so, and names off-plan;
 *   · the permit's own line can't be offered (nothing left, a closed year, another year) → it says so instead of
 *     quietly showing "No budget line" (a sent bill on no line is invisible to every line's Allocated).
 *
 * It WARNS and never blocks: Save, Finalize and Send are unchanged, and the send's own refusals (`billBlockers`) stand.
 * ⚖ ONE READ, ONE SMALL COMPONENT (owner 2026-11-13: the several-permits build re-prices this bill after 13d): that build
 * replaces `/api/admin/accounting/line-billed`, not the Bill window.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Callout, repKit } from '../RepKit';
import { BILL_LINE_WORDS as W, type LineBilled } from '@/lib/club-draft-bill';
import { moneyFetch } from '../money/MoneyKit';
import { useOrg } from '@/lib/org-context';
import ck from '../ClubKit.module.css';

function useLineBilled(q: string, lineId: string | null): LineBilled | null {
  const [read, setRead] = useState<{ id: string; billed: LineBilled | null } | null>(null);
  useEffect(() => {
    if (!lineId) return;
    let live = true;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    moneyFetch<{ billed: LineBilled | null }>(`/api/admin/accounting/line-billed?${q}&line=${encodeURIComponent(lineId)}`)
      .then(r => { if (live) setRead({ id: lineId, billed: r.ok ? r.data.billed : null }); })
      .catch(() => { if (live) setRead({ id: lineId, billed: null }); });
    return () => { live = false; };
  }, [q, lineId]);
  return lineId && read?.id === lineId ? read.billed : null;
}

export default function BillLineNotice({ q, lineId, droppedLineId, billCents }: {
  q: string;
  /** The line "Bill from" holds ('' = no budget line). */
  lineId: string;
  /** The permit's own budget line when "Bill from" could not offer it, so the window started on no line. */
  droppedLineId: string | null;
  /** What the teams would be billed, in cents (null while unknown). */
  billCents: number | null;
}) {
  // The permit's line fell away when the window could not offer it. While "Bill from" holds no line the notice stays,
  // chosen or not: the window cannot tell a deliberate "No budget line" from the fall-away, and the warning only names off-plan.
  const fellAway = !lineId && !!droppedLineId;
  const target = lineId || (fellAway ? droppedLineId : null);
  const billed = useLineBilled(q, target);
  const orgSlug = useOrg().currentOrg?.slug ?? '';
  if (!billed) return null;
  const leftCents = Math.round(billed.line.left * 100);
  const overBy = lineId && billCents != null && billCents > leftCents + 1 ? billCents : null;
  // "Pick another line, or bill it off-plan": the line fell away, or the bill is more than it has left (never both —
  // one needs no line chosen, the other a line).
  const offPlanTitle = fellAway ? W.fellAwayTitle(billed.line) : overBy != null ? W.overTitle(overBy / 100, billed.line.left) : null;
  return (
    <>
      {offPlanTitle && (
        <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
          <b>{offPlanTitle}</b> {W.offPlanWay}
        </Callout>
      )}
      {billed.allocations.length > 0 && (
        <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
          <b>{W.billedTitle}</b> {W.billed(billed.allocations)}
          <span className={repKit.calloutSub}>
            <Link href={`/${orgSlug}/admin/accounting/budget?line=${encodeURIComponent(billed.line.id)}`} className={ck.link}>{W.seeLine}</Link>
          </span>
        </Callout>
      )}
    </>
  );
}
