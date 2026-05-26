'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Globe, Lock,
  Mail, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Send,
  Star, Trash2, Users, X,
} from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { Division, Communication, Team } from '@/lib/types';
import styles from './communication.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryFilter = 'all' | 'site' | 'email';

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

function getDraftKey(tournamentId: string) {
  return `comm-draft-${tournamentId}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCommunicationPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const orgSlug  = currentOrg?.slug;
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '?';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const billingHref = `/${orgSlug}/admin/org/billing`;

  // ── Data ────────────────────────────────────────────────────────────────────
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [teams,     setTeams]    = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [sending,   setSending]  = useState(false);

  // ── View state ──────────────────────────────────────────────────────────────
  const [isComposing,   setIsComposing]   = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [overflowOpen,  setOverflowOpen]  = useState<string | null>(null);
  const [sendResult,    setSendResult]    = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Compose fields ──────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [channelSite, setChannelSite] = useState(true);
  const [channelEmail,setChannelEmail]= useState(false);
  const [pinned,      setPinned]      = useState(false);
  const [siteDivisionIds, setSiteDivisionIds] = useState<Set<string>>(() => new Set());
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Draft persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComposing || !currentTournament?.id || editingId) return;
    const raw = localStorage.getItem(getDraftKey(currentTournament.id));
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.title || d.body) {
        setTitle(d.title ?? '');
        setBody(d.body ?? '');
        setChannelSite(d.channelSite ?? true);
        setChannelEmail(d.channelEmail ?? false);
        setPinned(d.pinned ?? false);
        setDraftRestored(true);
      }
    } catch { /* ignore corrupt drafts */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComposing]);

  useEffect(() => {
    if (!isComposing || !currentTournament?.id || editingId) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (title || body) {
        localStorage.setItem(
          getDraftKey(currentTournament.id),
          JSON.stringify({ title, body, channelSite, channelEmail, pinned }),
        );
      }
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [title, body, channelSite, channelEmail, pinned, isComposing, editingId, currentTournament?.id]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const divisionNameById = useMemo(() => new Map(divisions.map(g => [g.id, g.name])), [divisions]);
  const acceptedTeamCount = useMemo(() => teams.filter(t => t.status === 'accepted').length, [teams]);

  // ── Compose helpers ──────────────────────────────────────────────────────────
  function openNewMessage() {
    setEditingId(null);
    setIsComposing(true);
    setSendResult(null);
    setDraftRestored(false);
  }

  function openEdit(item: Communication) {
    setTitle(item.title);
    setBody(item.body);
    setPinned(item.pinned);
    setSiteDivisionIds(new Set(item.divisionIds ?? []));
    setChannelSite(item.channelSite);
    setChannelEmail(false);
    setEditingId(item.id);
    setIsComposing(true);
    setSendResult(null);
    setDraftRestored(false);
    setOverflowOpen(null);
  }

  function cancelCompose() {
    setIsComposing(false);
    setEditingId(null);
    setTitle(''); setBody(''); setPinned(false);
    setSiteDivisionIds(new Set());
    setChannelSite(true); setChannelEmail(false);
    setDraftRestored(false);
    setActiveTemplate(null);
  }

  function applyTemplate(tpl: typeof QUICK_TEMPLATES[number]) {
    const tName = currentTournament?.name ?? 'the tournament';
    setTitle(tpl.title.replace('{{tournament}}', tName));
    setBody(tpl.body.replace(/{{tournament}}/g, tName));
    setActiveTemplate(tpl.label);
  }

  function saveDraftAndClose() {
    if (currentTournament?.id && (title || body)) {
      localStorage.setItem(
        getDraftKey(currentTournament.id),
        JSON.stringify({ title, body, channelSite, channelEmail, pinned }),
      );
    }
    cancelCompose();
  }

  function clearDraft() {
    if (currentTournament?.id) localStorage.removeItem(getDraftKey(currentTournament.id));
    setDraftRestored(false);
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

        if (currentTournament.id) localStorage.removeItem(getDraftKey(currentTournament.id));

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

  // ── Toggle pin ────────────────────────────────────────────────────────────────
  async function handleTogglePin(item: Communication) {
    setOverflowOpen(null);
    await fetch(`/api/admin/communications${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-pin', id: item.id }),
    });
    await loadData();
  }

  // ── Filtered history ─────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'site')  return communications.filter(c => c.channelSite);
    if (historyFilter === 'email') return communications.filter(c => c.channelEmail);
    return communications;
  }, [communications, historyFilter]);

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
        {!isComposing && (
          <button className="btn btn-lime btn-data" onClick={openNewMessage} disabled={!currentTournament}>
            <Plus size={15} /> New Message
          </button>
        )}
      </div>

      {/* ── Result banner ───────────────────────────────────────────────────── */}
      {sendResult && !isComposing && (
        <div className={`${styles.resultBanner} ${sendResult.type === 'success' ? styles.resultSuccess : styles.resultError}`}>
          {sendResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{sendResult.msg}</span>
          <button className={styles.bannerDismiss} onClick={() => setSendResult(null)}><X size={14} /></button>
        </div>
      )}

      {/* ── Compose panel ──────────────────────────────────────────────────── */}
      {isComposing && (
        <form className={styles.composePanel} onSubmit={handleSubmit}>

          <div className={styles.composePanelHeader}>
            <span className={styles.composePanelTitle}>{editingId ? 'Edit Post' : 'New Message'}</span>
            <button type="button" className="btn btn-ghost btn-data" onClick={cancelCompose}>
              <X size={14} /> Cancel
            </button>
          </div>

          {/* Draft restored notice */}
          {draftRestored && (
            <div className={styles.draftNotice}>
              <RotateCcw size={13} /> Draft restored
              <button type="button" className={styles.draftClear} onClick={clearDraft}>Clear</button>
            </div>
          )}

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
              rows={7}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here…"
              required
            />
          </div>

          {/* ── Channels ──────────────────────────────────────────────────── */}
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

                  {/* Division visibility — T+ only, shown inline when divisions exist */}
                  {divisions.length > 0 && (
                    <div className={styles.divisionFilter}>
                      <span className={styles.divisionFilterLabel}>Show for:</span>
                      <label className={styles.smallCheckLabel}>
                        <input type="checkbox" checked={siteDivisionIds.size === 0} onChange={() => setSiteDivisionIds(new Set())} />
                        All divisions
                      </label>
                      {divisions.map(g => (
                        <label key={g.id} className={styles.smallCheckLabel}>
                          <input
                            type="checkbox"
                            checked={siteDivisionIds.has(g.id)}
                            onChange={() => setSiteDivisionIds(prev => toggleSetValue(prev, g.id))}
                          />
                          {g.name}
                        </label>
                      ))}
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

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className={styles.composeActions}>
            {!editingId && (
              <button type="button" className="btn btn-ghost btn-data" onClick={saveDraftAndClose}>
                Save Draft
              </button>
            )}
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

          {/* Inline result (errors during compose) */}
          {sendResult && isComposing && (
            <div className={`${styles.inlineResult} ${sendResult.type === 'success' ? styles.inlineSuccess : styles.inlineError}`}>
              {sendResult.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {sendResult.msg}
            </div>
          )}
        </form>
      )}

      {/* ── History ────────────────────────────────────────────────────────── */}
      <div className={styles.historySection}>
        {communications.length > 0 && (
          <div className={styles.filterTabs}>
            {(['all', 'site', 'email'] as HistoryFilter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterTab} ${historyFilter === f ? styles.filterTabActive : ''}`}
                onClick={() => setHistoryFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'site' ? <><Globe size={12} /> Site Posts</> : <><Mail size={12} /> Emails</>}
              </button>
            ))}
          </div>
        )}

        {filteredHistory.length === 0 && !isComposing && (
          <div className="empty-state">
            <Mail size={40} />
            <p className={styles.emptyTitle}>No communications yet</p>
            <p>Post an update to your site, email your teams, or both — from one place.</p>
            <button className={`btn btn-lime ${styles.emptyCta}`} onClick={openNewMessage} disabled={!currentTournament}>
              <Plus size={15} /> New Message
            </button>
          </div>
        )}

        {filteredHistory.map(item => (
          <div key={item.id} className={`${styles.commCard} ${item.pinned ? styles.commCardPinned : ''}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardMeta}>
                {item.pinned && (
                  <span className="badge badge-primary"><Star size={9} fill="currentColor" /> Pinned</span>
                )}
                <span className={styles.cardDate}>{formatDate(item.createdAt)}</span>
              </div>

              <div className={styles.cardActions}>
                {item.channelSite && (
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit site post">
                    <Pencil size={13} />
                  </button>
                )}
                <div className={styles.overflowWrap}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOverflowOpen(prev => prev === item.id ? null : item.id)}
                    title="More actions"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {overflowOpen === item.id && (
                    <div className={styles.overflowMenu}>
                      {item.channelSite && (
                        <button onClick={() => handleTogglePin(item)}>
                          <Star size={13} fill={item.pinned ? 'currentColor' : 'none'} />
                          {item.pinned ? 'Unpin' : 'Pin at top'}
                        </button>
                      )}
                      {item.channelEmail && !!item.emailFailedCount && item.emailFailedCount > 0 && !!item.emailFailedAddresses?.length && (
                        <button onClick={() => { navigator.clipboard.writeText(item.emailFailedAddresses!.join('\n')); setOverflowOpen(null); }}>
                          <AlertCircle size={13} />
                          Copy {item.emailFailedCount} failed address{item.emailFailedCount === 1 ? '' : 'es'}
                        </button>
                      )}
                      <button className={styles.deleteAction} onClick={() => { setDeleteId(item.id); setOverflowOpen(null); }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardPreview}>{item.body.length > 140 ? item.body.slice(0, 140) + '…' : item.body}</p>

            <div className={styles.cardFooter}>
              <div className={styles.channelBadges}>
                {item.channelSite && (
                  <span className={styles.badgeSite}><Globe size={11} /> Site Post</span>
                )}
                {item.channelEmail && (
                  <span className={`${styles.badgeEmail} ${item.emailFailedCount ? styles.badgeEmailWarn : ''}`}>
                    <Mail size={11} />
                    {item.emailFailedCount
                      ? `${item.emailSuccessCount} sent · ⚠ ${item.emailFailedCount} failed`
                      : `Emailed · ${item.emailSuccessCount ?? item.emailRecipientCount ?? 0}`}
                  </span>
                )}
              </div>
              {item.sentByEmail && <span className={styles.sentBy}>{item.sentByEmail}</span>}
            </div>
          </div>
        ))}
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
              This removes the record permanently. If this was a site post, it will be removed from the public News page immediately.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-data" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {overflowOpen && <div className={styles.overflowBackdrop} onClick={() => setOverflowOpen(null)} />}
    </div>
  );
}
