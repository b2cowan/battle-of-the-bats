'use client';
import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import styles from './FamilyAccessPanel.module.css';

/**
 * "{Player}'s guardians" (S5, bottom card) — the coach's per-player guardian management.
 *
 * ⚠ Renders NOTHING while the guardian tier is switched off: the API 404s and this removes
 * itself. A coach must not be shown a panel for something that cannot yet happen.
 *
 * The important interaction here is APPROVAL. A requester typed a child's first name into a
 * form that showed them no roster at all, so approving is the coach — a human who knows this
 * team — saying "yes, that adult belongs to this child." The email-match chip is an assist for
 * that judgement and nothing more: it says "this is the address you yourself typed on this
 * player", which is useful, and says nothing about whether the holder is a parent.
 */

interface GuardianRow {
  id: string;
  email: string;
  relationship: string | null;
  status: string;
  verifiedVia: string | null;
  requestedPlayerName: string | null;
  createdAt: string;
  matchesRosterContact: boolean;
  /** Set only when the person who claimed your invite holds a DIFFERENT address than the one
   *  you invited — which is exactly why the row is waiting on you. */
  claimedEmail: string | null;
}

export default function PlayerGuardiansCard({
  orgSlug, teamId, playerId, playerFirstName, rosterGuardianEmail,
}: {
  orgSlug: string;
  teamId: string;
  playerId: string;
  playerFirstName: string;
  /** The guardian contact already on the roster row — prefills the direct invite. */
  rosterGuardianEmail: string | null;
}) {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GuardianRow[]>([]);
  /** Parent-initiated requests with no child attached yet. They appear on EVERY player's card
   *  because that is the decision the coach is making: "this adult belongs to THIS child."
   *  The name the parent typed is shown so the coach can match it. */
  const [pendingRequests, setPendingRequests] = useState<GuardianRow[]>([]);
  const [maxPerPlayer, setMaxPerPlayer] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState(rosterGuardianEmail ?? '');
  const [inviteOpen, setInviteOpen] = useState(false);

  const base = `/api/coaches/${orgSlug}/teams/${teamId}/guardians`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base);
      if (!res.ok) { setAvailable(false); return; }
      const data = await res.json();
      setMaxPerPlayer(data.maxPerPlayer ?? 2);
      setRows((data.byPlayer?.[playerId] ?? []) as GuardianRow[]);
      setPendingRequests((data.unattachedRequests ?? []) as GuardianRow[]);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [base, playerId]);

  useEffect(() => { load(); }, [load]);

  async function decide(linkId: string, action: 'approve' | 'decline' | 'revoke') {
    setBusy(linkId); setError(null);
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // The playerId travels from the COACH's screen — this is the attachment that turns a
        // typed name into a real connection.
        body: JSON.stringify({ linkId, action, playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'That didn’t go through.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t go through.');
    } finally {
      setBusy(null);
    }
  }

  async function invite() {
    setBusy('invite'); setError(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, email: inviteEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Could not create that invite.');
      setInviteUrl(data.url);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that invite.');
    } finally {
      setBusy(null);
    }
  }

  if (!available || loading) return null;

  const connected = rows.filter(r => r.status === 'verified');
  // An `invited` row is waiting on the PARENT, not on the coach — it gets a status line, not
  // an Approve button, because approving it would create a connection nobody can use.
  const invited = rows.filter(r => r.status === 'invited');
  const waiting = rows.filter(r => r.status === 'pending_approval');
  const atCap = connected.length >= maxPerPlayer;
  const decidable = [...pendingRequests, ...waiting];

  return (
    <div className={styles.panel}>
      {/* The profile page's collapse summary carries the visible "Guardians" title now; this h2
          stays for the DOCUMENT OUTLINE only (the 2026-07-31 staff lesson: the repeated-header
          rule is about the visible header, never the outline). The count + waiting badge remain
          visible below, wording unchanged. */}
      <h2
        className={styles.panelTitle}
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 }}
      >
        {playerFirstName}&rsquo;s guardians
      </h2>
      <p className={styles.rowSub} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {connected.length} connected
        {decidable.length > 0 && <span className={styles.badge}>{decidable.length} waiting</span>}
      </p>
      <p className={styles.rowSub} style={{ marginTop: 0 }}>
        The accountable adults for this player — up to {maxPerPlayer}, so a second household fits.
      </p>

      {rows.length === 0 && (
        <p className={styles.muted}>Nobody is connected to this player yet.</p>
      )}

      {decidable.map(r => (
        <div key={r.id} className={styles.request}>
          <span className={styles.requestWho}>
            {/* When a claim came from a DIFFERENT address than the one invited, the person in
                front of the coach is the CLAIMANT — so they are named first, and the invited
                address is shown as the thing they don't match. Showing only the invited
                address (the old behaviour) hid the single fact that sent this row to the
                queue, and made the approval a guess. */}
            {r.claimedEmail ?? r.email}
            {r.requestedPlayerName && <> · says they&rsquo;re a parent of <strong>{r.requestedPlayerName}</strong></>}
            {r.relationship && <> · {r.relationship}</>}
            {/* An assist, never authorization — it confirms the address, not the relationship. */}
            {r.matchesRosterContact && !r.claimedEmail && (
              <> · <strong>matches the guardian contact on this player</strong></>
            )}
            {r.claimedEmail && (
              <span className={styles.mismatchNote}>
                Accepted your invite to <strong>{r.email}</strong> while signed in as{' '}
                <strong>{r.claimedEmail}</strong> — that mismatch is why it&rsquo;s waiting for you.
                Approve only if you know this is the same person.
              </span>
            )}
          </span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => decide(r.id, 'approve')}
            disabled={busy === r.id || atCap}
            title={atCap ? `This player already has ${maxPerPlayer} connected guardians.` : undefined}
          >
            {/* Names the child explicitly: approving IS the coach asserting this adult belongs
                to THIS player, and a bare "Approve" hides that decision. */}
            Approve as {playerFirstName}
          </button>
          <button type="button" className={styles.linkBtn} onClick={() => decide(r.id, 'decline')} disabled={busy === r.id}>
            Decline
          </button>
        </div>
      ))}

      {invited.map(r => (
        <div key={r.id} className={styles.follower}>
          <span className={styles.followerWho}>
            {r.email} · <em>invite sent — waiting for them to accept</em>
          </span>
          <button type="button" className={styles.linkBtn} onClick={() => decide(r.id, 'revoke')} disabled={busy === r.id}>
            Cancel invite
          </button>
        </div>
      ))}

      {connected.map(r => (
        <div key={r.id} className={styles.follower}>
          <span className={styles.followerWho}>
            {r.email}{r.relationship ? ` · ${r.relationship}` : ''}
            {r.verifiedVia === 'email_match' && <> · connected from your invite</>}
          </span>
          <button type="button" className={styles.linkBtn} onClick={() => decide(r.id, 'revoke')} disabled={busy === r.id}>
            Remove
          </button>
        </div>
      ))}

      {atCap && (
        <p className={styles.muted}>
          This player has the maximum of {maxPerPlayer} connected guardians. Remove one to add another.
        </p>
      )}

      {!atCap && (
        <>
          <div className={styles.divider} />
          {!inviteOpen ? (
            <button type="button" className={styles.btn} onClick={() => setInviteOpen(true)}>
              <Users size={14} aria-hidden /> Invite a guardian directly
            </button>
          ) : (
            <div className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowSub}>
                  Sends to an address you choose. Because you chose it, a person signing in with
                  that exact address is connected without a second approval.
                </div>
                <input
                  className={styles.linkOut}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.85rem' }}
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="parent@example.com"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={invite}
                disabled={busy === 'invite' || !inviteEmail.trim()}
              >
                {busy === 'invite' ? 'Working…' : 'Create invite'}
              </button>
            </div>
          )}
          {inviteUrl && (
            <>
              <p className={styles.muted}>Send this to them — it works once, and expires in 14 days.</p>
              <div className={styles.linkOut}>{inviteUrl}</div>
            </>
          )}
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
