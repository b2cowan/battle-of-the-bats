'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import RowEditButton from '@/components/coaches/RowEditButton';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { PAYMENT_REQUEST_COLUMNS, paymentRequestRows } from '@/lib/coach-money-exports';

interface PaymentRequest {
  id: string;
  requestType: 'payment_to_org' | 'charge_to_org';
  amount: number;
  description: string;
  paymentMethod: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'denied';
  denialReason: string | null;
  budgetLineId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const PAYMENT_METHODS = ['Cash', 'E-Transfer', 'Cheque', 'Card', 'Other'];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * ⚠ BOTH BADGES BELOW WERE HAND-ROLLED INLINE PILLS until 2026-08-15 — their own radius, their
 * own size, their own colour literals, and `capitalize` where every other badge in the portal is
 * uppercase. They were the last two in the Money hub that the 2026-08-13 table pass hadn't
 * reached. Now the shared `.badge` recipe with purpose-named variants.
 */
const STATUS_BADGE: Record<string, string> = {
  pending:  'badgePending',
  approved: 'badgeApproved',
  denied:   'badgeDenied',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_BADGE[status] ?? 'badgeDraft']}`}>
      {status}
    </span>
  );
}

/**
 * The two request types, side by side under the empty state (owner-approved mockup 2026-08-15).
 * Same shape as the Expense/Payable comparison on Expenses & Payables.
 *
 * ⚠ EACH CARD IS TINTED TO MATCH THE BADGE ITS ROWS WILL CARRY once the list fills — money
 * leaving the team is the danger hue, money arriving the success hue — so the colour a coach
 * learns here is the colour they meet later. The name and the arrow do the actual work; the two
 * hues are close enough for a deutan reader that colour alone would say nothing.
 *
 * ⚠ THE DIRECTIONS ARE STATED FROM THE TEAM'S SIDE ("your team sends", "you ask the club"), which
 * is the whole reason the old one-line version failed: "Pay Org" and "Request from Org" name the
 * button, not the outcome, and a coach reading them cold cannot tell which way the money goes.
 */
function RequestKinds() {
  return (
    <>
      <div className={styles.moneyKindCompare}>
        <div className={`${styles.moneyKindCard} ${styles.moneyKindCardPay}`}>
          <h4><ArrowUpRight size={13} aria-hidden /> Pay Org</h4>
          <p>Your team <strong>sends money to the club</strong>.</p>
          <p className={styles.moneyKindEgs}>
            Handing back an unused float · your share of an invoice the club paid up front
          </p>
        </div>
        <div className={`${styles.moneyKindCard} ${styles.moneyKindCardClaim}`}>
          <h4><ArrowDownLeft size={13} aria-hidden /> Request from Org</h4>
          <p>You ask the club to <strong>cover or pay back</strong> a cost.</p>
          <p className={styles.moneyKindEgs}>
            A permit you paid out of pocket · a tournament entry the club agreed to fund
          </p>
        </div>
      </div>
      <p className={styles.moneyKindTest}>
        <strong>What happens next:</strong> a request sits as Pending until the club reviews it — until
        then you can still change it or withdraw it, and a decline always comes back with a written reason.
      </p>
    </>
  );
}

/**
 * ⚠ THE BADGE SAYS "FROM ORG", THE SCREEN SAYS "REQUEST FROM ORG", AND THAT IS DELIBERATE. In the
 * shared uppercase badge the full phrase wrapped to two lines inside its own pill, making these
 * rows the tallest in the Money hub. The full wording still names the choice everywhere it is
 * being MADE — the empty-state card and the request form's type picker — exactly as the tab row
 * above shortens "Org Allocations" to "Allocations" while each page keeps its full title.
 */
function TypeBadge({ type }: { type: string }) {
  const isPay = type === 'payment_to_org';
  return (
    <span className={`${styles.badge} ${styles.badgeDirection} ${isPay ? styles.badgeToOrg : styles.badgeFromOrg}`}>
      {isPay
        ? <><ArrowUpRight size={11} aria-hidden /> Pay Org</>
        : <><ArrowDownLeft size={11} aria-hidden /> From Org</>}
    </span>
  );
}

export function PaymentRequestsPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [requests, setRequests]   = useState<PaymentRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  /* ⚠ THE ROW'S INLINE EXPANDER IS GONE (owner-approved mockup 2026-08-15). Notes, the denial
     reason, the method and the review date now live in the record window this row opens, which
     is the idiom Expenses & Payables already uses. Three things went with it: rows that changed
     height as you read them, a bare chevron stacked above a red "Cancel" in one narrow column,
     and a one-tap irreversible withdraw with nothing asked. */
  const [editing, setEditing]     = useState<PaymentRequest | null>(null);

  const [formType, setFormType]   = useState<'payment_to_org' | 'charge_to_org'>('payment_to_org');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc]   = useState('');
  const [formMethod, setFormMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  useOverlayOpen(showForm);

  /* Once the club has approved or declined a request, the window opens read-only — the record
     answers what the club acted on, and rewriting it would make that answer a lie. The server
     refuses the same edit; this only decides what a coach is offered.

     ⚠ A READ-ONLY MONEY ASSISTANT GETS THE SAME LOCKED WINDOW on a PENDING request. They can open
     any row (the list is theirs to read), but without this they would be handed live inputs and
     no Save button — the same broken affordance the write gate on the toolbar exists to prevent.
     Read off `assignments` directly because this sits above the not-assigned guard below. */
  const canWrite = assignment?.capabilities.money === 'write';
  const readOnly = !!editing && (editing.status !== 'pending' || !canWrite);
  const canEditRecord = !editing || editing.status === 'pending';

  /* ⚠⚠ WHILE A SAVE OR A WITHDRAW IS IN FLIGHT THE WINDOW CANNOT BE DISMISSED — not by the X, not
     by the overlay, not by Cancel (review 2026-08-16).

     Without this the request outlives the window that started it, and its success handler then
     closes whatever window is open BY THEN. Walk it: withdraw request A on a slow phone connection,
     tap Cancel while it is still in flight, open request B, start typing — A's delete comes back and
     slams B shut, discarding typed work with no prompt, straight past the discard guard this file
     goes out of its way to implement. The same shape applies to a slow save.

     Closing the exit is the fix rather than teaching the handlers to check what they are closing:
     leaving a record mid-write is not a thing a coach should be able to do in the first place. */
  const busy = saving || withdrawing;

  /* ⚠ DIRTINESS IS MEASURED AGAINST WHAT WAS LOADED, not against "is anything typed here" — the
     old test (any field non-empty) was right for a blank create form and completely wrong the
     moment the same form could open an existing record, where it would prompt "discard?" on the
     way out of a request the coach had only looked at. Amount is compared in its DISPLAY form so
     a stored 180.5 and the "180.50" in the box are not read as an edit. */
  const original = editing
    ? {
        type:   editing.requestType,
        amount: editing.amount.toFixed(2),
        desc:   editing.description,
        method: editing.paymentMethod ?? '',
        notes:  editing.notes ?? '',
      }
    : { type: 'payment_to_org', amount: '', desc: '', method: '', notes: '' };

  const formDirty = !readOnly && (
    formType !== original.type ||
    formAmount !== original.amount ||
    formDesc !== original.desc ||
    formMethod !== original.method ||
    formNotes !== original.notes
  );

  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => { setShowForm(false); setConfirmWithdraw(false); },
    noun: 'payment request',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load payment requests.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  function openForm() {
    setEditing(null);
    setFormType('payment_to_org');
    setFormAmount('');
    setFormDesc('');
    setFormMethod('');
    setFormNotes('');
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  /** Open an existing request — editable while it's pending, read-only once it's been reviewed. */
  function openRecord(r: PaymentRequest) {
    setEditing(r);
    setFormType(r.requestType);
    setFormAmount(r.amount.toFixed(2));
    setFormDesc(r.description);
    setFormMethod(r.paymentMethod ?? '');
    setFormNotes(r.notes ?? '');
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError('');
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid amount greater than 0.'); return; }
    if (!formDesc.trim()) { setFormError('Description is required.'); return; }

    setSaving(true);
    try {
      // One door, two verbs — the create form and the correction form are the same fields, so
      // they are the same submit with a different target.
      const res = await fetch(
        editing
          ? `/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${editing.id}`
          : `/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType:   formType,
            amount,
            description:   formDesc.trim(),
            paymentMethod: formMethod || null,
            notes:         formNotes.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save');
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save this request.');
    } finally {
      setSaving(false);
    }
  }

  /* ⚠ REACHED ONLY THROUGH THE CONFIRMATION IN THE WINDOW. This used to be a bare "Cancel" on
     every pending row that deleted the request on one tap, with nothing asked and no way back —
     the most destructive control on the screen was also its smallest and most ambiguously
     worded ("Cancel" means "dismiss" in every other form in the portal). */
  async function handleWithdraw() {
    if (!editing) return;
    setWithdrawing(true);
    setFormError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${editing.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to withdraw');
      setShowForm(false);
      setConfirmWithdraw(false);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to withdraw this request.');
    } finally {
      setWithdrawing(false);
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return <CoachNotOnTeam orgSlug={orgSlug} teamId={teamId} />;
  }

  /* Same flag as `canWrite` above, which had to be computed before the not-assigned guard so the
     window's locked state could read it. Named through here because every use below the guard
     already reads `canWriteMoney`, and two names for one fact is how they drift apart. */
  const canWriteMoney = canWrite;
  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const denied   = requests.filter(r => r.status === 'denied').length;

  return (
    <div className={styles.page}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting`}>Back to Money</CoachBackLink>
      )}
      {/* Page-level action ruling 2026-08-13: the create acts on THIS list of requests, so it
          drops into the tab's own toolbar below rather than sitting in a hub header that names
          "Money". This tab had no control row and gains a thin one. The write gate stands — a
          read-only assistant is never offered a form the server would refuse. */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={ArrowUpRight}
        title="Payment Requests"
        helpLabel="Payment Requests"
        /* Same redirect as Org Allocations — the "?" now opens the org-money answer rather than
           the hub tour. See the note on that panel. */
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-org', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {/* ⚠ THE ORG-ALLOCATIONS CROSS-LINK WAS REMOVED HERE (owner ruling 2026-08-15), and its
          twin on Org Allocations with it. See the note in that panel for the reasoning — the two
          were a matched pair and neither comes back alone. */}

      {/* ⚠ RENDERS AT EVERY STATE, INCLUDING THE EMPTY ONE (rule 7 — "nothing hides"). This
          screen's empty state names the two request types but offers no button of its own, so
          gating the toolbar on `requests.length` would leave a coach with no way to make their
          first request. */}
      <div className={styles.panelToolbar}>
        <div className={styles.panelToolbarActions}>
          <MoneyExportButton
            label="Payment requests"
            formats={['xlsx', 'csv']}
            build={() => ({
              dataset: 'payment-requests',
              title: 'Payment Requests',
              columns: PAYMENT_REQUEST_COLUMNS,
              rows: paymentRequestRows(requests),
              scopeLabel: assignment?.programYearName ?? '',
              teamName: assignment?.teamName ?? '',
              emptyMessage: 'There are no payment requests to export yet.',
            })}
            disabled={requests.length === 0}
          />
          {canWriteMoney && (
            <button type="button" className={styles.btnPrimary} onClick={openForm}>
              + New Request
            </button>
          )}
        </div>
      </div>

      {/* Summary row */}
      {requests.length > 0 && (
        <div className={styles.summaryGrid} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Pending</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--home-amber, #facc15)' }}>{pending}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Approved</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>{approved}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Denied</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--danger-light)' }}>{denied}</span>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : requests.length === 0 ? (
        <>
          <CoachEmptyState
            icon={<ArrowLeftRight size={22} aria-hidden />}
            headline="No payment requests yet"
            description="This is where you settle up with your club — money moving in either direction. Every request goes to the club office, and someone there approves or declines it."
            primaryAction={canWriteMoney ? {
              label: 'Make a request',
              icon: <Plus size={15} aria-hidden />,
              /* Names the outcome where the toolbar button names the record, the same split the
                 Expenses empty state uses: an empty state is teaching, and "+ New Request" alone
                 answers none of the question a blank screen just raised. */
              onClick: openForm,
            } : undefined}
          />
          <RequestKinds />
        </>
      ) : (
        /* ⚠ WAS A HAND-BUILT CARD LIST until 2026-08-13 (Money-hub table consistency). It carried
           no shared class and — unlike its two sibling card lists — printed NO column labels at
           all: the amount, the type and the date simply sat in a row of text, so a figure had
           nothing naming it. Now the shared list table, with one heading row and the amounts in
           one column. Every control, badge and expanded detail is the same as before. */
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Request</th>
                <th className={styles.th}>Type</th>
                <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Submitted</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                /* Pending → a pencil, because it can still be corrected. Reviewed → an eye,
                   because the club has acted on it. The icon is what tells a coach which they
                   are about to get, one row before they tap. */
                const pending = r.status === 'pending';
                return (
                  <tr
                    key={r.id}
                    className={`${styles.tr} ${styles.rowTappable}`}
                    onClick={() => { if (window.getSelection()?.toString()) return; openRecord(r); }}
                  >
                    <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Request">{r.description}</td>
                    <td className={styles.td} data-label="Type"><TypeBadge type={r.requestType} /></td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                    <td className={styles.td} data-label="Status"><StatusBadge status={r.status} /></td>
                    <td className={styles.td} data-label="Submitted" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className={`${styles.td} ${styles.cardActionCell}`}>
                      <RowEditButton
                        mode={pending && canWriteMoney ? 'edit' : 'view'}
                        label={`${pending && canWriteMoney ? 'Edit' : 'View'} ${r.description}`}
                        onClick={() => openRecord(r)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── The record window: one shape for making a request and for looking one up ─────────
          Opened blank by "New Request", or on a record by tapping its row. A pending request is
          fully editable here; a reviewed one is the same window read-only. */}
      {showForm && (
        <div className={styles.modalOverlay} onClick={busy ? undefined : closeForm}>
          {/* ⚠ `modalFlushFooter` IS REQUIRED ON ANY MODAL TALL ENOUGH TO SCROLL, and this one is —
              the type picker, four fields and a notes box clear 90vh on a laptop. Without it the
              footer's bottom bleed sits inside the panel's own bottom padding, which shows up as a
              band of dead space under the buttons (they read as sitting high in a too-thick
              footer) AND shortens the scroll extent, so the last field can never quite be scrolled
              into view. Both symptoms were visible here until 2026-08-15. */}
          <div className={`${styles.modal} ${styles.modalFlushFooter}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title={editing ? 'Payment request' : 'New Payment Request'}
              subtitle={editing
                ? `Submitted ${fmtDate(editing.createdAt)}${
                    editing.reviewedAt
                      ? ` · ${editing.status === 'approved' ? 'approved' : 'declined'} ${fmtDate(editing.reviewedAt)}`
                      : ' · not yet reviewed'}`
                : undefined}
              onClose={busy ? () => {} : closeForm}
            />

            <div className={styles.formGrid}>
              {/* The club's answer comes FIRST on a declined request — it is the only thing the
                  coach opened this window to read, and burying it under the fields they already
                  know would make them hunt for it. */}
              {readOnly && editing?.status === 'denied' && editing.denialReason && (
                <div className={styles.formGridFull} style={{
                  background:   'color-mix(in srgb, var(--danger-light) 8%, transparent)',
                  border:       '1px solid color-mix(in srgb, var(--danger-light) 20%, transparent)',
                  borderRadius: 8,
                  padding:      '0.7rem 0.85rem',
                }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger-light)' }}>Why this was declined</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>{editing.denialReason}</p>
                </div>
              )}

              {/* Type — a picker while it can still change, the badge it will read as once it can't. */}
              {readOnly ? (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <span className={styles.label}>Request Type</span>
                  <div><TypeBadge type={formType} /></div>
                </div>
              ) : (
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Request Type <span style={{ color: 'var(--danger-light)' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormType('payment_to_org')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: `2px solid ${formType === 'payment_to_org' ? 'var(--danger-light)' : 'var(--home-line, rgba(255,255,255,0.1))'}`,
                      background: formType === 'payment_to_org' ? 'color-mix(in srgb, var(--danger-light) 10%, transparent)' : 'var(--home-card, rgba(255,255,255,0.03))',
                      color: formType === 'payment_to_org' ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <ArrowUpRight size={14} /> Pay Org
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Team sends money to org</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('charge_to_org')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: `2px solid ${formType === 'charge_to_org' ? 'var(--success-light)' : 'var(--home-line, rgba(255,255,255,0.1))'}`,
                      background: formType === 'charge_to_org' ? 'color-mix(in srgb, var(--success-light) 10%, transparent)' : 'var(--home-card, rgba(255,255,255,0.03))',
                      color: formType === 'charge_to_org' ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.5))',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <ArrowDownLeft size={14} /> Request from Org
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Org covers team cost</div>
                  </button>
                </div>
              </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pr-amount">Amount ($) {!readOnly && <span style={{ color: 'var(--danger-light)' }}>*</span>}</label>
                {readOnly ? (
                  <p className={styles.recordValue} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(parseFloat(formAmount) || 0)}</p>
                ) : (
                  <input
                    id="pr-amount"
                    className={styles.input}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pr-method">Payment Method</label>
                {readOnly ? (
                  <p className={styles.recordValue}>{formMethod || '—'}</p>
                ) : (
                  <select
                    id="pr-method"
                    className={styles.select}
                    value={formMethod}
                    onChange={e => setFormMethod(e.target.value)}
                  >
                    <option value="">— optional —</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="pr-desc">Description {!readOnly && <span style={{ color: 'var(--danger-light)' }}>*</span>}</label>
                {readOnly ? (
                  <p className={styles.recordValue}>{formDesc}</p>
                ) : (
                  <input
                    id="pr-desc"
                    className={styles.input}
                    type="text"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="e.g. Diamond permit reimbursement — July 14"
                    maxLength={500}
                  />
                )}
              </div>

              {/* An empty Notes box is worth offering while a request can still be written; on a
                  reviewed one it would be a labelled dash saying nothing. */}
              {(!readOnly || formNotes) && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label} htmlFor="pr-notes">Notes</label>
                  {readOnly ? (
                    <p className={styles.recordValue}>{formNotes}</p>
                  ) : (
                    <textarea
                      id="pr-notes"
                      className={styles.textarea}
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="Optional — any additional context for the admin"
                      rows={2}
                    />
                  )}
                </div>
              )}

              {formError && <p className={`${styles.errorText} ${styles.formGridFull}`}>{formError}</p>}
            </div>

            {/* ⚠ THE CONFIRMATION NAMES THE REQUEST AND SAYS WHAT SURVIVES — never a bare "Are you
                sure?". Withdrawing removes the request outright; the club never sees it and there
                is nothing to restore, so that has to be said before a coach can agree to it. Same
                shape as the delete confirmation on Expenses & Payables. */}
            {confirmWithdraw && editing && (
              <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm withdraw">
                <p className={styles.dangerConfirmTitle}>Withdraw “{editing.description}”?</p>
                <p className={styles.dangerConfirmBody}>
                  This takes the request off the club&apos;s list for good — there&apos;s no record kept and
                  no way to bring it back. You can always submit a new one.
                </p>
                <div className={styles.dangerConfirmActions}>
                  <button type="button" className={styles.btnGhost} disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>Keep it</button>
                  <button type="button" className={styles.btnDanger} disabled={withdrawing} onClick={handleWithdraw}>
                    {withdrawing ? 'Withdrawing…' : 'Withdraw request'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              {/* Withdraw sits in the FORM's footer, never on the row — the rule Budget Plan set
                  and Expenses & Payables follows, and the reason a row needs only one control. */}
              {editing && canWriteMoney && !readOnly && !confirmWithdraw && (
                <button
                  type="button"
                  className={styles.deleteRecordBtn}
                  onClick={() => setConfirmWithdraw(true)}
                  disabled={busy}
                >
                  <Trash2 size={13} aria-hidden /> Withdraw request
                </button>
              )}
              {/* ⚠ THE LONE ACTION IS NEVER THE BORDERLESS ONE. On a locked record "Close" is not
                  the quiet alternative to a Save button — it is the only thing in the footer, and
                  a ghost control with no edge reads as unfinished text floating in the band rather
                  than the button it is. It takes a shape when it stands alone, and steps back to
                  the ghost the moment it is sitting beside Save. */}
              {/* ⚠ BOTH FOOTER CONTROLS STAND DOWN WHILE THE WITHDRAW CONFIRMATION IS UP (review
                  2026-08-16). That block is an alertdialog asking one yes/no question; leaving a live
                  "Save changes" directly beneath it put two conflicting actions on screen at once,
                  and a coach aiming for the confirmation could instead save the very edit they were
                  abandoning — persisting it and closing the window, having never answered the
                  question they were asked. */}
              <button
                type="button"
                className={readOnly ? styles.btnSecondary : styles.btnGhost}
                onClick={closeForm}
                disabled={busy || confirmWithdraw}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {canEditRecord && canWriteMoney && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  disabled={busy || confirmWithdraw || !formAmount || !formDesc.trim()}
                >
                  {saving
                    ? (editing ? 'Saving…' : 'Submitting…')
                    : (editing ? 'Save changes' : 'Submit Request')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showForm && formDirty}
        interceptClicks={showForm && formDirty && tabActive}
        message={editing
          ? "You've changed this payment request but haven't saved it. Leave without saving?"
          : "You haven't submitted this payment request. Leave without saving it?"}
      />
    </div>
  );
}
