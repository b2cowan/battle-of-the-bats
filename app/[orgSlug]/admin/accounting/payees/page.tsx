'use client';
/**
 * Accounting › Ledger › PAYEES (Club Tier Stage 3a, specimen 1 — C01 / C14). Reached from the Ledger's
 * toolbar and from the payee picker's foot. One level down: a back arrow to the Ledger, no tab row.
 *
 * Every club payee with how many lines name it and when one last did. A payee's window renames it —
 * the rename SAVES AS YOU TYPE with the fading "Saved" (2026-09-24) — or merges it into another, which
 * asks first and names how many entries move (the two spellings of one payee become one). A payee is
 * never deleted while a line names it; one no line names can go.
 */
import { use, useCallback, useRef, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowList, ClubSection, EmptyCard, LoadFailed, PageLoading, SavePill, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { FormError, TextField, day, jsonInit, moneyFetch, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import { pluralize } from '@/lib/utils';

interface Payee { id: string; name: string; notes: string | null; isActive: boolean; uses: number; lastUsed: string | null }

export default function PayeesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { loading: orgLoading } = useOrg();
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
          A payee is saved the first time you pick “Save as org payee” on an entry, or here.
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
                  caption={`${pluralize(p.uses, 'entry', 'entries')}${p.lastUsed ? ` · last ${day(p.lastUsed)}` : ''}`} chevron />
              ))}
            </ClubRowList>
          </div>
        </ClubSection>
      )}
      <p className={repKit.notes}>The club’s payees only: a team’s payees are its coaches’. A payee is never deleted while an entry names it; merge it into another instead.</p>

      {open && (
        <PayeeWindow
          key={open.id}
          payee={open}
          others={payees.filter(p => p.id !== open.id)}
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

/** A payee: its name saves as you type; merge asks; delete only when no line names it. */
function PayeeWindow({ payee, others, q, onClose, onDone }: {
  payee: Payee; others: Payee[]; q: string; onClose: (changed: boolean) => void; onDone: (text: string) => void;
}) {
  const [name, setName] = useState(payee.name);
  const [saved, setSaved] = useState(false);
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
        footerStart={payee.uses === 0
          ? <button type="button" className="btn btn-danger" onClick={() => setAsking('delete')}>Delete this payee</button>
          : others.length > 0 ? <button type="button" className="btn btn-outline" onClick={() => setAsking('merge')}>Merge into another payee</button> : undefined}
        footer={<button type="button" className="btn btn-outline" onClick={() => void close()}>Done</button>}
      >
        <TextField id="payee-name" label="Name" required value={name} onChange={v => { setName(v); touch(); }} maxLength={200}
          hint={`Named on ${pluralize(payee.uses, 'entry', 'entries')}. A new name shows on every one of them.`} />
        {payee.uses > 0 && others.length > 0 && (
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
