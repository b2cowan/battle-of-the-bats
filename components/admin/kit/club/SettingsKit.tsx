'use client';
/**
 * ORGANIZATION SETTINGS on the kit (Club Tier Stage 1, screens session; specimen 9 "the decisions
 * only"). Rendered by the Settings page (its old page went with Admin Design Continuity Part B, area 2).
 * Owner only, as always.
 *
 *   NEW — "Your public site": the one mislabelled checkbox ("Listed on /discover", which really
 *   switched the WHOLE site, A09/F04) becomes the two real settings — the site's master switch and
 *   the directory listing (`isDiscoverable`, which had no control at all). The directory switch is off
 *   and greyed while the site is off. Taking the site offline ASKS first, and the question names ONLY
 *   what goes offline today — the home page and the league pages (team pages and tryout forms do not
 *   check the switch yet, F06/Stage 4; promising more would be false). Both switches save the moment
 *   they are set: a switch that waited for a Save below the fold would read as done when it was not.
 *
 *   RESTYLED — everything else the page did, the same fields, words and actions on the kit: the logo
 *   (upload, stock logos, remove), name and slug (with the slug warning), the colour theme, the hero
 *   banner (its copy names the club's home page now, A14), the font, the card style, the one Save with
 *   its unsaved-changes guard, and the deletion request. The theme and card previews are PICTURES OF
 *   THE PUBLIC PAGE, so they wear the org's colours inside a public-preview island (R2).
 *
 * ⚠ NO PLAN LOCKS on the custom colours, fonts or hero banner, unlike today's page: today's locks are
 * for the free Tournament plan, and a Tournament-tier org never reaches this page (the org layout
 * sends it to its tournaments first). The server's own refusal still stands behind it.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Library, ImageIcon, Check, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useOrgNav } from '@/components/OrgNavContext';
import { isClubPlan } from '@/lib/module-entitlements';
import { STOCK_LOGOS, STOCK_LOGO_CATEGORIES, isStockLogoUnlocked } from '@/lib/stock-logos';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme } from '@/lib/themes';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from './KitDialog';
import PageNotice, { useNotice } from './PageNotice';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';

interface OrgSettings {
  name: string;
  slug: string;
  logoUrl: string | null;
  isPublic: boolean;
  isDiscoverable: boolean;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  heroBannerUrl: string | null;
  themeFont: string;
  themeCardStyle: string;
}

const noSubscribe = () => () => {};

export default function SettingsKit() {
  const router = useRouter();
  const { currentOrg, userRole, loading, refresh } = useOrg();
  usePageTitle('Settings');
  const { setOrgNav } = useOrgNav();
  const slug = currentOrg?.slug ?? '';
  const orgQuery = slug ? `?orgSlug=${encodeURIComponent(slug)}` : '';
  const host = useSyncExternalStore(noSubscribe, () => window.location.host, () => '');

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [urlSlug, setUrlSlug] = useState('');
  const [presetKey, setPresetKey] = useState('platform');
  const [customPrimary, setCustomPrimary] = useState('#1E3A8A'); // token-exempt: a data default, the platform preset's primary
  const [customAccent, setCustomAccent] = useState('#D9F99D'); // token-exempt: a data default, the platform preset's accent
  const [fontKey, setFontKey] = useState('system');
  const [cardStyle, setCardStyle] = useState('default');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<'site' | 'directory' | null>(null);
  const [askOffline, setAskOffline] = useState(false);
  const [notice, setNotice] = useNotice();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockSelected, setStockSelected] = useState<string | null>(null);
  const [stockLockedPlan, setStockLockedPlan] = useState<string | null>(null);
  const [stockSaving, setStockSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSending, setDeleteSending] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  function adopt(data: OrgSettings) {
    setSettings(data);
    setName(data.name);
    setUrlSlug(data.slug);
    setLogoPreview(data.logoUrl);
    setBanner(data.heroBannerUrl);
    setFontKey(data.themeFont ?? 'system');
    setCardStyle(data.themeCardStyle ?? 'default');
    if (data.themePrimary) {
      setPresetKey('custom');
      setCustomPrimary(data.themePrimary);
      setCustomAccent(data.themeAccent ?? '#D9F99D'); // token-exempt: a data default
    } else {
      setPresetKey(data.themePreset ?? 'platform');
    }
  }

  useEffect(() => {
    if (!orgQuery) return;
    let stale = false;
    fetch(`/api/admin/org-settings${orgQuery}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: OrgSettings) => { if (!stale) adopt(d); })
      .catch(() => { if (!stale) setLoadFailed(true); });
    return () => { stale = true; };
  }, [orgQuery]);

  const savedPresetKey = settings ? (settings.themePrimary ? 'custom' : (settings.themePreset ?? 'platform')) : 'platform';
  const isDirty = !!settings && (
    name !== settings.name
    || urlSlug !== settings.slug
    || presetKey !== savedPresetKey
    || (presetKey === 'custom' && (customPrimary !== (settings.themePrimary ?? '#1E3A8A') || customAccent !== (settings.themeAccent ?? '#D9F99D'))) // token-exempt: data defaults
    || fontKey !== (settings.themeFont ?? 'system')
    || cardStyle !== (settings.themeCardStyle ?? 'default')
  );

  // The unsaved-changes guard — today's, kept: a refresh or tab close asks the browser's question; a
  // link or Back inside the app asks ours.
  useEffect(() => {
    if (!isDirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setGuardOpen(true);
    };
    // ⚠ THE GUARD'S OWN ENTRY IS MARKED (slice 6). Every club window now stands one Back step above
    // the page (KitDialog → the portal's dialog floor), and a window TIDIES its step away as it closes
    // — a `history.back()` that lands on this entry exactly as a Back pressed with the window open
    // does. Unmarked, the two were one event here: cancelling any window on a page with unsaved
    // changes asked "Save your changes?". A pop that lands ON the marked entry came from a window
    // above it (answered by the window's own step); a Back on the page itself lands BELOW it.
    // ⚠ READ THE LANDING OFF THE EVENT, never `history.state` (/review, 2026-09-28). The portal's Back
    // stack answers the same popstate and, closing a window, re-pushes that window's entry at once —
    // when its listener ran first (any window opened before this listener was last added: a window
    // earlier on the page, or an edit → Save → edit), `history.state` was already the window's, the
    // mark was missed, and a stray guard entry went on top that nothing ever consumed.
    // ⚠ The mark lasts only while nothing re-stamps the entry: Next replaces it with its own state on a
    // `router.refresh()` or a navigation. Nothing here does either while the form is dirty — add one
    // and this guard belongs on the shared stack (`useBackStep`) instead.
    const GUARD_ENTRY = { settingsGuard: true };
    window.history.pushState(GUARD_ENTRY, '', window.location.href);
    const onPop = (e: PopStateEvent) => {
      if ((e.state as { settingsGuard?: boolean } | null)?.settingsGuard) return;
      window.history.pushState(GUARD_ENTRY, '', window.location.href);
      // Back while another window is open (the offline question, the stock logos, the deletion
      // request) stays put and asks nothing — never a second question stacked on the first.
      if (document.querySelector('[data-kit-dialog]')) return;
      setPendingHref(null);
      setGuardOpen(true);
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, [isDirty]);

  const preview = useMemo(
    () => (presetKey === 'custom' ? resolveTheme('platform', customPrimary || null, customAccent || null) : resolveTheme(presetKey, null, null)),
    [presetKey, customPrimary, customAccent],
  );
  // The public page's colours, for the two pictures of it (R2 — the island keeps them).
  const previewVars = {
    '--primary': preview.primary,
    '--primary-light': preview.primaryLight,
    '--primary-rgb': preview.primaryRgb,
  } as CSSProperties;

  if (loading || !currentOrg || !userRole) return <div className={ck.loading}>Loading…</div>;

  if (userRole !== 'owner') {
    return (
      <div className={ck.pageNarrow}>
        <AdminPageHeader eyebrow="Organization" title="Settings" />
        <div className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>Settings are the owner’s</h2>
          <p className={styles.lockedBody}>Only {currentOrg.name}’s owner can change the organization’s name, address and look.</p>
        </div>
      </div>
    );
  }

  const noun = isClubPlan(currentOrg.planId) ? 'club' : currentOrg.planId === 'league' ? 'league' : 'organization';
  const siteUrl = `${host}/${settings?.slug ?? slug}`;

  async function patch(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(`/api/admin/org-settings${orgQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, data };
  }

  async function setSite(on: boolean) {
    if (!settings) return;
    setSwitching('site');
    try {
      const { ok, data } = await patch({ isPublic: on });
      if (!ok) throw new Error(typeof data.error === 'string' ? data.error : 'That didn’t save.');
      setSettings(s => (s ? { ...s, isPublic: on } : s));
      setNotice({ tone: 'good', text: on ? `${currentOrg!.name}’s public site is online.` : `${currentOrg!.name}’s public site is offline.` });
      void refresh();
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'That didn’t save. Try again.' });
    } finally {
      setSwitching(null);
      setAskOffline(false);
    }
  }

  async function setDirectory(on: boolean) {
    if (!settings) return;
    setSwitching('directory');
    try {
      const { ok, data } = await patch({ isDiscoverable: on });
      if (!ok) throw new Error(typeof data.error === 'string' ? data.error : 'That didn’t save.');
      setSettings(s => (s ? { ...s, isDiscoverable: on } : s));
      setNotice({ tone: 'good', text: on ? `${currentOrg!.name} is listed in the directory.` : `${currentOrg!.name} is no longer listed in the directory.` });
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'That didn’t save. Try again.' });
    } finally {
      setSwitching(null);
    }
  }

  async function saveAll(): Promise<boolean> {
    if (!settings || saving) return false;
    setSaving(true);
    try {
      const theme = presetKey === 'custom'
        ? { themePreset: 'platform', themePrimary: customPrimary, themeAccent: customAccent }
        : { themePreset: presetKey, themePrimary: null, themeAccent: null };
      const { ok, data } = await patch({ name, slug: urlSlug, ...theme, themeFont: fontKey, themeCardStyle: cardStyle });
      if (!ok) throw new Error(typeof data.error === 'string' ? data.error : 'Save failed.');
      setSettings(s => (s ? { ...s, name, slug: urlSlug, ...theme, themeFont: fontKey, themeCardStyle: cardStyle } : s));
      setNotice({ tone: 'good', text: 'Settings saved.' });
      void refresh();
      if (typeof data.slug === 'string' && data.slug !== currentOrg!.slug) router.push(`/${data.slug}/admin/org/settings`);
      return true;
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (settings) adopt(settings);
  }

  async function upload(kind: 'logo' | 'banner', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const setBusy = kind === 'logo' ? setUploading : setBannerUploading;
    const setShown = kind === 'logo' ? setLogoPreview : setBanner;
    setShown(URL.createObjectURL(file));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/${kind === 'logo' ? 'org-logo' : 'org-hero-banner'}${orgQuery}`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string; heroBannerUrl?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed.');
      const url = (kind === 'logo' ? data.logoUrl : data.heroBannerUrl) ?? null;
      setShown(url);
      setSettings(s => (s ? { ...s, ...(kind === 'logo' ? { logoUrl: url } : { heroBannerUrl: url }) } : s));
      if (kind === 'logo') setOrgNav(url, currentOrg!.name);
      setNotice({ tone: 'good', text: kind === 'logo' ? 'Logo updated.' : 'Hero banner updated.' });
      void refresh();
    } catch (err) {
      setShown(kind === 'logo' ? settings?.logoUrl ?? null : settings?.heroBannerUrl ?? null);
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'Upload failed. Try again.' });
    } finally {
      setBusy(false);
      const input = kind === 'logo' ? logoInput.current : bannerInput.current;
      if (input) input.value = '';
    }
  }

  async function removeImage(kind: 'logo' | 'banner') {
    const setBusy = kind === 'logo' ? setUploading : setBannerUploading;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/${kind === 'logo' ? 'org-logo' : 'org-hero-banner'}${orgQuery}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed.');
      if (kind === 'logo') { setLogoPreview(null); setOrgNav(null, currentOrg!.name); } else setBanner(null);
      setSettings(s => (s ? { ...s, ...(kind === 'logo' ? { logoUrl: null } : { heroBannerUrl: null }) } : s));
      setNotice({ tone: 'good', text: kind === 'logo' ? 'Logo removed.' : 'Hero banner removed.' });
      void refresh();
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'Remove failed. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function applyStockLogo() {
    if (!stockSelected) return;
    setStockSaving(true);
    try {
      const res = await fetch(`/api/admin/org-logo-stock${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockPath: stockSelected }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string };
      if (!res.ok) throw new Error(data.error ?? 'The logo didn’t save.');
      setLogoPreview(data.logoUrl ?? null);
      setSettings(s => (s ? { ...s, logoUrl: data.logoUrl ?? null } : s));
      setOrgNav(data.logoUrl ?? null, currentOrg!.name);
      setStockOpen(false);
      setStockSelected(null);
      setNotice({ tone: 'good', text: 'Logo updated.' });
      void refresh();
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'The logo didn’t save. Try again.' });
    } finally {
      setStockSaving(false);
    }
  }

  async function requestDeletion() {
    setDeleteSending(true);
    try {
      const res = await fetch(`/api/admin/org/request-deletion${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'The request didn’t send.');
      }
      setDeleteSent(true);
      setDeleteOpen(false);
      setDeleteReason('');
    } catch (err) {
      setDeleteOpen(false);
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'The request didn’t send. Try again.' });
    } finally {
      setDeleteSending(false);
    }
  }

  const siteOn = settings?.isPublic ?? currentOrg.isPublic;
  const listed = siteOn && (settings?.isDiscoverable ?? currentOrg.isDiscoverable);

  return (
    <div className={ck.pageNarrow}>
      <AdminPageHeader eyebrow="Organization" title="Settings" />

      {notice && <PageNotice notice={notice} />}
      {loadFailed && (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>The settings didn’t load. Refresh the page to try again.</div>
        </div>
      )}
      {!settings && !loadFailed && <div className={ck.loading}>Loading…</div>}

      {settings && (
        <>
          {/* ── Your public site (A09/F04) — the two real switches ────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-public-site">
            <h2 id="settings-public-site" className={styles.cardTitle}>Your public site</h2>
            <div className={ck.switchRow}>
              <div className={ck.switchText}>
                <span className={ck.switchName} id="settings-site-label">Public site</span>
                <p className={ck.hint}>
                  {siteOn
                    ? <>{settings.name}’s home page at <span className={styles.url}>{siteUrl}</span> is online. Turning it off takes the home page and league pages offline.</>
                    : <>{settings.name}’s home page at <span className={styles.url}>{siteUrl}</span> is offline. Families who open it see that the page isn’t available.</>}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={siteOn}
                aria-labelledby="settings-site-label"
                className={ck.switch}
                disabled={switching !== null}
                onClick={() => (siteOn ? setAskOffline(true) : void setSite(true))}
                id="settings-public"
              />
            </div>
            <div className={`${ck.switchRow}${siteOn ? '' : ` ${ck.switchRowOff}`}`}>
              <div className={ck.switchText}>
                <span className={ck.switchName} id="settings-directory-label">Listed in the {noun} directory</span>
                <p className={ck.hint}>
                  {siteOn
                    ? `Families searching FieldLogicHQ’s directory can find ${settings.name}. Your site stays online either way.`
                    : 'When the public site is off, the directory switch is off too.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={listed}
                aria-labelledby="settings-directory-label"
                className={ck.switch}
                disabled={!siteOn || switching !== null}
                onClick={() => void setDirectory(!settings.isDiscoverable)}
                id="settings-discoverable"
              />
            </div>
          </section>

          {/* ── Organization logo ─────────────────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-logo">
            <h2 id="settings-logo" className={styles.cardTitle}>Organization logo</h2>
            <div className={styles.logoRow}>
              <div className={styles.logoPreview}>
                {logoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoPreview} alt="Logo" className={styles.logoImg} />
                  : <span className={styles.logoEmpty}>No logo</span>}
              </div>
              <div className={styles.imageActions}>
                <button type="button" className="btn btn-outline" onClick={() => logoInput.current?.click()} disabled={uploading} id="settings-logo-upload-btn">
                  <Upload size={15} aria-hidden /> {uploading ? 'Uploading…' : logoPreview ? 'Replace logo' : 'Upload logo'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setStockOpen(true)} disabled={uploading} id="settings-logo-stock-btn">
                  <Library size={15} aria-hidden /> Browse stock logos
                </button>
                {logoPreview && (
                  <button type="button" className="btn btn-ghost" onClick={() => void removeImage('logo')} disabled={uploading} id="settings-logo-remove-btn">Remove</button>
                )}
                <p className={ck.hint}>JPG, PNG, or WebP — max 2 MB</p>
              </div>
            </div>
            <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload('logo', e)} className={styles.hiddenInput} id="settings-logo-input" />
          </section>

          {/* ── Organization details ──────────────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-details">
            <h2 id="settings-details" className={styles.cardTitle}>Organization details</h2>
            <div className={ck.field}>
              <label className={ck.label} htmlFor="settings-name">Organization name<span className={ck.required} aria-hidden>*</span></label>
              <input id="settings-name" className={ck.input} value={name} onChange={e => setName(e.target.value)} required maxLength={40} />
              <p className={ck.hint}>Shown in the navigation bar and on public pages. {name.length} / 40</p>
            </div>
            <div className={ck.field}>
              <label className={ck.label} htmlFor="settings-slug">URL slug<span className={ck.required} aria-hidden>*</span></label>
              <input
                id="settings-slug"
                className={ck.input}
                value={urlSlug}
                onChange={e => setUrlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                maxLength={60}
                pattern="[a-z0-9-]+"
              />
              {urlSlug !== settings.slug ? (
                <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
                  <AlertTriangle size={15} aria-hidden />
                  <div className={ck.noticeBody}>
                    Changing your slug immediately breaks every existing link to your organization — your schedule,
                    standings, registration form, team pages, and any links sent to coaches in past emails or posted publicly.
                  </div>
                </div>
              ) : (
                <p className={ck.hint}>Only lowercase letters, numbers, and hyphens. Changing it breaks existing links.</p>
              )}
            </div>
          </section>

          {/* ── Colour theme — the public page's colours ─────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-theme">
            <h2 id="settings-theme" className={styles.cardTitle}>Colour theme</h2>
            <div className={styles.swatches}>
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  title={p.name}
                  aria-label={p.name}
                  aria-pressed={presetKey === key}
                  className={`${styles.swatch}${presetKey === key ? ` ${styles.swatchOn}` : ''}`}
                  style={{ background: p.primary }}
                  onClick={() => setPresetKey(key)}
                >
                  {presetKey === key && <Check size={16} strokeWidth={3} aria-hidden />}
                </button>
              ))}
              <button
                type="button"
                title="Custom colours"
                aria-label="Custom colours"
                aria-pressed={presetKey === 'custom'}
                className={`${styles.swatch}${presetKey === 'custom' ? ` ${styles.swatchOn}` : ''}`}
                style={{ background: `linear-gradient(135deg, ${customPrimary} 0 50%, ${customAccent} 50% 100%)` }}
                onClick={() => setPresetKey('custom')}
              >
                {presetKey === 'custom' && <Check size={16} strokeWidth={3} aria-hidden />}
              </button>
            </div>
            {presetKey === 'custom' && (
              <div className={styles.pickers}>
                <label className={styles.picker}>
                  <span className={ck.label}>Primary</span>
                  <input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} id="theme-primary" />
                </label>
                <label className={styles.picker}>
                  <span className={ck.label}>Accent</span>
                  <input type="color" value={customAccent} onChange={e => setCustomAccent(e.target.value)} id="theme-accent" />
                </label>
              </div>
            )}
            {preview.isLowContrast && (
              <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
                <AlertTriangle size={15} aria-hidden />
                <div className={ck.noticeBody}>Low contrast — text may be hard to read on white backgrounds.</div>
              </div>
            )}
            {/* R2 — a picture of the public page keeps the organization's own colours. */}
            <div className={styles.publicPreview} data-public-preview="" style={previewVars}>
              <span className={styles.previewLabel}>Preview</span>
              <div className={styles.previewRow}>
                <span className={styles.previewBorder}>Card border</span>
                <span className={styles.previewBtn}>Button</span>
                <span className={styles.previewBadge}>Badge</span>
              </div>
            </div>
          </section>

          {/* ── Hero banner (A14: the club's home page, not "your tournament home page") ──── */}
          <section className={styles.card} aria-labelledby="settings-banner">
            <h2 id="settings-banner" className={styles.cardTitle}>Hero banner</h2>
            <p className={ck.hint}>Shown across the top of your {noun}’s home page.</p>
            {banner && (
              <div className={styles.bannerPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="Hero banner preview" className={styles.bannerImg} />
              </div>
            )}
            <div className={styles.imageActions}>
              <button type="button" className="btn btn-outline" onClick={() => bannerInput.current?.click()} disabled={bannerUploading}>
                <ImageIcon size={15} aria-hidden /> {bannerUploading ? 'Uploading…' : banner ? 'Replace banner' : 'Upload banner'}
              </button>
              {banner && (
                <button type="button" className="btn btn-ghost" onClick={() => void removeImage('banner')} disabled={bannerUploading}>Remove</button>
              )}
            </div>
            <p className={ck.hint}>JPG, PNG, or WebP — max 4 MB. Recommended 16:5 ratio.</p>
            <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload('banner', e)} className={styles.hiddenInput} />
          </section>

          {/* ── Font ──────────────────────────────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-font">
            <h2 id="settings-font" className={styles.cardTitle}>Font family</h2>
            <div className={styles.choiceGrid}>
              {Object.entries(FONT_OPTIONS).map(([key, opt]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={fontKey === key}
                  className={`${styles.choice}${fontKey === key ? ` ${styles.choiceOn}` : ''}`}
                  style={{ fontFamily: opt.sampleStyle }}
                  onClick={() => setFontKey(key)}
                >
                  <span className={styles.choiceLabel}>{opt.label}</span>
                  <span className={styles.choiceSample}>Aa 123</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Card style — the public page's cards ─────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-cards">
            <h2 id="settings-cards" className={styles.cardTitle}>Card style</h2>
            <div className={styles.choiceGrid}>
              {Object.entries(CARD_STYLE_OPTIONS).map(([key, opt]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={cardStyle === key}
                  className={`${styles.choice}${cardStyle === key ? ` ${styles.choiceOn}` : ''}`}
                  onClick={() => setCardStyle(key)}
                >
                  <span className={`${styles.thumb} ${styles[`thumb_${key}`] ?? ''}`} aria-hidden>
                    <span className={styles.thumbLine} />
                    <span className={`${styles.thumbLine} ${styles.thumbLineShort}`} />
                  </span>
                  <span className={styles.choiceLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className={`${styles.publicPreview} ${styles[`card_${cardStyle}`] ?? ''}`} data-public-preview="" style={previewVars}>
              <span className={styles.previewLabel}>Preview</span>
              <div className={styles.previewCardHead}>
                <span className={styles.previewCardTitle}>Field 1 · U12 Division</span>
                <span className={styles.previewBadge}>Active</span>
              </div>
              <span className={styles.previewMeta}>Sat Jun 14 · 9:00 a.m. · Lions Park</span>
            </div>
          </section>

          {/* ── The one Save (the switches above save themselves) ──────────────────────────── */}
          <div className={styles.saveBar}>
            {isDirty && <span className={styles.unsaved}>Unsaved changes</span>}
            {isDirty && <button type="button" className="btn btn-ghost" onClick={discard} disabled={saving}>Discard</button>}
            <button type="button" className="btn btn-lime" onClick={() => void saveAll()} disabled={saving || !isDirty} id="settings-save-btn">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {/* ── Delete the organization ────────────────────────────────────────────────────── */}
          <section className={`${styles.card} ${styles.danger}`} aria-labelledby="settings-delete">
            <h2 id="settings-delete" className={styles.cardTitle}>Delete organization</h2>
            <p className={ck.hint}>Permanently remove your organization and all its data. This can’t be undone.</p>
            {deleteSent ? (
              <p className={styles.sent}><CheckCircle2 size={14} aria-hidden /> Request sent — we’ll be in touch.</p>
            ) : (
              <div className={styles.imageActions}>
                <button type="button" className={`btn btn-outline ${styles.dangerText}`} onClick={() => setDeleteOpen(true)}>Request account deletion…</button>
              </div>
            )}
          </section>
        </>
      )}

      {askOffline && settings && (
        <KitDialog
          kind="question"
          title={`Take ${settings.name}’s public site offline?`}
          onClose={() => setAskOffline(false)}
          busy={switching === 'site'}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAskOffline(false)} disabled={switching === 'site'} data-autofocus="">Keep it online</button>
              <button type="button" className="btn btn-danger" onClick={() => void setSite(false)} disabled={switching === 'site'}>
                {switching === 'site' ? 'Taking it offline…' : 'Take it offline'}
              </button>
            </>
          }
        >
          {/* ⚠ ONLY what goes offline today: the home page and the league pages. Team pages and tryout
              forms do not check this switch yet (F06); they learn to in Stage 4, and this grows then. */}
          <p>Families who open your home page or league pages will see that the page isn’t available. You can turn it back on at any time.</p>
        </KitDialog>
      )}

      {stockOpen && (
        <KitDialog
          kind="form"
          title="Choose a stock logo"
          onClose={() => { setStockOpen(false); setStockSelected(null); setStockLockedPlan(null); }}
          busy={stockSaving}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => { setStockOpen(false); setStockSelected(null); setStockLockedPlan(null); }} disabled={stockSaving}>Cancel</button>
              <button type="button" className="btn btn-lime" onClick={() => void applyStockLogo()} disabled={!stockSelected || stockSaving}>
                {stockSaving ? 'Saving…' : 'Use this logo'}
              </button>
            </>
          }
        >
          {STOCK_LOGO_CATEGORIES.map(category => {
            const icons = STOCK_LOGOS.filter(l => l.category === category);
            if (!icons.length) return null;
            return (
              <div key={category} className={styles.stockGroup}>
                <p className={styles.stockCategory}>{category}</p>
                <div className={styles.stockGrid}>
                  {icons.map(logo => {
                    const unlocked = isStockLogoUnlocked(logo, currentOrg.planId);
                    const selected = stockSelected === logo.file;
                    return (
                      <button
                        key={logo.id}
                        type="button"
                        aria-label={logo.label}
                        aria-pressed={selected}
                        className={`${styles.stockTile}${selected ? ` ${styles.stockTileOn}` : ''}${unlocked ? '' : ` ${styles.stockTileLocked}`}`}
                        onClick={() => {
                          if (!unlocked) { setStockLockedPlan(logo.minPlan); return; }
                          setStockLockedPlan(null);
                          setStockSelected(logo.file);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo.file} alt="" className={styles.stockImg} />
                        <span className={styles.stockLabel}>{logo.label}</span>
                        {!unlocked && <Lock size={10} className={styles.stockLock} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {stockLockedPlan && (
            <p className={ck.hint}><Lock size={12} aria-hidden /> Upgrade to {stockLockedPlan.charAt(0).toUpperCase() + stockLockedPlan.slice(1)} to unlock this icon.</p>
          )}
        </KitDialog>
      )}

      {deleteOpen && (
        <KitDialog
          kind="question"
          title={`Ask us to delete ${currentOrg.name}?`}
          onClose={() => setDeleteOpen(false)}
          busy={deleteSending}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setDeleteOpen(false)} disabled={deleteSending}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void requestDeletion()} disabled={deleteSending}>
                {deleteSending ? 'Sending…' : 'Send deletion request'}
              </button>
            </>
          }
        >
          <p>We’ll contact you to confirm before anything is deleted. Deleting removes your organization and all its data for good.</p>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="settings-delete-reason">Why are you leaving?</label>
            <textarea id="settings-delete-reason" className={ck.textarea} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} maxLength={1000} />
          </div>
        </KitDialog>
      )}

      {guardOpen && (
        <KitDialog
          kind="question"
          title="Save your changes?"
          onClose={() => { setGuardOpen(false); setPendingHref(null); }}
          busy={saving}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => { setGuardOpen(false); setPendingHref(null); }}>Stay on page</button>
              {/* ⚠ LEAVING NAVIGATES WITH THIS QUESTION STILL OPEN (slice 6). Closing it first let its
                  Back step tidy its history entry before the router had pushed the new address, and
                  that Back cancels the navigation (KitDialog's header). The page unmounts as it
                  leaves, so the question goes with it; discarding a page being left is moot. Back
                  (no link waiting) keeps today's behaviour: discard, close, stay. */}
              <button type="button" className="btn btn-ghost" onClick={() => { if (pendingHref) { router.push(pendingHref); return; } discard(); setGuardOpen(false); }}>
                Discard and leave
              </button>
              <button
                type="button"
                className="btn btn-lime"
                onClick={async () => { if (!(await saveAll())) return; if (pendingHref) { router.push(pendingHref); return; } setGuardOpen(false); }}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save and continue'}
              </button>
            </>
          }
        >
          <p>You have changes that haven’t been saved. They’re lost if you leave now.</p>
        </KitDialog>
      )}
    </div>
  );
}
