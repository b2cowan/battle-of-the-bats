'use client';
/**
 * THE PAYOUTS CARD (Club Tier Stage 12a — drawn 12a §1–§4, words CLUB_TIER_STAGE12A_COPY.md §2–§5 and §7).
 *
 * The club's own Stripe account: five states (not set up, setting up, taking payments, needs attention, disconnected),
 * "Before you set up payouts" ahead of Stripe (the club learns the fee before Stripe's own onboarding, owner 2026-10-24),
 * the record (who pays the fee, A14; the refund-policy sentence, A9) that reads first and edits whole, and Disconnect as
 * the rare door at the end of the body.
 *
 * Two homes, one card (A8): the club's Settings page (League and Club) and its own page under tournament Settings & access
 * (Tournament Plus). The OWNER acts (A1); the treasurer reads the state and gets "needs attention" (`canSeePayouts`).
 * The card renders nothing while the launch switch is off or the plan lacks the feature — the API answers 404 then.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ExternalLink, Pencil, Unplug } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { LEAVING_WORDS, PAYMENTS_TERMS_SUMMARY, PAYMENTS_TERMS_VERSION, PAYOUTS_ADDRESS_WORDS, TERMS_PLACEHOLDER, TERMS_WORDS, money, payoutsWords, type PayoutsHome } from '@/lib/online-payment-words';
import { BILLING_ADDRESS_FORM_WORDS } from '@/lib/billing-location';
import { isAddressRefusal, useBillingAddressGate } from '@/components/billing/BillingAddressDialog';
import type { PayoutsState } from '@/lib/online-payment-account';
import type { OnlineFeePayer } from '@/lib/online-payment-fee';
import KitDialog from './KitDialog';
import PayoutsDisclosure from './money/PayoutsDisclosure';
import { Callout, RecordAction, RepChip, SavePill, type ChipTone } from './RepKit';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';
import pc from './PayoutsCard.module.css';

export type PayoutsView = {
  state: PayoutsState;
  isOwner: boolean;
  testMode: boolean;
  rateLabel: string;
  /** 12c Part 6: the bank debit's rate, when the account takes it (or before setup); null prints card only. */
  bankRateLabel?: string | null;
  example: { baseCents: number; feeCents: number; bankFeeCents?: number | null };
  feePayer: OnlineFeePayer;
  refundPolicy: string;
  requirementsDue: number;
  deadline: string | null;
  /** Stripe still has card payments on (teams see Pay now) — "needs attention" then means "still on", not "paused". */
  paymentsOn: boolean;
  connectedAt: string | null;
  disconnectedAt: string | null;
  disconnectedBy: string | null;
  teamsStillOwing: number | null;
  /** 12c Part 6: bank debits still clearing (the Disconnect window says they finish). */
  debitsClearing?: number | null;
  /** 12d-2 (words §4.1): house-league families still owing, open pay pages (closed by Disconnect), open card disputes and
   *  the soonest answer-by. Null when not counted (not the owner, disconnected, or the count failed). */
  familiesOwing?: number | null;
  openPages?: number | null;
  openDisputes?: number | null;
  firstDisputeDue?: string | null;
  /** 12d-1 Part 4: the club pays nothing for its plan (free time or the Founding comp), so the other-fees line adds
   *  "Your plan doesn't change" (words §3.4 `record.otherFeesPlan`). */
  planFree?: boolean;
  /** 12d-2 (words §3.3): the club has Accounting, where its payouts list lives; without it the owner's card carries it. */
  hasAccounting?: boolean;
  /** 12d-2: the club has connected payouts at some time (a payouts list exists). */
  everConnected?: boolean;
  /** 12d-2: the plan no longer offers online payments while the account stays connected (the wind-down card). */
  windDown?: boolean;
  /** 12d-2 (words §4.2): an ending the owner didn't choose is coming (a comp ending, a failed subscription payment). */
  ending?: { title: string; body: string } | null;
  /** 12d-2 Part 4 (words §5.1): who agreed to the payments terms, when, to which version — the owner's. */
  terms?: {
    standing: 'agreed' | 'draft' | 'stale' | 'none';
    agreedBy: string;
    agreedAt: string;
    agreedVersionDate: string | null;
    currentVersionDate: string | null;
  } | null;
  /** GST/HST Stage 2 Part 2b (owner ruling A): connected, but no billing address the Stripe-fee invoice can use — the owner's. */
  addressMissing?: boolean;
};

const PILL_TONE: Record<PayoutsState, ChipTone> = {
  not_set_up: 'neutral', setting_up: 'info', taking_payments: 'good', needs_attention: 'warn', disconnected: 'neutral',
};

/** The card's read. Null when online payments are not offered here (switch off, plan, or a role that can't see them). */
export function loadPayouts(orgSlug: string): Promise<PayoutsView | null> {
  return fetch(`/api/admin/payouts?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
}

async function post(orgSlug: string, body: Record<string, unknown>): Promise<{ url?: string | null; error?: string }> {
  // org-slug-ok: sent in the body
  const res = await fetch('/api/admin/payouts', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgSlug, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  // The code rides on the error, so a caller can tell "ask for the billing address" (Part 2b) from a sentence to show.
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong. Try again.'), { code: data.code });
  return data;
}

/** The page reads the card's view with everything else and hands it in (`loadPayouts`), so the card never appears a beat late. */
export default function PayoutsCard({ orgSlug, clubName, home, initial }: {
  orgSlug: string; clubName: string; home: PayoutsHome; initial: PayoutsView | null;
}) {
  // League and Club name families and teams; Tournament Plus names teams (copy 12a §20, 12b).
  const W = payoutsWords(home);
  const [view, setView] = useState<PayoutsView | null>(initial);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editing, setEditing] = useState(false);
  // 12d-2 Part 4 (words §5.3): the terms window — 'agree' asks again; 'read' only shows the terms agreed to.
  const [termsWindow, setTermsWindow] = useState<'agree' | 'read' | null>(null);

  const reload = useCallback(async () => { setView(await loadPayouts(orgSlug)); }, [orgSlug]);

  if (!view) return null;
  const { state, isOwner } = view;

  /** Onboarding returns here; the Express Dashboard opens alongside the organizer's unchanged page. */
  async function goToStripe(action: 'continue' | 'dashboard') {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    let stripeTab: Window | null = null;
    try {
      if (action === 'dashboard') {
        // Reserve the tab during the click, before any await (Safari/mobile popup blockers).
        // Keep its handle for failure cleanup; window.open's noopener feature would return null.
        stripeTab = window.open('about:blank', '_blank');
        if (!stripeTab) throw new Error('Allow pop-ups for this site, then try again.');
        stripeTab.opener = null;
      }
      const { url } = await post(orgSlug, { action });
      if (stripeTab) {
        if (!url) throw new Error('Something went wrong. Try again.');
        if (!stripeTab.closed) {
          // Navigate the reserved tab without a Referer or access back to the organizer's tab.
          const link = stripeTab.document.createElement('a');
          link.href = url;
          link.target = '_self';
          link.rel = 'noopener noreferrer';
          link.referrerPolicy = 'no-referrer';
          stripeTab.document.body.appendChild(link);
          link.click();
        }
      } else if (url) window.location.assign(url);
      else { openingRef.current = false; setOpening(false); await reload(); }
    } catch (e) {
      stripeTab?.close();
      setError(e instanceof Error ? e.message : String(e));
      openingRef.current = false;
      setOpening(false);
    } finally {
      if (action === 'dashboard') {
        openingRef.current = false;
        setOpening(false);
      }
    }
  }

  const primary = () => {
    if (state === 'not_set_up' || state === 'disconnected') setBefore(true);
    else if (state === 'taking_payments') void goToStripe('dashboard');
    else void goToStripe('continue');
  };

  const body =
    state === 'not_set_up' ? W.notSetUpBody(view.rateLabel, view.bankRateLabel ?? null)
      : state === 'setting_up' ? W.settingUpBody(formatStoredDate(view.connectedAt, { withYear: false }))
        : state === 'taking_payments' ? W.takingBody(clubName)
          : state === 'needs_attention'
            ? (view.paymentsOn ? W.needsBodyStillOn(view.deadline ? formatStoredDate(view.deadline, { withYear: false }) : null) : W.needsBody)
            : W.disconnectedBody(formatStoredDate(view.disconnectedAt, { withYear: false }), view.disconnectedBy);
  const hasRecord = state === 'setting_up' || state === 'taking_payments' || state === 'needs_attention';
  // 12d-2 (ask 4, the drawing's wind-down card): the plan no longer offers online payments, but the account stays connected —
  // refunds, disputes and payouts carry on, and nothing here sets up again (that needs the plan).
  // Only a club that was taking payments reads as the wind-down card; Stripe asking for something (needs attention,
  // setting up) keeps its own words and pill, with the wind-down line beside them (/review of Part 3).
  const wind = !!view.windDown && state === 'taking_payments';
  const windLine = !!view.windDown && (state === 'needs_attention' || state === 'setting_up');
  const WD = LEAVING_WORDS.windDown;
  const showPrimary = !view.windDown || hasRecord;
  // Payouts card redraw (drawings tabs 1-2): a taking-payments card says where payouts go and what receipts say as record rows
  // instead of a paragraph, and while the record is being edited the Stripe door and Disconnect step aside.
  const payoutRows = state === 'taking_payments' && !wind;
  const editingRecord = editing && isOwner && hasRecord;
  // The review's call: a card that is setting up or needs attention keeps its primary button while editing (it is the owner's
  // way forward); only the taking-payments card's "Open Stripe" steps aside. Disconnect steps aside in all three.
  const hidePrimary = editingRecord && state === 'taking_payments';

  return (
    <>
      <section className={styles.card} aria-labelledby="settings-payouts" id="payouts">
        <div className={pc.head}>
          <span className={pc.eyebrow}>{W.eyebrow}</span>
          <RepChip tone={wind ? 'neutral' : PILL_TONE[state]}>{wind ? WD.pill : W.pill[state]}</RepChip>
          {view.testMode && <RepChip tone="info">{W.testChip}</RepChip>}
          {hasRecord && isOwner && (
            <button
              type="button"
              className={pc.pencil}
              aria-label={editing ? W.record.done : W.record.edit}
              aria-pressed={editing}
              onClick={() => setEditing(e => !e)}
            >
              {editing ? <Check size={18} aria-hidden /> : <Pencil size={18} aria-hidden />}
            </button>
          )}
        </div>
        <h2 id="settings-payouts" className={styles.cardTitle}>{wind ? WD.title : state === 'needs_attention' && view.paymentsOn ? W.needsTitleStillOn : W.title[state]}</h2>
        {view.testMode && <p className={ck.hint}>{W.testLine}</p>}
        {/* 12d-2 Part 4 (words §5.2, ask 6): the terms changed — a notice, payments stay on. The owner's. */}
        {isOwner && view.terms?.standing === 'stale' && state !== 'disconnected' && (
          <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
            <div className={ck.noticeBody}>
              {TERMS_WORDS.noticeBody(longDay(view.terms.currentVersionDate))}{' '}
              <button type="button" className={pc.linkButton} onClick={() => setTermsWindow('agree')}>{TERMS_WORDS.readAndAgree}</button>
            </div>
          </div>
        )}
        {view.ending && (
          <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
            <div className={ck.noticeBody}><b>{view.ending.title}</b> {view.ending.body}</div>
          </div>
        )}
        {/* GST/HST Stage 2 Part 2b (owner ruling A): connected before payouts asked for the address. Its Stripe fees wait
            unbilled until it is saved; saving reads the card again, and the line goes. */}
        {isOwner && view.addressMissing && <AddressMissingLine orgSlug={orgSlug} />}
        {!payoutRows && <p className={pc.body}>{wind ? `${WD.body} ${LEAVING_WORDS.move.connected}` : body}</p>}
        {windLine && <p className={ck.hint}>{WD.title}. {WD.body}</p>}
        {/* The record's fee row carries the rates, so the line shows only where there is no record yet. */}
        {state !== 'disconnected' && !view.windDown && !hasRecord && <p className={ck.hint}>{W.ratesLine(view.rateLabel, view.bankRateLabel ?? null)}</p>}

        {hasRecord && (
          <PayoutsRecord orgSlug={orgSlug} home={home} view={view} editing={editing && isOwner} onSaved={next => setView(v => (v ? { ...v, ...next } : v))}
            onTerms={setTermsWindow} clubName={clubName} payoutRows={payoutRows} />
        )}

        {isOwner ? (showPrimary && !hidePrimary && (
          <div className={pc.actions}>
            <button type="button" className="btn btn-lime" onClick={primary} disabled={opening}>
              {opening ? W.opening : W.button[state]}
              {state === 'taking_payments' && <>
                <ExternalLink size={14} aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </>}
            </button>
          </div>
        )) : (
          state !== 'taking_payments' && <p className={ck.hint}>{W.ownerOnly(home)}</p>
        )}
        {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}

        {/* 12d-2 (words §3.3): the payouts list, collapsed, for a club without Accounting — before Disconnect, which still
            ends the card's body. */}
        {isOwner && view.everConnected && view.hasAccounting === false && <PayoutsDisclosure orgSlug={orgSlug} />}

        {isOwner && !editingRecord && (state === 'taking_payments' || state === 'needs_attention' || state === 'setting_up') && (
          <div className={pc.recordEnd}>
            <RecordAction icon={<Unplug size={13} aria-hidden />} onClick={() => setDisconnecting(true)}>{W.rareDisconnect}</RecordAction>
          </div>
        )}
      </section>

      {before && (
        <BeforeWindow
          orgSlug={orgSlug}
          home={home}
          clubName={clubName}
          view={view}
          onClose={() => setBefore(false)}
        />
      )}
      {termsWindow && (
        <TermsWindow
          orgSlug={orgSlug}
          clubName={clubName}
          mode={termsWindow}
          onClose={() => setTermsWindow(null)}
          onAgreed={async () => { setTermsWindow(null); await reload(); }}
        />
      )}
      {disconnecting && (
        <DisconnectWindow
          orgSlug={orgSlug}
          home={home}
          view={view}
          onClose={() => setDisconnecting(false)}
          onDone={async () => { setDisconnecting(false); setEditing(false); await reload(); }}
        />
      )}
    </>
  );
}

/** GST/HST Stage 2 Part 2b (owner ruling A): the line and its Billing address window. Mounted only while the address is
 *  missing, so the card reads no address otherwise. Saving reads the card again, and the line goes. */
function AddressMissingLine({ orgSlug }: { orgSlug: string }) {
  const address = useBillingAddressGate({ orgSlug });
  // Saving gives the gate the address, and the line goes at once. No card reload: Cancel then changes nothing, and a failed
  // reload can never blank the card (/review 2026-11-05). The card's own next read agrees (addressMissing false).
  if (address.location) return null;
  return (
    <>
      {/* The action opens a window, so it is the outlined button at the callout's right end, not an olive link. */}
      <Callout tone="warn" role="status"
        action={<button type="button" className="btn btn-outline" onClick={() => address.edit()}>{BILLING_ADDRESS_FORM_WORDS.title}</button>}>
        {PAYOUTS_ADDRESS_WORDS.missing}
      </Callout>
      {address.dialog}
    </>
  );
}

/** The record (copy §4): reads first; the card's pencil flips it whole. The fee choice and the policy autosave and tell nobody. */
function PayoutsRecord({ orgSlug, home, view, editing, onSaved, onTerms, clubName, payoutRows }: {
  orgSlug: string; home: PayoutsHome; view: PayoutsView; editing: boolean; onSaved: (next: Partial<PayoutsView>) => void;
  onTerms: (mode: 'agree' | 'read') => void;
  /** The club's name for "Receipts say", and whether this state says where payouts go as rows (taking payments). */
  clubName: string; payoutRows: boolean;
}) {
  const stale = view.terms?.standing === 'stale';
  const W = payoutsWords(home);
  const [policy, setPolicy] = useState(view.refundPolicy);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Record<string, unknown> | null>(null);

  async function save(change: { feePayer?: OnlineFeePayer; refundPolicy?: string }) {
    setLastSent(change);
    setSaving(true);
    setError(null);
    try {
      // org-slug-ok: sent in the body
      const res = await fetch('/api/admin/payouts', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgSlug, ...change }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Couldn’t save');
      onSaved({ ...(change.feePayer ? { feePayer: change.feePayer } : {}), ...(change.refundPolicy !== undefined ? { refundPolicy: change.refundPolicy.trim() } : {}) });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save');
    } finally {
      setSaving(false);
    }
  }

  // Payouts card redraw (drawings tabs 1-2): read and edit are the SAME rows in the same order, so the card keeps its shape
  // when the pencil flips it. Rows nobody can edit stay, quieter; the other-Stripe-fees line is a footnote under the rows in both.
  const policyId = useId();
  const policyHintId = useId();
  const rates = W.record.feeRates(view.rateLabel, view.bankRateLabel ?? null);
  const whereRows = payoutRows && (
    <>
      <div className={pc.recordRow}>
        <dt>{W.record.payoutsToLabel}</dt>
        <dd>{W.record.payoutsToValue}</dd>
      </div>
      <div className={pc.recordRow}>
        <dt>{W.record.receiptsLabel}</dt>
        <dd>{W.record.receiptsValue(clubName)}</dd>
      </div>
    </>
  );
  // 12d-1 words §3.4: the footnote under the record.
  const otherFees = <p className={`${ck.hint} ${pc.otherFees}`}>{W.record.otherFees}{view.planFree ? ` ${W.record.otherFeesPlan}` : ''}</p>;

  if (!editing) {
    return (
      <>
        <dl className={pc.record}>
          {whereRows}
          <div className={pc.recordRow}>
            <dt>{W.record.feeLabel}</dt>
            <dd>
              {W.record.feeRead[view.feePayer]}
              <span className={`${ck.hint} ${pc.otherFees}`}>{rates}</span>
            </dd>
          </div>
          <div className={pc.recordRow}>
            <dt>{W.record.policyLabel}</dt>
            <dd>{view.refundPolicy ? view.refundPolicy : <span className={ck.hint}>{W.record.policyEmpty}</span>}</dd>
          </div>
          {view.terms && <TermsRow terms={view.terms} onTerms={onTerms} />}
        </dl>
        {otherFees}
      </>
    );
  }

  return (
    <>
      <dl className={pc.record}>
        {whereRows}
        <div className={pc.recordRow}>
          <dt>{W.record.feeLabel}</dt>
          <dd>
            <fieldset className={pc.choice}>
              <legend className="sr-only">{W.record.feeEditLabel}</legend>
              {/* 12d-2 (words §5.2 `terms.refuse.fee`): the choice waits for the current terms — the line replaces it. */}
              {stale && (
                <p className={ck.hint}>
                  {TERMS_WORDS.refuseFee}{' '}
                  <button type="button" className={pc.linkButton} onClick={() => onTerms('agree')}>{TERMS_WORDS.readAndAgree}</button>
                </p>
              )}
              {!stale && (['family', 'club'] as const).map(p => (
                <label key={p} className={pc.choiceRow}>
                  <input type="radio" name="payouts-fee-payer" checked={view.feePayer === p} disabled={saving} onChange={() => void save({ feePayer: p })} />
                  <span>
                    <span className={pc.choiceName}>{W.record.choice[p]}</span>
                    <span className={ck.hint}>{W.record.choiceHint[p]}</span>
                  </span>
                </label>
              ))}
              <p className={ck.hint}>{rates}</p>
              <p className={ck.hint}>{W.record.feeChangeNote}</p>
            </fieldset>
          </dd>
        </div>
        <div className={pc.recordRow}>
          <dt id={policyId}>{W.record.policyLabel}</dt>
          <dd>
            <textarea
              className={ck.textarea}
              aria-labelledby={policyId}
              aria-describedby={policyHintId}
              rows={2}
              maxLength={300}
              value={policy}
              placeholder={W.record.policyPlaceholder}
              onChange={e => { setPolicy(e.target.value); setDirty(true); }}
              onBlur={() => { if (dirty) void save({ refundPolicy: policy }); }}
            />
            <p id={policyHintId} className={`${ck.hint} ${pc.fieldHint}`}>{W.record.policyHint}</p>
          </dd>
        </div>
        {view.terms && <TermsRow terms={view.terms} onTerms={onTerms} />}
      </dl>
      {otherFees}
      <SavePill saving={saving} dirty={dirty} error={error} onRetry={() => { if (lastSent) void save(lastSent as never); }} />
    </>
  );
}

/** "Before you set up payouts" (copy §3): the fee, who pays it, where the money goes, refunds, the terms — then Stripe. */
function BeforeWindow({ orgSlug, home, clubName, view, onClose }: { orgSlug: string; home: PayoutsHome; clubName: string; view: PayoutsView; onClose: () => void }) {
  const W = payoutsWords(home);
  const [feePayer, setFeePayer] = useState<OnlineFeePayer>(view.feePayer);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // GST/HST Stage 2 Part 2b (Ask 8): the club's billing address before Stripe. The window REPLACES this one while open (as
  // the plan move does) — this component stays mounted, so the fee choice and the terms tick survive it — and saving goes
  // straight on into the connect.
  const address = useBillingAddressGate({ orgSlug });
  // /review 2026-11-05: the press waits on the address read, so `busy` comes a beat late. One connect at a time, and none
  // once this window has closed (Cancel pressed while the read was out).
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function go() {
    if (inFlight.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { url } = await post(orgSlug, { action: 'connect', feePayer, agreeToTerms: true });
      if (url) window.location.assign(url);
      else window.location.reload();
    } catch (e) {
      inFlight.current = false;
      setBusy(false);
      // The server's own check (an address that stopped being valid, or another tab): the window, not an error.
      if (isAddressRefusal(e)) { address.refused(() => void go()); return; }
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // The window takes this one's place only once it can draw. A failed address read leaves the gate asking with nothing to
  // show (/review 2026-11-05): this window stays, says so, and the next press reads again.
  if (address.open && address.dialog) return address.dialog;
  const readFailed = address.open && !address.dialog;

  return (
    <KitDialog
      kind="form"
      title={W.before.title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.before.cancel}</button>
          {/* 12d-2 (ask 6): absent until the box is ticked, never disabled. */}
          {agreed && (
            <button type="button" className="btn btn-lime" onClick={() => address.ensure(() => void go())} disabled={busy}>
              {busy ? W.opening : W.before.continue}
            </button>
          )}
        </>
      }
    >
      <div className={pc.before}>
        <section>
          <h3 className={ck.label}>{W.before.costLabel}</h3>
          <p>{W.before.costRate(view.rateLabel, view.bankRateLabel ?? null)}</p>
          <p className={ck.hint}>{W.before.otherFees}{view.planFree ? ` ${W.record.otherFeesPlan}` : ''}</p>
          <p className={ck.hint}>{W.before.costExample(money(view.example.baseCents / 100), money(view.example.feeCents / 100),
            view.example.bankFeeCents != null ? money(view.example.bankFeeCents / 100) : null)}</p>
        </section>
        <fieldset className={pc.choice}>
          <legend className={ck.label}>{W.before.whoLabel}</legend>
          <label className={pc.choiceRow}>
            <input type="radio" name="before-fee-payer" checked={feePayer === 'family'} onChange={() => setFeePayer('family')} />
            <span><span className={pc.choiceName}>{W.before.whoTeams}</span><span className={ck.hint}>{W.before.whoTeamsHint}</span></span>
          </label>
          <label className={pc.choiceRow}>
            <input type="radio" name="before-fee-payer" checked={feePayer === 'club'} onChange={() => setFeePayer('club')} />
            <span><span className={pc.choiceName}>{W.before.whoClub}</span><span className={ck.hint}>{W.before.whoClubHint}</span></span>
          </label>
          <p className={ck.hint}>{W.before.whoChangeLater}</p>
        </fieldset>
        <section>
          <h3 className={ck.label}>{W.before.moneyLabel}</h3>
          <p>{W.before.moneyBody}</p>
        </section>
        <section>
          <h3 className={ck.label}>{W.before.refundsLabel}</h3>
          <p>{W.before.refundsBody}</p>
        </section>
        <label className={pc.terms}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>{W.before.termsCheckbox(clubName)}</span>
        </label>
        <button type="button" className={pc.linkButton} onClick={() => setShowTerms(s => !s)} aria-expanded={showTerms}>{W.before.termsLink}</button>
        {showTerms && <p className={pc.termsText}>{TERMS_PLACEHOLDER}</p>}
        {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}
        {!error && readFailed && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{PAYOUTS_ADDRESS_WORDS.readFailed}</p>}
      </div>
    </KitDialog>
  );
}

/** "Payments terms" (words §5.1): agreed, to the draft, or behind — with the one door each reads. */
function TermsRow({ terms, onTerms }: { terms: NonNullable<PayoutsView['terms']>; onTerms: (mode: 'agree' | 'read') => void }) {
  const day = longDay(terms.agreedAt);
  const version = terms.agreedVersionDate ? longDay(terms.agreedVersionDate) : null;
  const words = terms.standing === 'stale' ? TERMS_WORDS.rowStale(terms.agreedBy, day, version)
    : terms.standing === 'agreed' && version ? TERMS_WORDS.rowAgreed(terms.agreedBy, day, version)
      : TERMS_WORDS.rowDraft(terms.agreedBy, day);
  return (
    <div className={pc.recordRow}>
      <dt>{TERMS_WORDS.rowLabel}</dt>
      <dd>
        {words}
        {terms.standing === 'stale'
          ? <> · <button type="button" className={pc.linkButton} onClick={() => onTerms('agree')}>{TERMS_WORDS.readAndAgree}</button></>
          : terms.standing === 'agreed'
            ? <> · <button type="button" className={pc.linkButton} onClick={() => onTerms('read')}>{TERMS_WORDS.readTerms}</button></>
            : null}
      </dd>
    </div>
  );
}

/** "The new payments terms" (words §5.3): the terms' own summary (left out while empty), the terms, the box — and Agree,
 *  ABSENT until the box is ticked (ask 6). 'read' shows the terms with no box. The wording is the real terms', never ours. */
function TermsWindow({ orgSlug, clubName, mode, onClose, onAgreed }: {
  orgSlug: string; clubName: string; mode: 'agree' | 'read'; onClose: () => void; onAgreed: () => void;
}) {
  const W = payoutsWords('club');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function agree() {
    setBusy(true);
    setError(null);
    try {
      await post(orgSlug, { action: 'agree_terms', agreeToTerms: true, termsVersion: PAYMENTS_TERMS_VERSION });
      setDone(true);
      onAgreed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="form"
      title={mode === 'agree' ? TERMS_WORDS.windowTitle : TERMS_WORDS.termsHeading}
      onClose={onClose}
      busy={busy}
      footer={mode === 'agree' ? (
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{TERMS_WORDS.later}</button>
          {agreed && (
            <button type="button" className="btn btn-lime" onClick={() => void agree()} disabled={busy}>
              {busy ? TERMS_WORDS.working : TERMS_WORDS.agree}
            </button>
          )}
        </>
      ) : undefined}
    >
      <div className={pc.before}>
        {mode === 'agree' && PAYMENTS_TERMS_SUMMARY && (
          <section>
            <h3 className={ck.label}>{TERMS_WORDS.changedHeading}</h3>
            <p>{PAYMENTS_TERMS_SUMMARY}</p>
          </section>
        )}
        <section>
          {mode === 'agree' && <h3 className={ck.label}>{TERMS_WORDS.termsHeading}</h3>}
          <p className={pc.termsText}>{TERMS_PLACEHOLDER}</p>
        </section>
        {mode === 'agree' && (
          <label className={pc.terms}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} />
            <span>{W.before.termsCheckbox(clubName)}</span>
          </label>
        )}
        {done && <p className={ck.hint} role="status">{TERMS_WORDS.done}</p>}
        {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}

/** "October 27, 2026" — a stored day or moment, long (the words' {dateLong}). */
function longDay(value: string | null | undefined): string {
  return formatStoredDate(value ?? null, { longMonth: true });
}

/** Disconnect (copy §5): asks, with how many teams still owe. Stops new payments; nothing already paid changes. */
function DisconnectWindow({ orgSlug, home, view, onClose, onDone }: {
  orgSlug: string; home: PayoutsHome; view: PayoutsView; onClose: () => void; onDone: () => void;
}) {
  const L = LEAVING_WORDS.disconnect;
  const counted = view.teamsStillOwing != null;
  const clearing = view.debitsClearing ?? 0;
  const pages = view.openPages ?? 0;
  const disputes = view.openDisputes ?? 0;
  const W = payoutsWords(home);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    try {
      await post(orgSlug, { action: 'disconnect' });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      title={W.disconnect.title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.disconnect.cancel}</button>
          <button type="button" className="btn btn-danger" onClick={() => void go()} disabled={busy}>{W.disconnect.confirm}</button>
        </>
      }
    >
      <p>{W.disconnect.stops}</p>
      {/* 12d-2 words §4.1: the club home counts families too (it said "No team owes" beside families still owing);
          Tournament Plus keeps its teams-only words. A count that failed is left out, never read as nobody. */}
      {counted && <p>{home === 'club' ? L.owing(view.familiesOwing ?? 0, view.teamsStillOwing ?? 0) : W.disconnect.owing(view.teamsStillOwing ?? 0)}</p>}
      {pages > 0 && <p>{L.pages(pages)}</p>}
      {clearing > 0 && <p>{W.disconnect.clearing(clearing)}</p>}
      {disputes > 0 && <p>{L.disputes(disputes, view.firstDisputeDue ? formatStoredDate(view.firstDisputeDue, { withYear: false }) : null)}</p>}
      <p>{L.past}</p>
      {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}
    </KitDialog>
  );
}
