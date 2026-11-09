'use client';
import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import CoachCollapseSection from './CoachCollapseSection';
import styles from './FamilyCard.module.css';
import { possessive } from '@/lib/utils';

/**
 * "{Player}'s guardians" (S5, bottom card) — the coach's per-player guardian management.
 *
 * ⚠ Renders NOTHING while the guardian tier is switched off: the API 404s and this removes
 * itself. A coach must not be shown a panel for something that cannot yet happen.
 *
 * ⚠⚠ AND IT OWNS ITS OWN DISCLOSURE, WHICH IS THE POINT OF THE WRAPPER BEING IN HERE rather than
 * on the page (2026-08-26). The page used to draw a "Guardians" collapse section around this and
 * gate it on guardian-PII alone — but the tier switch is a SERVER env the browser learns about by
 * being 404'd, so the section header rendered and this card returned null inside it. The result
 * was a drawer, on every player, that opened onto nothing. Invisible while every section on the
 * page was expanded by default; obvious the moment they started collapsed, sitting between Safety
 * and Documents as an identical closed header with no content behind it.
 * The component that knows whether it has anything to say is the one that must own the container
 * it would otherwise leave empty.
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
  createdAt: string;
  matchesRosterContact: boolean;
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
  const [maxPerPlayer, setMaxPerPlayer] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [base, playerId]);

  useEffect(() => { load(); }, [load]);

  async function decide(linkId: string, action: 'decline' | 'revoke') {
    setBusy(linkId); setError(null);
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
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
      if (!res.ok) throw new Error(data.message ?? 'Could not send that invitation.');
      // Stage 4a ruling 4: the invitation is EMAILED; there is no link to copy. The invited row appears below.
      setInviteEmail('');
      setInviteOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that invitation.');
    } finally {
      setBusy(null);
    }
  }

  if (!available || loading) return null;

  const connected = rows.filter(r => r.status === 'verified');
  // An `invited` row is waiting on the PARENT, not on the coach — it gets a status line, not
  // an Approve button, because approving it would create a connection nobody can use.
  const invited = rows.filter(r => r.status === 'invited');
  const atCap = connected.length >= maxPerPlayer;
  return (
    <CoachCollapseSection sectionId="guardians" title="Guardians" defaultOpen={false}>
    <div className={styles.panel}>
      {/* The profile page's collapse summary carries the visible "Guardians" title now; this h2
          stays for the DOCUMENT OUTLINE only (the 2026-07-31 staff lesson: the repeated-header
          rule is about the visible header, never the outline). The count remains
          visible below, wording unchanged. */}
      <h2
        className={styles.panelTitle}
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 }}
      >
        {possessive(playerFirstName)} guardians
      </h2>
      <p className={styles.rowSub} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {connected.length} connected
      </p>
      <p className={styles.rowSub} style={{ marginTop: 0 }}>
        The accountable adults for this player — up to {maxPerPlayer}, so a second household fits.
      </p>

      {rows.length === 0 && (
        <p className={styles.muted}>Nobody is connected to this player yet.</p>
      )}

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
              <Users size={14} aria-hidden /> Invite a guardian
            </button>
          ) : (
            <div className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowSub}>
                  We’ll email them an invitation. It works for 30 days.
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
                {busy === 'invite' ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
    </CoachCollapseSection>
  );
}
