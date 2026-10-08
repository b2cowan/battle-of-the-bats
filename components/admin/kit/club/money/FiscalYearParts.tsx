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
 *                       its form; ✓ turns it back. The name saves as you go (the floating pill); the FIRST MONTH ASKS
 *                       — the consequence is shown before the save (the server's preview: the very step, rolled
 *                       back), decided by two buttons, a question inside the record (Ask 5).
 *   CloseYearQuestion — what closing locks, what carries, and the four kinds of open money, each counted, totalled
 *                       and a door. Warns, never blocks (Ask 2). A form on a phone (it covers the bar).
 *   ReopenYearQuestion — the latest closed year only, with a required reason that is kept (Ask 3). White, never lime
 *                       and never red: reopening is neither a money move nor destructive.
 *
 * ⚖ "Fiscal year" (Ask 9) is the club side's one word for the period (`FISCAL_YEAR_WORD`); every sentence here is
 * /marketing's draft in lib/club-money-words.ts. Nothing here works a year out: every year, span and lock comes from
 * the server's one definition (lib/club-fiscal-year.ts).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight, History, Lock } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { SavePill, repKit, useDeferredLoad } from '../RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { joinWithAnd } from '@/lib/utils';
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
import { FormError, ReasonQuestion, jsonInit, money, moneyFetch, moneyKit, refusalText } from './MoneyKit';
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
  const load = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<WindowRead>(`/api/admin/accounting/fiscal-years?${q}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
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
    // A name still saving lands first: its save is addressed to this year, and the change re-reads the years.
    if (dirty && !blocked && !(await handleSave())) return;
    setChanging(true); setMonthError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/fiscal-years/first-month?${q}`, jsonInit('POST', { month: pendingMonth }));
      if (!r.ok) { setMonthError(refusalText(r.data, 'The first month couldn’t change. Please try again.')); return; }
      setMonth(null); setName(null);
      await load();
      onChanged(W.changed(monthName(pendingMonth)));
    } catch {
      setMonthError('The first month couldn’t change. Check your connection and try again.');
    } finally {
      setChanging(false);
    }
  }

  // ── This year's name: an edit, so it saves as you go ──
  const current = read?.current ?? null;
  const [name, setName] = useState<string | null>(null);
  const draftName = name ?? current?.name ?? '';
  const savedName = useRef<string | null>(null);
  const blocked = !draftName.trim() ? 'Give the year a name to save it.' : null;
  const write = useCallback(async (signal: AbortSignal) => {
    if (!current) return;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/accounting/fiscal-years/${current.key}?${q}`, { ...jsonInit('PATCH', { name: draftName.trim() }), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    savedName.current = data?.year?.name ?? draftName.trim();
  }, [current, draftName, q]);
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: editing && !!current?.canRename, loading: changing, sig: draftName.trim(), blocked, write, failText: 'Couldn’t save',
  });

  const finish = async () => {
    if (dirty && !blocked && !(await handleSave())) return false;
    if (savedName.current) { onChanged(null); savedName.current = null; }
    return true;
  };
  const toggleEdit = async () => {
    if (editing && !(await finish())) return;
    if (editing) { setMonth(null); setName(null); void load(); }
    setEditing(e => !e);
  };
  // A refused rename (the name is taken; the year closed in another tab) holds the window ONCE, with the reason in
  // its pill; closing again leaves it unsaved — never a window that cannot be closed (3a's lesson).
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (savedName.current) { onChanged(null); savedName.current = null; }
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

  const startsInWords = read ? (read.firstMonth === 1 && read.firstMonthCanChange ? W.januaryDefault : monthName(read.firstMonth)) : '';
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
              <dt>{W.startsIn}</dt><dd>{startsInWords}</dd>
              <dt>{W.thisYear}</dt><dd>{spanOf(current)}</dd>
              <dt>{W.nextYear}</dt><dd>{read.next.name} · {W.nextYearHint}</dd>
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
            <FormError>{monthError}</FormError>
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
                  onChange={e => { setName(e.target.value); touch(); closeRefused.current = false; }} />
                <span className={ck.hint}>{W.nameHint}</span>
              </label>
            ) : (
              <dl className={fy.read}><dt>{W.thisYear}</dt><dd>{spanOf(current)}</dd></dl>
            )}
          </>
        )}
    </KitDialog>
  );
}

// ── Closing a fiscal year ─────────────────────────────────────────────────────────────────────

/** One state's installments, said as one sentence ("10U A and 16U Girls, $450.00 each, overdue since Aug 15"). */
function installmentLines(rows: readonly OpenInstallmentRow[], short: boolean): string {
  const parts: string[] = [];
  for (const state of ['overdue', 'sent', 'upcoming'] as const) {
    const list = rows.filter(r => r.state === state);
    if (list.length === 0) continue;
    const teams = joinWithAnd([...new Set(list.map(r => r.teamName))]);
    if (short) { parts.push(CLOSE_YEAR_WORDS.installmentGroupShort(teams, state)); continue; }
    const same = list.every(r => Math.abs(r.amount - list[0].amount) < 0.005);
    const amount = same ? money(list[0].amount) : money(list.reduce((s, r) => s + r.amount, 0));
    const on = state === 'sent'
      ? list.map(r => r.sentOn ?? r.dueDate).sort()[0]
      : list.map(r => r.dueDate).sort()[0];
    parts.push(CLOSE_YEAR_WORDS.installmentGroup(teams, amount, same && list.length > 1, state, on));
  }
  return parts.join(' · ');
}

/** A short-record row: what, its detail, its figure, and (a door) the chevron. */
function ListRow({ title, sub, figure, tone, href }: {
  title: ReactNode; sub?: ReactNode; figure?: string; tone?: 'bad' | 'warn'; href?: string;
}) {
  const inner = (
    <>
      <span className={fy.listMain}>{title}{sub != null && <span className={fy.listSub}>{sub}</span>}</span>
      {figure != null && <span className={`${fy.listFigure}${tone === 'bad' ? ` ${fy.listFigureBad}` : tone === 'warn' ? ` ${fy.listFigureWarn}` : ''}`}>{figure}</span>}
      {href && <ChevronRight size={16} aria-hidden className={fy.listEnd} />}
    </>
  );
  return href ? <Link href={href} className={fy.listRow}>{inner}</Link> : <div className={fy.listRow}>{inner}</div>;
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

  // What the body reads off the question, once it has come.
  const body = question ? {
    o: question.open,
    next: question.carries.nextYear.name,
    span: fiscalYearSpanWords(question.year),
    anyOpen: question.open.installments.count + question.open.requests.count + question.open.unfiled.count + question.open.pending.count > 0,
    ledgerDoor: (p: Record<string, string>) => `${accountingBase}/ledger?${new URLSearchParams(p)}`,
  } : null;

  return (
    <KitDialog
      kind="form"
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
      {failed ? <p className={ck.hint}>{W.loadFailed}</p> : !question || !body ? <p className={ck.loading}>Loading…</p> : (
        <>
          <p className={moneyKit.lead1}>{W.lead}</p>
          {question.refusal && <FormError>{refusalWords(question)}</FormError>}
          {question.sinceLastClose && (
            <p className={ck.hint}>{W.sinceLastClose(question.sinceLastClose.reopenedAt, question.sinceLastClose.reopenedByName,
              question.sinceLastClose.reason, money(question.sinceLastClose.wasClosingBalance), money(question.carries.closingBalance))}</p>
          )}

          <p className={fy.qHead}>{W.stillOpen}</p>
          {!body.anyOpen ? <p className={ck.hint}>{W.nothingOpen(year.name)}</p> : (
            <div className={fy.list}>
              {body.o.installments.count > 0 && (
                <ListRow
                  title={isPhone ? W.installmentsShort(body.o.installments.count) : W.installments(body.o.installments.count)}
                  sub={installmentLines(body.o.installments.rows, isPhone)}
                  figure={money(body.o.installments.amount)} tone={body.o.installments.overdue.count > 0 ? 'bad' : undefined}
                  href={`${accountingBase}/allocations?view=coming-due`}
                />
              )}
              {body.o.requests.count > 0 && (
                <ListRow
                  title={isPhone ? W.requestsShort(body.o.requests.count) : W.requests(body.o.requests.count)}
                  sub={[joinWithAnd([...new Set(body.o.requests.rows.map(r => r.teamName))]),
                    body.o.requests.holdingPayout > 0 ? W.holdingPayout(body.o.requests.holdingPayout) : null].filter(Boolean).join(' · ')}
                  figure={money(body.o.requests.amount)} tone="warn"
                  href={`${accountingBase}/payment-requests`}
                />
              )}
              {body.o.unfiled.count > 0 && (
                <ListRow
                  title={isPhone ? W.unfiledShort(body.o.unfiled.count) : W.unfiled(body.o.unfiled.count)}
                  sub={W.unfiledWhy(year.name)}
                  figure={money(body.o.unfiled.amount)}
                  href={body.ledgerDoor(body.o.unfiled.ledger)}
                />
              )}
              {body.o.pending.count > 0 && (
                <ListRow
                  title={W.pending(body.o.pending.count)}
                  sub={isPhone ? W.pendingWhyShort(body.next) : W.pendingWhy(body.next)}
                  figure={money(body.o.pending.amount)}
                  href={body.ledgerDoor(body.o.pending.ledger)}
                />
              )}
            </div>
          )}

          {isPhone ? (
            <>
              <p className={fy.qHead}>{W.locksAndCarries}</p>
              <div className={fy.list}>
                <ListRow title={W.locksPhone(question.locks.books, body.span, year.name)} />
                <ListRow title={W.opensOn(body.next)} sub="locked" figure={money(question.carries.closingBalance)} />
              </div>
            </>
          ) : (
            <div className={fy.twoCol}>
              <div>
                <p className={fy.qHead}>{W.locks}</p>
                <div className={fy.list}>
                  <ListRow title={W.locksBooks(question.locks.books, body.span)} sub={W.locksBooksWhy(question.locks.lines)} />
                  <ListRow title={W.locksPlan(year.name)} sub={W.locksPlanWhy(question.locks.planLines)} />
                </div>
              </div>
              <div>
                <p className={fy.qHead}>{W.carries}</p>
                <div className={fy.list}>
                  <ListRow title={W.closing} sub={W.closingWhy(body.next)} figure={money(question.carries.closingBalance)} />
                  <ListRow title={W.plan} sub={W.planWhy(body.next, question.carries.nextPlanLines)} />
                </div>
              </div>
            </div>
          )}
          <p className={ck.hint}>{W.teamBooks}</p>
        </>
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
