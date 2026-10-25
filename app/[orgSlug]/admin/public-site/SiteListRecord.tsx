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
import { useCallback, useRef, useState, type ReactNode } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import SponsorLogoField from './SponsorLogoField';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
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
import DateInput from '@/components/shared/DateInput';

export interface ListField {
  key: string;
  label: string;
  placeholder?: string;
  /** `logo` is a sponsor's picture (the upload box, Stage 4d); `date` is a day (a native date field, kept as YYYY-MM-DD). */
  kind: 'text' | 'textarea' | 'email' | 'link' | 'logo' | 'date';
  maxLength: number;
  /** Not required: the one star marks a required field, and an optional one is simply bare (no "(optional)" tag). */
  optional?: boolean;
  /** A line of help under the field. */
  hint?: string;
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
  /** `today` is the club's calendar day (a sponsor's caption says whether it has ended). */
  caption: (row: Values, today: string) => string;
  /** What a row wears in the editor's list beyond its title and caption: a lead picture, a dimmed look, a trailing pill
   *  (a sponsor's logo thumbnail and its Ended pill). */
  row?: (row: Values, today: string) => { mark?: ReactNode; markWide?: boolean; muted?: boolean; trail?: ReactNode };
  /** A line above the fields for a row in a state worth saying (an ended sponsor). */
  banner?: (row: Values, today: string) => string | null;
  /** The remove question's sentence, when it is not the usual one (a sponsor with a logo says the logo goes too). */
  removeBody?: (row: Values) => string;
}

export default function SiteListRecord({ item, list, canWrite, thisYear, onSave, onRemove, onClose, onUploadLogo, onDiscardLogo }: {
  /** null = add one (the same window, asking). */
  item: (Values & { id: string }) | null;
  list: SiteList;
  canWrite: boolean;
  thisYear: number;
  /** Stores the row (new or changed); throws with a sentence when the save was refused. */
  onSave: (values: Values) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
  /** A sponsor's logo: sends the file; resolves with the address the server made, or throws with the sentence to show. */
  onUploadLogo?: (file: File) => Promise<string>;
  /** Throws a logo file away (the server refuses one a saved sponsor still points at). */
  onDiscardLogo?: (url: string) => Promise<void>;
}) {
  const { fields, words, title: nameOf } = list;
  const creating = item === null;
  const blank = Object.fromEntries(fields.map(f => [f.key, ''])) as Values;
  const [values, setValues] = useState<Values>(item ? { ...blank, ...item } : blank);
  const [editing, setEditing] = useState(creating);
  const changed = useRef(false);
  const mistake = checkListRow(list.kind, values);
  const today = tournamentToday();
  const bannerText = list.banner?.(values, today) ?? null;
  const banner = bannerText && <p className={styles.sponsorEndedBanner}>{bannerText}</p>;

  // ── A sponsor's logo FILES: one may be thrown away only AFTER the list that stopped using it has been saved ──
  // `retired` holds the files that stopped being this sponsor's logo (replaced or removed); the current one is `values.logoUrl`.
  const retired = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  const discard = useCallback(async (url: string) => { try { await onDiscardLogo?.(url); } catch { /* housekeeping; an orphan file is harmless */ } }, [onDiscardLogo]);
  /** The list was saved with `stored` as this sponsor's logo: files it moved off can go. */
  const sweep = useCallback(async (stored: string) => {
    for (const url of [...retired.current]) {
      // Still the saved logo (a replacement was chosen while this save was in flight): kept for the next save's sweep.
      if (url === stored) continue;
      retired.current.delete(url);
      await discard(url);
    }
  }, [discard]);
  /** Every file this sponsor has had goes: a new sponsor was cancelled, or an existing one was removed. */
  const discardAll = async () => {
    for (const url of new Set([values.logoUrl ?? '', ...retired.current].filter(Boolean))) await discard(url);
    retired.current.clear();
  };
  const cancel = () => { void discardAll(); onClose(); };

  const write = useCallback(async () => {
    await onSave(values);
    changed.current = true;
    await sweep(values.logoUrl ?? '');
  }, [onSave, values, sweep]);
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
  const changeLogo = (next: string) => {
    const prev = values.logoUrl ?? '';
    if (prev && prev !== next) retired.current.add(prev);
    set('logoUrl', next);
  };

  // ── Add: asks ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy || uploading) return;
    if (mistake) { setCreateError(mistake); return; }
    setBusy(true);
    try {
      await onSave(values);
      await sweep(values.logoUrl ?? '');
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
      // The list without this row is saved, so none of its logo files is pointed at any more.
      await discardAll();
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
    if (f.kind === 'logo') {
      return (
        <SponsorLogoField key={f.key} label={f.label} value={value} canWrite={canWrite}
          upload={file => (onUploadLogo ? onUploadLogo(file) : Promise.reject(new Error(W.logoUploadFailed)))}
          onChange={changeLogo} onBusy={setUploading} />
      );
    }
    return (
      <label key={f.key} className={ck.field} htmlFor={id}>
        <span className={ck.label}>{f.label}{!f.optional && <span className={repKit.req} aria-hidden>*</span>}</span>
        {f.kind === 'textarea' ? (
          <textarea id={id} className={ck.textarea} rows={4} value={value} maxLength={f.maxLength} placeholder={f.placeholder}
            onChange={e => set(f.key, e.target.value)} />
        ) : f.kind === 'date' ? (
          <DateInput id={id} className={ck.input} value={value} placeholder={f.placeholder} onChange={v => set(f.key, v)} />
        ) : (
          <input id={id} className={ck.input} value={value} maxLength={f.maxLength} placeholder={f.placeholder} list={listId}
            type={f.kind === 'email' ? 'email' : f.kind === 'link' ? 'url' : 'text'} inputMode={f.kind === 'link' ? 'url' : undefined}
            onChange={e => set(f.key, e.target.value)} />
        )}
        {listId && <datalist id={listId}>{f.suggestions!.map(s => <option key={s} value={s} />)}</datalist>}
        {yearHint && <p className={styles.yearHint}>{yearHint}</p>}
        {hint && <p className={ck.hint}>{hint}</p>}
        {f.hint && <p className={ck.hint}>{f.hint}</p>}
      </label>
    );
  });

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={words.add}
        identity={words.title}
        onClose={() => { if (!busy) cancel(); }}
        busy={busy}
        footerStart={createError ? <FormError>{createError}</FormError> : undefined}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={cancel} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy || uploading}>{busy ? W.saving : W.save}</button>
          </>
        )}
      >
        {banner}
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
        {banner}
        {editing ? fieldsForm : (
          <dl className={screenParts.recordFacts}>
            {fields.map(f => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
                  {f.kind === 'logo'
                    ? (item![f.key] ? <span className={styles.sponsorBox}><img src={item![f.key]} alt="" /></span> : '—')
                    : f.kind === 'date'
                      ? (item![f.key] ? formatStoredDate(item![f.key], { withYear: true }) : '—')
                      : item![f.key] || '—'}
                </dd>
              </div>
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
          <p>{list.removeBody ? list.removeBody(item!) : W.removeBody}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
