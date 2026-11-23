'use client';
/**
 * A SPONSOR (Board Ready Stage 6, Part 1; round 1 tab 8). The shipped sponsor window — Name, Logo, Link, Last day — with
 * one new field, "Shows on", the same pick list a deal uses (the club by default, a division, a team, a tournament), and
 * "+ Show it somewhere else too". A new sponsor is a create window (Cancel · Add sponsor); an existing one reads first and
 * saves as you go. A place that came from a deal is the deal's: it shows its deal and can't be changed here, and Remove
 * isn't offered while a deal shows the sponsor.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { ClubRow, ClubRowList, SavePill } from '../RepKit';
import ck from '../ClubKit.module.css';
import SponsorLogoField from '@/app/[orgSlug]/admin/public-site/SponsorLogoField';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { formatStoredDate } from '@/lib/timezone';
import { sponsorHasDeal, type ClubSponsor } from '@/lib/club-sponsorships';
import { send, sponsorshipsApi, type PlaceTargets, type SponsorDeal } from './api';
import { placeFromKey, placeKey, placeName, placeOptions } from './places';
import DateInput from '@/components/shared/DateInput';
import css from './Sponsorships.module.css';

interface TypedRow { key: number; id?: string; place: string; endsOn: string }
const day = (d: string) => formatStoredDate(d, { withYear: true });

export default function SponsorWindow({ slug, sponsor, targets, deals = [], onChanged, onClose }: {
  slug: string;
  sponsor: ClubSponsor | null;
  targets: PlaceTargets;
  /** Its deals (Part 2): the "From the deal" line names the deal's package and invoice, and its Deal door opens it. */
  deals?: SponsorDeal[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const creating = sponsor === null;
  const typedOf = (s: ClubSponsor | null): TypedRow[] => (s
    ? s.places.filter(p => p.source === 'typed').map((p, i) => ({ key: i + 1, id: p.id, place: placeKey(p), endsOn: p.endsOn ?? '' }))
    : [{ key: 1, place: 'club', endsOn: '' }]);
  const [name, setName] = useState(sponsor?.name ?? '');
  const [link, setLink] = useState(sponsor?.link ?? '');
  const [logo, setLogo] = useState(sponsor?.logoUrl ?? '');
  const [rows, setRows] = useState<TypedRow[]>(() => typedOf(sponsor));
  const [saved, setSaved] = useState(() => JSON.stringify({ name: sponsor?.name ?? '', link: sponsor?.link ?? '', logo: sponsor?.logoUrl ?? '', rows: typedOf(sponsor) }));
  const [editing, setEditing] = useState(creating);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const dealPlaces = sponsor?.places.filter(p => p.source === 'deal') ?? [];
  // A business with any deal stays (its offers and invoices are on record), withdrawn deals too (Part 2).
  const keeps = !!sponsor && (sponsorHasDeal(sponsor) || deals.length > 0);
  /** "From the deal · Division sponsor, invoice 2027-014. Change the place or the last day on the deal." */
  const fromDeal = (dealId: string | null) => {
    const d = deals.find(x => x.id === dealId);
    return d ? W.sponsor.fromDeal(d.packageName, d.invoice) : W.sponsor.fromDealShort;
  };
  const dealDoor = (dealId: string | null) => (dealId
    ? <Link className={ck.link} href={`/${slug}/admin/sponsorships/${dealId}`}>{W.sponsor.dealDoor}</Link>
    : undefined);
  const current = (n = name, l = link, g = logo, r = rows) => JSON.stringify({ name: n, link: l, logo: g, rows: r });
  const dirty = current() !== saved;
  const options = placeOptions(targets, rows.map(r => r.place));

  const body = (n: string, l: string, g: string, r: TypedRow[]) => ({
    name: n, link: l, logoUrl: g || null,
    places: r.map(x => ({ ...(x.id ? { id: x.id } : {}), ...placeFromKey(x.place), endsOn: x.endsOn || null })),
  });

  async function persist(n = name, l = link, g = logo, r = rows) {
    if (creating) return;
    if (current(n, l, g, r) === saved) return;
    setBusy(true); setError(null);
    const res = await send<{ sponsor: ClubSponsor | null }>(sponsorshipsApi(slug, `/sponsors/${sponsor!.id}`), 'PATCH', body(n, l, g, r));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    // Rows the window added get the ids the server gave them, so a later save updates them instead of re-making them.
    const typed = res.data.sponsor?.places.filter(p => p.source === 'typed') ?? [];
    const keyed = r.map(x => (x.id ? x : { ...x, id: typed.find(p => placeKey(p) === x.place && !r.some(o => o.id === p.id))?.id }));
    setRows(keyed);
    setSaved(current(n, l, g, keyed));
    onChanged();
  }

  async function create() {
    setError(null);
    if (!name.trim()) { setError(W.sponsor.errName); return; }
    setBusy(true);
    const res = await send(sponsorshipsApi(slug, '/sponsors'), 'POST', body(name, link, logo, rows));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    // Any logo uploaded and then replaced before Add is thrown away (the saved one is kept).
    for (const u of uploaded.filter(u => u !== logo)) void send(sponsorshipsApi(slug, '/sponsors/logo'), 'DELETE', { logoUrl: u });
    onChanged();
    onClose();
  }
  function close() {
    // A cancelled new sponsor leaves no file behind.
    if (creating) for (const u of uploaded) void send(sponsorshipsApi(slug, '/sponsors/logo'), 'DELETE', { logoUrl: u });
    onClose();
  }
  async function upload(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await send<{ logoUrl: string }>(sponsorshipsApi(slug, '/sponsors/logo'), 'POST', fd);
    if (!res.ok) throw new Error(res.error);
    setUploaded(u => [...u, res.data.logoUrl]);
    return res.data.logoUrl;
  }
  async function remove() {
    setBusy(true);
    const res = await send(sponsorshipsApi(slug, `/sponsors/${sponsor!.id}`), 'DELETE');
    setBusy(false);
    if (!res.ok) { setError(res.error); setRemoving(false); return; }
    onChanged();
    onClose();
  }

  const setRow = (key: number, patch: Partial<TypedRow>, save = false) => {
    const next = rows.map(r => (r.key === key ? { ...r, ...patch } : r));
    setRows(next);
    if (save) void persist(name, link, logo, next);
  };
  const dropRow = (key: number) => { const next = rows.filter(r => r.key !== key); setRows(next); void persist(name, link, logo, next); };
  const addRow = () => setRows(r => [...r, { key: Math.max(0, ...r.map(x => x.key)) + 1, place: 'club', endsOn: '' }]);

  const placeSelect = (r: TypedRow) => (
    <select id={`sp-place-${r.key}`} className={ck.select} value={r.place} onChange={e => setRow(r.key, { place: e.target.value }, true)}>
      <option value="club">The club</option>
      {options.divisions.length > 0 && <optgroup label="Divisions">{options.divisions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>}
      {options.teams.length > 0 && <optgroup label="Teams">{options.teams.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>}
      {options.tournaments.length > 0 && <optgroup label="Tournaments">{options.tournaments.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>}
    </select>
  );

  const dealRows = dealPlaces.length > 0 && (
    <ClubRowList inset label={W.sponsor.showsOn}>
      {dealPlaces.map(p => (
        <ClubRow key={p.id} title={`${placeName(p, targets)} · ${p.endsOn ? W.sponsors.until(day(p.endsOn)) : W.sponsors.noLastDay}`}
          caption={fromDeal(p.dealId)} trail={dealDoor(p.dealId)} />
      ))}
    </ClubRowList>
  );

  const fields = (
    <div className={css.form}>
      <div className={ck.field}>
        <label className={ck.label} htmlFor="sp-name">{W.sponsor.name} <span className={ck.required} aria-hidden>*</span></label>
        <input id="sp-name" className={ck.input} maxLength={80} value={name} placeholder={W.sponsor.namePlaceholder} required
          onChange={e => setName(e.target.value)} onBlur={() => void persist()} />
      </div>
      <SponsorLogoField label={W.sponsor.logo} value={logo} canWrite upload={upload} onBusy={setLogoBusy}
        onChange={url => { setLogo(url); void persist(name, link, url, rows); }} />
      <div className={ck.field}>
        <label className={ck.label} htmlFor="sp-link">{W.sponsor.link}</label>
        <input id="sp-link" className={ck.input} type="url" maxLength={500} value={link} placeholder={W.sponsor.linkPlaceholder}
          onChange={e => setLink(e.target.value)} onBlur={() => void persist()} />
      </div>
      {dealRows}
      {rows.map(r => (
        <div key={r.key} className={css.placeRow}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor={`sp-place-${r.key}`}>{W.sponsor.showsOn}</label>
            {placeSelect(r)}
          </div>
          <div className={ck.field}>
            <label className={ck.label} htmlFor={`sp-end-${r.key}`}>{W.sponsor.lastDay}</label>
            <DateInput id={`sp-end-${r.key}`} className={ck.input} value={r.endsOn}
              onChange={v => setRow(r.key, { endsOn: v }, true)} />
          </div>
          {(rows.length > 1 || dealPlaces.length > 0) && (
            <button type="button" className={css.iconBtn} aria-label={W.sponsor.removePlace} onClick={() => dropRow(r.key)}><X size={16} aria-hidden /></button>
          )}
        </div>
      ))}
      <p className={ck.hint}>{W.sponsor.lastDayHint}</p>
      <div>
        <button type="button" className={css.linkButton} onClick={addRow}><Plus size={14} aria-hidden />{W.sponsor.showElsewhere}</button>
      </div>
      {error && <p className={css.error} role="alert">{error}</p>}
      {!creating && (
        <div className={css.rareDoor}>
          {keeps
            ? <p className={ck.hint}>{W.sponsor.noRemoveDeals}</p>
            : <button type="button" className={css.dangerLink} onClick={() => setRemoving(true)}><X size={14} aria-hidden />{W.sponsor.remove}</button>}
        </div>
      )}
    </div>
  );

  const read = sponsor && (
    <>
      <dl className={css.facts}>
        <dt>{W.sponsor.logo}</dt>
        <dd>{sponsor.logoUrl
          ? <span className={css.thumb}><img src={sponsor.logoUrl} alt={sponsor.name} /></span>
          : <span className={`${css.thumb} ${css.thumbNone}`}>{W.sponsors.noLogo}</span>}</dd>
        <dt>{W.sponsor.link}</dt>
        <dd>{sponsor.link ?? '—'}</dd>
      </dl>
      <h3 className={css.sectionHeading}>{W.sponsor.showsOn}</h3>
      {sponsor.places.length === 0 ? <p className={ck.hint}>{W.sponsors.shownNowhere}</p> : (
        <ClubRowList inset label={W.sponsor.showsOn}>
          {sponsor.places.map(p => (
            <ClubRow key={p.id} title={`${placeName(p, targets)} · ${p.endsOn ? W.sponsors.until(day(p.endsOn)) : W.sponsors.noLastDay}`}
              caption={p.source === 'deal' ? fromDeal(p.dealId) : undefined} trail={p.source === 'deal' ? dealDoor(p.dealId) : undefined} />
          ))}
        </ClubRowList>
      )}
      {keeps && <p className={ck.hint}>{W.sponsor.noRemoveDeals}</p>}
    </>
  );

  return (
    <>
      <KitDialog kind="form" size="medium" onClose={close} busy={busy || logoBusy} dirty={creating && (!!name.trim() || !!logo || !!link)}
        eyebrow={W.sponsor.eyebrow} title={creating ? W.sponsor.addTitle : sponsor!.name} record={!creating}
        edit={creating ? undefined : { editing, label: editing ? W.pkg.done : W.sponsor.edit, disabled: busy || logoBusy, onToggle: () => { if (editing && error) return; void persist(); setEditing(e => !e); } }}
        status={!creating && editing ? <SavePill inline saving={busy} dirty={dirty} error={error} onRetry={() => void persist()} /> : undefined}
        footer={creating ? (
          <>
            <DialogCancel />
            <button type="button" className="btn btn-lime" disabled={busy || logoBusy} onClick={() => void create()}>{W.sponsor.addButton}</button>
          </>
        ) : undefined}>
        {editing ? fields : read}
      </KitDialog>
      {removing && sponsor && (
        <KitDialog kind="question" raised busy={busy} onClose={() => setRemoving(false)} title={W.sponsor.removeAsk(sponsor.name)}
          footer={(
            <>
              <DialogCancel />
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove()}>{W.sponsor.removeButton}</button>
            </>
          )}>
          <p className={ck.hint}>{W.sponsor.removeBody}</p>
        </KitDialog>
      )}
    </>
  );
}
