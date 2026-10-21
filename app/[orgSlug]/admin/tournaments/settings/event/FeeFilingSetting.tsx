'use client';

import { useEffect, useState } from 'react';
import ck from '@/components/admin/kit/club/ClubKit.module.css';

/** One word for the hosted event in the club budget and every fee receipt. */
export default function FeeFilingSetting({ tournamentId, orgSlug, defaultName }: {
  tournamentId: string; orgSlug: string; defaultName: string;
}) {
  const [word, setWord] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/admin/tournaments/${tournamentId}/fee-filing?orgSlug=${encodeURIComponent(orgSlug)}`;

  useEffect(() => {
    let live = true;
    setWord(''); setSaved(null); setError(null);
    fetch(url, { credentials: 'same-origin' }).then(async r => {
      if (!r.ok) throw new Error('Could not load the accounting category.');
      return r.json();
    }).then(data => {
      if (!live) return;
      setWord(data.word ?? `Hosted tournament · ${defaultName}`);
      setSaved(data.word ?? null);
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [url, defaultName]);

  async function save() {
    if (!word.trim() || word.trim() === saved || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: word.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not save the accounting category.');
      setWord(data.word); setSaved(data.word);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  return <div className={ck.field}>
    <label className={ck.label} htmlFor="fee-filing-word">Filed under</label>
    <input id="fee-filing-word" className={ck.input} maxLength={100} value={word}
      onChange={e => setWord(e.target.value)} onBlur={() => void save()} />
    <span className={ck.hint}>Entry fees and costs filed under this category appear together in By activity. Saving it creates the category before any team pays.</span>
    {busy && <span className={ck.hint}>Saving…</span>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
