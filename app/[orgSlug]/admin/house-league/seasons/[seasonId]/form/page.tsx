'use client';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { PageLoading, repKit } from '@/components/admin/kit/club/RepKit';
import { NotYours } from '@/components/admin/kit/club/NotYours';
import SignupFormScreen from '@/components/admin/kit/club/league/form/SignupFormScreen';
import { FORM_WORDS as W } from '@/lib/club-form-words';

/**
 * THE SEASON'S SIGN-UP FORM (Board Ready Stage 4 Part 1; drawing tab 1): one level down from the Overview's Registration
 * block. The bar reads "← Overview" and names the page (lib/admin-kit-nav.ts `season-form:`); the season's lock line is
 * the layout's. Readable by anyone who can open the season; changed by the people who set up a season, while it is live.
 */
export default function SeasonSignupFormPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, loading } = useOrg();
  const access = useHouseLeagueAccess();
  if (loading || !currentOrg) return <PageLoading label={W.loading} />;
  if (access && !access.read) return <NotYours page="houseLeague" />;
  return (
    <div className={repKit.page}>
      <TabPageHeader title={W.title} backTo={{ href: `/${orgSlug}/admin/house-league/seasons/${seasonId}`, label: W.back }} />
      <SignupFormScreen orgSlug={currentOrg.slug} seasonId={seasonId} planId={currentOrg.planId} />
    </div>
  );
}
