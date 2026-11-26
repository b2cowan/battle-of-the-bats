'use client';
/**
 * Make a club for a meeting (Club Website Track P, Session P2; owner rulings T2–T6; drawing Tx3So1rUqL6shn7CzM93Zr, tab
 * 3). A 520 window (full screen on a phone). It asks for nothing about a person, because a preview holds no people (T3):
 * the window refuses a name by having nowhere to type one, and its one free line says so.
 *
 * Every refusal is said where it happens, under its field, with the same rules the route re-checks
 * (`lib/prospect-clubs.ts`). Making is all or nothing: the window shows the making line, and either closes on a made club
 * or says "Nothing was made. Try again." (the room window that would open next is Session P3's).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import DateTimeInput from '@/components/shared/DateTimeInput';
import { pickLogoColours } from '@/lib/logo-colours';
import { zonedWallClockToUtc } from '@/lib/timezone';
import {
  MAKE_WORDS, PREVIEW_LINE_MAX, PREVIEW_LOGO_TYPES, PREVIEW_NAME_MAX, PREVIEW_PROVINCES, PREVIEW_SPORTS,
  makeFieldErrors, removalDateLabel, suggestedSlug, type MakeErrors, type MakeField,
} from '@/lib/prospect-clubs';
import kit from '../console.module.css';
import styles from './prospect-clubs.module.css';

/** When a logo gives no colours (a grey mark, an unreadable file): a calm pair the owner changes. */
// token-exempt: a club colour the window stores (theme_primary / theme_accent), not a style of this screen
const FALLBACK = { primary: '#1f3a5f', accent: '#c9a227' };

/** The logo's two colours, read in the browser from the picked file (the club's own Look panel reads them the same way). */
function useFileColours(file: File | null): { primary: string; accent: string } | null {
  const [read, setRead] = useState<{ file: File; colours: { primary: string; accent: string } | null } | null>(null);
  useEffect(() => {
    if (!file) return;
    let stale = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const n = 64;
        const canvas = document.createElement('canvas');
        canvas.width = n;
        canvas.height = n;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        if (!g) throw new Error('no canvas');
        g.drawImage(img, 0, 0, n, n);
        const picked = pickLogoColours(g.getImageData(0, 0, n, n).data);
        if (!stale) setRead({ file, colours: picked ? { primary: picked.primary, accent: picked.accent } : null });
      } catch {
        if (!stale) setRead({ file, colours: null });
      }
    };
    img.onerror = () => { if (!stale) setRead({ file, colours: null }); };
    img.src = url;
    return () => { stale = true; URL.revokeObjectURL(url); };
  }, [file]);
  return file && read?.file === file ? read.colours : null;
}

const FIELD_ORDER: MakeField[] = ['name', 'slug', 'sport', 'province', 'logo', 'source', 'primary', 'accent', 'line', 'meeting'];

export default function MakeClubWindow({ onClose, onMade }: {
  onClose: () => void;
  onMade: (made: { name: string; slug: string; orgId: string }) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugOpen, setSlugOpen] = useState(false);
  const [sport, setSport] = useState('');
  const [province, setProvince] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [coloursOpen, setColoursOpen] = useState(false);
  const [own, setOwn] = useState<{ primary: string; accent: string } | null>(null);
  const [line, setLine] = useState('');
  const [meeting, setMeeting] = useState('');
  const [errors, setErrors] = useState<MakeErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cap, setCap] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const fromLogo = useFileColours(logo);
  const colours = own ?? fromLogo ?? FALLBACK;
  const address = slugOpen ? slug : suggestedSlug(name);
  const [date, time] = meeting.split('T');
  const meetingAt = useMemo(() => zonedWallClockToUtc(date, time), [date, time]);
  const dirty = !!(name || logo || source || line || meeting);

  const input = {
    name, slug: address, sport, province, logo: logo ? { type: logo.type, size: logo.size } : null, source,
    primary: colours.primary, accent: colours.accent, line, meeting, meetingAt,
  };

  /** The field's error, under it; aria wired so a screen reader reads it with the field. */
  const errorFor = (field: MakeField) => errors[field]
    ? <DialogReason inPlace className={kit.fieldError}><span id={`pc-${field}-error`}>{errors[field]}</span></DialogReason>
    : null;
  const aria = (field: MakeField) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `pc-${field}-error` : undefined,
  });
  const clear = (field: MakeField) => {
    setFailed(false);
    if (errors[field]) setErrors(e => { const next = { ...e }; delete next[field]; return next; });
  };

  function focusFirst(found: MakeErrors) {
    const first = FIELD_ORDER.find(f => found[f]);
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = makeFieldErrors(input);
    if (found.slug && !slugOpen) setSlugOpen(true);
    if (Object.keys(found).length > 0) { setErrors(found); focusFirst(found); return; }
    setBusy(true);
    setFailed(false);
    const body = new FormData();
    body.set('name', name.trim());
    body.set('slug', address);
    body.set('sport', sport);
    body.set('province', province);
    body.set('logo', logo!);
    body.set('source', source.trim());
    body.set('primary', colours.primary);
    body.set('accent', colours.accent);
    body.set('line', line.trim());
    body.set('meeting', meeting);
    try {
      const res = await fetch('/api/platform-admin/prospect-clubs', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.slug) { onMade({ name: name.trim(), slug: json.slug, orgId: json.orgId }); return; }
      if (res.status === 400 && json.fieldErrors) {
        const fe = json.fieldErrors as MakeErrors;
        if (fe.slug) setSlugOpen(true);
        setErrors(fe);
        focusFirst(fe);
      } else if (res.status === 409 && json.cap) {
        setErrors({});
        setFailed(false);
        setCap(true);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const removal = meetingAt && !errors.meeting ? removalDateLabel(meetingAt, true) : null;

  // Five opened while this window was up (the route's 409): the window becomes the drawing's close-only cap window.
  if (cap) {
    return (
      <KitDialog kind="question" title={MAKE_WORDS.capTitle} onClose={onClose}
        footer={<DialogCancel className="btn btn-primary">Close</DialogCancel>}>
        <p>{MAKE_WORDS.cap}</p>
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="form" title={MAKE_WORDS.title} onClose={onClose} busy={busy} dirty={dirty && !busy}
      footerStart={MAKE_WORDS.youGet}
      footer={<>
        <DialogCancel />
        <button type="submit" form="pc-make" className="btn btn-primary" disabled={busy}>
          {busy ? MAKE_WORDS.making : MAKE_WORDS.submit}
        </button>
      </>}>
      {failed && <DialogReason className={kit.fieldError}>{MAKE_WORDS.failed}</DialogReason>}
      {busy && <p className={styles.making} role="status">{MAKE_WORDS.makingLine(name.trim())}</p>}
      <form ref={formRef} id="pc-make" className={styles.form} onSubmit={submit} hidden={busy} noValidate>
        <label className={kit.fieldGroup}>
          <span className={kit.label}>Club name *</span>
          <input data-field="name" className={kit.field} value={name} maxLength={PREVIEW_NAME_MAX + 20} autoComplete="off"
            onChange={e => { setName(e.target.value); clear('name'); clear('slug'); }} {...aria('name')} />
          {errorFor('name')}
        </label>

        <div className={kit.fieldGroup}>
          {slugOpen ? (
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Web address</span>
              <span className={styles.address}>
                <span className={styles.addressHost}>fieldlogichq.ca/</span>
                <input data-field="slug" className={kit.field} value={slug} maxLength={60} autoComplete="off"
                  onChange={e => { setSlug(e.target.value.toLowerCase()); clear('slug'); }} {...aria('slug')} />
              </span>
            </label>
          ) : (
            <p className={kit.hint}>
              Web address: fieldlogichq.ca/{address || '…'} ·{' '}
              <button type="button" data-field="slug" className={`${kit.door} ${styles.change}`} onClick={() => { setSlug(address); setSlugOpen(true); }}>Change</button>
              . {MAKE_WORDS.addressHint}
            </p>
          )}
          {errorFor('slug')}
        </div>

        <div className={styles.pair}>
          <label className={kit.fieldGroup}>
            <span className={kit.label}>Sport *</span>
            <select data-field="sport" className={kit.select} value={sport} onChange={e => { setSport(e.target.value); clear('sport'); }} {...aria('sport')}>
              <option value="">Pick one</option>
              {PREVIEW_SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {errorFor('sport')}
          </label>
          <label className={kit.fieldGroup}>
            <span className={kit.label}>Province *</span>
            <select data-field="province" className={kit.select} value={province} onChange={e => { setProvince(e.target.value); clear('province'); }} {...aria('province')}>
              <option value="">Pick one</option>
              {PREVIEW_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
            {errorFor('province')}
          </label>
        </div>

        {/* The browser's grey "Choose File" is hidden: the portal's button opens the picker, the chosen name beside it.
            A group, not a <label>, so the button keeps its own name; a refused logo puts focus on the button. */}
        <div className={kit.fieldGroup} role="group" aria-labelledby="pc-logo-label">
          <span className={kit.label} id="pc-logo-label">Logo *</span>
          <input ref={logoInput} type="file" accept={PREVIEW_LOGO_TYPES.join(',')} hidden
            onChange={e => { setLogo(e.target.files?.[0] ?? null); setOwn(null); clear('logo'); }} />
          <div className={styles.fileRow}>
            <button type="button" data-field="logo" className="btn btn-secondary btn-sm" onClick={() => logoInput.current?.click()}
              aria-describedby={errors.logo ? 'pc-logo-file pc-logo-error' : 'pc-logo-file'}>
              <Upload size={14} aria-hidden /> {logo ? 'Change file' : 'Choose file'}
            </button>
            <span id="pc-logo-file" className={logo ? styles.fileName : styles.fileNone} aria-live="polite">
              {logo ? logo.name : 'No file chosen'}
            </span>
          </div>
          {errorFor('logo')}
        </div>

        <label className={kit.fieldGroup}>
          <span className={kit.label}>Where the club published this logo *</span>
          <input data-field="source" type="url" inputMode="url" className={kit.field} value={source} placeholder="https://"
            onChange={e => { setSource(e.target.value); clear('source'); }} {...aria('source')} />
          <span className={kit.hint}>{MAKE_WORDS.sourceHint}</span>
          {errorFor('source')}
        </label>

        <div className={kit.fieldGroup}>
          <p className={styles.colourLine}>
            <span className={styles.swatch} style={{ background: colours.primary }} aria-hidden />
            <span className={styles.swatch} style={{ background: colours.accent }} aria-hidden />
            <span>{own ? 'Colours' : fromLogo ? 'Colours from the logo' : 'Colours'}</span> ·{' '}
            <button type="button" className={`${kit.door} ${styles.change}`} onClick={() => { setOwn(colours); setColoursOpen(o => !o); }}>Change</button>
          </p>
          {coloursOpen && (
            <div className={styles.pair}>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Main colour</span>
                <input data-field="primary" type="color" className={styles.colour} value={colours.primary}
                  onChange={e => { setOwn({ ...colours, primary: e.target.value }); clear('primary'); }} />
              </label>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Second colour</span>
                <input data-field="accent" type="color" className={styles.colour} value={colours.accent}
                  onChange={e => { setOwn({ ...colours, accent: e.target.value }); clear('accent'); }} />
              </label>
            </div>
          )}
        </div>

        <label className={kit.fieldGroup}>
          <span className={kit.label}>One line about the club</span>
          <input data-field="line" className={kit.field} value={line} maxLength={PREVIEW_LINE_MAX + 20} autoComplete="off"
            onChange={e => { setLine(e.target.value); clear('line'); }} {...aria('line')} />
          <span className={kit.hint}>{MAKE_WORDS.lineHint}</span>
          {errorFor('line')}
        </label>

        <div className={kit.fieldGroup} data-field="meeting" tabIndex={-1} role="group" aria-labelledby="pc-meeting-label" {...aria('meeting')}>
          <span className={kit.label} id="pc-meeting-label">Meeting *</span>
          <DateTimeInput aria-label="Meeting" className={kit.field} value={meeting} onChange={v => { setMeeting(v); clear('meeting'); }} />
          <span className={kit.hint}>{MAKE_WORDS.meetingHint}</span>
          {errorFor('meeting')}
        </div>

        <div className={styles.holds}>
          <strong>{MAKE_WORDS.holdsTitle}</strong>
          <span>{MAKE_WORDS.holds}</span>
          <span>{MAKE_WORDS.live}</span>
          {removal && <span>{MAKE_WORDS.removal(removal)}</span>}
        </div>
      </form>
    </KitDialog>
  );
}
