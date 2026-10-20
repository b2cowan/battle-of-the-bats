import Link from 'next/link';
import kit from '@/components/public/ClubKit.module.css';
import HelpCallout from '@/components/help/HelpCallout';

/**
 * A team's public tryout page — the markup the season-numbered page always drew, moved here so the
 * team-named address (`/{org}/teams/{team}/tryouts`, Club Tier Stage 2 B07) and the old addresses
 * render ONE page. Routing and rules changed; Club Tier Stage 4b-1 moved it onto the club's light frame (structure unchanged).
 *
 * `season` null = the team is not taking sign-ups (no live season, or its tryouts are closed, or an
 * old address named a season that is not the live one).
 */
export default function TryoutLandingView({
  orgSlug, teamSlug, org, contactEmail, team, season, registerHref,
}: {
  orgSlug: string;
  teamSlug: string;
  org: { name: string };
  /** The club's public-site contact (resolvePublicTryout), never the org's phantom `contactEmail` (F09). */
  contactEmail: string | null;
  team: { name: string; division?: string | null };
  season: { name: string; tryoutDescription: string | null; tryoutOpen: boolean } | null;
  registerHref: string;
}) {
  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '2rem 1.5rem 5rem',
      }}
    >
      <Link href={`/${orgSlug}/teams/${teamSlug}`} className={kit.back}>
        ← Back to {team.name}
      </Link>

      <div style={{ marginBottom: '2.5rem' }}>
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
          {season ? `${season.name} tryouts` : `${team.name} tryouts`}
        </h1>
        {team.division && (
          <div style={{ font: '400 14px var(--club-text-face)', color: 'var(--club-soft)', marginTop: '0.25rem' }}>
            {team.division}
          </div>
        )}
      </div>

      {season?.tryoutDescription && (
        <div
          className={kit.card}
          style={{
            marginBottom: '2rem',
            font: '400 16px/1.6 var(--club-text-face)',
            color: 'var(--club-text)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {season.tryoutDescription}
        </div>
      )}

      {season?.tryoutOpen ? (
        <div>
          {/* The status chip (DC-04): the one green "open" pill. */}
          <div className={`${kit.chip} ${kit.chipOk}`} style={{ marginBottom: '1.25rem' }}>
            Tryouts open
          </div>
          <div>
            <Link href={registerHref} className={`${kit.btn} ${kit.btnPrimary}`}>
              Register for tryouts
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
              {contactEmail && (
                <> Questions? <a href={`mailto:${contactEmail}`} style={{ color: 'var(--club-ink)' }}>Contact us</a>.</>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
