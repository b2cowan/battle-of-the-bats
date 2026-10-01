'use client';
/** Add ledger (Club Tier Stage 3a): shared by the Overview's section and the Ledger's Book pill. */
import { useState } from 'react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { FormError, TextField, jsonInit, moneyFetch, refusalText } from './MoneyKit';

/**
 * Add ledger — a create, so it asks (2026-09-24). A club book by name, or a book for a tournament that
 * has none yet (today's one-click "Open ledger" on the overview, folded in here — not drawn).
 */
export default function AddLedgerWindow({ q, tournaments, onClose, onCreated, onFailed }: {
  q: string;
  tournaments: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (ledgerId: string) => void;
  onFailed?: (text: string) => void;
}) {
  const [forWhat, setForWhat] = useState<string>('club');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tournament = tournaments.find(t => t.id === forWhat) ?? null;

  async function create() {
    if (busy) return;
    const body = tournament
      ? { name: tournament.name, entityType: 'tournament', entityId: tournament.id }
      : { name: name.trim(), entityType: 'org' };
    if (!body.name) { setError('Give the book a name.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ id?: string; error?: string }>(`/api/admin/accounting/ledgers?${q}`, jsonInit('POST', body));
      if (!r.ok || !r.data.id) { setError(refusalText(r.data, 'The book couldn’t be added. Please try again.')); return; }
      onCreated(r.data.id);
    } catch {
      const text = 'The book couldn’t be added. Check your connection and try again.';
      if (onFailed) onFailed(text); else setError(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title="Add a ledger"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? 'Adding…' : 'Add ledger'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      {tournaments.length > 0 && (
        <label className={ck.field} htmlFor="add-ledger-for">
          <span className={ck.label}>A book for<span className={repKit.req} aria-hidden>*</span></span>
          <select id="add-ledger-for" className={ck.select} value={forWhat} onChange={e => setForWhat(e.target.value)}>
            <option value="club">The club — a book of its own</option>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name} — the tournament’s book</option>)}
          </select>
        </label>
      )}
      {tournament ? (
        <p className={ck.hint}>{tournament.name}’s book keeps its own money: its fees, its costs and any float the club moves to it.</p>
      ) : (
        <TextField id="add-ledger-name" label="Name" required value={name} onChange={setName} maxLength={100}
          placeholder="For example: Equipment reserve" hint="A club book for money you keep apart, such as a reserve or a fundraising account." />
      )}
    </KitDialog>
  );
}
