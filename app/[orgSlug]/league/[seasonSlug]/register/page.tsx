import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import RegisterForm, { DivisionWithCount } from '@/components/league/RegisterForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) notFound();

  const rawDivisions = await getDivisionsForSeason(season.id);

  const divisions: DivisionWithCount[] = await Promise.all(
    rawDivisions.map(async d => {
      const { count } = await supabaseAdmin
        .from('league_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', d.id)
        .eq('status', 'active');
      return { id: d.id, name: d.name, capacity: d.capacity, activeCount: count ?? 0 };
    }),
  );

  const registrationOpen = season.status === 'registration_open';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        color: 'var(--fl-text, #F1F5F9)',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        {/* Back link */}
        <Link
          href={`/${orgSlug}/league/${seasonSlug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          ← Back to {season.name}
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '0.4rem',
            }}
          >
            {org.name}
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.4rem',
              lineHeight: 1.1,
            }}
          >
            Register — {season.name}
          </h1>
          {season.division && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              Division: {season.division}
            </div>
          )}
        </div>

        {/* Closed state */}
        {!registrationOpen ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                margin: '0 0 0.5rem',
              }}
            >
              Registration is not currently open
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {season.status === 'draft' &&
                'This season has not yet opened for registration.'}
              {season.status === 'registration_closed' &&
                'Registration for this season has closed.'}
              {(season.status === 'active' ||
                season.status === 'completed' ||
                season.status === 'archived') &&
                'This season is no longer accepting registrations.'}
            </p>
          </div>
        ) : (
          <RegisterForm
            orgSlug={orgSlug}
            orgName={org.name}
            seasonSlug={seasonSlug}
            seasonName={season.name}
            waiverText={season.waiverText}
            registrationFee={season.registrationFee}
            divisions={divisions}
          />
        )}
      </div>
    </div>
  );
}
