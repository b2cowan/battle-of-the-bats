'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * PUBLIC SITE — Tournament admin redesign Stage 5 (E7, A53; F29, F90's page half, J1-064), built to hub v45, ruled
 * as drawn 2026-10-10.
 *
 *   the door      "See your public site" — a door card at the top at every width: the organizer's preview while the
 *                 event is a draft ("Preview"), the public page in a new tab after ("Online"; never "Live", which is
 *                 one game). On a phone and a tablet there was no door to the site from any setup screen.
 *   Pages         first (the part every plan uses): 52px switch rows, two columns at a desk; Show coaches' names
 *   six parts     Logo, App icon, Theme, Hero banner, Font, Card style — closed cards that say what each holds
 *                 (Event settings' model). The theme's drawn mock went (the door shows the real page); a colour can
 *                 be typed as a hex code beside its picker.
 *   saving        every change saves itself with the floating pill: a choice at once, typing after a pause, and
 *                 anything still waiting is sent as you leave — the bottom Save Changes, its "Unsaved changes" and
 *                 the success pop-ups after an upload went; nothing is lost by leaving (a theme change was, silently).
 *   free plan     the door and Pages as every plan; the advanced part locked as today (the free tier review decides).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubSection, LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { SwitchRow, SwitchRows } from '@/components/admin/tournament/SwitchRows';
import { BoardDoor } from '../dashboard/GameDayBoard';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme } from '@/lib/themes';
import { PUBLIC_PAGE_OPTIONS, normalizeHiddenPublicPages, type PublicPageKey } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { LOCK_WORDS } from '@/lib/invite-only-words';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { hasCapability } from '@/lib/roles';
import { publicHref, useClubPublicOrigin } from '@/lib/use-club-public-origin';
import { PUBLIC_SITE_WORDS as W, appIconSummary, parseHex, themeSummary } from '@/lib/tournament-settings-words';
import styles from './branding.module.css';
import pageCss from './site.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** Public site's "?" (A56): its own help sub-topic. */
const SITE_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['public-site-preview'], subtopicId: 'public-site-cards' };

// Mirror of lib/pwa-icon ICON_DARK (that module is server-only — it can't be imported into this client component).
// The shared truth lives there; this is the UI default shown when no logo colour has been sampled yet.
const ICON_DARK_FALLBACK = '#0a0a12';

interface BrandingSettings {
  logoUrl: string | null;
  heroBannerUrl: string | null;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  themeFont: string | null;
  themeCardStyle: string | null;
  colorMode: 'dark' | 'light';
  iconBgColor: string | null;
  iconBgSuggested: string | null;
  appName: string | null;
  iconScale: number | null;
  publicHiddenPages: PublicPageKey[];
  coachNamesShowOnPublic: boolean;
}

/** What the page edits — sent whole on every save (the route takes the same body the old Save sent). */
type Draft = {
  presetKey: string;
  customPrimary: string;
  customAccent: string;
  fontKey: string;
  cardStyle: string;
  colorMode: 'dark' | 'light';
  iconBg: string | null;
  appName: string;
  iconScale: number;
  publicHiddenPages: PublicPageKey[];
  coachNamesShowOnPublic: boolean;
};

// App-icon "Logo size" slider: relative to the tuned default (100). Stored null = 100.
const ICON_SCALE_MIN = 70;
const ICON_SCALE_MAX = 125;
const ICON_SCALE_DEFAULT = 100;

const sameHex = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

function draftOf(data: BrandingSettings, advanced: boolean): Draft {
  const custom = Boolean(data.themePrimary && advanced);
  return {
    presetKey: custom ? 'custom' : data.themePreset ?? 'platform',
    customPrimary: custom ? data.themePrimary! : '#1E3A8A',
    customAccent: custom ? data.themeAccent ?? '#D9F99D' : '#D9F99D',
    fontKey: advanced ? data.themeFont ?? 'system' : 'system',
    cardStyle: advanced ? data.themeCardStyle ?? 'default' : 'default',
    colorMode: data.colorMode ?? 'dark',
    iconBg: advanced ? data.iconBgColor ?? null : null,
    appName: advanced ? data.appName ?? '' : '',
    iconScale: advanced ? data.iconScale ?? ICON_SCALE_DEFAULT : ICON_SCALE_DEFAULT,
    publicHiddenPages: normalizeHiddenPublicPages(data.publicHiddenPages),
    coachNamesShowOnPublic: data.coachNamesShowOnPublic === true,
  };
}

function bodyOf(d: Draft, advanced: boolean) {
  const pages = { publicHiddenPages: normalizeHiddenPublicPages(d.publicHiddenPages), coachNamesShowOnPublic: d.coachNamesShowOnPublic };
  if (!advanced) return pages;
  const theme = d.presetKey === 'custom'
    ? { themePreset: 'platform', themePrimary: d.customPrimary, themeAccent: d.customAccent }
    : { themePreset: d.presetKey, themePrimary: null, themeAccent: null };
  return {
    ...theme,
    themeFont: d.fontKey,
    themeCardStyle: d.cardStyle,
    colorMode: d.colorMode,
    iconBgColor: d.iconBg,
    appName: d.appName.trim() || null,
    iconScale: d.iconScale === ICON_SCALE_DEFAULT ? null : d.iconScale,
    ...pages,
  };
}

/** The draft with the address it was read from (and the plan's body): a save always goes to ITS tournament. */
type Held = { url: string; advanced: boolean; draft: Draft };
const send = (held: Held, keepalive = false) => fetch(held.url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bodyOf(held.draft, held.advanced)),
  keepalive,
});

/** A file's own name from its stored address ("uat-plus-logo.png"), or "Uploaded" when it carries none worth showing. */
function fileName(url: string | null): string {
  if (!url) return W.none;
  const last = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
  return /^[\w.-]{1,60}\.(png|jpe?g|webp|gif|svg)$/i.test(last) && !/^\d{10,}/.test(last) ? last : W.uploaded;
}

/** A colour's hex code, typed beside its picker: kept as typed until it is one, then it is the colour. */
function HexField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (hex: string) => void }) {
  const [typed, setTyped] = useState(value.toUpperCase());
  const [seen, setSeen] = useState(value);
  if (!sameHex(seen, value)) { setSeen(value); setTyped(value.toUpperCase()); }
  const bad = typed.trim() !== '' && parseHex(typed) === null;
  return (
    <>
      <input id={id} className={pageCss.hexInput} aria-label={`${label} · ${W.hexCode}`} value={typed} maxLength={7} spellCheck={false}
        onChange={e => {
          setTyped(e.target.value);
          const hex = parseHex(e.target.value);
          if (hex) { setSeen(hex); onChange(hex); }
        }}
        onBlur={() => { if (parseHex(typed) === null) setTyped(value.toUpperCase()); }} />
      {bad && <p className={pageCss.mistake} role="alert">{W.hexHeld}</p>}
    </>
  );
}

export default function TournamentBrandingPage() {
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Public site');
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const publicOrigin = useClubPublicOrigin(currentOrg?.slug);

  const tournamentId = currentTournament?.id;
  const advanced = currentOrg?.planId ? hasPlanFeature(currentOrg.planId, 'advanced_tournament_branding') : false;
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  // An invite-only event (the free tournament tier, screen 6): no Registration page to switch (R6).
  const inviteOnly = runsInviteOnlyEvents(currentOrg?.planId);
  const pageOptions = inviteOnly ? PUBLIC_PAGE_OPTIONS.filter(p => p.key !== 'register') : PUBLIC_PAGE_OPTIONS;
  const brandingUrl = tournamentId ? `/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}` : '';

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [iconBgSuggested, setIconBgSuggested] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ── Saving: a choice at once, typing after a pause, one save at a time, anything waiting sent on leaving ──
  // The draft carries the address it was read from: a save always goes to ITS tournament, so switching events mid-edit
  // can never write one event's site over another's (/review).
  const latest = useRef<Held | null>(null);
  const edits = useRef(0);
  const currentUrl = useRef(brandingUrl);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** A change still waiting (typed, not yet sent): send it now, to its own tournament, even as the page goes. */
  const flushWaiting = useCallback(() => {
    if (!timer.current || !latest.current) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    void send(latest.current, true);
  }, []);

  // A tournament switch (or leaving the page): the waiting change goes to ITS tournament now, and the page forgets that
  // draft until the new event's own read arrives.
  useEffect(() => {
    currentUrl.current = brandingUrl;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event shows Loading until its own read lands
    setDraft(null);
    return () => { flushWaiting(); latest.current = null; };
  }, [brandingUrl, flushWaiting]);

  const load = useCallback(async () => {
    if (!brandingUrl) return;
    setLoadError(false);
    const editsAtStart = edits.current;
    try {
      const res = await fetch(brandingUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = await res.json() as BrandingSettings;
      if (currentUrl.current !== brandingUrl) return; // another event's read owns the page now
      setLogoUrl(data.logoUrl);
      setBannerUrl(data.heroBannerUrl);
      setIconBgSuggested(data.iconBgSuggested ?? null);
      // An edit made while this read was out stays: a late read never overwrites it.
      if (edits.current !== editsAtStart && latest.current?.url === brandingUrl) return;
      const d = draftOf(data, advanced);
      latest.current = { url: brandingUrl, advanced, draft: d };
      setDraft(d);
    } catch {
      if (currentUrl.current === brandingUrl) setLoadError(true);
    }
  }, [brandingUrl, advanced]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own public site
  useEffect(() => { void load(); }, [load]);

  const saveNow = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setWaiting(false);
    const held = latest.current;
    if (!held) return;
    setSaving(true);
    setSaveError(null);
    const run = chain.current.catch(() => {}).then(async () => {
      // When its turn comes: the newest draft of the SAME tournament (a later change rides along), never another's.
      const now = latest.current && latest.current.url === held.url ? latest.current : held;
      try {
        const res = await send(now);
        if (!res.ok) throw new Error('save');
        setSaveError(null);
      } catch {
        setSaveError(W.saveFailed);
      }
    });
    chain.current = run;
    void run.finally(() => { if (chain.current === run) setSaving(false); });
  }, []);

  /** A change: kept at once; saved at once, or after a pause while it is still being typed or dragged. */
  const change = useCallback((patch: Partial<Draft>, later = false) => {
    const held = latest.current;
    if (!held) return;
    edits.current += 1;
    latest.current = { ...held, draft: { ...held.draft, ...patch } };
    setDraft(latest.current.draft);
    if (!later) { saveNow(); return; }
    setWaiting(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(saveNow, 900);
  }, [saveNow]);

  // Closing the tab with a change still waiting: send it, so nothing typed is lost.
  useEffect(() => {
    window.addEventListener('pagehide', flushWaiting);
    return () => window.removeEventListener('pagehide', flushWaiting);
  }, [flushWaiting]);

  const previewTheme = useMemo(() => {
    if (!draft) return resolveTheme('platform', null, null);
    return draft.presetKey === 'custom' && advanced
      ? resolveTheme('platform', draft.customPrimary || null, draft.customAccent || null)
      : resolveTheme(draft.presetKey, null, null);
  }, [draft, advanced]);

  // ── Uploads save on their own, as today; the pill says so (no pop-up), a failure says so in its card ──
  async function upload(kind: 'logo' | 'banner', file: File) {
    if (!tournamentId || !advanced) return;
    const setBusy = kind === 'logo' ? setLogoUploading : setBannerUploading;
    const setError = kind === 'logo' ? setLogoError : setBannerError;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const route = kind === 'logo' ? 'tournament-logo' : 'tournament-hero-banner';
      const res = await fetch(`/api/admin/${route}?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => null) as { logoUrl?: string; heroBannerUrl?: string; iconBgSuggested?: string | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error && res.status < 500 ? data.error : W.uploadFailed);
      if (kind === 'logo') { setLogoUrl(data?.logoUrl ?? null); setIconBgSuggested(data?.iconBgSuggested ?? null); }
      else setBannerUrl(data?.heroBannerUrl ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : W.uploadFailed);
    } finally {
      setBusy(false);
      const input = kind === 'logo' ? fileInputRef.current : bannerInputRef.current;
      if (input) input.value = '';
    }
  }
  async function removeUpload(kind: 'logo' | 'banner') {
    if (!tournamentId || !advanced) return;
    const setBusy = kind === 'logo' ? setLogoUploading : setBannerUploading;
    const setError = kind === 'logo' ? setLogoError : setBannerError;
    setBusy(true);
    setError('');
    try {
      const route = kind === 'logo' ? 'tournament-logo' : 'tournament-hero-banner';
      const res = await fetch(`/api/admin/${route}?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('remove');
      if (kind === 'logo') { setLogoUrl(null); setIconBgSuggested(null); }
      else setBannerUrl(null);
    } catch {
      setError(W.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <AdminPageHeader title={W.title} inlineActions actions={<HelpButton help={SITE_HELP} label={W.title} iconOnly />} />
  );
  // One sentence through both waits — the tournament, then its settings.
  const loadingLine = <div className={repKit.page}>{header}<LoadingState label="Loading the public site’s settings…" /></div>;

  if (!hasCapability(userRole ?? 'official', userCapabilities, 'manage_branding')) {
    return <div className={repKit.page}><p className={pageCss.quiet}>{W.noAccess}</p></div>;
  }
  if (!tournamentId) {
    if (tournamentLoading) return loadingLine;
    return <div className={repKit.page}><p className={pageCss.quiet}>{W.noTournament}</p></div>;
  }

  const status = currentTournament?.status;
  const slug = currentTournament?.slug;
  const livePath = `/${currentOrg?.slug ?? ''}/${slug ?? ''}`;
  // The site's address as the public reads it: the club's own web address when one is handed out (Club Tier 4e), else this host.
  const liveUrl = publicOrigin && currentOrg?.slug && slug ? publicHref(publicOrigin, currentOrg.slug, `/${slug}`) : livePath;
  const liveAddress = liveUrl.replace(/^https?:\/\//, '');
  const door = !slug || !currentOrg?.slug ? null : (
    <div className={pageCss.door}>
      {status === 'draft' || status === 'archived' ? (
        <BoardDoor href={`${base}/preview/${slug}`} newTab
          eyebrow={status === 'draft' ? W.previewEyebrow : W.offlineEyebrow} title={W.door}
          line={status === 'draft' ? W.previewLine : W.offlineLine} />
      ) : (
        <BoardDoor href={liveUrl} newTab eyebrow={W.onlineEyebrow} title={W.door}
          line={<>{W.onlineLine}<span className={pageCss.address}> · {liveAddress}</span></>} />
      )}
    </div>
  );

  if (loadError && !draft) {
    return <div className={repKit.page}>{header}<LoadFailed title={W.loadFailed} onRetry={() => void load()} /></div>;
  }
  if (!draft) return loadingLine;

  const d = draft;
  const effectiveIconBg = (d.iconBg ?? iconBgSuggested ?? ICON_DARK_FALLBACK).toLowerCase();
  // The preview tile tracks the iOS framing: the 156/180 base box scaled by the slider, clamped to the apple-touch
  // icon route's 110–172 safe range, as a % of the tile.
  const iconPreviewPct = `${(Math.max(110, Math.min(172, Math.round(156 * d.iconScale / 100))) / 180 * 100).toFixed(1)}%`;
  const iconBgWord = d.iconBg === null ? 'auto'
    : sameHex(d.iconBg, '#ffffff') ? 'white'
      : sameHex(d.iconBg, ICON_DARK_FALLBACK) ? 'dark'
        : sameHex(d.iconBg, previewTheme.primary) ? 'brand' : 'custom';
  const presetName = d.presetKey === 'custom' ? null : PRESETS[d.presetKey]?.name ?? null;
  const togglePage = (key: PublicPageKey) => change({
    publicHiddenPages: d.publicHiddenPages.includes(key) ? d.publicHiddenPages.filter(k => k !== key) : [...d.publicHiddenPages, key],
  });
  const iconBgButton = (label: string, value: string | null, chip: string, pressed: boolean) => (
    <button type="button" aria-pressed={pressed} className={`${styles.iconBgOption} ${pressed ? styles.iconBgOptionActive : ''}`}
      onClick={() => change({ iconBg: value })}>
      <span className={styles.iconBgChip} style={{ background: chip }} aria-hidden />{' '}{label}
    </button>
  );

  return (
    <div className={repKit.page}>
      {header}
      {door}

      {/* ── Pages: every plan ── */}
      <ClubSection id="pages" title={W.pages} list>
        <p className={pageCss.pagesLine}>{W.pagesLine}</p>
        <SwitchRows label={W.pages} columns={2}>
          {pageOptions.map(page => (
            <SwitchRow key={page.key} on={!d.publicHiddenPages.includes(page.key)} name={page.label} onToggle={() => togglePage(page.key)} />
          ))}
        </SwitchRows>
        <div className={pageCss.coachRow}>
          <SwitchRows>
            {/* A public PII control, on every plan (mig 150): off by default, coach names stay in the admin and the portal. */}
            <SwitchRow on={d.coachNamesShowOnPublic} name={W.coachNames} caption={W.coachNamesLine}
              onToggle={() => change({ coachNamesShowOnPublic: !d.coachNamesShowOnPublic })} />
          </SwitchRows>
        </div>
      </ClubSection>

      {!advanced ? (
        // A plan without advanced branding: ONE lock line under Pages (screen 6, "one line instead of six cards") — it
        // replaces the Unlock box and six Locked cards, the boxed-lock shape the 2026-09-30 ruling retired (F09, F18).
        <PlanLockLine href={tournamentPlusPanelHref(currentOrg?.slug ?? 'admin')}>{LOCK_WORDS.branding}</PlanLockLine>
      ) : (
        <>
          {/* ── Logo ── */}
          <CollapsibleCard title={W.logo} sectionId="logo" defaultOpen={false} meta={fileName(logoUrl)}>
            <FormError>{logoError}</FormError>
            <div className={styles.logoRow}>
              <div className={styles.logoPreview}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className={styles.logoImg} />
                  : <span className={styles.logoPlaceholder} aria-hidden="true"><ImageIcon size={30} /></span>}
              </div>
              <div className={styles.logoActions}>
                <button type="button" className="btn btn-outline btn-data" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
                  <Upload size={13} aria-hidden /> {logoUploading ? W.uploading : logoUrl ? W.replaceLogo : W.uploadLogo}
                </button>
                {logoUrl && (
                  <button type="button" className="btn btn-ghost btn-data" onClick={() => void removeUpload('logo')} disabled={logoUploading}>{W.remove}</button>
                )}
                <p className={styles.logoHint}>{W.logoHint}</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) void upload('logo', f); }} />
          </CollapsibleCard>

          {/* ── App icon ── */}
          <CollapsibleCard title={W.appIcon} sectionId="app-icon" defaultOpen={false} meta={appIconSummary(Boolean(logoUrl), iconBgWord)}>
            <p className={styles.compactNote}>
              Your event&apos;s branded icon and short name: its identity inside the one FieldLogicHQ app fans use. The
              background matches your logo automatically; choose another below for a different colour or a border, and
              use the slider to size your logo.
            </p>
            <div className={styles.iconLayout}>
              <div className={styles.iconPreview}>
                <div className={styles.iconTile} style={{ background: effectiveIconBg }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="" className={styles.iconTileImg} style={{ width: iconPreviewPct, height: iconPreviewPct }} />
                    : <span className={styles.iconTilePlaceholder} aria-hidden="true"><ImageIcon size={26} /></span>}
                </div>
                <span className={styles.iconAppName}>{d.appName.trim() || currentTournament?.name || 'Your event'}</span>
              </div>
              <div className={styles.iconControls}>
                <div className={styles.iconNameField}>
                  <label className={styles.label} htmlFor="app-name">App name</label>
                  <input id="app-name" type="text" className={ck.input} maxLength={30} value={d.appName}
                    placeholder={currentTournament?.name ?? 'Your event'} onChange={e => change({ appName: e.target.value }, true)} />
                  <p className={styles.inheritNote}>Shown under the icon. About 12 characters fit: try initials if your name is long. Leave blank to use the event name.</p>
                </div>
                <span className={styles.label}>{W.background}</span>
                <div className={styles.iconBgOptions}>
                  {iconBgButton('Auto', null, iconBgSuggested ?? ICON_DARK_FALLBACK, d.iconBg === null)}
                  {iconBgButton('White', '#ffffff', '#ffffff', sameHex(d.iconBg, '#ffffff'))}
                  {iconBgButton('Dark', ICON_DARK_FALLBACK, ICON_DARK_FALLBACK, sameHex(d.iconBg, ICON_DARK_FALLBACK))}
                  {iconBgButton('Brand', previewTheme.primary.toLowerCase(), previewTheme.primary, sameHex(d.iconBg, previewTheme.primary))}
                </div>
                <div className={styles.iconCustomRow}>
                  <label className={styles.label} htmlFor="icon-bg-custom">Custom colour</label>
                  <div className={pageCss.hexRow}>
                    <input id="icon-bg-custom" type="color" className={styles.colorInput} value={effectiveIconBg}
                      onChange={e => change({ iconBg: e.target.value }, true)} />
                    <HexField id="icon-bg-hex" label="Custom colour" value={effectiveIconBg} onChange={hex => change({ iconBg: hex }, true)} />
                    {d.iconBg !== null && (
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => change({ iconBg: null })}>Back to auto</button>
                    )}
                  </div>
                </div>
                <p className={styles.inheritNote}>A colour that contrasts with your logo shows as a border. Leave on Auto to match seamlessly.</p>
                <div className={styles.iconSizeField}>
                  <div className={styles.iconSizeHeader}>
                    <label className={styles.label} htmlFor="icon-scale">Logo size</label>
                    {d.iconScale !== ICON_SCALE_DEFAULT && (
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => change({ iconScale: ICON_SCALE_DEFAULT })}>Reset</button>
                    )}
                  </div>
                  <input id="icon-scale" type="range" className={styles.iconSizeSlider} min={ICON_SCALE_MIN} max={ICON_SCALE_MAX} step={1}
                    value={d.iconScale} onChange={e => change({ iconScale: Number(e.target.value) }, true)} aria-label="App icon logo size" />
                  <div className={styles.iconSizeScale} aria-hidden="true"><span>Small</span><span>Default</span><span>Large</span></div>
                  <p className={styles.inheritNote}>Drag to size your logo in the icon. Android keeps a little more edge padding so its round icon never crops your logo.</p>
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* ── Theme: the presets and light / dark; the drawn mock went (the door shows the real page) ── */}
          <CollapsibleCard title={W.theme} sectionId="theme" defaultOpen={false} meta={themeSummary(presetName, d.colorMode)}>
            <p className={styles.compactNote}>{W.themeLine}</p>
            <div className={styles.swatchGrid}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button key={key} type="button" title={preset.name} aria-label={preset.name} aria-pressed={d.presetKey === key}
                  className={`${styles.swatch} ${d.presetKey === key ? styles.swatchActive : ''}`} style={{ background: preset.primary }}
                  onClick={() => change({ presetKey: key })}>
                  {d.presetKey === key && <span className={styles.swatchCheck}>✓</span>}
                </button>
              ))}
              <button type="button" title={W.custom} aria-label={W.custom} aria-pressed={d.presetKey === 'custom'}
                className={`${styles.swatch} ${styles.swatchCustom} ${d.presetKey === 'custom' ? styles.swatchActive : ''}`}
                onClick={() => {
                  if (d.presetKey === 'custom') return;
                  // Custom starts from the colours on show, so opening it to look changes nothing families see.
                  const from = PRESETS[d.presetKey];
                  change({ presetKey: 'custom', customPrimary: from?.primary ?? d.customPrimary, customAccent: from?.accent ?? d.customAccent });
                }}>
                {d.presetKey === 'custom' && <span className={styles.swatchCheck}>✓</span>}
              </button>
            </div>
            {d.presetKey === 'custom' && (
              <div className={styles.customPickers}>
                <div className={styles.colorPickerField}>
                  <label className={styles.label} htmlFor="t-primary">{W.primary}</label>
                  <div className={pageCss.hexRow}>
                    <input id="t-primary" type="color" className={styles.colorInput} value={d.customPrimary} onChange={e => change({ customPrimary: e.target.value }, true)} />
                    <HexField id="t-primary-hex" label={W.primary} value={d.customPrimary} onChange={hex => change({ customPrimary: hex }, true)} />
                  </div>
                </div>
                <div className={styles.colorPickerField}>
                  <label className={styles.label} htmlFor="t-accent">{W.accent}</label>
                  <div className={pageCss.hexRow}>
                    <input id="t-accent" type="color" className={styles.colorInput} value={d.customAccent} onChange={e => change({ customAccent: e.target.value }, true)} />
                    <HexField id="t-accent-hex" label={W.accent} value={d.customAccent} onChange={hex => change({ customAccent: hex }, true)} />
                  </div>
                </div>
              </div>
            )}
            <div className={styles.modeToggleRow}>
              <h3 className={styles.modeToggleLabel}>{W.background}</h3>
              <div className={styles.modeToggle} role="group" aria-label={W.background}>
                {(['dark', 'light'] as const).map(m => (
                  <button key={m} type="button" aria-pressed={d.colorMode === m}
                    className={`${styles.modeToggleBtn} ${d.colorMode === m ? styles.modeToggleBtnActive : ''}`}
                    onClick={() => change({ colorMode: m })}>
                    {m === 'dark' ? W.dark : W.light}
                  </button>
                ))}
              </div>
            </div>
            {previewTheme.isLowContrast && <div className={styles.lowContrastWarning}>{W.lowContrast}</div>}
            <p className={styles.inheritNote}>{W.inheritTheme}</p>
          </CollapsibleCard>

          {/* ── Hero banner ── */}
          <CollapsibleCard title={W.heroBanner} sectionId="hero-banner" defaultOpen={false} meta={fileName(bannerUrl)}>
            <FormError>{bannerError}</FormError>
            <p className={styles.bannerDesc}>{W.bannerLine}</p>
            {bannerUrl && (
              <div className={styles.bannerPreview}><img src={bannerUrl} alt="Hero banner preview" className={styles.bannerImg} /></div>
            )}
            <div className={styles.logoActions}>
              <button type="button" className="btn btn-outline btn-data" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}>
                <ImageIcon size={13} aria-hidden /> {bannerUploading ? W.uploading : bannerUrl ? W.replaceBanner : W.uploadBanner}
              </button>
              {bannerUrl && (
                <button type="button" className="btn btn-ghost btn-data" onClick={() => void removeUpload('banner')} disabled={bannerUploading}>{W.remove}</button>
              )}
            </div>
            <p className={styles.bannerHint}>{W.bannerHint}</p>
            <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) void upload('banner', f); }} />
          </CollapsibleCard>

          {/* ── Font ── */}
          <CollapsibleCard title={W.font} sectionId="font" defaultOpen={false} meta={FONT_OPTIONS[d.fontKey]?.label ?? d.fontKey}>
            <div className={styles.fontGrid}>
              {Object.entries(FONT_OPTIONS).map(([key, opt]) => (
                <button key={key} type="button" aria-pressed={d.fontKey === key}
                  className={`${styles.fontBtn} ${d.fontKey === key ? styles.fontBtnActive : ''}`} style={{ fontFamily: opt.sampleStyle }}
                  onClick={() => change({ fontKey: key })}>
                  <span className={styles.fontBtnLabel}>{opt.label}</span>
                  <span className={styles.fontBtnSample}>Aa 123</span>
                </button>
              ))}
            </div>
            <p className={styles.inheritNote}>{W.inheritFont}</p>
          </CollapsibleCard>

          {/* ── Card style ── */}
          <CollapsibleCard title={W.cardStyle} sectionId="card-style" defaultOpen={false} meta={CARD_STYLE_OPTIONS[d.cardStyle]?.label ?? d.cardStyle}>
            <div className={styles.cardStyleGrid}>
              {Object.entries(CARD_STYLE_OPTIONS).map(([key, opt]) => (
                <button key={key} type="button" aria-pressed={d.cardStyle === key}
                  className={`${styles.cardStyleBtn} ${d.cardStyle === key ? styles.cardStyleBtnActive : ''}`}
                  onClick={() => change({ cardStyle: key })}>
                  <div className={`${styles.cardStyleThumb} ${styles[`cardThumb_${key}` as keyof typeof styles]}`}>
                    <div className={styles.cardThumbLine} />
                    <div className={styles.cardThumbLine} style={{ width: '60%' }} />
                  </div>
                  <span className={styles.cardStyleLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
            <p className={styles.inheritNote}>{W.inheritCard}</p>
          </CollapsibleCard>
        </>
      )}

      <SavePill
        saving={saving || logoUploading || bannerUploading}
        dirty={waiting}
        error={saveError}
        onRetry={saveNow}
      />
    </div>
  );
}
