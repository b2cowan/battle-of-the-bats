'use client';
/**
 * A PERMIT'S WINDOWS (Club Tier Stage 10a — hub K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 2 and 14
 * step 1; Asks 1, 2, 3, 8a, 21, 26 ratified 2026-10-11).
 *
 *   PermitWindow     — a permit READS FIRST and EDITS WHOLE (the 2026-10-01 record standard): eyebrow "Permit · 2026–27"
 *                      (the fiscal year it starts in, Ask 2), title its name. The permit (Issuer, Reference, For, Dates,
 *                      Document — opened by a signed link); The time (its blocks as rows, "80 h held", its dates off);
 *                      Cost as ONE joined band (Cost · An hour held — or a full and a half field's hour, Ask 21 — · On the
 *                      budget with "Open the line ›", the 3d door rule: the window turns into the line's, × turns it back);
 *                      What each field costs (when a field isn't Full); Use as ONE joined band (Held · Booked · Unused —
 *                      no "Outside it", owner 2026-10-11, see lib/permit-time.ts §3), a row per block, Export the use
 *                      above them. The body ends with Renew for next year and
 *                      Delete this permit (red, asks) — rare doors end the body (2026-10-09). Previous · Next in the foot.
 *                      The head's pencil turns the whole record into its form, autosaved with the floating pill.
 *   AddPermitWindow  — Add permit ASKS (2026-09-24): the same form, Cancel · Add permit; it writes once, then its
 *                      document is uploaded to the new permit.
 *
 * ⚖ A PERMIT'S MONEY READS ONLY TO THOSE WHO HOLD THE CLUB'S ACCOUNTING (owner, 10a build session — plan §6 Ask 1): the
 * route sends no cost, line or prices to anyone else, and these windows draw nothing where it would be (absent, not
 * greyed). Such a saver types the issuer's name (the club's payees are Accounting's).
 * ⚠ DEPARTURES, said at build (plan "10a BUILT"): the money rule above (the drawing showed the cost to every reader);
 * "Hand out this time in a schedule ›" is Stage 11a's and is absent until 11a builds it (never a dead door); a block's
 * own dates (inside the permit's) are stored but not offered — no drawing shows them.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Download, FileText, Plus, RotateCw, Upload, X } from 'lucide-react';
import KitDialog, { type KitStep } from './KitDialog';
import ck from './ClubKit.module.css';
import { LoadFailed, NoticePill, RecordAction, RecordDelete, SavePill, repKit, useDeferredLoad, useLatestRead } from './RepKit';
import { FormError, TextField, jsonInit, moneyFetch, refusalText } from './money/MoneyKit';
import MoneySummaryBand, { type MoneyTile } from '@/components/coaches/MoneySummaryBand';
import PayeeCombobox, { type PayeeSelection } from '@/components/accounting/PayeeCombobox';
import PayeesWindow from './money/PayeesWindow';
import { followPayeeChange, type PayeeChange } from '@/lib/expense-payee';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useDismissable, useFieldMenu } from '@/lib/overlay-hooks';
import { formatEventDateRange, formatStoredDate, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { formatTimeRange, pluralize } from '@/lib/utils';
import { facilityWords } from '@/lib/venue-clash-words';
import { fieldPrices, heldTime, type PermitTime, type VenueFacilities } from '@/lib/permit-time';
import {
  EMPTY_PERMIT_DRAFT, parseCost, permitHeldReason, permitPayload, shareStores, type PermitBlockDraft, type PermitDraft,
} from '@/lib/permit-form';
import {
  HELD_FOR_OPTIONS, PERMIT_WORDS as W, WEEKDAY_OPTIONS, facilityListWords, fieldHourSentence, fieldPricesSentence, fileSizeWords,
  heldForWords, hoursWords, permitMoney, priceGroups, sharePercent, spanWords, usedOfWords, usedPercent, weekdaysShort,
  type PermitHeldFor,
} from '@/lib/permit-words';
import { permitUseSheets } from '@/lib/permit-use-workbook';
import { BRANDING_TEXT, buildFilename, downloadXLSX, fetchResolvedPdfSettings, loadBrandMark, pageFooterText } from '@/lib/export';
import type { PermitView, PermitWindowRead } from '@/lib/permit-server';
import type { LibraryVenue } from '@/lib/venue-library';
import own from './Permits.module.css';
import vl from './VenueLibrary.module.css';
import fy from './money/FiscalYear.module.css';
import LoadingState from '@/components/shared/LoadingState';

let nextKey = 0;
const newKey = (p: string) => `${p}-${++nextKey}`;

/** The club's facilities per venue, in its order — what "every facility" and the summary read. */
export function facilitiesOf(venues: readonly LibraryVenue[]): VenueFacilities {
  return new Map(venues.map(v => [v.id, [...v.facilities].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.id)]));
}

// ── The multi-pick field: a block's facilities, its days ────────────────────────────────────────────

function PickField({ id, label, required, options, selected, onChange, everyLabel, placeholder, disabled }: {
  id: string;
  label: string;
  required?: boolean;
  options: readonly { id: string; label: string }[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** With it, ticking none means every option (a block's facilities); without, none is none (its days). */
  everyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useDismissable(open, wrap, () => setOpen(false));
  useFieldMenu(open, wrap, menu, () => setOpen(false));
  const chosen = options.filter(o => selected.includes(o.id));
  const value = chosen.length
    ? (everyLabel ? facilityListWords(chosen.map(o => o.label)) : chosen.map(o => o.label).join(', '))
    : everyLabel ?? '';
  const toggle = (oid: string) => onChange(selected.includes(oid) ? selected.filter(x => x !== oid) : [...selected, oid]);
  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${id}-label`}>{label}{required && <span className={repKit.req} aria-hidden>*</span>}</span>
      <div className={own.pick} ref={wrap}>
        <button type="button" id={id} className={own.pickButton} aria-haspopup="listbox" aria-expanded={open}
          aria-labelledby={`${id}-label ${id}`} disabled={disabled} onClick={() => setOpen(o => !o)}>
          <span className={`${own.pickValue}${value ? '' : ` ${own.pickPlaceholder}`}`}>{value || placeholder || 'Choose'}</span>
          <ChevronDown size={15} aria-hidden />
        </button>
        {open && (
          <div className={own.pickMenu} ref={menu} role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-label`}>
            {everyLabel && (
              <>
                <button type="button" role="option" aria-selected={selected.length === 0} className={own.pickOption} onClick={() => onChange([])}>
                  <span className={`${own.pickTick}${selected.length === 0 ? ` ${own.pickTickOn}` : ''}`}>{selected.length === 0 && <Check size={11} aria-hidden />}</span>
                  {everyLabel}
                </button>
                <div className={own.pickSep} />
              </>
            )}
            {options.map(o => {
              const on = selected.includes(o.id);
              return (
                <button key={o.id} type="button" role="option" aria-selected={on} className={own.pickOption} onClick={() => toggle(o.id)}>
                  <span className={`${own.pickTick}${on ? ` ${own.pickTickOn}` : ''}`}>{on && <Check size={11} aria-hidden />}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── The form: the whole record, for Add permit and the pencil ─────────────────────────────────────────

interface LineOption { id: string; name: string; word: string | null }

/** The cost lines of the fiscal year a day falls in (money readers only) — refetched when the start moves a year. */
function useBudgetLines(q: string, day: string, money: boolean) {
  const [state, setState] = useState<{ day: string; year: string | null; lines: LineOption[] } | null>(null);
  useEffect(() => {
    if (!money || !isCalendarDate(day)) return;
    let live = true;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<{ year: { name: string } | null; lines: LineOption[] }>(`/api/admin/org/permits?${q}&lines=${day}`)
      .then(r => { if (live && r.ok) setState({ day, year: r.data.year?.name ?? null, lines: r.data.lines }); })
      .catch(() => {});
    return () => { live = false; };
  }, [q, day, money]);
  return state && state.day === day ? state : null;
}

function useTeams(q: string, wanted: boolean) {
  const [teams, setTeams] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    if (!wanted || teams) return;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<{ teams: { id: string; name: string }[] }>(`/api/admin/org/permits?${q}&teams=1`)
      .then(r => { if (r.ok) setTeams(r.data.teams); }).catch(() => {});
  }, [q, wanted, teams]);
  return teams;
}

const SHARE_CHOICES = [{ id: 'full', label: W.priceFull }, { id: 'half', label: W.priceHalf }, { id: 'share', label: W.pricePercent }] as const;

/** "75", "33.3", "75 %" → its share of a full field; nothing typed, or not a plain figure ("1e1", "5 5"), is none —
 *  the pill holds it, so what the box shows is what saves. */
const percentShare = (text: string) => {
  const t = text.replace(/%/g, '').trim();
  return /^(\d+\.?\d*|\.\d+)$/.test(t) && Number(t) > 0 ? Number(t) / 100 : 0;
};

/**
 * The issuer after a change made in the Payees window raised over the form: a rename reads the new name, a merge points
 * at the payee kept (the coach's one rule, `followPayeeChange`), and a payee deleted from under the form stays as the
 * name it was, typed — the permit keeps who issued it rather than saving a payee that is gone.
 */
function followIssuer(d: PermitDraft, change: PayeeChange): PermitDraft {
  if (!d.issuerPayeeId) return d;
  if (change.kind === 'deleted') return change.id === d.issuerPayeeId ? { ...d, issuerPayeeId: null } : d;
  const pick = followPayeeChange({ payeeId: d.issuerPayeeId, payeePayer: null, displayName: d.issuerName }, change);
  return pick && (pick.payeeId !== d.issuerPayeeId || pick.displayName !== d.issuerName)
    ? { ...d, issuerPayeeId: pick.payeeId, issuerName: pick.displayName }
    : d;
}

function PermitFields({ idPrefix, q, draft, onChange, venues, money, moneyLocked = null, document, onManagePayees }: {
  idPrefix: string;
  /** The permit starts in a CLOSED fiscal year: its cost and budget line read, locked, with the money windows' line. */
  moneyLocked?: string | null;
  q: string;
  draft: PermitDraft;
  onChange: (next: PermitDraft) => void;
  /** The club's venues (the library's), plus any a block still names though it is archived. */
  venues: readonly LibraryVenue[];
  money: boolean;
  /** The document's field: Add permit's file chooser, or the window's Replace. */
  document: ReactNode;
  /** The issuer list's last row, "Manage payees…": the host raises the Payees window BESIDE its own (Stage 3d Ask 7a). */
  onManagePayees: () => void;
}) {
  const set = (patch: Partial<PermitDraft>) => onChange({ ...draft, ...patch });
  const setBlock = (key: string, patch: Partial<PermitBlockDraft>) =>
    set({ blocks: draft.blocks.map(b => (b.key === key ? { ...b, ...patch } : b)) });
  const facilities = useMemo(() => facilitiesOf(venues), [venues]);
  const venueOf = (id: string) => venues.find(v => v.id === id);
  const multiVenue = new Set(draft.blocks.map(x => x.venueId)).size > 1;
  const lines = useBudgetLines(q, draft.startsOn, money);
  const teams = useTeams(q, draft.heldFor === 'team');

  // What the time comes to: "2 blocks · 8 weeks · 80 h held" — the rule's own count, read as the form changes. And what
  // an hour of each field comes to, from the cost as typed (owner 2026-10-11: "75" beside "A share" read as dollars or a
  // percent until the form said what it buys) — only once every block is whole and every percent stores, so a price
  // shown is the price that saves.
  const { summary, prices } = useMemo(() => {
    const none = { summary: '', prices: null };
    if (!isCalendarDate(draft.startsOn) || !isCalendarDate(draft.endsOn) || draft.endsOn < draft.startsOn) return none;
    const usable = draft.blocks.filter(b => b.venueId && b.weekdays.length && b.startTime && b.endTime && b.endTime > b.startTime);
    if (!usable.length) return none;
    const time: PermitTime = {
      id: 'draft', startsOn: draft.startsOn, endsOn: draft.endsOn, datesOff: draft.datesOff.filter(o => o.day).map(o => ({ day: o.day, note: null })),
      blocks: usable.map(b => ({ id: b.key, venueId: b.venueId, facilityIds: b.facilityIds, weekdays: b.weekdays, startTime: b.startTime, endTime: b.endTime, fromDate: null, untilDate: null })),
    };
    const held = heldTime(time, facilities);
    const cost = money ? parseCost(draft.cost) : null;
    const worked = cost != null && Number.isFinite(cost) && usable.length === draft.blocks.length && Object.values(draft.shares).every(shareStores)
      ? fieldPrices(time, facilities, new Map(Object.entries(draft.shares)), cost)
      : null;
    return {
      summary: [pluralize(usable.length, 'block'), spanWords(draft.startsOn, draft.endsOn, null, 0), `${hoursWords(held.heldMinutes)} held`].join(' · '),
      prices: worked?.fullHour != null ? { cost: cost!, fullHour: worked.fullHour, hourOf: worked.hourOf } : null,
    };
  }, [draft, facilities, money]);
  /** A percent as typed ("7." on its way to "7.5"), kept while it still says the share the draft holds. */
  const [typedPercent, setTypedPercent] = useState<Record<string, string>>({});
  /** The fields set to "A percent" in this edit: typing "50" on the way to "50.5" stays a percent, never flips the
   *  row to Half cost under the cursor (/review). A stored 0.5 still reads as Half cost when the form opens. */
  const [percentRows, setPercentRows] = useState<Record<string, boolean>>({});

  // The places the blocks hold, for their prices (Ask 21): a block's facilities, or every facility at its venue.
  const priced: { id: string; label: string }[] = [];
  for (const b of draft.blocks) {
    const v = venueOf(b.venueId);
    if (!v) continue;
    const ids = b.facilityIds.length ? b.facilityIds : [...v.facilities].sort((x, y) => x.displayOrder - y.displayOrder).map(f => f.id);
    for (const fid of ids) {
      if (priced.some(o => o.id === fid)) continue;
      const f = v.facilities.find(x => x.id === fid);
      if (f) priced.push({ id: fid, label: multiVenue ? `${v.name} · ${f.name}` : f.name });
    }
  }

  const issuerValue: PayeeSelection | null = draft.issuerPayeeId || draft.issuerName
    ? { payeeId: draft.issuerPayeeId, payeePayer: draft.issuerPayeeId ? null : draft.issuerName, displayName: draft.issuerName }
    : null;

  return (
    <>
      <TextField id={`${idPrefix}-name`} label="Name" required value={draft.name} maxLength={120} placeholder="For example: Fall diamonds 2026"
        onChange={v => set({ name: v })} />
      <div className={own.pair}>
        {money ? (
          <div className={ck.field}>
            <span className={ck.label}>{W.issuer}</span>
            <PayeeCombobox payeesApiUrl={`/api/admin/accounting/payees?${q}`} value={issuerValue} kitField onManage={onManagePayees}
              onChange={v => set({ issuerPayeeId: v?.payeeId ?? null, issuerName: v?.displayName ?? '' })} />
            <p className={ck.hint}>{W.issuerHint}</p>
          </div>
        ) : (
          <TextField id={`${idPrefix}-issuer`} label={W.issuer} value={draft.issuerName} maxLength={200} hint={W.issuerTypedHint}
            onChange={v => set({ issuerName: v, issuerPayeeId: null })} />
        )}
        <TextField id={`${idPrefix}-ref`} label={W.reference} value={draft.reference} maxLength={80} placeholder="P-2026-1187"
          onChange={v => set({ reference: v })} />
      </div>
      <div className={own.pair}>
        <label className={ck.field} htmlFor={`${idPrefix}-for`}>
          <span className={ck.label}>{W.heldFor}</span>
          <select id={`${idPrefix}-for`} className={ck.select} value={draft.heldFor}
            onChange={e => set({ heldFor: e.target.value as PermitHeldFor, heldForTeamId: e.target.value === 'team' ? draft.heldForTeamId : null })}>
            {HELD_FOR_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        {draft.heldFor === 'team' ? (
          <label className={ck.field} htmlFor={`${idPrefix}-team`}>
            <span className={ck.label}>Team<span className={repKit.req} aria-hidden>*</span></span>
            <select id={`${idPrefix}-team`} className={ck.select} value={draft.heldForTeamId ?? ''} onChange={e => set({ heldForTeamId: e.target.value || null })}>
              <option value="">{teams ? 'Choose a team' : 'Loading…'}</option>
              {(teams ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ) : <span />}
      </div>
      <div className={own.pair}>
        <label className={ck.field} htmlFor={`${idPrefix}-from`}>
          <span className={ck.label}>From<span className={repKit.req} aria-hidden>*</span></span>
          <input id={`${idPrefix}-from`} type="date" className={ck.input} value={draft.startsOn} onChange={e => set({ startsOn: e.target.value })} />
        </label>
        <label className={ck.field} htmlFor={`${idPrefix}-to`}>
          <span className={ck.label}>To<span className={repKit.req} aria-hidden>*</span></span>
          <input id={`${idPrefix}-to`} type="date" className={ck.input} value={draft.endsOn} min={draft.startsOn || undefined} onChange={e => set({ endsOn: e.target.value })} />
        </label>
      </div>

      <h3 className={vl.sectionHead}>{W.sectionTime}</h3>
      {draft.blocks.map((b, i) => {
        const v = venueOf(b.venueId);
        return (
          <div key={b.key} className={own.block}>
            <div className={own.blockWhere}>
              <label className={ck.field} htmlFor={`${idPrefix}-b${i}-venue`}>
                <span className={ck.label}>Venue<span className={repKit.req} aria-hidden>*</span></span>
                <select id={`${idPrefix}-b${i}-venue`} className={ck.select} value={b.venueId}
                  onChange={e => setBlock(b.key, { venueId: e.target.value, facilityIds: [] })}>
                  <option value="">Choose a venue</option>
                  {venues.filter(x => x.isActive || x.id === b.venueId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <PickField id={`${idPrefix}-b${i}-facs`} label="Facilities"
                options={(v?.facilities ?? []).map(f => ({ id: f.id, label: f.name }))}
                selected={b.facilityIds} onChange={ids => setBlock(b.key, { facilityIds: ids })}
                everyLabel={!v ? undefined : v.facilities.length ? W.everyFacility : 'The whole venue'} disabled={!v} placeholder="Choose a venue first" />
            </div>
            <div className={own.blockWhen}>
              <PickField id={`${idPrefix}-b${i}-days`} label="Days" required options={WEEKDAY_OPTIONS}
                selected={b.weekdays.map(String)} onChange={ids => setBlock(b.key, { weekdays: ids.map(Number).sort((x, y) => x - y) })}
                placeholder="Choose the days" />
              <label className={ck.field} htmlFor={`${idPrefix}-b${i}-from`}>
                <span className={ck.label}>From<span className={repKit.req} aria-hidden>*</span></span>
                <input id={`${idPrefix}-b${i}-from`} type="time" step={300} className={ck.input} value={b.startTime} onChange={e => setBlock(b.key, { startTime: e.target.value })} />
              </label>
              <label className={ck.field} htmlFor={`${idPrefix}-b${i}-until`}>
                <span className={ck.label}>Until<span className={repKit.req} aria-hidden>*</span></span>
                <input id={`${idPrefix}-b${i}-until`} type="time" step={300} className={ck.input} value={b.endTime} onChange={e => setBlock(b.key, { endTime: e.target.value })} />
              </label>
              <button type="button" className={own.blockRemove} aria-label={`Remove block ${i + 1}`}
                onClick={() => set({ blocks: draft.blocks.filter(x => x.key !== b.key) })}>
                <X size={15} aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
      {draft.datesOff.map((o, i) => (
        <div key={o.key} className={own.offRow}>
          <label className={ck.field} htmlFor={`${idPrefix}-off${i}`}>
            <span className={ck.label}>Date off</span>
            <input id={`${idPrefix}-off${i}`} type="date" className={ck.input} value={o.day} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
              onChange={e => set({ datesOff: draft.datesOff.map(x => (x.key === o.key ? { ...x, day: e.target.value } : x)) })} />
          </label>
          <label className={ck.field} htmlFor={`${idPrefix}-offn${i}`}>
            <span className={ck.label}>Why (optional)</span>
            <input id={`${idPrefix}-offn${i}`} className={ck.input} value={o.note} maxLength={120} placeholder="The dome is closed"
              onChange={e => set({ datesOff: draft.datesOff.map(x => (x.key === o.key ? { ...x, note: e.target.value } : x)) })} />
          </label>
          <button type="button" className={own.blockRemove} style={{ alignSelf: 'end' }} aria-label={`Remove the date off ${o.day || i + 1}`}
            onClick={() => set({ datesOff: draft.datesOff.filter(x => x.key !== o.key) })}>
            <X size={15} aria-hidden />
          </button>
        </div>
      ))}
      <div className={own.adds}>
        <button type="button" className={own.addDoor} onClick={() => set({ blocks: [...draft.blocks, { key: newKey('blk'), id: null, venueId: draft.blocks[draft.blocks.length - 1]?.venueId ?? '', facilityIds: [], weekdays: [], startTime: '', endTime: '' }] })}>
          <Plus size={14} aria-hidden />{W.addBlock}
        </button>
        <button type="button" className={own.addDoor} onClick={() => set({ datesOff: [...draft.datesOff, { key: newKey('off'), day: '', note: '' }] })}>
          <Plus size={14} aria-hidden />{W.addDateOff}
        </button>
      </div>
      {summary && <p className={own.sum}>{summary}</p>}

      {money && (
        <>
          <h3 className={vl.sectionHead}>{W.sectionCost}</h3>
          {moneyLocked ? (
            <>
              <dl className={fy.read}>
                <dt>{W.costLabel}</dt><dd>{draft.cost ? permitMoney(Number(draft.cost)) : W.noCost}</dd>
                <dt>Budget line</dt><dd>{draft.budgetLineId ? (lines?.lines.find(l => l.id === draft.budgetLineId)?.name ?? 'On the budget') : W.noLine}</dd>
              </dl>
              <p className={ck.hint}>{moneyLocked}</p>
            </>
          ) : (
          <div className={own.pair}>
            <TextField id={`${idPrefix}-cost`} label={W.costLabel} value={draft.cost} maxLength={14} placeholder="3,200.00"
              onChange={v => set({ cost: v })} />
            <label className={ck.field} htmlFor={`${idPrefix}-line`}>
              <span className={ck.label}>Budget line</span>
              <select id={`${idPrefix}-line`} className={ck.select} value={draft.budgetLineId ?? ''} onChange={e => set({ budgetLineId: e.target.value || null })}
                disabled={!lines}>
                <option value="">{lines ? W.noLine : draft.startsOn ? 'Loading…' : 'Set the dates first'}</option>
                {(lines?.lines ?? []).map(l => <option key={l.id} value={l.id}>{lines?.year ? `${l.name} · ${lines.year}` : l.name}</option>)}
                {draft.budgetLineId && lines && !lines.lines.some(l => l.id === draft.budgetLineId) && (
                  <option value={draft.budgetLineId}>Another year’s line — pick one of {lines.year ?? 'this year'}</option>
                )}
              </select>
              <p className={ck.hint}>{W.lineHint}</p>
            </label>
          </div>
          )}
          {priced.length > 0 && (
            <>
              <h3 className={vl.sectionHead}>{W.sectionPrices}</h3>
              {priced.map(p => {
                const share = draft.shares[p.id];
                const choice = share == null ? 'full' : percentRows[p.id] || Math.abs(share - 0.5) >= 0.0001 ? 'share' : 'half';
                const setShare = (next: number | null) => {
                  const shares = { ...draft.shares };
                  if (next == null) delete shares[p.id]; else shares[p.id] = next;
                  set({ shares });
                };
                const typed = typedPercent[p.id];
                const hour = prices?.hourOf(p.id);
                return (
                  <div key={p.id} className={own.priceRow}>
                    <span className={own.priceName}>{p.label}</span>
                    <select className={ck.select} aria-label={`What ${p.label} costs`} value={choice}
                      onChange={e => {
                        const next = e.target.value;
                        setPercentRows(r => ({ ...r, [p.id]: next === 'share' }));
                        setShare(next === 'full' ? null : next === 'half' ? 0.5 : (share != null && share !== 0.5 ? share : 0.75));
                      }}>
                      {SHARE_CHOICES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {choice === 'share' ? (
                      <span className={own.pricePercent}>
                        <input className={ck.input} aria-label={`${p.label}: the percent of a full field’s price`} inputMode="decimal"
                          value={typed != null && percentShare(typed) === (share ?? 0) ? typed : share ? String(sharePercent(share)) : ''}
                          onChange={e => { const text = e.target.value; setTypedPercent(t => ({ ...t, [p.id]: text })); setShare(percentShare(text)); }} />
                        <span className={own.priceUnit} aria-hidden>%</span>
                      </span>
                    ) : <span />}
                    <span className={own.priceHour}>{hour != null ? W.anHour(hour) : ''}</span>
                  </div>
                );
              })}
              <p className={own.under}>
                {prices ? fieldPricesSentence(priced.map(p => draft.shares[p.id] ?? 1), prices.cost, prices.fullHour) : W.pricesPending}
              </p>
            </>
          )}
        </>
      )}
      {document}
      <label className={ck.field} htmlFor={`${idPrefix}-notes`} style={{ marginTop: '0.75rem' }}>
        <span className={ck.label}>{W.notes}</span>
        <textarea id={`${idPrefix}-notes`} className={ck.textarea} rows={2} maxLength={2000} value={draft.notes} onChange={e => set({ notes: e.target.value })} />
      </label>
    </>
  );
}

/** The record as the form holds it, from the window's read. */
export function draftOfView(p: PermitView): PermitDraft {
  return {
    name: p.name,
    issuerPayeeId: p.issuerPayeeId,
    issuerName: p.issuerName ?? '',
    reference: p.reference ?? '',
    heldFor: p.heldFor,
    heldForTeamId: p.heldForTeam?.id ?? null,
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    cost: p.cost == null ? '' : p.cost.toFixed(2),
    budgetLineId: p.budgetLine?.id ?? null,
    notes: p.notes ?? '',
    blocks: p.blocks.map(b => ({ key: b.id, id: b.id, venueId: b.venueId, facilityIds: b.facilityIds ?? [], weekdays: [...b.weekdays], startTime: b.startTime, endTime: b.endTime })),
    shares: Object.fromEntries(p.places.filter(pl => pl.facilityId && pl.share < 1).map(pl => [pl.facilityId!, pl.share])),
    datesOff: p.datesOff.map(o => ({ key: o.day, day: o.day, note: o.note ?? '' })),
  };
}

/** The picker's venue list (active venues with their facilities), read when a host hasn't one. */
function useVenues(q: string, given: readonly LibraryVenue[] | undefined, wanted: boolean) {
  const [venues, setVenues] = useState<LibraryVenue[] | null>(null);
  useEffect(() => {
    if (given || !wanted || venues) return;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<LibraryVenue[]>(`/api/admin/org/venues?${q}`).then(r => { if (r.ok) setVenues(r.data); }).catch(() => {});
  }, [q, given, wanted, venues]);
  return given ?? venues;
}

/** Every venue a record's blocks name, the archived ones too (read from the record), beside the library's. */
function withRecordVenues(venues: readonly LibraryVenue[], view: PermitView | null): LibraryVenue[] {
  if (!view) return [...venues];
  const out = [...venues];
  for (const b of view.blocks) {
    if (out.some(v => v.id === b.venueId)) continue;
    out.push({
      id: b.venueId, name: b.venueName, address: null, notes: null, bookingsEmail: null, isActive: false,
      facilities: (b.facilityIds ?? []).map((id, i) => ({ id, name: b.facilityNames?.[i] ?? '', facilityType: 'other', displayOrder: i })),
    });
  }
  return out;
}

// ── The window ───────────────────────────────────────────────────────────────────────────────────────

/** A row of the window's read: a name, a quiet line under it, a figure at the end. */
function ReadRow({ title, sub, figure }: { title: ReactNode; sub?: ReactNode; figure?: ReactNode }) {
  return (
    <div className={own.row}>
      <span className={own.rowMain}>
        <span className={own.rowTitle}>{title}</span>
        {sub && <span className={own.rowSub}>{sub}</span>}
      </span>
      {figure != null && <span className={own.rowFigure}>{figure}</span>}
    </div>
  );
}

const blockWhere = (b: PermitView['blocks'][number]) =>
  `${b.venueName} · ${b.facilityNames ? facilityListWords(b.facilityNames.map(f => facilityWords(null, f) || f)) : W.everyFacility.toLowerCase()}`;

export function PermitWindow({
  q, orgSlug, orgName, permitId, venues: givenVenues, steps, startEditing = false, said, onSaidDone, fromLine = false,
  onOpenLine, onChanged, onRenewed, onDeleted, onClose,
}: {
  q: string;
  orgSlug: string;
  orgName: string;
  permitId: string;
  /** The library's venues, when the host has them (the Venue library); otherwise read when the pencil is pressed. */
  venues?: readonly LibraryVenue[];
  /** Previous · Next through the list it was opened from. */
  steps?: { prev: KitStep | null; next: KitStep | null; position: string; noun: string };
  /** Opened straight into its form (Renew's copy). */
  startEditing?: boolean;
  /** A notice said once (Renew's line), in the window's pill. */
  said?: string | null;
  onSaidDone?: () => void;
  /** Opened from a budget line's "Pays for": the line is behind it, so the band names it without a door. */
  fromLine?: boolean;
  /** "Open the line ›" (the 3d door rule): the host turns this window into the line's. */
  onOpenLine?: (lineId: string, yearKey: string) => void;
  /** A save or a document landed: the host re-reads what it lists. */
  onChanged?: () => void;
  onRenewed?: (id: string, name: string) => void;
  onDeleted?: (name: string) => void;
  onClose: () => void;
}) {
  const [read, setRead] = useState<PermitWindowRead | null>(null);
  const [failed, setFailed] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    const r = await moneyFetch<PermitWindowRead>(`/api/admin/org/permits?${q}&id=${encodeURIComponent(permitId)}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [q, permitId, beginRead]);
  useDeferredLoad(true, load);

  // A read of another permit (the one stepped from) is not this one's: the window waits for its own.
  const view = read?.permit.id === permitId ? read.permit : null;
  const canSave = !!read?.canSave;
  const money = !!read?.canMoney;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PermitDraft>(EMPTY_PERMIT_DRAFT);
  const [seededFrom, setSeededFrom] = useState<PermitWindowRead | null>(null);
  const [refusedOnce, setRefusedOnce] = useState(false);
  const [asking, setAsking] = useState<'delete' | null>(null);
  /** Payees, raised over the form from the issuer list's "Manage payees…" — the form waits underneath. */
  const [managing, setManaging] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** The permit the window first opened on: only it opens straight into its form (Renew's copy). */
  const [opened, setOpened] = useState<string | null>(null);
  // The form is seeded from each fresh read while the record READS — never under an edit in progress — so ✓'s re-read
  // seeds it with what was saved. (/review 10a: keyed on the id, it re-seeded from the read BEFORE the save, and the next
  // pencil reopened the old values and autosaved them back over the new ones.)
  if (view && read && !editing && seededFrom !== read) {
    setSeededFrom(read);
    setDraft(draftOfView(view));
    setRefusedOnce(false);
    setActionError('');
    if (opened !== view.id) { setOpened(view.id); setEditing(startEditing && canSave); }
  }
  const venues = useVenues(q, givenVenues, editing);
  const formVenues = useMemo(() => withRecordVenues(venues ?? [], view), [venues, view]);
  const facilities = useMemo(() => facilitiesOf(formVenues), [formVenues]);

  const blocked = editing ? permitHeldReason(draft, facilities, money) : null;
  /** A save landed while this window was open: the host re-reads what it lists when the window goes. */
  const saved = useRef(false);
  const write = useCallback(async (signal: AbortSignal) => {
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    const res = await fetch(`/api/admin/org/permits?${q}`, { ...jsonInit('POST', { action: 'update-permit', id: permitId, data: permitPayload(draft) }), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    saved.current = true;
  }, [q, permitId, draft]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canSave && editing, loading: false, sig: JSON.stringify(draft), blocked, write, failText: 'Couldn’t save',
  });
  const change = (next: PermitDraft) => { setDraft(next); touch(); setRefusedOnce(false); };

  // A refused save holds the window ONCE with the reason in its pill; leaving again leaves it unsaved (Payees' rule).
  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || blocked || refusedOnce) return true;
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leave = async (then: () => void) => {
    if (await flush()) {
      settle();
      setRefusedOnce(false);
      if (saved.current || dirty) onChanged?.();
      then();
    }
  };
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
    await load();
    onChanged?.();
  };

  async function openDocument() {
    setActionError('');
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    const r = await moneyFetch<{ url: string }>(`/api/admin/org/permits/document?${q}&id=${encodeURIComponent(permitId)}`).catch(() => null);
    if (!r?.ok) { setActionError(refusalText(r?.data, 'The document couldn’t be opened just now. Try again.')); return; }
    window.open(r.data.url, '_blank', 'noopener,noreferrer');
  }
  async function upload(file: File) {
    if (uploading) return;
    setUploading(true); setActionError('');
    try {
      const { ok, data } = await postPermitDocument(q, permitId, file);
      if (!ok) { setActionError(refusalText(data, 'The document couldn’t be saved just now. Try again.')); return; }
      setRead(r => r && { ...r, permit: { ...r.permit, document: (data as { document: PermitView['document'] }).document } });
      onChanged?.();
    } catch {
      setActionError('The document couldn’t be saved. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }
  async function renew() {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<{ id: string; name: string }>(`/api/admin/org/permits?${q}`, jsonInit('POST', { action: 'renew-permit', id: permitId }));
      if (!r.ok) { setActionError(refusalText(r.data, 'The permit couldn’t be renewed. Please try again.')); return; }
      onRenewed?.(r.data.id, r.data.name);
    } catch {
      setActionError('That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  async function exportUse() {
    if (!view) return;
    try {
      const sheets = permitUseSheets(view, { today: tournamentToday(), sport: null, money });
      const brand = await permitWorkbookBrand(q);
      await downloadXLSX(buildFilename({ org: orgSlug, dataset: 'permit-use', scope: view.name }, 'xlsx'), sheets.headers, sheets.rows, sheets.sheetName, {
        columnNumFmts: sheets.columnNumFmts,
        rowStyles: sheets.rowStyles,
        notes: sheets.notes,
        masthead: {
          title: `${orgName} · ${view.name} · use`,
          subtitle: sheets.subtitle,
          meta: sheets.meta,
          logoDataUrl: brand.logoDataUrl,
        },
        footer: brand.footer,
        extraSheets: sheets.extraSheets,
        print: brand.print,
      });
    } catch {
      setActionError('The file couldn’t be made. Please try again.');
    }
  }

  const stepped = steps && { ...steps, prev: steps.prev && { ...steps.prev, onStep: () => void leave(steps.prev!.onStep) }, next: steps.next && { ...steps.next, onStep: () => void leave(steps.next!.onStep) } };

  if (failed) {
    return (
      <KitDialog kind="form" eyebrow="Permit" title="Permit" onClose={onClose}>
        <LoadFailed title="We couldn’t load this permit." onRetry={() => void load()} />
      </KitDialog>
    );
  }
  if (!view) {
    return (
      <KitDialog kind="form" eyebrow="Permit" title="Permit" onClose={onClose}>
        <LoadingState inline label="Loading the permit…" />
      </KitDialog>
    );
  }

  const u = view.use;
  const blocksRead = view.blocks;
  const oneWeekday = blocksRead.length && blocksRead.every(b => b.weekdays.length === 1 && b.weekdays[0] === blocksRead[0].weekdays[0]) ? blocksRead[0].weekdays[0] : null;
  const dayCount = oneWeekday ? u.days.length : 0;
  // ⚖ THE COST AS ROWS (owner 2026-10-11, decision sheet VA6EkqanHhEadNuDYeN3x5, Ask 2): the band holds the two figures
  // that describe the whole permit — what it costs and a full field's hour (the base every price is a percent of) — so it
  // can never grow or wrap; every other price is a ROW, one per price; the budget line's NAME is a read line, not a tile.
  const costTiles: MoneyTile[] = money ? [
    { key: 'cost', label: W.costLabel, figure: view.cost != null ? permitMoney(view.cost) : '—', caption: view.cost == null ? W.noCost : undefined },
    {
      key: 'hour', label: view.prices?.allFull ? W.anHourHeld : W.aFullFieldHour,
      figure: view.prices?.fullHour != null ? permitMoney(view.prices.fullHour) : '—', hidden: view.cost == null,
    },
  ] : [];
  const priceRows = money && view.prices && !view.prices.allFull ? priceGroups(view.places) : [];

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={`Permit · ${view.year.name}`}
        title={view.name}
        onClose={() => void leave(onClose)}
        edit={canSave ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${view.name}` } : undefined}
        status={said && !(saving || dirty || saveError || blocked)
          // Renew's line (its copy opens in its form) and Add's document line: said until the first edit takes the pill.
          ? <NoticePill inline key={said} message={said} onDone={() => onSaidDone?.()} />
          : editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
        steps={stepped}
        levelKey={view.id}
        busy={busy}
      >
        {editing ? (
          <PermitFields idPrefix="permit" q={q} draft={draft} onChange={change} venues={formVenues} money={money}
            moneyLocked={view.year.locked ? W.moneyLocked(view.year.name) : null} onManagePayees={() => setManaging(true)}
            document={(
              <div className={ck.field}>
                <span className={ck.label}>{W.document}</span>
                <label className={own.addDoor} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                  <Upload size={14} aria-hidden />{uploading ? 'Uploading…' : view.document ? W.replaceDocument : W.uploadDocument}
                  <input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
                </label>
                {view.document && <p className={ck.hint}>{view.document.name} · {fileSizeWords(view.document.size)}</p>}
              </div>
            )} />
        ) : (
          <>
            {/* ⚖ Export heads the window (owner 2026-10-11, Ask 1): its workbook summarises the WHOLE permit — reference,
                place, days, hours, dates, cost, prices, use — and an Export sits above what it exports, on the right
                (2026-10-09). On a phone the word hides and the 44px icon stays (the mobile admin rule). */}
            <h3 className={`${vl.sectionHead} ${own.headRow}`}>
              <span>{W.sectionPermit}</span>
              <button type="button" className={`btn btn-outline ${own.headDoor} ${ck.iconOnlyPhone}`} onClick={() => void exportUse()} aria-label="Export">
                <Download size={14} aria-hidden /> <span className={ck.btnWord}>Export</span>
              </button>
            </h3>
            <dl className={fy.read}>
              <dt>{W.issuer}</dt><dd>{view.issuerName ?? <span className={vl.quiet}>Not entered</span>}</dd>
              {view.reference && <><dt>{W.reference}</dt><dd>{view.reference}</dd></>}
              <dt>{W.heldFor}</dt><dd>{heldForWords(view.heldFor, view.heldForTeam?.name)}</dd>
              <dt>{W.dates}</dt>
              <dd>{formatEventDateRange(view.startsOn, view.endsOn, true)} <span className={own.docMeta} style={{ display: 'inline' }}>· {spanWords(view.startsOn, view.endsOn, oneWeekday, dayCount)}</span></dd>
              <dt>{W.document}</dt>
              <dd>
                {view.document ? (
                  <>
                    <button type="button" className={own.docDoor} onClick={() => void openDocument()}><FileText size={14} aria-hidden />{view.document.name}</button>
                    <span className={own.docMeta}>{fileSizeWords(view.document.size)} · added {formatStoredDate(view.document.addedAt, { withYear: false })}</span>
                  </>
                ) : <span className={vl.quiet}>{W.noDocument}</span>}
              </dd>
              {view.notes && <><dt>{W.notes}</dt><dd>{view.notes}</dd></>}
            </dl>

            <h3 className={`${vl.sectionHead} ${own.headRow}`}>
              <span>{W.sectionTime}</span>
              <span className={own.headFigure}>{hoursWords(view.blocks.reduce((n, b) => n + b.heldMinutes, 0))} held</span>
            </h3>
            {blocksRead.length ? (
              <div className={own.rows}>
                {blocksRead.map(b => (
                  <ReadRow key={b.id} title={blockWhere(b)} sub={`${weekdaysShort(b.weekdays)} · ${formatTimeRange(b.startTime, b.endTime)}`} figure={hoursWords(b.heldMinutes)} />
                ))}
              </div>
            ) : <p className={vl.quiet}>No time entered yet.</p>}
            <p className={own.under}>
              {view.datesOff.length
                ? `Dates off: ${view.datesOff.map(o => `${formatStoredDate(o.day, { withYear: false })}${o.note ? ` (${o.note})` : ''}`).join(', ')}.`
                : W.noDatesOff}
            </p>

            {money && (
              <>
                <h3 className={vl.sectionHead}>{W.sectionCost}</h3>
                <div className={own.windowBand}><MoneySummaryBand ariaLabel="The permit’s cost" tiles={costTiles} /></div>
                {priceRows.length > 0 && (
                  <>
                    <div className={own.rows}>
                      {priceRows.map(g => (
                        <ReadRow key={g.key} title={g.title} sub={g.size} figure={g.hour != null ? W.anHour(g.hour) : undefined} />
                      ))}
                    </div>
                    {view.prices?.fullHour != null && view.cost != null && (
                      <p className={own.under}>{fieldHourSentence(view.cost, view.prices.fullFieldHours, view.prices.fullHour)}</p>
                    )}
                  </>
                )}
                <dl className={`${fy.read} ${own.budgetRead}`}>
                  <dt>{W.onTheBudget}</dt>
                  <dd>
                    {view.budgetLine ? (
                      <>
                        {view.budgetLine.name} <span className={own.docMeta} style={{ display: 'inline' }}>· {view.budgetLine.yearName}</span>
                        {!fromLine && onOpenLine && (
                          <><span className={own.docMeta} style={{ display: 'inline' }}> · </span><button type="button" className={`${own.bandDoor} tap-target`} onClick={() => void leave(() => onOpenLine(view.budgetLine!.id, view.budgetLine!.yearKey))}>{W.openTheLine} ›</button></>
                        )}
                      </>
                    ) : <span className={vl.quiet}>{W.noLine}</span>}
                  </dd>
                </dl>
              </>
            )}

            <h3 className={vl.sectionHead}>{W.sectionUse}</h3>
            <div className={own.windowBand}><MoneySummaryBand ariaLabel="How much of the permit is used" tiles={[
              { key: 'held', label: W.held, figure: hoursWords(u.heldMinutes) },
              { key: 'booked', label: W.booked, figure: hoursWords(u.bookedMinutes), caption: usedPercent(u.bookedMinutes, u.heldMinutes) },
              { key: 'unused', label: W.unused, figure: hoursWords(u.unusedMinutes) },
            ]} /></div>
            <div className={own.rows}>
              {blocksRead.map(b => (
                <ReadRow key={b.id} title={blockWhere(b)}
                  sub={[b.who.length ? b.who.join(' · ') : 'Nothing booked', b.unplacedMinutes > 0 ? `${hoursWords(b.unplacedMinutes)} with no facility set` : ''].filter(Boolean).join(' · ')}
                  figure={`${usedOfWords(b.bookedMinutes, b.heldMinutes)} · ${usedPercent(b.bookedMinutes, b.heldMinutes)}`} />
              ))}
            </div>
          </>
        )}
        {canSave && !editing && (
          <div className={vl.recordEnd}>
            <RecordAction icon={<RotateCw size={13} aria-hidden />} onClick={() => void renew()} disabled={busy}>{W.renew}</RecordAction>
            <RecordDelete onClick={() => void leave(() => setAsking('delete'))}>{W.deleteDoor}</RecordDelete>
          </div>
        )}
        {actionError && <FormError inPlace>{actionError}</FormError>}
      </KitDialog>
      {asking === 'delete' && (
        <PermitDeleteQuestion q={q} id={view.id} name={view.name} onClose={() => setAsking(null)} onDone={() => { setAsking(null); onDeleted?.(view.name); }} />
      )}
      {/* A change to the issuer it names is an edit to the permit: it saves as any other change does. */}
      {managing && editing && (
        <PayeesWindow q={q} raised onClose={() => setManaging(false)}
          onChanged={c => { const next = followIssuer(draft, c); if (next !== draft) change(next); }} />
      )}
    </>
  );
}

/**
 * The house letterhead's branded parts for a permit workbook (the use, the Permits list): the club's logo for the masthead,
 * our mark at the foot and on the printed page — all on the club's own branding switch, read for each file.
 */
export async function permitWorkbookBrand(q: string) {
  // org-slug-ok: `q` is the host page's "orgSlug=…" query
  const settings = await fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`);
  const branded = settings?.showBranding ?? true;
  const mark = branded ? await loadBrandMark() : null;
  return {
    logoDataUrl: settings?.logoDataUrl ?? undefined,
    footer: branded ? { text: BRANDING_TEXT, logoDataUrl: mark ?? undefined } : undefined,
    print: { landscape: true, fitToWidth: true, pageFooter: pageFooterText(branded) },
  };
}

/** Sends the issuer's document for a saved permit (PDF, JPG or PNG; the route holds the rules). */
async function postPermitDocument(q: string, permitId: string, file: File): Promise<{ ok: boolean; data: unknown }> {
  const body = new FormData();
  body.append('file', file);
  // org-slug-ok: `q` is the host page's "orgSlug=…" query
  const res = await fetch(`/api/admin/org/permits/document?${q}&id=${encodeURIComponent(permitId)}`, { method: 'POST', body });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

// ── Add permit (create asks) ─────────────────────────────────────────────────────────────────────────

export function AddPermitWindow({ q, venues, money, startVenueId, onAdded, onClose }: {
  q: string;
  venues: readonly LibraryVenue[];
  money: boolean;
  /** A first block at this venue (Add permit opened from a venue). */
  startVenueId?: string | null;
  /** `note`: the permit is added but something with it isn't (its document) — the permit's window says it. */
  onAdded: (id: string, name: string, startsOn: string, note?: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PermitDraft>(() => ({
    ...EMPTY_PERMIT_DRAFT(),
    blocks: [{ key: newKey('blk'), id: null, venueId: startVenueId ?? '', facilityIds: [], weekdays: [], startTime: '', endTime: '' }],
  }));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Payees, raised over this form (Stage 3d Ask 7a) — the permit waits underneath, exactly as typed. */
  const [managing, setManaging] = useState(false);
  const facilities = useMemo(() => facilitiesOf(venues), [venues]);
  async function add() {
    if (busy) return;
    const held = permitHeldReason(draft, facilities, money);
    if (held) { setError(held.replace(/ to save it\.$/, '.')); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<{ id: string }>(`/api/admin/org/permits?${q}`, jsonInit('POST', { action: 'add-permit', data: permitPayload(draft) }));
      if (!r.ok || !r.data.id) { setError(refusalText(r.data, 'The permit couldn’t be added. Please try again.')); return; }
      if (file) {
        const up = await postPermitDocument(q, r.data.id, file).catch(() => null);
        if (!up?.ok) {
          // The permit is saved; only its document didn't make it — said in the permit's window, never lost silently.
          onAdded(r.data.id, draft.name.trim(), draft.startsOn,
            `The permit is added, but its document wasn’t: ${refusalText(up?.data, 'add it again with the pencil')}`);
          return;
        }
      }
      onAdded(r.data.id, draft.name.trim(), draft.startsOn);
    } catch {
      setError('The permit couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    <KitDialog
      kind="form"
      eyebrow="Venue library · Permits"
      title={W.addTitle}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : W.addButton}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <PermitFields idPrefix="new-permit" q={q} draft={draft} onChange={setDraft} venues={venues} money={money}
        onManagePayees={() => setManaging(true)}
        document={(
          <div className={ck.field}>
            <span className={ck.label}>{W.document}</span>
            <label className={own.addDoor}>
              <Upload size={14} aria-hidden />{file ? file.name : W.uploadDocument}
              <input type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <p className={ck.hint}>{file ? fileSizeWords(file.size) : W.documentHint}</p>
          </div>
        )} />
    </KitDialog>
    {managing && (
      <PayeesWindow q={q} raised onChanged={c => setDraft(d => followIssuer(d, c))} onClose={() => setManaging(false)} />
    )}
    </>
  );
}

// ── Delete (red, asks) ───────────────────────────────────────────────────────────────────────────────

export function PermitDeleteQuestion({ q, id, name, onClose, onDone }: { q: string; id: string; name: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch(`/api/admin/org/permits?${q}`, jsonInit('POST', { action: 'delete-permit', id }));
      if (!r.ok) { setError(refusalText(r.data, 'The permit couldn’t be deleted. Please try again.')); return; }
      onDone();
    } catch {
      setError('That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog kind="question" title={W.deleteTitle(name)} onClose={onClose} busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={() => void go()} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
        </>
      )}>
      <FormError>{error}</FormError>
      <p className={ck.hint}>{W.deleteBody}</p>
    </KitDialog>
  );
}
