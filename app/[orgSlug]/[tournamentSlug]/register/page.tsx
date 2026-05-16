'use client';
import { useState, useEffect } from 'react';
import { UserPlus, CheckCircle, AlertCircle, ChevronDown, RefreshCw, Send, ShieldCheck, CreditCard } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getAgeGroups, getContacts, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { AgeGroup, Tournament, Contact } from '@/lib/types';
import styles from '../../register/register.module.css';

type Step = 'form' | 'submitting' | 'success' | 'error';

type FeeSchedule = {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
  source: 'tournament' | 'division';
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

function resolveFeeSchedule(tournament: Tournament | null, group: AgeGroup | undefined): FeeSchedule | null {
  if (!tournament || !group) return null;

  if (tournament.feeScheduleMode === 'age_group' && group.totalFeeAmount != null) {
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
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [stats, setStats]           = useState<Record<string, number>>({});
  const [step, setStep]             = useState<Step>('form');
  const [errorMsg, setErrorMsg]     = useState('');
  const [form, setForm] = useState({
    teamName: '', coachName: '', email: '', ageGroupId: '',
  });

  useEffect(() => {
    async function init() {
      const org = await getOrganizationBySlug(orgSlug);
      const ts  = org ? await getTournamentsByOrg(org.id) : [];
      const current = ts.find(t => t.slug === tournamentSlug) ?? null;
      setTournament(current);
      setContactEmail(current?.contactEmail ?? org?.contactEmail ?? null);
      if (current) {
        setAgeGroups(await getAgeGroups(current.id));
        setContacts(await getContacts(current.id));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const selectedGroup = ageGroups.find(g => g.id === form.ageGroupId);
      if (!selectedGroup) throw new Error('Invalid division');

      const count = stats[selectedGroup.id] || 0;
      const isWaitlist = selectedGroup.capacity && count >= selectedGroup.capacity;

      setStep('submitting');
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName:       form.teamName.trim(),
          coachName:      form.coachName.trim(),
          email:          form.email.trim().toLowerCase(),
          ageGroupId:     form.ageGroupId,
          ageGroupName:   selectedGroup.name,
          contactEmail:   contacts.find(c => c.id === selectedGroup.contactId)?.email,
          tournamentId:   tournament?.id,
          tournamentName: tournament?.name,
          status:         isWaitlist ? 'waitlist' : 'pending',
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Registration failed');
      }

      setStep('success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  const isRegistrationOpen = tournament?.status === 'active' && ageGroups.length > 0;
  const notOpen = !isRegistrationOpen;

  const selectedGroup = ageGroups.find(g => g.id === form.ageGroupId);
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

            {step === 'success' && (
              <div className={`card ${styles.successCard}`}>
                <CheckCircle size={56} style={{ color: 'var(--success)', margin: '0 auto 1.5rem', display: 'block' }} />
                <h2 className={styles.successTitle}>Registration Received!</h2>
                <p className={styles.successText}>
                  Your entry for <strong>{form.teamName}</strong> has been successfully submitted.
                </p>

                <div className={styles.successSteps}>
                  <div className={styles.successItem}>
                    <div className={styles.successIcon}><Send size={20} /></div>
                    <div>
                      <span className={styles.successTitleInner}>Confirmation Sent</span>
                      <p className={styles.successDescInner}>Check <strong>{form.email}</strong> for your registration summary and next steps.</p>
                    </div>
                  </div>
                  <div className={styles.successItem}>
                    <div className={styles.successIcon}><ShieldCheck size={20} /></div>
                    <div>
                      <span className={styles.successTitleInner}>Admin Review</span>
                      <p className={styles.successDescInner}>Our tournament director will review your team. This typically takes 24-48 hours.</p>
                    </div>
                  </div>
                  <div className={styles.successItem}>
                    <div className={styles.successIcon}><CreditCard size={20} /></div>
                    <div>
                      <span className={styles.successTitleInner}>Payment Instructions</span>
                      <p className={styles.successDescInner}>If payment is required, the organizer will send instructions directly. FieldLogicHQ does not process online payments.</p>
                    </div>
                  </div>
                </div>

                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => { setStep('form'); setForm({ teamName: '', coachName: '', email: '', ageGroupId: '' }); }}>
                  Register Another Team
                </button>
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
                  <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Team Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Milton Thunder"
                        value={form.teamName}
                        onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                        required
                        disabled={step === 'submitting'}
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
                        disabled={step === 'submitting'}
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
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        required
                        disabled={step === 'submitting'}
                        id="reg-email"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Division *</label>
                      <div className="select-wrapper">
                        <select className="form-input" value={form.ageGroupId} onChange={e => setForm(f => ({ ...f, ageGroupId: e.target.value }))} required>
                          <option value="" disabled>Select a division</option>
                          {ageGroups.map(g => {
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
