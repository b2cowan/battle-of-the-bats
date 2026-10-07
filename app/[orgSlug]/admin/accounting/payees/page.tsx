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
 * ⚖ WHAT THE TEAMS RECORDED (Club Tier Stage 3b, specimen 5 — S3B-06): a SHARED payee's window gains ONE door,
 * a row opening the report one level down (`payees/[payeeId]`), captioned with the report's own count and
 * total for the year — the one place a team figure touches the payee. The Payees list keeps showing the
 * club's own entries only (mig 316). Unsharing removes the door; the report keeps what was recorded while
 * it was shared.
 */
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowList, ClubSection, EmptyCard, LoadFailed, PageLoading, RepChip, SavePill, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { FormError, TextField, day, jsonInit, moneyFetch, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import { pluralize } from '@/lib/utils';
import { PAYEE_REPORT_WORDS } from '@/lib/club-money-words';
import { formatStoredDate } from '@/lib/timezone';
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

  const [payees, setPayees] = useState<Payee[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Payee | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<{ payees?: Payee[] }>(`/api/admin/accounting/payees?${q}&all=1`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setPayees(r.data.payees ?? []);
  }, [q, beginRead]);
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
          q={q}
          reportHref={`/${orgSlug}/admin/accounting/payees/${open.id}`}
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

/** A payee: its name saves as you type; merge asks; delete only when no line names it. */
function PayeeWindow({ payee, others, canShare, q, reportHref, onClose, onDone }: {
  payee: Payee; others: Payee[]; canShare: boolean; q: string; reportHref: string; onClose: (changed: boolean) => void; onDone: (text: string) => void;
}) {
  const [name, setName] = useState(payee.name);
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
  }, [payee.id, q, name]);
  // The rename holds while Merge or Delete asks, so it never PATCHes under either.
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: true, loading: asking != null, sig: name.trim(), blocked, write, failText: 'Couldn’t save',
  });
  // ⚠ A refused rename (the name is taken, the payee merged away elsewhere) holds the window once, with
  // the reason in its pill; closing again leaves it unsaved — never a window that cannot be closed.
  const closeRefused = useRef(false);
  const close = async () => {
    if (dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    onClose(saved || dirty);
  };

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow="Payee"
        title={payee.name}
        status={<SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} />}
        onClose={() => void close()}
        busy={sharing}
        footerStart={!payee.inUse
          ? <button type="button" className="btn btn-danger" onClick={() => setAsking('delete')}>Delete this payee</button>
          : others.length > 0 ? <button type="button" className="btn btn-outline" onClick={() => setAsking('merge')}>Merge into another payee</button> : undefined}
        footer={<button type="button" className="btn btn-outline" onClick={() => void close()}>Done</button>}
      >
        <TextField id="payee-name" label="Name" required value={name} onChange={v => { setName(v); touch(); closeRefused.current = false; }} maxLength={200}
          hint={payee.uses === 0
            ? 'Named on none of the club’s own entries.'
            : `Named on ${pluralize(payee.uses, 'entry', 'entries')} of the club’s own. A new name shows wherever it is named.`} />
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
        {canShare && shared && <RecordedDoor payeeId={payee.id} q={q} href={reportHref} />}
        {payee.inUse && others.length > 0 && (
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

/**
 * The door to what the teams recorded paying a shared payee: a row inside the window that opens a page (a row
 * list's door, register K-19), captioned with the report's count and total for this year. It reads the report
 * when it appears — a payee shared a moment ago shows "Nothing recorded" until a team records a payment.
 */
function RecordedDoor({ payeeId, q, href }: { payeeId: string; q: string; href: string }) {
  // The server reads the fiscal year today falls in, and names it (Stage 3c — no year worked out here).
  const [caption, setCaption] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void moneyFetch<{ report?: { teams: unknown[]; total: number; payee: { sharedAt: string }; year: { name: string } } }>(`/api/admin/accounting/payees/${payeeId}/report?${q}`)
      .then(r => {
        if (!live || !r.ok || !r.data.report) return;
        setCaption(PAYEE_REPORT_WORDS.doorCaption(r.data.report.teams.length, r.data.report.total, r.data.report.year.name));
        setSince(r.data.report.payee.sharedAt);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [payeeId, q]);
  return (
    <>
      {since && <p className={ck.hint}>Shared since {formatStoredDate(since, { withYear: false })}.</p>}
      <div className={cr.windowRows}>
        <Link href={href} className={cr.windowRow}>
          <span className={cr.windowRowMain}>
            <span className={cr.windowRowTitle}>{PAYEE_REPORT_WORDS.door}</span>
            <span className={cr.windowRowSub}>{caption ?? 'Loading…'}</span>
          </span>
          <ChevronRight size={16} aria-hidden className={cr.windowRowEnd} />
        </Link>
      </div>
    </>
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
