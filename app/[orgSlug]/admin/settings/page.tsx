'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Upload, Lock, Check, Image, AlertTriangle, Library, X } from 'lucide-react';
import { STOCK_LOGOS, STOCK_LOGO_CATEGORIES, isStockLogoUnlocked } from '@/lib/stock-logos';
import { useOrg } from '@/lib/org-context';
import { useOrgNav } from '@/components/OrgNavContext';
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
  requireScoreFinalization: boolean;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const { currentOrg, userRole, loading, refresh } = useOrg();
  const { setOrgNav } = useOrgNav();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', isPublic: false });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [stockLogoOpen, setStockLogoOpen] = useState(false);
  const [stockLogoSelected, setStockLogoSelected] = useState<string | null>(null);
  const [stockLogoSaving, setStockLogoSaving] = useState(false);
  const [stockLogoLockedCta, setStockLogoLockedCta] = useState<string | null>(null);

  const [presetKey, setPresetKey]         = useState<string>('platform');
  const [customPrimary, setCustomPrimary] = useState<string>('#8B2FC9');
  const [customAccent, setCustomAccent]   = useState<string>('#A855F7');

  const [heroBannerPreview, setHeroBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading]     = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [fontKey, setFontKey]   = useState<string>('system');
  const [cardStyle, setCardStyle] = useState<string>('default');
  const [requireFinalization, setRequireFinalization] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorOpen, setErrorOpen]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  // Navigation guard
  const [navGuardOpen, setNavGuardOpen]     = useState(false);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);

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
        setRequireFinalization(data.requireScoreFinalization ?? false);
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

  const isDirty = useMemo(() => {
    if (!settings) return false;
    const savedPresetKey = settings.themePrimary ? 'custom' : (settings.themePreset ?? 'platform');
    const presetChanged = presetKey !== savedPresetKey ||
      (presetKey === 'custom' && savedPresetKey === 'custom' && (
        customPrimary !== (settings.themePrimary ?? '#8B2FC9') ||
        customAccent  !== (settings.themeAccent  ?? '#A855F7')
      ));
    return (
      form.name  !== settings.name  ||
      form.slug  !== settings.slug  ||
      form.isPublic !== settings.isPublic ||
      presetChanged ||
      fontKey !== (settings.themeFont     ?? 'system')  ||
      cardStyle !== (settings.themeCardStyle ?? 'default') ||
      requireFinalization !== (settings.requireScoreFinalization ?? false)
    );
  }, [settings, form, presetKey, customPrimary, customAccent, fontKey, cardStyle, requireFinalization]);

  // Warn on browser refresh / tab close when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept client-side link clicks and browser back when dirty
  useEffect(() => {
    if (!isDirty) return;

    // Intercept <a> clicks in capture phase (fires before Next.js router handler)
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      // Ignore same-page anchors, external links, and the current path
      if (!href || href.startsWith('#') || href.startsWith('http') || href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavHref(href);
      setNavGuardOpen(true);
    };

    // Intercept browser back/forward button
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setPendingNavHref(null); // back-button destination unknown; just show guard
      setNavGuardOpen(true);
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

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

  async function handleSaveAll(): Promise<boolean> {
    if (!currentOrg || saving) return false;
    setSaving(true);
    try {
      const themeBody = presetKey === 'custom'
        ? { themePreset: 'platform', themePrimary: customPrimary, themeAccent: customAccent }
        : { themePreset: presetKey, themePrimary: null, themeAccent: null };

      const res = await fetch('/api/admin/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name,
          slug:     form.slug,
          isPublic: form.isPublic,
          ...themeBody,
          themeFont:                fontKey,
          themeCardStyle:           cardStyle,
          requireScoreFinalization: requireFinalization,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      setSettings(prev => prev ? {
        ...prev,
        name: form.name,
        slug: form.slug,
        isPublic: form.isPublic,
        ...themeBody,
        themeFont:                fontKey,
        themeCardStyle:           cardStyle,
        requireScoreFinalization: requireFinalization,
      } : null);

      setSuccessMsg('Settings saved.');
      setSuccessOpen(true);
      refresh();

      if (data.slug && data.slug !== currentOrg.slug) {
        router.push(`/${data.slug}/admin/settings`);
      }
      return true;
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    if (!settings) return;
    setForm({ name: settings.name, slug: settings.slug, isPublic: settings.isPublic });
    const savedPresetKey = settings.themePrimary ? 'custom' : (settings.themePreset ?? 'platform');
    setPresetKey(savedPresetKey);
    if (savedPresetKey === 'custom') {
      setCustomPrimary(settings.themePrimary ?? '#8B2FC9');
      setCustomAccent(settings.themeAccent   ?? '#A855F7');
    }
    setFontKey(settings.themeFont        ?? 'system');
    setCardStyle(settings.themeCardStyle ?? 'default');
    setRequireFinalization(settings.requireScoreFinalization ?? false);
  }

  async function handleNavGuardSave() {
    const ok = await handleSaveAll();
    if (!ok) return; // save failed — stay on page, error modal already shown
    setNavGuardOpen(false);
    if (pendingNavHref) router.push(pendingNavHref);
    setPendingNavHref(null);
  }

  function handleNavGuardDiscard() {
    discardChanges();
    setNavGuardOpen(false);
    if (pendingNavHref) router.push(pendingNavHref);
    setPendingNavHref(null);
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
      setSettings(prev => prev ? { ...prev, heroBannerUrl: data.heroBannerUrl } : null);
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
      setSettings(prev => prev ? { ...prev, heroBannerUrl: null } : null);
      setSuccessMsg('Hero banner removed.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Remove failed');
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/org-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setLogoPreview(data.logoUrl);
      setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
      setOrgNav(data.logoUrl, currentOrg?.name ?? '');
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

  async function handleRemoveLogo() {
    setUploading(true);
    try {
      const res = await fetch('/api/admin/org-logo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Remove failed');
      setLogoPreview(null);
      setSettings(prev => prev ? { ...prev, logoUrl: null } : null);
      setOrgNav(null, currentOrg?.name ?? '');
      setSuccessMsg('Logo removed.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Remove failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleStockLogoConfirm() {
    if (!stockLogoSelected || !currentOrg) return;
    setStockLogoSaving(true);
    try {
      const res = await fetch('/api/admin/org-logo-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockPath: stockLogoSelected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to set logo');
      setLogoPreview(data.logoUrl);
      setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
      setOrgNav(data.logoUrl, currentOrg.name);
      setStockLogoOpen(false);
      setStockLogoSelected(null);
      setStockLogoLockedCta(null);
      setSuccessMsg('Logo updated.');
      setSuccessOpen(true);
      refresh();
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setStockLogoSaving(false);
    }
  }

  function closeStockModal() {
    setStockLogoOpen(false);
    setStockLogoSelected(null);
    setStockLogoLockedCta(null);
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

      {/* ── Organization Logo ─────────────────────────────────────────────────── */}
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
              {uploading ? 'Uploading…' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStockLogoOpen(true)}
              disabled={uploading}
              id="settings-logo-stock-btn"
            >
              <Library size={15} />
              Browse Stock Logos
            </button>
            {logoPreview && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleRemoveLogo}
                disabled={uploading}
                id="settings-logo-remove-btn"
              >
                Remove
              </button>
            )}
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

      {/* ── Organization Details ──────────────────────────────────────────────── */}
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
            maxLength={40}
          />
          <div className={styles.charCountRow}>
            <p className={styles.hint}>Shown in the navigation bar and on public pages.</p>
            <span className={`${styles.charCount} ${form.name.length > 34 ? styles.charCountWarn : ''}`}>
              {form.name.length} / 40
            </span>
          </div>
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

      {/* ── Color Theme ───────────────────────────────────────────────────────── */}
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
      </div>

      {/* ── Hero Banner ───────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Hero Banner</h2>
          {!isCustomPlan && (
            <span className={styles.planLock}><Lock size={12} /> Pro / Elite only</span>
          )}
        </div>

        {isCustomPlan ? (
          <>
            <p className={styles.bannerDesc}>
              Displayed as a full-width image at the top of your public tournament home page.
            </p>
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
            <p className={styles.bannerHint}>JPG, PNG, or WebP — max 4 MB. Recommended 16:5 ratio.</p>
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

      {/* ── Font Family ───────────────────────────────────────────────────────── */}
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
      </div>

      {/* ── Card Style ────────────────────────────────────────────────────────── */}
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

        {/* Live card preview */}
        <div
          className={`${styles.cardPreviewSample} ${styles[`cardPreview_${cardStyle}`]}`}
          style={{
            '--primary':       previewTheme.primary,
            '--primary-light': previewTheme.primaryLight,
            '--primary-rgb':   previewTheme.primaryRgb,
            '--border':        `rgba(${previewTheme.primaryRgb}, 0.25)`,
          } as React.CSSProperties}
        >
          <p className={styles.themePreviewLabel} style={{ margin: '0 0 0.5rem' }}>Preview</p>
          <div className={styles.cardPreviewHeader}>
            <span className={styles.cardPreviewTitle}>Diamond 1 · U12 Division</span>
            <span className={styles.cardPreviewBadge}>Active</span>
          </div>
          <div className={styles.cardPreviewMeta}>Sat Jun 14 · 9:00 AM · Lions Park</div>
        </div>
      </div>

      {/* ── Scoring ───────────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Scoring</h2>

        <div className={styles.field}>
          <label className={styles.toggleRow} htmlFor="settings-require-finalization">
            <span className={styles.label} style={{ margin: 0 }}>Require admin finalization</span>
            <input
              id="settings-require-finalization"
              type="checkbox"
              className={styles.toggle}
              checked={requireFinalization}
              onChange={e => setRequireFinalization(e.target.checked)}
            />
          </label>
          <p className={styles.hint}>
            When enabled, scores submitted by field officials are visible to the public immediately
            but are not marked final until an admin reviews and finalizes them in the Results page.
            Officials can correct a submitted score until it is finalized.
            When disabled, an official&apos;s submission is immediately final.
          </p>
        </div>
      </div>

      {/* ── Save footer ───────────────────────────────────────────────────────── */}
      <div className={styles.formFooter}>
        {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveAll}
          disabled={saving || !isDirty}
          id="settings-save-btn"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Stock logo picker modal ─────────────────────────────────────────── */}
      {stockLogoOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.stockModal}>
            <div className={styles.stockModalHeader}>
              <h3>Choose a Stock Logo</h3>
              <button type="button" className={styles.stockModalClose} onClick={closeStockModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className={styles.stockModalSubtitle}>Select an icon to represent your organization.</p>

            {STOCK_LOGO_CATEGORIES.map(category => {
              const icons = STOCK_LOGOS.filter(l => l.category === category);
              if (!icons.length) return null;
              return (
                <div key={category}>
                  <p className={styles.stockCategoryLabel}>{category}</p>
                  <div className={styles.stockGrid}>
                    {icons.map(logo => {
                      const unlocked = currentOrg ? isStockLogoUnlocked(logo, currentOrg.planId) : false;
                      const isSelected = stockLogoSelected === logo.file;
                      return (
                        <button
                          key={logo.id}
                          type="button"
                          aria-label={logo.label}
                          aria-pressed={isSelected}
                          className={[
                            styles.stockTile,
                            isSelected ? styles.stockTileActive : '',
                            !unlocked ? styles.stockTileLocked : '',
                          ].join(' ')}
                          onClick={() => {
                            if (!unlocked) {
                              setStockLogoLockedCta(logo.minPlan);
                              return;
                            }
                            setStockLogoLockedCta(null);
                            setStockLogoSelected(logo.file);
                          }}
                        >
                          <img src={logo.file} alt={logo.label} className={styles.stockTileImg} />
                          <span className={styles.stockTileLabel}>{logo.label}</span>
                          {isSelected && (
                            <span className={styles.stockTileCheck}><Check size={11} strokeWidth={3} /></span>
                          )}
                          {!unlocked && (
                            <span className={styles.stockLockBadge}><Lock size={9} /></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {stockLogoLockedCta && (
              <div className={styles.stockUpgradeCta}>
                <Lock size={14} />
                Upgrade to {stockLogoLockedCta.charAt(0).toUpperCase() + stockLogoLockedCta.slice(1)} to unlock this icon.
              </div>
            )}

            <div className={styles.stockModalFooter}>
              <button type="button" className="btn btn-ghost" onClick={closeStockModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStockLogoConfirm}
                disabled={!stockLogoSelected || stockLogoSaving}
              >
                {stockLogoSaving ? 'Saving…' : 'Use This Logo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation guard modal ──────────────────────────────────────────── */}
      {navGuardOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <AlertTriangle size={20} />
              <h3>Unsaved Changes</h3>
            </div>
            <p className={styles.modalBody}>
              You have unsaved changes that will be lost if you navigate away.
              Would you like to save before leaving?
            </p>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setNavGuardOpen(false); setPendingNavHref(null); }}
              >
                Stay on Page
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleNavGuardDiscard}
              >
                Discard & Leave
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNavGuardSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

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
