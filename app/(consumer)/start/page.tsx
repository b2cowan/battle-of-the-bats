import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { isCoachesPortalPurchasable } from '@/lib/plan-gating-server';
import { COACH_DOOR_HREF, coachStartDoor } from '@/lib/start-menu';
import { gatedPlanTag } from '@/lib/plan-config';
import styles from './start.module.css';
import { getSignedInUser } from '@/lib/two-step-session';
import { isPaidDoorOpen } from '@/lib/start-plan-server';

/** W43 (ruled 2026-11-18): the description names only the doors the chooser shows, read from the live gate. */
export async function generateMetadata(): Promise<Metadata> {
  const [clubOpen, leaguePlusOpen] = await Promise.all([isPaidDoorOpen('club'), isPaidDoorOpen('league')]);
  const description = clubOpen && leaguePlusOpen
    ? 'Tell us your job and get started — run a tournament, coach a team, start a league season, or start a club.'
    : clubOpen
      ? 'Tell us your job and get started — run a tournament, coach a team, or start a club.'
      : leaguePlusOpen
        ? 'Tell us your job and get started — run a tournament, coach a team, or start a league season.'
        // Closed: no "start free" over paid doors, and no doors the chooser does not show.
        : 'Tell us your job and get started — run a tournament or coach a team.';
  return { title: 'Get started', description };
}

type StartOption = {
  href: string;
  icon: LucideIcon;
  accent?: 'free' | 'coach' | 'paid';
  label: string;
  title: string;
  body: string;
  /** Only a status that is NOT a price: a door that is not live yet. There is no Free / Paid pill (owner 2026-11-19):
   *  every door can lead to a paid plan, so the price talk lives in the card's sentence and on the page it opens. */
  tag?: { text: string };
};

/** The paid doors' cards (W44–W45, On-sale pages S2): shown only while their plan is on sale, after the two free doors. */
const CLUB_OPTION: StartOption = {
  href: '/start/club',
  icon: Building2,
  accent: 'paid',
  label: 'Club executive',
  title: 'Start a club',
  body: 'Tournaments, house league, rep teams and accounting in one place. Choose Club or Club · Association by how many teams will have a Premium Coaches Portal. House league teams are unlimited.',
};
const LEAGUE_PLUS_OPTION: StartOption = {
  href: '/start/league',
  icon: CalendarDays,
  accent: 'paid',
  label: 'League admin',
  title: 'Start a league season',
  body: 'Run a house league season — registration, draft, scheduling, standings, and parent messaging.',
};

const TOURNAMENT_OPTION: StartOption = {
  href: '/start/tournament',
  icon: Trophy,
  accent: 'free',
  label: 'Organizer',
  title: 'Run a tournament',
  body: 'Create a tournament free — your teams, schedule, brackets, and a public site. No credit card.',
};

/**
 * The invitation aside — NOT a card (owner-directed 2026-08-07).
 *
 * The cards are things you DECIDE: what do you want to build? An invitation already exists and has
 * your name on it — you are not choosing a path, you are picking up something addressed to you.
 * Listed among the ambitions it made a visitor read three options and rule two out; below the rule
 * it is simply there for the person it belongs to.
 *
 * It keeps its original job (signup-org decoupling: create an ACCOUNT only, no org — after
 * verifying they land on /home where the pending-invite card lets them accept, per the Sign-up
 * Invite Guard, Phase 3). ⚠ It must stay visible without scrolling on a phone: an invitee who
 * cannot find this takes the org-creation path instead, which is the exact mis-route the guard
 * exists to prevent.
 *
 * Copy is /marketing's (2026-08-07). The email sentence is the load-bearing half — matching the
 * address the invitation was sent to is what surfaces it, and "which email do I use?" is the
 * question that otherwise becomes a support message. "Club or team", never "organization", which
 * is our word rather than a volunteer's.
 */
const INVITE_ASIDE = {
  href: '/auth/signup?account=1',
  question: 'Joining a club or team you were invited to?',
  body: "Create an account with the email address the invitation was sent to — it'll be waiting for you.",
  cta: 'Accept an invitation',
};

// Coaches Portal launch (BUSINESS_DECISIONS 2026-07-20 D2): the "Coach a team" door flips WITH the team checkout gate, so the whole coaches launch
// (door + copy) turns on together per environment when the gate reopens —
// never a door landing on a gated dead end. Open → the Premium sign-up; gated → the express-interest explainer.
// Owner ruling 2026-11-19: the card no longer offers a free team home (it did once the promo closed) and says
// nothing "free" — the Premium portal is paid at sign-up with no trial. The free Basic portal is the one a coach
// gets by entering a tournament; only a door that comes from a tournament may say "free".
const PREMIUM_BODY = "Your team's operations HQ — roster, lineups, budget, schedule, and documents. No organization needed.";

function coachOption(checkoutOpen: boolean): StartOption {
  // Where the card leads AND which words it wears come from THE one coach rule (lib/start-menu.ts): the top bar's
  // menu and the coach demo read it too, so every "Coach a team" opens the same door (The first look, rule 8).
  const door = coachStartDoor(checkoutOpen);
  const base = { href: COACH_DOOR_HREF[door], icon: Users, title: 'Coach a team', label: 'Premium Coaches Portal', body: PREMIUM_BODY };
  return door === 'premium'
    ? { ...base, accent: 'coach' }
    : { ...base, tag: { text: gatedPlanTag('team') } };
}

export default async function StartPage() {
  // Staff use /platform-admin — keep them out of the operator on-ramp (defense-in-depth;
  // the create child routes also guard).
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  const [checkoutOpen, clubOpen, leaguePlusOpen] = await Promise.all([
    isCoachesPortalPurchasable(), isPaidDoorOpen('club'), isPaidDoorOpen('league'),
  ]);
  const coach = coachOption(checkoutOpen);
  // S1-1 rider (owner, 2026-07-20): the chooser promotes only what's live — the Club and League Plus cards only while each
  // is on sale; their /start sub-pages stay reachable by direct URL (express-interest pages). There is no free League
  // card (owner ruling 2026-11-19).
  const options: StartOption[] = [
    TOURNAMENT_OPTION,
    coach,
    ...(clubOpen ? [CLUB_OPTION] : []),
    ...(leaguePlusOpen ? [LEAGUE_PLUS_OPTION] : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Get started</span>
          <h1 className={styles.title}>What do you want to do?</h1>
          <p className={styles.sub}>Pick where you&apos;re starting</p>
        </header>

        <div className={styles.grid}>
          {options.map(opt => {
            const Icon = opt.icon;
            return (
              <Link key={opt.href} href={opt.href} className={styles.card}>
                <div className={styles.cardIcon} data-accent={opt.accent}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardLabel}>{opt.label}</span>
                    {opt.tag && (
                      <span className={styles.tag}>{opt.tag.text}</span>
                    )}
                  </div>
                  <div className={styles.cardTitle}>{opt.title}</div>
                  <div className={styles.cardBody}>{opt.body}</div>
                </div>
                <span className={styles.cardArrow} aria-hidden>
                  <ArrowRight size={16} strokeWidth={2.4} />
                </span>
              </Link>
            );
          })}
        </div>

        {/* (The "Basic Coaches Portal is free with no end date" quiet line is gone, owner 2026-11-19: no marketing
            door offers the free team home; a coach gets the free portal by entering a tournament.) */}

        {/* Two quiet lines, deliberately separated from the cards and from each other: the first is
            for someone who was invited, the second for someone who has already been here. Neither
            is a decision, so neither gets a card. */}
        <aside className={styles.invite}>
          <p className={styles.inviteQuestion}>{INVITE_ASIDE.question}</p>
          <p className={styles.inviteBody}>{INVITE_ASIDE.body}</p>
          <Link href={INVITE_ASIDE.href} className={styles.inviteCta}>{INVITE_ASIDE.cta} →</Link>
        </aside>

        <footer className={styles.footer}>
          Already started?{' '}
          <Link href="/discover" className={styles.footerLink}>Go to your workspaces</Link>
        </footer>
      </div>
    </div>
  );
}
