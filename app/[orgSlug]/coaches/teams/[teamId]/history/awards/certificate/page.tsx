'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { canManageAwards } from '@/lib/coach-capabilities';
import { formatShortDate } from '@/lib/measurable-format';
import type { RepPlayerAward } from '@/lib/types';
import styles from '../../../../../coaches.module.css';
import cert from './certificate.module.css';

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
    void load();
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

  return (
    <div className={cert.screen}>
      <div className={cert.bar}>
        <CoachBackLink href={`${base}/history/awards`}>Awards</CoachBackLink>
        <p className={cert.barNote}>
          Letter, landscape — one page per certificate. Turn on background graphics in your
          browser’s print options if the frame doesn’t appear.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={() => window.print()} disabled={selected.length === 0}>
          <Printer size={14} aria-hidden /> Print {selected.length > 1 ? `${selected.length} certificates` : 'certificate'}
        </button>
      </div>

      {loading ? (
        <p className={styles.detailPlaceholder}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : selected.length === 0 ? (
        <p className={styles.detailPlaceholder}>
          Nothing to print — pick an award from the awards report.
        </p>
      ) : (
        selected.map(a => (
          <div
            key={a.id}
            className={cert.sheet}
            style={{ ['--cert-color' as string]: certColor }}
          >
            <span className={cert.org}>{currentOrg?.name ?? ''}</span>
            <h1 className={cert.award}>
              {a.awardType?.emoji ? `${a.awardType.emoji} ` : ''}{a.awardType?.name ?? 'Award'}
            </h1>
            <span className={cert.to}>presented to</span>
            <p className={cert.kid}>{a.playerName}</p>
            {/* ⚠ THE SEASON PRINTED HERE IS THE ONE THE AWARD WAS WON IN, not the one running
                today. This read `assignment.programYearName` — the coach's CURRENT season — which
                on a certificate for a past year's award is a wrong fact on paper handed to a
                child. `page.programYearName` resolves the season on screen. */}
            <span className={cert.meta}>
              {[page.teamName, page.programYearName, formatShortDate(a.awardedAt)]
                .filter(Boolean).join(' · ')}
            </span>
            {/* The coach's own words about this award, when they wrote any. Absent otherwise —
                never a filler line. */}
            {a.note && <span className={cert.note}>“{a.note}”</span>}
            <span className={cert.signature}>Coach</span>
          </div>
        ))
      )}
    </div>
  );
}
