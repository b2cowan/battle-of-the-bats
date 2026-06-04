import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/api-auth';
import { getOrganizationBySlug, getPublicTournamentBySlug, getDivisions, getTeams } from '@/lib/db';
import { getRegistrationState } from '@/lib/registration-state';
import { resolveTheme } from '@/lib/themes';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import { OrgNavSync } from '@/components/OrgNavSync';
import TournamentNavSync from '@/components/TournamentNavSync';
import PoweredByBadge from '@/components/marketing/PoweredByBadge';
import TournamentAcquisitionBanner from '@/components/marketing/TournamentAcquisitionBanner';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import MyTeamDock from '@/components/public/MyTeamDock';
import TournamentSideRail from '@/components/public/TournamentSideRail';
import railStyles from '@/components/public/TournamentSideRail.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, tournamentSlug } = await params;
  const base = `/${orgSlug}/${tournamentSlug}`;

  // Resolve a friendly label for the iOS home-screen icon; fall back gracefully.
  let appleTitle = 'Tournament';
  let ogTitle = 'Tournament';
  let ogDescription = 'Live scores, schedule and standings on FieldLogicHQ.';
  try {
    const org = await getOrganizationBySlug(orgSlug);
    if (org && org.subscriptionStatus !== 'canceled') {
      const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
      if (tournament) {
        appleTitle = tournament.name;
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
    // Per-tournament PWA manifest — an installed app opens straight to this event.
    manifest: `${base}/manifest.webmanifest`,
    // `other` replaces the root value for tournament pages — keep the base PWA
    // flags and set the iOS home-screen label to the event name.
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': appleTitle,
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
  // without importing the client module into this server component).
  const todayISO = new Date().toISOString().split('T')[0];
  const tournamentInProgress =
    tournament.status === 'active' &&
    !!tournament.startDate && !!tournament.endDate &&
    todayISO >= tournament.startDate && todayISO <= tournament.endDate;

  // Public Register CTA — only when registration is genuinely open/waitlisting
  // (lifecycle + capacity aware). Skip the capacity queries entirely when the
  // register page is hidden, since there's no CTA to show then.
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
  const lightModeVars = effectiveColorMode === 'light' ? [
    '--bg:              #F5F7FC',
    '--bg-2:            #EEF1F8',
    '--bg-3:            #E5E9F2',
    '--surface:         #FFFFFF',
    '--surface-2:       #F0F3FA',
    '--white:           #0F1123',
    '--white-90:        rgba(15,17,35,0.9)',
    '--white-80:        rgba(15,17,35,0.8)',
    '--white-70:        rgba(15,17,35,0.7)',
    '--white-60:        rgba(15,17,35,0.6)',
    '--white-50:        rgba(15,17,35,0.5)',
    '--white-45:        rgba(15,17,35,0.45)',
    '--white-40:        rgba(15,17,35,0.4)',
    '--white-35:        rgba(15,17,35,0.35)',
    '--white-30:        rgba(15,17,35,0.3)',
    '--white-10:        rgba(15,17,35,0.07)',
    '--border-2:        rgba(15,17,35,0.1)',
    '--shadow-sm:       0 2px 8px rgba(0,0,0,0.1)',
    '--shadow:          0 4px 24px rgba(0,0,0,0.12)',
    '--shadow-lg:       0 8px 48px rgba(0,0,0,0.16)',
    '--fl-text:         #0F1123',
    '--data-gray:       #4B5563',
    '--hud-surface:     #FFFFFF',
    '--nav-bg-scrolled: rgba(245,247,252,0.95)',
    '--nav-mobile-bg:   rgba(245,247,252,0.99)',
    // Accent text uses the (dark) org primary on light surfaces — the pale
    // dark-mode tint would be unreadable on white.
    '--primary-light:   var(--primary)',
  ].join('; ') : null;

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
        hiddenPages={tournament.publicHiddenPages ?? []}
        registerCta={registerCta}
        startDate={tournament.startDate ?? null}
        endDate={tournament.endDate ?? null}
        status={tournament.status ?? null}
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
      <div className={railStyles.shell} data-card-style={cardStyle} data-color-mode={effectiveColorMode}>
        {children}
      </div>
      {/* Game-day "now playing" dock for the followed team (self-gates: followers
          on game day only; mobile-only). */}
      <MyTeamDock
        orgSlug={orgSlug}
        tournamentSlug={tournament.slug}
        inProgress={tournamentInProgress}
      />
      {/* Fan app install — this tournament's branded PWA (per-tournament manifest). */}
      <InstallAppPrompt
        appName={tournament.name}
        subtitle="Live scores, schedule &amp; alerts — add to your home screen."
        dismissKey={`flhq-install-fan-${tournament.slug}`}
      />
    </>
  );
}
