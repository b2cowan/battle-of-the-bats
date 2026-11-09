import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason, getClubSiteContent } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { openSignupLink } from '@/lib/league-signup-link';
import { buildSignupStatus } from '@/lib/league-signup-status';
import { buildLeaguePayView } from '@/lib/league-pay-view';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import { maskEmail } from '@/lib/utils';
import YourSignup from '../YourSignup';
import EmailMyLinkForm from '../EmailMyLinkForm';
import WayBack from '../WayBack';
import { placedOnSignup } from '@/lib/family-home';
import PublicPage from '@/components/public/PublicPage';
import kit from '@/components/public/ClubKit.module.css';
import card from '../EmailMyLinkForm.module.css';

export const dynamic = 'force-dynamic';

/** The tab names the page ("Your sign-up", the email button's words); a link is a key: never indexed, never cached. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  const meta = await clubPageMetadata(orgSlug, () => SW.title, { path: `/league/${seasonSlug}/status` });
  return { ...meta, robots: { index: false, follow: false } };
}

/**
 * A FAMILY'S "YOUR SIGN-UP" LINK OPENS THEIR PAGE (Club Tier Stage 12b, owner §0e c; Signed-in family accounts Stage 1,
 * drawing tabs 1, 3 and 6). The signed link names one registration and shows its whole sign-up — the children by first
 * name, what is owed, Pay, the receipts, and "Ask to withdraw a child". Whether it opens is the one door's answer
 * (`openSignupLink`): a link the club replaced, a mangled one, or one under another club's or season's address shows
 * "This link no longer works" with "Email me my link" right there (ask 5: the two look the same on purpose); a finished
 * season's closed link shows "This season has finished", with no form (ask 1). `?paid={session}` is Stripe's return
 * (the page then waits for the record); `?left=1` is a family that left Stripe's page before paying.
 */
export default async function YourSignupPage({
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

  const link = await openSignupLink(token, { at: { orgId: org.id, seasonId: season.id } });
  const [found, pay] = link.ok
    ? await Promise.all([buildSignupStatus(season, org.name, link.rows), buildLeaguePayView(link.registrationId, contactEmail)])
    : [null, null];
  // Signed-in family accounts Stage 4a, Part 6.6: the way back to the app, once a child on this sign-up is on a team (tier on only).
  const placed = link.ok ? await placedOnSignup(link.rows, season.status) : [];

  // A club form in the club page column (club round C2): 640 on the logo edge (it was 560). The back link opens the title
  // block; every state below renders in the same column.
  return (
    <PublicPage frame="club" width="form">
      <div>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>
        {/* C3: the band names the club, so no club-name line; the title is 24 (C4), the season under it. */}
        <h1 className={kit.pageName}>{SW.title}</h1>
        <p className={kit.sub} style={{ marginTop: '0.35rem' }}>{season.name}</p>
      </div>

      {link.ok && found ? (
        <YourSignup
          orgSlug={orgSlug}
          seasonSlug={seasonSlug}
          contactEmail={contactEmail}
          found={{ ...found, pay }}
          token={token}
          emailShown={link.rows[0]?.guardian_email ? maskEmail(link.rows[0].guardian_email) : null}
          returnedSession={paid ?? null}
          left={left === '1'}
          wayBack={placed.length > 0 ? <WayBack token={token} kids={placed} /> : null}
        />
      ) : !link.ok && link.ended === 'finished' ? (
        <div className={kit.card}>
          <h2 className={card.heading}>{SW.finishedTitle}</h2>
          <p style={{ margin: 0, color: 'var(--club-text)' }}>{SW.finishedBody(season.name)}</p>
          <p className={card.soft} style={{ marginTop: '0.6rem' }}>{SW.finishedQuestions(org.name, contactEmail)}</p>
        </div>
      ) : (
        <EmailMyLinkForm orgSlug={orgSlug} seasonSlug={seasonSlug} seasonName={season.name} clubName={org.name} variant="replaced" />
      )}
    </PublicPage>
  );
}
