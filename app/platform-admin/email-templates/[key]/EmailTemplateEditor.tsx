'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, Send, RotateCcw, Check, Undo2, X } from 'lucide-react';
import { renderHeadingAndBody } from '@/lib/email-markup';
import { warmEmailBody } from '@/lib/email-envelope-warm';
import { familyTemplateSample } from '@/lib/email-family-template-sample';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../../console.module.css';
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
// Every email previews in the warm envelope it sends in.
function buildPreviewHtml(fields: {
  key: string;
  heading: string;
  body: string;
  cta_label: string | null;
}): string {
  const body = fields.cta_label
    ? `${fields.body}\n\n::button ${fields.cta_label} | #`
    : fields.body;
  const inner = renderHeadingAndBody({ heading: fields.heading, body, mode: 'chip' });
  // A family email previews on a made-up club, in the card a family will see (The public face, warm: S3b).
  const family = familyTemplateSample(fields.key);
  return warmEmailBody(family ? `${inner}\n${family.footerHtml}` : inner, family?.club);
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

  if (loading) return <p className={kit.notice}>Loading template…</p>;
  if (loadErr) return <p className={`${kit.notice} ${kit.noticeBad}`}>Error: {loadErr}</p>;
  if (!tmpl)   return <p className={`${kit.notice} ${kit.noticeBad}`}>Template not found.</p>;

  const isBusy = saving || resetting || testing;
  const preview = buildPreviewHtml({ key: templateKey, heading, body, cta_label: ctaLabel || null });
  const dirty =
    subject !== tmpl.subject ||
    heading !== tmpl.heading ||
    body !== tmpl.body ||
    (ctaLabel || '') !== (tmpl.cta_label ?? '');

  return (
    <div className={kit.page}>
      <AdminPageHeader
        backTo={{ href: '/platform-admin/email-templates', label: 'Email templates' }}
        title={tmpl.label}
        titleChips={
          <>
            <span className={`${kit.chip} ${kit.chipQuiet}`}>{tmpl.key}</span>
            {tmpl.is_customised ? (
              <span className={`${kit.chip} ${kit.chipOk}`}>Customised</span>
            ) : (
              <span className={`${kit.chip} ${kit.chipQuiet}`}>Default</span>
            )}
          </>
        }
      />

      <p className={kit.caption}>
        {tmpl.description}
        {tmpl.updated_by && <> · last updated by {tmpl.updated_by}</>}
      </p>

      {tmpl.is_customised ? (
        <div className={`${kit.callout} ${kit.calloutWarn}`}>
          <span>
            <strong>Customised</strong> — the copy below is your saved edit and overrides the original.
            &ldquo;Reset to default&rdquo; puts the original copy back.
          </span>
        </div>
      ) : (
        <div className={kit.callout}>
          <span>
            <strong>Default</strong> — this is the original built-in copy. Edit and <strong>Save</strong> to
            override it (it becomes &ldquo;Customised&rdquo;); you can reset to this original at any time.
          </span>
        </div>
      )}

      <div className={styles.split}>
        {/* ── Form ───────────────────────────────────────────────────────────── */}
        <div className={`${kit.card} ${kit.cardPad} ${styles.formPanel}`}>

          <div className={kit.fieldGroup}>
            <label className={kit.label} htmlFor="email-template-subject">Subject line<span className={kit.req} aria-hidden="true"> *</span></label>
            <input
              id="email-template-subject"
              className={`${kit.field} ${styles.full}`}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
              required
            />
          </div>

          <div className={kit.fieldGroup}>
            <label className={kit.label} htmlFor="email-template-heading">Heading<span className={kit.req} aria-hidden="true"> *</span></label>
            <input
              id="email-template-heading"
              className={`${kit.field} ${styles.full}`}
              value={heading}
              onChange={e => setHeading(e.target.value)}
              placeholder="Email heading…"
              required
            />
          </div>

          <div className={kit.fieldGroup}>
            <label className={kit.label} htmlFor="email-template-body">Body<span className={kit.req} aria-hidden="true"> *</span></label>
            <span className={kit.hint}>
              Blank line = new paragraph · **bold** · <code className={kit.code}>- </code>bullet · <code className={kit.code}>::callout Label</code> … <code className={kit.code}>::end</code> box
              · <code className={kit.code}>::button Label | {'{{url}}'}</code> · <code className={kit.code}>::link Label | {'{{url}}'}</code>. Use the chips to insert variables.
            </span>
            <textarea
              id="email-template-body"
              ref={bodyRef}
              className={kit.textarea}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body text…"
              rows={10}
              required
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

          <div className={kit.fieldGroup}>
            <label className={kit.label} htmlFor="email-template-cta">CTA button label</label>
            <span className={kit.hint}>
              Leave blank if this email has no call-to-action button.
            </span>
            <input
              id="email-template-cta"
              className={`${kit.field} ${styles.full}`}
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder="e.g. View Schedule →"
            />
          </div>

          <div className={kit.formActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isBusy || !dirty}
              title={dirty ? 'Save your changes' : 'No unsaved changes'}
            >
              {saving ? <Loader size={14} className={kit.spin} aria-hidden /> : <Check size={14} aria-hidden />}
              Save
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestSend}
              disabled={isBusy}
              title="Send a preview to your platform admin email"
            >
              {testing ? <Loader size={14} className={kit.spin} aria-hidden /> : <Send size={14} aria-hidden />}
              Send test
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDiscard}
              disabled={isBusy || !dirty}
              title={dirty ? 'Undo unsaved edits and go back to the last saved version' : 'No unsaved changes'}
            >
              <Undo2 size={14} aria-hidden />
              Discard changes
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowResetConfirm(true)}
              disabled={isBusy || !tmpl.is_customised}
              title={!tmpl.is_customised ? 'Already using the default' : 'Reset to built-in default'}
            >
              {resetting ? <Loader size={14} className={kit.spin} aria-hidden /> : <RotateCcw size={14} aria-hidden />}
              Reset to default
            </button>

            {status && (
              <span
                role="status"
                className={`${styles.statusMsg} ${status.type === 'ok' ? styles.statusOk : styles.statusErr}`}
              >
                {status.msg}
              </span>
            )}
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────────────────────────── */}
        <section className={`${kit.section} ${styles.previewPanel}`}>
          <h2 className={kit.sectionTitle}>Live preview</h2>
          <div className={kit.card}>
            <div className={styles.previewSubject}>
              <span className={styles.previewSubjectKey}>Subject: </span>
              {subject || <em className={kit.muted}>no subject</em>}
            </div>
            <div
              className={styles.previewFrame}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
          <p className={kit.caption}>
            Variable tokens shown as <span className={kit.code}>{'{{tokens}}'}</span>. Real values injected at send time.
          </p>
        </section>
      </div>

      {showResetConfirm && (
        <div className="modal-overlay" onPointerDown={e => { if (e.target === e.currentTarget) (() => setShowResetConfirm(false))?.(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="email-template-reset-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="email-template-reset-title">Reset to default?</h3>
              <button type="button" className={styles.modalClose} onClick={() => setShowResetConfirm(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p>
              This restores the original built-in copy for <strong>{tmpl.label}</strong> and discards
              your saved customisation. This can&rsquo;t be undone.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowResetConfirm(false)} disabled={resetting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={doReset} disabled={resetting}>
                {resetting ? <Loader size={14} className={kit.spin} aria-hidden /> : <RotateCcw size={14} aria-hidden />}
                Reset to default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
