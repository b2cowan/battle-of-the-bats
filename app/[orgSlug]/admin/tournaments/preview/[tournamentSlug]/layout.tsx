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
import { hasRoundRobin } from '@/lib/tournament-phase';
import { getDivisions, getTeams } from '@/lib/db';
import { resolveOrgHomeHref } from '@/lib/module-entitlements';
import { getRegistrationState } from '@/lib/registration-state';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { showsFreeCredit } from '@/lib/plan-config';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { tournamentToday } from '@/lib/timezone';
import { isPublicFrameOn, publicTournamentContactEmail } from '@/lib/public-frame-server';
import { publicFrameAttr, publicFrameBand, publicFrameHost, publicFrameRoleCss } from '@/lib/public-frame';
import TournamentBand from '@/components/public/TournamentBand';
import TournamentFooter from '@/components/public/TournamentFooter';
import clubFrameStyles from '@/components/public/ClubFrame.module.css';
import frameStyles from '@/components/public/TournamentFrame.module.css';

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
  const hiddenPages = !hasRoundRobin(tournament)
    ? Array.from(new Set([...(tournament.publicHiddenPages ?? []), 'standings' as const]))
    : (tournament.publicHiddenPages ?? []);
  const previewBase = `/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`;

  // Public tournament pages Stage 1 Part 2: the organizer's preview follows the same preview switch as the live pages
  // (lib/public-frame.ts — the one helper), so it shows the frame exactly when the live page would. Off: today's preview.
  if (await isPublicFrameOn()) {
    const registerHidden = hiddenPages.includes('register') || runsInviteOnlyEvents(org.planId);
    const [divisions, regTeams, orgHomeHref, contactEmail] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      registerHidden ? Promise.resolve(null) : getTeams(tournament.id, { admin: true }),
      resolveOrgHomeHref(org).catch(() => null),
      publicTournamentContactEmail(tournament.id, org.contactEmail ?? null).catch(() => null),
    ]);
    const registration = regTeams
      ? getRegistrationState(tournament, divisions, regTeams.filter(t => t.status !== 'rejected'))
      : null;
    const band = publicFrameBand(org, tournament, tournamentToday(), registration?.state === 'open');
    const host = publicFrameHost(org.name, tournament.name, orgHomeHref);
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
        <style dangerouslySetInnerHTML={{ __html: publicFrameRoleCss(band.roles) }} />
        {/* The live frame's one outer element, its marker and token block; data-live-chrome too, since under the frame
            the preview has the band that the in-page titles would repeat (preview ↔ live parity). */}
        <div className={`${clubFrameStyles.tokens} ${frameStyles.frame}`} {...publicFrameAttr}>
          <div className={`${railStyles.shell} ${frameStyles.deskShell}`} data-card-style={cardStyle} data-color-mode="light" data-live-chrome="">
            <TournamentBand
              orgSlug={orgSlug}
              tournamentSlug={tournamentSlug}
              name={tournament.name}
              logoUrl={band.logoUrl}
              initials={band.initials}
              dates={band.dates}
              status={band.status}
              hiddenPages={hiddenPages}
              hasBracket={false}
              host={host}
              basePath={previewBase}
            />
            <TournamentSideRail basePath={previewBase} heading={tournament.name} colorMode="light" hiddenPages={hiddenPages} />
            <div className={frameStyles.main}>{children}</div>
            <TournamentFooter
              name={tournament.name}
              contactEmail={contactEmail}
              host={host}
              hiddenPages={hiddenPages}
              hasBracket={false}
              showCredit={!showsFreeCredit(org.planId) && !isDemoOrgSlug(orgSlug)}
              basePath={previewBase}
            />
          </div>
        </div>
        <PreviewExitPill dashboardHref={`/${orgSlug}/admin/tournaments/dashboard`} />
      </>
    );
  }

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
