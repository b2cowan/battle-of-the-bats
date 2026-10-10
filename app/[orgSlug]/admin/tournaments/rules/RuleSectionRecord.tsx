'use client';
/**
 * A RULE SECTION, AS A RECORD — Tournament admin redesign Stage 5 (E6, A50 record A; hub v45, ruled as drawn
 * 2026-10-10). The kit's record window: full screen with ← on a phone, a window at a desk.
 *
 *   reads first   as families read it: where it applies, then its points in order
 *   the pencil    the section whole — title, icon, where it applies, its points (add one, take one out, drag one at a
 *                 desk) — saving as you go with the floating pill; ✓ returns to reading. Nothing is ever unsaved to
 *                 protect, so the per-section Save, the one-dirty-section lock, the patched browser Back and the
 *                 three-way leave dialog all retired (A50).
 *   Delete        ends the body and asks in the product's window (the old eight alert() failures are the pill's).
 *   creating      the same window, asking: Add a section's Save.
 */
import { useCallback, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordDelete, SavePill } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CheckChoice, RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { SortableRow, SortableRows, moved } from '@/components/admin/tournament/OrderParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { createRuleSection, deleteRuleSection, saveRuleSectionWhole } from '@/lib/db';
import { andList } from '@/lib/tournament-board-words';
import {
  RULE_ICONS, RULES_WORDS as W, deleteSectionQuestion, sectionCaption,
} from '@/lib/tournament-settings-words';
import type { RuleSection } from '@/lib/types';
import styles from './rules.module.css';

type PointDraft = { key: string; id: string | null; content: string };
type Draft = { title: string; icon: string; some: boolean; divisionIds: string[]; points: PointDraft[] };
export type RuleDivision = { id: string; name: string };

let nextKey = 0;
const newKey = () => `point-${++nextKey}`;

function draftOf(s: RuleSection | null): Draft {
  return {
    title: s?.title ?? '',
    icon: s?.icon || 'Shield',
    some: Boolean(s?.divisionIds?.length),
    divisionIds: s?.divisionIds ?? [],
    points: (s?.items ?? []).map(i => ({ key: i.id, id: i.id, content: i.content ?? '' })),
  };
}

/** The division names a section names, in the event's order; null = every division. */
export function namesFor(divisionIds: readonly string[] | null | undefined, divisions: readonly RuleDivision[]): string[] | null {
  if (!divisionIds?.length) return null;
  return divisions.filter(d => divisionIds.includes(d.id)).map(d => d.name);
}

export default function RuleSectionRecord({
  section, tournamentId, divisions, canWrite, order, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add a section (the same window, creating). */
  section: RuleSection | null;
  tournamentId: string;
  divisions: readonly RuleDivision[];
  canWrite: boolean;
  /** Its place in the list (a new one goes last). */
  order: number;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** Re-reads the list; false when it didn't load. */
  onChanged: () => Promise<boolean>;
}) {
  const creating = section === null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(section));
  const [seededFor, setSeededFor] = useState(section?.id ?? 'new');
  const [refusedOnce, setRefusedOnce] = useState(false);
  const [shownHeld, setShownHeld] = useState(false);
  // A new point's server id once saved, by its row key — beside the draft, so the save's answer never changes what the
  // record's signature reads (the venue record's lesson).
  const savedIds = useRef(new Map<string, string>());
  const changed = useRef(false);
  if (seededFor !== (section?.id ?? 'new')) {
    setSeededFor(section?.id ?? 'new');
    setEditing(false);
    setDraft(draftOf(section));
    setRefusedOnce(false);
    setShownHeld(false);
  }

  // A point with no words yet is simply not saved yet (it never holds the rest of the edit).
  const held = !draft.title.trim() ? W.titleHeld
    : draft.some && draft.divisionIds.length === 0 ? W.divisionsHeld
      : null;

  const payload = useCallback((d: Draft) => ({
    title: d.title.trim(),
    icon: d.icon,
    divisionIds: d.some ? d.divisionIds : null,
  }), []);

  const write = useCallback(async (signal: AbortSignal) => {
    if (!section) return;
    const created = await saveRuleSectionWhole(section.id, {
      ...payload(draft),
      items: draft.points
        .filter(p => p.content.trim())
        // The newest id first: a point re-added after it was emptied came back with a new one.
        .map(p => ({ id: savedIds.current.get(p.key) ?? p.id, key: p.key, content: p.content.trim() })),
    }, signal);
    for (const [key, id] of Object.entries(created)) savedIds.current.set(key, id);
    changed.current = true;
  }, [section, draft, payload]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && editing && !creating, loading: false, sig: JSON.stringify(draft), blocked: editing ? held : null, write, failText: W.saveFailed,
  });
  const change = (nextDraft: Draft) => { setDraft(nextDraft); if (!creating) touch(); setRefusedOnce(false); };

  /* A refused save holds the window ONCE with the reason in its pill; leaving again leaves it unsaved — never a window
     that cannot be left (the library's rule). */
  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || refusedOnce) return true;
    // A held edit (no title) holds the window ONCE with its reason, like a refused save — never dropped silently.
    if (held) { setShownHeld(true); setRefusedOnce(true); return false; }
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leave = async (then: () => void) => {
    if (!(await flush())) return;
    settle();
    setRefusedOnce(false);
    if (changed.current) { changed.current = false; await onChanged(); }
    then();
  };
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (held) { setShownHeld(true); return; }
    if (dirty && !(await handleSave())) return;
    const reread = changed.current ? await onChanged() : true;
    changed.current = false;
    setEditing(false);
    if (reread) {
      setSeededFor('');
    } else {
      setDraft(d => ({ ...d, points: d.points.map(p => (p.id ? p : { ...p, id: savedIds.current.get(p.key) ?? null })) }));
    }
  };

  // ── Add a section: the same window, asking ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy) return;
    if (held) { setShownHeld(true); setCreateError(held); return; }
    setBusy(true);
    setCreateError('');
    try {
      await createRuleSection(tournamentId, order, { ...payload(draft), items: draft.points.map(p => p.content) });
      await onChanged();
      onClose();
    } catch {
      setCreateError(W.addFailed);
    } finally {
      setBusy(false);
    }
  }

  // ── Delete: asks first ──
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  async function doDelete() {
    if (!section) return;
    setBusy(true);
    setAskError('');
    try {
      await deleteRuleSection(section.id);
      setAsking(false);
      await onChanged();
      onClose();
    } catch {
      setAskError('Couldn’t delete it. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  const toggleDivision = (id: string, on: boolean) => change({
    ...draft,
    divisionIds: on ? [...draft.divisionIds, id] : draft.divisionIds.filter(x => x !== id),
  });

  const fields = (
    <>
      <TextField id="rule-title" label={W.sectionTitle} required value={draft.title} maxLength={120}
        onChange={v => change({ ...draft, title: v })}
        hint={shownHeld && !draft.title.trim() ? <span className={styles.mistake} role="alert">{W.titleHeld}</span> : undefined} />
      <label className={ck.field} htmlFor="rule-icon">
        <span className={ck.label}>{W.icon}</span>
        <select id="rule-icon" className={ck.select} value={draft.icon} onChange={e => change({ ...draft, icon: e.target.value })}>
          {RULE_ICONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </label>
      {divisions.length > 0 && (
        <>
          <label className={ck.field} htmlFor="rule-applies">
            <span className={ck.label}>{W.appliesTo}</span>
            <select id="rule-applies" className={ck.select} value={draft.some ? 'some' : 'all'}
              onChange={e => change({ ...draft, some: e.target.value === 'some' })}>
              <option value="all">{W.everyDivision}</option>
              <option value="some">{W.someDivisions}</option>
            </select>
          </label>
          {draft.some && (
            <div className={styles.divisionChoices} role="group" aria-label={W.appliesTo}>
              {divisions.map(d => (
                <CheckChoice key={d.id} checked={draft.divisionIds.includes(d.id)} onChange={on => toggleDivision(d.id, on)} title={d.name} />
              ))}
              {shownHeld && draft.divisionIds.length === 0 && <p className={styles.mistake} role="alert">{W.pickDivisions}</p>}
            </div>
          )}
        </>
      )}
      <h3 className={styles.sectionHead}>{W.points}</h3>
      <SortableRows ids={draft.points.map(p => p.key)} onMove={(from, to) => change({ ...draft, points: moved(draft.points, from, to) })}>
        <ol className={styles.pointsEdit}>
          {draft.points.map((p, i) => (
            <SortableRow key={p.key} id={p.key} name={W.pointLabel(i + 1)}>
              {({ grip, itemRef, itemStyle }) => (
                <li ref={itemRef} style={itemStyle} className={styles.pointEdit}>
                  <span className={styles.pointGrip}>{grip}</span>
                  <textarea className={ck.textarea} rows={2} aria-label={W.pointLabel(i + 1)} value={p.content} maxLength={1000}
                    onChange={e => change({ ...draft, points: draft.points.map(x => (x.key === p.key ? { ...x, content: e.target.value } : x)) })} />
                  <button type="button" className={styles.remove} aria-label={W.removePoint(i + 1)}
                    onClick={() => change({ ...draft, points: draft.points.filter(x => x.key !== p.key) })}>
                    <X size={15} aria-hidden />
                  </button>
                </li>
              )}
            </SortableRow>
          ))}
        </ol>
      </SortableRows>
      <button type="button" className={`btn btn-outline ${styles.addPoint}`}
        onClick={() => change({ ...draft, points: [...draft.points, { key: newKey(), id: null, content: '' }] })}>
        <Plus size={14} aria-hidden /> {W.addPoint}
      </button>
    </>
  );

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={W.addSection}
        identity={W.rulesCaption}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? W.adding : W.addSectionAction}</button>
          </>
        )}
      >
        <FormError>{createError}</FormError>
        {fields}
      </KitDialog>
    );
  }

  const s = section!;
  const names = namesFor(s.divisionIds, divisions);
  const question = deleteSectionQuestion(s.title, s.items.length);
  return (
    <>
      <KitDialog
        kind="form"
        title={editing ? (draft.title.trim() || s.title) : s.title}
        ariaLabel={s.title}
        identity={sectionCaption(s.items.length, names)}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        edit={canWrite ? { editing, onToggle: () => void toggleEdit(), label: W.edit(s.title) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        steps={{
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.sectionNoun,
        }}
        levelKey={s.id}
      >
        {editing ? fields : (
          <>
            <dl className={screenParts.recordFacts}>
              <div><dt>{W.appliesTo}</dt><dd>{names ? andList(names) : W.everyDivision}</dd></div>
            </dl>
            <h3 className={styles.sectionHead}>{W.points}</h3>
            {s.items.length === 0
              ? <p className={styles.quiet}>{W.noPoints}</p>
              : <ul className={styles.points}>{s.items.map(i => <li key={i.id}>{i.content}</li>)}</ul>}
          </>
        )}
        {canWrite && (
          <RecordSection>
            <RecordDelete onClick={() => void leave(() => { setAskError(''); setAsking(true); })} disabled={busy}>{W.deleteSection}</RecordDelete>
          </RecordSection>
        )}
      </KitDialog>

      {asking && (
        <KitDialog
          kind="question"
          title={question.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void doDelete()} disabled={busy}>{question.action}</button>
            </>
          )}
        >
          <p>{question.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
