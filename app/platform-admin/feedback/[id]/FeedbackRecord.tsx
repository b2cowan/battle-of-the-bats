'use client';
/**
 * A feedback item's own record, on the screen (Support console Stage 5, Part 6; drawing D2 and D5). The server half is
 * `page.tsx`, which hands over finished sentences and times.
 *
 * Reads first. The pencil turns the Triage card into fields — State, Severity and Escalated as ONE edit — and the check
 * mark confirms in one sentence; no reason is asked, because triage is the console's own work tool (Stage 3's ruling).
 * Reply is an outlined button (a door that opens a window) for the roles that may reply; where a role may reply but this
 * item cannot be answered, one line of words stands in its place (absent beats disabled). The conversation is a thread in
 * the Story's row idiom — when and who above, the words below — not chat bubbles.
 */
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { cap, feedbackStatusChip, feedbackTypeChip } from '../../chips';
import { errorOf, sendJson } from '../../console-fetch';
import type { SentTone } from '@/lib/sent-log-words';
import RecordWindow from '../../RecordWindow';
import ReplyWindow, { type ReplyWindowProps } from './ReplyWindow';
import kit from '../../console.module.css';
import record from '../../record.module.css';
import styles from '../feedback.module.css';

export type ConversationTurn = {
  key: string;
  /** "Oct 26, 9:15 a.m." */
  when: string;
  who: string;
  /** Quiet words beside who: "sent by the product", "by alex@…". */
  tag?: string;
  /** What the mail service says happened, as a word and a tone, with its time. */
  state?: { word: string; tone: SentTone; at: string | null };
  body: string;
  quiet?: boolean;
};

export type FeedbackRecordProps = {
  id: string;
  title: string;
  type: string;
  status: string;
  severity: string | null;
  escalated: boolean;
  from: { name: string; href: string } | null;
  club: { id: string; name: string } | null;
  when: string;
  category: string | null;
  conversation: ConversationTurn[];
  issue: { id: string; title: string; line: string } | null;
  triagedBy: { by: string; at: string | null } | null;
  canTriage: boolean;
  /** null = this role has no Reply power at all (nothing is drawn); a line = it may, but not to this one. */
  reply: { kind: 'door'; window: ReplyWindowProps } | { kind: 'none'; words: string } | null;
};

const STATES = ['new', 'triaged', 'acknowledged', 'resolved'] as const;
const SEVERITIES = ['critical', 'error', 'warning', 'info'] as const;

const TONE: Record<SentTone, string> = {
  plain: kit.chipQuiet,
  ok: kit.chipOk,
  warn: kit.chipWarn,
  bad: kit.chipBad,
};

type Win = 'save' | 'discard' | 'reply' | null;

export default function FeedbackRecord(p: FeedbackRecordProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [win, setWin] = useState<Win>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [form, setForm] = useState({ status: p.status, severity: p.severity ?? '', escalated: p.escalated });

  const statusChanged = form.status !== p.status;
  const severityChanged = form.severity !== (p.severity ?? '');
  const escalatedChanged = form.escalated !== p.escalated;
  const changed = statusChanged || severityChanged || escalatedChanged;

  const pencilRef = useRef<HTMLButtonElement>(null);
  const stopEditing = () => { setEditing(false); requestAnimationFrame(() => pencilRef.current?.focus()); };

  const toggleEdit = () => {
    if (!editing) { setForm({ status: p.status, severity: p.severity ?? '', escalated: p.escalated }); setNotice(null); setEditing(true); return; }
    if (!changed) { stopEditing(); return; }
    setWin('save');
  };
  const discardEdit = () => { if (!changed) stopEditing(); else setWin('discard'); };

  async function save(): Promise<string | null> {
    const base = `/api/platform-admin/feedback/${p.id}`;
    if (statusChanged || severityChanged) {
      const { ok, data } = await sendJson(`${base}/status`, 'POST', {
        status: form.status,
        ...(severityChanged && form.severity ? { severity: form.severity } : {}),
      });
      if (!ok) return errorOf(data, 'That did not go through. Try again in a moment.');
    }
    if (escalatedChanged) {
      const { ok, data } = await sendJson(`${base}/escalate`, 'POST', { escalate: form.escalated });
      if (!ok) {
        router.refresh();
        return `${errorOf(data, 'The flag did not go through.')} The other changes were saved.`;
      }
    }
    setEditing(false);
    setWin(null);
    setNotice(null);
    router.refresh();
    return null;
  }

  const sentence = (
    <>
      {statusChanged && <>State becomes <strong>{cap(form.status)}</strong>. </>}
      {severityChanged && <>Severity becomes <strong>{form.severity ? cap(form.severity) : 'not set'}</strong>. </>}
      {escalatedChanged && (form.escalated ? <>It is flagged for the product team. </> : <>The flag for the product team is cleared. </>)}
      Nobody is emailed.
    </>
  );

  return (
    <div className={kit.page}>
      <AdminPageHeader
        backTo={{ href: '/platform-admin/feedback', label: 'Feedback' }}
        title={p.title}
        titleChips={(
          <>
            <span className={`${kit.chip} ${feedbackTypeChip(p.type)}`}>{cap(p.type)}</span>
            <span className={`${kit.chip} ${feedbackStatusChip(p.status)}`}>{cap(p.status)}</span>
            {p.escalated && <span className={`${kit.chip} ${kit.chipBad}`} title="Flagged for the product team">Escalated</span>}
          </>
        )}
        actions={(p.canTriage || p.reply?.kind === 'door') ? (
          <span className={record.headActions}>
            {p.canTriage && (
              <>
                <button type="button" ref={pencilRef} className={`${record.pencil}${editing ? ` ${record.pencilOn}` : ''}`} onClick={toggleEdit}
                  aria-label={editing ? 'Done editing — review the changes' : 'Edit the triage'} title={editing ? 'Done editing' : 'Edit'}>
                  {editing ? <Check size={16} aria-hidden /> : <Pencil size={15} aria-hidden />}
                </button>
                {editing && (
                  <button type="button" className={record.pencil} onClick={discardEdit} aria-label="Discard changes and stop editing" title="Discard changes">
                    <X size={16} aria-hidden />
                  </button>
                )}
              </>
            )}
            {p.reply?.kind === 'door' && <button type="button" className="btn btn-secondary" onClick={() => setWin('reply')}>Reply</button>}
          </span>
        ) : undefined}
      />

      <p className={styles.meta}>
        {p.from ? <Link href={p.from.href} className={kit.nameLink}>{p.from.name}</Link> : <>Not signed in</>}
        <span className={styles.metaSep}>·</span>
        {p.club ? <Link href={`/platform-admin/orgs/${p.club.id}`} className={kit.nameLink}>{p.club.name}</Link> : <>no club</>}
        <span className={styles.metaSep}>·</span>
        {p.when}
        {p.category && <><span className={styles.metaSep}>·</span>{p.category}</>}
        <span className={styles.metaSep}>·</span>
        Severity {p.severity ? cap(p.severity) : 'not set'}
      </p>
      {p.reply?.kind === 'none' && <p className={styles.noReply}>{p.reply.words}</p>}
      {editing && <p className={record.caption}>Editing. Nothing changes until you press the check mark and confirm. The ✕ puts everything back.</p>}
      {notice && <div className={`${kit.notice} ${kit.noticeGood}`} role="status">{notice}</div>}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={kit.section}>
            <h2 className={kit.sectionTitle}>The conversation</h2>
            <div className={kit.card}>
              {p.conversation.map(t => (
                <div key={t.key} className={styles.turn}>
                  <div className={styles.turnHead}>
                    <span className={styles.turnWhen}>{t.when}</span>
                    <span className={styles.turnWho}>{t.who}</span>
                    {t.tag && <span className={styles.turnTag}>{t.tag}</span>}
                    {t.state && (
                      <span className={styles.turnState}>
                        <span className={`${kit.chip} ${TONE[t.state.tone]}`}>{t.state.word}</span>
                        {t.state.at && <span>{t.state.at}</span>}
                      </span>
                    )}
                  </div>
                  <p className={`${styles.turnBody}${t.quiet ? ` ${styles.turnQuiet}` : ''}`}>{t.body}</p>
                </div>
              ))}
              <div className={styles.threadFoot}>A customer&rsquo;s answer to a reply arrives in the admin inbox, not here.</div>
            </div>
          </section>
        </div>

        <div className={styles.side}>
          {p.issue && (
            <div className={`${kit.card} ${kit.cardPad}`}>
              <h2 className={styles.sideTitle}>The issue it hit</h2>
              <p className={styles.sideValue}>{p.issue.title}</p>
              <p className={styles.sideNote}>{p.issue.line}</p>
              <Link href={`/platform-admin/observability/${p.issue.id}`} className={`${kit.door} ${styles.sideDoor}`}>Open the issue ›</Link>
            </div>
          )}

          <div className={`${kit.card} ${kit.cardPad}`}>
            <h2 className={styles.sideTitle}>Triage</h2>
            <div className={styles.sideFacts}>
              <div className={styles.sideFact}>
                <span className={kit.bandLabel}>State</span>
                {editing ? (
                  <select className={`${kit.select} ${statusChanged ? record.changed : ''}`} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} aria-label="State">
                    {STATES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                ) : <span className={styles.sideValue}>{cap(p.status)}</span>}
              </div>
              <div className={styles.sideFact}>
                <span className={kit.bandLabel}>Severity</span>
                {editing ? (
                  <select className={`${kit.select} ${severityChanged ? record.changed : ''}`} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} aria-label="Severity">
                    {/* A severity once set cannot be cleared, so "Not set" is offered only while it is not set. */}
                    {!p.severity && <option value="">Not set</option>}
                    {SEVERITIES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                ) : <span className={styles.sideValue}>{p.severity ? cap(p.severity) : 'Not set'}</span>}
              </div>
              <div className={styles.sideFact}>
                <span className={kit.bandLabel}>Escalated</span>
                {editing ? (
                  <select className={`${kit.select} ${escalatedChanged ? record.changed : ''}`} value={form.escalated ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, escalated: e.target.value === 'yes' }))} aria-label="Escalated to the product team">
                    <option value="no">No</option>
                    <option value="yes">Yes, to the product team</option>
                  </select>
                ) : <span className={styles.sideValue}>{p.escalated ? 'Yes' : 'No'}</span>}
              </div>
              <div className={styles.sideFact}>
                <span className={kit.bandLabel}>Triaged by</span>
                <span className={styles.sideValue}>{p.triagedBy ? p.triagedBy.by : 'Nobody yet'}</span>
                {p.triagedBy?.at && <span className={styles.sideNote}>{p.triagedBy.at}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {win === 'save' && (
        <RecordWindow
          title="Save the triage changes"
          sentence={sentence}
          footNote="Kept in the audit log."
          cancelLabel="Keep editing"
          confirmLabel="Save changes"
          askWhy={false}
          onConfirm={save}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'discard' && (
        <RecordWindow
          title="Discard your changes"
          sentence={<>Your edits are dropped and this item goes back to reading, exactly as it was. Nothing is saved.</>}
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          askWhy={false}
          onConfirm={async () => { setWin(null); stopEditing(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      <UnsavedChangesGuard active={editing && changed} message="You have unsaved triage changes. Leave without saving them?" />
      {win === 'reply' && p.reply?.kind === 'door' && (
        <ReplyWindow
          props={p.reply.window}
          onClose={() => setWin(null)}
          onSent={(to, moved) => {
            setWin(null);
            setNotice(<><strong>Reply sent to {to}.</strong>{moved ? " The feedback is Acknowledged and has left Today's New feedback." : ''}</>);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
