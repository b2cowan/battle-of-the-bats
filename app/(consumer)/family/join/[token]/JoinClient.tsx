'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import { teamInitials } from '@/lib/team-color';
import {
  GUARDIAN_AGE_BAND_OPTIONS,
  GUARDIAN_CONSENT_DRAFT_NOTICE,
  GUARDIAN_CONSENT_LABELS,
  type GuardianAgeBand,
} from '@/lib/family-guardian-consent';

/**
 * The family request page (S2) — the only door into the family layer.
 *
 * Deliberately shows the requester NOTHING from the roster: no player list, no match
 * hint, no "did you mean". They pick a tier, say who they are to the team, and wait for
 * the coach. Every bit of matching happens on the coach's side (owner ruling #3).
 *
 * Slice 1 wires the FOLLOWER path. The guardian option still RENDERS — a parent must be
 * able to see that the product knows the difference and that their path exists — but
 * choosing it explains honestly that it is not open yet rather than silently failing or
 * quietly hiding. It is blocked on the privacy counsel review, and a page that pretended
 * otherwise would be the wrong kind of polish.
 */

type Tier = 'follower' | 'guardian';

interface JoinView {
  state: 'open' | 'invalid';
  teamName: string;
  orgName: string;
  orgLogoUrl: string | null;
  signedIn: boolean;
  signedInEmail: string | null;
  existingStatus: string | null;
  /** Whether the guardian tier is switched ON. Comes from the SERVER — the browser never
   *  decides this, and while it is false the API refuses guardian requests outright. */
  guardianTierEnabled: boolean;
}

export default function JoinClient({ token }: { token: string }) {
  const [view, setView] = useState<JoinView | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>('follower');
  const [relationship, setRelationship] = useState('');
  // Guardian path (rendered only when the server says the tier is switched on).
  // Both name parts: the coach approving needs to tell two same-first-name children apart.
  const [playerFirstName, setPlayerFirstName] = useState('');
  const [playerLastName, setPlayerLastName] = useState('');
  const [ageBand, setAgeBand] = useState<GuardianAgeBand | ''>('');
  const [consentData, setConsentData] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/family/join/${token}`);
      const data = await res.json();
      setView(res.ok ? data : { state: 'invalid' });
    } catch {
      setView({ state: 'invalid' } as JoinView);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = tier === 'guardian'
        ? {
            role: 'guardian',
            playerFirstName: playerFirstName.trim(),
            playerLastName: playerLastName.trim(),
            relationship: relationship.trim() || null,
            ageBand,
            consentDataCollection: consentData,
            consentGuardian: consentGuardian,
          }
        : { role: 'follower', relationship: relationship.trim() || null };

      const res = await fetch(`/api/family/join/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'That request could not be sent.');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /** The guardian form is only complete with a name, an age band and BOTH required consents. */
  const guardianReady =
    playerFirstName.trim().length > 0 && playerLastName.trim().length > 0
    && !!ageBand && consentData && consentGuardian;

  const shell = (inner: React.ReactNode) => (
    <div className={warm.warm}>
      <div className={styles.page}>{inner}</div>
    </div>
  );

  if (loading) return shell(<p className={styles.empty}>Loading…</p>);

  // One shape for every "no" — an unknown link, a reset link, a team that is not on a
  // premium portal. A visitor must not be able to tell which.
  if (!view || view.state !== 'open') {
    return shell(
      <div className={styles.card}>
        <h1 className={styles.joinTitle}>This link isn’t active</h1>
        <p className={styles.joinLede}>
          It may have been replaced by a newer one. Ask the team’s coach for the current link.
        </p>
      </div>,
    );
  }

  const head = (
    <div className={styles.joinHead}>
      <div className={styles.orgMark} aria-hidden>
        {view.orgLogoUrl ? <img src={view.orgLogoUrl} alt="" /> : teamInitials(view.orgName)}
      </div>
      <div className={styles.orgName}>{view.orgName}</div>
      <h1 className={styles.joinTitle}>Follow {view.teamName}</h1>
    </div>
  );

  // A returning visitor is told where they stand rather than being handed the form again.
  // 'declined' and 'revoked' deliberately fall through to the form — a coach who declined by
  // mistake, or a family member rejoining, must be able to ask again.
  if (view.existingStatus === 'verified') {
    return shell(<>
      {head}
      <div className={styles.card}>
        <p className={styles.notice}>You’re already connected to this team.</p>
        <div className={styles.actions}>
          <Link href="/following" className={styles.chip}>Go to Following</Link>
        </div>
      </div>
    </>);
  }

  if (view.existingStatus === 'requested' || view.existingStatus === 'pending_approval') {
    return shell(<>
      {head}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Waiting on the coach</h2>
        <p className={styles.notice}>
          Your request is with {view.teamName}’s coach. The team’s schedule appears here once
          they approve you — there’s nothing else you need to do.
        </p>
        <div className={styles.actions}>
          <Link href="/following" className={styles.chip}>Go to Following</Link>
        </div>
      </div>
    </>);
  }

  if (done) {
    return shell(<>
      {head}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Request sent</h2>
        <p className={styles.notice}>
          {view.teamName}’s coach will review your request. You’ll see the team’s schedule here
          once they approve you.
        </p>
        <div className={styles.actions}>
          <Link href="/following" className={styles.chip}>Go to Following</Link>
        </div>
      </div>
    </>);
  }

  return shell(<>
    {head}
    <p className={styles.joinLede} style={{ textAlign: 'center' }}>
      Schedule, results and game updates — once the coach approves you.
    </p>

    <div className={styles.card} style={{ marginTop: '0.9rem' }}>
      <h2 className={styles.cardTitle}>I am…</h2>

      <button
        type="button"
        className={`${styles.tier} ${tier === 'follower' ? styles.tierOn : ''}`}
        onClick={() => setTier('follower')}
        aria-pressed={tier === 'follower'}
      >
        <span className={styles.tierRadio} aria-hidden>{tier === 'follower' ? '●' : '○'}</span>
        <span>
          <span className={styles.tierLabel}>A family member following the team</span>
          <span className={styles.tierSub}>Schedule, results &amp; game updates — no player questions</span>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.tier} ${tier === 'guardian' ? styles.tierOn : ''}`}
        onClick={() => setTier('guardian')}
        aria-pressed={tier === 'guardian'}
      >
        <span className={styles.tierRadio} aria-hidden>{tier === 'guardian' ? '●' : '○'}</span>
        <span>
          <span className={styles.tierLabel}>A player’s parent or guardian</span>
          <span className={styles.tierSub}>Money &amp; registration contact · player’s season recap</span>
        </span>
      </button>

      {/* The honest closed door, shown while the guardian tier is switched off. */}
      {tier === 'guardian' && !view.guardianTierEnabled && (
        <p className={styles.holdNote}>
          Connecting as a parent or guardian isn’t open yet — we’re finishing the privacy review
          that covers a child’s information. <strong>Following the team is available now</strong> and
          gives you the schedule, results and game updates. Your coach can connect you as a guardian
          once it opens.
        </p>
      )}
    </div>

    {tier === 'guardian' && view.guardianTierEnabled && (
      <>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Who’s your player?</h2>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Their first name</span>
            <input
              className={styles.input}
              value={playerFirstName}
              onChange={e => setPlayerFirstName(e.target.value)}
              maxLength={60}
              autoComplete="off"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Their last name</span>
            <input
              className={styles.input}
              value={playerLastName}
              onChange={e => setPlayerLastName(e.target.value)}
              maxLength={60}
              autoComplete="off"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>You are their…</span>
            <input
              className={styles.input}
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              maxLength={40}
              placeholder="Mom"
              autoComplete="off"
            />
          </label>
          {/* Asked, not derived: the consent rules differ by age, and Quebec's threshold is
              different again. Better a question than an assumption about a child. */}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>How old are they?</span>
            <select
              className={styles.input}
              value={ageBand}
              onChange={e => setAgeBand(e.target.value as GuardianAgeBand)}
            >
              <option value="">Choose…</option>
              {GUARDIAN_AGE_BAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.card}>
          <p className={styles.placeholderNote}>{GUARDIAN_CONSENT_DRAFT_NOTICE}</p>
          <label className={styles.check}>
            <input type="checkbox" checked={consentData} onChange={e => setConsentData(e.target.checked)} />
            <span>{GUARDIAN_CONSENT_LABELS.dataCollection(view.orgName)} <strong>Required</strong></span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={consentGuardian} onChange={e => setConsentGuardian(e.target.checked)} />
            <span>{GUARDIAN_CONSENT_LABELS.guardian} <strong>Required</strong></span>
          </label>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          {view.signedIn ? (
            <button type="button" className={styles.chip} onClick={submit} disabled={submitting || !guardianReady}>
              {submitting ? 'Sending…' : 'Send request to the coach'}
            </button>
          ) : (
            <>
              <Link
                href={`/auth/signup?next=${encodeURIComponent(`/family/join/${token}`)}`}
                className={`${styles.chip} ${styles.chipLime}`}
              >
                Create account &amp; send request
              </Link>
              <div>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(`/family/join/${token}`)}`}
                  className={styles.linkAction}
                >
                  I already have an account
                </Link>
              </div>
            </>
          )}
        </div>
      </>
    )}

    {tier === 'follower' && (
      <>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>How are you connected?</h2>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Optional — helps the coach recognize you</span>
            <input
              className={styles.input}
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              maxLength={40}
              placeholder="Grandparent"
              autoComplete="off"
            />
          </label>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          {view.signedIn ? (
            <button type="button" className={styles.chip} onClick={submit} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send request to the coach'}
            </button>
          ) : (
            <>
              {/* Lime marks the one account-creation conversion moment, and only here. */}
              <Link
                href={`/auth/signup?next=${encodeURIComponent(`/family/join/${token}`)}`}
                className={`${styles.chip} ${styles.chipLime}`}
              >
                Create account &amp; send request
              </Link>
              <div>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(`/family/join/${token}`)}`}
                  className={styles.linkAction}
                >
                  I already have an account
                </Link>
              </div>
            </>
          )}
        </div>
      </>
    )}

    <p className={styles.footNote}>
      The coach approves every request, and can remove anyone at any time. This page never shows
      the team’s roster.
    </p>
  </>);
}
