'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, Globe, Lock,
  Mail, Plus, RefreshCw, RotateCcw, Send,
  Star, Trash2, Users, X,
} from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { Division, Communication, Team } from '@/lib/types';
import s from '../../admin-common.module.css';
import styles from './communication.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryFilter = 'site' | 'email';

// ─── Quick templates (free for all plans) ────────────────────────────────────

const QUICK_TEMPLATES = [
  {
    label: 'Schedule Published',
    title: 'Schedule is live — {{tournament}}',
    body: 'Hi teams,\n\nThe schedule for {{tournament}} is now live. You can view game times, dates, and locations on the tournament site.\n\nSee you on the field!',
  },
  {
    label: 'Payment Reminder',
    title: 'Reminder: Payment outstanding — {{tournament}}',
    body: 'Hi teams,\n\nThis is a friendly reminder that payment for {{tournament}} is still outstanding. Please arrange payment at your earliest convenience to secure your spot.\n\nThank you!',
  },
  {
    label: 'Weather Update',
    title: '⚠️ Weather update — {{tournament}}',
    body: 'Hi teams,\n\nDue to weather conditions, we have an update regarding {{tournament}}. [Add details here.]\n\nWe will share further updates as soon as they are available. Thank you for your patience.',
  },
  {
    label: 'Welcome & Info',
    title: 'Welcome to {{tournament}} — important info',
    body: 'Hi teams,\n\nWe are excited to welcome you to {{tournament}}! Here is some important information:\n\n• [Parking / venue info]\n• [Check-in instructions]\n• [Schedule link]\n\nSee you there!',
  },
  {
    label: 'Results Posted',
    title: 'Final results are in — {{tournament}}',
    body: 'Hi teams,\n\nThe final results for {{tournament}} are now posted. Thank you to all teams and families for a great tournament!\n\n[Add any closing remarks here.]\n\nHope to see you next year!',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleSetValue<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function formatDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCommunicationPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Communications');
  const orgSlug  = currentOrg?.slug;
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '?';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const billingHref = `/${orgSlug}/admin/tournaments/settings/subscription`;

  // ── Data ────────────────────────────────────────────────────────────────────
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [teams,     setTeams]    = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [sending,   setSending]  = useState(false);

  // ── View state ──────────────────────────────────────────────────────────────
  const [isComposing,              setIsComposing]              = useState(false);
  const [historyFilter,            setHistoryFilter]            = useState<HistoryFilter>('site');
  const [editingId,                setEditingId]                = useState<string | null>(null);
  const [deleteId,                 setDeleteId]                 = useState<string | null>(null);
  const [sendResult,               setSendResult]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [emailDetailId,            setEmailDetailId]            = useState<string | null>(null);
  const [emailDetailRecipientsOpen,setEmailDetailRecipientsOpen]= useState(false);
  const [siteFilter,               setSiteFilter]               = useState<'active' | 'deleted'>('active');

  // ── Compose fields ──────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [channelSite, setChannelSite] = useState(true);
  const [channelEmail,setChannelEmail]= useState(false);
  const [pinned,      setPinned]      = useState(false);
  const [siteDivisionIds, setSiteDivisionIds] = useState<Set<string>>(() => new Set());
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!currentTournament?.id) {
      setCommunications([]); setTeams([]); setDivisions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const tid = encodeURIComponent(currentTournament.id);
    const [commsRes, teamsRes, groupsRes] = await Promise.all([
      fetch(`/api/admin/communications?tournamentId=${tid}${orgParam}`),
      fetch(`/api/admin/teams?tournamentId=${tid}${orgParam}`),
      fetch(`/api/admin/divisions?tournamentId=${tid}${orgParam}`),
    ]);
    setCommunications(commsRes.ok ? await commsRes.json() : []);
    setTeams(teamsRes.ok ? await teamsRes.json() : []);
    setDivisions(groupsRes.ok ? await groupsRes.json() : []);
    setLoading(false);
  }, [currentTournament?.id, orgParam]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const divisionNameById = useMemo(() => new Map(divisions.map(g => [g.id, g.name])), [divisions]);
  const acceptedTeamCount = useMemo(() => teams.filter(t => t.status === 'accepted').length, [teams]);

  // ── Compose helpers ──────────────────────────────────────────────────────────
  function openNewMessage() {
    setEditingId(null);
    setTitle(''); setBody(''); setPinned(false);
    setSiteDivisionIds(new Set());
    setChannelSite(true); setChannelEmail(false);
    setActiveTemplate(null);
    setIsComposing(true);
    setSendResult(null);
  }

  function openEdit(item: Communication) {
    setTitle(item.title);
    setBody(item.body);
    setPinned(item.pinned);
    setSiteDivisionIds(new Set(item.divisionIds ?? []));
    setChannelSite(item.channelSite);
    setChannelEmail(false);
    setEditingId(item.id);
    // isComposing stays false — edit uses a modal, not the inline panel
    setSendResult(null);
  }

  function cancelCompose() {
    setIsComposing(false);
    setEditingId(null);
    setTitle(''); setBody(''); setPinned(false);
    setSiteDivisionIds(new Set());
    setChannelSite(true); setChannelEmail(false);
    setActiveTemplate(null);
  }

  function applyTemplate(tpl: typeof QUICK_TEMPLATES[number]) {
    const tName = currentTournament?.name ?? 'the tournament';
    setTitle(tpl.title.replace('{{tournament}}', tName));
    setBody(tpl.body.replace(/{{tournament}}/g, tName));
    setActiveTemplate(tpl.label);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament?.id) return;
    setSending(true);
    setSendResult(null);

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/communications${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: editingId,
            data: { title: title.trim(), body: body.trim(), pinned, divisionIds: Array.from(siteDivisionIds) },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update.');
        setSendResult({ type: 'success', msg: 'Post updated.' });
      } else {
        const res = await fetch(`/api/admin/communications${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            data: {
              tournamentId: currentTournament.id,
              title: title.trim(),
              body: body.trim(),
              channelSite,
              channelEmail,
              pinned,
              divisionIds: Array.from(siteDivisionIds),
              targeting: null, // always send to all accepted teams
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send.');

        const r = json.emailResults;
        if (channelEmail && r) {
          const warn = r.failed > 0;
          setSendResult({
            type: warn ? 'error' : 'success',
            msg: warn
              ? `Sent to ${r.sent} · ${r.failed} failed to deliver`
              : `Sent to ${r.sent} recipient${r.sent === 1 ? '' : 's'}`,
          });
        } else {
          setSendResult({
            type: 'success',
            msg: channelSite && channelEmail ? 'Posted to site and sent by email.' : channelSite ? 'Posted to site.' : 'Email sent.',
          });
        }
      }

      await loadData();
      cancelCompose();
    } catch (err: unknown) {
      setSendResult({ type: 'error', msg: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSending(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/communications${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: deleteId }),
    });
    setDeleteId(null);
    await loadData();
  }

  // ── Restore (undo soft-delete) ────────────────────────────────────────────────
  async function handleRestore(id: string) {
    await fetch(`/api/admin/communications${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', id }),
    });
    await loadData();
  }

  // ── Toggle pin ────────────────────────────────────────────────────────────────
  async function handleTogglePin(item: Communication) {
    await fetch(`/api/admin/communications${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-pin', id: item.id }),
    });
    await loadData();
  }

  // ── History lists ─────────────────────────────────────────────────────────────
  const sitePosts      = useMemo(() => communications.filter(c => c.channelSite),           [communications]);
  const filteredSitePosts = useMemo(
    () => siteFilter === 'deleted'
      ? sitePosts.filter(c => !!c.deletedAt)
      : sitePosts.filter(c => !c.deletedAt),
    [sitePosts, siteFilter],
  );
  const liveSiteCount  = useMemo(() => sitePosts.filter(c => !c.deletedAt).length,          [sitePosts]);
  const emailItems     = useMemo(() => communications.filter(c => c.channelEmail),          [communications]);
  const emailDetail = useMemo(
    () => communications.find(c => c.id === emailDetailId) ?? null,
    [communications, emailDetailId],
  );

  const sendButtonLabel = useMemo(() => {
    if (editingId) return 'Save Changes';
    if (channelSite && channelEmail) return `Post & Send${acceptedTeamCount > 0 ? ` to ${acceptedTeamCount}` : ''}`;
    if (channelEmail)  return `Send${acceptedTeamCount > 0 ? ` to ${acceptedTeamCount}` : ''}`;
    return 'Post to Site';
  }, [editingId, channelSite, channelEmail, acceptedTeamCount]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return <div className="empty-state"><RefreshCw className="spin" /><p>Loading communications…</p></div>;

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Mail size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Communications</h1>
            <p className={styles.pageSub}>Post updates to your site, email your teams, or both — from one place.</p>
          </div>
        </div>
        <button className="btn btn-lime btn-data" onClick={openNewMessage} disabled={!currentTournament}>
          <Plus size={15} /><span className={styles.headerBtnLabel}> New Message</span>
        </button>
      </div>

      {/* ── Result banner ───────────────────────────────────────────────────── */}
      {sendResult && !isComposing && (
        <div className={`${styles.resultBanner} ${sendResult.type === 'success' ? styles.resultSuccess : styles.resultError}`}>
          {sendResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{sendResult.msg}</span>
          <button className={styles.bannerDismiss} onClick={() => setSendResult(null)}><X size={14} /></button>
        </div>
      )}

      {/* ── Compose modal ──────────────────────────────────────────────────── */}
      {isComposing && (
        <div className="modal-overlay" onClick={cancelCompose}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Post' : 'New Message'}</h3>
              <button type="button" className="btn btn-ghost btn-data" onClick={cancelCompose}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.composeModalBody}>

                {/* Quick templates */}
                {!editingId && (
                  <div className={styles.templateRow}>
                    <span className={styles.templateLabel}>Templates:</span>
                    {QUICK_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.label}
                        type="button"
                        className={`${styles.templateChip} ${activeTemplate === tpl.label ? styles.templateChipActive : ''}`}
                        onClick={() => applyTemplate(tpl)}
                      >
                        {tpl.label}
                      </button>
                    ))}
                    {(title || body) && (
                      <button type="button" className={styles.draftClear} onClick={() => { setTitle(''); setBody(''); setActiveTemplate(null); }}>
                        × Clear
                      </button>
                    )}
                  </div>
                )}

                {/* Title */}
                <div className={styles.formGroup}>
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Schedule is live — U14 Boys"
                    required
                  />
                </div>

                {/* Body */}
                <div className={styles.formGroup}>
                  <label className="form-label">Message *</label>
                  <textarea
                    className="form-textarea"
                    rows={6}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message here…"
                    required
                  />
                </div>

                {/* ── Channels ──────────────────────────────────────────── */}
                <div className={styles.channelsSection}>
                  <span className={styles.channelsSectionLabel}>Channels</span>

                  {/* Site post */}
                  <div className={`${styles.channelRow} ${channelSite ? styles.channelActive : ''}`}>
                    <label className={styles.channelToggle}>
                      <input type="checkbox" checked={channelSite} onChange={e => setChannelSite(e.target.checked)} disabled={!!editingId} />
                      <Globe size={15} />
                      <span className={styles.channelName}>Post to site</span>
                      <span className={styles.channelDesc}>Appears on the public tournament News page</span>
                    </label>

                    {channelSite && (
                      <div className={styles.channelOptions}>
                        <label className={styles.pinLabel}>
                          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                          <Star size={13} fill={pinned ? 'currentColor' : 'none'} />
                          Pin at top of News page
                        </label>
                        <p style={{ margin: '0.25rem 0 0 1.7rem', fontSize: '0.72rem', color: 'var(--white-50)', lineHeight: 1.4 }}>
                          While the tournament is live, pinned site posts also appear as a banner at the top of the public Schedule — use it for rain delays and urgent day-of updates.
                        </p>

                        {/* Division visibility — vertical checklist */}
                        {divisions.length > 0 && (
                          <div className={styles.divisionCheckList}>
                            <span className={styles.divisionFilterLabel}>Division visibility</span>
                            <label className={styles.divisionCheckRow}>
                              <input type="checkbox" checked={siteDivisionIds.size === 0} onChange={() => setSiteDivisionIds(new Set())} />{' '}
                              All divisions
                            </label>
                            <div className={styles.divisionCheckIndent}>
                              {divisions.map(g => (
                                <label key={g.id} className={styles.divisionCheckRow}>
                                  <input
                                    type="checkbox"
                                    checked={siteDivisionIds.has(g.id)}
                                    onChange={() => setSiteDivisionIds(prev => toggleSetValue(prev, g.id))}
                                  />
                                  {g.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Email channel */}
                  {!editingId && (
                    <div className={`${styles.channelRow} ${channelEmail ? styles.channelActive : ''}`}>
                      <label className={styles.channelToggle}>
                        <input type="checkbox" checked={channelEmail} onChange={e => setChannelEmail(e.target.checked)} />
                        <Send size={15} />
                        <span className={styles.channelName}>Email recipients</span>
                        <span className={styles.channelDesc}>Send directly to team inboxes</span>
                      </label>

                      {channelEmail && (
                        <div className={styles.channelOptions}>
                          <div className={styles.recipientLine}>
                            <Users size={13} />
                            <span>
                              All accepted teams
                              {acceptedTeamCount > 0 && <span className={styles.recipientCount}> · {acceptedTeamCount} recipient{acceptedTeamCount === 1 ? '' : 's'}</span>}
                            </span>
                          </div>
                          <a href={billingHref} className={styles.targetingHint}>
                            <Lock size={10} /> Tournament Plus unlocks sends to specific divisions or registration statuses
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline result (errors during compose) */}
                {sendResult && isComposing && (
                  <div className={`${styles.inlineResult} ${sendResult.type === 'success' ? styles.inlineSuccess : styles.inlineError}`}>
                    {sendResult.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    {sendResult.msg}
                  </div>
                )}

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={cancelCompose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-lime btn-data"
                  disabled={sending || (!channelSite && !channelEmail)}
                >
                  {sending
                    ? <><RefreshCw className="spin" size={16} /> Sending…</>
                    : <><Send size={16} /> {sendButtonLabel}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── History ────────────────────────────────────────────────────────── */}
      <div className={styles.historySection}>

        {/* Tab bar — always visible */}
        <div className={styles.filterTabs}>
          <div className={styles.filterTabsLeft}>
            {(['site', 'email'] as HistoryFilter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterTab} ${historyFilter === f ? styles.filterTabActive : ''}`}
                onClick={() => setHistoryFilter(f)}
              >
                {f === 'site'
                  ? <><Globe size={12} /> Site Posts {liveSiteCount > 0 && <span className={styles.tabCount}>{liveSiteCount}</span>}</>
                  : <><Mail size={12} /> Emails {emailItems.length > 0 && <span className={styles.tabCount}>{emailItems.length}</span>}</>}
              </button>
            ))}
          </div>

          {historyFilter === 'site' && (
            <div className={styles.filterTabsRight}>
              {(['active', 'deleted'] as const).map(f => (
                <button
                  key={f}
                  className={`${styles.filterTab} ${styles.filterTabSmall} ${siteFilter === f ? styles.filterTabActive : ''}`}
                  onClick={() => setSiteFilter(f)}
                >
                  {f === 'active' ? 'Active' : 'Deleted'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Site Posts tab ──────────────────────────────────────────────── */}
        {historyFilter === 'site' && (
          <>
            {filteredSitePosts.length === 0 && !isComposing && (
              <div className="empty-state">
                {siteFilter === 'deleted' ? (
                  <p style={{ color: 'var(--white-40)', fontSize: '0.88rem', margin: 0 }}>No deleted posts.</p>
                ) : (
                  <>
                    <Globe size={40} />
                    <p className={styles.emptyTitle}>No site posts yet</p>
                    <p>Post an update to your tournament's public News page.</p>
                    <button className={`btn btn-lime ${styles.emptyCta}`} onClick={openNewMessage} disabled={!currentTournament}>
                      <Plus size={15} /> New Message
                    </button>
                  </>
                )}
              </div>
            )}

            {filteredSitePosts.length > 0 && (
              <div className={styles.emailTable}>
                <div className={`${s.tableHeader} ${styles.siteColHeader}`}>
                  <span className={styles.siteColDate}>Date</span>
                  <span className={styles.siteColTitle}>Title</span>
                  <span className={styles.siteColStatus}>Status</span>
                  <span className={styles.siteColPostedBy}>Posted by</span>
                </div>

                {filteredSitePosts.map(item => {
                  const isDeleted = !!item.deletedAt;
                  return (
                    <div
                      key={item.id}
                      className={`${s.row} ${styles.emailRow} ${isDeleted ? styles.siteRowDeleted : ''}`}
                      onClick={() => openEdit(item)}
                    >
                      <div className={`${s.rowMain} ${styles.emailRowMain}`}>
                        <div className={`${s.secondaryCell} ${styles.siteColDate}`}>
                          {formatDate(item.createdAt)}
                        </div>
                        <div className={`${s.primaryCell} ${styles.siteColTitle}`}>
                          {item.pinned && !isDeleted && (
                            <Star size={11} fill="currentColor" className={styles.pinnedStar} />
                          )}
                          {item.title}
                          <span className={styles.mobileMeta}>
                            {formatDate(item.createdAt)} · {isDeleted ? 'Deleted' : 'Live'}
                          </span>
                        </div>
                        <div className={styles.siteColStatus}>
                          {isDeleted
                            ? <span className="badge badge-neutral">Deleted</span>
                            : <span className="badge badge-success">Live</span>}
                        </div>
                        <div className={`${s.secondaryCell} ${styles.siteColPostedBy}`}>
                          {item.sentByEmail ?? '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Emails tab ──────────────────────────────────────────────────── */}
        {historyFilter === 'email' && (
          <>
            {emailItems.length === 0 && (
              <div className="empty-state">
                <Send size={40} />
                <p className={styles.emptyTitle}>No emails sent yet</p>
                <p>Compose a message and enable the Email channel to send to your teams.</p>
                <button className={`btn btn-lime ${styles.emptyCta}`} onClick={openNewMessage} disabled={!currentTournament}>
                  <Plus size={15} /> New Message
                </button>
              </div>
            )}

            {emailItems.length > 0 && (
              <div className={styles.emailTable}>
                {/* Column header */}
                <div className={`${s.tableHeader} ${styles.emailColHeader}`}>
                  <span className={styles.emailColDate}>Date sent</span>
                  <span className={styles.emailColSubject}>Subject</span>
                  <span className={styles.emailColRecipients}>Recipients</span>
                  <span className={styles.emailColStatus}>Status</span>
                  <span className={styles.emailColSentBy}>Sent by</span>
                </div>

                {/* Rows */}
                {emailItems.map(item => {
                  const hasFailed = item.emailFailedCount && item.emailFailedCount > 0;
                  const derivedTotal = (item.emailSuccessCount ?? 0) + (item.emailFailedCount ?? 0);
                  const total = item.emailRecipientCount ?? (derivedTotal > 0 ? derivedTotal : null);
                  return (
                    <div
                      key={item.id}
                      className={`${s.row} ${styles.emailRow}`}
                      onClick={() => setEmailDetailId(item.id)}
                    >
                      <div className={`${s.rowMain} ${styles.emailRowMain}`}>
                        <div className={`${s.secondaryCell} ${styles.emailColDate}`}>
                          {formatDate(item.emailSentAt ?? item.createdAt)}
                        </div>
                        <div className={`${s.primaryCell} ${styles.emailColSubject}`}>
                          {item.title}
                          <span className={styles.mobileMeta}>
                            {formatDate(item.emailSentAt ?? item.createdAt)} · {hasFailed ? `${item.emailFailedCount} failed` : 'All sent'}
                          </span>
                        </div>
                        <div className={`${s.secondaryCell} ${styles.emailColRecipients}`}>
                          {total ?? '—'}
                        </div>
                        <div className={styles.emailColStatus}>
                          {hasFailed
                            ? <span className="badge badge-warning"><AlertCircle size={10} /> {item.emailFailedCount} failed</span>
                            : <span className="badge badge-success"><CheckCircle2 size={10} /> All sent</span>}
                        </div>
                        <div className={`${s.secondaryCell} ${styles.emailColSentBy}`}>
                          {item.sentByEmail ?? '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete communication?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              This removes the post from your public News page immediately. The record is kept in your communications history and can be restored at any time.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-data" onClick={handleDelete}><Trash2 size={14} /> Remove from site</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email detail modal + Recipients modal ──────────────────────────── */}
      {emailDetail && (() => {
        function closeEmailDetail() {
          setEmailDetailId(null);
          setEmailDetailRecipientsOpen(false);
        }
        const failedSet = new Set(
          (emailDetail.emailFailedAddresses ?? []).map(a => a.toLowerCase()),
        );
        const acceptedTeams = teams.filter(t => t.status === 'accepted');
        // Sort: failed first, then delivered, both groups alphabetically by name
        const sortedTeams = [...acceptedTeams].sort((a, b) => {
          const aFailed = failedSet.has(a.email.toLowerCase());
          const bFailed = failedSet.has(b.email.toLowerCase());
          if (aFailed !== bFailed) return aFailed ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        // Failed addresses not matched to a known team
        const unknownFailed = (emailDetail.emailFailedAddresses ?? []).filter(
          addr => !acceptedTeams.some(t => t.email.toLowerCase() === addr.toLowerCase()),
        );
        const hasFailures = failedSet.size > 0 || unknownFailed.length > 0;
        const deliveredCount = emailDetail.emailSuccessCount ?? 0;
        const failedCount = failedSet.size + unknownFailed.length;

        return (
          <>
            {/* Email Details modal */}
            <div className="modal-overlay" onClick={closeEmailDetail}>
              <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Email Details</h3>
                  <button className="btn btn-ghost btn-data" onClick={closeEmailDetail}><X size={16} /></button>
                </div>

                <div className={styles.emailDetailBody}>

                  {/* Subject */}
                  <div className={styles.emailDetailField}>
                    <span className={styles.emailDetailLabel}>Subject</span>
                    <span className={styles.emailDetailValue}>{emailDetail.title}</span>
                  </div>

                  {/* Sent */}
                  <div className={styles.emailDetailField}>
                    <span className={styles.emailDetailLabel}>Sent</span>
                    <span className={styles.emailDetailValue}>
                      {formatDate(emailDetail.emailSentAt ?? emailDetail.createdAt)}
                      {emailDetail.sentByEmail && (
                        <span className={styles.emailDetailBy}> · {emailDetail.sentByEmail}</span>
                      )}
                    </span>
                  </div>

                  {/* Recipients — summary row with View all button */}
                  <div className={styles.emailDetailField}>
                    <div className={styles.recipientsSummaryRow}>
                      <span>
                        <span className={styles.emailDetailLabel}>Recipients</span>
                        <span className={styles.emailDetailLabelCount}>
                          {' '}{deliveredCount} delivered
                          {hasFailures && ` · ${failedCount} failed`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-data"
                        onClick={() => setEmailDetailRecipientsOpen(true)}
                      >
                        View all
                      </button>
                    </div>
                  </div>

                  {/* Message body */}
                  <div className={styles.emailDetailField}>
                    <span className={styles.emailDetailLabel}>Message</span>
                    <div className={styles.emailDetailMessage}>{emailDetail.body}</div>
                  </div>

                </div>

                <div className="modal-footer">
                  <button className="btn btn-ghost btn-data" onClick={closeEmailDetail}>
                    Close
                  </button>
                </div>
              </div>
            </div>

            {/* Recipients modal — renders on top of Email Details */}
            {emailDetailRecipientsOpen && (
              <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setEmailDetailRecipientsOpen(false)}>
                <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Recipients</h3>
                    <button className="btn btn-ghost btn-data" onClick={() => setEmailDetailRecipientsOpen(false)}><X size={16} /></button>
                  </div>

                  <div className={styles.recipientsModalBody}>
                    <div className={styles.recipientsModalMeta}>
                      <span>
                        <span style={{ color: hasFailures ? 'var(--warning)' : 'var(--success)' }}>
                          {deliveredCount} delivered
                        </span>
                        {hasFailures && (
                          <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>
                            · {failedCount} failed
                          </span>
                        )}
                      </span>
                      {hasFailures && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-data"
                          onClick={() => navigator.clipboard.writeText(
                            (emailDetail.emailFailedAddresses ?? []).join('\n'),
                          )}
                        >
                          <Copy size={12} /> Copy failed
                        </button>
                      )}
                    </div>

                    <div className={styles.emailDetailRecipientList}>
                      {sortedTeams.map(t => {
                        const failed = failedSet.has(t.email.toLowerCase());
                        return (
                          <div key={t.id} className={`${styles.emailDetailRecipientRow} ${failed ? styles.recipientFailed : styles.recipientDelivered}`}>
                            <span className={styles.recipientIcon}>
                              {failed ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                            </span>
                            <span className={styles.recipientName}>{t.name}</span>
                            <span className={styles.recipientEmail}>{t.email}</span>
                          </div>
                        );
                      })}
                      {unknownFailed.map(addr => (
                        <div key={addr} className={`${styles.emailDetailRecipientRow} ${styles.recipientFailed}`}>
                          <span className={styles.recipientIcon}><AlertCircle size={13} /></span>
                          <span className={styles.recipientName} style={{ color: 'var(--white-40)', fontStyle: 'italic' }}>Unknown team</span>
                          <span className={styles.recipientEmail}>{addr}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button className="btn btn-ghost btn-data" onClick={() => setEmailDetailRecipientsOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Site post edit modal ────────────────────────────────────────────── */}
      {editingId && !isComposing && (() => {
        const editItem = communications.find(c => c.id === editingId);
        const isDeleted = !!editItem?.deletedAt;
        return (
          <div className="modal-overlay" onClick={cancelCompose}>
            <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{isDeleted ? 'Post Details' : 'Edit Post'}</h3>
                <button className="btn btn-ghost btn-data" onClick={cancelCompose}><X size={16} /></button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className={styles.editModalBody}>
                  {/* Title */}
                  <div className={styles.formGroup}>
                    <label className="form-label">Title *</label>
                    <input
                      className="form-input"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Schedule is live — U14 Boys"
                      required
                    />
                  </div>

                  {/* Body */}
                  <div className={styles.formGroup}>
                    <label className="form-label">Message *</label>
                    <textarea
                      className="form-textarea"
                      rows={7}
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder="Write your message here…"
                      required
                    />
                  </div>

                  {/* Pin toggle */}
                  {!isDeleted && (
                    <>
                      <label className={styles.pinLabel}>
                        <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                        <Star size={13} fill={pinned ? 'currentColor' : 'none'} />
                        Pin at top of News page
                      </label>
                      <p style={{ margin: '0.25rem 0 0 1.7rem', fontSize: '0.72rem', color: 'var(--white-50)', lineHeight: 1.4 }}>
                        While the tournament is live, pinned site posts also appear as a banner at the top of the public Schedule — use it for rain delays and urgent day-of updates.
                      </p>
                    </>
                  )}

                  {/* Division visibility */}
                  {divisions.length > 0 && !isDeleted && (
                    <div className={styles.divisionCheckList}>
                      <span className={styles.divisionFilterLabel}>Division visibility</span>
                      <label className={styles.divisionCheckRow}>
                        <input type="checkbox" checked={siteDivisionIds.size === 0} onChange={() => setSiteDivisionIds(new Set())} />{' '}
                        All divisions
                      </label>
                      <div className={styles.divisionCheckIndent}>
                        {divisions.map(g => (
                          <label key={g.id} className={styles.divisionCheckRow}>
                            <input
                              type="checkbox"
                              checked={siteDivisionIds.has(g.id)}
                              onChange={() => setSiteDivisionIds(prev => toggleSetValue(prev, g.id))}
                            />
                            {g.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline error */}
                  {sendResult?.type === 'error' && (
                    <div className={styles.inlineError}>
                      <AlertCircle size={14} /> {sendResult.msg}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  {/* Left: destructive action */}
                  {isDeleted ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-data"
                      onClick={async () => { const id = editingId; cancelCompose(); await handleRestore(id); }}
                    >
                      <RotateCcw size={14} /> Restore to site
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-data"
                      onClick={() => { const id = editingId; cancelCompose(); setDeleteId(id); }}
                    >
                      <Trash2 size={14} /> Remove from site
                    </button>
                  )}
                  {/* Right: save / cancel */}
                  <button type="button" className="btn btn-ghost btn-data" onClick={cancelCompose}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-lime btn-data" disabled={sending}>
                    {sending ? <><RefreshCw className="spin" size={14} /> Saving…</> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
