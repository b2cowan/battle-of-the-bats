'use client';
/**
 * A DOCUMENT, AS A RECORD — and "Add a document", and "Replace with a new version" (Board Ready Stage 4 Part 1; drawing
 * tab 3; rulings 2, 8, 18). A document is today's waiver, generalized: a PDF the club uploads or a typed text, and the tick
 * families give ("I have read {doc}." or "I have read and agree to {doc}."). It has no Required switch: every document must
 * be ticked to sign up. Never behind a plan gate.
 *
 *   the record   reads first (the tick, what families read, the versions); the pencil edits the name and the tick (the
 *                tick locks once anyone has ticked — each tick keeps the sentence it was given). Replace and Archive end
 *                the body. A version with ticks is never deleted.
 *   Replace      the new words become the next version; the club says what it means for families who ticked the one
 *                before: "Their tick stands" or "They must tick again" (with a reason families see). Nobody is emailed.
 * The product says families are asked to open a document; it never says "we confirm they read it" (/legal).
 */
import { useCallback, useRef, useState } from 'react';
import { Archive, ExternalLink, FileUp } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { ClubRow, ClubRowList, RecordAction, RepChip, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { jsonInit } from '@/lib/money-fetch';
import { readRefusal } from '@/lib/schedule-words';
import { fileSizeWords } from '@/lib/permit-words';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useRecordWindow } from '@/components/admin/tournament/useRecordWindow';
import { FORM_LIMITS, currentVersion, isTicked, tickSentence, type DocumentSource, type FormDocument, type TickKind } from '@/lib/club-form';
import { FORM_WORDS as W, versionCaption } from '@/lib/club-form-words';
import f from './SignupForm.module.css';

/** A document's add or replace: always one multipart body, the PDF in `file` when there is one (the route reads both). */
function sendDocument(url: string, fields: Record<string, string>, file: File | null): Promise<Response> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  if (file) body.set('file', file);
  return fetch(url, { method: 'POST', body });
}

/** A chosen PDF, checked here for size only (the server checks what it is from its bytes). */
function usePdfChoice() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
  const picker = (
    <input ref={input} type="file" accept="application/pdf,.pdf" className={f.hiddenInput} tabIndex={-1} aria-hidden
      onChange={e => {
        const next = e.target.files?.[0] ?? null;
        e.target.value = '';
        if (!next) return;
        if (next.size > FORM_LIMITS.fileBytes) { setError(W.docTooBig); return; }
        setError('');
        setFile(next);
      }} />
  );
  return { file, error, choose, picker };
}

function PdfChooser({ pdf }: { pdf: ReturnType<typeof usePdfChoice> }) {
  return (
    <div className={ck.field}>
      {pdf.picker}
      {pdf.file ? (
        <div className={f.fileGot}>
          <RepChip tone="info">PDF</RepChip> {pdf.file.name} · {fileSizeWords(pdf.file.size)}
          <button type="button" className={`${repKit.inlineLink} ${f.chooseAgain}`} onClick={pdf.choose}>{W.docChooseAnother}</button>
        </div>
      ) : (
        <button type="button" className="btn btn-outline" onClick={pdf.choose}><FileUp size={14} aria-hidden /> {W.docChoose}</button>
      )}
      {pdf.error ? <p className={ck.hint} role="alert">{pdf.error}</p> : <p className={ck.hint}>{W.docPdfHint}</p>}
    </div>
  );
}

function TickSelect({ id, name, value, onChange, locked }: { id: string; name: string; value: TickKind; onChange: (v: TickKind) => void; locked?: string | null }) {
  const label = name.trim() || 'Document';
  if (locked) {
    return (
      <div className={ck.field}>
        <span className={ck.label}>{W.docTick}</span>
        <span className={repKit.readonlyValue}>{tickSentence(label, value)}</span>
        <p className={ck.hint}>{locked}</p>
      </div>
    );
  }
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{W.docTick}</span>
      <select id={id} className={ck.select} value={value} onChange={e => onChange(e.target.value as TickKind)}>
        <option value="read">{tickSentence(label, 'read')}</option>
        <option value="read_agree">{tickSentence(label, 'read_agree')}</option>
      </select>
      <p className={ck.hint}>{W.docTickOther(label, value)}</p>
    </label>
  );
}

export default function DocumentWindow({
  document: doc, apiBase, orgQuery, canEdit, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add a document. */
  document: FormDocument | null;
  /** `/api/admin/house-league/seasons/{id}/form/documents` */
  apiBase: string;
  orgQuery: string;
  canEdit: boolean;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  onChanged: () => Promise<boolean>;
}) {
  return doc === null
    ? <AddDocument apiBase={apiBase} orgQuery={orgQuery} onClose={onClose} onChanged={onChanged} />
    : <DocumentRecord doc={doc} apiBase={apiBase} orgQuery={orgQuery} canEdit={canEdit} prev={prev} next={next}
      position={position} onStep={onStep} onClose={onClose} onChanged={onChanged} />;
}

// ── Add a document ─────────────────────────────────────────────────────────────────────────────────────────────────────

function AddDocument({ apiBase, orgQuery, onClose, onChanged }: {
  apiBase: string; orgQuery: string; onClose: () => void; onChanged: () => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<DocumentSource>('pdf');
  const [text, setText] = useState('');
  const [tickKind, setTickKind] = useState<TickKind>('read');
  const pdf = usePdfChoice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (busy) return;
    const held = !name.trim() ? W.docHeldName : source === 'pdf' && !pdf.file ? W.docHeldFile : source === 'text' && !text.trim() ? W.docHeldText : null;
    if (held) { setError(held); return; }
    setBusy(true);
    setError('');
    try {
      const res = await sendDocument(`${apiBase}${orgQuery}`,
        { name: name.trim(), source, tickKind, text: source === 'text' ? text.trim() : '' }, source === 'pdf' ? pdf.file : null);
      if (!res.ok) { setError(await readRefusal(res, W.addFailed)); return; }
      await onChanged();
      onClose();
    } catch {
      setError(W.addFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={W.addDocument}
      onClose={() => { if (!busy) onClose(); }}
      busy={busy}
      footerStart={source === 'pdf' ? <span className={repKit.footNote}>{W.docPdfFoot}</span> : undefined}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? W.adding : W.addDocumentAction}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <TextField id="cd-name" label={W.docName} required value={name} maxLength={FORM_LIMITS.docName} onChange={setName}
        hint={W.docNameHint(name, tickKind)} />
      <label className={ck.field} htmlFor="cd-source">
        <span className={ck.label}>{W.docSource}</span>
        <select id="cd-source" className={ck.select} value={source} onChange={e => setSource(e.target.value as DocumentSource)}>
          <option value="pdf">{W.docSourcePdf}</option>
          <option value="text">{W.docSourceText}</option>
        </select>
      </label>
      {source === 'pdf' ? <PdfChooser pdf={pdf} /> : (
        <label className={ck.field} htmlFor="cd-text">
          <span className={ck.label}>{W.docText}<span className={ck.required} aria-hidden>*</span></span>
          <textarea id="cd-text" className={ck.textarea} rows={6} value={text} maxLength={FORM_LIMITS.docText} onChange={e => setText(e.target.value)} />
        </label>
      )}
      <TickSelect id="cd-tick" name={name} value={tickKind} onChange={setTickKind} />
    </KitDialog>
  );
}

// ── The record ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function DocumentRecord({ doc, apiBase, orgQuery, canEdit, prev, next, position, onStep, onClose, onChanged }: {
  doc: FormDocument; apiBase: string; orgQuery: string; canEdit: boolean;
  prev: { id: string; name: string } | null; next: { id: string; name: string } | null; position: string;
  onStep: (id: string) => void; onClose: () => void; onChanged: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: doc.name, tickKind: doc.tickKind });
  const [seededFor, setSeededFor] = useState(doc.id);
  const [readAll, setReadAll] = useState(false);
  const changed = useRef(false);
  const ticked = isTicked(doc);
  const held = !draft.name.trim() ? W.docHeldName : null;

  const write = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`${apiBase}/${encodeURIComponent(doc.id)}${orgQuery}`,
      { ...jsonInit('PATCH', { name: draft.name.trim(), tickKind: draft.tickKind }), signal });
    if (!res.ok) throw new Error(await readRefusal(res, W.saveFailed));
    changed.current = true;
  }, [apiBase, orgQuery, doc.id, draft]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canEdit && editing, loading: false, sig: JSON.stringify(draft), blocked: editing ? held : null, write, failText: W.saveFailed,
  });
  const { resetRefused, leave, toggleEdit } = useRecordWindow({
    editing, setEditing, dirty, held, handleSave, settle, onChanged,
    consumeChanged: () => { const was = changed.current; changed.current = false; return was; },
    onAfterSave: reread => { if (reread) setSeededFor(''); },
  });
  if (seededFor !== doc.id) {
    setSeededFor(doc.id);
    setEditing(false);
    setReadAll(false);
    setDraft({ name: doc.name, tickKind: doc.tickKind });
    resetRefused();
  }
  const change = (patch: Partial<typeof draft>) => { setDraft(d => ({ ...d, ...patch })); touch(); resetRefused(); };

  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<'archive' | 'replace' | null>(null);
  const [askError, setAskError] = useState('');
  async function archive() {
    setBusy(true);
    setAskError('');
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(doc.id)}${orgQuery}`, jsonInit('PATCH', { archived: true }));
      if (!res.ok) { setAskError(await readRefusal(res, W.docArchiveFailed)); return; }
      setAsking(null);
      await onChanged();
      onClose();
    } catch {
      setAskError(W.docArchiveFailed);
    } finally {
      setBusy(false);
    }
  }

  const current = currentVersion(doc);
  const fileUrl = (versionId: string) => `${apiBase}/${encodeURIComponent(doc.id)}/file${orgQuery}&version=${encodeURIComponent(versionId)}`;
  const kind = doc.source === 'pdf' ? 'PDF' : 'Typed text';
  const ask = W.docArchiveAsk(doc.name);
  const excerpt = current?.bodyText && current.bodyText.length > 160 && !readAll ? `${current.bodyText.slice(0, 160).trimEnd()}…` : current?.bodyText;

  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        title={editing ? (draft.name.trim() || doc.name) : doc.name}
        ariaLabel={doc.name}
        identity={[kind, current ? W.docVersion(current.versionNo).toLowerCase() : null].filter(Boolean).join(' · ')}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        edit={canEdit && !doc.archivedAt ? { editing, onToggle: () => void toggleEdit(), label: W.edit(doc.name) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        steps={position ? {
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.docNoun,
        } : undefined}
        levelKey={doc.id}
      >
        {editing ? (
          <>
            <TextField id="cd-edit-name" label={W.docName} required value={draft.name} maxLength={FORM_LIMITS.docName}
              onChange={v => change({ name: v })} hint={W.docNameHint(draft.name, draft.tickKind)} />
            <TickSelect id="cd-edit-tick" name={draft.name} value={draft.tickKind} onChange={v => change({ tickKind: v })}
              locked={ticked ? W.docTickLocked : null} />
          </>
        ) : (
          <dl className={screenParts.recordFacts}>
            <div><dt>{W.docTick}</dt><dd>{tickSentence(doc.name, doc.tickKind)}</dd></div>
            <div><dt>{W.docFamiliesRead}</dt><dd>
              {current?.bodyText ? (
                <>
                  <span className={f.readText}>“{excerpt}”</span>{' '}
                  {current.bodyText.length > 160 && (
                    <button type="button" className={repKit.inlineLink} aria-expanded={readAll} onClick={() => setReadAll(r => !r)}>
                      {readAll ? W.docReadLess : W.docReadAll}
                    </button>
                  )}
                </>
              ) : current?.fileName ? (
                <>
                  {current.fileName}{current.fileSize ? ` · ${fileSizeWords(current.fileSize)}` : ''}{' '}
                  <a href={fileUrl(current.id)} target="_blank" rel="noopener noreferrer"
                    aria-label={`${W.docOpen} ${doc.name}, PDF${current.fileSize ? `, ${fileSizeWords(current.fileSize)}` : ''}, opens in a new tab`}>
                    {W.docOpen} <ExternalLink size={12} aria-hidden />
                  </a>
                </>
              ) : W.docArchivedNoText}
            </dd></div>
          </dl>
        )}

        {doc.versions.length > 0 && (
          <RecordSection title={W.docVersions}>
            <ClubRowList inset label={W.docVersions}>
              {doc.versions.map((v, i) => {
                const row = {
                  title: <>{W.docVersion(v.versionNo)}{i === 0 && <span className={f.rowMark}><RepChip tone="good">{W.docCurrent}</RepChip></span>}</>,
                  caption: versionCaption(v, i === 0 ? null : doc.versions[i - 1].createdAt),
                };
                // A PDF's version opens its file (a signed link, in a new tab); a typed version reads on the record above.
                return v.fileName
                  ? <ClubRow key={v.id} {...row} as="link" href={fileUrl(v.id)} external trail={<ExternalLink size={13} aria-hidden />} />
                  : <ClubRow key={v.id} {...row} />;
              })}
            </ClubRowList>
            {doc.movedTicks > 0 && <p className={ck.hint}>{W.docMovedTicks(doc.movedTicks)}</p>}
          </RecordSection>
        )}

        {canEdit && !doc.archivedAt && (
          <RecordSection>
            <div className={f.doors}>
              {current && (
                <RecordAction icon={<FileUp size={13} aria-hidden />} onClick={() => void leave(() => { setAskError(''); setAsking('replace'); })} disabled={busy}>
                  {W.docReplace}
                </RecordAction>
              )}
              <RecordAction icon={<Archive size={13} aria-hidden />} onClick={() => void leave(() => { setAskError(''); setAsking('archive'); })} disabled={busy}>
                {W.docArchive}
              </RecordAction>
            </div>
            <p className={ck.hint}>{W.docKeepNote}</p>
          </RecordSection>
        )}
      </KitDialog>

      {asking === 'archive' && (
        <KitDialog
          kind="question"
          title={ask.title}
          onClose={() => { if (!busy) setAsking(null); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(null)} disabled={busy}>{W.keep}</button>
              <button type="button" className="btn btn-danger" onClick={() => void archive()} disabled={busy}>{ask.action}</button>
            </>
          )}
        >
          <p>{ask.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}

      {asking === 'replace' && current && (
        <ReplaceVersion doc={doc} apiBase={apiBase} orgQuery={orgQuery}
          onClose={() => setAsking(null)} onDone={async () => { setAsking(null); await onChanged(); }} />
      )}
    </>
  );
}

// ── Replace with a new version ─────────────────────────────────────────────────────────────────────────────────────────

function ReplaceVersion({ doc, apiBase, orgQuery, onClose, onDone }: {
  doc: FormDocument; apiBase: string; orgQuery: string; onClose: () => void; onDone: () => Promise<void>;
}) {
  const current = currentVersion(doc)!;
  const pdf = usePdfChoice();
  const [text, setText] = useState(current.bodyText ?? '');
  // Drawn with "They must tick again" chosen; with no ticks on the current version there is nothing to decide.
  const [stand, setStand] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const from = current.versionNo;
  // The ticks the club answers for: those on the current version, and on version 1 the ticks recorded before documents
  // had versions (the waiver brought across) — a new version means the same to those families.
  const moved = from === 1 ? doc.movedTicks : 0;
  const anyTicks = current.ticks + moved > 0;
  const families = current.families + (from === 1 ? doc.movedFamilies : 0);
  const ticksStand = !anyTicks || stand;

  async function replace() {
    if (busy) return;
    const held = doc.source === 'pdf' && !pdf.file ? W.docHeldFile
      : doc.source === 'text' && !text.trim() ? W.docHeldText
        : !ticksStand && !reason.trim() ? W.replaceReasonHeld : null;
    if (held) { setError(held); return; }
    setBusy(true);
    setError('');
    try {
      const res = await sendDocument(`${apiBase}/${encodeURIComponent(doc.id)}/versions${orgQuery}`,
        // The version the club saw, and its answer only when it was asked (the server refuses if ticks arrived since).
        { fromVersion: String(from), ticksStand: anyTicks ? String(ticksStand) : '', reason: reason.trim(), text: doc.source === 'text' ? text.trim() : '' },
        doc.source === 'pdf' ? pdf.file : null);
      if (!res.ok) { setError(await readRefusal(res, W.replaceFailed)); return; }
      await onDone();
    } catch {
      setError(W.replaceFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={W.replaceTitle(doc.name)}
      identity={W.replaceMeta(from)}
      onClose={() => { if (!busy) onClose(); }}
      busy={busy}
      footerStart={anyTicks ? <span className={repKit.footNote}>{W.replaceFoot(from, current.ticks + moved)}</span> : undefined}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void replace()} disabled={busy}>{busy ? W.replacing : W.replaceAction}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      {doc.source === 'pdf' ? <PdfChooser pdf={pdf} /> : (
        <label className={ck.field} htmlFor="cd-replace-text">
          <span className={ck.label}>{W.docText}<span className={ck.required} aria-hidden>*</span></span>
          <textarea id="cd-replace-text" className={ck.textarea} rows={8} value={text} maxLength={FORM_LIMITS.docText} onChange={e => setText(e.target.value)} />
        </label>
      )}
      {anyTicks && (
        <fieldset className={repKit.fieldset}>
          <legend className={f.legend}>{W.replaceWho(from)}</legend>
          <label className={f.radioRow}>
            <input type="radio" name="cd-stand" checked={stand} onChange={() => setStand(true)} />
            <span className={f.radioTitle}>{W.replaceStand}</span>
            <span className={f.radioSub}>{W.replaceStandSub(families, from)}</span>
          </label>
          <label className={f.radioRow}>
            <input type="radio" name="cd-stand" checked={!stand} onChange={() => setStand(false)} />
            <span className={f.radioTitle}>{W.replaceAgain}</span>
            <span className={f.radioSub}>{W.replaceAgainSub(families, from + 1, doc.source === 'pdf')}</span>
          </label>
        </fieldset>
      )}
      <label className={ck.field} htmlFor="cd-replace-reason">
        <span className={ck.label}>{W.replaceReason}{!ticksStand && <span className={ck.required} aria-hidden>*</span>}</span>
        <input id="cd-replace-reason" className={ck.input} value={reason} maxLength={FORM_LIMITS.reason} onChange={e => setReason(e.target.value)} />
        <p className={ck.hint}>{W.replaceReasonHint}</p>
      </label>
    </KitDialog>
  );
}
