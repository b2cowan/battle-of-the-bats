'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { X, Bug, Lightbulb, MessageSquare, CheckCircle } from 'lucide-react';
import { getLastRequestId } from '@/lib/observability/client-request-id';
import { FEEDBACK_CATEGORIES, categoryFromRoute, type FeedbackType } from '@/lib/feedback-shared';
import styles from './FeedbackWidget.module.css';

const TYPES: { value: FeedbackType; label: string; Icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', Icon: Bug },
  { value: 'feature', label: 'Feature', Icon: Lightbulb },
  { value: 'feedback', label: 'Feedback', Icon: MessageSquare },
];

const MAX_TITLE = 150;
const MAX_BODY = 4000;

/**
 * The in-app feedback form (Phase 3). Reuses the global modal-overlay/modal shell for a consistent
 * look across every mount surface. Auto-captures route, app_version, and the last requestId into
 * context (role + org are resolved server-side from the session — never trusted from the client).
 */
export default function FeedbackWidget({
  open,
  onClose,
  helpSection,
}: {
  open: boolean;
  onClose: () => void;
  helpSection?: string;
}) {
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>('bug');
  const [category, setCategory] = useState<string>(() => categoryFromRoute(pathname));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!open || typeof document === 'undefined') return null;

  function reset() {
    setType('bug');
    setCategory(categoryFromRoute(pathname));
    setTitle('');
    setBody('');
    setError('');
    setDone(false);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit() {
    if (busy) return;
    if (!body.trim()) {
      setError('Please add a description.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          category,
          title: title.trim() || null,
          body: body.trim(),
          context: {
            route: pathname,
            help_section: helpSection ?? null,
            app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
            requestId: getLastRequestId(),
          },
        }),
      });
      // 202 = accepted-but-throttled (soft success); treat like success so we never reveal the limit.
      if (!res.ok && res.status !== 202) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Failed (${res.status})`);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send feedback.');
    } finally {
      setBusy(false);
    }
  }

  // Portal to <body> so the fixed-position overlay is never trapped by an ancestor that establishes
  // a containing block (e.g. the admin bottom-nav's backdrop-filter), which would clip it.
  return createPortal(
    <div className="modal-overlay" onClick={close} style={{ zIndex: 1100 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            <h3 style={{ margin: 0 }}>{done ? 'Thank you' : 'Send feedback'}</h3>
          </div>
          <button className="btn btn-ghost btn-data" onClick={close} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {done ? (
          <div className={styles.success}>
            <CheckCircle size={30} className="text-success" />
            <p>Thanks — we&apos;ve got it. Our team reviews every submission.</p>
            <button className="btn btn-lime btn-data" onClick={close}>Done</button>
          </div>
        ) : (
          <>
            <div className={styles.form}>
              <div className={styles.pills} role="group" aria-label="Feedback type">
                {TYPES.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pill} ${type === value ? styles.pillActive : ''}`}
                    onClick={() => setType(value)}
                    aria-pressed={type === value}
                  >
                    <Icon size={13} aria-hidden /> {label}
                  </button>
                ))}
              </div>

              <label className={styles.field}>
                <span className={styles.label}>Category</span>
                <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
                  {FEEDBACK_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Title <span className={styles.optional}>(optional)</span>
                </span>
                <input
                  className={styles.input}
                  value={title}
                  maxLength={MAX_TITLE}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Short summary"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Description</span>
                <textarea
                  className={styles.textarea}
                  value={body}
                  maxLength={MAX_BODY}
                  rows={5}
                  onChange={e => setBody(e.target.value)}
                  placeholder={type === 'bug' ? 'What happened? What did you expect?' : 'Tell us more…'}
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={close} disabled={busy}>Cancel</button>
              <button className="btn btn-lime btn-data" onClick={submit} disabled={busy || !body.trim()}>
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
