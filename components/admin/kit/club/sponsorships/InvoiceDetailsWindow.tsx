'use client';
/**
 * SETUP › INVOICE DETAILS (Board Ready Stage 6, Part 1; round 1 tab 6, round 2 tab 3, asks 9 and 4). A record window: it
 * reads first, one pencil, and saves as you go. The owner, admins and the treasurer change it; anyone else with
 * Sponsorships reads it with the lock line and no pencil (round 2 ask 4). The mailing address is the club's one column
 * (the offer email's foot and every invoice read it; sending waits on it, ask 13). The edit state was not drawn: its fields
 * are the read rows' own labels, in the same order.
 */
import { useState } from 'react';
import KitDialog from '../KitDialog';
import { SavePill } from '../RepKit';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { formatGstNumber, type SponsorshipSettings } from '@/lib/club-sponsorships';
import { send, sponsorshipsApi } from './api';
import SwitchRow from './SwitchRow';
import css from './Sponsorships.module.css';

type Field = 'mailingAddress' | 'gstHstNumber' | 'etransferTo' | 'chequesPayableTo' | 'paymentDueDays' | 'contactName' | 'contactEmail';
const draftOf = (s: SponsorshipSettings): Record<Field, string> => ({
  mailingAddress: s.mailingAddress ?? '', gstHstNumber: s.gstHstNumber ? formatGstNumber(s.gstHstNumber) : '', etransferTo: s.etransferTo ?? '',
  chequesPayableTo: s.chequesPayableTo ?? '', paymentDueDays: String(s.paymentDueDays), contactName: s.contactName ?? '', contactEmail: s.contactEmail ?? '',
});

export default function InvoiceDetailsWindow({ slug, settings, canChange, onSaved, onClose }: {
  slug: string;
  settings: SponsorshipSettings;
  canChange: boolean;
  onSaved: (s: SponsorshipSettings) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(settings);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPatch, setLastPatch] = useState<Record<string, unknown> | null>(null);
  const dirty = (Object.keys(draft) as Field[]).some(k => draft[k] !== draftOf(saved)[k]);

  async function save(patch: Record<string, unknown>) {
    setSaving(true); setError(null); setLastPatch(patch);
    const r = await send<{ settings: SponsorshipSettings }>(sponsorshipsApi(slug, '/settings'), 'PATCH', patch);
    setSaving(false);
    if (!r.ok) { setError(r.error); return false; }
    setSaved(r.data.settings);
    setDraft(d => ({ ...d, ...Object.fromEntries(Object.keys(patch).filter((k): k is Field => k in d).map(k => [k, draftOf(r.data.settings)[k]])) }));
    onSaved(r.data.settings);
    return true;
  }
  const commit = (k: Field) => { if (draft[k] !== draftOf(saved)[k]) void save({ [k]: draft[k] }); };
  const field = (k: Field, label: string, opts: { type?: string; placeholder?: string; area?: boolean; inputMode?: 'numeric' } = {}) => (
    <div className={ck.field}>
      <label className={ck.label} htmlFor={`inv-${k}`}>{label}</label>
      {opts.area
        ? <textarea id={`inv-${k}`} className={ck.textarea} rows={2} maxLength={300} value={draft[k]} placeholder={opts.placeholder}
          onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} onBlur={() => commit(k)} />
        : <input id={`inv-${k}`} className={ck.input} type={opts.type ?? 'text'} inputMode={opts.inputMode} value={draft[k]} placeholder={opts.placeholder}
          onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} onBlur={() => commit(k)} />}
    </div>
  );

  const read = (
    <>
      <dl className={css.facts}>
        <dt>{W.invoice.mailing}</dt>
        <dd>{saved.mailingAddress ?? <span className={ck.muted}>{W.invoice.notSet}</span>}<span className={css.factSub}>{W.invoice.mailingSub}</span></dd>
        <dt>{W.invoice.gst}</dt>
        <dd>{saved.registered && saved.gstHstNumber ? W.invoice.registeredRead(formatGstNumber(saved.gstHstNumber)) : W.invoice.notRegistered}
          {saved.registered && <span className={css.factSub}>{W.invoice.gstSub}</span>}</dd>
        <dt>{W.invoice.etransfer}</dt>
        <dd>{saved.etransferTo ?? <span className={ck.muted}>{W.invoice.notSet}</span>}</dd>
        <dt>{W.invoice.cheques}</dt>
        <dd>{saved.chequesPayableTo ?? <span className={ck.muted}>{W.invoice.notSet}</span>}</dd>
        <dt>{W.invoice.due}</dt>
        <dd>{W.invoice.dueRead(saved.paymentDueDays)}</dd>
        <dt>{W.invoice.contact}</dt>
        <dd>{[saved.contactName, saved.contactEmail].filter(Boolean).join(' · ') || <span className={ck.muted}>{W.invoice.notSet}</span>}</dd>
      </dl>
      {canChange
        ? (
          <>
            <p className={ck.hint}>{W.invoice.taxHint}</p>
            <p className={ck.hint}>{W.invoice.numberHint}</p>
          </>
        )
        : <p className={css.lock}>{W.invoice.lockLine}</p>}
    </>
  );

  const edit = (
    <div className={css.form}>
      {field('mailingAddress', W.invoice.mailing, { area: true, placeholder: W.invoice.mailingPlaceholder })}
      <p className={ck.hint}>{W.invoice.mailingSub}</p>
      <SwitchRow id="inv-registered" name={W.invoice.registered} on={saved.registered} disabled={saving}
        onChange={on => void save({ registered: on, gstHstNumber: draft.gstHstNumber })} />
      {/* Always shown while editing: "Registered" needs a number on file, so the number comes first. */}
      {field('gstHstNumber', W.invoice.number, { placeholder: W.invoice.numberPlaceholder })}
      <p className={ck.hint}>{W.invoice.numberHint}</p>
      <p className={ck.hint}>{W.invoice.taxHint}</p>
      <div className={css.twoCol}>
        {field('etransferTo', W.invoice.etransfer, { type: 'email', placeholder: W.invoice.etransferPlaceholder })}
        {field('chequesPayableTo', W.invoice.cheques)}
      </div>
      <div className={css.twoCol}>
        {field('paymentDueDays', W.invoice.dueLabel, { inputMode: 'numeric' })}
        <span />
      </div>
      <p className={ck.hint}>{W.invoice.dueHint}</p>
      <div className={css.twoCol}>
        {field('contactName', `${W.invoice.contact} · ${W.invoice.contactName}`)}
        {field('contactEmail', `${W.invoice.contact} · ${W.invoice.contactEmail}`, { type: 'email' })}
      </div>
    </div>
  );

  return (
    <KitDialog kind="form" record eyebrow={W.invoice.eyebrow} title={W.invoice.title} onClose={onClose} size="medium" busy={saving}
      edit={canChange ? { editing, label: editing ? W.invoice.done : W.invoice.edit, disabled: saving, onToggle: () => setEditing(e => (e && error ? true : !e)) } : undefined}
      status={editing ? <SavePill inline saving={saving} dirty={dirty} error={error} onRetry={() => { if (lastPatch) void save(lastPatch); }} /> : undefined}>
      {editing ? edit : read}
    </KitDialog>
  );
}
