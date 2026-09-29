import Link from 'next/link';
import TryoutRegisterForm from '@/components/rep-teams/TryoutRegisterForm';

/**
 * A team's public tryout APPLICATION page — the markup the season-numbered register page always
 * drew, moved here so `/{org}/teams/{team}/tryouts/register` (Club Tier Stage 2 B07) and the old
 * address render ONE page. Routing and rules changed; the look did not (Stage 4's).
 *
 * `season` null = the team is not taking sign-ups. The form posts the season's id to the sign-up
 * API, which re-asks the same public rule (a stale form cannot sign up to a season that closed).
 */
export default function TryoutRegisterView({
  orgSlug, teamSlug, org, team, season, backHref, privacyPolicyHref,
}: {
  orgSlug: string;
  teamSlug: string;
  org: { name: string; contactEmail?: string | null };
  team: { name: string; division?: string | null };
  season: { id: string; name: string } | null;
  backHref: string;
  privacyPolicyHref: string | null;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        color: 'var(--fl-text)',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height) + 2rem) 1.5rem 5rem',
        }}
      >
        <Link
          href={backHref}
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
          ← Back to {season ? season.name : team.name}
        </Link>

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
            {org.name} · {team.name}
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              // token-exempt: moved verbatim from the season-numbered tryout page (Club Tier Stage 2, B07) — the public pages' look is Stage 4's
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.4rem',
              lineHeight: 1.1,
            }}
          >
            {season ? `Tryout Application — ${season.name}` : 'Tryout Application'}
          </h1>
          {team.division && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              {team.division}
            </div>
          )}
        </div>

        {!season ? (
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
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 1rem' }}>
              {team.name} isn’t taking tryout sign-ups right now.
            </p>
            {org.contactEmail && (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                Questions?{' '}
                <a
                  href={`mailto:${org.contactEmail}`}
                  style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}
                >
                  Contact us
                </a>
              </p>
            )}
          </div>
        ) : (
          <TryoutRegisterForm
            orgSlug={orgSlug}
            teamSlug={teamSlug}
            yearId={season.id}
            teamName={team.name}
            yearName={season.name}
            orgName={org.name}
            privacyPolicyHref={privacyPolicyHref}
          />
        )}
      </div>
    </div>
  );
}
