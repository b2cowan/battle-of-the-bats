'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader, ArrowLeft, Send, RotateCcw, Check } from 'lucide-react';
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

// Build a live preview HTML string from the current form fields, mirroring
// the FieldLogicHQ email brand envelope in lib/email.ts.
function buildPreviewHtml(fields: {
  heading: string;
  body: string;
  cta_label: string | null;
}): string {
  // Replace {{variable}} placeholders with styled tokens
  function fill(text: string) {
    return text.replace(
      /\{\{(\w+)\}\}/g,
      (_, k) =>
        `<span style="background:rgba(30,58,138,0.35);border:1px solid rgba(30,58,138,0.6);padding:0 3px;font-family:monospace;font-size:0.9em;color:#93c5fd;">{{${k}}}</span>`,
    );
  }

  // Convert **bold** markdown to <strong>
  function md(text: string) {
    return fill(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  const bodyLines = fields.body
    .split('\n')
    .map(l => {
      if (!l.trim()) return '<br>';
      return `<p style="margin:0 0 0.85rem;line-height:1.65;color:rgba(241,245,249,0.85);">${md(l)}</p>`;
    })
    .join('');

  const ctaHtml = fields.cta_label
    ? `<a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;margin-top:0.75rem;">${md(fields.cta_label)}</a>`
    : '';

  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  <h2 style="color:#fff;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">${md(fields.heading)}</h2>
  ${bodyLines}
  ${ctaHtml}
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

  // ── Reset to default ──────────────────────────────────────────────────────────
  async function handleReset() {
    if (!confirm('Reset this template to the built-in default? Your customised copy will be discarded.')) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/platform-admin/email-templates/${templateKey}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Reset failed');
      setTmpl(d.template);
      // Restore seeded values — these don't change so just refetch to get clean state
      const r2 = await fetch(`/api/platform-admin/email-templates/${templateKey}`);
      const d2 = await r2.json();
      if (d2.template) {
        const t: Template = d2.template;
        setSubject(t.subject);
        setHeading(t.heading);
        setBody(t.body);
        setCtaLabel(t.cta_label ?? '');
        setTmpl(t);
      }
      showStatus('ok', 'Reset to default.');
    } catch (e) {
      showStatus('err', (e as Error).message);
    } finally {
      setResetting(false);
    }
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

      {tmpl.is_customised && (
        <div className={styles.customisedNote}>
          This template has been customised. The content below overrides the built-in default.
          Use &ldquo;Reset to default&rdquo; to restore the original copy.
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
              Use **bold** for emphasis. Each line becomes a paragraph. Use the chips below to insert variable tokens.
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
              disabled={isBusy}
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
              className={styles.resetBtn}
              onClick={handleReset}
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
    </div>
  );
}
