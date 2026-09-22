'use client';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell from './QuestionShell';
import PlaceSheet from './PlaceSheet';
import { useConfirm } from './ConfirmProvider';
import { surfaceLabel } from '@/lib/sports';
import type { RepTeamPlace } from '@/lib/types';

/**
 * MANAGE PLACES (Arrival & Places D8, 2026-09-21) — the book, with what each place holds and how
 * many events sit at it. Edit opens the place sheet (which carries the D6 offer for upcoming
 * events); Remove asks first and says what stays: the events keep their location text, only the
 * link goes. Reached from the picker's last row — the manage door lives where minting lives.
 */
export default function ManagePlacesSheet({
  basePath,
  sport,
  places,
  onClose,
  onChanged,
}: {
  basePath: string;
  /** The team's sport — the usual diamond reads "Diamond 2" on each row (`surfaceLabel`). */
  sport: string | null | undefined;
  places: RepTeamPlace[];
  onClose: () => void;
  /** Re-read the book (and the events, when a save moved some). */
  onChanged: (movedEvents?: number) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<RepTeamPlace | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function remove(place: RepTeamPlace) {
    const n = place.count ?? 0;
    const ok = await confirm({
      title: `Remove ${place.name}?`,
      message: n > 0
        ? `The ${n} ${n === 1 ? 'event' : 'events'} at ${place.name} keep their location as written — only the link to this place goes. It will no longer be offered when you type.`
        : `It will no longer be offered when you type a location.`,
      confirmText: 'Remove place',
      cancelText: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(place.id);
    setError('');
    try {
      const res = await fetch(`${basePath}/${place.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not remove the place.'); return; }
      setNotice(`Removed ${place.name}.`);
      onChanged();
    } catch {
      setError('Could not remove the place.');
    } finally {
      setBusyId(null);
    }
  }

  // The upcoming count the offer needs: events at this place from now on. The GET carries the
  // total and the last use; the sheet asks for the upcoming figure lazily on Edit.
  const [upcoming, setUpcoming] = useState<number>(0);
  async function openEdit(place: RepTeamPlace) {
    setUpcoming(0);
    setEditing(place);
    try {
      const res = await fetch(`${basePath}/${place.id}`);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && typeof json.usage?.upcoming === 'number') setUpcoming(json.usage.upcoming);
      }
    } catch { /* the offer simply does not appear */ }
  }

  if (editing) {
    return (
      <PlaceSheet
        basePath={basePath}
        editing={editing}
        upcomingCount={upcoming}
        onClose={() => setEditing(null)}
        onSaved={(place, moved) => {
          setEditing(null);
          setNotice(moved > 0 ? `Saved ${place.name} — ${moved} upcoming ${moved === 1 ? 'event' : 'events'} updated.` : `Saved ${place.name}.`);
          onChanged(moved);
        }}
      />
    );
  }

  return (
    <QuestionShell open onClose={onClose} ariaLabel="Places" title="Places" subtitle="The places your team goes, with what each one carries.">
      <div className={`${styles.formBody} ${styles.formBodyTight}`}>
        {notice && <p className={styles.formHint} role="status">{notice}</p>}
        {places.length === 0 ? (
          <p className={styles.formHint}>No places yet — type a location on an event and choose “Add … as a place”.</p>
        ) : (
          <div>
            {places.map(p => {
              const facts = [p.address, surfaceLabel(sport, p.fieldNumber)].filter(Boolean).join(' · ');
              const n = p.count ?? 0;
              return (
                <div key={p.id} className={styles.tagManagerRow}>
                  <div className={styles.tagManagerName}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className={styles.formHint}>
                      {facts || 'No address yet'} · {n === 0 ? 'no events' : `on ${n} ${n === 1 ? 'event' : 'events'}`}
                      {p.note ? ` · ${p.note}` : ''}
                    </div>
                  </div>
                  <div className={styles.tagManagerActions}>
                    <button type="button" aria-label={`Edit ${p.name}`} disabled={busyId === p.id} onClick={() => void openEdit(p)}><Pencil size={15} /></button>
                    <button type="button" aria-label={`Remove ${p.name}`} disabled={busyId === p.id} onClick={() => void remove(p)}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Done</button>
        </div>
      </div>
    </QuestionShell>
  );
}
