import TournamentPreviewNav from '@/components/public/TournamentPreviewNav';
import TournamentTopTabs from '@/components/public/TournamentTopTabs';
import TournamentSideRail from '@/components/public/TournamentSideRail';
import PreviewExitPill from '@/components/public/PreviewExitPill';
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
      {/* Phase 3 preview parity: the fixed top-tab row adds ~45px below the preview top bar
          (which reuses .nav = --nav-height) ≤900px, so seed BOTH chrome-top vars past both —
          --nav-event-h (page-content padding) and --nav-visual-h (the sticky day-label / rail,
          via --chrome-top-h). Derived from --nav-height (not a hardcoded 72) so it can't drift;
          unlike the live seed there is NO ResizeObserver here to self-correct. */}
      <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 900px) { :root { --nav-event-h: calc(var(--nav-height) + 45px); --nav-visual-h: calc(var(--nav-height) + 45px); } }` }} />
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
      {/* Mobile (≤900px) section nav — Phase 3 preview parity: the same scrolling top-tab
          row fans see live (basePath keeps links in-preview; `fixed` pins it below the
          preview top bar). No global app bar / account / chat here — a preview shows the
          event, not the personal app. */}
      <TournamentTopTabs basePath={previewBase} hiddenPages={hiddenPages} fixed />
      {/* The Flip (B14): the one exit door out of the preview back to the admin dashboard. */}
      <PreviewExitPill dashboardHref={`/${orgSlug}/admin/tournaments/dashboard`} />
    </>
  );
}
