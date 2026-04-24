'use client';
import { useState, useEffect } from 'react';
import { UserPlus, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { getAgeGroups, getActiveTournament, getContacts } from '@/lib/storage';
import { AgeGroup, Tournament, Contact } from '@/lib/types';
import styles from './register.module.css';

type Step = 'form' | 'submitting' | 'success' | 'error';

export default function RegisterPage() {
  const [ageGroups, setAgeGroups]     = useState<AgeGroup[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [tournament, setTournament]   = useState<Tournament | null>(null);
  const [step, setStep]               = useState<Step>('form');
  const [errorMsg, setErrorMsg]       = useState('');
  const [form, setForm] = useState({
    teamName: '', coachName: '', email: '', ageGroupId: '',
  });

  useEffect(() => {
    setAgeGroups(getAgeGroups());
    setContacts(getContacts());
    setTournament(getActiveTournament());
  }, []);

  const selectedGroup = ageGroups.find(g => g.id === form.ageGroupId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup || !tournament) return;

    setStep('submitting');
    try {
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
          tournamentName: tournament.name,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Registration failed');
      }

      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  const notOpen = !tournament || ageGroups.length === 0;

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><UserPlus size={12} /> Register</span>
          <h1 className="display-lg">Team Registration</h1>
          <p className="text-muted">
            Register your team for {tournament?.name ?? 'the upcoming tournament'}.
            A confirmation email will be sent once your registration is reviewed.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.formWrap}>

            {notOpen && step === 'form' && (
              <div className={`card ${styles.closedCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
                <h3>Registration Not Yet Open</h3>
                <p>Tournament registration isn't available yet. Check back soon or contact us at <a href="mailto:b2cowan@gmail.com">b2cowan@gmail.com</a>.</p>
              </div>
            )}

            {step === 'success' && (
              <div className={`card ${styles.successCard}`}>
                <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 1rem', display: 'block' }} />
                <h2 className={styles.successTitle}>Registration Submitted!</h2>
                <p className={styles.successText}>
                  Thank you for registering <strong>{form.teamName}</strong>. A confirmation has been sent to <strong>{form.email}</strong>.
                </p>
                <div className={styles.successInfo}>
                  <p>Your registration is <strong>pending review</strong>. Once accepted, you'll receive an email with payment instructions to secure your spot via Interac E-Transfer.</p>
                </div>
                <button className="btn btn-outline" onClick={() => { setStep('form'); setForm({ teamName: '', coachName: '', email: '', ageGroupId: '' }); }}>
                  Register Another Team
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className={`card ${styles.errorCard}`}>
                <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem', display: 'block' }} />
                <h3>Registration Failed</h3>
                <p>{errorMsg}</p>
                <button className="btn btn-outline" onClick={() => setStep('form')}>Try Again</button>
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
                      <div className={styles.selectWrap}>
                        <select
                          className="form-select"
                          value={form.ageGroupId}
                          onChange={e => setForm(f => ({ ...f, ageGroupId: e.target.value }))}
                          required
                          disabled={step === 'submitting'}
                          id="reg-division"
                        >
                          <option value="">Select age group…</option>
                          {ageGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name} (Ages {g.minAge}–{g.maxAge})</option>
                          ))}
                        </select>
                        <ChevronDown size={15} className={styles.selectIcon} />
                      </div>
                    </div>
                  </div>

                  <div className={styles.notice}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <p>Registration is <strong>not guaranteed</strong> until accepted by the tournament coordinator. You will receive a confirmation email at the address provided. Payment via Interac E-Transfer will be required upon acceptance.</p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '0.875rem' }}
                    disabled={step === 'submitting'}
                    id="reg-submit-btn"
                  >
                    {step === 'submitting' ? 'Submitting…' : <><UserPlus size={16} /> Submit Registration</>}
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
