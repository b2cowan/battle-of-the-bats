import Link from 'next/link';
import kit from '@/components/public/ClubKit.module.css';
import styles from '@/components/public/TryoutPage.module.css';
import TryoutDays from '@/components/public/TryoutDays';
import ClubContactCard from '@/components/public/ClubContactCard';
import ClubContactLine from '@/components/public/ClubContactLine';
import TryoutChip from '@/components/public/TryoutChip';
import {
  tryoutSeasonMeta,
  tryoutStateSentence,
  type TryoutDay,
  type TryoutState,
} from '@/lib/tryout-season';

/**
 * A team's public tryout page (Club Tier Stage 4b-2b; End state 4, the closed and finished frames, the asks page ruled
 * 2026-10-20) — the team-named address (`/{org}/teams/{team}/tryouts`) and the old season-numbered ones render this ONE
 * page. When and where come first, from the tryout days the coach already entered. Four states, decided by the one rule
 * (lib/tryout-season.ts), never here:
 *
 *   · Tryouts open — the days, "From the club", "Sign up for tryouts", the club's contact.
 *   · Not open yet — the days, then the closed frame's card ("Sign-ups … aren't open yet." + the contact), "See the team".
 *   · Finished     — "Tryouts for the 2027 season finished on Mon, Sep 7." + the contact, "See the team".
 *   · Closed       — "13U AAA isn't taking tryout sign-ups right now." + the contact, "See the team".
 *
 * It never dead-ends: every state carries the club's contact and a way on to the team.
 */
export default function TryoutLandingView({
  orgSlug, teamSlug, team, state, season, upcoming, lastDay, today, contactEmail, registerHref,
}: {
  orgSlug: string;
  teamSlug: string;
  team: { name: string; sport: string | null };
  state: TryoutState;
  /** The team's live season (null for an archived team or one with none). */
  season: { year: number | null; name: string; tryoutDescription: string | null } | null;
  /** The tryout days still ahead (the one rule's `upcoming`). */
  upcoming: readonly TryoutDay[];
  lastDay: string | null;
  today: string;
  /** The club's public-site contact (resolvePublicTryout), never the org's phantom `contactEmail` (F09). */
  contactEmail: string | null;
  registerHref: string;
}) {
  const teamHref = `/${orgSlug}/teams/${teamSlug}`;
  // The closed frame names no season (there is nothing to sign up for); the others say which season the tryouts are for.
  const meta = season && state !== 'closed' ? tryoutSeasonMeta(season) : null;
  const blurb = state === 'open' ? season?.tryoutDescription?.trim() || null : null;
  const seasonName = { year: season?.year ?? null, name: season?.name ?? '' };

  return (
    <div className={styles.page}>
      {/* The way back to the team stays: the tab row has no entry for one team (design log 2026-10-20). */}
      <Link href={teamHref} className={`${kit.back} ${styles.back}`} aria-label={`Back to ${team.name}`}>
        ← {team.name}
      </Link>

      <div className={styles.head}>
        <h1 className={kit.title}>{team.name} tryouts</h1>
        {meta && <p className={styles.meta}>{meta}</p>}
        <TryoutChip state={state} className={styles.chip} />
      </div>

      {(state === 'open' || state === 'notOpenYet') && <TryoutDays days={upcoming} sport={team.sport} />}

      {state === 'open' ? (
        <>
          {blurb && (
            <section className={kit.section} aria-labelledby="from-the-club">
              <h2 id="from-the-club" className={kit.sectionTitle}>From the club</h2>
              <div className={kit.list}><p className={styles.blurb}>{blurb}</p></div>
            </section>
          )}
          <Link href={registerHref} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnFull}`}>Sign up for tryouts</Link>
          <ClubContactLine email={contactEmail} />
        </>
      ) : (
        <>
          <ClubContactCard sentence={tryoutStateSentence(state, team.name, seasonName, lastDay, today)} email={contactEmail} />
          <Link href={teamHref} className={`${kit.btn} ${kit.btnSecondary} ${kit.btnFull}`}>See the team</Link>
        </>
      )}
    </div>
  );
}
