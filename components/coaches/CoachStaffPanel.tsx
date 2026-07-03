'use client';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

type MoneyAccess = 'off' | 'read' | 'write';
type DocsAccess = 'off' | 'view' | 'manage';
type RosterAccess = 'off' | 'view';

interface Caps {
  isHeadCoach: boolean;
  schedule: boolean;
  attendance: boolean;
  lineups: boolean;
  roster: RosterAccess;
  rosterWrite: boolean; // server-derived (assistants always false); present in the resolved response
  rosterPii: boolean;
  notes: boolean;
  money: MoneyAccess;
  documents: DocsAccess;
  announcementsSend: boolean;
  tryouts: boolean;
}

interface StaffMember {
  coachId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string | null;
  capabilities: Caps;
  isSelf: boolean;
}

// The head coach's duty grid. Grants are stored per-assistant; head coaches always have full access.
const SEGMENTS: { key: keyof Caps; label: string; hint: string; options: { value: string; label: string }[] }[] = [
  { key: 'money', label: 'Team money', hint: 'Budget, dues, expenses', options: [
    { value: 'off', label: 'Hidden' }, { value: 'read', label: 'View' }, { value: 'write', label: 'View + edit' } ] },
  { key: 'documents', label: 'Documents', hint: 'Waivers & team files', options: [
    { value: 'off', label: 'Hidden' }, { value: 'view', label: 'View' }, { value: 'manage', label: 'Manage' } ] },
  { key: 'roster', label: 'Roster', hint: 'Player list', options: [
    { value: 'off', label: 'Hidden' }, { value: 'view', label: 'View' } ] },
];

const TOGGLES: { key: keyof Caps; label: string; hint: string }[] = [
  { key: 'schedule', label: 'Schedule', hint: 'View + manage events' },
  { key: 'attendance', label: 'Attendance', hint: 'Record attendance' },
  { key: 'lineups', label: 'Lineups', hint: 'Build game lineups' },
  { key: 'rosterPii', label: 'Contacts & birthdates', hint: 'Guardian contact + player DOB' },
  { key: 'notes', label: 'Internal notes', hint: 'Private staff notes' },
  { key: 'announcementsSend', label: 'Send announcements', hint: 'Email parents (off = draft only)' },
  { key: 'tryouts', label: 'Tryouts', hint: 'Candidates + decisions' },
];

function grantsFrom(c: Caps) {
  return {
    schedule: c.schedule, attendance: c.attendance, lineups: c.lineups,
    roster: c.roster, rosterPii: c.rosterPii, notes: c.notes,
    money: c.money, documents: c.documents,
    announcementsSend: c.announcementsSend, tryouts: c.tryouts,
  };
}

export default function CoachStaffPanel({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteError, setInviteError] = useState('');

  const base = `/api/coaches/${orgSlug}/teams/${teamId}/staff`;

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(base);
      if (!res.ok) throw new Error('Could not load the coaching staff.');
      const json = await res.json();
      setStaff(json.staff ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the coaching staff.');
    }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function saveCaps(member: StaffMember, next: Caps) {
    // Optimistic update
    setStaff(prev => prev?.map(s => s.coachId === member.coachId ? { ...s, capabilities: next } : s) ?? prev);
    setSavingId(member.coachId);
    setSavedId(null);
    try {
      const res = await fetch(`${base}/${member.coachId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: grantsFrom(next) }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStaff(prev => prev?.map(s => s.coachId === member.coachId ? { ...s, capabilities: json.capabilities } : s) ?? prev);
      setSavedId(member.coachId);
      setTimeout(() => setSavedId(id => id === member.coachId ? null : id), 1800);
    } catch {
      void load(); // revert to server truth on failure
    } finally {
      setSavingId(id => id === member.coachId ? null : id);
    }
  }

  async function removeAssistant(member: StaffMember) {
    if (!window.confirm(`Remove ${member.displayName || member.email || 'this assistant'} from the team? They lose access immediately.`)) return;
    setRemovingId(member.coachId);
    try {
      const res = await fetch(`${base}/${member.coachId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setStaff(prev => prev?.filter(s => s.coachId !== member.coachId) ?? prev);
    } catch {
      void load();
    } finally {
      setRemovingId(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true); setInviteMsg(''); setInviteError('');
    try {
      const res = await fetch(`${base}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setInviteError(json.error ?? 'Could not send the invite.'); return; }
      setInviteMsg(json.pendingApproval
        ? 'Invite sent — your club admin will approve access.'
        : `Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
    } catch {
      setInviteError('Could not send the invite.');
    } finally {
      setInviting(false);
    }
  }

  const assistants = (staff ?? []).filter(s => s.coachRole === 'assistant_coach');

  return (
    <section className={styles.setupPanel} aria-labelledby="staff-title">
      <div className={styles.setupHeader}>
        <div>
          <p className={styles.setupKicker}>Coaching staff</p>
          <h2 id="staff-title" className={styles.setupTitle}>Assistant coaches</h2>
        </div>
        <ShieldCheck size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>

      <p style={{ margin: '0 0 0.9rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
        Invite assistants and choose exactly what each one can do. New assistants start with the safe
        basics (chat, schedule, attendance, lineups, roster names) and nothing sensitive until you grant it.
      </p>

      {/* Invite */}
      <form onSubmit={sendInvite} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <input
          type="email"
          required
          className={styles.input}
          placeholder="assistant@email.com"
          value={inviteEmail}
          onChange={e => { setInviteEmail(e.target.value); setInviteMsg(''); setInviteError(''); }}
          style={{ maxWidth: 300 }}
        />
        <button type="submit" className={styles.btnPrimary} disabled={inviting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
          <UserPlus size={15} /> {inviting ? 'Sending…' : 'Invite assistant'}
        </button>
      </form>
      {inviteMsg && <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--lime, #b6e34d)' }}>{inviteMsg}</p>}
      {inviteError && <p className={styles.errorText} style={{ margin: '0 0 0.6rem' }}>{inviteError}</p>}

      {loadError && <p className={styles.errorText}>{loadError}</p>}
      {!staff && !loadError && <p className={styles.muted}>Loading staff…</p>}

      {staff && assistants.length === 0 && (
        <p className={styles.muted} style={{ marginTop: '0.4rem' }}>No assistant coaches yet — invite one above.</p>
      )}

      {/* Assistant cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.6rem' }}>
        {assistants.map(member => {
          const c = member.capabilities;
          const setCap = (patch: Partial<Caps>) => saveCaps(member, { ...c, ...patch });
          return (
            <div key={member.coachId} style={{ border: '1px solid var(--border-2, rgba(255,255,255,0.08))', borderRadius: 10, padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--white-90)' }}>{member.displayName || member.email || 'Assistant coach'}</p>
                  {member.email && member.displayName && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--white-45)' }}>{member.email}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {savingId === member.coachId && <span style={{ fontSize: '0.78rem', color: 'var(--white-45)' }}>Saving…</span>}
                  {savedId === member.coachId && <span style={{ fontSize: '0.78rem', color: 'var(--lime, #b6e34d)' }}>Saved</span>}
                  <button type="button" onClick={() => removeAssistant(member)} disabled={removingId === member.coachId}
                    className={styles.btnSecondary}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.55rem' }}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>

              {/* Segmented (multi-state) controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginTop: '0.7rem' }}>
                {SEGMENTS.map(seg => (
                  <div key={String(seg.key)} style={{ minWidth: 170 }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.8rem', color: 'var(--white-70)' }}>{seg.label}</p>
                    <div style={{ display: 'inline-flex', border: '1px solid var(--border-2, rgba(255,255,255,0.12))', borderRadius: 8, overflow: 'hidden' }}>
                      {seg.options.map(opt => {
                        const active = String(c[seg.key]) === opt.value;
                        return (
                          <button key={opt.value} type="button"
                            onClick={() => setCap({ [seg.key]: opt.value } as Partial<Caps>)}
                            style={{
                              border: 'none', cursor: 'pointer', fontSize: '0.76rem', padding: '0.3rem 0.6rem',
                              background: active ? 'var(--logic-lime, #b6e34d)' : 'transparent',
                              color: active ? 'var(--pitch-black, #0a0a0f)' : 'var(--white-70)',
                              fontWeight: active ? 700 : 500,
                            }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--white-45)' }}>{seg.hint}</p>
                  </div>
                ))}
              </div>

              {/* On/off toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem 1rem', marginTop: '0.8rem' }}>
                {TOGGLES.map(t => {
                  const on = Boolean(c[t.key]);
                  return (
                    <label key={String(t.key)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={on} onChange={e => setCap({ [t.key]: e.target.checked } as Partial<Caps>)} style={{ marginTop: 2 }} />
                      <span>
                        <span style={{ fontSize: '0.83rem', color: 'var(--white-90)' }}>{t.label}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--white-45)' }}>{t.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
