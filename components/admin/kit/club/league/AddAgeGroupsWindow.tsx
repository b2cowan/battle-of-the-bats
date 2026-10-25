'use client';
import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { BornYearsBoxes } from '../BornYears';
import { checkBornYears, cutoffWords, isJan1, type BornYears, type Cutoff } from '@/lib/born-years';
import type { LeagueCapKind } from '@/lib/free-floor';
import { ageGroupsFoot, ageGroupsWarnings, nextGroupName, type AgeGroupRow } from '@/lib/house-league-age-groups';
import s from './LeagueSeason.module.css';

/** The age groups a house league usually runs, in order. Anything else is typed. */
const GROUPS = ['U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18'] as const;

/**
 * ADD AGE GROUPS (Club Tier Stage 9b-1, Part 2; Q19; drawing "Your two questions", words HOUSE_LEAGUE_STAGE9B1_COPY.md §3).
 * The season's create door for divisions: tap the groups you run (or type a name), give each its birth years, size and
 * price, and Add — one request, all or none. Birth years start BLANK (the 4c-2 ruling: the club picks, never a guess from
 * "U13"); size and price start from the season. A group the season already has adds another division for that age, named
 * with the next letter (U10 B), so a family can tell the two apart. Gaps and overlaps are said, never blocking. Full
 * screen on a phone (KitDialog's form).
 */
export default function AddAgeGroupsWindow({ orgSlug, seasonId, seasonName, sport, cutoff, existing, defaultSize, defaultPrice, onClose, onAdded, onCapHit }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  sport: string;
  cutoff: Cutoff;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thisYear = new Date().getFullYear();

  const names = [...existing.map(e => e.name), ...rows.map(r => r.name)];
  const countOf = (group: string) => existing.filter(e => e.name.trim().toLowerCase().replace(/\s+[a-z]$/i, '') === group.toLowerCase()).length;
  const add = (group: string) => {
    const name = nextGroupName(group, names);
    setRows(rs => [...rs, {
      key: `${name}-${Date.now()}`, group, name, from: '', to: '',
      capacity: defaultSize != null ? String(defaultSize) : '', price: defaultPrice != null ? String(defaultPrice) : '',
    }]);
  };
  const update = (key: string, patch: Partial<AgeGroupRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const foot = ageGroupsFoot(rows, cutoff, thisYear, existing.map(e => e.name));
  const warnings = ageGroupsWarnings(rows, existing, cutoff, thisYear);
  const ready = rows.length > 0 && foot.missing == null;

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
      <p className={repKit.lead}>Tap the groups you run, or type your own name. Each becomes a division with its own birth years, size and price.</p>

      <div className={s.chips}>
        {GROUPS.map(g => {
          const had = countOf(g);
          const picked = rows.some(r => r.group === g);
          return (
            <button key={g} type="button" className={s.chip} aria-pressed={picked} onClick={() => add(g)}
              aria-label={picked ? `${g}, selected` : undefined}>
              {g}{picked && <Check size={13} aria-hidden />}
              {had > 0 && <span className={s.chipHad}>
                <span className={s.deskOnly}>{had === 1 ? ' · already' : ` · ${had} already`}</span>
                <span className={s.phoneOnly}>{had === 1 ? '' : ` · ${had}`}</span>
              </span>}
            </button>
          );
        })}
        {typing == null ? (
          <button type="button" className={s.chip} onClick={() => setTyping('')}>
            <Plus size={13} aria-hidden /><span className={s.deskOnly}>Type a name</span><span className={s.phoneOnly}>Name</span>
          </button>
        ) : (
          <span className={s.chipType}>
            <input className={ck.input} value={typing} maxLength={100} placeholder="Age group name" aria-label="Age group name" autoFocus
              onChange={e => setTyping(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && typing.trim()) { e.preventDefault(); add(typing.trim()); setTyping(null); } }} />
            <button type="button" className="btn btn-outline" disabled={!typing.trim()} onClick={() => { add(typing.trim()); setTyping(null); }}>Add</button>
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className={s.groupRows}>
          {rows.map(r => {
            const born = checkBornYears(r.from, r.to, cutoff, thisYear);
            const yearsBlank = !r.from.trim() && !r.to.trim();
            return (
              <div key={r.key} className={s.groupRow}>
                <label className={ck.field}>
                  <span className={ck.label}>Division</span>
                  <input className={ck.input} value={r.name} maxLength={100} onChange={e => update(r.key, { name: e.target.value })} />
                </label>
                <div className={ck.field}>
                  <span className={ck.label} id={`${r.key}-born`}>Born in</span>
                  <div role="group" aria-labelledby={`${r.key}-born`}>
                    <BornYearsBoxes from={r.from} to={r.to} cutoff={cutoff} held={!yearsBlank && !born.ok}
                      onFrom={v => update(r.key, { from: v })} onTo={v => update(r.key, { to: v })} />
                  </div>
                  {yearsBlank ? <span className={s.amberText}>Pick the birth years</span>
                    : !born.ok ? <span className={s.amberText} role="alert">{born.held}</span> : null}
                </div>
                <label className={ck.field}>
                  <span className={ck.label}>Players</span>
                  <input className={ck.input} type="number" min="1" step="1" inputMode="numeric" value={r.capacity}
                    onChange={e => update(r.key, { capacity: e.target.value })} />
                </label>
                <label className={ck.field}>
                  <span className={ck.label}>Price</span>
                  <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={r.price}
                    onChange={e => update(r.key, { price: e.target.value })} />
                </label>
                <button type="button" className={s.iconButton} aria-label={`Remove ${r.name || r.group}`}
                  onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>
                  <X size={16} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {warnings.map(w => <p key={w} className={s.amberText}>{w}</p>)}

      <ul className={s.hints}>
        {!isJan1(cutoff) && <li>Birthdays count from {cutoffWords(cutoff, 'short')} for {sport.toLowerCase()}, the club’s cut-off.</li>}
        <li>The birth years are yours to pick. We don’t guess them from the name.</li>
        <li>To run two divisions for one age group, such as U10 A and U10 B, tap its chip again.</li>
      </ul>
    </KitDialog>
  );
}
