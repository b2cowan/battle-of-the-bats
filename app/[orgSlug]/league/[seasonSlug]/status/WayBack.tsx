'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FAMILY_HOME_WORDS } from '@/lib/family-home-words';

const W = FAMILY_HOME_WORDS.wayBack;
const soft: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--club-soft)', margin: 0 };
const link: React.CSSProperties = {
  color: 'var(--club-ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2,
  background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer',
};

/**
 * THE WAY BACK TO THE APP on the emailed "Your sign-up" page (Signed-in family accounts Stage 4a, Part 6.6; drawing 4.1),
 * shown only once a child on the sign-up is on a team, and only while the guardian tier is on. Two ordinary links: the
 * ordinary sign-in, and one that emails a fresh invitation to the address on the sign-up (one answer either way). The
 * emailed link itself never signs anyone in and never becomes an account.
 */
export default function WayBack({ kids, token }: { kids: string[]; token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'tooMany'>('idle');

  async function send() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/family/signup-invitation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      setState(res.status === 429 ? 'tooMany' : res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <p style={soft}>
        {W.joinedLead(kids)}
        <Link href={`/auth/login?next=${encodeURIComponent('/family')}`} style={link}>{W.signIn}</Link>
      </p>
      {state === 'sent' ? (
        <p style={soft} role="status">{W.sent}</p>
      ) : (
        <p style={soft}>
          {W.notYetLead}
          <button type="button" style={link} onClick={() => void send()} disabled={state === 'sending'}>
            {state === 'sending' ? W.sending : W.emailMe}
          </button>
        </p>
      )}
      {(state === 'failed' || state === 'tooMany') && (
        <p style={{ ...soft, color: 'var(--danger)' }} role="alert">{state === 'tooMany' ? W.tooMany : W.failed}</p>
      )}
    </div>
  );
}
