'use client';

import { useState } from 'react';
import DateInput from '@/components/shared/DateInput';
import { CheckCircle } from 'lucide-react';
import { possessive, registrationReference } from '@/lib/utils';
import styles from './register.module.css';
import formKit from '@/components/public/ClubForm.module.css';

interface Props {
  orgSlug: string;
  teamSlug: string;
  yearId: string;
  teamName: string;
  yearName: string;
  orgName: string;
  /** Privacy-policy URL when the org has one set; null → consent renders without a link. */
  privacyPolicyHref?: string | null;
}

interface FormState {
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string;
  playerNotes: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
}

interface SuccessResult {
  id: string;
  playerName: string;
  guardianEmail: string;
}

export default function TryoutRegisterForm({
  orgSlug,
  teamSlug,
  yearId,
  teamName,
  yearName,
  orgName,
  privacyPolicyHref,
}: Props) {
  const [form, setForm] = useState<FormState>({
    playerFirstName: '',
    playerLastName: '',
    playerDateOfBirth: '',
    playerNotes: '',
    guardianFirstName: '',
    guardianLastName: '',
    guardianEmail: '',
    guardianPhone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessResult | null>(null);
  const [consent, setConsent] = useState({ data: false, email: false, eligibility: false });

  function setConsentField(field: 'data' | 'email' | 'eligibility', value: boolean) {
    const next = { ...consent, [field]: value };
    setConsent(next);
    // Clear the consent error only once both REQUIRED boxes are confirmed — un-ticking a box
    // should not dismiss the "please confirm" message. The email box is optional MARKETING
    // consent (CASL unbundling, 2026-07-30): status emails about this application are
    // transactional and never depend on it.
    if (next.data && next.eligibility) clearFieldError('consent');
  }

  function clearFieldError(field: string) {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }

  function setValue(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    clearFieldError(field);
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(field, e.target.value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setErrors({});

    if (!consent.data || !consent.eligibility) {
      setErrors({ consent: 'Please confirm the two boxes above before submitting.' });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/rep-teams/${orgSlug}/${teamSlug}/tryouts/${yearId}/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:   form.playerFirstName,
            playerLastName:    form.playerLastName,
            playerDateOfBirth: form.playerDateOfBirth || undefined,
            playerNotes:       form.playerNotes || undefined,
            guardianFirstName: form.guardianFirstName,
            guardianLastName:  form.guardianLastName,
            guardianEmail:     form.guardianEmail,
            guardianPhone:     form.guardianPhone || undefined,
            consentDataCollection: consent.data,
            consentEmailComms:     consent.email,
            consentEligibility:    consent.eligibility,
          }),
        },
      );

      const data = await res.json();

      if (res.status === 400 && data.errors) {
        setErrors(data.errors);
        return;
      }

      if (!res.ok) {
        setGlobalError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setSuccess({
        id:           data.id,
        playerName:   `${form.playerFirstName} ${form.playerLastName}`,
        guardianEmail: form.guardianEmail,
      });
    } catch {
      setGlobalError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={formKit.successPanel}>
        <div className={formKit.successIcon}>
          <CheckCircle size={28} />
        </div>
        <h2 className={formKit.successTitle}>Application received</h2>
        <p className={formKit.successBody}>
          We&apos;ve received <strong>{possessive(success.playerName)}</strong> tryout application
          for <strong>{teamName}</strong> — <strong>{yearName}</strong>. A confirmation email
          has been sent to <strong>{success.guardianEmail}</strong>. Our coaching staff will
          be in touch.
        </p>
        <div className={formKit.refBox}>
          Reference: <span className={formKit.refCode}>{registrationReference(success.id)}</span>
        </div>
      </div>
    );
  }

  return (
    <form className={formKit.form} onSubmit={handleSubmit} noValidate>

      {/* ── Section 1: Player information ───────────────────────────────── */}
      <div className={formKit.section}>
        <h2 className={formKit.sectionTitle}>Player information</h2>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label}>
              First name <span className={formKit.required}>*</span>
            </label>
            <input
              className={`${formKit.input}${errors.playerFirstName ? ` ${formKit.inputError}` : ''}`}
              type="text"
              value={form.playerFirstName}
              onChange={set('playerFirstName')}
              maxLength={80}
              autoComplete="given-name"
            />
            {errors.playerFirstName && <p className={formKit.errorMsg}>{errors.playerFirstName}</p>}
          </div>
          <div>
            <label className={formKit.label}>
              Last name <span className={formKit.required}>*</span>
            </label>
            <input
              className={`${formKit.input}${errors.playerLastName ? ` ${formKit.inputError}` : ''}`}
              type="text"
              value={form.playerLastName}
              onChange={set('playerLastName')}
              maxLength={80}
              autoComplete="family-name"
            />
            {errors.playerLastName && <p className={formKit.errorMsg}>{errors.playerLastName}</p>}
          </div>
        </div>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label}>
              Date of birth <span className={formKit.required}>*</span>
            </label>
            <DateInput
              className={`${formKit.input}${errors.playerDateOfBirth ? ` ${formKit.inputError}` : ''}`}
              value={form.playerDateOfBirth}
              onChange={v => setValue('playerDateOfBirth', v)}
            />
            {errors.playerDateOfBirth && <p className={formKit.errorMsg}>{errors.playerDateOfBirth}</p>}
          </div>
        </div>
        <div className={formKit.field}>
          <label className={formKit.label}>Additional notes</label>
          <textarea
            className={formKit.textarea}
            value={form.playerNotes}
            onChange={set('playerNotes')}
            maxLength={500}
            rows={3}
            placeholder="Position preference, experience level, any relevant notes…"
          />
          <p className={formKit.hint}>Optional. Max 500 characters.</p>
        </div>
      </div>

      {/* ── Section 2: Guardian Information ─────────────────────────────── */}
      <div className={formKit.section}>
        <h2 className={formKit.sectionTitle}>Parent or guardian information</h2>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label}>
              First name <span className={formKit.required}>*</span>
            </label>
            <input
              className={`${formKit.input}${errors.guardianFirstName ? ` ${formKit.inputError}` : ''}`}
              type="text"
              value={form.guardianFirstName}
              onChange={set('guardianFirstName')}
              maxLength={80}
              autoComplete="given-name"
            />
            {errors.guardianFirstName && <p className={formKit.errorMsg}>{errors.guardianFirstName}</p>}
          </div>
          <div>
            <label className={formKit.label}>
              Last name <span className={formKit.required}>*</span>
            </label>
            <input
              className={`${formKit.input}${errors.guardianLastName ? ` ${formKit.inputError}` : ''}`}
              type="text"
              value={form.guardianLastName}
              onChange={set('guardianLastName')}
              maxLength={80}
              autoComplete="family-name"
            />
            {errors.guardianLastName && <p className={formKit.errorMsg}>{errors.guardianLastName}</p>}
          </div>
        </div>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label}>
              Email address <span className={formKit.required}>*</span>
            </label>
            <input
              className={`${formKit.input}${errors.guardianEmail ? ` ${formKit.inputError}` : ''}`}
              type="email"
              value={form.guardianEmail}
              onChange={set('guardianEmail')}
              maxLength={200}
              autoComplete="email"
            />
            {errors.guardianEmail && <p className={formKit.errorMsg}>{errors.guardianEmail}</p>}
          </div>
          <div>
            <label className={formKit.label}>Phone number</label>
            <input
              className={formKit.input}
              type="tel"
              value={form.guardianPhone}
              onChange={set('guardianPhone')}
              maxLength={30}
              autoComplete="tel"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Consent ─────────────────────────────────────────── */}
      <div className={formKit.section}>
        <h2 className={formKit.sectionTitle}>Before you submit, please confirm</h2>
        <div className={styles.consentList}>
          <label className={styles.consentItem}>
            <input
              type="checkbox"
              className={styles.consentCheckbox}
              checked={consent.data}
              onChange={e => setConsentField('data', e.target.checked)}
            />
            <span className={styles.consentText}>
              I agree to {orgName} collecting and using this player&apos;s information to run tryouts, manage the team, and keep coaching and development records
              {privacyPolicyHref ? (
                <>
                  , as described in their{' '}
                  <a
                    href={privacyPolicyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.consentLink}
                  >
                    privacy policy
                  </a>
                  .
                </>
              ) : (
                '.'
              )}
            </span>
          </label>

          <label className={styles.consentItem}>
            <input
              type="checkbox"
              className={styles.consentCheckbox}
              checked={consent.eligibility}
              onChange={e => setConsentField('eligibility', e.target.checked)}
            />
            <span className={styles.consentText}>
              I&apos;m this player&apos;s parent or legal guardian, and they&apos;re eligible to try out.
            </span>
          </label>
        </div>
        {errors.consent && <p className={formKit.errorMsg} style={{ marginTop: '0.6rem' }}>{errors.consent}</p>}

        {/* ⚠ THIS SENTENCE IS A PROMISE TO A FAMILY — keep it matched to what actually sends.
            It used to read "We'll email you about this application either way — offers, waitlist
            and roster updates", which stopped being true on 2026-08-26 when tryout decision emails
            were removed entirely (owner ruling: an offer is a custom letter the club writes, so
            the platform sends nothing on a coach's behalf). The confirmation receipt below is now
            the ONLY email this form causes. The receipt itself is transactional and was never
            something a family should have to "consent" to in order to apply (CASL unbundling,
            2026-07-30) — which is why it still sits outside the optional marketing box. */}
        <p className={styles.consentText} style={{ display: 'block', margin: '0.8rem 0 0' }}>
          We&apos;ll email you a confirmation that this application was received. Any news about a
          spot comes from {orgName} directly.
        </p>

        {/* Genuine MARKETING consent, optional and unchecked — club news, not application status. */}
        <div className={styles.consentList} style={{ marginTop: '0.8rem' }}>
          <label className={styles.consentItem}>
            <input
              type="checkbox"
              className={styles.consentCheckbox}
              checked={consent.email}
              onChange={e => setConsentField('email', e.target.checked)}
            />
            <span className={styles.consentText}>
              <strong>Optional:</strong> send me {orgName} news and future-season announcements by email.
            </span>
          </label>
        </div>
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div>
        {globalError && <div className={formKit.globalError}>{globalError}</div>}
        <button type="submit" className={formKit.submitBtn} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit tryout application'}
        </button>
      </div>

    </form>
  );
}
