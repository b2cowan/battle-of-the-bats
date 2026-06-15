import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Compass,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
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
    // Coaches Portal is still in development (not customer-ready) — route to the express-interest
    // page, not the live /start/team create flow. Flip back to '/start/team' + Free when it launches.
    href: '/for-coaches',
    icon: Users,
    label: 'Coach',
    title: 'Coach a team',
    body: 'A free team home for your season — no organization needed. Track your registrations and team.',
    tag: { text: 'Coming soon', tone: 'soon' },
  },
  {
    href: '/start/league',
    icon: CalendarDays,
    // accent + tag are set dynamically below from the LEAGUE_STARTER_BETA flag.
    label: 'League admin',
    title: 'Start a league season',
    body: 'Run a house-league season — registration, draft, scheduling, standings, and parent comms.',
    tag: { text: 'Coming soon', tone: 'soon' },
  },
  {
    href: '/start/club',
    icon: Building2,
    label: 'Club',
    title: 'Explore Club',
    body: 'Everything in one place for multi-team clubs. Talk to us about a guided setup for your organization.',
    tag: { text: 'Talk to us', tone: 'soon' },
  },
  {
    // Invited / joining branch (signup-org decoupling): create an ACCOUNT only — no org.
    // After verifying, they land on /home where the pending-invite card lets them accept.
    // This is the account-first path; the options above create an organization.
    href: '/auth/signup?account=1',
    icon: UserPlus,
    label: 'Joining a team',
    title: 'I was invited',
    body: 'Someone invited you to their organization? Create an account to accept your invitation — no organization needed.',
  },
];

export default async function StartPage() {
  // Staff use /platform-admin — keep them out of the operator on-ramp (defense-in-depth;
  // the create child routes also guard).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  // League Starter is an unlisted capped beta: when the flag is on, the picker shows it as a
  // live free start; otherwise it stays "Coming soon" (the page itself shows the waitlist).
  const leagueStarterLive = process.env.LEAGUE_STARTER_BETA === 'true';
  const options: StartOption[] = OPTIONS.map(opt =>
    opt.href === '/start/league' && leagueStarterLive
      ? { ...opt, accent: 'free', tag: { text: 'Free', tone: 'free' } }
      : opt,
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <Compass size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>What do you want to do?</h1>
          <p className={styles.sub}>Pick where you&apos;re starting — you can add more later</p>
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
          <Link href="/home" className={styles.footerLink}>Go to your workspaces</Link>
        </footer>
      </div>
    </div>
  );
}
