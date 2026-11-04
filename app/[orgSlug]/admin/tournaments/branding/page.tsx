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
 *   Look, Logo    the Look card (colours, type and the band preview — Public tournament pages Stage 1a) and the Logo
 *                 card. Nothing else: every control here is read by a public page. The App icon card went with Stage 8
 *                 Part 1 (the home-screen icon is always FieldLogicHQ's, owner ruling 2026-11-03); Theme with
 *                 Dark/Light, Hero banner, Font and Card style went with Stage 8 Part 4b (asks A/B, ruled 2026-11-03).
 *   saving        every change saves itself with the floating pill: a choice at once, typing after a pause, and
 *                 anything still waiting is sent as you leave — the bottom Save Changes, its "Unsaved changes" and
 *                 the success pop-ups after an upload went; nothing is lost by leaving (a theme change was, silently).
 *   free plan     the door and Pages as every plan; the advanced part locked as today (the free tier review decides).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SwitchRow, SwitchRows } from '@/components/admin/tournament/SwitchRows';
import { BoardDoor } from '../dashboard/GameDayBoard';
import { PUBLIC_PAGE_OPTIONS, normalizeHiddenPublicPages, type PublicPageKey } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { LOCK_WORDS } from '@/lib/invite-only-words';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { hasCapability } from '@/lib/roles';
import { publicHref, useClubPublicOrigin } from '@/lib/use-club-public-origin';
import { PUBLIC_SITE_WORDS as W } from '@/lib/tournament-settings-words';
import { lookNounOf } from '@/lib/tournament-look-words';
import { hasOwnTournamentColours, hasClubTournamentLook } from '@/lib/tournament-look';
import { mayOpenSiteEditor, mayWriteSite } from '@/lib/public-site-rules';
import LookCard, { type LookBandFacts } from './LookCard';
import { frameBodyOf, type FrameBodyDraft } from './look-draft';
import styles from './branding.module.css';
import pageCss from './site.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** Public site's "?" (A56): its own help sub-topic. */
const SITE_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['public-site-preview'], subtopicId: 'public-site-cards' };

interface BrandingSettings {
  logoUrl: string | null;
  themePreset: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  /** The type look's stored value (mig 426's meaning): it seeds the draft's `typeKey`. */
  themeFont: string | null;
  publicHiddenPages: PublicPageKey[];
  coachNamesShowOnPublic: boolean;
  /** What the band reads from the event's records, for the Look card's preview (asked for with `with=look`). */
  band?: LookBandFacts | null;
}

/** What the page edits — sent on every save, the theme and the type only once changed (look-draft.ts `frameBodyOf`). */
type Draft = FrameBodyDraft;

function draftOf(data: BrandingSettings, advanced: boolean): Draft {
  const custom = Boolean(data.themePrimary && advanced);
  return {
    presetKey: custom ? 'custom' : data.themePreset ?? 'platform',
    customPrimary: custom ? data.themePrimary! : '#1E3A8A',
    customAccent: custom ? data.themeAccent ?? '#D9F99D' : '#D9F99D',
    publicHiddenPages: normalizeHiddenPublicPages(data.publicHiddenPages),
    coachNamesShowOnPublic: data.coachNamesShowOnPublic === true,
    own: advanced && hasOwnTournamentColours(data),
    typeKey: advanced ? data.themeFont ?? null : null,
  };
}

/** The draft fields that ARE the theme. Touching one is choosing a theme; nothing else is. */
const THEME_FIELDS = ['presetKey', 'customPrimary', 'customAccent', 'own'] as const satisfies readonly (keyof Draft)[];
/** The draft field that IS the type (the Look card): it rides a save only once touched, as the theme does. */
const TYPE_FIELDS = ['typeKey'] as const satisfies readonly (keyof Draft)[];

/** The draft with the address it was read from (and the plan's body): a save always goes to ITS tournament.
 *  `themeChanged` stays true from the first theme change until the next read, so choosing a theme and then
 *  choosing back still writes the second choice (`typeChanged` the same, for the type). */
type Held = { url: string; advanced: boolean; draft: Draft; themeChanged: boolean; typeChanged: boolean };
const send = (held: Held, keepalive = false) => fetch(held.url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(frameBodyOf(held.draft, held.advanced, held.themeChanged, held.typeChanged)),
  keepalive,
});

/** A file's own name from its stored address ("uat-plus-logo.png"), or "Uploaded" when it carries none worth showing. */
function fileName(url: string | null): string {
  if (!url) return W.none;
  const last = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
  return /^[\w.-]{1,60}\.(png|jpe?g|webp|gif|svg)$/i.test(last) && !/^\d{10,}/.test(last) ? last : W.uploaded;
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [bandFacts, setBandFacts] = useState<LookBandFacts | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // `with=look`: only this page asks for the Look card's band facts — event settings and the setup wizard share the
      // route and read none of them, so they never pay for that read.
      const res = await fetch(`${brandingUrl}&with=look`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = await res.json() as BrandingSettings;
      if (currentUrl.current !== brandingUrl) return; // another event's read owns the page now
      setLogoUrl(data.logoUrl);
      setBandFacts(data.band ?? null);
      // An edit made while this read was out stays: a late read never overwrites it.
      if (edits.current !== editsAtStart && latest.current?.url === brandingUrl) return;
      const d = draftOf(data, advanced);
      latest.current = { url: brandingUrl, advanced, draft: d, themeChanged: false, typeChanged: false };
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
    latest.current = {
      ...held,
      draft: { ...held.draft, ...patch },
      themeChanged: held.themeChanged || THEME_FIELDS.some(k => k in patch),
      typeChanged: held.typeChanged || TYPE_FIELDS.some(k => k in patch),
    };
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

  // ── The logo saves on its own, as today; the pill says so (no pop-up), a failure says so in its card ──
  const logoRoute = tournamentId ? `/api/admin/tournament-logo?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}` : '';
  async function uploadLogo(file: File) {
    if (!logoRoute || !advanced) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(logoRoute, { method: 'POST', body: fd });
      const data = await res.json().catch(() => null) as { logoUrl?: string; error?: string } | null;
      if (!res.ok) throw new Error(data?.error && res.status < 500 ? data.error : W.uploadFailed);
      setLogoUrl(data?.logoUrl ?? null);
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : W.uploadFailed);
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }
  async function removeLogo() {
    if (!logoRoute || !advanced) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      const res = await fetch(logoRoute, { method: 'DELETE' });
      if (!res.ok) throw new Error('remove');
      setLogoUrl(null);
    } catch {
      setLogoError(W.removeFailed);
    } finally {
      setLogoUploading(false);
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
  const togglePage = (key: PublicPageKey) => change({
    publicHiddenPages: d.publicHiddenPages.includes(key) ? d.publicHiddenPages.filter(k => k !== key) : [...d.publicHiddenPages, key],
  });
  // The Look card (Stage 1a Part 3): who may open the club's Public site editor (its "Public site" link in the Look
  // card), and who may change the club's look there (the owner or an admin — "Change the club's look"; never a coach).
  const mayOpenEditor = !!currentOrg && !!userRole
    && mayOpenSiteEditor({ role: userRole, capabilities: userCapabilities, org: currentOrg });
  const editorHref = mayOpenEditor ? `/${currentOrg.slug}/admin/public-site` : null;
  const clubLayer = !!currentOrg && hasClubTournamentLook(currentOrg);
  // The logo's fallback, said as it is: the club's (the league's) logo, none on Tournament Plus (lib/tournament-look.ts).
  const logoHint = clubLayer ? W.logoHintFallback[lookNounOf(currentOrg?.planId)] : W.logoHintOwn;

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
        <PlanLockLine href={tournamentPlusPanelHref(currentOrg ?? 'admin')}>{LOCK_WORDS.brandingLook}</PlanLockLine>
      ) : (
        <>
          {/* ── Look: the colours and the type as one card, first after Pages (Stage 1a, drawing ask 6) ── */}
          {currentOrg && currentTournament && (
            <LookCard org={currentOrg} tournament={currentTournament} draft={d} logoUrl={logoUrl} facts={bandFacts}
              inviteOnly={inviteOnly} editorHref={editorHref} mayChangeClubLook={mayOpenEditor && mayWriteSite(userRole ?? '')}
              onChange={change} />
          )}

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
                  <button type="button" className="btn btn-ghost btn-data" onClick={() => void removeLogo()} disabled={logoUploading}>{W.remove}</button>
                )}
                <p className={styles.logoHint}>{logoHint}</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
          </CollapsibleCard>
        </>
      )}

      <SavePill
        saving={saving || logoUploading}
        dirty={waiting}
        error={saveError}
        onRetry={saveNow}
      />
    </div>
  );
}
