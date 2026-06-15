'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { UserPlus, AlertCircle, ChevronDown, RefreshCw, CreditCard, CheckCircle, Calendar, Mail, Eye } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Division, Tournament, TournamentRegistrationField } from '@/lib/types';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import Countdown from '@/components/public/Countdown';
import styles from '@/app/[orgSlug]/register/register.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';

type Step = 'form' | 'review' | 'submitting' | 'success' | 'error';

type FeeSchedule = {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
  source: 'tournament' | 'division';
};

type CustomAnswerState = Record<string, string>;
type CustomFileState = Record<string, File | null>;
type BasicCoachTeamOption = {
  id: string;
  name: string;
  primaryCoachName: string | null;
};

type RegistrationConfirmation = {
  id?: string;
  status: 'pending' | 'waitlist';
  joinHref: string;
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
 * as a registrant will, without creating a registration or an account.
 */
export default function RegisterContent({ isPreview = false }: { isPreview?: boolean }) {
  const params         = useParams();
  const router         = useRouter();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationFields, setRegistrationFields] = useState<TournamentRegistrationField[]>([]);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [stats, setStats]           = useState<Record<string, number>>({});
  const [step, setStep]             = useState<Step>('form');
  const [errorMsg, setErrorMsg]     = useState('');
  // Inline notice on the form (e.g. a returning coach who just got signed in mid-register).
  const [noticeMsg, setNoticeMsg]   = useState('');
  const [form, setForm] = useState({
    teamName: '', firstName: '', lastName: '', email: '', password: '', divisionId: '',
  });
  const [customAnswers, setCustomAnswers] = useState<CustomAnswerState>({});
  const [customFiles, setCustomFiles] = useState<CustomFileState>({});
  const [signedInCoachEmail, setSignedInCoachEmail] = useState<string | null>(null);
  // True only when the account has BOTH a first and last name — gates the registrant
  // name lock. Stable (set at load), so typing never flips the inputs to disabled.
  const [accountHasName, setAccountHasName] = useState(false);
  const [basicCoachTeams, setBasicCoachTeams] = useState<BasicCoachTeamOption[]>([]);
  const [coachTeamMode, setCoachTeamMode] = useState<'new' | 'existing'>('new');
  const [selectedBasicTeamId, setSelectedBasicTeamId] = useState('');
  const [confirmation, setConfirmation] = useState<RegistrationConfirmation | null>(null);
  // Captured once (lazy init keeps render pure) — gates the success-screen countdown banner.
  const [mountedAtMs] = useState(() => Date.now());

  useEffect(() => {
    async function init() {
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'register');
      const current = data?.tournament ?? null;
      setTournament(current);
      setContactEmail(current?.contactEmail ?? data?.organization.contactEmail ?? null);
      if (current && data?.pageEnabled) {
        setDivisions(data.divisions);
        setRegistrationFields(data.registrationFields ?? []);
        fetchStats(current.id);
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
  }, [orgSlug, tournamentSlug]);

  // Loads the signed-in coach's account + teams. Reused on mount AND after a returning
  // coach is signed in mid-registration, so they can attach to an existing team instead
  // of silently creating a duplicate. Returns the team list. Skipped in preview — the
  // preview never signs anyone in or attaches to a real coach account.
  const loadCoachTeams = useCallback(async (): Promise<BasicCoachTeamOption[]> => {
    if (isPreview) return [];
    try {
      const res = await fetch('/api/coaches/basic-teams', { cache: 'no-store' });
      if (res.status === 401 || !res.ok) return [];
      const data = await res.json() as {
        user?: { email?: string; firstName?: string; lastName?: string; name?: string };
        teams?: BasicCoachTeamOption[];
      };
      const userEmail = data.user?.email?.toLowerCase() ?? null;
      const apiFirst = (data.user?.firstName ?? '').trim();
      const apiLast = (data.user?.lastName ?? '').trim();
      const teams = data.teams ?? [];
      setSignedInCoachEmail(userEmail);
      // Lock the registrant name only when the account carries BOTH parts — otherwise
      // keep the inputs editable so the coach can complete their name.
      setAccountHasName(!!(apiFirst && apiLast));
      setBasicCoachTeams(teams);
      if (userEmail) {
        setForm(f => ({
          ...f,
          email: f.email || userEmail,
          firstName: f.firstName || apiFirst,
          lastName: f.lastName || apiLast,
        }));
      }
      if (teams.length > 0) setCoachTeamMode('existing');
      return teams;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [isPreview]);

  useEffect(() => {
    // Async wrapper: state updates happen after the fetch resolves, not synchronously
    // in the effect (loadCoachTeams is reused by the returning-coach sign-in path).
    async function run() { await loadCoachTeams(); }
    run();
  }, [loadCoachTeams]);

  function selectExistingCoachTeam(teamId: string) {
    setSelectedBasicTeamId(teamId);
    const team = basicCoachTeams.find(item => item.id === teamId);
    if (!team) return;
    // Reuse the saved team's name + the account email; the registrant's identity
    // (first/last) stays the account user — the head coach is assigned separately (portal).
    setForm(f => ({
      ...f,
      teamName: team.name,
      email: signedInCoachEmail || f.email,
    }));
  }

  function validateRegistrationDetails() {
    const selectedGroup = divisions.find(g => g.id === form.divisionId);
    if (!selectedGroup) throw new Error('Select a division before reviewing your registration.');
    if (coachTeamMode === 'existing' && basicCoachTeams.length > 0 && !selectedBasicTeamId) {
      throw new Error('Select a Coaches Portal team, or choose to create a new team profile.');
    }
    if (!form.teamName.trim()) {
      throw new Error('Enter a team name.');
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      throw new Error('Enter your first and last name.');
    }
    // Logged-out registrants create their Coaches Portal account inline — a password is
    // required (a returning email is handled as a sign-in at submit time).
    if (!signedInCoachEmail && form.password.length < 8) {
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

    return { selectedGroup, isWaitlist };
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
      const { selectedGroup, isWaitlist } = validateRegistrationDetails();

      // Merge account creation into registration: a logged-out registrant becomes a
      // Coaches Portal account holder in this same step. /api/register then auto-links
      // the registration to their portal (it links when a signed-in coach's email matches).
      if (!signedInCoachEmail) {
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
          // Returning coach — treat the password as a sign-in to their existing account.
          const { error: signInErr } = await signIn(emailNorm, form.password);
          if (signInErr) {
            setErrorMsg("This email already has a FieldLogicHQ account, and that password didn't match. Enter your existing password, or reset it from the sign-in page.");
            setStep('error');
            return;
          }
          // Signed in — load their teams so they attach this registration to an existing
          // team instead of silently creating a duplicate (loadCoachTeams flips on the
          // existing-team selector + signed-in state).
          const teams = await loadCoachTeams();
          if (teams.length > 0) {
            setNoticeMsg("You already have an account — you're now signed in. Choose which team this registration is for below (or create a new one), then submit again.");
            setStep('form');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          // No existing teams — fall through and create one via /api/register.
        } else if (!signupRes.ok) {
          const data = await signupRes.json().catch(() => ({})) as { error?: string };
          setErrorMsg(data.error ?? 'Your account could not be created. Please try again.');
          setStep('error');
          return;
        } else {
          const { error: signInErr } = await signIn(emailNorm, form.password);
          if (signInErr) {
            setErrorMsg('Account created, but sign-in failed. Please sign in from the login page to finish.');
            setStep('error');
            return;
          }
        }
        // Now signed in — downstream /api/register sees the session and auto-links.
        setSignedInCoachEmail(emailNorm);
      }

      const payload = new FormData();
      payload.append('teamName', form.teamName.trim());
      // The registrant's name is the team's default head coach (reassignable later in
      // the portal). teams.coach storage is unchanged — we send the combined name.
      payload.append('coachName', `${form.firstName} ${form.lastName}`.trim());
      payload.append('email', (signedInCoachEmail || form.email).trim().toLowerCase());
      payload.append('divisionId', form.divisionId);
      payload.append('divisionName', selectedGroup.name);
      // contactEmail is resolved server-side from organization_members
      payload.append('tournamentId', tournament?.id ?? '');
      payload.append('tournamentName', tournament?.name ?? '');
      payload.append('status', isWaitlist ? 'waitlist' : 'pending');
      if (coachTeamMode === 'existing' && selectedBasicTeamId) {
        payload.append('basicCoachTeamId', selectedBasicTeamId);
      }

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
        const { error } = await res.json();
        throw new Error(error ?? 'Registration failed');
      }

      const result = await res.json() as { id?: string; status?: 'pending' | 'waitlist' };
      const status = result.status === 'waitlist' ? 'waitlist' : isWaitlist ? 'waitlist' : 'pending';
      // After the merge the registrant is always signed in by this point (account created
      // inline or already logged in) and the registration is linked — so instead of a separate
      // success screen, drop them STRAIGHT into their Coaches Portal team record. The `welcome=1`
      // flag triggers the first-run onboarding banner there (what the portal is + pending status
      // + tournament resources), since most coaches don't know the portal exists until now.
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

  const isRegistrationOpen = tournament?.status === 'active' && divisions.length > 0;
  const notOpen = !isRegistrationOpen;
  // A logged-in coach registers as themselves — lock the registrant name to their account,
  // but only when the account actually has both name parts (else stay editable).
  const lockRegistrantName = !!signedInCoachEmail && accountHasName;
  // Registering a SAVED Coaches Portal team — team name + registrant + email are all fixed, so the
  // form collapses to a read-only summary + the division picker (the only new input).
  const existingTeamSelected = !!signedInCoachEmail && coachTeamMode === 'existing' && !!selectedBasicTeamId;

  const selectedGroup = divisions.find(g => g.id === form.divisionId);
  const isClosed = selectedGroup?.isClosed;
  const count = selectedGroup ? stats[selectedGroup.id] || 0 : 0;
  const isWaitlist = Boolean(selectedGroup?.capacity && count >= selectedGroup.capacity);
  const selectedFeeSchedule = resolveFeeSchedule(tournament, selectedGroup);
  // Organizer payment-display controls (settings JSONB; no migration). Default = show.
  const showFees = tournament?.settings?.show_fees_on_register !== false;
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
  const showRulesPage = Boolean(tournament && isPublicPageEnabled(tournament, 'rules'));

  function stepClass(target: 'form' | 'review' | 'success') {
    const done =
      (target === 'form' && (step === 'review' || step === 'submitting' || step === 'success')) ||
      (target === 'review' && step === 'success');
    const active =
      (target === 'form' && step === 'form') ||
      (target === 'review' && (step === 'review' || step === 'submitting')) ||
      (target === 'success' && step === 'success');
    return `${styles.step} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`;
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

  return (
    <div className="page-content">
      {isPreview && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 0.9rem', borderRadius: 8,
              border: '1px solid rgba(217,249,157,0.35)',
              background: 'rgba(217,249,157,0.08)',
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

            {notOpen && step === 'form' && (
              <div className={`card ${styles.closedCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
                <h3>Registration Not Open</h3>
                <p>
                  Tournament registration is not accepting submissions right now.
                  {contactEmail ? (
                    <> Questions? Contact the organizer at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
                  ) : (
                    <> Check back soon or contact the organizer directly.</>
                  )}
                </p>
              </div>
            )}

            {(step === 'form' || step === 'review' || step === 'submitting' || step === 'success') && !notOpen && (
              <div className={styles.steps}>
                <div className={stepClass('form')}>
                  <div className={styles.stepNum}>1</div>
                  <span className={styles.stepText}>Info</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={stepClass('review')}>
                  <div className={styles.stepNum}>2</div>
                  <span className={styles.stepText}>Review</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={stepClass('success')}>
                  <div className={styles.stepNum}>3</div>
                  <span className={styles.stepText}>Next Steps</span>
                </div>
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
                    <dd>{form.teamName}</dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Registered by</dt>
                    <dd>{`${form.firstName} ${form.lastName}`.trim()}</dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Email</dt>
                    <dd>{signedInCoachEmail || form.email}</dd>
                  </div>
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

            {step === 'form' && !notOpen && (
              <div className={`card ${styles.formCard}`}>
                <div className={styles.formHeader}>
                  <div className={styles.formIcon}><UserPlus size={20} /></div>
                  <div>
                    <h2 className={styles.formTitle}>Register Your Team</h2>
                    <p className={styles.formSub}>{tournament?.name}</p>
                  </div>
                </div>

                {noticeMsg && (
                  <div
                    role="status"
                    style={{
                      margin: '0 0 1rem',
                      padding: '0.7rem 0.9rem',
                      border: '1px solid rgba(217,249,157,0.35)',
                      background: 'rgba(217,249,157,0.08)',
                      color: 'var(--fl-text)',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {noticeMsg}
                  </div>
                )}

                <form onSubmit={handleReview}>
                  {signedInCoachEmail && basicCoachTeams.length > 0 && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Coaches Portal Team</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          className={`btn ${coachTeamMode === 'existing' ? 'btn-outline' : 'btn-ghost'} btn-sm`}
                          onClick={() => setCoachTeamMode('existing')}
                        >
                          Existing Team
                        </button>
                        <button
                          type="button"
                          className={`btn ${coachTeamMode === 'new' ? 'btn-outline' : 'btn-ghost'} btn-sm`}
                          onClick={() => {
                            setCoachTeamMode('new');
                            setSelectedBasicTeamId('');
                          }}
                        >
                          New Team
                        </button>
                      </div>
                      {coachTeamMode === 'existing' && (
                        <div className="select-wrapper">
                          <select
                            className="form-input"
                            value={selectedBasicTeamId}
                            onChange={e => selectExistingCoachTeam(e.target.value)}
                            required
                          >
                            <option value="" disabled>Select a team</option>
                            {basicCoachTeams.map(team => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="select-icon" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Existing-team registration: every identity field (team name, registrant,
                      email) is already locked to the saved team + account, so re-showing them as
                      disabled inputs is just noise. Collapse to a read-only summary and ask only
                      for the one thing that's actually new here — the division. */}
                  {existingTeamSelected ? (
                    <div className={styles.existingSummary}>
                      <div className={styles.existingSummaryRow}>
                        <span className={styles.existingSummaryLabel}>Team</span>
                        <span className={styles.existingSummaryValue}>{form.teamName}</span>
                      </div>
                      <div className={styles.existingSummaryRow}>
                        <span className={styles.existingSummaryLabel}>Registering as</span>
                        <span className={styles.existingSummaryValue}>
                          {`${form.firstName} ${form.lastName}`.trim()}
                          {signedInCoachEmail ? ` · ${signedInCoachEmail}` : ''}
                        </span>
                      </div>
                      <p className={styles.existingSummaryNote}>
                        Registering an existing team — you can set the team&apos;s head coach and add
                        contacts for your coaching staff anytime from your Coaches Portal.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Team Name *</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Milton Thunder"
                          value={form.teamName}
                          onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                          required
                          id="reg-team-name"
                        />
                      </div>

                      {/* Registrant — the account user. Their name defaults the team's head
                          coach (reassignable later in the portal). Locked for logged-in coaches. */}
                      <div className="form-row form-row-2" style={{ marginBottom: signedInCoachEmail ? '0.4rem' : '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">First Name *</label>
                          <input
                            className="form-input"
                            placeholder="First name"
                            value={form.firstName}
                            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                            required
                            disabled={lockRegistrantName}
                            autoComplete="given-name"
                            id="reg-first-name"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Last Name *</label>
                          <input
                            className="form-input"
                            placeholder="Last name"
                            value={form.lastName}
                            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                            required
                            disabled={lockRegistrantName}
                            autoComplete="family-name"
                            id="reg-last-name"
                          />
                        </div>
                      </div>
                      {signedInCoachEmail && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--data-gray)', margin: '0 0 1rem', lineHeight: 1.5 }}>
                          You&apos;re registering as yourself — you can set the team&apos;s head coach
                          and add contacts for your coaching staff anytime from your Coaches Portal.
                        </p>
                      )}
                    </>
                  )}

                  <div className={existingTeamSelected ? 'form-group' : 'form-row form-row-2'} style={{ marginBottom: '1rem' }}>
                    {!existingTeamSelected && (
                      <div className="form-group">
                        <label className="form-label">Contact Email *</label>
                        <input
                          className="form-input"
                          type="email"
                          placeholder="coach@example.com"
                          value={signedInCoachEmail || form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          required
                          disabled={!!signedInCoachEmail}
                          id="reg-email"
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Division *</label>
                      <div className="select-wrapper">
                        <select className="form-input" value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))} required>
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
                  </div>

                  {/* Inline account creation — registering sets up the coach's free portal.
                      Hidden when already signed in. Returning emails are handled as sign-in. */}
                  {!signedInCoachEmail && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Create a Password *</label>
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
                      <p style={{ fontSize: '0.72rem', color: 'var(--data-gray)', margin: '0.35rem 0 0', lineHeight: 1.5 }}>
                        This sets up your free Coaches Portal so you can track your team — you&apos;ll go straight there after registering. Already have an account? Enter your existing password.
                      </p>
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
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '1rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertCircle size={20} />
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>Registration for this division is officially closed. You cannot submit a registration.</p>
                    </div>
                  )}

                  {isWaitlist && !isClosed && (
                    <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '1rem', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
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
                    disabled={isClosed}
                    style={{ width: '100%', padding: '0.875rem' }}
                  >
                    Review Registration
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
