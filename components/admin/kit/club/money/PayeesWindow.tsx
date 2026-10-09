'use client';
/**
 * ⚖ THE CLUB'S PAYEES IS A WINDOW OVER ITS LEDGER, AND A PAYEE OPENS INSIDE IT (Club Tier Stage 3d — Asks 1, 2 and 7a;
 * design decisions 2026-10-08; it rules Ledger Parity D8a with D8). The Payees PAGE it replaces
 * (`accounting/payees`) retired: its address opens the Ledger with this window open, and `?payee=` (and the report page
 * 3c retired) at that payee (proxy.ts). The coach's `PayeesWindow` is the benchmark for its levels.
 *
 *   the list  — a 640 px form window: eyebrow "Ledger", title "Payees". The page's table unchanged (Payee · Entries · Last
 *               used · Teams for a club with teams · one chevron; a row opens from anywhere on it) and its note word for
 *               word; New payee in the foot (white — a list's add is not the screen's main action — and it asks).
 *   a payee   — the same window, ONE LEVEL IN, behind "← Payees" (Ask 2). What it says is §283 W10's, unchanged: the
 *               eyebrow (shared or not), the one read line ("In the club's Ledger · N entries, the latest …"), and for a
 *               shared payee what the teams recorded as its body (the Year pill only past one year). The pencil turns
 *               Name and Shared with teams into the form (the name saves as you go, the switch on the tap); ✓ turns it
 *               back. Three chrome changes from the page's window: Previous · Next through the list in the foot (the
 *               2026-09-30 ruling for an admin record opened from a list); no Done (← Payees and × already exist);
 *               Delete — only when nothing names the payee — LEAVES THE FOOT and ends the body, alone, red, asking first.
 *               Merge stays at the foot's left. A refused rename holds the window once; leaving the level, stepping and
 *               closing all go through the same hold.
 *
 * ⚠ IT OPENS OVER WHATEVER OPENED IT. From Ledger › Tools it sits over the Ledger, which is there again on close (the
 * Book, the filters, the period). From the payee picker's "Manage payees…" inside Add entry or a line's window it is
 * `raised` over that form (the kit's one form-over-form layer, Ask 7a) and closes back to it with the typing kept; what
 * it changed (`onChanged`) lets the form's pick follow a payee merged away into the one kept.
 *
 * WHO: anyone who can read the club's books reads it; renaming, sharing, merging, deleting and adding are the club's
 * accounting's (3a's one rule — `canMove` from the read).
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, RecordDelete, RepChip, SavePill, repKit, useDeferredLoad,
  useLatestRead,
} from '../RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { pluralize } from '@/lib/utils';
import { PAYEE_REPORT_WORDS, PAYEE_WINDOW_WORDS } from '@/lib/club-money-words';
import { clubSharesPayees } from '@/lib/team-payee-scope';
import type { PayeeChange } from '@/lib/expense-payee';
import type { PayeeReport, PayeeReportTeam } from '@/lib/club-payee-report';
import YearPill from './YearPill';
import { FormError, TextField, day, jsonInit, money, moneyFetch, moneyKit, refusalText } from './MoneyKit';
import fy from './FiscalYear.module.css';
import cr from './ClubReport.module.css';
import own from './PayeesWindow.module.css';

/**
 * `uses` / `lastUsed` are the club's own entries; `inUse` also answers for a team's records (Ledger Parity D7a);
 * `sharedWithTeams` puts it in every team's picker (D7).
 */
interface Payee {
  id: string; name: string; notes: string | null; isActive: boolean; uses: number; lastUsed: string | null; inUse: boolean;
  sharedWithTeams: boolean;
}

/** The Teams column's two answers — one spelling, the table's and the phone row's. */
const SHARED_WORD = 'Shared with teams';
const OWN_WORD = 'The club’s own';

export default function PayeesWindow({ q, raised = false, initialPayee = null, onChanged, onClose }: {
  q: string;
  /** Opened from the payee picker inside another open form (Ask 7a) — stand one layer above it. */
  raised?: boolean;
  /** Open at this payee (`?payee=` — the old report page and Payees addresses forward here). */
  initialPayee?: string | null;
  /** What changed — the form underneath follows a payee renamed or merged away. */
  onChanged?: (change: PayeeChange) => void;
  onClose: () => void;
}) {
  const W = PAYEE_WINDOW_WORDS;
  const { currentOrg } = useOrg();
  const canShare = !!currentOrg && clubSharesPayees(currentOrg);
  const isPhone = useIsPhone();

  const [payees, setPayees] = useState<Payee[] | null>(null);
  /** This reader may rename, share, merge, delete or add (3a's one money rule). */
  const [canMove, setCanMove] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState<'merge' | 'delete' | 'new' | null>(null);
  /** What a merge, a delete or an add just did — said once, in the window's floating pill. */
  const [said, setSaid] = useState<string | null>(null);

  // The newest read wins (the kit's `useLatestRead`): a merge, a rename and a re-read can overlap.
  const beginRead = useLatestRead();
  const wanted = useRef(initialPayee);
  const load = useCallback(async () => {
    const current = beginRead();
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<{ payees?: Payee[]; canMove?: boolean }>(`/api/admin/accounting/payees?${q}&all=1`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setPayees(r.data.payees ?? []);
    setCanMove(!!r.data.canMove);
    // A payee asked for by address opens once, if it is still on the list (a merged-away one leaves the list showing).
    if (wanted.current) {
      const id = wanted.current;
      wanted.current = null;
      if ((r.data.payees ?? []).some(p => p.id === id)) setOpenId(id);
    }
  }, [q, beginRead]);
  useDeferredLoad(true, load);
  const changedRef = useLatestRef(onChanged);

  const current = openId && payees ? payees.find(p => p.id === openId) ?? null : null;
  const others = current && payees ? payees.filter(p => p.id !== current.id) : [];

  // ── One payee: its draft, seeded once per payee (a re-read after a save must never overwrite what is typed) ──
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const [report, setReport] = useState<PayeeReport | null>(null);
  const [reportFailed, setReportFailed] = useState(false);
  if (current && seededFor !== current.id) {
    setSeededFor(current.id);
    setEditing(false);
    setName(current.name);
    setSavedName(current.name);
    setShared(current.sharedWithTeams);
    setShareError('');
    setYear(null);
    setReport(null);
    setReportFailed(false);
  }
  // Back on the list, the next payee opened — even the same one — is seeded afresh (/review 2026-10-08: a refused rename's
  // text came back in its field when the payee was reopened).
  if (!current && seededFor !== null) setSeededFor(null);

  /* ⚖ The switch acts on the tap (an edit, so no Save — 2026-09-24), its own request, never folded into the rename's
     autosave: a refused rename must not hold the sharing back, and the reverse. Asking for the state it is already in
     changes nothing on the server (the D7a clock never restarts by accident). */
  async function share(next: boolean) {
    if (sharing || !current) return;
    setSharing(true); setShareError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ payee?: { sharedWithTeams?: boolean } }>(`/api/admin/accounting/payees/${current.id}?${q}`, jsonInit('PATCH', { sharedWithTeams: next }));
      if (!r.ok) { setShareError(refusalText(r.data, 'The sharing couldn’t be changed. Please try again.')); return; }
      const now = r.data.payee?.sharedWithTeams ?? next;
      setShared(now);
      setPayees(list => list && list.map(p => (p.id === current.id ? { ...p, sharedWithTeams: now } : p)));
    } catch {
      setShareError('The sharing couldn’t be changed. Check your connection and try again.');
    } finally {
      setSharing(false);
    }
  }

  const blocked = current && !name.trim() ? 'Give the payee a name to save it.' : null;
  const write = useCallback(async (signal: AbortSignal) => {
    if (!openId) return;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/accounting/payees/${openId}?${q}`, { ...jsonInit('PATCH', { name: name.trim() }), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    const saved = name.trim();
    setSavedName(saved);
    setPayees(list => list && list.map(p => (p.id === openId ? { ...p, name: saved } : p)));
    changedRef.current?.({ kind: 'renamed', id: openId, name: saved });
  }, [openId, q, name, changedRef]);
  // The rename holds while Merge or Delete asks, so it never PATCHes under either.
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canMove && editing && !!current, loading: asking != null, sig: name.trim(), blocked, write, failText: 'Couldn’t save',
  });

  // What the teams recorded (a shared payee): the year today falls in, then the year picked.
  const reportFor = canShare && shared && current ? current.id : null;
  useEffect(() => {
    if (!reportFor) return;
    let live = true;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    void moneyFetch<{ report: PayeeReport }>(`/api/admin/accounting/payees/${reportFor}/report?${q}${year ? `&year=${year}` : ''}`)
      .then(r => { if (!live) return; if (!r.ok) { setReportFailed(true); return; } setReportFailed(false); setReport(r.data.report); })
      .catch(() => { if (live) setReportFailed(true); });
    return () => { live = false; };
  }, [reportFor, q, year]);

  /* ⚠ A refused rename (the name is taken; the payee merged away elsewhere) holds the window ONCE, with the reason in its
     pill — leaving the payee by ←, by Previous · Next or by × goes through the same hold, and leaving again leaves it
     unsaved: never a window that cannot be left (the autosave-close trap). */
  const [refusedOnce, setRefusedOnce] = useState(false);
  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || blocked || refusedOnce) return true;
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leavePayee = () => { settle(); setRefusedOnce(false); };
  const close = async () => { if (await flush()) { leavePayee(); onClose(); } };
  const toList = async () => { if (await flush()) { leavePayee(); setOpenId(null); setEditing(false); } };
  const openPayee = async (id: string) => { if (await flush()) { leavePayee(); setSaid(null); setOpenId(id); } };
  // ✓ saves what is pending and goes back to reading — and stays while a name is held or the save fails (the standard).
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
  };

  /** A merge, a delete or an add landed: back to the list, said once; the form underneath follows the change. */
  const done = (text: string, change: PayeeChange) => {
    // The payee asked about is gone or changed: a pending rename of it lets go, as leaving it does.
    settle();
    setRefusedOnce(false);
    setAsking(null);
    setOpenId(null);
    setEditing(false);
    setSaid(text);
    const gone = change.kind === 'deleted' ? change.id : change.kind === 'merged' ? change.from : null;
    if (gone) setPayees(list => list && list.filter(p => p.id !== gone));
    onChanged?.(change);
    void load();
  };

  // ── The window ──
  const pill = editing && current
    ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} />
    : said ? <NoticePill inline key={said} message={said} onDone={() => setSaid(null)} /> : undefined;

  let body: ReactNode;
  let head: { eyebrow: string; title: string };
  let foot: { footer?: ReactNode; footerStart?: ReactNode } = {};
  let steps;
  if (failed) {
    head = { eyebrow: 'Ledger', title: 'Payees' };
    body = <LoadFailed title="We couldn’t load the club’s payees." onRetry={() => void load()} />;
  } else if (!payees) {
    head = { eyebrow: 'Ledger', title: 'Payees' };
    body = <p className={ck.loading}>Loading…</p>;
  } else if (current) {
    head = { eyebrow: canShare && shared ? W.eyebrowShared : W.eyebrow, title: savedName };
    const at = payees.findIndex(p => p.id === current.id);
    const stepTo = (p: Payee | undefined) => (p ? { name: p.name, onStep: () => void openPayee(p.id) } : null);
    steps = payees.length > 1 ? { prev: stepTo(payees[at - 1]), next: stepTo(payees[at + 1]), position: `${at + 1} of ${payees.length}`, noun: 'payee' } : undefined;
    foot = {
      // Merge stays at the foot's left, in both modes (Ask 2); Delete ends the body instead.
      footerStart: canMove && current.inUse && others.length > 0
        ? <button type="button" className="btn btn-outline" onClick={() => setAsking('merge')}>Merge into another payee</button>
        : undefined,
    };
    const reportYearName = report?.year.name ?? '';
    body = (
      <>
        {/* §283 W10 (owner, 2026-10-08): one fact about the club's own use of the name. That it is shared is the
            eyebrow's to say, and since when is the teams' section heading. */}
        {!editing ? (
          isPhone ? (
            <p className={ck.hint}>{W.phoneLine(current.uses, current.lastUsed)}</p>
          ) : (
            <dl className={fy.read}>
              <dt>{W.ledgerLabel}</dt><dd>{W.ledgerEntries(current.uses, current.lastUsed)}</dd>
            </dl>
          )
        ) : (
          <>
            <TextField id="payee-name" label="Name" required value={name} maxLength={200}
              onChange={v => { setName(v); touch(); setRefusedOnce(false); }} hint={W.nameHint(current.uses)} />
            {canShare && (
              <div className={ck.switchRow}>
                <div className={ck.switchText}>
                  <span className={ck.switchName} id="payee-shared-label">{SHARED_WORD}</span>
                  <p className={ck.hint}>Every team can pick it as a payee. Teams can’t rename or merge it, and their payee list tells them the club sees payments to it.</p>
                  <FormError inPlace>{shareError}</FormError>
                </div>
                <button type="button" role="switch" aria-checked={shared} aria-labelledby="payee-shared-label"
                  className={ck.switch} disabled={sharing} onClick={() => void share(!shared)} />
              </div>
            )}
          </>
        )}
        {canShare && shared && (editing ? (
          report && (
            <div className={cr.windowRows}>
              <div className={cr.windowRow}>
                <span className={cr.windowRowMain}>
                  <span className={cr.windowRowTitle}>{W.recordedFolded(reportYearName)}</span>
                  <span className={cr.windowRowSub}>{W.foldedCaption(report.teams.length, money(report.total))}</span>
                </span>
              </div>
            </div>
          )
        ) : (
          <TeamsRecorded report={report} failed={reportFailed} isPhone={isPhone} onYear={y => setYear(y)} />
        ))}
        {current.inUse && others.length > 0 && editing && (
          <p className={ck.hint}>Two spellings of one payee? Merge this one into the other: every entry moves to the one you keep.</p>
        )}
        {/* ⚖ Delete leaves the foot and ends the body, alone, red, asking first (the 2026-09-30 ruling for an admin record
            opened from a list) — offered only when nothing names the payee. */}
        {canMove && !current.inUse && (
          <div className={own.deleteEnd}>
            <RecordDelete onClick={() => setAsking('delete')}>Delete this payee</RecordDelete>
          </div>
        )}
      </>
    );
  } else {
    head = { eyebrow: 'Ledger', title: 'Payees' };
    foot = payees.length > 0 && canMove ? {
      footer: <button type="button" className="btn btn-outline" onClick={() => { setSaid(null); setAsking('new'); }}><Plus size={14} aria-hidden /> New payee</button>,
    } : {};
    body = payees.length === 0 ? (
      <EmptyCard title="No payees yet" action={canMove ? <button type="button" className="btn btn-lime" onClick={() => setAsking('new')}><Plus size={14} aria-hidden /> New payee</button> : undefined}>
        A payee is saved the first time you pick “Save as club payee” on an entry, or here.
      </EmptyCard>
    ) : (
      <>
        <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">Payee</th>
                <th scope="col" className={repKit.num}>Entries</th>
                <th scope="col">Last used</th>
                {canShare && <th scope="col">Teams</th>}
                <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
              </tr>
            </thead>
            <tbody>
              {payees.map(p => (
                <tr key={p.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; void openPayee(p.id); }}>
                  <td>
                    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); void openPayee(p.id); }}>{p.name}</button>
                  </td>
                  <td className={repKit.num}>{p.uses}</td>
                  <td className={repKit.dim}>{p.lastUsed ? day(p.lastUsed) : '—'}</td>
                  {canShare && <td>{p.sharedWithTeams ? <RepChip tone="info">{SHARED_WORD}</RepChip> : <span className={repKit.dim}>{OWN_WORD}</span>}</td>}
                  <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={repKit.phoneOnly}>
          <ClubRowFrame><ClubRowList inset label="Payees">
            {payees.map(p => (
              <ClubRow key={p.id} as="button" onClick={() => void openPayee(p.id)} title={p.name}
                caption={`${pluralize(p.uses, 'entry', 'entries')}${p.lastUsed ? ` · last ${day(p.lastUsed)}` : ''}${canShare && p.sharedWithTeams ? ` · ${SHARED_WORD}` : ''}`} chevron />
            ))}
          </ClubRowList></ClubRowFrame>
        </div>
        {/* A wrapper: inside a window the kit's paragraph rule (.body p) out-ranks the note's own top margin. */}
        <div className={own.listNote}><p className={repKit.notes}>{canShare
          ? 'The club’s payees. Every team can pick one that’s shared with teams; a team’s own payees stay its coaches’. A payee is never deleted while an entry names it: merge it into another instead.'
          : 'The club’s payees. A payee is never deleted while an entry names it: merge it into another instead.'}</p></div>
      </>
    );
  }

  return (
    <>
      <KitDialog
        kind="form"
        raised={raised}
        eyebrow={head.eyebrow}
        title={head.title}
        onClose={() => void close()}
        busy={sharing}
        back={current ? { label: 'Payees', onBack: () => void toList() } : undefined}
        levelKey={current?.id ?? 'list'}
        edit={current && canMove ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${savedName}` } : undefined}
        status={pill}
        steps={steps}
        {...foot}
      >
        {body}
      </KitDialog>
      {asking === 'merge' && current && (
        <MergeQuestion payee={{ ...current, name: savedName }} others={others} q={q} onClose={() => setAsking(null)} onDone={done} />
      )}
      {asking === 'delete' && current && (
        <DeleteQuestion payee={{ ...current, name: savedName }} q={q} onClose={() => setAsking(null)} onDone={done} />
      )}
      {asking === 'new' && (
        <NewPayeeWindow q={q} raised={raised} onClose={() => setAsking(null)}
          onAdded={added => done(`${added} added.`, { kind: 'added', name: added })} />
      )}
    </>
  );
}

/** "May 23 · Jun 13 · Jul 11 · Aug 8 · $180.00 each" when every payment is the same; else one line each. */
function paymentsLines(t: PayeeReportTeam): { key: string; text: string; amount: string }[] {
  const same = t.payments.every(p => Math.abs(p.amount - t.payments[0].amount) < 0.005);
  if (same && t.payments.length > 1) {
    return [{ key: 'all', text: t.payments.map(p => day(p.paidDate)).join(' · '), amount: `${money(t.payments[0].amount)} each` }];
  }
  return t.payments.map(p => ({
    key: p.id,
    text: `${day(p.paidDate)}${p.outOfPocket ? ` · ${PAYEE_REPORT_WORDS.outOfPocket}` : ''}`,
    amount: money(p.amount),
  }));
}

/**
 * WHAT THE TEAMS RECORDED, as a shared payee's body (3b's report, S3B-06; 3c Ask 7) — moved from the retired page
 * unchanged: since the day it was shared, each team folding to its payments in place (a right ↔ down chevron before the
 * name; nothing opens a page — the records are the team's), the total, Nothing recorded. A Year pill in the section's
 * head only when there is more than one year.
 */
function TeamsRecorded({ report, failed, isPhone, onYear }: {
  report: PayeeReport | null; failed: boolean; isPhone: boolean; onYear: (yearKey: string) => void;
}) {
  const W = PAYEE_WINDOW_WORDS;
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (failed) return <p className={ck.hint}>What the teams recorded couldn’t be loaded.</p>;
  if (!report) return <p className={ck.loading}>Loading…</p>;
  const years = report.years.some(y => y.key === report.year.key) ? report.years : [...report.years, { key: report.year.key, name: report.year.name }];
  const since = report.payee.sharedAt;
  return (
    <section className={cr.recordSection} aria-label={W.recorded}>
      <div className={moneyKit.reportHead}>
        <h3 className={cr.recordSectionTitle}>{W.recordedSince(since)}</h3>
        {years.length > 1 && <YearPill year={report.year.key} years={years} onChange={y => { setOpen(new Set()); onYear(y); }} />}
      </div>
      {/* No note here (owner, 2026-10-08): "recorded", in this heading and the column, already says these are the
          teams' own records and not proof of payment (3b, S3B-06). */}
      {!isPhone ? (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col" className={repKit.num}>{W.payments}</th>
                <th scope="col">{W.firstLatest}</th>
                <th scope="col" className={repKit.num}>{W.amountRecorded}</th>
              </tr>
            </thead>
            <tbody>
              {report.teams.map(t => {
                const isOpen = open.has(t.teamId);
                return (
                  <Fragment key={t.teamId}>
                    <tr className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; toggle(t.teamId); }}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-expanded={isOpen}
                          onClick={e => { e.stopPropagation(); toggle(t.teamId); }}>
                          {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />} {t.teamName}
                        </button>
                      </td>
                      <td className={repKit.num}>{t.count}</td>
                      <td className={repKit.dim}>{day(t.firstDay)}{t.lastDay !== t.firstDay ? ` · ${day(t.lastDay)}` : ''}</td>
                      <td className={repKit.num}>{money(t.total)}</td>
                    </tr>
                    {isOpen && paymentsLines(t).map(l => (
                      <tr key={l.key}>
                        <td className={`${repKit.dim} ${cr.subRowLead}`} colSpan={3}>{l.text}</td>
                        <td className={`${repKit.num} ${repKit.dim}`}>{l.amount}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {report.teams.length === 0 && (
                <tr><td colSpan={4} className={repKit.dim}>{W.nothingInYear(report.payee.name, report.year.name)}</td></tr>
              )}
              {report.teams.length > 0 && (
                <tr className={moneyKit.closeRow}>
                  <td>{pluralize(report.teams.length, 'team')} recorded</td>
                  <td className={repKit.num}>{report.count}</td>
                  <td />
                  <td className={repKit.num}>{money(report.total)}</td>
                </tr>
              )}
              {report.nothingRecorded.length > 0 && (
                <>
                  <tr className={repKit.band}><td colSpan={4}>{PAYEE_REPORT_WORDS.nothingBand(report.nothingRecorded.length)}</td></tr>
                  <tr><td colSpan={4} className={repKit.dim}>{report.nothingRecorded.map(t => t.teamName).join(' · ')}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ClubRowFrame>
          <ClubRowList inset label={W.recorded}>
            <ClubRowBand>{PAYEE_REPORT_WORDS.recordedBand(report.teams.length, report.total)}</ClubRowBand>
            {report.teams.map(t => {
              const isOpen = open.has(t.teamId);
              return (
                <li key={t.teamId} className={repKit.rowItem} data-row-list-row>
                  <button type="button" className={`${repKit.row} ${repKit.rowDoor}`} aria-expanded={isOpen} onClick={() => toggle(t.teamId)}>
                    {/* The fold chevron is the row's MARK (an icon kept at its start), not its LEAD (/design, 2026-10-06). */}
                    <span className={repKit.rowMark} aria-hidden>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                    <span className={repKit.rowMain}>
                      <span className={repKit.rowTitle}>{t.teamName}</span>
                      <span className={repKit.rowCaption}>
                        {PAYEE_REPORT_WORDS.rowSpan(t.count, t.firstDay, t.lastDay)} · {money(t.total)}
                        {isOpen && paymentsLines(t).map(l => <span key={l.key} className={cr.payLine}>{l.text} · {l.amount}</span>)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {report.nothingRecorded.length > 0 && (
              <>
                <ClubRowBand>{PAYEE_REPORT_WORDS.nothingBand(report.nothingRecorded.length)}</ClubRowBand>
                <li className={repKit.rowItem} data-row-list-row>
                  <div className={repKit.row}><span className={repKit.rowMain}><span className={repKit.rowCaption}>{report.nothingRecorded.map(t => t.teamName).join(' · ')}</span></span></div>
                </li>
              </>
            )}
          </ClubRowList>
        </ClubRowFrame>
      )}
    </section>
  );
}

/** Merge this payee into another — asks first, names how many entries move (a question, so it lands on top). */
function MergeQuestion({ payee, others, q, onClose, onDone }: {
  payee: Payee; others: Payee[]; q: string; onClose: () => void; onDone: (text: string, change: PayeeChange) => void;
}) {
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keep = others.find(o => o.id === into) ?? null;
  async function go() {
    if (busy) return;
    if (!keep) { setError('Choose the payee to keep.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ moved?: number }>(`/api/admin/accounting/payees/${payee.id}/merge?${q}`, jsonInit('POST', { intoPayeeId: keep.id }));
      if (!r.ok) { setError(refusalText(r.data, 'The payees couldn’t be merged. Please try again.')); return; }
      onDone(`${pluralize(r.data.moved ?? payee.uses, 'entry', 'entries')} moved to ${keep.name}. ${payee.name} is gone.`,
        { kind: 'merged', from: payee.id, into: keep.id, intoName: keep.name });
    } catch {
      setError('The payees couldn’t be merged. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      eyebrow={payee.name}
      title={`Merge ${payee.name} into another payee?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy || !keep}>{busy ? 'Merging…' : 'Merge'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="merge-into">
        <span className={ck.label}>Keep<span className={repKit.req} aria-hidden>*</span></span>
        <select id="merge-into" className={ck.select} value={into} onChange={e => setInto(e.target.value)}>
          <option value="">Choose a payee…</option>
          {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <p>{keep
        ? `${pluralize(payee.uses, 'entry', 'entries')} move${payee.uses === 1 ? 's' : ''} to ${keep.name}, and ${payee.name} is removed.`
        : `Every entry naming ${payee.name} (${payee.uses}) moves to the payee you keep, and ${payee.name} is removed.`}</p>
    </KitDialog>
  );
}

function DeleteQuestion({ payee, q, onClose, onDone }: {
  payee: Payee; q: string; onClose: () => void; onDone: (text: string, change: PayeeChange) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/payees/${payee.id}?${q}`, { method: 'DELETE' });
      if (!r.ok) { setError(refusalText(r.data, 'The payee couldn’t be deleted. Please try again.')); return; }
      onDone(`${payee.name} is deleted.`, { kind: 'deleted', id: payee.id });
    } catch {
      setError('The payee couldn’t be deleted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      title={`Delete ${payee.name}?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={() => void go()} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <p>No entry names {payee.name}, so nothing else changes.</p>
    </KitDialog>
  );
}

/** A new payee — a create, so it asks (2026-09-24). Opened from a raised Payees, it stands on the same raised layer,
 *  after it in the page, so it lands on top. */
function NewPayeeWindow({ q, raised, onClose, onAdded }: { q: string; raised: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add() {
    if (busy) return;
    if (!name.trim()) { setError('Give the payee a name.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/payees?${q}`, jsonInit('POST', { name: name.trim() }));
      if (!r.ok) { setError(refusalText(r.data, 'The payee couldn’t be added. Please try again.')); return; }
      onAdded(name.trim());
    } catch {
      setError('The payee couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="form"
      raised={raised}
      title="New payee"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : 'Add payee'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <TextField id="new-payee" label="Name" required value={name} onChange={setName} maxLength={200} placeholder="For example: Town of Northfield" />
    </KitDialog>
  );
}
