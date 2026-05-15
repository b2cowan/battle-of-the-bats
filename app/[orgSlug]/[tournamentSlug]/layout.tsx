import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { resolveTheme } from '@/lib/themes';
import TournamentNavSync from '@/components/TournamentNavSync';

export const dynamic = 'force-dynamic';

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

  // Apply tournament-level theme overrides when set; fall back to org theme.
  const hasTournamentTheme = !!(tournament.themePreset || tournament.themePrimary);
  let tournamentCssVars: string | null = null;
  if (hasTournamentTheme) {
    const t = resolveTheme(tournament.themePreset, tournament.themePrimary, tournament.themeAccent);
    tournamentCssVars = [
      `--primary:       ${t.primary}`,
      `--primary-light: ${t.primaryLight}`,
      `--primary-rgb:   ${t.primaryRgb}`,
      `--primary-glow:  rgba(${t.primaryRgb}, 0.35)`,
      `--primary-faint: rgba(${t.primaryRgb}, 0.08)`,
      `--border:        rgba(${t.primaryRgb}, 0.25)`,
      `--glow:          0 0 32px rgba(${t.primaryRgb}, 0.4)`,
      `--glow-sm:       0 0 16px rgba(${t.primaryRgb}, 0.25)`,
    ].join('; ');
  }

  const cardStyle = tournament.themeCardStyle ?? org.themeCardStyle ?? 'default';

  return (
    <>
      <TournamentNavSync slug={tournament.slug} tournamentName={tournament.name} />
      {tournamentCssVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${tournamentCssVars} }` }} />
      )}
      <div data-card-style={cardStyle}>
        {children}
      </div>
    </>
  );
}
