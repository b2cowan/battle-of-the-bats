'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PA_WORDS as W, PAYOUTS_WORDS, money } from '@/lib/online-payment-words';
import { formatStoredDate } from '@/lib/timezone';
import type { ClubOnlinePayments, MessageRow } from '@/lib/platform-online-payments';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import StripeFeesPanel from './StripeFeesPanel';

/**
 * A CLUB'S ONLINE PAYMENTS, READ ONLY (Club Tier Stage 12d-2 Part 5 — frame 6, words §6.1; ask 7). The platform team
 * answering "a family paid and it isn't there" and checking each morning that nothing is stuck. Tiles (the account, its
 * terms, the last 30 days, clearing debits, open disputes) open their panel; the panels are the open disputes (by receipt;
 * "Show the player" names the child or team on request, and the opening is logged), the Stripe messages we couldn't
 * process (absent when none; those still failing after 30 days fold under "Stopped retrying") and the fees billed to the
 * club (12d-1's panel, its Retry left on the Money tab). ⚠ NOTHING here writes; never a card or bank number.
 */

const short = (v: string | null | undefined) => (v ? formatStoredDate(v, { withYear: false }) : '');
const long = (v: string | null | undefined) => (v ? formatStoredDate(v, { longMonth: true }) : '');

export default function OnlinePaymentsTab({ orgId, initial }: { orgId: string; initial: ClubOnlinePayments | null }) {
  const [read, setRead] = useState<ClubOnlinePayments | null>(initial);
  const [failed, setFailed] = useState(false);
  const disputesRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/online-payments`, 'GET');
    if (!ok) { setFailed(true); return; }
    setRead(data as unknown as ClubOnlinePayments);
  }, [orgId]);
  // The record's page read it with everything else; a failed read there is read again here.
  useEffect(() => {
    if (initial) return;
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [initial, load]);

  if (failed) {
    return (
      <div className={`${kit.callout} ${kit.calloutWarn}`}>
        <span>{W.readFailed}</span>
        <span className={kit.calloutEnd}><button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => void load()}>Read again</button></span>
      </div>
    );
  }
  if (!read) return <p className={kit.caption}>Loading online payments…</p>;

  const a = read.account;
  const accountSub = a.ended
    ? (a.ended.why === 'plan' ? W.endedPlan(short(a.ended.day), a.ended.targetPlan) : W.endedSuspended(short(a.ended.day)))
    : a.disconnectedAt ? W.disconnected(short(a.disconnectedAt), a.disconnectedBy) : W.connected(short(a.connectedAt), a.connectedBy);
  const t = read.terms;
  const termsValue = !t ? W.termsNone : t.standing === 'stale' ? W.termsStale : t.standing === 'draft' ? W.termsDraft : W.termsVersion(long(t.versionDate));
  const termsSub = !t ? '' : t.standing === 'stale' ? W.termsSubStale(short(t.agreedAt)) : t.standing === 'draft' ? W.termsSubDraft(short(t.agreedAt)) : W.termsSub(short(t.agreedAt));
  const nothingOpen = read.openItems === 0 && !read.clearing;
  const goTo = (el: HTMLDivElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className={kit.section}>
      {read.testMode && <div className={`${kit.callout} ${kit.calloutWarn}`}><span>{W.test}</span></div>}

      <section className={kit.band} aria-label={W.tab}>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>{W.tileAccount}</span>
          <span className={kit.bandValueText}>{PAYOUTS_WORDS.pill[a.state]}</span>
          <span className={kit.bandNote}>{accountSub}</span>
          {a.stripeClosed && a.disconnectedAt && <span className={`${kit.chip} ${kit.chipWarn}`}>{W.stripeClosed(short(a.disconnectedAt))}</span>}
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>{W.tileTerms}</span>
          <span className={kit.bandValueText}>{termsValue}</span>
          {termsSub && <span className={kit.bandNote}>{termsSub}</span>}
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>{W.tileVolume}</span>
          <span className={kit.bandValue}>{money(read.volume.total)}</span>
          <span className={kit.bandNote}>{W.volumeSub(read.volume.payments, read.volume.refunds)}</span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>{W.tileClearing}</span>
          <span className={kit.bandValue}>{read.clearing}</span>
          <span className={kit.bandNote}>{W.clearingSub(read.clearing)}</span>
        </div>
        <button type="button" className={kit.bandCell} onClick={() => goTo(read.disputes.rows.length ? disputesRef.current : null)}>
          <span className={kit.bandLabel}>{W.tileDisputes}</span>
          <span className={kit.bandValue}>{read.disputes.rows.length}</span>
          {read.disputes.feesSoFar > 0 && <span className={kit.bandNote}>{W.disputesSub(money(read.disputes.feesSoFar))}</span>}
        </button>
      </section>

      {nothingOpen && <p className={kit.caption}>{W.empty}</p>}

      {read.disputes.rows.length > 0 && (
        <div className={kit.card} ref={disputesRef}>
          <h3 className={kit.sectionTitle}>{W.panelDisputes}</h3>
          <div className={kit.tableWrap}>
            <table className={kit.comfortable}>
              <thead><tr><th>{W.col.payment}</th><th>{W.col.why}</th><th>{W.col.answerBy}</th><th className={kit.num}>{W.col.held}</th></tr></thead>
              <tbody>
                {read.disputes.rows.map(d => (
                  <tr key={d.id}>
                    <td>
                      {W.disputeRow(d.receiptNo != null ? String(d.receiptNo) : '—', d.home)}
                      <ShowPlayer orgId={orgId} onlinePaymentId={d.onlinePaymentId} />
                    </td>
                    <td>{d.why}</td>
                    <td>{short(d.answerBy)}</td>
                    <td className={kit.num}>{money(d.held)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {read.messages.failing.length > 0 && (
        <div className={kit.card} ref={messagesRef}>
          <h3 className={kit.sectionTitle}>{W.panelMessages}</h3>
          <Messages rows={read.messages.failing} />
          {read.messages.stopped.length > 0 && (
            <details>
              <summary className={kit.caption}>{W.messagesStopped} ({read.messages.stopped.length})</summary>
              <Messages rows={read.messages.stopped} />
            </details>
          )}
        </div>
      )}
      {!read.messages.failing.length && read.messages.stopped.length > 0 && (
        <details className={kit.card}>
          <summary className={kit.caption}>{W.messagesStopped} ({read.messages.stopped.length})</summary>
          <Messages rows={read.messages.stopped} />
        </details>
      )}

      {/* The fees billed to the club: 12d-1's panel, read only here (its Retry stays on the Money tab). */}
      <StripeFeesPanel orgId={orgId} canRetry={false} />
    </div>
  );
}

function Messages({ rows }: { rows: MessageRow[] }) {
  return (
    <div className={kit.tableWrap}>
      <table className={kit.comfortable}>
        <thead><tr><th>{W.col.message}</th><th>{W.col.error}</th><th>{W.col.received}</th><th className={kit.num}>{W.col.tries}</th></tr></thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id}><td>{m.type}</td><td>{m.error}</td><td>{short(m.receivedAt)}</td><td className={kit.num}>{m.tries}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The child's (or team's) name, on request only; the opening is logged (words §6.1 `pa.player.*`). */
function ShowPlayer({ orgId, onlinePaymentId }: { orgId: string; onlinePaymentId: string }) {
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (names) {
    return <div className={kit.caption}>{names.join(', ')}<div>{W.playerLogged}</div></div>;
  }
  return (
    <div>
      <button type="button" className={`${kit.door} ${kit.doorSm}`} disabled={busy} onClick={async () => {
        setBusy(true);
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/online-payments/player`, 'POST', { onlinePaymentId });
        setBusy(false);
        if (ok) setNames((data.names as string[]) ?? []);
        else setError(errorOf(data, 'The name could not be read.'));
      }}>{W.showPlayer}</button>
      {error && <div className={kit.fieldError} role="alert">{error}</div>}
    </div>
  );
}
