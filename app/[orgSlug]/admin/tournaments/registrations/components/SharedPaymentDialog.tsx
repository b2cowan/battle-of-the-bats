'use client';

import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';

type Row = { id: string; name: string; suggested: number };

export default function SharedPaymentDialog({ rows, tournamentId, orgSlug, onClose, onSaved }: {
  rows: Row[]; tournamentId: string; orgSlug: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [amounts, setAmounts] = useState<Record<string,string>>(() => Object.fromEntries(rows.map(r => [r.id, r.suggested > 0 ? String(r.suggested) : ''])));
  const [method, setMethod] = useState('etransfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = rows.reduce((sum, r) => sum + (Number(amounts[r.id]) || 0), 0);

  async function save() {
    if (busy || rows.some(r => !Number.isFinite(Number(amounts[r.id])) || Number(amounts[r.id]) <= 0)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/shared-payment?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: rows.map(r => ({ teamId: r.id, amount: Number(amounts[r.id]) })), method, reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not record the payment.');
      await onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record the payment.'); }
    finally { setBusy(false); }
  }

  return <KitDialog kind="form" title="One payment for several teams" onClose={onClose} busy={busy}
    footer={<>
      <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button type="button" className="btn btn-lime" onClick={() => void save()}
        disabled={busy || rows.some(r => Number(amounts[r.id]) <= 0)}>Record {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(total)}</button>
    </>}>
    <p>Use this when one transfer covers these teams. Accounting will show one fee line linked to each team.</p>
    {rows.map(row => <label key={row.id} className={ck.field}>
      <span className={ck.label}>{row.name}</span>
      <input className={ck.input} type="number" min="0.01" step="0.01" inputMode="decimal" required
        value={amounts[row.id] ?? ''} onChange={e => setAmounts(prev => ({ ...prev, [row.id]: e.target.value }))} />
    </label>)}
    <label className={ck.field}><span className={ck.label}>How it arrived</span>
      <select className={ck.select} value={method} onChange={e => setMethod(e.target.value)}>
        <option value="etransfer">e-Transfer</option><option value="cash">Cash</option>
        <option value="cheque">Cheque</option><option value="card">Card</option><option value="other">Other</option>
      </select>
    </label>
    <label className={ck.field}><span className={ck.label}>Reference (optional)</span>
      <input className={ck.input} maxLength={500} value={reference} onChange={e => setReference(e.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
  </KitDialog>;
}
