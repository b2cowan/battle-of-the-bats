'use client';
/**
 * COMMUNICATIONS (Tournament admin redesign Stage 2, C1 · C2 — ruled 2026-09-30, hub v16).
 *
 *   C1  ONE LIST: one row per message — a message sent to the site AND by email is one row, because it
 *       is one record (`channel_site` + `channel_email` on the same announcement). The row says when,
 *       where it went and how many it reached ("Jun 13 · On the site, pinned · Emailed to 18"); a failed
 *       send is the one coloured word. One filter (All · On the site · Emailed). A post removed from the
 *       site is a band at the foot — the record is kept, so "removed", never "deleted". Every row opens
 *       the message's record in the kit's form window. At a desk, a table (Date · Message · Where it
 *       went · Reached). The empty state is one sentence; the header's + is its one action.
 *   C2  THE COMPOSER says the true thing (MessageComposer): who an email reaches is the send's own rule.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Copy, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature } from '@/lib/plan-features';
import { formatStoredDate } from '@/lib/timezone';
import { Division, Communication } from '@/lib/types';
import { COMMS_WORDS as W, RECIPIENTS_NOT_KEPT } from '@/lib/communication-words';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, repKit } from '@/components/admin/kit/club/RepKit';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import { joinDots, RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import MessageComposer, { targetingOf, type ComposerValues } from './MessageComposer';
import styles from './communication.module.css';

type Lens = 'all' | 'site' | 'email';

const EMPTY: ComposerValues = {
  title: '', body: '', pinned: false, channelSite: true, channelEmail: false, channelPush: false,
  divisionIds: [], teamChoice: 'accepted', divisionChoice: '', paymentChoice: 'any',
};

const shortDate = (iso: string) => formatStoredDate(iso, { withYear: false });

/** "Jun 13 · On the site, pinned · Emailed to 18 · 1 failed" — when, where it went, how many it reached. */
function rowCaption(c: Communication): React.ReactNode {
  return joinDots([
    shortDate(c.createdAt),
    c.channelSite && (c.deletedAt ? W.removedOn(shortDate(c.deletedAt)) : c.pinned ? W.onSitePinned : W.onSite),
    c.channelEmail && W.emailedTo(c.emailRecipientCount),
    (c.emailFailedCount ?? 0) > 0 && <span className={styles.bad}>{W.failed(c.emailFailedCount!)}</span>,
  ]);
}

export default function AdminCommunicationPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Communications');
  const orgSlug  = currentOrg?.slug;
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '?';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const billingHref = `/${orgSlug}/admin/tournaments/settings/subscription`;
  const planHref = `${billingHref}?plan=tournament_plus`;

  // ── Data ──
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // ── View ──
  const [lens, setLens] = useState<Lens>('all');
  const [composing, setComposing] = useState<'new' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emailDetailId, setEmailDetailId] = useState<string | null>(null);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [values, setValues] = useState<ComposerValues>(EMPTY);
  // The composer's fields when it opened — the unsaved-changes guard warns only on a genuine edit.
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY));

  // Only an event's FIRST read blanks the screen; the re-read after a send, a removal or a restore
  // keeps it (and the window on it) standing (/review 2026-09-30).
  const loadedFor = useRef<string | null>(null);
  const loadData = useCallback(async () => {
    if (!currentTournament?.id) {
      setCommunications([]); setDivisions([]);
      setLoading(false);
      return;
    }
    if (loadedFor.current !== currentTournament.id) setLoading(true);
    loadedFor.current = currentTournament.id;
    const tid = encodeURIComponent(currentTournament.id);
    const [commsRes, groupsRes] = await Promise.all([
      fetch(`/api/admin/communications?tournamentId=${tid}${orgParam}`),
      fetch(`/api/admin/divisions?tournamentId=${tid}${orgParam}`),
    ]);
    setCommunications(commsRes.ok ? await commsRes.json() : []);
    setDivisions(groupsRes.ok ? await groupsRes.json() : []);
    setLoading(false);
  }, [currentTournament?.id, orgParam]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Targeted sends and a post shown under chosen divisions are Tournament Plus — the send refuses
  // either without it, so the Tournament plan sees the lock with the plan's name (F43, A6, A14).
  const canTarget = currentOrg ? hasPlanFeature(currentOrg.planId, 'targeted_tournament_announcements') : false;
  const canPush = currentOrg ? hasPlanFeature(currentOrg.planId, 'fan_score_alerts') : false;

  function openNew() {
    setValues(EMPTY); setBaseline(JSON.stringify(EMPTY));
    setEditingId(null); setComposeError(null); setResult(null);
    setComposing('new');
  }
  function openPost(item: Communication) {
    const v: ComposerValues = { ...EMPTY, title: item.title, body: item.body, pinned: item.pinned, divisionIds: item.divisionIds ?? [] };
    setValues(v); setBaseline(JSON.stringify(v));
    setEditingId(item.id); setComposeError(null); setResult(null);
    setComposing('edit');
  }
  function closeComposer() {
    setComposing(null); setEditingId(null); setComposeError(null);
  }
  /** A site post opens its post record (with its email inside, if it went both ways); an email-only
   *  message opens its email record. */
  function openRecord(item: Communication) {
    if (item.channelSite) { openPost(item); return; }
    setRecipientsOpen(false);
    setEmailDetailId(item.id);
  }

  async function submit() {
    if (!currentTournament?.id) return;
    setSending(true); setComposeError(null);
    try {
      if (composing === 'edit' && editingId) {
        const res = await fetch(`/api/admin/communications${orgQuery}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update', id: editingId,
            // Divisions are sent only where the plan can set them: a Tournament plan editing an older
            // division-scoped post leaves them as they are rather than being refused (F43).
            data: { title: values.title.trim(), body: values.body.trim(), pinned: values.pinned, ...(canTarget ? { divisionIds: values.divisionIds } : {}) },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'That didn’t save.');
        setResult({ type: 'success', msg: 'Post updated.' });
      } else {
        const res = await fetch(`/api/admin/communications${orgQuery}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            data: {
              tournamentId: currentTournament.id,
              title: values.title.trim(),
              body: values.body.trim(),
              channelSite: values.channelSite,
              channelEmail: values.channelEmail,
              channelPush: values.channelPush,
              pinned: values.pinned,
              divisionIds: canTarget && values.channelSite ? values.divisionIds : [],
              // The picker's choices ARE the send's targeting; none chosen = every accepted team.
              targeting: values.channelEmail ? targetingOf(values, canTarget) : null,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'That didn’t send.');
        // One result line covering every channel that ran.
        const email = json.emailResults;
        const push = json.pushResults;
        const parts: string[] = [];
        if (values.channelSite) parts.push('posted to the site');
        if (values.channelEmail && email) parts.push(`emailed ${email.sent}${email.failed ? ` (${email.failed} failed)` : ''}`);
        if (values.channelPush && push) {
          if (push.sent > 0) parts.push(`pushed to ${push.sent} fan${push.sent === 1 ? '' : 's'}${push.failed ? ` (${push.failed} failed)` : ''}`);
          else if (push.failed > 0) parts.push(`push failed for ${push.failed} device${push.failed === 1 ? '' : 's'}`);
          else parts.push('no fans have alerts on yet');
        }
        const joined = parts.join(' · ');
        const pushHadError = values.channelPush && push && push.failed > 0;
        setResult({
          type: (values.channelEmail && email?.failed > 0) || pushHadError ? 'error' : 'success',
          msg: joined ? joined.charAt(0).toUpperCase() + joined.slice(1) + '.' : 'Done.',
        });
      }
      await loadData();
      closeComposer();
    } catch (err: unknown) {
      setComposeError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  async function post(action: 'delete' | 'restore', id: string) {
    await fetch(`/api/admin/communications${orgQuery}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    await loadData();
  }

  // ── The list ──
  const counts = useMemo(() => ({
    all: communications.length,
    site: communications.filter(c => c.channelSite).length,
    email: communications.filter(c => c.channelEmail).length,
  }), [communications]);
  // A post removed from the site sits in the foot band — except under Emailed, where the email is the record.
  const { live, removed } = useMemo(() => {
    const inLens = communications.filter(c => lens === 'all' || (lens === 'site' ? c.channelSite : c.channelEmail));
    const isRemoved = (c: Communication) => lens !== 'email' && c.channelSite && !!c.deletedAt;
    return { live: inLens.filter(c => !isRemoved(c)), removed: inLens.filter(isRemoved) };
  }, [communications, lens]);
  const emailDetail = useMemo(() => communications.find(c => c.id === emailDetailId) ?? null, [communications, emailDetailId]);
  const editItem = useMemo(() => (editingId ? communications.find(c => c.id === editingId) ?? null : null), [communications, editingId]);

  const composerDirty = composing != null && !sending && JSON.stringify(values) !== baseline;

  if (loading) return <div className="empty-state"><RefreshCw className="spin" /><p>Loading communications…</p></div>;

  const newButton = (
    <button type="button" className={`btn btn-lime btn-data ${screenParts.headerButton}`} onClick={openNew} disabled={!currentTournament} aria-label={W.newMessage} title={W.newMessage}>
      <Plus size={15} aria-hidden /><span className={screenParts.headerButtonLabel}>{W.newMessage}</span>
    </button>
  );

  const deskRow = (c: Communication, isRemoved: boolean) => {
    const failed = c.emailFailedCount ?? 0;
    const total = c.emailRecipientCount ?? ((c.emailSuccessCount ?? 0) + failed || null);
    const where = [
      c.channelSite ? (isRemoved ? `${W.whereSite(false)} · ${W.removedOn(shortDate(c.deletedAt!))}` : W.whereSite(c.pinned)) : null,
      c.channelEmail ? W.whereEmail : null,
    ].filter(Boolean).join(' · ');
    return (
      <tr key={c.id} className={repKit.rowOpens} onClick={() => openRecord(c)}>
        <td className={repKit.dim}>{formatStoredDate(c.createdAt)}</td>
        <td>
          <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); openRecord(c); }}>{c.title}</button>
        </td>
        <td>{where}</td>
        <td>
          {c.channelEmail && total != null
            ? <>{W.reached(c.emailSuccessCount ?? 0, total)}{failed > 0 && <> · <span className={styles.bad}>{W.failed(failed)}</span></>}</>
            : <span className={repKit.dim}>—</span>}
        </td>
        <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
      </tr>
    );
  };

  return (
    <div className={styles.page}>
      <UnsavedChangesGuard active={composerDirty} message="You have an unsent message with unsaved changes. Leave without sending it?" />

      <TournamentAdminHeader title="Communications" mobileActionsInline actions={newButton} />

      {result && composing == null && (
        <Callout tone={result.type === 'success' ? 'olive' : 'bad'} role="status"
          icon={result.type === 'success' ? <CheckCircle2 size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}>
          <div className={styles.resultLine}>
            <span>{result.msg}</span>
            <button type="button" className={styles.resultDismiss} onClick={() => setResult(null)}>Dismiss</button>
          </div>
        </Callout>
      )}

      {communications.length === 0 ? (
        <p className={styles.empty}>{W.empty}</p>
      ) : (
        <>
          {/* One filter, its count on each choice (Stage 1's one pill shape). */}
          <div className={repKit.views} role="group" aria-label="Show messages">
            {([['all', W.lensAll], ['site', W.lensSite], ['email', W.lensEmail]] as const).map(([k, label]) => (
              <button key={k} type="button" className={`${repKit.view}${lens === k ? ` ${repKit.viewOn}` : ''}`} aria-pressed={lens === k} onClick={() => setLens(k)}>
                {label} <b className={styles.lensCount}>{counts[k]}</b>
              </button>
            ))}
          </div>

          {/* Phone: one frame, a message per row, "Removed from the site" as the foot band. */}
          <div className={`${repKit.phoneOnly} ${styles.listGap}`}>
            <ClubRowFrame>
              {live.length > 0 && (
                <ClubRowList inset label="Messages">
                  {live.map(c => (
                    <ClubRow key={c.id} as="button" onClick={() => openRecord(c)} aria-haspopup="dialog" title={c.title} caption={rowCaption(c)} chevron />
                  ))}
                </ClubRowList>
              )}
              {removed.length > 0 && (
                <ClubRowList inset label={W.removedBand}>
                  <ClubRowBand count={removed.length}>{W.removedBand}</ClubRowBand>
                  {removed.map(c => (
                    <ClubRow key={c.id} as="button" onClick={() => openRecord(c)} aria-haspopup="dialog" title={c.title} caption={rowCaption(c)} chevron />
                  ))}
                </ClubRowList>
              )}
            </ClubRowFrame>
          </div>

          {/* Desk: a table — "Reached" is read down the column to find the send that failed. */}
          <div className={`${repKit.deskOnly} ${repKit.tableFrame} ${styles.listGap}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{W.colDate}</th>
                  <th scope="col">{W.colMessage}</th>
                  <th scope="col">{W.colWhere}</th>
                  <th scope="col">{W.colReached}</th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {live.map(c => deskRow(c, false))}
                {removed.length > 0 && (
                  <tr className={repKit.band}><td colSpan={5}>{W.removedBand} <span className={repKit.rowBandCount}>{removed.length}</span></td></tr>
                )}
                {removed.map(c => deskRow(c, true))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── The composer / a post's record (C2) ── */}
      {composing && currentTournament && (
        <MessageComposer
          mode={composing}
          values={values}
          onChange={patch => setValues(v => ({ ...v, ...patch }))}
          // A template is a starting point, not unsaved work: only edits made after it warn on close.
          onTemplate={patch => { const next = { ...values, ...patch }; setValues(next); setBaseline(JSON.stringify(next)); }}
          divisions={divisions}
          tournamentId={currentTournament.id}
          tournamentName={currentTournament.name ?? 'the tournament'}
          orgQuery={orgQuery}
          canTarget={canTarget}
          canPush={canPush}
          planHref={planHref}
          sending={sending}
          error={composeError}
          onSubmit={() => void submit()}
          onCancel={closeComposer}
          footerStart={composing === 'edit' && editItem ? (
            editItem.deletedAt
              ? <button type="button" className="btn btn-outline" onClick={async () => { closeComposer(); await post('restore', editItem.id); }}><RotateCcw size={14} aria-hidden /> Restore to site</button>
              : <button type="button" className="btn btn-danger" onClick={() => { const id = editItem.id; closeComposer(); setRemoveId(id); }}><Trash2 size={14} aria-hidden /> Remove from site</button>
          ) : undefined}
          emailPart={composing === 'edit' && editItem?.channelEmail ? <EmailRecord item={editItem} open={recipientsOpen} onToggle={() => setRecipientsOpen(o => !o)} /> : null}
        />
      )}

      {/* ── Remove from the site: asks first; the record is kept and can be restored ── */}
      {removeId && (
        <KitDialog
          kind="question"
          title="Remove from the site?"
          onClose={() => setRemoveId(null)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setRemoveId(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={async () => { const id = removeId; setRemoveId(null); await post('delete', id); }}>
                <Trash2 size={14} aria-hidden /> Remove from site
              </button>
            </>
          )}
        >
          <p>This removes the post from your public News page immediately. The record is kept in your communications history and can be restored at any time.</p>
        </KitDialog>
      )}

      {/* ── An email's record ── */}
      {emailDetail && (
        <KitDialog
          kind="form"
          title={emailDetail.title}
          identity={`Sent ${formatStoredDate(emailDetail.emailSentAt ?? emailDetail.createdAt)}${emailDetail.sentByEmail ? ` · ${emailDetail.sentByEmail}` : ''}`}
          onClose={() => setEmailDetailId(null)}
          footer={<button type="button" className="btn btn-outline" onClick={() => setEmailDetailId(null)}>Close</button>}
        >
          <EmailRecord item={emailDetail} open={recipientsOpen} onToggle={() => setRecipientsOpen(o => !o)} />
          <RecordSection title="Message">
            <div className={styles.messageText}>{emailDetail.body}</div>
          </RecordSection>
        </KitDialog>
      )}
    </div>
  );
}

/** Who an email reached — the send's own list (mig 314), never rebuilt from today's teams (F42). */
function EmailRecord({ item, open, onToggle }: { item: Communication; open: boolean; onToggle: () => void }) {
  const failedAddresses = item.emailFailedAddresses ?? [];
  const failedSet = new Set(failedAddresses.map(a => a.toLowerCase()));
  const kept = item.emailRecipients;
  const rows = (kept ?? failedAddresses.map(email => ({ email, teams: [] as Array<{ id: string; name: string }> })))
    .map(r => ({ email: r.email, names: r.teams.map(t => t.name).filter(Boolean).join(' · '), failed: failedSet.has(r.email.toLowerCase()) }))
    .sort((a, b) => (a.failed !== b.failed ? (a.failed ? -1 : 1) : a.names.localeCompare(b.names)));
  const delivered = item.emailSuccessCount ?? 0;
  const failed = failedSet.size;
  return (
    <RecordSection title="Email">
      <p className={screenParts.recordText}>
        {delivered} delivered{failed > 0 && <> · <span className={styles.bad}>{failed} failed</span></>}
      </p>
      {!kept && <p className={screenParts.recordText}>{RECIPIENTS_NOT_KEPT}</p>}
      <div className={screenParts.recordActions}>
        {rows.length > 0 && (
          <button type="button" className={screenParts.plainButton} aria-expanded={open} onClick={onToggle}>See who it reached</button>
        )}
        {failed > 0 && (
          <button type="button" className={screenParts.plainButton} onClick={() => void navigator.clipboard.writeText(failedAddresses.join('\n'))}>
            <Copy size={13} aria-hidden /> Copy failed
          </button>
        )}
      </div>
      {open && rows.length > 0 && (
        <ul className={styles.recipients}>
          {rows.map(r => (
            <li key={r.email} data-failed={r.failed || undefined}>
              {r.failed ? <AlertCircle size={13} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
              <span className={styles.recipientName}>{r.names || 'Unknown team'}</span>
              <span className={styles.recipientEmail}>{r.email}</span>
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
}
