import TournamentPreviewNav from '@/components/public/TournamentPreviewNav';
import {
  buildPublicLightModeCssVars,
  buildPublicThemeCssVars,
  getPreviewCardStyle,
  getTournamentPreviewContext,
} from '@/lib/tournament-preview';

export const dynamic = 'force-dynamic';

export default async function TournamentPreviewLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { org, tournament } = await getTournamentPreviewContext(orgSlug, tournamentSlug);
  const themeVars = buildPublicThemeCssVars(org, tournament);
  const lightModeVars = tournament.colorMode === 'light' ? buildPublicLightModeCssVars() : null;
  const cardStyle = getPreviewCardStyle(org, tournament);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
      {lightModeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${lightModeVars} }` }} />
      )}
      <div data-card-style={cardStyle} data-color-mode={tournament.colorMode ?? 'dark'}>
        <TournamentPreviewNav
          org={org}
          orgSlug={orgSlug}
          tournamentSlug={tournamentSlug}
          tournamentName={tournament.name}
          hiddenPages={tournament.publicHiddenPages ?? []}
        />
        {children}
      </div>
    </>
  );
}
