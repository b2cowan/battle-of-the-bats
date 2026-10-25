'use client';
/**
 * ADD A REGISTRATION BY HAND (Club Tier Stage 9b-2, Part 3): today's form, on the kit's window. The player, the guardian and
 * the division it lands in (and whether it lands accepted, to review or on the waitlist). The route prices it the way a
 * sign-up is priced — the division's price for today — and refuses a full division in words.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { FormError, jsonInit, moneyFetch, refusalText } from '../../money/MoneyKit';
import DateInput from '@/components/shared/DateInput';
import { ADD_REG_WORDS as W, MONEY_REFUSAL } from '@/lib/house-league-money-words';
import type { RegsDivision } from '@/lib/house-league-registrations';
import type { LeagueRegistrationStatus } from '@/lib/types';
import css from './Registrations.module.css';

interface Form {
  divisionId: string;
  playerFirstName: string; playerLastName: string; playerDateOfBirth: string; playerJerseyPref: string; playerPositionPref: string; playerNotes: string;
  guardianFirstName: string; guardianLastName: string; guardianEmail: string; guardianPhone: string;
  status: LeagueRegistrationStatus;
}

const BLANK: Form = {
  divisionId: '', playerFirstName: '', playerLastName: '', playerDateOfBirth: '', playerJerseyPref: '', playerPositionPref: '', playerNotes: '',
  guardianFirstName: '', guardianLastName: '', guardianEmail: '', guardianPhone: '', status: 'active',
};

export default function AddRegistrationWindow({ seasonName, divisions, today, orgQuery, seasonId, onClose, onAdded }: {
  seasonName: string;
  divisions: readonly RegsDivision[];
  today: string;
  orgQuery: string;
  seasonId: string;
  onClose: () => void;
  onAdded: (said: string) => void;
}) {
  const [form, setForm] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));
  const typed = Object.entries(form).some(([k, v]) => k !== 'status' && String(v).trim() !== '');

  const text = (key: keyof Form, label: string, opts: { required?: boolean; type?: string } = {}) => (
    <label className={ck.field} htmlFor={`regs-add-${key}`}>
      <span className={ck.label}>{label}{opts.required && <span className={repKit.req} aria-hidden>*</span>}</span>
      <input id={`regs-add-${key}`} className={ck.input} type={opts.type ?? 'text'} value={String(form[key])} onChange={e => set(key, e.target.value as never)} />
    </label>
  );

  async function go() {
    if (busy) return;
    if (!form.divisionId || !form.playerFirstName.trim() || !form.playerLastName.trim()
      || !form.guardianFirstName.trim() || !form.guardianLastName.trim() || !form.guardianEmail.trim()) {
      setError(W.missing);
      return;
    }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(`/api/admin/house-league/seasons/${seasonId}/registrations${orgQuery}`, jsonInit('POST', {
        divisionId: form.divisionId,
        playerFirstName: form.playerFirstName.trim(),
        playerLastName: form.playerLastName.trim(),
        playerDateOfBirth: form.playerDateOfBirth || null,
        playerJerseyPref: form.playerJerseyPref || null,
        playerPositionPref: form.playerPositionPref || null,
        playerNotes: form.playerNotes || null,
        guardianFirstName: form.guardianFirstName.trim(),
        guardianLastName: form.guardianLastName.trim(),
        guardianEmail: form.guardianEmail.trim(),
        guardianPhone: form.guardianPhone || null,
        status: form.status,
      }));
      if (!r.ok) { setError(refusalText(r.data, MONEY_REFUSAL.failed)); setBusy(false); return; }
      onAdded(W.done(`${form.playerFirstName.trim()} ${form.playerLastName.trim()}`));
    } catch {
      setError(MONEY_REFUSAL.failed);
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      eyebrow={W.eyebrow(seasonName)}
      title={W.title}
      onClose={onClose}
      busy={busy}
      dirty={typed}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>{busy ? W.working : W.submit}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <h3 className={css.formSection}>{W.player}</h3>
      <div className={repKit.fieldGrid}>
        {text('playerFirstName', W.firstName, { required: true })}
        {text('playerLastName', W.lastName, { required: true })}
        <label className={ck.field} htmlFor="regs-add-dob">
          <span className={ck.label}>{W.dob}</span>
          <DateInput id="regs-add-dob" className={ck.input} value={form.playerDateOfBirth} max={today} onChange={v => set('playerDateOfBirth', v)} />
        </label>
        {text('playerJerseyPref', W.jersey)}
        {text('playerPositionPref', W.position)}
      </div>
      <label className={ck.field} htmlFor="regs-add-notes">
        <span className={ck.label}>{W.notes}</span>
        <textarea id="regs-add-notes" className={ck.textarea} rows={2} value={form.playerNotes} onChange={e => set('playerNotes', e.target.value)} />
      </label>
      <h3 className={css.formSection}>{W.guardian}</h3>
      <div className={repKit.fieldGrid}>
        {text('guardianFirstName', W.firstName, { required: true })}
        {text('guardianLastName', W.lastName, { required: true })}
        {text('guardianEmail', W.email, { required: true, type: 'email' })}
        {text('guardianPhone', W.phone)}
      </div>
      <h3 className={css.formSection}>{W.assignment}</h3>
      <div className={repKit.fieldGrid}>
        <label className={ck.field} htmlFor="regs-add-division">
          <span className={ck.label}>{W.division}<span className={repKit.req} aria-hidden>*</span></span>
          <select id="regs-add-division" className={ck.select} value={form.divisionId} onChange={e => set('divisionId', e.target.value)}>
            <option value="">{W.divisionPick}</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className={ck.field} htmlFor="regs-add-status">
          <span className={ck.label}>{W.status}</span>
          <select id="regs-add-status" className={ck.select} value={form.status} onChange={e => set('status', e.target.value as LeagueRegistrationStatus)}>
            {(Object.keys(W.statusOptions) as (keyof typeof W.statusOptions)[]).map(k => <option key={k} value={k}>{W.statusOptions[k]}</option>)}
          </select>
        </label>
      </div>
    </KitDialog>
  );
}
