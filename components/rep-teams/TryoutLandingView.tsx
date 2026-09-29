import Link from 'next/link';
import HelpCallout from '@/components/help/HelpCallout';

/**
 * A team's public tryout page — the markup the season-numbered page always drew, moved here so the
 * team-named address (`/{org}/teams/{team}/tryouts`, Club Tier Stage 2 B07) and the old addresses
 * render ONE page. Routing and rules changed; the look did not (the public pages are Stage 4's).
 *
 * `season` null = the team is not taking sign-ups (no live season, or its tryouts are closed, or an
 * old address named a season that is not the live one).
 */
export default function TryoutLandingView({
  orgSlug, teamSlug, org, team, season, registerHref,
}: {
  orgSlug: string;
  teamSlug: string;
  org: { name: string; contactEmail?: string | null };
  team: { name: string; division?: string | null };
  season: { name: string; tryoutDescription: string | null; tryoutOpen: boolean } | null;
  registerHref: string;
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
          href={`/${orgSlug}/teams/${teamSlug}`}
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
          ← Back to {team.name}
        </Link>

        <div style={{ marginBottom: '2.5rem' }}>
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
            {season ? `${season.name} Tryouts` : `${team.name} Tryouts`}
          </h1>
          {team.division && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
              {team.division}
            </div>
          )}
        </div>

        {season?.tryoutDescription && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {season.tryoutDescription}
          </div>
        )}

        {season?.tryoutOpen ? (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                // token-exempt: moved verbatim from the season-numbered tryout page (Club Tier Stage 2, B07) — the public pages' look is Stage 4's
                background: 'rgba(163,230,53,0.1)',
                // token-exempt: moved verbatim from the season-numbered tryout page (Club Tier Stage 2, B07) — the public pages' look is Stage 4's
                border: '1px solid rgba(163,230,53,0.3)',
                color: 'var(--logic-lime)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '1.25rem',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />{' '}
              Accepting Applications
            </div>
            <div>
              <Link
                href={registerHref}
                style={{
                  display: 'inline-block',
                  padding: '0.85rem 2rem',
                  background: 'var(--logic-lime)',
                  // token-exempt: moved verbatim from the season-numbered tryout page (Club Tier Stage 2, B07) — the public pages' look is Stage 4's
                  color: '#0A0A0A',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-display, sans-serif)',
                }}
              >
                Register for Tryouts →
              </Link>
            </div>
          </div>
        ) : (
          <HelpCallout
            variant="info"
            title="Tryouts are currently closed"
            body={
              <>
                {team.name} isn’t taking tryout sign-ups right now.
                {org.contactEmail && (
                  // token-exempt: moved verbatim from the season-numbered tryout page (Club Tier Stage 2, B07) — the public pages' look is Stage 4's
                  <> Questions? <a href={`mailto:${org.contactEmail}`} style={{ color: '#4fa3e0' }}>Contact us</a>.</>
                )}
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
