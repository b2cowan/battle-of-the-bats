import TournamentSideRail from '@/components/public/TournamentSideRail';
import PreviewExitPill from '@/components/public/PreviewExitPill';
import { buildPublicThemeCssVars, getTournamentPreviewContext } from '@/lib/tournament-preview';
import { hasRoundRobin } from '@/lib/tournament-phase';
import { resolveOrgHomeHref } from '@/lib/module-entitlements';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { showsFreeCredit } from '@/lib/plan-config';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { tournamentToday } from '@/lib/timezone';
import { publicFrameBandFacts, publicTournamentContactEmail } from '@/lib/public-frame-server';
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
  // Bracket-only tournaments have no round-robin standings — hide that nav tab,
  // matching the live public layout (the preview nav otherwise can't detect this
  // because it only receives the hidden-pages list, not the tournament settings).
  const hiddenPages = !hasRoundRobin(tournament)
    ? Array.from(new Set([...(tournament.publicHiddenPages ?? []), 'standings' as const]))
    : (tournament.publicHiddenPages ?? []);
  const previewBase = `/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`;

  // Public tournament pages Stage 6 (Ask 14): the same facts the live layout computes, the same skip-when-hidden rule — one
  // read shared with the Branding page's Look card preview (lib/public-frame-server.ts). The preview wears the live frame.
  const [{ registrationOpen, frameContent }, orgHomeHref, contactEmail] = await Promise.all([
    publicFrameBandFacts(tournament, {
      register: hiddenPages.includes('register') || runsInviteOnlyEvents(org.planId),
      news: hiddenPages.includes('news'),
      rules: hiddenPages.includes('rules'),
    }),
    resolveOrgHomeHref(org).catch(() => null),
    publicTournamentContactEmail(tournament.id, org.contactEmail ?? null).catch(() => null),
  ]);
  const band = publicFrameBand(org, tournament, tournamentToday(), registrationOpen);
  const host = publicFrameHost(org.name, tournament.name, orgHomeHref);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeVars} }` }} />
      <style dangerouslySetInnerHTML={{ __html: publicFrameRoleCss(band.roles) }} />
      {/* The live frame's one outer element, its marker and token block; data-live-chrome too, since under the frame
          the preview has the band that the in-page titles would repeat (preview ↔ live parity). */}
      <div className={`${clubFrameStyles.tokens} ${frameStyles.frame}`} data-club-face={band.face} {...publicFrameAttr}>
        {/* No card style under the frame (Ask 11), as on the live page: the marker stays 'default' for the light wrapper rule. */}
        <div className={frameStyles.deskShell} data-card-style="default" data-color-mode="light" data-live-chrome="">
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
            frameContent={frameContent}
            basePath={previewBase}
          />
          <TournamentSideRail basePath={previewBase} hiddenPages={hiddenPages} frameContent={frameContent} />
          <div className={frameStyles.main}>{children}</div>
          <TournamentFooter
            name={tournament.name}
            contactEmail={contactEmail}
            host={host}
            hiddenPages={hiddenPages}
            hasBracket={false}
            showCredit={!showsFreeCredit(org.planId) && !isDemoOrgSlug(orgSlug)}
            basePath={previewBase}
            frameContent={frameContent}
          />
        </div>
      </div>
      <PreviewExitPill dashboardHref={`/${orgSlug}/admin/tournaments/dashboard`} />
    </>
  );
}
