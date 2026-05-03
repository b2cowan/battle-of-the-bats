'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Upload, Lock, Check, Image } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme } from '@/lib/themes';
import styles from './settings.module.css';

interface OrgSettings {
  name: string;
  slug: string;
  logoUrl: string | null;
  isPublic: boolean;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  heroBannerUrl: string | null;
  themeFont: string;
  themeCardStyle: string;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const { currentOrg, userRole, loading, refresh } = useOrg();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', isPublic: false });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [presetKey, setPresetKey]         = useState<string>('platform');
  const [customPrimary, setCustomPrimary] = useState<string>('#8B2FC9');
  const [customAccent, setCustomAccent]   = useState<string>('#A855F7');
  const [themeSaving, setThemeSaving]     = useState(false);

  const [heroBannerPreview, setHeroBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading]     = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [fontKey, setFontKey]             = useState<string>('system');
  const [fontSaving, setFontSaving]       = useState(false);

  const [cardStyle, setCardStyle]         = useState<string>('default');
  const [cardStyleSaving, setCardStyleSaving] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorOpen, setErrorOpen]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentOrg) return;
    fetch('/api/admin/org-settings')
      .then(r => r.json())
      .then((data: OrgSettings) => {
        setSettings(data);
        setForm({ name: data.name, slug: data.slug, isPublic: data.isPublic });
        setLogoPreview(data.logoUrl);
        setHeroBannerPreview(data.heroBannerUrl);
        setFontKey(data.themeFont ?? 'system');
        setCardStyle(data.themeCardStyle ?? 'default');
        if (data.themePrimary) {
          setPresetKey('custom');
          setCustomPrimary(data.themePrimary);
          setCustomAccent(data.themeAccent ?? '#A855F7');
        } else {
          setPresetKey(data.themePreset ?? 'platform');
        }
      })
      .catch(() => showError('Failed to load org settings'));
  }, [currentOrg]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setErrorOpen(true);
  }

  const isCustomPlan = currentOrg?.planId === 'pro' || currentOrg?.planId === 'elite';

  const previewTheme = useMemo(() => {
    if (presetKey === 'custom') {
      return resolveTheme('platform', customPrimary || null, customAccent || null);
    }
    return resolveTheme(presetKey, null, null);
  }, [presetKey, customPrimary, customAccent]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name,
          slug:     form.slug,
          isPublic: form.isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      setSuccessMsg('Settings saved successfully.');
      setSuccessOpen(true);
      refresh();

      if (data.slug && data.slug !== currentOrg.slug) {
        router.push(`/${data.slug}/admin/settings`);
      }
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTheme() {
    if (!currentOrg) return;
    setThemeSaving(true);
    try {
      const body = presetKey === 'custom'
        ? { themePreset: 'platform', themePrimary: customPrimary, themeAccent: customAccent }
        : { themePreset: presetKey, themePrimary: null, themeAccent: null };

      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      setSuccessMsg('Theme saved.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setThemeSaving(false);
    }
  }

  async function handleHeroBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroBannerPreview(URL.createObjectURL(file));
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/org-hero-banner', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setHeroBannerPreview(data.heroBannerUrl);
      setSuccessMsg('Hero banner updated.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      setHeroBannerPreview(settings?.heroBannerUrl ?? null);
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  }

  async function handleRemoveHeroBanner() {
    setBannerUploading(true);
    try {
      const res = await fetch('/api/admin/org-hero-banner', { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setHeroBannerPreview(null);
      setSuccessMsg('Hero banner removed.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Remove failed');
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleSaveFont() {
    if (!currentOrg) return;
    setFontSaving(true);
    try {
      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeFont: fontKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSuccessMsg('Font saved.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setFontSaving(false);
    }
  }

  async function handleSaveCardStyle() {
    if (!currentOrg) return;
    setCardStyleSaving(true);
    try {
      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeCardStyle: cardStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSuccessMsg('Card style saved.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setCardStyleSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/org-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setLogoPreview(data.logoUrl);
      setSuccessMsg('Logo updated.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      setLogoPreview(settings?.logoUrl ?? null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <div className={styles.accessDenied}>
          <Settings size={32} className={styles.accessDeniedIcon} />
          <h2>Access Denied</h2>
          <p>Only organization owners can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Settings size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageSub}>Manage your organization profile</p>
          </div>
        </div>
      </div>

      {/* Logo upload */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Organization Logo</h2>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className={styles.logoImg} />
              : <span className={styles.logoPlaceholder}>⚾</span>
            }
          </div>
          <div className={styles.logoActions}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              id="settings-logo-upload-btn"
            >
              <Upload size={15} />
              {uploading ? 'Uploading…' : 'Upload Logo'}
            </button>
            <p className={styles.logoHint}>JPG, PNG, or WebP — max 2 MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleLogoChange}
          style={{ display: 'none' }}
          id="settings-logo-input"
        />
      </div>

      {/* Theme picker */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Color Theme</h2>

        <div className={styles.swatchGrid}>
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={presetKey === key}
              className={`${styles.swatch} ${presetKey === key ? styles.swatchActive : ''}`}
              style={{ background: preset.primary }}
              onClick={() => setPresetKey(key)}
            >
              {presetKey === key && (
                <span className={styles.swatchCheck}>
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}

          {isCustomPlan ? (
            <button
              type="button"
              title="Custom colors"
              aria-label="Custom colors"
              aria-pressed={presetKey === 'custom'}
              className={`${styles.swatch} ${styles.swatchCustom} ${presetKey === 'custom' ? styles.swatchActive : ''}`}
              onClick={() => setPresetKey('custom')}
            >
              {presetKey === 'custom' && (
                <span className={styles.swatchCheck}>
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          ) : (
            <div className={styles.planLock}>
              <Lock size={12} />
              Custom — Pro/Elite only
            </div>
          )}
        </div>

        {presetKey === 'custom' && isCustomPlan && (
          <div className={styles.customPickers}>
            <div className={styles.colorPickerField}>
              <label className={styles.label} htmlFor="theme-primary">Primary</label>
              <input
                id="theme-primary"
                type="color"
                className={styles.colorInput}
                value={customPrimary}
                onChange={e => setCustomPrimary(e.target.value)}
              />
            </div>
            <div className={styles.colorPickerField}>
              <label className={styles.label} htmlFor="theme-accent">Accent</label>
              <input
                id="theme-accent"
                type="color"
                className={styles.colorInput}
                value={customAccent}
                onChange={e => setCustomAccent(e.target.value)}
              />
            </div>
          </div>
        )}

        {previewTheme.isLowContrast && (
          <div className={styles.lowContrastWarning}>
            ⚠ Low contrast — text may be hard to read on white backgrounds.
          </div>
        )}

        <div
          className={styles.themePreview}
          style={{
            '--primary':       previewTheme.primary,
            '--primary-light': previewTheme.primaryLight,
            '--primary-rgb':   previewTheme.primaryRgb,
            '--border':        `rgba(${previewTheme.primaryRgb}, 0.25)`,
          } as React.CSSProperties}
        >
          <p className={styles.themePreviewLabel}>Preview</p>
          <div className={styles.themePreviewContent}>
            <div className={styles.previewBorder}>Card border</div>
            <button type="button" className={styles.previewBtn}>Button</button>
            <span className={styles.previewBadge}>Badge</span>
          </div>
        </div>

        <div className={styles.themeFooter}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveTheme}
            disabled={themeSaving}
            id="settings-theme-save-btn"
          >
            {themeSaving ? 'Saving…' : 'Save Theme'}
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className={styles.card}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Hero Banner</h2>
          {!isCustomPlan && (
            <span className={styles.planLock}><Lock size={12} /> Pro / Elite only</span>
          )}
        </div>

        {isCustomPlan ? (
          <>
            {heroBannerPreview && (
              <div className={styles.bannerPreview}>
                <img src={heroBannerPreview} alt="Hero banner preview" className={styles.bannerImg} />
              </div>
            )}
            <div className={styles.logoActions}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
              >
                <Image size={15} />
                {bannerUploading ? 'Uploading…' : heroBannerPreview ? 'Replace Banner' : 'Upload Banner'}
              </button>
              {heroBannerPreview && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleRemoveHeroBanner}
                  disabled={bannerUploading}
                >
                  Remove
                </button>
              )}
            </div>
            <p className={styles.logoHint}>JPG, PNG, or WebP — max 4 MB. Recommended 16:5 ratio.</p>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleHeroBannerChange}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <p className={styles.planHint}>Upgrade to Pro or Elite to add a custom hero banner image to your tournament home page.</p>
        )}
      </div>

      {/* Font Family */}
      <div className={styles.card}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Font Family</h2>
          {!isCustomPlan && (
            <span className={styles.planLock}><Lock size={12} /> Pro / Elite only</span>
          )}
        </div>

        <div className={styles.fontGrid}>
          {Object.entries(FONT_OPTIONS).map(([key, opt]) => {
            const locked = !isCustomPlan && key !== 'system';
            return (
              <button
                key={key}
                type="button"
                disabled={locked}
                aria-pressed={fontKey === key}
                className={`${styles.fontBtn} ${fontKey === key ? styles.fontBtnActive : ''} ${locked ? styles.fontBtnLocked : ''}`}
                style={{ fontFamily: opt.sampleStyle }}
                onClick={() => !locked && setFontKey(key)}
              >
                <span className={styles.fontBtnLabel}>{opt.label}</span>
                <span className={styles.fontBtnSample}>Aa 123</span>
                {locked && <Lock size={10} className={styles.fontLockIcon} />}
              </button>
            );
          })}
        </div>

        <div className={styles.themeFooter}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveFont}
            disabled={fontSaving || (!isCustomPlan && fontKey !== 'system')}
          >
            {fontSaving ? 'Saving…' : 'Save Font'}
          </button>
        </div>
      </div>

      {/* Card Style */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Card Style</h2>

        <div className={styles.cardStyleGrid}>
          {Object.entries(CARD_STYLE_OPTIONS).map(([key, opt]) => (
            <button
              key={key}
              type="button"
              aria-pressed={cardStyle === key}
              className={`${styles.cardStyleBtn} ${cardStyle === key ? styles.cardStyleBtnActive : ''}`}
              onClick={() => setCardStyle(key)}
            >
              <div className={`${styles.cardStyleThumb} ${styles[`cardThumb_${key}`]}`}>
                <div className={styles.cardThumbLine} />
                <div className={styles.cardThumbLine} style={{ width: '60%' }} />
              </div>
              <span className={styles.cardStyleLabel}>{opt.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.themeFooter}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveCardStyle}
            disabled={cardStyleSaving}
          >
            {cardStyleSaving ? 'Saving…' : 'Save Card Style'}
          </button>
        </div>
      </div>

      {/* Org settings form */}
      <form onSubmit={handleSave}>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Organization Details</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-name">Organization Name</label>
            <input
              id="settings-name"
              type="text"
              className={styles.input}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-slug">URL Slug</label>
            <input
              id="settings-slug"
              type="text"
              className={styles.input}
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              required
              maxLength={60}
              pattern="[a-z0-9-]+"
            />
            {form.slug !== currentOrg?.slug && (
              <p className={styles.slugWarning}>
                ⚠ Changing your slug will change all your public URLs — existing links will break.
              </p>
            )}
            <p className={styles.hint}>Only lowercase letters, numbers, and hyphens.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.toggleRow} htmlFor="settings-public">
              <span className={styles.label} style={{ margin: 0 }}>Listed on /discover</span>
              <input
                id="settings-public"
                type="checkbox"
                className={styles.toggle}
                checked={form.isPublic}
                onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
              />
            </label>
            <p className={styles.hint}>When enabled, your organization appears in the public discover directory.</p>
          </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            id="settings-save-btn"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      <FeedbackModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Saved"
        message={successMsg}
        type="success"
      />
      <FeedbackModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Error"
        message={errorMsg}
        type="danger"
      />
    </div>
  );
}
