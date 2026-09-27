'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Mail, Send, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import HelpCallout from '@/components/help/HelpCallout';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useAdminKit, useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_LINE, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
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
  // Admin Design Continuity slice 2: the kit's version while the switch is on; today's while it is off.
  const kit = useAdminKit();
  const kx = useKitStyle();
  const { seasonId } = useParams<{ seasonId: string }>();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  // J3-012: every /api/admin fetch must carry the org slug so the server resolves the URL's org.
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const isAdmin = userRole === 'owner' || userRole === 'league_admin';

  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [preview,  setPreview]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number; skipped: number; suppressed: number } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const [log,        setLog]        = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  const loadLog = useCallback(async () => {
    if (!seasonId) return;
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}/email${orgQuery}`);
      const data = await res.json();
      setLog(data.log ?? []);
    } catch {
      setLog([]);
    } finally {
      setLogLoading(false);
    }
  }, [seasonId, orgQuery]);

  useEffect(() => {
    if (currentOrg && seasonId) loadLog();
  }, [currentOrg, seasonId, loadLog]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/email${orgQuery}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload(subject, message, audience)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setResult({ sent: data.sent, skipped: data.skipped, suppressed: data.suppressed ?? 0 });
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
            style={kx({ fontSize: '0.82rem', color: 'var(--white-40)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }, { ...KIT_INK.secondary, fontWeight: 600 })}
          >
            <ArrowLeft size={13} /> Back to compose
          </button>
        </div>

        {/* On the kit the header loses its "To:" line (F3); the recipients move into the preview
            itself, as its first row — where a reader looks for who an email is addressed to. */}
        <AdminPageHeader
          eyebrow="House league"
          title="Preview email"
          legacy={
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className={styles.headerIcon}><Mail size={20} /></div>
            <div>
              <h1 className={styles.pageTitle}>Preview Email</h1>
              <p className={styles.pageSub}>To: {selectedAudience.label}</p>
            </div>
          </div>
        </div>
          }
        />

        {/* Email preview */}
        <div style={kx({
          background: '#1a1a2e',
          border: '1px solid var(--white-10)',
          borderRadius: '2px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          maxWidth: '600px',
        }, { ...KIT_SURFACE.card, borderRadius: '12px' })}>
          {kit && (
            <div style={{ borderBottom: KIT_LINE, paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', ...KIT_INK.tertiary, marginBottom: '0.25rem' }}>TO</div>
              <div style={{ fontSize: '0.9rem' }}>{selectedAudience.label}</div>
            </div>
          )}
          <div style={{ borderBottom: '1px solid var(--white-10)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={kx({ fontSize: '0.75rem', color: 'var(--white-35)', marginBottom: '0.25rem' }, KIT_INK.tertiary)}>FROM</div>
            <div style={{ fontSize: '0.9rem' }}>FieldLogicHQ — {currentOrg?.name}</div>
          </div>
          <div style={{ borderBottom: '1px solid var(--white-10)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={kx({ fontSize: '0.75rem', color: 'var(--white-35)', marginBottom: '0.25rem' }, KIT_INK.tertiary)}>SUBJECT</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{subject}</div>
          </div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--white-80)' }}>
            {message}
          </div>
          <div style={kx({ borderTop: '1px solid var(--white-10)', paddingTop: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--white-30)' }, KIT_INK.tertiary)}>
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
      {/* On the kit the way back to Registrations is the header's leading corner (the same door). */}
      {!kit && (
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={`${base}/house-league/seasons/${seasonId}/registrations`}
          style={{ fontSize: '0.82rem', color: 'var(--white-40)', textDecoration: 'none' }}
        >
          ← Registrations
        </Link>
      </div>
      )}

      <AdminPageHeader
        eyebrow="House league"
        title="Send notification"
        backTo={{ href: `${base}/house-league/seasons/${seasonId}/registrations`, label: 'Registrations' }}
        legacy={
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Mail size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Send Notification</h1>
            <p className={styles.pageSub}>Email registrants for this season</p>
          </div>
        </div>
      </div>
        }
      />

      {result && (
        <div style={kx({
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '2px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.88rem',
        }, KIT_SURFACE.good)}>
          {/* Every registrant in the audience must be accounted for here. Delivered + skipped
              stopped summing to the audience the moment opted-out families were split into their
              own bucket server-side, and an admin who cannot see where the rest went assumes a
              bug and re-sends. Counts only — never which families opted out. */}
          Email sent — {result.sent} delivered
          {result.suppressed > 0 && `, ${result.suppressed} not sent (unsubscribed)`}
          {result.skipped > 0 && `, ${result.skipped} skipped (no email on file)`}.
        </div>
      )}

      {/* Compose form */}
      <div style={{ maxWidth: '600px' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <HelpCallout
            variant="tip"
            title="Emails go out immediately and cannot be recalled"
            body="Emails go to all registrants in the selected audience. Preview carefully — there is no undo once sent."
          />
        </div>

        {/* Audience selector */}
        <div className={styles.field} style={{ marginBottom: '1.25rem' }}>
          <label className={styles.label}>Recipients</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {AUDIENCE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={kx({
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '2px',
                  border: `1px solid ${audience === opt.value ? 'rgba(var(--info-rgb),0.6)' : 'var(--white-8)'}`,
                  background: audience === opt.value ? 'rgba(var(--info-rgb),0.08)' : 'transparent',
                  cursor: 'pointer',
                }, audience === opt.value ? KIT_SURFACE.chosen : KIT_SURFACE.option)}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={audience === opt.value}
                  onChange={() => setAudience(opt.value)}
                  style={kx({ marginTop: '0.1rem', accentColor: 'var(--blueprint-blue)' }, { accentColor: 'var(--home-olive)' })}
                />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{opt.label}</div>
                  <div style={kx({ fontSize: '0.78rem', color: 'var(--white-40)' }, KIT_INK.tertiary)}>{opt.desc}</div>
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
                <tr style={kx({ borderBottom: '1px solid var(--white-10)' }, { borderBottom: '1px solid var(--home-line-strong)' })}>
                  {['Date', 'Subject', 'Audience', 'Sent', 'Skipped'].map(h => (
                    <th key={h} style={kx({ textAlign: 'left', padding: '0.4rem 0.75rem', color: 'var(--white-40)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, KIT_INK.head)}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} style={kx({ borderBottom: '1px solid var(--white-5)' }, { borderBottom: KIT_LINE })}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--white-50)', whiteSpace: 'nowrap' }}>{formatDateTime(entry.sentAt)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{entry.subject}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--white-60)' }}>{entry.audience}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{entry.countSent}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: entry.countSkipped > 0 ? 'var(--white-40)' : 'inherit' }}>{entry.countSkipped}</td>
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
