import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import StatusLookupForm from './StatusLookupForm';

export const dynamic = 'force-dynamic';

export default async function RegistrationStatusPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) notFound();

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--pitch-black, #0A0A0A)',
    fontFamily: 'var(--font-sans, Inter, sans-serif)',
    color: 'var(--fl-text, #F1F5F9)',
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: '560px',
    margin: '0 auto',
    padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
  };

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        <Link
          href={`/${orgSlug}/league/${seasonSlug}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          ← Back to {season.name}
        </Link>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem',
          }}>
            {org.name}
          </div>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 900, color: '#f0f0f0',
            fontFamily: 'var(--font-display, sans-serif)', margin: '0 0 0.4rem', lineHeight: 1.1,
          }}>
            Registration Status
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {season.name}
          </p>
        </div>

        <StatusLookupForm
          orgSlug={orgSlug}
          seasonSlug={seasonSlug}
          contactEmail={org.contactEmail ?? null}
        />
      </div>
    </div>
  );
}
