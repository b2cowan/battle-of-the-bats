'use client';
import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, ChevronDown, RefreshCw, CreditCard } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Division, Tournament, TournamentRegistrationField } from '@/lib/types';
import styles from '../../register/register.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';

type Step = 'form' | 'submitting' | 'error';

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

export default function RegisterPage() {
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
  const [form, setForm] = useState({
    teamName: '', coachName: '', email: '', divisionId: '',
  });
  const [customAnswers, setCustomAnswers] = useState<CustomAnswerState>({});
  const [customFiles, setCustomFiles] = useState<CustomFileState>({});
  const [signedInCoachEmail, setSignedInCoachEmail] = useState<string | null>(null);
  const [basicCoachTeams, setBasicCoachTeams] = useState<BasicCoachTeamOption[]>([]);
  const [coachTeamMode, setCoachTeamMode] = useState<'new' | 'existing'>('new');
  const [selectedBasicTeamId, setSelectedBasicTeamId] = useState('');

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const selectedGroup = divisions.find(g => g.id === form.divisionId);
      if (!selectedGroup) throw new Error('Invalid division');
      if (coachTeamMode === 'existing' && basicCoachTeams.length > 0 && !selectedBasicTeamId) {
        throw new Error('Select a Coaches Portal team, or choose to create a new team profile.');
      }

      const count = stats[selectedGroup.id] || 0;
      const isWaitlist = selectedGroup.capacity && count >= selectedGroup.capacity;
      const missingField = registrationFields.find(field => {
        if (!field.required) return false;
        if (field.fieldType === 'file') return !customFiles[field.id];
        if (field.fieldType === 'checkbox') return customAnswers[field.id] !== 'true';
        return !customAnswers[field.id]?.trim();
      });
      if (missingField) throw new Error(`Please complete: ${missingField.label}`);

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

      const result = await res.json() as { id?: string };
      if (signedInCoachEmail) {
        router.push('/coaches/tournaments');
        return;
      }

      const joinUrl = new URL('/coaches/join', window.location.origin);
      joinUrl.searchParams.set('email', form.email);
      joinUrl.searchParams.set('next', '/coaches/tournaments');
      joinUrl.searchParams.set('registered', '1');
      if (result.id) joinUrl.searchParams.set('registrationId', result.id);
      router.push(joinUrl.toString());
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
  const isWaitlist = selectedGroup?.capacity && count >= selectedGroup.capacity;
  const selectedFeeSchedule = resolveFeeSchedule(tournament, selectedGroup);

  if (tournament && !isPublicPageEnabled(tournament, 'register')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state">
              <UserPlus size={48} />
              <p>Registration is not available for this tournament.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><UserPlus size={12} /> Register</span>
          <h1 className="display-lg">Team Registration</h1>
          <p className="text-muted">
            Register your team for {tournament?.name ?? 'the upcoming tournament'}.
            A confirmation email will be sent once your registration is reviewed. Payment is handled directly by the tournament organizer.
          </p>
        </div>
      </div>

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

            {(step === 'form' || step === 'submitting') && !notOpen && (
              <div className={styles.steps}>
                <div className={`${styles.step} ${styles.stepActive}`}>
                  <div className={styles.stepNum}>1</div>
                  <span className={styles.stepText}>Info</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>2</div>
                  <span className={styles.stepText}>Review</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={styles.step}>
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

            {(step === 'form' || step === 'submitting') && !notOpen && (
              <div className={`card ${styles.formCard}`}>
                <div className={styles.formHeader}>
                  <div className={styles.formIcon}><UserPlus size={20} /></div>
                  <div>
                    <h2 className={styles.formTitle}>Register Your Team</h2>
                    <p className={styles.formSub}>{tournament?.name}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  {signedInCoachEmail && basicCoachTeams.length > 0 && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Coaches Portal Team</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          className={`btn ${coachTeamMode === 'existing' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                          onClick={() => setCoachTeamMode('existing')}
                          disabled={step === 'submitting'}
                        >
                          Existing Team
                        </button>
                        <button
                          type="button"
                          className={`btn ${coachTeamMode === 'new' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                          onClick={() => {
                            setCoachTeamMode('new');
                            setSelectedBasicTeamId('');
                          }}
                          disabled={step === 'submitting'}
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
                            disabled={step === 'submitting'}
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
                        disabled={step === 'submitting' || coachTeamMode === 'existing'}
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
                        disabled={step === 'submitting' || coachTeamMode === 'existing'}
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
                        disabled={step === 'submitting' || !!signedInCoachEmail}
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
                            background: isWaitlist ? 'var(--warning)' : (count / selectedGroup.capacity > 0.8 ? 'var(--danger)' : 'linear-gradient(to right, var(--primary), var(--primary-light))')
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

                  {selectedGroup && (
                    <div className={styles.paymentNotice}>
                      <div className={styles.paymentNoticeHeader}>
                        <CreditCard size={18} />
                        <span>Payment handled by organizer</span>
                      </div>
                      {selectedFeeSchedule?.totalFeeAmount ? (
                        <div className={styles.paymentDetails}>
                          <div>
                            <span>Total fee</span>
                            <strong>{formatMoney(selectedFeeSchedule.totalFeeAmount)}</strong>
                            {formatDate(selectedFeeSchedule.totalFeeDueDate) && (
                              <em>Due {formatDate(selectedFeeSchedule.totalFeeDueDate)}</em>
                            )}
                          </div>
                          {selectedFeeSchedule.depositAmount ? (
                            <div>
                              <span>Deposit</span>
                              <strong>{formatMoney(selectedFeeSchedule.depositAmount)}</strong>
                              {formatDate(selectedFeeSchedule.depositDueDate) && (
                                <em>Due {formatDate(selectedFeeSchedule.depositDueDate)}</em>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p>
                          The organizer has not published a fee schedule for this division yet.
                        </p>
                      )}
                      <p>
                        FieldLogicHQ records registration and payment status for the organizer, but payments are made outside the platform.
                      </p>
                    </div>
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
                              disabled={step === 'submitting'}
                            />
                          )}
                          {field.fieldType === 'long_text' && (
                            <textarea
                              className="form-textarea"
                              rows={4}
                              value={customAnswers[field.id] ?? ''}
                              onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                              required={field.required}
                              disabled={step === 'submitting'}
                            />
                          )}
                          {field.fieldType === 'dropdown' && (
                            <div className="select-wrapper">
                              <select
                                className="form-input"
                                value={customAnswers[field.id] ?? ''}
                                onChange={e => setCustomAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                                required={field.required}
                                disabled={step === 'submitting'}
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
                                disabled={step === 'submitting'}
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
                              disabled={step === 'submitting'}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={step === 'submitting' || isClosed}
                    style={{ width: '100%', padding: '0.875rem' }}
                  >
                    {step === 'submitting' ? (
                      <><RefreshCw size={18} className="spinner" /> Submitting…</>
                    ) : isWaitlist ? 'Join Waitlist' : 'Submit Registration'}
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
