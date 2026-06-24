import { notFound } from 'next/navigation';
import {
  getDivisions,
  getAnnouncements,
  getVenues,
  getGames,
  getResources,
  getRules,
  getStandings,
  getTeams,
  getTournamentRegistrationFields,
  resolveTournamentContactEmail,
} from '@/lib/db';
import { getTournamentPreviewContext } from '@/lib/tournament-preview';
import { hasPlanFeature } from '@/lib/plan-features';
import { isPublicPageEnabled, type PublicPageKey } from '@/lib/public-pages';
import { toPublicTeam, type PublicTournamentPageData } from '@/lib/public-tournament-data';
import ScheduleContent from '@/components/public/ScheduleContent';
import StandingsContent from '@/components/public/StandingsContent';
import TeamsContent from '@/components/public/TeamsContent';
import NewsContent from '@/components/public/NewsContent';
import RulesContent from '@/components/public/RulesContent';
import RegisterContent from '@/components/public/RegisterContent';

export const dynamic = 'force-dynamic';

const VALID_SECTIONS = new Set(['news', 'schedule', 'standings', 'teams', 'rules', 'register']);

export default async function TournamentPreviewSectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; section: string }>;
}) {
  const { orgSlug, tournamentSlug, section } = await params;
  if (!VALID_SECTIONS.has(section)) notFound();

  const { org, tournament } = await getTournamentPreviewContext(orgSlug, tournamentSlug);
  const readOptions = { admin: true };
  if (!isPublicPageEnabled(tournament, section as PublicPageKey)) notFound();

  // Resolve the contact the same way the live public pages do (member → tournament
  // email → org fallback, honoring visibility) so the preview shows what the public sees.
  const contactEmail = await resolveTournamentContactEmail(tournament.id, org.contactEmail ?? null, 'public');

  // ── Schedule ──────────────────────────────────────────────────────────────
  if (section === 'schedule') {
    const [games, teams, divisions, venues] = await Promise.all([
      getGames(tournament.id, readOptions),
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
      getVenues(tournament.id, readOptions),
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
      games,
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      registrationFields: [],
      standingsByDivision: {},
    };
    return (
      <ScheduleContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
      />
    );
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  if (section === 'standings') {
    const divisions = await getDivisions(tournament.id, readOptions);
    const standingsEntries = await Promise.all(
      divisions.map(async group => [
        group.id,
        await getStandings(group.id, group.playoffConfig, readOptions, tournament.settings),
      ] as const),
    );
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
      standingsByDivision: Object.fromEntries(standingsEntries),
    };
    return (
      <StandingsContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
        enableCoinTossAdmin
      />
    );
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  if (section === 'teams') {
    const [teams, divisions] = await Promise.all([
      getTeams(tournament.id, readOptions),
      getDivisions(tournament.id, readOptions),
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
      games: [],
      resources: [],
      rules: [],
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      registrationFields: [],
      standingsByDivision: {},
    };
    return (
      <TeamsContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        isPreview
        initialData={initialData}
      />
    );
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
    return (
      <RulesContent
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        pageEnabled
        rules={rules}
        resources={resources}
        divisions={divisions}
        prefName={null}
        contactEmail={contactEmail}
        rulesLayout={tournament.settings?.rulesLayout ?? 'columns'}
        resourcesLayout={tournament.settings?.resourcesLayout ?? 'list'}
      />
    );
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
