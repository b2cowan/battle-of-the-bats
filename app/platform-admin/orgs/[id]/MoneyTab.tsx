'use client';
/**
 * The Money tab (Support console Stage 3, owner rulings 2026-10-26; drawings A, B, C, G): Stripe beside our record, read
 * when the tab opens and never kept (R7, Q4 A). The first line says whether they agree — or names a double charge — then
 * the joined money band, the subscription twice (ours, Stripe's; a difference marked on its row), and the sales.
 * GST/HST Stage 3 Part 2 (owner 2026-11-06, all eight Asks A): the list is one row per SALE (an invoice) from our kept tax
 * record, with Stripe's payments joined in, and a Tax column; a sale opens as a record window with its tax, where it was taxed
 * and its payment. When Stripe cannot be read the sales stay, from our record. The rules are lib/console-money-sales.ts.
 * A sale's charge refunds through "Refund this charge", for the refund power only.
 * A role without the Stripe-reading power never asks: it sees our record and one line. The rules are lib/console-money.ts.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { consoleClock, consoleDay, consoleWhen } from '@/lib/console-dates';
import { formatStoredDate } from '@/lib/timezone';
import { possessive } from '@/lib/utils';
import {
  agreeLine, cardWords, centsFromTyped, chargeFailureWords, compareRecord, creditSplitWords, differsWords, failedBillOf, failedBills,
  failedStoryWords, findPatterns, flagWords, formatCents, triesWords, FAILED_WORDS,
  UNREAD_NEXT_CHARGE, moneyBand, nextChargeCell, refundDoorRefusal, remainingCents, subscriptionsMoreWords, yearBefore, REFUND_REASON_MAX, REFUND_WORDS,
  type ChargeCreditNote, type ChargeFlag, type CompareRow, type MoneyCharge, type MoneyInvoice, type MoneyRead, type OurMoneyRecord,
} from '@/lib/console-money';
import type { LookedMark, LookReason, NeedsLookRead } from '@/lib/console-money-needs-look';
import {
  NEEDS_LOOK_WORDS, SALES_WORDS, addressChangedSince, asItStoodLabel, cadRateWords, creditNoteTaxWords, evidenceLines, gstAnswerWords, isUnpaidSale,
  isVoidSale, joinSales, keptWords, moneyBandFromSales, notesPaidBackCents, saleAmount, saleCardCell, saleCents, saleFlag, saleRecordSays,
  saleStripeSays, saleTaxCell, saleWhatWords, saleWindowBand, taxLineWords, taxedForWords, unexplainedRefunds,
  type SaleNoteRecord, type SaleRecord, type SaleRow, type SalesRecords,
} from '@/lib/console-money-sales';
import type { ConsoleRefund } from '@/lib/console-money-store';
import RecordWindow from '../../RecordWindow';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import styles from '../../record.module.css';
import money from './money.module.css';
import StripeFeesPanel from './StripeFeesPanel';
import BillingAddressPanel, { BILLING_ADDRESS_ANCHOR, ReviewText, reviewOf, type BillingAddressRead } from './BillingAddressPanel';
import { BILLING_LOCATION_CONSOLE_WORDS } from '@/lib/billing-location';

/** What the server knows of this person and club before any click (the refund route asks the same rule with them). */
type RefundGate = { role: string; ownClub: boolean; demoClub: boolean; refundsLast24h: number };
/** GST/HST Stage 3 Part 2: our kept records and the registration date ride beside Stripe in every state (null = not readable). */
type OurSales = { records?: SalesRecords; registrationDate?: string | null };
export type MoneyResponse =
  | { state: 'no_customer' }
  | { state: 'shared' }
  | ({ state: 'unreachable'; readAt: string } & OurSales)
  | ({ state: 'read'; read: MoneyRead; portalSubscriptionIds: string[]; coversOtherPortals?: boolean; refundGate: RefundGate | null } & OurSales);

/** Why this charge's refund door is absent, known before the click (drawing G), or null when it shows. */
function doorRefusal(gate: RefundGate | null, c: MoneyCharge, inFlight: string | null = null): { text: string; bad: boolean } | null {
  if (!gate) return { text: REFUND_WORDS.tabNotRead, bad: false };
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

/** GST/HST Stage 3 Part 3a: the needs-a-look route's answer (null while it is read). */
type NeedsLookAnswer = NeedsLookRead | { state: 'no_customer' } | { state: 'shared' } | null;

/**
 * The sales that need a look, read by the club record on open (like the billing address) so the Money tab's dot lights before
 * the tab is opened; the strip, the dot and the list all read this one answer. Never runs for a role without the Stripe power.
 */
export function useNeedsLook(orgId: string, enabled: boolean) {
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{ ask: number; look: NeedsLookAnswer } | null>(null);
  const answeredAsk = answer?.ask ?? -1;
  useEffect(() => {
    if (!enabled || answeredAsk === asked) return;
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money/needs-look`, 'GET').then(({ ok, data }) => {
      // A re-read that fails keeps the last good answer: a flagged club must not turn clean-looking because one request dropped.
      // (The server reports its own failed read as a 200 `{ state: 'failed' }`, so both kinds of failure are caught here.)
      if (live) {
        const next: NeedsLookAnswer = ok ? (data as unknown as NeedsLookAnswer) : { state: 'failed' };
        setAnswer(prev => ({ ask: asked, look: next?.state === 'failed' && prev?.look?.state === 'read' ? prev.look : next }));
      }
    });
    return () => { live = false; };
  }, [enabled, asked, answeredAsk, orgId]);
  const readAgain = useCallback(() => setAsked(n => n + 1), []);
  // The last answer stays on screen while a re-read is out (the dot does not blink off and on).
  return { look: enabled ? answer?.look ?? null : null, readAgain };
}

/** How many sales need a look: a number only when it was read. */
export const lookCount = (look: NeedsLookAnswer): number => (look?.state === 'read' ? look.sales.length : 0);

/** The later of two window starts (either may be null): the next page starts where the newer source left off; repeats join once. */
const laterOf = (a: string | null | undefined, b: string | null | undefined) => (!a ? b ?? null : !b ? a : a > b ? a : b);

type Older = {
  forRead: string | null; charges: MoneyCharge[]; invoices: MoneyInvoice[]; sales: SaleRecord[]; notes: SaleNoteRecord[];
  before: string | null; from: string | null; chargesFrom: string | null; pages: number; exhausted: boolean; loading: boolean; failed: boolean;
};
const freshOlder = (forRead: string | null): Older => ({ forRead, charges: [], invoices: [], sales: [], notes: [], before: null, from: null, chargesFrom: null, pages: 0, exhausted: false, loading: false, failed: false });

/** Which sales the list shows (Ask 1/4 = A: one dropdown, quiet until it filters). "look" = Needs a look (Part 3a). */
type SaleFilter = 'all' | 'unpaid' | 'look';
/** A sale to open: by its invoice (a row), or by a charge (a bare charge, or Find's `?charge=`). */
type OpenSale = { number: string; refund: boolean; atTax: boolean };

export default function MoneyTab({
  orgId, orgName, ours, readsStripe, billsClub = false, marksLooks = false, startOnLook = false, stripeBase, club, billing, needsLook, openChargeId, onChargeClosed, onRefunded,
}: {
  orgId: string;
  /** GST/HST Stage 3 Part 3b: may mark a sale as looked at (`refund`: Super admin, Billing). Support sees the list, never the door. */
  marksLooks?: boolean;
  /** Opened from the Clubs list's Sales tax filter (`?show=needs_look`): the list starts on Needs a look. */
  startOnLook?: boolean;
  /** GST/HST Stage 1 Part 3: the billing address, read once by the club record (it also drives the tab's dot). */
  billing: BillingAddressRead;
  /** GST/HST Stage 3 Part 3a: the sales that need a look, read once by the club record (they drive the dot too). */
  needsLook: ReturnType<typeof useNeedsLook>;
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
  const firstAt = m?.state === 'read' ? m.read.readAt : m?.state === 'unreachable' ? m.readAt : null;
  // The last good read: an open sale window outlives a later read that failed (its refund notice is not lost).
  const [lastGood, setLastGood] = useState<Extract<MoneyResponse, { state: 'read' }> | null>(null);
  if (m?.state === 'read' && m !== lastGood) setLastGood(m);
  // Older sales belong to the read they were asked from: a new read starts again from its own twelve months.
  const [olderState, setOlder] = useState<Older>(() => freshOlder(null));
  // Memoised: a stable empty value keeps the join below from re-running on every render until "Show older sales" is used.
  const older = useMemo(() => (olderState.forRead === firstAt ? olderState : freshOlder(firstAt)), [olderState, firstAt]);
  const [explain, setExplain] = useState<CompareRow['key'] | null>(null); // the one "Differs" chip open
  const [openSale, setOpenSale] = useState<OpenSale | null>(openChargeId ? { number: openChargeId, refund: false, atTax: false } : null);
  const [filter, setFilter] = useState<SaleFilter>(startOnLook ? 'look' : 'all');

  const records = m?.state === 'read' || m?.state === 'unreachable' ? m.records : undefined;
  const recordsRead = records?.state === 'read';
  const registration = m?.state === 'read' || m?.state === 'unreachable' ? m.registrationDate ?? null : null;
  const stripeRead = !!read;

  const allCharges = useMemo(() => (read ? [...read.charges, ...older.charges] : []), [read, older.charges]);
  const portalSubs = m?.state === 'read' ? m.portalSubscriptionIds : null;
  const patterns = useMemo(() => findPatterns({ charges: allCharges, subscriptions: read?.subscriptions ?? [] }, ours.subscriptionId, portalSubs ?? []),
    [allCharges, read, ours.subscriptionId, portalSubs]);
  const rows = useMemo(() => joinSales({
    records: records?.state === 'read' ? [...records.sales, ...older.sales] : [],
    notes: records?.state === 'read' ? [...records.notes, ...older.notes] : [],
    charges: read ? allCharges : null,
    invoices: read ? [...(read.invoices ?? []), ...older.invoices] : [],
    shownFrom: older.from ?? (firstAt ? yearBefore(firstAt) : null),
    chargesFrom: older.pages ? older.chargesFrom : read?.chargesFrom ?? null,
  }), [records, older.sales, older.notes, older.invoices, older.from, older.pages, older.chargesFrom, read, allCharges, firstAt]);
  // Needs a look (Part 3a): the server's list of every sale on record that needs one, whatever its date, joined with the Stripe
  // charges loaded so far. A sale older than those speaks from our record (`chargesFrom`), never "Paid outside Stripe".
  const look = needsLook.look?.state === 'read' ? needsLook.look : null;
  const lookRows = useMemo(() => {
    if (!look) return [];
    const keys = new Set(look.sales.map(s => s.stripe_invoice_id));
    return joinSales({
      records: look.sales, notes: look.notes, charges: read ? allCharges : null,
      invoices: read ? [...(read.invoices ?? []), ...older.invoices] : [], shownFrom: null,
      chargesFrom: older.pages ? older.chargesFrom : read?.chargesFrom ?? null,
    }).filter(r => keys.has(r.key));
  }, [look, read, allCharges, older.invoices, older.pages, older.chargesFrom]);
  const reasonsOf = (key: string): LookReason[] => look?.reasons[key] ?? [];
  // A sale a mark holds is not in the list; its window says who looked (Part 3b).
  const lookedOf = (key: string): LookedMark | undefined => look?.looked?.[key];
  // The choice shows whenever the answer was read, even with none left (it never appears and disappears); it is left out when
  // it could not be read, as when our records fail (drawing tab 4).
  const lookChoice = !!look && recordsRead;
  const shownFilter: SaleFilter = filter === 'look' && !lookChoice ? 'all' : filter;
  const shown = shownFilter === 'look' ? lookRows : rows.filter(r => shownFilter === 'all' || isUnpaidSale(r));
  const counted = shown.filter(r => !isVoidSale(r)).length;
  const listRef = useRef<HTMLDivElement>(null);
  const showThem = () => { setFilter('look'); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const compare = compareRecord(ours, read);
  const firstBefore = laterOf(read?.olderBefore, records?.state === 'read' ? records.olderBefore : null);
  const nextBefore = older.exhausted ? null : older.pages ? older.before : firstBefore;

  async function showOlder() {
    if (!nextBefore) return;
    setOlder({ ...older, loading: true, failed: false });
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money?before=${encodeURIComponent(nextBefore)}`, 'GET');
    const res = data as unknown as MoneyResponse;
    const page = ok && (res.state === 'read' || res.state === 'unreachable') ? res : null;
    const pageRecords = page?.records?.state === 'read' ? page.records : null;
    // A page is good only when EVERY source this list is built from answered (Stripe if it was read, our records if they were):
    // a half-answered page would skip that window for good, so it fails and asks again from the same place.
    if (page && (!stripeRead || page.state === 'read') && (!recordsRead || pageRecords)) {
      const pageRead = page.state === 'read' ? page.read : null;
      const before = laterOf(pageRead?.olderBefore, pageRecords?.olderBefore);
      setOlder({ ...older, chargesFrom: pageRead?.chargesFrom ?? older.chargesFrom,
        charges: [...older.charges, ...(pageRead?.charges ?? [])], invoices: [...older.invoices, ...(pageRead?.invoices ?? [])],
        sales: [...older.sales, ...(pageRecords?.sales ?? [])], notes: [...older.notes, ...(pageRecords?.notes ?? [])],
        before, from: yearBefore(nextBefore), pages: older.pages + 1, exhausted: !before || before >= nextBefore, loading: false, failed: false });
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
  // A flag that needs a person goes FIRST on the tab, above the Stripe comparison: the green "agree" line below it is about the
  // subscription only, and must never read as an all-clear while a buyer's tax is being held at Canadian.
  const review = reviewOf(billing);
  // Part 3a (Ask 4 = A, no second strip): the sales that need a look are one more line in the same strip, first, with "Show them".
  const looking = lookCount(needsLook.look);
  const chip = <span className={`${kit.chip} ${kit.chipWarn}`}>{BILLING_LOCATION_CONSOLE_WORDS.needsReview}</span>;
  // The doors only show once the list and the address block are on the page (they are not while Stripe is still being read).
  const reviewStripWith = (door: boolean) => (review || looking > 0) && (
    <div className={`${kit.callout} ${kit.calloutWarn}`} role="status">
      <span className={money.stripLines}>
        {looking > 0 && (
          <span>
            {chip} {NEEDS_LOOK_WORDS.strip(looking)}
            {/* With the registration date unread, nothing is called missing: said quietly (Part 2's rule). */}
            {look && look.registrationDate === null && <span className={kit.sub}>{SALES_WORDS.registrationUnread}</span>}
          </span>
        )}
        {review && <span>{chip} <ReviewText review={review} /></span>}
      </span>
      {door && (
        <span className={kit.calloutEnd}>
          {looking > 0 && lookChoice && <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={showThem}>{NEEDS_LOOK_WORDS.showThem}</button>}
          {review && (
            <button type="button" className={`${kit.door} ${kit.doorSm}`}
              onClick={() => document.getElementById(BILLING_ADDRESS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              See billing address
            </button>
          )}
        </span>
      )}
    </div>
  );
  if (!m || (club.loading && !read && m.state !== 'unreachable')) {
    return <section className={kit.section}>{reviewStripWith(false)}<p className={kit.caption}>Reading Stripe…</p></section>;
  }
  const reviewStrip = reviewStripWith(true);

  const testChip = read?.testMode ? <span className={`${kit.chip} ${kit.chipInfo}`}>Test mode</span> : null;
  const readAt = read ? consoleClock(read.readAt) : null;
  const readBoth = () => { club.readAgain(); needsLook.readAgain(); };
  const again = <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={readBoth} disabled={club.loading}>{club.loading ? 'Reading…' : 'Read again'}</button>;
  const amber = (text: string) => (
    <div className={`${kit.callout} ${kit.calloutWarn}`}>
      <span>{text}</span>
      <span className={kit.calloutEnd}>{again}</span>
    </div>
  );

  let head;
  if (m.state === 'no_customer') {
    head = <p className={kit.callout}>This club has never paid us by card. There is no Stripe customer, so there is nothing to compare or refund.</p>;
  } else if (m.state === 'shared') {
    head = <p className={`${kit.callout} ${kit.calloutBad}`}>Another club uses this Stripe customer, so nothing from Stripe is shown or refunded here. Tell the product team.</p>;
  } else if (m.state === 'unreachable') {
    // Ask 2 = A: the callout says what IS here (our record's sales), then what waits; both failing names both (gap 7 = A).
    head = amber(recordsRead ? SALES_WORDS.unreachable(consoleClock(m.readAt)) : SALES_WORDS.bothFailed(consoleClock(m.readAt)));
  } else {
    const line = agreeLine(compare, patterns, ours.subscriptionId);
    head = (
      <>
        <div className={`${kit.callout}${line.tone === 'warn' ? ` ${kit.calloutWarn}` : line.tone === 'bad' ? ` ${kit.calloutBad}` : ''}`}>
          <span>
            {line.text}
            {line.secondSubscriptionId && <> <a className={kit.door} href={`${stripeBase}/subscriptions/${line.secondSubscriptionId}`} target="_blank" rel="noreferrer">Open it in Stripe</a></>}
            {read?.testMode && <> Test payment: no money moves.</>}
          </span>
        </div>
        {!recordsRead && amber(SALES_WORDS.recordsFailed(consoleClock(m.read.readAt)))}
      </>
    );
  }

  // Plans & pricing Stage 2 Part 2: a failed payment goes first, above the agree line (which is about the subscription only and
  // must not read as an all-clear). Read only: its door opens the bill's own window. Stripe unread = no notice (the amber line
  // above says the failed payment waits), never "nothing failed".
  const failing = read ? failedBills(read) : [];
  const failedWords = failing[0] ? failedStoryWords(failing[0], { pastDue: ours.status === 'past_due', more: failing.length - 1 }) : null;
  const failedNotice = failedWords && (
    <div className={`${kit.callout} ${kit.calloutWarn}`} role="status">
      <span><b>{failedWords.lead}</b>{failedWords.text}</span>
      <span className={kit.calloutEnd}>
        {failing.length > 1 && (
          <button type="button" className={`${kit.door} ${kit.doorSm}`}
            onClick={() => { setFilter('unpaid'); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            {FAILED_WORDS.showThem}
          </button>
        )}
        <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => setOpenSale({ number: failing[0].invoiceId, refund: false, atTax: false })}>
          {FAILED_WORDS.seeBill}
        </button>
      </span>
    </div>
  );

  const gate = m.state === 'read' ? m.refundGate : null;
  const since = firstAt ? yearBefore(firstAt) : '';
  // Part 4: one rule over the sales for both bands (before tax, from our record). Our record unreadable = Stripe's own totals, said to include tax.
  const bandNotes = records?.state === 'read' ? records.bandNotes : undefined;
  const band = read
    ? recordsRead ? moneyBandFromSales(rows, { since, bandNotes, stripeRead: true, next: nextChargeCell(read) }) : moneyBand({ ...read, charges: allCharges }, since)
    : m.state === 'unreachable' && recordsRead ? moneyBandFromSales(rows, { since, bandNotes, stripeRead: false, next: UNREAD_NEXT_CHARGE }) : null;
  // The list shows when there is something to list from: Stripe, or (Stripe down) our records.
  const listed = stripeRead || (m.state === 'unreachable' && recordsRead);
  const open = (row: SaleRow, opts: { refund?: boolean; atTax?: boolean; chargeId?: string } = {}) =>
    setOpenSale({ number: opts.chargeId ?? row.key, refund: !!opts.refund, atTax: !!opts.atTax });
  const isOpened = (r: SaleRow) => !!openSale && (r.key === openSale.number || r.charges.some(c => c.id === openSale.number));
  const openRow = openSale ? rows.find(isOpened) ?? lookRows.find(isOpened) ?? null : null;

  return (
    <section className={kit.section}>
      {reviewStrip}
      {failedNotice}
      {head}
      {m.state === 'read' && m.coversOtherPortals && (
        <p className={kit.caption}>This is the coach’s own Stripe customer, so it also covers other portals they pay for. A charge below may belong to one of them.</p>
      )}

      {band && (
        <div className={kit.band}>
          {band.map(b => (
            <div key={b.label} className={`${kit.bandCell}${b.tone === 'warn' ? ` ${kit.bandWarn}` : ''}`}>
              <span className={kit.bandLabel}>{b.label}</span>
              <span className={kit.bandValue}>{b.value}</span>
              <span className={kit.bandNote}>{b.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* When Stripe was read, and the one door that reads it again: they cover the whole tab, so they sit once, here. */}
      <div className={money.headRow}>
        <h2 className={kit.sectionTitle}>The subscription</h2>
        {read && <span className={money.readStamp}>{testChip}<span className={kit.caption}>Read from Stripe at {readAt}</span>{again}</span>}
      </div>
      <div className={kit.card}>
        <div className={kit.tableWrap}>
          <table className={kit.comfortable}>
            <thead><tr><th aria-label="What" /><th>Our record</th><th>Stripe</th></tr></thead>
            <tbody>
              {compare.map(r => (
                <Fragment key={r.key}>
                  <tr>
                    <th scope="row" className={`${kit.eye} ${money.rowHead}`}>{r.label}</th>
                    <td>{r.ours}</td>
                    <td>
                      {m.state === 'no_customer' ? (r.key === 'plan' ? 'No Stripe customer' : '') : r.stripe}
                      {r.stripeId && read && <> · <a className={`${kit.door} ${kit.doorSm}`} href={`${stripeBase}/${r.key === 'customer' ? 'customers' : 'subscriptions'}/${r.stripeId}`} target="_blank" rel="noreferrer">Open in Stripe</a></>}
                      {r.differs && <> <button type="button" className={`${kit.chip} ${kit.chipWarn} ${money.chipButton}`} onClick={() => setExplain(x => (x === r.key ? null : r.key))} aria-expanded={explain === r.key} aria-controls={`differs-${r.key}`}>Differs</button></>}
                    </td>
                  </tr>
                  {r.differs && explain === r.key && (
                    <tr id={`differs-${r.key}`} className={money.differsRow}>
                      <td colSpan={3}>{differsWords(r, compare)}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {read?.subscriptionsMore && <p className={kit.caption}>{subscriptionsMoreWords(read.subscriptions.length)}</p>}
      {compare.some(r => r.differs) && (
        <p className={kit.caption}>Nothing here changes our record. A difference usually clears when Stripe’s next update arrives. If it is still there tomorrow, tell the product team.</p>
      )}

      {listed && (
        <>
          <div className={kit.toolbar} ref={listRef}>
            <span className={kit.count}>
              {shownFilter === 'look' ? NEEDS_LOOK_WORDS.count(counted)
                : counted === 0 && shownFilter === 'unpaid' ? SALES_WORDS.emptyUnpaid : SALES_WORDS.count(counted, shownFilter, older.pages > 0)}
            </span>
            <span className={kit.toolbarEnd}>
              <select className={`${kit.select}${shownFilter !== 'all' ? ` ${money.filterOn}` : ''}`} value={shownFilter} aria-label="Show"
                onChange={e => setFilter(e.target.value as SaleFilter)}>
                <option value="all">{SALES_WORDS.filters.all}</option>
                {lookChoice && <option value="look">{NEEDS_LOOK_WORDS.filter}</option>}
                <option value="unpaid">{SALES_WORDS.filters.unpaid}</option>
              </select>
            </span>
          </div>
          <div className={kit.card}>
            <div className={`${kit.tableWrap} table-cards`}>
              <table className={kit.comfortable}>
                <thead><tr><th>When</th><th>What it paid for</th><th>Tax</th><th>Card</th><th>{stripeRead ? 'Stripe says' : 'Our record says'}</th><th className={kit.num}>Amount</th><th aria-label="Open" /></tr></thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr><td colSpan={7} className={kit.empty}>
                      {shownFilter === 'look' ? (
                        <>
                          <strong className={money.emptyTitle}>{NEEDS_LOOK_WORDS.emptyTitle}</strong>
                          {NEEDS_LOOK_WORDS.emptyText(look?.registrationDate ?? null)}{' '}
                          <button type="button" className={kit.door} onClick={() => setFilter('all')}>{NEEDS_LOOK_WORDS.showAll}</button>
                        </>
                      ) : shownFilter === 'unpaid' ? SALES_WORDS.emptyUnpaid : SALES_WORDS.emptyAll}
                    </td></tr>
                  )}
                  {shown.map(row => {
                    const lookReason = reasonsOf(row.key)[0];
                    const what = saleWhatWords(row);
                    const tax = saleTaxCell(row, registration, recordsRead);
                    const fromStripe = stripeRead && !row.chargeUnread;
                    const says = fromStripe ? saleStripeSays(row, read?.readAt) : saleRecordSays(row);
                    const card = saleCardCell(row, fromStripe);
                    const amount = saleAmount(row);
                    const sf = stripeRead ? saleFlag(row, patterns) : null;
                    const fw = sf ? flagWords(sf.flag) : null;
                    const flagged = sf ? row.charges.find(c => c.id === sf.chargeId) : undefined;
                    const canRefundFlagged = !!flagged && !doorRefusal(gate, flagged);
                    const struck = says.void ? money.struck : undefined;
                    return (
                      <tr key={row.key} className={kit.clickableRow} onClick={() => open(row)}>
                        <td className={`${kit.nowrap} table-cards-title`}>{consoleWhen(row.at)}</td>
                        <td data-label="What it paid for">
                          <span className={struck}>{what.main}</span>
                          {what.period && <span className={kit.sub}>{what.period}</span>}
                          {fw && (
                            <span className={`${money.flag}${fw.tone === 'bad' ? ` ${money.bad}` : ''}`}>
                              {fw.text}
                              {sf?.flag.kind === 'duplicate' && canRefundFlagged && (
                                <> · <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={e => { e.stopPropagation(); open(row, { refund: true, chargeId: sf.chargeId }); }}>Refund the later one</button></>
                              )}
                            </span>
                          )}
                          {lookReason && <span className={`${money.flag} ${money.warnText}`}>{NEEDS_LOOK_WORDS.lead}{lookReason.text}</span>}
                        </td>
                        <td data-label="Tax" className={tax.tone === 'quiet' ? kit.muted : undefined}>
                          {tax.tone === 'missing'
                            ? <button type="button" className={`${kit.chip} ${kit.chipWarn} ${money.chipButton}`} onClick={e => { e.stopPropagation(); open(row, { atTax: true }); }}>{tax.main}</button>
                            : tax.main}
                          {tax.sub && <span className={kit.sub}>{tax.sub}</span>}
                        </td>
                        <td data-label="Card" className={`${kit.nowrap}${card.quiet ? ` ${kit.muted}` : ''}`}>{card.text}</td>
                        <td data-label={stripeRead ? 'Stripe says' : 'Our record says'} className={says.tone === 'bad' ? money.bad : says.tone === 'quiet' ? kit.muted : says.tone === 'warn' ? money.warnText : undefined}>
                          {says.void ? <span className={`${kit.chip} ${kit.chipQuiet}`}>Void</span> : says.text}
                          {says.sub && <span className={kit.sub}>{says.sub}</span>}
                        </td>
                        <td data-label="Amount" className={kit.num}><span className={struck}>{saleCents(amount.cents, amount.currency)}</span></td>
                        <td className={kit.rowDoor}><button type="button" className={money.openBtn} aria-label={`Open the ${consoleWhen(row.at)} sale`} onClick={e => { e.stopPropagation(); open(row); }}>›</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {recordsRead && registration === null && <p className={kit.caption}>{SALES_WORDS.registrationUnread}</p>}
          {recordsRead && needsLook.look?.state === 'failed' && <p className={kit.caption}>{NEEDS_LOOK_WORDS.readFailed}</p>}
          {/* Needs a look is already every sale on record: there is nothing older to show. */}
          {nextBefore && shownFilter !== 'look' && (
            <div className={styles.more}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void showOlder()} disabled={older.loading}>{older.loading ? 'Reading…' : SALES_WORDS.showOlder}</button>
              {older.failed && <span className={kit.fieldError} role="alert">Stripe could not be read. Try again in a moment.</span>}
            </div>
          )}
        </>
      )}

      {/* 12d-1 Part 4: the Stripe fees the club's online payments caused, billed to the club; ours, read from our rows. */}
      <StripeFeesPanel orgId={orgId} canRetry={billsClub} />

      {/* GST/HST Stage 1 Part 3: where the buyer is billed, and any "Needs review"; ours, read only. */}
      <BillingAddressPanel answer={billing} />

      <p className={kit.caption}>Families’ payments to this club are the club’s own money, on its own Stripe account. They are never shown or refunded here.</p>

      {openSale && (lastGood || m.state === 'unreachable') && (
        <SaleWindow
          key={openSale.number}
          orgId={orgId}
          orgName={orgName}
          number={openSale.number}
          startWithRefund={openSale.refund}
          atTax={openSale.atTax}
          listRow={openRow}
          flag={openRow && stripeRead ? saleFlag(openRow, patterns)?.flag : undefined}
          gate={lastGood?.refundGate ?? null}
          read={lastGood?.read ?? null}
          registration={registration}
          reasonsOf={reasonsOf}
          lookedOf={lookedOf}
          canMark={marksLooks}
          onLooksChanged={needsLook.readAgain}
          billing={billing}
          stripeBase={stripeBase}
          onSeeAddress={() => { setOpenSale(null); onChargeClosed(); setTimeout(() => document.getElementById(BILLING_ADDRESS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}
          onClose={() => { setOpenSale(null); onChargeClosed(); }}
          onRefunded={() => { readBoth(); onRefunded(); }}
        />
      )}
    </section>
  );
}

function OursOnly({ rows }: { rows: ReturnType<typeof compareRecord> }) {
  return (
    <div className={kit.card}>
      <div className={kit.tableWrap}>
        <table className={kit.comfortable}>
          <thead><tr><th aria-label="What" /><th>Our record</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.key}><th scope="row" className={`${kit.eye} ${money.rowHead}`}>{r.label}</th><td>{r.ours}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── The sale's window, then the refund window (drawing C, Part 2 tab 3; every refusal drawing G) ─────────────────────

type SaleAnswer = {
  stripe: 'read' | 'unreachable';
  sale: SaleRecord | null;
  notes: SaleNoteRecord[];
  invoice: MoneyInvoice | null;
  charge: MoneyCharge | null;
  ourRefunds: ConsoleRefund[];
  inFlight: string | null;
  creditNotes: ChargeCreditNote[] | null;
  /** Our tax record could not be read (as opposed to there being none): the window then says "Not read". */
  recordFailed?: boolean;
};

/** The sale as the window shows it: the answer's fresh charge and record joined (with the list's failed tries, when it has them). */
function windowRow(answer: SaleAnswer, listRow: SaleRow | null): SaleRow | null {
  const stripe = answer.stripe === 'read';
  const charges = stripe ? [...(listRow?.charges ?? []).filter(c => c.id !== answer.charge?.id), ...(answer.charge ? [answer.charge] : [])] : null;
  const joined = joinSales({
    records: answer.sale ? [answer.sale] : [], notes: answer.notes, charges,
    invoices: answer.invoice ? [answer.invoice] : [], shownFrom: null,
  });
  const key = answer.sale?.stripe_invoice_id ?? answer.invoice?.id ?? answer.charge?.id;
  return joined.find(r => r.key === key) ?? joined[0] ?? null;
}

function SaleWindow({ orgId, orgName, number, startWithRefund, atTax, listRow, flag, gate, read, registration, reasonsOf, lookedOf, canMark, onLooksChanged, billing, stripeBase, onSeeAddress, onClose, onRefunded }: {
  orgId: string; orgName: string; number: string; startWithRefund: boolean; atTax: boolean; listRow: SaleRow | null; flag: ChargeFlag | undefined;
  gate: RefundGate | null; read: MoneyRead | null; registration: string | null;
  /** Part 3a: every reason a sale needs a look, in priority order (the row shows the first), by invoice. Asked with the invoice
   *  the window itself read, so a sale opened by an old charge number (Find) still shows them. */
  reasonsOf: (invoiceId: string) => readonly LookReason[];
  /** Part 3b: the mark that holds on this sale, if any; whether this role may mark / put back; read the list again after either. */
  lookedOf: (invoiceId: string) => LookedMark | undefined;
  canMark: boolean;
  onLooksChanged: () => void;
  billing: BillingAddressRead; stripeBase: string;
  onSeeAddress: () => void; onClose: () => void; onRefunded: () => void;
}) {
  const [answer, setAnswer] = useState<SaleAnswer | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(startWithRefund);
  const [looking, setLooking] = useState<'mark' | 'putback' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const taxRef = useRef<HTMLHeadingElement>(null);

  // Opened, and read again after a refund: the sale is read each time (and recovery runs on the server). A row opens by its
  // invoice; a refund door (and Find) by the charge.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${orgId}/money/charges/${encodeURIComponent(number)}`, 'GET').then(({ ok, data }) => {
      if (!live) return;
      if (ok) { setAnswer(data as unknown as SaleAnswer); setReadAt(new Date().toISOString()); setFailed(null); } // utc-intentional
      else setFailed(errorOf(data, 'Stripe could not be read. Try again in a moment.'));
    });
    return () => { live = false; };
  }, [orgId, number, version]);
  // The amber "Tax missing" chip opens the window at its tax.
  useEffect(() => { if (atTax && answer) taxRef.current?.scrollIntoView({ block: 'start' }); }, [atTax, answer]);

  const row = answer ? windowRow(answer, listRow) : null;
  const stripeRead = answer?.stripe === 'read';
  const c = answer?.charge ?? null;
  const record = row?.record ?? null;
  const reasons = reasonsOf(record?.stripe_invoice_id ?? row?.key ?? number);
  const looked = lookedOf(record?.stripe_invoice_id ?? row?.key ?? number);
  // What the console knows before the click: the door is absent and one line says why (drawing G).
  const refusal = c && stripeRead ? doorRefusal(gate, c, answer?.inFlight) : null;
  const canRefund = !!c && stripeRead && !!read && !refusal;
  const what = row ? saleWhatWords(row) : null;
  const fw = flag ? flagWords(flag) : null;
  const title = row && what ? `${what.main.replace(/ · first charge$/, '')} · ${consoleWhen(row.at)}` : 'A sale';

  if (refunding && c && canRefund && read) {
    return (
      <RefundWindow
        orgId={orgId} orgName={orgName} charge={c} read={read} flaggedDuplicate={flag?.kind === 'duplicate'}
        onClose={() => { setRefunding(false); setVersion(v => v + 1); }}
        onDone={message => { setRefunding(false); setDone(message); setVersion(v => v + 1); onRefunded(); }}
      />
    );
  }

  // Part 3b: the small windows for marking a sale as looked at, and for putting it back (the shipped record-window recipe).
  if (looking && record && (looking === 'mark' || looked)) {
    const W = NEEDS_LOOK_WORDS.mark;
    const day = consoleDay(record.issued_at);
    const send = async (path: string, extra: Record<string, unknown>, success: string, why: string) => {
      const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money/looks${path}`, 'POST', { invoiceId: record.stripe_invoice_id, why, ...extra });
      if (!ok) return errorOf(data, W.refusals.failed);
      setLooking(null);
      setDone(success);
      onLooksChanged();
      return null;
    };
    return looking === 'mark' ? (
      <RecordWindow
        title={W.title(day)}
        sentence={<>{W.sentenceA}<b>{day}</b>{W.sentenceB}<b>{W.sentenceBold}</b>{W.sentenceC}</>}
        confirmLabel={W.confirm}
        whyPlaceholder={W.whyPlaceholder}
        footNote={W.foot}
        whyMax={REFUND_REASON_MAX}
        onClose={() => setLooking(null)}
        onConfirm={why => send('', {}, W.done, why)}
      />
    ) : (
      <RecordWindow
        title={W.putBackTitle(day)}
        sentence={W.putBackSentence}
        confirmLabel={W.putBack}
        whyPlaceholder={W.putBackPlaceholder}
        footNote={W.putBackFoot}
        whyMax={REFUND_REASON_MAX}
        onClose={() => setLooking(null)}
        onConfirm={why => send('/put-back', { lookId: looked!.id }, W.putBackDone, why)}
      />
    );
  }

  const refundsSoFar = c?.refunds.filter(r => r.status === 'succeeded' || r.status === 'pending') ?? [];
  // The clause goes only on the refunds the sale's issued notes do not explain (the band's own order), never on every dashboard line.
  const noNoteIds = reasons.some(r => r.code === 'refund_no_note')
    ? new Set(unexplainedRefunds(refundsSoFar, notesPaidBackCents(row?.notes ?? [])).filter(u => u.cents > 0).map(u => u.refund.id))
    : new Set<string>();
  const today = billing && billing !== 'failed' && billing.buyer !== 'none' ? billing.location : null;
  const amount = row ? saleAmount(row) : null;
  const says = row ? (stripeRead ? saleStripeSays(row) : saleRecordSays(row)) : null;
  // Plans & pricing Stage 2 Part 2: an unpaid bill after a failed try says its tries and the next one (read only).
  const bill = stripeRead && row?.invoice && readAt ? failedBillOf(row.invoice, row.charges, readAt) : null;
  const invoiceId = record?.stripe_invoice_id ?? answer?.invoice?.id ?? null;
  return (
    <KitDialog
      kind="form"
      size="medium"
      record
      title={title}
      onClose={onClose}
      footerStart={readAt ? <span>{stripeRead ? `Read from Stripe at ${consoleClock(readAt)}${record ? ' · tax from our record' : ''}` : `${SALES_WORDS.notReadFromStripe} · tax from our record`}</span> : undefined}
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
        {!answer && !failed && <p className={kit.caption}>Reading the sale…</p>}
        {row && what && amount && says && (
          <>
            {fw && <p className={`${money.flag}${fw.tone === 'bad' ? ` ${money.bad}` : ''}`}>{fw.text}</p>}
            {reasons.map(r => <p key={r.code} className={`${money.flag} ${money.warnText}`}>{NEEDS_LOOK_WORDS.lead}{r.text}</p>)}
            {looked && (
              <p className={money.flag}>
                {NEEDS_LOOK_WORDS.mark.looked(consoleWhen(looked.at), looked.by, looked.why)}
                {canMark && <>{' '}<button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => setLooking('putback')}>{NEEDS_LOOK_WORDS.mark.putBack}</button></>}
              </p>
            )}
            {record ? (
              <div className={kit.band}>
                {saleWindowBand(record, row.notes).map(b => (
                  <div key={b.label} className={kit.bandCell}>
                    <span className={kit.bandLabel}>{b.label}</span>
                    <span className={kit.bandValue}>{b.value}</span>
                    {b.note && <span className={kit.bandNote}>{b.note}</span>}
                  </div>
                ))}
              </div>
            ) : null}
            <dl className={money.lines}>
              {!record && <><dt className={kit.eye}>Amount</dt><dd>{saleCents(amount.cents, amount.currency)}</dd></>}
              <dt className={kit.eye}>Paid for</dt><dd>{what.main}{what.period ? `, ${what.period}` : ''}</dd>
              {record && cadRateWords(record) && <><dt className={kit.eye}>In Canadian dollars</dt><dd>{cadRateWords(record)}</dd></>}
            </dl>

            <h3 ref={taxRef} className={money.group}>Tax</h3>
            <dl className={money.lines}>
              {record ? (() => {
                const answerWords = gstAnswerWords(record, registration);
                return (
                  <>
                    <dt className={kit.eye}>Our GST/HST answer</dt>
                    <dd><span className={answerWords.tone === 'warn' ? money.warnLead : money.lead}>{answerWords.lead}</span> {answerWords.text}</dd>
                    <dt className={kit.eye}>Tax lines</dt>
                    <dd>{record.tax_lines.length === 0 ? 'None' : record.tax_lines.map((l, i) => <span key={i} className={money.refundLine}>{taxLineWords(l, record.currency)}</span>)}</dd>
                  </>
                );
              })() : (() => {
                const cell = saleTaxCell(row, registration, !answer?.recordFailed);
                return <><dt className={kit.eye}>Our GST/HST answer</dt><dd>{cell.main}{cell.sub ? `: ${cell.sub}` : ''}</dd></>;
              })()}
            </dl>

            {record && (
              <>
                <h3 className={money.group}>Where it was taxed</h3>
                <dl className={money.lines}>
                  <dt className={kit.eye}>Taxed for</dt><dd>{taxedForWords(record)}</dd>
                  <dt className={kit.eye}>{asItStoodLabel(record)}</dt>
                  <dd>
                    {evidenceLines(record).map((l, i) => <span key={i} className={money.refundLine}>{l}</span>)}
                    {addressChangedSince(record, today) && (
                      <span className={money.refundLine}>
                        {SALES_WORDS.addressChanged}{' '}
                        <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={onSeeAddress}>See billing address</button>
                      </span>
                    )}
                  </dd>
                  <dt className={kit.eye}>Kept</dt>
                  <dd className={keptWords(record).warn ? money.warnText : undefined}>{keptWords(record).text}</dd>
                </dl>
              </>
            )}

            <h3 className={money.group}>The payment</h3>
            {!stripeRead ? <p className={kit.caption}>{SALES_WORDS.notReadFromStripe}</p> : (
              <dl className={money.lines}>
                <dt className={kit.eye}>Card</dt><dd>{c?.card ? cardWords(c.card) : (c?.otherMethod ?? '—')}</dd>
                <dt className={kit.eye}>Stripe says</dt>
                <dd>{says.text}{says.sub ? ` · ${says.sub}` : ''}</dd>
                {bill && <><dt className={kit.eye}>Tries</dt><dd>{triesWords(bill)}</dd></>}
                {row.failed.length > 0 && (
                  <>
                    <dt className={kit.eye}>Failed tries</dt>
                    <dd>{row.failed.map(f => (
                      <span key={f.id} className={money.refundLine}>{consoleWhen(f.createdAt)} · {f.card ? cardWords(f.card) : (f.otherMethod ?? '—')} · {chargeFailureWords(f)}</span>
                    ))}</dd>
                  </>
                )}
                {c && (
                  <>
                    <dt className={kit.eye}>Refunded so far</dt>
                    <dd>
                      {refundsSoFar.length === 0 ? 'Nothing' : refundsSoFar.map(r => {
                        const ours = answer?.ourRefunds.find(o => o.stripeRefundId === r.id);
                        return (
                          <span key={r.id} className={money.refundLine}>
                            {formatCents(r.amountCents, c.currency)} · {consoleWhen(r.createdAt)} · {ours ? ours.actorEmail : 'in Stripe’s dashboard'}
                            {!ours && noNoteIds.has(r.id) ? ` · ${NEEDS_LOOK_WORDS.refundClause}` : ''}
                            {ours?.creditNoteNumber ? ` · credit note ${ours.creditNoteNumber}` : ''}
                            {r.status === 'pending' ? ' · on its way' : ''}
                          </span>
                        );
                      })}
                    </dd>
                  </>
                )}
                {invoiceId && (
                  <>
                    <dt className={kit.eye}>Credit notes</dt>
                    <dd>
                      {answer?.creditNotes == null ? 'Not read from Stripe' : answer.creditNotes.length === 0 ? 'None' : answer.creditNotes.map(n => (
                        <span key={n.id} className={money.refundLine}>
                          {n.number} · {formatCents(n.totalCents, n.currency)}{creditNoteTaxWords(n, row.notes)} · {consoleWhen(n.createdAt)}
                          {n.pdf && <>{' '}<a className={`${kit.door} ${kit.doorSm}`} href={n.pdf} target="_blank" rel="noreferrer">PDF</a></>}
                        </span>
                      ))}
                    </dd>
                    <dt className={kit.eye}>Stripe invoice</dt>
                    <dd className={styles.factLine}>
                      <code className={kit.code}>{invoiceId}</code>
                      <a className={`${kit.door} ${kit.doorSm}`} href={`${stripeBase}/invoices/${invoiceId}`} target="_blank" rel="noreferrer">Open in Stripe</a>
                    </dd>
                  </>
                )}
                {c && (
                  <>
                    <dt className={kit.eye}>Stripe charge</dt>
                    <dd className={styles.factLine}>
                      <code className={kit.code}>{c.id}</code>
                      <a className={`${kit.door} ${kit.doorSm}`} href={`${stripeBase}/payments/${c.id}`} target="_blank" rel="noreferrer">Open in Stripe</a>
                    </dd>
                  </>
                )}
              </dl>
            )}
            {!stripeRead && (
              <p className={styles.refuseLine}>
                <Flag size={15} aria-hidden className={styles.refuseIcon} />
                <span className={money.warnText}>{SALES_WORDS.refundsWait}</span>
              </p>
            )}
            {refusal && (
              <p className={`${styles.refuseLine}${refusal.bad ? ` ${styles.refuseLineBad}` : ''}`}>
                <Flag size={15} aria-hidden className={styles.refuseIcon} />
                <span>{refusal.text}</span>
              </p>
            )}
            {/* Part 3b: a rare door, so it ends the body. Support sees the sentence, never a dead button. */}
            {record && reasons.length > 0 && (canMark
              ? <p className={kit.caption}><button type="button" className={kit.door} onClick={() => setLooking('mark')}>{NEEDS_LOOK_WORDS.mark.door}</button></p>
              : <p className={kit.caption}>{NEEDS_LOOK_WORDS.mark.supportLine}</p>)}
          </>
        )}
      </div>
    </KitDialog>
  );
}

/** The preview route's answer (GST/HST Part 6b, R1): Stripe's credit note for the figure typed. */
type NotePreview = { note: 'credit_note'; cardCents: number; beforeTaxCents: number; taxLines: Array<{ label: string; cents: number }>; capped: boolean; feeInvoice: boolean };

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
  const asked = all ? left : typedCents;
  const over = !all && typedCents != null && typedCents > left;
  // A charge that paid an invoice is refunded through a credit note: the figure sent is Stripe's (the nearest it can make
  // with the tax, never above what was typed), asked as the amount settles. One that paid none is refunded as typed (R3).
  const viaNote = !!charge.invoice;
  const [preview, setPreview] = useState<{ forCents: number; round: number; answer: NotePreview | null; error: string | null } | null>(null);
  // A refusal that sent nothing (the note moved since this preview) asks Stripe again, so the next try is a fresh figure.
  const [round, setRound] = useState(0);
  const toPreview = viaNote && asked && !over && !sent ? asked : null;
  useEffect(() => {
    if (toPreview == null) return;
    let live = true;
    const t = setTimeout(() => {
      void sendJson(`/api/platform-admin/orgs/${orgId}/money/charges/${encodeURIComponent(charge.id)}/refund/preview`, 'POST', { amountCents: toPreview }).then(({ ok, data }) => {
        if (!live) return;
        setPreview({ forCents: toPreview, round, answer: ok && data.note === 'credit_note' ? data as unknown as NotePreview : null,
          error: !ok ? errorOf(data, REFUND_WORDS.noteReadFailed) : data.note === 'credit_note' ? null : REFUND_WORDS.noteInvoiceGone });
      });
    }, all ? 0 : 450);
    return () => { live = false; clearTimeout(t); };
  }, [toPreview, round, all, orgId, charge.id]);
  const seen = preview && preview.forCents === toPreview && preview.round === round ? preview : null;
  const note = seen?.answer ?? null;
  const amount = viaNote ? note?.cardCents ?? null : asked;
  const earlier = charge.refundedCents;
  const card = cardWords(charge.card);
  const when = consoleWhen(charge.createdAt);
  const next = read.nextCharge.kind === 'charge' ? read.nextCharge : null;
  const receipt = read.testMode
    ? 'Test payment: no money moves.'
    : read.customer.email ? `Stripe emails a receipt to ${read.customer.email}.` : 'Stripe has no email for this customer, so no receipt is sent.';
  // R2: Stripe emails the credit note, from the same sender as the receipt. R3: a charge that paid no invoice has none.
  const noteWords = !viaNote ? REFUND_WORDS.noInvoice
    : read.customer.email ? `A credit note goes to ${read.customer.email}.` : 'Stripe has no email for this customer, so the credit note is not emailed.';
  const split = note && note.taxLines.length > 0 ? `: ${creditSplitWords(note.beforeTaxCents, note.taxLines, charge.currency, note.feeInvoice)}` : '';
  const moved = note && asked && note.cardCents !== asked
    ? note.capped
      ? `Stripe can refund at most ${formatCents(note.cardCents, charge.currency)}: the rest of this invoice was credited before. `
      : `Stripe can refund ${formatCents(note.cardCents, charge.currency)}, the nearest it can make with the tax. `
    : '';

  const sentence = amount && !over ? (
    <>
      {read.testMode && <><span className={`${kit.chip} ${kit.chipInfo}`}>Test mode</span>{' '}</>}
      {amount === charge.amountCents
        ? <>Refund <b>{formatCents(amount, charge.currency)}</b> to the <b>{card}</b>{split}. </>
        : <>Refund <b>{formatCents(amount, charge.currency)}</b> of the <b>{formatCents(charge.amountCents, charge.currency)}</b> charge to the <b>{card}</b>{split}. </>}
      {moved}
      <b>This cannot be undone.</b>{' '}
      {earlier + amount < charge.amountCents && <>With {earlier ? `the ${formatCents(earlier, charge.currency)} already refunded` : 'this refund'}, {formatCents(charge.amountCents - earlier - amount, charge.currency)} stays paid. </>}
      {possessive(orgName)} plan does not change{next ? <>, the subscription keeps running, and the next charge is still {formatStoredDate(next.at)}</> : ''}.
      {' '}The card usually shows it in 5 to 10 business days. {receipt} {noteWords}
    </>
  ) : viaNote && asked && !over
    ? <>{seen?.error ?? 'Asking Stripe for the credit note…'}</>
    : <>Choose how much to refund.</>;

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
          amountCents: amount, beforeTaxCents: note?.beforeTaxCents, remainingSeenCents: left, reason, duplicate: flaggedDuplicate,
        });
        if (ok) { onDone(typeof data.message === 'string' ? data.message : 'Refunded.'); return null; }
        // Only the server's own "nothing was sent" is believed: a lost answer (a dropped connection, a gateway's page) may
        // have followed a refund Stripe made, so it reads as unknown, and the charge is checked when it is opened again.
        if (data.nothingSent === true) {
          setNothingSent(true);
          if (viaNote && data.field === 'amount') setRound(n => n + 1);
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
