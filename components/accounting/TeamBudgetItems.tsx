'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users, Send, AlertTriangle } from 'lucide-react';
import styles from './TeamBudgetItems.module.css';

/**
 * The club's window onto vocabulary it does not own (mig 240).
 *
 * A budget item names a budget row now, so the list it is chosen from stopped being decoration —
 * and a coach's own item belongs to their TEAM and appears in no other team's picker (owner ruling
 * 2026-08-15: *"we shouldn't populate 1 team's list with another team"*). This is how a club still
 * notices that three teams have each invented "Provincials entry", and does something about it.
 *
 * ⚠ ONE ACTION, ONE DIRECTION. Publish hands an item to every team. There is deliberately no
 * rename (a club renaming a team's row would change a plan it does not own, and the coach who wrote
 * it would have no idea why), no delete, and no unpublish — an item a team is already planning
 * against cannot be taken back from it.
 *
 * ⚠ PUBLISHING ABSORBS THE TWINS, and the confirmation says so before it happens. Handing out one
 * "Provincials entry" while two other teams keep their own would leave three identical names in one
 * category, splitting one item's spending across three report rows — the exact fragmentation the
 * tiers exist to prevent, arriving through the door meant to fix it.
 */
interface TeamItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string | null;
  teamId: string;
  teamName: string | null;
  /** How many budget lines point at it — a word tried once vs. one a season depends on. */
  lineCount: number;
  duplicatedAcrossTeams: boolean;
  createdAt: string;
}

export default function TeamBudgetItems({ orgSlug, canWrite }: { orgSlug: string; canWrite: boolean }) {
  const [items, setItems] = useState<TeamItem[] | null>(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/admin/accounting/team-budget-items?orgSlug=${orgSlug}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load');
      setItems((await res.json()).items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [orgSlug]);

  useEffect(() => { load(); }, [load]);

  async function publish(item: TeamItem) {
    setPublishing(item.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(
        `/api/admin/accounting/team-budget-items/${item.id}/publish?orgSlug=${orgSlug}`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not publish');
      /* Say what actually happened, not "Saved" — absorbing another team's row is a real change to
         a plan that team wrote, and an admin should read it back rather than infer it. ⚠ COSTS ARE
         NAMED TOO: publishing repoints recorded spending as well as budget lines, and reporting
         only the lines would understate what just moved on another team's books. */
      const moved = [
        data.linesMoved ? `${data.linesMoved} budget line${data.linesMoved === 1 ? '' : 's'}` : null,
        data.costsMoved ? `${data.costsMoved} recorded cost${data.costsMoved === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' and ');
      setNotice(data.absorbed > 0
        ? `“${item.name}” is now available to every team. It replaced ${data.absorbed} other team’s copy of the same name${moved ? `, and ${moved} moved onto it` : ''}.`
        : `“${item.name}” is now available to every team.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setPublishing(null);
    }
  }

  if (items === null && !error) return <p className={styles.muted}>Loading team items…</p>;

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}><Users size={16} aria-hidden /> Items your teams have added</h2>
        <p className={styles.sub}>
          A coach&apos;s own budget item stays with their team and never appears in another team&apos;s
          list. Publish one to hand it to every team — there is no way back, so an item a team is
          already planning against can never be taken away from it.
        </p>
      </header>

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {items && items.length === 0 ? (
        <p className={styles.muted}>
          No team has added an item of its own yet — every plan is written in the standard list and
          whatever you have published.
        </p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Item</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Team</th>
                <th className={`${styles.th} ${styles.thNum}`}>Used by</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map(item => (
                <tr key={item.id} className={styles.tr}>
                  <td className={styles.td} data-label="Item">
                    {item.name}
                    {/* The one thing worth flagging: the same words invented twice is exactly what
                        publishing is for, and an admin should not have to spot it by eye. */}
                    {item.duplicatedAcrossTeams && (
                      <span className={styles.dupe}>
                        <AlertTriangle size={11} aria-hidden /> also added by another team
                      </span>
                    )}
                  </td>
                  <td className={styles.td} data-label="Category">{item.categoryName ?? '—'}</td>
                  <td className={styles.td} data-label="Team">{item.teamName ?? '—'}</td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Used by">
                    {item.lineCount === 0
                      ? <span className={styles.muted}>not used yet</span>
                      : `${item.lineCount} line${item.lineCount === 1 ? '' : 's'}`}
                  </td>
                  <td className={styles.td}>
                    {canWrite && (
                      <button
                        type="button"
                        /* The global ghost button, not a local copy of it — this sits on a page that
                           already uses that class, and one screen with two definitions of the same
                           button is how a later spacing fix gets applied to half of it. */
                        className="btn btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}
                        disabled={publishing === item.id}
                        onClick={() => publish(item)}
                      >
                        <Send size={12} aria-hidden />
                        {publishing === item.id ? 'Publishing…' : 'Publish to all teams'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
