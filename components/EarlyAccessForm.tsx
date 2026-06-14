'use client';

import { FormEvent, useState } from 'react';
import styles from './EarlyAccessForm.module.css';

const PLAN_OPTIONS = [
  { value: 'league', label: 'League Plus' },
  { value: 'club', label: 'Club' },
] as const;

const FEATURE_OPTIONS = [
  { value: 'house_league', label: 'House League' },
  { value: 'registration', label: 'Registration' },
  { value: 'public_site', label: 'Public site' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'rep_teams', label: 'Rep Teams' },
  { value: 'coach_portal', label: 'Coach portal' },
  { value: 'communications', label: 'Communications' },
] as const;

type Status = 'idle' | 'submitting' | 'success' | 'error';

type EarlyAccessFormProps = {
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
};

export default function EarlyAccessForm({
  initialPlanInterest = ['league'],
  initialFeaturesInterested = ['house_league'],
}: EarlyAccessFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [planInterest, setPlanInterest] = useState<string[]>(initialPlanInterest);
  const [featuresInterested, setFeaturesInterested] = useState<string[]>(initialFeaturesInterested);
  const [releaseNotificationsConsent, setReleaseNotificationsConsent] = useState(true);

  function toggleValue(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setStatus('submitting');
    setError('');

    const form = new FormData(formEl);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      organizationName: String(form.get('organizationName') ?? ''),
      role: String(form.get('role') ?? ''),
      sports: String(form.get('sports') ?? ''),
      notes: String(form.get('notes') ?? ''),
      website: String(form.get('website') ?? ''),
      planInterest,
      featuresInterested,
      releaseNotificationsConsent,
      sourcePath: `${window.location.pathname}${window.location.hash}`,
    };

    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save your request.');
      setStatus('success');
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your request.');
      setStatus('error');
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input className={styles.honeypot} name="website" tabIndex={-1} autoComplete="off" />

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Name</span>
          <input name="name" required maxLength={120} autoComplete="name" />
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" required type="email" maxLength={180} autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span>Organization</span>
          <input name="organizationName" required maxLength={160} autoComplete="organization" />
        </label>
        <label className={styles.field}>
          <span>Your role</span>
          <input name="role" maxLength={120} placeholder="President, registrar, treasurer..." />
        </label>
      </div>

      <label className={styles.field}>
        <span>Sport or program</span>
        <input name="sports" maxLength={160} placeholder="Softball, hockey, soccer, baseball..." />
      </label>

      <fieldset className={styles.choiceGroup}>
        <legend>Plans interested in</legend>
        <div className={styles.choiceGrid}>
          {PLAN_OPTIONS.map(option => (
            <label key={option.value} className={styles.choice}>
              <input
                type="checkbox"
                checked={planInterest.includes(option.value)}
                onChange={() => toggleValue(option.value, planInterest, setPlanInterest)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.choiceGroup}>
        <legend>Features interested in</legend>
        <div className={styles.choiceGrid}>
          {FEATURE_OPTIONS.map(option => (
            <label key={option.value} className={styles.choice}>
              <input
                type="checkbox"
                checked={featuresInterested.includes(option.value)}
                onChange={() => toggleValue(option.value, featuresInterested, setFeaturesInterested)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span>What would make this useful for you?</span>
        <textarea name="notes" maxLength={1200} rows={4} />
      </label>

      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={releaseNotificationsConsent}
          onChange={event => setReleaseNotificationsConsent(event.target.checked)}
        />
        <span>Send me feature and release updates for the areas I selected.</span>
      </label>

      {error && <p className={styles.error}>{error}</p>}
      {status === 'success' && (
        <p className={styles.success}>You&apos;re on the early-access list. We&apos;ll follow up when these workflows are ready.</p>
      )}

      <button className={styles.submit} type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Saving...' : 'Join Early Access'}
      </button>
    </form>
  );
}
