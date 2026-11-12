'use client';
/**
 * KEEP APART FROM A FRIEND… (Board Ready Stage 1 Part 3; drawing tab 5). From a player's ⋯ on the board: it asks which
 * friend, then the draft and Draft again treat that request as split, and it reads "Not honoured · Kept apart by
 * {name}". "Keep together with {friend} again" (the ⋯ too) undoes it. A split is a decision about the draft, so it lives
 * on the board, not in the queue. A decline takes an outlined button: no lime. The family is not told.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError } from '../../money/MoneyKit';
import { TEAMS_WORDS } from '@/lib/house-league-teams-screen-words';
import css from './Teams.module.css';

const W = TEAMS_WORDS.apart;

export default function KeepApartWindow({ first, friends, onClose, onSave }: {
  /** The player's first name, for the title. */
  first: string;
  /** The confirmed friends still kept with them: each by id, with the name and the team the board shows. */
  friends: readonly { id: string; name: string; where: string }[];
  onClose: () => void;
  onSave: (friendId: string) => Promise<string | null>;
}) {
  const [pick, setPick] = useState<string | null>(friends.length === 1 ? friends[0].id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (busy) return;
    if (!pick) { setError(W.pick); return; }
    setBusy(true); setError('');
    const refused = await onSave(pick);
    setBusy(false);
    if (refused) setError(refused);
  }

  return (
    <KitDialog
      kind="question"
      title={W.title(first)}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void save()}>{busy ? W.working : W.go}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <fieldset className={css.apartChoices}>
        <legend className={css.srOnly}>{W.title(first)}</legend>
        {friends.map(f => (
          <label key={f.id} className={css.apartChoice}>
            <input type="radio" name="keep-apart" checked={pick === f.id} onChange={() => { setPick(f.id); setError(''); }} />
            <span><b>{f.name}</b> · {f.where}</span>
          </label>
        ))}
      </fieldset>
      <p className={ck.hint}>{W.body}</p>
    </KitDialog>
  );
}
