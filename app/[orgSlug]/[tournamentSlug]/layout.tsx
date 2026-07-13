import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/api-auth';
import { getOrganizationBySlug, getPublicTournamentBySlug, getDivisions, getTeams } from '@/lib/db';
import { getRegistrationState } from '@/lib/registration-state';
import { isPlayoffOnly } from '@/lib/tournament-phase';
import { tournamentToday } from '@/lib/timezone';
import { hasPlanFeature } from '@/lib/plan-features';
import { resolveTheme } from '@/lib/themes';
import { buildPublicLightModeCssVars } from '@/lib/public-tournament-theme';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import { OrgNavSync } from '@/components/OrgNavSync';
import TournamentNavSync from '@/components/TournamentNavSync';
import PoweredByBadge from '@/components/marketing/PoweredByBadge';
import TournamentAcquisitionBanner from '@/components/marketing/TournamentAcquisitionBanner';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import MyTeamDock from '@/components/public/MyTeamDock';
import FollowDeepLinkPrompt from '@/components/public/FollowDeepLinkPrompt';
import AlertsNudge from '@/components/public/AlertsNudge';
import TournamentSideRail from '@/components/public/TournamentSideRail';
import railStyles from '@/components/public/TournamentSideRail.module.css';
import ScoreTicker from '@/components/public/ScoreTicker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, tournamentSlug } = await params;

  // Resolve social-share title/description; fall back gracefully.
  let ogTitle = 'Tournament';
  let ogDescription = 'Live scores, schedule and standings on FieldLogicHQ.';
  try {
    const org = await getOrganizationBySlug(orgSlug);
    if (org && org.subscriptionStatus !== 'canceled') {
      const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
      if (tournament) {
        ogTitle = tournament.name;
        ogDescription = `Live scores, schedule and standings · Hosted by ${org.name} on FieldLogicHQ.`;
      }
    }
  } catch {
    /* fall back to the generic label */
  }

  return {
    title: ogTitle,
    description: ogDescription,
    // The branded OG image is auto-wired from `opengraph-image.tsx` in this
    // segment (event card), overridden by nested routes (game score card, team card).
    openGraph: { title: ogTitle, description: ogDescription, type: 'website' },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription },
    // Unified-app identity (Phase 0): one FieldLogicHQ install, scope '/', so an
    // installed app captures this tournament's links. Per-event install icons are
    // retired (G1) — the home-screen label is the platform name for everyone.
    manifest: '/manifest.json',
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'FieldLogicHQ',
    },
  };
}

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  if (org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  const canUseAdvancedBranding = canUseAdvancedTournamentBranding(org);
  const isFreeTournamentPlan = org.planId === 'tournament';
  const authCtx = await getAuthContext({ orgSlug }).catch(() => null);
  const showAcquisitionBanner = isFreeTournamentPlan && (!authCtx || authCtx.org.id !== org.id);
  const effectiveColorMode = canUseAdvancedBranding ? tournament.colorMode ?? 'dark' : 'dark';
  // Free public tournament pages always use the FieldLogicHQ default theme, even if old branding values exist.
  const hasTournamentTheme = canUseAdvancedBranding
    ? !!(tournament.themePreset || tournament.themePrimary)
    : true;
  let tournamentCssVars: string | null = null;
  if (hasTournamentTheme) {
    const t = resolveTheme(
      canUseAdvancedBranding ? tournament.themePreset : 'platform',
      canUseAdvancedBranding ? tournament.themePrimary : null,
      canUseAdvancedBranding ? tournament.themeAccent : null
    );
    tournamentCssVars = [
      `--primary:       ${t.primary}`,
      `--primary-light: ${t.primaryLight}`,
      `--primary-rgb:   ${t.primaryRgb}`,
      `--primary-glow:  rgba(${t.primaryRgb}, 0.35)`,
      `--primary-faint: rgba(${t.primaryRgb}, 0.08)`,
      `--border:        rgba(${t.primaryRgb}, 0.25)`,
      `--glow:          0 0 32px rgba(${t.primaryRgb}, 0.4)`,
      `--glow-sm:       0 0 16px rgba(${t.primaryRgb}, 0.25)`,
      `--on-primary:    ${t.onPrimary}`,
    ].join('; ');
  }

  const cardStyle = canUseAdvancedBranding
    ? tournament.themeCardStyle ?? org.themeCardStyle ?? 'default'
    : 'default';

  // Game-day window — gates the My-Team dock (mirrors lib/follow isTournamentInProgress
  // without importing the client module into this server component). Tournament-local
  // date so the dock survives the UTC day boundary on the final evening (J6-056).
  const todayISO = tournamentToday();
  // "Effectively finished" for the shell (top-bar pill, install/alert nudges, game-day
  // dock): marked complete, the bracket's champion already stamped (champions_crowned_at
  // is on the loaded record — no extra query), or the event has run past its end date.
  // Mirrors the games-derived finished signal the overview body uses, kept cheap for every
  // tournament sub-page so the whole shell agrees the event is over.
  const effectivelyFinished =
    tournament.status === 'completed' ||
    !!tournament.championsCrownedAt ||
    (!!tournament.endDate && todayISO > tournament.endDate);
  // NB: kept in step with lib/follow.isTournamentInProgress (date-window + active) — the
  // game-day dock self-gates to a followed team's live games, so it must NOT go dark the
  // moment a champion is stamped while other games may still be on today. Shell "finished"
  // signals (pill, install/alert nudges) use effectivelyFinished; live game-day surfaces do not.
  const tournamentInProgress =
    tournament.status === 'active' &&
    !!tournament.startDate && !!tournament.endDate &&
    todayISO >= tournament.startDate && todayISO <= tournament.endDate;

  // Public Register CTA — only when registration is genuinely open/waitlisting
  // (lifecycle + capacity aware). Skip the capacity queries entirely when the
  // register page is hidden, since there's no CTA to show then.
  // Bracket-only tournaments have no round-robin standings — hide that nav tab.
  const navHiddenPages = isPlayoffOnly(tournament)
    ? Array.from(new Set([...(tournament.publicHiddenPages ?? []), 'standings' as const]))
    : (tournament.publicHiddenPages ?? []);

  const registerHidden = (tournament.publicHiddenPages ?? []).includes('register');
  let registerCta: 'register' | 'waitlist' | null = null;
  if (!registerHidden) {
    const [regDivisions, regTeams] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
    ]);
    registerCta = getRegistrationState(
      tournament,
      regDivisions,
      regTeams.filter(t => t.status !== 'rejected'),
    ).cta;
  }

  // Light mode: override :root tokens so body background and all descendants flip.
  // Shared with the admin preview layout via lib/public-tournament-theme so the
  // two render light themes identically.
  const lightModeVars = effectiveColorMode === 'light' ? buildPublicLightModeCssVars() : null;

  return (
    <>
      <OrgNavSync
        logoUrl={canUseAdvancedBranding ? tournament.logoUrl ?? org.logoUrl ?? null : null}
        orgName={org.name}
      />
      <TournamentNavSync
        slug={tournament.slug}
        tournamentName={tournament.name}
        colorMode={effectiveColorMode}
        hiddenPages={navHiddenPages}
        registerCta={registerCta}
        startDate={tournament.startDate ?? null}
        endDate={tournament.endDate ?? null}
        status={tournament.status ?? null}
        finished={effectivelyFinished}
        tournamentId={tournament.id}
        fanAlertsEnabled={hasPlanFeature(org.planId, 'fan_score_alerts')}
      />
      {isFreeTournamentPlan && (
        <PoweredByBadge
          orgSlug={orgSlug}
          tournamentSlug={tournament.slug}
          offsetForBanner={showAcquisitionBanner}
        />
      )}
      {showAcquisitionBanner && (
        <TournamentAcquisitionBanner
          orgSlug={orgSlug}
          tournamentSlug={tournament.slug}
          tournamentName={tournament.name}
        />
      )}
      {tournamentCssVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${tournamentCssVars} }` }} />
      )}
      {lightModeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${lightModeVars} }` }} />
      )}
      {/* Desktop-only (≥1024px) persistent left nav rail — self-hides below that. */}
      <TournamentSideRail />
      {/* Broadcast score ticker — self-gates to game day (reserves --ticker-h). */}
      <ScoreTicker />
      <div className={railStyles.shell} data-card-style={cardStyle} data-color-mode={effectiveColorMode}>
        {children}
      </div>
      {/* Game-day "now playing" dock for the followed team (self-gates: followers
          on game day only; mobile-only). */}
      <MyTeamDock
        orgSlug={orgSlug}
        tournamentSlug={tournament.slug}
        tournamentId={tournament.id}
        inProgress={tournamentInProgress}
        fanAlertsEnabled={hasPlanFeature(org.planId, 'fan_score_alerts')}
      />
      {/* Self-onboarding shared links: ?follow=teamId → one-tap "Follow [team]?" (J6-012). */}
      <FollowDeepLinkPrompt orgSlug={orgSlug} tournamentSlug={tournament.slug} />
      {/* Post-install one-time nudge → turn on score alerts (J6-048). Self-gates to
          the installed app + a followed team; suppressed once the event is finished. */}
      {!effectivelyFinished && (
        <AlertsNudge
          orgSlug={orgSlug}
          tournamentSlug={tournament.slug}
          tournamentId={tournament.id}
          enabled={hasPlanFeature(org.planId, 'fan_score_alerts')}
        />
      )}
      {/* Fan app install — active/upcoming events only; suppressed once finished
          (no live scores/alerts left to follow — J6-054). */}
      {!effectivelyFinished && (
        <InstallAppPrompt
          appName="FieldLogicHQ"
          subtitle={
            hasPlanFeature(org.planId, 'fan_score_alerts')
              ? 'Live scores, schedule & alerts — add to your home screen.'
              : 'Live scores & schedule — add to your home screen.'
          }
          orgSlug={orgSlug}
          tournamentSlug={tournament.slug}
        />
      )}
    </>
  );
}
