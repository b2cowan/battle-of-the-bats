'use client';
/**
 * DUPLICATES › CHILDREN — the standing queue of records that may be one child (Club Tier Stage 14 S6, Ask 11; drawings tab
 * 6). The Parents half's card, reused: the reason first, the records side by side with "Keep this record" (the kept record
 * decides the child's name and birth date), one sentence on what joining does, then "Join as one child" (the page's one lime
 * is the FIRST card's) and "Not the same child". A join asks first in the small question window (416), and can be undone from
 * the child's page ("Split records"). Two records on one team in one season show why they cannot be joined instead of the
 * consequence, and the Join waits. The rule and its proposals are the server's (lib/children-duplicates.ts); the server joins
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
import { CHILD_JOIN_WORDS as W } from '@/lib/child-join-words';
import { FAMILY_HOME_WORDS } from '@/lib/family-home-words';
import { formatStoredDate } from '@/lib/timezone';
import type { ChildProposal, ChildSide } from '@/lib/children-duplicates';
import fam from './Families.module.css';

const URL_BASE = '/api/admin/families/duplicates/children';

export default function ChildrenDuplicates() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { reload: reloadBrief } = useClubBrief();
  const slug = currentOrg?.slug ?? '';
  const url = `${URL_BASE}?orgSlug=${encodeURIComponent(slug)}`;

  const [proposals, setProposals] = useState<ChildProposal[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** The reviewer's keeper per proposal — the server's default until they choose. */
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<ChildProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<{ proposals?: ChildProposal[] }>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setProposals(r.data.proposals ?? []);
  }, [slug, url, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const keeperOf = (p: ChildProposal) => keepers[p.id] ?? p.keep;
  const sideOf = (p: ChildProposal, id: string) => p.sides.find(s => s.childId === id)!;

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const r = await moneyFetch<{ error?: string }>(url, jsonInit('POST', body));
      setNotice(r.ok ? { tone: 'good', text: done } : { tone: 'bad', text: refusalText(r.data, W.failed) });
    } catch {
      setNotice({ tone: 'bad', text: W.failed });
    } finally {
      setBusy(false);
      setConfirming(null);
      // The list, and the brief's counts (the rail's Families row, this tab's pill and the switch), read again together.
      reloadBrief();
      await load();
    }
  }
  const join = (p: ChildProposal) => {
    const keep = keeperOf(p);
    void act({ action: 'join', keepId: keep, mergeIds: p.sides.map(s => s.childId).filter(id => id !== keep) }, W.joined(sideOf(p, keep).name));
  };
  const notSame = (p: ChildProposal) => void act({ action: 'not_same', childIds: p.sides.map(s => s.childId) }, W.keptApart);

  if (failed && !proposals) return <LoadFailed title={W.loadFailed} onRetry={() => void load()} />;
  if (!proposals) return <LoadingState label={W.loading} />;

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <p className={fam.lede}>{W.lede}</p>
      {proposals.length === 0 ? (
        <EmptyCard title={W.emptyTitle}>{W.emptyBody}</EmptyCard>
      ) : proposals.map((p, i) => {
        const keep = keeperOf(p);
        const keeper = sideOf(p, keep);
        const reason = W.reason(p.reason);
        return (
          <section key={p.id} className={fam.card} aria-label={reason}>
            <p className={fam.reason}>{reason}</p>
            <div className={fam.sides} role="radiogroup" aria-label={W.keep}>
              {p.sides.map(s => (
                <Side key={s.childId} side={s} group={p.id} kept={s.childId === keep}
                  onKeep={() => setKeepers(k => ({ ...k, [p.id]: s.childId }))} />
              ))}
            </div>
            <p className={fam.conseq}>
              {p.blockedBy ? W.blocked(p.blockedBy) : W.consequence(keeper.name, keeper.birthDate, p.seasonCount, p.reason === 'same_parent')}
            </p>
            <div className={fam.acts}>
              {/* One lime per screen: the first card's Join; a later card's is outlined. */}
              <button type="button" className={`btn ${i === 0 ? 'btn-lime' : 'btn-outline'}`} disabled={busy || !!p.blockedBy}
                onClick={() => setConfirming(p)} aria-haspopup="dialog">{W.join}</button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => notSame(p)}>
                {W.notSame}
              </button>
            </div>
          </section>
        );
      })}

      {confirming && (
        <KitDialog
          kind="question"
          title={W.confirmTitle(sideOf(confirming, keeperOf(confirming)).name)}
          onClose={() => setConfirming(null)}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirming(null)} disabled={busy}>{W.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => join(confirming)} disabled={busy}>
                {busy ? W.joining : W.confirmYes}
              </button>
            </>
          )}
        >
          <p>{W.confirmBody(sideOf(confirming, keeperOf(confirming)).name.split(' ')[0], confirming.seasonCount)}</p>
          {/* Signed-in family accounts Stage 4a (Part 8.3; drawing tab 8): a join gives every connected parent of both records the
              one child's teams, so they are named before the club confirms (the read sets them only while the tier is on). */}
          {(() => {
            const line = FAMILY_HOME_WORDS.join.parents(confirming.sides.map(sd => ({ child: sd.name, parents: sd.connectedParents ?? [] })));
            return line ? <p>{line}</p> : null;
          })()}
        </KitDialog>
      )}
    </>
  );
}

function Side({ side, group, kept, onKeep }: { side: ChildSide; group: string; kept: boolean; onKeep: () => void }) {
  return (
    <div className={`${fam.side}${kept ? ` ${fam.sideKeep}` : ''}`}>
      <label className={fam.keep}>
        <input type="radio" name={`keep-${group}`} checked={kept} onChange={onKeep} />
        {W.keep}
      </label>
      <p className={fam.sideName}>{side.name}</p>
      <dl className={fam.read}>
        <dt>Born</dt>
        <dd className={side.birthDate ? undefined : fam.quiet}>{side.birthDate ? formatStoredDate(side.birthDate) : W.born(null)}</dd>
        <dt>Seasons</dt>
        <dd>{side.seasons.map(s => <span key={s} className={fam.childLine}>{s}</span>)}</dd>
        {side.parentLine && <><dt>Parent</dt><dd>{side.parentLine}</dd></>}
        {side.detailLine && <><dt>On file</dt><dd>{side.detailLine}</dd></>}
      </dl>
    </div>
  );
}
