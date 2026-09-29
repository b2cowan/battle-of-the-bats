'use client';
/**
 * THE CLUB'S TRYOUT WINDOWS (Club Tier Stage 2, specimen 7).
 *
 *   ApplicantDialog     — the applicant's panel, which each row's chevron opens. The per-row buttons
 *                         moved in here (one chevron per row — the table standard). S2-05: WAITLIST
 *                         joins it, matching the coach's decision board (the server always allowed
 *                         it); a decline ASKS, because it is final (the old "one click brings a
 *                         decline back" promise was never true — a declined application has no way
 *                         back). On a closed season it opens read-only: a record.
 *                         ⚠ Departure, told at build time: today's slide-over becomes the kit's
 *                         window — the same content, with the club's Back and focus handling.
 *   AddApplicantDialog  — "Add applicant" (creating asks: an explicit Add).
 * ⚠ NO FAMILY EMAILS FROM HERE (owner ruling 2026-08-26, binding): every notice says the club tells
 * the family itself.
 */
import { useState } from 'react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { RepChip, repKit } from './RepKit';
import { formatStoredDate } from '@/lib/timezone';
import type { RepTryoutRegistration, RepTryoutRegistrationStatus } from '@/lib/types';

export const TRYOUT_STATUS_LABEL: Record<RepTryoutRegistrationStatus, string> = {
  pending_review: 'Pending review',
  offered: 'Offered',
  waitlisted: 'Waitlisted',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
export const TRYOUT_STATUS_TONE: Record<RepTryoutRegistrationStatus, 'warn' | 'info' | 'good' | 'neutral'> = {
  pending_review: 'warn', offered: 'info', waitlisted: 'neutral', accepted: 'good', declined: 'neutral', withdrawn: 'neutral',
};

/** What happened, in the club's words — the family is told by the club, never by the platform. */
export function tryoutNotice(status: RepTryoutRegistrationStatus, name: string, seasonName: string): string {
  switch (status) {
    case 'offered': return `Offer recorded for ${name}. Reach the family your way.`;
    case 'waitlisted': return `${name} is on the waitlist. Let the family know yourself.`;
    case 'accepted': return `${name} is on the ${seasonName} roster. Welcome them your way.`;
    case 'declined': return `${name} is declined. Remember to tell the family.`;
    case 'withdrawn': return `${name} is marked withdrawn.`;
    default: return 'Updated.';
  }
}

export function ApplicantDialog({
  reg, seasonName, canAct, busy, onClose, onStatus, onSaveNotes,
}: {
  reg: RepTryoutRegistration;
  seasonName: string;
  /** Owner or admin, on the LIVE season. Anyone else, or a closed season, reads it as a record. */
  canAct: boolean;
  busy: boolean;
  onClose: () => void;
  onStatus: (status: RepTryoutRegistrationStatus) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(reg.adminNotes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const name = `${reg.playerFirstName} ${reg.playerLastName}`.trim();
  const notesDirty = notes !== (reg.adminNotes ?? '');
  const s = reg.status;

  if (confirmDecline) {
    return (
      <KitDialog
        kind="question"
        eyebrow={seasonName}
        title={`Decline ${name}?`}
        onClose={() => setConfirmDecline(false)}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDecline(false)} disabled={busy}>Keep it</button>
            <button type="button" className="btn btn-danger" onClick={() => void onStatus('declined')} disabled={busy}>{busy ? 'Declining…' : 'Decline'}</button>
          </>
        }
      >
        <p>A declined application is final: it can’t be offered or brought back afterwards. Nothing is emailed — tell the family yourself.</p>
      </KitDialog>
    );
  }

  const actions = canAct ? (
    <>
      {s === 'pending_review' && (
        <>
          <button type="button" className="btn btn-lime" onClick={() => void onStatus('offered')} disabled={busy}>Extend offer</button>
          <button type="button" className="btn btn-outline" onClick={() => void onStatus('waitlisted')} disabled={busy}>Waitlist</button>
        </>
      )}
      {s === 'offered' && (
        <>
          <button type="button" className="btn btn-lime" onClick={() => void onStatus('accepted')} disabled={busy}>Add to roster</button>
          <button type="button" className="btn btn-outline" onClick={() => void onStatus('waitlisted')} disabled={busy}>Waitlist</button>
        </>
      )}
      {s === 'waitlisted' && (
        <button type="button" className="btn btn-lime" onClick={() => void onStatus('offered')} disabled={busy}>Extend offer</button>
      )}
      {(s === 'pending_review' || s === 'offered' || s === 'waitlisted') && (
        <button type="button" className="btn btn-outline" onClick={() => setConfirmDecline(true)} disabled={busy}>Decline</button>
      )}
    </>
  ) : undefined;
  const canWithdraw = canAct && (s === 'pending_review' || s === 'offered' || s === 'waitlisted' || s === 'accepted');

  return (
    <KitDialog
      kind="form"
      eyebrow={seasonName}
      title={<>{name} <RepChip tone={TRYOUT_STATUS_TONE[s]}>{TRYOUT_STATUS_LABEL[s]}</RepChip></>}
      identity={`Submitted ${formatStoredDate(reg.submittedAt)}`}
      onClose={onClose}
      busy={busy || savingNotes}
      footerStart={canWithdraw ? (
        <button type="button" className="btn btn-ghost" onClick={() => void onStatus('withdrawn')} disabled={busy}>Mark withdrawn</button>
      ) : undefined}
      footer={actions ?? <button type="button" className="btn btn-outline" onClick={onClose}>Done</button>}
    >
      <div className={repKit.facts}>
        <span className={repKit.factsLabel}>Player</span>
        {name}
        {reg.playerDateOfBirth && <> · born {formatStoredDate(reg.playerDateOfBirth)}</>}
        {reg.playerNotes && <p className={repKit.windowNote}>{reg.playerNotes}</p>}
      </div>
      <div className={`${repKit.facts} ${repKit.factsNext}`}>
        <span className={repKit.factsLabel}>Guardian</span>
        {reg.guardianFirstName} {reg.guardianLastName} · <a href={`mailto:${reg.guardianEmail}`} className={repKit.inlineLink}>{reg.guardianEmail}</a>
        {reg.guardianPhone && <> · {reg.guardianPhone}</>}
      </div>
      <div className={`${repKit.facts} ${repKit.factsNext}`}>
        <span className={repKit.factsLabel}>Consent</span>
        {reg.consentAt
          ? `Given ${formatStoredDate(reg.consentAt)}${reg.consentEmailComms ? ' · news emails OK' : ''}`
          : 'No consent on record'}
      </div>
      <label className={`${ck.field} ${repKit.factsNext}`}>
        <span className={ck.label}>The club’s notes (private)</span>
        <textarea
          className={ck.textarea}
          rows={3}
          value={notes}
          readOnly={!canAct}
          placeholder={canAct ? 'Only the club sees these.' : undefined}
          onChange={e => setNotes(e.target.value)}
        />
      </label>
      {canAct && notesDirty && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={savingNotes}
          onClick={async () => { setSavingNotes(true); await onSaveNotes(notes); setSavingNotes(false); }}
        >
          {savingNotes ? 'Saving…' : 'Save notes'}
        </button>
      )}
    </KitDialog>
  );
}

type AddForm = {
  playerFirstName: string; playerLastName: string; playerDateOfBirth: string; playerNotes: string;
  guardianFirstName: string; guardianLastName: string; guardianEmail: string; guardianPhone: string;
};
const BLANK: AddForm = {
  playerFirstName: '', playerLastName: '', playerDateOfBirth: '', playerNotes: '',
  guardianFirstName: '', guardianLastName: '', guardianEmail: '', guardianPhone: '',
};

export function AddApplicantDialog({
  seasonName, onClose, onAdd,
}: {
  seasonName: string;
  onClose: () => void;
  /** Resolves to an error sentence, or null when the applicant was added. */
  onAdd: (form: AddForm) => Promise<string | null>;
}) {
  const [form, setForm] = useState<AddForm>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = !!(form.playerFirstName.trim() && form.playerLastName.trim() && form.guardianFirstName.trim()
    && form.guardianLastName.trim() && form.guardianEmail.trim());
  const set = (patch: Partial<AddForm>) => setForm(f => ({ ...f, ...patch }));

  async function add() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const refused = await onAdd(form);
    setBusy(false);
    if (refused) setError(refused);
  }

  const field = (key: keyof AddForm, label: string, required = false, type = 'text', max = 60) => (
    <label className={ck.field}>
      <span className={ck.label}>{label}{required && <span className={repKit.req} aria-hidden>*</span>}</span>
      <input className={ck.input} type={type} value={form[key]} maxLength={max} onChange={e => set({ [key]: e.target.value } as Partial<AddForm>)} />
    </label>
  );

  return (
    <KitDialog
      kind="form"
      eyebrow={seasonName}
      title="Add an applicant"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={add} disabled={!ready || busy}>{busy ? 'Adding…' : 'Add applicant'}</button>
        </>
      }
    >
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <div className={repKit.fieldGrid}>
        {field('playerFirstName', 'Player’s first name', true)}
        {field('playerLastName', 'Player’s last name', true)}
        {field('playerDateOfBirth', 'Date of birth', false, 'date', 10)}
      </div>
      <label className={ck.field}>
        <span className={ck.label}>About the player</span>
        <textarea className={ck.textarea} rows={2} maxLength={500} value={form.playerNotes} placeholder="Position, experience…" onChange={e => set({ playerNotes: e.target.value })} />
      </label>
      <div className={repKit.fieldGrid}>
        {field('guardianFirstName', 'Guardian’s first name', true)}
        {field('guardianLastName', 'Guardian’s last name', true)}
        {field('guardianEmail', 'Guardian’s email', true, 'email', 120)}
        {field('guardianPhone', 'Guardian’s phone', false, 'tel', 20)}
      </div>
    </KitDialog>
  );
}

export type { AddForm as AddApplicantForm };
