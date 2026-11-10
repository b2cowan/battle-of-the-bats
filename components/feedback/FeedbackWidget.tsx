'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { CheckCircle } from 'lucide-react';
import { getLastRequestId } from '@/lib/observability/client-request-id';
import { FEEDBACK_CATEGORIES, categoryFromRoute, type FeedbackType } from '@/lib/feedback-shared';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import { PortalKitRoot } from '@/components/admin/AdminKitProvider';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import ChoicePair from '@/components/shared/ChoicePair';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import styles from './FeedbackWidget.module.css';

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'feedback', label: 'Feedback' },
];

const MAX_TITLE = 150;
const MAX_BODY = 4000;

/**
 * The in-app feedback form, in the product's ONE window (`KitDialog` kind="form" — the same window the club admin's
 * and the coaches portal's forms wear; One Window, owner 2026-10-18). It used to be the global dark `.modal` with the
 * old terminal type; it moved when the window did.
 *
 * ⚠ PORTALLED, AND THE THEME GOES WITH IT. Every mount is a phone bar or an account menu, and a fixed layer inside the
 * bar's backdrop-filter would be trapped by it, so the window renders on <body> — a sibling of every shell, where no
 * theme marker reaches it. The warm / dark palette lives on the shell's marker (`[data-coach-warm-enabled]`, which
 * follows the person's Warm / Dark setting), so the window carries the marker itself: `PortalKitRoot` adds the admin's
 * pair inside the admin, and the coach marker covers everywhere else (the coaches portal, the family app, the public
 * pages). Fields wear tokens, never white-on-dark, or the warm card would show white text on white.
 *
 * Auto-captures route, app_version, and the last requestId into context (role + org are resolved server-side from the
 * session — never trusted from the client).
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
  const pathname = usePublicPathname();
  const typeLabelId = useId();
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

  // Words typed and not yet sent: × / Esc / Back / Cancel ask in the foot first. Once sent, nothing is left to lose.
  const typed = !done && (title.trim() !== '' || body.trim() !== '');

  return createPortal(
    <PortalKitRoot>
      <div style={{ display: 'contents' }} {...coachWarmAttr}>
        <KitDialog
          kind="form"
          title={done ? 'Thank you' : 'Send feedback'}
          onClose={close}
          busy={busy}
          dirty={typed}
          discardAsk="Close without sending? What you typed won’t be kept."
          footer={done ? (
            <button type="button" className="btn btn-lime" onClick={close}>Done</button>
          ) : (
            <>
              <DialogCancel>Cancel</DialogCancel>
              <button type="button" className="btn btn-lime" onClick={() => void submit()} disabled={busy || !body.trim()}>
                {busy ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        >
          {done ? (
            <div className={styles.success}>
              <CheckCircle size={30} className={styles.successIcon} aria-hidden />
              <p>Thanks — we&apos;ve got it. Our team reviews every submission.</p>
            </div>
          ) : (
            <div>
              <div className={ck.field}>
                <span className={ck.label} id={typeLabelId}>Type</span>
                <ChoicePair labelledBy={typeLabelId} value={type} options={TYPES} onChange={setType} disabled={busy} />
              </div>

              <label className={ck.field} htmlFor="feedback-category">
                <span className={ck.label}>Category</span>
                <select id="feedback-category" className={ck.select} value={category} onChange={e => setCategory(e.target.value)}>
                  {FEEDBACK_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className={ck.field} htmlFor="feedback-title">
                <span className={ck.label}>Title</span>
                <input
                  id="feedback-title"
                  className={ck.input}
                  value={title}
                  maxLength={MAX_TITLE}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Short summary"
                />
              </label>

              <label className={ck.field} htmlFor="feedback-body">
                <span className={ck.label}>Description<span className={ck.required} aria-hidden>*</span></span>
                <textarea
                  id="feedback-body"
                  className={ck.textarea}
                  value={body}
                  maxLength={MAX_BODY}
                  rows={5}
                  aria-required
                  data-autofocus=""
                  onChange={e => { setBody(e.target.value); setError(''); }}
                  placeholder={type === 'bug' ? 'What happened? What did you expect?' : 'Tell us more…'}
                />
              </label>

              <DialogReason className={styles.error}>{error}</DialogReason>
            </div>
          )}
        </KitDialog>
      </div>
    </PortalKitRoot>,
    document.body,
  );
}
