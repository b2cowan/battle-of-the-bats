'use client';
/**
 * ORGANIZATION SETTINGS on the kit (Club Tier Stage 1, screens session; specimen 9 "the decisions only"). Owner only.
 *
 * ⚖ SINCE THE PUBLIC SITE BUILDER (ruled 2026-10-21, Option A): everything families see moved to Public site — the
 * site's on/off switch and directory listing (the Visibility row, still the owner's), and the logo, colours, banner and
 * type (the Look row, the owner's OR an admin's). Card style left the club's controls (A5): only tournament pages wear
 * it, and each tournament picks its own on its Branding page (the saved club value stays their fallback).
 *
 * What stays here is what changes the club everywhere, not only on its site: its NAME and its WEB ADDRESS (changing it
 * breaks every link families saved), with the one Save and its unsaved-changes guard; a door card to Public site for
 * the owner who comes here out of habit; and the deletion request.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Globe } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { stepOf } from '@/components/coaches/backStep';
import KitDialog from './KitDialog';
import BirthdayCutoffCard, { loadBirthdayCutoffs, type CardData } from './BirthdayCutoffCard';
import PayoutsCard, { loadPayouts, type PayoutsView } from './PayoutsCard';
import PageNotice, { useNotice } from './PageNotice';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import { cleanSlugInput } from '@/lib/slug';
import LoadingState from '@/components/shared/LoadingState';
import { possessive } from '@/lib/utils';

interface OrgSettings {
  name: string;
  slug: string;
}

export default function SettingsKit() {
  const router = useRouter();
  const { currentOrg, userRole, loading, refresh } = useOrg();
  usePageTitle('Settings');
  const slug = currentOrg?.slug ?? '';
  const orgQuery = slug ? `?orgSlug=${encodeURIComponent(slug)}` : '';

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [cutoffData, setCutoffData] = useState<CardData | null>(null);
  // Payouts (Club Tier Stage 12a): null while online payments aren't offered here — the card then stays away.
  const [payouts, setPayouts] = useState<PayoutsView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [urlSlug, setUrlSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useNotice();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSending, setDeleteSending] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // The club's own web address, only while it is handed out (Club Tier Stage 4e): the field's hint then names it. A plan
  // without the Public site, or a failed read, simply leaves today's hint.
  const [ownAddress, setOwnAddress] = useState<string | null>(null);

  function adopt(data: OrgSettings) {
    setSettings(data);
    setName(data.name);
    setUrlSlug(data.slug);
  }

  useEffect(() => {
    if (!orgQuery) return;
    let stale = false;
    // The birthdays and Payouts cards read with the settings and the page waits for all three, so every card shows at once.
    Promise.all([
      fetch(`/api/admin/org-settings${orgQuery}`).then(r => (r.ok ? r.json() : Promise.reject(new Error()))),
      loadBirthdayCutoffs(orgQuery),
      loadPayouts(slug),
    ])
      .then(([d, cutoffs, payoutsView]: [OrgSettings, CardData | null, PayoutsView | null]) => {
        if (!stale) { adopt(d); setCutoffData(cutoffs); setPayouts(payoutsView); }
      })
      .catch(() => { if (!stale) setLoadFailed(true); });
    return () => { stale = true; };
  }, [orgQuery, slug]);

  useEffect(() => {
    if (!orgQuery) return;
    let stale = false;
    fetch(`/api/admin/public-site/own-address${orgQuery}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { connection?: { fullName: string; status: string } | null } | null) => {
        if (!stale) setOwnAddress(d?.connection && (d.connection.status === 'connected' || d.connection.status === 'needs_attention') ? d.connection.fullName : null);
      })
      .catch(() => { if (!stale) setOwnAddress(null); });
    return () => { stale = true; };
  }, [orgQuery]);

  const isDirty = !!settings && (name !== settings.name || urlSlug !== settings.slug);

  // The unsaved-changes guard — today's, kept: a refresh or tab close asks the browser's question; a
  // link or Back inside the app asks ours.
  useEffect(() => {
    if (!isDirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      // A click already answered leaves nothing — a plan lock opening its panel over this page (PlanPanelHost).
      if (e.defaultPrevented) return;
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
    // stack answers the same popstate and, closing a window, puts that window's entry back (a push until
    // 2026-10-09; a step forward since, which lands here as a popstate of its own — ignored below) —
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
      // ⚠ A landing on a WINDOW's entry is the Back stack's own (2026-10-09): it answers a Back pressed in a window by
      // stepping forward onto the window's entry again (`useBackStep`'s header) — never a Back on this page.
      if (stepOf(e.state) !== null) return;
      window.history.pushState(GUARD_ENTRY, '', window.location.href);
      // Back while another window is open (the deletion
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

  if (loading || !currentOrg || !userRole) return <LoadingState label="Loading the settings…" />;

  if (userRole !== 'owner') {
    return (
      <div className={ck.page}>
        <AdminPageHeader eyebrow="Organization" title="Settings" />
        <div className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>Settings are the owner’s</h2>
          <p className={styles.lockedBody}>Only {possessive(currentOrg.name)} owner can change the organization’s name and address.</p>
        </div>
      </div>
    );
  }

  async function patch(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(`/api/admin/org-settings${orgQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, data };
  }

  async function saveAll(): Promise<boolean> {
    if (!settings || saving) return false;
    setSaving(true);
    try {
      const { ok, data } = await patch({ name, slug: urlSlug });
      if (!ok) throw new Error(typeof data.error === 'string' ? data.error : 'Save failed.');
      setSettings(s => (s ? { ...s, name, slug: urlSlug } : s));
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

  return (
    <div className={ck.page}>
      <AdminPageHeader eyebrow="Organization" title="Settings" />

      {notice && <PageNotice notice={notice} />}
      {loadFailed && (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>The settings didn’t load. Refresh the page to try again.</div>
        </div>
      )}
      {!settings && !loadFailed && <LoadingState label="Loading the settings…" />}

      {settings && (
        <>
          {/* ── Organization details ──────────────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="settings-details">
            <h2 id="settings-details" className={styles.cardTitle}>Organization details</h2>
            <div className={ck.field}>
              <label className={ck.label} htmlFor="settings-name">Organization name<span className={ck.required} aria-hidden>*</span></label>
              <input id="settings-name" className={ck.input} value={name} onChange={e => setName(e.target.value)} required maxLength={40} />
              <p className={ck.hint}>Shown in the navigation bar and on public pages. {name.length} / 40</p>
            </div>
            <div className={ck.field}>
              {/* One name on both sides (Stage 5 addendum, A75): "Web address", as Settings & access says it. */}
              <label className={ck.label} htmlFor="settings-slug">{WA.name}<span className={ck.required} aria-hidden>*</span></label>
              <input
                id="settings-slug"
                className={ck.input}
                value={urlSlug}
                onChange={e => setUrlSlug(cleanSlugInput(e.target.value))}
                required
                maxLength={60}
                pattern="[a-z0-9-]+"
              />
              {urlSlug !== settings.slug ? (
                <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
                  <AlertTriangle size={15} aria-hidden />
                  <div className={ck.noticeBody}>{ownAddress ? WA.clubWarningOwn(ownAddress, settings.slug) : WA.clubWarning}</div>
                </div>
              ) : (
                <p className={ck.hint}>{ownAddress ? WA.clubHintOwn(ownAddress, settings.slug) : WA.clubHint}</p>
              )}
            </div>
          </section>

          {/* ── The one Save (the name and the web address) ──────────────────────────── */}
          <div className={styles.saveBar}>
            {isDirty && <span className={styles.unsaved}>Unsaved changes</span>}
            {isDirty && <button type="button" className="btn btn-ghost" onClick={discard} disabled={saving}>Discard</button>}
            <button type="button" className="btn btn-lime" onClick={() => void saveAll()} disabled={saving || !isDirty} id="settings-save-btn">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {/* ── When birthdays count from (Club Tier Stage 4c-2): saves by itself through the pill, apart from the Save above ── */}
          <BirthdayCutoffCard orgQuery={orgQuery} initial={cutoffData} />

          {/* ── Your public site: a door (Public site builder, 2026-10-21) — what families see moved there ── */}
          <section className={`${styles.card} ${styles.doorCard}`} aria-labelledby="settings-public-site">
            <Globe size={20} className={styles.doorIcon} aria-hidden />
            <div className={styles.doorText}>
              <h2 id="settings-public-site" className={styles.cardTitle}>Your public site</h2>
              <p className={ck.hint}>Its logo, colours, type, and whether it is online are set in Public site.</p>
            </div>
            <Link href={`/${slug}/admin/public-site`} className="btn btn-outline">Open Public site</Link>
          </section>

          {/* ── Payouts: the club's own Stripe account (Club Tier Stage 12a) — after the public-site door, before Delete ── */}
          {payouts && <PayoutsCard orgSlug={slug} clubName={currentOrg?.name ?? ''} home="club" initial={payouts} />}

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
