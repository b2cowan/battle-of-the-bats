import TournamentPreviewNav from '@/components/public/TournamentPreviewNav';
import {
  buildPublicLightModeCssVars,
  buildPublicThemeCssVars,
  getPreviewColorMode,
  getPreviewCardStyle,
  getTournamentPreviewContext,
} from '@/lib/tournament-preview';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';

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
  const colorMode = getPreviewColorMode(org, tournament);
  const lightModeVars = colorMode === 'light' ? buildPublicLightModeCssVars() : null;
  const cardStyle = getPreviewCardStyle(org, tournament);
  const navOrg = canUseAdvancedTournamentBranding(org) ? org : { ...org, logoUrl: undefined, heroBannerUrl: undefined };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
      {lightModeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${lightModeVars} }` }} />
      )}
      <div data-card-style={cardStyle} data-color-mode={colorMode}>
        <TournamentPreviewNav
          org={navOrg}
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
