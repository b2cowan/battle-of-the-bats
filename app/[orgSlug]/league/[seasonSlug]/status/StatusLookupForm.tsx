'use client';

import { useState } from 'react';

const STATUS_LABEL: Record<string, string> = {
  active:         'Confirmed',
  pending_review: 'Pending Review',
  waitlisted:     'Waitlisted',
};

const STATUS_COLOR: Record<string, string> = {
  active:         '#4ade80',
  pending_review: '#f59e0b',
  waitlisted:     '#94a3b8',
};

type Registration = {
  ref: string;
  status: string;
  playerFirstName: string;
  playerLastName: string;
  divisionName: string;
  waitlistPosition: number | null;
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
  color: '#f1f5f9', fontSize: '0.95rem', padding: '0.6rem 0.75rem',
  outline: 'none', minWidth: 0, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem',
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
          <input
            id="status-ref"
            type="text"
            value={refCode}
            onChange={e => setRefCode(e.target.value)}
            placeholder="e.g. 069806EA"
            required
            maxLength={12}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          />
          <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', margin: '0.4rem 0 0' }}>
            The 8-character code on your confirmation screen and in your registration email.
          </p>
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          style={{
            background: '#f1f5f9', color: '#0a0a0a', border: 'none',
            borderRadius: '6px', fontWeight: 700, fontSize: '0.88rem',
            padding: '0.6rem 1.25rem', cursor: state === 'loading' ? 'default' : 'pointer',
            opacity: state === 'loading' ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {state === 'loading' ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {state === 'error' && (
        <div style={{
          padding: '1rem 1.25rem', marginBottom: '1.5rem',
          border: '1px solid rgba(245,158,11,0.35)', borderRadius: '10px',
          background: 'rgba(245,158,11,0.08)',
        }}>
          <p style={{ fontSize: '0.85rem', color: '#fcd34d', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      {state === 'done' && registrations.length === 0 && (
        <div style={{
          padding: '2rem', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            We couldn&apos;t find a registration for that email and reference code.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.75rem' }}>
            Double-check both against your confirmation email, or{' '}
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>
                contact us
              </a>
            ) : 'contact your organization admin'}.
          </p>
        </div>
      )}

      {state === 'done' && registrations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {registrations.map(r => (
            <div key={r.ref} style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f0f0' }}>
                  {r.playerFirstName} {r.playerLastName}
                </div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', padding: '0.25rem 0.6rem', borderRadius: '4px',
                  background: `${STATUS_COLOR[r.status] ?? '#94a3b8'}22`,
                  color: STATUS_COLOR[r.status] ?? '#94a3b8',
                  border: `1px solid ${STATUS_COLOR[r.status] ?? '#94a3b8'}55`,
                  whiteSpace: 'nowrap',
                }}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                {r.divisionName}
                {r.status === 'waitlisted' && r.waitlistPosition != null && (
                  <span style={{ marginLeft: '0.5rem', color: 'rgba(255,255,255,0.35)' }}>
                    · Waitlist position #{r.waitlistPosition}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>
                Ref: {r.ref}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
