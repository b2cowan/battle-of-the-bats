'use client';
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import styles from './FamilyAccessPanel.module.css';

/**
 * "Share game link" (Chunk D 1.8) — one deliberate coach act per game.
 *
 * Self-contained on purpose: it owns its own state so the (large, concurrently-edited)
 * schedule slide-over needs exactly one line to mount it.
 *
 * A game page does not exist until this is tapped, and stops existing when it is untapped —
 * that, not URL obscurity, is what keeps a public game page honest (decision #15 kept the
 * URL plain because the page shows what the scoreboard at the field shows).
 *
 * Renders nothing for a team without the family layer: the API 404s, and the row removes
 * itself rather than leaving a button that always fails.
 */
export default function ShareGameLinkRow({
  orgSlug, teamId, eventId, initialShared,
}: {
  orgSlug: string;
  teamId: string;
  eventId: string;
  initialShared: boolean;
}) {
  const [shared, setShared] = useState(initialShared);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const endpoint = `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/share`;

  async function share() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.status === 404) { setHidden(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Could not share this game.');
      setShared(true);
      setUrl(data.url);
      try { await navigator.clipboard.writeText(data.url); } catch { /* shown below instead */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share this game.');
    } finally {
      setBusy(false);
    }
  }

  async function unshare() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not stop sharing this game.');
      setShared(false);
      setUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop sharing this game.');
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;

  return (
    <div className={styles.panel} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
      <div className={styles.row}>
        <Link2 size={16} aria-hidden />
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>Share game link</div>
          <div className={styles.rowSub}>
            {shared
              ? 'A page for this game exists — teams, time, place and the final score once you enter it. No player names, ever.'
              : 'Creates a page anyone can open without an account: teams, time, place, and the final score once you enter it.'}
          </div>
        </div>
        {shared ? (
          <button type="button" className={styles.linkBtn} onClick={unshare} disabled={busy}>
            {busy ? 'Working…' : 'Stop sharing'}
          </button>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={share} disabled={busy}>
            {busy ? 'Working…' : 'Share'}
          </button>
        )}
      </div>
      {url && (
        <>
          <p className={styles.muted}>Copied — paste it wherever your families already talk.</p>
          <div className={styles.linkOut}>{url}</div>
        </>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
