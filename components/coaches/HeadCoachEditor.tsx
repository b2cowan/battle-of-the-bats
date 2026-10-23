'use client';

import { useEffect, useRef, useState } from 'react';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import {
  headCoachEmailSave,
  headCoachNameSave,
  type HeadCoachSave,
} from '@/lib/coach-event-head-coach';
import styles from './HeadCoachEditor.module.css';

/**
 * Head coach for this event — the name and the email the organizer writes to (Club Tier Stage 7d,
 * Ask 10; drawing 7). It AUTOSAVES: the record page renders this form only for someone the one rule
 * lets change it (`canEditEventHeadCoach`); everyone else reads a line instead, and the PATCH route
 * refuses them with the same rule.
 *
 * ⚠ This record routes mail. The name saves on leaving the field or after a pause; the EMAIL saves
 * only on leaving the field (or Enter) — a pause mid-address can already pass the format check
 * ("jo@ex.co" on the way to "jo@ex.com") and would send the organizer's acceptance and payment mail to
 * a half-typed inbox. A blank name is never sent: the field says so and the last saved name stands. A
 * cleared email IS a save — mail reverts to the email the team registered with (`resolveCoachRecipient`).
 * The word is the portal's transient pill ("Saved" fades; only an error persists). Two tabs: the last
 * write wins, as before.
 *
 * A value the route REFUSES (a 400) is said at its field and is not "unsaved changes": it is not sent
 * again until the coach changes it. A network failure is the pill's Retry, and it clears the moment
 * the field it belongs to no longer has anything to send. Saves of one field are ordered by request —
 * a slow earlier answer never overwrites what a later one set.
 *
 * The route keeps every one of its own checks; `teams.email` (the claim key) is never touched.
 */

const NAME_PAUSE_MS = 1200;

type Field = 'name' | 'email';

export default function HeadCoachEditor({
  teamId,
  initialCoach,
  initialCoachEmail,
  registrationEmail,
}: {
  teamId: string;
  initialCoach: string;
  initialCoachEmail: string | null;
  /** The email the team registered with (`teams.email`) — where mail goes while the field is blank. */
  registrationEmail?: string | null;
}) {
  const [name, setName] = useState(initialCoach ?? '');
  const [email, setEmail] = useState(initialCoachEmail ?? '');
  const [saved, setSaved] = useState({ name: initialCoach ?? '', email: initialCoachEmail ?? '' });

  const [fieldError, setFieldError] = useState<Record<Field, string | null>>({ name: null, email: null });
  // The body the route refused for each field — said at the field, never re-sent until the value changes.
  const [refused, setRefused] = useState<Record<Field, { body: string; message: string } | null>>({ name: null, email: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastFailed = useRef<Field | null>(null);
  // Per field: the body on the wire, and the newest request's number (a slow older answer is ignored).
  const inFlight = useRef<Record<Field, string | null>>({ name: null, email: null });
  const requestNo = useRef<Record<Field, number>>({ name: 0, email: 0 });
  const open = useRef(0);

  const planFor = (field: Field): HeadCoachSave => field === 'name'
    ? headCoachNameSave(name, saved.name)
    : headCoachEmailSave(email, saved.email);
  const isSendable = (field: Field) => {
    const plan = planFor(field);
    return plan.kind === 'send' && refused[field]?.body !== JSON.stringify(plan.body);
  };

  // "Unsaved changes" only while a field holds something that WILL be sent — a blank name, a
  // malformed email or a value the route refused is said beside the field, never as a pending save.
  const dirty = isSendable('name') || isSendable('email');

  /** Retry belongs to a failed field; once that field has nothing left to send there is nothing to retry. */
  function clearFailure(field: Field) {
    if (lastFailed.current !== field) return;
    lastFailed.current = null;
    setSaveError(null);
  }

  async function commit(field: Field) {
    const plan = planFor(field);
    if (plan.kind === 'invalid') {
      setFieldError(prev => ({ ...prev, [field]: plan.message }));
      clearFailure(field);
      return;
    }
    if (plan.kind === 'skip') {
      setFieldError(prev => ({ ...prev, [field]: null }));
      clearFailure(field);
      return;
    }
    const sending = JSON.stringify(plan.body);
    // Refused already (its message is said again), or on the wire right now — the pause timer and
    // the blur can both fire for one value before the first answer lands.
    const already = refused[field];
    if (already?.body === sending) {
      setFieldError(prev => ({ ...prev, [field]: already.message }));
      return;
    }
    if (inFlight.current[field] === sending) return;
    setFieldError(prev => ({ ...prev, [field]: null }));
    const mine = ++requestNo.current[field];
    const latest = () => requestNo.current[field] === mine;
    inFlight.current[field] = sending;

    open.current += 1;
    setSaving(true);
    if (lastFailed.current === field) setSaveError(null);
    try {
      const res = await fetch(`/api/coaches/tournaments/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan.body),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 400) {
        // The route's own refusal of THIS value (a FieldLogicHQ staff address, say): said beside the
        // field it is about, not as a retry — sending it again would be refused again.
        if (latest()) {
          const message = body.error ?? 'That could not be saved.';
          setFieldError(prev => ({ ...prev, [field]: message }));
          setRefused(prev => ({ ...prev, [field]: { body: sending, message } }));
          clearFailure(field);
        }
        return;
      }
      if (!res.ok) throw new Error(body.error ?? 'Could not update the head coach.');
      if (latest()) {
        const sent = plan.body;
        setSaved(prev => ('coach' in sent ? { ...prev, name: sent.coach } : { ...prev, email: sent.coachEmail ?? '' }));
        setRefused(prev => ({ ...prev, [field]: null }));
        clearFailure(field);
      }
    } catch (e) {
      if (latest()) {
        lastFailed.current = field;
        setSaveError(e instanceof Error ? e.message : 'Could not update the head coach.');
      }
    } finally {
      if (inFlight.current[field] === sending) inFlight.current[field] = null;
      open.current -= 1;
      setSaving(open.current > 0);
    }
  }

  // The name's pause: a save after the coach stops typing, as well as on leaving the field.
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; });
  // Leaving the page inside the pause (a tap on a link does not always blur a field) still sends the name.
  useEffect(() => () => {
    if (!nameTimer.current) return;
    clearTimeout(nameTimer.current);
    void commitRef.current('name');
  }, []);

  const routedTo = (registrationEmail ?? '').trim();

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Name *</span>
        <input
          className={styles.input}
          type="text"
          value={name}
          maxLength={120}
          autoComplete="name"
          aria-invalid={fieldError.name ? true : undefined}
          onChange={e => {
            setName(e.target.value);
            if (nameTimer.current) clearTimeout(nameTimer.current);
            nameTimer.current = setTimeout(() => { nameTimer.current = null; void commitRef.current('name'); }, NAME_PAUSE_MS);
          }}
          onBlur={() => {
            if (nameTimer.current) clearTimeout(nameTimer.current);
            nameTimer.current = null;
            void commit('name');
          }}
        />
        {fieldError.name && <span className={styles.fieldError} role="alert">{fieldError.name}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Email the organizer uses</span>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          /* The address mail goes to while this is blank — the team's registration email, which is the
             sign-in email of whoever registered it. Falls back to the drawn words when unknown. */
          placeholder={routedTo || 'Your sign-in email'}
          aria-invalid={fieldError.email ? true : undefined}
          onChange={e => { setEmail(e.target.value); setFieldError(prev => ({ ...prev, email: null })); }}
          onBlur={() => { void commit('email'); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commit('email'); } }}
        />
        {fieldError.email
          ? <span className={styles.fieldError} role="alert">{fieldError.email}</span>
          : <span className={styles.hint}>Acceptance, payment and schedule updates go here. Blank uses your sign-in email.</span>}
      </label>

      <SaveStatusPill
        saving={saving}
        dirty={dirty}
        error={saveError}
        onRetry={() => { if (lastFailed.current) void commit(lastFailed.current); }}
      />
    </div>
  );
}
