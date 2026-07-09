'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader, ArrowLeft, Send, RotateCcw, Check, Undo2, X } from 'lucide-react';
import { renderHeadingAndBody } from '@/lib/email-markup';
import styles from '../email-templates.module.css';

type Template = {
  key: string;
  label: string;
  description: string;
  subject: string;
  heading: string;
  body: string;
  cta_label: string | null;
  cta_url_pattern: string | null;
  variables: string[];
  category: string;
  is_customised: boolean;
  updated_at: string;
  updated_by: string | null;
};

// Build a live preview HTML string from the current form fields using the SAME shared
// markup renderer the send path uses (chip mode shows {{tokens}} as monospace chips).
// This understands the full markup — paragraphs, **bold**, - bullets, ::callout,
// ::button, ::link, ::if — so a rich campaign previews exactly as it will send. A
// dedicated cta_label (used by the transactional templates) is appended as a ::button.
function buildPreviewHtml(fields: {
  heading: string;
  body: string;
  cta_label: string | null;
}): string {
  const body = fields.cta_label
    ? `${fields.body}\n\n::button ${fields.cta_label} | #`
    : fields.body;
  const inner = renderHeadingAndBody({ heading: fields.heading, body, mode: 'chip' });

  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  ${inner}
</div>`;
}

export default function EmailTemplateEditor({ templateKey }: { templateKey: string }) {
  const [tmpl, setTmpl]         = useState<Template | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadErr, setLoadErr]   = useState<string | null>(null);

  // Form state
  const [subject,  setSubject]  = useState('');
  const [heading,  setHeading]  = useState('');
  const [body,     setBody]     = useState('');
  const [ctaLabel, setCtaLabel] = useState('');

  // Action states
  const [saving,   setSaving]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [status,   setStatus]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const showStatus = useCallback((type: 'ok' | 'err', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  // ── Load template ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch(`/api/platform-admin/email-templates/${templateKey}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        const t: Template = d.template;
        setTmpl(t);
        setSubject(t.subject);
        setHeading(t.heading);
        setBody(t.body);
        setCtaLabel(t.cta_label ?? '');
      })
      .catch(e => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, [templateKey]);

  // ── Insert variable chip into body at cursor ──────────────────────────────────
  function insertVar(v: string) {
    const el = bodyRef.current;
    if (!el) return;
    const token = `{{${v}}}`;
    const start = el.selectionStart ?? body.length;
    const end   = el.selectionEnd   ?? body.length;
    const next  = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    // Restore cursor after inserted token
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform-admin/email-templates/${templateKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, heading, body, cta_label: ctaLabel || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Save failed');
      setTmpl(d.template);
      showStatus('ok', 'Saved.');
    } catch (e) {
      showStatus('err', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Reset to default (restores the original built-in copy) ─────────────────────
  async function doReset() {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      const res = await fetch(`/api/platform-admin/email-templates/${templateKey}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Reset failed');
      // The DELETE route restores the original copy for marketing campaigns; refetch the
      // clean state and re-seed the form from it.
      const t: Template = d.template;
      setTmpl(t);
      setSubject(t.subject);
      setHeading(t.heading);
      setBody(t.body);
      setCtaLabel(t.cta_label ?? '');
      showStatus('ok', 'Reset to the built-in default.');
    } catch (e) {
      showStatus('err', (e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  // ── Discard unsaved edits (revert the form to the last SAVED version) ───────────
  function handleDiscard() {
    if (!tmpl) return;
    setSubject(tmpl.subject);
    setHeading(tmpl.heading);
    setBody(tmpl.body);
    setCtaLabel(tmpl.cta_label ?? '');
    showStatus('ok', 'Reverted to the last saved version.');
  }

  // ── Test send ─────────────────────────────────────────────────────────────────
  async function handleTestSend() {
    setTesting(true);
    try {
      const res = await fetch(`/api/platform-admin/email-templates/${templateKey}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, heading, body, cta_label: ctaLabel || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Send failed');
      showStatus('ok', `Test email sent to ${d.sentTo}`);
    } catch (e) {
      showStatus('err', (e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.loadingMsg}>Loading template…</p>;
  if (loadErr) return <p className={styles.errorMsg}>Error: {loadErr}</p>;
  if (!tmpl)   return <p className={styles.errorMsg}>Template not found.</p>;

  const isBusy = saving || resetting || testing;
  const preview = buildPreviewHtml({ heading, body, cta_label: ctaLabel || null });
  const dirty =
    subject !== tmpl.subject ||
    heading !== tmpl.heading ||
    body !== tmpl.body ||
    (ctaLabel || '') !== (tmpl.cta_label ?? '');

  return (
    <div className={styles.editorPage}>
      <div className={styles.editorHeader}>
        <Link href="/platform-admin/email-templates" className={styles.backLink}>
          <ArrowLeft size={11} />
          Email Templates
        </Link>
        <h1 className={styles.editorTitle}>{tmpl.label}</h1>
        <p className={styles.editorDesc}>{tmpl.description}</p>
        <div className={styles.editorMeta}>
          <span className={styles.keyChip}>{tmpl.key}</span>
          {tmpl.is_customised ? (
            <span className={styles.badgeCustomised}>Customised</span>
          ) : (
            <span className={styles.badgeDefault}>Default</span>
          )}
          {tmpl.updated_by && (
            <span style={{ fontSize: '0.62rem', color: 'rgba(241,245,249,0.3)' }}>
              last updated by {tmpl.updated_by}
            </span>
          )}
        </div>
      </div>

      {tmpl.is_customised ? (
        <div className={styles.customisedNote}>
          <strong>Customised</strong> — the copy below is your saved edit and overrides the original.
          &ldquo;Reset to default&rdquo; puts the original copy back.
        </div>
      ) : (
        <div className={styles.defaultNote}>
          <strong>Default</strong> — this is the original built-in copy. Edit and <strong>Save</strong> to
          override it (it becomes &ldquo;Customised&rdquo;); you can reset to this original at any time.
        </div>
      )}

      <div className={styles.split}>
        {/* ── Form ───────────────────────────────────────────────────────────── */}
        <div className={styles.formPanel}>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Subject line</label>
            <input
              className={styles.input}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Heading</label>
            <input
              className={styles.input}
              value={heading}
              onChange={e => setHeading(e.target.value)}
              placeholder="Email heading…"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Body</label>
            <span className={styles.fieldHint}>
              Blank line = new paragraph · **bold** · <code>- </code>bullet · <code>::callout Label</code> … <code>::end</code> box
              · <code>::button Label | {'{{url}}'}</code> · <code>::link Label | {'{{url}}'}</code>. Use the chips to insert variables.
            </span>
            <textarea
              ref={bodyRef}
              className={styles.textarea}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body text…"
              rows={10}
            />
            {tmpl.variables.length > 0 && (
              <div className={styles.varChips}>
                {tmpl.variables.map(v => (
                  <button
                    key={v}
                    type="button"
                    className={styles.varChip}
                    title={`Insert {{${v}}}`}
                    onClick={() => insertVar(v)}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>CTA button label</label>
            <span className={styles.fieldHint}>
              Leave blank if this email has no call-to-action button.
            </span>
            <input
              className={styles.input}
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder="e.g. View Schedule →"
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={isBusy || !dirty}
              title={dirty ? 'Save your changes' : 'No unsaved changes'}
            >
              {saving ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
              Save
            </button>

            <button
              className={styles.testBtn}
              onClick={handleTestSend}
              disabled={isBusy}
              title="Send a preview to your platform admin email"
            >
              {testing ? <Loader size={12} className={styles.spin} /> : <Send size={12} />}
              Send test
            </button>

            <button
              className={styles.discardBtn}
              onClick={handleDiscard}
              disabled={isBusy || !dirty}
              title={dirty ? 'Undo unsaved edits and go back to the last saved version' : 'No unsaved changes'}
            >
              <Undo2 size={12} />
              Discard changes
            </button>

            <button
              className={styles.resetBtn}
              onClick={() => setShowResetConfirm(true)}
              disabled={isBusy || !tmpl.is_customised}
              title={!tmpl.is_customised ? 'Already using the default' : 'Reset to built-in default'}
            >
              {resetting ? <Loader size={12} className={styles.spin} /> : <RotateCcw size={12} />}
              Reset to default
            </button>

            {status && (
              <span className={`${styles.statusMsg} ${status.type === 'ok' ? styles.statusOk : styles.statusErr}`}>
                {status.msg}
              </span>
            )}
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────────────────────────── */}
        <div className={styles.previewPanel}>
          <div className={styles.previewLabel}>
            Live Preview
          </div>
          <div className={styles.previewSubject}>
            <span className={styles.previewSubjectKey}>Subject: </span>
            {subject || <em style={{ opacity: 0.4 }}>no subject</em>}
          </div>
          <div
            className={styles.previewFrame}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: preview }}
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.62rem', color: 'rgba(241,245,249,0.25)', fontFamily: 'var(--font-data)' }}>
            Variable tokens shown as <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{'{{tokens}}'}</span>. Real values injected at send time.
          </p>
        </div>
      </div>

      {showResetConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowResetConfirm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Reset to default?</span>
              <button className={styles.modalClose} onClick={() => setShowResetConfirm(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <p className={styles.modalBody}>
              This restores the original built-in copy for <strong>{tmpl.label}</strong> and discards
              your saved customisation. This can&rsquo;t be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.resetBtn} onClick={doReset} disabled={resetting}>
                {resetting ? <Loader size={12} className={styles.spin} /> : <RotateCcw size={12} />}
                Reset to default
              </button>
              <button className={styles.testBtn} onClick={() => setShowResetConfirm(false)} disabled={resetting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
