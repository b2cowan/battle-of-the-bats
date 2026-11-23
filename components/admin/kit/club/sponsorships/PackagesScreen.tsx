'use client';
/**
 * SPONSORSHIPS › PACKAGES (Board Ready Stage 6, Part 1; round 1 tab 2; "Full" grey, round 2 ask 5). A table at a desk —
 * Package (its deliverables under it) · For · Price · Taken — and the same rows as a list on a phone, the "+" square in the
 * tab's head. "Taken" counts open offers too (ask 7), so a package reads Full when every place is paid, invoiced or
 * offered; Full is the row's one chip, grey (nothing is waiting). Archived packages wait behind one line at the foot.
 */
import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { ClubRow, ClubRowList, ClubSection } from '../RepKit';
import { TabActions } from '../PlaceFrame';
import ck from '../ClubKit.module.css';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney } from '@/lib/club-sponsorships-words';
import { packageFull, takenCount } from '@/lib/club-sponsorships';
import { useSponsorships, type PlacePackage } from './api';
import PackageWindow, { PLACE_KIND_LABEL } from './PackageWindow';
import LoadingState from '@/components/shared/LoadingState';
import css from './Sponsorships.module.css';

/** The package's deliverables, as the row's grey line ("Logo on the division's pages · named division · field banner"). */
const caption = (p: PlacePackage) => [p.logoOnSite ? W.pkg.logoCaption[p.placeKind] : null, ...p.items.map(i => i.text)].filter(Boolean).join(' · ');

export default function PackagesScreen() {
  const { slug, data, error, reload } = useSponsorships();
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const live = data.packages.filter(p => !p.archivedAt);
  const archived = data.packages.filter(p => p.archivedAt);
  const shown = showArchived ? [...live, ...archived] : live;
  const chip = (p: PlacePackage) => (p.archivedAt
    ? <span className={ck.chip}>{W.packages.archived}</span>
    : packageFull(p, p.taken) ? <span className={ck.chip}>{W.packages.full}</span> : null);
  const openPkg = open && open !== 'new' ? data.packages.find(p => p.id === open) ?? null : null;

  return (
    <>
      <TabActions>
        <button type="button" className="btn btn-lime" onClick={() => setOpen('new')} aria-label={W.packages.add}>
          <span className={css.addWord}>+ {W.packages.add}</span>
          <span className={css.addSquare} aria-hidden><Plus size={18} /></span>
        </button>
      </TabActions>
      {data.packages.length === 0 ? (
        <ClubSection><p className={ck.hint}>{W.packages.empty}</p></ClubSection>
      ) : shown.length === 0 ? null : (
        <>
          <div className={css.deskTable}>
            <div className={ck.tableFrame}>
              <table className={ck.table}>
                <thead>
                  <tr>
                    <th scope="col">{W.packages.colPackage}</th>
                    <th scope="col">{W.packages.colFor}</th>
                    <th scope="col" className={css.money}>{W.packages.colPrice}</th>
                    <th scope="col">{W.packages.colTaken}</th>
                    <th scope="col" aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.id} className={css.clickRow} onClick={() => setOpen(p.id)}>
                      <td data-label={W.packages.colPackage}>
                        <button type="button" className={css.tableRowBtn} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); setOpen(p.id); }}>
                          <span className={css.rowName}>{p.name}</span>
                          <span className={css.rowCaption}>{caption(p)}</span>
                        </button>
                      </td>
                      <td data-label={W.packages.colFor}>{PLACE_KIND_LABEL[p.placeKind]}</td>
                      <td data-label={W.packages.colPrice} className={css.money}>{sponsorshipMoney(p.price)}</td>
                      <td data-label={W.packages.colTaken}><span className={css.takenCell}>{chip(p)}{W.packages.taken(takenCount(p.taken), p.howMany)}</span></td>
                      <td className={css.chevronCell}><ChevronRight size={16} aria-hidden /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={css.phoneList}>
            <ClubRowList label={W.tabs.packages}>
              {shown.map(p => (
                <ClubRow key={p.id} as="button" aria-haspopup="dialog" onClick={() => setOpen(p.id)} chevron title={p.name}
                  caption={`${PLACE_KIND_LABEL[p.placeKind]} · ${sponsorshipMoney(p.price)} · ${W.packages.takenPhone(takenCount(p.taken), p.howMany)}`}
                  trail={chip(p)} />
              ))}
            </ClubRowList>
          </div>
          <p className={css.note}>{W.packages.takenCounts}</p>
        </>
      )}
      {archived.length > 0 && (
        <p className={css.archivedToggle}>
          <button type="button" className={css.linkButton} onClick={() => setShowArchived(s => !s)}>
            {showArchived ? W.packages.hideArchived : W.packages.showArchived(archived.length)}
          </button>
        </p>
      )}
      {open === 'new' && <PackageWindow slug={slug} pkg={null} onChanged={() => void reload()} onClose={() => setOpen(null)} />}
      {openPkg && <PackageWindow key={openPkg.id} slug={slug} pkg={openPkg} onChanged={() => void reload()} onClose={() => setOpen(null)} />}
    </>
  );
}
