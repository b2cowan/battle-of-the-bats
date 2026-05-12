'use client';
import { useState, useEffect } from 'react';
import { Mail, Send, Users, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getContacts, getAgeGroups } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Contact, AgeGroup } from '@/lib/types';
import styles from './communication.module.css';

export default function AdminCommunicationPage() {
  const { currentTournament } = useTournament();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      if (!currentTournament) return;
      setLoading(true);
      const [c, g] = await Promise.all([
        getContacts(currentTournament.id),
        getAgeGroups(currentTournament.id)
      ]);
      setContacts(c);
      setAgeGroups(g);
      setLoading(false);
    }
    load();
  }, [currentTournament]);

  const roles = Array.from(new Set(contacts.map(c => c.role).filter(Boolean))) as string[];

  const filteredRecipients = contacts.filter(c => {
    // If nothing is selected, don't show any (safer)
    if (selectedDivisions.size === 0 && selectedRoles.size === 0) return false;
    
    // Check roles
    if (selectedRoles.size > 0 && c.role && selectedRoles.has(c.role)) return true;
    
    // Check divisions (requires matching the contact to an age group if applicable)
    // For now, let's assume we filter primarily by role (Coach, etc)
    // If we want more granular division filtering, we'd need to link contacts to teams/registrations better.
    // However, for this MVP, filtering by roles like 'Coach' or 'Admin' is the primary use case.
    
    return false;
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (filteredRecipients.length === 0) return;
    
    setSending(true);
    setStatus(null);
    
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: filteredRecipients.map(r => r.email),
          subject,
          message,
          tournamentName: currentTournament?.name
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send messages');
      
      setStatus({ type: 'success', msg: `Successfully sent to ${filteredRecipients.length} recipients.` });
      setSubject('');
      setMessage('');
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setSending(false);
    }
  }

  function toggleRole(role: string) {
    const next = new Set(selectedRoles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setSelectedRoles(next);
  }

  if (loading) return <div className="empty-state"><RefreshCw className="spin" /><p>Loading contacts…</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Mail size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Communication Hub</h1>
            <p className={styles.pageSub}>Send mass emails to tournament contacts and coaches</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSend} className={styles.composer}>
        <div className={styles.section}>
          <h3><Users size={18} /> 1. Select Recipients</h3>
          <div className={styles.filters}>
            <div className={styles.filterCard}>
              <label className="form-label">By Role</label>
              {roles.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--white-30)' }}>No roles defined yet.</p>
              ) : roles.map(role => (
                <label key={role} className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={selectedRoles.has(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
            {/* Future: Add division filtering by linking contacts to age groups */}
          </div>
          
          <div className={styles.recipientCount}>
            <strong>{filteredRecipients.length}</strong> recipients selected
          </div>
        </div>

        <div className={styles.section}>
          <h3><Send size={18} /> 2. Compose Message</h3>
          <div className={styles.formGroup}>
            <label>Subject</label>
            <input 
              className="form-input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Important Tournament Update"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Message Body (HTML supported)</label>
            <textarea 
              className="form-textarea"
              rows={10}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your announcement here..."
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary btn-lg" 
            style={{ width: '100%' }}
            disabled={sending || filteredRecipients.length === 0}
          >
            {sending ? <><RefreshCw className="spin" size={18} /> Sending…</> : <><Send size={18} /> Send Mass Email</>}
          </button>
        </div>
      </form>

      {status && (
        <div className={`${styles.statusCard} ${status.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}
