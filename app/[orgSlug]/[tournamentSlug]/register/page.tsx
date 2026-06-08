'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserPlus, AlertCircle, ChevronDown, RefreshCw, CreditCard, CheckCircle, Calendar, Mail } from 'lucide-react';
import { useParams } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Division, Tournament, TournamentRegistrationField } from '@/lib/types';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import Countdown from '@/components/public/Countdown';
import styles from '../../register/register.module.css';
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

export default function RegisterPage() {
  const params         = useParams();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationFields, setRegistrationFields] = useState<TournamentRegistrationField[]>([]);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [stats, setStats]           = useState<Record<string, number>>({});
  const [step, setStep]             = useState<Step>('form');
  const [errorMsg, setErrorMsg]     = useState('');
  const [form, setForm] = useState({
    teamName: '', coachName: '', email: '', divisionId: '',
  });
  const [customAnswers, setCustomAnswers] = useState<CustomAnswerState>({});
  const [customFiles, setCustomFiles] = useState<CustomFileState>({});
  const [signedInCoachEmail, setSignedInCoachEmail] = useState<string | null>(null);
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

  useEffect(() => {
    async function loadCoachTeams() {
      try {
        const res = await fetch('/api/coaches/basic-teams', { cache: 'no-store' });
        if (res.status === 401) return;
        if (!res.ok) return;
        const data = await res.json() as {
          user?: { email?: string };
          teams?: BasicCoachTeamOption[];
        };
        const userEmail = data.user?.email?.toLowerCase() ?? null;
        setSignedInCoachEmail(userEmail);
        setBasicCoachTeams(data.teams ?? []);
        if (userEmail) {
          setForm(f => ({ ...f, email: f.email || userEmail }));
        }
        if ((data.teams ?? []).length > 0) {
          setCoachTeamMode('existing');
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadCoachTeams();
  }, []);

  function selectExistingCoachTeam(teamId: string) {
    setSelectedBasicTeamId(teamId);
    const team = basicCoachTeams.find(item => item.id === teamId);
    if (!team) return;
    setForm(f => ({
      ...f,
      teamName: team.name,
      coachName: team.primaryCoachName || f.coachName,
      email: signedInCoachEmail || f.email,
    }));
  }

  function validateRegistrationDetails() {
    const selectedGroup = divisions.find(g => g.id === form.divisionId);
    if (!selectedGroup) throw new Error('Select a division before reviewing your registration.');
    if (coachTeamMode === 'existing' && basicCoachTeams.length > 0 && !selectedBasicTeamId) {
      throw new Error('Select a Coaches Portal team, or choose to create a new team profile.');
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
      setStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  async function submitRegistration() {
    try {
      const { selectedGroup, isWaitlist } = validateRegistrationDetails();

      const payload = new FormData();
      payload.append('teamName', form.teamName.trim());
      payload.append('coachName', form.coachName.trim());
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
      const joinUrl = signedInCoachEmail
        ? new URL('/coaches/tournaments', window.location.origin)
        : new URL('/coaches/join', window.location.origin);

      if (!signedInCoachEmail) {
        joinUrl.searchParams.set('email', form.email);
        joinUrl.searchParams.set('next', '/coaches/tournaments');
        joinUrl.searchParams.set('registered', '1');
        if (result.id) joinUrl.searchParams.set('registrationId', result.id);
      }

      setConfirmation({ id: result.id, status, joinHref: joinUrl.toString() });
      setStep('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  const isRegistrationOpen = tournament?.status === 'active' && divisions.length > 0;
  const notOpen = !isRegistrationOpen;

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

                <div className={styles.reviewSummary}>
                  <div>
                    <span>Team</span>
                    <strong>{form.teamName}</strong>
                  </div>
                  <div>
                    <span>Coach / Contact</span>
                    <strong>{form.coachName}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{signedInCoachEmail || form.email}</strong>
                  </div>
                  <div>
                    <span>Division</span>
                    <strong>{selectedGroup.name}</strong>
                  </div>
                  <div>
                    <span>Status after submit</span>
                    <strong>{isWaitlist ? 'Waitlist' : 'Pending organizer review'}</strong>
                  </div>
                  {/* Fee lives in the richer payment panel below (deposit + due dates +
                      organizer context) — no duplicate summary card. */}
                  {contactEmail ? (
                    <div>
                      <span>Organizer Contact</span>
                      <strong>{contactEmail}</strong>
                    </div>
                  ) : null}
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
                    disabled={step === 'submitting' || isClosed}
                  >
                    {step === 'submitting' ? (
                      <><RefreshCw size={18} className="spinner" /> Submitting...</>
                    ) : isWaitlist ? 'Join Waitlist' : 'Submit Registration'}
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
                      <span className={styles.successTitleInner}>Watch your email</span>
                      <span className={styles.successDescInner}>
                        {confirmation.status === 'waitlist'
                          ? 'Check your inbox for your waitlist confirmation. The organizer will reach out if a spot opens'
                          : 'Check your inbox for your confirmation. The organizer follows up with approval and how to pay'}
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

                  <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Team Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Milton Thunder"
                        value={form.teamName}
                        onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                        required
                        disabled={coachTeamMode === 'existing'}
                        id="reg-team-name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Coach / Contact Name *</label>
                      <input
                        className="form-input"
                        placeholder="Full name"
                        value={form.coachName}
                        onChange={e => setForm(f => ({ ...f, coachName: e.target.value }))}
                        required
                        disabled={coachTeamMode === 'existing'}
                        id="reg-coach-name"
                      />
                    </div>
                  </div>

                  <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
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
