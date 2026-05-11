'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../../../../rep-teams.module.css';

interface EnrichedCoach {
  id: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string;
  createdAt: string;
}

interface OrgMember {
  userId: string;
  displayName: string | null;
  email: string;
}

export default function CoachManagementPage({
  params,
}: {
  params: { orgSlug: string; teamId: string; yearId: string };
}) {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [coaches, setCoaches] = useState<EnrichedCoach[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [fetching, setFetching] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'head_coach' | 'assistant_coach'>('head_coach');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [yearName, setYearName] = useState('');

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const loadCoaches = useCallback(async () => {
    const res = await fetch(
      `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load coaches');
    setCoaches(data.coaches ?? []);
  }, [params.teamId, params.yearId]);

  const loadAll = useCallback(async () => {
    setFetching(true);
    try {
      const [coachRes, memberRes, yearRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches`),
        fetch('/api/admin/members'),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`),
      ]);
      const [coachData, memberData, yearData] = await Promise.all([
        coachRes.json(), memberRes.json(), yearRes.json(),
      ]);
      if (!coachRes.ok) throw new Error(coachData.error ?? 'Failed to load coaches');
      setCoaches(coachData.coaches ?? []);
      setMembers(
        (Array.isArray(memberData) ? memberData : []).map((m: any) => ({
          userId: m.userId,
          displayName: m.displayName ?? null,
          email: m.email ?? '',
        })),
      );
      if (yearRes.ok) {
        setTeamName(yearData.team?.name ?? '');
        setYearName(yearData.programYear?.name ?? '');
      }
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, params.yearId]);

  useEffect(() => { if (currentOrg) loadAll(); }, [currentOrg, loadAll]);

  const assignedUserIds = new Set(coaches.map(c => c.userId));
  const availableMembers = members.filter(m => !assignedUserIds.has(m.userId));

  async function handleAssign() {
    if (!selectedUserId) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUserId, coachRole: selectedRole }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign coach');
      setSelectedUserId('');
      setSelectedRole('head_coach');
      await loadCoaches();
      showFeedback('success', 'Coach assigned.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to assign coach.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(coachId: string, name: string) {
    setRemovingId(coachId);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches?coachId=${coachId}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove coach');
      await loadCoaches();
      showFeedback('success', `${name || 'Coach'} removed.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to remove coach.');
    } finally {
      setRemovingId(null);
    }
  }

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${params.teamId}`}>{teamName || 'Team'}</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`}>{yearName || 'Program Year'}</Link>
        <span><ChevronRight size={12} /></span>
        <span>Coaches</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Coaches</h1>
            <p className={styles.pageSub}>{teamName} — {yearName}</p>
          </div>
        </div>
      </div>

      <div className={styles.coachColumns}>
        {/* Left: current coaches */}
        <div className={styles.coachPanel}>
          <p className={styles.coachPanelTitle}>Current Coaches ({coaches.length})</p>
          {coaches.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              No coaches assigned yet.
            </p>
          ) : (
            coaches.map(c => {
              const name = c.displayName || c.email;
              return (
                <div key={c.id} className={styles.coachRow}>
                  <div>
                    <div className={styles.coachName}>{name}</div>
                    {c.displayName && <div className={styles.coachEmail}>{c.email}</div>}
                    <span className={`${styles.badge} ${c.coachRole === 'head_coach' ? styles.badgeHeadCoach : styles.badgeAssistant}`}
                      style={{ marginTop: '0.3rem', display: 'inline-block' }}>
                      {c.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
                    </span>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.78rem', color: '#f87171', opacity: removingId === c.id ? 0.5 : 1 }}
                      onClick={() => handleRemove(c.id, name)}
                      disabled={removingId === c.id}
                    >
                      {removingId === c.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: assign panel */}
        {canWrite && (
          <div className={styles.coachPanel}>
            <p className={styles.coachPanelTitle}>Assign Coach</p>
            {availableMembers.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                All org members are already assigned, or there are no other members to assign.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="coach-user">Member</label>
                  <select id="coach-user" className={styles.select} value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">— select a member —</option>
                    {availableMembers.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName ? `${m.displayName} (${m.email})` : m.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="coach-role">Role</label>
                  <select id="coach-role" className={styles.select} value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as 'head_coach' | 'assistant_coach')}>
                    <option value="head_coach">Head Coach</option>
                    <option value="assistant_coach">Assistant Coach</option>
                  </select>
                </div>

                <button type="button" className="btn btn-primary" onClick={handleAssign}
                  disabled={assigning || !selectedUserId}>
                  {assigning ? 'Assigning…' : 'Assign Coach'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'} message={feedbackMsg} type={feedbackType} />
    </div>
  );
}
