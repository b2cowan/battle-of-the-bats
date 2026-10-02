'use client';
import { useId, useState } from 'react';
import { useAwardTypePicker } from '@/components/coaches/AwardTypePicker';
import SublinedChoice, { type SublinedOption } from '@/components/coaches/SublinedChoice';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { RepTeamAwardType, RepPlayerAward } from '@/lib/types';
import {
  AWARD_FOR_WORDS, awardForSubline, awardNotePlaceholder, nearDuplicateAward, nearDuplicateSentence, type AwardForOption,
} from '@/lib/rep-award-occasion';
import { tournamentToday } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * "Give an award" moment (Coach Tags & Player Awards Phase 2) — opened either from a specific
 * event (eventContext set, no event-picker needed since the coach is already looking at it) or
 * generally from the awards report page (eventContext null — a free-text tournament/occasion,
 * or left blank for a general season recognition). Save closes it (owner, 2026-07-12); a second
 * award for the same event is a re-tap of "Give an award".
 *
 * ⚠ ANY EVENT (owner, 2026-09-25) — a practice, a team event or a whole tournament as well as a
 * game. The caller builds `eventContext.label` with `awardOccasionLabel` (never "vs …" by hand)
 * and passes the event's type, which only picks the note's example text here.
 *
 * ⚠ WHICH GAME (owner, 2026-10-02 — plan COACH_AWARD_OCCASION_PLAN.md). From the Awards page
 * (`eventContext` null, a new award) the window asks what the award is FOR: the season's events that
 * have happened (`forEvents`, built by `awardForOptions`), opening on the newest that can carry an
 * award; "Something else" (the typed occasion plus the day it happened); or "The season". A typed
 * occasion was the only way in before, so last night's game was given as words, dated today, and
 * given again from the game — two MVPs for one game on production (Alex Tennant, 2026-10-01).
 *
 * ⚠ THE DOUBLE-CHECK (ruling 4) speaks from both doors: the same award to the same player within two
 * days says so above Note. It never blocks — the exact same game is still refused by the server.
 *
 * ⚠ EDIT MODE (`editing` set — Awards One Tag Idiom Part A, 2026-09-11): the same form fixes a
 * mis-given award instead of creating a new one. Pre-filled from `editing`, titled "Edit award",
 * PATCHes `editing.id` rather than POSTing. Which EVENT the award is for is NOT editable — a wrong
 * event is remove-and-re-give, same as a tag on the wrong event — so the caller must pass an
 * `eventContext` that matches `editing` itself (or null for a general award). ⚠ R0 (owner
 * ruling): this form carries no delete control of its own — removing an award is the row's own
 * trash icon with its own confirm, one job per control.
 */
/** The "For" answers that are not one event. An event's own answer is its id (a uuid). */
const FOR_ELSE = 'else';
const FOR_SEASON = 'season';
/** The newest events listed first; the rest sit under "Earlier in the season", after the two
 *  answers that are not one event — so those two stay near the top however long the season runs.
 *  ⚠ FOUR, MEASURED: four events, the "Other" band and its two answers fill the list's height
 *  (`.convWhatList`, 21rem) exactly; at six, "Something else" and "The season" opened below the fold. */
const FOR_RECENT = 4;

/**
 * The "For" dropdown's answers, in the shared sub-lined dropdown (`SublinedChoice` — a native
 * <select> can't carry a second line or a greyed row with its reason). ⚠ It FLOATS over the window
 * rather than opening in flow: opening a field must not resize the window (§80 walk, 2026-08-23).
 */
function forChoices(events: readonly AwardForOption[]): SublinedOption<string>[] {
  const event = (o: AwardForOption, group?: string): SublinedOption<string> => ({
    value: o.eventId, name: o.label, sub: awardForSubline(o), group, disabled: o.state !== 'open',
  });
  return [
    ...events.slice(0, FOR_RECENT).map(o => event(o)),
    { value: FOR_ELSE, name: AWARD_FOR_WORDS.somethingElse, sub: AWARD_FOR_WORDS.somethingElseSub, group: AWARD_FOR_WORDS.otherGroup },
    { value: FOR_SEASON, name: AWARD_FOR_WORDS.season, sub: AWARD_FOR_WORDS.seasonSub, group: AWARD_FOR_WORDS.otherGroup },
    ...events.slice(FOR_RECENT).map(o => event(o, AWARD_FOR_WORDS.earlier)),
  ];
}

export default function GiveAwardModal({
  orgSlug,
  teamId,
  players,
  awardTypes,
  eventContext,
  forEvents,
  existingAwards,
  editing,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  players: { id: string; name: string; number: string | null }[];
  awardTypes: RepTeamAwardType[];
  /** `day` (YYYY-MM-DD, org zone) lets the double-check compare against the event's own date. */
  eventContext: { id: string; label: string; eventType?: string | null; day?: string } | null;
  /** The "For" dropdown's events (`awardForOptions`) for a new award with no `eventContext`; null while
   *  they load. Left out, the dropdown offers only "Something else" and "The season". */
  forEvents?: AwardForOption[] | null;
  /** The team's awards, for the near-duplicate line. Left out, the line never shows. */
  existingAwards?: readonly RepPlayerAward[];
  /** Set to edit an already-given award in place instead of giving a new one. */
  editing?: RepPlayerAward | null;
  onClose: () => void;
  // Fired after EITHER a successful save or an inline type-creation — both change what the
  // parent's own awardTypes/awards state should show, so both need to trigger its refetch
  // (a type created here but never followed by a save must not go stale in the parent).
  onChanged: () => void;
}) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/awards`;
  // Parent conditionally mounts this component only while open — one unit for the whole mount.
  useOverlayOpen(true);

  const [playerId, setPlayerId] = useState(editing?.playerId ?? '');
  const [typeId, setTypeId] = useState(editing?.awardTypeId ?? '');
  const [tournamentLabel, setTournamentLabel] = useState(editing?.tournamentLabel ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // "For" — only a NEW award with no event of its own asks. Until the coach picks, it reads the
  // newest event that can carry an award (ruling 2), or "The season" when there is none.
  const asksFor = !eventContext && !editing;
  const forOptions = forEvents === undefined ? [] : forEvents;
  const [forPicked, setForPicked] = useState<string | null>(null);
  const forValue = forPicked
    ?? (forOptions == null ? '' : forOptions.find(o => o.state === 'open')?.eventId ?? FOR_SEASON);
  const forEvent = forOptions?.find(o => o.eventId === forValue) ?? null;
  const choices = forOptions ? forChoices(forOptions) : [];
  const today = tournamentToday();
  const [occasionDay, setOccasionDay] = useState(today);
  const ids = useId();

  // The day this award will carry — what the double-check compares against.
  const awardDay = eventContext?.day
    ?? editing?.awardedAt
    ?? (forEvent ? forEvent.day : forValue === FOR_ELSE ? occasionDay : today);
  const near = playerId && typeId && existingAwards
    ? nearDuplicateAward(existingAwards, { playerId, awardTypeId: typeId, day: awardDay, excludeId: editing?.id })
    : null;
  const nearWords = near
    ? nearDuplicateSentence(players.find(p => p.id === playerId)?.name ?? near.playerName ?? 'This player', near)
    : null;

  // The chips, "+ New" and the library's door — shared with the award's own sheet on a phone
  // (`AwardTypePicker`). `overlays` renders OUTSIDE this window, as the drawer always has.
  const picker = useAwardTypePicker({
    orgSlug, teamId, awardTypes,
    value: typeId,
    onChange: setTypeId,
    keepType: editing?.awardType ?? null,
    onLibraryChanged: onChanged,
  });

  async function handleSave() {
    setError('');
    if (!playerId) { setError('Pick a player.'); return; }
    if (!typeId) { setError('Pick an award.'); return; }
    if (asksFor && !forValue) return;
    if (asksFor && forValue === FOR_ELSE && (!occasionDay || occasionDay > today)) {
      setError(occasionDay ? AWARD_FOR_WORDS.futureDate : 'Pick the day it happened.');
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`${base}/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId,
              awardTypeId: typeId,
              ...(eventContext ? {} : { tournamentLabel: tournamentLabel.trim() || null }),
              note: note.trim() || null,
            }),
          })
        : await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId,
              awardTypeId: typeId,
              ...(eventContext
                ? { eventId: eventContext.id }
                : forEvent
                  ? { eventId: forEvent.eventId }
                  : forValue === FOR_ELSE
                    ? { tournamentLabel: tournamentLabel.trim() || undefined, awardedAt: occasionDay }
                    : {}),
              note: note.trim() || undefined,
            }),
          });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not save award');

      // Save closes the modal (owner preference) — the underlying screen's own award list
      // already updates via onChanged, so that's the confirmation; giving a second award for
      // the same game is just a re-tap of "Give an award", not a reason to keep this one open.
      onChanged();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save award');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title={editing ? 'Edit award' : 'Give an award'} onClose={onClose} />

        <div className={styles.formBody}>
          {eventContext ? (
            <p className={styles.formHint}>For: <strong>{eventContext.label}</strong></p>
          ) : asksFor ? (
            <>
              <div className={styles.formSection}>
                {/* ⚠ The visible heading is this one — SublinedChoice's `label` is the accessible name
                    only. An <h4> like Player, Award and Note: a <label> here set in body type. */}
                <h4 className={styles.formSectionTitle}>For</h4>
                <SublinedChoice
                  id={`${ids}-for`}
                  label="For"
                  options={choices}
                  value={forValue || null}
                  onChange={setForPicked}
                  placeholder={AWARD_FOR_WORDS.loading}
                  disabled={forOptions == null}
                  // An event's day and result say WHICH game; the other two answers' second lines
                  // explain the choice, which the closed field doesn't need to repeat.
                  showClosedSub={forEvent != null}
                />
              </div>
              {forValue === FOR_ELSE && (
                <div className={styles.formSectionGrid}>
                  <div className={styles.formSection}>
                    <h4 className={styles.formSectionTitle} id={`${ids}-occasion`}>Occasion</h4>
                    <input
                      className={styles.input}
                      aria-labelledby={`${ids}-occasion`}
                      value={tournamentLabel}
                      maxLength={80}
                      placeholder={AWARD_FOR_WORDS.occasionPlaceholder}
                      onChange={e => setTournamentLabel(e.target.value)}
                    />
                  </div>
                  <div className={styles.formSection}>
                    <h4 className={styles.formSectionTitle} id={`${ids}-date`}>Date<span aria-hidden> *</span></h4>
                    <input type="date" className={styles.input} aria-labelledby={`${ids}-date`} value={occasionDay} max={today} required onChange={e => setOccasionDay(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Tournament or occasion</h4>
              <input
                className={styles.input}
                value={tournamentLabel}
                maxLength={80}
                placeholder="e.g. Milton Slo-Pitch Classic — leave blank for a general recognition"
                onChange={e => setTournamentLabel(e.target.value)}
              />
            </div>
          )}

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Player<span aria-hidden> *</span></h4>
            <select className={styles.select} value={playerId} onChange={e => setPlayerId(e.target.value)}>
              <option value="">Choose a player…</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Award<span aria-hidden> *</span></h4>
            {picker.chips}
          </div>

          {nearWords && (
            <p className={styles.awardNear} role="status">
              <span className={styles.awardNearIcon} aria-hidden>!</span>
              <span>{nearWords.line}<small>{nearWords.hint}</small></span>
            </p>
          )}

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Note</h4>
            <textarea
              className={styles.textarea}
              value={note}
              maxLength={200}
              placeholder={awardNotePlaceholder(!!(eventContext ?? forEvent), eventContext?.eventType ?? forEvent?.eventType)}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Close</button>
          <button className={styles.btnPrimary} disabled={saving || (asksFor && !forValue)} onClick={handleSave}>{editing ? 'Save changes' : 'Save'}</button>
        </div>
      </div>
    </div>
    {picker.overlays}
    </>
  );
}
