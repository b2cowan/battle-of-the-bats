'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Mail, Send, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../house-league.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  sentAt: string;
  subject: string;
  audience: string;
  countSent: number;
  countSkipped: number;
}

type Audience = 'all' | 'waitlist' | 'pending';

const AUDIENCE_OPTIONS: { value: Audience; label: string; desc: string }[] = [
  { value: 'all',      label: 'All active registrants', desc: 'Everyone with an active status in this season' },
  { value: 'waitlist', label: 'Waitlist',                desc: 'Registrants currently on the waitlist' },
  { value: 'pending',  label: 'Pending review',         desc: 'Registrants awaiting admin approval' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildPayload(subject: string, message: string, audience: Audience) {
  if (audience === 'all')      return { subject, message, scope: 'all' };
  if (audience === 'waitlist') return { subject, message, scope: 'status', status: 'waitlist' };
  return                              { subject, message, scope: 'status', status: 'pending' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const isAdmin = userRole === 'owner' || userRole === 'league_admin';

  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [preview,  setPreview]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number; skipped: number } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const [log,        setLog]        = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  const loadLog = useCallback(async () => {
    if (!seasonId) return;
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}/email`);
      const data = await res.json();
      setLog(data.log ?? []);
    } catch {
      setLog([]);
    } finally {
      setLogLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (currentOrg && seasonId) loadLog();
  }, [currentOrg, seasonId, loadLog]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload(subject, message, audience)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setResult({ sent: data.sent, skipped: data.skipped });
      setPreview(false);
      setSubject('');
      setMessage('');
      setAudience('all');
      await loadLog();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_house_league')) {
    return (
      <div className={styles.accessDenied}>
        <Mail size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the House League module.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.accessDenied}>
        <Mail size={32} />
        <h2>Admin Only</h2>
        <p>Only league admins and owners can send notifications.</p>
      </div>
    );
  }

  const selectedAudience = AUDIENCE_OPTIONS.find(o => o.value === audience)!;

  // ── Preview mode ─────────────────────────────────────────────────────────────

  if (preview) {
    return (
      <div className={styles.page}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setPreview(false)}
            style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
          >
            <ArrowLeft size={13} /> Back to compose
          </button>
        </div>

        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className={styles.headerIcon}><Mail size={20} /></div>
            <div>
              <h1 className={styles.pageTitle}>Preview Email</h1>
              <p className={styles.pageSub}>To: {selectedAudience.label}</p>
            </div>
          </div>
        </div>

        {/* Email preview */}
        <div style={{
          background: '#1a1a2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          maxWidth: '600px',
        }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.25rem' }}>FROM</div>
            <div style={{ fontSize: '0.9rem' }}>FieldLogicHQ — {currentOrg?.name}</div>
          </div>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.25rem' }}>SUBJECT</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{subject}</div>
          </div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.85)' }}>
            {message}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
            Sent by {currentOrg?.name} via FieldLogicHQ
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Send size={15} />
            {sending ? 'Sending…' : `Send to ${selectedAudience.label}`}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPreview(false)}
            disabled={sending}
          >
            Back
          </button>
        </div>

        {error && (
          <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.75rem' }}>{error}</p>
        )}
      </div>
    );
  }

  // ── Compose mode ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={`${base}/house-league/seasons/${seasonId}/registrations`}
          style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
        >
          ← Registrations
        </Link>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Mail size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Send Notification</h1>
            <p className={styles.pageSub}>Email registrants for this season</p>
          </div>
        </div>
      </div>

      {result && (
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '0.4rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.88rem',
        }}>
          Email sent — {result.sent} delivered
          {result.skipped > 0 && `, ${result.skipped} skipped (no email on file)`}.
        </div>
      )}

      {/* Compose form */}
      <div style={{ maxWidth: '600px' }}>
        {/* Audience selector */}
        <div className={styles.field} style={{ marginBottom: '1.25rem' }}>
          <label className={styles.label}>Recipients</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {AUDIENCE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${audience === opt.value ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  background: audience === opt.value ? 'rgba(59,130,246,0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={audience === opt.value}
                  onChange={() => setAudience(opt.value)}
                  style={{ marginTop: '0.1rem', accentColor: 'var(--blueprint-blue)' }}
                />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="notif-subject">Subject</label>
          <input
            id="notif-subject"
            className={styles.input}
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Schedule update for this week"
            maxLength={200}
          />
        </div>

        {/* Message */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="notif-body">Message</label>
          <textarea
            id="notif-body"
            className={styles.textarea}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            placeholder="Write your message here…"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!subject.trim() || !message.trim()}
          onClick={() => setPreview(true)}
        >
          Preview →
        </button>
      </div>

      {/* Sent history */}
      <div style={{ marginTop: '3rem' }}>
        <div className={styles.sectionHeader} style={{ marginBottom: '1rem' }}>
          <span className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={15} /> Sent History
          </span>
        </div>

        {logLoading ? (
          <p className={styles.muted}>Loading…</p>
        ) : log.length === 0 ? (
          <p className={styles.muted}>No emails sent for this season yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {['Date', 'Subject', 'Audience', 'Sent', 'Skipped'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{formatDateTime(entry.sentAt)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{entry.subject}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.6)' }}>{entry.audience}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{entry.countSent}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: entry.countSkipped > 0 ? 'rgba(255,255,255,0.4)' : 'inherit' }}>{entry.countSkipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
