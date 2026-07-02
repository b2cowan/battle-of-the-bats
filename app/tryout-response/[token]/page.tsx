'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * No-account guardian offer-response page (Phase 2B.5). The URL token is the only credential.
 * GET is read-only (safe for email link scanners); Accept/Decline is an explicit button → POST.
 * Recording a response does NOT add the player to the roster — the coach confirms that (D1).
 */

interface OfferView {
  state: 'open' | 'expired' | 'responded' | 'closed' | 'invalid';
  response: 'accepted' | 'declined' | null;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  orgName: string | null;
  orgLogoUrl: string | null;
  respondBy: string | null;
}

const C = {
  bg: '#0b0f14', card: '#111827', text: '#F1F5F9', dim: 'rgba(241,245,249,0.6)',
  faint: 'rgba(241,245,249,0.4)', line: 'rgba(30,58,138,0.25)', lime: '#D9F99D',
};

export default function TryoutResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const intent = searchParams.get('r'); // 'accept' | 'decline' — emphasis only; click still required

  const [view, setView] = useState<OfferView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<null | 'accept' | 'decline'>(null);
  const [done, setDone] = useState<null | 'accepted' | 'declined'>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tryout-response/${token}`);
      const data = await res.json();
      setView(res.ok ? data : { ...data, state: data.state ?? 'invalid' });
    } catch {
      setView({ state: 'invalid' } as OfferView);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function respond(response: 'accept' | 'decline') {
    if (submitting) return;
    setSubmitting(response);
    setError(null);
    try {
      const res = await fetch(`/api/tryout-response/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'This link can no longer be used.');
      setDone(response === 'accept' ? 'accepted' : 'declined');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please contact the coaching staff.');
    } finally {
      setSubmitting(null);
    }
  }

  const shell = (inner: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 460, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '2rem 1.75rem' }}>
        {inner}
      </div>
    </div>
  );

  if (loading) return shell(<p style={{ color: C.dim, margin: 0, textAlign: 'center' }}>Loading…</p>);
  if (!view || view.state === 'invalid') {
    return shell(<>
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>Link not found</h1>
      <p style={{ color: C.dim, margin: 0, lineHeight: 1.6 }}>This response link is no longer valid. If you have questions about a tryout offer, please contact the coaching staff directly.</p>
    </>);
  }

  const player = `${view.playerFirstName} ${view.playerLastName}`.trim();
  const program = [view.teamName, view.yearName].filter(Boolean).join(' — ');
  const brand = view.orgName ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', paddingBottom: '1.1rem', borderBottom: `1px solid ${C.line}` }}>
      {view.orgLogoUrl && <img src={view.orgLogoUrl} alt="" style={{ height: 30, width: 'auto', borderRadius: 4 }} />}
      <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{view.orgName}</span>
    </div>
  ) : null;

  // Terminal states
  if (done || view.state === 'responded') {
    const answer = done ?? view.response;
    return shell(<>
      {brand}
      <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.75rem', color: answer === 'accepted' ? C.lime : C.text }}>
        {answer === 'accepted' ? 'Offer accepted' : 'Response recorded'}
      </h1>
      <p style={{ color: C.dim, margin: 0, lineHeight: 1.7 }}>
        {answer === 'accepted'
          ? <>Thank you — we&apos;ve let the coaching staff know that <strong style={{ color: C.text }}>{player}</strong> is accepting the offer for <strong style={{ color: C.text }}>{program}</strong>. They&apos;ll confirm the roster spot and be in touch with next steps.</>
          : <>Thank you for letting us know. We&apos;ve recorded that <strong style={{ color: C.text }}>{player}</strong> won&apos;t be taking the offer for <strong style={{ color: C.text }}>{program}</strong> this time. We appreciate their interest.</>}
      </p>
    </>);
  }

  if (view.state === 'expired') {
    return shell(<>
      {brand}
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>This offer has expired</h1>
      <p style={{ color: C.dim, margin: 0, lineHeight: 1.7 }}>The response window for <strong style={{ color: C.text }}>{player}</strong>&apos;s offer to <strong style={{ color: C.text }}>{program}</strong> has passed. Please contact the coaching staff if you&apos;d still like to discuss it.</p>
    </>);
  }

  if (view.state === 'closed') {
    return shell(<>
      {brand}
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>This offer is no longer open</h1>
      <p style={{ color: C.dim, margin: 0, lineHeight: 1.7 }}>There&apos;s nothing to respond to here right now. If you have questions about <strong style={{ color: C.text }}>{player}</strong>&apos;s tryout, please reach out to the coaching staff.</p>
    </>);
  }

  // Open — Accept / Decline
  const acceptPrimary = intent !== 'decline';
  return shell(<>
    {brand}
    <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem', color: C.lime }}>You&apos;ve received an offer</h1>
    <p style={{ margin: '0 0 0.35rem', lineHeight: 1.6 }}><strong>{player}</strong> has been offered a spot on <strong>{program}</strong>.</p>
    {view.respondBy && <p style={{ color: C.faint, fontSize: '0.85rem', margin: '0 0 1.5rem' }}>Please respond by <strong style={{ color: C.dim }}>{view.respondBy}</strong>.</p>}

    {error && <p style={{ color: '#fbbf24', fontSize: '0.85rem', margin: '0 0 1rem' }}>{error}</p>}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
      <button
        type="button" onClick={() => respond('accept')} disabled={!!submitting}
        style={{ padding: '0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem',
          background: acceptPrimary ? C.lime : 'transparent', color: acceptPrimary ? '#0b0f14' : C.lime,
          borderStyle: acceptPrimary ? 'none' : 'solid', borderWidth: acceptPrimary ? 0 : 1, borderColor: C.lime, opacity: submitting ? 0.6 : 1 }}
      >
        {submitting === 'accept' ? 'Sending…' : 'Accept the offer'}
      </button>
      <button
        type="button" onClick={() => respond('decline')} disabled={!!submitting}
        style={{ padding: '0.85rem', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
          background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, opacity: submitting ? 0.6 : 1 }}
      >
        {submitting === 'decline' ? 'Sending…' : 'Decline'}
      </button>
    </div>
    <p style={{ color: C.faint, fontSize: '0.78rem', margin: '1.25rem 0 0', lineHeight: 1.6 }}>
      No account needed. Your coach confirms the final roster spot after you respond.
    </p>
  </>);
}
