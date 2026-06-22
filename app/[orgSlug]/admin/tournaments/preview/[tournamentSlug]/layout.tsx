import TournamentPreviewNav from '@/components/public/TournamentPreviewNav';
import BottomNav from '@/components/BottomNav';
import TournamentSideRail from '@/components/public/TournamentSideRail';
import railStyles from '@/components/public/TournamentSideRail.module.css';
import {
  buildPublicLightModeCssVars,
  buildPublicThemeCssVars,
  getPreviewColorMode,
  getPreviewCardStyle,
  getTournamentPreviewContext,
} from '@/lib/tournament-preview';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import { isPlayoffOnly } from '@/lib/tournament-phase';

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
  const navOrg = canUseAdvancedTournamentBranding(org)
    ? { ...org, logoUrl: tournament.logoUrl ?? org.logoUrl }
    : { ...org, logoUrl: undefined, heroBannerUrl: undefined };
  // Bracket-only tournaments have no round-robin standings — hide that nav tab,
  // matching the live public layout (the preview nav otherwise can't detect this
  // because it only receives the hidden-pages list, not the tournament settings).
  const hiddenPages = isPlayoffOnly(tournament)
    ? Array.from(new Set([...(tournament.publicHiddenPages ?? []), 'standings' as const]))
    : (tournament.publicHiddenPages ?? []);
  const previewBase = `/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
      {lightModeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${lightModeVars} }` }} />
      )}
      {/* Desktop-only (≥1024px) left rail — mirrors the live public shell. Links stay
          inside the preview (basePath) so navigation doesn't escape to the live site. */}
      <TournamentSideRail
        basePath={previewBase}
        logoUrl={navOrg.logoUrl ?? null}
        heading={tournament.name}
        colorMode={colorMode}
        hiddenPages={hiddenPages}
      />
      <div className={railStyles.shell} data-card-style={cardStyle} data-color-mode={colorMode}>
        <TournamentPreviewNav
          org={navOrg}
          orgSlug={orgSlug}
          tournamentSlug={tournamentSlug}
          tournamentName={tournament.name}
          colorMode={colorMode}
          hiddenPages={hiddenPages}
        />
        {children}
      </div>
      {/* Mobile (≤900px) section nav — the preview gets no global bottom nav (that one
          hides on /admin/* routes), so mount a preview-scoped instance whose tabs link
          inside the preview. Matches the live public shell the admin is previewing. */}
      <BottomNav basePath={previewBase} hiddenPages={hiddenPages} />
    </>
  );
}
