'use client';
/**
 * DUPLICATES, THE FAMILIES PAGE'S SECOND TAB (Club Tier Stage 5b — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P3; Asks 7,
 * 8, 18). Each proposal is a card: its reason in words (S5-07: never "surname+phone"), the records side by side with the
 * names as typed and each child's team and season, and — the change that matters — THE REVIEWER CHOOSES WHICH RECORD
 * SURVIVES ("Keep this record" on each side; the default is the side with children, then the newer, never the database's
 * order). One sentence says what merging does; "Merge into <name>" (the screen's one lime is the FIRST card's; a later
 * card's is outlined) and "Not the same person". A merge asks first and cannot be undone (Ask 8). Three or more records
 * that match are one card. The rule and its proposals are the server's (lib/families-duplicates.ts); the server merges
 * only a proposal it would make now, into the keeper this screen sends.
 */
import { useCallback, useState } from 'react';
import KitDialog from '../KitDialog';
import { EmptyCard, LoadFailed, useDeferredLoad, useLatestRead } from '../RepKit';
import PageNotice, { useNotice } from '../PageNotice';
import { useClubBrief } from '../ClubBriefProvider';
import { jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import { useOrg } from '@/lib/org-context';
import { FAMILY_DUPLICATE_WORDS as W } from '@/lib/families-words';
import type { DuplicateProposal, DuplicateSide } from '@/lib/families-duplicates';
import fam from './Families.module.css';

export default function DuplicatesTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { reload: reloadBrief } = useClubBrief();
  const slug = currentOrg?.slug ?? '';
  const url = `/api/admin/families/duplicates?orgSlug=${encodeURIComponent(slug)}`;

  const [proposals, setProposals] = useState<DuplicateProposal[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** The reviewer's keeper per proposal — the server's default until they choose. */
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<DuplicateProposal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<{ proposals?: DuplicateProposal[] }>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setProposals(r.data.proposals ?? []);
  }, [slug, url, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const keeperOf = (p: DuplicateProposal) => keepers[p.id] ?? p.keep;
  const sideOf = (p: DuplicateProposal, id: string) => p.sides.find(s => s.personId === id)!;

  async function act(p: DuplicateProposal, body: Record<string, unknown>, done: string) {
    setBusy(p.id);
    try {
      const r = await moneyFetch<{ error?: string }>(url, jsonInit('POST', body));
      setNotice(r.ok ? { tone: 'good', text: done } : { tone: 'bad', text: refusalText(r.data, W.failed) });
    } catch {
      setNotice({ tone: 'bad', text: W.failed });
    } finally {
      setBusy(null);
      setConfirming(null);
      // The list, and the brief's one count (the rail's Families row and this tab's pill), read again together.
      reloadBrief();
      await load();
    }
  }
  const merge = (p: DuplicateProposal) => {
    const keep = keeperOf(p);
    void act(p, { action: 'merge', keepId: keep, mergeIds: p.sides.map(s => s.personId).filter(id => id !== keep) }, W.merged(sideOf(p, keep).name));
  };
  const notSame = (p: DuplicateProposal) => void act(p, { action: 'not_same', personIds: p.sides.map(s => s.personId) }, W.keptApart);

  if (failed && !proposals) return <LoadFailed title={W.loadFailed} onRetry={() => void load()} />;
  if (!proposals) return <LoadingState label="Loading possible duplicates…" />;

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <p className={fam.lede}>{W.lede}</p>
      {proposals.length === 0 ? (
        <EmptyCard title={W.emptyTitle}>{W.emptyBody}</EmptyCard>
      ) : proposals.map((p, i) => {
        const keep = keeperOf(p);
        const keeper = sideOf(p, keep);
        const others = p.sides.filter(s => s.personId !== keep);
        return (
          <section key={p.id} className={fam.card} aria-label={p.emailChanged ?? W.reason(p.reasons, p.sharedChild, p.sides.length)}>
            <p className={fam.reason}>{p.emailChanged ?? W.reason(p.reasons, p.sharedChild, p.sides.length)}</p>
            <div className={fam.sides} role="radiogroup" aria-label={W.keep}>
              {p.sides.map(s => (
                <Side key={s.personId} side={s} group={p.id} kept={s.personId === keep}
                  onKeep={() => setKeepers(k => ({ ...k, [p.id]: s.personId }))} />
              ))}
            </div>
            <p className={fam.conseq}>
              {W.consequence(keeper.name, others.map(o => o.email), p.sides.some(s => s.children.length > 0))}
            </p>
            <div className={fam.acts}>
              {/* One lime per screen: the first card's Merge; a later card's is outlined. */}
              <button type="button" className={`btn ${i === 0 ? 'btn-lime' : 'btn-outline'}`} disabled={busy != null}
                onClick={() => setConfirming(p)} aria-haspopup="dialog">{W.merge(keeper.name)}</button>
              <button type="button" className="btn btn-outline" disabled={busy != null} onClick={() => notSame(p)}>
                {W.notSame}
              </button>
            </div>
          </section>
        );
      })}

      {confirming && (
        <KitDialog
          kind="question"
          title={W.confirmTitle(
            confirming.sides.filter(s => s.personId !== keeperOf(confirming)).map(s => s.name),
            sideOf(confirming, keeperOf(confirming)).name,
          )}
          onClose={() => setConfirming(null)}
          busy={busy != null}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirming(null)} disabled={busy != null}>{W.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => merge(confirming)} disabled={busy != null}>
                {busy != null ? W.merging : W.confirmYes}
              </button>
            </>
          )}
        >
          <p>{W.confirmBody}</p>
        </KitDialog>
      )}
    </>
  );
}

function Side({ side, group, kept, onKeep }: { side: DuplicateSide; group: string; kept: boolean; onKeep: () => void }) {
  return (
    <div className={`${fam.side}${kept ? ` ${fam.sideKeep}` : ''}`}>
      <label className={fam.keep}>
        <input type="radio" name={`keep-${group}`} checked={kept} onChange={onKeep} />
        {W.keep}
      </label>
      <p className={fam.sideName}>{side.name}</p>
      <dl className={fam.read}>
        {/* A long address wraps only before its "@", never mid-word. */}
        <dt>{W.email}</dt><dd>{side.email.includes('@') ? <>{side.email.slice(0, side.email.indexOf('@'))}<wbr />{side.email.slice(side.email.indexOf('@'))}</> : side.email}</dd>
        {side.phone && <><dt>{W.phone}</dt><dd>{side.phone}</dd></>}
        <dt>{W.children}</dt>
        <dd className={side.children.length ? undefined : fam.quiet}>
          {side.children.length === 0
            ? (side.emptiedAt ? W.noneSince(side.emptiedAt) : W.none)
            : side.children.map(c => <span key={`${c.name}|${c.where}`} className={fam.childLine}>{c.name} · {c.where}</span>)}
        </dd>
        <dt>{W.clubEmail}</dt><dd>{side.optedOut ? W.optedOut : W.on}</dd>
      </dl>
    </div>
  );
}
