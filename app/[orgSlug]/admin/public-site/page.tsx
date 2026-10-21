'use client';
/**
 * PUBLIC SITE — the club's own site, run by the club (Club Tier Stage 4c-1; drawings ruled 2026-10-19, section 6 and the
 * round-2 cards, Asks 6, 10, 16; words CLUB_TIER_STAGE4C1_COPY.md, through /marketing and approved 2026-10-21).
 *
 *   header      "Public site" with its Online/Offline chip; "Families see it at" the address, Copy link, Open (absent
 *               while the site is off); the switch's home said in words each role can act on — it stays in Settings,
 *               owner only.
 *   Club notice one line at the top of every public page that ends by itself; NEVER autosaved (it tells families):
 *               Post notice, Update notice, End now.
 *   Home page   the home's sections in the club's order: hold and drag the number (no Reorder mode), a switch per row,
 *               each row saying what it shows; Open now always first; a section the plan does not carry absent.
 *   About       tagline, about, the families' contact; the past-year hint under the words.
 *   lists       Who to contact, Documents and policies, Questions families ask — each row a small window (one window).
 *   Social      a link typed without https:// is completed and says what was saved; a refused one says why, beside the
 *               field, and is never saved (F05).
 *   Look        read only: the colours in words, readability said, a darkened colour said.
 *
 * Every change saves itself with the floating pill (the 2026-10-01 settings standard): a choice at once, typing after a
 * pause, a waiting change sent as you leave. What left: "Page Content", "Display Options" (its two switches are rows
 * now), the bottom Save Changes, the typewriter titles, the old look.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { ClubRow, ClubRowList, ClubSection, LoadFailed, NoticePill, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
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
import {
  checkSiteField, Refused, LIST_MAX, SITE_FIELD_MAX, CONTACT_ROLE_MAX, DOCUMENT_HEADING_MAX, DOCUMENT_TITLE_MAX, QUESTION_MAX,
  ANSWER_MAX, type ListKind, type SiteTextField,
} from '@/lib/public-site-patch';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { ClubNotice, OrgPublicSiteContent, SiteContact, SiteDocument, SiteQuestion } from '@/lib/types';
import SiteListRecord, { type SiteList } from './SiteListRecord';
import ClubNoticeCard from './ClubNoticeCard';
import styles from './public-site.module.css';

type TextKey = SiteTextField;
const TEXT_KEYS = Object.keys(SITE_FIELD_MAX) as TextKey[];
const SOCIAL: { key: TextKey; label: string; placeholder: string }[] = [
  { key: 'socialInstagram', label: W.instagram, placeholder: 'https://instagram.com/yourclub' },
  { key: 'socialFacebook', label: W.facebook, placeholder: 'https://facebook.com/yourclub' },
  { key: 'socialX', label: W.x, placeholder: 'https://x.com/yourclub' },
  { key: 'socialWebsite', label: W.website, placeholder: 'https://yourclub.ca' },
];

/** The same object when it has no such key (so a state setter does not re-render for nothing), else a copy without it. */
function without<T extends object>(o: T, key: keyof T): T {
  if (!(key in o)) return o;
  const copy = { ...o };
  delete copy[key];
  return copy;
}

type AnyItem = SiteContact | SiteDocument | SiteQuestion;
/** Each About-page list: its fields, its words, and what its rows say. */
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
};

export default function PublicSitePage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgSlug = currentOrg?.slug ?? '';
  const query = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const canWrite = userRole === 'owner' || userRole === 'admin';
  const thisYear = new Date().getFullYear();

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

  // Two queues: the typed fields', and the section order's and switches'. A failed move is never cleared by a later,
  // unrelated typed save, and Retry replays the one that failed.
  const typedQ = useSaveQueue();
  const sectionQ = useSaveQueue();
  const [told, setTold] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<{ kind: ListKind; id: string | 'new' } | null>(null);

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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the club's site content is read once the club is known
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
  }, [patch, typedQ]);
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
    void sectionQ.run(async () => { await patch({ homeSectionOrder: order, homeSectionsHidden: hidden }); }, W.reorderFailed);
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
    if (word) setTold(word);
  };

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
  const settingsHref = `/${orgSlug}/admin/org/settings`;

  const header = (
    <>
      <AdminPageHeader
        title={W.title}
        titleChips={<span className={`${ck.chip} ${on ? ck.chipGood : ck.chipWarn}`}>{on ? W.online : W.offline}</span>}
      />
      <div className={styles.siteHead}>
        {!on && <p className={styles.siteState}>{W.offLead} {isOwner ? <Link href={settingsHref} className={styles.siteStateLink}>{W.turnOn}</Link> : W.offAdmin}</p>}
        <div className={styles.addressRow}>
          <span className={styles.addressLabel}>{W.familiesSeeItAt}</span>
          <span className={styles.address}>{shownAddress}</span>
          <div className={styles.addressButtons}>
            <button type="button" className="btn btn-outline btn-data" onClick={() => copy(address)}>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? W.copied : W.copyLink}
            </button>
            {on && (
              <a href={address} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-data">
                <ExternalLink size={14} aria-hidden /> {W.open}
              </a>
            )}
            <span className={repKit.srOnly} aria-live="polite">{copied ? W.copied : ''}</span>
          </div>
        </div>
        {on && <p className={styles.siteState}>{isOwner ? <>{W.onOwner} <Link href={settingsHref} className={styles.siteStateLink}>{W.turnOff}</Link></> : W.onAdmin}</p>}
        {!canWrite && <p className={styles.siteState}>{W.readOnly}</p>}
      </div>
    </>
  );

  if (fetching) return <div className={repKit.page}>{header}<LoadingState label={W.loading} /></div>;
  if (loadError || !facts || !carries) {
    return <div className={repKit.page}>{header}<LoadFailed title={W.loadFailed} onRetry={() => void load()} /></div>;
  }

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

  const listCard = (kind: ListKind) => {
    // Read as plain rows: a list's words (title, caption) are keyed by its own field names.
    const items = (content?.[kind] ?? []) as unknown as (Record<string, string> & { id: string })[];
    const { words: w, title, caption } = LISTS[kind];
    return (
      <ClubSection id={kind} title={w.title} list>
        <p className={styles.listLead}>{w.lead}</p>
        {items.length > 0 && (
          <ClubRowList inset label={w.title}>
            {items.map(i => (
              <ClubRow key={i.id} as="button" aria-haspopup="dialog" chevron onClick={() => setOpenRow({ kind, id: i.id })}
                title={title(i)} caption={caption(i)} />
            ))}
          </ClubRowList>
        )}
        {/* The foot: Add, or — at the list's cap — why not (drawings ~L1981; copy table G–I). */}
        {canWrite && (
          <div className={styles.listFoot}>
            {items.length < LIST_MAX[kind]
              ? <button type="button" className="btn btn-outline btn-data" onClick={() => setOpenRow({ kind, id: 'new' })} aria-haspopup="dialog">{w.add}</button>
              : <p className={styles.listFull}>{W.listFull(LIST_MAX[kind], kind)}</p>}
          </div>
        )}
      </ClubSection>
    );
  };

  const open = openRow ? ((content?.[openRow.kind] ?? []) as AnyItem[]).find(i => i.id === openRow.id) ?? null : null;

  return (
    <div className={repKit.page}>
      {header}

      {/* Only those who can post see the card (copy table F: "A staff member without it: the card is absent"). */}
      {canWrite && <ClubNoticeCard notice={notice} orgSlug={orgSlug} onChange={setNotice} />}

      <ClubSection id="home-page" title={W.homePage} list>
        <p className={styles.listLead}>{W.homeLead}</p>
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
      </ClubSection>

      <ClubSection id="about" title={W.aboutCard}>
        {textField('tagline', W.tagline, { placeholder: W.taglinePlaceholder, hint: W.taglineHint(typed.tagline.length, SITE_FIELD_MAX.tagline), pastYear: true })}
        {textField('description', W.about, { placeholder: W.aboutPlaceholder, hint: W.aboutHint(typed.description.length, SITE_FIELD_MAX.description), area: true, pastYear: true })}
        {textField('contactEmail', W.questionsGoTo, { placeholder: W.questionsGoToPlaceholder, hint: W.questionsGoToHint, inputType: 'email' })}
      </ClubSection>

      {listCard('contacts')}
      {listCard('documents')}
      {listCard('questions')}

      <ClubSection id="social" title={W.social}>
        {SOCIAL.map(s => <div key={s.key}>{textField(s.key, s.label, { placeholder: s.placeholder, inputType: 'url' })}</div>)}
      </ClubSection>

      <ClubSection id="look" title={W.look}>
        <p className={styles.lead}>{isOwner ? W.lookLeadOwner : W.lookLeadAdmin}</p>
        {look && (
          <div className={styles.lookRow}>
            {currentOrg.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={currentOrg.logoUrl} alt="" className={styles.lookLogo} />
              : <span className={styles.swatch} style={{ background: look.roles.tile, color: look.roles.tileInk }} aria-hidden>{currentOrg.name.slice(0, 2).toUpperCase()}</span>}
            <span className={styles.swatch} style={{ background: look.roles.fill }} aria-hidden />
            <span className={styles.swatch} style={{ background: look.roles.accent }} aria-hidden />
            <span className={styles.lookText}>
              <span className={styles.sectionName}>{look.summary}</span>
              <span className={styles.sectionSub}>{look.readable}</span>
              {look.darkened && <span className={styles.sectionSub}>{look.darkened}</span>}
            </span>
            {isOwner
              ? <Link href={settingsHref} className={styles.siteStateLink}>{W.changeInSettings}</Link>
              : <span className={styles.sectionSub}>{W.ownerChanges}</span>}
          </div>
        )}
      </ClubSection>

      {/* One pill for both queues. Retry replays the failed section save, else sends the typed fields again (they were
          put back when their save failed) — once, never twice. */}
      <SavePill saving={typedQ.saving || sectionQ.saving} dirty={waiting} error={sectionQ.error ?? typedQ.error}
        onRetry={() => (sectionQ.error ? sectionQ.retry() : flush())} />
      {told && <NoticePill message={told} onDone={() => setTold(null)} />}

      {openRow && (openRow.id === 'new' || open) && (
        <SiteListRecord
          key={`${openRow.kind}-${openRow.id}`}
          item={open as (Record<string, string> & { id: string }) | null}
          list={LISTS[openRow.kind]}
          canWrite={canWrite}
          thisYear={thisYear}
          onSave={async values => {
            const kind = openRow.kind;
            const items = (content?.[kind] ?? []) as AnyItem[];
            const next = openRow.id === 'new'
              ? [...items, values]
              : items.map(i => (i.id === openRow.id ? { ...i, ...values, id: i.id } : i));
            await saveList(kind, next as AnyItem[], openRow.id === 'new' ? LISTS[kind].words.saved : null);
          }}
          onRemove={async () => {
            const kind = openRow.kind;
            const items = (content?.[kind] ?? []) as AnyItem[];
            await saveList(kind, items.filter(i => i.id !== openRow.id), LISTS[kind].words.removed);
          }}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  );
}
