'use client';

/**
 * J1-080 — Day-of Staff kit. One screen that hands out the two volunteer surfaces (Scorekeeper + Gate)
 * as QR codes + copy-links, and a printed page of its own for the volunteer table. Aggregates links and
 * screens that already exist; volunteers still authenticate on landing.
 *
 * Tournament admin redesign Stage 6, V7 (ruled 2026-10-07; F65):
 *   · the title band every Stage 1 page wears — "Staff kit", Print the boxed 44px icon on a phone and the
 *     white button at a desk (it was the retired grey button); one sentence under it (it was four lines);
 *   · two cards, each its QR code (dark on a FIXED white square in both themes — scanners), one line, the
 *     link breaking only at a slash (it broke "scorekeep / er"), Copy link (an action: the white button)
 *     and Open (a door: olive text, a new tab);
 *   · "Invite a volunteer" — a door to Members' invite with the volunteer role chosen (A26). The closing
 *     paragraph it replaces named a path in another spelling than the rail's, a role that no longer
 *     exists by that name, and a promise the product kept only for existing accounts (F62);
 *   · a PRINTED PAGE of its own (Letter, one page): the club, the event and its dates, the two codes at
 *     210px with their links, three steps, a footer — nothing of the admin. It printed the rail, the strip
 *     and the event header around the codes (Summary's J1-110 again). Summary's printed page and this one
 *     share one frame (`PrintedPage`): a copy portalled to <body>, hidden on screen, the only thing on paper.
 */

import { useState, useEffect, useCallback, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ClipboardList, ScanLine, Check, Copy, Printer, ExternalLink, ChevronRight } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability } from '@/lib/roles';
import { getMembersHref } from '@/lib/billing-urls';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import { STAFF_KIT_WORDS } from '@/lib/volunteer-words';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import PrintedPage from '@/components/admin/tournament/PrintedPage';
import styles from './staff-kit.module.css';

type SurfaceKey = 'scorekeeper' | 'gate';
type Surface = { key: SurfaceKey; path: string; icon: ReactNode };

const SURFACES: Surface[] = [
  { key: 'scorekeeper', path: 'scorekeeper', icon: <ScanLine size={16} aria-hidden /> },
  { key: 'gate', path: 'check-in', icon: <ClipboardList size={16} aria-hidden /> },
];

const noSubscribe = () => () => {};

/** "fieldlogichq.ca/club/scorekeeper" with a break opportunity after each slash — and nowhere else. */
function BreakAtSlash({ text }: { text: string }) {
  const parts = text.split('/');
  return <>{parts.map((part, i) => (i < parts.length - 1 ? <span key={i}>{part}/<wbr /></span> : <span key={i}>{part}</span>))}</>;
}

export default function StaffKitPage() {
  usePageTitle(STAFF_KIT_WORDS.title);
  const { currentTournament, loading } = useTournament();
  const { currentOrg, userRole, userCapabilities, canOpen } = useOrg();
  // The links are this browser's own address — read only once there is a window.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);

  const [qr, setQr] = useState<Partial<Record<SurfaceKey, string>>>({});
  const [copied, setCopied] = useState<SurfaceKey | null>(null);

  // Absolute URLs are resolved on the client (we need window.location.origin).
  const origin = inBrowser ? window.location.origin : '';
  const host = inBrowser ? window.location.host : '';
  const urlFor = useCallback(
    (path: string) => (currentOrg ? `${origin}/${currentOrg.slug}/${path}` : ''),
    [origin, currentOrg],
  );

  useEffect(() => {
    if (!currentOrg || !origin) return;
    let cancelled = false;
    (async () => {
      const next: Partial<Record<SurfaceKey, string>> = {};
      for (const surface of SURFACES) {
        try {
          next[surface.key] = await QRCode.toDataURL(urlFor(surface.path), {
            width: 420,
            margin: 1,
            // Dark on light for scanners, in both themes — the square they sit on is fixed white too.
            color: { dark: '#0a0a0a', light: '#ffffff' },
          });
        } catch {
          /* leave missing — the copy-link still works */
        }
      }
      if (!cancelled) setQr(next);
    })();
    return () => { cancelled = true; };
  }, [currentOrg, origin, urlFor]);

  const copy = useCallback(async (key: SurfaceKey, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      /* clipboard blocked — user can still read the URL */
    }
  }, []);

  // The door to Members' invite, the volunteer role chosen (A26) — only for someone who may invite.
  const canInvite = !!userRole && canOpen('module_members') && hasCapability(userRole, userCapabilities, 'manage_members');
  const inviteHref = currentOrg ? `${getMembersHref(currentOrg.slug, currentOrg.planId)}?invite=volunteer` : null;
  /** "fieldlogichq.ca/club/scorekeeper" — the link as the card and the printed page show it. */
  const displayUrl = (path: string) => (currentOrg ? `${host}/${currentOrg.slug}/${path}` : '');

  const ready = Boolean(currentTournament && currentOrg);
  const W = STAFF_KIT_WORDS;

  return (
    <div className={styles.page}>
      <AdminPageHeader
        inlineActions
        title={W.title}
        actions={ready ? (
          <button
            type="button"
            className={`${screenParts.plainButton} ${screenParts.headerButton}`}
            onClick={() => window.print()}
            aria-label={W.print}
            title={W.print}
          >
            <Printer size={15} aria-hidden />
            <span className={screenParts.headerButtonLabel}>{W.print}</span>
          </button>
        ) : undefined}
      />

      {!loading && !currentTournament && <p className={styles.empty}>{W.noEvent}</p>}

      {ready && currentOrg && (
        <>
          <p className={styles.intro}>{W.intro}</p>

          <div className={styles.grid}>
            {SURFACES.map(surface => {
              const url = urlFor(surface.path);
              const card = W.card[surface.key];
              return (
                <section key={surface.key} className={styles.card} aria-labelledby={`staff-kit-${surface.key}`}>
                  <div className={styles.cardHead}>
                    {surface.icon}
                    <div>
                      <h2 id={`staff-kit-${surface.key}`} className={styles.cardTitle}>{card.title}</h2>
                      <p className={styles.cardBlurb}>{card.blurb}</p>
                    </div>
                  </div>

                  <div className={styles.qrWrap}>
                    {qr[surface.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr[surface.key]} alt={`QR code linking to the ${card.title} screen`} className={styles.qr} />
                    ) : (
                      <div className={styles.qrPlaceholder} aria-hidden />
                    )}
                  </div>

                  <p className={styles.url}><BreakAtSlash text={displayUrl(surface.path)} /></p>

                  <div className={styles.cardFoot}>
                    <button type="button" className={screenParts.plainButton} onClick={() => copy(surface.key, url)} aria-label={`${W.copy}: ${card.title}`}>
                      {copied === surface.key ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                      <span>{copied === surface.key ? W.copied : W.copy}</span>
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.door} aria-label={`${W.open}: ${card.title} (opens in a new tab)`}>
                      {W.open}
                      <ExternalLink size={16} aria-hidden />
                    </a>
                  </div>
                </section>
              );
            })}
          </div>

          {canInvite && inviteHref && (
            <Link href={inviteHref} className={styles.door}>
              {W.invite}
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}

          {currentTournament && (
            <PrintedKit
              club={currentOrg.name}
              event={currentTournament.name}
              dates={formatEventDateRange(currentTournament.startDate, currentTournament.endDate, true)}
              displayUrl={displayUrl}
              qr={qr}
            />
          )}
        </>
      )}
    </div>
  );
}

/** The printed page for the volunteer table: hidden on screen; in print, the only thing on the paper. */
function PrintedKit({ club, event, dates, displayUrl, qr }: {
  club: string;
  event: string;
  dates: string | null;
  displayUrl: (path: string) => string;
  qr: Partial<Record<SurfaceKey, string>>;
}) {
  const W = STAFF_KIT_WORDS;
  return (
    <PrintedPage
      name="staff-kit"
      eyebrow={W.printEyebrow(club)}
      title={event}
      dates={dates}
      foot={<><span>FieldLogicHQ</span><span>{W.printedOn(formatStoredDate(tournamentToday()))}</span></>}
    >
      <div className={styles.paperCodes}>
        {SURFACES.map(surface => {
          const card = W.card[surface.key];
          return (
            <div key={surface.key} className={styles.paperCode}>
              <h2>{card.title}</h2>
              <p>{card.blurb}</p>
              {qr[surface.key]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qr[surface.key]} alt="" className={styles.paperQr} />
                : <div className={styles.paperQr} aria-hidden />}
              <code>{displayUrl(surface.path)}</code>
            </div>
          );
        })}
      </div>
      <ol className={styles.paperSteps}>
        {W.steps.map(step => <li key={step}>{step}</li>)}
      </ol>
    </PrintedPage>
  );
}
