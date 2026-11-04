'use client';
/**
 * The six billing-address fields and the US tick-box (GST/HST Stage 1 Part 2; owner drawing 2026-11-03, tabs 2–5).
 * Shared by the Billing address window (`variant="window"`, the billing kit's fields), the coach sign-up's Address step
 * (`variant="start"`, the sign-up page's own fields) and the "Start your club" window's block.
 *
 *   · Country first: it decides the province/state list and the postal-code shape. Canada is the default.
 *   · Errors show on press (`check()`), one red line under each field; the words come from lib/billing-location.ts.
 *   · Changing the country keeps street, unit and city, resets the province/state, and re-checks a typed postal code.
 *   · US while US sales are closed: only Country is shown. The window says why in its foot; the sign-up step (no foot)
 *     says it in one amber line under Country.
 *   · The province/state list is a native <select>, so a phone opens its own picker (drawing Ask 5, ruled A).
 */
import { useState } from 'react';
import {
  BILLING_ADDRESS_FORM_WORDS as F,
  BILLING_COUNTRIES,
  BILLING_LOCATION_WORDS,
  checkBillingLocation,
  countryInfo,
  normalizeCanadianPostalCode,
  normalizeZipCode,
  usDeclarationText,
  type BillingLocationCheck,
  type BillingLocationField,
  type DeclarationSubject,
  type StoredBillingLocation,
} from '@/lib/billing-location';
import billing from './Billing.module.css';
import start from '@/components/auth/AccountForm.module.css';
import styles from './BillingAddress.module.css';

export type AddressDraft = {
  country: string; regionCode: string; line1: string; line2: string; city: string; postalCode: string; usDeclared: boolean;
};

export type AddressErrors = Partial<Record<BillingLocationField, string>>;

export function draftFrom(location: StoredBillingLocation | null | undefined): AddressDraft {
  return {
    country: location?.country ?? 'CA',
    regionCode: location?.regionCode ?? '',
    line1: location?.line1 ?? '',
    line2: location?.line2 ?? '',
    city: location?.city ?? '',
    postalCode: location?.postalCode ?? '',
    usDeclared: location ? location.usDeclarationAt !== null : false,
  };
}

const sameDraft = (a: AddressDraft, b: AddressDraft) =>
  a.country === b.country && a.regionCode === b.regionCode && a.line1 === b.line1 && a.line2 === b.line2
  && a.city === b.city && a.postalCode === b.postalCode && a.usDeclared === b.usDeclared;

/** The US hold: choosing the United States while US sales are closed ends the step (owner Ask 5 / drawing Ask 4). */
const usClosedFor = (draft: AddressDraft, usSalesOpen: boolean) => draft.country === 'US' && !usSalesOpen;

/** The form's state: what is typed, the red lines, and whether closing would lose anything. */
export function useAddressDraft(initial: StoredBillingLocation | null | undefined, usSalesOpen: boolean) {
  const [baseline, setBaseline] = useState<AddressDraft>(() => draftFrom(initial));
  const [draft, setDraft] = useState<AddressDraft>(baseline);
  const [errors, setErrors] = useState<AddressErrors>({});

  /** Fill in from an address that arrived after the form opened (the "Start your club" block's prefill); not dirty. */
  function reset(location: StoredBillingLocation | null | undefined) {
    const next = draftFrom(location);
    setBaseline(next); setDraft(next); setErrors({});
  }

  function setField<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    if (errors[key as BillingLocationField]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  function setCountry(country: string) {
    setDraft(d => ({ ...d, country, regionCode: '', usDeclared: false }));
    setErrors(e => {
      const next: AddressErrors = { ...e, country: undefined, regionCode: undefined, usDeclared: undefined };
      const info = countryInfo(country);
      const typed = draft.postalCode.trim();
      if (info && typed) {
        const fits = info.code === 'CA' ? normalizeCanadianPostalCode(typed) : normalizeZipCode(typed);
        next.postalCode = fits ? undefined : BILLING_LOCATION_WORDS.postal[info.code];
      }
      return next;
    });
  }

  /** Press-time check: the same rule the server saves through. Shows the red lines and returns the verdict. */
  function check(): BillingLocationCheck {
    const result = checkBillingLocation(draft, { usSalesOpen });
    setErrors(result.ok ? {} : result.errors);
    return result;
  }

  return {
    draft, errors, setErrors, setField, setCountry, check, reset,
    dirty: !sameDraft(draft, baseline),
    usClosed: usClosedFor(draft, usSalesOpen),
    /** What the save route and the checkout routes take. */
    body: { ...draft, line2: draft.line2 || null },
  };
}

export type AddressDraftState = ReturnType<typeof useAddressDraft>;

export default function BillingAddressFields({ form, idPrefix, subject, variant = 'window', disabled = false }: {
  form: AddressDraftState;
  idPrefix: string;
  subject: DeclarationSubject;
  variant?: 'window' | 'start';
  disabled?: boolean;
}) {
  const { draft, errors, setField, setCountry } = form;
  const info = countryInfo(draft.country);
  const onWindow = variant === 'window';
  const k = onWindow
    ? { field: billing.field, label: billing.label, input: billing.select, select: billing.select, hint: billing.hint, error: styles.error }
    : { field: start.field, label: start.label, input: start.input, select: start.select, hint: start.hint, error: styles.errorStart };
  const auto = (part: string) => (subject.kind === 'club' ? `billing ${part}` : part);

  const id = (name: string) => `${idPrefix}-${name}`;
  const errorId = (name: string) => `${idPrefix}-${name}-error`;
  const err = (name: BillingLocationField) => errors[name]
    ? <p id={errorId(name)} className={k.error} role="alert">{errors[name]}</p>
    : null;
  const described = (name: BillingLocationField, hint?: string) =>
    [errors[name] ? errorId(name) : null, hint ?? null].filter(Boolean).join(' ') || undefined;
  const label = (name: string, text: string, required: boolean) => (
    <label className={k.label} htmlFor={id(name)}>{text}{required ? <> <span aria-hidden>*</span></> : null}</label>
  );

  const { usClosed } = form;

  return (
    <div className={styles.fields}>
      <div className={k.field}>
        {label('country', F.country, true)}
        <select id={id('country')} className={k.select} value={draft.country} disabled={disabled} aria-required
          autoComplete={auto('country')} aria-invalid={Boolean(errors.country) || undefined} aria-describedby={described('country')}
          onChange={event => setCountry(event.target.value)}>
          {BILLING_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {usClosed && !onWindow ? <p className={styles.amberLine} role="status">{BILLING_LOCATION_WORDS.usClosed}</p> : err('country')}
      </div>
      {!usClosed && info && <>
        <div className={k.field}>
          {label('region', info.regionLabel, true)}
          <select id={id('region')} className={k.select} value={draft.regionCode} disabled={disabled} aria-required
            autoComplete={auto('address-level1')} aria-invalid={Boolean(errors.regionCode) || undefined} aria-describedby={described('regionCode')}
            onChange={event => setField('regionCode', event.target.value)}>
            <option value="">Choose…</option>
            {info.regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          {err('regionCode')}
        </div>
        <div className={k.field}>
          {label('line1', F.line1, true)}
          <input id={id('line1')} className={k.input} value={draft.line1} disabled={disabled} aria-required maxLength={200}
            autoComplete={auto('address-line1')} aria-invalid={Boolean(errors.line1) || undefined}
            aria-describedby={described('line1', errors.line1 ? undefined : id('line1-hint'))}
            onChange={event => setField('line1', event.target.value)} />
          {errors.line1 ? err('line1') : onWindow ? <p id={id('line1-hint')} className={k.hint}>{BILLING_LOCATION_WORDS.poBoxHint}</p> : null}
        </div>
        <div className={k.field}>
          {label('line2', F.line2, false)}
          <input id={id('line2')} className={k.input} value={draft.line2} disabled={disabled} maxLength={200}
            autoComplete={auto('address-line2')} aria-invalid={Boolean(errors.line2) || undefined} aria-describedby={described('line2')}
            onChange={event => setField('line2', event.target.value)} />
          {err('line2')}
        </div>
        <div className={k.field}>
          {label('city', F.city, true)}
          <input id={id('city')} className={k.input} value={draft.city} disabled={disabled} aria-required maxLength={100}
            autoComplete={auto('address-level2')} aria-invalid={Boolean(errors.city) || undefined} aria-describedby={described('city')}
            onChange={event => setField('city', event.target.value)} />
          {err('city')}
        </div>
        <div className={k.field}>
          {label('postal', info.postalLabel, true)}
          <input id={id('postal')} className={`${k.input}${onWindow ? ` ${styles.postal}` : ''}`} value={draft.postalCode} disabled={disabled} aria-required
            maxLength={10} autoComplete={auto('postal-code')} inputMode={info.code === 'US' ? 'numeric' : 'text'}
            autoCapitalize={info.code === 'CA' ? 'characters' : undefined}
            aria-invalid={Boolean(errors.postalCode) || undefined} aria-describedby={described('postalCode')}
            onChange={event => setField('postalCode', event.target.value)} />
          {err('postalCode')}
        </div>
        {info.code === 'US' && <div className={k.field}>
          <label className={styles.declaration} htmlFor={id('declaration')}>
            <input id={id('declaration')} type="checkbox" checked={draft.usDeclared} disabled={disabled} aria-required
              aria-invalid={Boolean(errors.usDeclared) || undefined} aria-describedby={described('usDeclared')}
              onChange={event => setField('usDeclared', event.target.checked)} />
            <span>{usDeclarationText(subject)} <span aria-hidden>*</span></span>
          </label>
          {err('usDeclared')}
        </div>}
      </>}
    </div>
  );
}
