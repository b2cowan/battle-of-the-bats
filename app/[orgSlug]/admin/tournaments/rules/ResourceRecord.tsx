'use client';
/**
 * A LINK OR A FILE, AS A RECORD — Tournament admin redesign Stage 5 (E6, A50; hub v45, ruled as drawn 2026-10-10).
 * Resources & downloads' rows open it: it reads first (what it is, where it goes, Open it), the pencil edits its name
 * (and a link's address) saving as you go, Delete ends it and asks. The same window, asking, adds one: a link (its
 * address) or a file (chosen, then uploaded on Add). The old row's inline edit with its own Save and Cancel went.
 */
import { useCallback, useRef, useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordDelete, SavePill } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { deleteResource, saveResource, updateResource, uploadResourceFile } from '@/lib/db';
import { RULES_WORDS as W, deleteResourceQuestion, resourceCaption } from '@/lib/tournament-settings-words';
import type { Resource } from '@/lib/types';
import styles from './rules.module.css';

/** A file the organizer uploaded (the resources bucket's public address), not a link they typed. */
export const isResourceFile = (url: string) => /\/storage\/v1\/object\/public\/resources\//.test(url);

const hasAddress = (url: string) => {
  const t = url.trim();
  return t !== '' && t !== '#' && t !== 'https://';
};

export default function ResourceRecord({
  resource, tournamentId, canWrite, order, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add a link or file (the same window, asking). */
  resource: Resource | null;
  tournamentId: string;
  canWrite: boolean;
  order: number;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** Re-reads the list; false when it didn't load. */
  onChanged: () => Promise<boolean>;
}) {
  const creating = resource === null;
  const isFile = resource ? isResourceFile(resource.url) : false;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(resource?.label ?? '');
  const [url, setUrl] = useState(resource && hasAddress(resource.url) ? resource.url : '');
  const [seededFor, setSeededFor] = useState(resource?.id ?? 'new');
  const [refusedOnce, setRefusedOnce] = useState(false);
  const changed = useRef(false);
  if (seededFor !== (resource?.id ?? 'new')) {
    setSeededFor(resource?.id ?? 'new');
    setEditing(false);
    setLabel(resource?.label ?? '');
    setUrl(resource && hasAddress(resource.url) ? resource.url : '');
    setRefusedOnce(false);
  }

  // Adding: a link or a file.
  const [kind, setKind] = useState<'link' | 'file'>('link');
  const [file, setFile] = useState<File | null>(null);

  // A link needs its address, except a sample's that never had one (it can be renamed before it gets one).
  const needsAddress = creating ? kind === 'link' : !isFile && hasAddress(resource!.url);
  const held = !label.trim() ? W.nameHeld
    : needsAddress && !url.trim() ? W.addressHeld
      : null;

  const write = useCallback(async () => {
    if (!resource) return;
    await updateResource(resource.id, isFile ? { label: label.trim() } : { label: label.trim(), url: url.trim() || '#' });
    changed.current = true;
  }, [resource, isFile, label, url]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && editing && !creating, loading: false, sig: JSON.stringify([label, url]), blocked: editing ? held : null, write, failText: W.saveFailed,
  });
  const edit = (fn: () => void) => { fn(); if (!creating) touch(); setRefusedOnce(false); };

  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || refusedOnce) return true;
    // A held edit holds the window ONCE with its reason in the pill, like a refused save — never dropped silently.
    if (held) { setRefusedOnce(true); return false; }
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
    if (held) return;
    if (dirty && !(await handleSave())) return;
    const reread = changed.current ? await onChanged() : true;
    changed.current = false;
    setEditing(false);
    if (reread) setSeededFor('');
  };

  // ── Add a link or file ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy) return;
    const mistake = !label.trim() ? W.nameHeld : kind === 'link' && !url.trim() ? W.addressHeld : kind === 'file' && !file ? W.chooseFile : null;
    if (mistake) { setCreateError(mistake); return; }
    setBusy(true);
    setCreateError('');
    try {
      let address = url.trim();
      if (kind === 'file' && file) {
        const uploaded = await uploadResourceFile(file);
        if (!uploaded) { setCreateError(W.uploadFailed); return; }
        address = uploaded;
      }
      await saveResource({ tournamentId, label: label.trim(), url: address, order });
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
    if (!resource) return;
    setBusy(true);
    setAskError('');
    try {
      await deleteResource(resource.id);
      setAsking(false);
      await onChanged();
      onClose();
    } catch {
      setAskError('Couldn’t delete it. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={W.addResource}
        identity={W.resources}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>
              {busy ? W.adding : kind === 'file' ? W.addFile : W.addLink}
            </button>
          </>
        )}
      >
        <FormError>{createError}</FormError>
        <label className={ck.field} htmlFor="resource-kind">
          <span className={ck.label}>{W.whatIsIt}</span>
          <select id="resource-kind" className={ck.select} value={kind} onChange={e => { setKind(e.target.value as 'link' | 'file'); setCreateError(''); }}>
            <option value="link">{W.aLink}</option>
            <option value="file">{W.aFile}</option>
          </select>
        </label>
        <TextField id="resource-name" label={W.name} required value={label} maxLength={120} onChange={v => setLabel(v)} />
        {kind === 'link' ? (
          <TextField id="resource-address" label={W.address} required value={url} maxLength={500} hint={W.addressHint} placeholder="https://" onChange={v => setUrl(v)} />
        ) : (
          <label className={ck.field} htmlFor="resource-file">
            <span className={ck.label}>{W.file}</span>
            <input id="resource-file" type="file" className={styles.fileInput}
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !label.trim()) setLabel(f.name);
                setCreateError('');
              }} />
            {file && <p className={ck.hint}>{W.chosen(file.name)}</p>}
          </label>
        )}
      </KitDialog>
    );
  }

  const r = resource!;
  const question = deleteResourceQuestion(r.label, isFile);
  return (
    <>
      <KitDialog
        kind="form"
        title={editing ? (label.trim() || r.label) : r.label}
        ariaLabel={r.label}
        identity={resourceCaption(r.url, isFile)}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        edit={canWrite ? { editing, onToggle: () => void toggleEdit(), label: W.edit(r.label) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        steps={{
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.resourceNoun,
        }}
        levelKey={r.id}
      >
        {editing ? (
          <>
            <TextField id="resource-name" label={W.name} required value={label} maxLength={120} onChange={v => edit(() => setLabel(v))} />
            {isFile
              ? <p className={screenParts.recordText}>{W.fileStays}</p>
              : <TextField id="resource-address" label={W.address} required value={url} maxLength={500} hint={W.addressHint} placeholder="https://" onChange={v => edit(() => setUrl(v))} />}
          </>
        ) : (
          <>
            <dl className={screenParts.recordFacts}>
              <div><dt>{W.whatIsIt}</dt><dd>{isFile ? W.aFile : W.aLink}</dd></div>
              {!isFile && <div><dt>{W.address}</dt><dd className={styles.address}>{hasAddress(r.url) ? r.url : '—'}</dd></div>}
            </dl>
            {hasAddress(r.url) && <a className={styles.door} href={r.url} target="_blank" rel="noopener noreferrer">{W.open}</a>}
          </>
        )}
        {canWrite && (
          <RecordSection>
            <RecordDelete onClick={() => void leave(() => { setAskError(''); setAsking(true); })} disabled={busy}>{W.deleteResource}</RecordDelete>
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
