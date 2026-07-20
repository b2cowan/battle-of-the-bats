import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
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
  {
    // Invited / joining branch (signup-org decoupling): create an ACCOUNT only — no org.
    // After verifying, they land on /home where the pending-invite card lets them accept.
    // Kept near the top so an invitee self-selects here instead of the org-creation path
    // (Sign-up Invite Guard, Phase 3).
    href: '/auth/signup?account=1',
    icon: UserPlus,
    label: 'Joining a team',
    title: 'I was invited',
    body: 'Someone invited you to their organization? Create an account to accept your invitation — no organization needed.',
  },
];

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
  const teamCheckoutOpen = !(await getPlanGatingMap()).team;
  const coach = coachOption(teamCheckoutOpen);
  const options: StartOption[] = leagueStarterLive
    ? [...OPTIONS, coach, LEAGUE_OPTION]
    : [...OPTIONS, coach];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <Compass size={21} strokeWidth={1.8} aria-hidden />
          </div>
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

        <footer className={styles.footer}>
          Already started?{' '}
          <Link href="/discover" className={styles.footerLink}>Go to your workspaces</Link>
        </footer>
      </div>
    </div>
  );
}
