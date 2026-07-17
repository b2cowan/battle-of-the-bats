'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import styles from './register.module.css';

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
    // Clear the consent error only once all three are actually confirmed — un-ticking a box
    // should not dismiss the "please confirm" message.
    if (next.data && next.email && next.eligibility) clearFieldError('consent');
  }

  function clearFieldError(field: string) {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      clearFieldError(field);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setErrors({});

    if (!consent.data || !consent.email || !consent.eligibility) {
      setErrors({ consent: 'Please confirm the three boxes above before submitting.' });
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
      <div className={styles.successPanel}>
        <div className={styles.successIcon}>
          <CheckCircle size={28} />
        </div>
        <h2 className={styles.successTitle}>Application Received</h2>
        <p className={styles.successBody}>
          We&apos;ve received <strong>{success.playerName}</strong>&apos;s tryout application
          for <strong>{teamName}</strong> — <strong>{yearName}</strong>. A confirmation email
          has been sent to <strong>{success.guardianEmail}</strong>. Our coaching staff will
          be in touch.
        </p>
        <div className={styles.refBox}>
          Reference: <span className={styles.refCode}>{success.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>

      {/* ── Section 1: Player Information ───────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Player Information</h2>
        <div className={styles.fieldRow}>
          <div>
            <label className={styles.label}>
              First Name <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.playerFirstName ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={form.playerFirstName}
              onChange={set('playerFirstName')}
              maxLength={80}
              autoComplete="given-name"
            />
            {errors.playerFirstName && <p className={styles.errorMsg}>{errors.playerFirstName}</p>}
          </div>
          <div>
            <label className={styles.label}>
              Last Name <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.playerLastName ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={form.playerLastName}
              onChange={set('playerLastName')}
              maxLength={80}
              autoComplete="family-name"
            />
            {errors.playerLastName && <p className={styles.errorMsg}>{errors.playerLastName}</p>}
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div>
            <label className={styles.label}>
              Date of Birth <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.playerDateOfBirth ? ` ${styles.inputError}` : ''}`}
              type="date"
              value={form.playerDateOfBirth}
              onChange={set('playerDateOfBirth')}
            />
            {errors.playerDateOfBirth && <p className={styles.errorMsg}>{errors.playerDateOfBirth}</p>}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Additional Notes</label>
          <textarea
            className={styles.textarea}
            value={form.playerNotes}
            onChange={set('playerNotes')}
            maxLength={500}
            rows={3}
            placeholder="Position preference, experience level, any relevant notes…"
          />
          <p className={styles.hint}>Optional. Max 500 characters.</p>
        </div>
      </div>

      {/* ── Section 2: Guardian Information ─────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Parent / Guardian Information</h2>
        <div className={styles.fieldRow}>
          <div>
            <label className={styles.label}>
              First Name <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.guardianFirstName ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={form.guardianFirstName}
              onChange={set('guardianFirstName')}
              maxLength={80}
              autoComplete="given-name"
            />
            {errors.guardianFirstName && <p className={styles.errorMsg}>{errors.guardianFirstName}</p>}
          </div>
          <div>
            <label className={styles.label}>
              Last Name <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.guardianLastName ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={form.guardianLastName}
              onChange={set('guardianLastName')}
              maxLength={80}
              autoComplete="family-name"
            />
            {errors.guardianLastName && <p className={styles.errorMsg}>{errors.guardianLastName}</p>}
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div>
            <label className={styles.label}>
              Email Address <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input}${errors.guardianEmail ? ` ${styles.inputError}` : ''}`}
              type="email"
              value={form.guardianEmail}
              onChange={set('guardianEmail')}
              maxLength={200}
              autoComplete="email"
            />
            {errors.guardianEmail && <p className={styles.errorMsg}>{errors.guardianEmail}</p>}
          </div>
          <div>
            <label className={styles.label}>Phone Number</label>
            <input
              className={styles.input}
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
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Before you submit, please confirm</h2>
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
              checked={consent.email}
              onChange={e => setConsentField('email', e.target.checked)}
            />
            <span className={styles.consentText}>
              I agree to receive emails from {orgName} about this tryout and the team.
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
        {errors.consent && <p className={styles.errorMsg} style={{ marginTop: '0.6rem' }}>{errors.consent}</p>}
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div>
        {globalError && <div className={styles.globalError}>{globalError}</div>}
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Tryout Application'}
        </button>
      </div>

    </form>
  );
}
