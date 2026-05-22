'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, RefreshCw, Send, Users } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { AgeGroup, Contact, Team } from '@/lib/types';
import styles from './communication.module.css';

type Status = Team['status'];
type PaymentStatus = Team['paymentStatus'];
type StatusMessage = { type: 'success' | 'error'; msg: string };
type RecipientPreview = {
  email: string;
  name: string;
  detail: string;
  source: 'Team' | 'Contact' | 'Team + Contact';
};

const TEAM_STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'accepted', label: 'Accepted teams' },
  { value: 'pending', label: 'Pending teams' },
  { value: 'waitlist', label: 'Waitlisted teams' },
  { value: 'rejected', label: 'Rejected teams' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Payment pending' },
  { value: 'paid', label: 'Marked paid' },
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function statusLabel(status: Status) {
  return TEAM_STATUS_OPTIONS.find(option => option.value === status)?.label.replace(' teams', '') ?? status;
}

function paymentStatusLabel(status: PaymentStatus) {
  return PAYMENT_STATUS_OPTIONS.find(option => option.value === status)?.label ?? status;
}

function toggleSetValue<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function AdminCommunicationPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [includeTeams, setIncludeTeams] = useState(true);
  const [includeContacts, setIncludeContacts] = useState(false);
  const [selectedTeamStatuses, setSelectedTeamStatuses] = useState<Set<Status>>(() => new Set(['accepted']));
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<Set<PaymentStatus>>(() => new Set());
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<Set<string>>(() => new Set());
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(() => new Set());
  const [selectedContactRoles, setSelectedContactRoles] = useState<Set<string>>(() => new Set());
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!currentTournament?.id) {
        setContacts([]);
        setTeams([]);
        setAgeGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tournamentId = encodeURIComponent(currentTournament.id);
      const [contactsRes, teamsRes, groupsRes] = await Promise.all([
        fetch(`/api/admin/contacts?tournamentId=${tournamentId}`),
        fetch(`/api/admin/teams?tournamentId=${tournamentId}`),
        fetch(`/api/admin/age-groups?tournamentId=${tournamentId}`),
      ]);

      setContacts(contactsRes.ok ? await contactsRes.json() : []);
      setTeams(teamsRes.ok ? await teamsRes.json() : []);
      setAgeGroups(groupsRes.ok ? await groupsRes.json() : []);
      setLoading(false);
    }

    void load();
  }, [currentTournament?.id]);

  const ageGroupNameById = useMemo(() => new Map(ageGroups.map(group => [group.id, group.name])), [ageGroups]);
  const canTargetAnnouncements = currentOrg ? hasPlanFeature(currentOrg.planId, 'targeted_tournament_announcements') : false;

  const contactRoles = useMemo(() => {
    return Array.from(new Set(contacts.map(contact => contact.role).filter((role): role is string => Boolean(role)))).sort();
  }, [contacts]);

  const filteredTeams = useMemo(() => {
    if (!canTargetAnnouncements) return teams;
    if (!includeTeams) return [];
    if (selectedTeamIds.size > 0) return teams.filter(team => selectedTeamIds.has(team.id));

    return teams.filter(team => {
      const matchesStatus = selectedTeamStatuses.size === 0 || selectedTeamStatuses.has(team.status);
      const matchesPaymentStatus = selectedPaymentStatuses.size === 0 || selectedPaymentStatuses.has(team.paymentStatus);
      const matchesDivision = selectedAgeGroups.size === 0 || selectedAgeGroups.has(team.ageGroupId);
      return matchesStatus && matchesPaymentStatus && matchesDivision;
    });
  }, [canTargetAnnouncements, includeTeams, selectedAgeGroups, selectedPaymentStatuses, selectedTeamIds, selectedTeamStatuses, teams]);

  const filteredContacts = useMemo(() => {
    if (!canTargetAnnouncements) return [];
    if (!includeContacts) return [];
    return contacts.filter(contact => selectedContactRoles.size === 0 || selectedContactRoles.has(contact.role ?? ''));
  }, [canTargetAnnouncements, contacts, includeContacts, selectedContactRoles]);

  const recipients = useMemo<RecipientPreview[]>(() => {
    const byEmail = new Map<string, RecipientPreview>();

    for (const team of filteredTeams) {
      const email = normalizeEmail(team.email);
      if (!email) continue;

      byEmail.set(email, {
        email,
        name: team.name,
        detail: `${ageGroupNameById.get(team.ageGroupId) ?? 'Division'} - ${statusLabel(team.status)} - ${paymentStatusLabel(team.paymentStatus)}`,
        source: 'Team',
      });
    }

    for (const contact of filteredContacts) {
      const email = normalizeEmail(contact.email);
      if (!email) continue;

      const existing = byEmail.get(email);
      if (existing) {
        byEmail.set(email, {
          ...existing,
          source: 'Team + Contact',
          detail: `${existing.detail} - ${contact.role || 'Contact'}`,
        });
      } else {
        byEmail.set(email, {
          email,
          name: contact.name,
          detail: contact.role || 'Contact',
          source: 'Contact',
        });
      }
    }

    return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ageGroupNameById, filteredContacts, filteredTeams]);

  const recipientSummary = useMemo(() => {
    if (!canTargetAnnouncements) return 'all registered teams';

    const parts: string[] = [];

    if (includeTeams) {
      if (selectedTeamIds.size > 0) {
        parts.push(`${selectedTeamIds.size} individual team${selectedTeamIds.size === 1 ? '' : 's'}`);
      } else {
        const statusText = selectedTeamStatuses.size === 0
          ? 'all team statuses'
          : Array.from(selectedTeamStatuses).map(item => statusLabel(item).toLowerCase()).join(', ');
        const divisionText = selectedAgeGroups.size === 0
          ? ''
          : ` in ${selectedAgeGroups.size} division${selectedAgeGroups.size === 1 ? '' : 's'}`;
        const paymentText = selectedPaymentStatuses.size === 0
          ? ''
          : ` with ${Array.from(selectedPaymentStatuses).map(item => paymentStatusLabel(item).toLowerCase()).join(', ')}`;
        parts.push(`${statusText} teams${divisionText}${paymentText}`);
      }
    }

    if (includeContacts) {
      parts.push(selectedContactRoles.size === 0
        ? 'all contacts'
        : `${selectedContactRoles.size} contact role${selectedContactRoles.size === 1 ? '' : 's'}`);
    }

    return parts.length > 0 ? parts.join(' + ') : 'No audience selected';
  }, [canTargetAnnouncements, includeContacts, includeTeams, selectedAgeGroups.size, selectedContactRoles.size, selectedPaymentStatuses, selectedTeamIds.size, selectedTeamStatuses]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament?.id || recipients.length === 0) return;

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: currentTournament.id,
          targeting: {
            includeTeams: canTargetAnnouncements ? includeTeams : true,
            includeContacts: canTargetAnnouncements ? includeContacts : false,
            teamStatuses: canTargetAnnouncements ? Array.from(selectedTeamStatuses) : [],
            paymentStatuses: canTargetAnnouncements ? Array.from(selectedPaymentStatuses) : [],
            ageGroupIds: canTargetAnnouncements ? Array.from(selectedAgeGroups) : [],
            teamIds: canTargetAnnouncements ? Array.from(selectedTeamIds) : [],
            contactRoles: canTargetAnnouncements ? Array.from(selectedContactRoles) : [],
          },
          subject,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send messages');

      const sent = data?.results?.success ?? recipients.length;
      const failed = data?.results?.failed ?? 0;
      setStatus({ type: 'success', msg: `Finished sending. Success: ${sent}, Failed: ${failed}.` });
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to send messages' });
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="empty-state"><RefreshCw className="spin" /><p>Loading recipients...</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Mail size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Communication Hub</h1>
            <p className={styles.pageSub}>Send email to tournament teams or tournament contacts with a verified recipient preview.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSend} className={styles.composer}>
        <div className={`${styles.section} ${styles.recipientSection}`}>
          <div className={styles.recipientHeader}>
            <h3><Users size={18} /> 1. Recipients</h3>
            {canTargetAnnouncements && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setRecipientsOpen(open => !open)}
                aria-expanded={recipientsOpen}
              >
                {recipientsOpen ? 'Done' : 'Edit Recipients'}
              </button>
            )}
          </div>

          <div className={styles.recipientSummary}>
            <div>
              <strong>{recipientSummary}</strong>
              <span>{recipients.length} deduped recipient{recipients.length === 1 ? '' : 's'} selected</span>
            </div>
          </div>

          {recipientsOpen && (
            <div className={styles.recipientDetails}>
              {!canTargetAnnouncements && (
                <div className={styles.lockedTargeting}>
                  <strong>Tournament Plus unlocks targeted sends.</strong>
                  <span>{requiresTournamentPlusCopy('targeted_tournament_announcements')}</span>
                </div>
              )}

              {canTargetAnnouncements && (
              <>
              <div className={styles.audienceToggle}>
                <label className={`${styles.audienceOption} ${includeTeams ? styles.audienceActive : ''}`}>
                  <input type="checkbox" checked={includeTeams} onChange={e => setIncludeTeams(e.target.checked)} />
                  Teams
                </label>
                <label className={`${styles.audienceOption} ${includeContacts ? styles.audienceActive : ''}`}>
                  <input type="checkbox" checked={includeContacts} onChange={e => setIncludeContacts(e.target.checked)} />
                  Contacts
                </label>
              </div>

              <div className={styles.filters}>
                {includeTeams && (
                  <>
                    <div className={styles.filterCard}>
                      <label className="form-label">Team Status</label>
                      <p className={styles.filterHelp}>Used unless individual teams are selected.</p>
                      {TEAM_STATUS_OPTIONS.map(option => (
                        <label key={option.value} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedTeamStatuses.has(option.value)}
                            onChange={() => setSelectedTeamStatuses(prev => toggleSetValue(prev, option.value))}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>

                    <div className={styles.filterCard}>
                      <label className="form-label">Payment Status</label>
                      <p className={styles.filterHelp}>Leave blank for all payment states.</p>
                      {PAYMENT_STATUS_OPTIONS.map(option => (
                        <label key={option.value} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedPaymentStatuses.has(option.value)}
                            onChange={() => setSelectedPaymentStatuses(prev => toggleSetValue(prev, option.value))}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>

                    <div className={styles.filterCard}>
                      <label className="form-label">Divisions</label>
                      <p className={styles.filterHelp}>Leave blank for all divisions.</p>
                      {ageGroups.length === 0 ? (
                        <p className={styles.emptyHint}>No divisions configured.</p>
                      ) : ageGroups.map(group => (
                        <label key={group.id} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedAgeGroups.has(group.id)}
                            onChange={() => setSelectedAgeGroups(prev => toggleSetValue(prev, group.id))}
                          />
                          {group.name}
                        </label>
                      ))}
                    </div>

                    <div className={styles.filterCard} style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Individual Teams</label>
                      <p className={styles.filterHelp}>Optional. If selected, these teams override status and division filters.</p>
                      <div className={styles.scrollList}>
                        {teams.length === 0 ? (
                          <p className={styles.emptyHint}>No teams registered yet.</p>
                        ) : teams.map(team => (
                          <label key={team.id} className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={selectedTeamIds.has(team.id)}
                              onChange={() => setSelectedTeamIds(prev => toggleSetValue(prev, team.id))}
                            />
                            <span>
                              {team.name}
                              <small>{ageGroupNameById.get(team.ageGroupId) ?? 'Division'} - {statusLabel(team.status)}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {includeContacts && (
                  <div className={styles.filterCard}>
                    <label className="form-label">Contact Roles</label>
                    <p className={styles.filterHelp}>Leave blank for all tournament contacts.</p>
                    {contactRoles.length === 0 ? (
                      <p className={styles.emptyHint}>No contact roles defined.</p>
                    ) : contactRoles.map(role => (
                      <label key={role} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedContactRoles.has(role)}
                          onChange={() => setSelectedContactRoles(prev => toggleSetValue(prev, role))}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}

              <div className={styles.recipientPreview}>
                {recipients.length === 0 ? (
                  <p className={styles.emptyHint}>Choose at least one team or contact audience to preview recipients.</p>
                ) : recipients.slice(0, 12).map(recipient => (
                  <div key={recipient.email} className={styles.recipientRow}>
                    <div>
                      <strong>{recipient.name}</strong>
                      <span>{recipient.email}</span>
                    </div>
                    <small>{recipient.source} - {recipient.detail}</small>
                  </div>
                ))}
                {recipients.length > 12 && <p className={styles.previewMore}>+{recipients.length - 12} more recipients</p>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-2)' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setRecipientsOpen(false)}>Done</button>
              </div>
            </div>
          )}
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
            <label>Message Body</label>
            <textarea
              className="form-textarea"
              rows={10}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write the email message recipients should receive..."
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={sending || recipients.length === 0}
          >
            {sending ? <><RefreshCw className="spin" size={18} /> Sending...</> : <><Send size={18} /> Send Email to {recipients.length} Recipients</>}
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
