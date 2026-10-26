import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { getClubSeason, getClubSiteContent } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { registrationFromPayToken } from '@/lib/league-pay-link';
import { buildSignupStatus, signupRowsForLink } from '@/lib/league-signup-status';
import { buildLeaguePayView } from '@/lib/league-pay-view';
import { LEAGUE_PAY_WORDS as LW } from '@/lib/league-pay-words';
import StatusLookupForm from '../StatusLookupForm';
import column from '../../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

/** A pay link is a key: never indexed, never cached. */
export const metadata: Metadata = { title: 'Check your registration', robots: { index: false, follow: false } };

/**
 * A FAMILY'S PAY LINK OPENS THEIR STATUS PAGE, ALREADY UNLOCKED (Club Tier Stage 12b, owner §0e c; drawings b1, b2, b5).
 * The signed link names one registration and shows its whole sign-up — the children, what is owed, Pay, the receipts,
 * and "Ask to withdraw a child" — exactly what the email and the reference open. `?paid={session}` is Stripe's return
 * (the page then waits for the record); `?left=1` is a family that left Stripe's page before paying. A link under another
 * club's or season's address is refused.
 */
export default async function PayLinkStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string; token: string }>;
  searchParams: Promise<{ paid?: string; left?: string }>;
}) {
  const { orgSlug, seasonSlug, token } = await params;
  const { paid, left } = await searchParams;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/status/${token}`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();
  const [season, siteContent] = await Promise.all([getClubSeason(org.id, seasonSlug), getClubSiteContent(org.id)]);
  if (!season) notFound();
  const contactEmail = siteContent?.contactEmail ?? null;

  const regId = registrationFromPayToken(token);
  const rows = regId ? await signupRowsForLink(regId, { orgId: org.id, seasonId: season.id }) : null;
  const [found, pay] = rows && regId
    ? await Promise.all([buildSignupStatus(season, org.name, rows), buildLeaguePayView(regId, contactEmail)])
    : [null, null];

  const innerStyle = { '--league-measure': '560px' } as React.CSSProperties;
  return (
    <div>
      <div className={`container ${column.column}`} style={innerStyle}>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>

        <div style={{ marginBottom: '2rem' }}>
          <div className={kit.sub} style={{ marginBottom: '0.4rem' }}>{org.name}</div>
          <h1 className={kit.title}>Check your registration</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>

        {found ? (
          <StatusLookupForm
            orgSlug={orgSlug}
            seasonSlug={seasonSlug}
            contactEmail={contactEmail}
            initial={{ found: { ...found, pay }, token, guardianEmail: rows?.[0]?.guardian_email ?? null }}
            returnedSession={paid ?? null}
            left={left === '1'}
          />
        ) : (
          <div className={kit.card}><p style={{ margin: 0 }}>{LW.error.linkInvalid(org.name)}</p></div>
        )}
      </div>
    </div>
  );
}
