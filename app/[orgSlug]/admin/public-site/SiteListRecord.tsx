'use client';
/**
 * ONE ROW OF THE ABOUT PAGE'S LISTS, AS A RECORD (Club Tier Stage 4c-1, Ask 10; one window, the 2026-10-19 drawings'
 * "each row opens a small window"). A contact, a document or a question: it reads first, the pencil edits it saving as
 * you go (edit autosaves), Remove asks. The same window, asking, adds one (create asks). The pattern is the tournament
 * Resources record's (`ResourceRecord`); the fields are the list's.
 *
 * Every check is the route's own (`checkListRow`, lib/public-site-patch): a missing field or a refused address holds the
 * save and says why; a personal-looking contact address is nudged, never refused.
 */
import { useCallback, useRef, useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordDelete, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import styles from './public-site.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useRecordWindow } from '@/components/admin/tournament/useRecordWindow';
import { checkListRow, type ListKind } from '@/lib/public-site-patch';
import { pastYearHint } from '@/lib/past-year-hint';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';

export interface ListField {
  key: string;
  label: string;
  placeholder?: string;
  kind: 'text' | 'textarea' | 'email' | 'link';
  maxLength: number;
  /** Offered as you type (a document's headings); any words are allowed. */
  suggestions?: readonly string[];
  /** A hint, never a block (the past-year hint under an answer). */
  pastYearHint?: boolean;
  /** A hint, never a block, for a value that passes (the role-address nudge). */
  nudge?: (value: string) => string | null;
}

type Values = Record<string, string>;

/** One About-page list, as the editor and this window know it. */
export interface SiteList {
  kind: ListKind;
  fields: readonly ListField[];
  words: { title: string; lead: string; add: string; edit: string; remove: string; saved: string; removed: string };
  /** A row's name (its title in the list and in this window) and its caption. */
  title: (row: Values) => string;
  caption: (row: Values) => string;
}

export default function SiteListRecord({ item, list, canWrite, thisYear, onSave, onRemove, onClose }: {
  /** null = add one (the same window, asking). */
  item: (Values & { id: string }) | null;
  list: SiteList;
  canWrite: boolean;
  thisYear: number;
  /** Stores the row (new or changed); throws with a sentence when the save was refused. */
  onSave: (values: Values) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const { fields, words, title: nameOf } = list;
  const creating = item === null;
  const blank = Object.fromEntries(fields.map(f => [f.key, ''])) as Values;
  const [values, setValues] = useState<Values>(item ? { ...blank, ...item } : blank);
  const [editing, setEditing] = useState(creating);
  const changed = useRef(false);
  const mistake = checkListRow(list.kind, values);

  const write = useCallback(async () => {
    await onSave(values);
    changed.current = true;
  }, [onSave, values]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && editing && !creating, loading: false, sig: JSON.stringify(values),
    blocked: editing && !creating ? mistake : null, write, failText: W.saveFailed,
  });
  const { resetRefused, leave, toggleEdit } = useRecordWindow({
    editing, setEditing, dirty, held: mistake, handleSave, settle, onChanged: async () => true,
    consumeChanged: () => { const was = changed.current; changed.current = false; return was; },
    onAfterSave: () => {},
  });
  const set = (key: string, value: string) => {
    setValues(v => ({ ...v, [key]: value }));
    if (!creating) touch();
    resetRefused();
    setCreateError('');
  };

  // ── Add: asks ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy) return;
    if (mistake) { setCreateError(mistake); return; }
    setBusy(true);
    try {
      await onSave(values);
      onClose();
    } catch (e) {
      setCreateError(e instanceof Error && e.message ? e.message : W.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  // ── Remove: asks first ──
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  async function doRemove() {
    setBusy(true);
    setAskError('');
    try {
      await onRemove();
      setAsking(false);
      onClose();
    } catch {
      setAskError(W.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  const fieldsForm = fields.map(f => {
    const id = `site-${f.key}`;
    const value = values[f.key] ?? '';
    // The past-year hint is amber everywhere it shows (Stage 4c-2, C2-07: it was grey here); a nudge stays quiet grey.
    const yearHint = f.pastYearHint ? pastYearHint(value, thisYear) : null;
    const hint = yearHint ? null : (f.nudge && value.trim() && !mistake ? f.nudge(value.trim()) : null);
    const listId = f.suggestions ? `${id}-suggestions` : undefined;
    return (
      <label key={f.key} className={ck.field} htmlFor={id}>
        <span className={ck.label}>{f.label}<span className={repKit.req} aria-hidden>*</span></span>
        {f.kind === 'textarea' ? (
          <textarea id={id} className={ck.textarea} rows={4} value={value} maxLength={f.maxLength} placeholder={f.placeholder}
            onChange={e => set(f.key, e.target.value)} />
        ) : (
          <input id={id} className={ck.input} value={value} maxLength={f.maxLength} placeholder={f.placeholder} list={listId}
            type={f.kind === 'email' ? 'email' : f.kind === 'link' ? 'url' : 'text'} inputMode={f.kind === 'link' ? 'url' : undefined}
            onChange={e => set(f.key, e.target.value)} />
        )}
        {listId && <datalist id={listId}>{f.suggestions!.map(s => <option key={s} value={s} />)}</datalist>}
        {yearHint && <p className={styles.yearHint}>{yearHint}</p>}
        {hint && <p className={ck.hint}>{hint}</p>}
      </label>
    );
  });

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={words.add}
        identity={words.title}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footerStart={createError ? <FormError>{createError}</FormError> : undefined}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? W.saving : W.save}</button>
          </>
        )}
      >
        {fieldsForm}
      </KitDialog>
    );
  }

  const name = nameOf(item!);
  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        title={editing ? (nameOf(values) || name) : name}
        ariaLabel={editing ? words.edit : name}
        identity={words.title}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={mistake} onRetry={() => void handleSave()} /> : undefined}
        edit={canWrite ? { editing, onToggle: () => void toggleEdit(), label: W.edit(name) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        levelKey={item!.id}
      >
        {editing ? fieldsForm : (
          <dl className={screenParts.recordFacts}>
            {fields.map(f => (
              <div key={f.key}><dt>{f.label}</dt><dd style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{item![f.key] || '—'}</dd></div>
            ))}
          </dl>
        )}
        {canWrite && (
          <RecordSection>
            <RecordDelete onClick={() => void leave(() => { setAskError(''); setAsking(true); })} disabled={busy}>{words.remove}</RecordDelete>
          </RecordSection>
        )}
      </KitDialog>

      {asking && (
        <KitDialog
          kind="question"
          title={W.removeAsk(name)}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.keepIt}</button>
              <button type="button" className="btn btn-danger" onClick={() => void doRemove()} disabled={busy}>{W.remove}</button>
            </>
          )}
        >
          <p>{W.removeBody}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
