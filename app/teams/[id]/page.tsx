'use client';
import { useState, useEffect } from 'react';
import { use } from 'react';
import { Users, CheckCircle, Clock, CreditCard, AlertTriangle, Mail } from 'lucide-react';
import styles from './team-profile.module.css';

interface Registration {
  id: string;
  team_name: string;
  coach_name: string;
  email: string;
  age_group_name: string;
  tournament_name: string;
  status: 'pending' | 'accepted' | 'rejected';
  payment_status: 'pending' | 'paid';
  registered_at: string;
}

export default function TeamProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reg, setReg]       = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    fetch(`/api/registrations/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject('Not found'))
      .then(data => { setReg(data); setLoading(false); })
      .catch(() => { setError('Team not found.'); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="page-content">
      <div className="section"><div className="container">
        <div className="empty-state"><Users size={40} /><p>Loading…</p></div>
      </div></div>
    </div>
  );

  if (error || !reg) return (
    <div className="page-content">
      <div className="section"><div className="container">
        <div className="empty-state"><AlertTriangle size={40} /><p>{error || 'Team not found.'}</p></div>
      </div></div>
    </div>
  );

  const isPending  = reg.status === 'pending';
  const isAccepted = reg.status === 'accepted';
  const isRejected = reg.status === 'rejected';
  const paymentDue = isAccepted && reg.payment_status === 'pending';
  const paid       = isAccepted && reg.payment_status === 'paid';

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Users size={12} /> Team Profile</span>
          <h1 className="display-lg">{reg.team_name}</h1>
          <p className="text-muted">{reg.tournament_name} — {reg.age_group_name}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.profileWrap}>

            {/* Status Banner */}
            {isPending && (
              <div className={`${styles.banner} ${styles.bannerPending}`}>
                <Clock size={20} />
                <div>
                  <strong>Registration Pending Review</strong>
                  <p>Your registration has been received and is awaiting approval from the tournament coordinator. You'll receive an email when your status is updated.</p>
                </div>
              </div>
            )}

            {paymentDue && (
              <div className={`${styles.banner} ${styles.bannerPayment}`}>
                <CreditCard size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Payment Required to Secure Your Spot</strong>
                  <p>Your team has been accepted! Please send your registration fee via <strong>Interac E-Transfer</strong> to confirm your spot:</p>
                  <div className={styles.paymentDetails}>
                    <div className={styles.paymentRow}><span>Send to:</span><strong>b2cowan@gmail.com</strong></div>
                    <div className={styles.paymentRow}><span>Message:</span><strong>{reg.team_name} — {reg.age_group_name} — {reg.tournament_name}</strong></div>
                  </div>
                  <p className={styles.paymentNote}>Your registration will be fully confirmed once payment is received.</p>
                </div>
              </div>
            )}

            {paid && (
              <div className={`${styles.banner} ${styles.bannerSuccess}`}>
                <CheckCircle size={20} />
                <div>
                  <strong>Registration Complete!</strong>
                  <p>Your payment has been received and your team is fully registered for {reg.tournament_name}. We'll see you on the diamond!</p>
                </div>
              </div>
            )}

            {isRejected && (
              <div className={`${styles.banner} ${styles.bannerRejected}`}>
                <AlertTriangle size={20} />
                <div>
                  <strong>Registration Not Accepted</strong>
                  <p>Unfortunately we were unable to accommodate your team in this tournament. Please contact us at <a href="mailto:b2cowan@gmail.com">b2cowan@gmail.com</a> for more information.</p>
                </div>
              </div>
            )}

            {/* Team Info Card */}
            <div className={`card ${styles.infoCard}`}>
              <h3 className={styles.infoTitle}>Registration Details</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}><span className={styles.infoLabel}>Team</span><span className={styles.infoValue}>{reg.team_name}</span></div>
                <div className={styles.infoItem}><span className={styles.infoLabel}>Coach</span><span className={styles.infoValue}>{reg.coach_name}</span></div>
                <div className={styles.infoItem}><span className={styles.infoLabel}>Division</span><span className={styles.infoValue}><span className="badge badge-purple">{reg.age_group_name}</span></span></div>
                <div className={styles.infoItem}><span className={styles.infoLabel}>Tournament</span><span className={styles.infoValue}>{reg.tournament_name}</span></div>
                <div className={styles.infoItem}><span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}>
                    {isPending  && <span className="badge badge-warning">Pending</span>}
                    {isAccepted && <span className="badge badge-success">Accepted</span>}
                    {isRejected && <span className="badge badge-danger">Not Accepted</span>}
                  </span>
                </div>
                {isAccepted && (
                  <div className={styles.infoItem}><span className={styles.infoLabel}>Payment</span>
                    <span className={styles.infoValue}>
                      {paid      ? <span className="badge badge-success">Paid ✓</span>
                                 : <span className="badge badge-warning">Pending</span>}
                    </span>
                  </div>
                )}
                <div className={styles.infoItem}><span className={styles.infoLabel}>Registered</span>
                  <span className={styles.infoValue}>{new Date(reg.registered_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <div className={styles.contactNote}>
              <Mail size={14} />
              <span>Questions about your registration? Email <a href="mailto:b2cowan@gmail.com">b2cowan@gmail.com</a></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
