'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import styles from './register.module.css';

export interface DivisionWithCount {
  id: string;
  name: string;
  capacity: number | null;
  activeCount: number;
}

interface Props {
  orgSlug: string;
  orgName: string;
  seasonSlug: string;
  seasonName: string;
  waiverText: string | null;
  registrationFee: number | null;
  divisions: DivisionWithCount[];
}

interface FormState {
  divisionId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string;
  playerJerseyPref: string;
  playerPositionPref: string;
  playerNotes: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
  waiverAccepted: boolean;
}

interface SuccessResult {
  id: string;
  status: 'active' | 'pending_review' | 'waitlisted';
  waitlistPosition: number | null;
  playerName: string;
  divisionName: string;
  guardianEmail: string;
}

export default function RegisterForm({
  orgSlug,
  orgName,
  seasonSlug,
  seasonName,
  waiverText,
  registrationFee,
  divisions,
}: Props) {
  const singleDivision = divisions.length === 1;

  const [form, setForm] = useState<FormState>({
    divisionId: singleDivision ? divisions[0].id : '',
    playerFirstName: '',
    playerLastName: '',
    playerDateOfBirth: '',
    playerJerseyPref: '',
    playerPositionPref: '',
    playerNotes: '',
    guardianFirstName: '',
    guardianLastName: '',
    guardianEmail: '',
    guardianPhone: '',
    waiverAccepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessResult | null>(null);

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

  function setDivision(id: string) {
    setForm(prev => ({ ...prev, divisionId: id }));
    clearFieldError('divisionId');
  }

  function setWaiver(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, waiverAccepted: e.target.checked }));
    clearFieldError('waiverAccepted');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setErrors({});

    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisionId:         form.divisionId || undefined,
          playerFirstName:    form.playerFirstName,
          playerLastName:     form.playerLastName,
          playerDateOfBirth:  form.playerDateOfBirth || undefined,
          playerJerseyPref:   form.playerJerseyPref || undefined,
          playerPositionPref: form.playerPositionPref || undefined,
          playerNotes:        form.playerNotes || undefined,
          guardianFirstName:  form.guardianFirstName,
          guardianLastName:   form.guardianLastName,
          guardianEmail:      form.guardianEmail,
          guardianPhone:      form.guardianPhone || undefined,
          waiverAccepted:     form.waiverAccepted,
        }),
      });

      const data = await res.json();

      if (res.status === 400 && data.errors) {
        setErrors(data.errors);
        return;
      }

      if (!res.ok) {
        setGlobalError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      const division = divisions.find(d => d.id === form.divisionId) ?? divisions[0];
      setSuccess({
        id:               data.id,
        status:           data.status,
        waitlistPosition: data.waitlistPosition,
        playerName:       `${form.playerFirstName} ${form.playerLastName}`,
        divisionName:     division?.name ?? '',
        guardianEmail:    form.guardianEmail,
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
        <h2 className={styles.successTitle}>
          {success.status === 'active'         && 'Registration Approved!'}
          {success.status === 'pending_review'  && 'Registration Received'}
          {success.status === 'waitlisted'      && "You're on the Waitlist"}
        </h2>
        <p className={styles.successBody}>
          {success.status === 'active' && (
            <>
              <strong>{success.playerName}</strong>&apos;s registration for{' '}
              <strong>{seasonName}</strong> — {success.divisionName} has been approved.
              A confirmation email has been sent to <strong>{success.guardianEmail}</strong>.
            </>
          )}
          {success.status === 'pending_review' && (
            <>
              We&apos;ve received <strong>{success.playerName}</strong>&apos;s registration for{' '}
              <strong>{seasonName}</strong> — {success.divisionName}. An admin will review
              it shortly and we&apos;ll follow up at <strong>{success.guardianEmail}</strong>.
            </>
          )}
          {success.status === 'waitlisted' && (
            <>
              <strong>{success.playerName}</strong> has been added to the{' '}
              {success.divisionName} waitlist at position{' '}
              <strong>#{success.waitlistPosition}</strong>. We&apos;ll contact{' '}
              <strong>{success.guardianEmail}</strong> if a spot becomes available.
            </>
          )}
        </p>
        <div className={styles.refBox}>
          Reference: <span className={styles.refCode}>{success.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <p className={styles.successStatusLink}>
          <a href={`/${orgSlug}/league/${seasonSlug}/status?email=${encodeURIComponent(success.guardianEmail)}`}>
            Check registration status later →
          </a>
        </p>
        {(success.status === 'pending_review' || success.status === 'waitlisted') && (
          <div style={{ marginTop: '1.25rem' }}>
            <HelpCallout
              variant="info"
              title="What happens next"
              body="You'll receive an email at the address you provided once your registration is reviewed. Use the link above to check your status at any time — it updates in real time."
            />
          </div>
        )}
      </div>
    );
  }

  function divisionStatusLabel(d: DivisionWithCount): string {
    if (d.capacity == null) return 'Open — unlimited spots';
    const remaining = d.capacity - d.activeCount;
    if (remaining <= 0) return 'Waitlist only';
    return `Open — ${remaining} spot${remaining === 1 ? '' : 's'} remaining`;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>

      {/* ── Section 1: Division ──────────────────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Division</h2>
        {divisions.length === 0 ? (
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            No divisions are available for this season.
          </p>
        ) : singleDivision ? (
          <div className={`${styles.divisionOption} ${styles.divisionOptionSelected}`}>
            <div className={styles.divisionOptionLeft}>
              <div>
                <div className={styles.divisionOptionName}>{divisions[0].name}</div>
                <div className={styles.divisionCapacity}>
                  {divisionStatusLabel(divisions[0])}
                </div>
              </div>
            </div>
            {divisions[0].capacity != null && divisions[0].activeCount >= divisions[0].capacity && (
              <span className={styles.divisionWaitlistBadge}>Waitlist</span>
            )}
          </div>
        ) : (
          <>
            <div className={styles.divisionList}>
              {divisions.map(d => {
                const isFull     = d.capacity != null && d.activeCount >= d.capacity;
                const isSelected = form.divisionId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`${styles.divisionOption}${isSelected ? ` ${styles.divisionOptionSelected}` : ''}`}
                    onClick={() => setDivision(d.id)}
                  >
                    <div className={styles.divisionOptionLeft}>
                      <input
                        type="radio"
                        name="divisionId"
                        value={d.id}
                        checked={isSelected}
                        onChange={() => setDivision(d.id)}
                        className={styles.divisionRadio}
                      />
                      <div>
                        <div className={styles.divisionOptionName}>{d.name}</div>
                        <div className={styles.divisionCapacity}>
                          {divisionStatusLabel(d)}
                        </div>
                      </div>
                    </div>
                    {isFull && <span className={styles.divisionWaitlistBadge}>Waitlist</span>}
                  </div>
                );
              })}
            </div>
            {errors.divisionId && <p className={styles.errorMsg}>{errors.divisionId}</p>}
          </>
        )}
      </div>

      {/* ── Section 2: Player Information ───────────────────────────────── */}
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
            <label className={styles.label}>Date of Birth</label>
            <input
              className={styles.input}
              type="date"
              value={form.playerDateOfBirth}
              onChange={set('playerDateOfBirth')}
            />
          </div>
          <div>
            <label className={styles.label}>Jersey Number Preference</label>
            <input
              className={styles.input}
              type="text"
              value={form.playerJerseyPref}
              onChange={set('playerJerseyPref')}
              maxLength={3}
              placeholder="e.g. 12"
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Position Preference</label>
          <input
            className={styles.input}
            type="text"
            value={form.playerPositionPref}
            onChange={set('playerPositionPref')}
            maxLength={60}
            placeholder="e.g. Pitcher, Catcher, Shortstop"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Additional Notes</label>
          <textarea
            className={styles.textarea}
            value={form.playerNotes}
            onChange={set('playerNotes')}
            maxLength={500}
            rows={3}
            placeholder="Medical notes, experience level, special requests…"
          />
          <p className={styles.hint}>Optional. Max 500 characters.</p>
        </div>
      </div>

      {/* ── Section 3: Guardian Information ─────────────────────────────── */}
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

      {/* ── Section 4: Waiver (conditional) ─────────────────────────────── */}
      {waiverText && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Waiver &amp; Agreement</h2>
          <div className={styles.waiverBox}>{waiverText}</div>
          <div className={styles.checkRow}>
            <input
              type="checkbox"
              id="waiverAccepted"
              checked={form.waiverAccepted}
              onChange={setWaiver}
            />
            <label htmlFor="waiverAccepted">
              I have read and agree to the waiver and release of liability above.
            </label>
          </div>
          {errors.waiverAccepted && (
            <p className={styles.errorMsg} style={{ marginTop: '0.5rem' }}>
              {errors.waiverAccepted}
            </p>
          )}
        </div>
      )}

      {/* ── Section 5: Submit ────────────────────────────────────────────── */}
      <div>
        {registrationFee != null && (
          <p className={styles.feeNote}>
            Registration fee: <strong>${registrationFee.toFixed(2)}</strong> — payable separately to {orgName}.
          </p>
        )}
        {globalError && <div className={styles.globalError}>{globalError}</div>}
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Registration'}
        </button>
      </div>

    </form>
  );
}
