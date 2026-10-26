'use client';

import { useRef, useState } from 'react';
import DateInput from '@/components/shared/DateInput';
import { arrayMove } from '@dnd-kit/sortable';
import { ChevronRight, Trash2, Plus, X, Check, ShieldCheck, Users } from 'lucide-react';
import type { BasicCoachTeamPlayer } from '@/lib/basic-coach-roster';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import CoachEmptyState from './CoachEmptyState';
import FeedbackModal from '@/components/FeedbackModal';
import editorRow from './EditorRow.module.css';
import styles from './RosterEditor.module.css';
import PhoneInput from '@/components/shared/PhoneInput';

type Props = {
  basicTeamId: string;
  initialPlayers: BasicCoachTeamPlayer[];
};

type PlayerInput = {
  firstName: string;
  lastName: string | null;
  jerseyNumber: string | null;
  dateOfBirth: string | null;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
};

function ageFromDob(dob: string): number | null {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export default function RosterEditor({ basicTeamId, initialPlayers }: Props) {
  const [players, setPlayers] = useState<BasicCoachTeamPlayer[]>(initialPlayers);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPlayer, setConfirmPlayer] = useState<BasicCoachTeamPlayer | null>(null);
  const reorderSeq = useRef(0);

  const base = `/api/coaches/teams/${basicTeamId}/roster`;

  async function addPlayer(input: PlayerInput) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not add the player.');
      setPlayers(prev => [...prev, data.player as BasicCoachTeamPlayer]);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the player.');
    } finally {
      setBusy(false);
    }
  }

  async function savePlayer(playerId: string, input: PlayerInput) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the player.');
      setPlayers(prev => prev.map(p => (p.id === playerId ? (data.player as BasicCoachTeamPlayer) : p)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the player.');
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(playerId: string) {
    setBusy(true);
    setError(null);
    const prev = players;
    setPlayers(curr => curr.filter(p => p.id !== playerId)); // optimistic
    try {
      const res = await fetch(`${base}/${playerId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not remove the player.');
      }
      if (editingId === playerId) setEditingId(null);
    } catch (e) {
      setPlayers(prev); // revert
      setError(e instanceof Error ? e.message : 'Could not remove the player.');
    } finally {
      setBusy(false);
    }
  }

  // One write for both halves of the reorder standard — a drag and the handle menu's Move up / Move down
  // (ReorderList checks the move and closes its menu on it: one move per open). Each save carries the
  // whole order, so only the LATEST may put the list back if it fails — an earlier failure would undo a
  // later move — and putting it back restores the order only, never a player saved in between.
  async function moveTo(oldIndex: number, newIndex: number) {
    const seq = ++reorderSeq.current;
    const prevIds = players.map(p => p.id);
    const next = arrayMove(players, oldIndex, newIndex);
    setPlayers(next); // optimistic
    setError(null);
    try {
      const res = await fetch(`${base}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map(p => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save the new order.');
      }
    } catch (e) {
      if (seq !== reorderSeq.current) return; // a later move already sent the order the list shows
      const place = new Map(prevIds.map((id, i) => [id, i]));
      setPlayers(curr => [...curr].sort((a, b) => (place.get(a.id) ?? Infinity) - (place.get(b.id) ?? Infinity)));
      setError(e instanceof Error ? e.message : 'Could not save the new order.');
    }
  }

  const locked = adding || editingId !== null;

  return (
    <div className={styles.editor}>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {players.length === 0 && !adding ? (
        <CoachEmptyState
          icon={<Users size={22} aria-hidden />}
          eyebrow="Roster"
          headline="Build your roster"
          description="Add your players once and reuse this roster for every tournament you join."
          primaryAction={{
            label: 'Add player',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => { setEditingId(null); setAdding(true); },
          }}
        />
      ) : (
        // The portal's reorder standard, one part (the 2026-10-12 ruling, Q2): the handle is the player's
        // number — hold to drag, tap for Move up · Move down · Cancel — 44px at touch widths.
        <ReorderList ids={players.map(p => p.id)} names={players.map(p => p.name)} onMove={moveTo} disabled={locked}>
          <ul className={styles.list}>
            {players.map(player =>
              editingId === player.id ? (
                <li key={player.id} className={styles.formRow}>
                  <PlayerForm
                    player={player}
                    busy={busy}
                    onCancel={() => setEditingId(null)}
                    onSubmit={input => savePlayer(player.id, input)}
                    onRemove={() => setConfirmPlayer(player)}
                  />
                </li>
              ) : (
                <PlayerRow
                  key={player.id}
                  player={player}
                  locked={locked}
                  onEdit={() => { setAdding(false); setEditingId(player.id); }}
                />
              ),
            )}
          </ul>
        </ReorderList>
      )}

      {adding ? (
        <div className={styles.formRow}>
          <PlayerForm busy={busy} onCancel={() => setAdding(false)} onSubmit={addPlayer} />
        </div>
      ) : players.length > 0 ? (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => { setEditingId(null); setAdding(true); }}
          disabled={editingId !== null}
        >
          <Plus size={15} aria-hidden /> Add player
        </button>
      ) : null}

      <FeedbackModal
        isOpen={confirmPlayer !== null}
        onClose={() => setConfirmPlayer(null)}
        onConfirm={() => { if (confirmPlayer) removePlayer(confirmPlayer.id); }}
        title="Remove this player?"
        message={confirmPlayer
          ? `${confirmPlayer.name} will be removed from your roster. This can't be undone.`
          : ''}
        confirmText="Remove player"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

/**
 * A PLAYER ROW IS ONE DOOR (Free coach tap targets Q1 = C, owner 2026-10-19). The row's body is a real
 * button, named for the player, that opens the in-place form the pencil used to; Remove lives at the end
 * of that form's body. Before the door, the reorder handle is the player's jersey number (the 2026-10-12
 * reorder ruling, Q2): the portal's one handle part, 44px at touch widths. A one-player roster has nothing
 * to move past, so it shows the plain number instead.
 */
function PlayerRow({
  player,
  locked,
  onEdit,
}: {
  player: BasicCoachTeamPlayer;
  locked: boolean;
  onEdit: () => void;
}) {
  const age = player.dateOfBirth ? ageFromDob(player.dateOfBirth) : null;
  const meta: string[] = [];
  if (age !== null) meta.push(`Age ${age}`);
  if (player.guardianName || player.contactEmail || player.contactPhone) meta.push('Contact on file');
  const jersey = player.jerseyNumber || '—';

  return (
    <ReorderRow id={player.id} number label={jersey}>
      {({ handle, itemRef, itemStyle }) => (
        <li ref={itemRef} style={itemStyle} className={`${styles.row} ${styles.doorRow}`}>
          {handle ?? <span className={styles.jersey}>{jersey}</span>}
          <button
            type="button"
            className={`${editorRow.rowDoor} ${styles.rowDoor}`}
            onClick={onEdit}
            disabled={locked}
          >
            {/* The row's own words are the door's name (a label would hide them from a screen reader);
                the number lives in the handle, which reads its place, so the door says it too. */}
            <span className="sr-only">Edit {player.jerseyNumber ? `#${player.jerseyNumber} ` : ''}</span>
            <span className={styles.rowMain}>
              <span className={styles.name}>{player.name}</span>
              {meta.length > 0 && <span className={styles.meta}>{meta.join(' · ')}</span>}
            </span>
            <ChevronRight size={16} className={editorRow.rowChevron} aria-hidden />
          </button>
        </li>
      )}
    </ReorderRow>
  );
}

type FormState = {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  dateOfBirth: string;
  dobConsent: boolean;
  guardianFirstName: string;
  guardianLastName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

function PlayerForm({
  player,
  busy,
  onSubmit,
  onCancel,
  onRemove,
}: {
  player?: BasicCoachTeamPlayer;
  busy: boolean;
  onSubmit: (input: PlayerInput) => void;
  onCancel: () => void;
  /** An existing player's way off the roster — it ends the form's body, above Cancel · Save. */
  onRemove?: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    firstName: player?.firstName ?? '',
    lastName: player?.lastName ?? '',
    jerseyNumber: player?.jerseyNumber ?? '',
    dateOfBirth: player?.dateOfBirth ?? '',
    // Consent is required afresh whenever a DOB is ADDED or CHANGED (see dobConsentRequired
    // below). An unchanged previously-saved DOB is exempt, so this starts unticked.
    dobConsent: false,
    guardianFirstName: player?.guardianFirstName ?? '',
    guardianLastName: player?.guardianLastName ?? '',
    contactEmail: player?.contactEmail ?? '',
    contactPhone: player?.contactPhone ?? '',
    notes: player?.notes ?? '',
  });
  // Sensitive / optional panels stay closed by default (data-minimization) — open them
  // automatically when editing a player that already has that data.
  const [showDob, setShowDob] = useState(!!player?.dateOfBirth);
  const [showContact, setShowContact] = useState(
    !!(player?.guardianFirstName || player?.guardianLastName || player?.contactEmail || player?.contactPhone || player?.notes),
  );

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const originalDob = player?.dateOfBirth ?? '';
  const dobValue = form.dateOfBirth.trim();
  // Storing a NEW or CHANGED minor DOB requires a fresh guardian-consent acknowledgment; an
  // existing DOB left unchanged on edit does not re-prompt (it was acknowledged when first added).
  const dobConsentRequired = dobValue.length > 0 && dobValue !== originalDob;
  const nameValid = form.firstName.trim().length > 0;
  const dobNeedsConsent = dobConsentRequired && !form.dobConsent;
  // A contact email is optional, but if one is typed it must be a valid format —
  // mirrors the server guard so a malformed address can't be saved and silently
  // fail to receive announcements.
  const emailValue = form.contactEmail.trim();
  const emailInvalid = emailValue.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const canSave = nameValid && !dobNeedsConsent && !emailInvalid && !busy;

  function submit() {
    if (!canSave) return;
    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || null,
      jerseyNumber: form.jerseyNumber.trim() || null,
      dateOfBirth: form.dateOfBirth.trim() || null,
      guardianFirstName: form.guardianFirstName.trim() || null,
      guardianLastName: form.guardianLastName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <div className={styles.form}>
      <div className={styles.formTopRow}>
        <input
          className={styles.numInput}
          placeholder="#"
          inputMode="numeric"
          maxLength={4}
          value={form.jerseyNumber}
          onChange={e => set({ jerseyNumber: e.target.value })}
          aria-label="Jersey number"
        />
        <input
          className={styles.nameInput}
          placeholder="First name"
          maxLength={80}
          autoFocus
          value={form.firstName}
          onChange={e => set({ firstName: e.target.value })}
          aria-label="First name"
        />
        <input
          className={styles.nameInput}
          placeholder="Last name (optional)"
          maxLength={80}
          value={form.lastName}
          onChange={e => set({ lastName: e.target.value })}
          aria-label="Last name"
        />
      </div>

      {/* Date of birth — optional, purpose-driven, consent-gated minor PII. */}
      {showDob ? (
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Date of birth</p>
          <p className={styles.panelNote}>
            Optional. Some tournaments need player ages for division eligibility — only add a date of
            birth if you need it.
          </p>
          <DateInput
            className={styles.input}
            value={form.dateOfBirth}
            onChange={v => set({ dateOfBirth: v })}
            aria-label="Date of birth"
          />
          {dobConsentRequired && (
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={form.dobConsent}
                onChange={e => set({ dobConsent: e.target.checked })}
              />
              <span>
                <ShieldCheck size={13} aria-hidden /> I confirm I have the parent/guardian&apos;s consent
                to store this player&apos;s date of birth.
              </span>
            </label>
          )}
          <button
            type="button"
            className={styles.panelToggle}
            onClick={() => { set({ dateOfBirth: '', dobConsent: false }); setShowDob(false); }}
          >
            Remove date of birth
          </button>
        </div>
      ) : (
        <button type="button" className={styles.panelToggle} onClick={() => setShowDob(true)}>
          <Plus size={13} aria-hidden /> Add date of birth (optional)
        </button>
      )}

      {/* Parent/guardian contact + note — optional. */}
      {showContact ? (
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Parent / guardian contact</p>
          <p className={styles.panelNote}>
            Optional. Used later to message parents about your team — never shared publicly.
          </p>
          <input
            className={styles.input}
            placeholder="Parent / guardian first name"
            maxLength={80}
            value={form.guardianFirstName}
            onChange={e => set({ guardianFirstName: e.target.value })}
            aria-label="Parent or guardian first name"
          />
          <input
            className={styles.input}
            placeholder="Parent / guardian last name (optional)"
            maxLength={80}
            value={form.guardianLastName}
            onChange={e => set({ guardianLastName: e.target.value })}
            aria-label="Parent or guardian last name"
          />
          <input
            className={styles.input}
            type="email"
            placeholder="Contact email"
            maxLength={160}
            value={form.contactEmail}
            onChange={e => set({ contactEmail: e.target.value })}
            aria-label="Contact email"
            aria-invalid={emailInvalid || undefined}
          />
          {emailInvalid && (
            <p className={styles.error} role="alert">
              Enter a valid email (e.g. name@example.com), or leave it blank.
            </p>
          )}
          <PhoneInput
            className={styles.input}
            placeholder="Contact phone"
            maxLength={40}
            value={form.contactPhone}
            onChange={v => set({ contactPhone: v })}
            aria-label="Contact phone"
          />
          <textarea
            className={styles.textarea}
            placeholder="Note (optional)"
            maxLength={500}
            rows={2}
            value={form.notes}
            onChange={e => set({ notes: e.target.value })}
            aria-label="Note"
          />
        </div>
      ) : (
        <button type="button" className={styles.panelToggle} onClick={() => setShowContact(true)}>
          <Plus size={13} aria-hidden /> Add parent contact / note (optional)
        </button>
      )}

      {onRemove && (
        <button type="button" className={editorRow.recordLink} onClick={onRemove} disabled={busy}>
          <Trash2 size={13} aria-hidden /> Remove player
        </button>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>
          <X size={14} aria-hidden /> Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={submit} disabled={!canSave}>
          <Check size={14} aria-hidden /> {busy ? 'Saving…' : player ? 'Save' : 'Add player'}
        </button>
      </div>
    </div>
  );
}
