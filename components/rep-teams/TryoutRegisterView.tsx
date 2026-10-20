import Link from 'next/link';
import kit from '@/components/public/ClubKit.module.css';
import TryoutRegisterForm from '@/components/rep-teams/TryoutRegisterForm';

/**
 * A team's public tryout APPLICATION page — the markup the season-numbered register page always
 * drew, moved here so `/{org}/teams/{team}/tryouts/register` (Club Tier Stage 2 B07) and the old
 * address render ONE page. Routing and rules changed; Club Tier Stage 4b-1 moved it onto the club's light frame (structure unchanged).
 *
 * `season` null = the team is not taking sign-ups. The form posts the season's id to the sign-up
 * API, which re-asks the same public rule (a stale form cannot sign up to a season that closed).
 */
export default function TryoutRegisterView({
  orgSlug, teamSlug, org, contactEmail, team, season, backHref, privacyPolicyHref,
}: {
  orgSlug: string;
  teamSlug: string;
  org: { name: string };
  /** The club's public-site contact (resolvePublicTryout), never the org's phantom `contactEmail` (F09). */
  contactEmail: string | null;
  team: { name: string; division?: string | null };
  season: { id: string; name: string } | null;
  backHref: string;
  privacyPolicyHref: string | null;
}) {
  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '2rem 1.5rem 5rem',
      }}
    >
      <Link href={backHref} className={kit.back}>
        ← Back to {season ? season.name : team.name}
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            font: '400 14px var(--club-text-face)',
            color: 'var(--club-soft)',
            marginBottom: '0.4rem',
          }}
        >
          {org.name} · {team.name}
        </div>
        <h1 className={kit.title}>
          {season ? `Tryout application — ${season.name}` : 'Tryout application'}
        </h1>
        {team.division && (
          <div style={{ font: '400 14px var(--club-text-face)', color: 'var(--club-soft)' }}>
            {team.division}
          </div>
        )}
      </div>

      {!season ? (
        <div className={kit.card} style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <h2
            style={{
              font: '700 16px var(--club-text-face)',
              color: 'var(--club-text)',
              margin: '0 0 0.5rem',
            }}
          >
            Registration is not currently open
          </h2>
          <p style={{ font: '400 14px var(--club-text-face)', color: 'var(--club-soft)', margin: '0 0 1rem' }}>
            {team.name} isn’t taking tryout sign-ups right now.
          </p>
          {contactEmail && (
            <p style={{ font: '400 14px var(--club-text-face)', color: 'var(--club-soft)', margin: 0 }}>
              Questions?{' '}
              <a
                href={`mailto:${contactEmail}`}
                style={{ color: 'var(--club-ink)', textDecoration: 'underline' }}
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
  );
}
