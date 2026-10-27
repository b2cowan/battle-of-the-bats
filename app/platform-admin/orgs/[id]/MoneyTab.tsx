'use client';
/**
 * The Money tab (Support console Stage 3, owner rulings 2026-10-26; drawings A, B, C, G): Stripe beside our record, read
 * when the tab opens and never kept (R7, Q4 A). The first line says whether they agree — or names a double charge — then
 * the joined money band, the subscription twice (ours, Stripe's; a difference marked on its row), and the charges.
 * A charge opens as a record that reads first; "Refund this charge" opens the refund window for the refund power only.
 * A role without the Stripe-reading power never asks: it sees our record and one line. The rules are lib/console-money.ts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { consoleClock, consoleWhen } from '@/lib/console-dates';
import { formatStoredDate } from '@/lib/timezone';
import { possessive } from '@/lib/utils';
import {
  agreeLine, cardWords, centsFromTyped, compareRecord, findPatterns, flagWords, formatCents,
  moneyBand, paidForWords, refundDoorRefusal, remainingCents, stripeSaysWords, REFUND_REASON_MAX, REFUND_WORDS,
  type ChargeFlag, type MoneyCharge, type MoneyRead, type OurMoneyRecord,
} from '@/lib/console-money';
import { brandLabel } from '@/lib/online-payment-words';
import type { ConsoleRefund } from '@/lib/console-money-store';
import RecordWindow from '../../RecordWindow';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import styles from '../../record.module.css';
import money from './money.module.css';
import StripeFeesPanel from './StripeFeesPanel';

/** What the server knows of this person and club before any click (the refund route asks the same rule with them). */
type RefundGate = { role: string; ownClub: boolean; demoClub: boolean; refundsLast24h: number };
export type MoneyResponse =
  | { state: 'no_customer' }
  | { state: 'shared' }
  | { state: 'unreachable'; readAt: string }
  | { state: 'read'; read: MoneyRead; portalSubscriptionIds: string[]; refundGate: RefundGate | null };

/** Why this charge's refund door is absent, known before the click (drawing G), or null when it shows. */
function doorRefusal(gate: RefundGate | null, c: MoneyCharge, inFlight: string | null = null): { text: string; bad: boolean } | null {
  if (!gate) return { text: REFUND_WORDS.readerRole, bad: false };
  if (inFlight) return { text: inFlight, bad: false };
  return refundDoorRefusal({ ...gate, now: new Date() }, c);
}

/** The one live read, shared by the Money tab and the Story. Never runs for a role without the Stripe-reading power. */
export function useClubMoney(orgId: string, enabled: boolean) {
  // Each ask is a number; "Read again" asks again. State changes only when Stripe's answer arrives (never in the effect).
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{ ask: number; money: MoneyResponse } | null>(null);
  const answeredAsk = answer?.ask ?? -1;
  useEffect(() => {
    if (!enabled || answeredAsk === asked) return;
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money`, 'GET').then(({ ok, data }) => {
      if (!live) return;
      setAnswer({ ask: asked, money: ok ? (data as unknown as MoneyResponse) : { state: 'unreachable', readAt: new Date().toISOString() } }); // utc-intentional
    });
    return () => { live = false; };
  }, [enabled, asked, answeredAsk, orgId]);
  const readAgain = useCallback(() => setAsked(n => n + 1), []);
  return { money: answer?.money ?? null, loading: enabled && answer?.ask !== asked, readAgain };
}

const YEAR_MS = 365 * 86_400_000;

export default function MoneyTab({
  orgId, orgName, ours, readsStripe, billsClub = false, stripeBase, club, openChargeId, onChargeClosed, onRefunded,
}: {
  orgId: string;
  /** 12d-1 Part 4: may bill the club (`club_billing`), so the fees panel's Retry shows. */
  billsClub?: boolean;
  orgName: string;
  ours: OurMoneyRecord;
  readsStripe: boolean;
  stripeBase: string;
  club: ReturnType<typeof useClubMoney>;
  /** A charge to open on arrival (Find's `?charge=`): opened through the charge route, which checks it is this club's. */
  openChargeId: string | null;
  onChargeClosed: () => void;
  onRefunded: () => void;
}) {
  const m = club.money;
  const read = m?.state === 'read' ? m.read : null;
  // The last good read: an open charge window outlives a later read that failed (its refund notice is not lost).
  const [lastGood, setLastGood] = useState<Extract<MoneyResponse, { state: 'read' }> | null>(null);
  if (m?.state === 'read' && m !== lastGood) setLastGood(m);
  // Older charges belong to the read they were asked from: a new read starts again from its own twelve months.
  type Older = { forRead: string | null; charges: MoneyCharge[]; before: string | null; exhausted: boolean; loading: boolean; failed: boolean };
  const fresh = (forRead: string | null): Older => ({ forRead, charges: [], before: null, exhausted: false, loading: false, failed: false });
  const [olderState, setOlder] = useState<Older>(fresh(null));
  const older = olderState.forRead === (read?.readAt ?? null) ? olderState : fresh(read?.readAt ?? null);
  const [explain, setExplain] = useState(false);
  const [openCharge, setOpenCharge] = useState<{ id: string; refund: boolean } | null>(openChargeId ? { id: openChargeId, refund: false } : null);

  const allCharges = useMemo(() => (read ? [...read.charges, ...older.charges] : []), [read, older.charges]);
  const portalSubs = m?.state === 'read' ? m.portalSubscriptionIds : null;
  const patterns = useMemo(() => findPatterns({ charges: allCharges, subscriptions: read?.subscriptions ?? [] }, ours.subscriptionId, portalSubs ?? []),
    [allCharges, read, ours.subscriptionId, portalSubs]);
  const rows = compareRecord(ours, read);
  const nextBefore = older.exhausted ? null : older.charges.length ? older.before : read?.olderBefore ?? null;

  async function showOlder() {
    if (!nextBefore) return;
    setOlder({ ...older, loading: true, failed: false });
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money?before=${encodeURIComponent(nextBefore)}`, 'GET');
    const res = data as unknown as MoneyResponse;
    if (ok && res.state === 'read') {
      setOlder({ ...older, charges: [...older.charges, ...res.read.charges], before: res.read.olderBefore,
        exhausted: res.read.charges.length === 0 || !res.read.olderBefore, loading: false, failed: false });
    } else setOlder({ ...older, loading: false, failed: true });
  }

  if (!readsStripe) {
    return (
      <section className={kit.section}>
        <p className={kit.callout}>Stripe’s side is read by Super admin, Billing and Support. Your role sees our record: plan, billing status and renewal date.</p>
        <OursOnly rows={compareRecord(ours, null).filter(r => r.key === 'plan' || r.key === 'status' || r.key === 'renews' || r.key === 'free')} />
      </section>
    );
  }
  if (!m || (club.loading && !read)) {
    return <section className={kit.section}><p className={kit.caption}>Reading Stripe…</p></section>;
  }

  const testChip = read?.testMode ? <span className={`${kit.chip} ${kit.chipInfo}`}>Test mode</span> : null;
  const readAt = read ? consoleClock(read.readAt) : null;
  const again = <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={club.readAgain} disabled={club.loading}>{club.loading ? 'Reading…' : 'Read again'}</button>;

  let head;
  if (m.state === 'no_customer') {
    head = <p className={kit.callout}>This club has never paid us by card. There is no Stripe customer, so there is nothing to compare or refund.</p>;
  } else if (m.state === 'shared') {
    head = <p className={`${kit.callout} ${kit.calloutBad}`}>Another club uses this Stripe customer, so nothing from Stripe is shown or refunded here. Tell the product team.</p>;
  } else if (m.state === 'unreachable') {
    head = (
      <div className={`${kit.callout} ${kit.calloutWarn}`}>
        <span>Stripe could not be read at {consoleClock(m.readAt)}. Our record is below; Stripe’s side, the charges and refunds wait until it answers.</span>
        <span className={kit.calloutEnd}>{again}</span>
      </div>
    );
  } else {
    const line = agreeLine(rows, patterns, ours.subscriptionId);
    head = (
      <div className={`${kit.callout}${line.tone === 'warn' ? ` ${kit.calloutWarn}` : line.tone === 'bad' ? ` ${kit.calloutBad}` : ''}`}>
        {testChip}
        <span>
          {line.text}
          {line.secondSubscriptionId && <> <a className={kit.door} href={`${stripeBase}/subscriptions/${line.secondSubscriptionId}`} target="_blank" rel="noreferrer">Open it in Stripe</a></>}
          {read?.testMode && <> Test payment: no money moves.</>}
        </span>
        <span className={kit.calloutEnd}><span className={kit.caption}>Read from Stripe at {readAt}</span>{again}</span>
      </div>
    );
  }

  const gate = m.state === 'read' ? m.refundGate : null;
  const since = read ? new Date(Date.parse(read.readAt) - YEAR_MS).toISOString() : ''; // utc-intentional: a 12-month window
  const openWith = (id: string, refund: boolean) => setOpenCharge({ id, refund });

  return (
    <section className={kit.section}>
      {head}

      {read && (
        <div className={kit.band}>
          {moneyBand({ ...read, charges: allCharges }, since).map(b => (
            <div key={b.label} className={`${kit.bandCell}${b.tone === 'warn' ? ` ${kit.bandWarn}` : ''}`}>
              <span className={kit.bandLabel}>{b.label}</span>
              <span className={kit.bandValue}>{b.value}</span>
              <span className={kit.bandNote}>{b.note}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className={kit.sectionTitle}>The subscription</h2>
      <div className={kit.card}>
        <div className={kit.tableWrap}>
          <table className={`${kit.comfortable} ${money.compare}`}>
            <thead><tr><th aria-label="What" /><th>Our record</th><th>Stripe</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <th scope="row" className={`${kit.eye} ${money.rowHead}`}>{r.label}</th>
                  <td>{r.ours}</td>
                  <td>
                    {m.state === 'no_customer' ? (r.key === 'plan' ? 'No Stripe customer' : '') : r.stripe}
                    {r.stripeId && read && <> · <a className={`${kit.door} ${kit.doorSm}`} href={`${stripeBase}/${r.key === 'customer' ? 'customers' : 'subscriptions'}/${r.stripeId}`} target="_blank" rel="noreferrer">Open in Stripe</a></>}
                    {r.differs && <> <button type="button" className={`${kit.chip} ${kit.chipWarn} ${money.chipButton}`} onClick={() => setExplain(x => !x)} aria-expanded={explain}>Differs</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {(explain || rows.some(r => r.differs)) && (
        <p className={kit.caption}>Nothing here changes our record. A difference usually clears when Stripe’s next update arrives. If it is still there tomorrow, tell the product team.</p>
      )}

      {read && (
        <>
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {allCharges.length} charge{allCharges.length === 1 ? '' : 's'} {older.charges.length ? 'read' : 'in the last 12 months'}, newest first
            </span>
            <span className={`${kit.caption} ${kit.toolbarEnd}`}>From Stripe at {readAt}</span>
          </div>
          <div className={kit.card}>
            <div className={`${kit.tableWrap} table-cards`}>
              <table className={kit.comfortable}>
                <thead><tr><th>When</th><th>What it paid for</th><th>Card</th><th>Stripe says</th><th className={kit.num}>Amount</th><th aria-label="Open" /></tr></thead>
                <tbody>
                  {allCharges.length === 0 && <tr><td colSpan={6} className={kit.empty}>No charges in these 12 months.</td></tr>}
                  {allCharges.map(c => {
                    const paid = paidForWords(c);
                    const says = stripeSaysWords(c);
                    const flag = patterns.flags.get(c.id);
                    const fw = flag ? flagWords(flag) : null;
                    const canRefundThis = !doorRefusal(gate, c);
                    return (
                      <tr key={c.id} className={kit.clickableRow} onClick={() => openWith(c.id, false)}>
                        <td className={`${kit.nowrap} table-cards-title`}>{consoleWhen(c.createdAt)}</td>
                        <td data-label="What it paid for">
                          {paid.main}
                          {paid.period && <span className={kit.sub}>{paid.period}</span>}
                          {fw && (
                            <span className={`${money.flag}${fw.tone === 'bad' ? ` ${money.bad}` : ''}`}>
                              {fw.text}
                              {flag?.kind === 'duplicate' && canRefundThis && (
                                <> · <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={e => { e.stopPropagation(); openWith(c.id, true); }}>Refund the later one</button></>
                              )}
                            </span>
                          )}
                        </td>
                        <td data-label="Card" className={kit.nowrap}>{c.card ? `${brandLabel(c.card.brand)} ${c.card.last4}` : '—'}</td>
                        <td data-label="Stripe says" className={says.tone === 'bad' ? money.bad : says.tone === 'quiet' ? kit.muted : undefined}>{says.text}</td>
                        <td data-label="Amount" className={kit.num}>{formatCents(c.amountCents, c.currency)}</td>
                        <td className={kit.rowDoor}><button type="button" className={money.openBtn} aria-label={`Open the ${consoleWhen(c.createdAt)} charge`} onClick={e => { e.stopPropagation(); openWith(c.id, false); }}>›</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {nextBefore && (
            <div className={styles.more}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void showOlder()} disabled={older.loading}>{older.loading ? 'Reading…' : 'Show older charges'}</button>
              {older.failed && <span className={kit.fieldError} role="alert">Stripe could not be read. Try again in a moment.</span>}
            </div>
          )}
        </>
      )}

      {/* 12d-1 Part 4: the Stripe fees the club's online payments caused, billed to the club; ours, read from our rows. */}
      <StripeFeesPanel orgId={orgId} canRetry={billsClub} />

      <p className={kit.caption}>Families’ payments to this club are the club’s own money, on its own Stripe account. They are never shown or refunded here.</p>

      {openCharge && lastGood && (
        <ChargeWindows
          key={openCharge.id}
          orgId={orgId}
          orgName={orgName}
          chargeId={openCharge.id}
          startWithRefund={openCharge.refund}
          flag={patterns.flags.get(openCharge.id)}
          gate={lastGood.refundGate}
          read={lastGood.read}
          stripeBase={stripeBase}
          onClose={() => { setOpenCharge(null); onChargeClosed(); }}
          onRefunded={() => { club.readAgain(); onRefunded(); }}
        />
      )}
    </section>
  );
}

function OursOnly({ rows }: { rows: ReturnType<typeof compareRecord> }) {
  return (
    <div className={kit.card}>
      <div className={kit.tableWrap}>
        <table className={`${kit.comfortable} ${money.compare}`}>
          <thead><tr><th aria-label="What" /><th>Our record</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.key}><th scope="row" className={`${kit.eye} ${money.rowHead}`}>{r.label}</th><td>{r.ours}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── The charge window, then the refund window (drawing C; every refusal drawing G) ───────────────────────────────────

type ChargeAnswer = { charge: MoneyCharge; ourRefunds: ConsoleRefund[]; inFlight: string | null };

function ChargeWindows({ orgId, orgName, chargeId, startWithRefund, flag, gate, read, stripeBase, onClose, onRefunded }: {
  orgId: string; orgName: string; chargeId: string; startWithRefund: boolean; flag: ChargeFlag | undefined;
  gate: RefundGate | null;
  read: MoneyRead; stripeBase: string; onClose: () => void; onRefunded: () => void;
}) {
  const [answer, setAnswer] = useState<ChargeAnswer | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(startWithRefund);
  const [done, setDone] = useState<string | null>(null);

  // Opened, and read again after a refund: the charge is read from Stripe each time (and recovery runs on the server).
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money/charges/${encodeURIComponent(chargeId)}`, 'GET').then(({ ok, data }) => {
      if (!live) return;
      if (ok) { setAnswer(data as unknown as ChargeAnswer); setReadAt(new Date().toISOString()); setFailed(null); } // utc-intentional
      else setFailed(errorOf(data, 'Stripe could not be read. Try again in a moment.'));
    });
    return () => { live = false; };
  }, [orgId, chargeId, version]);

  const c = answer?.charge ?? null;
  // What the console knows before the click: the door is absent and one line says why (drawing G).
  const refusal = c ? doorRefusal(gate, c, answer?.inFlight) : null;
  const canRefund = !!c && !refusal;
  const paid = c ? paidForWords(c) : null;
  const fw = flag ? flagWords(flag) : null;
  const title = c ? `${paid!.main.replace(/ · first charge$/, '')} · ${consoleWhen(c.createdAt)}` : 'A charge';

  if (refunding && c && canRefund) {
    return (
      <RefundWindow
        orgId={orgId} orgName={orgName} charge={c} read={read} flaggedDuplicate={flag?.kind === 'duplicate'}
        onClose={() => { setRefunding(false); setVersion(v => v + 1); }}
        onDone={message => { setRefunding(false); setDone(message); setVersion(v => v + 1); onRefunded(); }}
      />
    );
  }

  const refundsSoFar = c?.refunds.filter(r => r.status === 'succeeded' || r.status === 'pending') ?? [];
  return (
    <KitDialog
      kind="form"
      size="medium"
      record
      title={title}
      onClose={onClose}
      footerStart={readAt ? <span>Read from Stripe at {consoleClock(readAt)}</span> : undefined}
      footer={(
        <>
          <DialogCancel className="btn btn-secondary">Close</DialogCancel>
          {canRefund && <button type="button" className="btn btn-secondary" onClick={() => setRefunding(true)}>Refund this charge</button>}
        </>
      )}
    >
      <div className={styles.windowBody}>
        {done && <p className={`${kit.notice} ${kit.noticeGood}`} role="status">{done}</p>}
        {failed && <p className={kit.fieldError} role="alert">{failed}</p>}
        {!c && !failed && <p className={kit.caption}>Reading the charge from Stripe…</p>}
        {c && (
          <>
            {fw && <p className={`${money.flag}${fw.tone === 'bad' ? ` ${money.bad}` : ''}`}>{fw.text}</p>}
            <dl className={money.lines}>
              <dt className={kit.eye}>Amount</dt><dd>{formatCents(c.amountCents, c.currency)}</dd>
              <dt className={kit.eye}>Paid for</dt><dd>{paid!.main}{paid!.period ? `, ${paid!.period}` : ''}</dd>
              <dt className={kit.eye}>Card</dt><dd>{c.card ? cardWords(c.card) : '—'}</dd>
              <dt className={kit.eye}>Stripe says</dt><dd>{stripeSaysWords(c).text}</dd>
              <dt className={kit.eye}>Refunded so far</dt>
              <dd>
                {refundsSoFar.length === 0 ? 'Nothing' : refundsSoFar.map(r => {
                  const ours = answer?.ourRefunds.find(o => o.stripeRefundId === r.id);
                  return (
                    <span key={r.id} className={money.refundLine}>
                      {formatCents(r.amountCents, c.currency)} · {consoleWhen(r.createdAt)} · {ours ? ours.actorEmail : 'in Stripe’s dashboard'}
                      {r.status === 'pending' ? ' · on its way' : ''}
                    </span>
                  );
                })}
              </dd>
              <dt className={kit.eye}>Stripe charge</dt>
              <dd className={styles.factLine}>
                <code className={kit.code}>{c.id}</code>
                <a className={`${kit.door} ${kit.doorSm}`} href={`${stripeBase}/payments/${c.id}`} target="_blank" rel="noreferrer">Open in Stripe</a>
              </dd>
            </dl>
            {refusal && (
              <p className={`${styles.refuseLine}${refusal.bad ? ` ${styles.refuseLineBad}` : ''}`}>
                <Flag size={15} aria-hidden className={styles.refuseIcon} />
                <span>{refusal.text}</span>
              </p>
            )}
          </>
        )}
      </div>
    </KitDialog>
  );
}

function RefundWindow({ orgId, orgName, charge, read, flaggedDuplicate, onClose, onDone }: {
  orgId: string; orgName: string; charge: MoneyCharge; read: MoneyRead; flaggedDuplicate: boolean;
  onClose: () => void; onDone: (message: string) => void;
}) {
  const left = remainingCents(charge);
  const [all, setAll] = useState(true);
  const [typed, setTyped] = useState('');
  // After Stripe answered no (or did not answer), the window only closes: the attempt is in the audit log (drawing G 2, 6).
  const [sent, setSent] = useState(false);
  // A refusal after the click that sent nothing (the amount changed, our record could not be written): said in the foot.
  const [nothingSent, setNothingSent] = useState(false);
  const typedCents = centsFromTyped(typed);
  const amount = all ? left : typedCents;
  const over = !all && typedCents != null && typedCents > left;
  const earlier = charge.refundedCents;
  const card = cardWords(charge.card);
  const when = consoleWhen(charge.createdAt);
  const next = read.nextCharge;
  const receipt = read.testMode
    ? 'Test payment: no money moves.'
    : read.customer.email ? `Stripe emails a receipt to ${read.customer.email}.` : 'Stripe has no email for this customer, so no receipt is sent.';

  const sentence = amount && !over ? (
    <>
      {read.testMode && <><span className={`${kit.chip} ${kit.chipInfo}`}>Test mode</span>{' '}</>}
      {amount === charge.amountCents
        ? <>Refund <b>{formatCents(amount, charge.currency)}</b> to the <b>{card}</b>. </>
        : <>Refund <b>{formatCents(amount, charge.currency)}</b> of the <b>{formatCents(charge.amountCents, charge.currency)}</b> charge to the <b>{card}</b>. </>}
      <b>This cannot be undone.</b>{' '}
      {earlier + amount < charge.amountCents && <>With {earlier ? `the ${formatCents(earlier, charge.currency)} already refunded` : 'this refund'}, {formatCents(charge.amountCents - earlier - amount, charge.currency)} stays paid. </>}
      {possessive(orgName)} plan does not change{next ? <>, the subscription keeps running, and the next charge is still {formatStoredDate(next.at)}</> : ''}.
      {' '}The card usually shows it in 5 to 10 business days. {receipt}
    </>
  ) : <>Choose how much to refund.</>;

  return (
    <RecordWindow
      title={`Refund the ${when} charge`}
      sentence={sentence}
      sentenceAfter
      danger
      confirmLabel={amount && !over ? `Refund ${formatCents(amount, charge.currency)}` : 'Refund'}
      confirmBlocked={!amount || over}
      confirmHidden={sent}
      cancelLabel={sent ? 'Close' : 'Cancel'}
      whyPlaceholder="Why are you refunding it? Never a card number."
      footNote={sent ? 'The attempt is in the audit log.' : nothingSent ? 'Nothing was sent to Stripe.' : 'Goes to Stripe at once.'}
      onClose={onClose}
      whyMax={REFUND_REASON_MAX}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money/charges/${encodeURIComponent(charge.id)}/refund`, 'POST', {
          amountCents: amount, remainingSeenCents: left, reason, duplicate: flaggedDuplicate,
        });
        if (ok) { onDone(typeof data.message === 'string' ? data.message : 'Refunded.'); return null; }
        // Only the server's own "nothing was sent" is believed: a lost answer (a dropped connection, a gateway's page) may
        // have followed a refund Stripe made, so it reads as unknown, and the charge is checked when it is opened again.
        if (data.nothingSent === true) {
          setNothingSent(true);
          return errorOf(data, 'That did not go through. Try again in a moment.');
        }
        setSent(true);
        return errorOf(data, REFUND_WORDS.noAnswer);
      }}
    >
      {!sent && (
        <div className={kit.fieldGroup} role="radiogroup" aria-label="How much">
          <div className={styles.choices}>
            <label className={`${styles.choice}${all ? ` ${styles.choiceOn}` : ''}`}>
              <input type="radio" name="refund-amount" checked={all} onChange={() => setAll(true)} />
              <span>
                <span className={styles.choiceLabel}>{earlier ? 'All that is left' : 'All of it'}</span>
                <span className={styles.choiceSub}>
                  {formatCents(left, charge.currency)} back to the {card}
                  {earlier ? ` (${formatCents(earlier, charge.currency)} was refunded before)` : ''}
                </span>
              </span>
            </label>
            <label className={`${styles.choice}${!all ? ` ${styles.choiceOn}` : ''}`}>
              <input type="radio" name="refund-amount" checked={!all} onChange={() => setAll(false)} />
              <span><span className={styles.choiceLabel}>Part of it</span><span className={styles.choiceSub}>Up to {formatCents(left, charge.currency)}</span></span>
            </label>
          </div>
          {!all && (
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Amount<span className={kit.req} aria-hidden>*</span></span>
              <input className={`${kit.field} ${money.amount}`} inputMode="decimal" value={typed} onChange={e => setTyped(e.target.value)} placeholder="$0.00" aria-invalid={over || (typed !== '' && typedCents == null)} />
              {over
                ? <span className={kit.fieldError}>Only {formatCents(left, charge.currency)} of this charge can still be refunded.</span>
                : typed !== '' && typedCents == null
                  ? <span className={kit.fieldError}>{REFUND_WORDS.amount}</span>
                  : <span className={kit.hint}>of {formatCents(left, charge.currency)} still refundable</span>}
            </label>
          )}
        </div>
      )}
    </RecordWindow>
  );
}
