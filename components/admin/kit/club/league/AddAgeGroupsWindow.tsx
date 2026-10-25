'use client';
import { useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { BornYearsBoxes } from '../BornYears';
import { checkBornYears, cutoffWords, isJan1, type BornYears, type Cutoff } from '@/lib/born-years';
import type { LeagueCapKind } from '@/lib/free-floor';
import {
  EVEN_AGES, ODD_AGES, ageGroupsFoot, ageGroupsWarnings, ageLabel, detectNameStyle, isOddAge, nextGroupName, parseAgeName, restyleName,
  type AgeGroupRow, type NameStyle,
} from '@/lib/house-league-age-groups';
import s from './LeagueSeason.module.css';

/** The last name style someone picked on this device: the fallback for a season with no divisions to read it from. */
const STYLE_KEY = 'fl-age-group-name-style';
/** Every column is needed before Add: name, birth years, size and price ($0 is a price). The foot says which row is short. */
const req = <span className={ck.required} aria-hidden>*</span>;
const readStyle = (): NameStyle | null => {
  try {
    const v = window.localStorage.getItem(STYLE_KEY);
    return v === 'pre' || v === 'suf' ? v : null;
  } catch { return null; }
};

/**
 * ADD AGE GROUPS (Club Tier Stage 9b-1, Part 2; Q19; drawing "Your two questions", words HOUSE_LEAGUE_STAGE9B1_COPY.md §3;
 * reworked 2026-10-25 from the owner's drawing docs/projects/active/ADD_AGE_GROUPS_CHIPS_MOCKUP.html).
 * The season's create door for divisions: tap the groups you run (or type a name), give each its birth years, size and
 * price, and Add — one request, all or none. Birth years start BLANK (the 4c-2 ruling: the club picks, never a guess from
 * "U13"); size and price start from the season.
 *  · A chip is a TOGGLE: a ticked chip takes its row off. A second division for one age is the + on the row (U10 B).
 *  · The name style (U12 or 12U) is a two-word switch; it renames the rows the person has not typed over. It starts from
 *    what the season's divisions already use, else the last pick on this device. The odd ages sit behind "More ages".
 *  · A division is ONE line at a desk (column names once, pinned above the list); a phone keeps its labels and two lines.
 * Gaps and overlaps are said, never blocking. Full screen on a phone (KitDialog's form).
 */
export default function AddAgeGroupsWindow({ orgSlug, seasonId, seasonName, sport, cutoff, existing, defaultSize, defaultPrice, hasEarlyDate, onClose, onAdded, onCapHit }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  sport: string;
  cutoff: Cutoff;
  /** The season has its early-bird date. Without one an early amount saves but never applies, and the window says so. */
  hasEarlyDate: boolean;
  /** The season's divisions now: names (to mark a group already there) and birth years (for gaps and overlaps). */
  existing: { name: string; born: BornYears }[];
  defaultSize: number | null;
  defaultPrice: number | null;
  onClose: () => void;
  onAdded: () => void;
  onCapHit: (kind: LeagueCapKind) => void;
}) {
  const [rows, setRows] = useState<AgeGroupRow[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [style, setStyle] = useState<NameStyle>(() => detectNameStyle(existing.map(e => e.name)) ?? readStyle() ?? 'pre');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const thisYear = new Date().getFullYear();

  // Names already taken, written in the current style, so a season's "U12" makes the next 12U a "12U B".
  const taken = [...existing.map(e => restyleName(e.name, style)), ...rows.map(r => restyleName(r.name, style))];
  const hadOf = (age: number) => existing.filter(e => parseAgeName(e.name)?.age === age).length;
  const rowsOf = (age: number) => rows.filter(r => r.age === age);
  const fresh = (group: string, patch: Partial<AgeGroupRow>): AgeGroupRow => {
    const name = nextGroupName(group, taken);
    return {
      key: `row-${++seq.current}`, group, name, from: '', to: '',
      capacity: defaultSize != null ? String(defaultSize) : '', price: defaultPrice != null ? String(defaultPrice) : '', earlyPrice: '',
      ...patch,
    };
  };
  const addAge = (age: number, after?: number) => {
    const row = fresh(ageLabel(age, style), { age });
    setRows(rs => {
      if (after == null) return [...rs, row];
      const next = [...rs];
      next.splice(after + 1, 0, row);
      return next;
    });
  };
  // A typed name that is just an age ("12U", "u13") is that age's chip pressed: it follows the name style and takes the next
  // letter when the age is already there, so it can never sit beside a "U12" as a second, differently written division.
  const addTyped = (name: string) => {
    const p = parseAgeName(name);
    if (p && !p.letter) { addAge(p.age); return; }
    setRows(rs => [...rs, fresh(name, { typed: true })]);
  };
  /** A chip: on takes the newest of its rows off, off adds the first. */
  const toggleAge = (age: number) => {
    const mine = rowsOf(age);
    if (mine.length === 0) { addAge(age); return; }
    const last = mine[mine.length - 1].key;
    setRows(rs => rs.filter(r => r.key !== last));
  };
  const pickStyle = (next: NameStyle) => {
    setStyle(next);
    try { window.localStorage.setItem(STYLE_KEY, next); } catch { /* a private window keeps it for this window only */ }
    // Only the rows made by a chip and left alone follow the switch; a name someone typed stays as typed.
    setRows(rs => rs.map(r => (r.age != null && !r.typed ? { ...r, name: restyleName(r.name, next), group: ageLabel(r.age, next) } : r)));
  };
  const update = (key: string, patch: Partial<AgeGroupRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const foot = ageGroupsFoot(rows, cutoff, thisYear, existing.map(e => e.name));
  const warnings = ageGroupsWarnings(rows, existing, cutoff, thisYear);
  const ready = rows.length > 0 && foot.missing == null;

  // The odd ages open on request, and stay open while one is ticked or already in the season: a ticked chip is never hidden.
  const oddPinned = rows.some(r => r.age != null && isOddAge(r.age)) || existing.some(e => { const p = parseAgeName(e.name); return p != null && isOddAge(p.age); });
  const showOdd = more || oddPinned;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/divisions?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisions: rows.map(r => {
            const born = checkBornYears(r.from, r.to, cutoff, thisYear);
            return {
              name: r.name.trim(), capacity: parseInt(r.capacity, 10),
              bornFromYear: born.ok ? born.years.from : null, bornToYear: born.ok ? born.years.to : null,
              price: Number(r.price),
              earlyPrice: r.earlyPrice?.trim() ? Number(r.earlyPrice) : null,
            };
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        if (data.capHit) { onCapHit(data.capHit); return; }
        setError(data.error ?? 'We couldn’t add the divisions. Try again.');
        return;
      }
      onAdded();
    } catch {
      setBusy(false);
      setError('We couldn’t add the divisions. Try again.');
    }
  }

  const footText = (
    <span>
      <span className={s.deskOnly}>{foot.desk}</span>
      <span className={s.phoneOnly}>{foot.phone}</span>
    </span>
  );

  const ageChip = (age: number) => {
    const label = ageLabel(age, style);
    const n = rowsOf(age).length;
    const had = hadOf(age);
    return (
      <button key={age} type="button" className={s.chip} aria-pressed={n > 0} onClick={() => toggleAge(age)}
        aria-label={n > 1 ? `${label}, ${n} divisions` : undefined}>
        {label}{n > 1 && ` ×${n}`}{n > 0 && <Check size={13} aria-hidden />}
        {had > 0 && <span className={s.chipHad}>
          <span className={s.deskOnly}>{had === 1 ? ' · already' : ` · ${had} already`}</span>
          <span className={s.phoneOnly}>{had === 1 ? '' : ` · ${had}`}</span>
        </span>}
      </button>
    );
  };

  return (
    <KitDialog
      kind="form"
      size="wide"
      title={<><span className={s.deskOnly}>Add age groups to {seasonName}</span><span className={s.phoneOnly}>Add age groups</span></>}
      onClose={onClose}
      busy={busy}
      dirty={rows.length > 0}
      footerStart={footText}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={submit} disabled={!ready || busy}>
            {busy ? 'Adding…' : (
              <>
                <span className={s.deskOnly}>{rows.length === 1 ? 'Add 1 division' : `Add ${rows.length} divisions`}</span>
                <span className={s.phoneOnly}>{`Add ${rows.length}`}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <p className={`${s.windowName} ${s.phoneOnly}`}>{seasonName}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <div className={s.leadRow}>
        <p className={repKit.lead}>Tap the groups you run, or type your own name. Each becomes a division with its own birth years, size and price.</p>
        <div className={s.seg} role="group" aria-label="Name style">
          <button type="button" aria-pressed={style === 'pre'} onClick={() => pickStyle('pre')}>U12</button>
          <button type="button" aria-pressed={style === 'suf'} onClick={() => pickStyle('suf')}>12U</button>
        </div>
      </div>

      <div className={s.chips}>
        {EVEN_AGES.map(ageChip)}
        {typing == null ? (
          <button type="button" className={s.chip} onClick={() => setTyping('')}>
            <Plus size={13} aria-hidden /><span className={s.deskOnly}>Type a name</span><span className={s.phoneOnly}>Name</span>
          </button>
        ) : (
          <span className={s.chipType}>
            <input className={ck.input} value={typing} maxLength={100} placeholder="Age group name" aria-label="Age group name" autoFocus
              onChange={e => setTyping(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && typing.trim()) { e.preventDefault(); addTyped(typing.trim()); setTyping(null); } }} />
            <button type="button" className="btn btn-outline" disabled={!typing.trim()} onClick={() => { addTyped(typing.trim()); setTyping(null); }}>Add</button>
          </span>
        )}
        {/* Absent, not disabled, while an odd age holds the line open. */}
        {!oddPinned && (
          <button type="button" className={`${s.chip} ${s.chipMore}`} aria-expanded={showOdd} onClick={() => setMore(m => !m)}>
            {showOdd ? 'Fewer ages' : 'More ages'}{showOdd ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
          </button>
        )}
      </div>
      {showOdd && <div className={s.chips}>{ODD_AGES.map(ageChip)}</div>}

      {rows.length > 0 && (
        <div className={s.groupRows}>
          <div className={s.groupHead} aria-hidden>
            <span>Division{req}</span><span>Born in{req}</span><span>Players it holds{req}</span><span>Price{req}</span><span>Early bird</span><span />
          </div>
          {rows.map((r, i) => {
            const born = checkBornYears(r.from, r.to, cutoff, thisYear);
            const yearsBlank = !r.from.trim() && !r.to.trim();
            const lastOfAge = r.age != null && rows.map(x => x.age).lastIndexOf(r.age) === i;
            const more1 = r.age != null ? `Add another ${ageLabel(r.age, style)}` : '';
            return (
              <div key={r.key} className={s.groupRow}>
                <label className={`${ck.field} ${s.cell}`}>
                  <span className={`${ck.label} ${s.rowLabel}`}>Division{req}</span>
                  <input className={ck.input} value={r.name} maxLength={100} onChange={e => update(r.key, { name: e.target.value, typed: true })} />
                </label>
                <div className={`${ck.field} ${s.cell} ${s.bornCell}`}>
                  <span className={`${ck.label} ${s.rowLabel}`} aria-hidden>Born in{req}</span>
                  <div role="group" aria-label={`Born in, ${r.name || r.group}`}>
                    <BornYearsBoxes from={r.from} to={r.to} cutoff={cutoff} held={!yearsBlank && !born.ok}
                      onFrom={v => update(r.key, { from: v })} onTo={v => update(r.key, { to: v })} />
                  </div>
                  {!yearsBlank && !born.ok ? <span className={s.amberText} role="alert">{born.held}</span> : null}
                </div>
                <label className={`${ck.field} ${s.cell}`}>
                  <span className={`${ck.label} ${s.rowLabel}`}>Players it holds{req}</span>
                  <input className={ck.input} type="number" min="1" step="1" inputMode="numeric" value={r.capacity} aria-label={`Players it holds, ${r.name || r.group}`}
                    onChange={e => update(r.key, { capacity: e.target.value })} />
                </label>
                <label className={`${ck.field} ${s.cell}`}>
                  <span className={`${ck.label} ${s.rowLabel}`}>Price{req}</span>
                  <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={r.price} aria-label={`Price, ${r.name || r.group}`}
                    onChange={e => update(r.key, { price: e.target.value })} />
                </label>
                <label className={`${ck.field} ${s.cell}`}>
                  <span className={`${ck.label} ${s.rowLabel}`}>Early bird</span>
                  <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={r.earlyPrice ?? ''} aria-label={`Early bird, ${r.name || r.group}`}
                    onChange={e => update(r.key, { earlyPrice: e.target.value })} />
                </label>
                <div className={s.rowActs}>
                  {lastOfAge && (
                    <button type="button" className={s.rowIcon} aria-label={more1} title={more1} onClick={() => addAge(r.age as number, i)}>
                      <Plus size={16} aria-hidden />
                    </button>
                  )}
                  <button type="button" className={s.rowIcon} aria-label={`Remove ${r.name || r.group}`}
                    onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {warnings.map(w => <p key={w} className={s.amberText}>{w}</p>)}
      {!hasEarlyDate && rows.some(r => r.earlyPrice?.trim()) && (
        <p className={s.amberText}>The season has no early-bird date yet, so an early-bird amount never takes effect. Set the date under Registration.</p>
      )}

      <ul className={s.hints}>
        {!isJan1(cutoff) && <li>Birthdays count from {cutoffWords(cutoff, 'short')} for {sport.toLowerCase()}, the club’s cut-off.</li>}
        <li>The birth years are yours to pick. We don’t guess them from the name.</li>
        <li>An early-bird amount is optional. It applies to sign-ups through the season’s early-bird date.</li>
        <li>To run two divisions for one age group, such as {ageLabel(10, style)} and {ageLabel(10, style)} B, tap the + on its row.</li>
      </ul>
    </KitDialog>
  );
}
