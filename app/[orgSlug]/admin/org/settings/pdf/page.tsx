'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileText, Save, Eye, AlertTriangle, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature } from '@/lib/plan-features';
import { DEFAULT_PDF_SETTINGS, downloadPDF, type OrgPdfSettings } from '@/lib/export/pdf';
import HelpCallout from '@/components/help/HelpCallout';
import FeedbackModal from '@/components/FeedbackModal';
import s from '@/app/[orgSlug]/admin/admin-common.module.css';

// ── Placeholder data for the preview PDF ─────────────────────────────────────
const PREVIEW_HEADERS = ['Team', 'Division', 'Coach', 'Status', 'Payment'];
const PREVIEW_ROWS: (string | number)[][] = [
  ['Riverside Heat',    'U13',  'A. Johnson',  'Accepted',  'Paid'],
  ['Valley Thunder',    'U13',  'M. Peters',   'Accepted',  'Paid'],
  ['Eastside Eagles',   'U15',  'C. Williams', 'Accepted',  'Pending'],
  ['North Stars',       'U15',  'T. Garcia',   'Accepted',  'Paid'],
  ['Lakeview Lightning','U17',  'S. Brown',    'Waitlist',  '—'],
  ['Central Clippers',  'U17',  'D. Miller',   'Accepted',  'Paid'],
  ['Sunridge Sharks',   'U13',  'K. Wilson',   'Accepted',  'Pending'],
  ['Hilltop Hawks',     'U15',  'R. Davis',    'Accepted',  'Paid'],
];

function emptyForm(org: { name?: string; themeAccent?: string | null } | null): OrgPdfSettings {
  return {
    ...DEFAULT_PDF_SETTINGS,
    headerLine1: org?.name ?? '',
    accentColor: org?.themeAccent ?? DEFAULT_PDF_SETTINGS.accentColor,
  };
}

export default function PdfSettingsPage() {
  const { currentOrg, userRole, loading: orgLoading } = useOrg();
  const [form, setForm]     = useState<OrgPdfSettings | null>(null);
  const [saved, setSaved]   = useState<OrgPdfSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const canCustomize = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_template_settings') : false;

  // ── Load saved settings from API ─────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const res = await fetch('/api/admin/org/pdf-settings');
      if (!res.ok) throw new Error('Failed to load PDF settings');
      const data: Partial<OrgPdfSettings> = await res.json();
      const merged: OrgPdfSettings = {
        ...emptyForm(currentOrg),
        ...data,
        // Free plan: always force branding on
        showBranding: canCustomize ? (data.showBranding ?? true) : true,
      };
      setForm(merged);
      setSaved(merged);
    } catch {
      setForm(emptyForm(currentOrg));
      setSaved(emptyForm(currentOrg));
    }
  }, [currentOrg, canCustomize]);

  useEffect(() => { load(); }, [load]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/org/pdf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved({ ...form });
      setFeedback({ isOpen: true, title: 'Saved', message: 'PDF settings saved. All future exports will use these settings.', type: 'success' });
    } catch {
      setFeedback({ isOpen: true, title: 'Error', message: 'Failed to save PDF settings. Please try again.', type: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  async function handlePreview() {
    if (!form || previewing) return;
    setPreviewing(true);
    try {
      await downloadPDF(
        'pdf-settings-preview.pdf',
        form.headerLine1 || currentOrg?.name || 'Preview',
        form.headerLine2,
        PREVIEW_HEADERS,
        PREVIEW_ROWS,
        form,
      );
    } catch {
      setFeedback({ isOpen: true, title: 'Preview Error', message: 'Could not generate preview PDF. Please try again.', type: 'danger' });
    } finally {
      setPreviewing(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set<K extends keyof OrgPdfSettings>(key: K, value: OrgPdfSettings[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  }

  const isDirty = form && saved
    ? JSON.stringify(form) !== JSON.stringify(saved)
    : false;

  const filenamePreview = [
    currentOrg?.slug ?? 'org',
    'dataset',
    'scope',
    new Date().toISOString().split('T')[0],
  ].join('-') + '.pdf';

  if (orgLoading || !form) {
    return (
      <div className={s.page}>
        <div style={{ padding: '3rem', color: 'var(--white-40)', fontSize: '0.88rem' }}>Loading…</div>
      </div>
    );
  }

  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className={s.page}>
        <HelpCallout
          variant="warning"
          title="Access restricted"
          body="PDF settings can only be changed by Owners and Admins."
        />
      </div>
    );
  }

  return (
    <div className={s.page}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}><FileText size={20} /></div>
          <div>
            <h1 className={s.pageTitle}>PDF Settings</h1>
            <p className={s.pageSub}>Configure the default template for all PDF exports from this organization</p>
          </div>
        </div>
        <div className={s.headerActions}>
          <button
            className="btn btn-outline btn-sm"
            onClick={handlePreview}
            disabled={previewing}
            style={{ gap: '0.4rem' }}
          >
            <Eye size={14} />
            {previewing ? 'Generating…' : 'Preview PDF'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{ gap: '0.4rem' }}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {!canCustomize && (
        <HelpCallout
          variant="info"
          title="Limited customization on free plan"
          body="You can configure header text, footer, and privacy settings. FieldLogicHQ branding is always shown on the free Tournament plan. Upgrade to Tournament Plus to use your own logo and suppress FieldLogicHQ branding."
          cta={{ label: 'View Upgrade Options', href: `/${currentOrg?.slug}/admin/org/billing` }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0 2rem 2rem', maxWidth: '640px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Header</h2>
          <div className="form-group" style={{ marginBottom: '0.875rem' }}>
            <label className="form-label">Organization name in header</label>
            <input
              className="form-input"
              type="text"
              value={form.headerLine1}
              placeholder={currentOrg?.name ?? 'Your Organization'}
              onChange={e => set('headerLine1', e.target.value)}
            />
            <p style={hint}>Shown at the top of every PDF. Defaults to your org name if left blank.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Second header line <span style={{ color: 'var(--white-30)' }}>(optional)</span></label>
            <input
              className="form-input"
              type="text"
              value={form.headerLine2 ?? ''}
              placeholder="e.g. 2026 Tournament Season"
              onChange={e => set('headerLine2', e.target.value || undefined)}
            />
          </div>
        </section>

        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Logo</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            <label style={radioLabel(form.logoDataUrl == null)}>
              <input
                type="radio"
                checked={form.logoDataUrl == null}
                onChange={() => set('logoDataUrl', undefined)}
                style={{ flexShrink: 0, marginTop: '2px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Use org logo</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', marginTop: '0.15rem' }}>
                  Use the logo uploaded in Org Settings. If none is set, the header shows text only.
                </div>
              </div>
            </label>
            <label style={{ ...radioLabel(false), opacity: 0.5, cursor: 'not-allowed' }}>
              <input type="radio" disabled style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Upload PDF-specific logo override <span style={planBadge}>Coming soon</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', marginTop: '0.15rem' }}>
                  Upload a separate logo optimized for print — higher resolution or different crop.
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Footer</h2>
          <div className="form-group" style={{ marginBottom: '0.875rem' }}>
            <label className="form-label">Footer text <span style={{ color: 'var(--white-30)' }}>(optional)</span></label>
            <textarea
              className="form-input"
              rows={2}
              value={form.footerText ?? ''}
              placeholder="e.g. contact@yourorg.ca · yourorg.ca · For internal use only"
              onChange={e => set('footerText', e.target.value || undefined)}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <Toggle
              checked={form.showDateStamp}
              onChange={v => set('showDateStamp', v)}
              label='Show generated date'
              hint='"Exported: 2026-05-20" appears in the footer'
            />
            <Toggle
              checked={form.showPageNumbers}
              onChange={v => set('showPageNumbers', v)}
              label='Show page numbers'
              hint='"Page 1 of 3" on multi-page documents'
            />
            <div style={{ opacity: canCustomize ? 1 : 0.6 }}>
              <Toggle
                checked={form.showBranding}
                onChange={v => canCustomize && set('showBranding', v)}
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Show FieldLogicHQ branding
                    {!canCustomize && <Lock size={11} style={{ color: 'var(--blueprint-blue)' }} />}
                  </span>
                }
                hint={canCustomize
                  ? 'FieldLogicHQ logo in the footer of every page'
                  : 'FieldLogicHQ branding always shown on the free Tournament plan. Upgrade to suppress it.'}
                disabled={!canCustomize}
              />
            </div>
          </div>
        </section>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Appearance</h2>
          <div className="form-group" style={{ marginBottom: '0.875rem' }}>
            <label className="form-label">Accent colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={form.accentColor}
                onChange={e => set('accentColor', e.target.value)}
                style={{
                  width: '40px', height: '36px', padding: '2px 4px',
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              />
              <input
                className="form-input"
                type="text"
                value={form.accentColor}
                onChange={e => set('accentColor', e.target.value)}
                style={{ width: '120px', fontFamily: 'monospace', fontSize: '0.88rem' }}
                maxLength={7}
                placeholder="#1e293b"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => set('accentColor', currentOrg?.themeAccent ?? DEFAULT_PDF_SETTINGS.accentColor)}
                style={{ fontSize: '0.78rem' }}
              >
                Reset
              </button>
            </div>
            <p style={hint}>Used for table header rows. Defaults to your org brand colour.</p>
          </div>
          <div className="form-group" style={{ marginBottom: '0.875rem' }}>
            <label className="form-label">Default orientation</label>
            <select
              className="form-select"
              value={form.orientation}
              onChange={e => set('orientation', e.target.value as 'portrait' | 'landscape')}
            >
              <option value="portrait">Portrait (default)</option>
              <option value="landscape">Landscape</option>
            </select>
            <p style={hint}>Schedule exports always use landscape; this sets the default for other reports.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Report density</label>
            <select
              className="form-select"
              value={form.reportDensity}
              onChange={e => set('reportDensity', e.target.value as 'compact' | 'readable')}
            >
              <option value="readable">Readable — more spacing, easier to scan</option>
              <option value="compact">Compact — more rows per page</option>
            </select>
            <p style={hint}>Compact fits large registration lists. Readable is better for board reports and dues statements.</p>
          </div>
        </section>

        {/* ── Privacy ─────────────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Privacy defaults</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--white-50)', marginBottom: '0.875rem', lineHeight: 1.55 }}>
            These control which sensitive fields appear in PDF exports by default. You can override per-export from the export menu.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <Toggle
              checked={form.includeGuardianContacts}
              onChange={v => set('includeGuardianContacts', v)}
              label="Include guardian contacts"
              hint="Guardian email and phone columns in registration and roster PDFs"
            />
            <Toggle
              checked={form.includePlayerNotes}
              onChange={v => set('includePlayerNotes', v)}
              label="Include player notes"
              hint="Player-level notes attached during registration"
            />
            <Toggle
              checked={form.includeInternalNotes}
              onChange={v => set('includeInternalNotes', v)}
              label="Include internal admin notes"
              hint={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertTriangle size={11} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0 }} />
                  Off by default — internal notes are never shown to registering families
                </span>
              }
            />
          </div>
        </section>

        {/* ── Filename preview ─────────────────────────────────────────────── */}
        <section>
          <h2 style={sectionTitle}>Filename pattern</h2>
          <div style={{
            padding: '0.65rem 0.875rem',
            background: 'var(--white-5)',
            border: '1px solid var(--white-10)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            fontSize: '0.83rem',
            color: 'var(--white-60)',
          }}>
            {filenamePreview}
          </div>
          <p style={hint}>Pattern: <code style={{ color: 'var(--white-40)' }}>org-dataset-scope-date.pdf</code></p>
        </section>
      </div>

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false }))}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, hint, disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ marginTop: '2px', flexShrink: 0 }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--white)' }}>{label}</div>
        {hint && <div style={{ fontSize: '0.78rem', color: 'var(--white-50)', marginTop: '0.15rem', lineHeight: 1.45 }}>{hint}</div>}
      </div>
    </label>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--white-40)',
  marginBottom: '0.875rem',
};

const hint: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--white-40)',
  marginTop: '0.35rem',
  lineHeight: 1.45,
};

const planBadge: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
  color: 'var(--blueprint-blue)',
  background: 'rgba(var(--blueprint-blue-rgb),0.12)',
  border: '1px solid rgba(var(--blueprint-blue-rgb),0.25)',
  padding: '1px 6px', borderRadius: '4px',
};

function radioLabel(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
    padding: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    background: active ? 'rgba(var(--blueprint-blue-rgb),0.08)' : 'transparent',
    border: active ? '1px solid rgba(var(--blueprint-blue-rgb),0.3)' : '1px solid var(--white-8)',
    marginBottom: '0',
  };
}
