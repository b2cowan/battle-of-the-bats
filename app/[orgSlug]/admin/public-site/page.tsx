'use client';
/**
 * PUBLIC SITE — THE BUILDER: the club makes its site with the site beside it (Public site builder, ruled 2026-10-21,
 * A1–A9 + Option A; drawing https://claude.ai/artifact/LSWvZmV9r1772Zt4etqcaM; plan
 * docs/projects/active/PUBLIC_SITE_BUILDER_PLAN.md). It replaced Stage 4c-1's one long page of nine cards (which broke
 * the 2026-07-09 rule: a page of several jobs is a grid or tabs, never a stack).
 *
 *   header        "Public site", Online/Offline, the address, Copy link, Open (Preview while offline below the desk).
 *   Club notice   one strip at the top while the site is online; Post and Edit open the window (A7).
 *   Set up        until every part is ready, or while the site is offline: "N of 4 ready", and for the owner the one lime
 *                 Go live while offline (A8; nothing is required). ⚖ A new club's site starts ONLINE (is_public defaults
 *                 true), so the marks follow the parts, not a first Go live.
 *   five rows     open in place, one at a time, each saying what is in it while closed:
 *                   Look                   logo, colours ("From your logo" first), type, banner — moved in from Settings
 *                   Home page              the sections in the club's order, a switch each (4c-1, unchanged)
 *                   About the club         tagline, about, the questions address, the social links
 *                   Contacts and documents the three About-page lists, each record in its window
 *                   Visibility             the site's switch and the directory listing (the owner's), the address
 *   preview       beside the rows at a desk: the club's home as families see it, computer or phone, redrawn after every
 *                 save; a click on a part opens the row that sets it (A1, A2, A9). Below the desk, a window.
 *
 * WHO (Option A): the owner or an admin changes everything but Visibility, which is the owner's (an admin reads it). Every
 * change saves itself with the floating pill (A6) except a notice, which waits for Post notice.
 */
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, useEffect, type ReactNode } from 'react';
import { Check, Copy, Eye, ExternalLink, Globe } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { isClubPlan, hasModuleEntitlement } from '@/lib/module-entitlements';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { ClubRow, ClubRowList, LoadFailed, NoticePill, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { SwitchButton } from '@/components/admin/tournament/SwitchRows';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import LoadingState from '@/components/shared/LoadingState';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { editorSectionRows, normalizeHiddenSections, normalizeSectionOrder, reorderedSections, type SectionCarries, type SectionFacts, type SiteSectionKey } from '@/lib/club-site-sections';
import { savedAsHint, looksPersonalEmail, EMAIL_MAX, LINK_MAX, ROLE_ADDRESS_NUDGE } from '@/lib/site-field-checks';
import { pastYearHint } from '@/lib/past-year-hint';
import { lookWords } from '@/lib/colour-words';
import { DOCUMENT_HEADING_SUGGESTIONS } from '@/lib/club-about';
import { builderReadiness } from '@/lib/public-site-builder';
import type { SiteEditRow } from '@/lib/site-edit-marks';
import {
  checkSiteField, Refused, LIST_MAX, SITE_FIELD_MAX, CONTACT_ROLE_MAX, DOCUMENT_HEADING_MAX, DOCUMENT_TITLE_MAX, QUESTION_MAX,
  ANSWER_MAX, SPONSOR_NAME_MAX, type ListKind, type SiteTextField,
} from '@/lib/public-site-patch';
import { sponsorCounts, sponsorEnded, sponsorRowSub } from '@/lib/club-sponsors';
import { tournamentToday } from '@/lib/timezone';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { ClubNotice, OrgPublicSiteContent, SiteContact, SiteDocument, SiteQuestion, SiteSponsor } from '@/lib/types';
import SiteListRecord, { type SiteList } from './SiteListRecord';
import ClubNoticeStrip from './ClubNotice';
import BuilderRow from './BuilderRow';
import LookPanel from './LookPanel';
import VisibilityPanel from './VisibilityPanel';
import CoachNamesPanel from './CoachNamesPanel';
import { COACH_NAMES_WORDS as CW, coachNamesChoiceName } from '@/lib/coach-names-words';
import { sanitizeCoachNamesPolicy, type CoachNamesPolicy } from '@/lib/coach-names-policy';
import SitePreview from './SitePreview';
import styles from './public-site.module.css';

type TextKey = SiteTextField;
type RowKey = Exclude<SiteEditRow, 'notice'> | 'visibility' | 'coaches';
const TEXT_KEYS = Object.keys(SITE_FIELD_MAX) as TextKey[];
const SOCIAL: { key: TextKey; label: string; placeholder: string }[] = [
  { key: 'socialInstagram', label: W.instagram, placeholder: 'https://instagram.com/yourclub' },
  { key: 'socialFacebook', label: W.facebook, placeholder: 'https://facebook.com/yourclub' },
  { key: 'socialX', label: W.x, placeholder: 'https://x.com/yourclub' },
  { key: 'socialWebsite', label: W.website, placeholder: 'https://yourclub.ca' },
];

/** The width the preview stands beside the rows from (below it, the preview is a window). */
const WIDE = '(min-width: 1200px)';
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** The same object when it has no such key (so a state setter does not re-render for nothing), else a copy without it. */
function without<T extends object>(o: T, key: keyof T): T {
  if (!(key in o)) return o;
  const copy = { ...o };
  delete copy[key];
  return copy;
}

type AnyItem = SiteContact | SiteDocument | SiteQuestion | SiteSponsor;
/** Each list the club keeps (the About page's three, and the sponsors): its fields, its words, and what its rows say. */
const LISTS: Record<ListKind, SiteList> = {
  contacts: {
    kind: 'contacts',
    fields: [
      { key: 'role', label: W.role, placeholder: W.rolePlaceholder, kind: 'text', maxLength: CONTACT_ROLE_MAX },
      { key: 'email', label: W.email, placeholder: W.emailPlaceholder, kind: 'email', maxLength: EMAIL_MAX, nudge: v => looksPersonalEmail(v) ? ROLE_ADDRESS_NUDGE : null },
    ],
    words: { title: W.contacts, lead: W.contactsLead, add: W.addContact, edit: W.editContact, remove: W.removeContact, saved: W.contactSaved, removed: W.contactRemoved },
    title: i => i.role, caption: i => i.email,
  },
  documents: {
    kind: 'documents',
    fields: [
      { key: 'heading', label: W.heading, kind: 'text', maxLength: DOCUMENT_HEADING_MAX, suggestions: DOCUMENT_HEADING_SUGGESTIONS },
      { key: 'title', label: W.docTitle, placeholder: W.docTitlePlaceholder, kind: 'text', maxLength: DOCUMENT_TITLE_MAX },
      { key: 'url', label: W.link, placeholder: W.linkPlaceholder, kind: 'link', maxLength: LINK_MAX },
    ],
    words: { title: W.documents, lead: W.documentsLead, add: W.addDocument, edit: W.editDocument, remove: W.removeDocument, saved: W.documentSaved, removed: W.documentRemoved },
    title: i => i.title, caption: i => i.heading,
  },
  questions: {
    kind: 'questions',
    fields: [
      { key: 'question', label: W.question, placeholder: W.questionPlaceholder, kind: 'text', maxLength: QUESTION_MAX },
      { key: 'answer', label: W.answer, placeholder: W.answerPlaceholder, kind: 'textarea', maxLength: ANSWER_MAX, pastYearHint: true },
    ],
    words: { title: W.questions, lead: W.questionsLead, add: W.addQuestion, edit: W.editQuestion, remove: W.removeQuestion, saved: W.questionSaved, removed: W.questionRemoved },
    title: i => i.question, caption: i => (i.answer ?? '').split('\n')[0],
  },
  // Sponsors (Stage 4d): only the name is required, so only it carries the star. An ended sponsor stays in the list.
  sponsors: {
    kind: 'sponsors',
    fields: [
      { key: 'name', label: W.sponsorName, placeholder: W.sponsorNamePlaceholder, kind: 'text', maxLength: SPONSOR_NAME_MAX },
      { key: 'logoUrl', label: W.logo, kind: 'logo', maxLength: LINK_MAX, optional: true },
      { key: 'link', label: W.link, placeholder: W.sponsorLinkPlaceholder, kind: 'link', maxLength: LINK_MAX, optional: true, hint: W.sponsorLinkHint },
      { key: 'endsOn', label: W.lastDay, kind: 'date', maxLength: 10, optional: true, hint: W.lastDayHint },
    ],
    words: { title: W.sponsors, lead: W.sponsorsLead, add: W.addSponsor, edit: W.editSponsor, remove: W.removeSponsor, saved: W.sponsorSaved, removed: W.sponsorRemoved },
    title: i => i.name, caption: (i, today) => sponsorRowSub(i, today),
    // A row wears its logo (the same shape families see, small); an ended one dims and says so.
    row: (i, today) => {
      const ended = sponsorEnded({ endsOn: i.endsOn }, today);
      return {
        markWide: true,
        mark: (
          <span className={`${styles.sponsorThumb}${i.logoUrl ? '' : ` ${styles.sponsorThumbNone}`}`}>
            {i.logoUrl ? <img src={i.logoUrl} alt="" /> : <span className={styles.noImage}>{W.noLogoThumb}</span>}
          </span>
        ),
        muted: ended,
        trail: ended ? <span className={ck.chip}>{W.sponsorEnded}</span> : undefined,
      };
    },
    banner: (i, today) => (sponsorEnded(i, today) ? W.sponsorEndedBanner : null),
    removeBody: i => (i.logoUrl ? W.removeSponsorBodyLogo : W.removeBody),
  },
};

export default function PublicSitePage() {
  const { currentOrg, userRole, userCapabilities, loading, refresh } = useOrg();
  const orgSlug = currentOrg?.slug ?? '';
  const query = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const canWrite = userRole === 'owner' || userRole === 'admin';
  const thisYear = new Date().getFullYear();
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);

  const [content, setContent] = useState<OrgPublicSiteContent | null>(null);
  const [facts, setFacts] = useState<SectionFacts | null>(null);
  const [carries, setCarries] = useState<SectionCarries | null>(null);
  const [notice, setNotice] = useState<ClubNotice | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Typed fields: what the club typed (shown), what was saved, and each field's refusal.
  const [typed, setTyped] = useState<Record<TextKey, string>>(() => Object.fromEntries(TEXT_KEYS.map(k => [k, ''])) as Record<TextKey, string>);
  const [savedAs, setSavedAs] = useState<Partial<Record<TextKey, string | null>>>({});
  const [refused, setRefused] = useState<Partial<Record<TextKey, string>>>({});
  // A refusal is SHOWN once the club pauses on that field or leaves it — never on the first keystroke of an address
  // still being typed. It is never saved either way; once shown it stays until fixed, and typing in the field again
  // hides it until the next pause.
  const [shown, setShown] = useState<Partial<Record<TextKey, true>>>({});
  const reveal = (keys: readonly TextKey[]) => {
    if (keys.length) setShown(s => ({ ...s, ...Object.fromEntries(keys.map(k => [k, true])) }));
  };
  const touched = useRef(new Set<TextKey>());
  const typedNow = useRef(typed);
  useEffect(() => { typedNow.current = typed; }, [typed]);
  const [waiting, setWaiting] = useState(false);
  const pending = useRef<Partial<Record<TextKey, string>>>({});
  const timer = useRef<number | null>(null);

  // Three queues: the typed fields', the section order's and switches', and the look's. A failed move is never cleared
  // by a later, unrelated typed save, and Retry replays the one that failed.
  const typedQ = useSaveQueue();
  const sectionQ = useSaveQueue();
  const lookQ = useSaveQueue();
  const [told, setTold] = useState<string | null>(null);
  const [openRecord, setOpenRecord] = useState<{ kind: ListKind; id: string | 'new' } | null>(null);
  // The one open row ('unset' until the club opens or closes one: then the first part not ready, if any).
  const [openRow, setOpenRow] = useState<RowKey | null | 'unset'>('unset');
  // Which row starts open is decided ONCE, on the first draw (the first part not ready, on a set-up). Never again from
  // readiness: finishing a part must not close the row being typed in and snap another one open.
  const firstRow = useRef<RowKey | null | undefined>(undefined);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Bumped after every save: the preview is fetched again.
  const [version, setVersion] = useState(1);
  // A burst of saves (a few quick switches, a drag) draws the preview once, a moment after the last — each draw is a whole
  // server render of the club's home, and one still loading would only be thrown away.
  useEffect(() => { if (wide) setPreviewOpen(false); }, [wide]);
  const redrawTimer = useRef<number | null>(null);
  const redraw = useCallback(() => {
    if (redrawTimer.current) window.clearTimeout(redrawTimer.current);
    redrawTimer.current = window.setTimeout(() => { redrawTimer.current = null; setVersion(v => v + 1); }, 400);
  }, []);
  useEffect(() => () => { if (redrawTimer.current) window.clearTimeout(redrawTimer.current); }, []);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setFetching(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/admin/public-site${query}${query ? '&' : '?'}with=editor`);
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      const c = data.content as OrgPublicSiteContent | null;
      setContent(c);
      setFacts(data.facts);
      setCarries(data.carries);
      setNotice(data.notice ?? null);
      setTyped(Object.fromEntries(TEXT_KEYS.map(k => [k, (c?.[k] as string | null) ?? ''])) as Record<TextKey, string>);
    } catch {
      setLoadError(true);
    } finally {
      setFetching(false);
    }
  }, [orgSlug, query]);
  useEffect(() => { void load(); }, [load]);

  const patch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/public-site${query}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Refused(data.field ?? null, typeof data.error === 'string' ? data.error : W.saveFailed);
    return (data.saved ?? {}) as Partial<OrgPublicSiteContent>;
  }, [query]);

  // ── Typed fields: checked here with the route's own rules, sent after a pause; a refused one never leaves ──
  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setWaiting(false);
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length === 0) return;
    void typedQ.run(async () => {
      try {
        const saved = await patch(batch);
        setContent(c => (c ? { ...c, ...saved } : c));
        redraw();
        // "Saved as …" only for a field still showing what was sent (one typed again since then waits for its own save).
        setSavedAs(s => {
          const next = { ...s };
          for (const k of Object.keys(batch) as TextKey[]) {
            if (typedNow.current[k] === batch[k]) next[k] = (saved as Record<string, string | null>)[k] ?? null;
          }
          return next;
        });
      } catch (e) {
        if (e instanceof Refused && e.field && e.field in batch) {
          // The server refused one field (its check and the browser's disagreed): say why there, and send the rest.
          const field = e.field as TextKey;
          setRefused(r => ({ ...r, [field]: e.message }));
          reveal([field]);
          const rest = { ...batch };
          delete rest[field];
          pending.current = { ...rest, ...pending.current };
          if (Object.keys(pending.current).length) timer.current = window.setTimeout(() => flushRef.current(), 0);
          return;
        }
        // Put it back so Retry (or the next keystroke) sends it again.
        pending.current = { ...batch, ...pending.current };
        throw e;
      }
    }, W.saveFailed);
  }, [patch, typedQ, redraw]);
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const type = (key: TextKey, value: string) => {
    setTyped(t => ({ ...t, [key]: value }));
    const check = checkSiteField(key, value);
    if (!check.ok) {
      setRefused(r => ({ ...r, [key]: check.error }));
      delete pending.current[key];
    } else {
      setRefused(r => without(r, key));
      pending.current[key] = value;
    }
    setSavedAs(s => without(s, key));
    setShown(s => without(s, key));
    touched.current.add(key);
    setWaiting(Object.keys(pending.current).length > 0);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      reveal([...touched.current]);
      touched.current.clear();
      flush();
    }, 900);
  };
  // Leaving with a change still waiting: send it straight away, kept alive past the page (never behind the queue —
  // a page being closed does not wait for the save before it).
  useEffect(() => {
    const out = () => {
      const batch = pending.current;
      if (Object.keys(batch).length === 0) return;
      pending.current = {};
      void fetch(`/api/admin/public-site${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', out);
    return () => { window.removeEventListener('pagehide', out); };
  }, [query]);

  // ── Home page: a move or a switch saves at once ──
  const prefs = { order: content?.homeSectionOrder, hidden: content?.homeSectionsHidden };
  const rows = facts && carries ? editorSectionRows(prefs, facts, carries) : [];

  const saveSections = (order: SiteSectionKey[], hidden: SiteSectionKey[]) => {
    setContent(c => (c ? { ...c, homeSectionOrder: order, homeSectionsHidden: hidden } : c));
    void sectionQ.run(async () => { await patch({ homeSectionOrder: order, homeSectionsHidden: hidden }); redraw(); }, W.reorderFailed);
  };
  // A move among the editor's rows (Open now, fixed first, never moves and is never crossed — ReorderList's `fixed`).
  const moveSection = (from: number, to: number) => {
    const keys = rows.map(r => r.key);
    const [k] = keys.splice(from, 1);
    keys.splice(to, 0, k);
    saveSections(reorderedSections(prefs.order, keys.filter((x): x is SiteSectionKey => x !== 'openNow')), normalizeHiddenSections(prefs.hidden));
  };
  const toggleSection = (key: SiteSectionKey) => {
    const hidden = normalizeHiddenSections(prefs.hidden);
    saveSections(normalizeSectionOrder(prefs.order), hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]);
  };

  // ── Lists: the window saves the whole list; the route gives new rows their ids ──
  // The window waits on it and shows its own pill or refusal, so it calls the route directly (the page's queue would
  // swallow a refusal). A sentence only for an add or a remove; an edit's own pill says "Saved".
  const saveList = async (kind: ListKind, next: AnyItem[], word: string | null) => {
    const list = (await patch({ [kind]: next }))[kind];
    if (!Array.isArray(list)) throw new Error(W.saveFailed);
    setContent(c => (c ? { ...c, [kind]: list as AnyItem[] } : c));
    redraw();
    if (word) setTold(word);
  };

  // ── A sponsor's logo file: made by the server (opened and re-saved), thrown away only after the list stopped using it ──
  const uploadSponsorLogo = async (file: File): Promise<string> => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/admin/public-site/sponsor-logo${query}`, { method: 'POST', body });
    const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string };
    if (!res.ok || typeof data.logoUrl !== 'string') throw new Error(typeof data.error === 'string' && data.error ? data.error : W.logoUploadFailed);
    return data.logoUrl;
  };
  const discardSponsorLogo = async (logoUrl: string): Promise<void> => {
    await fetch(`/api/admin/public-site/sponsor-logo${query}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl }),
    });
  };

  // ── The look and the switches: the org is read again, the preview redrawn ──
  // The preview reads the saved club itself, so it is asked to redraw at once and does not wait for the org read.
  const lookChanged = useCallback(async () => { redraw(); await refresh(); }, [refresh, redraw]);
  const orgPatch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/org-settings${query}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : W.switchFailed);
    redraw();
    await refresh();
  }, [query, refresh, redraw]);
  // Coaches on team pages (mig 352): the owner's choice saves through the page's one pill, which carries its failure and Retry.
  const [coachNamesSave, setCoachNamesSave] = useState<{ saving: boolean; error: string | null; last: CoachNamesPolicy | null }>({ saving: false, error: null, last: null });
  const saveCoachNames = useCallback(async (policy: CoachNamesPolicy) => {
    setCoachNamesSave({ saving: true, error: null, last: policy });
    try {
      const res = await fetch(`/api/admin/org/coach-names${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : CW.saveFailed);
      await refresh();
      setCoachNamesSave({ saving: false, error: null, last: policy });
    } catch (e) {
      setCoachNamesSave({ saving: false, error: e instanceof Error && e.message ? e.message : CW.saveFailed, last: policy });
      throw e;
    }
  }, [query, refresh]);
  const [goingLive, setGoingLive] = useState(false);
  const goLive = async () => {
    setGoingLive(true);
    try { await orgPatch({ isPublic: true }); setTold(W.nowOnline); } catch { setTold(W.switchFailed); } finally { setGoingLive(false); }
  };

  // A click in the preview opens the row that sets the part clicked (A9); a click on the notice opens its window.
  const editFromPreview = useCallback((row: SiteEditRow) => {
    setPreviewOpen(false);
    // The strip (and so its window) exists only while the site is online; the preview still draws the notice offline.
    if (row === 'notice') { if (currentOrg?.isPublic) setNoticeOpen(true); return; }
    setOpenRow(row);
  }, [currentOrg?.isPublic]);

  const { copied, copy } = useCopyToClipboard();
  const address = typeof window !== 'undefined' && orgSlug ? `${window.location.origin}/${orgSlug}` : '';
  const shownAddress = address.replace(/^https?:\/\//, '');
  const look = useMemo(() => currentOrg ? lookWords({ preset: currentOrg.themePreset, primary: currentOrg.themePrimary, accent: currentOrg.themeAccent, font: currentOrg.themeFont }) : null, [currentOrg]);

  if (loading) return <LoadingState label={W.loading} />;
  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_public_site') || !currentOrg) {
    return (
      <div className={styles.accessDenied}>
        <Globe size={32} aria-hidden />
        <h2>{W.noAccessTitle}</h2>
        <p>{W.noAccess}</p>
      </div>
    );
  }

  const isOwner = userRole === 'owner';
  const on = currentOrg.isPublic;
  const noun = isClubPlan(currentOrg.planId) ? 'club' : currentOrg.planId === 'league' ? 'league' : 'organization';

  const header = (
    <>
      <AdminPageHeader
        title={W.title}
        titleChips={<span className={`${ck.chip} ${on ? ck.chipGood : ck.chipWarn}`}>{on ? W.online : W.offline}</span>}
      />
      <div className={styles.siteHead}>
        <div className={styles.addressRow}>
          <span className={styles.addressLabel}>{W.familiesSeeItAt}</span>
          <span className={styles.address}>{shownAddress}</span>
          <div className={styles.addressButtons}>
            {/* A phone's secondary actions are their symbols alone (2026-10-20); a desk keeps the words. */}
            <button type="button" className={`btn btn-outline btn-data ${styles.addressButton}`} onClick={() => copy(address)} aria-label={copied ? W.copied : W.copyLink}>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} <span className={styles.addressWord}>{copied ? W.copied : W.copyLink}</span>
            </button>
            {on ? (
              <a href={address} target="_blank" rel="noopener noreferrer" className={`btn btn-outline btn-data ${styles.addressButton}`} aria-label={W.open}>
                <ExternalLink size={14} aria-hidden /> <span className={styles.addressWord}>{W.open}</span>
              </a>
            ) : canWrite && !wide && (
              <button type="button" className={`btn btn-outline btn-data ${styles.addressButton}`} onClick={() => setPreviewOpen(true)} aria-haspopup="dialog" aria-label={W.preview}>
                <Eye size={14} aria-hidden /> <span className={styles.addressWord}>{W.preview}</span>
              </button>
            )}
            <span className={repKit.srOnly} aria-live="polite">{copied ? W.copied : ''}</span>
          </div>
        </div>
        {!canWrite && <p className={styles.siteState}>{W.readOnly}</p>}
      </div>
    </>
  );

  if (fetching) return <div className={repKit.page}>{header}<LoadingState label={W.loading} /></div>;
  if (loadError || !facts || !carries) {
    return <div className={repKit.page}>{header}<LoadFailed title={W.loadFailed} onRetry={() => void load()} /></div>;
  }

  // ── What each row holds, and whether it is ready (A8) ──
  const counts = { contacts: content?.contacts?.length ?? 0, documents: content?.documents?.length ?? 0, questions: content?.questions?.length ?? 0 };
  // Sponsors are optional thank-yous: they say how many there are, but an empty list is never "not set up" (not in `counts`).
  const today = tournamentToday();
  const sponsorFacts = sponsorCounts(content?.sponsors, today);
  const ready = builderReadiness({
    logoUrl: currentOrg.logoUrl, themePreset: currentOrg.themePreset, themePrimary: currentOrg.themePrimary,
    tagline: content?.tagline, contactEmail: content?.contactEmail, ...counts,
  });
  const setup = canWrite && (!on || ready.ready < ready.of);
  const firstToDo: RowKey | null = !ready.look ? 'look' : !ready.about ? 'about' : !ready.lists ? 'lists' : null;
  if (firstRow.current === undefined) firstRow.current = setup ? firstToDo : null;
  const rowOpen: RowKey | null = openRow === 'unset' ? firstRow.current : openRow;
  const toggle = (key: RowKey) => setOpenRow(rowOpen === key ? null : key);
  const mark = (isReady: boolean) => setup ? { ready: isReady, label: isReady ? W.rowReady : W.rowToDo } : null;

  const shownSections = rows.filter(r => !r.locked && r.shown);
  const socials = SOCIAL.filter(s => (content?.[s.key] as string | null | undefined)?.trim()).length;
  const summary = {
    look: look ? `${look.summary}${currentOrg.heroBannerUrl ? ` · ${W.lookSummaryBanner}` : ''}` : '',
    home: W.homeSummary(shownSections.length, shownSections[0]?.name ?? null),
    about: W.aboutSummary([
      content?.tagline?.trim() || W.aboutNoTagline,
      content?.contactEmail?.trim() || W.aboutNoEmail,
      ...(socials ? [W.socialCount(socials)] : []),
    ]),
    lists: W.listsSummary(counts.contacts, counts.documents, counts.questions, sponsorFacts.total, sponsorFacts.ended),
    visibility: W.visibilitySummary(on, currentOrg.isDiscoverable, noun),
    coaches: coachNamesChoiceName(sanitizeCoachNamesPolicy(currentOrg.coachNamesPolicy)),
  };
  // Team pages are a Club feature: the sixth row is absent (never locked) without Rep teams.
  const showCoachNames = hasModuleEntitlement(currentOrg, 'module_rep_teams');

  const textField = (key: TextKey, label: string, opts: { placeholder?: string; hint?: ReactNode; area?: boolean; inputType?: string; pastYear?: boolean }) => {
    const id = `site-${key}`;
    const value = typed[key];
    const error = shown[key] ? refused[key] : undefined;
    const yearHint = opts.pastYear ? pastYearHint(value, thisYear) : null;
    const savedHint = !error && savedAs[key] !== undefined ? savedAsHint(value, savedAs[key] ?? null) : null;
    return (
      <label className={error ? `${ck.field} ${styles.refusedField}` : ck.field} htmlFor={id}>
        <span className={ck.label}>{label}</span>
        {opts.area ? (
          <textarea id={id} className={ck.textarea} rows={5} value={value} maxLength={SITE_FIELD_MAX[key]} placeholder={opts.placeholder}
            disabled={!canWrite} onChange={e => type(key, e.target.value)} onBlur={() => reveal([key])} aria-invalid={!!error || undefined} />
        ) : (
          <input id={id} className={ck.input} value={value} maxLength={SITE_FIELD_MAX[key]} placeholder={opts.placeholder} type={opts.inputType ?? 'text'}
            disabled={!canWrite} onChange={e => type(key, e.target.value)} onBlur={() => { reveal([key]); if (pending.current[key] !== undefined) flush(); }}
            aria-invalid={!!error || undefined} />
        )}
        {error && <p className={styles.fieldError} role="alert">{error}</p>}
        {yearHint && <p className={styles.yearHint}>{yearHint}</p>}
        {savedHint && <p className={ck.hint}>{savedHint}</p>}
        {opts.hint != null && <p className={ck.hint}>{opts.hint}</p>}
      </label>
    );
  };

  const listPart = (kind: ListKind) => {
    // Read as plain rows: a list's words (title, caption) are keyed by its own field names.
    const items = (content?.[kind] ?? []) as unknown as (Record<string, string> & { id: string })[];
    const { words: w, title, caption, row } = LISTS[kind];
    return (
      <div className={styles.listPart} id={kind}>
        <h3 className={styles.lookPartTitle}>{w.title}</h3>
        <p className={styles.lead}>{w.lead}</p>
        {items.length > 0 && (
          <ClubRowList inset label={w.title}>
            {items.map(i => (
              <ClubRow key={i.id} as="button" aria-haspopup="dialog" chevron onClick={() => setOpenRecord({ kind, id: i.id })}
                title={title(i)} caption={caption(i, today)} {...row?.(i, today)} />
            ))}
          </ClubRowList>
        )}
        {/* The foot: Add, or — at the list's cap — why not. */}
        {canWrite && (
          <div className={styles.listFoot}>
            {items.length < LIST_MAX[kind]
              ? <button type="button" className="btn btn-outline btn-data" onClick={() => setOpenRecord({ kind, id: 'new' })} aria-haspopup="dialog">{w.add}</button>
              : <p className={styles.listFull}>{W.listFull(LIST_MAX[kind], kind)}</p>}
          </div>
        )}
      </div>
    );
  };

  const open = openRecord ? ((content?.[openRecord.kind] ?? []) as AnyItem[]).find(i => i.id === openRecord.id) ?? null : null;

  return (
    <div className={repKit.page}>
      {header}

      <div className={styles.builder}>
        <div className={styles.builderRows}>
          {/* Only those who can post see it, and only while there is someone to tell (A7). */}
          {canWrite && on && (
            <ClubNoticeStrip notice={notice} orgSlug={orgSlug} onChange={n => { setNotice(n); redraw(); }}
              open={noticeOpen} onOpen={() => setNoticeOpen(true)} onClose={() => setNoticeOpen(false)} />
          )}

          {setup && (
            <section className={styles.setup} aria-labelledby="setup-title">
              <div className={styles.setupHead}>
                <div className={styles.setupText}>
                  <h2 id="setup-title" className={styles.setupTitle}>{W.setupTitle}</h2>
                  <p className={styles.lead}>
                    {!on && !isOwner ? `${ready.ready} of ${ready.of} ready. ${W.setupLeadAdmin}` : on ? W.setupLeadOnline(ready.ready, ready.of) : W.setupLeadOffline(ready.ready, ready.of)}
                  </p>
                </div>
                {!on && isOwner && (
                  <button type="button" className="btn btn-lime" onClick={() => void goLive()} disabled={goingLive}>
                    <Globe size={15} aria-hidden /> {goingLive ? W.goingLive : W.goLive}
                  </button>
                )}
              </div>
              <div className={styles.segments} role="img" aria-label={`${ready.ready} of ${ready.of}`}>
                {Array.from({ length: ready.of }, (_, i) => <span key={i} className={i < ready.ready ? styles.segmentDone : styles.segment} />)}
              </div>
            </section>
          )}

          <BuilderRow id="look" title={W.look} summary={summary.look} mark={mark(ready.look)} open={rowOpen === 'look'} onToggle={() => toggle('look')}>
            <LookPanel org={currentOrg} orgSlug={orgSlug} run={lookQ.run} onChanged={lookChanged} readOnly={!canWrite} />
          </BuilderRow>

          <BuilderRow id="home-page" title={W.homePage} summary={summary.home} mark={mark(ready.home)} open={rowOpen === 'home'} onToggle={() => toggle('home')}>
            <p className={styles.lead}>{W.homeLead}</p>
            <ul className={styles.sectionRows} aria-label={W.homePage}>
              {/* Open now is in the list, fixed: its number is the handle's box at rest, and nothing moves onto it. */}
              <ReorderList ids={rows.map(r => r.key)} names={rows.map(r => r.name)} onMove={moveSection}
                fixed={rows.filter(r => r.locked).map(r => r.key)} fixedInert disabled={!canWrite}>
                {rows.map(r => (
                  <ReorderRow key={r.key} id={r.key} number>
                    {({ handle, itemRef, itemStyle }) => (
                      <li ref={itemRef} style={itemStyle} className={styles.sectionRow}>
                        <span className={styles.handleSlot}>{handle}</span>
                        {r.locked ? (
                          <>
                            <span className={styles.sectionText}>
                              <span className={styles.sectionName}>{r.name}</span>
                              <span className={styles.sectionSub}>
                                <span className={styles.subDesk}>{r.sub}</span>
                                <span className={styles.subPhone}>{W.openNowPhoneSub}</span>
                              </span>
                            </span>
                            <span className={styles.sectionWord}>{W.alwaysFirst}</span>
                          </>
                        ) : (
                          <span className={styles.sectionSwitch}>
                            <SwitchButton on={r.shown} name={r.name} caption={r.sub} onToggle={() => toggleSection(r.key as SiteSectionKey)} disabled={!canWrite} />
                          </span>
                        )}
                      </li>
                    )}
                  </ReorderRow>
                ))}
              </ReorderList>
            </ul>
          </BuilderRow>

          <BuilderRow id="about" title={W.aboutCard} summary={summary.about} mark={mark(ready.about)} open={rowOpen === 'about'} onToggle={() => toggle('about')}>
            {textField('tagline', W.tagline, { placeholder: W.taglinePlaceholder, hint: W.taglineHint(typed.tagline.length, SITE_FIELD_MAX.tagline), pastYear: true })}
            {textField('description', W.about, { placeholder: W.aboutPlaceholder, hint: W.aboutHint(typed.description.length, SITE_FIELD_MAX.description), area: true, pastYear: true })}
            {textField('contactEmail', W.questionsGoTo, { placeholder: W.questionsGoToPlaceholder, hint: W.questionsGoToHint, inputType: 'email' })}
            <h3 className={styles.lookPartTitle} id="social">{W.social}</h3>
            {SOCIAL.map(s => <div key={s.key}>{textField(s.key, s.label, { placeholder: s.placeholder, inputType: 'url' })}</div>)}
          </BuilderRow>

          <BuilderRow id="lists" title={W.lists} summary={summary.lists} mark={mark(ready.lists)} open={rowOpen === 'lists'} onToggle={() => toggle('lists')}>
            {listPart('contacts')}
            {listPart('documents')}
            {listPart('questions')}
            {listPart('sponsors')}
          </BuilderRow>

          {showCoachNames && (
            <BuilderRow id="coaches" title={CW.rowTitle} summary={summary.coaches} open={rowOpen === 'coaches'} onToggle={() => toggle('coaches')}>
              <CoachNamesPanel orgSlug={orgSlug} policy={sanitizeCoachNamesPolicy(currentOrg.coachNamesPolicy)} isOwner={isOwner} onSave={saveCoachNames} />
            </BuilderRow>
          )}

          <BuilderRow id="visibility" title={W.visibility} summary={summary.visibility} open={rowOpen === 'visibility'} onToggle={() => toggle('visibility')}>
            <VisibilityPanel orgSlug={orgSlug} clubName={currentOrg.name} noun={noun} address={shownAddress}
              on={on} listed={currentOrg.isDiscoverable} isOwner={isOwner}
              onSwitch={async body => {
                await orgPatch(body);
                if (body.isPublic === false) setNoticeOpen(false);
                setTold(body.isPublic === true ? W.nowOnline : body.isPublic === false ? W.nowOffline : body.isDiscoverable ? W.nowListed : W.nowUnlisted);
              }} />
          </BuilderRow>
        </div>

        {/* The preview stands beside the rows at a desk (A1); the owner's and admins' only — the page asks the same. */}
        {canWrite && wide && (
          <aside className={styles.builderPreview} aria-label={W.preview}>
            <SitePreview orgSlug={orgSlug} version={version} online={on} onEdit={editFromPreview} />
          </aside>
        )}
      </div>

      {/* One pill for the three queues. Retry replays the failed one (the typed fields were put back when their save
          failed, so they are sent again — once, never twice). */}
      <SavePill saving={typedQ.saving || sectionQ.saving || lookQ.saving || coachNamesSave.saving} dirty={waiting} error={lookQ.error ?? sectionQ.error ?? typedQ.error ?? coachNamesSave.error}
        onRetry={() => (lookQ.error ? lookQ.retry() : sectionQ.error ? sectionQ.retry() : typedQ.error ? flush() : coachNamesSave.error && coachNamesSave.last ? void saveCoachNames(coachNamesSave.last).catch(() => undefined) : flush())} />
      {told && <NoticePill message={told} onDone={() => setTold(null)} />}

      {/* The window is for a narrow window only: widened past the desk width the preview stands beside the rows. */}
      {previewOpen && !wide && (
        <KitDialog kind="form" size="wide" title={W.preview} onClose={() => setPreviewOpen(false)}>
          <div className={styles.previewWindow}>
            <SitePreview orgSlug={orgSlug} version={version} online={on} onEdit={editFromPreview} startOn="phone" />
          </div>
        </KitDialog>
      )}

      {openRecord && (openRecord.id === 'new' || open) && (
        <SiteListRecord
          key={`${openRecord.kind}-${openRecord.id}`}
          item={open as (Record<string, string> & { id: string }) | null}
          list={LISTS[openRecord.kind]}
          canWrite={canWrite}
          thisYear={thisYear}
          onUploadLogo={uploadSponsorLogo}
          onDiscardLogo={discardSponsorLogo}
          onSave={async values => {
            const kind = openRecord.kind;
            const items = (content?.[kind] ?? []) as AnyItem[];
            const next = openRecord.id === 'new'
              ? [...items, values]
              : items.map(i => (i.id === openRecord.id ? { ...i, ...values, id: i.id } : i));
            await saveList(kind, next as AnyItem[], openRecord.id === 'new' ? LISTS[kind].words.saved : null);
          }}
          onRemove={async () => {
            const kind = openRecord.kind;
            const items = (content?.[kind] ?? []) as AnyItem[];
            await saveList(kind, items.filter(i => i.id !== openRecord.id), LISTS[kind].words.removed);
          }}
          onClose={() => setOpenRecord(null)}
        />
      )}
    </div>
  );
}
