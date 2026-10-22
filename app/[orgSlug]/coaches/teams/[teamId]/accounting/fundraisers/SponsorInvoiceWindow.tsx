'use client';
/**
 * THE SPONSOR INVOICE WINDOW (Coach Sponsor Invoice, owner rulings 2026-10-20 — plan
 * docs/projects/active/COACH_SPONSOR_INVOICE_PLAN.md, drawings https://claude.ai/artifact/5XGAZvyBChL2fZxdzqi6Sc).
 *
 * Opened by the sponsor room's Invoice button. Three groups — Bill to (kept on this sponsor), This invoice, and How
 * sponsors pay the team (kept for the team, A3: this window is its only home) — and one act, Download invoice.
 *
 * ⚖ A CREATE ASKS (edit-autosaves / create-asks): nothing is kept until Download; closing with words typed asks in the
 *   foot. Download keeps the details, gives the invoice its number on the first press, and saves the PDF.
 * ⚖ THE AMOUNT AND THE PAYMENTS COME FROM THE ROUTE, never from the room behind the window — the route reads both in
 *   one go, so a paid sponsor can never print as unpaid from a stale or closed room (/review).
 * ⚖ SAVED IS NOT THE SAME AS PRINTED: if the invoice is kept but the PDF fails, the window says so and stays open on
 *   the kept invoice, so pressing Download again reprints the same number (/review).
 * ⚖ THE TEAM'S DETAILS FOLD once kept (design review, A7): one line + Change. A folded section sends nothing, so a
 *   download never rewrites the team's details by accident.
 * ⚖ Always from the team (R1) — Payable to is the team's name and is not a field. No tax (R2).
 */
import { useEffect, useMemo, useState } from 'react';
import styles from '../../../../coaches.module.css';
import QuestionShell, { QuestionCancel, QuestionReason } from '@/components/coaches/QuestionShell';
import LoadingState from '@/components/shared/LoadingState';
import { buildFilename, downloadSponsorInvoice, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS } from '@/lib/export';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
import { fmt } from '@/lib/coach-money-summary';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from '@/lib/types';
import {
  invoiceStanding, oneLineAddress, paymentDetailsEmpty,
  type InvoiceArrival, type SponsorInvoice, type SponsorPaymentDetails,
} from '@/lib/coach-sponsor-invoice';
import type { Fundraiser } from './types';

interface InvoiceRead {
  invoice: SponsorInvoice | null;
  teamPayment: SponsorPaymentDetails;
  teamName: string;
  nextNumber: string;
  amount: number;
  hasPledge: boolean;
  arrivals: InvoiceArrival[];
  seasonName: string;
  defaultDescription: string;
}

interface Draft {
  billToName: string; billToAttention: string; billToEmail: string; billToAddress: string;
  description: string; issuedOn: string; dueOn: string;
  chequeAddress: string; etransferEmail: string; questionsTo: string;
}

function draftFrom(read: InvoiceRead, sponsor: Fundraiser): Draft {
  const inv = read.invoice;
  const today = tournamentToday();
  // A new invoice's due date starts from Expected by only when that is still ahead — a date already passed would be
  // refused as "before the issue date" (/review). A kept invoice keeps its own, cleared or not.
  const expected = sponsor.expectedBy && sponsor.expectedBy >= today ? sponsor.expectedBy : '';
  return {
    billToName: inv?.billToName ?? sponsor.name,
    billToAttention: inv?.billToAttention ?? '',
    billToEmail: inv?.billToEmail ?? '',
    billToAddress: inv?.billToAddress ?? '',
    description: inv?.description ?? read.defaultDescription,
    issuedOn: inv?.issuedOn ?? today,
    dueOn: inv ? (inv.dueOn ?? '') : expected,
    chequeAddress: read.teamPayment.chequeAddress ?? '',
    etransferEmail: read.teamPayment.etransferEmail ?? '',
    questionsTo: read.teamPayment.questionsTo ?? '',
  };
}

async function printInvoice(orgSlug: string, teamId: string, sponsorName: string, invoice: SponsorInvoice,
  pay: SponsorPaymentDetails, teamName: string, arrivals: InvoiceArrival[]) {
  const standing = invoiceStanding(invoice.amount, arrivals);
  const settings = (await fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)) ?? DEFAULT_PDF_SETTINGS;
  await downloadSponsorInvoice(
    buildFilename({ org: orgSlug, dataset: `invoice-${invoice.number}`, scope: sponsorName }, 'pdf'),
    {
      teamName,
      fromLine: oneLineAddress(pay.chequeAddress) || null,
      number: invoice.number,
      issuedLabel: formatStoredDate(invoice.issuedOn),
      dueLabel: invoice.dueOn ? formatStoredDate(invoice.dueOn) : null,
      revisedLabel: invoice.revisedOn ? formatStoredDate(invoice.revisedOn) : null,
      paidInFull: standing.standing === 'paid',
      paidInFullLabel: standing.paidOn ? formatStoredDate(standing.paidOn) : null,
      partPaid: standing.standing === 'part',
      invoiced: fmt(invoice.amount),
      paid: fmt(standing.paid),
      balance: fmt(standing.balance),
      billTo: { name: invoice.billToName, attention: invoice.billToAttention, address: invoice.billToAddress, email: invoice.billToEmail },
      description: invoice.description,
      amount: fmt(invoice.amount),
      payments: arrivals.map(a => [
        formatStoredDate(a.receivedDate),
        a.method ? (DUES_PAYMENT_METHOD_LABEL[a.method as DuesPaymentMethod] ?? a.method) : '—',
        fmt(a.amount),
      ]),
      howToPay: { etransferEmail: pay.etransferEmail ?? null, chequeAddress: oneLineAddress(pay.chequeAddress) || null },
      questionsTo: pay.questionsTo ?? null,
      settings,
    },
  );
}

export function SponsorInvoiceWindow({
  orgSlug,
  teamId,
  sponsor,
  onIssued,
  onClose,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  sponsor: Fundraiser;
  /** After the invoice is kept: the room re-reads, so its facts line names the invoice. */
  onIssued: () => void;
  onClose: () => void;
  tabActive: boolean;
}) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsor.id}/invoice`;
  const [read, setRead] = useState<InvoiceRead | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initial, setInitial] = useState<Draft | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(base);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'The invoice could not be loaded.');
        const data = (await res.json()) as InvoiceRead;
        if (!live) return;
        const d = draftFrom(data, sponsor);
        setRead(data);
        setDraft(d);
        setInitial(d);
        setTeamOpen(paymentDetailsEmpty(data.teamPayment));
      } catch (e) {
        if (live) setLoadError(e instanceof Error ? e.message : 'The invoice could not be loaded.');
      }
    })();
    return () => { live = false; };
    // The window is keyed by the sponsor; one read per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const dirty = useMemo(
    () => !!draft && !!initial && (Object.keys(draft) as (keyof Draft)[]).some(k => draft[k] !== initial[k]),
    [draft, initial],
  );
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(d => (d ? { ...d, [k]: e.target.value } : d));

  async function download(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !read) return;
    if (!draft.billToName.trim()) { setError("Add the name on the invoice. It's who the sponsor's accounts department pays against."); return; }
    if (!draft.description.trim()) { setError('Add a description of what the sponsor is paying for.'); return; }
    if (!draft.issuedOn) { setError('Add the issue date.'); return; }
    if (read.amount <= 0) { setError('This sponsor has no amount yet. Add the pledged amount in Edit sponsorship first.'); return; }
    setSaving(true);
    setError('');

    // ── 1. Keep it ──
    let kept: { invoice: SponsorInvoice; teamPayment: SponsorPaymentDetails; teamName: string; arrivals: InvoiceArrival[] };
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billToName: draft.billToName,
          billToAttention: draft.billToAttention,
          billToEmail: draft.billToEmail,
          billToAddress: draft.billToAddress,
          description: draft.description,
          issuedOn: draft.issuedOn,
          dueOn: draft.dueOn || null,
          // A folded section sends nothing: the team's details change only where the coach opened them.
          ...(teamOpen ? { teamPayment: { chequeAddress: draft.chequeAddress, etransferEmail: draft.etransferEmail, questionsTo: draft.questionsTo } } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(writeFailure(res, body, 'The invoice could not be saved.'));
      kept = body;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invoice could not be saved.');
      setSaving(false);
      return;
    }
    // Kept: the window now reads as the kept invoice (its number, nothing unsaved), and the room learns of it.
    const keptRead: InvoiceRead = { ...read, invoice: kept.invoice, teamPayment: kept.teamPayment, teamName: kept.teamName, arrivals: kept.arrivals, amount: kept.invoice.amount };
    const keptDraft = draftFrom(keptRead, sponsor);
    setRead(keptRead);
    setDraft(keptDraft);
    setInitial(keptDraft);
    onIssued();

    // ── 2. Print it ──
    try {
      await printInvoice(orgSlug, teamId, sponsor.name, kept.invoice, kept.teamPayment, kept.teamName, kept.arrivals);
      onClose();
    } catch {
      setError(`Invoice ${kept.invoice.number} is saved, but the PDF could not be built. Press Download invoice again.`);
      setSaving(false);
    }
  }

  const issued = read?.invoice ?? null;
  const teamName = read?.teamName ?? '';

  return (
    <QuestionShell
      open={tabActive}
      onClose={onClose}
      dirty={dirty}
      wide
      eyebrow={sponsor.name}
      ariaLabel={`Invoice for ${sponsor.name}`}
      title="Invoice"
      busy={saving}
      leaveGuard={{ tabActive, message: "You haven't downloaded this invoice yet. Leave without saving it?" }}
      footer={draft ? <>
        <QuestionCancel className={styles.btnGhost} />
        <button type="submit" form="sponsor-invoice-form" className={styles.btnPrimary} disabled={saving}>
          {saving ? 'Building…' : 'Download invoice'}
        </button>
      </> : <QuestionCancel className={styles.btnGhost} />}
    >
      {!draft || !read ? (
        loadError ? <p className={styles.errorText}>{loadError}</p> : <LoadingState inline label="Loading the invoice…" />
      ) : (
        <form id="sponsor-invoice-form" onSubmit={download} className={styles.formBody}>
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Bill to</h4>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="inv-bill-name">Name on the invoice *</label>
                <input id="inv-bill-name" className={styles.input} value={draft.billToName} onChange={set('billToName')} maxLength={160} required />
                <p className={styles.formHint}>Often the business&apos;s legal name. Kept on this sponsor.</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-bill-attn">Attention</label>
                <input id="inv-bill-attn" className={styles.input} value={draft.billToAttention} onChange={set('billToAttention')} maxLength={160} placeholder="e.g. Accounts payable" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-bill-email">Email</label>
                <input id="inv-bill-email" className={styles.input} type="email" value={draft.billToEmail} onChange={set('billToEmail')} maxLength={200} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="inv-bill-addr">Mailing address</label>
                <textarea id="inv-bill-addr" className={styles.textarea} rows={2} value={draft.billToAddress} onChange={set('billToAddress')} maxLength={300} />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>This invoice</h4>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <span className={styles.label}>Invoice number</span>
                <p className={styles.formValue}>{issued?.number ?? read.nextNumber}</p>
                <p className={styles.formHint}>{issued ? `Issued ${formatStoredDate(issued.issuedOn)}.` : 'Fixed once you download.'}</p>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Amount</span>
                <p className={styles.formValue}><strong>{read.amount > 0 ? fmt(read.amount) : '—'}</strong></p>
                <p className={styles.formHint}>
                  {read.hasPledge
                    ? 'The pledged amount. Change it in Edit sponsorship.'
                    : 'What has arrived. This sponsor has no pledge; add one in Edit sponsorship.'}
                </p>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-issued">Issue date *</label>
                <input id="inv-issued" className={styles.input} type="date" value={draft.issuedOn} onChange={set('issuedOn')} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-due">Due date</label>
                <input id="inv-due" className={styles.input} type="date" value={draft.dueOn} min={draft.issuedOn || undefined} onChange={set('dueOn')} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="inv-desc">Description *</label>
                <input id="inv-desc" className={styles.input} value={draft.description} onChange={set('description')} maxLength={240} required />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>How sponsors pay the team</h4>
            {teamOpen ? (
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <span className={styles.label}>Payable to</span>
                  <p className={styles.formValue}>{teamName}</p>
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label} htmlFor="inv-cheque">Mailing address for cheques</label>
                  <textarea id="inv-cheque" className={styles.textarea} rows={2} value={draft.chequeAddress} onChange={set('chequeAddress')} maxLength={300} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="inv-etransfer">E-transfer email</label>
                  <input id="inv-etransfer" className={styles.input} type="email" value={draft.etransferEmail} onChange={set('etransferEmail')} maxLength={200} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="inv-questions">Questions go to</label>
                  <input id="inv-questions" className={styles.input} value={draft.questionsTo} onChange={set('questionsTo')} maxLength={160} placeholder="A name and an email" />
                </div>
                <p className={`${styles.formHint} ${styles.formGridFull}`}>Kept for the team. Prints on every invoice the team sends.</p>
              </div>
            ) : (
              <div className={styles.formFoldedLine}>
                <p className={styles.formHint}>
                  Payable to <strong>{teamName}</strong>
                  {draft.etransferEmail && <> · e-transfer {draft.etransferEmail}</>}
                  {draft.chequeAddress && <> · cheques to {oneLineAddress(draft.chequeAddress)}</>}
                </p>
                <button type="button" className={styles.linkBtnAccent} onClick={() => setTeamOpen(true)}>Change</button>
              </div>
            )}
          </div>
          <QuestionReason className={styles.errorText}>{error}</QuestionReason>
        </form>
      )}
    </QuestionShell>
  );
}
