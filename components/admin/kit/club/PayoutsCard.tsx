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
import { useCallback, useState } from 'react';
import { Check, Pencil, Unplug } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { TERMS_PLACEHOLDER, money, payoutsWords, type PayoutsHome } from '@/lib/online-payment-words';
import type { PayoutsState } from '@/lib/online-payment-account';
import type { OnlineFeePayer } from '@/lib/online-payment-fee';
import KitDialog from './KitDialog';
import PayoutsDisclosure from './money/PayoutsDisclosure';
import { RecordAction, RepChip, SavePill, type ChipTone } from './RepKit';
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
  /** 12d-1 Part 4: the club pays nothing for its plan (free time or the Founding comp), so the other-fees line adds
   *  "Your plan doesn't change" (words §3.4 `record.otherFeesPlan`). */
  planFree?: boolean;
  /** 12d-2 (words §3.3): the club has Accounting, where its payouts list lives; without it the owner's card carries it. */
  hasAccounting?: boolean;
  /** 12d-2: the club has connected payouts at some time (a payouts list exists). */
  everConnected?: boolean;
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
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
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
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => { setView(await loadPayouts(orgSlug)); }, [orgSlug]);

  if (!view) return null;
  const { state, isOwner } = view;

  /** Hand over to Stripe (onboarding or the Express Dashboard). The button says what is happening and stays pressed. */
  async function goToStripe(action: 'continue' | 'dashboard') {
    setOpening(true);
    setError(null);
    try {
      const { url } = await post(orgSlug, { action });
      if (url) window.location.assign(url);
      else { setOpening(false); await reload(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpening(false);
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

  return (
    <>
      <section className={styles.card} aria-labelledby="settings-payouts" id="payouts">
        <div className={pc.head}>
          <span className={pc.eyebrow}>{W.eyebrow}</span>
          <RepChip tone={PILL_TONE[state]}>{W.pill[state]}</RepChip>
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
        <h2 id="settings-payouts" className={styles.cardTitle}>{state === 'needs_attention' && view.paymentsOn ? W.needsTitleStillOn : W.title[state]}</h2>
        {view.testMode && <p className={ck.hint}>{W.testLine}</p>}
        <p className={pc.body}>{body}</p>
        {state !== 'disconnected' && <p className={ck.hint}>{W.ratesLine(view.rateLabel, view.bankRateLabel ?? null)}</p>}

        {hasRecord && (
          <PayoutsRecord orgSlug={orgSlug} home={home} view={view} editing={editing && isOwner} onSaved={next => setView(v => (v ? { ...v, ...next } : v))} />
        )}

        {isOwner ? (
          <div className={pc.actions}>
            <button type="button" className="btn btn-lime" onClick={primary} disabled={opening}>
              {opening ? W.opening : W.button[state]}
            </button>
          </div>
        ) : (
          state !== 'taking_payments' && <p className={ck.hint}>{W.ownerOnly(home)}</p>
        )}
        {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}

        {/* 12d-2 (words §3.3): the payouts list, collapsed, for a club without Accounting — before Disconnect, which still
            ends the card's body. */}
        {isOwner && view.everConnected && view.hasAccounting === false && <PayoutsDisclosure orgSlug={orgSlug} />}

        {isOwner && (state === 'taking_payments' || state === 'needs_attention' || state === 'setting_up') && (
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
      {disconnecting && (
        <DisconnectWindow
          orgSlug={orgSlug}
          home={home}
          owing={view.teamsStillOwing ?? 0}
          clearing={view.debitsClearing ?? 0}
          onClose={() => setDisconnecting(false)}
          onDone={async () => { setDisconnecting(false); setEditing(false); await reload(); }}
        />
      )}
    </>
  );
}

/** The record (copy §4): reads first; the card's pencil flips it whole. The fee choice and the policy autosave and tell nobody. */
function PayoutsRecord({ orgSlug, home, view, editing, onSaved }: {
  orgSlug: string; home: PayoutsHome; view: PayoutsView; editing: boolean; onSaved: (next: Partial<PayoutsView>) => void;
}) {
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

  if (!editing) {
    return (
      <dl className={pc.record}>
        <div className={pc.recordRow}>
          <dt>{W.record.feeLabel}</dt>
          <dd>
            {W.record.feeRead[view.feePayer]}<span className={ck.hint}> · {W.record.feeRates(view.rateLabel, view.bankRateLabel ?? null)}</span>
            {/* 12d-1 words §3.4: under the rates line. */}
            <span className={`${ck.hint} ${pc.otherFees}`}>{W.record.otherFees}{view.planFree ? ` ${W.record.otherFeesPlan}` : ''}</span>
          </dd>
        </div>
        <div className={pc.recordRow}>
          <dt>{W.record.policyLabel}</dt>
          <dd>{view.refundPolicy ? view.refundPolicy : <span className={ck.hint}>{W.record.policyEmpty}</span>}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className={pc.record}>
      <fieldset className={pc.choice}>
        <legend className={ck.label}>{W.record.feeEditLabel}</legend>
        {(['family', 'club'] as const).map(p => (
          <label key={p} className={pc.choiceRow}>
            <input type="radio" name="payouts-fee-payer" checked={view.feePayer === p} disabled={saving} onChange={() => void save({ feePayer: p })} />
            <span>
              <span className={pc.choiceName}>{W.record.choice[p]}</span>
              <span className={ck.hint}>{W.record.choiceHint[p]}</span>
            </span>
          </label>
        ))}
        <p className={ck.hint}>{W.record.feeChangeNote}</p>
      </fieldset>
      <label className={ck.field}>
        <span className={ck.label}>{W.record.policyLabel}</span>
        <textarea
          className={ck.textarea}
          rows={2}
          maxLength={300}
          value={policy}
          placeholder={W.record.policyPlaceholder}
          onChange={e => { setPolicy(e.target.value); setDirty(true); }}
          onBlur={() => { if (dirty) void save({ refundPolicy: policy }); }}
        />
        <span className={ck.hint}>{W.record.policyHint}</span>
      </label>
      <SavePill saving={saving} dirty={dirty} error={error} onRetry={() => { if (lastSent) void save(lastSent as never); }} />
    </div>
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

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await post(orgSlug, { action: 'connect', feePayer, agreeToTerms: true });
      if (url) window.location.assign(url);
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={W.before.title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.before.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={!agreed || busy}>
            {busy ? W.opening : W.before.continue}
          </button>
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
      </div>
    </KitDialog>
  );
}

/** Disconnect (copy §5): asks, with how many teams still owe. Stops new payments; nothing already paid changes. */
function DisconnectWindow({ orgSlug, home, owing, clearing = 0, onClose, onDone }: {
  orgSlug: string; home: PayoutsHome; owing: number; clearing?: number; onClose: () => void; onDone: () => void;
}) {
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
      <p>{W.disconnect.owing(owing)}</p>
      {clearing > 0 && <p>{W.disconnect.clearing(clearing)}</p>}
      <p>{W.disconnect.past}</p>
      {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}
    </KitDialog>
  );
}
