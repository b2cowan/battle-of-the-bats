'use client';
import { use, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { canManageAwards } from '@/lib/coach-capabilities';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import { formatStoredDate } from '@/lib/timezone';
import { awardTypeLabel } from '@/lib/rep-award-occasion';
import type { RepPlayerAward } from '@/lib/types';
import styles from '../../../../../coaches.module.css';
import CoachLoading from '@/components/coaches/CoachLoading';
import cert from './certificate.module.css';

/** True once in the browser — the print copy portals to <body>, which the server does not have. */
const noSubscribe = () => () => {};

/**
 * Printable award certificates (Chunk D slice 3, item 3.4 / S8).
 *
 * Two clicks from the awards history the coach already keeps: pick an award (or a whole award
 * type, for awards night), print. Zero new data capture — it prints what awards night already
 * decided.
 *
 * ⚠ THIS IS THE ONE FAMILY-FACING SURFACE THAT CARRIES A PLAYER'S FULL NAME, and it is the
 * approved exception (§8.2): the medium is paper handed over by a coach, not a URL. The page
 * itself is behind the coach's awards permission and is never linked from anything a family
 * can reach. The keepsake card — the artifact designed to leave the app — stays first name
 * and jersey only. Do not "reuse" this page's naming anywhere else.
 *
 * No new API: it reads the awards endpoint the report beside it already uses, so a coach who
 * can see the report can print from it and nobody else can.
 *
 * ⚠⚠ WHAT REACHES THE PAPER IS A COPY OF THE CERTIFICATES AND NOTHING ELSE (owner, 2026-09-25 —
 * "the certificate printing is pretty awful"). The page sits inside the coaches portal's shell, and
 * its print rules only ever hid its own toolbar: two certificates came out on FOUR sheets — the
 * sidebar and the team header alone on the first, the shell's header across the top of every sheet
 * (cutting off the frame's top edge), each certificate pushed right by the sidebar's width, and a
 * blank last page. The fix does not chase the shell's classes, which change with every shell
 * ruling: the certificates are ALSO rendered into a print copy portalled straight onto <body>, and
 * in print every other child of <body> leaves the page (`certificate.module.css`). One sheet per
 * certificate, Letter landscape, at the paper's size in inches and points. The screen keeps its
 * preview in the shell, as before.
 */
export default function AwardCertificatePage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);

  const searchParams = useSearchParams();
  const awardId = searchParams.get('awardId');
  const typeId = searchParams.get('typeId');
  /**
   * ⚠⚠ THE LEVEL BELOW THE DOOR, which is where this rail's expensive defects have always been.
   *
   * Archive rail Phase 2 made the awards report an archive door; this page is one step past it and
   * had THREE ways to answer with the wrong season — it gated on the live assignment (so a coach
   * with no live one could not print at all), it fetched awards with no year, and it printed
   * `assignment.programYearName` onto the certificate, which would have put THIS year's season name
   * on paper handed to a child for an award won in a previous one. Paper does not get a second
   * chance to be right.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const caps = page.capabilities;

  const [awards, setAwards] = useState<RepPlayerAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAwards((data.awards ?? []) as RepPlayerAward[]);
    } catch {
      setError('Those awards couldn’t be loaded — go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (ctxLoading) return;
    void Promise.resolve().then(() => load());
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ THAT season's grant (rule 1) and `hasAccess`, not the live assignment — a coach printing
  // 2024's certificates may hold no live assignment at all.
  if (!page.hasAccess || !caps || !canManageAwards(caps)) {
    return (
      <div className={styles.notAssigned}>
        <h2>No access</h2>
        <p>You don’t have access to awards for this team.</p>
      </div>
    );
  }

  // One award, or every award of one type — the two ways a coach actually prints these.
  const selected = awardId
    ? awards.filter(a => a.id === awardId)
    : typeId
      ? awards.filter(a => a.awardTypeId === typeId)
      : [];

  // The team's own colour is the certificate's frame. Falls back to the platform primary via
  // the same token the rest of the portal uses, so a colourless team still prints deliberately.
  const certColor = currentOrg?.themePrimary || 'var(--platform-primary)';

  const sheet = (a: RepPlayerAward) => (
    <div
      key={a.id}
      className={cert.sheet}
      style={{ ['--cert-color' as string]: certColor }}
    >
      <span className={cert.org}>{currentOrg?.name ?? ''}</span>
      <h1 className={cert.award}>
        {awardTypeLabel(a.awardType)}
      </h1>
      <span className={cert.to}>presented to</span>
      <p className={cert.kid}>{a.playerName}</p>
      {/* ⚠ THE SEASON PRINTED HERE IS THE ONE THE AWARD WAS WON IN, not the one running
          today. This read `assignment.programYearName` — the coach's CURRENT season — which
          on a certificate for a past year's award is a wrong fact on paper handed to a
          child. `page.programYearName` resolves the season on screen.
          ⚠ The date is the house formatter's, month in full ("May 14"): the old browser-locale
          one printed "14 May" for one coach and "May 14" for the next (2026-09-25). */}
      <span className={cert.meta}>
        {[page.teamName, page.programYearName, formatStoredDate(a.awardedAt, { withYear: false, longMonth: true })]
          .filter(Boolean).join(' · ')}
      </span>
      {/* The coach's own words about this award, when they wrote any. Absent otherwise —
          never a filler line. */}
      {a.note && <span className={cert.note}>“{a.note}”</span>}
      <span className={cert.signature}>Coach</span>
    </div>
  );

  return (
    <div className={cert.screen}>
      <div className={cert.bar}>
        {/* ⚠ THE THIRD AND LAST SURVIVING `CoachBackLink` (back-in-header amendment, 2026-08-26).
            This is a PRINT surface, not a drill-in: it has never rendered a page header, and its
            way out lives in this print toolbar beside the Print button — the same reasoning that
            leaves the game bench console and practice run mode on their own back treatments.
            ⚰ The "Letter, landscape — turn on background graphics…" note is gone (owner,
            2026-09-25): the page now sets the paper itself, and the frame is a border, which
            prints without the background-graphics setting. */}
        <CoachBackLink href={insightsSectionHref(base, 'awards')}>Awards</CoachBackLink>
        <button type="button" className={`${styles.btnPrimary} ${styles.tapFloor} ${cert.printBtn}`} onClick={() => window.print()} disabled={selected.length === 0}>
          <Printer size={14} aria-hidden /> Print {selected.length > 1 ? `${selected.length} certificates` : 'certificate'}
        </button>
      </div>

      {loading ? (
        <CoachLoading label="Loading the awards…" />
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : selected.length === 0 ? (
        <p className={styles.detailPlaceholder}>
          Nothing to print — pick an award from the awards report.
        </p>
      ) : (
        selected.map(sheet)
      )}

      {/* THE PRINT COPY — the same sheets, straight onto <body>, where nothing of the shell can sit
          beside them. Hidden on screen; in print it is the only thing on the paper. The page size
          rides with it, so it applies only while this page is mounted. */}
      {inBrowser && !loading && !error && selected.length > 0 && createPortal(
        <div className={cert.printCopy} data-certificate-print>
          {/* margin 0: the browser's own header and footer (date, title, address, page number) print
              IN the page margin, so a page with none has nowhere to put them */}
          <style>{'@page { size: 11in 8.5in; margin: 0; }'}</style>
          {selected.map(a => <div key={a.id} className={cert.printPage}>{sheet(a)}</div>)}
        </div>,
        document.body,
      )}
    </div>
  );
}
