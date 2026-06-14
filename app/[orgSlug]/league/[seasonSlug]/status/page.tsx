import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrganizationBySlug, getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  active:         'Confirmed',
  pending_review: 'Pending Review',
  waitlisted:     'Waitlisted',
};

const STATUS_COLOR: Record<string, string> = {
  active:         '#4ade80',
  pending_review: '#f59e0b',
  waitlisted:     '#94a3b8',
};

export default async function RegistrationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  const { email } = await searchParams;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  if (!hasModuleEntitlement(org, 'module_house_league')) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) notFound();

  const trimmedEmail = email?.trim().toLowerCase() ?? '';

  let registrations: Array<{
    id: string;
    status: string;
    playerFirstName: string;
    playerLastName: string;
    divisionName: string;
    waitlistPosition: number | null;
  }> = [];

  if (trimmedEmail) {
    const divisions = await getDivisionsForSeason(season.id);
    const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));

    const { data } = await supabaseAdmin
      .from('league_registrations')
      .select('id, status, player_first_name, player_last_name, division_id, waitlist_position')
      .eq('season_id', season.id)
      .eq('guardian_email', trimmedEmail)
      .not('status', 'in', '(declined,withdrawn)');

    registrations = (data ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      playerFirstName: r.player_first_name,
      playerLastName: r.player_last_name,
      divisionName: divisionMap[r.division_id] ?? '—',
      waitlistPosition: r.waitlist_position ?? null,
    }));
  }

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

        {/* Search form */}
        <form method="GET" style={{ marginBottom: '2rem' }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem',
          }}>
            Guardian email address
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              name="email"
              defaultValue={trimmedEmail}
              placeholder="you@example.com"
              required
              style={{
                flex: '1 1 220px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                color: '#f1f5f9', fontSize: '0.95rem', padding: '0.6rem 0.75rem',
                outline: 'none', minWidth: 0,
              }}
            />
            <button
              type="submit"
              style={{
                background: '#f1f5f9', color: '#0a0a0a', border: 'none',
                borderRadius: '6px', fontWeight: 700, fontSize: '0.88rem',
                padding: '0.6rem 1.25rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Look up
            </button>
          </div>
        </form>

        {/* Results */}
        {trimmedEmail && registrations.length === 0 && (
          <div style={{
            padding: '2rem', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              No registrations found for <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{trimmedEmail}</strong> in this season.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.75rem' }}>
              Check the email address, or{' '}
              {org.contactEmail ? (
                <a href={`mailto:${org.contactEmail}`} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>
                  contact us
                </a>
              ) : 'contact your organization admin'}.
            </p>
          </div>
        )}

        {registrations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {registrations.map(r => (
              <div key={r.id} style={{
                padding: '1.25rem 1.5rem',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f0f0' }}>
                    {r.playerFirstName} {r.playerLastName}
                  </div>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', padding: '0.25rem 0.6rem', borderRadius: '4px',
                    background: `${STATUS_COLOR[r.status] ?? '#94a3b8'}22`,
                    color: STATUS_COLOR[r.status] ?? '#94a3b8',
                    border: `1px solid ${STATUS_COLOR[r.status] ?? '#94a3b8'}55`,
                    whiteSpace: 'nowrap',
                  }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                  {r.divisionName}
                  {r.status === 'waitlisted' && r.waitlistPosition != null && (
                    <span style={{ marginLeft: '0.5rem', color: 'rgba(255,255,255,0.35)' }}>
                      · Waitlist position #{r.waitlistPosition}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>
                  Ref: {r.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
