'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Pencil, Printer, Trash2 } from 'lucide-react';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import { useAwardTypePicker } from '@/components/coaches/AwardTypePicker';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { awardNotePlaceholder, awardTypeLabel, describeAwardOccasion, sameAwardOccasion } from '@/lib/rep-award-occasion';
import type { RepPlayerAward, RepTeamAwardType } from '@/lib/types';
import sheet from './CoachesBottomNav.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './AwardSheet.module.css';

type AwardForm = { playerId: string; typeId: string; label: string; note: string };

/** What a save sends and what "changed" is measured against — stored values (trimmed), so a
 *  trailing space mid-word never leaves the sheet dirty for ever (the player page's lesson). */
function stored(f: AwardForm) {
  return { playerId: f.playerId, typeId: f.typeId, label: f.label.trim(), note: f.note.trim() };
}

/**
 * THE AWARD'S SHEET — one given award, read and edited where it is read (coaching from a phone
 * §14.13; owner rulings 2026-09-25, drawn on the phone hub's "6 · Awards, from the walk" tab, v63).
 * A phone opens it from the award's row in the Awards report's Full history — anywhere on the row,
 * or its chevron. It replaced the row's "⋯" menu (Print · Edit · Remove): the award is the thing a
 * coach opens a row to read, so it is one tap, and the actions sit with it.
 *
 * ⚠ NO TITLE. The facts name the award and the player; a title above them said it twice. The head
 * is two 44px icon buttons, BORDERLESS in both states (the §227 practice-plan and §228 roster
 * rulings): the bin on the left, the pencil on the right — and ✓ takes the pencil's exact spot
 * while editing, so the thumb that tapped ✎ rests on ✓, never on a bin that arrived under it.
 *
 * ⚠⚠ TWO LAYERS, ONE SHEET — the 2026-09-23 drawer-layers ruling, applied by what the sheet IS at
 * the moment, not by what opened it. READING it is a menu (tap Print, the pencil or the bin, it
 * acts): it rises from the bar's top edge in the phone's one sheet system (`.sheetAnchor`, the team
 * switcher's anchor) and the bar stays visible and tappable beneath it. EDITING it is a form: it
 * drops to the screen's foot, above the nav, and `useOverlayOpen` takes the bar out of reach and out
 * of the tab order — covering a nav is not taking it away unless the keyboard is shut out too.
 * ✓ is the way out, beside the scrim and Escape, which both finish the edit first (a held change
 * they close without — below).
 *
 * ⚠ EDITING SAVES AS YOU GO (the 2026-09-24 ruling: editing autosaves, creating asks). ✓ means
 * finished, not save; the transient "Saved" says the rest. A change the product would refuse —
 * the player already holds this award for this occasion (R5) — is HELD: nothing is written, and the
 * server's own sentence sits under the player, built here from the same pure rule the route asks
 * (`sameAwardOccasion` / `describeAwardOccasion`). ✓ with a change held stays in the edit, as the
 * player page's Done does with a cleared first name; the scrim and Escape close without it. What
 * the award was FOR and its date stay fixed, as they always have (a wrong event is
 * remove-and-give-again); a general award's typed occasion is editable, as in the Give window.
 *
 * ⚠ The picker's overlays (the icon chooser, the award-type library) render as SIBLINGS of the
 * panel, never inside it: `useDialogFloor` answers every key whose target is inside its panel, so a
 * nested drawer's Escape would close this sheet too.
 *
 * ⚠ Rendered in-tree, never through a portal: the warm skin is a wrapper above the providers.
 */
export default function AwardSheet({
  orgSlug,
  teamId,
  award,
  awards,
  awardTypes,
  players,
  certificateHref,
  dateText,
  onClose,
  onSaved,
  onLibraryChanged,
  onRemove,
}: {
  orgSlug: string;
  teamId: string;
  award: RepPlayerAward;
  /** The season's awards — the once-per-occasion check reads them before a save is sent. */
  awards: RepPlayerAward[];
  awardTypes: RepTeamAwardType[];
  players: { id: string; name: string; number: string | null }[];
  certificateHref: string;
  /** "Apr 28" — the date as the history row prints it. */
  dateText: string;
  onClose: () => void;
  /** A save landed — the report re-reads its list quietly (no "Loading report…" behind the sheet). */
  onSaved: () => void;
  onLibraryChanged: () => void;
  /** The host asks "Remove …?" and deletes: 'removed', 'kept' (the coach said no), or the sentence
   *  of a failure — shown HERE, because the page's own error line sits behind the sheet. */
  onRemove: (award: RepPlayerAward) => Promise<'removed' | 'kept' | string>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const initial: AwardForm = {
    playerId: award.playerId,
    typeId: award.awardTypeId,
    label: award.tournamentLabel ?? '',
    note: award.note ?? '',
  };
  const [form, setForm] = useState<AwardForm>(initial);
  // The record as last WRITTEN — what the sheet reads back once editing ends. A save updates this
  // and never the form, so a keystroke typed while a save is in flight is never thrown away.
  const [saved, setSaved] = useState<AwardForm>(initial);

  const typeOf = (id: string) => awardTypes.find(t => t.id === id) ?? (id === award.awardTypeId ? award.awardType : undefined);
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? (id === award.playerId ? award.playerName : undefined) ?? 'That player';

  // R5 — held, not sent: the same rule and the same sentence the route would answer with.
  const occasion = {
    eventId: award.eventId,
    tournamentLabel: award.eventId ? award.tournamentLabel : (form.label.trim() || null),
    awardedAt: award.awardedAt,
  };
  const clash = awards.some(o => o.id !== award.id && o.playerId === form.playerId
    && o.awardTypeId === form.typeId && sameAwardOccasion(o, occasion));
  const blocked = clash
    ? `${nameOf(form.playerId)} already has ${typeOf(form.typeId)?.name ?? 'that award'} ${describeAwardOccasion(occasion, award.eventType)}.`
    : null;

  // ⚠ Sends only what CHANGED since the last write (/review, 2026-09-25). Sending the whole form
  // re-asserted fields the coach never touched, and each one could fail on its own: an award type
  // merged away in the library drawer while the sheet was open, or a player who has since left the
  // roster, refused a save that only fixed the note.
  const write = useCallback(async (signal: AbortSignal) => {
    const f = stored(form);
    const patch = {
      ...(f.playerId !== saved.playerId ? { playerId: f.playerId } : {}),
      ...(f.typeId !== saved.typeId ? { awardTypeId: f.typeId } : {}),
      ...(!award.eventId && f.label !== saved.label ? { tournamentLabel: f.label || null } : {}),
      ...(f.note !== saved.note ? { note: f.note || null } : {}),
    };
    if (Object.keys(patch).length === 0) return; // typed and put back — nothing to write
    const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards/${award.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(patch),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? 'Could not save this award.');
    setSaved({ ...f });
    onSaved();
  }, [orgSlug, teamId, award.id, award.eventId, onSaved, form, saved]);

  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    // Paused while the award is being removed — a save landing on a deleted award is a 404.
    enabled: !removing,
    loading: false,
    sig: JSON.stringify(stored(form)),
    blocked,
    write,
    failText: 'Could not save this award.',
  });
  const edit = (patch: Partial<AwardForm>) => { setForm(f => ({ ...f, ...patch })); touch(); };

  const picker = useAwardTypePicker({
    orgSlug, teamId, awardTypes,
    value: form.typeId,
    onChange: typeId => edit({ typeId }),
    keepType: award.awardType ?? null,
    onLibraryChanged,
  });

  // A form covers the nav; a menu sits on top of it — only while editing does the bar go.
  useOverlayOpen(editing);

  /** ✓ — save what is pending, then read. A held change keeps the coach in the edit (the line
   *  under the player says why); a ✓ pressed while a save is in flight waits for it. */
  const [finishPending, setFinishPending] = useState<null | 'read' | 'close'>(null);
  // A second ✓ tapped before the first one's save has re-rendered `saving` would send the same
  // PATCH twice — the ref closes that gap in the same tick (/review, 2026-09-25).
  const finishingRef = useRef(false);
  const finish = useCallback(async (then: 'read' | 'close') => {
    if (blocked || finishingRef.current) return;
    if (saving) { setFinishPending(then); return; }
    finishingRef.current = true;
    try {
      if (dirty && !(await handleSave())) return;
      if (then === 'close') onClose(); else setEditing(false);
    } finally {
      finishingRef.current = false;
    }
  }, [blocked, saving, dirty, handleSave, onClose]);
  useEffect(() => {
    if (!finishPending || saving) return;
    const then = finishPending;
    void Promise.resolve().then(() => { setFinishPending(null); void finish(then); });
  }, [finishPending, saving, finish]);

  // ⚠ The scrim and Escape LEAVE, always. With a change held they close without it — nothing held
  // was ever written, and the product would refuse it anyway. Only ✓ stays in the edit to say why;
  // when the scrim and Escape stayed too, a held change trapped the coach in the sheet with no way
  // out but undoing it (/review, 2026-09-25).
  const requestClose = useCallback(() => {
    if (removing) return;
    if (editing && !blocked) void finish('close'); else onClose();
  }, [removing, editing, blocked, finish, onClose]);
  useDialogFloor(true, panelRef, { onClose: requestClose, busy: removing });

  async function remove() {
    setRemoving(true);
    setRemoveError('');
    try {
      const outcome = await onRemove(award);
      if (outcome === 'removed') onClose();
      else if (outcome !== 'kept') setRemoveError(outcome);
    } finally {
      setRemoving(false);
    }
  }

  const readType = typeOf(saved.typeId);
  const readPlayer = nameOf(saved.playerId);
  const forText = award.eventId ? (award.occasionLabel ?? 'This event') : (saved.label || 'General');
  const notePlaceholder = awardNotePlaceholder(!!award.eventId, award.eventType);

  return (
    <>
      <div
        className={`${sheet.sheetAnchor} ${editing ? own.anchorForm : ''}`}
        data-award-sheet={editing ? 'editing' : 'reading'}
      >
        <div className={sheet.sheetScrim} aria-hidden onClick={requestClose} />
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`${sheet.dropdown} ${own.panel} ${editing ? own.panelForm : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${readPlayer} · ${readType?.name ?? 'Award'}`}
        >
          <span className={sheet.sheetGrab} aria-hidden />
          <div className={own.head}>
            <button
              type="button"
              className={shared.ppIconBtn}
              aria-label={`Remove ${readPlayer}’s ${readType?.name ?? 'award'}`}
              disabled={removing || saving}
              onClick={() => { void remove(); }}
            >
              <Trash2 size={18} aria-hidden />
            </button>
            {/* ONE button whose glyph flips, so focus stays on it (the practice plan's toggle). */}
            <button
              type="button"
              className={shared.ppIconBtn}
              aria-label={editing ? 'Done editing' : 'Edit this award'}
              disabled={removing}
              onClick={() => { if (editing) void finish('read'); else setEditing(true); }}
            >
              {editing ? <Check size={18} aria-hidden /> : <Pencil size={18} aria-hidden />}
            </button>
          </div>
          {removeError && <p className={`${shared.errorText} ${own.held}`} role="alert">{removeError}</p>}

          {editing ? (
            <dl className={`${own.facts} ${own.factsEditing}`}>
              <dt>Award</dt>
              <dd>{picker.chips}</dd>
              <dt><label htmlFor={`${formId}-player`}>Player</label></dt>
              <dd>
                <select
                  id={`${formId}-player`}
                  className={shared.select}
                  value={form.playerId}
                  aria-describedby={blocked ? `${formId}-held` : undefined}
                  onChange={e => edit({ playerId: e.target.value })}
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</option>
                  ))}
                  {/* The award's own player stays pickable after leaving the roster — the route keeps
                      them the same way; without it the select showed someone else's name. */}
                  {!players.some(p => p.id === award.playerId) && (
                    <option value={award.playerId}>{award.playerName ?? 'Former player'} (not on the roster)</option>
                  )}
                </select>
                {blocked && <p id={`${formId}-held`} className={`${shared.errorText} ${own.held}`} role="alert">{blocked}</p>}
              </dd>
              <dt>{award.eventId ? 'For' : <label htmlFor={`${formId}-for`}>For</label>}</dt>
              <dd>
                {award.eventId ? <span className={own.fixed}>{forText}</span> : (
                  <input
                    id={`${formId}-for`}
                    className={shared.input}
                    value={form.label}
                    maxLength={80}
                    placeholder="e.g. Milton Slo-Pitch Classic — leave blank for a general recognition"
                    onChange={e => edit({ label: e.target.value })}
                  />
                )}
              </dd>
              <dt>Date</dt>
              <dd><span className={own.fixed}>{dateText}</span></dd>
              <dt><label htmlFor={`${formId}-note`}>Note</label></dt>
              <dd>
                <textarea
                  id={`${formId}-note`}
                  className={`${shared.textarea} ${own.noteBox}`}
                  value={form.note}
                  maxLength={200}
                  rows={2}
                  placeholder={notePlaceholder}
                  onChange={e => edit({ note: e.target.value })}
                />
              </dd>
            </dl>
          ) : (
            <>
              <dl className={own.facts}>
                <dt>Award</dt>
                <dd>{awardTypeLabel(readType)}</dd>
                <dt>Player</dt>
                <dd>{readPlayer}</dd>
                <dt>For</dt>
                <dd>{forText}</dd>
                <dt>Date</dt>
                <dd>{dateText}</dd>
                <dt>Note</dt>
                <dd>{saved.note ? <span className={own.note}>“{saved.note}”</span> : <span className={own.none}>No note</span>}</dd>
              </dl>
              <Link href={certificateHref} className={own.printRow}>
                <Printer size={16} aria-hidden /> Print certificate
              </Link>
            </>
          )}
          {/* The transient "Saved" — INSIDE the panel, so it paints above the sheet it reports on and
              its Retry stays inside the floor's Tab trap; while editing it sits in the corner the
              panel's foot leaves it (`.panelForm` here, the `[data-award-sheet]` rule beside
              `.savePill`). */}
          <SaveStatusPill saving={saving} dirty={dirty} error={saveError} onRetry={handleSave} />
        </div>
      </div>
      {picker.overlays}
    </>
  );
}
