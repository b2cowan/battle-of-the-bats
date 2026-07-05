'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { UserCog, ChevronLeft, Trash2, Check, X, ShieldCheck } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import styles from '../rep-teams.module.css';

interface Caps {
  roster: 'off' | 'view';
  rosterPii: boolean; notes: boolean; announcementsSend: boolean; tryouts: boolean;
  money: 'off' | 'read' | 'write'; documents: 'off' | 'view' | 'manage';
  schedule: boolean; attendance: boolean; lineups: boolean;
}
interface Assistant {
  coachId: string; teamId: string; teamName: string; programYearName: string;
  displayName: string | null; email: string | null; capabilities: Caps;
}
interface PendingInvite {
  id: string; teamId: string; teamName: string | null; invitedEmail: string;
  status: 'pending' | 'pending_approval'; expiresAt: string;
}

// Additive: an assistant always has the coaching basics; show what's granted BEYOND them and
// anything turned OFF, so the summary never hides the base access.
function grantSummary(c: Caps): string {
  const grants: string[] = [];
  if (c.money === 'read') grants.push('money: view');
  if (c.money === 'write') grants.push('money: edit');
  if (c.rosterPii) grants.push('contacts & DOB');
  if (c.notes) grants.push('internal notes');
  if (c.documents === 'manage') grants.push('manage documents');
  if (c.announcementsSend) grants.push('send announcements');
  if (c.tryouts) grants.push('tryouts');
  const off: string[] = [];
  if (c.roster === 'off') off.push('roster');
  if (!c.schedule) off.push('schedule');
  if (!c.attendance) off.push('attendance');
  if (!c.lineups) off.push('lineups');
  if (c.documents === 'off') off.push('documents');
  if (grants.length === 0 && off.length === 0) return 'Coaching basics only';
  const segs = ['Coaching basics'];
  if (grants.length) segs.push('+ ' + grants.join(' · '));
  if (off.length) segs.push('(no ' + off.join(', ') + ')');
  return segs.join(' ');
}

export default function AdminAssistantCoachesPage() {
  const { currentOrg } = useOrg();
  const orgSlug = currentOrg?.slug ?? '';
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const base = `/${orgSlug}/admin/rep-teams`;

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [requireApproval, setRequireApproval] = useState(false);
  // The SERVER decides who may write (owner/admin) — trust its answer, not a client-derived role.
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingSetting, setSavingSetting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/assistant-coaches${orgQuery}`);
      if (!res.ok) throw new Error('Could not load assistant coaches.');
      const data = await res.json();
      setAssistants(data.assistants ?? []);
      setPending(data.pendingInvites ?? []);
      setRequireApproval(!!data.requireApproval);
      setCanWrite(!!data.canWrite);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assistant coaches.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, orgQuery]);

  useEffect(() => { void load(); }, [load]);

  async function toggleApproval(next: boolean) {
    setSavingSetting(true);
    setRequireApproval(next); // optimistic
    try {
      const res = await fetch(`/api/admin/org/coach-settings${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ require_assistant_approval: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRequireApproval(!next); // revert
    } finally {
      setSavingSetting(false);
    }
  }

  async function act(payload: Record<string, unknown>, busyKey: string) {
    setBusyId(busyKey);
    try {
      const res = await fetch(`/api/admin/rep-teams/assistant-coaches${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  }

  const approvalPending = pending.filter(p => p.status === 'pending_approval');
  const awaitingAccept = pending.filter(p => p.status === 'pending');

  return (
    <div className={styles.page}>
      <Link href={base} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--white-55)' }}>
        <ChevronLeft size={14} /> Rep Teams
      </Link>

      <div className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <UserCog size={22} />
          <div>
            <h1 className={styles.pageTitle}>Assistant coaches</h1>
            <p className={styles.pageSub}>Oversight across your teams. Head coaches invite and set their own assistants — this is your view + override.</p>
          </div>
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {/* Approval setting */}
      <section style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--white-45)', marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Require admin approval</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--white-55)', maxWidth: 560 }}>
                When on, a head coach&apos;s assistant invite waits for an admin to approve it here before the invite email is sent.
                Leave off (default) to let head coaches add their own assistants directly.
              </p>
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: canWrite ? 'pointer' : 'default', opacity: canWrite ? 1 : 0.6 }}>
            <input type="checkbox" checked={requireApproval} disabled={!canWrite || savingSetting}
              onChange={e => toggleApproval(e.target.checked)} />
            <span style={{ fontSize: '0.85rem' }}>{requireApproval ? 'On' : 'Off'}</span>
          </label>
        </div>
      </section>

      {loading && <p className={styles.muted}>Loading…</p>}

      {/* Awaiting approval */}
      {approvalPending.length > 0 && (
        <section style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10 }}>
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>Awaiting your approval ({approvalPending.length})</h2>
          {approvalPending.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-2, rgba(255,255,255,0.06))', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{p.invitedEmail}</span>
                <span style={{ color: 'var(--white-45)', fontSize: '0.85rem' }}> — {p.teamName ?? 'a team'}</span>
              </div>
              {canWrite && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-lime" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={busyId === p.id} onClick={() => act({ action: 'approve', inviteId: p.id }, p.id)}>
                    <Check size={13} /> Approve
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={busyId === p.id} onClick={() => act({ action: 'decline', inviteId: p.id }, p.id)}>
                    <X size={13} /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Invited, awaiting acceptance */}
      {awaitingAccept.length > 0 && (
        <section style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10 }}>
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>Invited — awaiting acceptance ({awaitingAccept.length})</h2>
          {awaitingAccept.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-2, rgba(255,255,255,0.06))', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{p.invitedEmail}</span>
                <span style={{ color: 'var(--white-45)', fontSize: '0.85rem' }}> — {p.teamName ?? 'a team'}</span>
              </div>
              {canWrite && (
                <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                  disabled={busyId === p.id} onClick={() => act({ action: 'decline', inviteId: p.id }, p.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Active assistants */}
      <section style={{ padding: '1rem', background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10 }}>
        <h2 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>Active assistant coaches ({assistants.length})</h2>
        {!loading && assistants.length === 0 && (
          <p className={styles.muted}>No assistant coaches yet. Head coaches add their own from a team&apos;s Staff tab.</p>
        )}
        {assistants.map(a => (
          <div key={a.coachId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', padding: '0.6rem 0', borderTop: '1px solid var(--border-2, rgba(255,255,255,0.06))', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{a.displayName || a.email || 'Assistant coach'}</p>
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.82rem', color: 'var(--white-45)' }}>
                {a.teamName}{a.programYearName ? ` · ${a.programYearName}` : ''}{a.email && a.displayName ? ` · ${a.email}` : ''}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--white-55)' }}>{grantSummary(a.capabilities)}</p>
            </div>
            {canWrite && (
              <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                disabled={busyId === a.coachId}
                onClick={() => { if (window.confirm(`Remove ${a.displayName || a.email || 'this assistant'} from ${a.teamName}? They lose access immediately.`)) act({ action: 'remove', coachId: a.coachId }, a.coachId); }}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
