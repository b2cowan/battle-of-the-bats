'use client';
/**
 * ⚖ AN ALLOCATION IS A WINDOW THAT READS THE BILL FIRST (Club Tier Stage 3d — Asks 3, 4 and 5; S3D-02…05; design
 * decisions 2026-10-08). The page it replaces (`accounting/allocations/[allocationId]`) retired; its address forwards
 * to Allocations with this window open (proxy.ts).
 *
 * ONE COMPONENT, opened by id from every door — whatever screen it opens over reads its own figures again when money
 * moves inside it (`onChanged`). Two levels, one window, 800 px wide at both (its body is a table):
 *
 *   the allocation — reads first: its line and the fiscal year it counts in as the eyebrow ("Diamond permits — city
 *                    fields · 2026–27"; "Off-plan · …" without a line; the lock on a closed year), the name, the four
 *                    figures as the portal's ONE joined band (the server's one definitions; Overdue in the verdict
 *                    tone), the schedule in one read line, the teams table unchanged from the page (Needs you / On
 *                    track, a chip only where there is something to say, the closing row; a row opens the bill), then
 *                    the club's note. The page's note under the table went (CD4: every list opens that way).
 *                    The foot: Export (the page's file, a row per installment — the one window in Accounting with an
 *                    Export, because which payment paid which installment has a reader) and, opened from the
 *                    Allocations list only, Previous · Next through it. ⚠ NO SEND REMINDERS (S3D-04: it was the whole
 *                    club's wave); the Allocations tab and each team's bill keep theirs.
 *                    The pencil (a money mover, an open year): the NAME and the NOTE, and nothing else — its terms
 *                    never change after it is made (Ask 7b). They save as you go (the floating pill); a blank name is
 *                    held, its reason under the field; ✓ saves what is pending first. A closed year's allocation reads
 *                    with no pencil and one locked line; its unpaid installments stay receivable.
 *   a team's bill  — one level in, IN PLACE, behind "← {the allocation}" (Ask 4): 3a's bill room unchanged in what it
 *                    says and does, its figures the same joined band. Record, Confirm, Undo and Remind hand off in the
 *                    bill's place and come back to it. A door to one team's bill opens the window at this level, and
 *                    Back goes up to the allocation before it goes out.
 *
 * A WINDOW THAT HANDS OFF (a budget line, From the teams, a Ledger line, behind the figure — Ask 5) turns into this one
 * and back through `useAllocationHandOff`, below: one state, one early return, one set of props, for every such door.
 * A host that steps it through a list (the Allocations tab) keys it by the allocation, so the next one starts afresh.
 *
 * WHO: anyone who can read the club's books reads it; the pencil and every money move are the club's accounting's
 * (3a's one rule — `canMove`/`canEdit` from the server). A member limited to some team groups sees only their teams.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import KitDialog, { type KitStep } from '../KitDialog';
import ck from '../ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, LoadFailed, NoticePill, RepChip, SavePill, repKit, useDeferredLoad, useLatestRead,
} from '../RepKit';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import ExportMenu from '@/components/admin/ExportMenu';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { ALLOCATION_WINDOW_WORDS, NEW_ALLOCATION_WORDS, methodWord } from '@/lib/club-money-words';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import type { ClubBillFigures } from '@/lib/club-money-figures';
import { BillRoom, RecordWindow, UndoWindow, type BillInstallment, type TeamBill } from './BillWindows';
import RemindersWindow from './RemindersWindow';
import { FormError, LateChip, TextField, day, installmentsWord, jsonInit, money, moneyFetch, moneyKit, refusalText } from './MoneyKit';
import fy from './FiscalYear.module.css';
import own from './AllocationRecordWindow.module.css';

const W = ALLOCATION_WINDOW_WORDS;

export interface AllocationRead {
  asOf: string;
  canMove: boolean;
  /** Its name and note may change: a money mover, on an open year (Ask 3). */
  canEdit: boolean;
  budgetLineName: string | null;
  /** The fiscal year it counts in; `reopen` the year Reopen would unlock (the latest closed), for this reader. */
  year: { key: string; name: string; locked: boolean; reopen: string | null };
  allocation: { id: string; description: string; createdAt: string; totalAmount: number; notes: string | null };
  allocated: number;
  figures: ClubBillFigures;
  teams: TeamBill[];
}

const BAND_WORD = { needs_you: 'needs you', on_track: 'on track' } as const;

/** The team's next installment the club doesn't have yet (overdue first, by due date). */
function nextOf(b: TeamBill): BillInstallment | null {
  return b.installments.filter(i => i.state !== 'received').sort((x, y) => x.dueDate.localeCompare(y.dueDate))[0] ?? null;
}

type Question = null | { kind: 'record'; mode: 'receive' | 'confirm'; installmentId: string } | { kind: 'undo' } | { kind: 'remind' };

export default function AllocationRecordWindow({ q, orgSlug, allocationId, bill = null, steps = null, addressOf, onChanged, onClose }: {
  q: string;
  orgSlug: string;
  /** Its allocation. ⚠ A host that changes it while the window stays open (Previous · Next) keys the window by it. */
  allocationId: string;
  /** The team's bill on screen (a split id), or null for the allocation. A door to one bill opens here. */
  bill?: string | null;
  /** Opened from the Allocations list: its neighbours there (Ask 3 — only from that list). */
  steps?: { prev: KitStep | null; next: KitStep | null; position: string } | null;
  /** The window as a place in the URL bar — from the host whose address it is (the Allocations tab), at a level (a
   *  team's bill, or null for the allocation). Each level's Back step writes it (KitDialog `address`); a bill is keyed
   *  so stepping to the next one writes the next address. Without it the window names no place. */
  addressOf?: (bill: string | null) => string;
  /** Money moved, or the name or the note changed: the screen underneath reads its own figures again. */
  onChanged?: () => void;
  onClose: () => void;
}) {
  const { currentOrg, user } = useOrg();
  const senderName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'you';
  const isPhone = useIsPhone();
  const accountingBase = `/${orgSlug}/admin/accounting`;

  // The level on screen: the team's bill it opened at (a door to one bill), or the allocation.
  const [openSplit, setOpenSplit] = useState<string | null>(bill);

  const [read, setRead] = useState<AllocationRead | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  const [question, setQuestion] = useState<Question>(null);
  /** What a money move just did — said once in the window's floating pill (the page used to say it in its notice). */
  const [said, setSaid] = useState<string | null>(null);

  // The newest read wins (the kit's `useLatestRead`): a money move and a rename can overlap.
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<AllocationRead>(`/api/admin/accounting/allocations/${allocationId}?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notFound: r?.status === 404 || r?.status === 403 }); return; }
    setFailed(null);
    setRead(r.data);
  }, [allocationId, q, beginRead]);
  useDeferredLoad(true, load);

  /** A money move landed (or the bill changed under us): re-read here, and tell the screen underneath. */
  const after = (text: string | null, keepOpen = false) => {
    if (text) setSaid(text);
    if (!keepOpen) setQuestion(null);
    void load();
    onChanged?.();
  };

  // Only the FIRST read's failure takes the window over; a re-read that fails (after a money move) keeps what it shows.
  if (failed && !read) {
    return (
      <KitDialog kind="form" wide title="Allocation" onClose={onClose} address={addressOf?.(openSplit)}>
        {failed.notFound
          ? <LoadFailed title={W.notFound} sub={W.notFoundSub} />
          : <LoadFailed title={W.loadFailed} onRetry={() => void load()} />}
      </KitDialog>
    );
  }
  if (!read) {
    return (
      <KitDialog kind="form" wide title="Allocation" onClose={onClose} address={addressOf?.(openSplit)}
        steps={steps ? { ...steps, noun: 'allocation' } : undefined}>
        <p className={ck.loading}>{W.loading}</p>
      </KitDialog>
    );
  }

  const bills = read.teams;
  const theBill = bills.find(t => t.splitId === openSplit) ?? null;

  // ── A team's bill, one level in — and the questions it hands off to, in its place ──
  if (theBill) {
    const inBand = bills.filter(t => t.band === theBill.band);
    const at = inBand.findIndex(t => t.splitId === theBill.splitId);
    const stepTo = (t: TeamBill | undefined): KitStep | null => (t ? { name: t.teamName, onStep: () => { setSaid(null); setOpenSplit(t.splitId); } } : null);
    const recordFor = question?.kind === 'record' ? theBill.installments.find(i => i.id === question.installmentId) ?? null : null;
    if (question?.kind === 'record' && recordFor) {
      return (
        <RecordWindow mode={question.mode} allocation={read.allocation} bill={theBill} installment={recordFor} q={q}
          onClose={() => setQuestion(null)} onDone={after} />
      );
    }
    if (question?.kind === 'undo') {
      return <UndoWindow allocation={read.allocation} bill={theBill} q={q} onClose={() => setQuestion(null)} onDone={after} />;
    }
    if (question?.kind === 'remind' && currentOrg) {
      return (
        <RemindersWindow q={q} orgName={currentOrg.name} senderName={senderName} team={{ id: theBill.teamId, name: theBill.teamName }}
          onClose={() => setQuestion(null)} onSent={text => after(text)} />
      );
    }
    return (
      <BillRoom
        // Keyed by the bill: stepping to the next team's bill is a new place (its own address, its own Back step).
        key={theBill.splitId}
        address={addressOf?.(theBill.splitId)}
        allocation={read.allocation}
        bill={theBill}
        bandWord={BAND_WORD[theBill.band]}
        position={`${at + 1} of ${inBand.length}`}
        steps={{ prev: stepTo(inBand[at - 1]), next: stepTo(inBand[at + 1]) }}
        canMove={read.canMove}
        accountingBase={accountingBase}
        back={{ label: read.allocation.description, onBack: () => { setSaid(null); setQuestion(null); setOpenSplit(null); } }}
        wide
        status={said ? <NoticePill inline key={said} message={said} onDone={() => setSaid(null)} /> : undefined}
        onRecord={(i, mode) => { setSaid(null); setQuestion({ kind: 'record', mode, installmentId: i.id }); }}
        onUndo={() => { setSaid(null); setQuestion({ kind: 'undo' }); }}
        onRemind={() => { setSaid(null); setQuestion({ kind: 'remind' }); }}
        onClose={onClose}
      />
    );
  }

  return (
    <AllocationLevel
      key={read.allocation.id}
      read={read}
      q={q}
      orgSlug={orgSlug}
      isPhone={isPhone}
      steps={steps}
      address={addressOf?.(null)}
      said={said}
      onSaidDone={() => setSaid(null)}
      onOpenBill={id => { setSaid(null); setOpenSplit(id); }}
      onSaved={() => { void load(); }}
      onChanged={onChanged}
      onClose={onClose}
    />
  );
}

/**
 * A WINDOW THAT HANDS OFF TO AN ALLOCATION (Ask 5 — "from a window, that window turns into the allocation's, and ×
 * turns it back"): a budget line, From the teams, a Ledger line, behind the figure. `open` turns the host into the
 * allocation's window (at a team's bill when given one); the host renders `shown` in its own place while it is set.
 */
export function useAllocationHandOff({ q, orgSlug, onChanged }: { q: string; orgSlug: string; onChanged?: () => void }) {
  const [viewing, setViewing] = useState<{ id: string; bill: string | null } | null>(null);
  const shown = viewing ? (
    <AllocationRecordWindow q={q} orgSlug={orgSlug} allocationId={viewing.id} bill={viewing.bill}
      onChanged={onChanged} onClose={() => setViewing(null)} />
  ) : null;
  return { open: (id: string, bill: string | null = null) => setViewing({ id, bill }), shown };
}

/** The allocation itself: reads first; the pencil edits its name and its note (Ask 3). */
function AllocationLevel({ read, q, orgSlug, isPhone, steps, address, said, onSaidDone, onOpenBill, onSaved, onChanged, onClose }: {
  read: AllocationRead; q: string; orgSlug: string; isPhone: boolean;
  steps: { prev: KitStep | null; next: KitStep | null; position: string } | null;
  address?: string;
  said: string | null; onSaidDone: () => void;
  onOpenBill: (splitId: string) => void;
  /** A name or a note landed: the window re-reads (the title prints the saved name). */
  onSaved: () => void;
  onChanged?: () => void;
  onClose: () => void;
}) {
  const a = read.allocation;
  const f = read.figures;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.description);
  const [note, setNote] = useState(a.notes ?? '');
  /** What the server holds now — each save's own values, so an edit changed back is still sent (3b's lesson). */
  const [held, setHeld] = useState({ name: a.description, note: a.notes ?? '' });
  /** A save landed this visit: the screen underneath re-reads on the way out (its rows print the name). */
  const saved = useRef(false);

  const nameMissing = !name.trim();
  const blocked = nameMissing ? W.nameMissing : null;
  const write = useCallback(async (signal: AbortSignal) => {
    const body: { description?: string; notes?: string | null } = {};
    if (name.trim() !== held.name) body.description = name.trim();
    if (note.trim() !== held.note) body.notes = note.trim() || null;
    if (body.description === undefined && body.notes === undefined) return;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/accounting/allocations/${a.id}?${q}`, { ...jsonInit('PATCH', body), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    saved.current = true;
    setHeld({ name: data?.allocation?.description ?? name.trim(), note: data?.allocation?.notes ?? '' });
  }, [a.id, q, name, note, held]);
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: editing && read.canEdit, loading: false, sig: `${name.trim()}\n${note.trim()}`, blocked, write, failText: 'Couldn’t save',
  });

  // ✓ saves what is pending first, and stays while a name is held or the save fails. Reading again re-reads the bill,
  // so the title prints the saved name; the screen underneath re-reads once, on the way out.
  const toggleEdit = async () => {
    if (!editing) { setName(held.name); setNote(held.note); setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
    if (saved.current) onSaved();
  };
  // ⚠ A refused save holds the window ONCE, with the reason in its pill; leaving again leaves it unsaved — never a
  // window that cannot be closed (the autosave-close trap).
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (saved.current) onChanged?.();
    onClose();
  };
  /* ⚠ LEAVING THE LEVEL ANOTHER WAY — a team's row, Previous · Next — goes through the same hold (/review 2026-10-08:
     a name typed inside the save's 0.9s was dropped, and one that had saved left the list and the bill reading the old
     name). What is pending saves first; what saved re-reads the window (the bill's back names it) and the list. */
  const leaveThen = async (go: () => void) => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (saved.current) { saved.current = false; onChanged?.(); onSaved(); }
    go();
  };
  // The step's handler reads the save's refs when it is PRESSED (the kit calls `onStep` from a click), never during render.
  // eslint-disable-next-line react-hooks/refs
  const leaveStep = (s: KitStep | null): KitStep | null => (s ? { name: s.name, onStep: () => void leaveThen(s.onStep) } : null);

  // ── The four figures: the page's, as one joined band (owner, 2026-10-08) ──
  const teamCount = read.teams.length;
  const shares = new Set(read.teams.map(t => t.allocated));
  const perTeam = shares.size === 1 ? read.teams[0]?.allocated ?? null : null;
  const overdueTeams = read.teams.filter(t => t.figures.overdue.count > 0).map(t => t.teamName);
  const instCount = Math.max(0, ...read.teams.map(t => t.installments.length));
  const dues = [...new Set(read.teams.flatMap(t => t.installments.map(i => i.dueDate)))].sort().map(d => day(d));
  const schedule = W.schedule(installmentsWord(instCount, true), dues);
  const bands = { needs_you: read.teams.filter(t => t.band === 'needs_you'), on_track: read.teams.filter(t => t.band === 'on_track') };

  const eyebrow = (
    <>
      {W.eyebrow(read.budgetLineName, read.year.name)}
      {read.year.locked && <Lock size={12} className={own.eyebrowLock} role="img" aria-label={W.closedYear} />}
    </>
  );

  return (
    <KitDialog
      kind="form"
      wide
      eyebrow={eyebrow}
      title={held.name}
      onClose={() => void close()}
      edit={read.canEdit ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${held.name}` } : undefined}
      status={editing
        ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} />
        : said ? <NoticePill inline key={said} message={said} onDone={onSaidDone} /> : undefined}
      footerStart={<AllocationExport read={read} orgSlug={orgSlug} />}
      steps={steps ? { prev: leaveStep(steps.prev), next: leaveStep(steps.next), position: steps.position, noun: 'allocation' } : undefined}
      address={address}
    >
      {read.year.locked && (
        <p className={own.lockLine}>
          <Lock size={14} aria-hidden className={own.lockLineIcon} />
          <span>{W.closedLine(read.year.name, read.year.reopen)}</span>
        </p>
      )}
      {editing && (
        <>
          <TextField id="al-name" label={W.nameLabel} required value={name} maxLength={200}
            onChange={v => { setName(v); touch(); closeRefused.current = false; }}
            hint={nameMissing ? undefined : W.nameHint} />
          {/* A blank name's reason, under its field — the pill says only that the save is held. */}
          {nameMissing && <FormError inPlace>{W.nameMissing}</FormError>}
          <label className={ck.field} htmlFor="al-note">
            <span className={ck.label}>{W.noteLabel}</span>
            <textarea id="al-note" className={ck.textarea} rows={3} maxLength={2000} value={note}
              placeholder={NEW_ALLOCATION_WORDS.notesHint}
              onChange={e => { setNote(e.target.value); touch(); closeRefused.current = false; }} />
          </label>
        </>
      )}
      <div className={moneyKit.windowBand}>
        <MoneySummaryBand
          ariaLabel={`${a.description}: the bill`}
          tiles={[
            { key: 'allocated', label: W.allocated, figure: money(read.allocated), caption: W.allocatedCaption(teamCount, perTeam != null ? money(perTeam) : null) },
            { key: 'collected', label: W.collected, figure: money(f.collected), caption: W.collectedCaption(f.receivedCount, f.installmentCount) },
            { key: 'outstanding', label: W.outstanding, figure: money(f.outstanding), caption: W.outstandingCaption(f.installmentCount - f.receivedCount) },
            { key: 'overdue', label: W.overdue, figure: money(f.overdue.amount), tone: f.overdue.amount > 0 ? 'danger' : 'plain', caption: W.overdueCaption(overdueTeams) },
          ]}
        />
      </div>
      {isPhone ? (
        <p className={ck.hint}>{schedule}</p>
      ) : (
        <dl className={fy.read}><dt>{W.scheduleLabel}</dt><dd>{schedule}</dd></dl>
      )}

      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={`${repKit.table} ${own.teams}`}>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Head coach</th>
              <th scope="col" className={repKit.num}>Collected</th>
              <th scope="col" className={repKit.num}>Outstanding</th>
              <th scope="col">Next</th>
              <th scope="col">State</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {(['needs_you', 'on_track'] as const).map(b => bands[b].length > 0 && (
              <BandRows key={b} label={`${b === 'needs_you' ? 'Needs you' : 'On track'} · ${bands[b].length}`} teams={bands[b]} onOpen={id => void leaveThen(() => onOpenBill(id))} />
            ))}
            <tr className={moneyKit.closeRow}>
              <td colSpan={2}>{pluralize(teamCount, 'team')}</td>
              <td className={repKit.num}>{money(f.collected)}</td>
              <td className={repKit.num}>{money(f.outstanding)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>
        {/* Inside a window the frame paints and the list is inset (one painter — the drawing's framed rows). */}
        <ClubRowFrame><ClubRowList inset label="Teams">
          {(['needs_you', 'on_track'] as const).map(b => bands[b].length > 0 && (
            <PhoneBand key={b} label={`${b === 'needs_you' ? 'Needs you' : 'On track'} · ${bands[b].length}`} teams={bands[b]} onOpen={id => void leaveThen(() => onOpenBill(id))} />
          ))}
        </ClubRowList></ClubRowFrame>
      </div>

      {/* The club's note (S3D-03), last — the field above holds it while editing, so it is said once. */}
      {!editing && (
        isPhone ? (
          <p className={own.notePhone}><span className={own.noteLabel}>{W.noteLabel}</span>{a.notes ?? <span className={repKit.dim}>{W.noNote}</span>}</p>
        ) : (
          <dl className={`${fy.read} ${own.note}`}><dt>{W.noteLabel}</dt><dd className={a.notes ? own.noteText : own.noNote}>{a.notes ?? W.noNote}</dd></dl>
        )
      )}
    </KitDialog>
  );
}

function stateChip(t: TeamBill): ReactNode {
  if (t.band !== 'needs_you') return <span className={repKit.dim}>—</span>;
  if (t.figures.overdue.count > 0) {
    const days = t.installments.filter(i => i.state === 'overdue').reduce((m, i) => Math.max(m, i.daysLate), 0);
    return <LateChip days={days} />;
  }
  return <RepChip tone="info">Sent · confirm</RepChip>;
}

function BandRows({ label, teams, onOpen }: { label: string; teams: TeamBill[]; onOpen: (splitId: string) => void }) {
  return (
    <>
      <tr className={repKit.band}><td colSpan={7}>{label}</td></tr>
      {teams.map(t => {
        const next = nextOf(t);
        return (
          <tr key={t.splitId} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(t.splitId); }}>
            <td>
              <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); onOpen(t.splitId); }}>{t.teamName}</button>
            </td>
            <td className={t.headCoaches.length ? undefined : repKit.dim}>{t.headCoaches.length ? t.headCoaches.join(', ') : W.noHeadCoach}</td>
            <td className={repKit.num}>{money(t.figures.collected)}</td>
            <td className={repKit.num}>{money(t.figures.outstanding)}</td>
            {/* Next keeps its date and amount on one line at 800 px; Head coach gives way first (the drawing). */}
            <td className={own.next}>{next ? `${day(next.dueDate)} · ${money(next.amount)}` : <span className={repKit.dim}>{W.paidInFull}</span>}</td>
            <td>{stateChip(t)}</td>
            <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
          </tr>
        );
      })}
    </>
  );
}

function PhoneBand({ label, teams, onOpen }: { label: string; teams: TeamBill[]; onOpen: (splitId: string) => void }) {
  return (
    <>
      <ClubRowBand>{label}</ClubRowBand>
      {teams.map(t => {
        const next = nextOf(t);
        const chip = t.band === 'needs_you' ? stateChip(t) : null;
        return (
          <ClubRow key={t.splitId} as="button" onClick={() => onOpen(t.splitId)}
            title={<>{t.teamName} {chip}</>}
            caption={W.phoneRow(money(t.figures.collected), money(t.allocated), next ? day(next.dueDate) : null)}
            chevron />
        );
      })}
    </>
  );
}

/** The allocation's own file — a row per installment, with the team, and each payment's method and reference (3a ruled
 *  the build must not drop it). Moved from the retired page unchanged. */
function AllocationExport({ read, orgSlug }: { read: AllocationRead; orgSlug: string }) {
  const headers = ['Team', 'Installment', 'Amount', 'Due', 'State', 'Received on', 'How it came', 'Reference', 'Recorded by', 'Sent on (coach)'];
  const STATE = { received: 'Received', sent: 'Sent · waiting for the club', overdue: 'Overdue', upcoming: 'Not due yet' } as const;
  const body = () => read.teams.flatMap(t => t.installments.map(i => [
    t.teamName, `${i.installmentNumber} of ${t.installments.length}`, i.amount, i.dueDate, STATE[i.state],
    i.received?.on ?? '', methodWord(i.received?.method) ?? '', i.received?.reference ?? '',
    i.received?.recordedBy ?? '', i.sent?.on ?? '',
  ]));
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: read.allocation.description, scope: formatStoredDate(read.asOf) }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={read.teams.length === 0}
      onExportXLSX={() => downloadXLSX(name('xlsx'), headers, body(), 'Allocation')}
      onExportCSV={() => downloadCSVBlob(name('csv'), generateCSV(headers, body()))}
    />
  );
}
