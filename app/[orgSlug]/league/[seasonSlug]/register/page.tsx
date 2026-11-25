import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDivisionsForSeason } from '@/lib/db';
import { isPublicLeagueSeason } from '@/lib/league-game-changes-server';
import { clubDay, registrationState } from '@/lib/league-registration-state';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason, getClubSiteContent } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { supabaseAdmin } from '@/lib/supabase-admin';
import RegisterForm from '@/components/league/RegisterForm';
import type { FormDivision } from '@/lib/league-signup';
import { cutoffFor } from '@/lib/born-years';
import { seasonDates } from '@/lib/house-league-season';
import { tournamentToday } from '@/lib/timezone';
import { friendMaxFor } from '@/lib/league-friends';
import { ensureSeasonForm, signupFormView } from '@/lib/club-form-server';
import { getOrgPrivacyPolicyHref } from '@/lib/privacy-policy';
import PublicPage from '@/components/public/PublicPage';
import kit from '@/components/public/ClubKit.module.css';
import PreviewClosedForm from '@/components/public/PreviewClosedForm';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page (it answers 404, like every other league page), so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return isPublicLeagueSeason(season) ? `Register for ${season.name}` : null;
  }, { path: `/league/${seasonSlug}/register` });
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/register`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  // Only show non-draft seasons publicly (sweep 3, small items): a draft season's name is not public yet.
  if (!isPublicLeagueSeason(season)) notFound();
  // A preview club (Track P): no form, ever. The server refuses the sign-up too (lib/preview-write-refusal.ts).
  if (org.isPreview) return <PreviewClosedForm clubName={org.name} homeHref={href()} context={season.name} />;

  // The dates and the status together (9b-1 Part 4): the form shows only while it takes a sign-up, and a closed form
  // says why (copy §12).
  const regState = registrationState(season);
  const registrationOpen = regState === 'open';

  // What the form forecasts from (9b-1 Part 5): each division's birth years, price, note, and what holds a spot (accepted
  // and received, mig 362) and who is waiting. The server decides for real, under the season lock. Read together with the
  // club's contact and (Board Ready Stage 4) the season's sign-up form as a family meets it: the club's questions and the
  // documents families tick (the waiver moved into them), each at the version the page is drawn with.
  const [rawDivisions, { data: regRows }, siteContent, signupForm] = await Promise.all([
    getDivisionsForSeason(season.id),
    supabaseAdmin
      .from('league_registrations')
      .select('division_id, status')
      .eq('season_id', season.id)
      .in('status', ['active', 'pending_review', 'waitlisted']),
    // Where a family's questions go (the no-division-fits card): the club's public-site contact, never org.contactEmail.
    getClubSiteContent(org.id),
    registrationOpen ? ensureSeasonForm(season.id).then(signupFormView) : Promise.resolve(null),
  ]);
  const count = (id: string, statuses: string[]) => (regRows ?? []).filter(r => r.division_id === id && statuses.includes(r.status)).length;
  const divisions: FormDivision[] = rawDivisions.map(d => ({
    id: d.id, name: d.name, note: d.note, capacity: d.capacity,
    heldCount: count(d.id, ['active', 'pending_review']), waitlistCount: count(d.id, ['waitlisted']),
    bornFromYear: d.bornFromYear, bornToYear: d.bornToYear, price: d.price, earlyPrice: d.earlyPrice,
  }));
  const notYet = regState === 'opensAhead' || regState === 'notSet' || regState === 'draft';
  const closedLine = regState === 'opensAhead' ? `Registration for ${season.name} opens ${clubDay(season.registrationOpenAt!)}.`
    : regState === 'closedByDate' ? `Registration for ${season.name} closed ${clubDay(season.registrationCloseAt!)}.`
    : regState === 'closedByYou' ? 'Registration for this season has closed.'
    : regState === 'ended' ? 'This season is no longer taking registrations.'
    : 'This season hasn’t opened for registration.';

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  // A club form in the club page column (club round C2): 640 on the logo edge. The back link opens the title block.
  return (
    <PublicPage frame="club" width="form">
      <div>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>
        {/* C3: the band names the club, so the club-name line over the title is gone; the title is 24 (C4). */}
        <h1 className={kit.pageName}>Sign up — {season.name}</h1>
      </div>

      {/* Closed state */}
      {!registrationOpen ? (
        <div className={kit.card} style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--club-text)',
              margin: '0 0 0.5rem',
              fontFamily: 'var(--club-text-face)',
              letterSpacing: 0,
            }}
          >
            {notYet ? 'Registration isn’t open yet' : 'Registration is closed'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--club-soft)', margin: 0 }}>{closedLine}</p>
          {!notYet && (
            <p style={{ fontSize: '0.875rem', color: 'var(--club-soft)', margin: '0.5rem 0 0' }}>
              Already signed up? <Link href={href(`/league/${seasonSlug}/status`)}>Email me my link</Link>
            </p>
          )}
        </div>
      ) : signupForm && (
        <RegisterForm
          orgSlug={orgSlug}
          orgName={org.name}
          seasonSlug={seasonSlug}
          seasonName={season.name}
          seasonDates={seasonDates(season)}
          form={signupForm}
          privacyUrl={getOrgPrivacyPolicyHref(org)}
          askEmailConsent={season.askEmailConsent}
          divisions={divisions}
          season={{ registrationFee: season.registrationFee, earlyBirdUntil: season.earlyBirdUntil, autoApproveUnderCapacity: season.autoApproveUnderCapacity }}
          cutoff={cutoffFor(org.birthdayCutoffs, season.sport)}
          today={tournamentToday()}
          contact={{ email: siteContent?.contactEmail ?? null, phone: null }}
          friendMax={friendMaxFor(org.planId, season.friendRequestsMax)}
        />
      )}
    </PublicPage>
  );
}
