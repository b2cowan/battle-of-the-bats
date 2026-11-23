'use client';
/**
 * A PACKAGE (Board Ready Stage 6, Part 1; round 1 tab 2, asks 1, 6, 7; "Full" grey, round 2 ask 5).
 *   · pkg = null → "Add a package": a create window (KitDialog form), so it asks before it saves (Cancel · Add package).
 *   · pkg → the record: it reads first, the pencil edits, each change saves as you go. A full package says so first
 *     ("Both places are taken."). No delete: "Archive this package" is the body's last line; deals keep the package as it
 *     was when they were offered (Part 2).
 * "What's included" opens with the one item the product acts on — Your logo on our website — then the club's own items in
 * the Stage 4 row list (grip, text, chevron) with an add line at its foot. The PDF is Stage 4's document field (8 MB).
 */
import { useRef, useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { ClubRow, ClubRowList, SavePill } from '../RepKit';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney } from '@/lib/club-sponsorships-words';
import { formatStoredDate } from '@/lib/timezone';
import {
  packageFull, parsePrice, PACKAGE_DOCUMENT_MAX_BYTES, SPONSOR_PLACE_KINDS, type PackageItem, type SponsorPlaceKind,
} from '@/lib/club-sponsorships';
import { send, sponsorshipsApi, type PlacePackage } from './api';
import SwitchRow from './SwitchRow';
import DateInput from '@/components/shared/DateInput';
import css from './Sponsorships.module.css';

export const PLACE_KIND_LABEL: Record<SponsorPlaceKind, string> = {
  club: 'The club', division: 'A house-league division', team: 'A house-league team', tournament: 'A tournament',
};

interface Draft {
  name: string; price: string; howMany: string; placeKind: SponsorPlaceKind; showsUntil: string; logoOnSite: boolean; items: PackageItem[];
}
const draftOf = (p: PlacePackage | null): Draft => ({
  name: p?.name ?? '', price: p ? p.price.toFixed(2) : '', howMany: p?.howMany != null ? String(p.howMany) : '',
  placeKind: p?.placeKind ?? 'division', showsUntil: p?.showsUntil ?? '', logoOnSite: p?.logoOnSite ?? true, items: p?.items ?? [],
});
const bodyOf = (d: Draft) => ({
  name: d.name, price: d.price, howMany: d.howMany.trim() ? d.howMany : null, placeKind: d.placeKind,
  showsUntil: d.showsUntil || null, logoOnSite: d.logoOnSite, items: d.items,
});
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Date.now()}`);

export default function PackageWindow({ slug, pkg, onChanged, onClose }: {
  slug: string;
  pkg: PlacePackage | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const creating = pkg === null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(pkg));
  const [savedDraft, setSavedDraft] = useState<Draft>(() => draftOf(pkg));
  const [editing, setEditing] = useState(creating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [doc, setDoc] = useState(pkg?.document ?? null);
  const [itemEdit, setItemEdit] = useState<{ id: string | null; text: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  // Set once the package exists: a PDF that failed after it is retried alone, never a second package.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const full = !!pkg && packageFull(pkg, pkg.taken);

  /** The record saves each change as you go; the create window holds it all until Add package. */
  async function persist(next: Draft) {
    setDraft(next);
    if (creating) return;
    setBusy(true); setError(null);
    const r = await send(sponsorshipsApi(slug, `/packages/${pkg!.id}`), 'PATCH', bodyOf(next));
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setSavedDraft(next);
    onChanged();
  }
  const commitText = () => { if (!creating && dirty) void persist(draft); };

  async function create() {
    setError(null);
    if (!draft.name.trim()) { setError(W.pkg.errName); return; }
    if (parsePrice(draft.price) == null) { setError(W.pkg.errPrice); return; }
    setBusy(true);
    let id = createdId;
    if (!id) {
      const r = await send<{ id: string }>(sponsorshipsApi(slug, '/packages'), 'POST', bodyOf(draft));
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      id = r.data.id;
      setCreatedId(id);
      onChanged();
    }
    if (pdf) {
      const fd = new FormData();
      fd.append('file', pdf);
      const up = await send(sponsorshipsApi(slug, `/packages/${id}/document`), 'POST', fd);
      if (!up.ok) { setBusy(false); setError(up.error); return; }
    }
    setBusy(false);
    onChanged();
    onClose();
  }

  async function choosePdf(file: File | undefined) {
    if (!file) return;
    if (file.size > PACKAGE_DOCUMENT_MAX_BYTES || (file.type && file.type !== 'application/pdf')) { setError(W.pkg.errPdf); return; }
    setError(null);
    if (creating) { setPdf(file); return; }
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    const r = await send<{ document: { name: string; size: number } }>(sponsorshipsApi(slug, `/packages/${pkg!.id}/document`), 'POST', fd);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setDoc(r.data.document);
    onChanged();
  }
  async function removePdf() {
    if (creating) { setPdf(null); return; }
    setBusy(true);
    const r = await send(sponsorshipsApi(slug, `/packages/${pkg!.id}/document`), 'DELETE');
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setDoc(null);
    onChanged();
  }
  async function archive(archived: boolean) {
    setBusy(true);
    const r = await send(sponsorshipsApi(slug, `/packages/${pkg!.id}`), 'PATCH', { action: archived ? 'archive' : 'unarchive' });
    setBusy(false);
    if (!r.ok) { setError(r.error); setArchiving(false); return; }
    onChanged();
    onClose();
  }

  function saveItem() {
    if (!itemEdit) return;
    const text = itemEdit.text.trim();
    if (!text) { setItemEdit(null); return; }
    const items = itemEdit.id
      ? draft.items.map(i => (i.id === itemEdit.id ? { ...i, text } : i))
      : [...draft.items, { id: newKey(), text }];
    setItemEdit(null);
    void persist({ ...draft, items });
  }
  function removeItem(id: string) {
    setItemEdit(null);
    void persist({ ...draft, items: draft.items.filter(i => i.id !== id) });
  }
  function moveItem(from: number, to: number) {
    const items = [...draft.items];
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    void persist({ ...draft, items });
  }

  const docName = creating ? pdf?.name ?? null : doc?.name ?? null;
  const docSize = creating ? pdf?.size ?? null : doc?.size ?? null;

  const fields = (
    <div className={css.form}>
      <div className={ck.field}>
        <label className={ck.label} htmlFor="pkg-name">{W.pkg.name} <span className={ck.required} aria-hidden>*</span></label>
        <input id="pkg-name" className={ck.input} maxLength={80} value={draft.name} required
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} onBlur={commitText} />
      </div>
      <div className={css.twoCol}>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="pkg-price">{W.pkg.price} <span className={ck.required} aria-hidden>*</span></label>
          <input id="pkg-price" className={ck.input} inputMode="decimal" value={draft.price} placeholder="1,000.00" required
            onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} onBlur={commitText} />
          <p className={ck.hint}>{W.pkg.priceHint}</p>
        </div>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="pkg-many">{W.pkg.howMany}</label>
          <input id="pkg-many" className={ck.input} inputMode="numeric" value={draft.howMany}
            onChange={e => setDraft(d => ({ ...d, howMany: e.target.value }))} onBlur={commitText} />
          <p className={ck.hint}>{W.pkg.howManyHint}</p>
        </div>
      </div>
      <div className={css.twoCol}>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="pkg-for">{W.pkg.for} <span className={ck.required} aria-hidden>*</span></label>
          <select id="pkg-for" className={ck.select} value={draft.placeKind}
            onChange={e => void persist({ ...draft, placeKind: e.target.value as SponsorPlaceKind })}>
            {SPONSOR_PLACE_KINDS.map(k => <option key={k} value={k}>{PLACE_KIND_LABEL[k]}</option>)}
          </select>
          <p className={ck.hint}>{W.pkg.forHint[draft.placeKind]}</p>
        </div>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="pkg-until">{W.pkg.showsUntil}</label>
          <DateInput id="pkg-until" className={ck.input} value={draft.showsUntil}
            onChange={v => void persist({ ...draft, showsUntil: v })} />
          <p className={ck.hint}>{W.pkg.showsUntilHint}</p>
        </div>
      </div>
      <h3 className={css.sectionHeading}>{W.pkg.included}</h3>
      <SwitchRow id="pkg-logo" name={W.pkg.logoSwitch} hint={W.pkg.logoHint[draft.placeKind]} on={draft.logoOnSite}
        disabled={busy} onChange={on => void persist({ ...draft, logoOnSite: on })} />
      <ClubRowList inset label={W.pkg.included}>
        <ReorderList ids={draft.items.map(i => i.id)} names={draft.items.map(i => i.text)} onMove={moveItem} disabled={busy} overWindow>
          {draft.items.map(i => (
            <ReorderRow key={i.id} id={i.id}>
              {({ handle, itemRef, itemStyle }) => (
                <ClubRow as="button" aria-haspopup="dialog" onClick={() => setItemEdit({ id: i.id, text: i.text })} chevron
                  title={i.text} grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
              )}
            </ReorderRow>
          ))}
        </ReorderList>
        {draft.items.length < 20 && (
          <ClubRow as="button" aria-haspopup="dialog" onClick={() => setItemEdit({ id: null, text: '' })}
            title={<span className={css.linkButton}><Plus size={14} aria-hidden />{W.pkg.addItem}</span>} />
        )}
      </ClubRowList>
      <p className={ck.hint}>{W.pkg.includedHint}</p>
      <h3 className={css.sectionHeading}>{W.pkg.document}</h3>
      {docName ? (
        <div className={css.fileRow}>
          <span className={css.fileBadge}>PDF</span>
          <span className={css.fileName}>{docName}</span>
          {docSize != null && <span className={css.fileSize}>{mb(docSize)}</span>}
          <button type="button" className={css.linkButton} disabled={busy} onClick={() => fileInput.current?.click()}>{W.pkg.replace}</button>
          <button type="button" className={css.linkButton} disabled={busy} onClick={() => void removePdf()}>{W.pkg.removeDocument}</button>
        </div>
      ) : (
        <div>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => fileInput.current?.click()}>{W.pkg.addDocument}</button>
        </div>
      )}
      <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={e => { void choosePdf(e.target.files?.[0]); e.target.value = ''; }} />
      <p className={ck.hint}>{W.pkg.documentHint}</p>
      {error && <p className={css.error} role="alert">{error}</p>}
    </div>
  );

  const read = pkg && (
    <>
      {full && (
        <p className={css.nudge}>
          <strong>{W.pkg.fullNudgeN(pkg.howMany!)}</strong> {W.pkg.fullNudgeBody(pkg.taken.paid + pkg.taken.invoiced, pkg.taken.offered)}
        </p>
      )}
      <dl className={css.facts}>
        <dt>{W.pkg.price}</dt>
        <dd>{sponsorshipMoney(pkg.price)} <span className={css.factSub}>{W.pkg.priceRead}</span></dd>
        <dt>{W.pkg.for}</dt>
        <dd>{PLACE_KIND_LABEL[pkg.placeKind]}</dd>
        <dt>{W.pkg.howMany}</dt>
        <dd>{pkg.howMany ?? W.pkg.noLimit}</dd>
        <dt>{W.pkg.showsUntil}</dt>
        <dd>{pkg.showsUntil ? formatStoredDate(pkg.showsUntil, { withYear: true }) : W.pkg.noShowsUntil}</dd>
        <dt>{W.pkg.included}</dt>
        <dd>
          {pkg.logoOnSite && <>{W.pkg.logoRead[pkg.placeKind]}</>}
          {pkg.items.length > 0 && <span className={pkg.logoOnSite ? css.factSub : undefined}>{pkg.items.map(i => i.text).join(' · ')}</span>}
        </dd>
        {doc && (
          <>
            <dt>{W.pkg.document}</dt>
            <dd><a className={ck.link} href={sponsorshipsApi(slug, `/packages/${pkg.id}/document`)} target="_blank" rel="noopener noreferrer">{doc.name} ↗</a></dd>
          </>
        )}
      </dl>
      <h3 className={css.sectionHeading}>{W.pkg.takenBy}</h3>
      {pkg.takenBy.length
        ? <ClubRowList inset>{pkg.takenBy.map(t => <ClubRow key={t.id} title={t.name} caption={t.caption} chevron />)}</ClubRowList>
        : <p className={ck.hint}>{W.pkg.noneTaken}</p>}
    </>
  );

  const rareDoor = pkg && (
    <div className={css.rareDoor}>
      {pkg.archivedAt
        ? <button type="button" className={css.linkButton} disabled={busy} onClick={() => void archive(false)}><Archive size={14} aria-hidden />{W.pkg.unarchive}</button>
        : <button type="button" className={css.linkButton} disabled={busy} onClick={() => setArchiving(true)}><Archive size={14} aria-hidden />{W.pkg.archive}</button>}
    </div>
  );

  return (
    <>
      <KitDialog kind="form" size="medium" onClose={onClose} busy={busy} dirty={creating && (dirty || !!pdf)}
        eyebrow={W.pkg.eyebrow}
        title={creating ? W.pkg.addTitle : <>{pkg!.name}{full && <> <span className={ck.chip}>{W.packages.full}</span></>}</>}
        ariaLabel={creating ? W.pkg.addTitle : pkg!.name}
        record={!creating}
        edit={creating ? undefined : { editing, label: editing ? W.pkg.done : W.pkg.edit, disabled: busy, onToggle: () => { if (editing && error) return; commitText(); setEditing(e => !e); } }}
        status={!creating && editing ? <SavePill inline saving={busy} dirty={dirty} error={error} onRetry={() => void persist(draft)} /> : undefined}
        footer={creating ? (
          <>
            <DialogCancel />
            <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void create()}>{busy ? W.pkg.adding : W.pkg.addButton}</button>
          </>
        ) : undefined}>
        {editing ? fields : read}
        {!creating && rareDoor}
      </KitDialog>

      {itemEdit && (
        <KitDialog kind="question" raised onClose={() => setItemEdit(null)} title={itemEdit.id ? W.pkg.itemLabel(draft.items.findIndex(i => i.id === itemEdit.id) + 1) : W.pkg.addItem}
          footer={(
            <>
              {itemEdit.id && <button type="button" className="btn btn-outline" onClick={() => removeItem(itemEdit.id!)}>{W.pkg.removeDocument}</button>}
              <DialogCancel />
              <button type="button" className="btn btn-lime" onClick={saveItem}>{W.pkg.done}</button>
            </>
          )}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="pkg-item">{W.pkg.included}</label>
            <input id="pkg-item" className={ck.input} maxLength={120} value={itemEdit.text} placeholder={W.pkg.itemPlaceholder} autoFocus
              onChange={e => setItemEdit(x => (x ? { ...x, text: e.target.value } : x))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveItem(); } }} />
          </div>
        </KitDialog>
      )}

      {archiving && pkg && (
        <KitDialog kind="question" raised busy={busy} onClose={() => setArchiving(false)} title={W.pkg.archiveAsk(pkg.name)}
          footer={(
            <>
              <DialogCancel />
              <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void archive(true)}>{W.pkg.archiveButton}</button>
            </>
          )}>
          <p className={ck.hint}>{W.pkg.archiveBody}</p>
        </KitDialog>
      )}
    </>
  );
}
