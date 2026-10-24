import Link from 'next/link';
import kit from '@/components/public/ClubKit.module.css';
import styles from '@/components/public/TryoutPage.module.css';
import TryoutDays from '@/components/public/TryoutDays';
import ClubContactCard, { COPY_CLUB_EMAIL } from '@/components/public/ClubContactCard';
import TryoutQuestionsLine from '@/components/public/TryoutQuestionsLine';
import TryoutChip from '@/components/public/TryoutChip';
import {
  tryoutSeasonMeta,
  tryoutStateSentence,
  type TryoutDay,
  type TryoutState,
} from '@/lib/tryout-season';
import { tryoutStateShowsCoachContact } from '@/lib/tryout-contact-rules';
import { possessive } from '@/lib/utils';

/**
 * A team's public tryout page (Club Tier Stage 4b-2b; End state 4, the closed and finished frames, the asks page ruled
 * 2026-10-20) — the team-named address (`/{org}/teams/{team}/tryouts`) and the old season-numbered ones render this ONE
 * page. When and where come first, from the tryout days the coach already entered. Four states, decided by the one rule
 * (lib/tryout-season.ts), never here:
 *
 *   · Tryouts open — the days, "From the club", "Sign up for tryouts", the club's contact.
 *   · Not open yet — the days, "From the club" (Stage 4c-2: the cost and who may come, before a family has to ask), then
 *                    the closed frame's card ("Sign-ups … aren't open yet." + the contact).
 *   · Finished     — "Tryouts for the 2027 season finished on Mon, Sep 7." + the contact.
 *   · Closed       — "13U AAA isn't taking tryout sign-ups right now." + the contact.
 *
 * It never dead-ends: every state carries the club's contact, and "← {team}" at the top is the one way on to the team
 * in every state (a second "See the team" at the foot went to the same page and was removed, owner 2026-10-21).
 */
export default function TryoutLandingView({
  orgSlug, teamSlug, team, state, season, born = null, upcoming, lastDay, today, contactEmail, coachContact = null, registerHref, teamHref: teamHrefProp,
  preview = false,
}: {
  orgSlug: string;
  teamSlug: string;
  team: { name: string; sport: string | null };
  state: TryoutState;
  /** The team's live season (null for an archived team or one with none). */
  season: { year: number | null; name: string; tryoutDescription: string | null } | null;
  /** The season's birth years in the form that follows a dot (`bornFactsOf(…).meta`: "born 2012–2013"); none, no years to say. */
  born?: string | null;
  /** The tryout days still ahead (the one rule's `upcoming`). */
  upcoming: readonly TryoutDay[];
  lastDay: string | null;
  today: string;
  /** The club's public-site contact (resolvePublicTryout), never the org's phantom `contactEmail` (F09). */
  contactEmail: string | null;
  /**
   * The head coach's own address for this page's questions (Club Tier 4c-2 Part B, Ask 3), with their name only when their
   * own name switch is on. ⚠ Passed by the team-named tryout page ALONE (`getPublicTryoutContact`), and shown only while
   * open or not open yet; finished and closed keep the club's line (I5).
   */
  coachContact?: { email: string; name: string | null } | null;
  registerHref: string;
  /** The team page's link spelled for the address the visitor is on (a club's own address has no club name in a path); default: ours. */
  teamHref?: string;
  /** The admin's "How families see it" box (the tryout blurb): the same page minus its way back, which is the page's own. */
  preview?: boolean;
}) {
  const teamHref = teamHrefProp ?? `/${orgSlug}/teams/${teamSlug}`;
  // The closed frame names no season (there is nothing to sign up for); the others say which season the tryouts are for.
  const meta = season && state !== 'closed' ? tryoutSeasonMeta(season, born) : null;
  // "From the club" reads while sign-ups are open and while they are not open yet; finished and closed pages hide it (D24).
  const blurb = state === 'open' || state === 'notOpenYet' ? season?.tryoutDescription?.trim() || null : null;
  const blurbSection = blurb && (
    <section className={kit.section} aria-labelledby="from-the-club">
      <h2 id="from-the-club" className={kit.sectionTitle}>From the club</h2>
      <div className={kit.list}><p className={styles.blurb}>{blurb}</p></div>
    </section>
  );
  const seasonName = { year: season?.year ?? null, name: season?.name ?? '' };
  // I1–I3: the coach's line replaces the club's while open or not open yet; the footer keeps the club's (I6).
  const coach = coachContact && tryoutStateShowsCoachContact(state) ? coachContact : null;
  // Whom a family asks, decided once: the coach's line (I1–I3), or null for the club's own words below.
  const coachAsk = coach && {
    email: coach.email,
    lead: `Questions about these tryouts? Email ${coach.name ? `${coach.name}, head coach` : 'the head coach'}`,
    copyLabel: coach.name ? `Copy ${possessive(coach.name)} email address` : 'Copy the head coach’s email address',
  };

  return (
    <div className={`${styles.page}${preview ? ` ${styles.pagePreview}` : ''}`}>
      {/* The way back to the team stays: the tab row has no entry for one team (design log 2026-10-20). */}
      {!preview && (
        <Link href={teamHref} className={`${kit.back} ${styles.back}`} aria-label={`Back to ${team.name}`}>
          ← {team.name}
        </Link>
      )}

      <div className={styles.head}>
        <h1 className={kit.title}>{team.name} tryouts</h1>
        {meta && <p className={styles.meta}>{meta}</p>}
        <TryoutChip state={state} className={styles.chip} />
      </div>

      {(state === 'open' || state === 'notOpenYet') && <TryoutDays days={upcoming} sport={team.sport} />}

      {blurbSection}

      {state === 'open' ? (
        <>
          <Link href={registerHref} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnFull}`}>Sign up for tryouts</Link>
          <TryoutQuestionsLine {...(coachAsk ?? { email: contactEmail, lead: 'Questions? Email the club at', copyLabel: COPY_CLUB_EMAIL })} />
        </>
      ) : (
        <ClubContactCard
          sentence={tryoutStateSentence(state, team.name, seasonName, lastDay, today)}
          {...(coachAsk ?? { email: contactEmail })}
        />
      )}
    </div>
  );
}
