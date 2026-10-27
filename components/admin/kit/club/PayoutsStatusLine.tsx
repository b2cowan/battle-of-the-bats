'use client';
/**
 * The Payouts state OUTSIDE Settings (Club Tier Stage 12a, copy §6; A1 and A6).
 *
 *  - The TREASURER's status line: taking payments, needs attention (the owner fixes it), or off. Nothing while it is not
 *    set up or still setting up — there is nothing to tell them yet. On the Accounting overview (League and Club) and on
 *    the Teams page's payments line (a tournament-only club, which has no Money page).
 *  - The OWNER's quiet line, only while payouts are not set up: today's sentence plus "Let them pay online", which opens
 *    the card (A6). Roles that can't connect never see it: it would be a dead end.
 *
 * Reads the same view as the card; renders nothing while online payments aren't offered (switch, role, or a plan without
 * them for a club that never connected). A club wound down by a downgrade reads "Online payments off" (12d-2).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatStoredDate } from '@/lib/timezone';
import { LEAVING_WORDS, payoutsWords, type PayoutsHome } from '@/lib/online-payment-words';
import { payoutsPath } from '@/lib/online-payment-account';
import { loadPayouts, type PayoutsView } from './PayoutsCard';
import { RepChip } from './RepKit';
import ck from './ClubKit.module.css';
import pc from './PayoutsCard.module.css';

export default function PayoutsStatusLine({ orgSlug, planId, home, treasurerLine = true }: {
  orgSlug: string; planId: string; home: PayoutsHome;
  /** False where the treasurer's line has another home (a League or Club's Teams page: it lives on Accounting). */
  treasurerLine?: boolean;
}) {
  const W = payoutsWords(home);
  const [view, setView] = useState<PayoutsView | null>(null);
  useEffect(() => {
    if (!orgSlug) return;
    let stale = false;
    void loadPayouts(orgSlug).then(v => { if (!stale) setView(v); });
    return () => { stale = true; };
  }, [orgSlug]);
  if (!view) return null;
  const href = payoutsPath({ slug: orgSlug, planId });

  if (view.isOwner) {
    if (view.state !== 'not_set_up') return null;
    return (
      <p className={`${ck.hint} ${pc.statusLine}`}>
        {W.quiet.line} <Link href={href}>{W.quiet.link}</Link> · {W.path(home)}
      </p>
    );
  }

  if (!treasurerLine) return null;
  // 12d-2 (ask 4): a plan without online payments keeps the account connected — the line says online payments are off,
  // never "Taking payments" (/review of Part 3).
  if (view.windDown && view.state !== 'disconnected' && view.state !== 'not_set_up') {
    return (
      <p className={`${ck.hint} ${pc.statusLine}`}>
        <strong>{LEAVING_WORDS.windDown.pill}</strong> · {LEAVING_WORDS.windDown.title}.
      </p>
    );
  }
  if (view.state === 'taking_payments') {
    return (
      <p className={`${ck.hint} ${pc.statusLine}`}>
        <strong>{W.status.takingLead}</strong> · {W.status.takingBody}
      </p>
    );
  }
  if (view.state === 'needs_attention') {
    const deadline = view.deadline ? formatStoredDate(view.deadline, { withYear: false }) : null;
    return (
      <p className={`${ck.hint} ${pc.statusLine}`}>
        <RepChip tone="warn">{W.status.needsLead}</RepChip> {view.paymentsOn ? W.status.needsBodyStillOn(deadline) : W.status.needsBody} {W.status.needsOwnerHint(home)}
      </p>
    );
  }
  if (view.state === 'disconnected') {
    return (
      <p className={`${ck.hint} ${pc.statusLine}`}>
        <strong>{W.status.offLead}</strong> · {W.status.offBody(formatStoredDate(view.disconnectedAt, { withYear: false }))}
      </p>
    );
  }
  return null;
}
