'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Image, Palette, Upload } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme } from '@/lib/themes';
import styles from './branding.module.css';

interface BrandingSettings {
  logoUrl: string | null;
  heroBannerUrl: string | null;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  themeFont: string | null;
  themeCardStyle: string | null;
}

export default function TournamentBrandingPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings`;

  const [saved, setSaved]               = useState<BrandingSettings | null>(null);
  const [logoPreview, setLogoPreview]   = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading]   = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving]             = useState(false);

  const [presetKey, setPresetKey]         = useState('platform');
  const [customPrimary, setCustomPrimary] = useState('#8B2FC9');
  const [customAccent, setCustomAccent]   = useState('#A855F7');
  const [fontKey, setFontKey]             = useState('system');
  const [cardStyle, setCardStyle]         = useState('default');

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorOpen, setErrorOpen]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const tournamentId = currentTournament?.id;

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`)
      .then(r => r.json())
      .then((data: BrandingSettings) => {
        setSaved(data);
        setLogoPreview(data.logoUrl);
        setBannerPreview(data.heroBannerUrl);
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
      .catch(() => showError('Failed to load branding settings'));
  }, [tournamentId]);

  const isDirty = useMemo(() => {
    if (!saved) return false;
    const savedPresetKey = saved.themePrimary ? 'custom' : (saved.themePreset ?? 'platform');
    const presetChanged =
      presetKey !== savedPresetKey ||
      (presetKey === 'custom' && savedPresetKey === 'custom' && (
        customPrimary !== (saved.themePrimary ?? '#8B2FC9') ||
        customAccent  !== (saved.themeAccent  ?? '#A855F7')
      ));
    return (
      presetChanged ||
      fontKey    !== (saved.themeFont      ?? 'system') ||
      cardStyle  !== (saved.themeCardStyle ?? 'default')
    );
  }, [saved, presetKey, customPrimary, customAccent, fontKey, cardStyle]);

  const previewTheme = useMemo(() => {
    if (presetKey === 'custom') return resolveTheme('platform', customPrimary || null, customAccent || null);
    return resolveTheme(presetKey, null, null);
  }, [presetKey, customPrimary, customAccent]);

  function showError(msg: string) { setErrorMsg(msg); setErrorOpen(true); }

  async function handleSave() {
    if (!tournamentId || saving) return;
    setSaving(true);
    try {
      const themeBody = presetKey === 'custom'
        ? { themePreset: 'platform', themePrimary: customPrimary, themeAccent: customAccent }
        : { themePreset: presetKey, themePrimary: null, themeAccent: null };

      const res = await fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...themeBody, themeFont: fontKey, themeCardStyle: cardStyle }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(prev => prev ? { ...prev, ...themeBody, themeFont: fontKey, themeCardStyle: cardStyle } : null);
      setSuccessMsg('Branding settings saved.');
      setSuccessOpen(true);
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tournamentId) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/tournament-logo?tournamentId=${encodeURIComponent(tournamentId)}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setLogoPreview(data.logoUrl);
      setSaved(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
      setSuccessMsg('Tournament logo updated.');
      setSuccessOpen(true);
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      setLogoPreview(saved?.logoUrl ?? null);
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveLogo() {
    if (!tournamentId) return;
    setLogoUploading(true);
    try {
      const res = await fetch(`/api/admin/tournament-logo?tournamentId=${encodeURIComponent(tournamentId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setLogoPreview(null);
      setSaved(prev => prev ? { ...prev, logoUrl: null } : null);
      setSuccessMsg('Logo removed.');
      setSuccessOpen(true);
    } catch (err: any) {
      showError(err.message ?? 'Remove failed');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tournamentId) return;
    setBannerPreview(URL.createObjectURL(file));
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/tournament-hero-banner?tournamentId=${encodeURIComponent(tournamentId)}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setBannerPreview(data.heroBannerUrl);
      setSaved(prev => prev ? { ...prev, heroBannerUrl: data.heroBannerUrl } : null);
      setSuccessMsg('Hero banner updated.');
      setSuccessOpen(true);
    } catch (err: any) {
      showError(err.message ?? 'Upload failed');
      setBannerPreview(saved?.heroBannerUrl ?? null);
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  }

  async function handleRemoveBanner() {
    if (!tournamentId) return;
    setBannerUploading(true);
    try {
      const res = await fetch(`/api/admin/tournament-hero-banner?tournamentId=${encodeURIComponent(tournamentId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setBannerPreview(null);
      setSaved(prev => prev ? { ...prev, heroBannerUrl: null } : null);
      setSuccessMsg('Hero banner removed.');
      setSuccessOpen(true);
    } catch (err: any) {
      showError(err.message ?? 'Remove failed');
    } finally {
      setBannerUploading(false);
    }
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Only organization owners can manage tournament branding.</p>
      </div>
    );
  }

  if (!tournamentId) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Select a tournament from the sidebar to manage its branding.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link href={base} className={styles.backBtn}>
          <ArrowLeft size={13} /> Settings
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div className={styles.headerIcon}><Palette size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Public Site & Branding</h1>
          <p className={styles.pageSub}>{currentTournament?.name} — logo, colors, banner, and font</p>
        </div>
      </div>

      {/* ── Tournament Logo ─────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Tournament Logo</h2>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className={styles.logoImg} />
              : <span className={styles.logoPlaceholder}>⚾</span>
            }
          </div>
          <div className={styles.logoActions}>
            <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
              <Upload size={15} />
              {logoUploading ? 'Uploading…' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {logoPreview && (
              <button type="button" className="btn btn-ghost" onClick={handleRemoveLogo} disabled={logoUploading}>
                Remove
              </button>
            )}
            <p className={styles.logoHint}>JPG, PNG, or WebP — max 2 MB. Falls back to organization logo when not set.</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
      </div>

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Hero Banner</h2>
        <p className={styles.bannerDesc}>
          Full-width image shown at the top of this tournament&apos;s public page. Falls back to the organization banner when not set.
        </p>
        {bannerPreview && (
          <div className={styles.bannerPreview}>
            <img src={bannerPreview} alt="Hero banner preview" className={styles.bannerImg} />
          </div>
        )}
        <div className={styles.logoActions}>
          <button type="button" className="btn btn-outline" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}>
            <Image size={15} />
            {bannerUploading ? 'Uploading…' : bannerPreview ? 'Replace Banner' : 'Upload Banner'}
          </button>
          {bannerPreview && (
            <button type="button" className="btn btn-ghost" onClick={handleRemoveBanner} disabled={bannerUploading}>
              Remove
            </button>
          )}
        </div>
        <p className={styles.bannerHint}>JPG, PNG, or WebP — max 4 MB. Recommended 16:5 ratio.</p>
        <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerChange} style={{ display: 'none' }} />
      </div>

      {/* ── Color Theme ─────────────────────────────────────────────────────── */}
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
              {presetKey === key && <span className={styles.swatchCheck}>✓</span>}
            </button>
          ))}
          <button
            type="button"
            title="Custom colors"
            aria-label="Custom colors"
            aria-pressed={presetKey === 'custom'}
            className={`${styles.swatch} ${styles.swatchCustom} ${presetKey === 'custom' ? styles.swatchActive : ''}`}
            onClick={() => setPresetKey('custom')}
          >
            {presetKey === 'custom' && <span className={styles.swatchCheck}>✓</span>}
          </button>
        </div>

        {presetKey === 'custom' && (
          <div className={styles.customPickers}>
            <div className={styles.colorPickerField}>
              <label className={styles.label} htmlFor="t-primary">Primary</label>
              <input id="t-primary" type="color" className={styles.colorInput} value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} />
            </div>
            <div className={styles.colorPickerField}>
              <label className={styles.label} htmlFor="t-accent">Accent</label>
              <input id="t-accent" type="color" className={styles.colorInput} value={customAccent} onChange={e => setCustomAccent(e.target.value)} />
            </div>
          </div>
        )}

        {previewTheme.isLowContrast && (
          <div className={styles.lowContrastWarning}>Low contrast — text may be hard to read.</div>
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

        <p className={styles.inheritNote}>When not set, this tournament inherits the organization color theme.</p>
      </div>

      {/* ── Font Family ─────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Font Family</h2>
        <div className={styles.fontGrid}>
          {Object.entries(FONT_OPTIONS).map(([key, opt]) => (
            <button
              key={key}
              type="button"
              aria-pressed={fontKey === key}
              className={`${styles.fontBtn} ${fontKey === key ? styles.fontBtnActive : ''}`}
              style={{ fontFamily: opt.sampleStyle }}
              onClick={() => setFontKey(key)}
            >
              <span className={styles.fontBtnLabel}>{opt.label}</span>
              <span className={styles.fontBtnSample}>Aa 123</span>
            </button>
          ))}
        </div>
        <p className={styles.inheritNote}>When not set, this tournament inherits the organization font.</p>
      </div>

      {/* ── Card Style ──────────────────────────────────────────────────────── */}
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
              <div className={`${styles.cardStyleThumb} ${styles[`cardThumb_${key}` as keyof typeof styles]}`}>
                <div className={styles.cardThumbLine} />
                <div className={styles.cardThumbLine} style={{ width: '60%' }} />
              </div>
              <span className={styles.cardStyleLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
        <p className={styles.inheritNote}>When not set, this tournament inherits the organization card style.</p>
      </div>

      {/* ── Save footer ─────────────────────────────────────────────────────── */}
      <div className={styles.formFooter}>
        {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message={successMsg} type="success" />
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
