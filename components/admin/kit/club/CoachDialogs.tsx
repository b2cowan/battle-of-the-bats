'use client';
/**
 * A CLUB TEAM'S COACHES — THE WINDOWS (Club Tier Stage 2, specimen 5; D10 + Ask 4 + Ask 6), calling
 * session 1's routes under `…/teams/[teamId]/coaches`.
 *
 *   InviteCoachDialog   — the portal's invite window, reused: their email, then "Who are they?" (a
 *                         dropdown: Head coach · Assistant coach), then what they'll be able to open.
 *                         NO name field, deliberately (the name comes from their own account when
 *                         they accept; the row shows the email until then). Creating asks: Send invite.
 *   CoachPersonDialog   — a person opens as a window (like Members' Manage): their role, what they
 *                         can open, since when, and Remove. ⚠ Departure, told at build time: the
 *                         drawing says "their page"; a window keeps the club's one idiom for a person.
 *   Remove              — always asks; names the case when it leaves the team with NO head coach, and
 *                         only then sends the server's `confirmLastHeadCoach` (J4-035). The club may
 *                         leave a team with none (the board says so in red); the portal still may not.
 * ⚠ Departure, told at build time: no "Change what they'll open" in the club's invite. An assistant
 * the club invites starts on the portal's assistant preset, and the head coach adjusts it on the
 * team's Staff page — the club's server takes no grants (session 1).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
// The member record's rare-door row (the same door as Members' Manage window, Board Ready two-step Part 3).
import memberStyles from './Members.module.css';
import { Callout, RecordAction, repKit } from './RepKit';
import { TWO_STEP_FRESH_CODE } from '@/lib/code-again';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';
import { STAFF_KIND_COPY } from '@/lib/coach-capabilities';
import { formatStoredDate } from '@/lib/timezone';
import { joinWithAnd, possessive } from '@/lib/utils';

/** Two-step sign-in on the coach's window (Board Ready, Part 3; ask A, drawn and approved 2026-11-11). */
type CoachTwoStep = { on: boolean; since: string | null; door: 'none' | 'support' | 'own_first' | 'club' };

export interface ClubStaffRow {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  coachRole: 'head_coach' | 'assistant_coach' | string;
  kindWord: string;
  since: string;
  opens: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What each seat the club can name opens, in one sentence (the invite window's facts). */
export function seatOpens(kind: 'head_coach' | 'assistant_coach', teamName: string): string {
  return kind === 'head_coach'
    ? `Everything in ${possessive(teamName)} Coaches Portal, including its staff page and its tryouts.`
    : `${STAFF_KIND_COPY.assistant.emailWhat.replace(/^Accept below to set up your account\. /, '').replace('You’ll get', 'They get')}`;
}

export function InviteCoachDialog({
  orgSlug, teamId, teamName, onClose, onSent,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<'' | 'head_coach' | 'assistant_coach'>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = EMAIL_RE.test(email.trim()) && kind !== '';

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/coaches?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'The invitation could not be sent. Please try again.'); return; }
      onSent(email.trim().toLowerCase());
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={teamName}
      title="Invite a coach"
      identity="They get an email with a link that works for 7 days. Their access starts when they accept."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={send} disabled={!ready || busy}>
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </>
      }
    >
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <label className={ck.field}>
        <span className={ck.label}>Their email<span className={repKit.req} aria-hidden>*</span></span>
        <input className={ck.input} type="email" value={email} autoComplete="off" onChange={e => setEmail(e.target.value)} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Who are they?<span className={repKit.req} aria-hidden>*</span></span>
        <select className={ck.select} value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
          <option value="">Choose one</option>
          <option value="head_coach">Head coach — runs the team</option>
          <option value="assistant_coach">Assistant coach — coaches the team</option>
        </select>
      </label>
      {kind && (
        <div className={repKit.facts}>
          <span className={repKit.factsLabel}>What they’ll be able to open</span>
          {seatOpens(kind, teamName)}
        </div>
      )}
    </KitDialog>
  );
}

export function CoachPersonDialog({
  orgSlug, teamId, teamName, person, isOnlyHeadCoach, canWrite, onClose, onRemoved,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  person: ClubStaffRow;
  /** The team's only head coach — Remove then names what follows. */
  isOnlyHeadCoach: boolean;
  canWrite: boolean;
  onClose: () => void;
  onRemoved: (name: string, teamHasHeadCoach: boolean) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  const [twoStep, setTwoStep] = useState<CoachTwoStep | null>(null);
  const [resetNotice, setResetNotice] = useState('');
  const [lastHead, setLastHead] = useState(isOnlyHeadCoach);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const who = person.name || person.email || 'This coach';
  const first = who.split(' ')[0];

  // The club's owner and admins (the page's writers) see on / off and the door; read once, when the window opens.
  const twoStepUrl = `/api/admin/rep-teams/teams/${teamId}/coaches/${person.membershipId}/two-step?orgSlug=${encodeURIComponent(orgSlug)}`;
  useEffect(() => {
    if (!canWrite) return;
    let stale = false;
    fetch(twoStepUrl)
      .then(r => (r.ok ? r.json() : null))
      .then((d: CoachTwoStep | null) => { if (!stale) setTwoStep(d); })
      .catch(() => { if (!stale) setTwoStep(null); });
    return () => { stale = true; };
  }, [canWrite, twoStepUrl]);

  async function resetTwoStep() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(twoStepUrl, { method: 'POST' });
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
      setAskingReset(false);
      // The one window asked for the viewer's code and they said no: nothing changed.
      if (res.status === 401 && data.code === TWO_STEP_FRESH_CODE) { setError('Nothing changed. Resetting someone’s two-step sign-in needs your code.'); return; }
      if (!res.ok) { setError(data.error ?? 'It wasn’t reset. Try again.'); return; }
      setTwoStep({ on: false, since: null, door: 'none' });
      setResetNotice(`${possessive(who)} two-step sign-in was reset. We’ve emailed ${first}.`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/coaches/${person.membershipId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmLastHeadCoach: lastHead }),
      });
      const data = await res.json().catch(() => ({}));
      // The count moved since the page loaded (another head coach left): ask again, naming it.
      if (res.status === 409 && data.code === 'last_head_coach') { setLastHead(true); return; }
      if (!res.ok) { setError(data.error ?? 'They could not be removed. Please try again.'); return; }
      onRemoved(who, data.teamHasHeadCoach !== false);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (asking) {
    return (
      <KitDialog
        kind="question"
        eyebrow={teamName}
        title={`Remove ${who} from ${teamName}?`}
        onClose={() => { setAsking(false); setError(''); }}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => { setAsking(false); setError(''); }} disabled={busy}>Keep them</button>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</button>
          </>
        }
      >
        <p>
          {first} loses their coaching access to this team immediately, on every screen and in every season. Their
          name stays on the seasons they coached, and adding them back later restores their access.
        </p>
        {error && <p className={repKit.formError} role="alert">{error}</p>}
        {lastHead && (
          <Callout tone="bad" icon={<AlertTriangle size={15} aria-hidden />}>
            <b>{teamName} will have no head coach.</b> Its row on Rep teams will say so until you invite one.
          </Callout>
        )}
      </KitDialog>
    );
  }

  if (askingReset) {
    return (
      <KitDialog
        kind="question"
        eyebrow={teamName}
        title={`Reset ${possessive(first)} two-step sign-in?`}
        onClose={() => { setAskingReset(false); setError(''); }}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => { setAskingReset(false); setError(''); }} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={resetTwoStep} disabled={busy} data-autofocus="" id="coach-reset-two-step">
              {busy ? 'Resetting…' : 'Reset two-step'}
            </button>
          </>
        }
      >
        <p>
          {possessive(first)} authenticator app and backup codes stop working, and {first} is signed out everywhere. Next time
          {' '}{first} signs in with their password, they set up two-step sign-in again.
        </p>
        <p>We’ll email {first} to say you did this. It’s recorded in the audit log.</p>
      </KitDialog>
    );
  }

  const isHead = person.coachRole === 'head_coach';
  return (
    <KitDialog
      kind="form"
      eyebrow={teamName}
      title={who}
      identity={[person.name && person.email ? person.email : null, `${person.kindWord} since ${formatStoredDate(person.since)}`].filter(Boolean).join(' · ')}
      onClose={onClose}
      footerStart={canWrite ? (
        <button type="button" className="btn btn-danger" onClick={() => { setError(''); setAsking(true); }}>Remove</button>
      ) : undefined}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>Done</button>}
    >
      <div className={repKit.facts}>
        <span className={repKit.factsLabel}>Their role</span>
        {person.kindWord}
      </div>
      <div className={`${repKit.facts} ${repKit.factsNext}`}>
        <span className={repKit.factsLabel}>What they can open</span>
        {isHead
          ? seatOpens('head_coach', teamName)
          : person.opens.length > 0
            ? `The team’s everyday tools, and ${joinWithAnd(person.opens)}.`
            : 'The team’s everyday tools — nothing sensitive (no money, family contacts or notes).'}
        {!isHead && ' The head coach sets this on the team’s Staff page.'}
      </div>
      {resetNotice && <p className={ck.hint} role="status">{resetNotice}</p>}
      {error && !asking && <p className={repKit.formError} role="alert">{error}</p>}
      {twoStep && (
        <div className={`${repKit.facts} ${repKit.factsNext}`}>
          <span className={repKit.factsLabel}>Two-step sign-in</span>
          {twoStep.on ? (twoStep.since ? `On since ${formatStoredDate(twoStep.since)}` : 'On') : 'Off'}
          {twoStep.door === 'own_first' && (
            <span className={ck.hint} style={{ display: 'block', marginTop: 4 }}>
              To reset it, turn on two-step sign-in for your own account first.{' '}
              <a href="/account/security">Open Sign-in &amp; security</a>
            </span>
          )}
          {twoStep.door === 'support' && (
            <span className={ck.hint} style={{ display: 'block', marginTop: 4 }}>
              Only FieldLogicHQ support can reset this one. {first} emails {FIELDLOGICHQ_CONTACT_EMAIL} from their account’s address.
            </span>
          )}
        </div>
      )}
      {twoStep?.door === 'club' && (
        <div className={memberStyles.recordEnd}>
          <RecordAction icon={<KeyRound size={13} aria-hidden />} onClick={() => { setError(''); setResetNotice(''); setAskingReset(true); }} disabled={busy}>
            Reset two-step sign-in…
          </RecordAction>
        </div>
      )}
    </KitDialog>
  );
}

export function CancelInviteQuestion({
  email, busy, onKeep, onCancel,
}: { email: string; busy: boolean; onKeep: () => void; onCancel: () => void }) {
  return (
    <KitDialog
      kind="question"
      title={`Cancel the invitation to ${email}?`}
      onClose={onKeep}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onKeep} disabled={busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={onCancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel invitation'}</button>
        </>
      }
    >
      <p>The link in their email stops working. You can invite them again any time.</p>
    </KitDialog>
  );
}
