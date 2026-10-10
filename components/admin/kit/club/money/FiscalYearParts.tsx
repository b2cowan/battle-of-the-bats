'use client';
/**
 * THE CLUB'S FISCAL YEAR ON SCREEN (Club Tier Stage 3c, session 2 — hub v46, specimens 1 and 3; Asks 1–5, 9).
 *
 *   YearLine          — a closed year's ONE quiet line under the toolbar on Budget, Budget vs. Actual and the
 *                       Overview: the lock, who closed it and when, a re-close after a Reopen, and its one action —
 *                       Reopen (outlined: it opens a window) on the LATEST closed year for someone who moves the
 *                       club's money; an older closed year says which year can be reopened instead. A year reopened
 *                       and not yet closed again says so, with who, when and why (Ask 3).
 *   EndedYearLine     — the Overview's line from the day after a year ends until someone closes it: the year, the
 *                       day it ended, and an outlined "Close 2025–26" (Ask 2's door). Money movers only.
 *   FiscalYearWindow  — Budget › Tools › Fiscal year: a RECORD (2026-10-01, the standard). It reads first (when the
 *                       year starts, this year, next year, the closed years); one borderless pencil turns it into
 *                       its form; ✓ turns it back. The names — this year's and next year's, any OPEN year's (Ask 5;
 *                       next year's joined in the §283 walk) — save as you go (the floating pill); the FIRST MONTH ASKS
 *                       — the consequence is shown before the save (the server's preview: the very step, rolled
 *                       back), decided by two buttons, a question inside the record (Ask 5).
 *   CloseYearQuestion — the outcome first (Ask 10, §283 walk 5): the year's path (what locks → the closing balance →
 *                       the year that opens on it), then one line for each of the four kinds of open money, each
 *                       counted, totalled and a door, the state on its word and never on the figure; the promises in
 *                       one line at the foot. The kit's WIDE form (the path needs the room). Warns, never blocks
 *                       (Ask 2). A form on a phone (it covers the bar); there the path stacks, figure first.
 *   ReopenYearQuestion — the latest closed year only, with a required reason that is kept (Ask 3). White, never lime
 *                       and never red: reopening is neither a money move nor destructive.
 *
 * ⚖ "Fiscal year" (Ask 9) is the club side's one word for the period (`FISCAL_YEAR_WORD`); every sentence here is
 * /marketing's draft in lib/club-money-words.ts. Nothing here works a year out: every year, span and lock comes from
 * the server's one definition (lib/club-fiscal-year.ts).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarClock, ChevronRight, History, Lock } from 'lucide-react';
import KitDialog from '../KitDialog';
import frame from '../../AdminKitFrame.module.css';
import ck from '../ClubKit.module.css';
import { SavePill, repKit, useDeferredLoad } from '../RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import {
  FISCAL_YEAR_WORD, fiscalYearName, monthsBetween, shiftMonthsOn,
  type FiscalYearRead,
} from '@/lib/club-fiscal-year';
import { addCalendarDays } from '@/lib/timezone';
import {
  CLOSE_YEAR_WORDS, FISCAL_YEAR_REFUSAL, FISCAL_YEAR_WINDOW_WORDS, REOPEN_YEAR_WORDS, YEAR_LINE_WORDS,
  fiscalYearSpanWords, monthName,
} from '@/lib/club-money-words';
import type { FiscalYearWindow as WindowRead, FirstMonthChange } from '@/lib/club-fiscal-year-moves';
import type { CloseQuestion, OpenInstallmentRow } from '@/lib/club-fiscal-reads';
import { FormError, ReasonQuestion, jsonInit, money, moneyFetch, refusalText } from './MoneyKit';
import fy from './FiscalYear.module.css';

// ── A closed (or reopened) year's line ────────────────────────────────────────────────────────

export function YearLine({ year, onReopen }: {
  year: FiscalYearRead;
  /** Opens the Reopen question — passed by a page that offers it (the line shows the button only when it may). */
  onReopen?: () => void;
}) {
  if (year.closed) {
    const reopenHere = year.canReopen && onReopen;
    const olderNote = !reopenHere && year.canMove && year.latestClosed && year.latestClosed.key !== year.key
      ? YEAR_LINE_WORDS.onlyLatest(year.latestClosed.name) : null;
    return (
      <div className={fy.yearLine} role="note">
        <Lock size={15} aria-hidden className={fy.yearLineIcon} />
        <span className={fy.yearLineText}>
          <b>{YEAR_LINE_WORDS.closedLead(year.name)}</b> {YEAR_LINE_WORDS.closed(year.name, year.closedByName, year.closed.at)}
          {year.reopened && YEAR_LINE_WORDS.closedAgain(year.reopened.at, year.reopened.byName, year.reopened.reason)}
          {olderNote && <> {olderNote}</>}
        </span>
        {reopenHere && (
          <span className={fy.yearLineAct}>
            <button type="button" className="btn btn-outline" onClick={onReopen}>{YEAR_LINE_WORDS.reopen}</button>
          </span>
        )}
      </div>
    );
  }
  if (year.locked) {
    return (
      <div className={fy.yearLine} role="note">
        <Lock size={15} aria-hidden className={fy.yearLineIcon} />
        <span className={fy.yearLineText}><b>{YEAR_LINE_WORDS.lockedBeforeLead(year.name)}</b>{YEAR_LINE_WORDS.lockedBefore}</span>
      </div>
    );
  }
  if (year.reopened) {
    return (
      <div className={fy.yearLine} role="note">
        <History size={15} aria-hidden className={fy.yearLineIcon} />
        <span className={fy.yearLineText}>
          <b>{YEAR_LINE_WORDS.reopenedLead(year.name)}</b>{YEAR_LINE_WORDS.reopened(year.reopened.at, year.reopened.byName, year.reopened.reason)}
        </span>
      </div>
    );
  }
  return null;
}

/** The Overview's line once a year has ended and until someone closes it. */
export function EndedYearLine({ year, onClose }: { year: { key: string; name: string; lastDay: string }; onClose: () => void }) {
  return (
    <div className={fy.endedLine} role="note">
      <CalendarClock size={16} aria-hidden className={fy.endedIcon} />
      <span className={fy.yearLineText}><b>{YEAR_LINE_WORDS.endedLead(year.name, year.lastDay)}</b>{YEAR_LINE_WORDS.endedRest}</span>
      <span className={fy.yearLineAct}>
        <button type="button" className="btn btn-outline" onClick={onClose}>{CLOSE_YEAR_WORDS.close(year.name)}</button>
      </span>
    </div>
  );
}

// ── The months strip ──────────────────────────────────────────────────────────────────────────

/** A year's twelve months from its first month, the first outlined (initials on a phone). */
export function MonthsStrip({ firstMonth }: { firstMonth: number }) {
  const months = Array.from({ length: 12 }, (_, i) => ((firstMonth - 1 + i) % 12) + 1);
  return (
    <div className={fy.months} aria-hidden>
      {months.map((m, i) => (
        <span key={m} className={`${fy.month} ${fy.monthOn}${i === 0 ? ` ${fy.monthFirst}` : ''}`}>
          <span className={fy.monthWord}>{monthName(m).slice(0, 3)}</span>
          <span className={fy.monthInitial}>{monthName(m).slice(0, 1)}</span>
        </span>
      ))}
    </div>
  );
}

// ── Budget › Tools › Fiscal year ──────────────────────────────────────────────────────────────

/** The first twelve-month year on a new first month: its name and span, from the day it starts. */
function yearFrom(first: string): { name: string; firstDay: string; lastDay: string } {
  const lastDay = addCalendarDays(shiftMonthsOn(first, 12), -1);
  return { name: fiscalYearName(first, lastDay), firstDay: first, lastDay };
}

function YearRows({ change }: { change: FirstMonthChange }) {
  const W = FISCAL_YEAR_WINDOW_WORDS;
  if (change.mode !== 'short_next' || !change.current || !change.next) return null;
  const then = change.thenFrom ? yearFrom(change.thenFrom) : null;
  const shortMonths = monthsBetween(change.next.firstDay, change.next.lastDay);
  return (
    <>
      <p className={fy.qHead}>{W.whatChanges}</p>
      <div className={fy.years}>
        <div className={fy.yearRow}>
          <b>{change.current.name}</b>
          <span>{fiscalYearSpanWords(change.current)}</span>
          <span className={fy.yearRowSub}>{W.keepsWhy}</span>
        </div>
        <div className={`${fy.yearRow} ${fy.yearShort}`}>
          <b>{change.next.name}</b>
          <span>{fiscalYearSpanWords(change.next)} · <b>{shortMonths} months</b></span>
          <span className={fy.yearRowSub}>{W.shortWhy}</span>
        </div>
        {then && (
          <div className={fy.yearRow}>
            <b>{then.name}</b>
            <span>{fiscalYearSpanWords(then)}</span>
            <span className={fy.yearRowSub}>{W.thenWhy}</span>
          </div>
        )}
      </div>
    </>
  );
}

/** A blank name's reason, under its field — the save pill says only that a save is held (the ledger's rule: a held
 *  autosave's reason sits under the field it is about). The 3c date refusal's look, without its alert: the pill is
 *  the live region, and a field being retyped is not a refusal. */
const NameMissing = ({ id, children }: { id: string; children: ReactNode }) => (
  <span className={fy.refuse} id={id}><AlertCircle size={14} aria-hidden className={fy.refuseIcon} /><span>{children}</span></span>
);

function consequenceOf(change: FirstMonthChange, month: number): string | null {
  const W = FISCAL_YEAR_WINDOW_WORDS;
  if (change.mode === 'fresh' && change.current) return W.fresh(monthName(month), change.current.name, fiscalYearSpanWords(change.current));
  if (change.mode === 'whole_next' && change.current && change.next) return W.wholeNext(change.current.name, change.next.name, monthName(month));
  if (change.mode === 'short_next' && change.next) {
    const then = change.thenFrom ? yearFrom(change.thenFrom) : null;
    return W.moves({
      shortName: change.next.name, moved: change.moved, split: change.split,
      movedFrom: change.movedFrom, movedTo: change.movedTo, toName: then?.name ?? change.next.name,
    });
  }
  return null;
}

export function FiscalYearWindow({ q, onChanged, onClose }: {
  q: string;
  /** A change landed: the page re-reads its plan (the year's months, its name) and says what changed. */
  onChanged: (text: string | null) => void;
  onClose: () => void;
}) {
  const W = FISCAL_YEAR_WINDOW_WORDS;
  const isPhone = useIsPhone();
  const [read, setRead] = useState<WindowRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  /** Each year's name as saved this visit, by key, until the next read: a field falls back to it (never to the
   *  read's older name — /review 2026-10-08: the pencil pressed again before the re-read landed sent the old name
   *  back), and only a name that differs from it is sent. */
  const [held, setHeld] = useState<Record<string, string>>({});
  /** A name landed this visit: the page re-reads on the way out (the Year pill prints the names). */
  const renamed = useRef(false);
  const load = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<WindowRead>(`/api/admin/accounting/fiscal-years?${q}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setHeld({});
    setRead(r.data);
  }, [q]);
  useDeferredLoad(true, load);

  // ── The first month: a question inside the record ──
  const [month, setMonth] = useState<number | null>(null);
  const [change, setChange] = useState<FirstMonthChange | null>(null);
  const [changing, setChanging] = useState(false);
  const [monthError, setMonthError] = useState('');
  const chosen = month ?? read?.firstMonth ?? 1;
  const pendingMonth = read && month != null && month !== read.firstMonth ? month : null;
  /** A month picked: the question waits on its preview (the effect below fetches it). */
  const chooseMonth = (m: number) => { setMonth(m); setMonthError(''); setChange(null); };
  /** The preview is on its way: a month picked, no answer and no refusal yet. */
  const asking = pendingMonth != null && change == null && !monthError;
  useEffect(() => {
    if (pendingMonth == null) return;
    let live = true;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    void moneyFetch<{ change: FirstMonthChange }>(`/api/admin/accounting/fiscal-years/first-month?${q}&month=${pendingMonth}`)
      .then(r => {
        if (!live) return;
        if (!r.ok) { setChange(null); setMonthError(refusalText(r.data, FISCAL_YEAR_REFUSAL.bad_month)); return; }
        setChange(r.data.change);
      })
      .catch(() => { if (live) setMonthError('What would change couldn’t be worked out. Check your connection and try again.'); });
    return () => { live = false; };
  }, [pendingMonth, q]);

  async function applyMonth() {
    if (pendingMonth == null || changing) return;
    // A name still saving lands first: its save is addressed to its year's key, and the change re-reads the years.
    if (dirty && !blocked && !(await handleSave())) return;
    setChanging(true); setMonthError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/fiscal-years/first-month?${q}`, jsonInit('POST', { month: pendingMonth }));
      if (!r.ok) { setMonthError(refusalText(r.data, 'The first month couldn’t change. Please try again.')); return; }
      setMonth(null); setName(null); setNextName(null);
      await load();
      onChanged(W.changed(monthName(pendingMonth)));
    } catch {
      setMonthError('The first month couldn’t change. Check your connection and try again.');
    } finally {
      setChanging(false);
    }
  }

  // ── This year's and next year's names: edits, so they save as you go — one record, one pill ──
  // Next year can be named before it starts (§283 walk, owner 2026-10-08): Ask 5 lets an OPEN year's name change,
  // and the drawing had drawn only this year's field. (A chosen name stays through a first-month change once the
  // club holds a plan or books; a club holding nothing starts every year over, and a rule-shaped name is re-suggested.)
  const current = read?.current ?? null;
  const next = read?.next ?? null;
  const [name, setName] = useState<string | null>(null);
  const [nextName, setNextName] = useState<string | null>(null);
  const draftName = name ?? (current ? held[current.key] ?? current.name : '');
  const draftNext = nextName ?? (next ? held[next.key] ?? next.name : '');
  // A blank name is never sent: its reason sits under its own field and the other year's name still saves. The
  // whole save is held only when a blank is all there is to send (/review, 2026-10-08 — one blank field used to
  // hold both, and ✓ then dropped the other year's valid rename).
  const blankThis = !!current?.canRename && !draftName.trim();
  const blankNext = !!next?.canRename && !draftNext.trim();
  const renames = useMemo(() => {
    const out: { key: string; name: string }[] = [];
    for (const [year, draft] of [[current, draftName.trim()], [next, draftNext.trim()]] as const) {
      if (year?.canRename && draft && draft !== (held[year.key] ?? year.name)) out.push({ key: year.key, name: draft });
    }
    // A shift — this year takes the name next year holds, next year a new one — frees the name first. (A straight
    // swap is refused either way round: the name is taken, and the refusal says so.)
    if (out.length === 2 && next && out[0].name.toLowerCase() === (held[next.key] ?? next.name).toLowerCase()) out.reverse();
    return out;
  }, [current, next, draftName, draftNext, held]);
  const blocked = renames.length > 0 ? null : blankThis ? W.nameMissingThis : blankNext ? W.nameMissingNext : null;
  const write = useCallback(async (signal: AbortSignal) => {
    for (const r of renames) {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const res = await fetch(`/api/admin/accounting/fiscal-years/${r.key}?${q}`, { ...jsonInit('PATCH', { name: r.name }), signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
      const saved: string = data?.year?.name ?? r.name;
      setHeld(h => ({ ...h, [r.key]: saved }));
      renamed.current = true;
    }
  }, [renames, q]);
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: editing && !!(current?.canRename || next?.canRename), loading: changing,
    sig: `${draftName.trim()}\n${draftNext.trim()}`, blocked, write, failText: 'Couldn’t save',
  });
  const finish = async () => {
    if (dirty && !blocked && !(await handleSave())) return false;
    if (renamed.current) { onChanged(null); renamed.current = false; }
    return true;
  };
  const toggleEdit = async () => {
    if (editing && !(await finish())) return;
    if (editing) { setMonth(null); setName(null); setNextName(null); void load(); }
    setEditing(e => !e);
  };
  // A refused rename (the name is taken; the year closed in another tab) holds the window ONCE, with the reason in
  // its pill; closing again leaves it unsaved — never a window that cannot be closed (3a's lesson).
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (renamed.current) { onChanged(null); renamed.current = false; }
    onClose();
  };

  const shownChange = pendingMonth != null ? change : null;
  const consequence = shownChange ? consequenceOf(shownChange, chosen) : null;
  const asksNow = shownChange != null && shownChange.mode !== 'unchanged';
  const answers = asksNow && read ? (
    <>
      <button type="button" className="btn btn-outline" onClick={() => { setMonth(null); setChange(null); }} disabled={changing}>{W.keep(monthName(read.firstMonth))}</button>
      <button type="button" className="btn btn-lime" onClick={() => void applyMonth()} disabled={changing || asking}>
        {changing ? W.changing : isPhone ? W.changeShort(monthName(pendingMonth!)) : W.change(monthName(pendingMonth!))}
      </button>
    </>
  ) : null;

  const spanOf = (y: { name: string; firstDay: string; lastDay: string; months: number; short: boolean }) =>
    `${y.name} · ${fiscalYearSpanWords(y)}${y.short ? ` · ${y.months} months` : ''}`;

  return (
    <KitDialog
      kind="form"
      eyebrow={W.eyebrow}
      title={FISCAL_YEAR_WORD}
      onClose={() => void close()}
      busy={changing}
      edit={read?.canEdit ? { editing, onToggle: () => void toggleEdit(), label: `Edit the ${FISCAL_YEAR_WORD.toLowerCase()}` } : undefined}
      status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
      footer={isPhone && answers ? answers : <button type="button" className="btn btn-outline" onClick={() => void close()} disabled={changing}>Done</button>}
    >
      {failed ? <p className={ck.hint}>The fiscal year couldn’t be loaded. Close this and try again.</p>
        : !read || !current ? <p className={ck.loading}>Loading…</p>
        : !editing ? (
          <>
            <dl className={fy.read}>
              {/* Bare facts — the default-January and "plan ahead" asides came out in the §283 walk (owner, 2026-10-08). */}
              <dt>{W.startsIn}</dt><dd>{monthName(read.firstMonth)}</dd>
              <dt>{W.thisYear}</dt><dd>{spanOf(current)}</dd>
              <dt>{W.nextYear}</dt><dd>{read.next.name}</dd>
              <dt>{W.closedYears}</dt>
              <dd>{read.closed.length === 0 ? W.noneClosed : read.closed.map(c => c.name).join(' · ')}</dd>
            </dl>
            <MonthsStrip firstMonth={read.firstMonth} />
          </>
        ) : (
          <>
            {read.firstMonthCanChange ? (
              <label className={ck.field} htmlFor="fy-month">
                <span className={ck.label}>{W.startsIn}<span className={repKit.req} aria-hidden>*</span></span>
                <select id="fy-month" className={ck.select} value={chosen} disabled={changing}
                  onChange={e => chooseMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
                <MonthsStrip firstMonth={chosen} />
                <span className={ck.hint}>{W.firstMonthHint}</span>
              </label>
            ) : (
              <dl className={fy.read}>
                <dt>{W.startsIn}</dt><dd>{monthName(read.firstMonth)}. {W.firstMonthLocked}</dd>
              </dl>
            )}
            <FormError inPlace>{monthError}</FormError>
            {asking && <p className={ck.hint}>Working out what would change…</p>}
            {asksNow && shownChange && (
              <>
                <YearRows change={shownChange} />
                {consequence && <p className={fy.consequence}>{consequence}</p>}
                {!isPhone && <div className={fy.answers}>{answers}</div>}
              </>
            )}
            {current.canRename ? (
              <label className={ck.field} htmlFor="fy-name">
                <span className={ck.label}>{W.nameLabel}<span className={repKit.req} aria-hidden>*</span></span>
                <input id="fy-name" className={ck.input} value={draftName} maxLength={40}
                  aria-invalid={blankThis || undefined} aria-describedby={blankThis ? 'fy-name-missing' : undefined}
                  onChange={e => { setName(e.target.value); touch(); closeRefused.current = false; }} />
                {blankThis ? <NameMissing id="fy-name-missing">{W.nameMissingThis}</NameMissing>
                  : <span className={ck.hint}>{W.nameHint}</span>}
              </label>
            ) : (
              <dl className={fy.read}><dt>{W.thisYear}</dt><dd>{spanOf(current)}</dd></dl>
            )}
            {next?.canRename && (
              <label className={ck.field} htmlFor="fy-next-name">
                <span className={ck.label}>{W.nextNameLabel}<span className={repKit.req} aria-hidden>*</span></span>
                <input id="fy-next-name" className={ck.input} value={draftNext} maxLength={40}
                  aria-invalid={blankNext || undefined} aria-describedby={blankNext ? 'fy-next-name-missing' : undefined}
                  onChange={e => { setNextName(e.target.value); touch(); closeRefused.current = false; }} />
                {/* The span alone: which months the name is for (a short year says its count). */}
                {blankNext ? <NameMissing id="fy-next-name-missing">{W.nameMissingNext}</NameMissing>
                  : <span className={ck.hint}>{fiscalYearSpanWords(next)}{next.short ? ` · ${next.months} months` : ''}</span>}
              </label>
            )}
          </>
        )}
    </KitDialog>
  );
}

// ── Closing a fiscal year ─────────────────────────────────────────────────────────────────────

/** Team names on one line: three, then "and 2 more". */
function teamNames(names: readonly string[]): string {
  const list = [...new Set(names)];
  return list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} ${CLOSE_YEAR_WORDS.moreTeams(list.length - 3)}`;
}

/** The installments still owed, by state: whose, what (when the row's one figure can't say it), then the state said
 *  once on its word (red when late, amber when it waits on the club). Never on the figure: none of these stops the
 *  close (Ask 10). States are parted by "; " so a team list never reads as the next state's. */
function installmentDetail(rows: readonly OpenInstallmentRow[], short: boolean): ReactNode {
  const groups = (['overdue', 'sent', 'upcoming'] as const)
    .map(state => ({ state, list: rows.filter(r => r.state === state) }))
    .filter(g => g.list.length > 0);
  return groups.map(({ state, list }, i) => {
    const on = state === 'sent'
      ? list.map(r => r.sentOn ?? r.dueDate).sort()[0]
      : list.map(r => r.dueDate).sort()[0];
    const words = short ? CLOSE_YEAR_WORDS.installmentStateShort(state) : CLOSE_YEAR_WORDS.installmentState(state, on);
    // Round 1's "$450.00 each" (§283 /review): said when several share one size, or when states split the row's
    // one figure — never when the figure already says it (one state, one size or one installment).
    const same = list.every(r => Math.abs(r.amount - list[0].amount) < 0.005);
    const each = same && list.length > 1;
    const amount = short || (!each && groups.length === 1) ? null
      : each ? CLOSE_YEAR_WORDS.installmentEach(money(list[0].amount)) : money(list.reduce((s, r) => s + r.amount, 0));
    return (
      <Fragment key={state}>
        {i > 0 && '; '}{teamNames(list.map(r => r.teamName))} · {amount && `${amount} · `}<span className={state === 'overdue' ? fy.openLate : state === 'sent' ? fy.openWait : undefined}>{words}</span>
      </Fragment>
    );
  });
}

/** One kind of money still open: its count, what it is, whose and when, its figure, and the chevron — a door to the
 *  page that settles it (Ask 2). A count that waits on the club is the rail's amber pill (owner, 2026-10-01). */
function OpenRow({ count, noun, detail, figure, href, waiting }: {
  count: number; noun: string; detail?: ReactNode; figure: string; href: string; waiting?: boolean;
}) {
  // A detail with nothing in it draws no " · " (an empty list or an empty string).
  const hasDetail = detail != null && detail !== '' && !(Array.isArray(detail) && detail.length === 0);
  return (
    <Link href={href} className={fy.openRow}>
      {/* The exact count, pill or not: the row states it, where the rail's "9+" only signals. */}
      <span className={fy.openCount}>
        {waiting ? <span className={frame.count} style={{ marginLeft: 0 }}>{count}</span> : count}
      </span>
      <span className={fy.openWhat}><b>{noun}</b>{hasDetail && <span className={fy.openDetail}> · {detail}</span>}</span>
      <span className={fy.openFigure}>{figure}</span>
      <ChevronRight size={16} aria-hidden className={fy.openEnd} />
    </Link>
  );
}

/** THE YEAR'S PATH (Ask 10): what locks → what it closes at → the year that opens on it. The closing balance is the
 *  one large figure, because it is what the close fixes; on a phone the path stacks with the figure first. */
function YearPath({ question, phone }: { question: CloseQuestion; phone: boolean }) {
  const W = CLOSE_YEAR_WORDS;
  const { locks, carries, sinceLastClose } = question;
  const span = fiscalYearSpanWords(question.year);
  const closing = (
    <div className={fy.pathClosing}>
      <span className={fy.pathKey}>{W.pathClosing}</span>
      <span className={fy.pathFigure}>{money(carries.closingBalance)}</span>
      {sinceLastClose && <span className={fy.pathChange}>{W.pathChange(sinceLastClose.change)}</span>}
    </div>
  );
  if (phone) {
    return (
      <div className={fy.pathStack}>
        {closing}
        <div className={fy.pathRow}>
          <Lock size={15} aria-hidden />
          <div><b>{W.pathLocksPhone(question.year.name)}</b><span className={fy.pathSub}>{W.pathLocksPhoneWhat(span, locks.books, locks.lines)}</span></div>
        </div>
        <div className={fy.pathRow}>
          <ArrowRight size={15} aria-hidden />
          <div><b>{W.pathOpensPhone(carries.nextYear.name)}</b><span className={fy.pathSub}>{W.pathNextPlan(carries.nextPlanLines)}</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className={fy.path}>
      <div className={fy.pathCell}>
        <span className={fy.pathKey}>{W.pathLocks}</span>
        <span className={fy.pathYear}><Lock size={14} aria-hidden />{question.year.name}</span>
        <span className={fy.pathSub}>{span}</span>
        <span className={fy.pathSub}>{W.pathLocksWhat(locks.books, locks.lines)}</span>
      </div>
      <ArrowRight size={16} aria-hidden className={fy.pathArrow} />
      {closing}
      <ArrowRight size={16} aria-hidden className={fy.pathArrow} />
      <div className={fy.pathCell}>
        <span className={fy.pathKey}>{W.pathOpens}</span>
        <span className={fy.pathYear}>{carries.nextYear.name}</span>
        <span className={fy.pathSub}>{W.pathOpensWhat}</span>
        <span className={fy.pathSub}>{W.pathNextPlan(carries.nextPlanLines)}</span>
      </div>
    </div>
  );
}

export function CloseYearQuestion({ q, year, accountingBase, onClosed, onClose }: {
  q: string;
  year: { key: string; name: string };
  accountingBase: string;
  onClosed: (text: string) => void;
  onClose: () => void;
}) {
  const W = CLOSE_YEAR_WORDS;
  const isPhone = useIsPhone();
  const [question, setQuestion] = useState<CloseQuestion | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<{ question: CloseQuestion }>(`/api/admin/accounting/fiscal-years/${year.key}/close?${q}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setQuestion(r.data.question);
  }, [q, year.key]);
  useDeferredLoad(true, load);

  async function close() {
    if (busy || !question?.canClose) return;
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ year: { name: string; closingBalance: number } }>(`/api/admin/accounting/fiscal-years/${year.key}/close?${q}`, { method: 'POST' });
      if (!r.ok) { setError(refusalText(r.data, W.failed)); void load(); return; }
      onClosed(W.done(r.data.year.name, question.carries.nextYear.name, money(r.data.year.closingBalance)));
    } catch {
      setError(W.offline);
    } finally {
      setBusy(false);
    }
  }

  const refusalWords = (qn: CloseQuestion): string | null => {
    const r = qn.refusal;
    if (!r) return null;
    if (r.code === 'not_ended') return FISCAL_YEAR_REFUSAL.not_ended(qn.year.name, r.lastDay ?? qn.year.lastDay);
    if (r.code === 'close_order') return FISCAL_YEAR_REFUSAL.close_order(r.year?.name ?? 'the year before');
    return FISCAL_YEAR_REFUSAL.already_closed(qn.year.name);
  };

  const o = question?.open;
  const next = question?.carries.nextYear.name ?? '';
  const anyOpen = !!o && o.installments.count + o.requests.count + o.unfiled.count + o.pending.count > 0;
  const ledgerDoor = (p: Record<string, string>) => `${accountingBase}/ledger?${new URLSearchParams(p)}`;

  return (
    <KitDialog
      kind="form"
      wide
      eyebrow={W.eyebrow(year.name)}
      title={W.title(year.name)}
      onClose={onClose}
      busy={busy}
      footerStart={<button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.notYet}</button>}
      footer={(
        <button type="button" className="btn btn-lime" onClick={() => void close()} disabled={busy || !question?.canClose}>
          {busy ? W.closingNow : W.close(year.name)}
        </button>
      )}
    >
      <FormError>{error}</FormError>
      {failed ? <p className={ck.hint}>{W.loadFailed}</p> : !question || !o ? <p className={ck.loading}>Loading…</p> : (
        <div className={fy.closeBody}>
          {question.refusal && <FormError inPlace>{refusalWords(question)}</FormError>}
          {question.sinceLastClose && (
            <p className={fy.reopenedNote}>
              <History size={15} aria-hidden />
              <span><b>{W.reopenedBy(question.sinceLastClose.reopenedAt, question.sinceLastClose.reopenedByName)}</b> · {W.reopenedWhy(question.sinceLastClose.reason)}</span>
            </p>
          )}

          <YearPath question={question} phone={isPhone} />

          <div>
            <p className={fy.openHead}>
              <span className={fy.qHead}>{W.stillOpen}</span>
              {anyOpen && <span>{W.stillOpenNote}</span>}
            </p>
            {!anyOpen ? <p className={ck.hint}>{W.nothingOpen(year.name)}</p> : (
              <div className={fy.list}>
                {o.installments.count > 0 && (
                  <OpenRow
                    count={o.installments.count} noun={W.installmentsNoun(o.installments.count)}
                    detail={installmentDetail(o.installments.rows, isPhone)}
                    figure={money(o.installments.amount)} href={`${accountingBase}/allocations?view=coming-due`}
                  />
                )}
                {o.requests.count > 0 && (
                  <OpenRow
                    waiting count={o.requests.count}
                    noun={isPhone ? W.requestsNounShort(o.requests.count) : W.requestsNoun(o.requests.count)}
                    detail={[teamNames(o.requests.rows.map(r => r.teamName)),
                      o.requests.holdingPayout > 0 ? W.holdingPayout(o.requests.holdingPayout) : null].filter(Boolean).join(' · ')}
                    figure={money(o.requests.amount)} href={`${accountingBase}/payment-requests`}
                  />
                )}
                {o.unfiled.count > 0 && (
                  <OpenRow
                    count={o.unfiled.count}
                    noun={isPhone ? W.unfiledNounShort(o.unfiled.count) : W.unfiledNoun(o.unfiled.count)}
                    detail={isPhone ? W.unfiledWhyShort : W.unfiledWhy(year.name)}
                    figure={money(o.unfiled.amount)} href={ledgerDoor(o.unfiled.ledger)}
                  />
                )}
                {o.pending.count > 0 && (
                  <OpenRow
                    count={o.pending.count} noun={W.pendingNoun(o.pending.count)}
                    detail={isPhone ? W.pendingWhyShort(next) : W.pendingWhy(next)}
                    figure={money(o.pending.amount)} href={ledgerDoor(o.pending.ledger)}
                  />
                )}
              </div>
            )}
          </div>

          <p className={fy.promises}>{isPhone ? W.promisesShort : W.promises}</p>
        </div>
      )}
    </KitDialog>
  );
}

// ── Reopen ────────────────────────────────────────────────────────────────────────────────────

export function ReopenYearQuestion({ q, year, nextName, onDone, onClose }: {
  q: string;
  year: { key: string; name: string };
  /** The year after it, whose opening follows the books again once this one is open. */
  nextName: string;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const W = REOPEN_YEAR_WORDS;
  return (
    <ReasonQuestion
      eyebrow={CLOSE_YEAR_WORDS.eyebrow(year.name)}
      title={W.title(year.name)}
      lead={W.lead(year.name, nextName)}
      label={W.label}
      hint={W.hint}
      missing={FISCAL_YEAR_REFUSAL.reason_required}
      keepLabel={W.keep}
      confirmLabel={W.confirm(year.name)}
      busyLabel={W.busy}
      failText={W.failText}
      submit={async reason => {
        // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
        const r = await moneyFetch(`/api/admin/accounting/fiscal-years/${year.key}/reopen?${q}`, jsonInit('POST', { reason }));
        return r.ok ? { ok: true, text: W.done(year.name) } : { ok: false, error: refusalText(r.data, `${W.failText} Please try again.`), stale: false };
      }}
      onClose={onClose}
      onDone={text => { if (text) onDone(text); }}
    />
  );
}
