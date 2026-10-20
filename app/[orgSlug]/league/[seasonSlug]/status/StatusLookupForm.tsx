'use client';

import { useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';

const STATUS_LABEL: Record<string, string> = {
  active:         'Confirmed',
  pending_review: 'Pending review',
  waitlisted:     'Waitlisted',
};

type Registration = {
  ref: string;
  status: string;
  playerFirstName: string;
  playerLastName: string;
  divisionName: string;
  waitlistPosition: number | null;
};

// Field, label and button faces are the club frame's (Club Tier Stage 4b-1): 44px fields with the form-field border,
// 14px/600 labels, the club's fill on the one button.
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--club-card)',
  border: '1px solid var(--club-field)', borderRadius: '8px',
  color: 'var(--club-text)', font: '400 1rem var(--club-text-face)',
  minHeight: '44px', padding: '0 0.75rem',
  outline: 'none', minWidth: 0, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--club-text)', marginBottom: '0.4rem',
};

export default function StatusLookupForm({
  orgSlug,
  seasonSlug,
  contactEmail,
}: {
  orgSlug: string;
  seasonSlug: string;
  contactEmail: string | null;
}) {
  const [email, setEmail] = useState('');
  const [refCode, setRefCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/status-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, refCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }
      setRegistrations(Array.isArray(data.registrations) ? data.registrations : []);
      setState('done');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor="status-email">Guardian email address</label>
          <input
            id="status-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor="status-ref">Reference code</label>
          {/* A reference code is read off a confirmation and typed back, so the field shows capitals whichever way it
              is typed; the face is the club's text face, not a typewriter's. */}
          <input
            id="status-ref"
            type="text"
            value={refCode}
            onChange={e => setRefCode(e.target.value)}
            placeholder="e.g. 069806EA"
            required
            maxLength={12}
            style={{ ...inputStyle, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
          />
          <p style={{ fontSize: '0.875rem', color: 'var(--club-soft)', margin: '0.4rem 0 0' }}>
            The 8-character code on your confirmation screen and in your registration email.
          </p>
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`${kit.btn} ${kit.btnPrimary}`}
          style={{ whiteSpace: 'nowrap' }}
        >
          {state === 'loading' ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {state === 'error' && (
        <div
          className={kit.card}
          style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderColor: 'var(--danger)' }}
        >
          <p style={{ fontSize: '0.875rem', color: 'var(--danger)', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      {state === 'done' && registrations.length === 0 && (
        <div className={kit.card} style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', color: 'var(--club-text)', margin: 0 }}>
            We couldn&apos;t find a registration for that email and reference code.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--club-soft)', marginTop: '0.75rem' }}>
            Double-check both against your confirmation email, or{' '}
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} style={{ color: 'var(--club-ink)', textDecoration: 'underline' }}>
                contact us
              </a>
            ) : 'contact your organization admin'}.
          </p>
        </div>
      )}

      {state === 'done' && registrations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {registrations.map(r => (
            <div key={r.ref} className={kit.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--club-text)' }}>
                  {r.playerFirstName} {r.playerLastName}
                </div>
                <span className={`${kit.chip} ${r.status === 'active' ? kit.chipOk : kit.chipNeutral}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)' }}>
                {r.divisionName}
                {r.status === 'waitlisted' && r.waitlistPosition != null && (
                  <span style={{ marginLeft: '0.5rem' }}>
                    · Waitlist position #{r.waitlistPosition}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--club-dim)', marginTop: '0.5rem' }}>
                Reference: {r.ref}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
