'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, Image as ImageIcon, Palette, Upload } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import FeedbackModal from '@/components/FeedbackModal';
import { TournamentAdminHeader, CompactUpsell } from '@/components/admin/tournament';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme } from '@/lib/themes';
import { PUBLIC_PAGE_OPTIONS, normalizeHiddenPublicPages, type PublicPageKey } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import styles from './branding.module.css';

interface BrandingSettings {
  logoUrl: string | null;
  heroBannerUrl: string | null;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  themeFont: string | null;
  themeCardStyle: string | null;
  colorMode: 'dark' | 'light';
  publicHiddenPages: PublicPageKey[];
  coachNamesShowOnPublic: boolean;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

type SectionKey = 'publicPages' | 'logo' | 'theme' | 'heroBanner' | 'fontFamily' | 'cardStyle';

export default function TournamentBrandingPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Public Site');
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;

  const [saved, setSaved] = useState<BrandingSettings | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [presetKey, setPresetKey] = useState('platform');
  const [customPrimary, setCustomPrimary] = useState('#1E3A8A');
  const [customAccent, setCustomAccent] = useState('#D9F99D');
  const [fontKey, setFontKey] = useState('system');
  const [cardStyle, setCardStyle] = useState('default');
  const [colorMode, setColorMode] = useState<'dark' | 'light'>('dark');
  const [publicHiddenPages, setPublicHiddenPages] = useState<PublicPageKey[]>([]);
  const [coachNamesShowOnPublic, setCoachNamesShowOnPublic] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Accordion state — Public Pages open by default, advanced sections closed
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    publicPages: true,
    logo: false,
    theme: false,
    heroBanner: false,
    fontFamily: false,
    cardStyle: false,
  });

  function toggleSection(key: SectionKey) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const tournamentId = currentTournament?.id;
  const canUseAdvancedBranding = currentOrg?.planId
    ? hasPlanFeature(currentOrg.planId, 'advanced_tournament_branding')
    : false;
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const upgradeHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`)
      .then(r => r.json())
      .then((data: BrandingSettings) => {
        setSaved(data);
        setLogoPreview(data.logoUrl);
        setBannerPreview(data.heroBannerUrl);
        setFontKey(canUseAdvancedBranding ? data.themeFont ?? 'system' : 'system');
        setCardStyle(canUseAdvancedBranding ? data.themeCardStyle ?? 'default' : 'default');
        setColorMode(data.colorMode ?? 'dark');
        setPublicHiddenPages(normalizeHiddenPublicPages(data.publicHiddenPages));
        setCoachNamesShowOnPublic(data.coachNamesShowOnPublic === true);
        if (data.themePrimary && canUseAdvancedBranding) {
          setPresetKey('custom');
          setCustomPrimary(data.themePrimary);
          setCustomAccent(data.themeAccent ?? '#D9F99D');
        } else {
          setPresetKey(data.themePreset ?? 'platform');
        }
      })
      .catch(() => showError('Failed to load branding settings'));
  }, [tournamentId, canUseAdvancedBranding, orgParam]);

  const isDirty = useMemo(() => {
    if (!saved) return false;
    // Public-site controls (page visibility + coach-name toggle) are available on every plan.
    const publicSiteDirty =
      normalizeHiddenPublicPages(publicHiddenPages).join('|') !== normalizeHiddenPublicPages(saved.publicHiddenPages).join('|') ||
      coachNamesShowOnPublic !== (saved.coachNamesShowOnPublic === true);
    if (!canUseAdvancedBranding) {
      return publicSiteDirty;
    }
    const savedPresetKey = saved.themePrimary && canUseAdvancedBranding ? 'custom' : (saved.themePreset ?? 'platform');
    const savedFontKey = canUseAdvancedBranding ? saved.themeFont ?? 'system' : 'system';
    const savedCardStyle = canUseAdvancedBranding ? saved.themeCardStyle ?? 'default' : 'default';
    const presetChanged =
      presetKey !== savedPresetKey ||
      (canUseAdvancedBranding && presetKey === 'custom' && savedPresetKey === 'custom' && (
        customPrimary !== (saved.themePrimary ?? '#1E3A8A') ||
        customAccent !== (saved.themeAccent ?? '#D9F99D')
      ));
    return (
      presetChanged ||
      fontKey !== savedFontKey ||
      cardStyle !== savedCardStyle ||
      colorMode !== (saved.colorMode ?? 'dark') ||
      publicSiteDirty
    );
  }, [saved, presetKey, customPrimary, customAccent, fontKey, cardStyle, colorMode, publicHiddenPages, coachNamesShowOnPublic, canUseAdvancedBranding]);

  const previewTheme = useMemo(() => {
    if (presetKey === 'custom' && canUseAdvancedBranding) {
      return resolveTheme('platform', customPrimary || null, customAccent || null);
    }
    return resolveTheme(presetKey, null, null);
  }, [presetKey, customPrimary, customAccent, canUseAdvancedBranding]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setErrorOpen(true);
  }

  async function handleSave() {
    if (!tournamentId || saving) return;
    setSaving(true);
    try {
      const normalizedHiddenPages = normalizeHiddenPublicPages(publicHiddenPages);
      const safeFontKey = canUseAdvancedBranding ? fontKey : 'system';
      const safeCardStyle = canUseAdvancedBranding ? cardStyle : 'default';
      const themeBody = presetKey === 'custom' && canUseAdvancedBranding
        ? { themePreset: 'platform', themePrimary: customPrimary, themeAccent: customAccent }
        : { themePreset: presetKey, themePrimary: null, themeAccent: null };
      const requestBody = canUseAdvancedBranding
        ? {
            ...themeBody,
            themeFont: safeFontKey,
            themeCardStyle: safeCardStyle,
            colorMode,
            publicHiddenPages: normalizedHiddenPages,
            coachNamesShowOnPublic,
          }
        : {
            publicHiddenPages: normalizedHiddenPages,
            coachNamesShowOnPublic,
          };

      const res = await fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Save failed');
      }
      setFontKey(safeFontKey);
      setCardStyle(safeCardStyle);
      setPublicHiddenPages(normalizedHiddenPages);
      setSaved(prev => prev ? {
        ...prev,
        ...(canUseAdvancedBranding ? {
          ...themeBody,
          themeFont: safeFontKey,
          themeCardStyle: safeCardStyle,
          colorMode,
        } : {}),
        publicHiddenPages: normalizedHiddenPages,
        coachNamesShowOnPublic,
      } : null);
      setSuccessMsg('Branding settings saved.');
      setSuccessOpen(true);
    } catch (err: unknown) {
      showError(errorMessage(err, 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  }

  function togglePublicPage(key: PublicPageKey) {
    setPublicHiddenPages(prev => (
      prev.includes(key)
        ? prev.filter(item => item !== key)
        : [...prev, key]
    ));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tournamentId || !canUseAdvancedBranding) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/tournament-logo?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setLogoPreview(data.logoUrl);
      setSaved(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
      setSuccessMsg('Tournament logo updated.');
      setSuccessOpen(true);
    } catch (err: unknown) {
      showError(errorMessage(err, 'Upload failed'));
      setLogoPreview(saved?.logoUrl ?? null);
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveLogo() {
    if (!tournamentId || !canUseAdvancedBranding) return;
    setLogoUploading(true);
    try {
      const res = await fetch(`/api/admin/tournament-logo?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setLogoPreview(null);
      setSaved(prev => prev ? { ...prev, logoUrl: null } : null);
      setSuccessMsg('Logo removed.');
      setSuccessOpen(true);
    } catch (err: unknown) {
      showError(errorMessage(err, 'Remove failed'));
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tournamentId || !canUseAdvancedBranding) return;
    setBannerPreview(URL.createObjectURL(file));
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/tournament-hero-banner?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setBannerPreview(data.heroBannerUrl);
      setSaved(prev => prev ? { ...prev, heroBannerUrl: data.heroBannerUrl } : null);
      setSuccessMsg('Hero banner updated.');
      setSuccessOpen(true);
    } catch (err: unknown) {
      showError(errorMessage(err, 'Upload failed'));
      setBannerPreview(saved?.heroBannerUrl ?? null);
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  }

  async function handleRemoveBanner() {
    if (!tournamentId || !canUseAdvancedBranding) return;
    setBannerUploading(true);
    try {
      const res = await fetch(`/api/admin/tournament-hero-banner?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setBannerPreview(null);
      setSaved(prev => prev ? { ...prev, heroBannerUrl: null } : null);
      setSuccessMsg('Hero banner removed.');
      setSuccessOpen(true);
    } catch (err: unknown) {
      showError(errorMessage(err, 'Remove failed'));
    } finally {
      setBannerUploading(false);
    }
  }

  if (!hasCapability(userRole ?? 'official', userCapabilities, 'manage_branding')) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>You don&apos;t have access to manage tournament branding.</p>
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
      <TournamentAdminHeader
        icon={<Palette size={16} />}
        title="Public Site"
        subtitle={`${currentTournament?.name} — logo, colors, pages, and advanced styling`}
      />

      {/* ── Public Pages ──────────────────────────── */}
      <div className={styles.card}>
        <button
          type="button"
          className={styles.accordionTrigger}
          onClick={() => toggleSection('publicPages')}
          aria-expanded={openSections.publicPages}
        >
          <h2 className={styles.sectionTitle}>Public Pages</h2>
          <ChevronDown size={14} className={`${styles.chevron} ${openSections.publicPages ? styles.chevronOpen : ''}`} aria-hidden />
        </button>
        <div className={styles.accordionBody} data-open={openSections.publicPages || undefined}>
          <p className={styles.compactNote}>
            Choose which pages appear on this tournament&apos;s public site.
          </p>
          <div className={styles.pageSelectorGrid}>
            {PUBLIC_PAGE_OPTIONS.map(page => {
              const checked = !publicHiddenPages.includes(page.key);
              return (
                <label key={page.key} className={styles.pageSelector}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePublicPage(page.key)}
                  />
                  <span>
                    <strong>{page.label}</strong>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Coach-name visibility — a public PII control, available on every plan (mig 150). */}
          <label className={styles.pageSelector} style={{ marginTop: '0.65rem', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={coachNamesShowOnPublic}
              onChange={() => setCoachNamesShowOnPublic(v => !v)}
            />
            <span>
              <strong>Show coach names</strong>
              <span className={styles.compactNote} style={{ margin: 0 }}>
                Display each team&apos;s coach name on the public Teams cards, team profiles, and schedule search. Off by default to keep coach names private. Coach names always stay visible in your admin views and the Coaches Portal.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── Advanced Branding section header ─────── */}
      <div className={styles.advancedHeader}>
        <p className={styles.advancedEyebrow}>Advanced Branding</p>
        <span className={styles.planBadge}>Tournament Plus</span>
      </div>

      {/* Single consolidated upsell — free tier only */}
      {!canUseAdvancedBranding && (
        <CompactUpsell
          title="Unlock Advanced Branding"
          className={styles.upsellBlock}
          action={
            <Link href={upgradeHref} className="btn btn-outline btn-data">
              Upgrade
            </Link>
          }
        >
          Logo uploads, custom colors, hero banner, custom fonts, and card styles.
        </CompactUpsell>
      )}

      {/* ── Tournament Logo ───────────────────────── */}
      {!canUseAdvancedBranding ? (
        <div className={styles.card}>
          <div className={`${styles.sectionTitleRow} ${styles.lockedCardHeader}`}>
            <h2 className={styles.sectionTitle}>Tournament Logo</h2>
            <span className={styles.lockedBadge}>Locked</span>
          </div>
          <p className={styles.lockedHint}>Upload a custom logo for this tournament&apos;s public site.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button
            type="button"
            className={styles.accordionTrigger}
            onClick={() => toggleSection('logo')}
            aria-expanded={openSections.logo}
          >
            <h2 className={styles.sectionTitle}>Tournament Logo</h2>
            <ChevronDown size={14} className={`${styles.chevron} ${openSections.logo ? styles.chevronOpen : ''}`} aria-hidden />
          </button>
          <div className={styles.accordionBody} data-open={openSections.logo || undefined}>
            <div className={styles.logoRow}>
              <div className={styles.logoPreview}>
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className={styles.logoImg} />
                  : <span className={styles.logoPlaceholder} aria-hidden="true"><ImageIcon size={30} /></span>
                }
              </div>
              <div className={styles.logoActions}>
                <button type="button" className="btn btn-outline btn-data" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
                  <Upload size={13} />
                  {logoUploading ? 'Uploading...' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
                </button>
                {logoPreview && (
                  <button type="button" className="btn btn-ghost btn-data" onClick={handleRemoveLogo} disabled={logoUploading}>
                    Remove
                  </button>
                )}
                <p className={styles.logoHint}>JPG, PNG, or WebP · max 2 MB. Falls back to organization logo when not set.</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {/* ── Theme ─────────────────────────────────── */}
      {!canUseAdvancedBranding ? (
        <div className={styles.card}>
          <div className={`${styles.sectionTitleRow} ${styles.lockedCardHeader}`}>
            <h2 className={styles.sectionTitle}>Theme</h2>
            <span className={styles.lockedBadge}>Locked</span>
          </div>
          <p className={styles.lockedHint}>Set a custom color palette and background mode for the public site.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button
            type="button"
            className={styles.accordionTrigger}
            onClick={() => toggleSection('theme')}
            aria-expanded={openSections.theme}
          >
            <h2 className={styles.sectionTitle}>Theme</h2>
            <ChevronDown size={14} className={`${styles.chevron} ${openSections.theme ? styles.chevronOpen : ''}`} aria-hidden />
          </button>
          <div className={styles.accordionBody} data-open={openSections.theme || undefined}>
            <p className={styles.compactNote}>
              Choose the public site color palette and background mode for this tournament.
            </p>
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

            <div className={styles.modeToggleRow}>
              <h3 className={styles.modeToggleLabel}>Background</h3>
              <div className={styles.modeToggle} role="group" aria-label="Background mode">
                {(['dark', 'light'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={colorMode === m}
                    className={`${styles.modeToggleBtn} ${colorMode === m ? styles.modeToggleBtnActive : ''}`}
                    onClick={() => setColorMode(m)}
                  >
                    {m === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            {previewTheme.isLowContrast && (
              <div className={styles.lowContrastWarning}>Low contrast — text may be hard to read.</div>
            )}

            <div
              className={styles.themePreview}
              style={{
                '--primary': previewTheme.primary,
                '--primary-light': previewTheme.primaryLight,
                '--primary-rgb': previewTheme.primaryRgb,
                '--border': `rgba(${previewTheme.primaryRgb}, 0.25)`,
              } as React.CSSProperties}
            >
              <p className={styles.themePreviewLabel}>Preview</p>
              <div className={`${styles.modePreview} ${colorMode === 'light' ? styles.modePreviewLight : styles.modePreviewDark}`}>
                <div className={styles.previewHeroText}>
                  <span className={colorMode === 'light' ? styles.previewBadgeLight : styles.previewBadgeDark}>2026 Tournament</span>
                  <strong>Public Site</strong>
                  <span>Hosted by your organization.</span>
                </div>
                <div className={styles.previewActions}>
                  <button type="button" className={colorMode === 'light' ? styles.previewPrimaryLight : styles.previewPrimaryDark}>Register</button>
                  <button type="button" className={colorMode === 'light' ? styles.previewOutlineLight : styles.previewOutlineDark}>Schedule</button>
                </div>
              </div>
            </div>

            <p className={styles.inheritNote}>When not set, this tournament inherits the organization color theme.</p>
          </div>
        </div>
      )}

      {/* ── Hero Banner ───────────────────────────── */}
      {!canUseAdvancedBranding ? (
        <div className={styles.card}>
          <div className={`${styles.sectionTitleRow} ${styles.lockedCardHeader}`}>
            <h2 className={styles.sectionTitle}>Hero Banner</h2>
            <span className={styles.lockedBadge}>Locked</span>
          </div>
          <p className={styles.lockedHint}>Add a full-width header image to the public tournament page.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button
            type="button"
            className={styles.accordionTrigger}
            onClick={() => toggleSection('heroBanner')}
            aria-expanded={openSections.heroBanner}
          >
            <h2 className={styles.sectionTitle}>Hero Banner</h2>
            <ChevronDown size={14} className={`${styles.chevron} ${openSections.heroBanner ? styles.chevronOpen : ''}`} aria-hidden />
          </button>
          <div className={styles.accordionBody} data-open={openSections.heroBanner || undefined}>
            <p className={styles.bannerDesc}>
              Full-width image shown at the top of this tournament&apos;s public page. Falls back to the organization banner when not set.
            </p>
            {bannerPreview && (
              <div className={styles.bannerPreview}>
                <img src={bannerPreview} alt="Hero banner preview" className={styles.bannerImg} />
              </div>
            )}
            <div className={styles.logoActions}>
              <button
                type="button"
                className="btn btn-outline btn-data"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
              >
                <ImageIcon size={13} />
                {bannerUploading ? 'Uploading...' : bannerPreview ? 'Replace Banner' : 'Upload Banner'}
              </button>
              {bannerPreview && (
                <button type="button" className="btn btn-ghost btn-data" onClick={handleRemoveBanner} disabled={bannerUploading}>
                  Remove
                </button>
              )}
            </div>
            <p className={styles.bannerHint}>JPG, PNG, or WebP · max 4 MB. Recommended 16:5 ratio.</p>
            <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerChange} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {/* ── Font Family ───────────────────────────── */}
      {!canUseAdvancedBranding ? (
        <div className={styles.card}>
          <div className={`${styles.sectionTitleRow} ${styles.lockedCardHeader}`}>
            <h2 className={styles.sectionTitle}>Font Family</h2>
            <span className={styles.lockedBadge}>Locked</span>
          </div>
          <p className={styles.lockedHint}>Choose a custom typeface for the public site.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button
            type="button"
            className={styles.accordionTrigger}
            onClick={() => toggleSection('fontFamily')}
            aria-expanded={openSections.fontFamily}
          >
            <h2 className={styles.sectionTitle}>Font Family</h2>
            <ChevronDown size={14} className={`${styles.chevron} ${openSections.fontFamily ? styles.chevronOpen : ''}`} aria-hidden />
          </button>
          <div className={styles.accordionBody} data-open={openSections.fontFamily || undefined}>
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
        </div>
      )}

      {/* ── Card Style ────────────────────────────── */}
      {!canUseAdvancedBranding ? (
        <div className={styles.card}>
          <div className={`${styles.sectionTitleRow} ${styles.lockedCardHeader}`}>
            <h2 className={styles.sectionTitle}>Card Style</h2>
            <span className={styles.lockedBadge}>Locked</span>
          </div>
          <p className={styles.lockedHint}>Control how content cards look on the public site.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <button
            type="button"
            className={styles.accordionTrigger}
            onClick={() => toggleSection('cardStyle')}
            aria-expanded={openSections.cardStyle}
          >
            <h2 className={styles.sectionTitle}>Card Style</h2>
            <ChevronDown size={14} className={`${styles.chevron} ${openSections.cardStyle ? styles.chevronOpen : ''}`} aria-hidden />
          </button>
          <div className={styles.accordionBody} data-open={openSections.cardStyle || undefined}>
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
        </div>
      )}

      {/* ── Save footer ───────────────────────────── */}
      <div className={styles.formFooter}>
        {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
        <button type="button" className="btn btn-lime btn-data" onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message={successMsg} type="success" />
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
