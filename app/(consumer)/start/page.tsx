import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { isCoachesPortalPurchasable } from '@/lib/plan-gating-server';
import styles from './start.module.css';

export const metadata: Metadata = {
  title: 'Get started — FieldLogicHQ',
  description: 'Tell us your job and start free — run a tournament, coach a team, start a league season, or explore Club.',
};

type StartOption = {
  href: string;
  icon: LucideIcon;
  accent?: 'free' | 'coach';
  label: string;
  title: string;
  body: string;
  tag?: { text: string; tone?: 'free' | 'soon' };
};

const OPTIONS: StartOption[] = [
  {
    href: '/start/tournament',
    icon: Trophy,
    accent: 'free',
    label: 'Organizer',
    title: 'Run a tournament',
    body: 'Create a tournament free — registration, schedule, brackets, and a public site. No credit card.',
    tag: { text: 'Free', tone: 'free' },
  },
];

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

// Coaches Portal launch (BUSINESS_DECISIONS 2026-07-20 D2 + FOUNDING_SEASON_COACHES_FREE_PLAN
// Phase 3): the "Coach a team" door flips WITH the team checkout gate, so the whole coaches launch
// (door + $0 Premium comp path + copy) turns on together per environment when the gate reopens —
// never a "Free" door landing on a gated dead end. Open → the live free team setup; gated → the
// express-interest explainer.
function coachOption(checkoutOpen: boolean): StartOption {
  return checkoutOpen
    ? {
        href: '/start/team',
        icon: Users,
        accent: 'free',
        label: 'Coach',
        title: 'Coach a team',
        body: 'A free team home for your season — no organization needed. Track your registrations and team.',
        tag: { text: 'Free', tone: 'free' },
      }
    : {
        href: '/for-coaches',
        icon: Users,
        label: 'Coach',
        title: 'Coach a team',
        body: 'A free team home for your season — no organization needed. Track your registrations and team.',
        tag: { text: 'Coming soon', tone: 'soon' },
      };
}

// S1-1 rider (owner, 2026-07-20): the chooser promotes only what's live — no League or
// Club cards until each is actually ready. League auto-returns the day its beta flag
// turns on; Club returns via its own decision. Their /start sub-pages stay reachable
// by direct URL (harmless express-interest pages), just not promoted here.
const LEAGUE_OPTION: StartOption = {
  href: '/start/league',
  icon: CalendarDays,
  accent: 'free',
  label: 'League admin',
  title: 'Start a league season',
  body: 'Run a house-league season — registration, draft, scheduling, standings, and parent comms.',
  tag: { text: 'Free', tone: 'free' },
};

export default async function StartPage() {
  // Staff use /platform-admin — keep them out of the operator on-ramp (defense-in-depth;
  // the create child routes also guard).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  // League Starter is an unlisted capped beta: the card only exists while the flag is
  // on (S1-1 rider — nothing not-yet-live is promoted on this surface).
  const leagueStarterLive = process.env.LEAGUE_STARTER_BETA === 'true';
  const coach = coachOption(await isCoachesPortalPurchasable());
  const options: StartOption[] = leagueStarterLive
    ? [...OPTIONS, coach, LEAGUE_OPTION]
    : [...OPTIONS, coach];

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
                      <span className={styles.tag} data-tone={opt.tag.tone}>{opt.tag.text}</span>
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
