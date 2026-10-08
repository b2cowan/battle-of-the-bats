'use client';
/**
 * Accounting › Ledger › PAYEES (Club Tier Stage 3a, specimen 1 — C01 / C14). Reached from the Ledger's
 * toolbar and from the payee picker's foot. One level down: a back arrow to the Ledger, no tab row.
 *
 * Every club payee with how many lines name it and when one last did. A payee's window renames it —
 * the rename SAVES AS YOU TYPE with the fading "Saved" (2026-09-24) — or merges it into another, which
 * asks first and names how many entries move (the two spellings of one payee become one). A payee is
 * never deleted while a line names it; one no line names can go.
 *
 * ⚖ SHARED WITH TEAMS (Ledger Parity D7, owner 2026-10-02; Business Decisions Log): a club that runs
 * teams chooses which of its payees its teams can pick. A Teams column says which ("Shared with teams"
 * in the club's blue / "The club's own"), and the payee's window carries the switch with what it does.
 * Only a club with teams draws either (`clubSharesPayees` — the PATCH refuses on the same pure rule). A team's
 * picker lists a shared payee under "Shared by your club" and tells the coach the club sees payments to
 * it.
 *
 * ⚖ A PAYEE'S WINDOW READS FIRST, AND WHAT THE TEAMS RECORDED IS INSIDE IT (Club Tier Stage 3c, specimen 7 — Ask 7,
 * S3C-10; the record standard 2026-10-01). It opens to READ one fact: how many of the club's own Ledger entries name it
 * ("In the club's Ledger"; §283 W10 — that it is shared is the eyebrow's, and since when the teams' heading). One borderless pencil (a money mover's only) turns Name and the Shared with teams switch
 * into the form — the name saves as you go (the floating pill), the switch on the tap — and ✓ turns it back. Merge
 * and Delete are actions, in the foot in both modes. For a SHARED payee the report is the window's BODY (3b's
 * definition, S3B-06): headed with the day it was shared, each team folding to its payments in place, the total and
 * Nothing recorded (§283 W10 dropped the note and the counting rule: "recorded" says it) — a small Year pill in its head only when the payee has records in more than one
 * fiscal year. While editing, the report folds to its one line. An unshared payee has no report and nothing in its
 * place. NO EXPORT (Ask 7: one payee's team records are read here; nobody named receives that file).
 * ⚰ The report PAGE (`payees/[payeeId]`) and its Export retired; its address forwards here with `?payee=` (proxy.ts).
 * The Payees list keeps showing the club's own entries only (mig 316).
 */
import { Fragment, use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, ClubSection, EmptyCard, LoadFailed, PageLoading, RepChip, SavePill, repKit,
  useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { FormError, TextField, day, jsonInit, money, moneyFetch, moneyKit, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import YearPill from '@/components/admin/kit/club/money/YearPill';
import fy from '@/components/admin/kit/club/money/FiscalYear.module.css';
import { pluralize } from '@/lib/utils';
import { PAYEE_REPORT_WORDS, PAYEE_WINDOW_WORDS } from '@/lib/club-money-words';
import type { PayeeReport, PayeeReportTeam } from '@/lib/club-payee-report';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import { clubSharesPayees } from '@/lib/team-payee-scope';

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

export default function PayeesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { currentOrg, loading: orgLoading } = useOrg();
  const canShare = !!currentOrg && clubSharesPayees(currentOrg);
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const ledgerHref = `/${orgSlug}/admin/accounting/ledger`;
  usePageTitle('Payees');

  const router = useRouter();
  const search = useSearchParams();
  const [payees, setPayees] = useState<Payee[] | null>(null);
  /** This reader may rename, share, merge or delete (3a's one money rule) — the window's pencil shows only then. */
  const [canMove, setCanMove] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Payee | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<{ payees?: Payee[]; canMove?: boolean }>(`/api/admin/accounting/payees?${q}&all=1`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setPayees(r.data.payees ?? []);
    setCanMove(!!r.data.canMove);
    // A payee asked for by address (`?payee=` — the retired report page forwards here): its window opens, once.
    const wanted = search.get('payee');
    if (wanted) {
      const hit = (r.data.payees ?? []).find(x => x.id === wanted);
      if (hit) setOpen(hit);
      router.replace(`/${orgSlug}/admin/accounting/payees`);
    }
  }, [q, beginRead, search, router, orgSlug]);
  useDeferredLoad(!orgLoading, load);

  const header = (
    <AdminPageHeader
      backTo={{ href: ledgerHref, label: 'Ledger' }}
      crumbs={[{ label: 'Accounting' }, { label: 'Ledger' }]}
      title="Payees"
    />
  );
  if (failed) return <div className={repKit.page}>{header}<LoadFailed title="We couldn’t load the club’s payees." onRetry={() => void load()} /></div>;
  if (!payees) return <PageLoading header={header} />;

  return (
    <div className={`${repKit.page} ${repKit.savePillPage}`}>
      {header}
      {notice && <PageNotice notice={notice} />}
      {payees.length === 0 ? (
        <EmptyCard title="No payees yet" action={<button type="button" className="btn btn-lime" onClick={() => setAdding(true)}><Plus size={14} aria-hidden /> New payee</button>}>
          A payee is saved the first time you pick “Save as club payee” on an entry, or here.
        </EmptyCard>
      ) : (
        <ClubSection
          title="Payees"
          meta={pluralize(payees.length, 'payee')}
          actions={<button type="button" className="btn btn-outline" onClick={() => setAdding(true)}><Plus size={14} aria-hidden /> New payee</button>}
          list
        >
          <div className={repKit.deskOnly}>
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
                  <tr key={p.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; setOpen(p); }}>
                    <td>
                      <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); setOpen(p); }} aria-haspopup="dialog">{p.name}</button>
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
            <ClubRowList inset label="Payees">
              {payees.map(p => (
                <ClubRow key={p.id} as="button" aria-haspopup="dialog" onClick={() => setOpen(p)} title={p.name}
                  caption={`${pluralize(p.uses, 'entry', 'entries')}${p.lastUsed ? ` · last ${day(p.lastUsed)}` : ''}${canShare && p.sharedWithTeams ? ` · ${SHARED_WORD}` : ''}`} chevron />
              ))}
            </ClubRowList>
          </div>
        </ClubSection>
      )}
      <p className={repKit.notes}>{canShare
        ? 'The club’s payees. Every team can pick one that’s shared with teams; a team’s own payees stay its coaches’. A payee is never deleted while an entry names it: merge it into another instead.'
        : 'The club’s payees. A payee is never deleted while an entry names it: merge it into another instead.'}</p>

      {open && (
        <PayeeWindow
          key={open.id}
          payee={open}
          others={payees.filter(p => p.id !== open.id)}
          canShare={canShare}
          canMove={canMove}
          q={q}
          onClose={changed => { setOpen(null); if (changed) void load(); }}
          onDone={text => { setOpen(null); setNotice({ tone: 'good', text }); void load(); }}
        />
      )}
      {adding && (
        <NewPayeeWindow q={q} onClose={() => setAdding(false)}
          onAdded={name => { setAdding(false); setNotice({ tone: 'good', text: `${name} added.` }); void load(); }} />
      )}
    </div>
  );
}

/**
 * A payee's window: it READS FIRST (the record standard); the pencil turns Name and the switch into its form. For a
 * shared payee, what the teams recorded paying it is the window's body. Merge asks; Delete only when nothing names it.
 */
function PayeeWindow({ payee, others, canShare, canMove, q, onClose, onDone }: {
  payee: Payee; others: Payee[]; canShare: boolean; canMove: boolean; q: string; onClose: (changed: boolean) => void; onDone: (text: string) => void;
}) {
  const W = PAYEE_WINDOW_WORDS;
  const isPhone = useIsPhone();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(payee.name);
  const [savedName, setSavedName] = useState(payee.name);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(payee.sharedWithTeams);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  /* ⚖ The switch acts on the tap (an edit, so no Save — 2026-09-24), its own request, never folded into
     the rename's autosave: a refused rename must not hold the sharing back, and the reverse. Asking for
     the state it is already in changes nothing on the server (the D7a clock never restarts by accident). */
  async function share(next: boolean) {
    if (sharing) return;
    setSharing(true); setShareError('');
    try {
      const r = await moneyFetch<{ payee?: { sharedWithTeams?: boolean } }>(`/api/admin/accounting/payees/${payee.id}?${q}`, jsonInit('PATCH', { sharedWithTeams: next }));
      if (!r.ok) { setShareError(refusalText(r.data, 'The sharing couldn’t be changed. Please try again.')); return; }
      setShared(r.data.payee?.sharedWithTeams ?? next);
      setSaved(true);
    } catch {
      setShareError('The sharing couldn’t be changed. Check your connection and try again.');
    } finally {
      setSharing(false);
    }
  }
  const [asking, setAsking] = useState<'merge' | 'delete' | null>(null);
  const blocked = !name.trim() ? 'Give the payee a name to save it.' : null;
  const write = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/admin/accounting/payees/${payee.id}?${q}`, { ...jsonInit('PATCH', { name: name.trim() }), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    setSaved(true);
    setSavedName(name.trim());
  }, [payee.id, q, name]);
  // The rename holds while Merge or Delete asks, so it never PATCHes under either.
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: canMove && editing, loading: asking != null, sig: name.trim(), blocked, write, failText: 'Couldn’t save',
  });

  // What the teams recorded (a shared payee): read for the year today falls in, then the year picked.
  const [year, setYear] = useState<string | null>(null);
  const [report, setReport] = useState<PayeeReport | null>(null);
  const [reportFailed, setReportFailed] = useState(false);
  useEffect(() => {
    if (!canShare || !shared) return;
    let live = true;
    void moneyFetch<{ report: PayeeReport }>(`/api/admin/accounting/payees/${payee.id}/report?${q}${year ? `&year=${year}` : ''}`)
      .then(r => { if (!live) return; if (!r.ok) { setReportFailed(true); return; } setReportFailed(false); setReport(r.data.report); })
      .catch(() => { if (live) setReportFailed(true); });
    return () => { live = false; };
  }, [canShare, shared, payee.id, q, year]);

  // ⚠ A refused rename (the name is taken, the payee merged away elsewhere) holds the window once, with
  // the reason in its pill; closing again leaves it unsaved — never a window that cannot be closed.
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    onClose(saved || dirty);
  };
  const toggleEdit = async () => {
    if (editing && dirty && !blocked && !(await handleSave())) return;
    setEditing(e => !e);
  };

  const reportYearName = report?.year.name ?? '';
  const footStart = canMove ? (!payee.inUse
    ? <button type="button" className="btn btn-danger" onClick={() => setAsking('delete')}>Delete this payee</button>
    : others.length > 0 ? <button type="button" className="btn btn-outline" onClick={() => setAsking('merge')}>Merge into another payee</button> : undefined) : undefined;

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={canShare && shared ? W.eyebrowShared : W.eyebrow}
        title={savedName}
        onClose={() => void close()}
        busy={sharing}
        edit={canMove ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${savedName}` } : undefined}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
        footerStart={footStart}
        footer={<button type="button" className="btn btn-outline" onClick={() => void close()}>Done</button>}
      >
        {/* §283 W10 (owner, 2026-10-08): one fact about the club's own use of the name. That it is shared is the
            eyebrow's to say, and since when is the teams' section heading. */}
        {!editing ? (
          isPhone ? (
            <p className={ck.hint}>{W.phoneLine(payee.uses, payee.lastUsed)}</p>
          ) : (
            <dl className={fy.read}>
              <dt>{W.ledgerLabel}</dt><dd>{W.ledgerEntries(payee.uses, payee.lastUsed)}</dd>
            </dl>
          )
        ) : (
          <>
            <TextField id="payee-name" label="Name" required value={name} onChange={v => { setName(v); touch(); closeRefused.current = false; }} maxLength={200}
              hint={W.nameHint(payee.uses)} />
            {canShare && (
              <div className={ck.switchRow}>
                <div className={ck.switchText}>
                  <span className={ck.switchName} id="payee-shared-label">{SHARED_WORD}</span>
                  <p className={ck.hint}>Every team can pick it as a payee. Teams can’t rename or merge it, and their payee list tells them the club sees payments to it.</p>
                  <FormError>{shareError}</FormError>
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
          <TeamsRecorded report={report} failed={reportFailed} isPhone={isPhone}
            onYear={y => setYear(y)} />
        ))}
        {payee.inUse && others.length > 0 && editing && (
          <p className={ck.hint}>Two spellings of one payee? Merge this one into the other: every entry moves to the one you keep.</p>
        )}
      </KitDialog>
      {asking === 'merge' && (
        <MergeQuestion payee={payee} others={others} q={q} onClose={() => setAsking(null)} onDone={onDone} />
      )}
      {asking === 'delete' && (
        <DeleteQuestion payee={payee} q={q} onClose={() => setAsking(null)} onDone={onDone} />
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
 * WHAT THE TEAMS RECORDED, as the payee window's body (3b's report, S3B-06; Ask 7): since the day it was shared, each team folding to its
 * payments in place (a right ↔ down chevron before the name; nothing opens a page — the records are the team's), the
 * total, Nothing recorded. A Year pill in the section's head only when there is more than one year.
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

function MergeQuestion({ payee, others, q, onClose, onDone }: {
  payee: Payee; others: Payee[]; q: string; onClose: () => void; onDone: (text: string) => void;
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
      const r = await moneyFetch<{ moved?: number }>(`/api/admin/accounting/payees/${payee.id}/merge?${q}`, jsonInit('POST', { intoPayeeId: keep.id }));
      if (!r.ok) { setError(refusalText(r.data, 'The payees couldn’t be merged. Please try again.')); return; }
      onDone(`${pluralize(r.data.moved ?? payee.uses, 'entry', 'entries')} moved to ${keep.name}. ${payee.name} is gone.`);
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

function DeleteQuestion({ payee, q, onClose, onDone }: { payee: Payee; q: string; onClose: () => void; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(`/api/admin/accounting/payees/${payee.id}?${q}`, { method: 'DELETE' });
      if (!r.ok) { setError(refusalText(r.data, 'The payee couldn’t be deleted. Please try again.')); return; }
      onDone(`${payee.name} is deleted.`);
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

function NewPayeeWindow({ q, onClose, onAdded }: { q: string; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add() {
    if (busy) return;
    if (!name.trim()) { setError('Give the payee a name.'); return; }
    setBusy(true); setError('');
    try {
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
