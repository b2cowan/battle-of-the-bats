'use client';
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import { playerDisplayName } from '@/lib/coach-roster-name';
import s from './CallUpSheet.module.css';

/**
 * "CALL UP A PLAYER" — the contents of the lineup builder's one call-up control (mig 309; owner
 * rulings R1–R6, 2026-09-22; plan `COACH_CALL_UPS_PLAN.md` §4.1).
 *
 * ⚠⚠ **THIS IS WHERE THE SAVED LIST LIVES, AND THAT IS THE WHOLE DESIGN.** The builder shows no
 * call-ups at rest, however many a team has saved. The owner's ruling, in their words:
 *
 *   > "if we have 3 call ups in our system, default the lineup builder does not show me any but
 *   >  shows me the add call up button, I can add an existing call up or create a new one"
 *
 * An earlier drawing put the pool inline under the lineup and was rejected — a list on the page
 * grows all season and re-creates the clutter this feature was asked for to remove. Behind a button
 * it can hold eight names and cost the builder nothing.
 *
 * ⚠ **CONTENT ONLY — the shell is the builder's own.** The caller wraps this in `.lineupAutoMenu`,
 * the same recipe the auto-fill, Templates and Print panels use, so on a phone it is already the
 * portal's drawer (flush to the bar, grab line, scrim, `--coach-foot-clear`) with no second copy of
 * those rules to drift. A private shell here would have been a fifth panel that looked like the
 * other four until one of them changed.
 *
 * Three things it gets right that are easy to get wrong:
 *  · **An empty pool skips the list entirely.** A coach calling someone up for the first time meets
 *    the form, not an empty list with a button under it.
 *  · **Someone already on this game shows a TICK, not an Add, and is not hidden.** Hiding them makes
 *    the sheet look like it lost a name; the question at that moment is "did I already do this?".
 *  · **The form is thin on purpose** — a first name, and optionally a last name, a number and a
 *    phone. No dues, no guardian email (R6: the database refuses one on a call-up row, so a call-up
 *    cannot enter a family email audience even if some future audience query forgets to filter),
 *    no position ranking. A call-up is a name, a number, and the games they played.
 */

export interface CallUpPoolRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  playerNumber: string | null;
  gamesCalledUp: number;
}

/**
 * ⚠ The shared name, not a local rule. `CallUpPoolRow` is structurally a `NamedRosterPlayer`, so
 * this typechecks unchanged — and the hand-rolled version dropped `cleanNamePart`, so a seeded or
 * imported literal "null" surname printed here and nowhere else in the portal.
 */
const poolName = (p: CallUpPoolRow): string => playerDisplayName(p);

export default function CallUpSheet({
  pool, linkedIds, loading, saving, error, onPick, onCreate, onClose,
}: {
  pool: CallUpPoolRow[];
  linkedIds: string[];
  /**
   * The saved list is being fetched — the sheet has just opened.
   *
   * ⚠ SEPARATE FROM `saving`, and they were one flag until the owner caught it: the submit button
   * read "Adding…" for the first second every time the sheet opened, before anyone had typed
   * anything. A control must never describe an action the user has not started.
   */
  loading: boolean;
  /** A call-up is being added right now — this one IS the user's action. */
  saving: boolean;
  error: string;
  onPick: (playerId: string) => void;
  onCreate: (fields: { playerFirstName: string; playerLastName: string; playerNumber: string; guardianPhone: string }) => void;
  onClose: () => void;
}) {
  const linked = new Set(linkedIds);
  const available = pool.filter(p => !linked.has(p.playerId));
  const alreadyOn = pool.filter(p => linked.has(p.playerId));
  /**
   * Which half is showing — the saved list, or the new-call-up form.
   *
   * ⚠ DERIVED FROM THE POOL EVERY RENDER, never seeded from it. `useState(pool.length === 0)` reads
   * the EMPTY array the sheet mounts with (the pool arrives a moment later) and keeps that answer
   * forever, so a team with three saved call-ups still opened straight to a blank form and the whole
   * point of the sheet was unreachable. The flag only ever records the coach pressing "Someone new";
   * an empty pool shows the form on its own.
   */
  const [creating, setCreating] = useState(false);
  const showForm = creating || pool.length === 0;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showForm && !loading) firstRef.current?.focus(); }, [showForm, loading]);

  const canSubmit = firstName.trim().length > 0 && !saving;

  return (
    <div className={s.body}>
      <div className={s.head}>
        <h3 className={coach.lineupSheetTitle}>Call up a player</h3>
        <button type="button" className={coach.modalCloseBtn} onClick={onClose} aria-label="Close">&times;</button>
      </div>

      {error && <p className={coach.errorText} role="alert">{error}</p>}

      {loading && <p className={s.loading}>Loading your call-ups…</p>}

      {!loading && !showForm && (<>
        {available.length > 0 && (<>
          <p className={coach.label}>Called up before</p>
          <ul className={s.list}>
            {available.map(p => (
              <li key={p.playerId}>
                <button type="button" className={s.row} disabled={loading || saving} onClick={() => onPick(p.playerId)}>
                  <span className={s.rowName}>
                    {poolName(p)}
                    <small>
                      {p.gamesCalledUp === 0
                        ? 'No games yet'
                        : `${p.gamesCalledUp} game${p.gamesCalledUp === 1 ? '' : 's'} this season`}
                    </small>
                  </span>
                  <span className={s.rowAdd}>Add</span>
                </button>
              </li>
            ))}
          </ul>
        </>)}

        {/* Already on this game — shown, not hidden, so the sheet never looks like it lost a name. */}
        {alreadyOn.length > 0 && (<>
          <p className={coach.label}>Already on this game</p>
          <ul className={s.list}>
            {alreadyOn.map(p => (
              <li key={p.playerId}>
                <div className={`${s.row} ${s.rowDone}`}>
                  <span className={s.rowName}>{poolName(p)}</span>
                  <Check size={16} aria-label="Already called up to this game" />
                </div>
              </li>
            ))}
          </ul>
        </>)}

        <button type="button" className={s.newBtn} onClick={() => setCreating(true)} disabled={loading || saving}>
          <span>+&nbsp; Someone new</span><span aria-hidden>&rsaquo;</span>
        </button>
      </>)}

      {!loading && showForm && (
        <form
          className={s.form}
          onSubmit={e => {
            e.preventDefault();
            if (!canSubmit) return;
            onCreate({
              playerFirstName: firstName.trim(),
              playerLastName: lastName.trim(),
              playerNumber: number.trim(),
              guardianPhone: phone.trim(),
            });
          }}
        >
          <div className={coach.formGrid}>
            <label className={coach.field}>
              {/* A plain asterisk in the label's own ink — the portal's required marker since the
                  2026-08-25 ruling retired the red one. */}
              <span className={coach.label}>First name *</span>
              <input ref={firstRef} className={coach.input} value={firstName}
                onChange={e => setFirstName(e.target.value)} required maxLength={60} />
            </label>
            <label className={coach.field}>
              <span className={coach.label}>Last name</span>
              <input className={coach.input} value={lastName}
                onChange={e => setLastName(e.target.value)} maxLength={60} />
            </label>
          </div>
          <div className={coach.formGrid}>
            <label className={coach.field}>
              <span className={coach.label}>Number</span>
              <input className={coach.input} value={number} inputMode="numeric"
                onChange={e => setNumber(e.target.value)} maxLength={4} />
            </label>
            <label className={coach.field}>
              <span className={coach.label}>Contact phone</span>
              <input className={coach.input} value={phone} type="tel"
                onChange={e => setPhone(e.target.value)} maxLength={30} />
            </label>
          </div>
          {/* R6, said out loud rather than left to be discovered. */}
          <p className={s.note}>
            A call-up plays this game only. They are never added to your roster, your dues, skills
            &amp; goals or your team emails.
          </p>
          <div className={coach.lineupSheetFoot}>
            {pool.length > 0 && (
              <button type="button" className={coach.btnSecondary} onClick={() => setCreating(false)} disabled={saving}>
                Back
              </button>
            )}
            <button type="submit" className={coach.btnPrimary} disabled={!canSubmit}>
              {saving ? 'Adding…' : 'Call up'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
