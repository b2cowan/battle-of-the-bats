'use client';
/**
 * ⚖ PAYEES IS A WINDOW OVER THE LEDGER, AND A PAYEE IS A RECORD (Ledger Parity round 3 — D8, D9, D9a, ruled
 * 2026-10-02 from hub screens 10–11; the page it replaces was built the same day and never reached
 * production).
 *
 * Asked during the §258 walk: "do we need to open a new page for this? wouldn't a drawer be in line with our
 * portal standard?" and "I see entries of 1 but when I click it all I can do is change the name." So:
 *
 *   the list      — one room frame over the Ledger: the team's own payees, then (in a club) the ones the
 *                   club shares, each with Paid · Still to pay · Last paid THIS SEASON. New payee asks.
 *   one payee     — the same window, one level in, behind "← Payees" (`RoomShell back`): it READS first
 *                   (the 2026-10-01 standard) — Paid this season · Still to pay · Next due, this season's
 *                   entries as the LEDGER'S OWN ROWS (the panel draws them: `renderRows`), its note. One
 *                   pencil in the head turns the name and the note into a form that saves as you type; ✓
 *                   puts it back. Merge (or Delete, only when nothing names it) in the foot; Prev / Next
 *                   walk the list.
 *
 * ⚠ IT OPENS OVER WHATEVER OPENED IT. From Tools it sits over the Ledger, and a bill opened from a payee's
 * entries opens over IT (the panel draws this window first), so closing the bill returns to the payee. From
 * the payee picker inside an open bill or the Add a bill form it is `raised` above that form, and closes
 * back to it with the typing kept — the trip refused for tags (2026-09-01) is never taken. While raised its
 * entries are drawn but do not open: opening a record from there would land under or over the form the
 * coach is filling in.
 *
 * ⚠ ITS MONEY IS THE LEDGER'S, NOT A SECOND QUERY (`lib/payee-money.ts`). A payee shows only a name and a
 * note besides — those are all a payee stores; no contact fields are proposed.
 *
 * Reading is money-read (a read-only assistant opens a payee and reads it); every change is money-write.
 * A club's shared payee opens the same way, without the pencil and the merge — only the club changes it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Pencil, Plus, Users } from 'lucide-react';
import RoomShell, { type RoomNav, type RoomTile } from '@/components/coaches/RoomShell';
import QuestionShell from '@/components/coaches/QuestionShell';
import GuardedDelete from '@/components/coaches/GuardedDelete';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import CoachLoading from '@/components/coaches/CoachLoading';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import { ledgerKit } from '@/components/coaches/kit';
import { OWN_PAYEES_HEADING, SHARED_PAYEES_HEADING, SHARED_PAYEES_NOTICE } from '@/components/accounting/PayeeCombobox';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { ledgerRowDate } from '@/lib/ledger-format';
import { formatMoney, type RegisterBookRow } from '@/lib/coach-register';
import type { PayeeMoney } from '@/lib/payee-money';
import type { PayeeChange } from '@/lib/expense-payee';
import { PAYEE_NOTE_MAX } from '@/lib/team-payee-scope';
import type { SharedPayee, TeamPayee } from '@/lib/team-payees';
import { roomNeighbours } from '@/lib/room-neighbours';
import { pluralize } from '@/lib/utils';
import styles from '../../../coaches.module.css';
import own from './PayeesWindow.module.css';

/** One row of the window's list, either kind. `uses` = the team's bills naming it in EVERY season — it gates
 *  Delete (a shared payee is the club's: 0, never deleted here). */
interface Listed { id: string; name: string; scope: 'team' | 'club'; uses: number; notes: string | null }

const NO_MONEY: PayeeMoney = { paid: 0, toPay: 0, overdue: false, lastPaid: null, nextDue: null, rows: [] };
const dash = (n: number) => (n ? formatMoney(n) : '—');

export default function PayeesWindow({ orgSlug, teamId, open, raised, canWrite, money, renderRows, onClose, onChanged }: {
  orgSlug: string;
  teamId: string;
  /** Shown — and closed, never just hidden, when its tab goes away (the hub keeps panels mounted). */
  open: boolean;
  /** Opened from the payee picker inside another open window — stand above it (`overlayLayers.ts`). */
  raised: boolean;
  canWrite: boolean;
  /** This season's money per payee id, read from the Ledger's own rows. */
  money: Map<string, PayeeMoney>;
  /** A payee's rows, drawn as the Ledger draws them. */
  renderRows: (rows: RegisterBookRow[]) => ReactNode;
  onClose: () => void;
  onChanged: (change: PayeeChange) => void;
}) {
  const api = `/api/coaches/${orgSlug}/teams/${teamId}/payees`;
  const [data, setData] = useState<{ payees: TeamPayee[]; shared: SharedPayee[] } | null>(null);
  const [failed, setFailed] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [question, setQuestion] = useState<'new' | 'merge' | null>(null);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  /* The draft is seeded once per PAYEE — a refresh after a save must never overwrite what is being typed. */
  const [seededFor, setSeededFor] = useState<string | null>(null);

  /* Closed means closed: the next open starts on the list, and the next payee opened is seeded afresh — even
     the same one (/review 2026-10-02: a refused rename's text came back in the field after a close and reopen). */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) { setOpenId(null); setQuestion(null); setNotice(''); setEditing(false); setSeededFor(null); }
  }

  /* The newest read wins — a rename, a merge and a refresh can overlap, and a slow earlier read must not
     put a merged-away payee back on the list. */
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await moneyFetch<{ payees?: TeamPayee[]; shared?: SharedPayee[]; error?: string }>(`${api}?all=1`);
      if (mine !== seq.current) return;
      if (!r.ok) { setFailed(refusalText(r.data, 'We couldn’t load the team’s payees.')); return; }
      setFailed('');
      setData({ payees: r.data.payees ?? [], shared: r.data.shared ?? [] });
    } catch {
      if (mine === seq.current) setFailed('We couldn’t load the team’s payees. Check your connection and try again.');
    }
  }, [api]);
  // A frame later, so the read's first state write is not the effect's own (react-hooks/set-state-in-effect).
  /* ⚠ AND AGAIN WHENEVER THE LEDGER RE-READS (`money` is rebuilt only then). A bill opened from a payee's
     entries can take that payee off itself in the bill's own window; the figures follow the Ledger at once,
     but `uses` — which decides Merge or Delete — is this list's, and stayed at the old count: a payee
     nothing named any more still offered Merge, never Delete (owner, §258 walk 2026-10-02). */
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [open, load, money]);

  // Memoised: the panel this sits in re-renders on every keystroke of its money form.
  const listed: Listed[] = useMemo(() => (data ? [
    ...data.payees.map(p => ({ id: p.id, name: p.name, scope: 'team' as const, uses: p.uses, notes: p.notes })),
    ...data.shared.map(s => ({ id: s.id, name: s.name, scope: 'club' as const, uses: 0, notes: null })),
  ] : []), [data]);
  const current = openId ? listed.find(p => p.id === openId) ?? null : null;
  const mayEdit = canWrite && current?.scope === 'team';

  if (current && seededFor !== current.id) {
    setSeededFor(current.id);
    setName(current.name);
    setNotes(current.notes ?? '');
    setEditing(false);
    setDeleteError('');
  }

  const blocked = editing && !name.trim() ? 'Give the payee a name to save it.' : null;
  // The open payee by its id (state), and its saved name through a ref — `listed` is rebuilt on every render.
  const savedNameRef = useLatestRef(current?.name ?? '');
  const write = useCallback(async (signal: AbortSignal) => {
    if (!openId) return;
    const res = await fetch(`${api}/${openId}`, { ...jsonInit('PATCH', { name: name.trim(), notes: notes.trim() }), signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(body, 'Couldn’t save'));
    const saved = body.payee as { id: string; name: string; notes: string | null };
    const renamed = saved.name !== savedNameRef.current;
    setData(d => d && { ...d, payees: d.payees.map(p => (p.id === saved.id ? { ...p, name: saved.name, notes: saved.notes } : p)) });
    /* ⚠ AND A READ STARTED AFTER IT. The list also re-reads when the Ledger does (above), and a rename re-reads
       the Ledger — so a read sent while the NEXT save (the note typed just after) was in flight could land after
       it and put the old note back on screen. The newest read wins (`seq`), and this one began after the save. */
    void load();
    if (renamed) onChanged({ kind: 'renamed', id: saved.id, name: saved.name });
  }, [api, openId, name, notes, onChanged, savedNameRef, load]);
  // Held while a question about this payee is up, so it never writes under Merge or Delete.
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: editing && mayEdit, loading: question !== null, sig: `${name.trim()}\n${notes.trim()}`, blocked, write,
    failText: 'Couldn’t save',
  });

  /* ⚠ A refused save (the name is taken) holds the window ONCE, with the reason under the name; leaving again
     leaves it unsaved — never a window that cannot be closed (the autosave-close trap). */
  const refusedOnce = useRef(false);
  const flush = async (): Promise<boolean> => {
    if (!dirty || blocked || refusedOnce.current) return true;
    if (await handleSave()) return true;
    refusedOnce.current = true;
    return false;
  };
  /* Leaving a payee lets go of whatever was refused there: an abandoned edit must not sit "unsaved" and retry
     itself on the next payee, nor come back the next time this one opens (/review 2026-10-02). */
  const leave = () => { settle(); refusedOnce.current = false; };
  const close = async () => { if (await flush()) { leave(); onClose(); } };
  const toList = async () => { if (await flush()) { leave(); setOpenId(null); setEditing(false); } };
  const openPayee = async (id: string) => { if (await flush()) { leave(); setNotice(''); setOpenId(id); setSeededFor(null); } };
  // ✓ saves what is pending and goes back to reading — and stays while a value is held or the save fails.
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
  };
  // The pending edit lands before the merge question asks about the payee by its name.
  const askMerge = async () => { if (!dirty || (await handleSave())) setQuestion('merge'); };

  const done = (text: string, change: PayeeChange) => {
    setQuestion(null);
    setOpenId(null);
    setEditing(false);
    setNotice(text);
    // A deleted or merged-away payee leaves the list now — the re-read below lands about a second later.
    const gone = change.kind === 'deleted' ? change.id : change.kind === 'merged' ? change.from : null;
    if (gone) setData(d => d && { ...d, payees: d.payees.filter(p => p.id !== gone) });
    onChanged(change);
    void load();
  };

  /** Delete a payee nothing names — asked in the room's foot (`GuardedDelete`, every room's delete). The server
   *  refuses one a record still names, in words, and the words show above the record. */
  const deletePayee = async (p: Listed, shownName: string) => {
    if (deleting) return;
    setDeleting(true); setDeleteError('');
    try {
      const r = await moneyFetch(`${api}/${p.id}`, { method: 'DELETE' });
      if (!r.ok) { setDeleteError(refusalText(r.data, 'The payee couldn’t be deleted. Please try again.')); return; }
      done(`${shownName} is deleted.`, { kind: 'deleted', id: p.id });
    } catch {
      setDeleteError('The payee couldn’t be deleted. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Nothing below is built while the window is shut (the panel keeps it mounted).
  if (!open) return null;

  /* ── the list ── */
  const ownRows = listed.filter(p => p.scope === 'team');
  const sharedRows = listed.filter(p => p.scope === 'club');
  const listBody = failed ? (
    <CoachLoadError message={failed} onRetry={() => { void load(); }} />
  ) : !data ? (
    <CoachLoading label="Loading the team’s payees…" />
  ) : listed.length === 0 ? (
    <CoachEmptyState
      icon={<Users size={22} aria-hidden />}
      headline="No payees yet"
      description="Save a payee from a bill or a payment, or add one here."
      primaryAction={canWrite ? { label: 'New payee', icon: <Plus size={15} aria-hidden />, onClick: () => { setNotice(''); setQuestion('new'); } } : undefined}
    />
  ) : (
    <>
      <div className={`${styles.tableWrap} ${styles.tableAsCards} ${styles.cardsFramed}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Payee</th>
              <th className={`${styles.th} ${styles.thNum}`}>Paid</th>
              <th className={`${styles.th} ${styles.thNum}`}>Still to pay</th>
              <th className={styles.th}>Last paid</th>
              <th className={styles.th}><span className={styles.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {/* The two groups are bands of ONE table (standard: a group is a band row) — and only when there
                are two: a standalone team's payees are all its own. */}
            {sharedRows.length > 0 && ownRows.length > 0 && <Band label={OWN_PAYEES_HEADING} />}
            {ownRows.map(p => <ListRow key={p.id} p={p} m={money.get(p.id)} onOpen={() => void openPayee(p.id)} />)}
            {sharedRows.length > 0 && <Band label={SHARED_PAYEES_HEADING} />}
            {sharedRows.map(p => <ListRow key={p.id} p={p} m={money.get(p.id)} onOpen={() => void openPayee(p.id)} />)}
          </tbody>
        </table>
      </div>
      {sharedRows.length > 0 && (
        <p className={own.note}>
          {SHARED_PAYEES_NOTICE} Only the club can rename one. If your team has its own spelling of one, open yours and merge it in.
        </p>
      )}
    </>
  );

  /* ── one payee ── */
  const shownName = current ? (editing && name.trim()) || current.name : '';
  let roomProps: {
    title: ReactNode; ariaLabel: string; tiles?: RoomTile[]; actions?: ReactNode; facts?: ReactNode;
    children: ReactNode; fields?: ReactNode; footer?: ReactNode; nav?: RoomNav; subtitle?: ReactNode; headerExtra?: ReactNode;
    back?: { label: string; onBack: () => void };
  };
  if (current) {
    const m = money.get(current.id) ?? NO_MONEY;
    const tiles: RoomTile[] = [
      { label: 'Paid this season', value: formatMoney(m.paid) },
      { label: 'Still to pay', value: formatMoney(m.toPay), tone: m.overdue ? 'danger' as const : undefined },
      { label: 'Next due', value: m.nextDue ? formatMoney(m.nextDue.amount) : '—',
        sub: m.nextDue ? (m.nextDue.date ? ledgerRowDate(m.nextDue.date) : 'No date') : undefined },
    ];
    const canMerge = current.uses > 0 && (ownRows.length > 1 || sharedRows.length > 0);
    roomProps = {
      title: shownName,
      ariaLabel: `Payee ${shownName}`,
      subtitle: current.scope === 'club' ? `${SHARED_PAYEES_HEADING} · only the club can rename it`
        : sharedRows.length > 0 ? 'Your team’s own payee' : undefined,
      back: { label: 'Payees', onBack: () => void toList() },
      headerExtra: mayEdit ? (
        /* ONE button whose glyph flips, so focus stays on it (the practice plan's and the award's toggle),
           beside the ✕ — its slot takes the head's slack (`.headEnd`). */
        <span className={own.headEnd}>
          <button type="button" className={styles.ppIconBtn} aria-label={editing ? 'Done editing' : 'Edit this payee'}
            onClick={() => void toggleEdit()}>
            {editing ? <Check size={18} aria-hidden /> : <Pencil size={18} aria-hidden />}
          </button>
        </span>
      ) : undefined,
      tiles,
      children: (
        <>
          {deleteError && <p className={`${styles.errorText} ${own.error}`} role="alert">{deleteError}</p>}
          {/* The count only when there is one — "0 entries" over "Nothing recorded…" said it twice. */}
          <p className={styles.payDrawerLabel}>This season{m.rows.length > 0 && ` · ${pluralize(m.rows.length, 'entry', 'entries')}`}</p>
          {m.rows.length > 0 ? renderRows(m.rows) : <p className={own.empty}>Nothing recorded for {current.name} this season.</p>}
        </>
      ),
      fields: (
        <div className={own.details}>
          {/* Reading, the note is one fact under its own label, like "This season" above it — never a
              "Details" heading over a one-row label lane (the lane is a FORM's, and its label sat below a
              plain-text value; owner, §258 walk 2026-10-02). Editing, "Details" heads the two fields. */}
          <p className={styles.payDrawerLabel}>{editing ? 'Details' : 'Note'}</p>
          {editing ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="payee-name">Name *</label>
                <input id="payee-name" className={styles.input} value={name} maxLength={200} autoFocus
                  onChange={e => { setName(e.target.value); touch(); refusedOnce.current = false; }} />
                {/* The save word says only "Couldn't save"; the REASON (no name yet; the name is taken, merge them
                    instead) sits under the field it is about (/review 2026-10-02). */}
                {saveError
                  ? <p className={`${styles.errorText} ${own.hint}`} role="alert">{saveError}</p>
                  : <p className={own.hint}>A new name shows on every bill that names this payee.</p>}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="payee-note">Note</label>
                <textarea id="payee-note" className={styles.textarea} value={notes} maxLength={PAYEE_NOTE_MAX} rows={3}
                  placeholder="Who to contact, how they like to be paid…"
                  onChange={e => { setNotes(e.target.value); touch(); refusedOnce.current = false; }} />
              </div>
              <SaveStatusPill saving={saving} dirty={dirty} error={saveError || null} onRetry={() => void handleSave()} />
            </>
          ) : current.notes ? (
            <p className={own.noteText}>{current.notes}</p>
          ) : (
            <p className={own.empty}>No note.</p>
          )}
        </div>
      ),
      footer: mayEdit ? (
        current.uses === 0 ? (
          <GuardedDelete
            label="Delete this payee"
            refusal={null}
            confirmTitle={`Delete ${shownName}?`}
            confirmBody={<>Nothing names {shownName}, so nothing else changes.</>}
            deleting={deleting}
            onDelete={() => void deletePayee(current, shownName)}
          />
        ) : canMerge ? (
          <button type="button" className={styles.btnSecondary} onClick={() => void askMerge()}>Merge into another payee</button>
        ) : undefined
      ) : undefined,
      nav: listed.length > 1 ? {
        ...roomNeighbours(listed, current.id, p => p.id, p => p.name),
        noun: 'payees',
        onSelect: id => void openPayee(id),
      } : undefined,
    };
  } else {
    roomProps = {
      title: 'Payees',
      ariaLabel: 'Payees',
      facts: data && listed.length > 0 ? `${pluralize(listed.length, 'payee')} · paid and still to pay this season` : undefined,
      actions: canWrite && data && listed.length > 0 ? (
        /* White, with the list it adds to (a drill-in has no lime); on a phone the word goes and the "+" stays. */
        <button type="button" className={`${styles.btnSecondary} ${own.newBtn}`} aria-label="New payee"
          onClick={() => { setNotice(''); setQuestion('new'); }}>
          <Plus size={15} aria-hidden /><span className={styles.headerBtnLabel}>New payee</span>
        </button>
      ) : undefined,
      children: (
        <>
          {notice && <p className={`${styles.successText} ${own.notice}`} role="status">{notice}</p>}
          {listBody}
        </>
      ),
    };
  }

  const currentTeamPayee = current?.scope === 'team' ? { ...current, name: shownName } : null;
  return (
    <>
      <RoomShell
        open
        onClose={() => void close()}
        busy={saving || deleting}
        raised={raised}
        recordKey={openId ?? 'list'}
        sentinel="payees"
        loaded={!!data || !!failed}
        {...roomProps}
      >
        {roomProps.children}
      </RoomShell>
      {question === 'new' && (
        <NewPayeeQuestion api={api} raised={raised} onClose={() => setQuestion(null)}
          onAdded={added => { setQuestion(null); setNotice(`${added} added.`); onChanged({ kind: 'added', name: added }); void load(); }} />
      )}
      {question === 'merge' && currentTeamPayee && (
        <MergeQuestion payee={currentTeamPayee} others={ownRows.filter(p => p.id !== currentTeamPayee.id)} shared={sharedRows}
          api={api} raised={raised} onBack={() => setQuestion(null)} onDone={done} />
      )}
    </>
  );
}

/** A band row naming one of the list's two groups — a plain line between the rows on a phone. */
function Band({ label }: { label: string }) {
  return (
    <tr className={`${styles.payBandRow} ${own.band}`}>
      <td className={styles.payBandCell} colSpan={5}>
        <div className={styles.payBandInner}><span className={styles.payBandLabel}>{label}</span></div>
      </td>
    </tr>
  );
}

/**
 * A payee's row: Paid · Still to pay · Last paid this season, one chevron. On a phone the figures are a line
 * UNDER the name (owner, 2026-10-02: "put the subtext under the name on the phone so we aren't squishing the
 * names") — the framed card the practice libraries use, never the one-line variant.
 */
function ListRow({ p, m, onOpen }: { p: Listed; m: PayeeMoney | undefined; onOpen: () => void }) {
  const paid = m?.paid ?? 0;
  const toPay = m?.toPay ?? 0;
  const line = [paid ? `${formatMoney(paid)} paid` : null, toPay ? `${formatMoney(toPay)} to pay` : null]
    .filter(Boolean).join(' · ') || 'Nothing this season';
  return (
    <tr className={`${styles.tr} ${styles.rowTappable}`} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(); }}>
      <td className={`${styles.td} ${styles.cardStackCell} ${own.leadCell}`}>
        {/* The row's keyboard door. A list's name column is bold (standard §3.6); a shared payee wears the club's blue. */}
        {/* `rowTapLink` (table standard §3.6): a full 44px tap box that BORROWS the row's height, so the
            phone's figure line still sits right under the name. ⚠ Not the Ledger kit's `.name` — its
            `margin: 0; padding: 0` sits at the same specificity as the marker and, by bundle order, undid it. */}
        <button type="button" className={`${styles.rowTapLink} ${own.name}${p.scope === 'club' ? ` ${own.shared}` : ''}`}
          aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(); }}>
          {p.name}
        </button>
        <span className={styles.cardPhoneLine}>{line}</span>
      </td>
      <td className={`${styles.td} ${styles.tdNum} ${styles.cardDesktopCell}`}>{dash(paid)}</td>
      <td className={`${styles.td} ${styles.tdNum} ${styles.cardDesktopCell}`}>{dash(toPay)}</td>
      <td className={`${styles.td} ${styles.tdDate} ${styles.cardDesktopCell}`}>{m?.lastPaid ? ledgerRowDate(m.lastPaid) : '—'}</td>
      {/* The Ledger's own chevron cell, at the width of its chevron: right-aligned on the row's edge, the
          slack left to the name (owner, 2026-10-02: a left-aligned chevron in a wide last column sat
          ~130px in from the edge). */}
      <td className={`${styles.td} ${styles.tdShrink} ${ledgerKit.goCell} ${styles.cardActionCorner}`}>
        <span className={ledgerKit.goMark} aria-hidden><ChevronRight size={16} /></span>
      </td>
    </tr>
  );
}

/**
 * Merge this payee into another: the club's shared payees first, marked as the club's, then the team's own.
 * ⚠ Merging into a SHARED payee puts these entries in front of the club — the question says so before the
 * tap, and choosing it is the consent (session 1's call list).
 */
function MergeQuestion({ payee, others, shared, api, raised, onBack, onDone }: {
  payee: Listed; others: Listed[]; shared: Listed[]; api: string; raised: boolean;
  onBack: () => void; onDone: (text: string, change: PayeeChange) => void;
}) {
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keepShared = shared.find(s => s.id === into) ?? null;
  const keep = keepShared ?? others.find(o => o.id === into) ?? null;
  const entries = pluralize(payee.uses, 'entry', 'entries');
  async function go() {
    if (busy) return;
    if (!keep) { setError('Choose the payee to keep.'); return; }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ moved?: number; error?: string }>(`${api}/${payee.id}/merge`, jsonInit('POST', { intoPayeeId: keep.id }));
      if (!r.ok) { setError(refusalText(r.data, 'The payees couldn’t be merged. Please try again.')); return; }
      const moved = r.data.moved ?? payee.uses;
      onDone(`${pluralize(moved, 'entry', 'entries')} moved to ${keep.name}. ${payee.name} is gone.`,
        { kind: 'merged', from: payee.id, into: keep.id, intoName: keep.name });
    } catch {
      setError('The payees couldn’t be merged. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <QuestionShell open onClose={onBack} onBack={onBack} busy={busy} raised={raised}
      ariaLabel={`Merge ${payee.name} into another payee`} title={`Merge ${payee.name} into another payee?`}>
      <>
        {error && <p className={`${styles.errorText} ${own.error}`} role="alert">{error}</p>}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="merge-into">Keep *</label>
          <select id="merge-into" className={styles.select} value={into} onChange={e => { setInto(e.target.value); setError(''); }}>
            <option value="">Choose a payee…</option>
            {shared.length > 0 && (
              <optgroup label={SHARED_PAYEES_HEADING}>
                {shared.map(s => <option key={s.id} value={s.id}>{s.name} (the club’s)</option>)}
              </optgroup>
            )}
            {others.length > 0 && (
              shared.length > 0
                ? <optgroup label={OWN_PAYEES_HEADING}>{others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                : others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
            )}
          </select>
        </div>
        <p className={`${own.lead} ${own.afterField}`}>{keep
          ? `${entries} move${payee.uses === 1 ? 's' : ''} to ${keep.name}, and ${payee.name} is removed.`
          : `Every entry naming ${payee.name} (${payee.uses}) moves to the payee you keep, and ${payee.name} is removed.`}</p>
        {keepShared && (
          <p className={own.consent}>
            {keepShared.name} is shared by your club, so your club will see {payee.uses === 1 ? 'this entry' : `these ${entries}`}.
          </p>
        )}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onBack} disabled={busy}>Back</button>
          <button type="button" className={styles.btnPrimary} onClick={() => void go()} disabled={busy || !keep}>{busy ? 'Merging…' : 'Merge'}</button>
        </div>
      </>
    </QuestionShell>
  );
}

/** A new payee — a create, so it asks (edit autosaves, create asks — 2026-09-24). */
function NewPayeeQuestion({ api, raised, onClose, onAdded }: { api: string; raised: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add() {
    if (busy) return;
    if (!name.trim()) { setError('Give the payee a name.'); return; }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(api, jsonInit('POST', { name: name.trim() }));
      if (!r.ok) { setError(refusalText(r.data, 'The payee couldn’t be added. Please try again.')); return; }
      onAdded(name.trim());
    } catch {
      setError('The payee couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <QuestionShell open onClose={onClose} busy={busy} raised={raised} ariaLabel="New payee" title="New payee"
      leaveGuard={{ dirty: !!name.trim(), message: 'Leave without adding this payee?' }}>
      <form onSubmit={e => { e.preventDefault(); void add(); }}>
        {error && <p className={`${styles.errorText} ${own.error}`} role="alert">{error}</p>}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-payee">Name *</label>
          <input id="new-payee" className={styles.input} value={name} maxLength={200} autoFocus
            placeholder="For example: Town of Northfield" onChange={e => { setName(e.target.value); setError(''); }} />
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'Adding…' : 'Add payee'}</button>
        </div>
      </form>
    </QuestionShell>
  );
}
