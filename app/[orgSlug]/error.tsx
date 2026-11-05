'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/observability/client';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { wearsClubFrame } from '@/lib/club-not-found-face';
import { usePublicClub } from '@/components/public/PublicClubContext';
import PublicPage from '@/components/public/PublicPage';
import PageError from '@/app/error';
import kit from '@/components/public/ClubKit.module.css';
import parts from '@/components/public/PublicParts.module.css';

/**
 * A failed read on a club's own public page stays INSIDE the club's site (club round Part 4, owner yes 2026-11-05): the
 * club's band, tabs and footer stay (this boundary sits inside `app/[orgSlug]/layout.tsx`, which draws them), and the
 * page says so on the club page column with Try again and the way home. Before, a failed Tournaments read fell through to
 * the platform's page with no club around it.
 *
 * ⚠ This boundary catches EVERY page under the org — the signed-in tools and the tournaments too. Those keep the
 * platform's page exactly as before (`app/error.tsx`, rendered here); only a page that wears the club frame — the same
 * rule the frame and the "not found" faces use (`wearsClubFrame`) — gets the club's face.
 */
export default function OrgError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePublicPathname() ?? '';
  const club = usePublicClub();
  const href = useOrgHref(club?.slug);
  const clubFace = wearsClubFrame(pathname, club);

  useEffect(() => {
    if (!clubFace) return; // the platform's page reports it itself
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error, clubFace]);

  if (!clubFace || !club) return <PageError error={error} retry={retry} />;

  return (
    <PublicPage frame="club">
      <div className={kit.nameBlock}>
        <h1 className={kit.pageName}>Something went wrong on our side</h1>
        <p className={`${kit.body} ${parts.prose}`} style={{ margin: 0 }}>
          We’ve logged it automatically. Try again, and if it keeps happening, come back in a few minutes.
        </p>
      </div>
      <div className={kit.btnRow}>
        <button type="button" onClick={() => retry()} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnPhoneFull}`}>
          Try again
        </button>
        <Link href={href()} className={`${kit.btn} ${kit.btnSecondary} ${kit.btnPhoneFull}`}>{club.name} home</Link>
      </div>
    </PublicPage>
  );
}
