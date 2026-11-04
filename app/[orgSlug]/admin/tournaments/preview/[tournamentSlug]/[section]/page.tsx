import { notFound } from 'next/navigation';
import {
  getDivisions,
  getAnnouncements,
  getVenues,
  getGames,
  getResources,
  getRules,
  getTeams,
  getTournamentRegistrationFields,
} from '@/lib/db';
import { publicTournamentContactEmail } from '@/lib/public-frame-server';
import { getTournamentPreviewContext } from '@/lib/tournament-preview';
import { hasPlanFeature } from '@/lib/plan-features';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import { toPublicTeam, type PublicTournamentPageData } from '@/lib/public-tournament-data';
import { getPublicStandingsByDivision, onlyPublishedGames } from '@/lib/public-games';
import PublicSchedule from '@/components/public/PublicSchedule';
import PublicStandings from '@/components/public/PublicStandings';
import { publishedCompetitionData } from '@/lib/public-standings';
import PublicTeams from '@/components/public/PublicTeams';
import { publicTeamsData } from '@/lib/public-teams';
import NewsContent from '@/components/public/NewsContent';
import PublicRules from '@/components/public/PublicRules';
import PublicChampionsPage from '@/components/public/PublicChampionsPage';
import { deriveTierChampions, isTournamentPlayoffsComplete } from '@/lib/champions';
import { championCards } from '@/lib/public-host-card';
import RegisterContent from '@/components/public/RegisterContent';

export const dynamic = 'force-dynamic';

// Public tournament pages Stage 6: 'champions' joins the set. It has no PublicPageKey of its own (its visibility
// borrows Standings', exactly as the live page) — handled in its own block below, not the generic check after.
const VALID_SECTIONS = new Set(['news', 'schedule', 'standings', 'teams', 'rules', 'register', 'champions']);

export default async function TournamentPreviewSectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; section: string }>;
}) {
  const { orgSlug, tournamentSlug, section } = await params;
  if (!VALID_SECTIONS.has(section)) notFound();

  const { org, tournament } = await getTournamentPreviewContext(orgSlug, tournamentSlug);
  const readOptions = { admin: true };
  if (section !== 'champions' && !isPublicPageEnabled(tournament, section as PublicPageKey)) notFound();

  // Resolve the contact the same way the live public pages do (member → tournament
  // email → org fallback, honoring visibility) so the preview shows what the public sees.
  const contactEmail = await publicTournamentContactEmail(tournament.id, org.contactEmail ?? null);

  // ── Schedule ──────────────────────────────────────────────────────────────
  if (section === 'schedule') {
    // The preview is what families see: only published divisions' games (D1).
    const [rawGames, teams, divisions, venues] = await Promise.all([
      getGames(tournament.id, readOptions),
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
      getVenues(tournament.id, { ...readOptions, includeFacilities: true }),
    ]);
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues,
      games: onlyPublishedGames(rawGames, divisions),
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      registrationFields: [],
      standingsByDivision: {},
    };
    return <PublicSchedule orgSlug={orgSlug} tournamentSlug={tournamentSlug} isPreview initialData={publicTeamsData(initialData)} />;
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  if (section === 'standings') {
    const divisions = await getDivisions(tournament.id, readOptions);
    const standingsByDivision = await getPublicStandingsByDivision(tournament, divisions);
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues: [],
      games: [],
      resources: [],
      rules: [],
      teams: [],
      registrationFields: [],
      standingsByDivision,
    };
    return <PublicStandings orgSlug={orgSlug} tournamentSlug={tournamentSlug} isPreview initialData={publishedCompetitionData(initialData)} />;
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  if (section === 'teams') {
    const [teams, divisions, games] = await Promise.all([
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
      getGames(tournament.id, readOptions),
    ]);
    const initialData: PublicTournamentPageData = {
      organization: {
        id: org.id, name: org.name, slug: org.slug,
        logoUrl: org.logoUrl ?? undefined,
        contactEmail: org.contactEmail ?? null,
        requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
      },
      tournaments: [tournament],
      tournament,
      pageEnabled: true,
      divisions,
      venues: [],
      games: onlyPublishedGames(games, divisions),
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      registrationFields: [],
      standingsByDivision: await getPublicStandingsByDivision(tournament, divisions, { games, teams }),
    };
    return <PublicTeams orgSlug={orgSlug} tournamentSlug={tournamentSlug} isPreview initialData={publicTeamsData(initialData)} initialNow={new Date().toISOString()} />;
  }

  // ── News ──────────────────────────────────────────────────────────────────
  // Renders the SAME component as the live public route, so the preview matches
  // exactly. No division-preference cookie exists in the preview → prefName=null
  // (equivalent to a first-time visitor with no saved division).
  if (section === 'news') {
    const [announcements, divisions] = await Promise.all([
      getAnnouncements(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
    ]);
    return (
      <NewsContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        pageEnabled
        announcements={announcements}
        divisions={divisions}
        prefName={null}
        contactEmail={contactEmail}
      />
    );
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  if (section === 'rules') {
    const [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, readOptions),
      getResources(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
    ]);
    return <PublicRules
      orgSlug={orgSlug} tournamentSlug={tournamentSlug} pageEnabled
      rules={rules} resources={resources} divisions={divisions} prefName={null} contactEmail={contactEmail} isPreview />;
  }

  // ── Champions ─────────────────────────────────────────────────────────────
  if (section === 'champions') {
    if (!isPublicPageEnabled(tournament, 'standings')) {
      return <PublicChampionsPage standingsHidden cards={[]} homeHref={`/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`}
        isPreview />;
    }
    const [rawGames, allTeams, divisions] = await Promise.all([
      getGames(tournament.id, readOptions),
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
    ]);
    // Only published divisions' games — no champion is crowned from an unpublished schedule (D1), same as live.
    const allGames = onlyPublishedGames(rawGames, divisions);
    const teams = allTeams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true));
    const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);
    const tierChampions = deriveTierChampions(allGames, teams, sortedDivisions);
    const playoffsComplete = allGames.length === rawGames.length && isTournamentPlayoffsComplete(allGames, sortedDivisions);
    const cards = playoffsComplete && divisions.every(division => division.scheduleVisibility === 'published')
      ? championCards(tierChampions, sortedDivisions.length > 1) : [];
    return <PublicChampionsPage standingsHidden={false} cards={cards} homeHref={`/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`}
      showPlayoffs isPreview />;
  }

  // ── Register (preview — the real form, with submission disabled) ───────────
  // Seed the form with admin reads so it renders for DRAFTS too (the public data
  // endpoint excludes non-public tournaments). Mirrors the other preview sections.
  const [registerDivisions, registrationFields] = await Promise.all([
    getDivisions(tournament.id, readOptions),
    hasPlanFeature(org.planId, 'custom_registration_fields')
      ? getTournamentRegistrationFields(tournament.id)
      : Promise.resolve([]),
  ]);
  // Mirror getPublicTournamentPageData exactly: the public-resolved contact (null
  // when the organizer hid it) goes on BOTH the org and the tournament object, so
  // the preview shows precisely what a registrant sees — never a hidden address.
  const registerData: PublicTournamentPageData = {
    organization: {
      id: org.id, name: org.name, slug: org.slug,
      logoUrl: org.logoUrl ?? undefined,
      contactEmail: contactEmail ?? null,
      requireScoreFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization,
    },
    tournaments: [tournament],
    tournament: { ...tournament, contactEmail: contactEmail ?? undefined },
    pageEnabled: true,
    divisions: registerDivisions,
    venues: [],
    games: [],
    resources: [],
    rules: [],
    teams: [],
    registrationFields,
    standingsByDivision: {},
  };
  return <RegisterContent isPreview initialData={registerData} />;
}
