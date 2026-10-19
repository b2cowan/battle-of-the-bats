'use client';
import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { UserPlus, AlertCircle, ChevronDown, RefreshCw, CreditCard, CheckCircle, Calendar, Mail, Eye, Check, Lock } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { getRegistrationState } from '@/lib/registration-state';
import { Division, Tournament, TournamentRegistrationField } from '@/lib/types';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import Countdown from '@/components/public/Countdown';
import styles from '@/app/[orgSlug]/register/register.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import {
  alreadyRegisteredLine, differentTeamSentence, isChoosableTeam, pickEntryHeadCoach, TEAM_ALREADY_REGISTERED, whoRegistersSentence,
  type CardHeadCoach, type RegistrableTeam,
} from '@/lib/registrable-teams';
import { SIGN_IN_ERROR_COPY, isValidEmail } from '@/lib/auth-errors';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import VerifyEmailSent, { requestVerificationLink } from '@/components/auth/VerifyEmailSent';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';

/**
 * The steps, EMAIL FIRST (owner A1, 2026-10-13 — `COACH_REGISTER_EXISTING_TEAM_PLAN.md`):
 *   email   — Step 1 "You": one question. Today's form opened as a new-team form and learned who the
 *             coach was only at Submit (F1, F2); a coach in a chat app's browser typed a new team name
 *             into the first box before the form knew he had a team.
 *   signin  — Step 1, an email with an account: the password, right there.
 *   form    — a signed-in coach's Step 2 "Team" (the team cards), or a NEW coach's details (team and
 *             person asked together; the marker stays on "You").
 *   review / submitting / success / error — as before.
 */
type Step = 'email' | 'signin' | 'form' | 'review' | 'submitting' | 'success' | 'error';

/** The team cards' choice that makes a new team instead of registering one of the coach's own. */
const DIFFERENT_TEAM = 'different';

type FeeSchedule = {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
  source: 'tournament' | 'division';
};

type CustomAnswerState = Record<string, string>;
type CustomFileState = Record<string, File | null>;

type RegistrationConfirmation = {
  id?: string;
  status: 'pending' | 'waitlist';
  joinHref: string;
  /** Verify every sign-up: the address the link went to — the success card shows the check-your-email block. */
  verifyEmail?: string;
  /** A line for the success card when the coach's account couldn't be made here. */
  note?: string;
};

/** How a card reads: greyed (`blocked`) or a radio, the sentence under its name, and an optional link after it. */
type CardState = { blocked: 'locked' | 'entered' | null; sub: string; href?: string };

/**
 * How one of this person's teams reads on Step 2 — "where it already is" beats "who can register it":
 *   entered — already in this tournament (one team, one entry — owner, 2026-10-16): where, and a link to
 *             that registration, the record the form lands on after Submit. A locked card gets no link:
 *             schedule editing opens the record too (B1), and the card can't tell whether this person
 *             holds it — a link that may refuse them is worse than none.
 *   locked  — this person can't register it: who can. Shown, not hidden, so the empty space never reads as
 *             "make a new team" (F5); an entered card is greyed for the same reason.
 *   open    — whose team it is.
 */
function cardState(team: RegistrableTeam): CardState {
  if (team.alreadyIn) {
    return {
      blocked: 'entered',
      sub: alreadyRegisteredLine(team.name, team.alreadyIn),
      href: team.locked ? undefined : `${COACHES_TOURNAMENTS_PATH}/${team.alreadyIn.registrationId}`,
    };
  }
  if (team.locked) return { blocked: 'locked', sub: whoRegistersSentence(team) };
  return {
    blocked: null,
    sub: team.isPortalTeam ? `Your Premium team${team.youAre ? ` · you’re ${team.youAre}` : ''}` : 'Your free Coaches Portal team',
  };
}

/** Sign-in failures on Step 1: the sign-in page's words, with "wrong password" pointing at the reset link below it. */
const SIGN_IN_ERRORS: Readonly<Record<string, string>> = {
  ...SIGN_IN_ERROR_COPY,
  invalid_credentials: 'That password doesn’t match this account. Try again, or reset it below.',
};

function formatAgeRange(minAge: number | null, maxAge: number | null) {
  if (minAge === null && maxAge === null) return '';
  if (minAge === null) return `Ages under ${maxAge}`;
  if (maxAge === null) return `Ages ${minAge}+`;
  if (minAge === maxAge) return `Age ${minAge}`;
  return `Ages ${minAge}-${maxAge}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function resolveFeeSchedule(tournament: Tournament | null, group: Division | undefined): FeeSchedule | null {
  if (!tournament || !group) return null;

  if (tournament.feeScheduleMode === 'division' && group.totalFeeAmount != null) {
    return {
      depositAmount: group.depositAmount ?? null,
      depositDueDate: group.depositDueDate ?? null,
      totalFeeAmount: group.totalFeeAmount ?? null,
      totalFeeDueDate: group.totalFeeDueDate ?? null,
      source: 'division',
    };
  }

  if (tournament.totalFeeAmount == null) return null;
  return {
    depositAmount: tournament.depositAmount ?? null,
    depositDueDate: tournament.depositDueDate ?? null,
    totalFeeAmount: tournament.totalFeeAmount ?? null,
    totalFeeDueDate: tournament.totalFeeDueDate ?? null,
    source: 'tournament',
  };
}

/**
 * Shared "Payment handled by organizer" panel — rendered identically on the form
 * step and the review step. `instructions` is only passed when the organizer chose
 * to surface their how-to-pay text on the public form (default: email-only).
 */
function PaymentPanel({ feeSchedule, instructions, style }: {
  feeSchedule: FeeSchedule | null;
  instructions: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={styles.paymentNotice} style={style}>
      <div className={styles.paymentNoticeHeader}>
        <CreditCard size={18} />
        <span>Payment handled by organizer</span>
      </div>
      {feeSchedule?.totalFeeAmount ? (
        <div className={styles.paymentDetails}>
          <div>
            <span>Total fee</span>
            <strong>{formatMoney(feeSchedule.totalFeeAmount)}</strong>
            {formatDate(feeSchedule.totalFeeDueDate) && (
              <em>Due {formatDate(feeSchedule.totalFeeDueDate)}</em>
            )}
          </div>
          {feeSchedule.depositAmount ? (
            <div>
              <span>Deposit</span>
              <strong>{formatMoney(feeSchedule.depositAmount)}</strong>
              {formatDate(feeSchedule.depositDueDate) && (
                <em>Due {formatDate(feeSchedule.depositDueDate)}</em>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <p>The organizer has not published a fee schedule for this division yet.</p>
      )}
      {instructions && (
        <div className={styles.paymentInstructions}>
          <span className={styles.paymentInstructionsLabel}>How to pay</span>
          <p>{instructions}</p>
        </div>
      )}
      <p>Payments are made directly to the organizer, outside the platform.</p>
    </div>
  );
}

/** YYYY-MM-DD → YYYYMMDD, offset by `addDays` (used for all-day ICS DTEND, which is exclusive). */
function toIcsDate(date: string, addDays = 0): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Build + download a universal .ics all-day event covering the tournament dates. */
function downloadTournamentCalendar(tournament: Tournament, url: string) {
  if (!tournament.startDate) return;
  const end = tournament.endDate || tournament.startDate;
  const escape = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FieldLogicHQ//Tournament//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:tournament-${tournament.id}@fieldlogichq`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(tournament.startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(end, 1)}`,
    `SUMMARY:${escape(tournament.name)}`,
    `URL:${escape(url)}`,
    `DESCRIPTION:${escape(`${tournament.name} — see schedule, scores, and updates at ${url}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${tournament.slug || 'tournament'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

/**
 * Shared Team Registration experience used by BOTH the live public route
 * (app/[orgSlug]/[tournamentSlug]/register) and the admin tournament preview.
 *
 * `isPreview` shows a preview banner and blocks the final submit / inline account
 * creation, so an organizer sees the real form (fees, custom fields, steps) exactly
 * as a registrant will, without creating a registration or an account. In preview, Step 1's
 * Continue goes straight to the new-coach form (no account lookup, no sign-in).
 */
/** The verification link's return for a registration made signed out: the join page links it, then opens its record
 *  with the portal's welcome (verify every sign-up, 2026-10-16). */
function registrationPortalPath(registrationId: string | undefined, email: string): string {
  if (!registrationId) return '/coaches/tournaments';
  const record = `/coaches/tournaments/${registrationId}?welcome=1`;
  return `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(record)}&verified=1`;
}

export default function RegisterContent({ isPreview = false, initialData = null }: { isPreview?: boolean; initialData?: PublicTournamentPageData | null }) {
  const params         = useParams();
  const router         = useRouter();
  const pathname       = usePathname();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationFields, setRegistrationFields] = useState<TournamentRegistrationField[]>([]);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [stats, setStats]           = useState<Record<string, number>>({});
  const [loaded, setLoaded]         = useState(false);
  const [step, setStep]             = useState<Step>('email');
  const [errorMsg, setErrorMsg]     = useState('');
  // Inline notice on the form (e.g. a returning coach who just got signed in mid-register).
  const [noticeMsg, setNoticeMsg]   = useState('');
  // Step 1's own error line (a refused email, a wrong password) — Step 1 never drops to the error card.
  const [stepError, setStepError]   = useState('');
  const [stepBusy, setStepBusy]     = useState(false);
  const [form, setForm] = useState({
    teamName: '', firstName: '', lastName: '', email: '', password: '', divisionId: '',
  });
  const [customAnswers, setCustomAnswers] = useState<CustomAnswerState>({});
  const [customFiles, setCustomFiles] = useState<CustomFileState>({});
  const [signedInCoachEmail, setSignedInCoachEmail] = useState<string | null>(null);
  // True once the coach-session check has settled. Nothing but the loading line renders before it:
  // Step 1 must not flash at a coach who is already signed in and starts at Step 2 (J6-037's
  // no-flash lesson, which first gated only the fan off-ramp).
  const [coachSessionLoaded, setCoachSessionLoaded] = useState(false);
  // The signed-in account's name ('' when it has none). C3 (owner, 2026-10-15): a signed-in person is
  // never shown name boxes — they are their account, and "Registering as" never follows typing (G4).
  const [accountName, setAccountName] = useState('');
  // C2: the head coach picked on Step 2 when the chosen team has two or more ('' = nothing chosen yet,
  // so the pick is deliberate).
  const [headCoachChoice, setHeadCoachChoice] = useState('');
  // The teams this person may register (D1, `lib/registrable-teams.ts`) — the same list the server
  // checks. null = the list could not be loaded, which is NOT "you have none" (that would leave only
  // "A different team", the very trap F4 is about).
  const [registrableTeams, setRegistrableTeams] = useState<RegistrableTeam[] | null>([]);
  // The chosen card: a team's free-team id, DIFFERENT_TEAM, or '' (nothing chosen yet).
  const [teamChoice, setTeamChoice] = useState('');
  const [confirmation, setConfirmation] = useState<RegistrationConfirmation | null>(null);
  // Verify every sign-up (owner 2026-10-16): does a new account here prove its email by link (Step 1's answer).
  const [verifies, setVerifies] = useState(false);
  // The address this form already made a waiting account for (Step 1's check was busy, so the account came first).
  // A retry sends that account a fresh link instead of making it again — the second try would answer "already has
  // an account", and a sign-in to an account still waiting for its email always fails.
  const [waitingEmail, setWaitingEmail] = useState<string | null>(null);
  // Captured once (lazy init keeps render pure) — gates the success-screen countdown banner.
  const [mountedAtMs] = useState(() => Date.now());
  // Bumped by "Not you?": a team load that started before the sign-out is dropped when it lands.
  const sessionGeneration = useRef(0);

  useEffect(() => {
    async function init() {
      try {
        // The admin preview seeds data server-side (drafts included); the public
        // endpoint excludes non-public tournaments, so only fetch when not seeded.
        const data = initialData ?? await fetchPublicTournamentData(orgSlug, tournamentSlug, 'register');
        const current = data?.tournament ?? null;
        setTournament(current);
        setContactEmail(current?.contactEmail ?? data?.organization.contactEmail ?? null);
        if (current && data?.pageEnabled) {
          setDivisions(data.divisions);
          setRegistrationFields(data.registrationFields ?? []);
          // Per-division counts come from the public stats endpoint, which has no
          // draft data — skip it in preview; the form still renders from the seed.
          if (!isPreview) fetchStats(current.id);
        }
      } finally {
        setLoaded(true);
      }
    }
    init();

    async function fetchStats(tid: string) {
      try {
        const res = await fetch(`/api/public/stats?tournament_id=${tid}`);
        setStats(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
  }, [orgSlug, tournamentSlug, initialData, isPreview]);

  // Loads the signed-in coach's account + the teams they may register. Reused on mount, after Step
  // 1's sign-in, and after a returning coach is signed in mid-submit. Returns null when nobody is
  // signed in, else `{ teams }` (teams null = the list could not be loaded). Skipped in preview — the
  // preview never signs anyone in or attaches to a real coach account.
  const loadCoachTeams = useCallback(async (): Promise<{ teams: RegistrableTeam[] | null } | null> => {
    if (isPreview) return null;
    // A load that lands after "Not you?" signed this person out must not sign them back in on screen.
    const generation = sessionGeneration.current;
    try {
      // Time-boxed: a hung check must not leave the page on "Loading registration…" — it falls back to
      // Step 1, where a signed-in coach simply signs in again (/review 2026-10-14). Naming the page's
      // tournament marks each card whose team is already in it (one team, one entry — 2026-10-16); by
      // its address, so this load never waits for the tournament's own.
      const query = new URLSearchParams({ orgSlug, tournamentSlug });
      const res = await fetch(`/api/coaches/basic-teams?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (generation !== sessionGeneration.current) return null;
      if (res.status === 401 || !res.ok) return null;
      const data = await res.json() as {
        user?: { email?: string; name?: string };
        registrableTeams?: RegistrableTeam[] | null;
      };
      const userEmail = data.user?.email?.toLowerCase() ?? null;
      if (!userEmail || generation !== sessionGeneration.current) return null;
      const teams = data.registrableTeams ?? null;
      setSignedInCoachEmail(userEmail);
      setAccountName((data.user?.name ?? '').trim());
      setRegistrableTeams(teams);
      // "Already chosen when it is the only one" (drawn): exactly one Premium team this person may
      // register is picked for them; nothing is submitted until Review. No teams at all → the
      // new-team fields, with no cards to choose between. A team already in this tournament is never
      // picked for anyone.
      const openPortalTeams = (teams ?? []).filter(t => t.isPortalTeam && isChoosableTeam(t));
      const preselect = openPortalTeams.length === 1 ? openPortalTeams[0] : null;
      // A choice survives a reload only while it is still a card this person may choose — a team that
      // comes back locked, gone or already registered must not leave a submit that silently makes a new
      // team or a second entry (/review 10-14). A dropped choice is never swapped for another team: the
      // one-team preselect is for a first look, not for the moment after a refusal (/review 10-16).
      setTeamChoice(c => {
        if (c === DIFFERENT_TEAM) return c;
        if (c && (teams ?? []).some(t => t.basicCoachTeamId === c && isChoosableTeam(t))) return c;
        if (c) return '';
        if (preselect) return preselect.basicCoachTeamId;
        return teams && teams.length === 0 ? DIFFERENT_TEAM : '';
      });
      setForm(f => ({
        ...f,
        email: userEmail,
        // A2: the name in this tournament starts as the chosen team's name; a name already typed stays.
        teamName: f.teamName || preselect?.name || '',
      }));
      return { teams };
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [isPreview, orgSlug, tournamentSlug]);

  useEffect(() => {
    // Async wrapper: state updates happen after the fetch resolves, not synchronously
    // in the effect (loadCoachTeams is reused by the sign-in paths). A coach already signed in
    // (the same browser, or arriving from their portal) starts at Step 2.
    async function run() {
      try {
        if (await loadCoachTeams()) setStep(s => (s === 'email' ? 'form' : s));
      } finally { setCoachSessionLoaded(true); }
    }
    run();
  }, [loadCoachTeams]);

  const signedIn = !!signedInCoachEmail;
  const chosenTeam = teamChoice && teamChoice !== DIFFERENT_TEAM
    ? registrableTeams?.find(t => t.basicCoachTeamId === teamChoice && isChoosableTeam(t)) ?? null
    : null;
  // C1/C2: on a Premium card the portal names the coach — Review shows it, validation and Submit send
  // it. `headCoach` null on a free team, a club team or a staff list with no head coach: the person
  // registering is the coach. Not ok = two or more head coaches and none chosen yet.
  const headCoachPick = pickEntryHeadCoach(chosenTeam?.headCoaches ?? [], headCoachChoice);
  const entryHeadCoach = headCoachPick.ok ? headCoachPick.headCoach : null;
  const portalTeams = (registrableTeams ?? []).filter(t => t.isPortalTeam);
  // A signed-in coach chooses a card before the rest of the form appears ("Choose a team to
  // continue"); a new coach's form is all one screen.
  const teamPicked = !signedIn || teamChoice !== '';

  /**
   * One card chosen. A2 (owner, 2026-10-13): the name in this tournament starts as the chosen team's
   * name and stays editable — but a name the coach has TYPED is never thrown away by changing cards
   * (today's picker overwrote whatever was typed with the saved name).
   */
  function chooseTeam(choice: string) {
    const next = choice === DIFFERENT_TEAM ? null : registrableTeams?.find(t => t.basicCoachTeamId === choice && isChoosableTeam(t));
    if (choice !== DIFFERENT_TEAM && !next) return; // a locked or already-registered card is not choosable
    const previousName = chosenTeam?.name ?? '';
    setTeamChoice(choice);
    if (choice !== teamChoice) setHeadCoachChoice(''); // another team's head coaches: choose again
    setForm(f => {
      const untouched = !f.teamName.trim() || f.teamName === previousName;
      return untouched ? { ...f, teamName: next?.name ?? '' } : f;
    });
  }

  /** Step 1: does this email have an account? The answer picks the next screen. */
  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    if (stepBusy) return;
    const email = form.email.trim().toLowerCase();
    setStepError('');
    setNoticeMsg('');
    if (!isValidEmail(email)) {
      setStepError('Enter a valid email address.');
      return;
    }
    setForm(f => ({ ...f, email }));
    // Preview never looks anyone up: it shows the organizer what a NEW coach fills in.
    if (isPreview) { setStep('form'); return; }
    setStepBusy(true);
    try {
      const res = await fetch('/api/register/account-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({})) as { exists?: boolean; verifies?: boolean; error?: string };
      if (res.status === 429 || res.status >= 500) {
        // The check could not answer (busy, or the lookup failed). Never a dead end: fall back to the form
        // as it worked before email-first — a returning coach's password signs them in at Submit and they
        // pick their team then (the A4.4 path below), so nobody is stopped at Step 1 (/review 2026-10-14).
        setForm(f => ({ ...f, password: '' }));
        setNoticeMsg('We couldn’t check this email just now. If it already has a FieldLogicHQ account, use that password below — we’ll sign you in and you can pick your team before anything is submitted.');
        setStep('form');
        return;
      }
      if (!res.ok) {
        setStepError(data.error ?? 'We couldn’t check that email just now. Please try again.');
        return;
      }
      setForm(f => ({ ...f, password: '' }));
      setVerifies(data.verifies === true);
      setStep(data.exists ? 'signin' : 'form');
    } catch {
      setStepError('We couldn’t check that email just now. Please try again.');
    } finally {
      setStepBusy(false);
    }
  }

  /** Step 1, an email with an account: sign in right here, then Step 2 with the coach's teams. */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (stepBusy) return;
    setStepError('');
    if (!form.password) { setStepError('Enter your password.'); return; }
    setStepBusy(true);
    try {
      const { signIn } = await import('@/lib/auth');
      const { error } = await signIn(form.email.trim().toLowerCase(), form.password);
      if (error) {
        setStepError(SIGN_IN_ERRORS[error] ?? 'We couldn’t sign you in. Please try again.');
        return;
      }
      if (!(await loadCoachTeams())) {
        setStepError('You’re signed in, but we couldn’t load your teams. Reload the page to continue.');
        return;
      }
      setForm(f => ({ ...f, password: '' }));
      setStep('form');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setStepBusy(false);
    }
  }

  /** "Change" (signed out): back to Step 1 with the email kept, ready to correct. */
  function changeEmail() {
    setStepError('');
    setNoticeMsg('');
    setForm(f => ({ ...f, password: '' }));
    setStep('email');
  }

  /** "Not you?" (signed in): sign out and start again from Step 1, with nothing of theirs left behind. */
  async function notYou() {
    if (stepBusy) return;
    sessionGeneration.current += 1;
    setStepBusy(true);
    try {
      const { signOut } = await import('@/lib/auth');
      await signOut();
    } finally {
      setStepBusy(false);
    }
    setSignedInCoachEmail(null);
    setAccountName('');
    setHeadCoachChoice('');
    setRegistrableTeams([]);
    setTeamChoice('');
    setForm(f => ({ ...f, teamName: '', firstName: '', lastName: '', email: '', password: '' }));
    setStepError('');
    setNoticeMsg('');
    setStep('email');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateRegistrationDetails() {
    const selectedGroup = divisions.find(g => g.id === form.divisionId);
    if (!teamPicked || (teamChoice !== DIFFERENT_TEAM && !chosenTeam && signedIn)) {
      throw new Error('Choose which team you’re registering.');
    }
    if (!selectedGroup) throw new Error('Select a division before reviewing your registration.');
    if (!form.teamName.trim()) {
      throw new Error(chosenTeam ? 'Enter the name your team goes by in this tournament.' : 'Enter a team name.');
    }
    // C2: the same question the server asks at Submit, so Review never shows a pick it then refuses.
    if (!headCoachPick.ok) throw new Error(headCoachPick.error);
    // C3: only a new coach gives a name (it sets up their account); a signed-in person is their account.
    if (!signedIn && (!form.firstName.trim() || !form.lastName.trim())) {
      throw new Error('Enter your first and last name.');
    }
    // A new coach creates their Coaches Portal account inline — a password is required.
    if (!signedIn && form.password.length < 8) {
      throw new Error('Create a password (at least 8 characters) to set up your Coaches Portal.');
    }

    const count = stats[selectedGroup.id] || 0;
    const isWaitlist = Boolean(selectedGroup.capacity && count >= selectedGroup.capacity);
    const missingField = registrationFields.find(field => {
      if (!field.required) return false;
      if (field.fieldType === 'file') return !customFiles[field.id];
      if (field.fieldType === 'checkbox') return customAnswers[field.id] !== 'true';
      return !customAnswers[field.id]?.trim();
    });
    if (missingField) throw new Error(`Please complete: ${missingField.label}`);

    return { selectedGroup, isWaitlist, headCoach: headCoachPick.headCoach };
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    try {
      validateRegistrationDetails();
      setErrorMsg('');
      setNoticeMsg('');
      setStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  async function submitRegistration() {
    // Preview mode never submits — it would create a real registration + account.
    // Bounce back to the form with an explanatory notice instead.
    if (isPreview) {
      setNoticeMsg('Preview mode — submissions are disabled. On the live site this creates the registration and the registrant’s Coaches Portal account.');
      setStep('form');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const { selectedGroup, isWaitlist, headCoach } = validateRegistrationDetails();

      /** Sends the registration to the organizer — signed in (it links to the portal) or signed out. */
      const postRegistration = async (): Promise<{ id?: string; status?: 'pending' | 'waitlist' }> => {
        const payload = new FormData();
        // The name this team goes by in THIS tournament (A2) — for a chosen team, the coach may have
        // changed it from the team's own name; the team's own name never changes here.
        payload.append('teamName', form.teamName.trim());
        // A typed name — a new coach's. A signed-in person typed none: the server reads their account's
        // name, and a Premium team's coach is its head coach, read from the portal at Submit (Stage 1b).
        payload.append('coachName', `${form.firstName} ${form.lastName}`.trim());
        payload.append('email', (signedInCoachEmail || form.email).trim().toLowerCase());
        payload.append('divisionId', form.divisionId);
        payload.append('divisionName', selectedGroup.name);
        // contactEmail is resolved server-side from organization_members
        payload.append('tournamentId', tournament?.id ?? '');
        payload.append('tournamentName', tournament?.name ?? '');
        payload.append('status', isWaitlist ? 'waitlist' : 'pending');
        // The server re-asks D1 for this team before it creates anything (`/api/register`).
        if (chosenTeam) {
          payload.append('basicCoachTeamId', chosenTeam.basicCoachTeamId);
        }
        // C2: which head coach, by staff id — sent only when there were two to choose between, so a second
        // head coach added while the form was open is refused (choose again), never decided for the person.
        if (headCoach && headCoachCount >= 2) payload.append('headCoachId', headCoach.id);

        for (const field of registrationFields) {
          if (field.fieldType === 'file') {
            const file = customFiles[field.id];
            if (file) payload.append(`customFile_${field.id}`, file);
          } else {
            payload.append(`customField_${field.id}`, customAnswers[field.id] ?? '');
          }
        }

        setStep('submitting');
        const res = await fetch('/api/register', {
          method: 'POST',
          body: payload,
        });

        if (!res.ok) {
          const { error, code } = await res.json() as { error?: string; code?: string };
          // The team got in while this form was open: reload the cards, so Try Again shows it as already
          // registered instead of offering it again — with nothing chosen, and without the name and head
          // coach picked for that team. Kept, that name would follow the coach onto "A different team" and
          // enter the same real team again under a new one (/review 10-16).
          if (code === TEAM_ALREADY_REGISTERED) {
            await loadCoachTeams();
            setForm(f => ({ ...f, teamName: '' }));
            setHeadCoachChoice('');
          }
          throw new Error(error ?? 'Registration failed');
        }
        return await res.json() as { id?: string; status?: 'pending' | 'waitlist' };
      };

      // An account already waiting for its email (made by this form when Step 1's check was busy, or earlier and never
      // opened): the registration goes in signed out, and a fresh link opens it in the portal. Remembered, so a retry
      // after a failed registration comes back here rather than to a sign-in that cannot succeed yet.
      // The success card for a registration sent signed out: the link opens it in the coach's portal.
      const showVerifySuccess = (registered: { id?: string; status?: 'pending' | 'waitlist' }, joinHref: string, extra: Pick<RegistrationConfirmation, 'verifyEmail' | 'note'>) => {
        const status = registered.status === 'waitlist' ? 'waitlist' : isWaitlist ? 'waitlist' : 'pending';
        setConfirmation({ id: registered.id, status, joinHref, ...extra });
        setStep('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      const registerForWaitingAccount = async (emailNorm: string) => {
        setVerifies(true);
        setWaitingEmail(emailNorm);
        const registered = await postRegistration();
        const portalNext = registrationPortalPath(registered.id, emailNorm);
        await requestVerificationLink({ email: emailNorm, next: portalNext, continueName: form.teamName.trim() }).catch(() => null);
        showVerifySuccess(registered, portalNext, { verifyEmail: emailNorm });
      };

      // VERIFY EVERY SIGN-UP (owner 2026-10-16, V2): a new coach's registration goes to the organizer FIRST, signed
      // out; then the account is made to wait for its email, and the link opens this registration in their portal
      // (through the join page, which links it). The organizer never waits on the coach's inbox.
      if (!signedIn && verifies) {
        const emailNorm = form.email.trim().toLowerCase();
        setErrorMsg('');
        setNoticeMsg('');
        if (waitingEmail === emailNorm) {
          await registerForWaitingAccount(emailNorm);
          return;
        }
        const registered = await postRegistration();
        const portalNext = registrationPortalPath(registered.id, emailNorm);
        const signupRes = await fetch('/api/auth/coach-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailNorm,
            password: form.password,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            next: portalNext,
            continueName: form.teamName.trim(),
          }),
        }).catch(() => null);
        const created = signupRes?.ok ? await signupRes.json().catch(() => ({})) as { requiresEmailVerification?: boolean } : null;
        if (created?.requiresEmailVerification) {
          showVerifySuccess(registered, portalNext, { verifyEmail: emailNorm });
        } else if (signupRes?.status === 409) {
          // The account may be one still waiting for its email (made on an earlier visit, never opened): the resend
          // sends only to a waiting account and answers the same either way, so it reveals nothing the 409 didn't.
          await requestVerificationLink({ email: emailNorm, next: portalNext, continueName: form.teamName.trim() }).catch(() => null);
          showVerifySuccess(registered, portalNext, { note: 'This email already has a FieldLogicHQ account. Sign in to see this registration in your Coaches Portal. If you never opened its verification email, we’ve sent the link again.' });
        } else if (!signupRes?.ok) {
          showVerifySuccess(registered, portalNext, { note: 'We couldn’t set up your Coaches Portal account just now. The link in your registration email opens it.' });
        } else {
          showVerifySuccess(registered, portalNext, {});
        }
        return;
      }

      // Merge account creation into registration: a NEW coach (Step 1 found no account) becomes a
      // Coaches Portal account holder in this same step. /api/register then auto-links the
      // registration to their portal (it links when a signed-in coach's email matches).
      if (!signedIn) {
        const emailNorm = form.email.trim().toLowerCase();
        setErrorMsg('');
        setNoticeMsg('');
        setStep('submitting');
        const { signIn } = await import('@/lib/auth');

        const signupRes = await fetch('/api/auth/coach-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailNorm,
            password: form.password,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
          }),
        });

        if (signupRes.status === 409) {
          // An account exists after all (made between Step 1 and Submit, or Step 1's answer was
          // stale) — treat the password as a sign-in to it, as the form always has.
          const { error: signInErr } = await signIn(emailNorm, form.password);
          if (signInErr === 'email_not_confirmed') {
            // The account is waiting for its email — "wrong password" would be false (the sign-in only reports a
            // waiting account once the password matched). Register and send a fresh link, as the verify branch does.
            await registerForWaitingAccount(emailNorm);
            return;
          }
          if (signInErr) {
            // A4.3 (review finding): this branch is ALSO reached on the retry after a
            // just-created account failed to sign in, where "that password didn't match"
            // is incoherent — the account was made with this exact password seconds ago
            // (coach-signup confirms at once where verification is off; a waiting account is
            // answered just above). Asserting a wrong password there can push a coach with the
            // RIGHT password into a needless reset. State the outcome, offer the likely
            // cause, and — like every other failure branch — say the team isn't registered.
            setErrorMsg(
              "This email already has a FieldLogicHQ account and we couldn't sign you in, so your team has NOT been registered yet. If that password isn't the one on your account, enter the right one (or reset it from the sign-in page) and submit again."
            );
            setStep('error');
            return;
          }
          // Signed in — load their teams so they attach this registration to an existing
          // team instead of silently creating a duplicate (loadCoachTeams flips on the
          // team cards + signed-in state).
          const loaded = await loadCoachTeams();
          if (!loaded) {
            setErrorMsg('You’re signed in, but we couldn’t load your teams — so your team has NOT been registered yet. Reload the page to finish registering.');
            setStep('error');
            return;
          }
          if (loaded.teams === null || loaded.teams.length > 0) {
            // A4.4 (owner call 2026-07-27): KEEP the team choice — auto-submitting would
            // silently attach this registration to a guessed team, which is worse than one
            // extra tap and messy to unpick. What was wrong was the framing: the old notice
            // never said the registration hadn't been submitted, and we dumped the coach at
            // the top of the form instead of at the one control they came back for.
            setNoticeMsg("You already have a FieldLogicHQ account, so we've signed you in — but your registration hasn't been submitted yet. Pick which of your teams this is for (or a different team), then finish submitting. Everything you entered is still here.");
            setStep('form');
            // Defer past the re-render that mounts the cards (they exist only once
            // loadCoachTeams has flipped on the signed-in state).
            requestAnimationFrame(() => {
              const picker = document.getElementById('coach-team-picker');
              if (!picker) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              picker.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
            });
            return;
          }
          // No existing teams — fall through and create one via /api/register.
        } else if (!signupRes.ok) {
          const data = await signupRes.json().catch(() => ({})) as { error?: string };
          setErrorMsg(data.error ?? 'Your account could not be created. Please try again.');
          setStep('error');
          return;
        } else {
          const created = await signupRes.json().catch(() => ({})) as { requiresEmailVerification?: boolean };
          if (created.requiresEmailVerification) {
            // Step 1 couldn't say whether this form verifies (its check was busy), so the account came first and waits
            // for its email.
            await registerForWaitingAccount(emailNorm);
            return;
          }
          const { error: signInErr } = await signIn(emailNorm, form.password);
          if (signInErr) {
            // A4.3: the old copy ("Account created, but sign-in failed — sign in to finish")
            // read as "you're nearly done", but /api/register has NOT run at this point: the
            // team is NOT registered and the organizer has no record of it. A coach who
            // followed that advice signed in to an empty portal and assumed they were in.
            // Say so plainly — the Try Again button below returns to the form with every
            // answer still filled in, and the account now exists so the retry signs itself
            // in via the 409 path (no manual sign-in needed unless that fails too).
            //
            // Review finding: "your answers are still here" is NOT true for file uploads.
            // React keeps the File in state, but the form step unmounts on the way to the
            // error card and a remounted <input type="file"> always renders empty — and if
            // that field is `required`, native browser validation then blocks the retry
            // until the coach re-picks it. Only promise what survives.
            const needsFileReselect = registrationFields.some(
              f => f.fieldType === 'file' && (f.required || customFiles[f.id])
            );
            setErrorMsg(
              `Your account was created, but we couldn’t sign you in — so your team has NOT been registered yet and the organizer hasn’t received anything. Nothing is lost: choose Try Again below to finish submitting — your answers are still filled in${needsFileReselect ? ', though you’ll need to choose your uploaded file again' : ''}. If it keeps failing, sign in at the login page with this email and password, then register.`
            );
            setStep('error');
            return;
          }
        }
        // Now signed in — downstream /api/register sees the session and auto-links.
        setSignedInCoachEmail(emailNorm);
      }

      const result = await postRegistration();
      const status = result.status === 'waitlist' ? 'waitlist' : isWaitlist ? 'waitlist' : 'pending';
      // After the merge the registrant is always signed in by this point (account created
      // inline or already logged in) and the registration is linked — so instead of a separate
      // success screen, drop them STRAIGHT into their record. A Premium team's entry opens on THAT
      // portal's record (B6, 2026-10-13 — it used to land on the free portal's, which a staff member
      // who registers cannot open at all); a free team's on the free portal's, where `welcome=1`
      // triggers the first-run onboarding banner (most coaches don't know the portal exists yet).
      // Preview (admin) has no real session/record → keep the inert success card.
      if (result.id && !isPreview) {
        router.push(`/coaches/tournaments/${result.id}?welcome=1`);
        return;
      }
      setConfirmation({ id: result.id, status, joinHref: '/coaches/tournaments' });
      setStep('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  // Lifecycle-aware gate (single source: getRegistrationState) — a tournament that is
  // underway or completed reads as closed even while its row is still "active", so the
  // form (and the matching /api/register POST) stop minting junk mid-event registrations
  // + coach accounts (J6-035). Open vs waitlist both keep the form available, so we pass
  // no registrations here; per-division capacity is still handled inside the form below.
  // In the admin preview a draft hasn't been activated, so the live gate would read
  // "not open" — but the whole point of the preview is to show the real form before
  // going live. Treat a draft as active in preview ONLY (live registrants are never
  // affected — isPreview is false on the public route), and let the normal
  // division/capacity rules decide open vs waitlist.
  const gateTournament = isPreview && tournament?.status === 'draft'
    ? { ...tournament, status: 'active' as const }
    : tournament;
  const registrationInfo = gateTournament ? getRegistrationState(gateTournament, divisions, []) : null;
  const isRegistrationOpen = registrationInfo?.state === 'open' || registrationInfo?.state === 'waitlist';
  const notOpen = !isRegistrationOpen;

  const selectedGroup = divisions.find(g => g.id === form.divisionId);
  const isClosed = selectedGroup?.isClosed;
  const count = selectedGroup ? stats[selectedGroup.id] || 0 : 0;
  const isWaitlist = Boolean(selectedGroup?.capacity && count >= selectedGroup.capacity);
  const selectedFeeSchedule = resolveFeeSchedule(tournament, selectedGroup);
  // Organizer payment-display controls (settings JSONB; no migration). Default = show. An event that doesn't track
  // payments ("Not tracked here") has no payment panel at all — no fee, no how-to-pay, whatever was typed before.
  const showFees = tournamentTracksPayments(tournament?.settings) && tournament?.settings?.show_fees_on_register !== false;
  const paymentInstructions = (tournament?.settings?.payment_instructions ?? '').trim();
  const formInstructions =
    paymentInstructions && tournament?.settings?.payment_instructions_on_form ? paymentInstructions : '';
  // J5-007 / 5n: only promise a confirmation email when the organizer actually sends one — the
  // per-type confirmation toggle must be on AND automatic emails not paused. Mirrors
  // coachEmailEnabled(settings, 'confirmation') without importing the server email module.
  const confirmationEmailEnabled =
    tournament?.settings?.coach_email_pause_all !== true &&
    tournament?.settings?.coach_email_confirmation !== false;
  // Success-screen momentum ticker — only when the event hasn't started yet.
  const firstGameTarget = tournament?.startDate ? `${tournament.startDate}T09:00:00` : null;
  const showCountdown = firstGameTarget != null && Date.parse(firstGameTarget) > mountedAtMs;
  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const rulesHref = `/${orgSlug}/${tournamentSlug}/rules`;
  const showSchedulePage = Boolean(tournament && isPublicPageEnabled(tournament, 'schedule'));
  const showStandingsPage = Boolean(tournament && isPublicPageEnabled(tournament, 'standings'));
  const showRulesPage = Boolean(tournament && isPublicPageEnabled(tournament, 'rules'));
  const standingsHref = `/${orgSlug}/${tournamentSlug}/standings`;
  // Forgot password comes back to this registration (the reset carries the page; see
  // `registrationReturnPath`). The email Step 1 asked for is filled in there too.
  const forgotHref = `/auth/forgot-password?email=${encodeURIComponent(form.email)}&next=${encodeURIComponent(pathname ?? homeHref)}`;

  /** You · Team · Review. A NEW coach answers team and person together, so their marker stays on "You". */
  function stepClass(target: 'you' | 'team' | 'review') {
    const atReview = step === 'review' || step === 'submitting';
    const done =
      (target === 'you' && ((step === 'form' && signedIn) || atReview || step === 'success')) ||
      (target === 'team' && (atReview || step === 'success')) ||
      (target === 'review' && step === 'success');
    const active =
      (target === 'you' && (step === 'email' || step === 'signin' || (step === 'form' && !signedIn))) ||
      (target === 'team' && step === 'form' && signedIn) ||
      (target === 'review' && atReview);
    return { className: `${styles.step} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`, done, active };
  }

  function customAnswerLabel(field: TournamentRegistrationField) {
    if (field.fieldType === 'file') return customFiles[field.id]?.name || 'No file selected';
    if (field.fieldType === 'checkbox') return customAnswers[field.id] === 'true' ? 'Confirmed' : 'Not confirmed';
    return customAnswers[field.id]?.trim() || 'No answer';
  }

  if (tournament && !isPublicPageEnabled(tournament, 'register')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<UserPlus size={40} />}
              eyebrow="Registration"
              title="Registration unavailable"
              description="The organizer is not accepting public registration for this tournament."
              contactEmail={contactEmail}
              actions={[
                { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
                ...(isPublicPageEnabled(tournament, 'schedule') ? [{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }] : []),
                ...(isPublicPageEnabled(tournament, 'rules') ? [{ href: rulesHref, label: 'Tournament Rules', variant: 'ghost' as const }] : []),
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  // The tournament's own state (closed, underway) never waits on the sign-in check; the form does, so
  // Step 1 never flashes at a coach who is already signed in.
  const ready = loaded && (notOpen || coachSessionLoaded);
  const onFormStep = step === 'email' || step === 'signin' || step === 'form';
  // Who is registering — the account's name, else what a new coach typed (the server's rule too). Stable
  // for a signed-in person, who has no boxes to type in (G4).
  const registrantName = (signedIn && accountName) || `${form.firstName} ${form.lastName}`.trim();

  /** The card header every form step shares. */
  const cardHeader = (
    <div className={styles.formHeader}>
      <div className={styles.formIcon}><UserPlus size={20} /></div>
      <div>
        <h2 className={styles.formTitle}>Register Your Team</h2>
        <p className={styles.formSub}>{tournament?.name}</p>
      </div>
    </div>
  );

  /** "brett@example.com · Change" / "Registering as … · Not you?" — who this form thinks you are, and the way out. */
  const whoRow = (who: React.ReactNode, action: string, onAction: () => void) => (
    <div className={styles.whoRow}>
      {who}
      <button type="button" className={styles.linkBtn} onClick={onAction}>{action}</button>
    </div>
  );

  /**
   * One team card: a radio row with its sentence, or a greyed row that cannot be chosen — LOCKED (a lock
   * and who can register it) or ENTERED (a tick, where the team already is in this tournament, and a
   * link to that registration for someone who may open it).
   */
  const teamCard = (card: { value: string; name: string; portalChip: boolean } & CardState) => {
    const nameLine = (
      <span className={styles.teamOptionName}>
        {card.name}
        {card.portalChip && <span className={styles.portalChip}>Coaches Portal</span>}
      </span>
    );
    const sub = (
      <span className={styles.teamOptionSub}>
        {card.sub}
        {card.href && <> · <Link href={card.href} className={styles.teamOptionLink}>View registration</Link></>}
      </span>
    );
    const Icon = card.blocked === 'entered' ? CheckCircle : Lock;
    return card.blocked ? (
      <div key={card.value} className={`${styles.teamOption} ${styles.teamOptionLocked}`} aria-disabled="true">
        <Icon size={16} className={styles.teamOptionLock} aria-hidden />
        {nameLine}
        {sub}
      </div>
    ) : (
      <label key={card.value} className={`${styles.teamOption} ${teamChoice === card.value ? styles.teamOptionSelected : ''}`}>
        <input type="radio" name="reg-team" value={card.value} checked={teamChoice === card.value} onChange={() => chooseTeam(card.value)} />
        {nameLine}
        {sub}
      </label>
    );
  };

  /** The team's name: "Name in this tournament" for a chosen team (A2 — it starts as the team's name), else "Team Name". */
  const teamNameField = (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      <label className="form-label" htmlFor="reg-team-name">{chosenTeam ? 'Name in this tournament *' : 'Team Name *'}</label>
      <input
        className="form-input"
        placeholder={chosenTeam ? undefined : 'e.g. Milton Thunder'}
        value={form.teamName}
        onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
        required
        id="reg-team-name"
      />
      {chosenTeam && (
        <p className={styles.fieldHint}>
          {chosenTeam.isPortalTeam
            ? 'What the organizer’s schedule shows. Your portal keeps its own name.'
            : 'What the organizer’s schedule shows. Your team keeps its own name.'}
        </p>
      )}
    </div>
  );

  /**
   * A head coach as Step 2 and Review name them: their name, marked when it is you. With no name on
   * file (test accounts only, 2026-10-15), the dropdown says "Head coach (no name on file)" and Review —
   * whose row is already labelled Head coach — "No name on file" (/marketing).
   */
  const headCoachLabel = (h: CardHeadCoach, noName = 'Head coach (no name on file)') =>
    h.name ? `${h.name}${h.isYou ? ' (you)' : ''}` : h.isYou ? 'You' : noName;

  /**
   * C2 (owner, 2026-10-15): when the chosen team has two or more head coaches, the person registering
   * picks which one the organizer sees. A dropdown (the pick-one rule, 2026-08-22: options with no
   * sentence of their own), names only, nothing chosen — so the pick is deliberate.
   */
  const headCoachCount = chosenTeam?.headCoaches.length ?? 0;
  const headCoachField = chosenTeam && headCoachCount >= 2 && (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      <label className="form-label" htmlFor="reg-head-coach">Head coach *</label>
      <div className="select-wrapper">
        <select
          id="reg-head-coach"
          className="form-input"
          value={chosenTeam.headCoaches.some(h => h.id === headCoachChoice) ? headCoachChoice : ''}
          onChange={e => setHeadCoachChoice(e.target.value)}
          required
          aria-describedby="reg-head-coach-hint"
        >
          <option value="" disabled>Choose the head coach</option>
          {chosenTeam.headCoaches.map(h => <option key={h.id} value={h.id}>{headCoachLabel(h)}</option>)}
        </select>
        <ChevronDown size={16} className="select-icon" />
      </div>
      <p className={styles.fieldHint} id="reg-head-coach-hint">
        Your team has {['two', 'three', 'four'][headCoachCount - 2] ?? headCoachCount} head coaches. The organizer sees the one you choose as your team’s coach, and sends their emails to them.
      </p>
    </div>
  );

  /** The new coach's name — it sets up their account. A signed-in person never sees it (C3). */
  const nameFields = (
    <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
      <div className="form-group">
        <label className="form-label" htmlFor="reg-first-name">First Name *</label>
        <input className="form-input" placeholder="First name" value={form.firstName}
          onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required autoComplete="given-name" id="reg-first-name" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="reg-last-name">Last Name *</label>
        <input className="form-input" placeholder="Last name" value={form.lastName}
          onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required autoComplete="family-name" id="reg-last-name" />
      </div>
    </div>
  );

  /** Division, capacity, fees and the organizer's own questions — the same on Step 2 and for a new coach. */
  const tournamentDetails = (
    <>
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label" htmlFor="reg-division">Division *</label>
        <div className="select-wrapper">
          <select id="reg-division" className="form-input" value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))} required>
            <option value="" disabled>Select a division</option>
            {divisions.map(g => {
              const filled = stats[g.id] || 0;
              const remaining = g.capacity ? Math.max(0, g.capacity - filled) : null;
              const waitlistLabel = g.capacity && filled >= g.capacity ? ' (WAITLIST)' : '';
              const spotsLabel = remaining !== null && remaining > 0 ? ` (${remaining} left)` : '';
              const ageLabel = formatAgeRange(g.minAge, g.maxAge);
              return (
                <option key={g.id} value={g.id}>
                  {g.name}{ageLabel ? ` ${ageLabel}` : ''} {g.isClosed ? '- CLOSED' : (waitlistLabel || spotsLabel)}
                </option>
              );
            })}
          </select>
          <ChevronDown size={16} className="select-icon" />
        </div>
      </div>

      {/* A new coach's account is created inline — registering sets up their free portal. Step 1
          already sent a returning coach to sign in, so this is only ever a NEW password. */}
      {!signedIn && (
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label" htmlFor="reg-password">Create a Password *</label>
          <input
            className="form-input"
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
            autoComplete="new-password"
            id="reg-password"
          />
        </div>
      )}

      {selectedGroup && selectedGroup.capacity && !selectedGroup.isClosed && (
        <div className={styles.spotsCard}>
          <div className={styles.spotsHeader}>
            <span className={styles.spotsLabel}>Division Availability</span>
            <span className={styles.spotsCount}>
              {isWaitlist ? 'Waitlist Active' : `${Math.max(0, selectedGroup.capacity - count)} of ${selectedGroup.capacity} spots left`}
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(100, (count / selectedGroup.capacity) * 100)}%`,
                // Solid, semantic capacity escalation (matches the success/warning/danger
                // status tones used elsewhere): room → green, filling up → amber, full → red.
                background: isWaitlist
                  ? 'var(--danger)'
                  : count / selectedGroup.capacity > 0.8
                    ? 'var(--warning)'
                    : 'var(--success)',
              }}
            />
          </div>
        </div>
      )}

      {isClosed && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: 8, border: '1px solid rgba(var(--danger-rgb), 0.2)' }}>
          <AlertCircle size={20} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Registration for this division is officially closed. You cannot submit a registration.</p>
        </div>
      )}

      {isWaitlist && !isClosed && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)', padding: '1rem', borderRadius: 8, border: '1px solid rgba(var(--warning-rgb), 0.2)' }}>
          <AlertCircle size={20} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>This division is currently full. Submitting this form will place your team on the <strong>Waitlist</strong>.</p>
        </div>
      )}

      {selectedGroup && showFees && (
        <PaymentPanel feeSchedule={selectedFeeSchedule} instructions={formInstructions} />
      )}

      {registrationFields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {registrationFields.map(field => (
            <div key={field.id} className="form-group">
              <label className="form-label">
                {field.label}{field.required ? ' *' : ''}
              </label>
              {field.fieldType === 'short_text' && (
                <input
                  className="form-input"
                  value={customAnswers[field.id] ?? ''}
                  onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  required={field.required}
                />
              )}
              {field.fieldType === 'long_text' && (
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={customAnswers[field.id] ?? ''}
                  onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  required={field.required}
                />
              )}
              {field.fieldType === 'dropdown' && (
                <div className="select-wrapper">
                  <select
                    className="form-input"
                    value={customAnswers[field.id] ?? ''}
                    onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                    required={field.required}
                  >
                    <option value="" disabled>Select an option</option>
                    {field.options.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-icon" />
                </div>
              )}
              {field.fieldType === 'checkbox' && (
                <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', color: 'var(--white-70)', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={customAnswers[field.id] === 'true'}
                    onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.checked ? 'true' : 'false' }))}
                    required={field.required}
                  />
                  <span>I confirm</span>
                </label>
              )}
              {field.fieldType === 'file' && (
                <input
                  className="form-input"
                  type="file"
                  onChange={e => setCustomFiles(prev => ({ ...prev, [field.id]: e.target.files?.[0] ?? null }))}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isClosed || stepBusy}
        style={{ width: '100%', padding: '0.875rem' }}
      >
        Review Registration
      </button>
    </>
  );

  return (
    <div className="page-content">
      {isPreview && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 0.9rem', borderRadius: 8,
              border: '1px solid rgba(var(--logic-lime-rgb), 0.35)',
              background: 'rgba(var(--logic-lime-rgb), 0.08)',
              color: 'var(--fl-text)', fontSize: '0.8rem', lineHeight: 1.5,
            }}>
              <Eye size={14} style={{ flexShrink: 0 }} />
              <span>Preview — this is exactly how registrants will see your form. Submissions are disabled here.</span>
            </div>
          </div>
        </div>
      )}
      {/* No page-level header here: the tournament identity is carried by the shell's
          top context bar (desktop) and the card header below (all breakpoints), so a
          "Team Registration" h1 + paragraph would be the third redundant identity block. */}
      <div className="section">
        <div className="container">
          <div className={styles.formWrap}>

            {!ready && onFormStep && (
              <PublicTournamentState eyebrow="Registration" title="Loading registration…" compact />
            )}

            {ready && notOpen && onFormStep && (
              <PublicTournamentState
                icon={<AlertCircle size={40} />}
                eyebrow="Registration"
                title={registrationInfo?.label ?? 'Registration not open'}
                description={registrationInfo?.detail ?? 'Tournament registration is not accepting submissions right now.'}
                contactEmail={contactEmail}
                actions={[
                  { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
                  ...(showSchedulePage ? [{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }] : []),
                  ...(showStandingsPage ? [{ href: standingsHref, label: 'Standings', variant: 'ghost' as const }] : []),
                ]}
              />
            )}

            {ready && step !== 'error' && !notOpen && (
              <div className={styles.steps}>
                {(['you', 'team', 'review'] as const).map((target, i) => {
                  const s = stepClass(target);
                  return (
                    <Fragment key={target}>
                      {i > 0 && <div className={styles.stepLine}></div>}
                      <div className={s.className} aria-current={s.active ? 'step' : undefined}>
                        <div className={styles.stepNum}>{s.done ? <Check size={13} aria-hidden /> : i + 1}</div>
                        <span className={styles.stepText}>{target === 'you' ? 'You' : target === 'team' ? 'Team' : 'Review'}</span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}

            {step === 'error' && (
              <div className={`card ${styles.errorCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem', display: 'block' }} />
                <h3>Registration Failed</h3>
                <p>{errorMsg}</p>
                <button className="btn btn-primary" onClick={() => setStep('form')}>Try Again</button>
              </div>
            )}

            {(step === 'review' || step === 'submitting') && !notOpen && selectedGroup && (
              <div className={`card ${styles.reviewCard}`}>
                <div className={styles.formHeader}>
                  <div className={styles.formIcon}><UserPlus size={20} /></div>
                  <div>
                    <h2 className={styles.formTitle}>Review Registration</h2>
                    <p className={styles.formSub}>{tournament?.name}</p>
                  </div>
                </div>

                <dl className={styles.reviewSummary}>
                  <div className={styles.reviewRow}>
                    <dt>Team</dt>
                    {/* The team the entry JOINS (drawn): a chosen team by its own name, tagged as
                        Step 2 tagged it; a new team by the name typed. */}
                    <dd>
                      {chosenTeam ? chosenTeam.name : form.teamName}
                      {chosenTeam?.isPortalTeam && <> <span className={styles.portalChip}>Coaches Portal</span></>}
                    </dd>
                  </div>
                  {/* A2: shown ONLY when the coach changed it from the team's name, so the two names
                      are never confused. */}
                  {chosenTeam && form.teamName.trim() !== chosenTeam.name && (
                    <div className={styles.reviewRow}>
                      <dt>Name in this tournament</dt>
                      <dd>{form.teamName.trim()}</dd>
                    </div>
                  )}
                  {entryHeadCoach ? (
                    /* Stage 1b (drawn): the portal names the coach, whoever presses Submit. "Registered
                       by" only when that is someone else — it would repeat the row above it. */
                    <>
                      <div className={styles.reviewRow}>
                        <dt>Head coach</dt>
                        <dd>
                          {headCoachLabel(entryHeadCoach, 'No name on file')}
                          <span className={styles.reviewSrc}>From your Coaches Portal</span>
                        </dd>
                      </div>
                      {!entryHeadCoach.isYou && (
                        <div className={styles.reviewRow}>
                          <dt>Registered by</dt>
                          <dd>
                            {registrantName || signedInCoachEmail}
                            {registrantName && <span className={styles.reviewSrc}>{signedInCoachEmail}</span>}
                          </dd>
                        </div>
                      )}
                      <div className={styles.reviewRow}>
                        <dt>Organizer emails go to</dt>
                        <dd>
                          {entryHeadCoach.isYou
                            ? signedInCoachEmail
                            : entryHeadCoach.name ? `${entryHeadCoach.name}, the head coach` : 'The head coach'}
                        </dd>
                      </div>
                    </>
                  ) : (
                    <>
                      {registrantName && (
                        <div className={styles.reviewRow}>
                          <dt>Registered by</dt>
                          <dd>{registrantName}</dd>
                        </div>
                      )}
                      <div className={styles.reviewRow}>
                        <dt>Email</dt>
                        <dd>{signedInCoachEmail || form.email}</dd>
                      </div>
                    </>
                  )}
                  <div className={styles.reviewRow}>
                    <dt>Division</dt>
                    <dd>{selectedGroup.name}</dd>
                  </div>
                  {/* Fee lives in the richer payment panel below (deposit + due dates +
                      organizer context) — no duplicate summary row. */}
                  {contactEmail ? (
                    <div className={styles.reviewRow}>
                      <dt>Organizer contact</dt>
                      <dd>{contactEmail}</dd>
                    </div>
                  ) : null}
                </dl>

                {/* Status is an outcome, not a fact — pull it out of the field list and give it an
                    accented banner so "here's what happens when you submit" reads clearly. */}
                <div className={`${styles.reviewStatus} ${isWaitlist ? styles.reviewStatusWaitlist : ''}`}>
                  <span className={styles.reviewStatusDot} aria-hidden />
                  <div>
                    <span className={styles.reviewStatusLabel}>Status after you submit</span>
                    <strong className={styles.reviewStatusValue}>
                      {isWaitlist ? 'Added to the waitlist' : 'Pending organizer review'}
                    </strong>
                  </div>
                </div>

                {/* Where the entry goes, so the coach knows it joined the right team BEFORE they
                    submit — after Submit they land on that portal's record (B6). */}
                {chosenTeam?.portal && (
                  <p className={styles.afterNote}>
                    After you submit, this tournament shows on your {chosenTeam.name} portal’s Tournaments page.
                    {/* That page's head-coach editor changes both (Stage 1b, drawn). */}
                    {entryHeadCoach && ' You can change the head coach or where emails go from there.'}
                  </p>
                )}

                {isWaitlist && !isClosed && (
                  <div className={styles.notice} style={{ marginTop: '1rem' }}>
                    <AlertCircle size={20} />
                    <p>This division is full. The final action below will add your team to the waitlist.</p>
                  </div>
                )}

                {registrationFields.length > 0 && (
                  <div className={styles.reviewAnswers}>
                    <h3>Additional Details</h3>
                    {registrationFields.map(field => (
                      <div key={field.id}>
                        <span>{field.label}</span>
                        <strong>{customAnswerLabel(field)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {showFees && (
                  <PaymentPanel
                    feeSchedule={selectedFeeSchedule}
                    instructions={formInstructions}
                    style={{ marginTop: '1.5rem' }}
                  />
                )}

                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setStep('form')}
                    disabled={step === 'submitting'}
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitRegistration}
                    disabled={step === 'submitting' || isClosed || isPreview}
                    title={isPreview ? 'Submissions are disabled in preview' : undefined}
                  >
                    {step === 'submitting' ? (
                      <><RefreshCw size={18} className="spinner" /> Submitting...</>
                    ) : isPreview ? 'Submit disabled in preview' : isWaitlist ? 'Join Waitlist' : 'Submit Registration'}
                  </button>
                </div>
              </div>
            )}

            {step === 'success' && confirmation && (
              <div className={`card ${styles.successCard}`}>
                <CheckCircle size={44} style={{ color: 'var(--success)', margin: '0 auto 1rem', display: 'block' }} />
                <h3 className={styles.successTitle}>
                  {confirmation.status === 'waitlist' ? 'Waitlist Request Received' : "You're In Motion"}
                </h3>
                <p className={styles.successText}>
                  {confirmation.status === 'waitlist'
                    ? `${form.teamName} has been added to the waitlist for ${selectedGroup?.name ?? 'this division'}.`
                    : `${form.teamName} is registered for ${tournament?.name ?? 'the tournament'} and sent to the organizer for review.`}
                </p>

                {confirmation.verifyEmail && (
                  <div className={styles.successVerify}>
                    <VerifyEmailSent
                      tone="register"
                      email={confirmation.verifyEmail}
                      lead={<>Open the link we sent to see this registration in your Coaches Portal.</>}
                      after={<>You’ll hear from the organizer at this address either way.</>}
                      resendNext={confirmation.joinHref}
                      continueName={form.teamName.trim()}
                    />
                  </div>
                )}
                {confirmation.note && <p className={styles.successText}>{confirmation.note}</p>}

                {showCountdown && firstGameTarget && (
                  <div className={styles.motionBanner}>
                    <Calendar size={16} />
                    <Countdown target={firstGameTarget} prefix="First game in " />
                  </div>
                )}

                <div className={styles.successSteps}>
                  {tournament?.startDate && (
                    <div className={styles.successItem}>
                      <Calendar size={18} className={styles.successIcon} />
                      <div>
                        <span className={styles.successTitleInner}>Save the dates</span>
                        <span className={styles.successDescInner}>
                          {`Add ${tournament?.name ?? 'the tournament'} to your calendar so you don't miss a game.`}
                        </span>
                        <div style={{ marginTop: '0.6rem' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => tournament && downloadTournamentCalendar(tournament, `${window.location.origin}${homeHref}`)}
                          >
                            <Calendar size={15} /> Add to calendar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className={styles.successItem}>
                    <Mail size={18} className={styles.successIcon} />
                    <div>
                      <span className={styles.successTitleInner}>
                        {confirmationEmailEnabled ? 'Watch your email' : 'What happens next'}
                      </span>
                      <span className={styles.successDescInner}>
                        {confirmationEmailEnabled
                          ? (confirmation.status === 'waitlist'
                              ? 'Check your inbox for your waitlist confirmation. The organizer will reach out if a spot opens'
                              : 'Check your inbox for your confirmation. The organizer follows up with approval and how to pay')
                          : (confirmation.status === 'waitlist'
                              ? 'The organizer reviews waitlist requests and will reach out if a spot opens'
                              : 'The organizer reviews your registration and will follow up with approval and how to pay')}
                        {contactEmail ? <> — reach them anytime at <a href={`mailto:${contactEmail}`}>{contactEmail}</a> with questions.</> : '.'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.successItem}>
                    <CheckCircle size={18} className={styles.successIcon} />
                    <div>
                      <span className={styles.successTitleInner}>
                        {signedInCoachEmail ? 'Track your team' : 'Create your Coaches Portal'}
                      </span>
                      <span className={styles.successDescInner}>
                        {signedInCoachEmail
                          ? `Follow your team's status, schedule, and updates for ${tournament?.name ?? 'this tournament'}.`
                          : `Set a password to track your team's status, schedule, and updates for ${tournament?.name ?? 'this tournament'}.`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.successActions}>
                  <Link href={confirmation.joinHref} className="btn btn-primary">
                    {signedInCoachEmail ? 'Open Coaches Portal' : 'Create Coaches Portal Account'}
                  </Link>
                  {showSchedulePage && <Link href={scheduleHref} className="btn btn-outline">Follow the Schedule</Link>}
                  {showRulesPage && <Link href={rulesHref} className="btn btn-ghost">Tournament Rules</Link>}
                  <Link href={homeHref} className="btn btn-ghost">Tournament Home</Link>
                </div>
              </div>
            )}

            {ready && onFormStep && !notOpen && (
              <div className={`card ${styles.formCard}`}>
                {cardHeader}

                {/* Fan off-ramp (J6-037): this form is for team/coach registration and
                    asks for an email and a password. A parent who just wants to follow along needs
                    no account — point them at the public pages. Step 1 only: a signed-in coach
                    never sees it, and it waits for the session check (no flash). */}
                {step === 'email' && (
                  <p className={styles.fanNote}>
                    Just here to follow a team? No account needed — everything is on the{' '}
                    {showSchedulePage
                      ? <Link href={scheduleHref} className={styles.fanLink}>schedule</Link>
                      : 'schedule'}
                    {showStandingsPage && <> and <Link href={standingsHref} className={styles.fanLink}>standings</Link></>}
                    {' '}pages.
                  </p>
                )}

                {noticeMsg && (
                  <div role="status" className={styles.formNotice}>
                    {noticeMsg}
                  </div>
                )}

                {/* ── Step 1 · Your email ───────────────────────────────────────────── */}
                {step === 'email' && (
                  <form onSubmit={handleEmailContinue} noValidate>
                    <p className={styles.lead}>
                      Start with your email. If you already have a team on FieldLogicHQ, you’ll register that team.
                    </p>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label" htmlFor="reg-email">Email *</label>
                      <input
                        className="form-input"
                        type="email"
                        inputMode="email"
                        placeholder="coach@example.com"
                        value={form.email}
                        onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setStepError(''); }}
                        required
                        readOnly={stepBusy}
                        autoComplete="email"
                        id="reg-email"
                      />
                    </div>
                    {stepError && <p className={styles.inlineError} role="alert">{stepError}</p>}
                    <button type="submit" className="btn btn-primary" disabled={stepBusy} style={{ width: '100%', padding: '0.875rem' }}>
                      {stepBusy ? <><RefreshCw size={18} className="spinner" /> Checking…</> : 'Continue'}
                    </button>
                  </form>
                )}

                {/* ── Step 1 · An email with an account: sign in right here ──────────── */}
                {step === 'signin' && (
                  <form onSubmit={handleSignIn} noValidate>
                    {whoRow(<b>{form.email}</b>, 'Change', changeEmail)}
                    <p className={styles.lead}>This email has a FieldLogicHQ account. Sign in to register one of your teams.</p>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label" htmlFor="reg-signin-password">Password *</label>
                      <input
                        className="form-input"
                        type="password"
                        value={form.password}
                        onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setStepError(''); }}
                        required
                        readOnly={stepBusy}
                        autoComplete="current-password"
                        id="reg-signin-password"
                      />
                    </div>
                    {stepError && <p className={styles.inlineError} role="alert">{stepError}</p>}
                    <button type="submit" className="btn btn-primary" disabled={stepBusy} style={{ width: '100%', padding: '0.875rem' }}>
                      {stepBusy ? <><RefreshCw size={18} className="spinner" /> Signing In…</> : 'Sign In'}
                    </button>
                    <Link href={forgotHref} className={styles.centerLink}>Forgot password?</Link>
                    {/* The thing coaches find confusing: signed in on their phone, yet asked to sign
                        in. Small and last, so it never competes with the password box. */}
                    <p className={styles.fieldHint}>
                      Opened this from WhatsApp or another app? It has its own browser, so you may need to sign in here once even if you’re signed in elsewhere.
                    </p>
                  </form>
                )}

                {/* ── Step 2 · Which team (signed in) ─────────────────────────────────── */}
                {step === 'form' && signedIn && (
                  <form onSubmit={handleReview}>
                    {/* Written out (not whoRow): the handler sits directly on the button, where the
                        compiler can see it runs on a click and never during render. */}
                    <div className={styles.whoRow}>
                      <span>Registering as <b>{registrantName || signedInCoachEmail}</b></span>
                      <button type="button" className={styles.linkBtn} disabled={stepBusy} onClick={() => { void notYou(); }}>Not you?</button>
                    </div>

                    {registrableTeams === null ? (
                      <div className={styles.formNotice} role="alert">
                        We couldn’t load your teams just now, so we won’t guess.{' '}
                        <button type="button" className={styles.linkBtn} onClick={() => { void loadCoachTeams(); }}>Try Again</button>
                      </div>
                    ) : registrableTeams.length > 0 && (
                      /* A4.4: the returning-coach path scrolls HERE — the one control they came
                         back to choose. Radio rows with a sentence under each option, not a
                         dropdown: the sentence under "A different team" IS the fix for F4, so it
                         must be visible without opening anything (/design, 2026-10-13). */
                      <fieldset className={styles.teamPicker} id="coach-team-picker">
                        <legend className="form-label">Which team? *</legend>
                        <div className={styles.teamOptions}>
                          {registrableTeams.map(team => teamCard({
                            value: team.basicCoachTeamId,
                            name: team.name,
                            portalChip: team.isPortalTeam,
                            ...cardState(team),
                          }))}
                          {teamCard({ value: DIFFERENT_TEAM, name: 'A different team', portalChip: false, blocked: null, sub: differentTeamSentence(portalTeams) })}
                        </div>
                      </fieldset>
                    )}

                    {!teamPicked ? (
                      registrableTeams !== null && <p className={styles.ghostNote}>Choose a team to continue.</p>
                    ) : (
                      <>
                        {teamNameField}
                        {/* No name boxes (C3): the person is their account, and a Premium team's coach
                            comes from its portal — named on Review. */}
                        {headCoachField}
                        {tournamentDetails}
                      </>
                    )}
                  </form>
                )}

                {/* ── A brand-new coach: today's form, the email already asked ─────────── */}
                {step === 'form' && !signedIn && (
                  <form onSubmit={handleReview}>
                    {whoRow(<b>{form.email}</b>, 'Change', changeEmail)}
                    {/* Was the hint under the password box; now said up front, and only to a coach
                        who is genuinely new. */}
                    <p className={styles.lead}>
                      Welcome. Registering also sets up your free Coaches Portal, so you can follow your team from there.
                    </p>
                    {teamNameField}
                    {nameFields}
                    {tournamentDetails}
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
